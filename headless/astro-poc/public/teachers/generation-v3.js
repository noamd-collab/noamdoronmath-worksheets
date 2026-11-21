/* Owner-only UI. Server and database independently authorize every request. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id), form = $('generation-form');
 if (!form) return;
 const api = '/api/teacherGeneration';
 const curriculumHash='57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b';
 let catalog=[], catalogLoading=null, generalReady=false, legacyReady=false, boundaryLegacy=false, accessDenied=false;
 const labels = {queued:'ממתין ליצירה',authoring:'מכינים את השאלות',checking:'בודקים את התוכן והתשובות',rendering:'מפיקים PDF ו־Word',needs_review:'טיוטה מוכנה לעיון שלך',failed:'היצירה נעצרה בבדיקה'};
 const errors = {TEACHER_SIGN_IN_REQUIRED:'החיבור פג. יש להתחבר שוב עם Google.',TEACHER_ACCESS_DENIED:'יצירת הדפים החדשה עדיין זמינה רק לנועם.',GENERATOR_OFFLINE:'מנוע היצירה אינו מחובר כרגע. לא נוצרה בקשה חדשה.',GENERATOR_WAKING:'ממתינים למנוע היצירה. לא נוצרה בקשה חדשה; כשהמנוע יהיה מוכן אפשר יהיה ללחוץ שוב על יצירה.',GENERATION_UNAVAILABLE:'היצירה אינה זמינה כרגע. אפשר לנסות שוב; אותה בקשה לא תיווצר פעמיים.',GENERATION_LIMIT:'כבר יש יצירה פעילה, או שהגעת למכסת חמש היצירות ליום בשלב הזה.',BOT_VERIFICATION_FAILED:'אימות הדפדפן לא הושלם. נסה שוב; אם הבעיה נמשכת, יש לאפשר את רכיב Google בדפדפן.',TOPIC_NOT_SUPPORTED_YET:'הנושא או סוג הדף עדיין אינם זמינים ליצירה.',REQUEST_CONFLICT:'הבקשה השתנתה. חזור לפרטים ואשר אותם מחדש.',LESSON_INVALID:'יש לתקן את פרטי השיעור לפני היצירה.'};
 let capabilities = [], online = false, planned = null, requestKey = null, polling = null, clock = null, startedAt = null, busy = false, submitting = false;
 let submittedJobId = null, terminal = false, pollFailures = 0, refreshing = null, initialized = false, dispatchPending = false;
 let wakingUntil = null, wakingChecks = 0;
 const field = name => form.elements.namedItem(name);
 const steps=Array.from(form.querySelectorAll('[data-generation-step]')), stepNames=['כיתה','נושא','רמה','השיעור'];
 let step=0;
 const node = (tag,text,cls) => { const el=document.createElement(tag); if(text) el.textContent=text; if(cls) el.className=cls; return el; };
 const refreshButton=node('button','רענון מצב היצירה');refreshButton.type='button';refreshButton.id='refresh-generation';$('generation-status').after(refreshButton);
 const newDraftButton=node('button','הכנת דף נוסף','primary');newDraftButton.type='button';newDraftButton.id='new-generation';newDraftButton.hidden=true;$('edit-plan').parentNode.append(newDraftButton);
 async function read(url, init) {
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...init});
  const body=await response.json().catch(()=>({}));
  if(!response.ok || !body.ok) {
   const code=body.code || body.error || ({401:'TEACHER_SIGN_IN_REQUIRED',403:'TEACHER_ACCESS_DENIED'})[response.status];
   const err=new Error(errors[code] || 'לא הצלחנו להשלים את הבקשה.');err.issues=body.issues;err.status=response.status;err.code=code;throw err;
  }
  return body;
 }
 async function loadCatalog() {
  if(catalog.length)return;
  if(catalogLoading)return catalogLoading;
  catalogLoading=(async()=>{
   const response=await fetch('/teachers/generation-curriculum.json',{credentials:'omit',cache:'no-cache',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('לא הצלחנו לטעון את הנושאים. אפשר לנסות לרענן.');
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength>100000)throw new Error('רשימת הנושאים אינה זמינה כרגע.');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   if(hash!==curriculumHash)throw new Error('רשימת הנושאים התעדכנה. יש לרענן את הדף.');
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(data.version!==1 || !Array.isArray(data.topics) || data.topics.length!==232)throw new Error('רשימת הנושאים אינה זמינה כרגע.');
   catalog=data.topics.map(([topicId,order,title,domain,concepts])=>{
    const track=topicId.split(':')[0], elementary=/^[א-ו]/.test(topicId), gradeNumber=elementary?'אבגדהו'.indexOf(topicId[0])+1:data.tracks[track].gradeNumber;
    return {topicId,order,title:gradeNumber===9?title+' · '+data.tracks[track].label:title,gradeNumber,domain,concepts,
     levels:track==='g9m'?['b']:track==='g9r'?['a','e']:['b','a','e']};
   });
  })().finally(()=>{catalogLoading=null;});
  return catalogLoading;
 }
 const selectedTopic=()=>catalog.find(t=>t.topicId===field('topicId').value && t.gradeNumber===Number(field('gradeNumber').value));
 const legacyTopic=()=>!generalReady && legacyReady && capabilities.some(t=>t.topicId===field('topicId').value && t.enabled===true && t.e2eVerified===true && ['ג10','g7:equations'].includes(t.topicId));
 function conceptGroups(topic) {
  const groups=new Map();
  for(const [index,text] of (topic?.concepts || []).entries()) {
   // Merge spelling variants only, never infer a new curricular subtopic.
   let key=/\d/.test(text)?text:text.normalize('NFC').replace(/[\u0591-\u05bd\u05bf-\u05c7'"׳״.\s]/gu,'');
   const triangle=key.replace(/^משפטחפיפה/,'');
   if(/^[צז]{3}$/.test(triangle))key='משפטחפיפה:'+triangle;
   if(!groups.has(key))groups.set(key,{text,ids:[]});
   groups.get(key).ids.push(topic.topicId+'#'+index);
  }
  return Array.from(groups.values());
 }
 function canCreate(lesson) {
  const topic=capabilities.find(t=>t.topicId===lesson?.topicId && t.gradeNumber===lesson?.gradeNumber);
  const legacy=topic?.legacy?.intakeVersion===2?topic.legacy:topic;
  return online && topic?.enabled===true && (lesson.version===3?generalReady && topic.readiness==='private_draft':legacyReady && legacy?.e2eVerified===true && legacy.levels?.includes(lesson.level) && legacy.questionCounts?.includes(lesson.questionCount)) &&
   topic.levels?.includes(lesson.level) && topic.questionCounts?.includes(lesson.questionCount);
 }
 function status(text) { $('generation-status').textContent=text; }
 function updateWizard(focus=false) {
  steps.forEach((screen,index)=>{screen.hidden=index!==step;screen.disabled=index!==step || busy || accessDenied;});
  $('wizard-progress').textContent=`שלב ${step+1} מתוך 5 · ${stepNames[step]}`;
  form.querySelectorAll('.wizard-steps li').forEach((marker,index)=>{if(index===step)marker.setAttribute('aria-current','step');else marker.removeAttribute('aria-current');});
  $('wizard-back').hidden=step===0;$('wizard-back').disabled=busy || accessDenied;
  $('plan-button').textContent=step===3?'בדיקת פרטי הדף':'המשך';
  $('plan-button').disabled=accessDenied || busy || !initialized || (step===1 && field('topicId').disabled);
  if(focus)steps[step].querySelector('h2').focus();
 }
 function showStep(index) {step=index;updateWizard(true);}
 function clearPlan() {planned=null;requestKey=null;submittedJobId=null;terminal=false;dispatchPending=false;}
 function resetBoundary() {
  form.querySelectorAll('[name=learnedDivisor]').forEach(input=>{input.checked=false;});
  field('boundaryMaxDividend').value='';field('boundarySignedNumbers').value='';
  const topic=field('topicId').value;
  const legacy=legacyTopic();boundaryLegacy=legacy;
  for(const [id,enabled] of [['boundary-division',legacy && topic==='ג10'],['boundary-equations',legacy && topic==='g7:equations'],['boundary-curriculum',!legacy]]) {$(id).hidden=!enabled;$(id).disabled=!enabled;}
  const choices=$('curriculum-concepts');choices.replaceChildren();
  if(!legacy)for(const group of conceptGroups(selectedTopic())) {
   const label=node('label'),input=node('input');input.type='checkbox';input.name='learnedConcept';input.value=group.ids[0];input.dataset.conceptIds=JSON.stringify(group.ids);
   label.append(input,node('span',group.text));choices.append(label);
  }
  field('lastLesson').placeholder=legacy && topic==='g7:equations'
   ? 'למשל: תרגלנו הצבה ופעולות הפוכות במשוואות. עדיין לא עברנו למשוואות עם סוגריים.'
   : 'תארו מה כבר תרגלתם, עד איפה הגעתם ומה עדיין לא נלמד בנושא.';
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
 function tick(phase) { if(!startedAt) startedAt=Date.now(); clearInterval(clock); const show=()=>status((dispatchPending && phase==='queued'?'הבקשה נשמרה בתור, אך העבודה עדיין לא התחילה. רענון המצב ינסה להעיר את המנוע בלי ליצור בקשה נוספת.':(labels[phase]||labels.queued))+'… '+Math.floor((Date.now()-startedAt)/1000)+' שניות'); show(); clock=setInterval(show,1000); }
 function scheduleRefresh(delay) {clearTimeout(polling);polling=setTimeout(()=>requestRefresh(),delay);}
 function denied(error) {return error.code==='TEACHER_ACCESS_DENIED' || error.code==='TEACHER_SIGN_IN_REQUIRED';}
 function refreshFailed(error) {
  online=false;$('create-button').disabled=true;
  stopClock();clearTimeout(polling);polling=null;pollFailures++;
  if(denied(error)) {
   accessDenied=true;renderJobs([]);updateWizard();
  }
  const retry=pollFailures<=3 && !accessDenied && (wakingUntil===null || Date.now()<wakingUntil);
  status(error.message+(retry?' ננסה לבדוק שוב את המצב.':' אפשר לבדוק שוב באמצעות „רענון מצב היצירה”.'));
  $('generator-availability').textContent=accessDenied?error.message:'לא הצלחנו לבדוק את זמינות היצירה כרגע.';
  $('generator-availability').classList.add('notice');
  if(retry)scheduleRefresh(2000*2**(pollFailures-1));
  return null;
 }
 function requestRefresh(resetRetries=false) {
  if(resetRetries){pollFailures=0;wakingUntil=null;wakingChecks=0;}
  if(refreshing)return refreshing;
  clearTimeout(polling);polling=null;refreshButton.disabled=true;
  // Planning needs the verified curriculum, even when the worker is waking or unavailable.
  const topicsReady=loadCatalog().then(()=>{
   if(!initialized){initialized=true;updateTopics();}
  });
  refreshing=Promise.allSettled([read(api),topicsReady]).then(([health,topics])=>{
   if(health.status==='rejected')throw health.reason;
   if(topics.status==='rejected')throw topics.reason;
   applyHealth(health.value);
  }).catch(refreshFailed).finally(()=>{refreshing=null;refreshButton.disabled=false;});
  return refreshing;
 }
 function updateTopics() {
  const grade=Number(field('gradeNumber').value), select=field('topicId'); select.replaceChildren(node('option','בחירת נושא'));
  select.options[0].value='';
  for(const topic of catalog.filter(t=>t.gradeNumber===grade)) { const o=node('option',topic.title);o.value=topic.topicId;select.append(o); }
  select.disabled=select.options.length<2;
  $('topic-unavailable').hidden=!grade || !select.disabled;
  updateTopicSettings(false);
 }
 function updateTopicSettings(preserve) {
  const topic=selectedTopic(), grade=Number(field('gradeNumber').value);
  const cap=capabilities.find(t=>t.topicId===topic?.topicId && t.gradeNumber===grade && t.enabled===true);
  const levels=legacyTopic()?cap.levels:topic?.levels;
  const level=field('level');
  for(const option of level.options)option.disabled=Boolean(option.value) && !levels?.includes(option.value);
  if(!preserve || !levels?.includes(level.value))level.value='';
  if(!preserve || boundaryLegacy!==legacyTopic())resetBoundary();
  const floor=grade<=2?8:grade<=4?12:grade<=6?14:20;
  const counts=cap?.questionCounts?.length?cap.questionCounts:Array.from({length:31-floor},(_,i)=>floor+i);
  const count=field('questionCount'), min=String(Math.min(...counts)), max=String(Math.max(...counts));
  if(!preserve || (count.min!==min || count.max!==max) && !counts.includes(Number(count.value)))count.value=min;
  count.min=min;count.max=max;count.readOnly=counts.length===1;
  $('volume-help').textContent=count.readOnly?`בשלב הניסיון נוצר דף של ${count.value} שאלות ראשיות.`:`בוחרים בין ${min} ל־${max} שאלות ראשיות.`;
  if(preserve && step===3 && !level.value)showStep(2);
  updateWizard();
 }
 function renderJobs(jobs) {
  const root=$('generation-jobs');root.replaceChildren();$('history-empty').hidden=jobs.length>0;
  for(const job of jobs) {
   const article=node('article',null,'generation-job');
   const capability=catalog.find(t=>t.topicId===job.lesson?.topicId);
   article.append(node('h3',capability?.title || 'דף לשיעור'));
   article.append(node('p',new Date(job.created_at).toLocaleString('he-IL')+' · '+(labels[job.phase]||labels[job.status]||'ממתין')));
   article.append(node('p','נקודת העצירה: '+(job.lesson?.lastLesson || '')));
   const result=job.result,checks=result?.checks;
   const allPassed=result?.automatedChecksPassed===true && (checks===undefined || Array.isArray(checks) && checks.every(c=>c?.status==='PASS'));
   const reviewReady=result?.automatedChecksPassed===false && result.authoringProfile==='general-skill-source/v1' && result.renderingChecksPassed===true && result.humanReviewRequired===true && Array.isArray(checks) && checks.length>0 && checks.every(c=>c?.status==='PASS' || c?.status==='REVIEW');
   if(job.status==='needs_review' && (allPassed || reviewReady)) {
    article.append(node('p',allPassed?'הבדיקות האוטומטיות עברו. זו עדיין טיוטה: יש לבדוק את התוכן, העברית והעימוד לפני שימוש בכיתה.':'טיוטה לבדיקה — חלק מההסברים או ההוכחות דורשים בדיקה שלך.'));
    const actions=node('div',null,'actions');
    for(const [kind,title] of [['pdf','הורדת PDF לעיון'],['docx','הורדת Word לעריכה']]) { const a=node('a',title,'download');a.href=api+'?id='+encodeURIComponent(job.id)+'&file='+kind;actions.append(a); }
    article.append(actions);
   } else if(job.status==='failed') article.append(node('p','לא נמסר קובץ שלא עבר את הבדיקות. אפשר לשנות את הבקשה ולנסות שוב.'));
   root.append(article);
  }
 }
 function applyHealth(data) {
  if(pollFailures)status('');
  accessDenied=false;online=data.online===true;pollFailures=0;
  if(online){wakingUntil=null;wakingChecks=0;}
  if(!online && data.waking===true && wakingUntil===null)wakingUntil=Date.now()+90000;
  const waking=!online && data.waking===true && Date.now()<wakingUntil && wakingChecks<18;
  generalReady=data.capabilities?.profile==='general-skill-source/v1' && data.capabilities.curriculumSha256===curriculumHash && Array.isArray(data.capabilities.acceptedIntakeVersions) && data.capabilities.acceptedIntakeVersions.includes(3);
  legacyReady=Array.isArray(data.capabilities?.acceptedIntakeVersions) && data.capabilities.acceptedIntakeVersions.includes(2);
  capabilities=Array.isArray(data.capabilities?.topics)?data.capabilities.topics:[];
  $('generator-availability').textContent=online && generalReady?'היצירה זמינה לפי הנושאים והחומר שתבחרו. כל דף חדש נמסר כטיוטה לעיון.':waking
   ? 'מתחברים למנוע היצירה. אחרי זמן ללא שימוש ההתעוררות עשויה להימשך כדקה. לא נוצרת בקשה חדשה.'
   : data.waking===true ? 'המנוע עדיין אינו מוכן. אפשר לנסות שוב באמצעות „רענון מצב היצירה”. הדפים שכבר נוצרו נשארים זמינים.'
   : online && legacyReady?'אפשר לתכנן דף בכל נושא. יצירת חלק מהנושאים עדיין ממתינה לעדכון המנוע.':'מנוע היצירה אינו מחובר כרגע. אפשר לבחור נושא ולתכנן דף; הדפים שכבר נוצרו נשארים זמינים.';
  $('generator-availability').classList.toggle('notice',!online);
  renderJobs(Array.isArray(data.jobs)?data.jobs:[]);
  const current=data.jobs?.find(j=>(submittedJobId && j.id===submittedJobId) || (requestKey && j.request_key===requestKey));
  if(current && current.status!=='queued')dispatchPending=false;
  if(current && ['needs_review','failed'].includes(current.status))terminal=true;
  const active=data.jobs?.find(j=>['queued','running'].includes(j.status));
  if(active || (current && terminal) || (busy && !submitting))$('generation-history').open=true;
  const awaitingCurrent=submittedJobId && !current && !terminal;
  if(active || awaitingCurrent) {busy=true;tick(active?.phase || 'queued');$('create-button').disabled=true;$('edit-plan').disabled=true;scheduleRefresh(4000);}
  else if(!submitting) { const wasBusy=busy;busy=false;stopClock();$('create-button').disabled=!canCreate(planned) || terminal;$('edit-plan').disabled=false;if(wasBusy) status('היצירה הסתיימה. התוצאה מופיעה ברשימת הדפים שלך.'); }
  if(waking && !active && !awaitingCurrent){wakingChecks++;scheduleRefresh(Math.min(5000,Math.max(1,wakingUntil-Date.now())));}
  $('create-button').hidden=terminal;$('edit-plan').hidden=terminal;newDraftButton.hidden=!terminal;newDraftButton.disabled=busy || !online;
  if(!planned && !busy && selectedTopic())updateTopicSettings(true);
  updateWizard();
  return data;
 }
 function readLesson() {
  const legacy=legacyTopic();
  const lessonBoundary=!legacy?{version:1,kind:'curriculum_scope',curriculumSha256:curriculumHash,conceptIds:Array.from(form.querySelectorAll('[name=learnedConcept]:checked')).flatMap(input=>JSON.parse(input.dataset.conceptIds))}:field('topicId').value==='ג10'
   ? {version:1,kind:'division_facts',allowedDivisors:Array.from(form.querySelectorAll('[name=learnedDivisor]:checked'),input=>Number(input.value)),maxDividend:Number(field('boundaryMaxDividend').value)}
   : {version:1,kind:'linear_equations',allowSignedNumbers:field('boundarySignedNumbers').value==='yes'};
  return {version:legacy?2:3,gradeNumber:Number(field('gradeNumber').value),topicId:field('topicId').value,level:field('level').value,lessonBoundary,
   lessonGoal:field('lessonGoal').value,lastLesson:field('lastLesson').value.trim(),alreadyLearned:field('alreadyLearned').value.split(/[\n;]/).map(x=>x.trim()).filter(Boolean),
   minutes:Number(field('minutes').value),questionCount:Number(field('questionCount').value),explicitShortSheet:false};
 }
 field('gradeNumber').addEventListener('change',()=>{clearPlan();updateTopics();status('');});
 field('topicId').addEventListener('change',()=>{
  clearPlan();updateTopicSettings(false);
 });
 field('level').addEventListener('change',clearPlan);
 $('wizard-back').addEventListener('click',()=>{if(!busy && step>0){status('');showStep(step-1);}});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(accessDenied || busy || !initialized || !validScreen())return;
  if(step<3) {
   if(step===1 && !selectedTopic())return;
   if(step===2 && !selectedTopic()?.levels?.includes(field('level').value))return;
   status('');showStep(step+1);return;
  }
  const lesson=readLesson(), topic=selectedTopic();
  if(lesson.lessonBoundary.kind==='curriculum_scope' && !lesson.lessonBoundary.conceptIds.length) {status('סמנו לפחות חלק אחד מתוך החומר שכבר נלמד.');$('boundary-curriculum').focus();return;}
  if(lesson.lessonBoundary.kind==='division_facts' && !lesson.lessonBoundary.allowedDivisors.length) {status('יש לבחור לפחות מחלק אחד שכבר נלמד.');form.querySelector('[name=learnedDivisor]').focus();return;}
  if(lesson.alreadyLearned.length>40 || lesson.alreadyLearned.some(item=>item.length>120)) {$('lesson-options').open=true;field('alreadyLearned').focus();status('יש לכתוב עד 40 תיאורים של ידע קודם, עד 120 תווים בכל תיאור.');return;}
  if(!topic || !topic.levels?.includes(lesson.level)) { status(errors.TOPIC_NOT_SUPPORTED_YET);return; }
  planned=lesson;requestKey=crypto.randomUUID();submittedJobId=null;terminal=false;
  const details=$('plan-details');details.replaceChildren();
  const boundary=lesson.lessonBoundary;
  const boundaryText=boundary.kind==='curriculum_scope'?conceptGroups(topic).filter(group=>group.ids.some(id=>boundary.conceptIds.includes(id))).map(group=>group.text).join(' · '):boundary.kind==='division_facts'?'מחלקים: '+boundary.allowedDivisors.join(', ')+' · מחולק עד '+boundary.maxDividend:boundary.allowSignedNumbers?'כולל מספרים שליליים':'ללא מספרים שליליים';
  for(const [title,value] of [['כיתה',field('gradeNumber').selectedOptions[0].textContent],['נושא',topic?.title],['רמה',field('level').selectedOptions[0].textContent],['גבולות התרגול',boundaryText],['נקודת העצירה',planned.lastLesson],['מושגים מוכרים',planned.alreadyLearned.join(' · ')||'לפי תיאור השיעור האחרון'],['היקף',planned.questionCount+' שאלות · '+planned.minutes+' דקות מבוקשות']]) details.append(node('dt',title),node('dd',value));
  form.hidden=true;$('generation-plan').hidden=false;$('create-button').disabled=!canCreate(planned);$('plan-title').tabIndex=-1;$('plan-title').focus();status(canCreate(planned)?'':'פרטי הדף מוכנים. היצירה בנושא הזה ממתינה למנוע זמין; אפשר לרענן את המצב בלי לשנות את הבחירות.');
 });
 function prepareNewDraft() {
  if(busy || accessDenied)return;
  clearPlan();
  updateTopicSettings(true);
  form.hidden=false;$('generation-plan').hidden=true;$('create-button').hidden=false;$('edit-plan').hidden=false;newDraftButton.hidden=true;
  showStep(field('level').value?3:2);status('');
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
  if(!planned || busy || !canCreate(planned) || terminal)return;busy=true;submitting=true;$('generation-history').open=true;$('create-button').disabled=true;$('edit-plan').disabled=true;updateWizard();tick('queued');
  try {
   const verification=await botToken();
   const created=await read(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestKey,lesson:planned,botToken:verification})});
   submittedJobId=created.job?.id || submittedJobId;dispatchPending=created.dispatchPending===true;
   submitting=false;
   await requestRefresh();
  } catch(e) {submitting=false;busy=false;stopClock();status(e.message+(e.issues?.length?' '+e.issues.map(i=>i.message).join(' '):''));
   if(denied(e)){refreshFailed(e);return;}
   if(e.code==='GENERATOR_WAKING'){online=false;await requestRefresh(true);}
   $('create-button').disabled=!canCreate(planned);}
  finally {$('edit-plan').disabled=busy || accessDenied;updateWizard();}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRefresh();});
 updateWizard();requestRefresh();
})();
