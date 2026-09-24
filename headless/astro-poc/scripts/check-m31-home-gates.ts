import puppeteer from 'puppeteer-core';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { homePageRequiredHrefs, loadHomePage } from '../src/lib/homePage.ts';

const PREVIEW = (process.env.PREVIEW || '').replace(/\/$/, '');
if (!PREVIEW) {
  console.error('Set PREVIEW=...');
  process.exit(1);
}
const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('chrome missing');
const home = loadHomePage();
const outDir = 'reports/m31-home';
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

async function checkViewport(label: string, width: number, height: number) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const resp = await page.goto(`${PREVIEW}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1200));
  const snap = await page.evaluate(`(() => {
    const text = (el) => ((el && el.innerText) || '').replace(/\\s+/g, ' ').trim();
    const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    return {
      title: document.title,
      h1: text(document.querySelector('h1')),
      hasDev: !!document.querySelector('[data-home-dev-notice]'),
      hasSearch: !!document.querySelector('[data-home-search-cta]'),
      grades: [...document.querySelectorAll('[data-home-grade]')].map((el) =>
        el.getAttribute('data-home-grade')
      ),
      aiCount: document.querySelectorAll('.home-grade__ai').length,
      hasGoogle: !!document.querySelector('[data-home-google]'),
      hasLearning: !!document.querySelector('[data-home-learning]'),
      hasValues: !!document.querySelector('[data-home-values]'),
      hasWhatsapp: !!document.querySelector('[data-home-whatsapp]'),
      hasFooter: !!document.querySelector('[data-home-footer]'),
      hrefs,
      bodyHasEmail: document.body.innerText.includes('noamd@noamdoronmath.co.il'),
      ssrVisible: {
        search: document.body.innerText.includes('למציאת משימת תרגול'),
        middle: document.body.innerText.includes('חטיבת ביניים'),
        elem: document.body.innerText.includes('יסודי ומוכנות'),
        challenge: document.body.innerText.includes('אתגר והעשרה'),
        tools: document.body.innerText.includes('תוספים'),
        highschool: document.body.innerText.includes('מתמטיקה לתיכון'),
        a11y: document.body.innerText.includes('הצהרת נגישות'),
        privacyLinked: !![...document.querySelectorAll('.site-footer__legal a')].some(
          (a) =>
            (a.textContent || '').includes('מדיניות פרטיות') &&
            (a.getAttribute('href') || '') === '/accessibilityadaptation#privacy-policy'
        ),
        privacyGapAbsent: !document.querySelector('[data-legal-gap="privacy"]'),
        privacyAnchorPresent: !!document.querySelector(
          'a[href="/accessibilityadaptation#privacy-policy"]'
        ),
        waNote: document.body.innerText.includes('ההצטרפות לבחירתכם'),
        heroArtHiddenOrClear: (() => {
          const art = document.querySelector('.hero-art');
          if (!art) return true;
          const cs = getComputedStyle(art);
          return cs.display === 'none' || cs.visibility === 'hidden';
        })(),
        valueCardsAutoHeight: [...document.querySelectorAll('.home-value')].every((el) => {
          const mh = getComputedStyle(el).minHeight;
          return mh === '0px' || mh === 'auto';
        }),
      },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  })()`);

  const internal = [
    ...new Set((snap.hrefs || []).filter((h): h is string => !!h && h.startsWith('/'))),
  ];
  const linkResults: { path: string; fetchPath: string; status: number; ok: boolean }[] = [];
  const fetched = new Map<string, number>();
  for (const path of internal) {
    const fetchPath = path.split('#')[0] || '/';
    let status = fetched.get(fetchPath);
    if (status === undefined) {
      const r = await page.goto(`${PREVIEW}${fetchPath}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      status = r?.status() ?? 0;
      fetched.set(fetchPath, status);
    }
    linkResults.push({ path, fetchPath, status, ok: status >= 200 && status < 400 });
  }
  let waOk = false;
  try {
    const wr = await fetch(home.whatsapp.ctaHref, { redirect: 'follow' });
    waOk = wr.status < 500;
  } catch {
    waOk = false;
  }

  const failLinks = linkResults.filter((x) => !x.ok);
  const result = {
    label,
    width,
    httpStatus: resp?.status() ?? 0,
    title: snap.title,
    h1: snap.h1,
    flags: {
      hasDev: snap.hasDev,
      hasSearch: snap.hasSearch,
      grades: snap.grades,
      aiCount: snap.aiCount,
      hasGoogle: snap.hasGoogle,
      hasLearning: snap.hasLearning,
      hasValues: snap.hasValues,
      hasWhatsapp: snap.hasWhatsapp,
      hasFooter: snap.hasFooter,
      bodyHasEmail: snap.bodyHasEmail,
      ssrVisible: snap.ssrVisible,
      noHorizontalOverflow: snap.scrollWidth <= snap.clientWidth + 1,
    },
    internalLinkCount: linkResults.length,
    failLinks,
    waOk,
  };
  await page.close();
  return result;
}

const desktop = await checkViewport('desktop', 1280, 900);
const mobile = await checkViewport('mobile', 390, 844);
await browser.close();

const summary = {
  preview: PREVIEW,
  desktop,
  mobile,
  requiredHrefs: homePageRequiredHrefs(home),
};
writeFileSync(`${outDir}/served-gate.json`, JSON.stringify(summary, null, 2));
const coreSsrKeys = [
  'search',
  'middle',
  'elem',
  'challenge',
  'tools',
  'highschool',
  'a11y',
  'privacyLinked',
  'privacyGapAbsent',
  'privacyAnchorPresent',
  'waNote',
] as const;
const coreSsrOk = (flags: typeof desktop.flags) =>
  coreSsrKeys.every((k) => Boolean(flags.ssrVisible[k]));
const desktopOk =
  desktop.httpStatus === 200 &&
  desktop.failLinks.length === 0 &&
  desktop.flags.grades.length === 9 &&
  desktop.flags.aiCount === 3 &&
  coreSsrOk(desktop.flags);
const mobileOk =
  mobile.httpStatus === 200 &&
  mobile.failLinks.length === 0 &&
  mobile.flags.noHorizontalOverflow &&
  coreSsrOk(mobile.flags) &&
  Boolean(mobile.flags.ssrVisible.heroArtHiddenOrClear) &&
  Boolean(mobile.flags.ssrVisible.valueCardsAutoHeight);
console.log(
  JSON.stringify(
    {
      preview: PREVIEW,
      desktopOk,
      mobileOk,
      desktopFailLinks: desktop.failLinks,
      mobileFailLinks: mobile.failLinks,
      desktopFlags: desktop.flags,
      mobilePolish: {
        overflowOk: mobile.flags.noHorizontalOverflow,
        heroArtHidden: mobile.flags.ssrVisible.heroArtHiddenOrClear,
        valueCardsAutoHeight: mobile.flags.ssrVisible.valueCardsAutoHeight,
      },
      waOk: desktop.waOk,
    },
    null,
    2
  )
);
if (!desktopOk || !mobileOk) process.exit(1);
