"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../worksheet-viewer-noam.html"),"utf8");
const helpers=html.slice(html.indexOf("function noamGeometryContext(text){"),html.indexOf("function noamDidacticVisualSelection"));
const q24="במשולש שווה־השוקיים ABC שבו AB=AC. הנקודה E על המשך BA מעבר ל-A. הנקודה D בתוך הזווית EAC כך שמתקיים AD∥BC. הוכיחו כי AD חוצה את הזווית החיצונית EAC.";
const bad="האם שמת לב שהקרן AD חותכת את הישרים המקבילים BC ו-AE?";
const good="התבונן בזווית ∠EAD ובזווית ∠ABC. הישרים AD ו-BC מקבילים, והישר BE חותך אותם.";
function fixture(replies=[]){
  const calls=[];
  const ctx={SOLVER_MESSAGE_MAX:700,MATH_OUTPUT_INSTRUCTION:"",API:"/test",postJson:async(url,payload)=>{
    calls.push({url,payload});const reply=replies.shift();if(reply instanceof Error){throw reply;}return reply;
  }};
  vm.createContext(ctx);vm.runInContext(helpers,ctx);return {ctx,calls};
}

test("Q24 false transversal hint is rejected using its explicit parallel given",()=>{
  const {ctx}=fixture();
  for(const answer of [bad,"הקרן AD חותכת את הישרים המקבילים BC ו־AE.","הישר DA חותך את הישרים המקבילים CB ו-AE.","הקטע BC חותך את הישר AD.","הקרן \\(AD\\) חותכת את הישרים המקבילים \\(BC\\) ו-\\(AE\\)."]){
    const review=ctx.noamGeometryAnswerReview(answer,{transcription:q24},null);
    assert.equal(review.ok,false,answer);assert.match(review.reasons.join(" "),/AD∥BC/);
  }
  assert.equal(ctx.noamGeometryAnswerReview(bad,{transcription:q24.replace("AD∥BC","\\(\\mathrm{AD} \\parallel BC\\)")},null).ok,false);
});

test("bounded transversal review preserves correct, unknown, negative and hypothetical statements",()=>{
  const {ctx}=fixture();
  for(const answer of [good,"הישר BE חותך את הישרים המקבילים AD ו-BC.","AD אינו חותך את BC.","הקרן AD אינה חותכת את הישר BC.","לא נכון שהקרן AD חותכת את הישרים המקבילים BC ו-AE.","אם הקרן AD חותכת את הישרים המקבילים BC ו-AE, צריך לבדוק את הנתונים.","האם הקרן AD חותכת את הישר BC?","התלמיד טעה כשכתב שהקרן AD חותכת את הישרים המקבילים BC ו-AE.","הקרן AE חותכת את הישרים המקבילים BC ו-AD.","הישר XY חותך את הישר ZW."]){
    assert.equal(ctx.noamParallelTransversalIssue(answer,q24),null,answer);
  }
  for(const source of ["נתון משולש ABC.","הוכיחו AD∥BC.","האם AD∥BC?","AD∥BC?","לא נתון AD∥BC.","נניח AD∥BC.","אם AD∥BC אז חפשו זוויות."]){
    assert.equal(ctx.noamParallelTransversalIssue(bad,source),null,source);
  }
});

test("wrong transversal uses the existing single repair and returns the corrected hint",async()=>{
  const {ctx,calls}=fixture([{ok:true,answer:good}]);
  const payload={exerciseId:"G9-T15-E-Q24א",helpKind:"hint",hintIndex:0,studentMessage:"אפשר רמז?",imageAnalysis:{transcription:q24}};
  const result=await ctx.noamGuardGeometryResult({ok:true,answer:bad},payload,payload.imageAnalysis,"אפשר רמז?",null,"");
  assert.equal(result.answer,good);assert.equal(calls.length,1);
  assert.equal(calls[0].url,"/test/noamImageSolve");
  assert.match(calls[0].payload.studentMessage,/AD∥BC/);
  assert.equal(calls[0].payload.hintIndex,0);assert.equal(payload.studentMessage,"אפשר רמז?");
});

test("a repeated bad hint or failed repair is not returned as drawing context",async()=>{
  for(const reply of [{ok:true,answer:bad},new Error("offline")]){
    const {ctx,calls}=fixture([reply]);
    const result=await ctx.noamGuardGeometryResult({ok:true,answer:bad},{helpKind:"hint"},{transcription:q24},"אפשר רמז?",null,"");
    assert.equal(calls.length,1);assert.equal(result.geometryGuarded,true);
    assert.notEqual(result.answer,bad);assert.doesNotMatch(result.answer,/AD חותכת|BC ו-AE/);
  }
  const {ctx,calls}=fixture();
  const result=await ctx.noamGuardGeometryResult({ok:true,answer:good},{},{transcription:q24},"אפשר רמז?",null,"");
  assert.equal(result.answer,good);assert.equal(calls.length,0,"correct hints do not add a model call");
});
