/**
 * M26 CORRECTION: capture blog archives from live SSR HTML (not virtualized gallery DOM).
 * Ensures every server-rendered post-list-item is included in source order.
 * Optionally enriches cover images via Puppeteer + RSS enclosures when present.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import {
  PROD,
  ARCHIVE_PATHS,
  parseSsrCards,
  parseArchiveMeta,
  fetchLiveArchiveCardIndex,
} from './lib/blog-archive-ssr.mjs';

export { fetchLiveArchiveCardIndex, parseSsrCards };

mkdirSync('src/data/blog-archives', { recursive: true });
mkdirSync('reports/m26-blog', { recursive: true });

async function enrichCoversFromRss(cards) {
  try {
    const rss = await (await fetch(`${PROD}/blog-feed.xml`)).text();
    const byTitle = new Map();
    const byHref = new Map();
    for (const m of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const title = (
        block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        block.match(/<title>([\s\S]*?)<\/title>/) ||
        []
      )[1]?.replace(/\s+/g, ' ').trim();
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim();
      const enc = (block.match(/url="(https:\/\/static\.wixstatic\.com[^"]+)"/) || [])[1];
      if (!title || !enc) continue;
      byTitle.set(title, enc);
      if (link) byHref.set(link, enc);
    }
    return cards.map((card) => {
      if (card.imageSrc) return card;
      const src = byHref.get(card.href) || byTitle.get(card.title);
      if (!src) return card;
      return { ...card, imageSrc: src, imageAlt: card.imageAlt || card.title };
    });
  } catch {
    return cards;
  }
}

async function enrichCoversWithBrowser(path, cards) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 4000 });
    await page.goto(PROD + path, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await page.evaluate(() => {
        [...document.querySelectorAll('button')]
          .find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))
          ?.click();
      });
    } catch {}
    const byTitle = new Map();
    for (let i = 0; i < 30; i++) {
      const batch = await page.evaluate(`(() => {
        const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
        const out = [];
        for (const a of document.querySelectorAll('a[href*="/post/"]')) {
          const title = clean(a.querySelector('h2')?.textContent || '');
          if (!title) continue;
          const wrap = a.closest('[data-hook="post-list-item"], [data-idx], article, div');
          const img = wrap?.querySelector?.(
            '[data-hook="gallery-item-image-img"], img:not([alt*="סופר"])'
          );
          if (!img) continue;
          const r = img.getBoundingClientRect();
          if (r.width < 40) continue;
          const src = img.getAttribute('src') || img.currentSrc || '';
          if (!src || !src.startsWith('http')) continue;
          out.push({
            title,
            src,
            alt: clean(img.getAttribute('alt') || '') || title,
          });
        }
        return out;
      })()`);
      for (const b of batch) {
        if (!byTitle.has(b.title)) byTitle.set(b.title, b);
      }
      await page.evaluate(() => window.scrollBy(0, 700));
      await new Promise((r) => setTimeout(r, 160));
    }
    return cards.map((card) => {
      const cover = byTitle.get(card.title);
      if (!cover?.src) return card;
      return {
        ...card,
        imageSrc: card.imageSrc || cover.src,
        imageAlt: card.imageAlt || cover.alt || card.title,
      };
    });
  } finally {
    await browser.close();
  }
}

async function captureAll() {
  const summary = [];
  const galleryBeyondSsr = [];
  for (const spec of ARCHIVE_PATHS) {
    const res = await fetch(PROD + spec.path, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; m26-ssr-capture)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${spec.path}`);
    const html = await res.text();
    const meta = parseArchiveMeta(html);
    let cards = parseSsrCards(html);
    console.log(spec.path, 'SSR cards', cards.length);
    if (cards.length < 1) throw new Error(`No SSR cards for ${spec.path}`);

    cards = await enrichCoversWithBrowser(spec.path, cards);
    cards = await enrichCoversFromRss(cards);

    galleryBeyondSsr.push({
      path: spec.path,
      ssrCount: cards.length,
      loadMore: meta.loadMore,
      pagination: meta.pagination,
      note: 'Hydrated pro-gallery virtualizes; does not add cards beyond SSR list. No load-more/pagination on live.',
    });

    const content = {
      path: spec.path,
      fileSlug: spec.fileSlug,
      kind: spec.kind,
      categorySlug: spec.categorySlug || null,
      title: meta.title,
      description: meta.description,
      ogTitle: meta.ogTitle,
      ogImage: meta.ogImage,
      h1: meta.h1,
      nav: meta.nav,
      cards,
      jsonLd: undefined,
      pagination: meta.pagination,
      loadMore: meta.loadMore,
      source: {
        liveUrl: PROD + spec.path,
        capturedAt: new Date().toISOString(),
        cardCount: cards.length,
        captureMethod: 'ssr-html',
      },
    };
    writeFileSync(
      `src/data/blog-archives/${spec.fileSlug}.json`,
      JSON.stringify(content, null, 2) + '\n'
    );
    writeFileSync(
      `reports/m26-blog/ssr-index-${spec.fileSlug}.json`,
      JSON.stringify(
        {
          path: spec.path,
          titles: cards.map((c) => c.title),
          hrefs: cards.map((c) => c.href),
          count: cards.length,
        },
        null,
        2
      ) + '\n'
    );
    summary.push({
      path: spec.path,
      cards: cards.length,
      withImg: cards.filter((c) => c.imageSrc).length,
      h1: content.h1,
    });
    console.log(
      ' ',
      'h1=',
      content.h1,
      'nav',
      content.nav.map((n) => n.text).join('|'),
      'img',
      content.cards.filter((c) => c.imageSrc).length
    );
  }

  writeFileSync(
    'reports/m26-blog/capture-summary.json',
    JSON.stringify(
      { generatedAt: new Date().toISOString(), summary, galleryBeyondSsr },
      null,
      2
    ) + '\n'
  );
  console.log(JSON.stringify(summary, null, 2));
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await captureAll();
}
