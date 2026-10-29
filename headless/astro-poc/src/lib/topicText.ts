import { visibleMathLength } from './topicFractionMarkers';
const LRI = '\u2066';
const PDI = '\u2069';
const NOWRAP_MATH = new Set(['S = (d1 · d2) : 2', '(6 · 8) : 2 = 24', '(10 · 6) : 2 = 30']);
/** A formula this short fits on one 390px line, so it never breaks. */
const NOWRAP_MAX = 28;

/** Keep a whole formula on one line. The isolate stays inside the span. */
export function textParts(text: string): { text: string; nowrap: boolean }[] {
  const parts: { text: string; nowrap: boolean }[] = [];
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
function mathParts(math: string): { text: string; nowrap: boolean }[] {
  if (NOWRAP_MATH.has(math) || visibleMathLength(math) <= NOWRAP_MAX) {
    return [{ text: `${LRI}${math}${PDI}`, nowrap: true }];
  }
  const steps = math.split(/(?<==) /);
  const parts: { text: string; nowrap: boolean }[] = [];
  steps.forEach((step, i) => {
    if (i > 0) parts.push({ text: ' ', nowrap: false });
    const open = i === 0 ? LRI : '';
    const close = i === steps.length - 1 ? PDI : '';
    parts.push({ text: `${open}${step}${close}`, nowrap: visibleMathLength(step) <= NOWRAP_MAX });
  });
  return parts;
}

