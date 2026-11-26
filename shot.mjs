// Renders the four judged ?shot= frames to screenshots/ with puppeteer-core + headless Chrome,
// written in the build session. Two ways to reach the page: if a local server answers on
// 127.0.0.1:8099 the browser loads straight from it (the proven recipe); otherwise the request
// handler serves game/ off disk so the same script still works where binding a port is blocked.
// Launch stays plain headless + domcontentloaded (MISTAKES 3n): no HOME/TMPDIR, no deviceScaleFactor.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/chrome/');
const puppeteer = require('/home/hatch/workspace/chrome/node_modules/puppeteer-core');

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, 'game'));
const outDir = join(here, 'screenshots');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const SHOTS = [
  ['cover', '1-cover.jpg'], ['ring', '2-ring.jpg'],
  ['approach', '3-approach.jpg'], ['vista', '4-vista.jpg'],
];

// Probe for the local server so we use the exact proven path when it is actually up.
const serverUp = await new Promise((done) => {
  const req = get('http://127.0.0.1:8099/', (res) => { res.resume(); done(res.statusCode === 200); });
  req.on('error', () => done(false));
  req.setTimeout(1500, () => { req.destroy(); done(false); });
});

const serve = (request) => {
  const url = new URL(request.url());
  if (url.hostname !== '127.0.0.1') return request.abort();
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || path.endsWith('/')) path += 'index.html';
  return readFile(join(root, path))
    .then((body) => request.respond({ status: 200, contentType: MIME[extname(path)] ?? 'application/octet-stream', body }))
    .catch(() => request.respond({ status: 404, body: 'not found' }));
};

const browser = await puppeteer.launch({
  executablePath: '/home/hatch/workspace/chrome/chrome-home/opt/google/chrome/chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-crash-reporter', '--disable-breakpad'],
});
console.log(`source: ${serverUp ? 'local server on :8099' : 'in-process disk handler (no port)'}`);
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
if (!serverUp) {
  await page.setRequestInterception(true);
  page.on('request', serve);
}
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

for (const [scene, file] of SHOTS) {
  await page.goto(`http://127.0.0.1:8099/?shot=${scene}&seed=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__shotReady === true', { timeout: 30000 });
  const mode = await page.evaluate(() => window.__debug?.camera ?? null);
  const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
  await writeFile(join(outDir, file), buf);
  console.log(`${scene} -> ${file} (${buf.length} bytes, camera ${mode})`);
}
if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
await browser.close();
