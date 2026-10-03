#!/usr/bin/env node
/**
 * Read-only redirect map for the cut-over.
 * Fetches the live sitemap (GET only) and compares it to Astro routes + redirects.json.
 * Does not write to the live site.
 *
 * Usage: node scripts/build-redirects-map.mjs
 * Writes redirects-map.csv next to this package.
 */
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.noamdoronmath.co.il';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { accept: 'application/xml,text/plain', 'user-agent': 'seo-redirect-map' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function locsFromXml(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function toPath(urlOrPath) {
  if (!urlOrPath) return '';
  try {
    const u = new URL(urlOrPath, ORIGIN);
    let path = decodeURI(u.pathname);
    if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');
    return path || '/';
  } catch {
    return '';
  }
}

function abs(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

const astroPages = new Set(['/']);
for (const name of readdirSync(join(root, 'src/pages'))) {
  if (!name.endsWith('.astro') || name.includes('[')) continue;
  const slug = name.replace(/\.astro$/, '');
  if (slug === 'index' || slug.startsWith('_')) continue;
  astroPages.add(`/${slug}`);
}

const blogPaths = new Set(['/blog']);
for (const name of readdirSync(join(root, 'src/data/blog-posts'))) {
  if (!name.endsWith('.json')) continue;
  const data = JSON.parse(readFileSync(join(root, 'src/data/blog-posts', name), 'utf8'));
  if (data.path) blogPaths.add(data.path);
}
for (const name of readdirSync(join(root, 'src/data/blog-archives'))) {
  if (!name.endsWith('.json')) continue;
  const data = JSON.parse(readFileSync(join(root, 'src/data/blog-archives', name), 'utf8'));
  if (data.path) blogPaths.add(data.path);
}

const map = JSON.parse(readFileSync(join(root, 'src/data/redirects.json'), 'utf8'));
const rules = map.rules;
const flagged = new Set((map.flaggedDoNotAutoRedirect || []).map((row) => row.from));

const pagesXml = await fetchText(`${ORIGIN}/pages-sitemap.xml`);
const blogXml = await fetchText(`${ORIGIN}/sitemap-blog.xml`);
const livePaths = new Set([...locsFromXml(pagesXml), ...locsFromXml(blogXml)].map(toPath).filter(Boolean));

const served = new Set([...astroPages, ...blogPaths]);
const rows = [];

for (const rule of rules) {
  rows.push({
    oldUrl: abs(rule.from),
    newUrl: abs(rule.to),
    status: '301',
    confidence: 'גבוה',
  });
}

for (const from of flagged) {
  rows.push({
    oldUrl: abs(from),
    newUrl: '',
    status: '404-מכוון',
    confidence: 'גבוה',
  });
}

const redirectedFrom = new Set(rules.map((rule) => rule.from));
for (const path of [...livePaths].sort((a, b) => a.localeCompare(b))) {
  if (redirectedFrom.has(path) || flagged.has(path)) continue;
  if (served.has(path) || path.startsWith('/post/')) {
    rows.push({ oldUrl: abs(path), newUrl: abs(path), status: '200', confidence: 'גבוה' });
    continue;
  }
  rows.push({
    oldUrl: abs(path),
    newUrl: '',
    status: 'דוח-בלבד',
    confidence: 'לא ודאי',
  });
}

const header = ['כתובת ישנה', 'כתובת חדשה', 'סטטוס', 'ביטחון בהתאמה'];
const lines = [
  header.join(','),
  ...rows.map((row) => [row.oldUrl, row.newUrl, row.status, row.confidence].map(csvCell).join(',')),
];
const out = join(root, 'redirects-map.csv');
writeFileSync(out, `${lines.join('\n')}\n`);

const counts = rows.reduce((acc, row) => {
  const key = `${row.status}/${row.confidence}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
console.log(`wrote ${rows.length} rows to ${out}`);
console.log(counts);
