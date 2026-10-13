"use strict";
/**
 * Representative 12-case matrix for hints/concepts (local/deterministic).
 * Pedagogical live AI answers are NOT claimed here — only mechanism readiness.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const glossary = require("../noam-glossary.js");
const guides = require("../noam-didactic-guides.js");

const viewer = fs.readFileSync(
  path.join(__dirname, "../headless/astro-poc/public/worksheet-viewer-noam.html"),
  "utf8"
);

const CASES = [
  { id: "C01", kind: "geo-hint", exercise: "G9-T20-E-Q06א", note: "Codex regression MN∥AC" },
  { id: "C02", kind: "geo-hint", exercise: "G9-T15-E-Q04א", note: "existing alternate-angle guide" },
  { id: "C03", kind: "geo-hint", exercise: "G9-T15-E-Q04ב", note: "corresponding angles calc guide" },
  { id: "C04", kind: "concept", text: "ישר-זווית", expect: ["right-triangle"], note: "hyphen compound" },
  { id: "C05", kind: "concept", text: "*ישר-זווית*", expect: ["right-triangle"], note: "markdown + compound" },
  { id: "C06", kind: "concept", text: "משולש שווה-שוקיים", expect: ["isosceles"], note: "isosceles hyphen" },
  { id: "C07", kind: "concept", text: "זוויות מתאימות", expect: ["corresponding-angles"], note: "corresponding term" },
  { id: "C08", kind: "concept", text: "זוויות מתחלפות", expect: ["alternate-angles"], note: "alternate term" },
  { id: "C09", kind: "concept", text: "הזווית הישרה", expect: ["right-angle"], note: "right angle ≠ line" },
  { id: "C10", kind: "concept", text: "הישר נמשך", expect: ["curriculum-b95ff3a56e"], note: "bare line still works" },
  { id: "C11", kind: "validation", note: "BMN/BAC mislabel blocked" },
  { id: "C12", kind: "algebra-concept", text: "חוק הפילוג וכינוס איברים דומים", expect: ["distributive-law", "like-terms"], note: "algebra compounds" }
];

test("matrix C01–C03: graduated didactic hints exist and stay stepwise", () => {
  for (const item of CASES.filter((c) => c.kind === "geo-hint")) {
    const guide = guides.get(item.exercise);
    assert.ok(guide, item.id);
    assert.ok(guide.hints && guide.hints.length === 3, item.id + " three hints");
    const texts = [0, 1, 2].map(
      (i) => guides.respond(item.exercise, { helpKind: "hint", hintIndex: i }).text
    );
    assert.equal(new Set(texts).size, 3, item.id + " non-repeating hints");
    assert.ok(texts[0].length < 180, item.id + " hint1 short");
    if (item.exercise === "G9-T20-E-Q06א") {
      assert.doesNotMatch(texts[0], /MN\s*∥\s*AC/);
      assert.match(texts[2], /מתאימ/);
      assert.doesNotMatch(texts[2], /מתחלפ/);
    }
  }
});

test("matrix C04–C10 + C12: concept compounds resolve correctly", () => {
  for (const item of CASES.filter((c) => c.kind === "concept" || c.kind === "algebra-concept")) {
    const ids = glossary.findTerms(item.text, 9, 8).map((m) => m.id);
    assert.deepEqual(ids.slice(0, item.expect.length), item.expect, item.id + " " + item.text);
  }
});

test("matrix C11: BMN/BAC alternate mislabel is rejected in viewer guard", () => {
  assert.match(
    viewer,
    /BMN[\s\S]{0,120}BAC[\s\S]{0,120}מתאימות/
  );
  assert.match(viewer, /noamStripMarkdownEmphasis/);
  assert.match(viewer, /זוויות מתחלפות עם זוויות מתאימות/);
});

test("matrix catalog lists exactly 12 representative cases", () => {
  assert.equal(CASES.length, 12);
  assert.deepEqual(
    CASES.map((c) => c.id),
    ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12"]
  );
});
