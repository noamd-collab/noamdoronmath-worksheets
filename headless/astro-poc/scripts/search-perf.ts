/**
 * Search timing in Node: index preparation and every benchmark query (submitted and
 * live), `npx tsx scripts/search-perf.ts`. Browser timings come from the journeys.
 */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import type { SearchIndex } from '../src/lib/siteSearch/types';
import { bench } from './search-eval';

const text = readFileSync(new URL('../src/data/search-index.v1.json', import.meta.url), 'utf8');
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const t0 = performance.now();
const prepared = prepareIndex(JSON.parse(text) as SearchIndex);
const prepareMs = performance.now() - t0;
const times: Record<string, number[]> = { submitted: [], live: [] };
for (let round = 0; round < 5; round++) {
  for (const q of bench.queries) {
    for (const live of [false, true]) {
      const s = performance.now();
      search(prepared, q.query, { grade: q.context.grade ?? null, live });
      if (round > 0) times[live ? 'live' : 'submitted'].push(performance.now() - s);
    }
  }
}
const out = {
  indexBytes: Buffer.byteLength(text),
  indexGzipBytes: gzipSync(text).length,
  documents: prepared.index.docs.length,
  prepareMs: Math.round(prepareMs * 10) / 10,
  ...Object.fromEntries(
    Object.entries(times).map(([k, xs]) => [k, { medianMs: +pct(xs, 0.5).toFixed(2), p95Ms: +pct(xs, 0.95).toFixed(2), maxMs: +Math.max(...xs).toFixed(2) }])
  ),
};
console.log(JSON.stringify(out, null, 2));
