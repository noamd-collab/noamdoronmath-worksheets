'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../noam-learning-core.js');
const catalog=[{id:'g9-t1-a'},{id:'g9-t1-b'}],iso='2026-09-08T10:00:00.000Z';
function storage(){const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
function mock(){let rows=[],error=null,delay=null;return{setError:e=>error=e,setDelay:p=>delay=p,rows:()=>rows,from(){let op='get',body,filters=[],ignore=false,single=false;const q={select(){return q;},limit(){return q;},single(){single=true;return q;},eq(k,v){filters.push([k,v]);return q;},delete(){op='delete';return q;},upsert(v,o){op='upsert';body=v;ignore=o.ignoreDuplicates;return q;},async then(resolve,reject){try{if(delay)await delay;if(error)return resolve({error});const match=r=>filters.every(([k,v])=>r[k]===v);if(op==='delete'){rows=rows.filter(r=>!match(r));return resolve({data:[]});}if(op==='upsert'){for(const r of Array.isArray(body)?body:[body]){const i=rows.findIndex(x=>x.user_id===r.user_id&&x.worksheet_id===r.worksheet_id);if(i>=0&&ignore)continue;const value={...r,updated_at:iso};if(i>=0)rows[i]=value;else rows.push(value);}return resolve({data:single?rows.find(r=>r.user_id===body.user_id&&r.worksheet_id===body.worksheet_id):rows});}return resolve({data:rows.filter(match)});}catch(e){reject(e);}}};return q;}};}
test('guest progress persists per worksheet and level without authentication',async()=>{const s=storage(),e=Core.create({catalog,storage:s});await e.change('g9-t1-a','completed');assert.equal(e.snapshot().rows['g9-t1-a'].status,'completed');assert.equal(e.snapshot().rows['g9-t1-b'],undefined);const again=Core.create({catalog,storage:s});assert.equal(again.snapshot().rows['g9-t1-a'].status,'completed');await again.change('g9-t1-a',null);assert.deepEqual(again.snapshot().rows,{});});
test('invalid IDs, states, dates and malformed storage never create progress',async()=>{const s=storage();s.setItem(Core.storageKey,JSON.stringify({'g9-t1-a':{status:'constructor',updated_at:iso},'bad':{status:'completed',updated_at:iso},'g9-t1-b':{status:'started',updated_at:'invalid'}}));const e=Core.create({catalog,storage:s});assert.deepEqual(e.snapshot().rows,{});await assert.rejects(e.change('bad','completed'));await assert.rejects(e.change('g9-t1-a','passed'));});
test('storage failures reject rather than claim saved progress',async()=>{const e=Core.create({catalog,storage:{getItem(){throw Error();},setItem(){throw Error();}}});await assert.rejects(e.change('g9-t1-a','started'));assert.equal(e.snapshot().storageError,true);});
test('account state never leaks to guest storage or another account',async()=>{const c=mock(),s=storage(),e=Core.create({catalog,storage:s,client:c});assert.equal(e.snapshot().ready,false);await e.setUser({id:'alice'});await e.change('g9-t1-a','completed');assert.equal(s.getItem(Core.storageKey),null);await e.setUser({id:'bob'});assert.deepEqual(e.snapshot().rows,{});await e.setUser(null);assert.deepEqual(e.snapshot().rows,{});});
test('guest import is explicit and preserves existing account progress',async()=>{const c=mock(),s=storage(),e=Core.create({catalog,storage:s,client:c});await e.setUser(null);await e.change('g9-t1-a','completed');await e.change('g9-t1-b','review');await e.setUser({id:'alice'});assert.deepEqual(e.snapshot().rows,{});await e.change('g9-t1-a','started');await e.importGuest();assert.equal(e.snapshot().rows['g9-t1-a'].status,'started');assert.equal(e.snapshot().rows['g9-t1-b'].status,'review');assert.equal(e.snapshot().guestCount,2);});
test('failed cloud writes do not change visible status or fall back to guest',async()=>{const c=mock(),s=storage(),e=Core.create({catalog,storage:s,client:c});await e.setUser({id:'alice'});await e.change('g9-t1-a','started');c.setError(Error('offline'));await assert.rejects(e.change('g9-t1-a','completed'));assert.equal(e.snapshot().rows['g9-t1-a'].status,'started');assert.equal(s.getItem(Core.storageKey),null);assert.deepEqual(e.snapshot().pending,[]);});
test('a response arriving after signout cannot populate guest progress',async()=>{const c=mock(),s=storage(),e=Core.create({catalog,storage:s,client:c});await e.setUser({id:'alice'});let release;c.setDelay(new Promise(r=>release=r));const p=e.change('g9-t1-a','completed');await e.setUser(null);release();await p;assert.deepEqual(e.snapshot().rows,{});assert.equal(s.getItem(Core.storageKey),null);});
test('clearing an account leaves other accounts and guest storage unchanged',async()=>{const c=mock(),s=storage(),e=Core.create({catalog,storage:s,client:c});await e.setUser(null);await e.change('g9-t1-b','review');await e.setUser({id:'alice'});await e.change('g9-t1-a','started');await e.setUser({id:'bob'});await e.change('g9-t1-b','completed');await e.clear();await e.setUser({id:'alice'});assert.equal(e.snapshot().rows['g9-t1-a'].status,'started');await e.setUser(null);assert.equal(e.snapshot().rows['g9-t1-b'].status,'review');});

// Exercise the browser entry script with the real progress engine and a small DOM fixture.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const browserSource=fs.readFileSync(path.join(__dirname,'../noam-learning.js'),'utf8');
const portal='https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html';
async function browser(options={}){
 const nodes=[],calls=[],replacements=[],windowEvents={};let authListener;
 function node(tag){const n={tag,dataset:{},children:[],value:'',textContent:'',events:{},setAttribute(){},addEventListener(event,fn){this.events[event]=fn;},append(...children){this.children.push(...children);if(tag==='select'&&!this.value)this.value=this.children[0].value;},replaceChildren(...children){this.children=[...children];},querySelectorAll(){return[];},before(){},after(){}};nodes.push(n);return n;}
 const app=node('div');app.id='learning-app';
 const document={createElement:node,getElementById:id=>nodes.find(n=>n.id===id)||null,querySelectorAll:()=>[],querySelector:()=>null};
 const location={href:options.url||portal};
 const history={replaceState(_state,_title,url){location.href=new URL(url,location.href).href;replacements.push(location.href);}};
 const client=mock();client.auth={onAuthStateChange(fn){authListener=fn;},async getSession(){return{data:{session:options.user?{user:options.user}:null},error:options.sessionError};},async signInWithOAuth(credentials){calls.push({credentials,url:location.href});if(options.oauthError)throw options.oauthError;return{data:{url:'https://accounts.google.com/'},error:null};}};
 const window={NOAM_LEARNING_CATALOG:[{id:'g9-t1-a',title:'אלגברה',label:'רמה א׳',g:9,t:1}],NoamLearningCore:Core,NOAM_LEARNING_CONFIG:{googleEnabled:options.enabled!==false,url:'https://project.test',key:'public-test-key'},addEventListener(event,fn){windowEvents[event]=fn;}};
 window.self=window;window.top=options.embedded?{}:window;
 if(!options.missingSdk)window.supabase={createClient:()=>client};
 vm.runInNewContext(browserSource,{window,document,location,history,localStorage:storage(),URL,Map,setTimeout});
 await new Promise(setImmediate);
 return{calls,replacements,location,nodes,windowEvents,authEvent:async(user)=>{authListener('SIGNED_IN',{user});await new Promise(r=>setTimeout(r,5));},googleButton:()=>nodes.find(n=>n.className==='nl-account').children.find(n=>n.className==='nl-google')};
}
test('normal portal visits stay anonymous until the existing Google button is clicked',async()=>{
 const b=await browser();assert.equal(b.calls.length,0);assert.equal(b.replacements.length,0);
 await b.googleButton().events.click();assert.equal(b.calls.length,1);assert.equal(b.calls[0].credentials.provider,'google');
});
test('explicit Google entry consumes its intent before OAuth and keeps the fixed clean return URL',async()=>{
 const b=await browser({url:portal+'?signin=google&worksheet=g9-t1-a#progress'});
 assert.equal(b.calls.length,1);assert.equal(b.calls[0].url,portal+'?worksheet=g9-t1-a#progress');
 assert.equal(b.calls[0].credentials.options.redirectTo,portal);assert.equal(b.calls[0].credentials.options.queryParams.prompt,'select_account');
 await b.authEvent({id:'alice'});assert.equal(b.calls.length,1);
 const again=await browser({url:b.location.href});assert.equal(again.calls.length,0);
});
test('an existing account bypasses the Google redirect',async()=>{
 const b=await browser({url:portal+'?signin=google',user:{id:'alice',email:'student@example.test'}});
 assert.equal(b.calls.length,0);assert.equal(b.location.href,portal);
});
test('disabled, unavailable and embedded auth consume the entry without blocking guest learning',async t=>{
 for(const options of [{enabled:false},{missingSdk:true},{embedded:true}])await t.test(JSON.stringify(options),async()=>{
  const b=await browser({...options,url:portal+'?signin=google'});assert.equal(b.calls.length,0);assert.equal(b.location.href,portal);
  assert.ok(b.nodes.some(n=>n.textContent==='אפשר לעבוד כאן בלי להתחבר.'));
 });
});
test('OAuth or session failures cannot replay the consumed sign-in intent on reload',async()=>{
 for(const options of [{oauthError:Error('offline')},{sessionError:Error('offline')}]){
  const b=await browser({...options,url:portal+'?signin=google'});assert.equal(b.calls.length,options.oauthError?1:0);assert.equal(b.location.href,portal);
  assert.ok(b.googleButton()&&!b.googleButton().disabled);
  assert.equal((await browser({url:b.location.href})).calls.length,0);
 }
});
test('OAuth callbacks and cancellation errors never trigger another Google redirect',async()=>{
 for(const suffix of ['?signin=google&code=callback','?signin=google&error=access_denied','?signin=google#error=access_denied']){
  const b=await browser({url:portal+suffix});assert.equal(b.calls.length,0);assert.equal(new URL(b.location.href).searchParams.has('signin'),false);
 }
});
test('Back restores an enabled Google button without restarting sign-in from the page cache',async()=>{
 const b=await browser({url:portal+'?signin=google'});assert.equal(b.googleButton().disabled,true);
 b.windowEvents.pageshow({persisted:true});assert.equal(b.googleButton().disabled,false);assert.equal(b.calls.length,1);
 await b.googleButton().events.click();assert.equal(b.calls.length,2);
});
