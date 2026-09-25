import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { BLOG_ARCHIVE_M26_PATHS } from '../src/lib/blogArchives';
import { BLOG_POST_SERVED_PATHS, listServedBlogPosts } from '../src/lib/blogPosts';
import {
  BLOG_SITEMAP_ORIGIN,
  BLOG_SITEMAP_PATH,
  listBlogSitemapEntries,
  renderBlogSitemapXml,
} from '../src/lib/blogSitemap';
import { GET } from '../src/pages/sitemap-blog.xml.ts';

const ARCHIVE_LOCS = [
  'https://www.noamdoronmath.co.il/blog',
  'https://www.noamdoronmath.co.il/blog/categories/elementary-math',
  'https://www.noamdoronmath.co.il/blog/categories/middle-school-math',
  'https://www.noamdoronmath.co.il/blog/categories/teachers-and-parents',
];

function assertWellFormedXml(xml: string): void {
  assert.equal(xml.includes('\0'), false);
  const withoutDecl = xml.replace(/^\s*<\?xml[^?]*\?>\s*/, '');
  assert.notEqual(withoutDecl, xml, 'missing xml declaration');
  const tokens = withoutDecl.match(
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/[A-Za-z_][\w:.-]*>|<[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\/?>|[^<]+/g
  );
  assert.ok(tokens, 'xml did not tokenize');
  assert.equal(tokens.join(''), withoutDecl);
  const stack: string[] = [];
  for (const tok of tokens) {
    if (tok.startsWith('<!--') || tok.startsWith('<![CDATA[')) continue;
    if (tok.startsWith('</')) {
      const name = tok.slice(2, -1);
      assert.equal(stack.pop(), name);
      continue;
    }
    if (tok.startsWith('<')) {
      const name = tok.slice(1).match(/^[A-Za-z_][\w:.-]*/)?.[0];
      assert.ok(name, tok);
      if (!tok.endsWith('/>')) stack.push(name);
      continue;
    }
    assert.equal(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(tok), false);
  }
  assert.deepEqual(stack, []);
}

describe('blog sitemap /sitemap-blog.xml', () => {
  it('lists 64 production URLs: 60 posts and 4 archives, no duplicates', () => {
    const entries = listBlogSitemapEntries();
    const locs = entries.map((entry) => entry.loc);
    assert.equal(entries.length, 64);
    assert.equal(new Set(locs).size, 64);

    assert.deepEqual(locs.slice(0, 4), ARCHIVE_LOCS);
    assert.deepEqual(
      [...BLOG_ARCHIVE_M26_PATHS].map((path) => `${BLOG_SITEMAP_ORIGIN}${path}`),
      ARCHIVE_LOCS
    );

    const postLocs = BLOG_POST_SERVED_PATHS.map(
      (path) => `${BLOG_SITEMAP_ORIGIN}${decodeURIComponent(path)}`
    );
    assert.equal(postLocs.length, 60);
    assert.deepEqual(locs.slice(4), postLocs);

    const posts = listServedBlogPosts();
    assert.equal(posts.length, 60);
    for (const post of posts) {
      const loc = `${BLOG_SITEMAP_ORIGIN}${decodeURIComponent(post.path)}`;
      const entry = entries.find((item) => item.loc === loc);
      assert.ok(entry, loc);
      assert.equal(entry.lastmod, post.dateModified?.slice(0, 10));
      assert.match(entry.lastmod || '', /^\d{4}-\d{2}-\d{2}$/);
    }
    for (const loc of ARCHIVE_LOCS) {
      assert.equal(entries.find((item) => item.loc === loc)?.lastmod, undefined);
    }
  });

  it('uses only the production host and unencoded Hebrew slugs', () => {
    const entries = listBlogSitemapEntries();
    const hebrew = entries.filter((entry) => /[\u0590-\u05FF]/.test(entry.loc));
    assert.equal(hebrew.length, 30);
    for (const entry of entries) {
      const url = new URL(entry.loc);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.host, 'www.noamdoronmath.co.il');
      assert.equal(entry.loc.startsWith(`${BLOG_SITEMAP_ORIGIN}/`), true);
      assert.equal(entry.loc.includes('%'), false);
      assert.equal(/wixsite|preview|localhost|wix-site/i.test(entry.loc), false);
    }
  });

  it('renders valid XML with 64 locs and rejects a reserved sitemap filename', () => {
    assert.equal(BLOG_SITEMAP_PATH, '/sitemap-blog.xml');
    assert.equal(BLOG_SITEMAP_PATH.endsWith('-sitemap.xml'), false);
    assert.notEqual(BLOG_SITEMAP_PATH, '/sitemap.xml');
    assert.equal(BLOG_SITEMAP_PATH.startsWith('/_api/'), false);
    assert.equal(BLOG_SITEMAP_PATH.startsWith('/_wix/'), false);
    assert.equal(BLOG_SITEMAP_PATH.startsWith('/api/auth/'), false);
    assert.equal(BLOG_SITEMAP_PATH.startsWith('/_functions/'), false);
    assert.notEqual(BLOG_SITEMAP_PATH, '/robots.txt');

    const pageFile = 'src/pages/sitemap-blog.xml.ts';
    assert.equal(pageFile.endsWith('-sitemap.xml.ts'), false);
    assert.ok(existsSync(pageFile));
    const pageSource = readFileSync(pageFile, 'utf8');
    assert.match(pageSource, /application\/xml/);
    assert.match(pageSource, /renderBlogSitemapXml/);
    assert.doesNotMatch(pageSource, /Astro\.url/);
    assert.doesNotMatch(pageSource, /wixsite/);
    assert.equal(existsSync('src/pages/robots.txt'), false);
    assert.equal(existsSync('src/pages/sitemap.xml.ts'), false);

    const xml = renderBlogSitemapXml();
    assertWellFormedXml(xml);
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
    assert.equal(locs.length, 64);
    assert.equal(new Set(locs).size, 64);
    assert.equal(locs.every((loc) => loc.startsWith(`${BLOG_SITEMAP_ORIGIN}/`)), true);
    assert.equal((xml.match(/<url>/g) || []).length, 64);
    assert.equal((xml.match(/<lastmod>/g) || []).length, 60);
  });

  it('GET returns the same XML as application/xml', async () => {
    const response = await GET({} as never);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
    const body = await response.text();
    assert.equal(body, renderBlogSitemapXml());
    assertWellFormedXml(body);
  });
});
