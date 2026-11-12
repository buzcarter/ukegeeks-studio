/**
 * `npm run preview`: serves web/ on http://localhost:8765 with fake-tauri.js added to
 * each page, so the pages can be tried and tested in a browser (Claude Code's browser
 * pane included) without the app. The window of a dev build can't be screenshotted
 * or clicked by Claude Code's screen tools; this can.
 *
 * Not for real use: the files are fake (localStorage). Run `npm run vendor` first
 * (`npm run preview` does) so web/vendor/ has the editor.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 8765;
const root = path.resolve(import.meta.dirname, '../../web');
const fake = fs.readFileSync(path.join(import.meta.dirname, 'fake-tauri.js'), 'utf8');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.json': 'application/json',
};

http.createServer((req, res) => {
  let file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (file === '/') file = '/index.html';
  const full = path.join(root, file);
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  let body = fs.readFileSync(full);
  if (full.endsWith('.html')) body = body.toString().replace('<head>', `<head><script>${fake}</script>`);
  res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream' });
  res.end(body);
}).listen(PORT, () => console.log(`UkeGeeks Studio pages with a fake Tauri: http://localhost:${PORT}/`));
