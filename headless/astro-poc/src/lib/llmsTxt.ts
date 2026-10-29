/**
 * /llms.txt keeps the live site-llms.md guide, then appends SEO discovery
 * that is not already in that file. No new curriculum text.
 */
import { listBlogArchives } from './blogArchives';
import { listServedBlogPosts } from './blogPosts';
import { loadAllGradeHubs } from './gradeHubs';
import { PUBLIC_LESSON_DESCRIPTION, PUBLIC_LESSON_PATH, PUBLIC_LESSON_TITLE } from './publicLesson';
import {
  PYTHAGORAS_GAME_DESCRIPTION,
  PYTHAGORAS_GAME_H1,
  PYTHAGORAS_GAME_PATH,
} from './pythagorasGame';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';
import { loadAllTopicPages } from './topicPages';

function oneLine(value: string, max = 180): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

function link(label: string, path: string): string {
  return `[${oneLine(label, 80)}](${SITE_CANONICAL_ORIGIN}${path})`;
}

function hasUrl(text: string, path: string): boolean {
  return text.includes(`${SITE_CANONICAL_ORIGIN}${path}`);
}

function appendUnique(
  extra: string[],
  combined: string,
  label: string,
  path: string,
  note?: string,
): void {
  if (hasUrl(combined, path) || extra.join('\n').includes(`${SITE_CANONICAL_ORIGIN}${path}`)) return;
  extra.push(note ? `- ${link(label, path)}: ${oneLine(note)}` : `- ${link(label, path)}`);
}

/** Live guide first; SEO extras only for URLs the guide does not already list. */
export function renderLlmsTxt(liveGuide: string): string {
  const live = String(liveGuide || '').replace(/\s+$/, '');
  const extra: string[] = [];

  extra.push('', '## משחקים ותוספים');
  const gamesStart = extra.length;
  appendUnique(extra, live, PYTHAGORAS_GAME_H1, PYTHAGORAS_GAME_PATH, PYTHAGORAS_GAME_DESCRIPTION);
  appendUnique(extra, live, PUBLIC_LESSON_TITLE, PUBLIC_LESSON_PATH, PUBLIC_LESSON_DESCRIPTION);
  if (extra.length === gamesStart) extra.splice(gamesStart - 1, 1);

  extra.push('', '## כיתות');
  const hubsStart = extra.length;
  for (const hub of loadAllGradeHubs()) {
    appendUnique(extra, live, hub.h1, hub.path, hub.description);
  }
  if (extra.length === hubsStart) extra.splice(hubsStart - 1, 1);

  extra.push('', '## נושאים');
  const topicsStart = extra.length;
  const topics = loadAllTopicPages().slice().sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.path.localeCompare(b.path);
  });
  for (const page of topics) {
    appendUnique(extra, live, page.h1, page.path, page.description);
  }
  if (extra.length === topicsStart) extra.splice(topicsStart - 1, 1);

  extra.push('', '## בלוג');
  const blogStart = extra.length;
  for (const archive of listBlogArchives()) {
    appendUnique(extra, live, archive.title, archive.path);
  }
  const posts = listServedBlogPosts().slice().sort((a, b) => a.path.localeCompare(b.path));
  for (const post of posts) {
    appendUnique(extra, live, post.h1, post.path);
  }
  if (extra.length === blogStart) extra.splice(blogStart - 1, 1);

  extra.push('');
  return `${live}\n${extra.join('\n')}`;
}
