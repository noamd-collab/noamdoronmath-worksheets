/**
 * Extra homepage evidence for visual review when the home promo or its doodles change.
 * This module deliberately does not launch a browser on import.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const HOMEPAGE_PAGE = 'headless/astro-poc/src/pages/index.astro';
const GAME_PROMO = 'headless/astro-poc/src/components/GamePromoCard.astro';
const DOODLES = 'headless/astro-poc/public/design-exact/assets/doodles/';
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

/** Keep costly below-fold evidence limited to homepage, promo, and doodle diffs. */
export function shouldCaptureHomepageGameShots(files) {
  return files.some((file) => {
    const normalized = String(file).replaceAll('\\', '/');
    return normalized === HOMEPAGE_PAGE
      || normalized === GAME_PROMO
      || normalized.startsWith(DOODLES);
  });
}

async function loadPlaywright() {
  const specifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const imported = await import(specifier);
  const api = imported.chromium ? imported : imported.default;
  if (!api?.chromium) throw new Error('Playwright did not export chromium');
  return api;
}

/**
 * Capture the actual, lazy-loaded GamePromoCard in a scrolled viewport.
 * Failed captures remain in the returned manifest so the advisory review reports
 * missing evidence rather than silently substituting an image.
 */
export async function captureHomepageGameShots({ baseUrl, outDir }) {
  const { chromium } = await loadPlaywright();
  mkdirSync(outDir, { recursive: true });
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [];
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'he-IL',
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const file = join(outDir, `home-game-promo-below-fold-${viewport.name}.png`);
      let status = 0;
      let error = '';
      try {
        const response = await page.goto(new URL('/', baseUrl).href, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        status = response?.status() ?? 0;
        const card = page.locator('a[data-home-game-promo]');
        await card.scrollIntoViewIfNeeded({ timeout: 15000 });
        await page.waitForFunction(() => {
          const cardElement = document.querySelector('a[data-home-game-promo]');
          const image = cardElement?.querySelector('img');
          if (!cardElement || !(image instanceof HTMLImageElement)) return false;
          const rect = cardElement.getBoundingClientRect();
          return image.complete && image.naturalWidth > 0
            && rect.top < window.innerHeight && rect.bottom > 0;
        }, undefined, { timeout: 15000 });
        // complete/naturalWidth alone can precede paint with decoding="async".
        await page.locator('a[data-home-game-promo] img').evaluate(async (image) => {
          await image.decode();
          await document.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await page.screenshot({ path: file, fullPage: false, type: 'png' });
        shots.push({
          file,
          pageUrl: '/',
          coverage: 'GamePromoCard below-fold',
          viewport: viewport.name,
          width: viewport.width,
          status,
        });
      } catch (err) {
        error = err instanceof Error ? err.message : 'GamePromoCard screenshot failed';
        shots.push({
          file,
          pageUrl: '/',
          coverage: 'GamePromoCard below-fold',
          viewport: viewport.name,
          width: viewport.width,
          status,
          error,
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return shots;
}
