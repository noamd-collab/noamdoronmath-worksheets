/**
 * Normalized topic-page parity snapshot (production or preview).
 * Used by SOURCE→PREVIEW parity gate — not a mirror of TopicPageContent JSON.
 */
export interface TopicParityFaqItem {
  question: string;
  answer: string;
}

export interface TopicParityFaqGroup {
  heading: string;
  items: TopicParityFaqItem[];
}

export interface TopicParitySection {
  heading: string;
  paragraphs: string[];
  listItems: string[];
}

export interface TopicParityLink {
  href: string;
  label: string;
}

export type TopicParityBodyFlowItem =
  | { type: 'paragraph'; text: string; role?: string }
  | { type: 'heading'; text: string }
  | { type: 'cta'; label: string; href: string; catalogTopicId?: number | null }
  | { type: 'list'; ordered?: boolean; items: string[] };

export interface TopicParityImage {
  src: string;
  alt: string;
}

export interface TopicParityJsonLd {
  types: string[];
  faq: TopicParityFaqItem[];
}

export interface TopicParitySnapshot {
  slug: string;
  source: 'production' | 'preview';
  url: string;
  capturedAt: string;
  httpStatus?: number;
  title: string;
  description: string;
  h1: string;
  /** Lead pedagogical paragraph under the H1 (must not be a duplicate of H1). */
  intro: string;
  updatedLine: string | null;
  authorLine: string | null;
  authorAboutHref: string | null;
  sections: TopicParitySection[];
  /** Ordered H2/paragraph/CTA blocks after H1 (source DOM order). */
  bodyFlow?: TopicParityBodyFlowItem[];
  faqGroups: TopicParityFaqGroup[];
  relatedLinks: TopicParityLink[];
  /** Primary / first CTA (back-compat). */
  catalogCta: TopicParityLink | null;
  /** All worksheet CTAs in production DOM order. */
  catalogCtas: TopicParityLink[];
  images: TopicParityImage[];
  jsonLd: TopicParityJsonLd;
}

/** Drop bidi isolates added at render time so parity compares the stored wording. */
export function stripBidiIsolates(s: string | null | undefined): string {
  return (s || '').replace(/[\u2066\u2067\u2068\u2069]/g, '');
}

export function cleanText(s: string | null | undefined): string {
  return stripBidiIsolates(s)
    .replace(/[\u200b\u200e\u200f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable fingerprint for duplicate detection (normalized whitespace). */
export function normalizeFingerprint(s: string): string {
  return cleanText(s).toLowerCase().replace(/[״"']/g, '"');
}

export interface ParityDiff {
  field: string;
  severity: 'error' | 'warn';
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Compare production (source of truth) vs preview/served snapshot.
 * Fails on missing educational material, missing FAQ, SEO drift, duplicate FAQ Qs.
 */
export function diffTopicParity(
  source: TopicParitySnapshot,
  preview: TopicParitySnapshot
): ParityDiff[] {
  const diffs: ParityDiff[] = [];
  const push = (d: ParityDiff) => diffs.push(d);

  if (!source.title || !preview.title || source.title !== preview.title) {
    push({
      field: 'title',
      severity: 'error',
      message: 'title mismatch',
      expected: source.title,
      actual: preview.title,
    });
  }
  if (!source.description || source.description !== preview.description) {
    push({
      field: 'description',
      severity: 'error',
      message: 'meta description mismatch',
      expected: source.description,
      actual: preview.description,
    });
  }
  if (!source.h1 || stripBidiIsolates(source.h1) !== stripBidiIsolates(preview.h1)) {
    push({
      field: 'h1',
      severity: 'error',
      message: 'H1 mismatch',
      expected: source.h1,
      actual: preview.h1,
    });
  }

  // Exact production intro paragraph — fail if missing, truncated, or H1-echo.
  if (!source.intro || source.intro.length < 40) {
    push({
      field: 'intro',
      severity: 'error',
      message: 'production fixture missing real intro paragraph',
      expected: source.intro,
    });
  } else {
    if (!preview.intro || preview.intro.length < 40) {
      push({
        field: 'intro',
        severity: 'error',
        message: 'missing intro paragraph on preview',
        expected: source.intro.slice(0, 120),
        actual: preview.intro || '',
      });
    } else if (normalizeFingerprint(source.intro) !== normalizeFingerprint(preview.intro)) {
      push({
        field: 'intro',
        severity: 'error',
        message: 'intro paragraph mismatch',
        expected: source.intro.slice(0, 160),
        actual: preview.intro.slice(0, 160),
      });
    }
    if (
      preview.intro &&
      normalizeFingerprint(preview.intro) === normalizeFingerprint(preview.h1 || '')
    ) {
      push({
        field: 'intro',
        severity: 'error',
        message: 'preview intro is an H1 echo (not the production lead paragraph)',
        actual: preview.intro.slice(0, 120),
      });
    }
  }

  if (source.updatedLine) {
    if (!preview.updatedLine) {
      push({
        field: 'updatedLine',
        severity: 'error',
        message: 'missing update line on preview',
        expected: source.updatedLine,
      });
    } else if (source.updatedLine !== preview.updatedLine) {
      push({
        field: 'updatedLine',
        severity: 'error',
        message: 'update line mismatch',
        expected: source.updatedLine,
        actual: preview.updatedLine,
      });
    }
  } else if (preview.updatedLine) {
    push({
      field: 'updatedLine',
      severity: 'error',
      message: 'preview invented update line absent on production',
      actual: preview.updatedLine,
    });
  }

  // Worksheet CTAs: preserve ALL production CTAs (label + topic id) in DOM order.
  // Empty production CTA list is always an error for topic pages.
  const srcCtas =
    source.catalogCtas?.length > 0
      ? source.catalogCtas
      : source.catalogCta
        ? [source.catalogCta]
        : [];
  const prvCtas =
    preview.catalogCtas?.length > 0
      ? preview.catalogCtas
      : preview.catalogCta
        ? [preview.catalogCta]
        : [];
  if (srcCtas.length < 1) {
    push({
      field: 'catalogCtas.count',
      severity: 'error',
      message: 'production fixture has no worksheet CTAs',
    });
  }
  if (srcCtas.length !== prvCtas.length) {
    push({
      field: 'catalogCtas.count',
      severity: 'error',
      message: `worksheet CTA count ${prvCtas.length} != production ${srcCtas.length}`,
      expected: srcCtas.map((c) => c.label).join(' | '),
      actual: prvCtas.map((c) => c.label).join(' | '),
    });
  }
  for (let i = 0; i < Math.max(srcCtas.length, prvCtas.length); i++) {
    const s = srcCtas[i];
    const p = prvCtas[i];
    if (!s) {
      push({
        field: 'catalogCtas.extra',
        severity: 'error',
        message: `preview has extra CTA[${i}]`,
        actual: p?.label,
      });
      continue;
    }
    if (!p) {
      push({
        field: 'catalogCtas.missing',
        severity: 'error',
        message: `missing CTA[${i}]`,
        expected: `${s.label} (${s.href})`,
      });
      continue;
    }
    if (normalizeFingerprint(s.label) !== normalizeFingerprint(p.label)) {
      push({
        field: 'catalogCtas.label',
        severity: 'error',
        message: `CTA[${i}] label mismatch`,
        expected: s.label,
        actual: p.label,
      });
    }
    const sTopic = (s.href.match(/[?&]topic=(\d+)/) || [])[1];
    const pTopic = (p.href.match(/[?&]topic=(\d+)/) || [])[1];
    if (sTopic && (!pTopic || sTopic !== pTopic)) {
      push({
        field: 'catalogCtas.topic',
        severity: 'error',
        message: `CTA[${i}] topic id mismatch`,
        expected: sTopic,
        actual: pTopic || '(none)',
      });
    }
  }

  // Ordered body flow (H2 / paragraph / CTA) — required when source captured it
  const srcFlow = source.bodyFlow || [];
  const prvFlow = preview.bodyFlow || [];
  if (srcFlow.length) {
    const skim = (flow: TopicParityBodyFlowItem[]) =>
      flow
        .filter((b) => b.type === 'heading' || b.type === 'cta' || (b.type === 'paragraph' && b.role === 'intro'))
        .map((b) => {
          if (b.type === 'heading') return `h2:${normalizeFingerprint(b.text)}`;
          if (b.type === 'cta') {
            const topic = (b.href.match(/[?&]topic=(\d+)/) || [])[1] || '';
            return `cta:${topic}:${normalizeFingerprint(b.label)}`;
          }
          if (b.type === 'paragraph') {
            return `intro:${normalizeFingerprint(b.text).slice(0, 48)}`;
          }
          return 'other';
        });
    const srcSkim = skim(srcFlow);
    const prvSkim = skim(prvFlow);
    if (srcSkim.join('|') !== prvSkim.join('|')) {
      push({
        field: 'bodyFlow.order',
        severity: 'error',
        message: 'body block order mismatch (intro/H2/CTA)',
        expected: srcSkim.join(' → '),
        actual: prvSkim.join(' → '),
      });
    }
    // Full flow length/kinds when both present
    if (prvFlow.length) {
      const srcKinds = srcFlow.map((b) => b.type).join(',');
      const prvKinds = prvFlow.map((b) => b.type).join(',');
      // Compare reduced kinds ignoring trailing noise paragraphs after last educational heading
      if (srcKinds !== prvKinds) {
        // Soft: only error when CTA/heading relative order differs (already covered by skim)
        // Still flag if CTA appears before a heading that precedes it on source
        const srcFirstCta = srcFlow.findIndex((b) => b.type === 'cta');
        const srcHeadBeforeCta = srcFlow
          .slice(0, srcFirstCta === -1 ? 0 : srcFirstCta)
          .filter((b) => b.type === 'heading');
        const prvFirstCta = prvFlow.findIndex((b) => b.type === 'cta');
        const prvHeadBeforeCta = prvFlow
          .slice(0, prvFirstCta === -1 ? 0 : prvFirstCta)
          .filter((b) => b.type === 'heading');
        if (
          srcHeadBeforeCta.map((b) => stripBidiIsolates((b as { text: string }).text)).join('|') !==
          prvHeadBeforeCta.map((b) => stripBidiIsolates((b as { text: string }).text)).join('|')
        ) {
          push({
            field: 'bodyFlow.ctaPlacement',
            severity: 'error',
            message: 'CTA placement relative to preceding H2s mismatch',
            expected: srcHeadBeforeCta.map((b) => (b as { text: string }).text).join(' → ') || '(none)',
            actual: prvHeadBeforeCta.map((b) => (b as { text: string }).text).join(' → ') || '(none)',
          });
        }
      }
    }
  }

  if (source.authorLine) {
    if (!preview.authorLine || !preview.authorLine.includes('נועם דורון')) {
      push({
        field: 'authorLine',
        severity: 'error',
        message: 'author line missing or incomplete',
        expected: source.authorLine,
        actual: preview.authorLine || '',
      });
    }
    if (source.authorAboutHref && preview.authorAboutHref !== source.authorAboutHref) {
      push({
        field: 'authorAboutHref',
        severity: 'error',
        message: 'about link mismatch',
        expected: source.authorAboutHref,
        actual: preview.authorAboutHref || '',
      });
    }
  }

  const srcHeadings = source.sections.map((s) => s.heading).filter(Boolean);
  const prvHeadings = preview.sections.map((s) => s.heading).filter(Boolean);
  for (const h of srcHeadings) {
    if (!prvHeadings.includes(h)) {
      push({
        field: 'sections',
        severity: 'error',
        message: `missing section heading: ${h}`,
      });
    }
  }
  // Educational paragraphs: every non-trivial production paragraph must appear in preview.
  const previewParaSet = new Set(
    preview.sections.flatMap((s) => s.paragraphs.map(normalizeFingerprint)).filter((p) => p.length > 12)
  );
  for (const sec of source.sections) {
    for (const p of sec.paragraphs) {
      const fp = normalizeFingerprint(p);
      if (fp.length <= 12) continue;
      if (!previewParaSet.has(fp) && ![...previewParaSet].some((x) => x.includes(fp) || fp.includes(x))) {
        push({
          field: 'sections.paragraphs',
          severity: 'error',
          message: `missing educational paragraph under "${sec.heading}"`,
          expected: p.slice(0, 120),
        });
      }
    }
    for (const item of sec.listItems) {
      const fp = normalizeFingerprint(item);
      const previewLists = preview.sections.flatMap((s) => s.listItems.map(normalizeFingerprint));
      if (fp.length > 8 && !previewLists.some((x) => x === fp || x.includes(fp) || fp.includes(x))) {
        push({
          field: 'sections.listItems',
          severity: 'error',
          message: `missing list item under "${sec.heading}"`,
          expected: item.slice(0, 120),
        });
      }
    }
  }

  if (source.faqGroups.length !== preview.faqGroups.length) {
    push({
      field: 'faqGroups.count',
      severity: 'error',
      message: `FAQ group count ${preview.faqGroups.length} != production ${source.faqGroups.length}`,
    });
  }
  const srcFaqFlat = source.faqGroups.flatMap((g) => g.items);
  const prvFaqFlat = preview.faqGroups.flatMap((g) => g.items);
  // Duplicates in preview FAQ
  const seenQ = new Map<string, number>();
  for (const item of prvFaqFlat) {
    const k = normalizeFingerprint(item.question);
    seenQ.set(k, (seenQ.get(k) || 0) + 1);
  }
  for (const [q, n] of seenQ) {
    if (n > 1) {
      push({
        field: 'faq.duplicates',
        severity: 'error',
        message: `duplicated FAQ question (${n}×): ${q.slice(0, 80)}`,
      });
    }
  }
  for (const item of srcFaqFlat) {
    const match = prvFaqFlat.find(
      (p) =>
        normalizeFingerprint(p.question) === normalizeFingerprint(item.question) &&
        normalizeFingerprint(p.answer) === normalizeFingerprint(item.answer)
    );
    if (!match) {
      push({
        field: 'faq.items',
        severity: 'error',
        message: `missing FAQ Q&A: ${item.question.slice(0, 80)}`,
        expected: item.answer.slice(0, 80),
      });
    }
  }

  // Related / internal topic links: every production related label+path should exist
  for (const link of source.relatedLinks) {
    const found = preview.relatedLinks.find(
      (p) =>
        normalizeFingerprint(p.label) === normalizeFingerprint(link.label) ||
        p.href === link.href ||
        p.href.endsWith(new URL(link.href, 'https://www.noamdoronmath.co.il').pathname)
    );
    if (!found) {
      push({
        field: 'relatedLinks',
        severity: 'error',
        message: `missing related/internal link: ${link.label}`,
        expected: link.href,
      });
    }
  }

  // Images: production content images (non-empty src) should appear
  const prvImg = new Set(preview.images.map((i) => i.src.split('?')[0]));
  for (const img of source.images) {
    if (!img.src || img.src.startsWith('data:')) continue;
    const base = img.src.split('?')[0];
    const ok =
      prvImg.has(base) ||
      [...prvImg].some((p) => p.includes(base.split('/').pop() || '___'));
    if (!ok) {
      push({
        field: 'images',
        severity: 'error',
        message: `missing image URL`,
        expected: img.src.slice(0, 120),
      });
    }
  }

  // JSON-LD types + FAQ entities must match source (source-parity).
  for (const t of source.jsonLd.types) {
    if (!preview.jsonLd.types.includes(t)) {
      push({
        field: 'jsonLd.types',
        severity: 'error',
        message: `missing JSON-LD @type: ${t}`,
      });
    }
  }
  for (const item of source.jsonLd.faq) {
    const inPreviewLd = preview.jsonLd.faq.find(
      (p) =>
        normalizeFingerprint(p.question) === normalizeFingerprint(item.question) &&
        normalizeFingerprint(p.answer) === normalizeFingerprint(item.answer)
    );
    if (!inPreviewLd) {
      push({
        field: 'jsonLd.faq',
        severity: 'error',
        message: `missing JSON-LD FAQ Q&A: ${item.question.slice(0, 80)}`,
      });
    }
  }
  // Schema-visibility (LD ⊆ visible on the preview page) is enforced separately —
  // see assertJsonLdFaqVisible / schema-visibility tests. Not mixed into source-parity.

  return diffs;
}

export function assertNoParityErrors(diffs: ParityDiff[], label: string): void {
  const errors = diffs.filter((d) => d.severity === 'error');
  if (errors.length) {
    const msg = errors
      .map((e) => `- [${e.field}] ${e.message}${e.expected ? ` | expected: ${e.expected}` : ''}${e.actual ? ` | actual: ${e.actual}` : ''}`)
      .join('\n');
    throw new Error(`Parity failed for ${label} (${errors.length} errors):\n${msg}`);
  }
}

/**
 * Schema-visibility gate (separate from source-parity): every FAQPage JSON-LD Q&A
 * must appear in the same snapshot's visible FAQ groups. No global soft exceptions.
 */
export function diffJsonLdFaqVisibility(snapshot: TopicParitySnapshot): ParityDiff[] {
  const diffs: ParityDiff[] = [];
  const visible = snapshot.faqGroups.flatMap((g) => g.items);
  for (const item of snapshot.jsonLd.faq) {
    const found = visible.find(
      (p) =>
        normalizeFingerprint(p.question) === normalizeFingerprint(item.question) &&
        normalizeFingerprint(p.answer) === normalizeFingerprint(item.answer)
    );
    if (!found) {
      diffs.push({
        field: 'jsonLd.faqVisibility',
        severity: 'error',
        message: `JSON-LD FAQ not visible in page FAQ: ${item.question.slice(0, 80)}`,
        expected: item.question,
      });
    }
  }
  return diffs;
}

export function assertJsonLdFaqVisible(snapshot: TopicParitySnapshot, label: string): void {
  assertNoParityErrors(diffJsonLdFaqVisibility(snapshot), `schema-visibility:${label}`);
}
