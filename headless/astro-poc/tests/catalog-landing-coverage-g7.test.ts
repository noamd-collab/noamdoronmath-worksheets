/**
 * Every grade-7 catalog topic has a landing page (audit 2026-11-10, section 6).
 * New pages are linked from the grade hub, listed in the page sitemap and on
 * the noindex review index.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { catalogLandingCoverage, uncoveredCatalogTopics } from '../src/lib/catalogLandingCoverage.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { listMainPagePaths } from '../src/lib/siteSitemaps.ts';
import { TOPIC_PAGE_AUTHORED_SLUGS, TOPIC_PAGE_G7_AUTHORED_SLUGS, TOPIC_PAGE_SLUGS, loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const GRADE = 7;
const NEW = TOPIC_PAGE_G7_AUTHORED_SLUGS as readonly string[];

describe(`grade ${GRADE} catalog landing coverage`, () => {
  it('every catalog topic has a landing page', () => {
    const missing = uncoveredCatalogTopics(GRADE).map((row) => `t${row.topicId} ${row.title}`);
    assert.deepEqual(missing, []);
    assert.equal(catalogLandingCoverage(GRADE).length, loadCatalog().grades.find((g) => g.grade === GRADE)!.topics.length);
  });

  it('new pages are registered, authored, and point at a real catalog topic with PDFs', () => {
    assert.equal(NEW.length, 11);
    const topics = new Map(loadCatalog().grades.find((g) => g.grade === GRADE)!.topics.map((t) => [t.id, t]));
    const topicIds = new Set<number>();
    for (const slug of NEW) {
      assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes(slug), slug);
      assert.ok((TOPIC_PAGE_AUTHORED_SLUGS as readonly string[]).includes(slug), slug);
      const page = loadTopicPage(slug);
      assert.equal(page.grade, GRADE, slug);
      assert.match(page.verifiedVia ?? '', /^authored-catalog-gap/, slug);
      assert.equal(page.catalogCtas.length, 1, slug);
      const topicId = page.catalogCtas[0].catalogTopicId!;
      assert.equal(page.catalogCtas[0].href, `/worksheets?grade=${GRADE}&topic=${topicId}`, slug);
      const topic = topics.get(topicId);
      assert.ok(topic, `${slug}: topic ${topicId}`);
      assert.equal(page.catalogCtas[0].catalogTopicTitle, topic!.title, slug);
      assert.ok(topic!.levels.length > 0 && topic!.levels.every((level) => level.pdfId), slug);
      assert.equal(topicIds.has(topicId), false, `${slug}: topic ${topicId} twice`);
      topicIds.add(topicId);
      const route = read(`src/pages/${slug}.astro`);
      assert.match(route, new RegExp(`<TopicPage slug="${slug}" />`));
      assert.match(route, /export const prerender = false;/);
    }
  });

  it('new pages are linked from the grade hub and listed in the page sitemap', () => {
    const hub = loadGradeHub(GRADE);
    const flat = new Set(hub.topicLinks.map((link) => link.path));
    const sectioned = new Set(hub.topicSections.flatMap((section) => section.links.map((link) => link.path)));
    const keys = readdirSync(join(root, 'src/pages'))
      .filter((name) => name.endsWith('.astro'))
      .map((name) => `./${name}`);
    const sitemap = new Set(listMainPagePaths(keys));
    for (const slug of NEW) {
      assert.ok(flat.has(`/${slug}`), `hub topicLinks ${slug}`);
      assert.ok(sectioned.has(`/${slug}`), `hub section ${slug}`);
      assert.ok(sitemap.has(`/${slug}`), `sitemap ${slug}`);
    }
  });

  it('review index is noindex, outside the sitemap glob and the site navigation', () => {
    const file = `src/dev-pages/review/new-topic-pages-grade-${GRADE}.astro`;
    assert.ok(existsSync(join(root, file)));
    const page = read(file);
    assert.match(page, new RegExp(`TOPIC_PAGE_G${GRADE}_AUTHORED_SLUGS`));
    const shell = read('src/components/CatalogGapReview.astro');
    assert.match(shell, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.match(shell, /X-Robots-Tag', 'noindex, nofollow'/);
    assert.doesNotMatch(shell, /BaseLayout|SiteHeader|SiteFooter/);
    assert.match(shell, /בס״ד/);
    assert.match(read('src/pages/sitemap-pages.xml.ts'), /import\.meta\.glob\('\.\/\*\.astro'\)/);
    for (const nav of ['src/layouts/BaseLayout.astro', 'src/data/grade-hubs/7.json']) {
      assert.equal(read(nav).includes('/review/'), false, nav);
    }
  });
});
