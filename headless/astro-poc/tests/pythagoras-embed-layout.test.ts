import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { it } from 'node:test';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pageSource = read('../src/pages/games/eliyahu-pythagoras/index.astro');
const game = read('../src/games/eliyahu-pythagoras.html');
// Exercise the actual wrapper styles and resize script with the actual game,
// isolated from the site's authentication, network services, and widgets.
const wrapper = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<style>body{margin:0} ${pageSource.match(/<style>([\s\S]*?)<\/style>/)![1]}</style>
</head><body><header style="height:140px"></header>
${pageSource.match(/<main[\s\S]*?<\/main>/)![0]
  .replaceAll('{PYTHAGORAS_GAME_H1}', 'משחק משפט פיתגורס עם אליהו')
  .replace('{PYTHAGORAS_GAME_PLAY_PATH}', '"/play"')}
<script>${pageSource.match(/<script is:inline>([\s\S]*?)<\/script>/)![1]}</script>
</body></html>`;

async function fits(page: Page, label: string) {
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe')!;
    const doc = frame.contentDocument!;
    const card = doc.querySelector<HTMLElement>('#card');
    const grid = doc.querySelector<HTMLElement>('#grid');
    if (!card || !grid) return false;
    return grid.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom
      && doc.documentElement.scrollHeight <= frame.clientHeight + 1
      && doc.documentElement.scrollWidth <= frame.clientWidth + 1;
  }, { timeout: 5000 }).catch(error => {
    throw new Error(`${label}: game content is clipped or scrolls inside the iframe`, { cause: error });
  });
}

it('fits every game step on desktop and phone, including later content growth and shrinkage', { timeout: 90000 }, async () => {
  const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
    .find((path): path is string => !!path && existsSync(path));
  assert.ok(chrome, 'Set CHROME_PATH to a Chromium browser');
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(req.url === '/play' ? game : wrapper);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    for (const [width, height] of [[1280, 720], [1024, 600], [820, 600], [390, 844]]) {
      await page.setViewport({ width, height });
      await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'load' });
      const frame = page.frames().find(frame => frame.url().endsWith('/play'))!;
      await frame.waitForFunction(() => !!(window as any).__lesson);
      for (let step = 0; step < 9; step++) {
        await frame.evaluate(step => (window as any).__lesson.goStep(step), step);
        await fits(page, `${width}×${height}, step ${step + 1}`);
        if (step === 1) {
          await frame.waitForFunction(() => !(window as any).__lesson.state.typing);
          await new Promise(resolve => setTimeout(resolve, 100));
          await fits(page, `${width}×${height}, step 2 after speech`);
        }
      }
      // A late, tall panel must not hit a fixed 1400px ceiling, and removing it
      // must let the frame shrink again rather than creating resize feedback.
      await frame.evaluate(() => {
        const panel = document.createElement('div');
        panel.id = 'tall-test-panel';
        panel.style.height = '1600px';
        document.querySelector('#colControls')!.appendChild(panel);
      });
      await fits(page, `${width}×${height}, tall content`);
      const tall = await page.$eval('iframe', frame => frame.getBoundingClientRect().height);
      assert.ok(tall > 1600);
      await frame.evaluate(() => {
        document.querySelector('#tall-test-panel')!.remove();
        (window as any).__lesson.goStep(0);
      });
      await fits(page, `${width}×${height}, return to intro`);
      await frame.waitForFunction(() => !(window as any).__lesson.state.typing);
      await new Promise(resolve => setTimeout(resolve, 100));
      await fits(page, `${width}×${height}, intro after speech`);
      await page.waitForFunction(tall => document.querySelector('iframe')!.getBoundingClientRect().height < tall - 1000, {}, tall);
      const before = await page.$eval('iframe', frame => frame.getBoundingClientRect().height);
      await new Promise(resolve => setTimeout(resolve, 300));
      const after = await page.$eval('iframe', frame => frame.getBoundingClientRect().height);
      assert.equal(after, before, `${width}×${height}: frame height settles`);
    }
    assert.deepEqual(errors, [], 'No script errors or ResizeObserver loops');
  } finally {
    await browser?.close();
    server.close();
    server.closeAllConnections();
  }
});
