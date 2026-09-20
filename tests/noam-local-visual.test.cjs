"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const LocalVisual = require("../noam-local-visual.js");

test("drawing requests are recognized in natural Hebrew", () => {
  for (const request of ["אתה יכול לצייר לי?", "אפשר שרטוט", "תמחיש לי בגרף", "לא הבנתי את הפרבולה"]) {
    assert.equal(LocalVisual.wantsDrawing(request), true, request);
  }
  assert.equal(LocalVisual.wantsDrawing("איך מתחילים?"), false);
});

test("visual confusion about an angle is recognized without requiring the word drawing", () => {
  for (const request of ["איזו זווית?", "קשה לי לזהות את הזווית", "איפה הזווית הזאת?", "תראה לי איפה"]){
    assert.equal(LocalVisual.wantsVisualSupport(request), true, request);
  }
  assert.equal(LocalVisual.wantsVisualSupport("איך פותרים משוואה?"), false);
});

test("a triangle and its named angles are recovered from the recent Hebrew conversation", () => {
  assert.deepEqual(
    LocalVisual.parseLabeledTriangle("במשולש \\(\\triangle EDB\\) הסתכל על \\(\\angle EBD\\) ועל \\(\\angle EDB\\)."),
    {type:"labeled-triangle",vertices:["E","D","B"],angles:["EBD","EDB"]}
  );
  assert.deepEqual(
    LocalVisual.parseLabeledTriangle("שרטט לי את משולש abc לבדו"),
    {type:"labeled-triangle",vertices:["A","B","C"],angles:[]}
  );
});

test("the grade 9 pilot parses the exact factored quadratic inequality", () => {
  assert.deepEqual(
    LocalVisual.parseFactoredQuadraticInequality("(x − 4)(x + 1) ≥ 0"),
    { type: "factored-quadratic-inequality", roots: [-1, 4], relation: "≥" }
  );
});

test("strict and inside inequalities retain their endpoint meaning", () => {
  assert.deepEqual(
    LocalVisual.parseFactoredQuadraticInequality("(x + 3)(x − 2) < 0"),
    { type: "factored-quadratic-inequality", roots: [-3, 2], relation: "<" }
  );
  assert.deepEqual(
    LocalVisual.parseFactoredQuadraticInequality("(x - 5) * (x - 1) <= 0"),
    { type: "factored-quadratic-inequality", roots: [1, 5], relation: "≤" }
  );
});

test("ambiguous or unsupported exercise text falls through to the existing AI", () => {
  assert.equal(LocalVisual.parseFactoredQuadraticInequality("x² − 5x + 6 ≤ 0"), null);
  assert.equal(LocalVisual.parseFactoredQuadraticInequality("(x+3)(x+1)<0 וגם (x-2)(x-4)>0"), null);
  assert.equal(LocalVisual.parseFactoredQuadraticInequality("(x − 4)(x − 4) ≥ 0"), null);
});

test("the visual answer teaches the graph connection without stating interval notation", () => {
  const spec = LocalVisual.parseFactoredQuadraticInequality("(x − 4)(x + 1) ≥ 0");
  const answer = LocalVisual.assistantText(spec);
  assert.match(answer, /פרבולה/);
  assert.match(answer, /ציר x/);
  assert.doesNotMatch(answer, /x\s*[≤≥<>]/);
});

test("the renderer source includes an explicit local didactic sequence and a student-language follow-up", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../noam-local-visual.js"), "utf8");
  assert.match(source, /מה עושים קודם\?/);
  assert.match(source, /מוצאים את נקודות האפס/);
  assert.match(source, /מסמנים את נקודות האפס/);
  assert.match(source, /בודקים באילו תחומים/);
  assert.match(source, /אם הסימן כולל שוויון/);
  assert.match(source, /לא הבנתי: למה מציירים כאן פרבולה/);
});
