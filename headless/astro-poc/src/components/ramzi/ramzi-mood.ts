export const RAMZI_MOODS = ['idle', 'thinking', 'hint', 'success', 'error'] as const;
export type RamziMood = (typeof RAMZI_MOODS)[number];

export interface MotionSnapshot {
  hidden: boolean;
  reduced: boolean;
  eventOff: boolean;
  classList: { contains(name: string): boolean };
  storage: { getItem(key: string): string | null } | null;
}

export interface ConsoleMoodInput {
  thinking: boolean;
  error: boolean;
  hintDelivered: boolean;
  confirmed: boolean;
}

export function isRamziMood(value: string | null | undefined): value is RamziMood {
  return !!value && (RAMZI_MOODS as readonly string[]).includes(value);
}

/** True when any of the four site motion-off triggers is active. */
export function motionIsOff(snapshot: MotionSnapshot): boolean {
  if (snapshot.hidden || snapshot.reduced || snapshot.eventOff) return true;
  if (snapshot.classList.contains('nd-motion-off') || snapshot.classList.contains('noam-a11y-motion')) {
    return true;
  }
  const storage = snapshot.storage;
  if (!storage) return false;
  try {
    const direct = storage.getItem('noam-a11y-motion');
    if (direct === 'off' || direct === '0' || direct === 'false') return true;
    const saved = JSON.parse(storage.getItem('noam-accessibility-v1') || '{}') as {
      motion?: boolean;
      stopAnim?: boolean;
    };
    if (saved && (saved.motion === true || saved.stopAnim === true)) return true;
  } catch {
    /* Storage can throw. The class triggers still apply. */
  }
  return false;
}

/** thinking > error > success > hint > idle. Demo answer text is not a trigger. */
export function consoleMood(input: ConsoleMoodInput): RamziMood {
  if (input.thinking) return 'thinking';
  if (input.error) return 'error';
  if (input.confirmed) return 'success';
  if (input.hintDelivered) return 'hint';
  return 'idle';
}

export function readBrowserMotionOff(eventOff: boolean): boolean {
  if (typeof document === 'undefined') return true;
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return motionIsOff({
    hidden: document.hidden,
    reduced,
    eventOff,
    classList: document.documentElement.classList,
    storage,
  });
}
