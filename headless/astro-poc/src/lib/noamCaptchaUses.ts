/** Persistent insert-only replay protection. No token, payload, IP or secret is stored. */
import { auth } from '@wix/essentials';
import { collections, items } from '@wix/data';

export const CAPTCHA_USES_COLLECTION = 'NoamAiCaptchaUses';
const permissions = { insert: 'ADMIN', update: 'ADMIN', read: 'ADMIN', remove: 'ADMIN' } as const;
type Operations = {
  getCollection: (id: string, options: { consistentRead: true }) => Promise<any>;
  createCollection: (collection: any) => Promise<any>;
  insert: (collection: string, item: any) => Promise<any>;
};

function missingCollection(error: unknown): boolean {
  const code = String((error as any)?.code || (error as any)?.details?.applicationError?.code || '');
  const message = String((error as any)?.message || '');
  return /COLLECTION_NOT_FOUND|WDE0073/.test(code) || /collection.*(?:not found|does not exist)/i.test(message);
}

export function createWixCaptchaUseStore(operations?: Operations) {
  return {
    async consume(nonce: string, expiresAt: number): Promise<boolean> {
      if (!/^[0-9a-f-]{36}$/.test(nonce) || !Number.isSafeInteger(expiresAt)) return false;
      try {
        const ops = operations || {
          getCollection: auth.elevate(collections.getDataCollection),
          createCollection: auth.elevate(collections.createDataCollection),
          insert: auth.elevate(items.insert),
        };
        let collection;
        try {
          collection = await ops.getCollection(CAPTCHA_USES_COLLECTION, { consistentRead: true });
        } catch (error) {
          if (!missingCollection(error)) return false;
          collection = await ops.createCollection({
            _id: CAPTCHA_USES_COLLECTION, displayName: 'Noam AI CAPTCHA uses',
            fields: [{ key: 'expiresAt', type: 'NUMBER' }, { key: 'usedAt', type: 'NUMBER' }],
            permissions,
          });
        }
        // Never repair or relax a pre-existing collection's permissions automatically.
        if (!Object.entries(permissions).every(([key, value]) => collection?.permissions?.[key] === value)) return false;
        // insert() rejects an existing _id atomically; save()/upsert or get-then-save is unsafe here.
        const inserted = await ops.insert(CAPTCHA_USES_COLLECTION, { _id: nonce, expiresAt, usedAt: Date.now() });
        return inserted?._id === nonce;
      } catch {
        // No memory fallback: another Wix instance must observe the same spent nonce.
        return false;
      }
    },
  };
}
