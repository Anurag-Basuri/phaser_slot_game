"""Quick RTP verification - basegame + freegame only, no wincap forcing"""
import sys, os, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sugar_blast_1000.game_config import GameConfig
from sugar_blast_1000.gamestate import GameState

config = GameConfig()
gs = GameState(config)
gs.current_betmode_name = "base"

betmode = config.bet_modes[0]
n = 500

# Only use basegame + freegame + zero criteria (skip wincap — too slow for quick test)
sim_to_criteria = []
sim_to_criteria.extend(["0"] * int(n * 0.60))
sim_to_criteria.extend(["basegame"] * int(n * 0.365))
sim_to_criteria.extend(["freegame"] * int(n * 0.035))
while len(sim_to_criteria) < n:
    sim_to_criteria.append("basegame")
sim_to_criteria = sim_to_criteria[:n]
random.shuffle(sim_to_criteria)

sims = gs.run_sims(
    betmode_copy_list=None,
    betmode=betmode,
    sim_to_criteria=sim_to_criteria,
    total_threads=1,
    total_repeats=0,
    num_sims=n,
    thread_index=0,
    repeat_count=0,
    compress=True,
    write_event_list=True,
)

total_bet = n * betmode.cost
total_payout = sum(s["payoutMultiplier"] for s in sims)
rtp = total_payout / total_bet
non_zero = sum(1 for s in sims if s["payoutMultiplier"] > 0)
max_win = max(s["payoutMultiplier"] for s in sims)

print(f"\nFull test: {n} sims, cost={betmode.cost}x")
print(f"Total bet: {total_bet:.0f}, Total payout: {total_payout:.2f}")
print(f"RTP: {rtp:.4f} ({rtp*100:.2f}%)")
print(f"Target: ~96.53% (will converge with more sims + optimizer)")
print(f"Non-zero wins: {non_zero}/{n} ({non_zero/n*100:.1f}%)")
print(f"Max single win: {max_win:.2f}x")

# Validate events structure
sample = sims[0]
print(f"\nSample book keys: {list(sample.keys())}")
print(f"Sample events count: {len(sample.get('events', []))}")
if sample.get('events'):
    print(f"First event type: {sample['events'][0].get('type', 'N/A')}")
