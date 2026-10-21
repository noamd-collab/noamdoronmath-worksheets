/**
 * Teacher print-pack screenshots for Qwen visual review.
 * Advances the /teachers wizard to the printed worksheet result step and
 * screenshots the rendered PDF crop sheets (questions page + final answers page)
 * at 390px and 1280px. Does not launch a browser on import.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { isTeacherFile } from './pr-pages.mjs';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

export function shouldCaptureTeacherPrintShots(files) {
  return files.some((file) => isTeacherFile(file));
}

async function loadPlaywright() {
  const specifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const imported = await import(specifier);
  const api = imported.chromium ? imported : imported.default;
  if (!api?.chromium) throw new Error('Playwright did not export chromium');
  return api;
}

/**
 * Scroll a rendered .crop-sheet inside #wizard-preview under the sticky header,
 * scrolling .app on phone when .app is the active scrollport.
 */
export function teacherSheetScrollScript(sheetIndex = 0) {
  const sheets = document.querySelectorAll('#wizard-preview .crop-sheet');
  const sheet = sheets[sheetIndex];
  if (!sheet) return false;
  const target = sheetIndex === 0 ? (document.querySelector('#wizard-result') || sheet) : sheet;
  const header = document.querySelector('.topbar, .exact-header');
  const app = document.querySelector('.app');
  const appScrolls = app && app.scrollHeight > app.clientHeight + 2;
  const scroller = appScrolls ? app : document.scrollingElement;
  if (!scroller) return false;
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const scrollerTop = appScrolls ? app.getBoundingClientRect().top : 0;
  scroller.scrollTop += target.getBoundingClientRect().top - scrollerTop - headerH - 12;
  const rect = sheet.getBoundingClientRect();
  return rect.bottom > headerH && rect.top < window.innerHeight;
}

/**
 * Shoot /teachers on the printed worksheet result step (page 1 questions and
 * page 2 final answers) at 390 and 1280.
 */
export async function captureTeacherPrintShots({ baseUrl, outDir }) {
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
        const response = await page.goto(new URL('/teachers', baseUrl).href, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        status = response?.status() ?? 0;
        await page.waitForSelector('#questions [data-question]', { state: 'attached', timeout: 20000 });
        for (let step = 0; step < 6; step += 1) {
          await page.click('#wizard-next');
          await page.waitForTimeout(150);
        }
        await page.waitForFunction(
          () => {
            const canvases = document.querySelectorAll('#wizard-preview .crop-sheet canvas');
            return canvases.length > 0 && Array.from(canvases).every((c) => c.width > 0 && c.height > 0);
          },
          { timeout: 30000 },
        );
        const sheetCount = await page.locator('#wizard-preview .crop-sheet').count();
        const pagesToCapture = Math.min(sheetCount, 2);
        for (let idx = 0; idx < pagesToCapture; idx += 1) {
          const pageNum = idx + 1;
          const file = join(outDir, `teachers-print-page-${pageNum}-${viewport.name}.png`);
          const visible = await page.evaluate(teacherSheetScrollScript, idx);
          if (!visible) throw new Error(`/teachers: printed sheet ${pageNum} is not in view`);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          await page.screenshot({ path: file, fullPage: false, type: 'png' });
          shots.push({
            file,
            pageUrl: '/teachers',
            coverage: `printed worksheet page ${pageNum}`,
            viewport: viewport.name,
            width: viewport.width,
            status,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'teacher print screenshot failed';
        const file = join(outDir, `teachers-print-page-1-${viewport.name}.png`);
        shots.push({
          file,
          pageUrl: '/teachers',
          coverage: 'printed worksheet page 1',
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
