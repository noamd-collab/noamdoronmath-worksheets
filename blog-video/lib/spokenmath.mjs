// Turns a spoken Hebrew math phrase ("שמונה ועוד שתיים כפול שלוש שווה ארבע עשרה")
// into school notation, so the checker can compare what the avatar says with what
// the screen shows. Deliberately small: numbers 0–999 and the operator words used in
// the scripts. Anything else throws, and the pair must then be marked for manual review.
import { checkFormula } from './mathcheck.mjs';
import { stripNiqqud } from './hebrew.mjs';

const UNITS = { אפס: 0, אחת: 1, אחד: 1, שתיים: 2, שתים: 2, שניים: 2, שנים: 2, שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9 };
const TENS = { עשר: 10, עשרה: 10, עשרים: 20, שלושים: 30, ארבעים: 40, חמישים: 50, שישים: 60, שבעים: 70, שמונים: 80, תשעים: 90 };
const HUNDREDS = { מאה: 100, מאתיים: 200 };
const OPS = { ועוד: '+', פחות: '−', כפול: '×', חלקי: ':', בחזקת: '^', שווה: '=', שווים: '=', וזה: '=', זה: '=', מינוס: '−', שורש: '√' };
const FILLER = new Set(['ל', 'של']);

/** Reads one number starting at words[i]; returns [value, nextIndex] or null. */
function readNumber(w, i) {
  let total = 0, used = i, any = false;
  const unitOf = (x) => UNITS[x] ?? UNITS[x?.replace(/^ו/, '')];
  if (HUNDREDS[w[used]] !== undefined) { total += HUNDREDS[w[used]]; used++; any = true; }
  else if (unitOf(w[used]) !== undefined && (w[used + 1] === 'מאות')) { total += unitOf(w[used]) * 100; used += 2; any = true; }
  const t = w[used]?.replace(/^ו/, '');
  if (t && TENS[t] !== undefined && t !== 'עשר' && t !== 'עשרה') { total += TENS[t]; used++; any = true; const u = w[used]; if (u?.startsWith('ו') && UNITS[u.slice(1)] !== undefined) { total += UNITS[u.slice(1)]; used++; } }
  else if (unitOf(w[used]) !== undefined) {
    const u = unitOf(w[used]); used++; any = true;
    if (w[used] === 'עשרה' || w[used] === 'עשר') { total += 10 + u; used++; } else total += u;
  } else if (t === 'עשר' || t === 'עשרה') { total += 10; used++; any = true; }
  return any ? [total, used] : null;
}

export function spokenToFormula(phrase) {
  const w = stripNiqqud(phrase).replace(/[,.?!;:]/g, ' ').replace(/\u05BE/g, ' ').split(/\s+/).filter(Boolean)
    .flatMap((x) => (x === 'בריבוע' ? ['בחזקת', 'שתיים'] : x.startsWith('ל') && readNumber([x.slice(1)], 0) ? [x.slice(1)] : [x]));
  const out = [];
  for (let i = 0; i < w.length;) {
    if (FILLER.has(w[i])) { i++; continue; }
    if (w[i] === 'לא' && (w[i + 1] === 'שווה' || w[i + 1] === 'שווים')) { out.push('≠'); i += 2; continue; }
    const n = readNumber(w, i);
    if (n) { out.push(String(n[0])); i = n[1]; continue; }
    if (OPS[w[i]]) { out.push(OPS[w[i]]); i++; continue; }
    throw new Error(`cannot read "${w[i]}" as math`);
  }
  return out.join(' ').replace(/\^ (\d+)/g, '^$1');
}

/** Same value on both sides of each relation, and the same relations, as the displayed formula. */
export function compareSpokenToDisplay(spoken, display) {
  const asFormula = spokenToFormula(spoken);
  const a = checkFormula(asFormula);
  const b = checkFormula(display);
  if (a.status !== 'ok') return { ok: false, detail: `spoken "${asFormula}": ${a.status} ${a.detail}` };
  if (b.status !== 'ok') return { ok: false, detail: `display: ${b.status} ${b.detail}` };
  const rel = (s) => [...s.matchAll(/[=≠]/g)].map((m) => m[0]).join('');
  if (rel(asFormula) !== rel(display)) return { ok: false, detail: `relations differ: spoken "${asFormula}" vs display "${display}"` };
  if (a.detail !== b.detail) return { ok: false, detail: `values differ: spoken ${a.detail} vs display ${b.detail}` };
  return { ok: true, detail: asFormula };
}
