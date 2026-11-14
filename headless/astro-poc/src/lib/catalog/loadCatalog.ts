/**
 * Build-time catalog loader — imports the in-repo generated snapshot.
 *
 * Snapshot file: src/data/catalog.v1.json
 * Refresh from authoritative headless/catalog/catalog.v1.json:
 *   npm run refresh:catalog
 * Verify hash / freshness:
 *   npm run check:catalog
 *
 * Do NOT hand-edit the snapshot. Do NOT use runtime node:fs / process.cwd siblings.
 *
 * M36: pdfBase is normalized to Wix Media CDN so PDF links survive DNS cutover
 * (legacy snapshot may still say www…/_files/ugd/…).
 */
import raw from '../../data/catalog.v1.json';
import type { CatalogV1 } from './types';
import { normalizePdfBase } from '../wixMedia';
import editionRegistry from '../../../../catalog/worksheet-editions.v1.json';
import { mergeWorksheetEditions } from '../../../../../scripts/lib/worksheet-editions.mjs';

export function loadCatalog(): CatalogV1 {
  const data = { ...(raw as CatalogV1) };
  if (data.contractVersion !== 1) {
    throw new Error('Unsupported catalog contractVersion: ' + String(data.contractVersion));
  }
  data.config = {
    ...data.config,
    pdfBase: normalizePdfBase(data.config.pdfBase),
  };
  return mergeWorksheetEditions(data, editionRegistry, data.ramziActivation) as CatalogV1;
}

export type { CatalogV1 };
