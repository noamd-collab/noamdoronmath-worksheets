#!/usr/bin/env node
/**
 * SEO crawl gate against a running server (local preview or a deployed host).
 *
 * Starts at /sitemap-index.xml, visits every page listed in the child sitemaps
 * and fails when a page:
 *   - does not answer 200,
 *   - has not exactly one <title> and one rel=canonical,
 *   - has no og:image,
 *   - contains "Noam Math Astro POC" anywhere in the raw HTML,
 *   - links to an internal URL that ends in 4xx/5xx (redirects are followed).
 *
 * Usage:
 *   node scripts/check-seo-crawl.mjs [baseUrl] [--limit N]
 *   npm run check:seo -- https://www.noamdoronmath.co.il
 * Default baseUrl: http://127.0.0.1:4321. Exit code 1 on any failure.
 */
const PROD_ORIGIN = 'https://www.noamdoronmath.co.il';
const POC = 'Noam Math Astro POC';
const CONCURRENCY = 6;

const args = process.argv.slice(2);
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
const positional = args.filter((a, i) => !a.startsWith('--') && (limitAt < 0 || i !== limitAt + 1));
const base = (positional[0] || 'http://127.0.0.1:4321').replace(/\/$/, '');

const toBase = (url) => url.replace(PROD_ORIGIN, base);
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function get(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'noam-seo-crawl-check' } });
  return { status: res.status, text: await res.text(), url: res.url };
}

async function pool(items, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await worker(queue.shift());
    })
  );
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

function internalLinks(html, pageUrl) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/gi)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    const origin = url.origin;
    if (origin !== base && origin !== PROD_ORIGIN && origin !== PROD_ORIGIN.replace('www.', '')) continue;
    if (url.pathname.startsWith('/_files/') || url.pathname.endsWith('.pdf')) continue;
    url.hash = '';
    out.add(toBase(url.href));
  }
  return out;
}

const index = await get(`${base}/sitemap-index.xml`);
if (index.status !== 200) {
  console.error(`sitemap-index.xml answered ${index.status} at ${base}`);
  process.exit(1);
}
const pages = [];
for (const child of locs(index.text)) {
  const res = await get(toBase(child));
  if (res.status !== 200) fail(child, `sitemap answered ${res.status}`);
  else pages.push(...locs(res.text).map(toBase));
}
const toVisit = [...new Set(pages)].slice(0, limit);

const links = new Map();
await pool(toVisit, async (url) => {
  const res = await get(url);
  if (res.status !== 200) return fail(url, `HTTP ${res.status}`);
  const html = res.text;
  const headHtml = html.slice(0, html.search(/<\/head>/i));
  const titles = (headHtml.match(/<title\b/gi) || []).length;
  const canonicals = (headHtml.match(/rel=["']canonical["']/gi) || []).length;
  if (titles !== 1) fail(url, `${titles} <title> tags`);
  if (canonicals !== 1) fail(url, `${canonicals} canonical links`);
  if (!/property=["']og:image["']/i.test(headHtml)) fail(url, 'missing og:image');
  if (html.includes(POC)) fail(url, `contains "${POC}"`);
  for (const link of internalLinks(html, url)) {
    if (!links.has(link)) links.set(link, url);
  }
});

const checked = new Map();
await pool([...links.keys()], async (link) => {
  try {
    const res = await fetch(link, { redirect: 'follow', headers: { 'user-agent': 'noam-seo-crawl-check' } });
    checked.set(link, res.status);
    if (res.status >= 400) fail(links.get(link), `broken link ${link} → ${res.status}`);
  } catch (err) {
    fail(links.get(link), `unreachable link ${link} (${err.message})`);
  }
});

console.log(`pages: ${toVisit.length}  internal links: ${checked.size}  failures: ${failures.length}`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
