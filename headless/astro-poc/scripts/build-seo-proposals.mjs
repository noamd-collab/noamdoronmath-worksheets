#!/usr/bin/env node
/**
 * Hebrew title/description proposals for review.
 * approved is always false. Nothing here is applied until a person sets approved: true.
 * Rules: scripts/lib/seo-copy.mjs. Reviewed point fixes: scripts/lib/seo-overrides.mjs.
 * Fails (exit 1) instead of clipping when a title or description cannot be built cleanly.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProposals, len, TITLE_MAX, DESC_MAX } from './lib/seo-copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { proposals, errors } = buildProposals(root);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

const header = ['נתיב', 'סוג', 'כותרת נוכחית', 'כותרת מוצעת', 'תיאור נוכחי', 'תיאור מוצע', 'מאושר', 'מקור', 'החלטה נדרשת'];
const csv = [
  header.join(','),
  ...proposals.map((row) =>
    [row.path, row.kind, row.currentTitle, row.title, row.currentDescription, row.description, row.approved ? 'true' : 'false', row.source, row.needsDecision || '']
      .map(csvCell)
      .join(',')
  ),
].join('\n');

writeFileSync(
  join(root, 'src/data/seo-proposals.json'),
  `${JSON.stringify({ generatedAt: '2026-10-02', note: 'הצעות בלבד. approved=false עד אישור נועם.', items: proposals }, null, 2)}\n`
);
writeFileSync(join(root, 'seo-review.csv'), `${csv}\n`);

const posts = proposals.filter((row) => row.kind === 'blog-post');
const topics = proposals.filter((row) => row.kind !== 'blog-post');
console.log({
  topics: topics.length,
  posts: posts.length,
  pages: topics.filter((r) => r.kind === 'topic-page').length,
  tooLong: proposals.filter((r) => len(r.title) > TITLE_MAX || len(r.description) > DESC_MAX).length,
  approved: proposals.filter((r) => r.approved).length,
  needsDecision: proposals.filter((r) => r.needsDecision).length,
});
