/**
 * Pages + index sitemaps (cut-over). Route must not pull node:fs into the Worker.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listBlogSitemapEntries } from '../src/lib/blogSitemap';
import { REDIRECT_RULES } from '../src/lib/redirects';
import {
  listMainPagePaths,
  listPagesSitemapEntries,
  newestLastmod,
  renderPagesSitemapXml,
  renderSitemapIndexXml,
} from '../src/lib/siteSitemaps';
import { SITE_CANONICAL_ORIGIN } from '../src/lib/siteSeo';
import { jsonLdTypes, learningResourceJsonLd } from '../src/lib/structuredData';
import {
  TOPIC_PAGE_SLUGS,
  loadTopicPage,
  topicPageDateModifiedByPath,
  updatedLineIsoDate,
} from '../src/lib/topicPages';

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
    assert.equal(paths.includes('/payment'), false);
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

/** <url> or <sitemap> entries as { loc, lastmod } (lastmod null when absent). */
function entriesOf(xml: string, tag: 'url' | 'sitemap'): { loc: string; lastmod: string | null }[] {
  const re = new RegExp(`<${tag}><loc>([^<]+)</loc>(?:<lastmod>([^<]+)</lastmod>)?</${tag}>`, 'g');
  return [...xml.matchAll(re)].map((m) => ({ loc: m[1], lastmod: m[2] ?? null }));
}

/**
 * dateModified the topic page itself emits in JSON-LD: the stored WebPage or
 * LearningResource node, or (as TopicPage.astro does when the stored graph
 * has no LearningResource) the LearningResource it adds from the update line.
 */
function jsonLdDateModified(slug: string): string | null {
  const page = loadTopicPage(slug);
  const graph = (page.jsonLd['@graph'] as Record<string, unknown>[] | undefined) || [];
  const dates = new Set<string>();
  for (const node of graph) {
    if (node['@type'] !== 'WebPage' && node['@type'] !== 'LearningResource') continue;
    if (typeof node.dateModified === 'string') dates.add(node.dateModified);
  }
  if (!jsonLdTypes(page.jsonLd).includes('LearningResource')) {
    const added = learningResourceJsonLd({
      name: page.h1,
      path: page.path,
      description: page.description,
      educationalLevel: 'x',
      dateModified: updatedLineIsoDate(page.updatedLine),
    });
    if (typeof added.dateModified === 'string') dates.add(added.dateModified);
  }
  assert.ok(dates.size <= 1, `${slug}: one dateModified across JSON-LD nodes, got ${[...dates]}`);
  return [...dates][0] ?? null;
}

describe('SEO-5: sitemap lastmod is each page\'s real dateModified', () => {
  it('every topic-page lastmod equals the dateModified that page emits in JSON-LD', () => {
    const keys = pageGlobKeysFromDisk();
    const xml = renderPagesSitemapXml(keys);
    assertWellFormedXml(xml);
    const entries = entriesOf(xml, 'url');
    assert.equal(entries.length, listMainPagePaths(keys).length, 'every <url> parsed');
    const byLoc = new Map(entries.map((e) => [e.loc, e.lastmod]));

    let dated = 0;
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      const loc = `${SITE_CANONICAL_ORIGIN}${page.path}`;
      if (!byLoc.has(loc)) continue; // unrouted or redirected topic (e.g. /angles-grade-7)
      const expected = jsonLdDateModified(slug);
      assert.equal(expected, updatedLineIsoDate(page.updatedLine), `${slug}: JSON-LD date is the update line`);
      assert.equal(byLoc.get(loc), expected, `${slug}: sitemap lastmod must equal JSON-LD dateModified`);
      if (expected) dated++;
    }
    assert.ok(dated >= 250, `expected most topic pages to carry a dated update line, got ${dated}`);
    assert.equal(entries.filter((e) => e.lastmod).length, dated, 'only dated topic pages carry lastmod');
  });

  it('pages that declare no date get no <lastmod> instead of a made-up one', () => {
    const entries = new Map(listPagesSitemapEntries(pageGlobKeysFromDisk()).map((e) => [e.path, e.lastmod]));
    for (const path of ['/', '/aboutus', '/worksheets', '/grade-7', '/grade-9', '/games']) {
      assert.ok(entries.has(path), `${path} is listed`);
      assert.equal(entries.get(path), null, `${path} has no page date, so no lastmod`);
    }
    for (const [path, lastmod] of entries) {
      if (lastmod === null) continue;
      assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/, path);
      assert.equal(new Date(`${lastmod}T00:00:00Z`).toISOString().slice(0, 10), lastmod, `${path}: real calendar date`);
    }
  });

  it('output does not depend on the clock (never build or request time)', () => {
    const keys = pageGlobKeysFromDisk();
    const render = () => [renderPagesSitemapXml(keys), renderSitemapIndexXml()];
    const outputs: string[][] = [];
    for (const now of [Date.UTC(2031, 4, 5, 12), Date.UTC(2033, 0, 2, 23)]) {
      mock.timers.enable({ apis: ['Date'], now });
      try {
        assert.equal(new Date().getUTCFullYear() >= 2031, true, 'clock is mocked');
        outputs.push(render());
      } finally {
        mock.timers.reset();
      }
    }
    assert.deepEqual(outputs[0], outputs[1], 'same sitemap under two different clocks');
    for (const xml of outputs[0]) {
      assert.equal(/<lastmod>203[13]-/.test(xml), false, 'no lastmod comes from the clock');
    }
    assert.deepEqual(render(), outputs[0], 'same sitemap with the real clock');
  });

  it('sitemap-index lastmod per child is the newest lastmod inside that child', () => {
    const index = entriesOf(renderSitemapIndexXml(), 'sitemap');
    const byLoc = new Map(index.map((e) => [e.loc, e.lastmod]));
    const pagesNewest = newestLastmod(listPagesSitemapEntries(pageGlobKeysFromDisk()).map((e) => e.lastmod));
    const blogNewest = newestLastmod(listBlogSitemapEntries().map((e) => e.lastmod));
    assert.ok(pagesNewest && blogNewest);
    assert.equal(byLoc.get(`${SITE_CANONICAL_ORIGIN}/sitemap-pages.xml`), pagesNewest);
    assert.equal(byLoc.get(`${SITE_CANONICAL_ORIGIN}/sitemap-blog.xml`), blogNewest);
    // The index routes have no glob keys; their dated set must still match the listing.
    const datedPaths = new Set(
      listPagesSitemapEntries(pageGlobKeysFromDisk()).filter((e) => e.lastmod).map((e) => e.path)
    );
    const redirected = new Set(REDIRECT_RULES.map((r) => r.from));
    for (const path of topicPageDateModifiedByPath().keys()) {
      if (redirected.has(path)) continue;
      assert.ok(datedPaths.has(path), `${path}: dated topic page missing from /sitemap-pages.xml`);
    }
  });

  it('newestLastmod ignores missing and malformed values', () => {
    assert.equal(newestLastmod([]), null);
    assert.equal(newestLastmod([null, undefined, '', 'soon']), null);
    assert.equal(newestLastmod(['2026-10-15', null, '2026-11-16', '2026-09-12']), '2026-11-16');
    assert.equal(newestLastmod(['2026-11-16T10:00:00Z', '2026-01-01']), '2026-01-01');
  });

  it('lib keeps no build-time date source', () => {
    const lib = readFileSync(fromTest('../src/lib/siteSitemaps.ts'), 'utf8');
    assert.equal(/new Date\(|Date\.now\(/.test(lib), false, 'siteSitemaps.ts must not read the clock');
  });
});
