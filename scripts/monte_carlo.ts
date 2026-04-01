import options from '../src/options';
import { ClusterEvaluator } from '../src/helpers/ClusterEvaluator';

const SPINS = 200000; // Large sample size (1 million takes a bit on single thread)
const BET = 1.0;

let totalSpent = 0;
let totalWon = 0;
let totalScattersHit = 0;
let baseGameWins = 0;
let freeSpinsWins = 0;
let maxWinsHit = 0;

function pickSymbol(): number {
  if (Math.random() < options.scatterChance) return 7;
  let roll = Math.random() * 100;
  for (let i = 0; i < options.symbolWeights.length; i++) {
    roll -= options.symbolWeights[i];
    if (roll <= 0) return i;
  }
  return options.symbolWeights.length - 1;
}

function createGrid(): number[][] {
  const g: number[][] = [];
  for (let r = 0; r < options.gridSize; r++) {
    g[r] = [];
    for (let c = 0; c < options.gridSize; c++) {
      g[r][c] = pickSymbol();
    }
  }
  return g;
}

function processTumble(
  grid: number[][],
  multipliers: number[][],
  isFreeSpins: boolean = false
): { tumbleWin: number, scatters: number } {
  let cascadeActive = true;
  let tumbleTotalWin = 0;
  let totalScattersFound = 0;

  // Initial scatter scan before tumbling destroys them
  for (let r = 0; r < options.gridSize; r++) {
    for (let c = 0; c < options.gridSize; c++) {
      if (grid[r][c] === 7) totalScattersFound++;
    }
  }

  while (cascadeActive) {
    const evaluator = new ClusterEvaluator(grid);
    const clusters = evaluator.findClusters(5);

    if (clusters.length === 0) {
      cascadeActive = false;
      continue;
    }

    let cascadeWin = 0;

    // Process wins and double multipliers
    for (const cluster of clusters) {
      const sizeIndex = Math.min(cluster.positions.length - 5, 10);
      let clusterWin = options.payvalues[cluster.symbolId][sizeIndex];

      let multSum = 0;
      for (const pos of cluster.positions) {
        if (multipliers[pos.row][pos.col] >= 2) {
          multSum += multipliers[pos.row][pos.col];
        }
      }
      if (multSum > 0) clusterWin *= multSum;
      cascadeWin += clusterWin * BET;

      // Mark for explosion and bump multiplier
      for (const pos of cluster.positions) {
        grid[pos.row][pos.col] = -1; // Exploded
        if (multipliers[pos.row][pos.col] === 1) {
          multipliers[pos.row][pos.col] = 2;
        } else {
          multipliers[pos.row][pos.col] = Math.min(multipliers[pos.row][pos.col] * 2, 1024);
        }
      }
    }

    tumbleTotalWin += cascadeWin;

    // Apply gravity
    for (let c = 0; c < options.gridSize; c++) {
      for (let r = options.gridSize - 1; r >= 0; r--) {
        if (grid[r][c] === -1) {
          for (let k = r - 1; k >= 0; k--) {
            if (grid[k][c] !== -1) {
              grid[r][c] = grid[k][c];
              grid[k][c] = -1;
              break;
            }
          }
        }
      }
    }

    // Refill tops
    for (let c = 0; c < options.gridSize; c++) {
      for (let r = options.gridSize - 1; r >= 0; r--) {
        if (grid[r][c] === -1) {
          grid[r][c] = pickSymbol();
          // DO NOT count scatters during tumble refills based on engine spec, or DO? 
          // Usually Pragmatic games allow scatters in tumble drops. Let's count them!
          if (grid[r][c] === 7) totalScattersFound++;
        }
      }
    }
  }

  return { tumbleWin: tumbleTotalWin, scatters: totalScattersFound };
}

function runSpin() {
  totalSpent += BET;
  const grid = createGrid();
  const multipliers = Array.from({ length: options.gridSize }, () => Array(options.gridSize).fill(1));
  
  const { tumbleWin, scatters } = processTumble(grid, multipliers, false);
  let roundWin = tumbleWin;
  baseGameWins += tumbleWin;

  if (scatters >= 3) {
    totalScattersHit++;
    let fsAwarded = options.freeSpinsByScatter[Math.min(scatters, 7)] || 10;
    
    // Multipliers persist in free spins
    while (fsAwarded > 0) {
      fsAwarded--;
      const fsGrid = createGrid();
      const fsResult = processTumble(fsGrid, multipliers, true);
      roundWin += fsResult.tumbleWin;
      freeSpinsWins += fsResult.tumbleWin;

      // Retrigger
      if (fsResult.scatters >= 3) {
        fsAwarded += options.freeSpinsByScatter[Math.min(fsResult.scatters, 7)] || 10;
      }
    }
  }

  if (roundWin >= options.maxWinMultiplier * BET) {
    roundWin = options.maxWinMultiplier * BET;
    maxWinsHit++;
  }

  totalWon += roundWin;
}

console.log(`Starting Monte Carlo Simulation: ${SPINS.toLocaleString()} spins...`);
const start = Date.now();

for (let i = 0; i < SPINS; i++) {
  if (i > 0 && i % 50000 === 0) {
    console.log(`... ${i.toLocaleString()} spins processed`);
  }
  runSpin();
}

const end = Date.now();
const rtp = (totalWon / totalSpent) * 100;

console.log("\n--- SIMULATION RESULTS ---");
console.log(`Spins Simulated : ${SPINS.toLocaleString()}`);
console.log(`Time Elapsed    : ${((end - start)/1000).toFixed(2)} seconds`);
console.log(`Total Spent     : $${totalSpent.toLocaleString()}`);
console.log(`Total Return    : $${totalWon.toLocaleString()}`);
console.log(`Exact RTP       : ${rtp.toFixed(4)}%`);
console.log(`Base Game Payout: $${baseGameWins.toLocaleString()}`);
console.log(`Bonus Payout    : $${freeSpinsWins.toLocaleString()}`);
console.log(`FS Triggers     : ${totalScattersHit.toLocaleString()} (1 in ${Math.round(SPINS / (totalScattersHit || 1))})`);
console.log(`Max Wins (25kX) : ${maxWinsHit} (1 in ${(SPINS / Math.max(1, maxWinsHit)).toLocaleString()})`);
