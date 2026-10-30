/**
 * Live SSR title+href order must match every card in the published archive.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  diffArchiveCardOrder,
  createLiveArchiveSnapshotReader,
  ARCHIVE_PATHS,
} from '../scripts/lib/blog-archive-ssr.mjs';
import { listBlogArchives } from '../src/lib/blogArchives';

describe('M26 live SSR archive card index', () => {
  // Reuse one fetched response for all assertions; failures are also shared.
  // Pace distinct archive requests and stop the queue on a refusal.
  const liveSnapshot = createLiveArchiveSnapshotReader({ minIntervalMs: 5000 });
  it('parseSsrCards returns every bundled post card from live /blog HTML', async () => {
    const live = await liveSnapshot('/blog');
    assert.equal(live.http.status, 200);
    assert.match(live.http.contentType, /text\/html/i);
    // Empty successful HTML must fail parity — do not treat 0 cards as pass.
    const cards = live.cards;
    const expected = listBlogArchives().find((archive) => archive.path === '/blog')!.cards.length;
    assert.ok(expected >= 20, 'The published archive must retain at least the original 20 cards');
    assert.equal(
      cards.length,
      expected,
      `expected ${expected} SSR cards on /blog; got ${cards.length} bytes=${live.http.bytes}`
    );
    assert.ok(cards.every((c) => c.title && /\/post\//.test(c.href)));
  });

  it('diffArchiveCardOrder fails when served only has the first 15 live cards', async () => {
    const live = await liveSnapshot('/blog');
    const expected = listBlogArchives().find((archive) => archive.path === '/blog')!.cards.length;
    assert.equal(
      live.count,
      expected,
      `live /blog count ${live.count}; http=${JSON.stringify(live.http)}`
    );
    const truncated = live.cards.slice(0, 15);
    const issues = diffArchiveCardOrder(live, truncated, 'truncated');
    assert.ok(issues.length >= 1, 'must detect omission');
    assert.ok(
      issues.some((i) => /card count 15 != live SSR|omitted live href|missing live SSR/.test(i)),
      issues.join(' | ')
    );
  });

  it('fixtures match live SSR title+href order for all 4 archives', async () => {
    for (const spec of ARCHIVE_PATHS) {
      const live = await liveSnapshot(spec.path);
      const fixture = listBlogArchives().find((a) => a.path === spec.path);
      assert.ok(fixture, spec.path);
      const issues = diffArchiveCardOrder(live, fixture!.cards, 'fixture');
      assert.equal(issues.length, 0, `${spec.path}: ${issues.join(' | ')}`);
    }
  });
});
