import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { it } from 'node:test';
const require = createRequire(import.meta.url);
const { resolve } = require('../public/noam-catalog-migration.js');
const map = JSON.parse(readFileSync(new URL('../public/noam-ai/catalog-migrations.json', import.meta.url), 'utf8'));
it('every legacy catalog link migrates a complete validated sheet and level bundle', () => {
  for (const [oldPdf, t] of Object.entries(map.byPdf) as [string, any][]) {
    const u = new URL('https://www.noamdoronmath.co.il/worksheet-viewer-noam.html');
    u.search = new URLSearchParams({ pdf: oldPdf, x: t.original.prefix, g: String(t.original.grade), lv: t.original.level, back: '/worksheets?grade=9', pb: oldPdf, question: 'old-question' }).toString();
    const next = new URL(resolve(u.href, map));
    assert.equal(next.origin, u.origin); assert.equal(next.searchParams.get('pdf'), t.pdfId);
    assert.equal(next.searchParams.get('x'), t.prefix); assert.equal(next.searchParams.get('g'), String(t.grade));
    assert.equal(next.searchParams.get('lv'), t.level); assert.equal(next.searchParams.get('back'), '/worksheets?grade=9');
    assert.equal(next.searchParams.get('question'), null);
    for (const key of ['pa','pb','pc','pc2']) assert.equal(next.searchParams.get(key), t.siblings[key] || null);
    assert.equal(resolve(next.href, map), null, 'must not redirect repeatedly');
    u.searchParams.set('x', 'G7-T99'); assert.equal(resolve(u.href, map), null, 'wrong sheet prefix must not be paired');
  }
});
it('migration cannot accept cross-site targets, invalid identifiers or unrelated pages', () => {
  assert.equal(resolve('https://example.org/anything?pdf=4426507db7244da896af971abf7b975b', map), null);
  assert.equal(resolve('javascript:alert(1)', map), null);
  const data = { schemaVersion: 1, byPdf: { a: { pdfId: 'https://evil.org' } } };
  assert.equal(resolve('https://www.noamdoronmath.co.il/worksheet-viewer-noam.html?pdf=a', data), null);
});

it('source-reused sheets return to their original catalog and repair every sibling', () => {
  for (const [oldPdf, t] of Object.entries(map.byPdf) as [string, any][]) {
    const u = new URL('https://www.noamdoronmath.co.il/worksheet-viewer-noam.html');
    u.search = new URLSearchParams({pdf:oldPdf,x:t.original.prefix,g:String(t.original.grade),lv:t.original.level,pc2:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}).toString();
    const next = new URL(resolve(u.href,map));
    assert.equal(next.searchParams.get('back'), '/worksheets?grade='+t.original.grade);
    assert.equal(next.searchParams.get('topic'), String(t.topicId));
    assert.equal(next.searchParams.get('pc2'), t.siblings.pc2 || null);
  }
});
