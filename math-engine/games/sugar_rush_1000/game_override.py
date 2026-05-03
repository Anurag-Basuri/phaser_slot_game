"""
Sugar Rush 1000 — GameState Override

First in the Method Resolution Order (MRO).
Overrides reset_book() to include game-specific state (multiplier grid).
"""

from src.state.state import GeneralGameState


class GameStateOverride(GeneralGameState):
    """
    Overrides core state functions for Sugar Rush 1000.
    Sugar Rush has no wild symbols, so no special_symbol_functions are needed.
    """

    def assign_special_sym_function(self):
        """Sugar Rush 1000 has no wild or special-function symbols."""
        self.special_symbol_functions = {}

    def reset_book(self):
        """
        Resets all game state for a new simulation.
        Adds Sugar Rush-specific: 7×7 multiplier grid.
        """
        super().reset_book()
        size = self.config.grid_size
        self.grid_multipliers = [[0] * size for _ in range(size)]
