/**
 * Layout for topic-page math, including the horizontal-bar fraction marker.
 * Stored text uses ⟨numerator¦denominator⟩ (no ASCII '/'). A leading −/−
 * of the whole fraction stays outside the marker.
 */
const LRI = '\u2066';
const PDI = '\u2069';
const NOWRAP_MATH = new Set(['S = (d1 · d2) : 2', '(6 · 8) : 2 = 24', '(10 · 6) : 2 = 30']);
/** A formula this short fits on one 390px line, so it never breaks. */
const NOWRAP_MAX = 28;
export type FractionPiece =
  | { kind: 'text'; text: string }
  | { kind: 'frac'; n: string; d: string; sign: string };

export type LayoutPiece = { text: string; nowrap: boolean };

function isWholeSign(text: string, index: number): boolean {
  if (index <= 0) return false;
  const ch = text[index - 1];
  if (ch !== '−' && ch !== '-') return false;
  const prev = index === 1 ? '' : text[index - 2]!;
  return !/[A-Za-z0-9)]/.test(prev);
}

/** Split a paragraph into plain runs and stacked fractions. */
export function splitFractionMarkers(text: string): FractionPiece[] {
  const parts: FractionPiece[] = [];
  const marker = /⟨([^⟨⟩¦]*)¦([^⟨⟩¦]*)⟩/g;
  let last = 0;
  for (const match of text.matchAll(marker)) {
    let index = match.index ?? 0;
    let sign = '';
    if (isWholeSign(text, index)) {
      sign = text[index - 1]!;
      index -= 1;
    }
    if (index > last) parts.push({ kind: 'text', text: text.slice(last, index) });
    parts.push({ kind: 'frac', n: match[1] ?? '', d: match[2] ?? '', sign });
    last = (match.index ?? 0) + match[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** Keep a whole formula on one line. The isolate stays inside the span. */
export function layoutMathRuns(text: string): LayoutPiece[] {
  const parts: LayoutPiece[] = [];
  const re = new RegExp(`${LRI}([^${PDI}]*)${PDI}`, 'g');
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), nowrap: false });
    parts.push(...mathParts(match[1] ?? ''));
    last = index + match[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ text: text.slice(last), nowrap: false });
  return parts;
}

/** A long chain may break only after "=". LRI opens the first step and PDI closes the last. */
function mathParts(math: string): LayoutPiece[] {
  if (NOWRAP_MATH.has(math) || math.length <= NOWRAP_MAX) {
    return [{ text: `${LRI}${math}${PDI}`, nowrap: true }];
  }
  const steps = math.split(/(?<==) /);
  const parts: LayoutPiece[] = [];
  steps.forEach((step, i) => {
    if (i > 0) parts.push({ text: ' ', nowrap: false });
    const open = i === 0 ? LRI : '';
    const close = i === steps.length - 1 ? PDI : '';
    parts.push({ text: `${open}${step}${close}`, nowrap: step.length <= NOWRAP_MAX });
  });
  return parts;
}
