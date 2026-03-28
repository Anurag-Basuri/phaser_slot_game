import Phaser from 'phaser';
import options from '../options';
import { ClusterEvaluator, Cluster } from '../helpers';

export class Grid {
  private scene: Phaser.Scene;
  private sprites: (Phaser.GameObjects.Sprite | null)[][];
  private multipliers: number[][]; // 1 = normal, 2 = wrapper, 4 = x2, etc. (Max 1024)
  private multiplierGraphics: (Phaser.GameObjects.Graphics | null)[][];
  private multiplierTexts: (Phaser.GameObjects.Text | null)[][];
  
  public isProcessing: boolean = false;
  
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

  private offsetX: number;
  private offsetY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.offsetX = x;
    this.offsetY = y;
    
    const size = options.gridSize;
    this.sprites = Array.from({ length: size }, () => Array(size).fill(null));
    this.multipliers = Array.from({ length: size }, () => Array(size).fill(1));
    this.multiplierGraphics = Array.from({ length: size }, () => Array(size).fill(null));
    this.multiplierTexts = Array.from({ length: size }, () => Array(size).fill(null));

    this.fillEmpty();
  }

  private getX(col: number) {
    return this.offsetX + col * options.symbolSize + options.symbolSize / 2;
  }

  private getY(row: number) {
    return this.offsetY + row * options.symbolSize + options.symbolSize / 2;
  }

  public fillEmpty() {
    const size = options.gridSize;
    const dropCounts = Array(size).fill(0);
    
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (!this.sprites[r][c]) {
          dropCounts[c]++;
        }
      }
    }

    for (let c = 0; c < size; c++) {
      let currentDropIndex = 0;
      for (let r = size - 1; r >= 0; r--) {
        if (!this.sprites[r][c]) {
          currentDropIndex++;
          // 4% chance for scatter to make it fun
          const isScatter = Phaser.Math.Between(0, 100) > 96;
          const symId = isScatter ? 7 : Phaser.Math.Between(0, 6);
          
          const startY = this.getY(r) - (dropCounts[c] + 1) * options.symbolSize;

          const sprite = this.scene.add.sprite(
            this.getX(c), 
            startY, 
            this.symbolKeys[symId]
          );
          sprite.setData('symId', symId);
          
          let scale = (options.symbolSize * 0.9) / sprite.width;
          if (scale > 1) scale = 1;
          sprite.setScale(scale);
          sprite.setDepth(10);
          
          this.sprites[r][c] = sprite;

          this.scene.tweens.add({
            targets: sprite,
            y: this.getY(r),
            duration: 400 + (dropCounts[c] - currentDropIndex) * 100,
            ease: 'Bounce.easeOut'
          });
        }
      }
    }
  }

  // triggerType: 0 = Normal, 1 = FS Buy, 2 = Super FS Buy
  public startSpin(triggerType: number = 0) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Reset multipliers ONLY if we are not in free spins
    if (this.freeSpinsRemaining === 0) {
        this.totalFreeSpinsWin = 0;
        for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
                this.multipliers[r][c] = 1;
                if (this.multiplierGraphics[r][c]) {
                    this.multiplierGraphics[r][c]?.destroy();
                    this.multiplierGraphics[r][c] = null;
                }
                if (this.multiplierTexts[r][c]) {
                    this.multiplierTexts[r][c]?.destroy();
                    this.multiplierTexts[r][c] = null;
                }
            }
        }
    }

    // Handle Buy Features Pre-seeding
    if (triggerType === 1) {
        this.freeSpinsRemaining = 10;
        if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
    } else if (triggerType === 2) {
        this.isSuperFreeSpins = true;
        this.freeSpinsRemaining = 10;
        if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);
        
        // Super Sugar Rush logic: center spots pre-seeded
        // Draw wrapper graphics
        const seedPoints = [
            {r: 3, c: 3, m: 16}, {r: 2, c: 3, m: 8}, {r: 4, c: 3, m: 8},
            {r: 3, c: 2, m: 8}, {r: 3, c: 4, m: 8},
            {r: 2, c: 2, m: 4}, {r: 2, c: 4, m: 4}, {r: 4, c: 2, m: 4}, {r: 4, c: 4, m: 4}
        ];
        seedPoints.forEach(p => {
            this.multipliers[p.r][p.c] = p.m;
            this.drawMultiplierUI(p.r, p.c);
        });
    }

    // Drop all symbols
    this.scene.time.delayedCall(100, () => {
        // Destroy existing
        for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
              if (this.sprites[r][c]) {
                const s = this.sprites[r][c]!;
                this.scene.tweens.add({
                    targets: s,
                    y: s.y + 600,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => { s.destroy(); }
                });
                this.sprites[r][c] = null;
              }
            }
        }
        
        this.scene.time.delayedCall(300, () => {
            this.fillEmpty();
            this.scene.time.delayedCall(1000, () => {
                this.evaluateAndCascade();
            });
        });
    });
  }

  private drawMultiplierUI(r: number, c: number) {
      const displayMult = this.multipliers[r][c] === 2 ? 0 : this.multipliers[r][c] === 4 ? 2 : this.multipliers[r][c];
      
      if (!this.multiplierGraphics[r][c]) {
          const graphics = this.scene.add.graphics().setDepth(1);
          graphics.fillStyle(0xffea00, 0.4);
          graphics.fillRoundedRect(this.getX(c) - options.symbolSize/2 + 2, this.getY(r) - options.symbolSize/2 + 2, options.symbolSize - 4, options.symbolSize - 4, 12);
          graphics.lineStyle(4, 0xffaa00, 1);
          graphics.strokeRoundedRect(this.getX(c) - options.symbolSize/2 + 2, this.getY(r) - options.symbolSize/2 + 2, options.symbolSize - 4, options.symbolSize - 4, 12);
          this.multiplierGraphics[r][c] = graphics;
      }

      if (this.multipliers[r][c] >= 4) {
          if (!this.multiplierTexts[r][c]) {
              this.multiplierTexts[r][c] = this.scene.add.text(
                  this.getX(c), this.getY(r), 
                  `x${displayMult}`, 
                  { fontSize: '28px', color: '#ffea00', fontStyle: 'bold', stroke: '#0055ff', strokeThickness: 6 }
              ).setOrigin(0.5).setDepth(5).setAlpha(0.9);
          } else {
              this.multiplierTexts[r][c]!.setText(`x${displayMult}`);
              this.scene.tweens.add({ targets: this.multiplierTexts[r][c], scale: 1.4, yoyo: true, duration: 200 });
          }
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
        // Evaluate Scatters End of Tumble
        let scatters = 0;
        const scatterPositions: {r: number, c: number}[] = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (idGrid[r][c] === 7) {
                    scatters++;
                    scatterPositions.push({r, c});
                }
            }
        }

        if (scatters >= 3) {
           scatterPositions.forEach(pos => {
                const s = this.sprites[pos.r][pos.c];
                if (s) {
                    this.scene.tweens.add({
                        targets: s, scale: s.scaleX * 1.5, yoyo: true, repeat: 1, duration: 400,
                        onComplete: () => { s.destroy(); this.sprites[pos.r][pos.c] = null; }
                    });
                }
           });

           const newFS = 10;
           this.freeSpinsRemaining += newFS;
           
           const fsText = this.scene.add.text(this.scene.scale.width/2, this.scene.scale.height/2, `${newFS} FREE SPINS\nTRIGGERED!`, { 
                fontSize: '80px', color: '#ff00aa', fontStyle: 'bold', stroke: '#fff', strokeThickness: 12, align: 'center' 
           }).setOrigin(0.5).setDepth(20).setScale(0);
           
           if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining);

           this.scene.tweens.add({
                targets: fsText, scale: 1, duration: 500, ease: 'Back.easeOut', yoyo: true, hold: 1500,
                onComplete: () => {
                    fsText.destroy();
                    this.cascadeSymbols(); // refill scatters
                }
           });
           return;
        }

        // Tumble completely over
        if (this.freeSpinsRemaining > 0) {
            this.freeSpinsRemaining--;
            
            if (this.freeSpinsRemaining > 0) {
                // Next free spin!
                if (this.onFreeSpinsStart) this.onFreeSpinsStart(this.freeSpinsRemaining); // Update label
                this.scene.time.delayedCall(1200, () => {
                    this.isProcessing = false; 
                    this.startSpin(); // Start next free spin
                });
            } else {
                // Free spins completely over
                if (this.onFreeSpinsEnd) this.onFreeSpinsEnd(this.totalFreeSpinsWin);
                this.isSuperFreeSpins = false;
                this.isProcessing = false;
                if (this.onCompleteCallback) this.onCompleteCallback();
            }
        } else {
            // Normal base game tumble over
            this.isProcessing = false;
            if (this.onCompleteCallback) this.onCompleteCallback();
        }
        return;
    }

    // Process Wins
    let totalWin = 0;
    clusters.forEach(cluster => {
        let sizeIndex = cluster.positions.length - 5;
        if (sizeIndex > 10) sizeIndex = 10;
        
        let clusterWin = options.payvalues[cluster.symbolId][sizeIndex];
        
        let totalMult = 0;
        cluster.positions.forEach(pos => {
            if (this.multipliers[pos.row][pos.col] > 1) {
                totalMult += this.multipliers[pos.row][pos.col] === 2 ? 0 : (this.multipliers[pos.row][pos.col] === 4 ? 2 : this.multipliers[pos.row][pos.col]);
            }
        });
        if (totalMult > 0) {
            clusterWin *= totalMult;
        }

        totalWin += clusterWin * (options.coin * options.line); // Base bet math

        cluster.positions.forEach(pos => {
            const r = pos.row;
            const c = pos.col;
            if (this.sprites[r][c]) {
                const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
                    speed: { min: 100, max: 400 }, angle: { min: 0, max: 360 }, scale: { start: 0.4, end: 0 }, lifespan: 600, quantity: 5, blendMode: 'ADD'
                });
                emitter.explode(5);

                this.scene.tweens.add({
                    targets: this.sprites[r][c], scale: 0, alpha: 0, duration: options.clusterExplodeDuration,
                    onComplete: () => { this.sprites[r][c]?.destroy(); this.sprites[r][c] = null; }
                });

                if (this.multipliers[r][c] === 1) {
                    this.multipliers[r][c] = 2; // Wrapper
                } else if (this.multipliers[r][c] === 2) {
                    this.multipliers[r][c] = 4; // x2
                } else {
                    this.multipliers[r][c] *= 2; 
                    if (this.multipliers[r][c] > 1024) this.multipliers[r][c] = 1024;
                }

                this.drawMultiplierUI(r, c);
            }
        });
    });

    if (totalWin > 0) {
        if (this.freeSpinsRemaining > 0) {
            this.totalFreeSpinsWin += totalWin;
        }
        if (this.onWinCallback) this.onWinCallback(totalWin);
    }

    this.scene.time.delayedCall(options.clusterExplodeDuration + 100, () => {
        this.cascadeSymbols();
    });
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
                            targets: this.sprites[r][c], y: this.getY(r), duration: 200, ease: 'Cubic.easeIn'
                        });
                        break;
                    }
                }
            }
        }
    }

    this.scene.time.delayedCall(250, () => {
        this.fillEmpty();
        this.scene.time.delayedCall(600, () => {
            this.evaluateAndCascade();
        });
    });
  }
}
