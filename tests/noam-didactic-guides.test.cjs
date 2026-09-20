"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const guides=require("../noam-didactic-guides.js");

test("question 4 proof guide never assumes the requested equality",()=>{
  const guide=guides.get("G9-T15-E-Q04א");
  assert.equal(guide.goal,"להוכיח ED = EB");
  assert.match(guide.forbidden.join(" "),/אסור להשתמש ב-ED = EB לפני סוף ההוכחה/);
  assert.match(guide.canonicalChain,/∠EBD = ∠ABD = ∠DBC = ∠EDB/);
  assert.match(guide.canonicalChain,/מכאן ED = EB/);
});

test("question 4 identifies the valid alternate interior angle pair",()=>{
  const response=guides.respond("G9-T15-E-Q04א",{
    helpKind:"free_question",
    studentMessage:"איזה זווית קשה לי לזהות"
  });
  assert.match(response.text,/∠EDB/);
  assert.match(response.text,/∠DBC/);
  assert.match(response.text,/DB.*חותך/);
  assert.doesNotMatch(response.text,/איזו זווית/);
  assert.equal(response.visual,"focus");
  assert.equal(response.focusKey,"q4a-alternate");
});

test("question 4 first hint points to a proof criterion without claiming the goal",()=>{
  const response=guides.respond("G9-T15-E-Q04א",{helpKind:"hint",hintIndex:0});
  assert.match(response.text,/כדי להוכיח/);
  assert.match(response.text,/∠EBD/);
  assert.match(response.text,/∠EDB/);
  assert.doesNotMatch(response.text,/ED=EB.*נתון|מתקיים.*ED=EB/);
  assert.equal(response.visual,"focus");
  assert.equal(response.focusKey,"q4a-base-angles");
});

test("a request to enlarge the drawing selects the focused authoritative crop",()=>{
  const response=guides.respond("G9-T15-E-Q04א",{
    helpKind:"free_question",
    studentMessage:"השרטוט קטן, אפשר להגדיל?"
  });
  const selected=guides.resolveVisual("G9-T15-E-Q04א",{key:response.focusKey});
  assert.equal(response.visual,"focus");
  assert.deepEqual(selected.focus.crop,{x:.055,y:.015,w:.285,h:.68});
  assert.deepEqual(selected.focus.angles.map(item=>item.label),["∠DBC","∠EDB"]);
});

test("part b keeps its angle calculations tied to part a and the parallels",()=>{
  const prompt=guides.prompt("G9-T15-E-Q04ב");
  const focus=guides.resolveVisual("G9-T15-E-Q04ב",{key:"q4b-parallel"}).focus;
  assert.match(prompt,/∠EDB = 35°/);
  assert.match(prompt,/∠ADE = ∠ACB = 50°/);
  assert.deepEqual(focus.angles.map(item=>item.label),["∠ADE","∠ACB"]);
  assert.equal(guides.respond("unknown",{helpKind:"hint",hintIndex:0}),null);
});

test("each Question 4 hint selects the verified diagram for that exact step",()=>{
  const proofKeys=["q4a-base-angles","q4a-bisector","q4a-alternate"];
  const calculationKeys=["q4b-bisector","q4b-isosceles","q4b-parallel"];
  proofKeys.forEach((key,index)=>{
    const response=guides.respond("G9-T15-E-Q04א",{helpKind:"hint",hintIndex:index});
    assert.equal(response.focusKey,key);
    assert.equal(guides.resolveVisual("G9-T15-E-Q04א",{key}).key,key);
  });
  calculationKeys.forEach((key,index)=>{
    const response=guides.respond("G9-T15-E-Q04ב",{helpKind:"hint",hintIndex:index});
    assert.equal(response.focusKey,key);
    assert.equal(guides.resolveVisual("G9-T15-E-Q04ב",{key}).key,key);
  });
});

test("a question naming one angle highlights only that angle",()=>{
  const selected=guides.resolveVisual("G9-T15-E-Q04א",{
    studentMessage:"איפה נמצאת הזווית ∠EDB?"
  });
  assert.equal(selected.key,"q4a-angle-edb");
  assert.deepEqual(selected.focus.angles.map(item=>item.label),["∠EDB"]);

  const fromAnswer=guides.resolveVisual("G9-T15-E-Q04ב",{
    answer:"עכשיו מצאו את זווית ADE."
  });
  assert.equal(fromAnswer.key,"q4b-angle-ade");
  assert.deepEqual(fromAnswer.focus.angles.map(item=>item.label),["∠ADE"]);

  const namedPair=guides.resolveVisual("G9-T15-E-Q04ב",{
    studentMessage:"איך רואים את ∠ADE ואת ∠ACB?"
  });
  assert.equal(namedPair.key,"q4b-parallel");
});

test("visual selection uses progress and rejects unverified focus keys",()=>{
  assert.equal(
    guides.resolveVisual("G9-T15-E-Q04א",{progress:1,studentMessage:"ואז מה?"}).key,
    "q4a-bisector"
  );
  const fallback=guides.resolveVisual("G9-T15-E-Q04א",{
    key:"chat-supplied-coordinates",
    studentMessage:"תגדיל את השרטוט"
  });
  assert.equal(fallback.key,"q4a-alternate");
  assert.equal(guides.resolveVisual("unknown",{key:"q4a-alternate"}),null);
});
