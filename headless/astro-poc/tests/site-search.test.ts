/**
 * Site search: Hebrew normalisation, query understanding, ranking guarantees,
 * the reviewed search terms and the committed index (src/lib/siteSearch).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { analyzeWord, buildLexicon, inflections, normalizeText, tokenize } from '../src/lib/siteSearch/normalize';
import { parseQuery } from '../src/lib/siteSearch/query';
import { catalogTargets, postGrade, reviewedSearchTerms, type TermsDecision } from '../src/lib/siteSearch/buildIndex';
import { editDistance, matchingTopicIds, prepareIndex, search } from '../src/lib/siteSearch/engine';
import type { SearchIndex } from '../src/lib/siteSearch/types';
import type { CatalogV1 } from '../src/lib/catalog/types';
import { buildFromRepo } from '../scripts/build-search-index';
import { bench, score, summarize } from '../scripts/search-eval';
import { newEngineFor } from '../scripts/search-eval-new';

const root = new URL('../', import.meta.url);
const readJson = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const index = readJson<SearchIndex>('src/data/search-index.v1.json');
const catalog = readJson<CatalogV1>('src/data/catalog.v1.json');
const review = readJson<{ decisions: TermsDecision[] }>('src/data/search-terms-review.json');
const p = prepareIndex(index);
const keys = (q: string, grade?: number) => search(p, q, { grade }).results.map((r) => r.key);

describe('normalisation', () => {
  it('drops niqqud, geresh and gershayim; maqaf and dashes split words; finals fold', () => {
    assert.equal(normalizeText('פִּיתָגוֹרָס'), 'פיתגורס');
    assert.equal(normalizeText('סמ״ק'), 'סמק');
    assert.equal(normalizeText('כיתה ז׳'), 'כיתה ז');
    assert.deepEqual(tokenize('דו־ספרתי'), ['דו', 'ספרתי']);
    assert.deepEqual(tokenize('30–60–90'), ['30', '60', '90']);
    assert.equal(normalizeText('מעוין'), 'מעוינ');
  });
  it('folds spelling variants without merging the plural ריבועיים into ריבועים', () => {
    assert.equal(normalizeText('גיאומטריה'), normalizeText('גאומטריה'));
    assert.equal(normalizeText('משוואות'), normalizeText('משואות'));
    assert.equal(normalizeText('סימטרייה'), normalizeText('סימטריה'));
    assert.notEqual(normalizeText('ריבועיים'), normalizeText('ריבועים'));
  });
  it('undoes plural endings but not into other words', () => {
    assert.ok(inflections(normalizeText('משוואות')).includes(normalizeText('משוואה')));
    assert.ok(inflections(normalizeText('זוויות')).includes(normalizeText('זווית')));
    assert.ok(inflections(normalizeText('שברים')).includes('שבר'));
    const words = new Set(['מערכ', 'מערכימ', 'מערכת']);
    assert.ok(!inflections('מערכת', words).includes('מערכ'), 'מערכת (system) is not מערך (array)');
  });
  it('removes a prefix only when the rest is a site word, never from protected words', () => {
    const lex = buildLexicon(['המשכ', 'משכ', 'מספר', 'ספר', 'אי', 'זוגי', 'חזקה', 'לחזק', 'היקפ']);
    assert.ok(!analyzeWord('המשכ', lex).includes('משכ'), 'המשך (continue) is not משך (duration)');
    assert.ok(analyzeWord('ומספר', lex).includes('מספר'));
    assert.ok(!analyzeWord('ומספר', lex).includes('ספר'), 'ו is removed before מ is considered');
    assert.ok(analyzeWord('ואי', lex).includes('אי'));
    assert.ok(!analyzeWord('לחזק', lex).some((k) => k.startsWith('חזק')), 'לחזק (strengthen) is not חזקה (power)');
    assert.ok(analyzeWord('והיקפ', lex).includes('היקפ'));
    assert.deepEqual(analyzeWord('שטח', lex), ['שטח'], 'no blanket stripping of unknown words');
  });
  it('measures spelling distance with transpositions', () => {
    assert.equal(editDistance('פיטגורס', 'פיתגורס'), 1);
    assert.equal(editDistance('מרוכב', 'מורכב'), 1);
    assert.equal(editDistance('שטח', 'נפח'), 2);
  });
});

describe('query understanding', () => {
  it('reads the grade a query names and removes its words', () => {
    assert.deepEqual(
      [parseQuery('שברים כיתה ה').grade, parseQuery('לכיתה ז׳ חזקות').grade, parseQuery('משוואות כיתה 8').grade],
      [5, 7, 8]
    );
    assert.equal(parseQuery('שברים כיתה ה').textWithoutGrade, 'שברים');
    assert.equal(parseQuery('כיתה א וכיתה ב').grade, null, 'two grades: none is binding');
    assert.equal(parseQuery('ערך מקום').grade, null);
  });
  it('reads post grades from title and slug and refuses a conflict', () => {
    assert.equal(postGrade({ title: 'תרגול שברים לכיתה ד׳', fileSlug: 'fractions-practice-grade-4' }), 4);
    assert.equal(postGrade({ title: 'דפי עבודה ללוח הכפל', fileSlug: 'multiplication-table-worksheets' }), null);
    assert.equal(postGrade({ title: 'משהו לכיתה ה׳', fileSlug: 'x-grade-7' }), null);
  });
  it('reads catalog links on the site and on the GitHub Pages copy only', () => {
    assert.deepEqual(catalogTargets('/worksheets?grade=7&topic=35'), [{ grade: 7, topic: 35 }]);
    assert.deepEqual(catalogTargets('https://noamd-collab.github.io/noamdoronmath-worksheets/?grade=9&topic=2'), [{ grade: 9, topic: 2 }]);
    assert.deepEqual(catalogTargets('https://example.com/worksheets?grade=7&topic=1').length, 1);
    assert.deepEqual(catalogTargets('/grade-7'), []);
    assert.deepEqual(catalogTargets('/worksheets?grade=12&topic=1'), []);
  });
});

describe('ranking and mathematical distinctions', () => {
  it('perimeter is not area, area is not perimeter', () => {
    assert.equal(keys('היקף מצולעים')[0], 'topic:3:15');
    assert.equal(search(p, 'שטח פנים גליל').results[0].key, 'topic:8:13');
    assert.ok(!keys('שטח פנים גליל').includes('topic:8:14'), 'the volume sheet does not match surface area');
    assert.ok(!keys('גליל נפח').includes('topic:8:13'));
    assert.ok(!keys('מנסרה משולשת שטח פנים').includes('topic:7:47'), 'reviewed terms keep the volume sheet out');
  });
  it('powers are not roots', () => {
    assert.equal(keys('חזקות כיתה ז')[0], 'topic:7:6');
    assert.ok(!keys('חזקות כיתה ז').includes('topic:7:7'));
    assert.equal(keys('שורש ריבועי כיתה ז')[0], 'topic:7:7');
    assert.ok(!keys('שורש ריבועי כיתה ז').includes('topic:7:6'));
    assert.equal(keys('חוקי חזקות')[0], 'topic:9:16');
    assert.ok(!keys('נוסחת השורשים').includes('topic:9:16'));
  });
  it('vertical angles are not the vertex of a polygon', () => {
    assert.ok(!keys('זוויות קודקודיות').includes('topic:3:14'));
    assert.equal(keys('קודקוד')[0], 'topic:3:14');
    assert.equal(keys('זוויות צמודות')[0], 'topic:7:12');
  });
  it('an exact title beats a passing mention', () => {
    assert.equal(keys('פיתגורס')[0], 'topic:8:11');
    assert.equal(keys('מעוין')[0], 'topic:9:13');
    assert.equal(keys('שורשים')[0], 'topic:9:17');
  });
  it('matching is by word, not by prefix of a longer word', () => {
    assert.deepEqual(keys('אינטגרלים'), [], 'not "אינטגרטיבי"');
    assert.deepEqual(keys('שטח כדור'), [], 'not "כדורגל"');
  });
});

describe('grade filter', () => {
  it('a grade written in the query is binding and other grades are only counted', () => {
    const r = search(p, 'שברים כיתה ה');
    assert.equal(r.grade, 5);
    assert.equal(r.gradeSource, 'query');
    assert.ok(r.results.length > 0 && r.results.every((x) => x.grade === 5));
    assert.ok(r.otherGrades.some((o) => o.grade === 6 && o.count > 0));
  });
  it('a selected grade is binding; a grade in the query overrides it', () => {
    assert.ok(search(p, 'פיתגורס', { grade: 8 }).results.every((x) => x.grade === 8));
    const r = search(p, 'חזקות כיתה ט', { grade: 7 });
    assert.equal(r.grade, 9);
    assert.equal(r.results[0].key, 'topic:9:16');
  });
  it('a grade without the topic gives no results and offers the grades that have it', () => {
    const r = search(p, 'משוואות כיתה ג');
    assert.deepEqual(r.results, []);
    assert.ok(r.otherGrades.some((o) => o.grade === 7));
  });
});

describe('spelling guesses and empty answers', () => {
  it('guesses a site word one letter away and says it is a guess', () => {
    const r = search(p, 'פיטגורס');
    assert.deepEqual(r.corrections, [{ from: 'פיטגורס', to: 'פיתגורס' }]);
    assert.ok(r.results.length > 0);
  });
  it('does not guess for words the site has', () => {
    assert.deepEqual(search(p, 'מעוין').corrections, []);
  });
  it('subjects the site does not teach return nothing', () => {
    for (const q of ['טריגונומטריה', 'נגזרת', 'מטריצות', 'מספרים מרוכבים', 'לוגריתמים']) {
      assert.deepEqual(search(p, q).results, [], q);
    }
  });
  it('no results comes with narrower suggestions', () => {
    const r = search(p, 'שטח כדור');
    assert.ok(r.suggestions.some((s) => s.query === 'שטח' && s.count > 0));
  });
  it('an empty or punctuation-only query is empty', () => {
    assert.equal(search(p, '   ').empty, true);
    assert.equal(search(p, '?!').empty, true);
  });
  it('live typing matches the start of the last word only while typing', () => {
    assert.ok(search(p, 'זוו', { live: true }).results.length > 0);
    assert.deepEqual(search(p, 'זוו').results, []);
  });
  it('markup in the query stays text', () => {
    const r = search(p, '<img src=x onerror=alert(1)> שברים');
    for (const res of r.results) for (const part of res.titleParts) assert.ok(!part.text.includes('<'));
  });
});

describe('results', () => {
  it('a topic card carries its levels, its explainer page and its posts', () => {
    const r = search(p, 'משוואות דו שלביות').results.find((x) => x.key === 'topic:7:35');
    assert.ok(r);
    assert.ok(r.levels.length >= 2);
    assert.ok(r.posts.some((x) => x.href.startsWith('/post/')));
  });
  it('pages whose catalog link does not fit the page stay results of their own', () => {
    const page = index.docs.find((d) => d.key === 'page:/coordinate-plane-grade-8');
    assert.ok(page && !page.topicKey, 'מערכת צירים is not attached to סינתזה גאומטרית');
    const stats = index.docs.find((d) => d.key === 'page:/statistics-grade-8');
    assert.ok(stats && !stats.topicKey);
  });
  it('the catalog filter answers with topic ids of the grade', () => {
    const ids = matchingTopicIds(p, 'זוויות', 7);
    assert.ok(ids && ids.has(12) && !ids.has(6));
    assert.equal(matchingTopicIds(p, '  ', 7), null);
  });
  it('sub-topic worksheets are offered inside their parent card', () => {
    const r = search(p, 'פירוק לגורמים').results.find((x) => x.key === 'topic:9:2');
    assert.ok(r && r.levels.some((l) => l.of));
  });
});

describe('reviewed search terms', () => {
  it('every decision names the terms the catalog carries today', () => {
    const { applied } = reviewedSearchTerms(catalog, review.decisions);
    assert.deepEqual(applied.filter((d) => !d.applied).map((d) => `${d.grade}:${d.topic}`), []);
  });
  it('a move goes to a topic whose own title or description has at least two of the words', () => {
    const lex = buildLexicon(tokenize(JSON.stringify(catalog)));
    const keysOf = (t: string) => new Set(tokenize(t).flatMap((w) => analyzeWord(w, lex)));
    for (const d of review.decisions.filter((x) => x.decision === 'move')) {
      const target = catalog.grades.find((g) => g.grade === d.grade)?.topics.find((t) => t.id === d.to);
      assert.ok(target, `${d.grade}:${d.to}`);
      const own = keysOf(target.title + ' ' + (target.description || ''));
      const shared = tokenize(d.terms).filter((w) => analyzeWord(w, lex).some((k) => own.has(k)));
      assert.ok(shared.length >= 2, `${d.grade}:${d.topic} → ${d.to} shares ${shared.join(',')}`);
    }
  });
});

describe('committed index and benchmark', () => {
  it('the committed index is what the build produces from the data', () => {
    const { index: fresh } = buildFromRepo();
    assert.equal(readFileSync(new URL('src/data/search-index.v1.json', root), 'utf8'), JSON.stringify(fresh) + '\n');
  });
  it('benchmark: correct result in the top 3 for ≥95% of answerable queries, no wrong grade, nothing shown for unanswerable', () => {
    const rows = bench.queries.map((q) => score(q, newEngineFor(p)(q)));
    const s = summarize(rows).all;
    assert.ok(s.hit3 / s.answerable >= 0.95, JSON.stringify(s));
    assert.equal(s.wrongGrade, 0);
    assert.equal(s.noAnswerShown, 0);
    assert.ok(s.misleading <= 2, JSON.stringify(s));
  });
});
