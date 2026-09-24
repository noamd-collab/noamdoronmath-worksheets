#!/usr/bin/env node
/**
 * Capture a normalized TopicParitySnapshot from production or preview via headless Chrome.
 * Also emits TopicPageContent-shaped JSON for migration when --emit-content is set.
 *
 * Usage:
 *   npx tsx scripts/capture-topic-parity.ts --slug equations-basics-grade-7
 *   npx tsx scripts/capture-topic-parity.ts --all-m19
 *   npx tsx scripts/capture-topic-parity.ts --slug X --base https://preview... --source preview
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import type { TopicParitySnapshot } from '../src/lib/parity/topicParity.ts';
import { TOPIC_PARITY_EXTRACTOR } from './topic-parity-extractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const FIXTURE_DIR = join(root, 'tests', 'fixtures', 'topic-parity');
const DATA_DIR = join(root, 'src', 'data', 'topic-pages');
const PROD = 'https://www.noamdoronmath.co.il';

const M19_SLUGS = [
  'equations-basics-grade-7',
  'coordinate-plane-quadrants-grade-7',
  'linear-function-grade-8',
  'triangle-congruence-grade-8',
  'quadratic-equations-grade-9',
  'rectangle-grade-9',
];

const M18_SLUGS = [
  'signed-numbers-grade-7',
  'pythagorean-theorem-grade-8',
  'quadratic-function-grade-9',
];

const M20_SLUGS = [
  'pythagorean-theorem-grade-7',
  'algebraic-expressions-grade-7',
  'powers-grade-7',
  'triangle-area-grade-7',
  'systems-of-equations-grade-8',
  'statistics-grade-8',
  'geometric-proof-grade-8',
  'similar-triangles-grade-8',
  'factoring-grade-9',
  'linear-function-grade-9',
  'parallelogram-grade-9',
  'square-grade-9',
];



/** M23 — remaining audited live topic-SEO gaps (excl redirects + known inconsistent). */
const M23_SLUGS = [
  'angles-grade-7',
  'area-parallelogram-trapezoid-composite-grade-7',
  'area-rectangle-perimeter-grade-7',
  'composite-polygons-area-grade-9',
  'cone-grade-8',
  'congruent-polygons-transformations-grade-9',
  'cylinder-surface-area-grade-8',
  'cylinder-volume-grade-8',
  'isosceles-triangle-grade-9',
  'parallelogram-trapezoid-area-grade-9',
  'patterns-and-graphs-grade-7',
  'probability-grade-9',
  'pythagoras-applications-grade-9',
  'pythagoras-basics-grade-9',
  'pythagorean-theorem-grade-9',
  'rectangle-square-area-grade-9',
  'solids-box-cube-prism-grade-7',
  'special-triangles-grade-7-new',
  'statistics-grade-9',
  'transition-to-high-school-grade-9',
  'triangle-area-grade-9',
  'triangle-calculations-grade-9',
  'triangle-sides-angles-grade-9',
  'triangular-prism-surface-area-grade-9',
  'triangular-prism-volume-grade-9',
];

/** M22 — next 8 unported per grade hub (live order); excl migrated + triangle-area. */
const M22_SLUGS = [
  'angles-review-grade-7',
  'triangle-quadrilateral-angle-sum-grade-7',
  'coordinate-plane-four-quadrants-grade-7',
  'coordinate-plane-scale-grade-7',
  'coordinate-plane-applications-grade-7',
  'equations-advanced-grade-7',
  'equations-both-sides-word-problems-grade-7',
  'pythagoras-applications-grade-7',
  'isosceles-triangle-grade-8',
  'triangle-median-grade-8',
  'parallel-lines-angles-grade-8',
  'triangle-similarity-proof-grade-8',
  'similar-triangles-area-ratio-grade-8',
  'advanced-pythagoras-grade-8',
  'pythagoras-in-space-grade-8',
  'circle-area-circumference-grade-8',
  'precalculus-functions-graphs-grade-9',
  'reading-graphs-grade-9',
  'analytic-geometry-grade-9',
  'coordinate-plane-applications-grade-9',
  'rhombus-grade-9',
  'trapezoid-grade-9',
  'similar-triangles-grade-9',
  'triangle-30-60-90-grade-9',
];

/** M21 — first 8 unported per grade hub (live order); excl migrated + triangle-area. */
const M21_SLUGS = [
  'combining-like-terms-grade-7',
  'multiplying-signed-numbers-grade-7',
  'dividing-signed-numbers-grade-7',
  'order-of-operations-signed-numbers-grade-7',
  'number-line-absolute-value-grade-7',
  'square-root-grade-7',
  'angles-introduction-measurement-grade-7',
  'adjacent-vertical-angles-grade-7',
  'linear-equations-grade-8',
  'inequalities-grade-8',
  'percentage-problems-grade-8',
  'coordinate-plane-grade-8',
  'congruence-theorems-grade-8',
  'triangle-congruence-proofs-grade-8',
  'exterior-angle-triangle-grade-8',
  'isosceles-triangle-properties-grade-8',
  'distributive-law-grade-9',
  'quadratic-inequalities-systems-grade-9',
  'exponent-rules-grade-9',
  'square-roots-grade-9',
  'word-problems-grade-9',
  'binomial-square-grade-9',
  'difference-of-squares-grade-9',
  'algebraic-fractions-grade-9',
];

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function has(flag: string) {
  return process.argv.includes(flag);
}

function gradeFromSlug(slug: string): number {
  // Prefer trailing grade-N; also accept grade-N-new / grade-N-... suffixes.
  const m = slug.match(/grade-([1-9])(?:$|[^0-9])/);
  if (!m) throw new Error(`Cannot parse grade from ${slug}`);
  return Number(m[1]);
}

/** Best-effort catalog topic match from production CTA github URL or title heuristics. */
function resolveCatalogTopic(
  slug: string,
  grade: number,
  githubHref: string | null,
  h1: string
): { id: number; title: string } | null {
  const catalog = loadCatalog();
  const g = catalog.grades.find((x) => x.grade === grade);
  if (!g) return null;
  if (githubHref) {
    const m = githubHref.match(/[?&]topic=(\d+)/);
    if (m) {
      const id = Number(m[1]);
      const topic = g.topics.find((t) => t.id === id);
      if (topic) return { id: topic.id, title: topic.title };
    }
  }
  // Heuristic keyword match on h1 / slug
  const keys: Record<string, string[]> = {
    'equations-basics-grade-7': ['משוואות ופתרונן חלק 1', 'מבוא'],
    'coordinate-plane-quadrants-grade-7': ['מערכת צירים', 'היכרות'],
    'linear-function-grade-8': ['פונקציה קווית'],
    'triangle-congruence-grade-8': ['חפיפת משולשים'],
    'quadratic-equations-grade-9': ['משוואות ריבועיות'],
    'rectangle-grade-9': ['המלבן'],
    'signed-numbers-grade-7': ['חיבור וחיסור מספרים מכוונים'],
    'pythagorean-theorem-grade-8': ['פיתגורס'],
    'quadratic-function-grade-9': ['הפונקציה הריבועית'],
    'pythagorean-theorem-grade-7': ['פיתגורס'],
    'algebraic-expressions-grade-7': ['ביטויים אלגבריים'],
    'powers-grade-7': ['חזקות'],
    'triangle-area-grade-7': ['שטח משולש'],
    'systems-of-equations-grade-8': ['מערכות'],
    'statistics-grade-8': ['ממוצע'],
    'geometric-proof-grade-8': ['הוכחה גאומטרית'],
    'similar-triangles-grade-8': ['דמיון'],
    'factoring-grade-9': ['פירוק לגורמים'],
    'linear-function-grade-9': ['פונקציה קווית'],
    'parallelogram-grade-9': ['המקבילית'],
    'square-grade-9': ['הריבוע'],
  };
  const needle = keys[slug] || [h1.slice(0, 12)];
  for (const t of g.topics) {
    if (needle.every((n) => t.title.includes(n)) || needle.some((n) => n.length > 6 && t.title.includes(n))) {
      // Prefer exact-ish
      if (needle[0] && t.title.includes(needle[0])) return { id: t.id, title: t.title };
    }
  }
  for (const t of g.topics) {
    if (needle.some((n) => t.title.includes(n))) return { id: t.id, title: t.title };
  }
  return null;
}

async function capturePage(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  slug: string,
  base: string,
  source: 'production' | 'preview'
): Promise<{ snapshot: TopicParitySnapshot; raw: Record<string, unknown> }> {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const url = `${base.replace(/\/$/, '')}/${slug}`;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2800));

  const raw = (await page.evaluate((code: string) => {
    // eslint-disable-next-line no-eval
    return (0, eval)('(' + code + ')')();
  }, TOPIC_PARITY_EXTRACTOR)) as Record<string, any>;

  await page.close();

  // Post-process FAQ for signed-numbers style: if only one group from ng-faq but body has two headings
  // The evaluate already handles dual h2. For first group rich-text parsing, re-check from body if needed.

  const snapshot: TopicParitySnapshot = {
    slug,
    source,
    url,
    capturedAt: new Date().toISOString(),
    httpStatus: resp?.status(),
    title: raw.title,
    description: raw.description,
    h1: raw.h1,
    intro: raw.intro || '',
    updatedLine: raw.updatedLine,
    authorLine: raw.authorLine,
    authorAboutHref: raw.authorAboutHref,
    sections: raw.sections,
    bodyFlow: Array.isArray(raw.bodyFlow) ? raw.bodyFlow : [],
    faqGroups: raw.faqGroups,
    relatedLinks: raw.relatedLinks,
    catalogCta: raw.catalogCta,
    catalogCtas: Array.isArray(raw.catalogCtas) ? raw.catalogCtas : raw.catalogCta ? [raw.catalogCta] : [],
    images: raw.images,
    jsonLd: { types: raw.jsonLdTypes, faq: raw.jsonLdFaq },
  };

  return { snapshot, raw };
}

function paragraphSelfCheckInSections(
  sections: { heading?: string | null; paragraphs?: string[]; blocks?: { type: string; text?: string }[] }[]
): boolean {
  return sections.some((s) => {
    const paras =
      s.paragraphs ||
      (s.blocks || []).filter((b) => b.type === 'paragraph').map((b) => b.text || '');
    return paras.some((p) => (p || '').includes('בדקו את עצמכם'));
  });
}

function bodyFlowHasSelfCheck(
  flow: { type: string; text?: string }[] | undefined
): boolean {
  if (!flow?.length) return false;
  return flow.some((b) => {
    if (b.type === 'heading') {
      const h = b.text || '';
      return (
        h.includes('בדקו') ||
        h.includes('בדיקה') ||
        /\?$/.test(h) ||
        /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(h)
      );
    }
    if (b.type === 'paragraph') return (b.text || '').includes('בדקו את עצמכם');
    return false;
  });
}

function snapshotToContent(
  slug: string,
  snapshot: TopicParitySnapshot,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const grade = gradeFromSlug(slug);
  const githubLinks = (
    (snapshot.catalogCtas?.length ? snapshot.catalogCtas : snapshot.catalogCta ? [snapshot.catalogCta] : []) as {
      href: string;
      label: string;
    }[]
  ).filter((c) => c.href?.includes('github.io') || c.href?.includes('topic='));

  const catalogCtas = githubLinks.map((link) => {
    const topic = resolveCatalogTopic(slug, grade, link.href.includes('github.io') ? link.href : null, snapshot.h1);
    const m = link.href.match(/[?&]topic=(\d+)/);
    const id = topic?.id ?? (m ? Number(m[1]) : null);
    if (id == null) throw new Error(`Cannot resolve catalog topic for CTA ${link.href} on ${slug}`);
    const catalog = loadCatalog();
    const g = catalog.grades.find((x) => x.grade === grade);
    const titled = g?.topics.find((t) => t.id === id);
    return {
      label: link.label || 'פתיחת דפי העבודה ובחירת רמה',
      href: `/worksheets?grade=${grade}&topic=${id}`,
      source: 'production-github-cta',
      productionHref: link.href.includes('github.io') ? link.href : null,
      catalogTopicId: id,
      catalogTopicTitle: titled?.title || topic?.title || null,
    };
  });
  if (!catalogCtas.length) {
    const topic = resolveCatalogTopic(slug, grade, null, snapshot.h1);
    if (!topic) throw new Error(`Cannot resolve catalog topic for ${slug}`);
    catalogCtas.push({
      label: 'פתיחת דפי העבודה ובחירת רמה',
      href: `/worksheets?grade=${grade}&topic=${topic.id}`,
      source: 'catalog-heuristic',
      productionHref: null,
      catalogTopicId: topic.id,
      catalogTopicTitle: topic.title,
    });
  }

  const faqGroups = snapshot.faqGroups.map((g, i) => ({
    heading: g.heading,
    source: i === 0 && snapshot.jsonLd.faq.length ? 'visible+jsonld' : 'visible',
    items: g.items,
  }));
  const faq = faqGroups.flatMap((g) => g.items);

  // Placement: dual FAQ => after-first-faq-group; no update line => absent; else after-sections
  const updatedLinePlacement = !snapshot.updatedLine
    ? 'absent'
    : faqGroups.length > 1
      ? 'after-first-faq-group'
      : 'after-sections';

  const relatedTopics = snapshot.relatedLinks
    .map((l) => {
      try {
        const u = new URL(l.href);
        const path = u.pathname.replace(/\/$/, '') || '/';
        // Keep topic SEO links and exact grade-hub links (e.g. "כל דפי כיתה ז׳").
        const isGradeHub = /^\/grade-[1-9]$/.test(path);
        const isTopicSeo = /grade-[1-9]$/.test(path) && !isGradeHub;
        if (!isGradeHub && !isTopicSeo) return null;
        return {
          path,
          label: l.label,
          productionHref: `https://www.noamdoronmath.co.il${path}`,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Deduplicate related
  const seenRel = new Set<string>();
  const relatedUnique = [];
  for (const r of relatedTopics) {
    if (!r || seenRel.has(r.path)) continue;
    seenRel.add(r.path);
    relatedUnique.push(r);
  }

  const sections = snapshot.sections.map((s) => ({
    heading: s.heading,
    blocks: [
      ...s.paragraphs.map((text) => ({ type: 'paragraph', text, links: [] })),
      ...(s.listItems.length
        ? [{ type: 'list', ordered: false, items: s.listItems, links: [] }]
        : []),
    ],
  }));

  // Ensure required educational content exists (heading names vary by topic)
  if (!sections.length) {
    throw new Error(`${slug}: no pedagogical sections in capture`);
  }
  const paraCount = sections.reduce((n, s) => n + s.blocks.filter((b) => b.type === 'paragraph').length, 0);
  if (paraCount < 2) {
    throw new Error(`${slug}: too few educational paragraphs (${paraCount})`);
  }
  const hasSelfCheckHeading = snapshot.sections.some(
    (s) =>
      (s.heading || '').includes('בדקו') ||
      (s.heading || '').includes('בדיקה') ||
      /\?$/.test(s.heading || '') ||
      /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(s.heading || '')
  );
  const hasParagraphSelfCheck =
    paragraphSelfCheckInSections(snapshot.sections) ||
    bodyFlowHasSelfCheck(snapshot.bodyFlow);
  if (!hasSelfCheckHeading && !hasParagraphSelfCheck) {
    throw new Error(`${slug}: missing self-check section in capture`);
  }
  if (faqGroups.length < 1) {
    throw new Error(`${slug}: missing FAQ groups in capture`);
  }

  // Ordered body flow from production DOM (H2 / paragraph / CTA). Remap CTA hrefs.
  const rawFlow = Array.isArray(snapshot.bodyFlow) ? snapshot.bodyFlow : [];
  const bodyFlow = rawFlow
    .map((b) => {
      if (b.type === 'cta') {
        const m = (b.href || '').match(/[?&]topic=(\d+)/);
        const id = m ? Number(m[1]) : (b as { catalogTopicId?: number | null }).catalogTopicId;
        if (id == null) return null;
        return {
          type: 'cta' as const,
          label: b.label || 'פתיחת דפי העבודה ובחירת רמה',
          href: `/worksheets?grade=${grade}&topic=${id}`,
          catalogTopicId: id,
        };
      }
      if (b.type === 'paragraph') {
        return {
          type: 'paragraph' as const,
          text: b.text,
          role: (b as { role?: string }).role as 'intro' | 'self-check' | 'body' | undefined,
        };
      }
      if (b.type === 'heading') return { type: 'heading' as const, text: b.text };
      if (b.type === 'list') {
        return {
          type: 'list' as const,
          ordered: !!(b as { ordered?: boolean }).ordered,
          items: (b as { items: string[] }).items || [],
        };
      }
      return null;
    })
    .filter(Boolean);

  // Align JSON-LD FAQ with visible: keep production JSON-LD as captured (do not invent)
  const jsonLd = raw.jsonLdRaw as Record<string, unknown>;
  if (!jsonLd) throw new Error(`${slug}: missing JSON-LD`);

  // Content images — prefer non-og large images
  const ogImage = (raw.ogImage as string) || snapshot.images[0]?.src || null;
  const images = snapshot.images.map((img, i) => ({
    src: img.src,
    alt: img.alt || snapshot.h1,
    role: img.src === ogImage ? 'og' : i === 0 ? 'content-candidate' : 'content-candidate',
  }));

  return {
    slug,
    path: `/${slug}`,
    grade,
    sourceUrl: `${PROD}/${slug}`,
    fetchedAt: snapshot.capturedAt,
    verifiedVia: 'production-headless-chrome-parity-snapshot',
    title: snapshot.title,
    description: snapshot.description,
    ogImage,
    h1: snapshot.h1,
    intro: (() => {
      const intro = String(snapshot.intro || raw.intro || '').trim();
      if (!intro || intro === snapshot.h1) {
        throw new Error(`${slug}: capture missing real intro (got H1 echo or empty)`);
      }
      if (intro.length < 40) {
        throw new Error(`${slug}: intro too short: ${intro}`);
      }
      return intro;
    })(),
    sections,
    bodyFlow,
    updatedLine: snapshot.updatedLine,
    updatedLinePlacement,
    faqHeading: 'שאלות נפוצות',
    faq,
    faqGroups,
    author: {
      text: snapshot.authorLine || 'נכתב ונערך על ידי נועם דורון, מורה למתמטיקה.',
      links: snapshot.authorAboutHref
        ? [{ href: snapshot.authorAboutHref, label: 'נועם דורון' }]
        : [{ href: `${PROD}/aboutus`, label: 'נועם דורון' }],
    },
    relatedTopics: relatedUnique,
    catalogCta: catalogCtas[0],
    catalogCtas,
    gradeHubHref: `/grade-${grade}`,
    jsonLd,
    terms: {
      label: 'תנאי השימוש',
      href: `${PROD}/conditionforfreeworksheets`,
    },
    images,
  };
}

async function main() {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });

  let slugs: string[] = [];
  if (has('--all-m19')) slugs = [...M19_SLUGS];
  else if (has('--all-m18')) slugs = [...M18_SLUGS];
  else if (has('--all-m20')) slugs = [...M20_SLUGS];
  else if (has('--all-m21')) slugs = [...M21_SLUGS];
  else if (has('--all-m22')) slugs = [...M22_SLUGS];
  else if (has('--all-m23')) slugs = [...M23_SLUGS];
  else if (has('--all-topics')) slugs = [...M18_SLUGS, ...M19_SLUGS, ...M20_SLUGS, ...M21_SLUGS, ...M22_SLUGS, ...M23_SLUGS];
  else if (arg('--slug')) slugs = [arg('--slug')!];
  else {
    console.error('Pass --slug X | --all-m19 | --all-m18 | --all-m20 | --all-m21 | --all-m22 | --all-m23 | --all-topics');
    process.exit(1);
  }

  const base = arg('--base') || PROD;
  const source = (arg('--source') as 'production' | 'preview') || 'production';
  const emitContent = has('--emit-content');

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const results: { slug: string; ok: boolean; error?: string }[] = [];

  for (const slug of slugs) {
    try {
      console.log(`\n=== Capturing ${slug} from ${base} ===`);
      const { snapshot, raw } = await capturePage(browser, slug, base, source);

      // Validate minimum fidelity
      if (!snapshot.h1 || !snapshot.title || !snapshot.description) {
        throw new Error('Missing SEO fields');
      }
      if (!snapshot.intro || snapshot.intro.length < 40 || snapshot.intro === snapshot.h1) {
        throw new Error(
          `Missing/invalid intro (len=${snapshot.intro?.length || 0}, equalsH1=${snapshot.intro === snapshot.h1})`
        );
      }
      const ctas =
        snapshot.catalogCtas?.length > 0
          ? snapshot.catalogCtas
          : snapshot.catalogCta
            ? [snapshot.catalogCta]
            : [];
      if (!ctas.length) {
        throw new Error('Missing worksheet CTAs');
      }
      if (!snapshot.sections.length) {
        throw new Error('Missing pedagogical sections');
      }
      const hasSelfCheckHeading = snapshot.sections.some(
        (s) =>
          (s.heading || '').includes('בדקו') ||
          (s.heading || '').includes('בדיקה') ||
          /\?$/.test(s.heading || '') ||
          /^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(s.heading || '')
      );
      const hasParagraphSelfCheck =
        paragraphSelfCheckInSections(snapshot.sections) ||
        bodyFlowHasSelfCheck(snapshot.bodyFlow);
      if (
        !hasSelfCheckHeading &&
        !hasParagraphSelfCheck &&
        !(raw as { bodyHasSelfCheck?: boolean }).bodyHasSelfCheck
      ) {
        throw new Error(
          `Missing self-check section (got: ${snapshot.sections.map((s) => s.heading).join(' | ')})`
        );
      }
      if (snapshot.bodyFlow?.length) {
        const skim = snapshot.bodyFlow
          .filter((b) => b.type === 'heading' || b.type === 'cta')
          .map((b) =>
            b.type === 'heading'
              ? `h2:${b.text}`
              : `cta:${((b.href || '').match(/[?&]topic=(\d+)/) || [])[1] || '?'}`
          );
        console.log('  bodyFlow', skim.join(' → '));
      }
      const eduParas = snapshot.sections.flatMap((s) => s.paragraphs);
      if (eduParas.length < 2) {
        throw new Error(
          `Too few educational paragraphs (${eduParas.length}); headings=${snapshot.sections.map((s) => s.heading).join('|')}`
        );
      }
      // updatedLine may be absent on some production pages — do not invent
      if (!snapshot.faqGroups.length) throw new Error('Missing FAQ groups');

      const fixturePath = join(FIXTURE_DIR, `${slug}.${source}.json`);
      writeFileSync(fixturePath, JSON.stringify(snapshot, null, 2) + '\n');
      console.log('Wrote fixture', fixturePath);
      console.log(
        '  sections',
        snapshot.sections.map((s) => `${s.heading}(${s.paragraphs.length}p)`).join(', ')
      );
      console.log(
        '  faqGroups',
        snapshot.faqGroups.length,
        snapshot.faqGroups.map((g) => g.items.length)
      );
      console.log('  updated', snapshot.updatedLine);
      console.log('  related', snapshot.relatedLinks.length, 'images', snapshot.images.length);
      console.log('  CTA', snapshot.catalogCta?.href);
      console.log('  LD types', snapshot.jsonLd.types.join(','));

      if (emitContent && source === 'production') {
        const content = snapshotToContent(slug, snapshot, raw);
        const out = join(DATA_DIR, `${slug}.json`);
        writeFileSync(out, JSON.stringify(content, null, 2) + '\n');
        console.log('Wrote content', out, 'topic', content.catalogCta);
      }
      results.push({ slug, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`BLOCKER ${slug}:`, msg);
      results.push({ slug, ok: false, error: msg });
    }
  }

  await browser.close();
  writeFileSync(
    join('/tmp/topic-m19', 'capture-summary.json'),
    JSON.stringify(results, null, 2)
  );
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error('\nFailed:', failed);
    process.exit(2);
  }
  console.log('\nAll captures OK:', results.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
