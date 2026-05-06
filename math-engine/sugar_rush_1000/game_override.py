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

    def _get_fs_map(self):
        """
        Returns the correct freespin_triggers map for the current bet mode.
        Bonus mode uses reduced FS counts; Super uses increased FS counts.
        """
        if self.current_betmode_name == "bonus":
            return getattr(self.config, 'freespin_triggers_bonus', self.config.freespin_triggers)
        elif self.current_betmode_name == "super":
            return getattr(self.config, 'freespin_triggers_super', self.config.freespin_triggers)
        return self.config.freespin_triggers

    def update_freespin_amount(self, scatter_key: str = "scatter") -> None:
        """
        Sets the initial number of spins for a free game.
        Uses mode-specific FS trigger maps.
        """
        scatter_count = self.count_special_symbols(scatter_key)
        fs_map = self._get_fs_map().get(self.gametype, {})
        capped_count = min(scatter_count, max(fs_map.keys()) if fs_map else 7)
        self.tot_fs = fs_map.get(capped_count, 0)
        self.fs = 0

    def update_fs_retrigger_amt(self, scatter_key: str = "scatter") -> None:
        """
        Updates the total number of free spins when a retrigger occurs.
        Uses mode-specific FS trigger maps.
        """
        from src.events.events import fs_trigger_event
        scatter_count = self.count_special_symbols(scatter_key)
        fs_map = self._get_fs_map().get(self.gametype, {})
        capped_count = min(scatter_count, max(fs_map.keys()) if fs_map else 7)
        extra = fs_map.get(capped_count, 0)
        self.tot_fs += extra
        fs_trigger_event(self, basegame_trigger=False, freegame_trigger=True)

