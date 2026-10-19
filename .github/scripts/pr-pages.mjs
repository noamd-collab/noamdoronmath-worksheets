/** Map a pull-request diff to Astro routes worth screenshotting. */

export const PAGE_PREFIX = 'headless/astro-poc/src/pages/';
export const FALLBACK_PAGES = ['/', '/grade-5', '/grade-9', '/factoring-grade-9', '/worksheets?grade=9', '/blog'];
export const MAX_SCREENSHOT_PAGES = 6;
export const GRADE_HUB_NAV_FILES = [
  'headless/astro-poc/src/components/GradeHubPage.astro',
  'headless/astro-poc/src/lib/elementaryTopicNav.ts',
  'headless/astro-poc/src/styles/exact-grade.css',
];
export const ELEMENTARY_GRADE_HUB_PAGES = [
  '/grade-1',
  '/grade-2',
  '/grade-3',
  '/grade-4',
  '/grade-5',
  '/grade-6',
];
export const TEACHER_FILES = [
  'headless/astro-poc/src/pages/teachers.ts',
  'headless/astro-poc/public/teachers/index.html',
  'headless/astro-poc/public/teachers/teacher-factoring-print.js',
  'headless/astro-poc/public/teachers/teacher-marked-print.js',
  'demos/teacher-factoring-print.js',
  'demos/teacher-marked-print.js',
  'headless/astro-poc/scripts/render-teacher-pack.py',
  'headless/astro-poc/tests/teacher-print-pack.test.ts',
  'headless/astro-poc/tests/teacher-marked-print.test.ts',
];

export function isTeacherFile(file) {
  const norm = String(file).replaceAll('\\', '/');
  return TEACHER_FILES.includes(norm) || norm.startsWith('headless/astro-poc/public/teachers/');
}

export const TOPIC_ANIMATION_FILES = [
  'headless/astro-poc/src/lib/landingLoops.ts',
  'headless/astro-poc/src/lib/lessonLoops.ts',
  'headless/astro-poc/src/components/LessonLoop.astro',
  'headless/astro-poc/src/components/SimilarityLoop.astro',
  'headless/astro-poc/src/components/TopicText.astro',
  'headless/astro-poc/src/lib/lessonMath.ts',
  'headless/astro-poc/src/components/LandingLoop.astro',
  'headless/astro-poc/src/styles/exact-topic.css',
];
export const TOPIC_ANIMATION_PAGES = [
  '/similar-triangles-grade-8', '/algebraic-fractions-grade-9',
  '/fractions-numberline-compare-grade-4', '/read-tables-grade-5',
  '/reflection-symmetry-grade-2', '/classify-triangles-grade-3',
];

const PAGE_FILE = /\.(astro|ts|tsx|js|mjs)$/;

export function routeFromPageFile(file) {
  const norm = String(file).replaceAll('\\', '/');
  if (!norm.startsWith(PAGE_PREFIX)) return null;
  const rel = norm.slice(PAGE_PREFIX.length);
  const parts = rel.split('/');
  if (parts.some((part) => part.startsWith('_') || part.includes('['))) return null;
  if (parts[0] === 'api') return null;
  if (!PAGE_FILE.test(rel)) return null;

  let route = rel.replace(PAGE_FILE, '');
  // Feed contents are tested as data, not mistaken for real learner screenshots.
  if (/\.(xml|txt|json)$/.test(route)) return null;
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
  else if (route === 'index') route = '';
  if (route === 'worksheets') return '/worksheets?grade=9';
  return route === '' ? '/' : `/${route}`;
}

/**
 * Pages whose source files changed. Shared components and styles do not name a
 * single route, so those diffs use the fallback set.
 */
export function pagesTouchedByDiff(files) {
  const normalized = files.map((file) => String(file).replaceAll('\\', '/'));
  if (normalized.includes('headless/astro-poc/src/data/worksheet-second-ten.v1.json') ||
      normalized.includes('headless/astro-poc/src/data/worksheet-next-ten.v1.json') ||
      normalized.includes('headless/astro-poc/src/pages/worksheet-pilot/[slug].astro')) {
    return { pages: ['/worksheet-pilot/second-ten-20261019', '/worksheet-pilot/next-ten-20261019', '/worksheet-pilot/approved-three-20261019'], fallback: false, omitted: [] };
  }
  if (normalized.some((file) => TOPIC_ANIMATION_FILES.includes(file))) {
    return { pages: [...TOPIC_ANIMATION_PAGES], fallback: false, omitted: [] };
  }
  if (normalized.some((file) => GRADE_HUB_NAV_FILES.includes(file))) {
    return { pages: [...ELEMENTARY_GRADE_HUB_PAGES], fallback: false, omitted: [] };
  }
  if (normalized.includes('headless/astro-poc/src/components/SimilarityLoop.astro')) {
    return { pages: ['/similar-triangles-grade-8', '/similar-triangles-grade-9',
      '/triangle-similarity-aa-grade-9', '/triangle-similarity-proof-grade-8',
      '/similar-triangles-area-ratio-grade-8', '/scaling-dimensions-grade-6'], fallback: false, omitted: [] };
  }
  const seen = new Set();
  const routes = [];
  for (const file of files) {
    const route = isTeacherFile(file) ? '/teachers' : routeFromPageFile(file);
    if (!route || seen.has(route)) continue;
    seen.add(route);
    routes.push(route);
  }
  if (routes.length === 0) {
    return { pages: [...FALLBACK_PAGES], fallback: true, omitted: [] };
  }
  return {
    pages: routes.slice(0, MAX_SCREENSHOT_PAGES),
    fallback: false,
    omitted: routes.slice(MAX_SCREENSHOT_PAGES),
  };
}

