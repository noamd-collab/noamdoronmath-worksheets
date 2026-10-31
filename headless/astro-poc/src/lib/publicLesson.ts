/**
 * Permanent public lesson.
 *
 * Path: /games/kefel-mekutsar-2
 * `/games/` keeps interactive extras next to, but not inside, the calculator
 * page at /math-tools. `kefel-mekutsar` is the topic name from the handoff,
 * and `-2` is the second short-multiplication formula (שנייה) without a token.
 */
import { canonicalUrl, robotsContent, SITE_CANONICAL_ORIGIN } from './siteSeo';

export const PUBLIC_LESSON_PATH = '/games/kefel-mekutsar-2';

export const PUBLIC_LESSON_TITLE = 'משחק נוסחה כפל מקוצר שנייה | נועם דורון';

export const PUBLIC_LESSON_DESCRIPTION =
  'שיעור קצר עם אליהו: מגלים למה (a + b)² = a² + 2ab + b².';

const LESSON_TITLE = 'למה (a + b)² ≠ a² + b²?';

export function publicLessonImageUrl(): string {
  return `${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}/preview.png`;
}

/** Indexable on the production host, noindex on preview, same rule as other public pages. */
export function renderPublicLesson(lessonHtml: string, hostname: string): string {
  const robots = robotsContent(hostname);
  const canonical = canonicalUrl(PUBLIC_LESSON_PATH);
  const image = publicLessonImageUrl();
  const withAccessibility = lessonHtml.includes('noam-accessibility.js')
    ? lessonHtml
    : lessonHtml.replace('</body>', '<script src="/noam-accessibility.js" defer></script>\n</body>');
  const withCompanion = withAccessibility.includes('noam-site-companion.js')
    ? withAccessibility
    : withAccessibility.replace('</body>', '<script src="/noam-site-companion.js" defer></script>\n</body>');
  return withCompanion
    .replaceAll('content="noindex, nofollow"', `content="${robots}"`)
    .replace(
      `<title>${LESSON_TITLE}</title>`,
      `<title>${PUBLIC_LESSON_TITLE}</title>\n<meta name="description" content="${PUBLIC_LESSON_DESCRIPTION}">\n<link rel="canonical" href="${canonical}">`
    )
    .replace(`property="og:title" content="${LESSON_TITLE}"`, `property="og:title" content="${PUBLIC_LESSON_TITLE}"`)
    // Server HTML gets the first step's heading; the lesson script rewrites it per step.
    .replace('<h1 id="title"></h1>', `<h1 id="title">${LESSON_TITLE}</h1>`)
    .replaceAll('__OG_URL__', canonical)
    .replaceAll('__OG_IMAGE__', image);
}
