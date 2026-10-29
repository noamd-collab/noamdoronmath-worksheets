import { runVisualCompilerInNewContext } from './helpers/visual-compiler-vm';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';

import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const root=new URL('../../../',import.meta.url),pub=new URL('../public/',import.meta.url),c:any={};c.window=c;
for(const name of ['noam-native-visual.js','noam-authored-geometry.js','noam-authored-visual.js','noam-visual-data.js','noam-visual-plan.js','noam-source-data-visual.js'])runVisualCompilerInNewContext(readFileSync(new URL(name,root),'utf8'),c);
const options={studentMessage:'שרטוט להמחשה',helpKind:'hint',drawCurrentStep:true,answer:'תשובה שלא משמשת כמקור.'};
const manifests=readdirSync(new URL('noam-ai/manifests/',pub)).map(file=>JSON.parse(readFileSync(new URL('noam-ai/manifests/'+file,pub),'utf8')));
function own(x:any){c.json=JSON.stringify(x);return runVisualCompilerInNewContext('JSON.parse(json)',c);}
function fixture(pkg:string,level:string,q:number,part:string){const manifest=manifests.find(m=>m.nativeExportUrl===`/noam-ai/native/${pkg}/${level}/noam-ai.json`);assert.ok(manifest);const data=own(JSON.parse(readFileSync(new URL(manifest.nativeExportUrl.slice(1),pub),'utf8'))),exercise=manifest.exercises.find((e:any)=>e.q===q&&e.part===part);assert.ok(exercise);const context=c.NoamNativeVisual.authoredContext(data,exercise,'');assert.ok(context);assert.equal(context.hasFigure,false);return {manifest,data,exercise,context};}
const resolve=(context:any,opt:any=options)=>c.NoamSourceDataVisual.resolve(context,opt),render=(context:any)=>c.NoamSourceDataVisual.render(parseHTML('<html/>').document,context,options),table={head:['x','y'],rows:[['1',''],['2','□']]};
it('W33-Q3 shows the exact original table for all selected items without calculating the tenth step',()=>{
 for(const part of ['א','ב','ג','ד']){const {context}=fixture('G7-T12','a',4,part),scene=resolve(context);assert.equal(scene.kind,'typed-table');assert.deepEqual(JSON.parse(JSON.stringify(scene.table)),{head:['צעד','מידה מצטברת'],rows:[['0','12°'],['1','47°'],['2','82°'],['3','117°']]});const fig=render(context);assert.match(fig.textContent,/הטבלה המקורית כפי שהודפסה/);assert.match(fig.textContent,/לא מולאו תאים ריקים ולא תוקנו ערכים/);assert.doesNotMatch(fig.textContent,/362|סימן שאלה מציין|נתונים/);assert.equal(fig.querySelectorAll('tbody tr').length,4);}
});
it('selected table owns its scope and malformed selected data cannot borrow the parent table',()=>{
 const ctx=own({questionText:'טבלת השאלה.',partText:'טבלת הסעיף הנבחר.',hasFigure:false,questionTable:table,partTable:{head:['a','b'],rows:[['7','□']]}});assert.deepEqual(JSON.parse(JSON.stringify(resolve(ctx).table)),{head:['a','b'],rows:[['7','□']]});
 for(const partTable of [{head:['a','b'],rows:[['7']]},{head:['a'],rows:[['7']]},false,{}])assert.equal(resolve({...ctx,partTable:own(partTable)}),null);
 const parentOnly={...ctx,partTable:undefined};assert.equal(resolve(parentOnly).table.rows[0][0],'1');
});
it('blank markers and deliberately wrong printed cells are preserved without a correctness claim',()=>{
 const blank=fixture('G7-T02','a',11,'א').context,scene=resolve(blank);assert.equal(scene.table.rows.flat().filter((x:string)=>x==='□').length,6);assert.equal(render(blank).querySelectorAll('tbody td').length,scene.table.rows.length*scene.table.head.length);
 const wrong=fixture('G7-T05','a',17,'א').context,before=JSON.stringify(wrong.questionTable),s=resolve(wrong);assert.ok(s.table.rows.flat().includes('−50')||s.table.rows.flat().includes('-50'));assert.equal(JSON.stringify(wrong.questionTable),before);assert.match(render(wrong).textContent,/לא נקבע אילו שורות נכונות/);assert.doesNotMatch(render(wrong).textContent,/נתונים|תשובה נכונה|הטבלה המתוקנת/);
 const empty=own({questionText:'טבלה.',partText:'השלימו.',hasFigure:false,questionTable:{head:['','ערך'],rows:[['a',''],['b','□'],['c','_']]}});assert.deepEqual(JSON.parse(JSON.stringify(resolve(empty).table)),{head:['?','ערך'],rows:[['a','?'],['b','□'],['c','?']]});
});
it('corrected, completed, newly constructed and chosen tables are excluded from the generic fallback',()=>{
 for(const [pkg,level,q,part] of [['G8-T08','b',2,'ג'],['G7-T06','b',10,'ג'],['G8-T16','a',20,'ד'],['G7-T04','b',2,'ד']] as const)assert.equal(resolve(fixture(pkg,level,q,part).context),null,`${pkg}/${level}/q${q}${part}`);
 const ctx=own({questionText:'טבלה מקורית.',partText:'',hasFigure:false,questionTable:table});
 for(const partText of ['מן הטבלה המתוקנת כתבו משוואה.','המשיכו מהשורה המתוקנת.','לאחר התיקון בדקו.','אחרי התיקון בדקו.','עבדו עם מה שתיקנתם.','השתמשו בטבלה שהשלמתם.','הטבלה המלאה היא הבסיס.','בנו טבלה חדשה.','בחרו טבלה משלכם.','טבלה אחרת.','טבלה שונה.','שנו את הטבלה.','כתבו דוגמה נגדית.'])assert.equal(resolve({...ctx,partText}),null,partText);
 assert.equal(resolve({...ctx,partText:'השלימו את הטבלה המקורית.'}).kind,'typed-table');
});
it('all table shape and cell safety limits still come from the shared inspector',()=>{
 const ctx=own({questionText:'טבלה מקורית.',partText:'קראו את השורה.',hasFigure:false,questionTable:table});
 for(const questionTable of [{head:['a','b'],rows:[['1']]},{head:Array(7).fill('a'),rows:[Array(7).fill('1')]},{head:['a','b'],rows:Array(21).fill(['1','2'])},{head:['a','b'],rows:[['1','z'.repeat(161)]]},{head:['a','b'],rows:[['1','\u0000']]},{head:['a','b'],rows:[['1',2]]}])assert.equal(resolve({...ctx,questionTable:own(questionTable)}),null);
 const literal={...ctx,questionTable:own({head:['a','b'],rows:[['<script>alert(1)</script>','□']]})},fig=render(literal);assert.equal(fig.querySelectorAll('script,img,iframe').length,0);assert.ok(fig.textContent.includes('<script>alert(1)</script>'));
});
it('W37-Q2 uses the complete selected bracket expression and never computes a result',()=>{
 for(const [part,expression] of [['א','3 · [9 − (2 − 7)]'],['ב','[5 + 6 · (2 − 7)] : (−5)'],['ג','20 − [(−4) − 8 · (−2)]']] as const){const ctx=fixture('G7-T05','a',5,part).context,scene=resolve(ctx);assert.equal(scene.kind,'typed-operations');assert.equal(scene.expression,expression);const fig=render(ctx);assert.match(fig.textContent,/תוצאה: \?/);assert.match(fig.textContent,/לא חושבה תוצאה/);assert.equal(fig.querySelectorAll('script,image').length,0);assert.equal(resolve(ctx,{...options,answer:'התשובה היא 999'}).expression,expression);}
 const s=resolve(fixture('G7-T05','a',5,'ג').context);assert.equal(s.tree.value,'−');assert.equal(s.tree.children[0].value,'20');assert.equal(s.tree.children[1].value,'−');assert.equal(s.tree.children[1].children[1].value,'×');assert.equal(resolve(fixture('G7-T05','a',5,'ד').context),null);
});
it('whole-part arithmetic excludes relational claims, prose, unsupported fragments and sibling math',()=>{
 const ctx=own({questionText:'חשבו את הביטוי.',partText:'$12+9$',hasFigure:false});assert.equal(resolve(ctx).expression,'12+9');assert.equal(resolve({...ctx,questionText:'נתונות גם $x+999$ ו־$y=17$.'}).expression,'12+9');assert.equal(resolve({...ctx,partText:String.raw`\(12+9\)`}).expression,'12+9');
 for(const partText of ['$30−12:6=3$','$x<9$','$x>9$','$x≤9$','$x≥9$','$x≠9$','חשבו $12+9$.','$12+9$ ועוד $4−2$','$12+9$+4','$12+9','12+9','$x[0]$','$[12+9)$',String.raw`$\sqrt{12}$`,'$□+9$'])assert.equal(resolve({...ctx,partText}),null,partText);
 for(const [pkg,level,q,part] of [['G7-T05','a',8,'א'],['G7-T05','a',8,'ג'],['G9-T02','b',12,'ב']] as const)assert.equal(resolve(fixture(pkg,level,q,part).context),null);
 assert.equal(resolve({...ctx,partText:'',hintText:'12+9'}),null);assert.equal(resolve({...ctx,partText:'$12+9$',questionTable:own(table)}).kind,'typed-table');
});
it('generic routes stay explicit, figure-free, group-free and revalidate instead of accepting saved scene data',()=>{
 for(const ctx of [fixture('G7-T12','a',4,'ד').context,fixture('G7-T05','a',5,'ג').context]){
 for(const drawCurrentStep of [false,undefined,'true',1])assert.equal(resolve(ctx,{...options,drawCurrentStep}),null);
 for(const studentMessage of ['הצג מקור','שרטט דוגמה נגדית','שרטט טבלה חדשה','החלף 2 ב־3'])assert.equal(resolve(ctx,{...options,studentMessage}),null);
 for(const extra of [{hasFigure:true},{hasFigure:undefined},{sourcePanels:[]},{sourcePanels:null}])assert.equal(resolve({...ctx,...extra}),null);
 }
 assert.equal(render({kind:'typed-table',table}),null);
});
for(const name of ['worksheet-viewer-noam.html','headless/astro-poc/public/worksheet-viewer-noam.html'])it(name+': actual viewer saves source-only tables and new operation trees with revalidated identity',async()=>{
 const html=readFileSync(new URL(name,root),'utf8'),fn=(n:string)=>{const i=html.indexOf('function '+n+'(');return html.slice(i,html.indexOf('\nfunction ',i+1));};
 for(const [f,kind] of [[fixture('G7-T12','a',4,'ד'),'source-context'],[fixture('G7-T05','a',5,'ג'),'typed-operations']] as const){const {document}=parseHTML('<html/>');let identity='exact-source',cache:any={data:f.data,svgText:''},refresh=0;
 const s:any={...c,document,manifest:f.manifest,selectedExercise:f.exercise,WeakSet,Promise,noamSourcePanelModuleMissing:()=>false,noamSourcePanelReviewed:()=>false,noamSourceVisualIdentity:()=>identity,noamLoadSourceVisual:async()=>{cache={data:f.data,svgText:''};return cache;},noamCachedSourceVisual:()=>cache,renderNoamChat:()=>refresh++};s.window=s;runVisualCompilerInNewContext(['noamSourceVisualOptions','noamSourcePresentation','noamPrepareSourceVisual','noamRenderSourceVisual'].map(fn).join('\n'),s);
 const visual=await s.noamPrepareSourceVisual(f.exercise,options);assert.equal(visual.presentation,kind);assert.ok(s.noamRenderSourceVisual(JSON.parse(JSON.stringify(visual))));assert.equal(JSON.stringify(visual).includes('table'),false);assert.equal(JSON.stringify(visual).includes('tree'),false);
 cache=null;assert.equal(s.noamRenderSourceVisual(visual),null);await Promise.resolve();assert.equal(refresh,1);assert.ok(s.noamRenderSourceVisual(visual));identity='changed-source';assert.equal(s.noamRenderSourceVisual(visual),null);identity='exact-source';visual.options.drawCurrentStep=false;assert.equal(s.noamRenderSourceVisual(visual),null);
 }
});
