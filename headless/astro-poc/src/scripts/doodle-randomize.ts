/**
 * Client-side doodle layout picker (Noam 00:50).
 * Random layout + shuffled assets + ±3° jitter; fade via html.doodles-ready.
 */
import {
  EDGE_LAYOUTS,
  SECTION_LAYOUTS,
  type EdgeLayoutSlot,
  type SectionLayoutSlot,
} from '../lib/doodles/doodleLayouts';

type Asset = { id: string; src: string };

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickLayout<T>(rng: () => number, layouts: readonly T[]): T {
  return layouts[Math.floor(rng() * layouts.length)];
}

function jitterRot(rng: () => number, base: number): number {
  const j = rng() * 6 - 3;
  return Math.round(Math.min(12, Math.max(-14, base + j)) * 10) / 10;
}

function collectAssets(): Asset[] {
  const map = new Map<string, Asset>();
  document
    .querySelectorAll<HTMLImageElement>(
      '[data-site-doodles] img[src], [data-home-section-notebook] img[src], [data-mobile-nb-corners] img[src]'
    )
    .forEach((img) => {
      const raw = img.getAttribute('data-doodle-id') || img.src;
      const base = String(raw).replace(/-\d+$/, '');
      const src = img.getAttribute('src');
      if (src && !map.has(base)) map.set(base, { id: base, src });
    });
  return [...map.values()];
}

function applyEdge(
  root: Element,
  layout: readonly EdgeLayoutSlot[],
  assets: Asset[],
  rng: () => number
) {
  const imgs = [
    ...root.querySelectorAll<HTMLImageElement>('img.site-doodle'),
  ];
  if (!imgs.length || !layout.length) return;
  const pool = shuffle(rng, assets);
  const n = Math.min(imgs.length, layout.length);
  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i];
    if (i >= n) {
      el.style.display = 'none';
      continue;
    }
    const s = layout[i];
    const asset = pool[i % pool.length];
    el.style.display = '';
    el.src = asset.src;
    el.setAttribute('data-doodle-id', asset.id);
    el.setAttribute('data-doodle-side', s.side);
    el.setAttribute('data-mobile-visible', s.mobileVisible ? '1' : '0');
    el.classList.toggle('site-doodle--start', s.side === 'start');
    el.classList.toggle('site-doodle--end', s.side === 'end');
    el.classList.toggle('site-doodle--mobile', !!s.mobileVisible);
    el.classList.toggle('site-doodle--desktop-only', !s.mobileVisible);
    const rot = jitterRot(rng, s.rotate);
    el.style.insetBlockStart = `${s.topPct}%`;
    el.style.setProperty('--d-size', `${s.sizePx}px`);
    el.style.setProperty('--m-size', `${s.mobileSizePx}px`);
    el.style.setProperty('--doodle-bleed', String(s.bleed));
    el.style.setProperty('--doodle-rotate', `${rot}deg`);
    el.style.setProperty('--doodle-op', String(s.opacity));
    el.style.setProperty('--doodle-delay', `${s.delay}s`);
    el.style.setProperty('--doodle-dur', `${s.duration}s`);
    el.style.setProperty('--doodle-bob', `${s.bobPx}px`);
    el.style.setProperty('--doodle-wobble', `${s.wobbleDeg}deg`);
    el.width = s.sizePx;
    el.height = s.sizePx;
  }
}

function applySection(
  root: Element,
  layout: readonly SectionLayoutSlot[],
  assets: Asset[],
  rng: () => number
) {
  const imgs = [
    ...root.querySelectorAll<HTMLImageElement>(
      'img.home-nb-doodle, img.mobile-nb-corner'
    ),
  ];
  if (!imgs.length || !layout.length) return;
  const pool = shuffle(rng, assets);
  const n = Math.min(imgs.length, layout.length);
  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i];
    if (i >= n) {
      el.style.display = 'none';
      continue;
    }
    const s = layout[i];
    const asset = pool[i % pool.length];
    el.style.display = '';
    el.src = asset.src;
    el.setAttribute('data-doodle-id', asset.id);
    el.setAttribute('data-nb-side', s.side);
    const isStart = s.side === 'start';
    const isHome = el.classList.contains('home-nb-doodle');
    const isTopic = el.classList.contains('mobile-nb-corner');
    if (isHome) {
      el.classList.toggle('home-nb-doodle--start', isStart);
      el.classList.toggle('home-nb-doodle--end', !isStart);
      el.classList.toggle('home-nb-doodle--mobile-show', i < 1);
      el.classList.toggle('home-nb-doodle--mobile-hide', i >= 1);
    }
    if (isTopic) {
      el.classList.toggle('mobile-nb-corner--start', isStart);
      el.classList.toggle('mobile-nb-corner--end', !isStart);
      el.classList.toggle('mobile-nb-corner--mobile-show', i < 1);
      el.classList.toggle('mobile-nb-corner--mobile-hide', i >= 1);
    }
    const rot = jitterRot(rng, s.rotate);
    el.style.setProperty('--y', `${s.yPct}%`);
    el.style.setProperty('--inline-inset', `${s.inlineInsetPct}%`);
    el.style.insetBlockStart = `${s.yPct}%`;
    if (isStart) {
      el.style.insetInlineStart = `${s.inlineInsetPct}%`;
      el.style.insetInlineEnd = 'auto';
    } else {
      el.style.insetInlineEnd = `${s.inlineInsetPct}%`;
      el.style.insetInlineStart = 'auto';
    }
    el.style.setProperty('--d-size', `${s.sizePx}px`);
    el.style.setProperty('--m-size', `${s.mobileSizePx}px`);
    el.style.setProperty('--r', `${rot}deg`);
    el.style.setProperty('--d-op', String(s.opacity));
    el.style.setProperty('--m-op', String(s.opacity));
    el.style.setProperty('--d-delay', `${s.delay}s`);
    el.style.setProperty('--d-dur', `${s.duration}s`);
    el.style.setProperty('--d-bob', `${s.bobPx}px`);
    el.style.setProperty('--d-wobble', `${s.wobbleDeg}deg`);
    el.width = s.sizePx;
    el.height = s.sizePx;
  }
}

function run() {
  const seed =
    (Date.now() ^ ((Math.random() * 0x7fffffff) >>> 0)) >>> 0;
  const rng = mulberry32(seed);
  const assets = collectAssets();
  if (!assets.length) {
    document.documentElement.classList.remove('doodles-pending');
    document.documentElement.classList.add('doodles-ready');
    return;
  }

  const edgeLayout = pickLayout(rng, EDGE_LAYOUTS);
  const edgeRoot = document.querySelector('[data-site-doodles-edges]');
  if (edgeRoot) {
    applyEdge(edgeRoot, edgeLayout, assets, rng);
    edgeRoot.setAttribute('data-layout-seed', String(seed));
    edgeRoot.setAttribute(
      'data-layout-index',
      String(EDGE_LAYOUTS.indexOf(edgeLayout))
    );
  }

  const sectionRoots = document.querySelectorAll(
    '[data-home-section-notebook], [data-mobile-nb-corners]'
  );
  sectionRoots.forEach((root, i) => {
    applySection(root, pickLayout(rng, SECTION_LAYOUTS), assets, rng);
    root.setAttribute('data-layout-seed', String(seed + i + 1));
  });

  document.documentElement.classList.remove('doodles-pending');
  document.documentElement.classList.add('doodles-ready');
}

try {
  document.documentElement.classList.add('doodles-pending');
} catch {
  /* ignore */
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
  run();
}
