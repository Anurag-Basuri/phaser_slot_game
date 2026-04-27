from games.sugar_rush_1000.game_override import GameStateOverride
from games.sugar_rush_1000.game_executables import GameExecutables

class GameState(GameStateOverride, GameExecutables):
    def run_spin(self, sim):
        self.reset_seed(sim)
        self.repeat = True

        while self.repeat:
            self.reset_book()
            
            if self.current_betmode_name == "super":
                self.seed_super_free_spins()

            self.draw_board(emit_event=True)
            self.evaluate_tumble_spin()
            self.win_manager.update_gametype_wins(self.gametype)

            if not self.get_wincap_triggered() and self.check_fs_condition("scatter"):
                self.run_freespin_from_base("scatter")

            self.update_final_win()
            self.check_repeat()

        self.imprint_wins()

    def run_freespin(self):
        self.reset_fs_spin()
        while self.fs < self.tot_fs and not self.get_wincap_triggered():
            self.update_freespin()
            self.draw_board(emit_event=True)
            self.evaluate_tumble_spin()

            if not self.get_wincap_triggered():
                if self.check_fs_condition("scatter"):
                    self.update_fs_retrigger_amt("scatter")

            self.win_manager.update_gametype_wins(self.gametype)

        self.end_freespin()
