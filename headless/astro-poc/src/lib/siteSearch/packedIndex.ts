/**
 * The search index is gzipped in the worker. Search responses still send the
 * same JSON; only the stored bytes are smaller, so the legal pages and the
 * retired-sheet redirect table fit under the deployment budget.
 */
import packed from '../../data/search-index.v1.json.gz.b64?raw';
import type { SearchIndex } from './types';

export async function loadSearchIndexData(): Promise<SearchIndex> {
  const bytes = Uint8Array.from(atob(packed.trim()), (char) => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as SearchIndex;
}
