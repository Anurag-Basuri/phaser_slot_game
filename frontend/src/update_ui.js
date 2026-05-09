const fs = require('fs');
let code = fs.readFileSync('d:/projects/phaser_slot_game/frontend/src/scenes/Game.tsx', 'utf8');

const targetStart = '// === PREMIUM CANDY MACHINE FRAME ===';
const targetEnd = '// ==========================================\r\n    // 2. BUY PANELS & ANTE BET';

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.log('Targets not found. start:', startIndex, 'end:', endIndex);
  process.exit(1);
}

const replacement = `// === PREMIUM GLASSMORPHIC GRID FRAME ===
    this.gridFrame.clear();
    const f = this.gridFrame;

    const framePadding = Math.max(12, gridTotalSize * 0.02);
    const frameW = gridTotalSize + framePadding * 2;
    const frameH = gridTotalSize + framePadding * 2;
    const frameX = gridX - framePadding;
    const frameY = gridY - framePadding;

    // Dark semi-transparent background plate
    f.fillStyle(0x0a0515, 0.7);
    f.fillRoundedRect(frameX, frameY, frameW, frameH, 20);

    // Inner glow / neon border
    f.lineStyle(3, 0xff006a, 0.9);
    f.strokeRoundedRect(frameX, frameY, frameW, frameH, 20);

    // Subtle outer glow effect using multiple transparent strokes
    f.lineStyle(6, 0xff006a, 0.3);
    f.strokeRoundedRect(frameX - 2, frameY - 2, frameW + 4, frameH + 4, 22);
    
    f.lineStyle(12, 0xff006a, 0.1);
    f.strokeRoundedRect(frameX - 5, frameY - 5, frameW + 10, frameH + 10, 25);

    // Chrome/Silver accents on the corners
    const cornerSize = Math.max(15, gridTotalSize * 0.04);
    f.lineStyle(4, 0xffffff, 1);
    
    // Top-left
    f.beginPath();
    f.moveTo(frameX + cornerSize, frameY);
    f.lineTo(frameX + 10, frameY);
    f.arc(frameX + 10, frameY + 10, 10, -Math.PI/2, Math.PI, true);
    f.lineTo(frameX, frameY + cornerSize);
    f.strokePath();

    // Top-right
    f.beginPath();
    f.moveTo(frameX + frameW - cornerSize, frameY);
    f.lineTo(frameX + frameW - 10, frameY);
    f.arc(frameX + frameW - 10, frameY + 10, 10, -Math.PI/2, 0, false);
    f.lineTo(frameX + frameW, frameY + cornerSize);
    f.strokePath();

    // Bottom-left
    f.beginPath();
    f.moveTo(frameX, frameY + frameH - cornerSize);
    f.lineTo(frameX, frameY + frameH - 10);
    f.arc(frameX + 10, frameY + frameH - 10, 10, Math.PI, Math.PI/2, true);
    f.lineTo(frameX + cornerSize, frameY + frameH);
    f.strokePath();

    // Bottom-right
    f.beginPath();
    f.moveTo(frameX + frameW, frameY + frameH - cornerSize);
    f.lineTo(frameX + frameW, frameY + frameH - 10);
    f.arc(frameX + frameW - 10, frameY + frameH - 10, 10, 0, Math.PI/2, false);
    f.lineTo(frameX + frameW - cornerSize, frameY + frameH);
    f.strokePath();

    `;

let newCode = code.slice(0, startIndex) + replacement + code.slice(endIndex);

// Also replace the bottom bar block
const bbStart = '// ==========================================\r\n    // 3. BOTTOM BAR & HUD\r\n    // ==========================================\r\n    this.bottomBar.clear();\r\n    const bb = this.bottomBar;\r\n\r\n    bb.fillStyle(0x0a0512, 1);\r\n    bb.fillRect(0, h - barH, w, barH);\r\n    bb.fillStyle(0xff006a, 0.40);\r\n    bb.fillRect(0, h - barH, w, 2);';

const bbReplacement = `// ==========================================
    // 3. BOTTOM BAR & HUD
    // ==========================================
    this.bottomBar.clear();
    const bb = this.bottomBar;

    // Dark sleek glassmorphic background
    bb.fillStyle(0x0a0515, 0.85);
    bb.fillRect(0, h - barH, w, barH);
    
    // Top accent border gradient simulation
    bb.fillStyle(0xff006a, 0.8);
    bb.fillRect(0, h - barH, w, 2);
    
    // Subtle internal highlight line
    bb.fillStyle(0xffffff, 0.08);
    bb.fillRect(0, h - barH + 2, w, 1);`;

newCode = newCode.replace(bbStart, bbReplacement);

fs.writeFileSync('d:/projects/phaser_slot_game/frontend/src/scenes/Game.tsx', newCode);
console.log('Grid frame and bottom bar replaced successfully.');
