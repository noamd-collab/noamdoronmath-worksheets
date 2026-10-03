/**
 * Browser user journeys on a served build (run with `npm run test:journeys`).
 *
 * What is real and what is stubbed:
 * - Every page, link, redirect and status code comes from the served build.
 * - Hosts outside the build are never contacted. A request for a Wix Media PDF
 *   (static.wixstatic.com/ugd/*.pdf) gets a one-page stub PDF so the journey can check
 *   WHICH file the viewer asked for and that the viewer renders it; that the real file
 *   exists and is a PDF is not checked here. pdf.js comes from the pdfjs-dist dev
 *   dependency (same version as the CDN). Every other external request is aborted.
 * - Each journey runs on a phone (360px, touch) and a desktop (1280px) viewport and
 *   checks Hebrew RTL and that the page does not scroll sideways.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const BASE = process.env.JOURNEY_BASE_URL || '';
const CHROME = [process.env.CHROME_PATH, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(
  (path): path is string => !!path && existsSync(path)
);

type Level = { key: string; label: string; pdfId: string };
type Topic = { id: number; title: string; group: string; parent?: number; levels: Level[] };
type Grade = { grade: number; label: string; groups: { key: string; reducedProgram?: boolean }[]; topics: Topic[] };

const catalog: { grades: Grade[] } = JSON.parse(
  readFileSync(new URL('../../src/data/catalog.v1.json', import.meta.url), 'utf8')
);
const gradeOf = (g: number) => {
  const entry = catalog.grades.find((x) => x.grade === g);
  assert.ok(entry, `catalog grade ${g}`);
  return entry;
};
const topicOf = (g: number, t: number) => {
  const topic = gradeOf(g).topics.find((x) => x.id === t);
  assert.ok(topic, `catalog grade ${g} topic ${t}`);
  return topic;
};
/** pdfId → every (grade, topic) that lists it. */
const pdfOwners = new Map<string, { grade: number; topic: number; parent?: number }[]>();
for (const g of catalog.grades) {
  for (const t of g.topics) {
    for (const l of t.levels) {
      pdfOwners.set(l.pdfId, [...(pdfOwners.get(l.pdfId) || []), { grade: g.grade, topic: t.id, parent: t.parent }]);
    }
  }
}

type TopicPage = { path: string; grade: number; h1: string; catalogCta?: { catalogTopicId?: number } };
const topicPages: TopicPage[] = readdirSync(new URL('../../src/data/topic-pages/', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(`../../src/data/topic-pages/${f}`, import.meta.url), 'utf8')));
const topicPagePaths = new Set(topicPages.map((p) => p.path));

const VIEWPORTS = {
  phone: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1280, height: 800 },
} as const;
type ViewportName = keyof typeof VIEWPORTS;

/** A valid one-page A4 PDF (a filled rectangle), so pdf.js renders it like a real worksheet. */
function stubPdf(): Buffer {
  const content = '0 0 1 rg 100 600 200 100 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const STUB_PDF = stubPdf();
/**
 * The viewer loads pdf.js 3.11.174 from jsDelivr. The same version from the
 * pdfjs-dist dev dependency is served instead, so the viewer renders with pdf.js
 * as in production rather than falling back to Chrome's built-in PDF frame.
 */
const PDFJS_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@3\.11\.174\/build\/(pdf\.min\.js|pdf\.worker\.min\.js)$/;
/** The viewer loads both cross-origin (crossorigin script, fetch), so the real hosts must allow it too. */
const CORS = { 'Access-Control-Allow-Origin': '*' };
const pdfjsFile = (name: string) => readFileSync(new URL(`../../node_modules/pdfjs-dist/build/${name}`, import.meta.url));
const WIX_PDF = /^https:\/\/static\.wixstatic\.com\/ugd\/d8e7ad_([0-9a-f]{32})\.pdf(?:[?#].*)?$/;
/** A cached document comes back as 304; both mean the server answered. */
const served = (status: number | undefined) => status === 200 || status === 304;

let browser: Browser;

before(async () => {
  assert.ok(BASE, 'JOURNEY_BASE_URL is not set: run through `npm run test:journeys`');
  assert.ok(CHROME, 'no Chrome/Chromium found: set CHROME_PATH');
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
});
after(async () => {
  await browser?.close();
});

type Tab = { page: Page; pdfRequests: string[]; external: string[] };

async function openTab(viewport: ViewportName): Promise<Tab> {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS[viewport]);
  await page.setRequestInterception(true);
  const tab: Tab = { page, pdfRequests: [], external: [] };
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:')) {
      void request.continue();
      return;
    }
    tab.external.push(url);
    const pdfjs = url.match(PDFJS_CDN);
    if (pdfjs) {
      void request.respond({ status: 200, contentType: 'application/javascript', headers: CORS, body: pdfjsFile(pdfjs[1]) });
      return;
    }
    const pdf = url.match(WIX_PDF);
    if (pdf) {
      tab.pdfRequests.push(pdf[1]);
      void request.respond({ status: 200, contentType: 'application/pdf', headers: CORS, body: STUB_PDF });
      return;
    }
    void request.abort('blockedbyclient');
  });
  return tab;
}

async function go(tab: Tab, path: string) {
  const response = await tab.page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  assert.ok(response, `no response for ${path}`);
  return response;
}

/**
 * The browser back button. A page restored from the back/forward cache fires no
 * DOMContentLoaded, so wait for the URL to change rather than for a load event.
 */
async function back(tab: Tab, label: string) {
  const from = tab.page.url();
  // As a person would: once the page has finished loading.
  await tab.page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 });
  // Browser-level back (the toolbar button). A bfcache restore may never resolve the
  // navigation promise, so the URL is what is checked.
  void tab.page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
  const end = Date.now() + 15000;
  while (tab.page.url() === from && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  assert.notEqual(tab.page.url(), from, `${label}: back did not leave ${from}`);
  await tab.page.waitForFunction(() => document.readyState !== 'loading', { timeout: 15000 });
}

async function assertHebrewRtl(tab: Tab, label: string) {
  const state = await tab.page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.equal(state.lang, 'he', `${label}: lang`);
  assert.equal(state.dir, 'rtl', `${label}: dir`);
  assert.ok(state.overflow <= 1, `${label}: page scrolls sideways by ${state.overflow}px`);
}

/** The catalog island is interactive (other islands may wait until scrolled into view). */
async function hydrated(tab: Tab) {
  await tab.page.waitForSelector('astro-island[component-export="WorksheetsClient"]:not([ssr])', { timeout: 15000 });
}

/** Index of the first visible element matching the selector (the phone layout hides some duplicates). */
async function visibleIndex(tab: Tab, selector: string, label: string) {
  const index = await tab.page.$$eval(selector, (els) =>
    els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    })
  );
  assert.ok(index >= 0, `${label}: nothing visible matches ${selector}`);
  return index;
}

async function clickVisible(tab: Tab, selector: string, label: string) {
  const index = await visibleIndex(tab, selector, label);
  const handles = await tab.page.$$(selector);
  const [response] = await Promise.all([
    tab.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    handles[index].evaluate((el) => (el as HTMLElement).click()),
  ]);
  assert.ok(response, `${label}: click did not navigate`);
  assert.ok(served(response.status()), `${label}: HTTP ${response.status()} for ${tab.page.url()}`);
}

/**
 * A worksheet link: middle-school levels open the viewer (g/topic/pdf in the query),
 * elementary levels link the Wix Media PDF directly (grade/topic come from the page).
 */
type ViewerLink = { href: string; g: number; topic: number; x: string; pdf: string; back: string; direct: boolean };

async function viewerLinks(tab: Tab, scope = 'body', context?: { grade: number; topic: number }): Promise<ViewerLink[]> {
  const hrefs = await tab.page.$$eval(
    `${scope} a[href*="worksheet-viewer-noam.html"], ${scope} a[href^="https://static.wixstatic.com/ugd/"]`,
    (as) => as.map((a) => (a as HTMLAnchorElement).href)
  );
  return hrefs.map((href) => {
    const direct = href.match(WIX_PDF);
    if (direct) {
      assert.ok(context, `direct PDF link ${href} outside a known grade/topic`);
      return { href, g: context.grade, topic: context.topic, x: '', pdf: direct[1], back: '', direct: true };
    }
    const q = new URL(href).searchParams;
    return {
      href,
      g: Number(q.get('g')),
      topic: Number(q.get('topic')),
      x: q.get('x') || '',
      pdf: q.get('pdf') || '',
      back: q.get('back') || '',
      direct: false,
    };
  });
}

/** The PDF a level link opens belongs to the topic the link claims (or that topic's subtopic). */
function assertLinkMatchesCatalog(link: ViewerLink, label: string) {
  const owners = pdfOwners.get(link.pdf) || [];
  assert.ok(
    owners.some((o) => o.grade === link.g && (o.topic === link.topic || o.parent === link.topic)),
    `${label}: pdf ${link.pdf} is not grade ${link.g} topic ${link.topic} (owners ${JSON.stringify(owners)})`
  );
}

/** Open a level link in the viewer and check which PDF it asks for. */
async function openWorksheet(tab: Tab, link: ViewerLink, label: string) {
  assertLinkMatchesCatalog(link, label);
  if (link.direct) {
    // The stub answers; Chrome may treat the PDF as a download, which aborts the navigation.
    await tab.page.goto(link.href, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    assert.ok(tab.pdfRequests.includes(link.pdf), `${label}: direct link did not request d8e7ad_${link.pdf}.pdf (stubbed)`);
    return;
  }
  const response = await tab.page.goto(link.href, { waitUntil: 'domcontentloaded' });
  assert.ok(served(response?.status()), `${label}: viewer HTTP ${response?.status()}`);
  const end = Date.now() + 10000;
  while (!tab.pdfRequests.includes(link.pdf) && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  assert.ok(tab.pdfRequests.includes(link.pdf), `${label}: viewer did not request d8e7ad_${link.pdf}.pdf (stubbed)`);
  // pdf.js drew the (stub) page; the built-in PDF frame fallback stayed unused.
  await tab.page.waitForSelector('.pdf-page.is-ready canvas', { timeout: 15000 });
  assert.equal(await tab.page.$eval('#pdf', (f) => f.getAttribute('src')), null, `${label}: viewer fell back to the PDF frame`);
  const back = await tab.page.$eval('#backBtn', (a) => (a as HTMLAnchorElement).getAttribute('href') || '');
  assert.ok(back.includes(`grade=${link.g}`), `${label}: viewer back link ${back} does not return to grade ${link.g}`);
}

/**
 * From a topic page to a worksheet: its own level buttons when it has them,
 * otherwise its catalog call-to-action (/worksheets?grade=…&topic=…) and the card there.
 */
async function worksheetFromTopicPage(tab: Tab, page: TopicPage, label: string) {
  const own = await viewerLinks(tab, 'main');
  const cta = page.catalogCta?.catalogTopicId;
  if (own.length > 0) {
    if (cta != null) assert.ok(own.some((l) => l.topic === cta), `${label}: no level link for catalog topic ${cta}`);
    await openWorksheet(tab, own[0], label);
    return;
  }
  await clickVisible(tab, 'main a[href^="/worksheets?grade="][href*="topic="]', `${label}: catalog CTA`);
  await hydrated(tab);
  await assertHebrewRtl(tab, `${label} catalog`);
  const url = new URL(tab.page.url());
  const grade = Number(url.searchParams.get('grade'));
  const topic = Number(url.searchParams.get('topic'));
  if (cta != null) assert.equal(topic, cta, `${label}: CTA topic`);
  const card = topicOf(grade, topic).parent ?? topic;
  const links = await viewerLinks(tab, `article.card[data-topic-id="${card}"]`, { grade, topic: card });
  assert.ok(links.length > 0, `${label}: catalog card ${card} has no level links`);
  await openWorksheet(tab, links[0], label);
}

const viewports = Object.keys(VIEWPORTS) as ViewportName[];

describe('journey: home → grade → topic → worksheet', () => {
  for (const viewport of viewports) {
    for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      it(`grade ${grade} on ${viewport}`, async () => {
        const tab = await openTab(viewport);
        try {
          const label = `grade ${grade} ${viewport}`;
          await go(tab, '/');
          await assertHebrewRtl(tab, `${label} home`);
          await clickVisible(tab, `a[href="/grade-${grade}"]`, `${label} home → hub`);
          assert.equal(new URL(tab.page.url()).pathname, `/grade-${grade}`);
          await assertHebrewRtl(tab, `${label} hub`);

          const hubTopicPages = (
            await tab.page.$$eval('main a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))
          ).filter((href) => topicPagePaths.has(href));
          if (hubTopicPages.length > 0) {
            // Middle school: hub → topic page → level link.
            const target = hubTopicPages[0];
            await clickVisible(tab, `main a[href="${target}"]`, `${label} hub → topic page`);
            await assertHebrewRtl(tab, `${label} topic page`);
            const page = topicPages.find((p) => p.path === target);
            assert.ok(page);
            const h1 = await tab.page.$eval('h1', (el) => el.textContent?.trim() || '');
            assert.equal(h1, page.h1, `${label}: topic page h1`);
            await worksheetFromTopicPage(tab, page, `${label} ${target}`);
          } else {
            // Elementary: hub → catalog grade → topic card → level link.
            await clickVisible(tab, `main a[href="/worksheets?grade=${grade}"]`, `${label} hub → catalog`);
            await hydrated(tab);
            await assertHebrewRtl(tab, `${label} catalog`);
            const card = await tab.page.$eval('article.card[data-topic-id]', (el) => Number(el.getAttribute('data-topic-id')));
            const links = await viewerLinks(tab, `article.card[data-topic-id="${card}"]`, { grade, topic: card });
            assert.equal(links.length, topicOf(grade, card).levels.length, `${label}: level links on card ${card}`);
            for (const link of links) assertLinkMatchesCatalog(link, `${label} card ${card}`);
            await openWorksheet(tab, links[0], `${label} card ${card}`);
          }
          // The browser back button returns to the page the worksheet came from.
          await back(tab, label);
          assert.notEqual(new URL(tab.page.url()).pathname, '/worksheet-viewer-noam.html', `${label}: back`);
        } finally {
          await tab.page.close();
        }
      });
    }
  }
});

/** Chosen by structure and risk, one or more per grade. */
const CATALOG_CASES: { grade: number; topic: number; why: string }[] = [
  { grade: 1, topic: gradeOf(1).topics[0].id, why: 'first elementary topic' },
  { grade: 2, topic: gradeOf(2).topics.find((t) => t.group === 'frac')!.id, why: 'fractions group' },
  { grade: 3, topic: gradeOf(3).topics.find((t) => t.group === 'meas')!.id, why: 'measurement group (unit labels)' },
  { grade: 4, topic: gradeOf(4).topics.find((t) => t.group === 'synth')!.id, why: 'synthesis group' },
  { grade: 5, topic: gradeOf(5).topics.find((t) => t.group === 'dec')!.id, why: 'decimals group' },
  { grade: 6, topic: gradeOf(6).topics.find((t) => t.group === 'pct')!.id, why: 'percent group' },
  { grade: 7, topic: 16, why: 'single-level topic' },
  { grade: 8, topic: 26, why: 'single level; viewer prefix G8-T35 differs from the topic id' },
  { grade: 9, topic: 33, why: 'reduced program: needs track=red' },
  { grade: 9, topic: 41, why: 'subtopic listed inside topic 2' },
];

describe('journey: catalog filtered by grade and topic → PDF', () => {
  for (const viewport of viewports) {
    for (const c of CATALOG_CASES) {
      it(`grade ${c.grade} topic ${c.topic} (${c.why}) on ${viewport}`, async () => {
        const tab = await openTab(viewport);
        try {
          const label = `grade ${c.grade} topic ${c.topic} ${viewport}`;
          const response = await go(tab, `/worksheets?grade=${c.grade}&topic=${c.topic}`);
          assert.ok(served(response.status()));
          await hydrated(tab);
          await assertHebrewRtl(tab, label);
          const topic = topicOf(c.grade, c.topic);
          const cardId = topic.parent ?? topic.id;
          const cards = await tab.page.$$eval('article.card[data-topic-id]', (els) =>
            els.map((el) => Number(el.getAttribute('data-topic-id')))
          );
          assert.deepEqual(cards, [cardId], `${label}: pinned card`);
          const status = await tab.page.$eval('[data-catalog-status]', (el) => el.textContent?.trim() || '');
          assert.match(status, /מוצג הנושא שנבחר/, `${label}: status`);
          const links = await viewerLinks(tab, `article.card[data-topic-id="${cardId}"]`, { grade: c.grade, topic: cardId });
          for (const level of topic.levels) {
            assert.ok(links.some((l) => l.pdf === level.pdfId), `${label}: no link for level ${level.key} (${level.pdfId})`);
          }
          for (const link of links) assertLinkMatchesCatalog(link, label);
          const own = links.find((l) => l.pdf === topic.levels[0].pdfId)!;
          if (!own.direct) assert.ok(own.back.includes(`grade=${c.grade}`), `${label}: back=${own.back}`);
          await openWorksheet(tab, own, label);
        } finally {
          await tab.page.close();
        }
      });
    }
  }
});

describe('journey: blog → post → related topic → worksheet', () => {
  for (const viewport of viewports) {
    it(`on ${viewport}`, async () => {
      const tab = await openTab(viewport);
      try {
        await go(tab, '/blog');
        await assertHebrewRtl(tab, `${viewport} blog`);
        const cards = await tab.page.$$eval('main a[href^="/post/"]', (as) => [
          ...new Set(as.map((a) => a.getAttribute('href') || '')),
        ]);
        assert.ok(cards.length >= 5, `${viewport}: blog cards ${cards.length}`);
        let opened = false;
        for (const href of cards.slice(0, 6)) {
          await go(tab, '/blog');
          await clickVisible(tab, `main a[href="${href}"]`, `${viewport} blog → ${href}`);
          await assertHebrewRtl(tab, `${viewport} ${href}`);
          const related = (
            await tab.page.$$eval('.blog-post__related-topics a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))
          ).filter((h) => topicPagePaths.has(h));
          if (!related.length) continue;
          await clickVisible(tab, `.blog-post__related-topics a[href="${related[0]}"]`, `${viewport} post → topic`);
          assert.equal(new URL(tab.page.url()).pathname, related[0]);
          await assertHebrewRtl(tab, `${viewport} ${related[0]}`);
          const page = topicPages.find((p) => p.path === related[0]);
          assert.ok(page);
          await worksheetFromTopicPage(tab, page, `${viewport} ${related[0]}`);
          opened = true;
          break;
        }
        assert.ok(opened, `${viewport}: none of the first blog posts links to a topic page`);
      } finally {
        await tab.page.close();
      }
    });
  }
});

describe('journey: search, no results, browser back and URL parameters', () => {
  for (const viewport of viewports) {
    it(`search and clear on ${viewport}`, async () => {
      const tab = await openTab(viewport);
      try {
        await go(tab, '/worksheets?grade=7');
        await hydrated(tab);
        const status = () => tab.page.$eval('[data-catalog-status]', (el) => el.textContent?.trim() || '');
        const cardCount = () => tab.page.$$eval('article.card[data-topic-id]', (els) => els.length);
        const total = await cardCount();
        assert.match(await status(), new RegExp(`^${total} נושאים`), `${viewport}: initial status`);

        await tab.page.type('input[type=search]', 'זוויות');
        await tab.page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'זוויות');
        const hits = await cardCount();
        assert.ok(hits > 0 && hits < total, `${viewport}: ${hits} of ${total} topics for "זוויות"`);
        assert.equal(await status(), `${hits} נושאים תואמים לחיפוש`);
        await assertHebrewRtl(tab, `${viewport} search`);

        await tab.page.$eval('input[type=search]', (el) => {
          (el as HTMLInputElement).select();
        });
        await tab.page.type('input[type=search]', 'קקקקק');
        await tab.page.waitForSelector('#topic-list .empty');
        assert.equal(await status(), 'לא נמצאו נושאים תואמים');
        assert.equal(await tab.page.$eval('#topic-list .empty h2', (el) => el.textContent?.trim()), 'לא מצאנו נושא כזה');
        await assertHebrewRtl(tab, `${viewport} no results`);

        await tab.page.$eval('#topic-list .empty button', (el) => (el as HTMLButtonElement).click());
        await tab.page.waitForFunction(() => !new URL(location.href).searchParams.has('q'));
        assert.equal(await tab.page.$eval('input[type=search]', (el) => (el as HTMLInputElement).value), '');
        assert.equal(await cardCount(), total, `${viewport}: clearing restores every topic`);
      } finally {
        await tab.page.close();
      }
    });

    it(`browser back keeps the search on ${viewport}`, async () => {
      const tab = await openTab(viewport);
      try {
        await go(tab, '/worksheets?grade=7');
        await hydrated(tab);
        await tab.page.type('input[type=search]', 'זוויות');
        await tab.page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'זוויות');
        const filtered = await tab.page.$$eval('article.card[data-topic-id]', (els) => els.length);
        // Grade tabs are links (full navigation).
        await clickVisible(tab, '#grade-tab-8', `${viewport} grade tab 8`);
        assert.equal(new URL(tab.page.url()).searchParams.get('grade'), '8');
        await back(tab, `${viewport} catalog`);
        await hydrated(tab);
        const url = new URL(tab.page.url());
        assert.equal(url.searchParams.get('grade'), '7');
        assert.equal(url.searchParams.get('q'), 'זוויות');
        assert.equal(await tab.page.$eval('input[type=search]', (el) => (el as HTMLInputElement).value), 'זוויות');
        assert.equal(await tab.page.$$eval('article.card[data-topic-id]', (els) => els.length), filtered);
      } finally {
        await tab.page.close();
      }
    });

    it(`URL parameters on ${viewport}`, async () => {
      const tab = await openTab(viewport);
      try {
        for (const bad of ['/worksheets?grade=12', '/worksheets?grade=abc']) {
          const response = await go(tab, bad);
          assert.equal(response.status(), 404, `${bad}: invalid grade must not be a soft 404`);
          assert.equal(await tab.page.$eval('h1', (el) => el.textContent?.trim()), 'כיתה לא חוקית');
          await assertHebrewRtl(tab, bad);
        }

        const elementary = await go(tab, '/worksheets?level=ysodi');
        assert.ok(served(elementary.status()));
        assert.match(await tab.page.$eval('h1', (el) => el.textContent || ''), /כיתה א׳/);

        await go(tab, `/worksheets?grade=7&q=${encodeURIComponent('משוואות')}`);
        await hydrated(tab);
        assert.equal(await tab.page.$eval('input[type=search]', (el) => (el as HTMLInputElement).value), 'משוואות');
        assert.match(
          await tab.page.$eval('[data-catalog-status]', (el) => el.textContent?.trim() || ''),
          /^\d+ נושאים תואמים לחיפוש$/
        );

        await go(tab, '/worksheets?grade=9&topic=34');
        await hydrated(tab);
        assert.deepEqual(
          await tab.page.$$eval('article.card[data-topic-id]', (els) => els.map((el) => el.getAttribute('data-topic-id'))),
          ['34'],
          'a reduced-program topic opens on its own track'
        );
      } finally {
        await tab.page.close();
      }
    });
  }
});
