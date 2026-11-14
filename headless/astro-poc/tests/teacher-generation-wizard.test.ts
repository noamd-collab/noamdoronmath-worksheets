import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium';

const source = readFileSync(new URL('../src/pages/teachers/generate.astro', import.meta.url), 'utf8');
const markup = source.match(/<main[\s\S]*?<\/main>/)![0];
const css = readFileSync(new URL('../public/teachers/generation.css', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/teachers/generation.js', import.meta.url), 'utf8');
const topics = [
  { topicId: 'ג10', gradeNumber: 3, title: 'חילוק', enabled: true, e2eVerified: true, levels: ['b'], questionCounts: [12] },
  { topicId: 'g7:equations', gradeNumber: 7, title: 'משוואות', enabled: true, e2eVerified: true, levels: ['b'], questionCounts: [20] },
];

test('desktop and phone wizard use native keyboard validation with one visible question and no live requests', { timeout: 60000 }, async t => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const browser = await puppeteer.launch({ executablePath: resolveTestBrowser(), headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage(); await page.setViewport(viewport);
    const requests: { path: string; method: string }[] = [], errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url()); requests.push({ path: url.pathname, method: request.method() });
      if (url.origin !== 'https://wizard.test') return void request.abort();
      if (url.pathname === '/') return void request.respond({ status: 200, contentType: 'text/html',
        body: `<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;background:#fafbf8}${css}</style></head><body>${markup}<script>${script}</script></body></html>` });
      if (url.pathname === '/api/teacherGeneration' && request.method() === 'GET') return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, online: true, capabilities: { topics }, jobs: [{ id: 'old-job', status: 'needs_review', phase: 'needs_review',
          created_at: '2026-11-13T00:00:00Z', lesson: { topicId: 'ג10', lastLesson: 'דף קודם' }, result: { automatedChecksPassed: true } }],
      }) });
      return void request.respond({ status: 204, body: '' });
    });
    await page.goto('https://wizard.test/', { waitUntil: 'networkidle0' });
    const screen = async (heading: string) => {
      assert.deepEqual(await page.$$eval('[data-generation-step]:not([hidden])', elements => elements.map(el => el.getAttribute('aria-labelledby'))), [heading]);
      assert.equal(await page.$$eval('[data-generation-step][hidden]', elements => elements.every(el => (el as HTMLFieldSetElement).disabled)), true);
    };
    const next = async () => { await page.focus('#plan-button'); await page.keyboard.press('Enter'); };
    await screen('grade-title');
    assert.equal(await page.$eval('#generation-history', el => (el as HTMLDetailsElement).open), false);
    // Leave room for the site shell or the explicit mock banner in visual QA.
    assert.ok(await page.$eval('#plan-button', el => el.getBoundingClientRect().bottom) < viewport.height - 80);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.$eval('#generation-form', el => { const rect=el.getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth; }), true);
    if (process.env.TEACHER_WIZARD_CAPTURE_DIR) {
      await mkdir(process.env.TEACHER_WIZARD_CAPTURE_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.TEACHER_WIZARD_CAPTURE_DIR, `grade-${viewport.width}.png`), fullPage: true });
    }
    await next(); await screen('grade-title');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'generation-grade');
    await page.select('[name=gradeNumber]', '3'); await next(); await screen('topic-title');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'topic-title');
    await next(); await screen('topic-title');
    await page.select('[name=topicId]', 'ג10'); await next(); await screen('level-title');
    await next(); await screen('level-title');
    await page.select('[name=level]', 'b'); await next(); await screen('lesson-title');
    await page.click('[name=learnedDivisor][value="2"]'); await page.click('[name=learnedDivisor][value="5"]');
    await page.type('[name=boundaryMaxDividend]', '100');
    await next(); await screen('lesson-title');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'generation-last-lesson');
    await page.type('[name=lastLesson]', 'תרגלנו חילוק ללא שארית בתחום לוח הכפל');
    await page.$eval('[name=minutes]', el => { (el as HTMLInputElement).value = '9'; });
    await next(); await screen('lesson-title');
    assert.equal(await page.$eval('#lesson-options', el => (el as HTMLDetailsElement).open), true);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'minutes');
    await page.$eval('[name=minutes]', el => { (el as HTMLInputElement).value = '45'; });
    await page.type('[name=alreadyLearned]', 'כפל;חילוק');
    for (const heading of ['level-title', 'topic-title', 'grade-title']) { await page.click('#wizard-back'); await screen(heading); }
    assert.equal(await page.$eval('[name=topicId]', el => (el as HTMLSelectElement).value), 'ג10');
    assert.equal(await page.$eval('[name=level]', el => (el as HTMLSelectElement).value), 'b');
    await page.select('[name=gradeNumber]', '9'); await next(); await screen('topic-title');
    assert.equal(await page.$eval('#topic-unavailable', el => (el as HTMLElement).hidden), false);
    assert.equal(await page.$eval('#plan-button', el => (el as HTMLButtonElement).disabled), true);
    assert.equal(await page.$eval('[name=level]', el => (el as HTMLSelectElement).value), '');
    await page.click('#wizard-back'); await page.select('[name=gradeNumber]', '7'); await next();
    await page.select('[name=topicId]', 'g7:equations'); await next(); await page.select('[name=level]', 'b'); await next();
    assert.equal(await page.$eval('[name=lastLesson]', el => (el as HTMLTextAreaElement).value), 'תרגלנו חילוק ללא שארית בתחום לוח הכפל');
    assert.equal(await page.$eval('[name=minutes]', el => (el as HTMLInputElement).value), '45');
    await page.select('[name=boundarySignedNumbers]', 'no');
    await page.$eval('[name=lastLesson]', el => { (el as HTMLTextAreaElement).value = 'תרגלנו משוואות עם פתרונות שלמים ומספרים מכוונים'; });
    await next();
    assert.equal(await page.$eval('#generation-form', el => (el as HTMLElement).hidden), true);
    assert.equal(await page.$eval('#generation-plan', el => (el as HTMLElement).hidden), false);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'plan-title');
    assert.match(await page.$eval('#plan-details', el => el.textContent || ''), /20 שאלות · 45 דקות/);
    assert.match(await page.$eval('#plan-details', el => el.textContent || ''), /ללא מספרים שליליים/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok((await page.$$eval('button,summary,.generation-top>a', elements => elements.filter(el => (el as HTMLElement).offsetParent !== null).map(el => el.getBoundingClientRect().height))).every(height => height >= 44));
    if (process.env.TEACHER_WIZARD_CAPTURE_DIR) await page.screenshot({ path: join(process.env.TEACHER_WIZARD_CAPTURE_DIR, `review-${viewport.width}.png`), fullPage: true });
    assert.equal(requests.some(request => request.method === 'POST' || request.path === '/api/noamBotConfig'), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
