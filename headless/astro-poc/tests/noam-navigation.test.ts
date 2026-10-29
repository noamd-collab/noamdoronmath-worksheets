import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { navigateSite, navigationHelp } from '../public/noam-navigation.js';
const guide = JSON.parse(readFileSync(new URL('../public/noam-navigation-guide.json', import.meta.url), 'utf8'));
const ask = (message: string, page = {kind:'home', path:'/'}, previous = '') => navigateSite({message, page}, guide, previous);
const hrefs = (r: any) => [r.primary, ...r.chips].filter(Boolean).map(x => x.href);

test('kite navigation needs no AI, bot config or credentials', () => {
  for (const q of ['איפה יש דפי עבודה על דלתון לכיתה ט?', 'דלתון', 'קח אותי לדלתון בכיתה ט׳']) {
    const r = ask(q);
    assert.equal(r.ok, true);
    assert.equal(r.model, null);
    assert.ok(hrefs(r).includes('/kite-grade-9'), q);
  }
});
test('sections navigate to actual guide URLs', () => {
  for (const [q, path] of [['איפה הבלוג?', '/blog'], ['אני רוצה מחשבון', '/math-tools'], ['משחק', '/games/kefel-mekutsar-2'], ['הלמידה שלי', '/learning.html'], ['דפי עבודה לכיתה ג', '/worksheets?grade=3']]) {
    assert.equal(ask(q).primary.href, path);
  }
});
test('an ambiguous topic can be narrowed by a grade follow-up', () => {
  assert.match(ask('שברים').answer, /באיזו כיתה/);
  const r = ask('כיתה ה', undefined, 'שברים');
  assert.ok(r.primary);
  for (const link of r.links) {
    const record = guide.records.find((x: any) => x.id === link.id);
    assert.equal(record.grade, 5);
    assert.match(record.title + ' ' + record.topic, /שבר/);
  }
});
test('explicit grade wins over the open page; unknown topics are not arbitrary grade matches', () => {
  const r = ask('שברים לכיתה ג', {kind:'topic', path:'/kite-grade-9'});
  assert.ok(r.links.length);
  for (const link of [r.primary, ...r.chips].filter(Boolean)) assert.match(link.label, /כיתה ג/);
  const missing = ask('טופולוגיה לכיתה ט');
  assert.equal(missing.source, 'navigation-clarify');
  assert.equal(missing.primary.href, '/worksheets?grade=9');
});
test('teacher building and solving retain their existing flows', () => {
  assert.equal(ask('שיעור של 30 דקות', {kind:'teachers',path:'/teachers'}), null);
  assert.equal(ask('איך פותרים את שאלה 4', {kind:'worksheet',path:'/worksheet-viewer-noam.html'}), null);
});
test('greetings and service failures always offer real links', () => {
  for (const r of [ask('שלום'), ask('מה אתה עושה'), navigationHelp(guide, true)]) {
    assert.ok(r.primary);
    assert.equal(r.primary.href, '/worksheets');
    assert.ok(r.chips.length);
    for (const h of hrefs(r)) assert.ok(guide.records.some((x: any) => x.href === h));
  }
});
test('reject unsafe hrefs and deduplicate navigation choices', () => {
  const data = {records:[{id:'bad',type:'topic',title:'דלתון',href:'javascript:alert(1)'}, {id:'bad2',type:'topic',title:'דלתון',href:'//evil.test'}, ...guide.records]};
  const r = navigateSite({message:'דלתון'}, data);
  assert.equal(r.primary.href, '/kite-grade-9');
  assert.equal(new Set(hrefs(r)).size, hrefs(r).length);
});
test('next-topic and quadrilateral navigation retain catalog order without AI', () => {
  const page = {kind:'topic',path:'/kite-grade-9'};
  const next = ask('מה הנושא הבא?', page);
  assert.equal(next.chips[0].href, '/parallelogram-grade-9');
  const group = ask('יש מרובעים?', page);
  assert.equal(group.source, 'topic-order');
  assert.equal(group.chips[0].href, '/kite-grade-9');
  assert.ok(group.chips.every((r: any) => r.label.includes('ט׳')));
});

test('natural Hebrew topic names match titles with a definite article', () => {
  for (const q of ['מלבן לכיתה ט', 'תעביר אותי למקבילית לכיתה ט']) {
    const r = ask(q);
    assert.equal(r.source, 'site-navigation');
    assert.ok(r.primary.href.includes(q.includes('מלבן') ? 'rectangle' : 'parallelogram'));
  }
  assert.equal(ask('שברים').needsGrade, true);
  assert.equal(ask('דלתון לכיתה ט').needsGrade, false);
});

test('every published topic title finds its own page, never an unrelated group', () => {
  const topics = guide.records.filter((r: any) => r.type === 'topic');
  assert.ok(topics.length >= 96, 'expected at least the original 96 topics, got ' + topics.length);
  for (const topic of topics) assert.ok(hrefs(ask(topic.title)).includes(topic.href), topic.title);
});

test('navigation cache version tracks both the generated index and code', () => {
  const body = readFileSync(new URL('../public/noam-navigation-guide.json', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../public/noam-navigation.js', import.meta.url), 'utf8');
  const version = createHash('sha256').update(body).update(code).digest('hex').slice(0,16);
  const client = readFileSync(new URL('../public/noam-site-companion.js', import.meta.url), 'utf8');
  assert.ok(client.includes('noam-navigation.js?v=' + version));
  assert.ok(client.includes('noam-navigation-guide.json?v=' + version));
});

// Reported live failure: "אני מחפש דפים לכיתה ט׳...".
test('plain Hebrew requests for sheets open the grade catalog', () => {
  for (const q of [
    'אני מחפש דפים לכיתה ט׳...',
    'אני מחפשת דפים לכיתה ט',
    'אפשר דף לכיתה ט?',
    'יש לכם דפים במתמטיקה לכיתה ט׳?',
    'אני רוצה דפים לתרגול בכיתה ט',
    'דפי תרגול לכיתה ט',
  ]) {
    const r = ask(q);
    assert.equal(r.source, 'site-navigation', q);
    assert.equal(r.primary.href, '/worksheets?grade=9', q);
    assert.doesNotMatch(r.answer, /לא מצאתי/, q);
  }
  assert.equal(ask('יש לכם דפים?').primary.href, '/worksheets');
  assert.equal(ask('דף').primary.href, '/worksheets');
  assert.equal(ask('ט׳').primary.href, '/worksheets?grade=9');
});
test('a requested level B sheet is not replaced by level A', () => {
  const r = ask('אני מחפש דפים לכיתה ט׳ על פירוק לגורמים, רמה ב׳');
  assert.equal(r.source, 'site-navigation');
  assert.match(r.primary.label, /רמה ב׳/);
  assert.match(r.primary.href, /lv=b/);
  assert.doesNotMatch(r.primary.href, /lv=a/);
  const factoringB = guide.records.find((record: any) => record.id === 'g9-t2-b');
  assert.ok(factoringB);
  assert.equal(r.primary.href, factoringB.href);
  const hrefs = [r.primary, ...r.chips].filter(Boolean).map((link) => link.href);
  assert.ok(hrefs.includes('/factoring-grade-9'));
  assert.equal(hrefs.some((href) => href.includes('lv=a')), false);
  assert.doesNotMatch(r.answer, /רמה א/);
  const english = ask('אני מחפש דפים לכיתה ט על פירוק לגורמים level B');
  assert.match(english.primary.href, /lv=b/);
  assert.equal([english.primary, ...english.chips].some((link) => link.href.includes('lv=a')), false);
});

test('sheet wording preserves a requested topic and grade-only follow-ups', () => {
  const kite = ask('אני מחפש דפים על דלתון לכיתה ט׳');
  assert.match(kite.primary.href, /lv=a/);
  assert.ok(hrefs(kite).includes('/kite-grade-9'));
  assert.equal(ask('אני מחפש דפים על שברים').needsGrade, true);
  const r = ask('ה׳', undefined, 'אני מחפש דפים על שברים');
  assert.ok(r.links.length);
  for (const link of r.links) {
    const row = guide.records.find((x: any) => x.id === link.id);
    assert.equal(row.grade, 5);
    assert.match(row.title + ' ' + row.topic, /שבר/);
  }
  assert.equal(ask('דפים על טופולוגיה לכיתה ט').source, 'navigation-clarify');
});
