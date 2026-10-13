/**
 * Live SSR title+href order helpers must reject truncated 15-card archives.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseSsrCards,
  diffArchiveCardOrder,
  fetchLiveArchiveCardIndex,
  ARCHIVE_PATHS,
} from '../scripts/lib/blog-archive-ssr.mjs';
import { listBlogArchives } from '../src/lib/blogArchives';

describe('M26 live SSR archive card index', () => {
  it('parseSsrCards returns 20 post cards from live /blog HTML', async () => {
    const res = await fetch('https://www.noamdoronmath.co.il/blog', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; m26-unit)', accept: 'text/html' },
      redirect: 'follow',
    });
    assert.equal(
      res.ok,
      true,
      `HTTP ${res.status} ctype=${res.headers.get('content-type')} final=${res.url}`
    );
    const ctype = res.headers.get('content-type') || '';
    assert.match(ctype, /text\/html/i);
    const html = await res.text();
    // Empty successful HTML must fail parity — do not treat 0 cards as pass.
    const cards = parseSsrCards(html);
    assert.equal(
      cards.length,
      20,
      `expected 20 SSR cards on /blog; got ${cards.length} bytes=${html.length} hooks=${(html.match(/data-hook="post-list-item"/gi) || []).length}`
    );
    assert.ok(cards.every((c) => c.title && /\/post\//.test(c.href)));
  });

  it('diffArchiveCardOrder fails when served only has first 15 of live 20', async () => {
    const live = await fetchLiveArchiveCardIndex('/blog');
    assert.equal(
      live.count,
      20,
      `live /blog count ${live.count}; http=${JSON.stringify(live.http)}`
    );
    const truncated = live.cards.slice(0, 15);
    const issues = diffArchiveCardOrder(live, truncated, 'truncated');
    assert.ok(issues.length >= 1, 'must detect omission');
    assert.ok(
      issues.some((i) => /card count 15 != live SSR 20|omitted live href|missing live SSR/.test(i)),
      issues.join(' | ')
    );
  });

  it('fixtures match live SSR title+href order for all 4 archives', async () => {
    for (const spec of ARCHIVE_PATHS) {
      const live = await fetchLiveArchiveCardIndex(spec.path);
      const fixture = listBlogArchives().find((a) => a.path === spec.path);
      assert.ok(fixture, spec.path);
      const issues = diffArchiveCardOrder(live, fixture!.cards, 'fixture');
      assert.equal(issues.length, 0, `${spec.path}: ${issues.join(' | ')}`);
    }
  });
});
