// Runs only an in-memory PostgreSQL instance: no credentials or network database.
// Install pinned @electric-sql/pglite@0.5.14 outside this checkout, then set
// NOAM_PGLITE_MODULE to its dist/index.js. No production SQL is executed here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const moduleName = process.env.NOAM_PGLITE_MODULE;
const { PGlite } = await import(moduleName ? pathToFileURL(moduleName).href : '@electric-sql/pglite');
const load = name => readFile(path.join(root, name), 'utf8');
const [fixture, exerciseSql, exerciseVerify, hintsSql, hintsVerify] = await Promise.all([
 load('tests/fixtures/ramzi-security-roles.sql'),
 load('learning/exercises-tables-rls.sql'),
 load('learning/verify-exercises-tables-rls.sql'),
 load('learning/ramzi-hints-schema.sql'),
 load('learning/verify-ramzi-hints-rls.sql'),
]);
const db = new PGlite();
const scalar = async sql => (await db.query(sql)).rows[0].value;
const rejectSql = async (sql, pattern) => {
 await assert.rejects(db.exec(sql), pattern);
 await db.exec('rollback');
};

try {
 await db.exec(fixture);
 await test('exercise ACL repair removes PUBLIC and independent column grants', async () => {
  assert.equal(await scalar("select has_column_privilege('anon','public.exercises_middle','full_solution','SELECT') as value"), true);
  await db.exec(exerciseSql);
  await db.exec(exerciseVerify);
  assert.equal(await scalar("select has_column_privilege('anon','public.exercises_middle','private_review','SELECT') as value"), false);
  assert.equal(await scalar("select has_column_privilege('authenticated','public.exercises_middle','full_solution','INSERT') as value"), false);
 });
 await test('rerunning repairs stale public grants without losing Home or service access', async () => {
  await db.exec('grant select(full_solution) on public.exercises_middle to public; grant select(private_review) on public.exercises_middle to authenticated');
  await db.exec(exerciseSql);
  await db.exec(exerciseSql);
  await db.exec(exerciseVerify);
 });
 await test('read-only verification rejects a column-only INSERT grant', async () => {
  await db.exec('grant insert(id) on public.exercises_middle to anon');
  await rejectSql(exerciseVerify, /Unexpected column grant/);
  await db.exec(exerciseSql);
  await db.exec(exerciseVerify);
 });
 await test('inherited private access fails closed instead of reporting success', async () => {
  await db.exec('create role legacy_reader; grant select(private_review) on public.exercises_middle to legacy_reader; grant legacy_reader to anon');
  await rejectSql(exerciseSql, /Unexpected column privileges/);
  await db.exec('revoke legacy_reader from anon');
  await db.exec(exerciseSql);
  await db.exec(exerciseVerify);
 });
 await test('hint schema reapplication removes private column and PUBLIC grants', async () => {
  await db.exec(hintsSql);
  await db.exec("insert into public.noam_ramzi_hints(exercise_id,hint_1,hint_2,hint_3,status,source,source_id,source_pdf_hash) values ('G7-T01-A-Q01א','רמז א','רמז ב','רמז ג','review','synthetic-test','fixture',repeat('a',32))");
  await db.exec('grant select(review_note) on public.noam_ramzi_hints to anon; grant select(status) on public.noam_ramzi_hints to public; grant update(hint_1) on public.noam_ramzi_hints to authenticated');
  await db.exec(hintsSql);
  await db.exec(hintsSql);
  await db.exec(hintsVerify);
  assert.equal(await scalar("select count(*)::int as value from public.noam_ramzi_hints"), 1);
 });
 await test('extra visitor read policies abort the hint transaction', async () => {
  await db.exec('create policy accidental_public_read on public.noam_ramzi_hints for select to public using(true)');
  await rejectSql(hintsSql, /Unreviewed visitor read policy/);
  await db.exec('drop policy accidental_public_read on public.noam_ramzi_hints');
  await db.exec('grant legacy_reader to anon; create policy accidental_inherited_read on public.noam_ramzi_hints for select to legacy_reader using(true)');
  await rejectSql(hintsSql, /Unreviewed visitor read policy/);
  await db.exec('drop policy accidental_inherited_read on public.noam_ramzi_hints; revoke legacy_reader from anon');
  await db.exec(hintsSql);
  await db.exec(hintsVerify);
 });
 await test('a missing elementary table is skipped without breaking the Home projection', async () => {
  await db.exec('drop table public.exercises_elementary');
  await db.exec(exerciseSql);
  await db.exec(exerciseVerify);
 });
} finally {
 await db.close();
}
