import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { CAPTCHA_USES_COLLECTION, createWixCaptchaUseStore } from '../src/lib/noamCaptchaUses';

const permissions = { insert: 'ADMIN', update: 'ADMIN', read: 'ADMIN', remove: 'ADMIN' };
function database() {
  const rows = new Map<string, any>();
  const calls: string[] = [];
  let collection: any = null;
  const operations = {
    async getCollection(id: string, options: { consistentRead: true }) {
      calls.push('get'); assert.equal(id, CAPTCHA_USES_COLLECTION);
      assert.deepEqual(options, { consistentRead: true });
      if (!collection) throw Object.assign(new Error('Collection does not exist'), { code: 'COLLECTION_NOT_FOUND' });
      return collection;
    },
    async createCollection(input: any) {
      calls.push('create');
      assert.equal(input._id, CAPTCHA_USES_COLLECTION);
      assert.deepEqual(input.permissions, permissions);
      assert.deepEqual(input.fields, [{ key: 'expiresAt', type: 'NUMBER' }, { key: 'usedAt', type: 'NUMBER' }]);
      if (collection) throw new Error('Collection already exists');
      collection = input; return input;
    },
    async insert(id: string, item: any) {
      calls.push('insert'); assert.equal(id, CAPTCHA_USES_COLLECTION);
      if (rows.has(item._id)) throw new Error('Duplicate item _id');
      rows.set(item._id, item); return item;
    },
  };
  return { operations, calls, rows, collection: (value: any) => { collection = value; } };
}

test('the persistent replay store creates only an ADMIN collection and inserts an opaque fixed nonce without private request data', async () => {
  const db = database(); const store = createWixCaptchaUseStore(db.operations);
  const nonce = randomUUID(); const expiry = Date.now() + 120_000;
  assert.equal(await store.consume(nonce, expiry), true);
  assert.deepEqual(db.calls, ['get', 'create', 'insert']);
  const item = db.rows.get(nonce);
  assert.deepEqual(Object.keys(item).sort(), ['_id', 'expiresAt', 'usedAt']);
  assert.equal(item._id, nonce); assert.equal(item.expiresAt, expiry);
  assert.ok(Number.isSafeInteger(item.usedAt));
});

test('two independent server stores consume a shared nonce at most once; a later duplicate cannot overwrite it', async () => {
  const db = database(); db.collection({ permissions });
  const first = createWixCaptchaUseStore(db.operations); const second = createWixCaptchaUseStore(db.operations);
  const nonce = randomUUID(); const expiry = Date.now() + 120_000;
  assert.deepEqual((await Promise.all([first.consume(nonce, expiry), second.consume(nonce, expiry)])).sort(), [false, true]);
  const original = structuredClone(db.rows.get(nonce));
  assert.equal(await second.consume(nonce, expiry + 1000), false);
  assert.deepEqual(db.rows.get(nonce), original);
  assert.equal(db.rows.size, 1);
});

test('existing broader or missing permissions fail closed and are never changed', async () => {
  for (const permission of Object.keys(permissions)) {
    for (const value of ['ANYONE', 'SITE_MEMBER', undefined]) {
      const db = database(); db.collection({ permissions: { ...permissions, [permission]: value } });
      assert.equal(await createWixCaptchaUseStore(db.operations).consume(randomUUID(), Date.now() + 120_000), false);
      assert.deepEqual(db.calls, ['get']); assert.equal(db.rows.size, 0);
    }
  }
  const db = database(); db.collection({});
  assert.equal(await createWixCaptchaUseStore(db.operations).consume(randomUUID(), Date.now() + 120_000), false);
  assert.deepEqual(db.calls, ['get']);
});

test('storage failures and unexpected insert responses never allow a memory fallback', async () => {
  for (const failing of ['getCollection', 'createCollection', 'insert']) {
    const db = database(); if (failing !== 'createCollection') db.collection({ permissions });
    const operations = { ...db.operations, [failing]: async () => { throw new Error('Synthetic unavailable store'); } };
    const store = createWixCaptchaUseStore(operations);
    const nonce = randomUUID();
    assert.equal(await store.consume(nonce, Date.now() + 120_000), false);
    assert.equal(await store.consume(nonce, Date.now() + 120_000), false);
    assert.equal(db.rows.size, 0);
  }
  const db = database(); db.collection({ permissions });
  const store = createWixCaptchaUseStore({ ...db.operations, insert: async () => ({ _id: 'different' }) });
  assert.equal(await store.consume(randomUUID(), Date.now() + 120_000), false);
});

test('invalid nonce and timestamp inputs never contact storage', async () => {
  const db = database(); const store = createWixCaptchaUseStore(db.operations);
  for (const nonce of ['', 'human-token', 'x'.repeat(36), 'a'.repeat(500)]) assert.equal(await store.consume(nonce, Date.now()), false);
  for (const expiry of [NaN, Infinity, 1.5]) assert.equal(await store.consume(randomUUID(), expiry), false);
  assert.deepEqual(db.calls, []);
});
