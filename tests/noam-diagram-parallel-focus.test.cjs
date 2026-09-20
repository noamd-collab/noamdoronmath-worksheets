"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Plan=require("../noam-diagram-plan.js");

function fixture(){return {
  plan:{version:1,status:"ok",points:{A:[0,3],B:[-3,0],C:[3,0],D:[4,3],E:[1,4]},
    segments:[["A","B"],["B","C"],["C","A"],["A","E"],["A","D"]],rays:[["A","D"]],
    angles:[{from:"D",vertex:"A",to:"C",label:""},{from:"C",vertex:"A",to:"D",label:""}],
    highlights:[{from:"A",to:"D",label:"AD",color:"teal"}],evidence:[],equalGroups:[],rightAngles:[]},
  context:{questionText:"במשולש שווה־השוקיים ABC שבו AB=AC. הנקודה E על המשך BA מעבר ל-A. נתונה הקרן AD כך שמתקיים AD∥BC. הוכיחו כי AD חוצה את הזווית החיצונית EAC.",
    hintText:"האם זיהית כיצד הקרן AD והצלע BC המקבילות לה יוצרות זוויות מתחלפות עם הישר החותך AC?",
    studentMessage:"כן אתה יכול לסמן לי אותן כי אני לא בטוח שאני מבין"}
};}
function copy(value){return JSON.parse(JSON.stringify(value));}
function angleKey(a){return a.vertex+":"+[a.from,a.to].sort().join("");}

test("the actual duplicate DAC/CAD plan receives the two requested alternate angles at distinct vertices",()=>{
  const {plan,context}=fixture(),before=copy(plan);
  assert.equal(Plan.inspect(plan,context).ok,true,"duplicate arcs are structurally valid but pedagogically insufficient");
  const normalized=Plan.normalizeParallelAngleFocus(plan,context);assert.ok(normalized);
  assert.deepEqual(normalized.angles,[{from:"D",vertex:"A",to:"C",label:"∠DAC"},{from:"A",vertex:"C",to:"B",label:"∠ACB"}]);
  const {angles,...unchanged}=normalized,{angles:oldAngles,...original}=before;
  assert.deepEqual(unchanged,original,"no source geometry or factual markings are changed");
  assert.deepEqual(plan,before,"model input remains untouched");
  assert.equal(Plan.inspect(normalized,context).ok,true);
  assert.equal(Plan.normalizeParallelAngleFocus(normalized,context),null,"complete pair needs no further normalization");
});

test("the helper also completes missing name-only arcs while retaining factual non-angle markings",()=>{
  for(const existing of [[],[{from:"D",vertex:"A",to:"C",label:"∠CAD"}]]){
    const {plan,context}=fixture();plan.angles=existing;
    plan.evidence=[{mark:"highlights.0",source:"question",quote:"AD∥BC"}];
    const normalized=Plan.normalizeParallelAngleFocus(plan,context);assert.ok(normalized);
    assert.deepEqual(normalized.evidence,plan.evidence);assert.deepEqual(normalized.highlights,plan.highlights);
    assert.equal(normalized.angles.length,2);
  }
  const {plan,context}=fixture();plan.angles=[];plan.highlights=[];
  assert.equal(Plan.inspect(plan,context).reason,"missing_focus");
  assert.ok(Plan.normalizeParallelAngleFocus(plan,context));
});

test("renamed, translated, rotated and reflected segments yield the same geometric construction",()=>{
  for(const transform of [(x,y)=>[x+17,y-8],(x,y)=>[-y,x],(x,y)=>[-x,y]]){
    const {plan,context}=fixture(),rename={A:"K",B:"L",C:"M",D:"N",E:"P"};
    const renamed=JSON.parse(JSON.stringify(plan,(_key,value)=>typeof value==="string"?value.replace(/[ABCDE]/g,n=>rename[n]):value));
    renamed.points=Object.fromEntries(Object.entries(renamed.points).map(([name,point])=>[rename[name],point]));
    Object.keys(renamed.points).forEach(n=>{renamed.points[n]=transform(...renamed.points[n]);});
    const c=Object.fromEntries(Object.entries(context).map(([key,value])=>[key,value.replace(/[ABCDE]/g,n=>rename[n])]));
    const normalized=Plan.normalizeParallelAngleFocus(renamed,c);assert.ok(normalized);
    assert.deepEqual(new Set(normalized.angles.map(angleKey)),new Set(["K:MN","M:KL"]));
  }
});

test("reversing segment names or the parallel statement does not change the angle pair",()=>{
  const {plan,context}=fixture();
  context.questionText=context.questionText.replace("AD∥BC","CB∥DA");
  context.hintText=context.hintText.replace(/AD/g,"DA").replace(/BC/g,"CB").replace(/AC/g,"CA");
  const normalized=Plan.normalizeParallelAngleFocus(plan,context);assert.ok(normalized);
  assert.deepEqual(new Set(normalized.angles.map(angleKey)),new Set(["A:CD","C:AB"]));
});

test("a named student focus, a different angle request, or ambiguous hint is never overridden",()=>{
  for(const student of ["סמן לי רק את DAC","הראה לי את A","אל תסמן לי אותן","תסביר לי בלי לסמן","תסביר לי במילים"]){
    const {plan,context}=fixture();context.studentMessage=student;
    assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,student);
  }
  for(const hint of [
    "סמן זוויות מתאימות בין AD ו-BC והחותך AC.",
    "סמן זוויות מתחלפות חיצוניות בין AD ו-BC והחותך AC.",
    "אל תסמן זוויות מתחלפות בין AD ו-BC והחותך AC.",
    "אין צורך לזהות זוויות מתחלפות בין AD ו-BC והחותך AC.",
    "זהה זוויות מתחלפות בין AD ו-BC והחותכים AC ו-AB.",
    "זהה זוויות מתחלפות בין AD ו-BC בעזרת AC.",
    "זהה זוויות מתחלפות בין AD ו-BC והחותך AC או החותך AB.",
    "זהה זוויות מתחלפות במשולש ABC בין AD ו-BC והחותך AC."
  ]){
    const {plan,context}=fixture();context.hintText=hint;
    assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,hint);
  }
});

test("singular, positional, restricted and lowercase student focus never expands to two angles",()=>{
  for(const student of [
    "סמן לי רק את dac","סמן לי רק את הזווית העליונה","סמן לי רק אחת מהן",
    "סמן לי את הראשונה","סמן לי את השנייה","סמן לי את התחתונה","סמן לי אותן בלבד",
    "סמן לי את הזווית","סמן לי את dac","סמן לי ∠dac","סמן לי את a",
    "show only one","mark the upper angle","show just the first","mark \\angle dac","show a"
  ]){
    const {plan,context}=fixture();context.studentMessage=student;
    assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,student);
  }
  const {plan,context}=fixture();context.studentMessage="show me them";
  assert.ok(Plan.normalizeParallelAngleFocus(plan,context),"ordinary English pronouns are not lower-case point names");
});

test("parallelism must be source-grounded and all three segments must already be drawn",()=>{
  for(const replacement of ["הוכיחו כי AD∥BC","האם AD∥BC?","לא נתון כי AD∥BC","נניח כי AD∥BC","AD⊥BC"]){
    const {plan,context}=fixture();context.questionText="מסומנות הנקודות A, B, C, D, E. נתונה הקרן AD. "+replacement+".";
    assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,replacement);
  }
  for(const missing of ["AD","BC","AC"]){
    const {plan,context}=fixture();plan.rays=[];
    plan.segments=plan.segments.filter(pair=>pair.slice().sort().join("")!==missing);
    assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,missing);
  }
});

test("same-side, contradictory or non-endpoint geometry cannot masquerade as alternate angles",()=>{
  const {plan,context}=fixture();plan.points.D=[-4,3];
  assert.equal(Plan.inspect(plan,context).ok,true,"parallel lines alone do not guarantee opposite-side angle rays");
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null);
  plan.points.D=[4,4];assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null);
  const detached=fixture();detached.context.hintText=detached.context.hintText.replace("חותך AC","חותך AE");
  assert.equal(Plan.normalizeParallelAngleFocus(detached.plan,detached.context),null);
});

test("numeric angle labels, angle evidence and invalid arcs are preserved by refusing repair",()=>{
  const {plan,context}=fixture();plan.evidence=[{mark:"angles.0",source:"question",quote:"AD∥BC"}];
  assert.equal(Plan.inspect(plan,context).ok,true);
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,"do not reassign evidence to another vertex");
  plan.evidence=[];plan.angles[0].label="45°";
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null);
  plan.angles=[{from:"D",vertex:"A",to:"C",label:"∠DAC = ∠ACB"}];
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null);
  plan.angles=[{from:"E",vertex:"A",to:"D",label:"∠DAC"}];
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null);
});

test("a broad request repairs unrelated name-only arcs using only the uniquely requested parallel pair",()=>{
  for(const label of ["","∠EAD","\\(\\angle EAD\\)"]){
    const {plan,context}=fixture();plan.angles=[{from:"E",vertex:"A",to:"D",label},{from:"D",vertex:"A",to:"C",label:"∠DAC"}];
    const before=copy(plan);
    assert.equal(Plan.inspect(plan,context).reason,"outside_current_focus");
    const normalized=Plan.normalizeParallelAngleFocus(plan,context);assert.ok(normalized);
    assert.deepEqual(new Set(normalized.angles.map(angleKey)),new Set(["A:CD","C:AB"]));
    assert.deepEqual({...normalized,angles:before.angles},before,"only the angle list may change");
    assert.deepEqual(plan,before);assert.equal(Plan.inspect(normalized,context).ok,true);
  }
});

test("angle-focus repair never suppresses an unrelated scope failure or a hidden malformed later arc",()=>{
  const {plan,context}=fixture();plan.angles=[{from:"E",vertex:"A",to:"D",label:"∠EAD"}];
  plan.highlights=[{from:"A",to:"E",label:"AE"}];
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,"an out-of-focus highlight remains out of scope");
  plan.highlights=[];
  for(const invalid of [
    {from:"D",vertex:"A",to:"C",label:"45°"},
    {from:"D",vertex:"A",to:"C",label:"∠ACB"},
    {from:"D",vertex:"A",to:"C",label:"",color:"blue"},
    {from:"Z",vertex:"A",to:"C",label:""},
    {from:"B",vertex:"A",to:"E",label:""},
    {from:"D",vertex:"A",to:"A",label:""}
  ]){
    plan.angles=[{from:"E",vertex:"A",to:"D",label:"∠EAD"},invalid];
    assert.equal(Plan.inspect(plan,context).reason,"outside_current_focus","first bad focus hides the later mark from initial inspection");
    assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,JSON.stringify(invalid));
  }
  plan.angles=[{from:"E",vertex:"A",to:"D",label:"∠EAD"}];plan.points.E=[-1,4];
  assert.equal(Plan.normalizeParallelAngleFocus(plan,context),null,"wrong extension coordinates remain invalid after arc replacement");
});
