/** Small, balanced-operand parser for authored arithmetic, not HTML or LaTeX. */
export type LessonMathPart = string | { numerator: string; denominator: string };
const atom = /^[−-]?(?:\d+(?:\.\d+)?[a-zA-Z]*|[a-zA-Z]+)[²³]?$/;
function operand(source: string, at: number, direction: -1 | 1): [number, number] | null {
  let i = at;
  while (source[i] === ' ') i += direction;
  const edge = i;
  const open = direction === -1 ? ')' : '(';
  const close = direction === -1 ? '(' : ')';
  if (source[i] === open) {
    let depth = 1;
    for (i += direction; i >= 0 && i < source.length; i += direction) {
      if (source[i] === open) depth++;
      if (source[i] === close && --depth === 0) {
        const start = Math.min(i, edge), end = Math.max(i, edge) + 1;
        // Only mathematical characters inside an operand; never consume prose/markup.
        return /^[\dA-Za-z²³+−\-×÷·(). ]+$/.test(source.slice(start + 1, end - 1)) ? [start, end] : null;
      }
    }
    return null;
  }
  while (i >= 0 && i < source.length && /[\dA-Za-z²³.−-]/.test(source[i])) i += direction;
  const range: [number, number] = direction === -1 ? [i + 1, edge + 1] : [edge, i];
  return atom.test(source.slice(...range)) ? range : null;
}
const unwrap = (s: string) => s.startsWith('(') && s.endsWith(')') ? s.slice(1, -1) : s;
export function lessonMathParts(expression: string): LessonMathPart[] {
  const parts: LessonMathPart[] = [];
  let last = 0;
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] !== '/') continue;
    const token = expression.slice(0, i).split(/\s/).pop() + expression.slice(i).split(/\s/)[0];
    if (token.includes('://') || token.startsWith('/')) continue;
    const left = operand(expression, i - 1, -1), right = operand(expression, i + 1, 1);
    if (!left || !right || left[0] < last) continue;
    if (left[0] > last) parts.push(expression.slice(last, left[0]));
    parts.push({ numerator: unwrap(expression.slice(...left)), denominator: unwrap(expression.slice(...right)) });
    last = right[1];
    i = last - 1;
  }
  if (last < expression.length) parts.push(expression.slice(last));
  return parts;
}
export function spokenLessonMath(value: string): string {
  return lessonMathParts(value).map(p => typeof p === 'string' ? p : ` שבר: המונה ${p.numerator}, המכנה ${p.denominator}, סוף שבר `).join('');
}
