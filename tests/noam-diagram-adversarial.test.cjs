"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Plan=require("../noam-diagram-plan.js");

function triangle(){return {version:1,status:"ok",points:{K:[0,3],L:[-4,0],M:[4,0]},segments:[["K","L"],["L","M"],["M","K"]],pointHighlights:[{point:"L",color:"blue"}]};}
function context(extra){return Object.assign({questionText:"נתון משולש KLM.",hintText:"התבוננו בקודקוד L.",studentMessage:""},extra);}
function equality(){const p=triangle();delete p.pointHighlights;p.equalGroups=[{segments:[["K","L"],["K","M"]],count:1}];p.evidence=[{mark:"equalGroups.0",source:"question",quote:"KL=KM"}];return p;}

test("renamed reflected points identify the requested vertex without exposing its opposite side",()=>{
  const p=triangle();p.points={K:[0,-3],L:[4,0],M:[-4,0]};
  const c=context({hintText:"איזו צלע נמצאת מול הקודקוד L?"});
  const result=Plan.inspect(p,c);assert.equal(result.ok,true,result.reason);
  assert.deepEqual(result.scene.pointHighlights,[{point:"L",color:"blue"}]);
  assert.deepEqual(result.scene.highlights,[]);assert.deepEqual(result.scene.angles,[]);assert.deepEqual(result.scene.equations,[]);
  p.highlights=[{from:"K",to:"M"}];assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
});

test("a drawing attached to an earlier answer keeps its earlier student request after later proof progress",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../worksheet-viewer-noam.html"),"utf8");
  const source=html.slice(html.indexOf("function noamMessageVisualOptions(thread,message){"),html.indexOf("function noamConstructedVisual(exercise,options){"));
  assert.ok(source.length>500,"exercise the current viewer implementation");
  const c={};vm.createContext(c);vm.runInContext(source,c);
  const first={role:"assistant",text:"איזו צלע נמצאת מול הקודקוד L?"};
  const thread={hintIndex:3,messages:[{role:"user",text:"אפשר רמז 1?",kind:"רמז 1"},first,
    {role:"user",text:"הדגם את הצלע KM"},{role:"assistant",text:"כעת התבוננו בצלע KM."}]};
  const options=c.noamMessageVisualOptions(thread,first);
  assert.equal(options.answer,first.text);assert.equal(options.studentMessage,"אפשר רמז 1?");
  assert.equal(options.hintIndex,0);assert.equal(options.progress,1);
  const scoped=context({hintText:options.answer,studentMessage:options.studentMessage});
  const p=triangle();assert.equal(Plan.inspect(p,scoped).ok,true);
  p.highlights=[{from:"K",to:"M"}];assert.equal(Plan.inspect(p,scoped).reason,"outside_current_focus");
});

test("mirrored reverse angle names retain the middle vertex and do not authorize a different corner",()=>{
  const p=triangle();delete p.pointHighlights;p.points={K:[0,-3],L:[4,0],M:[-4,0]};
  p.angles=[{from:"M",vertex:"K",to:"L",label:"∠LKM"}];
  const c=context({hintText:"התבוננו בזווית LKM."});
  const result=Plan.inspect(p,c);assert.equal(result.ok,true,result.reason);assert.equal(result.scene.angles[0].vertex,"K");
  p.angles=[{from:"K",vertex:"L",to:"M",label:"∠KLM"}];
  assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
});

test("a two-triangle diagram may emphasize its given shared side but cannot add an unrequested proof relation",()=>{
  const p={version:1,status:"ok",points:{P:[0,0],Q:[5,0],R:[5,3],S:[0,3]},
    segments:[["P","Q"],["Q","R"],["R","P"],["R","S"],["S","P"]],
    highlights:[{from:"R",to:"P",label:"PR",color:"teal"}]};
  const c=context({questionText:"נתונים משולשים PQR ו־PRS.",hintText:"התבוננו בצלע המשותפת PR."});
  const result=Plan.inspect(p,c);assert.equal(result.ok,true,result.reason);assert.equal(result.scene.segments.length,5);
  p.equalGroups=[{segments:[["P","Q"],["R","S"]],count:1}];
  assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
});

test("an explicit student request to draw an equality selects segments but does not establish that equality",()=>{
  const p=equality(),c=context({hintText:"התבוננו בקודקוד L.",studentMessage:"הדגם בשרטוט KL=KM"});
  assert.equal(Plan.inspect(p,c).reason,"unproven_evidence");
  p.evidence[0].source="student";assert.equal(Plan.inspect(p,c).reason,"invalid_evidence");
  delete p.equalGroups;p.evidence=[];p.highlights=[{from:"K",to:"L"},{from:"K",to:"M"}];
  assert.equal(Plan.inspect(p,c).ok,true,"locating the requested segments is safe without equality ticks");
});

test("common singular Hebrew proof instructions and hypothetical givens cannot become equality evidence",()=>{
  const p=equality();
  for(const instruction of ["הוכח: KL=KM.","הוכח KL=KM.","בהנחה ש־KL=KM.","משערים KL=KM.","השערה: KL=KM."]){
    const result=Plan.inspect(p,context({questionText:"נתון משולש KLM. "+instruction,hintText:"התבוננו בקטעים KL ו־KM."}));
    assert.equal(result.ok,false,instruction);assert.equal(result.reason,"unproven_evidence",instruction);
  }
  assert.equal(Plan.inspect(p,context({questionText:"נתון משולש KLM. נתון KL=KM.",hintText:"התבוננו בקטעים KL ו־KM."})).ok,true);
});

test("alternative or hypothetical relations fail closed even when coordinates happen to satisfy both",()=>{
  const p=equality();p.points={K:[0,Math.sqrt(3)],L:[-1,0],M:[1,0]};
  for(const statement of ["נתון KL=KM או KL=LM.","KL=KM is hypothetical.","Either KL=KM or KL=LM."]){
    const result=Plan.inspect(p,context({questionText:"נתון משולש KLM. "+statement,hintText:"התבוננו בקטעים KL ו־KM."}));
    assert.equal(result.ok,false,statement);assert.equal(result.reason,"unproven_evidence",statement);
  }
});

test("contradictory independently given relations cannot be hidden by an otherwise valid point-only focus",()=>{
  const p=triangle();
  const c=context({questionText:"נתון משולש KLM. KL∥KM. KL⊥KM.",hintText:"התבוננו בקודקוד L."});
  const result=Plan.inspect(p,c);assert.equal(result.ok,false);assert.equal(result.reason,"source_coordinate_contradiction");
  assert.equal(result.scene,null);
});

test("foreign narrative, bidirectional label tricks, and markup cannot enter rendered marks",()=>{
  for(const label of ["therefore x=7","<img src=x onerror=alert(1)>","KM\u202eLK","הוכחנו שוויון"]){
    const p=triangle();delete p.pointHighlights;p.highlights=[{from:"K",to:"L",label}];
    const result=Plan.inspect(p,context({hintText:"התבוננו בקטע KL."}));
    assert.equal(result.ok,false,label);assert.equal(result.scene,null,label);
  }
  const p=triangle();p.pointHighlights[0].label="<svg>";
  assert.equal(Plan.inspect(p,context()).reason,"unknown_field");
});
