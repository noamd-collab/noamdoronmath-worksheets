"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Plan=require("../noam-diagram-plan.js");

function clone(value){return JSON.parse(JSON.stringify(value));}
function basic(){return {version:1,status:"ok",points:{A:[0,0],B:[4,0],C:[0,3]},segments:[["A","B"],["B","C"],["C","A"]],highlights:[{from:"A",to:"B",color:"blue",label:"AB"}],angles:[],equalGroups:[],rightAngles:[],evidence:[]};}
function context(extra){return Object.assign({questionText:"נתון משולש ABC.",hintText:"הסתכלו על הקטע AB.",studentMessage:""},extra);}
function documentStub(){function create(name){return {name,attributes:{},children:[],className:"",textContent:"",appendChild(node){this.children.push(node);return node;},setAttribute(key,value){this.attributes[key]=String(value);if(key==="class"){this.className=String(value);}}};}return {createElement:create,createElementNS(_ns,name){return create(name);}};}
function nodes(node){return node?[node].concat((node.children||[]).flatMap(nodes)):[];}

test("an unseen triangle compiles and renders a focused SVG without a question ID",()=>{
  const p=basic(),copy=clone(p),result=Plan.inspect(p,context());
  assert.equal(result.ok,true,result.reason);assert.equal(result.reason,null);assert.equal(result.scene.type,"geometry-scene");assert.deepEqual(p,copy,"compilation never mutates the wire plan");
  const rendered=Plan.render(documentStub(),p,context()),all=nodes(rendered);
  assert.ok(all.some(n=>n.name==="svg"));assert.equal(all.filter(n=>n.className==="noam-geometry-highlight").length,1);assert.equal(all.some(n=>n.name==="img"),false);
  assert.deepEqual(result.scene.equations,[]);assert.equal(result.scene.title,"המחשה לשלב הנוכחי");
});

test("new parallelogram point names and a student-specific edge need no per-question guide",()=>{
  const p={version:1,status:"ok",points:{K:[0,0],L:[6,0],M:[8,3],N:[2,3]},segments:[["K","L"],["L","M"],["M","N"],["N","K"]],highlights:[{from:"K",to:"L",color:"teal",label:"KL"}]};
  const c={questionText:"נתונה מקבילית KLMN.",hintText:"התבוננו בקטעים LM ו־NK.",studentMessage:"סמן לי את KL"};
  assert.equal(Plan.inspect(p,c).ok,true);
  c.studentMessage="";assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
});

test("named angle arcs identify the right vertex without asserting equality or degrees",()=>{
  const p=basic();p.highlights=[];p.angles=[{from:"B",vertex:"A",to:"C",label:"∠CAB"}];
  const c=context({hintText:"הסתכלו על הזווית BAC."});
  assert.equal(Plan.inspect(p,c).ok,true);assert.ok(Plan.render(documentStub(),p,c));
  p.angles[0].label="∠ABC";assert.equal(Plan.inspect(p,c).reason,"invalid_angle_label");
});

test("the live opposite-side hint locates B without revealing the opposite side",()=>{
  const p=basic();p.highlights=[];p.pointHighlights=[{point:"B",color:"blue"}];
  const c=context({hintText:"האם אתה יודע איזו צלע נמצאת מול הקודקוד \\(B\\)?"});
  const result=Plan.inspect(p,c);assert.equal(result.ok,true,result.reason);
  const rendered=Plan.render(documentStub(),p,c),all=nodes(rendered);
  assert.ok(rendered);
  const marked=all.filter(n=>n.className==="noam-geometry-point-highlight");
  assert.equal(marked.length,1);assert.equal(marked[0].attributes["data-point"],"B");
  assert.equal(all.some(n=>n.className==="noam-geometry-highlight"||n.className==="noam-geometry-angle"),false);
  p.highlights=[{from:"A",to:"C"}];assert.equal(Plan.inspect(p,c).reason,"outside_current_focus","AC is the answer, not an authorized mark");
  p.highlights=[{from:"B",to:"A"}];assert.equal(Plan.inspect(p,c).reason,"outside_current_focus","naming a vertex alone does not choose a ray");
  p.highlights=[];p.angles=[{from:"A",vertex:"B",to:"C",label:"∠ABC"}];assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
});

test("an explicit drawing request for one point overrides the previous segment focus",()=>{
  const p=basic();p.highlights=[];p.pointHighlights=[{point:"B",color:"teal"}];
  const c=context({hintText:"הסתכלו על הקטע AC.",studentMessage:"הראה לי את הקודקוד B"});
  assert.equal(Plan.inspect(p,c).ok,true);
  p.pointHighlights[0].point="A";assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
  p.pointHighlights[0].point="B";c.studentMessage="אני חושב שהנקודה B";
  assert.equal(Plan.inspect(p,c).reason,"outside_current_focus","a student's assertion is not a drawing focus override");
});

test("point highlights remain bounded and cannot invent points or prove an equality",()=>{
  const p=basic();p.highlights=[];p.pointHighlights=[{point:"B",color:"blue"}];
  const c=context({hintText:"התבונן בקודקוד B."});
  for(const mark of [{point:"Z"},{point:"BC"},{point:"B",label:"90°"},{point:"B",color:"url(fake)"}]){
    p.pointHighlights=[mark];assert.equal(Plan.inspect(p,c).ok,false);
  }
  p.pointHighlights=[{point:"B"},{point:"B"}];assert.equal(Plan.inspect(p,c).reason,"invalid_point_highlight");
  p.pointHighlights=Array.from({length:9},()=>({point:"B"}));assert.equal(Plan.inspect(p,c).reason,"invalid_list");
  p.pointHighlights=[{point:"B"}];p.equalGroups=[{segments:[["A","B"],["A","C"]],count:1}];
  assert.equal(Plan.inspect(p,c).reason,"outside_current_focus");
  p.equalGroups=[];c.hintText="התבוננו במשולש ABC.";
  assert.equal(Plan.inspect(p,c).reason,"outside_current_focus","a polygon token alone does not select one vertex");
  p.points.D=[2,2];c.questionText="נתון משולש ABC. מסומנת גם נקודה D.";c.hintText="התבוננו בנקודה D.";
  p.pointHighlights=[{point:"D"}];assert.equal(Plan.inspect(p,c).reason,"undrawn_mark");
});

test("given equality requires a positive quote, exact operands, and compatible coordinates",()=>{
  const p=basic();p.points={A:[0,3],B:[-4,0],C:[4,0]};p.highlights=[];p.equalGroups=[{segments:[["A","B"],["A","C"]],count:1,color:"blue"}];
  p.evidence=[{mark:"equalGroups.0",source:"question",quote:"AB = AC"}];
  const c=context({questionText:"נתון משולש ABC. נתון AB = AC.",hintText:"הסתכלו על AB ועל AC."});
  assert.equal(Plan.inspect(p,c).ok,true);assert.ok(Plan.render(documentStub(),p,c));
  p.points.C=[5,0];assert.equal(Plan.inspect(p,c).reason,"coordinate_contradiction");
  p.points.C=[4,0];p.evidence[0].quote="AB = AC + 1";c.questionText="נתון משולש ABC. נתון AB = AC + 1.";assert.equal(Plan.inspect(p,c).reason,"ungrounded_mark");
});

test("a goal, question, conditional, negation, or unaccepted student assertion never proves a mark",()=>{
  const p=basic();p.points={A:[0,3],B:[-4,0],C:[4,0]};p.equalGroups=[{segments:[["A","B"],["A","C"]],count:1}];p.evidence=[{mark:"equalGroups.0",source:"question",quote:"AB=AC"}];
  for(const statement of ["הוכיחו AB=AC.","האם AB=AC?","AB=AC?","נניח AB=AC.","אם AB=AC אז המשולש שווה שוקיים.","לא נתון AB=AC.","ייתכן AB=AC.","הוכיחו כי\nAB=AC."]){
    const result=Plan.inspect(p,context({questionText:"נתון משולש ABC. "+statement,hintText:"הסתכלו על AB ו־AC."}));assert.equal(result.ok,false,statement);assert.equal(result.reason,"unproven_evidence",statement);
  }
  p.evidence[0].source="hint";
  assert.equal(Plan.inspect(p,context({hintText:"הסתכלו על AB ו־AC.",studentMessage:"אני חושב AB=AC"})).reason,"unproven_evidence");
});

test("an established fact in the current hint may be marked; invented history cannot",()=>{
  const p=basic();p.points={A:[0,3],B:[-4,0],C:[4,0]};p.highlights=[];p.equalGroups=[{segments:[["A","B"],["A","C"]],count:1}];p.evidence=[{mark:"equalGroups.0",source:"hint",quote:"לכן AB=AC"}];
  const c=context({hintText:"לכן AB=AC."});assert.equal(Plan.inspect(p,c).ok,true);
  c.hintText="הסתכלו על AB ו־AC.";assert.equal(Plan.inspect(p,c).reason,"unproven_evidence");
});

test("right angle requires an exact given perpendicular pair or given 90-degree angle",()=>{
  const p=basic();p.highlights=[];p.rightAngles=[["B","A","C"]];p.evidence=[{mark:"rightAngles.0",source:"question",quote:"AB⊥AC"}];
  const c=context({questionText:"נתון משולש ABC. נתון AB⊥AC.",hintText:"הסתכלו על הזווית BAC."});
  assert.equal(Plan.inspect(p,c).ok,true);assert.ok(Plan.render(documentStub(),p,c));
  p.points.C=[1,3];assert.equal(Plan.inspect(p,c).reason,"coordinate_contradiction");p.points.C=[0,3];
  p.evidence[0].quote="∠BAC=90°";c.questionText="נתון משולש ABC. ∠BAC=90°.";assert.equal(Plan.inspect(p,c).ok,true);
  p.evidence[0].quote="BC⊥AC";c.questionText="נתון משולש ABC. BC⊥AC.";assert.equal(Plan.inspect(p,c).reason,"ungrounded_mark");
});

test("numeric labels need affirmative source evidence and actual geometric agreement",()=>{
  const p=basic();p.highlights[0].label="4";p.evidence=[{mark:"highlights.0",source:"question",quote:"AB=4"}];
  const c=context({questionText:"נתון משולש ABC. נתון AB=4."});assert.equal(Plan.inspect(p,c).ok,true);
  p.highlights[0].label="3";assert.equal(Plan.inspect(p,c).reason,"ungrounded_mark");
  p.highlights=[];p.evidence=[{mark:"angles.0",source:"question",quote:"∠BAC=90°"}];p.angles=[{from:"B",vertex:"A",to:"C",label:"90°"}];c.questionText="נתון משולש ABC. נתון ∠BAC=90°.";c.hintText="הזווית BAC מסומנת.";assert.equal(Plan.inspect(p,c).ok,true);
  p.angles[0].label="89°";assert.equal(Plan.inspect(p,c).reason,"ungrounded_mark");
});

test("visible outlines must also agree with recognized givens, even without fact marks",()=>{
  const p=basic();p.points.C=[1,3];
  assert.equal(Plan.inspect(p,context({questionText:"נתון משולש ABC. AB⊥AC."})).reason,"source_coordinate_contradiction");
  assert.equal(Plan.inspect(p,context({questionText:"נתון משולש ABC. ∠BAC=90°."})).reason,"source_coordinate_contradiction");
  p.points.C=[0,3];assert.equal(Plan.inspect(p,context({questionText:"נתון משולש ABC. AB=AC."})).reason,"source_coordinate_contradiction");
  const q={version:1,status:"ok",points:{A:[0,0],B:[5,0],C:[6,3],D:[1,3]},segments:[["A","B"],["B","C"],["C","D"],["D","A"]],highlights:[{from:"A",to:"B"}]};
  assert.equal(Plan.inspect(q,context({questionText:"נתון מלבן ABCD."})).reason,"source_coordinate_contradiction");
  assert.equal(Plan.inspect(q,context({questionText:"נתונה מקבילית ABCD."})).ok,true);
});

test("source angle rejection identifies the exact vertex and bounded expected and actual degrees",()=>{
  const p={version:1,status:"ok",points:{A:[0,0],B:[6,0],C:[6,4],D:[0,4],O:[3,2]},segments:[["A","B"],["B","C"],["C","D"],["D","A"],["A","C"],["B","D"]],highlights:[{from:"A",to:"C"},{from:"B",to:"D"}]};
  const c=context({questionText:"במלבן ABCD האלכסונים נפגשים בנקודה O. מידע פרטי שלא צריך להופיע באבחון. נתון ∠AOB=48°.",hintText:"הדגש את AC ואת BD."});
  const result=Plan.inspect(p,c);
  assert.equal(result.ok,false);assert.equal(result.scene,null);assert.equal(result.reason,"source_coordinate_contradiction");
  assert.deepEqual(result.constraint,{type:"angle",points:["A","O","B"],expectedDegrees:48,actualDegrees:112.619865});
  assert.equal(JSON.stringify(result.constraint).includes("פרטי"),false);
  c.questionText="במלבן ABCD האלכסונים נפגשים בנקודה O. נתון ∠AOB=112.619865°.";
  assert.equal(Plan.inspect(p,c).ok,true);assert.equal(Object.hasOwn(Plan.inspect(p,c),"constraint"),false);
  c.questionText="במלבן ABCD. נתון ∠AOB="+"9".repeat(400)+"°.";
  const huge=Plan.inspect(p,c);assert.equal(huge.reason,"source_coordinate_contradiction");
  assert.deepEqual(huge.constraint,{type:"angle",points:["A","O","B"],actualDegrees:112.619865});
});

test("source relation rejection reports only named segments and the recognized relation",()=>{
  const p=basic();p.points.C=[1,3];
  for(const relation of ["⊥","∥","="]){
    const result=Plan.inspect(p,context({questionText:"נתון משולש ABC. נתון AB"+relation+"AC."}));
    assert.equal(result.reason,"source_coordinate_contradiction");
    assert.deepEqual(result.constraint,{type:"relation",first:["A","B"],second:["A","C"],relation});
  }
});

test("source shape and point-incidence diagnostics do not weaken geometric gates",()=>{
  const p={version:1,status:"ok",points:{A:[0,0],B:[5,0],C:[6,3],D:[1,3]},segments:[["A","B"],["B","C"],["C","D"],["D","A"]],highlights:[{from:"A",to:"B"}]};
  let result=Plan.inspect(p,context({questionText:"נתון מלבן ABCD."}));
  assert.equal(result.reason,"source_coordinate_contradiction");
  assert.deepEqual(result.constraint,{type:"shape",shape:"מלבן",points:["A","B","C","D"],required:"adjacentSidesPerpendicular"});
  p.points.C=[7,3];result=Plan.inspect(p,context({questionText:"נתון מלבן ABCD."}));
  assert.equal(result.constraint.required,"oppositeSidesParallel");
  const q=basic();q.points.D=[2,1];q.segments.push(["A","D"]);
  for(const [word,extent] of [["הקטע","segment"],["הישר","line"]]){
    result=Plan.inspect(q,context({questionText:"נתון משולש ABC. D נמצאת על "+word+" AB."}));
    assert.equal(result.reason,"source_coordinate_contradiction");
    assert.deepEqual(result.constraint,{type:"pointOn",point:"D",ends:["A","B"],extent});
  }
  q.highlights=[{from:"B",to:"C"}];result=Plan.inspect(q,context());
  assert.equal(result.reason,"unknown_point");assert.equal(Object.hasOwn(result,"constraint"),false);
});

test("out-of-focus marks and unmentioned points cannot reveal the next proof step",()=>{
  const p=basic();p.highlights=[{from:"B",to:"C"}];assert.equal(Plan.inspect(p,context()).reason,"outside_current_focus");
  p.highlights=[{from:"A",to:"B"}];p.points.D=[2,2];assert.equal(Plan.inspect(p,context({studentMessage:"הוסף D"})).reason,"unknown_point");
  delete p.points.D;p.angles=[{from:"A",vertex:"B",to:"C",label:"∠ABC"}];assert.equal(Plan.inspect(p,context()).reason,"outside_current_focus");
});

test("a highlighted subsegment must lie on an actual drawn segment",()=>{
  const p=basic();p.points.D=[2,0];p.highlights=[{from:"A",to:"D",label:"AD"}];
  const c=context({questionText:"נתון משולש ABC. D נמצאת על AB.",hintText:"הסתכלו על AD."});
  assert.equal(Plan.inspect(p,c).ok,true);p.points.D=[2,1];assert.equal(Plan.inspect(p,c).reason,"undrawn_mark");
  p.segments.push(["A","D"]);assert.equal(Plan.inspect(p,c).reason,"source_coordinate_contradiction","adding a line cannot contradict the given point on AB");
});

test("malformed, executable, oversized, unknown, and unbounded data fail closed",()=>{
  const cases=[
    p=>p.points.A=[NaN,0],p=>p.points.A=[Infinity,0],p=>p.points.A=["0",0],p=>p.points.A=[10001,0],p=>p.points.A=new Array(2),
    p=>p.points.A=p.points.B,p=>p.segments.push(["A","Z"]),p=>p.segments.push(["B","A"]),
    p=>p.highlights[0].color="url(javascript:alert(1))",p=>p.highlights[0].label="<svg>",
    p=>p.caption="לכן התשובה היא 7",p=>p.equations=["x=7"],p=>p.svg="<svg/>",p=>p.points.A=()=>0,
    p=>p.segments=Array.from({length:41},()=>["A","B"]),p=>p.highlights=[],p=>p.version=2,
    p=>Object.defineProperty(p.points,"A",{enumerable:true,get(){throw new Error("getter must not run");}})
  ];
  for(const mutate of cases){const p=basic();mutate(p);assert.equal(Plan.inspect(p,context()).ok,false);assert.equal(Plan.compile(p,context()),null);}
  const injected=JSON.parse('{"version":1,"status":"ok","__proto__":{"polluted":true}}');assert.equal(Plan.inspect(injected,context()).reason,"unsafe_data");assert.equal({}.polluted,undefined);
  assert.equal(Plan.inspect({version:1,status:"unsupported"},context()).reason,"unsupported");assert.equal(Plan.render(documentStub(),null,context()),null);
});

test("evidence cannot be forged through extra fields, wrong source, duplication, or unused marks",()=>{
  const p=basic();const c=context({questionText:"נתון משולש ABC. AB=4."});
  for(const evidence of [
    [{mark:"highlights.0",source:"student",quote:"AB=4"}],
    [{mark:"highlights.0",source:"question",quote:"AB=4",verified:true}],
    [{mark:"highlights.0",source:"question",quote:"AB=4"},{mark:"highlights.0",source:"question",quote:"AB=4"}],
    [{mark:"highlights.9",source:"question",quote:"AB=4"}]
  ]){p.evidence=evidence;assert.equal(Plan.inspect(p,c).ok,false);}
});

test("schema and compile are usable independently from the browser renderer",()=>{
  assert.match(Plan.PROMPT_SCHEMA,/status:'unsupported'/);assert.match(Plan.PROMPT_SCHEMA,/No title, caption/);assert.equal(Plan.render(null,basic(),context()),null);
});
