"""
Stake Engine SDK — Cluster Wins Calculation

Clusters are found using a Breadth First Search (BFS) algorithm.
Neighbors must share the same reel or row (4-directional adjacency).
Diagonal connections do not count towards the cluster size.
"""

from collections import deque


class ClusterWins:
    """Evaluates winning clusters on the game board using BFS flood-fill."""

    def get_cluster_data(self, record_wins=False) -> dict:
        """
        Cluster pays evaluation using BFS.

        Args:
            record_wins: If True, marks winning cells with explode=True

        Returns:
            {"totalWin": float, "wins": [cluster_dict, ...]}
            Each cluster_dict contains: symbol, symbolId, count, positions, win, meta
        """
        size = self.config.grid_size
        min_size = self.config.min_cluster_size
        visited = [[False] * size for _ in range(size)]
        clusters = []
        total_win = 0.0

        scatter_names = self.config.special_symbols.get("scatter", [])

        for r in range(size):
            for c in range(size):
                if visited[r][c]:
                    continue

                cell = self.board[r][c]
                if cell is None:
                    visited[r][c] = True
                    continue

                # Get symbol name — works with both Symbol objects and dicts
                sym_name = cell.name if hasattr(cell, 'name') else cell.get("symbol", "")

                # Skip scatters — they don't form clusters
                if sym_name in scatter_names:
                    visited[r][c] = True
                    continue

                # BFS flood-fill
                cluster_positions = []
                queue = deque([(r, c)])
                visited[r][c] = True

                while queue:
                    cr, cc = queue.popleft()
                    cluster_positions.append({"row": cr, "reel": cc})

                    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < size and 0 <= nc < size and not visited[nr][nc]:
                            neighbor = self.board[nr][nc]
                            if neighbor is not None:
                                n_name = neighbor.name if hasattr(neighbor, 'name') else neighbor.get("symbol", "")
                                if n_name == sym_name:
                                    visited[nr][nc] = True
                                    queue.append((nr, nc))

                if len(cluster_positions) >= min_size:
                    # Lookup win from paytable
                    # Clamp cluster size to max defined in paytable
                    lookup_size = len(cluster_positions)
                    win_val = self.config.paytable.get((lookup_size, sym_name), 0.0)

                    # If exact size not in paytable, try clamped sizes
                    if win_val == 0.0 and lookup_size > 15:
                        # Sugar Blast 1000 defines 15+ as max tier
                        for check_size in range(lookup_size, min_size - 1, -1):
                            win_val = self.config.paytable.get((check_size, sym_name), 0.0)
                            if win_val > 0:
                                break

                    sym_id = cell.id if hasattr(cell, 'id') else self.config.symbol_ids.get(sym_name, 0)

                    clusters.append({
                        "symbol": sym_name,
                        "symbolId": sym_id,
                        "count": len(cluster_positions),
                        "positions": cluster_positions,
                        "win": win_val,
                        "meta": {},
                    })
                    total_win += win_val

                    if record_wins:
                        for pos in cluster_positions:
                            cell_ref = self.board[pos["row"]][pos["reel"]]
                            if hasattr(cell_ref, 'explode'):
                                cell_ref.explode = True
                            elif isinstance(cell_ref, dict):
                                cell_ref["explode"] = True

        return {"totalWin": total_win, "wins": clusters}
