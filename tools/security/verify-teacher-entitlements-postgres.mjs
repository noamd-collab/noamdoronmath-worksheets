// Runs only an in-memory PostgreSQL instance: no credentials and no network database.
// Install pinned @electric-sql/pglite@0.5.14 outside this checkout, then set
// NOAM_PGLITE_MODULE to its dist/index.js. The migration under test is
// supabase/migrations/20261126020000_teacher_entitlements.sql.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const moduleName = process.env.NOAM_PGLITE_MODULE;
const { PGlite } = await import(moduleName ? pathToFileURL(moduleName).href : '@electric-sql/pglite');
const migration = await readFile(
  path.join(root, 'supabase/migrations/20261126020000_teacher_entitlements.sql'),
  'utf8'
);

const db = new PGlite();
const firstValue = (row) => (row.value !== undefined ? row.value : Object.values(row)[0]);
const scalar = async (sql) => firstValue((await db.query(sql)).rows[0]);
const json = async (sql) => {
  const value = await scalar(sql);
  return typeof value === 'string' ? JSON.parse(value) : value;
};

const SECRET = 'test-secret-0123456789abcdefghijklmnopqrstuvwxyz';
const OWNER = '80da2957-9492-4a9d-babb-28ba70dedd12';
const BUYER = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';

const asUser = async (id, email) => {
  const claims = JSON.stringify({
    sub: id,
    email,
    is_anonymous: false,
    app_metadata: { provider: 'google' },
  }).replace(/'/g, "''");
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false)`);
};
const asAnon = async () => db.exec("select set_config('request.jwt.claims', '', false)");

// Supabase provides these; PGlite does not.
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
`);

await db.exec(migration);

await test('the table, its indexes and RLS exist after the migration', async () => {
  await db.exec('reset role');
  assert.equal(
    await scalar("select count(*)::int as value from pg_tables where schemaname='noam_teacher_access' and tablename='entitlements'"),
    1
  );
  assert.equal(
    await scalar("select relrowsecurity as value from pg_class where oid='noam_teacher_access.entitlements'::regclass"),
    true
  );
});

await test('grant refuses to run before an operator installs the secret', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  await assert.rejects(
    db.query("select public.noam_teacher_access_grant('x','PAY-0001','buyer@example.com','monthly',30,1800)"),
    /GRANT_SECRET_MISSING/
  );
  await db.exec('reset role');
});

await db.exec(`insert into noam_teacher_access.grant_secret (secret) values ('${SECRET}')`);

await test('an unknown secret cannot create an entitlement', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  await assert.rejects(
    db.query("select public.noam_teacher_access_grant('wrong','PAY-0001','buyer@example.com','monthly',30,1800)"),
    /GRANT_SECRET_INVALID/
  );
  await db.exec('reset role');
  assert.equal(await scalar('select count(*)::int as value from noam_teacher_access.entitlements'), 0);
});

await test('a paid monthly transaction grants thirty days exactly once', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  const first = await json(
    `select public.noam_teacher_access_grant('${SECRET}','PAY-0001','Buyer@Example.com','monthly',30,1800)`
  );
  assert.equal(first.granted, true);
  assert.equal(first.duplicate, false);
  const again = await json(
    `select public.noam_teacher_access_grant('${SECRET}','PAY-0001','buyer@example.com','monthly',30,1800)`
  );
  assert.equal(again.granted, false);
  assert.equal(again.duplicate, true);
  await db.exec('reset role');
  assert.equal(await scalar('select count(*)::int as value from noam_teacher_access.entitlements'), 1);
  assert.equal(
    await scalar("select days as value from noam_teacher_access.entitlements where payment_id='PAY-0001'"),
    30
  );
  assert.equal(
    await scalar("select email as value from noam_teacher_access.entitlements where payment_id='PAY-0001'"),
    'buyer@example.com'
  );
});

await test('a price that does not match the plan is refused', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  await assert.rejects(
    db.query(`select public.noam_teacher_access_grant('${SECRET}','PAY-0002','x@example.com','yearly',365,1800)`),
    /PLAN_TERMS_MISMATCH/
  );
  await assert.rejects(
    db.query(`select public.noam_teacher_access_grant('${SECRET}','PAY-0002','x@example.com','weekly',7,500)`),
    /PLAN_UNKNOWN/
  );
  await db.exec('reset role');
});

await test('clients cannot read the entitlement table directly', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  await assert.rejects(
    db.query('select * from noam_teacher_access.entitlements'),
    /permission denied/
  );
  await db.exec('reset role');
  await db.exec('set role authenticated');
  await assert.rejects(
    db.query('select * from noam_teacher_access.entitlements'),
    /permission denied/
  );
  await db.exec('reset role');
});

await test('a buyer sees an active entitlement and can bind it to the Google account', async () => {
  await db.exec('reset role');
  await db.exec(`insert into auth.users (id) values ('${BUYER}')`);
  await asUser(BUYER, 'buyer@example.com');
  await db.exec('set role authenticated');
  const before = await json('select public.noam_teacher_access_status()');
  assert.equal(before.active, true);
  assert.equal(before.plan, 'monthly');
  const bound = await json('select public.noam_teacher_access_bind()');
  assert.equal(bound.active, true);
  await db.exec('reset role');
  assert.equal(
    await scalar(`select user_id as value from noam_teacher_access.entitlements where payment_id='PAY-0001'`),
    BUYER
  );
});

await test('a different Google account does not inherit the purchase', async () => {
  await db.exec('reset role');
  await db.exec(`insert into auth.users (id) values ('${OTHER}')`);
  await asUser(OTHER, 'someone.else@example.com');
  await db.exec('set role authenticated');
  const status = await json('select public.noam_teacher_access_status()');
  assert.equal(status.active, false);
  assert.equal(status.plan, null);
  await db.exec('reset role');
});

await test('an expired entitlement reports inactive', async () => {
  await db.exec('reset role');
  await db.exec(`
    insert into noam_teacher_access.entitlements
      (payment_id, email, plan, days, amount_agorot, starts_at, expires_at)
    values ('PAY-OLD','other@example.com','monthly',30,1800,
            statement_timestamp() - interval '40 days', statement_timestamp() - interval '10 days')
  `);
  await asUser(OTHER, 'other@example.com');
  await db.exec('set role authenticated');
  const status = await json('select public.noam_teacher_access_status()');
  assert.equal(status.active, false);
  await db.exec('reset role');
});

await test('a refund revokes access immediately and keeps the row', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  const revoked = await json(
    `select public.noam_teacher_access_revoke('${SECRET}','PAY-0001','refunded')`
  );
  assert.equal(revoked.revoked, true);
  const twice = await json(
    `select public.noam_teacher_access_revoke('${SECRET}','PAY-0001','refunded')`
  );
  assert.equal(twice.revoked, false);
  await db.exec('reset role');
  await asUser(BUYER, 'buyer@example.com');
  await db.exec('set role authenticated');
  const status = await json('select public.noam_teacher_access_status()');
  assert.equal(status.active, false);
  await db.exec('reset role');
  assert.equal(
    await scalar("select count(*)::int as value from noam_teacher_access.entitlements where payment_id='PAY-0001'"),
    1
  );
});

await test('the owner account is not special-cased here', async () => {
  await db.exec('reset role');
  await asUser(OWNER, 'noamd@noamdoronmath.co.il');
  await db.exec('set role authenticated');
  const status = await json('select public.noam_teacher_access_status()');
  assert.equal(status.active, false);
  await db.exec('reset role');
});
