/**
 * KIMI-ANIM-6 — dense “student notebook” scatter for home sections.
 * Deterministic (pathname/seed hashed); SSR-safe — no Math.random().
 */
import { hashPathname, type DoodleMotif } from './selectSiteDoodles';

export type ScatterItem = {
  id: string;
  src: string;
  /** Display width in px (varied small→large). */
  sizePx: number;
  rotate: number;
  /** Gentle float on a subset only. */
  float: boolean;
  opacity: number;
  /** Stagger delay seconds when floating. */
  delay: number;
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
 * Pick `count` motifs (preferred first, then fillers), varied size/rotation.
 * About ~40% get float. Also returns 2–4 small math scribbles.
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

  const want = Math.min(
    motifs.length,
    Math.max(3, Math.min(6, opts.count ?? 5))
  );
  const scribbleWant = Math.min(
    SCRIBBLE_KINDS.length,
    Math.max(2, Math.min(4, opts.scribbleCount ?? 3))
  );

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

  // Slight reshuffle so preferred aren't always first visually
  const order = shuffleIndices(rng, picked.length).map((i) => picked[i]);

  const items: ScatterItem[] = order.map((m, i) => {
    const sizePx = Math.round(56 + rng() * 100); // 56–156
    const rotate = Math.round((-18 + rng() * 36) * 10) / 10;
    const float = rng() < 0.42;
    const opacity = Math.round((0.78 + rng() * 0.18) * 100) / 100;
    const delay = Math.round(rng() * 18) / 10;
    return {
      id: `${m.id}-${i}`,
      src: m.src,
      sizePx,
      rotate,
      float,
      opacity,
      delay,
    };
  });

  const scribbleOrder = shuffleIndices(rng, SCRIBBLE_KINDS.length);
  const scribbles: ScribbleItem[] = scribbleOrder.slice(0, scribbleWant).map((ki) => ({
    kind: SCRIBBLE_KINDS[ki],
    rotate: Math.round((-22 + rng() * 44) * 10) / 10,
    sizePx: Math.round(28 + rng() * 36), // 28–64
    float: rng() < 0.35,
    delay: Math.round(rng() * 20) / 10,
  }));

  return { motifs: items, scribbles };
}
