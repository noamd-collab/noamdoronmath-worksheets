/**
 * Pre-designed doodle layouts (4–6). Each obeys marginalia rules:
 * edge gutters, φ vertical bands, no shared horizontal row, mobile ≤2–3
 * visible (sparse mobileVisible), bleed 15–30%, φ sizes.
 * Client picks one at random per load + shuffles assets + ±3° jitter.
 */

export const PHI_EDGE_SIZES = [28, 45, 73] as const;
export const PHI_MOBILE_SIZES = [24, 39] as const;

export type EdgeLayoutSlot = {
  side: 'start' | 'end';
  topPct: number;
  sizePx: number;
  mobileSizePx: number;
  bleed: number;
  mobileVisible: boolean;
  /** Base rotation deg (−14..+12); client adds ±3° jitter. */
  rotate: number;
  opacity: number;
  delay: number;
  duration: number;
  bobPx: number;
  wobbleDeg: number;
};

export type SectionLayoutSlot = {
  side: 'start' | 'end';
  /** Logical inline inset % from edge. */
  inlineInsetPct: number;
  yPct: number;
  sizePx: number;
  mobileSizePx: number;
  /** First slot is mobile-show; rest desktop-only via index. */
  rotate: number;
  opacity: number;
  delay: number;
  duration: number;
  bobPx: number;
  wobbleDeg: number;
};

function slot(
  partial: EdgeLayoutSlot
): EdgeLayoutSlot {
  return partial;
}

/** 5 edge layouts — alternating sides, unique tops, 3 mobileVisible each. */
export const EDGE_LAYOUTS: readonly (readonly EdgeLayoutSlot[])[] = [
  // A — classic φ descent
  [
    slot({ side: 'start', topPct: 12, sizePx: 45, mobileSizePx: 24, bleed: 0.2, mobileVisible: true, rotate: -8, opacity: 0.72, delay: 0.2, duration: 6.2, bobPx: 5, wobbleDeg: 3.5 }),
    slot({ side: 'end', topPct: 23.6, sizePx: 73, mobileSizePx: 39, bleed: 0.18, mobileVisible: false, rotate: 6, opacity: 0.68, delay: 1.1, duration: 7.4, bobPx: 6, wobbleDeg: 4 }),
    slot({ side: 'start', topPct: 38.2, sizePx: 28, mobileSizePx: 24, bleed: 0.25, mobileVisible: false, rotate: -12, opacity: 0.8, delay: 0.6, duration: 5.5, bobPx: 4, wobbleDeg: 3 }),
    slot({ side: 'end', topPct: 50, sizePx: 45, mobileSizePx: 39, bleed: 0.22, mobileVisible: true, rotate: 10, opacity: 0.62, delay: 2.0, duration: 8.1, bobPx: 7, wobbleDeg: 4.5 }),
    slot({ side: 'start', topPct: 61.8, sizePx: 73, mobileSizePx: 24, bleed: 0.16, mobileVisible: false, rotate: -4, opacity: 0.75, delay: 1.4, duration: 6.8, bobPx: 5, wobbleDeg: 3.2 }),
    slot({ side: 'start', topPct: 76.4, sizePx: 28, mobileSizePx: 39, bleed: 0.28, mobileVisible: true, rotate: 8, opacity: 0.7, delay: 0.9, duration: 5.9, bobPx: 6, wobbleDeg: 5 }),
    slot({ side: 'end', topPct: 85, sizePx: 45, mobileSizePx: 24, bleed: 0.2, mobileVisible: false, rotate: -10, opacity: 0.58, delay: 2.8, duration: 7.2, bobPx: 4, wobbleDeg: 3.8 }),
    slot({ side: 'end', topPct: 92, sizePx: 73, mobileSizePx: 39, bleed: 0.15, mobileVisible: false, rotate: 3, opacity: 0.66, delay: 3.5, duration: 8.5, bobPx: 8, wobbleDeg: 4.2 }),
  ],
  // B — end-heavy open top
  [
    slot({ side: 'end', topPct: 10, sizePx: 73, mobileSizePx: 39, bleed: 0.22, mobileVisible: true, rotate: 5, opacity: 0.7, delay: 0.4, duration: 6.5, bobPx: 6, wobbleDeg: 4 }),
    slot({ side: 'start', topPct: 20, sizePx: 28, mobileSizePx: 24, bleed: 0.3, mobileVisible: false, rotate: -11, opacity: 0.64, delay: 1.8, duration: 7.8, bobPx: 5, wobbleDeg: 3.5 }),
    slot({ side: 'end', topPct: 34, sizePx: 45, mobileSizePx: 24, bleed: 0.18, mobileVisible: false, rotate: 12, opacity: 0.78, delay: 0.8, duration: 5.4, bobPx: 4, wobbleDeg: 3 }),
    slot({ side: 'start', topPct: 46, sizePx: 73, mobileSizePx: 39, bleed: 0.2, mobileVisible: true, rotate: -6, opacity: 0.6, delay: 2.2, duration: 8.0, bobPx: 7, wobbleDeg: 4.8 }),
    slot({ side: 'end', topPct: 58, sizePx: 28, mobileSizePx: 24, bleed: 0.26, mobileVisible: false, rotate: 9, opacity: 0.74, delay: 1.2, duration: 6.1, bobPx: 5, wobbleDeg: 3.6 }),
    slot({ side: 'start', topPct: 70, sizePx: 45, mobileSizePx: 39, bleed: 0.17, mobileVisible: false, rotate: -14, opacity: 0.68, delay: 3.0, duration: 7.5, bobPx: 6, wobbleDeg: 4 }),
    slot({ side: 'end', topPct: 82, sizePx: 73, mobileSizePx: 24, bleed: 0.24, mobileVisible: true, rotate: 2, opacity: 0.55, delay: 0.5, duration: 5.8, bobPx: 8, wobbleDeg: 5 }),
    slot({ side: 'start', topPct: 91, sizePx: 28, mobileSizePx: 39, bleed: 0.19, mobileVisible: false, rotate: -3, opacity: 0.8, delay: 2.6, duration: 8.8, bobPx: 4, wobbleDeg: 3.2 }),
  ],
  // C — wide mid gaps (airier)
  [
    slot({ side: 'start', topPct: 14, sizePx: 28, mobileSizePx: 24, bleed: 0.21, mobileVisible: true, rotate: -7, opacity: 0.76, delay: 1.0, duration: 7.0, bobPx: 5, wobbleDeg: 3.8 }),
    slot({ side: 'end', topPct: 28, sizePx: 45, mobileSizePx: 39, bleed: 0.27, mobileVisible: false, rotate: 11, opacity: 0.63, delay: 0.3, duration: 5.6, bobPx: 6, wobbleDeg: 4.2 }),
    slot({ side: 'start', topPct: 42, sizePx: 73, mobileSizePx: 24, bleed: 0.15, mobileVisible: false, rotate: -2, opacity: 0.7, delay: 2.4, duration: 8.3, bobPx: 7, wobbleDeg: 3 }),
    slot({ side: 'end', topPct: 55, sizePx: 28, mobileSizePx: 39, bleed: 0.23, mobileVisible: true, rotate: 7, opacity: 0.58, delay: 1.6, duration: 6.4, bobPx: 4, wobbleDeg: 4.5 }),
    slot({ side: 'start', topPct: 66, sizePx: 45, mobileSizePx: 24, bleed: 0.29, mobileVisible: false, rotate: -13, opacity: 0.82, delay: 0.7, duration: 5.2, bobPx: 5, wobbleDeg: 3.4 }),
    slot({ side: 'end', topPct: 78, sizePx: 73, mobileSizePx: 39, bleed: 0.16, mobileVisible: false, rotate: 4, opacity: 0.66, delay: 3.2, duration: 7.9, bobPx: 8, wobbleDeg: 4 }),
    slot({ side: 'start', topPct: 88, sizePx: 28, mobileSizePx: 24, bleed: 0.2, mobileVisible: true, rotate: -9, opacity: 0.72, delay: 1.9, duration: 6.7, bobPx: 6, wobbleDeg: 5 }),
    slot({ side: 'end', topPct: 94, sizePx: 45, mobileSizePx: 39, bleed: 0.18, mobileVisible: false, rotate: 1, opacity: 0.6, delay: 2.9, duration: 8.6, bobPx: 4, wobbleDeg: 3.1 }),
  ],
  // D — early start / late end zigzag
  [
    slot({ side: 'start', topPct: 11, sizePx: 73, mobileSizePx: 39, bleed: 0.19, mobileVisible: true, rotate: -5, opacity: 0.69, delay: 0.1, duration: 6.0, bobPx: 7, wobbleDeg: 4 }),
    slot({ side: 'end', topPct: 26, sizePx: 28, mobileSizePx: 24, bleed: 0.25, mobileVisible: false, rotate: 8, opacity: 0.77, delay: 1.5, duration: 7.6, bobPx: 5, wobbleDeg: 3.5 }),
    slot({ side: 'start', topPct: 36, sizePx: 45, mobileSizePx: 39, bleed: 0.21, mobileVisible: false, rotate: -12, opacity: 0.61, delay: 2.1, duration: 5.7, bobPx: 6, wobbleDeg: 4.6 }),
    slot({ side: 'end', topPct: 48, sizePx: 73, mobileSizePx: 24, bleed: 0.17, mobileVisible: false, rotate: 3, opacity: 0.74, delay: 0.9, duration: 8.2, bobPx: 4, wobbleDeg: 3 }),
    slot({ side: 'end', topPct: 55, sizePx: 28, mobileSizePx: 39, bleed: 0.28, mobileVisible: true, rotate: -10, opacity: 0.56, delay: 2.7, duration: 6.9, bobPx: 8, wobbleDeg: 5 }),
    slot({ side: 'start', topPct: 71, sizePx: 45, mobileSizePx: 24, bleed: 0.2, mobileVisible: false, rotate: 12, opacity: 0.8, delay: 1.3, duration: 5.3, bobPx: 5, wobbleDeg: 3.7 }),
    slot({ side: 'start', topPct: 86, sizePx: 73, mobileSizePx: 39, bleed: 0.15, mobileVisible: true, rotate: -1, opacity: 0.65, delay: 3.4, duration: 7.7, bobPx: 6, wobbleDeg: 4.1 }),
    slot({ side: 'end', topPct: 93, sizePx: 28, mobileSizePx: 24, bleed: 0.24, mobileVisible: false, rotate: 6, opacity: 0.71, delay: 0.6, duration: 8.4, bobPx: 4, wobbleDeg: 3.3 }),
  ],
  // E — zigzag tight φ
  [
    slot({ side: 'end', topPct: 13, sizePx: 45, mobileSizePx: 24, bleed: 0.26, mobileVisible: true, rotate: 9, opacity: 0.73, delay: 1.7, duration: 6.3, bobPx: 5, wobbleDeg: 3.9 }),
    slot({ side: 'start', topPct: 24, sizePx: 73, mobileSizePx: 39, bleed: 0.18, mobileVisible: false, rotate: -8, opacity: 0.59, delay: 0.4, duration: 7.1, bobPx: 7, wobbleDeg: 4.3 }),
    slot({ side: 'end', topPct: 37, sizePx: 28, mobileSizePx: 24, bleed: 0.22, mobileVisible: false, rotate: 4, opacity: 0.81, delay: 2.5, duration: 5.5, bobPx: 4, wobbleDeg: 3 }),
    slot({ side: 'start', topPct: 49, sizePx: 45, mobileSizePx: 39, bleed: 0.3, mobileVisible: true, rotate: -14, opacity: 0.67, delay: 1.1, duration: 8.0, bobPx: 6, wobbleDeg: 4.7 }),
    slot({ side: 'end', topPct: 62, sizePx: 73, mobileSizePx: 24, bleed: 0.16, mobileVisible: false, rotate: 2, opacity: 0.75, delay: 3.1, duration: 6.6, bobPx: 8, wobbleDeg: 3.6 }),
    slot({ side: 'start', topPct: 74, sizePx: 28, mobileSizePx: 39, bleed: 0.23, mobileVisible: false, rotate: -6, opacity: 0.62, delay: 0.8, duration: 7.3, bobPx: 5, wobbleDeg: 5 }),
    slot({ side: 'end', topPct: 88, sizePx: 45, mobileSizePx: 24, bleed: 0.19, mobileVisible: true, rotate: 11, opacity: 0.7, delay: 2.0, duration: 5.9, bobPx: 4, wobbleDeg: 3.4 }),
    slot({ side: 'start', topPct: 94, sizePx: 73, mobileSizePx: 39, bleed: 0.21, mobileVisible: false, rotate: -3, opacity: 0.54, delay: 2.8, duration: 8.7, bobPx: 7, wobbleDeg: 4 }),
  ],
] as const;

/** 5 section layouts — 3 slots, diagonal alternate, unique Y (≥10% gap). */
export const SECTION_LAYOUTS: readonly (readonly SectionLayoutSlot[])[] = [
  [
    { side: 'start', inlineInsetPct: 3, yPct: 22, sizePx: 45, mobileSizePx: 24, rotate: -9, opacity: 0.72, delay: 0.3, duration: 6.4, bobPx: 5, wobbleDeg: 3.5 },
    { side: 'end', inlineInsetPct: 5, yPct: 48, sizePx: 73, mobileSizePx: 39, rotate: 7, opacity: 0.65, delay: 1.4, duration: 7.8, bobPx: 6, wobbleDeg: 4 },
    { side: 'start', inlineInsetPct: 8, yPct: 74, sizePx: 28, mobileSizePx: 24, rotate: -4, opacity: 0.78, delay: 2.2, duration: 5.6, bobPx: 4, wobbleDeg: 3 },
  ],
  [
    { side: 'end', inlineInsetPct: 4, yPct: 18, sizePx: 28, mobileSizePx: 39, rotate: 10, opacity: 0.68, delay: 0.6, duration: 7.2, bobPx: 7, wobbleDeg: 4.5 },
    { side: 'start', inlineInsetPct: 6, yPct: 44, sizePx: 45, mobileSizePx: 24, rotate: -12, opacity: 0.74, delay: 1.8, duration: 5.8, bobPx: 5, wobbleDeg: 3.2 },
    { side: 'end', inlineInsetPct: 2, yPct: 70, sizePx: 73, mobileSizePx: 39, rotate: 3, opacity: 0.6, delay: 0.9, duration: 8.1, bobPx: 6, wobbleDeg: 4 },
  ],
  [
    { side: 'start', inlineInsetPct: 7, yPct: 26, sizePx: 73, mobileSizePx: 24, rotate: -6, opacity: 0.7, delay: 1.2, duration: 6.8, bobPx: 8, wobbleDeg: 5 },
    { side: 'end', inlineInsetPct: 3, yPct: 52, sizePx: 28, mobileSizePx: 39, rotate: 12, opacity: 0.58, delay: 0.4, duration: 5.4, bobPx: 4, wobbleDeg: 3.6 },
    { side: 'start', inlineInsetPct: 5, yPct: 78, sizePx: 45, mobileSizePx: 24, rotate: -11, opacity: 0.8, delay: 2.6, duration: 7.5, bobPx: 5, wobbleDeg: 3.8 },
  ],
  [
    { side: 'end', inlineInsetPct: 8, yPct: 20, sizePx: 45, mobileSizePx: 39, rotate: 5, opacity: 0.66, delay: 2.0, duration: 8.4, bobPx: 6, wobbleDeg: 4.2 },
    { side: 'start', inlineInsetPct: 2, yPct: 40, sizePx: 73, mobileSizePx: 24, rotate: -8, opacity: 0.76, delay: 0.7, duration: 6.1, bobPx: 5, wobbleDeg: 3 },
    { side: 'end', inlineInsetPct: 6, yPct: 66, sizePx: 28, mobileSizePx: 39, rotate: 1, opacity: 0.62, delay: 1.5, duration: 7.0, bobPx: 7, wobbleDeg: 4.8 },
  ],
  [
    { side: 'start', inlineInsetPct: 4, yPct: 16, sizePx: 28, mobileSizePx: 24, rotate: -13, opacity: 0.71, delay: 0.5, duration: 5.9, bobPx: 4, wobbleDeg: 3.4 },
    { side: 'end', inlineInsetPct: 7, yPct: 38, sizePx: 45, mobileSizePx: 39, rotate: 8, opacity: 0.64, delay: 2.3, duration: 7.9, bobPx: 6, wobbleDeg: 4 },
    { side: 'start', inlineInsetPct: 3, yPct: 62, sizePx: 73, mobileSizePx: 24, rotate: -2, opacity: 0.79, delay: 1.0, duration: 6.5, bobPx: 8, wobbleDeg: 3.7 },
  ],
] as const;

export function assertLayoutRules(
  edge: readonly EdgeLayoutSlot[],
  section: readonly SectionLayoutSlot[]
): void {
  const mobile = edge.filter((s) => s.mobileVisible);
  if (mobile.length < 2 || mobile.length > 3) {
    throw new Error(`mobileVisible count ${mobile.length}`);
  }
  const mt = [...mobile].sort((a, b) => a.topPct - b.topPct);
  for (let i = 1; i < mt.length; i++) {
    if (mt[i].topPct - mt[i - 1].topPct < 26) {
      throw new Error(`mobile gap ${mt[i - 1].topPct}→${mt[i].topPct}`);
    }
  }
  for (let i = 1; i < section.length; i++) {
    if (Math.abs(section[i].yPct - section[i - 1].yPct) < 10) {
      throw new Error(`section Y band clash`);
    }
    if (section[i].side === section[i - 1].side) {
      throw new Error(`section not diagonal`);
    }
  }
}
