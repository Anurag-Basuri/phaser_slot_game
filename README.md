# 🍬 Sweet Cluster 1000

A premium **7×7 cascading cluster pays** slot game built for the [Stake Engine](https://stake-engine.com) platform.

![Game Type](https://img.shields.io/badge/Type-Cluster%20Pays-purple)
![RTP](https://img.shields.io/badge/RTP-96.00%25-green)
![Max Win](https://img.shields.io/badge/Max%20Win-25%2C000x-gold)
![Volatility](https://img.shields.io/badge/Volatility-High-red)

---

## 🎮 Game Features

- **7×7 Grid** with cluster pays mechanics (5+ adjacent symbols win)
- **Cascading Reels** — winning symbols explode and new ones drop in
- **Persistent Multipliers** — positions gain multipliers that double on wins (up to 1024×)
- **Free Spins** — triggered by 3+ scatter symbols (10-30 spins)
- **Buy Features** — Buy Free Spins (100× bet) or Super Free Spins (500× bet)
- **Tiered Win Celebrations** — Nice/Big/Mega/Epic/Ultra win tiers
- **Responsive Design** — Portrait & landscape layouts
- **Stake Engine Integration** — Full RGS API support with demo mode fallback

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Game Engine | Phaser 3.90.0 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7.3 |
| Math Engine | Python 3 |
| Platform Target | Stake Engine RGS |

## 📦 Project Structure

```
phaser_slot_game/
├── src/                    # Frontend game source
│   ├── components/         # Game components (Grid, Audio, Paytable, etc.)
│   ├── engine/             # Stake Engine RGS client
│   ├── scenes/             # Phaser scenes (Preload, Boot, Game)
│   ├── helpers/            # Cluster evaluator
│   ├── constants/          # Local storage keys
│   ├── config.ts           # Phaser configuration
│   ├── options.ts          # Game options & paytable
│   └── index.ts            # Entry point
├── public/                 # Static assets
│   ├── images/candies/     # Symbol art (7 candies + scatter)
│   ├── audio/              # Sound effects & music
│   ├── css/                # Stylesheet
│   └── fonts/              # Custom fonts
├── math-engine/            # Python RTP simulation
│   ├── game_config.py      # Game math configuration
│   ├── cluster_evaluator.py# Cluster detection logic
│   ├── run.py              # Monte Carlo RTP simulator
│   └── output/             # Simulation results (JSON, CSV)
├── scripts/                # Build & deployment scripts
├── dist/                   # Production build output
├── GDD.md                  # Game Design Document
└── package.json            # Project config & scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.10+ (for math engine)

### Development
```bash
npm install
npm run dev         # Start dev server at http://localhost:5173
```

### Production Build
```bash
npm run build       # Build to dist/
npm run preview     # Preview production build
```

### Math Simulation
```bash
npm run math:quick  # Quick RTP check (100K simulations)
npm run math:sim    # Full RTP validation (1M simulations + export)
```

### Bundle for Stake Engine
```bash
npm run bundle      # Build + package into sweet_cluster_1000.zip
```

## 📊 Math Engine

The project utilizes the official **Stake Engine Math SDK** (`math-engine/`) for 100% compliant RGS mathematical delivery. 

### Implementation Details:
- **Architecture**: Overrides `GeneralGameState` and `GameExecutables` to implement the unique 7x7 grid multipliers tracking logic natively in Python.
- **RTP Tuning**: Uses Genetic Algorithm compilation against `BR0.csv` and `FR0.csv` reelstrips to mathematically enforce the target RTP.
- **Bet Modes Generated**:
  1. Base Game (1x)
  2. Free Spins Feature Buy (100x)
  3. Super Free Spins Feature Buy (500x)

### SDK Generation
Running `make run GAME=sugar_rush_1000` will emit the required RGS packages:
| File | Purpose |
|------|---------|
| `config_fe.json` | Static game config for Stake Frontend |
| `books_base.jsonl.zst` | Compressed event timelines |
| `lookUpTable_base_0.csv` | Final payout distribution mappings |

## 🔗 Stake Engine Integration

The game integrates with Stake Engine's RGS API via `src/engine/StakeEngineClient.ts`:

### API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| `/wallet/authenticate` | Session validation (called on game load) |
| `/wallet/play` | Execute a game round |
| `/wallet/balance` | Get player balance |
| `/wallet/end-round` | Complete round after animations |

### URL Parameters
The game reads these from the launcher URL:
- `sessionID` — Player session token
- `lang` — Language code (default: `en`)
- `device` — Device type (`desktop` / `mobile`)
- `rgs_url` — RGS API base URL (never hardcoded)

### Demo Mode
When no `sessionID` or `rgs_url` is provided, the game runs in **demo mode** with client-side random outcomes. A "DEMO MODE" label appears in the top-left corner.

## 📋 Deployment Checklist

- [x] Game Design Document (GDD.md)
- [x] Production art assets (8 symbols + backgrounds)
- [x] Sound effects & music (7 audio tracks)
- [x] Paytable & multiplier system
- [x] Free Spins with scatter trigger
- [x] Buy Feature (100× and 500× bet)
- [x] RTP validated at ~96% via Monte Carlo simulation
- [x] Stake Engine API integration
- [x] Responsive layout (portrait + landscape)
- [x] Win celebration tiers
- [x] In-game paytable overlay
- [x] Settings overlay
- [x] Production build configured
- [x] Deployment bundle script
- [ ] Upload to Stake Engine ACP
- [ ] Stake review & approval

## 📄 License

MIT
