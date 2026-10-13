"use strict";
/**
 * Locked 12-exercise sample (S01–S12) for Codex independent verify.
 * Distinct from mechanism matrix C01–C12 in noam-hints-concepts-matrix.test.cjs.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sample = require("./fixtures/noam-12-question-sample.json");
const glossary = require("../noam-glossary.js");
const guides = require("../noam-didactic-guides.js");

test("locked sample has 12 distinct exercise IDs across alg/geo and grades", () => {
  assert.equal(sample.items.length, 12);
  const ids = sample.items.map((item) => item.id);
  assert.equal(new Set(ids).size, 12);
  const pdfs = sample.items.map((item) => item.pdf);
  assert.equal(new Set(pdfs).size, 12);
  assert.ok(sample.items.some((item) => item.id === "G9-T20-E-Q06א"));
  assert.ok(sample.items.filter((item) => item.hasGuide).length <= 3);
  assert.ok(sample.items.filter((item) => !item.hasGuide).length >= 9);
  assert.ok(sample.items.some((item) => item.kind === "alg"));
  assert.ok(sample.items.some((item) => item.kind === "geo"));
  assert.deepEqual(
    [...new Set(sample.items.map((item) => item.grade))].sort(),
    [7, 8, 9]
  );
});

test("majority of sample is model-path (not local-guide-only)", () => {
  const model = sample.items.filter((item) => item.pathMode === "model" || !item.hasGuide);
  assert.ok(model.length >= 9, "need ≥9 model-path questions");
  assert.equal(
    sample.items.filter((item) => item.hasGuide).map((i) => i.id).sort().join(","),
    ["G9-T15-E-Q04א", "G9-T20-E-Q06א"].sort().join(",")
  );
});

test("fixture does not claim live hint PASS from dictionary work", () => {
  for (const item of sample.items) {
    assert.equal(item.results.live.hint_live, "NOT_RUN");
    assert.equal(item.results.live.concept_live, "NOT_RUN");
    assert.notEqual(item.results.live.hint_live, "PASS");
  }
});

test("each slot has real PDF hash, manifest exercise, and page", () => {
  for (const item of sample.items) {
    assert.match(item.pdf, /^[a-f0-9]{32}$/);
    const manifestPath = path.join(__dirname, "..", "noam-ai", "manifests", item.pdf + ".json");
    assert.ok(fs.existsSync(manifestPath), item.slot + " manifest");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const ex = manifest.exercises.find((e) => e.id === item.id);
    assert.ok(ex, item.slot + " " + item.id);
    assert.ok(item.page >= 1);
    assert.ok(item.url_www.includes(item.pdf));
    assert.ok(item.url_www.includes("www.noamdoronmath.co.il"));
  }
});

test("S01 local guide: stepwise + corresponding not alternate; no wrong swaps", () => {
  const id = "G9-T20-E-Q06א";
  const texts = [0, 1, 2].map(
    (i) => guides.respond(id, { helpKind: "hint", hintIndex: i }).text
  );
  assert.equal(texts.length, 3);
  assert.doesNotMatch(texts[0], /MN\s*∥\s*AC/);
  assert.match(texts[2], /מתאימ/);
  assert.doesNotMatch(texts[2], /מתחלפ/);
});

test("wrong-replacement guards hold for sample grades (not blanket swap)", () => {
  for (const item of sample.items) {
    const grade = Math.max(item.grade, 7);
    const rt = glossary.findTerms("ישר-זווית", grade, 8).map((m) => m.id);
    assert.ok(rt.includes("right-triangle"), item.slot + " ישר-זווית");
    assert.notEqual(rt[0], "curriculum-b95ff3a56e", item.slot + " not bare line");

    const alt = glossary.findTerms("זוויות מתחלפות", grade, 8).map((m) => m.id);
    assert.ok(alt.includes("alternate-angles"), item.slot);
    assert.ok(!alt.includes("corresponding-angles"), item.slot + " no swap alt→corr");

    const corr = glossary.findTerms("זוויות מתאימות", grade, 8).map((m) => m.id);
    assert.ok(corr.includes("corresponding-angles"), item.slot);
    assert.ok(!corr.includes("alternate-angles"), item.slot + " no swap corr→alt");

    assert.equal(item.results.mock.ok, true, item.slot + " mock");
    assert.equal(item.results.mock.noBlanketReplace, true, item.slot);
  }
});

test("S03–S12 have null local hints (model-path coverage)", () => {
  for (const item of sample.items.filter((i) => !i.hasGuide)) {
    assert.equal(item.results.local.hints, null);
    assert.match(String(item.results.local.detail || ""), /model-path/i);
  }
});
