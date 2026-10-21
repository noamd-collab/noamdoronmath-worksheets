/** Deterministic navigation context, shared by browser and server fallbacks. */
function foldLevel(value) {
  return String(value || "")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[׳״"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** a, b, or c (מצוינות). Empty when the visitor did not name a level. */
export function requestedLevelKey(message) {
  const matches = [...foldLevel(message).toLowerCase().matchAll(LEVEL)];
  if (!matches.length) return "";
  const match = matches.at(-1);
  return match[0] === 'מצוינות' ? 'c' : match[2] || (match[1] === 'א' ? 'a' : 'b');
}

export function levelKeyFromRecord(record) {
  const label = foldLevel(record && record.levelLabel);
  if (label.includes("מצוינות")) return "c";
  if (label === "רמה א") return "a";
  if (label === "רמה ב") return "b";
  const key = String((record && record.levelKey) || "").toLowerCase();
  if (key === "a" || key === "b" || key === "c") return key;
  if (key === "one") return "b";
  const href = String((record && record.href) || "");
  const fromHref = href.match(/[?&]lv=(a|b|c)(?:&|$)/);
  return fromHref ? fromHref[1] : "";
}

const MARKS = 'אבגדהוזחט';
const GRADE = /(?:[בל]?כיתה|\bgrade)\s*([1-9אבגדהוזחט])(?=\s|$|[.,!?])/gi;
const LEVEL = /רמה\s*([אב])(?![א-ת])|\blevel\s*([ab])\b|מצוינות/gi;
const EASIER = /קל\s*יותר|\beasier\b/i;
const HARDER = /קשה\s*יותר|\bharder\b/i;
const FILLER = new Set('אני אנחנו רוצה רוצים צריך צריכה אפשר בבקשה איפה היכן יש את לי על של עם לכיתה כיתה בכיתה דף דפים דפי עבודה תרגול לתרגול תרגילים מתמטיקה במתמטיקה ללמוד למצוא מחפש מחפשת תמצא תראה תן קח תעביר פתח תפתח לנו אותי באתר נושא בנושא לכם עבור עכשיו משהו יותר קל קשה instead now something please i am looking for worksheets worksheet sheets sheet in on for the at about'.split(' '));

function translated(value) {
  return foldLevel(value).toLowerCase().replace(/\bfactor(?:ing|isation|ization)\b/g, 'פירוק לגורמים');
}

/** Only user turns establish intent. The latest explicit value wins, then relative levels apply. */
export function resolveNavigationIntent(input, previousMessage = '') {
  const history = Array.isArray(input && input.history) ? input.history.slice(-8) : [];
  const turns = history.filter(turn => turn && turn.role === 'user').map(turn => String(turn.content || '').slice(0, 700));
  if (!turns.length && previousMessage) turns.push(String(previousMessage).slice(0, 700));
  turns.push(String(input && input.message || '').slice(0, 700));
  let grade = null, level = 'a', subject = '', useLevel = false;
  // Noam's site order: B is easier, A is the default, excellence is harder.
  for (const raw of turns) {
    const text = translated(raw);
    if (/דף|דפים|דפי|תרגול|תרגילים|\b(?:worksheets?|sheets?)\b/.test(text) || EASIER.test(text) || HARDER.test(text)) useLevel = true;
    const grades = [...text.matchAll(GRADE)];
    if (/^[1-9אבגדהוזחט]$/.test(text)) grade = Number(text) || MARKS.indexOf(text) + 1;
    if (grades.length) {
      const mark = grades.at(-1)[1];
      grade = Number(mark) || MARKS.indexOf(mark) + 1;
    }
    const levels = [...text.matchAll(LEVEL)];
    if (levels.length) {
      useLevel = true;
      const match = levels.at(-1);
      level = match[0] === 'מצוינות' ? 'c' : match[2] || (match[1] === 'א' ? 'a' : 'b');
    } else if (level && (EASIER.test(text) || HARDER.test(text))) {
      const step = EASIER.test(text) ? -1 : 1;
      level = 'bac'[Math.max(0, Math.min(2, 'bac'.indexOf(level) + step))];
    }
    const rest = text.replace(GRADE, ' ').replace(LEVEL, ' ').replace(EASIER, ' ').replace(HARDER, ' ');
    const useful = rest.split(/[^\p{L}\p{N}-]+/u).filter(word => word.length > 1 && !FILLER.has(word));
    if (useful.length) subject = useful.join(' ');
  }
  const levelLabel = level === 'c' ? 'מצוינות' : level ? 'רמה ' + (level === 'a' ? 'א' : 'ב') : '';
  return { grade, level, subject, useLevel, message: [subject || 'דפים', grade ? 'כיתה ' + grade : '', useLevel ? levelLabel : ''].filter(Boolean).join(' ') };
}
