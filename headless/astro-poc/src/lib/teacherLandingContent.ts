/** Public landing copy shared by the page, site search and site guide. */
export const TEACHER_LANDING_PATH = '/teachers';
export const TEACHER_TOOL_PATH = '/teachers/app';
export const TEACHER_LANDING_TITLE = 'אזור המורים: דפי עבודה וכלי הוראה | נועם דורון מתמטיקה';
export const TEACHER_LANDING_H1 = 'כל השאלות לדף העבודה הבא שלך.';
export const TEACHER_LANDING_DESCRIPTION =
  'כלי בחירת שאלות, הדפסה וייצוא ל־Word לאחר התחברות עם Google. בקרוב: יצירת דפי עבודה חדשים עם AI לפי הכיתה והשלב בלימוד.';

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
