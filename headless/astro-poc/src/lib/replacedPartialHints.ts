/**
 * 301 targets for Ramzi partial readers whose PDF was corrected in place.
 * The edition keeps its ids; only the PDF (and its hint index) moved to a new
 * Wix media id, so a saved `/ramzi-partial?pdf=<old>` link opens the corrected sheet.
 * A replaced id must not keep its own index file or catalog link.
 */
export const REPLACED_PARTIAL_PDFS: ReadonlyMap<string, string> = new Map([
  // G7-ANG-02 excellence, revision 2 (26.11.2026): corrected printed answer 5ג.
  ['0786a43b24d1416e9abedeea42e4be41', '0246f51e8fc3497284208e691322fe98'],
]);

export function replacedPartialHintTarget(pathname: string, params: URLSearchParams): string | null {
  if (pathname !== '/ramzi-partial') return null;
  const ids = params.getAll('pdf');
  const next = ids.length === 1 ? REPLACED_PARTIAL_PDFS.get(ids[0]) : undefined;
  if (!next) return null;
  const search = new URLSearchParams(params);
  search.set('pdf', next);
  return '/ramzi-partial?' + search.toString();
}
