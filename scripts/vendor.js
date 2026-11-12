/**
 * Copies the @ukegeeks packages' browser files into web/vendor/, where the app's
 * pages load them. Runs before `tauri dev` and `tauri build` (beforeDevCommand /
 * beforeBuildCommand in src-tauri/tauri.conf.json); web/vendor/ is not committed.
 *
 *   web/vendor/song-editor/js|css|img/editor/   the editor's dist/, side by side:
 *                                               its CSS and mount() find images at ../img/editor/
 *   web/vendor/song-formatter/                  reads ChordPro, draws the song and diagrams
 *   web/vendor/ace/                             the Fullscreen editor, loaded on demand
 *
 * Same idea as the Songbook's VENDORED list in scripts/build.js.
 */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'web/vendor');

// pkg: npm package; to: folder under web/vendor/; files: paths inside the package
// (kept relative to `from`); dir: copy every file in that folder of the package
const VENDORED = [
  {
    pkg: '@ukegeeks/song-editor',
    to: 'song-editor',
    from: 'dist',
    files: ['js/ugsEditorPlus.min.js', 'css/ugsEditorPlus.min.css', 'css/ugsEditorPlus.print.css'],
  },
  { pkg: '@ukegeeks/song-editor', to: 'song-editor/img/editor', dir: 'dist/img/editor' },
  {
    pkg: '@ukegeeks/song-formatter',
    to: 'song-formatter',
    from: 'dist',
    files: ['song-formatter.bundle.js', 'song-formatter.bundle.js.LICENSE.txt', 'css/ukeGeeks.music.css'],
  },
  {
    pkg: '@ukegeeks/ace-chordpro-extension',
    to: 'ace',
    from: 'dist',
    files: ['ace-chordpro.min.js'],
  },
];

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  let count = 0;
  for (const { pkg, to, from = '', files, dir } of VENDORED) {
    const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`, { paths: [ROOT] }));
    const list = files || (await fs.readdir(path.join(pkgDir, dir))).filter((f) => !f.startsWith('.')).sort();
    const base = files ? from : dir;
    for (const file of list) {
      const out = path.join(OUT, to, file);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.copyFile(path.join(pkgDir, base, file), out);
      count++;
    }
  }
  console.log(`vendor: ${count} files from the @ukegeeks packages -> ${path.relative(ROOT, OUT)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
