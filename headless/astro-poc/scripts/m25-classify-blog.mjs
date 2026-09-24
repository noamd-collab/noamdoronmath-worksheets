import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';

async function fetchText(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
function locs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((m) => m[1].trim());
}
function pathOf(url) {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}

const index = await fetchText(`${PROD}/sitemap.xml`);
const all = [];
for (const sm of locs(index)) {
  const xml = await fetchText(sm);
  all.push(...locs(xml));
}
const pages = [...new Set(all.map(pathOf))].sort();
const blogPaths = pages.filter(
  (p) => p === '/blog' || p.startsWith('/blog/') || p.startsWith('/post/')
);
console.log('blog paths', blogPaths.length);

mkdirSync('reports/m25-blog', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const rows = [];
for (const path of blogPaths) {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  let row = { path, kind: path === '/blog' ? 'blog-index' : path.startsWith('/blog/categories/') ? 'blog-category' : path.startsWith('/post/') ? 'blog-post' : 'blog-other' };
  try {
    const resp = await page.goto(`${PROD}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
    row.status = resp?.status() ?? null;
    row.finalUrl = page.url();
    const finalPath = pathOf(row.finalUrl);
    row.redirected = finalPath !== path;
    row.finalPath = finalPath;
    await new Promise((r) => setTimeout(r, 900));

    // dismiss disclaimer if present
    try {
      await page.evaluate(() => {
        [...document.querySelectorAll('button')].find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))?.click();
      });
      await new Promise((r) => setTimeout(r, 300));
    } catch {}

    const info = await page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute('content') || '';
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';
      const article =
        document.querySelector('article') ||
        document.querySelector('[data-hook="post"]') ||
        document.querySelector('[data-testid="post-content"]') ||
        document.querySelector('main');

      const h1 = clean(document.querySelector('h1')?.textContent);
      const h2 = [...document.querySelectorAll('h2')].map((h) => clean(h.textContent)).filter(Boolean);
      const h3 = [...document.querySelectorAll('h3')].map((h) => clean(h.textContent)).filter(Boolean);
      const paras = [...(article || document).querySelectorAll('p')].map((p) => clean(p.textContent)).filter((t) => t.length > 0);
      const imgs = [...(article || document).querySelectorAll('img')].map((img) => ({
        src: img.getAttribute('src') || img.getAttribute('data-src') || '',
        alt: img.getAttribute('alt') || '',
      })).filter((i) => i.src && !i.src.startsWith('data:image/svg'));
      const figures = [...(article || document).querySelectorAll('figure')].length;
      const figcaptions = [...(article || document).querySelectorAll('figcaption')].map((c) => clean(c.textContent)).filter(Boolean);
      const lists = [...(article || document).querySelectorAll('ul, ol')].length;
      const tables = [...(article || document).querySelectorAll('table')].length;
      const iframes = [...(article || document).querySelectorAll('iframe')].map((f) => f.getAttribute('src') || '');
      const videos = [...(article || document).querySelectorAll('video, [data-hook*="video"], wix-video')].length;
      const embeds = [...(article || document).querySelectorAll('[data-hook*="embed"], .wix-embeds, oembed')].length;
      const links = [...(article || document).querySelectorAll('a[href]')].map((a) => ({
        text: clean(a.textContent).slice(0, 80),
        href: a.getAttribute('href') || '',
      }));
      const related = [...document.querySelectorAll('[data-hook*="related"] a, .related-posts a, [aria-label*="קשור"] a')]
        .map((a) => ({ text: clean(a.textContent), href: a.getAttribute('href') || '' }));

      // author / date heuristics
      const timeEl = document.querySelector('time, [data-hook="time-ago"], [data-hook="publish-date"]');
      const dateText = clean(timeEl?.getAttribute('datetime') || timeEl?.textContent || '');
      const authorEl = document.querySelector('[data-hook="user-name"], [data-hook="author-name"], .blog-author, [itemprop="author"]');
      const authorText = clean(authorEl?.textContent || '');

      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
        .filter(Boolean);

      const bodyText = clean((article || document.body).innerText);
      const hasBlockquote = !!(article || document).querySelector('blockquote');
      const hasCode = !!(article || document).querySelector('pre, code');
      const hasHr = !!(article || document).querySelector('hr');

      // template fingerprint from hooks/classes
      const hooks = [...document.querySelectorAll('[data-hook]')]
        .map((el) => el.getAttribute('data-hook'))
        .filter(Boolean);
      const hookSet = [...new Set(hooks)].slice(0, 40);

      return {
        title: document.title || '',
        description: meta('description') || og('og:description'),
        ogImage: og('og:image'),
        h1,
        h2Count: h2.length,
        h3Count: h3.length,
        h2Sample: h2.slice(0, 6),
        paraCount: paras.length,
        paraChars: paras.reduce((n, p) => n + p.length, 0),
        imgCount: imgs.length,
        imgsWithAlt: imgs.filter((i) => i.alt).length,
        imgsWixMedia: imgs.filter((i) => /wixstatic|wixmp|static\.wix/.test(i.src)).length,
        figcaptions: figcaptions.slice(0, 4),
        figures,
        lists,
        tables,
        iframes: iframes.filter(Boolean).slice(0, 5),
        videos,
        embeds,
        linkCount: links.length,
        relatedCount: related.length,
        relatedSample: related.slice(0, 3),
        dateText,
        authorText,
        jsonLdTypes: jsonLd.flatMap((j) => {
          if (Array.isArray(j)) return j.map((x) => x['@type']).filter(Boolean);
          if (j['@graph']) return j['@graph'].map((x) => x['@type']).filter(Boolean);
          return [j['@type']].filter(Boolean);
        }),
        hasBlockquote,
        hasCode,
        hasHr,
        bodyChars: bodyText.length,
        bodySample: bodyText.slice(0, 200),
        hookSet,
        // category/index cards
        postCardCount: document.querySelectorAll('[data-hook="post-list-item"], [data-hook="PostListItem"], article a[href*="/post/"]').length,
      };
    });
    Object.assign(row, info);

    // Feature tags for clustering
    const features = [];
    if (row.kind === 'blog-post') {
      if (info.h2Count > 0) features.push('h2');
      if (info.h3Count > 0) features.push('h3');
      if (info.imgCount > 0) features.push('images');
      if (info.imgsWithAlt > 0) features.push('alt');
      if (info.figcaptions.length) features.push('captions');
      if (info.lists > 0) features.push('lists');
      if (info.tables > 0) features.push('tables');
      if (info.iframes.length) features.push('iframe-embed');
      if (info.videos) features.push('video');
      if (info.embeds) features.push('embed');
      if (info.relatedCount) features.push('related');
      if (info.dateText) features.push('date');
      if (info.authorText) features.push('author');
      if (info.jsonLdTypes.some((t) => /BlogPosting|Article|WebPage/.test(String(t)))) features.push('schema');
      if (info.hasBlockquote) features.push('blockquote');
      if (info.linkCount > 5) features.push('many-links');
      if (info.paraChars > 3000) features.push('long-body');
      else if (info.paraChars < 800) features.push('short-body');
      else features.push('medium-body');
    }
    row.features = features;
    row.featureKey = features.sort().join('+') || row.kind;

    console.log(
      row.kind,
      path.slice(0, 70),
      row.redirected ? `→${row.finalPath}` : '',
      'h2', info.h2Count,
      'img', info.imgCount,
      'list', info.lists,
      'tbl', info.tables,
      'ifr', info.iframes.length,
      features.join(',')
    );
  } catch (e) {
    row.error = e instanceof Error ? e.message : String(e);
    console.log('ERR', path, row.error);
  }
  rows.push(row);
  await page.close();
}
await browser.close();

writeFileSync('reports/m25-blog/classify-raw.json', JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 2) + '\n');

// Summarize
const byKind = {};
const byFeature = {};
const redirects = [];
const errors = [];
for (const r of rows) {
  byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  if (r.redirected) redirects.push(r);
  if (r.error) errors.push(r);
  if (r.kind === 'blog-post') {
    byFeature[r.featureKey] = byFeature[r.featureKey] || [];
    byFeature[r.featureKey].push(r.path);
  }
}
console.log('\nbyKind', byKind);
console.log('redirects', redirects.length, redirects.map((r) => r.path + '→' + r.finalPath));
console.log('errors', errors.length);
console.log('\nfeature clusters:', Object.keys(byFeature).length);
for (const [k, list] of Object.entries(byFeature).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  [${list.length}] ${k}`);
  console.log('   ', list[0]);
}
