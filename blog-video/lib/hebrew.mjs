// Hebrew text rules for narration and captions. Pure functions, no I/O.

/** Every combining mark in the Hebrew block: cantillation, niqqud, meteg, rafe, dots. */
export const ALL_HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
/** Marks a narration file may carry: vowel points, dagesh/mappiq, shin/sin dots, qamats qatan. */
const ALLOWED_MARK = /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/;
const HEBREW_LETTER = /[א-ת]/;
export const LRI = '\u2066';
export const PDI = '\u2069';
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export const stripNiqqud = (s) => String(s).normalize('NFC').replace(ALL_HEBREW_MARKS, '');
export const hasNiqqud = (s) => /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/.test(s);
export const words = (s) => String(s).replace(BIDI_CONTROLS, '').split(/\s+/).filter(Boolean);
/** A token without surrounding punctuation, used as the glossary key. */
export const bareToken = (t) => t.replace(/^[^א-ת\u0591-\u05C7]+|[^א-ת\u0591-\u05C7]+$/g, '');

/**
 * Problems that make a string unsafe as spoken text: anything a voice would read aloud
 * that is not a word (digits, Latin, math symbols, markup, URLs) and malformed marks.
 */
export function spokenTextProblems(s) {
  const p = [];
  if (s !== s.normalize('NFC')) p.push('not NFC');
  if (/\d/.test(s)) p.push('digit in spoken text (write the number in words)');
  if (/[A-Za-z]/.test(s)) p.push('Latin letters in spoken text');
  if (/[+×÷=<>^√²³⁰-⁹*#_`|{}[\]\\/@~−]/.test(s)) p.push('math/markup symbol in spoken text');
  if (/https?:|www\./.test(s)) p.push('URL in spoken text');
  if (BIDI_CONTROLS.test(s)) p.push('bidi control in spoken text');
  BIDI_CONTROLS.lastIndex = 0;
  if (/\(|\)/.test(s)) p.push('parentheses in spoken text (stage directions belong in script-source.md)');
  for (const m of s.matchAll(ALL_HEBREW_MARKS)) {
    if (!ALLOWED_MARK.test(m[0])) p.push(`disallowed mark U+${m[0].codePointAt(0).toString(16).toUpperCase()}`);
    const prev = s[m.index - 1];
    if (!prev || !(HEBREW_LETTER.test(prev) || ALLOWED_MARK.test(prev))) p.push(`mark without a Hebrew letter at ${m.index}`);
  }
  return [...new Set(p)];
}

/**
 * Applies glossary niqqud to the exact tokens listed. Words not in the glossary stay
 * unpointed on purpose: the policy is targeted niqqud, never a guess for every word.
 */
export function vocalize(spoken, glossaryByToken, overrides = {}) {
  return spoken
    .split(/(\s+)/)
    .map((chunk) => {
      const bare = bareToken(chunk);
      if (!bare) return chunk;
      const form = overrides[bare] ?? glossaryByToken.get(bare)?.niqqud;
      return form ? chunk.replace(bare, form) : chunk;
    })
    .join('');
}

/** Formula runs in captions must sit inside LRI…PDI so RTL layout cannot reverse them. */
export function unisolatedMath(caption) {
  const outside = caption.replace(new RegExp(`${LRI}[^${PDI}]*${PDI}`, 'g'), ' ');
  const bad = [];
  if (/[+×÷=√²³⁰-⁹^−<>≠]/.test(outside)) bad.push('math symbol outside an LTR isolate');
  if (/\d\s*:\s*\d/.test(outside)) bad.push('division colon between numbers outside an LTR isolate');
  return bad;
}

/** Author shorthand {{…}} → isolated LTR run. */
export const isolateMath = (s) => s.replace(/\{\{(.+?)\}\}/g, (_, m) => `${LRI}${m}${PDI}`);
export const removeIsolates = (s) => s.replace(BIDI_CONTROLS, '');
