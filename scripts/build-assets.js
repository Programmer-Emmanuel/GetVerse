// Génère les fonds d'écran (SVG discrets) et l'icône de Bible (PNG + ICO).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = (m => m.default || m)(require('png-to-ico'));

const root = path.join(__dirname, '..');
const bgDir = path.join(root, 'src', 'backgrounds');
const buildDir = path.join(root, 'build');
fs.mkdirSync(bgDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

const bg = (c1, c2, glow) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<radialGradient id="l" cx="0.72" cy="0.18" r="0.7"><stop offset="0" stop-color="${glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="l2" cx="0.15" cy="0.95" r="0.6"><stop offset="0" stop-color="${glow}" stop-opacity="0.25"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
<filter id="b"><feGaussianBlur stdDeviation="40"/></filter>
</defs>
<rect width="1920" height="1080" fill="url(#g)"/>
<rect width="1920" height="1080" fill="url(#l)"/>
<rect width="1920" height="1080" fill="url(#l2)"/>
<g filter="url(#b)" fill="${glow}">
<polygon points="1250,-100 1450,-100 900,1180 560,1180" opacity="0.10"/>
<polygon points="1500,-100 1640,-100 1500,1180 1200,1180" opacity="0.08"/>
<polygon points="1000,-100 1100,-100 300,1180 60,1180" opacity="0.07"/>
</g>
</svg>`;

const BGS = {
  nuit: ['#0b1330', '#1c2c5a', '#8fb4ff'],
  aube: ['#3a1f3d', '#c0643a', '#ffd9a0'],
  ocean: ['#06303f', '#0f6a7a', '#9fe8ee'],
  pourpre: ['#25103f', '#5b2a86', '#e0b3ff'],
  foret: ['#0c2a1b', '#25623f', '#c4f0b8'],
};
for (const [name, c] of Object.entries(BGS)) fs.writeFileSync(path.join(bgDir, name + '.svg'), bg(...c));

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22346b"/><stop offset="1" stop-color="#0b1330"/></linearGradient>
<linearGradient id="cover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4b2a"/><stop offset="1" stop-color="#5a2e18"/></linearGradient>
</defs>
<rect width="512" height="512" rx="112" fill="url(#bg)"/>
<path d="M70 190 L256 232 L442 190 L442 392 L256 432 L70 392 Z" fill="url(#cover)"/>
<path d="M86 160 Q170 138 256 176 L256 408 Q170 372 86 392 Z" fill="#f7f1e1"/>
<path d="M426 160 Q342 138 256 176 L256 408 Q342 372 426 392 Z" fill="#efe6cf"/>
<path d="M256 176 L256 408" stroke="#c9b98f" stroke-width="5"/>
<g stroke="#b9ab84" stroke-width="6" stroke-linecap="round" opacity=".9" fill="none">
<path d="M112 214 Q170 202 226 228"/><path d="M112 248 Q170 236 226 262"/><path d="M112 282 Q170 270 226 296"/><path d="M112 316 Q170 304 226 330"/>
<path d="M400 214 Q342 202 286 228"/><path d="M400 248 Q342 236 286 262"/><path d="M400 282 Q342 270 286 296"/><path d="M400 316 Q342 304 286 330"/>
</g>
<path d="M256 52 v78 M222 84 h68" stroke="#e9c46a" stroke-width="20" stroke-linecap="round"/>
</svg>`;

(async () => {
  const png = (s) => sharp(Buffer.from(icon)).resize(s, s).png().toBuffer();
  fs.writeFileSync(path.join(buildDir, 'icon.png'), await png(512));
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), await pngToIco(await Promise.all([16, 24, 32, 48, 64, 128, 256].map(png))));
  console.log('fonds et icônes créés');
})();
