/** Adapter: the new site search as a benchmark engine (see scripts/search-eval.ts). */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIndex, search, type PreparedIndex } from '../src/lib/siteSearch/engine';
import type { SearchIndex } from '../src/lib/siteSearch/types';
import type { Engine } from './search-eval';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Submitted query (not live typing), with the grade the visitor selected if any. */
export const newEngineFor =
  (prepared: PreparedIndex): Engine =>
  (q) =>
    search(prepared, q.query, { grade: q.context.grade ?? null }).results.map((r) => ({
      keys: r.keys,
      grade: r.grade,
      title: r.title,
    }));

export const newEngine: Engine = (q) => {
  const index: SearchIndex = JSON.parse(readFileSync(join(root, 'src/data/search-index.v1.json'), 'utf8'));
  return newEngineFor(cached ??= prepareIndex(index))(q);
};
let cached: PreparedIndex | undefined;
