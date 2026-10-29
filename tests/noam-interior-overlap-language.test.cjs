"use strict";
/**
 * G7 union-area language: opposite sides of a shared side do not prove
 * non-congruence. Genuine SSS/ASA/SAS wording is left alone.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const viewers = [
  path.join(__dirname, "../worksheet-viewer-noam.html"),
  path.join(__dirname, "../headless/astro-poc/public/worksheet-viewer-noam.html")
];

function loadViewerFns(file) {
  const html = fs.readFileSync(file, "utf8");
  const askSource = html.slice(
    html.indexOf("function noamGeometryContext(text){"),
    html.indexOf("function postJson(endpoint,payload){")
  );
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

for (const file of viewers) {
  const label = path.basename(path.dirname(file)) === "public" ? "public viewer" : "root viewer";

  test(`${label}: opposite-side wording is rewritten to union area, not non-congruence`, () => {
    const ctx = loadViewerFns(file);
    const wrong =
      "המשולשים אינם חופפים משום שמשני עברי AB אין להם אותם אורכים.";
    const clarified = ctx.noamClarifyInteriorOverlapLanguage(wrong);
    assert.match(clarified, /אין חפיפת פנים/);
    assert.match(clarified, /מחברים את השטחים/);
    assert.doesNotMatch(clarified, /אינם חופפים משום שמשני עברי/);
  });

  test(`${label}: genuine congruence on opposite sides of a diagonal is kept`, () => {
    const ctx = loadViewerFns(file);
    const genuine =
      "משולשים משני עברי אלכסון במלבן יכולים להיות חופפים לפי צ.צ.צ.";
    assert.equal(ctx.noamClarifyInteriorOverlapLanguage(genuine), genuine);
  });

  test(`${label}: union-area solver guard forbids opposite-side non-congruence`, () => {
    const ctx = loadViewerFns(file);
    const message = ctx.noamSolverMessage(
      "תן לי רמז אחד בלבד. אל תגלה את התשובה הסופית.",
      { history: [] },
      "שטח האיחוד",
      "",
      {
        transcription: "שני משולשים ישרי־זווית משני עברי AB משתפים אותו. מצאו את שטח האיחוד.",
        readable: true
      }
    );
    assert.match(message, /אין חפיפת פנים/);
    assert.match(message, /אינם חופפים רק כי הם משני עברי/);
    assert.doesNotMatch(message, /12|5|9/);
  });
}
