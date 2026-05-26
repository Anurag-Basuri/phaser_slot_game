"""
Sugar Rush 1000 — Generate Final Production Reel Strips
========================================================
Uses the optimized parameters from v5 optimizer:
  L3=83.3%, L2=8.0%, L1=4.8%, H4=2.3%, H3=1.1%, H2=0.3%, H1=0.2%
  Scatter chance: 0.78%
  Reel length: 1000 symbols per reel
"""

import csv, os, random

SYMS = ["L3","L2","L1","H4","H3","H2","H1","S"]

def make_reel(length, weights, scatter_chance, rng):
    """Generate one reel with anti-clustering (no adjacent same symbol)."""
    reel = []
    last = -1
    for _ in range(length):
        if rng.random() < scatter_chance:
            reel.append("S")
            last = 7
            continue
        for _ in range(30):
            s = rng.choices(range(7), weights=weights, k=1)[0]
            if s != last:
                break
        reel.append(["L3","L2","L1","H4","H3","H2","H1"][s])
        last = s
    return reel

def save_reels(reels, filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        for r in range(len(reels[0])):
            writer.writerow([reels[c][r] for c in range(7)])
    print(f"  Saved {filename} ({len(reels[0])} symbols x 7 reels)")

def main():
    REEL_LEN = 1000
    
    # Optimized weights from v5 (normalized)
    # L3=83.3%, L2=8.0%, L1=4.8%, H4=2.3%, H3=1.1%, H2=0.3%, H1=0.2%
    base_weights = [83.3, 8.0, 4.8, 2.3, 1.1, 0.3, 0.2]
    base_scatter = 0.0078
    
    print("=" * 60)
    print("  Generating Production Reel Strips")
    print("=" * 60)
    
    # 1. Base Game Reels (BR0)
    print("\n  Base Game (BR0):")
    rng = random.Random(42)
    br0 = [make_reel(REEL_LEN, base_weights, base_scatter, rng) for _ in range(7)]
    save_reels(br0, "sugar_rush_1000/reels/BR0.csv")
    
    # 2. Free Spin Reels (FR0) — slightly more generous 
    print("  Free Spins (FR0):")
    fs_weights = base_weights[:]
    fs_weights[6] *= 1.4   # 40% more H1
    fs_weights[5] *= 1.3   # 30% more H2
    fs_scatter = base_scatter * 1.5  # higher scatter for retriggers
    rng2 = random.Random(100)
    fr0 = [make_reel(REEL_LEN, fs_weights, fs_scatter, rng2) for _ in range(7)]
    save_reels(fr0, "sugar_rush_1000/reels/FR0.csv")
    
    # 3. Super Free Spin Reels (SF0) — same as free but slightly more H1
    print("  Super Free Spins (SF0):")
    sf_weights = base_weights[:]
    sf_weights[6] *= 1.2   # 20% more H1
    sf_scatter = base_scatter * 1.2
    rng3 = random.Random(200)
    sf0 = [make_reel(REEL_LEN, sf_weights, sf_scatter, rng3) for _ in range(7)]
    save_reels(sf0, "sugar_rush_1000/reels/SF0.csv")
    
    # Print symbol distribution summary
    print("\n  Symbol Distribution (Base Game):")
    total = sum(base_weights)
    for i, s in enumerate(["L3","L2","L1","H4","H3","H2","H1"]):
        print(f"    {s}: {base_weights[i]/total*100:5.1f}%")
    print(f"    Scatter: {base_scatter*100:.2f}%")
    
    # Verify the saved files
    print("\n  Verifying saved files...")
    for fname in ["BR0.csv", "FR0.csv", "SF0.csv"]:
        path = f"sugar_rush_1000/reels/{fname}"
        with open(path) as f:
            rows = list(csv.reader(f))
        print(f"    {fname}: {len(rows)} rows x {len(rows[0])} cols")
        # Count symbol frequencies in first reel
        from collections import Counter
        col0 = [row[0] for row in rows]
        counts = Counter(col0)
        syms = sorted(counts.items(), key=lambda x: -x[1])
        freq_str = ", ".join(f"{s}={c/len(col0)*100:.0f}%" for s,c in syms[:4])
        print(f"           Reel 0 distribution: {freq_str}")
    
    print("\n" + "=" * 60)
    print("  Production reel strips generated successfully!")
    print("  Next: run 'python games/sugar_rush_1000/run.py' to generate RGS files")
    print("=" * 60)

if __name__ == "__main__":
    main()
