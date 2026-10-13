/**
 * DOODLES-45 — build deterministic coverage matrix (id → sample routes).
 * Usage: npx tsx scripts/doodles45-coverage-matrix.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectSiteDoodles } from '../src/lib/doodles/selectSiteDoodles.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const man = JSON.parse(readFileSync(join(root, 'src/data/doodles.manifest.json'), 'utf8'));
const motifs = man.motifs as { id: string; src: string }[];

const staticRoutes = [
  '/grade-1',
  '/grade-2',
  '/grade-3',
  '/grade-4',
  '/grade-5',
  '/grade-6',
  '/grade-7',
  '/grade-8',
  '/grade-9',
  '/worksheets',
  '/blog',
  '/aboutus',
  '/terms',
  '/math-tools',
  '/accessibilityadaptation',
  '/conditionforfreeworksheets',
  '/high-school-math-1',
];
const topics = readdirSync(join(root, 'src/pages'))
  .filter((f) => /-grade-\d/.test(f))
  .map((f) => '/' + f.replace(/\.astro$/, ''));
const routes = [...new Set([...staticRoutes, ...topics])];

const usage: Record<string, string[]> = Object.fromEntries(motifs.map((m) => [m.id, []]));
const perRoute: Record<string, string[]> = {};

for (const path of routes) {
  const sel = selectSiteDoodles(path, motifs);
  perRoute[path] = sel.map((p) => p.id);
  for (const p of sel) usage[p.id].push(path);
}

const missing = motifs.filter((m) => usage[m.id].length === 0).map((m) => m.id);
const matrix = {
  generatedAt: new Date().toISOString(),
  motifCount: motifs.length,
  routesScanned: routes.length,
  homeSkipped: true,
  maxPerPage: 3,
  maxStripVisible: 2,
  allTenCovered: missing.length === 0,
  missing,
  byId: Object.fromEntries(
    motifs.map((m) => [
      m.id,
      {
        src: m.src,
        routeCount: usage[m.id].length,
        sampleRoutes: usage[m.id].slice(0, 5),
      },
    ])
  ),
  sampleRoutes: {
    '/grade-7': perRoute['/grade-7'],
    '/worksheets': perRoute['/worksheets'],
    '/blog': perRoute['/blog'],
    '/aboutus': perRoute['/aboutus'],
    '/terms': perRoute['/terms'],
  },
};

const outDir = join(root, 'reports', 'doodles-45');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'coverage-matrix.json'), JSON.stringify(matrix, null, 2) + '\n');
console.log(JSON.stringify({ allTenCovered: matrix.allTenCovered, missing, routes: routes.length }, null, 2));
console.log('wrote', join(outDir, 'coverage-matrix.json'));
process.exit(missing.length ? 1 : 0);
