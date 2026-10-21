/**
 * Hebrew title/description proposals for review (used by scripts/build-seo-proposals.mjs).
 * approved is always false here. Nothing is applied until a person sets approved: true.
 *
 * Rules (from the PR 46 content review):
 * - Never clip a title. Brand is added only when it fits in 60; otherwise the full headline,
 *   otherwise a reviewed point fix in seo-overrides.mjs (the build fails without one).
 * - Descriptions are cut only at sentence ends, never mid-word or mid-sentence.
 * - Topic pages keep their live title/description when it is valid; page h1/intro only replaces
 *   copy that is too long, keyword-stuffed or has a grade letter without geresh.
 * - Catalog topic names are normalised (units, maqaf) and never get the grade twice.
 * - Titles must be unique after normalisation; a catalog topic that duplicates a blog post
 *   names the page's purpose (choosing a level) instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATALOG_TOPIC_NAMES,
  TWIN_NAMES,
  EXACT,
  KEEP_CURRENT,
  NEEDS_DECISION,
} from './seo-overrides.mjs';

export const TITLE_MAX = 60;
export const DESC_MAX = 155;
export const BRAND = ' | נועם דורון';
const HE = 'א-ת';

export const len = (value) => [...value].length;

export function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/** Safe spelling rules for catalog topic names (whole words only). */
export function normalizeHebrew(value) {
  let text = clean(value);
  // Whole word, optional "ו" prefix, and not already followed by gershayim.
  const unit = (w) => new RegExp(`(?<![${HE}])(ו?)${w}(?![${HE}״])`, 'gu');
  text = text.replace(unit('סמק'), '$1סמ״ק').replace(unit('סמ'), '$1ס״מ').replace(unit('מק'), '$1מ״ק');
  const compounds = [
    ['דו', 'ספרתי'], ['רב', 'ספרתי'], ['רב', 'שלבי'], ['רב', 'שלביות'], ['חד', 'זווית'],
    ['ישר', 'זווית'], ['קהה', 'זווית'], ['אי', 'זוגי'], ['דו', 'ממד'], ['תלת', 'ממד'],
  ];
  for (const [a, b] of compounds) {
    // Optional one-letter prefix (ו, ב, ה, ל, מ, ש, כ): "וישר זווית" → "וישר־זווית".
    text = text.replace(new RegExp(`(?<![${HE}])([ובהלמשכ]?)${a} ${b}(?![${HE}])`, 'gu'), `$1${a}־${b}`);
  }
  text = text.replace(/(\d) ו (\d)/gu, '$1 ו־$2');
  text = text.replace(new RegExp(`(?<![${HE}])מ (\\d)`, 'gu'), 'מ־$1');
  return text;
}

/** Punctuation for blog copy: spaced hyphen as dash, maqaf before digits, no trailing period. */
export function normalizePostCopy(value) {
  return clean(value)
    .replace(/ - /g, ' – ')
    .replace(new RegExp(`([${HE}])-(\\d)`, 'gu'), '$1־$2');
}

/** "<topic> ל<grade>" without repeating a grade the catalog title already carries. */
export function withGrade(topicTitle, gradeLabel) {
  const base = clean(topicTitle).replace(new RegExp(`\\s*(?:[—–-]\\s*)?לכיתה\\s+[${HE}]׳?$`, 'u'), '');
  return `${base} ל${gradeLabel}`;
}

/** Adds the brand when it fits. Never clips: returns null when the headline itself is too long. */
export function withBrand(headline) {
  const text = clean(headline).replace(/\.$/, '');
  if (len(text + BRAND) <= TITLE_MAX) return text + BRAND;
  if (len(text) <= TITLE_MAX) return text;
  return null;
}

/** Whole sentences only. Returns null when not even the first sentence fits. */
export function clipSentences(value, max = DESC_MAX) {
  const text = clean(value);
  if (len(text) <= max) return text;
  const sentences = text.split(/(?<=[.!?])\s+/u);
  let out = '';
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (len(next) > max) break;
    out = next;
  }
  // A trailing question ("זקוקים לרמז?") without its answer is not a finished thought.
  out = out.replace(/\s*זקוקים לרמז\?$/u, '');
  return out || null;
}

const STUFFED = /נועם דורון\s*-\s*מתמטיקה|דפי מתמטיקה בחינם/u;
const GRADE_NO_GERESH = new RegExp(`לכיתה [${HE}](?!׳)(?![${HE}])`, 'u');

export function isValidLiveTitle(value) {
  const text = clean(value);
  return text.length > 0 && len(text) <= TITLE_MAX && !STUFFED.test(text) && !GRADE_NO_GERESH.test(text);
}

export function isValidLiveDescription(value) {
  const text = clean(value);
  return text.length > 0 && len(text) <= DESC_MAX && !GRADE_NO_GERESH.test(text);
}

/** Key used to detect identical or near-identical titles. */
export function titleKey(value) {
  return clean(value)
    .replace(BRAND, '')
    .replace(/\s*[—–|]\s*דפי עבודה( חינם)?(\s*[–-]\s*נועם דורון)?$/u, '')
    .replace(/[׳״\-־—–,:|.?!()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readJsonDir(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
}

/** Overrides are keyed by the decoded path (Hebrew blog slugs stay readable). */
const decoded = (path) => decodeURIComponent(path);

function pick(path, field, ruleValue) {
  const exact = EXACT[decoded(path)];
  if (exact && exact[field] != null) return { value: exact[field], from: 'review-fix' };
  return ruleValue;
}

export function buildProposals(root) {
  const catalog = JSON.parse(readFileSync(join(root, 'src/data/catalog.v1.json'), 'utf8'));
  const topicPages = readJsonDir(join(root, 'src/data/topic-pages'));
  const posts = readdirSync(join(root, 'src/data/blog-posts'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(root, 'src/data/blog-posts', name), 'utf8')));
  const pages = new Map();
  for (const page of topicPages) {
    const id = page.catalogCta?.catalogTopicId;
    if (id != null) pages.set(`${page.grade}:${id}`, page);
  }
  const gradeLabels = new Map(catalog.grades.map((grade) => [grade.grade, grade.label]));
  const postKeys = new Set(posts.map((post) => titleKey(post.h1 || post.title)));

  const errors = [];
  const proposals = [];
  const seenPaths = new Set();

  function finish(row, title, description) {
    if (!title.value) errors.push(`${row.path}: no title fits ${TITLE_MAX} without clipping – add a point fix`);
    if (!description.value) errors.push(`${row.path}: no whole-sentence description fits ${DESC_MAX} – add a point fix`);
    const item = {
      ...row,
      title: title.value || '',
      description: description.value || '',
      approved: false,
      source: `title:${title.from}|description:${description.from}`,
    };
    if (NEEDS_DECISION[decoded(row.path)]) item.needsDecision = NEEDS_DECISION[decoded(row.path)];
    proposals.push(item);
  }

  function topicPageRow(page, gradeNumber, catalogTopicId) {
    const base = {
      path: page.path,
      kind: 'topic-page',
      grade: gradeNumber,
      catalogTopicId,
      currentTitle: page.title || '',
      currentDescription: page.description || '',
    };
    const title = pick(page.path, 'title',
      isValidLiveTitle(page.title)
        ? { value: clean(page.title), from: 'current' }
        : { value: withBrand(page.h1), from: 'page-h1' });
    const description = pick(page.path, 'description',
      isValidLiveDescription(page.description)
        ? { value: clean(page.description), from: 'current' }
        : { value: clipSentences(page.intro || page.description), from: 'page-intro' });
    finish(base, title, description);
  }

  for (const grade of catalog.grades) {
    for (const topic of grade.topics) {
      const page = pages.get(`${grade.grade}:${topic.id}`);
      const path = page?.path || `/worksheets?grade=${grade.grade}&topic=${topic.id}`;
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      if (page) {
        topicPageRow(page, grade.grade, topic.id);
        continue;
      }
      const key = `${grade.grade}:${topic.id}`;
      const rawName = normalizeHebrew(topic.title);
      const isTwin = postKeys.has(titleKey(withGrade(rawName, grade.label)));
      let name = CATALOG_TOPIC_NAMES[key] || rawName;
      let headline = withGrade(name, grade.label);
      let body = `דפי עבודה במתמטיקה בנושא ${headline}. בחינם וללא הרשמה.`;
      if (isTwin) {
        name = TWIN_NAMES[key] || name;
        const threeLevels = (topic.levels || []).length === 3;
        headline = `${withGrade(name, grade.label)} – ${threeLevels ? 'בחירת רמה' : 'דף העמקה ורשות'}`;
        body = threeLevels
          ? `דפי עבודה במתמטיקה בנושא ${withGrade(name, grade.label)}, ברמה א׳, רמה ב׳ ומצוינות. בחינם וללא הרשמה.`
          : `דף העמקה ורשות במתמטיקה בנושא ${withGrade(name, grade.label)} – דף אחד לכל הרמות. בחינם וללא הרשמה.`;
      }
      const from = isTwin ? 'catalog-title-vs-blog' : 'catalog-title';
      finish(
        { path, kind: 'catalog-topic', grade: grade.grade, catalogTopicId: topic.id, currentTitle: '', currentDescription: '' },
        pick(path, 'title', { value: withBrand(headline), from }),
        pick(path, 'description', { value: clipSentences(body), from }),
      );
    }
  }

  for (const page of topicPages) {
    if (seenPaths.has(page.path)) continue;
    seenPaths.add(page.path);
    topicPageRow(page, page.grade, page.catalogCta?.catalogTopicId ?? null);
  }

  for (const post of posts) {
    const h1 = normalizePostCopy(post.h1 || post.title);
    const live = clean(post.title);
    const branded = withBrand(h1);
    const title = branded
      ? { value: branded, from: 'post-h1' }
      : { value: isValidLiveTitle(live) ? live : null, from: 'current' };
    const description = { value: clipSentences(normalizePostCopy(post.description || post.h1)), from: 'post-description' };
    finish(
      { path: post.path, kind: 'blog-post', grade: null, catalogTopicId: null, currentTitle: post.title || '', currentDescription: post.description || '' },
      pick(post.path, 'title', title),
      pick(post.path, 'description', description),
    );
  }

  for (const path of KEEP_CURRENT) {
    const row = proposals.find((item) => decoded(item.path) === path);
    if (!row) errors.push(`${path}: listed in KEEP_CURRENT but not generated`);
    else if (row.title !== clean(row.currentTitle) || row.description !== clean(row.currentDescription)) {
      errors.push(`${path}: reviewed as keep-current but the rules picked other copy`);
    }
  }
  for (const path of [...Object.keys(EXACT), ...Object.keys(NEEDS_DECISION)]) {
    if (!proposals.some((item) => decoded(item.path) === path)) errors.push(`${path}: override for a path that is not generated`);
  }

  const byKey = new Map();
  for (const item of proposals) {
    if (len(item.title) > TITLE_MAX) errors.push(`${item.path}: title ${len(item.title)} > ${TITLE_MAX}`);
    if (len(item.description) > DESC_MAX) errors.push(`${item.path}: description ${len(item.description)} > ${DESC_MAX}`);
    if (item.kind !== 'blog-post' && !item.title.includes()) {
      errors.push();
    }
    if (item.kind !== 'blog-post' && !item.title.includes(`ל${gradeLabels.get(item.grade)}`)) {
      errors.push(`${item.path}: title does not name the grade (ל${gradeLabels.get(item.grade)})`);
    }
    const key = titleKey(item.title);
    if (byKey.has(key)) errors.push(`duplicate title: ${byKey.get(key)} and ${item.path}`);
    byKey.set(key, item.path);
  }

  return { proposals, errors };
}
