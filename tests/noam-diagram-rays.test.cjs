"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Plan=require("../noam-diagram-plan.js");
const Geometry=require("../noam-geometry.js");

function plan(){return {version:1,status:"ok",points:{M:[0,0],A:[4,0],B:[2,2],C:[1,3]},segments:[["M","A"],["M","B"],["M","C"]],highlights:[{from:"M",to:"A",color:"blue"},{from:"M",to:"C",color:"blue"}],pointHighlights:[{point:"M",color:"blue"}]};}
function context(questionText){return {questionText:questionText||"מן הנקודה M יוצאות שלוש קרניים: MA, MB ו-MC.",studentMessage:"הדגם באמצעות שרטוט את MA ו-MC ואת הקודקוד M.",hintText:""};}
function documentStub(){function create(name){return {name,attributes:{},children:[],className:"",textContent:"",appendChild(node){this.children.push(node);return node;},setAttribute(key,value){this.attributes[key]=String(value);if(key==="class"){this.className=String(value);}}};}return {createElement:create,createElementNS(_ns,name){return create(name);}};}
function nodes(node){return node?[node].concat((node.children||[]).flatMap(nodes)):[];}

test("source-named Hebrew rays acquire arrowheads even when cached wire plan omitted optional rays",()=>{
  const p=plan(),before=JSON.stringify(p),result=Plan.inspect(p,context());
  assert.equal(result.ok,true,result.reason);
  assert.deepEqual(result.scene.rays,[["M","A"],["M","B"],["M","C"]]);
  const card=Plan.render(documentStub(),p,context()),all=nodes(card);
  assert.ok(card);assert.equal(JSON.stringify(p),before);
  const arrows=all.filter(n=>n.className==="noam-geometry-ray-arrow");
  assert.deepEqual(arrows.map(n=>n.attributes["data-ray"]),["MA","MB","MC"]);
  assert.deepEqual(arrows.map(n=>n.attributes.stroke),["#2563eb","#172440","#2563eb"]);
  assert.equal(all.filter(n=>n.className==="noam-geometry-label").map(n=>n.textContent).join(""),"MABC");
  assert.equal(all.some(n=>n.className==="noam-geometry-equality-mark"||n.className==="noam-geometry-right-angle"||n.className==="noam-geometry-length-label"),false);
});

test("explicit directed ray declarations must match source direction and an existing segment",()=>{
  const p=plan();p.rays=[["M","A"],["M","C"]];
  assert.equal(Plan.inspect(p,context()).ok,true);
  p.rays=[["A","M"]];assert.equal(Plan.inspect(p,context()).reason,"ungrounded_ray");
  p.rays=[["M","A"],["M","A"]];assert.equal(Plan.inspect(p,context()).reason,"duplicate_ray");
  p.rays=Array.from({length:17},()=>["M","A"]);assert.equal(Plan.inspect(p,context()).reason,"invalid_list");
  p.rays=[["M","A"]];p.segments=p.segments.filter(ends=>ends[1]!=="A");
  assert.equal(Plan.inspect(p,context()).reason,"undrawn_ray");
});

test("English and Hebrew singular/plural ray lists are grounded without promoting student requests",()=>{
  const p=plan();
  for(const sentence of ["Rays MA, MB and MC start at M.","The rays MA, MB, and MC start at M.","הקרן MA והקרן MC יוצאות מן M. מסומנת נקודה B."]){
    const result=Plan.inspect(p,context(sentence));assert.equal(result.ok,true,result.reason);
    assert.ok(result.scene.rays.some(pair=>pair.join("")==="MA"),sentence);
    assert.ok(result.scene.rays.some(pair=>pair.join("")==="MC"),sentence);
  }
  const c=context("מסומנות הנקודות M, A, B, C והקטעים MA, MB ו-MC.");
  c.studentMessage="הדגם באמצעות שרטוט את הקרניים MA ו-MC ואת M.";
  assert.deepEqual(Plan.inspect(p,c).scene.rays,[]);
  p.rays=[["M","A"]];assert.equal(Plan.inspect(p,c).reason,"ungrounded_ray");
});

test("goals, questions, conditionals and negated ray claims are not affirmative source",()=>{
  const p=plan();p.rays=[["M","A"]];
  for(const sentence of ["האם הקרן MA עוברת בנקודה C?","נניח שהקרן MA עוברת בנקודה C.","לא נתונה הקרן MA.","Suppose ray MA goes through C.","Is ray MA in the diagram?"]){
    assert.equal(Plan.inspect(p,context("מסומנות נקודות M, A, B, C. "+sentence)).reason,"ungrounded_ray",sentence);
  }
});

test("arrow tips extend beyond through-points in the correct direction and remain inside the viewBox",()=>{
  const p=plan();p.points.C=[-1,3];
  const card=Plan.render(documentStub(),p,context()),all=nodes(card);assert.ok(card);
  const circles=all.filter(n=>n.className==="noam-geometry-point"),points=Object.fromEntries(Object.keys(p.points).map((name,i)=>[name,[Number(circles[i].attributes.cx),Number(circles[i].attributes.cy)]]));
  for(const ray of all.filter(n=>n.className==="noam-geometry-ray")){
    const [from,to]=ray.attributes["data-ray"].split(""),a=points[from],b=points[to],tip=[Number(ray.attributes.x2),Number(ray.attributes.y2)];
    const extension=[tip[0]-b[0],tip[1]-b[1]],direction=[b[0]-a[0],b[1]-a[1]];
    assert.ok(extension[0]*direction[0]+extension[1]*direction[1]>0);
    assert.ok(Math.abs(extension[0]*direction[1]-extension[1]*direction[0])<1e-8);
    assert.ok(Math.abs(Math.hypot(...extension)-17)<1e-8);
    assert.ok(tip[0]>3&&tip[0]<317&&tip[1]>3&&tip[1]<221);
  }
  const labels=all.filter(n=>n.className==="noam-geometry-label");
  for(const label of labels){assert.ok(+label.attributes.x>3&&+label.attributes.x<317);assert.ok(+label.attributes.y>3&&+label.attributes.y<221);}
  for(const arrow of all.filter(n=>n.className==="noam-geometry-ray-arrow")){
    const values=arrow.attributes.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const minX=Math.min(values[0],values[2],values[4]),maxX=Math.max(values[0],values[2],values[4]),minY=Math.min(values[1],values[3],values[5]),maxY=Math.max(values[1],values[3],values[5]);
    for(const label of labels){const x=+label.attributes.x,y=+label.attributes.y;assert.ok(x+9<minX-3||x-9>maxX+3||y+11<minY-3||y-11>maxY+3,"vertex label overlaps an arrowhead");}
  }
});

test("renderer rejects malformed rays instead of running arbitrary SVG or drawing unsupported topology",()=>{
  const s=Plan.inspect(plan(),context()).scene;
  for(const rays of [[["M","Z"]],[["M","M"]],[["A","C"]],[["M","A"],["M","A"]],[{from:"M",to:"A",svg:"<script>"}]]){
    assert.equal(Geometry.render(documentStub(),{...s,rays}),null);
  }
});

test("explicit acute/obtuse source classes constrain coordinates without adding numeric angle marks",()=>{
  for(const [phrase,obtuse] of [["הזווית AMC חדה.",false],["הזווית AMC היא קהה.",true],["∠AMC היא זווית חדה.",false],["נתונה הזווית הקהה AMC.",true],["זווית קהה AMC.",true],["Angle AMC is acute.",false],["Angle AMC is obtuse.",true],["An acute angle AMC is shown.",false]]){
    const p=plan();p.points.C=[obtuse?-1:1,3];const c=context("מסומנות הנקודות M, A, B, C. "+phrase);
    const passed=Plan.inspect(p,c);assert.equal(passed.ok,true,phrase);assert.deepEqual(passed.scene.angles,[]);
    p.points.C=[obtuse?1:-1,3];const failed=Plan.inspect(p,c);
    assert.equal(failed.reason,"source_coordinate_contradiction",phrase);
    assert.deepEqual(failed.constraint.points,["A","M","C"]);
    assert.equal(failed.constraint.expectedClass,obtuse?"obtuse":"acute");
  }
});

test("angle appearance and student/goal assertions never create an acute/obtuse fact",()=>{
  const p=plan();p.points.C=[-1,3];
  for(const phrase of ["האם הזווית AMC חדה?","הוכיחו כי הזווית AMC חדה.","לא נתון שהזווית AMC חדה.","Suppose angle AMC is acute.","Angle AMC is not acute.","An approximate sketch is shown."]){
    const c=context("מסומנות הנקודות M, A, B, C. "+phrase);c.studentMessage+=" הזווית AMC חדה.";
    assert.equal(Plan.inspect(p,c).ok,true,phrase);
  }
});
