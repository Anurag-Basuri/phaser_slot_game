import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sugar_blast_1000.game_config import GameConfig
from sugar_blast_1000.gamestate import GameState


def run_tests():
    config = GameConfig()
    
    print("--- Edge Case Testing ---")
    
    # 1. Test Full Grid of Same Symbol
    from src.state.symbol import Symbol
    gs = GameState(config)
    gs.reset_book()
    gs.board = [[Symbol(config, "H1", reel=c, row=r) for c in range(7)] for r in range(7)]
    
    result = gs.get_cluster_data(record_wins=True)
    assert len(result["wins"]) == 1
    assert result["wins"][0]["count"] == 49
    print(f"Full Grid H1 Win: {result['wins'][0]['win']}")  # Should be 300x
    
    # 2. Max Win Cap Triggered Mid-Cascade
    gs = GameState(config)
    gs.reset_book()
    
    # Force a massive win to hit cap immediately
    gs.board = [[Symbol(config, "H1", reel=c, row=r) for c in range(7)] for r in range(7)]
    # Set multipliers to 1024 everywhere
    for r in range(7):
        for c in range(7):
            gs.grid_multipliers[r][c] = 1024
            
    gs.evaluate_tumble_spin()
    
    print(f"Cumulative Win after massive cluster: {gs.win_manager.running_bet_win}")
    print(f"Max win triggered flag: {gs.get_wincap_triggered()}")
    assert gs.win_manager.running_bet_win == 25000.0
    assert gs.get_wincap_triggered() == True
    
    # 3. Retriggers during Free Spins
    gs = GameState(config)
    gs.reset_book()
    gs.tot_fs = 10
    gs.fs = 0
    gs.gametype = config.freegame_type
    
    # Place 3 scatters on the board
    gs.board = [[Symbol(config, "L3", reel=c, row=r) for c in range(7)] for r in range(7)]
    gs.board[0][0] = Symbol(config, "S", reel=0, row=0)
    gs.board[1][1] = Symbol(config, "S", reel=1, row=1)
    gs.board[2][2] = Symbol(config, "S", reel=2, row=2)
    
    # Simulate the check inside run_freespin
    retrigger_scatters = gs.count_special_symbols("scatter")
    if retrigger_scatters >= 3:
        capped = min(retrigger_scatters, 7)
        extra_fs = config.freespin_triggers.get(gs.gametype, {}).get(capped, 0)
        gs.tot_fs += extra_fs
        
    print(f"Total FS after 3 scatter retrigger: {gs.tot_fs} (Expected 20)")
    assert gs.tot_fs == 20
    
    print("All edge case tests passed.")

if __name__ == "__main__":
    run_tests()
