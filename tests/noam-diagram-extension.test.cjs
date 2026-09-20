"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Plan=require("../noam-diagram-plan.js");

function fixture(claim="הנקודה E על המשך BA מעבר ל-A."){
  return {plan:{version:1,status:"ok",points:{A:[0,3],B:[-3,0],C:[3,0],D:[4,3],E:[1,4]},
    segments:[["A","B"],["B","C"],["C","A"],["A","E"],["A","D"]],
    angles:[{from:"D",vertex:"A",to:"C",label:"∠DAC"},{from:"A",vertex:"C",to:"B",label:"∠ACB"}]},
    context:{questionText:"נתון משולש ABC שבו AB=AC. AD∥BC. "+claim,
      hintText:"זהה את הזוויות המתחלפות בין AD ו-BC עם החותך AC.",
      studentMessage:"כן אתה יכול לסמן לי אותן כי אני לא בטוח שאני מבין"}};
}

test("source extension beyond a named endpoint accepts the exact Hebrew forms and dash spacing",()=>{
  for(const claim of [
    "הנקודה E על המשך BA מעבר ל-A.",
    "E נמצאת על המשך BA מעבר ל-A.",
    "E נמצא על המשך הצלע BA מעבר ל־A.",
    "הנקודה E נמצאת על המשך הקטע BA מעבר ל A.",
    "הנקודה E על המשך BA מעבר לA.",
    "E על המשך הצלע BA מעבר ל - A.",
    "E על המשך AB מעבר ל-A."
  ]){
    const {plan,context}=fixture(claim),before=JSON.stringify(plan),result=Plan.inspect(plan,context);
    assert.equal(result.ok,true,claim+": "+result.reason);assert.equal(JSON.stringify(plan),before);
  }
});

test("the actual wrong-side extension is rejected with bounded machine-readable geometry",()=>{
  const {plan,context}=fixture();plan.points.E=[-1,4];
  const result=Plan.inspect(plan,context);
  assert.equal(result.reason,"source_coordinate_contradiction");
  assert.deepEqual(result.constraint,{type:"pointOnExtension",point:"E",ends:["B","A"],beyond:"A"});
  assert.equal(Plan.compile(plan,context),null);
});

test("being collinear is insufficient: the point must be past the stated endpoint",()=>{
  const {plan,context}=fixture();
  for(const point of [[-1.5,1.5],[-4,-1],[2,4]]){
    plan.points.E=point;
    assert.equal(Plan.inspect(plan,context).constraint.type,"pointOnExtension",JSON.stringify(point));
  }
  for(const point of [[0,3],[-3,0]]){
    plan.points.E=point;assert.equal(Plan.inspect(plan,context).reason,"coincident_points");
  }
  plan.points.E=[-4,-1];context.questionText=context.questionText.replace("מעבר ל-A","מעבר ל-B");
  assert.equal(Plan.inspect(plan,context).ok,true,"either named endpoint may be the extension direction");
});

test("extension validation works on renamed reflected and rotated diagrams",()=>{
  const {plan,context}=fixture(),rename={A:"K",B:"L",C:"M",D:"N",E:"P"};
  const renamed=JSON.parse(JSON.stringify(plan,(_key,value)=>typeof value==="string"?value.replace(/[ABCDE]/g,n=>rename[n]):value));
  renamed.points=Object.fromEntries(Object.entries(plan.points).map(([name,[x,y]])=>[rename[name],[-y+10,-x-5]]));
  const c=Object.fromEntries(Object.entries(context).map(([key,value])=>[key,value.replace(/[ABCDE]/g,n=>rename[n])]));
  assert.equal(Plan.inspect(renamed,c).ok,true);
  renamed.points.P=[6,-4];const result=Plan.inspect(renamed,c);
  assert.equal(result.reason,"source_coordinate_contradiction");
  assert.deepEqual(result.constraint,{type:"pointOnExtension",point:"P",ends:["L","K"],beyond:"K"});
});

test("goals, hypotheses, negations and student claims cannot establish a source extension",()=>{
  for(const claim of [
    "הוכיחו כי E על המשך BA מעבר ל-A.",
    "האם E על המשך BA מעבר ל-A?",
    "אם E על המשך BA מעבר ל-A, הסבירו מדוע.",
    "נניח כי E על המשך BA מעבר ל-A.",
    "לא נתון כי E על המשך BA מעבר ל-A."
  ]){
    const {plan,context}=fixture("מסומנת נקודה E. "+claim);plan.points.E=[-1,4];
    assert.equal(Plan.inspect(plan,context).ok,true,claim);
  }
  const {plan,context}=fixture("מסומנת נקודה E.");plan.points.E=[-1,4];
  context.studentMessage="אני חושב ש-E על המשך BA מעבר ל-A.";
  assert.equal(Plan.inspect(plan,context).ok,true);
});

test("a missing point, unspecified direction or unrelated beyond-point is not promoted into an extension constraint",()=>{
  for(const claim of ["E על המשך BA.","E על המשך BA מעבר ל-C.","E על המשך BZ מעבר ל-Z.","E על המשך AA מעבר ל-A."]){
    const {plan,context}=fixture(claim);plan.points.E=[-1,4];
    assert.equal(Plan.inspect(plan,context).ok,true,claim);
  }
});
