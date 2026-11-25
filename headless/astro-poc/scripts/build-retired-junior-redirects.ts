/**
 * Write src/data/retired-junior-worksheet-redirects.json from the catalog.
 * Usage: tsx scripts/build-retired-junior-redirects.ts [--check]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildRetiredJuniorRedirects, topicKey } from '../src/lib/retiredJuniorWorksheets';

const root = dirname(fileURLToPath(import.meta.url));
const poc = dirname(root);
const outPath = join(poc, 'src/data/retired-junior-worksheet-redirects.json');

export function topicPathsFromPages(dir = join(poc, 'src/data/topic-pages')): Record<string, string> {
  const paths: Record<string, string[]> = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const page = JSON.parse(readFileSync(join(dir, name), 'utf8')) as {
      grade?: number;
      path?: string;
      catalogCta?: { catalogTopicId?: number };
    };
    const topicId = page.catalogCta?.catalogTopicId;
    if (page.grade == null || topicId == null || !page.path) continue;
    const key = topicKey(page.grade, topicId);
    paths[key] = paths[key] || [];
    if (!paths[key].includes(page.path)) paths[key].push(page.path);
  }
  const chosen: Record<string, string> = {};
  for (const [key, list] of Object.entries(paths)) {
    chosen[key] = [...list].sort()[0];
  }
  return chosen;
}

export function currentRetiredRedirects(): Record<string, string> {
  return buildRetiredJuniorRedirects(loadCatalog(), topicPathsFromPages());
}

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const check = process.argv.includes('--check');
  const next = currentRetiredRedirects();
  const text = JSON.stringify(next, null, 2) + '\n';
  if (check) {
    const prev = readFileSync(outPath, 'utf8');
    if (prev !== text) {
      console.error('retired junior worksheet redirects are stale; run tsx scripts/build-retired-junior-redirects.ts');
      process.exit(1);
    }
    console.log('retired junior worksheet redirects match', Object.keys(next).length);
  } else {
    writeFileSync(outPath, text);
    console.log('wrote', outPath, Object.keys(next).length);
  }
}
