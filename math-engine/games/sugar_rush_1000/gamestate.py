"""
Sugar Rush 1000 — Game State
Orchestrates the full spin lifecycle: base game, tumble cascades, free spins.

Flow:
  run_spin()
    → reset state
    → draw_board (initial grid)
    → evaluate_tumble_spin (cascade loop)
    → check scatter → trigger free spins if 3+
    → enforce win cap
    → finalize

  evaluate_tumble_spin()
    → find clusters → apply multipliers → record win
    → tumble → repeat until no more clusters

  run_freespin()
    → loop FS spins (multipliers PERSIST across all spins)
    → check re-triggers
    → enforce win cap each spin
"""

from src.state.state import GeneralGameState
from games.sugar_rush_1000.game_executables import SugarRushExecutables
from src.events.events import (
    reveal_event,
    win_info_event,
    set_win_event,
    set_total_event,
    final_win_event,
    update_freespin_event,
    fs_trigger_event,
    freespin_end_event,
    tumble_board_event,
)


class GameState(GeneralGameState, SugarRushExecutables):
    def __init__(self, config):
        super().__init__(config)
        self.round_events = []  # Collects all events for frontend playback
        self.bet_amount = 1.0   # Set by the RGS before each spin

    def assign_special_sym_function(self):
        """
        No special symbol spawn functions needed.
        Multipliers are strictly spot-based, handled in tumble_game_board().
        """
        self.special_symbol_functions = {}

    # ──────────────────────────────────────────────────────
    # MAIN SPIN ENTRY POINT
    # ──────────────────────────────────────────────────────

    def run_spin(self, sim):
        """
        Execute a complete spin round.
        
        Args:
            sim: Simulation context (provides RNG seed, bet mode, etc.)
        """
        self.reset_seed(sim)
        self.repeat = True

        while self.repeat:
            self.reset_book()
            self.round_events = []
            self.gametype = self.config.basegame_type

            # Reset multipliers and win cap for base game
            self.reset_grid_multipliers()
            self.reset_wincap_state()

            # Super Free Spins: seed ×2 on all spots
            betmode = self.get_current_betmode()
            if betmode.name == "super":
                self.seed_super_free_spins()

            # Generate the initial board
            self.draw_board(emit_event=False)

            # Emit initial grid state to frontend
            self._emit_event("spin", {
                "grid": self._board_to_id_grid(),
                "multipliers": [row[:] for row in self.grid_multipliers],
            })

            # Run cascade sequence
            self.evaluate_tumble_spin()
            self.win_manager.update_gametype_wins(self.gametype)

            # Check scatter threshold (3+ scatters = free spins)
            if not self.wincap_triggered and self.check_fs_condition("scatter"):
                self.run_freespin_from_base("scatter")

            self.evaluate_finalwin()
            self.check_repeat()

        self.imprint_wins()

        # Emit round end
        self._emit_event("round_end", {
            "totalWin": getattr(self, "cumulative_round_win", 0.0),
        })

    # ──────────────────────────────────────────────────────
    # TUMBLE CASCADE LOOP
    # ──────────────────────────────────────────────────────

    def evaluate_tumble_spin(self):
        """
        Run the full cascade sequence:
        1. Find clusters → apply multipliers → record win
        2. Emit win events
        3. Tumble the board
        4. Repeat until no more clusters or win cap hit
        """
        cascade_depth = 0

        while True:
            # Detect clusters
            self.win_data = self.get_cluster_data(record_wins=True)

            # Apply spot multipliers to cluster payouts
            self.win_data = self.apply_cluster_multipliers(self.win_data)

            if self.win_data["totalWin"] <= 0:
                break  # No more wins — cascade complete

            # Track cumulative win + check cap
            self.accumulate_win(self.win_data["totalWin"] * self.bet_amount)
            self.win_manager.update_spinwin(self.win_data["totalWin"])

            # Emit cluster win events
            for cluster in self.win_data.get("wins", []):
                self._emit_event("cluster_win", {
                    "symbolId": cluster["symbolId"],
                    "positions": cluster["positions"],
                    "payout": cluster["win"],
                    "clusterSize": cluster["count"],
                    "multiplier": cluster["meta"].get("multiplier", 0),
                    "cascadeDepth": cascade_depth,
                })

            win_info_event(self)
            set_win_event(self)

            # Check win cap before tumbling
            if self.check_wincap(self.bet_amount):
                self._emit_event("max_win", {
                    "totalWin": self.cumulative_round_win,
                    "cap": self.config.wincap,
                })
                break

            # Tumble the board
            self.tumble_game_board()
            cascade_depth += 1

            # Emit tumble state
            self._emit_event("cascade", {
                "grid": self._board_to_id_grid(),
                "multipliers": [row[:] for row in self.grid_multipliers],
                "depth": cascade_depth,
            })

            tumble_board_event(self)

    # ──────────────────────────────────────────────────────
    # FREE SPINS
    # ──────────────────────────────────────────────────────

    def run_freespin_from_base(self, scatter_key: str = "scatter"):
        """Transition from base game to free spins."""
        scatter_count = self.count_scatters()
        fs_map = self.config.freespin_triggers.get(self.gametype, {})
        capped_count = min(scatter_count, 7)
        fs_awarded = fs_map.get(capped_count, 0)

        if fs_awarded <= 0:
            return

        self.tot_fs = fs_awarded

        self._emit_event("scatter_trigger", {
            "scatterCount": scatter_count,
            "freeSpinsAwarded": fs_awarded,
        })

        fs_trigger_event(self, scatter_count=scatter_count, spins=fs_awarded)
        self.run_freespin()

    def run_freespin(self):
        """
        Execute the free spins bonus round.
        
        Key rule: Grid multipliers PERSIST across all free spins.
        They are NOT reset between spins.
        """
        self.fs = 0
        self.gametype = self.config.freegame_type

        while self.fs < self.tot_fs and not self.wincap_triggered:
            self.fs += 1

            self._emit_event("free_spin", {
                "spinNumber": self.fs,
                "totalSpins": self.tot_fs,
            })

            update_freespin_event(self)

            # Draw new board WITHOUT resetting multipliers
            self.draw_board(emit_event=False)

            self._emit_event("spin", {
                "grid": self._board_to_id_grid(),
                "multipliers": [row[:] for row in self.grid_multipliers],
                "freeSpinNumber": self.fs,
            })

            # Run cascade sequence
            self.evaluate_tumble_spin()

            # Check for re-triggers (3+ scatters during free spins)
            if not self.wincap_triggered:
                retrigger_scatters = self.count_scatters()
                if retrigger_scatters >= 3:
                    capped = min(retrigger_scatters, 7)
                    fs_map = self.config.freespin_triggers.get(self.gametype, {})
                    extra_fs = fs_map.get(capped, 0)
                    if extra_fs > 0:
                        self.tot_fs += extra_fs
                        self._emit_event("scatter_trigger", {
                            "scatterCount": retrigger_scatters,
                            "freeSpinsAwarded": extra_fs,
                            "isRetrigger": True,
                            "totalRemaining": self.tot_fs - self.fs,
                        })

            self.win_manager.update_gametype_wins(self.gametype)

        # Free spins complete
        self._emit_event("free_spins_end", {
            "totalFreeSpinsWin": getattr(self, "cumulative_round_win", 0.0),
            "totalSpinsPlayed": self.fs,
        })
        freespin_end_event(self)

    # ──────────────────────────────────────────────────────
    # SCATTER DETECTION (overrides base stub)
    # ──────────────────────────────────────────────────────

    def check_fs_condition(self, key: str) -> bool:
        """Check if scatter threshold is met for free spin trigger."""
        if key == "scatter":
            return self.count_scatters() >= 3
        return False

    # ──────────────────────────────────────────────────────
    # EVENT HELPERS
    # ──────────────────────────────────────────────────────

    def _emit_event(self, event_type: str, data: dict):
        """
        Append a game event to the round's event log.
        These events are sent to the frontend for animation playback.
        """
        self.round_events.append({
            "type": event_type,
            "data": data,
        })

    def _board_to_id_grid(self) -> list:
        """
        Convert the board to a 7×7 grid of integer symbol IDs
        that the frontend understands.
        """
        size = self.config.grid_size
        grid = []
        for r in range(size):
            row = []
            for c in range(size):
                cell = self.board[r][c]
                if cell is None:
                    row.append(-1)
                elif isinstance(cell, dict):
                    row.append(cell.get("id", self.config.symbol_ids.get(cell.get("symbol", ""), 0)))
                else:
                    row.append(self.config.symbol_ids.get(str(cell), 0))
            grid.append(row)
        return grid

    def get_round_events(self) -> list:
        """Return the complete event log for this round (sent to frontend)."""
        return self.round_events
