const fs = require('fs');
let content = fs.readFileSync('../src/components/PaytableOverlay.ts', 'utf8');

// Responsive logical dimensions
content = content.replace(
  `    const logicalW = 860;
    const logicalH = 680;`,
  `    const isPortrait = h > w;
    const logicalW = isPortrait ? 660 : 860;
    const logicalH = isPortrait ? 880 : 680;`
);

// Dynamic text rendering and positioning for tumble rules
content = content.replace(
  `    tumbleRules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 38, this.T(line), { resolution: 2,
        fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 4,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 235;`,
  `    let ruleY = yPos + 10;
    tumbleRules.forEach((line) => {
      const t = this.scene.add.text(pad + 20, ruleY, this.T(line), { resolution: 2,
        fontSize: isPortrait ? '17px' : '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 4,
        wordWrap: { width: w - pad * 2 - 50 }
      });
      page.add(t);
      ruleY += t.height + 12;
    });
    yPos = ruleY + 15;`
);

// Payout symbols page tweaks (Page 1)
content = content.replace(
  `      // Tier label
      page.add(this.scene.add.text(startX - 8, rowY, this.T(tierLabel), { resolution: 2,
        fontSize: '11px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));`,
  `      // Tier label
      page.add(this.scene.add.text(startX - 8, rowY, this.T(tierLabel), { resolution: 2,
        fontSize: isPortrait ? '14px' : '11px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));`
);

content = content.replace(
  /fontSize: '11px', color, fontFamily/g,
  `fontSize: isPortrait ? '14px' : '11px', color, fontFamily`
);

content = content.replace(
  /fontSize: '13px'/g,
  `fontSize: isPortrait ? '16px' : '13px'`
);

content = content.replace(
  /fontSize: '14px'/g,
  `fontSize: isPortrait ? '17px' : '14px'`
);

content = content.replace(
  /fontSize: '12px'/g,
  `fontSize: isPortrait ? '15px' : '12px'`
);

content = content.replace(
  `    // Payout rows with alternating shading
    const tiers = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    const rowH = 24;`,
  `    // Payout rows with alternating shading
    const tiers = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    const isPortrait = w < 700;
    const rowH = isPortrait ? 30 : 24;`
);

content = content.replace(
  `    // Visual flow diagram
    this.drawCard(page, pad, yPos, w - pad * 2, 70, true);`,
  `    // Visual flow diagram
    this.drawCard(page, pad, yPos, w - pad * 2, isPortrait ? 85 : 70, true);`
);

content = content.replace(
  /fontSize: '10px'/g,
  `fontSize: isPortrait ? '13px' : '10px'`
);

// Dynamic text rendering for multiplier rules
content = content.replace(
  `    rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 32, this.T(line), { resolution: 2,
        fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 200;`,
  `    let ruleY = yPos + 10;
    rules.forEach((line) => {
      const t = this.scene.add.text(pad + 20, ruleY, this.T(line), { resolution: 2,
        fontSize: isPortrait ? '17px' : '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      });
      page.add(t);
      ruleY += t.height + 12;
    });
    yPos = Math.max(yPos + 200, ruleY + 15);`
);

// Dynamic text rendering for FS rules
content = content.replace(
  `    fsRules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 8 + i * 30, this.T(line), { resolution: 2,
        fontSize: '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 155;`,
  `    let fsRuleY = yPos + 8;
    fsRules.forEach((line) => {
      const t = this.scene.add.text(pad + 20, fsRuleY, this.T(line), { resolution: 2,
        fontSize: isPortrait ? '17px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      });
      page.add(t);
      fsRuleY += t.height + 12;
    });
    yPos = Math.max(yPos + 155, fsRuleY + 15);`
);

// Dynamic text rendering for Buy Features rules
content = content.replace(
  `    buy1000Rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 25, yPos + i * 19, this.T(line), { resolution: 2,
        fontSize: '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      }));
    });
    yPos += 170;`,
  `    let b1000Y = yPos;
    buy1000Rules.forEach((line) => {
      const t = this.scene.add.text(pad + 25, b1000Y, this.T(line), { resolution: 2,
        fontSize: isPortrait ? '14px' : '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      });
      page.add(t);
      b1000Y += t.height + 6;
    });
    yPos = Math.max(yPos + 170, b1000Y + 15);`
);

content = content.replace(
  `    buy500Rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 25, yPos + i * 19, this.T(line), { resolution: 2,
        fontSize: '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      }));
    });
    yPos += 155;`,
  `    let b500Y = yPos;
    buy500Rules.forEach((line) => {
      const t = this.scene.add.text(pad + 25, b500Y, this.T(line), { resolution: 2,
        fontSize: isPortrait ? '14px' : '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      });
      page.add(t);
      b500Y += t.height + 6;
    });
    yPos = Math.max(yPos + 155, b500Y + 15);`
);

// Adjust dots navigation
content = content.replace(
  `      const dx = navCenter - 56 + i * 16;`,
  `      const dx = navCenter - 80 + i * 22;`
);

// Scale card heights
content = content.replace(
  `this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, 370);`,
  `this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, isPortrait ? 440 : 370);`
);

fs.writeFileSync('../src/components/PaytableOverlay.ts', content);
console.log('Script completed.');
