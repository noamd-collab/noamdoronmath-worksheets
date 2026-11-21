import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import wixPages from '@wix/astro-pages';
import compactServerBuild from '../scripts/lib/compact-server-build.mjs';
import {
  WIX_SITEMAP_OMITTED_PATHS,
  filterWixPagesModuleSource,
} from '../scripts/lib/omit-wix-sitemap-paths.mjs';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { GAMES_INDEX_TITLE } from '../src/lib/eliyahuGames';
import { topicPageHrefByCatalogTopic } from '../src/lib/elementaryTopicNav';
import { loadAllGradeHubs, loadGradeHub } from '../src/lib/gradeHubs';
import { loadHomePage } from '../src/lib/homePage';
import { shortHebrewTitle, worksheetsDocumentTitle } from '../src/lib/seoTitles';
import { listMainPagePaths } from '../src/lib/siteSitemaps';
import { loadAllTopicPages, loadTopicPage } from '../src/lib/topicPages';
import { VIEWER_PATH, VIEWER_SEO_HEAD, withViewerSeoHead } from '../src/lib/viewerSeo';
import { breadcrumbList, learningResourceJsonLd, validateJsonLdDocument } from '../src/lib/structuredData';
import { gradeHubPath, worksheetsSeo, worksheetsStructuredData } from '../src/lib/worksheetsSeo';
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  buildSocialMeta,
  canonicalUrl,
  isPreviewHost,
  isProductionHost,
  noindexFollowRobots,
  renderRobotsTxt,
  robotsContent,
} from '../src/lib/siteSeo';

const pocRoot = fileURLToPath(new URL('..', import.meta.url));
const routeExists = (path: string) => existsSync(`${pocRoot}src/pages${path}.astro`);

describe('siteSeo preview vs production', () => {
  it('marks Wix preview and localhost as noindex', () => {
    assert.equal(isPreviewHost('wglqn3-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com'), true);
    assert.equal(isPreviewHost('localhost'), true);
    assert.equal(robotsContent('127.0.0.1'), 'noindex,nofollow');
  });

  it('marks production main domain as indexable when the env flag is unset', () => {
    assert.equal(isPreviewHost('www.noamdoronmath.co.il'), false);
    assert.equal(isProductionHost('www.noamdoronmath.co.il'), true);
    assert.equal(isPreviewHost('noamdoronmath.co.il'), false);
    assert.equal(robotsContent('www.noamdoronmath.co.il', {}), 'index,follow');
  });

  it('SITE_INDEXABLE forces index or noindex, but preview hosts stay noindex', () => {
    assert.equal(robotsContent('www.noamdoronmath.co.il', { SITE_INDEXABLE: 'false' }), 'noindex,nofollow');
    assert.equal(robotsContent('example.com', { SITE_INDEXABLE: 'true' }), 'index,follow');
    assert.equal(
      robotsContent('preview.wix-site-host.com', { SITE_INDEXABLE: 'true' }),
      'noindex,nofollow',
    );
    assert.equal(robotsContent('unknown.example', {}), 'noindex,nofollow');
  });

  it('robots.txt points at the production sitemap and blocks preview crawling', () => {
    const preview = renderRobotsTxt(false);
    const live = renderRobotsTxt(true);
    assert.match(preview, /Disallow: \//);
    assert.match(live, /Allow: \//);
    assert.match(preview, /Sitemap: https:\/\/www\.noamdoronmath\.co\.il\/sitemap-index\.xml/);
    assert.match(live, /Sitemap: https:\/\/www\.noamdoronmath\.co\.il\/sitemap-index\.xml/);
    assert.doesNotMatch(live, /\/sitemap\.xml/);
    assert.doesNotMatch(preview, /wix-site-host/);
  });

  it('social tags cover Open Graph and Twitter once per page', () => {
    const tags = buildSocialMeta({
      title: 'שטח משולש',
      description: 'תרגול שטח משולש לכיתה ז׳',
      url: 'https://www.noamdoronmath.co.il/triangle-area-grade-7',
      image: 'https://www.noamdoronmath.co.il/brand/noam-doron-math-logo.png',
      type: 'article',
    });
    const keys = tags.map((t) => t.property || t.name);
    assert.deepEqual(keys, [
      'og:title',
      'og:description',
      'og:url',
      'og:locale',
      'og:type',
      'og:site_name',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'og:image',
      'twitter:image',
    ]);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(tags.find((t) => t.property === 'og:type')?.content, 'article');
  });

  it('builds canonicals on the main domain', () => {
    assert.equal(canonicalUrl('/grade-7'), 'https://www.noamdoronmath.co.il/grade-7');
    assert.equal(canonicalUrl('/'), 'https://www.noamdoronmath.co.il/');
    // popup is client-side only (redirects.json), so it is the same page as /grade-2.
    assert.equal(canonicalUrl('/grade-2', '?popup=ai3zi'), 'https://www.noamdoronmath.co.il/grade-2');
  });

  it('default title/description are Hebrew and not Astro POC / Home dupes', () => {
    assert.match(DEFAULT_SITE_TITLE, /נועם/);
    assert.doesNotMatch(DEFAULT_SITE_TITLE, /Astro POC|Home \|/i);
    assert.doesNotMatch(DEFAULT_SITE_DESCRIPTION, /Astro POC/i);
  });

  it('BaseLayout marks authored metadata for server deduplication', () => {
    const src = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(src, /data-noam-seo/);
    assert.doesNotMatch(src, /stripWixSeoDupes|MutationObserver/);
    assert.match(src, /buildSocialMeta/);
    assert.match(src, /lang="he"/);
    assert.match(src, /dir="rtl"/);
    assert.match(src, /showPreviewNote=\{showPreviewNote\}/);
  });

  it('SiteFooter preview note is gated off production hosts', () => {
    const src = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.match(src, /showPreviewNote/);
    assert.match(src, /showPreviewNote && footer\.previewNote/);
  });
});

describe('SEO-1: short Hebrew titles (re-applied from PR #449)', () => {
  it('drops the repeated site name and English slugs but keeps the worksheet descriptor', () => {
    const samples: Array<[string, string]> = [
      [loadHomePage().title, 'דפי עבודה במתמטיקה בחינם לכיתות א׳-ט׳'],
      [loadGradeHub(7).title, 'דפי עבודה במתמטיקה לכיתה ז׳ להדפסה בחינם'],
      [loadTopicPage('powers-grade-7').title, 'חזקות לכיתה ז׳ | דפי עבודה במתמטיקה'],
      [loadTopicPage('triangle-area-grade-7').title, 'שטח משולש לכיתה ז׳ | דפי עבודה חינם'],
      [loadTopicPage('binomial-square-grade-9').title, 'דו־איבר בריבוע לכיתה ט׳ | דפי מתמטיקה בחינם'],
      [loadTopicPage('signed-numbers-grade-7').title, 'חיבור וחיסור מספרים מכוונים לכיתה ז׳'],
      [GAMES_INDEX_TITLE, 'פינת המשחקים של אליהו'],
      ['חיפוש באתר | נועם דורון מתמטיקה', 'חיפוש באתר'],
      ['שטח משולש לכיתה ז׳ | triangle-area-grade-7 | נועם דורון מתמטיקה', 'שטח משולש לכיתה ז׳'],
      ['triangle-area-grade-7 | נועם דורון מתמטיקה', 'דפי עבודה במתמטיקה'],
      ['מי אני | נועם דורון, מורה למתמטיקה', 'מי אני | נועם דורון, מורה למתמטיקה'],
      ['עוזר ai למתמטיקה באינטרנט – דפי תרגול לבגרות | נועם דורון', 'עוזר ai למתמטיקה באינטרנט – דפי תרגול לבגרות'],
      [DEFAULT_SITE_TITLE, DEFAULT_SITE_TITLE],
    ];
    for (const [raw, expected] of samples) assert.equal(shortHebrewTitle(raw), expected, raw);
  });

  it('every served topic page, grade hub and the home page keep a unique, keyword-bearing title', () => {
    const rows: Array<[string, string]> = [['/', loadHomePage().title]];
    for (const hub of loadAllGradeHubs()) rows.push([hub.path, hub.title]);
    for (const page of loadAllTopicPages()) if (routeExists(page.path)) rows.push([page.path, page.title]);
    const descriptor = /דפי עבודה|דף עבודה|דפי מתמטיקה|דפי חזרה|דפי תרגול/;
    const seen = new Map<string, string>();
    let over60Before = 0;
    let over60After = 0;
    for (const [path, raw] of rows) {
      const title = shortHebrewTitle(raw);
      assert.equal(title.includes('נועם דורון'), false, `${path}: ${title}`);
      assert.match(title, /[\u0590-\u05FF]/, path);
      if (descriptor.test(raw)) assert.match(title, descriptor, `${path} lost its worksheet descriptor: ${title}`);
      assert.equal(seen.has(title), false, `${path} repeats the title of ${seen.get(title)}`);
      seen.set(title, path);
      if (raw.length > 60) over60Before += 1;
      if (title.length > 60) over60After += 1;
    }
    assert.ok(rows.length >= 320, `served pages: ${rows.length}`);
    assert.ok(over60After < over60Before / 4, `titles over 60 characters: ${over60Before} -> ${over60After}`);
  });

  it('BaseLayout shortens every document title, and the stale /angles-grade-7 override is gone', () => {
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(layout, /resolvedTitle = shortHebrewTitle\(approvedCopy\?\.title \|\| title\)/);
    assert.equal(readFileSync('src/lib/seoTitles.ts', 'utf8').includes("'/angles-grade-7':"), false);
    assert.equal(routeExists('/angles-grade-7'), false);
  });

  it('catalog titles name the topic only together with the landing canonical', () => {
    assert.equal(worksheetsDocumentTitle('כיתה ז׳', 'זוויות'), 'זוויות · כיתה ז׳');
    assert.equal(worksheetsDocumentTitle('כיתה א׳'), 'דפי עבודה · כיתה א׳');
    assert.equal(worksheetsDocumentTitle('כיתה ט׳', null), 'דפי עבודה · כיתה ט׳');
    const page = readFileSync('src/pages/worksheets.astro', 'utf8');
    assert.match(page, /worksheetsDocumentTitle\(gradeEntry\.label, seo\.topicTitle\)/);
    assert.match(page, /title=\{worksheetsTitle\}\s+canonicalPath=\{seo\.canonicalPath\}\s+noindexFollow=\{seo\.noindexFollow\}/);
  });

  it('drops only real lowercase page slugs, so COVID-19 and similar words stay', () => {
    assert.equal(shortHebrewTitle('נתוני תחלואה · COVID-19'), 'נתוני תחלואה · COVID-19');
    assert.equal(shortHebrewTitle('נתוני תחלואה | COVID-19 | נועם דורון'), 'נתוני תחלואה | COVID-19');
    assert.equal(shortHebrewTitle('COVID-19 בכיתה – גרפים וטבלאות'), 'COVID-19 בכיתה – גרפים וטבלאות');
    assert.equal(shortHebrewTitle('חיבור Wi-Fi לכיתה · 2024-2025'), 'חיבור Wi-Fi לכיתה · 2024-2025');
    assert.equal(shortHebrewTitle('מבחן · Triangle-Area-Grade-7'), 'מבחן · Triangle-Area-Grade-7');
    assert.equal(shortHebrewTitle('שטח משולש · triangle-area-grade-7'), 'שטח משולש');
  });

  it('keeps the original separators of the parts that remain', () => {
    assert.equal(shortHebrewTitle('שטח משולש · triangle-area-grade-7 · דפי עבודה'), 'שטח משולש · דפי עבודה');
    assert.equal(shortHebrewTitle('triangle-area-grade-7 | שטח משולש · כיתה ז׳'), 'שטח משולש · כיתה ז׳');
    assert.equal(shortHebrewTitle('שטח משולש – triangle-area-grade-7 | דפי עבודה'), 'שטח משולש | דפי עבודה');
    assert.equal(shortHebrewTitle('זוויות · כיתה ז׳ – דפי עבודה'), 'זוויות · כיתה ז׳ – דפי עבודה');
    assert.equal(shortHebrewTitle('דלתון · כיתה ט׳ · נועם דורון'), 'דלתון · כיתה ט׳');
    assert.equal(shortHebrewTitle('triangle-area-grade-7 · נועם דורון מתמטיקה'), 'דפי עבודה במתמטיקה');
  });
});

describe('SEO-1: /worksheets canonical points at the page that should rank', () => {
  const catalog = loadCatalog();
  const hrefs = topicPageHrefByCatalogTopic();

  it('a known topic canonicalizes to its landing page (or its parent topic\'s), otherwise to the grade hub', () => {
    let toLanding = 0;
    let toParent = 0;
    let toHub = 0;
    for (const entry of catalog.grades) {
      assert.ok(routeExists(gradeHubPath(entry.grade)), `missing hub route for grade ${entry.grade}`);
      for (const topic of entry.topics) {
        for (const gradeExplicit of [true, false]) {
          const seo = worksheetsSeo({
            grade: entry.grade, gradeExplicit, topics: entry.topics, topicId: topic.id, topicPageHrefs: hrefs,
          });
          const landing = hrefs[`${entry.grade}:${topic.id}`];
          const parent = topic.parent != null ? hrefs[`${entry.grade}:${topic.parent}`] : undefined;
          assert.equal(seo.noindexFollow, false);
          assert.equal(seo.topicTitle, topic.title);
          assert.equal(seo.canonicalPath, landing ?? parent ?? gradeHubPath(entry.grade), `${entry.grade}:${topic.id}`);
          assert.ok(routeExists(seo.canonicalPath!), `canonical target has no route: ${seo.canonicalPath}`);
          assert.notEqual(seo.canonicalPath, '/worksheets');
        }
        if (hrefs[`${entry.grade}:${topic.id}`]) toLanding += 1;
        else if (topic.parent != null && hrefs[`${entry.grade}:${topic.parent}`]) toParent += 1;
        else toHub += 1;
      }
    }
    assert.equal(toLanding + toParent + toHub, catalog.grades.reduce((sum, entry) => sum + entry.topics.length, 0));
    assert.ok(toLanding >= 300, `topics with a landing canonical: ${toLanding}`);
    const factoring = catalog.grades.find((g) => g.grade === 9)!.topics;
    const factoringOwn = {
      41: '/common-factor-grade-9',
      42: '/factoring-identities-grade-9',
      43: '/complete-factoring-grade-9',
    };
    for (const topicId of [41, 42, 43] as const) {
      assert.equal(
        worksheetsSeo({ grade: 9, gradeExplicit: true, topics: factoring, topicId, topicPageHrefs: hrefs }).canonicalPath,
        factoringOwn[topicId],
      );
    }
    const kite = worksheetsSeo({
      grade: 9, gradeExplicit: true, topics: catalog.grades.find((g) => g.grade === 9)!.topics, topicId: 46, topicPageHrefs: hrefs,
    });
    assert.equal(kite.canonicalPath, '/kite-grade-9');
    assert.equal(canonicalUrl(kite.canonicalPath!), 'https://www.noamdoronmath.co.il/kite-grade-9');
  });

  it('?grade=N canonicalizes to /grade-N; bare /worksheets keeps its own canonical', () => {
    const topics = catalog.grades.find((g) => g.grade === 4)!.topics;
    assert.deepEqual(
      worksheetsSeo({ grade: 4, gradeExplicit: true, topics, topicId: null, topicPageHrefs: hrefs }),
      { canonicalPath: '/grade-4', noindexFollow: false },
    );
    const seven = catalog.grades.find((g) => g.grade === 7)!.topics;
    assert.deepEqual(
      worksheetsSeo({ grade: 7, gradeExplicit: false, topics: seven, topicId: null, topicPageHrefs: hrefs }),
      { noindexFollow: false },
    );
    assert.equal(canonicalUrl('/worksheets', ''), 'https://www.noamdoronmath.co.il/worksheets');
  });

  it('an unknown topic id is noindex,follow on www and stays noindex,nofollow on previews', () => {
    const topics = catalog.grades.find((g) => g.grade === 9)!.topics;
    for (const topicId of [999, 200, 0]) {
      assert.deepEqual(
        worksheetsSeo({ grade: 9, gradeExplicit: true, topics, topicId, topicPageHrefs: hrefs }),
        { noindexFollow: true },
      );
    }
    assert.equal(noindexFollowRobots('www.noamdoronmath.co.il', {}), 'noindex,follow');
    assert.equal(noindexFollowRobots('www.noamdoronmath.co.il', { SITE_INDEXABLE: 'false' }), 'noindex,nofollow');
    assert.equal(noindexFollowRobots('preview.wix-site-host.com', { SITE_INDEXABLE: 'true' }), 'noindex,nofollow');
    assert.equal(noindexFollowRobots('127.0.0.1', {}), 'noindex,nofollow');
  });

  it('the BreadcrumbList and LearningResource name the canonical target, never a URL that canonicalizes away', () => {
    let checked = 0;
    for (const entry of catalog.grades) {
      const hub = gradeHubPath(entry.grade);
      const cases: Array<number | null> = [null, 999, ...entry.topics.map((topic) => topic.id)];
      for (const topicId of cases) {
        const seo = worksheetsSeo({
          grade: entry.grade, gradeExplicit: true, topics: entry.topics, topicId, topicPageHrefs: hrefs,
        });
        const { crumbs, resource } = worksheetsStructuredData({ grade: entry.grade, gradeLabel: entry.label, seo });
        const label = `${entry.grade}:${topicId}`;
        assert.deepEqual(crumbs.slice(0, 3), [
          { name: 'בית', path: '/' },
          { name: 'דפי עבודה', path: '/worksheets' },
          { name: entry.label, path: hub },
        ], label);
        assert.equal(resource.path, crumbs[crumbs.length - 1].path, label);
        for (const path of [...crumbs.map((crumb) => crumb.path), resource.path]) {
          assert.equal(path.includes('?'), false, `${label} names a catalog query URL: ${path}`);
          assert.ok(path === '/' || routeExists(path), `${label}: no route for ${path}`);
        }
        if (seo.canonicalPath) {
          assert.equal(resource.path, seo.canonicalPath, label);
          assert.equal(crumbs.length, seo.canonicalPath === hub ? 3 : 4, label);
        } else {
          assert.equal(resource.path, hub, label);
        }
        const docs = [breadcrumbList(crumbs), learningResourceJsonLd({
          name: resource.name, path: resource.path, description: 'דפי עבודה', educationalLevel: entry.label,
        })];
        assert.deepEqual(validateJsonLdDocument(docs), [], label);
        checked += 1;
      }
    }
    assert.ok(checked >= 340, `catalog URLs checked: ${checked}`);

    const nine = catalog.grades.find((g) => g.grade === 9)!;
    const kite = worksheetsStructuredData({
      grade: 9, gradeLabel: nine.label,
      seo: worksheetsSeo({ grade: 9, gradeExplicit: true, topics: nine.topics, topicId: 46, topicPageHrefs: hrefs }),
    });
    assert.deepEqual(kite.crumbs.slice(2), [{ name: nine.label, path: '/grade-9' }, { name: 'דלתון', path: '/kite-grade-9' }]);
    assert.deepEqual(kite.resource, { name: `דלתון · ${nine.label}`, path: '/kite-grade-9' });
    const factoring = worksheetsStructuredData({
      grade: 9, gradeLabel: nine.label,
      seo: worksheetsSeo({ grade: 9, gradeExplicit: true, topics: nine.topics, topicId: 41, topicPageHrefs: hrefs }),
    });
    assert.deepEqual(factoring.crumbs[3], { name: 'פירוק לגורמים 1 — הוצאת גורם משותף', path: '/common-factor-grade-9' });
    assert.deepEqual(factoring.resource, { name: `פירוק לגורמים 1 — הוצאת גורם משותף · ${nine.label}`, path: '/common-factor-grade-9' });
    const gradeOnly = worksheetsStructuredData({
      grade: 9, gradeLabel: nine.label,
      seo: worksheetsSeo({ grade: 9, gradeExplicit: true, topics: nine.topics, topicId: null, topicPageHrefs: hrefs }),
    });
    assert.deepEqual(gradeOnly.resource, { name: `דפי עבודה · ${nine.label}`, path: '/grade-9' });
    const seven = catalog.grades.find((g) => g.grade === 7)!;
    const bare = worksheetsStructuredData({
      grade: 7, gradeLabel: seven.label,
      seo: worksheetsSeo({ grade: 7, gradeExplicit: false, topics: seven.topics, topicId: null, topicPageHrefs: hrefs }),
    });
    assert.deepEqual(bare.resource, { name: `דפי עבודה · ${seven.label}`, path: '/grade-7' });

    const page = readFileSync('src/pages/worksheets.astro', 'utf8');
    assert.match(page, /worksheetsStructuredData\(\{ grade, gradeLabel: gradeEntry\.label, seo \}\)/);
    assert.match(page, /crumbs=\{structured!\.crumbs\}/);
    assert.match(page, /name: structured!\.resource\.name,\s+path: structured!\.resource\.path,/);
    assert.equal(page.includes('path: `/worksheets?grade=${grade}`'), false);
  });

  it('BaseLayout emits the override as both rel=canonical and og:url, and the robots choice', () => {
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(layout, /canonicalPath\s*\?\s*canonicalUrl\(canonicalPath\)\s*:\s*canonicalUrl\(Astro\.url\.pathname, Astro\.url\.search\)/);
    assert.match(layout, /noindexFollow\s*\?\s*noindexFollowRobots\(Astro\.url\.hostname\)/);
    assert.match(layout, /url: canonical,/);
    const page = readFileSync('src/pages/worksheets.astro', 'utf8');
    assert.match(page, /gradeExplicit: !parsed\.defaulted/);
    assert.match(page, /topicId: highlightTopicId/);
  });
});

describe('SEO-1: worksheet viewer is noindex,follow without a canonical', () => {
  const viewerFile = readFileSync('public/worksheet-viewer-noam.html', 'utf8');

  it('the served viewer head gains exactly the robots tag, and nothing else changes', () => {
    const served = withViewerSeoHead(viewerFile);
    const head = served.slice(0, served.indexOf('</head>'));
    // The bare viewer path is served statically and is indexable, so a canonical
    // to it next to noindex would send mixed signals.
    assert.equal(VIEWER_SEO_HEAD, '<meta name="robots" content="noindex,follow">\n');
    assert.equal((head.match(/rel="canonical"/g) || []).length, 0);
    assert.equal((head.match(/name="robots"/g) || []).length, 1);
    assert.ok(head.includes('<meta name="robots" content="noindex,follow">'));
    assert.ok(served.startsWith('<!DOCTYPE html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n' + VIEWER_SEO_HEAD));
    assert.equal(served.replace(VIEWER_SEO_HEAD, ''), viewerFile);
    assert.equal(withViewerSeoHead(served), served);
    assert.equal(withViewerSeoHead('<html><head></head></html>'), '<html><head></head></html>');
  });

  it('middleware serves the tagged shell for viewer URLs with a query', async () => {
    const mocks: Record<string, string> = {
      'astro:middleware': 'export const defineMiddleware = (handler) => handler;',
      'astro:env/server': 'export const OTTERLY_API_KEY = "";',
      './lib/wixMedia': 'export const redirectTargetForSiteUgdPath = () => null;',
      './lib/redirects': 'export const resolveRedirect = () => null;',
    };
    const bundle = await build({
      entryPoints: [fileURLToPath(new URL('../src/middleware.ts', import.meta.url))],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      plugins: [{
        name: 'viewer-shell-dependencies',
        setup(plugin) {
          plugin.onResolve({ filter: /.*/ }, (args) => {
            if (args.path in mocks) return { path: args.path, namespace: 'test-mock' };
            if (args.path.endsWith('.html?raw')) {
              return { path: fileURLToPath(new URL(args.path.slice(0, -4), `file://${args.resolveDir}/`)), namespace: 'raw-html' };
            }
            return undefined;
          });
          plugin.onLoad({ filter: /.*/, namespace: 'test-mock' }, (args) => ({ contents: mocks[args.path], loader: 'js' }));
          plugin.onLoad({ filter: /.*/, namespace: 'raw-html' }, (args) => ({
            contents: readFileSync(args.path, 'utf8'), loader: 'text',
          }));
        },
      }],
    });
    const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    const url = new URL(`${VIEWER_PATH}?g=9&pdf=0123456789abcdef0123456789abcdef&lv=a`, 'https://www.noamdoronmath.co.il');
    const response = await onRequest({
      request: new Request(url, { headers: { 'user-agent': 'Mozilla/5.0' } }), url, locals: {},
      redirect: () => { throw new Error('unexpected redirect'); },
    }, async () => { throw new Error('the viewer shell must answer before next()'); });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(html, withViewerSeoHead(viewerFile));
    assert.ok(html.includes(VIEWER_SEO_HEAD));
    assert.equal(/rel=["']?canonical/i.test(html.slice(0, html.indexOf('</head>'))), false);
  });
});

describe('SEO-1: sitemaps leave out 404, noindex and redirecting routes', () => {
  async function generatedWixPagesModule(): Promise<string> {
    let config: any;
    await (wixPages() as any).hooks['astro:config:setup']({
      config: { root: new URL('..', import.meta.url), srcDir: new URL('../src/', import.meta.url) },
      injectRoute: () => {},
      logger: { warn: () => {} },
      updateConfig: (value: unknown) => { config = value; },
    });
    const plugin = config.vite.plugins[0];
    return plugin.load.call({ addWatchFile: () => {} }, '\0wix:astro:pages');
  }

  it('the Wix page list behind /pages-sitemap.xml drops exactly the omitted paths', async () => {
    assert.deepEqual([...WIX_SITEMAP_OMITTED_PATHS], [
      '/404', '/dev-loops', '/search', '/teachers/login', '/teachers/start', '/teachers/generate',
    ]);
    const generated = await generatedWixPagesModule();
    const filtered = filterWixPagesModuleSource(generated);
    assert.notEqual(filtered, generated, 'the current @wix/astro-pages module shape must be recognised');
    const pages = ['/', '/404', '/search', '/teachers', '/teachers/login', '/teachers/start', '/teachers/generate', '/grade-7', '/worksheets']
      .map((path) => ({ path }));
    const runnable = filtered
      .replace(/^import \{ handlePages \} from .*$/m, `const handlePages = (_glob, added) => [...${JSON.stringify(pages)}, ...added];`)
      .replace(/^const pagesGlob = import\.meta\.glob\(.*$/m, 'const pagesGlob = {};');
    const { pages: listed } = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString('base64')}`);
    assert.deepEqual(listed.map((page: { path: string }) => page.path), ['/', '/teachers', '/grade-7', '/worksheets']);
  });

  it('the build integration registers the filter for the virtual module only', async () => {
    let config: any;
    await (compactServerBuild() as any).hooks['astro:config:setup']({ updateConfig: (value: unknown) => { config = value; } });
    const [plugin] = config.vite.plugins;
    assert.equal(plugin.name, 'noam-omit-wix-sitemap-paths');
    assert.equal(plugin.enforce, 'post');
    const generated = await generatedWixPagesModule();
    assert.equal(plugin.transform(generated, '\0wix:astro:pages').code, filterWixPagesModuleSource(generated));
    assert.equal(plugin.transform(generated, '/src/pages/index.astro'), null);
  });

  it('our own /sitemap-pages.xml already leaves all of them out, and every route still exists', () => {
    const keys = readdirSync(`${pocRoot}src/pages`).filter((name) => name.endsWith('.astro')).map((name) => `./${name}`);
    const listed = new Set(listMainPagePaths(keys));
    for (const path of WIX_SITEMAP_OMITTED_PATHS) assert.equal(listed.has(path), false, path);
    for (const path of WIX_SITEMAP_OMITTED_PATHS.filter((path) => path !== '/dev-loops')) {
      assert.ok(routeExists(path), `route removed by mistake: ${path}`);
    }
    assert.ok(listed.has('/teachers'));
    assert.ok(listed.has('/worksheets'));
  });
});
