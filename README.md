# Sugar Rush 1000

An industry-grade, full-stack clone of Pragmatic Play's **Sugar Rush 1000** slot game. Designed for deployment on the **Stake.com** platform, featuring a decoupled architecture: a high-fidelity Phaser 3 frontend and a Stake Engine SDK-compliant Python math engine.

---

## 🏗️ Architecture & Project Structure

To maintain strict industry compliance and separation of concerns, the project is divided into two distinct repositories/folders:

```
phaser_slot_game/
│
├── frontend/                     # FRONTEND (Presentation Layer)
│   ├── src/                      #   TypeScript & Phaser 3 source
│   ├── public/                   #   Static assets (images, sounds, fonts)
│   ├── DOCUMENTATION.md          #   Detailed frontend lifecycle & components
│   └── package.json              #   Node dependencies & build scripts
│
├── math-engine/                  # BACKEND (Game Server / Math Layer)
│   ├── src/                      #   Stake Engine SDK core logic
│   ├── games/sugar_rush_1000/    #   Game rules, RTP, bet modes, RGS files
│   ├── reels/                    #   Procedural reel strip configurations
│   ├── MATH_ENGINE_DOCUMENTATION.md #  Detailed RGS & logic docs
│   └── optimize.py               #   RTP Optimization algorithms
│
└── README.md                     # This documentation
```

### 🔄 How They Connect (The RGS Pipeline)

In a compliant gambling environment, the frontend NEVER generates outcomes. 
1. The **Math Engine** pre-computes millions of verified game rounds using reel strips, simulating exact game mathematics.
2. It outputs these outcomes as cryptographically compressed `.jsonl.zst` files and `lookup_tables.csv` indicating exact probability weights.
3. These files are uploaded to the **Stake RGS (Remote Game Server)**.
4. During live play, the **Frontend** calls the Stake API (`POST /wallet/play`).
5. The Stake RGS selects an outcome from the pre-computed files and returns it to the client.
6. The **Frontend** animates the exact sequence determined by the server.

---

## 🍬 Game Features & Mechanics

**Sugar Rush 1000** is a highly volatile, 7×7 grid-based cluster-pays slot game. 

### 1. Cluster Pays
Wins are awarded when **5 or more identical symbols** connect horizontally or vertically anywhere on the 49-cell grid. Diagonals do not count.

### 2. Tumble Feature (Cascading Reels)
When a winning cluster is formed:
- The winning symbols explode and are removed from the grid.
- Existing symbols drop down via gravity to fill the empty spaces.
- New symbols fall from the top of the grid to complete the 7×7 board.
- Tumbling continues indefinitely until no new winning clusters are formed.

### 3. Multiplier Spots
This is the core multiplier mechanic that allows wins up to 25,000×:
- When a winning symbol explodes, it marks its spot on the grid.
- If a subsequent win explodes on that **same marked spot**, a **×2 multiplier** is added.
- Each subsequent win on that spot **doubles** the multiplier: ×2 → ×4 → ×8 → ×16 → up to **×1,024**.
- If multiple multiplier spots are involved in the same winning cluster, their values are **added together** before multiplying the win.
- In the Base Game, multiplier spots clear at the end of the tumble sequence.

### 4. Free Spins
Triggered by landing Scatter symbols during a single spin/tumble sequence:
- **3 Scatters** = 10 Free Spins
- **4 Scatters** = 12 Free Spins
- **5 Scatters** = 15 Free Spins
- **6 Scatters** = 20 Free Spins
- **7 Scatters** = 30 Free Spins

**Key Free Spin Mechanic:** During Free Spins, marked spots and their multipliers **persist for the entire duration of the bonus round** and do not clear between spins.

---

## 🐻 Symbol Payouts & Frequencies

The game features 7 regular paying symbols and 1 scatter symbol. There is no wild symbol.

| Symbol | ID | Visual | Rarity / Frequency | Max Payout (15+ Cluster) |
|--------|----|--------|--------------------|--------------------------|
| **L3** | 0  | Orange Gummy Bear | Very Common (~80-83%) | 40× Bet |
| **L2** | 1  | Purple Gummy Bear | Common (~8-10%) | 50× Bet |
| **L1** | 2  | Red Gummy Bear | Common (~5-6%) | 60× Bet |
| **H4** | 3  | Green Star Candy | Uncommon (~2-3%) | 80× Bet |
| **H3** | 4  | Purple Jelly Bean | Rare (~1-2%) | 120× Bet |
| **H2** | 5  | Orange Heart Candy | Very Rare (~0.5%) | 200× Bet |
| **H1** | 6  | Pink Round Candy | Extremely Rare (~0.2%) | 300× Bet |
| **S**  | 7  | Rocket (Scatter) | Free Spins Trigger (~0.8%) | N/A |

*(Note: Exact symbol frequencies on reel strips are optimized to meet the target RTP).*

---

## 🎲 Betting & Math Modes

The Math Engine defines 4 distinct bet modes, each with its own cost and distribution:

1. **Base Game (1.0× Cost):** Standard play. RTP: 96.53%.
2. **Ante Bet (1.25× Cost):** The chance to trigger Free Spins is doubled by increasing scatter frequencies on the reel strips. RTP: 96.53%.
3. **Buy Free Spins (100.0× Cost):** Automatically triggers 3 to 7 scatters. Uses a dedicated reel strip (`FR0.csv`). RTP: 96.53%.
4. **Buy Super Free Spins (500.0× Cost):** Automatically triggers Free Spins, but **every spot on the 7×7 grid begins with a pre-seeded ×2 multiplier**. Uses `SF0.csv`. RTP: 96.53%.

**Max Win Cap:** The maximum payout per round is capped at **25,000× the base bet**. If a cascade sequence exceeds this amount, the round immediately terminates and pays exactly 25,000×.

---

## 🚀 Deployment Procedure

To achieve industry compliance and deploy to Stake, follow this exact workflow:

### Step 1: Reel Optimization (Math Engine)
The game uses 1,000-symbol reel strips per column with "anti-clustering" (no adjacent symbols are identical). Because of the extreme volatility of the ×1,024 multiplier mechanic, the RTP must be tuned using massive-scale simulation.
1. Run the Python optimizer or the Rust Stake Optimizer program against the reel parameters.
2. Target convergence: Exactly **96.53% RTP**.

### Step 2: Generating Production Books (Math Engine)
Once reel strips are balanced:
1. Navigate to `math-engine/` and edit `run.py`.
2. Set `num_sim_args` to `1,000,000` (1 Million simulations per mode).
3. Run the script on a high-compute cloud instance (due to the millions of BFS cluster evaluations required).
4. The output will be placed in `math-engine/games/sugar_rush_1000/library/`.

### Step 3: Admin Control Panel (ACP) Upload
1. Zip the contents of the `library/` folder.
2. Upload the compressed library to the Stake ACP. The backend will parse the `index.json`, process the Zstd event books, and register the probabilistic weights.

### Step 4: Frontend Hosting
1. Navigate to `frontend/`.
2. Run `npm run build`.
3. Deploy the resulting static `dist/` folder via CDN or standard web hosting.
4. Launch the game using the official Stake environment parameters (`?sessionID=xxx&rgs_url=...`).

---

## 📚 Detailed Documentation

- [Frontend Engine Documentation](./frontend/DOCUMENTATION.md)
- [Math Engine & RGS Documentation](./math-engine/MATH_ENGINE_DOCUMENTATION.md)

---
*Developed for Stake Engine Compliance.*
