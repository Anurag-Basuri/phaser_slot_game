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
    0: ("Orange Gummy Bear", False),
    1: ("Purple Gummy Bear", False),
    2: ("Red Gummy Bear", False),
    3: ("Green Candy", False),
    4: ("Purple Candy", False),
    5: ("Orange Candy", False),
    6: ("Pink Candy", False),
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
    [0.20, 0.25, 0.30, 0.40, 0.50, 1.00, 1.50, 2.50, 5.00, 10.00, 20.00],    # 0: Orange Gummy Bear
    [0.25, 0.30, 0.40, 0.50, 0.75, 1.25, 2.00, 3.00, 6.00, 12.00, 25.00],    # 1: Purple Gummy Bear
    [0.30, 0.40, 0.50, 0.75, 1.00, 1.50, 2.50, 3.50, 8.00, 15.00, 30.00],    # 2: Red Gummy Bear
    [0.40, 0.50, 0.75, 1.00, 1.25, 2.00, 3.00, 5.00, 10.00, 20.00, 40.00],   # 3: Green Candy
    [0.50, 0.75, 1.00, 1.25, 1.50, 3.00, 4.50, 10.00, 20.00, 40.00, 60.00],  # 4: Purple Candy
    [0.75, 1.00, 1.25, 1.50, 2.00, 4.00, 6.00, 12.50, 30.00, 60.00, 100.00], # 5: Orange Candy
    [1.00, 1.50, 1.75, 2.00, 2.50, 5.00, 7.50, 15.00, 35.00, 70.00, 150.00], # 6: Pink Candy
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
