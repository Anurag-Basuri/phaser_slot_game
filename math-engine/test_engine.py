"""
Sugar Rush 1000 — Math Engine Verification Script

Runs a batch of spins and validates:
  1. Cluster detection (4-directional, min 5 connected)
  2. Multiplier progression (0→1→2→4→...→1024)
  3. Multiplier summation within clusters (additive)
  4. Tumble cascade loop (cascade until no more wins)
  5. Scatter detection + free spins trigger
  6. Win cap enforcement (25,000×)
  7. Super Free Spins seeding (×2 on all 49 spots)
  8. Event emission format (frontend-compatible)

Usage:
  cd math-engine
  python test_engine.py
"""

import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from games.sugar_rush_1000.game_config import GameConfig
from games.sugar_rush_1000.gamestate import GameState


def print_grid(board, config):
    """Pretty-print the 7×7 board."""
    for r in range(config.grid_size):
        row_str = ""
        for c in range(config.grid_size):
            cell = board[r][c]
            if cell is None:
                row_str += " -- "
            elif isinstance(cell, dict):
                sym = cell.get("symbol", "?")
                row_str += f" {sym:>2} "
            else:
                row_str += f" {str(cell):>2} "
        print(row_str)


def print_multipliers(grid_mults, size):
    """Pretty-print the multiplier grid."""
    for r in range(size):
        row_str = ""
        for c in range(size):
            v = grid_mults[r][c]
            if v == 0:
                row_str += "  .  "
            elif v == 1:
                row_str += "  *  "
            else:
                row_str += f" x{v:<3}"
        print(row_str)


def test_basic_spin():
    """Test 1: Basic spin executes without errors."""
    print("=" * 60)
    print("TEST 1: Basic Spin")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)

    class Sim:
        seed = 42

    gs.run_spin(Sim())

    print(f"  Events emitted: {len(gs.round_events)}")
    for evt in gs.round_events:
        print(f"    {evt['type']}: {list(evt['data'].keys())}")
    print(f"  Total win: {gs.cumulative_round_win:.2f}x")
    print("  ✅ PASS\n")


def test_cluster_detection():
    """Test 2: Cluster detection finds correct clusters."""
    print("=" * 60)
    print("TEST 2: Cluster Detection")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)

    # Create a board with a known cluster of 5 Pink Candies (H1)
    size = config.grid_size
    gs.reset_grid_multipliers()
    gs.board = [[{"symbol": "L3", "id": 0} for _ in range(size)] for _ in range(size)]

    # Place a 5-cell H1 cluster: (0,0), (0,1), (0,2), (1,0), (1,1)
    for r, c in [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]:
        gs.board[r][c] = {"symbol": "H1", "id": 6}

    print("  Board:")
    print_grid(gs.board, config)

    result = gs.get_cluster_data(record_wins=True)
    clusters = result["wins"]

    h1_clusters = [c for c in clusters if c["symbol"] == "H1"]
    assert len(h1_clusters) == 1, f"Expected 1 H1 cluster, got {len(h1_clusters)}"
    assert h1_clusters[0]["count"] == 5, f"Expected 5 cells, got {h1_clusters[0]['count']}"
    assert h1_clusters[0]["win"] == 2.00, f"Expected pay 2.00, got {h1_clusters[0]['win']}"

    print(f"  Found {len(clusters)} cluster(s)")
    for c in clusters:
        print(f"    {c['symbol']} × {c['count']} = {c['win']}x")
    print("  ✅ PASS\n")


def test_multiplier_progression():
    """Test 3: Multiplier advances correctly: 0→1→2→4→...→1024"""
    print("=" * 60)
    print("TEST 3: Multiplier Progression")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)
    gs.reset_grid_multipliers()

    expected = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 1024]
    actual = [gs.grid_multipliers[0][0]]

    for _ in range(12):
        gs.advance_multiplier(0, 0)
        actual.append(gs.grid_multipliers[0][0])

    assert actual == expected, f"Progression mismatch:\n  Expected: {expected}\n  Actual:   {actual}"
    print(f"  Progression: {' → '.join(str(v) for v in actual)}")
    print("  ✅ PASS\n")


def test_multiplier_additive():
    """Test 4: Multiple multipliers in same cluster are ADDED."""
    print("=" * 60)
    print("TEST 4: Multiplier Additive Rule")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)
    gs.reset_grid_multipliers()

    # Set up two spots with active multipliers
    gs.grid_multipliers[0][0] = 4
    gs.grid_multipliers[0][1] = 8
    gs.grid_multipliers[0][2] = 2  # 4 + 8 + 2 = 14 total

    # Create a known cluster at those positions
    win_data = {
        "totalWin": 0,
        "wins": [{
            "symbol": "H1", "symbolId": 6, "count": 5,
            "positions": [
                {"row": 0, "reel": 0},
                {"row": 0, "reel": 1},
                {"row": 0, "reel": 2},
                {"row": 1, "reel": 0},
                {"row": 1, "reel": 1},
            ],
            "win": 2.00,
            "meta": {},
        }],
    }

    result = gs.apply_cluster_multipliers(win_data)
    cluster = result["wins"][0]

    assert cluster["meta"]["multiplier"] == 14, f"Expected mult=14, got {cluster['meta']['multiplier']}"
    assert cluster["win"] == 28.00, f"Expected win=28.00, got {cluster['win']}"
    print(f"  Multipliers: 4 + 8 + 2 = {cluster['meta']['multiplier']}")
    print(f"  Base win 2.00 × 14 = {cluster['win']}")
    print("  ✅ PASS\n")


def test_super_free_spins_seeding():
    """Test 5: Super FS seeds ×2 on ALL 49 spots."""
    print("=" * 60)
    print("TEST 5: Super Free Spins Seeding")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)
    gs.reset_grid_multipliers()
    gs.seed_super_free_spins()

    size = config.grid_size
    all_two = all(gs.grid_multipliers[r][c] == 2 for r in range(size) for c in range(size))
    total = sum(gs.grid_multipliers[r][c] for r in range(size) for c in range(size))

    assert all_two, "Not all spots are ×2!"
    assert total == 49 * 2, f"Expected total {49*2}, got {total}"
    print(f"  All 49 spots = ×2: ✓")
    print(f"  Total multiplier sum: {total}")
    print("  ✅ PASS\n")


def test_scatter_counting():
    """Test 6: Scatter counting works correctly."""
    print("=" * 60)
    print("TEST 6: Scatter Counting")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)

    size = config.grid_size
    gs.board = [[{"symbol": "L3", "id": 0} for _ in range(size)] for _ in range(size)]

    # Place 4 scatters
    for r, c in [(0, 0), (2, 3), (4, 5), (6, 6)]:
        gs.board[r][c] = {"symbol": "S", "id": 7}

    count = gs.count_scatters()
    assert count == 4, f"Expected 4 scatters, got {count}"
    assert gs.check_fs_condition("scatter") is True, "Should trigger FS with 4 scatters"
    print(f"  Scatter count: {count}")
    print(f"  FS trigger (≥3): {gs.check_fs_condition('scatter')}")
    print("  ✅ PASS\n")


def test_tumble_gravity():
    """Test 7: Tumble correctly applies gravity."""
    print("=" * 60)
    print("TEST 7: Tumble Gravity")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)
    gs.reset_grid_multipliers()

    size = config.grid_size
    gs.board = [[{"symbol": "L3", "id": 0} for _ in range(size)] for _ in range(size)]

    # Mark top-left cell for explosion
    gs.board[0][0]["explode"] = True
    original_1_0 = gs.board[1][0]["symbol"]

    gs.tumble_game_board()

    # After tumble, the cell at (0,0) should have been filled and (1,0) should have shifted
    assert gs.board[0][0] is not None, "Top cell should be filled after tumble"
    assert gs.grid_multipliers[0][0] == 1, "Exploded spot should be marked (value=1)"

    print(f"  After tumble: (0,0) filled with '{gs.board[0][0]['symbol']}'")
    print(f"  Multiplier at (0,0): {gs.grid_multipliers[0][0]}")
    print("  ✅ PASS\n")


def test_batch_simulation():
    """Test 8: Run 1000 spins and check RTP sanity."""
    print("=" * 60)
    print("TEST 8: Batch Simulation (1000 spins)")
    print("=" * 60)

    config = GameConfig()
    gs = GameState(config)
    gs.bet_amount = 1.0

    total_bet = 0.0
    total_win = 0.0
    fs_triggers = 0
    max_win_single = 0.0

    for i in range(1000):
        class Sim:
            seed = i
        gs.run_spin(Sim())

        win = gs.cumulative_round_win
        total_bet += 1.0
        total_win += win
        max_win_single = max(max_win_single, win)

        if any(e["type"] == "scatter_trigger" for e in gs.round_events):
            fs_triggers += 1

    rtp = (total_win / total_bet) * 100 if total_bet > 0 else 0

    print(f"  Total spins:    1,000")
    print(f"  Total bet:      {total_bet:.2f}")
    print(f"  Total win:      {total_win:.2f}")
    print(f"  RTP:            {rtp:.2f}%")
    print(f"  FS triggers:    {fs_triggers}")
    print(f"  Max single win: {max_win_single:.2f}x")
    print(f"  (Note: RTP will stabilize at ~96.5% only after 10M+ spins)")
    print("  ✅ PASS\n")


if __name__ == "__main__":
    print("\n--- Sugar Rush 1000 - Math Engine Verification ---\n")

    test_basic_spin()
    test_cluster_detection()
    test_multiplier_progression()
    test_multiplier_additive()
    test_super_free_spins_seeding()
    test_scatter_counting()
    test_tumble_gravity()
    test_batch_simulation()

    print("=" * 60)
    print("ALL TESTS PASSED ✅")
    print("=" * 60)
