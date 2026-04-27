from collections import deque

class ClusterWins:
    def get_cluster_data(self, record_wins=False):
        """
        Cluster pays evaluation using BFS.
        Matches Stake's engine cluster win evaluation structure.
        """
        size = self.config.grid_size
        min_size = self.config.min_cluster_size
        visited = [[False] * size for _ in range(size)]
        clusters = []
        total_win = 0.0

        for r in range(size):
            for c in range(size):
                if visited[r][c]:
                    continue
                
                cell = self.board[r][c]
                if cell is None:
                    continue

                sym = cell.get("symbol", "")
                if sym == "S" or sym in self.config.special_symbols.get("scatter", []):
                    visited[r][c] = True
                    continue

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
                            if neighbor is not None and neighbor.get("symbol", "") == sym:
                                visited[nr][nc] = True
                                queue.append((nr, nc))

                if len(cluster_positions) >= min_size:
                    # Lookup win
                    win_val = self.config.paytable.get((len(cluster_positions), sym), 0.0)
                            
                    clusters.append({
                        "symbol": sym,
                        "symbolId": self.config.symbol_ids.get(sym, 0),
                        "count": len(cluster_positions),
                        "positions": cluster_positions,
                        "win": win_val,
                        "meta": {}
                    })
                    total_win += win_val

                    if record_wins:
                        for pos in cluster_positions:
                            self.board[pos["row"]][pos["reel"]]["explode"] = True

        return {"totalWin": total_win, "wins": clusters}
