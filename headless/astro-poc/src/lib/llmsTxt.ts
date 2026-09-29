/**
 * /llms.txt and /llms-full.txt (llmstxt.org format), generated from the same
 * bundled JSON the pages render — the lists can't drift from the site.
 */
import { listBlogArchives } from './blogArchives';
import { listServedBlogPosts } from './blogPosts';
import { gradeHubLabel, isGradeHubGrade, loadAllGradeHubs } from './gradeHubs';
import { SITE_PAGE_M24_SLUGS, loadSitePage } from './sitePages';
import { SITE_CANONICAL_ORIGIN, SITE_NAME_HE } from './siteSeo';
import { loadAllTopicPages } from './topicPages';
import { topicH1 } from './topicSeoOverrides';

const clean = (text: string | undefined | null) => (text || '').replace(/\s+/g, ' ').trim();

function absUrl(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    /* keep raw */
  }
  return `${SITE_CANONICAL_ORIGIN}${encodeURI(decoded)}`;
}

const link = (label: string, path: string, note?: string) =>
  `- [${clean(label)}](${absUrl(path)})${note ? `: ${clean(note)}` : ''}`;

function header(): string[] {
  return [
    `# ${SITE_NAME_HE}`,
    '',
    '> דפי עבודה במתמטיקה בעברית לכיתות א׳–ט׳, לפי תוכנית הלימודים, בשלוש רמות (א׳, ב׳, מצוינות). הסבר קצר, דוגמה פתורה ותרגול להדפסה — בחינם וללא הרשמה.',
    '',
    `המחבר: נועם דורון, מורה למתמטיקה עם ותק של 10 שנים בהוראה. [מי אני](${absUrl('/aboutus')})`,
    '',
    'שפת התוכן: עברית (RTL). כל הדפים פתוחים לקריאה ולציטוט עם קישור למקור.',
    '',
  ];
}

function topicsByGrade() {
  const byGrade = new Map<number, ReturnType<typeof loadAllTopicPages>>();
  for (const page of loadAllTopicPages()) {
    const list = byGrade.get(page.grade) || [];
    list.push(page);
    byGrade.set(page.grade, list);
  }
  return [...byGrade.entries()].sort(([a], [b]) => a - b);
}

const gradeName = (grade: number) => `כיתה ${isGradeHubGrade(grade) ? gradeHubLabel(grade) : grade}`;

function sitePagesSection(): string[] {
  return [
    '## מידע על האתר',
    ...SITE_PAGE_M24_SLUGS.map((slug) => {
      const page = loadSitePage(slug);
      return link(page.h1, `/${slug}`, page.description);
    }),
    link('מאגר דפי העבודה', '/worksheets', 'חיפוש וסינון של כל דפי העבודה לפי כיתה ונושא'),
    '',
  ];
}

export function renderLlmsTxt(): string {
  const lines = [...header(), '## דפי כיתה'];
  for (const hub of loadAllGradeHubs()) lines.push(link(hub.h1, hub.path, hub.description));
  lines.push('', '## דפי נושא');
  for (const [grade, pages] of topicsByGrade()) {
    lines.push('', `### ${gradeName(grade)}`);
    for (const page of pages) lines.push(link(topicH1(page), page.path, page.description));
  }
  lines.push('', ...sitePagesSection(), '## אופציונלי', link('בלוג מתמטיקה', '/blog', 'טיפים והסברים להורים, מורים ותלמידים'));
  lines.push(link('גרסה מורחבת של קובץ זה', '/llms-full.txt'), '');
  return lines.join('\n');
}

export function renderLlmsFullTxt(): string {
  const lines = [...header()];
  lines.push(
    '## על האתר',
    'האתר מרכז דפי עבודה במתמטיקה לכל כיתות היסודי וחטיבת הביניים. לכל נושא יש דף הסבר עם דוגמה פתורה, טעויות נפוצות, שאלת בדיקה ושאלות נפוצות, וקישורים לדפי עבודה בשלוש רמות קושי. לכיתות ז׳–ט׳ יש גם עוזר בינה מלאכותית (נועם AI) שמסביר צעד אחר צעד.',
    '',
    '## דפי כיתה'
  );
  for (const hub of loadAllGradeHubs()) {
    lines.push('', `### ${clean(hub.h1)}`, absUrl(hub.path), '', clean(hub.intro || hub.description));
  }
  lines.push('', '## דפי נושא');
  for (const [grade, pages] of topicsByGrade()) {
    lines.push('', `### ${gradeName(grade)}`);
    for (const page of pages) {
      lines.push('', `#### ${clean(topicH1(page))}`, absUrl(page.path), '', clean(page.intro || page.description));
    }
  }
  lines.push('', ...sitePagesSection(), '## בלוג');
  for (const archive of listBlogArchives()) lines.push(link(archive.h1, archive.path, archive.description));
  for (const post of listServedBlogPosts()) lines.push(link(post.h1 || post.title, post.path, post.description));
  lines.push('');
  return lines.join('\n');
}
