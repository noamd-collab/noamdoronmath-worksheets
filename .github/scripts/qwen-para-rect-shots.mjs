/**
 * Homepage para-rect frames for visual review.
 * The shared-component diff has no page file, so the fallback pages never
 * show this film. This module does not launch a browser on import.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FILM_FILES = [
  'headless/astro-poc/src/lib/conceptLoops.ts',
  'headless/astro-poc/src/components/ConceptLoop.astro',
];
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

/** Parallelogram (labels on, shear still full) and the rectangle hold. */
export const PARA_RECT_FRAMES = [
  { name: 'parallelogram', t: 1 },
  { name: 'rectangle', t: 5.4 },
];

export function shouldCaptureParaRectFilm(files) {
  return files.some((file) => FILM_FILES.includes(String(file).replaceAll('\\', '/')));
}

/** Value for Math.random() so the hero shuffle selects `variant`. */
export function shuffleUnitFor(candidates, variant) {
  const index = candidates.indexOf(variant);
  if (index < 0 || candidates.length === 0) return null;
  return (index + 0.5) / candidates.length;
}

async function loadPlaywright() {
  const specifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const imported = await import(specifier);
  const api = imported.chromium ? imported : imported.default;
  if (!api?.chromium) throw new Error('Playwright did not export chromium');
  return api;
}

async function showParaRect(page) {
  await page.waitForSelector('[data-exact-shuffle]', { timeout: 15000 });
  await page.waitForFunction(() => {
    const loop = document.querySelector('[data-hero-loop-current] [data-loop]');
    return Boolean(loop && loop.__loop);
  }, undefined, { timeout: 15000 });
  const armed = await page.evaluate(() => {
    const rotation = JSON.parse(document.querySelector('[data-hero-rotation]')?.textContent || '[]');
    const current = document.querySelector('[data-hero-loop-current] [data-loop]')?.dataset.loop || '';
    if (current === 'para-rect') return true;
    const candidates = rotation.map((entry) => entry.variant).filter((variant) => variant !== current);
    const index = candidates.indexOf('para-rect');
    if (index < 0) return false;
    const real = Math.random;
    Math.random = () => (index + 0.5) / candidates.length;
    document.querySelector('[data-exact-shuffle]')?.click();
    Math.random = real;
    return true;
  });
  if (!armed) throw new Error('homepage rotation has no para-rect film');
  await page.waitForFunction(() => {
    const loop = document.querySelector('[data-hero-loop-current] [data-loop="para-rect"]');
    return Boolean(loop && loop.__loop && typeof loop.__loop.seek === 'function');
  }, undefined, { timeout: 15000 });
}

async function seekFilm(page, t) {
  await page.evaluate((time) => {
    const loop = document.querySelector('[data-hero-loop-current] [data-loop="para-rect"]');
    loop.__loop.pause();
    loop.__loop.seek(time);
  }, t);
}

/**
 * Open the homepage, show the parallelogram film, and shoot the rectangle
 * and parallelogram frames at phone and desktop widths.
 */
export async function captureParaRectFilmShots({ baseUrl, outDir }) {
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
      let status = 0;
      try {
        const response = await page.goto(new URL('/', baseUrl).href, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        status = response?.status() ?? 0;
        await showParaRect(page);
        const panel = page.locator('[data-exact-hero-panel]');
        await panel.scrollIntoViewIfNeeded({ timeout: 15000 });
        for (const frame of PARA_RECT_FRAMES) {
          const file = join(outDir, `home-para-rect-${frame.name}-${viewport.name}.png`);
          try {
            await seekFilm(page, frame.t);
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            await seekFilm(page, frame.t);
            await panel.screenshot({ path: file, type: 'png' });
            shots.push({
              file,
              pageUrl: '/',
              coverage: `homepage para-rect ${frame.name} t=${frame.t}s`,
              viewport: viewport.name,
              width: viewport.width,
              status,
            });
          } catch (err) {
            shots.push({
              file,
              pageUrl: '/',
              coverage: `homepage para-rect ${frame.name} t=${frame.t}s`,
              viewport: viewport.name,
              width: viewport.width,
              status,
              error: err instanceof Error ? err.message : 'para-rect screenshot failed',
            });
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'para-rect screenshot failed';
        for (const frame of PARA_RECT_FRAMES) {
          shots.push({
            file: join(outDir, `home-para-rect-${frame.name}-${viewport.name}.png`),
            pageUrl: '/',
            coverage: `homepage para-rect ${frame.name} t=${frame.t}s`,
            viewport: viewport.name,
            width: viewport.width,
            status,
            error,
          });
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return shots;
}
