/**
 * `node scripts/download-buttons/build.js`: draws the README's two download buttons,
 * docs/images/download-mac.svg and download-windows.svg: an open cardboard box with the
 * Maestro Saurus (src-tauri/icons/source/maestro-saurus.svg) peeking out, and "Download
 * for macOS" or "Download for Windows". The Windows box's tape is in four colours; never
 * a 2×2 grid of them, which is Microsoft's logo.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const art = fs.readFileSync(path.join(ROOT, 'src-tauri/icons/source/maestro-saurus.svg'), 'utf8');
// the dino's insides, its class names made unique so they can't meet anything else
const dino = art
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\.st(\d+)/g, '.ugs-st$1')
  .replace(/class="([^"]*)"/g, (_, names) => `class="${names.replace(/\bst(\d+)/g, 'ugs-st$1')}"`)
  .trim();

const TAPE = {
  mac: '<rect x="8" y="39" width="44" height="6" fill="#e7c88d"/>',
  windows: ['#f25022', '#7fba00', '#00a4ef', '#ffb900']
    .map((c, i) => `<rect x="${8 + i * 11}" y="39" width="11" height="6" fill="${c}"/>`)
    .join(''),
};

function button(os, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="64" viewBox="0 0 250 64" role="img" aria-label="Download for ${label}">
  <rect width="250" height="64" rx="12" fill="#7a2e0e"/>
  <g transform="translate(4 2)">
    <path d="M14 30 18 16h24l4 14z" fill="#b5783d"/>
    <svg x="10" y="0" width="40" height="40" viewBox="0 0 64 64">${dino}</svg>
    <path d="M8 30 1 20h15l6 10zM52 30l7-10H44l-6 10z" fill="#d9a066"/>
    <path d="M8 30h44v26H8z" fill="#c98a4b"/>
    <path d="M8 30h44v3H8z" fill="#a86b34"/>
    ${TAPE[os]}
  </g>
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fill="#fbf8f2">
    <text x="72" y="27" font-size="12" opacity="0.85">Download for</text>
    <text x="72" y="49" font-size="22" font-weight="700">${label}</text>
  </g>
</svg>
`;
}

for (const [os, label] of [['mac', 'macOS'], ['windows', 'Windows']]) {
  const file = path.join(ROOT, `docs/images/download-${os}.svg`);
  fs.writeFileSync(file, button(os, label));
  console.log(path.relative(ROOT, file));
}
