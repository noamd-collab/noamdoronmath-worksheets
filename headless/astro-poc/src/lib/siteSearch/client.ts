/**
 * Browser entry for the site search, loaded on demand: fetches the build-time
 * index once (served by /search-index.v1.json) and prepares it.
 */
import { prepareIndex, search, type PreparedIndex } from './engine';
import type { SearchIndex } from './types';

export const SEARCH_INDEX_URL = '/search-index.v1.json';

let loading: Promise<PreparedIndex> | null = null;

export function loadSearchIndex(): Promise<PreparedIndex> {
  loading ??= fetch(SEARCH_INDEX_URL, { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error(`search index: HTTP ${r.status}`);
      return r.json() as Promise<SearchIndex>;
    })
    .then(prepareIndex)
    .catch((e) => {
      loading = null; // allow a retry
      throw e;
    });
  return loading;
}

export { search };
