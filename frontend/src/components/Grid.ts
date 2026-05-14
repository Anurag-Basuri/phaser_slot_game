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
 * - Premium animations: anticipation pop, weighted drop, color-tiered multiplier badges
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
  private _dropWhenReady = false;
  private cascadeDepth = 0;
  private _activeEmitterCount = 0;
  private static readonly MAX_EMITTERS = 30;

  // Idle shimmer
  private _shimmerTimer?: Phaser.Time.TimerEvent;

  // Phase 6: Cascade depth counter
  private cascadeCounterTxt!: Phaser.GameObjects.Text;

  // Callbacks
  public onWinCallback: ((winAmount: number, symbolId?: number) => void) | null = null;
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

  // Dynamic timing — fast and snappy for Sugar Rush 1000 feel
  private get cascadeDelay() { return this.turboMode ? 30 : 80; }
  private get explodeDuration() { return this.turboMode ? 80 : 180; }
  private get dropDuration() { return this.turboMode ? 100 : 200; }
  private get postDropDelay() { return this.turboMode ? 100 : 250; }
  private get sweepDuration() { return this.turboMode ? 80 : 140; }
  private cellBackgrounds!: Phaser.GameObjects.Graphics;

  // Multiplier text color tiers (wrapper is always golden)
  private static readonly MULT_TIERS = [
    { mult: 2,    fill: '#ffe600', stroke: '#cc5500' }, // Yellow/Gold
    { mult: 4,    fill: '#ffcc00', stroke: '#cc3300' }, // Yellow-orange
    { mult: 8,    fill: '#ff8800', stroke: '#aa0000' }, // Orange
    { mult: 16,   fill: '#ff0000', stroke: '#660000' }, // Red
    { mult: 32,   fill: '#ff00aa', stroke: '#660066' }, // Magenta
    { mult: 64,   fill: '#cc00ff', stroke: '#4400aa' }, // Purple
    { mult: 128,  fill: '#8800ff', stroke: '#220088' }, // Deep Purple
    { mult: 256,  fill: '#0088ff', stroke: '#002288' }, // Blue
    { mult: 512,  fill: '#00ddff', stroke: '#0044aa' }, // Cyan
    { mult: 1024, fill: '#ffaaaa', stroke: '#aa0044' }, // Light Pink
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const size = options.gridSize;
    this.sprites = Array.from({ length: size }, () => Array(size).fill(null));
    this.multipliers = Array.from({ length: size }, () => Array(size).fill(0));
    this.multiplierGraphics = Array.from({ length: size }, () => Array(size).fill(null));
    this.multiplierTexts = Array.from({ length: size }, () => Array(size).fill(null));
  }

  /** Call this to create grid internals (mask, backgrounds). Does NOT fill symbols yet. */
  public init() {
    this.gridMask = this.scene.add.graphics().setDepth(0);
    this.gridMask.fillStyle(0x000000, 0);
    this.gridMask.fillRect(
      this.offsetX - 5,
      this.offsetY - 5,
      this.cellSize * options.gridSize + 10,
      this.cellSize * options.gridSize + 10
    );
    this.cellBackgrounds = this.scene.add.graphics().setDepth(2);
    this.drawCellBackgrounds();

    // Phase 6: Cascade depth counter text — font scales with grid
    this.cascadeCounterTxt = this.scene.add.text(0, 0, '', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '22px', // Will be overridden dynamically on each display
      color: '#ffffff',
      stroke: '#cc0055',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 6, stroke: true, fill: true }
    }).setOrigin(0.5).setDepth(25).setVisible(false);

    // NOTE: fillEmpty() is NOT called here — it must be called after
    // layoutAll() sets the correct offsetX/offsetY/cellSize so that
    // sprites spawn at the right screen positions.
    this.startIdleShimmer();
  }

  /**
   * Draw premium Sugar Rush 1000 grid interior.
   * Warm candy pink frosted glass, subtle cell delineation,
   * inner frame bevel, multiplier cell glow tints, and center glow.
   */
  public drawCellBackgrounds() {
    this.cellBackgrounds.clear();
    const size = options.gridSize;
    const totalSize = this.cellSize * size;
    const gx = this.offsetX;
    const gy = this.offsetY;

    // Update mask geometry to match new layout
    if (this.gridMask) {
      this.gridMask.clear();
      this.gridMask.fillStyle(0x000000, 1);
      this.gridMask.fillRect(
        gx - 5,
        gy - 5,
        totalSize + 10,
        totalSize + 10
      );
    }

    // ═══ Phase 1: Frosted Glass Panel (Premium Sugar Rush 1000 style) ═══
    // Instead of a solid pink, we use a translucent dark-berry glass that 
    // lets the vibrant game background subtly bleed through, providing depth.
    this.cellBackgrounds.fillGradientStyle(0x3a0d2d, 0x24081c, 0x1a0414, 0x0c010a, 0.65, 0.65, 0.85, 0.85);
    this.cellBackgrounds.fillRect(gx, gy, totalSize, totalSize);
    
    // Soft inner glow rim to separate the grid from the outer frame
    // Uses rounded rect to match the outer frame's rounded corners
    const innerRadius = Math.max(6, this.cellSize * 0.15);
    this.cellBackgrounds.lineStyle(2, 0xff88cc, 0.3);
    this.cellBackgrounds.strokeRoundedRect(gx, gy, totalSize, totalSize, innerRadius);

    // ═══ Phase 2: Checkerboard cell tint (soft translucent candy colors) ═══
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r + c) % 2 === 0) {
          // Lighter cells
          this.cellBackgrounds.fillStyle(0xffaadd, 0.08);
        } else {
          // Darker cells
          this.cellBackgrounds.fillStyle(0x000000, 0.15);
        }
        this.cellBackgrounds.fillRect(
          gx + c * this.cellSize, gy + r * this.cellSize,
          this.cellSize, this.cellSize
        );
      }
    }

    // ═══ Phase 3: Multiplier Cell Glow Tints ═══
    // Draw colored cell backgrounds for cells with active multipliers
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const mult = this.multipliers[r][c];
        if (mult >= 1) {
          const tier = this.getMultTier(Math.max(2, mult));
          const tierColor = parseInt(tier.fill.replace('#', ''), 16);
          // Soft colored tint on the entire cell
          this.cellBackgrounds.fillStyle(tierColor, mult >= 2 ? 0.12 : 0.06);
          this.cellBackgrounds.fillRect(
            gx + c * this.cellSize, gy + r * this.cellSize,
            this.cellSize, this.cellSize
          );
          // Radial center glow within the cell
          if (mult >= 2) {
            this.cellBackgrounds.fillStyle(tierColor, 0.08);
            this.cellBackgrounds.fillCircle(
              this.getX(c), this.getY(r),
              this.cellSize * 0.35
            );
          }
        }
      }
    }

    // ═══ Grid separators — visible candy-tinted grooves ═══
    for (let c = 1; c < size; c++) {
      const x = gx + c * this.cellSize;
      this.cellBackgrounds.lineStyle(1, 0x220011, 0.2);
      this.cellBackgrounds.lineBetween(x - 1, gy, x - 1, gy + totalSize);
      this.cellBackgrounds.lineStyle(1, 0xffccee, 0.22);
      this.cellBackgrounds.lineBetween(x, gy, x, gy + totalSize);
      this.cellBackgrounds.lineStyle(1, 0xffeeff, 0.06);
      this.cellBackgrounds.lineBetween(x + 1, gy, x + 1, gy + totalSize);
    }
    for (let r = 1; r < size; r++) {
      const y = gy + r * this.cellSize;
      this.cellBackgrounds.lineStyle(1, 0x220011, 0.15);
      this.cellBackgrounds.lineBetween(gx, y + 1, gx + totalSize, y + 1);
      this.cellBackgrounds.lineStyle(1, 0xffccee, 0.18);
      this.cellBackgrounds.lineBetween(gx, y, gx + totalSize, y);
    }

    // ═══ Phase 2: Inner Frame Bevel (recessed candy display) ═══
    // Deep inset shadow — makes the grid look like it's sunken into the frame
    const bevelLayers = 18;
    for (let i = 0; i < bevelLayers; i++) {
      const a = 0.12 - i * 0.006;
      if (a <= 0) break;
      const d = i * 2;
      // Use a warm deep magenta for the shadow instead of cold purple
      this.cellBackgrounds.fillStyle(0x440022, a);
      // Top edge
      this.cellBackgrounds.fillRect(gx, gy + d, totalSize, 2);
      // Bottom edge
      this.cellBackgrounds.fillRect(gx, gy + totalSize - d - 2, totalSize, 2);
      // Left edge
      this.cellBackgrounds.fillRect(gx + d, gy, 2, totalSize);
      // Right edge
      this.cellBackgrounds.fillRect(gx + totalSize - d - 2, gy, 2, totalSize);
    }
    // Inner light rim (like a candy glass edge catching light)
    this.cellBackgrounds.lineStyle(1, 0xffffff, 0.12);
    this.cellBackgrounds.strokeRect(gx + 1, gy + 1, totalSize - 2, totalSize - 2);

    // ═══ Radial warm candy glow at center ═══
    const cx = gx + totalSize / 2;
    const cy = gy + totalSize / 2;
    for (let i = 0; i < 10; i++) {
      const glowAlpha = 0.04 - i * 0.003;
      if (glowAlpha <= 0) break;
      this.cellBackgrounds.fillStyle(0xffbbdd, glowAlpha);
      this.cellBackgrounds.fillCircle(cx, cy, totalSize * 0.18 + i * 28);
    }
  }

  /** Idle sparkle — symbols get a brief brightness flash, NO scale change to stay in cell */
  private startIdleShimmer() {
    if (this._shimmerTimer) this._shimmerTimer.remove();
    this._shimmerTimer = this.scene.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        if (this.isProcessing) return;
        // Pick 3 random cells for a quick brightness flash
        for (let n = 0; n < 3; n++) {
          const r = Phaser.Math.Between(0, options.gridSize - 1);
          const c = Phaser.Math.Between(0, options.gridSize - 1);
          const sprite = this.sprites[r]?.[c];
          if (sprite && !this.scene.tweens.isTweening(sprite)) {
            // Brief bright tint — no scale, stays perfectly in cell
            this.scene.time.delayedCall(n * 150, () => {
              if (sprite && sprite.scene) {
                sprite.setTint(0xffffff);
                this.scene.time.delayedCall(250, () => {
                  if (sprite && sprite.scene) sprite.clearTint();
                });
              }
            });
          }
        }
      },
    });
  }

  private getX(col: number) {
    return this.offsetX + col * this.cellSize + this.cellSize / 2;
  }

  private getY(row: number) {
    return this.offsetY + row * this.cellSize + this.cellSize / 2;
  }

  /** Pick a weighted random symbol ID (0-7) or scatter (8). */
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
            const raw = this.pendingServerGrid[r]?.[c];
            symId = (typeof raw === 'number' && raw >= 0 && raw < this.symbolKeys.length) ? raw : this.pickSymbol();
          } else {
            symId = this.pickSymbol();
          }

          const startY = this.getY(r) - (dropCounts[c] + 1) * this.cellSize;
          const sprite = this.scene.add.sprite(this.getX(c), startY, this.symbolKeys[symId]);
          sprite.setData('symId', symId);

          const scale = (this.cellSize * 0.78) / Math.max(sprite.width, sprite.height);
          sprite.setScale(Math.min(scale, 1));
          sprite.setDepth(10);
          sprite.setAlpha(0);

          // Apply circular crop to scatter to remove square background
          if (symId === 7) {
            const cropRadius = Math.min(sprite.width, sprite.height) / 2;
            sprite.setCrop(
              sprite.width / 2 - cropRadius,
              sprite.height / 2 - cropRadius,
              cropRadius * 2,
              cropRadius * 2
            );
          }

          this.sprites[r][c] = sprite;

          // Clean fast drop with punchy landing
          const delay = c * 18 + (size - 1 - r) * 8;
          const dropDur = this.dropDuration + (dropCounts[c] - currentDropIndex) * 15;

          // Instant visibility
          this.scene.tweens.add({
            targets: sprite,
            alpha: 1,
            duration: 30,
            delay,
          });

          // Fast gravity fall
          this.scene.tweens.add({
            targets: sprite,
            y: this.getY(r),
            duration: dropDur,
            ease: 'Cubic.easeIn',
            delay,
            onComplete: () => {
              if (!sprite || !sprite.scene) return;
              const sx = sprite.scaleX;
              const sy = sprite.scaleY;
              // Punchy squash-and-stretch landing with bounce
              this.scene.tweens.chain({
                targets: sprite,
                tweens: [
                  { scaleY: sy * 0.65, scaleX: sx * 1.25, y: this.getY(r) + 3, duration: 50, ease: 'Quad.easeOut' },
                  { scaleY: sy * 1.1, scaleX: sx * 0.92, y: this.getY(r) - 6, duration: 70, ease: 'Sine.easeOut' },
                  { scaleY: sy, scaleX: sx, y: this.getY(r), duration: 50, ease: 'Sine.easeInOut' },
                ]
              });
            }
          });
        }
      }
    }

    // Play reel stop sound after drop
    this.scene.time.delayedCall(this.dropDuration + 100, () => {
      try { 
        const audio = (this.scene as any).audio;
        if (audio && audio.playCascadeDrop) {
          audio.playCascadeDrop(this.cascadeDepth);
        }
      } catch { /* ignore */ }
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
    this.isProcessing = true;
    this.sweepComplete = false;
    this.pendingServerGrid = null;
    this._dropWhenReady = false;
    this.cascadeDepth = 0;

    // Reset multipliers & win tracking only if NOT in free spins
    if (this.freeSpinsRemaining === 0) {
      this.totalFreeSpinsWin = 0;
      this.cumulativeRoundWin = 0;
      this.maxWinReached = false;
      for (let r = 0; r < options.gridSize; r++) {
        for (let c = 0; c < options.gridSize; c++) {
          this.multipliers[r][c] = 0;
          this.clearMultiplierUI(r, c);
        }
      }
    }
    this.cascadeCounterTxt.setVisible(false);

    // Sweep old symbols — smooth slide-down exit
    for (let r = 0; r < options.gridSize; r++) {
      for (let c = 0; c < options.gridSize; c++) {
        if (this.sprites[r][c]) {
          const s = this.sprites[r][c]!;
          // Instant dissolve sweep — symbols shrink and vanish fast
          const delay = r * 8 + c * 5;
          this.scene.tweens.add({
            targets: s,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: this.sweepDuration,
            delay,
            ease: 'Back.easeIn',
            onComplete: () => { s.destroy(); }
          });
          this.sprites[r][c] = null;
        }
      }
    }

    this.scene.time.delayedCall(this.sweepDuration + 160, () => {
      this.sweepComplete = true;
      if (this.pendingServerGrid || this._dropWhenReady) {
        this._dropWhenReady = false;
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
    this.pendingServerGrid = this.validateServerGrid(serverGrid) ? serverGrid! : null;
    if (this.sweepComplete) {
      this.executeDrop();
    } else {
      this._dropWhenReady = true;
    }
  }

  /** Aborts the spin gracefully if the API fatally failed */
  public abortSpin() {
    this.isProcessing = false;
    this.sweepComplete = false;
    this._dropWhenReady = false;
    if (this.waitingPulseTween) {
      this.waitingPulseTween.stop();
      this.waitingPulseTween = undefined;
      this.cellBackgrounds.setAlpha(1);
    }
    try {
      const audio = (this.scene as any).audio;
      if (audio && audio.stopReels) audio.stopReels();
    } catch { /* ignore */ }
    this.pendingServerGrid = null;
    this.fillEmpty();
  }

  private executeDrop() {
    if (this.waitingPulseTween) {
      this.waitingPulseTween.stop();
      this.waitingPulseTween = undefined;
      this.cellBackgrounds.setAlpha(1);
    }
    try {
      const audio = (this.scene as any).audio;
      if (audio && audio.stopReels) audio.stopReels();
    } catch { /* ignore */ }
    
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
          const scale = (this.cellSize * 0.78) / Math.max(sprite.width, sprite.height);
          sprite.setScale(Math.min(scale, 1));
        }
        // Redraw multiplier UI
        this.clearMultiplierUI(r, c);
        if (this.multipliers[r][c] >= 1) {
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

  /** Get color tier for a given multiplier value */
  private getMultTier(mult: number) {
    for (const tier of Grid.MULT_TIERS) {
      if (mult <= tier.mult) return tier;
    }
    return Grid.MULT_TIERS[Grid.MULT_TIERS.length - 1];
  }

  private drawMultiplierUI(r: number, c: number) {
    const mult = this.multipliers[r][c];
    if (mult === 0) return;

    // A multiplier of 1 means it's just "marked". Use the tier for x2 for styling.
    const tier = this.getMultTier(Math.max(2, mult));
    const cx = this.getX(c);
    const cy = this.getY(r);
    
    // Small compact badge — sits at BOTTOM-CENTER of cell, fully inside
    const badgeRadius = this.cellSize * 0.14;
    const badgeCX = cx;
    const badgeCY = cy + this.cellSize * 0.32;
    const tierColor = parseInt(tier.fill.replace('#', ''), 16);
    const tierStroke = parseInt(tier.stroke.replace('#', ''), 16);

    const drawBadge = (gfx: Phaser.GameObjects.Graphics) => {
      gfx.clear();
      
      // 1. Drop shadow
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillCircle(badgeCX, badgeCY + 1, badgeRadius + 1);

      // 2. Main body
      gfx.fillStyle(tierColor, 1);
      gfx.fillCircle(badgeCX, badgeCY, badgeRadius);

      // 3. Border stroke
      gfx.lineStyle(2, tierStroke, 1);
      gfx.strokeCircle(badgeCX, badgeCY, badgeRadius);

      // 4. Glossy top highlight
      gfx.fillStyle(0xffffff, 0.4);
      gfx.fillEllipse(badgeCX, badgeCY - badgeRadius * 0.3, badgeRadius * 1.0, badgeRadius * 0.5);
    };

    if (!this.multiplierGraphics[r][c]) {
      const gfx = this.scene.add.graphics().setDepth(12);
      drawBadge(gfx);
      this.multiplierGraphics[r][c] = gfx;

      // Quick pop-in entrance
      gfx.setScale(0);
      gfx.setAlpha(0);
      this.scene.tweens.add({
        targets: gfx,
        scaleX: 1, scaleY: 1, alpha: 1,
        duration: 250,
        ease: 'Back.easeOut',
      });
    } else {
      // Existing badge — redraw and quick pulse on upgrade
      const gfx = this.multiplierGraphics[r][c]!;
      drawBadge(gfx);
      this.scene.tweens.add({
        targets: gfx,
        scaleX: 1.15, scaleY: 1.15,
        yoyo: true,
        duration: 150,
        ease: 'Quad.easeOut',
      });
    }

    if (mult > 1) {
      if (!this.multiplierTexts[r][c]) {
        const fontSize = mult >= 128 ? Math.max(10, this.cellSize * 0.18) : Math.max(12, this.cellSize * 0.24);
        const txt = this.scene.add.text(badgeCX, badgeCY + 1, `×${mult}`, {
          fontFamily: '"Luckiest Guy", cursive, sans-serif',
          fontSize: `${Math.round(fontSize)}px`,
          color: '#ffffff',
          stroke: tier.stroke,
          strokeThickness: Math.max(2, this.cellSize * 0.05),
          shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 3, stroke: true, fill: true }
        }).setOrigin(0.5).setDepth(13);

        this.multiplierTexts[r][c] = txt;

        // Match the badge entrance timing
        txt.setScale(0);
        txt.setAlpha(0);
        this.scene.tweens.add({
          targets: txt,
          scaleX: 1, scaleY: 1, alpha: 1,
          duration: 350,
          delay: 50,
          ease: 'Back.easeOut',
        });
      } else {
        const txt = this.multiplierTexts[r][c]!;
        const fontSize = mult >= 128 ? Math.max(10, this.cellSize * 0.18) : Math.max(12, this.cellSize * 0.24);
        txt.setText(`×${mult}`);
        txt.setFontSize(`${Math.round(fontSize)}px`);
        txt.setColor('#ffffff');
        txt.setStroke(tier.stroke, Math.max(2, this.cellSize * 0.05));
        
        // Punch scale on text
        this.scene.tweens.add({
          targets: txt,
          scaleX: 1.35, scaleY: 1.35,
          yoyo: true,
          duration: 180,
          ease: 'Quad.easeOut',
        });
      }
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
          idGrid[r][c] = this.sprites[r][c]!.getData('symId') ?? 0;
        }
      }
    }

    const evaluator = new ClusterEvaluator(idGrid);
    const clusters = evaluator.findClusters(5);

    if (clusters.length === 0) {
      this.handleNoMoreClusters(idGrid, size);
      return;
    }

    // Collect all positions that are part of a winning cluster for highlighting
    const winPositions = new Set<string>();
    clusters.forEach(cluster => {
      cluster.positions.forEach(pos => winPositions.add(`${pos.row},${pos.col}`));
    });
    // ── Clean anticipation: synchronized bright flash + pop ──
    // Sugar Rush 1000 style: simple, clean, all winning symbols flash together
    const anticipationDuration = this.turboMode ? 60 : 200;

    // Bright cell highlight behind winning symbols
    if (!this.turboMode) {
      const highlightGfx = this.scene.add.graphics().setDepth(9.5);
      const halfCell = this.cellSize / 2;
      winPositions.forEach(key => {
        const [rr, cc] = key.split(',').map(Number);
        // Soft white glow behind the symbol
        highlightGfx.fillStyle(0xffffff, 0.35);
        highlightGfx.fillRoundedRect(
          this.getX(cc) - halfCell + 2, this.getY(rr) - halfCell + 2,
          this.cellSize - 4, this.cellSize - 4, 5
        );
      });
      highlightGfx.setAlpha(0);
      // Quick flash in/out
      this.scene.tweens.add({
        targets: highlightGfx,
        alpha: { from: 0, to: 1 },
        yoyo: true,
        repeat: 1,
        duration: anticipationDuration * 0.4,
        ease: 'Sine.easeInOut',
        onComplete: () => highlightGfx.destroy(),
      });
    }

    // Synchronized scale pop on all winning symbols
    winPositions.forEach(key => {
      const [rr, cc] = key.split(',').map(Number);
      const sprite = this.sprites[rr]?.[cc];
      if (!sprite) return;
      const origSX = sprite.scaleX;
      const origSY = sprite.scaleY;

      // Quick pop up then back — all at once, no stagger
      this.scene.tweens.add({
        targets: sprite,
        scaleX: origSX * 1.2,
        scaleY: origSY * 1.2,
        duration: anticipationDuration * 0.45,
        ease: 'Back.easeOut',
        yoyo: true,
      });

      // White flash tint
      sprite.setTint(0xffffff);
      this.scene.time.delayedCall(anticipationDuration, () => {
        if (sprite && sprite.scene) sprite.clearTint();
      });
    });

    // ──────── Phase 2: Process wins and explode ────────
    this.scene.time.delayedCall(anticipationDuration + 80, () => {
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
            const sprite = this.sprites[r][c]!;
            const symId = sprite.getData('symId') ?? 0;

            // Symbol color for colored effects
            const symColors = [0x44ddcc, 0x4466ff, 0xff44aa, 0xffdd44, 0xaa44ff, 0xff2244, 0x44ffaa];
            const burstColor = symColors[symId % symColors.length];

            // Primary burst particles
            if (this._activeEmitterCount < Grid.MAX_EMITTERS) {
              const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
                speed: { min: 120, max: 450 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.28, end: 0 },
                lifespan: 500,
                quantity: 6,
                blendMode: 'ADD',
                alpha: { start: 0.9, end: 0 },
              });
              emitter.explode(6);
              this._activeEmitterCount++;
              this.scene.time.delayedCall(600, () => { emitter.destroy(); this._activeEmitterCount--; });
            }

            // Secondary candy debris (gravity affected)
            if (this._activeEmitterCount < Grid.MAX_EMITTERS && symId < 7) {
              const debrisEmitter = this.scene.add.particles(sprite.x, sprite.y, `candy_${symId}`, {
                speed: { min: 50, max: 200 },
                angle: { min: 200, max: 340 },
                scale: { start: 0.14, end: 0 },
                lifespan: 550,
                quantity: 4,
                gravityY: 400,
                alpha: { start: 1, end: 0 },
              }).setDepth(15);
              debrisEmitter.explode();
              this._activeEmitterCount++;
              this.scene.time.delayedCall(650, () => { debrisEmitter.destroy(); this._activeEmitterCount--; });
            }

            // ── Clean pop-and-vanish explosion (Sugar Rush 1000 style) ──
            // Sharp snap inward then burst outward and fade
            this.scene.tweens.chain({
              targets: sprite,
              tweens: [
                // Snap inward (quick squeeze)
                { scaleX: sprite.scaleX * 0.5, scaleY: sprite.scaleY * 0.5, duration: 40, ease: 'Quad.easeIn' },
                // Burst outward and fade
                { scaleX: sprite.scaleX * 1.6, scaleY: sprite.scaleY * 1.6, alpha: 0, duration: this.explodeDuration * 0.7, ease: 'Quad.easeOut',
                  onComplete: () => {
                    sprite.destroy();
                    this.sprites[r][c] = null;
                  }
                },
              ]
            });

            // Clean white flash on cell
            if (!this.turboMode) {
              const flash = this.scene.add.graphics().setDepth(11);
              const halfCell = this.cellSize / 2;
              flash.fillStyle(0xffffff, 0.5);
              flash.fillRoundedRect(
                this.getX(c) - halfCell, this.getY(r) - halfCell,
                this.cellSize, this.cellSize, 4
              );
              this.scene.tweens.add({
                targets: flash, alpha: 0, duration: 180,
                ease: 'Quad.easeOut',
                onComplete: () => flash.destroy(),
              });
            }

            // Advance multiplier
            if (this.multipliers[r][c] === 0) {
              this.multipliers[r][c] = 1; // Mark the spot
            } else if (this.multipliers[r][c] === 1) {
              this.multipliers[r][c] = 2; // First multiplier value
            } else {
              this.multipliers[r][c] = Math.min(this.multipliers[r][c] * 2, 1024);
            }
            this.drawMultiplierUI(r, c);
          }
        });
        // Redraw cell backgrounds to show the updated multiplier tints (Phase 3)
        this.drawCellBackgrounds();
      });

      // Phase 6: Show/Update tumble counter
      if (this.cascadeDepth > 0) {
        const totalSize = this.cellSize * options.gridSize;
        // Scale font and offset proportionally to cell size
        const counterFS = Math.max(14, Math.min(32, this.cellSize * 0.42));
        const counterOffset = Math.max(18, this.cellSize * 0.45);
        const counterStroke = Math.max(3, counterFS * 0.22);
        this.cascadeCounterTxt
          .setText(`TUMBLE ×${this.cascadeDepth + 1}`)
          .setPosition(this.offsetX + totalSize / 2, this.offsetY - counterOffset)
          .setFontSize(counterFS)
          .setStroke('#cc0055', counterStroke)
          .setVisible(true)
          .setScale(0.5)
          .setAlpha(0);
        
        this.scene.tweens.add({
          targets: this.cascadeCounterTxt,
          scaleX: 1, scaleY: 1, alpha: 1,
          duration: 250,
          ease: 'Back.easeOut'
        });
      }

      // Enforce max win cap
      if (totalWin > 0) {
        const maxWin = options.maxWinMultiplier * options.betAmount;
        this.cumulativeRoundWin += totalWin;

        if (this.cumulativeRoundWin >= maxWin) {
          totalWin -= (this.cumulativeRoundWin - maxWin);
          this.cumulativeRoundWin = maxWin;
          this.maxWinReached = true;
        }

        if (this.freeSpinsRemaining > 0) this.totalFreeSpinsWin += totalWin;
        
        // Find the "representative" symbol for this tumble (usually the highest paying cluster's symbol)
        let mainSymbolId = clusters[0].symbolId;
        let maxClusterSize = clusters[0].positions.length;
        for (let i = 1; i < clusters.length; i++) {
          if (clusters[i].positions.length > maxClusterSize) {
            maxClusterSize = clusters[i].positions.length;
            mainSymbolId = clusters[i].symbolId;
          }
        }

        if (this.onWinCallback) this.onWinCallback(totalWin, mainSymbolId);

        if (this.maxWinReached) {
          if (this.onMaxWinCallback) this.onMaxWinCallback(this.cumulativeRoundWin);
          this.scene.time.delayedCall(this.explodeDuration + 200, () => {
            this.finishRound();
          });
          return;
        }
      }

      // Screen-shake on big clusters for premium impact feel
      if (!this.turboMode && totalWin > 0) {
        const shakeIntensity = Math.min(clusters.reduce((sum, cl) => sum + cl.positions.length, 0) * 0.3, 4);
        if (shakeIntensity > 1.5) {
          this.scene.cameras.main.shake(120, shakeIntensity * 0.001);
        }
      }

      this.scene.time.delayedCall(this.explodeDuration + 80, () => {
        this.cascadeSymbols();
      });
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
      // Animate scatters with a premium glow burst
      scatterPositions.forEach((pos, i) => {
        const s = this.sprites[pos.r][pos.c];
        if (s) {
          // Dramatic scale pulse
          this.scene.tweens.add({
            targets: s,
            scale: s.scaleX * 1.8,
            yoyo: true,
            repeat: 1,
            duration: 300,
            delay: i * 80,
            onComplete: () => { s.destroy(); this.sprites[pos.r][pos.c] = null; }
          });
          // Rainbow glow burst
          if (this._activeEmitterCount < Grid.MAX_EMITTERS) {
            const burst = this.scene.add.particles(this.getX(pos.c), this.getY(pos.r), 'scatter', {
              speed: { min: 150, max: 500 },
              angle: { min: 0, max: 360 },
              scale: { start: 0.25, end: 0 },
              lifespan: 600,
              quantity: 6,
              blendMode: 'ADD',
            });
            burst.explode(6);
            this._activeEmitterCount++;
            this.scene.time.delayedCall(700, () => { burst.destroy(); this._activeEmitterCount--; });
          }
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
    this.cascadeCounterTxt.setVisible(false);
  }

  private finishRound() {
    this.isProcessing = false;
    this.cascadeCounterTxt.setVisible(false);
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
    this.cascadeDepth++;
    let maxDropDistance = 0;

    for (let c = 0; c < size; c++) {
      for (let r = size - 1; r >= 0; r--) {
        if (this.sprites[r][c] === null) {
          for (let k = r - 1; k >= 0; k--) {
            if (this.sprites[k][c]) {
              const sprite = this.sprites[k][c]!;
              this.sprites[r][c] = sprite;
              this.sprites[k][c] = null;
              const dropDistance = r - k;
              maxDropDistance = Math.max(maxDropDistance, dropDistance);

              // Clean fast cascade drop
              const dropDur = 80 + dropDistance * 20;
              const targetY = this.getY(r);

              this.scene.tweens.add({
                targets: sprite,
                y: targetY,
                duration: dropDur,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                  if (!sprite || !sprite.scene) return;
                  const sx = sprite.scaleX;
                  const sy = sprite.scaleY;
                  // Punchy squash landing — intensity scales with drop distance
                  const squash = Math.min(0.35, dropDistance * 0.06);
                  this.scene.tweens.chain({
                    targets: sprite,
                    tweens: [
                      { scaleY: sy * (1 - squash), scaleX: sx * (1 + squash * 0.8), y: targetY + 2, duration: 45, ease: 'Quad.easeOut' },
                      { scaleY: sy * 1.06, scaleX: sx * 0.95, y: targetY - 4, duration: 55, ease: 'Sine.easeOut' },
                      { scaleY: sy, scaleX: sx, y: targetY, duration: 40, ease: 'Sine.easeInOut' },
                    ]
                  });
                }
              });
              break;
            }
          }
        }
      }
    }

    // Wait for the longest drop to finish then fill new symbols
    const waitTime = 80 + maxDropDistance * 20 + 60;
    this.scene.time.delayedCall(waitTime, () => {
      this.fillEmpty();
      this.scene.time.delayedCall(this.postDropDelay, () => {
        this.evaluateAndCascade();
      });
    });
  }

  /** Validate server grid dimensions and symbol IDs */
  private validateServerGrid(grid?: number[][]): boolean {
    if (!grid) return false;
    const size = options.gridSize;
    if (!Array.isArray(grid) || grid.length !== size) {
      console.warn('[Grid] Invalid server grid rows:', grid?.length, 'expected:', size);
      return false;
    }
    for (let r = 0; r < size; r++) {
      if (!Array.isArray(grid[r]) || grid[r].length !== size) {
        console.warn('[Grid] Invalid server grid cols at row', r);
        return false;
      }
      for (let c = 0; c < size; c++) {
        const v = grid[r][c];
        if (typeof v !== 'number' || v < 0 || v >= this.symbolKeys.length) {
          console.warn('[Grid] Invalid symbol ID at', r, c, ':', v);
          return false;
        }
      }
    }
    return true;
  }
}
