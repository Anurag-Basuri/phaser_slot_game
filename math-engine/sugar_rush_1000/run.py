"""
Sugar Rush 1000 — Simulation Entry Point

Runs all simulations, generates RGS output files, and optionally
runs optimization and analysis.

Usage:
    cd math-engine
    python games/sugar_rush_1000/run.py
"""

import sys
import os
import copy
import concurrent.futures

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sugar_rush_1000.game_config import GameConfig
from sugar_rush_1000.gamestate import GameState
from src.write_data.write import WriteData


def build_sim_to_criteria(betmode, num_sims):
    """
    Pre-assigns distribution criteria to simulation numbers.
    This ensures each thread gets a balanced mix of criteria.
    """
    sim_to_criteria = []

    # Normalize quotas
    total_quota = sum(d.quota for d in betmode.distributions)

    for dist in betmode.distributions:
        count = max(1, int((dist.quota / total_quota) * num_sims))
        sim_to_criteria.extend([dist.criteria] * count)

    # Pad or trim to exact num_sims
    while len(sim_to_criteria) < num_sims:
        sim_to_criteria.append(betmode.distributions[-1].criteria)
    sim_to_criteria = sim_to_criteria[:num_sims]

    return sim_to_criteria


def run_thread(config, betmode, sim_to_criteria, thread_index, start_sim, end_sim, compress):
    """
    Runs a batch of simulations on a single thread.
    Returns the list of finalized book dicts.
    """
    gs = GameState(config)
    thread_criteria = sim_to_criteria[start_sim:end_sim]
    num_sims = end_sim - start_sim

    simulations = gs.run_sims(
        betmode_copy_list=None,
        betmode=betmode,
        sim_to_criteria=thread_criteria,
        total_threads=1,
        total_repeats=0,
        num_sims=num_sims,
        thread_index=thread_index,
        repeat_count=0,
        compress=compress,
        write_event_list=True,
    )

    return simulations


def create_books(gamestate, config, num_sim_args, batching_size, num_threads, compress, profiling):
    """
    Main simulation function.
    Iterates over all bet modes, runs simulations, and writes output files.
    """
    writer = WriteData(config.game_id)
    modes_data = []
    all_recorded_events = {}

    for betmode in config.bet_modes:
        name = betmode.name
        num_sims = num_sim_args.get(name, 0)
        if num_sims == 0:
            continue

        print(f"\n{'='*60}")
        print(f"  Running {num_sims:,} simulations for mode: {name} (cost={betmode.cost}x)")
        print(f"{'='*60}")

        # Build criteria assignments
        sim_to_criteria = build_sim_to_criteria(betmode, num_sims)

        # Run simulations (single or multi-threaded)
        all_simulations = []

        if num_threads <= 1:
            # Single-threaded
            all_simulations = run_thread(
                config, betmode, sim_to_criteria,
                thread_index=0, start_sim=0, end_sim=num_sims,
                compress=compress,
            )
        else:
            # Multi-threaded
            sims_per_thread = num_sims // num_threads
            futures = []

            with concurrent.futures.ProcessPoolExecutor(max_workers=num_threads) as executor:
                for t in range(num_threads):
                    start = t * sims_per_thread
                    end = start + sims_per_thread if t < num_threads - 1 else num_sims
                    futures.append(
                        executor.submit(
                            run_thread, config, betmode, sim_to_criteria,
                            t, start, end, compress,
                        )
                    )

                for future in concurrent.futures.as_completed(futures):
                    all_simulations.extend(future.result())

        print(f"\n  Completed {len(all_simulations)} simulations for {name}")

        # Write output files
        print(f"\n  Writing output files...")

        # Compressed books (for ACP upload)
        logic_file = writer.write_compressed_book(name, all_simulations)

        # Uncompressed books (for debugging)
        if not compress:
            writer.write_uncompressed_book(name, all_simulations)

        # Primary lookup table
        weight_file = writer.write_lookup_table(name, all_simulations)

        # Segmented lookup tables
        writer.write_lookup_id_to_criteria(name, all_simulations)
        writer.write_lookup_segmented(name, all_simulations)

        # Force files
        gs_temp = GameState(config)
        gs_temp.current_betmode_name = name
        if gs_temp.recorded_events:
            writer.write_force_record(name, gs_temp.recorded_events)
            all_recorded_events[name] = gs_temp.recorded_events

        modes_data.append({
            "name": name,
            "cost": betmode.cost,
            "events": logic_file,
            "weights": weight_file,
        })

    # Write index.json
    writer.write_index(modes_data)

    # Write force summary
    if all_recorded_events:
        writer.write_force_summary(all_recorded_events)

    print(f"\n{'='*60}")
    print(f"  All simulations complete!")
    print(f"  Output: games/{config.game_id}/library/")
    print(f"{'='*60}")

    return writer


def generate_configs(gamestate_or_writer, config=None):
    """Generates config files. Accepts either a WriteData or GameState."""
    if isinstance(gamestate_or_writer, WriteData):
        gamestate_or_writer.generate_configs(config)
    else:
        writer = WriteData(gamestate_or_writer.config.game_id)
        writer.generate_configs(gamestate_or_writer.config)


if __name__ == "__main__":
    # ── Simulation Parameters ──
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

    run_conditions = {
        "run_sims": True,
        "run_optimization": False,
        "run_analysis": False,
    }

    # ── Initialize ──
    config = GameConfig()
    gamestate = GameState(config)

    # ── Run Simulations ──
    if run_conditions["run_sims"]:
        writer = create_books(
            gamestate,
            config,
            num_sim_args,
            batching_size,
            num_threads,
            compression,
            profiling,
        )
        # Generate config files
        writer.generate_configs(config)

    # ── Run Optimization ──
    if run_conditions.get("run_optimization", False):
        print("\n  Optimization not yet integrated. Run optimize.py separately.")

    # ── Run Analysis ──
    if run_conditions.get("run_analysis", False):
        print("\n  Analysis not yet integrated.")
