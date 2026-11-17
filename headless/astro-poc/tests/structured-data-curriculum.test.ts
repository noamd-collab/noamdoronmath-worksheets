/**
 * SEO-4: topic-page JSON-LD tied to the official curriculum.
 * educationalAlignment, teaches, audience, hasPart PDFs and one publisher @id;
 * no bidi isolate controls; the home page names each entity once.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

type Node = Record<string, unknown>;
const LRI = '⁦';
const PDI = '⁩';
const catalog = loadCatalog();
const file = alignmentFile as {
  framework: { name: string; url: string };
  source: Record<string, { path: string; sha256: string; rows?: number }>;
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
  it('records its sources with sha256 and the 173-unit official list', () => {
    assert.equal(file.framework.name, CURRICULUM_FRAMEWORK);
    assert.equal(file.framework.url, CURRICULUM_TARGET_URL);
    assert.match(file.source.units.path, /reports\/curriculum-mapping-20261116\/all-units\.csv$/);
    assert.equal(file.source.units.rows, 173);
    for (const key of ['units', 'pages', 'corrections']) {
      assert.match(file.source[key].sha256, /^[0-9a-f]{64}$/, key);
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
    assert.equal(Object.keys(file.pages).length, 123);
    assert.equal(Object.keys(file.units).length, 147);
  });

  it('applies the verifier corrections', () => {
    const units = (slug: string) => curriculumUnitsForTopicPage(slug);
    // prisa_9B leaves quadratic-function properties out of the reduced track.
    assert.ok(!units('quadratic-function-grade-9').some((u) => u.id === 'st.g9m.quad_partial.table_and_graph'));
    // EQM is not topic 18 (word problems) and has no landing yet.
    for (const slug of Object.keys(file.pages)) {
      assert.ok(!units(slug).some((u) => u.id === 'st.g9m.equations.numeric_denominator'), slug);
    }
    const bothSides = units('equations-both-sides-word-problems-grade-7');
    for (const id of ['st.g7.word_problems.modeling_linear', 'st.g7.word_problems.context_problems']) {
      assert.equal(bothSides.find((u) => u.id === id)?.alignmentType, 'educationalSubject', id);
    }
    assert.equal(
      units('square-grade-9').find((u) => u.id === 'st.g9r.square.def_properties_converse')?.alignmentType,
      'educationalSubject',
    );
    assert.equal(
      units('rhombus-grade-9').find((u) => u.id === 'st.g9r.rhombus.converse_theorems')?.alignmentType,
      'educationalSubject',
    );
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
    assert.equal(aligned, 123);
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
        const levels = [...topic.levels, ...(topic.editions || []).flatMap((e) => e.levels)];
        for (const level of levels) expected.add(`${catalog.config.pdfBase}${level.pdfId}.pdf`);
      }
      const parts = (resource.hasPart as Node[] | undefined) || [];
      assert.deepEqual(new Set(parts.map((p) => p.contentUrl)), expected, page.slug);
      if (parts.length) withParts += 1;
      for (const part of parts) {
        assert.equal(part.encodingFormat, 'application/pdf');
        assert.match(String(part.contentUrl), /^https:\/\/static\.wixstatic\.com\/ugd\/[^/]+\.pdf$/);
        assert.doesNotMatch(String(part.name), /PDF$/);
      }
    }
    assert.ok(withParts > 300, `pages with PDF parts: ${withParts}`);
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
