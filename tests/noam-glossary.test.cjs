"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const glossary = require("../noam-glossary.js");
const viewer = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");

test("the local glossary ships complete, unique, grade-scoped teaching entries", () => {
  assert.ok(glossary.entries.length >= 70);
  assert.equal(new Set(glossary.entries.map(entry => entry.id)).size, glossary.entries.length);
  for (const entry of glossary.entries) {
    for (const field of ["id", "term", "short", "detail", "example", "prerequisite", "question"]) {
      assert.ok(String(entry[field] || "").trim(), `${entry.id}: ${field}`);
    }
    assert.ok(Array.isArray(entry.aliases) && entry.aliases.length, `${entry.id}: aliases`);
    assert.ok(entry.grades.every(grade => [7, 8, 9].includes(grade)), `${entry.id}: grades`);
  }
});

test("longer mathematical terms win and each concept is highlighted once per passage", () => {
  const matches = glossary.findTerms("שורשי הפונקציה מתקבלים מן הפרבולה. אחר כך בודקים שוב את שורשי הפונקציה.", 9, 6);
  assert.deepEqual(matches.map(match => match.id), ["function-roots", "parabola"]);
  assert.equal(matches[0].text, "שורשי הפונקציה");
});

test("grade scope prevents advanced terms from appearing too early", () => {
  assert.equal(glossary.findTerms("פונקציה ריבועית ופרבולה", 7, 6).length, 0);
  assert.deepEqual(glossary.findTerms("פונקציה ריבועית ופרבולה", 9, 6).map(match => match.id), ["quadratic-function", "parabola"]);
});

test("Hebrew word boundaries avoid highlighting a term inside an unrelated word", () => {
  assert.equal(glossary.findTerms("הריבועית", 9, 6).some(match => match.id === "square"), false);
  assert.equal(glossary.findTerms("ריבוע", 9, 6)[0].id, "square");
});

test("axis-scale language used by Noam AI is explained in grade 7", () => {
  const text = "ציר מספרי אינו חייב להתחיל ב־0, ולכן יש להסיק את קנה המידה. בין 20 ל־50 בציר ה־x ובין 9 ל־15 בציר ה־y.";
  const matches = glossary.findTerms(text, 7);
  assert.deepEqual(matches.map(match => match.id), ["number-line", "scale", "coordinate-axis"]);
  assert.equal(glossary.get("scale").short, "הערך הקבוע שכל מרווח בציר או כל יחידת אורך בשרטוט מייצגים.");
});

test("Pythagoras is available at the grade where the catalog teaches it", () => {
  assert.deepEqual(glossary.findTerms("משפט פיתגורס", 7).map(match => match.id), ["pythagorean"]);
});

test("the viewer exposes hover, focus, tap and a free detailed explanation tab", () => {
  assert.match(viewer, /noam-glossary\.js\?v=/);
  assert.match(viewer, /pointerenter[\s\S]*?focus[\s\S]*?click/);
  assert.match(viewer, /role=\\?"tablist\\?"[\s\S]*?שיחה[\s\S]*?הסבר/);
  assert.match(viewer, /NoamGlossary\.findTerms\(node\.nodeValue,g,6\)/);
  assert.match(viewer, /noamDrafts\[selectedExercise\.id\]=entry\.question/);
});
