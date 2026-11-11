import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MIDDLE_LESSON_TOPIC_MAP } from '../src/lib/middleTopicLessons.ts';
import { launchBrowser, startReviewServer } from './helpers/landingMotion.ts';

describe('middle lesson equations at phone width', { timeout: 180_000 }, () => {
  it('keeps complete equations on one line in both scenes and worked steps at 390px', async () => {
    const server = await startReviewServer('/review/landing-loops-pr-b');
    const browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
      const response = await page.goto(`${server.origin}/review/landing-loops-pr-b`, { waitUntil: 'load', timeout: 30_000 });
      assert.equal(response?.status(), 200);
      await page.waitForSelector('[data-review-slug="equilateral-triangle-grade-7"] [data-review-side="after"] .lesson', { timeout: 30_000 });
      await page.evaluate(async () => {
        document.documentElement.classList.add('nd-motion-off');
        // Reproduce the narrow 210px demo column observed on the actual phone
        // landing, while retaining the real components and 390px viewport.
        document.querySelectorAll<HTMLElement>('[data-review-side="after"] .ll').forEach(el => { el.style.width = '210px'; el.style.maxWidth = '100%'; });
        await document.fonts.ready;
      });
      const variants = new Set<string>();
      mkdirSync('reports/middle-math-mobile', { recursive: true });
      for (const [slug, variant] of Object.entries(MIDDLE_LESSON_TOPIC_MAP)) {
        if (variants.has(variant)) continue;
        variants.add(variant);
        const selector = `[data-review-slug="${slug}"] [data-review-side="after"] .lesson`;
        await page.$eval(selector, el => el.scrollIntoView({ block: 'center' }));
        const statements = await page.$$eval(`${selector} .math-statement`, elements => elements.map(el => {
          const box = el.getBoundingClientRect();
          const parent = el.parentElement!.getBoundingClientRect();
          const style = getComputedStyle(el);
          return { text: el.textContent?.trim(), left: box.left, right: box.right, parentLeft: parent.left, parentRight: parent.right, whiteSpace: style.whiteSpace, fontSize: parseFloat(style.fontSize) };
        }));
        assert.ok(statements.length >= 3, slug);
        for (const statement of statements) {
          const label = `${slug}: ${statement.text}`;
          assert.equal(statement.whiteSpace, 'nowrap', label);
          assert.ok(statement.left >= statement.parentLeft - 1, `${label} escapes left`);
          assert.ok(statement.right <= statement.parentRight + 1, `${label} escapes right`);
          assert.ok(statement.fontSize >= 10, `${label} becomes unreadably small`);
          assert.ok(!statement.text?.includes(';'), `${label} should be split at the statement boundary`);
        }
        if (variant === 'graphical-inequality') {
          assert.ok(statements.some(s => s.text === 'f(x) = x + 1'));
          assert.ok(statements.some(s => s.text === 'g(x) = 7 − x'));
        }
        if (['graphical-inequality', 'line-from-points', 'missing-mean', 'numeric-denominators', 'system-elimination'].includes(variant)) {
          const scene = await page.$(selector);
          await scene!.screenshot({ path: `reports/middle-math-mobile/${variant}-390.png` });
        }
      }
      assert.equal(variants.size, 21);
    } finally {
      await page.close();
      await browser.close();
      server.stop();
    }
  });
});
