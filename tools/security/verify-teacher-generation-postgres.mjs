// Synthetic in-memory Postgres only. No remote database, keys, student data or AI calls.
// Tested with @electric-sql/pglite 0.5.16. Set NOAM_PGLITE_MODULE to an installed dist/index.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { PGlite } = await import(process.env.NOAM_PGLITE_MODULE ? pathToFileURL(process.env.NOAM_PGLITE_MODULE).href : '@electric-sql/pglite');
const migration = await readFile(path.join(root, 'supabase/migrations/20261112185430_teacher_generation_private_pilot.sql'), 'utf8');
const db = new PGlite();
const owner = '80da2957-9492-4a9d-babb-28ba70dedd12';
const other = '33333333-3333-4333-8333-333333333333';
const jobId = '22222222-2222-4222-8222-222222222222';
const bucket = 'teacher-generation-private';
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
async function as(role, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
  await db.exec('set role ' + role);
}
const google = (sub = owner, extra = {}) => ({ sub, app_metadata: { provider: 'google' }, is_anonymous: false, ...extra });
async function denied(sql, values = [], code = '42501') {
  await assert.rejects(db.query(sql, values), error => error.code === code, sql);
}
async function resetJobs() {
  await as('postgres');
  await db.exec('truncate public.noam_teacher_generation_jobs');
}
async function insertJob(extra = {}) {
  const row = { id: jobId, owner_id: owner, request_key: crypto.randomUUID(), request_hash: 'a'.repeat(64), lesson: { version: 1 }, ...extra };
  const keys = Object.keys(row);
  return query(`insert into public.noam_teacher_generation_jobs(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(row));
}
async function oldState() {
  return {
    rows: await query('select * from public.fixture_existing_teacher_materials order by id'),
    policies: await query("select * from pg_policies where tablename='fixture_existing_teacher_materials' order by policyname"),
    constraints: await query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.fixture_existing_teacher_materials'::regclass order by conname"),
    privileges: await query("select grantee,privilege_type from information_schema.role_table_grants where table_name='fixture_existing_teacher_materials' order by grantee,privilege_type"),
    bucket: await query("select * from storage.buckets where id='existing-public'"),
    storage: await query("select * from storage.objects where bucket_id='existing-public' order by name"),
    storagePolicies: await query("select * from pg_policies where schemaname='storage' and policyname like 'existing_%' order by policyname"),
  };
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    insert into auth.users values('${owner}'),('${other}');
    create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated,service_role;
    grant all on storage.buckets to service_role;
    create policy existing_bucket_read on storage.objects for select to anon,authenticated using(bucket_id='existing-public');
    -- Deliberately broad historic rules: new restrictive boundaries must still hold.
    create policy existing_broad_read on storage.objects for select to anon,authenticated using(true);
    create policy existing_broad_insert on storage.objects for insert to anon,authenticated with check(true);
    create policy existing_broad_update on storage.objects for update to anon,authenticated using(true) with check(true);
    create policy existing_broad_delete on storage.objects for delete to anon,authenticated using(true);
    insert into storage.buckets values('existing-public','existing-public',true,100000,array['image/png']);
    insert into storage.objects(bucket_id,name) values('existing-public','keep.png');
    create table public.fixture_existing_teacher_materials(id text primary key,body text not null);
    insert into public.fixture_existing_teacher_materials values('historic','unchanged');
    alter table public.fixture_existing_teacher_materials enable row level security;
    create policy historic_teacher_read on public.fixture_existing_teacher_materials for select to authenticated using(true);
    grant select on public.fixture_existing_teacher_materials to authenticated;
    alter default privileges in schema public grant all on tables to public,anon,authenticated;
  `);
  const before = await oldState();
  await db.exec(migration);

  await test('migration preserves existing teacher rows, policies, constraints, grants and public storage', async () => {
    assert.deepEqual(await oldState(), before);
    const config = (await query('select * from storage.buckets where id=$1', [bucket]))[0];
    assert.equal(config.public, false); assert.equal(config.file_size_limit, 15728640);
    assert.deepEqual(config.allowed_mime_types, ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
    const rls = await query("select relname,relrowsecurity from pg_class where relname in ('noam_teacher_generation_jobs','noam_teacher_generation_workers') order by relname");
    assert.equal(rls.length, 2); assert.ok(rls.every(row => row.relrowsecurity));
  });

  await as('service_role');
  await insertJob();
  await db.exec("insert into public.noam_teacher_generation_workers(id,capabilities) values('primary','{\"topics\":[]}')");

  await test('anon cannot query or insert either pilot table', async () => {
    await as('anon');
    for (const table of ['noam_teacher_generation_jobs', 'noam_teacher_generation_workers']) {
      await denied('select * from public.' + table);
      await denied('insert into public.' + table + ' default values');
    }
  });

  await test('other Google user, anonymous auth, email auth and forged user_metadata see no jobs or health', async () => {
    for (const claims of [google(other), google(owner, { is_anonymous: true }),
      { sub: owner, app_metadata: { provider: 'email' }, user_metadata: { provider: 'google' } }, {}]) {
      await as('authenticated', claims);
      assert.deepEqual(await query('select * from public.noam_teacher_generation_jobs'), []);
      assert.deepEqual(await query('select * from public.noam_teacher_generation_workers'), []);
      await denied("insert into public.noam_teacher_generation_jobs(owner_id,request_key,request_hash,lesson) values($1,gen_random_uuid(),repeat('a',64),'{}')", [owner]);
    }
  });

  await test('owner can read but cannot bypass CAPTCHA with Data API insert, edit, delete, health writes or claim', async () => {
    await as('authenticated', google());
    assert.equal((await query('select * from public.noam_teacher_generation_jobs')).length, 1);
    assert.equal((await query('select * from public.noam_teacher_generation_workers')).length, 1);
    for (const sql of [
      "insert into public.noam_teacher_generation_jobs(owner_id,request_key,request_hash,lesson) values('" + owner + "',gen_random_uuid(),repeat('a',64),'{}')",
      "update public.noam_teacher_generation_jobs set status='failed'", 'delete from public.noam_teacher_generation_jobs',
      "update public.noam_teacher_generation_workers set capabilities='{}'", 'select * from public.claim_teacher_generation_job()',
    ]) await denied(sql);
    for (const functionName of ['noam_teacher_generation_quota()', 'claim_teacher_generation_job()']) {
      const privilege = await query("select has_function_privilege('authenticated',$1,'EXECUTE') allowed", ['public.' + functionName]);
      assert.equal(privilege[0].allowed, false);
    }
  });

  await test('service insert keeps fixed owner, idempotency, active-job quota and daily quota', async () => {
    await as('service_role');
    const current = (await query('select * from public.noam_teacher_generation_jobs'))[0];
    await assert.rejects(insertJob({ id: crypto.randomUUID(), owner_id: other }), error => error.code === '42501');
    await assert.rejects(insertJob({ id: crypto.randomUUID(), request_key: current.request_key }), error => error.code === '23505');
    await assert.rejects(insertJob({ id: crypto.randomUUID() }), error => error.code === 'PT429');
    await resetJobs(); await as('service_role');
    for (let i = 0; i < 5; i++) await insertJob({ id: crypto.randomUUID(), status: 'failed', phase: 'failed' });
    await assert.rejects(insertJob(), error => error.code === 'PT429');
    await db.exec("update public.noam_teacher_generation_jobs set created_at=now()-interval '25 hours'");
    assert.equal((await insertJob()).length, 1);
  });

  await test('only service claims one queued job, and expired running work fails without paid retry', async () => {
    await resetJobs(); await as('service_role'); await insertJob();
    const claimed = await query('select * from public.claim_teacher_generation_job()');
    assert.equal(claimed.length, 1); assert.equal(claimed[0].status, 'running'); assert.ok(claimed[0].lease_token);
    assert.deepEqual(await query('select * from public.claim_teacher_generation_job()'), []);
    await db.exec("update public.noam_teacher_generation_jobs set lease_until=now()-interval '1 minute'");
    assert.deepEqual(await query('select * from public.claim_teacher_generation_job()'), []);
    const expired = (await query('select * from public.noam_teacher_generation_jobs'))[0];
    assert.equal(expired.status, 'failed'); assert.equal(expired.error_code, 'WORKER_INTERRUPTED');
    assert.equal(expired.lease_token, null); assert.equal(expired.lease_until, null);
    for (const role of ['anon', 'authenticated']) { await as(role, google()); await denied('select * from public.claim_teacher_generation_job()'); }
    await as('postgres');
    const functions = await query("select proname,prosecdef,proconfig from pg_proc where proname in ('claim_teacher_generation_job','noam_teacher_generation_quota')");
    assert.ok(functions.every(fn => fn.prosecdef === false && fn.proconfig.some(x => x.startsWith('search_path='))));
  });

  await test('private storage exposes only exact checked PDF/Word paths to non-anonymous Google owner', async () => {
    await resetJobs(); await as('service_role');
    await insertJob({ status: 'needs_review', phase: 'needs_review', result: { automatedChecksPassed: true } });
    const paths = [`${owner}/${jobId}/sheet.pdf`, `${owner}/${jobId}/sheet.docx`, `${owner}/${jobId}/source.json`,
      `${owner}/${jobId}/nested/sheet.pdf`, `${other}/${jobId}/sheet.pdf`, `${owner}/33333333-3333-4333-8333-333333333333/sheet.pdf`];
    for (const name of paths) await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, name]);
    for (const [role, claims, count] of [['anon', {}, 0], ['authenticated', google(other), 0],
      ['authenticated', google(owner, { is_anonymous: true }), 0], ['authenticated', google(), 2]]) {
      await as(role, claims);
      assert.equal((await query("select name from storage.objects where bucket_id='existing-public'"))[0].name, 'keep.png',
        'new restriction must not require anon access to the private jobs table or hide other buckets');
      const rows = await query('select name from storage.objects where bucket_id=$1 order by name', [bucket]);
      assert.equal(rows.length, count);
      if (count) assert.deepEqual(rows.map(row => row.name).sort(), paths.slice(0, 2).sort());
      await denied('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, `${owner}/${jobId}/new.pdf`]);
      assert.equal((await query("update storage.objects set name='changed' where bucket_id=$1 returning name", [bucket])).length, 0);
      assert.equal((await query('delete from storage.objects where bucket_id=$1 returning name', [bucket])).length, 0);
    }
    for (const result of [{ automatedChecksPassed: false }, { automatedChecksPassed: 'true' }, { automatedChecksPassed: null }, {}]) {
      await as('service_role'); await db.query('update public.noam_teacher_generation_jobs set result=$1', [result]);
      await as('authenticated', google()); assert.deepEqual(await query('select name from storage.objects where bucket_id=$1', [bucket]), []);
    }
    await as('service_role'); await db.exec("update public.noam_teacher_generation_jobs set status='failed',phase='failed',result=null");
    await as('authenticated', google()); assert.deepEqual(await query('select name from storage.objects where bucket_id=$1', [bucket]), []);
  });

  await test('broad historic writes still work on another bucket but cannot move an object into the private bucket', async () => {
    for (const [role, claims] of [['anon', {}], ['authenticated', google(other)], ['authenticated', google()]]) {
      await as(role, claims);
      await db.query("insert into storage.objects(bucket_id,name) values('existing-public','temporary.png')");
      await denied("update storage.objects set bucket_id=$1 where bucket_id='existing-public' and name='temporary.png'", [bucket]);
      assert.equal((await query("update storage.objects set name='temporary-2.png' where bucket_id='existing-public' and name='temporary.png' returning name")).length, 1);
      assert.equal((await query("delete from storage.objects where bucket_id='existing-public' and name='temporary-2.png' returning name")).length, 1);
    }
  });

  await test('job invariants reject unbounded metadata, invalid hashes and inconsistent completion state', async () => {
    await resetJobs(); await as('service_role');
    for (const extra of [{ request_hash: 'bad' }, { lesson: 'not an object' }, { lesson: { huge: 'x'.repeat(16001) } },
      { status: 'needs_review', result: null }, { result: { automatedChecksPassed: true } },
      { status: 'needs_review', result: { huge: 'x'.repeat(32001) } }, { error_code: 'SQL: confidential' }]) {
      await assert.rejects(insertJob(extra), error => ['23514', '22P02'].includes(error.code));
    }
  });

  await as('postgres');
  await test('all old data remains untouched after the isolation tests', async () => assert.deepEqual(await oldState(), before));
} finally { await db.close(); }
