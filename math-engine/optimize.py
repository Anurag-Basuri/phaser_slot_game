"""
Sugar Blast 1000 — Reel Optimizer v6
====================================
Synced with actual engine behavior:
  - seed_random_multipliers() (10% chance, 1-3 spots, weighted x2/x4/x8/x16)
  - Multiplier progression: 0 -> 2 -> 4 -> 8 -> ... -> 128 (no intermediate 1 state)
  - Multiplier cap: 128 (matches game_config.py max_multiplier)
  - Correct paytable (matches frontend options.ts)
"""

import sys, os, csv, random, time

GRID=7; CELLS=49; MIN_CLUSTER=5; WINCAP=25000.0; MAX_MULT=128; SCATTER_ID=7

# Paytable matching frontend options.ts and game_config.py
PAY=[
    [0]*5+[0.40,0.60,0.80,1.00,1.00,2.00,3.00,5.00,10.00,20.00]+[40.00]*35,   # L3 (ID 0)
    [0]*5+[0.50,0.60,0.80,1.00,1.50,2.50,4.00,6.00,12.00,24.00]+[50.00]*35,   # L2 (ID 1)
    [0]*5+[0.60,0.80,1.00,1.50,2.00,3.00,5.00,7.00,16.00,30.00]+[60.00]*35,   # L1 (ID 2)
    [0]*5+[0.80,1.00,1.50,2.00,2.50,4.00,6.00,10.00,20.00,40.00]+[80.00]*35,  # H4 (ID 3)
    [0]*5+[1.00,1.50,2.00,2.50,3.00,6.00,9.00,20.00,40.00,80.00]+[120.00]*35, # H3 (ID 4)
    [0]*5+[1.50,2.00,2.50,3.00,4.00,8.00,12.00,25.00,60.00,120.00]+[200.00]*35, # H2 (ID 5)
    [0]*5+[2.00,3.00,3.50,4.00,5.00,10.00,15.00,30.00,70.00,140.00]+[300.00]*35, # H1 (ID 6)
]
SYMS=["L3","L2","L1","H4","H3","H2","H1"]
FS_MAP={3:10,4:12,5:15,6:20,7:30}

# Multiplier seeding config (matches game_executables.py + game_config.py)
MULT_SEED_CHANCE = 0.10  # game_config.py: multiplier_seed_chance = 0.10
MULT_WEIGHTS = [2, 4, 8, 16]
MULT_PROBS = [80, 15, 4, 1]

def seed_random_multipliers(mults, rng):
    """Pre-seed random multiplier spots before cascade begins (base game only).
    Matches game_executables.py seed_random_multipliers()."""
    if rng.random() < MULT_SEED_CHANCE:
        num_spots = rng.randint(1, 3)
        available = [i for i in range(CELLS) if mults[i] == 0]
        if available:
            num_spots = min(num_spots, len(available))
            chosen = rng.sample(available, num_spots)
            for idx in chosen:
                mults[idx] = rng.choices(MULT_WEIGHTS, weights=MULT_PROBS, k=1)[0]

def make_reel(length,wl,sc,rng):
    reel=[]; last=-1
    for _ in range(length):
        if rng.random()<sc: reel.append(SCATTER_ID); last=SCATTER_ID; continue
        for _ in range(30):
            s=rng.choices(range(7),weights=wl,k=1)[0]
            if s!=last: break
        reel.append(s); last=s
    return reel

def make_all_reels(length,wl,sc,rng):
    return [make_reel(length,wl,sc,rng) for _ in range(7)]

def cascade_loop(board, positions, mults, reels, rng):
    """Run full cascade loop. Returns total win."""
    tw = 0.0
    for _ in range(50):
        visited=[False]*CELLS; exploded=[False]*CELLS; cw=0.0; aw=False
        for st in range(CELLS):
            if visited[st]: continue
            sym=board[st]
            if sym==SCATTER_ID: visited[st]=True; continue
            cl=[st]; visited[st]=True; qi=0
            while qi<len(cl):
                idx=cl[qi]; qi+=1; cr,cc=divmod(idx,7)
                for dr,dc in ((-1,0),(1,0),(0,-1),(0,1)):
                    nr,nc=cr+dr,cc+dc
                    if 0<=nr<7 and 0<=nc<7:
                        ni=nr*7+nc
                        if not visited[ni] and board[ni]==sym: visited[ni]=True; cl.append(ni)
            if len(cl)>=MIN_CLUSTER:
                aw=True; bw=PAY[sym][min(len(cl),49)]
                cm=0
                for idx in cl:
                    if mults[idx]>=2: cm+=mults[idx]
                    exploded[idx]=True
                if cm>0: bw*=cm
                cw+=bw
        if not aw: break
        tw+=cw
        if tw>=WINCAP: tw=WINCAP; break
        # Advance multipliers: 0->2->4->8->...->128 (no intermediate 1 state)
        for i in range(CELLS):
            if exploded[i]:
                m=mults[i]
                if m==0: mults[i]=2       # Direct activation to x2
                else: mults[i]=min(MAX_MULT,m*2)
        # Tumble
        for c in range(7):
            col=[]; ec=0
            for r in range(6,-1,-1):
                idx=r*7+c
                if exploded[idx]: ec+=1
                else: col.insert(0,board[idx])
            rl=reels[c]; rlen=len(rl)
            for _ in range(ec): positions[c]=(positions[c]-1)%rlen; col.insert(0,rl[positions[c]])
            for r in range(7): board[r*7+c]=col[r]
    return tw

def sim_spin(reels,rng):
    """Simulate one basegame spin with engine-accurate behavior.
    
    KEY: Matches the engine's scatter suppression — boards with 3+ scatters
    are rejected for basegame criteria (draw_board lines 73-80).
    Free spins are NOT triggered from basegame sims — they only happen
    via the 'freegame' distribution criteria in the engine.
    """
    # Draw board with scatter suppression (max 50 attempts)
    for _ in range(50):
        board=[0]*CELLS; positions=[0]*7; scatters=0
        for c in range(7):
            rl=reels[c]; rlen=len(rl); pos=rng.randint(0,rlen-1); positions[c]=pos
            for r in range(7):
                sym=rl[(pos+r)%rlen]; board[r*7+c]=sym
                if sym==SCATTER_ID: scatters+=1
        if scatters < 3:
            break
    
    mults=[0]*CELLS
    
    # Seed random multiplier spots BEFORE cascade (matches engine)
    seed_random_multipliers(mults, rng)
    
    tw = cascade_loop(board, positions, mults, reels, rng)
    
    # No free spins in basegame criteria — scatter suppression prevents 3+ scatters
    return tw

def sim_freegame_spin(reels, rng, num_scatters=3):
    """Simulate a forced-freegame spin: draw basegame board with forced scatters -> FS."""
    # Draw basegame board (force scatters by just placing them)
    board=[0]*CELLS; positions=[0]*7
    for c in range(7):
        rl=reels[c]; rlen=len(rl); pos=rng.randint(0,rlen-1); positions[c]=pos
        for r in range(7):
            board[r*7+c]=rl[(pos+r)%rlen]
    
    # Force num_scatters scatter symbols
    avail = list(range(CELLS))
    rng.shuffle(avail)
    for i in range(min(num_scatters, CELLS)):
        board[avail[i]] = SCATTER_ID
    
    mults=[0]*CELLS
    seed_random_multipliers(mults, rng)
    tw = cascade_loop(board, positions, mults, reels, rng)
    
    # Run free spins
    fst = FS_MAP.get(min(num_scatters,7), 0); fd = 0
    while fd < fst and tw < WINCAP:
        fd += 1; sc2 = 0
        mults = [0]*CELLS  # Reset mults per FS (base/ante behavior)
        for c in range(7):
            rl=reels[c]; rlen=len(rl); pos=rng.randint(0,rlen-1); positions[c]=pos
            for r in range(7):
                sym=rl[(pos+r)%rlen]; board[r*7+c]=sym
                if sym==SCATTER_ID: sc2+=1
        tw += cascade_loop(board, positions, mults, reels, rng)
        if tw >= WINCAP: tw = WINCAP; break
        if sc2 >= 3: fst += FS_MAP.get(min(sc2,7), 0)
    return min(tw, WINCAP)

def eval_reels(reels, spins_per_seed, seeds):
    """Evaluate reels using the full distribution mix matching the engine.
    
    Distribution quotas (base mode):
    - 58.0% zero-win (forced zero payout)
    - 41.0% basegame (natural wins, no FS)  
    - 1.0%  freegame (forced free spin trigger)
    - 0.01% wincap (forced 25000x — skip for speed, add as constant)
    """
    rtps = []
    for seed in seeds:
        rng = random.Random(seed)
        total = 0.0
        for _ in range(spins_per_seed):
            r = rng.random()
            if r < 0.58:
                # Zero-win criteria — forced zero
                total += 0.0
            elif r < 0.99:
                # Basegame criteria — natural wins, no FS
                total += sim_spin(reels, rng)
            else:
                # Freegame criteria — forced FS trigger (3-5 scatters)
                sc = rng.choices([3,4,5], weights=[20,10,5], k=1)[0]
                total += sim_freegame_spin(reels, rng, sc)
        # Add wincap contribution: 0.01% × 25000 = 2.5 per spin on average
        total += spins_per_seed * 0.0001 * WINCAP
        rtps.append((total / spins_per_seed) * 100.0)
    return sum(rtps)/len(rtps), rtps

def save_reels_csv(reels, filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename,'w',newline='') as f:
        w=csv.writer(f)
        for r in range(len(reels[0])):
            w.writerow([SYMS[reels[c][r]] if reels[c][r]<7 else "S" for c in range(7)])

def main():
    TARGET = 96.53
    REEL_LEN = 1000
    
    print("="*65)
    print("  Sugar Blast 1000 -- Reel Optimizer v6 (engine-synced)")
    print(f"  Target: {TARGET}%")
    print(f"  Mult cap: {MAX_MULT}x | Seed chance: {MULT_SEED_CHANCE*100}%")
    print("="*65)
    
    # With distribution mix (58% zero, 41% basegame, 1% freegame):
    # basegame wins are diluted by 58% zeros, so need generous base reels
    # to achieve 96.53% overall
    print(f"\n--- Phase 1: Grid sweep ---\n")
    
    best_dist = float('inf')
    best_reels = None
    best_params = None
    
    l3_vals = [76, 78, 80, 82, 84, 86]
    sc_vals = [0.004, 0.006, 0.008, 0.010, 0.012]
    total = len(l3_vals) * len(sc_vals)
    n = 0
    
    for l3 in l3_vals:
        for sc in sc_vals:
            n += 1
            rem = 100 - l3
            # Distribute remaining weight across non-L3 symbols
            w = [l3, rem*0.40, rem*0.25, rem*0.15, rem*0.10, rem*0.06, rem*0.04]
            
            rng = random.Random(42)
            reels = make_all_reels(REEL_LEN, w, sc, rng)
            rtp, _ = eval_reels(reels, 3000, [42, 1337, 9999])
            dist = abs(rtp - TARGET)
            
            marker = ""
            if dist < best_dist:
                best_dist = dist
                best_reels = reels
                best_params = (w[:], sc, l3)
                marker = " <-- BEST"
            
            print(f"  [{n:2d}/{total}] L3={l3}% sc={sc:.3f} -> RTP={rtp:7.2f}% dist={dist:6.2f}{marker}")
    
    w, sc, l3 = best_params
    print(f"\n  Best from grid: L3={l3}% sc={sc:.3f} dist={best_dist:.2f}")
    
    # Phase 2: Hill climb
    print(f"\n--- Phase 2: Hill climb (100 iterations) ---")
    cur_w = w[:]
    cur_sc = sc
    
    for it in range(100):
        temp = 0.05 * (1 - it/100)
        trial_w = [max(0.01, v + random.gauss(0, max(0.1, v*temp))) for v in cur_w]
        trial_sc = max(0.001, cur_sc + random.gauss(0, cur_sc * temp * 2))
        
        rng = random.Random(it * 31 + 500)
        trial_reels = make_all_reels(REEL_LEN, trial_w, trial_sc, rng)
        rtp, _ = eval_reels(trial_reels, 3000, [42, 1337, 9999])
        dist = abs(rtp - TARGET)
        
        if dist < best_dist:
            best_dist = dist
            cur_w = trial_w
            cur_sc = trial_sc
            best_reels = trial_reels
            print(f"    Iter {it+1:3d}: RTP={rtp:7.2f}% dist={dist:.2f}pp sc={trial_sc:.4f}")
    
    # Phase 3: Deep verify
    print(f"\n--- Phase 3: Deep Verification (5k x 5 seeds) ---")
    seeds = list(range(5))
    avg, rtps = eval_reels(best_reels, 5000, seeds)
    for i, rtp in enumerate(rtps):
        print(f"  Seed {i}: RTP = {rtp:.2f}%")
    std = (sum((r-avg)**2 for r in rtps)/len(rtps))**0.5
    print(f"\n  FINAL: {avg:.2f}% +/- {std:.2f}%")
    
    # Save
    d = "sugar_blast_1000/reels"
    save_reels_csv(best_reels, f"{d}/BR0.csv")
    
    # Free spin reels: slightly more generous high symbols
    fs_w = cur_w[:]; fs_w[6]*=1.4; fs_w[5]*=1.3
    rng2 = random.Random(100)
    save_reels_csv(make_all_reels(REEL_LEN,fs_w,cur_sc*1.5,rng2), f"{d}/FR0.csv")
    
    # Super free spin reels
    sf_w = cur_w[:]; sf_w[6]*=1.2
    rng3 = random.Random(200)
    save_reels_csv(make_all_reels(REEL_LEN,sf_w,cur_sc*1.2,rng3), f"{d}/SF0.csv")
    
    print(f"\n{'='*65}")
    print(f"  Target: {TARGET}% | Achieved: {avg:.2f}% +/- {std:.2f}%")
    tw=sum(cur_w)
    for i,s in enumerate(SYMS): print(f"    {s}: {cur_w[i]/tw*100:5.1f}%")
    print(f"  Scatter: {cur_sc:.4f}")
    print(f"  Saved to {d}/")
    print(f"{'='*65}")

if __name__ == "__main__":
    main()
