import Phaser from 'phaser';
import options from '../options';
import { ClusterEvaluator } from '../helpers';

/**
 * Grid — 7×7 cascading cluster pays grid engine.
 *
 * Supports:
 * - Server-provided grids (production RGS mode)
 * - Client-side random grids (demo mode fallback)
 * - Persistent multiplier system (up to 1024×)
 * - Max win cap enforcement (25,000×)
 * - Turbo mode (reduced animation timings)
 * - Ante Bet (increased scatter chance)
 */
export class Grid {
  private scene: Phaser.Scene;
  private sprites: (Phaser.GameObjects.Sprite | null)[][];
  private multipliers: number[][];
  private multiplierGraphics: (Phaser.GameObjects.Graphics | null)[][];
  private multiplierTexts: (Phaser.GameObjects.Text | null)[][];
  private gridMask!: Phaser.GameObjects.Graphics;

  public isProcessing = false;
  public freeSpinsRemaining = 0;
  public totalFreeSpinsWin = 0;
  public isSuperFreeSpins = false;
  public turboMode = false;

  // Max win tracking
  private cumulativeRoundWin = 0;
  private maxWinReached = false;

  // Server-provided grid for RGS mode
  private pendingServerGrid: number[][] | null = null;
  private sweepComplete = false;
  private waitingPulseTween?: Phaser.Tweens.Tween;

  // Callbacks
  public onWinCallback: ((winAmount: number) => void) | null = null;
  public onFreeSpinsStart: ((count: number) => void) | null = null;
  public onFreeSpinsEnd: ((totalWin: number) => void) | null = null;
  public onCompleteCallback: (() => void) | null = null;
  public onMaxWinCallback: ((totalWin: number) => void) | null = null;
  public onNextFreeSpinNeeded: (() => void) | null = null;

  private symbolKeys = [
    'candy_0', 'candy_1', 'candy_2', 'candy_3',
    'candy_4', 'candy_5', 'candy_6', 'scatter'
  ];

  // Layout — set dynamically by Game.tsx
  public offsetX = 0;
  public offsetY = 0;
  public cellSize = 100;

  // Dynamic timing based on turbo mode
  private get cascadeDelay() { return this.turboMode ? 60 : 150; }
  private get explodeDuration() { return this.turboMode ? 120 : 300; }
  private get dropDuration() { return this.turboMode ? 140 : 350; }
  private get postDropDelay() { return this.turboMode ? 200 : 500; }
  private get sweepDuration() { return this.turboMode ? 140 : 280; }
  private cellBackgrounds!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const size = options.gridSize;
    this.sprites = Array.from({ length: size }, () => Array(size).fill(null));
    this.multipliers = Array.from({ length: size }, () => Array(size).fill(1));
    this.multiplierGraphics = Array.from({ length: size }, () => Array(size).fill(null));
    this.multiplierTexts = Array.from({ length: size }, () => Array(size).fill(null));
  }

  /** Call this after setting offsetX/offsetY/cellSize, then populate the board. */
  public init() {
    this.gridMask = this.scene.add.graphics().setDepth(0);
    this.gridMask.fillStyle(0x000000, 0);
    this.gridMask.fillRect(
      this.offsetX - 5,
      this.offsetY - 5,
      this.cellSize * options.gridSize + 10,
      this.cellSize * options.gridSize + 10
    );
    this.cellBackgrounds = this.scene.add.graphics().setDepth(1);
    this.drawCellBackgrounds();
    this.fillEmpty();
  }

  /** Draw subtle rounded-rect backgrounds behind each grid cell. */
  public drawCellBackgrounds() {
    this.cellBackgrounds.clear();
    const size = options.gridSize;
    const gap = 2;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = this.offsetX + c * this.cellSize + gap;
        const y = this.offsetY + r * this.cellSize + gap;
        const s = this.cellSize - gap * 2;
        // Fully opaque dark blue backgrounds — eliminates checkerboard from PNG transparency
        const tint = (r + c) % 2 === 0 ? 0x0c1528 : 0x101d38;
        this.cellBackgrounds.fillStyle(tint, 1.0);
        this.cellBackgrounds.fillRoundedRect(x, y, s, s, 5);
      }
    }
  }

  private getX(col: number) {
    return this.offsetX + col * this.cellSize + this.cellSize / 2;
  }

  private getY(row: number) {
    return this.offsetY + row * this.cellSize + this.cellSize / 2;
  }

  /** Pick a weighted random symbol ID (0-6) or scatter (7). */
  private pickSymbol(): number {
    const scatterRate = options.anteBetEnabled
      ? options.scatterChanceAnte
      : options.scatterChance;

    if (Math.random() < scatterRate) return 7;

    const weights = options.symbolWeights;
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  /** Fill empty cells with server-provided or random symbols. */
  public fillEmpty() {
    const size = options.gridSize;
    const dropCounts = Array(size).fill(0);

    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (!this.sprites[r][c]) dropCounts[c]++;
      }
    }

    for (let c = 0; c < size; c++) {
      let currentDropIndex = 0;
      for (let r = size - 1; r >= 0; r--) {
        if (!this.sprites[r][c]) {
          currentDropIndex++;

          // Use server grid if available, otherwise pick random
          let symId: number;
          if (this.pendingServerGrid) {
            symId = this.pendingServerGrid[r][c];
          } else {
            symId = this.pickSymbol();
          }

          const startY = this.getY(r) - (dropCounts[c] + 1) * this.cellSize;
          const sprite = this.scene.add.sprite(this.getX(c), startY, this.symbolKeys[symId]);
          sprite.setData('symId', symId);

          const scale = (this.cellSize * 0.85) / Math.max(sprite.width, sprite.height);
          sprite.setScale(Math.min(scale, 1));
          sprite.setDepth(10);

          this.sprites[r][c] = sprite;

          this.scene.tweens.add({
            targets: sprite,
            y: this.getY(r),
            duration: this.dropDuration + (dropCounts[c] - currentDropIndex) * 80,
            ease: 'Bounce.easeOut'
          });
        }
      }
    }

    // Play reel stop sound after drop
    this.scene.time.delayedCall(this.dropDuration + 100, () => {
      this.scene.sound.play('reelStop', { volume: 0.25 });
    });

    // Consume server grid after first fill
    if (this.pendingServerGrid) {
      this.pendingServerGrid = null;
    }
  }

  /**
   * Sweeps out old symbols instantly, putting the board into a waiting state.
   * Free spin setup for buy features is handled by Game.tsx.
   */
  public prepareSpin() {
    // Note: caller (Game.tsx) is responsible for guarding via options.checkClick.
    // We do NOT guard on isProcessing here because money is already deducted.
    this.isProcessing = true;
    this.sweepComplete = false;
    this.pendingServerGrid = null;

    // Reset multipliers & win tracking only if NOT in free spins
    if (this.freeSpinsRemaining === 0) {
      this.totalFreeSpinsWin = 0;
      this.cumulativeRoundWin = 0;
      this.maxWinReached = false;
      for (let r = 0; r < options.gridSize; r++) {
        for (let c = 0; c < options.gridSize; c++) {
          this.multipliers[r][c] = 1;
          this.clearMultiplierUI(r, c);
        }
      }
    }

    // Sweep old symbols off screen immediately
    for (let r = 0; r < options.gridSize; r++) {
      for (let c = 0; c < options.gridSize; c++) {
        if (this.sprites[r][c]) {
          const s = this.sprites[r][c]!;
          this.scene.tweens.add({
            targets: s,
            y: s.y + this.cellSize * 8,
            alpha: 0,
            duration: this.sweepDuration,
            onComplete: () => { s.destroy(); }
          });
          this.sprites[r][c] = null;
        }
      }
    }

    this.scene.time.delayedCall(this.sweepDuration + 20, () => {
      this.sweepComplete = true;
      if (this.pendingServerGrid) {
        this.executeDrop();
      } else {
        // Enact waiting pulse
        this.waitingPulseTween = this.scene.tweens.add({
          targets: this.cellBackgrounds,
          alpha: 0.3,
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });
  }

  /** Called when the API responds with the outcome */
  public injectServerResult(serverGrid?: number[][]) {
    this.pendingServerGrid = serverGrid || null;
    if (this.sweepComplete) {
      this.executeDrop();
    }
  }

  /** Aborts the spin gracefully if the API fatally failed */
  public abortSpin() {
    this.isProcessing = false;
    this.sweepComplete = false;
    if (this.waitingPulseTween) {
      this.waitingPulseTween.stop();
      this.waitingPulseTween = undefined;
      this.cellBackgrounds.setAlpha(1);
    }
    // Repopulate the grid so the board isn't blank
    this.pendingServerGrid = null;
    this.fillEmpty();
  }

  private executeDrop() {
    if (this.waitingPulseTween) {
      this.waitingPulseTween.stop();
      this.waitingPulseTween = undefined;
      this.cellBackgrounds.setAlpha(1);
    }
    
    this.sweepComplete = false;
    this.fillEmpty();
    this.scene.time.delayedCall(this.dropDuration + 300, () => {
      this.evaluateAndCascade();
    });
  }

  /** Reposition all existing sprites to current cell positions (for resize). */
  public repositionSprites() {
    const size = options.gridSize;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const sprite = this.sprites[r][c];
        if (sprite) {
          sprite.setPosition(this.getX(c), this.getY(r));
          const scale = (this.cellSize * 0.85) / Math.max(sprite.width, sprite.height);
          sprite.setScale(Math.min(scale, 1));
        }
        // Redraw multiplier UI
        this.clearMultiplierUI(r, c);
        if (this.multipliers[r][c] > 1) {
          this.drawMultiplierUI(r, c);
        }
      }
    }
    // Redraw grid mask
    if (this.gridMask) {
      this.gridMask.clear();
      this.gridMask.fillStyle(0x000000, 0);
      this.gridMask.fillRect(
        this.offsetX - 5,
        this.offsetY - 5,
        this.cellSize * size + 10,
        this.cellSize * size + 10
      );
    }
    // Redraw cell backgrounds
    this.drawCellBackgrounds();
  }

  private clearMultiplierUI(r: number, c: number) {
    if (this.multiplierGraphics[r][c]) {
      this.multiplierGraphics[r][c]!.destroy();
      this.multiplierGraphics[r][c] = null;
    }
    if (this.multiplierTexts[r][c]) {
      this.multiplierTexts[r][c]!.destroy();
      this.multiplierTexts[r][c] = null;
    }
  }

  private drawMultiplierUI(r: number, c: number) {
    const mult = this.multipliers[r][c];
    // Display exactly what we apply — no remapping
    if (mult <= 1) return; // Don't show UI for base multiplier

    if (!this.multiplierGraphics[r][c]) {
      const gfx = this.scene.add.graphics().setDepth(1);
      const pad = 3;
      gfx.fillStyle(0xffea00, 0.35);
      gfx.fillRoundedRect(
        this.getX(c) - this.cellSize / 2 + pad,
        this.getY(r) - this.cellSize / 2 + pad,
        this.cellSize - pad * 2,
        this.cellSize - pad * 2, 10
      );
      gfx.lineStyle(3, 0xffaa00, 0.9);
      gfx.strokeRoundedRect(
        this.getX(c) - this.cellSize / 2 + pad,
        this.getY(r) - this.cellSize / 2 + pad,
        this.cellSize - pad * 2,
        this.cellSize - pad * 2, 10
      );
      this.multiplierGraphics[r][c] = gfx;
    }

    const fontSize = Math.max(14, Math.floor(this.cellSize * 0.28));
    if (!this.multiplierTexts[r][c]) {
      this.multiplierTexts[r][c] = this.scene.add.text(
        this.getX(c), this.getY(r),
        `x${mult}`,
        { fontSize: `${fontSize}px`, color: '#ffea00', fontStyle: 'bold', stroke: '#0044cc', strokeThickness: 5 }
      ).setOrigin(0.5).setDepth(5).setAlpha(0.95);
    } else {
      this.multiplierTexts[r][c]!.setText(`x${mult}`);
      this.scene.tweens.add({ targets: this.multiplierTexts[r][c], scale: 1.5, yoyo: true, duration: 180 });
    }
  }

  private evaluateAndCascade() {
    if (this.maxWinReached) {
      this.finishRound();
      return;
    }

    const size = options.gridSize;
    const idGrid: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.sprites[r][c]) {
          idGrid[r][c] = this.sprites[r][c]!.getData('symId');
        }
      }
    }

    const evaluator = new ClusterEvaluator(idGrid);
    const clusters = evaluator.findClusters(5);

    if (clusters.length === 0) {
      this.handleNoMoreClusters(idGrid, size);
      return;
    }

    // Process wins
    let totalWin = 0;
    clusters.forEach(cluster => {
      const sizeIndex = Math.min(cluster.positions.length - 5, 10);
      let clusterWin = options.payvalues[cluster.symbolId][sizeIndex];

      // Sum multipliers — all values ≥2 apply directly
      let totalMult = 0;
      cluster.positions.forEach(pos => {
        const m = this.multipliers[pos.row][pos.col];
        if (m >= 2) {
          totalMult += m;
        }
      });
      if (totalMult > 0) clusterWin *= totalMult;

      totalWin += clusterWin * options.betAmount;

      // Explode and advance multipliers
      cluster.positions.forEach(pos => {
        const r = pos.row;
        const c = pos.col;
        if (this.sprites[r][c]) {
          // Explosion particles
          const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
            speed: { min: 80, max: 350 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.35, end: 0 },
            lifespan: 500,
            quantity: 4,
            blendMode: 'ADD'
          });
          emitter.explode(4);
          this.scene.time.delayedCall(600, () => { emitter.destroy(); });

          // Animate symbol destruction
          // Debris particle pop
          const sprite = this.sprites[r][c]!;
          const symId = sprite.getData('symId') ?? 0;
          const debrisEmitter = this.scene.add.particles(sprite.x, sprite.y, `candy_${symId}`, {
            speed: { min: 80, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.15, end: 0 },
            lifespan: 600,
            quantity: 4,
            gravityY: 300,
          }).setDepth(15);
          debrisEmitter.explode();
          this.scene.time.delayedCall(700, () => debrisEmitter.destroy());

          this.scene.tweens.add({
            targets: sprite,
            scale: 0, alpha: 0, angle: Phaser.Math.Between(-180, 180),
            duration: this.explodeDuration,
            onComplete: () => {
              sprite.destroy();
              this.sprites[r][c] = null;
            }
          });

          // Advance multiplier
          if (this.multipliers[r][c] === 1) {
            this.multipliers[r][c] = 2;
          } else {
            this.multipliers[r][c] = Math.min(this.multipliers[r][c] * 2, 1024);
          }
          this.drawMultiplierUI(r, c);
        }
      });
    });

    // Enforce max win cap
    if (totalWin > 0) {
      const maxWin = options.maxWinMultiplier * options.betAmount;
      this.cumulativeRoundWin += totalWin;

      if (this.cumulativeRoundWin >= maxWin) {
        totalWin -= (this.cumulativeRoundWin - maxWin); // Clamp
        this.cumulativeRoundWin = maxWin;
        this.maxWinReached = true;
      }

      if (this.freeSpinsRemaining > 0) this.totalFreeSpinsWin += totalWin;
      if (this.onWinCallback) this.onWinCallback(totalWin);

      if (this.maxWinReached) {
        if (this.onMaxWinCallback) this.onMaxWinCallback(this.cumulativeRoundWin);
        this.scene.time.delayedCall(this.explodeDuration + 200, () => {
          this.finishRound();
        });
        return;
      }
    }

    this.scene.time.delayedCall(this.explodeDuration + 80, () => {
      this.cascadeSymbols();
    });
  }

  private handleNoMoreClusters(idGrid: number[][], size: number) {
    // Count scatters
    let scatters = 0;
    const scatterPositions: { r: number; c: number }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (idGrid[r][c] === 7) {
          scatters++;
          scatterPositions.push({ r, c });
        }
      }
    }

    if (scatters >= 3) {
      // Animate scatters
      scatterPositions.forEach(pos => {
        const s = this.sprites[pos.r][pos.c];
        if (s) {
          this.scene.tweens.add({
            targets: s, scale: s.scaleX * 1.6, yoyo: true, repeat: 1, duration: 350,
            onComplete: () => { s.destroy(); this.sprites[pos.r][pos.c] = null; }
          });
        }
      });

      const fsAwarded = options.freeSpinsByScatter[Math.min(scatters, 7)] || 10;
      this.freeSpinsRemaining += fsAwarded;

      if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);

      // Delay for scatter animation, then cascade
      this.scene.time.delayedCall(1200, () => {
        this.cascadeSymbols();
      });
      return;
    }

    // No scatters — tumble is fully over
    if (this.freeSpinsRemaining > 0) {
      this.freeSpinsRemaining--;
      if (this.freeSpinsRemaining > 0) {
        if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
        // Let Game.tsx drive the next free spin so it can provide server grids
        this.scene.time.delayedCall(this.turboMode ? 400 : 1000, () => {
          this.isProcessing = false;
          if (this.onNextFreeSpinNeeded) {
            this.onNextFreeSpinNeeded();
          }
        });
      } else {
        this.finishFreeSpins();
      }
    } else {
      this.finishRound();
    }
  }

  private finishFreeSpins() {
    if (this.onFreeSpinsEnd) this.onFreeSpinsEnd(this.totalFreeSpinsWin);
    this.isSuperFreeSpins = false;
    this.isProcessing = false;
    if (this.onCompleteCallback) this.onCompleteCallback();
  }

  private finishRound() {
    this.isProcessing = false;
    if (this.freeSpinsRemaining > 0 && !this.maxWinReached) {
      // Still in FS
    } else if (this.freeSpinsRemaining > 0 && this.maxWinReached) {
      this.freeSpinsRemaining = 0;
      this.finishFreeSpins();
    } else {
      if (this.onCompleteCallback) this.onCompleteCallback();
    }
  }

  private cascadeSymbols() {
    const size = options.gridSize;
    for (let c = 0; c < size; c++) {
      for (let r = size - 1; r >= 0; r--) {
        if (this.sprites[r][c] === null) {
          for (let k = r - 1; k >= 0; k--) {
            if (this.sprites[k][c]) {
              this.sprites[r][c] = this.sprites[k][c];
              this.sprites[k][c] = null;
              this.scene.tweens.add({
                targets: this.sprites[r][c],
                y: this.getY(r),
                duration: 180,
                ease: 'Cubic.easeIn'
              });
              break;
            }
          }
        }
      }
    }

    this.scene.time.delayedCall(220, () => {
      this.fillEmpty();
      this.scene.time.delayedCall(this.postDropDelay, () => {
        this.evaluateAndCascade();
      });
    });
  }
}
