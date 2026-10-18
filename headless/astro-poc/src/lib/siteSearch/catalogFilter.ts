/**
 * Catalog page filter: the site search matching over the catalog topics alone,
 * built from the catalog the page already has (no extra download).
 */
import type { CatalogV1 } from '../catalog/types';
import reviewData from '../../data/search-terms-review.json';
import { buildIndex, type TermsDecision } from './buildIndex';
import { matchingTopicIds, prepareIndex, type PreparedIndex } from './engine';

const cache = new WeakMap<CatalogV1, PreparedIndex>();

export function catalogSearch(catalog: CatalogV1): PreparedIndex {
  let p = cache.get(catalog);
  if (!p) {
    const decisions = (reviewData as { decisions: TermsDecision[] }).decisions;
    p = prepareIndex(buildIndex({ catalog, pages: [], posts: [], termsDecisions: decisions }).index);
    cache.set(catalog, p);
  }
  return p;
}

export { matchingTopicIds };
