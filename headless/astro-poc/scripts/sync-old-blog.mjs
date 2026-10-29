/**
 * Pull posts from Noam's old Wix blog into src/data/blog-posts.
 *
 * Source: public sitemap (every post) plus the public RSS feed (latest),
 * then each public post page. No secrets.
 *
 *   node scripts/sync-old-blog.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = join(root, 'src/data/blog-posts');
const OLD_ORIGIN = 'https://amiramnoam.wixsite.com/my-site';
const LIVE_ORIGIN = 'https://www.noamdoronmath.co.il';
const SITEMAP = `${OLD_ORIGIN}/blog-posts-sitemap.xml`;
const FEED = `${OLD_ORIGIN}/blog-feed.xml`;
const AVATAR = {
  src: 'https://lh3.googleusercontent.com/a/ACg8ocLcKKWJH1Tr8kRDComRJ0lj8ghJ6y82fikcMTCaO9htIE-bG0gl%3Ds96-c',
  alt: 'תמונת הסופר/ת: נועם דורון מתמטיקה',
};
const MONTHS = ['', 'בינו׳', 'בפבר׳', 'במרץ', 'באפר׳', 'במאי', 'ביוני', 'ביולי', 'באוג׳', 'בספט׳', 'באוק׳', 'בנוב׳', 'בדצמ׳'];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; noam-blog-sync)',
      accept: 'text/html,application/xml,text/xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function rewriteHref(href) {
  if (!href) return '';
  if (href.startsWith(OLD_ORIGIN)) return LIVE_ORIGIN + href.slice(OLD_ORIGIN.length);
  return href;
}

function servedPathSet() {
  const paths = new Set([
    '/',
    '/aboutus',
    '/math-tools',
    '/terms',
    '/accessibilityadaptation',
    '/conditionforfreeworksheets',
    '/high-school-math',
    '/worksheets',
    '/learning.html',
    '/worksheet-viewer-noam.html',
    '/games/eliyahu-pythagoras',
    '/games/eliyahu-pythagoras/play',
    '/blog',
    '/blog/categories/elementary-math',
    '/blog/categories/middle-school-math',
    '/blog/categories/teachers-and-parents',
  ]);
  for (let grade = 1; grade <= 9; grade += 1) paths.add(`/grade-${grade}`);
  for (const name of readdirSync(join(root, 'src/data/topic-pages'))) {
    if (name.endsWith('.json')) paths.add(`/${name.replace(/\.json$/, '')}`);
  }
  for (const post of readJsonPosts()) {
    try {
      paths.add(decodeURIComponent(post.path));
    } catch {
      paths.add(post.path);
    }
  }
  return paths;
}

function redirectSources() {
  const data = JSON.parse(readFileSync(join(root, 'src/data/redirects.json'), 'utf8'));
  return new Set((data.rules || []).map((rule) => rule.from));
}

/** Topic URLs the headless app does not serve become the worksheets catalog. */
function retargetHref(href, served, redirects) {
  const rewritten = rewriteHref(href);
  let url;
  try {
    url = new URL(rewritten, LIVE_ORIGIN);
  } catch {
    return rewritten;
  }
  if (url.hostname !== 'www.noamdoronmath.co.il' && url.hostname !== 'noamdoronmath.co.il') return rewritten;
  let path = url.pathname.replace(/\/$/, '') || '/';
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep */
  }
  if (served.has(path) || redirects.has(path) || path.startsWith('/worksheets')) return rewritten;
  const grade = path.match(/grade-(\d)/);
  return grade ? `/worksheets?grade=${grade[1]}` : '/worksheets';
}

function retargetPost(post, served, redirects) {
  let changed = false;
  const fix = (href) => {
    const next = retargetHref(href, served, redirects);
    if (next !== href) changed = true;
    return next;
  };
  for (const block of post.blocks || []) {
    if (block.type === 'a') block.href = fix(block.href);
    if (block.type === 'p' && block.segments) {
      for (const seg of block.segments) if (seg.type === 'a') seg.href = fix(seg.href);
    }
    if (block.type === 'ul' || block.type === 'ol') {
      for (const item of block.items || []) {
        if (item.href) item.href = fix(item.href);
        if (item.segments) {
          for (const seg of item.segments) if (seg.type === 'a') seg.href = fix(seg.href);
        }
      }
    }
  }
  return changed;
}

function rewriteDeep(value) {
  if (typeof value === 'string') return value.split(OLD_ORIGIN).join(LIVE_ORIGIN);
  if (Array.isArray(value)) return value.map(rewriteDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = rewriteDeep(child);
    return out;
  }
  return value;
}

function hebrewDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth() + 1]}`;
}

function cardImage(url) {
  if (!url) return '';
  return url.replace(/\/v1\/fill\/[^/]+\//, '/v1/fill/w_305,h_229,al_c,q_90,enc_avif,quality_auto/');
}

function readJsonPosts() {
  return readdirSync(postsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(postsDir, name), 'utf8')));
}

function wantedSlugs(sitemapXml, feedXml) {
  const slugs = new Map();
  const add = (loc) => {
    const url = decodeXml(loc.trim());
    let path = '';
    try {
      path = decodeURIComponent(new URL(url).pathname);
    } catch {
      return;
    }
    const marker = '/post/';
    const at = path.indexOf(marker);
    if (at < 0) return;
    const slug = path.slice(at + marker.length);
    if (!slug || slugs.has(slug)) return;
    slugs.set(slug, `${OLD_ORIGIN}/post/${encodeURIComponent(slug)}`);
  };
  for (const match of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)) add(match[1]);
  for (const match of feedXml.matchAll(/<link>([^<]+)<\/link>/g)) add(match[1]);
  return slugs;
}

function segmentsFrom(el) {
  const segs = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      if (node.textContent) segs.push({ type: 'text', text: node.textContent });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'a') {
      const text = clean(node.textContent);
      const href = rewriteHref(node.getAttribute('href') || '');
      if (text && href) segs.push({ type: 'a', text, href });
      return;
    }
    if (tag === 'strong' || tag === 'b') {
      const text = clean(node.textContent);
      if (text) segs.push({ type: 'strong', text });
      return;
    }
    if (tag === 'em' || tag === 'i') {
      const text = clean(node.textContent);
      if (text) segs.push({ type: 'em', text });
      return;
    }
    for (const child of node.childNodes) walk(child);
  };
  walk(el);
  const out = [];
  for (const seg of segs) {
    if (seg.type !== 'text') {
      out.push(seg);
      continue;
    }
    const text = seg.text.replace(/\s+/g, ' ');
    if (!text || text === ' ') {
      if (text === ' ' && out.length) out.push({ type: 'text', text: ' ' });
      continue;
    }
    out.push({ type: 'text', text });
  }
  return out;
}

function imageSrc(el) {
  const img = el.tagName === 'IMG' ? el : el.querySelector?.('img');
  const direct = img?.getAttribute('src') || '';
  if (direct && !direct.startsWith('data:')) return direct;
  const host = el.getAttribute?.('data-image-info')
    ? el
    : el.querySelector?.('[data-image-info]');
  const raw = host?.getAttribute('data-image-info') || '';
  if (!raw) return '';
  try {
    const info = JSON.parse(raw);
    return info?.imageData?.uri || info?.uri || '';
  } catch {
    return '';
  }
}

function blocksFrom(root) {
  const blocks = [];
  const nodes = root.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote, table, figure, wow-image, img');
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'ul' && tag !== 'ol' && el.closest('li')) continue;
    if ((tag === 'wow-image' || tag === 'img') && el.closest('p, li, figure, h2, h3, h4')) continue;
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const text = clean(el.textContent);
      if (text) blocks.push({ type: tag, text });
      continue;
    }
    if (tag === 'p') {
      const text = clean(el.textContent);
      if (!text) continue;
      const segments = segmentsFrom(el);
      const rich = segments.some((seg) => seg.type !== 'text');
      blocks.push(rich ? { type: 'p', text, segments } : { type: 'p', text });
      continue;
    }
    if (tag === 'blockquote') {
      const text = clean(el.textContent);
      if (text) blocks.push({ type: 'blockquote', text });
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = [...el.querySelectorAll(':scope > li')]
        .map((li) => {
          const text = clean(li.textContent);
          if (!text) return null;
          const segments = segmentsFrom(li);
          const rich = segments.some((seg) => seg.type !== 'text');
          const item = { text };
          const link = li.querySelector('a[href]');
          if (link) {
            item.href = rewriteHref(link.getAttribute('href') || '');
            item.linkText = clean(link.textContent);
          }
          if (rich) item.segments = segments;
          return item;
        })
        .filter(Boolean);
      if (items.length) blocks.push({ type: tag, items });
      continue;
    }
    if (tag === 'table') {
      const rows = [...el.querySelectorAll('tr')].map((tr) =>
        [...tr.querySelectorAll('th, td')].map((cell) => clean(cell.textContent))
      );
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    const src = imageSrc(el);
    if (!src || src.startsWith('data:')) continue;
    const alt = clean(el.getAttribute?.('alt') || el.querySelector?.('img')?.getAttribute('alt') || '');
    if (tag === 'figure') {
      const caption = clean(el.querySelector('figcaption')?.textContent || '');
      const figure = { type: 'figure', src, alt };
      if (caption) figure.caption = caption;
      blocks.push(figure);
    } else {
      blocks.push({ type: 'img', src, alt });
    }
  }
  const merged = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (prev && (block.type === 'ul' || block.type === 'ol') && prev.type === block.type) {
      prev.items.push(...block.items);
    } else {
      merged.push(block);
    }
  }
  return merged;
}

function meta(document, name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
}

function og(document, property) {
  return document.querySelector(`meta[property="${property}"]`)?.getAttribute('content') || '';
}

function blogPostingFrom(document) {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || '');
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const type = node?.['@type'];
        if (type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'))) return node;
      }
    } catch {
      /* next script */
    }
  }
  return null;
}

function fileSlugFor(iso, decodedSlug, taken) {
  const day = (iso || '').slice(0, 10) || 'undated';
  let slug = `soro-${day}`;
  let n = 2;
  while (taken.has(slug)) {
    slug = `soro-${day}-${n}`;
    n += 1;
  }
  taken.add(slug);
  return slug;
}

function capture(html, decodedSlug, sourceUrl) {
  const { document } = parseHTML(html);
  const posting = rewriteDeep(blogPostingFrom(document) || {});
  const h1 = clean(document.querySelector('h1')?.textContent || posting.headline || '');
  const description = clean(meta(document, 'description') || og(document, 'og:description') || posting.description || '');
  const root = document.querySelector('[data-hook="post-description"]');
  if (!root) throw new Error(`No post body for ${decodedSlug}`);
  const blocks = blocksFrom(root);
  if (!h1 || blocks.length < 3) {
    throw new Error(`Short capture for ${decodedSlug}: h1=${h1.length} blocks=${blocks.length}`);
  }
  const datePublished = posting.datePublished || document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || '';
  const dateModified = posting.dateModified || datePublished;
  const path = `/post/${encodeURIComponent(decodedSlug)}`;
  const liveUrl = `${LIVE_ORIGIN}/post/${decodedSlug}`;
  if (posting && posting['@type']) {
    posting.url = liveUrl;
    if (posting.mainEntityOfPage && typeof posting.mainEntityOfPage === 'object') {
      posting.mainEntityOfPage.url = liveUrl;
      posting.mainEntityOfPage['@id'] = liveUrl;
    }
    if (posting.publisher && typeof posting.publisher === 'object') {
      posting.publisher.url = LIVE_ORIGIN;
    }
  }
  let coverImage = '';
  if (typeof posting.image === 'string') coverImage = posting.image;
  else if (posting.image?.url) coverImage = posting.image.url;
  else if (Array.isArray(posting.image)) coverImage = posting.image[0]?.url || posting.image[0] || '';
  if (!coverImage) coverImage = og(document, 'og:image');
  const author = clean(document.querySelector('[data-hook="user-name"]')?.textContent || posting.author?.name || 'נועם דורון מתמטיקה');
  const readingTime = clean(document.querySelector('[data-hook="time-to-read"]')?.textContent || '');
  return {
    path,
    pathSlug: encodeURIComponent(decodedSlug),
    decodedSlug,
    h1,
    title: h1,
    description,
    ogTitle: clean(og(document, 'og:title') || h1),
    ogDescription: clean(og(document, 'og:description') || description),
    ogImage: coverImage || undefined,
    author,
    datePublished: datePublished || undefined,
    dateModified: dateModified || undefined,
    dateDisplay: hebrewDate(datePublished) || undefined,
    readingTime: readingTime || undefined,
    authorAvatar: AVATAR,
    coverImage: coverImage || undefined,
    coverAlt: clean(document.querySelector('[data-hook="post-hero-image"] img')?.getAttribute('alt') || h1),
    blocks,
    related: [],
    categories: [],
    jsonLd: posting && posting['@type'] ? [posting] : [],
    batch: 'old-site-sync',
    source: {
      liveUrl: sourceUrl,
      capturedAt: new Date().toISOString(),
      bodyChars: clean(root.textContent).length,
    },
  };
}

function writeSyncedIndex(posts) {
  const ordered = [...posts].sort((a, b) => (a.datePublished || '').localeCompare(b.datePublished || '') || a.fileSlug.localeCompare(b.fileSlug));
  const lines = ['/** Generated by scripts/sync-old-blog.mjs. Do not edit by hand. */'];
  ordered.forEach((post, index) => {
    lines.push(`import post${index} from './${post.fileSlug}.json';`);
  });
  lines.push('');
  lines.push(`export const SYNCED_BLOG_POSTS = [${ordered.map((_, index) => `post${index}`).join(', ')}];`);
  lines.push('');
  writeFileSync(join(postsDir, 'synced-index.ts'), lines.join('\n'));
}

function updateBlogIndex(syncedPosts) {
  const indexPath = join(root, 'src/data/blog-archives/blog-index.json');
  const archive = JSON.parse(readFileSync(indexPath, 'utf8'));
  const have = new Set(
    archive.cards.map((card) => {
      try {
        return decodeURIComponent(new URL(card.href).pathname);
      } catch {
        return card.href;
      }
    })
  );
  const fresh = [...syncedPosts].sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || ''));
  const cards = [];
  for (const post of fresh) {
    const path = decodeURIComponent(post.path);
    if (have.has(path)) continue;
    cards.push({
      title: post.h1,
      href: `${LIVE_ORIGIN}${post.path}`,
      excerpt: post.description,
      authorAvatar: AVATAR,
      author: post.author,
      date: post.dateDisplay || '',
      imageSrc: cardImage(post.coverImage || post.ogImage || ''),
      imageAlt: post.h1,
    });
  }
  if (!cards.length) return false;
  archive.cards = [...cards, ...archive.cards];
  archive.source.cardCount = archive.cards.length;
  archive.source.capturedAt = new Date().toISOString();
  archive.source.captureMethod = 'old-site-sync';
  writeFileSync(indexPath, JSON.stringify(archive, null, 2) + '\n');
  return true;
}

function updateBlogLastmod(day) {
  const path = join(root, 'src/lib/blogArchives.ts');
  const source = readFileSync(path, 'utf8');
  const next = source.replace(/(\/blog': ')(\d{4}-\d{2}-\d{2})(')/, (_match, open, old, close) => {
    return `${open}${old > day ? old : day}${close}`;
  });
  if (next !== source) writeFileSync(path, next);
}

function runBuilders() {
  for (const script of ['scripts/build-site-guide.ts', 'scripts/build-search-index.ts']) {
    const result = spawnSync('npx', ['tsx', script], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${script} failed`);
  }
}

const sitemapXml = await fetchText(SITEMAP);
const feedXml = await fetchText(FEED);
const wanted = wantedSlugs(sitemapXml, feedXml);
const existing = readJsonPosts();
const have = new Set(existing.map((post) => post.decodedSlug));
const missing = [...wanted.entries()].filter(([slug]) => !have.has(slug));
console.log(`old site ${wanted.size} posts, archive ${have.size}, missing ${missing.length}`);

const taken = new Set(readdirSync(postsDir).filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/, '')));
const imported = [];
for (const [slug, sourceUrl] of missing) {
  process.stdout.write(`fetch ${slug.slice(0, 48)}\n`);
  const html = await fetchText(sourceUrl);
  const post = capture(html, slug, `${OLD_ORIGIN}/post/${encodeURIComponent(slug)}`);
  post.fileSlug = fileSlugFor(post.datePublished, slug, taken);
  writeFileSync(join(postsDir, `${post.fileSlug}.json`), JSON.stringify(post, null, 2) + '\n');
  imported.push(post);
  console.log(`  ${post.fileSlug} blocks=${post.blocks.length} images=${post.blocks.filter((block) => block.type === 'img' || block.type === 'figure').length}`);
}

const synced = readJsonPosts().filter((post) => post.batch === 'old-site-sync');
const served = servedPathSet();
const redirects = redirectSources();
let linkEdits = 0;
for (const post of synced) {
  if (retargetPost(post, served, redirects)) {
    writeFileSync(join(postsDir, `${post.fileSlug}.json`), JSON.stringify(post, null, 2) + '\n');
    linkEdits += 1;
  }
}
writeSyncedIndex(synced);
const indexChanged = updateBlogIndex(synced);
const newest = [...existing, ...imported].map((post) => (post.datePublished || '').slice(0, 10)).sort().at(-1);
if (newest) updateBlogLastmod(newest);
if (imported.length || indexChanged || linkEdits) runBuilders();
console.log(`imported ${imported.length}, retargeted ${linkEdits}`);
