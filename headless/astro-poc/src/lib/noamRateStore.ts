/**
 * Shared rate-limit counter for Noam AI.
 * Wix Data find() did not return the rows inserted a moment earlier, so a
 * query of hit rows never reached 12. One item per hashed visitor, read with
 * get() and saved only when the count is still under the cap.
 * This is not the catalog CMS collection. The item id is a hash, not the IP.
 *
 * Every call is elevated. All four collection permissions stay ADMIN.
 * This module never changes permissions and never retries as the visitor.
 * If an elevated call fails, the caller falls back to the in-memory limit.
 * get() uses a consistent read so the next request sees the saved count.
 */
import { auth } from '@wix/essentials';
import { collections, items } from '@wix/data';
import { nextRateWrite, rateBucketId } from '../../../../noam-ai/site-companion/rate-bucket.js';

export const NOAM_RATE_COLLECTION_ID = 'NoamAiRateLimit';

const RATE_PERMISSIONS = {
  insert: 'ADMIN',
  update: 'ADMIN',
  read: 'ADMIN',
  remove: 'ADMIN',
} as const;

type RateRow = { _id?: string; count?: number; windowStart?: number; data?: { count?: number; windowStart?: number } };
type CollectionShape = {
  fields?: Array<{ key?: string }>;
};

let ready: Promise<void> | null = null;

function errorText(error: unknown): string {
  const message = String(error && (error as { message?: string }).message || error || '');
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function missingCollection(error: unknown): boolean {
  return /not.?found|does not exist|WDE0007|WDE0073|COLLECTION_NOT_FOUND/i.test(errorText(error));
}

function fieldKeys(collection: CollectionShape | null): Set<string> | null {
  if (!collection || !Array.isArray(collection.fields)) return null;
  const keys = new Set<string>();
  for (const field of collection.fields) {
    if (field && field.key) keys.add(field.key);
  }
  return keys;
}

async function ensureCollection(): Promise<void> {
  if (!ready) {
    ready = prepareCollection().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function prepareCollection(): Promise<void> {
  const getCollection = auth.elevate(collections.getDataCollection);
  const addField = auth.elevate(collections.createDataCollectionField);
  const createCollection = auth.elevate(collections.createDataCollection);
  let collection: CollectionShape | null = null;
  try {
    collection = await getCollection(NOAM_RATE_COLLECTION_ID);
  } catch (error) {
    if (!missingCollection(error)) throw error;
    collection = await createCollection({
      _id: NOAM_RATE_COLLECTION_ID,
      displayName: 'Noam AI rate limit',
      fields: [
        { key: 'count', type: 'NUMBER' },
        { key: 'windowStart', type: 'NUMBER' },
      ],
      permissions: RATE_PERMISSIONS,
    });
  }
  const keys = fieldKeys(collection);
  if (!keys) return;
  if (!keys.has('count')) {
    await addField(NOAM_RATE_COLLECTION_ID, { field: { key: 'count', type: 'NUMBER' } });
  }
  if (!keys.has('windowStart')) {
    await addField(NOAM_RATE_COLLECTION_ID, { field: { key: 'windowStart', type: 'NUMBER' } });
  }
}

function missingItem(error: unknown): boolean {
  return /not.?found|404|does not exist|WDE0073|ITEM_NOT_FOUND/i.test(errorText(error));
}

async function readCount(id: string): Promise<RateRow | null> {
  const get = auth.elevate(items.get);
  try {
    return await get(NOAM_RATE_COLLECTION_ID, id, { consistentRead: true });
  } catch (error) {
    if (!missingItem(error)) throw error;
    return null;
  }
}

async function writeCount(id: string, count: number, windowStart: number): Promise<void> {
  const save = auth.elevate(items.save);
  await save(NOAM_RATE_COLLECTION_ID, { _id: id, count, windowStart });
}

export function createWixRateBackend() {
  return {
    async take(key: string, now: number, max: number, windowMs: number): Promise<{ ok: boolean; backend: 'wix'; error: string }> {
      await ensureCollection();
      const id = rateBucketId(key);
      const row = await readCount(id);
      const write = nextRateWrite(row, now, max, windowMs);
      if (!write) return { ok: false, backend: 'wix', error: '' };
      await writeCount(id, write.count, write.windowStart);
      return { ok: true, backend: 'wix', error: '' };
    },
  };
}
