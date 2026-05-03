"""
Sugar Rush 1000 — Game Executables

Sugar Rush-specific logic that extends the base Executables.
Handles the multiplier grid, cascade loop, and super free spins.
"""

from src.executables.executables import Executables
from src.events.events import (
    win_info_event,
    set_win_event,
    set_total_event,
    tumble_board_event,
    multiplier_update_event,
)


class GameExecutables(Executables):
    """Game-specific executables for Sugar Rush 1000."""

    def seed_super_free_spins(self) -> None:
        """
        Sets all 49 cells to ×2 multiplier for Super Free Spins mode.
        Called when bet mode is "super".
        """
        size = self.config.grid_size
        for r in range(size):
            for c in range(size):
                self.grid_multipliers[r][c] = 2

    def advance_multiplier(self, r: int, c: int) -> None:
        """
        Advances the multiplier at position (r, c).
        Progression: 0 → 1 (marked) → 2 → 4 → 8 → 16 → ... → 1024

        When a winning symbol explodes, it marks its spot.
        If a subsequent win explodes on that same marked spot,
        a ×2 multiplier is added. Each subsequent win doubles it.
        """
        current = self.grid_multipliers[r][c]
        if current == 0:
            self.grid_multipliers[r][c] = 1  # Mark the spot
        elif current == 1:
            self.grid_multipliers[r][c] = 2  # Activate multiplier
        else:
            self.grid_multipliers[r][c] = min(self.config.max_multiplier, current * 2)

    def apply_cluster_multipliers(self, win_data: dict) -> dict:
        """
        Applies multiplier spots to cluster wins.
        If multiple multiplier spots are in the same cluster,
        their values are ADDED together before multiplying the win.
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

    def evaluate_tumble_spin(self) -> None:
        """
        Full cascade loop for Sugar Rush 1000:
        1. Detect clusters (BFS)
        2. Apply multipliers to each cluster's win
        3. If no wins → break
        4. Add win to WinManager
        5. Emit events (winInfo, setWin, multiplierUpdate)
        6. Check wincap (25,000×)
        7. Advance multipliers on exploded positions
        8. Tumble board (gravity + reel refill)
        9. Emit tumble event
        10. Go to step 1
        """
        cascade_depth = 0

        while True:
            # 1. Detect clusters
            self.win_data = self.get_cluster_data(record_wins=True)

            # 2. Apply multipliers
            self.win_data = self.apply_cluster_multipliers(self.win_data)

            # 3. Check for wins
            if self.win_data["totalWin"] <= 0:
                break

            # 4. Update wallet
            self.win_manager.update_spinwin(self.win_data["totalWin"])

            # 5. Emit win events
            win_info_event(self)
            set_win_event(self)

            # 6. Check wincap
            self.evaluate_wincap()
            if self.get_wincap_triggered():
                break

            # 7. Advance multipliers for exploded spots
            for cluster in self.win_data["wins"]:
                for pos in cluster["positions"]:
                    self.advance_multiplier(pos["row"], pos["reel"])

            # Emit multiplier grid update
            multiplier_update_event(self)

            # 8. Tumble board
            self.tumble_game_board()
            cascade_depth += 1

            # 9. Emit tumble event with new board state
            tumble_board_event(self)

    def _board_to_id_grid(self) -> list:
        """
        Converts the current board to a 2D grid of symbol IDs.
        Used for compact event representation.
        """
        size = self.config.grid_size
        grid = []
        for r in range(size):
            row = []
            for c in range(size):
                cell = self.board[r][c]
                if cell is None:
                    row.append(-1)
                elif hasattr(cell, 'id'):
                    row.append(cell.id)
                elif isinstance(cell, dict):
                    row.append(cell.get("id", 0))
                else:
                    row.append(-1)
            grid.append(row)
        return grid
