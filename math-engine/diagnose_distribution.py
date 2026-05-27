"""Larger sample distribution test — 2000 sims for better statistical accuracy."""
import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sugar_blast_1000.game_config import GameConfig
from sugar_blast_1000.gamestate import GameState

config = GameConfig()
gs = GameState(config)
gs.current_betmode_name = "base"

betmode = config.bet_modes[0]
n = 2000

# Build criteria
sim_to_criteria = []
for dist in betmode.distributions:
    count = max(1, int(dist.quota * n))
    sim_to_criteria.extend([dist.criteria] * count)
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

# Bucket the wins
buckets = [
    (0, 0.1), (0.1, 1), (1, 2), (2, 5), (5, 10),
    (10, 20), (20, 50), (50, 100), (100, 200), (200, 500),
    (500, 1000), (1000, 2000), (2000, 5000), (5000, 10000),
    (10000, 20000), (20000, 100000),
]
bucket_counts = {b: 0 for b in buckets}
zero_count = 0
all_wins = []

for s in sims:
    payout = s["payoutMultiplier"]
    if payout == 0:
        zero_count += 1
        continue
    all_wins.append(payout)
    for lo, hi in buckets:
        if lo < payout <= hi:
            bucket_counts[(lo, hi)] += 1
            break

total_bet = n * betmode.cost
total_payout = sum(s["payoutMultiplier"] for s in sims)
rtp = total_payout / total_bet

print(f"\n{'='*60}")
print(f"  DISTRIBUTION TEST — {n} sims, base mode")
print(f"{'='*60}")
print(f"  RTP: {rtp:.4f} ({rtp*100:.2f}%)")
print(f"  Zero wins: {zero_count} ({zero_count/n*100:.1f}%)")
print(f"  Non-zero wins: {len(all_wins)} ({len(all_wins)/n*100:.1f}%)")
if all_wins:
    print(f"  Max win: {max(all_wins):.2f}x")
    print(f"  Avg win (non-zero): {sum(all_wins)/len(all_wins):.2f}x")
    print(f"  Median win: {sorted(all_wins)[len(all_wins)//2]:.2f}x")

print(f"\n  {'Range':<20} {'Count':<10} {'% of total':<12} {'Eff Hit-Rate':<12}")
print(f"  {'-'*54}")
for (lo, hi), count in bucket_counts.items():
    pct = count/n*100
    eff_hr = (n / count) if count > 0 else 0
    marker = " ***" if count == 0 and lo <= 500 else ""
    print(f"  ({lo:>7}, {hi:>7})  {count:<10} {pct:>8.2f}%   1 in {eff_hr:>8.1f}{marker}")
