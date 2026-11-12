/* Owner-only UI. Server and database independently authorize every request. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id), form = $('generation-form');
 if (!form) return;
 const api = '/api/teacherGeneration';
 const labels = {queued:'ממתין ליצירה',authoring:'מכינים את השאלות',checking:'בודקים את התוכן והתשובות',rendering:'מפיקים PDF ו־Word',needs_review:'טיוטה מוכנה לעיון שלך',failed:'היצירה נעצרה בבדיקה'};
 const errors = {TEACHER_SIGN_IN_REQUIRED:'החיבור פג. יש להתחבר שוב עם Google.',TEACHER_ACCESS_DENIED:'יצירת הדפים החדשה עדיין זמינה רק לנועם.',GENERATOR_OFFLINE:'מנוע היצירה אינו מחובר כרגע. לא נוצרה בקשה חדשה.',GENERATION_UNAVAILABLE:'היצירה אינה זמינה כרגע. אפשר לנסות שוב; אותה בקשה לא תיווצר פעמיים.',GENERATION_LIMIT:'כבר יש יצירה פעילה, או שהגעת למכסת חמש היצירות ליום בשלב הזה.',BOT_VERIFICATION_FAILED:'אימות הדפדפן לא הושלם. נסה שוב; אם הבעיה נמשכת, יש לאפשר את רכיב Google בדפדפן.',TOPIC_NOT_SUPPORTED_YET:'הנושא או סוג הדף עדיין אינם זמינים ליצירה.',REQUEST_CONFLICT:'הבקשה השתנתה. חזור לפרטים ואשר אותם מחדש.',LESSON_INVALID:'יש לתקן את פרטי השיעור לפני היצירה.'};
 let capabilities = [], online = false, planned = null, requestKey = null, polling = null, clock = null, startedAt = null, busy = false, submitting = false;
 const field = name => form.elements.namedItem(name);
 const node = (tag,text,cls) => { const el=document.createElement(tag); if(text) el.textContent=text; if(cls) el.className=cls; return el; };
 async function read(url, init) {
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...init});
  const body=await response.json();
  if(!response.ok || !body.ok) { const err=new Error(errors[body.code || body.error] || 'לא הצלחנו להשלים את הבקשה.'); err.issues=body.issues; throw err; }
  return body;
 }
 function status(text) { $('generation-status').textContent=text; }
 function stopClock() { clearInterval(clock); clock=null; startedAt=null; }
 function tick(phase) { if(!startedAt) startedAt=Date.now(); clearInterval(clock); const show=()=>status((labels[phase]||labels.queued)+'… '+Math.floor((Date.now()-startedAt)/1000)+' שניות'); show(); clock=setInterval(show,1000); }
 function updateTopics() {
  const grade=Number(field('gradeNumber').value), select=field('topicId'); select.replaceChildren(node('option','בחירת נושא'));
  select.options[0].value='';
  for(const topic of capabilities.filter(t=>t.gradeNumber===grade)) { const o=node('option',topic.title);o.value=topic.topicId;select.append(o); }
  select.disabled=select.options.length<2;
  const floor=grade<=2?8:grade<=4?12:grade<=6?14:20;
  field('questionCount').min=String(floor);field('questionCount').value=String(floor);
  $('volume-help').textContent=`לפחות ${floor} שאלות ראשיות בשלב הזה, עם סעיפים לפי הצורך.`;
  $('plan-button').disabled=busy || !online || select.disabled;
  if(grade && select.disabled) status('לכיתה הזו עדיין אין נושא שמוכן לניסיון יצירה. אפשר להשתמש בכלי המורים הקיים.'); else status('');
 }
 function renderJobs(jobs) {
  const root=$('generation-jobs');root.replaceChildren();$('history-empty').hidden=jobs.length>0;
  for(const job of jobs) {
   const article=node('article',null,'generation-job');
   const capability=capabilities.find(t=>t.topicId===job.lesson?.topicId);
   article.append(node('h3',capability?.title || 'דף לשיעור'));
   article.append(node('p',new Date(job.created_at).toLocaleString('he-IL')+' · '+(labels[job.phase]||labels[job.status]||'ממתין')));
   article.append(node('p','נקודת העצירה: '+(job.lesson?.lastLesson || '')));
   if(job.status==='needs_review' && job.result?.automatedChecksPassed===true) {
    article.append(node('p','הבדיקות האוטומטיות עברו. זו עדיין טיוטה: יש לבדוק את התוכן, העברית והעימוד לפני שימוש בכיתה.'));
    const actions=node('div',null,'actions');
    for(const [kind,title] of [['pdf','הורדת PDF לעיון'],['docx','הורדת Word לעריכה']]) { const a=node('a',title,'download');a.href=api+'?id='+encodeURIComponent(job.id)+'&file='+kind;actions.append(a); }
    article.append(actions);
   } else if(job.status==='failed') article.append(node('p','לא נמסר קובץ שלא עבר את הבדיקות. אפשר לשנות את הבקשה ולנסות שוב.'));
   root.append(article);
  }
 }
 async function refresh() {
  const data=await read(api);online=data.online===true;
  capabilities=Array.isArray(data.capabilities?.topics)?data.capabilities.topics.filter(t=>t.enabled===true && t.e2eVerified===true):[];
  $('generator-availability').textContent=online?'היצירה זמינה בחלק מהנושאים. רק נושאים שיש להם מסלול הפקה יוצגו בבחירה.':'מנוע היצירה אינו מחובר כרגע. הדפים שכבר נוצרו נשארים זמינים.';
  renderJobs(Array.isArray(data.jobs)?data.jobs:[]);
  const active=data.jobs?.find(j=>['queued','running'].includes(j.status));
  if(active) { busy=true;tick(active.phase);$('create-button').disabled=true;$('edit-plan').disabled=true;clearTimeout(polling);polling=setTimeout(()=>refresh().catch(e=>{stopClock();status(e.message);}),4000); }
  else if(!submitting) { const wasBusy=busy;busy=false;stopClock();$('create-button').disabled=!online;$('edit-plan').disabled=false;$('plan-button').disabled=!online || field('topicId').disabled;if(wasBusy) status('היצירה הסתיימה. התוצאה מופיעה ברשימת הדפים שלך.'); }
  return data;
 }
 function readLesson() {
  return {version:1,gradeNumber:Number(field('gradeNumber').value),topicId:field('topicId').value,level:field('level').value,
   lessonGoal:field('lessonGoal').value,lastLesson:field('lastLesson').value.trim(),alreadyLearned:field('alreadyLearned').value.split(/[\n;]/).map(x=>x.trim()).filter(Boolean),
   minutes:Number(field('minutes').value),questionCount:Number(field('questionCount').value),explicitShortSheet:false};
 }
 field('gradeNumber').addEventListener('change',updateTopics);
 field('topicId').addEventListener('change',()=>{
  const cap=capabilities.find(t=>t.topicId===field('topicId').value);
  for(const option of field('level').options)option.disabled=!cap?.levels?.includes(option.value);
  field('level').value=cap?.levels?.[0] || 'b';
  const counts=cap?.questionCounts || [];
  if(counts.length) {field('questionCount').value=String(counts[0]);field('questionCount').min=String(Math.min(...counts));field('questionCount').max=String(Math.max(...counts));}
  field('questionCount').readOnly=counts.length===1;
  $('volume-help').textContent=counts.length===1?`בשלב הניסיון נוצר דף של ${counts[0]} שאלות ראשיות.`:'בחר מספר שאלות מתוך ההיקפים הזמינים.';
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();if(!form.reportValidity() || !online || busy)return;
  const lesson=readLesson(), topic=capabilities.find(t=>t.topicId===lesson.topicId && t.gradeNumber===lesson.gradeNumber);
  if(!topic || !topic.levels?.includes(lesson.level) || !topic.questionCounts?.includes(lesson.questionCount)) { status(errors.TOPIC_NOT_SUPPORTED_YET);return; }
  planned=lesson;requestKey=crypto.randomUUID();
  const details=$('plan-details');details.replaceChildren();
  for(const [title,value] of [['כיתה',field('gradeNumber').selectedOptions[0].textContent],['נושא',topic?.title],['רמה',field('level').selectedOptions[0].textContent],['נקודת העצירה',planned.lastLesson],['מושגים מוכרים',planned.alreadyLearned.join(' · ')||'לפי תיאור השיעור האחרון'],['היקף',planned.questionCount+' שאלות · '+planned.minutes+' דקות']]) details.append(node('dt',title),node('dd',value));
  form.hidden=true;$('generation-plan').hidden=false;$('create-button').disabled=false;$('plan-title').tabIndex=-1;$('plan-title').focus();status('');
 });
 $('edit-plan').addEventListener('click',()=>{if(busy)return;planned=null;requestKey=null;form.hidden=false;$('generation-plan').hidden=true;$('plan-button').focus();});
 let captchaScript;
 async function botToken() {
  const config=await read('/api/noamBotConfig');
  if(!config.active || !/^[A-Za-z0-9_-]{20,100}$/.test(config.siteKey))throw new Error('אימות הדפדפן אינו זמין כרגע.');
  if(!window.grecaptcha) {
   if(!captchaScript) captchaScript=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://www.google.com/recaptcha/api.js?render='+encodeURIComponent(config.siteKey);s.onload=resolve;s.onerror=()=>{captchaScript=null;s.remove();reject(new Error('רכיב Google לא נטען.'));};document.head.append(s);});
   await captchaScript;
  }
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('אימות הדפדפן ארך יותר מדי זמן.')),12000);window.grecaptcha.ready(()=>window.grecaptcha.execute(config.siteKey,{action:'teacher_worksheet_generate'}).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);}));});
 }
 $('create-button').addEventListener('click',async()=>{
  if(!planned || busy || !online)return;busy=true;submitting=true;$('create-button').disabled=true;$('edit-plan').disabled=true;tick('queued');
  try {
   const verification=await botToken();
   await read(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestKey,lesson:planned,botToken:verification})});
   submitting=false;
   await refresh();
  } catch(e) {submitting=false;busy=false;stopClock();status(e.message+(e.issues?.length?' '+e.issues.map(i=>i.message).join(' '):''));$('create-button').disabled=!online;}
  finally {$('edit-plan').disabled=busy;}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(e=>status(e.message));});
 refresh().then(updateTopics).catch(e=>{$('generator-availability').textContent=e.message;});
})();
