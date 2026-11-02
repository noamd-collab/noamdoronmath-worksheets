/**
 * SEO audit fixes, 2.11.2026: topic-page dateModified comes only from the
 * visible update line, and the quadratic-equations page teaches the formula.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TOPIC_PAGE_SLUGS, loadTopicPage, updatedLineIsoDate } from '../src/lib/topicPages.ts';
import { learningResourceJsonLd } from '../src/lib/structuredData.ts';
import { topicTextParts } from '../src/lib/topicTextParts.ts';
import { isolateMathRuns } from '../src/lib/mathDirection.ts';

type Node = Record<string, unknown>;
const graph = (jsonLd: Node): Node[] => (jsonLd['@graph'] as Node[] | undefined) || [];

describe('updatedLineIsoDate', () => {
  it('reads D.M.YYYY from the visible update line', () => {
    assert.equal(updatedLineIsoDate('נועם דורון מתמטיקה · עודכן 12.9.2026'), '2026-09-12');
    assert.equal(updatedLineIsoDate('נועם דורון מתמטיקה · עודכן 2.11.2026'), '2026-11-02');
  });

  it('returns null when there is no real date', () => {
    assert.equal(updatedLineIsoDate(null), null);
    assert.equal(updatedLineIsoDate(undefined), null);
    assert.equal(updatedLineIsoDate('נועם דורון מתמטיקה'), null);
    assert.equal(updatedLineIsoDate('עודכן 31.2.2026'), null);
    assert.equal(updatedLineIsoDate('עודכן 1.13.2026'), null);
  });
});

describe('topic JSON-LD dateModified matches the visible date', () => {
  it('every WebPage/LearningResource dateModified equals the update line date', () => {
    let dated = 0;
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      const iso = updatedLineIsoDate(page.updatedLine);
      for (const node of graph(page.jsonLd)) {
        if (node['@type'] !== 'WebPage' && node['@type'] !== 'LearningResource') continue;
        if (iso) {
          assert.equal(node.dateModified, iso, `${slug} ${node['@type']}`);
          dated++;
        } else {
          assert.equal(node.dateModified, undefined, `${slug}: invented dateModified`);
        }
      }
    }
    assert.ok(dated > 0, 'at least one dated topic page');
  });

  it('the template-built LearningResource carries the date only when given', () => {
    const base = { name: 'n', path: '/x', description: 'd', educationalLevel: 'כיתה ט׳' };
    assert.equal(learningResourceJsonLd(base).dateModified, undefined);
    assert.equal(learningResourceJsonLd({ ...base, dateModified: null }).dateModified, undefined);
    assert.equal(learningResourceJsonLd({ ...base, dateModified: '2026-11-02' }).dateModified, '2026-11-02');
  });
});

describe('quadratic-equations-grade-9 explains the quadratic formula', () => {
  const page = loadTopicPage('quadratic-equations-grade-9');
  const text = page.sections
    .flatMap((section) => section.blocks)
    .filter((block) => block.type === 'paragraph')
    .map((block) => block.text || '')
    .join('\n');

  it('states the formula and what b²−4ac decides', () => {
    assert.match(text, /x=⟨−b±√\(b²−4ac\)¦2a⟩/);
    assert.match(text, /אם הוא חיובי יש שני פתרונות, אם הוא אפס יש פתרון אחד, ואם הוא שלילי אין פתרון/);
  });

  it('works one example whose numbers are right', () => {
    assert.match(text, /2x²\+3x−2=0/);
    assert.match(text, /b²−4ac=9\+16=25/);
    assert.match(text, /x=⟨−3\+5¦4⟩=⟨1¦2⟩ או x=⟨−3−5¦4⟩=−2/);
    const [a, b, c] = [2, 3, -2];
    const disc = b * b - 4 * a * c;
    assert.equal(disc, 25);
    for (const x of [(-b + 5) / (2 * a), (-b - 5) / (2 * a)]) assert.equal(a * x * x + b * x + c, 0);
  });

  it('shows the new update date', () => {
    assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 2.11.2026');
  });
});

describe('topic-page fractions render whole and in reading order', () => {
  const LRI = '\u2066';
  const PDI = '\u2069';
  const strip = (t: string) => t.replace(/[\u2066\u2069]/g, '');
  const wholeMarkers = (t: string) => (strip(t).match(/⟨[^⟨⟩¦]+¦[^⟨⟩]+⟩/g) || []).length;

  it('isolateMathRuns keeps a whole formula with fractions in one LTR isolate', () => {
    assert.equal(
      isolateMathRuns('דוגמה: ⟨2¦3⟩ × ⟨1¦2⟩ = ⟨1¦3⟩, ו־⟨1¦3⟩ קטן מ־⟨2¦3⟩.'),
      `דוגמה: ${LRI}⟨2¦3⟩ × ⟨1¦2⟩ = ⟨1¦3⟩${PDI}, ו־${LRI}⟨1¦3⟩${PDI} קטן מ־${LRI}⟨2¦3⟩${PDI}.`
    );
    assert.equal(
      isolateMathRuns('מקבלים x=⟨−3+5¦4⟩=⟨1¦2⟩ או x=⟨−3−5¦4⟩=−2.'),
      `מקבלים ${LRI}x=⟨−3+5¦4⟩=⟨1¦2⟩${PDI} או ${LRI}x=⟨−3−5¦4⟩=−2${PDI}.`
    );
  });

  it('a formula with a fraction is one nowrap part; other parts are unchanged', () => {
    const nowrap = new Set(['S = (d1 · d2) : 2']);
    assert.deepEqual(topicTextParts(`השטח: ${LRI}S = (d1 · d2) : 2${PDI}.`, nowrap), [
      { text: 'השטח: ', nowrap: false },
      { text: `${LRI}S = (d1 · d2) : 2${PDI}`, nowrap: true },
      { text: '.', nowrap: false },
    ]);
    assert.deepEqual(topicTextParts(`ראו ${LRI}x=⟨1¦2⟩${PDI} כאן`), [
      { text: 'ראו ', nowrap: false },
      { text: `${LRI}x=⟨1¦2⟩${PDI}`, nowrap: true },
      { text: ' כאן', nowrap: false },
    ]);
    assert.deepEqual(topicTextParts(`${LRI}x=3${PDI}`), [{ text: `${LRI}x=3${PDI}`, nowrap: false }]);
    assert.deepEqual(topicTextParts('בלי מתמטיקה'), [{ text: 'בלי מתמטיקה', nowrap: false }]);
    assert.deepEqual(topicTextParts(''), [{ text: '', nowrap: false }]);
  });

  it('every stored topic-page fraction reaches TopicInline whole (none split)', () => {
    let markers = 0;
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      const texts = [page.intro, ...page.sections.flatMap((s) => s.blocks.map((b) => b.text || ''))];
      for (const raw of texts) {
        const stored = (raw.match(/⟨/g) || []).length;
        if (!stored) continue;
        const parts = topicTextParts(isolateMathRuns(raw));
        const whole = parts.reduce((n, p) => n + (p.text.match(/⟨[^⟨⟩¦\u2066\u2069]+¦[^⟨⟩\u2066\u2069]+⟩/g) || []).length, 0);
        assert.equal(whole, stored, `${slug}: ${raw.slice(0, 60)}`);
        assert.equal(parts.map((p) => strip(p.text)).join(''), raw, `${slug}: text changed`);
        markers += wholeMarkers(raw);
      }
    }
    assert.ok(markers > 100, `markers checked: ${markers}`);
  });
});
