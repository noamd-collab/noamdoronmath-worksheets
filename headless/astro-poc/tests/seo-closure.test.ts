/**
 * SEO closure package (CURSOR-TASK-SEO-CLOSURE.md): server-side dedupe of Wix
 * SEO tags, title template, robots/canonical for /worksheets variants,
 * breadcrumbs, real sitemap lastmod, /privacy, llms.txt, og:image everywhere.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { listBlogArchives } from '../src/lib/blogArchives';
import { listServedBlogPosts } from '../src/lib/blogPosts';
import { loadAllGradeHubs } from '../src/lib/gradeHubs';
import { loadHomePage } from '../src/lib/homePage';
import { renderLlmsFullTxt, renderLlmsTxt } from '../src/lib/llmsTxt';
import { dayFromUpdatedLine, pageLastmod } from '../src/lib/pageLastmod';
import { resolveRedirect } from '../src/lib/redirects';
import { dedupeHeadSeoTags } from '../src/lib/seoHtml';
import { SITE_PAGE_M24_SLUGS, loadSitePage } from '../src/lib/sitePages';
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_TITLE,
  HOME_CRUMB,
  SITE_NAME_HE,
  TITLE_MAX,
  WIX_POC_SITE_NAME,
  breadcrumbJsonLd,
  formatPageTitle,
  pageCanonicalUrl,
  robotsForRequest,
} from '../src/lib/siteSeo';
import { renderPagesSitemapXml, renderSitemapIndexXml } from '../src/lib/siteSitemaps';
import { TOPIC_PAGE_SLUGS, loadAllTopicPages } from '../src/lib/topicPages';
import { topicH1, topicTitle } from '../src/lib/topicSeoOverrides';

const head = (html: string) => html.slice(0, html.search(/<\/head>/i));
const count = (text: string, re: RegExp) => (text.match(re) || []).length;

const WIX_INJECTED_PAGE = `<!doctype html><html lang="he"><head>
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://www.noamdoronmath.co.il/grade-7" />
<title>דפי עבודה לכיתה ז׳ | נועם דורון</title>
<meta property="og:title" content="דפי עבודה לכיתה ז׳ | נועם דורון" />
<meta property="og:site_name" content="${SITE_NAME_HE}" />
<meta property="og:image" content="https://www.noamdoronmath.co.il/a.png" />
<meta property="og:image" content="https://www.noamdoronmath.co.il/b.png" />
<title wix-seo-tag="true">Grade 7 | ${WIX_POC_SITE_NAME}</title>
<link rel="canonical" href="https://x.wix-site-host.com/grade-7" wix-seo-tag="true">
<meta property="og:title" content="Grade 7 | ${WIX_POC_SITE_NAME}" wix-seo-tag="true">
<meta property="og:site_name" content="${WIX_POC_SITE_NAME}" wix-seo-tag="true">
<meta name="twitter:title" content="Grade 7 | ${WIX_POC_SITE_NAME}" wix-seo-tag="true">
<meta name="twitter:card" content="summary_large_image" wix-seo-tag="true">
<script type="application/ld+json">{"@type":"WebSite","name":"${WIX_POC_SITE_NAME}"}</script>
</head><body><p>body text is never touched</p></body></html>`;

describe('SEO closure — server-side Wix SEO dedupe (middleware)', () => {
  const out = dedupeHeadSeoTags(WIX_INJECTED_PAGE);

  it('leaves no "Noam Math Astro POC" in the raw head', () => {
    assert.equal(head(out).includes(WIX_POC_SITE_NAME), false);
  });

  it('keeps exactly one title / canonical / og:title / og:site_name — ours', () => {
    const h = head(out);
    assert.equal(count(h, /<title\b/g), 1);
    assert.match(h, /<title>דפי עבודה לכיתה ז׳ \| נועם דורון<\/title>/);
    assert.equal(count(h, /rel="canonical"/g), 1);
    assert.match(h, /href="https:\/\/www\.noamdoronmath\.co\.il\/grade-7"/);
    assert.equal(count(h, /property="og:title"/g), 1);
    assert.equal(count(h, /property="og:site_name"/g), 1);
    assert.match(h, new RegExp(`content="${SITE_NAME_HE}"`));
    assert.equal(count(h, /name="twitter:title"/g), 0);
  });

  it('keeps multiple og:image, single Wix-only tags and the body', () => {
    assert.equal(count(out, /property="og:image"/g), 2);
    assert.equal(count(out, /name="twitter:card"/g), 1);
    assert.match(out, /<body><p>body text is never touched<\/p><\/body>/);
  });

  it('is a no-op on clean HTML and on fragments without </head>', () => {
    const clean = '<html><head><title>x</title></head><body></body></html>';
    assert.equal(dedupeHeadSeoTags(clean), clean);
    assert.equal(dedupeHeadSeoTags('{"ok":true}'), '{"ok":true}');
  });

  it('middleware applies it to HTML responses and sets a default Cache-Control', () => {
    const src = readFileSync('src/middleware.ts', 'utf8');
    assert.match(src, /dedupeHeadSeoTags\(html\)/);
    assert.match(src, /text\/html/);
    assert.match(src, /cache-control/);
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(layout, /stripWixSeoDupes/, 'client-side net must stay');
  });
});

describe('SEO closure — title template', () => {
  const brand = / \| נועם דורון$/;

  it('normalizes the legacy suffixes to "[נושא] | נועם דורון"', () => {
    assert.equal(formatPageTitle('שורש ריבועי לכיתה ז׳ | דפי עבודה חינם'), 'שורש ריבועי לכיתה ז׳ | נועם דורון');
    assert.equal(
      formatPageTitle('פונקציה קווית כיתה ח׳ | נועם דורון - מתמטיקה דפי מתמטיקה בחינם'),
      'פונקציה קווית לכיתה ח׳ | נועם דורון'
    );
    assert.equal(
      formatPageTitle('נפח מנסרה משולשת לכיתה ט׳ – דפי עבודה | נועם דורון'),
      'נפח מנסרה משולשת לכיתה ט׳ | נועם דורון'
    );
    assert.equal(formatPageTitle('העמוד לא נמצא | נועם דורון מתמטיקה'), 'העמוד לא נמצא | נועם דורון');
    assert.equal(formatPageTitle(''), DEFAULT_SITE_TITLE);
  });

  it('every topic page title fits 60 chars, carries the brand once and is unique', () => {
    const titles = loadAllTopicPages().map((p) => formatPageTitle(topicTitle(p)));
    for (const t of titles) {
      assert.ok(t.length <= TITLE_MAX, `${t.length}: ${t}`);
      assert.match(t, brand, t);
      assert.equal(count(t, /נועם דורון/g), 1, t);
      assert.doesNotMatch(t, /דפי עבודה חינם|מתמטיקה דפי מתמטיקה/, t);
    }
    assert.equal(new Set(titles).size, titles.length, 'duplicate topic titles');
  });

  it('fixes the broken triangle-area-grade-7 title and splits the duplicate H1 pairs', () => {
    const bySlug = new Map(loadAllTopicPages().map((p) => [p.slug, p]));
    assert.equal(formatPageTitle(topicTitle(bySlug.get('triangle-area-grade-7')!)), 'שטח משולש לכיתה ז׳ | נועם דורון');
    assert.notEqual(topicH1(bySlug.get('angles-grade-7')!), topicH1(bySlug.get('adjacent-vertical-angles-grade-7')!));
    assert.notEqual(
      topicH1(bySlug.get('isosceles-triangle-properties-grade-8')!).replace(/[־\s]/g, ''),
      topicH1(bySlug.get('isosceles-triangle-grade-8')!).replace(/[־\s]/g, '')
    );
  });

  it('home, hubs, site pages and blog pages fit 60 chars', () => {
    const raw = [
      loadHomePage().title,
      ...loadAllGradeHubs().map((h) => h.title),
      ...SITE_PAGE_M24_SLUGS.map((s) => loadSitePage(s).title),
      ...listServedBlogPosts().map((p) => p.title),
      ...listBlogArchives().map((a) => a.title),
    ];
    for (const title of raw) {
      const t = formatPageTitle(title);
      assert.ok(t.length <= TITLE_MAX, `${t.length}: ${t}`);
      assert.doesNotMatch(t, /Astro POC/i);
    }
  });
});

describe('SEO closure — robots, canonical, breadcrumbs, og:image', () => {
  const prod = 'www.noamdoronmath.co.il';

  it('/worksheets filter variants are noindex; the bare catalog stays indexable', () => {
    assert.equal(robotsForRequest(prod, '/worksheets', '?grade=7&topic=3'), 'noindex,follow');
    assert.equal(robotsForRequest(prod, '/worksheets', ''), 'index,follow');
    assert.equal(robotsForRequest(prod, '/grade-7', '?popup=ai3zi'), 'index,follow');
    assert.equal(robotsForRequest(prod, '/404', '', true), 'noindex,follow');
    assert.equal(robotsForRequest('localhost', '/grade-7', ''), 'noindex,nofollow');
  });

  it('page canonical never carries the query string', () => {
    assert.equal(pageCanonicalUrl('/worksheets'), 'https://www.noamdoronmath.co.il/worksheets');
    assert.equal(pageCanonicalUrl('/grade-7/'), 'https://www.noamdoronmath.co.il/grade-7');
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(layout, /const canonical = pageCanonicalUrl\(pathname\)/);
  });

  it('BreadcrumbList follows the visible crumbs בית › כיתה › נושא', () => {
    const ld = breadcrumbJsonLd([
      HOME_CRUMB,
      { name: 'כיתה ז׳', path: '/grade-7' },
      { name: 'משפט פיתגורס לכיתה ז׳', path: '/pythagorean-theorem-grade-7' },
    ]) as { itemListElement: Array<{ position: number; name: string; item: string }> };
    assert.deepEqual(
      ld.itemListElement.map((i) => [i.position, i.item]),
      [
        [1, 'https://www.noamdoronmath.co.il/'],
        [2, 'https://www.noamdoronmath.co.il/grade-7'],
        [3, 'https://www.noamdoronmath.co.il/pythagorean-theorem-grade-7'],
      ]
    );
  });

  it('every page gets og:image (default brand image), og:site_name and twitter:title', () => {
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(layout, /<meta property="og:image" content=\{socialImage\} \/>/);
    assert.match(layout, /const socialImage = ogImage \|\| DEFAULT_OG_IMAGE/);
    assert.match(layout, /<meta property="og:site_name" content=\{SITE_NAME_HE\} \/>/);
    assert.match(layout, /<meta name="twitter:title" content=\{pageTitle\} \/>/);
    assert.ok(existsSync(`public${new URL(DEFAULT_OG_IMAGE).pathname}`), DEFAULT_OG_IMAGE);
  });

  it('every page file renders through BaseLayout (so none can miss og:image)', () => {
    for (const file of readdirSync('src/pages').filter((f) => f.endsWith('.astro'))) {
      const src = readFileSync(`src/pages/${file}`, 'utf8');
      assert.match(src, /BaseLayout|TopicPage|GradeHubPage|SitePage|BlogPostPage|BlogArchivePage/, file);
    }
  });

  it('404 and dev-loops are noindex', () => {
    assert.match(readFileSync('src/pages/404.astro', 'utf8'), /\bnoindex\b/);
    assert.match(readFileSync('src/pages/dev-loops.astro', 'utf8'), /\bnoindex\b/);
  });
});

describe('SEO closure — sitemap lastmod, /privacy, #noam-doron, llms.txt', () => {
  it('lastmod comes from page data, not the run date', () => {
    assert.equal(dayFromUpdatedLine('נועם דורון מתמטיקה · עודכן 12.9.2026'), '2026-09-12');
    assert.equal(pageLastmod('/pythagorean-theorem-grade-7'), '2026-09-12');
    assert.equal(pageLastmod('/aboutus'), '2026-09-23');
    const keys = readdirSync('src/pages').filter((f) => f.endsWith('.astro')).map((f) => `./${f}`);
    const xml = renderPagesSitemapXml(keys);
    assert.match(xml, /\/pythagorean-theorem-grade-7<\/loc><lastmod>2026-09-12<\/lastmod>/);
    assert.equal(xml.includes('/404<'), false);
    assert.equal(xml.includes('/dev-loops<'), false);
    assert.match(renderSitemapIndexXml(), /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    assert.equal(readFileSync('src/lib/siteSitemaps.ts', 'utf8').includes('new Date()'), false);
  });

  it('/privacy 301s to the combined accessibility + privacy page', () => {
    assert.equal(resolveRedirect('/privacy'), '/accessibilityadaptation');
    assert.equal(resolveRedirect('/privacy/'), '/accessibilityadaptation');
  });

  it('about page exposes #noam-doron and a Person with the @id the topic pages use', () => {
    const tpl = readFileSync('src/components/SitePage.astro', 'utf8');
    assert.match(tpl, /id=\{isAbout \? 'noam-doron' : undefined\}/);
    assert.match(tpl, /'@type': 'Person'/);
    assert.match(tpl, /\/aboutus#noam-doron/);
    for (const hub of loadAllGradeHubs()) {
      for (const link of hub.footerLinks || []) {
        assert.doesNotMatch(link.href, /#Who%20is|\/privacy$/, `${hub.path}: ${link.href}`);
      }
    }
  });

  it('llms.txt links all 9 grade hubs and every topic page', () => {
    const txt = renderLlmsTxt();
    assert.match(txt, /^# /);
    assert.match(txt, /נועם דורון, מורה למתמטיקה/);
    for (let g = 1; g <= 9; g++) assert.ok(txt.includes(`https://www.noamdoronmath.co.il/grade-${g})`), `grade-${g}`);
    for (const slug of TOPIC_PAGE_SLUGS) assert.ok(txt.includes(`https://www.noamdoronmath.co.il/${slug})`), slug);
    assert.ok(renderLlmsFullTxt().length > txt.length);
  });
});
