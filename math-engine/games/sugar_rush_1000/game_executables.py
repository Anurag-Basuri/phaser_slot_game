"""
Sugar Rush 1000 — Game Executables
Custom game logic that extends the base SDK executables.

Implements:
  - Grid multiplier management (mark → ×2 → ×4 → ... → ×1024)
  - Cluster multiplier application (additive within clusters)
  - Tumble board with multiplier spot tracking
  - Super Free Spins seeding (×2 on ALL 49 spots)
  - Win cap enforcement (25,000× bet)
  - Cluster detection (4-directional flood fill, min 5 connected)
"""

from collections import deque
from src.executables.executables import GameExecutables


class SugarRushExecutables(GameExecutables):

    # ──────────────────────────────────────────────────────
    # GRID MULTIPLIER MANAGEMENT
    # ──────────────────────────────────────────────────────

    def reset_grid_multipliers(self):
        """Reset the 7×7 persistent multiplier grid to 0."""
        size = self.config.grid_size
        self.grid_multipliers = [[0] * size for _ in range(size)]

    def seed_super_free_spins(self):
        """
        Super Free Spins: pre-seed ×2 multipliers on ALL grid spots.
        Official rule: "×2 starting multipliers are already added to all spots."
        """
        size = self.config.grid_size
        for r in range(size):
            for c in range(size):
                self.grid_multipliers[r][c] = 2

    def advance_multiplier(self, r: int, c: int):
        """
        Advance a single multiplier spot after a symbol explodes on it.
        
        Progression:
          0 → 1 (spot marked, no multiplier effect yet)
          1 → 2 (first active ×2 multiplier)
          2 → 4 → 8 → 16 → 32 → 64 → 128 → 256 → 512 → 1024 (cap)
        """
        current = self.grid_multipliers[r][c]
        if current == 0:
            self.grid_multipliers[r][c] = 1
        elif current == 1:
            self.grid_multipliers[r][c] = 2
        else:
            self.grid_multipliers[r][c] = min(self.config.max_multiplier, current * 2)

    # ──────────────────────────────────────────────────────
    # TUMBLE BOARD
    # ──────────────────────────────────────────────────────

    def tumble_game_board(self) -> None:
        """
        Sugar Rush tumble sequence:
        1. Identify exploding symbols (part of winning clusters)
        2. Advance multiplier spots at those coordinates
        3. Remove exploded symbols
        4. Apply gravity (shift remaining symbols down)
        5. Fill empty positions from the top with new random symbols
        """
        size = self.config.grid_size

        # 1. Track coordinates of exploding symbols
        exploded_coords = set()
        for r in range(size):
            for c in range(size):
                cell = self.board[r][c]
                if isinstance(cell, dict) and cell.get("explode", False):
                    exploded_coords.add((r, c))

        # 2. Advance multiplier spots for all exploded positions
        for r, c in exploded_coords:
            self.advance_multiplier(r, c)

        # 3. Remove exploded symbols (set to None)
        for r, c in exploded_coords:
            self.board[r][c] = None

        # 4. Gravity: shift remaining symbols down within each column
        for c in range(size):
            # Collect non-None symbols from bottom to top
            column = []
            for r in range(size - 1, -1, -1):
                if self.board[r][c] is not None:
                    column.append(self.board[r][c])

            # Place them back from bottom up
            for r in range(size - 1, -1, -1):
                if column:
                    self.board[r][c] = column.pop(0)
                else:
                    self.board[r][c] = None

        # 5. Fill empty positions with new random symbols
        for r in range(size):
            for c in range(size):
                if self.board[r][c] is None:
                    sym = self._pick_random_symbol()
                    self.board[r][c] = {"symbol": sym, "id": self.config.symbol_ids.get(sym, 0)}

    def _pick_random_symbol(self) -> str:
        """
        Pick a random candy symbol using weighted probabilities.
        Scatters are NOT spawned during tumble fills — only on initial board draw.
        """
        import random
        weights = self.config.symbol_weights
        symbols = list(weights.keys())
        weight_values = list(weights.values())
        return random.choices(symbols, weights=weight_values, k=1)[0]

    # ──────────────────────────────────────────────────────
    # CLUSTER DETECTION (4-directional flood fill)
    # ──────────────────────────────────────────────────────

    def get_cluster_data(self, record_wins=False) -> dict:
        """
        Find all clusters of 5+ connected same-symbol cells.
        Uses iterative BFS with 4-directional adjacency (no diagonals).
        
        Returns:
            {
                "totalWin": float,
                "wins": [
                    {
                        "symbol": str,
                        "symbolId": int,
                        "count": int,
                        "positions": [{"row": r, "reel": c}, ...],
                        "win": float,
                        "meta": {}
                    },
                    ...
                ]
            }
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

                sym = cell.get("symbol", "") if isinstance(cell, dict) else str(cell)

                # Scatters don't form clusters
                if sym == "S" or sym in self.config.special_symbols.get("scatter", []):
                    visited[r][c] = True
                    continue

                # BFS flood fill
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
                            if neighbor is None:
                                continue
                            nsym = neighbor.get("symbol", "") if isinstance(neighbor, dict) else str(neighbor)
                            if nsym == sym:
                                visited[nr][nc] = True
                                queue.append((nr, nc))

                # Only clusters of min_size+ count as wins
                if len(cluster_positions) >= min_size:
                    pay = self._lookup_cluster_pay(sym, len(cluster_positions))
                    cluster_data = {
                        "symbol": sym,
                        "symbolId": self.config.symbol_ids.get(sym, 0),
                        "count": len(cluster_positions),
                        "positions": cluster_positions,
                        "win": pay,
                        "meta": {},
                    }
                    clusters.append(cluster_data)
                    total_win += pay

                    # Mark cluster positions for explosion
                    if record_wins:
                        for pos in cluster_positions:
                            cell = self.board[pos["row"]][pos["reel"]]
                            if isinstance(cell, dict):
                                cell["explode"] = True

        return {"totalWin": total_win, "wins": clusters}

    def _lookup_cluster_pay(self, symbol: str, cluster_size: int) -> float:
        """Look up the pay value for a symbol at a given cluster size."""
        for ((lo, hi), sym), pay in self.config.pay_group.items():
            if sym == symbol and lo <= cluster_size <= hi:
                return pay
        return 0.0

    # ──────────────────────────────────────────────────────
    # CLUSTER MULTIPLIER APPLICATION
    # ──────────────────────────────────────────────────────

    def apply_cluster_multipliers(self, win_data: dict) -> dict:
        """
        Applies grid spot multipliers to cluster payouts.
        
        Rules:
          - Only multipliers ≥2 are active (value=1 means "marked but not active yet")
          - Multiple multipliers within the same cluster are ADDED together
          - The total multiplier is then applied to the base cluster win
        """
        if "wins" not in win_data:
            return win_data

        total_new_win = 0.0
        for cluster in win_data["wins"]:
            cluster_mult = 0
            for pos in cluster.get("positions", []):
                r, c = pos["row"], pos["reel"]
                mult_val = self.grid_multipliers[r][c]
                if mult_val >= 2:
                    cluster_mult += mult_val

            if cluster_mult > 0:
                cluster["meta"]["multiplier"] = cluster_mult
                cluster["meta"]["winWithoutMult"] = cluster["win"]
                cluster["win"] *= cluster_mult

            total_new_win += cluster["win"]

        win_data["totalWin"] = total_new_win
        return win_data

    # ──────────────────────────────────────────────────────
    # WIN CAP ENFORCEMENT
    # ──────────────────────────────────────────────────────

    def check_wincap(self, bet_amount: float) -> bool:
        """
        Check if cumulative round win has reached the 25,000× cap.
        If so, cap the win and set the wincap_triggered flag.
        
        Returns True if cap was triggered.
        """
        max_win = self.config.wincap * bet_amount
        cumulative = getattr(self, "cumulative_round_win", 0.0)

        if cumulative >= max_win:
            # Cap at exactly max_win
            overshoot = cumulative - max_win
            if overshoot > 0 and hasattr(self.win_manager, "cumulative_win"):
                self.win_manager.cumulative_win -= overshoot
            self.cumulative_round_win = max_win
            self.wincap_triggered = True
            return True
        return False

    def reset_wincap_state(self):
        """Reset win cap tracking at the start of each round."""
        self.cumulative_round_win = 0.0
        self.wincap_triggered = False

    def accumulate_win(self, amount: float):
        """Add to the cumulative round win tracker."""
        self.cumulative_round_win = getattr(self, "cumulative_round_win", 0.0) + amount

    # ──────────────────────────────────────────────────────
    # SCATTER COUNTING
    # ──────────────────────────────────────────────────────

    def count_scatters(self) -> int:
        """Count the number of scatter symbols on the current board."""
        count = 0
        scatter_syms = self.config.special_symbols.get("scatter", ["S"])
        for r in range(self.config.grid_size):
            for c in range(self.config.grid_size):
                cell = self.board[r][c]
                if cell is None:
                    continue
                sym = cell.get("symbol", "") if isinstance(cell, dict) else str(cell)
                if sym in scatter_syms:
                    count += 1
        return count
