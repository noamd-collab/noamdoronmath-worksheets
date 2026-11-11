import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { launchBrowser, startReviewServer } from './helpers/landingMotion.ts';

describe('progressive mathematical line development', { timeout: 120_000 }, () => {
  it('draws the actual function paths at both widths and leaves complete lines on Stop', async () => {
    const server = await startReviewServer('/review/landing-loops-pr-b');
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      for (const width of [390, 1280]) {
        await page.setViewport({ width, height: 900 });
        const response = await page.goto(`${server.origin}/review/landing-loops-pr-b`, { waitUntil: 'load' });
        assert.equal(response?.status(), 200);
        for (const [slug, expected] of [['axis-intercepts-grade-8', 1], ['lines-parallel-to-axes-grade-8', 2], ['motion-problems-grade-8', 1]] as const) {
          const selector = `[data-review-slug="${slug}"] [data-review-side="after"] .function-develop`;
          await page.evaluate(() => document.documentElement.classList.remove('nd-motion-off'));
          await page.$eval(selector, el => el.scrollIntoView({ block: 'center' }));
          const states = await page.$$eval(selector, paths => paths.map(path => {
            const animation = path.getAnimations().find(a => (a as CSSAnimation).animationName.includes('mt-plot-line'));
            if (!animation) return null;
            animation.pause();
            animation.currentTime = 9000 + 900;
            const early = parseFloat(getComputedStyle(path).strokeDashoffset);
            animation.currentTime = 9000 + 6300;
            return {
              early,
              late: parseFloat(getComputedStyle(path).strokeDashoffset),
              normalizedLength: path.getAttribute('pathLength'),
              geometry: path.getAttribute('d'),
              pathLength: (path as SVGPathElement).getTotalLength(),
            };
          }));
          assert.equal(states.length, expected, `${slug} @${width}`);
          for (const state of states) {
            assert.ok(state, `${slug} must animate the mathematical path`);
            assert.equal(state.normalizedLength, '100');
            assert.ok(state.early >= 90, `${slug}: line starts undrawn`);
            assert.equal(state.late, 0, `${slug}: line reaches its full extent`);
            assert.ok(state.pathLength >= 150, `${slug}: actual line, not a decorative marker`);
            assert.match(state.geometry!, /^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
          }
          await page.evaluate(() => document.documentElement.classList.add('nd-motion-off'));
          const stopped = await page.$$eval(selector, paths => paths.map(path => ({
            offset: parseFloat(getComputedStyle(path).strokeDashoffset),
            animation: getComputedStyle(path).animationName,
          })));
          assert.deepEqual(stopped, Array.from({ length: expected }, () => ({ offset: 0, animation: 'none' })), `${slug}: Stop must leave complete geometry`);
        }
      }
    } finally {
      await page.close();
      await browser.close();
      server.stop();
    }
  });
});
