/**
 * COMPREHENSIVE FONT + RESOLUTION FIX
 * 
 * This script fixes ALL text objects across every source file to:
 * 1. Use `resolution: 2` for crisp rendering on all DPI displays
 * 2. Standardize fonts to only those actually loaded in index.html:
 *    - Poppins (body, labels, UI text)
 *    - Inter (numeric values, secondary)
 *    - Montserrat (headings, bold sections)
 *    - Luckiest Guy (brand/game title ONLY)
 *    - Outfit (kept as fallback since loaded)
 * 3. Remove references to unloaded fonts (Orbitron, Space Grotesk, Lilita One)
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Files to fix
const targetFiles = [
  'constants/theme.ts',
  'components/BottomBarHUD.ts',
  'components/SpinControls.ts',
  'components/BetOverlay.ts',
  'components/AutoPlayOverlay.ts',
  'components/ConfirmDialog.ts',
  'components/IntroSplash.ts',
  'components/ErrorManager.ts',
  'components/WinCelebration.ts',
  'components/FreeSpinsIntro.ts',
  'components/Grid.ts',
  'scenes/Game.tsx',
  'scenes/Boot.tsx',
];

let totalFixes = 0;

targetFiles.forEach(relPath => {
  const filePath = path.join(srcDir, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const origLen = content.length;
  let fixes = 0;
  
  // ─── 1. FIX THEME.TS FONT REFERENCES ───
  if (relPath === 'constants/theme.ts') {
    // Fix the sans font
    content = content.replace(
      /sans: '"Outfit", "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif'/g,
      'sans: \'"Poppins", "Outfit", sans-serif\''
    );
    // Fix the display font (Space Grotesk is NOT loaded)
    content = content.replace(
      /display:\s*\n\s*'"Space Grotesk", "Poppins", -apple-system, BlinkMacSystemFont, sans-serif'/g,
      'display: \'"Montserrat", "Poppins", sans-serif\''
    );
    // Fix the mono font (Orbitron is NOT loaded)
    content = content.replace(
      /mono: '"Orbitron", monospace'/g,
      'mono: \'"Montserrat", "Inter", sans-serif\''
    );
    // Fix heading font families that reference Space Grotesk
    content = content.replace(/family: '"Space Grotesk"'/g, 'family: \'"Montserrat"\'');
    // Fix numeric family (Orbitron is not loaded)
    content = content.replace(
      /numeric: \{ size: 24, weight: 700, family: '"Orbitron"' \}/g,
      'numeric: { size: 24, weight: 700, family: \'"Montserrat"\' }'
    );
    fixes++;
  }
  
  // ─── 2. REPLACE UNLOADED FONT FAMILIES EVERYWHERE ───
  
  // Replace "Orbitron" with "Montserrat"
  content = content.replace(/["']Orbitron["']/g, '"Montserrat"');
  
  // Replace "Space Grotesk" with "Montserrat"
  content = content.replace(/["']Space Grotesk["']/g, '"Montserrat"');
  
  // Replace "Lilita One" with "Poppins"
  content = content.replace(/["']Lilita One["']/g, '"Poppins"');
  
  // Replace standalone fontFamily: 'sans-serif' (no named font)
  // This catches text objects with no fontFamily set that default to browser serif
  
  // ─── 3. ADD resolution: 2 TO ALL TEXT OBJECTS ───
  // Pattern: .add.text(x, y, text, { ... }) where { does NOT already have resolution
  // We need to be careful not to double-add resolution
  
  // First, remove any existing resolution: 2 that was added previously (avoid duplicates)
  // Then re-add it consistently
  
  // For scene.add.text patterns that already have resolution: 2, skip
  // For those that don't, add it
  
  // Strategy: Find all text style objects and ensure they have resolution: 2
  // Match: .add.text(anything, anything, anything, {\n and check if resolution is present
  
  // Simple approach: Find `.add.text(` followed by `{` and if no `resolution` in the style block, add it
  const textBlockRegex = /\.add\.text\([^{]*\{([^}]*)\}/g;
  let match;
  const replacements = [];
  
  while ((match = textBlockRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const styleBlock = match[1];
    
    if (!styleBlock.includes('resolution')) {
      // Need to add resolution: 2 to this style block
      const newStyleBlock = '\n      resolution: 2,' + styleBlock;
      const newFullMatch = fullMatch.replace('{' + styleBlock, '{' + newStyleBlock);
      replacements.push({ from: fullMatch, to: newFullMatch });
      fixes++;
    }
  }
  
  // Apply replacements (in reverse order to preserve positions)
  replacements.reverse().forEach(r => {
    const idx = content.lastIndexOf(r.from);
    if (idx >= 0) {
      content = content.substring(0, idx) + r.to + content.substring(idx + r.from.length);
    }
  });
  
  // ─── 4. STANDARDIZE REMAINING FONT FAMILIES ───
  
  // Fix bare fontFamily declarations that don't specify a proper font
  // Pattern: text objects with no fontFamily at all get browser defaults (blurry serif)
  // We'll catch text style objects that have fontSize but no fontFamily
  
  // Fix "Arial" only references
  content = content.replace(/fontFamily: '"Arial", sans-serif'/g, 'fontFamily: \'"Poppins", sans-serif\'');
  content = content.replace(/fontFamily: 'sans-serif'/g, 'fontFamily: \'"Poppins", sans-serif\'');
  
  if (content.length !== origLen) {
    totalFixes += fixes;
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`FIXED: ${relPath} (${fixes} resolution adds)`);
});

console.log(`\nTotal files processed: ${targetFiles.length}`);
console.log(`Total resolution: 2 additions: ${totalFixes}`);
