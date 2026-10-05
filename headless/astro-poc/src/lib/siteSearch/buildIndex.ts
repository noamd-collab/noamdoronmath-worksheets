/**
 * Builds the site search index from the site's own data: the catalog (topics,
 * levels, search terms), topic explainer pages and blog posts. Deterministic and
 * free of I/O so it runs in the build script and in the browser alike.
 *
 * A page or post is attached to a catalog topic only when it links to that topic
 * AND the two titles share a topic word; otherwise it stays a result of its own.
 */
import type { CatalogV1 } from '../catalog/types';
import { analyzeWord, buildLexicon, normalizeText, tokenize, type Lexicon } from './normalize';
import { gradeInQuery } from './query';
import type { SearchDoc, SearchIndex } from './types';

export interface TermsDecision {
  grade: number;
  topic: number;
  terms: string;
  decision: 'move' | 'exclude' | 'keep';
  to?: number;
  evidence: string;
}

export interface PageInput {
  path: string;
  grade: number;
  h1: string;
  description?: string;
  catalogTopicIds: number[];
}

export interface PostInput {
  fileSlug: string;
  path: string;
  title: string;
  description?: string;
  /** Every href in the post. */
  links: string[];
}

export interface BuildInput {
  catalog: CatalogV1;
  pages: PageInput[];
  posts: PostInput[];
  termsDecisions: TermsDecision[];
}

export interface AssociationNote {
  key: string;
  title: string;
  linkedTopic: string;
  linkedTitle: string;
  verified: boolean;
  reason: string;
}

export interface BuildReport {
  associations: AssociationNote[];
  termsApplied: Array<TermsDecision & { applied: boolean }>;
}

/** Words that say nothing about the topic, ignored when checking a title link. */
const GENERIC = new Set(
  [
    'כיתה', 'לכיתה', 'חלק', 'דף', 'דפי', 'עבודה', 'חזרה', 'העמקה', 'ורשות', 'רשות', 'היכרות', 'מבוא', 'שימושים',
    'תרגול', 'תרגילי', 'תרגילים', 'מדריך', 'איך', 'מה', 'של', 'על', 'עם', 'את', 'ו', 'ב', 'ל', 'ה', 'א', 'ב', 'ג', 'ד',
    'ז', 'ח', 'ט', 'ו', 'בכיתה', 'לתרגול', 'נכון', 'בבית', 'להורים', 'ולמורים', 'הסבר', 'דוגמאות', 'פתורות',
  ].flatMap(tokenize)
);

function topicWords(text: string, lex: Lexicon): Set<string> {
  const out = new Set<string>();
  for (const w of tokenize(text)) {
    if (GENERIC.has(w) || /^\d+$/.test(w)) continue;
    for (const k of analyzeWord(w, lex)) out.add(k);
  }
  return out;
}

function sharesWord(a: string, b: string, lex: Lexicon): boolean {
  const bw = topicWords(b, lex);
  for (const k of topicWords(a, lex)) if (bw.has(k)) return true;
  return false;
}

/** Index fields hold normalised text; empty fields are left out. */
function fields(f: { t: string; c?: string; s?: string; g?: string; d?: string }): SearchDoc['f'] {
  const out: SearchDoc['f'] = { t: normalizeText(f.t) };
  for (const k of ['c', 's', 'g', 'd'] as const) {
    const v = normalizeText(f[k] || '');
    if (v) out[k] = v;
  }
  return out;
}

/** The grade a post is for: its title ("… לכיתה ז׳") and its slug (-grade-7) must not disagree. */
export function postGrade(post: Pick<PostInput, 'title' | 'fileSlug'>): number | null {
  const fromTitle = gradeInQuery(tokenize(post.title))?.grade ?? null;
  const m = post.fileSlug.match(/(?:^|-)grade-([1-9])(?:-|$)/);
  const fromSlug = m ? Number(m[1]) : null;
  if (fromTitle && fromSlug && fromTitle !== fromSlug) return null;
  return fromTitle ?? fromSlug;
}

/** grade/topic pairs a link opens in the catalog (/worksheets or the GitHub Pages copy). */
export function catalogTargets(href: string): Array<{ grade: number; topic: number }> {
  let url: URL;
  try {
    url = new URL(href, 'https://www.noamdoronmath.co.il');
  } catch {
    return [];
  }
  const path = url.pathname.replace(/\/+$/, '');
  const isCatalog =
    path === '/worksheets' ||
    (url.hostname === 'noamd-collab.github.io' && /^\/noamdoronmath-worksheets(?:\/index\.html)?$/.test(path));
  const g = Number(url.searchParams.get('grade'));
  const t = Number(url.searchParams.get('topic'));
  if (!isCatalog || !Number.isInteger(g) || !Number.isInteger(t) || g < 1 || g > 9 || t < 1) return [];
  return [{ grade: g, topic: t }];
}

/** Catalog search terms after the reviewed decisions; decisions apply only to the exact terms they name. */
export function reviewedSearchTerms(
  catalog: CatalogV1,
  decisions: TermsDecision[]
): { terms: Map<string, string[]>; applied: Array<TermsDecision & { applied: boolean }> } {
  const terms = new Map<string, string[]>();
  for (const [g, byTopic] of Object.entries(catalog.searchTerms || {})) {
    for (const [t, text] of Object.entries(byTopic)) if (text) terms.set(`${g}:${t}`, [text]);
  }
  const applied = decisions.map((d) => {
    const key = `${d.grade}:${d.topic}`;
    const current = catalog.searchTerms?.[String(d.grade)]?.[String(d.topic)];
    if (current !== d.terms) return { ...d, applied: false };
    if (d.decision === 'keep') return { ...d, applied: true };
    terms.set(key, (terms.get(key) || []).filter((x) => x !== d.terms));
    if (d.decision === 'move' && d.to) {
      const to = `${d.grade}:${d.to}`;
      terms.set(to, [...(terms.get(to) || []), d.terms]);
    }
    return { ...d, applied: true };
  });
  return { terms, applied };
}

export function buildIndex(input: BuildInput): { index: SearchIndex; report: BuildReport } {
  const { catalog } = input;
  const { terms, applied } = reviewedSearchTerms(catalog, input.termsDecisions);

  // Lexicon from every text that is indexed.
  const texts: string[] = [];
  for (const g of catalog.grades) {
    for (const gr of g.groups) texts.push(gr.label);
    for (const t of g.topics) texts.push(t.title, t.description || '');
  }
  for (const list of terms.values()) texts.push(...list);
  for (const p of input.pages) texts.push(p.h1, p.description || '');
  for (const p of input.posts) texts.push(p.title, p.description || '');
  const words = new Set<string>();
  for (const t of texts) for (const w of tokenize(t)) words.add(w);
  const lex = buildLexicon(words);

  const docs: SearchDoc[] = [];
  const topicByKey = new Map<string, { title: string; description: string; grade: number }>();
  let order = 0;
  const trackGroups = new Set(
    catalog.grades.flatMap((g) => g.groups.filter((x) => x.reducedProgram).map((x) => `${g.grade}:${x.key}`))
  );

  for (const g of catalog.grades) {
    const groupLabel = new Map(g.groups.map((x) => [x.key, x.label]));
    for (const t of g.topics) {
      if (t.parent !== undefined) continue;
      const kids = g.topics.filter((c) => c.parent === t.id);
      const key = `topic:${g.grade}:${t.id}`;
      topicByKey.set(key, {
        title: [t.title, ...kids.map((k) => k.title)].join(' '),
        description: t.description || '',
        grade: g.grade,
      });
      const levels = (l: typeof t.levels) => l.map((x) => ({ key: x.key, label: x.label, pdfId: x.pdfId }));
      const routing = (x: typeof t) => ({
        resolvedNoamPrefix: x.routing?.resolvedNoamPrefix ?? null,
        usesViewer: !!x.routing?.usesViewer,
        siblingPdfQuery: { ...(x.routing?.siblingPdfQuery || {}) },
      });
      docs.push({
        key,
        kind: 'topic',
        grade: g.grade,
        title: t.title,
        description: t.description || undefined,
        href: `/worksheets?grade=${g.grade}&topic=${t.id}`,
        group: groupLabel.get(t.group),
        topic: {
          id: t.id,
          levels: levels(t.levels),
          routing: routing(t),
          ...(trackGroups.has(`${g.grade}:${t.group}`) ? { reduced: true } : {}),
          ...(kids.length ? { children: kids.map((k) => ({ id: k.id, title: k.title, levels: levels(k.levels), routing: routing(k) })) } : {}),
        },
        f: fields({
          t: t.title,
          c: kids.map((k) => k.title + ' ' + (k.description || '')).join(' '),
          s: (terms.get(`${g.grade}:${t.id}`) || []).join(' '),
          g: groupLabel.get(t.group),
          d: t.description,
        }),
        order: order++,
      });
    }
  }

  const associations: AssociationNote[] = [];
  function associate(
    key: string,
    title: string,
    grade: number | null,
    targets: Array<{ grade: number; topic: number }>
  ): string | undefined {
    let chosen: string | undefined;
    const seen = new Set<string>();
    for (const tg of targets) {
      const tk = `topic:${tg.grade}:${tg.topic}`;
      if (seen.has(tk)) continue;
      seen.add(tk);
      const topic = topicByKey.get(tk);
      if (!topic) {
        associations.push({ key, title, linkedTopic: tk, linkedTitle: '', verified: false, reason: 'not a catalog card (sub-topic or missing)' });
        continue;
      }
      let reason = '';
      if (grade !== null && topic.grade !== grade) reason = `grade ${grade} ≠ topic grade ${topic.grade}`;
      else if (!sharesWord(title, topic.title, lex)) reason = 'titles share no topic word';
      const verified = !reason && !chosen;
      associations.push({
        key,
        title,
        linkedTopic: tk,
        linkedTitle: topic.title,
        verified,
        reason: reason || (verified ? 'links to the topic, same grade, shared title word' : 'already attached to an earlier link'),
      });
      if (verified) chosen = tk;
    }
    return chosen;
  }

  for (const p of input.pages) {
    const key = `page:${p.path}`;
    const topicKey = associate(key, p.h1, p.grade, p.catalogTopicIds.map((topic) => ({ grade: p.grade, topic })));
    docs.push({
      key,
      kind: 'page',
      grade: p.grade,
      title: p.h1,
      description: p.description || undefined,
      href: p.path,
      ...(topicKey ? { topicKey } : {}),
      f: fields({ t: p.h1, d: p.description }),
      order: order++,
    });
  }
  for (const p of input.posts) {
    const key = `post:${p.fileSlug}`;
    const grade = postGrade(p);
    const targets = p.links.flatMap(catalogTargets);
    // A post for no single grade that links to several grades is a general article.
    const spansGrades = grade === null && new Set(targets.map((t) => t.grade)).size > 1;
    const topicKey = spansGrades
      ? (associations.push({ key, title: p.title, linkedTopic: '', linkedTitle: '', verified: false, reason: 'post for no single grade links to several grades' }), undefined)
      : associate(key, p.title, grade, targets);
    docs.push({
      key,
      kind: 'post',
      grade: topicKey ? topicByKey.get(topicKey)!.grade : grade,
      title: p.title,
      description: p.description || undefined,
      href: p.path,
      ...(topicKey ? { topicKey } : {}),
      f: fields({ t: p.title, d: p.description }),
      order: order++,
    });
  }

  const index: SearchIndex = {
    version: 1,
    config: {
      pdfBase: catalog.config.pdfBase,
      viewer: { enabled: !!catalog.config.viewer.enabled, path: catalog.config.viewer.path },
      middleGrades: (catalog.config.middleGrades || []).map(Number),
    },
    gradeLabels: Object.fromEntries(catalog.grades.map((g) => [String(g.grade), g.label])),
    docs,
  };
  return { index, report: { associations, termsApplied: applied } };
}
