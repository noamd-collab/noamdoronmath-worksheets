/**
 * Hebrew text normalisation and word analysis for the site search.
 *
 * Deliberately conservative: a prefix letter (ו/ה/ב/ל and their combinations) is
 * only removed when what is left is itself a word of the site's own vocabulary,
 * and never from the words in NEVER_STRIP, so "המשך" stays "המשך" and does not
 * become "משך" (duration). No blanket stemming.
 */

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Lower-case, unpointed, final letters folded, punctuation and maqaf as spaces. */
export function normalizeText(input: string): string {
  return String(input ?? '')
    .normalize('NFC')
    .replace(/[־‐-―\-–—_/\\|+=:;,.!?()[\]{}<>]/g, ' ') // maqaf, dashes, punctuation
    .replace(/[֑-ׇ]/g, '') // niqqud and cantillation
    .replace(/[״"'׳`’‘“”]/g, '') // geresh, gershayim, quotes
    .replace(/וו/g, 'ו') // ktiv male/haser: משוואה = משואה
    .replace(/יי(?!ם)/g, 'י') // סימטרייה = סימטריה; keeps the plural ריבועיים
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/גיאו/g, 'גאו')
    .toLowerCase()
    .replace(/[^א-ת0-9a-z]+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(' ') : [];
}

/** The site's own words: as written (`words`) and with their plural endings undone (`forms`). */
export interface Lexicon {
  words: ReadonlySet<string>;
  forms: ReadonlySet<string>;
}

/**
 * Inflection variants of one normalised word (no prefix handling). Feminine and
 * construct endings (ת → ה, ת dropped) are only used when the result is a word the
 * site writes as such, so "מערכת" does not turn into "מערכ" (from מערכים, arrays).
 */
export function inflections(word: string, words?: ReadonlySet<string>): string[] {
  const out = new Set<string>([word]);
  const known = (w: string) => !!words && words.has(w);
  const n = word.length;
  // Words are already normalised, so the plural ending ים is written ימ.
  if (n >= 5 && word.endsWith('ימ')) {
    // Masculine plural: שברים → שבר, ריבועיים → ריבועי; מכנים → מכנה only because the site writes "מכנה".
    const stem = word.endsWith('יימ') ? word.slice(0, -3) + 'י' : word.slice(0, -2);
    out.add(stem);
    if (known(stem + 'ה')) out.add(stem + 'ה');
  }
  if (n >= 5 && word.endsWith('ות')) {
    // Feminine plural: משוואות → משוואה, זוויות → זווית; מערכות → מערכת only if written so.
    const stem = word.slice(0, -2);
    out.add(stem + 'ה');
    if (stem.endsWith('י')) out.add(stem + 'ת');
    if (known(stem + 'ת')) out.add(stem + 'ת');
  }
  if (n >= 4 && word.endsWith('ת')) {
    // Construct state: נוסחת → נוסחה, only to written words.
    if (known(word.slice(0, -1) + 'ה')) out.add(word.slice(0, -1) + 'ה');
    // Feminine adjective: ריבועית → ריבועי. Not "מערכת" → "מערכ" (an array).
    if (word.endsWith('ית') && known(word.slice(0, -1))) out.add(word.slice(0, -1));
  }
  return [...out];
}

/**
 * One-letter prefixes are tried first ("ומספר" → "מספר", not "ספר"); a second
 * prefix is removed only from what is left ("והאלכסונים" → "האלכסונים" →
 * "אלכסונים"). מ/ש/כ alone are root letters too often (משקל, שבר, כפל), so they
 * only count before ה ("מהבסיס").
 */
export const PREFIXES = ['ו', 'ה', 'ב', 'ל', 'מה', 'שה'];

/** Words whose first letter looks like a prefix but belongs to the word. */
export const NEVER_STRIP = new Set<string>([
  'המשכ', // המשך (continue) ≠ משך (duration)
  'הקטנה', // הקטנה (reduction) ≠ קטנה (small)
  'למידה', // למידה (learning) ≠ מידה (measure)
  'לחזק', // לחזק (to strengthen) ≠ חזקה (power)
  'בטוח', // בטוח (sure) ≠ טווח (range)
  'השלמה', // השלמה (completing) ≠ שלם (whole)
  'השלמת',
]);

function withoutPrefix(word: string, lex: Lexicon): string | null {
  if (NEVER_STRIP.has(word)) return null;
  for (const p of PREFIXES) {
    if (!word.startsWith(p)) continue;
    const rest = word.slice(p.length);
    // "ואי" → "אי" (as in אי זוגי); other prefixes need three letters left.
    if (rest.length < (p === 'ו' ? 2 : 3) || NEVER_STRIP.has(rest)) continue;
    if (inflections(rest, lex.words).some((f) => lex.forms.has(f))) return rest;
  }
  return null;
}

/** Inflections of the word, and of the word without a prefix when that is a known word. */
export function analyzeWord(word: string, lex: Lexicon): string[] {
  const out = new Set(inflections(word, lex.words));
  let cur = word;
  for (let depth = 0; depth < 2; depth++) {
    const rest = withoutPrefix(cur, lex);
    if (!rest) break;
    for (const f of inflections(rest, lex.words)) out.add(f);
    cur = rest;
  }
  return [...out];
}

export function buildLexicon(words: Iterable<string>): Lexicon {
  const set = new Set(words);
  const forms = new Set<string>();
  for (const w of set) for (const f of inflections(w)) forms.add(f);
  return { words: set, forms };
}
