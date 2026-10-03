import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { buildAll } from '../lib/build.mjs';
import { VIDEO_ROOT } from '../lib/source.mjs';

const built = buildAll();

test('build has no errors', () => assert.deepEqual(built.errors, []));

test('every generated file is committed and up to date (run bin/build.mjs)', () => {
  for (const [p, content] of built.files) {
    const rel = relative(VIDEO_ROOT, p);
    assert.ok(existsSync(p), `${rel} missing`);
    assert.equal(readFileSync(p, 'utf8'), content, `${rel} is stale`);
  }
});

test('inventory covers every post exactly once', () => {
  const ids = built.inventory.posts.map((p) => p.postId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, built.inventory.totals.posts);
  for (const p of built.inventory.posts) assert.match(p.canonicalUrl, /^https:\/\/www\.noamdoronmath\.co\.il\/post\//);
});

test('manifest ids are stable and unique; nothing is marked published or approved by the build', () => {
  const ids = built.manifest.videos.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const v of built.manifest.videos) {
    assert.equal(v.id, `${v.postId}--${v.variant}`);
    assert.notEqual(v.contentStatus, 'noam-approved');
    for (const n of Object.values(v.publish)) assert.notEqual(n.status, 'published');
    assert.equal(v.measuredSeconds, null);
  }
});

test('narration strips to the unpointed script, captions carry no niqqud', () => {
  for (const [p, content] of built.files) {
    if (p.endsWith('captions.he.txt')) assert.doesNotMatch(content, /[ְ-ׇּׁׂ]/);
  }
});

import { loadBriefs } from '../lib/inventory.mjs';
test('every brief belongs to a real post and cites existing blocks', async () => {
  const { loadPosts, sourceBlocks } = await import('../lib/source.mjs');
  const posts = new Map(loadPosts().map(({ post }) => [post.fileSlug, new Set(sourceBlocks(post).map((b) => b.id))]));
  for (const [id, b] of Object.entries(loadBriefs().posts)) {
    assert.ok(posts.has(id), `brief for unknown post ${id}`);
    assert.equal(b.readStatus, 'read-full', id);
    for (const m of b.mathCheck || []) {
      for (const ref of String(m.ref).match(/b\d+/g) || []) assert.ok(posts.get(id).has(ref), `${id}: ${ref} not in post`);
    }
  }
});
