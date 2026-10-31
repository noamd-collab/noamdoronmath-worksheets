#!/usr/bin/env node
"use strict";
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const build=require('./build-ramzi-hints.cjs');
const REPO=path.resolve(__dirname,'../..');
const MODEL='qwen3.8-flash';
const PROVENANCE='machine_generated_flash_automatic_checks_no_model_review';
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));

function prepare(repo,candidates,manifest){
  assert.equal(manifest.model,MODEL,'Only the explicitly authorized Flash authoring model is accepted');
  assert.ok(Array.isArray(candidates)&&candidates.length,'No completed rows to import');
  const current=read(path.join(repo,'learning/ramzi-hints.json'));
  const existing=new Map(current.map(row=>[row.exercise_id,row]));
  const seen=new Set();
  for(const row of candidates){
    assert.ok(!seen.has(row.exercise_id),'Duplicate authored ID: '+row.exercise_id);
    seen.add(row.exercise_id);
    assert.ok(!existing.has(row.exercise_id),'Refusing to overwrite existing hints: '+row.exercise_id);
    assert.equal(row.status,'verified','Only successfully checked generated rows may publish');
    assert.equal(row.source,'ramzi-flash-authored-20261031','Unexpected authoring source');
    assert.equal(row.source_id,row.exercise_id,'Authoring may not reassign another exercise');
    assert.match(row.source_exercise_sha256||'',/^[a-f0-9]{64}$/,'Missing exact task fingerprint');
    assert.equal(build.hintIssue(row.hints),null,'Unsafe hint syntax for '+row.exercise_id);
  }
  const site=build.loadSite(repo);
  const loaded=build.loadRows(candidates,build.liveExercises(site));
  assert.equal(loaded.rejected.length,0,JSON.stringify(loaded.rejected));
  const bound=build.bindRows(site,loaded.rows).rows;
  const added=build.publicRows(bound);
  assert.equal(added.length,candidates.length,'Some source-bound rows were lost');
  const combined=current.concat(added).sort((a,b)=>a.exercise_id.localeCompare(b.exercise_id,'en'));
  for(const row of current)assert.deepEqual(combined.find(item=>item.exercise_id===row.exercise_id),row);
  const ledger=read(path.join(repo,'learning/ramzi-hints-review-20261031.json'));
  const ledgerIds=new Set(ledger.rows.map(row=>row.exercise_id));
  for(const row of added){
    assert.ok(!ledgerIds.has(row.exercise_id),'Existing ledger entry for '+row.exercise_id);
    ledger.rows.push({exercise_id:row.exercise_id,source_pdf_hash:row.source_pdf_hash,
      source_native_sha256:row.source_native_sha256,source_exercise_sha256:row.source_exercise_sha256,
      hints_sha256:sha(JSON.stringify(row.hints)),review:PROVENANCE,authoring_model:MODEL,
      approval:'noam_20261031_flash_authoring_and_builder_checks_without_model_review'});
  }
  ledger.rows.sort((a,b)=>a.exercise_id.localeCompare(b.exercise_id,'en'));
  ledger.scope='Prepared hints for current canonical worksheet parts. Exact coverage is recorded separately; first-part coverage does not mean every part is covered.';
  ledger.limitations='Previously reviewed rows retain their original provenance. Rows labelled '+PROVENANCE+' were authored with '+MODEL+' and passed source-binding and automatic builder checks under Noam\'s explicit instruction. They did not receive an independent model or human content review.';
  return{current,added,combined,ledger};
}
function atomic(file,data){const temp=file+'.tmp';fs.writeFileSync(temp,data);fs.renameSync(temp,file);}
function main(args){
  const value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
  const rowsFile=value('--rows'),manifestFile=value('--manifest');
  assert.ok(rowsFile&&manifestFile,'Usage: import-flash-hints.cjs --rows private/rows.json --manifest private/manifest.json [--write]');
  const result=prepare(REPO,read(rowsFile),read(manifestFile));
  const output=JSON.stringify(build.publicRows(result.combined),null,1)+'\n';
  const seed=build.toSql(result.combined);
  if(args.includes('--write')){
    atomic(path.join(REPO,'learning/ramzi-hints.json'),output);
    atomic(path.join(REPO,'learning/ramzi-hints-seed.sql'),seed);
    atomic(path.join(REPO,'learning/ramzi-hints-review-20261031.json'),JSON.stringify(result.ledger,null,2)+'\n');
  }
  console.log(JSON.stringify({write:args.includes('--write'),before:result.current.length,added:result.added.length,
    after:result.combined.length,model:MODEL,provenance:PROVENANCE,existingChanged:0,
    catalog_sha256:sha(output)},null,2));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={prepare,MODEL,PROVENANCE};
