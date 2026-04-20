from src.config.config import Config, BetMode, Distribution

class GameConfig(Config):
    def __init__(self):
        super().__init__()
        self.game_id = "sugar_rush_1000"
        self.provider_number = 1
        self.working_name = "Sweet Cluster 1000"
        self.wincap = 25000.0
        self.win_type = "cluster"
        self.rtp = 0.9653

        self.num_reels = 7
        self.num_rows = [7] * self.num_reels  

        self.basegame_type = "basegame"
        self.freegame_type = "freegame"

        # Special Special Symbols properties assignment
        # All valid symbols must be in either paytable or special_symbols
        self.special_symbols = {
            "scatter": ["S"],
            "wild": [],
        }

        self.include_padding = False

        # Cluster pays defining ranges: ((min, max), sym) -> float
        # Corresponds to 0-6: OrangeGummy, PurpleGummy, RedGummy, GreenCandy, PurpleCandy, OrangeCandy, PinkCandy
        self.pay_group = {
            # H1: Pink Candy (6)
            ((5, 5), "H1"): 1.00, ((6, 6), "H1"): 1.50, ((7, 7), "H1"): 1.75, ((8, 8), "H1"): 2.00, ((9, 9), "H1"): 2.50, ((10, 10), "H1"): 5.00, ((11, 11), "H1"): 7.50, ((12, 12), "H1"): 15.00, ((13, 14), "H1"): 35.00, ((15, 36), "H1"): 150.00,
            # H2: Orange Candy (5)
            ((5, 5), "H2"): 0.75, ((6, 6), "H2"): 1.00, ((7, 7), "H2"): 1.25, ((8, 8), "H2"): 1.50, ((9, 9), "H2"): 2.00, ((10, 10), "H2"): 4.00, ((11, 11), "H2"): 6.00, ((12, 12), "H2"): 12.50, ((13, 14), "H2"): 30.00, ((15, 36), "H2"): 100.00,
            # H3: Purple Candy (4)
            ((5, 5), "H3"): 0.50, ((6, 6), "H3"): 0.75, ((7, 7), "H3"): 1.00, ((8, 8), "H3"): 1.25, ((9, 9), "H3"): 1.50, ((10, 10), "H3"): 3.00, ((11, 11), "H3"): 4.50, ((12, 12), "H3"): 10.00, ((13, 14), "H3"): 20.00, ((15, 36), "H3"): 60.00,
            # H4: Green Candy (3)
            ((5, 5), "H4"): 0.40, ((6, 6), "H4"): 0.50, ((7, 7), "H4"): 0.75, ((8, 8), "H4"): 1.00, ((9, 9), "H4"): 1.25, ((10, 10), "H4"): 2.00, ((11, 11), "H4"): 3.00, ((12, 12), "H4"): 5.00, ((13, 14), "H4"): 10.00, ((15, 36), "H4"): 40.00,
            # L1: Red Gummy (2)
            ((5, 5), "L1"): 0.30, ((6, 6), "L1"): 0.40, ((7, 7), "L1"): 0.50, ((8, 8), "L1"): 0.75, ((9, 9), "L1"): 1.00, ((10, 10), "L1"): 1.50, ((11, 11), "L1"): 2.50, ((12, 12), "L1"): 3.50, ((13, 14), "L1"): 8.00, ((15, 36), "L1"): 30.00,
            # L2: Purple Gummy (1)
            ((5, 5), "L2"): 0.25, ((6, 6), "L2"): 0.30, ((7, 7), "L2"): 0.40, ((8, 8), "L2"): 0.50, ((9, 9), "L2"): 0.75, ((10, 10), "L2"): 1.25, ((11, 11), "L2"): 2.00, ((12, 12), "L2"): 3.00, ((13, 14), "L2"): 6.00, ((15, 36), "L2"): 25.00,
            # L3: Orange Gummy (0)
            ((5, 5), "L3"): 0.20, ((6, 6), "L3"): 0.25, ((7, 7), "L3"): 0.30, ((8, 8), "L3"): 0.40, ((9, 9), "L3"): 0.50, ((10, 10), "L3"): 1.00, ((11, 11), "L3"): 1.50, ((12, 12), "L3"): 2.50, ((13, 14), "L3"): 5.00, ((15, 36), "L3"): 20.00,
        }
        # Math SDK utility that unfolds the matrix into self.paytable
        self.paytable = self.convert_range_table(self.pay_group)

        # Scatters trigger Free Spins
        self.freespin_triggers = {
            self.basegame_type: {3: 10, 4: 12, 5: 15, 6: 20, 7: 30},
            self.freegame_type: {3: 10, 4: 12, 5: 15, 6: 20, 7: 30},
        }

        # Reelstrips paths configuration
        self.reels_path = "games/sugar_rush_1000/reels"
        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv", "SF0": "SF0.csv"}
        self.reels = {}
        # In actual SDK it reads real CSVs here. Emulating structure.
        for r, f in reels.items():
            # self.reels[r] = self.read_reels_csv(str.join("/", [self.reels_path, f]))
            pass

        # === BET MODES ===
        # 1. Standard Base Game
        # 2. Buy Free Spins (Cost: 100x)
        # 3. Super Free Spins (Cost: 500x)
        
        self.bet_modes = [
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
                        criteria="wincap",
                        quota=0.0001,
                        win_criteria=self.wincap,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "force_wincap": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame",
                        quota=0.049,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "scatter_triggers": {3: 20, 4: 10, 5: 2},
                            "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="0",
                        quota=0.45,
                        win_criteria=0.0,
                        conditions={"reel_weights": {self.basegame_type: {"BR0": 1}}},
                    ),
                    Distribution(
                        criteria="basegame",
                        quota=0.5009,
                        conditions={"reel_weights": {self.basegame_type: {"BR0": 1}}},
                    ),
                ],
            ),
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
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=self.wincap,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "force_wincap": True, "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame",
                        quota=0.999,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"FR0": 1}},
                            "scatter_triggers": {3: 20, 4: 10, 5: 2},
                            "force_freegame": True,
                        },
                    ),
                ],
            ),
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
                        criteria="freegame",
                        quota=1.0,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}, self.freegame_type: {"SF0": 1}},
                            "scatter_triggers": {3: 10},
                            "force_freegame": True,
                            # Inform custom code to seed multipliers internally
                        },
                    ),
                ],
            )
        ]
