/**
 * Edge-margin doodle columns — left/right page edges, full document height.
 * Golden-ratio vertical spacing; deterministic pathname seed.
 * Desktop: φ sizes 28/45/73, bleed 15–30%. Mobile: 24/39, sparse so ≤2–3/viewport.
 */
import {
  hashPathname,
  normalizeDoodlePathname,
  type DoodleMotif,
} from './selectSiteDoodles';

/** φ ≈ 1.618 */
export const PHI = 1.6180339887;
/** Desktop edge size ladder (≥30% steps). */
export const PHI_EDGE_SIZES = [28, 45, 73] as const;
/** Mobile edge sizes (φ step). */
export const MOBILE_EDGE_SIZES = [24, 39] as const;
/** φ vertical anchors for start column (document %). */
export const PHI_EDGE_TOPS_START = [12.0, 23.6, 38.2, 61.8, 76.4] as const;
/** End column — offset so L/R never share a horizontal band. */
export const PHI_EDGE_TOPS_END = [17.5, 30.0, 50.0, 68.0, 85.4] as const;

export type DenseMarginPlacement = {
  id: string;
  src: string;
  /** Logical margin column (RTL-safe). */
  side: 'start' | 'end';
  /** 0–100 vertical position along the document. */
  topPct: number;
  sizePx: number;
  /** Mobile edge size 24 | 39. */
  mobileSizePx: number;
  rotate: number;
  /** Fraction of width tucked past the edge (0.15–0.30). */
  bleed: number;
  float: boolean;
  delay: number;
  duration: number;
  bobPx: number;
  wobbleDeg: number;
  opacity: number;
  /** Sparse mobile set — only these render ≤767px. */
  mobileVisible: boolean;
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

/**
 * Place motifs into alternating start/end edge columns with φ vertical
 * spacing. Document-absolute layer (not a strip). Mobile keeps a sparse
 * subset so a 390px viewport shows at most ~2–3 edge doodles.
 */
export function selectDenseMargins(
  pathname: string,
  motifs: readonly DoodleMotif[],
  _opts: { mobileCount?: number } = {}
): DenseMarginPlacement[] {
  if (!motifs.length) return [];

  const path = normalizeDoodlePathname(pathname);
  const rng = mulberry32(hashPathname(`edge:${path}`));
  const order = shuffleIndices(rng, motifs.length).map((i) => motifs[i]);

  const startTops = [...PHI_EDGE_TOPS_START];
  const endTops = [...PHI_EDGE_TOPS_END];
  while (startTops.length + endTops.length < order.length) {
    const nextStart = Math.min(
      92,
      Math.round(
        (startTops[startTops.length - 1] +
          (100 - startTops[startTops.length - 1]) / PHI) *
          10
      ) / 10
    );
    const nextEnd = Math.min(
      94,
      Math.round(
        (endTops[endTops.length - 1] +
          (100 - endTops[endTops.length - 1]) / PHI) *
          10
      ) / 10
    );
    if (startTops.length <= endTops.length) startTops.push(nextStart);
    else endTops.push(nextEnd);
  }

  let si = 0;
  let ei = 0;
  let prevSize: number | null = null;
  let prevMobileSize: number | null = null;

  const placements: DenseMarginPlacement[] = order.map((m, i) => {
    const side: 'start' | 'end' = i % 2 === 0 ? 'start' : 'end';
    const tops = side === 'start' ? startTops : endTops;
    const ti = side === 'start' ? si++ : ei++;
    const baseTop = tops[ti % tops.length];
    const jitter = (rng() - 0.5) * 2.0;
    const topPct = Math.min(94, Math.max(6, Math.round((baseTop + jitter) * 10) / 10));
    const sizePx = nextPhiSize(rng, prevSize, PHI_EDGE_SIZES);
    prevSize = sizePx;
    const mobileSizePx = nextPhiSize(rng, prevMobileSize, MOBILE_EDGE_SIZES);
    prevMobileSize = mobileSizePx;
    const rotate = Math.round((-14 + rng() * 26) * 10) / 10; // −14..+12
    const bleed = Math.round((0.15 + rng() * 0.15) * 100) / 100; // 15–30%
    const delay = Math.round(rng() * 45) / 10; // 0–4.5s
    const duration = Math.round((5 + rng() * 4) * 10) / 10; // 5–9s
    const bobPx = Math.round(4 + rng() * 4); // 4–8
    const wobbleDeg = Math.round((3 + rng() * 2) * 10) / 10; // 3–5
    const opacity = Math.round((0.5 + rng() * 0.38) * 100) / 100; // 0.5–0.88
    return {
      id: m.id,
      src: m.src,
      side,
      topPct,
      sizePx,
      mobileSizePx,
      rotate,
      bleed,
      float: true,
      delay,
      duration,
      bobPx,
      wobbleDeg,
      opacity,
      mobileVisible: false, // filled below
    };
  });

  // Sparse mobile set: pick 3 with large vertical gaps (≤1–2 edges in a viewport).
  const mobileWant = Math.min(3, placements.length);
  const byTop = [...placements].sort((a, b) => a.topPct - b.topPct);
  const chosen: DenseMarginPlacement[] = [];
  const minGap = 28; // % of document — keeps thin edges from stacking in one screen
  for (const p of byTop) {
    if (chosen.length >= mobileWant) break;
    if (chosen.every((c) => Math.abs(c.topPct - p.topPct) >= minGap)) {
      chosen.push(p);
    }
  }
  // Fill if gaps were too aggressive
  for (const p of byTop) {
    if (chosen.length >= mobileWant) break;
    if (!chosen.includes(p)) chosen.push(p);
  }
  const mobileIds = new Set(chosen.map((p) => p.id));
  for (const p of placements) {
    p.mobileVisible = mobileIds.has(p.id);
  }

  return placements;
}
