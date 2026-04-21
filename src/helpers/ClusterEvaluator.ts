export interface Position {
  row: number;
  col: number;
}

export interface Cluster {
  symbolId: number;
  positions: Position[];
}

export class ClusterEvaluator {
  private grid: number[][]; // 2D array of symbol IDs. -1 means empty.
  private rows: number;
  private cols: number;

  constructor(grid: number[][]) {
    this.grid = grid;
    this.rows = grid.length;
    this.cols = grid[0].length;
  }

  public findClusters(minSize: number = 5): Cluster[] {
    const visited: boolean[][] = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(false)
    );
    const clusters: Cluster[] = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!visited[r][c] && this.grid[r][c] !== -1) {
          const symbolId = this.grid[r][c];
          // We ignore scatter (symbolId 8) for cluster logic usually, or handle separately
          if (symbolId === 8) continue; 
          
          // If starting on a Wild, we won't evaluate it by itself as its own cluster.
          // It only evaluates as part of adjacent regular symbols.
          if (symbolId === 7) continue;
          
          const clusterPositions = this.dfs(r, c, symbolId, visited);
          if (clusterPositions.length >= minSize) {
            clusters.push({ symbolId, positions: clusterPositions });
          }
        }
      }
    }

    return clusters;
  }

  private dfs(r: number, c: number, targetSymbol: number, visited: boolean[][]): Position[] {
    const stack: Position[] = [{ row: r, col: c }];
    const clusterPositions: Position[] = [];
    visited[r][c] = true;

    const directions = [
      { dr: -1, dc: 0 }, // Up
      { dr: 1, dc: 0 },  // Down
      { dr: 0, dc: -1 }, // Left
      { dr: 0, dc: 1 }   // Right
    ];

    while (stack.length > 0) {
      const current = stack.pop()!;
      clusterPositions.push(current);

      for (const dir of directions) {
        const nr = current.row + dir.dr;
        const nc = current.col + dir.dc;

        if (this.isValid(nr, nc) && !visited[nr][nc]) {
          const neighborId = this.grid[nr][nc];
          if (neighborId === targetSymbol || neighborId === 7) {
            visited[nr][nc] = true;
            stack.push({ row: nr, col: nc });
          }
        }
      }
    }

    return clusterPositions;
  }

  private isValid(r: number, c: number): boolean {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }
}
