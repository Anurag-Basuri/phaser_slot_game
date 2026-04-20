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

    def assign_special_sym_function(self):
        # We don't have symbols that assign multipliers purely on spawn (like Wilds).
        # Multipliers are strictly spot-based handled in `tumble_game_board`.
        self.special_symbol_functions = {}

    def run_spin(self, sim):
        self.reset_seed(sim)
        self.repeat = True

        while self.repeat:
            self.reset_book()
            self.gametype = self.config.basegame_type
            
            # Flush spot multipliers at the start of a base game spin
            self.reset_grid_multipliers()
            if self.get_current_betmode().name == "super":
                self.seed_super_free_spins()

            self.draw_board(emit_event=False)
            
            # Include grid status in reveal
            reveal_event(self)
            
            self.evaluate_tumble_spin()

            self.win_manager.update_gametype_wins(self.gametype)

            # Check Scatter threshold (3+ scatters = free game)
            if self.check_fs_condition("scatter"):
                self.run_freespin_from_base("scatter")

            self.evaluate_finalwin()
            self.check_repeat()

        self.imprint_wins()

    def evaluate_tumble_spin(self):
        """
        Calculates cluster pays. Processes tumbles. Tracks grid multipliers.
        Runs until no more clusters are formed.
        """
        # SDK uses `get_cluster_data(record_wins=True)` for cluster evaluations
        self.win_data = self.get_cluster_data(record_wins=True)
        
        # Apply SugarRush specific grid multipliers BEFORE updating wallet
        self.win_data = self.apply_cluster_multipliers(self.win_data)
        self.win_manager.update_spinwin(self.win_data["totalWin"])

        while self.win_data["totalWin"] > 0 and not getattr(self, "wincap_triggered", False):
            # Send info about winning clusters
            win_info_event(self)
            set_win_event(self)
            
            # Cascade
            self.tumble_game_board()
            tumble_board_event(self)
            
            # Re-evaluate
            self.win_data = self.get_cluster_data(record_wins=True)
            self.win_data = self.apply_cluster_multipliers(self.win_data)
            self.win_manager.update_spinwin(self.win_data["totalWin"])

    def run_freespin_from_base(self, scatter_key: str = "scatter"):
        # Emits freegame triggers and transitions game state
        self.update_freespin_amount(scatter_key)
        self.run_freespin()

    def run_freespin(self):
        self.reset_fs_spin()
        
        while self.fs < self.tot_fs and not getattr(self, "wincap_triggered", False):
            self.update_freespin()
            update_freespin_event(self)
            
            # Crucial Sugar Rush Logic: WE DO NOT RESET GRID MULTIPLIERS!
            # They freeze indefinitely across free spins.
            self.draw_board(emit_event=False)
            reveal_event(self)
            
            self.evaluate_tumble_spin()

            # Check Retriggers (3+ Scatters)
            if self.check_fs_condition("scatter"):
                self.update_fs_retrigger_amt("scatter")

            self.win_manager.update_gametype_wins(self.gametype)

        freespin_end_event(self)
