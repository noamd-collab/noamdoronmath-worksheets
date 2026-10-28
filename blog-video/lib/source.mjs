// Reads the blog posts that feed the site (headless/astro-poc/src/data/blog-posts/*.json)
// and turns each one into a stable, citable plain-text form. Read-only: never writes to the site data.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIDEO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = join(VIDEO_ROOT, '..');
export const POSTS_DIR = join(REPO_ROOT, 'headless/astro-poc/src/data/blog-posts');
export const SITE_ORIGIN = 'https://www.noamdoronmath.co.il';

export const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

const stripTicks = (s) => String(s ?? '').replace(/`/g, '').normalize('NFC');

/** Blocks in reading order, each with a stable id (b<index>) and its plain text. */
export function sourceBlocks(post) {
  const out = [];
  out.push({ id: 'title', type: 'title', text: stripTicks(post.h1 || post.title) });
  (post.blocks || []).forEach((b, i) => {
    const id = `b${i}`;
    if (b.type === 'ul' || b.type === 'ol') {
      out.push({ id, type: b.type, text: b.items.map((it, j) => `${j + 1}. ${stripTicks(it.text)}`).join('\n') });
    } else if (b.type === 'a') {
      out.push({ id, type: 'a', text: stripTicks(b.text), href: b.href });
    } else if (b.type === 'figure') {
      out.push({ id, type: 'figure', text: stripTicks(b.alt || ''), src: b.src });
    } else {
      out.push({ id, type: b.type, text: stripTicks(b.text) });
    }
  });
  (post.faq?.items || []).forEach((q, i) => {
    out.push({ id: `faq${i}`, type: 'faq', text: `${stripTicks(q.question ?? q.q)}\n${stripTicks(q.answer ?? q.a)}` });
  });
  return out.map((b) => ({ ...b, hash: sha256(b.text).slice(0, 12) }));
}

/** Hash of everything a script may draw on: title, body, FAQ. Meta/SEO fields are excluded on purpose. */
export function sourceHash(post) {
  return sha256(sourceBlocks(post).map((b) => `${b.id}\t${b.text}`).join('\n'));
}

export function canonicalUrl(post) {
  const slug = post.decodedSlug || decodeURIComponent(post.pathSlug || '');
  return `${SITE_ORIGIN}/post/${slug}`;
}

/** Grade only when the title or H1 states it ("כיתה ז׳", "כיתות ז׳–ט׳", "לכיתה ו׳"). */
export function explicitGrade(post) {
  const t = `${post.title} ${post.h1 || ''}`;
  const m = t.match(/כית(?:ה|ות)\s+([א-ט])[׳']?(?:\s*[–-]\s*([א-ט])[׳']?)?/);
  if (!m) return null;
  return m[2] ? `${m[1]}׳–${m[2]}׳` : `${m[1]}׳`;
}

/** Audience only when the title, H1 or description names it. Categories are kept verbatim separately. */
export function explicitAudience(post) {
  const t = `${post.title} ${post.h1 || ''} ${post.description || ''}`;
  const found = [];
  if (/הורים|להורה/.test(t)) found.push('parents');
  if (/מורים|למורה|מורות/.test(t)) found.push('teachers');
  if (/תלמידים|תלמיד|לילדים|ילדים/.test(t)) found.push('students');
  return found;
}

export function loadPosts() {
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const abs = join(POSTS_DIR, f);
      const post = JSON.parse(readFileSync(abs, 'utf8'));
      return { file: relative(REPO_ROOT, abs), post };
    });
}
