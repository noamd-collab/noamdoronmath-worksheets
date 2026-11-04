/**
 * Elementary topic pages (grades 1–6) must be reachable from their grade hub.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import {
  elementaryTopicSections,
  topicPageHrefByCatalogTopic,
} from '../src/lib/elementaryTopicNav.ts';
import {
  TOPIC_PAGE_G1_SLUGS,
  TOPIC_PAGE_G2_SLUGS,
  TOPIC_PAGE_G3_SLUGS,
  TOPIC_PAGE_G4_SLUGS,
  TOPIC_PAGE_G5_SLUGS,
  TOPIC_PAGE_G6_SLUGS,
  loadTopicPage,
} from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

const BY_GRADE = {
  1: TOPIC_PAGE_G1_SLUGS,
  2: TOPIC_PAGE_G2_SLUGS,
  3: TOPIC_PAGE_G3_SLUGS,
  4: TOPIC_PAGE_G4_SLUGS,
  5: TOPIC_PAGE_G5_SLUGS,
  6: TOPIC_PAGE_G6_SLUGS,
} as const;

const EXPECTED_COUNTS = { 1: 23, 2: 29, 3: 25, 4: 30, 5: 35, 6: 27 } as const;

describe('elementary topic pages are linked from their grade hub', () => {
  it('GradeHubPage renders the grouped links', () => {
    const tpl = read('src/components/GradeHubPage.astro');
    assert.match(tpl, /elementaryTopicSections/);
    assert.match(tpl, /data-elementary-topics/);
    assert.match(tpl, /href=\{link\.href\}/);
    assert.match(tpl, /\{link\.label\}/);
    assert.doesNotMatch(tpl, /נושאים במאגר/);
  });

  it('every new elementary topic page is linked once, with its catalog title and group', () => {
    const catalog = loadCatalog();
    const hrefs = topicPageHrefByCatalogTopic();
    let total = 0;
    for (const grade of [1, 2, 3, 4, 5, 6] as const) {
      const slugs = BY_GRADE[grade];
      assert.equal(slugs.length, EXPECTED_COUNTS[grade], `grade ${grade} slug count`);
      const sections = elementaryTopicSections(grade);
      const entry = catalog.grades.find((item) => item.grade === grade)!;
      const groupLabels = new Set(entry.groups.map((group) => group.label));
      const seen = new Map<string, string>();
      for (const section of sections) {
        assert.ok(groupLabels.has(section.heading), `invented heading: ${section.heading}`);
        assert.ok(section.links.length > 0);
        for (const link of section.links) {
          assert.equal(seen.has(link.href), false, `duplicate ${link.href}`);
          seen.set(link.href, link.label);
        }
      }
      assert.equal(seen.size, slugs.length, `grade ${grade} link count`);
      for (const slug of slugs) {
        const page = loadTopicPage(slug);
        const title = page.catalogCta.catalogTopicTitle;
        assert.ok(title, `${slug} missing catalogTopicTitle`);
        assert.equal(seen.get(page.path), title, `${slug} label`);
        assert.equal(hrefs[`${page.grade}:${page.catalogCta.catalogTopicId}`], page.path, slug);
      }
      total += slugs.length;
    }
    assert.equal(total, 169);
    assert.equal(elementaryTopicSections(7).length, 0);
    assert.equal(elementaryTopicSections(9).length, 0);
  });

  it('worksheets listing links a catalog topic title to its page', () => {
    const page = read('src/pages/worksheets.astro');
    const client = read('src/components/WorksheetsClient.tsx');
    assert.match(page, /topicPageHrefs=\{topicPageHrefs\}/);
    assert.match(client, /topicPageHrefs\[`\$\{gEntry\.grade\}:\$\{topic\.id\}`\]/);
    assert.match(client, /<a href=\{pageHref\}>\{topic\.title\}<\/a>/);
    assert.equal(topicPageHrefByCatalogTopic()['9:46'], '/kite-grade-9');
  });

  it('a redirected old topic URL does not hide the canonical page link', () => {
    const hrefs = topicPageHrefByCatalogTopic();
    // /angles-grade-7 301s to /adjacent-vertical-angles-grade-7 (redirects.json).
    assert.equal(hrefs['7:12'], '/adjacent-vertical-angles-grade-7');
    for (const href of Object.values(hrefs)) assert.notEqual(href, '/angles-grade-7');
    // Two live, indexable pages share topic 7:9, so the card stays unlinked
    // until Noam picks one of them.
    assert.equal(hrefs['7:9'], undefined);
  });
});
