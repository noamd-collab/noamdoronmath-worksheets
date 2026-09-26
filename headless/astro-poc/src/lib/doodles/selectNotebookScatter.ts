/**
 * Golden-ratio notebook scatter for home/topic sections.
 * Deterministic (seed hashed); SSR-safe — no Math.random().
 * Positions at φ points (23.6 / 38.2 / 61.8 / 76.4 %); sizes 28 / 45 / 73.
 * Every motif animates (bob + wobble) when motion is allowed.
 */
import { hashPathname, type DoodleMotif } from './selectSiteDoodles';

/** φ ≈ 1.618 — size ladder 28 → 45 → 73 */
export const PHI = 1.6180339887;
export const PHI_SIZES = [28, 45, 73] as const;
/** Section % anchors (and nested 1/φ² bands). */
export const PHI_POINTS = [23.6, 38.2, 61.8, 76.4] as const;

export type ScatterItem = {
  id: string;
  src: string;
  /** Display width — φ ladder (28 / 45 / 73). */
  sizePx: number;
  /** Base rotation (deg). */
  rotate: number;
  /** Always true — every doodle moves when motion allowed. */
  float: boolean;
  opacity: number;
  /** Animation delay seconds. */
  delay: number;
  /** Animation duration seconds (4–9). */
  duration: number;
  /** translateY amplitude px (4–8). */
  bobPx: number;
  /** Extra rotate wobble ±deg (3–6). */
  wobbleDeg: number;
  /** Absolute placement inside section (0–100). */
  xPct: number;
  yPct: number;
  /** Mobile size (same φ ladder; may differ from desktop size). */
  mobileSizePx: number;
  mobileRotate: number;
  mobileOpacity: number;
  /** Legacy edge fields (derived from xPct for RTL-friendly CSS). */
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

/** All unique (x,y) φ-point pairs — never a shared baseline. */
function buildPhiSlots(
  rng: () => number,
  count: number
): Array<{ xPct: number; yPct: number }> {
  const pairs: Array<{ xPct: number; yPct: number }> = [];
  for (const x of PHI_POINTS) {
    for (const y of PHI_POINTS) {
      // Tiny deterministic jitter (±1.2%) so neighbours aren't on a lattice
      pairs.push({ xPct: x, yPct: y });
    }
  }
  const order = shuffleIndices(rng, pairs.length);
  const out: Array<{ xPct: number; yPct: number }> = [];
  let prevY = -999;
  let prevX = -999;
  for (const oi of order) {
    if (out.length >= count) break;
    const base = pairs[oi];
    const jx = Math.round((base.xPct + (rng() - 0.5) * 2.4) * 10) / 10;
    let jy = Math.round((base.yPct + (rng() - 0.5) * 2.4) * 10) / 10;
    // Never same Y band as previous (no common baseline)
    if (Math.abs(jy - prevY) < 6) {
      jy = prevY + (jy >= prevY ? 8 : -8);
    }
    // Prefer φ spacing from previous neighbour on X
    if (Math.abs(jx - prevX) < 8 && out.length > 0) continue;
    const xPct = Math.min(88, Math.max(8, jx));
    const yPct = Math.min(88, Math.max(8, jy));
    out.push({ xPct, yPct });
    prevY = yPct;
    prevX = xPct;
  }
  // Fill if we skipped too many
  while (out.length < count) {
    const x = PHI_POINTS[out.length % PHI_POINTS.length];
    const y = PHI_POINTS[(out.length * 2 + 1) % PHI_POINTS.length];
    out.push({
      xPct: x + out.length * 0.3,
      yPct: y + ((out.length % 3) - 1) * 4,
    });
  }
  return out;
}

function phiSize(rng: () => number): number {
  return PHI_SIZES[Math.floor(rng() * PHI_SIZES.length)];
}

function motionParams(rng: () => number) {
  return {
    float: true as const,
    delay: Math.round((rng() * 4.5) * 10) / 10, // 0–4.5s
    duration: Math.round((4 + rng() * 5) * 10) / 10, // 4–9s
    bobPx: Math.round(4 + rng() * 4), // 4–8
    wobbleDeg: Math.round((3 + rng() * 3) * 10) / 10, // 3–6
  };
}

function edgeFromPct(xPct: number, yPct: number, sectionHintPx = 360) {
  // Derive legacy edge fields for CSS that still keys off side/inset
  const side: 'start' | 'end' = xPct >= 50 ? 'end' : 'start';
  const insetPct = side === 'start' ? xPct : 100 - xPct;
  return {
    side,
    insetPx: Math.round((insetPct / 100) * 40) - 8, // small edge bias
    topPx: Math.round((yPct / 100) * sectionHintPx),
  };
}

/**
 * Pick `count` motifs (preferred first, then fillers) on golden-ratio anchors.
 * EVERY motif floats. Also returns 2–4 math scribbles (formula always included).
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
  const scribbleWantRaw = opts.scribbleCount ?? 3;
  const scribbleWant =
    scribbleWantRaw <= 0
      ? 0
      : Math.min(SCRIBBLE_KINDS.length, Math.max(1, Math.min(4, scribbleWantRaw)));

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
  const slots = buildPhiSlots(rng, order.length);

  const items: ScatterItem[] = order.map((m, i) => {
    const sizePx = phiSize(rng);
    const mobileSizePx = phiSize(rng);
    const rotate = Math.round((-14 + rng() * 26) * 10) / 10;
    const mobileRotate = Math.round((-14 + rng() * 26) * 10) / 10;
    const opacity =
      rng() < 0.2
        ? Math.round((0.42 + rng() * 0.08) * 100) / 100
        : Math.round((0.55 + rng() * 0.35) * 100) / 100;
    const mobileOpacity =
      rng() < 0.2
        ? Math.round((0.42 + rng() * 0.08) * 100) / 100
        : Math.round((0.55 + rng() * 0.35) * 100) / 100;
    const motion = motionParams(rng);
    const slot = slots[i];
    const edge = edgeFromPct(slot.xPct, slot.yPct);
    return {
      id: `${m.id}-${i}`,
      src: m.src,
      sizePx,
      rotate,
      opacity,
      mobileSizePx,
      mobileRotate,
      mobileOpacity,
      xPct: slot.xPct,
      yPct: slot.yPct,
      ...edge,
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

  const scribbleSlots = buildPhiSlots(rng, kinds.length);
  const scribbles: ScribbleItem[] = kinds.map((kind, i) => {
    const slot = scribbleSlots[i];
    const edge = edgeFromPct(slot.xPct, slot.yPct, 320);
    const motion = motionParams(rng);
    return {
      kind,
      rotate:
        kind === 'formula'
          ? Math.round((-6 + rng() * 12) * 10) / 10
          : Math.round((-18 + rng() * 36) * 10) / 10,
      sizePx:
        kind === 'formula'
          ? PHI_SIZES[1] // 45 — readable
          : phiSize(rng),
      ...motion,
      // Formula gets a one-shot draw; still bob gently after
      float: true,
      xPct: slot.xPct,
      yPct: slot.yPct,
      ...edge,
      mobileOpacity:
        rng() < 0.25
          ? Math.round((0.4 + rng() * 0.1) * 100) / 100
          : Math.round((0.55 + rng() * 0.3) * 100) / 100,
    };
  });

  return { motifs: items, scribbles };
}
