import type { CatalogV1 } from '../../headless/astro-poc/src/lib/catalog/types';
export function mergeWorksheetEditions(catalog: CatalogV1, registry: unknown, readiness?: unknown): CatalogV1;
export function worksheetLearningId(grade: number, topicId: number, levelKey: string, editionId?: string): string;

export function validateRamziReadiness(registry: unknown, readiness?: unknown): Map<string, Record<string, unknown>>;
