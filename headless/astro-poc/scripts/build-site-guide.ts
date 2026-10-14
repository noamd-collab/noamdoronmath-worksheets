/**
 * Build the Noam AI site manual from repo data.
 * Counts, level labels, and page copy are copied from those files.
 * The attached site-map markdown is not an input.
 *
 *   npx tsx scripts/build-site-guide.ts
 *   npx tsx scripts/build-site-guide.ts --check
 */
import { buildSync } from 'esbuild';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worksheetHref } from '../../../noam-ai/site-companion/retrieve.js';
import { buildGradeLoopPool, gradeLoopCopy } from '../src/lib/gradeLoopPools';
import { cssLoopIdea, topicLandingLoop } from '../src/lib/landingLoops';
import { PK } from '../src/lib/linkPeek';
import { PUBLIC_LESSON_DESCRIPTION, PUBLIC_LESSON_PATH, PUBLIC_LESSON_TITLE } from '../src/lib/publicLesson';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..', '..');

type GuideRecord = {
  id: string;
  type: string;
  title: string;
  href: string;
  grade?: number;
  gradeLabel?: string;
  topic?: string;
  levelKey?: string;
  levelLabel?: string;
  pdfId?: string;
  contains?: string;
  audience?: string;
  how?: string;
  terms?: string;
};

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clip(value: unknown, max: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

function mustInclude(source: string, label: string): string {
  if (!source.includes(label)) throw new Error('Missing source text: ' + label);
  return label;
}

function textOf(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  if (!match) throw new Error('Missing HTML match: ' + pattern);
  return match[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function gradeFromText(value: string): number | undefined {
  const match = String(value || '').match(/כיתה\s*([1-9אבגדהוזחט])/);
  if (!match) return undefined;
  const mark = match[1];
  if (/[1-9]/.test(mark)) return Number(mark);
  return { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9 }[mark];
}

function firstBlock(blocks: Array<{ type?: string; text?: string }> | undefined, type: string): string {
  const block = (blocks || []).find((item) => item.type === type && item.text);
  return block && block.text ? block.text : '';
}

function checkYourself(page: any): string {
  const sections = page.sections || [];
  const parts: string[] = [];
  for (const section of sections) {
    if (section.heading) parts.push(section.heading);
  }
  const headings = parts.filter((heading) => heading === 'בדקו את עצמכם' || heading === 'שאלות נפוצות');
  let answerLabel = '';
  for (const section of sections) {
    for (const block of section.blocks || []) {
      if (typeof block.text === 'string' && /^תשובה\s*:/.test(block.text.trim())) answerLabel = 'תשובה';
    }
  }
  return [...headings, answerLabel].filter(Boolean).join(' · ');
}

function levelFaq(page: any): string {
  const items = page.faq || [];
  const row = items.find((item: { question?: string; answer?: string }) => /רמת|רמה/.test(item.question || ''));
  return row && row.answer ? row.answer : '';
}

function demoLine(page: { slug: string; grade: number; catalogCta?: { catalogTopicId?: number } }): string {
  try {
    const loop = topicLandingLoop(page);
    if (loop.kind === 'css') return 'הדגמה: ' + cssLoopIdea(loop.variant);
    if (loop.kind === 'concept') {
      if (loop.variant === 'kite-construct') {
        return 'הדגמה: שטח דלתון — מהדלתון למלבן, ואחר כך בנייה בסרגל ומחוגה';
      }
      const copy = gradeLoopCopy(loop.variant);
      return 'הדגמה: ' + [copy.domain, copy.claim].filter(Boolean).join(' · ');
    }
    const file = join(root, 'public', loop.src.replace(/^\//, ''));
    const html = readFileSync(file, 'utf8');
    const title = textOf(html, /<title>([^<]+)<\/title>/);
    return 'הדגמה: ' + title;
  } catch (error) {
    return '';
  }
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
}

function loadManifests(): Map<string, { questionCount?: number; exerciseCount?: number; pageCount?: number }> {
  const dir = join(root, 'public/noam-ai/manifests');
  const map = new Map<string, { questionCount?: number; exerciseCount?: number; pageCount?: number }>();
  for (const name of jsonFiles(dir)) {
    const manifest = readJson(join(dir, name));
    const hash = String(manifest.pdfHash || name.replace(/\.json$/, '')).toLowerCase();
    map.set(hash, {
      questionCount: manifest.questionCount,
      exerciseCount: manifest.exerciseCount,
      pageCount: manifest.pageCount,
    });
  }
  return map;
}

function countLine(manifest: { questionCount?: number; exerciseCount?: number; pageCount?: number } | undefined): string {
  if (!manifest) return '';
  const parts: string[] = [];
  if (typeof manifest.questionCount === 'number') parts.push(manifest.questionCount + ' שאלות');
  if (typeof manifest.exerciseCount === 'number') parts.push(manifest.exerciseCount + ' תרגילים');
  if (typeof manifest.pageCount === 'number') parts.push(manifest.pageCount + ' עמודים');
  return parts.join(' · ');
}

function push(records: GuideRecord[], record: GuideRecord) {
  const clean: GuideRecord = { id: record.id, type: record.type, title: clip(record.title, 180), href: record.href };
  for (const key of ['grade', 'gradeLabel', 'topic', 'levelKey', 'levelLabel', 'pdfId', 'contains', 'audience', 'how', 'terms'] as const) {
    const value = record[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string') {
      const max = key === 'terms' ? 240 : key === 'title' ? 180 : key === 'how' || key === 'contains' ? 480 : 180;
      const text = clip(value, max);
      if (text) (clean as Record<string, unknown>)[key] = text;
    } else {
      (clean as Record<string, unknown>)[key] = value;
    }
  }
  records.push(clean);
}

function main() {
  const catalog = readJson(join(root, 'src/data/catalog.v1.json'));
  const home = readJson(join(root, 'src/data/home-page.json'));
  const manifests = loadManifests();
  const viewerHtml = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
  const teachersHtml = readFileSync(join(root, 'public/teachers/index.html'), 'utf8');
  const learningHtml = readFileSync(join(root, 'public/learning.html'), 'utf8');
  const lessonHtml = readFileSync(join(root, 'src/public-lesson/lesson.html'), 'utf8');
  const viewerHow = [
    mustInclude(viewerHtml, 'הורדה / הדפסה'),
    mustInclude(viewerHtml, 'כלי PDF'),
    mustInclude(viewerHtml, 'פתח PDF בלשונית'),
  ].join(' · ');
  const teachersHow = [
    textOf(teachersHtml, /class="subtitle">([^<]+)</),
    textOf(teachersHtml, /class="intro-note">([\s\S]*?)<\/p>/),
    textOf(teachersHtml, /class="scenario-title">([^<]+)</) + ' — ' + textOf(teachersHtml, /class="scenario-desc">([^<]+)</),
    mustInclude(teachersHtml, 'הדף המלא, עם סימון'),
    mustInclude(teachersHtml, 'דף מצומצם מהמקור'),
  ].join(' ');
  const records: GuideRecord[] = [];
  let manifestHits = 0;

  for (const grade of catalog.grades || []) {
    const termBucket = (catalog.searchTerms && catalog.searchTerms[String(grade.grade)]) || {};
    const hubPath = join(root, 'src/data/grade-hubs', grade.grade + '.json');
    const hub = readJson(hubPath);
    const pool = buildGradeLoopPool(grade.grade);
    const openHow = clip(hub.intro, 220);
    push(records, {
      id: 'hub-' + grade.grade,
      type: 'hub',
      title: hub.h1 || hub.title,
      href: hub.path || '/grade-' + grade.grade,
      grade: grade.grade,
      gradeLabel: grade.label,
      contains: [hub.description, pool.length ? 'הדגמות: ' + pool.map((loop) => loop.label).join(' · ') : ''].filter(Boolean).join(' '),
      audience: grade.label,
      how: [openHow, pool[0] ? pool[0].claim : '', home.grades.find((item: { grade: number; aiLabel?: string }) => item.grade === grade.grade)?.aiLabel || ''].filter(Boolean).join(' '),
    });
    push(records, {
      id: 'catalog-' + grade.grade,
      type: 'catalog',
      title: 'דפי עבודה · ' + grade.label,
      href: '/worksheets?grade=' + grade.grade,
      grade: grade.grade,
      gradeLabel: grade.label,
      topic: (grade.groups || []).map((group: { label: string }) => group.label).join(' · '),
      contains: (grade.groups || []).map((group: { label: string }) => group.label).join(' · '),
      audience: grade.label,
      how: openHow,
    });

    for (const topic of grade.topics || []) {
      const extra = termBucket[String(topic.id)] || '';
      const groupLabel = ((grade.groups || []).find((group: { key: string }) => group.key === topic.group) || {}).label || '';
      for (const level of topic.levels || []) {
        if (!/^[0-9a-f]{32}$/i.test(String(level.pdfId || ''))) continue;
        const manifest = manifests.get(String(level.pdfId).toLowerCase());
        if (manifest) manifestHits += 1;
        const href = worksheetHref(catalog, grade, topic, level);
        const viewer = href.indexOf('worksheet-viewer-noam.html') !== -1;
        push(records, {
          id: 'g' + grade.grade + '-t' + topic.id + '-' + level.key,
          type: 'worksheet',
          title: topic.title,
          href,
          grade: grade.grade,
          gradeLabel: grade.label,
          topic: groupLabel,
          levelKey: level.key,
          levelLabel: level.label,
          pdfId: level.pdfId,
          contains: [level.label, groupLabel, topic.description, countLine(manifest)].filter(Boolean).join(' · '),
          audience: grade.label,
          how: viewer ? viewerHow : openHow,
          terms: extra,
        });
      }
    }
  }

  const topicDir = join(root, 'src/data/topic-pages');
  for (const name of jsonFiles(topicDir)) {
    const page = readJson(join(topicDir, name));
    const grade = catalog.grades.find((item: { grade: number }) => item.grade === page.grade);
    const cta = page.catalogCta && page.catalogCta.label;
    const studentLine = (page.faq || []).map((item: { answer?: string }) => item.answer || '').find((answer: string) => /תלמיד/.test(answer)) || '';
    push(records, {
      id: 'topic-' + page.slug,
      type: 'topic',
      title: page.h1 || page.title,
      href: page.path,
      grade: page.grade,
      gradeLabel: grade ? grade.label : '',
      topic: page.catalogCta && page.catalogCta.catalogTopicTitle,
      contains: [page.description, checkYourself(page), demoLine(page)].filter(Boolean).join(' · '),
      audience: studentLine || (grade ? grade.label : ''),
      how: [cta, levelFaq(page), PK.topic.desc, page.intro].filter(Boolean).join(' · '),
    });
  }

  const categoryByPath = new Map<string, string[]>();
  const archiveDir = join(root, 'src/data/blog-archives');
  for (const name of jsonFiles(archiveDir)) {
    const archive = readJson(join(archiveDir, name));
    if (archive.kind === 'category') {
      for (const card of archive.cards || []) {
        let path = '';
        try {
          path = new URL(card.href).pathname;
        } catch (error) {
          path = String(card.href || '');
        }
        const key = decodeURIComponent(path);
        const list = categoryByPath.get(key) || [];
        list.push(archive.h1 || archive.title);
        categoryByPath.set(key, list);
      }
      push(records, {
        id: 'page-' + archive.fileSlug,
        type: 'page',
        title: archive.h1 || archive.title,
        href: archive.path,
        contains: archive.description,
        audience: archive.h1 || archive.title,
        how: archive.description,
      });
    }
    if (archive.kind === 'index') {
      push(records, {
        id: 'page-blog',
        type: 'page',
        title: archive.h1 || archive.title,
        href: archive.path,
        contains: archive.description,
        audience: PK.blog.desc,
        how: archive.description,
      });
    }
  }

  const blogDir = join(root, 'src/data/blog-posts');
  for (const name of jsonFiles(blogDir)) {
    const post = readJson(join(blogDir, name));
    const key = decodeURIComponent(post.path || '');
    const grade = gradeFromText(post.title + ' ' + post.h1) || (post.path && /grade-(\d)/.test(post.path) ? Number(post.path.match(/grade-(\d)/)[1]) : undefined);
    const gradeEntry = catalog.grades.find((item: { grade: number }) => item.grade === grade);
    push(records, {
      id: 'blog-' + (post.fileSlug || name.replace(/\.json$/, '')),
      type: 'blog',
      title: post.h1 || post.title,
      href: post.path,
      grade,
      gradeLabel: gradeEntry ? gradeEntry.label : '',
      contains: post.description,
      audience: [...(categoryByPath.get(key) || []), gradeEntry ? gradeEntry.label : ''].filter(Boolean).join(' · '),
      how: firstBlock(post.blocks, 'p') || post.description,
    });
  }

  const pageDir = join(root, 'src/data/site-pages');
  for (const name of jsonFiles(pageDir)) {
    const page = readJson(join(pageDir, name));
    const how = Array.isArray(page.intro) ? page.intro.filter(Boolean).join(' ') : '';
    push(records, {
      id: 'page-' + page.slug,
      type: 'page',
      title: page.h1 || page.title,
      href: '/' + page.slug,
      contains: page.description,
      how,
    });
    if (page.slug === 'accessibilityadaptation') {
      const blocks = page.blocks || [];
      const index = blocks.findIndex((block: { text?: string }) => block.text === 'מדיניות פרטיות');
      const next = index >= 0 ? blocks.slice(index + 1).find((block: { type?: string; text?: string }) => block.type === 'p' && block.text) : null;
      push(records, {
        id: 'page-privacy',
        type: 'page',
        title: 'מדיניות פרטיות',
        href: '/accessibilityadaptation#privacy-policy',
        contains: next ? next.text : page.description,
        how: next ? next.text : '',
      });
    }
  }

  push(records, {
    id: 'page-home',
    type: 'page',
    title: home.hero.titleLine + ' ' + home.hero.titleEm,
    href: '/',
    contains: [home.description, home.footer.brandBlurb].join(' '),
    audience: home.footer.brandBlurb,
    how: [home.hero.searchCta.label, home.hero.lede].join(' · '),
  });
  push(records, {
    id: 'page-worksheets',
    type: 'catalog',
    title: PK.ws.title,
    href: '/worksheets',
    grade: 7,
    gradeLabel: 'כיתה ז׳',
    contains: PK.ws.desc,
    how: PK.ws.desc,
  });
  push(records, {
    id: 'page-ysodi',
    type: 'catalog',
    title: PK['ws-ysodi'].title,
    href: '/worksheets?level=ysodi',
    contains: PK['ws-ysodi'].desc,
    audience: PK['ws-ysodi'].tag,
    how: PK['ws-ysodi'].desc,
  });
  push(records, {
    id: 'page-hatzava',
    type: 'catalog',
    title: PK['ws-hatzava'].title,
    href: '/worksheets?level=hatzava',
    contains: PK['ws-hatzava'].desc,
    audience: PK['ws-hatzava'].tag,
    how: PK['ws-hatzava'].desc,
  });
  push(records, {
    id: 'page-teachers',
    type: 'page',
    title: textOf(teachersHtml, /<h1>([^<]+)<\/h1>/),
    href: '/teachers',
    audience: PK.teachers.tag + ' · ' + mustInclude(teachersHtml, 'כיתות א׳–ט׳'),
    contains: PK.teachers.desc,
    how: teachersHow,
  });
  push(records, {
    id: 'page-learning',
    type: 'page',
    title: textOf(learningHtml, /<h1>([^<]+)<\/h1>/),
    href: '/learning.html',
    contains: learningParagraphs(learningHtml),
    audience: PK.learn.desc,
    how: [PK.learn.desc, textOf(learningHtml, /<summary>([^<]+)<\/summary>/)].join(' '),
  });
  push(records, {
    id: 'page-viewer',
    type: 'page',
    title: textOf(viewerHtml, /<title>([^<|]+)/).trim(),
    href: '/worksheet-viewer-noam.html',
    contains: viewerHow,
    how: viewerHow,
  });
  push(records, {
    id: 'game-kefel',
    type: 'game',
    title: PUBLIC_LESSON_TITLE,
    href: PUBLIC_LESSON_PATH,
    contains: [PUBLIC_LESSON_DESCRIPTION, textOf(lessonHtml, /<title>([^<]+)<\/title>/)].join(' '),
    how: mustInclude(lessonHtml, 'שלב 1 מתוך 7'),
  });
  if (home.whatsapp && home.whatsapp.ctaHref) {
    push(records, {
      id: 'page-whatsapp',
      type: 'page',
      title: home.whatsapp.heading,
      href: home.whatsapp.ctaHref,
      contains: home.whatsapp.body,
      how: home.whatsapp.ctaLabel + ' · ' + home.whatsapp.note,
    });
  }

  const seen = new Set<string>();
  for (const record of records) {
    const key = record.type + ' ' + record.href;
    if (seen.has(key)) throw new Error('Duplicate guide record: ' + key);
    seen.add(key);
  }
  const counts: Record<string, number> = {};
  for (const record of records) counts[record.type] = (counts[record.type] || 0) + 1;
  const guide = {
    schemaVersion: 1,
    builtFrom: [
      'src/data/catalog.v1.json',
      'public/noam-ai/manifests',
      'src/data/topic-pages',
      'src/data/grade-hubs',
      'src/data/blog-posts',
      'src/data/blog-archives',
      'src/data/site-pages',
      'src/data/home-page.json',
      'public/teachers/index.html',
      'public/worksheet-viewer-noam.html',
      'public/learning.html',
    ],
    manifestMatches: manifestHits,
    counts,
    records,
  };
  const body = JSON.stringify(guide);
  const dest = join(root, 'src/data/site-guide.v1.json');
  // The browser needs only public navigation fields, never server configuration.
  const navigationBody = JSON.stringify({ catalog: { grades: readJson(join(root, 'src/data/catalog.v1.json')).grades.map((g: any) => ({ grade: g.grade, label: g.label, groups: g.groups, topics: g.topics.map(({ id, parent, title, description, group }: any) => ({ id, parent, title, description, group })) })) }, records: records.map(({ id, type, title, href, grade, topic, levelLabel, terms }) => ({ id, type, title, href, grade, topic, levelLabel, terms })) });
  const navigationDest = join(root, 'public/noam-navigation-guide.json');
  const navigationScript = buildSync({entryPoints: [join(repo, 'noam-ai/site-companion/navigation.js')], bundle: true, format: 'esm', platform: 'browser', write: false}).outputFiles[0].text;
  const scriptDest = join(root, 'public/noam-navigation.js');
  if (process.argv.includes('--check')) {
    const current = readFileSync(dest, 'utf8');
    if (current !== body || readFileSync(navigationDest, 'utf8') !== navigationBody || readFileSync(scriptDest, 'utf8') !== navigationScript) {
      console.error('FAIL: src/data/site-guide.v1.json differs from a fresh build. Run: npx tsx scripts/build-site-guide.ts');
      process.exit(1);
    }
    console.log('site-guide.v1.json matches a fresh build');
    return;
  }
  writeFileSync(dest, body);
  writeFileSync(navigationDest, navigationBody);
  writeFileSync(scriptDest, navigationScript);
  console.log(JSON.stringify({ counts, records: records.length, manifestMatches: manifestHits, bytes: Buffer.byteLength(body) }));
}

function learningParagraphs(html: string): string {
  const match = html.match(/<h1>[^<]+<\/h1><p>([^<]+)<\/p><p>([^<]+)<\/p>/);
  if (!match) throw new Error('Missing learning paragraphs');
  return match[1] + ' ' + match[2];
}

main();
