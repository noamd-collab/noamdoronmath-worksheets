import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTopicPage, extractJsonLdFaq } from '../src/lib/topicPages.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS } from '../src/lib/lessonLoops.ts';
import { lessonMathParts } from '../src/lib/lessonMath.ts';
import { isolateMathRuns } from '../src/lib/mathDirection.ts';
import { topicTextParts } from '../src/lib/topicTextParts.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { parseWorksheetsUrlState, trackForPinnedTopic } from '../src/lib/worksheetsUrlState.ts';
import { beforeEqm49Catalog, reviewedEqm49 } from './fixtures/eqm49-pdf.ts';
import { beforeBatch03Catalog, reviewedBatch03 } from './fixtures/batch03-pdf.ts';

const slug = 'equations-numeric-denominator-grade-9';
const plain = (text: string) => text.replace(/[⁦-⁩]/g, '');
const page = loadTopicPage(slug);
// Reviewed EQM01 PDFs (Antigravity PASS_STUDENT_PDF_ESSENTIALS, bound to these files' SHA-256).
const PDF_IDS = ['53fb5318e99546a6a6b12c06e118ba59', 'f5d9e89adee948768e456876b8e087cf', '038d9928b68942ca91f3a17ac6cf92b3'];

test('topic 49 opens the new reduced-track month group with exactly the three reviewed PDFs', () => {
  const grade9 = loadCatalog().grades.find(grade => grade.grade === 9)!;
  const topic = grade9.topics.find(item => item.id === 49)!;
  assert.equal(topic.title, 'משוואות עם מכנה מספרי');
  assert.equal(topic.group, 'r9jan');
  assert.equal(topic.publicationMode, 'pdf-only');
  assert.equal(topic.noamTopicId, undefined, 'a PDF-only topic has no Noam prefix');
  assert.deepEqual(topic.levels.map(level => [level.key, level.pdfId]), [['a', PDF_IDS[0]], ['b', PDF_IDS[1]], ['c', PDF_IDS[2]]]);
  assert.equal(topic.routing.usesViewer, false);
  assert.equal(topic.routing.aiHintShown, false);
  const reduced = grade9.groups.filter(group => group.reducedProgram);
  assert.deepEqual(reduced.map(group => [group.key, group.label]), [['r9sep', 'ספטמבר'], ['r9oct', 'אוקטובר'], ['r9jan', 'ינואר']]);
  // The landing CTA needs no &track: the pinned topic opens the reduced track.
  const state = parseWorksheetsUrlState(new URLSearchParams(page.catalogCta.href.split('?')[1]));
  assert.equal(state.topic, 49);
  assert.equal(trackForPinnedTopic(state, grade9), 'red');
});

test('the landing describes only the reviewed PDF scope, for ט׳ מצומצמת, without unavailable tools', () => {
  assert.equal(page.h1, 'משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת');
  assert.match(page.title, /^משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת — /);
  assert.match(page.verifiedVia ?? '', /^authored-catalog-gap-eqm01-pdf-review-/);
  assert.equal(page.catalogCta.href, '/worksheets?grade=9&topic=49');
  assert.equal(page.catalogCta.catalogTopicTitle, 'משוואות עם מכנה מספרי');
  assert.deepEqual(page.catalogCtas, [page.catalogCta]);
  assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 17.11.2026');
  const visible = plain([page.h1, page.intro, page.description,
    ...page.sections.flatMap(section => [section.heading ?? '', ...section.blocks.map(block => block.text ?? '')]),
    ...page.faq.flatMap(item => [item.question, item.answer])].join('\n'));
  for (const required of [/ט׳ מצומצמת/, /מכנה מספרי/, /מכנים מספריים/, /משוואות עם שברים/, /מכנה משותף|המכנה המשותף/,
    /סימן חיסור לפני שבר/, /משוואות מיוחדות/, /PDF/, /תשובות סופיות/, /רמה א׳/, /רמה ב׳/, /מצוינות/]) {
    assert.match(visible, required);
  }
  // Exact per-level counts from the producer catalog entry and the review receipt (19 + 19 + 18).
  assert.match(visible, /רמה א׳: שש שאלות ובהן תשעה־עשר סעיפים/);
  assert.match(visible, /רמה ב׳: שש שאלות ובהן תשעה־עשר סעיפים/);
  assert.match(visible, /מצוינות: שש שאלות ובהן שמונה־עשר סעיפים/);
  // Read from the PDFs: every file opens with the reminder and ends with a final-answers page
  // (page 5 of 5); only level א׳ has a worked example, at the opening of question 2 on page 2.
  assert.match(plain(page.intro), /עם תשובות סופיות בסוף כל קובץ\.$/);
  assert.match(visible, /השאלה השנייה נפתחת בדוגמה פתורה, ושתי השאלות האחרונות הן משוואות מיוחדות ובעיה מילולית על תלמידי כיתה\./);
  assert.match(visible, /בתחילת כל קובץ יש תזכורת, ובסופו עמוד תשובות סופיות\./);
  assert.doesNotMatch(visible, /בסוף כל דף|בתחילת הדף/);
  assert.doesNotMatch(visible, /רמה ג׳|רמזי|רמזים|נועם AI|\bWord\b|יחידה מלאה|כל יחידת|פתרונות מלאים|פתרון מלא/);
  assert.doesNotMatch(visible, /\d\s*\/\s*[\d(x]|x\s*\/\s*\d/);
  assert.deepEqual(extractJsonLdFaq(page.jsonLd), page.faqGroups.flatMap(group => group.items));
  const graph = page.jsonLd['@graph'] as Array<Record<string, unknown>>;
  const web = graph.find(item => item['@type'] === 'WebPage')!;
  const resource = graph.find(item => item['@type'] === 'LearningResource')!;
  assert.equal(web.url, `https://www.noamdoronmath.co.il/${slug}`);
  assert.equal(web.name, page.title);
  assert.equal(web.description, page.description);
  assert.equal(resource.description, page.description);
  assert.equal(resource.name, 'משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת');
  assert.equal(web.dateModified, '2026-11-17');
});

test('only self-check answers sit behind the reveal button; every scope paragraph stays visible', () => {
  // TopicPage hides paragraph 2 (and any paragraph opening with התשובה) in a section whose
  // heading has בדקו/בדיקה, ends with '?' or opens with חשבו/פתרו/מהו/באיזה/מצאו.
  const isCheck = (heading: string) => /בדקו|בדיקה/.test(heading) || /\?$/.test(heading) || /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(heading);
  const checks = page.sections.filter(section => isCheck(section.heading ?? ''));
  assert.deepEqual(checks.map(section => section.heading), ['בדקו את עצמכם']);
  const texts = checks[0].blocks.map(block => plain(block.text ?? ''));
  assert.equal(texts.length, 4);
  texts.forEach((text, i) => assert.equal(/^התשובה/.test(text), i % 2 === 1, text));
});

test('the worked example, self-check and lesson are correct and differ from the grade-8 page', () => {
  const text = page.sections.flatMap(section => section.blocks.map(block => block.text ?? '')).join('\n');
  // ⟨x¦3⟩ − ⟨x − 2¦4⟩ = 2 → 4x − 3(x − 2) = 24 → 4x − 3x + 6 = 24 → x = 18
  assert.ok(text.includes('פותרים את ⟨x¦3⟩ − ⟨x − 2¦4⟩ = 2.'));
  assert.ok(text.includes('4x − 3(x − 2) = 24') && text.includes('4x − 3x + 6 = 24') && text.includes('x + 6 = 24 ו־x = 18'));
  assert.ok(text.includes('⟨18¦3⟩ − ⟨16¦4⟩ = 6 − 4 = 2'));
  assert.equal(18 / 3 - (18 - 2) / 4, 2);
  assert.equal(4 * 18 - 3 * (18 - 2), 24);
  assert.equal(4 * 18 - 3 * 18 + 6, 24);
  // Minus before ⟨x + 5¦6⟩, times 6: −(x + 5) = −x − 5, never −x + 5.
  assert.ok(text.includes('אם לפני ⟨x + 5¦6⟩ יש מינוס וכופלים ב־6, מקבלים −(x + 5), כלומר −x − 5, ולא −x + 5.'));
  for (const x of [-3, 0, 2, 7.5]) {
    assert.equal(6 * -((x + 5) / 6), -x - 5);
    assert.notEqual(6 * -((x + 5) / 6), -x + 5);
  }
  // ⟨x + 4¦5⟩ = ⟨x¦2⟩ − 1 → 2(x + 4) = 5x − 10 → 3x = 18 → x = 6; ⟨2x¦4⟩ = ⟨x¦2⟩ + 1 has no solution.
  assert.ok(text.includes('פתרו: ⟨x + 4¦5⟩ = ⟨x¦2⟩ − 1.'));
  assert.ok(text.includes('התשובה היא x = 6: כופלים ב־10 ומקבלים 2(x + 4) = 5x − 10, כלומר 2x + 8 = 5x − 10, ולכן 3x = 18.'));
  assert.equal((6 + 4) / 5, 6 / 2 - 1);
  assert.equal(2 * (6 + 4), 5 * 6 - 10);
  assert.equal(3 * 6, 8 + 10);
  assert.ok(text.includes('האם יש פתרון למשוואה ⟨2x¦4⟩ = ⟨x¦2⟩ + 1?') && text.includes('אחרי כפל ב־4 מתקבל 2x = 2x + 4'));
  for (const x of [-3, 0, 2, 7.5]) assert.notEqual((2 * x) / 4, x / 2 + 1);
  // The page teaches that the parentheses are ADDED after multiplying by the common
  // denominator, so a fraction shown before that step keeps a bare numerator, as in the PDFs.
  assert.doesNotMatch(text, /⟨\([^()⟩]*\)¦/);
  assert.ok(text.includes('כופלים כל איבר ב־12, ושמים את המונה x − 2 בסוגריים, כי סימן החיסור חל על כל המונה'));
  // With the narrower bare fraction the line used to break inside that x − 2 (x | − 2 at 1440,
  // x − | 2 at 390). AGENTS.md: keep a formula on one line; TopicPage lists it in NOWRAP_MATH.
  const example = page.sections.find(section => section.heading === 'דוגמה פתורה: סימן חיסור לפני שבר')!.blocks[0].text!;
  const nowrapSource = readFileSync(new URL('../src/components/TopicPage.astro', import.meta.url), 'utf8')
    .match(/const NOWRAP_MATH = new Set\(\[(.*)\]\);/)![1];
  const nowrap = new Set([...nowrapSource.matchAll(/'([^']*)'/g)].map(match => match[1]));
  assert.ok(nowrap.has('x − 2'));
  const runs = topicTextParts(isolateMathRuns(example), nowrap).filter(part => part.text.startsWith('\u2066'));
  assert.deepEqual(runs.map(part => [plain(part.text), part.nowrap]), [['⟨x¦3⟩ − ⟨x − 2¦4⟩ = 2', true], ['3', false], ['4', false],
    ['12', false], ['12', false], ['x − 2', true], ['4x − 3(x − 2) = 24', false]]);
  const grade8 = JSON.parse(readFileSync(new URL('../src/data/topic-pages/equations-with-fractions-grade-8.json', import.meta.url), 'utf8'));
  const grade8Text = JSON.stringify(grade8.sections);
  for (const equation of ['⟨x¦4⟩ + ⟨x¦6⟩ = 5', '⟨x¦2⟩ − ⟨x¦5⟩ = 6']) {
    assert.ok(grade8Text.includes(equation));
    assert.ok(!text.includes(equation), `grade-9 page reuses ${equation}`);
  }

  const loop = topicLandingLoop(page);
  assert.deepEqual(loop, { kind: 'css', variant: 'minus-before-fraction', marker: 'minus-before-fraction' });
  const lesson = LESSON_LOOPS['minus-before-fraction'];
  assert.equal(lesson.picture, 'calculation', 'an equations page gets a calculation, never a drawing');
  const fractions = lessonMathParts(lesson.steps[0].math).filter(part => typeof part !== 'string');
  assert.deepEqual(fractions, [{ numerator: 'x', denominator: '3' }, { numerator: 'x − 2', denominator: '4' }]);
  // The lesson step says what the worked example says: multiply, then put the numerator in parentheses.
  // It names no expression, so the narrow phone step cannot break one across lines; the math line shows it.
  assert.equal(lesson.steps[1].text, 'כופלים כל איבר ב־12 ושמים את המונה בסוגריים');
  assert.ok(lesson.idea.includes('אחרי הכפל במכנה המשותף שמים את המונה בסוגריים'));
  for (const step of lesson.steps) assert.doesNotMatch(step.text, /[A-Za-z]/, step.text);
  assert.equal(lesson.steps[1].math, '4x − 3(x − 2) = 24');
  assert.equal(lesson.steps[2].math, 'x + 6 = 24; x = 18');
  for (const step of lesson.steps) assert.ok(!step.math.includes('/'), step.math);
});

test('related links are the authored reduced-track and review pages, after the grade hub', () => {
  assert.deepEqual(page.relatedTopics.map(rel => rel.path), ['/grade-9', '/distributive-law-grade-9',
    '/linear-function-grade-9', '/word-problems-grade-9', '/equations-with-fractions-grade-8']);
  for (const rel of page.relatedTopics) assert.equal(rel.productionHref, `https://www.noamdoronmath.co.il${rel.path}`);
});

test('the grade hub links the new reduced-track topic once, beside the other equation pages', () => {
  const hub = loadGradeHub(9);
  for (const links of [hub.topicLinks, hub.topicSections.flatMap(section => section.links)]) {
    assert.equal(links.filter(link => link.path === `/${slug}`).length, 1);
    const at = links.findIndex(link => link.path === `/${slug}`);
    assert.equal(links[at + 1].path, '/rational-equations-grade-9');
    assert.match(plain(links[at].label), /ט׳ מצומצמת/);
  }
  const algebra = hub.topicSections.find(section => section.heading === 'אלגברה ומשוואות')!;
  assert.ok(algebra.links.some(link => link.path === `/${slug}`));
});

test('the EQM49 fence reverses exactly the reviewed addition and rejects substitutions, moves, duplicates and edits', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
  const grade9 = (cat: any) => cat.grades.find((g: any) => g.grade === 9);
  const topicOf = (cat: any, id: number) => grade9(cat).topics.find((t: any) => t.id === id);
  const tampered = (change: (cat: any) => void) => { const cat = structuredClone(raw); change(cat); return cat; };
  // Each tamper must trip the fence's own named check (newer Node appends the diff to the message).
  const named = (message: string) => (error: unknown) => error instanceof assert.AssertionError && error.message.startsWith(message);
  const rejects = (change: (cat: any) => void, message: string) =>
    assert.throws(() => beforeEqm49Catalog(tampered(change)), named(message), message);

  // Control: the untouched catalog loses exactly topic 49, its search terms, r9jan and its trackGroups entry.
  const pristine = structuredClone(raw);
  const restored: any = beforeEqm49Catalog(raw);
  assert.deepEqual(raw, pristine, 'the fence works on a copy');
  const expected = structuredClone(raw);
  grade9(expected).topics = grade9(expected).topics.filter((t: any) => t.id !== 49);
  grade9(expected).groups = grade9(expected).groups.filter((g: any) => g.key !== 'r9jan');
  expected.config.trackGroups = ['r9oct', 'r9sep'];
  delete expected.searchTerms['9']['49'];
  assert.deepEqual(restored, expected);
  assert.equal(grade9(restored).topics.length, grade9(raw).topics.length - 1);
  assert.equal(restored.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.deepEqual(reviewedEqm49.pdfIds, PDF_IDS);
  // With EQM49 reversed first, the batch-03 fence still recovers its independently pinned baseline.
  assert.equal(digest(beforeBatch03Catalog(raw)), reviewedBatch03.baselineCatalogSha256);

  // Substituted, reordered, added or removed PDFs.
  rejects(cat => { topicOf(cat, 49).levels[0].pdfId = 'f8e4149d737746489f3866c6e9bfa807'; }, 'EQM49: reviewed PDFs');
  rejects(cat => { topicOf(cat, 49).levels.reverse(); }, 'EQM49: reviewed PDFs');
  rejects(cat => { topicOf(cat, 49).levels.pop(); }, 'EQM49: reviewed PDFs');
  rejects(cat => { topicOf(cat, 49).levels.push(structuredClone(topicOf(cat, 49).levels[0])); }, 'EQM49: reviewed PDFs');
  // The reviewed PDFs with any other topic field changed.
  rejects(cat => { topicOf(cat, 49).title = 'משוואות עם מכנים'; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).description += ' עם רמזי ופתרון מלא.'; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).group = 'r9oct'; }, 'EQM49: exact base topic');
  rejects(cat => { delete topicOf(cat, 49).publicationMode; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).noamTopicId = 'G9-T52'; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).routing.usesViewer = true; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).routing.aiHintShown = true; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).levels[2].label = 'רמה ג׳'; }, 'EQM49: exact base topic');
  rejects(cat => { topicOf(cat, 49).editions = [{ editionId: 'ms-unreviewed-r1' }]; }, 'EQM49: exact base topic');
  // Moved, duplicated or missing topic.
  rejects(cat => {
    const topics = grade9(cat).topics, at = topics.findIndex((t: any) => t.id === 49);
    [topics[at], topics[at + 1]] = [topics[at + 1], topics[at]];
  }, 'EQM49: reviewed position');
  rejects(cat => {
    const topics = grade9(cat).topics, at = topics.findIndex((t: any) => t.id === 49);
    topics.splice(1, 0, ...topics.splice(at, 1));
  }, 'EQM49: reviewed position');
  rejects(cat => { grade9(cat).topics.push(structuredClone(topicOf(cat, 49))); }, 'EQM49: exactly one topic 49');
  rejects(cat => { grade9(cat).topics = grade9(cat).topics.filter((t: any) => t.id !== 49); }, 'EQM49: exactly one topic 49');
  assert.throws(() => beforeEqm49Catalog(restored), named('EQM49: exactly one topic 49'), 'never reverses twice');
  // Search terms.
  rejects(cat => { cat.searchTerms['9']['49'] += ' רמזי'; }, 'EQM49: exact search terms');
  rejects(cat => { delete cat.searchTerms['9']['49']; }, 'EQM49: exact search terms');
  // The month group: label, track flag, position and uniqueness.
  rejects(cat => { grade9(cat).groups.at(-1).label = 'פברואר'; }, 'EQM49: r9jan is the last group');
  rejects(cat => { delete grade9(cat).groups.at(-1).reducedProgram; }, 'EQM49: r9jan is the last group');
  rejects(cat => { grade9(cat).groups.at(-1).reducedProgram = false; }, 'EQM49: r9jan is the last group');
  rejects(cat => { grade9(cat).groups.unshift(grade9(cat).groups.pop()); }, 'EQM49: r9jan is the last group');
  rejects(cat => { grade9(cat).groups.push({ key: 'r9feb', label: 'פברואר', reducedProgram: true }); }, 'EQM49: r9jan is the last group');
  rejects(cat => { grade9(cat).groups.pop(); }, 'EQM49: r9jan is the last group');
  rejects(cat => { grade9(cat).groups.unshift(structuredClone(grade9(cat).groups.at(-1))); }, 'EQM49: one r9jan group');
  // trackGroups: missing, reordered or extended.
  rejects(cat => { cat.config.trackGroups = ['r9oct', 'r9sep']; }, 'EQM49: exact trackGroups');
  rejects(cat => { cat.config.trackGroups = ['r9oct', 'r9jan', 'r9sep']; }, 'EQM49: exact trackGroups');
  rejects(cat => { cat.config.trackGroups.push('r9feb'); }, 'EQM49: exact trackGroups');

  // The fence reverses only topic 49. A change anywhere else passes through it untouched, so the
  // older fences in the chain reject it: the pinned pre-batch-03 catalog is no longer recovered.
  for (const change of [
    (cat: any) => { topicOf(cat, 36).levels[0].pdfId = 'old-link-changed'; },
    (cat: any) => { topicOf(cat, 37).group = 'r9jan'; },
    (cat: any) => { grade9(cat).topics.push({ ...structuredClone(topicOf(cat, 49)), id: 50 }); },
    (cat: any) => { cat.searchTerms['9']['36'] += ' ינואר'; },
    (cat: any) => { grade9(cat).groups.find((g: any) => g.key === 'r9oct').label = 'ינואר'; },
  ]) {
    const cat = tampered(change);
    let recovered: string | null = null;
    try { recovered = digest(beforeBatch03Catalog(cat)); } catch { /* an older fence threw: rejected */ }
    assert.notEqual(recovered, reviewedBatch03.baselineCatalogSha256);
  }
});
