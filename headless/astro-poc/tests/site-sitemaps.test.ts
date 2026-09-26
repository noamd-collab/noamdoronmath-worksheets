/**
 * Pages + index sitemaps (cut-over). Route must not pull node:fs into the Worker.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { REDIRECT_RULES } from '../src/lib/redirects';
import {
  listMainPagePaths,
  renderPagesSitemapXml,
  renderSitemapIndexXml,
} from '../src/lib/siteSitemaps';
import { SITE_CANONICAL_ORIGIN } from '../src/lib/siteSeo';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

/** Same key shape the route gets from `import.meta.glob('./*.astro')`. */
function pageGlobKeysFromDisk(): string[] {
  const dir = fromTest('../src/pages');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.astro'))
    .map((name) => `./${name}`);
}

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

describe('site sitemaps /sitemap-pages.xml + /sitemap-index.xml', () => {
  it('lists real pages with canonical www locs; excludes redirects and /workflow', () => {
    const keys = pageGlobKeysFromDisk();
    const paths = listMainPagePaths(keys);
    assert.ok(paths.includes('/'));
    assert.ok(paths.includes('/grade-7'));
    assert.ok(paths.includes('/aboutus'));
    assert.ok(paths.length >= 50, `expected many pages, got ${paths.length}`);

    assert.equal(paths.includes('/workflow'), false);
    for (const rule of REDIRECT_RULES) {
      assert.equal(paths.includes(rule.from), false, `redirect alias must not be listed: ${rule.from}`);
    }

    const xml = renderPagesSitemapXml(keys);
    assertWellFormedXml(xml);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.equal(locs.length, paths.length);
    assert.equal(new Set(locs).size, locs.length);
    for (const loc of locs) {
      assert.ok(loc.startsWith(`${SITE_CANONICAL_ORIGIN}/`) || loc === `${SITE_CANONICAL_ORIGIN}/`);
      assert.equal(loc.includes('wix-site-host.com'), false);
      assert.equal(loc.endsWith('/workflow'), false);
    }
    assert.ok(locs.includes(`${SITE_CANONICAL_ORIGIN}/`));
    assert.ok(locs.includes(`${SITE_CANONICAL_ORIGIN}/grade-7`));
  });

  it('filters 404/index/dev-loops noise from glob keys', () => {
    const keys = pageGlobKeysFromDisk();
    const paths = listMainPagePaths(keys);
    assert.equal(paths.includes('/404'), false);
    assert.equal(paths.includes('/dev-loops'), false);
    assert.equal(paths.filter((p) => p === '/').length, 1);
  });

  it('sitemap-index points at pages + blog child sitemaps on canonical host', () => {
    const xml = renderSitemapIndexXml();
    assertWellFormedXml(xml);
    assert.match(xml, /<sitemapindex /);
    assert.match(xml, new RegExp(`${SITE_CANONICAL_ORIGIN}/sitemap-pages\\.xml`));
    assert.match(xml, new RegExp(`${SITE_CANONICAL_ORIGIN}/sitemap-blog\\.xml`));
  });

  it('route uses import.meta.glob and lib source has no node:fs', () => {
    const route = readFileSync(fromTest('../src/pages/sitemap-pages.xml.ts'), 'utf8');
    assert.match(route, /import\.meta\.glob/);
    assert.equal(route.includes('node:fs'), false);
    assert.equal(route.includes('readdirSync'), false);

    const lib = readFileSync(fromTest('../src/lib/siteSitemaps.ts'), 'utf8');
    assert.equal(lib.includes('node:fs'), false);
    assert.equal(lib.includes('readdirSync'), false);
  });
});
