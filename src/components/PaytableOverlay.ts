import Phaser from 'phaser';
import options, { BET_PRESETS } from '../options';
import { getStakeEngine } from '../engine/StakeEngineClient';
import { T } from '../helpers/I18n';

/**
 * Multi-page Game Rules / Info overlay — 7 pages matching Sugar Rush 1000.
 *
 * Page 1: Symbol Payouts + Scatter info
 * Page 2: Tumble Feature
 * Page 3: Multiplier Spots Feature
 * Page 4: Free Spins + Retrigger
 * Page 5: Game Rules (volatility, RTP, bet limits)
 * Page 6: How to Play
 * Page 7: Settings Menu / Info Screen / Bet Menu / Max Win
 */
export class PaytableOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private pages: Phaser.GameObjects.Container[] = [];
  private currentPage = 0;
  private visible = false;
  private txtPageNum!: Phaser.GameObjects.Text;

  private symbolNames = [
    'Orange Gummy Bear', 'Purple Gummy Bear', 'Red Gummy Bear',
    'Green Candy', 'Purple Candy', 'Orange Candy', 'Pink Candy'
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0).setDepth(50).setVisible(false);
    this.build();

    this.scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.resize(gameSize.width, gameSize.height);
    });
  }

  public resize(w: number, h: number) {
    const isVisible = this.visible;
    const pageIndex = this.currentPage;
    this.container.removeAll(true);
    this.pages = [];
    this.build(w, h);
    if (isVisible) {
      this.showPage(pageIndex);
    }
  }

  private build(w?: number, h?: number) {
    w = w || this.scene.scale.width;
    h = h || this.scene.scale.height;

    const logicalW = 860;
    const logicalH = 640;

    // Dark overlay
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0618, 0.97);
    bg.fillRect(-w, -h, w * 3, h * 3);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w, -h, w * 3, h * 3), Phaser.Geom.Rectangle.Contains);
    this.container.add(bg);

    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);

    const scale = Math.min(w / logicalW, h / logicalH, 1);
    pageWrapper.setScale(scale);
    pageWrapper.setPosition(
      (w - logicalW * scale) / 2,
      (h - logicalH * scale) / 2
    );

    // Title
    const isSocial = getStakeEngine().isSocialMode();
    pageWrapper.add(this.scene.add.text(logicalW / 2, 28, T('GAME RULES', isSocial), {
      fontSize: '28px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5));

    // Close button
    const closeBtn = this.scene.add.text(logicalW - 35, 26, '✕', {
      fontSize: '30px', color: '#ffffff', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4466'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));
    pageWrapper.add(closeBtn);

    // Build all 7 pages
    this.buildPage1_Symbols(pageWrapper, logicalW, logicalH);
    this.buildPage2_Tumble(pageWrapper, logicalW, logicalH);
    this.buildPage3_Multipliers(pageWrapper, logicalW, logicalH);
    this.buildPage4_FreeSpins(pageWrapper, logicalW, logicalH);
    this.buildPage5_GameRules(pageWrapper, logicalW, logicalH);
    this.buildPage6_HowToPlay(pageWrapper, logicalW, logicalH);
    this.buildPage7_Settings(pageWrapper, logicalW, logicalH);

    // Navigation — ◀ ✕ ▶ (matching Pragmatic Play style)
    const navY = logicalH - 35;
    const navCenter = logicalW / 2;

    const prevBtn = this.scene.add.text(navCenter - 50, navY, '◀', {
      fontSize: '28px', color: '#44cc44', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => this.changePage(-1));
    prevBtn.on('pointerover', () => prevBtn.setColor('#66ff66'));
    prevBtn.on('pointerout', () => prevBtn.setColor('#44cc44'));
    pageWrapper.add(prevBtn);

    const closeNavBtn = this.scene.add.text(navCenter, navY, '✕', {
      fontSize: '28px', color: '#44cc44', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeNavBtn.on('pointerdown', () => this.hide());
    closeNavBtn.on('pointerover', () => closeNavBtn.setColor('#ff4466'));
    closeNavBtn.on('pointerout', () => closeNavBtn.setColor('#44cc44'));
    pageWrapper.add(closeNavBtn);

    const nextBtn = this.scene.add.text(navCenter + 50, navY, '▶', {
      fontSize: '28px', color: '#44cc44', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => this.changePage(1));
    nextBtn.on('pointerover', () => nextBtn.setColor('#66ff66'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#44cc44'));
    pageWrapper.add(nextBtn);

    // Page indicator
    this.txtPageNum = this.scene.add.text(logicalW - 60, navY, 'Page 1/7', {
      fontSize: '14px', color: '#888888', fontStyle: 'bold'
    }).setOrigin(0.5);
    pageWrapper.add(this.txtPageNum);

    this.showPage(0);
  }

  // ─────────────────────────────────────────────
  // PAGE 1: SYMBOL PAYOUTS
  // ─────────────────────────────────────────────
  private buildPage1_Symbols(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 68;

    page.add(this.scene.add.text(w / 2, yPos, 'All symbols pay in blocks of minimum 5 symbols connected\nhorizontally or vertically. The game is played on a 7×7 grid of symbols.', {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 52;

    // Display symbols — highest paying first (left to right), in a row with payouts below
    const order = [6, 5, 4, 3, 2, 1, 0]; // Pink Candy → Orange Gummy Bear
    const colCount = 7;
    const colW = (w - 60) / colCount;
    const startX = 30;

    // Symbol icons row
    order.forEach((symId, col) => {
      const cx = startX + col * colW + colW / 2;
      const icon = this.scene.add.sprite(cx, yPos + 28, `candy_${symId}`);
      const iconScale = Math.min(0.5, 48 / Math.max(icon.width, 1));
      icon.setScale(iconScale);
      page.add(icon);
    });
    yPos += 65;

    // Payout rows — from 15+ down to 5
    const tiers = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    tiers.forEach((tier, rowIdx) => {
      const tierLabel = tier >= 15 ? '15+' : `${tier}`;
      order.forEach((symId, col) => {
        const cx = startX + col * colW + colW / 2;
        const payIdx = tier >= 15 ? 10 : tier - 5;
        const val = options.payvalues[symId][payIdx];
        const valStr = val >= 1 ? val.toFixed(2) : val.toFixed(2);
        const color = rowIdx < 2 ? '#ffe600' : rowIdx < 5 ? '#ffcc77' : '#cccccc';
        const fs = rowIdx < 2 ? '12px' : '11px';

        // Tier label on left side of first column
        if (col === 0) {
          page.add(this.scene.add.text(startX - 2, yPos + rowIdx * 28, tierLabel, {
            fontSize: '11px', color: '#999999', fontStyle: 'bold',
          }).setOrigin(1, 0));
        }

        page.add(this.scene.add.text(cx, yPos + rowIdx * 28, valStr, {
          fontSize: fs, color,
        }).setOrigin(0.5, 0));
      });
    });

    yPos += tiers.length * 28 + 15;

    // Scatter info
    const scatterIcon = this.scene.add.sprite(w / 2 - 120, yPos + 18, 'scatter');
    scatterIcon.setScale(Math.min(0.3, 50 / Math.max(scatterIcon.width, 1)));
    page.add(scatterIcon);

    page.add(this.scene.add.text(w / 2 - 65, yPos + 6, 'This is the SCATTER symbol.\nSCATTER symbol appears on all reels.', {
      fontSize: '13px', color: '#cccccc', lineSpacing: 4,
    }));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 2: TUMBLE FEATURE
  // ─────────────────────────────────────────────
  private buildPage2_Tumble(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'TUMBLE FEATURE', {
      fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 55;

    const tumbleRules = [
      'The TUMBLE FEATURE means that after every spin, winning',
      'combinations are paid and all winning symbols disappear.',
      '',
      'The remaining symbols fall to the bottom of the screen and',
      'the empty positions are replaced with new symbols coming',
      'from above.',
      '',
      'Tumbling will continue until no more winning combinations',
      'appear as a result of a tumble.',
      '',
      'All wins are added to the player\'s balance after all of the',
      'tumbles resulted from a base spin have been played.',
    ];

    tumbleRules.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '15px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 12 : 24;
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 3: MULTIPLIER SPOTS
  // ─────────────────────────────────────────────
  private buildPage3_Multipliers(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'MULTIPLIER SPOTS FEATURE', {
      fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 55;

    const multRules = [
      'Whenever a winning symbol explodes it marks its spot on the',
      'grid. After the second time a symbol explodes on the same',
      'spot a multiplier is added to the spot, starting from ×2 and',
      'doubling every time one more symbol explodes on top of it',
      'up to a maximum of ×1024.',
      '',
      'The multiplier applies to all winning combinations that hit',
      'on top of it. If more multipliers are involved in the same',
      'winning combination, they add to each other.',
      '',
      'In the base game all the marked spots with multipliers last',
      'until the end of the tumbling sequence, being cleared when',
      'there are no more tumbles.',
    ];

    multRules.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '15px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 12 : 24;
    });

    // Multiplier progression visual
    yPos += 20;
    const progLabel = '×2  →  ×4  →  ×8  →  ×16  →  ...  →  ×1024';
    page.add(this.scene.add.text(w / 2, yPos, progLabel, {
      fontSize: '18px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 4: FREE SPINS
  // ─────────────────────────────────────────────
  private buildPage4_FreeSpins(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'FREE SPINS', {
      fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 50;

    const fsRules = [
      'Hit 3, 4, 5, 6 or 7 SCATTER symbols anywhere on the screen',
      'to win 10, 12, 15, 20 or 30 free spins respectively.',
      '',
      'During the FREE SPINS round marked spots and their',
      'multipliers remain in place until the end of the round and',
      'can increase with subsequent tumbles across all of the',
      'free spins.',
      '',
      'Hit 3, 4, 5, 6 or 7 SCATTER symbols during the round',
      'anywhere on the screen to win 10, 12, 15, 20 or 30',
      'additional free spins respectively.',
      '',
      'Special reels are in play during the feature.',
    ];

    fsRules.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '15px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 12 : 24;
    });

    // Scatter table
    yPos += 20;
    const scatterTable = [
      { count: '3 Scatters', spins: '10 Free Spins' },
      { count: '4 Scatters', spins: '12 Free Spins' },
      { count: '5 Scatters', spins: '15 Free Spins' },
      { count: '6 Scatters', spins: '20 Free Spins' },
      { count: '7 Scatters', spins: '30 Free Spins' },
    ];

    scatterTable.forEach((row) => {
      page.add(this.scene.add.text(w / 2 - 80, yPos, row.count, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(1, 0));
      page.add(this.scene.add.text(w / 2 - 40, yPos, '→', {
        fontSize: '14px', color: '#ffe600',
      }).setOrigin(0.5, 0));
      page.add(this.scene.add.text(w / 2, yPos, row.spins, {
        fontSize: '14px', color: '#ffe600', fontStyle: 'bold',
      }));
      yPos += 24;
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 5: GAME RULES (Volatility, RTP, Bet Limits)
  // ─────────────────────────────────────────────
  private buildPage5_GameRules(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'GAME RULES', {
      fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 45;

    // Volatility badge
    const volBadge = this.scene.add.graphics();
    const badgeW = 200;
    volBadge.lineStyle(2, 0xffffff, 0.7);
    volBadge.strokeRoundedRect(w / 2 - badgeW / 2, yPos, badgeW, 30, 15);
    page.add(volBadge);
    page.add(this.scene.add.text(w / 2 - 30, yPos + 15, 'VOLATILITY', {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    page.add(this.scene.add.text(w / 2 + 55, yPos + 15, '⚡⚡⚡⚡⚡', {
      fontSize: '12px', color: '#ffe600',
    }).setOrigin(0.5));
    yPos += 45;

    page.add(this.scene.add.text(w / 2, yPos, 'High volatility games pay out less often on average but the chance\nto hit big wins in a short time span is higher.', {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 55;

    const rules = [
      'Only the highest win is paid per winning combination.',
      'When winning with multiple blocks all wins are added to the total win.',
      'Free spins and bonus wins are added to the payline win.',
      '',
      'All wins are multiplied by base bet.',
      'All values are expressed as actual wins in coins.',
      'Free spins win is awarded to the player after the round completes.',
      'Free spins total win in the history contains the whole win of the cycle.',
      '',
      'SPACE and ENTER buttons on the keyboard can be used to start and stop the spin.',
    ];

    rules.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '13px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 10 : 22;
    });

    yPos += 15;

    // RTP info
    const rtpInfo = [
      'The theoretical RTP of this game is 96.53%',
      'The RTP of the game when using "BUY FREE SPINS" is 96.52%',
      'The RTP of the game when using "BUY SUPER FREE SPINS" is 96.44%',
    ];
    rtpInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '13px', color: '#ffffff', align: 'center', fontStyle: 'bold',
      }).setOrigin(0.5, 0));
      yPos += 22;
    });

    yPos += 15;

    // Bet limits
    page.add(this.scene.add.text(w / 2, yPos, `MINIMUM BET: ${BET_PRESETS[0].toFixed(2)}`, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    yPos += 22;
    page.add(this.scene.add.text(w / 2, yPos, `MAXIMUM BET: ${BET_PRESETS[BET_PRESETS.length - 1].toFixed(2)}`, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    yPos += 28;

    page.add(this.scene.add.text(w / 2, yPos, 'Malfunction voids all pays and plays.', {
      fontSize: '12px', color: '#999999', fontStyle: 'italic',
    }).setOrigin(0.5, 0));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 6: HOW TO PLAY
  // ─────────────────────────────────────────────
  private buildPage6_HowToPlay(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'HOW TO PLAY', {
      fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 45;

    const howTo = [
      'Click the  ⊕  or  ⊖  buttons to change the bet value.',
      'Select the bet you want to use in the game.',
      'Press the SPIN button to play.',
    ];
    howTo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '14px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += 24;
    });

    yPos += 15;
    page.add(this.scene.add.text(w / 2, yPos, 'MAIN GAME INTERFACE', {
      fontSize: '20px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 40;

    const uiInfo = [
      '☰  opens the SETTINGS menu that contains settings which',
      '     affect the way the game is being played.',
      '',
      '▶▶▶  cycles through spin speed settings: normal speed,',
      '       quick spin and turbo spin.',
      '',
      '🔊  toggles sound and music on and off.',
      '',
      'ℹ  opens the Information page.',
      '',
      'BALANCE and BET labels show the current balance and',
      'current total bet.',
      '',
      '⊕  and  ⊖  change up or down the current bet.',
      '',
      '▶  starts the game.',
      '',
      'AUTOPLAY  opens the automatic play menu.',
      'Click the  AUTOPLAY  button again to stop it.',
    ];

    uiInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '13px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 8 : 20;
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 7: SETTINGS / INFO / BET MENU / MAX WIN
  // ─────────────────────────────────────────────
  private buildPage7_Settings(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'SETTINGS MENU', {
      fontSize: '22px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 45;

    const settingsInfo = [
      'INTRO SCREEN – toggles the introductory screen on and off',
      'AMBIENT – toggles the ambient sound and music on and off',
      'SOUND FX – toggles the game\'s sound effects on and off',
      'GAME HISTORY – opens the game history page',
    ];
    settingsInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '13px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += 22;
    });

    yPos += 20;
    page.add(this.scene.add.text(w / 2, yPos, 'INFORMATION SCREEN', {
      fontSize: '18px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 35;

    page.add(this.scene.add.text(w / 2, yPos, '◀  and  ▶  scroll between information pages', {
      fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0));
    yPos += 22;
    page.add(this.scene.add.text(w / 2, yPos, '✕  closes the information screen', {
      fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0));
    yPos += 35;

    page.add(this.scene.add.text(w / 2, yPos, 'BET MENU', {
      fontSize: '18px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 32;

    page.add(this.scene.add.text(w / 2, yPos, 'The bet menu shows the bet multiplier available in the game,\nand the current total bet in both coins and cash.', {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 40;

    page.add(this.scene.add.text(w / 2, yPos, 'Use the  ⊕  and  ⊖  buttons in the BET and COIN VALUE\nfields to change the values.', {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 45;

    // MAX WIN
    page.add(this.scene.add.text(w / 2, yPos, 'MAX WIN', {
      fontSize: '18px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5));
    yPos += 30;

    page.add(this.scene.add.text(w / 2, yPos, `The maximum win amount is limited to ${options.maxWinMultiplier.toLocaleString()}× bet.\nIf the total win of a round reaches ${options.maxWinMultiplier.toLocaleString()}× bet the round\nimmediately ends, win is awarded and all remaining\nfree spins are forfeited.`, {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    // Buy Free Spins section at the bottom
    yPos += 75;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x444444, 0.5);
    sep.lineBetween(100, yPos, w - 100, yPos);
    page.add(sep);
    yPos += 15;

    page.add(this.scene.add.text(w / 2, yPos, 'BUY FREE SPINS: Pay 100× total bet to trigger FREE SPINS.\nBUY SUPER FREE SPINS: Pay 500× total bet with ×2 starting multipliers.', {
      fontSize: '12px', color: '#999999', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE NAVIGATION
  // ─────────────────────────────────────────────
  private changePage(dir: number) {
    const newPage = this.currentPage + dir;
    if (newPage >= 0 && newPage < this.pages.length) {
      this.showPage(newPage);
    }
  }

  private showPage(index: number) {
    this.pages.forEach((p, i) => p.setVisible(i === index));
    this.currentPage = index;
    if (this.txtPageNum) {
      this.txtPageNum.setText(`Page ${index + 1}/${this.pages.length}`);
    }
  }

  public show() {
    this.visible = true;
    this.showPage(0);
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 300, ease: 'Power2' });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200, ease: 'Power2',
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible(): boolean { return this.visible; }
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}
