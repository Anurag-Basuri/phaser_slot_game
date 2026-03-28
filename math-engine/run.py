"""
Sweet Cluster 1000 — RTP Simulation Engine
Runs Monte Carlo simulations to validate the Return To Player percentage.

Usage:
    python run.py                    # Run with default 1M simulations
    python run.py --sims 10000000    # Run with 10M simulations
    python run.py --export           # Also export outcome CSV files

Outputs:
    - Console: RTP, hit rate, volatility stats
    - output/simulation_results.csv: Per-simulation outcomes
    - output/game_config.json: Static config for Stake Engine RGS
    - output/rtp_report.txt: Detailed RTP breakdown
"""

import argparse
import csv
import json
import os
import random
import time
from collections import defaultdict
from typing import List, Tuple, Dict

from game_config import (
    GRID_ROWS, GRID_COLS, MIN_CLUSTER_SIZE,
    SYMBOL_WEIGHTS, SCATTER_CHANCE, PAYTABLE,
    FREE_SPINS_BY_SCATTER, MULTIPLIER_PROGRESSION,
    MAX_MULTIPLIER, TARGET_RTP, MAX_WIN_MULTIPLIER,
    BUY_REGULAR_SPINS, BUY_SUPER_SPINS, BUY_SUPER_SEED_MULTIPLIERS,
    SYMBOLS,
)
from cluster_evaluator import find_clusters, count_scatters


# ──────────────────────────── GRID GENERATION ────────────────────────────

def pick_symbol() -> int:
    """Pick a weighted random symbol (0-6) or scatter (7)."""
    if random.random() < SCATTER_CHANCE:
        return 7
    total = sum(SYMBOL_WEIGHTS)
    roll = random.random() * total
    for i, w in enumerate(SYMBOL_WEIGHTS):
        roll -= w
        if roll <= 0:
            return i
    return len(SYMBOL_WEIGHTS) - 1


def generate_grid() -> List[List[int]]:
    """Generate a random 7x7 grid of symbols."""
    return [[pick_symbol() for _ in range(GRID_COLS)] for _ in range(GRID_ROWS)]


# ──────────────────────────── MULTIPLIER LOGIC ────────────────────────────

def advance_multiplier(current: int) -> int:
    """Advance multiplier: 1->2(wrapper), 2->4, 4->8, ..., max 1024."""
    if current == 1:
        return 2  # wrapper state
    return min(current * 2, MAX_MULTIPLIER)


def get_display_multiplier(stored: int) -> int:
    """Convert stored multiplier to display value (wrapper=1, 4=2, etc)."""
    if stored == 2:
        return 1
    if stored == 4:
        return 2
    return stored


# ──────────────────────────── SINGLE SPIN SIMULATION ────────────────────────────

def simulate_spin(
    multipliers: List[List[int]] = None,
    is_free_spin: bool = False,
) -> Tuple[float, List[List[int]], int, int]:
    """
    Simulate one complete spin with cascades.
    
    Returns:
        (total_win_multiplier, updated_multipliers, scatter_count, cascade_count)
    """
    if multipliers is None:
        multipliers = [[1] * GRID_COLS for _ in range(GRID_ROWS)]

    grid = generate_grid()
    total_win = 0.0
    cascade_count = 0
    max_scatters = 0

    while True:
        # Find clusters
        clusters = find_clusters(grid, MIN_CLUSTER_SIZE)

        if not clusters:
            # Check scatters on final board
            scatter_positions = count_scatters(grid)
            max_scatters = max(max_scatters, len(scatter_positions))
            break

        cascade_count += 1

        # Process each cluster
        for cluster in clusters:
            sym_id = cluster['symbol_id']
            positions = cluster['positions']
            size_index = min(len(positions) - MIN_CLUSTER_SIZE, 10)
            base_payout = PAYTABLE[sym_id][size_index]

            # Sum multipliers from cluster positions
            total_mult = 0
            for r, c in positions:
                m = multipliers[r][c]
                if m >= 4:
                    total_mult += get_display_multiplier(m)
                # wrapper (m=2) contributes 0 extra

            cluster_payout = base_payout
            if total_mult > 0:
                cluster_payout *= total_mult

            total_win += cluster_payout

            # Advance multipliers at won positions
            for r, c in positions:
                multipliers[r][c] = advance_multiplier(multipliers[r][c])

        # Remove won symbols and cascade
        positions_to_remove = set()
        for cluster in clusters:
            for r, c in cluster['positions']:
                positions_to_remove.add((r, c))

        # Cascade: shift down and fill
        for c in range(GRID_COLS):
            # Collect non-removed cells from bottom to top
            col_symbols = []
            for r in range(GRID_ROWS - 1, -1, -1):
                if (r, c) not in positions_to_remove:
                    col_symbols.append(grid[r][c])
            
            # Fill from bottom
            col_symbols.reverse()
            new_symbols = [pick_symbol() for _ in range(GRID_ROWS - len(col_symbols))]
            full_col = new_symbols + col_symbols

            for r in range(GRID_ROWS):
                grid[r][c] = full_col[r]

    return total_win, multipliers, max_scatters, cascade_count


# ──────────────────────────── ROUND SIMULATION ────────────────────────────

def simulate_round(feature_type: int = 0) -> Dict:
    """
    Simulate a complete game round (base game + possible free spins).
    
    Args:
        feature_type: 0=normal, 1=buy regular FS, 2=buy super FS
    
    Returns:
        Dict with total_win_multiplier, triggered_features, etc.
    """
    total_win = 0.0
    features_triggered = []

    # Base game spin
    multipliers = [[1] * GRID_COLS for _ in range(GRID_ROWS)]

    # Handle buy features
    free_spins = 0
    is_super = False
    
    if feature_type == 1:
        free_spins = BUY_REGULAR_SPINS
        features_triggered.append('buy_regular')
    elif feature_type == 2:
        free_spins = BUY_SUPER_SPINS
        is_super = True
        features_triggered.append('buy_super')
        # Seed center multipliers for super
        for r, c, m in BUY_SUPER_SEED_MULTIPLIERS:
            multipliers[r][c] = m

    if feature_type == 0:
        # Normal spin
        win, multipliers, scatter_count, cascades = simulate_spin(multipliers)
        total_win += win

        # Check scatter trigger
        if scatter_count >= 3:
            free_spins = FREE_SPINS_BY_SCATTER.get(min(scatter_count, 7), 10)
            features_triggered.append(f'scatter_{scatter_count}')

    # Free spins
    if free_spins > 0:
        features_triggered.append(f'free_spins_{free_spins}')
        for _ in range(free_spins):
            win, multipliers, retrigger_scatters, cascades = simulate_spin(
                multipliers, is_free_spin=True
            )
            total_win += win

            # Retrigger check
            if retrigger_scatters >= 3:
                extra = FREE_SPINS_BY_SCATTER.get(min(retrigger_scatters, 7), 10)
                free_spins += extra  # Note: this affects the loop range via enumerate
                features_triggered.append(f'retrigger_{extra}')

    # Apply max win cap
    total_win = min(total_win, MAX_WIN_MULTIPLIER)

    return {
        'total_win': total_win,
        'features': features_triggered,
        'had_free_spins': free_spins > 0,
    }


# ──────────────────────────── MAIN SIMULATION ────────────────────────────

def run_simulation(num_sims: int, export: bool = False):
    """Run the full Monte Carlo RTP simulation."""
    print(f"{'='*60}")
    print(f"  SWEET CLUSTER 1000 — RTP Simulation")
    print(f"  Simulations: {num_sims:,}")
    print(f"  Target RTP: {TARGET_RTP*100:.2f}%")
    print(f"{'='*60}")
    print()

    start_time = time.time()

    total_wagered = 0.0
    total_returned = 0.0
    wins = 0
    losses = 0
    feature_counts = defaultdict(int)
    win_distribution = defaultdict(int)
    max_win = 0.0
    big_wins = 0  # 50x+
    mega_wins = 0  # 250x+
    ultra_wins = 0  # 2500x+

    results = []

    for i in range(num_sims):
        result = simulate_round(feature_type=0)
        total_wagered += 1.0  # 1 unit bet
        win = result['total_win']
        total_returned += win

        if win > 0:
            wins += 1
        else:
            losses += 1

        max_win = max(max_win, win)

        if win >= 50:
            big_wins += 1
        if win >= 250:
            mega_wins += 1
        if win >= 2500:
            ultra_wins += 1

        for feat in result['features']:
            feature_counts[feat] += 1

        # Bucket wins for distribution
        bucket = round(win * 10) / 10  # Round to 0.1
        win_distribution[bucket] += 1

        if export:
            results.append({
                'sim_id': i + 1,
                'win_multiplier': round(win, 6),
                'probability': 1.0 / num_sims,
                'features': '|'.join(result['features']) if result['features'] else 'none',
            })

        # Progress reporting
        if (i + 1) % (num_sims // 10) == 0:
            elapsed = time.time() - start_time
            pct = (i + 1) / num_sims * 100
            current_rtp = total_returned / total_wagered * 100
            print(f"  Progress: {pct:.0f}% | RTP so far: {current_rtp:.4f}% | Elapsed: {elapsed:.1f}s")

    elapsed = time.time() - start_time
    rtp = total_returned / total_wagered
    hit_rate = wins / num_sims

    print()
    print(f"{'='*60}")
    print(f"  RESULTS")
    print(f"{'='*60}")
    print(f"  Simulations:     {num_sims:>12,}")
    print(f"  Total Wagered:   {total_wagered:>12,.2f}")
    print(f"  Total Returned:  {total_returned:>12,.2f}")
    print(f"  RTP:             {rtp*100:>12.4f}%")
    print(f"  Target RTP:      {TARGET_RTP*100:>12.2f}%")
    print(f"  Hit Rate:        {hit_rate*100:>12.2f}%")
    print(f"  Max Win:         {max_win:>12.2f}x")
    print(f"  Big Wins (50x+): {big_wins:>12,}")
    print(f"  Mega Wins (250x+): {mega_wins:>10,}")
    print(f"  Ultra Wins (2500x+): {ultra_wins:>8,}")
    print(f"  Elapsed Time:    {elapsed:>12.1f}s")
    print()

    rtp_pass = abs(rtp - TARGET_RTP) <= 0.01  # Within 1% tolerance for simulation
    print(f"  RTP CHECK: {'✅ PASS' if rtp_pass else '❌ FAIL (adjust weights/paytable)'}")
    print()

    if feature_counts:
        print(f"  Feature Breakdown:")
        for feat, count in sorted(feature_counts.items()):
            print(f"    {feat}: {count:,} ({count/num_sims*100:.4f}%)")
        print()

    # Export files
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)

    if export:
        # CSV simulation results
        csv_path = os.path.join(output_dir, 'simulation_results.csv')
        with open(csv_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['sim_id', 'win_multiplier', 'probability', 'features'])
            writer.writeheader()
            writer.writerows(results)
        print(f"  Exported: {csv_path}")

    # JSON game config for Stake Engine
    config_json = {
        'gameName': 'Sweet Cluster 1000',
        'gameId': 'sweet_cluster_1000',
        'gridSize': GRID_ROWS,
        'minClusterSize': MIN_CLUSTER_SIZE,
        'symbolCount': len(SYMBOLS),
        'symbols': {str(k): {'name': v[0], 'isScatter': v[1]} for k, v in SYMBOLS.items()},
        'symbolWeights': SYMBOL_WEIGHTS,
        'scatterChance': SCATTER_CHANCE,
        'paytable': PAYTABLE,
        'freeSpinsByScatter': {str(k): v for k, v in FREE_SPINS_BY_SCATTER.items()},
        'multiplierProgression': [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
        'maxMultiplier': MAX_MULTIPLIER,
        'maxWin': MAX_WIN_MULTIPLIER,
        'rtp': {
            'target': TARGET_RTP,
            'simulated': round(rtp, 6),
            'simulations': num_sims,
            'hitRate': round(hit_rate, 6),
        },
        'buyFeatures': {
            'regular': {'cost': 100, 'spins': 10},
            'super': {'cost': 500, 'spins': 10},
        },
        'version': '1.0.0',
    }

    json_path = os.path.join(output_dir, 'game_config.json')
    with open(json_path, 'w') as f:
        json.dump(config_json, f, indent=2)
    print(f"  Exported: {json_path}")

    # RTP Report
    report_path = os.path.join(output_dir, 'rtp_report.txt')
    with open(report_path, 'w') as f:
        f.write(f"SWEET CLUSTER 1000 — RTP Report\n")
        f.write(f"{'='*50}\n")
        f.write(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Simulations: {num_sims:,}\n")
        f.write(f"RTP: {rtp*100:.4f}%\n")
        f.write(f"Target: {TARGET_RTP*100:.2f}%\n")
        f.write(f"Hit Rate: {hit_rate*100:.2f}%\n")
        f.write(f"Max Win: {max_win:.2f}x\n")
        f.write(f"Status: {'PASS' if rtp_pass else 'FAIL'}\n\n")
        f.write(f"Feature Triggers:\n")
        for feat, count in sorted(feature_counts.items()):
            f.write(f"  {feat}: {count:,} ({count/num_sims*100:.4f}%)\n")
    print(f"  Exported: {report_path}")
    print()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sweet Cluster 1000 RTP Simulation')
    parser.add_argument('--sims', type=int, default=1_000_000, help='Number of simulations')
    parser.add_argument('--export', action='store_true', help='Export CSV/JSON output files')
    args = parser.parse_args()

    run_simulation(args.sims, args.export)
