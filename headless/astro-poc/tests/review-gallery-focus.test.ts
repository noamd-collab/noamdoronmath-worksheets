import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { launchBrowser, startReviewServer } from './helpers/landingMotion.ts';

/** The fast measurement view must remain the same card, not a separate fixture. */
describe('preview-only gallery focus preserves the original inventory and cards', { timeout: 120_000 }, () => {
  it('keeps full A/B inventories, exact card markup and layout, and rejects unknown focus', async () => {
    const server = await startReviewServer('/review/landing-loops-pr-a');
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      for (const [gallery, count] of [['a', 42], ['b', 67]] as const) {
        const response = await page.goto(`${server.origin}/review/landing-loops-pr-${gallery}`, { waitUntil: 'load' });
        assert.equal(response?.status(), 200);
        const inventory = await page.$$eval('[data-review-slug]', cards => cards.map(card => card.getAttribute('data-review-slug')));
        assert.equal(inventory.length, count);
        assert.equal(new Set(inventory).size, count);
        assert.equal(await page.$eval('[data-review-total]', el => Number(el.getAttribute('data-review-total'))), count);
        assert.equal(await page.$$eval('.rv-index li', rows => rows.length), count);
      }
      // Existing CSS/film, a new missing-before page, and B's taller lesson.
      for (const [gallery, slug, count] of [['a', 'percentage-problems-grade-8', 42], ['a', 'frequency-chance-grade-5', 42], ['a', 'percent-change-grade-8', 42], ['b', 'median-grade-8', 67]] as const) {
        const url = `${server.origin}/review/landing-loops-pr-${gallery}`;
        const fullHtml = await (await fetch(url)).text();
        const focusedUrl = `${url}?focus=${encodeURIComponent(slug)}`;
        const response = await fetch(focusedUrl);
        assert.equal(response.status, 200);
        const focusedHtml = await response.text();
        const markup = await page.evaluate((full, focused, wanted) => {
          const selector = `[data-review-slug="${wanted}"]`;
          // Astro emits a component's module at its first instance. Focusing
          // moves that script tag into the card; compare its source separately.
          return [full, focused].map(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const modules = [...doc.querySelectorAll('script[type="module"][src]')].map(el => el.getAttribute('src'));
            const card = doc.querySelector(selector);
            card?.querySelectorAll('script[type="module"][src]').forEach(el => el.remove());
            return { markup: card?.outerHTML.replace(/>\s+</g, '><'), modules };
          });
        }, fullHtml, focusedHtml, slug);
        assert.ok(markup[0].markup, `${slug}: full card exists`);
        assert.ok(markup[1].modules.every(src => markup[0].modules.includes(src)), `${slug}: identical component module sources`);
        assert.ok(markup[1].markup === markup[0].markup, `${slug}: exact visible card markup and attributes`);
        for (const width of [390, 1280]) {
          await page.setViewport({ width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
          const dimensions = [];
          for (const target of [url, focusedUrl]) {
            await page.goto(target, { waitUntil: 'load' });
            await page.evaluate(() => document.fonts.ready);
            dimensions.push(await page.$eval(`[data-review-slug="${slug}"]`, card => [card, ...card.querySelectorAll('.rv-pair, .exact-topic-demo')].map(el => {
              const box = el.getBoundingClientRect();
              return [Math.round(box.width * 100) / 100, Math.round(box.height * 100) / 100];
            })));
          }
          assert.deepEqual(dimensions[1], dimensions[0], `${slug} @${width}: wrapper/demo dimensions unchanged`);
          assert.deepEqual(await page.$$eval('[data-review-slug]', cards => cards.map(card => card.getAttribute('data-review-slug'))), [slug]);
          assert.equal(await page.$$eval('.rv-index li', rows => rows.length), count, 'focused view retains full independent index');
          assert.equal(await page.$eval('meta[name="robots"]', el => el.getAttribute('content')), 'noindex, nofollow');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.classList.contains('nd-motion-enabled')), true);
        }
      }
      assert.equal(await page.$$eval('[data-review-side="before"] [data-review-missing]', els => els.length), 1);
      assert.equal(await page.$$eval('[data-review-side="after"] [data-review-missing]', els => els.length), 0);
      const invalid = await page.goto(`${server.origin}/review/landing-loops-pr-a?focus=not-a-gallery-card`, { waitUntil: 'load' });
      assert.equal(invalid?.status(), 404);
      assert.equal(await page.$$eval('[data-review-slug]', cards => cards.length), 0);
      assert.ok(await page.$('[data-review-focus-error]'));
      assert.equal(await page.$('vite-error-overlay'), null);
    } finally {
      await page.close();
      await browser.close();
      server.stop();
    }
  });
});
