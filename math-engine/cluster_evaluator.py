"""
Sweet Cluster 1000 — Cluster Evaluator
Finds connected clusters of same-symbol cells using Depth-First Search.
This mirrors the TypeScript ClusterEvaluator for RTP validation.
"""

from typing import List, Tuple, Set


def find_clusters(grid: List[List[int]], min_size: int = 5) -> List[dict]:
    """
    Find all connected clusters of matching symbols in the grid.
    
    Args:
        grid: 2D array of symbol IDs. -1 or 7 (scatter) skipped for clustering.
        min_size: Minimum cells in a cluster to count as a win.
    
    Returns:
        List of dicts: { 'symbol_id': int, 'positions': [(row, col), ...] }
    """
    rows = len(grid)
    cols = len(grid[0])
    visited = [[False] * cols for _ in range(rows)]
    clusters = []

    for r in range(rows):
        for c in range(cols):
            if not visited[r][c] and grid[r][c] != -1 and grid[r][c] != 7:
                symbol_id = grid[r][c]
                positions = _dfs(grid, r, c, symbol_id, visited, rows, cols)
                if len(positions) >= min_size:
                    clusters.append({
                        'symbol_id': symbol_id,
                        'positions': positions,
                    })

    return clusters


def _dfs(
    grid: List[List[int]],
    start_r: int,
    start_c: int,
    target: int,
    visited: List[List[bool]],
    rows: int,
    cols: int,
) -> List[Tuple[int, int]]:
    """Depth-first search to find connected cells with the same symbol."""
    stack = [(start_r, start_c)]
    visited[start_r][start_c] = True
    cluster = []

    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]  # Up, Down, Left, Right

    while stack:
        r, c = stack.pop()
        cluster.append((r, c))

        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and not visited[nr][nc] and grid[nr][nc] == target:
                visited[nr][nc] = True
                stack.append((nr, nc))

    return cluster


def count_scatters(grid: List[List[int]]) -> List[Tuple[int, int]]:
    """Count and locate scatter symbols (ID=7) in the grid."""
    positions = []
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == 7:
                positions.append((r, c))
    return positions
