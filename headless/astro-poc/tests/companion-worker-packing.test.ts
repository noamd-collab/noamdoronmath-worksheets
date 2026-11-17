import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import packed from '../src/data/companion-worker-data.json';
import { createCompanionPackLoader, decompressCompanionPack, PACKED_DATA_UNAVAILABLE } from '../src/lib/packedCompanionData';
import { loadCompanionWorkerData } from '../src/lib/companionWorkerData';
import { compileCompanionData, validateCompanionData } from '../scripts/build-companion-data.mjs';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
const data = new URL('../src/data/', import.meta.url);
const original = { guide: JSON.parse(readFileSync(new URL('site-guide.v1.json',data),'utf8')), teacherIndex: JSON.parse(readFileSync(new URL('teacher-pick-index.json',data),'utf8')) };
const catalog = JSON.parse(readFileSync(new URL('catalog.v1.json',data),'utf8'));
test('committed and freshly generated packs preserve every original byte, count, ID, and nested field', async()=>{
 assert.equal(validateCompanionData(packed),true);
 assert.equal(validateCompanionData(JSON.parse(compileCompanionData())),true);
 for(const [key,name] of [['guide','site-guide.v1.json'],['teacherIndex','teacher-pick-index.json']] as const){const raw=readFileSync(new URL(name,data)),p=packed[key];assert.deepEqual(gunzipSync(Buffer.from(p.gzipBase64,'base64')),raw);assert.equal(createHash('sha256').update(raw).digest('hex'),p.sha256);assert.equal(p.rawBytes,raw.length);}
 assert.deepEqual(await loadCompanionWorkerData(),original);
});
test('source validation accepts alternate lossless gzip encodings but rejects stale metadata or bytes',()=>{
 const alternate=structuredClone(packed);
 for(const key of ['guide','teacherIndex'] as const) alternate[key].gzipBase64=gzipSync(gunzipSync(Buffer.from(packed[key].gzipBase64,'base64')),{level:1}).toString('base64');
 assert.notEqual(alternate.guide.gzipBase64,packed.guide.gzipBase64);
 assert.equal(validateCompanionData(alternate),true);
 for(const delta of [{sha256:'0'.repeat(64)},{count:1},{rawBytes:1},{kind:'teacherIndex'},{version:2},{gzipBase64:packed.guide.gzipBase64+'!!'},{gzipBase64:gzipSync(Buffer.from('{}')).toString('base64')}]){
  const bad=structuredClone(packed);Object.assign(bad.guide,delta);assert.throws(()=>validateCompanionData(bad));
 }
});
test('cold concurrent calls share one decode, warm calls preserve object and promise identity',async()=>{
 let decodes=0;const load=createCompanionPackLoader(packed.guide,async p=>{decodes++;return decompressCompanionPack(p);});const cold=load();assert.equal(cold,load());const results=await Promise.all(Array.from({length:20},()=>load()));assert.equal(decodes,1);assert(results.every(x=>x===results[0]));assert.equal(load(),cold);assert.equal(await load(),results[0]);
});
test('one failed shared decode rejects safely and retries successfully without poisoned cache',async()=>{
 let attempts=0;const load=createCompanionPackLoader(packed.guide,async p=>{if(++attempts===1)throw Error('/Users/secret/provider token');return decompressCompanionPack(p);});const failed=await Promise.allSettled([load(),load(),load()]);assert.equal(attempts,1);assert(failed.every(r=>r.status==='rejected'&&r.reason.message===PACKED_DATA_UNAVAILABLE));assert.deepEqual(await load(),original.guide);assert.equal(attempts,2);await load();assert.equal(attempts,2);
});
for(const [name,delta]of [ ['hash',{sha256:'0'.repeat(64)}], ['size',{rawBytes:packed.guide.rawBytes-1}], ['count',{count:1}], ['gzip',{gzipBase64:'invalid'}], ['oversized',{rawBytes:8_000_001}], ['version',{version:2}] ] as const)test('rejects damaged '+name+' with a bounded error',async()=>{const load=createCompanionPackLoader({...packed.guide,...delta});await assert.rejects(load(),{message:PACKED_DATA_UNAVAILABLE});});
function settings(extra:any={}) {return {origin:'https://www.noamdoronmath.co.il',requestHost:'www.noamdoronmath.co.il',clientIp:'203.0.113.21',qwenKey:'test-only',recaptchaSecret:'test-only',store:new Map(),now:5000,catalog,...extra};}
const messages=[
 {message:'מי אתה?',page:{kind:'home',path:'/',title:'בית'}},
 {message:'דפי עבודה משוואות רציונליות כיתה ט',page:{kind:'worksheets',path:'/worksheets',title:'דפי עבודה'}},
 {message:'בחר שאלות',page:{kind:'teachers',path:'/teachers/app',title:'מורים'},teacher:{grade:'9',topic:'2',level:'a',note:''}},
 {message:'עזרה בנושא',page:{kind:'topic',path:'/factoring-grade-9',title:'פירוק לגורמים'},botVerification:{provider:'recaptcha-v3',token:'test-token'}},
];
for(const [i,payload]of messages.entries())test('endpoint parity for original vs packed data path '+i,async()=>{
 const calls:any[][]=[[],[]];const run=async(side:number)=>handleNoamSiteCompanion({method:'POST'},settings({payload,...(side===0?original:{loadStaticData:loadCompanionWorkerData}),fetch:async(url:any,init:any)=>{calls[side].push([String(url),init?.body]);return String(url).includes('siteverify')?{ok:true,json:async()=>({success:true,score:0.9,action:'noam_site_companion',hostname:'www.noamdoronmath.co.il'})}:{ok:true,json:async()=>({choices:[{message:{content:'{"intent":"unknown"}'}}]})};}}));assert.deepEqual(await run(1),await run(0));assert.deepEqual(calls[1],calls[0]);
});
test('OPTIONS, inactive, origin denial, rate probes and rate denial never decode',async()=>{
 let loads=0;const loadStaticData=async()=>{loads++;throw Error('bad data');};for(const [method,extra]of [['OPTIONS',{}],['POST',{qwenKey:''}],['POST',{origin:'https://evil.example'}],['POST',{payload:{rateProbe:true}}]] as const){const expected=await handleNoamSiteCompanion({method},settings(extra));assert.deepEqual(await handleNoamSiteCompanion({method},settings({...extra,loadStaticData})),expected);}
 const store=new Map();for(let i=0;i<12;i++)await handleNoamSiteCompanion({method:'POST'},settings({store,payload:{rateProbe:true}}));const denied=await handleNoamSiteCompanion({method:'POST'},settings({store,loadStaticData,payload:{message:'hello'}}));assert.equal(denied.status,429);assert.equal(loads,0);
});
test('decode failure returns bounded availability without a model or CAPTCHA call',async()=>{
 const r=await handleNoamSiteCompanion({method:'POST'},settings({payload:{message:'test'},loadStaticData:async()=>{throw Error('private secret');},fetch:async()=>{throw Error('must not call');}}));assert.equal(r.status,503);assert.equal(r.body.code,'UNAVAILABLE');assert(!JSON.stringify(r).includes('private secret'));
});
test('teacher access and private headers stay before the endpoint boundary',()=>{
 const route=readFileSync(new URL('../src/pages/api/noamSiteCompanion.ts',import.meta.url),'utf8');assert(route.indexOf('await requireGoogleTeacher')<route.indexOf('await handleNoamSiteCompanion'));assert(route.includes('if (!access.ok) return teacherAccessFailure(access);'));assert(route.includes('Object.entries(TEACHER_PRIVATE_HEADERS)'));assert(!route.includes('import guide from'));assert(!route.includes('import teacherIndex from'));
});
