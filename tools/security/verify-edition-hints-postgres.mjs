// In-memory synthetic database only. No service keys, remote URL or learner rows.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {PGlite}=await import(process.env.NOAM_PGLITE_MODULE ? pathToFileURL(process.env.NOAM_PGLITE_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();
const sql=await readFile(path.join(root,'supabase/migrations/20261107200314_worksheet_editions_and_bound_hints.sql'),'utf8');
const query=async s=>(await db.query(s)).rows;
const denied=async s=>{await assert.rejects(db.exec(s));await db.exec('reset role');};
const publicColumns='edition_id,exercise_id,source_pdf_hash,source_pdf_sha256,canonical_source_sha256,canonical_question_sha256,canonical_item_id,source_exercise_sha256,hint_1,hint_2,hint_3,status';
const binding={edition_id:'fixture-v1',exercise_id:'G1-T05-B-Q01א',source_pdf_hash:'a'.repeat(32),source_pdf_sha256:'b'.repeat(64),canonical_source_sha256:'c'.repeat(64),canonical_question_sha256:'d'.repeat(64),canonical_item_id:'fixture-q1-i1',source_exercise_sha256:'e'.repeat(64),hint_1:'רמז ראשון',hint_2:'רמז שני',hint_3:'רמז שלישי',status:'review',review_reference:null};
const review={path:'synthetic/test-only-review.json',sha256:'f'.repeat(64),reviewerId:'test-reviewer',authorId:'test-author'};
async function insert(extra={}){const row={...binding,...extra},keys=Object.keys(row);return db.query(`insert into public.noam_worksheet_edition_hints(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));}
async function oldState(){return {policies:await query("select * from pg_policies where tablename in ('noam_learning_worksheets','noam_learning_progress','noam_ramzi_hints') order by tablename,policyname"),constraints:await query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid in ('public.noam_learning_progress'::regclass,'public.noam_ramzi_hints'::regclass) order by conname"),worksheets:await query('select * from public.noam_learning_worksheets order by worksheet_id'),progress:await query('select * from public.noam_learning_progress order by user_id'),hints:await query('select * from public.noam_ramzi_hints')};}
try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('fixture.uid',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create table public.noam_learning_worksheets(worksheet_id text primary key constraint noam_learning_worksheets_worksheet_id_check check(worksheet_id ~ '^g[1-9]-t[0-9]+-(a|b|c|one)$'));
 create table public.noam_learning_progress(user_id uuid not null references auth.users(id) on delete cascade,worksheet_id text not null references public.noam_learning_worksheets(worksheet_id),status text not null check(status in ('started','completed','review')),updated_at timestamptz not null default now(),primary key(user_id,worksheet_id));
 create table public.noam_ramzi_hints(exercise_id text primary key,hint_1 text not null,hint_2 text not null,hint_3 text not null,status text not null default 'review',source_pdf_hash text not null,review_note text);
 alter table public.noam_learning_worksheets enable row level security;
 alter table public.noam_learning_progress enable row level security;
 alter table public.noam_ramzi_hints enable row level security;
 create policy learning_catalog_read on public.noam_learning_worksheets for select to authenticated using(true);
 create policy learning_own_select on public.noam_learning_progress for select to authenticated using((select auth.uid())=user_id);
 create policy learning_own_insert on public.noam_learning_progress for insert to authenticated with check((select auth.uid())=user_id);
 create policy learning_own_update on public.noam_learning_progress for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
 create policy learning_own_delete on public.noam_learning_progress for delete to authenticated using((select auth.uid())=user_id);
 create policy ramzi_hints_verified_read on public.noam_ramzi_hints for select to anon,authenticated using(status='verified');
 insert into public.noam_learning_worksheets values ('g9-t21-a'),('g9-t21-b'),('g9-t21-c'),('g1-t5-b');
 insert into auth.users values ('00000000-0000-0000-0000-000000000001');
 insert into public.noam_learning_progress(user_id,worksheet_id,status) values ('00000000-0000-0000-0000-000000000001','g9-t21-a','completed');
 insert into public.noam_ramzi_hints values ('G1-T05-B-Q01א','ישן א','ישן ב','ישן ג','verified',repeat('a',32),'private synthetic old note');
 alter default privileges in schema public grant all on tables to public,anon,authenticated;
 `);
 const before=await oldState();
 await db.exec(sql);
 await test('migration preserves historic catalog IDs, learner FK/rows and all old policies and hints',async()=>assert.deepEqual(await oldState(),before));
 await test('learning identities add c2 and exact 1–64 edition IDs without broadening grades or levels',async()=>{
  for(const id of ['g8-t43-c2','g1-t5-b-e-x','g1-t5-b-e-'+ 'a'.repeat(64)])await db.query('insert into public.noam_learning_worksheets values($1)',[id]);
  for(const id of ['g0-t5-b','g10-t5-b','g1-t5-d','g1-t5-b-e-','g1-t5-b-e-legacy','g1-t5-b-e-Upper','g1-t5-b-e-'+ 'a'.repeat(65)])await assert.rejects(db.query('insert into public.noam_learning_worksheets values($1)',[id]));
 });
 await insert();
 await insert({edition_id:'fixture-v2',source_pdf_hash:'1'.repeat(32),status:'verified',review_reference:review});
 await test('same exercise can exist across editions but PDF+exercise and edition+item stay unique',async()=>{
  await assert.rejects(insert({edition_id:'fixture-v3',source_pdf_hash:'a'.repeat(32)}));
  await assert.rejects(insert({exercise_id:'G1-T05-B-Q02א'}));
  await assert.rejects(insert({canonical_item_id:'another-item'}));
 });
 await test('malformed bindings, incomplete hints and absent/private self-review references are rejected',async()=>{
  const unique={edition_id:'invalid-test',source_pdf_hash:'2'.repeat(32)};
  for(const bad of [{edition_id:'legacy'},{edition_id:'X'},{edition_id:'line\n'},{source_pdf_hash:'a'.repeat(32)+'\n'},{edition_id:'a'.repeat(65)},{source_pdf_sha256:null},{canonical_question_sha256:'bad'},{canonical_item_id:''},{source_exercise_sha256:'b'.repeat(63)},{hint_1:''},{hint_2:' '.repeat(3)},{hint_3:'x'.repeat(601)},{status:'draft'},{status:'verified'},{status:'verified',review_reference:{}},{status:'verified',review_reference:{...review,reviewerId:'test-author'}}])await assert.rejects(insert({...unique,...bad}));
 });
 for(const role of ['anon','authenticated']){
  await test(role+' reads only verified public columns, not private evidence or writes',async()=>{
   await db.exec('set role '+role);
   assert.equal((await query("select edition_id from public.noam_worksheet_edition_hints where status='review'")).length,0);
   const rows=await query('select '+publicColumns+' from public.noam_worksheet_edition_hints');assert.equal(rows.length,1);assert.equal(rows[0].edition_id,'fixture-v2');
   await denied('select * from public.noam_worksheet_edition_hints');
   for(const sql of ['select review_reference from public.noam_worksheet_edition_hints','select updated_at from public.noam_worksheet_edition_hints',"update public.noam_worksheet_edition_hints set hint_1='changed'","delete from public.noam_worksheet_edition_hints","insert into public.noam_worksheet_edition_hints(edition_id) values('bad')"]){await db.exec('set role '+role);await denied(sql);}
  });
 }
 await test('service role can review rows; visitors never see review rows even with an explicit filter',async()=>{
  await db.exec('set role service_role');assert.equal((await query('select review_reference from public.noam_worksheet_edition_hints')).length,2);
  await db.query("update public.noam_worksheet_edition_hints set status='verified',review_reference=$1 where edition_id='fixture-v1'",[review]);
  await db.exec('reset role;set role anon');assert.equal((await query('select '+publicColumns+' from public.noam_worksheet_edition_hints')).length,2);await db.exec('reset role');
 });
 await test('new ACLs provide no visitor table-level read or any column write; only listed columns are public',async()=>{
  const names=(await query("select column_name from information_schema.columns where table_name='noam_worksheet_edition_hints' order by ordinal_position")).map(r=>r.column_name);
  for(const role of ['anon','authenticated'])for(const col of names){
   const rows=await db.query("select has_column_privilege($1,'public.noam_worksheet_edition_hints',$2,'SELECT') rd,has_column_privilege($1,'public.noam_worksheet_edition_hints',$2,'INSERT') ins,has_column_privilege($1,'public.noam_worksheet_edition_hints',$2,'UPDATE') upd",[role,col]);
   assert.equal(rows.rows[0].rd,publicColumns.split(',').includes(col));assert.equal(rows.rows[0].ins,false);assert.equal(rows.rows[0].upd,false);
  }
  assert.equal((await query("select relrowsecurity from pg_class where oid='public.noam_worksheet_edition_hints'::regclass"))[0].relrowsecurity,true);
 });
}finally{await db.close();}
