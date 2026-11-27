/**
 * `npm run icons`: makes the app icons in src-tauri/icons/ from the Maestro Saurus SVG
 * (src-tauri/icons/source/maestro-saurus.svg, the vector of ukegeeks.org's favicon).
 * Needs a Mac (Swift and AppKit draw the SVG). The results are committed, so this only
 * runs when the art changes.
 *
 *   Mac (icon.icns and the PNGs): the art clipped to Apple's icon grid, an 824px rounded
 *     square on a 1024px canvas, on cream. macOS 26 puts icons that aren't that shape in
 *     a grey tile.
 *   Windows (icon.ico): the art full-bleed on transparent, as Windows icons are drawn.
 *
 * `tauri icon` does the resizing; each master goes through it once and only the files
 * we use are kept.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ICONS = path.join(ROOT, 'src-tauri/icons');
const SVG = path.join(ICONS, 'source/maestro-saurus.svg');
const CREAM = 'f8eed5'; // the art's own light colour (teeth, eyes)

// master: which render; files: what to keep from `tauri icon`'s output
const SETS = [
  { mode: 'mac', files: ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.png', 'icon.icns'] },
  { mode: 'plain', files: ['icon.ico'] },
];

const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ugs-icons-'));
try {
  const renderer = path.join(tmp, 'render');
  run('swiftc', ['-O', path.join(import.meta.dirname, 'render.swift'), '-o', renderer]);

  for (const { mode, files } of SETS) {
    const master = path.join(tmp, `${mode}.png`);
    const out = path.join(tmp, mode);
    run(renderer, [SVG, master, mode, CREAM]);
    run('npx', ['tauri', 'icon', master, '--output', out]);
    for (const file of files) {
      await fs.copyFile(path.join(out, file), path.join(ICONS, file));
      console.log(`src-tauri/icons/${file}`);
    }
  }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
