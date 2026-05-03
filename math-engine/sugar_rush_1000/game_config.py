from src.config.config import Config, BetMode, Distribution


class GameConfig(Config):
    def __init__(self):
        super().__init__()
        self.game_id = "sugar_rush_1000"
        self.provider_number = 1
        self.working_name = "Sugar Rush 1000"
        self.wincap = 25000.0
        self.win_type = "cluster"
        self.rtp = 0.9653

        self.num_reels = 7
        self.num_rows = [7] * self.num_reels
        self.grid_size = 7

        self.basegame_type = "basegame"
        self.freegame_type = "freegame"

        # Symbols: H1-H4 = high pay, L1-L3 = low pay, S = scatter
        # No wild symbol in Sugar Rush 1000
        self.special_symbols = {
            "scatter": ["S"],
        }

        # Symbol ID mapping (frontend ↔ backend)
        self.symbol_ids = {
            "L3": 0,  # Orange Gummy Bear
            "L2": 1,  # Purple Gummy Bear
            "L1": 2,  # Red Gummy Bear
            "H4": 3,  # Green Candy
            "H3": 4,  # Purple Candy
            "H2": 5,  # Orange Candy
            "H1": 6,  # Pink Candy
            "S": 7,   # Scatter
        }

        # Reverse lookup
        self.id_to_symbol = {v: k for k, v in self.symbol_ids.items()}

        # ──────────────────────────────────────────────────────
        # PAYTABLE — Official Sugar Rush 1000 (verified)
        # Values are multipliers of bet amount per cluster size
        # Doubled from original to match Pragmatic Play reference
        # ──────────────────────────────────────────────────────
        self.pay_group = {
            # H1: Pink Candy (ID 6) — highest paying
            ((5, 5), "H1"): 2.00, ((6, 6), "H1"): 3.00, ((7, 7), "H1"): 3.50,
            ((8, 8), "H1"): 4.00, ((9, 9), "H1"): 5.00, ((10, 10), "H1"): 10.00,
            ((11, 11), "H1"): 15.00, ((12, 12), "H1"): 30.00,
            ((13, 13), "H1"): 70.00, ((14, 14), "H1"): 140.00, ((15, 49), "H1"): 300.00,

            # H2: Orange Candy (ID 5)
            ((5, 5), "H2"): 1.50, ((6, 6), "H2"): 2.00, ((7, 7), "H2"): 2.50,
            ((8, 8), "H2"): 3.00, ((9, 9), "H2"): 4.00, ((10, 10), "H2"): 8.00,
            ((11, 11), "H2"): 12.00, ((12, 12), "H2"): 25.00,
            ((13, 13), "H2"): 60.00, ((14, 14), "H2"): 120.00, ((15, 49), "H2"): 200.00,

            # H3: Purple Candy (ID 4)
            ((5, 5), "H3"): 1.00, ((6, 6), "H3"): 1.50, ((7, 7), "H3"): 2.00,
            ((8, 8), "H3"): 2.50, ((9, 9), "H3"): 3.00, ((10, 10), "H3"): 6.00,
            ((11, 11), "H3"): 9.00, ((12, 12), "H3"): 20.00,
            ((13, 13), "H3"): 40.00, ((14, 14), "H3"): 80.00, ((15, 49), "H3"): 120.00,

            # H4: Green Candy (ID 3)
            ((5, 5), "H4"): 0.80, ((6, 6), "H4"): 1.00, ((7, 7), "H4"): 1.50,
            ((8, 8), "H4"): 2.00, ((9, 9), "H4"): 2.50, ((10, 10), "H4"): 4.00,
            ((11, 11), "H4"): 6.00, ((12, 12), "H4"): 10.00,
            ((13, 13), "H4"): 20.00, ((14, 14), "H4"): 40.00, ((15, 49), "H4"): 80.00,

            # L1: Red Gummy Bear (ID 2)
            ((5, 5), "L1"): 0.60, ((6, 6), "L1"): 0.80, ((7, 7), "L1"): 1.00,
            ((8, 8), "L1"): 1.50, ((9, 9), "L1"): 2.00, ((10, 10), "L1"): 3.00,
            ((11, 11), "L1"): 5.00, ((12, 12), "L1"): 7.00,
            ((13, 13), "L1"): 16.00, ((14, 14), "L1"): 30.00, ((15, 49), "L1"): 60.00,

            # L2: Purple Gummy Bear (ID 1)
            ((5, 5), "L2"): 0.50, ((6, 6), "L2"): 0.60, ((7, 7), "L2"): 0.80,
            ((8, 8), "L2"): 1.00, ((9, 9), "L2"): 1.50, ((10, 10), "L2"): 2.50,
            ((11, 11), "L2"): 4.00, ((12, 12), "L2"): 6.00,
            ((13, 13), "L2"): 12.00, ((14, 14), "L2"): 24.00, ((15, 49), "L2"): 50.00,

            # L3: Orange Gummy Bear (ID 0) — lowest paying
            ((5, 5), "L3"): 0.40, ((6, 6), "L3"): 0.60, ((7, 7), "L3"): 0.80,
            ((8, 8), "L3"): 1.00, ((9, 9), "L3"): 1.00, ((10, 10), "L3"): 2.00,
            ((11, 11), "L3"): 3.00, ((12, 12), "L3"): 5.00,
            ((13, 13), "L3"): 10.00, ((14, 14), "L3"): 20.00, ((15, 49), "L3"): 40.00,
        }
        # SDK utility: unfolds range-based pay_group into flat self.paytable
        self.paytable = self.convert_range_table(self.pay_group)

        # Scatter → Free Spins mapping (same for base and free game)
        self.freespin_triggers = {
            self.basegame_type: {3: 10, 4: 12, 5: 15, 6: 20, 7: 30},
            self.freegame_type: {3: 10, 4: 12, 5: 15, 6: 20, 7: 30},
        }

        # Scatter base probability per cell (used in draw_board)
        self.scatter_chance = 0.02       # 2.0% base
        self.scatter_chance_ante = 0.04  # 4.0% with Ante Bet

        # Symbol spawn weights (must match frontend options.ts)
        # Higher weight = more common. Sum = 100.
        self.symbol_weights = {
            "L3": 19, "L2": 17, "L1": 16,
            "H4": 14, "H3": 13, "H2": 12, "H1": 9,
        }

        # Min cluster size for a win
        self.min_cluster_size = 5

        # Multiplier cap
        self.max_multiplier = 1024

        # Reelstrip paths
        self.reels_path = "games/sugar_rush_1000/reels"
        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv", "SF0": "SF0.csv"}
        self.reels = {}
        for r, f in reels.items():
            self.reels[r] = self.read_reels_csv(f"{self.reels_path}/{f}")

        # ──────────────────────────────────────────────────────
        # BET MODES
        # ──────────────────────────────────────────────────────
        self.bet_modes = [
            # 1. Standard Base Game
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(
                        criteria="wincap", quota=0.0001,
                        win_criteria=self.wincap,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "force_wincap": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame", quota=0.049,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "scatter_triggers": {3: 20, 4: 10, 5: 2},
                            "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="0", quota=0.45,
                        win_criteria=0.0,
                        conditions={"reel_weights": {self.basegame_type: {"BR0": 1}}},
                    ),
                    Distribution(
                        criteria="basegame", quota=0.5009,
                        conditions={"reel_weights": {self.basegame_type: {"BR0": 1}}},
                    ),
                ],
            ),

            # 2. Ante Bet (25% more cost, 2x scatter chance)
            BetMode(
                name="ante",
                cost=1.25,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                ante_scatter_multiplier=2.0,
                distributions=[
                    Distribution(
                        criteria="basegame", quota=1.0,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "scatter_chance_override": self.scatter_chance_ante,
                        },
                    ),
                ],
            ),

            # 3. Buy Free Spins (100x cost)
            BetMode(
                name="bonus",
                cost=100.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=False,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap", quota=0.001,
                        win_criteria=self.wincap,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "force_wincap": True, "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame", quota=0.999,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "scatter_triggers": {3: 20, 4: 10, 5: 2},
                            "force_freegame": True,
                        },
                    ),
                ],
            ),

            # 4. Super Free Spins (500x cost, x2 starting multipliers on ALL spots)
            BetMode(
                name="super",
                cost=500.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=False,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="freegame", quota=1.0,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"SF0": 1}},
                            "scatter_triggers": {3: 10},
                            "force_freegame": True,
                        },
                    ),
                ],
            ),
        ]
