"""
Stake Engine SDK — Event Functions (Local Development Stubs)

In production, these serialize game state into the RGS wire format.
For local development, they are no-ops (the game-specific gamestate
handles event emission via _emit_event()).
"""


def reveal_event(gamestate):
    """Emitted when the board is first revealed to the player."""
    pass


def win_info_event(gamestate):
    """Emitted with cluster win details."""
    pass


def set_win_event(gamestate):
    """Emitted to update the player's win display."""
    pass


def set_total_event(gamestate):
    """Emitted to update the total round win."""
    pass


def final_win_event(gamestate):
    """Emitted at the end of the round with the final win amount."""
    pass


def update_freespin_event(gamestate):
    """Emitted at the start of each free spin."""
    pass


def fs_trigger_event(gamestate, **kwargs):
    """Emitted when free spins are triggered (scatter threshold met)."""
    pass


def freespin_end_event(gamestate):
    """Emitted when the free spins round completes."""
    pass


def tumble_board_event(gamestate):
    """Emitted after the board has tumbled (post-cascade)."""
    pass
