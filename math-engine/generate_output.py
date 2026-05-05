"""
Generate math engine output files for Stake Engine upload.
Uses minimal sim counts for fast initial generation.
For production, increase counts or use the Rust optimizer.
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sugar_rush_1000.game_config import GameConfig
from sugar_rush_1000.gamestate import GameState
from sugar_rush_1000.run import create_books

config = GameConfig()
gamestate = GameState(config)

# Minimal counts for fast generation (~5-10 min in pure Python)
# The Rust optimizer will refine weights for production RTP
num_sim_args = {
    "base": 500,
    "ante": 500,
    "bonus": 200,
    "super": 200,
}

start = time.time()

writer = create_books(
    gamestate,
    config,
    num_sim_args,
    batching_size=50000,
    num_threads=1,
    compress=True,
    profiling=False,
)

# Generate config files
writer.generate_configs(config)

elapsed = time.time() - start
print(f"\n✅ All output files generated in math/ directory ({elapsed:.1f}s)")
print("Upload the contents of math/ to Stake Engine ACP")
