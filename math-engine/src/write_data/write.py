import os
import json
import zstandard as zstd
import csv

class OutputFiles:
    def __init__(self, game_id: str):
        self.base_dir = f"games/{game_id}/library"
        self.books_dir = f"{self.base_dir}/books"
        self.books_compressed_dir = f"{self.base_dir}/books_compressed"
        self.configs_dir = f"{self.base_dir}/configs"
        self.forces_dir = f"{self.base_dir}/forces"
        self.lookup_dir = f"{self.base_dir}/lookup_tables"
        
        for d in [self.books_dir, self.books_compressed_dir, self.configs_dir, self.forces_dir, self.lookup_dir]:
            os.makedirs(d, exist_ok=True)

class WriteData:
    def __init__(self, game_id: str):
        self.out = OutputFiles(game_id)
        
    def write_compressed_book(self, betmode_name: str, simulations: list):
        """
        Writes zStandard compressed JSON-lines (__.jsonl.zst)
        Required format: {"id": <int>, "events": <list<dict>>, "payoutMultiplier": <int>}
        """
        filename = f"{self.out.books_compressed_dir}/books_{betmode_name}.jsonl.zst"
        
        cctx = zstd.ZstdCompressor()
        with open(filename, 'wb') as f:
            with cctx.stream_writer(f) as compressor:
                for sim in simulations:
                    line = json.dumps({
                        "id": sim["id"],
                        "events": sim["events"],
                        "payoutMultiplier": int(sim["payoutMultiplier"] * 100) # Assuming scaling needed, or just int
                    }) + "\n"
                    compressor.write(line.encode('utf-8'))
        return f"books_{betmode_name}.jsonl.zst"
        
    def write_lookup_table(self, betmode_name: str, simulations: list):
        """
        Writes lookUpTable.csv
        Format: simulation number, round probability, payout multiplier
        (All uint64)
        """
        filename = f"{self.out.lookup_dir}/lookUpTable_{betmode_name}_0.csv"
        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            # weight is initialized to 1 for all
            for sim in simulations:
                writer.writerow([sim["id"], 1, int(sim["payoutMultiplier"] * 100)])
        return f"lookUpTable_{betmode_name}_0.csv"

    def write_index(self, modes_data: list):
        """
        Writes the required index.json file for RGS math upload.
        """
        index_data = {"modes": modes_data}
        with open(f"{self.out.base_dir}/index.json", 'w') as f:
            json.dump(index_data, f, indent=4)
            
    def generate_configs(self, config_obj):
        """Generates frontend, math, and backend configs."""
        with open(f"{self.out.configs_dir}/config_fe.json", 'w') as f:
            json.dump({"game_id": config_obj.game_id}, f)
        with open(f"{self.out.configs_dir}/config_math.json", 'w') as f:
            json.dump({"rtp": config_obj.rtp}, f)
        with open(f"{self.out.configs_dir}/config.json", 'w') as f:
            json.dump({"modes": [m.name for m in config_obj.bet_modes]}, f)
