/** Public landing copy shared by the page, site search and site guide. */
export const TEACHER_LANDING_PATH = '/teachers';
export const TEACHER_TOOL_PATH = '/teachers/app';
export const TEACHER_LANDING_TITLE = 'אזור המורים: דפי עבודה וכלי הוראה | נועם דורון מתמטיקה';
export const TEACHER_LANDING_H1 = 'כל השאלות לדף העבודה הבא שלך.';
export const TEACHER_LANDING_DESCRIPTION =
  'כלי בחירת שאלות, הדפסה וייצוא ל־Word לאחר התחברות עם Google. בקרוב: יצירת דפי עבודה חדשים עם AI לפי הכיתה והשלב בלימוד.';

/** Teachers FAQ: shown on /teachers and copied once into its FAQPage JSON-LD.
 * Claims stay within what the tool does today (Noam, 19.11.2026). */
export const TEACHER_FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'מה צריך כדי להתחיל להשתמש בכלי המורים?',
    answer: 'רק חשבון Google. אחרי ההתחברות אפשר לבחור שאלות מהמאגר לפי כיתה, נושא ורמה, להרכיב דף אחד, להדפיס אותו או לייצא אותו ל־Word.',
  },
  {
    question: 'האם הדפים תואמים לתוכנית הלימודים?',
    answer: 'כן. הנושאים מסודרים לפי תוכנית הלימודים במתמטיקה של משרד החינוך, מכיתה א׳ ועד כיתה ט׳. הדפים לא קיבלו אישור רשמי של משרד החינוך.',
  },
  {
    question: 'איך מכינים דפי עבודה דיפרנציאליים לתלמידים ברמות שונות?',
    answer: 'רוב הנושאים באתר מופיעים בשלוש רמות: רמה א׳, רמה ב׳ ומצוינות. אפשר לבחור שאלות מרמות שונות ולהכין דף נפרד לכל קבוצה בכיתה.',
  },
  {
    question: 'אפשר לצרף תשובות לדף שמרכיבים?',
    answer: 'כן. בזמן הרכבת הדף אפשר לבחור אם לצרף אליו את התשובות.',
  },
];

/** Preserve existing bookmarks and AI handoffs, including partial scopes.
 * The existing wizard remains responsible for validating parameter values.
 * Marketing-only query parameters must continue to open the public landing.
 */
const TOOL_PARAMETERS = ['grade', 'topic', 'level', 'edition', 'minutes', 'pick'];

export function legacyTeacherToolRedirect(url: URL): string | null {
  return TOOL_PARAMETERS.some((key) => url.searchParams.has(key))
    ? `${TEACHER_TOOL_PATH}${url.search}${url.hash}`
    : null;
}
