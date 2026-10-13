"use strict";
/**
 * S10 root cause: garbled multi-part OCR + needsVision:false sent synthetic
 * garbage to the model. Force live vision + scoped semantic instead.
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
  html.slice(html.indexOf("function getExerciseAnalysis(exercise){"), html.indexOf("function askNoam("));
const s10 = require("../noam-ai/manifests/c6602eecfb3841c38f4dbbfe6d10f538.json")
  .exercises.find((e) => e.id === "G8-T01-B-Q01א");

function analysisFixture(result, cropFailure = null) {
  const calls = [];
  const ctx = {
    analysisCache: {},
    API: "/test",
    console: { warn() {} },
    saveNoamState() {},
    ensurePdfDocumentForCrop: () => Promise.resolve(null),
    cropExerciseImage: () =>
      cropFailure ? Promise.reject(cropFailure) : Promise.resolve("image"),
    postJson: async (...args) => {
      calls.push(args);
      return result;
    },
    isBotProtectionError: (error) => error && error.bot === true
  };
  vm.createContext(ctx);
  vm.runInContext(analysisSource, ctx);
  return { ctx, calls };
}

test("S10 manifest OCR is flagged unreliable and must not be synthetic ground truth", () => {
  const f = analysisFixture({ ok: true, analysis: { readable: true } });
  assert.equal(s10.needsVision, false);
  assert.ok(f.ctx.noamManifestOcrUnreliable(s10));
  assert.ok(f.ctx.noamExerciseNeedsLiveVision(s10));
  assert.match(String(s10.text), /ב\s*\./);
  assert.match(String(s10.text), /ג\s*\./);
});

test("unreliable OCR forces vision and scopes semantic to the selected part", async () => {
  const f = analysisFixture({
    ok: true,
    analysis: {
      readable: true,
      transcription: "−7 + 4",
      problem_statement: "−7 + 4",
      math_content: "−7+4"
    }
  });
  const analysis = await f.ctx.getExerciseAnalysis(s10);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "/test/noamImageAnalyze");
  assert.doesNotMatch(analysis.problem_statement, /− 4 \+ 7 − ב/);
  assert.match(analysis.problem_statement, /שאלה 1 סעיף א/);
  assert.match(analysis.problem_statement, /−7 \+ 4/);
  assert.equal(analysis.manifest_ocr_unreliable, true);
  assert.equal(analysis.content_type, "vision_over_unreliable_ocr");
});

test("unreliable OCR does not fall back to garbled synthetic text", async () => {
  const f = analysisFixture({ ok: false });
  await assert.rejects(f.ctx.getExerciseAnalysis(s10), /לא הצלחנו לקרוא את תמונת השאלה/);
  assert.equal(f.ctx.analysisCache[s10.id], undefined);
});

test("clean needsVision:false exercises still use synthetic analysis", async () => {
  const f = analysisFixture({ ok: false });
  const exercise = {
    id: "clean",
    needsVision: false,
    prompt: "חשבו: 3 + 5",
    text: "3 + 5",
    q: 2,
    part: "א"
  };
  assert.equal(f.ctx.noamManifestOcrUnreliable(exercise), false);
  const analysis = await f.ctx.getExerciseAnalysis(exercise);
  assert.equal(f.calls.length, 0);
  assert.equal(analysis.problem_statement, "חשבו: 3 + 5");
});

test("mixed-sign expression rejects both-negatives rule answers", () => {
  const f = analysisFixture({ ok: true, analysis: { readable: true } });
  const analysis = {
    transcription: "שאלה 1 סעיף א\n−7 + 4",
    math_content: "−7+4",
    problem_statement: "−7 + 4"
  };
  const wrong =
    "כדי לחבר מספרים שליליים, חבר את הערכים המוחלטים שלהם ושמור על סימן מינוס.";
  assert.ok(f.ctx.noamWrongSignedAddRuleIssue(wrong, analysis));
  const right =
    "מחסרים את הערך המוחלט הקטן מהגדול ולוקחים את הסימן של המספר בעל הערך המוחלט הגדול.";
  assert.equal(f.ctx.noamWrongSignedAddRuleIssue(right, analysis), null);
});

test("stale synthetic cache from unreliable OCR is discarded", async () => {
  const f = analysisFixture({
    ok: true,
    analysis: {
      readable: true,
      transcription: "−7 + 4",
      problem_statement: "−7 + 4",
      math_content: "−7+4"
    }
  });
  f.ctx.analysisCache[s10.id] = {
    content_type: "static_manifest_exercise",
    problem_statement: s10.prompt,
    transcription: s10.prompt
  };
  const analysis = await f.ctx.getExerciseAnalysis(s10);
  assert.equal(f.calls.length, 1);
  assert.equal(analysis.manifest_ocr_unreliable, true);
  assert.doesNotMatch(analysis.problem_statement, /− 4 \+ 7 − ב/);
});
