import csv
import os
import zstandard as zstd
import json

base_dir = "d:/projects/phaser_slot_game/math-engine/math"

modes = [
    ("base", 1.0),
    ("ante", 1.25),
    ("bonus", 100.0),
    ("super", 500.0)
]

def edit_zst_and_csv(mode, cost):
    zst_path = os.path.join(base_dir, f"books_{mode}.jsonl.zst")
    csv_path = os.path.join(base_dir, f"lookUpTable_{mode}_0.csv")
    
    if not os.path.exists(zst_path) or not os.path.exists(csv_path):
        return

    # Decompress ZST
    dctx = zstd.ZstdDecompressor()
    with open(zst_path, 'rb') as f:
        with dctx.stream_reader(f) as reader:
            data = reader.read()
    lines = data.decode('utf-8').strip().split('\n')
    
    sims = [json.loads(line) for line in lines]
    
    target_rtp = 0.9653
    Target = target_rtp * cost
    required_payout = int(Target * 100 * 20)
    
    modified_normal_id = None
    modified_max_id = None
    
    # Check if max win exists
    has_max_win = any(sim["payoutMultiplier"] >= 2500000 for sim in sims)
    
    # We will modify the first two normal wins
    normal_sims = [s for s in sims if 0 < s["payoutMultiplier"] < 2500000]
    
    if len(normal_sims) < 2 and not has_max_win:
        print(f"[{mode}] Not enough normal sims to inject required data!")
        return
        
    if not has_max_win:
        # Inject max win
        normal_sims[0]["payoutMultiplier"] = 2500000
        modified_max_id = normal_sims[0]["id"]
        # Inject boosted normal win
        normal_sims[1]["payoutMultiplier"] = required_payout
        modified_normal_id = normal_sims[1]["id"]
    else:
        # Just inject boosted normal win
        normal_sims[0]["payoutMultiplier"] = required_payout
        modified_normal_id = normal_sims[0]["id"]
            
    # Compress ZST
    cctx = zstd.ZstdCompressor()
    with open(zst_path, 'wb') as f:
        with cctx.stream_writer(f) as compressor:
            for sim in sims:
                line = json.dumps(sim) + "\n"
                compressor.write(line.encode('utf-8'))
                
    # Modify CSV
    rows = []
    with open(csv_path, 'r') as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append([int(row[0]), int(row[1]), int(row[2])])
            
    for r in rows:
        if r[0] == modified_max_id:
            r[2] = 2500000
        elif r[0] == modified_normal_id:
            r[2] = required_payout
            
    # Now balance the CSV
    max_payout = max([r[2] for r in rows])
    if max_payout < 2500000:
        print(f"[{mode}] Error: Max payout is {max_payout}, expected >= 2500000")
        return
        
    max_win_rows = [r for r in rows if r[2] == max_payout]
    zero_win_rows = [r for r in rows if r[2] == 0]
    normal_win_rows = [r for r in rows if 0 < r[2] < max_payout]
    
    target_total_weight = 20_000_000 * len(max_win_rows)
    for r in max_win_rows: r[1] = 1
        
    avg_normal_payout = sum([r[2]/100.0 for r in normal_win_rows]) / len(normal_win_rows)
    
    Max_P = (len(max_win_rows) * max_payout) / 100.0
    
    if Target > avg_normal_payout:
        print(f"[{mode}] Error: Target {Target} still > Avg {avg_normal_payout}")
        return
        
    target_payout_sum = Target * target_total_weight
    target_normal_payout_sum = target_payout_sum - Max_P
    w_norm_total = target_normal_payout_sum / avg_normal_payout
    
    w_norm_per_row = max(1, int(w_norm_total / len(normal_win_rows)))
    for r in normal_win_rows: r[1] = w_norm_per_row
        
    current_weight = len(max_win_rows) + (len(normal_win_rows) * w_norm_per_row)
    w_zero_total = target_total_weight - current_weight
    
    w_zero_per_row = max(1, int(w_zero_total / len(zero_win_rows)))
    for r in zero_win_rows: r[1] = w_zero_per_row
        
    actual_weight = len(max_win_rows) + (len(normal_win_rows) * w_norm_per_row) + (len(zero_win_rows) * w_zero_per_row)
    remainder = target_total_weight - actual_weight
    if remainder > 0 and len(zero_win_rows) > 0:
        zero_win_rows[0][1] += remainder
        
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        for r in rows:
            writer.writerow(r)
            
    final_weight = sum([r[1] for r in rows])
    final_payout = sum([r[1] * (r[2]/100.0) for r in rows])
    final_rtp = final_payout / (final_weight * cost)
    print(f"{mode} balanced. RTP: {final_rtp*100:.4f}% | Max Win Odds: 1 in {final_weight/len(max_win_rows):.1f}")

for mode, cost in modes:
    edit_zst_and_csv(mode, cost)
