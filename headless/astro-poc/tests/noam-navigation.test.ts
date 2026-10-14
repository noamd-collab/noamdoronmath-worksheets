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
