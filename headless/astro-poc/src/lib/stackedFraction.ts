/**
 * Superscript fractions (¹⁄₁₀) and vulgar fractions (½) draw their digits
 * at about half the size of a normal "1/4". Split both out so the card and
 * the grade player can stack a full-size numerator over a bar.
 */

const SUP_DIGIT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};
const SUB_DIGIT: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

/** One-character vulgar fractions used in the loops. */
const VULGAR: Record<string, readonly [string, string]> = {
  '½': ['1', '2'],
  '⅓': ['1', '3'],
  '¼': ['1', '4'],
  '⅙': ['1', '6'],
};

const SUP_FRAC = /[½⅓¼⅙]|[⁰¹²³⁴⁵⁶⁷⁸⁹]+⁄[₀₁₂₃₄₅₆₇₈₉]+/g;

export type SupFracPiece =
  | { kind: 'text'; text: string }
  | { kind: 'frac'; n: string; d: string };

export function splitSupFractions(text: string): SupFracPiece[] {
  const parts: SupFracPiece[] = [];
  let at = 0;
  for (const match of text.matchAll(SUP_FRAC)) {
    const start = match.index ?? 0;
    if (start > at) parts.push({ kind: 'text', text: text.slice(at, start) });
    const vulgar = VULGAR[match[0]];
    if (vulgar) {
      parts.push({ kind: 'frac', n: vulgar[0], d: vulgar[1] });
    } else {
      const [num, den] = match[0].split('⁄');
      parts.push({
        kind: 'frac',
        n: [...num].map((ch) => SUP_DIGIT[ch] ?? ch).join(''),
        d: [...den].map((ch) => SUB_DIGIT[ch] ?? ch).join(''),
      });
    }
    at = start + match[0].length;
  }
  if (at < text.length || parts.length === 0) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}
