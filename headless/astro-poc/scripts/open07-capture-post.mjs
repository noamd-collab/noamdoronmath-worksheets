/**
 * OPEN-07-FIX: capture ONE live blog post with the M29 extractor + chrome extractor
 * (same output shape as src/data/blog-posts/*.json). Local Chrome, read-only on production.
 *
 *   npm i --no-save puppeteer-core
 *   node scripts/open07-capture-post.mjs --path /post/<encoded-slug> --file-slug <ascii-name>
 *   CHROME_PATH=... overrides the browser binary.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';
import { BLOG_CHROME_EXTRACTOR } from './lib/blog-chrome-extractor.js';

const PROD = 'https://www.noamdoronmath.co.il';
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const picks = [{
  path: arg('--path'),
  fileSlug: arg('--file-slug'),
  featureKey: arg('--feature-key') || 'open07-missing-post',
  clusterSize: 1,
  categoryHint: undefined,
}];
if (!picks[0].path || !picks[0].fileSlug || !/^\/post\/[^/?#]+$/.test(picks[0].path) || !/^[a-z0-9-]+$/.test(picks[0].fileSlug)) {
  throw new Error('usage: --path /post/<encoded-slug> --file-slug <ascii-name>');
}
mkdirSync('src/data/blog-posts', { recursive: true });
mkdirSync('reports/open07-blog/captures', { recursive: true });

function slugFromPath(path, fileSlug) {
  const raw = path.replace(/^\/post\//, '');
  const decoded = decodeURIComponent(raw);
  if (!fileSlug) throw new Error(`Missing fileSlug for ${path}`);
  return { pathSlug: raw, decodedSlug: decoded, fileSlug, routeSlug: raw };
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const EXTRACTOR = `(() => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const meta = (n) => document.querySelector('meta[name="'+n+'"]')?.getAttribute('content') || '';
  const og = (p) => document.querySelector('meta[property="'+p+'"]')?.getAttribute('content') || '';

  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
    .filter(Boolean);

  const flattenLd = (nodes) => {
    const out = [];
    for (const n of nodes) {
      if (!n) continue;
      if (Array.isArray(n)) { out.push(...flattenLd(n)); continue; }
      out.push(n);
      if (n['@graph']) out.push(...flattenLd(n['@graph']));
    }
    return out;
  };
  const ldAll = flattenLd(jsonLd);
  const blogPosting = ldAll.find((j) => j['@type'] === 'BlogPosting' || (Array.isArray(j['@type']) && j['@type'].includes('BlogPosting')));
  const howTo = ldAll.find((j) => j['@type'] === 'HowTo' || (Array.isArray(j['@type']) && j['@type'].includes('HowTo')));

  const h1 = clean(document.querySelector('h1')?.textContent || blogPosting?.headline || '');
  const author =
    clean(document.querySelector('[data-hook="user-name"], [data-hook="author-name"], [itemprop="author"]')?.textContent) ||
    clean(blogPosting?.author?.name || (typeof blogPosting?.author === 'string' ? blogPosting.author : '')) ||
    '';
  const datePublished = blogPosting?.datePublished || document.querySelector('time')?.getAttribute('datetime') || '';
  const dateModified = blogPosting?.dateModified || '';
  const dateDisplay = clean(
    document.querySelector('[data-hook="time-ago"], time')?.textContent || ''
  );

  let coverImage = '';
  if (typeof blogPosting?.image === 'string') coverImage = blogPosting.image;
  else if (Array.isArray(blogPosting?.image)) coverImage = blogPosting.image[0] || '';
  else if (blogPosting?.image?.url) coverImage = blogPosting.image.url;
  if (!coverImage) coverImage = og('og:image') || '';
  // Reject tiny avatars
  if (/googleusercontent|s96-c|profile/i.test(coverImage) && og('og:image')) coverImage = og('og:image');

  const root =
    document.querySelector('[data-hook="post-description"]') ||
    document.querySelector('[data-hook="post-content"]') ||
    document.querySelector('article [data-hook="post"]') ||
    document.querySelector('article') ||
    document.querySelector('main');

  const blocks = [];
  const push = (b) => blocks.push(b);

  function segmentsFrom(el) {
    const segs = [];
    const walk = (node) => {
      if (node.nodeType === 3) {
        const t = node.textContent || '';
        if (t) segs.push({ type: 'text', text: t });
        return;
      }
      if (!(node instanceof Element)) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') { segs.push({ type: 'text', text: '\\n' }); return; }
      if (tag === 'a') {
        segs.push({ type: 'a', text: clean(node.textContent), href: node.getAttribute('href') || '' });
        return;
      }
      if (tag === 'strong' || tag === 'b') {
        const inner = clean(node.textContent);
        if (inner) segs.push({ type: 'strong', text: inner });
        return;
      }
      if (tag === 'em' || tag === 'i') {
        const inner = clean(node.textContent);
        if (inner) segs.push({ type: 'em', text: inner });
        return;
      }
      for (const c of node.childNodes) walk(c);
    };
    walk(el);
    return segs
      .map((s) => (s.type === 'text' ? { ...s, text: s.text.replace(/[ \\t]+/g, ' ') } : s))
      .filter((s) => s.type !== 'text' || (s.text && s.text.length));
  }

  function walk(node) {
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'svg', 'noscript', 'button'].includes(tag)) return;
    if (tag === 'h1') return; // page title handled separately
    if (['h2', 'h3', 'h4'].includes(tag)) {
      const text = clean(node.textContent);
      if (text) push({ type: tag, text });
      return;
    }
    if (tag === 'p') {
      const text = clean(node.textContent);
      if (!text) return;
      const segments = segmentsFrom(node);
      const hasRich = segments.some((s) => s.type !== 'text');
      push(hasRich ? { type: 'p', text, segments } : { type: 'p', text });
      return;
    }
    if (tag === 'blockquote') {
      const text = clean(node.textContent);
      if (text) push({ type: 'blockquote', text });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = [...node.querySelectorAll(':scope > li')].map((li) => {
        const text = clean(li.textContent);
        const a = li.querySelector('a[href]');
        const segments = segmentsFrom(li);
        const hasRich = segments.some((s) => s.type !== 'text');
        const item = { text };
        if (a) { item.href = a.getAttribute('href') || ''; item.linkText = clean(a.textContent); }
        if (hasRich) item.segments = segments;
        return item;
      }).filter((i) => i.text);
      if (items.length) push({ type: tag, items });
      return;
    }
    if (tag === 'figure') {
      const img = node.querySelector('img');
      const src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
      const alt = img?.getAttribute('alt') || '';
      const caption = clean(node.querySelector('figcaption')?.textContent || '');
      if (src && !src.startsWith('data:image/svg')) push({ type: 'figure', src, alt, caption: caption || undefined });
      return;
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
      const alt = node.getAttribute('alt') || '';
      if (src && !src.startsWith('data:image/svg')) push({ type: 'img', src, alt });
      return;
    }
    if (tag === 'table') {
      const rows = [...node.querySelectorAll('tr')].map((tr) =>
        [...tr.querySelectorAll('th,td')].map((c) => clean(c.textContent))
      );
      if (rows.length) push({ type: 'table', rows });
      return;
    }
    if (tag === 'iframe') {
      push({ type: 'iframe', src: node.getAttribute('src') || '', title: node.getAttribute('title') || '', skippedReason: 'unsupported-embed-pending-review' });
      return;
    }
    if (tag === 'a' && !node.closest('p, li, h1, h2, h3, h4, figure, figcaption')) {
      const text = clean(node.textContent);
      const href = node.getAttribute('href') || '';
      if (text && href && text.length > 1) push({ type: 'a', text, href });
      return;
    }
    if (node.getAttribute('data-testid') === 'richTextElement') {
      const has = !!node.querySelector(':scope > p, :scope > h2, :scope > h3, :scope > h4, :scope > ul, :scope > ol');
      if (!has) {
        const text = clean(node.textContent);
        if (text && text.length > 2) push({ type: 'p', text });
        return;
      }
    }
    for (const c of node.children) walk(c);
  }
  walk(root);

  // Related posts / links (outside description but in article chrome)
  const related = [];
  const relatedRoots = [
    ...document.querySelectorAll('[data-hook*="related"], [class*="related-posts"], [aria-label*="קשור"]'),
  ];
  // Also grade-7 style related nav under post
  for (const a of document.querySelectorAll('article a[href], main a[href]')) {
    // skip body links already in blocks
  }
  // Heuristic used earlier: links labeled related near end — capture data-hook related if any
  for (const a of document.querySelectorAll('[data-hook*="related"] a, .related-posts a')) {
    const text = clean(a.textContent);
    const href = a.getAttribute('href') || '';
    if (text && href) related.push({ text, href });
  }
  // Fallback: after last body block, some posts show "כל דפי כיתה ז׳" style chips — look for section with those
  if (!related.length) {
    const candidates = [...document.querySelectorAll('a[href^="/grade-"], a[href*="-grade-"]')]
      .filter((a) => !root.contains(a))
      .slice(0, 8)
      .map((a) => ({ text: clean(a.textContent), href: a.getAttribute('href') || '' }))
      .filter((x) => x.text && x.href);
    // Only accept if appears to be a related strip (short labels)
    if (candidates.length >= 2 && candidates.every((c) => c.text.length < 40)) {
      related.push(...candidates);
    }
  }

  // Categories
  const categories = [...document.querySelectorAll('[data-hook="category-label"] a, a[href*="/blog/categories/"]')]
    .map((a) => ({ text: clean(a.textContent), href: a.getAttribute('href') || '' }))
    .filter((c) => c.text && c.href);

  const bodyText = clean(root?.innerText || '');

  return {
    title: document.title || '',
    description: meta('description') || og('og:description') || '',
    ogTitle: og('og:title') || '',
    ogDescription: og('og:description') || '',
    ogImage: og('og:image') || '',
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    h1,
    author,
    datePublished,
    dateModified,
    dateDisplay,
    coverImage,
    coverAlt: blogPosting?.image?.caption || '',
    blocks,
    related,
    categories,
    jsonLd,
    hasHowTo: !!howTo,
    bodyChars: bodyText.length,
    bodySample: bodyText.slice(0, 240),
  };
})()`;

const results = [];
for (const pick of picks) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const path = pick.path;
  console.log('capturing', decodeURIComponent(path).slice(0, 70));
  await page.goto(PROD + path, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
  } catch {}

  // Scroll so below-fold chrome (FAQ / WhatsApp / recent) is present in DOM.
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await new Promise((r) => setTimeout(r, 600));

  const snap = await page.evaluate(EXTRACTOR);
  const chrome = await page.evaluate(BLOG_CHROME_EXTRACTOR);
  const ids = slugFromPath(path, pick.fileSlug);

  if (!snap.h1 || snap.h1.length < 3) {
    throw new Error(`Unreliable capture (empty h1) for ${path}`);
  }
  if (!snap.blocks || snap.blocks.length < 3) {
    throw new Error(
      `Unreliable capture (only ${snap.blocks?.length || 0} blocks) for ${path} — stop, do not simplify`
    );
  }

  // Skip unsupported iframe embeds with reason
  const skippedEmbeds = snap.blocks.filter((b) => b.type === 'iframe');
  const blocks = snap.blocks.filter((b) => b.type !== 'iframe');

  const related =
    chrome.authorEditor?.relatedLinks?.length > 0
      ? chrome.authorEditor.relatedLinks
      : snap.related;

  const content = {
    path,
    pathSlug: ids.pathSlug,
    decodedSlug: ids.decodedSlug,
    fileSlug: ids.fileSlug,
    title: snap.title,
    description: snap.description,
    ogTitle: snap.ogTitle || undefined,
    ogDescription: snap.ogDescription || undefined,
    ogImage: snap.ogImage || undefined,
    h1: snap.h1,
    author: snap.author,
    datePublished: snap.datePublished || undefined,
    dateModified: snap.dateModified || undefined,
    dateDisplay: snap.dateDisplay || undefined,
    readingTime: chrome.readingTime || undefined,
    authorAvatar: chrome.authorAvatar || undefined,
    coverImage: snap.coverImage || undefined,
    coverAlt: snap.coverAlt || undefined,
    blocks,
    related,
    categories: snap.categories,
    authorEditor: chrome.authorEditor || undefined,
    faq: chrome.faq || undefined,
    whatsapp: chrome.whatsapp || undefined,
    postCategory: chrome.category || undefined,
    recentPosts: chrome.recentPosts || undefined,
    jsonLd: snap.jsonLd,
    featureKey: pick.featureKey,
    clusterSize: pick.clusterSize,
    categoryHint: pick.categoryHint,
    batch: 'open07',
    skippedEmbeds: skippedEmbeds.length
      ? skippedEmbeds.map((e) => ({ src: e.src, reason: e.skippedReason }))
      : undefined,
    source: {
      liveUrl: PROD + path,
      capturedAt: new Date().toISOString(),
      bodyChars: snap.bodyChars,
    },
  };

  writeFileSync(
    `reports/open07-blog/captures/${ids.fileSlug}.json`,
    JSON.stringify({ ...snap, path, featureKey: pick.featureKey, chrome }, null, 2) + '\n'
  );
  writeFileSync(`src/data/blog-posts/${ids.fileSlug}.json`, JSON.stringify(content, null, 2) + '\n');

  console.log(
    ' ',
    'h1:', content.h1.slice(0, 50),
    'blocks', blocks.length,
    'related', content.related.length,
    'read', !!content.readingTime,
    'authorEd', !!content.authorEditor,
    'faq', content.faq?.items?.length || 0,
    'wa', !!content.whatsapp,
    'cat', content.postCategory?.text || '-',
    'recent', content.recentPosts?.items?.length || 0,
    'cover', !!(content.coverImage && /wixstatic|wixmp/.test(content.coverImage)),
    'date', content.datePublished || content.dateDisplay,
    'skippedIframes', skippedEmbeds.length
  );
  results.push({
    path,
    fileSlug: ids.fileSlug,
    decodedSlug: ids.decodedSlug,
    featureKey: pick.featureKey,
    clusterSize: pick.clusterSize,
    blocks: blocks.length,
    related: content.related.length,
    h1: content.h1,
    title: content.title,
    skippedEmbeds: skippedEmbeds.length,
  });
  await page.close();
}
await browser.close();
console.log('\nWrote', results.length, 'post JSON file(s)');
