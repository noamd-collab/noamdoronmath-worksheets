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

test("explicit directed ray declarations must match source direction and reject duplicates",()=>{
  const p=plan();p.rays=[["M","A"],["M","C"]];
  assert.equal(Plan.inspect(p,context()).ok,true);
  p.rays=[["A","M"]];assert.equal(Plan.inspect(p,context()).reason,"ungrounded_ray");
  p.rays=[["M","A"],["M","A"]];assert.equal(Plan.inspect(p,context()).reason,"duplicate_ray");
  p.rays=Array.from({length:17},()=>["M","A"]);assert.equal(Plan.inspect(p,context()).reason,"invalid_list");
});

test("grounded explicit rays supply omitted base segments without mutating the model plan",()=>{
  const p=plan();p.rays=[["M","A"],["M","C"]];p.segments=[["M","B"]];
  const before=JSON.stringify(p),result=Plan.inspect(p,context());
  assert.equal(result.ok,true,result.reason);
  assert.deepEqual(result.scene.segments,[["M","B"],["M","A"],["M","C"]]);
  assert.deepEqual(result.scene.rays,[["M","A"],["M","B"],["M","C"]]);
  assert.equal(JSON.stringify(p),before);
  assert.equal(nodes(Plan.render(documentStub(),p,context())).filter(n=>n.className==="noam-geometry-ray-arrow").length,3);
  p.segments.push(["A","M"]);
  const reversedSegment=Plan.inspect(p,context());
  assert.equal(reversedSegment.ok,true,reversedSegment.reason);
  assert.equal(reversedSegment.scene.segments.filter(s=>s.includes("A")&&s.includes("M")).length,1);
  assert.deepEqual(reversedSegment.scene.rays[0],["M","A"]);
  // A ray-only construction must not need one arbitrary duplicate segment.
  for(const value of [[],undefined]){
    if(value===undefined){delete p.segments;}else{p.segments=value;}
    const rayOnly=Plan.inspect(p,context());assert.equal(rayOnly.ok,true,rayOnly.reason);
    assert.deepEqual(rayOnly.scene.segments,[["M","A"],["M","C"]]);
  }
  p.rays=[];assert.equal(Plan.inspect(p,context()).reason,"missing_segments");
});

test("omitted ray bases do not weaken grounding, focus, endpoint or coordinate checks",()=>{
  const p=plan();p.rays=[["M","A"]];p.segments=[["M","B"],["M","C"]];
  const ungrounded=context("מסומנות הנקודות M, A, B, C והקטעים MA, MB ו-MC.");
  ungrounded.studentMessage="הדגם את הקרן MA ואת MC ואת M.";
  assert.equal(Plan.inspect(p,ungrounded).reason,"ungrounded_ray");
  assert.equal(Plan.inspect({...p,rays:[["A","M"]]},context()).reason,"ungrounded_ray");
  assert.equal(Plan.inspect({...p,rays:[["M","Z"]]},context()).reason,"invalid_segment");
  const c=context();c.studentMessage="סמן את MB ואת M.";
  assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
  assert.equal(Plan.inspect(p,context("מן הנקודה M יוצאות הקרניים MA, MB ו-MC. MA∥MC.")).reason,"source_coordinate_contradiction");
  const noRay={...p,rays:[]};
  assert.equal(Plan.inspect(noRay,context()).reason,"undrawn_mark");
});

test("explicit ray normalization cannot exceed the combined segment budget",()=>{
  const letters="ABCDEFGHIJ".split(""),points=Object.fromEntries(letters.map((n,i)=>[n,[i,i*i]])),segments=[];
  for(let i=0;i<letters.length;i++){for(let j=i+1;j<letters.length;j++){if(i!==0||j!==1){segments.push([letters[i],letters[j]]);}}}
  const p={version:1,status:"ok",points,segments:segments.slice(0,40),rays:[["A","B"]],pointHighlights:[{point:"A"}]};
  const c={questionText:"מסומנות הנקודות A, B, C, D, E, F, G, H, I, J. נתונה הקרן AB.",hintText:"סמן את הנקודה A."};
  assert.equal(Plan.inspect(p,c).reason,"invalid_list");
  p.segments.pop();
  const result=Plan.inspect(p,c);assert.equal(result.ok,true,result.reason);assert.equal(result.scene.segments.length,40);
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

test("source ray names expose only affirmative source declarations for a constrained prompt",()=>{
  const c=context("מסומנות הנקודות M, A, B, C. נתונה הקרן MA.");
  c.hintText="האם שמת לב כיצד הקרן MC יוצרת זווית עם MB?";
  c.studentMessage="סמן את הקרן MB.";
  assert.deepEqual(Plan.sourceRayNames(c),["MA"]);
  assert.deepEqual(Plan.sourceRayNames({questionText:"x".repeat(20001)}),[]);
});

test("optional ray-presentation repair drops only unsupported arrows from explicit existing segments",()=>{
  const p=plan();p.rays=[["M","A"],["M","C"]];
  const c=context("מסומנות הנקודות M, A, B, C והקטעים MA, MB ו-MC. נתונה הקרן MA.");
  const before=JSON.stringify(p);
  assert.equal(Plan.inspect(p,c).reason,"ungrounded_ray","strict validation remains unchanged");
  const normalized=Plan.normalizeRayPresentation(p,c);
  assert.ok(normalized);assert.deepEqual(normalized,{...p,rays:[["M","A"]]});
  assert.equal(JSON.stringify(p),before);
  assert.deepEqual(Plan.inspect(normalized,c).scene.rays,[["M","A"]]);
  assert.deepEqual(Plan.inspect(normalized,c).scene.segments,p.segments);
  const all=nodes(Plan.render(documentStub(),normalized,c));
  assert.equal(all.filter(n=>n.className==="noam-geometry-ray-arrow").length,1);
  assert.equal(Plan.normalizeRayPresentation(normalized,c),null,"already valid plans need no repair");
});

test("rhetorical hints can use a segment drawing without asserting an ungrounded ray",()=>{
  const p={version:1,status:"ok",points:{A:[0,3],B:[-3,0],C:[3,0],D:[4,3],E:[1,4]},
    segments:[["A","B"],["B","C"],["C","A"],["A","E"],["D","A"]],rays:[["A","D"]],
    angles:[{from:"D",vertex:"A",to:"C",label:"∠DAC"},{from:"A",vertex:"C",to:"B",label:"∠ACB"}]};
  const c={questionText:"במשולש שווה־השוקיים ABC שבו AB=AC. הנקודה E על המשך BA מעבר ל-A. הנקודה D בתוך הזווית EAC כך שמתקיים AD∥BC.",
    hintText:"האם שמת לב כיצד הקרן AD והצלע BC המקבילות לה יוצרות זוויות מתחלפות עם הישר החותך AC?",
    studentMessage:"כן אתה יכול לסמן לי אותן כי אני לא בטוח שאני מבין"};
  assert.equal(Plan.inspect(p,c).reason,"ungrounded_ray");
  const normalized=Plan.normalizeRayPresentation(p,c);assert.ok(normalized);
  assert.deepEqual(normalized,{...p,rays:[]});
  assert.deepEqual(Plan.inspect(normalized,c).scene.angles.map(a=>a.label),["∠DAC","∠ACB"]);
  assert.ok(Plan.render(documentStub(),normalized,c));
});

test("ray-presentation repair cannot add missing geometry or rescue malformed or duplicate rays",()=>{
  const c=context("מסומנות הנקודות M, A, B, C והקטעים MA, MB ו-MC.");
  const p=plan();p.rays=[["M","A"]];
  p.segments=p.segments.filter(s=>s[1]!=="A");
  assert.equal(Plan.normalizeRayPresentation(p,c),null,"missing ray base cannot be invented");
  p.segments=[["M","B"],["M","C"],["B","A"]];
  assert.equal(Plan.normalizeRayPresentation(p,c),null,"two connected segments are not the explicit requested base");
  p.segments=plan().segments;
  for(const rays of [[["M","A"],["M","A"]],[["M","A"],["M","Z"]],[["M","A"],["A","A"]],[["M","A"],{from:"M",to:"C"}]]){
    assert.equal(Plan.normalizeRayPresentation({...p,rays},c),null);
  }
});

test("ray-presentation repair revalidates focus, factual evidence and coordinates without altering them",()=>{
  const c=context("מסומנות הנקודות M, A, B, C והקטעים MA, MB ו-MC.");
  const base=plan();base.rays=[["M","A"]];
  const wrongFocus={...base,highlights:[{from:"A",to:"B"}]};
  assert.equal(Plan.normalizeRayPresentation(wrongFocus,c),null);
  const factual={...base,highlights:[{from:"M",to:"A",label:"4"}]};
  assert.equal(Plan.normalizeRayPresentation(factual,c),null,"an unsupported numeric value remains rejected");
  const contradiction={...c,questionText:c.questionText+" MA∥MC."};
  assert.equal(Plan.normalizeRayPresentation(base,contradiction),null);
  const angleContradiction={...base,angles:[{from:"A",vertex:"M",to:"C",label:"∠MAC"}]};
  assert.equal(Plan.normalizeRayPresentation(angleContradiction,c),null);
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
