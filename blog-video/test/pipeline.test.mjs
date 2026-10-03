import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage, listPackages, loadGlossary, readScript } from '../lib/pipeline.mjs';
import { loadPosts } from '../lib/source.mjs';

const g = loadGlossary();
const posts = new Map(loadPosts().map(({ post }) => [post.fileSlug, post]));
const post = posts.get('order-of-operations-guide');
const base = readScript(listPackages().find((p) => p.postId === 'order-of-operations-guide' && p.variant === 'short').scriptPath);

function run(mutate) {
  const s = structuredClone(base);
  mutate(s);
  const dir = mkdtempSync(join(tmpdir(), 'bv-'));
  const scriptPath = join(dir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(s));
  return checkPackage({ postId: s.postId, variant: s.variant, dir, scriptPath }, post, g);
}
const has = (res, re) => res.errors.some((e) => re.test(e));

test('all committed pilot packages pass with no errors', () => {
  for (const pkg of listPackages()) {
    const res = checkPackage(pkg, posts.get(pkg.postId), g);
    assert.deepEqual(res.errors, [], `${pkg.postId}/${pkg.variant}`);
  }
});

test('injected: wrong final answer on screen and in the caption', () => {
  const res = run((s) => { const x = s.segments.find((q) => q.id === 'solve'); x.caption = x.caption.replace('{{8 + 6 = 14}}', '{{8 + 6 = 15}}'); });
  assert.ok(has(res, /8 \+ 6 = 15.*wrong/));
});

test('injected: spoken answer differs from the display', () => {
  const res = run((s) => { const x = s.segments.find((q) => q.id === 'solve'); x.spoken = x.spoken.replace('שמונה ועוד שש שווה ארבע עשרה', 'שמונה ועוד שש שווה שלושים'); x.math[1].spoken = 'שמונה ועוד שש שווה שלושים'; });
  assert.ok(has(res, /spoken math does not match/));
});

test('injected: flipped sign in a formula', () => {
  const res = run((s) => { s.segments.find((q) => q.id === 'solve').screen.push({ kind: 'formula', text: '−3² = 9' }); });
  assert.ok(has(res, /−3² = 9.*wrong/));
});

test('injected: a shown mistake that is actually true is rejected', () => {
  const res = run((s) => { s.segments[0].screen.push({ kind: 'formula', text: '8 + 2 × 3 = 14', expect: 'false' }); });
  assert.ok(has(res, /marked as a shown mistake but is not false/));
});

test('injected: missing condition — a segment with no source reference', () => {
  const res = run((s) => { s.segments.find((q) => q.id === 'same-rank').refs = []; });
  assert.ok(has(res, /no source reference/));
});

test('injected: reference to a block that does not exist', () => {
  const res = run((s) => { s.segments[0].refs = ['b999']; });
  assert.ok(has(res, /b999 does not exist/));
});

test('injected: digits and a unit symbol in the narration', () => {
  const res = run((s) => { s.segments[0].spoken = 'התרגיל 8 + 2 × 3 ס״מ'; });
  assert.ok(has(res, /digit in spoken text/));
  assert.ok(has(res, /math\/markup symbol/));
});

test('injected: caption differs from speech without a documented reason', () => {
  const res = run((s) => { delete s.segments[0].captionDiff; });
  assert.ok(has(res, /without a documented captionDiff/));
});

test('injected: formula in a caption without LTR isolation', () => {
  const res = run((s) => { s.segments[0].caption = 'התרגיל 8 + 2 × 3 נראה קצר.'; });
  assert.ok(has(res, /outside an LTR isolate/));
});

test('injected: pointed word that is not in the glossary', () => {
  const res = run((s) => { s.segments[0].niqqudOverrides = { 'התרגיל': 'הַתַּרְגִּיל' }; });
  assert.ok(has(res, /override for התרגיל has no niqqudReason/));
});

test('injected: script far too long for its target length', () => {
  const res = run((s) => { s.segments.push(...structuredClone(s.segments).map((x) => ({ ...x, id: `${x.id}-2` }))); });
  assert.ok(has(res, /outside 45–60s/));
});

test('a correct example worded differently is not rejected', () => {
  const res = run((s) => {
    const x = s.segments.find((q) => q.id === 'solve');
    x.spoken = 'אין כאן סוגריים ואין חזקות, ולכן מתחילים בכפל: שתיים כפול שלוש זה שש. ואחר כך שמונה ועוד שש זה ארבע עשרה.';
    x.math = [{ spoken: 'שתיים כפול שלוש זה שש', display: '2 × 3 = 6' }, { spoken: 'שמונה ועוד שש זה ארבע עשרה', display: '8 + 6 = 14' }];
  });
  assert.deepEqual(res.errors, []);
});

test('a source edit re-opens review; an untouched source keeps it current', () => {
  const pkg = listPackages().find((p) => p.postId === 'order-of-operations-guide' && p.variant === 'short');
  assert.equal(checkPackage(pkg, post, g).review, 'current');
  const edited = structuredClone(post);
  edited.blocks[0].text = edited.blocks[0].text.replace('30 או 14', '30 או 15');
  assert.equal(checkPackage(pkg, edited, g).review, 'cited-source-changed');
  const elsewhere = structuredClone(post);
  elsewhere.blocks.at(-1).text += ' ';
  assert.equal(checkPackage(pkg, elsewhere, g).review, 'post-changed-elsewhere');
});
