import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const root=new URL('../../../',import.meta.url),pub=new URL('../public/',import.meta.url),c:any={};c.window=c;
for(const name of ['noam-native-visual.js','noam-authored-geometry.js','noam-authored-visual.js','noam-visual-data.js','noam-visual-plan.js','noam-source-data-visual.js'])runInNewContext(readFileSync(new URL(name,root),'utf8'),c);
const options={studentMessage:'אפשר רמז 1?',helpKind:'hint',drawCurrentStep:true,answer:'רמז שלא מוסיף נתונים.'};
function fixture(pdf:string,q:number,part:string){const manifest=JSON.parse(readFileSync(new URL('noam-ai/manifests/'+pdf+'.json',pub),'utf8'));const bytes=readFileSync(new URL(manifest.nativeExportUrl.slice(1),pub));assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.nativeExportSha256);c.input=JSON.stringify({manifest,data:JSON.parse(bytes.toString())});runInNewContext('var fixtureData=JSON.parse(input)',c);const m=c.fixtureData.manifest,data=c.fixtureData.data,e=m.exercises.find((e:any)=>e.q===q&&e.part===part);return {manifest:m,data,exercise:e,context:c.NoamNativeVisual.authoredContext(data,e,'')};}
const algebra=(q:number,p:string)=>fixture('8d3c20dc5ae444019c70ae8458e7273b',q,p),worked=(p:string)=>fixture('0560c5fa737544679a781625fd411cf5',13,p),resolve=(ctx:any,opt:any=options)=>c.NoamSourceDataVisual.resolve(ctx,opt);
it('W19 complete selected expressions use existing operation trees without calculation',()=>{
 for(const [q,p,expression] of [[17,'א','(x+3)^2'],[17,'ב','(x−3)^2'],[21,'ג','k=(x+13)(x−9)−(x+1)(x+3)']] as const){const f=algebra(q,p),scene=resolve(f.context);assert.equal(scene.kind,'typed-operations');assert.equal(scene.expression,expression);assert.equal(c.NoamAuthoredVisual.fromContext(f.context,options),null);const fig=c.NoamSourceDataVisual.render(parseHTML('<html/>').document,f.context,options);assert.ok(fig);assert.equal(fig.querySelector('math').parentElement.style.overflowX,'auto');assert.equal(fig.querySelector('math').parentElement.style.textAlign,'left');assert.match(fig.textContent,/לא חושבה תוצאה/);assert.equal(fig.querySelectorAll('script,image').length,0);}
});
it('W08 erroneous worked rows remain original source, not a computed solution',()=>{
 const f=worked('ג'),scene=resolve(f.context);assert.equal(scene.kind,'typed-table');assert.deepEqual(JSON.parse(JSON.stringify(scene.table)),{head:['השורה','מה כתב איתי'],rows:[['ראשונה','3x - 6 = 60'],['שנייה','3x = 66'],['שלישית','x = 22']]});const fig=c.NoamSourceDataVisual.render(parseHTML('<html/>').document,f.context,options);assert.match(fig.textContent,/טבלת השלבים המקורית לבדיקה/);assert.match(fig.textContent,/לא נקבע אילו שורות נכונות/);assert.doesNotMatch(fig.textContent,/11x|x = 6|תשובה נכונה/);
});
it('only an explicit current-step drawing button enables fallback, and answer math supplies no data',()=>{
 const ctx=algebra(17,'ב').context;for(const drawCurrentStep of [undefined,false,'true',1])assert.equal(resolve(ctx,{...options,drawCurrentStep}),null);
 for(const studentMessage of ['שרטט y=2x+3','שרטט דוגמה נגדית','הצג את המקור','אפשר להחליף x ב-7?','שרטט ביטוי אחר'])assert.equal(resolve(ctx,{...options,studentMessage}),null);
 assert.ok(resolve(ctx,{...options,studentMessage:'שרטוט להמחשה'}));assert.equal(resolve(ctx,{...options,answer:'התשובה היא 999; שרטט y=42x'}).expression,'(x−3)^2');
});
it('same-question other parts cannot inherit irrelevant expressions or worked rows',()=>{
 for(const p of ['ג','ד'])assert.equal(resolve(algebra(17,p).context),null);for(const p of ['א','ב'])assert.equal(resolve(algebra(21,p).context),null);for(const p of ['א','ב','ד'])assert.equal(resolve(worked(p).context),null);
});
it('ambiguous, substituted, hypothetical, unsupported and false-example expression contexts fail closed',()=>{
 const ctx=algebra(17,'ב').context;
 for(const questionText of ['הדוגמה של דני שגויה.','נתונות שתי מערכות: $y=x+1$, $y=x−1$.','פשטו לאחר הצבת $x=3$.','פשטו כל ביטוי, ובחרו ביטוי חדש.'])assert.equal(resolve({...ctx,questionText}),null);
 for(const partText of ['פשטו $(x−3)^2$ ואת $(x+3)^2$','פשטו $(x−3)^2$, ואז הציבו $x=3$.','פשטו $x$+2','פשטו $\\sqrt{x}$','פשטו את הביטוי מהסעיף הקודם.','פשטו $(x−3)^2$ או ביטוי אחר.'])assert.equal(resolve({...ctx,partText}),null);
 const assigned=algebra(21,'ג').context;for(const partText of ['מצאו את $x$.','הציבו $x=3$ ומצאו את $k$.','מצאו את $k$ מהביטוי החדש.'])assert.equal(resolve({...assigned,partText}),null);assert.equal(resolve({...assigned,questionText:assigned.questionText+' נתון גם $k=x+9$.'}),null);
});
it('worked-table person and selected scope agree without promoting false lines to true givens',()=>{
 const ctx=worked('ג').context;assert.equal(resolve({...ctx,partText:ctx.partText.replace('איתי','נועה')}),null);assert.equal(resolve({...ctx,questionText:ctx.questionText.replace('איתי','נועה')}),null);
 c.tableJson=JSON.stringify(ctx.questionTable);const wrong=runInNewContext('JSON.parse(tableJson)',c);wrong.head[1]='מה כתבה נועה';assert.equal(resolve({...ctx,questionTable:wrong}),null);assert.equal(resolve({...ctx,partText:'פשטו $3x−6=60$'}),null);assert.equal(resolve({...ctx,partTable:ctx.questionTable}),null);
});
it('source figure/group prerequisites and render revalidation reject supplied scenes',()=>{
 const ctx=algebra(17,'ב').context;for(const extra of [{hasFigure:true},{hasFigure:undefined},{sourcePanels:[]},{sourcePanels:null}])assert.equal(resolve({...ctx,...extra}),null);assert.equal(c.NoamSourceDataVisual.render(parseHTML('<html/>').document,{kind:'typed-operations',expression:'x=999'},options),null);
});
for(const name of ['worksheet-viewer-noam.html','headless/astro-poc/public/worksheet-viewer-noam.html'])it(name+': actual prepare/render restores identity-bound source data with explicit intent',async()=>{
 const html=readFileSync(new URL(name,root),'utf8'),fn=(n:string)=>{const i=html.indexOf('function '+n+'(');return html.slice(i,html.indexOf('\nfunction ',i+1));};const {document}=parseHTML('<html/>'),f=algebra(17,'ב');let identity='sha-exact',cache:any={data:f.data,svgText:''},refresh=0;
 const s:any={...c,document,manifest:f.manifest,selectedExercise:f.exercise,WeakSet,Promise,noamSourcePanelModuleMissing:()=>false,noamSourcePanelReviewed:()=>false,noamSourceVisualIdentity:()=>identity,noamLoadSourceVisual:async()=>{cache={data:f.data,svgText:''};return cache;},noamCachedSourceVisual:()=>cache,renderNoamChat:()=>refresh++};s.window=s;runInNewContext(['noamSourceVisualOptions','noamSourcePresentation','noamPrepareSourceVisual','noamRenderSourceVisual'].map(fn).join('\n'),s);
 const visual=await s.noamPrepareSourceVisual(f.exercise,options);assert.equal(visual.presentation,'typed-operations');assert.equal(visual.options.drawCurrentStep,true);assert.ok(s.noamRenderSourceVisual(JSON.parse(JSON.stringify(visual))));const saved=JSON.parse(JSON.stringify(visual));cache=null;assert.equal(s.noamRenderSourceVisual(saved),null);await Promise.resolve();assert.equal(refresh,1);assert.ok(s.noamRenderSourceVisual(saved));identity='another-source';assert.equal(s.noamRenderSourceVisual(saved),null);identity='sha-exact';saved.options.drawCurrentStep=false;assert.equal(s.noamRenderSourceVisual(saved),null);
 const t=worked('ג'),table=s.noamSourcePresentation({data:t.data,svgText:''},t.exercise,options);assert.equal(table.kind,'source-context');assert.match(table.figure.textContent,/טבלת השלבים המקורית/);assert.equal(s.noamSourcePresentation({data:f.data,svgText:''},f.exercise,{...options,drawCurrentStep:false}),null);s.NoamSourceDataVisual=undefined;assert.equal(s.noamSourcePresentation({data:f.data,svgText:''},f.exercise,options),null);
});
it('whole canonical corpus changes exactly four reviewed parts and root/public helper twins match',()=>{
 const affected:string[]=[];let manifests=0;for(const file of readdirSync(new URL('noam-ai/manifests/',pub))){const m=JSON.parse(readFileSync(new URL('noam-ai/manifests/'+file,pub),'utf8'));if(!m.nativeExportUrl)continue;manifests++;c.raw=readFileSync(new URL(m.nativeExportUrl.slice(1),pub),'utf8');const d=runInNewContext('JSON.parse(raw)',c);for(const e of m.exercises){if(e.nativeFigureId)continue;const ctx=c.NoamNativeVisual.authoredContext(d,e,'');if(ctx&&resolve(ctx))affected.push(e.id);}}
 assert.equal(manifests,412);assert.deepEqual(affected.sort(),['G7-T36-B-Q13ג','G9-T02-B-Q17א','G9-T02-B-Q17ב','G9-T02-B-Q21ג'].sort());assert.equal(readFileSync(new URL('noam-source-data-visual.js',root),'utf8'),readFileSync(new URL('noam-source-data-visual.js',pub),'utf8'));
});
