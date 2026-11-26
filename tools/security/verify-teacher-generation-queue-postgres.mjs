// Queue position and wait estimate (V5-DESIGN §15): counts about the caller's own job only.
// Synthetic in-memory Postgres only. No remote database, keys, student data or model calls.
// Pinned PGlite @electric-sql/pglite@0.5.14; set NOAM_PGLITE_MODULE to its dist/index.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { PGlite } = await import(process.env.NOAM_PGLITE_MODULE ? pathToFileURL(process.env.NOAM_PGLITE_MODULE).href : '@electric-sql/pglite');
const migration = name => readFile(path.join(root, 'supabase/migrations', name), 'utf8');
const db = new PGlite();
const owner = '80da2957-9492-4a9d-babb-28ba70dedd12';
const teachers = [1, 2, 3].map(n => `40000000-0000-4000-8000-00000000000${n}`);
const stranger = '40000000-0000-4000-8000-000000000009';
const jobs = [1, 2, 3].map(n => `70000000-0000-4000-8000-00000000000${n}`);
const CURRICULUM = '57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b';
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
async function as(role, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
  await db.exec('set role ' + role);
}
const google = (sub, extra = {}) => ({ sub, app_metadata: { provider: 'google' }, is_anonymous: false, ...extra });
const status = async (claims, job) => {
  await as('authenticated', claims);
  return (await query('select public.noam_teacher_generation_queue_status($1) as value', [job]))[0].value;
};
const beat = async () => { await as('postgres'); await db.exec("update public.noam_teacher_generation_workers set updated_at=now()"); };
// Who may reach the jobs table and the claim: table and column grants, row security, every policy.
const access = async () => ({
  table: await query("select relacl::text as acl,relrowsecurity,relforcerowsecurity from pg_class where oid='public.noam_teacher_generation_jobs'::regclass"),
  columns: await query("select attname,attacl::text as acl from pg_attribute where attrelid='public.noam_teacher_generation_jobs'::regclass and attacl is not null order by attname"),
  policies: await query('select schemaname,tablename,policyname,permissive,roles::text as roles,cmd,qual,with_check from pg_policies order by 1,2,3'),
  claim: await query("select proacl::text as acl from pg_proc where oid='public.claim_teacher_generation_job()'::regprocedure"),
});
// Every identity that is not the job's own signed-in Google teacher.
const hidden = async (job, teacher) => {
  for (const claims of [google(teachers.find(other => other !== teacher)), google(stranger), google(teacher, { is_anonymous: true }),
    { sub: teacher, app_metadata: { provider: 'email' }, user_metadata: { provider: 'google' } }, {}])
    assert.equal(await status(claims, job), null, JSON.stringify(claims));
};
// A finished draft that ran for `run` seconds and ended `ago` seconds ago.
const draft = (run, ago) => db.query(`insert into public.noam_teacher_generation_jobs(owner_id,request_key,request_hash,lesson,status,phase,result,started_at,updated_at)
  values($1,gen_random_uuid(),repeat('a',64),'{}','needs_review','needs_review','{}',now()-make_interval(secs=>$2),now()-make_interval(secs=>$3))`, [owner, ago + run, ago]);
// Moves every finished draft a day back with its run time intact, so the drafts added next are the latest.
const age = () => db.exec("update public.noam_teacher_generation_jobs set started_at=started_at-interval '1 day',updated_at=updated_at-interval '1 day' where status='needs_review'");

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,raw_app_meta_data jsonb);
    create table auth.identities(user_id uuid references auth.users(id),provider text,provider_id text);
    insert into auth.users select id::uuid,now(),false,'{"provider":"google"}' from unnest(array['${[owner, ...teachers, stranger].join("','")}']) id;
    insert into auth.identities select id::uuid,'google','synthetic-subject-'||id from unnest(array['${[...teachers, stranger].join("','")}']) id;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
  `);
  for (const name of ['20261112185430_teacher_generation_private_pilot.sql', '20261116153658_teacher_generation_review_draft_download.sql',
    '20261122040000_teacher_generation_owner_quota.sql', '20261122050000_teacher_generation_created_worksheets.sql',
    '20261122151819_teacher_generation_public_trial.sql', '20261125090000_teacher_generation_pdf_only_draft.sql']) await db.exec(await migration(name));
  const claimBefore = (await query("select pg_get_functiondef('public.claim_teacher_generation_job()'::regprocedure) as value"))[0].value;
  const accessBefore = await access();
  await db.exec(await migration('20261125093000_teacher_generation_queue_status.sql'));
  await db.exec(`insert into noam_teacher_trial.campaign(starts_at,ends_at,enabled)
    values(now()-interval '1 hour',now()-interval '1 hour'+interval '72 hours',true)`);
  await db.query("insert into public.noam_teacher_generation_workers(id,capabilities) values('primary',$1)",
    [JSON.stringify({ trialActorIsolation: 1, profile: 'general-skill-source/v1', curriculumSha256: CURRICULUM, acceptedIntakeVersions: [3] })]);
  await as('service_role');
  for (let i = 0; i < 3; i++) await db.query(`insert into public.noam_teacher_generation_jobs(id,owner_id,request_key,request_hash,lesson,created_at)
    values($1,$2,gen_random_uuid(),repeat('a',64),'{}',now()-make_interval(secs=>$3))`, [jobs[i], teachers[i], 30 - i * 10]);

  await test('the claim keeps its body and only adds started_at', async () => {
    const after = (await query("select pg_get_functiondef('public.claim_teacher_generation_job()'::regprocedure) as value"))[0].value;
    assert.equal(after.replace(',started_at=now()', ''), claimBefore);
    assert.notEqual(after, claimBefore);
  });
  await test('each teacher sees only the place and estimate of their own job', async () => {
    await beat();
    for (let i = 0; i < 3; i++) assert.deepEqual(await status(google(teachers[i]), jobs[i]),
      { status: 'queued', position: i + 1, etaSeconds: 240 * (i + 1) });
  });
  await test("another teacher's job, an unknown job and a signed-out identity get nothing", async () => {
    assert.equal(await status(google(teachers[0]), jobs[1]), null);
    assert.equal(await status(google(stranger), jobs[0]), null);
    assert.equal(await status(google(teachers[0]), '70000000-0000-4000-8000-0000000000ff'), null);
    for (const claims of [google(teachers[0], { is_anonymous: true }),
      { sub: teachers[0], app_metadata: { provider: 'email' }, user_metadata: { provider: 'google' } }, {}])
      assert.equal(await status(claims, jobs[0]), null);
    await as('anon', google(teachers[0]));
    await assert.rejects(db.query('select public.noam_teacher_generation_queue_status($1)', [jobs[0]]), error => error.code === '42501');
    await assert.rejects(db.query('select noam_teacher_trial.self_queue_status($1)', [jobs[0]]), error => error.code === '42501');
    await as('service_role');
    await assert.rejects(db.query('select noam_teacher_trial.self_queue_status($1)', [jobs[0]]), error => error.code === '42501');
  });
  await test('a claimed job runs at position 0 and the jobs behind it move up', async () => {
    await as('service_role');
    const claimed = await query('select id,status,started_at from public.claim_teacher_generation_job()');
    assert.equal(claimed.length, 1); assert.equal(claimed[0].id, jobs[0]); assert.ok(claimed[0].started_at instanceof Date);
    await beat();
    const running = await status(google(teachers[0]), jobs[0]);
    assert.equal(running.status, 'running'); assert.equal(running.position, 0);
    assert.ok(running.etaSeconds > 200 && running.etaSeconds <= 240, String(running.etaSeconds));
    assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'queued', position: 1, etaSeconds: 480 });
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 2, etaSeconds: 720 });
  });
  await test('without a live worker the estimate still assumes one, and an ended job reports 0', async () => {
    await as('postgres');
    await db.exec("update public.noam_teacher_generation_workers set updated_at=now()-interval '10 minutes'");
    assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'queued', position: 1, etaSeconds: 480 });
    await as('service_role');
    await db.query("update public.noam_teacher_generation_jobs set status='failed',phase='failed',error_code='WORKER_FAILED',lease_token=null,lease_until=null where id=$1", [jobs[0]]);
    assert.deepEqual(await status(google(teachers[0]), jobs[0]), { status: 'failed', position: 0, etaSeconds: 0 });
    assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'queued', position: 1, etaSeconds: 240 });
  });
  await test('five finished drafts replace the 240 s default with their median run time', async () => {
    await as('service_role');
    const runs = [80, 90, 100, 110, 600];
    for (let i = 0; i < runs.length; i++) {
      if (i === 4) assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'queued', position: 1, etaSeconds: 240 });
      await as('service_role');
      await db.query(`insert into public.noam_teacher_generation_jobs(owner_id,request_key,request_hash,lesson,status,phase,result,started_at,updated_at)
        values($1,gen_random_uuid(),repeat('a',64),'{}','needs_review','needs_review','{}',now()-make_interval(secs=>$2),now())`, [owner, runs[i]]);
    }
    assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'queued', position: 1, etaSeconds: 100 });
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 2, etaSeconds: 200 });
  });
  await test('only the signed-in caller can run it, through a definer that takes no identity argument', async () => {
    await as('postgres');
    const grant = async (role, signature) => (await query("select has_function_privilege($1,$2,'EXECUTE') as value", [role, signature]))[0].value;
    for (const signature of ['public.noam_teacher_generation_queue_status(uuid)', 'noam_teacher_trial.self_queue_status(uuid)'])
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await grant(role, signature), role === 'authenticated', signature + role);
    const props = async signature => (await query('select prosecdef,provolatile,proconfig,pronargs from pg_proc where oid=$1::regprocedure', [signature]))[0];
    assert.deepEqual(await props('public.noam_teacher_generation_queue_status(uuid)'), { prosecdef: false, provolatile: 's', proconfig: ['search_path=""'], pronargs: 1 });
    assert.deepEqual(await props('noam_teacher_trial.self_queue_status(uuid)'), { prosecdef: true, provolatile: 's', proconfig: ['search_path=""'], pronargs: 1 });
    assert.equal((await query("select has_table_privilege('authenticated','public.noam_teacher_generation_jobs','UPDATE') as value"))[0].value, false);
  });
  await test('the migration leaves every row-level policy, the grants of the jobs table and the grants of the claim as it found them', async () => {
    await as('postgres');
    assert.deepEqual(await access(), accessBefore);
    // The snapshot is not empty: one policy on the jobs table, row security on, the claim granted to the worker only.
    assert.deepEqual(accessBefore.policies.filter(policy => policy.tablename === 'noam_teacher_generation_jobs').map(policy => policy.policyname), ['generation_owner_read']);
    assert.equal(accessBefore.table[0].relrowsecurity, true);
    assert.match(accessBefore.claim[0].acl, /service_role=X\//);
    assert.doesNotMatch(accessBefore.claim[0].acl, /authenticated|anon|\{=|,=/);
  });
  await test("another teacher's running or failed job stays hidden, and a running job reports exactly three fields", async () => {
    await as('service_role');
    assert.equal((await query('select id from public.claim_teacher_generation_job()'))[0].id, jobs[1]);
    await hidden(jobs[1], teachers[1]);
    await hidden(jobs[0], teachers[0]);
    const { etaSeconds, ...rest } = await status(google(teachers[1]), jobs[1]);
    assert.deepEqual(rest, { status: 'running', position: 0 });
    assert.ok(etaSeconds > 60 && etaSeconds <= 100, String(etaSeconds));
  });
  await test('a running job whose lease has expired is not counted as busy', async () => {
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 200 });
    await as('service_role');
    await db.query("update public.noam_teacher_generation_jobs set lease_until=now()-interval '1 second' where id=$1", [jobs[1]]);
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 100 });
    await as('service_role');
    await db.query("update public.noam_teacher_generation_jobs set lease_until=now()+interval '20 minutes' where id=$1", [jobs[1]]);
  });
  await test('a running job past the typical run time reports 0, never a negative wait', async () => {
    await as('service_role');
    await db.query("update public.noam_teacher_generation_jobs set started_at=now()-interval '1 hour' where id=$1", [jobs[1]]);
    assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'running', position: 0, etaSeconds: 0 });
  });
  await test('a job already running when the migration lands (no started_at) still reports a wait between 0 and a typical run', async () => {
    await as('service_role');
    await db.query('update public.noam_teacher_generation_jobs set started_at=null,updated_at=now() where id=$1', [jobs[1]]);
    const { etaSeconds, ...rest } = await status(google(teachers[1]), jobs[1]);
    assert.deepEqual(rest, { status: 'running', position: 0 });
    assert.ok(Number.isInteger(etaSeconds) && etaSeconds > 0 && etaSeconds <= 100, String(etaSeconds));
  });
  await test('a finished draft reports exactly status, position 0 and etaSeconds 0, and only to its own teacher', async () => {
    await as('service_role');
    for (const kind of ['pdf', 'docx']) await db.query("insert into storage.objects(bucket_id,name) values('teacher-generation-private',$1)", [`${teachers[1]}/${jobs[1]}/sheet.${kind}`]);
    await db.query(`update public.noam_teacher_generation_jobs set status='needs_review',phase='needs_review',result='{"automatedChecksPassed":true}',lease_token=null,lease_until=null where id=$1`, [jobs[1]]);
    assert.deepEqual(await status(google(teachers[1]), jobs[1]), { status: 'needs_review', position: 0, etaSeconds: 0 });
    await hidden(jobs[1], teachers[1]);
  });
  await test('with more than 20 finished drafts only the 20 latest count', async () => {
    await as('service_role');
    await age();
    for (let i = 0; i < 21; i++) await draft(100, 3600);
    for (let i = 0; i < 20; i++) await draft(i < 10 ? 400 : 200, i < 10 ? 120 : 60);
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 300 });
    // "Latest" is the function's own ordering, not the order an index happens to return rows in.
    // discard plans: a cached plan of the function would ignore the two switches.
    await db.exec('set enable_indexscan=off; set enable_bitmapscan=off; discard plans');
    const unindexed = await status(google(teachers[2]), jobs[2]);
    await db.exec('reset enable_indexscan; reset enable_bitmapscan; discard plans');
    assert.deepEqual(unindexed, { status: 'queued', position: 1, etaSeconds: 300 });
  });
  await test('a finished draft stamped before its start is never a sample, not even as the latest one', async () => {
    await as('service_role');
    await draft(-50, 0);
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 300 });
  });
  await test('a run-time sample counts as at most the 1200 s lease, however late its row was last written', async () => {
    await as('service_role');
    await age();
    for (let i = 0; i < 20; i++) await draft(i < 10 ? 600 : 9000, 60);
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 900 });
  });
  await test('the cap is exactly 1200 s: twenty longer runs make a typical run of 1200 s', async () => {
    await as('service_role');
    await age();
    for (let i = 0; i < 20; i++) await draft(9000, 60);
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 1200 });
  });
  await test('the latest drafts are the last to finish, not the last to start', async () => {
    await as('service_role');
    await age();
    for (let i = 0; i < 20; i++) await draft(100, 500); // started 600 s ago
    for (let i = 0; i < 11; i++) await draft(1000, 10); // started earlier, finished later
    assert.deepEqual(await status(google(teachers[2]), jobs[2]), { status: 'queued', position: 1, etaSeconds: 1000 });
  });
  await test('two queued jobs created at the same instant get the distinct positions 1 and 2', async () => {
    await beat();
    await as('service_role');
    const tied = ['70000000-0000-4000-8000-0000000000b2', '70000000-0000-4000-8000-0000000000b1'];
    const at = new Date(Date.now() - 3600e3).toISOString();
    for (let i = 0; i < 2; i++) await db.query(`insert into public.noam_teacher_generation_jobs(id,owner_id,request_key,request_hash,lesson,created_at)
      values($1,$2,gen_random_uuid(),repeat('a',64),'{}',$3)`, [tied[i], teachers[i], at]);
    const places = [];
    for (let i = 0; i < 2; i++) places.push((await status(google(teachers[i]), tied[i])).position);
    assert.deepEqual(places.sort(), [1, 2]);
    assert.equal((await status(google(teachers[2]), jobs[2])).position, 3);
  });
} finally {
  await db.exec('reset role').catch(() => undefined);
  await db.close();
}
