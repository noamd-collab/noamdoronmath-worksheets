import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPublicText } from './read-native-public';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
import { createHash } from 'node:crypto';
const pub=new URL('../public/',import.meta.url),read=(p:string)=>readPublicText(new URL(p,pub));
const modules=['noam-native-visual','noam-source-panels','noam-authored-geometry','noam-authored-visual','noam-visual-data','noam-visual-plan','noam-source-data-visual','noam-source-scaffold'].map(n=>read(n+'.js')).join('\n');
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));assert.ok(s.startsWith('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
// Hash verification may complete on a worker thread. A fixed number of event-loop
// turns is not completion under CI load; wait for the existing request lifecycle.
async function settled(c:any){
 const deadline=Date.now()+5000;
 while(c.busy&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
 assert.equal(c.busy,false,'the hint lifecycle must finish before checking its requests');
}
const CASES:any={
 W15A:{pdf:'1447b1c93a0f481abbd1eccbef8a7551',item:'q20d'},
 W15B:{pdf:'7b2d78cef1f44268ba9265392320ad26',item:'q20d'},
 W15:{pdf:'162e9a4cd15e41c5bb68cc6a1b600e81',item:'q20d'},
 W15final:{pdf:'162e9a4cd15e41c5bb68cc6a1b600e81',item:'q20e'},
 W15construction:{pdf:'162e9a4cd15e41c5bb68cc6a1b600e81',item:'q5b'},
 W11:{pdf:'084c58836048405aa2a2f97ba4396553',item:'q16b'},
 W04:{pdf:'c5910c37949b48a488ec5e3732c48601',item:'q7b'},
 MP02:{pdf:'8474535578894a669c6847e57a83dc30',item:'q21d'},
 // Completeness boundaries (work/ramzi-20261029-native-completeness-boundaries.json).
 'G8-T32/b q4d':{pdf:'45ab1aedeacb4ed5b8b40b4fec71af5b',item:'q4d'},
 'G8-T46/c q20d':{pdf:'162e9a4cd15e41c5bb68cc6a1b600e81',item:'q20d'},
 'G7-T21/b q17a':{pdf:'fe9a1e56bd6d4833afea8c7a4ed4f715',item:'q17a'},
 'G7-T40/c q18b':{pdf:'ca559987a05b4aefb3382e65bd58859f',item:'q18b'},
 'G9-T31/a q22b':{pdf:'3ae0575b833f45a59616944111af5324',item:'q22b'},
 // Real plural references (work/ramzi-native-first-review-recommendations-20261029.md).
 'G7-T39/c q9d':{pdf:'3ca14fc381824c368bd898dc9fd41bed',item:'q9d'},
 'G7-T30/a q8c':{pdf:'a9c792464692445290266483ae5f06e3',item:'q8c'}
};
function contradictory(){return {readable:true,transcription:'OCR transcription',math_content:'OCR: 3×3, 4×4, 5×5',problem_statement:'OCR square pattern',diagram_description:'OCR:9,16,25',extracted_entities:{numbers:[9,16,25]}};}
function fixture(v:string,key:string,edit?:(data:any,manifest:any,exercise:any)=>void,keepHash=false){
 const {pdf,item}=CASES[key],manifest=JSON.parse(read('noam-ai/manifests/'+pdf+'.json'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeItemId===item),data=JSON.parse(read(manifest.nativeExportUrl.slice(1)));
 // The original bytes are served unchanged; an edited package gets its own hash
 // unless the test is about tampered bytes behind the original manifest hash.
 let nativeBody=read(manifest.nativeExportUrl.slice(1));
 if(edit){edit(data,manifest,exercise);nativeBody=JSON.stringify(data);if(!keepHash)manifest.nativeExportSha256=createHash('sha256').update(nativeBody).digest('hex');}
 const {document,window}=parseHTML('<html><body></body></html>'),calls:string[]=[],attachments:any[]=[],thread:any={messages:[],history:[],hintIndex:0};
 const c:any={document,window,manifest,selectedExercise:exercise,pdf,Promise,Map,WeakMap,WeakSet,Set,currentAttachments:()=>attachments,
  noamNativeFocusUrl:()=>manifest.nativeExportUrl,exerciseThread:()=>thread,saveNoamState(){},renderNoamChat(){},announceNoam(){},analysisCache:{},
  cropExerciseCanvas:async()=>({width:640,height:1200,toDataURL:()=> 'data:image/png;base64,QUJD'}),
  fetch:async(url:string)=>{calls.push(url);const body=url===manifest.nativeExportUrl?nativeBody:read(url.slice(1));return {ok:true,json:async()=>JSON.parse(body),text:async()=>body,arrayBuffer:async()=>new TextEncoder().encode(body).buffer};},TextDecoder};
 runInNewContext(modules,c);for(const k of Object.keys(c))if(k.startsWith('Noam'))window[k]=c[k];
 const helpers='var noamSourceVisualPackages='+v.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
 runInNewContext(v.slice(v.indexOf('var SOLVER_MESSAGE_MAX ='),v.indexOf('var GRADE_NAME ='))+'\n'+fn(v,'noamDiagramSourceIdentity')+'\n'+fn(v,'noamManifestOcrUnreliable')+'\n'+fn(v,'noamExerciseSectionLabel')+'\n'+fn(v,'localVisualExerciseSource')+'\n'+helpers+'\n'+v.slice(v.indexOf('function noamGeometryContext(text){'),v.indexOf('function postJson(endpoint,payload){')),c);
 return {c,exercise,manifest,data,calls,attachments,thread};
}
function wireHint(f:any,analysis:any=contradictory()){
 const requests:any[]=[],counter={analysis:0};
 Object.assign(f.c,{busy:false,panelBody:f.c.document.body,noamDrafts:{},MIN_WAIT:0,API:'/model',g:7,lv:'a',LEVEL:{a:'רמה א׳'},ttl:'נושא',
  setNoamBusy:(b:boolean)=>{f.c.busy=b;},restoreNoamChatFocus(){},exerciseLabel:()=> 'סעיף',noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,
  getExerciseAnalysis:async()=>{counter.analysis++;if(analysis instanceof Error)throw analysis;return analysis;},
  postJson:async(url:string,payload:any)=>{requests.push({url,payload});return {ok:true,answer:'בדקו את הנתונים המודפסים.'};},
  noamGuardGeometryResult:(r:any)=>r,noamGuardSignedAddResult:(r:any)=>r,noamClarifySignedAddLanguage:(s:string)=>s,noamResponseVisual:()=>null,
  noamVisualAnswer:(_:string,s:string)=>s,noamAttachSourceHint(){},setTimeout:(cb:any)=>cb()});
 return {requests,counter};
}
// Invoke the exact on-click instruction, not the shorter visible user bubble.
function actualHintInstruction(v:string){
 const m=v.match(/hintButton\.addEventListener\("click",function\(\)\{ askNoam\("hint",("[^"\n]+")\);/);
 assert.ok(m,'actual hint button instruction');return JSON.parse(m[1]);
}
// Exercise the real request, canonical loader, original/photo reader, image
// compositor and cleanup. Only canvas encoding and HTTP transport are stubbed.
function wireSnapshotReader(f:any,v:string){
 const {requests}=wireHint(f);
 Object.assign(f.c,{noamAttachments:{[f.exercise.id]:f.attachments},renderNoamAttachments(){},
  cropExerciseCanvas:async()=>({marker:'original-question'}),
  stackCanvases:(canvases:any[])=>({canvases}),encodeCropCanvas:(stack:any)=>JSON.stringify(stack.canvases.map((c:any)=>c.marker)),
  noamExerciseNeedsLiveVision:()=>false,syntheticAnalysis:()=>({readable:true,content_type:'snapshot-test-original',transcription:'original worksheet'}),
  noamScopedExerciseSemantic:()=>f.exercise.prompt,
  postJson:async(url:string,payload:any)=>{requests.push({url,payload});return url.endsWith('/noamImageAnalyze')
   ?{ok:true,analysis:{readable:true,transcription:'student photograph',problem_statement:'student photograph',student_work:'student work'}}
   :{ok:true,answer:'בדקו את הנתונים המודפסים.'};}});
 runInNewContext(['attachmentsFor','currentAttachments','clearNoamAttachments','exerciseImageWithAttachments','getExerciseAnalysis'].map(n=>fn(v,n)).join('\n'),f.c);
 return {requests};
}
function unreadable(){return Object.assign(new Error('לא הצלחנו לקרוא את תמונת השאלה.'),{code:'QUESTION_IMAGE_UNREADABLE'});}
function assertCanonicalShape(a:any,exercise:any){
 assert.equal(a.content_type,'native_source_canonical');assert.equal(a.readable,true);assert.deepEqual(clone(a.uncertain_parts),[]);
 assert.deepEqual(clone(a.extracted_entities),{numbers:[],expressions:[],labels:[],units:[]});assert.equal(a.problem_statement,a.transcription);
 // Same header and pinned line the solver parses for the selected part.
 assert.match(a.transcription,new RegExp('^שאלה '+exercise.q+', סעיף '+exercise.part+'\\.'));assert.match(a.transcription,/^הסעיף הנבחר: /m);
 assert.doesNotMatch(JSON.stringify(a),/OCR|to_prove|הערך ה|svg_xy|"xy"/);
}

for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),name=relative.includes('public')?'public':'root';

 it(name+': original hint sends false using the literal instruction from the real button',async()=>{
  const f=fixture(v,'W11'),r=wireSnapshotReader(f,v);
  f.c.askNoam('hint',actualHintInstruction(v));await settled(f.c);
  assert.equal(r.requests.length,1);assert.equal(r.requests[0].url,'/model/noamImageSolve');
  assert.equal(r.requests[0].payload.hasStudentAttachments,false);
  assert.equal(r.requests[0].payload.imageAnalysis.content_type,'native_source_canonical');
  assert.ok(r.requests[0].payload.studentMessage.includes(actualHintInstruction(v)));
 });

 it(name+': photos removed/replaced/added during crop cannot change the sent image or its flag',async()=>{
  for(const change of ['remove','replace','add']){
   const f=fixture(v,'W11'),a={name:'a.png',canvas:{marker:'photo-A'}},b={name:'b.png',canvas:{marker:'photo-B'}};
   f.attachments.push(a);const r=wireSnapshotReader(f,v);let finishCrop:any;
   f.c.cropExerciseCanvas=()=>new Promise(resolve=>{finishCrop=resolve;});
   let sourceLoads=0;f.c.noamLoadSourceVisual=async()=>{sourceLoads++;throw Error('photo request must bypass canonical');};
   f.c.askNoam('hint',actualHintInstruction(v));assert.equal(typeof finishCrop,'function');
   if(change==='remove')f.attachments.splice(0);
   if(change==='replace')f.attachments.splice(0,1,b);
   if(change==='add')f.attachments.push(b);
   finishCrop({marker:'original-question'});await settled(f.c);
   assert.equal(sourceLoads,0);assert.equal(r.requests.length,2);
   const [analyze,solve]=r.requests;assert.equal(analyze.url,'/model/noamImageAnalyze');
   assert.deepEqual(JSON.parse(analyze.payload.imageDataUrl),['original-question','photo-A']);
   assert.equal(solve.payload.hasStudentAttachments,true);
   assert.match(solve.payload.imageAnalysis.transcription,/student photograph/);
   assert.equal(solve.payload.imageAnalysis.content_type,undefined);
   assert.deepEqual(clone(f.c.analysisCache),{},'never cache a photograph analysis');
   assert.deepEqual(clone(f.c.currentAttachments()).map((x:any)=>x.name),change==='remove'?[]:['b.png']);
  }
 });

 it(name+': a photo added during original canonical fetch remains for the next request',async()=>{
  const f=fixture(v,'W11'),r=wireSnapshotReader(f,v),load=f.c.noamLoadSourceVisual;
  let resume:any;const gate=new Promise(resolve=>{resume=resolve;});
  f.c.noamLoadSourceVisual=async(e:any)=>{await gate;return load(e);};
  f.c.askNoam('hint',actualHintInstruction(v));
  f.attachments.push({name:'later.png',canvas:{marker:'new-photo'}});resume();await settled(f.c);
  assert.equal(r.requests.length,1);assert.equal(r.requests[0].payload.hasStudentAttachments,false);
  assert.equal(r.requests[0].payload.imageAnalysis.content_type,'native_source_canonical');
  assert.equal(f.c.currentAttachments()[0].name,'later.png');
 });

 it(name+': original reader fallback uses the same empty snapshot after a photo is added',async()=>{
  const f=fixture(v,'W15construction'),r=wireSnapshotReader(f,v);
  let resume:any;const unavailable=new Promise(resolve=>{resume=()=>resolve(null);});f.c.noamLoadSourceVisual=()=>unavailable;
  f.c.askNoam('hint',actualHintInstruction(v));
  f.attachments.push({name:'later.png',canvas:{marker:'new-photo'}});resume();await settled(f.c);
  assert.equal(r.requests.length,1);assert.equal(r.requests[0].payload.hasStudentAttachments,false);
  assert.equal(r.requests[0].payload.imageAnalysis.content_type,'snapshot-test-original');
  assert.equal(f.c.currentAttachments()[0].name,'later.png');
 });

 it(name+': legacy loader omission reads current photos while true and an empty array force original',async()=>{
  const f=fixture(v,'W11'),r=wireSnapshotReader(f,v);f.attachments.push({name:'a.png',canvas:{marker:'photo-A'}});
  const original={readable:true,transcription:'cached original'};f.c.analysisCache[f.exercise.id]=original;
  assert.equal(await f.c.getExerciseAnalysis(f.exercise,true),original);
  assert.equal(await f.c.getExerciseAnalysis(f.exercise,[]),original);
  assert.equal(r.requests.length,0);
  const a=await f.c.getExerciseAnalysis(f.exercise);
  assert.match(a.transcription,/student photograph/);assert.equal(r.requests.length,1);
  assert.equal(f.c.analysisCache[f.exercise.id],original,'photo cannot overwrite original cache');
  const q=await f.c.noamQuestionAnalysis(f.exercise);
  assert.match(q.transcription,/student photograph/);assert.equal(r.requests.length,2);
 });

 it(name+': legacy askNoam without the canonical wrapper still passes its photo snapshot',async()=>{
  const f=fixture(v,'W11'),r=wireSnapshotReader(f,v);f.c.noamQuestionAnalysis=undefined;
  f.attachments.push({name:'a.png',canvas:{marker:'photo-A'}});
  f.c.askNoam('hint',actualHintInstruction(v));f.attachments.splice(0);await settled(f.c);
  assert.equal(r.requests.length,2);assert.equal(r.requests[1].payload.hasStudentAttachments,true);
  assert.deepEqual(JSON.parse(r.requests[0].payload.imageDataUrl),['original-question','photo-A']);
 });

 it(name+': explicit cleanup still clears all, snapshot cleanup removes only processed objects',()=>{
  const f=fixture(v,'W11');wireSnapshotReader(f,v);
  const a={name:'same.png'},replacement={name:'same.png'};f.attachments.push(a,replacement);
  f.c.clearNoamAttachments(f.exercise.id,[a]);assert.equal(f.c.currentAttachments().length,1);
  assert.equal(f.c.currentAttachments()[0],replacement);
  assert.equal(f.c.currentAttachments(),f.attachments,'keep a pending file reader’s captured list alive');
  f.attachments.push({name:'prepared-after-cleanup.png'});assert.equal(f.c.currentAttachments().length,2);
  f.c.clearNoamAttachments(f.exercise.id);assert.equal(f.c.currentAttachments().length,0);
 });

 it(name+': failed photo analysis preserves attachments and sends no solve request',async()=>{
  const f=fixture(v,'W11'),r=wireSnapshotReader(f,v);f.attachments.push({name:'a.png',canvas:{marker:'photo-A'}});
  const post=f.c.postJson;f.c.postJson=async(url:string,p:any)=>url.endsWith('/noamImageAnalyze')?{ok:true,analysis:{readable:false}}:post(url,p);
  f.c.askNoam('hint',actualHintInstruction(v));await settled(f.c);
  assert.equal(r.requests.length,0);assert.equal(f.thread.messages[1].answerError,true);
  assert.equal(f.c.currentAttachments().length,1);assert.deepEqual(clone(f.c.analysisCache),{});
 });

 it(name+': W15 independent conceptual part uses its printed text and an explicit generic scaffold',async()=>{
  const f=fixture(v,'W15'),{requests,counter}=wireHint(f,unreadable());
  f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled(f.c);
  assert.equal(counter.analysis,0);assert.equal(requests.length,1);assert.equal(f.thread.hintIndex,1);
  assert.equal(f.thread.messages[1].answerError,undefined);
  const a=requests[0].payload.imageAnalysis;assertCanonicalShape(a,f.exercise);
  assert.equal(a.transcription,['שאלה 20, סעיף ד.','בדקו את גבולות השימוש במשפטי הדמיון. האיור מתייחס רק לסעיף האחרון.','הסעיף הנבחר: מה יש לדרוש לפני שמחסרים שטח פנימי מן השלם?'].join('\n'));
  assert.match(a.diagram_description,/המקור מגביל את האיור לסעיף ה בלבד; הוא אינו נתון של הסעיף הנבחר/);
  assert.doesNotMatch(JSON.stringify(a),/AB|CD|BAO|q20_head|שורש|היקפים|קינון|OCR|הכלה|מוכל/);
  assert.match(requests[0].payload.studentMessage,/ניתוח השאלה נבנה מהטקסט המודפס/);
  const scaffold=f.c.window.NoamSourceScaffold,source=await f.c.noamLoadSourceVisual(f.exercise);
  assert.equal(scaffold.resolve(source.data,f.exercise,{studentMessage:'אפשר רמז 1?'},source.svgText),null);
  const shown=f.c.noamSourcePresentation(source,f.exercise,{drawCurrentStep:true,studentMessage:'שרטוט להמחשה',answer:f.thread.messages[1].text});
  assert.equal(shown.kind,'source-scaffold-area-comparison');
  assert.match(shown.figure.textContent,/סכמות כלליות/);assert.doesNotMatch(shown.figure.textContent,/AB|CD|BAO|q20_head/);
 });

 it(name+': all three printed last-part-only scopes retain their exact independent text',async()=>{
  let accepted=0;
  for(const key of ['W15A','W15B','W15']){
   const f=fixture(v,key),q=f.data.questions.find((q:any)=>q.id==='q20');
   for(const part of q.items.slice(0,-1)){
    const ex=f.manifest.exercises.find((e:any)=>e.nativeItemId===part.id);f.c.selectedExercise=ex;
    const a=await f.c.noamCanonicalSourceAnalysis(ex);assert.ok(a,key+' '+part.id);accepted++;
    assert.equal(a.transcription,['שאלה 20, סעיף '+part.label+'.',q.text,'הסעיף הנבחר: '+part.text].join('\n'));
    assert.doesNotMatch(JSON.stringify(a),/AB|CD|BAO|BCA|DAE|DE|DF|q20_head/);
   }
  }
  assert.equal(accepted,12);
 });

 it(name+': explicit exclusion is structural proof, not a no-figure shortcut',async()=>{
  const edits:[string,(d:any,m:any,e:any)=>void][]=[
   ['removed-clause',(d,m,e)=>{const q=d.questions.find((q:any)=>q.id==='q20');q.text='בדקו את גבולות השימוש במשפטי הדמיון.';e.context=q.text;}],
   ['ambiguous-clause',(d,m,e)=>{const q=d.questions.find((q:any)=>q.id==='q20');q.text='בדקו את גבולות השימוש במשפטי הדמיון. האיור מתייחס לסעיף האחרון.';e.context=q.text;}],
   ['two-clauses',(d,m,e)=>{const q=d.questions.find((q:any)=>q.id==='q20');q.text+=' האיור מתייחס רק לסעיף האחרון.';e.context=q.text;}],
   ['missing-null',(d)=>{delete d.questions.find((q:any)=>q.id==='q20').items[3].figure_id;}],
   ['other-null-missing',(d)=>{delete d.questions.find((q:any)=>q.id==='q20').items[0].figure_id;}],
   ['wrong-final-link',(d)=>{d.questions.find((q:any)=>q.id==='q20').items[4].figure_id='q19_head';}],
   ['missing-final-link',(d)=>{d.questions.find((q:any)=>q.id==='q20').items[4].figure_id=null;}],
   ['multiple-figures',(d)=>{d.figures.push({...d.figures.find((x:any)=>x.id==='q20_head'),id:'q20_head_2'});}],
   ['wrong-figure-item',(d)=>{d.figures.find((f:any)=>f.id==='q20_head').item='q20d';}],
   ['missing-figure-item',(d)=>{delete d.figures.find((f:any)=>f.id==='q20_head').item;}],
   ['foreign-duplicate-figure',(d)=>{d.figures.push({...d.figures.find((f:any)=>f.id==='q20_head'),question:'q19'});}],
   ['malformed-givens',(d)=>{d.questions.find((q:any)=>q.id==='q20').given={};}],
   ['duplicate-label',(d)=>{d.questions.find((q:any)=>q.id==='q20').items[4].label='ד';}],
   ['common-given',(d)=>{d.questions.find((q:any)=>q.id==='q20').given=[{text:'AB ∥ CD'}];}],
   ['selected-given',(d)=>{d.questions.find((q:any)=>q.id==='q20').items[3].given=[{text:'AB ∥ CD'}];}],
   ['unmentioned-earlier-number',(d)=>{d.questions.find((q:any)=>q.id==='q20').items[0].text+=' נתון אורך 999.';}],
   ['wrong-manifest-text',(_d,_m,e)=>{e.text='שאלה אחרת';}]
  ];
  for(const text of ['התייחסו לאיור.','התייחסו לטבלה.','התייחסו לגרף.','לפי סעיף א׳, מה יש לדרוש?','לפי מה שמצאתם, מה יש לדרוש?']){
   edits.push([text,(d,m,e)=>{d.questions.find((q:any)=>q.id==='q20').items[3].text=text;e.text=text;}]);
  }
  for(const [label,edit] of edits){const f=fixture(v,'W15',edit);assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,label);}
  const badHash=fixture(v,'W15',(d)=>{d.questions.find((q:any)=>q.id==='q20').items[3].text+=' changed';},true);
  assert.equal(await badHash.c.noamCanonicalSourceAnalysis(badHash.exercise),null,'source hash mismatch');
  for(const mode of ['attachments','selection-change','source-fails']){
   const f=fixture(v,'W15');if(mode==='attachments')f.attachments.push({name:'student.png'});
   if(mode==='selection-change')f.c.selectedExercise=f.manifest.exercises.find((x:any)=>x.nativeItemId==='q20e');
   if(mode==='source-fails')f.c.noamLoadSourceVisual=async()=>null;
   assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,mode);
  }
 });

 it(name+': figure exclusion must be the whole recognized printed scope without qualifications',async()=>{
  const changes:[string,(text:string)=>string][]=[
   ['trailing-anaphoric-exception',text=>text+' גם סעיף ד נעזר בו.'],
   ['leading-anaphoric-exception',text=>'גם סעיף ד נעזר בו. '+text],
   ['inserted-anaphoric-exception',text=>text.replace(' האיור',' גם סעיף ד נעזר בו; האיור')],
   ['same-clause-exception',text=>text.replace('האחרון.','האחרון, פרט לסעיף ד.')],
   ['trailing-newline-exception',text=>text+'\nגם סעיף ד נעזר בו.'],
   ['unknown-introduction',text=>text.replace('בדקו את גבולות השימוש במשפטי הדמיון.','בדקו את המקרים הבאים.')],
   ['restriction-without-reviewed-introduction',text=>text.slice(text.indexOf('האיור'))]
  ];
  for(const [label,change] of changes){
   const f=fixture(v,'W15',(d,m,e)=>{const q=d.questions.find((q:any)=>q.id==='q20');q.text=change(q.text);e.context=q.text;});
   const {requests,counter}=wireHint(f);f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled(f.c);
   assert.equal(counter.analysis,1,label+' must retain the image reader');
   assert.equal(requests.length,1,label+' must preserve the solve request count');
   assert.equal(requests[0].payload.imageAnalysis.content_type,undefined,label);
  }
 });

 it(name+': final figure part and student-designed proof keep the existing image route',async()=>{
  for(const key of ['W15final','W15construction']){
   const f=fixture(v,key),{requests,counter}=wireHint(f);f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled(f.c);
   assert.equal(counter.analysis,1,key);assert.equal(requests.length,1,key);assert.equal(requests[0].payload.imageAnalysis.content_type,undefined,key);
  }
 });

 it(name+': W11 table question is answered from the printed source without reading the image',async()=>{
  const f=fixture(v,'W11'),{requests,counter}=wireHint(f,unreadable());
  f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled(f.c);
  assert.equal(counter.analysis,0);assert.equal(requests.length,1);assert.equal(requests[0].url,'/model/noamImageSolve');
  assert.equal(f.thread.messages[1].answerError,undefined);assert.equal(f.thread.messages[1].text,'בדקו את הנתונים המודפסים.');
  const a=requests[0].payload.imageAnalysis;assertCanonicalShape(a,f.exercise);
  assert.match(a.transcription,/מבנה \$n\$ הוא מלבן של אריחים/);assert.match(a.transcription,/הסעיף הנבחר: כתבו ביטוי למספר האריחים במבנה \$n\$\./);
  assert.match(a.diagram_description,/^נתוני מקור מאומתים/);assert.match(a.diagram_description,/\nמבנה \| 1 \| 4 \| 6\nמספר האריחים \| \? \| \? \| \?$/);
  // Neither the earlier fill-in part, the later parts nor any filled value.
  assert.doesNotMatch(JSON.stringify(a),/השלימו את הטבלה|מאיה|108|זוגי|28|54|n\s*\(/);
  assert.match(requests[0].payload.studentMessage,/ניתוח השאלה נבנה מהטקסט המודפס ומנתוני המקור המאומתים/);
 });

 it(name+': W04 printed strip labels and the opening base altitude stay separate sources',async()=>{
  const f=fixture(v,'W04'),{requests,counter}=wireHint(f);
  f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled(f.c);
  assert.equal(counter.analysis,0);assert.equal(requests.length,1);const a=requests[0].payload.imageAnalysis;assertCanonicalShape(a,f.exercise);
  assert.match(a.transcription,/וגובהו לצלע הארוכה \$5\$ ס״מ/);assert.match(a.transcription,/הסעיף הנבחר: חשבו את סכום שטחי המלבנים\./);
  assert.match(a.diagram_description,/על קטע אנכי מודפס 2/);assert.equal((a.diagram_description.match(/על קטע אופקי מודפס 13/g)||[]).length,2);
  assert.match(a.diagram_description,/על קטע אופקי מודפס 24/);assert.match(a.diagram_description,/מספר שמופיע בפתיח שייך לעצם שהפתיח מתאר/);
  assert.doesNotMatch(a.diagram_description,/מודפס 5/);assert.doesNotMatch(JSON.stringify(a),/רוחבי המלבנים|שטח שני הבסיסים|100|250|OCR/);
 });

 it(name+': MP02 uses verified printed captions bound to measured grids, never SVG order, and drops contradictory OCR',async()=>{
  const f=fixture(v,'MP02'),{requests,counter}=wireHint(f);
  f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled(f.c);
  assert.equal(counter.analysis,0);const a=requests[0].payload.imageAnalysis;assertCanonicalShape(a,f.exercise);
  for(const [caption,columns] of [['שלב 1',3],['שלב 2',6],['שלב 3',9]])assert.ok(a.diagram_description.includes(`לוח עם הכיתוב "${caption}": 3 שורות, ${columns} נקודות בכל שורה.`));
  assert.doesNotMatch(JSON.stringify(a),/16|25|(?:9|18|27) נקודות(?! בכל שורה)|q21_head|9\s*n|ריבוע/);
  // Reordering the panels changes nothing: each caption follows its grid.
  const panels=f.c.NoamSourcePanels||f.c.window.NoamSourcePanels;assert.ok(panels);
  const facts=[{id:'q21_head_3',dots:27,rows:3,dotsPerRow:9},{id:'q21_head',dots:9,rows:3,dotsPerRow:3},{id:'q21_head_2',dots:18,rows:3,dotsPerRow:6}];
  assert.deepEqual(clone(f.c.noamVerifiedPanelCaptions(f.exercise,facts)).map((x:any)=>x.caption),['שלב 3','שלב 1','שלב 2']);
 });

 it(name+': caption ledger fails closed on any hash, grid, count or duplicate mismatch',()=>{
  const facts=()=>[{id:'a',dots:9,rows:3,dotsPerRow:3},{id:'b',dots:18,rows:3,dotsPerRow:6},{id:'c',dots:27,rows:3,dotsPerRow:9}];
  const cases:[string,(f:any,x:any[])=>void][]=[
   ['source-hash',(f)=>{f.manifest.sourceSha256='0'.repeat(64);}],['native-hash',(f)=>{f.manifest.nativeExportSha256='0'.repeat(64);}],
   ['other-pdf',(f)=>{f.manifest.pdfHash='1ea1c578cd2b4ec3b2813c6d9462f15d';}],['other-question',(f)=>{f.exercise.nativeQuestionId='q22';}],
   ['swapped-grid',(_f,x)=>{x[1].rows=6;x[1].dotsPerRow=3;}],['duplicate-grid',(_f,x)=>{x[2]={...x[1],id:'c'};}],
   ['missing-panel',(_f,x)=>{x.pop();}],['extra-panel',(_f,x)=>{x.push({id:'d',dots:36,rows:3,dotsPerRow:12});}],['wrong-total',(_f,x)=>{x[0].dots=10;}],
   ['prototype-key',(f)=>{f.manifest.pdfHash='__proto__';f.exercise.nativeQuestionId='';}]];
  for(const [mode,edit] of cases){const f=fixture(v,'MP02'),x=facts();edit(f,x);assert.equal(f.c.noamVerifiedPanelCaptions(f.exercise,x),null,mode);}
  const ok=fixture(v,'MP02');assert.equal(ok.c.noamVerifiedPanelCaptions(ok.exercise,facts()).length,3);
 });

 it(name+': identity, completeness and selection gates fall back to the existing image reader',async()=>{
  const modes:[string,string,(d:any,m:any,e:any)=>void][]=[
   ['W11','manifest-text',(_d,_m,e)=>{e.text='כתבו ביטוי אחר.';}],
   ['W11','manifest-context',(_d,_m,e)=>{e.context='פתיח אחר לגמרי';}],
   ['W11','label',(d)=>{d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16b').label='ג';}],
   ['W11','figure-word-without-figure',(d,_m,e)=>{const q=d.questions.find((q:any)=>q.id==='q16');q.text+=' האריחים מסומנים בשרטוט.';e.context=q.text;}],
   ['W11','graph-word',(d,_m,e)=>{const i=d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16b');i.text='כתבו ביטוי לפי הגרף.';e.text=i.text;}],
   ['W11','unpointed-figure',(d)=>{d.figures.push({id:'q16_head',question:'q16',svg:'figures/q16_head.svg'});}],
   ['W11','non-table-visual',(d)=>{d.visuals.push({id:'q16_line',kind:'number_line',question:'q16'});}],
   ['W11','malformed-table',(d)=>{d.questions.find((q:any)=>q.id==='q16').table={head:[],rows:[]};}],
   // No exported aid is not proof that the printed page has none.
   ['W11','text-only-no-aid',(d)=>{delete d.questions.find((q:any)=>q.id==='q16').table;d.visuals=d.visuals.filter((x:any)=>x.question!=='q16');}],
   ['W11','not-image-read',(_d,_m,e)=>{e.requiresVision=false;e.needsVision=false;}],
   ['W11','unnamed-dependency',(d,_m,e)=>{const i=d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16b');i.text='כתבו ביטוי לפי מה שמצאתם.';e.text=i.text;}],
   ['W11','later-part',(d,_m,e)=>{const i=d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16b');i.text='כתבו ביטוי והשוו לסעיף ה׳.';e.text=i.text;}],
   ['W04','table-word-without-table',(d,_m,e)=>{const i=d.questions.find((q:any)=>q.id==='q7').items.find((i:any)=>i.id==='q7b');i.text='השלימו את הטבלה.';e.text=i.text;}],
   ['W04','broken-label',(d)=>{const o=d.figures.find((f:any)=>f.id==='q7_head').visual_model.objects.find((o:any)=>o.type==='label');o.text='3';}],
   ['MP02','no-caption-ledger',(_d,m)=>{m.sourceSha256='f'.repeat(64);}]];
  for(const [key,mode,edit] of modes){
   const f=fixture(v,key,edit),{requests,counter}=wireHint(f);
   assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,mode);
   f.c.askNoam('hint','רמז');await settled(f.c);assert.equal(counter.analysis,1,mode);assert.equal(requests[0].payload.imageAnalysis.content_type,undefined,mode);
  }
  for(const mode of ['attachments','selection-change','identity-change','source-fails']){
   const f=fixture(v,'W11'),load=f.c.noamLoadSourceVisual;
   if(mode==='attachments')f.attachments.push({name:'student.png'});
   if(mode==='source-fails')f.c.noamLoadSourceVisual=async()=>null;
   if(mode==='selection-change')f.c.noamLoadSourceVisual=async(e:any)=>{const s=await load(e);f.c.selectedExercise=f.manifest.exercises.find((x:any)=>x.nativeItemId==='q16a');return s;};
   if(mode==='identity-change')f.c.noamLoadSourceVisual=async(e:any)=>{const s=await load(e);f.manifest.nativeExportSha256='0'.repeat(64);return s;};
   assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,mode);
  }
 });

 it(name+': an explicitly referenced earlier part is labeled context, never the task or new data',async()=>{
  const f=fixture(v,'W11',(d,_m,e)=>{const i=d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16b');i.text='לפי הטבלה שבסעיף א׳, כתבו ביטוי למספר האריחים.';e.text=i.text;});
  const a=await f.c.noamCanonicalSourceAnalysis(f.exercise);assert.ok(a);
  assert.match(a.transcription,/הקשר מסעיף א׳ \(סעיף קודם; אינו המשימה ואינו נתון חדש\): השלימו את הטבלה\./);
  assert.match(a.transcription,/הסעיף הנבחר: לפי הטבלה שבסעיף א׳/);assert.doesNotMatch(a.transcription,/מאיה|108/);
  assert.equal(a.transcription.split('\n').filter((l:string)=>l.startsWith('הסעיף הנבחר: ')).length,1);
 });

 it(name+': canonical provenance cannot be cloned, and enrichment and caches leave it and the old OCR untouched',async()=>{
  const f=fixture(v,'MP02'),a=await f.c.noamCanonicalSourceAnalysis(f.exercise);assert.ok(a);
  assert.match(f.c.noamSourcePriorityInstruction(a,f.exercise),/^ניתוח השאלה נבנה מהטקסט המודפס/);assert.equal(f.c.noamSourcePriorityInstruction(clone(a),f.exercise),'');
  assert.equal(await f.c.noamEnrichSourceAnalysis(f.exercise,a),a);
  const forged={...clone(a)};assert.notEqual(await f.c.noamEnrichSourceAnalysis(f.exercise,forged),forged);
  f.c.analysisCache[f.exercise.id]=contradictory();assert.doesNotMatch(f.c.localVisualExerciseSource(f.exercise),/OCR|16|25/);
  assert.deepEqual(f.c.analysisCache[f.exercise.id],contradictory());
  f.manifest.nativeExportSha256='0'.repeat(64);assert.match(f.c.localVisualExerciseSource(f.exercise),/OCR/);
 });

 it(name+': review (1) — fetched native bytes must hash to the manifest before they can become canonical data',async()=>{
  // Same edit with and without a matching hash: only the tampered bytes fall back.
  const edit=(d:any)=>{d.questions.find((q:any)=>q.id==='q16').table.rows[0][1]='999';};
  const tampered=fixture(v,'W11',edit,true),{requests,counter}=wireHint(tampered);
  assert.equal(await tampered.c.noamCanonicalSourceAnalysis(tampered.exercise),null);
  tampered.c.askNoam('hint','רמז');await settled(tampered.c);assert.equal(counter.analysis,1);assert.doesNotMatch(JSON.stringify(requests[0].payload.imageAnalysis),/999/);
  const rehashed=fixture(v,'W11',edit);assert.match((await rehashed.c.noamCanonicalSourceAnalysis(rehashed.exercise)).diagram_description,/999/);
  // A poisoned shared package cache is not trusted: canonical data comes from the verified bytes.
  const poisoned=fixture(v,'W11'),load=poisoned.c.noamLoadSourceVisual;
  poisoned.c.noamLoadSourceVisual=async(e:any)=>{const s=await load(e);const d=clone(s.data);edit(d);return {...s,data:d};};
  const a=await poisoned.c.noamCanonicalSourceAnalysis(poisoned.exercise);assert.ok(a);assert.doesNotMatch(a.diagram_description,/999/);
  for(const mode of ['no-decoder','bad-hash-format','not-ok','not-utf8']){
   const f=fixture(v,'W11');
   if(mode==='no-decoder')f.c.TextDecoder=undefined;
   if(mode==='bad-hash-format')f.manifest.nativeExportSha256='abc';
   if(mode==='not-ok'||mode==='not-utf8'){const fetch=f.c.fetch;f.c.fetch=async(url:string,o:any)=>{const r=await fetch(url,o);if(url!==f.manifest.nativeExportUrl)return r;
    return mode==='not-ok'?{...r,ok:false}:{...r,arrayBuffer:async()=>new Uint8Array([0xff,0xfe]).buffer};};}
   assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,mode);
  }
 });

 it(name+': review (2) — plural earlier-part references are kept as labeled context or fall back',async()=>{
  const withText=async(text:string)=>{const f=fixture(v,'W11',(d,_m,e)=>{const i=d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16b');i.text=text;e.text=text;});
   return f.c.noamCanonicalSourceAnalysis(f.exercise);};
  const plural=await withText('לפי הנתונים בסעיפים א׳, כתבו ביטוי למספר האריחים.');assert.ok(plural);
  assert.match(plural.transcription,/הקשר מסעיף א׳ \(סעיף קודם; אינו המשימה ואינו נתון חדש\): השלימו את הטבלה\./);
  for(const text of ['בסעיפים הקודמים מצאתם ערכים; כתבו ביטוי.','בסעיפים א׳–ב׳ כתבו ביטוי.','בסעיפים א׳ וה׳ כתבו ביטוי.','בסעיפים א׳ וז׳ כתבו ביטוי.','בסעיפים ראינו טבלה; כתבו ביטוי.'])
   assert.equal(await withText(text),null,text);
 });

 it(name+': review (3) — the canonical analysis is deep-frozen and its proof covers every field',async()=>{
  const f=fixture(v,'W11'),a=await f.c.noamCanonicalSourceAnalysis(f.exercise);assert.ok(a);
  for(const value of [a,a.extracted_entities,a.extracted_entities.numbers,a.uncertain_parts,a.complexity_reasons])assert.equal(Object.isFrozen(value),true);
  assert.throws(()=>{(a as any).transcription='שאלה16 סעיףב: evil changed data';});assert.throws(()=>{a.extracted_entities.numbers.push(999);});
  assert.match(f.c.noamSourcePriorityInstruction(a,f.exercise),/^ניתוח השאלה נבנה/);assert.equal(f.c.noamCanonicalAnalysisFor(f.exercise),a);
  // A copy carrying a changed field never inherits provenance, priority or cache validity.
  const forged={...clone(a),transcription:'שאלה16 סעיףב: evil changed data'};
  assert.equal(f.c.noamSourcePriorityInstruction(forged,f.exercise),'');assert.equal(f.c.noamCanonicalProofValid(forged,f.exercise),false);
  assert.equal(f.c.noamSourcePriorityInstruction(await f.c.noamEnrichSourceAnalysis(f.exercise,forged),f.exercise),'');
 });

 it(name+': completeness boundaries without a fully verified aid keep the existing reader',async()=>{
  for(const key of ['G8-T32/b q4d','G7-T21/b q17a','G7-T40/c q18b','G9-T31/a q22b']){
   const f=fixture(v,key);assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,key);
  }
  // An unnamed earlier part that introduces a number blocks the canonical route even with a verified table.
  const f=fixture(v,'W11',(d)=>{d.questions.find((q:any)=>q.id==='q16').items.find((i:any)=>i.id==='q16a').text='הוסיפו מבנה ובו $5$ אריחים, והשלימו את הטבלה.';});
  assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null);
  const multi=fixture(v,'W11',(d,_m,e)=>{const q=d.questions.find((q:any)=>q.id==='q16');q.text=['מבנה $n$ הוא מלבן של אריחים:','ברוחבו $n$ אריחים, ובאורכו שלושה אריחים יותר מברוחבו.'];e.context=q.text.join(' ');});
  const a=await multi.c.noamCanonicalSourceAnalysis(multi.exercise);assert.ok(a);assert.match(a.transcription,/מבנה \$n\$ הוא מלבן של אריחים:\nברוחבו/);
  const partial=fixture(v,'W11',(d,_m,e)=>{const q=d.questions.find((q:any)=>q.id==='q16');q.text=['מבנה $n$ הוא מלבן של אריחים:','ובו שורה נסתרת.'];e.context='מבנה $n$ הוא מלבן של אריחים:';});
  assert.equal(await partial.c.noamCanonicalSourceAnalysis(partial.exercise),null);
 });

 it(name+': real plural references keep exactly the named earlier parts, recursively resolved, or fall back',async()=>{
  const f=fixture(v,'G7-T39/c q9d'),q=f.data.questions.find((x:any)=>x.id==='q9');
  assert.deepEqual(clone(f.c.noamCanonicalEarlierParts(q,q.items.find((i:any)=>i.id==='q9d'))).map((p:any)=>p.label),['א','ג']);
  const a=await f.c.noamCanonicalSourceAnalysis(f.exercise);
  if(a){assert.match(a.transcription,/הקשר מסעיף א׳/);assert.match(a.transcription,/הקשר מסעיף ג׳/);assert.doesNotMatch(a.transcription,/הקשר מסעיף ב׳|נניח שהתלמידה/);}
  // Follow-up review: a list is consumed whole or rejected, never accepted as its first label.
  const labelsFor=(tail:string)=>{const qq={...q,items:q.items.map((i:any)=>i.id==='q9d'?{...i,text:'האם המורה צודק? בססו את תשובתכם על '+tail}:i)};
   const r=f.c.noamCanonicalEarlierParts(qq,qq.items.find((i:any)=>i.id==='q9d'));return r&&clone(r).map((p:any)=>p.label);};
  for(const [tail,expected] of [['סעיפים א׳ ו־ג׳.',['א','ג']],['סעיפים א׳ ו־ג',['א','ג']],['סעיפים א׳ וג',['א','ג']],['סעיפים א׳ וכן ג׳.',null],['סעיפים א׳ וגם ג׳.',null]] as const)
   assert.deepEqual(labelsFor(tail),expected,tail);
  const g=fixture(v,'G7-T30/a q8c'),q8=g.data.questions.find((x:any)=>x.id==='q8');
  assert.deepEqual(clone(g.c.noamCanonicalEarlierParts(q8,q8.items.find((i:any)=>i.id==='q8c'))).map((p:any)=>p.label),['א','ב']);
  assert.equal(await g.c.noamCanonicalSourceAnalysis(g.exercise),null,'no verified aid');
  // ג names א, but א itself depends on an unnamed earlier result: the whole chain falls back.
  const nested=fixture(v,'W11',(d,_m,e)=>{const qq=d.questions.find((x:any)=>x.id==='q16');qq.items[0].text='השלימו את הטבלה לפי מה שמצאתם.';qq.items[1].text='לפי סעיף א׳, כתבו ביטוי.';e.text=qq.items[1].text;});
  assert.equal(await nested.c.noamCanonicalSourceAnalysis(nested.exercise),null);
 });

 it(name+': printed text arrays share one normalizer; other types and over-long complete sources fall back',async()=>{
  const lines=fixture(v,'W11',(d,_m,e)=>{const i=d.questions.find((x:any)=>x.id==='q16').items.find((x:any)=>x.id==='q16b');i.text=['כתבו ביטוי למספר','האריחים במבנה $n$.'];e.text='כתבו ביטוי למספר האריחים במבנה $n$.';});
  const a=await lines.c.noamCanonicalSourceAnalysis(lines.exercise);
  if(a){assert.match(a.transcription,/הסעיף הנבחר: כתבו ביטוי למספר\nהאריחים במבנה \$n\$\./);assert.equal(a.math_content,'כתבו ביטוי למספר\nהאריחים במבנה $n$.');}
  for(const bad of [{text:'x'},42,['ok',{}]]){
   const f=fixture(v,'W11',(d)=>{d.questions.find((x:any)=>x.id==='q16').items.find((x:any)=>x.id==='q16b').text=bad;});
   assert.equal(await f.c.noamCanonicalSourceAnalysis(f.exercise),null,JSON.stringify(bad));
  }
  const long=fixture(v,'W11',(d)=>{const t=d.questions.find((x:any)=>x.id==='q16').table;t.head=['מבנה',...Array.from({length:5},(_,i)=>'$'+(i+1)+'$')];
   t.rows=Array.from({length:20},(_,r)=>['שורה '+(r+1)+' '+'א'.repeat(140),'___','___','___','___','___']);});
  assert.equal(await long.c.noamCanonicalSourceAnalysis(long.exercise),null);
  for(const key of ['W11','W04','MP02']){const f=fixture(v,key),c=await f.c.noamCanonicalSourceAnalysis(f.exercise);
   assert.ok(c.diagram_description.length<=3000&&c.problem_statement.length<=3000&&c.transcription.length<=8000&&c.math_content.length<=8000,key);}
 });

 it(name+': checked native data is immutable, so a mutated parsed cache cannot change later canonical facts',async()=>{
  const f=fixture(v,'W11'),first=await f.c.noamCanonicalSourceAnalysis(f.exercise);assert.ok(first);
  const data=await f.c.noamVerifiedNativeData(f.exercise);assert.equal(Object.isFrozen(data.questions[0]),true);
  assert.throws(()=>{data.questions.find((x:any)=>x.id==='q16').table.rows[0][1]='999';});
  const again=await f.c.noamCanonicalSourceAnalysis(f.exercise);assert.doesNotMatch(again.diagram_description,/999/);
 });
}
