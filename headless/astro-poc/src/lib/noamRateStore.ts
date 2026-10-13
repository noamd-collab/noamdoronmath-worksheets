/**
 * Shared rate-limit counter for Noam AI.
 * Wix Data find() did not return the rows inserted a moment earlier, so a
 * query of hit rows never reached 12. One item per hashed visitor, read with
 * get() and saved only when the count is still under the cap.
 * This is not the catalog CMS collection. The item id is a hash, not the IP.
 *
 * The site call runs as the visitor unless elevate is available. Read and
 * write are ANYONE so the counter still updates when elevate is missing.
 * remove stays ADMIN. get() uses a consistent read so the next request sees
 * the count that was just saved.
 */
import { auth } from '@wix/essentials';
import { collections, items } from '@wix/data';
import { nextRateWrite, rateBucketId } from '../../../../noam-ai/site-companion/rate-bucket.js';

export const NOAM_RATE_COLLECTION_ID = 'NoamAiRateLimit';

const RATE_PERMISSIONS = {
  insert: 'ANYONE',
  update: 'ANYONE',
  read: 'ANYONE',
  remove: 'ADMIN',
} as const;

type RateRow = { _id?: string; count?: number; windowStart?: number; data?: { count?: number; windowStart?: number } };
type CollectionShape = {
  fields?: Array<{ key?: string }>;
  permissions?: { insert?: string; update?: string; read?: string; remove?: string };
};

let ready: Promise<void> | null = null;

function errorText(error: unknown): string {
  const message = String(error && (error as { message?: string }).message || error || '');
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function elevatedMissing(error: unknown): boolean {
  return /elevated client|elevated authentication|Cannot find an elevated|Cannot find authentication/i.test(errorText(error));
}

function permissionDenied(error: unknown): boolean {
  return /permission|WDE0027|WDE0025|FORBIDDEN/i.test(errorText(error));
}

async function callEither<T>(elevated: () => Promise<T>, plain: () => Promise<T>): Promise<T> {
  try {
    return await elevated();
  } catch (error) {
    if (!elevatedMissing(error)) throw error;
    return await plain();
  }
}

function fieldKeys(collection: CollectionShape | null): Set<string> {
  const keys = new Set<string>();
  const fields = collection && Array.isArray(collection.fields) ? collection.fields : [];
  for (const field of fields) {
    if (field && field.key) keys.add(field.key);
  }
  return keys;
}

function permissionsOpen(collection: CollectionShape | null): boolean {
  const permissions = collection && collection.permissions;
  return !!permissions && permissions.insert === 'ANYONE' && permissions.update === 'ANYONE' && permissions.read === 'ANYONE';
}

async function ensureCollection(): Promise<void> {
  if (!ready) {
    ready = callEither(
      () => prepareCollection(true),
      () => prepareCollection(false),
    ).catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function prepareCollection(elevated: boolean): Promise<void> {
  const getCollection = elevated ? auth.elevate(collections.getDataCollection) : collections.getDataCollection;
  const addField = elevated ? auth.elevate(collections.createDataCollectionField) : collections.createDataCollectionField;
  const patchCollection = elevated ? auth.elevate(collections.patchDataCollection) : collections.patchDataCollection;
  const createCollection = elevated ? auth.elevate(collections.createDataCollection) : collections.createDataCollection;
  let collection: CollectionShape | null = null;
  try {
    collection = await getCollection(NOAM_RATE_COLLECTION_ID);
  } catch (error) {
    if (permissionDenied(error)) throw error;
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
  if (!keys.has('count')) {
    await addField(NOAM_RATE_COLLECTION_ID, { field: { key: 'count', type: 'NUMBER' } });
  }
  if (!keys.has('windowStart')) {
    await addField(NOAM_RATE_COLLECTION_ID, { field: { key: 'windowStart', type: 'NUMBER' } });
  }
  if (!permissionsOpen(collection)) {
    await patchCollection(NOAM_RATE_COLLECTION_ID, { permissions: RATE_PERMISSIONS });
  }
}

function missingItem(error: unknown): boolean {
  const message = errorText(error);
  return /not.?found|404|does not exist|WDE0073|ITEM_NOT_FOUND/i.test(message);
}

async function readCount(id: string): Promise<RateRow | null> {
  const read = (get: typeof items.get) => get(NOAM_RATE_COLLECTION_ID, id, { consistentRead: true });
  try {
    return await callEither(
      () => read(auth.elevate(items.get)),
      () => read(items.get),
    );
  } catch (error) {
    if (!missingItem(error)) throw error;
    return null;
  }
}

async function writeCount(id: string, count: number, windowStart: number): Promise<void> {
  const item = { _id: id, count, windowStart };
  const write = (save: typeof items.save) => save(NOAM_RATE_COLLECTION_ID, item);
  await callEither(
    () => write(auth.elevate(items.save)),
    () => write(items.save),
  );
}

export function createWixRateBackend() {
  return {
    async take(key: string, now: number, max: number, windowMs: number): Promise<{ ok: boolean; backend: 'wix'; error: string }> {
      await ensureCollection();
      const id = rateBucketId(key);
      let row: RateRow | null = null;
      try {
        row = await readCount(id);
      } catch (error) {
        if (!permissionDenied(error)) throw error;
        ready = null;
        await ensureCollection();
        row = await readCount(id);
      }
      const write = nextRateWrite(row, now, max, windowMs);
      if (!write) return { ok: false, backend: 'wix', error: '' };
      await writeCount(id, write.count, write.windowStart);
      return { ok: true, backend: 'wix', error: '' };
    },
  };
}
