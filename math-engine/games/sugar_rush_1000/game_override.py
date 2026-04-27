from src.state.state import GeneralGameState

class GameStateOverride(GeneralGameState):
    def assign_special_sym_function(self):
        self.special_symbol_functions = {}

    def reset_book(self):
        super().reset_book()
        size = self.config.grid_size
        self.grid_multipliers = [[0] * size for _ in range(size)]
