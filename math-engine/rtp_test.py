import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sugar_rush_1000.game_config import GameConfig
from sugar_rush_1000.gamestate import GameState

def run_rtp_test():
    print("--- 🍬 Sugar Rush 1000 RTP Test ---")
    config = GameConfig()
    
    SPINS = 10000
    
    for betmode in config.bet_modes:
        print(f"\nTesting Mode: {betmode.name} ({SPINS:,} spins)")
        gs = GameState(config)
        gs.current_betmode_name = betmode.name
        
        # We need to assign criteria so run_spin works.
        # We'll just assign the first criteria in the distribution for simplicity in this test,
        # or randomly assign based on quotas.
        quotas = [d.quota for d in betmode.distributions]
        criterias = [d.criteria for d in betmode.distributions]
        
        total_bet = 0.0
        total_win = 0.0
        max_win = 0.0
        wincaps = 0
        fs_triggers = 0
        
        for i in range(SPINS):
            import random
            gs.criteria = random.choices(criterias, weights=quotas, k=1)[0]
            
            gs.run_spin(i)
            
            win = gs.win_manager.running_bet_win
            total_bet += betmode.cost
            total_win += win
            if win > max_win:
                max_win = win
            if gs.get_wincap_triggered():
                wincaps += 1
            if gs.gametype == config.freegame_type:
                # If we entered free spins
                fs_triggers += 1
                
        rtp = (total_win / total_bet) * 100 if total_bet > 0 else 0
        
        print(f"  Total Bet: {total_bet:,.2f}")
        print(f"  Total Win: {total_win:,.2f}")
        print(f"  RTP:       {rtp:.2f}%")
        print(f"  Max Win:   {max_win:,.2f}x")
        print(f"  Win Caps:  {wincaps}")
        if betmode.name in ["base", "ante"]:
            print(f"  FS Hits:   {fs_triggers} (1 in {SPINS/max(1, fs_triggers):.0f})")

if __name__ == "__main__":
    run_rtp_test()
