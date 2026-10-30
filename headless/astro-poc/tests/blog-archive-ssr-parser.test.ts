import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSsrCards, diffArchiveCardOrder, pathnameOf } from '../scripts/lib/blog-archive-ssr.mjs';

const astroCard = (number: number, title = `כותרת פוסט ${number}`) => `
  <article class="blog-archive__card" data-blog-archive-card>
    <a class="blog-archive__card-media" href="/post/post-${number}" aria-hidden="true"><img src="/cover.jpg"></a>
    <div class="blog-archive__card-body">
      <h2><a data-blog-archive-card-link href="/post/post-${number}">${title}</a></h2>
      <p data-blog-archive-card-excerpt>תקציר <strong>מלא</strong> &amp; מפורט</p>
      <img class="blog-archive__card-avatar" src="https://static.wixstatic.com/author.jpg" alt="תמונת המחבר">
      <span data-blog-archive-card-author>נועם דורון</span>
      <time data-blog-archive-card-date>29 באוקטובר 2026</time>
      <ul class="blog-archive__card-cats"><li><a href="/blog/categories/elementary-math">מתמטיקה יסודית</a></li></ul>
    </div>
  </article>`;
const astroArchive = (cards: string) => `<main data-blog-archive="blog-index"><section data-blog-archive-list>${cards}</section></main>`;
const wixCard = (number: number) => `<div data-hook="post-list-item"><a href="https://www.noamdoronmath.co.il/post/post-${number}"><div data-hook="post-title"><h2>כותרת פוסט ${number}</h2></div></a></div>`;

test('Astro SSR cards retain document order, Hebrew entities and metadata without counting media links twice', () => {
  const cards = parseSsrCards(astroArchive(astroCard(2, 'שברים &#x5D0; &amp; <strong>חשבון</strong>') + astroCard(1)));
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((card) => pathnameOf(card.href)), ['/post/post-2', '/post/post-1']);
  assert.equal(cards[0].title, 'שברים א & חשבון');
  assert.equal(cards[0].excerpt, 'תקציר מלא & מפורט');
  assert.equal(cards[0].author, 'נועם דורון');
  assert.equal(cards[0].date, '29 באוקטובר 2026');
  assert.deepEqual(cards[0].authorAvatar, { src: 'https://static.wixstatic.com/author.jpg', alt: 'תמונת המחבר' });
  assert.deepEqual(cards[0].categories, [{ text: 'מתמטיקה יסודית', href: 'https://www.noamdoronmath.co.il/blog/categories/elementary-math' }]);
});

test('legacy Wix SSR markup still yields all twenty cards in order', () => {
  const cards = parseSsrCards(Array.from({ length: 20 }, (_, index) => wixCard(index + 1)).join(''));
  assert.equal(cards.length, 20);
  assert.deepEqual(cards.map((card) => pathnameOf(card.href)), Array.from({ length: 20 }, (_, index) => `/post/post-${index + 1}`));
});

test('empty Astro markup, unrelated articles and script strings cannot masquerade as archive cards', () => {
  const script = `<script type="application/json">${JSON.stringify(astroCard(9))}</script>`;
  assert.deepEqual(parseSsrCards(astroArchive('') + astroCard(8) + script), []);
  assert.deepEqual(parseSsrCards('<article><h2><a href="/post/not-an-archive">פוסט אחר</a></h2></article>'), []);
  assert.throws(() => parseSsrCards(astroArchive(astroCard(1).replace('data-blog-archive-card-link href="/post/post-1"', 'data-blog-archive-card-link href="https://other.example/post/post-1"'))), /Invalid Astro SSR archive card/);
});

test('the parity gate still rejects truncation, duplicate replacement and changed card order', () => {
  for (const html of [
    astroArchive(Array.from({ length: 20 }, (_, index) => astroCard(index + 1)).join('')),
    Array.from({ length: 20 }, (_, index) => wixCard(index + 1)).join(''),
  ]) {
    const cards = parseSsrCards(html);
    const live = { path: '/blog', cards: cards.map((card) => ({ ...card, pathname: pathnameOf(card.href) })), count: cards.length, pathnames: cards.map((card) => pathnameOf(card.href)) };
    assert.deepEqual(diffArchiveCardOrder(live, cards), []);
    assert.ok(diffArchiveCardOrder(live, cards.slice(0, 15)).some((issue) => /card count 15 != live SSR 20/.test(issue)));
    assert.ok(diffArchiveCardOrder(live, [cards[0], ...cards.slice(0, -1)]).length > 0);
    assert.ok(diffArchiveCardOrder(live, [...cards].reverse()).some((issue) => /order/.test(issue)));
  }
});
