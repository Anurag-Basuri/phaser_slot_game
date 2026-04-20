class WinManager:
    def update_gametype_wins(self, gametype):
        pass
    def update_spinwin(self, amount):
        pass

class GeneralGameState:
    def __init__(self, config):
        self.config = config
        self.win_manager = WinManager()
        self.fs = 0
        self.tot_fs = 0
        self.board = []

    def reset_seed(self, sim): pass
    def reset_book(self): pass
    def reset_fs_spin(self): pass
    def get_current_betmode(self): 
        class M:
            name = "base"
        return M()
    
    def draw_board(self, emit_event=True): pass
    def check_fs_condition(self, key): return False
    def evaluate_finalwin(self): pass
    def check_repeat(self):
        self.repeat = False
    def imprint_wins(self): pass

    def update_freespin_amount(self, key): pass
    def update_fs_retrigger_amt(self, key): pass
    def update_freespin(self):
        self.fs += 1
