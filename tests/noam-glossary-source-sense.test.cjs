"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const glossary = require("../noam-glossary.js");
const squareIds = text => glossary.findTerms(text, 9, 30)
  .filter(match => ["square", "numeric-square"].includes(match.id)).map(match => match.id);
const expansion = text => glossary.findTerms(text, 9, 30)
  .filter(match => match.id === "curriculum-5c07a5a09f");

test("actual W22-Q3 root-of-square phrase never links the quadrilateral definition", () => {
  const text = "כאשר אתה מחשב גובה באמצעות משפט פיתגורס, האם עצם העובדה שהתוצאה היא מספר חיובי מבטיחה ששורש הריבוע הוא שלם?";
  assert.deepEqual(squareIds(text), ["numeric-square"]);
  const match = glossary.findTerms(text, 7, 30).find(item => item.id === "numeric-square");
  assert.equal(match.text, "הריבוע");
  assert.equal(text.slice(match.start, match.end), "הריבוע");
  for (const phrase of ["שורש הריבוע", "השורש של הריבוע", "ושורש **הריבוע**", "שורש\u00a0הריבוע", "שורש של ריבוע"])
    assert.deepEqual(squareIds(phrase), ["numeric-square"], phrase);
});

test("root context does not override an explicit polygon owner; ordinary senses remain intact", () => {
  for (const text of ["שורש הריבוע ABCD", "שורש הריבוע ששטחו נתון"])
    assert.deepEqual(squareIds(text), [], text);
  for (const text of ["5 בריבוע", "ריבוע האלכסון", "מספר שהוא ריבוע שלם", "שורש ריבועי של 25"])
    assert.equal(squareIds(text).includes("square"), false, text);
  for (const text of ["שטח הריבוע שעל היתר", "בריבוע ABCD", "הצלע של הריבוע היא גם ניצב"])
    assert.deepEqual(squareIds(text), ["square"], text);
  assert.deepEqual(squareIds("השורש נמצא כאן. הריבוע ABCD מסומן."), ["square"]);
});

test("actual W15-Q1 nested geometric extension is not fraction expansion", () => {
  const text = "בהרחבה המקוננת, האם שתי הזוויות המנומקות נוצרות על ידי אותו ישר חותך את שני הישרים המקבילים?";
  assert.deepEqual(expansion(text), []);
  for (const phrase of ["הרחבה מקוננת", "ההרחבה הנפרדת", "ובהרחבה **המקוננת**", "הרחבה גאומטרית", "הרחבה גיאומטרית", "הרחבה של המשולש", "הרחבה של צורה"])
    assert.deepEqual(expansion(phrase), [], phrase);
  assert.deepEqual(expansion("השבר מופיע בצד; בהרחבה המקוננת הוכיחו דמיון."), []);
});

test("the complete authored W15 part does not fall back to bare כל הרחבה", () => {
  const source = "כתבו את ההוכחה של כל הרחבה. בהרחבה המקוננת כתבו שרשרת בת חמישה שלבים: נתון, שתי טענות זווית מנומקות, דמיון, ולבסוף פרופורציה.";
  assert.deepEqual(expansion(source), []);
  assert.deepEqual(expansion("בהרחבה המקוננת הוכיחו דמיון; נמקו כל הרחבה."), []);
  assert.deepEqual(expansion("הוכיחו כל הרחבה. תארו הרחבה של המשולש."), []);
  for (const text of [
    "בהרחבה המקוננת הוכיחו דמיון. בדקו כל הרחבה של השבר.",
    "בכל הרחבה כופלים מונה ומכנה באותו מספר. בהרחבה המקוננת הוכיחו דמיון.",
    "תארו הרחבה מקוננת. ודאו שמכנים שווים לאחר כל הרחבה.",
    "בהרחבה המקוננת הוכיחו דמיון.\nבדקו כל הרחבה."
  ]) assert.equal(expansion(text).length, 1, text);
});

test("genuine fraction expansion and standalone glossary lookup retain exact spans", () => {
  for (const text of ["הרחבה", "בהרחבה של השבר כופלים מונה ומכנה באותו מספר.", "הרחבה למכנה משותף", "הרחבה פי 3", "הרחבה של שברים", "המשולש מוצג ליד השבר. בהרחבה שלו כופלים מונה ומכנה."]){
    const matches = expansion(text);
    assert.equal(matches.length, 1, text);
    assert.equal(text.slice(matches[0].start, matches[0].end), matches[0].text);
  }
  assert.equal(expansion("בהרחבה מקוננת אין כאן שבר. הרחבה של השבר היא פעולה אחרת.").length, 1);
});

test("an arithmetic answer box is not linked to the cuboid definition", () => {
  const boxes = text => glossary.findTerms(text, 7, 30).filter(match => match.id === "curriculum-41fec703ca");
  const caption = "זהו השוויון הנתון לבדיקה, לא קביעה שיש לו פתרון. התיבה נשארה ריקה; בכל הצבה יש לבדוק גם שהחילוק מוגדר.";
  for (const text of [caption, "בכל סעיף השלימו במקום התיבה מספר מתאים.", "כתבו לתוך התיבה מספר."])
    assert.deepEqual(boxes(text), [], text);
  for (const text of ["תיבה", "נפח התיבה הוא 24", "התיבה ריקה. מצאו את שטח הפנים.", "התיבה נמצאת ליד מקום ריק להצבה."])
    assert.equal(boxes(text).length, 1, text);
});

test("published glossary mirror includes the exact reviewed sense rules", () => {
  assert.equal(fs.readFileSync(path.join(__dirname, "../noam-glossary.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "../headless/astro-poc/public/noam-glossary.js"), "utf8"));
});
