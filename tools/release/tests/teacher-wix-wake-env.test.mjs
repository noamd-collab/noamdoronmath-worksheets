import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TARGET,REPOSITORY,SITE_ID,APP_ID,NAMES,digest,renderDigest,validatePlan,validateValues,
  validateRenderProof,provision,readPrivateJson,openLedger,createWixTransport,verifySource } from '../teacher-wix-wake-env.mjs';

function fixture() {
  const values={WORKER_URL:'https://noam-teacher-generation-test.onrender.com',WORKER_WAKE_SECRET:'b'.repeat(64)};
  const runtime={WORKER_WAKE_SECRET:values.WORKER_WAKE_SECRET,TEACHER_GENERATION_SERVICE_KEY:'fixture-only-service',QWEN_API_KEY:'fixture-only-key',QWEN_BASE_URL:'https://fixture.invalid',QWEN_MODEL:'fixture-model'};
  const renderPlan={target:'teacher-render-free',sourceSha:'a'.repeat(40),ownerId:'tea-1234567890',serviceName:'noam-teacher-generation-test',branch:'codex/teacher-generation-free-render-20261114',plan:'free',region:'frankfurt',autoDeployTrigger:'off'};
  const receipt={target:'teacher-render-free',planSha256:renderDigest(renderPlan),state:'active',serviceId:'srv-1234567890',liveDeployId:'dep-1234567890',url:values.WORKER_URL,runtimeSha256:renderDigest(runtime)};
  const plan={version:1,target:TARGET,repository:REPOSITORY,sourceSha:renderPlan.sourceSha,siteId:SITE_ID,appId:APP_ID,environment:'prod',workerUrl:values.WORKER_URL,wakeSecretSha256:digest(values.WORKER_WAKE_SECRET),expectedPrevious:Object.fromEntries(NAMES.map(k=>[k,null])),renderPlanSha256:renderDigest(renderPlan),renderReceiptSha256:renderDigest(receipt)};
  return {plan,values,proof:{plan:renderPlan,receipt,runtime}};
}
function context(options={}) {
  const f=fixture(); let state=null; let env={OTHER_SETTING:'fixture-must-stay'}; const calls=[];
  const ledger={read:()=>state,write:v=>{state=structuredClone(v);}};
  const transport={read:async()=>{calls.push('read');return {appEnvironmentVariables:Object.entries(env).map(([key,value])=>({key,value}))};},
    upsert:async values=>{calls.push('upsert');env={...env,...values};return {bulkActionMetadata:{totalSuccesses:2,totalFailures:0,undetailedFailures:0}};}};
  const input={...f,apply:true,approval:`NOAM APPROVED WIX WAKE ENV ${digest(f.plan)}`,ledger,transportFactory:async()=>{calls.push('auth');return transport;},...options};
  return {input,calls,transport,ledger,get state(){return state;},set env(v){env=v;},get env(){return env;}};
}
test('default dry-run makes zero provider requests and zero writes',async()=>{
  const c=context({apply:false});const r=await provision(c.input);
  assert.equal(r.state,'dry_run');assert.equal(r.providerRequests,0);assert.deepEqual(c.calls,[]);assert.equal(c.state,null);
});
test('exact approval is required before auth/read/write',async()=>{
  const c=context({approval:'approved'});await assert.rejects(provision(c.input),/EXACT_APPROVAL_REQUIRED/);assert.deepEqual(c.calls,[]);
});
test('closed target/source/environment plan and only two input names',()=>{
  for(const [key,value] of [['siteId','other'],['appId','other'],['repository','other/repo'],['environment','preview'],['sourceSha','short']]){
    const f=fixture();f.plan[key]=value;assert.throws(()=>validatePlan(f.plan));
  }
  const f=fixture();assert.throws(()=>validateValues({...f.values,QWEN_API_KEY:'extra'},f.plan),/ONLY_TWO/);
  assert.throws(()=>validateValues({WORKER_URL:f.values.WORKER_URL},f.plan),/ONLY_TWO/);
});
test('URL allowlist and exact payload digest fail closed',()=>{
  for(const url of ['http://x.onrender.com','https://x.onrender.com/wake','https://x.onrender.com:443','https://user@x.onrender.com','https://x.onrender.com?x=1','https://x.onrender.com.attacker.invalid','https://a.b.onrender.com','https://127.0.0.1']){
    const f=fixture();f.plan.workerUrl=url;assert.throws(()=>validatePlan(f.plan),/INVALID_WAKE_CONFIG/);
  }
  const f=fixture();assert.throws(()=>validateValues({...f.values,WORKER_WAKE_SECRET:'c'.repeat(64)},f.plan),/PAYLOAD_PLAN/);
});
test('active same-source Render receipt and original configured key are mandatory',()=>{
  for(const mutate of [p=>p.receipt.state='disabled_live',p=>p.plan.sourceSha='c'.repeat(40),p=>p.receipt.url='https://other.onrender.com',p=>p.runtime.WORKER_WAKE_SECRET='c'.repeat(64)]){
    const f=fixture();mutate(f.proof);assert.throws(()=>validateRenderProof(f.plan,f.values,f.proof.plan,f.proof.receipt,f.proof.runtime));
  }
  const f=fixture();f.proof.receipt.state='disabled_live';f.plan.renderReceiptSha256=renderDigest(f.proof.receipt);
  assert.throws(()=>validateRenderProof(f.plan,f.values,f.proof.plan,f.proof.receipt,f.proof.runtime),/ACTIVE_RENDER/);
});
test('canonical Render hash agrees with Python ASCII JSON contract',()=>{
  assert.equal(renderDigest({z:'שלום',a:1}),digest('{"a":1,"z":"\\u05e9\\u05dc\\u05d5\\u05dd"}'));
});
test('one upsert preserves other config and receipt has no payload',async()=>{
  const c=context();const r=await provision(c.input);
  assert.deepEqual(c.calls,['auth','read','upsert','read']);assert.equal(r.state,'configured');assert.equal(r.unrelatedEnvironmentUnchanged,true);
  assert.equal(c.env.OTHER_SETTING,'fixture-must-stay');assert.equal(r.publicationPerformed,false);assert.equal(r.workerWakePerformed,false);
  assert.ok(!JSON.stringify(r).includes(c.input.values.WORKER_WAKE_SECRET));assert.ok(!JSON.stringify(r).includes('fixture-must-stay'));
});
test('replaying same configured receipt does not authenticate or write',async()=>{
  const c=context();await provision(c.input);c.calls.length=0;const r=await provision(c.input);assert.equal(r.idempotentReceipt,true);assert.deepEqual(c.calls,[]);
});
test('existing unexpected value blocks mutation before write',async()=>{
  const c=context();c.env={WORKER_URL:'https://other.onrender.com'};
  await assert.rejects(provision(c.input),/REMOTE_CONFIG_DRIFT/);assert.deepEqual(c.calls,['auth','read']);assert.equal(c.state,null);
});
test('reviewed previous hashes support intentional rotation only',async()=>{
  const c=context();c.env={WORKER_URL:c.input.values.WORKER_URL,WORKER_WAKE_SECRET:'c'.repeat(64)};
  c.input.plan.expectedPrevious=Object.fromEntries(NAMES.map(k=>[k,digest(c.env[k])]));c.input.approval=`NOAM APPROVED WIX WAKE ENV ${digest(c.input.plan)}`;
  assert.equal((await provision(c.input)).state,'configured');
});
test('failed/partial write remains uncertain and raw body is never exposed or retried',async()=>{
  const c=context();c.transport.upsert=async()=>{throw new Error('RAW_SECRET_SHOULD_NOT_ESCAPE');};
  await assert.rejects(provision(c.input),e=>e.message==='WRITE_OUTCOME_UNCERTAIN_STOP');assert.equal(c.state.state,'uncertain');
  c.calls.length=0;await assert.rejects(provision(c.input),/UNCERTAIN_OR_DIFFERENT/);assert.deepEqual(c.calls,[]);
});
test('missing explicit bulk success or changed unrelated config stops as uncertain',async()=>{
  for(const kind of ['metadata','unrelated']){
    const c=context();c.transport.upsert=async values=>{c.env={...c.env,...values,...(kind==='unrelated'?{OTHER_SETTING:'changed'}:{})};return kind==='metadata'?{}:{bulkActionMetadata:{totalSuccesses:2}};};
    await assert.rejects(provision(c.input),/WRITE_OUTCOME_UNCERTAIN/);assert.equal(c.state.state,'uncertain');
  }
});
test('revalidation runs after provider read and before any mutation',async()=>{
  let n=0;const c=context({revalidate:()=>{if(++n===2)throw new Error('changed');}});
  await assert.rejects(provision(c.input),/WIX_READ_OR_AUTH_FAILED/);assert.deepEqual(c.calls,['auth','read']);assert.equal(c.state,null);
});
test('private input requires 0600, owned external real file; ledger is exclusive',()=>{
  const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wix-wake-test-')));const repo=path.join(dir,'repo');fs.mkdirSync(repo);
  const file=path.join(dir,'values.json');fs.writeFileSync(file,'{}',{mode:0o600});assert.deepEqual(readPrivateJson(file,[repo]),{});
  fs.chmodSync(file,0o644);assert.throws(()=>readPrivateJson(file,[repo]),/PRIVATE_FILE/);fs.chmodSync(file,0o600);
  const link=path.join(dir,'link.json');fs.symlinkSync(file,link);assert.throws(()=>readPrivateJson(link,[repo]));
  const internal=path.join(repo,'internal.json');fs.writeFileSync(internal,'{}',{mode:0o600});assert.throws(()=>readPrivateJson(internal,[repo]),/OUTSIDE_CHECKOUT/);
  const led=path.join(dir,'ledger');fs.mkdirSync(led,{mode:0o700});const ledger=openLedger(led,[repo]);
  assert.throws(()=>openLedger(led,[repo]));ledger.write({state:'uncertain'});assert.equal(fs.statSync(path.join(led,'current.json')).mode&0o777,0o600);assert.equal(ledger.read().state,'uncertain');ledger.close();
  fs.rmSync(dir,{recursive:true,force:true});
});
test('source verification rejects wrong repository without any provider use',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wix-wake-source-'));execFileSync('git',['init','-q',dir]);execFileSync('git',['-C',dir,'remote','add','origin','https://github.com/other/other.git']);
  assert.throws(()=>verifySource(dir,fixture().plan),/WRONG_REPOSITORY/);fs.rmSync(dir,{recursive:true,force:true});
});
test('transport uses pinned site auth, exact paths, no redirects and narrow upsert',async()=>{
  let authConfig;const calls=[];const transport=await createWixTransport('/unused-pinned-cli',async()=>({
    isLoggedInToAccount:async()=>({getAccessToken:async({siteId})=>{assert.equal(siteId,SITE_ID);return 'unit-only-token';}}),
    createHttpClient:config=>{authConfig=config;return {
      get:async(url,opts)=>{calls.push({method:'GET',url,opts});return {data:{appEnvironmentVariables:[]}};},
      post:async(url,body,opts)=>{calls.push({method:'POST',url,body,opts});return {data:{bulkActionMetadata:{totalSuccesses:2}}};},
    };},
  }),[]);
  await transport.read();await transport.upsert(fixture().values);assert.equal(authConfig.type,'backoffice');assert.equal(await authConfig.getAppToken(),'unit-only-token');
  assert.equal(calls[0].url,`/_api/wix-code-app-environments/v2/app-projects/${APP_ID}/app-environment-variables/environment/prod`);
  assert.equal(calls[1].body.returnAllEnvironment,false);assert.equal(calls[1].body.mutability,'STATIC');assert.deepEqual(Object.keys(calls[1].body.variables).sort(),[...NAMES].sort());
  assert.ok(calls.every(c=>c.opts.maxRedirects===0&&c.opts.timeout===10000));
});
test('debug/instrumentation cannot import auth or expose HTTP credentials',async()=>{
  for(const key of ['NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_OPTIONS','DEBUG','SSLKEYLOGFILE','NODE_V8_COVERAGE']){
    const prior=process.env[key];process.env[key]='unit-only-enabled';let imported=false;
    try { await assert.rejects(createWixTransport('/unused',async()=>{imported=true;},[]),/DEBUG_OR_NODE_HOOKS/);assert.equal(imported,false); }
    finally { if(prior===undefined)delete process.env[key];else process.env[key]=prior; }
  }
});
test('disabled TLS verification is blocked before importing auth',async()=>{
  const prior=process.env.NODE_TLS_REJECT_UNAUTHORIZED;process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';let imported=false;
  try { await assert.rejects(createWixTransport('/unused',async()=>{imported=true;},[]),/TLS_VERIFICATION_REQUIRED/);assert.equal(imported,false); }
  finally { if(prior===undefined)delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;else process.env.NODE_TLS_REJECT_UNAUTHORIZED=prior; }
  const script=fs.readFileSync(new URL('../release.sh',import.meta.url),'utf8');assert.ok(script.includes('-u NODE_TLS_REJECT_UNAUTHORIZED'));
});
test('release dispatcher runs before env loading; CI includes this network-free suite',()=>{
  const script=fs.readFileSync(new URL('../release.sh',import.meta.url),'utf8');
  assert.ok(script.indexOf('teacher-wix-wake-env')<script.indexOf('[ -f'));assert.ok(!script.includes('env set --value'));
  const ci=fs.readFileSync(new URL('../../../.github/workflows/release-guard-pr.yml',import.meta.url),'utf8');
  assert.ok(ci.includes('tools/release/tests/teacher-wix-wake-env.test.mjs'));
});
