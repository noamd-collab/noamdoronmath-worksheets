/* Generation eligibility and quota are checked independently by the server. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id), form = $('generation-form');
 if (!form) return;
 const api = '/api/teacherGeneration', logoutButton=document.querySelector('[data-teacher-logout]');
 const curriculumHash='57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b';
 let catalog=[], catalogLoading=null, generalReady=false, legacyReady=false, boundaryLegacy=false, accessDenied=false;
 const labels = {queued:'ממתין ליצירה',authoring:'מכינים את השאלות',checking:'בודקים את התוכן והתשובות',rendering:'מפיקים PDF ו־Word',needs_review:'טיוטה מוכנה לעיון שלך',failed:'היצירה נעצרה בבדיקה'};
 const errors = {TEACHER_SIGN_IN_REQUIRED:'החיבור פג. יש להתחבר שוב עם Google.',TEACHER_ACCESS_DENIED:'כדי להיכנס למחולל יש להתחבר עם חשבון Google מאומת.',GENERATOR_OFFLINE:'מנוע היצירה אינו מחובר כרגע. לא נוצרה בקשה חדשה.',GENERATOR_WAKING:'ממתינים למנוע היצירה. לא נוצרה בקשה חדשה; כשהמנוע יהיה מוכן אפשר יהיה ללחוץ שוב על יצירה.',GENERATION_UNAVAILABLE:'היצירה אינה זמינה כרגע. אפשר לנסות שוב; אותה בקשה לא תיווצר פעמיים.',GENERATION_LIMIT:'נוצלו כל 5 היצירות החינמיות בתקופת ההתנסות. הדפים שהכנתם זמינים ב„הדפים שלי”.',TRIAL_CLOSED:'ההתנסות החינמית אינה פתוחה כעת. אפשר להוריד דפים שכבר הכנתם מ„הדפים שלי”.',GENERATION_ACTIVE:'כבר מכינים עבורך דף. מצב היצירה יופיע בעמוד הזה. אפשר להתחיל דף נוסף כשהוא יסתיים.',BOT_VERIFICATION_FAILED:'אימות הדפדפן לא הושלם. נסה שוב; אם הבעיה נמשכת, יש לאפשר את רכיב Google בדפדפן.',TOPIC_NOT_SUPPORTED_YET:'הנושא או סוג הדף עדיין אינם זמינים ליצירה.',REQUEST_CONFLICT:'הבקשה השתנתה. חזור לפרטים ואשר אותם מחדש.',LESSON_INVALID:'יש לתקן את פרטי השיעור לפני היצירה.'};
 let capabilities = [], online = false, planned = null, requestKey = null, polling = null, clock = null, startedAt = null, busy = false, submitting = false;
 let submittedJobId = null, terminal = false, pollFailures = 0, refreshing = null, initialized = false, dispatchPending = false;
 let wakingUntil = null, wakingChecks = 0, verificationAttempt=null, pendingLink=null, navigationTimer=null;
 const field = name => form.elements.namedItem(name);
 const steps=Array.from(form.querySelectorAll('[data-generation-step]')), stepNames=['כיתה','נושא','רמה','השיעור'];
 let step=0, restorePending=true, attempted=false, receiptChecks=0;
 const draftKey='teacher-generation-draft-v1', owner=form.dataset.draftOwner;
 const draftFields=['gradeNumber','topicId','level','questionCount','minutes','lessonGoal','lastLesson','alreadyLearned','boundaryMaxDividend','boundarySignedNumbers'];
 const uuid=value=>typeof value==='string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
 function forgetDraft() {try {window.sessionStorage.removeItem(draftKey);} catch (_) {}}
 function saveDraft() {
  if(!uuid(owner) || !initialized || accessDenied || logoutButton?.disabled)return;
  restorePending=false;
  const values=Object.fromEntries(draftFields.map(name=>[name,field(name).value]));
  const checked=Array.from(form.querySelectorAll('[type=checkbox]:checked'),input=>input.value);
  const draft={owner,curriculumHash,values,checked,step,version:planned?.version,requestKey,submittedJobId,attempted};
  try {window.sessionStorage.setItem(draftKey,JSON.stringify(draft));} catch (_) {}
 }
 function restoreDraft(healthKnown=true) {
  if(!restorePending)return;
  restorePending=false;
  let saved;
  try {saved=JSON.parse(window.sessionStorage.getItem(draftKey));} catch (_) {return;}
  if(!saved)return;
  if(!uuid(owner) || saved.owner!==owner || saved.curriculumHash!==curriculumHash || !saved.values || !Array.isArray(saved.checked)){forgetDraft();return;}
  const value=name=>typeof saved.values[name]==='string'?saved.values[name].slice(0,1200):'';
  field('gradeNumber').value=value('gradeNumber');updateTopics();
  field('topicId').value=value('topicId');updateTopicSettings(false);
  for(const name of draftFields.slice(2))field(name).value=value(name);
  updateTopicSettings(true);
  for(const input of form.querySelectorAll('[type=checkbox]'))input.checked=saved.checked.includes(input.value);
  const lastStep=field('level').value?3:selectedTopic()?2:field('gradeNumber').value?1:0;
  step=Number.isInteger(saved.step)?Math.min(lastStep,Math.max(0,saved.step)):0;
  requestKey=uuid(saved.requestKey)?saved.requestKey:null;
  submittedJobId=uuid(saved.submittedJobId)?saved.submittedJobId:null;
  attempted=Boolean(requestKey && saved.attempted);
  // Keep a legacy boundary until capabilities have identified its controls.
  if(!healthKnown && saved.version===2)restorePending=true;
  if(requestKey && saved.version && lastStep===3){
   const lesson=readLesson();
   if(lesson.version===saved.version){planned=lesson;showPlan(false);}
  }
  updateWizard();
 }
 const node = (tag,text,cls) => { const el=document.createElement(tag); if(text) el.textContent=text; if(cls) el.className=cls; return el; };
 const refreshButton=node('button','רענון מצב היצירה');refreshButton.type='button';refreshButton.id='refresh-generation';$('generation-status').after(refreshButton);
 const newDraftButton=node('button','הכנת דף נוסף','primary');newDraftButton.type='button';newDraftButton.id='new-generation';newDraftButton.hidden=true;$('edit-plan').parentNode.append(newDraftButton);
 async function read(url, init) {
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...init});
  const body=await response.json().catch(()=>({}));
  if(!response.ok || !body.ok) {
   const authCode=({401:'TEACHER_SIGN_IN_REQUIRED',403:'TEACHER_ACCESS_DENIED'})[response.status];
   const code=(!init && authCode) || body.code || body.error || authCode;
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
 let quotaAllowsCreation=false, quotaBlock='', trialTimer=null;
 function updateQuota(quota) {
  clearTimeout(trialTimer);
  quotaAllowsCreation=false;
  quotaBlock='';
  let message='יתרת היצירות אינה זמינה כרגע. אפשר לרענן את המצב.';
  if(quota?.mode==='owner' && quota.active===true && quota.totalLimit===null && quota.remainingTotal===null) {
   quotaAllowsCreation=true;
   message='חשבון בעל האתר · אפשר ליצור דפים ללא מכסה.';
  } else if(quota?.mode==='trial' && quota.totalLimit===5) {
   const remaining=quota.remainingTotal;
   if(quota.active===false) {
    quotaBlock=errors.TRIAL_CLOSED;
    message=quotaBlock;
   } else if(quota.active===true && Number.isInteger(remaining) && remaining>=0 && remaining<=quota.totalLimit && Number.isFinite(Date.parse(quota.endsAt))) {
    quotaAllowsCreation=remaining>0;
    quotaBlock=quotaAllowsCreation?'':errors.GENERATION_LIMIT;
    const until=new Intl.DateTimeFormat('he-IL',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date(quota.endsAt));
    message='התנסות חינם · יתרת היצירות בחשבון: '+remaining+' מתוך '+quota.totalLimit+'. עד '+until+' לפי שעון ישראל.';
    if(quotaBlock)message+=' '+quotaBlock;
    const delay=Date.parse(quota.endsAt)-Date.now();
    if(delay>0)trialTimer=setTimeout(()=>{
     quotaAllowsCreation=false;
     $('create-button').disabled=true;
     requestRefresh(true);
    },Math.min(delay,2147483647));
   }
  }
  const creator=$('generation-creator');
  if(creator)creator.hidden=Boolean(quotaBlock);
  const banner=$('generation-quota');
  if(banner.textContent!==message)banner.textContent=message;
  const previous=$('generation-status').textContent;
  if(quotaAllowsCreation && (previous===errors.GENERATION_LIMIT || previous===errors.TRIAL_CLOSED))status('');
 }
 function canCreate(lesson) {
  const topic=capabilities.find(t=>t.topicId===lesson?.topicId && t.gradeNumber===lesson?.gradeNumber);
  const legacy=topic?.legacy?.intakeVersion===2?topic.legacy:topic;
  return online && quotaAllowsCreation && topic?.enabled===true && (lesson.version===3?generalReady && topic.readiness==='private_draft':legacyReady && legacy?.e2eVerified===true && legacy.levels?.includes(lesson.level) && legacy.questionCounts?.includes(lesson.questionCount)) &&
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
 function clearPlan() {attempted=false;receiptChecks=0;planned=null;requestKey=null;submittedJobId=null;terminal=false;dispatchPending=false;}
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
 function tick(phase,createdAt) { if(!startedAt) startedAt=Date.parse(createdAt) || Date.now(); clearInterval(clock); const show=()=>status((dispatchPending && phase==='queued'?'הבקשה נשמרה בתור, אך העבודה עדיין לא התחילה. רענון המצב ינסה להעיר את המנוע בלי ליצור בקשה נוספת.':(labels[phase]||labels.queued))+'… '+Math.floor((Date.now()-startedAt)/1000)+' שניות. אפשר לצאת ולחזור לעמוד למעקב.'); show(); clock=setInterval(show,1000); }
 function scheduleRefresh(delay) {clearTimeout(polling);polling=setTimeout(()=>requestRefresh(),delay);}
 function denied(error) {return error.code==='TEACHER_ACCESS_DENIED' || error.code==='TEACHER_SIGN_IN_REQUIRED';}
 function refreshFailed(error) {
  online=false;$('create-button').disabled=true;
  stopClock();clearTimeout(polling);polling=null;pollFailures++;
  if(denied(error)) {
   clearTimeout(trialTimer);$('generation-quota').hidden=true;
   accessDenied=true;restorePending=false;forgetDraft();clearPlan();form.reset?.();$('plan-details').replaceChildren();$('generation-plan').hidden=true;form.hidden=false;step=0;renderHistory([]);updateWizard();
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
   if(health.status==='rejected'){
    if(topics.status==='fulfilled' && !denied(health.reason))restoreDraft(false);
    throw health.reason;
   }
   if(topics.status==='rejected')throw topics.reason;
   return applyHealth(health.value);
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
 const draftValidationErrors=new Set([
  'SOURCE_SHAPE','SOURCE_ADDITION_SCOPE','SOURCE_ANSWER','SOURCE_CONCEPT','SOURCE_COVERAGE',
  'SOURCE_FIGURE','SOURCE_FIGURE_TASK','SOURCE_GEOMETRY','SOURCE_ITEMS','SOURCE_JSON','SOURCE_LANGUAGE',
  'SOURCE_NIQQUD','SOURCE_NUMBER','SOURCE_QUESTIONS','SOURCE_SCOPE',
  'SOURCE_SECTIONS','SOURCE_SIZE','SOURCE_STAR','SOURCE_STARS','SOURCE_TABLE','SOURCE_TEXT','SOURCE_VERSION',
  'SOURCE_VOLUME','QUALITY_GATE_FAILED','INVALID_MODEL_OUTPUT','PROVIDER_INCOMPLETE','PROVIDER_INVALID_RESPONSE',
  'PROVIDER_OUTPUT_TOO_LARGE','WRONG_ANSWER','OUTSIDE_LESSON_BOUNDARY','UNVERIFIED_SOLUTION'
 ]);
 function jobFailureMessage(code) {
  const sourceReasons={
   SOURCE_PLAIN_MATH:'בטיוטה הופיע ביטוי מתמטי בתוך טקסט רגיל, ולכן לא נוצר קובץ להורדה.',
   SOURCE_NOTATION:'בטיוטה הופיע סימון מתמטי שגוי או לא נתמך, ולכן לא נוצר קובץ להורדה.',
   SOURCE_RICH_TEXT:'מבנה הטקסט בטיוטה מנע את הפקתו בקובץ להורדה.'
  };
  if(Object.hasOwn(sourceReasons,code))return sourceReasons[code]+' אפשר לשלוח בקשה חדשה לאותו שיעור.';
  if(draftValidationErrors.has(code))return 'התוכן שנוצר לא עבר את בדיקות הדף. אפשר לשלוח בקשה חדשה לאותו שיעור.';
  if(['PROVIDER_UNAVAILABLE','PROVIDER_HTTP_ERROR','PROVIDER_TLS_ERROR'].includes(code))return 'שירות הכנת השאלות לא היה זמין בזמן היצירה. אפשר לנסות שוב מאוחר יותר.';
  if(code==='WORKER_INTERRUPTED' || code==='WORKER_FAILED')return 'עיבוד הדף בשרת נפסק לפני שהטיוטה הושלמה. אפשר לשלוח בקשת יצירה חדשה.';
  return 'הטיוטה לא הושלמה. כדי לנסות שוב, יש לשלוח בקשת יצירה חדשה.';
 }
 // D22, approved by Noam on 2026-11-25 (runner.V5_NOT_RUN_ALLOWED): the only steps a middle-path
 // worksheet-wire/5 draft may leave as SKIP. The database rule (M1) and the server hold the same list.
 const v5SkipAllowed=['pinned:emit_docx','pinned:catalog/landing','pinned:gate_sections G85–G92',
  'pinned-gate:G85-section-volume:sheet','pinned-gate:G86-terms:sheet','pinned-gate:G87-subtopic-chronology:sheet',
  'pinned-gate:G88-level-parity:sheet','pinned-gate:G89-catalog:sheet','pinned-gate:G92-section-structure:sheet'];
 const record=value=>Boolean(value) && typeof value==='object' && !Array.isArray(value);
 // The worksheet-wire/5 arm of the database rule (M1), clause for clause, as in isTeacherGenerationDraftReady.
 function v5DraftReady(result) {
  const {artifacts,notRun,checks,skill}=result;
  if(!Array.isArray(artifacts) || !Array.isArray(notRun) || !Array.isArray(checks))return false;
  const skillName=record(skill) && typeof skill.name==='string'?skill.name:null;
  return result.authoringProfile==='general-skill-source/v1' && result.humanReviewRequired===true &&
   typeof result.automatedChecksPassed==='boolean' && typeof result.renderingChecksPassed==='boolean' &&
   (skillName==='elementary' || skillName==='middle') &&
   artifacts.length===1 && record(artifacts[0]) && artifacts[0].kind==='pdf' &&
   notRun.every(name=>typeof name==='string') && checks.length>0 &&
   checks.some(c=>record(c) && c.status==='PASS') &&
   checks.every(c=>record(c) && typeof c.name==='string' && (c.status==='PASS' ||
    (c.status==='SKIP' && skillName==='middle' && v5SkipAllowed.includes(c.name) && notRun.includes(c.name)))) &&
   ((result.automatedChecksPassed===false && result.renderingChecksPassed===false) ||
    (notRun.length===0 && checks.every(c=>record(c) && c.status==='PASS')));
 }
 function renderHistory(history) {
  const root=$('generation-jobs'), worksheets=new Set();
  root.replaceChildren();
  for(const job of history) {
   if(job.status!=='needs_review' || !Array.isArray(job.formats))continue;
   const result=job.result, checks=result?.checks;
   // A worksheet-wire/5 draft is decided by its own arm alone and is a PDF only.
   const v5=Boolean(result) && typeof result==='object' && result.authorContract==='worksheet-wire/5';
   const formats=(v5?['pdf']:['pdf','docx']).filter(kind=>job.formats.includes(kind));
   if(!formats.length)continue;
   const v5Ready=v5 && v5DraftReady(result);
   const allPassed=!v5 && result?.automatedChecksPassed===true && (checks===undefined || Array.isArray(checks) && checks.every(c=>c?.status==='PASS'));
   const reviewReady=!v5 && result?.automatedChecksPassed===false && result.authoringProfile==='general-skill-source/v1' && result.renderingChecksPassed===true && result.humanReviewRequired===true && Array.isArray(checks) && checks.length>0 && checks.every(c=>c?.status==='PASS' || c?.status==='REVIEW');
   if(!v5Ready && !allPassed && !reviewReady)continue;
   worksheets.add(job.id);
   const article=node('article',null,'generation-job');
   const topic=catalog.find(t=>t.topicId===job.lesson?.topicId);
   article.append(node('h3',topic?.title || 'דף לשיעור'));
   article.append(node('p',new Date(job.created_at).toLocaleString('he-IL')+' · '+labels.needs_review));
   if(job.lesson?.lastLesson)article.append(node('p','נקודת העצירה: '+job.lesson.lastLesson));
   if(!v5)article.append(node('p',allPassed?'הבדיקות האוטומטיות עברו. יש לעיין בטיוטה לפני שימוש בכיתה.':'טיוטה לבדיקה — חלק מההסברים או ההוכחות דורשים בדיקה שלך.'));
   const actions=node('div',null,'actions');
   for(const kind of formats) {
    const link=node('a',kind==='pdf'?'הורדת PDF לעיון':'הורדת Word לעריכה','download');
    link.href=api+'?id='+encodeURIComponent(job.id)+'&file='+kind;
    actions.append(link);
   }
   article.append(actions);root.append(article);
  }
  $('history-empty').hidden=worksheets.size>0;
  return worksheets;
 }
 async function applyHealth(data) {
  if(pollFailures)status('');
  accessDenied=false;online=data.online===true;
  $('generation-quota').hidden=false;updateQuota(data.quota);
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
  $('generator-availability').hidden=Boolean(quotaBlock);
  $('generator-availability').classList.toggle('notice',!online);
  restoreDraft();
  const history=Array.isArray(data.history)?data.history:[];
  const worksheets=renderHistory(history);
  const jobs=Array.isArray(data.jobs)?data.jobs:[];
  let current=jobs.find(j=>(submittedJobId && j.id===submittedJobId) || (requestKey && j.request_key===requestKey))
   || history.find(j=>j.id===submittedJobId);
  if(!current && uuid(submittedJobId) && !terminal && !submitting){
   const id=submittedJobId;
   try {
    const details=await read(api+'?id='+encodeURIComponent(id));
    if(submittedJobId===id)current=details.job;
   } catch(error) {
    if(error.status!==404)throw error;
    if(submittedJobId===id){
     terminal=true;attempted=false;
     status('בקשת היצירה השמורה אינה זמינה. אפשר להתחיל דף חדש.');
    }
   }
  }
  pollFailures=0;
  if(current){submittedJobId=current.id;attempted=false;dispatchPending=current.status==='queued' && dispatchPending;}
  if(current && ['needs_review','failed'].includes(current.status))terminal=true;
  const active=jobs.find(j=>['queued','running'].includes(j.status));
  if(active && !planned && !current){submittedJobId=active.id;requestKey=active.request_key;}
  if(current || active && !planned)saveDraft();
  if(quotaBlock || (current && worksheets.has(current.id)))$('generation-history').open=true;
  const awaitingCurrent=submittedJobId && !current && !terminal;
  const running=current && ['queued','running'].includes(current.status)?current:active;
  if((running || awaitingCurrent) && !terminal) {
   busy=true;tick(running?.phase || 'queued',running?.created_at);
   $('create-button').disabled=true;$('edit-plan').disabled=true;scheduleRefresh(4000);
  } else if(!submitting) {
   busy=false;stopClock();$('create-button').disabled=!canCreate(planned) || terminal;$('edit-plan').disabled=false;
   if(current?.status==='failed')status(jobFailureMessage(current.error_code));
   else if(current?.status==='needs_review')status(worksheets.has(current.id)?labels.needs_review:'היצירה הסתיימה. קובץ להורדה אינו מופיע בהיסטוריה כרגע.');
   else if(attempted)status('טרם התקבל אישור שהבקשה נשמרה. אפשר לבדוק שוב את המצב או לשלוח שוב את אותה הבקשה.');
  }
  // A timed-out POST may commit after the first owner status read. Only poll; never replay it.
  if(attempted && !submitting && !active && !awaitingCurrent && receiptChecks<3){receiptChecks++;scheduleRefresh(4000);}
  if(waking && !active && !awaitingCurrent){wakingChecks++;scheduleRefresh(Math.min(5000,Math.max(1,wakingUntil-Date.now())));}
  $('create-button').hidden=terminal;$('edit-plan').hidden=terminal;newDraftButton.hidden=!terminal;newDraftButton.disabled=busy || !online || !quotaAllowsCreation;
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
 $('wizard-back').addEventListener('click',()=>{if(!busy && step>0){status('');showStep(step-1);saveDraft();}});
 form.addEventListener('submit',event=>{
  event.preventDefault();if(accessDenied || busy || !initialized || !validScreen())return;
  if(step<3) {
   if(step===1 && !selectedTopic())return;
   if(step===2 && !selectedTopic()?.levels?.includes(field('level').value))return;
   status('');showStep(step+1);saveDraft();return;
  }
  const lesson=readLesson(), topic=selectedTopic();
  if(lesson.lessonBoundary.kind==='curriculum_scope' && !lesson.lessonBoundary.conceptIds.length) {status('סמנו לפחות חלק אחד מתוך החומר שכבר נלמד.');$('boundary-curriculum').focus();return;}
  if(lesson.lessonBoundary.kind==='division_facts' && !lesson.lessonBoundary.allowedDivisors.length) {status('יש לבחור לפחות מחלק אחד שכבר נלמד.');form.querySelector('[name=learnedDivisor]').focus();return;}
  if(lesson.alreadyLearned.length>40 || lesson.alreadyLearned.some(item=>item.length>120)) {$('lesson-options').open=true;field('alreadyLearned').focus();status('יש לכתוב עד 40 תיאורים של ידע קודם, עד 120 תווים בכל תיאור.');return;}
  if(!topic || !topic.levels?.includes(lesson.level)) { status(errors.TOPIC_NOT_SUPPORTED_YET);return; }
  planned=lesson;requestKey=crypto.randomUUID();submittedJobId=null;terminal=false;
  showPlan(true);saveDraft();
 });
 function showPlan(focus) {
  const topic=selectedTopic(),details=$('plan-details');details.replaceChildren();
  const boundary=planned.lessonBoundary;
  const boundaryText=boundary.kind==='curriculum_scope'?conceptGroups(topic).filter(group=>group.ids.some(id=>boundary.conceptIds.includes(id))).map(group=>group.text).join(' · '):boundary.kind==='division_facts'?'מחלקים: '+boundary.allowedDivisors.join(', ')+' · מחולק עד '+boundary.maxDividend:boundary.allowSignedNumbers?'כולל מספרים שליליים':'ללא מספרים שליליים';
  for(const [title,value] of [['כיתה',field('gradeNumber').selectedOptions[0].textContent],['נושא',topic?.title],['רמה',field('level').selectedOptions[0].textContent],['גבולות התרגול',boundaryText],['נקודת העצירה',planned.lastLesson],['מושגים מוכרים',planned.alreadyLearned.join(' · ')||'לפי תיאור השיעור האחרון'],['היקף',planned.questionCount+' שאלות · '+planned.minutes+' דקות מבוקשות']]) details.append(node('dt',title),node('dd',value));
  form.hidden=true;$('generation-plan').hidden=false;$('create-button').disabled=!canCreate(planned);$('plan-title').tabIndex=-1;if(focus)$('plan-title').focus();status(quotaBlock || (canCreate(planned)?'':'פרטי הדף מוכנים. היצירה בנושא הזה ממתינה למנוע זמין; אפשר לרענן את המצב בלי לשנות את הבחירות.'));
 }
 function prepareNewDraft() {
  if(busy || accessDenied)return;
  clearPlan();forgetDraft();
  updateTopicSettings(true);
  form.hidden=false;$('generation-plan').hidden=true;$('create-button').hidden=false;$('edit-plan').hidden=false;newDraftButton.hidden=true;
  showStep(field('level').value?3:2);status('');
 }
 $('edit-plan').addEventListener('click',()=>{prepareNewDraft();saveDraft();});
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
 form.addEventListener('input',saveDraft);form.addEventListener('change',saveDraft);
 function followPendingLink() {
  if(!pendingLink)return false;
  const href=pendingLink;pendingLink=null;clearTimeout(navigationTimer);navigationTimer=null;
  window.location.assign(href);return true;
 }
 document.addEventListener('click',event=>{
  const attempt=verificationAttempt, link=event.target?.closest?.('a[href]');
  if(!attempt || !link || event.defaultPrevented || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download'))return;
  if(link.target && link.target.toLowerCase()!=='_self')return;
  const target=new URL(link.href,window.location.href);
  if(target.origin!==window.location.origin || target.pathname===window.location.pathname && target.search===window.location.search)return;
  // Honour an ordinary link click as soon as this explicit creation has a receipt.
  // If verification stalls, leave with the saved plan instead of trapping the teacher.
  event.preventDefault();pendingLink=target.href;
  if(navigationTimer!==null)clearTimeout(navigationTimer);
  navigationTimer=setTimeout(()=>{
   if(verificationAttempt===attempt){attempt.cancelled=true;verificationAttempt=null;submitting=false;busy=false;updateWizard();}
   followPendingLink();
  },25000);
  status('מסיימים את האימות ושומרים את הבקשה לפני המעבר לדף שבחרתם.');
 });
 logoutButton?.addEventListener('click',forgetDraft);
 $('create-button').addEventListener('click',async()=>{
  if(!planned || busy || !canCreate(planned) || terminal)return;busy=true;submitting=true;$('create-button').disabled=true;$('edit-plan').disabled=true;updateWizard();status('מאמתים את הדפדפן. הבקשה טרם נשלחה. יש להמתין לאישור השמירה.');
  const attempt={cancelled:false};verificationAttempt=attempt;
  try {
   const verification=await botToken();
   if(attempt.cancelled)return;
   verificationAttempt=null;
   if(accessDenied || logoutButton?.disabled){busy=false;submitting=false;return;}
   attempted=true;receiptChecks=0;saveDraft();status('שולחים את הבקשה וממתינים לאישור שהיא נשמרה.');
   const created=await read(api,{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({requestKey,lesson:planned,botToken:verification})});
   submittedJobId=created.job?.id || submittedJobId;dispatchPending=created.dispatchPending===true;
   submitting=false;attempted=false;saveDraft();
   status('הבקשה נשמרה. אפשר לחזור לעמוד כדי לבדוק את מצב היצירה.');
   if(!followPendingLink())await requestRefresh();
  } catch(e) {
   if(attempt.cancelled)return;
   verificationAttempt=null;submitting=false;busy=false;stopClock();status(e.message+(e.issues?.length?' '+e.issues.map(i=>i.message).join(' '):''));
   if(denied(e)){refreshFailed(e);return;}
   if(attempted && (!e.status || e.status<400 || e.status>=500)){await requestRefresh(true);return;}
   attempted=false;saveDraft();
   if(e.code==='TRIAL_CLOSED' || e.code==='GENERATION_LIMIT' || e.code==='GENERATION_ACTIVE') {
    if(e.code!=='GENERATION_ACTIVE')quotaAllowsCreation=false;
    await requestRefresh(true);
    if(!accessDenied && !busy)status(e.message);
   }
   if(e.code==='GENERATOR_WAKING'){online=false;await requestRefresh(true);}
   $('create-button').disabled=busy || terminal || !canCreate(planned);}
  finally {if(!attempt.cancelled)followPendingLink();$('edit-plan').disabled=busy || accessDenied;updateWizard();}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRefresh();});
 updateWizard();requestRefresh();
})();
