import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { launchBrowser, startReviewServer } from './helpers/landingMotion.ts';

describe('review gallery matches production lesson-motion policy', { timeout: 120_000 }, () => {
  it('autoplays A CSS scenes under explicit OS reduce and obeys the actual Stop/Resume button', async () => {
    const server = await startReviewServer('/review/landing-loops-pr-a');
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 390, height: 844 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const response = await page.goto(`${server.origin}/review/landing-loops-pr-a`, { waitUntil: 'load' });
      assert.equal(response?.status(), 200);
      await page.waitForSelector('[data-review-side="after"] .ll');
      assert.deepEqual(await page.evaluate(() => ({
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        enabled: document.documentElement.classList.contains('nd-motion-enabled'),
      })), { reduced: true, enabled: true });
      const slugs = await page.$$eval('[data-review-slug]', cards => cards.filter(card => card.querySelector('[data-review-side="after"] .ll')).map(card => card.getAttribute('data-review-slug')!));
      assert.ok(slugs.length >= 5, 'must exercise the gallery CSS inventory');
      for (const slug of slugs) {
        const selector = `[data-review-slug="${slug}"] [data-review-side="after"] .ll`;
        await page.$eval(selector, el => el.scrollIntoView({ block: 'center' }));
        await page.waitForFunction(sel => document.querySelector(sel)!.getAnimations({ subtree: true }).some(a => a.playState === 'running'), { timeout: 5000 }, selector);
        const count = await page.$eval(selector, el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
        assert.ok(count >= 2, `${slug}: expected multiple active CSS animations under OS reduce`);
      }
      // Keep the last card in view while clicking the control programmatically,
      // so off-screen pausing cannot masquerade as a successful Stop action.
      const last = `[data-review-slug="${slugs.at(-1)}"] [data-review-side="after"] .ll`;
      await page.$eval('[data-review-motion]', (el: HTMLButtonElement) => el.click());
      assert.deepEqual(await page.evaluate(() => ({
        stopped: document.documentElement.classList.contains('nd-motion-off'),
        enabled: document.documentElement.classList.contains('nd-motion-enabled'),
      })), { stopped: true, enabled: false });
      assert.equal(await page.$eval(last, el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
      await page.$eval('[data-review-motion]', (el: HTMLButtonElement) => el.click());
      await page.waitForFunction(sel => document.querySelector(sel)!.getAnimations({ subtree: true }).some(a => a.playState === 'running'), { timeout: 5000 }, last);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('nd-motion-enabled')), true);
    } finally {
      await page.close();
      await browser.close();
      server.stop();
    }
  });
});
