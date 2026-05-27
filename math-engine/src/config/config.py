"""
Stake Engine SDK — Base Configuration Classes (Local Development Stubs)

In production, these are provided by the Carrot SDK.
For local development and testing, we implement the essential behavior.
"""

import csv
import os


class Config:
    """Base configuration class for all slot games."""

    def __init__(self):
        self.paytable = {}

    def convert_range_table(self, pay_group: dict) -> dict:
        """
        Unfold range-based pay_group into a flat lookup table.
        
        Input format:  ((min_size, max_size), "SYMBOL"): pay_value
        Output format: (size, "SYMBOL"): pay_value  (one entry per size)
        """
        flat = {}
        for (size_range, symbol), pay in pay_group.items():
            lo, hi = size_range
            for size in range(lo, hi + 1):
                flat[(size, symbol)] = pay
        return flat

    def read_reels_csv(self, filepath: str) -> list:
        """
        Read a reel strip CSV file.
        
        Format: Each row is one stop position, each column is one reel.
        Returns: list of lists — reels[reel_index] = [symbol, symbol, ...]
        """
        if not os.path.exists(filepath):
            print(f"[Config] Warning: Reel file not found: {filepath}")
            return []

        reels = []
        with open(filepath, "r") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if not rows:
            return []

        # Transpose: rows → columns (each column = one reel)
        num_reels = len(rows[0])
        for col in range(num_reels):
            reel = []
            for row in rows:
                if col < len(row):
                    reel.append(row[col].strip())
            reels.append(reel)

        return reels


class Distribution:
    """
    Defines a probability distribution bucket for the RNG system.
    
    The SDK uses these to pre-sort outcomes into categories:
    - "wincap": forced max-win outcomes
    - "freegame": forced free-game triggers
    - "basegame": normal base game outcomes
    - "0": forced zero-win outcomes
    """

    def __init__(self, criteria="", quota=0.0, win_criteria=None, conditions=None):
        self.criteria = criteria
        self.quota = quota
        self.win_criteria = win_criteria
        self.conditions = conditions or {}


class BetMode:
    """
    Defines a betting mode with its cost, RTP, and outcome distributions.
    
    Modes for Sugar Blast 1000:
    - "base": standard play (cost=1x)
    - "ante": ante bet (cost=1.25x, 2x scatter chance)
    - "bonus": buy free spins (cost=100x)
    - "super": buy super free spins (cost=500x, x2 starting multipliers)
    """

    def __init__(self, name="", cost=1.0, rtp=0.96, max_win=25000,
                 auto_close_disabled=False, is_feature=False, is_buybonus=False,
                 distributions=None, ante_scatter_multiplier=1.0):
        self.name = name
        self.cost = cost
        self.rtp = rtp
        self.max_win = max_win
        self.auto_close_disabled = auto_close_disabled
        self.is_feature = is_feature
        self.is_buybonus = is_buybonus
        self.distributions = distributions or []
        self.ante_scatter_multiplier = ante_scatter_multiplier
