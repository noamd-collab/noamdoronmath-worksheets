/**
 * Query understanding: the grade a query names, words that only phrase the request,
 * and the few synonyms the site's own texts justify.
 */
import { normalizeText, tokenize } from './normalize';

const GRADE_LETTERS: Record<string, number> = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9 };
/** "כיתה", "לכיתה", "בכיתה", "וכיתה", "כתה" … (normalised). */
const GRADE_WORD = /^(?:ו?[לב]?)(?:כיתה|כתה)$/;

export interface GradeInQuery {
  grade: number;
  /** Index range [start, end) of the grade words among the query tokens. */
  start: number;
  end: number;
}

/** The grade a query names ("שברים כיתה ה", "לכיתה ז׳", "כיתה 5"), if exactly one. */
export function gradeInQuery(tokens: readonly string[]): GradeInQuery | null {
  const found: GradeInQuery[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!GRADE_WORD.test(tokens[i])) continue;
    const next = tokens[i + 1];
    const g = GRADE_LETTERS[next] ?? (/^[1-9]$/.test(next) ? Number(next) : undefined);
    if (g) found.push({ grade: g, start: i, end: i + 2 });
  }
  if (found.length !== 1) return null;
  return found[0];
}

/**
 * Words that phrase a request ("הילד שלי מתקשה ב…", "דפי עבודה", "איך") rather than
 * name a topic. They never have to match; when they do, the result ranks a little higher.
 */
export const SOFT_WORDS = new Set(
  [
    'דף', 'דפי', 'דפים', 'עבודה', 'עבודות', 'תרגול', 'תרגולים', 'תרגיל', 'תרגילים', 'תרגילי', 'להורדה', 'pdf',
    'הילד', 'הילדה', 'ילד', 'ילדה', 'ילדים', 'הבן', 'הבת', 'שלי', 'שלנו', 'מתקשה', 'מתקשים', 'קושי',
    'איך', 'מה', 'למה', 'מתי', 'צריך', 'צריכה', 'רוצה', 'עזרה', 'רוצים', 'מחפש', 'מחפשת',
    'על', 'של', 'את', 'עם', 'עד', 'או', 'גם', 'כל', 'אל', 'לפני', 'אחרי', 'בשביל', 'עבור',
    'נושא', 'נושאים', 'מתמטיקה', 'במתמטיקה', 'כיתה', 'כיתות', 'לכיתה', 'בכיתה',
    'פותרים', 'לפתור', 'פותר', 'לומדים', 'ללמוד', 'מתרגלים', 'לתרגל', 'הסבר', 'הסברים', 'מבחן', 'למבחן', 'הכנה',
  ].map(normalizeText)
);

/**
 * Synonyms, each backed by the site's own wording. A query containing `when`
 * (adjacent words) is also searched with `then` in its place.
 */
export const SYNONYMS: ReadonlyArray<{ when: string; then: string; evidence: string }> = [
  {
    when: 'שבר עשרוני',
    then: 'מספר עשרוני',
    evidence: 'Both names are used: 6:18 "שבר עשרוני ואחוז", 5:28 "מספרים עשרוניים ערך מקום".',
  },
  {
    when: 'שברים עשרוניים',
    then: 'מספרים עשרוניים',
    evidence: 'Plural of the pair above.',
  },
  {
    when: 'תיכון',
    then: 'חטיבה העליונה',
    evidence: '9:20 "מעבר לחטיבה העליונה" describes preparation "לקראת כיתה י׳"; 9:13 terms "הכנה לתיכון".',
  },
  {
    when: 'חילוק ארוך',
    then: 'חילוק מאונך',
    evidence: '4:10 "חילוק ארוך ושארית" and 5:4 "חילוק מאונך ושארית" are the same written algorithm.',
  },
];

export interface ParsedQuery {
  raw: string;
  tokens: string[];
  /** Grade named in the query (binding), with its words removed from `tokens`. */
  grade: number | null;
  /** Query without the grade words, as typed (for "search all grades" links). */
  textWithoutGrade: string;
}

export function parseQuery(raw: string): ParsedQuery {
  const all = tokenize(raw);
  const g = gradeInQuery(all);
  const tokens = g ? [...all.slice(0, g.start), ...all.slice(g.end)] : all;
  let textWithoutGrade = raw.trim();
  if (g) {
    // Remove the grade words from the text as typed, keeping the user's spelling.
    const words = raw.trim().split(/\s+/);
    const kept: string[] = [];
    let ti = 0;
    for (const w of words) {
      const n = tokenize(w);
      const inGrade = n.length > 0 && ti >= g.start && ti < g.end;
      ti += n.length;
      if (!inGrade) kept.push(w);
    }
    textWithoutGrade = kept.join(' ');
  }
  return { raw, tokens, grade: g ? g.grade : null, textWithoutGrade };
}
