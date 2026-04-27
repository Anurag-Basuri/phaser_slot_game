import sys
import os
import random
import csv
import concurrent.futures

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from games.sugar_rush_1000.game_config import GameConfig
from games.sugar_rush_1000.gamestate import GameState

def generate_reel_strip(length, weights, scatter_chance=0.0):
    symbols = list(weights.keys())
    probs = list(weights.values())
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
    return reels

def evaluate_reels(reels, spins=500):
    # Temporarily override the config to use these specific reels
    config = GameConfig()
    
    # Format the reels for the engine
    rows = []
    for r in range(len(reels[0])):
        row = [reels[c][r] for c in range(7)]
        rows.append(row)
        
    config.reels = {"BR0": rows, "FR0": rows, "SF0": rows}
    
    # We'll just test the base game
    gs = GameState(config)
    gs.current_betmode_name = "base"
    betmode = gs.get_current_betmode()
    
    total_bet = 0.0
    total_win = 0.0
    
    for i in range(spins):
        gs.criteria = betmode.distributions[0].criteria
        gs.run_spin(i)
        total_bet += betmode.cost
        total_win += gs.win_manager.running_bet_win
        
    return (total_win / total_bet) * 100 if total_bet > 0 else 0

def save_reels(reels, filename):
    rows = []
    for r in range(len(reels[0])):
        row = [reels[c][r] for c in range(7)]
        rows.append(row)
        
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

def main():
    print("--- 🧬 Starting Python Reel Optimizer (Hill Climbing) ---")
    
    TARGET_RTP = 96.53
    best_rtp = float('inf')
    best_reels = None
    
    base_weights = {
        "L3": 25, "L2": 22, "L1": 20,
        "H4": 12, "H3": 10, "H2": 8, "H1": 3,
    }
    
    # We will try 10 completely random generations to find the one with the lowest RTP
    # then we'll save that as the baseline
    print("Searching for lowest variance reel strips...")
    for generation in range(10):
        print(f"Generation {generation+1}/10...")
        # Add slight randomness to weights
        weights = {k: max(1, v + random.randint(-2, 2)) for k, v in base_weights.items()}
        reels = generate_reel_strip(200, weights, scatter_chance=0.01)
        
        rtp = evaluate_reels(reels, spins=200)
        print(f"  -> RTP: {rtp:.2f}%")
        
        # We want to find reels that naturally produce the LOWEST RTP, 
        # so we can scale them up to 96% rather than fighting 100,000%
        if rtp < best_rtp:
            best_rtp = rtp
            best_reels = reels
            
    print(f"\nBest Base RTP found: {best_rtp:.2f}%")
    save_reels(best_reels, "games/sugar_rush_1000/reels/BR0.csv")
    print("Saved to BR0.csv")

if __name__ == "__main__":
    main()
