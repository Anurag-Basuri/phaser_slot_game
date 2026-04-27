import random
from src.wins.win_manager import WinManager
from src.write_data.write import WriteData

class GeneralGameState:
    """
    Abstract base class for game states.
    Initializes configurations, resets states, manages wins, and runs simulations.
    """
    def __init__(self, config):
        self.config = config
        self.library = {}
        self.recorded_events = []
        self.special_symbol_functions = {}
        self.win_manager = WinManager(config.basegame_type, config.freegame_type)
        self.criteria = ""
        self.book_id = 0
        self.book = []
        self.win_data = {"totalWin": 0.0, "wins": []}
        self.temp_wins = []
        self._rng = random.Random()
        self.gametype = config.basegame_type
        
        # State tracking
        self.board = []
        self.top_symbols = []
        self.bottom_symbols = []
        self.special_symbols_on_board = {}
        self.reel_positions = []
        self.reelstrip_id = ""

        self.wincap_triggered = False
        self.repeat = False
        
        self.create_symbol_map()
        self.assign_special_sym_function()

    def create_symbol_map(self):
        # Extract valid symbols and build mapping
        self.symbols = list(self.config.symbol_ids.keys())

    def assign_special_sym_function(self):
        # Must be overridden in derived classes
        print("Warning: assign_special_sym_function not overridden")

    def reset_book(self):
        self.board = []
        self.book = []
        self.win_data = {"totalWin": 0.0, "wins": []}
        self.win_manager.reset_spin()
        self.gametype = self.config.basegame_type
        self.wincap_triggered = False
        self.repeat = False
        self.temp_wins = []

    def reset_seed(self, sim: int = 0):
        self.book_id = sim
        self._rng = random.Random(sim)

    def reset_fs_spin(self):
        self.gametype = self.config.freegame_type
        self.win_manager.spin_win = 0.0
        self.win_manager.tumble_win = 0.0

    def get_betmode(self, mode_name: str):
        for mode in self.config.bet_modes:
            if mode.name == mode_name:
                return mode
        print(f"Warning: Bet mode {mode_name} not found.")
        return None

    def get_current_betmode(self):
        return self.get_betmode(self.current_betmode_name)

    def get_current_betmode_distributions(self):
        mode = self.get_current_betmode()
        for dist in mode.distributions:
            if dist.criteria == self.criteria:
                return dist
        raise ValueError("Criteria distribution not found")

    def get_current_distribution_conditions(self):
        dist = self.get_current_betmode_distributions()
        if not dist.conditions:
            raise ValueError("Bet mode conditions missing")
        return dist.conditions

    def get_wincap_triggered(self):
        return self.wincap_triggered

    def in_criteria(self, *args):
        return self.criteria in args

    def record(self, description: dict):
        self.temp_wins.append(description)

    def check_force_keys(self, description):
        pass

    def combine(self, modes, betmode_name):
        pass

    def update_final_win(self):
        total = self.win_manager.basegame_wins + self.win_manager.freegame_wins
        self.final_win = min(total, self.config.wincap)
        # Ensure total wins do not exceed wincap
        if abs(self.final_win - total) > 0.01 and total < self.config.wincap:
             raise RuntimeError(f"Payout mismatch! Final: {self.final_win}, Sum: {total}")

    def check_repeat(self):
        dist = self.get_current_betmode_distributions()
        
        # If the distribution forces a wincap, we only accept if wincap was hit
        if dist.conditions.get("force_wincap", False):
            if self.win_manager.running_bet_win < self.config.wincap:
                self.repeat = True
                return
                
        # Check specific win criteria
        if dist.win_criteria is not None:
            if dist.win_criteria == 0.0 and self.win_manager.running_bet_win > 0:
                self.repeat = True
                return
            if dist.win_criteria == self.config.wincap and self.win_manager.running_bet_win < self.config.wincap:
                self.repeat = True
                return

        # Check freegame criteria
        if dist.conditions.get("force_freegame", False):
            if self.win_manager.freegame_wins == 0 and not self.get_wincap_triggered():
                 self.repeat = True
                 return

        self.repeat = False

    def imprint_wins(self):
        """Record triggered events in library and update win_manager"""
        self.win_manager.update_end_round_wins()
        # This will be appended to actual output in run_sims

    def run_spin(self, sim):
        print("Warning: run_spin must be implemented in derived classes.")

    def run_freespin(self):
        print("Warning: run_freespin must be implemented in derived classes.")

    def run_sims(self, betmode_copy_list, betmode, sim_to_criteria, total_threads, total_repeats, num_sims, thread_index, repeat_count, compress=True, write_event_list=True):
        """
        Runs multiple simulations, tracks RTP, and outputs data.
        """
        self.current_betmode_name = betmode.name
        
        simulations = []
        for i in range(num_sims):
            # assign criteria
            self.criteria = sim_to_criteria[i % len(sim_to_criteria)]
            self.run_spin(i)
            
            simulations.append({
                "id": self.book_id,
                "events": self.book,
                "payoutMultiplier": self.win_manager.running_bet_win
            })

        return simulations

class Board(GeneralGameState):
    def create_board_reelstrips(self):
        """
        Draws board using reelstrips instead of random choices.
        """
        conditions = self.get_current_distribution_conditions()
        weights = conditions.get("reel_weights", {}).get(self.gametype, {})
        
        if not weights:
            self.reelstrip_id = list(self.config.reels.keys())[0]
        else:
            options = list(weights.keys())
            probs = list(weights.values())
            self.reelstrip_id = self._rng.choices(options, weights=probs, k=1)[0]
            
        reelstrip = self.config.reels[self.reelstrip_id]
        
        self.board = []
        self.reel_positions = []
        self.special_symbols_on_board = {k: [] for k in self.config.special_symbols.keys()}
        
        for c in range(self.config.num_reels):
            reel_len = len(reelstrip[c])
            # Select random stop position
            pos = self._rng.randint(0, reel_len - 1)
            self.reel_positions.append(pos)
            
            column = []
            for r in range(self.config.num_rows[c]):
                idx = (pos + r) % reel_len
                sym_name = reelstrip[c][idx]
                
                # Create symbol dict (representing symbol object in real SDK)
                sym = {"symbol": sym_name, "id": self.config.symbol_ids.get(sym_name, 0), "explode": False, "reel": c, "row": r}
                column.append(sym)
                
                # Check specials
                for prop, sym_list in self.config.special_symbols.items():
                    if sym_name in sym_list:
                        self.special_symbols_on_board[prop].append(sym)
                        
            self.board.append(column)
            
        # Transpose to row-major format for cluster evaluation
        row_major = []
        for r in range(self.config.num_rows[0]):
            row = []
            for c in range(self.config.num_reels):
                row.append(self.board[c][r])
            row_major.append(row)
        self.board = row_major

    def print_board(self):
        for r in range(self.config.num_rows[0]):
            print(" ".join([str(self.board[r][c]["symbol"]) for c in range(self.config.num_reels)]))

    def get_special_symbols_on_board(self, property_name: str):
        return self.special_symbols_on_board.get(property_name, [])
