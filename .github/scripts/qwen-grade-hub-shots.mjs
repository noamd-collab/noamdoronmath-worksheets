/**
 * Grade-hub topic sections for visual review.
 * The new links sit below the grade player, so a top-of-page shot misses them.
 * This module does not launch a browser on import.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ELEMENTARY_GRADE_HUB_PAGES, GRADE_HUB_NAV_FILES } from './pr-pages.mjs';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

export function shouldCaptureGradeHubTopics(files) {
  return files.some((file) => GRADE_HUB_NAV_FILES.includes(String(file).replaceAll('\\', '/')));
}

async function loadPlaywright() {
  const specifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const imported = await import(specifier);
  const api = imported.chromium ? imported : imported.default;
  if (!api?.chromium) throw new Error('Playwright did not export chromium');
  return api;
}

/**
 * Scroll the elementary topic list under the sticky header, inside the phone
 * scrollport when that frame is the scroller.
 */
export function gradeHubTopicScrollScript() {
  const section = document.querySelector('[data-elementary-topics]');
  if (!section) return false;
  const header = document.querySelector('.exact-header');
  const frame = document.querySelector('.exact-frame');
  // overflow-x:hidden makes overflow-y compute to auto even when the frame
  // grows with the page. Scroll the box that actually overflows.
  const frameScrolls = frame && frame.scrollHeight > frame.clientHeight + 2;
  const scroller = frameScrolls ? frame : document.scrollingElement;
  if (!scroller) return false;
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const scrollerTop = frameScrolls ? frame.getBoundingClientRect().top : 0;
  scroller.scrollTop += section.getBoundingClientRect().top - scrollerTop - headerH - 12;
  const rect = section.getBoundingClientRect();
  return rect.top < headerH + 24 && rect.bottom > headerH;
}

/**
 * Shoot /grade-1 … /grade-6 with the topic list in frame, at 390 and 1280.
 */
export async function captureGradeHubTopicShots({ baseUrl, outDir }) {
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
    for (const pageUrl of ELEMENTARY_GRADE_HUB_PAGES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: 'he-IL',
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const file = join(outDir, `${pageUrl.replace(/\//g, '')}-topics-${viewport.name}.png`);
        let status = 0;
        let error = '';
        try {
          const response = await page.goto(new URL(pageUrl, baseUrl).href, {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
          });
          status = response?.status() ?? 0;
          await page.waitForSelector('[data-elementary-topics]', { timeout: 15000 });
          const visible = await page.evaluate(gradeHubTopicScrollScript);
          if (!visible) throw new Error(`${pageUrl}: topic section is not in view`);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          await page.screenshot({ path: file, fullPage: false, type: 'png' });
          shots.push({
            file,
            pageUrl,
            coverage: 'elementary topic links',
            viewport: viewport.name,
            width: viewport.width,
            status,
          });
        } catch (err) {
          error = err instanceof Error ? err.message : 'grade hub topic screenshot failed';
          shots.push({
            file,
            pageUrl,
            coverage: 'elementary topic links',
            viewport: viewport.name,
            width: viewport.width,
            status,
            error,
          });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return shots;
}
