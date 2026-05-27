import Phaser from 'phaser';
import options from '../options';
import { ClusterEvaluator } from '../helpers';
import type { GameScene } from '../scenes/GameScene';

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
  private scene: GameScene;
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
  private eventQueue: any[] = [];
  private isProcessingEvents: boolean = false;
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
  private cascadePillGfx!: Phaser.GameObjects.Graphics;

  // Callbacks
  public onWinCallback: ((winAmount: number, symbolId?: number) => void) | null = null;
  public onFreeSpinsStart: ((count: number) => void) | null = null;
  public onFreeSpinsEnd: ((totalWin: number) => void) | null = null;
  public onCompleteCallback: (() => void) | null = null;
  public onMaxWinCallback: ((totalWin: number) => void) | null = null;
  public onNextFreeSpinNeeded: (() => void) | null = null;
  public onEventProcessed: ((eventIndex: number) => void) | null = null;

  private symbolKeys = [
    'candy_0', 'candy_1', 'candy_2', 'candy_3',
    'candy_4', 'candy_5', 'candy_6', 'scatter'
  ];

  // Layout — set dynamically by Game.tsx
  public offsetX = 0;
  public offsetY = 0;
  public cellW = 100;
  public cellH = 100;

  // Dynamic timing — fast and snappy for Sugar Blast 1000 feel
  private get cascadeDelay() { return this.turboMode ? 30 : this.quickMode ? 50 : 80; }
  private get explodeDuration() { return this.turboMode ? 80 : this.quickMode ? 120 : 180; }
  private get dropDuration() { return this.turboMode ? 100 : this.quickMode ? 140 : 200; }
  private get postDropDelay() { return this.turboMode ? 100 : this.quickMode ? 160 : 250; }
  private get sweepDuration() { return this.turboMode ? 80 : this.quickMode ? 100 : 140; }
  private cellBackgrounds!: Phaser.GameObjects.Graphics;



  constructor(scene: GameScene) {
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

    this.cascadePillGfx = this.scene.add.graphics().setDepth(24).setAlpha(0);

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
   * Draw premium Sugar Blast 1000 grid interior.
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
        const audio = this.scene.audio;
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
    this.cascadePillGfx.setAlpha(0);

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
      const audio = this.scene.audio;
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
      const audio = this.scene.audio;
      if (audio && audio.stopReels) audio.stopReels();
    } catch { /* ignore */ }
    
    this.sweepComplete = false;
    this.fillEmpty();
    this.scene.time.delayedCall(this.dropDuration + 300, () => {
      this.processNextEvent();
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

  /** Seed multiplier values for buy features (Super/Ultra Free Spins). */
  public seedMultipliers(value: number): void {
    for (let r = 0; r < options.gridSize; r++) {
      for (let c = 0; c < options.gridSize; c++) {
        this.multipliers[r][c] = value;
        this.drawMultiplierUI(r, c);
      }
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

  
  public processServerEvents(events: any[]) {
    this.eventQueue = [...events];
    if (!this.isProcessingEvents) {
      this.isProcessingEvents = true;
      this.processNextEvent();
    }
  }

  private processNextEvent() {
    if (this.eventQueue.length === 0) {
      this.isProcessingEvents = false;
      this.finishRound();
      return;
    }
    
    const event = this.eventQueue.shift();

    // Notify Game.tsx that this event is being processed — enables saveEvent() for disconnect recovery
    if (event.index !== undefined && this.onEventProcessed) {
      this.onEventProcessed(event.index);
    }
    
    switch (event.type) {
      case 'reveal':
        this.processReveal(event);
        break;
      case 'winInfo':
        this.processWinInfo(event);
        break;
      case 'tumbleBoard':
        this.processTumbleBoard(event);
        break;
      case 'multiplierUpdate':
        this.processMultiplierUpdate(event);
        break;
      case 'setTotalWin':
        this.processSetTotalWin(event);
        break;
      case 'fsTrigger':
        this.processFsTrigger(event);
        break;
      case 'finalWin':
        this.processFinalWin(event);
        break;
      default:
        this.processNextEvent();
    }
  }

  private processReveal(event: any) {
    let serverGrid: number[][] | undefined;
    if (event.board) {
      const size = options.gridSize;
      serverGrid = [];
      for (let r = 0; r < size; r++) {
        serverGrid[r] = [];
        for (let c = 0; c < size; c++) {
          const cell = event.board[r]?.[c];
          if (cell && typeof cell === 'object' && typeof cell.id === 'number') {
            serverGrid[r].push(cell.id);
          } else if (typeof cell === 'number') {
            serverGrid[r].push(cell);
          } else {
            serverGrid[r].push(0);
          }
        }
      }
    }
    this.pendingServerGrid = serverGrid || null;
    if (this.sweepComplete) {
      this.executeDrop();
    } else {
      this._dropWhenReady = true;
    }
  }

  private processWinInfo(event: any) {
    const totalWin = event.totalWin;
    const clusters = event.wins;
    
    if (!clusters || clusters.length === 0) {
      this.processNextEvent();
      return;
    }

    const winPositions = new Set<string>();
    clusters.forEach((cluster: any) => {
      cluster.positions.forEach((pos: any) => winPositions.add(`${pos.row},${pos.reel !== undefined ? pos.reel : pos.col}`));
    });

    const anticipationDuration = this.turboMode ? 60 : 250;
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

        cellGlow.fillStyle(glowColor, 0.25);
        cellGlow.fillRoundedRect(cx - halfCell + pad, cy - halfCell + pad, this.cellW - pad * 2, this.cellW - pad * 2, glowRad);
        cellGlow.fillStyle(glowColor, 0.15);
        cellGlow.fillCircle(cx, cy, halfCell * 0.9);
        cellGlow.fillStyle(0xffffff, 0.12);
        cellGlow.fillCircle(cx, cy, halfCell * 0.4);

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

    let symbolIdx = 0;
    winPositions.forEach(key => {
      const [rr, cc] = key.split(',').map(Number);
      const sprite = this.sprites[rr]?.[cc];
      if (!sprite) return;
      const origSX = sprite.scaleX;
      const origSY = sprite.scaleY;
      const stagger = symbolIdx * 18;
      symbolIdx++;

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

      this.scene.tweens.add({
        targets: sprite,
        scaleX: origSX * 1.25,
        scaleY: origSY * 1.25,
        duration: anticipationDuration * 0.4,
        delay: stagger,
        ease: 'Back.easeOut',
        yoyo: true,
      });

      sprite.setTint(0xffffff);
      this.scene.time.delayedCall(anticipationDuration + stagger, () => {
        if (sprite && sprite.scene) sprite.clearTint();
      });
    });

    this.scene.time.delayedCall(anticipationDuration + 80, () => {
      cellGlowGraphics.forEach(g => { if (g && g.scene) g.destroy(); });

      clusters.forEach((cluster: any) => {
        let avgR = 0, avgC = 0;
        cluster.positions.forEach((p: any) => { avgR += p.row; avgC += (p.reel !== undefined ? p.reel : p.col); });
        avgR /= cluster.positions.length;
        avgC /= cluster.positions.length;
        const popX = this.getX(Math.round(avgC));
        const popY = this.getY(Math.round(avgR));
        const clusterWin = cluster.win;

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

        const pillPadX = Math.max(8, winPopFS * 0.6);
        const pillPadY = Math.max(3, winPopFS * 0.2);
        const pillBg = this.scene.add.graphics().setDepth(20).setAlpha(0).setScale(0.5);
        const pillW = winPop.width + pillPadX * 2;
        const pillH = winPopFS + pillPadY * 2;
        pillBg.fillStyle(0x000000, 0.55);
        pillBg.fillRoundedRect(popX - pillW / 2, popY - pillH / 2, pillW, pillH, pillH / 2);

        if (this.turboMode) {
          winPop.setScale(0.8).setAlpha(1);
          pillBg.setScale(0.8).setAlpha(1);
          
          this.scene.tweens.add({
            targets: [winPop, pillBg],
            y: `-=${this.cellW * 0.4}`,
            duration: 300,
            ease: 'Cubic.easeOut'
          });
          
          this.scene.tweens.add({
            targets: [winPop, pillBg],
            alpha: 0,
            duration: 150,
            delay: 150,
            onComplete: () => {
              if (winPop && winPop.scene) winPop.destroy();
              if (pillBg && pillBg.scene) pillBg.destroy();
            }
          });
        } else {
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
                onComplete: () => { if (winPop && winPop.scene) winPop.destroy(); if (pillBg && pillBg.scene) pillBg.destroy(); },
              });
            }
          });
        }

        // Explode animations
        cluster.positions.forEach((pos: any) => {
          const r = pos.row;
          const c = pos.reel !== undefined ? pos.reel : pos.col;
          if (this.sprites[r][c]) {
            const sprite = this.sprites[r][c]!;
            const symId = sprite.getData('symId') ?? 0;
            const symColors = [0xff8822, 0x2288ff, 0x44cc44, 0xffcc00, 0xff2222, 0x9944ff, 0x00cccc];
            const burstColor = symColors[symId % symColors.length];

            const pScale = Math.max(0.5, this.cellW / 100);
            const pQty = this.cellW < 60 ? 4 : 8;
            if (this._activeEmitterCount < Grid.MAX_EMITTERS) {
              const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.kind !== undefined ? cluster.kind : symId], {
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

            const origSX = sprite.scaleX;
            const origSY = sprite.scaleY;
            this.scene.tweens.chain({
              targets: sprite,
              tweens: [
                { scaleX: origSX * 0.4, scaleY: origSY * 0.4, angle: -15, duration: 35, ease: 'Quad.easeIn' },
                { scaleX: origSX * 1.7, scaleY: origSY * 1.7, angle: 25, alpha: 0, duration: this.explodeDuration * 0.65, ease: 'Quad.easeOut',
                  onComplete: () => {
                    sprite.destroy();
                    this.sprites[r][c] = null;
                  }
                },
              ]
            });
          }
        });
      });

      if (!this.turboMode && totalWin > 0) {
        const shakeIntensity = Math.min(clusters.reduce((sum: any, cl: any) => sum + cl.positions.length, 0) * 0.3, 4);
        if (shakeIntensity > 1.5) {
          this.scene.cameras.main.shake(120, shakeIntensity * 0.001);
        }
      }

      this.scene.time.delayedCall(this.explodeDuration + 80, () => {
        this.processNextEvent();
      });
    });
  }

  private processTumbleBoard(event: any) {
    const size = options.gridSize;
    this.cascadeDepth++;
    let maxDropDistance = 0;
    const dropCounts = Array(size).fill(0);

    for (let c = 0; c < size; c++) {
      let emptySlots = 0;
      for (let r = size - 1; r >= 0; r--) {
        if (!this.sprites[r][c]) {
          emptySlots++;
          dropCounts[c]++;
        } else if (emptySlots > 0) {
          const sprite = this.sprites[r][c]!;
          this.sprites[r + emptySlots][c] = sprite;
          this.sprites[r][c] = null;
          const dropDistance = emptySlots;
          maxDropDistance = Math.max(maxDropDistance, dropDistance);

          const dropDur = 75 + dropDistance * 22;
          const targetY = this.getY(r + emptySlots);
          const sx = sprite.scaleX;
          const sy = sprite.scaleY;
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
              const squash = Math.min(0.45, dropDistance * 0.08);
              const cs = this.cellW;
              this.scene.tweens.chain({
                targets: sprite,
                tweens: [
                  { scaleY: sy * (1 - squash), scaleX: sx * (1 + squash * 0.9), y: targetY + cs * 0.03, duration: 42, ease: 'Quad.easeOut' },
                  { scaleY: sy * 1.12, scaleX: sx * 0.92, y: targetY - cs * 0.06, duration: 55, ease: 'Sine.easeOut' },
                  { scaleY: sy * 0.94, scaleX: sx * 1.04, y: targetY + cs * 0.01, duration: 35, ease: 'Sine.easeOut' },
                  { scaleY: sy, scaleX: sx, y: targetY, duration: 30, ease: 'Sine.easeInOut' },
                ]
              });
            }
          });
        }
      }
    }

    const centerCol = Math.floor(size / 2);
    for (let c = 0; c < size; c++) {
      let currentDropIndex = 0;
      const colStagger = Math.abs(c - centerCol) * 20;
      for (let r = size - 1; r >= 0; r--) {
        if (!this.sprites[r][c]) {
          currentDropIndex++;
          const cellData = event.board[r]?.[c];
          const symId = cellData && typeof cellData.id === 'number' ? cellData.id : this.pickSymbol();
          
          const startY = this.getY(r) - (dropCounts[c] + 1) * this.cellW;
          const sprite = this.scene.add.sprite(this.getX(c), startY, this.symbolKeys[symId]);
          sprite.setData('symId', symId);
          const scale = (this.cellW * 0.85) / Math.max(sprite.width, sprite.height);
          sprite.setScale(Math.min(scale, 1));
          sprite.setDepth(10);
          sprite.setAlpha(0);

          if (symId === 7) {
            const cropRadius = Math.min(sprite.width, sprite.height) / 2;
            sprite.setCrop(sprite.width / 2 - cropRadius, sprite.height / 2 - cropRadius, cropRadius * 2, cropRadius * 2);
          }

          this.sprites[r][c] = sprite;
          const delay = colStagger + (size - 1 - r) * 10;
          const dropDur = this.dropDuration + (dropCounts[c] - currentDropIndex) * 18;
          const targetY = this.getY(r);

          this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 25, delay });

          const sx = sprite.scaleX;
          const sy = sprite.scaleY;
          this.scene.tweens.add({
            targets: sprite, scaleY: sy * 1.18, scaleX: sx * 0.88, duration: dropDur * 0.7, delay, ease: 'Quad.easeIn',
          });

          this.scene.tweens.add({
            targets: sprite, y: targetY, duration: dropDur, ease: 'Cubic.easeIn', delay,
            onComplete: () => {
              if (!sprite || !sprite.scene) return;
              const cs = this.cellW;
              this.scene.tweens.chain({
                targets: sprite,
                tweens: [
                  { scaleY: sy * 0.50, scaleX: sx * 1.35, y: targetY + cs * 0.04, duration: 45, ease: 'Quad.easeOut' },
                  { scaleY: sy * 1.15, scaleX: sx * 0.90, y: targetY - cs * 0.07, duration: 65, ease: 'Sine.easeOut' },
                  { scaleY: sy * 0.92, scaleX: sx * 1.06, y: targetY + cs * 0.01, duration: 40, ease: 'Sine.easeOut' },
                  { scaleY: sy, scaleX: sx, y: targetY, duration: 35, ease: 'Sine.easeInOut' },
                ]
              });
            }
          });
          maxDropDistance = Math.max(maxDropDistance, dropCounts[c]);
        }
      }
    }

    this.scene.time.delayedCall(this.dropDuration + 100, () => {
      try { 
        const audio = this.scene.audio;
        if (audio && audio.playCascadeDrop) {
          audio.playCascadeDrop(this.cascadeDepth);
        }
      } catch { }
    });

    const waitTime = 75 + maxDropDistance * 22 + 70 + this.postDropDelay;
    this.scene.time.delayedCall(waitTime, () => {
      this.processNextEvent();
    });
  }

  private processMultiplierUpdate(event: any) {
    const size = options.gridSize;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (event.grid[r][c] !== this.multipliers[r][c]) {
          this.multipliers[r][c] = event.grid[r][c];
          if (this.multipliers[r][c] > 0) {
            this.drawMultiplierUI(r, c);
          }
        }
      }
    }
    this.drawCellBackgrounds();
    this.scene.time.delayedCall(100, () => {
      this.processNextEvent();
    });
  }

  private processSetTotalWin(event: any) {
    if (this.onWinCallback) this.onWinCallback(event.amount, 0);
    
    if (this.cascadeDepth > 0) {
      const totalSize = this.cellW * options.gridSize;
      const counterFS = Math.max(14, Math.min(24, this.cellW * 0.35));
      const counterX = this.offsetX + totalSize / 2;
      const counterY = this.offsetY - 42; // Pin safely above Free Spins counter

      this.cascadeCounterTxt
        .setText(`TUMBLE ×${this.cascadeDepth + 1}`)
        .setPosition(counterX, counterY)
        .setFontSize(counterFS)
        .setFontFamily('"Inter", "Outfit", sans-serif')
        .setFontStyle('900')
        .setColor('#ffffff')
        .setStroke('#000000', 4)
        .setShadow(0, 2, '#000000', 4, true, true)
        .setVisible(true)
        .setScale(0.3)
        .setAlpha(0)
        .setOrigin(0.5, 0.5);

      const pillW = this.cascadeCounterTxt.width + 24;
      const pillH = counterFS + 12;
      this.cascadePillGfx.clear();
      this.cascadePillGfx.fillStyle(0x000000, 0.65);
      this.cascadePillGfx.fillRoundedRect(counterX - pillW / 2, counterY - pillH / 2, pillW, pillH, pillH / 2);
      this.cascadePillGfx.lineStyle(2, 0xff0066, 0.8);
      this.cascadePillGfx.strokeRoundedRect(counterX - pillW / 2, counterY - pillH / 2, pillW, pillH, pillH / 2);
      this.cascadePillGfx.setScale(0.3).setAlpha(0);

      this.scene.tweens.add({
        targets: [this.cascadeCounterTxt, this.cascadePillGfx],
        scaleX: 1, scaleY: 1, alpha: 1,
        duration: 300,
        ease: 'Back.easeOut'
      });
    }
    
    this.processNextEvent();
  }

  private processFsTrigger(event: any) {
    const scatterPositions: { r: number; c: number }[] = [];
    const size = options.gridSize;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.sprites[r][c]?.getData('symId') === 7) {
          scatterPositions.push({ r, c });
        }
      }
    }

    if (scatterPositions.length > 0) {
      scatterPositions.forEach((pos, i) => {
        const s = this.sprites[pos.r][pos.c];
        if (s) {
          this.scene.tweens.add({
            targets: s,
            scale: s.scaleX * 1.8,
            yoyo: true,
            repeat: 1,
            duration: 300,
            delay: i * 80,
            onComplete: () => { s.destroy(); this.sprites[pos.r][pos.c] = null; }
          });
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

      this.scene.time.delayedCall(1200, () => {
        this.freeSpinsRemaining += event.totalSpins;
        if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
        this.processNextEvent();
      });
    } else {
      this.freeSpinsRemaining += event.totalSpins;
      if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
      this.processNextEvent();
    }
  }

  private processFinalWin(event: any) {
    this.cumulativeRoundWin = event.amount;
    if (this.cumulativeRoundWin >= options.maxWinMultiplier * options.betAmount) {
      this.maxWinReached = true;
      if (this.onMaxWinCallback) this.onMaxWinCallback(this.cumulativeRoundWin);
    }
    this.processNextEvent();
  }

  private finishFreeSpins() {
    if (this.onFreeSpinsEnd) this.onFreeSpinsEnd(this.totalFreeSpinsWin);
    this.isSuperFreeSpins = false;
    this.isProcessing = false;
    this.cascadeCounterTxt.setVisible(false);
  }

  private finishRound() {
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
      return;
    }

    this.isProcessing = false;
    this.cascadeCounterTxt.setVisible(false);
    if (this.onCompleteCallback) this.onCompleteCallback();
  }
}
