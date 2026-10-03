/**
 * Site search: Hebrew-aware matching and ranking over the build-time index.
 *
 * - Every topic word of the query must match (words that only phrase the request,
 *   like "הילד שלי מתקשה", are optional).
 * - A grade named in the query, or selected by the visitor, is a binding filter.
 *   Matches in other grades are only counted and offered separately.
 * - A word the site does not contain may be replaced by the closest site word
 *   (one letter off). The answer says so; it is a guess, not the query.
 * - Ranking: title > sub-topics > search terms > group > description, plus how much
 *   of the title the query covers, so an exact title beats a passing mention.
 */
import type { CatalogLevelKey, CatalogTopic, CatalogV1 } from '../catalog/types';
import { buildWorksheetHref } from '../worksheetLinks';
import { analyzeWord, buildLexicon, normalizeText, tokenize, type Lexicon } from './normalize';
import { parseQuery, SOFT_WORDS, SYNONYMS } from './query';
import type { IndexLevel, IndexRouting, LevelLink, SearchDoc, SearchIndex, SearchResponse, SearchResult, TitlePart } from './types';

const W = { title: 10, children: 6, terms: 5, group: 3, description: 3 } as const;
const KIND_BONUS = { topic: 1.5, page: 1, post: 0 } as const;

/** A document with its field words analysed (prefixes, plural endings). */
export interface PreparedDoc {
  doc: SearchDoc;
  t: string[][];
  c: string[];
  s: string[];
  g: string[];
  d: string[];
}

export interface PreparedIndex {
  index: SearchIndex;
  docs: PreparedDoc[];
  lex: Lexicon;
  /** Documents containing each key. */
  df: Map<string, number>;
  byKey: Map<string, SearchDoc>;
  synonyms: Array<{ when: string[]; then: string[] }>;
  catalogShell: CatalogV1;
}

const split = (text: string | undefined) => (text ? text.split(' ') : []);

export function prepareIndex(index: SearchIndex): PreparedIndex {
  const words = new Set<string>();
  for (const d of index.docs) for (const f of Object.values(d.f)) for (const w of split(f)) words.add(w);
  const lex = buildLexicon(words);
  const memo = new Map<string, string[]>();
  const analyze = (w: string) => {
    let keys = memo.get(w);
    if (!keys) memo.set(w, (keys = analyzeWord(w, lex)));
    return keys;
  };
  const keysOf = (text: string | undefined) => [...new Set(split(text).flatMap(analyze))];
  const docs: PreparedDoc[] = index.docs.map((doc) => ({
    doc,
    t: split(doc.f.t).map(analyze),
    c: keysOf(doc.f.c),
    s: keysOf(doc.f.s),
    g: keysOf(doc.f.g),
    d: keysOf(doc.f.d),
  }));
  const df = new Map<string, number>();
  for (const d of docs) {
    const keys = new Set([...d.t.flat(), ...d.c, ...d.s, ...d.g, ...d.d]);
    for (const k of keys) df.set(k, (df.get(k) || 0) + 1);
  }
  const catalogShell: CatalogV1 = {
    contractVersion: 1,
    sourceOfTruth: { path: 'search-index', authoritative: false },
    config: {
      pdfBase: index.config.pdfBase,
      viewer: index.config.viewer,
      levels: [],
      defaults: { oneLabel: '' },
      elementaryGrades: [],
      middleGrades: index.config.middleGrades,
      gradeNames: {},
      gradeEmojis: {},
      trackGroups: [],
      noamPrefixFallback: {},
    },
    icons: {},
    searchTerms: {},
    grades: [],
  };
  return {
    index,
    docs,
    lex,
    df,
    byKey: new Map(index.docs.map((d) => [d.key, d])),
    synonyms: SYNONYMS.map((s) => ({ when: tokenize(s.when), then: tokenize(s.then) })),
    catalogShell,
  };
}

/** Damerau–Levenshtein distance capped at 2 (enough to test "one letter off"). */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return Math.min(d[a.length][b.length], 2);
}

const FINAL_OF: Record<string, string> = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
/** A normalised word written back with its final letter, for showing it to people. */
export function displayWord(word: string): string {
  const last = word.slice(-1);
  return FINAL_OF[last] && word.length > 1 ? word.slice(0, -1) + FINAL_OF[last] : word;
}

interface QueryItem {
  word: string;
  keys: Set<string>;
  weight: number;
  soft: boolean;
  /** Only a prefix of a word was typed so far (live search). */
  prefix?: boolean;
}

function spellingGuess(word: string, p: PreparedIndex): string | null {
  if (word.length < 4 || /\d/.test(word)) return null;
  const forms = analyzeWord(word, p.lex);
  let best: string | null = null;
  let bestDf = 0;
  for (const [k, n] of p.df) {
    if (k.length < 4 || Math.abs(k.length - word.length) > 1) continue;
    if (!forms.some((f) => editDistance(f, k) <= 1)) continue;
    if (n > bestDf || (n === bestDf && best !== null && k < best)) {
      best = k;
      bestDf = n;
    }
  }
  return best;
}

function buildItems(
  tokens: string[],
  p: PreparedIndex,
  live: boolean,
  corrections: Array<{ from: string; to: string }>
): QueryItem[] {
  const items: QueryItem[] = tokens.map((word, i) => {
    const soft = SOFT_WORDS.has(word);
    const keys = new Set(analyzeWord(word, p.lex).filter((k) => p.df.has(k)));
    if (keys.size || soft) return { word, keys, weight: 1, soft };
    if (live && i === tokens.length - 1 && word.length >= 2) {
      const pre = [...p.df.keys()].filter((k) => k.startsWith(word));
      if (pre.length) return { word, keys: new Set(pre), weight: 0.6, soft: false, prefix: true };
    }
    const guess = spellingGuess(word, p);
    if (guess) {
      corrections.push({ from: displayWord(word), to: displayWord(guess) });
      return { word, keys: new Set(analyzeWord(guess, p.lex).filter((k) => p.df.has(k))), weight: 0.7, soft: false };
    }
    return { word, keys, weight: 1, soft: false };
  });
  // A query made only of request words ("דפי עבודה") searches for those words.
  if (items.every((it) => it.soft)) for (const it of items) it.soft = false;
  return items;
}

function variants(tokens: string[], p: PreparedIndex): Array<{ tokens: string[]; weight: number }> {
  const out = [{ tokens, weight: 1 }];
  for (const s of p.synonyms) {
    for (let i = 0; i + s.when.length <= tokens.length; i++) {
      const slice = tokens.slice(i, i + s.when.length);
      if (slice.every((w, j) => analyzeWord(w, p.lex).includes(s.when[j]) || w === s.when[j])) {
        out.push({ tokens: [...tokens.slice(0, i), ...s.then, ...tokens.slice(i + s.when.length)], weight: 0.95 });
      }
    }
  }
  return out;
}

const hits = (keys: string[], q: Set<string>) => keys.some((k) => q.has(k));

function scoreDoc(pd: PreparedDoc, items: QueryItem[]): number {
  const doc = pd.doc;
  let score = 0;
  const titleHit = pd.t.map(() => false);
  const titlePos: number[] = [];
  for (const it of items) {
    if (it.soft) continue;
    let best = 0;
    pd.t.forEach((w, i) => {
      if (hits(w, it.keys)) {
        best = W.title;
        titleHit[i] = true;
        titlePos.push(i);
      }
    });
    if (!best && hits(pd.c, it.keys)) best = W.children;
    if (!best && hits(pd.s, it.keys)) best = W.terms;
    if (!best && hits(pd.g, it.keys)) best = W.group;
    if (!best && hits(pd.d, it.keys)) best = W.description;
    if (!best) return 0;
    score += best * it.weight;
  }
  for (const it of items) {
    if (!it.soft) continue;
    const all = [...pd.t.flat(), ...pd.c, ...pd.s, ...pd.g, ...pd.d];
    if (hits(all, it.keys)) score += 1;
  }
  // How much of the title the query covers, in coarse steps so that near-equal
  // titles keep the catalog's teaching order instead of favouring short titles.
  const words = pd.t.length || 1;
  const coverage = titleHit.filter(Boolean).length / words;
  score += coverage === 1 ? 6 : coverage >= 0.5 ? 3 : 0;
  const required = items.filter((it) => !it.soft).length;
  if (coverage === 1 && titlePos.length >= required) score += 4;
  return score + KIND_BONUS[doc.kind];
}

function titleParts(title: string, keys: Set<string>, lex: Lexicon): TitlePart[] {
  const parts: TitlePart[] = [];
  for (const piece of title.split(/(\s+)/)) {
    if (!piece) continue;
    const hit = tokenize(piece).some((w) => analyzeWord(w, lex).some((k) => keys.has(k)));
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += piece;
    else parts.push({ text: piece, hit });
  }
  return parts;
}

function asCatalogTopic(id: number, title: string, levels: IndexLevel[], routing: IndexRouting, parent?: number): CatalogTopic {
  return {
    id,
    title,
    group: '',
    icon: '',
    ...(parent !== undefined ? { parent } : {}),
    levels: levels.map((l) => ({ key: l.key as CatalogLevelKey, label: l.label, pdfId: l.pdfId, labelSource: 'search-index' })),
    routing: { ...routing, aiHintShown: false, viewerPath: null },
  };
}

function levelLinks(doc: SearchDoc, p: PreparedIndex): LevelLink[] {
  const t = doc.topic;
  if (!t || doc.grade === null) return [];
  const grade = doc.grade;
  const links = (topic: CatalogTopic, of?: string): LevelLink[] =>
    topic.levels.map((l) => ({
      key: l.key,
      label: l.label,
      href: buildWorksheetHref({ catalog: p.catalogShell, grade, topic, levelKey: l.key }),
      ...(of ? { of } : {}),
    }));
  const out: LevelLink[] = [];
  for (const c of t.children || []) out.push(...links(asCatalogTopic(c.id, c.title, c.levels, c.routing, t.id), c.title));
  out.push(...links(asCatalogTopic(t.id, doc.title, t.levels, t.routing)));
  return out;
}

function gradeLabel(p: PreparedIndex, g: number | null): string | null {
  return g === null ? null : p.index.gradeLabels[String(g)] || `כיתה ${g}`;
}

interface Scored {
  doc: SearchDoc;
  score: number;
}

function scoreAll(p: PreparedIndex, tokens: string[], live: boolean, corrections: Array<{ from: string; to: string }>) {
  const best = new Map<string, Scored>();
  const queryKeys = new Set<string>();
  for (const v of variants(tokens, p)) {
    const items = buildItems(v.tokens, p, live, v.weight === 1 ? corrections : []);
    for (const it of items) if (!it.soft) for (const k of it.keys) queryKeys.add(k);
    if (items.some((it) => !it.soft && !it.keys.size)) continue;
    for (const pd of p.docs) {
      const s = scoreDoc(pd, items) * v.weight;
      if (s > 0 && s > (best.get(pd.doc.key)?.score || 0)) best.set(pd.doc.key, { doc: pd.doc, score: s });
    }
  }
  return { scored: [...best.values()], queryKeys };
}

function group(p: PreparedIndex, scored: Scored[], queryKeys: Set<string>): SearchResult[] {
  const groups = new Map<string, { lead: SearchDoc; members: Scored[]; score: number }>();
  for (const s of scored) {
    const gk = s.doc.topicKey ?? s.doc.key;
    const lead = p.byKey.get(gk) ?? s.doc;
    const g = groups.get(gk) ?? { lead, members: [], score: 0 };
    g.members.push(s);
    g.score = Math.max(g.score, s.score);
    groups.set(gk, g);
  }
  const ordered = [...groups.values()].sort(
    (a, b) =>
      b.score - a.score ||
      (a.lead.grade ?? 99) - (b.lead.grade ?? 99) ||
      a.lead.order - b.lead.order
  );
  return ordered.map(({ lead, members, score }) => {
    const attached = p.index.docs.filter((d) => d.topicKey === lead.key);
    const keys = [lead.key, ...attached.map((d) => d.key)];
    const matchedKeys = new Set(members.map((m) => m.doc.key));
    const pick = (kind: 'page' | 'post') =>
      attached
        .filter((d) => d.kind === kind)
        .sort((a, b) => Number(matchedKeys.has(b.key)) - Number(matchedKeys.has(a.key)) || a.order - b.order)
        .map((d) => ({ title: d.title, href: d.href }));
    return {
      key: lead.key,
      keys,
      kind: lead.kind,
      grade: lead.grade,
      gradeLabel: gradeLabel(p, lead.grade),
      title: lead.title,
      titleParts: titleParts(lead.title, queryKeys, p.lex),
      ...(lead.description ? { description: lead.description } : {}),
      href: lead.href,
      ...(lead.group ? { group: lead.group } : {}),
      ...(lead.topic?.reduced ? { reduced: true } : {}),
      levels: levelLinks(lead, p),
      explainers: pick('page'),
      posts: pick('post'),
      score: Math.round(score * 100) / 100,
    };
  });
}

export interface SearchOptions {
  /** Grade the visitor selected (binding unless the query names another grade). */
  grade?: number | null;
  /** Live typing: the last word may still be incomplete. */
  live?: boolean;
  limit?: number;
}

export function search(p: PreparedIndex, rawQuery: string, opts: SearchOptions = {}): SearchResponse {
  const parsed = parseQuery(rawQuery);
  const selected = opts.grade && opts.grade >= 1 && opts.grade <= 9 ? opts.grade : null;
  const grade = parsed.grade ?? selected;
  const gradeSource = parsed.grade ? 'query' : selected ? 'selected' : null;
  const live = !!opts.live && !/\s$/.test(rawQuery);
  const base: SearchResponse = {
    query: rawQuery,
    grade,
    gradeSource,
    textWithoutGrade: parsed.textWithoutGrade,
    corrections: [],
    results: [],
    otherGrades: [],
    suggestions: [],
    empty: parsed.tokens.length === 0,
  };
  if (base.empty) return base;

  const corrections: Array<{ from: string; to: string }> = [];
  const { scored, queryKeys } = scoreAll(p, parsed.tokens, live, corrections);
  base.corrections = corrections.map((c) => ({ from: c.from, to: c.to }));
  const inGrade = grade === null ? scored : scored.filter((s) => s.doc.grade === grade);
  base.results = group(p, inGrade, queryKeys).slice(0, opts.limit ?? 30);

  if (grade !== null) {
    const counts = new Map<number, number>();
    for (const r of group(p, scored, queryKeys)) {
      if (r.grade !== null && r.grade !== grade) counts.set(r.grade, (counts.get(r.grade) || 0) + 1);
    }
    base.otherGrades = [...counts]
      .sort((a, b) => a[0] - b[0])
      .map(([g, count]) => ({ grade: g, label: gradeLabel(p, g) || '', count }));
  }

  if (!base.results.length) {
    const words = parsed.tokens.filter((w) => !SOFT_WORDS.has(w));
    if (words.length > 1) {
      for (const w of words) {
        const sub = scoreAll(p, [w], false, []).scored.filter((s) => grade === null || s.doc.grade === grade);
        const n = group(p, sub, new Set()).length;
        if (n) base.suggestions.push({ query: displayWord(w), count: n });
      }
    }
  }
  return base;
}

/**
 * Topic ids of one grade that match (catalog page filter); null when the query is
 * empty. A query naming another grade ("שברים כיתה ה" on grade 7) matches nothing here.
 */
export function matchingTopicIds(p: PreparedIndex, rawQuery: string, grade: number, live = true): Set<number> | null {
  const parsed = parseQuery(rawQuery);
  if (!parsed.tokens.length && !parsed.grade) return null;
  if (parsed.grade && parsed.grade !== grade) return new Set();
  if (!parsed.tokens.length) return null;
  const { scored } = scoreAll(p, parsed.tokens, live && !/\s$/.test(rawQuery), []);
  const out = new Set<number>();
  for (const s of scored) if (s.doc.kind === 'topic' && s.doc.grade === grade && s.doc.topic) out.add(s.doc.topic.id);
  return out;
}

export { normalizeText };
