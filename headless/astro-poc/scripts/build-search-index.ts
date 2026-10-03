/**
 * Builds the site search index from the site's data (deterministic, offline).
 *
 *   npm run refresh:search-index   # writes src/data/search-index.v1.json
 *   npm run check:search-index     # fails when the committed index is stale
 *
 * Also writes docs/search/index-build.json: which explainer pages and posts were
 * attached to a catalog topic, which were not and why, and the search-terms decisions.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { collectBlogPostHrefs, listServedBlogPosts } from '../src/lib/blogPosts';
import { loadAllTopicPages } from '../src/lib/topicPages';
import { buildIndex, type TermsDecision } from '../src/lib/siteSearch/buildIndex';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

export function buildFromRepo() {
  // The site's catalog loader (PDF links on the Wix Media CDN, as the catalog page uses).
  const catalog = loadCatalog();
  const review: { decisions: TermsDecision[] } = read('src/data/search-terms-review.json');
  const pages = loadAllTopicPages().map((p) => {
    const ctas = p.catalogCtas?.length ? p.catalogCtas : p.catalogCta ? [p.catalogCta] : [];
    return {
      path: p.path,
      grade: p.grade,
      h1: p.h1,
      description: p.description,
      catalogTopicIds: ctas.map((c) => c.catalogTopicId).filter((id): id is number => typeof id === 'number'),
    };
  });
  const posts = listServedBlogPosts().map((p) => ({
    fileSlug: p.fileSlug,
    path: p.path,
    title: p.title,
    description: p.description,
    links: collectBlogPostHrefs(p)
      .filter((h) => h.where.startsWith('block') || h.where.startsWith('list'))
      .map((h) => h.href),
  }));
  return buildIndex({ catalog, pages, posts, termsDecisions: review.decisions });
}

const INDEX_PATH = 'src/data/search-index.v1.json';

function main() {
  const { index, report } = buildFromRepo();
  const text = JSON.stringify(index) + '\n';
  if (process.argv.includes('--check')) {
    const current = readFileSync(join(root, INDEX_PATH), 'utf8');
    if (current !== text) {
      console.error(`${INDEX_PATH} is stale: run npm run refresh:search-index`);
      process.exit(1);
    }
    console.log(`${INDEX_PATH} is up to date (${index.docs.length} documents)`);
    return;
  }
  writeFileSync(join(root, INDEX_PATH), text);
  mkdirSync(join(root, 'docs/search'), { recursive: true });
  writeFileSync(join(root, 'docs/search/index-build.json'), JSON.stringify(report, null, 2) + '\n');
  const att = report.associations;
  console.log(
    `${INDEX_PATH}: ${index.docs.length} documents, ${Buffer.byteLength(text)} bytes; ` +
      `links verified ${att.filter((a) => a.verified).length}, not attached ${att.filter((a) => !a.verified).length}; ` +
      `terms decisions applied ${report.termsApplied.filter((d) => d.applied).length}/${report.termsApplied.length}`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
