import puppeteer from 'puppeteer-core';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const PREVIEW = (process.env.PREVIEW || '').replace(/\/$/, '');
const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(existsSync);
if (!PREVIEW || !chrome) {
  console.error('Need PREVIEW and chrome');
  process.exit(1);
}
mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });
mkdirSync('/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/m31-home', {
  recursive: true,
});
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const viewports = [
  ['desktop', 1280, 900],
  ['mobile-390', 390, 844],
];
for (const [name, w, h] of viewports) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${PREVIEW}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 800));
  const p1 = `/opt/cursor/artifacts/screenshots/m31-home-parity-${name}.png`;
  const p2 = `/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/m31-home/parity-${name}.png`;
  await page.screenshot({ path: p1, fullPage: true, type: 'png' });
  copyFileSync(p1, p2);
  console.log('saved', p1);
  await page.close();
}
await browser.close();
