"""
Generate dedicated wincap books for each mode.
These are added to the existing books to ensure max-win achievability.

Uses much higher MAX_REPEATS (5000) for wincap criteria to actually hit 25,000x.
"""
import sys, os, json, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sugar_rush_1000.game_config import GameConfig
from sugar_rush_1000.gamestate import GameState
from src.state.state import GeneralGameState

# Monkey-patch MAX_REPEATS for wincap generation
ORIGINAL_CHECK_REPEAT = GeneralGameState.check_repeat

def high_retry_check_repeat(self):
    """Allow up to 5000 retries for wincap criteria."""
    MAX_REPEATS = 5000
    self._repeat_count += 1
    
    if self._repeat_count >= MAX_REPEATS:
        self.repeat = False
        return
    
    dist = self.get_current_betmode_distributions()
    
    if dist.conditions.get("force_wincap", False):
        if self.win_manager.running_bet_win < self.config.wincap:
            self.repeat = True
            return
    
    if dist.win_criteria is not None:
        if dist.win_criteria == 0.0 and self.win_manager.running_bet_win > 0:
            self.repeat = True
            return
        if dist.win_criteria == self.config.wincap and self.win_manager.running_bet_win < self.config.wincap:
            self.repeat = True
            return
    
    if dist.conditions.get("force_freegame", False):
        if self.win_manager.freegame_wins == 0 and not self.wincap_triggered:
            self.repeat = True
            return
    
    self.repeat = False

GeneralGameState.check_repeat = high_retry_check_repeat

# Number of wincap books to generate per mode
WINCAP_COUNT = 5
MATH_DIR = "math"

MODE_COSTS = {
    "base": 1.0,
    "ante": 1.25,
    "bonus": 1000.0,
    "super": 500.0,
}

def generate_wincap_books(mode_name, count):
    """Generate wincap books for a specific mode using run_sims."""
    config = GameConfig()
    
    # Find the wincap distribution for this mode
    betmode = next((bm for bm in config.bet_modes if bm.name == mode_name), None)
    
    if betmode is None:
        print(f"  Mode {mode_name} not found!")
        return []
    
    gs = GameState(config)
    sim_to_criteria = ["wincap"] * count
    
    simulations = gs.run_sims(
        betmode_copy_list=None,
        betmode=betmode,
        sim_to_criteria=sim_to_criteria,
        total_threads=1,
        total_repeats=0,
        num_sims=count,
        thread_index=0,
        repeat_count=0,
        compress=False,
        write_event_list=True,
    )
    
    books = []
    for i, sim in enumerate(simulations):
        payout_bet_units = sim["payoutMultiplier"]
        payout_raw = payout_bet_units * config.wincap * betmode.cost if payout_bet_units > 0 else 0 # actually payoutMultiplier is in bet units.
        # wait, payoutMultiplier in sim is in bet units. wincap is config.wincap (e.g. 25000).
        hit_wincap = payout_bet_units >= config.wincap
        
        books.append({
            "payout": payout_bet_units * betmode.cost, # convert to raw relative to cost
            "events": sim["events"],
            "hit_wincap": hit_wincap,
            "sim_obj": sim
        })
        
        status = "HIT" if hit_wincap else f"MISS ({payout_bet_units:.0f}x bet)"
        print(f"    Wincap book {i+1}/{count}: {status}")
    
    return books

import zstandard as zstd
def merge_wincap_into_lookup(mode_name, wincap_books):
    """Add wincap books to the existing lookup table and zst file."""
    csv_path = os.path.join(MATH_DIR, f"lookUpTable_{mode_name}_0.csv")
    zst_path = os.path.join(MATH_DIR, f"books_{mode_name}.jsonl.zst")
    
    # Read existing
    existing = []
    with open(csv_path, 'r') as f:
        reader = csv.reader(f)
        for row in reader:
            existing.append((int(row[0]), float(row[1]), int(row[2])))
    
    cost = MODE_COSTS[mode_name]
    next_id = max(e[0] for e in existing) + 1
    
    added = 0
    cctx = zstd.ZstdCompressor()
    
    with open(csv_path, 'w', newline='') as f, open(zst_path, 'ab') as zst_file:
        with cctx.stream_writer(zst_file) as compressor:
            for book in wincap_books:
                if book["hit_wincap"]:
                    payout_raw = int(round(book["payout"] * 100))
                    
                    sim = book["sim_obj"]
                    sim["id"] = next_id
                    
                    line = json.dumps({
                        "id": sim["id"],
                        "events": sim["events"],
                        "payoutMultiplier": payout_raw,
                    }) + "\n"
                    compressor.write(line.encode('utf-8'))
                    
                    existing.append((next_id, 1.0, payout_raw))
                    next_id += 1
                    added += 1
                    
        writer = csv.writer(f)
        for book_id, weight, payout in existing:
            writer.writerow([book_id, weight, payout])
    
    return added, len(existing)

def main():
    print("=" * 60)
    print("  Wincap Book Generator")
    print("=" * 60)
    
    for mode in ["base", "ante", "bonus", "super"]:
        print(f"\n  Mode: {mode} (cost={MODE_COSTS[mode]}x)")
        print(f"  Generating {WINCAP_COUNT} wincap books (MAX_REPEATS=5000)...")
        
        books = generate_wincap_books(mode, WINCAP_COUNT)
        hits = sum(1 for b in books if b["hit_wincap"])
        
        print(f"  Results: {hits}/{WINCAP_COUNT} hit 25,000x wincap")
        
        if hits > 0:
            added, total = merge_wincap_into_lookup(mode, books)
            print(f"  Added {added} wincap books to lookup table (now {total} total)")
        else:
            print(f"  WARNING: No wincap hits in {WINCAP_COUNT} attempts!")
            print(f"  The engine's wincap criterion retries up to 5000 times.")
            print(f"  This mode may need more retries or multiplier tuning.")
    
    print(f"\n{'='*60}")
    print(f"  Done! Re-run verify_and_optimize.py to update weights.")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
