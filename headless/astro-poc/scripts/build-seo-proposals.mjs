#!/usr/bin/env node
/**
 * Hebrew title/description proposals for review.
 * approved is always false. Nothing here is applied until a person sets approved: true.
 * Copy comes from the page h1/intro/description or, when there is no page, from the catalog title.
 */
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clip(value, max) {
  const text = clean(value);
  if ([...text].length <= max) return text;
  const cut = [...text].slice(0, max).join('').replace(/[|,.;:\-–—\s]+$/u, '').trim();
  return cut || [...text].slice(0, max).join('');
}

function withBrand(headline) {
  const brand = `${clean(headline)} | נועם דורון`;
  return [...brand].length <= 60 ? brand : clip(headline, 60);
}

const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog.v1.json'), 'utf8'));
const pages = new Map();
for (const name of readdirSync(join(root, 'src/data/topic-pages'))) {
  if (!name.endsWith('.json')) continue;
  const page = JSON.parse(readFileSync(join(root, 'src/data/topic-pages', name), 'utf8'));
  const id = page.catalogCta?.catalogTopicId;
  if (id != null) pages.set(`${page.grade}:${id}`, page);
}

const proposals = [];
const seenPaths = new Set();

for (const grade of catalog.grades) {
  for (const topic of grade.topics) {
    const page = pages.get(`${grade.grade}:${topic.id}`);
    const path = page?.path || `/worksheets?grade=${grade.grade}&topic=${topic.id}`;
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);
    const headline = page?.h1 || `${topic.title} ל${grade.label}`;
    const body = page?.intro || page?.description || `דפי עבודה במתמטיקה בנושא ${topic.title} ל${grade.label}. בחינם וללא הרשמה.`;
    proposals.push({
      path,
      kind: page ? 'topic-page' : 'catalog-topic',
      grade: grade.grade,
      catalogTopicId: topic.id,
      currentTitle: page?.title || '',
      currentDescription: page?.description || '',
      title: withBrand(headline),
      description: clip(body, 155),
      approved: false,
      source: page ? 'page-h1-intro' : 'catalog-title',
    });
  }
}

for (const name of readdirSync(join(root, 'src/data/topic-pages'))) {
  if (!name.endsWith('.json')) continue;
  const page = JSON.parse(readFileSync(join(root, 'src/data/topic-pages', name), 'utf8'));
  if (seenPaths.has(page.path)) continue;
  seenPaths.add(page.path);
  proposals.push({
    path: page.path,
    kind: 'topic-page',
    grade: page.grade,
    catalogTopicId: page.catalogCta?.catalogTopicId ?? null,
    currentTitle: page.title || '',
    currentDescription: page.description || '',
    title: withBrand(page.h1),
    description: clip(page.intro || page.description, 155),
    approved: false,
    source: 'page-h1-intro',
  });
}

for (const name of readdirSync(join(root, 'src/data/blog-posts'))) {
  if (!name.endsWith('.json')) continue;
  const post = JSON.parse(readFileSync(join(root, 'src/data/blog-posts', name), 'utf8'));
  proposals.push({
    path: post.path,
    kind: 'blog-post',
    grade: null,
    catalogTopicId: null,
    currentTitle: post.title || '',
    currentDescription: post.description || '',
    title: withBrand(post.h1 || post.title),
    description: clip(post.description || post.h1, 155),
    approved: false,
    source: 'post-copy',
  });
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

const header = ['נתיב', 'סוג', 'כותרת נוכחית', 'כותרת מוצעת', 'תיאור נוכחי', 'תיאור מוצע', 'מאושר', 'מקור'];
const csv = [
  header.join(','),
  ...proposals.map((row) =>
    [row.path, row.kind, row.currentTitle, row.title, row.currentDescription, row.description, row.approved ? 'true' : 'false', row.source]
      .map(csvCell)
      .join(',')
  ),
].join('\n');

writeFileSync(join(root, 'src/data/seo-proposals.json'), `${JSON.stringify({ generatedAt: '2026-10-02', note: 'הצעות בלבד. approved=false עד אישור נועם.', items: proposals }, null, 2)}\n`);
writeFileSync(join(root, 'seo-review.csv'), `${csv}\n`);

const tooLong = proposals.filter((row) => [...row.title].length > 60 || [...row.description].length > 155);
const topics = proposals.filter((row) => row.kind !== 'blog-post');
const posts = proposals.filter((row) => row.kind === 'blog-post');
console.log({ topics: topics.length, posts: posts.length, pages: topics.filter((r) => r.kind === 'topic-page').length, tooLong: tooLong.length, approved: proposals.filter((r) => r.approved).length });
