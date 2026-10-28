// Inventory of every blog post that feeds the site, with what is known about each one.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, VIDEO_ROOT, canonicalUrl, explicitAudience, explicitGrade, sourceBlocks, sourceHash } from './source.mjs';

const ARCHIVES = ['blog-index', 'category-elementary-math', 'category-middle-school-math', 'category-teachers-and-parents'];
const FORMULA = /\d\s*[+×−\-:=÷]\s*\d|[²³⁴⁵⁶⁷⁸⁹⁰¹]|√/;

export function loadBriefs() {
  const p = join(VIDEO_ROOT, 'briefs.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { posts: {} };
}

export function buildInventory(posts, videos) {
  const archiveDir = join(REPO_ROOT, 'headless/astro-poc/src/data/blog-archives');
  const archived = new Set();
  let capturedAt = null;
  for (const a of ARCHIVES) {
    const j = JSON.parse(readFileSync(join(archiveDir, `${a}.json`), 'utf8'));
    capturedAt ??= j.source?.capturedAt ?? null;
    for (const c of j.cards || []) archived.add(decodeURIComponent(c.href));
  }
  const audio = JSON.parse(readFileSync(join(VIDEO_ROOT, 'data/audio-on-main.json'), 'utf8'));
  const audioSet = new Set(audio.slugs);
  const briefs = loadBriefs().posts;
  const byPost = new Map();
  for (const v of videos) byPost.set(v.postId, [...(byPost.get(v.postId) || []), v.variant]);

  const rows = [...posts.values()].map(({ file, post }) => {
    const blocks = sourceBlocks(post);
    const body = blocks.filter((b) => b.id !== 'title');
    const chars = body.reduce((n, b) => n + b.text.length, 0);
    const worksheetLink = (post.blocks || []).some((b) => b.type === 'a' && /noamd-collab\.github\.io|\/worksheets/.test(b.href || ''));
    const brief = briefs[post.fileSlug];
    const url = canonicalUrl(post);
    return {
      postId: post.fileSlug,
      decodedSlug: post.decodedSlug,
      canonicalUrl: url,
      sourcePath: file,
      title: post.title,
      grade: explicitGrade(post),
      audienceExplicit: explicitAudience(post),
      categories: [...new Set((post.categories || []).map((c) => c.text))],
      contentKind: worksheetLink && chars < 2500 ? 'worksheet-landing' : 'article',
      chars,
      formulaLines: body.filter((b) => FORMULA.test(b.text)).length,
      faqItems: post.faq?.items?.length ?? 0,
      sourceHash: sourceHash(post),
      inArchiveSnapshot: archived.has(url),
      audioOnMain: audioSet.has(post.decodedSlug),
      readStatus: body.length === 0 ? 'missing-source' : brief ? brief.readStatus : 'not-read',
      videoStatus: byPost.has(post.fileSlug) ? `pilot-package (${byPost.get(post.fileSlug).join(', ')})` : brief ? 'brief-only' : 'not-started',
      mainIdea: brief?.mainIdea ?? null,
      brief: brief ?? null,
    };
  });
  return {
    generatedBy: 'blog-video/bin/build.mjs',
    sources: {
      posts: 'headless/astro-poc/src/data/blog-posts/*.json (the data the Astro site renders)',
      publicListSnapshot: `headless/astro-poc/src/data/blog-archives/*.json, captured ${capturedAt} from the live /blog pages (first page of each listing only)`,
      audio: `blog-video/data/audio-on-main.json (${audio.capturedFromRef} @ ${audio.capturedFromSha.slice(0, 7)})`,
      liveBlogCheck: 'Not possible from this environment: outbound access to www.noamdoronmath.co.il is blocked.',
    },
    totals: {
      posts: rows.length,
      missingSource: rows.filter((r) => r.readStatus === 'missing-source').length,
      read: rows.filter((r) => r.readStatus === 'read-full').length,
      articles: rows.filter((r) => r.contentKind === 'article').length,
      worksheetLanding: rows.filter((r) => r.contentKind === 'worksheet-landing').length,
      inArchiveSnapshot: rows.filter((r) => r.inArchiveSnapshot).length,
      audioOnMain: rows.filter((r) => r.audioOnMain).length,
      pilotPackages: rows.filter((r) => r.videoStatus.startsWith('pilot')).length,
    },
    posts: rows,
  };
}
