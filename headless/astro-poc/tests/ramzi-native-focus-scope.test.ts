import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {it} from 'node:test';
import {parseHTML} from 'linkedom';
const pub=new URL('../public/',import.meta.url),c:any={};runInNewContext(readFileSync(new URL('noam-native-visual.js',pub),'utf8'),c);const api=c.NoamNativeVisual;
function fixture(pdf:string,q:number,part:string){const m=JSON.parse(readFileSync(new URL('noam-ai/manifests/'+pdf+'.json',pub),'utf8')),d=JSON.parse(readFileSync(new URL(m.nativeExportUrl.slice(1),pub),'utf8')),e=m.exercises.find((e:any)=>e.q===q&&e.part===part),f=d.figures.find((f:any)=>f.id===e.nativeFigureId),svg=readFileSync(new URL(e.nativeFigureUrl.slice(1),pub),'utf8');return{d,e,f,svg};}
const triangle=()=>fixture('a51eaa62e9da4001aa3c8604cee3fa26',17,'ב'),kite=()=>fixture('46cba3a6ac9a4726aa21d0976d92661b',3,'ב'),extended=()=>fixture('ddfdb423c2dc4e9d925ee5be56971195',18,'א');
const hint=(answer:string)=>({answer,studentMessage:'אפשר רמז 1?',helpKind:'hint'}),resolve=(f:any,answer:string)=>api.resolve(f.d,f.e,hint(answer),f.svg),plain=(v:any)=>JSON.parse(JSON.stringify(v));
function horizontal(s:any){return plain(s.shapes).filter((x:any)=>x.tag==='line'&&Number(x.attrs.y1)===88.81&&Number(x.attrs.y2)===88.81).map((x:any)=>[Number(x.attrs.x1),Number(x.attrs.x2)].sort((a,b)=>a-b)).sort((a:any,b:any)=>a[0]-b[0]);}
it('W17 explicit LaTeX and Hebrew angles focus two vertices, not whole triangles',()=>{for(const answer of ['במשולש, מה הקשר בין $\\angle ABC$ לבין $\\angle CAB$?','במשולש, מה הקשר בין $\\angle{ABC}$ לבין $\\angle{CAB}$?','במשולש, התבוננו בזווית ABC ובזווית CAB.']){const s=resolve(triangle(),answer);assert.equal(s.kind,'source-focus');assert.equal(s.shapes.length,0);assert.equal(s.arcs.length,2);assert.deepEqual(plain(s.arcs.map((a:any)=>a[1])),[[123.53,188.73],[19.55,188.73]]);assert.match(s.caption,/∠ABC, ∠CAB/);}});
it('W23 congruence prose does not promote anglesLKM/NKM to triangles',()=>{const s=resolve(kite(),'בשני המשולשים החופפים, מה הקשר בין $\\angle LKM$ ובין $\\angle NKM$?');assert.equal(s.arcs.length,2);assert.equal(s.shapes.length,0);assert.deepEqual(plain(s.arcs.map((a:any)=>a[1])),[[106.35,220.6],[106.35,220.6]]);});
it('W29 explicit triangleABD stops atB and two named angles receive arcs only',()=>{const s=resolve(extended(),'המשולש ABD שווה שוקיים לפי BD = BA. מה הקשר בין $\\angle ADB$ ו-$\\angle BAD$?');assert.equal(s.arcs.length,2);assert.deepEqual(plain(s.arcs.map((a:any)=>a[1])),[[26,88.81],[173.53,26.19]]);assert.ok(horizontal(s).length);assert.ok(horizontal(s).every((p:any)=>p[1]===113.05));assert.doesNotMatch(s.caption,/111|180|3x/);});
it('BD andDB clip the referencedCD stroke; explicitCD remains complete',()=>{for(const name of ['BD','DB'])assert.deepEqual(horizontal(resolve(extended(),'התבוננו בקטע '+name+'.')),[[26,113.05]]);assert.deepEqual(horizontal(resolve(extended(),'התבוננו בקטע CD.')),[[26,234]]);});
it('BC andBD retain separate spans on one parent stroke',()=>{assert.deepEqual(horizontal(resolve(extended(),'התבוננו בקטעים BC ו-BD.')),[[26,113.05],[113.05,234]]);});
it('polygonABC parts do not widen BC intoBD',()=>{assert.deepEqual(horizontal(resolve(extended(),'התבוננו במשולש ABC.')),[[113.05,234]]);});
it('missing ray, displaced vertex and group transform reject angle focus',()=>{for(const mutate of [(f:any)=>f.svg=f.svg.replace('id="seg-AB"','id="gone"'),(f:any)=>f.f.visual_model.objects.find((o:any)=>o.name==='B'&&o.type==='point').svg_xy[1]-=3,(f:any)=>f.svg=f.svg.replace('<svg ','<svg transform="translate(5 0)" ')]){const f=triangle();mutate(f);assert.equal(resolve(f,'במשולש, התבוננו ב-\\angle ABC.'),null);}});
it('invalid span metadata never falls back to the full parent line',()=>{for(const span of [null,[],['B'],['B','D','C'],['B','Z'],['B','B'],['A','D'],['D','C']]){const f=extended();f.f.visual_model.objects.find((o:any)=>o.name==='BD'&&o.type==='segment').parts[0].span=span;assert.equal(resolve(f,'התבוננו בקטע BD.'),null,JSON.stringify(span));}});
it('missing, shortened, transformed and mismatched source geometry rejects subspan',()=>{for(const mutate of [(f:any)=>f.svg=f.svg.replace('id="e0004"','id="gone"'),(f:any)=>f.svg=f.svg.replace('x1="234" y1="88.81" x2="26"','x1="234" y1="88.81" x2="100"'),(f:any)=>f.svg=f.svg.replace('id="e0004"','transform="translate(5 0)" id="e0004"'),(f:any)=>f.f.visual_model.objects.find((o:any)=>o.name==='B'&&o.type==='point').svg_xy[1]-=2]){const f=extended();mutate(f);assert.equal(resolve(f,'התבוננו בקטע BD.'),null);}});
it('explicit triangle and angle remain independent, with no inferred numeric value',()=>{const f=triangle(),s=resolve(f,'התבוננו במשולש ABC וגם בזווית CAB.');assert.equal(s.arcs.length,1);assert.ok(s.shapes.length>0);const fig=api.render(parseHTML('<html/>').document,f.d,f.e,hint('התבוננו ב-\\angle ABC.'),f.svg);assert.equal(fig.querySelectorAll('path').length,1);assert.equal(fig.querySelectorAll('text').length,0);assert.equal(fig.querySelectorAll('image').length,1);assert.doesNotMatch(fig.textContent,/36|72|שוות|שווים/);});
it('wrong selected item and duplicate named vertices remain rejected',()=>{let f=triangle();f.e.nativeItemId='q1a';assert.equal(resolve(f,'התבוננו ב-\\angle ABC.'),null);f=triangle();f.f.visual_model.objects.push({...f.f.visual_model.objects.find((o:any)=>o.type==='point'&&o.name==='A'),id:'duplicate-A'});assert.equal(resolve(f,'התבוננו ב-\\angle ABC.'),null);});
it('a named source group authorizes an angle only through its complete covering line',()=>{
  const grouped=()=>fixture('2451661032894637b575413d16009a88',5,'א');
  const s=resolve(grouped(),'התבוננו ב-\\angle ABC.');
  assert.equal(s.arcs.length,1);assert.equal(s.shapes.length,0);
  assert.deepEqual(plain(s.arcs[0][1]),[213.06,120.64]);
  const group=/<g class="ink-copy" id="seg-BC"[^>]*>([\s\S]*?)<\/g>/;
  const covering=/<line class="ink-copy" x1="213.06" y1="120.64" x2="113.06" y2="30.60"[^>]*\/>/;
  for(const mutate of [
    (f:any)=>f.svg=f.svg.replace(group,(_:string,body:string)=>'<g id="seg-BC">'+body.replace(covering,'')+'</g>'),
    (f:any)=>f.svg=f.svg.replace('id="seg-BC" data-kind','id="wrong-group" data-kind'),
    (f:any)=>f.svg=f.svg.replace(group,(_:string,body:string)=>'<g id="seg-BC">'+body+body.match(covering)[0].replace('stroke-width="1.50"','stroke-width="2.50"')+'</g>'),
    (f:any)=>f.svg=f.svg.replace('id="seg-BC" data-kind','transform="translate(1 0)" id="seg-BC" data-kind'),
    (f:any)=>f.f.visual_model.objects.find((o:any)=>o.name==='BC'&&o.type==='segment').svg_xy[0][0]-=1,
    (f:any)=>f.svg=f.svg.replace('</svg>','<g id="seg-BC"></g></svg>')
  ]){const f=grouped();mutate(f);assert.equal(resolve(f,'התבוננו ב-\\angle ABC.'),null);}
  const duplicate=grouped();duplicate.svg=duplicate.svg.replace(group,(_:string,body:string)=>'<g id="seg-BC">'+body+body.match(covering)![0]+'</g>');
  assert.equal(resolve(duplicate,'התבוננו ב-\\angle ABC.').arcs.length,1);
});

it('polygon spans cannot extend into a collinear adjacent segment',()=>{const f=extended();const polygon=f.f.visual_model.objects.find((o:any)=>o.name==='ABC'&&o.type==='polygon');polygon.parts.find((p:any)=>p.span).span=['D','C'];assert.equal(resolve(f,'התבוננו במשולש ABC.'),null);});
