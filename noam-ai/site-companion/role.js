/** Shared deterministic role detection. No model configuration. */
export const SOLVE_REQUEST_SOURCE =
  "רמז|לפתור|תפתור|מה התשובה|איך פותרים|הדרך לפתרון|\\bhint\\b|\\bsolve\\b|the answer";
const SOLVE_REQUEST = new RegExp(SOLVE_REQUEST_SOURCE, "i");

const ROLE_GREETING = /^(?:היי|הי|שלום)\s+/;
const ROLE_PHRASES = [
  "במה אתה עוזר לי באתר",
  "במה אתה עוזר",
  "במה את עוזרת לי באתר",
  "במה אתה יכול לעזור",
  "במה אתה יכול לעזור לי",
  "במה אתה יכול לעזור לי באתר",
  "מה אתה עושה",
  "מה אתה עושה באתר",
  "איך אתה עוזר",
  "איך אתה עוזר לי",
  "איך אתה עוזר לי באתר",
  "איך אתה יכול לעזור",
  "איך אתה יכול לעזור לי",
  "איך אתה יכול לעזור לי באתר",
  "מי אתה",
];

export function isRoleQuestion(message) {
  let text = String(message || "")
    .replace(/[?؟!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > 80) return false;
  if (SOLVE_REQUEST.test(text)) return false;
  if (text === "הי" || text === "היי" || text === "שלום") return true;
  text = text.replace(ROLE_GREETING, "");
  if (!text || text.length > 80) return false;
  if (SOLVE_REQUEST.test(text)) return false;
  return ROLE_PHRASES.indexOf(text) !== -1;
}
