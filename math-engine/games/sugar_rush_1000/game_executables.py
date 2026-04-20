from src.executables.executables import GameExecutables
from src.events.events import tumble_board_event

class SugarRushExecutables(GameExecutables):

    def reset_grid_multipliers(self):
        """Reset the 7x7 persistent multiplier spot grid to 0."""
        self.grid_multipliers = [[0 for _ in range(self.config.num_reels)] for _ in range(len(self.config.num_rows))]

    def seed_super_free_spins(self):
        """Super free spins pre-seeds multipliers at exactly the center of the board."""
        # Multipliers seeded based on buy_super configuration
        seed_points = [
            (3, 3, 16), (2, 3, 8), (4, 3, 8),
            (3, 2, 8), (3, 4, 8),
            (2, 2, 4), (2, 4, 4), (4, 2, 4), (4, 4, 4),
        ]
        for r, c, m in seed_points:
            self.grid_multipliers[r][c] = m

    def tumble_game_board(self) -> None:
        """
        Sugar Rush specific tumble: 
        Track where symbols explode. Then execute tumble.
        Then increment multiplier spots across those exploded coordinates.
        """
        # Track coordinates of exploding symbols
        exploded_coords = []
        for r in range(len(self.board)):
            for c in range(len(self.board[0])):
                if getattr(self.board[r][c], "explode", False):
                    exploded_coords.append((r, c))

        # Standard tumbling action (removes 'explode' = True symbols and shifts board down)
        # Assuming the base SDK `super().tumble_game_board()` correctly injects new padding symbols
        super().tumble_game_board()

        # Upgrade spot multipliers
        for r, c in exploded_coords:
            current_val = self.grid_multipliers[r][c]
            if current_val == 0:
                self.grid_multipliers[r][c] = 1  # Activation wrapper, does not multiply yet
            elif current_val == 1:
                self.grid_multipliers[r][c] = 2  # First actual 2x multiplier
            else:
                self.grid_multipliers[r][c] = min(1024, current_val * 2) # Double up to 1024x

    def apply_cluster_multipliers(self, win_data):
        """
        Takes raw cluster win_data from `get_cluster_data()`.
        Evaluates and adds active spot multipliers to the cluster payouts.
        """
        if "wins" not in win_data:
            return win_data

        total_new_win = 0
        for cluster in win_data["wins"]:
            cluster_mult = 0
            for pos in cluster.get("positions", []):
                r, c = pos["row"], pos["reel"]
                # Only >= 2 acts as a multiplier according to official rules
                if self.grid_multipliers[r][c] >= 2:
                    cluster_mult += self.grid_multipliers[r][c]
            
            # If multiple multipliers exist in a cluster, they ADD to each other.
            if cluster_mult > 0:
                cluster["meta"]["multiplier"] = cluster_mult
                cluster["meta"]["winWithoutMult"] = cluster["win"]
                cluster["win"] *= cluster_mult
            
            total_new_win += cluster["win"]

        win_data["totalWin"] = total_new_win
        return win_data

    def get_scatterpay_wins(self, record_wins=True):
        # Override if using scatter pays, but Sugar Rush uses cluster pays!
        # The base `get_cluster_data` will be invoked in gamestate.
        pass
