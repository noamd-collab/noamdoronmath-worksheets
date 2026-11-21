// Isolated PostgreSQL RLS tests. No credentials, hosted database, or model calls.
// Pinned PGlite: @electric-sql/pglite@0.5.14 outside the checkout, same as the
// existing verify-rls-postgres.mjs. Run through headless/astro-poc/node_modules/.bin/tsx
// and set NOAM_PGLITE_MODULE to the installed package's dist/index.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { isTeacherGenerationDraftReady } from '../../headless/astro-poc/src/lib/teacherGenerationContract.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const { PGlite }=await import(process.env.NOAM_PGLITE_MODULE ? pathToFileURL(process.env.NOAM_PGLITE_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();
const owner='80da2957-9492-4a9d-babb-28ba70dedd12';
const stranger='10000000-0000-4000-8000-000000000001';
const bucket='teacher-generation-private';
const draft={authoringProfile:'general-skill-source/v1',automatedChecksPassed:false,
  renderingChecksPassed:true,humanReviewRequired:true,checks:[{name:'render',status:'PASS'},{name:'didactic',status:'REVIEW'}]};
const cases=[
  null,[],{},true,'true',0,
  {automatedChecksPassed:true}, {automatedChecksPassed:true,checks:[]},
  {automatedChecksPassed:true,checks:[{status:'PASS'}]},
  {automatedChecksPassed:true,checks:[{status:'FAIL'}]},
  {automatedChecksPassed:true,checks:[{status:'REVIEW'}]},
  {automatedChecksPassed:true,checks:null},
  {automatedChecksPassed:true,checks:[{}]},
  {automatedChecksPassed:true,checks:[null]},
  {automatedChecksPassed:'true'}, draft,
  {...draft,checks:[{status:'PASS'}]},
  {...draft,checks:[{status:'REVIEW'}]},
  {...draft,checks:[]}, {...draft,checks:[{status:'PASS'},{status:'FAIL'}]},
  {...draft,checks:[{status:null}]}, {...draft,checks:[{}]}, {...draft,checks:[1]},
  {...draft,checks:{}}, {...draft,checks:null}, {...draft,authoringProfile:'other'},
  {...draft,renderingChecksPassed:false}, {...draft,renderingChecksPassed:'true'},
  {...draft,humanReviewRequired:false}, {...draft,humanReviewRequired:'true'},
  {...draft,automatedChecksPassed:null}, {...draft,automatedChecksPassed:'false'},
];
const jwt=(id=owner,provider='google',anonymous=false)=>({sub:id,is_anonymous:anonymous,app_metadata:{provider}});
async function asRole(role,claims,callback) {
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
  await db.exec('set role '+role);
  try{return await callback();}finally{await db.exec('reset role');}
}
const rows=async()=> (await db.query('select name from storage.objects order by name')).rows.map(r=>r.name);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}');
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create policy fixture_older_broad_read on storage.objects for select to anon,authenticated using(true);
    create policy fixture_older_broad_write on storage.objects for all to anon,authenticated using(true) with check(true);
  `);
  await db.exec(await readFile(path.join(root,'supabase/migrations/20261112185430_teacher_generation_private_pilot.sql'),'utf8'));
  const ids=[];
  for(let i=0;i<cases.length;i++) {
    const id='20000000-0000-4000-8000-'+String(i+1).padStart(12,'0');ids.push(id);
    // The old trigger/quota remains active. Old synthetic timestamps avoid
    // spending a quota slot; this in-memory instance is never production.
    const result=cases[i] && typeof cases[i]==='object' && !Array.isArray(cases[i]) ? cases[i] : {};
    await db.query(`insert into public.noam_teacher_generation_jobs(id,owner_id,request_key,request_hash,lesson,status,phase,result,created_at)
      values($1,$2,$1,repeat('a',64),'{}','needs_review','needs_review',$3,'2020-01-01')`,[id,owner,JSON.stringify(result)]);
    for(const ext of ['pdf','docx'])await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,`${owner}/${id}/sheet.${ext}`]);
  }
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,`${owner}/${ids[15]}/source.json`]);
  await db.exec("insert into storage.objects(bucket_id,name) values('other-bucket','public-example')");
  const before=(await db.query('select id,status,result,created_at from public.noam_teacher_generation_jobs order by id')).rows;
  await test('original restrictive policy reproduces REVIEW download denial',async()=>{
    const visible=await asRole('authenticated',jwt(),rows);
    assert(!visible.includes(`${owner}/${ids[15]}/sheet.pdf`));
  });
  await db.exec(await readFile(path.join(root,'supabase/migrations/20261116153658_teacher_generation_review_draft_download.sql'),'utf8'));
  await test('pure PostgreSQL predicate matches the exact API contract on hostile and legacy results',async()=>{
    for(const result of cases){
      const actual=(await db.query('select public.noam_teacher_generation_draft_downloadable($1::jsonb) as value',[JSON.stringify(result)])).rows[0].value;
      assert.equal(actual,isTeacherGenerationDraftReady(result),JSON.stringify(result));
    }
  });
  await test('owner can download only complete PASS or documented REVIEW drafts, exact PDF/DOCX paths',async()=>{
    const visible=await asRole('authenticated',jwt(),rows);
    const expected=cases.flatMap((value,i)=>isTeacherGenerationDraftReady(value)?['pdf','docx'].map(ext=>`${owner}/${ids[i]}/sheet.${ext}`):[]);
    assert.deepEqual(visible,[...expected,'public-example'].sort());
  });
  await test('other Google accounts, anonymous identities, and non-Google owner cannot read private files',async()=>{
    for(const claims of [jwt(stranger),jwt(owner,'email'),jwt(owner,'google',true)])
      assert.deepEqual(await asRole('authenticated',claims,rows),['public-example']);
    assert.deepEqual(await asRole('anon',jwt(),rows),['public-example']);
  });
  await test('private Storage mutations remain denied even with an older broad policy',async()=>{
    await asRole('authenticated',jwt(),async()=>{
      await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,`${owner}/new.pdf`]),/row-level security/);
      assert.equal((await db.query("update storage.objects set name='changed' where bucket_id=$1 returning name",[bucket])).rows.length,0);
      assert.equal((await db.query('delete from storage.objects where bucket_id=$1 returning name',[bucket])).rows.length,0);
    });
  });
  await test('migration preserves jobs/quota functions and exposes no elevated function',async()=>{
    assert.deepEqual((await db.query('select id,status,result,created_at from public.noam_teacher_generation_jobs order by id')).rows,before);
    const fn=(await db.query("select prosecdef,provolatile,proconfig from pg_proc where oid='public.noam_teacher_generation_draft_downloadable(jsonb)'::regprocedure")).rows[0];
    assert.equal(fn.prosecdef,false);assert.equal(fn.provolatile,'i');assert.deepEqual(fn.proconfig,['search_path=""']);
    assert.equal((await db.query("select has_function_privilege('anon','public.noam_teacher_generation_draft_downloadable(jsonb)','EXECUTE') as value")).rows[0].value,false);
    assert.equal((await db.query("select has_table_privilege('authenticated','public.noam_teacher_generation_jobs','UPDATE') as value")).rows[0].value,false);
  });
}finally{await db.close();}
