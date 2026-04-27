import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from games.sugar_rush_1000.game_config import GameConfig
from games.sugar_rush_1000.gamestate import GameState
from src.write_data.write import WriteData

def create_books(gamestate, config, num_sim_args, batching_size, num_threads, compress, profiling):
    writer = WriteData(config.game_id)
    modes_data = []
    
    for betmode in config.bet_modes:
        name = betmode.name
        num_sims = num_sim_args.get(name, 0)
        if num_sims == 0:
            continue
            
        print(f"Running {num_sims} simulations for mode: {name}...")
        
        # Prepare sim_to_criteria based on distribution quotas
        sim_to_criteria = []
        for dist in betmode.distributions:
            count = int(dist.quota * num_sims)
            sim_to_criteria.extend([dist.criteria] * count)
        # Pad with last criteria if rounding caused shortness
        while len(sim_to_criteria) < num_sims:
            sim_to_criteria.append(betmode.distributions[-1].criteria)

        # Run simulations
        simulations = gamestate.run_sims(
            betmode_copy_list=None, 
            betmode=betmode, 
            sim_to_criteria=sim_to_criteria, 
            total_threads=1, 
            total_repeats=0, 
            num_sims=num_sims, 
            thread_index=0, 
            repeat_count=0, 
            compress=compress, 
            write_event_list=True
        )
        
        logic_file = writer.write_compressed_book(name, simulations)
        weight_file = writer.write_lookup_table(name, simulations)
        
        modes_data.append({
            "name": name,
            "cost": betmode.cost,
            "events": logic_file,
            "weights": weight_file
        })
        
    writer.write_index(modes_data)
    writer.generate_configs(config)
    print("Done! Files output to library/ directory.")

if __name__ == "__main__":
    num_threads = 1
    rust_threads = 20
    batching_size = 50000
    compression = True
    profiling = False

    num_sim_args = {
        "base": 1000,
        "ante": 1000,
        "bonus": 1000,
        "super": 1000,
    }

    config = GameConfig()
    gamestate = GameState(config)

    create_books(
        gamestate,
        config,
        num_sim_args,
        batching_size,
        num_threads,
        compression,
        profiling,
    )
