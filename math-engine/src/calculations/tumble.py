from src.state.state import Board

class Tumble(Board):
    def tumble_game_board(self):
        """
        Removes exploded symbols and replaces them using reelstrip logic,
        shifting symbols down (gravity).
        """
        size = self.config.grid_size
        reelstrip = self.config.reels[self.reelstrip_id]
        
        for c in range(self.config.num_reels):
            column = []
            explode_count = 0
            
            # Read from bottom to top
            for r in range(size - 1, -1, -1):
                cell = self.board[r][c]
                if cell and cell.get("explode", False):
                    explode_count += 1
                elif cell is not None:
                    column.insert(0, cell)
                    
            # Fill new symbols at the top from the reel strip
            # We move BACKWARDS on the reelstrip to simulate symbols falling down
            for _ in range(explode_count):
                self.reel_positions[c] = (self.reel_positions[c] - 1) % len(reelstrip[c])
                sym_name = reelstrip[c][self.reel_positions[c]]
                sym = {"symbol": sym_name, "id": self.config.symbol_ids.get(sym_name, 0), "explode": False, "reel": c, "row": -1}
                column.insert(0, sym)
                
            # Reassign rows
            for r in range(size):
                column[r]["row"] = r
                self.board[r][c] = column[r]
