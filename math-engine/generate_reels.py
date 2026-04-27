import csv
import random
import os

def generate_reel_strip(filename, length, weights, scatter_chance=0.0):
    """
    Generates a 7-column CSV reel strip.
    """
    symbols = list(weights.keys())
    probs = list(weights.values())
    
    # Normalize probs
    total = sum(probs)
    probs = [p / total for p in probs]
    
    reels = []
    for _ in range(7):
        reel = []
        for _ in range(length):
            if random.random() < scatter_chance:
                reel.append("S")
            else:
                sym = random.choices(symbols, weights=probs, k=1)[0]
                reel.append(sym)
        reels.append(reel)
        
    # Transpose to write row by row
    rows = []
    for r in range(length):
        row = [reels[c][r] for c in range(7)]
        rows.append(row)
        
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    print(f"Generated {filename} ({length} symbols per reel)")

def main():
    base_dir = "games/sugar_rush_1000/reels"
    
    # Base Game Weights: Lower high-paying symbols to restrict base game massive wins
    base_weights = {
        "L3": 25, "L2": 22, "L1": 20,
        "H4": 12, "H3": 10, "H2": 8, "H1": 3,
    }
    
    # Free Spins Weights: Slightly more high-paying symbols
    fs_weights = {
        "L3": 20, "L2": 18, "L1": 18,
        "H4": 15, "H3": 12, "H2": 10, "H1": 7,
    }
    
    # Super Free Spins Weights: Higher potential
    super_weights = {
        "L3": 15, "L2": 15, "L1": 15,
        "H4": 15, "H3": 15, "H2": 15, "H1": 10,
    }

    # Reel lengths
    LENGTH = 200

    # Scatters: 
    # Base game needs 3+ scatters to trigger. A 7x7 grid reads 7 symbols per reel.
    # To get ~1 in 300 hit rate for free spins, scatter chance needs to be carefully tuned.
    # We will use ~1.5% chance per cell in base game.
    # Free spins have higher scatter chance for retriggers.
    
    generate_reel_strip(f"{base_dir}/BR0.csv", LENGTH, base_weights, scatter_chance=0.015)
    generate_reel_strip(f"{base_dir}/FR0.csv", LENGTH, fs_weights, scatter_chance=0.025)
    generate_reel_strip(f"{base_dir}/SF0.csv", LENGTH, super_weights, scatter_chance=0.02)

if __name__ == "__main__":
    main()
