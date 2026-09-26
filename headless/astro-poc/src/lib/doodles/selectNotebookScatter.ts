/**
 * Golden-ratio notebook marginalia for home/topic sections.
 * Deterministic (seed hashed); SSR-safe — no Math.random().
 * Edge gutters only (never mid-content / cards); diagonal descent;
 * unique horizontal bands; φ sizes; every motif animates when allowed.
 */
import { hashPathname, type DoodleMotif } from './selectSiteDoodles';

/** φ ≈ 1.618 — size ladder 28 → 45 → 73 (≥30% steps). */
export const PHI = 1.6180339887;
export const PHI_SIZES = [28, 45, 73] as const;
/** Mobile φ sizes. */
export const PHI_MOBILE_SIZES = [24, 39] as const;
/** Section block-% anchors (nested 1/φ bands). */
export const PHI_POINTS = [23.6, 38.2, 61.8, 76.4] as const;
/** Inline gutter insets (% from logical edge) — keep clear of text/CTAs. */
export const GUTTER_INSETS = [2, 4, 7, 10] as const;

export type ScatterItem = {
  id: string;
  src: string;
  /** Display width — φ ladder (28 / 45 / 73). */
  sizePx: number;
  /** Base rotation deg (−14..+12). */
  rotate: number;
  /** Always true — every doodle moves when motion allowed. */
  float: boolean;
  opacity: number;
  /** Animation delay seconds. */
  delay: number;
  /** Animation duration seconds (5–9). */
  duration: number;
  /** translateY amplitude px (4–8). */
  bobPx: number;
  /** Extra rotate wobble ±deg (3–5). */
  wobbleDeg: number;
  /**
   * Logical inline inset from the margin edge (0–100 of section).
   * Used with side → inset-inline-start/end.
   */
  inlineInsetPct: number;
  /** Absolute block placement inside section (0–100). */
  yPct: number;
  /** Mobile size (24 / 39). */
  mobileSizePx: number;
  mobileRotate: number;
  mobileOpacity: number;
  /** Legacy aliases for tests / CSS data attrs. */
  xPct: number;
  topPx: number;
  side: 'start' | 'end';
  insetPx: number;
};

export type ScribbleKind =
  | 'star'
  | 'spiral'
  | 'arrow'
  | 'underline'
  | 'formula'
  | 'dots';

export type ScribbleItem = {
  kind: ScribbleKind;
  rotate: number;
  sizePx: number;
  float: boolean;
  delay: number;
  duration: number;
  bobPx: number;
  wobbleDeg: number;
  inlineInsetPct: number;
  xPct: number;
  yPct: number;
  topPx: number;
  side: 'start' | 'end';
  insetPx: number;
  mobileOpacity: number;
};

export type NotebookScatterResult = {
  motifs: ScatterItem[];
  scribbles: ScribbleItem[];
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleIndices(rng: () => number, n: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

const SCRIBBLE_KINDS: ScribbleKind[] = [
  'star',
  'spiral',
  'arrow',
  'underline',
  'formula',
  'dots',
];

/**
 * Diagonal margin slots: alternate start/end, unique Y bands (no shared
 * horizontal row), φ block anchors, gutter inline insets only.
 */
function buildMarginSlots(
  rng: () => number,
  count: number
): Array<{ side: 'start' | 'end'; inlineInsetPct: number; yPct: number; xPct: number }> {
  const yOrder = shuffleIndices(rng, PHI_POINTS.length).map((i) => PHI_POINTS[i]);
  // Extra Y bands if count > 4
  while (yOrder.length < count) {
    const last = yOrder[yOrder.length - 1] ?? 38.2;
    const next = Math.min(88, Math.round((last + (100 - last) / PHI) * 10) / 10);
    yOrder.push(next);
  }

  const out: Array<{
    side: 'start' | 'end';
    inlineInsetPct: number;
    yPct: number;
    xPct: number;
  }> = [];
  let prevY = -999;

  for (let i = 0; i < count; i++) {
    const side: 'start' | 'end' = i % 2 === 0 ? 'start' : 'end';
    let yPct = yOrder[i];
    const jitter = (rng() - 0.5) * 2.4;
    yPct = Math.round((yPct + jitter) * 10) / 10;
    // No two doodles in the same horizontal band
    if (Math.abs(yPct - prevY) < 10) {
      yPct = prevY + (yPct >= prevY ? 12 : -12);
    }
    yPct = Math.min(88, Math.max(10, yPct));
    const inset =
      GUTTER_INSETS[Math.floor(rng() * GUTTER_INSETS.length)] +
      Math.round((rng() - 0.5) * 2);
    const inlineInsetPct = Math.min(12, Math.max(1, inset));
    // Physical xPct for legacy/tests (LTR-ish map of logical gutter)
    const xPct =
      side === 'start'
        ? inlineInsetPct
        : 100 - inlineInsetPct;
    out.push({ side, inlineInsetPct, yPct, xPct });
    prevY = yPct;
  }

  // Sort by Y so descent is monotonic (diagonal zigzag by alternating side)
  out.sort((a, b) => a.yPct - b.yPct);
  for (let i = 0; i < out.length; i++) {
    out[i].side = i % 2 === 0 ? 'start' : 'end';
    out[i].xPct =
      out[i].side === 'start'
        ? out[i].inlineInsetPct
        : 100 - out[i].inlineInsetPct;
  }
  return out;
}

function nextPhiSize(
  rng: () => number,
  prev: number | null,
  ladder: readonly number[]
): number {
  const pool =
    prev == null
      ? [...ladder]
      : ladder.filter((s) => Math.abs(s - prev) / Math.max(prev, 1) >= 0.3);
  const use = pool.length ? pool : [...ladder];
  return use[Math.floor(rng() * use.length)];
}

function motionParams(rng: () => number) {
  return {
    float: true as const,
    delay: Math.round(rng() * 45) / 10, // 0–4.5s stagger
    duration: Math.round((5 + rng() * 4) * 10) / 10, // 5–9s
    bobPx: Math.round(4 + rng() * 4), // 4–8
    wobbleDeg: Math.round((3 + rng() * 2) * 10) / 10, // 3–5
  };
}

/**
 * Pick `count` motifs on margin gutters with diagonal descent.
 * EVERY motif floats. Also returns 1–3 math scribbles (formula always included).
 */
export function selectNotebookScatter(
  seed: string,
  motifs: readonly DoodleMotif[],
  opts: {
    preferred?: readonly string[];
    count?: number;
    scribbleCount?: number;
  } = {}
): NotebookScatterResult {
  if (!motifs.length) return { motifs: [], scribbles: [] };

  // Keep section density low: 2–4 motifs (mobile viewport ≤2–3 with edges).
  const want = Math.min(
    motifs.length,
    Math.max(2, Math.min(4, opts.count ?? 3))
  );
  const scribbleWantRaw = opts.scribbleCount ?? 2;
  const scribbleWant =
    scribbleWantRaw <= 0
      ? 0
      : Math.min(SCRIBBLE_KINDS.length, Math.max(1, Math.min(3, scribbleWantRaw)));

  const rng = mulberry32(hashPathname(`scatter:${seed}`));
  const byId = new Map(motifs.map((m) => [m.id, m]));
  const preferred = (opts.preferred || [])
    .map((id) => byId.get(id))
    .filter((m): m is DoodleMotif => !!m);

  const preferredIds = new Set(preferred.map((m) => m.id));
  const fillers = motifs.filter((m) => !preferredIds.has(m.id));
  const fillerOrder = shuffleIndices(rng, fillers.length).map((i) => fillers[i]);

  const picked: DoodleMotif[] = [];
  for (const m of preferred) {
    if (picked.length >= want) break;
    picked.push(m);
  }
  for (const m of fillerOrder) {
    if (picked.length >= want) break;
    picked.push(m);
  }

  const order = shuffleIndices(rng, picked.length).map((i) => picked[i]);
  const slots = buildMarginSlots(rng, order.length);

  let prevSize: number | null = null;
  let prevMobile: number | null = null;

  const items: ScatterItem[] = order.map((m, i) => {
    const sizePx = nextPhiSize(rng, prevSize, PHI_SIZES);
    prevSize = sizePx;
    const mobileSizePx = nextPhiSize(rng, prevMobile, PHI_MOBILE_SIZES);
    prevMobile = mobileSizePx;
    const rotate = Math.round((-14 + rng() * 26) * 10) / 10; // −14..+12
    const mobileRotate = Math.round((-14 + rng() * 26) * 10) / 10;
    const opacity = Math.round((0.5 + rng() * 0.38) * 100) / 100; // 0.5–0.88
    const mobileOpacity = Math.round((0.5 + rng() * 0.38) * 100) / 100;
    const motion = motionParams(rng);
    const slot = slots[i];
    return {
      id: `${m.id}-${i}`,
      src: m.src,
      sizePx,
      rotate,
      opacity,
      mobileSizePx,
      mobileRotate,
      mobileOpacity,
      inlineInsetPct: slot.inlineInsetPct,
      xPct: slot.xPct,
      yPct: slot.yPct,
      side: slot.side,
      insetPx: Math.round(slot.inlineInsetPct),
      topPx: Math.round((slot.yPct / 100) * 360),
      ...motion,
    };
  });

  if (scribbleWant <= 0) return { motifs: items, scribbles: [] };

  const scribbleOrder = shuffleIndices(rng, SCRIBBLE_KINDS.length);
  const kinds: ScribbleKind[] = [];
  kinds.push('formula');
  for (const ki of scribbleOrder) {
    const k = SCRIBBLE_KINDS[ki];
    if (k === 'formula') continue;
    if (kinds.length >= scribbleWant) break;
    kinds.push(k);
  }

  const scribbleSlots = buildMarginSlots(rng, kinds.length);
  const scribbles: ScribbleItem[] = kinds.map((kind, i) => {
    const slot = scribbleSlots[i];
    const motion = motionParams(rng);
    return {
      kind,
      rotate:
        kind === 'formula'
          ? Math.round((-6 + rng() * 12) * 10) / 10
          : Math.round((-14 + rng() * 26) * 10) / 10,
      sizePx: kind === 'formula' ? PHI_SIZES[1] : nextPhiSize(rng, null, PHI_SIZES),
      ...motion,
      float: true,
      inlineInsetPct: slot.inlineInsetPct,
      xPct: slot.xPct,
      yPct: slot.yPct,
      side: slot.side,
      insetPx: Math.round(slot.inlineInsetPct),
      topPx: Math.round((slot.yPct / 100) * 320),
      mobileOpacity: Math.round((0.5 + rng() * 0.35) * 100) / 100,
    };
  });

  return { motifs: items, scribbles };
}
