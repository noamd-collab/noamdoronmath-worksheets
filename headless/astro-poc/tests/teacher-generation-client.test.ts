import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { webcrypto } from 'node:crypto';
import { GENERATION_CURRICULUM_SHA256, parseTeacherGenerationCurriculum, getTeacherGenerationMinimumQuestionCount } from '../src/lib/teacherGenerationContract';

const pageSource = readFileSync(new URL('../src/pages/teachers/generate.astro', import.meta.url), 'utf8');
const markup = pageSource.match(/<main[\s\S]*?<\/main>/)![0].replace(' open={historyRequested}','');
const shipped = readFileSync(new URL('../public/teachers/generation-v3.js', import.meta.url), 'utf8');
const topic = { topicId: 'ג10', gradeNumber: 3, title: 'חילוק', enabled: true, e2eVerified: true, levels: ['b'], questionCounts: [12] };
const middle = { ...topic, topicId: 'g7:equations', gradeNumber: 7, title: 'משוואות', questionCounts: [20] };
const disabled = { ...topic, topicId: 'candidate', gradeNumber: 3, enabled: false };
const catalogBytes=readFileSync(new URL('../public/teachers/generation-curriculum.json',import.meta.url));
const curriculum=parseTeacherGenerationCurriculum(JSON.parse(catalogBytes.toString()));
const generalCapabilities={profile:'general-skill-source/v1',curriculumSha256:GENERATION_CURRICULUM_SHA256,acceptedIntakeVersions:[2,3],
 topics:curriculum.topics.map(t=>({...t,enabled:true,readiness:'private_draft',e2eVerified:false,
  levels:t.topicId.startsWith('g9m:')?['b']:t.topicId.startsWith('g9r:')?['a','e']:['b','a','e'],
  questionCounts:Array.from({length:31-getTeacherGenerationMinimumQuestionCount(t.gradeNumber)!},(_,i)=>getTeacherGenerationMinimumQuestionCount(t.gradeNumber)!+i)}))};
type Quota = {mode:'owner'|'trial';totalLimit:null|5;remainingTotal:number|null;startsAt:string|null;endsAt:string|null;active:boolean};
const ownerQuota: Quota = {mode:'owner',totalLimit:null,remainingTotal:null,active:true,startsAt:null,endsAt:null};
function trialQuota(remainingTotal:number, endsAt:string, active=true): Quota {
  return {mode:'trial',totalLimit:5,remainingTotal,active,startsAt:new Date(Date.parse(endsAt)-72*3600000).toISOString(),endsAt};
}
type Reply = { ok?: boolean; status?: number; body?: any; error?: Error };

function harness(options: { quota?: Quota; online?: boolean; waking?: boolean; jobs?: any[]; history?: any[]; jobDetails?: Record<string,Reply>; captcha?: boolean; emptyCapabilities?: boolean; general?: boolean; catalogMismatch?: boolean; firstHealth?: Promise<Reply>; storage?: Map<string,string>; owner?: string } = {}) {
  const { document, window } = parseHTML(`<!doctype html><html><head></head><body>${markup}</body></html>`);
  const form = document.getElementById('generation-form') as any;
  form.dataset.draftOwner=options.owner ?? '00000000-0000-4000-8000-000000000001';
  const entries=options.storage ?? new Map<string,string>();
  const storage={getItem:(key:string)=>entries.get(key) ?? null, setItem:(key:string,value:string)=>entries.set(key,value), removeItem:(key:string)=>entries.delete(key)};
  const navigations:string[]=[],location=Object.assign(new URL('https://teachers.example/teachers/generate'),{assign:(href:string)=>navigations.push(href)});
  const browserWindow=new Proxy(window,{get(target,key){if(key==='sessionStorage')return storage;if(key==='location')return location;return Reflect.get(target,key);}});
  (window.HTMLInputElement.prototype as any).checkValidity=()=>true;
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(value){if(value)this.setAttribute('checked','');else this.removeAttribute('checked');}});
  const fields = new Map(Array.from(form.querySelectorAll('[name]')).map((el: any) => [el.getAttribute('name'), el]));
  Object.defineProperty(form, 'elements', { value: { namedItem: (name: string) => fields.get(name) } });
  // Browser properties absent/incomplete in linkedom; user handlers remain unmodified.
  for (const select of form.querySelectorAll('select') as any) {
    let selected = select.querySelector('option')?.getAttribute('value') || '';
    Object.defineProperty(select, 'options', { get: () => Array.from(select.querySelectorAll('option')) });
    Object.defineProperty(select, 'value', {
      get: () => select.options.some((o: any) => o.value === selected) ? selected : select.options[0]?.value || '',
      set: (value: string) => { selected = String(value); },
    });
    Object.defineProperty(select, 'selectedOptions', { get: () => select.options.filter((o: any) => o.value === select.value) });
  }
  for (const el of form.querySelectorAll('[name]') as any) {
    if (el.type === 'checkbox') Object.defineProperty(el, 'checked', { get: () => el.hasAttribute('checked'), set: (value: boolean) => { if(value)el.setAttribute('checked','');else el.removeAttribute('checked'); } });
    el.checkValidity = () => {
      if (el.disabled || el.closest('fieldset')?.disabled) return true;
      if (el.hasAttribute('required') && !el.value) return false;
      if (el.hasAttribute('minlength') && el.value.length < Number(el.getAttribute('minlength'))) return false;
      return el.type !== 'number' || (Number(el.value) >= Number(el.min || el.getAttribute('min') || '-Infinity') && Number(el.value) <= Number(el.max || el.getAttribute('max') || 'Infinity'));
    };
    el.reportValidity = el.checkValidity;
  }
  form.reportValidity = () => [...fields.values()].every((el: any) => el.checkValidity());
  let focused = '';
  for (const el of document.querySelectorAll('[id], [name]') as any) el.focus = () => { focused = el.id || el.name; };
  (fields.get('lastLesson') as any).value = 'חילוק בתחום לוח הכפל';
  (fields.get('alreadyLearned') as any).value = 'כפל; חילוק\nמספרים';
  Object.defineProperty(document, 'hidden', { value: false });
  let online = options.online ?? true, waking = options.waking ?? false, jobs = options.jobs || [], uuid = 0, timer = 0;
  let now = Date.now(), emptyCapabilities = options.emptyCapabilities ?? false;
  class LocalDate extends Date { static now() { return now; } }
  const timers = new Map<number, { callback: () => unknown; delay: number }>();
  const calls: { url: string; init: any }[] = [], posts: any[] = [], pendingReplies: Reply[] = [], pendingReads: Reply[] = [];
  let history=options.history || [];
  const jobDetails=options.jobDetails || {};
  let quota=options.quota ?? ownerQuota;
  let tokenPromise: Promise<string> | null = null, firstHealth=options.firstHealth;
  const verification = { ready: (cb: () => void) => cb(), execute: () => tokenPromise || Promise.resolve('local-verification-token') };
  (window as any).grecaptcha = options.captcha !== false ? verification : undefined;
  const fetchLocal = async (url: string, init: any = {}) => {
    calls.push({ url, init });
    if(url==='/teachers/generation-curriculum.json')return {ok:true,arrayBuffer:async()=>Uint8Array.from(options.catalogMismatch?Buffer.from('{}'):catalogBytes).buffer};
    if (url === '/api/noamBotConfig') return { ok: true, json: async () => ({ ok: true, active: true, siteKey: 'K'.repeat(40) }) };
    if(url.startsWith('/api/teacherGeneration?id=')) {
      const id=new URL(url,'https://teachers.example').searchParams.get('id')!;
      const reply=jobDetails[id] ?? {ok:false,status:404,body:{ok:false,code:'JOB_NOT_FOUND'}};
      if(reply.error)throw reply.error;
      return {ok:reply.ok ?? true,status:reply.status ?? 200,json:async()=>reply.body};
    }
    assert.equal(url, '/api/teacherGeneration', 'all requests are intercepted locally');
    if (init.method === 'POST') {
      posts.push(JSON.parse(init.body));
      const reply = pendingReplies.shift() || {};
      if (reply.error) throw reply.error;
      return { ok: reply.ok ?? true, status:reply.status ?? 200, json: async () => reply.body || { ok: true } };
    }
    const initial=firstHealth;firstHealth=undefined;
    const reply = initial ? await initial : pendingReads.shift() || {};
    if (reply.error) throw reply.error;
    return { ok: reply.ok ?? true, status:reply.status, json: async () => reply.body || ({ ok: true, online, waking, quota, history: structuredClone(history), jobs: structuredClone(jobs), capabilities: options.general?{...generalCapabilities,topics:emptyCapabilities?[]:generalCapabilities.topics}:{ acceptedIntakeVersions:[2],topics: emptyCapabilities ? [] : [topic, middle, disabled] } }) };
  };
  vm.runInNewContext(shipped, {
    document, window:browserWindow, URL, TextDecoder, fetch: fetchLocal, crypto: { subtle:webcrypto.subtle,randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
    AbortSignal: { timeout: () => undefined }, Date: LocalDate, console,
    setTimeout: (callback: () => unknown, delay: number) => { timers.set(++timer, { callback, delay }); return timer; },
    clearTimeout: (id: number) => timers.delete(id), setInterval: () => ++timer, clearInterval: () => {},
  });
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  };
  const element = (id: string) => document.getElementById(id) as any;
  const field = (name: string) => fields.get(name) as any;
  const dispatch = async (el: any, type: string) => { el.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true })); await flush(); };
  return { document, window, form, field, element, calls, posts, navigations, pendingReplies, pendingReads, timers, flush, dispatch, focused: () => focused,
    setHistory(value: any[]) { history=value; },
    setQuota(value: Quota) { quota=value; },
    setOnline(value: boolean) { online = value; }, setJobs(value: any[]) { jobs = value; },
    setWaking(value: boolean) { waking = value; }, advance(ms: number) { now += ms; },
    setEmptyCapabilities(value: boolean) { emptyCapabilities = value; },
    holdToken(value: Promise<string>) { tokenPromise = value; },
    async choose(grade = '3', id = 'ג10') {
      for (let i=0;i<3 && !element('wizard-back').hidden;i++) await dispatch(element('wizard-back'), 'click');
      field('gradeNumber').value = grade; await dispatch(field('gradeNumber'), 'change'); await dispatch(form, 'submit');
      if (!id) return;
      field('topicId').value = id; await dispatch(field('topicId'), 'change'); await dispatch(form, 'submit');
      field('level').value = 'b'; await dispatch(field('level'), 'change'); await dispatch(form, 'submit');
      if(options.general || !['ג10','g7:equations'].includes(id)) {const input=form.querySelector('[name=learnedConcept]');if(input)input.checked=true;}
      else if (id === 'ג10') { form.querySelectorAll('[name=learnedDivisor]').forEach((input: any) => { input.checked = true; }); field('boundaryMaxDividend').value = '100'; }
      else field('boundarySignedNumbers').value = 'yes';
    },
    submit: () => dispatch(form, 'submit'), click: (id: string) => dispatch(element(id), 'click'),
    visible: () => dispatch(document, 'visibilitychange'),
    async poll() { const selected = [...timers].find(([, task]) => task.delay === 4000); assert.ok(selected, 'poll scheduled'); timers.delete(selected[0]); await selected[1].callback(); await flush(); },
    async nextRetry() { const selected = [...timers][0]; assert.ok(selected, 'retry scheduled'); timers.delete(selected[0]); await selected[1].callback(); await flush(); return selected[1].delay; },
  };
}

test('the quota notice shows the verified owner exemption before planning', async()=>{
  const app=harness({quota:ownerQuota});
  await app.flush();
  assert.match(app.element('generation-quota').textContent,/ללא מכסה/);
  await app.choose();await app.submit();
  assert.equal(app.element('create-button').disabled,false);
  assert.equal(app.element('create-button').getAttribute('aria-describedby'),'generation-quota');
});

test('trial shows one cumulative balance across midnight and releases a failed reservation', async()=>{
  const endsAt=new Date(Date.now()+48*3600000).toISOString();
  const app=harness({quota:trialQuota(1,endsAt)});
  await app.flush();await app.choose();await app.submit();
  assert.match(app.element('generation-quota').textContent,/1 מתוך 5.*לפי שעון ישראל/);
  app.setQuota(trialQuota(0,endsAt));
  app.advance(25*3600000);await app.visible();await app.click('create-button');
  assert.match(app.element('generation-quota').textContent,/נוצלו כל 5/);
  assert.equal(app.element('create-button').disabled,true);
  assert.equal(app.posts.length,0);
  app.setQuota(trialQuota(1,endsAt));await app.visible();
  assert.equal(app.element('create-button').disabled,false);
});

test('trial expiry disables a previously planned creation and keeps history open', async()=>{
  const endsAt=new Date(Date.now()+3600000).toISOString();
  const app=harness({quota:trialQuota(3,endsAt)});
  await app.flush();await app.choose();await app.submit();
  assert.equal(app.element('create-button').disabled,false);
  app.setQuota(trialQuota(3,endsAt,false));app.advance(3601000);await app.nextRetry();
  assert.match(app.element('generation-quota').textContent,/אינה פתוחה כעת/);
  assert.equal(app.element('generation-history').open,true);
  assert.equal(app.element('generator-availability').hidden,true);
  assert.equal(app.element('generation-creator').hidden,true);
  await app.click('create-button');
  assert.equal(app.posts.length,0);
});

test('an active job response for the test owner never claims a daily limit', async()=>{
  const app=harness({quota:ownerQuota});
  await app.flush();await app.choose();await app.submit();
  app.pendingReplies.push({ok:false,status:423,body:{ok:false,code:'GENERATION_ACTIVE'}});
  await app.click('create-button');
  assert.match(app.element('generation-status').textContent,/כבר מכינים עבורך דף/);
  assert.match(app.element('generation-quota').textContent,/ללא מכסה/);
  assert.equal(app.posts.length,1);
});

test('same-tab return preserves completed selections, lesson edits and current screen',async()=>{
 const storage=new Map<string,string>(),app=harness({storage,general:true});await app.flush();await app.choose('2','ב05');
 app.field('lastLesson').value='תרגלנו חיבור דו־ספרתי ללא המרה';await app.dispatch(app.field('lastLesson'),'input');
 const restored=harness({storage,general:true});await restored.flush();
 assert.match(restored.element('wizard-progress').textContent,/שלב 4/);assert.equal(restored.field('gradeNumber').value,'2');assert.equal(restored.field('topicId').value,'ב05');
 assert.equal(restored.field('level').value,'b');assert.equal(restored.field('lastLesson').value,app.field('lastLesson').value);
 assert.ok(restored.form.querySelector('[name=learnedConcept]:checked'));assert.equal(restored.posts.length,0);
 await restored.submit();const review=harness({storage,general:true});await review.flush();
 assert.equal(review.form.hidden,true);assert.match(review.element('plan-details').textContent,/חיבור דו־ספרתי/);assert.equal(review.posts.length,0);
});

test('a verified catalog restores an existing draft through a temporary failed status read', async()=>{
 const storage=new Map<string,string>(),app=harness({storage,general:true});await app.flush();await app.choose('2','ב05');await app.submit();
 const returned=harness({storage,general:true,firstHealth:Promise.resolve({error:new Error('offline')})});await returned.flush();
 assert.equal(returned.form.hidden,true);assert.equal(returned.field('topicId').value,'ב05');assert.equal(returned.element('create-button').disabled,true);assert.equal(returned.posts.length,0);
 await returned.click('refresh-generation');assert.equal(returned.element('create-button').disabled,false);
});

test('reload during reCAPTCHA keeps the plan and never claims that it was sent',async()=>{
 const storage=new Map<string,string>(),app=harness({storage});await app.flush();await app.choose();await app.submit();
 app.holdToken(new Promise(()=>{}));await app.click('create-button');assert.match(app.element('generation-status').textContent,/טרם נשלחה/);assert.equal(app.posts.length,0);
 const restored=harness({storage});await restored.flush();assert.equal(restored.form.hidden,true);assert.equal(restored.posts.length,0);assert.equal(restored.element('create-button').disabled,false);
});

test('ordinary same-tab navigation during verification waits for the one keepalive POST',async()=>{
 const app=harness();await app.flush();await app.choose();await app.submit();
 let verify!:(token:string)=>void;app.holdToken(new Promise(resolve=>{verify=resolve;}));await app.click('create-button');
 const anchor=app.document.querySelector('a[href="/teachers/start"]')!;
 function leftClick(ctrlKey=false){const event=new app.window.Event('click',{bubbles:true,cancelable:true});Object.assign(event,{button:0,ctrlKey});anchor.dispatchEvent(event);return event;}
 assert.equal(leftClick(true).defaultPrevented,false);assert.equal(leftClick().defaultPrevented,true);assert.equal(app.navigations.length,0);assert.equal(app.posts.length,0);
 verify('local-verification-token');await app.flush();assert.equal(app.posts.length,1);assert.equal(app.calls.find(c=>c.init.method==='POST')?.init.keepalive,true);
 assert.deepEqual(app.navigations,['https://teachers.example/teachers/start']);assert.match(app.element('generation-status').textContent,/הבקשה נשמרה/);
});

test('a stalled verification releases the requested link and cannot send late',async()=>{
 const app=harness();await app.flush();await app.choose();await app.submit();
 let verify!:(token:string)=>void;app.holdToken(new Promise(resolve=>{verify=resolve;}));await app.click('create-button');
 const link=app.document.querySelector('a[href="/teachers/start"]')!;const event=new app.window.Event('click',{bubbles:true,cancelable:true});Object.assign(event,{button:0});link.dispatchEvent(event);
 const deadline=[...app.timers.values()].find(t=>t.delay===25000)!;assert.ok(deadline);deadline.callback();
 assert.equal(app.navigations.length,1);verify('late-token');await app.flush();assert.equal(app.posts.length,0);
});

test('a lost POST receipt reconciles the owner job; return opens its history without posting',async()=>{
 const storage=new Map<string,string>(),app=harness({storage});await app.flush();await app.choose();await app.submit();
 const key=JSON.parse([...storage.values()][0]).requestKey;
 const job={id:'10000000-0000-4000-8000-000000000001',request_key:key,status:'running',phase:'authoring',created_at:new Date().toISOString(),lesson:{topicId:'ג10'}};
 app.setJobs([job]);app.pendingReplies.push({error:new Error('reply lost')});await app.click('create-button');
 assert.equal(app.posts.length,1);assert.equal(Boolean(app.element('generation-history').open),false);assert.match(app.element('generation-status').textContent,/מכינים את השאלות/);
 const completed={...job,status:'needs_review',phase:'needs_review',result:{automatedChecksPassed:true}};
 const restored=harness({storage,jobs:[completed],history:[{...completed,formats:['pdf','docx']}]});await restored.flush();
 assert.equal(restored.element('generation-history').open,true);assert.ok(restored.element('generation-jobs').querySelector('a'));assert.equal(restored.element('create-button').hidden,true);
 assert.equal(restored.posts.length,0);await restored.click('new-generation');assert.equal(storage.size,0);
});

test('truncated successful HTTP response and late database commit reconcile through GET only',async()=>{
 const storage=new Map<string,string>(),app=harness({storage});await app.flush();await app.choose();await app.submit();
 app.pendingReplies.push({status:200,body:{}});await app.click('create-button');assert.equal(app.posts.length,1);
 assert.match(app.element('generation-status').textContent,/טרם התקבל אישור/);
 app.setJobs([{id:'10000000-0000-4000-8000-000000000002',request_key:app.posts[0].requestKey,status:'running',phase:'checking',created_at:new Date().toISOString(),lesson:{}}]);
 await app.poll();assert.match(app.element('generation-status').textContent,/בודקים את התוכן/);assert.equal(app.posts.length,1);
});

test('a missing POST receipt permits only an explicit retry of the original request key',async()=>{
 const storage=new Map<string,string>(),app=harness({storage});await app.flush();await app.choose();await app.submit();
 app.pendingReplies.push({error:new Error('connection lost')});await app.click('create-button');assert.equal(app.posts.length,1);
 const restored=harness({storage});await restored.flush();assert.equal(restored.posts.length,0);assert.match(restored.element('generation-status').textContent,/טרם התקבל אישור/);
 await restored.click('create-button');assert.equal(restored.posts[0].requestKey,app.posts[0].requestKey);assert.deepEqual(restored.posts[0].lesson,app.posts[0].lesson);
});

test('denial, explicit logout and another account cannot recover the private plan',async()=>{
 for(const mode of ['forbidden','logout','different-owner']){
  const storage=new Map<string,string>(),app=harness({storage});await app.flush();await app.choose();await app.submit();assert.equal(storage.size,1);
  if(mode==='forbidden'){app.pendingReads.push({ok:false,status:403,body:{ok:false,code:'TEACHER_ACCESS_DENIED'}});await app.click('refresh-generation');assert.equal(app.element('plan-details').textContent,'');}
  if(mode==='logout'){await app.dispatch(app.document.querySelector('[data-teacher-logout]'),'click');}
  if(mode==='different-owner'){const other=harness({storage,owner:'00000000-0000-4000-8000-000000000002'});await other.flush();assert.equal(other.form.hidden,false);assert.equal(other.field('gradeNumber').value,'');}
  assert.equal(storage.size,0);
 }
});

test('offline state permits planning but emits no creation or verification request', async () => {
  const app = harness({ online: false }); await app.flush(); await app.choose(); await app.submit(); await app.click('create-button');
  assert.equal(app.element('create-button').disabled, true);
  assert.equal(app.form.hidden, true);
  assert.equal(app.posts.length, 0);
  assert.equal(app.calls.some(c => c.url === '/api/noamBotConfig'), false);
});

test('an offline worker becoming ready restores the visible lesson without another click or a paid request', async () => {
  const app = harness({ online: false, general: true });
  await app.flush();
  await app.choose('8', 'g8:congruence');
  await app.submit();
  const details = app.element('plan-details').textContent;
  assert.equal(app.element('create-button').disabled, true);
  app.setOnline(true);
  assert.equal(await app.nextRetry(), 60000);
  assert.equal(app.element('create-button').disabled, false);
  assert.equal(app.element('plan-details').textContent, details);
  assert.equal(app.element('generation-status').textContent, 'המנוע זמין. אפשר ליצור את הדף.');
  assert.equal(app.posts.length, 0);
  assert.equal(app.calls.some(c => c.url === '/api/noamBotConfig'), false);
  assert.equal(app.timers.size, 0);
});

test('a prepared lesson stops automatic availability checks after the maximum worker backoff window', async () => {
  const app = harness({ online: false, general: true });
  await app.flush();
  await app.choose('8', 'g8:congruence');
  await app.submit();
  for (let minute = 1; minute <= 16; minute++) {
    app.advance(60000);
    assert.equal(await app.nextRetry(), 60000);
  }
  assert.equal(app.timers.size, 0);
  assert.equal(app.posts.length, 0);
  assert.equal(app.element('create-button').disabled, true);
  assert.match(app.element('generation-status').textContent, /רענון מצב היצירה/);
});

test('a slow or failing first health request never blocks topic selection or loses a catalog plan', async () => {
  let finishHealth!: (reply: Reply) => void;
  const firstHealth = new Promise<Reply>(resolve => { finishHealth = resolve; });
  const app = harness({ general: true, firstHealth });
  await app.flush(); await app.choose('8', 'g8:congruence');
  app.field('questionCount').value = '24';
  finishHealth({ error: new Error('Worker unavailable') }); await app.flush();
  await app.submit();
  assert.equal(app.form.hidden, true);
  assert.match(app.element('plan-details').textContent, /24 שאלות/);
  assert.equal(app.element('create-button').disabled, true);
  await app.click('create-button'); assert.equal(app.posts.length, 0);
  await app.click('refresh-generation');
  assert.equal(app.element('create-button').disabled, false);
  assert.equal(app.field('topicId').value, 'g8:congruence');
  assert.equal(app.form.querySelector('[name=learnedConcept]:checked')?.value, 'g8:congruence#0');
  assert.equal(app.posts.length, 0);
});

test('worker changes preserve supported levels and counts and require an explicit choice after a level expires', async () => {
  const app = harness({ general: true }); await app.flush(); await app.choose();
  app.field('questionCount').value = '19';
  await app.click('refresh-generation');
  assert.equal(app.field('questionCount').value, '19');
  assert.equal(app.field('level').value, 'b');
  await app.click('wizard-back');
  app.field('level').value = 'e'; await app.dispatch(app.field('level'), 'change'); await app.submit();
  app.pendingReads.push({ body: { ok: true, online: true, capabilities: { acceptedIntakeVersions: [2], topics: [topic] } } });
  await app.click('refresh-generation');
  assert.equal(app.field('topicId').value, 'ג10');
  assert.equal(app.field('questionCount').value, '12');
  assert.equal(app.field('questionCount').readOnly, true);
  assert.equal(app.field('level').value, '');
  assert.equal(app.field('level').options.find((o:any) => o.value === 'e').disabled, true);
  assert.equal(app.focused(), 'level-title');
  await app.click('refresh-generation');
  assert.equal(app.field('questionCount').max, '30');
  assert.equal(app.field('questionCount').readOnly, false);
  assert.equal(app.field('level').options.find((o:any) => o.value === 'e').disabled, false);
});

test('an initial access refusal locks planning even if the public catalog finishes loading', async () => {
  for (const status of [401,403]) {
    const app = harness({ firstHealth: Promise.resolve({status, ok:false, body:{ok:false}}) });
    await app.flush(); await app.choose('8', 'g8:congruence');
    assert.equal(app.element('plan-button').disabled, true);
    assert.match(app.element('wizard-progress').textContent, /שלב 1/);
    assert.equal(app.timers.size, 0);
    assert.equal(app.posts.length, 0);
  }
});

test('cold wake polls only health for at most90 seconds, then requires explicit manual retry', async () => {
  const app = harness({ online: false, waking: true }); await app.flush();
  assert.match(app.element('generator-availability').textContent, /מתחברים למנוע היצירה/);
  assert.equal(app.element('create-button').disabled, true);
  for (let i=0;i<18;i++) { app.advance(5000); assert.equal(await app.nextRetry(), 5000); }
  assert.equal(app.timers.size, 0);
  assert.match(app.element('generator-availability').textContent, /רענון מצב היצירה/);
  await app.visible(); assert.equal(app.timers.size, 0, 'visibility does not restart the exhausted wake window');
  assert.equal(app.posts.length, 0);
  assert.equal(app.calls.some(call => call.url === '/api/noamBotConfig'), false);
  await app.click('refresh-generation'); assert.equal(app.timers.size, 1);
  app.setOnline(true); app.setWaking(false); app.advance(5000); await app.nextRetry();
  assert.equal(app.timers.size, 0); assert.match(app.element('generator-availability').textContent, /אפשר לתכנן דף בכל נושא/);
  assert.equal(app.posts.length, 0, 'readiness never automatically creates a draft');
});

test('first cloud heartbeat populates previously missing capabilities without hiding completed downloads', async () => {
  const jobs = [{ id: 'completed', status: 'needs_review', phase: 'needs_review', created_at: '2026-11-14T00:00:00Z', lesson: {}, result: { automatedChecksPassed: true } }];
  const app = harness({ online: false, waking: true, emptyCapabilities: true, jobs, history:[{...jobs[0],formats:['pdf','docx']}] }); await app.flush();
  app.field('gradeNumber').value = '3'; await app.dispatch(app.field('gradeNumber'), 'change');
  assert.equal(app.field('topicId').disabled, false);
  assert.equal(app.document.querySelectorAll('a.download').length, 2);
  app.setEmptyCapabilities(false); app.setOnline(true); app.setWaking(false);
  app.advance(5000); await app.nextRetry();
  assert.equal(app.field('topicId').disabled, false);
  assert.equal(app.field('topicId').options.length,26);
  assert.equal(app.posts.length, 0);
});

test('a POST cold-start refusal retains its idempotency key and requires a new user click after readiness', async () => {
  const app = harness(); await app.flush(); await app.choose(); await app.submit();
  app.pendingReplies.push({ ok: false, body: { ok: false, code: 'GENERATOR_WAKING' } });
  app.setOnline(false); app.setWaking(true); await app.click('create-button');
  assert.equal(app.posts.length, 1); assert.equal(app.element('create-button').disabled, true);
  app.setOnline(true); app.setWaking(false); app.advance(5000); await app.nextRetry();
  assert.equal(app.posts.length, 1); assert.equal(app.element('create-button').disabled, false);
  await app.click('create-button');
  assert.equal(app.posts.length, 2); assert.equal(app.posts[1].requestKey, app.posts[0].requestKey);
});

test('pending dispatch is visible and refresh retains the original queued job without another creation', async () => {
  const app=harness();await app.flush();await app.choose();await app.submit();
  const queued={id:'preserved-job',status:'queued',phase:'queued',created_at:'2026-11-14T00:00:00Z',lesson:{topicId:'ג10'}};
  app.pendingReplies.push({body:{ok:true,job:queued,dispatchPending:true}});app.setJobs([queued]);
  await app.click('create-button');
  const key=app.posts[0].requestKey;
  assert.match(app.element('generation-status').textContent,/הבקשה נשמרה בתור/);
  assert.match(app.element('generation-status').textContent,/בלי ליצור בקשה נוספת/);
  assert.equal(app.element('create-button').disabled,true);assert.equal(app.element('edit-plan').disabled,true);
  await app.click('create-button');await app.click('refresh-generation');await app.poll();
  assert.equal(app.posts.length,1);assert.equal(app.posts[0].requestKey,key);
  assert.equal(app.calls.filter(c=>c.url==='/api/noamBotConfig').length,1);
  assert.match(app.element('generation-status').textContent,/הבקשה נשמרה בתור/);
  app.setJobs([{...queued,status:'running',phase:'authoring'}]);await app.poll();
  assert.match(app.element('generation-status').textContent,/מכינים את השאלות/);
  assert.doesNotMatch(app.element('generation-status').textContent,/הבקשה נשמרה בתור/);
  assert.equal(app.posts.length,1);
});

test('planning uses enabled exact topic/level/count and makes no billed request', async () => {
  const app = harness(); await app.flush(); await app.choose();
  assert.equal(app.field('topicId').options.length,26);
  assert.equal(app.field('questionCount').value, '12'); assert.equal(app.field('questionCount').readOnly, true);
  assert.equal(app.field('level').options.find((o: any) => o.value === 'a').disabled, true);
  assert.equal(app.field('level').options.find((o: any) => o.value === 'e').disabled, true);
  await app.submit(); assert.equal(app.form.hidden, true); assert.equal(app.element('generation-plan').hidden, false);
  assert.match(app.element('plan-details').textContent, /12 שאלות/); assert.equal(app.posts.length, 0);
  await app.click('edit-plan'); await app.choose('7', 'g7:equations');
  assert.equal(app.field('questionCount').value, '20'); assert.equal(app.field('questionCount').min, '20'); assert.equal(app.field('questionCount').max, '20');
});

test('one in-flight verification prevents double submit, including a visibility refresh', async () => {
  const app = harness(); await app.flush(); await app.choose(); await app.submit();
  let finish!: (token: string) => void;
  app.holdToken(new Promise(resolve => { finish = resolve; }));
  await app.click('create-button'); await app.visible(); await app.click('create-button');
  app.setJobs([{ id: 'job-one', status: 'queued', phase: 'queued', created_at: '2026-11-12T00:00:00Z', lesson: {} }]);
  finish('verified-token'); await app.flush();
  assert.equal(app.posts.length, 1); assert.equal(app.element('create-button').disabled, true);
  assert.equal(app.element('edit-plan').disabled, true);
});

test('network retry preserves idempotency, editing creates a new request key', async () => {
  const app = harness(); await app.flush(); await app.choose(); await app.submit();
  app.pendingReplies.push({ error: new Error('Temporary local transport failure') }); await app.click('create-button');
  assert.equal(app.element('edit-plan').disabled, false); assert.equal(app.posts.length, 1);
  await app.click('refresh-generation'); assert.equal(app.posts.length, 1, 'manual status check does not enqueue');
  await app.click('create-button'); assert.equal(app.posts.length, 2); assert.equal(app.posts[0].requestKey, app.posts[1].requestKey);
  assert.deepEqual(app.posts[1].lesson.alreadyLearned, ['כפל', 'חילוק', 'מספרים']);
  await app.click('edit-plan'); app.field('lastLesson').value = 'תרגול חדש בתוך אותו נושא'; await app.submit(); await app.click('create-button');
  assert.notEqual(app.posts[2].requestKey, app.posts[0].requestKey);
});

test('completed and failed requests need an explicit new-draft action before a fresh key is issued', async () => {
  for (const terminalStatus of ['needs_review', 'failed']) {
    const app = harness(); await app.flush(); await app.choose(); await app.submit();
    const active = { id: 'first-job', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: { topicId: 'ג10' } };
    app.pendingReplies.push({ body: { ok: true, job: { id: active.id } } }); app.setJobs([active]);
    await app.click('create-button'); assert.equal(app.posts.length, 1);
    app.setJobs([{ ...active, status: terminalStatus, phase: terminalStatus, result: { automatedChecksPassed: terminalStatus === 'needs_review' } }]);
    await app.poll();
    assert.equal(app.element('create-button').hidden, true); assert.equal(app.element('new-generation').hidden, false);
    await app.click('create-button'); assert.equal(app.posts.length, 1, 'old creation control cannot resubmit a terminal request');
    await app.click('new-generation'); assert.equal(app.form.hidden, false); assert.equal(app.element('generation-plan').hidden, true);
    await app.submit(); app.pendingReplies.push({ body: { ok: true, job: { id: 'second-job' } } });
    app.setJobs([{ ...active, id: 'second-job' }]); await app.click('create-button');
    assert.equal(app.posts.length, 2); assert.notEqual(app.posts[0].requestKey, app.posts[1].requestKey);
  }
});

test('one failed poll recovers with a bounded GET retry and never enqueues again', async () => {
  const active = { id: 'active', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: {} };
  const app = harness({ jobs: [active] }); await app.flush();
  app.pendingReads.push({ error: new Error('Transient local poll failure') }); await app.poll();
  assert.equal(app.element('refresh-generation').hidden, false); assert.equal(app.element('create-button').disabled, true);
  const completed={...active,status:'needs_review',result:{automatedChecksPassed:true}};
  app.setJobs([completed]); app.setHistory([{...completed,formats:['pdf','docx']}]);
  assert.equal(await app.nextRetry(), 2000);
  assert.equal(app.element('edit-plan').disabled, false); assert.equal(app.document.querySelectorAll('#generation-jobs a').length, 2);
  assert.equal(app.posts.length, 0);
});

test('poll failures stop after three automatic retries and visible manual refresh recovers', async () => {
  const active = { id: 'active', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: {} };
  const app = harness({ jobs: [active] }); await app.flush();
  app.pendingReads.push(...Array.from({ length: 4 }, () => ({ error: new Error('Offline fixture') })));
  await app.poll();
  for (const delay of [2000, 4000, 8000]) assert.equal(await app.nextRetry(), delay);
  assert.equal(app.timers.size, 0, 'automatic retries are bounded');
  assert.equal(app.element('refresh-generation').hidden, false); assert.equal(app.element('refresh-generation').disabled, false);
  assert.equal(app.element('create-button').disabled, true, 'unknown running state must not permit a fresh task');
  assert.match(app.element('generation-status').textContent, /רענון מצב היצירה/);
  app.setJobs([{ ...active, status: 'failed', phase: 'failed' }]); await app.click('refresh-generation');
  assert.equal(app.element('edit-plan').disabled, false); assert.equal(app.posts.length, 0);
});

test('knowledge context accepts120 characters and rejects121 before planning or CAPTCHA', async () => {
  const app = harness(); await app.flush(); await app.choose();
  app.field('alreadyLearned').value = 'א'.repeat(120); await app.submit(); assert.equal(app.form.hidden, true);
  await app.click('edit-plan'); app.field('alreadyLearned').value = 'א'.repeat(121); await app.submit();
  assert.equal(app.form.hidden, false); assert.equal(app.element('generation-plan').hidden, true);
  assert.match(app.element('generation-status').textContent, /120/);
  assert.equal(app.posts.length, 0); assert.equal(app.calls.some(call => call.url === '/api/noamBotConfig'), false);
});

test('completion unlocks editing and exposes only gated PDF/Word download links', async () => {
  const active = { id: 'job&one', status: 'running', phase: 'rendering', created_at: '2026-11-12T00:00:00Z', lesson: { topicId: 'ג10', lastLesson: 'לוח הכפל' } };
  const app = harness({ jobs: [active] }); await app.flush();
  assert.equal(app.element('create-button').disabled, true);
  const completed={...active,status:'needs_review',phase:'needs_review',result:{automatedChecksPassed:true}};
  app.setJobs([completed]);app.setHistory([{...completed,formats:['pdf','docx']}]); await app.poll();
  assert.equal(app.element('edit-plan').disabled, false);
  const links = [...app.document.querySelectorAll('#generation-jobs a')];
  assert.equal(links.length, 2); assert.equal(links[0].getAttribute('href'), '/api/teacherGeneration?id=job%26one&file=pdf');
  app.setHistory([]);app.setJobs([{ ...active, status: 'needs_review', result: { automatedChecksPassed: false } }]); await app.visible();
  assert.equal(app.document.querySelectorAll('#generation-jobs a').length, 0);
});

test('history and plan treat model/user strings as text, never HTML', async () => {
  const attack = '<img src=x onerror="globalThis.pwned=true"><script>evil()</script>';
  const app = harness({ history: [{ id: 'safe', status: 'needs_review', formats:['docx'], result:{automatedChecksPassed:true}, created_at: '2026-11-12T00:00:00Z', lesson: { lastLesson: attack } }] });
  await app.flush(); await app.choose(); app.field('lastLesson').value = attack; await app.submit();
  assert.equal(app.document.querySelectorAll('img,script').length, 0);
  assert.ok(app.element('generation-jobs').textContent.includes(attack)); assert.ok(app.element('plan-details').textContent.includes(attack));
});

test('captcha script failure permits a fresh load on retry without creating a job', async () => {
  const app = harness({ captcha: false }); await app.flush(); await app.choose(); await app.submit(); await app.click('create-button');
  const first = app.document.querySelector('script') as any; assert.ok(first); first.onerror(); await app.flush();
  assert.equal(app.posts.length, 0); assert.equal(app.element('edit-plan').disabled, false);
  await app.click('create-button'); const second = app.document.querySelector('script') as any;
  assert.ok(second); assert.notEqual(second, first); second.onerror(); await app.flush();
  assert.equal(app.posts.length, 0);
});

test('unsupported grade cannot be planned through an implicit form submit', async () => {
  const app = harness(); await app.flush(); await app.choose('8', ''); await app.submit();
  assert.equal(app.form.hidden, false); assert.equal(app.element('generation-plan').hidden, true);
});

test('wizard presents one question at a time and focuses each new screen heading', async () => {
  const app = harness(); await app.flush();
  const screens = () => [...app.form.querySelectorAll('[data-generation-step]')] as any[];
  const visible = () => screens().filter(screen => !screen.hidden);
  assert.equal(visible().length, 1); assert.equal(visible()[0].getAttribute('aria-labelledby'), 'grade-title');
  assert.equal(app.element('wizard-back').hidden, true);
  await app.submit(); assert.equal(visible()[0].getAttribute('aria-labelledby'), 'grade-title', 'empty required grade cannot advance');
  for (const [name, value, next] of [['gradeNumber', '3', 'topic-title'], ['topicId', 'ג10', 'level-title'], ['level', 'b', 'lesson-title']]) {
    app.field(name).value = value; await app.dispatch(app.field(name), 'change'); await app.submit();
    assert.equal(visible().length, 1); assert.equal(visible()[0].getAttribute('aria-labelledby'), next);
    assert.equal(app.focused(), next);
    assert.ok(screens().filter(screen => screen.hidden).every(screen => screen.disabled));
  }
  assert.match(app.element('wizard-progress').textContent, /שלב 4 מתוך 5/);
  assert.equal(app.posts.length, 0); assert.equal(app.calls.some(c => c.url === '/api/noamBotConfig'), false);
});

test('back preserves input while changing grade clears dependent choices and uses only available capabilities', async () => {
  const app = harness(); await app.flush(); await app.choose();
  app.field('lastLesson').value = 'התקדמות שנשמרת במעבר אחורה'; app.field('minutes').value = '45';
  await app.click('wizard-back'); assert.equal(app.field('level').value, 'b');
  await app.click('wizard-back'); assert.equal(app.field('topicId').value, 'ג10');
  await app.click('wizard-back'); assert.equal(app.field('gradeNumber').value, '3');
  app.field('gradeNumber').value = '9'; await app.dispatch(app.field('gradeNumber'), 'change'); await app.submit();
  assert.equal(app.field('topicId').value, ''); assert.equal(app.field('level').value, '');
  assert.equal(app.element('topic-unavailable').hidden, true); assert.equal(app.element('plan-button').disabled, false);
  assert.equal(app.document.querySelector('#topic-unavailable a')?.getAttribute('href'), '/teachers/app');
  assert.equal(app.field('lastLesson').value, 'התקדמות שנשמרת במעבר אחורה'); assert.equal(app.field('minutes').value, '45');
  await app.choose('7', 'g7:equations');
  assert.equal(app.element('topic-unavailable').hidden, true); assert.equal(app.field('questionCount').value, '20');
  assert.match(app.field('lastLesson').placeholder,/פעולות הפוכות/);
  assert.doesNotMatch(app.field('lastLesson').placeholder,/חילוק/);
  await app.click('wizard-back'); await app.click('wizard-back');
  await app.dispatch(app.field('topicId'), 'change');
  assert.equal(app.field('level').value, '', 'a new topic choice requires a new explicit level choice');
  assert.equal(app.posts.length, 0);
});

test('optional invalid details open before focus and an active job keeps the download gallery compact', async () => {
  const old = { id: 'old', status: 'needs_review', phase: 'needs_review', created_at: '2026-11-12T00:00:00Z', lesson: {}, result: { automatedChecksPassed: true } };
  const app = harness({ jobs: [old] }); await app.flush(); await app.choose();
  assert.equal(app.element('generation-history').hasAttribute('open'), false);
  app.field('minutes').value = '9'; await app.submit();
  assert.equal(app.element('lesson-options').open, true); assert.equal(app.form.hidden, false);
  app.field('minutes').value = '30'; await app.submit();
  app.setJobs([{ ...old, id: 'current', status: 'running', phase: 'authoring' }, old]); await app.click('create-button');
  assert.equal(Boolean(app.element('generation-history').open), false);
  assert.equal(app.posts.length, 1);
});

test('version2 division boundary is explicit, closed and preserved in confirmation and enqueue', async () => {
  const app=harness();await app.flush();await app.choose();
  app.form.querySelectorAll('[name=learnedDivisor]').forEach((input: any)=>{input.checked=false;});
  await app.submit();assert.equal(app.form.hidden,false);assert.match(app.element('generation-status').textContent,/מחלק אחד/);
  app.form.querySelector('[name=learnedDivisor][value="2"]').checked=true;
  app.form.querySelector('[name=learnedDivisor][value="5"]').checked=true;
  app.field('boundaryMaxDividend').value='50';await app.submit();
  assert.match(app.element('plan-details').textContent,/מחולק עד 50/);await app.click('create-button');
  assert.equal(app.posts[0].lesson.version,2);
  assert.deepEqual(app.posts[0].lesson.lessonBoundary,{version:1,kind:'division_facts',allowedDivisors:[2,5],maxDividend:50});
  assert.equal('allowSignedNumbers' in app.posts[0].lesson.lessonBoundary,false);
});

test('signed-number boundary requires a choice and preserves explicit false without guessing from text', async () => {
  const app=harness();await app.flush();await app.choose('7','g7:equations');
  app.field('boundarySignedNumbers').value='';await app.submit();assert.equal(app.form.hidden,false);
  app.field('boundarySignedNumbers').value='no';await app.submit();
  assert.match(app.element('plan-details').textContent,/ללא מספרים שליליים/);await app.click('create-button');
  assert.deepEqual(app.posts[0].lesson.lessonBoundary,{version:1,kind:'linear_equations',allowSignedNumbers:false});
  assert.equal('allowedDivisors' in app.posts[0].lesson.lessonBoundary,false);
});

test('topic change invalidates learned boundary but plain Back preserves it', async () => {
  const app=harness();await app.flush();await app.choose();app.field('boundaryMaxDividend').value='40';
  await app.click('wizard-back');await app.submit();assert.equal(app.field('boundaryMaxDividend').value,'40');
  await app.click('wizard-back');await app.click('wizard-back');await app.dispatch(app.field('topicId'),'change');
  assert.equal(app.field('boundaryMaxDividend').value,'');
  assert.equal(app.form.querySelectorAll('[name=learnedDivisor]:checked').length,0);
  assert.equal(app.field('boundarySignedNumbers').value,'');
});

test('grade8 traverses the real five-step flow, retains explicit scope on refresh and enqueues only matching private runtime',async()=>{
 const app=harness({general:true});await app.flush();await app.choose('8','g8:congruence');
 assert.equal(app.field('topicId').options.length,18);
 assert.equal(app.element('boundary-curriculum').hidden,false);
 const selected=app.form.querySelector('[name=learnedConcept]:checked') as any;
 assert.equal(selected.value,'g8:congruence#0');
 app.field('lastLesson').value='סיימנו לתרגל זיהוי משולשים חופפים';
 await app.click('refresh-generation');assert.equal(app.field('topicId').value,'g8:congruence');assert.equal(selected.checked,true);
 await app.submit();assert.equal(app.form.hidden,true);assert.equal(app.element('create-button').disabled,false);
 assert.match(app.element('plan-details').textContent,/חפיפה|חופפים/);
 assert.equal(app.posts.length,0,'planning and refresh never enqueue');
 await app.click('create-button');assert.equal(app.posts.length,1);
 assert.equal(app.posts[0].lesson.version,3);
 assert.deepEqual(app.posts[0].lesson.lessonBoundary,{version:1,kind:'curriculum_scope',curriculumSha256:GENERATION_CURRICULUM_SHA256,conceptIds:['g8:congruence#0']});
});
test('all topics remain plannable while worker is unready, but even a direct creation click cannot enqueue',async()=>{
 const app=harness({general:true,emptyCapabilities:true});await app.flush();await app.choose('8','g8:congruence');await app.submit();
 assert.equal(app.form.hidden,true);assert.equal(app.element('create-button').disabled,true);await app.click('create-button');
 assert.equal(app.posts.length,0);assert.equal(app.calls.some(c=>c.url==='/api/noamBotConfig'),false);
 app.setEmptyCapabilities(false);await app.click('refresh-generation');assert.equal(app.element('create-button').disabled,false);
 assert.equal(app.posts.length,0,'readiness does not auto-create');
});
test('grade9 tracks are distinct and only expose their own level choices',async()=>{
 const app=harness({general:true});await app.flush();await app.choose('9','g9m:equations');
 assert.equal(app.field('topicId').options.length,43);
 assert.match(app.field('topicId').selectedOptions[0].textContent,/מצומצמת/);
 assert.equal(app.field('level').options.find((o:any)=>o.value==='a').disabled,true);
 await app.click('wizard-back');await app.click('wizard-back');app.field('topicId').value='g9r:alg_technique';await app.dispatch(app.field('topicId'),'change');
 assert.match(app.field('topicId').selectedOptions[0].textContent,/רגילה/);
 assert.equal(app.field('level').options.find((o:any)=>o.value==='b').disabled,true);
 assert.equal(app.field('level').options.find((o:any)=>o.value==='e').disabled,false);
});
test('catalog tampering and revoked owner access fail closed before any creation',async()=>{
 const invalid=harness({general:true,catalogMismatch:true});await invalid.flush();await invalid.click('create-button');
 assert.equal(invalid.element('plan-button').disabled,true);assert.equal(invalid.posts.length,0);
 const app=harness({general:true});await app.flush();await app.choose('8','g8:congruence');await app.submit();
 app.pendingReads.push({ok:false,body:{ok:false,code:'TEACHER_ACCESS_DENIED'}});await app.click('refresh-generation');await app.click('create-button');
 assert.equal(app.element('create-button').disabled,true);assert.equal(app.posts.length,0);
 assert.equal(app.calls.some(c=>c.url==='/api/noamBotConfig'),false);
});

test('general review drafts disclose human review and never expose a failed output as downloadable',async()=>{
 const result={authoringProfile:'general-skill-source/v1',automatedChecksPassed:false,renderingChecksPassed:true,humanReviewRequired:true,checks:[{status:'PASS'},{status:'REVIEW'}]};
 const job={id:'review-draft',status:'needs_review',created_at:'2026-11-16T00:00:00Z',lesson:{topicId:'g8:congruence'},result};
 const app=harness({general:true,jobs:[job],history:[{...job,formats:['pdf','docx']}]});await app.flush();
 assert.equal(app.document.querySelectorAll('a.download').length,2);assert.match(app.element('generation-jobs').textContent,/ההסברים או ההוכחות דורשים בדיקה שלך/);
 assert.doesNotMatch(app.element('generation-jobs').textContent,/הבדיקות האוטומטיות עברו/);
 for(const change of [{checks:[{status:'FAIL'}]},{checks:[]},{renderingChecksPassed:false},{automatedChecksPassed:true,checks:[{status:'FAIL'}]}]) {
  app.setHistory([{...job,formats:['pdf','docx'],result:{...result,...change}}]);await app.visible();assert.equal(app.document.querySelectorAll('a.download').length,0);
 }
});

test('punctuation aliases share one explicit choice while preserving every selected source concept ID',async()=>{
 const app=harness({general:true});await app.flush();await app.choose('8','g8:congruence');
 const inputs=Array.from(app.form.querySelectorAll('[name=learnedConcept]')) as any[];
 assert.ok(inputs.length<curriculum.topics.find(t=>t.topicId==='g8:congruence')!.allowedConcepts.length);
 const group=inputs.find(input=>JSON.parse(input.dataset.conceptIds).length>1);assert.ok(group);
 inputs.forEach(input=>{input.checked=false;});group.checked=true;
 await app.submit();await app.click('create-button');
 assert.deepEqual(app.posts[0].lesson.lessonBoundary.conceptIds,JSON.parse(group.dataset.conceptIds));
});

test('failed current requests show their reason outside the download history without resubmitting',async()=>{
 const cases=[
  ['SOURCE_SHAPE','התוכן שנוצר לא עבר את בדיקות הדף'],
  ['SOURCE_PLAIN_MATH','ביטוי מתמטי בתוך טקסט רגיל'],
  ['SOURCE_NOTATION','סימון מתמטי שגוי או לא נתמך'],
  ['SOURCE_RICH_TEXT','מבנה הטקסט בטיוטה'],
  ['PROVIDER_UNAVAILABLE','שירות הכנת השאלות לא היה זמין'],
  ['WORKER_INTERRUPTED','עיבוד הדף בשרת נפסק'],
  ['unexpected private detail','הטיוטה לא הושלמה']
 ];
 for(const [error_code,reason] of cases){
  const job={id:'10000000-0000-4000-8000-000000000001',status:'running',phase:'authoring',created_at:'2026-11-22T05:00:00Z',lesson:{}};
  const app=harness({jobs:[job]});await app.flush();
  app.setJobs([{...job,status:'failed',error_code}]);await app.poll();
  assert.ok(app.element('generation-status').textContent.includes(reason));
  assert.ok(!app.element('generation-status').textContent.includes(error_code));
  if(error_code.startsWith('SOURCE_'))assert.match(app.element('generation-status').textContent,/אפשר לשלוח בקשה חדשה לאותו שיעור/);
  assert.equal(app.element('generation-jobs').children.length,0);
  assert.equal(app.element('history-empty').hidden,false);
  assert.equal(Boolean(app.element('generation-history').open),false);
  assert.equal(app.posts.length,0);
 }
});

test('only storage-confirmed formats appear in history, independently of recent activity',async()=>{
 const base={created_at:'2026-11-20T00:00:00Z',lesson:{topicId:'ג10'},status:'needs_review',result:{automatedChecksPassed:true}};
 const jobs=[{...base,id:'running',status:'running'},{...base,id:'failed',status:'failed'},{...base,id:'no-files'}];
 const history=[{...base,id:'pdf-only',formats:['pdf']},{...base,id:'word-only',formats:['docx']}];
 const app=harness({jobs,history});await app.flush();
 const links=Array.from(app.document.querySelectorAll('#generation-jobs a'),link=>link.getAttribute('href'));
 assert.deepEqual(links,['/api/teacherGeneration?id=pdf-only&file=pdf','/api/teacherGeneration?id=word-only&file=docx']);
 assert.equal(app.element('generation-jobs').children.length,2);
 app.setHistory([{...base,id:'empty',formats:[]},{...base,id:'incorrect',formats:['zip']},{...base,id:'queued',status:'queued',formats:['pdf']}]);await app.visible();
 assert.equal(app.element('history-empty').hidden,false);assert.equal(app.element('generation-jobs').children.length,0);
});

test('a saved job outside recent activity recovers by its owner-scoped ID; 404 and revoked access stop polling',async()=>{
 const id='10000000-0000-4000-8000-000000000003';
 const key='20000000-0000-4000-8000-000000000003';
 const job={id,request_key:key,lesson:{topicId:'ג10'},status:'running',phase:'authoring',created_at:'2026-11-20T00:00:00Z'};
 const storage=new Map<string,string>(),prior=harness({jobs:[job],storage});await prior.flush();
 const outside=Array.from({length:20},(_,i)=>({...job,id:'other-'+i,request_key:'other-key-'+i,status:'failed'}));
 const cases=[
  {detail:{body:{ok:true,job:{...job,status:'failed',error_code:'PROVIDER_UNAVAILABLE'}}},message:/שירות הכנת השאלות/},
  {detail:{ok:false,status:404,body:{ok:false,code:'JOB_NOT_FOUND'}},message:/השמורה אינה זמינה/},
  {detail:{ok:false,status:403,body:{ok:false,code:'TEACHER_ACCESS_DENIED'}},message:/חשבון Google מאומת/},
  {detail:{ok:false,status:401,body:{ok:false,error:'Unauthorized'}},message:/להתחבר שוב/}
 ];
 for(const entry of cases){
  const app=harness({storage:new Map(storage),jobs:outside,jobDetails:{[id]:entry.detail}});await app.flush();
  assert.equal(app.calls.filter(c=>c.url==='/api/teacherGeneration?id='+id).length,1);
  assert.match(app.element('generation-status').textContent,entry.message);
  assert.equal(app.timers.size,0);assert.equal(app.posts.length,0);
  assert.equal(Boolean(app.element('generation-history').open),false);
 }
});
