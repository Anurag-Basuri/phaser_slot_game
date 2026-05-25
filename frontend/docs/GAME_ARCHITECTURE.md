# 🎰 Sugar Blast 1000 — Game Architecture & Technical Specifications

This document outlines the entire technical structure, mathematical constraints, software architecture, and production configuration for **Sugar Blast 1000**. It is intended for developers, game mathematicians, and Stake RGS integration engineers as the ultimate source of truth for the codebase.

---

## 1. High-Level Architecture
**Sugar Blast 1000** is built using a strict Client-Server decoupled architecture, enforcing standard Remote Game Server (RGS) compliance.

1. **Frontend Renderer (Client):** `React` (UI / Layout) + `Phaser 3` (Canvas/WebGL Rendering Engine)
2. **Game Logic (Server):** Python 3 Monte Carlo Simulator & Matrix outcomes (Stake RGS compatible payload)

**Core Principle:** The frontend *never* generates a random cluster outcome, a scatter hit, or a win amount. The mathematics reside purely on the backend. The client acts solely as an elaborate, animated renderer for `SpinEventData` JSON objects provided by the server.

---

## 2. Core Game Loop & State Flow

The mounting and spin execution sequence:

1. `Game.tsx` boots the Phaser instance (`new Phaser.Game(config)`).
2. The `StakeEngineClient` authenticates via query parameters (e.g. `?sessionID=xxx`). The player's balance and configuration are populated.
3. **The Spin Cycle:**
   - Player taps "Spin" (or hits Spacebar).
   - Client verifies balance and triggers `StakeEngineClient.play()`.
   - The UI temporarily locks, and anticipation animations (shimmer) begin if necessary.
   - The backend `play` mutation computes a random grid, evaluates the cascade, advances multipliers, deducts the bet, credits any win, and returns the final serialized matrix history to the client.
   - The React layer passes this `SpinEventData` layout into the Phaser `Grid.ts`.
4. **The Render Cycle:**
   - `Grid.ts` iterates over the server-provided 7×7 array.
   - Initial symbols fall from the sky.
   - `ClusterEvaluator.ts` parses the *visual* clusters on the board, triggers explosion animations, records the multiplier stamps over the win locations, drops the cascade, and loops until the board is clear of wins.
   - If scatters ≥ 3, the Free Spins cinematic triggers immediately.

---

## 3. Mathematical Specifications

### Configurations and Odds
- **RTP (Return to Player):** `95.30%` (Validated over 200,000 spins computationally)
- **Volatility:** `High` (Hit Rate: ~34.34%)
- **Max Win Cap:** `25,000×` Bet
- **Grid Layout:** `7×7` Matrix
- **Win Execution:** Cluster Pays (minimum 5 adjacent identical orthogonal symbols; Scatters don't require adjacency).

### Symbol Matrix (Paytable Scale)
There are 7 standard symbols and 1 Scatter symbol. Bet multipliers scale as the cluster size grows (max tier: 15+).

*Calculated base scalar for 95.30% RTP:* `~0.62x` compared to original 100% prototypes.
```json
[
  // 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15+ 
  [0.12, 0.16, 0.19, 0.25, 0.31, 0.62, 0.93, 1.55, 3.10, ...], // Red Gummy Bear
  [0.62, 0.93, 1.09, 1.24, 1.55, 3.10, 4.65, 9.30, 21.70, ...] // Blue Gumdrop (Max)
]
```

### The Persistent Multiplier Map
If Symbol ID `X` detonates at Matrix index `[Row][Col]`, the board imprints a multiplier "stamp". 
- **1st hit:** Creates a wrapper (visible ×1 boundary).
- **2nd hit:** Upgrades wrapper to `×2`.
- **Subsequent hits:** Doubled (×4, ×8, ×16 ... hard-capped at `×1024`).

If a single cluster overlaps multiple multiplier stamps, those values are **SUMMED** (e.g., `x4 + x2 = x6`), and then multiplied against the symbol base bet.

**Persistence:**
- *Base Game:* Stamps wipe clean upon the end of a tumbling sequence (next spin).
- *Free Spins:* Stamps NEVER wipe until the final free spin concludes.

---

## 4. Special Features Mechanics

### Free Spin Triggers
Scatters (ID 7) land randomly anywhere on the board.
- **3 Scatters:** 10 Spins
- **4 Scatters:** 15 Spins
- **5 Scatters:** 20 Spins
- **6 Scatters:** 25 Spins
- **7 Scatters:** 30 Spins

*Retrigger constraint:* A single bonus round can retrigger indefinitely but is mathematically constrained by python simulation limiters (`max_total_spins = 50`) to avoid RTP explosion and computational hangup. Retriggers grant `+5` spins instead of triggering the full array again (preventing compounding escalation).

### Buy Features (Premium Bonus)
1. **Regular Buy (100× Bet):** Seeds 10 Free Spins identically to hitting 3 random scatters organically.
2. **Super Buy (500× Bet):** Seeds 10 Free Spins, but forces `×2` to `×16` multipliers permanently baked into the 3×3 center matrix of the game board prior to the very first drop. *Extreme volatility profile.*

### Ante Bet (25% Premium)
If a player wagers `1.00`, enabling Ante bet brings the physical cost to `1.25`, but the paytable evaluates prizes based only on the `1.00` base bet. In return, the internal `Scatter Probability Weight` is strictly doubled (e.g. from 2% to 4% RNG distribution weight), doubling the frequency of natural Free Spin hits.

---

## 5. Directory Mapping & File Definitions

* `/src/scenes/`
  * `Boot.tsx`: Asset preloading (sprites, fonts) and splash screen sequence.
  * `Game.tsx`: The primary React-Phaser bridge. Mounts the UI overlays, listens to global keyboard events, and governs the Spin cycle API requests.
* `/src/components/`
  * `Grid.ts`: The massive rendering core. Handles grid arrays, tumbling gravity physics (`evaluateAndCascade()`), tween scaling, and multiplier grid rendering.
  * `WinCelebration.ts`: Renders "Big Win", "Mega Win" graphics based on mathematical thresholds (e.g. `payout >= bet * 50`).
  * `FreeSpinsIntro.ts`: A custom UI modal blocking the game loop to display cinematic entry into the bonus.
  * `PaytableOverlay.ts` & `SettingsOverlay.ts`: Interactive HTML-layered menus for rules, sound mixing, and fast-play toggling.
  * `ConfirmDialog.ts`: Crucial UX modal demanding "YES/NO" interactions to block accidental bonus buys.
* `/src/engine/StakeEngineClient.ts`: Mocked WebSockets/HTTPS abstraction. Decodes URL parameters, establishes session validity, and shapes request models exactly as Stake expects.
* `/math-engine/`: The Python proving ground. `run.py` generates millions of spins in seconds to validate RTP distributions. `game_config.py` is the mutable JSON source-of-truth.

## 6. Disconnect Resilience
Because RGS calls deduct real money *instantly*, the client must handle catastrophic UI failure (closing tab mid-spin).
- The `StakeEngineClient` intercepts an uncompleted Round ID upon rebooting (`sessionID` ping).
- It injects the `SpinEventData` directly back into the Phaser initialization stage.
- The `Grid` accelerates through the tumble visually or immediately prints the final payout block without charging the player again.

---

*This architecture document constitutes the foundation for continuous deployment. Modify any RGS JSON payload structures strictly in accordance with these definitions.*
