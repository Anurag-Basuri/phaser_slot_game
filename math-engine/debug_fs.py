import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sugar_blast_1000.game_config import GameConfig
from sugar_blast_1000.gamestate import GameState

config = GameConfig()
gs = GameState(config)
gs.current_betmode_name = 'bonus'
gs.criteria = 'freegame'
gs.run_spin(12)

print(f'Basegame wins: {gs.win_manager.basegame_wins}')
print(f'Freegame wins: {gs.win_manager.freegame_wins}')
print(f'Final win: {gs.final_win}')
print(f'Payout Multiplier: {gs.book.get("payoutMultiplier")}')
print(f'Wincap hit: {gs.wincap_triggered}')
print(f'Total FS played: {gs.fs}')
