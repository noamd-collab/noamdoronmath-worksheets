// M1 (V5-DESIGN §15): the PDF-only worksheet-wire/5 readiness rule and complete_draft.
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
const M1 = '20261125090000_teacher_generation_pdf_only_draft.sql';
const db = new PGlite();
const owner = '80da2957-9492-4a9d-babb-28ba70dedd12';
const teacher = '40000000-0000-4000-8000-000000000001';
const bucket = 'teacher-generation-private';
const CURRICULUM = '57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b';
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
async function as(role, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
  await db.exec('set role ' + role);
}
const google = sub => ({ sub, app_metadata: { provider: 'google' }, is_anonymous: false });
const ready = async document => (await query(
  'select public.noam_teacher_generation_draft_downloadable($1::jsonb) as value', [JSON.stringify(document)]))[0].value;

// D22, approved by Noam on 2026-11-25: the only steps a middle-path v5 render may leave as SKIP.
const D22 = ['pinned:emit_docx', 'pinned:catalog/landing', 'pinned:gate_sections G85–G92',
  ...['G85-section-volume', 'G86-terms', 'G87-subtopic-chronology', 'G88-level-parity', 'G89-catalog',
    'G92-section-structure'].map(gate => `pinned-gate:${gate}:sheet`)];
const pass = name => ({ name, status: 'PASS' });
const base = { version: 1, humanReviewRequired: true, authoringProfile: 'general-skill-source/v1',
  authorContract: 'worksheet-wire/5', artifacts: [{ kind: 'pdf', sha256: 'a'.repeat(64), bytes: 1000 }],
  questionsRequested: 20, questionsDelivered: 20, replaced: [] };
const middle = { ...base, automatedChecksPassed: false, renderingChecksPassed: false,
  skill: { name: 'middle', version: '7.2.0-noam', sha256: 'b'.repeat(64) },
  checks: [pass('levels-lint'), pass('middle-build'), ...D22.map(name => ({ name, status: 'SKIP' })), pass('atom-order')],
  notRun: [...D22, 'pinned-log:build_plus:G83:c'] };
const elementary = { ...base, automatedChecksPassed: true, renderingChecksPassed: true,
  skill: { name: 'elementary', version: '1.0.5-noam', sha256: 'c'.repeat(64) },
  checks: ['content-truth', 'pdf', 'worksheet', 'output-gates', 'house-gates', 'atom-order'].map(pass), notRun: [] };
const without = (document, key) => Object.fromEntries(Object.entries(document).filter(([name]) => name !== key));
const oneSkip = name => ({ ...middle, checks: [pass('middle-build'), { name, status: 'SKIP' }], notRun: [name] });
// An accepted draft that claims nothing as fully checked, so an added step is judged by its status alone.
const withStep = step => ({ ...elementary, automatedChecksPassed: false, renderingChecksPassed: false,
  checks: [...elementary.checks, step] });

const accepted = [
  ['middle draft whose only SKIPs are the nine D22 steps, each listed in notRun', middle],
  ['elementary draft, every step PASS, nothing left out', elementary],
  ['elementary draft with an unrun sub-check: nothing counts as fully checked',
    { ...elementary, automatedChecksPassed: false, renderingChecksPassed: false, notRun: ['pinned-log:check_worksheet:fonts'] }],
  ['middle draft, every step PASS, nothing left out',
    { ...middle, automatedChecksPassed: true, renderingChecksPassed: true, checks: [pass('middle-build'), pass('atom-order')], notRun: [] }],
  ['unreviewed-overlay flags with nothing left out', { ...elementary, automatedChecksPassed: false, renderingChecksPassed: false }],
  ...D22.map(name => [`single approved SKIP ${name}`, oneSkip(name)]),
];
const denied = [
  ['REVIEW step', { ...middle, checks: [...middle.checks, { name: 'didactic', status: 'REVIEW' }] }],
  ['FAIL step', { ...middle, checks: [...middle.checks, { name: 'atom-order', status: 'FAIL' }] }],
  ['unknown status', { ...middle, checks: [...middle.checks, { name: 'x', status: 'OK' }] }],
  ['lower-case status', { ...elementary, checks: [{ name: 'pdf', status: 'pass' }] }],
  ['missing status', { ...elementary, checks: [{ name: 'pdf' }] }],
  ['null status', { ...elementary, checks: [{ name: 'pdf', status: null }] }],
  ['step without a name', { ...elementary, checks: [{ status: 'PASS' }] }],
  ['step with a non-string name', { ...elementary, checks: [{ name: 7, status: 'PASS' }] }],
  ['step that is not an object', { ...elementary, checks: [1] }],
  ['null step', { ...elementary, checks: [null] }],
  ['empty checks', { ...elementary, checks: [] }],
  ['checks not an array', { ...elementary, checks: {} }],
  ['checks missing', without(elementary, 'checks')],
  ['SKIP on the elementary path', { ...oneSkip(D22[0]), skill: elementary.skill }],
  ['SKIP of a step outside D22', oneSkip('atom-order')],
  ['SKIP of a D22 look-alike (hyphen for the en dash)', oneSkip('pinned:gate_sections G85-G92')],
  ['SKIP of a D22 look-alike (trailing space)', oneSkip('pinned:emit_docx ')],
  ['SKIP of a D22 look-alike (case)', oneSkip('pinned:Emit_docx')],
  ['approved SKIP that notRun does not list', { ...oneSkip(D22[0]), notRun: [] }],
  ['approved SKIP listed under another name', { ...oneSkip(D22[0]), notRun: [D22[1]] }],
  ['notRun missing', without(middle, 'notRun')],
  ['notRun not an array', { ...middle, notRun: {} }],
  ['notRun with a non-string entry', { ...middle, notRun: [...D22, 1] }],
  ['no artifact', { ...middle, artifacts: [] }],
  ['two PDFs', { ...middle, artifacts: [base.artifacts[0], base.artifacts[0]] }],
  ['PDF and Word', { ...middle, artifacts: [base.artifacts[0], { kind: 'docx' }] }],
  ['Word only', { ...middle, artifacts: [{ kind: 'docx' }] }],
  ['artifact without a kind', { ...middle, artifacts: [{}] }],
  ['artifacts not an array', { ...middle, artifacts: { kind: 'pdf' } }],
  ['artifacts missing', without(middle, 'artifacts')],
  ['humanReviewRequired false', { ...middle, humanReviewRequired: false }],
  ['humanReviewRequired as text', { ...middle, humanReviewRequired: 'true' }],
  ['humanReviewRequired missing', without(middle, 'humanReviewRequired')],
  ['another authoring profile', { ...middle, authoringProfile: 'other' }],
  ['authoring profile missing', without(middle, 'authoringProfile')],
  ['unknown skill', { ...middle, skill: { name: 'high' } }],
  ['skill missing', without(middle, 'skill')],
  ['skill as text', { ...middle, skill: 'middle' }],
  ['automatedChecksPassed as text', { ...middle, automatedChecksPassed: 'false' }],
  ['automatedChecksPassed null', { ...middle, automatedChecksPassed: null }],
  ['automatedChecksPassed missing', without(middle, 'automatedChecksPassed')],
  ['renderingChecksPassed as text', { ...middle, renderingChecksPassed: 'false' }],
  ['renderingChecksPassed missing', without(middle, 'renderingChecksPassed')],
  ['fully checked claimed while steps were skipped', { ...middle, automatedChecksPassed: true, renderingChecksPassed: true }],
  ['automated PASS claimed while steps were skipped', { ...middle, automatedChecksPassed: true }],
  ['rendering PASS claimed while steps were skipped', { ...middle, renderingChecksPassed: true }],
  ['fully checked claimed while a sub-check did not run', { ...elementary, notRun: ['pinned-log:check_worksheet:fonts'] }],
  ['rendering PASS claimed while a sub-check did not run',
    { ...elementary, automatedChecksPassed: false, notRun: ['pinned-log:check_worksheet:fonts'] }],
  // From here each draft is one change away from an accepted one, and the clause it names is the
  // only one that refuses it: with that clause deleted from the rule the draft is accepted.
  ['no executed step: one approved SKIP listed in notRun and nothing else',
    { ...middle, checks: [{ name: D22[0], status: 'SKIP' }], notRun: [D22[0]] }],
  ['unknown skill, every step PASS', { ...elementary, skill: { name: 'high' } }],
  ['skill missing, every step PASS', without(elementary, 'skill')],
  ['skill as text, every step PASS', { ...elementary, skill: 'elementary' }],
  ['automatedChecksPassed as text, every step PASS and nothing left out', { ...elementary, automatedChecksPassed: 'true' }],
  ['automatedChecksPassed null, every step PASS and nothing left out', { ...elementary, automatedChecksPassed: null }],
  ['automatedChecksPassed missing, every step PASS and nothing left out', without(elementary, 'automatedChecksPassed')],
  ['renderingChecksPassed as text, every step PASS and nothing left out', { ...elementary, renderingChecksPassed: 'true' }],
  ['renderingChecksPassed null, every step PASS and nothing left out', { ...elementary, renderingChecksPassed: null }],
  ['renderingChecksPassed missing, every step PASS and nothing left out', without(elementary, 'renderingChecksPassed')],
  ['missing status beside passed steps, nothing claimed as fully checked', withStep({ name: 'x' })],
  ['null status beside passed steps, nothing claimed as fully checked', withStep({ name: 'x', status: null })],
  ['lower-case status beside passed steps, nothing claimed as fully checked', withStep({ name: 'x', status: 'pass' })],
  ['lower-case SKIP of an approved step listed in notRun',
    { ...middle, checks: [pass('middle-build'), { name: D22[0], status: 'skip' }], notRun: [D22[0]] }],
  // The same clauses, loosened instead of deleted: another case, a suffix, another JSON type, padding.
  ['skill name in another case, every step PASS', { ...elementary, skill: { name: 'Elementary' } }],
  ['skill name with a suffix, every step PASS', { ...elementary, skill: { name: 'middle2' } }],
  ['automatedChecksPassed as a number, every step PASS and nothing left out', { ...elementary, automatedChecksPassed: 1 }],
  ['renderingChecksPassed as a number, every step PASS and nothing left out', { ...elementary, renderingChecksPassed: 1 }],
  ['status with a trailing space beside passed steps, nothing claimed as fully checked', withStep({ name: 'x', status: 'PASS ' })],
  ...['REVIEW', 'FAIL'].map(status => [status + ' of an approved step listed in notRun',
    { ...middle, checks: [pass('middle-build'), { name: D22[0], status }], notRun: [D22[0]] }]),
];
// Results the rule decided before M1: hostile values, legacy PASS records, REVIEW drafts and
// look-alike contracts. M1 must not change a single answer for them.
const review = { authoringProfile: 'general-skill-source/v1', automatedChecksPassed: false,
  renderingChecksPassed: true, humanReviewRequired: true, checks: [pass('render'), { name: 'didactic', status: 'REVIEW' }] };
const legacy = [null, [], {}, true, 'true', 0, { automatedChecksPassed: true }, { automatedChecksPassed: true, checks: [] },
  { automatedChecksPassed: true, checks: [{ status: 'PASS' }] }, { automatedChecksPassed: true, checks: [{ status: 'FAIL' }] },
  { automatedChecksPassed: true, checks: [{ status: 'REVIEW' }] }, { automatedChecksPassed: true, checks: null },
  { automatedChecksPassed: true, checks: [{}] }, { automatedChecksPassed: 'true' }, review,
  { ...review, checks: [] }, { ...review, checks: [{ status: 'PASS' }, { status: 'FAIL' }] }, { ...review, checks: {} },
  { ...review, authoringProfile: 'other' }, { ...review, renderingChecksPassed: false }, { ...review, humanReviewRequired: false },
  { ...review, automatedChecksPassed: null },
  ...['worksheet-wire/6', 'worksheet-wire/5 ', 'worksheet-source/4', '', 5, null, ['worksheet-wire/5']].flatMap(authorContract =>
    [{ ...review, authorContract }, { ...middle, authorContract }, { ...elementary, authorContract }])];

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,raw_app_meta_data jsonb);
    create table auth.identities(user_id uuid references auth.users(id),provider text,provider_id text);
    insert into auth.users values('${owner}',now(),false,'{"provider":"google"}'),('${teacher}',now(),false,'{"provider":"google"}');
    insert into auth.identities values('${teacher}','google','synthetic-google-subject-1');
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create policy fixture_older_broad_read on storage.objects for select to anon,authenticated using(true);
  `);
  for (const name of ['20261112185430_teacher_generation_private_pilot.sql', '20261116153658_teacher_generation_review_draft_download.sql',
    '20261122040000_teacher_generation_owner_quota.sql', '20261122050000_teacher_generation_created_worksheets.sql',
    '20261122151819_teacher_generation_public_trial.sql']) await db.exec(await migration(name));
  const before = [];
  for (const document of legacy) before.push(await ready(document));
  const beforeV5 = [];
  for (const [, document] of accepted) beforeV5.push(await ready(document));
  const triggers = ['public.noam_teacher_generation_quota()', 'noam_teacher_trial.release_failure()'];
  const definition = async signature => (await query('select pg_get_functiondef($1::regprocedure) as value', [signature]))[0].value;
  const triggersBefore = [];
  for (const signature of triggers) triggersBefore.push(await definition(signature));
  const grants = async signature => (await query('select proacl::text as value from pg_proc where oid=$1::regprocedure', [signature]))[0].value;
  const grantsBefore = [];
  for (const signature of triggers) grantsBefore.push(await grants(signature));
  const m1 = await migration(M1);
  await db.exec(m1);

  await test('before M1 the middle PDF-only draft was refused (the reason for M1)', () => {
    assert.equal(beforeV5[0], false);
  });
  await test('M1 changes no answer for a result that is not worksheet-wire/5', async () => {
    assert.ok(before.includes(true) && before.includes(false));
    for (let i = 0; i < legacy.length; i++) assert.equal(await ready(legacy[i]), before[i], JSON.stringify(legacy[i]));
  });
  await test('a complete PDF-only worksheet-wire/5 draft is ready', async () => {
    for (const [name, document] of accepted) assert.equal(await ready(document), true, name);
  });
  await test('every other worksheet-wire/5 draft is refused, with false and never null or an error', async () => {
    for (const [name, document] of denied) assert.strictEqual(await ready(document), false, name);
  });
  await test('the SQL list of approved SKIPs is exactly runner.V5_NOT_RUN_ALLOWED', async () => {
    const quoted = text => [...text.matchAll(/'([^']*)'/g)].map(match => match[1]);
    const sql = quoted(m1.match(/c->>'name' in \(([\s\S]*?)\)/)[1]).sort();
    const runner = await readFile(path.join(root, 'tools/teacher-generation/runner.py'), 'utf8');
    const strings = quoted(runner.match(/V5_NOT_RUN_ALLOWED=frozenset\(\{([\s\S]*?)\}\)/)[1]).map(text => text.replace(/\\u2013/g, '–'));
    const template = strings.filter(text => text.includes('%s'));
    assert.equal(template.length, 1);
    const gates = strings.filter(text => /^G\d+-/.test(text));
    const python = [...strings.filter(text => !template.includes(text) && !gates.includes(text)),
      ...gates.map(gate => template[0].replace('%s', gate))].sort();
    assert.equal(python.length, 9);
    assert.deepEqual(sql, python);
    assert.deepEqual(sql, [...D22].sort());
  });
  await test('the rule stays a pure invoker predicate and the pair check is gone', async () => {
    const fn = (await query("select prosecdef,provolatile,proconfig from pg_proc where oid='public.noam_teacher_generation_draft_downloadable(jsonb)'::regprocedure"))[0];
    assert.equal(fn.prosecdef, false); assert.equal(fn.provolatile, 'i'); assert.deepEqual(fn.proconfig, ['search_path=""']);
    const grant = async (role, signature) => (await query("select has_function_privilege($1,$2,'EXECUTE') as value", [role, signature]))[0].value;
    assert.equal(await grant('anon', 'public.noam_teacher_generation_draft_downloadable(jsonb)'), false);
    assert.equal(await grant('authenticated', 'public.noam_teacher_generation_draft_downloadable(jsonb)'), true);
    const draft = 'noam_teacher_trial.complete_draft(uuid,uuid,jsonb)';
    const definer = (await query('select prosecdef,provolatile,proconfig from pg_proc where oid=$1::regprocedure', [draft]))[0];
    assert.equal(definer.prosecdef, true); assert.equal(definer.provolatile, 's'); assert.deepEqual(definer.proconfig, ['search_path=""']);
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await grant(role, draft), role === 'service_role', role);
    assert.equal((await query("select to_regprocedure('noam_teacher_trial.complete_pair(uuid,uuid,jsonb)') as value"))[0].value, null);
    assert.equal((await query("select count(*)::int as value from pg_proc where proname in ('complete_pair','complete_draft')"))[0].value, 1);
  });
  await test('the quota and release triggers keep their bodies and only call complete_draft where they called complete_pair', async () => {
    for (let i = 0; i < triggers.length; i++) {
      const after = await definition(triggers[i]);
      assert.equal(after.replace('complete_draft', 'complete_pair'), triggersBefore[i], triggers[i]);
      assert.notEqual(after, triggersBefore[i], triggers[i]);
      assert.equal(await grants(triggers[i]), grantsBefore[i], triggers[i]);
    }
  });

  // A trial teacher: the credit is kept only for a draft whose files exist.
  await db.exec(`insert into noam_teacher_trial.campaign(starts_at,ends_at,enabled)
    values(now()-interval '1 hour',now()-interval '1 hour'+interval '72 hours',true)`);
  await db.query("insert into public.noam_teacher_generation_workers(id,capabilities) values('primary',$1)",
    [JSON.stringify({ trialActorIsolation: 1, profile: 'general-skill-source/v1', curriculumSha256: CURRICULUM, acceptedIntakeVersions: [3] })]);
  let sequence = 0;
  const remaining = async () => (await query('select noam_teacher_trial.remaining(noam_teacher_trial.google_subject($1)) as value', [teacher]))[0].value;
  /** Enqueue as the server, claim as the worker, upload the given files, then report the draft. */
  async function finish(document, files) {
    const id = '50000000-0000-4000-8000-' + String(++sequence).padStart(12, '0');
    await as('service_role');
    await db.query(`insert into public.noam_teacher_generation_jobs(id,owner_id,request_key,request_hash,lesson)
      values($1,$2,gen_random_uuid(),repeat('a',64),'{}')`, [id, teacher]);
    await db.query("update public.noam_teacher_generation_jobs set status='running',phase='authoring' where id=$1", [id]);
    for (const kind of files) await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, `${teacher}/${id}/sheet.${kind}`]);
    const row = (await query(`update public.noam_teacher_generation_jobs set status='needs_review',phase='needs_review',result=$2
      where id=$1 returning status,phase,error_code,result is null as cleared`, [id, JSON.stringify(document)]))[0];
    return { id, ...row };
  }
  await test('a PDF-only worksheet-wire/5 draft with its PDF keeps the trial credit and is the teacher\'s to download', async () => {
    await as('service_role');
    assert.equal(await remaining(), 5);
    const job = await finish(middle, ['pdf']);
    assert.deepEqual({ status: job.status, cleared: job.cleared }, { status: 'needs_review', cleared: false });
    assert.equal(await remaining(), 4);
    await as('authenticated', google(teacher));
    assert.deepEqual((await query('select name from storage.objects order by name')).map(row => row.name), [`${teacher}/${job.id}/sheet.pdf`]);
    const history = await query('select id,formats from public.noam_teacher_created_worksheets()');
    assert.deepEqual(history, [{ id: job.id, formats: ['pdf'] }]);
    await as('authenticated', google(owner));
    assert.deepEqual(await query('select name from storage.objects'), []);
  });
  await test('a draft without its files, or one the rule refuses, fails and returns the credit', async () => {
    for (const [name, document, files] of [
      ['worksheet-wire/5 without a PDF', middle, []],
      ['worksheet-wire/5 with a Word file only', middle, ['docx']],
      ['worksheet-wire/5 with a REVIEW step', denied[0][1], ['pdf']],
      ['worksheet-wire/5 with an unapproved SKIP', oneSkip('atom-order'), ['pdf']],
      ['REVIEW draft with a PDF only (still a pair)', review, ['pdf']],
      ['REVIEW draft with a Word file only', review, ['docx']],
      ['PASS draft with a PDF only (still a pair)', { automatedChecksPassed: true, checks: [pass('render')] }, ['pdf']],
    ]) {
      const job = await finish(document, files);
      assert.deepEqual({ status: job.status, phase: job.phase, code: job.error_code, cleared: job.cleared },
        { status: 'failed', phase: 'failed', code: 'DRAFT_NOT_AVAILABLE', cleared: true }, name);
      assert.equal(await remaining(), 4, name);
    }
  });
  await test('the PDF+Word pair is still accepted for every other draft', async () => {
    for (const document of [review, { automatedChecksPassed: true, checks: [pass('render')] }]) {
      const before = await remaining();
      const job = await finish(document, ['pdf', 'docx']);
      assert.equal(job.status, 'needs_review');
      assert.equal(await remaining(), before - 1);
    }
  });
  await test('a job cannot be inserted as finished without a complete draft', async () => {
    await as('service_role');
    const id = '60000000-0000-4000-8000-000000000001';
    const insert = () => db.query(`insert into public.noam_teacher_generation_jobs(id,owner_id,request_key,request_hash,lesson,status,phase,result)
      values($1,$2,gen_random_uuid(),repeat('a',64),'{}','needs_review','needs_review',$3)`, [id, teacher, JSON.stringify(middle)]);
    const before = await remaining();
    await assert.rejects(insert(), error => error.code === '23514' && /GENERATION_INCOMPLETE_DRAFT/.test(error.message));
    assert.equal(await remaining(), before);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, `${teacher}/${id}/sheet.pdf`]);
    await insert();
    assert.equal(await remaining(), before - 1);
  });
} finally {
  await db.exec('reset role').catch(() => undefined);
  await db.close();
}
