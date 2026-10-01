/**
 * Unlisted social lesson gate.
 *
 * The page is served only for SECRET_LESSON_TOKEN, and only during the 72 hours
 * that start at SECRET_LESSON_START (set at go-live, not in this default).
 * Before that instant, and after start+72h, the route must not send lesson HTML.
 *
 * Clock override (SECRET_LESSON_NOW) is honored only when BOTH
 * SECRET_LESSON_ALLOW_CLOCK=1 and the request host is loopback. Production
 * hosts ignore it.
 */

export const SECRET_LESSON_TOKEN = 'q8w3n6m2k9p4x7r1';

/** 72 hours, counted from the publication instant. */
export const SECRET_LESSON_WINDOW_MS = 72 * 60 * 60 * 1000;

export type LessonPhase = 'live' | 'expired' | 'not-started';

export function lessonPhase(nowMs: number, startsAtIso: string | null | undefined): LessonPhase {
  const raw = (startsAtIso || '').trim();
  if (!raw) return 'not-started';
  const start = Date.parse(raw);
  if (!Number.isFinite(start)) return 'not-started';
  if (nowMs < start) return 'not-started';
  if (nowMs >= start + SECRET_LESSON_WINDOW_MS) return 'expired';
  return 'live';
}

export function lessonEndsAt(startsAtIso: string | null | undefined): number | null {
  const raw = (startsAtIso || '').trim();
  if (!raw) return null;
  const start = Date.parse(raw);
  if (!Number.isFinite(start)) return null;
  return start + SECRET_LESSON_WINDOW_MS;
}

/** Constant-time equality for the unlisted path token. */
export function tokenMatches(given: string | undefined, expected: string = SECRET_LESSON_TOKEN): boolean {
  const a = String(given ?? '');
  const b = String(expected ?? '');
  if (!b) return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isLoopbackHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '[::1]' || h === '::1';
}

/**
 * Production always uses the real clock. Tests on loopback may pass
 * allowClock + nowOverride to simulate expiry without shipping a public bypass.
 */
export function resolveNowMs(opts: {
  hostname: string;
  allowClock: boolean;
  nowOverride?: string | null;
  dateNow?: number;
}): number {
  const real = opts.dateNow ?? Date.now();
  if (!opts.allowClock || !isLoopbackHost(opts.hostname)) return real;
  const raw = (opts.nowOverride || '').trim();
  if (!raw) return real;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : real;
}

export const ROBOTS_VALUE = 'noindex, nofollow';

export function secretResponseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'X-Robots-Tag': ROBOTS_VALUE,
    'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}
