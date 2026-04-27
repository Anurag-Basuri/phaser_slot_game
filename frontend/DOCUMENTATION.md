# Sugar Rush 1000 — Frontend Documentation

## Overview

A Phaser 3 slot game clone of Pragmatic Play's **Sugar Rush 1000**. 7×7 cluster-pays grid with tumble cascades, multiplier spots, free spins, and Stake RGS integration.

**Tech Stack:** TypeScript · Phaser 3 · Vite · Stake Engine API

---

## Project Structure

```
src/
├── index.ts                  # Entry point — creates Phaser.Game
├── config.ts                 # Phaser config (RESIZE mode, 60fps, scenes)
├── options.ts                # Game math config (paytable, bets, weights)
├── scenes/
│   ├── Preload.tsx           # Asset loading + progress bar
│   ├── Boot.tsx              # Stake auth + procedural asset generation
│   └── Game.tsx              # Main game orchestrator (1886 lines)
├── components/
│   ├── Grid.ts               # 7×7 cascade engine + animations (1150 lines)
│   ├── Audio.ts              # Music + SFX manager
│   ├── PaytableOverlay.ts    # 7-page info/rules overlay
│   ├── SettingsOverlay.ts    # Music/SFX/intro toggles
│   ├── AutoPlayOverlay.ts    # Auto-spin count + turbo/quick/skip
│   ├── BetOverlay.ts         # Full bet selector grid
│   ├── WinCelebration.ts     # Big win overlay with skip
│   ├── FreeSpinsIntro.ts     # Free spins trigger animation
│   ├── ConfirmDialog.ts      # Generic confirm/cancel modal
│   ├── ErrorManager.ts       # Toast + blocking error modals
│   └── Progress.tsx          # Loading bar component
├── engine/
│   └── StakeEngineClient.ts  # Stake RGS API client (486 lines)
└── helpers/
    ├── ClusterEvaluator.ts   # Flood-fill cluster detection
    ├── Currency.ts           # Balance formatting (DisplayBalance)
    └── I18n.ts               # Social/demo mode text wrapper
```

---

## Scene Lifecycle

```
Preload → Boot → Game
```

1. **Preload** — Loads all image/audio assets, shows progress bar
2. **Boot** — Authenticates with Stake RGS, generates procedural candy textures, transitions to Game
3. **Game** — Main gameplay loop (never destroyed)

---

## Game Configuration (`options.ts`)

| Property | Value | Description |
|----------|-------|-------------|
| `gridSize` | 7 | 7×7 grid |
| `symbolSize` | 100 | Base sprite size (px) |
| `maxWinMultiplier` | 25,000 | Max win cap (×bet) |
| `cascadeDelay` | 150 | ms between cascade steps |
| `clusterExplodeDuration` | 300 | ms for explosion animation |
| `scatterChance` | 0.02 | 2% base scatter rate per cell |
| `scatterChanceAnte` | 0.04 | 4% with Ante Bet |
| `anteBetCostMultiplier` | 1.25 | 25% extra cost |

### Bet Presets
23 values: `$0.20` → `$240.00` (official Sugar Rush 1000 range)

### Paytable (7 symbols × 11 tiers)
Cluster sizes 5 through 15+. Values are bet multipliers. Example at $1 bet:
- Pink Candy (ID 6): 5=$2.00, 10=$10.00, 15+=$300.00
- Orange Gummy Bear (ID 0): 5=$0.40, 10=$2.00, 15+=$40.00

### Symbol Weights
`[19, 17, 16, 14, 13, 12, 9]` — Sum=100. Lower-paying symbols appear more often.

### Scatter Awards
`{ 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 }` free spins

---

## Core Components

### Grid (`Grid.ts`) — The Cascade Engine

The heart of the game. Manages a 7×7 array of Phaser sprites with the full tumble-cascade-multiplier lifecycle.

**Key Properties:**
- `sprites[7][7]` — Current symbol sprites (null = empty)
- `multipliers[7][7]` — Multiplier value per cell (0=none, 1=marked, 2+=active)
- `freeSpinsRemaining` — Countdown during free spins
- `isSuperFreeSpins` — Flag for ×2 starting multipliers
- `totalFreeSpinsWin` — Cumulative FS round win
- `cumulativeRoundWin` — Running total for max win cap
- `maxWinReached` — Triggers immediate round end
- `turboMode` — Reduces animation durations

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `prepareSpin()` | Sweep-out animation, reset multipliers (base game only) |
| `injectServerResult(grid?)` | Accepts server grid or generates local random grid, triggers drop |
| `fillEmpty()` | Creates new symbols above grid, animates drop with bounce |
| `evaluateAndCascade()` | Finds clusters, plays anticipation + explosion, cascades |
| `cascadeSymbols()` | Gravity drop for remaining symbols after explosion |
| `handleNoMoreClusters()` | Counts scatters, awards FS, or finishes round |
| `drawMultiplierUI(r, c)` | Renders tier-colored multiplier badge |
| `drawCellBackgrounds()` | Renders grid interior with gradient + groove separators |
| `repositionSprites()` | Responsive repositioning on resize |

**Animation Phases (per cascade):**

1. **Anticipation** (250ms) — Staggered squeeze-pop bounce on winning symbols, symbol-colored glow
2. **Explosion** (300ms) — 2-stage destruction (squeeze → burst), particles, colored cell flash
3. **Multiplier Advance** — Mark spot → ×2 → ×4 → ... → ×1024
4. **Cascade** (variable) — Gravity drop with distance-proportional bounce
5. **Fill** (variable) — New symbols waterfall in with column/row stagger

**Multiplier Badge Design:**
- Dark base with tier-colored gradient overlay
- Candy-pill rounded shape with wrapper folds
- Glossy top highlight + outer glow ring
- Colors progress: Gold → Orange → Red → Magenta → Purple → Cyan → Pink
- Shockwave ring on upgrade, Back.easeOut entrance

**Callbacks (set by Game.tsx):**
- `onWinCallback(amount)` — Reports each cascade win
- `onCompleteCallback()` — Round finished (base game)
- `onFreeSpinsStart(remaining)` — FS triggered/updated
- `onFreeSpinsEnd(totalWin)` — FS round complete
- `onNextFreeSpinNeeded()` — Requests next FS spin
- `onMaxWinCallback(totalWin)` — 25,000× cap reached

---

### ClusterEvaluator (`ClusterEvaluator.ts`)

Pure logic class — no Phaser dependency. Uses **iterative DFS flood-fill** with 4-directional adjacency (up/down/left/right, no diagonals).

- Skips scatter (ID 7) — scatters don't form clusters
- No wild symbol in Sugar Rush 1000
- Returns `Cluster[]` where each cluster has `symbolId` and `positions[]`
- `visited[][]` array ensures each cell belongs to exactly one cluster

---

### StakeEngineClient (`StakeEngineClient.ts`)

Handles all Stake RGS communication. Singleton via `getStakeEngine()`.

**Modes:**
- **Production** — URL params `sessionID` + `rgs_url` present → real API calls
- **Demo** — No params → generates local random outcomes
- **Replay** — `?replay=true` → fetches static replay data
- **Social** — `?social=true` → labels adjusted for social casino

**API Methods:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `authenticate()` | POST `/wallet/authenticate` | Validates session, returns balance + pending round |
| `play(bet, feature)` | POST `/wallet/play` | Executes spin, returns full outcome |
| `getBalance()` | POST `/wallet/balance` | Fetches current balance |
| `endRound()` | POST `/wallet/end-round` | Signals animations complete |
| `resync()` | (re-auth) | Recovers authoritative balance after failure |
| `fetchReplay()` | GET `/bet/replay/...` | Fetches replay data |

**Error Handling:**
- `StakeError` class with typed codes: `AUTH`, `TIMEOUT`, `NETWORK`, `SERVER`, `REJECTED`
- `fetchWithRetry()` — 3 attempts with exponential backoff, 15s timeout
- Non-retryable: 4xx errors (except 429). Retryable: 5xx, 429, timeouts

**Monetary Precision:** 6-decimal integers (`$1.00 = 1,000,000`)

---

### Game Scene (`Game.tsx`) — The Orchestrator

Wires all components together. Handles layout, input, and game flow.

**Key Flows:**

**Normal Spin:**
1. `handleUniversalAction()` → `attemptSpin(0)`
2. Deduct bet, lock spin, call `grid.prepareSpin()`
3. Call `stakeEngine.play()` → receive grid outcome
4. Call `grid.injectServerResult(grid)` → triggers cascade chain
5. Grid cascades until no wins → calls `onCompleteCallback()`
6. Show win celebration if ≥2× bet, then unlock

**Buy Free Spins:**
1. `requestPurchase(type, cost)` → confirm dialog
2. `executePurchase()` → deduct cost, call RGS
3. Random 3-7 scatter count → 10-30 FS awarded
4. Type 2 (Super): seed ×2 on all 49 grid spots
5. Show FS intro → inject server grid → cascade chain
6. Grid drives FS loop via `onNextFreeSpinNeeded()`

**Free Spins Flow:**
- Grid decrements `freeSpinsRemaining` after each tumble sequence
- Calls `onNextFreeSpinNeeded()` → Game calls `prepareSpin()` + `injectServerResult()`
- Multipliers persist across all spins
- On last spin: `finishFreeSpins()` → `onFreeSpinsEnd(totalWin)`

**Error Recovery:**
- `handleSpinFailure()` — Shows blocking modal (AUTH → reload, NETWORK → retry)
- `resyncAfterError()` — Re-authenticates to get server-authoritative balance
- Never blindly refunds local balance

**Input Handling:**
- SPACE / ENTER → `handleUniversalAction()`
- Priority: skip celebration → skip FS intro → close overlays → stop auto → spin
- All buttons check `_spinLock`, `fsActive`, `anyOverlayOpen()` before acting

---

### UI Components

**AutoPlayOverlay** — Slider for spin count (10-1000), checkboxes for Turbo/Quick/Skip Screens. Turbo and Quick are mutually exclusive.

**BetOverlay** — Grid of bet preset buttons ($0.20-$240). Highlights current selection. Syncs with ante bet state.

**PaytableOverlay** — 7 pages with dot navigation:
1. Symbol Payouts + Scatter info
2. Tumble Feature (flow diagram)
3. Multiplier Spots (progression visual)
4. Free Spins + Buy FS info
5. Game Rules (volatility, RTP, bet range, ante bet)
6. How to Play (UI controls guide)
7. Settings Menu / Max Win

**SettingsOverlay** — Toggles: Intro Screen, Ambient Sound, Sound Effects. Syncs with Audio component.

**WinCelebration** — Shows for wins ≥2× bet. Animated amount counter with skip.

**FreeSpinsIntro** — Animated FS count display with entrance/exit transitions.

**ConfirmDialog** — Generic modal with title, message, OK/Cancel. Used by Buy Feature.

**ErrorManager** — `showToast(msg, color)` for transient messages, `showBlockingError(headline, retryFn)` for fatal errors with retry.

**Audio** — Manages music + SFX channels. Methods: `playSound()`, `playMusic()`, `playReels()`, `setMusicMuted()`, `setSfxMuted()`.

---

## Responsive Layout

Uses `Phaser.Scale.RESIZE` mode — fills container. All positioning is relative to `scale.width/height`.

**Layout regions (computed in `layoutAll()`):**
- Top: Logo text
- Center: Grid (fills ~65% of height)
- Bottom: Control bar (balance, bet, spin, auto)
- Left sidebar: Buy FS buttons, Ante Bet, Sound, Paytable, Settings, Fullscreen
- Overlays: Centered, scaled to logical dimensions

---

## Info Pages Audit (vs Official Sugar Rush 1000)

| Page | Content | Status |
|------|---------|--------|
| 1/7 | All 7 symbol payouts at current bet, scatter description | ✅ Matches |
| 2/7 | Tumble rules (5 bullet points) + flow diagram | ✅ Matches |
| 3/7 | Multiplier spots: mark → ×2 → double → ×1024, additive in clusters, persist in FS | ✅ Matches |
| 4/7 | Scatter awards table, re-trigger rules, Buy FS (100×/500×), random scatter on buy | ✅ Updated |
| 5/7 | Volatility HIGH, rules, RTP (96.53/96.52/96.44), bet range, ante bet, max win | ✅ Updated |
| 6/7 | How to play: UI controls, bet +/-, spin, autoplay | ✅ Matches |
| 7/7 | Settings menu, info screen, bet menu, max win cap, buy FS summary | ✅ Matches |

---

## Build & Run

```bash
npm install          # Install dependencies
npm run dev          # Dev server (Vite, hot reload)
npm run build        # Production build → dist/
```

**URL Parameters (Stake integration):**
- `?sessionID=xxx&rgs_url=https://...` — Production mode
- `?replay=true&game=...&version=...` — Replay mode
- `?social=true` — Social casino mode
- No params — Demo mode (local random outcomes)
