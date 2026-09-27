"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const sample = require("./fixtures/noam-12-question-sample.json");

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

test("fixture does not claim live hint PASS from dictionary work", () => {
  for (const item of sample.items) {
    assert.equal(item.results.live.hint_live, "NOT_RUN");
    assert.equal(item.results.live.concept_live, "NOT_RUN");
  }
});
