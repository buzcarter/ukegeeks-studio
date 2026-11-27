/**
 * `node scripts/download-buttons/build.js`: draws the README's two download buttons,
 * docs/images/download-mac.svg and download-windows.svg: the Scriptasaurus
 * (docs/images/source/scriptasaurus.svg) standing in an open cardboard box, the box
 * everyone reads as "installer", with a down arrow on its front, and "Download for macOS"
 * or "Download for Windows". The Windows box's tape is in four colours, in a row; never
 * a 2×2 grid of them, which is Microsoft's logo.
 *
 * The box is drawn back to front: the back flaps stand up behind the dino, then the dino,
 * then the side flaps and the front, which hides him from the ukulele down.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const art = fs.readFileSync(path.join(ROOT, 'docs/images/source/scriptasaurus.svg'), 'utf8');
const viewBox = art.match(/<svg[^>]*viewBox="([^"]+)"/)[1];

// the dino's insides: no ids, and class names made unique so they can't meet anything else
const classes = new Set([...art.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
let dino = art
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s(id|data-name)="[^"]*"/g, '');
for (const name of classes) {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  dino = dino
    .replace(new RegExp(`\\.${safe}(?![\\w-])`, 'g'), `.ugs-${name}`)
    .replace(new RegExp(`(class="[^"]*?)\\b${safe}\\b`, 'g'), `$1ugs-${name}`);
}

const CARD = { back: '#9c632e', inside: '#6e4220', flap: '#dba56b', front: '#c98a4b', edge: '#a86b34' };
const TAPE = {
  mac: '<rect x="8" y="52" width="64" height="6" fill="#ead2a0"/>',
  windows: ['#f25022', '#7fba00', '#00a4ef', '#ffb900']
    .map((c, i) => `<rect x="${8 + i * 16}" y="52" width="16" height="6" fill="${c}"/>`)
    .join(''),
};

function button(os, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="290" height="88" viewBox="0 0 290 88" role="img" aria-label="Download for ${label}">
  <rect width="290" height="88" rx="14" fill="#7a2e0e"/>
  <g transform="translate(6 4)">
    <path d="M10 46 4 22h34v24zM70 46l6-24H42v24z" fill="${CARD.back}"/>
    <path d="M8 46h64l-4 6H12z" fill="${CARD.inside}"/>
    <svg x="12" y="0" width="56" height="64" viewBox="${viewBox}" preserveAspectRatio="xMidYMin meet">${dino}</svg>
    <path d="M8 52 0 40h14l8 12zM72 52l8-12H66l-8 12z" fill="${CARD.flap}"/>
    <path d="M8 52h64v28H8z" fill="${CARD.front}"/>
    ${TAPE[os]}
    <path d="M40 61v13m-6-6 6 6 6-6" fill="none" stroke="#fbf8f2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fill="#fbf8f2">
    <text x="100" y="38" font-size="14" opacity="0.85">Download for</text>
    <text x="100" y="64" font-size="26" font-weight="700">${label}</text>
  </g>
</svg>
`;
}

for (const [os, label] of [['mac', 'macOS'], ['windows', 'Windows']]) {
  const file = path.join(ROOT, `docs/images/download-${os}.svg`);
  fs.writeFileSync(file, button(os, label));
  console.log(path.relative(ROOT, file));
}
