import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const pub=new URL('../public/',import.meta.url),native=readFileSync(new URL('noam-native-visual.js',pub),'utf8');
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));assert.ok(s.startsWith('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
function fixture(v:string){
 const manifest=JSON.parse(readFileSync(new URL('noam-ai/manifests/c5910c37949b48a488ec5e3732c48601.json',pub),'utf8'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeItemId==='q7b');
 const source:any={data:JSON.parse(readFileSync(new URL(manifest.nativeExportUrl.slice(1),pub),'utf8')),svgText:readFileSync(new URL(exercise.nativeFigureUrl.slice(1),pub),'utf8')};
 const {document,window}=parseHTML('<html><body></body></html>');
 const c:any={document,window,manifest,selectedExercise:exercise,pdf:manifest.pdfHash,Promise,noamVerifiedSourceAnalyses:new WeakMap(),noamNativeDataUrl:()=>manifest.nativeExportUrl,
  noamSourceVisualIdentity:()=> 'same-selected-source',noamLoadSourceVisual:async()=>source,noamSourcePanelContext:()=>null};
 runInNewContext(native+'\n'+fn(v,'noamSourceSegmentLabelFacts')+'\n'+fn(v,'noamEnrichSourceAnalysis'),c);window.NoamNativeVisual=c.NoamNativeVisual;
 return {c,source,exercise,model:source.data.figures.find((f:any)=>f.id==='q7_head').visual_model};
}
function expectLabels(text:string){
 assert.match(text,/על קטע אנכי מודפס 2(?:;|\.)/);assert.equal((text.match(/על קטע אופקי מודפס 13/g)||[]).length,2);
 assert.match(text,/על קטע אופקי מודפס 24/);assert.match(text,/חשבו את סכום שטחי המלבנים/);assert.match(text,/אל תחליף תווית מודפסת בערך מהפתיח/);
 assert.doesNotMatch(text,/על קטע (?:אנכי|אופקי) מודפס 5|סכום.{0,10}50|100|שטח.{0,10}=|גובה משותף/);
}
async function settled(){for(let i=0;i<100;i++)await Promise.resolve();}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),name=relative.includes('public')?'public':'root';
 it(name+': W04-Q3 exact printed labels survive solver/reviewer limits without calculations',async()=>{
  const f=fixture(v),original={readable:true,diagram_description:'old OCR '.repeat(600)},before=JSON.stringify(original);
  const enriched=await f.c.noamEnrichSourceAnalysis(f.exercise,original);expectLabels(enriched.diagram_description.slice(0,3000).slice(0,800));
  assert.match(enriched.diagram_description,/גובהו לצלע הארוכה \$5\$/);assert.equal(JSON.stringify(original),before);
  assert.deepEqual(clone(f.c.noamSourceSegmentLabelFacts(f.source,f.exercise,f.model)),[{text:'13',direction:'אופקי'},{text:'2',direction:'אנכי'},{text:'13',direction:'אופקי'},{text:'24',direction:'אופקי'}]);
 });
 it(name+': actual hint enriches cached analysis in the single existing solve request',async()=>{
  const f=fixture(v),cached={readable:true,diagram_description:'old OCR'},requests:any[]=[],thread:any={messages:[],history:[],hintIndex:0};
  Object.assign(f.c,{busy:false,panelBody:f.c.document.body,noamDrafts:{},MIN_WAIT:0,API:'/model',g:7,lv:'b',LEVEL:{b:'רמה ב׳'},ttl:'מנסרה',
   exerciseThread:()=>thread,setNoamBusy:(busy:boolean)=>{f.c.busy=busy;},restoreNoamChatFocus(){},exerciseLabel:()=> 'שאלה 7ב',saveNoamState(){},renderNoamChat(){},announceNoam(){},
   noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,getExerciseAnalysis:async()=>cached,noamSolverMessage:(s:string)=>s,
   postJson:async(url:string,payload:any)=>{requests.push({url,payload});return {ok:true,answer:'בדקו את התווית על הצלע האנכית.'};},
   noamGuardGeometryResult:(r:any)=>r,noamGuardSignedAddResult:(r:any)=>r,noamClarifySignedAddLanguage:(s:string)=>s,noamResponseVisual:()=>null,
   noamVisualAnswer:(_:string,s:string)=>s,noamAttachSourceHint(){},setTimeout:(cb:any,ms:number)=>{if(ms<25000)cb();return 0;}});
  runInNewContext(fn(v,'askNoam'),f.c);f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled();assert.equal(requests.length,1);
  assert.equal(requests[0].url,'/model/noamImageSolve');assert.equal(requests[0].payload.exerciseId,f.exercise.id);
  expectLabels(requests[0].payload.imageAnalysis.diagram_description.slice(0,800));assert.equal(cached.diagram_description,'old OCR');
 });
 it(name+': hidden, malformed, mismatched or foreign labels fail closed',async()=>{
  for(const mode of ['answer','hidden','wrong-text','wrong-for','missing-id','duplicate-id','foreign-figure','wrong-question','wrong-kind','wrong-namespace','missing-namespace',
   'svg-transform','label-transform','line-transform','label-opacity','white-label','zero-font','svg-group','model-endpoint','svg-endpoint','model-label-position','svg-label-position','expression','too-many','grouped','missing-dom']){
   const f=fixture(v),label=f.model.objects.find((o:any)=>o.text==='2'),line=f.model.objects.find((o:any)=>o.id===label.for);
   if(mode==='answer')label.role='answer';if(mode==='hidden')label.display='hidden';if(mode==='wrong-text')label.text='5';if(mode==='wrong-for')label.for='seg-f61c83';if(mode==='missing-id')label.svg_id='missing';
   if(mode==='duplicate-id')f.source.svgText=f.source.svgText.replace('</svg>','<text id="'+label.svg_id+'">2</text></svg>');
   if(mode==='foreign-figure')f.model.id='q8_head';if(mode==='wrong-question')f.model.question='q8';if(mode==='wrong-kind')f.model.kind='plane_geometry';
   if(mode==='wrong-namespace')f.source.svgText=f.source.svgText.replace('http://www.w3.org/2000/svg','http://example.invalid');if(mode==='missing-namespace')f.source.svgText=f.source.svgText.replace(' xmlns="http://www.w3.org/2000/svg"','');
   for(const tag of ['svg','label','line'])if(mode===tag+'-transform'){const t=tag==='label'?'text':tag;f.source.svgText=f.source.svgText.replace('<'+t,'<'+t+' transform="translate(1)"');}
   if(mode==='label-opacity')f.source.svgText=f.source.svgText.replace('<text','<text opacity="0"');if(mode==='white-label')f.source.svgText=f.source.svgText.replace('fill="#111"','fill="#fff"');
   if(mode==='zero-font')f.source.svgText=f.source.svgText.replace('font-size="10.60"','font-size="0"');if(mode==='svg-group')f.source.svgText=f.source.svgText.replace('<line','<g><line').replace('</svg>','</g></svg>');
   if(mode==='model-endpoint')line.svg_xy[0][0]+=1;if(mode==='svg-endpoint')f.source.svgText=f.source.svgText.replace('x1="305.74"','x1="306.74"');
   if(mode==='model-label-position')label.svg_xy[0]+=1;if(mode==='svg-label-position')f.source.svgText=f.source.svgText.replace('x="298.17"','x="299.17"');
   if(mode==='expression')label.text='1+1';if(mode==='too-many')f.model.objects.push(...clone(f.model.objects).flatMap(()=>clone(f.model.objects)));
   if(mode==='grouped')f.source.sourcePanelGroup={};if(mode==='missing-dom')f.c.window={NoamNativeVisual:f.c.window.NoamNativeVisual,DOMParser:null};
   assert.equal(f.c.noamSourceSegmentLabelFacts(f.source,f.exercise,f.model),null,mode);
   const result=await f.c.noamEnrichSourceAnalysis(f.exercise,{diagram_description:'original OCR'});assert.doesNotMatch(result.diagram_description,/תוויות מספריות מודפסות שאומתו/,mode);
  }
 });
 it(name+': wrong selected identity, unavailable and changed source preserve original analysis',async()=>{
  for(const mode of ['wrong-item','wrong-part','wrong-question','wrong-figure','failed','switched']){
   const f=fixture(v),original={diagram_description:'original OCR'};
   if(mode==='wrong-item')f.exercise.nativeItemId='q7c';if(mode==='wrong-part')f.exercise.part='ג';if(mode==='wrong-question')f.exercise.nativeQuestionId='q8';if(mode==='wrong-figure')f.exercise.nativeFigureId='q8_head';
   if(mode==='failed')f.c.noamLoadSourceVisual=async()=>null;if(mode==='switched'){let n=0;f.c.noamSourceVisualIdentity=()=>String(n++);}
   assert.equal(await f.c.noamEnrichSourceAnalysis(f.exercise,original),original,mode);
  }
 });
}
