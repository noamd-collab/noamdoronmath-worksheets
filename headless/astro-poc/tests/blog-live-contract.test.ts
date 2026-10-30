/** Offline negative controls for the public blog gates; these make no HTTP calls. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSsrCards, diffArchiveCardOrder, fetchLiveArchiveCardIndex, PROD } from '../scripts/lib/blog-archive-ssr.mjs';
import { parseBlogSitemap, diffBlogSitemap, fetchBlogSitemap } from '../scripts/lib/blog-live-sitemap.mjs';
import { renderBlogSitemapXml, listBlogSitemapEntries } from '../src/lib/blogSitemap';

function card(index: number) {
  return `<article data-blog-archive-card>
    <a href="/post/media-${index}"><img alt="not the title"></a>
    <h2><a data-blog-archive-card-link href="/post/card-${index}">כותרת <span>${index}</span> &amp; עוד</a></h2>
    <p data-blog-archive-card-excerpt>תיאור ${index}</p>
    <span data-blog-archive-card-author>נועם</span><time data-blog-archive-card-date>2026-10-30</time>
    <img class="blog-archive__card-avatar" src="/avatar.png" alt="תמונת הסופר">
    <ul class="blog-archive__card-cats"><li><a href="/blog/categories/elementary-math">יסודי</a></li></ul>
  </article>`;
}
function archive(cards: string) {
  return `<a href="/post/decoy">outside</a><main data-blog-archive="blog-index"><section data-blog-archive-list>${cards}</section></main>${card(999)}`;
}
const sampleCards = Array.from({ length: 20 }, (_, index) => card(index)).join('');
function indexFor(cards: ReturnType<typeof parseSsrCards>) {
  const indexed = cards.map((entry) => ({ ...entry, pathname: new URL(entry.href).pathname }));
  return { path: '/blog', count: cards.length, cards: indexed, pathnames: indexed.map((entry) => entry.pathname) };
}
const expectedSitemap = [
  { loc: `${PROD}/blog`, lastmod: '2026-10-30' },
  { loc: `${PROD}/post/פוסט`, lastmod: '2026-10-29' },
];

describe('archive SSR parser contract', () => {
  it('reads only complete ordered Astro cards and their heading link', () => {
    const cards = parseSsrCards(archive(sampleCards));
    assert.equal(cards.length, 20);
    assert.deepEqual(cards.map((entry) => entry.href), Array.from({ length: 20 }, (_, i) => `${PROD}/post/card-${i}`));
    assert.equal(cards[0].title, 'כותרת 0 & עוד');
    assert.equal(cards[0].excerpt, 'תיאור 0');
    assert.equal(cards[0].author, 'נועם');
    assert.equal(cards[0].date, '2026-10-30');
    assert.deepEqual(cards[0].categories, [{ text: 'יסודי', href: `${PROD}/blog/categories/elementary-math` }]);
  });

  it('rejects truncation, reordering, renamed titles and duplicate cards', () => {
    const cards = parseSsrCards(archive(sampleCards));
    const live = indexFor(cards);
    assert.deepEqual(diffArchiveCardOrder(live, cards), []);
    for (const invalid of [cards.slice(0, 15), [...cards].reverse(), [{ ...cards[0], title: 'wrong title' }, ...cards.slice(1)], [...cards, cards[0]]]) {
      assert.ok(diffArchiveCardOrder(live, invalid).length);
    }
    const duplicated = parseSsrCards(archive(card(0) + card(0)));
    assert.equal(duplicated.length, 2, 'duplicates must not disappear during parsing');
    assert.ok(diffArchiveCardOrder(indexFor(duplicated), duplicated).some((issue) => /duplicate/i.test(issue)));
    assert.ok(diffArchiveCardOrder(indexFor([]), []).length);
  });

  it('fails closed on incomplete Astro cards instead of inferring a title from media', () => {
    for (const invalid of [card(0).replace('data-blog-archive-card-link', 'other-link'), card(0).replace('/post/card-0', 'https://example.com/post/card-0'), '<article data-blog-archive-card><a href="/post/media">media</a></article>']) {
      assert.throws(() => parseSsrCards(archive(invalid)), /Invalid Astro SSR archive card/);
    }
    assert.deepEqual(parseSsrCards('<main data-blog-archive="blog-index"></main>'), []);
    assert.deepEqual(parseSsrCards('<a href="/post/unrelated">No archive</a>'), []);
  });

  it('retains historical Wix fixture parsing without requiring old selectors on Astro', () => {
    const cards = parseSsrCards('<article data-hook="post-list-item"><a href="/post/old"><div data-hook="post-title"><h2>Old &amp; title</h2></div></a></article>');
    assert.equal(cards.length, 1);
    assert.equal(cards[0].title, 'Old & title');
    assert.equal(cards[0].href, `${PROD}/post/old`);
  });

  it('does not accept HTTP errors, a non-HTML body or an empty archive', async () => {
    for (const response of [new Response('no', { status: 404 }), new Response('{}', { headers: { 'content-type': 'application/json' } }), new Response(archive(''), { headers: { 'content-type': 'text/html' } })]) {
      await assert.rejects(fetchLiveArchiveCardIndex('/blog', { fetch: async () => response }));
    }
    let requests = 0;
    await assert.rejects(fetchLiveArchiveCardIndex('/blog', {
      attempts: 3,
      fetch: async () => { requests++; return new Response('rate limit', { status: 429, headers: { 'retry-after': '60' } }); },
    }), /HTTP 429.*retry-after=60/);
    assert.equal(requests, 1, 'a refusal must not be retried by the gate');
  });
});

describe('blog sitemap live contract', () => {
  it('matches the full locally rendered sitemap and decodes Hebrew paths', () => {
    const parsed = parseBlogSitemap(renderBlogSitemapXml(expectedSitemap));
    assert.deepEqual(parsed, [{ pathname: '/blog', lastmod: '2026-10-30' }, { pathname: '/post/פוסט', lastmod: '2026-10-29' }]);
    assert.deepEqual(diffBlogSitemap(parsed, expectedSitemap), []);
    const all = listBlogSitemapEntries();
    assert.ok(all.length > 60);
    assert.deepEqual(diffBlogSitemap(parseBlogSitemap(renderBlogSitemapXml(all)), all), []);
  });

  it('rejects empty, malformed, duplicate, noncanonical and non-blog sitemap entries', () => {
    const valid = renderBlogSitemapXml(expectedSitemap);
    for (const xml of [
      renderBlogSitemapXml([]), '<html><body>not a sitemap</body></html>',
      valid.replace('</url>', ''), valid.replace('<lastmod>2026-10-30</lastmod>', ''),
      valid.replace('/post/פוסט', '/post/unescaped&name'),
      renderBlogSitemapXml([...expectedSitemap, expectedSitemap[0]]),
      ...['https://example.com/post/post', `${PROD}/post/post?x=1`, `${PROD}/post/post#x`, `${PROD}/other`, 'https://user:secret@www.noamdoronmath.co.il/post/post'].map((loc) => renderBlogSitemapXml([{ loc, lastmod: '2026-10-30' }])),
    ]) assert.throws(() => parseBlogSitemap(xml));
  });

  it('detects missing or extra routes, duplicate entries and stale lastmod values', () => {
    const live = parseBlogSitemap(renderBlogSitemapXml(expectedSitemap));
    for (const invalid of [live.slice(0, 1), [...live, { pathname: '/post/extra', lastmod: '2026-10-30' }], [...live, live[0]], [{ ...live[0], lastmod: '2020-01-01' }, live[1]]]) {
      assert.ok(diffBlogSitemap(invalid, expectedSitemap).length);
    }
  });

  it('requires HTTP 200 and XML, never accepting a 404 page as an empty sitemap', async () => {
    for (const response of [new Response('no', { status: 404 }), new Response('rate limit', { status: 429 }), new Response(renderBlogSitemapXml(expectedSitemap), { headers: { 'content-type': 'text/html' } }), new Response('', { headers: { 'content-type': 'application/xml' } })]) {
      await assert.rejects(fetchBlogSitemap(`${PROD}/sitemap-blog.xml`, async () => response));
    }
    const live = await fetchBlogSitemap(`${PROD}/sitemap-blog.xml`, async () => new Response(renderBlogSitemapXml(expectedSitemap), { headers: { 'content-type': 'application/xml' } }));
    assert.deepEqual(diffBlogSitemap(live, expectedSitemap), []);
  });
});
