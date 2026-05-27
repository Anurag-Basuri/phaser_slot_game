"""
Optimization Config for Sugar Blast 1000

Provides the Python wrapper to execute the Rust optimization program.
"""

import os
import subprocess

class OptimizationExecution:
    def __init__(self, config):
        self.config = config
        self.rust_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rust_optimizer")

    def run_optimization(self):
        print(f"============================================================")
        print(f"Starting Rust Optimizer for {self.config.working_name}")
        print(f"Target RTP: {self.config.rtp * 100}%")
        print(f"============================================================")
        
        # 1. Compile Rust program (release mode)
        print("Compiling Rust Optimization Engine...")
        try:
            subprocess.run(["cargo", "build", "--release"], cwd=self.rust_dir, check=True)
        except FileNotFoundError:
            print("[ERROR] Cargo not found. Please install Rust (https://rustup.rs/) to run optimization.")
            return
        except subprocess.CalledProcessError:
            print("[ERROR] Failed to compile Rust optimizer.")
            return

        # 2. Execute Rust program
        print("\nExecuting Parallel Optimization (1M+ Spins)...")
        bin_path = os.path.join(self.rust_dir, "target", "release", "sugar_blast_optimizer")
        if os.name == 'nt':
            bin_path += ".exe"
            
        try:
            # We can capture output or just let it print to stdout
            subprocess.run([bin_path], cwd=self.rust_dir, check=True)
        except subprocess.CalledProcessError:
            print("[ERROR] Optimization execution failed.")

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from sugar_blast_1000.game_config import GameConfig
    config = GameConfig()
    opt = OptimizationExecution(config)
    opt.run_optimization()
