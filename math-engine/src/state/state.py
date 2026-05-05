"""
Stake Engine SDK — GeneralGameState & Board Classes

The GameState class serves as the central hub for managing all aspects
of a simulation batch. It handles simulation parameters, game modes,
configuration settings, simulation results, and output files.
"""

import random
import copy
from src.wins.win_manager import WinManager
from src.state.symbol import Symbol


class GeneralGameState:
    """
    Abstract base class for game states.
    Initializes configurations, resets states, manages wins, and runs simulations.
    """

    def __init__(self, config):
        self.config = config
        self.library = []
        self.recorded_events = {}  # force file data: {search_key: [book_ids]}
        self.special_symbol_functions = {}
        self.win_manager = WinManager(config.basegame_type, config.freegame_type)
        self.criteria = ""
        self.current_betmode_name = ""
        self.book_id = 0
        self.book = {}
        self.win_data = {"totalWin": 0.0, "wins": []}
        self.temp_wins = []
        self._rng = random.Random()
        self.gametype = config.basegame_type
        self.final_win = 0.0

        # State tracking
        self.board = []
        self.top_symbols = []
        self.bottom_symbols = []
        self.special_symbols_on_board = {}
        self.reel_positions = []
        self.reelstrip_id = ""
        self.anticipation = []

        self.wincap_triggered = False
        self.repeat = False

        # Free spin tracking
        self.fs = 0
        self.tot_fs = 0

        # Symbol map
        self.symbol_map = {}
        self.create_symbol_map()
        self.assign_special_sym_function()

    def create_symbol_map(self) -> None:
        """Extracts all valid symbols from the configuration."""
        self.symbols = list(self.config.symbol_ids.keys())

    def assign_special_sym_function(self):
        """
        Must be overridden in derived classes to define custom symbol behavior.
        Format: self.special_symbol_functions = {"S": [callable, ...]}
        """
        pass

    def reset_book(self) -> None:
        """
        Resets global game state variables for a new simulation.
        The book is a structured dict matching the SDK format.
        """
        self.board = []
        self.book = {
            "id": self.book_id + 1,
            "payoutMultiplier": 0.0,
            "events": [],
            "criteria": self.criteria,
            "baseGameWins": 0.0,
            "freeGameWins": 0.0,
        }
        self.win_data = {"totalWin": 0.0, "wins": []}
        self.win_manager.reset_spin()
        self.gametype = self.config.basegame_type
        self.wincap_triggered = False
        self.repeat = False
        self.temp_wins = []
        self.final_win = 0.0
        self.fs = 0
        self.tot_fs = 0
        self.anticipation = []
        self._repeat_count = getattr(self, '_repeat_count', 0)

    def add_event(self, event: dict) -> None:
        """
        Appends an event to the current book's events list.
        Automatically sets the event index.
        """
        event["index"] = len(self.book["events"])
        self.book["events"].append(event)

    def reset_seed(self, sim: int = 0) -> None:
        """Resets the RNG seed for reproducibility."""
        self.book_id = sim
        self._rng = random.Random(sim)

    def reset_fs_spin(self) -> None:
        """Resets the free spin game state when triggered."""
        self.gametype = self.config.freegame_type
        self.win_manager.spin_win = 0.0
        self.win_manager.tumble_win = 0.0

    def get_betmode(self, mode_name: str):
        """Retrieves a bet mode configuration based on its name."""
        for mode in self.config.bet_modes:
            if mode.name == mode_name:
                return mode
        print(f"Warning: Bet mode '{mode_name}' not found.")
        return None

    def get_current_betmode(self):
        """Returns the current active bet mode."""
        return self.get_betmode(self.current_betmode_name)

    def get_current_betmode_distributions(self):
        """Retrieves the distribution for the current criteria."""
        mode = self.get_current_betmode()
        for dist in mode.distributions:
            if dist.criteria == self.criteria:
                return dist
        raise ValueError(f"Criteria '{self.criteria}' not found in betmode '{self.current_betmode_name}'")

    def get_current_distribution_conditions(self) -> dict:
        """Returns the conditions dict for the current criteria."""
        dist = self.get_current_betmode_distributions()
        if not dist.conditions:
            raise ValueError(f"Bet mode conditions missing for criteria '{self.criteria}'")
        return dist.conditions

    def get_wincap_triggered(self) -> bool:
        """Returns whether the max win cap has been reached."""
        return self.wincap_triggered

    def in_criteria(self, *args) -> bool:
        """Checks if the current win criteria match any of the given arguments."""
        return self.criteria in args

    def record(self, description: dict) -> None:
        """
        Records specific game events for force file generation.
        Keys and book IDs are held in temp_wins until the simulation
        is accepted (to avoid recording rejected simulations).
        """
        self.temp_wins.append(description)
        self.temp_wins.append(self.book["id"])

    def check_force_keys(self, description) -> None:
        """
        Verifies and adds unique force-key parameters to the recorded_events.
        Each unique search key maps to a list of book IDs.
        """
        # Convert dict to a hashable key
        search_key = str(sorted(description.items()))

        if search_key not in self.recorded_events:
            self.recorded_events[search_key] = {
                "search": description,
                "timesTriggered": 0,
                "bookIds": [],
            }

    def combine(self, modes, betmode_name) -> None:
        """Merges forced keys from multiple mode configurations."""
        pass

    def update_final_win(self) -> None:
        """
        Computes and verifies the final win amount across base and free games.
        Ensures total wins do not exceed the win cap.
        """
        total = self.win_manager.basegame_wins + self.win_manager.freegame_wins

        if total > self.config.wincap:
            self.final_win = self.config.wincap
        else:
            self.final_win = total

        # Verify payout consistency (allow small floating point tolerance)
        expected = self.win_manager.running_bet_win
        if abs(self.final_win - expected) > 0.01:
            raise RuntimeError(
                f"Payout mismatch! final_win={self.final_win:.4f}, "
                f"running_bet_win={expected:.4f}, "
                f"basegame={self.win_manager.basegame_wins:.4f}, "
                f"freegame={self.win_manager.freegame_wins:.4f}"
            )

    def check_repeat(self) -> None:
        """
        Determines if a spin needs to be repeated based on criteria constraints.
        Distribution criteria are pre-assigned to each simulation number.
        Bails after MAX_REPEATS to prevent infinite loops.
        """
        MAX_REPEATS = 50
        self._repeat_count += 1

        # Safety valve: accept after too many retries
        if self._repeat_count >= MAX_REPEATS:
            self.repeat = False
            return

        dist = self.get_current_betmode_distributions()

        # Check force_wincap: only accept if wincap was actually hit
        if dist.conditions.get("force_wincap", False):
            if self.win_manager.running_bet_win < self.config.wincap:
                self.repeat = True
                return

        # Check specific win_criteria value
        if dist.win_criteria is not None:
            if dist.win_criteria == 0.0 and self.win_manager.running_bet_win > 0:
                self.repeat = True
                return
            if dist.win_criteria == self.config.wincap and self.win_manager.running_bet_win < self.config.wincap:
                self.repeat = True
                return

        # Check force_freegame: must have triggered free spins
        if dist.conditions.get("force_freegame", False):
            if self.win_manager.freegame_wins == 0 and not self.wincap_triggered:
                self.repeat = True
                return

        self.repeat = False

    def imprint_wins(self) -> None:
        """
        Records triggered events in library and updates win_manager.
        Finalizes book structure and transfers temp_wins to force file data.
        """
        # Finalize book structure
        self.book["payoutMultiplier"] = self.win_manager.running_bet_win
        self.book["baseGameWins"] = self.win_manager.basegame_wins
        self.book["freeGameWins"] = self.win_manager.freegame_wins

        # Process temp_wins into force file data (pairs of description + book_id)
        i = 0
        while i < len(self.temp_wins) - 1:
            description = self.temp_wins[i]
            book_id = self.temp_wins[i + 1]
            search_key = str(sorted(description.items()))

            if search_key not in self.recorded_events:
                self.recorded_events[search_key] = {
                    "search": description,
                    "timesTriggered": 0,
                    "bookIds": [],
                }

            entry = self.recorded_events[search_key]
            entry["timesTriggered"] += 1
            if book_id not in entry["bookIds"]:
                entry["bookIds"].append(book_id)
            i += 2

        self.temp_wins = []

        # Update cumulative wins for RTP tracking
        self.win_manager.update_end_round_wins()

    def run_spin(self, sim):
        """Must be implemented in derived classes."""
        print("Warning: run_spin must be implemented in derived classes.")

    def run_freespin(self):
        """Must be implemented in derived classes."""
        print("Warning: run_freespin must be implemented in derived classes.")

    def run_sims(self, betmode_copy_list, betmode, sim_to_criteria,
                 total_threads, total_repeats, num_sims, thread_index,
                 repeat_count, compress=True, write_event_list=True):
        """
        Runs multiple simulations, setting up bet modes and criteria per simulation.
        Tracks and prints RTP calculations.
        """
        self.current_betmode_name = betmode.name

        simulations = []
        total_repeat_count = 0

        for i in range(num_sims):
            # Assign pre-determined criteria
            self.criteria = sim_to_criteria[i % len(sim_to_criteria)]

            # Run the spin (may loop internally via self.repeat)
            self.run_spin(i)

            # Collect the finalized book
            simulations.append(copy.deepcopy(self.book))

        # Print thread RTP summary
        total_bet = num_sims * betmode.cost
        total_win = self.win_manager.total_cumulative_wins
        base_rtp = self.win_manager.cumulative_base_wins / total_bet if total_bet > 0 else 0
        free_rtp = self.win_manager.cumulative_free_wins / total_bet if total_bet > 0 else 0
        total_rtp = total_win / total_bet if total_bet > 0 else 0

        print(
            f"Thread {thread_index} finished with {total_rtp:.3f} RTP. "
            f"[baseGame: {base_rtp:.3f}, freeGame: {free_rtp:.3f}]"
        )

        return simulations


class Board(GeneralGameState):
    """
    Handles generation of game boards from reel strips.
    Inherits GeneralGameState and provides board creation methods.
    """

    def create_board_reelstrips(self) -> None:
        """
        Draws a game board using reel strips from the current distribution conditions.
        Selects a reel set, picks random stop positions, and creates a 2D array of Symbols.
        """
        conditions = self.get_current_distribution_conditions()
        weights = conditions.get("reel_weights", {}).get(self.gametype, {})

        # Select reel strip ID from weighted options
        if not weights:
            self.reelstrip_id = list(self.config.reels.keys())[0]
        else:
            options = list(weights.keys())
            probs = list(weights.values())
            self.reelstrip_id = self._rng.choices(options, weights=probs, k=1)[0]

        reelstrip = self.config.reels[self.reelstrip_id]

        # Initialize board structures
        self.special_symbols_on_board = {k: [] for k in self.config.special_symbols.keys()}
        self.reel_positions = []
        self.anticipation = [0] * self.config.num_reels

        # Build column-major board first
        columns = []
        scatter_count_so_far = 0
        min_scatters_for_fs = 3

        for c in range(self.config.num_reels):
            reel_len = len(reelstrip[c])
            pos = self._rng.randint(0, reel_len - 1)
            self.reel_positions.append(pos)

            column = []
            for r in range(self.config.num_rows[c]):
                idx = (pos + r) % reel_len
                sym_name = reelstrip[c][idx]

                # Create Symbol object
                sym = Symbol(self.config, sym_name, reel=c, row=r)

                # Run special functions if defined
                if sym_name in self.special_symbol_functions:
                    sym.special_functions = self.special_symbol_functions[sym_name]
                    sym.run_special_functions(self)

                column.append(sym)

                # Track special symbols
                for prop, sym_list in self.config.special_symbols.items():
                    if sym_name in sym_list:
                        self.special_symbols_on_board[prop].append({
                            "reel": c, "row": r
                        })
                        if prop == "scatter":
                            scatter_count_so_far += 1

            columns.append(column)

            # Build anticipation array for scatter-near-trigger
            if scatter_count_so_far >= (min_scatters_for_fs - 1) and scatter_count_so_far < min_scatters_for_fs:
                # We're one scatter away from triggering — add suspense to remaining reels
                for future_reel in range(c + 1, self.config.num_reels):
                    self.anticipation[future_reel] = future_reel - c

        # Transpose to row-major format for cluster evaluation
        self.board = []
        for r in range(self.config.num_rows[0]):
            row = []
            for c in range(self.config.num_reels):
                row.append(columns[c][r])
            self.board.append(row)

    def force_board_from_reelstrips(self, reel_stops: list = None) -> None:
        """
        Forces specific stopping positions on the reel strips.
        If a stop value is None for a reel, a random position is chosen.
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
        self.special_symbols_on_board = {k: [] for k in self.config.special_symbols.keys()}
        self.reel_positions = []

        columns = []
        for c in range(self.config.num_reels):
            reel_len = len(reelstrip[c])
            if reel_stops and c < len(reel_stops) and reel_stops[c] is not None:
                pos = reel_stops[c] % reel_len
            else:
                pos = self._rng.randint(0, reel_len - 1)
            self.reel_positions.append(pos)

            column = []
            for r in range(self.config.num_rows[c]):
                idx = (pos + r) % reel_len
                sym_name = reelstrip[c][idx]
                sym = Symbol(self.config, sym_name, reel=c, row=r)
                column.append(sym)

                for prop, sym_list in self.config.special_symbols.items():
                    if sym_name in sym_list:
                        self.special_symbols_on_board[prop].append({
                            "reel": c, "row": r
                        })

            columns.append(column)

        self.board = []
        for r in range(self.config.num_rows[0]):
            row = []
            for c in range(self.config.num_reels):
                row.append(columns[c][r])
            self.board.append(row)

    def print_board(self, board=None) -> None:
        """Displays a correctly orientated printout of all symbol names."""
        b = board if board is not None else self.board
        for r in range(len(b)):
            row_str = " ".join(
                f"{cell.name:>2}" if hasattr(cell, 'name') else f"{str(cell):>2}"
                for cell in b[r]
            )
            print(row_str)

    def get_special_symbols_on_board(self, property_name: str = None) -> list:
        """Returns positions of special symbols. Rescans if called without args."""
        if property_name:
            return self.special_symbols_on_board.get(property_name, [])

        # Rescan entire board
        self.special_symbols_on_board = {k: [] for k in self.config.special_symbols.keys()}
        for r in range(len(self.board)):
            for c in range(len(self.board[r])):
                sym = self.board[r][c]
                sym_name = sym.name if hasattr(sym, 'name') else sym.get("symbol", "")
                for prop, sym_list in self.config.special_symbols.items():
                    if sym_name in sym_list:
                        self.special_symbols_on_board[prop].append({
                            "reel": c, "row": r
                        })
        return self.special_symbols_on_board
