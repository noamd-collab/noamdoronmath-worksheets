/** Public landing copy shared by the page, site search and site guide. */
export const TEACHER_LANDING_PATH = '/teachers';
export const TEACHER_TOOL_PATH = '/teachers/app';
export const TEACHER_LANDING_TITLE = 'בקרוב: אזור המורים | נועם דורון מתמטיקה';
export const TEACHER_LANDING_H1 = 'פחות זמן להכנה. יותר זמן להוראה.';
export const TEACHER_LANDING_DESCRIPTION =
  'אזור המורים בפיתוח ובבדיקות פרטיות: שירות AI עתידי בתשלום, שנועד להתאים דפי עבודה לכיתה, לשלב בתוכנית הלימודים ולשיעור האחרון.';

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
