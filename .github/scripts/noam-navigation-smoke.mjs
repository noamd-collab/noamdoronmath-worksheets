// Optional real-provider regression check. Only synthetic navigation text and the
// public site directory are sent; never prints credentials or request headers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { handleCompanionTurn } from '../../noam-ai/site-companion/companion.js';
const changed=execFileSync('git',['diff','--name-only',process.env.BASE_SHA || 'origin/main','HEAD'],{encoding:'utf8'});
if (!changed.split('\n').some(p=>p.startsWith('noam-ai/site-companion/') || p==='headless/astro-poc/public/noam-site-companion.js')) process.exit(0);
const guide=JSON.parse(readFileSync('headless/astro-poc/src/data/site-guide.v1.json','utf8'));
const catalog=JSON.parse(readFileSync('headless/astro-poc/src/data/catalog.v1.json','utf8'));
const history=[];
for(const [message,expected] of [
  ['אני מחפש דפים לכיתה ט׳','catalog-9'],
  ['אני צריך לתרגל פירוק לגורמים ברמה ב׳','g9-t2-b'],
  ['משהו קל יותר','g9-t2-a'],
]){
  const start=Date.now();
  const result=await handleCompanionTurn({message,history,page:{kind:'home',path:'/',title:'נועם דורון'}},{guide,catalog,apiKey:process.env.CHINESE_MODELS_API_KEY,fetch:async (...args)=>{
    const response=await fetch(...args);
    if(response.ok){
      const data=await response.clone().json();
      // Synthetic test output only; helps distinguish latency from invalid record ids.
      console.log(JSON.stringify({providerReply:data.choices?.[0]?.message?.content}));
    }
    return response;
  }});
  console.log(JSON.stringify({message,source:result.source,answer:result.answer,primary:result.primary,elapsedMs:Date.now()-start}));
  assert.equal(result.source,'model');
  assert.equal(result.primary?.id,expected);
  history.push({role:'user',content:message},{role:'assistant',content:result.answer+' '+result.primary.label});
}
