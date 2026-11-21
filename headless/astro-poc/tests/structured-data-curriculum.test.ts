/**
 * SEO-4: topic-page JSON-LD tied to the official curriculum.
 * educationalAlignment, teaches, audience, hasPart PDFs and one publisher @id;
 * no bidi isolate controls; the home page names each entity once.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import elementaryPrintWorksheets from '../src/data/elementary-print-worksheets.json';
import { SITE_CANONICAL_ORIGIN } from '../src/lib/siteSeo.ts';
import alignmentFile from '../src/data/curriculum-alignment.v1.json';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { loadAllGradeHubs } from '../src/lib/gradeHubs.ts';
import { homePageJsonLd } from '../src/lib/homePage.ts';
import {
  CURRICULUM_FRAMEWORK,
  CURRICULUM_TARGET_URL,
  SITE_ORGANIZATION_ID,
  SITE_WEBSITE_ID,
  breadcrumbList,
  educationalLevelForGrade,
  enrichLearningResourceJsonLd,
  jsonLdBidiErrors,
  jsonLdIdErrors,
  jsonLdIdNodes,
  learningResourceJsonLd,
  siteIdentityJsonLd,
  sitePublisherNode,
  stripJsonLdBidi,
  validateEmittedJsonLd,
} from '../src/lib/structuredData.ts';
import { TOPIC_PAGE_SLUGS, loadTopicPage } from '../src/lib/topicPages.ts';
import {
  curriculumUnitsForTopicPage,
  topicPageCatalogTopicIds,
  topicPageJsonLdBlocks,
  topicPagePdfParts,
} from '../src/lib/topicStructuredData.ts';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions.ts';

type Node = Record<string, unknown>;
const LRI = '⁦';
const PDI = '⁩';
const catalog = loadCatalog();
const file = alignmentFile as {
  framework: { name: string; url: string };
  source: {
    generator: string;
    units: { path: string; sha256: string; rows: number; officialLayouts: Record<string, string> };
    pages: { path: string; sha256: string };
    corrections: { path: string; applied: Array<{ unit: string }> };
    rejudged: { path: string; against: string; applied: Array<{ unit: string; status: string; pages: string[]; reason: string }> };
  };
  tracks: Record<string, string>;
  units: Record<string, { track: string; name: string }>;
  pages: Record<string, Array<{ unit: string; alignmentType: string }>>;
};
const TRACK_GRADE: Record<string, number> = { ז: 7, ח: 8, ט_רגילה: 9, ט_מצומצמת: 9 };

function allNodes(blocks: readonly unknown[]): Node[] {
  const out: Node[] = [];
  for (const block of blocks as Node[]) {
    if (Array.isArray(block['@graph'])) out.push(...(block['@graph'] as Node[]));
    else out.push(block);
  }
  return out;
}

function learningResources(blocks: readonly unknown[]): Node[] {
  return allNodes(blocks).filter((node) => node['@type'] === 'LearningResource');
}

describe('curriculum-alignment.v1.json', () => {
  it('records repo-relative sources with sha256 and the official layouts of the 173 units', () => {
    assert.equal(file.framework.name, CURRICULUM_FRAMEWORK);
    assert.equal(file.framework.url, CURRICULUM_TARGET_URL);
    const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const { generator, units, pages, corrections, rejudged } = file.source;
    for (const path of [generator, units.path, pages.path, corrections.path, rejudged.path]) {
      assert.match(path, /^headless\/astro-poc\//, path);
      assert.ok(existsSync(join(repoRoot, path)), path);
    }
    const sourcesSha = createHash('sha256').update(readFileSync(join(repoRoot, units.path))).digest('hex');
    assert.equal(units.sha256, sourcesSha);
    assert.equal(pages.sha256, sourcesSha);
    assert.equal(units.rows, 173);
    assert.deepEqual(Object.keys(units.officialLayouts).sort(), Object.keys(file.tracks).sort());
    for (const url of Object.values(units.officialLayouts)) {
      assert.match(url, /^https:\/\/meyda\.education\.gov\.il\/files\/Pop\/0files\/matmatika\/Chativat-Beynayim\/tashpaz\/prisa_\w+\.pdf$/);
    }
    // No local machine path is committed.
    assert.doesNotMatch(JSON.stringify(file.source), /\/Users\/|Desktop|פרויקט/);
  });

  it('is what scripts/build-curriculum-alignment.py builds from the repo', () => {
    const astroRoot = fileURLToPath(new URL('../', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'curriculum-alignment-'));
    try {
      const routed = join(dir, 'routed.json');
      writeFileSync(routed, JSON.stringify(Object.fromEntries(
        TOPIC_PAGE_SLUGS.map((slug) => [slug, loadTopicPage(slug).grade]),
      )));
      const run = spawnSync('python3', ['scripts/build-curriculum-alignment.py', '--check', '--routed', routed], {
        cwd: astroRoot, encoding: 'utf8',
      });
      assert.equal(run.status, 0, run.stderr || run.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('maps only routed pages, to units of the same grade, with a known alignment type', () => {
    const routed = new Set<string>(TOPIC_PAGE_SLUGS);
    const used = new Set<string>();
    for (const [slug, entries] of Object.entries(file.pages)) {
      assert.ok(routed.has(slug), `${slug} is not a routed topic page`);
      assert.ok(entries.length > 0, slug);
      const grade = loadTopicPage(slug).grade;
      for (const entry of entries) {
        const unit = file.units[entry.unit];
        assert.ok(unit, `${slug}: unknown unit ${entry.unit}`);
        assert.equal(TRACK_GRADE[unit.track], grade, `${slug}: ${entry.unit}`);
        assert.ok(['teaches', 'educationalSubject'].includes(entry.alignmentType), entry.unit);
        used.add(entry.unit);
      }
      assert.equal(new Set(entries.map((e) => e.unit)).size, entries.length, `${slug}: repeated unit`);
    }
    assert.deepEqual(Object.keys(file.units).sort(), [...used].sort(), 'units list has unused rows');
    for (const [id, unit] of Object.entries(file.units)) {
      assert.ok(file.tracks[unit.track], id);
      assert.ok(unit.name && !unit.name.includes('/'), id);
      assert.deepEqual(jsonLdBidiErrors(unit.name), [], id);
    }
    assert.equal(Object.keys(file.pages).length, 129); // + the four NEW4 landings (18.11) and PCM53 (batch 10)
    assert.equal(Object.keys(file.units).length, 164); // + six units aligned by NEW4 (18.11) and two by PCM53
  });

  it('applies the verifier corrections', () => {
    const units = (slug: string) => curriculumUnitsForTopicPage(slug);
    // prisa_9B leaves quadratic-function properties out of the reduced track.
    assert.ok(!units('quadratic-function-grade-9').some((u) => u.id === 'st.g9m.quad_partial.table_and_graph'));
    // EQM is not topic 18 (word problems): only its own landing (base topic 9/49, served since
    // the content train) is aligned to the unit, and no other page.
    for (const slug of Object.keys(file.pages)) {
      assert.equal(units(slug).some((u) => u.id === 'st.g9m.equations.numeric_denominator'),
        slug === 'equations-numeric-denominator-grade-9', slug);
    }
    const bothSides = units('equations-both-sides-word-problems-grade-7');
    for (const id of ['st.g7.word_problems.modeling_linear', 'st.g7.word_problems.context_problems']) {
      assert.equal(bothSides.find((u) => u.id === id)?.alignmentType, 'educationalSubject', id);
    }
    assert.equal(
      units('square-grade-9').find((u) => u.id === 'st.g9r.square.def_properties_converse')?.alignmentType,
      'educationalSubject',
    );
  });

  it('re-judges the batch-02a rows against the merged landing copy', () => {
    const type = (slug: string, id: string) => curriculumUnitsForTopicPage(slug).find((u) => u.id === id)?.alignmentType;
    assert.match(file.source.rejudged.against, /118b4d90/);
    // The merged rhombus copy states the converse theorems; the verifier's downgrade is lifted.
    assert.equal(type('rhombus-grade-9', 'st.g9r.rhombus.converse_theorems'), 'teaches');
    assert.ok(!file.source.corrections.applied.some((c) => c.unit === 'st.g9r.rhombus.converse_theorems'));
    for (const id of ['st.g9r.powers.power_of_product', 'st.g9r.powers.power_of_quotient', 'st.g9r.powers.zero_exponent']) {
      assert.equal(type('exponent-rules-grade-9', id), 'teaches', id);
    }
    assert.equal(type('exponent-rules-grade-9', 'st.g9r.powers.sqrt_laws'), 'educationalSubject');
    assert.equal(type('triangle-median-grade-8', 'st.g8.triangle_parts.triangle_inequality'), 'teaches');
    assert.equal(type('isosceles-triangle-properties-grade-8', 'st.g8.triangle_parts.isosceles_converse'), 'teaches');
    assert.equal(type('isosceles-triangle-grade-8', 'st.g8.triangle_parts.isosceles_converse'), undefined);
    assert.equal(type('equations-with-fractions-grade-8', 'st.g8.word_problems_eq.special_denominators'), 'teaches');
    assert.equal(type('word-problems-grade-9', 'st.g9r.word_problems.motion_percent_literacy'), 'teaches');
    assert.equal(type('word-problems-grade-9', 'st.g9r.word_problems.quadratic_geometric'), 'educationalSubject');
    assert.equal(type('rhombus-grade-9', 'st.g9m.rhombus.area_pythagoras'), 'educationalSubject');
    assert.equal(type('square-grade-9', 'st.g9m.square.area_pythagoras'), 'educationalSubject');
    // Every re-judged row is in the mapping exactly as judged.
    for (const row of file.source.rejudged.applied) {
      const expected = row.status === 'covered_by_landing' ? 'teaches' : row.status === 'partial' ? 'educationalSubject' : undefined;
      for (const slug of row.pages) {
        if (!file.pages[slug] && !expected) continue;
        assert.equal(type(slug, row.unit), expected, `${row.unit} on ${slug}`);
      }
    }
  });

  it('re-judges four rows against the batch-3 sections, and only where a section clearly covers the unit', () => {
    const type = (slug: string, id: string) => curriculumUnitsForTopicPage(slug).find((u) => u.id === id)?.alignmentType;
    assert.match(file.source.rejudged.against, /6039c61c/);
    const batch3 = file.source.rejudged.applied.filter((row) => row.reason.startsWith('batch 3'));
    assert.deepEqual(batch3.map((row) => row.unit).sort(), [
      'st.g7.powers_roots.irrational_estimate',
      'st.g7.powers_roots.signed_base',
      'st.g9r.parallels_trapezoid.isosceles_trapezoid',
      'st.g9r.quad_eq_applications.technique_and_graphs',
    ]);
    // trapezoid-grade-9 now has the isosceles-trapezoid series; the parallelogram page reaches
    // the isosceles trapezoid only through parallelogram properties and no longer claims the unit.
    assert.equal(type('trapezoid-grade-9', 'st.g9r.parallels_trapezoid.isosceles_trapezoid'), 'teaches');
    assert.equal(type('parallelogram-grade-9', 'st.g9r.parallels_trapezoid.isosceles_trapezoid'), undefined);
    // powers-grade-7 joins the page that already taught a power with a signed base.
    assert.equal(type('powers-grade-7', 'st.g7.powers_roots.signed_base'), 'teaches');
    assert.equal(type('order-of-operations-signed-numbers-grade-7', 'st.g7.powers_roots.signed_base'), 'teaches');
    // Two partial rows are closed by the new copy.
    assert.equal(type('square-root-grade-7', 'st.g7.powers_roots.irrational_estimate'), 'teaches');
    assert.equal(type('quadratic-equations-grade-9', 'st.g9r.quad_eq_applications.technique_and_graphs'), 'teaches');
    // Left as they were: the new sections do not clearly cover these units.
    assert.equal(type('trapezoid-grade-9', 'st.g9r.parallels_trapezoid.trapezoid_intro'), 'educationalSubject');
    assert.equal(type('combining-like-terms-grade-7', 'st.g7.algebraic_expressions.equivalence_identity'), undefined);
    // One new unit-page pair (signed base on powers-grade-7); three pairs move to "teaches".
    // The totals (210 pairs then: 186 teaches, 24 educationalSubject) are pinned in the next test.
  });

  it('re-judges two rows on the content train: the topic 9/49 landing and the batch-4 section that states the 30-60-90 converse', () => {
    const type = (slug: string, id: string) => curriculumUnitsForTopicPage(slug).find((u) => u.id === id)?.alignmentType;
    const unitIds = (slug: string) => curriculumUnitsForTopicPage(slug).map((u) => u.id);
    assert.match(file.source.rejudged.against, /74449462/);
    const rows = file.source.rejudged.applied.filter((row) => row.reason.startsWith('content train'));
    assert.deepEqual(rows.map((row) => [row.unit, row.status, row.pages]), [
      ['st.g9m.equations.numeric_denominator', 'covered_by_landing', ['equations-numeric-denominator-grade-9']],
      ['st.g9r.right_triangle_30_60_90.theorem_and_converse', 'covered_by_landing', ['triangle-30-60-90-grade-9']],
    ]);
    // The new reduced-track landing teaches exactly its own unit; the grade-8 page keeps its grade-8 unit.
    assert.deepEqual(unitIds('equations-numeric-denominator-grade-9'), ['st.g9m.equations.numeric_denominator']);
    assert.equal(type('equations-numeric-denominator-grade-9', 'st.g9m.equations.numeric_denominator'), 'teaches');
    assert.equal(file.units['st.g9m.equations.numeric_denominator'].track, 'ט_מצומצמת');
    assert.equal(type('equations-with-fractions-grade-8', 'st.g9m.equations.numeric_denominator'), undefined);
    assert.equal(type('word-problems-grade-9', 'st.g9m.equations.numeric_denominator'), undefined);
    // Batch 4 states the converse theorem on the 30-60-90 landing; the partial row is closed.
    assert.equal(type('triangle-30-60-90-grade-9', 'st.g9r.right_triangle_30_60_90.theorem_and_converse'), 'teaches');
    // Left as they were: the other three batch-4 landings already taught every unit of their strand.
    assert.deepEqual(unitIds('kite-grade-9'), ['st.g9r.kite.definition_angles', 'st.g9r.kite.main_diagonal_area', 'st.g9m.kite_and_isosceles.kite_properties']);
    assert.deepEqual(unitIds('solids-box-cube-prism-grade-7'), ['st.g7.solids.cube_box_elements', 'st.g7.solids.box_surface_volume', 'st.g7.solids.triangular_prism']);
    assert.deepEqual(unitIds('similar-triangles-grade-8'), ['st.g8.similarity.similar_polygons_ratio', 'st.g8.similarity.criteria']);
    for (const slug of ['kite-grade-9', 'solids-box-cube-prism-grade-7', 'similar-triangles-grade-8']) {
      assert.ok(curriculumUnitsForTopicPage(slug).every((u) => u.alignmentType === 'teaches'), slug);
      assert.ok(!rows.some((row) => row.pages.includes(slug)), slug);
    }
    // One new unit-page pair (topic 9/49) and one pair moves to "teaches"; then NEW4 (18.11) adds
    // six pairs: five "teaches" (9/50 x3, 9/51, 9/52) and one "educationalSubject" (8/68, partial).
    const pairs = Object.values(file.pages).flat();
    assert.equal(pairs.length, 211 + 6 + 2); // + PCM53: two reduced-track percentages units, both taught
    assert.equal(pairs.filter((entry) => entry.alignmentType === 'teaches').length, 188 + 5 + 2);
    assert.equal(pairs.filter((entry) => entry.alignmentType === 'educationalSubject').length, 23 + 1);
    assert.equal(type('isometric-transformations-grade-8', 'st.g8.transformations.isometries_congruence'), 'educationalSubject');
    for (const id of ['st.g9r.parallels_trapezoid.properties', 'st.g9r.parallels_trapezoid.alternate_corresponding', 'st.g9r.parallels_trapezoid.converse']) {
      assert.equal(type('parallel-lines-angles-grade-9', id), 'teaches', id);
    }
    assert.equal(type('co-interior-angles-grade-9', 'st.g9r.parallels_trapezoid.co_interior'), 'teaches');
    assert.equal(type('math-literacy-tasks-grade-9', 'st.g9r.integrative_literacy.real_world_tasks'), 'teaches');
  });
});

describe('topic-page JSON-LD (SEO-4)', () => {
  const pages = TOPIC_PAGE_SLUGS.map((slug) => loadTopicPage(slug));

  it('every topic page emits valid JSON-LD with consistent @ids and no bidi controls', () => {
    let bidiBefore = 0;
    for (const page of pages) {
      if (jsonLdBidiErrors(page.jsonLd).length) bidiBefore += 1;
      const blocks = topicPageJsonLdBlocks(page, catalog);
      assert.deepEqual(validateEmittedJsonLd(blocks), [], page.slug);
      // The breadcrumb BaseLayout adds uses the visible H1.
      const crumbs = breadcrumbList([{ name: 'בית', path: '/' }, { name: page.h1, path: page.path }]);
      assert.deepEqual(validateEmittedJsonLd([...blocks, crumbs]), [], `${page.slug} with breadcrumb`);
    }
    // The visible FAQ isolates math runs, and JSON-LD used to copy them.
    assert.ok(bidiBefore > 0, 'expected loaded topic JSON-LD to carry isolates before stripping');
  });

  it('each page has one LearningResource with audience, teaches and the site publisher', () => {
    for (const page of pages) {
      const blocks = topicPageJsonLdBlocks(page, catalog);
      const resources = learningResources(blocks);
      assert.equal(resources.length, 1, page.slug);
      const [resource] = resources;
      assert.equal(resource.educationalLevel, educationalLevelForGrade(page.grade), page.slug);
      assert.deepEqual(resource.audience, {
        '@type': 'EducationalAudience',
        educationalRole: 'student',
        audienceType: `תלמידי ${educationalLevelForGrade(page.grade)}`,
      });
      const teaches = [resource.teaches].flat();
      assert.ok(teaches.length > 0 && teaches.every((t) => typeof t === 'string' && t), page.slug);
      const publisher = resource.publisher as Node;
      assert.equal(publisher['@id'], SITE_ORGANIZATION_ID, page.slug);
      const { definitions } = jsonLdIdNodes(blocks);
      assert.ok(definitions.has(SITE_ORGANIZATION_ID), `${page.slug}: publisher not defined`);
    }
  });

  it('aligns every mapped page to its official units, and no other page', () => {
    let aligned = 0;
    for (const page of pages) {
      const [resource] = learningResources(topicPageJsonLdBlocks(page, catalog));
      const units = curriculumUnitsForTopicPage(page.slug);
      if (!units.length) {
        assert.equal(resource.educationalAlignment, undefined, page.slug);
        continue;
      }
      aligned += 1;
      const alignment = resource.educationalAlignment as Node[];
      assert.deepEqual(
        alignment.map((a) => [a.targetName, a.alignmentType, a.targetDescription]),
        units.map((u) => [u.name, u.alignmentType, u.trackLabel]),
        page.slug,
      );
      for (const row of alignment) {
        assert.equal(row.educationalFramework, CURRICULUM_FRAMEWORK);
        assert.equal(row.targetUrl, CURRICULUM_TARGET_URL);
      }
      const teaches = [resource.teaches].flat();
      for (const unit of units.filter((u) => u.alignmentType === 'teaches')) {
        assert.ok(teaches.includes(unit.name), `${page.slug}: teaches ${unit.name}`);
      }
    }
    assert.equal(aligned, 129);
  });

  it('lists every PDF behind the page level buttons as a MediaObject', () => {
    let withParts = 0;
    for (const page of pages) {
      const [resource] = learningResources(topicPageJsonLdBlocks(page, catalog));
      const ids = topicPageCatalogTopicIds(page);
      assert.ok(ids.length > 0, page.slug);
      const expected = new Set<string>();
      const topics = catalog.grades.find((g) => g.grade === page.grade)!.topics;
      for (const id of ids) {
        const topic = topics.find((t) => t.id === id);
        if (!topic) continue;
        const printed = elementaryPrintWorksheets.find(row => row.grade === page.grade && row.topicId === id);
        if (printed) for (const key of Object.keys(printed.levels)) {
          expected.add(`${SITE_CANONICAL_ORIGIN}/worksheet-pdfs/elementary/${printed.slug}/level-${key}.pdf`);
        }
        const levels = [...topic.levels, ...(topic.editions || []).flatMap((e) => e.levels)];
        for (const level of levels) expected.add(`${catalog.config.pdfBase}${level.pdfId}.pdf`);
      }
      const parts = (resource.hasPart as Node[] | undefined) || [];
      assert.deepEqual(new Set(parts.map((p) => p.contentUrl)), expected, page.slug);
      if (parts.length) withParts += 1;
      for (const part of parts) {
        assert.equal(part.encodingFormat, 'application/pdf');
        const file = new URL(String(part.contentUrl));
        if (file.origin === SITE_CANONICAL_ORIGIN) {
          assert.match(file.pathname, /^\/worksheet-pdfs\/elementary\/[a-z0-9-]+\/level-[abc]\.pdf$/);
        } else {
          assert.equal(file.origin, 'https://static.wixstatic.com');
          assert.match(file.pathname, /^\/ugd\/[^/]+\.pdf$/);
        }
        assert.doesNotMatch(String(part.name), /PDF$/);
      }
    }
    assert.ok(withParts > 300, `pages with PDF parts: ${withParts}`);
  });

  it('reads the CTA walk TopicPage renders from and lists PDFs in level-button order', () => {
    const template = readFileSync(new URL('../src/components/TopicPage.astro', import.meta.url), 'utf8');
    assert.match(template, /const ctaWalk = topicPageCtaWalk\(page, bodyFlow, hasDemo\);/);
    assert.match(template, /topicPageJsonLdBlocks\(page, catalog, ctaWalk\)/);
    const pdfId = (url: string) => {
      const file = new URL(url, SITE_CANONICAL_ORIGIN);
      if (file.pathname.startsWith('/worksheet-pdfs/elementary/')) return file.pathname;
      return (/[?&]pdf=(?:d8e7ad_)?([0-9a-f]{32})/.exec(url) || /\/ugd\/(?:d8e7ad_)?([0-9a-f]{32})\.pdf/.exec(url))?.[1];
    };
    for (const page of pages) {
      const ids = topicPageCatalogTopicIds(page);
      const linked = ids.flatMap((id) => topicWorksheetEditionLinks(catalog, page.grade, id, page.path)
        .flatMap((edition) => edition.levels.map((level) => pdfId(level.href))));
      const { parts } = topicPagePdfParts(catalog, page.grade, ids);
      assert.deepEqual(parts.map((part) => pdfId(part.contentUrl)), [...new Set(linked)], page.slug);
    }
  });

  it('powers-grade-7: the stored graph gains alignment, PDFs and a publisher node', () => {
    const page = loadTopicPage('powers-grade-7');
    const blocks = topicPageJsonLdBlocks(page, catalog);
    assert.equal(blocks.length, 1);
    const graph = blocks[0]['@graph'] as Node[];
    assert.deepEqual(graph.map((n) => n['@type']), ['WebPage', 'LearningResource', 'Person', 'FAQPage', 'EducationalOrganization']);
    const resource = graph[1];
    assert.deepEqual(resource.publisher, { '@id': SITE_ORGANIZATION_ID });
    assert.deepEqual(graph[4], sitePublisherNode());
    const parts = resource.hasPart as Node[];
    const { parts: expected } = topicPagePdfParts(catalog, 7, [6]);
    assert.deepEqual(parts.map((p) => p.contentUrl), expected.map((p) => p.contentUrl));
    assert.ok(parts.length >= 6, 'legacy levels plus the PDF-only edition');
    assert.equal(parts[0].name, 'חזקות עם מעריך טבעי · רמה א׳');
  });

  it('pythagorean-theorem-grade-7 keeps its stand-alone LearningResource, with the publisher inline', () => {
    const page = loadTopicPage('pythagorean-theorem-grade-7');
    const blocks = topicPageJsonLdBlocks(page, catalog);
    assert.equal(blocks.length, 2);
    const resource = blocks[1];
    assert.equal(resource['@type'], 'LearningResource');
    assert.deepEqual(resource.publisher, sitePublisherNode());
    assert.deepEqual(jsonLdIdErrors(blocks), []);
  });

  it('an authored teaches value stays first; official units are added after it', () => {
    // signed-numbers-grade-7 stores teaches: 'חיבור וחיסור מספרים מכוונים'.
    const page = loadTopicPage('signed-numbers-grade-7');
    const [resource] = learningResources(topicPageJsonLdBlocks(page, catalog));
    const teaches = [resource.teaches].flat();
    assert.equal(teaches[0], 'חיבור וחיסור מספרים מכוונים');
    for (const unit of curriculumUnitsForTopicPage(page.slug).filter((u) => u.alignmentType === 'teaches')) {
      assert.ok(teaches.includes(unit.name), unit.name);
    }
    // Without official units the authored value is kept as it was.
    const [kept] = enrichLearningResourceJsonLd(
      [{ '@context': 'https://schema.org', '@type': 'LearningResource', name: 'n', educationalLevel: 'כיתה ח׳', inLanguage: 'he', teaches: 'נושא' }],
      { educationalLevel: 'כיתה ח׳', alignment: [], teaches: [], teachesFallback: ['כותרת בקטלוג'], pdfParts: [] },
    );
    assert.equal(kept.teaches, 'נושא');
    const [fallback] = enrichLearningResourceJsonLd(
      [{ '@context': 'https://schema.org', '@type': 'LearningResource', name: 'n', educationalLevel: 'כיתה ב׳', inLanguage: 'he' }],
      { educationalLevel: 'כיתה ב׳', alignment: [], teaches: [], teachesFallback: ['כותרת בקטלוג'], pdfParts: [] },
    );
    assert.equal(fallback.teaches, 'כותרת בקטלוג');
  });

  it('a reduced-track unit names its track', () => {
    const units = curriculumUnitsForTopicPage('parallelogram-grade-9');
    const reduced = units.find((u) => u.track === 'ט_מצומצמת');
    assert.equal(reduced?.trackLabel, 'כיתה ט׳ · תוכנית מצומצמת');
    const [resource] = learningResources(topicPageJsonLdBlocks(loadTopicPage('parallelogram-grade-9'), catalog));
    assert.ok(
      (resource.educationalAlignment as Node[]).some((a) => a.targetDescription === 'כיתה ט׳ · תוכנית מצומצמת'),
    );
  });
});

describe('site entities and validators', () => {
  it('the home page merges its identity blocks into one organization and one website', () => {
    const legacy = homePageJsonLd();
    assert.deepEqual(legacy.map((b) => b['@type']), ['LocalBusiness', 'WebSite', 'EducationalOrganization']);
    const merged = siteIdentityJsonLd(legacy);
    const [org, site] = merged['@graph'] as Node[];
    assert.deepEqual(org, {
      ...sitePublisherNode(),
      image: 'https://static.wixstatic.com/media/d8e7ad_12988010be694a34866bae3abba88878~mv2.png',
      address: { '@type': 'PostalAddress', addressCountry: 'IL', addressLocality: 'Bet Shemesh' },
      subjectOf: { '@type': 'AboutPage', url: 'https://www.noamdoronmath.co.il/aboutus' },
      alternateName: 'נועם דורון',
    });
    assert.deepEqual(site, {
      '@type': 'WebSite',
      '@id': SITE_WEBSITE_ID,
      // Same name as the WebSite block Wix adds to the home page head.
      name: 'נועם דורון מתמטיקה',
      url: 'https://www.noamdoronmath.co.il/',
      inLanguage: 'he',
      publisher: { '@id': SITE_ORGANIZATION_ID },
      alternateName: 'נועם דורון - מתמטיקה דפי מתמטיקה בחינם',
    });
    // Any other block joins the graph without its own @context.
    const extra = siteIdentityJsonLd([...legacy, { '@context': 'https://schema.org', '@type': 'Thing', name: 'x' }]);
    assert.deepEqual((extra['@graph'] as Node[])[2], { '@type': 'Thing', name: 'x' });
  });

  it('the home page defines the organization and website once each', () => {
    const blocks = [siteIdentityJsonLd(homePageJsonLd())];
    assert.deepEqual(validateEmittedJsonLd(blocks), []);
    const { definitions } = jsonLdIdNodes(blocks);
    assert.deepEqual([...definitions.keys()].sort(), [SITE_ORGANIZATION_ID, SITE_WEBSITE_ID].sort());
    for (const nodes of definitions.values()) assert.equal(nodes.length, 1);
    // Every page's publisher node agrees with the home definition.
    const home = definitions.get(SITE_ORGANIZATION_ID)![0];
    for (const [key, value] of Object.entries(sitePublisherNode())) assert.deepEqual(home[key], value, key);
  });

  it('grade hubs and the catalog name the same publisher', () => {
    for (const hub of loadAllGradeHubs()) {
      const node = learningResourceJsonLd({
        name: hub.h1,
        path: hub.path,
        description: hub.description,
        educationalLevel: educationalLevelForGrade(hub.grade),
      });
      assert.deepEqual(validateEmittedJsonLd([node]), [], hub.path);
      assert.deepEqual(node.publisher, sitePublisherNode());
    }
  });

  it('strips bidi isolates from every string, deeply', () => {
    const value = { a: `${LRI}PDF${PDI}`, b: [{ c: `x ${LRI}2${PDI}` }], n: 3 };
    assert.deepEqual(stripJsonLdBidi(value), { a: 'PDF', b: [{ c: 'x 2' }], n: 3 });
    assert.deepEqual(jsonLdBidiErrors(value), ['bidi control at $.a', 'bidi control at $.b[0].c']);
    const crumbs = breadcrumbList([{ name: `${LRI}x²${PDI} לכיתה ט׳`, path: '/x' }]);
    assert.deepEqual(jsonLdBidiErrors(crumbs), []);
  });

  it('reports conflicting @id definitions and undefined site references', () => {
    const a = { '@context': 'https://schema.org', '@type': 'EducationalOrganization', '@id': SITE_ORGANIZATION_ID, name: 'א', url: 'https://www.noamdoronmath.co.il/' };
    const b = { ...a, name: 'ב' };
    assert.deepEqual(jsonLdIdErrors([a, b]), [`@id ${SITE_ORGANIZATION_ID} conflicts on name`]);
    assert.deepEqual(jsonLdIdErrors([a, { ...a }]), []);
    const ref = { '@context': 'https://schema.org', '@type': 'WebPage', author: { '@id': 'https://www.noamdoronmath.co.il/aboutus#x' } };
    assert.deepEqual(jsonLdIdErrors([ref]), ['@id https://www.noamdoronmath.co.il/aboutus#x is not defined']);
  });

  it('rejects malformed alignment and PDF parts', () => {
    const base = learningResourceJsonLd({ name: 'n', path: '/x', description: 'd', educationalLevel: 'כיתה ט׳' });
    const [good] = enrichLearningResourceJsonLd([base], {
      educationalLevel: 'כיתה ט׳',
      alignment: [{ targetName: 'יחידה', alignmentType: 'teaches' }],
      teaches: ['יחידה'],
      teachesFallback: [],
      pdfParts: [{ name: 'רמה א׳', contentUrl: 'https://static.wixstatic.com/ugd/x.pdf' }],
    });
    assert.deepEqual(validateEmittedJsonLd([good]), []);
    const badAlignment = { ...good, educationalAlignment: [{ '@type': 'AlignmentObject', alignmentType: 'assesses', targetName: '', targetUrl: 'http://x' }] };
    assert.deepEqual(validateEmittedJsonLd([badAlignment]), [
      'alignment 0 alignmentType',
      'alignment 0 framework',
      'alignment 0 targetName',
      'alignment 0 targetUrl',
    ]);
    const part = (good.hasPart as Node[])[0];
    const badParts = { ...good, hasPart: [part, { ...part }, { ...part, encodingFormat: 'text/html', contentUrl: 'https://x/y.html' }] };
    assert.deepEqual(validateEmittedJsonLd([badParts]), [
      'part 1 duplicate contentUrl',
      'part 2 encodingFormat',
      'part 2 contentUrl',
    ]);
  });
});
