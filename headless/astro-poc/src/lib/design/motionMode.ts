/**
 * Global motion mode for design handoff interactions.
 * שובב | רגוע | כבוי — prefers-reduced-motion and noam-a11y-motion → כבוי.
 */
export type MotionMode = 'שובב' | 'רגוע' | 'כבוי';

export function readMotionMode(): MotionMode {
  if (typeof window === 'undefined') return 'שובב';
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('noam-a11y-motion')
  ) {
    return 'כבוי';
  }
  const attr = document.documentElement.getAttribute('data-motion');
  if (attr === 'רגוע' || attr === 'calm') return 'רגוע';
  if (attr === 'כבוי' || attr === 'off') return 'כבוי';
  return 'שובב';
}

export function motionAllowed(): boolean {
  return readMotionMode() !== 'כבוי';
}

/** רגוע stretches durations ×1.8; כבוי callers should skip animations. */
export function motionSlowFactor(): number {
  return readMotionMode() === 'רגוע' ? 1.8 : 1;
}
