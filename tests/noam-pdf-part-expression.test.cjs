"use strict";
/**
 * S10 diagnostic fix: PDF text-layer rebuild of selected part (reattach
 * detached minus) must become the solve ground truth — not tall-crop vision
 * that drops the sign. Fixtures are real pdf.js item positions from
 * c6602eec… Q01.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(
  path.join(__dirname, "../worksheet-viewer-noam.html"),
  "utf8"
);
const s10 = require("../noam-ai/manifests/c6602eecfb3841c38f4dbbfe6d10f538.json")
  .exercises.find((e) => e.id === "G8-T01-B-Q01א");

/* Real pdf.js getTextContent items for page 1 near Q01 (normalized later). */
const S10_PDFJS_ITEMS = [
  { str: "חשבו.", transform: [1, 0, 0, 1, 490.1, 641.7], width: 28.6, height: 11.5, dir: "rtl" },
  { str: "א.", transform: [1, 0, 0, 1, 507.3, 618.6], width: 11.5, height: 11.5, dir: "rtl" },
  { str: "7 + 4", transform: [1, 0, 0, 1, 483.0, 618.6], width: 21.9, height: 11.5, dir: "ltr" },
  { str: "ב.", transform: [1, 0, 0, 1, 508.9, 596.5], width: 9.8, height: 11.5, dir: "rtl" },
  { str: "3", transform: [1, 0, 0, 1, 486.3, 596.5], width: 5.7, height: 11.5, dir: "ltr" },
  { str: "9", transform: [1, 0, 0, 1, 500.8, 596.5], width: 5.7, height: 11.5, dir: "ltr" },
  { str: "ג.", transform: [1, 0, 0, 1, 510.5, 574.4], width: 8.3, height: 11.5, dir: "rtl" },
  { str: "5", transform: [1, 0, 0, 1, 487.9, 574.4], width: 5.7, height: 11.5, dir: "ltr" },
  { str: "6", transform: [1, 0, 0, 1, 502.5, 574.4], width: 5.7, height: 11.5, dir: "ltr" },
  { str: "ד.", transform: [1, 0, 0, 1, 510.3, 552.2], width: 8.4, height: 11.5, dir: "rtl" },
  { str: "2 + 10", transform: [1, 0, 0, 1, 480.2, 552.2], width: 27.7, height: 11.5, dir: "ltr" },
  { str: "1.", transform: [1, 0, 0, 1, 542.8, 641.1], width: 9.9, height: 12, dir: "ltr" },
  { str: "−", transform: [1, 0, 0, 1, 478.9, 616.2], width: 9.6, height: 11.5, dir: "ltr" },
  { str: "−", transform: [1, 0, 0, 1, 494.5, 594.1], width: 9.6, height: 11.5, dir: "ltr" },
  { str: "−", transform: [1, 0, 0, 1, 496.0, 571.9], width: 9.6, height: 11.5, dir: "ltr" },
  { str: "−", transform: [1, 0, 0, 1, 483.7, 571.3], width: 9.6, height: 11.5, dir: "ltr" },
  { str: "−", transform: [1, 0, 0, 1, 476.2, 549.2], width: 9.6, height: 11.5, dir: "ltr" }
];

const VIEWPORT = {
  width: 595.28,
  height: 841.89,
  convertToViewportPoint(x, y) {
    return [x, this.height - y];
  }
};

function loadRebuildFns() {
  const start = html.indexOf("function noamIsPartLabelToken");
  const end = html.indexOf("/* STUDENT ATTACHMENTS");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(html.slice(start, end), ctx);
  return ctx;
}

function loadAnalysisFns(pdfItems) {
  const ocrHelperSource = html.slice(
    html.indexOf("function syntheticAnalysis(exercise){"),
    html.indexOf("/* STUDENT ATTACHMENTS")
  );
  const signedHelperSource = html.slice(
    html.indexOf("function noamClarifySignedAddLanguage(answer){"),
    html.indexOf("function noamVisualNeed(")
  );
  const analysisSource =
    ocrHelperSource +
    signedHelperSource +
    html.slice(
      html.indexOf("function getExerciseAnalysis(exercise){"),
      html.indexOf("function askNoam(")
    );
  const calls = [];
  const page = {
    getViewport() {
      return VIEWPORT;
    },
    getTextContent() {
      return Promise.resolve({ items: pdfItems });
    }
  };
  const ctx = {
    analysisCache: {},
    API: "/test",
    console: { warn() {} },
    saveNoamState() {},
    pdfDocument: {
      getPage() {
        return Promise.resolve(page);
      }
    },
    ensurePdfDocumentForCrop: () => Promise.resolve(ctx.pdfDocument),
    cropExerciseImage: () => Promise.resolve("image"),
    postJson: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        analysis: {
          readable: true,
          transcription: "7 + 4",
          problem_statement: "7 + 4",
          math_content: "7+4"
        }
      };
    },
    isBotProtectionError: () => false,
    Object,
    Array,
    String,
    Number,
    Math,
    Promise,
    JSON,
    RegExp
  };
  vm.createContext(ctx);
  vm.runInContext(analysisSource, ctx);
  return { ctx, calls };
}

test("S10 PDF.js tokens rebuild to −7 + 4 (detached minus glued)", () => {
  const ctx = loadRebuildFns();
  const tokens = ctx.noamNormalizePdfJsTextItems(S10_PDFJS_ITEMS, VIEWPORT);
  const expression = ctx.noamRebuildPartExpressionFromTokens(
    tokens,
    "א",
    s10.crop
  );
  assert.equal(expression, "−7 + 4");
  const band = ctx.noamPartBandCropFromTokens(tokens, "א", s10.crop);
  assert.ok(band);
  assert.ok(band.h < s10.crop.h * 0.55, "tight band must exclude ב/ג/ד");
});

test("unreliable OCR prefers PDF rebuild and skips vision when expression ready", async () => {
  const { ctx, calls } = loadAnalysisFns(S10_PDFJS_ITEMS);
  const analysis = await ctx.getExerciseAnalysis(s10);
  assert.equal(calls.length, 0, "must not call noamImageAnalyze when PDF rebuild works");
  assert.equal(analysis.content_type, "pdf_part_expression_rebuild");
  assert.equal(analysis.selected_part_expression, "−7 + 4");
  assert.equal(analysis.math_content, "−7 + 4");
  assert.match(analysis.problem_statement, /−7 \+ 4/);
  assert.doesNotMatch(analysis.problem_statement, /− 4 \+ 7 − ב/);
});

test("solver payload guard pins mixed-sign expression −7+4", () => {
  const start = html.indexOf("function noamGeometryContext(text){");
  const end = html.indexOf("function postJson(endpoint,payload){");
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
  vm.runInContext(html.slice(start, end), ctx);
  const message = ctx.noamSolverMessage(
    "תן לי רמז אחד בלבד.",
    { history: [] },
    "אבחון קדם־ידע",
    "",
    {
      selected_part_expression: "−7 + 4",
      transcription: "שאלה 1 סעיף א: −7 + 4",
      math_content: "−7 + 4",
      problem_statement: "שאלה 1 סעיף א: −7 + 4"
    }
  );
  assert.match(message, /−7 \+ 4/);
  assert.match(message, /סימנים שונים/);
  assert.match(message, /לא אותו סימן/);
});

test("same-sign hint language is rejected when analysis is mixed-sign", () => {
  const { ctx } = loadAnalysisFns(S10_PDFJS_ITEMS);
  const analysis = {
    selected_part_expression: "−7 + 4",
    transcription: "שאלה 1 סעיף א: −7 + 4",
    math_content: "−7 + 4",
    problem_statement: "שאלה 1 סעיף א: −7 + 4"
  };
  const hint1 =
    "האם שני המספרים 4 ו-7 נמצאים באותו צד של אפס על ישר המספרים?";
  const hint2 =
    "כאשר מחברים שני מספרים בעלי אותו סימן, סכום הערכים המוחלטים הוא גודל התוצאה.";
  assert.ok(ctx.noamWrongSignedAddRuleIssue(hint1, analysis));
  assert.ok(ctx.noamWrongSignedAddRuleIssue(hint2, analysis));
  assert.equal(
    ctx.noamWrongSignedAddRuleIssue(
      "מחסרים את הערך המוחלט הקטן מהגדול ולוקחים את הסימן של המספר בעל הערך המוחלט הגדול.",
      analysis
    ),
    null
  );
});
