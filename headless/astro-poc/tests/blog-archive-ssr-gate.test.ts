/** Live SSR parity uses the complete current archive, never a historical card cap. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  diffArchiveCardOrder,
  fetchLiveArchiveCardIndex,
  ARCHIVE_PATHS,
} from '../scripts/lib/blog-archive-ssr.mjs';
import { listBlogArchives } from '../src/lib/blogArchives';

// One read per archive per run, paced to avoid repeated requests to /blog.
// A failed read rejects later reads too: a server refusal must not trigger a burst.
const reads = new Map<string, ReturnType<typeof fetchLiveArchiveCardIndex>>();
let queue = Promise.resolve();
let lastRequest = 0;
function liveArchive(path: string) {
  if (!reads.has(path)) {
    const read = queue.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 5000 - (Date.now() - lastRequest))));
      lastRequest = Date.now();
      return fetchLiveArchiveCardIndex(path);
    });
    reads.set(path, read);
    queue = read.then(() => undefined);
    // Keep the queue rejected for subsequent reads without an unhandled rejection.
    void queue.catch(() => {});
  }
  return reads.get(path)!;
}

describe('live SSR archive card index', () => {
  it('returns every current /blog card with a title and canonical post link', async () => {
    const fixture = listBlogArchives().find((a) => a.path === '/blog')!;
    assert.ok(fixture.cards.length > 15, 'fixture must exercise truncation detection');
    const live = await liveArchive('/blog');
    assert.equal(live.count, fixture.cards.length, JSON.stringify(live.http));
    assert.ok(live.cards.every((c) => c.title && /\/post\//.test(c.href)));
  });

  it('rejects serving only the first 15 live cards', async () => {
    const live = await liveArchive('/blog');
    assert.ok(live.count > 15);
    const issues = diffArchiveCardOrder(live, live.cards.slice(0, 15), 'truncated');
    assert.ok(issues.some((issue) => /card count|omitted live href|missing live SSR/.test(issue)), issues.join(' | '));
  });

  it('fixtures match exact live title and href order for all four archives', async () => {
    for (const spec of ARCHIVE_PATHS) {
      const live = await liveArchive(spec.path);
      const fixture = listBlogArchives().find((a) => a.path === spec.path);
      assert.ok(fixture, spec.path);
      const issues = diffArchiveCardOrder(live, fixture.cards, 'fixture');
      assert.deepEqual(issues, [], `${spec.path}: ${issues.join(' | ')}`);
    }
  });
});
