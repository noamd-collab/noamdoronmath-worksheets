/**
 * /llms.txt for the cut-over. Copy comes from page data already on the site.
 * No new curriculum text.
 *
 * The header, grade and blog sections are shared with /llms-full.txt
 * (llmsFullTxt.ts), which lists the same topic landings in catalog order.
 */
import { listBlogArchives } from './blogArchives';
import { listServedBlogPosts } from './blogPosts';
import { loadAllGradeHubs } from './gradeHubs';
import { SITE_CANONICAL_ORIGIN, SITE_NAME } from './siteSeo';
import { loadAllTopicPages } from './topicPages';

export const LLMS_FULL_PATH = '/llms-full.txt';

export function oneLine(value: string, max = 180): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function link(label: string, path: string): string {
  return `[${oneLine(label, 80)}](${SITE_CANONICAL_ORIGIN}${path})`;
}

/** Title, summary, site structure and grade hubs. */
export function llmsHeaderLines(extraStructure: string[] = []): string[] {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    '> אתר מתמטיקה בעברית לכיתות א׳–ט׳: דפי כיתה, דפי נושא, דפי עבודה ובלוג. הטקסט כאן לקוח מכותרות ותיאורים שכבר קיימים בדפים.',
    '',
    '## מבנה',
    `- ${link('דף הבית', '/')}`,
    `- ${link('דפי עבודה', '/worksheets')}`,
    `- ${link('בלוג', '/blog')}`,
    `- ${link('אודות', '/aboutus')}`,
    ...extraStructure,
    '',
    '## כיתות',
  ];

  for (const hub of loadAllGradeHubs()) {
    lines.push(`- ${link(hub.h1, hub.path)}: ${oneLine(hub.description)}`);
  }
  return lines;
}

/** Blog archives and served posts. */
export function llmsBlogLines(): string[] {
  const lines: string[] = ['## בלוג'];
  for (const archive of listBlogArchives()) {
    lines.push(`- ${link(archive.title, archive.path)}`);
  }
  const posts = listServedBlogPosts().slice().sort((a, b) => a.path.localeCompare(b.path));
  for (const post of posts) {
    lines.push(`- ${link(post.h1, post.path)}`);
  }
  return lines;
}

export function renderLlmsTxt(): string {
  const lines: string[] = llmsHeaderLines([
    `- ${link('מפת כל דפי הנושא לפי כיתה, מסלול וסדר הקטלוג', LLMS_FULL_PATH)}`,
  ]);

  lines.push('', '## נושאים');
  const topics = loadAllTopicPages().slice().sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.path.localeCompare(b.path);
  });
  for (const page of topics) {
    lines.push(`- ${link(page.h1, page.path)}: ${oneLine(page.description)}`);
  }

  lines.push('', ...llmsBlogLines());
  lines.push('');
  return lines.join('\n');
}
