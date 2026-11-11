import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';
import { launchBrowser, startReviewServer } from './helpers/landingMotion.ts';

const linearRoutes = ['function-representations-grade-8', 'rate-of-change-grade-8'];

describe('linear table to graph demonstration', { timeout: 120_000 }, () => {
  it('covers every live route using the lesson and preserves the grade 9 parabola', () => {
    assert.deepEqual(TOPIC_PAGE_SLUGS.filter(slug => {
      const loop = topicLandingLoop(loadTopicPage(slug));
      return loop.kind === 'css' && loop.variant === 'linear-table';
    }).sort(), [...linearRoutes].sort());
    assert.deepEqual(topicLandingLoop(loadTopicPage('precalculus-functions-graphs-grade-9')),
      { kind: 'css', variant: 'parabola', marker: 'parabola' });
  });

  it('develops the same correct line through all table points and keeps it complete on Stop', async () => {
    const server = await startReviewServer('/review/landing-loops-pr-b');
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      for (const width of [390, 1280]) {
        await page.setViewport({ width, height: 900 });
        const response = await page.goto(`${server.origin}/review/landing-loops-pr-b`, { waitUntil: 'load' });
        assert.equal(response?.status(), 200);
        for (const slug of linearRoutes) {
          const card = `[data-review-slug="${slug}"] [data-review-side="after"]`;
          const line = `${card} .linear-function-line`;
          await page.evaluate(() => document.documentElement.classList.remove('nd-motion-off', 'noam-a11y-motion'));
          await page.$eval(line, el => el.scrollIntoView({ block: 'center' }));
          await page.waitForFunction(selector => document.querySelector(selector)!.getAnimations().some(a => a.playState === 'running'), { timeout: 5000 }, line);
          const states = await page.$eval(line, path => {
            const animation = path.getAnimations().find(a => (a as CSSAnimation).animationName.includes('ls-linear-line'))!;
            animation.pause();
            return [900, 3600, 6300].map(time => {
              animation.currentTime = time;
              return { geometry: path.getAttribute('d'), offset: parseFloat(getComputedStyle(path).strokeDashoffset) };
            });
          });
          assert.deepEqual(states.map(s => s.geometry), Array(3).fill('M80 195 L388 30'));
          assert.equal(states[0].offset, 100);
          assert.ok(states[1].offset > 0 && states[1].offset < 100);
          assert.equal(states[2].offset, 0);
          assert.deepEqual(await page.$$eval(`${card} table tr`, rows => rows.map(row => [...row.querySelectorAll('td')].map(cell => Number(cell.textContent)))), [[0, 1, 2], [1, 4, 7]]);
          const points = await page.$$eval(`${card} .pt`, elements => elements.map(el => [Number(el.getAttribute('cx')), Number(el.getAttribute('cy'))]));
          assert.deepEqual(points, [[80, 195], [220, 120], [360, 45]]);
          for (const [x, y] of points) assert.equal(195 + (x - 80) * (30 - 195) / (388 - 80), y);
          for (const stopClass of ['nd-motion-off', 'noam-a11y-motion']) {
            await page.evaluate(name => {
              document.documentElement.classList.remove('nd-motion-off', 'noam-a11y-motion');
              document.documentElement.classList.add(name);
            }, stopClass);
            assert.deepEqual(await page.$eval(line, path => ({ offset: parseFloat(getComputedStyle(path).strokeDashoffset), animation: getComputedStyle(path).animationName })), { offset: 0, animation: 'none' });
            assert.ok((await page.$$eval(`${card} .pt, ${card} .linear-read`, elements => elements.map(el => getComputedStyle(el).transform))).every(transform => transform === 'none'));
          }
        }
      }
    } finally {
      await page.close();
      await browser.close();
      server.stop();
    }
  });
});
