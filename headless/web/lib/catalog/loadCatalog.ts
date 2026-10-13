import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { CatalogGrade, CatalogV1 } from './types';

/**
 * Load the Phase 0 catalog contract from the sibling headless/catalog folder.
 * Server-only — swap this module later for a CMS-backed implementation.
 */
export function loadCatalog(): CatalogV1 {
  const catalogPath = path.join(process.cwd(), '..', 'catalog', 'catalog.v1.json');
  const raw = fs.readFileSync(catalogPath, 'utf8');
  const data = JSON.parse(raw) as CatalogV1;
  if (data.contractVersion !== 1) {
    throw new Error('Unsupported catalog contractVersion: ' + String(data.contractVersion));
  }
  return data;
}

export function getGrade(catalog: CatalogV1, grade: number): CatalogGrade {
  const entry = catalog.grades.find((g) => g.grade === grade);
  if (!entry) throw new Error('Grade not found in catalog: ' + grade);
  return entry;
}
