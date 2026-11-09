/**
 * Geometry for the grade-7 adjacent / vertical angles explorer.
 *
 * Angles are in degrees, measured counter-clockwise from the ray that points
 * right, as on the board. SVG y grows downward, so a counter-clockwise arc
 * on screen uses sweep-flag 0.
 *
 * One line is fixed (0° and 180°). The other turns to θ and θ + 180°.
 * The four angles at the vertex:
 *   alpha  0 … θ          beta   θ … 180
 *   alpha2 180 … 180 + θ  beta2  180 + θ … 360
 */

export const AV_VIEW = { width: 480, height: 300 } as const;
export const AV_VERTEX = { x: 240, y: 150 } as const;
/** Half-length of the fixed line and of the turning line. */
export const AV_FIXED_HALF = 200;
export const AV_TURN_HALF = 138;
export const AV_SECTOR_R = 58;
export const AV_STRAIGHT_R = 136;
export const AV_MIN = 30;
export const AV_MAX = 150;
export const AV_START = 65;
export const AV_LABEL_FONT = 28;

export type AvMode = 'adjacent' | 'vertical';
export type AvAngleKey = 'alpha' | 'beta' | 'alpha2' | 'beta2';
export type AvPoint = { x: number; y: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function clampTheta(theta: number): number {
  return Math.min(AV_MAX, Math.max(AV_MIN, theta));
}

export function polar(deg: number, r: number): AvPoint {
  return {
    x: round2(AV_VERTEX.x + r * Math.cos(rad(deg))),
    y: round2(AV_VERTEX.y - r * Math.sin(rad(deg))),
  };
}

/** The counter-clockwise span of each named angle. */
export function angleSpan(key: AvAngleKey, theta: number): { from: number; to: number } {
  switch (key) {
    case 'alpha': return { from: 0, to: theta };
    case 'beta': return { from: theta, to: 180 };
    case 'alpha2': return { from: 180, to: 180 + theta };
    case 'beta2': return { from: 180 + theta, to: 360 };
  }
}

/** Arc from `from` to `to`, counter-clockwise on screen, centred on the vertex. */
export function arcPath(from: number, to: number, r: number): string {
  const a = polar(from, r);
  const b = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M${a.x} ${a.y} A${r} ${r} 0 ${large} 0 ${b.x} ${b.y}`;
}

export function sectorPath(from: number, to: number, r: number): string {
  const a = polar(from, r);
  const b = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M${AV_VERTEX.x} ${AV_VERTEX.y} L${a.x} ${a.y} A${r} ${r} 0 ${large} 0 ${b.x} ${b.y} Z`;
}

/**
 * Where a degree label sits: on the bisector, pushed out on narrow angles
 * so the text box clears both arms.
 */
export function labelPoint(from: number, to: number): AvPoint {
  const half = rad((to - from) / 2);
  const r = Math.min(106, Math.max(84, 28 / Math.sin(half)));
  return polar((from + to) / 2, r);
}

/** Rough text box for a label such as "115°" at AV_LABEL_FONT. */
export function labelBox(text: string, at: AvPoint) {
  const w = text.length * AV_LABEL_FONT * 0.56;
  const h = AV_LABEL_FONT * 0.78;
  return { x1: at.x - w / 2, x2: at.x + w / 2, y1: at.y - h / 2, y2: at.y + h / 2 };
}

/**
 * Integer readouts. beta is derived from the shown alpha so the visible
 * sum is always exactly 180.
 */
export function angleValues(theta: number): { alpha: number; beta: number } {
  const alpha = Math.round(clampTheta(theta));
  return { alpha, beta: 180 - alpha };
}

export function degreeText(n: number): string {
  return `${n}°`;
}

/** The free side below the fixed line, away from the lower turning ray. */
export function straightLabelPoint(theta: number): AvPoint {
  return polar(theta <= 90 ? 315 : 225, 70);
}

export type AvFrame = {
  mode: AvMode;
  theta: number;
  alpha: number;
  beta: number;
  turnA: AvPoint;
  turnB: AvPoint;
  sectors: Record<AvAngleKey, string>;
  arcs: Record<AvAngleKey, string>;
  labels: Record<AvAngleKey, AvPoint>;
  shown: Record<AvAngleKey, 'strong' | 'faint' | 'off'>;
  labelled: Record<AvAngleKey, boolean>;
  straight: { path: string; label: AvPoint; visible: boolean };
};

const KEYS: readonly AvAngleKey[] = ['alpha', 'beta', 'alpha2', 'beta2'];

export function avFrame(mode: AvMode, rawTheta: number): AvFrame {
  const theta = clampTheta(rawTheta);
  const { alpha, beta } = angleValues(theta);
  const sectors = {} as Record<AvAngleKey, string>;
  const arcs = {} as Record<AvAngleKey, string>;
  const labels = {} as Record<AvAngleKey, AvPoint>;
  for (const key of KEYS) {
    const { from, to } = angleSpan(key, theta);
    sectors[key] = sectorPath(from, to, AV_SECTOR_R);
    arcs[key] = arcPath(from, to, AV_SECTOR_R);
    labels[key] = labelPoint(from, to);
  }
  const adjacent = mode === 'adjacent';
  return {
    mode,
    theta,
    alpha,
    beta,
    turnA: polar(theta, AV_TURN_HALF),
    turnB: polar(theta + 180, AV_TURN_HALF),
    sectors,
    arcs,
    labels,
    shown: adjacent
      ? { alpha: 'strong', beta: 'strong', alpha2: 'off', beta2: 'off' }
      : { alpha: 'strong', beta: 'faint', alpha2: 'strong', beta2: 'faint' },
    labelled: adjacent
      ? { alpha: true, beta: true, alpha2: false, beta2: false }
      : { alpha: true, beta: false, alpha2: true, beta2: false },
    straight: {
      path: arcPath(0, 180, AV_STRAIGHT_R),
      label: straightLabelPoint(theta),
      visible: adjacent,
    },
  };
}

/** The one Hebrew sentence a screen reader hears for a frame. */
export function avAnnouncement(mode: AvMode, theta: number): string {
  const { alpha, beta } = angleValues(theta);
  return mode === 'adjacent'
    ? `זוויות צמודות: ${alpha} מעלות ועוד ${beta} מעלות שווה 180 מעלות.`
    : `זוויות קודקודיות: ${alpha} מעלות שווה ${alpha} מעלות.`;
}

/**
 * Autoplay script. Each chapter holds, turns the line, holds, and returns,
 * so pupils see the relation survive a change of angle.
 */
export const AV_CHAPTER_SECONDS: Record<AvMode, number> = { adjacent: 8, vertical: 9 };
export const AV_GHOST_SECONDS = 1.6;

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

export function chapterTheta(mode: AvMode, t: number): number {
  if (mode === 'adjacent') {
    if (t < 1.5) return AV_START;
    if (t < 4) return AV_START + (125 - AV_START) * ease((t - 1.5) / 2.5);
    if (t < 5) return 125;
    if (t < 7) return 125 + (AV_START - 125) * ease((t - 5) / 2);
    return AV_START;
  }
  if (t < 2.5) return AV_START;
  if (t < 5) return AV_START + (120 - AV_START) * ease((t - 2.5) / 2.5);
  if (t < 6) return 120;
  if (t < 8) return 120 + (AV_START - 120) * ease((t - 6) / 2);
  return AV_START;
}

/** Rotation (degrees, counter-clockwise) of the copy of alpha that lands on its vertical partner. */
export function ghostTurn(t: number): number {
  return 180 * ease(t / AV_GHOST_SECONDS);
}
