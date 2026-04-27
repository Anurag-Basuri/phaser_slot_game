"""
Sugar Rush 1000 — Final Reel Optimizer v5
==========================================
Start from the best params found in v4 (L3=80%, sc=0.0088)
and do a much finer search with 10,000 spins per eval.
"""

import sys, os, csv, random, time

GRID=7; CELLS=49; MIN_CLUSTER=5; WINCAP=25000.0; MAX_MULT=1024; SCATTER_ID=7
PAY=[
    [0]*5+[0.40,0.60,0.80,1.00,1.00,2.00,3.00,5.00,10.00,20.00]+[40.00]*35,
    [0]*5+[0.50,0.60,0.80,1.00,1.50,2.50,4.00,6.00,12.00,24.00]+[50.00]*35,
    [0]*5+[0.60,0.80,1.00,1.50,2.00,3.00,5.00,7.00,16.00,30.00]+[60.00]*35,
    [0]*5+[0.80,1.00,1.50,2.00,2.50,4.00,6.00,10.00,20.00,40.00]+[80.00]*35,
    [0]*5+[1.00,1.50,2.00,2.50,3.00,6.00,9.00,20.00,40.00,80.00]+[120.00]*35,
    [0]*5+[1.50,2.00,2.50,3.00,4.00,8.00,12.00,25.00,60.00,120.00]+[200.00]*35,
    [0]*5+[2.00,3.00,3.50,4.00,5.00,10.00,15.00,30.00,70.00,140.00]+[300.00]*35,
]
SYMS=["L3","L2","L1","H4","H3","H2","H1"]
FS_MAP={3:10,4:12,5:15,6:20,7:30}

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

def sim_spin(reels,rng):
    board=[0]*CELLS; positions=[0]*7; scatters=0
    for c in range(7):
        rl=reels[c]; rlen=len(rl); pos=rng.randint(0,rlen-1); positions[c]=pos
        for r in range(7):
            sym=rl[(pos+r)%rlen]; board[r*7+c]=sym
            if sym==SCATTER_ID: scatters+=1
    mults=[0]*CELLS; tw=0.0
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
        for i in range(CELLS):
            if exploded[i]:
                m=mults[i]
                if m==0: mults[i]=1
                elif m==1: mults[i]=2
                else: mults[i]=min(MAX_MULT,m*2)
        for c in range(7):
            col=[]; ec=0
            for r in range(6,-1,-1):
                idx=r*7+c
                if exploded[idx]: ec+=1
                else: col.insert(0,board[idx])
            rl=reels[c]; rlen=len(rl)
            for _ in range(ec): positions[c]=(positions[c]-1)%rlen; col.insert(0,rl[positions[c]])
            for r in range(7): board[r*7+c]=col[r]
    if scatters>=3:
        fst=FS_MAP.get(min(scatters,7),0); fd=0
        while fd<fst and tw<WINCAP:
            fd+=1; sc2=0
            for c in range(7):
                rl=reels[c]; rlen=len(rl); pos=rng.randint(0,rlen-1); positions[c]=pos
                for r in range(7):
                    sym=rl[(pos+r)%rlen]; board[r*7+c]=sym
                    if sym==SCATTER_ID: sc2+=1
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
                for i in range(CELLS):
                    if exploded[i]:
                        m=mults[i]
                        if m==0: mults[i]=1
                        elif m==1: mults[i]=2
                        else: mults[i]=min(MAX_MULT,m*2)
                for c in range(7):
                    col=[]; ec=0
                    for r in range(6,-1,-1):
                        idx=r*7+c
                        if exploded[idx]: ec+=1
                        else: col.insert(0,board[idx])
                    rl=reels[c]; rlen=len(rl)
                    for _ in range(ec): positions[c]=(positions[c]-1)%rlen; col.insert(0,rl[positions[c]])
                    for r in range(7): board[r*7+c]=col[r]
            if tw>=WINCAP: break
            if sc2>=3: fst+=FS_MAP.get(min(sc2,7),0)
    return tw

def eval_reels(reels, spins_per_seed, seeds):
    rtps = []
    for seed in seeds:
        rng = random.Random(seed)
        total = sum(sim_spin(reels, rng) for _ in range(spins_per_seed))
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
    print("  Sugar Rush 1000 — Final Optimizer v5")
    print(f"  Target: {TARGET}%")
    print("="*65)
    
    # Best from v4: L3=80%, L2=10%, L1=5.7%, H4=2.9%, H3=1.2%, H2=0.1%, H1=0.1%
    # scatter = 0.0088
    # Achieved 92.71% — need to push up slightly
    
    # Strategy: fine-sweep scatter from 0.006 to 0.014
    # and L3 from 77 to 83%
    
    print(f"\n--- Phase 1: Fine sweep around best known config ---\n")
    
    best_dist = float('inf')
    best_reels = None
    best_params = None
    
    l3_vals = [77, 78, 79, 80, 81, 82, 83]
    sc_vals = [0.006, 0.008, 0.010, 0.012, 0.014]
    total = len(l3_vals) * len(sc_vals)
    n = 0
    
    for l3 in l3_vals:
        for sc in sc_vals:
            n += 1
            rem = 100 - l3
            w = [l3, rem*0.50, rem*0.25, rem*0.12, rem*0.06, rem*0.04, rem*0.03]
            
            rng = random.Random(42)
            reels = make_all_reels(REEL_LEN, w, sc, rng)
            rtp, _ = eval_reels(reels, 5000, [42, 1337, 9999])
            dist = abs(rtp - TARGET)
            
            marker = ""
            if dist < best_dist:
                best_dist = dist
                best_reels = reels
                best_params = (w, sc, l3)
                marker = " <-- BEST"
            
            print(f"  [{n:2d}/{total}] L3={l3}% sc={sc:.3f} -> RTP={rtp:7.2f}% dist={dist:6.2f}{marker}")
    
    w, sc, l3 = best_params
    print(f"\n  Best: L3={l3}% sc={sc:.3f} dist={best_dist:.2f}")
    
    # Phase 2: Hill climb with fixed reel generation seed
    print(f"\n--- Phase 2: Hill climb (80 iterations) ---")
    cur_w = w[:]
    cur_sc = sc
    
    for it in range(80):
        temp = 0.06 * (1 - it/80)
        trial_w = [max(0.05, v + random.gauss(0, max(0.2, v*temp))) for v in cur_w]
        trial_sc = max(0.001, cur_sc + random.gauss(0, cur_sc * temp * 2))
        
        rng = random.Random(it * 31 + 500)
        trial_reels = make_all_reels(REEL_LEN, trial_w, trial_sc, rng)
        rtp, _ = eval_reels(trial_reels, 5000, [42, 1337, 9999])
        dist = abs(rtp - TARGET)
        
        if dist < best_dist:
            best_dist = dist
            cur_w = trial_w
            cur_sc = trial_sc
            best_reels = trial_reels
            print(f"    Iter {it+1:2d}: RTP={rtp:7.2f}% dist={dist:.2f}pp sc={trial_sc:.4f}")
    
    # Phase 3: Deep verify
    print(f"\n--- Phase 3: Deep Verification (10k x 10 seeds) ---")
    seeds = list(range(10))
    avg, rtps = eval_reels(best_reels, 10000, seeds)
    for i, rtp in enumerate(rtps):
        print(f"  Seed {i}: RTP = {rtp:.2f}%")
    std = (sum((r-avg)**2 for r in rtps)/len(rtps))**0.5
    print(f"\n  FINAL: {avg:.2f}% +/- {std:.2f}%")
    
    # Save
    d = "games/sugar_rush_1000/reels"
    save_reels_csv(best_reels, f"{d}/BR0.csv")
    fs_w = cur_w[:]; fs_w[6]*=1.4; fs_w[5]*=1.3
    rng2 = random.Random(100)
    save_reels_csv(make_all_reels(REEL_LEN,fs_w,cur_sc*1.5,rng2), f"{d}/FR0.csv")
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
