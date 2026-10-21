/**
 * SEO cut-over audit.
 *
 * Runs on the data and routes the Astro build renders. `wix build` needs
 * Wix credentials that are not in this public repo, so CI does not boot a
 * preview. The checks below are the same contracts the HTML would have:
 * one title, one description, one production canonical, sitemap coverage,
 * internal links, JSON-LD, and lang/dir.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listBlogArchives } from '../src/lib/blogArchives.ts';
import { listBlogSitemapEntries, renderBlogSitemapXml } from '../src/lib/blogSitemap.ts';
import { collectBlogPostHrefs, listServedBlogPosts, localizeBlogHref } from '../src/lib/blogPosts.ts';
import { loadAllGradeHubs } from '../src/lib/gradeHubs.ts';
import { homePageJsonLd, loadHomePage } from '../src/lib/homePage.ts';
import { renderLlmsTxt } from '../src/lib/llmsTxt.ts';
import { REDIRECT_RULES } from '../src/lib/redirects.ts';
import { resolveSiteHref } from '../src/lib/resolveSiteHref.ts';
import { listMainPagePaths, renderPagesSitemapXml, renderSitemapIndexXml } from '../src/lib/siteSitemaps.ts';
import { SITE_CANONICAL_ORIGIN, renderRobotsTxt } from '../src/lib/siteSeo.ts';
import {
  breadcrumbList,
  educationalLevelForGrade,
  jsonLdTypes,
  learningResourceJsonLd,
  organizationJsonLd,
  validateJsonLdDocument,
} from '../src/lib/structuredData.ts';
import { nextGradeRelatedTopics } from '../src/lib/topicFamilies.ts';
import { loadAllTopicPages } from '../src/lib/topicPages.ts';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function pageGlobKeysFromDisk(): string[] {
  return readdirSync(fromTest('../src/pages'))
    .filter((name) => name.endsWith('.astro'))
    .map((name) => `./${name}`);
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function assertCopy(kind: string, path: string, title: string, description: string) {
  assert.ok(title.trim(), `${kind} ${path} missing title`);
  assert.ok(description.trim(), `${kind} ${path} missing description`);
  assert.equal(title.includes('\0'), false);
  assert.equal(description.includes('\0'), false);
}

describe('seo audit', () => {
  it('layout emits one title, one description, one canonical, and Hebrew RTL', () => {
    const layout = readFileSync(fromTest('../src/layouts/BaseLayout.astro'), 'utf8');
    assert.equal((layout.match(/<title[\s>]/g) || []).length, 1);
    assert.equal((layout.match(/<meta name="description"/g) || []).length, 1);
    assert.equal((layout.match(/rel="canonical"/g) || []).length, 1);
    assert.match(layout, /<html lang="he" dir="rtl">/);
    assert.match(layout, /canonicalUrl\(Astro\.url\.pathname/);
    assert.match(layout, /buildSocialMeta\(/);
    assert.equal(layout.includes('EducationalOrganization'), false);
  });

  it('home, grades, topics, posts, and archives each have title and description', () => {
    const home = loadHomePage();
    assertCopy('home', '/', home.title, home.description);
    for (const hub of loadAllGradeHubs()) assertCopy('grade', hub.path, hub.title, hub.description);
    for (const page of loadAllTopicPages()) assertCopy('topic', page.path, page.title, page.description);
    for (const post of listServedBlogPosts()) assertCopy('post', post.path, post.title, post.description);
    for (const archive of listBlogArchives()) {
      assertCopy('archive', archive.path, archive.title, archive.description);
    }
    const notFound = readFileSync(fromTest('../src/pages/404.astro'), 'utf8');
    assert.match(notFound, /title="/);
    assert.match(notFound, /description="/);
    assert.match(notFound, /Astro\.response\.status = 404/);
  });

  it('sitemap index, pages, and blog cover the public routes on www', () => {
    const index = renderSitemapIndexXml();
    const indexLocs = locs(index);
    assert.deepEqual(indexLocs.sort(), [
      `${SITE_CANONICAL_ORIGIN}/sitemap-blog.xml`,
      `${SITE_CANONICAL_ORIGIN}/sitemap-pages.xml`,
    ]);

    const pageLocs = locs(renderPagesSitemapXml(pageGlobKeysFromDisk()));
    const pagePaths = new Set(pageLocs.map((loc) => loc.slice(SITE_CANONICAL_ORIGIN.length) || '/'));
    for (const hub of loadAllGradeHubs()) assert.ok(pagePaths.has(hub.path), hub.path);
    for (const page of loadAllTopicPages()) assert.ok(pagePaths.has(page.path), page.path);
    assert.ok(pagePaths.has('/worksheets'));
    assert.ok(pagePaths.has('/aboutus'));
    assert.equal(pagePaths.has('/404'), false);
    assert.equal(pagePaths.has('/dev-loops'), false);
    for (const rule of REDIRECT_RULES) assert.equal(pagePaths.has(rule.from), false, rule.from);

    const blogLocs = locs(renderBlogSitemapXml());
    const blogPaths = new Set(
      listBlogSitemapEntries().map((entry) => new URL(entry.loc).pathname),
    );
    assert.equal(blogLocs.length, blogPaths.size);
    for (const post of listServedBlogPosts()) assert.ok(blogPaths.has(post.path), post.path);
    for (const archive of listBlogArchives()) assert.ok(blogPaths.has(archive.path), archive.path);
    assert.equal(listServedBlogPosts().length, 60);
    assert.equal(listBlogArchives().length, 4);

    const all = [...indexLocs, ...pageLocs, ...blogLocs];
    for (const loc of all) {
      assert.ok(loc.startsWith(`${SITE_CANONICAL_ORIGIN}/`), loc);
      assert.equal(loc.includes('wix-site-host'), false, loc);
    }
  });

  it('internal links from grades, topics, and blog resolve to a served page', () => {
    const broken: string[] = [];
    const check = (where: string, href: string | null | undefined) => {
      if (!href) return;
      const resolved = resolveSiteHref(href);
      if (resolved.reason === 'unserved-prod') broken.push(`${where} -> ${resolved.href}`);
    };

    for (const page of loadAllTopicPages()) {
      for (const rel of page.relatedTopics) check(`${page.path} related`, rel.productionHref || rel.path);
      for (const rel of nextGradeRelatedTopics(page.slug, page.grade)) {
        check(`${page.path} next`, rel.productionHref || rel.path);
      }
      for (const cta of page.catalogCtas || []) check(`${page.path} cta`, cta.href);
      check(`${page.path} hub`, page.gradeHubHref);
      check(`${page.path} terms`, page.terms?.href);
      for (const author of page.author?.links || []) check(`${page.path} author`, author.href);
    }

    for (const hub of loadAllGradeHubs()) {
      for (const link of hub.topicLinks) check(`${hub.path} topic`, link.productionHref || link.path);
      for (const section of hub.topicSections || []) {
        for (const link of section.links) check(`${hub.path} section`, link.productionHref || link.path);
      }
      for (const link of hub.footerLinks || []) check(`${hub.path} footer`, link.href);
      check(`${hub.path} cta`, hub.catalogCta?.href);
      check(`${hub.path} whatsapp`, hub.whatsapp?.href);
      check(`${hub.path} terms`, hub.terms?.href);
    }

    for (const post of listServedBlogPosts()) {
      for (const row of collectBlogPostHrefs(post)) {
        check(`${post.path} ${row.where}`, localizeBlogHref(row.href));
      }
    }

    for (const archive of listBlogArchives()) {
      for (const item of archive.nav) check(`${archive.path} nav`, localizeBlogHref(item.href));
      for (const card of archive.cards) check(`${archive.path} card`, localizeBlogHref(card.href));
    }

    assert.deepEqual(broken, []);
  });

  it('JSON-LD on home, topics, and posts is valid and typed', () => {
    const layout = readFileSync(fromTest('../src/layouts/BaseLayout.astro'), 'utf8');
    assert.match(layout, /breadcrumbList\(crumbItems\)/);
    assert.match(layout, /set:html=\{JSON\.stringify\(breadcrumbLd\)\}/);
    for (const file of [
      '../src/components/TopicPage.astro',
      '../src/components/GradeHubPage.astro',
      '../src/components/BlogPostPage.astro',
      '../src/components/BlogArchivePage.astro',
      '../src/pages/index.astro',
      '../src/pages/worksheets.astro',
    ]) {
      assert.match(readFileSync(fromTest(file), 'utf8'), /crumbs=/);
    }

    const homeDocs = [...homePageJsonLd(), organizationJsonLd()];
    assert.deepEqual(validateJsonLdDocument(homeDocs), []);
    assert.ok(jsonLdTypes(homeDocs).includes('WebSite'));
    assert.ok(jsonLdTypes(homeDocs).includes('Organization'));

    const topics = loadAllTopicPages();
    const missingResource = topics.filter((page) => !jsonLdTypes(page.jsonLd).includes('LearningResource'));
    assert.deepEqual(
      missingResource.map((page) => page.path),
      ['/pythagorean-theorem-grade-7'],
    );
    for (const page of topics) {
      assert.deepEqual(validateJsonLdDocument(page.jsonLd), [], page.path);
      const crumbs = breadcrumbList([
        { name: 'בית', path: '/' },
        { name: page.h1, path: page.path },
      ]);
      assert.deepEqual(validateJsonLdDocument(crumbs), [], page.path);
      if (!jsonLdTypes(page.jsonLd).includes('LearningResource')) {
        const extra = learningResourceJsonLd({
          name: page.h1,
          path: page.path,
          description: page.description,
          educationalLevel: educationalLevelForGrade(page.grade),
        });
        assert.deepEqual(validateJsonLdDocument(extra), [], page.path);
      }
    }

    for (const post of listServedBlogPosts()) {
      const types = jsonLdTypes(post.jsonLd);
      assert.ok(types.includes('BlogPosting') || types.includes('Article'), post.path);
      assert.deepEqual(validateJsonLdDocument(post.jsonLd), [], post.path);
    }
  });

  it('llms.txt lists grades and topics on the production origin', () => {
    const route = readFileSync(fromTest('../src/pages/llms.txt.ts'), 'utf8');
    assert.equal(route.includes('node:fs'), false);
    assert.equal(route.includes('readdirSync'), false);
    assert.equal(existsSync(fromTest('../public/llms.txt')), false);

    assert.match(renderRobotsTxt(true), /# https:\/\/www\.noamdoronmath\.co\.il\/llms\.txt/);
    const text = renderLlmsTxt();
    assert.match(text, /^# נועם דורון מתמטיקה/u);
    assert.equal(text.includes('wix-site-host'), false);
    for (const hub of loadAllGradeHubs()) {
      assert.ok(text.includes(`${SITE_CANONICAL_ORIGIN}${hub.path}`), hub.path);
    }
    for (const page of loadAllTopicPages()) {
      assert.ok(text.includes(`${SITE_CANONICAL_ORIGIN}${page.path}`), page.path);
    }
    assert.ok(text.includes(`${SITE_CANONICAL_ORIGIN}/blog`));
    assert.equal((text.match(/https:\/\/www\.noamdoronmath\.co\.il\/grade-[1-9]/g) || []).length >= 9, true);
  });
});
