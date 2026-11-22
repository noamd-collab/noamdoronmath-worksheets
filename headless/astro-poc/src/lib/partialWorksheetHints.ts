/** Identity contract for PDF pins with independently verified, prewritten hints. */
export interface PartialPin {
  exerciseId: string;
  canonicalQuestionSha256: string;
  canonicalItemId: string;
  sourceExerciseSha256: string;
  q: number;
  part: string;
  pin: { page: number; x: number; y: number };
  hintSha256: [string, string, string];
}

export interface PartialHintIndex {
  version: 1;
  editionId: string;
  nativePrefix: string;
  level: 'a' | 'b' | 'c';
  levelCode: 'A' | 'B' | 'E';
  title: string;
  pdfId: string;
  pdfSha256: string;
  canonicalSourceSha256: string;
  items: PartialPin[];
}

export type VerifiedHints = [string, string, string];
type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const matches = (value: unknown, regex: RegExp): value is string =>
  typeof value === 'string' && regex.test(value) && value.trim() === value;
const sha256Pattern = /^[a-f0-9]{64}$/;
export const validPdfId = (value: unknown): value is string => matches(value, /^[a-f0-9]{32}$/);
const digestOk = (value: unknown): value is string => matches(value, sha256Pattern);
const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const unitCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function parsePartialHintIndex(value: unknown, pdfId: string): PartialHintIndex | null {
  if (!validPdfId(pdfId) || !isRecord(value) || value.version !== 1 || value.pdfId !== pdfId ||
      !matches(value.editionId, /^ms-[a-z0-9-]{1,60}$/) || !matches(value.nativePrefix, /^G[789]-T(?:\d{2}|[1-9]\d{2})$/) ||
      !digestOk(value.pdfSha256) || !digestOk(value.canonicalSourceSha256) ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300 ||
      !matches(value.level, /^[abc]$/) || value.levelCode !== ({a:'A',b:'B',c:'E'} as Record<string,string>)[value.level] ||
      !Array.isArray(value.items) || value.items.length === 0 || value.items.length > 1000) return null;
  const exerciseIds = new Set<string>();
  const itemIds = new Set<string>();
  const questionHashes = new Map<number, string>();
  for (const item of value.items) {
    if (!isRecord(item) || !positiveInteger(item.q) || item.q > 99 || !matches(item.part, /^[א-ת]?$/) ||
        item.exerciseId !== value.nativePrefix+'-'+value.levelCode+'-Q'+String(item.q).padStart(2,'0')+item.part ||
        !matches(item.canonicalItemId, /^[a-zA-Z0-9][A-Za-z0-9_.-]{0,127}$/) ||
        !digestOk(item.canonicalQuestionSha256) || !digestOk(item.sourceExerciseSha256) ||
        !isRecord(item.pin) || !positiveInteger(item.pin.page) || !unitCoordinate(item.pin.x) || !unitCoordinate(item.pin.y) ||
        !Array.isArray(item.hintSha256) || item.hintSha256.length !== 3 || !item.hintSha256.every(digestOk) ||
        new Set(item.hintSha256).size !== 3 || exerciseIds.has(item.exerciseId) || itemIds.has(item.canonicalItemId)) return null;
    if (questionHashes.has(item.q) && questionHashes.get(item.q) !== item.canonicalQuestionSha256) return null;
    exerciseIds.add(item.exerciseId);
    itemIds.add(item.canonicalItemId);
    questionHashes.set(item.q, item.canonicalQuestionSha256);
  }
  return value as unknown as PartialHintIndex;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function matchVerifiedRows(index: PartialHintIndex, response: unknown): Promise<Map<string, VerifiedHints>> {
  const verified = new Map<string, VerifiedHints>();
  if (!Array.isArray(response) || response.length > 1000) return verified;
  const rows = new Map<string, RecordValue | null>();
  for (const row of response) {
    if (!isRecord(row) || typeof row.exercise_id !== 'string') continue;
    rows.set(row.exercise_id, rows.has(row.exercise_id) ? null : row);
  }
  await Promise.all(index.items.map(async item => {
    const row = rows.get(item.exerciseId);
    if (!row || row.status !== 'verified' || row.edition_id !== index.editionId ||
        row.source_pdf_hash !== index.pdfId || row.source_pdf_sha256 !== index.pdfSha256 ||
        row.canonical_source_sha256 !== index.canonicalSourceSha256 ||
        row.canonical_question_sha256 !== item.canonicalQuestionSha256 ||
        row.canonical_item_id !== item.canonicalItemId || row.source_exercise_sha256 !== item.sourceExerciseSha256) return;
    const hints = [row.hint_1, row.hint_2, row.hint_3];
    if (!hints.every(hint => typeof hint === 'string' && hint.trim() && hint.length <= 600)) return;
    const strings = hints as VerifiedHints;
    const hashes = await Promise.all(strings.map(text => sha256Hex(new TextEncoder().encode(text).buffer)));
    if (hashes.every((hash, n) => hash === item.hintSha256[n])) verified.set(item.exerciseId, strings);
  }));
  return verified;
}

export function reviewedPageNumbers(index: PartialHintIndex, verified: ReadonlyMap<string, VerifiedHints>): number[] {
  const pages = new Set<number>();
  for (const item of index.items) {
    if (verified.has(item.exerciseId)) pages.add(item.pin.page);
  }
  return [...pages].sort((a,b) => a-b);
}

/** Shares the edition table, RLS status filter and hash predicates of noam-curated-hints.js.
 * Partial indexes omit private exercise text and classic viewer geometry, so they use
 * this narrower reader and authenticate each approved hint tier before display. */
export async function fetchVerifiedRows(index: PartialHintIndex, config: unknown): Promise<Map<string, VerifiedHints>> {
  if (!isRecord(config) || !matches(config.url, /^https:\/\/[a-z0-9-]+\.supabase\.co$/) ||
      typeof config.key !== 'string' || !config.key.trim()) return new Map();
  const url = new URL('/rest/v1/noam_worksheet_edition_hints', config.url);
  url.search = new URLSearchParams({
    select: 'edition_id,exercise_id,source_pdf_hash,source_pdf_sha256,canonical_source_sha256,canonical_question_sha256,canonical_item_id,source_exercise_sha256,hint_1,hint_2,hint_3,status',
    edition_id: 'eq.'+index.editionId, source_pdf_hash: 'eq.'+index.pdfId, source_pdf_sha256: 'eq.'+index.pdfSha256,
    canonical_source_sha256: 'eq.'+index.canonicalSourceSha256, status: 'eq.verified',
    exercise_id: 'like.'+index.nativePrefix+'-'+index.levelCode+'-Q*',
  }).toString();
  const response = await fetch(url, {headers:{apikey:config.key, Accept:'application/json'}, credentials:'omit', cache:'no-store',signal:AbortSignal.timeout(6500)});
  if (!response.ok) throw new Error('Verified hint read unavailable');
  return matchVerifiedRows(index, await response.json());
}
