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
});

test("question 4 first hint points to a proof criterion without claiming the goal",()=>{
  const response=guides.respond("G9-T15-E-Q04א",{helpKind:"hint",hintIndex:0});
  assert.match(response.text,/כדי להוכיח/);
  assert.match(response.text,/∠EBD/);
  assert.match(response.text,/∠EDB/);
  assert.doesNotMatch(response.text,/ED=EB.*נתון|מתקיים.*ED=EB/);
});

test("a request to enlarge the drawing selects the focused authoritative crop",()=>{
  const response=guides.respond("G9-T15-E-Q04א",{
    helpKind:"free_question",
    studentMessage:"השרטוט קטן, אפשר להגדיל?"
  });
  const focus=guides.get("G9-T15-E-Q04א").visualFocus;
  assert.equal(response.visual,"focus");
  assert.deepEqual(focus.crop,{x:.055,y:.015,w:.285,h:.68});
  assert.deepEqual(focus.angles.map(item=>item.label),["∠EDB","∠DBC"]);
});

test("part b keeps its angle calculations tied to part a and the parallels",()=>{
  const prompt=guides.prompt("G9-T15-E-Q04ב");
  const focus=guides.get("G9-T15-E-Q04ב").visualFocus;
  assert.match(prompt,/∠EDB = 35°/);
  assert.match(prompt,/∠ADE = ∠ACB = 50°/);
  assert.deepEqual(focus.angles.map(item=>item.label),["∠ADE","∠ACB"]);
  assert.equal(guides.respond("unknown",{helpKind:"hint",hintIndex:0}),null);
});
