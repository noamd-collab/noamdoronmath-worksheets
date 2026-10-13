/**
 * Shared rate-limit bucket for Noam AI.
 * A module Map is one Wix instance. Hits live in the Wix Data collection
 * NoamAiRateLimit, which this module creates if it is missing.
 * This is not the catalog CMS collection.
 */
import { auth } from '@wix/essentials';
import { collections, items } from '@wix/data';

export const NOAM_RATE_COLLECTION_ID = 'NoamAiRateLimit';

type HitItem = { _id?: string; bucket?: string; at?: number };

let ready: Promise<void> | null = null;

function elevateInsert() {
  return auth.elevate(items.insert);
}

function elevateQuery() {
  return auth.elevate(items.query);
}

function elevateRemove() {
  return auth.elevate(items.remove);
}

function elevateGetCollection() {
  return auth.elevate(collections.getDataCollection);
}

function elevateCreateCollection() {
  return auth.elevate(collections.createDataCollection);
}

async function ensureCollection(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const getCollection = elevateGetCollection();
      try {
        await getCollection(NOAM_RATE_COLLECTION_ID);
      } catch (error) {
        const createCollection = elevateCreateCollection();
        await createCollection({
          _id: NOAM_RATE_COLLECTION_ID,
          displayName: 'Noam AI rate limit',
          fields: [
            { key: 'bucket', type: 'TEXT' },
            { key: 'at', type: 'NUMBER' },
          ],
          permissions: {
            insert: 'ADMIN',
            update: 'ADMIN',
            remove: 'ADMIN',
            read: 'ADMIN',
          },
        });
      }
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function recentHits(key: string, cutoff: number): Promise<HitItem[]> {
  const query = elevateQuery();
  const found = await query(NOAM_RATE_COLLECTION_ID)
    .eq('bucket', key)
    .ge('at', cutoff)
    .limit(40)
    .find({ consistentRead: true });
  const rows = (found && found.items) || [];
  return rows.filter((row: HitItem) => Number(row.at) >= cutoff);
}

async function dropStale(key: string, cutoff: number): Promise<void> {
  const query = elevateQuery();
  const remove = elevateRemove();
  const found = await query(NOAM_RATE_COLLECTION_ID)
    .eq('bucket', key)
    .lt('at', cutoff)
    .limit(20)
    .find({ consistentRead: true });
  const rows = ((found && found.items) || []) as HitItem[];
  await Promise.all(rows.map((row) => (row._id ? remove(NOAM_RATE_COLLECTION_ID, row._id) : Promise.resolve(null))));
}

export function createWixRateBackend() {
  return {
    async take(key: string, now: number, max: number, windowMs: number): Promise<boolean> {
      await ensureCollection();
      const when = typeof now === 'number' ? now : Date.now();
      const cutoff = when - windowMs;
      await dropStale(key, cutoff);
      const insert = elevateInsert();
      await insert(NOAM_RATE_COLLECTION_ID, { bucket: String(key).slice(0, 120), at: when });
      const hits = await recentHits(key, cutoff);
      return hits.length <= max;
    },
  };
}
