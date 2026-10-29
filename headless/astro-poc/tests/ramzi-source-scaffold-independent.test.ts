import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const pub = new URL('../public/', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, pub), 'utf8'));
const rt: any = {};
for (const f of ['noam-native-visual.js', 'noam-visual-data.js', 'noam-source-panels.js', 'noam-source-scaffold.js'])
  runInNewContext(readFileSync(new URL(f, pub), 'utf8'), rt, { filename: f });
const api = rt.NoamSourceScaffold;
const opts = { drawCurrentStep: true, studentMessage: 'אפשר רמז 1?' };
const fixtures = [
 ['W15-Q3','162e9a4cd15e41c5bb68cc6a1b600e81','G8-T46-E-Q20ד','area-comparison'],
 ['W32-Q1','45ab1aedeacb4ed5b8b40b4fec71af5b','G8-T32-B-Q04ד','redistribution'],
 ['W32-Q2','45ab1aedeacb4ed5b8b40b4fec71af5b','G8-T32-B-Q20א','group-averages'],
 ['W11-Q3','084c58836048405aa2a2f97ba4396553','G7-T21-A-Q16ב','symbolic-rectangle'],
 ['W15-Q1','162e9a4cd15e41c5bb68cc6a1b600e81','G8-T46-E-Q05ב','proof-lanes'],
 ['W24-Q3','c9acfbe1c4c14f318cdf9f977e088df0','G7-T03-B-Q11ד','signed-factors'],
 ['W26-Q1','5950ef9247f34453984c51b3a1baf3cd','G7-T37-B-Q10א','equation-comparison'],
 ['W26-Q2','5950ef9247f34453984c51b3a1baf3cd','G7-T37-B-Q16א','purchase-groups'],
 ['W28-Q3','596c40e9ffb049e8b4e53a7960a9fef1','G7-T04-B-Q06ג','fraction-placeholder'],
 ['W30-Q2','93d227a045fa4fdeb217597f630634eb','G9-T11-A-Q06ב','observed-future'],
];
function source(id: string) {
 const f = fixtures.find(x => x[0] === id)!;
 const m = read(`noam-ai/manifests/${f[1]}.json`), data = read(m.nativeExportUrl.replace(/^\//,''));
 const ex = m.exercises.find((x: any) => x.id === f[2]);
 const q = data.questions.find((x: any) => x.id === ex.nativeQuestionId), part = q.items.find((x: any) => x.id === ex.nativeItemId);
 return { data, ex, q, part, expected: f[3] };
}
const resolve = (s: any, options=opts) => api.resolve(s.data,s.ex,options,'');
const render = (s: any) => { const { document }=parseHTML('<html><body></body></html>'); return api.render(document,s.data,s.ex,opts,''); };
for (const [id] of fixtures) it(`independent real ${id}: visible scaffold preserves exact selected source`, () => {
 const s=source(id), before=JSON.stringify(s.data), scene=resolve(s), figure=render(s);
 assert.equal(scene?.kind,`source-scaffold-${s.expected}`);
 assert.equal(scene.itemId,s.part.id); assert.equal(scene.exerciseId,s.ex.id);
 assert.equal(figure?.getAttribute('data-presentation'),'instructional-scaffold');
 assert.equal(figure?.querySelectorAll('svg').length,1);
 assert.ok(figure?.querySelector('rect,circle,path,line'));
 assert.match(figure?.querySelector('figcaption')?.textContent || '', /לא איור מקורי ולא פתרון/);
 assert.equal(figure?.querySelectorAll('script,foreignObject,image,iframe').length,0);
 assert.doesNotMatch(figure.outerHTML,/NaN|Infinity|undefined/);
 assert.equal(JSON.stringify(s.data),before,'renderer never mutates authored data');
});
it('independent exact current exercise identity, unique q/part and explicit request are mandatory',()=>{
 for (const mutate of [
  (s:any)=>{s.ex.id=s.ex.id.replace('-B-','-A-');},
  (s:any)=>{s.ex.nativeItemId='q4a';},
  (s:any)=>{s.data.questions.push(JSON.parse(JSON.stringify(s.q)));},
  (s:any)=>{s.q.items.push(JSON.parse(JSON.stringify(s.part)));},
  (s:any)=>{s.part.figure_id='q4_head';s.ex.nativeFigureUrl='/foreign.svg';},
 ]){const s=source('W32-Q1');mutate(s);assert.equal(resolve(s),null);}
 const s=source('W32-Q1');
 for (const o of [{...opts,drawCurrentStep:false},{...opts,studentMessage:'צייר 100 קופסאות עם 50 בכל אחת'}, {drawCurrentStep:true}])
  assert.equal(resolve(s,o as any),null);
});
it('independent prior-box source dependencies cannot come from later or ambiguous siblings',()=>{
 const changes = [
  (s:any)=>{s.q.items.splice(1,1);},
  (s:any)=>{const addition=s.q.items.splice(1,1)[0];s.q.items.push(addition);},
  (s:any)=>{s.q.items.splice(1,0,{...s.q.items[1],id:'q4extra'});},
  (s:any)=>{s.q.items[1].text=s.q.items[1].text.replace('שירה','דנה');},
  (s:any)=>{s.q.items[2].text=s.q.items[2].text.replace('שירה','דנה');},
  (s:any)=>{s.q.items[2].text='הקופסאות נשארות כפי שהיו. כמה עפרונות בכל קופסה?';},
  (s:any)=>{s.q.items[1].text=s.q.items[1].text.replace('$4$','$4$ או $7$');},
  (s:any)=>{s.part.text='הסבירו מה יקרה אם תוסיפו קופסה אחרת לבחירתכם.';},
 ];
 for(const mutate of changes){const s=source('W32-Q1');mutate(s);assert.equal(resolve(s),null);}
});
it('independent stale numeric givens and hint text cannot donate box counts',()=>{
 const s=source('W32-Q1'), baseline=JSON.stringify(resolve(s));
 s.q.given=[{text:'הנתונים: $100$, $200$, $300$'}];s.part.given=[{text:'הקופסה הרביעית ובה 99'}];
 assert.equal(JSON.stringify(resolve(s,{...opts,answer:'התשובה 7 בכל קופסה'} as any)),baseline);
 assert.deepEqual(Array.from(resolve(s).values),[6,9,9]);assert.equal(resolve(s).added,4);
 const text=render(s).textContent;assert.doesNotMatch(text,/\b7\b|\b8\b|100|200|300|99/);
});
it('independent geometry scaffolds never appropriate last-part source or student-chosen geometry',()=>{
 const area=source('W15-Q3');assert.equal(area.q.figure_id,'q20_head');assert.equal(area.part.figure_id,null);
 const a=render(area);assert.equal(a.querySelectorAll('[data-role="whole"]').length,2);
 assert.doesNotMatch(a.textContent,/AB|CD|BAO|∥|288/);
 const proof=source('W15-Q1'), p=render(proof);
 assert.equal(resolve(proof).slots.length,5);assert.match(p.textContent,/ההוכחה שתכננתם/);
 assert.doesNotMatch(p.textContent,/ABC|ADE|∥|מקביל/);
});
it('independent W11 shows given dimensions without completing the expression/table',()=>{
 const s=source('W11-Q3'),scene=resolve(s),f=render(s);
 assert.equal(scene.variable,'n');assert.equal(scene.extra,3);
 assert.doesNotMatch(f.textContent,/n\s*[²^]|n\s*\(\s*n\s*\+\s*3|28|54/);
 assert.match(f.textContent,/מספר האריחים: \?/);
 assert.deepEqual(s.q.table.rows[0].slice(1),['___','___','___']);
});
it('independent selected quantities and operations remain literal, not answers',()=>{
 const signed=source('W24-Q3');assert.deepEqual(Array.from(resolve(signed).values),[-2,-8,3]);assert.doesNotMatch(render(signed).textContent,/48/);
 const eq=source('W26-Q1');assert.deepEqual(Array.from(resolve(eq).equations),['x + 2 = 7','3x = 15']);assert.doesNotMatch(render(eq).textContent,/x\s*=\s*5/);
 const purchase=source('W26-Q2'),p=render(purchase);assert.equal(p.querySelectorAll('[data-role="unknown-notebook"]').length,5);
 assert.match(p.textContent,/20/);assert.match(p.textContent,/55/);assert.doesNotMatch(p.textContent,/5x\s*\+\s*20\s*=\s*55|x\s*=\s*7/);
 const frac=source('W28-Q3');assert.equal(resolve(frac).numerator,-14);assert.equal(resolve(frac).result,0);assert.equal(render(frac).querySelectorAll('[data-role="unfilled-divisor"]').length,1);
 const probability=source('W30-Q2'),f=render(probability);assert.equal(f.querySelectorAll('[data-role="observed-success"]').length,18);
 assert.equal(f.querySelectorAll('[data-role="observed-other"]').length,42);assert.doesNotMatch(f.textContent,/30%|0\.3|27|מובטח/);
});
it('independent multiplication relationship is visible without evaluating it',()=>{
 const f=render(source('W24-Q3'));
 assert.equal((f.textContent.match(/×/g)||[]).length,2);
 assert.match(f.textContent,/\?/);
 assert.doesNotMatch(f.textContent,/48/);
});
it('independent two-group counts must agree with the printed total, not merely parse',()=>{
 const valid=source('W32-Q2');assert.ok(resolve(valid));
 const bad=source('W32-Q2');bad.part.text=bad.part.text.replace('$5$ שחקנים','$7$ שחקנים');assert.equal(resolve(bad),null);
 const badTotal=source('W32-Q2');badTotal.part.text=badTotal.part.text.replace('עשרת','12');assert.equal(resolve(badTotal),null);
});
it('independent adjacent zero-numerator fraction preserves its distinct authored equation',()=>{
 const s=source('W28-Q3'),m=read('noam-ai/manifests/596c40e9ffb049e8b4e53a7960a9fef1.json');
 s.ex=m.exercises.find((x:any)=>x.id==='G7-T04-B-Q06ב');s.part=s.q.items.find((x:any)=>x.id==='q6b');
 const sc=resolve(s);assert.equal(sc.numerator,0);assert.equal(sc.result,0);
 const f=render(s);assert.equal(f.querySelectorAll('[data-role="unfilled-divisor"]').length,1);
 assert.doesNotMatch(f.textContent,/כל מספר|אין פתרון|−14|-14/);
});
