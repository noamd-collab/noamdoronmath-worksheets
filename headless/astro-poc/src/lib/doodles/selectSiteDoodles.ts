/**
 * DOODLES-45 — deterministic pathname-seeded site doodle selection.
 * SSR-safe: no Math.random(); same pathname → same motifs/placements.
 */
export type DoodleMotif = {
  id: string;
  /** Public URL path, e.g. /brand/doodles/doodle-01.webp */
  src: string;
};

export type DoodleSlot = 'tl' | 'tr' | 'bl' | 'br' | 'ml' | 'mr';

export type DoodlePlacement = {
  id: string;
  src: string;
  slot: DoodleSlot;
  /** Modest scale variation (≈0.78–1.12). */
  scale: number;
  /** Modest rotation in degrees (≈−11…+11). */
  rotate: number;
  /** Shown at ≤768px; false hides on narrow viewports via CSS. */
  mobileVisible: boolean;
};

export type SelectSiteDoodlesOptions = {
  /** Desktop motif count (clamped 2–3 when catalog allows). Default 3. */
  desktopCount?: number;
  /** How many of the selected motifs stay visible on mobile. Default 2. */
  mobileCount?: number;
};

const DESKTOP_SLOTS: DoodleSlot[] = ['tl', 'tr', 'bl', 'br'];

/** Normalize pathname for stable seeding across trailing-slash variants. */
export function normalizeDoodlePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  let p = pathname.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.toLowerCase();
}

/** Homepage keeps DOODLES-44 two-cluster hero — no global motifs (avoid double density). */
export function shouldSkipSiteDoodles(pathname: string): boolean {
  return normalizeDoodlePathname(pathname) === '/';
}

/** FNV-1a 32-bit — stable across SSR/Node/browser for the same string. */
export function hashPathname(pathname: string): number {
  const s = normalizeDoodlePathname(pathname);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

function pickUniqueIndices(rng: () => number, n: number, k: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(k, n));
}

/**
 * Select 2–3 motifs for a route with distinct slots and modest transforms.
 * Empty catalog → []; homepage → [] (caller should also skip component).
 */
export function selectSiteDoodles(
  pathname: string,
  motifs: readonly DoodleMotif[],
  opts: SelectSiteDoodlesOptions = {}
): DoodlePlacement[] {
  if (!motifs.length) return [];
  if (shouldSkipSiteDoodles(pathname)) return [];

  const desktopWant = Math.min(3, Math.max(2, opts.desktopCount ?? 3));
  const mobileWant = Math.min(2, Math.max(1, opts.mobileCount ?? 2));
  const count = Math.min(desktopWant, motifs.length);

  const seed = hashPathname(pathname);
  const rng = mulberry32(seed);
  const motifIdx = pickUniqueIndices(rng, motifs.length, count);
  const slotIdx = pickUniqueIndices(rng, DESKTOP_SLOTS.length, count);

  const placements: DoodlePlacement[] = motifIdx.map((mi, i) => {
    const motif = motifs[mi];
    const scale = 0.78 + rng() * 0.34; // 0.78–1.12
    const rotate = -11 + rng() * 22; // −11…+11
    return {
      id: motif.id,
      src: motif.src,
      slot: DESKTOP_SLOTS[slotIdx[i]],
      scale: Math.round(scale * 1000) / 1000,
      rotate: Math.round(rotate * 10) / 10,
      mobileVisible: i < mobileWant,
    };
  });

  // Guarantee unique ids and unique slots
  const ids = new Set(placements.map((p) => p.id));
  const slots = new Set(placements.map((p) => p.slot));
  if (ids.size !== placements.length || slots.size !== placements.length) {
    // Deterministic salvage: collapse to first unique by walk order
    const seenId = new Set<string>();
    const seenSlot = new Set<DoodleSlot>();
    return placements.filter((p) => {
      if (seenId.has(p.id) || seenSlot.has(p.slot)) return false;
      seenId.add(p.id);
      seenSlot.add(p.slot);
      return true;
    });
  }
  return placements;
}

/** True when two pathnames yield different id-sets (used in tests). */
export function doodleSelectionsDiffer(
  a: readonly DoodlePlacement[],
  b: readonly DoodlePlacement[]
): boolean {
  const sa = [...a.map((p) => p.id)].sort().join(',');
  const sb = [...b.map((p) => p.id)].sort().join(',');
  if (sa !== sb) return true;
  const pa = a.map((p) => `${p.id}:${p.slot}:${p.scale}:${p.rotate}`).sort().join('|');
  const pb = b.map((p) => `${p.id}:${p.slot}:${p.scale}:${p.rotate}`).sort().join('|');
  return pa !== pb;
}
