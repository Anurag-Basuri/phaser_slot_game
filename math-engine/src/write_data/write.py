"""
Stake Engine SDK — Write Data Module

Generates all output files required by the Stake ACP:
- Compressed books (.jsonl.zst) — game logic
- Lookup tables (.csv) — payout summaries
- Index file (index.json) — mode registry
- Force files — event tracking for optimization
- Config files — frontend, backend, and math configs
"""

import os
import json
import hashlib
import csv
import zstandard as zstd


class OutputFiles:
    """Constructs filepaths and creates output directories."""

    def __init__(self, game_id: str):
        self.base_dir = f"games/{game_id}/library"
        self.books_dir = f"{self.base_dir}/books"
        self.books_compressed_dir = f"{self.base_dir}/books_compressed"
        self.configs_dir = f"{self.base_dir}/configs"
        self.forces_dir = f"{self.base_dir}/forces"
        self.lookup_dir = f"{self.base_dir}/lookup_tables"

        for d in [self.books_dir, self.books_compressed_dir,
                  self.configs_dir, self.forces_dir, self.lookup_dir]:
            os.makedirs(d, exist_ok=True)


class WriteData:
    """Handles writing all simulation output files."""

    def __init__(self, game_id: str):
        self.game_id = game_id
        self.out = OutputFiles(game_id)

    # ── Books ──

    def write_compressed_book(self, betmode_name: str, simulations: list) -> str:
        """
        Writes zStandard compressed JSON-lines (.jsonl.zst).
        Required format: {"id": <int>, "events": <list>, "payoutMultiplier": <int>}
        payoutMultiplier is stored as uint64 (e.g., 1150 = 11.5x payout).
        """
        filename = f"{self.out.books_compressed_dir}/books_{betmode_name}.jsonl.zst"

        cctx = zstd.ZstdCompressor()
        with open(filename, 'wb') as f:
            with cctx.stream_writer(f) as compressor:
                for sim in simulations:
                    line = json.dumps({
                        "id": sim["id"],
                        "events": sim["events"],
                        "payoutMultiplier": int(round(sim["payoutMultiplier"] * 100)),
                    }) + "\n"
                    compressor.write(line.encode('utf-8'))

        print(f"  Written: {filename} ({len(simulations)} simulations)")
        return f"books_{betmode_name}.jsonl.zst"

    def write_uncompressed_book(self, betmode_name: str, simulations: list) -> str:
        """
        Writes uncompressed JSON-lines (.jsonl) for debugging.
        Same format as compressed but human-readable.
        """
        filename = f"{self.out.books_dir}/books_{betmode_name}.jsonl"

        with open(filename, 'w') as f:
            for sim in simulations:
                line = json.dumps({
                    "id": sim["id"],
                    "events": sim["events"],
                    "payoutMultiplier": int(round(sim["payoutMultiplier"] * 100)),
                    "criteria": sim.get("criteria", ""),
                    "baseGameWins": sim.get("baseGameWins", 0.0),
                    "freeGameWins": sim.get("freeGameWins", 0.0),
                })
                f.write(line + "\n")

        print(f"  Written: {filename} ({len(simulations)} simulations)")
        return f"books_{betmode_name}.jsonl"

    # ── Lookup Tables ──

    def write_lookup_table(self, betmode_name: str, simulations: list) -> str:
        """
        Writes the primary lookup table CSV.
        Format: simulation_number, weight (uint64), payout_multiplier (uint64)
        All weights start at 1. The optimization algorithm modifies them.
        """
        filename = f"{self.out.lookup_dir}/lookUpTable_{betmode_name}_0.csv"

        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            for sim in simulations:
                writer.writerow([
                    sim["id"],
                    1,
                    int(round(sim["payoutMultiplier"] * 100)),
                ])

        print(f"  Written: {filename}")
        return f"lookUpTable_{betmode_name}_0.csv"

    def write_lookup_id_to_criteria(self, betmode_name: str, simulations: list) -> None:
        """
        Writes lookUpTableIdToCriteria CSV.
        Maps each simulation ID to its assigned criteria.
        """
        filename = f"{self.out.lookup_dir}/lookUpTableIdToCriteria_{betmode_name}.csv"

        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "Criteria"])
            for sim in simulations:
                writer.writerow([sim["id"], sim.get("criteria", "")])

        print(f"  Written: {filename}")

    def write_lookup_segmented(self, betmode_name: str, simulations: list) -> None:
        """
        Writes lookUpTableSegmented CSV.
        Shows the basegame/freegame win contribution per simulation.
        """
        filename = f"{self.out.lookup_dir}/lookUpTableSegmented_{betmode_name}.csv"

        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "PayoutMultiplier", "BaseGameWins", "FreeGameWins"])
            for sim in simulations:
                writer.writerow([
                    sim["id"],
                    int(round(sim["payoutMultiplier"] * 100)),
                    round(sim.get("baseGameWins", 0.0), 4),
                    round(sim.get("freeGameWins", 0.0), 4),
                ])

        print(f"  Written: {filename}")

    # ── Force Files ──

    def write_force_record(self, betmode_name: str, recorded_events: dict) -> None:
        """
        Writes force_record_<mode>.json.
        Contains all recorded events with search keys, trigger counts, and book IDs.
        """
        filename = f"{self.out.forces_dir}/force_record_{betmode_name}.json"

        force_data = list(recorded_events.values())

        with open(filename, 'w') as f:
            json.dump(force_data, f, indent=2)

        print(f"  Written: {filename} ({len(force_data)} keys)")

    def write_force_summary(self, all_recorded: dict) -> None:
        """
        Writes force.json — a combined summary of all unique search fields and keys
        across all bet modes.
        """
        filename = f"{self.out.forces_dir}/force.json"

        # Collect unique search field names
        unique_fields = set()
        for entries in all_recorded.values():
            for entry in entries.values():
                for key in entry["search"].keys():
                    unique_fields.add(key)

        with open(filename, 'w') as f:
            json.dump({"fields": sorted(unique_fields)}, f, indent=2)

        print(f"  Written: {filename}")

    # ── Index File ──

    def write_index(self, modes_data: list) -> None:
        """
        Writes the required index.json file for RGS math upload.
        Format: {"modes": [{"name": str, "cost": float, "events": str, "weights": str}]}
        """
        index_data = {"modes": modes_data}
        filename = f"{self.out.base_dir}/index.json"

        with open(filename, 'w') as f:
            json.dump(index_data, f, indent=4)

        print(f"  Written: {filename}")

    # ── Config Files ──

    def generate_configs(self, config_obj) -> None:
        """Generates frontend, math, and backend config files."""
        self._write_config_fe(config_obj)
        self._write_config_math(config_obj)
        self._write_config_backend(config_obj)

    def _write_config_fe(self, config) -> None:
        """
        Frontend config — consumed by the web-sdk for UI rendering.
        Contains symbol info, paytable, bet mode details, grid dimensions.
        """
        symbols = []
        for name, sid in config.symbol_ids.items():
            sym_info = {"name": name, "id": sid}

            # Check if it's a special symbol
            for prop, sym_list in config.special_symbols.items():
                if name in sym_list:
                    sym_info["special"] = prop

            # Check if it's paying
            pays = {}
            for (kind, sym_name), payout in config.paytable.items():
                if sym_name == name:
                    pays[str(kind)] = payout
            if pays:
                sym_info["payouts"] = pays

            symbols.append(sym_info)

        bet_modes = []
        for bm in config.bet_modes:
            bet_modes.append({
                "name": bm.name,
                "cost": bm.cost,
                "maxWin": bm.max_win,
                "isFeature": bm.is_feature,
                "isBuybonus": bm.is_buybonus,
                "autoCloseDisabled": bm.auto_close_disabled,
            })

        fe_config = {
            "game_id": config.game_id,
            "working_name": config.working_name,
            "grid_size": config.grid_size,
            "num_reels": config.num_reels,
            "num_rows": config.num_rows,
            "wincap": config.wincap,
            "rtp": config.rtp,
            "win_type": config.win_type,
            "min_cluster_size": config.min_cluster_size,
            "symbols": symbols,
            "bet_modes": bet_modes,
            "freespin_triggers": {
                k: {str(sk): sv for sk, sv in v.items()}
                for k, v in config.freespin_triggers.items()
            },
        }

        filename = f"{self.out.configs_dir}/config_fe.json"
        with open(filename, 'w') as f:
            json.dump(fe_config, f, indent=2)
        print(f"  Written: {filename}")

    def _write_config_math(self, config) -> None:
        """
        Math config — consumed by the optimization algorithm.
        Contains RTP splits, distribution conditions, optimization parameters.
        """
        bet_modes = []
        for bm in config.bet_modes:
            distributions = []
            for dist in bm.distributions:
                distributions.append({
                    "criteria": dist.criteria,
                    "quota": dist.quota,
                    "win_criteria": dist.win_criteria,
                    "conditions": dist.conditions,
                })
            bet_modes.append({
                "name": bm.name,
                "cost": bm.cost,
                "rtp": bm.rtp,
                "max_win": bm.max_win,
                "distributions": distributions,
            })

        math_config = {
            "game_id": config.game_id,
            "rtp": config.rtp,
            "wincap": config.wincap,
            "bet_modes": bet_modes,
        }

        filename = f"{self.out.configs_dir}/config_math.json"
        with open(filename, 'w') as f:
            json.dump(math_config, f, indent=2)
        print(f"  Written: {filename}")

    def _write_config_backend(self, config) -> None:
        """
        Backend config — consumed by the RGS.
        Contains mode info and SHA256 hashes for file integrity verification.
        """
        modes = []
        file_hashes = {}

        for bm in config.bet_modes:
            modes.append({
                "name": bm.name,
                "cost": bm.cost,
                "rtp": bm.rtp,
                "maxWin": bm.max_win,
            })

        # Calculate SHA256 hashes for all library files
        for root, dirs, files in os.walk(self.out.base_dir):
            for fname in files:
                if fname.endswith('.py'):
                    continue
                filepath = os.path.join(root, fname)
                rel_path = os.path.relpath(filepath, self.out.base_dir)
                file_hashes[rel_path] = self._sha256(filepath)

        backend_config = {
            "game_id": config.game_id,
            "modes": modes,
            "files": file_hashes,
        }

        filename = f"{self.out.configs_dir}/config.json"
        with open(filename, 'w') as f:
            json.dump(backend_config, f, indent=2)
        print(f"  Written: {filename}")

    @staticmethod
    def _sha256(filepath: str) -> str:
        """Calculate SHA256 hash of a file."""
        sha = hashlib.sha256()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha.update(chunk)
        return sha.hexdigest()
