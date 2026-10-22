/**
 * Search benchmark runner: `npx tsx scripts/search-eval.ts [--out dir]`.
 *
 * Runs every query in tests/fixtures/search-benchmark.json against
 *  - old-A: the catalog filter before this change, as a visitor meets it: the grade
 *    page that is selected (context grade, else the grade the query names, else the
 *    default grade 7), the query typed as is, cards in on-screen order;
 *  - old-B: the same matcher over all nine grades with the grade words removed
 *    (a generous upper bound for the old matcher);
 *  - new: the site search (src/lib/siteSearch) with the built index.
 * Metrics per engine: correct result in the top 3, wrong grade in the top 3,
 * misleading (answerable: first result not expected; no-answer: anything shown).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTopicHaystack, topicMatchesQuery } from '../src/lib/search';
import type { CatalogV1 } from '../src/lib/catalog/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog: CatalogV1 = JSON.parse(readFileSync(join(root, 'src/data/catalog.v1.json'), 'utf8'));

export interface BenchQuery {
  id: string;
  set: 'dev' | 'validation';
  query: string;
  context: { grade?: number };
  grade: number | null;
  kind: string;
  answerable: boolean;
  expected: string[];
  evidence: string;
}
export interface EngineResult {
  keys: string[];
  grade: number | null;
  title: string;
}
export type Engine = (q: BenchQuery) => EngineResult[];

export const bench: { queries: BenchQuery[] } = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/search-benchmark.json'), 'utf8')
);

/** Grade words the old box cannot understand ("כיתה ה", "לכיתה ז׳"), only for old-B. */
const LETTER: Record<string, number> = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9 };
function stripGrade(q: string): { q: string; grade: number | null } {
  const m = q.match(/(?:^|\s)[בל]?כיתה\s+([א-ט]|[1-9])['׳]?(?=\s|$)/);
  if (!m) return { q, grade: null };
  const g = /\d/.test(m[1]) ? Number(m[1]) : LETTER[m[1]];
  return { q: q.replace(m[0], ' ').trim(), grade: g };
}

function oldMatches(gradeNum: number, query: string): EngineResult[] {
  const g = catalog.grades.find((x) => x.grade === gradeNum)!;
  const terms = catalog.searchTerms[String(g.grade)] || {};
  const labels = new Map(g.groups.map((x) => [x.key, x.label]));
  const out: EngineResult[] = [];
  // Cards render group by group, topics in catalog order inside a group.
  const groups = g.grade === 9 ? g.groups.filter((x) => !x.reducedProgram) : g.groups;
  for (const grp of groups) {
    for (const t of g.topics) {
      if (t.parent !== undefined || t.group !== grp.key) continue;
      const kids = g.topics.filter((c) => c.parent === t.id).map((c) => c.title + ' ' + (c.description || ''));
      const hay = buildTopicHaystack(t, labels.get(t.group) || '', terms[String(t.id)] || '', kids);
      if (topicMatchesQuery(hay, query)) out.push({ keys: [`topic:${g.grade}:${t.id}`], grade: g.grade, title: t.title });
    }
  }
  return out;
}

export const oldA: Engine = (q) => {
  const page = q.context.grade ?? stripGrade(q.query).grade ?? 7;
  return oldMatches(page, q.query);
};
export const oldB: Engine = (q) => {
  const { q: text } = stripGrade(q.query);
  return catalog.grades.flatMap((g) => oldMatches(g.grade, text));
};

export interface Scored {
  q: BenchQuery;
  results: EngineResult[];
  hit3: boolean;
  wrongGrade: boolean;
  misleading: boolean;
  firstRank: number | null;
}
export function score(q: BenchQuery, results: EngineResult[]): Scored {
  const top = results.slice(0, 3);
  const ok = (r: EngineResult) => r.keys.some((k) => q.expected.includes(k));
  const idx = results.findIndex(ok);
  const hit3 = q.answerable && top.some(ok);
  const wrongGrade = q.grade != null && top.some((r) => r.grade !== q.grade);
  const misleading = q.answerable ? results.length > 0 && !ok(results[0]) : results.length > 0;
  return { q, results, hit3, wrongGrade, misleading, firstRank: idx < 0 ? null : idx + 1 };
}

export function summarize(rows: Scored[]) {
  const pick = (set?: string) => rows.filter((r) => !set || r.q.set === set);
  const one = (rs: Scored[]) => {
    const ans = rs.filter((r) => r.q.answerable);
    const graded = rs.filter((r) => r.q.grade != null);
    return {
      queries: rs.length,
      answerable: ans.length,
      hit3: ans.filter((r) => r.hit3).length,
      noResults: ans.filter((r) => !r.results.length).length,
      wrongGradeOf: graded.length,
      wrongGrade: graded.filter((r) => r.wrongGrade).length,
      misleading: rs.filter((r) => r.misleading).length,
      noAnswerShown: rs.filter((r) => !r.q.answerable && r.results.length).length,
    };
  };
  return { all: one(pick()), dev: one(pick('dev')), validation: one(pick('validation')) };
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function runAll(engines: Record<string, Engine>) {
  const out: Record<string, Scored[]> = {};
  for (const [name, engine] of Object.entries(engines)) out[name] = bench.queries.map((q) => score(q, engine(q)));
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const outDir = resolve(root, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/search');
  const engines: Record<string, Engine> = { 'old-A': oldA, 'old-B': oldB };
  if (!args.includes('--old-only')) {
    const { newEngine } = await import('./search-eval-new');
    engines.new = newEngine;
  }
  const runs = await runAll(engines);
  mkdirSync(outDir, { recursive: true });
  const summary = Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, summarize(v)]));
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  const header = ['id', 'set', 'kind', 'query', 'context_grade', 'binding_grade', 'answerable', 'expected'];
  for (const name of Object.keys(runs)) header.push(`${name}_top3`, `${name}_hit3`, `${name}_wrong_grade`, `${name}_misleading`);
  header.push('evidence');
  const lines = [header.join(',')];
  bench.queries.forEach((q, i) => {
    const row: unknown[] = [q.id, q.set, q.kind, q.query, q.context.grade ?? '', q.grade ?? '', q.answerable ? 'yes' : 'no', q.expected.join(' ')];
    for (const name of Object.keys(runs)) {
      const s = runs[name][i];
      row.push(
        s.results.slice(0, 3).map((r) => `${r.keys[0]} ${r.title}`).join(' | '),
        s.hit3 ? 1 : 0,
        s.wrongGrade ? 1 : 0,
        s.misleading ? 1 : 0
      );
    }
    row.push(q.evidence);
    lines.push(row.map(csvCell).join(','));
  });
  writeFileSync(join(outDir, 'benchmark-results.csv'), '﻿' + lines.join('\n') + '\n');
  console.log(JSON.stringify(summary, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
