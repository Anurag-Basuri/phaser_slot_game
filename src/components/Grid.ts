import Phaser from 'phaser';
import options from '../options';
import { ClusterEvaluator } from '../helpers';

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

  public onWinCallback: ((winAmount: number) => void) | null = null;
  public onFreeSpinsStart: ((count: number) => void) | null = null;
  public onFreeSpinsEnd: ((totalWin: number) => void) | null = null;
  public onCompleteCallback: (() => void) | null = null;

  private symbolKeys = [
    'candy_0', 'candy_1', 'candy_2', 'candy_3',
    'candy_4', 'candy_5', 'candy_6', 'scatter'
  ];

  // Layout — set dynamically by Game.tsx
  public offsetX = 0;
  public offsetY = 0;
  public cellSize = 100;

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
    // Create a rectangular mask so symbols don't render outside the grid area
    this.gridMask = this.scene.add.graphics().setDepth(0);
    this.gridMask.fillStyle(0x000000, 0);
    this.gridMask.fillRect(
      this.offsetX - 5,
      this.offsetY - 5,
      this.cellSize * options.gridSize + 10,
      this.cellSize * options.gridSize + 10
    );

    this.fillEmpty();
  }

  private getX(col: number) {
    return this.offsetX + col * this.cellSize + this.cellSize / 2;
  }

  private getY(row: number) {
    return this.offsetY + row * this.cellSize + this.cellSize / 2;
  }

  /** Pick a weighted random symbol ID (0-6) or scatter (7). */
  private pickSymbol(): number {
    if (Math.random() < options.scatterChance) return 7;

    const weights = options.symbolWeights;
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

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
          const symId = this.pickSymbol();
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
            duration: 350 + (dropCounts[c] - currentDropIndex) * 80,
            ease: 'Bounce.easeOut'
          });
        }
      }
    }
  }

  public startSpin(triggerType: number = 0) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Reset multipliers only if NOT in free spins
    if (this.freeSpinsRemaining === 0) {
      this.totalFreeSpinsWin = 0;
      for (let r = 0; r < options.gridSize; r++) {
        for (let c = 0; c < options.gridSize; c++) {
          this.multipliers[r][c] = 1;
          this.clearMultiplierUI(r, c);
        }
      }
    }

    // Handle Buy Features
    if (triggerType === 1) {
      this.freeSpinsRemaining = 10;
      if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
    } else if (triggerType === 2) {
      this.isSuperFreeSpins = true;
      this.freeSpinsRemaining = 10;
      if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
      // Super: pre-seed center multipliers
      const seedPoints = [
        { r: 3, c: 3, m: 16 }, { r: 2, c: 3, m: 8 }, { r: 4, c: 3, m: 8 },
        { r: 3, c: 2, m: 8 }, { r: 3, c: 4, m: 8 },
        { r: 2, c: 2, m: 4 }, { r: 2, c: 4, m: 4 }, { r: 4, c: 2, m: 4 }, { r: 4, c: 4, m: 4 }
      ];
      seedPoints.forEach(p => {
        this.multipliers[p.r][p.c] = p.m;
        this.drawMultiplierUI(p.r, p.c);
      });
    }

    // Sweep old symbols off screen
    this.scene.time.delayedCall(100, () => {
      for (let r = 0; r < options.gridSize; r++) {
        for (let c = 0; c < options.gridSize; c++) {
          if (this.sprites[r][c]) {
            const s = this.sprites[r][c]!;
            this.scene.tweens.add({
              targets: s,
              y: s.y + this.cellSize * 8,
              alpha: 0,
              duration: 280,
              onComplete: () => { s.destroy(); }
            });
            this.sprites[r][c] = null;
          }
        }
      }

      this.scene.time.delayedCall(300, () => {
        this.fillEmpty();
        this.scene.time.delayedCall(800, () => {
          this.evaluateAndCascade();
        });
      });
    });
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
    // mult=2 is "wrapper" state (visible highlight, displays "x1")
    const displayMult = mult === 2 ? 1 : mult === 4 ? 2 : mult;

    // Draw or update the golden highlight box
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

    // Draw or update the text label
    const fontSize = Math.max(14, Math.floor(this.cellSize * 0.28));
    if (!this.multiplierTexts[r][c]) {
      this.multiplierTexts[r][c] = this.scene.add.text(
        this.getX(c), this.getY(r),
        `x${displayMult}`,
        { fontSize: `${fontSize}px`, color: '#ffea00', fontStyle: 'bold', stroke: '#0044cc', strokeThickness: 5 }
      ).setOrigin(0.5).setDepth(5).setAlpha(0.95);
    } else {
      this.multiplierTexts[r][c]!.setText(`x${displayMult}`);
      this.scene.tweens.add({ targets: this.multiplierTexts[r][c], scale: 1.5, yoyo: true, duration: 180 });
    }
  }

  private evaluateAndCascade() {
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
      let sizeIndex = Math.min(cluster.positions.length - 5, 10);

      let clusterWin = options.payvalues[cluster.symbolId][sizeIndex];

      // Sum multipliers from all positions in the cluster
      let totalMult = 0;
      cluster.positions.forEach(pos => {
        const m = this.multipliers[pos.row][pos.col];
        if (m >= 4) {
          totalMult += m === 4 ? 2 : m;
        } else if (m === 2) {
          // Wrapper — contributes x1 (no additional mult)
        }
      });
      if (totalMult > 0) clusterWin *= totalMult;

      totalWin += clusterWin * options.betAmount;

      // Explode symbols and advance multipliers
      cluster.positions.forEach(pos => {
        const r = pos.row;
        const c = pos.col;
        if (this.sprites[r][c]) {
          // Explosion particles — create and auto-destroy
          const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
            speed: { min: 80, max: 350 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.35, end: 0 },
            lifespan: 500,
            quantity: 4,
            blendMode: 'ADD'
          });
          emitter.explode(4);
          // Auto-destroy emitter after particles die
          this.scene.time.delayedCall(600, () => { emitter.destroy(); });

          // Animate symbol destruction
          this.scene.tweens.add({
            targets: this.sprites[r][c],
            scale: 0, alpha: 0, angle: 90,
            duration: options.clusterExplodeDuration,
            onComplete: () => {
              this.sprites[r][c]?.destroy();
              this.sprites[r][c] = null;
            }
          });

          // Advance multiplier: 1→2(wrapper), 2→4(x2), 4→8(x4), ... up to 1024
          if (this.multipliers[r][c] === 1) {
            this.multipliers[r][c] = 2;
          } else {
            this.multipliers[r][c] = Math.min(this.multipliers[r][c] * 2, 1024);
          }
          this.drawMultiplierUI(r, c);
        }
      });
    });

    if (totalWin > 0) {
      if (this.freeSpinsRemaining > 0) this.totalFreeSpinsWin += totalWin;
      if (this.onWinCallback) this.onWinCallback(totalWin);
    }

    this.scene.time.delayedCall(options.clusterExplodeDuration + 80, () => {
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

      // Correct free spin tiers
      const fsAwarded = options.freeSpinsByScatter[Math.min(scatters, 7)] || 10;
      this.freeSpinsRemaining += fsAwarded;

      const fsText = this.scene.add.text(
        this.scene.scale.width / 2, this.scene.scale.height / 2,
        `${fsAwarded} FREE SPINS\nTRIGGERED!`,
        { fontSize: '72px', color: '#ff00cc', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 10, align: 'center' }
      ).setOrigin(0.5).setDepth(30).setScale(0);

      if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);

      this.scene.tweens.add({
        targets: fsText, scale: 1, duration: 500, ease: 'Back.easeOut', yoyo: true, hold: 1500,
        onComplete: () => { fsText.destroy(); this.cascadeSymbols(); }
      });
      return;
    }

    // No scatters — tumble is fully over
    if (this.freeSpinsRemaining > 0) {
      this.freeSpinsRemaining--;
      if (this.freeSpinsRemaining > 0) {
        if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
        this.scene.time.delayedCall(1000, () => {
          this.isProcessing = false;
          this.startSpin();
        });
      } else {
        if (this.onFreeSpinsEnd) this.onFreeSpinsEnd(this.totalFreeSpinsWin);
        this.isSuperFreeSpins = false;
        this.isProcessing = false;
        if (this.onCompleteCallback) this.onCompleteCallback();
      }
    } else {
      this.isProcessing = false;
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
      this.scene.time.delayedCall(500, () => {
        this.evaluateAndCascade();
      });
    });
  }
}
