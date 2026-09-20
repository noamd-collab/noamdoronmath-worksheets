"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const glossary = require("../noam-glossary.js");
const viewer = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const curriculum = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/noam-glossary-curriculum.json"), "utf8"));

test("the local glossary ships complete, unique, grade-scoped teaching entries", () => {
  assert.ok(glossary.entries.length >= 290);
  assert.equal(new Set(glossary.entries.map(entry => entry.id)).size, glossary.entries.length);
  for (const entry of glossary.entries) {
    for (const field of ["id", "term", "short", "detail", "example", "prerequisite", "question"]) {
      assert.ok(String(entry[field] || "").trim(), `${entry.id}: ${field}`);
    }
    assert.ok(Array.isArray(entry.aliases) && entry.aliases.length, `${entry.id}: aliases`);
    assert.ok(entry.grades.every(grade => [7, 8, 9].includes(grade)), `${entry.id}: grades`);
  }
});

test("curriculum aliases cannot highlight bare numbers or punctuation", () => {
  for (const entry of glossary.entries) {
    for (const alias of entry.aliases) {
      assert.equal(/^\d+(?:[.,]\d+)?$/.test(alias), false, `${entry.id}: numeric alias ${alias}`);
      assert.match(alias, /[\p{L}\p{N}]/u, `${entry.id}: punctuation-only alias ${alias}`);
    }
  }
  assert.equal(glossary.findTerms("10 100", 7).length, 0);
});

test("generated follow-up questions are grammatical and refer to the named concept", () => {
  const numerator = glossary.entries.find(entry => entry.term === "מונה");
  const multiplication = glossary.entries.find(entry => entry.term === "כפל");
  assert.equal(numerator.question, "מהי המשמעות של ״מונה״, ואיך היא קשורה לתרגיל?");
  assert.equal(multiplication.question, "מתי משתמשים ב־״כפל״, ומה עושים תחילה?");
  assert.equal(glossary.entries
    .filter(entry => entry.id.startsWith("curriculum-"))
    .some(entry => /איך מזהים את /.test(entry.question)), false);
});

test("every concept row supplied for grades 1-9 is available when Noam AI can use it", () => {
  assert.ok(curriculum.rows.length >= 370);
  for (const row of curriculum.rows) {
    const grade = Math.max(7, row.grade);
    const matches = glossary.findTerms(row.term, grade, 10);
    assert.ok(matches.length, `missing grade ${row.grade} concept in grade ${grade}: ${row.term}`);
  }
});

test("longer mathematical terms win and each concept is highlighted once per passage", () => {
  const matches = glossary.findTerms("שורשי הפונקציה מתקבלים מן הפרבולה. אחר כך בודקים שוב את שורשי הפונקציה.", 9, 6);
  assert.deepEqual(matches.map(match => match.id), ["function-roots", "parabola"]);
  assert.equal(matches[0].text, "שורשי הפונקציה");
});

test("grade scope prevents advanced terms from appearing too early", () => {
  const earlyIds = glossary.findTerms("פונקציה ריבועית ופרבולה", 7, 6).map(match => match.id);
  assert.equal(earlyIds.includes("quadratic-function"), false);
  assert.equal(earlyIds.includes("parabola"), false);
  assert.deepEqual(glossary.findTerms("פונקציה ריבועית ופרבולה", 9, 6).map(match => match.id), ["quadratic-function", "parabola"]);
});

test("definite and plural right-triangle phrases stay one concept with their original spelling", () => {
  for (const phrase of [
    "המשולש ישר הזווית", "במשולש ישר זווית", "והמשולש ישר־הזווית",
    "המשולש ישר-הזווית", "משולש ישר-זווית", "המשולשים ישרי הזווית",
    "במשולשים ישרי־זווית", "משולשים ישרי-זווית"
  ]) {
    for (const grade of [7, 8, 9]) {
      const text = `ובחנו את ${phrase} BHQ.`;
      const matches = glossary.findTerms(text, grade);
      assert.deepEqual(matches.map(match => match.id), ["right-triangle"], text);
      assert.equal(matches[0].text, phrase);
      assert.equal(text.slice(matches[0].start, matches[0].end), phrase);
    }
  }
  const separate = glossary.findTerms("המשולש נמצא ליד הישר והזווית מסומנת.", 9);
  assert.equal(separate.some(match => match.id === "right-triangle"), false);
  assert.ok(separate.some(match => match.id === "triangle"));
  assert.ok(separate.some(match => match.id === "angle"));
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
  assert.match(viewer, /noam-glossary-curriculum\.js\?v=[^<]+<\/script>\s*<script src="noam-glossary\.js/);
  assert.match(viewer, /noam-glossary\.js\?v=/);
  assert.match(viewer, /pointerenter[\s\S]*?focus[\s\S]*?click/);
  assert.match(viewer, /role=\\?"tablist\\?"[\s\S]*?שיחה[\s\S]*?הסבר/);
  assert.match(viewer, /NoamGlossary\.findTerms\(node\.nodeValue,g,6\)/);
  assert.match(viewer, /noamDrafts\[selectedExercise\.id\]=entry\.question/);
});
