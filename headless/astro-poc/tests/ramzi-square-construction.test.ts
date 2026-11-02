import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const pub=new URL('../public/',import.meta.url),c:any={};c.window=c;
for(const f of ['noam-native-visual.js','noam-authored-geometry.js','noam-authored-visual.js','noam-visual-plan.js'])runInNewContext(readFileSync(new URL(f,pub),'utf8'),c);
const manifest=JSON.parse(readFileSync(new URL('noam-ai/manifests/9f4807731eac489881c7eefd54b52cab.json',pub),'utf8'));
const bytes=readFileSync(new URL(manifest.nativeExportUrl.slice(1),pub)),data=JSON.parse(bytes.toString());
const draw={studentMessage:'אפשר רמז 1?',helpKind:'hint',drawCurrentStep:true,answer:'התבוננו בנתונים שבשאלה.'};
function fixture(q:number,part:string){const exercise=manifest.exercises.find((e:any)=>e.q===q&&e.part===part);return {exercise,context:c.NoamNativeVisual.authoredContext(data,exercise,'')};}
function render(scene:any){return c.NoamAuthoredGeometry.render(parseHTML('<html><body></body></html>').document,scene);}
function plan(context:any,quote=context.questionText){return c.NoamVisualPlan.inspect({version:2,status:'ok',family:'given-geometry',evidence:[{source:'question',quote}]},{...context,hintText:draw.answer,studentMessage:draw.studentMessage});}
const plain=(v:any)=>JSON.parse(JSON.stringify(v));

it('W16 exact native source resolves a square with adjacent midpoints and only its printed area',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.nativeExportSha256);
 const f=fixture(3,'א'),scene=c.NoamAuthoredVisual.resolve(data,f.exercise,draw,'');
 assert.equal(scene.kind,'authored-square-construction');
 assert.deepEqual(plain(scene.data),{variant:'adjacent-midpoints',measure:'36',midpointNames:['E','F']});
 const figure=render(scene),points=[...figure.querySelectorAll('[data-role="given-midpoint"]')].map((n:any)=>[+n.getAttribute('cx'),+n.getAttribute('cy')]);
 assert.deepEqual(points,[[220,45],[350,175]]);
 assert.equal(figure.querySelectorAll('polygon').length,1);assert.equal(figure.querySelectorAll('line').length,1);
 assert.deepEqual([...figure.querySelectorAll('[data-role="vertex-label"]')].map((n:any)=>n.textContent),['E','F']);
 assert.equal(figure.querySelector('[data-role="given-measure"]').textContent,'36');
 assert.doesNotMatch(figure.textContent,/(?<!\d)(?:6|3|18)(?!\d)|√|ABCD|צלע.*=/);
 assert.equal(plan(f.context).ok,true);
});
it('W16 square diagonals preserve the given radical without deriving a side or naming new vertices',()=>{
 const f=fixture(7,'ג'),scene=c.NoamAuthoredVisual.resolve(data,f.exercise,draw,'');
 assert.deepEqual(plain(scene.data),{variant:'diagonals',measure:'7\\sqrt{2}',midpointNames:[]});
 const figure=render(scene);assert.equal(figure.querySelectorAll('polygon').length,1);assert.equal(figure.querySelectorAll('line').length,2);
 assert.equal(figure.querySelectorAll('[data-role="given-diagonal-intersection"]').length,1);
 assert.equal(figure.querySelectorAll('[data-role="vertex-label"]').length,0);
 assert.equal(figure.querySelector('[data-role="given-measure"]').textContent,'7√2');
 assert.equal(figure.querySelector('[data-role="given-measure"]').getAttribute('dir'),'ltr');
 assert.doesNotMatch(figure.textContent,/9\.899|49|28|45°|90°|ABCD|צלע.*7/);assert.equal(plan(f.context).ok,true);
});
it('selected changes and unbound named targets cannot inherit the square construction',()=>{
 assert.equal(c.NoamAuthoredGeometry.resolve(fixture(7,'ה').context,draw),null,'ABC has no printed corner mapping in this source');
 for(const partText of ['שרטטו ריבוע חדש.','הוסיפו נקודה G על הצלע.','נניח ששטח הריבוע 49.','הקטינו את הצלע פי שניים.','חשבו את AB.','מצאו דוגמה נגדית.','אם הריבוע היה מלבן, מה היה משתנה?','סמנו את חוצה הזווית.']){
  const context={...fixture(3,'א').context,partText};assert.equal(c.NoamAuthoredGeometry.resolve(context,draw),null,partText);assert.equal(plan(context).ok,false,partText);
 }
});
it('only the complete two printed forms are supported; metadata cannot fill missing source',()=>{
 const context=fixture(3,'א').context;
 for(const questionText of [context.questionText+' הוסיפו אלכסון.',context.questionText.replace('סמוכות','נגדיות'),context.questionText.replace('36','0'),context.questionText.replace('36','10000'),context.questionText.replace('E,F','E,E'),'ריבוע ששטחו36 סמ״ר.',context.questionText.replace('שרטטו','האם אפשר לשרטט')]){
  assert.equal(c.NoamAuthoredGeometry.resolve({...context,questionText},draw),null,questionText);
 }
 assert.equal(c.NoamAuthoredGeometry.resolve({...context,questionText:'',to_construct:data.questions.find((q:any)=>q.id==='q3').to_construct},draw),null);
 assert.equal(c.NoamAuthoredGeometry.resolve({...context,hasFigure:true},draw),null);
 const changed={...context,questionText:context.questionText.replace('36','81').replace('E,F','P,Q')};
 assert.deepEqual(plain(c.NoamAuthoredGeometry.resolve(changed,draw).data),{variant:'adjacent-midpoints',measure:'81',midpointNames:['P','Q']});
 const diagonal=fixture(7,'ג').context;
 for(const replacement of ['7','7\\sqrt{3}','7\\sqrt{2}+1','-7\\sqrt{2}','10000\\sqrt{2}'])assert.equal(c.NoamAuthoredGeometry.resolve({...diagonal,questionText:diagonal.questionText.replace('7\\sqrt{2}',replacement)},draw),null);
});
it('v2 requires the whole construction evidence and renderer rejects altered scenes',()=>{
 const context=fixture(3,'א').context,scene=c.NoamAuthoredGeometry.resolve(context,draw);
 assert.equal(plan(context,context.questionText.split('. ')[0]+'.').ok,false);
 assert.equal(plan(context,context.questionText.replace('$36$','36')).ok,false);
 for(const mutate of [(s:any)=>s.data.measure='6', (s:any)=>s.data.measure='36'] ){
  // The renderer is a typed-value validator; source binding is checked again
  // by the inspector. Neither a model-supplied measure nor scene is accepted.
  const p={version:2,status:'ok',family:'given-geometry',evidence:[{source:'question',quote:context.questionText}],data:plain(scene.data)};mutate({data:p.data});
  assert.equal(c.NoamVisualPlan.inspect(p,context).ok,false);
 }
 for(const mutate of [(s:any)=>s.data.measure='Math.sqrt(36)',(s:any)=>s.data.midpointNames=['A','A'],(s:any)=>s.data.url='https://example.test',(s:any)=>s.caption='answer',(s:any)=>s.data.variant='chosen-square']){
  c.__sceneJson=JSON.stringify(scene);const copy=runInNewContext('JSON.parse(__sceneJson)',c);mutate(copy);assert.equal(render(copy),null);
 }
 assert.equal(render(scene).querySelectorAll('script,image,foreignObject').length,0);
});
it('drawing intent and unrelated typed requests retain their existing restrictions',()=>{
 const context=fixture(3,'א').context;
 assert.equal(c.NoamAuthoredGeometry.resolve(context,{studentMessage:'אפשר רמז 1?',helpKind:'hint',answer:'חשב את הצלע.'}),null);
 for(const studentMessage of ['שרטט ריבוע אחר ששטחו49','הראה את השרטוט המקורי','שרטט דוגמה נגדית'])assert.equal(c.NoamAuthoredGeometry.resolve(context,{...draw,studentMessage}),null);
});
for(const path of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html'])it(path+': actual source presentation uses the typed square renderer for the two failing exercises',()=>{
 const html=readFileSync(new URL(path,import.meta.url),'utf8'),start=html.indexOf('function noamSourcePresentation('),tail=html.slice(start),code=tail.slice(0,tail.indexOf('\nfunction ',1));
 const {document}=parseHTML('<html><body></body></html>'),scope:any={...c,document,noamSourcePanelModuleMissing:()=>false,noamSourcePanelReviewed:()=>false};scope.window=scope;
 runInNewContext(code,scope);
 for(const [q,part] of [[3,'א'],[7,'ג']] as const){const f=fixture(q,part),presentation=scope.noamSourcePresentation({data,svgText:''},f.exercise,draw);
  assert.equal(presentation.kind,'authored-square-construction');assert.equal(presentation.figure.querySelectorAll('polygon').length,1);
  assert.equal(presentation.figure.querySelectorAll('image,script').length,0);assert.match(presentation.figure.textContent,/לא חושבו/);
 }
});
it('corpus impact is exactly the seven selected parts supported by the two complete source stems',()=>{
 const impacted:string[]=[];
 for(const file of readdirSync(new URL('noam-ai/manifests/',pub))){
  const m=JSON.parse(readFileSync(new URL('noam-ai/manifests/'+file,pub),'utf8'));if(!m.nativeExportUrl)continue;
  const d=JSON.parse(readFileSync(new URL(m.nativeExportUrl.slice(1),pub),'utf8'));
  for(const e of m.exercises){if(e.nativeFigureId)continue;const ctx=c.NoamNativeVisual.authoredContext(d,e,'');if(!ctx)continue;
   const scene=c.NoamAuthoredGeometry.resolve(ctx,draw);if(scene?.kind==='authored-square-construction')impacted.push(e.id);
  }
 }
 assert.deepEqual(impacted.sort(),['G9-T20-B-Q03א','G9-T20-B-Q03ב','G9-T20-B-Q03ג','G9-T20-B-Q07א','G9-T20-B-Q07ב','G9-T20-B-Q07ג','G9-T20-B-Q07ד']);
});
it('root/public square compiler and typed validator remain identical',()=>{
 for(const file of ['noam-authored-geometry.js','noam-visual-plan.js'])assert.equal(readFileSync(new URL(file,pub),'utf8'),readFileSync(new URL('../../../'+file,import.meta.url),'utf8'));
});
