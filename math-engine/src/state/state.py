"""
Stake Engine SDK — Base Game State (Local Development Stub)

In production, this is provided by the Carrot SDK.
For local development, we implement the essential board drawing and state management.
"""

import random


class WinManager:
    """Tracks wins across different game types (base game, free game)."""

    def __init__(self):
        self.spin_win = 0.0
        self.gametype_wins = {}
        self.total_win = 0.0

    def update_spinwin(self, amount: float):
        self.spin_win += amount
        self.total_win += amount

    def update_gametype_wins(self, gametype: str):
        if gametype not in self.gametype_wins:
            self.gametype_wins[gametype] = 0.0
        self.gametype_wins[gametype] += self.spin_win
        self.spin_win = 0.0

    def reset(self):
        self.spin_win = 0.0
        self.gametype_wins = {}
        self.total_win = 0.0


class GeneralGameState:
    """
    Base game state that all game-specific states inherit from.
    Manages board, free spins, RNG seeding, and bet modes.
    """

    def __init__(self, config):
        self.config = config
        self.win_manager = WinManager()
        self.fs = 0
        self.tot_fs = 0
        self.board = []
        self.gametype = config.basegame_type
        self.repeat = False
        self.wincap_triggered = False
        self._current_betmode_index = 0
        self._rng = random.Random()

    def reset_seed(self, sim):
        """Reset the RNG with a deterministic seed for reproducibility."""
        seed = getattr(sim, "seed", None)
        if seed is not None:
            self._rng = random.Random(seed)
        else:
            self._rng = random.Random()

    def reset_book(self):
        """Reset per-round state."""
        self.win_manager.reset()
        self.wincap_triggered = False

    def reset_fs_spin(self):
        """Reset free spin counter."""
        self.fs = 0

    def get_current_betmode(self):
        """Get the active bet mode."""
        if self._current_betmode_index < len(self.config.bet_modes):
            return self.config.bet_modes[self._current_betmode_index]
        return self.config.bet_modes[0]

    def set_betmode(self, name: str):
        """Set the active bet mode by name."""
        for i, mode in enumerate(self.config.bet_modes):
            if mode.name == name:
                self._current_betmode_index = i
                return
        raise ValueError(f"Unknown bet mode: {name}")

    def draw_board(self, emit_event=True):
        """
        Generate a fresh 7×7 board by picking random symbols.
        
        Each cell gets a weighted random candy symbol.
        Scatters are injected based on scatter_chance probability.
        """
        size = self.config.grid_size
        scatter_syms = self.config.special_symbols.get("scatter", ["S"])
        scatter_chance = self.config.scatter_chance

        # Check if Ante Bet is active (doubles scatter chance)
        betmode = self.get_current_betmode()
        if hasattr(betmode, "ante_scatter_multiplier") and betmode.ante_scatter_multiplier > 1.0:
            scatter_chance = self.config.scatter_chance_ante

        # Build weighted symbol pool (excluding scatters)
        weights = self.config.symbol_weights
        symbols = list(weights.keys())
        weight_values = list(weights.values())

        self.board = []
        for r in range(size):
            row = []
            for c in range(size):
                # Roll for scatter
                if self._rng.random() < scatter_chance:
                    sym = scatter_syms[0]
                else:
                    sym = self._rng.choices(symbols, weights=weight_values, k=1)[0]

                row.append({
                    "symbol": sym,
                    "id": self.config.symbol_ids.get(sym, 0),
                })
            self.board.append(row)

    def check_fs_condition(self, key: str) -> bool:
        """Override in game-specific state."""
        return False

    def evaluate_finalwin(self):
        """Finalize the round win calculation."""
        pass

    def check_repeat(self):
        """Check if the round should repeat (used by Distribution system)."""
        self.repeat = False

    def imprint_wins(self):
        """Record final wins for the SDK's book/audit system."""
        pass

    def update_freespin_amount(self, key: str):
        """Set the initial free spin count based on scatter count."""
        pass

    def update_fs_retrigger_amt(self, key: str):
        """Add re-triggered free spins."""
        pass

    def update_freespin(self):
        """Advance the free spin counter."""
        self.fs += 1
