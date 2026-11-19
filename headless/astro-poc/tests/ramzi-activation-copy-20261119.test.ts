import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { assertRamziActivationCopyRawPage, beforeRamziActivationCopy,
  reviewedRamziActivationCopy as reviewed } from './fixtures/ramzi-activation-copy-20261119.ts';

const root = new URL('../src/data/topic-pages/', import.meta.url);
const readPage = (slug: string) => JSON.parse(readFileSync(new URL(`${slug}.json`, root), 'utf8'));
const plain = (text: string) => text.replace(/[⁦-⁩]/g, '');
const at = (page: any, path: Array<string | number>) => path.reduce((node, key) => node[key], page);
const catalog = loadCatalog();
const topicsOf = (raw: any): string[] => [raw.catalogCta, ...(raw.catalogCtas ?? [])].filter(Boolean)
  .flatMap((cta: { href: string }) => {
    const m = cta.href.match(/grade=(\d+)&topic=(\d+)/);
    return m ? [`${m[1]}/${m[2]}`] : [];
  });
const activatedOn = (key: string) => {
  const [grade, id] = key.split('/').map(Number);
  const topic: any = catalog.grades.find(g => g.grade === grade)!.topics.find(t => t.id === id)!;
  return (topic.editions ?? []).filter((e: any) => e.routing.aiHintShown && e.publicationMode === 'pdf-only'
    && e.levels.every((l: any) => l.ramzi?.status === 'ready' && l.ramzi?.learningScopeUrl));
};

test('every corrected page is exactly the reviewed correction of its exact earlier page', () => {
  assert.equal(reviewed.schema, 'landing-copy-correction/v1');
  assert.equal(reviewed.pages.length, 9);
  assert.equal(reviewed.pages.reduce((n, page) => n + page.replacements.length, 0), 23);
  for (const entry of reviewed.pages) {
    const raw = readPage(entry.slug);
    assertRamziActivationCopyRawPage(entry.slug, raw);
    for (const r of entry.replacements) {
      assert.notEqual(r.before, r.after);
      assert.equal(plain(at(raw, r.path)).split(r.after).length, 2, `${entry.slug}: ${r.path.join('.')}`);
      assert.ok(!plain(at(raw, r.path)).includes(r.before), `${entry.slug}: old text is gone from ${r.path.join('.')}`);
    }
  }
});

test('each corrected page links a series that now opens with Ramzi, and every new sentence keeps the PDF files hint-free', () => {
  for (const entry of reviewed.pages) {
    const raw = readPage(entry.slug);
    assert.ok(topicsOf(raw).some(key => activatedOn(key).length > 0), `${entry.slug}: an activated series on the page`);
    for (const r of entry.replacements) {
      assert.match(r.after, /רמזי/, `${entry.slug}: names רמזי`);
      assert.doesNotMatch(r.after, /נועם AI|רמה ג׳|דוגמה פתורה|פתרון מלא/, `${entry.slug}: forbidden wording`);
      assert.doesNotMatch(r.after, /\d\s*\/\s*\d/, `${entry.slug}: slash fraction`);
      assert.ok(!['description', 'title', 'h1'].includes(String(r.path[0])), `${entry.slug}: SEO fields stay frozen`);
      // The files themselves never gain hints: any sentence about the PDF files says they have none or are for printing.
      if (/קובצי ה־PDF עצמם|בקבצים עצמם/.test(r.after)) assert.match(r.after, /אין בהם רמזים|אין רמזים|להורדה ולהדפסה/);
    }
  }
});

test('FAQ answers, their faqGroups mirror and the FAQ schema carry the same corrected text', () => {
  for (const entry of reviewed.pages) {
    const raw = readPage(entry.slug);
    const schema = extractJsonLdFaq(loadTopicPage(entry.slug).jsonLd).map(item => ({ question: plain(item.question), answer: plain(item.answer) }));
    const grouped = (raw.faqGroups ?? []).flatMap((g: any) => g.items ?? []);
    for (const r of entry.replacements.filter(r => r.path[0] === 'faq')) {
      const item = at(raw, r.path.slice(0, -1));
      assert.deepEqual(schema.filter(q => q.question === plain(item.question)).map(q => q.answer), [item.answer], `${entry.slug}: FAQ schema carries the corrected answer`);
      if (grouped.length) assert.deepEqual(grouped.filter((q: any) => q.question === item.question).map((q: any) => q.answer), [item.answer], `${entry.slug}: faqGroups carry the corrected answer`);
    }
  }
});

test('the copy fence reverses exactly the recorded replacements and rejects partial or edited copy', () => {
  const entry = reviewed.pages.find(page => page.replacements.length >= 3)!;
  const raw = readPage(entry.slug);
  const restored = beforeRamziActivationCopy(entry.slug, raw);
  assert.deepEqual(beforeRamziActivationCopy(entry.slug, restored), restored, 'an already reversed page passes unchanged');
  assert.deepEqual(beforeRamziActivationCopy('no-such-page', raw), raw);
  const first = entry.replacements[0];
  const edited = structuredClone(raw);
  const parent = first.path.slice(0, -1).reduce((node: any, key) => node[key], edited);
  parent[first.path.at(-1)!] = parent[first.path.at(-1)!].replace(first.after, first.after.slice(0, -2));
  assert.throws(() => beforeRamziActivationCopy(entry.slug, edited), /neither fully applied nor fully reversed/);
  const half = structuredClone(raw);
  const halfParent = first.path.slice(0, -1).reduce((node: any, key) => node[key], half);
  halfParent[first.path.at(-1)!] = halfParent[first.path.at(-1)!].replace(first.after, first.before);
  assert.throws(() => beforeRamziActivationCopy(entry.slug, half), /neither fully applied nor fully reversed/);
});
