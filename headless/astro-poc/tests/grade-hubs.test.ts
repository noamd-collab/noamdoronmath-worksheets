/**
 * HEADLESS-MIGRATION-16/17 — grade hub route parity gates for /grade-1…9.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ELEMENTARY_GRADE_HUBS,
  GRADE_HUB_GRADES,
  MIDDLE_GRADE_HUBS,
  loadAllGradeHubs,
  loadGradeHub,
  siblingGradeHubLinks,
} from '../src/lib/gradeHubs.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { buildWorksheetHref } from '../src/lib/worksheetLinks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = join(root, 'src', 'pages');
const PROD = 'https://www.noamdoronmath.co.il';

describe('grade hub routes (HEADLESS-MIGRATION-16/17)', () => {
  it('exact page modules exist for /grade-1…9 (not redirects)', () => {
    for (const g of GRADE_HUB_GRADES) {
      const page = join(pages, `grade-${g}.astro`);
      assert.ok(existsSync(page), `missing ${page}`);
      const src = readFileSync(page, 'utf8');
      assert.ok(src.includes(`grade={${g}}`));
      assert.ok(!/redirect|meta\s+http-equiv=["']refresh/i.test(src));
    }
  });

  it('each hub preserves production title, description, h1, intro, catalog CTA', () => {
    for (const hub of loadAllGradeHubs()) {
      assert.equal(hub.path, `/grade-${hub.grade}`);
      assert.ok(hub.title.includes('נועם דורון'));
      assert.ok(hub.description.length > 40);
      assert.ok(hub.h1.includes('דפי עבודה'));
      assert.ok(hub.intro.length > 30);
      assert.ok(hub.catalogCta);
      assert.equal(hub.catalogCta!.href, `/worksheets?grade=${hub.grade}`);
      assert.ok(!hub.catalogCta!.href.includes('github.io'));
      assert.ok(hub.terms.href.startsWith(PROD));
    }
  });

  it('middle hubs keep FAQ + production topic SEO links; elementary have none (verified)', () => {
    for (const g of MIDDLE_GRADE_HUBS) {
      const hub = loadGradeHub(g);
      assert.equal(hub.faq.length, 5);
      assert.ok(hub.faqHeading && hub.faqHeading.includes('שאלות'));
      assert.ok(hub.topicLinks.length >= 20);
      for (const link of hub.topicLinks) {
        assert.ok(link.path.includes(`grade-${g}`) || link.path.includes(`grades-${g}`));
        assert.equal(link.productionHref, `${PROD}${link.path}`);
      }
    }
    for (const g of ELEMENTARY_GRADE_HUBS) {
      const hub = loadGradeHub(g);
      assert.equal(hub.faq.length, 0);
      assert.equal(hub.topicLinks.length, 0);
      assert.ok(hub.faqNote || hub.topicLinksNote);
      assert.ok(hub.whatsapp?.href.includes('whatsapp') || hub.whatsapp?.href.startsWith(PROD));
      assert.ok((hub.footerLinks || []).length >= 5);
    }
  });

  it('GradeHubPage template resolves topic hrefs via general site resolver', () => {
    const tpl = readFileSync(join(root, 'src', 'components', 'GradeHubPage.astro'), 'utf8');
    assert.ok(tpl.includes('resolveSiteHrefString'));
    assert.ok(tpl.includes('link.productionHref'));
    assert.ok(tpl.includes('hub.catalogCta.href'));
    assert.ok(tpl.includes('hub.h1'));
    assert.ok(tpl.includes('hub.intro'));
    assert.ok(!tpl.includes('redirect'));
  });

  it('sibling nav uses exact /grade-N paths within family', () => {
    assert.deepEqual(
      siblingGradeHubLinks(3).map((l) => l.href),
      ['/grade-1', '/grade-2', '/grade-3', '/grade-4', '/grade-5', '/grade-6']
    );
    assert.deepEqual(
      siblingGradeHubLinks(8).map((l) => l.href),
      ['/grade-7', '/grade-8', '/grade-9']
    );
  });

  it('catalog continuity: middle viewer + elementary Wix Media PDF', () => {
    const catalog = loadCatalog();
    for (const grade of MIDDLE_GRADE_HUBS) {
      const hub = loadGradeHub(grade);
      assert.equal(hub.catalogCta!.href, `/worksheets?grade=${grade}`);
      const g = catalog.grades.find((x) => x.grade === grade)!;
      const topic = g.topics.find((t) => t.routing?.usesViewer)!;
      const level = topic.levels.find((l) => l.key === 'a') || topic.levels[0];
      const href = buildWorksheetHref({
        catalog,
        grade,
        topic,
        levelKey: level.key,
        backPath: `/worksheets?grade=${grade}`,
      });
      const u = new URL(href, 'https://headless-viewer.local/');
      assert.equal(u.searchParams.get('g'), String(grade));
      assert.equal(u.searchParams.get('back'), `/worksheets?grade=${grade}`);
      assert.ok(u.searchParams.get('pdf'));
    }

    // Elementary: direct Wix Media PDF (not viewer)
    const g1 = catalog.grades.find((x) => x.grade === 1)!;
    const topic = g1.topics.find((t) => !t.routing.usesViewer && t.levels[0])!;
    const level = topic.levels[0];
    const pdfHref = buildWorksheetHref({
      catalog,
      grade: 1,
      topic,
      levelKey: level.key,
      backPath: '/worksheets?grade=1',
    });
    assert.ok(pdfHref.startsWith(catalog.config.pdfBase));
    assert.ok(pdfHref.includes('static.wixstatic.com/ugd/'));
    assert.ok(pdfHref.endsWith('.pdf'));
    assert.ok(!pdfHref.includes('noamdoronmath.co.il/_files/'));
    assert.equal(loadGradeHub(1).catalogCta!.href, '/worksheets?grade=1');
  });
});
