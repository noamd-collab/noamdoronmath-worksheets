/**
 * Regression tests for the PR 46 content review of the SEO proposals (390 rows).
 * Each block maps to a review finding or one of the seven review criteria.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildProposals,
  clipSentences,
  isValidLiveTitle,
  normalizeHebrew,
  normalizePostCopy,
  titleKey,
  withBrand,
  withGrade,
} from '../scripts/lib/seo-copy.mjs';
import { KEEP_CURRENT, NEEDS_DECISION } from '../scripts/lib/seo-overrides.mjs';

type Item = {
  path: string;
  kind: string;
  grade: number | null;
  catalogTopicId: number | null;
  title: string;
  description: string;
  currentTitle: string;
  currentDescription: string;
  approved: boolean;
  source: string;
  needsDecision?: string;
};

const root = new URL('..', import.meta.url).pathname;
const committed = JSON.parse(readFileSync(new URL('../src/data/seo-proposals.json', import.meta.url), 'utf8'))
  .items as Item[];
const len = (s: string) => [...s].length;
const byPath = (path: string) => {
  const row = committed.find((item) => decodeURIComponent(item.path) === path);
  assert.ok(row, path);
  return row!;
};
const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
const gradeLabel = new Map<number, string>(catalog.grades.map((g: { grade: number; label: string }) => [g.grade, g.label]));
const copy = (item: Item) => `${item.title} ${item.description}`;

describe('seo proposals – generator and coverage', () => {
  it('committed files are exactly what the generator builds, with no build errors', () => {
    const { proposals, errors } = buildProposals(root);
    assert.deepEqual(errors, []);
    assert.deepEqual(proposals, committed);
  });

  it('all 390 rows exist once: 235 catalog topics, 95 topic pages, 60 posts; none approved', () => {
    assert.equal(committed.length, 390);
    const count = (kind: string) => committed.filter((item) => item.kind === kind).length;
    assert.equal(count('catalog-topic'), 235);
    assert.equal(count('topic-page'), 95);
    assert.equal(count('blog-post'), 60);
    assert.equal(new Set(committed.map((item) => item.path)).size, 390);
    assert.equal(committed.filter((item) => item.approved !== false).length, 0);
  });

  it('CSV has one line per row and the decision column', () => {
    const csv = readFileSync(new URL('../seo-review.csv', import.meta.url), 'utf8');
    assert.match(csv, /^נתיב,סוג,כותרת נוכחית,כותרת מוצעת,תיאור נוכחי,תיאור מוצע,מאושר,מקור,החלטה נדרשת\n/);
    assert.equal(csv.trim().split('\n').length, 391);
  });
});

describe('seo proposals – helpers never clip', () => {
  it('withBrand adds the brand only when it fits and never cuts a headline', () => {
    assert.equal(withBrand('חזקות לכיתה ז׳'), 'חזקות לכיתה ז׳ | נועם דורון');
    const sixty = 'משוואות ופתרונן חלק 2 — סוגריים ושקילות לכיתה ז׳ — דפי עבודה';
    assert.equal(len(sixty), 60);
    assert.equal(withBrand(sixty), sixty);
    assert.equal(withBrand(`${sixty} נוסף`), null);
    assert.equal(withBrand('מדריך לתרגול בטוח.'), 'מדריך לתרגול בטוח | נועם דורון');
  });

  it('clipSentences keeps whole sentences only and drops a dangling hint question', () => {
    const intro =
      'מתרגלים פתיחת סוגריים, כינוס איברים ובידוד הנעלם במשוואות ליניאריות. דפי התרגול זמינים ברמות א׳, ב׳ ומצוינות, בחינם וללא הרשמה. זקוקים לרמז? פתחו את דף העבודה והיעזרו בנועם AI.';
    const out = clipSentences(intro)!;
    assert.ok(len(out) <= 155);
    assert.match(out, /\.$/);
    assert.ok(intro.startsWith(out));
    assert.equal(clipSentences('א'.repeat(200)), null);
  });

  it('withGrade never repeats the grade', () => {
    assert.equal(withGrade('דף סיכום אינטגרטיבי לכיתה ד', 'כיתה ד׳'), 'דף סיכום אינטגרטיבי לכיתה ד׳');
    assert.equal(withGrade('משולש שווה־צלעות — העמקה ורשות — לכיתה ט׳', 'כיתה ט׳'), 'משולש שווה־צלעות — העמקה ורשות לכיתה ט׳');
    assert.equal(withGrade('חיבור בתחום 10', 'כיתה א׳'), 'חיבור בתחום 10 לכיתה א׳');
  });

  it('normalizeHebrew restores units and maqaf as whole words only', () => {
    assert.equal(normalizeHebrew('מדידות אורך סמ ומטר'), 'מדידות אורך ס״מ ומטר');
    assert.equal(normalizeHebrew('קיבול סמק ליטר ומק'), 'קיבול סמ״ק ליטר ומ״ק');
    assert.equal(normalizeHebrew('חוזרים להרכבות 10 ו 20'), 'חוזרים להרכבות 10 ו־20');
    assert.equal(normalizeHebrew('שברים גדולים מ 1'), 'שברים גדולים מ־1');
    assert.equal(normalizeHebrew('גובה במשולש חד זווית וישר זווית'), 'גובה במשולש חד־זווית וישר־זווית');
    assert.equal(normalizeHebrew('חיבור דו ספרתי, כפל רב ספרתי, אי זוגי'), 'חיבור דו־ספרתי, כפל רב־ספרתי, אי־זוגי');
    assert.equal(normalizeHebrew('מספרים ממיינים מקבילים'), 'מספרים ממיינים מקבילים');
  });

  it('normalizePostCopy fixes spaced hyphens and maqaf before digits', () => {
    assert.equal(normalizePostCopy('פונקציות - להבין'), 'פונקציות – להבין');
    assert.equal(normalizePostCopy('לכיתה ה׳ ב-7 ימים'), 'לכיתה ה׳ ב־7 ימים');
  });

  it('live titles that are stuffed or miss the geresh are not reused', () => {
    assert.equal(isValidLiveTitle('שורשים לכיתה ט׳ | נועם דורון - מתמטיקה דפי מתמטיקה בחינם'), false);
    assert.equal(isValidLiveTitle('מפשטים ואז פותרים לכיתה ז – שטח משולש | נועם דורון'), false);
    assert.equal(isValidLiveTitle('חזקות לכיתה ז׳ | דפי עבודה במתמטיקה – נועם דורון'), true);
  });
});

describe('seo proposals – review criteria on all 390 rows', () => {
  it('criterion 3: title ≤ 60 and description ≤ 155 (code points)', () => {
    for (const item of committed) {
      assert.ok(item.title && len(item.title) <= 60, `${item.path} title ${len(item.title)}`);
      assert.ok(item.description && len(item.description) <= 155, `${item.path} description ${len(item.description)}`);
    }
  });

  it('no description is cut mid-word or mid-sentence', () => {
    const sources = new Map<string, string[]>();
    for (const name of readdirSync(new URL('../src/data/topic-pages', import.meta.url))) {
      const page = JSON.parse(readFileSync(new URL(`../src/data/topic-pages/${name}`, import.meta.url), 'utf8'));
      sources.set(page.path, [page.intro, page.description].filter(Boolean));
    }
    for (const name of readdirSync(new URL('../src/data/blog-posts', import.meta.url))) {
      const post = JSON.parse(readFileSync(new URL(`../src/data/blog-posts/${name}`, import.meta.url), 'utf8'));
      sources.set(post.path, [post.description].filter(Boolean));
    }
    for (const item of committed) {
      for (const source of (sources.get(item.path) || []).map((s) => s.replace(/\s+/g, ' ').trim())) {
        if (source === item.description || !source.startsWith(item.description)) continue;
        const rest = source.slice(item.description.length);
        const sentenceEnd = /[.!?]$/.test(item.description) && /^\s/.test(rest);
        assert.ok(sentenceEnd || rest === '.', `${item.path} cut before "${rest.slice(0, 20)}"`);
      }
    }
    for (const path of [
      '/number-line-absolute-value-grade-7',
      '/dividing-signed-numbers-grade-7',
      '/coordinate-plane-four-quadrants-grade-7',
      '/post/בינה-חינוכית-שמקדמת-כל-תלמיד-במתמטיקה',
      '/post/three-representations-equation-solution-grade-7',
    ]) {
      assert.match(byPath(path).description, /[.!?]$/, path);
    }
  });

  it('criteria 1–2: topic and catalog titles name their own grade, and only once', () => {
    for (const item of committed.filter((row) => row.kind !== 'blog-post')) {
      const own = `ל${gradeLabel.get(item.grade!)}`;
      assert.ok(item.title.includes(own), `${item.path}: ${item.title}`);
      assert.equal(item.title.split(own).length - 1, 1, `${item.path} repeats the grade`);
      for (const [grade, label] of gradeLabel) {
        if (grade !== item.grade) assert.ok(!item.title.includes(`ל${label}`), `${item.path} names another grade`);
      }
    }
    assert.match(byPath('/worksheets?grade=9&topic=43').title, /לכיתה ט׳/);
    assert.match(byPath('/post/common-factor-and-minus-parentheses-grade-7').title, /לכיתה ז׳/);
  });

  it('criterion 6: Hebrew spelling, punctuation and school math notation', () => {
    const he = 'א-ת';
    for (const item of committed) {
      const text = copy(item);
      assert.doesNotMatch(text, new RegExp(`לכיתה [${he}](?!׳)(?![${he}])`, 'u'), `${item.path} grade without geresh`);
      assert.doesNotMatch(text, new RegExp(`לכיתה [${he}]׳?\\s+לכיתה`, 'u'), `${item.path} duplicate grade`);
      assert.doesNotMatch(text, new RegExp(`(?<![${he}])(סמ|סמק|מק)(?![${he}״])`, 'u'), `${item.path} unit without gershayim`);
      assert.doesNotMatch(
        text,
        new RegExp(`(?<![${he}])[ובהלמשכ]?(דו ספרתי|רב ספרתי|רב שלבי|חד זווית|ישר זווית|אי זוגי|דו ממד|תלת ממד)`, 'u'),
        `${item.path} missing maqaf`
      );
      assert.doesNotMatch(text, /\d ו \d/u, `${item.path} "10 ו 20"`);
      assert.doesNotMatch(text, new RegExp(`(?<![${he}])מ \\d`, 'u'), `${item.path} "מ 1"`);
      assert.doesNotMatch(text, new RegExp(`[${he}]-[${he}\\d]| - `, 'u'), `${item.path} ASCII hyphen`);
      assert.doesNotMatch(text, /[÷/*]/u, `${item.path} division slash or ÷`);
      assert.doesNotMatch(item.title, /\.\s*\|/u, `${item.path} period before brand`);
    }
    assert.match(byPath('/worksheets?grade=3&topic=22').title, /ס״מ/);
    assert.match(byPath('/worksheets?grade=6&topic=15').title, /סמ״ק, ליטר ומ״ק/);
    assert.match(byPath('/worksheets?grade=2&topic=1').title, /10 ו־20/);
    assert.match(byPath('/worksheets?grade=4&topic=31').title, /^דף סיכום אינטגרטיבי לכיתה ד׳/);
    assert.match(byPath('/worksheets?grade=9&topic=22').title, /^משולש שווה־צלעות — העמקה ורשות לכיתה ט׳/);
  });

  it('criterion 5: no identical or near-identical titles or descriptions', () => {
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();
    for (const item of committed) {
      const key = titleKey(item.title);
      assert.ok(!titles.has(key), `title ${item.path} ≈ ${titles.get(key)}`);
      titles.set(key, item.path);
      assert.ok(!descriptions.has(item.description), `description ${item.path} = ${descriptions.get(item.description)}`);
      descriptions.set(item.description, item.path);
    }
    assert.notEqual(byPath('/angles-grade-7').title, byPath('/adjacent-vertical-angles-grade-7').title);
    assert.notEqual(
      titleKey(byPath('/coordinate-plane-quadrants-grade-7').title),
      titleKey(byPath('/coordinate-plane-four-quadrants-grade-7').title)
    );
    assert.match(byPath('/isosceles-triangle-properties-grade-8').title, /^תכונות משולש שווה־שוקיים/);
    assert.match(byPath('/worksheets?grade=7&topic=20').title, /– בחירת רמה/);
  });

  it('criterion 4: catalog copy uses real search terms, not internal labels', () => {
    for (const item of committed.filter((row) => row.kind === 'catalog-topic')) {
      assert.match(item.description, /דפי עבודה|דף /u, item.path);
    }
    for (const item of committed) {
      assert.doesNotMatch(item.title, /שטחים ב׳ חלק/u, `${item.path} internal unit label in title`);
    }
    assert.match(byPath('/worksheets?grade=1&topic=1').title, /^ספירה ומנייה/);
    assert.match(byPath('/worksheets?grade=8&topic=33').title, /^בעיות תנועה/);
  });

  it('criterion 7: rows reviewed as "keep current" carry the live meta unchanged', () => {
    assert.equal(KEEP_CURRENT.length, 55);
    for (const path of KEEP_CURRENT) {
      const row = byPath(path);
      assert.equal(row.title, row.currentTitle.replace(/\s+/g, ' ').trim(), path);
      assert.equal(row.description, row.currentDescription.replace(/\s+/g, ' ').trim(), path);
    }
    const triangle = byPath('/triangle-area-grade-7');
    assert.match(triangle.currentTitle, /מפשטים ואז פותרים/);
    assert.equal(triangle.title, 'שטח משולש לכיתה ז׳ | נועם דורון');
  });

  it('open questions stay with Noam: grade 1 topics 4, 19, 23 are flagged, unchanged and unapproved', () => {
    const flagged = committed.filter((item) => item.needsDecision).map((item) => item.path).sort();
    assert.deepEqual(flagged, Object.keys(NEEDS_DECISION).sort());
    assert.deepEqual(flagged, ['/worksheets?grade=1&topic=19', '/worksheets?grade=1&topic=23', '/worksheets?grade=1&topic=4']);
    assert.equal(byPath('/worksheets?grade=1&topic=19').title, 'מרכיבים ומפרקים לכיתה א׳ | נועם דורון');
    assert.equal(byPath('/worksheets?grade=1&topic=23').title, 'הרכבה ופירוק לכיתה א׳ | נועם דורון');
    for (const path of flagged) assert.equal(byPath(path).approved, false);
  });
});
