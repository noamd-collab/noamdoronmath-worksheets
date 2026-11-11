/** Public landing copy shared by the page, site search and site guide. */
export const TEACHER_LANDING_PATH = '/teachers';
export const TEACHER_TOOL_PATH = '/teachers/app';
export const TEACHER_LANDING_TITLE = 'דפי עבודה מותאמים למורים | נועם דורון מתמטיקה';
export const TEACHER_LANDING_H1 = 'בוחרים שאלות. מכינים דף לשיעור.';
export const TEACHER_LANDING_DESCRIPTION =
  'בוחרים כיתה, נושא ורמה, מסמנים שאלות מדפי המקור של נועם דורון ומכינים תרגול להדפסה לכיתות א׳–ט׳. תצוגה מקדימה ובחירה ידנית.';

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
