/**
 * Every documented content correction is applied in the stored JSON, and the stored
 * pages and posts keep school notation (cut-over readiness review, 3.10.2026).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import corrections from '../src/data/content-corrections.json';

type Fix = { before?: string; after?: string; swap?: [string, string]; reason: string };
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
      const map = (corrections as Record<string, Record<string, Fix[]>>)[key];
      for (const [slug, fixes] of Object.entries(map)) {
        const text = JSON.parse(read(kind, slug)) && read(kind, slug);
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

  it('triangle-area-grade-7 meta names its own topic and grade', () => {
    const page = JSON.parse(read('topic-pages', 'triangle-area-grade-7'));
    assert.match(page.title, /^שטח משולש לכיתה ז׳/);
    assert.doesNotMatch(`${page.title} ${page.description}`, /מפשטים ואז פותרים|לכיתה ז(?!׳)/);
  });

  it('adjacent angles always sum to 180° (no "only when" wording)', () => {
    for (const slug of ['angles-grade-7', 'angles-review-grade-7']) {
      assert.doesNotMatch(read('topic-pages', slug), /180° רק כ/);
    }
  });
});
