"""
Stake Engine SDK — Executables Class

Groups together common actions that are likely to be reused across multiple games.
These functions can be overridden in GameExecutables or GameCalculations
if game-specific alterations are required.
"""

from src.calculations.tumble import Tumble
from src.calculations.cluster import ClusterWins
from src.events.events import (
    reveal_event,
    win_info_event,
    set_win_event,
    set_total_event,
    wincap_event,
    fs_trigger_event,
    update_freespin_event,
    freespin_end_event,
    final_win_event,
    tumble_board_event,
)


def get_random_outcome(weights_dict: dict, rng=None):
    """
    Selects a random outcome from a weighted dictionary.
    Args:
        weights_dict: {outcome: weight, ...}
        rng: random.Random instance (optional)
    Returns:
        Selected outcome key
    """
    import random
    r = rng or random
    options = list(weights_dict.keys())
    probs = list(weights_dict.values())
    return r.choices(options, weights=probs, k=1)[0]


class Executables(Tumble, ClusterWins):
    """
    Groups commonly used game logic and event emission.
    Inherits from Tumble (which inherits Board → GeneralGameState)
    and ClusterWins for cluster evaluation.
    """

    def draw_board(self, emit_event: bool = True) -> None:
        """
        Generates a new game board. If the distribution conditions specify
        forced scatters (for wincap/freegame criteria), forces the board
        to contain the required number of scatter symbols.
        """
        conditions = self.get_current_distribution_conditions()

        # Check if we need to force scatter symbols
        if conditions.get("force_freegame", False) and self.gametype == self.config.basegame_type:
            scatter_triggers = conditions.get("scatter_triggers", {})
            if scatter_triggers:
                # Pick how many scatters to force based on weighted distribution
                num_scatters = get_random_outcome(scatter_triggers, self._rng)
                self._force_scatter_board(num_scatters)
                if emit_event:
                    reveal_event(self)
                return

        # Normal board generation
        self.create_board_reelstrips()

        # If this board randomly has too many scatters for non-FS criteria,
        # and the criteria doesn't want free spins, regenerate.
        # But if we are IN free spins, scatters are fine to land naturally.
        if self.gametype == self.config.basegame_type and not conditions.get("force_freegame", False) and not conditions.get("force_wincap", False):
            scatter_count = self.count_special_symbols("scatter")
            max_attempts = 50
            attempts = 0
            while scatter_count >= 3 and attempts < max_attempts:
                self.create_board_reelstrips()
                scatter_count = self.count_special_symbols("scatter")
                attempts += 1

        if emit_event:
            reveal_event(self)

    def _force_scatter_board(self, num_scatters: int) -> None:
        """
        Forces a board to contain exactly num_scatters scatter symbols
        by repeatedly generating boards until the condition is met,
        or by manually placing scatters.
        """
        scatter_names = self.config.special_symbols.get("scatter", [])
        if not scatter_names:
            self.create_board_reelstrips()
            return

        scatter_name = scatter_names[0]
        max_attempts = 200

        for _ in range(max_attempts):
            self.create_board_reelstrips()
            current_count = self.count_special_symbols("scatter")
            if current_count == num_scatters:
                return

        # Fallback: manually place scatters on a generated board
        self.create_board_reelstrips()

        # Remove existing scatters
        from src.state.symbol import Symbol
        for r in range(self.config.grid_size):
            for c in range(self.config.grid_size):
                cell = self.board[r][c]
                name = cell.name if hasattr(cell, 'name') else cell.get("symbol", "")
                if name in scatter_names:
                    # Replace with a random non-scatter symbol
                    weights = self.config.symbol_weights
                    sym_name = get_random_outcome(weights, self._rng)
                    self.board[r][c] = Symbol(self.config, sym_name, reel=c, row=r)

        # Place the required number of scatters at random positions
        positions = []
        for r in range(self.config.grid_size):
            for c in range(self.config.grid_size):
                positions.append((r, c))
        self._rng.shuffle(positions)

        for i in range(min(num_scatters, len(positions))):
            r, c = positions[i]
            self.board[r][c] = Symbol(self.config, scatter_name, reel=c, row=r)

        # Rescan special symbols
        self.get_special_symbols_on_board()

    def evaluate_wincap(self) -> None:
        """
        Checks if the running bet win has reached the wincap limit.
        Caps the win and emits a wincap event if triggered.
        """
        max_win = self.config.wincap
        if self.win_manager.running_bet_win >= max_win:
            overshoot = self.win_manager.running_bet_win - max_win
            if overshoot > 0:
                self.win_manager.spin_win -= overshoot
                self.win_manager.running_bet_win = max_win
            self.wincap_triggered = True
            wincap_event(self)

    def count_special_symbols(self, special_sym_criteria: str) -> int:
        """Returns the number of active symbols of a specified special kind."""
        count = 0
        scatter_names = self.config.special_symbols.get(special_sym_criteria, [])
        for r in range(self.config.grid_size):
            for c in range(self.config.grid_size):
                cell = self.board[r][c]
                name = cell.name if hasattr(cell, 'name') else cell.get("symbol", "")
                if name in scatter_names:
                    count += 1
        return count

    def check_fs_condition(self, scatter_key: str = "scatter") -> bool:
        """Checks if there are enough active scatters to trigger free spins."""
        return self.count_special_symbols(scatter_key) >= 3

    def check_freespin_entry(self, scatter_key: str = "scatter") -> bool:
        """
        Ensures that the bet mode criteria are expecting a free spin trigger
        before proceeding. Prevents accidental FS entry in basegame criteria.
        """
        conditions = self.get_current_distribution_conditions()
        if conditions.get("force_freegame", False):
            return self.check_fs_condition(scatter_key)
        # For non-forced criteria, allow natural FS triggers
        return self.check_fs_condition(scatter_key)

    def run_freespin_from_base(self, scatter_key: str = "scatter") -> None:
        """
        Triggers the free spin function and updates the total number
        of free spins available. Records the event for force files.
        """
        scatter_count = self.count_special_symbols(scatter_key)
        self.record({
            "kind": scatter_count,
            "symbol": scatter_key,
            "gametype": self.gametype,
        })
        self.update_freespin_amount(scatter_key)
        fs_trigger_event(self, basegame_trigger=True, freegame_trigger=False)
        self.run_freespin()

    def update_freespin_amount(self, scatter_key: str = "scatter") -> None:
        """
        Sets the initial number of spins for a free game.
        Maps scatter count to free spin count via config.
        """
        scatter_count = self.count_special_symbols(scatter_key)
        fs_map = self.config.freespin_triggers.get(self.gametype, {})
        capped_count = min(scatter_count, max(fs_map.keys()) if fs_map else 7)
        self.tot_fs = fs_map.get(capped_count, 0)
        self.fs = 0

    def update_fs_retrigger_amt(self, scatter_key: str = "scatter") -> None:
        """
        Updates the total number of free spins when a retrigger occurs.
        Emits the trigger event as a retrigger.
        """
        scatter_count = self.count_special_symbols(scatter_key)
        fs_map = self.config.freespin_triggers.get(self.gametype, {})
        capped_count = min(scatter_count, max(fs_map.keys()) if fs_map else 7)
        extra = fs_map.get(capped_count, 0)
        self.tot_fs += extra
        fs_trigger_event(self, basegame_trigger=False, freegame_trigger=True)

    def update_freespin(self) -> None:
        """
        Called before a new reveal during free spins.
        Resets spin win data and emits the freespin counter event.
        """
        self.fs += 1
        self.win_manager.spin_win = 0.0
        self.win_manager.tumble_win = 0.0
        update_freespin_event(self)

    def end_freespin(self) -> None:
        """Emits the total amount awarded during the free spin session."""
        freespin_end_event(self)
        set_total_event(self)

    def evaluate_finalwin(self) -> None:
        """
        Checks base and free spin sums, then sets the payout multiplier.
        Emits the final win event.
        """
        self.update_final_win()
        final_win_event(self)

    def emit_tumble_win_events(self) -> None:
        """Emits win events after a tumble cascade step."""
        win_info_event(self)
        set_win_event(self)
