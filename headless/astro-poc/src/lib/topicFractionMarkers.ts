/**
 * Topic-page fractions are stored as ⟨numerator¦denominator⟩ (never an ASCII
 * slash) and drawn as a stacked fraction with a horizontal bar.
 */
export type FractionPiece = { kind: 'text'; text: string } | { kind: 'frac'; n: string; d: string };

const MARKER = /⟨([^⟨⟩¦]*)¦([^⟨⟩¦]*)⟩/g;

export function splitFractionMarkers(text: string): FractionPiece[] {
  const parts: FractionPiece[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', text: text.slice(last, index) });
    parts.push({ kind: 'frac', n: match[1] ?? '', d: match[2] ?? '' });
    last = index + match[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** Plain reading text for the screen-reader label: "3 חלקי 4". */
export function spokenFraction(n: string, d: string): string {
  return `${n} חלקי ${d}`;
}

/** Visible width of a run, counting each marker as "n/d" so line-fit rules stay as before. */
export function visibleMathLength(text: string): number {
  return text.replace(MARKER, (_m, n: string, d: string) => `${n}/${d}`).length;
}
