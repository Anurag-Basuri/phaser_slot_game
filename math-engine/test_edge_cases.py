import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from games.sugar_rush_1000.game_config import GameConfig
from games.sugar_rush_1000.gamestate import GameState


def run_tests():
    config = GameConfig()
    
    print("--- Edge Case Testing ---")
    
    # 1. Test Full Grid of Same Symbol
    gs = GameState(config)
    gs.reset_grid_multipliers()
    gs.board = [[{"symbol": "H1", "id": 6, "explode": False} for _ in range(7)] for _ in range(7)]
    
    result = gs.get_cluster_data(record_wins=True)
    assert len(result["wins"]) == 1
    assert result["wins"][0]["count"] == 49
    print(f"Full Grid H1 Win: {result['wins'][0]['win']}")  # Should be 300x
    
    # 2. Max Win Cap Triggered Mid-Cascade
    gs = GameState(config)
    gs.bet_amount = 1.0
    gs.reset_wincap_state()
    gs.reset_grid_multipliers()
    
    # Force a massive win to hit cap immediately
    gs.board = [[{"symbol": "H1", "id": 6} for _ in range(7)] for _ in range(7)]
    # Set multipliers to 1024 everywhere
    for r in range(7):
        for c in range(7):
            gs.grid_multipliers[r][c] = 1024
            
    gs.evaluate_tumble_spin()
    
    print(f"Cumulative Win after massive cluster: {gs.cumulative_round_win}")
    print(f"Max win triggered flag: {gs.wincap_triggered}")
    assert gs.cumulative_round_win == 25000.0
    assert gs.wincap_triggered == True
    
    # 3. Retriggers during Free Spins
    gs = GameState(config)
    gs.bet_amount = 1.0
    gs.tot_fs = 10
    gs.fs = 0
    gs.gametype = config.freegame_type
    
    # Place 3 scatters on the board
    gs.board = [[{"symbol": "L3", "id": 0} for _ in range(7)] for _ in range(7)]
    gs.board[0][0] = {"symbol": "S", "id": 7}
    gs.board[1][1] = {"symbol": "S", "id": 7}
    gs.board[2][2] = {"symbol": "S", "id": 7}
    
    # Simulate the check inside run_freespin
    retrigger_scatters = gs.count_scatters()
    if retrigger_scatters >= 3:
        capped = min(retrigger_scatters, 7)
        extra_fs = config.freespin_triggers.get(gs.gametype, {}).get(capped, 0)
        gs.tot_fs += extra_fs
        
    print(f"Total FS after 3 scatter retrigger: {gs.tot_fs} (Expected 20)")
    assert gs.tot_fs == 20
    
    print("All edge case tests passed.")

if __name__ == "__main__":
    run_tests()
