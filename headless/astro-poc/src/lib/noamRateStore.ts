/**
 * Shared rate-limit counter for Noam AI.
 * Wix Data find() did not return the rows inserted a moment earlier, so a
 * query of hit rows never reached 12. One item per hashed visitor, read with
 * get() and saved only when the count is still under the cap.
 * This is not the catalog CMS collection. The item id is a hash, not the IP.
 */
import { auth } from '@wix/essentials';
import { collections, items } from '@wix/data';
import { nextRateWrite, rateBucketId } from '../../../../noam-ai/site-companion/rate-bucket.js';

export const NOAM_RATE_COLLECTION_ID = 'NoamAiRateLimit';

type RateRow = { _id?: string; count?: number; windowStart?: number; data?: { count?: number; windowStart?: number } };

let ready: Promise<void> | null = null;

function fieldKeys(collection: { fields?: Array<{ key?: string }> } | null): Set<string> {
  const keys = new Set<string>();
  const fields = collection && Array.isArray(collection.fields) ? collection.fields : [];
  for (const field of fields) {
    if (field && field.key) keys.add(field.key);
  }
  return keys;
}

async function ensureCollection(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const getCollection = auth.elevate(collections.getDataCollection);
      const addField = auth.elevate(collections.createDataCollectionField);
      let collection: { fields?: Array<{ key?: string }> } | null = null;
      try {
        collection = await getCollection(NOAM_RATE_COLLECTION_ID);
      } catch (error) {
        const createCollection = auth.elevate(collections.createDataCollection);
        collection = await createCollection({
          _id: NOAM_RATE_COLLECTION_ID,
          displayName: 'Noam AI rate limit',
          fields: [
            { key: 'count', type: 'NUMBER' },
            { key: 'windowStart', type: 'NUMBER' },
          ],
          permissions: {
            insert: 'ADMIN',
            update: 'ADMIN',
            remove: 'ADMIN',
            read: 'ADMIN',
          },
        });
      }
      const keys = fieldKeys(collection);
      if (!keys.has('count')) {
        await addField(NOAM_RATE_COLLECTION_ID, { field: { key: 'count', type: 'NUMBER' } });
      }
      if (!keys.has('windowStart')) {
        await addField(NOAM_RATE_COLLECTION_ID, { field: { key: 'windowStart', type: 'NUMBER' } });
      }
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

function missingItem(error: unknown): boolean {
  const message = String(error && (error as { message?: string }).message || error);
  return /not.?found|404|does not exist|WDE0073|ITEM_NOT_FOUND/i.test(message);
}

export function createWixRateBackend() {
  return {
    async take(key: string, now: number, max: number, windowMs: number): Promise<boolean> {
      await ensureCollection();
      const id = rateBucketId(key);
      const get = auth.elevate(items.get);
      const save = auth.elevate(items.save);
      let row: RateRow | null = null;
      try {
        row = await get(NOAM_RATE_COLLECTION_ID, id);
      } catch (error) {
        if (!missingItem(error)) throw error;
      }
      const write = nextRateWrite(row, now, max, windowMs);
      if (!write) return false;
      await save(NOAM_RATE_COLLECTION_ID, {
        _id: id,
        count: write.count,
        windowStart: write.windowStart,
      });
      return true;
    },
  };
}
