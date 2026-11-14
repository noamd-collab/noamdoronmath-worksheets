"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const glossary = require(process.env.GLOSSARY_UNDER_TEST || path.join(__dirname, "../noam-glossary.js"));
const wrongIds = new Set(["right-triangle", "isosceles", "curriculum-b95ff3a56e"]);
const matches = (text, grade = 9) => glossary.findTerms(text, grade, 30);

function assertTrapezoid(text, grade = 9) {
  const found = matches(text, grade);
  assert.deepEqual(found.filter(item => wrongIds.has(item.id)), [], text);
  assert.ok(found.some(item => item.id === "trapezoid"), text);
  for (const item of found) assert.equal(text.slice(item.start, item.end), item.text, text);
}

test("observed T90 A/q4a H1 keeps the trapezoid link without the triangle definition", () => {
  const text = "כיצד מומלץ למקם את הבסיסים המקבילים ואת השוק המאונכת בעת סרטוט טרפז ישר־זווית?";
  for (const grade of [7, 8, 9]) {
    assertTrapezoid(text, grade);
    assert.equal(glossary.findTerms(text, grade, 6).some(item => item.id === "right-triangle"), false);
  }
});

test("both trapezoid adjectives support the existing hyphen and spaced spellings", () => {
  for (const separator of ["־", "-", "‐", "‑", "‒", "–", "—", "―", "−", " "]) {
    for (const adjective of [`ישר${separator}זווית`, `שווה${separator}שוקיים`]) {
      for (const grade of [7, 8, 9]) assertTrapezoid(`סרטטו טרפז ${adjective}.`, grade);
    }
  }
});

test("local owners include named, definite, prefixed and plural trapezoids", () => {
  for (const text of [
    "הטרפז ישר־זווית", "בטרפז השווה־שוקיים", "והטרפז שווה שוקיים",
    "הטרפז ABCD הוא ישר־זווית.", "טרפז ABCD שהוא שווה־שוקיים",
    "טרפז הנתון הוא ישר־זווית", "טרפז שאינו שווה־שוקיים",
    "טרפזים ישרי־זווית", "בטרפזים ישרי זווית", "הטרפזים הם ישרי־זווית",
    "טרפזים שווי־שוקיים", "הטרפז אינו ישר זווית"
  ]) assertTrapezoid(text);
});

test("markup and bidi boundaries do not relabel trapezoid modifiers", () => {
  for (const text of [
    "טרפז **ישר־זווית**", "טרפז *שווה־שוקיים*", "**טרפז** __ישר זווית__",
    "טרפז\u00a0ישר־זווית", "טרפז \u200fישר־זווית", "טרפז \u2067שווה־שוקיים\u2069"
  ]) assertTrapezoid(text);
});

test("a full or separately named triangle remains linkable in the same sentence", () => {
  for (const [text, id, expected] of [
    ["בטרפז נוצר משולש ישר־זווית.", "right-triangle", "משולש ישר־זווית"],
    ["טרפז ישר־זווית מכיל משולש ישר־זווית.", "right-triangle", "משולש ישר־זווית"],
    ["טרפז שווה־שוקיים מכיל משולש שווה־שוקיים.", "isosceles", "משולש שווה־שוקיים"],
    ["המשולש ABC שנוצר בתוך הטרפז הוא משולש ישר־זווית.", "right-triangle", "משולש ישר־זווית"],
    ["בטרפז ABCD המשולש ABC הוא ישר־זווית.", "right-triangle", "ישר־זווית"],
    ["טרפז ישר־זווית. המשולש ABC הוא שווה־שוקיים.", "isosceles", "שווה־שוקיים"],
    ["משולש ישר־זווית מופיע לצד טרפז ישר־זווית.", "right-triangle", "משולש ישר־זווית"]
  ]) {
    const found = matches(text).filter(item => item.id === id);
    assert.equal(found.length, 1, text);
    assert.equal(found[0].text, expected, text);
    assert.equal(text.slice(found[0].start, found[0].end), expected, text);
  }
});

test("standalone and genuine triangle aliases retain their teaching definitions", () => {
  for (const text of ["ישר־זווית", "משולש ישר-זווית", "המשולשים ישרי הזווית", "יתר", "ניצבים", "בדקו *ישר-זווית* במשולש."])
    assert.equal(matches(text).some(item => item.id === "right-triangle"), true, text);
  for (const text of ["שווה־שוקיים", "משולש שווה שוקיים", "במשולש שווה-שוקיים"])
    assert.equal(matches(text).some(item => item.id === "isosceles"), true, text);
  assert.match(glossary.get("right-triangle").short, /^משולש/);
  assert.match(glossary.get("isosceles").short, /^משולש/);
});

test("a sentence boundary prevents a previous trapezoid from suppressing a later term", () => {
  for (const text of ["טרפז. ישר־זווית במשולש הבא.", "טרפז! שווה־שוקיים מתייחס למשולש הבא."])
    assert.equal(matches(text).some(item => ["right-triangle", "isosceles"].includes(item.id)), true, text);
  assert.ok(matches("הישר מסומן לצד טרפז.").some(item => item.id === "curriculum-b95ff3a56e"));
});
