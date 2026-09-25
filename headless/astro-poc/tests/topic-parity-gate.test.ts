/**
 * HEADLESS-MIGRATION-19/20 — SOURCE→content/preview parity gate.
 *
 * Production fixtures under tests/fixtures/topic-parity/*.production.json
 * are captured from live production via scripts/capture-topic-parity.ts.
 * Tests compare those fixtures to migrated TopicPageContent (not a mirror of
 * themselves) and fail on missing/duplicated educational or FAQ material.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
  TOPIC_PAGE_SLUGS,
  loadTopicPage,
} from '../src/lib/topicPages.ts';
import {
  assertJsonLdFaqVisible,
  assertNoParityErrors,
  diffJsonLdFaqVisibility,
  diffTopicParity,
  stripBidiIsolates,
  type TopicParitySnapshot,
} from '../src/lib/parity/topicParity.ts';
import { contentToParitySnapshot } from '../src/lib/parity/contentToParitySnapshot.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'tests', 'fixtures', 'topic-parity');

function loadProductionFixture(slug: string): TopicParitySnapshot {
  const path = join(fixtureDir, `${slug}.production.json`);
  assert.ok(existsSync(path), `missing production fixture: ${path}`);
  const data = JSON.parse(readFileSync(path, 'utf8')) as TopicParitySnapshot;
  assert.equal(data.slug, slug);
  assert.equal(data.source, 'production');
  assert.ok(data.title && data.h1 && data.description);
  assert.ok(data.intro && data.intro.length >= 40, `${slug}: fixture missing intro`);
  assert.notEqual(data.intro, data.h1, `${slug}: fixture intro is H1 echo`);
  assert.ok(data.sections.length >= 1);
  assert.ok(data.faqGroups.length >= 1);
  assert.ok(
    (data.catalogCtas?.length || 0) >= 1 || data.catalogCta,
    `${slug}: fixture missing CTAs`
  );
  return data;
}

function hasSelfCheckHeading(heading: string | null | undefined): boolean {
  const h = heading || '';
  return (
    h.includes('בדקו') ||
    h.includes('בדיקה') ||
    /\?$/.test(h) ||
    /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(h)
  );
}

function hasParagraphSelfCheck(source: TopicParitySnapshot | { sections: { paragraphs?: string[]; blocks?: { type: string; text?: string }[] }[] }): boolean {
  return source.sections.some((s) => {
    const paras =
      ('paragraphs' in s && s.paragraphs) ||
      (('blocks' in s && s.blocks) || [])
        .filter((b: { type: string }) => b.type === 'paragraph')
        .map((b: { text?: string }) => b.text || '');
    return (paras as string[]).some((p) => p.includes('בדקו את עצמכם'));
  });
}

describe('topic SOURCE→content parity gate (M19/M20)', () => {
  it('has production fixtures for every migrated topic slug', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      assert.ok(
        existsSync(join(fixtureDir, `${slug}.production.json`)),
        `missing fixture for ${slug}`
      );
    }
    const files = readdirSync(fixtureDir).filter((f) => f.endsWith('.production.json'));
    assert.ok(files.length >= TOPIC_PAGE_SLUGS.length);
  });

  it('migrated content matches production fixtures (SEO, intro, sections, FAQ, CTAs, JSON-LD)', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      const source = loadProductionFixture(slug);
      const page = loadTopicPage(slug);
      const preview = contentToParitySnapshot(page, 'preview');

      assert.ok(source.intro && source.intro.length >= 40, `${slug}: fixture intro`);
      assert.notEqual(source.intro, source.h1, `${slug}: fixture intro must not be H1`);
      assert.equal(page.intro, source.intro, `${slug}: content intro must match fixture`);
      assert.notEqual(page.intro, page.h1, `${slug}: content intro must not echo H1`);

      // Content must not invent update lines when production has none
      if (!source.updatedLine) {
        assert.equal(page.updatedLine, null, `${slug}: invented updatedLine`);
        assert.equal(page.updatedLinePlacement, 'absent');
      }

      const diffs = diffTopicParity(source, preview);
      const filtered =
        source.images.length === 0
          ? diffs.filter((d) => d.field !== 'images')
          : diffs;
      assertNoParityErrors(filtered, slug);
    }
  });

  it('equations-basics fixture/content include full intro and three CTAs (regression)', () => {
    const source = loadProductionFixture('equations-basics-grade-7');
    const page = loadTopicPage('equations-basics-grade-7');
    assert.ok(source.intro.startsWith('מבינים מהו פתרון של משוואה'));
    assert.equal(page.intro, source.intro);
    assert.notEqual(page.intro, page.h1);
    const topics = page.catalogCtas.map((c) => c.catalogTopicId);
    assert.deepEqual(topics, [23, 34, 32]);
    assert.equal(page.catalogCtas.length, 3);
    // Gate must fail if intro were H1-echo
    const bad = contentToParitySnapshot({ ...page, intro: page.h1 }, 'preview');
    const diffs = diffTopicParity(source, bad);
    assert.ok(diffs.some((d) => d.field === 'intro' && d.severity === 'error'));
    // Gate must fail if a CTA is dropped
    const oneCta = contentToParitySnapshot(
      { ...page, catalogCtas: [page.catalogCtas[0]], catalogCta: page.catalogCtas[0] },
      'preview'
    );
    const ctaDiffs = diffTopicParity(source, oneCta);
    assert.ok(ctaDiffs.some((d) => d.field.startsWith('catalogCtas') && d.severity === 'error'));
  });

  it('fails on duplicated FAQ questions in migrated content', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      const qs = page.faqGroups.flatMap((g) => g.items.map((i) => i.question));
      const seen = new Set<string>();
      for (const q of qs) {
        // Across groups, identical Q strings would be duplication noise —
        // signed-numbers intentionally has two different groups, so only
        // flag exact duplicates within the flattened list when count>1 for same Q.
        const n = qs.filter((x) => x === q).length;
        assert.equal(n, 1, `${slug}: duplicated FAQ question: ${q}`);
        seen.add(q);
      }
    }
  });

  it('M19/M20/M21 routes preserve production educational headings and self-check', () => {
    for (const slug of [...TOPIC_PAGE_M19_SLUGS, ...TOPIC_PAGE_M20_SLUGS, ...TOPIC_PAGE_M21_SLUGS, ...TOPIC_PAGE_M22_SLUGS, ...TOPIC_PAGE_M23_SLUGS]) {
      const source = loadProductionFixture(slug);
      const page = loadTopicPage(slug);
      const srcHeads = source.sections.map((s) => s.heading).filter(Boolean);
      const pageHeads = page.sections.map((s) => s.heading || '');
      for (const h of srcHeads) {
        assert.ok(pageHeads.includes(h), `${slug}: missing heading ${h}`);
      }
      assert.ok(
        pageHeads.some((h) => hasSelfCheckHeading(h)) || hasParagraphSelfCheck(page),
        `${slug}: missing self-check (heading or paragraph)`
      );
      // Do not invent a dedicated בדקו H2 when production only has paragraph self-check
      if (hasParagraphSelfCheck(source) && !source.sections.some((s) => hasSelfCheckHeading(s.heading))) {
        assert.ok(
          !page.sections.some((s) => (s.heading || '') === 'בדקו את עצמכם'),
          `${slug}: invented self-check H2`
        );
      }
      const srcParas = source.sections.flatMap((s) => s.paragraphs).filter((p) => p.length > 12);
      const pageParas = page.sections
        .flatMap((s) => s.blocks.filter((b) => b.type === 'paragraph').map((b) => b.text || ''))
        .filter((p) => p.length > 12);
      assert.ok(
        pageParas.length >= srcParas.length,
        `${slug}: truncated paragraphs ${pageParas.length} < ${srcParas.length}`
      );
    }
  });

  it('distributive-law SOURCE→content preserves H2 before worksheet CTA in bodyFlow', () => {
    const source = loadProductionFixture('distributive-law-grade-9');
    const page = loadTopicPage('distributive-law-grade-9');
    const preview = contentToParitySnapshot(page, 'preview');
    assert.ok(source.bodyFlow && source.bodyFlow.length, 'fixture must include bodyFlow');
    const diffs = diffTopicParity(source, preview).filter((d) => d.field.startsWith('bodyFlow'));
    assertNoParityErrors(diffs, 'distributive-law-bodyFlow');
    const srcSkim = (source.bodyFlow || [])
      .filter((b) => b.type === 'heading' || b.type === 'cta')
      .map((b) => (b.type === 'heading' ? b.text : `cta`));
    const practiceIdx = srcSkim.findIndex((t) => t.includes('מוכנים לתרגל'));
    const ctaIdx = srcSkim.findIndex((t) => t === 'cta');
    assert.ok(practiceIdx >= 0 && practiceIdx < ctaIdx);
  });

  it('binomial-square and difference-of-squares migrated with exact paragraph self-check', () => {
    for (const slug of ['binomial-square-grade-9', 'difference-of-squares-grade-9'] as const) {
      assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes(slug));
      const source = loadProductionFixture(slug);
      const page = loadTopicPage(slug);
      assert.equal(source.sections.length, 1);
      assert.ok(hasParagraphSelfCheck(source));
      assert.ok(!source.sections.some((s) => hasSelfCheckHeading(s.heading)));
      const expected =
        slug === 'binomial-square-grade-9'
          ? 'בדקו את עצמכם: מהו הפיתוח של (x−4)²? תשובה: x²−8x+16.'
          : 'בדקו את עצמכם: כיצד מפרקים את x²−49? תשובה: למכפלה של x−7 ושל x+7.';
      const pageText = page.sections[0].blocks.find(
        (b) => b.type === 'paragraph' && (b.text || '').includes('בדקו את עצמכם')
      )?.text;
      assert.equal(pageText, expected);
      assert.equal(
        page.catalogCtas[0].catalogTopicId,
        slug === 'binomial-square-grade-9' ? 44 : 45
      );
      const diffs = diffTopicParity(source, contentToParitySnapshot(page, 'preview'));
      const filtered =
        source.images.length === 0 ? diffs.filter((d) => d.field !== 'images') : diffs;
      assertNoParityErrors(filtered, slug);
      assertJsonLdFaqVisible(contentToParitySnapshot(page, 'preview'), slug);
    }
  });

  it('algebraic-expressions fixture/content keep three CTAs (regression)', () => {
    const source = loadProductionFixture('algebraic-expressions-grade-7');
    const page = loadTopicPage('algebraic-expressions-grade-7');
    assert.ok(source.intro.length >= 40);
    assert.notEqual(source.intro, source.h1);
    assert.equal(page.intro, source.intro);
    assert.deepEqual(
      page.catalogCtas.map((c) => c.catalogTopicId),
      [30, 23, 22]
    );
    assert.equal(page.catalogCtas.length, 3);
  });

  it('same-origin worksheet CTAs use production github topic ids (all CTAs, DOM order)', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      const source = loadProductionFixture(slug);
      const page = loadTopicPage(slug);
      const srcCtas =
        (source as { catalogCtas?: { href: string; label: string }[] }).catalogCtas?.length
          ? (source as { catalogCtas: { href: string; label: string }[] }).catalogCtas
          : source.catalogCta
            ? [source.catalogCta]
            : [];
      assert.equal(page.catalogCtas.length, Math.max(srcCtas.length, 1), slug);
      for (let i = 0; i < srcCtas.length; i++) {
        const m = srcCtas[i].href.match(/[?&]topic=(\d+)/);
        assert.ok(m, `${slug} CTA[${i}]`);
        assert.equal(String(page.catalogCtas[i].catalogTopicId), m![1], `${slug} CTA[${i}]`);
        assert.equal(page.catalogCtas[i].label, srcCtas[i].label, `${slug} CTA[${i}] label`);
      }
    }
  });

  it('FAQ parity is semantic Q&A (not markup-dependent on summary/details)', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      const source = loadProductionFixture(slug);
      const page = loadTopicPage(slug);
      const srcFaq = source.faqGroups.flatMap((g) => g.items);
      const pageFaq = page.faqGroups.flatMap((g) => g.items);
      for (const item of srcFaq) {
        assert.ok(
          pageFaq.some(
            (p) =>
              stripBidiIsolates(p.question) === item.question &&
              stripBidiIsolates(p.answer) === item.answer
          ),
          `${slug}: missing semantic FAQ ${item.question}`
        );
      }
      const tpl = readFileSync(join(root, 'src', 'components', 'TopicPage.astro'), 'utf8');
      assert.ok(tpl.includes('data-faq-item'));
      assert.ok(tpl.includes('<h3>{item.question}</h3>') || tpl.includes('<h3>'));
    }
  });
});

describe('topic schema-visibility gate (LD ⊆ visible FAQ)', () => {
  it('every migrated preview content has JSON-LD FAQ visible on the page', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      const snapshot = contentToParitySnapshot(page, 'preview');
      assertJsonLdFaqVisible(snapshot, slug);
    }
  });

  it('schema-visibility fails if a migrated page drops LD FAQ from visible text', () => {
    const page = loadTopicPage('powers-grade-7');
    const bad = contentToParitySnapshot(
      {
        ...page,
        faqGroups: page.faqGroups.map((g) => ({
          ...g,
          items: g.items.filter((_, i) => i > 0),
        })),
      },
      'preview'
    );
    const diffs = diffJsonLdFaqVisibility(bad);
    assert.ok(diffs.some((d) => d.field === 'jsonLd.faqVisibility' && d.severity === 'error'));
  });
});

describe('triangle-area-grade-7 LD FAQ visibility correction (M30)', () => {
  it('migrated preview FAQ exactly equals source JSON-LD (documented correction)', () => {
    assert.deepEqual([...TOPIC_PAGE_M20_UNMIGRATED], []);
    assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes('triangle-area-grade-7'));
    const source = loadProductionFixture('triangle-area-grade-7');
    const page = loadTopicPage('triangle-area-grade-7');
    const preview = contentToParitySnapshot(page, 'preview');
    // Production fixture FAQ was synced to LD for SOURCE→content; LD still authoritative
    assert.equal(source.jsonLd.faq.length, 3);
    for (const item of source.jsonLd.faq) {
      assert.ok(
        preview.faqGroups
          .flatMap((g) => g.items)
          .some((v) => v.question === item.question && v.answer === item.answer),
        `LD not visible in preview: ${item.question}`
      );
    }
    assert.equal(
      preview.faqGroups[0].items[0].question,
      'האם דפי העבודה בנושא שטח משולש לכיתה ז׳ מתאימים לכיתה ז׳?'
    );
    assertJsonLdFaqVisible(preview);
    const diffs = diffTopicParity(source, preview).filter((d) => d.field !== 'images');
    assertNoParityErrors(diffs, 'triangle-area-m30');
  });
});

describe('M21 paragraph-only self-check pattern (migrated)', () => {
  it('M21_UNMIGRATED is empty; binomial/difference fixtures keep paragraph self-check only', () => {
    assert.deepEqual([...TOPIC_PAGE_M21_UNMIGRATED], []);
    for (const slug of ['binomial-square-grade-9', 'difference-of-squares-grade-9'] as const) {
      assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes(slug));
      const source = loadProductionFixture(slug);
      assert.ok(source.intro && source.intro.length >= 40);
      assert.equal(source.sections.length, 1);
      assert.ok(
        source.sections[0].paragraphs.some((p) => p.includes('בדקו את עצמכם')),
        `${slug}: expected paragraph self-check in fixture`
      );
      assert.ok(
        !source.sections.some((s) => hasSelfCheckHeading(s.heading)),
        `${slug}: must not invent a self-check H2 on source`
      );
    }
  });
});

describe('M22 + M30 AA preH1 CTA + regressions', () => {
  it('triangle-similarity-aa migrated with preH1Ctas; CTA absent from post-H1 bodyFlow', () => {
    assert.deepEqual([...TOPIC_PAGE_M22_UNMIGRATED], []);
    assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes('triangle-similarity-aa-grade-9'));
    const source = loadProductionFixture('triangle-similarity-aa-grade-9');
    const page = loadTopicPage('triangle-similarity-aa-grade-9');
    assert.ok(page.preH1Ctas && page.preH1Ctas.length > 0);
    assert.ok(!(source.bodyFlow || []).some((b) => b.type === 'cta'));
    assert.ok(!(page.bodyFlow || []).some((b) => b.type === 'cta'));
    const diffs = diffTopicParity(source, contentToParitySnapshot(page, 'preview')).filter(
      (d) => d.field !== 'images'
    );
    assertNoParityErrors(diffs, 'aa-m30');
  });

  it('distributive-law still H2-before-CTA after M22 (regression)', () => {
    const source = loadProductionFixture('distributive-law-grade-9');
    const page = loadTopicPage('distributive-law-grade-9');
    const diffs = diffTopicParity(source, contentToParitySnapshot(page, 'preview')).filter((d) =>
      d.field.startsWith('bodyFlow')
    );
    assertNoParityErrors(diffs, 'distributive-regression');
  });

  it('binomial/difference paragraph self-check still exact after M22 (regression)', () => {
    for (const [slug, topic, text] of [
      [
        'binomial-square-grade-9',
        44,
        'בדקו את עצמכם: מהו הפיתוח של (x−4)²? תשובה: x²−8x+16.',
      ],
      [
        'difference-of-squares-grade-9',
        45,
        'בדקו את עצמכם: כיצד מפרקים את x²−49? תשובה: למכפלה של x−7 ושל x+7.',
      ],
    ] as const) {
      const page = loadTopicPage(slug);
      assert.equal(page.catalogCtas[0].catalogTopicId, topic);
      const p = page.sections[0].blocks.find(
        (b) => b.type === 'paragraph' && (b.text || '').includes('בדקו את עצמכם')
      );
      assert.equal(p?.text, text);
    }
  });
});

describe('M30 closes remaining topic-SEO gaps', () => {
  it('M23/M30 unmigrated empty; four pages + equations redirect registered', () => {
    assert.deepEqual([...TOPIC_PAGE_M23_UNMIGRATED], []);
    assert.deepEqual([...TOPIC_PAGE_M30_UNMIGRATED], []);
    assert.equal(TOPIC_PAGE_M23_SLUGS.length, 23);
    assert.equal(TOPIC_PAGE_M30_SLUGS.length, 4);
    for (const slug of TOPIC_PAGE_M30_SLUGS) {
      assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes(slug));
      const source = loadProductionFixture(slug);
      const page = loadTopicPage(slug);
      const diffs = diffTopicParity(source, contentToParitySnapshot(page, 'preview')).filter(
        (d) => d.field !== 'images'
      );
      assertNoParityErrors(diffs, `m30-${slug}`);
      assertJsonLdFaqVisible(contentToParitySnapshot(page, 'preview'));
    }
    assert.deepEqual(TOPIC_PAGE_M30_REDIRECTS, [
      { from: 'equations-grade-7', to: '/equations-basics-grade-7' },
    ]);
  });
});
