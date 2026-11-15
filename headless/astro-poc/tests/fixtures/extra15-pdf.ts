import { beforeNext12Catalog, beforeNext12Registry } from './next12-pdf';
import assert from 'node:assert/strict';
import { beforeExtSmlAfrCatalog, beforeExtSmlAfrRegistry, reviewedExtSmlAfr } from './ext-sml-afr-pdf';
import { beforeSaoWpcCatalog, reviewedSaoWpc } from './sao-wpc-pdf';

export const reviewedExtra15 = [...reviewedExtSmlAfr.additions, ...reviewedSaoWpc.additions];

/** Both frozen packets share the complete canonical485 baseline. No hash is relaxed. */
export function beforeExtra15Catalog<T>(catalog: T): T {
  return beforeExtSmlAfrCatalog(beforeSaoWpcCatalog(beforeNext12Catalog(catalog)));
}

export function beforeExtra15Registry<T>(registry: T): T {
  const restored: any = beforeExtSmlAfrRegistry(beforeNext12Registry(registry));
  for (const addition of reviewedSaoWpc.additions) {
    const matches = restored.editions.filter((e: any) => e.grade === addition.grade
      && e.topicId === addition.topicId && e.editionId === addition.editionId);
    assert.deepEqual(matches, [addition.edition], `${addition.editionId}: exact reviewed registry row`);
    restored.editions = restored.editions.filter((e: any) => !(e.grade === addition.grade
      && e.topicId === addition.topicId && e.editionId === addition.editionId));
  }
  return restored;
}
