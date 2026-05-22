/**
 * Safe font + resolution fix script.
 * Uses line-by-line processing to avoid breaking template literals.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const files = [
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

let totalRes = 0;
let totalFont = 0;

files.forEach(relPath => {
  const fp = path.join(srcDir, relPath);
  if (!fs.existsSync(fp)) { console.log(`SKIP: ${relPath}`); return; }
  
  let c = fs.readFileSync(fp, 'utf8');

  // ─── THEME.TS SPECIFIC FIXES ───
  if (relPath === 'constants/theme.ts') {
    // Fix unloaded fonts in the theme design system
    c = c.replace(
      `sans: '"Outfit", "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif'`,
      `sans: '"Poppins", "Outfit", sans-serif'`
    );
    c = c.replace(
      `'\"Space Grotesk\", \"Poppins\", -apple-system, BlinkMacSystemFont, sans-serif'`,
      `'"Montserrat", "Poppins", sans-serif'`
    );
    c = c.replace(`mono: '"Orbitron", monospace'`, `mono: '"Montserrat", "Inter", sans-serif'`);
    c = c.replace(/family: '"Space Grotesk"'/g, `family: '"Montserrat"'`);
    c = c.replace(
      `numeric: { size: 24, weight: 700, family: '"Orbitron"' }`,
      `numeric: { size: 24, weight: 700, family: '"Montserrat"' }`
    );
    console.log(`THEME: Fixed font references in theme.ts`);
  }

  // ─── GLOBAL FONT REPLACEMENTS (exact string, safe) ───
  
  // Replace unloaded font names in fontFamily strings
  const fontReplacements = [
    [/'"Orbitron"'/g, '"Montserrat"'],
    [/'"Orbitron", monospace'/g, '"Montserrat", "Inter", sans-serif'],
    [/"Orbitron"/g, '"Montserrat"'],
    [/'"Space Grotesk"'/g, '"Montserrat"'],
    [/"Space Grotesk"/g, '"Montserrat"'],
    [/'"Lilita One"'/g, '"Poppins"'],
    [/"Lilita One"/g, '"Poppins"'],
    // Theme.fonts.mono references will now resolve to Montserrat via theme fix
  ];
  
  fontReplacements.forEach(([pattern, replacement]) => {
    const before = c;
    c = c.replace(pattern, replacement);
    if (c !== before) totalFont++;
  });

  // ─── ADD resolution: 2 TO ALL TEXT STYLE OBJECTS ───
  // Process line by line to safely find `.add.text(` calls
  // and add resolution: 2 to the style object opening brace
  
  const lines = c.split('\n');
  const newLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line has .add.text( and a style object { on the SAME line
    // but does NOT already have resolution: 2
    if (line.includes('.add.text(') && line.includes('{') && !line.includes('resolution:')) {
      // Check if the style block is entirely on this line (single-line style)
      if (line.includes('}')) {
        // Single-line style: add resolution: 2 right after the opening {
        const fixed = line.replace(/\{(\s*)/, '{ resolution: 2, ');
        newLines.push(fixed);
        totalRes++;
        i++;
        continue;
      } else {
        // Multi-line style: the { is here, style properties on next lines
        // Check next few lines for resolution
        let hasRes = false;
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('resolution:')) { hasRes = true; break; }
          if (lines[j].includes('}')) break;
        }
        if (!hasRes) {
          // Insert resolution: 2 after the line with {
          newLines.push(line);
          i++;
          // Find the indentation of the next line
          if (i < lines.length) {
            const nextLine = lines[i];
            const indent = nextLine.match(/^(\s*)/)?.[1] || '      ';
            newLines.push(indent + 'resolution: 2,');
            totalRes++;
          }
          continue;
        }
      }
    }
    
    // Check if this is a .add.text( where the style { is on the NEXT line
    if (line.includes('.add.text(') && !line.includes('{') && !line.includes('resolution:')) {
      newLines.push(line);
      i++;
      // Look for the opening { on subsequent lines
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim().startsWith('{') || nextLine.includes(', {')) {
          if (!nextLine.includes('resolution:')) {
            // Check if resolution is on any of the next few lines
            let hasRes = false;
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              if (lines[j].includes('resolution:')) { hasRes = true; break; }
              if (lines[j].includes('}')) break;
            }
            if (!hasRes) {
              newLines.push(nextLine);
              i++;
              if (i < lines.length) {
                const afterBrace = lines[i];
                const indent = afterBrace.match(/^(\s*)/)?.[1] || '        ';
                newLines.push(indent + 'resolution: 2,');
                totalRes++;
              }
              continue;
            }
          }
          break;
        }
        newLines.push(nextLine);
        i++;
        if (nextLine.includes('{')) break;
      }
      continue;
    }
    
    newLines.push(line);
    i++;
  }
  
  const result = newLines.join('\n');
  fs.writeFileSync(fp, result);
  console.log(`DONE: ${relPath}`);
});

console.log(`\nTotal resolution:2 additions: ${totalRes}`);
console.log(`Total font replacements: ${totalFont}`);
