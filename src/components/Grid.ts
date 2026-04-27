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
    // NOTE: fillEmpty() is NOT called here — it must be called after
    // layoutAll() sets the correct offsetX/offsetY/cellSize so that
    // sprites spawn at the right screen positions.
    this.startIdleShimmer();
  }

  /**
   * Draw premium Sugar Rush grid interior.
   * Rich candy gradient, inset column separators, warm checkerboard,
   * deep atmospheric vignette, and soft radial center glow.
   */
  public drawCellBackgrounds() {
    this.cellBackgrounds.clear();
    const size = options.gridSize;
    const totalSize = this.cellSize * size;
    const gx = this.offsetX;
    const gy = this.offsetY;

    // 1. Rich multi-stop vertical gradient (lavender → lilac → rose → peach)
    const stops = [
      { t: 0.0,  r: 200, g: 215, b: 255 }, // Soft lavender
      { t: 0.25, r: 225, g: 200, b: 250 }, // Lilac
      { t: 0.50, r: 250, g: 195, b: 235 }, // Warm rose
      { t: 0.75, r: 255, g: 210, b: 225 }, // Blush pink
      { t: 1.0,  r: 255, g: 225, b: 215 }, // Soft peach
    ];
    const gradSteps = 56;
    const stripH = totalSize / gradSteps;
    for (let i = 0; i < gradSteps; i++) {
      const t = i / (gradSteps - 1);
      let s0 = stops[0], s1 = stops[1];
      for (let j = 0; j < stops.length - 1; j++) {
        if (t >= stops[j].t && t <= stops[j + 1].t) {
          s0 = stops[j]; s1 = stops[j + 1]; break;
        }
      }
      const localT = (t - s0.t) / (s1.t - s0.t || 1);
      const cr = Math.round(s0.r + (s1.r - s0.r) * localT);
      const cg = Math.round(s0.g + (s1.g - s0.g) * localT);
      const cb = Math.round(s0.b + (s1.b - s0.b) * localT);
      this.cellBackgrounds.fillStyle((cr << 16) | (cg << 8) | cb, 1);
      this.cellBackgrounds.fillRect(gx, gy + i * stripH, totalSize, Math.ceil(stripH) + 1);
    }

    // 2. Alternating cell tint (warm checkerboard for depth and texture)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r + c) % 2 === 0) {
          this.cellBackgrounds.fillStyle(0xffffff, 0.07);
        } else {
          this.cellBackgrounds.fillStyle(0x000000, 0.04);
        }
        this.cellBackgrounds.fillRect(
          gx + c * this.cellSize, gy + r * this.cellSize,
          this.cellSize, this.cellSize
        );
      }
    }

    // 3. Column separators — thick inset lines with highlight/shadow pair
    for (let c = 1; c < size; c++) {
      const x = gx + c * this.cellSize;
      // Shadow (left side of groove)
      this.cellBackgrounds.lineStyle(1.5, 0x6644aa, 0.18);
      this.cellBackgrounds.lineBetween(x - 1, gy, x - 1, gy + totalSize);
      // Main bright separator
      this.cellBackgrounds.lineStyle(2, 0xffffff, 0.50);
      this.cellBackgrounds.lineBetween(x, gy, x, gy + totalSize);
      // Highlight (right side of groove)
      this.cellBackgrounds.lineStyle(1, 0xeeddff, 0.12);
      this.cellBackgrounds.lineBetween(x + 1, gy, x + 1, gy + totalSize);
    }
    // Row separators — delicate dotted feel
    for (let r = 1; r < size; r++) {
      const y = gy + r * this.cellSize;
      this.cellBackgrounds.lineStyle(1, 0x7766bb, 0.10);
      this.cellBackgrounds.lineBetween(gx, y + 1, gx + totalSize, y + 1);
      this.cellBackgrounds.lineStyle(1.5, 0xffffff, 0.22);
      this.cellBackgrounds.lineBetween(gx, y, gx + totalSize, y);
    }

    // 4. Deep atmospheric vignette (recessed candy machine look)
    const vigLayers = 14;
    for (let i = 0; i < vigLayers; i++) {
      const a = 0.09 - i * 0.006;
      if (a <= 0) break;
      const d = i * 2;
      this.cellBackgrounds.fillStyle(0x220033, a);
      // Top
      this.cellBackgrounds.fillRect(gx, gy + d, totalSize, 2);
      // Bottom
      this.cellBackgrounds.fillRect(gx, gy + totalSize - d - 2, totalSize, 2);
      // Left
      this.cellBackgrounds.fillRect(gx + d, gy, 2, totalSize);
      // Right
      this.cellBackgrounds.fillRect(gx + totalSize - d - 2, gy, 2, totalSize);
    }

    // 5. Radial warm glow at center (candy jar interior light)
    const cx = gx + totalSize / 2;
    const cy = gy + totalSize / 2;
    for (let i = 0; i < 8; i++) {
      const glowAlpha = 0.035 - i * 0.004;
      if (glowAlpha <= 0) break;
      this.cellBackgrounds.fillStyle(0xffddf0, glowAlpha);
      this.cellBackgrounds.fillCircle(cx, cy, totalSize * 0.22 + i * 25);
    }
  }

  /** Premium idle shimmer — random candy gets a smooth breathing glow + gentle wobble */
  private startIdleShimmer() {
    if (this._shimmerTimer) this._shimmerTimer.remove();
    this._shimmerTimer = this.scene.time.addEvent({
      delay: 2400,
      loop: true,
      callback: () => {
        if (this.isProcessing) return;
        // Pick 1 random cell for a gentle highlight
        const r = Phaser.Math.Between(0, options.gridSize - 1);
        const c = Phaser.Math.Between(0, options.gridSize - 1);
        const sprite = this.sprites[r]?.[c];
        if (sprite && !this.scene.tweens.isTweening(sprite)) {
          const origScale = sprite.scaleX;
          // Smooth breathing scale pulse
          this.scene.tweens.add({
            targets: sprite,
            scaleX: origScale * 1.12,
            scaleY: origScale * 1.12,
            yoyo: true,
            duration: 500,
            ease: 'Sine.easeInOut',
          });
          // Subtle glow flash behind the symbol
          const glow = this.scene.add.graphics().setDepth(9);
          glow.fillStyle(0xffffff, 0.12);
          glow.fillCircle(this.getX(c), this.getY(r), this.cellSize * 0.38);
          glow.setAlpha(0);
          this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0, to: 0.5 },
            yoyo: true,
            duration: 500,
            ease: 'Sine.easeInOut',
            onComplete: () => glow.destroy(),
          });
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

          const scale = (this.cellSize * 0.82) / Math.max(sprite.width, sprite.height);
          sprite.setScale(Math.min(scale, 1));
          sprite.setDepth(10);
          sprite.setAlpha(0);

          // Apply circular crop to wild/scatter to remove square backgrounds
          if (symId === 7 || symId === 8) {
            const cropRadius = Math.min(sprite.width, sprite.height) / 2;
            sprite.setCrop(
              sprite.width / 2 - cropRadius,
              sprite.height / 2 - cropRadius,
              cropRadius * 2,
              cropRadius * 2
            );
          }

          this.sprites[r][c] = sprite;

          // Stagger: column offset + row offset for a cascading waterfall feel
          const colDelay = c * 40;
          const rowDelay = (size - 1 - r) * 25;
          const delay = colDelay + rowDelay;
          const dropDur = this.dropDuration + (dropCounts[c] - currentDropIndex) * 50;

          // Fade in as it enters the grid area
          this.scene.tweens.add({
            targets: sprite,
            alpha: 1,
            duration: 80,
            delay,
          });

          // Main drop with satisfying bounce
          this.scene.tweens.add({
            targets: sprite,
            y: this.getY(r),
            duration: dropDur,
            ease: 'Bounce.easeOut',
            delay,
            onComplete: () => {
              if (!sprite || !sprite.scene) return;
              // Landing squash-and-stretch
              const sx = sprite.scaleX;
              const sy = sprite.scaleY;
              this.scene.tweens.add({
                targets: sprite,
                scaleY: sy * 0.82,
                scaleX: sx * 1.12,
                yoyo: true,
                duration: 120,
                ease: 'Quad.easeOut',
                onComplete: () => {
                  if (sprite && sprite.scene) {
                    sprite.setScale(sx, sy);
                  }
                }
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

    // Sweep old symbols — dramatic vacuum-suck exit
    for (let r = 0; r < options.gridSize; r++) {
      for (let c = 0; c < options.gridSize; c++) {
        if (this.sprites[r][c]) {
          const s = this.sprites[r][c]!;
          const delay = c * 15 + r * 10;
          // Quick upward lift, then shrink and fade
          this.scene.tweens.add({
            targets: s,
            y: s.y - this.cellSize * 0.15,
            scaleX: s.scaleX * 0.6,
            scaleY: s.scaleY * 0.6,
            alpha: 0,
            angle: Phaser.Math.Between(-25, 25),
            duration: this.sweepDuration,
            delay,
            ease: 'Quad.easeIn',
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
          const scale = (this.cellSize * 0.82) / Math.max(sprite.width, sprite.height);
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

    // A multiplier of 1 means it's just "marked". Use the tier for x2 for styling the wrapper.
    const tier = this.getMultTier(Math.max(2, mult));
    const cx = this.getX(c);
    const cy = this.getY(r);
    
    // Width scales down slightly for very large numbers, but mostly stays constant
    const badgeW = this.cellSize * 0.88;
    const badgeH = this.cellSize * 0.50;

    if (!this.multiplierGraphics[r][c]) {
      const gfx = this.scene.add.graphics().setDepth(12);
      
      // Base drop shadow
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillRoundedRect(cx - badgeW/2 + 2, cy - badgeH/2 + 4, badgeW, badgeH, 6);
      
      // Main wrapper block (golden yellow)
      gfx.fillStyle(0xffcc00, 1);
      gfx.fillRoundedRect(cx - badgeW/2, cy - badgeH/2, badgeW, badgeH, 6);

      // Left and right "dimples" / wrapper folds
      gfx.fillStyle(0xffaa00, 1);
      gfx.fillRect(cx - badgeW/2, cy - badgeH/2 + 4, 8, badgeH - 8);
      gfx.fillRect(cx + badgeW/2 - 8, cy - badgeH/2 + 4, 8, badgeH - 8);

      // Inner highlight (top curved edge)
      gfx.fillStyle(0xffeebb, 0.8);
      gfx.fillRoundedRect(cx - badgeW/2 + 10, cy - badgeH/2 + 2, badgeW - 20, badgeH * 0.3, 4);

      // Outer wrapper stroke (reddish orange)
      gfx.lineStyle(2, 0xcc2200, 1);
      gfx.strokeRoundedRect(cx - badgeW/2, cy - badgeH/2, badgeW, badgeH, 6);

      this.multiplierGraphics[r][c] = gfx;

      // Entrance animation for new wrappers
      this.scene.tweens.add({
        targets: gfx,
        scaleX: { from: 0.5, to: 1 },
        scaleY: { from: 0.5, to: 1 },
        duration: 300,
        ease: 'Back.easeOut'
      });
    } else {
      this.scene.tweens.add({
        targets: this.multiplierGraphics[r][c],
        scale: 1.2,
        yoyo: true,
        duration: 150,
        ease: 'Sine.easeInOut'
      });
    }

    if (mult > 1) {
      if (!this.multiplierTexts[r][c]) {
        const fontSize = mult >= 128 ? Math.max(14, this.cellSize * 0.30) : Math.max(18, this.cellSize * 0.38);
        const txt = this.scene.add.text(cx, cy + 2, `x${mult}`, {
          fontFamily: '"Luckiest Guy", cursive, sans-serif',
          fontSize: `${Math.round(fontSize)}px`,
          color: tier.fill,
          stroke: tier.stroke,
          strokeThickness: Math.max(3, this.cellSize * 0.08),
          shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, stroke: true, fill: true }
        }).setOrigin(0.5).setDepth(13);

        this.multiplierTexts[r][c] = txt;

        this.scene.tweens.add({
          targets: txt,
          scaleX: { from: 0.5, to: 1 },
          scaleY: { from: 0.5, to: 1 },
          duration: 300,
          ease: 'Back.easeOut'
        });
      } else {
        const txt = this.multiplierTexts[r][c]!;
        const fontSize = mult >= 128 ? Math.max(14, this.cellSize * 0.30) : Math.max(18, this.cellSize * 0.38);
        txt.setText(`x${mult}`);
        txt.setFontSize(`${Math.round(fontSize)}px`);
        txt.setColor(tier.fill);
        txt.setStroke(tier.stroke, Math.max(3, this.cellSize * 0.08));
        
        this.scene.tweens.add({
          targets: txt,
          scale: 1.3,
          yoyo: true,
          duration: 150,
          ease: 'Sine.easeInOut'
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

    // Phase 1: Anticipation highlight — bulge + golden glow on winning cells
    const anticipationDuration = this.turboMode ? 80 : 200;
    winPositions.forEach(key => {
      const [rr, cc] = key.split(',').map(Number);
      const sprite = this.sprites[rr]?.[cc];
      if (sprite) {
        // Bulge up
        this.scene.tweens.add({
          targets: sprite,
          scaleX: sprite.scaleX * 1.3,
          scaleY: sprite.scaleY * 1.3,
          duration: anticipationDuration,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
        // Golden highlight tint
        sprite.setTint(0xffffcc);
        this.scene.time.delayedCall(anticipationDuration, () => {
          if (sprite && sprite.scene) sprite.clearTint();
        });

        // Cell glow flash behind the symbol
        if (!this.turboMode && this._activeEmitterCount < Grid.MAX_EMITTERS) {
          const glow = this.scene.add.graphics().setDepth(9);
          glow.fillStyle(0xffdd44, 0.25);
          glow.fillCircle(this.getX(cc), this.getY(rr), this.cellSize * 0.45);
          glow.setAlpha(0);
          this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0, to: 0.6 },
            yoyo: true,
            duration: anticipationDuration * 0.8,
            onComplete: () => glow.destroy(),
          });
        }
      }
    });

    // Phase 2: After anticipation, process wins and explode
    this.scene.time.delayedCall(anticipationDuration + 50, () => {
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
            // Explosion particles — capped to prevent GPU overload
            if (this._activeEmitterCount < Grid.MAX_EMITTERS) {
              const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
                speed: { min: 100, max: 400 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.30, end: 0 },
                lifespan: 450,
                quantity: 5,
                blendMode: 'ADD'
              });
              emitter.explode(5);
              this._activeEmitterCount++;
              this.scene.time.delayedCall(550, () => { emitter.destroy(); this._activeEmitterCount--; });
            }

            // Secondary candy debris
            const sprite = this.sprites[r][c]!;
            const symId = sprite.getData('symId') ?? 0;
            if (this._activeEmitterCount < Grid.MAX_EMITTERS && symId < 7) {
              const debrisEmitter = this.scene.add.particles(sprite.x, sprite.y, `candy_${symId}`, {
                speed: { min: 60, max: 180 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.12, end: 0 },
                lifespan: 500,
                quantity: 3,
                gravityY: 350,
              }).setDepth(15);
              debrisEmitter.explode();
              this._activeEmitterCount++;
              this.scene.time.delayedCall(600, () => { debrisEmitter.destroy(); this._activeEmitterCount--; });
            }

            // Animate symbol destruction: shrink + spin + fade
            this.scene.tweens.add({
              targets: sprite,
              scale: 0, alpha: 0, angle: Phaser.Math.Between(-120, 120),
              duration: this.explodeDuration,
              ease: 'Quad.easeIn',
              onComplete: () => {
                sprite.destroy();
                this.sprites[r][c] = null;
              }
            });

            // Flash the cell white briefly for impact
            if (!this.turboMode) {
              const flash = this.scene.add.graphics().setDepth(11);
              flash.fillStyle(0xffffff, 0.35);
              flash.fillRect(
                this.getX(c) - this.cellSize / 2,
                this.getY(r) - this.cellSize / 2,
                this.cellSize, this.cellSize
              );
              this.scene.tweens.add({
                targets: flash, alpha: 0, duration: 200,
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
      });

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
        if (this.onWinCallback) this.onWinCallback(totalWin);

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

              // Natural gravity acceleration — longer drops take proportionally longer
              const dropDur = 120 + dropDistance * 45;
              const targetY = this.getY(r);

              this.scene.tweens.add({
                targets: sprite,
                y: targetY,
                duration: dropDur,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                  if (!sprite || !sprite.scene) return;
                  // Bounce landing squash-stretch
                  const sx = sprite.scaleX;
                  const sy = sprite.scaleY;
                  const squashAmount = Math.min(dropDistance * 0.04, 0.18);
                  this.scene.tweens.add({
                    targets: sprite,
                    scaleY: sy * (1 - squashAmount),
                    scaleX: sx * (1 + squashAmount * 0.7),
                    yoyo: true,
                    duration: 100,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                      if (sprite && sprite.scene) sprite.setScale(sx, sy);
                    }
                  });
                }
              });
              break;
            }
          }
        }
      }
    }

    // Wait for the longest drop to finish before filling new symbols
    const waitTime = 120 + maxDropDistance * 45 + 100;
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
