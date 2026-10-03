/**
 * Every documented content correction is applied in the stored JSON, and the stored
 * pages and posts keep school notation (cut-over readiness review, 3.10.2026).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import corrections from '../src/data/content-corrections.json';
import { META_FIELDS, applyContentCorrections, topicPageCorrections } from '../src/lib/parity/contentCorrections.ts';

type Fix = { before?: string; after?: string; swap?: string[]; reason: string };
const byKind: Record<'topicPages' | 'blogPosts' | 'gradeHubs', Record<string, Fix[]>> = corrections;
const dir = (kind: string) => new URL(`../src/data/${kind}/`, import.meta.url);
const read = (kind: string, slug: string) => readFileSync(new URL(`${slug}.json`, dir(kind)), 'utf8');
const all = (kind: string) =>
  readdirSync(dir(kind))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, text: readFileSync(new URL(f, dir(kind)), 'utf8') }));

describe('documented content corrections are applied', () => {
  for (const [kind, key] of [
    ['topic-pages', 'topicPages'],
    ['blog-posts', 'blogPosts'],
    ['grade-hubs', 'gradeHubs'],
  ] as const) {
    it(`${kind}: every "after" is present and every "before" is gone`, () => {
      const map = byKind[key];
      for (const [slug, fixes] of Object.entries(map)) {
        // Head meta is SEO copy and is not corrected here (see META_FIELDS).
        const page = JSON.parse(read(kind, slug)) as Record<string, unknown>;
        for (const field of META_FIELDS) delete page[field];
        const text = JSON.stringify(page);
        for (const fix of fixes) {
          assert.ok(fix.reason, `${slug}: correction needs a reason`);
          if (fix.swap) continue;
          assert.ok(text.includes(JSON.stringify(fix.after).slice(1, -1)), `${slug}: missing "${fix.after}"`);
          if (!fix.after!.includes(fix.before!)) {
            assert.ok(!text.includes(JSON.stringify(fix.before).slice(1, -1)), `${slug}: still has "${fix.before}"`);
          }
        }
      }
    });
  }
});

describe('catalog topic titles (index.html → catalog.v1.json)', () => {
  it('units, maqaf and geresh are spelled out', () => {
    const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
    const titles: string[] = catalog.grades.flatMap((g: { topics: { title: string }[] }) => g.topics.map((t) => t.title));
    const he = '\u05D0-\u05EA';
    for (const title of titles) {
      assert.doesNotMatch(title, new RegExp(`(?<![${he}])(סמ|סמק|מק)(?![${he}״])`, 'u'), title);
      assert.doesNotMatch(title, /(דו|רב|תלת) (ספרתי|שלבי|ממד)|(חד|ישר) זווית|אי זוגי|שווה שוקיים|דו איבר/u, title);
      assert.doesNotMatch(title, /\d ו \d|(?<![\u05D0-\u05EA])מ \d|\d-\d/u, title);
      assert.doesNotMatch(title, new RegExp(`לכיתה [${he}](?!׳)(?![${he}])`, 'u'), title);
    }
    assert.ok(titles.includes('מדידות אורך ס״מ ומטר'));
    assert.ok(titles.includes('קיבול סמ״ק ליטר ומ״ק'));
  });
});

describe('stored content keeps school notation', () => {
  it('no ÷ (division is ":") and no code notation in topic pages and posts', () => {
    for (const kind of ['topic-pages', 'blog-posts']) {
      for (const { f, text } of all(kind)) {
        assert.ok(!text.includes('÷'), `${kind}/${f}: ÷`);
        assert.ok(!text.includes('`'), `${kind}/${f}: backtick renders as a visible character`);
        assert.doesNotMatch(text, /\d\^\d|sqrt\(|\d \* \d/, `${kind}/${f}: code-style math`);
      }
    }
  });

  it('head meta still matches production: meta changes belong to the approved SEO proposals', () => {
    const fixtures = new URL('./fixtures/topic-parity/', import.meta.url);
    const slugs = readdirSync(fixtures)
      .filter((f) => f.endsWith('.production.json'))
      .map((f) => f.replace('.production.json', ''));
    assert.ok(slugs.length >= 90, `only ${slugs.length} production fixtures`);
    for (const slug of slugs) {
      const production = JSON.parse(readFileSync(new URL(`${slug}.production.json`, fixtures), 'utf8'));
      const page = JSON.parse(read('topic-pages', slug));
      assert.equal(page.title, production.title, `${slug}: title`);
      assert.equal(page.description, production.description, `${slug}: description`);
    }
  });

  it('applying corrections never rewrites head meta', () => {
    const snapshot = { title: 'בסיס × גובה ÷ 2', description: 'בסיס × גובה ÷ 2', h1: 'בסיס × גובה ÷ 2' };
    const out = applyContentCorrections(snapshot, topicPageCorrections('triangle-area-grade-7'));
    assert.equal(out.title, snapshot.title);
    assert.equal(out.description, snapshot.description);
    assert.equal(out.h1, 'בסיס × גובה : 2');
  });

  it('adjacent angles always sum to 180° (no "only when" wording)', () => {
    for (const slug of ['angles-grade-7', 'angles-review-grade-7']) {
      assert.doesNotMatch(read('topic-pages', slug), /180° רק כ/);
    }
  });
});
