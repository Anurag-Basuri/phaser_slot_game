"""
Sugar Rush 1000 — Game Executables

Sugar Rush-specific logic that extends the base Executables.
Handles the multiplier grid, cascade loop, and super free spins.

Key mechanic: In Sugar Rush 1000, when winning symbols explode during a
cascade, random multiplier spots (x2, x4, x8, ...) appear on the vacated
positions. These multipliers apply to ALL future wins landing on those
spots and double each time they're triggered again. During free spins,
multipliers persist across all spins, enabling massive win potential.
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

    def seed_random_multipliers(self) -> None:
        """
        Sugar Rush 1000 mechanic: At the start of each base game spin,
        there is a chance that random multiplier candy spots are placed
        on the grid. This creates the medium-to-large win potential that
        drives the game's volatility profile.

        - 40% chance of multiplier seeding per spin
        - When active, 2-5 random spots get x2 multipliers
        - During free spins, this is called once per spin to add NEW spots
          (existing multipliers are preserved)
        """
        chance = getattr(self.config, 'multiplier_seed_chance', 0.40)
        if self._rng.random() < chance:
            size = self.config.grid_size
            num_spots = self._rng.randint(1, 3)

            # Collect positions that don't already have multipliers
            available = []
            for r in range(size):
                for c in range(size):
                    if self.grid_multipliers[r][c] == 0:
                        available.append((r, c))

            if available:
                num_spots = min(num_spots, len(available))
                chosen = self._rng.sample(available, num_spots)

                # Weighted multiplier values — heavily skewed toward x2
                mult_weights = {2: 80, 4: 15, 8: 4, 16: 1}
                mult_options = list(mult_weights.keys())
                mult_probs = list(mult_weights.values())

                for r, c in chosen:
                    mult_val = self._rng.choices(mult_options, weights=mult_probs, k=1)[0]
                    self.grid_multipliers[r][c] = mult_val

    def advance_multiplier(self, r: int, c: int) -> None:
        """
        Advances the multiplier at position (r, c).
        Progression: 0 → 2 → 4 → 8 → ... → cap

        In Sugar Rush 1000, the first cascade hit on a spot immediately
        activates a ×2 multiplier. Each subsequent hit doubles it.
        Uses per-mode multiplier cap (bonus=32x, others=128x).
        """
        # Select per-mode cap
        if self.current_betmode_name == "bonus":
            cap = getattr(self.config, 'bonus_max_multiplier', self.config.max_multiplier)
        else:
            cap = self.config.max_multiplier

        current = self.grid_multipliers[r][c]
        if current == 0:
            self.grid_multipliers[r][c] = 2  # Immediate x2 activation
        else:
            self.grid_multipliers[r][c] = min(cap, current * 2)

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
        1. Seed random multiplier spots (Sugar Rush candy mechanic)
        2. Detect clusters (BFS)
        3. Apply multipliers to each cluster's win
        4. If no wins → break
        5. Add win to WinManager
        6. Emit events (winInfo, setWin, multiplierUpdate)
        7. Check wincap (25,000×)
        8. Advance multipliers on exploded positions
        9. Tumble board (gravity + reel refill)
        10. Emit tumble event
        11. Go to step 2
        """
        # Seed random multiplier spots before the cascade begins
        # Only in base game — free spins accumulate multipliers organically
        if self.gametype == self.config.basegame_type:
            self.seed_random_multipliers()

        cascade_depth = 0
        max_cascade_depth = 50  # Safety limit to prevent runaway cascades

        while True:
            # Safety: break if cascade depth exceeded
            if cascade_depth >= max_cascade_depth:
                break

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
