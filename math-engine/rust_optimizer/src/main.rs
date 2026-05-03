use rand::prelude::*;
use rayon::prelude::*;
use std::fs::File;
use std::io::Write;

const CELLS: usize = 49;
const MIN_CLUSTER: usize = 5;
const WINCAP: f64 = 25000.0;
const SCATTER_ID: usize = 7;
const MAX_MULT: i32 = 1024;

// L3, L2, L1, H4, H3, H2, H1
// 0,  1,  2,  3,  4,  5,  6
fn get_payout(sym: usize, count: usize) -> f64 {
    let count = count.min(49);
    if count < MIN_CLUSTER { return 0.0; }
    match sym {
        0 => match count {
            5 => 0.4, 6 => 0.6, 7 => 0.8, 8..=9 => 1.0, 10 => 2.0, 11 => 3.0, 12 => 5.0, 13 => 10.0, 14 => 20.0, _ => 40.0
        },
        1 => match count {
            5 => 0.5, 6 => 0.6, 7 => 0.8, 8 => 1.0, 9 => 1.5, 10 => 2.5, 11 => 4.0, 12 => 6.0, 13 => 12.0, 14 => 24.0, _ => 50.0
        },
        2 => match count {
            5 => 0.6, 6 => 0.8, 7 => 1.0, 8 => 1.5, 9 => 2.0, 10 => 3.0, 11 => 5.0, 12 => 7.0, 13 => 16.0, 14 => 30.0, _ => 60.0
        },
        3 => match count {
            5 => 0.8, 6 => 1.0, 7 => 1.5, 8 => 2.0, 9 => 2.5, 10 => 4.0, 11 => 6.0, 12 => 10.0, 13 => 20.0, 14 => 40.0, _ => 80.0
        },
        4 => match count {
            5 => 1.0, 6 => 1.5, 7 => 2.0, 8 => 2.5, 9 => 3.0, 10 => 6.0, 11 => 9.0, 12 => 20.0, 13 => 40.0, 14 => 80.0, _ => 120.0
        },
        5 => match count {
            5 => 1.5, 6 => 2.0, 7 => 2.5, 8 => 3.0, 9 => 4.0, 10 => 8.0, 11 => 12.0, 12 => 25.0, 13 => 60.0, 14 => 120.0, _ => 200.0
        },
        6 => match count {
            5 => 2.0, 6 => 3.0, 7 => 3.5, 8 => 4.0, 9 => 5.0, 10 => 10.0, 11 => 15.0, 12 => 30.0, 13 => 70.0, 14 => 140.0, _ => 300.0
        },
        _ => 0.0,
    }
}

fn fs_map(scatters: usize) -> usize {
    match scatters {
        0..=2 => 0,
        3 => 10,
        4 => 12,
        5 => 15,
        6 => 20,
        _ => 30,
    }
}

fn make_reel(length: usize, wl: &[f64; 7], sc: f64, rng: &mut StdRng) -> Vec<usize> {
    let mut reel = Vec::with_capacity(length);
    let mut last = 999;
    
    // Create CDF for weights
    let mut sum = 0.0;
    let mut cdf = [0.0; 7];
    for i in 0..7 {
        sum += wl[i];
        cdf[i] = sum;
    }
    
    for _ in 0..length {
        if rng.gen::<f64>() < sc {
            reel.push(SCATTER_ID);
            last = SCATTER_ID;
            continue;
        }
        
        for _ in 0..30 {
            let r = rng.gen::<f64>() * sum;
            let mut s = 0;
            for i in 0..7 {
                if r <= cdf[i] { s = i; break; }
            }
            if s != last {
                reel.push(s);
                last = s;
                break;
            }
        }
    }
    reel
}

fn make_all_reels(length: usize, wl: &[f64; 7], sc: f64, rng: &mut StdRng) -> Vec<Vec<usize>> {
    (0..7).map(|_| make_reel(length, wl, sc, rng)).collect()
}

fn sim_spin(reels: &[Vec<usize>], rng: &mut StdRng) -> f64 {
    let mut board = [0; CELLS];
    let mut positions = [0; 7];
    let mut scatters = 0;
    
    for c in 0..7 {
        let rl = &reels[c];
        let rlen = rl.len();
        let pos = rng.gen_range(0..rlen);
        positions[c] = pos;
        for r in 0..7 {
            let sym = rl[(pos + r) % rlen];
            board[r * 7 + c] = sym;
            if sym == SCATTER_ID { scatters += 1; }
        }
    }
    
    let mut mults = [0; CELLS];
    let mut tw = 0.0;
    
    for _ cascade in 0..50 {
        let mut visited = [false; CELLS];
        let mut exploded = [false; CELLS];
        let mut cw = 0.0;
        let mut aw = false;
        
        for st in 0..CELLS {
            if visited[st] { continue; }
            let sym = board[st];
            if sym == SCATTER_ID { visited[st] = true; continue; }
            
            let mut cl = Vec::with_capacity(49);
            cl.push(st);
            visited[st] = true;
            let mut qi = 0;
            
            while qi < cl.len() {
                let idx = cl[qi];
                qi += 1;
                let cr = idx / 7;
                let cc = idx % 7;
                
                let neighbors = [
                    (cr.wrapping_sub(1), cc), (cr + 1, cc),
                    (cr, cc.wrapping_sub(1)), (cr, cc + 1)
                ];
                
                for &(nr, nc) in &neighbors {
                    if nr < 7 && nc < 7 {
                        let ni = nr * 7 + nc;
                        if !visited[ni] && board[ni] == sym {
                            visited[ni] = true;
                            cl.push(ni);
                        }
                    }
                }
            }
            
            if cl.len() >= MIN_CLUSTER {
                aw = true;
                let mut bw = get_payout(sym, cl.len());
                let mut cm = 0;
                for &idx in &cl {
                    if mults[idx] >= 2 { cm += mults[idx]; }
                    exploded[idx] = true;
                }
                if cm > 0 { bw *= cm as f64; }
                cw += bw;
            }
        }
        
        if !aw { break; }
        tw += cw;
        if tw >= WINCAP { tw = WINCAP; break; }
        
        // Multipliers advance
        for i in 0..CELLS {
            if exploded[i] {
                let m = mults[i];
                if m == 0 { mults[i] = 1; }
                else if m == 1 { mults[i] = 2; }
                else { mults[i] = MAX_MULT.min(m * 2); }
            }
        }
        
        // Tumble
        for c in 0..7 {
            let mut col = Vec::with_capacity(7);
            let mut ec = 0;
            for r in (0..7).rev() {
                let idx = r * 7 + c;
                if exploded[idx] { ec += 1; }
                else { col.insert(0, board[idx]); }
            }
            let rl = &reels[c];
            let rlen = rl.len();
            for _ in 0..ec {
                positions[c] = (positions[c] + rlen - 1) % rlen;
                col.insert(0, rl[positions[c]]);
            }
            for r in 0..7 {
                board[r * 7 + c] = col[r];
            }
        }
    }
    
    // Free spins
    if scatters >= 3 {
        let mut tot_fs = fs_map(scatters);
        let mut fs = 0;
        
        while fs < tot_fs && tw < WINCAP {
            fs += 1;
            let mut sc2 = 0;
            
            for c in 0..7 {
                let rl = &reels[c];
                let rlen = rl.len();
                let pos = rng.gen_range(0..rlen);
                positions[c] = pos;
                for r in 0..7 {
                    let sym = rl[(pos + r) % rlen];
                    board[r * 7 + c] = sym;
                    if sym == SCATTER_ID { sc2 += 1; }
                }
            }
            
            if sc2 >= 3 {
                tot_fs += fs_map(sc2);
            }
            
            for _ cascade in 0..50 {
                let mut visited = [false; CELLS];
                let mut exploded = [false; CELLS];
                let mut cw = 0.0;
                let mut aw = false;
                
                for st in 0..CELLS {
                    if visited[st] { continue; }
                    let sym = board[st];
                    if sym == SCATTER_ID { visited[st] = true; continue; }
                    
                    let mut cl = Vec::with_capacity(49);
                    cl.push(st);
                    visited[st] = true;
                    let mut qi = 0;
                    
                    while qi < cl.len() {
                        let idx = cl[qi];
                        qi += 1;
                        let cr = idx / 7;
                        let cc = idx % 7;
                        
                        let neighbors = [
                            (cr.wrapping_sub(1), cc), (cr + 1, cc),
                            (cr, cc.wrapping_sub(1)), (cr, cc + 1)
                        ];
                        
                        for &(nr, nc) in &neighbors {
                            if nr < 7 && nc < 7 {
                                let ni = nr * 7 + nc;
                                if !visited[ni] && board[ni] == sym {
                                    visited[ni] = true;
                                    cl.push(ni);
                                }
                            }
                        }
                    }
                    
                    if cl.len() >= MIN_CLUSTER {
                        aw = true;
                        let mut bw = get_payout(sym, cl.len());
                        let mut cm = 0;
                        for &idx in &cl {
                            if mults[idx] >= 2 { cm += mults[idx]; }
                            exploded[idx] = true;
                        }
                        if cm > 0 { bw *= cm as f64; }
                        cw += bw;
                    }
                }
                
                if !aw { break; }
                tw += cw;
                if tw >= WINCAP { tw = WINCAP; break; }
                
                for i in 0..CELLS {
                    if exploded[i] {
                        let m = mults[i];
                        if m == 0 { mults[i] = 1; }
                        else if m == 1 { mults[i] = 2; }
                        else { mults[i] = MAX_MULT.min(m * 2); }
                    }
                }
                
                for c in 0..7 {
                    let mut col = Vec::with_capacity(7);
                    let mut ec = 0;
                    for r in (0..7).rev() {
                        let idx = r * 7 + c;
                        if exploded[idx] { ec += 1; }
                        else { col.insert(0, board[idx]); }
                    }
                    let rl = &reels[c];
                    let rlen = rl.len();
                    for _ in 0..ec {
                        positions[c] = (positions[c] + rlen - 1) % rlen;
                        col.insert(0, rl[positions[c]]);
                    }
                    for r in 0..7 {
                        board[r * 7 + c] = col[r];
                    }
                }
            }
        }
    }
    
    tw
}

fn eval_reels(reels: &[Vec<usize>], spins: usize, seeds: &[u64]) -> (f64, Vec<f64>) {
    let results: Vec<f64> = seeds.par_iter().map(|&seed| {
        let mut rng = StdRng::seed_from_u64(seed);
        let mut total_win = 0.0;
        for _ in 0..spins {
            total_win += sim_spin(reels, &mut rng);
        }
        (total_win / spins as f64) * 100.0
    }).collect();
    
    let sum: f64 = results.iter().sum();
    (sum / results.len() as f64, results)
}

fn main() {
    let target = 96.53;
    let reel_len = 1000;
    
    println!("=================================================================");
    println!("  Sugar Rush 1000 — Final Optimizer v6 (Rust Edition)");
    println!("  Target: {}%", target);
    println!("=================================================================");
    
    let w = [80.0, 10.0, 5.0, 2.5, 1.2, 0.8, 0.5]; // Initial weights
    let sc = 0.0088; // Scatter chance
    
    println!("Running deep verification of initial weights in parallel...");
    
    let seeds: Vec<u64> = (0..20).collect();
    let mut rng = StdRng::seed_from_u64(42);
    let reels = make_all_reels(reel_len, &w, sc, &mut rng);
    
    let (avg, rtps) = eval_reels(&reels, 50_000, &seeds);
    
    for (i, rtp) in rtps.iter().enumerate() {
        println!("  Seed {}: RTP = {:.2}%", i, rtp);
    }
    
    let variance: f64 = rtps.iter().map(|x| (x - avg).powi(2)).sum::<f64>() / rtps.len() as f64;
    let std = variance.sqrt();
    
    println!("\n  FINAL: {:.2}% +/- {:.2}% (over 1M simulated spins)", avg, std);
    
    println!("\nNote: Compile with `cargo build --release` for maximum performance.");
}
