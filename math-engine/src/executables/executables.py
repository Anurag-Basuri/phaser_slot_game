"""
Stake Engine SDK — Base Game Executables (Local Development Stub)

In production, the SDK provides optimized cluster detection and tumble logic.
For local development, game-specific classes (e.g., SugarRushExecutables)
override these methods with full implementations.
"""


class GameExecutables:
    """Base class for game-specific executable logic."""

    def tumble_game_board(self):
        """Remove exploded symbols and apply gravity. Override in subclass."""
        pass

    def get_cluster_data(self, record_wins=False) -> dict:
        """Detect winning clusters. Override in subclass."""
        return {"totalWin": 0, "wins": []}
