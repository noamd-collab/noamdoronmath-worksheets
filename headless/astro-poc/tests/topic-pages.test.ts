/**
 * HEADLESS-MIGRATION-18/19/20 — topic SEO page module + CTA gates.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  TOPIC_PAGE_M19_SLUGS,
  TOPIC_PAGE_M20_SLUGS,
  TOPIC_PAGE_M20_UNMIGRATED,
  TOPIC_PAGE_M21_SLUGS,
  TOPIC_PAGE_M21_UNMIGRATED,
  TOPIC_PAGE_M22_SLUGS,
  TOPIC_PAGE_M22_UNMIGRATED,
  TOPIC_PAGE_M23_SLUGS,
  TOPIC_PAGE_M23_UNMIGRATED,
  TOPIC_PAGE_M30_SLUGS,
  TOPIC_PAGE_M30_REDIRECTS,
  TOPIC_PAGE_M30_UNMIGRATED,
  TOPIC_PAGE_PILOT_SLUGS,
  TOPIC_PAGE_SLUGS,
  extractJsonLdFaq,
  loadAllTopicPages,
  loadTopicPage,
} from '../src/lib/topicPages.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { buildWorksheetHref } from '../src/lib/worksheetLinks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = join(root, 'src', 'pages');
const PROD = 'https://www.noamdoronmath.co.il';

function hasSelfCheckHeading(heading: string | null | undefined): boolean {
  const h = heading || '';
  return (
    h.includes('בדקו') ||
    h.includes('בדיקה') ||
    /\?$/.test(h) ||
    /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(h)
  );
}

function hasParagraphSelfCheck(page: {
  sections: { blocks: { type: string; text?: string }[] }[];
}): boolean {
  return page.sections.some((s) =>
    s.blocks.some((b) => b.type === 'paragraph' && (b.text || '').includes('בדקו את עצמכם'))
  );
}

describe('topic page routes (HEADLESS-MIGRATION-18/19/20)', () => {
  it('exact page modules exist for all migrated slugs (shared TopicPage)', () => {
    const tpl = readFileSync(join(root, 'src', 'components', 'TopicPage.astro'), 'utf8');
    assert.ok(tpl.includes('loadTopicPage'));
    assert.ok(tpl.includes('topic-page__cta') || tpl.includes('catalogCtas'));
    assert.ok(tpl.includes('synthesizeBodyFlow') || tpl.includes('bodyFlow'));
    assert.ok(tpl.includes('faqGroups'));
    assert.ok(tpl.includes('data-faq-item'));
    assert.ok(tpl.includes('data-body-flow'));
    assert.ok(tpl.includes('preH1Ctas') || tpl.includes('data-pre-h1-cta'));
    assert.ok(!/redirect|http-equiv=["']refresh/i.test(tpl));

    assert.equal(
      TOPIC_PAGE_SLUGS.length,
      TOPIC_PAGE_PILOT_SLUGS.length +
        TOPIC_PAGE_M19_SLUGS.length +
        TOPIC_PAGE_M20_SLUGS.length +
        TOPIC_PAGE_M21_SLUGS.length +
        TOPIC_PAGE_M22_SLUGS.length +
        TOPIC_PAGE_M23_SLUGS.length +
        TOPIC_PAGE_M30_SLUGS.length
    );
    assert.equal(TOPIC_PAGE_M20_SLUGS.length, 11);
    assert.equal(TOPIC_PAGE_M21_SLUGS.length, 24);
    assert.equal(TOPIC_PAGE_M22_SLUGS.length, 24);
    assert.equal(TOPIC_PAGE_M23_SLUGS.length, 23);
    assert.equal(TOPIC_PAGE_M30_SLUGS.length, 4);
    assert.deepEqual([...TOPIC_PAGE_M20_UNMIGRATED], []);
    assert.deepEqual([...TOPIC_PAGE_M21_UNMIGRATED], []);
    assert.deepEqual([...TOPIC_PAGE_M22_UNMIGRATED], []);
    assert.deepEqual([...TOPIC_PAGE_M23_UNMIGRATED], []);
    assert.deepEqual([...TOPIC_PAGE_M30_UNMIGRATED], []);
    assert.deepEqual(
      [...TOPIC_PAGE_M30_SLUGS].sort(),
      [
        'patterns-and-graphs-grade-7',
        'special-triangles-grade-7-new',
        'triangle-area-grade-7',
        'triangle-similarity-aa-grade-9',
      ].sort()
    );
    assert.deepEqual(
      TOPIC_PAGE_M30_REDIRECTS.map((r) => ({ from: r.from, to: r.to })),
      [{ from: 'equations-grade-7', to: '/equations-basics-grade-7' }]
    );
    assert.ok(existsSync(join(pagesDir, 'triangle-area-grade-7.astro')));
    assert.ok(existsSync(join(pagesDir, 'triangle-similarity-aa-grade-9.astro')));
    // OPEN-15: /equations-grade-7 is a middleware 301 (src/data/redirects.json), not a page.
    assert.ok(!existsSync(join(pagesDir, 'equations-grade-7.astro')));
    assert.ok(existsSync(join(pagesDir, 'special-triangles-grade-7-new.astro')));
    assert.ok(existsSync(join(pagesDir, 'patterns-and-graphs-grade-7.astro')));
    const redirectMap = JSON.parse(readFileSync(join(root, 'src', 'data', 'redirects.json'), 'utf8')).rules as Array<{ from: string; to: string }>;
    assert.ok(redirectMap.some((r) => r.from === '/equations-grade-7' && r.to === '/equations-basics-grade-7'));
    assert.ok(existsSync(join(pagesDir, 'binomial-square-grade-9.astro')));
    assert.ok(existsSync(join(pagesDir, 'difference-of-squares-grade-9.astro')));
    assert.ok(existsSync(join(pagesDir, 'triangle-30-60-90-grade-9.astro')));
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = join(pagesDir, `${slug}.astro`);
      assert.ok(existsSync(page), `missing ${page}`);
      const src = readFileSync(page, 'utf8');
      assert.ok(src.includes(`slug="${slug}"`));
      assert.ok(src.includes('TopicPage'));
    }
  });

  it('each page preserves production title/meta/h1/intro/sections/FAQ/author/JSON-LD', () => {
    for (const page of loadAllTopicPages()) {
      assert.equal(page.path, `/${page.slug}`);
      assert.ok(page.title.length > 10);
      assert.ok(page.description.length > 40);
      assert.ok(page.h1.length > 5);
      assert.ok(page.intro.length > 40);
      assert.notEqual(page.intro, page.h1);
      assert.ok(page.sections.length >= 1);
      assert.ok(
        page.sections.some((s) => hasSelfCheckHeading(s.heading)) || hasParagraphSelfCheck(page),
        `${page.slug}: missing self-check (heading or paragraph)`
      );
      assert.ok(page.faq.length >= 3);
      assert.ok(page.faqGroups.length >= 1);
      assert.ok(page.author.text.includes('נועם דורון'));
      assert.ok(page.author.links.some((l) => l.href.includes('aboutus')));
      assert.ok(page.jsonLd);
      assert.ok(page.relatedTopics.length >= 2);
      for (const rel of page.relatedTopics) {
        assert.equal(rel.productionHref, `${PROD}${rel.path}`);
      }
    }
  });

  it('preserves production updatedLine when present; absent when production has none', () => {
    const expectedPresent: Record<string, string> = {
      'signed-numbers-grade-7': 'נועם דורון מתמטיקה · עודכן 8.9.2026',
      'pythagorean-theorem-grade-8': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'quadratic-function-grade-9': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'equations-basics-grade-7': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'linear-function-grade-8': 'נועם דורון מתמטיקה · עודכן 16.9.2026',
      'triangle-congruence-grade-8': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'quadratic-equations-grade-9': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'rectangle-grade-9': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'pythagorean-theorem-grade-7': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'algebraic-expressions-grade-7': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'powers-grade-7': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'systems-of-equations-grade-8': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'statistics-grade-8': 'נועם דורון מתמטיקה · עודכן 16.9.2026',
      'similar-triangles-grade-8': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'factoring-grade-9': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
      'linear-function-grade-9': 'נועם דורון מתמטיקה · עודכן 16.9.2026',
      'parallelogram-grade-9': 'נועם דורון מתמטיקה · עודכן 16.9.2026',
      'square-grade-9': 'נועם דורון מתמטיקה · עודכן 12.9.2026',
    };
    for (const [slug, line] of Object.entries(expectedPresent)) {
      assert.equal(loadTopicPage(slug).updatedLine, line);
    }
    for (const slug of ['coordinate-plane-quadrants-grade-7', 'geometric-proof-grade-8'] as const) {
      const page = loadTopicPage(slug);
      assert.equal(page.updatedLine, null, slug);
      assert.equal(page.updatedLinePlacement, 'absent', slug);
    }
  });

  it('signed-numbers keeps TWO visible FAQ groups; JSON-LD matches first group only', () => {
    const page = loadTopicPage('signed-numbers-grade-7');
    assert.equal(page.faqGroups.length, 2);
    assert.equal(page.faqGroups[0].items.length, 3);
    assert.equal(page.faqGroups[1].items.length, 3);
    const ld = extractJsonLdFaq(page.jsonLd);
    assert.equal(ld.length, 3);
    for (const item of ld) {
      assert.ok(
        page.faqGroups[0].items.some(
          (v) => v.question === item.question && v.answer === item.answer
        )
      );
    }
  });

  it('every migrated page: FAQPage JSON-LD Q&A appears in visible FAQ (strict)', () => {
    for (const page of loadAllTopicPages()) {
      const ld = extractJsonLdFaq(page.jsonLd);
      assert.ok(ld.length >= 2, page.slug);
      const visible = page.faqGroups.flatMap((g) => g.items);
      for (const item of ld) {
        assert.ok(
          visible.some((v) => v.question === item.question && v.answer === item.answer),
          `${page.slug}: LD not in visible FAQ: ${item.question}`
        );
      }
    }
  });

  it('triangle-area-grade-7 migrated with LD FAQ visibility correction (exact Q&A)', () => {
    assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes('triangle-area-grade-7'));
    const page = loadTopicPage('triangle-area-grade-7');
    const ld = extractJsonLdFaq(page.jsonLd);
    assert.equal(ld.length, 3);
    const visible = page.faqGroups.flatMap((g) => g.items);
    assert.equal(visible.length, 3);
    for (const item of ld) {
      assert.ok(
        visible.some((v) => v.question === item.question && v.answer === item.answer),
        `LD not visible: ${item.question}`
      );
    }
    assert.equal(
      visible[0].question,
      'האם דפי העבודה בנושא שטח משולש לכיתה ז׳ מתאימים לכיתה ז׳?'
    );
    assert.ok(
      !visible.some((v) => v.question.includes('מפשטים ואז פותרים')),
      'must not keep wrong production visible Q1 wording'
    );
    assert.equal(page.faqGroups[0].source, 'jsonld-visibility-correction');
    assert.ok((page as { faqVisibilityCorrection?: unknown }).faqVisibilityCorrection);
  });

  it('triangle-similarity-aa uses generic preH1Ctas (CTA before H1, not in bodyFlow)', () => {
    const page = loadTopicPage('triangle-similarity-aa-grade-9');
    assert.ok(page.preH1Ctas && page.preH1Ctas.length === 1);
    assert.equal(page.preH1Ctas![0].href, page.catalogCtas[0].href);
    assert.ok(!(page.bodyFlow || []).some((b) => b.type === 'cta'));
  });

  it('worksheet CTAs map same-origin with catalog topic ids', () => {
    const expected: Record<string, { grade: number; topics: number[] }> = {
      'signed-numbers-grade-7': { grade: 7, topics: [2] },
      'pythagorean-theorem-grade-8': { grade: 8, topics: [11] },
      'quadratic-function-grade-9': { grade: 9, topics: [5] },
      'equations-basics-grade-7': { grade: 7, topics: [23, 34, 32] },
      'coordinate-plane-quadrants-grade-7': { grade: 7, topics: [9] },
      'linear-function-grade-8': { grade: 8, topics: [29] },
      'triangle-congruence-grade-8': { grade: 8, topics: [36] },
      'quadratic-equations-grade-9': { grade: 9, topics: [6] },
      'rectangle-grade-9': { grade: 9, topics: [11] },
      'pythagorean-theorem-grade-7': { grade: 7, topics: [42] },
      'algebraic-expressions-grade-7': { grade: 7, topics: [30, 23, 22] },
      'powers-grade-7': { grade: 7, topics: [6] },
      'systems-of-equations-grade-8': { grade: 8, topics: [47] },
      'statistics-grade-8': { grade: 8, topics: [16] },
      'geometric-proof-grade-8': { grade: 8, topics: [38] },
      'similar-triangles-grade-8': { grade: 8, topics: [43] },
      'factoring-grade-9': { grade: 9, topics: [2] },
      'linear-function-grade-9': { grade: 9, topics: [34] },
      'parallelogram-grade-9': { grade: 9, topics: [7] },
      'square-grade-9': { grade: 9, topics: [14] },
      // M21 multi-CTA regression
      'congruence-theorems-grade-8': { grade: 8, topics: [37, 37, 37] },
    };
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      assert.ok(page.catalogCtas.length >= 1);
      const exp = expected[slug];
      const topics = page.catalogCtas.map((c) => c.catalogTopicId);
      if (exp) {
        assert.deepEqual(topics, exp.topics, slug);
      }
      const grade = exp?.grade ?? page.grade;
      assert.equal(page.catalogCta.href, page.catalogCtas[0].href);
      for (const cta of page.catalogCtas) {
        assert.equal(cta.href, `/worksheets?grade=${grade}&topic=${cta.catalogTopicId}`);
        assert.ok(cta.label.length > 0, `${slug} empty CTA label`);
      }
    }
  });

  it('congruence-theorems preserves three CTA labels same topic 37 in DOM order', () => {
    const page = loadTopicPage('congruence-theorems-grade-8');
    assert.equal(page.catalogCtas.length, 3);
    assert.deepEqual(
      page.catalogCtas.map((c) => c.catalogTopicId),
      [37, 37, 37]
    );
    assert.equal(page.catalogCtas[0].label, 'פתיחת דפי העבודה ובחירת רמה');
    assert.equal(page.catalogCtas[1].label, 'רמה ב׳');
    assert.equal(page.catalogCtas[2].label, 'רמת מצוינות');
  });

  it('equations-basics preserves three distinct CTA wordings in DOM order', () => {
    const page = loadTopicPage('equations-basics-grade-7');
    assert.equal(page.catalogCtas.length, 3);
    assert.deepEqual(
      page.catalogCtas.map((c) => c.catalogTopicId),
      [23, 34, 32]
    );
    assert.equal(page.catalogCtas[0].label, 'הצבה בביטויים אלגבריים — בחירת דף ורמה');
    assert.equal(page.catalogCtas[1].label, 'משוואות חד־שלביות — בחירת דף ורמה');
    assert.equal(page.catalogCtas[2].label, 'מהו פתרון של משוואה — בחירת דף ורמה');
  });

  it('algebraic-expressions preserves three CTAs in production DOM order/labels', () => {
    const page = loadTopicPage('algebraic-expressions-grade-7');
    assert.equal(page.catalogCtas.length, 3);
    assert.deepEqual(
      page.catalogCtas.map((c) => c.catalogTopicId),
      [30, 23, 22]
    );
    // Awkward production wording kept after whitespace normalization (no invented polish).
    assert.equal(page.catalogCtas[0].label, 'גורם משותף ומינוס לפני וגריים — בחירת דף ורמה');
    assert.equal(page.catalogCtas[1].label, 'הצבה בביטויים אגבריים — בחירת דף ורמה');
    assert.equal(page.catalogCtas[2].label, 'משתנים וביטויים אלגבריים — בחירת דף ורמה');
    for (const cta of page.catalogCtas) {
      assert.ok(!/\s{2,}|\n/.test(cta.label), `CTA label not whitespace-normalized: ${cta.label}`);
      assert.equal(cta.href, `/worksheets?grade=7&topic=${cta.catalogTopicId}`);
    }
  });

  it('statistics CTA is short “בחירת דף ורמה” (topic 16); check prompt is H2 practice, not בדקו', () => {
    const page = loadTopicPage('statistics-grade-8');
    assert.equal(page.catalogCtas.length, 1);
    assert.equal(page.catalogCtas[0].catalogTopicId, 16);
    assert.equal(page.catalogCtas[0].label, 'בחירת דף ורמה');
    assert.equal(page.catalogCta.href, '/worksheets?grade=8&topic=16');
    assert.equal(page.sections[2]?.heading, 'חשבו ממוצע של 2, 4, 4, 8.');
    assert.ok(!page.sections.some((s) => (s.heading || '').includes('בדקו')));
  });

  it('geometric-proof keeps absent update line and real בדקו H2 from production', () => {
    const page = loadTopicPage('geometric-proof-grade-8');
    assert.equal(page.updatedLine, null);
    assert.equal(page.updatedLinePlacement, 'absent');
    assert.ok(page.sections.some((s) => (s.heading || '') === 'בדקו את עצמכם'));
    assert.equal(page.catalogCtas[0].catalogTopicId, 38);
    assert.equal(page.catalogCtas[0].label, 'פתיחת דפי העבודה ובחירת רמה');
  });

  it('distributive-law preserves H2-before-CTA bodyFlow order (topic 1)', () => {
    const page = loadTopicPage('distributive-law-grade-9');
    assert.ok(page.bodyFlow && page.bodyFlow.length > 0, 'expects captured bodyFlow');
    const skim = page.bodyFlow!
      .filter((b) => b.type === 'heading' || b.type === 'cta' || (b.type === 'paragraph' && b.role === 'intro'))
      .map((b) => {
        if (b.type === 'heading') return `h2:${b.text}`;
        if (b.type === 'cta') return `cta:${b.catalogTopicId}`;
        return 'intro';
      });
    const practiceIdx = skim.findIndex((x) => x.includes('מוכנים לתרגל'));
    const ctaIdx = skim.findIndex((x) => x.startsWith('cta:'));
    assert.ok(practiceIdx >= 0, 'practice H2 present');
    assert.ok(ctaIdx >= 0, 'CTA present');
    assert.ok(practiceIdx < ctaIdx, `H2 before CTA: ${skim.join(' → ')}`);
    assert.equal(page.catalogCtas[0].catalogTopicId, 1);
  });

  it('binomial-square: paragraph-only self-check exact text, topic 44, no invented H2', () => {
    const page = loadTopicPage('binomial-square-grade-9');
    assert.equal(page.catalogCtas[0].catalogTopicId, 44);
    assert.equal(page.sections.length, 1);
    assert.ok(!page.sections.some((s) => hasSelfCheckHeading(s.heading)));
    const selfCheck = page.sections[0].blocks.find(
      (b) => b.type === 'paragraph' && (b.text || '').includes('בדקו את עצמכם')
    );
    assert.ok(selfCheck);
    assert.equal(
      selfCheck!.text,
      'בדקו את עצמכם: מהו הפיתוח של (x−4)²? תשובה: x²−8x+16.'
    );
    assert.ok(!page.sections.some((s) => (s.heading || '') === 'בדקו את עצמכם'));
  });

  it('difference-of-squares: paragraph-only self-check exact text, topic 45, no invented H2', () => {
    const page = loadTopicPage('difference-of-squares-grade-9');
    assert.equal(page.catalogCtas[0].catalogTopicId, 45);
    assert.equal(page.sections.length, 1);
    assert.ok(!page.sections.some((s) => hasSelfCheckHeading(s.heading)));
    const selfCheck = page.sections[0].blocks.find(
      (b) => b.type === 'paragraph' && (b.text || '').includes('בדקו את עצמכם')
    );
    assert.ok(selfCheck);
    assert.equal(
      selfCheck!.text,
      'בדקו את עצמכם: כיצד מפרקים את x²−49? תשובה: למכפלה של x−7 ושל x+7.'
    );
    assert.ok(!page.sections.some((s) => (s.heading || '') === 'בדקו את עצמכם'));
  });


  it('M22 multi-CTA pages preserve production topic ids in DOM order', () => {
    const adv = loadTopicPage('equations-advanced-grade-7');
    assert.deepEqual(
      adv.catalogCtas.map((c) => c.catalogTopicId),
      [38, 23, 37, 36]
    );
    const both = loadTopicPage('equations-both-sides-word-problems-grade-7');
    assert.deepEqual(
      both.catalogCtas.map((c) => c.catalogTopicId),
      [41, 40, 39]
    );
  });

  it('M22 circle-area keeps paragraph-only self-check under single combined H2', () => {
    const page = loadTopicPage('circle-area-circumference-grade-8');
    assert.equal(page.sections.length, 1);
    assert.ok(!page.sections.some((s) => hasSelfCheckHeading(s.heading)));
    assert.ok(hasParagraphSelfCheck(page));
    assert.equal(page.catalogCtas[0].catalogTopicId, 63);
  });


  it('M23 multi-CTA and bodyFlow quirk pages preserve production order/ids', () => {
    const solids = loadTopicPage('solids-box-cube-prism-grade-7');
    assert.deepEqual(solids.catalogCtas.map((c) => c.catalogTopicId), [48, 47, 20]);
    const cyl = loadTopicPage('cylinder-volume-grade-8');
    assert.ok(cyl.bodyFlow && cyl.bodyFlow.length);
    const skim = cyl.bodyFlow!
      .filter((b) => b.type === 'heading' || b.type === 'cta')
      .map((b) => (b.type === 'heading' ? `h2:${b.text}` : `cta:${b.catalogTopicId}`));
    const ctaIdx = skim.findIndex((x) => x.startsWith('cta:'));
    const checkIdx = skim.findIndex((x) => x.includes('בדקו'));
    assert.ok(ctaIdx >= 0 && checkIdx > ctaIdx, skim.join(' → '));
  });

  it('catalog topic ids resolve for viewer/PDF hrefs', () => {
    const catalog = loadCatalog();
    for (const page of loadAllTopicPages()) {
      const g = catalog.grades.find((x) => x.grade === page.grade)!;
      const topic = g.topics.find((t) => t.id === page.catalogCta.catalogTopicId);
      assert.ok(topic, `missing catalog topic ${page.catalogCta.catalogTopicId}`);
      const level = topic!.levels.find((l) => l.key === 'a') || topic!.levels[0];
      const href = buildWorksheetHref({
        catalog,
        grade: page.grade,
        topic: topic!,
        levelKey: level.key,
        backPath: `/worksheets?grade=${page.grade}`,
      });
      assert.ok(href.includes('worksheet-viewer') || href.endsWith('.pdf'));
    }
  });
});
