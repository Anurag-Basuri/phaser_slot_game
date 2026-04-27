from src.calculations.tumble import Tumble
from src.calculations.cluster import ClusterWins

class Executables(Tumble, ClusterWins):
    def draw_board(self, emit_event=True):
        self.create_board_reelstrips()
        if emit_event:
            # Emit reveal event here
            pass

    def evaluate_wincap(self):
        max_win = self.config.wincap
        if self.win_manager.running_bet_win >= max_win:
            # Cap at exactly max_win
            overshoot = self.win_manager.running_bet_win - max_win
            if overshoot > 0:
                self.win_manager.spin_win -= overshoot
                self.win_manager.running_bet_win = max_win
            self.wincap_triggered = True

    def count_special_symbols(self, special_sym_criteria: str) -> int:
        count = 0
        for r in range(self.config.grid_size):
            for c in range(self.config.grid_size):
                if self.board[r][c].get("symbol") in self.config.special_symbols.get(special_sym_criteria, []):
                    count += 1
        return count

    def check_fs_condition(self, scatter_key: str = "scatter") -> bool:
        return self.count_special_symbols(scatter_key) >= 3

    def run_freespin_from_base(self, scatter_key: str = "scatter"):
        scatter_count = self.count_special_symbols(scatter_key)
        self.record({
            "kind": scatter_count,
            "symbol": scatter_key,
            "gametype": self.gametype,
        })
        self.update_freespin_amount(scatter_key)
        self.run_freespin()

    def update_freespin_amount(self, scatter_key: str = "scatter"):
        scatter_count = self.count_special_symbols(scatter_key)
        fs_map = self.config.freespin_triggers.get(self.gametype, {})
        capped_count = min(scatter_count, 7)
        self.tot_fs = fs_map.get(capped_count, 0)
        self.fs = 0

    def update_fs_retrigger_amt(self, scatter_key: str = "scatter"):
        scatter_count = self.count_special_symbols(scatter_key)
        fs_map = self.config.freespin_triggers.get(self.gametype, {})
        capped_count = min(scatter_count, 7)
        self.tot_fs += fs_map.get(capped_count, 0)

    def update_freespin(self):
        self.fs += 1
        self.win_manager.spin_win = 0.0

    def end_freespin(self):
        pass

    def emit_tumble_win_events(self):
        pass
