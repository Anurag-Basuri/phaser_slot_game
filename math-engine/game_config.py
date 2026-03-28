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
    [0.38, 0.48, 0.57, 0.76, 0.95, 1.90, 2.85, 4.75, 9.50, 19.00, 38.00],   # 0: Red Bear (lowest)
    [0.48, 0.57, 0.76, 0.95, 1.43, 2.38, 3.80, 5.70, 11.40, 22.80, 47.50],  # 1: Yellow Star
    [0.57, 0.76, 0.95, 1.43, 1.90, 2.85, 4.75, 6.65, 15.20, 28.50, 57.00],  # 2: Purple Bean
    [0.76, 0.95, 1.43, 1.90, 2.38, 3.80, 5.70, 9.50, 19.00, 38.00, 76.00],  # 3: Green Candy
    [0.95, 1.43, 1.90, 2.38, 2.85, 5.70, 8.55, 19.00, 38.00, 76.00, 114.00],# 4: Pink Heart
    [1.43, 1.90, 2.38, 2.85, 3.80, 7.60, 11.40, 23.75, 57.00, 114.00, 190.00],# 5: Orange Slice
    [1.90, 2.85, 3.33, 3.80, 4.75, 9.50, 14.25, 28.50, 66.50, 133.00, 285.00], # 6: Blue Gumdrop (highest)
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
RTP_TOLERANCE = 0.001  # ±0.1%

# --- VOLATILITY ---
# High volatility slot
MAX_WIN_MULTIPLIER = 25000  # Maximum win cap: 25,000x bet
