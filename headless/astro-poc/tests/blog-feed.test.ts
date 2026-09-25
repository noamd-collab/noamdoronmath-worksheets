/**
 * /blog-feed.xml — RSS 2.0, newest first, production URLs, encoded Hebrew slugs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { listServedBlogPosts } from '../src/lib/blogPosts.ts';
import { absoluteBlogUrl, listBlogFeedItems, renderBlogFeedXml } from '../src/lib/blogFeed.ts';

const HEBREW_SLUG = 'פערים-לימודיים-במתמטיקה-כך-סוגרים-אותם-נכון';

describe('blog RSS feed', () => {
  it('lists every served post newest first with percent-encoded production URLs', () => {
    const posts = listServedBlogPosts();
    const items = listBlogFeedItems(posts);
    assert.equal(items.length, posts.length);
    assert.equal(items.length, 60);
    assert.equal(items[0]?.title, 'פערים לימודיים במתמטיקה: כך סוגרים אותם נכון');
    const encoded = encodeURIComponent(HEBREW_SLUG);
    assert.equal(
      items[0]?.link,
      `https://www.noamdoronmath.co.il/post/${encoded}`
    );
    assert.equal(items[0]?.guid, items[0]?.link);
    assert.equal(items[0]?.link.includes(HEBREW_SLUG), false);
    assert.match(items[0]?.pubDate || '', /25 Sep 2026/);
    for (let i = 1; i < items.length; i++) {
      const prev = Date.parse(items[i - 1]!.pubDate);
      const cur = Date.parse(items[i]!.pubDate);
      assert.ok(prev >= cur, `${items[i]!.title} is newer than the item before it`);
      assert.ok(items[i]!.link.startsWith('https://www.noamdoronmath.co.il/'));
    }
  });

  it('does not double-encode an already percent-encoded path', () => {
    const encoded = encodeURIComponent(HEBREW_SLUG);
    assert.equal(
      absoluteBlogUrl(`/post/${encoded}`),
      `https://www.noamdoronmath.co.il/post/${encoded}`
    );
  });

  it('renders RSS 2.0 with the required item fields', () => {
    const xml = renderBlogFeedXml();
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<rss version="2\.0">/);
    assert.equal((xml.match(/<item>/g) || []).length, 60);
    assert.match(xml, /<title>[^<]+<\/title>/);
    assert.match(xml, /<link>https:\/\/www\.noamdoronmath\.co\.il\/post\//);
    assert.match(xml, /<guid isPermaLink="true">/);
    assert.match(xml, /<pubDate>/);
    assert.match(xml, /<description>/);
    const route = readFileSync('src/pages/blog-feed.xml.ts', 'utf8');
    assert.match(route, /prerender = false/);
    assert.match(route, /application\/rss\+xml; charset=utf-8/);
    assert.match(route, /max-age=3600/);
    assert.match(route, /renderBlogFeedXml/);
  });
});
