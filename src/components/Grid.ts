import Phaser from 'phaser';
import options from '../options';
import { ClusterEvaluator, Cluster } from '../helpers';

export class Grid {
  private scene: Phaser.Scene;
  private sprites: (Phaser.GameObjects.Sprite | null)[][];
  private multipliers: number[][]; // 1 = normal, 2 = 2x, 4 = 4x, etc
  private multiplierTexts: (Phaser.GameObjects.Text | null)[][];
  private isProcessing: boolean = false;
  
  public onWinCallback: ((winAmount: number) => void) | null = null;
  public onCompleteCallback: (() => void) | null = null;

  private symbolKeys = [
    'candy_0', 'candy_1', 'candy_2', 'candy_3', 
    'candy_4', 'candy_5', 'candy_6', 'scatter'
  ];

  // Let's position the grid somewhere central. 
  // In portrait (720x1280), grid is 7x80 = 560px wide. 
  // offsetX = (720 - 560)/2 = 80px
  private offsetX = 80;
  private offsetY = 300; // Top margin

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const size = options.gridSize;
    this.sprites = Array.from({ length: size }, () => Array(size).fill(null));
    this.multipliers = Array.from({ length: size }, () => Array(size).fill(1));
    this.multiplierTexts = Array.from({ length: size }, () => Array(size).fill(null));

    // Initially populate
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
    // Count how many we are dropping per column to stack them above
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
          // Random 0 to 6 (7 is scatter)
          // 2% chance for scatter to make it fun
          const isScatter = Phaser.Math.Between(0, 100) > 98;
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

  public startSpin() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Reset multipliers
    for (let r = 0; r < options.gridSize; r++) {
      for (let c = 0; c < options.gridSize; c++) {
        this.multipliers[r][c] = 1;
        if (this.multiplierTexts[r][c]) {
          this.multiplierTexts[r][c]?.destroy();
          this.multiplierTexts[r][c] = null;
        }
      }
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

  private evaluateAndCascade() {
    // 1. Convert sprites to ID grid
    const size = options.gridSize;
    const idGrid: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (this.sprites[r][c]) {
                idGrid[r][c] = this.sprites[r][c]!.getData('symId');
            }
        }
    }

    // 2. Find Clusters
    const evaluator = new ClusterEvaluator(idGrid);
    const clusters = evaluator.findClusters(5);

    if (clusters.length === 0) {
        // Scatter Check Phase
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
           // Free Spins triggered! 
           if (this.onWinCallback) this.onWinCallback(scatters * 10); // small payout for scatters
           
           // Highlight scatters
           scatterPositions.forEach(pos => {
                const s = this.sprites[pos.r][pos.c];
                if (s) {
                    this.scene.tweens.add({
                        targets: s, scale: s.scaleX * 1.5, yoyo: true, repeat: 1, duration: 400,
                        onComplete: () => {
                           s.destroy();
                           this.sprites[pos.r][pos.c] = null;
                        }
                    });
                }
           });

           // Notify user or trigger text
           const fsText = this.scene.add.text(this.scene.scale.width/2, this.scene.scale.height/2, `FREE SPINS\nTRIGGERED!`, { 
                fontSize: '60px', color: '#ff00aa', fontStyle: 'bold', stroke: '#fff', strokeThickness: 8, align: 'center' 
           }).setOrigin(0.5).setDepth(20).setScale(0);
           
           this.scene.tweens.add({
                targets: fsText, scale: 1, duration: 500, ease: 'Back.easeOut', yoyo: true, hold: 1000,
                onComplete: () => {
                    fsText.destroy();
                    // Refill from scatters exploding
                    this.cascadeSymbols();
                }
           });
           return;
        }

        // Stop tumbling
        this.isProcessing = false;
        if (this.onCompleteCallback) this.onCompleteCallback();
        return;
    }

    // 3. Process Wins
    let totalWin = 0;
    clusters.forEach(cluster => {
        let sizeIndex = cluster.positions.length - 5;
        if (sizeIndex > 10) sizeIndex = 10; // Max at 15+ payout
        
        let clusterWin = options.payvalues[cluster.symbolId][sizeIndex];
        
        // Sum multipliers
        let totalMult = 0;
        cluster.positions.forEach(pos => {
            if (this.multipliers[pos.row][pos.col] > 1) {
                totalMult += this.multipliers[pos.row][pos.col];
            }
        });
        if (totalMult > 0) {
            clusterWin *= totalMult;
        }

        totalWin += clusterWin * (options.coin * options.line); // Base bet math

        // Explode
        cluster.positions.forEach(pos => {
            const r = pos.row;
            const c = pos.col;
            if (this.sprites[r][c]) {
                // Particles
                const emitter = this.scene.add.particles(this.getX(c), this.getY(r), this.symbolKeys[cluster.symbolId], {
                    speed: { min: 100, max: 300 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 0.3, end: 0 },
                    lifespan: 600,
                    quantity: 4,
                    blendMode: 'ADD'
                });
                emitter.explode(4);

                // explosion tween
                this.scene.tweens.add({
                    targets: this.sprites[r][c],
                    scale: 0,
                    alpha: 0,
                    duration: options.clusterExplodeDuration,
                    onComplete: () => {
                       this.sprites[r][c]?.destroy();
                       this.sprites[r][c] = null;
                    }
                });

                // Sugar Rush Multiplier Logic:
                // 1 = normal, 2 = wrapper (no multi), 4 = x2, 8 = x4...
                if (this.multipliers[r][c] === 1) {
                    this.multipliers[r][c] = 2; // Wrapper state
                    
                    // Draw wrapper visual
                    this.scene.add.rectangle(this.getX(c), this.getY(r), options.symbolSize * 0.9, options.symbolSize * 0.9, 0xffea00, 0.4)
                        .setDepth(1).setStrokeStyle(2, 0xffaa00);
                } else if (this.multipliers[r][c] === 2) {
                    this.multipliers[r][c] = 4; // x2 state
                } else {
                    this.multipliers[r][c] *= 2; 
                    if (this.multipliers[r][c] > 1024) this.multipliers[r][c] = 1024; // SR1000 max
                }

                // Show multiplier
                if (this.multipliers[r][c] >= 4) { // Only show x2 or more
                    const displayMult = this.multipliers[r][c] === 4 ? 2 : this.multipliers[r][c];
                    
                    if (!this.multiplierTexts[r][c]) {
                        this.multiplierTexts[r][c] = this.scene.add.text(
                            this.getX(c), this.getY(r), 
                            `x${displayMult}`, 
                            { fontSize: '24px', color: '#ffea00', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }
                        ).setOrigin(0.5).setDepth(5).setAlpha(0.9);
                    } else {
                        this.multiplierTexts[r][c]!.setText(`x${displayMult}`);
                        // Pop effect
                        this.scene.tweens.add({ targets: this.multiplierTexts[r][c], scale: 1.4, yoyo: true, duration: 150 });
                    }
                }
            }
        });
    });

    if (totalWin > 0 && this.onWinCallback) {
        this.onWinCallback(totalWin);
        // Add a "win" floating text maybe?
    }

    // 4. Cascade after explosion
    this.scene.time.delayedCall(options.clusterExplodeDuration + 50, () => {
        this.cascadeSymbols();
    });
  }

  private cascadeSymbols() {
    const size = options.gridSize;
    let anyMoved = false;

    for (let c = 0; c < size; c++) {
        for (let r = size - 1; r >= 0; r--) {
            if (this.sprites[r][c] === null) {
                // Find symbol above to pull down
                for (let k = r - 1; k >= 0; k--) {
                    if (this.sprites[k][c]) {
                        this.sprites[r][c] = this.sprites[k][c];
                        this.sprites[k][c] = null;
                        
                        this.scene.tweens.add({
                            targets: this.sprites[r][c],
                            y: this.getY(r),
                            duration: 200,
                            ease: 'Cubic.easeIn'
                        });
                        anyMoved = true;
                        break;
                    }
                }
            }
        }
    }

    // Refill logic
    this.scene.time.delayedCall(250, () => {
        this.fillEmpty();
        
        // Loop evaluation
        this.scene.time.delayedCall(600, () => {
            this.evaluateAndCascade();
        });
    });
  }
}
