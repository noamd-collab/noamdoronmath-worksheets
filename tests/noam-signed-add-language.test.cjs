"use strict";
/**
 * S10 P2: different-sign addition hints must name absolute values.
 * Focused rewrite — not a blanket גדול/קטן replacement; not a local guide.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const glossary = require("../noam-glossary.js");

const html = fs.readFileSync(
  path.join(__dirname, "../worksheet-viewer-noam.html"),
  "utf8"
);
const askSource = html.slice(
  html.indexOf("function noamGeometryContext(text){"),
  html.indexOf("function postJson(endpoint,payload){")
);

function loadViewerFns() {
  const ctx = {
    window: { NoamLocalVisual: {} },
    SOLVER_MESSAGE_MAX: 700,
    MATH_OUTPUT_INSTRUCTION: "",
    Set,
    Math,
    String,
    Number,
    Array,
    Object,
    RegExp,
    Promise
  };
  vm.createContext(ctx);
  vm.runInContext(askSource, ctx);
  return ctx;
}

test("S10 ambiguous different-sign rule is clarified to absolute values", () => {
  const ctx = loadViewerFns();
  const ambiguous =
    "כדי לחבר את המספרים, השתמש בכלל החיבור של מספרים בעלי סימנים שונים: חסר את הערך הקטן מהגדול ושמור על הסימן של הגדול.";
  const clarified = ctx.noamClarifySignedAddLanguage(ambiguous);
  assert.match(clarified, /ערך המוחלט הקטן מהגדול/);
  assert.match(clarified, /הסימן של המספר בעל הערך המוחלט הגדול/);
  assert.doesNotMatch(clarified, /חסר את הערך הקטן מהגדול/);
  assert.doesNotMatch(clarified, /שמור על הסימן של הגדול(?:\s|\.|$)/);
  // Must not reveal the numeric result of −7+4.
  assert.doesNotMatch(clarified, /(?:^|[^\d−\-])\-?3(?:[^\d]|$)/);
});

test("already-correct absolute-value wording is left alone", () => {
  const ctx = loadViewerFns();
  const good =
    "מחסרים את הערך המוחלט הקטן מהגדול ולוקחים את הסימן של המספר בעל הערך המוחלט הגדול.";
  assert.equal(ctx.noamClarifySignedAddLanguage(good), good);
});

test("גדול/קטן outside signed-add rule language is not rewritten", () => {
  const ctx = loadViewerFns();
  const other = "במשולש, הצלע הגדולה נמצאת מול הזווית הגדולה, והקטן מול הקטנה.";
  assert.equal(ctx.noamClarifySignedAddLanguage(other), other);
});

test("signed-number solver guard mentions absolute values when analysis shows signed add", () => {
  const ctx = loadViewerFns();
  const message = ctx.noamSolverMessage(
    "תן לי רמז אחד בלבד. אל תגלה את התשובה הסופית, ואל תבצע את הצעד במקומי.",
    { history: [] },
    "אבחון קדם־ידע",
    "",
    { transcription: "חשבו: −7 + 4", readable: true }
  );
  assert.match(message, /ערכים מוחלטים/);
  assert.match(message, /הערך המוחלט הגדול/);
  assert.doesNotMatch(message, /זוויות מתחלפות עם זוויות מתאימות/);
});

test("S02 alternate-angle guide keeps מתחלפות for DE∥BC (not swapped to מתאימות)", () => {
  const guides = require("../noam-didactic-guides.js");
  const guide = guides.get("G9-T15-E-Q04א");
  assert.match(guide.angleHelp, /מתחלפות פנימיות/);
  assert.match(guide.forbidden.join(" "), /הזוג המתחלף הדרוש הוא ∠EDB ו-∠DBC/);
  assert.doesNotMatch(guide.angleHelp, /מתאימות/);
  // Signed-add clarifier must not touch this geometry language.
  const ctx = loadViewerFns();
  assert.equal(ctx.noamClarifySignedAddLanguage(guide.angleHelp), guide.angleHelp);
});

test("diagram title הזוויות המתחלפות links alternate-angles compound", () => {
  const matches = glossary.findTerms("הזוויות המתחלפות", 9);
  assert.ok(matches.some((m) => m.id === "alternate-angles"));
  assert.equal(
    matches.find((m) => m.id === "alternate-angles").text,
    "הזוויות המתחלפות"
  );
});
