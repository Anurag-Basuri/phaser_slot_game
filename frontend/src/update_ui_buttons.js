const fs = require('fs');

let code = fs.readFileSync('d:/projects/phaser_slot_game/frontend/src/scenes/Game.tsx', 'utf8');

const buyStart = `  private drawBuyPanel(gfx: Phaser.GameObjects.Graphics, w: number, h: number, isSuper: boolean) {`;
const buyEnd = `  private drawAnteBetButton(bw: number, bh: number) {`;
const buyIndexStart = code.indexOf(buyStart);
const buyIndexEnd = code.indexOf(buyEnd);

if (buyIndexStart !== -1 && buyIndexEnd !== -1) {
  const replacement = `  private drawBuyPanel(gfx: Phaser.GameObjects.Graphics, w: number, h: number, isSuper: boolean) {
    gfx.clear();
    const r = 16;
    const accentTop = isSuper ? 0xffcc00 : 0xff3388;
    const accentMid = isSuper ? 0xff8800 : 0xff0055;
    const accentDark = isSuper ? 0x662200 : 0x440022;
    const baseDark = 0x110518;
    
    // Soft outer glow
    gfx.fillStyle(accentMid, 0.15);
    gfx.fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, r + 4);
    
    // Drop shadow
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, r);
    
    // Base gradient background
    gfx.fillGradientStyle(baseDark, baseDark, accentDark, accentDark, 0.95);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // Top half vibrant gradient
    gfx.fillGradientStyle(accentTop, accentTop, accentMid, accentMid, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h * 0.55, {tl: r, tr: r, bl: 0, br: 0} as any);

    // Glass reflection (Top rim)
    gfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.35, 0.35, 0, 0);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.25, {tl: r-2, tr: r-2, bl: 0, br: 0} as any);

    // Side highlights for 3D bevel
    gfx.lineStyle(2, 0xffffff, 0.15);
    gfx.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, r - 1);

    // Outer thick colored border
    gfx.lineStyle(3, accentMid, 1);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    
    // Extra white outer ring for pop
    gfx.lineStyle(1.5, 0xffffff, 0.8);
    gfx.strokeRoundedRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, r + 1);
  }

`;
  code = code.slice(0, buyIndexStart) + replacement + code.slice(buyIndexEnd);
}

const anteStart = `  private drawAnteBetButton(bw: number, bh: number) {`;
const anteEnd = `  private drawBetButton(gfx: Phaser.GameObjects.Graphics, targetX: number, targetY: number, size: number, isPlus: boolean) {`;
const anteIndexStart = code.indexOf(anteStart);
const anteIndexEnd = code.indexOf(anteEnd);

if (anteIndexStart !== -1 && anteIndexEnd !== -1) {
  const replacement = `  private drawAnteBetButton(bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = -bw / 2;
    const y = -bh / 2;
    const rad = Math.min(18, bh / 2);

    if (options.anteBetEnabled) {
      // Premium Active - Golden Glass
      this.anteBetBtn.fillStyle(0x000000, 0.5);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 4, bw, bh, rad);
      
      this.anteBetBtn.fillGradientStyle(0xffa500, 0xffa500, 0x994400, 0x994400, 1);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);
      
      this.anteBetBtn.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.4, 0.4, 0, 0);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.45, {tl: rad-2, tr: rad-2, bl: 0, br: 0} as any);
      
      this.anteBetBtn.lineStyle(2, 0xffffff, 0.6);
      this.anteBetBtn.strokeRoundedRect(x + 1, y + 1, bw - 2, bh - 2, rad - 1);
      
      this.anteBetBtn.lineStyle(3, 0xffeebb, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetBtn.lineStyle(6, 0xffaa00, 0.25);
      this.anteBetBtn.strokeRoundedRect(x - 3, y - 3, bw + 6, bh + 6, rad + 3);

      this.anteBetTxt.setColor('#ffffff').setShadow(0, 2, '#000000', 0, true, true);
      this.anteBetIcon.setColor('#ffffff').setShadow(0, 0, '#ffcc00', 6, true, true);
    } else {
      // Premium Inactive - Dark Glass
      this.anteBetBtn.fillStyle(0x000000, 0.5);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 4, bw, bh, rad);
      
      this.anteBetBtn.fillGradientStyle(0x2a1a3a, 0x2a1a3a, 0x110518, 0x110518, 0.95);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);
      
      this.anteBetBtn.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.1, 0.1, 0, 0);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.4, {tl: rad-2, tr: rad-2, bl: 0, br: 0} as any);

      this.anteBetBtn.lineStyle(2, 0x442266, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt.setColor('#8877aa').setShadow(0, 0, '#000000', 0, false, false);
      this.anteBetIcon.setColor('#ff8844').setShadow(0, 0, '#000', 0, false, false);
    }
  }

`;
  code = code.slice(0, anteIndexStart) + replacement + code.slice(anteIndexEnd);
}

const betStart = `  private drawBetButton(gfx: Phaser.GameObjects.Graphics, targetX: number, targetY: number, size: number, isPlus: boolean) {`;
const betEnd = `  /** Update spin button visual and all UI interactivity to reflect current state */`;
const betIndexStart = code.indexOf(betStart);
const betIndexEnd = code.indexOf(betEnd);

if (betIndexStart !== -1 && betIndexEnd !== -1) {
  const replacement = `  private drawBetButton(gfx: Phaser.GameObjects.Graphics, targetX: number, targetY: number, size: number, isPlus: boolean) {
    gfx.clear();
    gfx.setPosition(targetX, targetY);
    const cx = 0;
    const cy = 0;
    
    // Soft outer glow
    gfx.fillStyle(0xff006a, 0.15);
    gfx.fillCircle(cx, cy, size / 2 + 6);

    // Drop shadow
    gfx.fillStyle(0x000000, 0.5);
    gfx.fillCircle(cx, cy + 4, size / 2);
    
    // Silver metallic outer ring gradient
    gfx.fillGradientStyle(0xffffff, 0xffffff, 0xaaaaaa, 0xaaaaaa, 1);
    gfx.fillCircle(cx, cy, size / 2);
    
    // Inner metallic groove
    gfx.fillStyle(0x444444, 1);
    gfx.fillCircle(cx, cy, size / 2 - 2);
    
    // Deep ruby / pink inner gradient
    gfx.fillGradientStyle(0xff3388, 0xff3388, 0xaa0033, 0xaa0033, 1);
    gfx.fillCircle(cx, cy, size / 2 - 3);
    
    // Glossy top hemisphere reflection
    gfx.beginPath();
    gfx.arc(cx, cy, size / 2 - 3, Math.PI, 0, false);
    gfx.closePath();
    gfx.fillStyle(0xffffff, 0.25);
    gfx.fillPath();
    
    // Icon (plus/minus)
    gfx.fillStyle(0xffffff, 1);
    const arm = size * 0.25;
    if (isPlus) {
      gfx.fillRoundedRect(cx - 2, cy - arm, 4, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - 2, arm * 2, 4, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - 2, arm * 2, 4, 2);
    }
  }

`;
  code = code.slice(0, betIndexStart) + replacement + code.slice(betIndexEnd);
}

fs.writeFileSync('d:/projects/phaser_slot_game/frontend/src/scenes/Game.tsx', code);
console.log('UI Buttons replaced successfully!');
