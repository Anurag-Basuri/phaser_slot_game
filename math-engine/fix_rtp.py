import csv
import os
import math

def balance_csv(filepath, target_rtp, cost):
    rows = []
    with open(filepath, 'r') as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append([int(row[0]), int(row[1]), int(row[2])])
            
    max_payout = max([r[2] for r in rows])
    
    # Separate rows
    max_win_rows = [r for r in rows if r[2] == max_payout]
    zero_win_rows = [r for r in rows if r[2] == 0]
    normal_win_rows = [r for r in rows if r[2] > 0 and r[2] < max_payout]
    
    if not max_win_rows or not zero_win_rows or not normal_win_rows:
        print(f"Skipping {filepath}: Missing required row types.")
        return

    # Calculate preliminary target_payout_sum with base target_total_weight
    target_total_weight = 20_000_000 * len(max_win_rows)
    avg_normal_payout = sum([r[2]/100.0 for r in normal_win_rows]) / len(normal_win_rows)
    
    # Set max win weight to 1
    for r in max_win_rows:
        r[1] = 1
        
    Max_P = (len(max_win_rows) * max_payout) / 100.0
    Target = target_rtp * cost
    
    if Target > avg_normal_payout:
        max_T = (Max_P - avg_normal_payout) / (Target - avg_normal_payout)
        if 20_000_000 > max_T:
            target_total_weight = int(max_T)
    else:
        # We need normal weight to be large enough to dilute Max_P
        # Target * T = Max_P + W_norm * Avg_P >= Max_P + (T - 1) * Avg_P
        # T * (Target - Avg_P) >= Max_P - Avg_P
        # Since Target < Avg_P, Target - Avg_P is negative
        # T * (Avg_P - Target) <= Avg_P - Max_P
        # This means Avg_P must be greater than Max_P, which is impossible (Max_P is 25000).
        # So Target < Avg_P is actually impossible unless the average normal payout is HUGE.
        pass
        
    if target_total_weight < 20_000_000 * len(max_win_rows):
        print(f"Warning: Forced to lower total weight below 20M for {filepath} to hit RTP.")
        
    target_payout_sum = Target * target_total_weight
    target_normal_payout_sum = target_payout_sum - Max_P
    w_norm_total = target_normal_payout_sum / avg_normal_payout
    
    if w_norm_total < 0:
        w_norm_total = 0
        
    w_norm_per_row = max(1, int(w_norm_total / len(normal_win_rows)))
    
    for r in normal_win_rows:
        r[1] = w_norm_per_row
        
    # Now calculate W_zero to make up the rest of the target_total_weight
    current_weight = len(max_win_rows) + (len(normal_win_rows) * w_norm_per_row)
    w_zero_total = target_total_weight - current_weight
    
    if w_zero_total <= 0:
        print(f"Warning: Cannot hit target total weight for {filepath}. RTP will be slightly off.")
        w_zero_per_row = 1
    else:
        w_zero_per_row = max(1, int(w_zero_total / len(zero_win_rows)))
        
    for r in zero_win_rows:
        r[1] = w_zero_per_row
        
    # Distribute remainder of w_zero_total to the first zero win row to be exact
    actual_weight = len(max_win_rows) + (len(normal_win_rows) * w_norm_per_row) + (len(zero_win_rows) * w_zero_per_row)
    remainder = target_total_weight - actual_weight
    if remainder > 0 and len(zero_win_rows) > 0:
        zero_win_rows[0][1] += remainder

    # Save back to CSV
    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)
        for r in rows:
            writer.writerow(r)
            
    # Verify
    final_weight = sum([r[1] for r in rows])
    final_payout = sum([r[1] * (r[2]/100.0) for r in rows])
    final_rtp = final_payout / (final_weight * cost)
    print(f"{filepath} balanced. Final RTP: {final_rtp*100:.4f}% | Max Win Odds: 1 in {final_weight/len(max_win_rows):.1f}")

base_dir = "d:/projects/phaser_slot_game/math-engine/math"

modes = [
    ("base", 1.0),
    ("ante", 1.25),
    ("bonus", 100.0),
    ("super", 500.0)
]

for mode, cost in modes:
    filepath = os.path.join(base_dir, f"lookUpTable_{mode}_0.csv")
    if os.path.exists(filepath):
        balance_csv(filepath, 0.9653, cost)
