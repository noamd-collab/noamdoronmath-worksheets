/**
 * Elementary (and general) progress isolation: marking one level must not
 * overwrite siblings in the same grade+topic. Keys are g{N}-t{N}-{a|b|c|one}.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Core = require('../public/noam-learning-core.js');

function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function mockClient(seedRows = []) {
  let rows = seedRows.slice();
  return {
    rows: () => rows,
    from() {
      let op = 'get';
      let body;
      let filters = [];
      let ignore = false;
      let single = false;
      const q = {
        select() {
          return q;
        },
        limit() {
          return q;
        },
        single() {
          single = true;
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        delete() {
          op = 'delete';
          return q;
        },
        upsert(v, o) {
          op = 'upsert';
          body = v;
          ignore = !!(o && o.ignoreDuplicates);
          return q;
        },
        async then(resolve, reject) {
          try {
            const match = (r) => filters.every(([k, v]) => r[k] === v);
            if (op === 'delete') {
              rows = rows.filter((r) => !match(r));
              return resolve({ data: [], error: null });
            }
            if (op === 'upsert') {
              const list = Array.isArray(body) ? body : [body];
              for (const r of list) {
                const i = rows.findIndex(
                  (x) => x.user_id === r.user_id && x.worksheet_id === r.worksheet_id
                );
                if (i >= 0 && ignore) continue;
                const value = { ...r, updated_at: '2026-09-25T12:00:00.000Z' };
                if (i >= 0) rows[i] = value;
                else rows.push(value);
              }
              const one = Array.isArray(body) ? body[0] : body;
              return resolve({
                data: single
                  ? rows.find(
                      (r) =>
                        r.user_id === one.user_id && r.worksheet_id === one.worksheet_id
                    )
                  : rows,
                error: null,
              });
            }
            return resolve({ data: rows.filter(match), error: null });
          } catch (e) {
            reject(e);
          }
        },
      };
      return q;
    },
  };
}

const elementarySiblings = [
  { id: 'g1-t1-a', g: 1, t: 1, l: 'a', label: 'רמה א׳', title: 'מונים בלי לפספס' },
  { id: 'g1-t1-b', g: 1, t: 1, l: 'b', label: 'רמה ב׳', title: 'מונים בלי לפספס' },
  { id: 'g1-t1-c', g: 1, t: 1, l: 'c', label: 'מצוינות', title: 'מונים בלי לפספס' },
];

describe('learning progress level isolation (elementary)', () => {
  it('rejects topic-only ids without a level suffix', () => {
    assert.equal(Core.isWorksheetId('g1-t1'), false);
    assert.equal(Core.isWorksheetId('g1-t1-a'), true);
    assert.equal(Core.isWorksheetId('g1-t1-c'), true);
  });

  it('guest: marking א׳ does not set ב׳ or מצוינות in the same topic', async () => {
    const e = Core.create({ catalog: elementarySiblings, storage: storage() });
    await e.change('g1-t1-a', 'completed');
    const rows = e.snapshot().rows;
    assert.equal(rows['g1-t1-a'].status, 'completed');
    assert.equal(rows['g1-t1-b'], undefined);
    assert.equal(rows['g1-t1-c'], undefined);
    await e.change('g1-t1-b', 'started');
    assert.equal(e.snapshot().rows['g1-t1-a'].status, 'completed');
    assert.equal(e.snapshot().rows['g1-t1-b'].status, 'started');
    assert.equal(e.snapshot().rows['g1-t1-c'], undefined);
  });

  it('account: upsert writes only the clicked worksheet_id (no sibling fan-out)', async () => {
    const client = mockClient();
    const e = Core.create({
      catalog: elementarySiblings,
      storage: storage(),
      client,
    });
    await e.setUser({ id: 'user-1', email: 't@example.com' });
    await e.change('g1-t1-c', 'review');
    const db = client.rows();
    assert.equal(db.length, 1);
    assert.equal(db[0].worksheet_id, 'g1-t1-c');
    assert.equal(db[0].status, 'review');
    assert.equal(e.snapshot().rows['g1-t1-a'], undefined);
    assert.equal(e.snapshot().rows['g1-t1-b'], undefined);
    assert.equal(e.snapshot().rows['g1-t1-c'].status, 'review');
    await e.change('g1-t1-a', 'completed');
    assert.equal(client.rows().length, 2);
    assert.equal(e.snapshot().rows['g1-t1-c'].status, 'review');
    assert.equal(e.snapshot().rows['g1-t1-a'].status, 'completed');
  });

  it('portal UI groups levels under a topic and binds controls per learning id', () => {
    const js = readFileSync('public/noam-learning.js', 'utf8');
    assert.ok(js.includes('topicCard'));
    assert.ok(js.includes('levelRow'));
    assert.ok(js.includes('dataset.level'));
    assert.ok(js.includes('עבור ') && js.includes('בלבד'));
    assert.ok(js.includes('Core.isWorksheetId(id)'));
  });

  it('live catalog keeps unique ids for elementary a/b/c of the same topic', () => {
    const raw = readFileSync('public/noam-learning-catalog.js', 'utf8');
    const cat = JSON.parse(
      raw.replace(/^[\s\S]*?NOAM_LEARNING_CATALOG\s*=\s*/, '').replace(/;?\s*$/, '')
    );
    const g1t1 = cat.filter((x) => x.g === 1 && x.t === 1);
    assert.equal(g1t1.length, 3);
    assert.deepEqual(
      g1t1.map((x) => x.id).sort(),
      ['g1-t1-a', 'g1-t1-b', 'g1-t1-c']
    );
    assert.equal(new Set(g1t1.map((x) => x.pdf)).size, 3);
  });
});
