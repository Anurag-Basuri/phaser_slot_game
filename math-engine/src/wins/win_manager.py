class WinManager:
    """
    Tracks basegame and freegame wins for single simulation rounds,
    and cumulative win amounts for a given BetMode.
    """
    def __init__(self, base_game_mode, free_game_mode):
        self.base_game_mode = base_game_mode
        self.free_game_mode = free_game_mode

        self.total_cumulative_wins = 0.0
        self.cumulative_base_wins = 0.0
        self.cumulative_free_wins = 0.0

        self.running_bet_win = 0.0

        self.basegame_wins = 0.0
        self.freegame_wins = 0.0

        self.spin_win = 0.0
        self.tumble_win = 0.0

    def update_spinwin(self, win_amount: float):
        """Update spin win and running bet win for a single spin."""
        self.spin_win += win_amount
        self.running_bet_win += win_amount
        self.tumble_win += win_amount

    def set_spinwin(self, win_amount: float):
        """Set the absolute running bet win."""
        self.running_bet_win = win_amount

    def update_gametype_wins(self, gametype: str):
        """
        Update the gametype wins (basegame or freegame) after all
        actions for that specific spin/tumble sequence are complete.
        """
        if gametype == self.base_game_mode:
            self.basegame_wins += self.spin_win
        elif gametype == self.free_game_mode:
            self.freegame_wins += self.spin_win
        
        self.spin_win = 0.0
        self.tumble_win = 0.0

    def update_end_round_wins(self):
        """
        Update cumulative wins for the betmode at the end of a simulation.
        """
        self.cumulative_base_wins += self.basegame_wins
        self.cumulative_free_wins += self.freegame_wins
        self.total_cumulative_wins += (self.basegame_wins + self.freegame_wins)

    def reset_spin(self):
        """Reset variables for a new simulation run."""
        self.running_bet_win = 0.0
        self.basegame_wins = 0.0
        self.freegame_wins = 0.0
        self.spin_win = 0.0
        self.tumble_win = 0.0
