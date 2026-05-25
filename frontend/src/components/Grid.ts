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
  public quickMode = false;

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

  // Scatter anticipation state
  private _scatterAnticipationActive = false;
  private _anticipationOverlay: Phaser.GameObjects.Graphics | null = null;
  private _anticipationSpotlights: Phaser.GameObjects.Graphics[] = [];

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
  public cellW = 100;
  public cellH = 100;

  // Dynamic timing — fast and snappy for Sugar Rush 1000 feel
  private get cascadeDelay() { return this.turboMode ? 30 : this.quickMode ? 50 : 80; }
  private get explodeDuration() { return this.turboMode ? 80 : this.quickMode ? 120 : 180; }
  private get dropDuration() { return this.turboMode ? 100 : this.quickMode ? 140 : 200; }
  private get postDropDelay() { return this.turboMode ? 100 : this.quickMode ? 160 : 250; }
  private get sweepDuration() { return this.turboMode ? 80 : this.quickMode ? 100 : 140; }
  private cellBackgrounds!: Phaser.GameObjects.Graphics;



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
      this.cellW * options.gridSize + 10,
      this.cellW * options.gridSize + 10
    );
    this.cellBackgrounds = this.scene.add.graphics().setDepth(2);
    this.drawCellBackgrounds();

    // Generate procedural candy shard textures for debris
    this.generateDebrisTextures();

    // Phase 6: Cascade depth counter text — font scales with grid
    this.cascadeCounterTxt = this.scene.add.text(0, 0, '', {
      resolution: 2,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '22px', // Will be overridden dynamically on each display
      color: '#ffffff',
      stroke: '#cc0055',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 6, stroke: true, fill: true }
    }).setOrigin(0.5).setDepth(25).setVisible(false);

    // NOTE: fillEmpty() is NOT called here — it must be called after
    // layoutAll() sets the correct offsetX/offsetY/cellW so that
    // sprites spawn at the right screen positions.
    this.startIdleShimmer();
  }

  /**
   * Generate procedural candy shard textures for premium explosion debris.
   * Creates small triangular/polygonal fragments in each candy color.
   */
  private generateDebrisTextures() {
    const shardColors = [
      0xff8822, 0x2288ff, 0x44cc44, 0xffcc00, 0xff2222, 0x9944ff, 0x00cccc,
    ];
    shardColors.forEach((color, i) => {
      const key = `shard_${i}`;
      if (this.scene.textures.exists(key)) return;
      const g = this.scene.add.graphics();
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(0, 2);
      g.lineTo(6, 0);
      g.lineTo(10, 5);
      g.lineTo(7, 10);
      g.lineTo(1, 8);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.6);
      g.fillTriangle(2, 3, 6, 1, 5, 5);
      g.generateTexture(key, 10, 10);
      g.destroy();
    });
    if (!this.scene.textures.exists('sugar_dust')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(3, 3, 3);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(3, 2, 2);
      g.generateTexture('sugar_dust', 6, 6);
      g.destroy();
    }
  }

  /**
   * Draw premium Sugar Rush 1000 grid interior.
   * Vertical "glass tube" columns create a candy-dispenser illusion.
   * Each column has a center light highlight that fades to dark edges,
   * giving depth as if candies drop through translucent pipes.
   */
  public drawCellBackgrounds() {
    this.cellBackgrounds.clear();
    const size = options.gridSize;
    const totalW = this.cellW * size; const totalH = this.cellH * size;
    const gx = this.offsetX;
    const gy = this.offsetY;
    const cs = this.cellW;

    // Update mask geometry to match new layout
    if (this.gridMask) {
      this.gridMask.clear();
      this.gridMask.fillStyle(0x000000, 1);
      this.gridMask.fillRect(gx - 5, gy - 5, totalW + 10, totalH + 10);
    }

    // ═══ Layer 1: Deep dark base panel ═══
    this.cellBackgrounds.fillGradientStyle(
      0x10040f, 0x0a0208, 0x060105, 0x020002,
      0.95, 0.95, 0.98, 0.98
    );
    this.cellBackgrounds.fillRect(gx, gy, totalW, totalH);

    // ═══ Layer 2: Vertical Glass Tube columns ═══
    // Each column gets a translucent highlight down the center,
    // creating the illusion of cylindrical glass pipes
    for (let c = 0; c < size; c++) {
      const colX = gx + c * cs;
      const tubeCenter = colX + cs / 2;

      // Dark column edges (tube shadow)
      const edgeW = cs * 0.18;
      this.cellBackgrounds.fillStyle(0x000000, 0.35);
      this.cellBackgrounds.fillRect(colX, gy, edgeW, totalH);
      this.cellBackgrounds.fillRect(colX + cs - edgeW, gy, edgeW, totalH);

      // Center highlight (glass refraction glow)
      const glowW = cs * 0.5;
      for (let g = 0; g < 4; g++) {
        const gAlpha = 0.035 - g * 0.008;
        if (gAlpha <= 0) break;
        this.cellBackgrounds.fillStyle(0xffccee, gAlpha);
        this.cellBackgrounds.fillRect(
          tubeCenter - glowW / 2 - g * 3, gy,
          glowW + g * 6, totalH
        );
      }

      // Thin bright specular line down the tube (left-of-center)
      this.cellBackgrounds.fillStyle(0xffffff, 0.03);
      this.cellBackgrounds.fillRect(tubeCenter - cs * 0.12, gy, 2, totalH);
    }

    // ═══ Layer 3: Subtle horizontal row separators (proportional) ═══
    const sepThick = Math.max(1, cs * 0.02);
    for (let r = 1; r < size; r++) {
      const y = gy + r * cs;
      this.cellBackgrounds.fillStyle(0x000000, 0.35);
      this.cellBackgrounds.fillRect(gx, y - sepThick / 2, totalW, sepThick);
      this.cellBackgrounds.fillStyle(0xffaadd, 0.04);
      this.cellBackgrounds.fillRect(gx, y + sepThick / 2, totalW, Math.max(1, sepThick * 0.5));
    }

    // ═══ Layer 4: Column dividers (proportional tube wall seams) ═══
    for (let c = 1; c < size; c++) {
      const x = gx + c * cs;
      this.cellBackgrounds.fillStyle(0x000000, 0.6);
      this.cellBackgrounds.fillRect(x - sepThick / 2, gy, sepThick, totalH);
      this.cellBackgrounds.fillStyle(0xffddee, 0.05);
      this.cellBackgrounds.fillRect(x + sepThick / 2, gy, Math.max(1, sepThick * 0.5), totalH);
    }

    // ═══ Layer 6: Deep inset bevel (recessed candy display, proportional) ═══
    const bevelLayers = 6;
    const bevelStep = Math.max(1.5, cs * 0.025);
    const bevelThick = Math.max(1, cs * 0.02);
    for (let i = 0; i < bevelLayers; i++) {
      const a = 0.15 - i * 0.025;
      if (a <= 0) break;
      const d = i * bevelStep;
      this.cellBackgrounds.fillStyle(0x000000, a);
      // Top edge
      this.cellBackgrounds.fillRect(gx, gy + d, totalW, bevelThick);
      // Bottom edge
      this.cellBackgrounds.fillRect(gx, gy + totalH - d - bevelThick, totalW, bevelThick);
      // Left edge
      this.cellBackgrounds.fillRect(gx + d, gy, bevelThick, totalH);
      // Right edge
      this.cellBackgrounds.fillRect(gx + totalW - d - bevelThick, gy, bevelThick, totalH);
    }

    // Inner light rim (candy glass edge catching light)
    this.cellBackgrounds.lineStyle(Math.max(1, cs * 0.01), 0xffaacc, 0.15);
    this.cellBackgrounds.strokeRect(gx + 1, gy + 1, totalW - 2, totalH - 2);

    // ═══ Layer 7: Warm radial center glow ═══
    const cx = gx + totalW / 2;
    const cy = gy + totalH / 2;
    for (let i = 0; i < 6; i++) {
      const glowAlpha = 0.015 - i * 0.0025;
      if (glowAlpha <= 0) break;
      this.cellBackgrounds.fillStyle(0xffbbdd, glowAlpha);
      this.cellBackgrounds.fillCircle(cx, cy, Math.max(totalW, totalH) * 0.15 + i * 25);
    }
  }

  /**
   * Premium idle shimmer:
   * 1. Gentle breathing pulse on random symbols (soft alpha wave)
   * 2. Sparkle star glow particle that drifts across a random cell
   */
  private startIdleShimmer() {
    if (this._shimmerTimer) this._shimmerTimer.remove();
    this._shimmerTimer = this.scene.time.addEvent({
      delay: 1600,
      loop: true,
      callback: () => {
        if (this.isProcessing) return;
        // Pick 4 random cells for a breathing glow
        for (let n = 0; n < 4; n++) {
          const r = Phaser.Math.Between(0, options.gridSize - 1);
          const c = Phaser.Math.Between(0, options.gridSize - 1);
          const sprite = this.sprites[r]?.[c];
          if (sprite && !this.scene.tweens.isTweening(sprite)) {
            this.scene.time.delayedCall(n * 120, () => {
              if (!sprite || !sprite.scene) return;
              sprite.setTint(0xffffff);
              this.scene.tweens.add({
                targets: sprite,
                alpha: { from: 1, to: 0.7 },
                duration: 300,
                yoyo: true,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                  if (sprite && sprite.scene) {
                    sprite.clearTint();
                    sprite.setAlpha(1);
                  }
                }
              });
            });
          }
        }

        // Sparkle star glow on one random cell
        if (!this.isProcessing) {
          const sr = Phaser.Math.Between(0, options.gridSize - 1);
          const sc = Phaser.Math.Between(0, options.gridSize - 1);
          const sparkleGfx = this.scene.add.graphics().setDepth(14);
          const sx = this.getX(sc);
          const sy = this.getY(sr);
          const sparkleR = this.cellW * 0.18;
          // 4-pointed star sparkle
          sparkleGfx.fillStyle(0xffffff, 0.8);
          sparkleGfx.fillCircle(sx, sy, sparkleR * 0.3);
          sparkleGfx.fillStyle(0xffffff, 0.3);
          sparkleGfx.fillEllipse(sx, sy, sparkleR * 2, sparkleR * 0.4);
          sparkleGfx.fillEllipse(sx, sy, sparkleR * 0.4, sparkleR * 2);
          sparkleGfx.setAlpha(0).setScale(0.3);
          this.scene.tweens.add({
            targets: sparkleGfx,
            alpha: { from: 0, to: 1 },
            scaleX: 1.2, scaleY: 1.2,
            angle: 45,
            duration: 400,
            yoyo: true,
            ease: 'Sine.easeInOut',
            onComplete: () => sparkleGfx.destroy(),
          });
        }

        // ── Golden sparkle on multiplier cells (premium idle effect) ──
        if (!this.isProcessing) {
          for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
              if (this.multipliers[r][c] >= 2 && Math.random() < 0.12) {
                const mx = this.getX(c);
                const my = this.getY(r) + this.cellW * 0.35;
                const sparkR = Math.max(2, this.cellW * 0.04);
                const sparkle = this.scene.add.graphics().setDepth(8).setAlpha(0);
                sparkle.fillStyle(0xffee55, 0.9);
                sparkle.fillCircle(
                  mx + Phaser.Math.Between(-this.cellW * 0.2, this.cellW * 0.2),
                  my + Phaser.Math.Between(-this.cellW * 0.08, this.cellW * 0.08),
                  sparkR
                );
                sparkle.fillStyle(0xffffff, 0.7);
                sparkle.fillCircle(
                  mx + Phaser.Math.Between(-this.cellW * 0.15, this.cellW * 0.15),
                  my + Phaser.Math.Between(-this.cellW * 0.06, this.cellW * 0.06),
                  sparkR * 0.5
                );
                this.scene.tweens.add({
                  targets: sparkle,
                  alpha: { from: 0, to: 1 },
                  scaleX: { from: 0.5, to: 1.5 },
                  scaleY: { from: 0.5, to: 1.5 },
                  duration: 250,
                  yoyo: true,
                  ease: 'Sine.easeInOut',
                  onComplete: () => sparkle.destroy(),
                });
              }
            }
          }
          
          // Gentle breathing pulse on multiplier badges
          for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
              const gfx = this.multiplierGraphics[r]?.[c];
              if (gfx && gfx.scene && this.multipliers[r][c] >= 2 && !this.scene.tweens.isTweening(gfx)) {
                if (Math.random() < 0.08) {
                  this.scene.tweens.add({
                    targets: gfx,
                    scaleX: 1.06, scaleY: 1.06,
                    duration: 400,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                  });
                }
              }
            }
          }
        }
      },
    });
  }

  private getX(col: number) {
    return this.offsetX + col * this.cellW + this.cellW / 2;
  }

  private getY(row: number) {
    return this.offsetY + row * this.cellH + this.cellH / 2;
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

  /** Fill empty cells with server-provided or random symbols. Jelly physics drop. */
  public fillEmpty() {
    const size = options.gridSize;
    const dropCounts = Array(size).fill(0);

    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (!this.sprites[r][c]) dropCounts[c]++;
      }
    }

    // Waterfall stagger: columns drop from center outward
    const centerCol = Math.floor(size / 2);

    for (let c = 0; c < size; c++) {
      let currentDropIndex = 0;
      // Delay based on distance from center column (waterfall effect)
      const colStagger = Math.abs(c - centerCol) * 20;

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

          const startY = this.getY(r) - (dropCounts[c] + 1) * this.cellW;
          const sprite = this.scene.add.sprite(this.getX(c), startY, this.symbolKeys[symId]);
          sprite.setData('symId', symId);

          const scale = (this.cellW * 0.85) / Math.max(sprite.width, sprite.height);
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

          // Waterfall-staggered drop with jelly physics
          const delay = colStagger + (size - 1 - r) * 10;
          const dropDur = this.dropDuration + (dropCounts[c] - currentDropIndex) * 18;
          const targetY = this.getY(r);

          // Instant visibility
          this.scene.tweens.add({
            targets: sprite,
            alpha: 1,
            duration: 25,
            delay,
          });

          // In-flight vertical stretch (symbol elongates as it falls)
          const sx = sprite.scaleX;
          const sy = sprite.scaleY;
          this.scene.tweens.add({
            targets: sprite,
            scaleY: sy * 1.18,
            scaleX: sx * 0.88,
            duration: dropDur * 0.7,
            delay,
            ease: 'Quad.easeIn',
          });

          // Gravity fall
          this.scene.tweens.add({
            targets: sprite,
            y: targetY,
            duration: dropDur,
            ease: 'Cubic.easeIn',
            delay,
            onComplete: () => {
              if (!sprite || !sprite.scene) return;
              // Heavy 4-step squash-stretch impact landing (proportional to cell size)
              const cs = this.cellW;
              this.scene.tweens.chain({
                targets: sprite,
                tweens: [
                  // 1. Heavy pancake squash on impact
                  { scaleY: sy * 0.50, scaleX: sx * 1.35, y: targetY + cs * 0.04, duration: 45, ease: 'Quad.easeOut' },
                  // 2. Rebound overshoot upward
                  { scaleY: sy * 1.15, scaleX: sx * 0.90, y: targetY - cs * 0.07, duration: 65, ease: 'Sine.easeOut' },
                  // 3. Secondary smaller squash
                  { scaleY: sy * 0.92, scaleX: sx * 1.06, y: targetY + cs * 0.01, duration: 40, ease: 'Sine.easeOut' },
                  // 4. Settle to rest
                  { scaleY: sy, scaleX: sx, y: targetY, duration: 35, ease: 'Sine.easeInOut' },
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
          const scale = (this.cellW * 0.85) / Math.max(sprite.width, sprite.height);
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
        this.cellW * size + 10,
        this.cellW * size + 10
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
    if (mult === 0) return;

    const cx = this.getX(c);
    const cy = this.getY(r);
    const cs = this.cellW;
    
    // ── Premium golden cell background BEHIND the candy symbol ──
    const isSmallCell = cs < 55;
    // Cover the whole cell
    const badgeW = cs * 0.92;
    const badgeH = cs * 0.92;
    const badgeCX = cx;
    const badgeCY = cy;
    // Octagon chamfer for a more boxy background
    const chamfer = badgeW * 0.22;

    const getMultiplierColor = (m: number) => {
      if (m <= 1) return 0xffaadd; // Faint pink/purple footprint for marked spots
      if (m <= 2) return 0xffdd00; // Yellow
      if (m <= 4) return 0x00ccff; // Cyan/Blue
      if (m <= 8) return 0x00ff44; // Green
      if (m <= 16) return 0xff00ff; // Magenta
      if (m <= 32) return 0xff6600; // Orange
      if (m <= 64) return 0xff0044; // Pinkish Red
      return 0xff0000; // Pure Red glow for highest
    };
    const bgColor = getMultiplierColor(mult);

    const drawBadge = (gfx: Phaser.GameObjects.Graphics) => {
      gfx.clear();
      
      // For mult=1, just draw a subtle footprint
      if (mult <= 1) {
        gfx.fillStyle(0xffffff, 0.05);
        gfx.fillCircle(badgeCX, badgeCY, cs * 0.35);
        gfx.lineStyle(Math.max(1, cs * 0.02), bgColor, 0.15);
        gfx.strokeCircle(badgeCX, badgeCY, cs * 0.35);
        return;
      }
      
      // For mult > 1, draw a premium glowing orb/badge
      const radius = cs * 0.42;
      
      // 1. Soft outer glow
      gfx.fillStyle(bgColor, 0.08);
      gfx.fillCircle(badgeCX, badgeCY, radius * 1.15);
      
      // 2. Main colorful body
      gfx.fillGradientStyle(bgColor, bgColor, 0x000000, 0x000000, 0.22, 0.22, 0.12, 0.12);
      gfx.fillCircle(badgeCX, badgeCY, radius);
      
      // 3. Bright core
      gfx.fillStyle(0xffffff, 0.05);
      gfx.fillCircle(badgeCX, badgeCY, radius * 0.6);
      
      // 4. Glossy curved highlight (glass sphere effect)
      gfx.beginPath();
      gfx.arc(badgeCX, badgeCY - radius * 0.1, radius * 0.8, Math.PI + 0.3, Math.PI * 2 - 0.3, false);
      gfx.lineTo(badgeCX + radius * 0.6, badgeCY);
      gfx.arc(badgeCX, badgeCY, radius * 0.6, Math.PI * 2 - 0.3, Math.PI + 0.3, true);
      gfx.closePath();
      gfx.fillStyle(0xffffff, 0.10);
      gfx.fillPath();
      
      // 5. Border
      gfx.lineStyle(Math.max(2, cs * 0.03), bgColor, 0.35);
      gfx.strokeCircle(badgeCX, badgeCY, radius);

      // If high multiplier, add an extra glowing ring
      if (mult >= 16) {
        const pad = cs * 0.08;
        gfx.lineStyle(Math.max(3, cs * 0.04), 0xffffff, 0.18);
        gfx.strokeCircle(badgeCX, badgeCY, radius + pad);
      }
    };

    if (!this.multiplierGraphics[r][c]) {
      // Depth 8: BEHIND candy sprites (depth 10)
      const gfx = this.scene.add.graphics().setDepth(8);
      drawBadge(gfx);
      this.multiplierGraphics[r][c] = gfx;

      // Pop-in entrance with bounce
      gfx.setScale(0);
      gfx.setAlpha(0);
      this.scene.tweens.add({
        targets: gfx,
        scaleX: 1, scaleY: 1, alpha: 1,
        duration: 320,
        ease: 'Back.easeOut',
      });

      // Golden ring burst VFX on first appearance
      if (!this.turboMode) {
        const ring = this.scene.add.graphics().setDepth(7).setAlpha(0.8);
        ring.lineStyle(Math.max(2, cs * 0.03), bgColor, 1);
        ring.strokeCircle(badgeCX, badgeCY, cs * 0.42);
        this.scene.tweens.add({
          targets: ring,
          scaleX: 1.5, scaleY: 1.5, alpha: 0,
          duration: 350,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        });
      }
    } else {
      // Existing badge — redraw and play upgrade VFX
      const gfx = this.multiplierGraphics[r][c]!;
      drawBadge(gfx);
      
      // Juicy upgrade punch with overshoot
      this.scene.tweens.add({
        targets: gfx,
        scaleX: 1.3, scaleY: 1.3,
        yoyo: true,
        duration: 180,
        ease: 'Quad.easeOut',
      });

      // Golden upgrade ring burst
      if (!this.turboMode) {
        const ring = this.scene.add.graphics().setDepth(7).setAlpha(0.9);
        ring.lineStyle(Math.max(2, cs * 0.04), bgColor, 1);
        ring.strokeCircle(badgeCX, badgeCY, cs * 0.42);
        this.scene.tweens.add({
          targets: ring,
          scaleX: 1.6, scaleY: 1.6, alpha: 0,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        });
      }
    }

    // ── Multiplier text ──
    if (mult > 1) {
      // Tighter font sizing on small cells to prevent overflow
      const maxFS = isSmallCell ? 18 : 32;
      const fontSize = mult >= 128
        ? Math.max(12, Math.min(maxFS * 0.75, cs * 0.28))
        : Math.max(14, Math.min(maxFS, cs * 0.38));
      const strokeW = isSmallCell ? Math.max(2, cs * 0.04) : Math.max(3, cs * 0.06);
      if (!this.multiplierTexts[r][c]) {
        const txt = this.scene.add.text(badgeCX, badgeCY, `×${mult}`, {
          resolution: 2,
          fontFamily: '"Luckiest Guy", cursive, sans-serif',
          fontSize: `${Math.round(fontSize)}px`,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: strokeW + 2,
          shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, stroke: true, fill: true }
        }).setOrigin(0.5).setDepth(11);

        this.multiplierTexts[r][c] = txt;

        txt.setScale(0);
        txt.setAlpha(0);
        this.scene.tweens.add({
          targets: txt,
          scaleX: 1, scaleY: 1, alpha: 1,
          duration: 360,
          delay: 80,
          ease: 'Back.easeOut',
        });
      } else {
        const txt = this.multiplierTexts[r][c]!;
        txt.setText(`×${mult}`);
        txt.setFontSize(`${Math.round(fontSize)}px`);
        txt.setColor('#ffffff');
        txt.setStroke('#000000', strokeW + 2);
        txt.setDepth(11);
        
        this.scene.tweens.add({
          targets: txt,
          scaleX: 1.5, scaleY: 1.5,
          yoyo: true,
          duration: 200,
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
    // ── Aggressive anticipation jiggle (Sugar Rush 1000 style) ──
    // Winning symbols shake violently before exploding
    const anticipationDuration = this.turboMode ? 60 : 250;

    // Per-cell animated glow backgrounds — each winning cell gets a pulsating
    // colored glow in its symbol's color that persists during anticipation
    const cellGlowGraphics: Phaser.GameObjects.Graphics[] = [];
    if (!this.turboMode) {
      const halfCell = this.cellW / 2;
      const glowRad = Math.max(2, this.cellW * 0.06);
      const symGlowColors = [0xff8822, 0x2288ff, 0x44cc44, 0xffcc00, 0xff2222, 0x9944ff, 0x00cccc];
      winPositions.forEach(key => {
        const [rr, cc] = key.split(',').map(Number);
        const sprite = this.sprites[rr]?.[cc];
        const symId = sprite?.getData('symId') ?? 0;
        const glowColor = symGlowColors[symId % symGlowColors.length];

        const cellGlow = this.scene.add.graphics().setDepth(9);
        const cx = this.getX(cc);
        const cy = this.getY(rr);
        const pad = Math.max(1, this.cellW * 0.02);

        // Layered radial glow (proportional rounded rects)
        cellGlow.fillStyle(glowColor, 0.25);
        cellGlow.fillRoundedRect(cx - halfCell + pad, cy - halfCell + pad, this.cellW - pad * 2, this.cellW - pad * 2, glowRad);
        cellGlow.fillStyle(glowColor, 0.15);
        cellGlow.fillCircle(cx, cy, halfCell * 0.9);
        cellGlow.fillStyle(0xffffff, 0.12);
        cellGlow.fillCircle(cx, cy, halfCell * 0.4);

        // Pulsating glow animation
        this.scene.tweens.add({
          targets: cellGlow,
          alpha: { from: 0.4, to: 1 },
          duration: 120,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
        });
        cellGlowGraphics.push(cellGlow);
      });
    }

    // Aggressive jiggle on all winning symbols — rapid shake + scale pulse
    let symbolIdx = 0;
    winPositions.forEach(key => {
      const [rr, cc] = key.split(',').map(Number);
      const sprite = this.sprites[rr]?.[cc];
      if (!sprite) return;
      const origSX = sprite.scaleX;
      const origSY = sprite.scaleY;
      // Micro-stagger for "alive" cluster feel (20ms between symbols)
      const stagger = symbolIdx * 18;
      symbolIdx++;

      // Rapid alternating rotation jiggle
      this.scene.tweens.add({
        targets: sprite,
        angle: { from: -8, to: 8 },
        duration: 40,
        yoyo: true,
        repeat: 3,
        delay: stagger,
        ease: 'Sine.easeInOut',
        onComplete: () => { if (sprite && sprite.scene) sprite.setAngle(0); }
      });

      // Scaling pulse (quick enlarge then back)
      this.scene.tweens.add({
        targets: sprite,
        scaleX: origSX * 1.25,
        scaleY: origSY * 1.25,
        duration: anticipationDuration * 0.4,
        delay: stagger,
        ease: 'Back.easeOut',
        yoyo: true,
      });

      // White flash tint
      sprite.setTint(0xffffff);
      this.scene.time.delayedCall(anticipationDuration + stagger, () => {
        if (sprite && sprite.scene) sprite.clearTint();
      });
    });

    // ──────── Phase 2: Process wins and explode ────────
    this.scene.time.delayedCall(anticipationDuration + 80, () => {
      // Clean up cell glow graphics
      cellGlowGraphics.forEach(g => { if (g && g.scene) g.destroy(); });

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

            // Symbol color for colored effects (matches new cartoonish candy palette)
            const symColors = [0xff8822, 0x2288ff, 0x44cc44, 0xffcc00, 0xff2222, 0x9944ff, 0x00cccc];
            const burstColor = symColors[symId % symColors.length];

            // Primary burst particles — upward explosion with heavy gravity (scaled to cell size)
            const pScale = Math.max(0.5, this.cellW / 100);
            const pQty = this.cellW < 60 ? 4 : 8;
            if (this._activeEmitterCount < Grid.MAX_EMITTERS) {
              const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
                speed: { min: 100 * pScale, max: 400 * pScale },
                angle: { min: 220, max: 320 },
                scale: { start: 0.25 * pScale, end: 0 },
                lifespan: 550,
                quantity: pQty,
                gravityY: 500 * pScale,
                blendMode: 'ADD',
                alpha: { start: 1, end: 0 },
                rotate: { min: -180, max: 180 },
              });
              emitter.explode(pQty);
              this._activeEmitterCount++;
              this.scene.time.delayedCall(650, () => { emitter.destroy(); this._activeEmitterCount--; });
            }

            // Secondary candy shard debris — triangular fragments (scaled to cell size)
            const shardQty = this.cellW < 60 ? 5 : 10;
            if (this._activeEmitterCount < Grid.MAX_EMITTERS && symId < 7) {
              const shardKey = `shard_${symId}`;
              if (this.scene.textures.exists(shardKey)) {
                const shardEmitter = this.scene.add.particles(sprite.x, sprite.y, shardKey, {
                  speed: { min: 150 * pScale, max: 550 * pScale },
                  angle: { min: 0, max: 360 },
                  scale: { start: 1.5 * pScale, end: 0.2 },
                  lifespan: 800,
                  quantity: shardQty,
                  gravityY: 700 * pScale,
                  alpha: { start: 1, end: 0 },
                  rotate: { start: 0, end: 720 },
                }).setDepth(16);
                shardEmitter.explode(shardQty);
                this._activeEmitterCount++;
                this.scene.time.delayedCall(900, () => { shardEmitter.destroy(); this._activeEmitterCount--; });
              }
            }

            // Sugar dust cloud — white powdery particles rising from impact (scaled)
            const dustQty = this.cellW < 60 ? 3 : 6;
            if (this._activeEmitterCount < Grid.MAX_EMITTERS && !this.turboMode) {
              if (this.scene.textures.exists('sugar_dust')) {
                const dustEmitter = this.scene.add.particles(sprite.x, sprite.y, 'sugar_dust', {
                  speed: { min: 20 * pScale, max: 100 * pScale },
                  angle: { min: 230, max: 310 },
                  scale: { start: 1.2 * pScale, end: 0 },
                  lifespan: 700,
                  quantity: dustQty,
                  gravityY: -40 * pScale,
                  alpha: { start: 0.7, end: 0 },
                  tint: [burstColor, 0xffffff, burstColor],
                }).setDepth(15);
                dustEmitter.explode(dustQty);
                this._activeEmitterCount++;
                this.scene.time.delayedCall(800, () => { dustEmitter.destroy(); this._activeEmitterCount--; });
              }
            }

            // ── Visceral pop-and-vanish explosion ──
            // Sharp snap inward → spin burst outward → fade
            const origSX = sprite.scaleX;
            const origSY = sprite.scaleY;
            this.scene.tweens.chain({
              targets: sprite,
              tweens: [
                // Snap inward (quick squeeze)
                { scaleX: origSX * 0.4, scaleY: origSY * 0.4, angle: -15, duration: 35, ease: 'Quad.easeIn' },
                // Burst outward with spin and fade
                { scaleX: origSX * 1.7, scaleY: origSY * 1.7, angle: 25, alpha: 0, duration: this.explodeDuration * 0.65, ease: 'Quad.easeOut',
                  onComplete: () => {
                    sprite.destroy();
                    this.sprites[r][c] = null;
                  }
                },
              ]
            });

            // Symbol-colored radial burst flash on cell
            if (!this.turboMode) {
              const flash = this.scene.add.graphics().setDepth(11);
              const halfCell = this.cellW / 2;
              const flashCx = this.getX(c);
              const flashCy = this.getY(r);
              // Outer colored glow
              flash.fillStyle(burstColor, 0.35);
              flash.fillCircle(flashCx, flashCy, halfCell * 1.1);
              // Inner white-hot core
              flash.fillStyle(0xffffff, 0.6);
              flash.fillCircle(flashCx, flashCy, halfCell * 0.5);
              flash.setScale(0.4);
              this.scene.tweens.add({
                targets: flash,
                scaleX: 1.3, scaleY: 1.3, alpha: 0,
                duration: 220,
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
              
              // GRID SHOCKWAVE: High multiplier reached — golden flash + ring
              if (this.multipliers[r][c] >= 64 && !this.turboMode) {
                const shakeIntensity = 0.004 + (this.multipliers[r][c] / 1024) * 0.012;
                this.scene.cameras.main.shake(180, shakeIntensity);
                
                // Golden flash over the grid
                const gridFlash = this.scene.add.graphics().setDepth(30);
                gridFlash.fillStyle(0xffdd44, 0.3);
                gridFlash.fillRect(this.offsetX, this.offsetY, this.cellW * options.gridSize, this.cellH * options.gridSize);
                gridFlash.setBlendMode(Phaser.BlendModes.ADD);
                this.scene.tweens.add({
                  targets: gridFlash,
                  alpha: 0,
                  duration: 280,
                  ease: 'Quad.easeOut',
                  onComplete: () => gridFlash.destroy()
                });

                // Golden ring shockwave expanding from the multiplier cell
                const ringShock = this.scene.add.graphics().setDepth(29);
                const cellCX = this.getX(c);
                const cellCY = this.getY(r);
                ringShock.lineStyle(Math.max(3, this.cellW * 0.04), 0xffee55, 0.8);
                ringShock.strokeCircle(cellCX, cellCY, this.cellW * 0.3);
                this.scene.tweens.add({
                  targets: ringShock,
                  scaleX: 4, scaleY: 4, alpha: 0,
                  duration: 400,
                  ease: 'Quad.easeOut',
                  onComplete: () => ringShock.destroy()
                });
              }
            }
            this.drawMultiplierUI(r, c);
          }
        });
        // Redraw cell backgrounds to show the updated multiplier tints (Phase 3)
        this.drawCellBackgrounds();
      });

      // Premium cascade tumble counter with frosted pill backdrop
      if (this.cascadeDepth > 0) {
        const totalSize = this.cellW * options.gridSize;
        const counterFS = Math.max(14, Math.min(36, this.cellW * 0.45));
        const counterOffset = Math.max(18, this.cellW * 0.55);
        const counterStroke = Math.max(3, counterFS * 0.25);
        const counterX = this.offsetX + totalSize / 2;
        // Protect from going offscreen at top
        const counterY = Math.max(counterFS + 8, this.offsetY - counterOffset);

        this.cascadeCounterTxt
          .setText(`TUMBLE ×${this.cascadeDepth + 1}`)
          .setPosition(counterX, counterY)
          .setFontSize(counterFS)
          .setFontFamily('"Luckiest Guy", cursive, sans-serif')
          .setColor('#ffffff')
          .setStroke('#ff0066', counterStroke)
          .setShadow(0, 3, '#000000', 8, true, true)
          .setVisible(true)
          .setScale(0.3)
          .setAlpha(0);

        // Frosted pill backdrop behind text
        const pillW = this.cascadeCounterTxt.width + 30;
        const pillH = counterFS + 14;
        const pillGfx = this.scene.add.graphics().setDepth(24);
        pillGfx.fillStyle(0x000000, 0.55);
        pillGfx.fillRoundedRect(counterX - pillW / 2, counterY - pillH / 2, pillW, pillH, pillH / 2);
        pillGfx.lineStyle(1.5, 0xff0066, 0.5);
        pillGfx.strokeRoundedRect(counterX - pillW / 2, counterY - pillH / 2, pillW, pillH, pillH / 2);
        pillGfx.setScale(0.3).setAlpha(0);

        this.scene.tweens.add({
          targets: [this.cascadeCounterTxt, pillGfx],
          scaleX: 1, scaleY: 1, alpha: 1,
          duration: 300,
          ease: 'Back.easeOut'
        });
        // Auto-destroy pill when cascade counter hides
        this.scene.time.delayedCall(2000, () => { if (pillGfx && pillGfx.scene) pillGfx.destroy(); });
      }

      // Floating win popup per cluster (shows win amount rising from cluster center)
      if (totalWin > 0 && !this.turboMode) {
        clusters.forEach(cluster => {
          // Find cluster center position
          let avgR = 0, avgC = 0;
          cluster.positions.forEach(p => { avgR += p.row; avgC += p.col; });
          avgR /= cluster.positions.length;
          avgC /= cluster.positions.length;
          const popX = this.getX(Math.round(avgC));
          const popY = this.getY(Math.round(avgR));
          const clusterWin = options.payvalues[cluster.symbolId][Math.min(cluster.positions.length - 5, 10)] * options.betAmount;

          const winPopFS = Math.max(14, Math.min(28, this.cellW * 0.38));
          const winPop = this.scene.add.text(popX, popY, `+${clusterWin.toFixed(2)}`, {
            resolution: 2,
            fontFamily: '"Luckiest Guy", cursive, sans-serif',
            fontSize: `${Math.round(winPopFS)}px`,
            color: '#ffee00',
            stroke: '#cc4400',
            strokeThickness: Math.max(3, winPopFS * 0.18),
            shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 5, stroke: true, fill: true },
          }).setOrigin(0.5).setDepth(21).setScale(0.5).setAlpha(0);

          // Frosted pill backdrop behind win text
          const pillPadX = Math.max(8, winPopFS * 0.6);
          const pillPadY = Math.max(3, winPopFS * 0.2);
          const pillBg = this.scene.add.graphics().setDepth(20).setAlpha(0).setScale(0.5);
          const pillW = winPop.width + pillPadX * 2;
          const pillH = winPopFS + pillPadY * 2;
          pillBg.fillStyle(0x000000, 0.55);
          pillBg.fillRoundedRect(popX - pillW / 2, popY - pillH / 2, pillW, pillH, pillH / 2);

          this.scene.tweens.add({
            targets: [winPop, pillBg],
            y: `-=${this.cellW * 1.0}`,
            scaleX: 1.1, scaleY: 1.1,
            alpha: { from: 0, to: 1 },
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: [winPop, pillBg],
                y: `-=${this.cellW * 0.5}`,
                alpha: 0,
                duration: 350,
                delay: 200,
                ease: 'Quad.easeIn',
                onComplete: () => { winPop.destroy(); pillBg.destroy(); },
              });
            }
          });
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

    // ═══════════════════════════════════════════════════════════════
    // SCATTER ANTICIPATION — "THE TEASE" (AAA Standard)
    // When 2+ scatters detected, dim grid, spotlight scatter positions,
    // play dramatic reveal sequence before announcing free spins
    // ═══════════════════════════════════════════════════════════════
    if (scatters >= 2 && !this.turboMode) {
      this.playScatterAnticipation(scatterPositions, scatters, () => {
        this.clearAnticipationEffects();
        if (scatters >= 3) {
          this.triggerFreeSpinsFromScatters(scatterPositions, scatters);
        } else {
          // Only 2 scatters — tease ends, resume normal flow
          this.continueAfterScatters();
        }
      });
      return;
    }

    if (scatters >= 3) {
      this.triggerFreeSpinsFromScatters(scatterPositions, scatters);
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

  /**
   * Play the scatter anticipation sequence — dims the grid, spotlights scatter
   * positions with pulsating beams, and creates dramatic tension.
   */
  private playScatterAnticipation(
    scatterPositions: { r: number; c: number }[],
    scatterCount: number,
    onComplete: () => void
  ) {
    this._scatterAnticipationActive = true;
    const totalW = this.cellW * options.gridSize;
    const totalH = this.cellH * options.gridSize;

    // 1. Dim overlay over the entire grid
    this._anticipationOverlay = this.scene.add.graphics().setDepth(17);
    this._anticipationOverlay.fillStyle(0x000000, 0);
    this._anticipationOverlay.fillRect(this.offsetX, this.offsetY, totalW, totalH);
    // Fade in the dim
    const overlayTarget = { alpha: 0 };
    this.scene.tweens.add({
      targets: overlayTarget,
      alpha: 0.6,
      duration: 400,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        if (this._anticipationOverlay && this._anticipationOverlay.scene) {
          this._anticipationOverlay.clear();
          this._anticipationOverlay.fillStyle(0x000000, overlayTarget.alpha);
          this._anticipationOverlay.fillRect(this.offsetX, this.offsetY, totalW, totalH);
        }
      }
    });

    // 2. Spotlight beams on each scatter position
    scatterPositions.forEach((pos, i) => {
      const sx = this.getX(pos.c);
      const sy = this.getY(pos.r);
      const spotlight = this.scene.add.graphics().setDepth(18).setAlpha(0);

      // Draw radial spotlight cone
      spotlight.fillStyle(0xffdd00, 0.25);
      spotlight.fillCircle(sx, sy, this.cellW * 0.8);
      spotlight.fillStyle(0xffffff, 0.35);
      spotlight.fillCircle(sx, sy, this.cellW * 0.4);

      this._anticipationSpotlights.push(spotlight);

      // Fade in with stagger
      this.scene.tweens.add({
        targets: spotlight,
        alpha: 1,
        duration: 300,
        delay: i * 150,
        ease: 'Sine.easeOut'
      });

      // Pulsating heartbeat effect on scatter symbols
      const scatter = this.sprites[pos.r]?.[pos.c];
      if (scatter) {
        const origScale = scatter.scaleX;
        
        this.scene.tweens.add({
          targets: scatter,
          scaleX: origScale * 1.3,
          scaleY: origScale * 1.3,
          duration: 350,
          yoyo: true,
          repeat: 3,
          delay: 400 + i * 100,
          ease: 'Sine.easeInOut',
        });
      }

      // Spotlight pulse
      this.scene.tweens.add({
        targets: spotlight,
        alpha: { from: 0.6, to: 1 },
        duration: 400,
        yoyo: true,
        repeat: 3,
        delay: 400,
        ease: 'Sine.easeInOut',
      });
    });

    // 3. Camera heartbeat pulse (subtle zoom in/out)
    this.scene.cameras.main.zoomTo(1.015, 350, 'Sine.easeInOut');
    this.scene.time.delayedCall(350, () => {
      this.scene.cameras.main.zoomTo(1, 350, 'Sine.easeInOut');
    });

    // 4. Screen shake buildup
    this.scene.time.delayedCall(800, () => {
      this.scene.cameras.main.shake(300, 0.003);
    });

    // Duration of anticipation scales with scatter count
    const anticipationDuration = scatterCount >= 3 ? 2200 : 1800;
    this.scene.time.delayedCall(anticipationDuration, onComplete);
  }

  /** Clean up all anticipation visual effects */
  private clearAnticipationEffects() {
    this._scatterAnticipationActive = false;
    if (this._anticipationOverlay && this._anticipationOverlay.scene) {
      this.scene.tweens.add({
        targets: this._anticipationOverlay,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          if (this._anticipationOverlay) {
            this._anticipationOverlay.destroy();
            this._anticipationOverlay = null;
          }
        }
      });
    }
    this._anticipationSpotlights.forEach(s => {
      if (s && s.scene) {
        this.scene.tweens.add({
          targets: s,
          alpha: 0,
          duration: 200,
          onComplete: () => s.destroy()
        });
      }
    });
    this._anticipationSpotlights = [];
  }

  /** Trigger free spins from scatter wins with premium glow burst */
  private triggerFreeSpinsFromScatters(
    scatterPositions: { r: number; c: number }[],
    scatterCount: number
  ) {
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

    const fsAwarded = options.freeSpinsByScatter[Math.min(scatterCount, 7)] || 10;
    this.freeSpinsRemaining += fsAwarded;

    if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);

    // Delay for scatter animation, then cascade
    this.scene.time.delayedCall(1200, () => {
      this.cascadeSymbols();
    });
  }

  /** Continue normal flow after scatter anticipation (< 3 scatters) */
  private continueAfterScatters() {
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

              // Jelly physics cascade drop
              const dropDur = 75 + dropDistance * 22;
              const targetY = this.getY(r);
              const sx = sprite.scaleX;
              const sy = sprite.scaleY;

              // In-flight vertical stretch (elongate while falling, capped)
              const stretchY = Math.min(0.18, dropDistance * 0.04);
              const squishX = Math.min(0.12, dropDistance * 0.025);
              this.scene.tweens.add({
                targets: sprite,
                scaleY: sy * (1 + stretchY),
                scaleX: sx * (1 - squishX),
                duration: dropDur * 0.6,
                ease: 'Quad.easeIn',
              });

              this.scene.tweens.add({
                targets: sprite,
                y: targetY,
                duration: dropDur,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                  if (!sprite || !sprite.scene) return;
                  // Heavy squash landing — intensity scales with drop distance (proportional to cell size)
                  const squash = Math.min(0.45, dropDistance * 0.08);
                  const cs = this.cellW;
                  this.scene.tweens.chain({
                    targets: sprite,
                    tweens: [
                      // 1. Heavy pancake squash
                      { scaleY: sy * (1 - squash), scaleX: sx * (1 + squash * 0.9), y: targetY + cs * 0.03, duration: 42, ease: 'Quad.easeOut' },
                      // 2. Rebound overshoot
                      { scaleY: sy * 1.12, scaleX: sx * 0.92, y: targetY - cs * 0.06, duration: 55, ease: 'Sine.easeOut' },
                      // 3. Secondary squash
                      { scaleY: sy * 0.94, scaleX: sx * 1.04, y: targetY + cs * 0.01, duration: 35, ease: 'Sine.easeOut' },
                      // 4. Settle
                      { scaleY: sy, scaleX: sx, y: targetY, duration: 30, ease: 'Sine.easeInOut' },
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
    const waitTime = 75 + maxDropDistance * 22 + 70;
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
