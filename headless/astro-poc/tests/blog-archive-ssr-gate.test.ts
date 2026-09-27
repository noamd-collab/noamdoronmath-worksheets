/**
 * Live-SSR suite: production /blog currently ships the same truncated Headless
 * archive, so "match live SSR card count" is no longer a preservation oracle.
 * Keep parse/diff helpers covered; inventory completeness lives in unit tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseSsrCards,
  diffArchiveCardOrder,
  fetchLiveArchiveCardIndex,
} from '../scripts/lib/blog-archive-ssr.mjs';
import { listAllArchiveListingPaths } from '../src/lib/blogArchiveBuild';
import { listServedBlogPosts } from '../src/lib/blogPosts';

describe('M26 archive helpers (live network, non-oracle)', () => {
  it('parseSsrCards extracts post cards from live /blog HTML', async () => {
    const res = await fetch('https://www.noamdoronmath.co.il/blog', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; m26-unit)', accept: 'text/html' },
      redirect: 'follow',
    });
    assert.equal(res.ok, true, `HTTP ${res.status}`);
    const html = await res.text();
    const cards = parseSsrCards(html);
    assert.ok(cards.length >= 1, `expected some cards; got ${cards.length}`);
    assert.ok(cards.every((c) => c.title && /\/post\//.test(c.href)));
    // Document truncation symptom when production still serves Headless snapshot.
    if (cards.length === 20) {
      assert.ok(
        listServedBlogPosts().length > 20,
        'live still shows 20 while inventory is larger — archive rebuild required'
      );
    }
  });

  it('diffArchiveCardOrder still fails on truncated subsets', async () => {
    const live = await fetchLiveArchiveCardIndex('/blog');
    assert.ok(live.count >= 1, `live /blog count ${live.count}`);
    if (live.count >= 2) {
      const truncated = live.cards.slice(0, Math.max(1, live.count - 1));
      const issues = diffArchiveCardOrder(live, truncated, 'truncated');
      assert.ok(issues.length >= 1, 'must detect omission');
    }
  });

  it('local inventory listing is a superset of currently visible live cards', async () => {
    const live = await fetchLiveArchiveCardIndex('/blog');
    const { indexPaths } = listAllArchiveListingPaths();
    const local = new Set(indexPaths);
    const missing = live.cards
      .map((c) => {
        try {
          return decodeURIComponent(new URL(c.href).pathname).replace(/\/$/, '') || '/';
        } catch {
          return '';
        }
      })
      .filter((p) => p && !local.has(p));
    assert.deepEqual(missing, [], `live cards missing from inventory listing: ${missing.join(', ')}`);
  });
});
