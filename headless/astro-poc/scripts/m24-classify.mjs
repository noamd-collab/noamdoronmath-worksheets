import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const TARGETS = [
  { path: '/aboutus', expectedBucket: 'site-nav-page' },
  { path: '/high-school-math-1', expectedBucket: 'site-nav-page' },
  { path: '/math-tools', expectedBucket: 'site-nav-page' },
  { path: '/accessibilityadaptation', expectedBucket: 'policy' },
  { path: '/terms', expectedBucket: 'policy' },
  { path: '/conditionforfreeworksheets', expectedBucket: 'policy' }, // misbucketed as topic-seo
  { path: '/high-school-math', expectedBucket: 'other-page' },
  { path: '/page', expectedBucket: 'other-page' },
];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const rows = [];
for (const t of TARGETS) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  let status = null, finalUrl = '', redirected = false, title = '', h1 = '', h2s = [], paraCount = 0, hasForm = false, hasLogin = false, hasWixMembers = false, textSample = '', error = null;
  try {
    const resp = await page.goto(`${PROD}${t.path}`, { waitUntil: 'networkidle2', timeout: 90000 });
    status = resp?.status() ?? null;
    finalUrl = page.url();
    const finalPath = new URL(finalUrl).pathname.replace(/\/$/, '') || '/';
    redirected = finalPath !== t.path;
    await new Promise((r) => setTimeout(r, 1200));
    const info = await page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const h1 = clean(document.querySelector('h1')?.textContent);
      const h2s = [...document.querySelectorAll('h2')].map((h) => clean(h.textContent)).filter(Boolean).slice(0, 12);
      const paras = [...document.querySelectorAll('p')].map((p) => clean(p.textContent)).filter((t) => t.length > 20);
      const body = clean(document.body?.innerText || '').slice(0, 500);
      return {
        title: document.title || '',
        h1,
        h2s,
        paraCount: paras.length,
        sampleParas: paras.slice(0, 4),
        hasForm: !!document.querySelector('form'),
        hasLogin: !!document.querySelector('[data-testid*="login"], a[href*="login"], button[aria-label*="התחבר"], button[aria-label*="Log"]'),
        hasWixMembers: !!(document.body?.innerHTML || '').includes('wix-members') || !!(document.body?.innerHTML || '').includes('members-login'),
        textSample: body,
        linkCount: document.querySelectorAll('a[href]').length,
      };
    });
    title = info.title; h1 = info.h1; h2s = info.h2s; paraCount = info.paraCount;
    hasForm = info.hasForm; hasLogin = info.hasLogin; hasWixMembers = info.hasWixMembers; textSample = info.textSample;
    rows.push({ ...t, status, redirected, finalUrl, finalPath: new URL(finalUrl).pathname.replace(/\/$/,'')||'/', title, h1, h2s, paraCount, sampleParas: info.sampleParas, hasForm, hasLogin, hasWixMembers, linkCount: info.linkCount, textSample, error });
    console.log(JSON.stringify({ path: t.path, status, redirected, finalPath: new URL(finalUrl).pathname, h1, h2s: h2s.slice(0,4), paraCount, hasForm, hasLogin }, null, 0));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    rows.push({ ...t, status, redirected, finalUrl, title, h1, h2s, paraCount, hasForm, hasLogin, hasWixMembers, textSample, error });
    console.log('ERR', t.path, error);
  }
  await page.close();
}
await browser.close();

mkdirSync('reports', { recursive: true });
writeFileSync('reports/m24-classify-raw.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + '\n');
console.log('\nWrote reports/m24-classify-raw.json');
