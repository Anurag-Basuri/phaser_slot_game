"""
Sweet Cluster 1000 — Game Configuration
Defines all symbols, paytable, weights, and game mechanics.
This is the "math book" for the slot game.

Game Type: 7x7 Cascading Cluster Pays
Theme: Candy/Sweet
Target RTP: 96.00%
Max Win: 25,000x bet
"""

# Grid dimensions
GRID_ROWS = 7
GRID_COLS = 7

# Minimum cluster size to trigger a win
MIN_CLUSTER_SIZE = 5

# --- SYMBOL DEFINITIONS ---
# ID: (name, is_scatter)
SYMBOLS = {
    0: ("Red Gummy Bear", False),
    1: ("Yellow Star Candy", False),
    2: ("Purple Jelly Bean", False),
    3: ("Green Square Candy", False),
    4: ("Pink Heart Candy", False),
    5: ("Orange Slice Candy", False),
    6: ("Blue Gumdrop", False),
    7: ("Scatter Lollipop", True),
}

# --- SYMBOL WEIGHTS ---
# Higher weight = appears more often. Must sum to 100 for regular symbols.
SYMBOL_WEIGHTS = [18, 17, 16, 14, 13, 12, 10]  # IDs 0-6

# Scatter probability per cell (independent of regular weights)
SCATTER_CHANCE = 0.020  # 2.0% per cell

# --- PAYTABLE ---
# Multipliers of the bet amount for cluster sizes 5 through 15+
# Each row is a symbol ID (0-6), columns are cluster tiers
PAYTABLE = [
    # Cluster size:  5     6     7     8     9    10    11    12    13    14    15+
    [0.12, 0.16, 0.19, 0.25, 0.31, 0.62, 0.93, 1.55, 3.10, 6.20, 12.40],    # 0: Red Bear (lowest)
    [0.16, 0.19, 0.25, 0.31, 0.46, 0.78, 1.24, 1.86, 3.72, 7.44, 15.50],    # 1: Yellow Star
    [0.19, 0.25, 0.31, 0.46, 0.62, 0.93, 1.55, 2.17, 4.96, 9.30, 18.60],    # 2: Purple Bean
    [0.25, 0.31, 0.46, 0.62, 0.78, 1.24, 1.86, 3.10, 6.20, 12.40, 24.80],   # 3: Green Candy
    [0.31, 0.46, 0.62, 0.78, 0.93, 1.86, 2.79, 6.20, 12.40, 24.80, 37.20],  # 4: Pink Heart
    [0.46, 0.62, 0.78, 0.93, 1.24, 2.48, 3.72, 7.75, 18.60, 37.20, 62.00],  # 5: Orange Slice
    [0.62, 0.93, 1.09, 1.24, 1.55, 3.10, 4.65, 9.30, 21.70, 43.40, 93.00],  # 6: Blue Gumdrop (highest)
]

# --- FREE SPINS ---
# Scatter count -> free spins awarded
FREE_SPINS_BY_SCATTER = {
    3: 10,
    4: 15,
    5: 20,
    6: 25,
    7: 30,
}

# --- BUY FEATURES ---
BUY_REGULAR_COST = 100  # x bet amount
BUY_REGULAR_SPINS = 10
BUY_SUPER_COST = 500    # x bet amount
BUY_SUPER_SPINS = 10
BUY_SUPER_SEED_MULTIPLIERS = [
    (3, 3, 16), (2, 3, 8), (4, 3, 8),
    (3, 2, 8), (3, 4, 8),
    (2, 2, 4), (2, 4, 4), (4, 2, 4), (4, 4, 4),
]

# --- ANTE BET ---
# When enabled: costs 25% more per spin, doubles scatter probability
ANTE_BET_COST_MULTIPLIER = 1.25
ANTE_BET_SCATTER_MULTIPLIER = 2.0   # SCATTER_CHANCE becomes 0.04 (4%)
ANTE_BET_ENABLED_DEFAULT = False

# --- MULTIPLIER PROGRESSION ---
# When a position is part of a winning cluster:
# No multiplier -> x1 wrapper (displays x1)
# x1 wrapper -> x2
# x2 -> x4
# x4 -> x8 ... up to x1024
# Multipliers are persistent during free spins
MULTIPLIER_PROGRESSION = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
MAX_MULTIPLIER = 1024

# --- RTP TARGET ---
TARGET_RTP = 0.9600  # 96.00%
RTP_TOLERANCE = 0.005  # ±0.5%

# --- VOLATILITY ---
# High volatility slot
MAX_WIN_MULTIPLIER = 25000  # Maximum win cap: 25,000x bet
