from src.executables.executables import Executables

class GameExecutables(Executables):
    def seed_super_free_spins(self):
        size = self.config.grid_size
        for r in range(size):
            for c in range(size):
                self.grid_multipliers[r][c] = 2

    def advance_multiplier(self, r: int, c: int):
        current = self.grid_multipliers[r][c]
        if current == 0:
            self.grid_multipliers[r][c] = 1
        elif current == 1:
            self.grid_multipliers[r][c] = 2
        else:
            self.grid_multipliers[r][c] = min(self.config.max_multiplier, current * 2)

    def apply_cluster_multipliers(self, win_data: dict) -> dict:
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

    def evaluate_tumble_spin(self):
        cascade_depth = 0
        while True:
            self.win_data = self.get_cluster_data(record_wins=True)
            self.win_data = self.apply_cluster_multipliers(self.win_data)

            if self.win_data["totalWin"] <= 0:
                break

            self.win_manager.update_spinwin(self.win_data["totalWin"])
            
            # Record events here...
            self.book.append({
                "index": len(self.book),
                "type": "cluster_win",
                "wins": self.win_data["wins"]
            })

            self.evaluate_wincap()
            if self.get_wincap_triggered():
                break

            # Advance multipliers for exploded spots
            for cluster in self.win_data["wins"]:
                for pos in cluster["positions"]:
                    self.advance_multiplier(pos["row"], pos["reel"])

            self.tumble_game_board()
            cascade_depth += 1
            
            self.book.append({
                "index": len(self.book),
                "type": "cascade",
                "grid": self._board_to_id_grid()
            })
            
    def _board_to_id_grid(self) -> list:
        size = self.config.grid_size
        grid = []
        for r in range(size):
            row = []
            for c in range(size):
                cell = self.board[r][c]
                if cell is None:
                    row.append(-1)
                else:
                    row.append(cell.get("id", 0))
            grid.append(row)
        return grid
