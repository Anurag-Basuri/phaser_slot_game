"""
Sugar Rush 1000 — GameState

Combines GameStateOverride + GameExecutables via multiple inheritance.
Implements the run_spin() and run_freespin() entry points.
"""

from sugar_rush_1000.game_override import GameStateOverride
from sugar_rush_1000.game_executables import GameExecutables
from src.events.events import set_total_event


class GameState(GameStateOverride, GameExecutables):
    """
    Main game state for Sugar Rush 1000.
    MRO: GameStateOverride → GameExecutables → Executables → Tumble → Board → GeneralGameState
    """

    def run_spin(self, sim):
        """
        Entry point for a single simulation.
        
        Flow:
        1. Seed RNG from simulation index
        2. Loop (while self.repeat):
            a. Reset board, book, wins
            b. If super mode → seed ×2 multipliers
            c. Draw board from reel strips (emits reveal event)
            d. Run cascade loop (evaluate_tumble_spin)
            e. Update basegame wins
            f. If 3+ scatters and no wincap → trigger free spins
            g. Emit total win event
            h. Calculate final win
            i. Check if outcome matches distribution criteria
        3. Record cumulative wins
        """
        self.reset_seed(sim)
        self.repeat = True
        self._repeat_count = 0

        while self.repeat:
            self.reset_book()

            # Super Free Spins: seed ×2 on all 49 grid spots
            if self.current_betmode_name == "super":
                self.seed_super_free_spins()

            # Draw board (emits reveal event)
            self.draw_board(emit_event=True)

            # Run cascade loop (emits win/tumble events)
            self.evaluate_tumble_spin()

            # Update basegame win tracking
            self.win_manager.update_gametype_wins(self.gametype)

            # Check for free spins trigger
            if not self.get_wincap_triggered() and self.check_fs_condition("scatter"):
                self.run_freespin_from_base("scatter")

            # Emit round total
            set_total_event(self)

            # Calculate and verify final win
            self.evaluate_finalwin()

            # Check if outcome matches criteria
            self.check_repeat()

        # Record accepted simulation
        self.imprint_wins()

    def run_freespin(self):
        """
        Free spins loop.
        
        Key mechanic: Multiplier spots PERSIST across all free spins.
        They are NOT reset between spins (unlike base game).
        
        Flow:
        1. Switch to freegame mode
        2. For each free spin:
            a. Update spin counter (emits updateFreespin event)
            b. Draw new board (emits reveal event)
            c. Run cascade loop (emits win/tumble events)
            d. Check retrigger (3+ scatters → add more FS)
            e. Update freegame wins
        3. End free spin round (emits freespinEnd event)
        """
        self.reset_fs_spin()

        while self.fs < self.tot_fs and not self.get_wincap_triggered():
            # Update spin counter + emit event
            self.update_freespin()

            # Reset multiplier grid each FS spin — multipliers build
            # within cascades of a single spin but don't carry over
            size = self.config.grid_size
            self.grid_multipliers = [[0] * size for _ in range(size)]

            # Draw new board (emits reveal event)
            self.draw_board(emit_event=True)

            # Run cascade loop — multipliers persist!
            self.evaluate_tumble_spin()

            # Check for retrigger
            if not self.get_wincap_triggered():
                if self.check_fs_condition("scatter"):
                    self.update_fs_retrigger_amt("scatter")

            # Update freegame win tracking
            self.win_manager.update_gametype_wins(self.gametype)

        # End free spins (emits freespinEnd + setTotalWin)
        self.end_freespin()
