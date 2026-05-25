const fs = require('fs');
const path = 'frontend/src/components/Grid.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove ClusterEvaluator import
content = content.replace(/import \{ ClusterEvaluator \}.*\n/, '');

// 2. Add eventQueue to state variables
content = content.replace(/private pendingServerGrid: number\[\]\[\] \| null = null;/, `private pendingServerGrid: number[][] | null = null;
  private eventQueue: any[] = [];
  private isProcessingEvents: boolean = false;`);

// 3. Remove injectServerResult
content = content.replace(/\/\*\* Called when the API responds with the outcome \*\/\s*public injectServerResult.*?\s*\}\s*\}/s, '');

// 4. Update executeDrop to call processNextEvent instead of evaluateAndCascade
content = content.replace(/this\.evaluateAndCascade\(\);/g, 'this.processNextEvent();');

// 5. Replace evaluateAndCascade, handleNoMoreClusters, playScatterAnticipation, clearAnticipationEffects, triggerFreeSpinsFromScatters, continueAfterScatters, cascadeSymbols, validateServerGrid with our new event logic
const startIndex = content.indexOf('private evaluateAndCascade()');
if (startIndex !== -1) {
  content = content.slice(0, startIndex);
  
  const newLogic = `
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
      cluster.positions.forEach((pos: any) => winPositions.add(\`\${pos.row},\${pos.reel !== undefined ? pos.reel : pos.col}\`));
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
        const winPop = this.scene.add.text(popX, popY, \`+\${clusterWin.toFixed(2)}\`, {
          resolution: 2,
          fontFamily: '"Luckiest Guy", cursive, sans-serif',
          fontSize: \`\${Math.round(winPopFS)}px\`,
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
          winPop.setScale(0.8);
          pillBg.setScale(0.8);
          this.scene.tweens.add({
            targets: [winPop, pillBg],
            y: \`-=\${this.cellW * 0.5}\`,
            alpha: { from: 1, to: 0 },
            duration: 300,
            ease: 'Linear',
            onComplete: () => {
              if (winPop && winPop.scene) winPop.destroy();
              if (pillBg && pillBg.scene) pillBg.destroy();
            }
          });
        } else {
          this.scene.tweens.add({
            targets: [winPop, pillBg],
            y: \`-=\${this.cellW * 1.0}\`,
            scaleX: 1.1, scaleY: 1.1,
            alpha: { from: 0, to: 1 },
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: [winPop, pillBg],
                y: \`-=\${this.cellW * 0.5}\`,
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
        const audio = (this.scene as any).audio;
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
      const counterFS = Math.max(14, Math.min(36, this.cellW * 0.45));
      const counterOffset = Math.max(18, this.cellW * 0.55);
      const counterStroke = Math.max(3, counterFS * 0.25);
      const counterX = this.offsetX + totalSize / 2;
      const counterY = Math.max(counterFS + 8, this.offsetY - counterOffset);

      this.cascadeCounterTxt
        .setText(\`TUMBLE ×\${this.cascadeDepth + 1}\`)
        .setPosition(counterX, counterY)
        .setFontSize(counterFS)
        .setFontFamily('"Luckiest Guy", cursive, sans-serif')
        .setColor('#ffffff')
        .setStroke('#ff0066', counterStroke)
        .setShadow(0, 3, '#000000', 8, true, true)
        .setVisible(true)
        .setScale(0.3)
        .setAlpha(0);

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
      this.scene.time.delayedCall(2000, () => { if (pillGfx && pillGfx.scene) pillGfx.destroy(); });
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
`;
  content = content + newLogic;
}

fs.writeFileSync(path, content, 'utf8');
