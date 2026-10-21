/**
 * M26 CORRECTION: capture blog archives from live SSR HTML (not virtualized gallery DOM).
 * Ensures every server-rendered post-list-item is included in source order.
 * Optionally enriches cover images via Puppeteer + RSS enclosures when present.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import {
  PROD,
  ARCHIVE_PATHS,
  parseSsrCards,
  parseArchiveMeta,
  fetchLiveArchiveCardIndex,
  normHref,
} from './lib/blog-archive-ssr.mjs';

/** Classic free site. www is the headless host and does not SSR the Wix post list. */
const CLASSIC_ORIGIN = 'https://amiramnoam.wixsite.com/my-site';
const ORIGIN = (process.env.BLOG_CAPTURE_ORIGIN || PROD).replace(/\/$/, '');

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
    await page.goto(ORIGIN + path, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await page.evaluate(() => {
        [...document.querySelectorAll('button')]
          .find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))
          ?.click();
      });
    } catch {}
    const byTitle = new Map();
    for (let i = 0; i < 8; i++) {
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
          if (!src || !src.startsWith('http') || src.includes('blur_')) continue;
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

function rewriteClassicHosts(html) {
  return html.replaceAll(CLASSIC_ORIGIN, PROD);
}

/** Sharp gallery src, else a non-blur srcSet URL, else the preload placeholder. */
function coverFromChunk(chunk) {
  const sharp = chunk.match(
    /data-hook="gallery-item-image-img"[^>]*src="(https:\/\/static\.wixstatic\.com[^"]+)"/i
  );
  if (sharp && !sharp[1].includes('blur_')) return sharp[1];
  const srcSet = chunk.match(/srcSet="([^"]+)"/i);
  if (srcSet) {
    const urls = [...srcSet[1].matchAll(/https:\/\/static\.wixstatic\.com[^\s,]+/g)].map(
      (m) => m[0]
    );
    const crisp = urls.find((u) => !u.includes('blur_'));
    if (crisp) return crisp;
  }
  if (sharp) return sharp[1];
  const preload = chunk.match(
    /src="(https:\/\/static\.wixstatic\.com[^"]+)"[^>]*data-hook="gallery-item-image-img-preload"/i
  );
  return preload ? preload[1] : null;
}

/** Last sharp gallery image in a slice (the one closest to the following card hook). */
function lastCover(chunk) {
  let last = null;
  for (const m of chunk.matchAll(
    /data-hook="gallery-item-image-img"[^>]*src="(https:\/\/static\.wixstatic\.com[^"]+)"/gi
  )) {
    if (!m[1].includes('blur_')) last = m[1];
  }
  return last || coverFromChunk(chunk);
}

/** Cover URLs already in the SSR markup, keyed like parseSsrCards hrefs.
 * The gallery img is rendered just before data-hook="post-list-item", not after it.
 */
function coversFromSsr(html) {
  const map = new Map();
  const marks = [...html.matchAll(/data-hook="post-list-item"/gi)];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const prev = i === 0 ? 0 : marks[i - 1].index;
    const next = i + 1 < marks.length ? marks[i + 1].index : html.length;
    const hrefMatch = html.slice(start, Math.min(next, start + 14000)).match(
      /href="(https:\/\/www\.noamdoronmath\.co\.il\/post\/[^"]+|\/post\/[^"]+)"/
    );
    const src = hrefMatch ? lastCover(html.slice(prev, start)) : null;
    if (!hrefMatch || !src) continue;
    map.set(normHref(hrefMatch[1]), src);
  }
  return map;
}

async function fetchArchivePages(path) {
  const pages = [];
  const seen = new Set();
  for (let n = 1; n <= 12; n++) {
    const pagePath = n === 1 ? path : `${path}/page/${n}`;
    const res = await fetch(ORIGIN + pagePath, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; m26-ssr-capture)' },
      redirect: 'manual',
    });
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`HTTP ${res.status} ${pagePath}`);
    const html = rewriteClassicHosts(await res.text());
    const parsed = parseSsrCards(html);
    const fresh = parsed.filter((card) => !seen.has(card.href));
    if (!fresh.length) break;
    const covers = coversFromSsr(html);
    for (const card of fresh) {
      seen.add(card.href);
      if (!card.imageSrc && covers.has(card.href)) {
        card.imageSrc = covers.get(card.href);
        card.imageAlt = card.imageAlt || card.title;
      }
    }
    pages.push({ n, html, cards: fresh });
    console.log(pagePath, 'SSR cards', fresh.length);
  }
  if (!pages.length) throw new Error(`No SSR cards for ${path}`);
  return pages;
}

/** Keep a cover the previous capture already had when this SSR pass has none. */
function fillCoversFromPrevious(fileSlug, cards) {
  const file = `src/data/blog-archives/${fileSlug}.json`;
  if (!existsSync(file)) return cards;
  let previous;
  try {
    previous = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return cards;
  }
  const byHref = new Map();
  const byTitle = new Map();
  for (const card of previous.cards || []) {
    if (!card?.imageSrc) continue;
    if (card.href) byHref.set(card.href, card);
    if (card.title) byTitle.set(card.title, card);
  }
  return cards.map((card) => {
    if (card.imageSrc) return card;
    const prev = byHref.get(card.href) || byTitle.get(card.title);
    if (!prev?.imageSrc) return card;
    return {
      ...card,
      imageSrc: prev.imageSrc,
      imageAlt: card.imageAlt || prev.imageAlt || card.title,
    };
  });
}

async function captureAll() {
  const summary = [];
  const galleryBeyondSsr = [];
  for (const spec of ARCHIVE_PATHS) {
    const pages = await fetchArchivePages(spec.path);
    const html = pages[0].html;
    const meta = parseArchiveMeta(html);
    let cards = pages.flatMap((page) => page.cards);
    console.log(spec.path, 'SSR cards', cards.length, 'pages', pages.length);
    if (cards.length < 1) throw new Error(`No SSR cards for ${spec.path}`);

    for (const page of pages) {
      const pagePath = page.n === 1 ? spec.path : `${spec.path}/page/${page.n}`;
      const stillMissing = cards.some(
        (card) => !card.imageSrc && page.cards.some((fresh) => fresh.href === card.href)
      );
      if (!stillMissing) continue;
      cards = await enrichCoversWithBrowser(pagePath, cards);
    }
    cards = await enrichCoversFromRss(cards);
    cards = fillCoversFromPrevious(spec.fileSlug, cards);

    galleryBeyondSsr.push({
      path: spec.path,
      ssrCount: cards.length,
      loadMore: meta.loadMore,
      pagination: meta.pagination,
      note: 'SSR post-list-item order, including /page/N until 404. Card layout is unchanged.',
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
        liveUrl: ORIGIN + spec.path,
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
