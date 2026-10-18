/** Presentation for the authored lesson expressions, not a general LaTeX parser. */
export type LessonMathPart = string | { numerator: string; denominator: string };
const fraction = (numerator: string, denominator: string): LessonMathPart => ({ numerator, denominator });
const compoundFractions: Record<string, LessonMathPart[]> = {
  '(35 ÷ 5)/(60 ÷ 5)': [fraction('35 ÷ 5', '60 ÷ 5')],
  '(x² − 9)/(x − 3); x ≠ 3': [fraction('x² − 9', 'x − 3'), '; x ≠ 3'],
  '((x − 3)(x + 3))/(x − 3)': [fraction('(x − 3)(x + 3)', 'x − 3')],
};

export function lessonMathParts(expression: string): LessonMathPart[] {
  if (compoundFractions[expression]) return compoundFractions[expression];
  return expression.split(/(\d+\/\d+)/g).filter(Boolean).map(part => {
    const match = /^(\d+)\/(\d+)$/.exec(part);
    return match ? fraction(match[1], match[2]) : part;
  });
}
