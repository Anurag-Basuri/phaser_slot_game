"""
Stake Engine SDK — Tumble/Cascade Mechanics

Removes winning (exploded) symbols from the board and replaces them
using reelstrip logic. Symbols above winning positions tumble down
via gravity to fill the vacant spaces.
"""

from src.state.state import Board
from src.state.symbol import Symbol


class Tumble(Board):
    """Handles tumbling/cascading of winning symbols on the game board."""

    def tumble_game_board(self) -> None:
        """
        Removes exploded symbols and replaces them using reelstrip logic,
        shifting symbols down (gravity).

        For each column:
        1. Collect non-exploded cells, count exploded
        2. Shift surviving cells to bottom (gravity)
        3. Fill top positions from reel strip (moves backwards)
        4. Reassign row indices
        """
        size = self.config.grid_size
        reelstrip = self.config.reels[self.reelstrip_id]

        for c in range(self.config.num_reels):
            column = []
            explode_count = 0

            # Read column bottom-to-top, keep non-exploded
            for r in range(size - 1, -1, -1):
                cell = self.board[r][c]
                if cell is None:
                    explode_count += 1
                    continue

                is_exploded = False
                if hasattr(cell, 'explode'):
                    is_exploded = cell.explode
                elif isinstance(cell, dict):
                    is_exploded = cell.get("explode", False)

                if is_exploded:
                    explode_count += 1
                else:
                    column.insert(0, cell)

            # Fill new symbols at the top from the reel strip
            # Move BACKWARDS on the reelstrip to simulate symbols falling down
            reel_data = reelstrip[c]
            reel_len = len(reel_data)

            for _ in range(explode_count):
                self.reel_positions[c] = (self.reel_positions[c] - 1) % reel_len
                sym_name = reel_data[self.reel_positions[c]]

                # Prevent special symbols (like scatters) from dropping during tumbles
                scatter_names = self.config.special_symbols.get("scatter", [])
                max_skip = reel_len
                skipped = 0
                while sym_name in scatter_names and skipped < max_skip:
                    self.reel_positions[c] = (self.reel_positions[c] - 1) % reel_len
                    sym_name = reel_data[self.reel_positions[c]]
                    skipped += 1

                # Create new Symbol object
                sym = Symbol(self.config, sym_name, reel=c, row=-1)

                # Run special functions if defined
                if sym_name in self.special_symbol_functions:
                    sym.special_functions = self.special_symbol_functions[sym_name]
                    sym.run_special_functions(self)

                column.insert(0, sym)

            # Reassign row indices
            for r in range(size):
                column[r].row = r
                column[r].reel = c
                if hasattr(column[r], 'explode'):
                    column[r].explode = False
                self.board[r][c] = column[r]

        # Rescan special symbols after tumble
        self.get_special_symbols_on_board()
