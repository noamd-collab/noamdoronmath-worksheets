/**
 * HEADLESS-MIGRATION-32 — general worksheets catalog URL-state contract.
 *
 * Persists search / group filter / cross-grade / track (grade 9) in the URL so
 * browser Back/Forward and viewer `back=` restore the same catalog view.
 * No topic-specific exceptions.
 */
import { isGradeNum, type GradeNum } from './grades';

export type TrackMode = 'reg' | 'red';

/** Canonical catalog UI state mirrored in `/worksheets` search params. */
export type WorksheetsUrlState = {
  grade: GradeNum;
  /** Free-text search (`q`). Empty = omitted from URL. */
  q: string;
  /** Group chip key; `all` = omitted. */
  group: string;
  /** Cross-family-grade search (`cross=1` when true). */
  cross: boolean;
  /** Grade-9 track; `reg` omitted from URL. */
  track: TrackMode;
  /** Optional highlight topic id (`topic=`). */
  topic: number | null;
};

export const WORKSHEETS_PATH = '/worksheets';

const DEFAULT_STATE: Omit<WorksheetsUrlState, 'grade'> = {
  q: '',
  group: 'all',
  cross: false,
  track: 'reg',
  topic: null,
};

function normalizeQuery(raw: string | null | undefined): string {
  if (raw == null) return '';
  return String(raw).trim();
}

function parseTrack(raw: string | null | undefined): TrackMode {
  return raw === 'red' ? 'red' : 'reg';
}

function parseTopic(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (!/^[0-9]+$/.test(raw)) return null;
  return Number(raw);
}

function parseGroup(raw: string | null | undefined): string {
  if (raw == null || raw === '' || raw === 'all') return 'all';
  return String(raw);
}

function parseCross(raw: string | null | undefined): boolean {
  if (raw == null || raw === '' || raw === '0' || raw === 'false') return false;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Read catalog state from URLSearchParams.
 * `grade` falls back to 7 when absent (same as parseGradeParam default).
 */
export function parseWorksheetsUrlState(
  params: URLSearchParams,
  fallbackGrade: GradeNum = 7
): WorksheetsUrlState {
  const gradeRaw = params.get('grade');
  let grade: GradeNum = fallbackGrade;
  if (gradeRaw != null && /^[1-9]$/.test(gradeRaw) && isGradeNum(Number(gradeRaw))) {
    grade = Number(gradeRaw) as GradeNum;
  }
  return {
    grade,
    q: normalizeQuery(params.get('q')),
    group: parseGroup(params.get('group')),
    cross: parseCross(params.get('cross')),
    track: grade === 9 ? parseTrack(params.get('track')) : 'reg',
    topic: parseTopic(params.get('topic')),
  };
}

/** Serialize state to search params (only non-default filter fields). */
export function worksheetsSearchParams(state: WorksheetsUrlState): URLSearchParams {
  const p = new URLSearchParams();
  p.set('grade', String(state.grade));
  const q = normalizeQuery(state.q);
  if (q) p.set('q', q);
  if (state.group && state.group !== 'all') p.set('group', state.group);
  if (state.cross) p.set('cross', '1');
  if (state.grade === 9 && state.track === 'red') p.set('track', 'red');
  if (state.topic != null) p.set('topic', String(state.topic));
  return p;
}

/** Build `/worksheets?…` href from full state. */
export function buildWorksheetsHref(state: WorksheetsUrlState): string {
  const qs = worksheetsSearchParams(state).toString();
  return qs ? `${WORKSHEETS_PATH}?${qs}` : WORKSHEETS_PATH;
}

/**
 * Grade-tab / jump href: switch grade while preserving transferable filters.
 * Group keys are grade-specific → reset to `all`.
 * Topic highlight is grade-specific → cleared.
 * Track only applies on grade 9.
 */
export function worksheetsHrefForGrade(
  grade: GradeNum,
  from: Partial<Omit<WorksheetsUrlState, 'grade'>> = {}
): string {
  const q = normalizeQuery(from.q ?? '');
  return buildWorksheetsHref({
    grade,
    q,
    group: 'all',
    cross: !!from.cross,
    track: grade === 9 ? (from.track === 'red' ? 'red' : 'reg') : 'reg',
    topic: null,
  });
}

/** Path+search suitable for viewer `back=` (same-origin catalog restore). */
export function worksheetsBackPath(state: WorksheetsUrlState): string {
  // Topic highlight is navigation chrome, not needed when returning from viewer.
  return buildWorksheetsHref({ ...state, topic: null });
}

export function defaultWorksheetsState(grade: GradeNum): WorksheetsUrlState {
  return { grade, ...DEFAULT_STATE };
}

/** Compare two states for URL sync (ignore topic for replace decisions optionally). */
export function worksheetsStateEqual(a: WorksheetsUrlState, b: WorksheetsUrlState): boolean {
  return (
    a.grade === b.grade &&
    normalizeQuery(a.q) === normalizeQuery(b.q) &&
    (a.group || 'all') === (b.group || 'all') &&
    !!a.cross === !!b.cross &&
    (a.track || 'reg') === (b.track || 'reg') &&
    a.topic === b.topic
  );
}
