import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const Core = require('../public/noam-learning-core.js');
type Row = { worksheet_id: string; status: string; updated_at: string };
type Query = { table: string; user: string; after: string; order: string; ascending: boolean; limit: number };
type Result = { data?: Row[]; error?: Error | null };
const time = '2026-11-07T00:00:00.000Z';
function rows(count: number, prefix = 'g1-t'): Row[] {
  return Array.from({ length: count }, (_, i) => ({ worksheet_id: prefix + String(i + 1).padStart(5, '0') + '-b', status: 'review', updated_at: time }));
}
function storage(initial: Record<string, unknown> = {}) {
  let value = JSON.stringify(initial);
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; }, removeItem: () => { value = '{}'; } };
}
function client(fetchPage: (query: Query) => Result | Promise<Result>) {
  const calls: Query[] = [];
  return { calls, from(table: string) {
    const query: Query = { table, user: '', after: '', order: '', ascending: false, limit: 0 };
    const api = {
      select(fields: string) { assert.equal(fields, 'worksheet_id,status,updated_at'); return api; },
      eq(field: string, value: string) { assert.equal(field, 'user_id'); query.user = value; return api; },
      order(field: string, options: { ascending: boolean }) { query.order = field; query.ascending = options.ascending; return api; },
      limit(value: number) { query.limit = value; return api; },
      gt(field: string, value: string) { assert.equal(field, 'worksheet_id'); query.after = value; return api; },
      then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
        calls.push({ ...query });
        return Promise.resolve().then(() => fetchPage(query)).then(resolve, reject);
      },
    };
    return api;
  } };
}
function engine(data: Row[], db: ReturnType<typeof client>, local = storage()) {
  return Core.create({ catalog: data.map(row => ({ id: row.worksheet_id })), storage: local, client: db });
}

test('all 1,471 legacy and edition progress rows load with account filtering on every page', async () => {
  const data = rows(1471);
  const db = client(q => ({ data: data.filter(r => r.worksheet_id > q.after).slice(0, q.limit), error: null }));
  const core = engine(data, db);
  await core.setUser({ id: 'synthetic-user' });
  assert.equal(core.snapshot().cloudReady, true);
  assert.deepEqual(Object.keys(core.snapshot().rows), data.map(r => r.worksheet_id));
  assert.equal(core.snapshot().rows[data[1470].worksheet_id].status, 'review');
  assert.equal(db.calls.length, 4);
  for (const q of db.calls) {
    assert.equal(q.table, 'noam_learning_progress'); assert.equal(q.user, 'synthetic-user');
    assert.equal(q.order, 'worksheet_id'); assert.equal(q.ascending, true); assert.equal(q.limit, 500);
  }
});

test('a smaller server page cap does not truncate the account', async () => {
  const data = rows(5);
  const db = client(q => ({ data: data.filter(r => r.worksheet_id > q.after).slice(0, 2) }));
  const core = engine(data, db); await core.setUser({ id: 'synthetic-user' });
  assert.equal(Object.keys(core.snapshot().rows).length, 5);
  assert.equal(db.calls.length, 4);
});

test('a failed later page never publishes partial progress', async () => {
  const data = rows(501);
  const db = client(q => q.after ? { error: new Error('offline') } : { data: data.slice(0, 500) });
  const core = engine(data, db);
  await assert.rejects(core.setUser({ id: 'synthetic-user' }), /offline/);
  assert.equal(core.snapshot().cloudReady, false);
  assert.deepEqual(core.snapshot().rows, {});
});

test('repeated pages fail instead of looping or silently losing rows', async () => {
  const data = rows(2), db = client(() => ({ data })), core = engine(data, db);
  await assert.rejects(core.setUser({ id: 'synthetic-user' }), /INVALID_PROGRESS_PAGE/);
  assert.equal(db.calls.length, 2);
  assert.equal(core.snapshot().cloudReady, false);
});

test('switching accounts while a page is pending discards that account read', async () => {
  const a = rows(501), b = rows(1, 'g2-t');
  let release!: (value: Result) => void, started!: () => void;
  const secondStarted = new Promise<void>(resolve => { started = resolve; });
  const pendingPage = new Promise<Result>(resolve => { release = resolve; });
  const db = client(q => {
    if (q.user === 'user-b') return { data: q.after ? [] : b };
    if (!q.after) return { data: a.slice(0, 500) };
    started(); return pendingPage;
  });
  const core = engine([...a, ...b], db), first = core.setUser({ id: 'user-a' });
  await secondStarted;
  await core.setUser({ id: 'user-b' });
  release({ data: a.slice(500) }); await first;
  assert.equal(core.snapshot().user.id, 'user-b');
  assert.deepEqual(Object.keys(core.snapshot().rows), [b[0].worksheet_id]);
  assert.equal(db.calls.filter(q => q.user === 'user-a').length, 2);
});

test('guest data is bounded by known catalog identities rather than an arbitrary 2,000-row prefix', () => {
  const data = rows(2005), saved: Record<string, unknown> = { unknown: { status: 'completed', updated_at: time } };
  for (const r of data) saved[r.worksheet_id] = { status: r.status, updated_at: r.updated_at };
  const core = Core.create({ catalog: data.map(r => ({ id: r.worksheet_id })), storage: storage(saved) });
  assert.equal(core.snapshot().guestCount, 2005);
  assert.equal(core.snapshot().rows[data[2004].worksheet_id].status, 'review');
  assert.equal(core.snapshot().rows.unknown, undefined);
});
