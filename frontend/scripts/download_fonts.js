const fs = require('fs');
const path = require('path');
const https = require('https');

const fonts = [
  { name: 'Outfit', weights: '400;500;600;700;800;900' },
  { name: 'Inter', weights: '400;600;700;800' },
  { name: 'Poppins', weights: '300;400;500;600;700;800' },
  { name: 'Montserrat', weights: '300;400;500;600;700;800;900' },
  { name: 'Luckiest Guy', weights: '400' },
  { name: 'Space Grotesk', weights: '400;500;600;700' },
  { name: 'Orbitron', weights: '400;700;900' }
];

const fontDir = path.join(__dirname, '../public/fonts');
if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });

async function download() {
  let cssOutput = '';
  
  for (const font of fonts) {
    console.log(`Downloading ${font.name}...`);
    const familyQuery = font.name.replace(/ /g, '+');
    let url;
    if (font.weights === '400') {
       url = `https://fonts.googleapis.com/css2?family=${familyQuery}&display=swap`;
    } else {
       url = `https://fonts.googleapis.com/css2?family=${familyQuery}:wght@${font.weights}&display=swap`;
    }
    
    const css = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });

    const urlRegex = /url\((https:\/\/[^)]+)\)/g;
    let match;
    let modifiedCss = css;
    
    let fontIdx = 0;
    // We need to match all URLs first, then replace them, to avoid infinite loops or offset issues
    const urlsToReplace = [];
    while ((match = urlRegex.exec(css)) !== null) {
      urlsToReplace.push(match[1]);
    }
    
    for (const fontUrl of urlsToReplace) {
      const ext = '.woff2';
      const filename = `${font.name.replace(/ /g, '')}-${fontIdx++}${ext}`;
      const filePath = path.join(fontDir, filename);
      
      await new Promise((resolve, reject) => {
        https.get(fontUrl, (res) => {
          const fileStream = fs.createWriteStream(filePath);
          res.pipe(fileStream);
          fileStream.on('finish', resolve);
        }).on('error', reject);
      });
      
      // Global replace just in case
      modifiedCss = modifiedCss.split(fontUrl).join(`../fonts/${filename}`);
    }
    
    cssOutput += modifiedCss + '\n';
  }
  
  fs.writeFileSync(path.join(__dirname, 'fonts_generated.css'), cssOutput);
  console.log('Fonts downloaded and fonts_generated.css generated.');
}

download().catch(console.error);
