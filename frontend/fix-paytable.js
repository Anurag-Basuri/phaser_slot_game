const fs = require('fs');
let c = fs.readFileSync('src/components/PaytableOverlay.ts', 'utf8');

// Change fonts
c = c.replace(/private readonly FONT_BODY = '[^']+';/g, "private readonly FONT_BODY = '\"Poppins\", sans-serif';");
c = c.replace(/private readonly FONT_TITLE = '[^']+';/g, "private readonly FONT_TITLE = '\"Poppins\", sans-serif';");

// Make design cleaner (remove bright pink gradients/borders in favor of clean glass)
// Header gradient
c = c.replace(/panel\.fillGradientStyle\(0xff006a, 0xff3388, 0x130f24, 0x130f24, 0\.2, 0\.2, 0, 0\);/g, "panel.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.08, 0.08, 0, 0);");

// Main Panel
c = c.replace(/panel\.fillGradientStyle\(0x130f24, 0x130f24, 0x0a0812, 0x0a0812, 0\.98\);/g, "panel.fillStyle(0x0a0710, 0.95);");

// Panel borders
c = c.replace(/panel\.lineStyle\(2, 0xff006a, 0\.6\);/g, "panel.lineStyle(1, 0xffffff, 0.1);");

// Remove inner rim to make it cleaner
c = c.replace(/panel\.lineStyle\(1, 0xffffff, 0\.05\);\s*panel\.strokeRoundedRect\(2, 2, logicalW - 4, logicalH - 4, 18\);/g, "");

// Close button
c = c.replace(/closeBtnGfx\.fillStyle\(0xff006a, 0\.12\);/g, "closeBtnGfx.fillStyle(0xffffff, 0.1);");
c = c.replace(/closeBtnGfx\.lineStyle\(1\.5, 0xff006a, 0\.5\);/g, "closeBtnGfx.lineStyle(1, 0xffffff, 0.3);");

// Nav buttons
c = c.replace(/color: '#ff006a'/g, "color: '#ffffff'");
c = c.replace(/nextBtn\.setColor\('#ff4488'\)/g, "nextBtn.setColor('#c4c2d6')");
c = c.replace(/prevBtn\.setColor\('#ff4488'\)/g, "prevBtn.setColor('#c4c2d6')");
c = c.replace(/nextBtn\.setColor\('#ff006a'\)/g, "nextBtn.setColor('#ffffff')");
c = c.replace(/prevBtn\.setColor\('#ff006a'\)/g, "prevBtn.setColor('#ffffff')");

// Fix resolutions of all text additions
c = c.replace(/this\.scene\.add\.text\(([^,]+),\s*([^,]+),\s*(this\.T\([^)]+\)|[^,]+),\s*\{/g, 'this.scene.add.text($1, $2, $3, { resolution: 2,');

// Adjust page layout overlaps for "There are a lots of things that overlaps over there in different pages"
// Page 5: Buy features overlap
c = c.replace(/yPos \+= 220;/g, "yPos += 190;");
c = c.replace(/yPos \+= 230;/g, "yPos += 190;");
c = c.replace(/yPos \+= 235;/g, "yPos += 190;");
// Reduce some text sizes or spacing slightly to prevent wrapping issues on mobile / overlaps
c = c.replace(/fontSize: '15px'/g, "fontSize: '14px'");

fs.writeFileSync('src/components/PaytableOverlay.ts', c);
