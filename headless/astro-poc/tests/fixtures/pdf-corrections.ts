import assert from 'node:assert/strict';
import batch12 from '../../../../docs/batch12-pdf-first-20261118.json';

type Field = { field: string; before: string | number; after: string | number };
type Correction = { editionId: string; grade: number; topicId: number; levelKey: string; fields: Field[] };

export const pdfCorrections: Correction[] = (batch12 as { corrections: Correction[] }).corrections;

/** Exact current or exact earlier level; anything else is a substitution. */
function restoreLevel(level: any, fix: Correction): void {
  assert.ok(level, `${fix.editionId}/${fix.levelKey}: corrected level exists`);
  const side = fix.fields.every(f => level[f.field] === f.after) ? 'after'
    : fix.fields.every(f => level[f.field] === f.before) ? 'before' : null;
  assert.ok(side, `${fix.editionId}/${fix.levelKey}: corrected level is neither the current nor the earlier row`);
  for (const f of fix.fields) level[f.field] = f.before;
}

/**
 * A PDF corrected in place keeps its edition, worksheet and learning ids. Put the
 * earlier level fields back so that baselines recorded before the correction keep
 * their hashes. Idempotent: an already restored row passes unchanged.
 */
export function catalogBeforePdfCorrections<T>(catalog: T): T {
  const result: any = structuredClone(catalog);
  for (const fix of pdfCorrections) {
    const topic = result.grades.find((g: any) => g.grade === fix.grade)?.topics.find((t: any) => t.id === fix.topicId);
    const edition = topic?.editions?.find((e: any) => e.editionId === fix.editionId);
    if (!edition) continue;
    restoreLevel(edition.levels.find((l: any) => l.key === fix.levelKey), fix);
    const query = edition.routing?.siblingPdfQuery;
    const pdf = fix.fields.find(f => f.field === 'pdfId')!;
    if (query && query['p' + fix.levelKey] === pdf.after) query['p' + fix.levelKey] = pdf.before;
  }
  return result;
}

export function registryBeforePdfCorrections<T>(registry: T): T {
  const result: any = structuredClone(registry);
  for (const fix of pdfCorrections) {
    const edition = result.editions.find((e: any) => e.editionId === fix.editionId);
    if (edition) restoreLevel(edition.levels.find((l: any) => l.key === fix.levelKey), fix);
  }
  return result;
}

/** The published form of an edition recorded before its correction. */
export function editionAfterPdfCorrections<T extends { editionId: string; levels: any[] }>(edition: T): T {
  const result = structuredClone(edition);
  for (const fix of pdfCorrections.filter(f => f.editionId === edition.editionId)) {
    const level = result.levels.find(l => l.key === fix.levelKey);
    assert.ok(fix.fields.every(f => level[f.field] === f.before), `${fix.editionId}/${fix.levelKey}: recorded earlier row`);
    for (const f of fix.fields) level[f.field] = f.after;
  }
  return result;
}
