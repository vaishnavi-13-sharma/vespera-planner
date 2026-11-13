// Renders public/icon.svg into the PNG sizes iOS and the web manifest need.
// Run: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
// Maskable icons may be cropped to a circle: shrink the artwork into the 80% safe zone.
const maskable = svg
  .replace('<rect width="512" height="512" fill="url(#bg)"/>', '<rect width="512" height="512" fill="#1A1110"/><g transform="translate(51.2 51.2) scale(0.8)"><rect width="512" height="512" fill="url(#bg)"/>')
  .replace('</svg>', '</g></svg>');

const outputs = [
  ['apple-touch-icon.png', svg, 180],
  ['pwa-192.png', svg, 192],
  ['pwa-512.png', svg, 512],
  ['pwa-maskable-512.png', maskable, 512],
  ['favicon-32.png', svg, 32],
];
for (const [name, source, size] of outputs) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`public/${name} (${size}px)`);
}
