"""
Stake Engine SDK — Event Functions

Events are the JSON objects returned from the RGS play/ API and make up
the vast majority of data within a game's library. Events contain all
information required by the frontend to display the current state of the game.

Every event has the format:
    {"index": int, "type": str, "<field_1>": T, ..., "<field_n>": T}

Once constructed, the event is appended via: gamestate.add_event(event)
"""

import copy


def _sym_to_json(sym, special_attributes=None):
    """
    Converts a symbol to a JSON-serializable dict.
    Works with both Symbol objects and legacy dicts.
    """
    if hasattr(sym, 'to_dict'):
        return sym.to_dict(special_attributes)
    elif isinstance(sym, dict):
        return {
            "symbol": sym.get("symbol", "?"),
            "id": sym.get("id", 0),
            "reel": sym.get("reel", 0),
            "row": sym.get("row", 0),
        }
    return {"symbol": str(sym)}


def _board_to_json(gamestate, include_padding=False):
    """Converts the current board to a 2D JSON-serializable array."""
    board_json = []
    for r in range(len(gamestate.board)):
        row = []
        for c in range(len(gamestate.board[r])):
            row.append(_sym_to_json(gamestate.board[r][c]))
        board_json.append(row)
    return board_json


def reveal_event(gamestate) -> None:
    """
    Emitted when the board is first revealed to the player.
    Contains the full board state, padding positions, game type, and anticipation.
    """
    event = {
        "type": "reveal",
        "board": _board_to_json(gamestate),
        "paddingPositions": [],
        "gameType": gamestate.gametype,
        "anticipation": gamestate.anticipation[:] if gamestate.anticipation else [0] * gamestate.config.num_reels,
    }
    gamestate.add_event(event)


def win_info_event(gamestate, include_padding_index=True) -> None:
    """
    Emitted with winning symbol positions and their win amounts.
    Adjusts positions for padding if enabled.
    """
    if not gamestate.win_data or gamestate.win_data["totalWin"] <= 0:
        return

    wins = []
    for cluster in gamestate.win_data.get("wins", []):
        positions = []
        for pos in cluster.get("positions", []):
            positions.append({"reel": pos["reel"], "row": pos["row"]})

        wins.append({
            "symbol": cluster.get("symbol", ""),
            "kind": cluster.get("count", 0),
            "win": cluster.get("win", 0),
            "positions": positions,
            "meta": copy.deepcopy(cluster.get("meta", {})),
        })

    event = {
        "type": "winInfo",
        "totalWin": gamestate.win_data["totalWin"],
        "wins": wins,
    }
    gamestate.add_event(event)


def set_win_event(gamestate, winlevel_key="standard") -> None:
    """
    Updates the cumulative win amount for a single outcome (spin level).
    Used to update the win banner/counter on the frontend.
    """
    # Determine win level for animation tier
    win_amount = gamestate.win_manager.tumble_win
    win_level = _get_win_level(win_amount)

    event = {
        "type": "setWin",
        "amount": gamestate.win_manager.tumble_win,
        "winLevel": win_level,
    }
    gamestate.add_event(event)


def set_total_event(gamestate) -> None:
    """
    Updates the total win amount for a betting round (includes all free spins).
    """
    event = {
        "type": "setTotalWin",
        "amount": gamestate.win_manager.running_bet_win,
    }
    gamestate.add_event(event)


def set_tumble_event(gamestate) -> None:
    """Logs wins from consecutive tumbles (cumulative tumble win)."""
    event = {
        "type": "tumbleBanner",
        "amount": gamestate.win_manager.tumble_win,
    }
    gamestate.add_event(event)


def wincap_event(gamestate) -> None:
    """Emitted when the maximum win amount is reached, stopping further spins."""
    event = {
        "type": "winCap",
        "amount": gamestate.config.wincap,
    }
    gamestate.add_event(event)


def fs_trigger_event(gamestate, basegame_trigger=False, freegame_trigger=False) -> None:
    """
    Emitted when free spins are triggered from the base game or retrigger.
    Exactly one of basegame_trigger or freegame_trigger must be True.
    """
    assert basegame_trigger != freegame_trigger, \
        "Exactly one of basegame_trigger or freegame_trigger must be True"
    assert gamestate.tot_fs > 0, "tot_fs must be > 0 when triggering free spins"

    scatter_count = 0
    for r in range(len(gamestate.board)):
        for c in range(len(gamestate.board[r])):
            sym = gamestate.board[r][c]
            name = sym.name if hasattr(sym, 'name') else sym.get("symbol", "")
            if name in gamestate.config.special_symbols.get("scatter", []):
                scatter_count += 1

    event = {
        "type": "fsTrigger",
        "totalSpins": gamestate.tot_fs,
        "scatterCount": scatter_count,
        "triggerType": "basegame" if basegame_trigger else "retrigger",
    }
    gamestate.add_event(event)


def update_freespin_event(gamestate) -> None:
    """Emitted at the start of each free spin to update the counter."""
    event = {
        "type": "updateFreespin",
        "currentSpin": gamestate.fs,
        "totalSpins": gamestate.tot_fs,
    }
    gamestate.add_event(event)


def freespin_end_event(gamestate, winlevel_key="endFeature") -> None:
    """Emitted when the free spin feature ends, showing total win."""
    total_win = gamestate.win_manager.freegame_wins
    win_level = _get_win_level(total_win)

    event = {
        "type": "freespinEnd",
        "totalWin": total_win,
        "winLevel": win_level,
    }
    gamestate.add_event(event)


def final_win_event(gamestate) -> None:
    """Emitted at the end of a simulation with the final payout multiplier."""
    event = {
        "type": "finalWin",
        "amount": gamestate.final_win,
    }
    gamestate.add_event(event)


def update_global_mult_event(gamestate) -> None:
    """Emitted when the global multiplier changes."""
    event = {
        "type": "updateGlobalMult",
        "multiplier": getattr(gamestate, 'global_multiplier', 1),
    }
    gamestate.add_event(event)


def tumble_board_event(gamestate) -> None:
    """
    Emitted after the board has tumbled (post-cascade).
    Contains the new board state after gravity + refill.
    """
    event = {
        "type": "tumbleBoard",
        "board": _board_to_json(gamestate),
    }
    gamestate.add_event(event)


# ── Sugar Blast 1000 Specific Events ──

def multiplier_update_event(gamestate) -> None:
    """
    Emits the current state of the 7x7 multiplier grid.
    Sugar Blast 1000 specific — shows all multiplier spot values.
    """
    grid = []
    mults = getattr(gamestate, 'grid_multipliers', None)
    if mults:
        for r in range(len(mults)):
            row = []
            for c in range(len(mults[r])):
                row.append(mults[r][c])
            grid.append(row)

    event = {
        "type": "multiplierUpdate",
        "grid": grid,
    }
    gamestate.add_event(event)


# ── Utility ──

def _get_win_level(win_amount: float) -> int:
    """
    Returns the win level tier for animation purposes.
    0 = no win, 1 = small, 2 = medium, 3 = big, 4 = mega, 5 = epic
    """
    if win_amount <= 0:
        return 0
    elif win_amount < 2:
        return 1
    elif win_amount < 10:
        return 2
    elif win_amount < 50:
        return 3
    elif win_amount < 500:
        return 4
    else:
        return 5
