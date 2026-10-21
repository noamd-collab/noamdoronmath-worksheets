/**
 * Area film «שטח דלתון — מהדלתון למלבן».
 * Timing matches the GSAP timeline (84s): same beats, eases, and Hebrew.
 * Diagonals of the drawn kite: AC = 530, BD = 460, perpendicular.
 * Kite area = 530 × 460 / 2 = 121900. The rectangle is 460 × 530 = 243800 = 2S.
 */

type EaseName =
  | 'none'
  | 'power1.out'
  | 'power2.out'
  | 'power2.inOut'
  | 'power3.out'
  | 'sine.out'
  | 'sine.inOut'
  | 'back.out';

type Prop =
  | 'opacity'
  | 'x'
  | 'y'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'rotation'
  | 'dash'
  | 'strokeWidth'
  | 'progress';

interface Seg {
  start: number;
  dur: number;
  from: number;
  to: number;
  ease: EaseName;
  back?: number;
}

interface Channel {
  before: number;
  segs: Seg[];
}

const GEOM = [
  { start: 22, end: 25.6, mid: [445, 205] as const },
  { start: 26, end: 29.6, mid: [675, 205] as const },
  { start: 30, end: 33.6, mid: [675, 470] as const },
  { start: 34, end: 37.6, mid: [445, 470] as const },
];

const CUES = [0.2, 5, 11, 16, 21, 38, 43, 49, 55, 60, 65, 72, 79];

const ORIGIN: Record<string, [number, number]> = {
  'diagonal-v': [560, 110],
  'diagonal-h': [330, 300],
  vertexA: [560, 110],
  vertexB: [790, 300],
  vertexC: [560, 640],
  vertexD: [330, 300],
  label0: [483.333, 236.667],
  label1: [636.667, 236.667],
  label2: [636.667, 413.333],
  label3: [483.333, 413.333],
  pivot0: [445, 205],
  pivot1: [675, 205],
  pivot2: [675, 470],
  pivot3: [445, 470],
  copy0: [445, 205],
  copy1: [675, 205],
  copy2: [675, 470],
  copy3: [445, 470],
};

const backOut = (s: number) => {
  const c3 = s + 1;
  return (t: number) => 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2;
};

const EASE: Record<Exclude<EaseName, 'back.out'>, (t: number) => number> = {
  none: (t) => t,
  'power1.out': (t) => t,
  'power2.out': (t) => 1 - (1 - t) ** 2,
  'power2.inOut': (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  'power3.out': (t) => 1 - (1 - t) ** 3,
  'sine.out': (t) => Math.sin((t * Math.PI) / 2),
  'sine.inOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

function easeOf(name: EaseName, t: number, back?: number) {
  if (name === 'back.out') return backOut(back ?? 1.70158)(t);
  return EASE[name](t);
}

function sample(ch: Channel, t: number) {
  let v = ch.before;
  for (const s of ch.segs) {
    if (t < s.start) break;
    const u = s.dur <= 0 ? 1 : Math.min(1, (t - s.start) / s.dur);
    v = s.from + (s.to - s.from) * easeOf(s.ease, u, s.back);
    if (u < 1) break;
  }
  return v;
}

const round = (n: number) => Math.round(n * 100) / 100;

const built = new WeakMap<Element, Map<Element, Map<Prop, Channel>>>();

function ensure(film: Element) {
  const cached = built.get(film);
  if (cached) return cached;
  const groups = new Map<Element, Map<Prop, Channel>>();

  const ka = (name: string) => film.querySelector(`[data-ka="${name}"]`);
  const add = (el: Element | null, prop: Prop, seg: Seg, before: number) => {
    if (!el) return;
    let props = groups.get(el);
    if (!props) groups.set(el, (props = new Map()));
    let ch = props.get(prop);
    if (!ch) props.set(prop, (ch = { before, segs: [] }));
    ch.segs.push(seg);
  };
  const fromOp = (
    el: Element | null,
    start: number,
    dur: number,
    ease: EaseName,
    extra?: { x?: number; y?: number; scale?: number; back?: number },
  ) => {
    add(el, 'opacity', { start, dur, from: 0, to: 1, ease, back: extra?.back }, 0);
    if (extra?.x != null) add(el, 'x', { start, dur, from: extra.x, to: 0, ease, back: extra.back }, extra.x);
    if (extra?.y != null) add(el, 'y', { start, dur, from: extra.y, to: 0, ease, back: extra.back }, extra.y);
    if (extra?.scale != null) {
      add(el, 'scale', { start, dur, from: extra.scale, to: 1, ease, back: extra.back }, extra.scale);
    }
  };

  fromOp(ka('title-wrap'), 0.15, 0.8, 'power3.out', { x: 25 });
  fromOp(ka('brand'), 0.35, 0.6, 'sine.out', { y: -12 });
  fromOp(ka('bottom-bar'), 0.5, 0.6, 'power1.out');
  fromOp(ka('kite-wash'), 1.1, 1.4, 'sine.out');
  ['A', 'B', 'C', 'D'].forEach((n, i) => {
    fromOp(ka('vertex' + n), 2 + i * 0.16, 0.4, 'back.out', { scale: 0.8, back: 1.2 });
  });
  fromOp(ka('vertexO'), 8.6, 0.4, 'sine.out');
  add(ka('diagonal-v'), 'scaleY', { start: 5.6, dur: 1.15, from: 0, to: 1, ease: 'power2.inOut' }, 0);
  add(ka('diagonal-h'), 'scaleX', { start: 7.05, dur: 1.15, from: 0, to: 1, ease: 'power2.inOut' }, 0);
  fromOp(ka('right-angles'), 8.7, 0.55, 'power1.out');

  GEOM.forEach((g, i) => {
    fromOp(ka('original' + i), 11.3 + i * 0.24, 0.65, 'sine.out');
    fromOp(ka('label' + i), 11.8 + i * 0.24, 0.45, 'back.out', { scale: 0.6, back: 1.3 });
    fromOp(ka('copy' + i), g.start - 0.55, 0.45, 'power1.out');
    add(
      ka('copy' + i),
      'rotation',
      { start: g.start, dur: g.end - g.start, from: 0, to: 180, ease: 'sine.inOut' },
      0,
    );
    fromOp(ka('pivot' + i), g.start - 0.45, 0.35, 'back.out', { scale: 0.2, back: 1.4 });
    fromOp(ka('copylabel' + i), g.end + 0.06, 0.3, 'power1.out');
  });

  fromOp(ka('figure-legend'), 21.4, 0.6, 'power1.out');
  fromOp(ka('rectangle-group'), 38.3, 0.8, 'sine.out');
  fromOp(ka('rectangle-corners'), 38.9, 0.55, 'power2.out');
  add(ka('pivots'), 'opacity', { start: 40.5, dur: 0.6, from: 1, to: 0, ease: 'sine.inOut' }, 1);
  fromOp(ka('v-measure'), 43.5, 0.4, 'power1.out');
  add(ka('v-measure'), 'x', { start: 44, dur: 2.5, from: 0, to: -300, ease: 'sine.inOut' }, 0);
  fromOp(ka('v-guides'), 46.5, 0.5, 'sine.out');
  fromOp(ka('v-label'), 46.9, 0.55, 'power3.out', { x: -14 });
  fromOp(ka('h-measure'), 49.5, 0.4, 'power1.out');
  add(ka('h-measure'), 'y', { start: 50, dur: 2.5, from: 0, to: 410, ease: 'sine.inOut' }, 0);
  fromOp(ka('h-guides'), 52.5, 0.5, 'sine.out');
  fromOp(ka('h-label'), 52.9, 0.55, 'power3.out', { y: 10 });

  add(ka('copies'), 'opacity', { start: 65.8, dur: 0.6, from: 1, to: 0.34, ease: 'sine.inOut' }, 1);
  add(ka('copies'), 'opacity', { start: 67.2, dur: 0.6, from: 0.34, to: 1, ease: 'sine.inOut' }, 1);
  add(ka('originals'), 'opacity', { start: 67.3, dur: 0.6, from: 1, to: 0.36, ease: 'sine.inOut' }, 1);
  add(ka('originals'), 'opacity', { start: 69.1, dur: 0.6, from: 0.36, to: 1, ease: 'sine.inOut' }, 1);
  add(ka('copies'), 'opacity', { start: 74.1, dur: 1.3, from: 1, to: 0.2, ease: 'sine.inOut' }, 1);
  add(ka('copy-numbers'), 'opacity', { start: 74.1, dur: 1.3, from: 1, to: 0.3, ease: 'sine.inOut' }, 1);
  add(ka('rectangle-group'), 'opacity', { start: 74.1, dur: 1.3, from: 1, to: 0.4, ease: 'sine.inOut' }, 0);
  add(ka('kite-outline'), 'strokeWidth', { start: 74.2, dur: 1.1, from: 5, to: 7, ease: 'sine.inOut' }, 5);
  add(ka('kite-outline'), 'dash', { start: 0.5, dur: 2.4, from: 1, to: 0, ease: 'power2.inOut' }, 1);
  add(ka('film-progress'), 'progress', { start: 0, dur: 84, from: 0, to: 1, ease: 'none' }, 0);

  CUES.forEach((at, i) => {
    const cue = ka('cue' + i);
    if (!cue) return;
    fromOp(cue, at, 0.55, 'sine.out');
    fromOp(cue.querySelector('.kicker'), at + 0.04, 0.55, 'power3.out', { x: 16 });
    fromOp(cue.querySelector('h2'), at + 0.11, 0.7, 'power2.out', { y: 18 });
    fromOp(cue.querySelector('.explanation'), at + 0.28, 0.65, 'sine.out', { y: 10 });
    const extras = cue.querySelectorAll(
      '.equation, .small-note, .rotation-card, .count-card, .dimension-card, .final-note, .think-card',
    );
    extras.forEach((el, n) => fromOp(el, at + 0.6 + n * 0.12, 0.7, 'power1.out', { y: 14 }));
    const next = CUES[i + 1];
    if (next != null) add(cue, 'opacity', { start: next, dur: 0.45, from: 1, to: 0, ease: 'sine.inOut' }, 0);
  });

  fromOp(ka('prod-ac'), 56.2, 0.5, 'sine.out');
  fromOp(ka('prod-times'), 57, 0.5, 'power1.out');
  fromOp(ka('prod-bd'), 57.8, 0.5, 'power2.out');
  fromOp(ka('denom11'), 74, 0.7, 'back.out', { scale: 0.7, back: 1.2 });

  for (const props of groups.values()) {
    for (const ch of props.values()) ch.segs.sort((a, b) => a.start - b.start);
  }
  built.set(film, groups);
  return groups;
}

function paint(el: Element, props: Map<Prop, Channel>, t: number) {
  const val = (prop: Prop) => {
    const ch = props.get(prop);
    return ch ? sample(ch, t) : null;
  };
  const opacity = val('opacity');
  if (opacity != null) (el as HTMLElement).style.opacity = String(round(opacity));

  const sw = val('strokeWidth');
  if (sw != null) (el as SVGElement).setAttribute('stroke-width', String(round(sw)));

  const dash = val('dash');
  if (dash != null && el instanceof SVGGeometryElement) {
    const len = el.getTotalLength() || 1;
    el.setAttribute('stroke-dasharray', `${len} ${len}`);
    el.setAttribute('stroke-dashoffset', String(round(len * dash)));
  }

  const progress = val('progress');
  if (progress != null) {
    (el as HTMLElement).style.transform = `scaleX(${round(progress)})`;
    return;
  }

  const rot = val('rotation');
  const scale = val('scale');
  const scaleX = val('scaleX');
  const scaleY = val('scaleY');
  const x = val('x');
  const y = val('y');
  const kaName = (el as HTMLElement).dataset.ka || '';
  const origin = ORIGIN[kaName];
  const svg = el.namespaceURI === 'http://www.w3.org/2000/svg';

  if (svg && origin && (rot != null || scale != null || scaleX != null || scaleY != null)) {
    const [cx, cy] = origin;
    if (rot != null) el.setAttribute('transform', `rotate(${round(rot)} ${cx} ${cy})`);
    else if (scale != null) {
      el.setAttribute('transform', `translate(${cx} ${cy}) scale(${round(scale)}) translate(${-cx} ${-cy})`);
    } else {
      const sx = scaleX ?? 1;
      const sy = scaleY ?? 1;
      el.setAttribute(
        'transform',
        `translate(${cx} ${cy}) scale(${round(sx)} ${round(sy)}) translate(${-cx} ${-cy})`,
      );
    }
    return;
  }
  if (svg && (x != null || y != null)) {
    el.setAttribute('transform', `translate(${round(x ?? 0)} ${round(y ?? 0)})`);
    return;
  }
  if (!svg && (x != null || y != null || scale != null)) {
    const parts = [`translate(${round(x ?? 0)}px, ${round(y ?? 0)}px)`];
    if (scale != null) parts.push(`scale(${round(scale)})`);
    (el as HTMLElement).style.transform = parts.join(' ');
  }
}

function updateFacts(film: Element, t: number) {
  const step = t < 11 ? 0 : t < 38 ? 1 : t < 72 ? 2 : 3;
  film.querySelectorAll('[data-step]').forEach((el) => {
    el.classList.toggle('active', Number((el as HTMLElement).dataset.step) === step);
  });
  const status = film.querySelector('[data-ka="copy-status"]');
  if (!status) return;
  let i = GEOM.findIndex((g) => t < g.end + 0.2);
  if (i < 0) i = 3;
  status.textContent =
    t < 21.45
      ? 'מכינים עותק לכל אחד מארבעת המשולשים'
      : t > 37.75
        ? 'ארבעה עותקים — ארבע פינות של מלבן'
        : `מסובבים את עותק ${i + 1} מתוך 4`;
}

export function renderKiteArea(root: ParentNode, t: number) {
  const film = root.querySelector('[data-el="kite-area-film"]');
  if (!film) return;
  const groups = ensure(film);
  for (const [el, props] of groups) paint(el, props, t);
  updateFacts(film, t);
}
