import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { assertCorrectedRawPage, beforeLandingCorrections, reviewedLandingCorrections as reviewed } from './fixtures/landing-corrections-20261118.ts';

const root = new URL('../src/data/topic-pages/', import.meta.url);
const readPage = (slug: string) => JSON.parse(readFileSync(new URL(`${slug}.json`, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const plain = (text: string) => text.replace(/[⁦-⁩]/g, '');
const allText = (value: unknown) => JSON.stringify(value);
const editions = JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.v1.json', import.meta.url), 'utf8')).editions as Array<{ editionId: string; label: string; grade: number; topicId: number }>;
const pdfTopics = new Set(editions.filter(e => e.editionId.startsWith('ms-') && e.label.includes('PDF')).map(e => `${e.grade}/${e.topicId}`));
// Visible body copy: the intro, sections, body flow and FAQ (meta descriptions and JSON-LD are derived or site-wide).
const bodyTexts = (raw: any): string[] => {
  const out: string[] = [raw.intro ?? ''];
  for (const section of raw.sections ?? []) for (const block of section.blocks ?? []) out.push(block.text ?? '');
  for (const item of raw.bodyFlow ?? []) out.push(item.text ?? '');
  for (const item of [...(raw.faq ?? []), ...(raw.faqGroups ?? []).flatMap((g: any) => g.items ?? [])]) out.push(item.question ?? '', item.answer ?? '');
  return out;
};
const topicsOf = (raw: any): string[] => [raw.catalogCta, ...(raw.catalogCtas ?? [])].filter(Boolean)
  .flatMap((cta: { href: string }) => {
    const m = cta.href.match(/grade=(\d+)&topic=(\d+)/);
    return m ? [`${m[1]}/${m[2]}`] : [];
  });

const OLD_QUESTION = 'האם קובצי ה־PDF הנוספים כוללים רמזי?';
const NEW_QUESTION = 'האם בקובצי ה־PDF הנוספים יש רמזים?';
const NEW_ANSWER = 'לא. קובצי ה־PDF הנוספים מיועדים להורדה ולהדפסה, ויש בהם שאלות ותשובות סופיות. בדפים הקודמים שנפתחים עם רמזי אפשר לקבל רמזים.';

test('every corrected page is exactly the reviewed correction of its exact earlier page', () => {
  assert.equal(reviewed.schema, 'landing-corrections/v1');
  assert.equal(reviewed.audit, 'reports/ANTIGRAVITY-AUDIT-claude-landings-20261117/review.json');
  assert.equal((reviewed as { siteReview?: string }).siteReview, 'reports/ANTIGRAVITY-SITE-REVIEW-landing-corrections-full-20261118/review.json');
  assert.equal(reviewed.pages.length, 55);
  assert.equal(reviewed.pages.reduce((n, page) => n + page.replacements.length, 0), 156);
  for (const entry of reviewed.pages) {
    const raw = readPage(entry.slug);
    assertCorrectedRawPage(entry.slug, raw);
    for (const r of entry.replacements) {
      assert.notEqual(r.before, r.after);
      assert.equal(allText(raw).split(JSON.stringify(r.after).slice(1, -1)).length - 1, r.count, `${entry.slug}: ${r.after.slice(0, 40)}`);
      // Exact replacements (the FAQ answer) leave the same words in longer fields such as the intro.
      if (!r.after.includes(r.before)) assert.equal(allText(raw).split(JSON.stringify(r.before).slice(1, -1)).length - 1, r.beforeCount - r.count, `${entry.slug}: old text is gone where it was replaced`);
    }
  }
});

test('no page keeps an ungrammatical "כוללים רמזי" question; each central answer opens with "לא." and limits hints to the earlier sheets', () => {
  const slugs = readdirSync(root).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5));
  let pages = 0;
  for (const slug of slugs) {
    const raw = readPage(slug);
    assert.ok(!allText(raw).includes(OLD_QUESTION), `${slug}: old FAQ question`);
    // Series-specific FAQ questions used the same construction ('האם דפי ה־PDF … כוללים רמזי?').
    assert.doesNotMatch(allText(raw), /כוללים רמזי/, `${slug}: ungrammatical hint question`);
    const item = (raw.faq ?? []).find((f: { question: string }) => f.question === NEW_QUESTION);
    if (!item) continue;
    pages += 1;
    assert.equal(item.answer, NEW_ANSWER, slug);
    const loaded = loadTopicPage(slug);
    const schema = extractJsonLdFaq(loaded.jsonLd).map(f => ({ question: plain(f.question), answer: plain(f.answer) }));
    assert.ok(schema.some(f => f.question === NEW_QUESTION && f.answer === NEW_ANSWER), `${slug}: FAQ schema synchronized`);
  }
  assert.equal(pages, 40);
});

test('no corrected page, and no page with an extra PDF edition, names Noam AI in its body copy; every corrected hint sentence is limited to the earlier sheets', () => {
  for (const entry of reviewed.pages) {
    const raw = readPage(entry.slug);
    // Site-wide production copy (meta descriptions, the generic hint prompt) is outside this
    // correction; only the audited sentences change, and none of their new texts names Noam AI.
    assert.ok(entry.replacements.every(r => !r.after.includes('נועם AI')), `${entry.slug}: a correction names נועם AI`);
    assert.ok(!/רמה ג׳/.test(allText(raw)), `${entry.slug}: רמה ג׳`);
    for (const r of entry.replacements) {
      // Questions (the central FAQ question, the series FAQ questions, the hint FAQ question) carry no claim.
      if (!/רמז/.test(r.after) || /question$/.test((r as { central?: string }).central ?? '')) continue;
      assert.match(r.after, /בדפים הקודמים שנפתחים עם רמזי/, `${entry.slug}: ${r.after}`);
      assert.match(r.after, /PDF/, `${entry.slug}: says what the PDFs contain`);
    }
  }
  // The site review found legacy body sentences that still named Noam AI as the worksheet hint tool on
  // corrected pages and on other pages with extra PDF editions; none may remain in visible body copy.
  const pdfPages = readdirSync(root).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5))
    .filter(slug => topicsOf(readPage(slug)).some(topic => pdfTopics.has(topic)));
  assert.ok(pdfPages.length >= 60, `${pdfPages.length} pages with extra PDF editions`);
  for (const slug of new Set([...reviewed.pages.map(page => page.slug), ...pdfPages])) {
    for (const text of bodyTexts(readPage(slug))) assert.ok(!text.includes('נועם AI'), `${slug}: ${text.slice(0, 60)}`);
  }
});

test('the corrections fence reverses exactly the recorded replacements and rejects partial or edited copy', () => {
  const entry = reviewed.pages.find(page => page.replacements.length >= 3)!;
  const raw = readPage(entry.slug);
  const restored = beforeLandingCorrections(entry.slug, raw);
  assert.equal(digest(restored), entry.baselineSha256);
  assert.deepEqual(beforeLandingCorrections(entry.slug, restored), restored, 'an already reversed page passes unchanged');
  assert.deepEqual(beforeLandingCorrections('no-such-page', raw), raw);
  // One corrected sentence edited, or one replacement undone by hand: the page is in neither exact state.
  const first = entry.replacements[0];
  const edited = JSON.parse(allText(raw).split(JSON.stringify(first.after).slice(1, -1)).join(JSON.stringify(first.after.slice(0, -2)).slice(1, -1)));
  assert.throws(() => beforeLandingCorrections(entry.slug, edited), /neither fully applied nor fully reversed/);
  const half = JSON.parse(allText(raw).split(JSON.stringify(first.after).slice(1, -1)).join(JSON.stringify(first.before).slice(1, -1)));
  assert.throws(() => beforeLandingCorrections(entry.slug, half), /neither fully applied nor fully reversed/);
});
