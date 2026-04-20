# Sweet Cluster 1000 — Game Design Document (GDD)

**Version:** 1.0.0  
**Game ID:** sweet_cluster_1000  
**Game Type:** Cascading Cluster Pays Slot  
**Target Platform:** Stake Engine (stake-engine.com)  
**Volatility:** High  
**Target RTP:** 96.53%  
**Max Win:** 25,000× Bet  

---

## 1. Game Overview

Sweet Cluster 1000 is a high-volatility 7×7 cascading cluster pays slot game themed around a colorful candy world. Players spin a grid filled with candy symbols, aiming to create clusters of 5+ matching symbols to win. When wins occur, the winning symbols explode, new symbols cascade down, and multiplier spots are created. Multipliers persist and double on subsequent wins, potentially reaching up to 1024×.

### Core Mechanics
- **Cluster Pays:** 5+ adjacent (orthogonal) matching symbols form a winning cluster
- **Cascading Reels:** Winning symbols are removed; new symbols drop in from above
- **Persistent Multipliers:** Positions that form wins gain multipliers that double each time (×1 → ×2 → ×4 → ... → ×1024)
- **Free Spins:** Triggered by 3+ scatter symbols; multipliers persist throughout

---

## 2. Grid & Layout

| Property | Value |
|----------|-------|
| Grid Size | 7 rows × 7 columns |
| Total Cells | 49 |
| Minimum Cluster Size | 5 symbols |
| Maximum Cluster Size | 49 symbols (full board) |

---

## 3. Symbols

### Regular Symbols (7)

| ID | Name | Spawn Weight | Cluster 5 | Cluster 8 | Cluster 12 | Cluster 15+ |
|----|------|-------------|-----------|-----------|------------|-------------|
| 0  | Orange Gummy Bear | 18% | 0.20× | 0.40× | 2.50× | 20.00× |
| 1  | Purple Gummy Bear | 17% | 0.25× | 0.50× | 3.00× | 25.00× |
| 2  | Red Gummy Bear | 16% | 0.30× | 0.75× | 3.50× | 30.00× |
| 3  | Green Candy | 14% | 0.40× | 1.00× | 5.00× | 40.00× |
| 4  | Purple Candy | 13% | 0.50× | 1.25× | 10.00× | 60.00× |
| 5  | Orange Candy | 12% | 0.75× | 1.50× | 12.50× | 100.00× |
| 6  | Pink Candy | 10% | 1.00× | 2.00× | 15.00× | 150.00× |

### Special Symbol

| ID | Name | Type | Probability |
|----|------|------|-------------|
| 7  | Scatter Lollipop | Scatter | 2% per cell |

---

## 4. Full Paytable

Multipliers of bet amount for cluster sizes 5 through 15+:

| Symbol | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15+ |
|--------|-----|-----|-----|-----|-----|-----|-----|------|------|------|------|
| Orange Gummy Bear | 0.20 | 0.25 | 0.30 | 0.40 | 0.50 | 1.00 | 1.50 | 2.50 | 5.00 | 10.00 | 20.00 |
| Purple Gummy Bear | 0.25 | 0.30 | 0.40 | 0.50 | 0.75 | 1.25 | 2.00 | 3.00 | 6.00 | 12.00 | 25.00 |
| Red Gummy Bear | 0.30 | 0.40 | 0.50 | 0.75 | 1.00 | 1.50 | 2.50 | 3.50 | 8.00 | 15.00 | 30.00 |
| Green Candy | 0.40 | 0.50 | 0.75 | 1.00 | 1.25 | 2.00 | 3.00 | 5.00 | 10.00 | 20.00 | 40.00 |
| Purple Candy | 0.50 | 0.75 | 1.00 | 1.25 | 1.50 | 3.00 | 4.50 | 10.00 | 20.00 | 40.00 | 60.00 |
| Orange Candy | 0.75 | 1.00 | 1.25 | 1.50 | 2.00 | 4.00 | 6.00 | 12.50 | 30.00 | 60.00 | 100.00 |
| Pink Candy | 1.00 | 1.50 | 1.75 | 2.00 | 2.50 | 5.00 | 7.50 | 15.00 | 35.00 | 70.00 | 150.00 |

---

## 5. Multiplier System

### Progression
When a grid position is part of a winning cluster, it receives a multiplier stamp:

| Stage | Stored Value | Display Value | Visual |
|-------|-------------|---------------|--------|
| First Win | 2 | ×1 | Golden wrapper glow |
| Second Win | 4 | ×2 | Golden box + ×2 text |
| Third Win | 8 | ×4 | Golden box + ×4 text |
| ... | doubles each time | half of stored | growing intensity |
| Maximum | 1024 | ×1024 | Maximum glow |

### Rules
- Multipliers are applied to the cluster payout
- All multipliers within a winning cluster are **summed** together
- **Base game:** Multipliers reset every spin
- **Free Spins:** Multipliers persist across all spins

---

## 6. Free Spins Feature

### Trigger
| Scatters on Board | Free Spins Awarded |
|-------------------|--------------------|
| 3 | 10 |
| 4 | 15 |
| 5 | 20 |
| 6 | 25 |
| 7 | 30 |

### Rules
- Free Spins can retrigger (3+ scatters on the final board after cascades)
- Multipliers persist throughout all Free Spins
- Total win is displayed at the end of the Free Spins round

---

## 7. Buy Features

| Feature | Cost | Effect |
|---------|------|--------|
| Buy Free Spins | 100× Bet | Immediately triggers 10 Free Spins |
| Super Free Spins | 500× Bet | 10 Free Spins with pre-seeded multipliers in center 3×3 |

### Super Free Spins Seed Multipliers
| Position (row, col) | Starting Multiplier |
|---------------------|---------------------|
| (3,3) center | ×16 |
| (2,3), (4,3), (3,2), (3,4) | ×8 each |
| (2,2), (2,4), (4,2), (4,4) | ×4 each |

---

## 8. Win Celebration Tiers

| Tier | Threshold | Duration |
|------|-----------|----------|
| Nice Win | 2× - 10× bet | ~2.5s |
| Big Win | 10× - 25× bet | ~3s |
| Mega Win | 25× - 50× bet | ~3.5s |
| Epic Win | 50× - 100× bet | ~4s |
| Ultra Win | 100×+ bet | ~5s |

---

## 9. Technical Specifications

### Frontend
- **Engine:** Phaser 3.90.0
- **Language:** TypeScript 5.9
- **Build Tool:** Vite 7.3
- **Resolution:** 1920×1080 (scales with FIT mode)
- **Target FPS:** 60 (min 30)

### Backend (Stake Engine)
- **Math SDK:** Python 3
- **RGS Integration:** stake-engine-client (TypeScript)
- **API Endpoints:** /wallet/authenticate, /wallet/play, /wallet/balance, /wallet/end-round
- **Monetary Precision:** 6-decimal integers ($1.00 = 1,000,000)

### Assets
- **Symbols:** PNG (7 candy symbols + 1 scatter)
- **Background:** PNG
- **Audio:** MP3 (7 tracks: 2 music, 5 SFX)
- **Fonts:** TTF (PT Serif, Luckiest Guy)

---

## 10. Deployment Checklist

- [ ] Math SDK simulation validates RTP at 96.00% ±0.1%
- [ ] All static outcome files generated (JSON + CSV)
- [ ] Stake Engine API integration tested
- [ ] Cross-device responsive layout verified (mobile portrait + desktop landscape)
- [ ] Audio plays correctly on all platforms
- [ ] Loading screen functions properly
- [ ] Disconnect/reconnect recovery works
- [ ] Win celebrations display at correct tiers
- [ ] Free Spins + retrigger works
- [ ] Buy features deduct correct amounts
- [ ] Max win cap (25,000×) enforced
- [ ] Production build generated (minified, no sourcemaps)
- [ ] Submitted to Stake Engine ACP
- [ ] Stake review passed
