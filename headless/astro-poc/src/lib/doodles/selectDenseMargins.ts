/**
 * Edge-margin doodle columns — left/right page edges, full height.
 * Golden-ratio vertical spacing; deterministic pathname seed.
 */
import {
  hashPathname,
  normalizeDoodlePathname,
  type DoodleMotif,
} from './selectSiteDoodles';

/** φ vertical anchors for start column (and nested offsets for end). */
export const PHI_EDGE_TOPS_START = [14.6, 23.6, 38.2, 61.8, 76.4] as const;
export const PHI_EDGE_TOPS_END = [19.1, 32.0, 50.0, 68.0, 85.4] as const;
/** Mobile edge widths — half-tucked. */
export const MOBILE_EDGE_SIZES = [24, 28, 32, 36] as const;

export type DenseMarginPlacement = {
  id: string;
  src: string;
  /** Logical margin column (RTL-safe). */
  side: 'start' | 'end';
  /** 0–100 vertical position along the viewport. */
  topPct: number;
  sizePx: number;
  /** Mobile edge size 24–36. */
  mobileSizePx: number;
  rotate: number;
  scale: number;
  float: boolean;
  delay: number;
  duration: number;
  bobPx: number;
  wobbleDeg: number;
  opacity: number;
  /** Always true for edge columns (no strip). */
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

/**
 * Place every motif into alternating start/end edge columns with
 * golden-ratio vertical spacing — full-page margin doodles.
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
  // Extra motifs beyond 5 per side: extend with φ steps into the remaining band
  while (startTops.length + endTops.length < order.length) {
    const nextStart = Math.min(
      92,
      Math.round((startTops[startTops.length - 1] + (100 - startTops[startTops.length - 1]) / 1.618) * 10) / 10
    );
    const nextEnd = Math.min(
      94,
      Math.round((endTops[endTops.length - 1] + (100 - endTops[endTops.length - 1]) / 1.618) * 10) / 10
    );
    if (startTops.length <= endTops.length) startTops.push(nextStart);
    else endTops.push(nextEnd);
  }

  let si = 0;
  let ei = 0;
  return order.map((m, i) => {
    const side: 'start' | 'end' = i % 2 === 0 ? 'start' : 'end';
    const tops = side === 'start' ? startTops : endTops;
    const ti = side === 'start' ? si++ : ei++;
    const baseTop = tops[ti % tops.length];
    // Tiny jitter so L/R never share an exact baseline
    const jitter = (rng() - 0.5) * 2.4;
    const topPct = Math.min(94, Math.max(6, Math.round((baseTop + jitter) * 10) / 10));
    const sizePx = Math.round(72 + rng() * 80); // 72–152 desktop
    const mobileSizePx =
      MOBILE_EDGE_SIZES[Math.floor(rng() * MOBILE_EDGE_SIZES.length)];
    const rotate = Math.round((-16 + rng() * 32) * 10) / 10;
    const scale = Math.round((0.85 + rng() * 0.25) * 1000) / 1000;
    const delay = Math.round(rng() * 45) / 10;
    const duration = Math.round((4 + rng() * 5) * 10) / 10;
    const bobPx = Math.round(4 + rng() * 4);
    const wobbleDeg = Math.round((3 + rng() * 3) * 10) / 10;
    const opacity = Math.round((0.55 + rng() * 0.35) * 100) / 100;
    return {
      id: m.id,
      src: m.src,
      side,
      topPct,
      sizePx,
      mobileSizePx,
      rotate,
      scale,
      float: true,
      delay,
      duration,
      bobPx,
      wobbleDeg,
      opacity,
      mobileVisible: true,
    };
  });
}
