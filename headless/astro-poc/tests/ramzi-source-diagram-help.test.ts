import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const source=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8');
const helper='function noamNativeFigure'+source.split('function noamNativeFigure')[1].split('function showExercisePreview')[0];
const zoom='function noamAddDiagramExpansion'+source.split('function noamAddDiagramExpansion')[1].split('function noamDiagramRuntime')[0];
const label='function setNoamDiagramButtonLabel'+source.split('function setNoamDiagramButtonLabel')[1].split('function addTranscriptBubble')[0];
const data=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T39/a/noam-ai.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/9448157f4ecb463489417696230f0e57.json',import.meta.url),'utf8'));
const exercise=manifest.exercises.find((e:any)=>e.q===1&&e.part==='ג');
const legacy='עדיין לא הצלחתי להכין המחשה מדויקת לשלב הזה. אפשר לכתוב אילו קטעים או זוויות להדגיש.';
const message={role:'assistant',text:'האם שוויון הזוויות נובע מהצלעות השוות או מהצלע המשותפת?',diagramError:legacy};
function fixture(payload:any=data, ex:any=exercise, msg:any=message){
 const {document,window}=parseHTML('<html><body><div id="bubble"><button class="noam-draw-action">השרטוט לא הופיע — נסו שוב</button><span class="noam-draw-error"></span></div></body></html>');
 document.querySelector('.noam-draw-error')!.textContent=msg.diagramError||'';
 const create=document.createElement.bind(document);
 document.createElement=(name:string)=>{const el=create(name);if(name==='dialog'){el.showModal=()=>el.setAttribute('open','');el.close=()=>el.dispatchEvent(new window.Event('close'));}return el;};
 const calls:string[]=[];
 const context:any={document,window,exercise:ex,message:msg,selectedExercise:ex,exerciseLabel:()=> 'שאלה 1 · סעיף ג',
  noamDiagramSourceIdentity:(e:any)=>e.id+':'+(e.version||''),
  fetch:async(url:string)=>{calls.push(url);return{ok:true,json:async()=>payload};},container:document.getElementById('bubble')};
 runInNewContext(label+'\n'+helper+'\n'+zoom+';noamAppendSourceDiagramHelp(container,exercise,message);',context);
 return {document,window,context,calls,open:async()=>{const d=document.querySelector('details');if(d){d.open=true;d.dispatchEvent(new window.Event('toggle'));await new Promise(r=>setImmediate(r));}},aid:()=>runInNewContext('noamSourceVertexAid('+JSON.stringify(payload)+',exercise)',context)};
}
it('actual G8 saved unsupported reply offers separately labelled source and four unpaired vertices',async()=>{
 const before=JSON.stringify(message),f=fixture();
 assert.match(f.document.querySelector('summary')!.textContent!,/עזר מהדף/);
 assert.deepEqual(f.calls,['/noam-ai/native/G8-T39/a/noam-ai.json'],'only the approved static package is requested');
 await f.open();
 assert.deepEqual(f.calls,['/noam-ai/native/G8-T39/a/noam-ai.json']);
 const buttons=f.document.querySelectorAll('details > button');
 const locate=Array.from(buttons).find(b=>b.textContent==='איתור הקודקודים')!;
 assert.ok(locate);assert.equal(locate.getAttribute('aria-pressed'),'true');
 assert.equal(f.document.querySelector('details')!.open,true,'the verified aid is visible without extra clicks');
 const svg=f.document.querySelector('figure svg')!;
 assert.equal(svg.querySelector('image')!.getAttribute('href'),exercise.nativeFigureUrl);
 assert.equal(svg.querySelectorAll('circle').length,4);
 assert.equal(new Set(Array.from(svg.querySelectorAll('circle')).map(n=>n.getAttribute('stroke'))).size,1);
 assert.equal(svg.querySelectorAll('path,line,text').length,0,'no invented equality, correspondence or geometry');
 assert.match(f.document.querySelector('figcaption')!.textContent!,/אינו נותן את ההתאמה/);
 assert.equal(JSON.stringify(message),before,'history and error are not rewritten');
 f.document.querySelector('.noam-diagram-expand')!.click();
 assert.match(f.document.querySelector('dialog h2')!.textContent!,/השרטוט של השאלה/);
 assert.equal(f.document.querySelectorAll('dialog circle').length,4);
 f.document.querySelector('.noam-diagram-dialog-close')!.click();
 locate.click();assert.equal(f.document.querySelectorAll('figure svg').length,0);
 locate.click();assert.equal(f.document.querySelectorAll('figure circle').length,4);
 assert.equal(f.calls.length,1,'expansion and toggling never request AI');
});
it('security/network errors, non-assistant messages, absent and external source URLs get no source-success substitute',()=>{
 for(const msg of [{...message,diagramError:'לא הצלחנו להשלים את בדיקת האבטחה.'},
  {...message,diagramErrorCode:'DIAGRAM_UNAVAILABLE'}, {...message,answerError:true}, {...message,role:'user'}])
  assert.equal(fixture(data,exercise,msg).document.querySelector('details'),null);
 for(const url of ['', 'https://evil.test/a.svg','/noam-ai/native/G8-T39/a/../q.svg'])
  assert.equal(fixture(data,{...exercise,nativeFigureUrl:url}).document.querySelector('details'),null);
});
it('aid is tied to the exact approved subsection, figure and finite named source coordinates',()=>{
 for(const part of ['א','ב','ד'])assert.equal(fixture(data,{...exercise,part}).aid(),null);
 assert.equal(fixture(data,{...exercise,nativeQuestionId:'q2'}).aid(),null);
 assert.equal(fixture(data,{...exercise,nativeFigureUrl:'/noam-ai/native/G8-T39/a/figures/q2_head.svg'}).aid(),null);
 for(const mutate of [(f:any)=>f.question='q2',(f:any)=>f.svg='figures/q2_head.svg',(f:any)=>f.svg='elsewhere/q1_head.svg',
   (f:any)=>f.objects.points[0].svg_xy=[Infinity,2],(f:any)=>f.objects.points[0].svg_xy=[-1,2],
   (f:any)=>f.objects.points[1].name='A',(f:any)=>f.objects.points[1].svg_xy=f.objects.points[0].svg_xy,
   (f:any)=>f.objects.points.push(f.objects.points[0])]){
  const copy=structuredClone(data);mutate(copy.figures.find((f:any)=>f.id==='q1_head'));
  assert.equal(fixture(copy).aid(),null);
 }
});
it('a late source fetch cannot attach aid after switching sections or source revisions',async()=>{
 for(const selected of [{...exercise,id:'other'}, {...exercise,version:'changed'}, {...exercise,nativeFigureUrl:'/noam-ai/native/G8-T39/a/figures/q2_head.svg'}]){
  const f=fixture();f.context.selectedExercise=selected;await f.open();
  assert.equal(Array.from(f.document.querySelectorAll('button')).some(b=>b.textContent==='איתור הקודקודים'),false);
 }
});
it('unavailable or malformed package leaves only the explicitly labelled original, not false highlighted data',async()=>{
 for(const payload of [null,{}, {questions:[]}]){
  const f=fixture(payload);await f.open();assert.equal(f.document.querySelector('figure svg'),null);
  assert.equal(f.document.querySelector('figcaption')!.textContent,'השרטוט המקורי — ללא הדגשה נוספת');
 }
});
it('broken source image removes the aid and enlargement rather than presenting an empty success',()=>{
 const f=fixture();f.document.querySelector('figure img')!.dispatchEvent(new f.window.Event('error'));
 assert.equal(f.document.querySelector('details'),null);
});
it('status acknowledges the source aid only after image load, preserves failure and retry, and restores error if image fails',async()=>{
 const original=JSON.stringify(message),f=fixture();await f.open();
 const image=f.document.querySelector('figure svg image')!;
 const status=f.document.querySelector('.noam-draw-error')!;
 assert.equal(status.textContent,legacy,'a pending image is not successful visual delivery');
 image.dispatchEvent(new f.window.Event('load'));
 assert.match(status.textContent!,/לא נוצר שרטוט חדש.*השרטוט המקורי/);
 assert.match(f.document.querySelector('.noam-draw-action')!.textContent!,/המחשה נוספת/);
 assert.equal(JSON.stringify(message),original,'generation failure remains in history');
 image.dispatchEvent(new f.window.Event('error'));
 assert.equal(status.textContent,legacy);
 assert.equal(f.document.querySelector('details'),null);
});
it('late image load cannot announce source aid in another selected section',async()=>{
 const f=fixture();await f.open();f.context.selectedExercise={...exercise,id:'other'};
 f.document.querySelector('figure svg image')!.dispatchEvent(new f.window.Event('load'));
 assert.equal(f.document.querySelector('.noam-draw-error')!.textContent,legacy);
});
