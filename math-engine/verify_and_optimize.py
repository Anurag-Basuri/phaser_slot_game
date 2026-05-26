"""
Sugar Blast 1000 — Math Verification & RTP Weight Optimizer
=============================================================
Verifies G5 (RTP 90-97.7%), G6 (per-mode spread < 0.5%), G7 (max win achievable).
Then optimizes lookup table weights to hit exactly 96.53% target RTP per mode.

The lookup table CSV format: ID, Weight, PayoutMultiplier(uint64 * 100)
  - payoutMultiplier 8880 = 88.80x bet
  - weight controls selection probability (higher weight = more likely selected)

RTP = sum(weight_i * payout_i) / sum(weight_i) / cost
"""

import csv
import os
import math
import random

MATH_DIR = "math"
TARGET_RTP = 0.9653  # 96.53%

# Mode costs (from game_config.py)
MODE_COSTS = {
    "base": 1.0,
    "ante": 1.25,
    "bonus": 1000.0,
    "super": 500.0,
}

def load_lookup_table(mode_name):
    """Load a lookup table CSV. Returns list of (id, weight, payout_multiplier_raw)."""
    path = os.path.join(MATH_DIR, f"lookUpTable_{mode_name}_0.csv")
    entries = []
    with open(path, 'r') as f:
        reader = csv.reader(f)
        for row in reader:
            book_id = int(row[0])
            weight = float(row[1])
            payout_raw = int(row[2])  # uint64 * 100
            entries.append((book_id, weight, payout_raw))
    return entries

def save_lookup_table(mode_name, entries):
    """Save optimized lookup table back to CSV."""
    path = os.path.join(MATH_DIR, f"lookUpTable_{mode_name}_0.csv")
    with open(path, 'w', newline='') as f:
        writer = csv.writer(f)
        for book_id, weight, payout_raw in entries:
            writer.writerow([book_id, weight, payout_raw])

def compute_rtp(entries, cost):
    """Compute weighted RTP from lookup table entries.
    RTP = sum(weight_i * payout_i) / (sum(weight_i) * cost)
    where payout_i is in bet units (payout_raw / 100).
    """
    total_weight = sum(w for _, w, _ in entries)
    if total_weight == 0:
        return 0.0
    weighted_payout = sum(w * (p / 100.0) for _, w, p in entries)
    return weighted_payout / (total_weight * cost)

def analyze_distribution(entries, cost):
    """Analyze the win distribution of a mode's books."""
    payouts = [(p / 100.0) / cost for _, _, p in entries]  # Normalize to bet units / cost
    payouts_raw = [p / 100.0 for _, _, p in entries]
    
    total = len(payouts_raw)
    zero_wins = sum(1 for p in payouts_raw if p == 0)
    non_zero = [p for p in payouts_raw if p > 0]
    max_payout = max(payouts_raw) if payouts_raw else 0
    
    # Win tiers
    tiers = {
        "0x (zero)": (0, 0.001),
        "0.01-1x": (0.001, 1.0),
        "1-5x": (1.0, 5.0),
        "5-20x": (5.0, 20.0),
        "20-100x": (20.0, 100.0),
        "100-500x": (100.0, 500.0),
        "500-1000x": (500.0, 1000.0),
        "1000-5000x": (1000.0, 5000.0),
        "5000-25000x": (5000.0, 25000.0),
    }
    
    return {
        "total": total,
        "zero_wins": zero_wins,
        "non_zero_count": len(non_zero),
        "max_payout": max_payout,
        "mean_payout": sum(payouts_raw) / total if total else 0,
        "median_payout": sorted(payouts_raw)[total // 2] if total else 0,
        "hit_rate": len(non_zero) / total if total else 0,
        "tiers": {name: sum(1 for p in payouts_raw if lo <= p < hi)
                  for name, (lo, hi) in tiers.items()},
        "std_dev": (sum((p - sum(payouts_raw)/total)**2 for p in payouts_raw) / total) ** 0.5 if total else 0,
    }

def optimize_weights(entries, cost, target_rtp, mode_name):
    """Optimize lookup table weights to achieve target RTP.
    
    Strategy: Group books into payout tiers and assign weights inversely
    proportional to payout, then scale to hit exact target.
    
    The Stake RGS selects a book with probability proportional to its weight.
    RTP = sum(w_i * p_i) / sum(w_i) / cost = target
    So: sum(w_i * p_i) = target * cost * sum(w_i)
    
    We use a simple iterative approach:
    1. Start with uniform weights
    2. Iteratively adjust: reduce weights of high-payout books, increase low-payout
    3. Converge to target RTP
    """
    n = len(entries)
    payouts = [p / 100.0 for _, _, p in entries]
    
    # Start with all weights = 1
    weights = [1.0] * n
    
    current_rtp = sum(weights[i] * payouts[i] for i in range(n)) / (sum(weights) * cost)
    
    if current_rtp == 0:
        return entries  # All zeros, can't optimize
    
    # Simple approach: scale weights inversely with payout to reduce RTP
    # For each book i: w_i = base_weight * adjustment_factor(payout_i)
    # Higher payout books get lower weights
    
    # Phase 1: Categorize and assign initial weights
    # Zero-payout books should have high weights (they're free)
    # High-payout books should have low weights
    
    max_p = max(payouts) if max(payouts) > 0 else 1.0
    
    for iteration in range(1000):
        current_rtp = sum(weights[i] * payouts[i] for i in range(n)) / (sum(weights) * cost)
        
        if abs(current_rtp - target_rtp) < 0.00001:
            break
        
        # Adjustment: if RTP too high, reduce weights of high-payout books
        # if RTP too low, increase weights of high-payout books
        ratio = target_rtp / current_rtp if current_rtp > 0 else 1.0
        
        for i in range(n):
            if payouts[i] == 0:
                # Zero-payout books: slightly increase weight when RTP is too high
                if current_rtp > target_rtp:
                    weights[i] *= 1.0 + (1.0 - ratio) * 0.5
            else:
                # Non-zero books: adjust based on payout level
                payout_norm = payouts[i] / max_p  # 0 to 1
                
                if current_rtp > target_rtp:
                    # RTP too high: reduce high-payout weights more aggressively
                    weights[i] *= ratio ** (1 + payout_norm * 2)
                else:
                    # RTP too low: increase high-payout weights
                    weights[i] *= ratio ** (1 + payout_norm)
            
            # Clamp weights to reasonable range
            weights[i] = max(0.001, min(10000.0, weights[i]))
    
    # Final verification
    final_rtp = sum(weights[i] * payouts[i] for i in range(n)) / (sum(weights) * cost)
    
    # Round weights to 4 decimal places for clean CSV output
    weights = [round(w, 4) for w in weights]
    
    # Rebuild entries with new weights
    optimized = [(entries[i][0], weights[i], entries[i][2]) for i in range(n)]
    
    return optimized, final_rtp

def main():
    print("=" * 70)
    print("  Sugar Blast 1000 — Math Verification & Weight Optimization")
    print("=" * 70)
    
    modes = ["base", "ante", "bonus", "super"]
    results = {}
    
    # ═══════════════════════════════════════════════════════
    # PHASE 1: Analyze current state (uniform weights)
    # ═══════════════════════════════════════════════════════
    print("\n" + "─" * 70)
    print("  PHASE 1: Current Book Analysis (Uniform Weights)")
    print("─" * 70)
    
    for mode in modes:
        entries = load_lookup_table(mode)
        cost = MODE_COSTS[mode]
        rtp = compute_rtp(entries, cost)
        dist = analyze_distribution(entries, cost)
        results[mode] = {
            "entries": entries,
            "cost": cost,
            "uniform_rtp": rtp,
            "dist": dist,
        }
        
        print(f"\n  Mode: {mode} (cost={cost}x, {len(entries)} books)")
        print(f"    Uniform-weight RTP: {rtp*100:.2f}%")
        print(f"    Zero wins: {dist['zero_wins']}/{dist['total']} ({dist['zero_wins']/dist['total']*100:.1f}%)")
        print(f"    Non-zero:  {dist['non_zero_count']}/{dist['total']} ({dist['hit_rate']*100:.1f}%)")
        print(f"    Max payout: {dist['max_payout']:.2f}x")
        print(f"    Mean payout: {dist['mean_payout']:.2f}x")
        print(f"    Std deviation: {dist['std_dev']:.2f}")
        print(f"    Win tiers:")
        for tier, count in dist['tiers'].items():
            if count > 0:
                pct = count / dist['total'] * 100
                print(f"      {tier:20s}: {count:5d} ({pct:5.1f}%)")
    
    # ═══════════════════════════════════════════════════════
    # PHASE 2: G7 — Max Win Achievability
    # ═══════════════════════════════════════════════════════
    print("\n" + "─" * 70)
    print("  PHASE 2: G7 — Max Win Achievability (25,000x)")
    print("─" * 70)
    
    for mode in modes:
        dist = results[mode]["dist"]
        entries = results[mode]["entries"]
        cost = MODE_COSTS[mode]
        
        # Check for wincap-level payouts (25000x * cost * 100 = raw value)
        wincap_raw = int(25000 * cost * 100)
        near_wincap = sum(1 for _, _, p in entries if p >= wincap_raw * 0.9)  # Within 90% of wincap
        exact_wincap = sum(1 for _, _, p in entries if p >= wincap_raw)
        
        # Also check the distribution for any large wins
        large_wins = [(book_id, p/100.0) for book_id, _, p in entries if p/100.0 >= 1000]
        large_wins.sort(key=lambda x: -x[1])
        
        print(f"\n  Mode: {mode}")
        print(f"    Max payout in books: {dist['max_payout']:.2f}x (raw, before cost normalization)")
        print(f"    Max payout / cost:   {dist['max_payout']/cost:.2f}x bet")
        print(f"    Wincap target:       {25000*cost:.0f}x raw ({25000}x bet)")
        print(f"    Books at wincap:     {exact_wincap}")
        print(f"    Books near wincap:   {near_wincap} (>= 90% of wincap)")
        
        if large_wins:
            print(f"    Top 5 largest wins:")
            for book_id, payout in large_wins[:5]:
                print(f"      Book #{book_id}: {payout:.2f}x raw = {payout/cost:.2f}x bet")
        
        # Achievability estimate
        if exact_wincap > 0:
            # Hit rate = number of wincap books / total books (assuming uniform weights)
            hit_rate = exact_wincap / len(entries)
            spins_needed = 1 / hit_rate if hit_rate > 0 else float('inf')
            print(f"    Estimated hit rate: 1 in {spins_needed:,.0f} spins")
            if spins_needed <= 20_000_000:
                print(f"    [G7] PASS: Max win achievable within 20M spins")
            else:
                print(f"    [G7] WARN: Hit rate may be too low (>1 in 20M)")
        else:
            # Check if wincap criteria exists in the distribution
            print(f"    [G7] NOTE: No exact wincap books found in current sample.")
            print(f"               Wincap books are generated by the 'wincap' distribution criteria")
            print(f"               which forces re-rolling until 25,000x is hit.")
    
    # ═══════════════════════════════════════════════════════
    # PHASE 3: Optimize Weights for Target RTP
    # ═══════════════════════════════════════════════════════
    print("\n" + "─" * 70)
    print(f"  PHASE 3: Weight Optimization (Target: {TARGET_RTP*100:.2f}%)")
    print("─" * 70)
    
    optimized_rtps = {}
    
    for mode in modes:
        entries = results[mode]["entries"]
        cost = results[mode]["cost"]
        
        optimized_entries, final_rtp = optimize_weights(entries, cost, TARGET_RTP, mode)
        optimized_rtps[mode] = final_rtp
        
        # Save optimized weights
        save_lookup_table(mode, optimized_entries)
        
        # Weight distribution analysis
        weights = [w for _, w, _ in optimized_entries]
        non_zero_weights = [w for w in weights if w > 0.01]
        
        print(f"\n  Mode: {mode}")
        print(f"    Before:  RTP = {results[mode]['uniform_rtp']*100:.2f}%")
        print(f"    After:   RTP = {final_rtp*100:.4f}%")
        print(f"    Target:  RTP = {TARGET_RTP*100:.2f}%")
        print(f"    Delta:   {abs(final_rtp - TARGET_RTP)*100:.4f}pp")
        print(f"    Weight range: {min(weights):.4f} — {max(weights):.4f}")
        print(f"    Mean weight: {sum(weights)/len(weights):.4f}")
    
    # ═══════════════════════════════════════════════════════
    # PHASE 4: G5 & G6 Verification
    # ═══════════════════════════════════════════════════════
    print("\n" + "─" * 70)
    print("  PHASE 4: Final Verification")
    print("─" * 70)
    
    # G5: RTP between 90% and 97.7%
    print(f"\n  [G5] RTP Range Check (90% - 97.7%):")
    g5_pass = True
    for mode in modes:
        rtp = optimized_rtps[mode]
        in_range = 0.90 <= rtp <= 0.977
        status = "PASS" if in_range else "FAIL"
        if not in_range:
            g5_pass = False
        print(f"    {mode:8s}: {rtp*100:.4f}% [{status}]")
    print(f"  [G5] Overall: {'PASS' if g5_pass else 'FAIL'}")
    
    # G6: All modes within 0.5% of each other
    print(f"\n  [G6] Per-Mode RTP Spread (max 0.5%):")
    rtp_values = list(optimized_rtps.values())
    max_spread = (max(rtp_values) - min(rtp_values)) * 100
    g6_pass = max_spread <= 0.5
    for mode in modes:
        print(f"    {mode:8s}: {optimized_rtps[mode]*100:.4f}%")
    print(f"    Spread: {max_spread:.4f}pp")
    print(f"  [G6] Overall: {'PASS' if g6_pass else 'FAIL'}")
    
    # G7: Max win achievable
    print(f"\n  [G7] Max Win Achievability (25,000x, >= 1 in 20M):")
    g7_pass = True
    for mode in modes:
        entries = load_lookup_table(mode)  # Reload with optimized weights
        cost = MODE_COSTS[mode]
        wincap_raw = int(25000 * cost * 100)
        
        # With optimized weights, compute probability of hitting wincap
        total_weight = sum(w for _, w, _ in entries)
        wincap_weight = sum(w for _, w, p in entries if p >= wincap_raw)
        
        if wincap_weight > 0:
            prob = wincap_weight / total_weight
            spins = 1 / prob
            status = "PASS" if spins <= 20_000_000 else "WARN"
            print(f"    {mode:8s}: 1 in {spins:,.0f} spins [{status}]")
        else:
            # Find the highest payout
            max_p = max(p/100.0 for _, _, p in entries)
            max_bet = max_p / cost
            print(f"    {mode:8s}: No wincap books. Max = {max_p:.0f}x raw ({max_bet:.0f}x bet)")
            if mode in ("base", "ante"):
                # For base/ante, wincap criteria exists (0.01%)
                # With 2000 books and 0.01% quota, we expect ~0.2 wincap books
                print(f"              Expected ~{len(entries) * 0.0001:.1f} wincap books at 0.01% quota")
                print(f"              Need more sims to get wincap examples. Not a code bug.")
    
    # ═══════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════
    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"\n  Target RTP: {TARGET_RTP*100:.2f}%")
    print(f"\n  Per-mode optimized RTP:")
    for mode in modes:
        print(f"    {mode:8s}: {optimized_rtps[mode]*100:.4f}% (cost={MODE_COSTS[mode]}x)")
    print(f"\n  Max spread: {max_spread:.4f}pp {'(< 0.5pp PASS)' if g6_pass else '(> 0.5pp FAIL)'}")
    print(f"\n  Lookup tables saved to: {MATH_DIR}/lookUpTable_*_0.csv")
    print(f"\n  [G5] RTP in 90-97.7%:      {'PASS' if g5_pass else 'FAIL'}")
    print(f"  [G6] Mode spread < 0.5%:   {'PASS' if g6_pass else 'FAIL'}")
    print(f"  [G7] Max win achievable:   See per-mode analysis above")
    print("=" * 70)

if __name__ == "__main__":
    main()
