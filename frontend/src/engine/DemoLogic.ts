import { ClusterEvaluator } from '../helpers/ClusterEvaluator';
import { StakePlayResponse } from './StakeEngineClient';
import options from '../options';

/**
 * DemoLogic generates a full sequence of events locally for offline/demo playing.
 * It simulates the backend's Math Engine sequence (reveal -> winInfo -> tumbleBoard -> etc.)
 */
export function generateDemoOutcome(
  betAmount: number,
  featureType: number,
  currentBalance: number,
): StakePlayResponse {
  const gridSize = 7;
  // Scatter is index 7. Increase its weight drastically if Ante Bet (featureType === 3) is active
  const symbolWeights = [18, 16, 15, 14, 13, 12, 9, featureType === 3 ? 12 : 3];
  const totalWeight = symbolWeights.reduce((a, b) => a + b, 0);
  const symbolNames = ['L3', 'L2', 'L1', 'H4', 'H3', 'H2', 'H1', 'S'];

  const pickSymbol = (): number => {
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < symbolWeights.length; i++) {
      roll -= symbolWeights[i];
      if (roll <= 0) return i;
    }
    return symbolWeights.length - 1;
  };

  const createCell = (r: number, c: number, overrideId?: number) => {
    const id = overrideId !== undefined ? overrideId : pickSymbol();
    return { symbol: symbolNames[id], id: id, reel: c, row: r };
  };

  // Generate random board
  let currentBoard: any[][] = [];
  for (let r = 0; r < gridSize; r++) {
    currentBoard[r] = [];
    for (let c = 0; c < gridSize; c++) {
      currentBoard[r][c] = createCell(r, c);
    }
  }

  // Force a cluster of 5 randomly to guarantee some action
  if (Math.random() < 0.8) {
    const startR = Math.floor(Math.random() * 5) + 1;
    const startC = Math.floor(Math.random() * 5) + 1;
    const clusterSymId = Math.floor(Math.random() * 6);
    currentBoard[startR][startC] = createCell(startR, startC, clusterSymId);
    currentBoard[startR + 1][startC] = createCell(startR + 1, startC, clusterSymId);
    currentBoard[startR - 1][startC] = createCell(startR - 1, startC, clusterSymId);
    currentBoard[startR][startC + 1] = createCell(startR, startC + 1, clusterSymId);
    currentBoard[startR][startC - 1] = createCell(startR, startC - 1, clusterSymId);
  }

  // If a feature was bought, inject 3 to 4 scatters to trigger Free Spins
  if (featureType === 1 || featureType === 2) {
    const numScatters = Math.floor(Math.random() * 2) + 3; // 3 or 4 scatters
    let placed = 0;
    while (placed < numScatters) {
      const r = Math.floor(Math.random() * gridSize);
      const c = Math.floor(Math.random() * gridSize);
      if (currentBoard[r][c].id !== 7) {
        currentBoard[r][c] = createCell(r, c, 7);
        placed++;
      }
    }
  }

  const events: any[] = [];
  let eventIndex = 0;

  events.push({
    index: eventIndex++,
    type: 'reveal',
    board: JSON.parse(JSON.stringify(currentBoard)),
    paddingPositions: [],
    gameType: featureType > 0 && featureType < 3 ? 'freespins' : 'basegame',
    anticipation: [0, 0, 0, 0, 0, 0, 0],
  });

  const multipliers: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  
  if (featureType === 1) {
    for (let r = 0; r < gridSize; r++) for (let c = 0; c < gridSize; c++) multipliers[r][c] = 4;
  } else if (featureType === 2) {
    for (let r = 0; r < gridSize; r++) for (let c = 0; c < gridSize; c++) multipliers[r][c] = 2;
  }

  let totalWin = 0;
  let cascading = true;

  while (cascading) {
    const idGrid: number[][] = currentBoard.map(row => row.map(cell => cell.id));
    const evaluator = new ClusterEvaluator(idGrid);
    const clusters = evaluator.findClusters(5);

    if (clusters.length === 0) {
      cascading = false;
      break;
    }

    const wins: any[] = [];
    let cascadeWin = 0;
    
    // Evaluate wins
    for (const cluster of clusters) {
      const sizeIndex = Math.min(cluster.positions.length - 5, 10);
      let clusterWin = options.payvalues[cluster.symbolId][sizeIndex];

      let totalMult = 0;
      cluster.positions.forEach(pos => {
        const m = multipliers[pos.row][pos.col];
        if (m >= 2) totalMult += m;
      });
      if (totalMult > 0) clusterWin *= totalMult;
      
      const realWin = clusterWin * betAmount;
      cascadeWin += realWin;

      wins.push({
        symbol: symbolNames[cluster.symbolId],
        kind: cluster.symbolId,
        win: realWin,
        positions: cluster.positions.map(p => ({ reel: p.col, row: p.row })),
        meta: totalMult > 0 ? { multiplier: totalMult } : {},
      });
    }

    totalWin += cascadeWin;

    events.push({
      index: eventIndex++,
      type: 'winInfo',
      totalWin: totalWin,
      wins: wins,
    });

    // Update multipliers
    let multiUpdated = false;
    for (const cluster of clusters) {
      for (const pos of cluster.positions) {
        const r = pos.row;
        const c = pos.col;
        if (multipliers[r][c] === 0) {
          multipliers[r][c] = 1;
        } else if (multipliers[r][c] === 1) {
          multipliers[r][c] = 2;
        } else {
          multipliers[r][c] = Math.min(multipliers[r][c] * 2, 1024);
        }
        multiUpdated = true;
      }
    }

    if (multiUpdated) {
      events.push({
        index: eventIndex++,
        type: 'multiplierUpdate',
        grid: JSON.parse(JSON.stringify(multipliers)),
      });
    }

    // Tumble Board
    for (const cluster of clusters) {
      for (const pos of cluster.positions) {
        currentBoard[pos.row][pos.col] = null;
      }
    }

    // Drop
    for (let c = 0; c < gridSize; c++) {
      let emptyCount = 0;
      for (let r = gridSize - 1; r >= 0; r--) {
        if (currentBoard[r][c] === null) {
          emptyCount++;
        } else if (emptyCount > 0) {
          currentBoard[r + emptyCount][c] = currentBoard[r][c];
          currentBoard[r + emptyCount][c].row = r + emptyCount;
          currentBoard[r][c] = null;
        }
      }
      for (let r = emptyCount - 1; r >= 0; r--) {
        currentBoard[r][c] = createCell(r, c);
      }
    }

    events.push({
      index: eventIndex++,
      type: 'tumbleBoard',
      board: JSON.parse(JSON.stringify(currentBoard)),
    });
  }

  // Count Scatters
  let scatterCount = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (currentBoard[r][c].id === 7) scatterCount++;
    }
  }

  if (scatterCount >= 3) {
    const fsAwarded = options.freeSpinsByScatter[scatterCount] || 10;
    events.push({
      index: eventIndex++,
      type: 'fsTrigger',
      totalSpins: fsAwarded,
      scatterCount: scatterCount,
      triggerType: 'basegame',
    });
  }

  if (totalWin > 0) {
    events.push({
      index: eventIndex++,
      type: 'setTotalWin',
      amount: totalWin,
    });
  }

  events.push({
    index: eventIndex++,
    type: 'finalWin',
    amount: totalWin,
  });

  return {
    balance: {
      amount: Math.round((Math.max(0, currentBalance - betAmount + totalWin)) * 1000000),
      currency: 'USD'
    },
    round: {
      betID: Date.now(),
      amount: Math.round(betAmount * 1000000),
      active: false,
      state: events
    }
  };
}
