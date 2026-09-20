'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Plan=require('../noam-diagram-plan.js');
function fixture(names='ABCDP'){
 const [A,B,C,D,P]=names;
 const facts={visible_points:[A,B,C,D,P],strokes:[[A,B],[B,C],[C,D],[D,A],[A,P],[B,P]]};
 const focus={version:1,status:'ok',mode:'locate',objects:[{kind:'point',points:[P],color:'blue'}]};
 const context={questionText:`הנקודה ${P} בתוך המלבן ${A+B+C+D}.\nDIAGRAM_FACTS_JSON:${JSON.stringify(facts)}\nPEDAGOGICAL_FOCUS_JSON:${JSON.stringify(focus)}`,
 hintText:`האם ניסית להעביר דרך הנקודה ${P} ישר המקביל לצלעות ${A+D} ו-${B+C}?`,studentMessage:'אני לא מבין, תוכל לצייר לי?'};
 const plan={version:1,status:'ok',points:{[A]:[0,0],[B]:[7,0],[C]:[7,4],[D]:[0,4],[P]:[3,1.8]},segments:facts.strokes,
 highlights:[],pointHighlights:[{point:P,color:'blue'}],angles:[],equalGroups:[],rightAngles:[],evidence:[],
 auxiliaryLines:[{kind:'parallel',through:P,parallelTo:[A,D],color:'blue'}]};
 return {context,plan};
}
function doc(){function el(name){return {name,attributes:{},children:[],setAttribute(k,v){this.attributes[k]=String(v)},appendChild(c){this.children.push(c)}}}return {createElement:el,createElementNS:(_,n)=>el(n)}}
function nodes(n){return n?[n].concat((n.children||[]).flatMap(nodes)):[]}
test('parallel construction traverses hint interpretation, shared validation and actual SVG rendering for renamed rotated figures',()=>{
 for(const names of ['ABCDP','KLMNR','EFGHS'])for(const theta of [0,.4,1.3]){
  const {context,plan}=fixture(names);
  for(const [n,[x,y]] of Object.entries(plan.points))plan.points[n]=[x*Math.cos(theta)-y*Math.sin(theta)+5,x*Math.sin(theta)+y*Math.cos(theta)-7];
  assert.deepEqual(Plan.requestedParallelConstruction(context),plan.auxiliaryLines[0]);
  assert.equal(Plan.inspect(plan,context).ok,true);
  const all=nodes(Plan.render(doc(),plan,context)),line=all.find(n=>n.attributes.class==='noam-geometry-construction');assert.ok(line,'a real constructed line, not a scan');
  const direction=plan.points[names[3]].map((v,i)=>v-plan.points[names[0]][i]);
  const delta=[Number(line.attributes.x2)-Number(line.attributes.x1),-(Number(line.attributes.y2)-Number(line.attributes.y1))];
  assert.ok(Math.abs(direction[0]*delta[1]-direction[1]*delta[0])<1e-7,'rendered line is parallel after rotation');
  assert.equal(all.filter(n=>n.name==='img').length,0);
  assert.equal(Object.keys(plan.points).length,5,'no invented labelled endpoints');
 }
});
test('missing requested construction cannot be reported as successful',()=>{
 const {context,plan}=fixture();delete plan.auxiliaryLines;
 assert.equal(Plan.inspect(plan,context).reason,'missing_requested_construction');
 assert.equal(Plan.render(doc(),plan,context),null);
});
test('incorrect through point, reference line and unsupported construction stay blocked',()=>{
 for(const change of [{through:'A'},{parallelTo:['A','B']},{kind:'perpendicular'},{through:'Z'}]){
  const {context,plan}=fixture();Object.assign(plan.auxiliaryLines[0],change);
  assert.equal(Plan.inspect(plan,context).ok,false);assert.equal(Plan.render(doc(),plan,context),null);
 }
});
test('student narrows focus or negates drawing: previous hint cannot authorize auxiliary line',()=>{
 for(const text of ['סמן רק את AP','אל תעביר דרך הנקודה P ישר המקביל ל-AD','איפה הנקודה A?']){
  const {context,plan}=fixture();context.studentMessage=text;
  assert.equal(Plan.requestedParallelConstruction(context),null);
  assert.equal(Plan.inspect(plan,context).ok,false);
 }
});
test('source figure distortion and additional proof marks remain rejected',()=>{
 const {context,plan}=fixture();plan.points.C=[8,3];
 assert.equal(Plan.inspect(plan,context).reason,'source_coordinate_contradiction');
 const clean=fixture();clean.plan.equalGroups=[{segments:[['A','P'],['B','P']],count:1,color:'blue'}];
 assert.equal(Plan.inspect(clean.plan,clean.context).ok,false);
});
module.exports={fixture};
