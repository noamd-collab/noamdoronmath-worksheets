/* Owner-only UI. Server and database independently authorize every request. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id), form = $('generation-form');
 if (!form) return;
 const api = '/api/teacherGeneration';
 const labels = {queued:'ממתין ליצירה',authoring:'מכינים את השאלות',checking:'בודקים את התוכן והתשובות',rendering:'מפיקים PDF ו־Word',needs_review:'טיוטה מוכנה לעיון שלך',failed:'היצירה נעצרה בבדיקה'};
 const errors = {TEACHER_SIGN_IN_REQUIRED:'החיבור פג. יש להתחבר שוב עם Google.',TEACHER_ACCESS_DENIED:'יצירת הדפים החדשה עדיין זמינה רק לנועם.',GENERATOR_OFFLINE:'מנוע היצירה אינו מחובר כרגע. לא נוצרה בקשה חדשה.',GENERATION_UNAVAILABLE:'היצירה אינה זמינה כרגע. אפשר לנסות שוב; אותה בקשה לא תיווצר פעמיים.',GENERATION_LIMIT:'כבר יש יצירה פעילה, או שהגעת למכסת חמש היצירות ליום בשלב הזה.',BOT_VERIFICATION_FAILED:'אימות הדפדפן לא הושלם. נסה שוב; אם הבעיה נמשכת, יש לאפשר את רכיב Google בדפדפן.',TOPIC_NOT_SUPPORTED_YET:'הנושא או סוג הדף עדיין אינם זמינים ליצירה.',REQUEST_CONFLICT:'הבקשה השתנתה. חזור לפרטים ואשר אותם מחדש.',LESSON_INVALID:'יש לתקן את פרטי השיעור לפני היצירה.'};
 let capabilities = [], online = false, planned = null, requestKey = null, polling = null, clock = null, startedAt = null, busy = false, submitting = false;
 let submittedJobId = null, terminal = false, pollFailures = 0, refreshing = null, initialized = false;
 const field = name => form.elements.namedItem(name);
 const steps=Array.from(form.querySelectorAll('[data-generation-step]')), stepNames=['כיתה','נושא','רמה','השיעור'];
 let step=0;
 const node = (tag,text,cls) => { const el=document.createElement(tag); if(text) el.textContent=text; if(cls) el.className=cls; return el; };
 const refreshButton=node('button','רענון מצב היצירה');refreshButton.type='button';refreshButton.id='refresh-generation';$('generation-status').after(refreshButton);
 const newDraftButton=node('button','הכנת דף נוסף','primary');newDraftButton.type='button';newDraftButton.id='new-generation';newDraftButton.hidden=true;$('edit-plan').parentNode.append(newDraftButton);
 async function read(url, init) {
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...init});
  const body=await response.json();
  if(!response.ok || !body.ok) { const err=new Error(errors[body.code || body.error] || 'לא הצלחנו להשלים את הבקשה.'); err.issues=body.issues;err.status=response.status; throw err; }
  return body;
 }
 function status(text) { $('generation-status').textContent=text; }
 function updateWizard(focus=false) {
  steps.forEach((screen,index)=>{screen.hidden=index!==step;screen.disabled=index!==step || busy;});
  $('wizard-progress').textContent=`שלב ${step+1} מתוך 5 · ${stepNames[step]}`;
  form.querySelectorAll('.wizard-steps li').forEach((marker,index)=>{if(index===step)marker.setAttribute('aria-current','step');else marker.removeAttribute('aria-current');});
  $('wizard-back').hidden=step===0;$('wizard-back').disabled=busy;
  $('plan-button').textContent=step===3?'בדיקת פרטי הדף':'המשך';
  $('plan-button').disabled=busy || !initialized || (step===1 && field('topicId').disabled) || (step===3 && !online);
  if(focus)steps[step].querySelector('h2').focus();
 }
 function showStep(index) {step=index;updateWizard(true);}
 function clearPlan() {planned=null;requestKey=null;submittedJobId=null;terminal=false;}
 function resetBoundary() {
  form.querySelectorAll('[name=learnedDivisor]').forEach(input=>{input.checked=false;});
  field('boundaryMaxDividend').value='';field('boundarySignedNumbers').value='';
  const topic=field('topicId').value;
  for(const [id,enabled] of [['boundary-division',topic==='ג10'],['boundary-equations',topic==='g7:equations']]) {$(id).hidden=!enabled;$(id).disabled=!enabled;}
  field('lastLesson').placeholder=topic==='g7:equations'
   ? 'למשל: תרגלנו הצבה ופעולות הפוכות במשוואות. עדיין לא עברנו למשוואות עם סוגריים.'
   : 'למשל: תרגלנו חילוק ללא שארית עד 100. עדיין לא עברנו לחילוק עם שארית.';
 }
 function validScreen() {
  // Inactive fieldsets are disabled, so native validation cannot focus hidden
  // required fields. Open optional details before reporting an invalid field.
  for(const control of steps[step].querySelectorAll('input,select,textarea')) {
   if(!control.disabled && !control.checkValidity()) {
    const details=control.closest('details');if(details)details.open=true;
    control.reportValidity();return false;
   }
  }
  return true;
 }
 function stopClock() { clearInterval(clock); clock=null; startedAt=null; }
 function tick(phase) { if(!startedAt) startedAt=Date.now(); clearInterval(clock); const show=()=>status((labels[phase]||labels.queued)+'… '+Math.floor((Date.now()-startedAt)/1000)+' שניות'); show(); clock=setInterval(show,1000); }
 function scheduleRefresh(delay) {clearTimeout(polling);polling=setTimeout(()=>requestRefresh(),delay);}
 function refreshFailed(error) {
  stopClock();clearTimeout(polling);polling=null;pollFailures++;
  const retry=pollFailures<=3 && error.status!==401 && error.status!==403;
  status(error.message+(retry?' ננסה לבדוק שוב את המצב.':' אפשר לבדוק שוב באמצעות „רענון מצב היצירה”.'));
  if(!initialized){$('generator-availability').textContent='לא הצלחנו לבדוק את זמינות היצירה כרגע.';$('generator-availability').classList.add('notice');}
  if(retry)scheduleRefresh(2000*2**(pollFailures-1));
  return null;
 }
 function requestRefresh(resetRetries=false) {
  if(resetRetries)pollFailures=0;
  if(refreshing)return refreshing;
  clearTimeout(polling);polling=null;refreshButton.disabled=true;
  refreshing=refresh().catch(refreshFailed).finally(()=>{refreshing=null;refreshButton.disabled=false;});
  return refreshing;
 }
 function updateTopics() {
  const grade=Number(field('gradeNumber').value), select=field('topicId'); select.replaceChildren(node('option','בחירת נושא'));
  select.options[0].value='';
  for(const topic of capabilities.filter(t=>t.gradeNumber===grade)) { const o=node('option',topic.title);o.value=topic.topicId;select.append(o); }
  select.disabled=select.options.length<2;
  field('level').value='';
  resetBoundary();
  $('topic-unavailable').hidden=!grade || !select.disabled;
  const floor=grade<=2?8:grade<=4?12:grade<=6?14:20;
  field('questionCount').min=String(floor);field('questionCount').value=String(floor);
  field('questionCount').max='30';field('questionCount').readOnly=false;
  $('volume-help').textContent=`לפחות ${floor} שאלות ראשיות בשלב הזה, עם סעיפים לפי הצורך.`;
  updateWizard();
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
  const data=await read(api);online=data.online===true;pollFailures=0;
  capabilities=Array.isArray(data.capabilities?.topics)?data.capabilities.topics.filter(t=>t.enabled===true && t.e2eVerified===true):[];
  $('generator-availability').textContent=online?'היצירה זמינה בנושאים המופיעים לבחירה.':'מנוע היצירה אינו מחובר כרגע. הדפים שכבר נוצרו נשארים זמינים.';
  $('generator-availability').classList.toggle('notice',!online);
  renderJobs(Array.isArray(data.jobs)?data.jobs:[]);
  const current=data.jobs?.find(j=>(submittedJobId && j.id===submittedJobId) || (requestKey && j.request_key===requestKey));
  if(current && ['needs_review','failed'].includes(current.status))terminal=true;
  const active=data.jobs?.find(j=>['queued','running'].includes(j.status));
  if(active || (current && terminal) || (busy && !submitting))$('generation-history').open=true;
  const awaitingCurrent=submittedJobId && !current && !terminal;
  if(active || awaitingCurrent) {busy=true;tick(active?.phase || 'queued');$('create-button').disabled=true;$('edit-plan').disabled=true;scheduleRefresh(4000);}
  else if(!submitting) { const wasBusy=busy;busy=false;stopClock();$('create-button').disabled=!online || terminal;$('edit-plan').disabled=false;$('plan-button').disabled=!online || field('topicId').disabled;if(wasBusy) status('היצירה הסתיימה. התוצאה מופיעה ברשימת הדפים שלך.'); }
  $('create-button').hidden=terminal;$('edit-plan').hidden=terminal;newDraftButton.hidden=!terminal;newDraftButton.disabled=busy || !online;
  if(!initialized) {initialized=true;updateTopics();}
  updateWizard();
  return data;
 }
 function readLesson() {
  const lessonBoundary=field('topicId').value==='ג10'
   ? {version:1,kind:'division_facts',allowedDivisors:Array.from(form.querySelectorAll('[name=learnedDivisor]:checked'),input=>Number(input.value)),maxDividend:Number(field('boundaryMaxDividend').value)}
   : {version:1,kind:'linear_equations',allowSignedNumbers:field('boundarySignedNumbers').value==='yes'};
  return {version:2,gradeNumber:Number(field('gradeNumber').value),topicId:field('topicId').value,level:field('level').value,lessonBoundary,
   lessonGoal:field('lessonGoal').value,lastLesson:field('lastLesson').value.trim(),alreadyLearned:field('alreadyLearned').value.split(/[\n;]/).map(x=>x.trim()).filter(Boolean),
   minutes:Number(field('minutes').value),questionCount:Number(field('questionCount').value),explicitShortSheet:false};
 }
 field('gradeNumber').addEventListener('change',()=>{clearPlan();updateTopics();status('');});
 field('topicId').addEventListener('change',()=>{
  clearPlan();
  const cap=capabilities.find(t=>t.topicId===field('topicId').value);
  for(const option of field('level').options)option.disabled=Boolean(option.value) && !cap?.levels?.includes(option.value);
  field('level').value='';
  resetBoundary();
  const counts=cap?.questionCounts || [];
  if(counts.length) {field('questionCount').value=String(counts[0]);field('questionCount').min=String(Math.min(...counts));field('questionCount').max=String(Math.max(...counts));}
  field('questionCount').readOnly=counts.length===1;
  $('volume-help').textContent=counts.length===1?`בשלב הניסיון נוצר דף של ${counts[0]} שאלות ראשיות.`:'בחר מספר שאלות מתוך ההיקפים הזמינים.';
  updateWizard();
 });
 field('level').addEventListener('change',clearPlan);
 $('wizard-back').addEventListener('click',()=>{if(!busy && step>0){status('');showStep(step-1);}});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(busy || !initialized || !validScreen())return;
  if(step<3) {
   if(step===1 && !capabilities.some(t=>t.gradeNumber===Number(field('gradeNumber').value) && t.topicId===field('topicId').value))return;
   if(step===2 && !capabilities.find(t=>t.topicId===field('topicId').value)?.levels?.includes(field('level').value))return;
   status('');showStep(step+1);return;
  }
  if(!online)return;
  const lesson=readLesson(), topic=capabilities.find(t=>t.topicId===lesson.topicId && t.gradeNumber===lesson.gradeNumber);
  if(lesson.lessonBoundary.kind==='division_facts' && !lesson.lessonBoundary.allowedDivisors.length) {status('יש לבחור לפחות מחלק אחד שכבר נלמד.');form.querySelector('[name=learnedDivisor]').focus();return;}
  if(lesson.alreadyLearned.length>40 || lesson.alreadyLearned.some(item=>item.length>120)) {$('lesson-options').open=true;field('alreadyLearned').focus();status('יש לכתוב עד 40 תיאורים של ידע קודם, עד 120 תווים בכל תיאור.');return;}
  if(!topic || !topic.levels?.includes(lesson.level) || !topic.questionCounts?.includes(lesson.questionCount)) { status(errors.TOPIC_NOT_SUPPORTED_YET);return; }
  planned=lesson;requestKey=crypto.randomUUID();submittedJobId=null;terminal=false;
  const details=$('plan-details');details.replaceChildren();
  const boundary=lesson.lessonBoundary;
  const boundaryText=boundary.kind==='division_facts'?'מחלקים: '+boundary.allowedDivisors.join(', ')+' · מחולק עד '+boundary.maxDividend:boundary.allowSignedNumbers?'כולל מספרים שליליים':'ללא מספרים שליליים';
  for(const [title,value] of [['כיתה',field('gradeNumber').selectedOptions[0].textContent],['נושא',topic?.title],['רמה',field('level').selectedOptions[0].textContent],['גבולות התרגול',boundaryText],['נקודת העצירה',planned.lastLesson],['מושגים מוכרים',planned.alreadyLearned.join(' · ')||'לפי תיאור השיעור האחרון'],['היקף',planned.questionCount+' שאלות · '+planned.minutes+' דקות מבוקשות']]) details.append(node('dt',title),node('dd',value));
  form.hidden=true;$('generation-plan').hidden=false;$('create-button').disabled=false;$('plan-title').tabIndex=-1;$('plan-title').focus();status('');
 });
 function prepareNewDraft() {
  if(busy)return;
  clearPlan();
  form.hidden=false;$('generation-plan').hidden=true;$('create-button').hidden=false;$('edit-plan').hidden=false;newDraftButton.hidden=true;
  showStep(3);status('');
 }
 $('edit-plan').addEventListener('click',prepareNewDraft);
 newDraftButton.addEventListener('click',prepareNewDraft);
 refreshButton.addEventListener('click',()=>requestRefresh(true));
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
  if(!planned || busy || !online || terminal)return;busy=true;submitting=true;$('generation-history').open=true;$('create-button').disabled=true;$('edit-plan').disabled=true;updateWizard();tick('queued');
  try {
   const verification=await botToken();
   const created=await read(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestKey,lesson:planned,botToken:verification})});
   submittedJobId=created.job?.id || submittedJobId;
   submitting=false;
   await requestRefresh();
  } catch(e) {submitting=false;busy=false;stopClock();status(e.message+(e.issues?.length?' '+e.issues.map(i=>i.message).join(' '):''));$('create-button').disabled=!online;}
  finally {$('edit-plan').disabled=busy;updateWizard();}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRefresh(true);});
 updateWizard();requestRefresh();
})();
