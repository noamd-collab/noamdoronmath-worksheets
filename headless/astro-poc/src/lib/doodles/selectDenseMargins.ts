/**
 * KIMI-ANIM-6 — dense left/right margin columns of ALL doodle motifs.
 * Deterministic pathname seed; used by SiteDoodles for notebook density.
 */
import {
  hashPathname,
  normalizeDoodlePathname,
  type DoodleMotif,
} from './selectSiteDoodles';

export type DenseMarginPlacement = {
  id: string;
  src: string;
  /** Logical margin column. */
  side: 'start' | 'end';
  /** 0–100 vertical position within the viewport/stack. */
  topPct: number;
  sizePx: number;
  rotate: number;
  scale: number;
  float: boolean;
  delay: number;
  opacity: number;
  /** Shown in the ≤1200 in-flow strip. */
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
 * Place every motif into alternating start/end margin columns with
 * staggered vertical positions — dense notebook gutters.
 */
export function selectDenseMargins(
  pathname: string,
  motifs: readonly DoodleMotif[],
  opts: { mobileCount?: number } = {}
): DenseMarginPlacement[] {
  if (!motifs.length) return [];

  const path = normalizeDoodlePathname(pathname);
  const rng = mulberry32(hashPathname(`dense:${path}`));
  const order = shuffleIndices(rng, motifs.length).map((i) => motifs[i]);
  const mobileWant = Math.min(
    order.length,
    Math.max(4, opts.mobileCount ?? Math.min(6, order.length))
  );

  // Spread vertically; leave a little head/foot room for chrome
  const topStart = 12;
  const topEnd = 88;
  const step =
    order.length <= 1 ? 0 : (topEnd - topStart) / Math.max(1, order.length - 1);

  return order.map((m, i) => {
    const side: 'start' | 'end' = i % 2 === 0 ? 'start' : 'end';
    // Slight jitter so L/R columns don't form a rigid grid
    const jitter = -4 + rng() * 8;
    const topPct = Math.round((topStart + step * i + jitter) * 10) / 10;
    const sizePx = Math.round(88 + rng() * 100); // 88–188 desktop base
    const rotate = Math.round((-16 + rng() * 32) * 10) / 10;
    const scale = Math.round((0.82 + rng() * 0.28) * 1000) / 1000;
    const float = rng() < 0.45;
    const delay = Math.round(rng() * 22) / 10;
    const opacity = Math.round((0.8 + rng() * 0.16) * 100) / 100;
    return {
      id: m.id,
      src: m.src,
      side,
      topPct: Math.min(92, Math.max(8, topPct)),
      sizePx,
      rotate,
      scale,
      float,
      delay,
      opacity,
      mobileVisible: i < mobileWant,
    };
  });
}
