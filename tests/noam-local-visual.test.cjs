"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const LocalVisual = require("../noam-local-visual.js");

function fakeDocument(){
  function element(name){
    return {
      name,children:[],attributes:{},style:{},className:"",textContent:"",hidden:false,listeners:{},
      appendChild(child){this.children.push(child);return child;},
      setAttribute(key,value){this.attributes[key]=String(value);if(key==="class"){this.className=String(value);}},
      addEventListener(type,listener){this.listeners[type]=listener;}
    };
  }
  return {createElement:element,createElementNS(_namespace,name){return element(name);}};
}

function descendants(node){
  return [node].concat((node.children||[]).flatMap(descendants));
}

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

test("an authoritative question focus accepts only bounded source-image geometry", () => {
  const focus = LocalVisual.normalizeQuestionFocus({
    label: "השרטוט המקורי — הזוויות והישרים המקבילים",
    crop: { x: .05, y: .01, w: .3, h: .7 },
    segments: [
      { from: [.12, .35], to: [.23, .35], role: "parallel" },
      { from: [.09, .63], to: [.31, .63], role: "parallel" },
      { from: [.23, .35], to: [.09, .63], role: "transversal" },
      { from: [.2, .2], to: [1.2, .2], role: "parallel" }
    ],
    angles: [
      { vertex: [.23, .35], from: [.12, .35], to: [.09, .63], label: "∠EDB" },
      { vertex: [.09, .63], from: [.23, .35], to: [.31, .63], label: "∠DBC" }
    ]
  });
  assert.equal(focus.segments.length, 3);
  assert.deepEqual(focus.segments.map(segment => segment.role), ["parallel", "parallel", "transversal"]);
  assert.deepEqual(focus.angles.map(angle => angle.label), ["∠EDB", "∠DBC"]);
  assert.match(LocalVisual.focusAngleGeometry(focus.angles[0], focus.crop).path, /^M[\d.]+ [\d.]+ Q[\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
});

test("invalid or out-of-bounds focus metadata falls back instead of cropping the worksheet", () => {
  assert.equal(LocalVisual.normalizeQuestionFocus({ crop: { x: .8, y: 0, w: .3, h: 1 } }), null);
  assert.equal(LocalVisual.normalizeQuestionFocus({ crop: { x: 0, y: 0, w: 0, h: 1 } }), null);
  assert.equal(LocalVisual.normalizeQuestionFocus({ crop: { x: "0", y: 0, w: .3, h: .7 } }), null);
  assert.equal(LocalVisual.normalizeQuestionFocus({ crop: { x: 0, y: 0, w: .01, h: .7 } }), null);
  assert.equal(LocalVisual.normalizeQuestionFocus({}), null);
});

test("focused question rendering enlarges the source crop and draws its validated overlay", () => {
  const documentRef=fakeDocument();
  const focus={
    label:"השרטוט המוגדל",crop:{x:.055,y:.015,w:.285,h:.68},
    segments:[
      {from:[.128,.36],to:[.228,.36],role:"parallel"},
      {from:[.095,.628],to:[.305,.628],role:"parallel"},
      {from:[.095,.628],to:[.228,.36],role:"transversal"}
    ],
    angles:[
      {vertex:[.228,.36],from:[.128,.36],to:[.095,.628],label:"∠EDB"},
      {vertex:[.095,.628],from:[.228,.36],to:[.305,.628],label:"∠DBC"}
    ]
  };
  const card=LocalVisual.render(documentRef,{type:"question-image",exerciseId:"q4",src:"question.png",focus});
  const nodes=descendants(card);
  const stage=nodes.find(node=>node.className==="noam-question-visual-stage");
  const image=nodes.find(node=>String(node.className).includes("noam-question-visual-focus-image"));
  const overlay=nodes.find(node=>node.className==="noam-question-visual-overlay");
  assert.ok(stage);
  assert.ok(overlay);
  assert.equal(nodes.filter(node=>String(node.className).includes("noam-question-focus-segment")).length,3);
  assert.equal(nodes.filter(node=>node.className==="noam-question-focus-angle").length,2);
  assert.equal(nodes.filter(node=>node.className==="noam-question-focus-label").length,2);
  assert.equal(image.attributes["data-exercise-id"],"q4");
  assert.match(image.alt,/∠EDB.*∠DBC/);
  assert.ok(parseFloat(image.style.width)>300);
  image.naturalWidth=1200;
  image.naturalHeight=415;
  image.listeners.load();
  const [focusWidth,focusHeight]=stage.style.aspectRatio.split(" / ").map(Number);
  assert.ok(Math.abs(focusWidth-342)<1e-9);
  assert.ok(Math.abs(focusHeight-282.2)<1e-9);
});

test("a focus overlay is never shown without its authoritative source image", () => {
  const documentRef=fakeDocument();
  const focus={
    crop:{x:.05,y:.01,w:.3,h:.7},
    segments:[{from:[.1,.2],to:[.2,.3],role:"parallel"}],
    angles:[]
  };
  const missing=LocalVisual.render(documentRef,{type:"question-image",exerciseId:"q4",focus});
  assert.equal(descendants(missing).some(node=>node.className==="noam-question-visual-overlay"),false);

  const card=LocalVisual.render(documentRef,{type:"question-image",exerciseId:"q4",src:"question.png",focus});
  const nodes=descendants(card);
  const image=nodes.find(node=>String(node.className).includes("noam-question-visual-focus-image"));
  const stage=nodes.find(node=>node.className==="noam-question-visual-stage");
  const note=nodes.find(node=>String(node.className).includes("noam-question-visual-note"));
  image.listeners.error();
  assert.equal(stage.hidden,true);
  assert.equal(note.hidden,true);
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

test("question-image focus keeps the worksheet image and overlays only validated guide data", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../noam-local-visual.js"), "utf8");
  assert.match(source, /noam-question-visual-focus-image/);
  assert.match(source, /noam-question-visual-overlay/);
  assert.match(source, /זהו השרטוט המקורי מתוך השאלה, בהגדלה/);
  assert.match(source, /normalizeQuestionFocus\(spec\.focus\)/);
});
