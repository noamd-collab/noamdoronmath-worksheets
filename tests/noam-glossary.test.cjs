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


test("compound right-triangle and hyphenated phrases do not fall back to bare line", () => {
  for (const phrase of ["ישר-זווית", "ישר־זווית", "*ישר-זווית*", "משולש ישר-זווית"]) {
    const matches = glossary.findTerms(`בדקו ${phrase} במשולש.`, 9);
    assert.deepEqual(matches.map(match => match.id).filter(id => id === "right-triangle" || id === "curriculum-b95ff3a56e" || id === "angle"),
      ["right-triangle"], phrase);
  }
  assert.deepEqual(glossary.findTerms("משולש שווה-שוקיים", 9).map(m => m.id), ["isosceles"]);
  assert.deepEqual(glossary.findTerms("זוויות מתאימות וזוויות מתחלפות", 9).map(m => m.id),
    ["corresponding-angles", "alternate-angles"]);
  assert.deepEqual(glossary.findTerms("הזווית הישרה בריבוע", 9).map(m => m.id), ["right-angle", "square"]);
});

test("ביחס ל is positional and does not link the numeric ratio concept", () => {
  const s06 =
    "שימו לב למיקום של הקודקוד A במשולש השמאלי – באיזה פינה הוא נמצא ביחס לצלע התחתונה?";
  assert.equal(
    glossary.findTerms(s06, 8).some((m) => m.id === "ratio"),
    false
  );
  assert.equal(glossary.findTerms("ביחס לצלע", 8).some((m) => m.id === "ratio"), false);
  assert.equal(glossary.findTerms("וביחס לחותך AB", 9).some((m) => m.id === "ratio"), false);
  // Legitimate numeric-ratio language must still link.
  assert.deepEqual(glossary.findTerms("יחס בין אורכים", 8).map((m) => m.id), ["ratio"]);
  assert.deepEqual(glossary.findTerms("היחס 6:9", 8).map((m) => m.id), ["ratio"]);
  assert.ok(glossary.findTerms("יחס הדמיון", 9).some((m) => m.id === "ratio" || m.id === "similarity"));
});

test("equilateral compound with maqaf and ב prefix links as one unit", () => {
  assert.deepEqual(
    glossary.findTerms("במשולש שווה־צלעות", 9).map((m) => ({ id: m.id, text: m.text })),
    [{ id: "equilateral", text: "במשולש שווה־צלעות" }]
  );
  assert.deepEqual(
    glossary.findTerms("משולש שווה-צלעות", 9).map((m) => m.id),
    ["equilateral"]
  );
  assert.deepEqual(
    glossary.findTerms("שווה־צלעות", 9).map((m) => m.id),
    ["equilateral"]
  );
  const s07 =
    "האם אתה זוכר מהו הערך של כל זווית במשולש שווה־צלעות?";
  assert.equal(
    glossary.findTerms(s07, 9).some((m) => m.id === "triangle" && m.text === "במשולש"),
    false
  );
  assert.ok(glossary.findTerms(s07, 9).some((m) => m.id === "equilateral"));
});

test("power detail covers integer exponents including zero and negative", () => {
  const power = glossary.get("power");
  assert.match(power.detail, /מעריך שלם/);
  assert.match(power.detail, /a\u2070\s*=\s*1|a⁰\s*=\s*1/);
  assert.match(power.detail, /a\u207b|a⁻/);
  assert.match(power.detail, /a\s*≠\s*0|a ≠ 0/);
  assert.doesNotMatch(power.detail, /^בביטוי aⁿ המספר a הוא הבסיס ו־n הוא המעריך\. המעריך קובע כמה פעמים הבסיס מופיע כגורם\.$/);
});

test("פינה glossary text labels side vs vertex clearly", () => {
  const entry = glossary.get("curriculum-de3686967d");
  assert.ok(entry);
  assert.match(entry.short, /צלע:/);
  assert.match(entry.short, /קודקוד \(פינה\):/);
  assert.match(entry.detail, /קודקוד \(פינה\) הוא הנקודה/);
  assert.match(entry.detail, /לא הקו עצמו/);
  assert.ok(glossary.findTerms("באיזה פינה", 8).some((m) => m.id === "curriculum-de3686967d"));
});

test("corresponding angles cover polygon vertices and a transversal without unconditional equality", () => {
  const entry = glossary.get("corresponding-angles");
  assert.match(entry.short, /בשני מצולעים: זוויות בקודקודים שמותאמים זה לזה/);
  assert.match(entry.short, /בשני ישרים וחותך: זוויות בשתי נקודות החיתוך, באותו צד של החותך/);
  assert.doesNotMatch(entry.short, /שוות/);
  assert.match(entry.detail, /^התאמה לבדה אינה אומרת שהזוויות שוות\./);
  assert.match(entry.detail, /מנתון או מחפיפה או דמיון שכבר הוכחו/);
  assert.match(entry.detail, /שוות כשהישרים מקבילים, ורק אז/);
  assert.doesNotMatch(entry.example, /MN|∥/);
  // G9-T46-B-Q03ב: the congruence hint links this entry next to vertices K and M.
  const hint = "האם זכית בחפיפה בין המשולשים בסעיף א׳, ואיזה זוויות מתאימות נמצאות בקודקודים K ו־M בהתאמה?";
  assert.ok(glossary.findTerms(hint, 9, 6).some((m) => m.id === "corresponding-angles"));
  const publicCopy = fs.readFileSync(path.join(__dirname, "../headless/astro-poc/public/noam-glossary.js"), "utf8");
  assert.equal(publicCopy, fs.readFileSync(path.join(__dirname, "../noam-glossary.js"), "utf8"));
});

test("Hebrew word boundaries avoid highlighting a term inside an unrelated word", () => {
  assert.equal(glossary.findTerms("הריבועית", 9, 6).some(match => match.id === "square"), false);
  assert.equal(glossary.findTerms("ריבוע", 9, 6)[0].id, "square");
});

test("approved Sheet aliases extend an existing definition without replacing it", () => {
  const before = glossary.get("right-triangle");
  assert.equal(glossary.mergeAliases([{ conceptId: "right-triangle", phrase: "משולש עם זווית ישרה" }]), 1);
  assert.equal(glossary.get("right-triangle"), before);
  assert.equal(glossary.findTerms("בנו משולש עם זווית ישרה.", 9, 6)[0].id, "right-triangle");
  assert.equal(glossary.mergeAliases([{ conceptId: "unknown", phrase: "משולש עם זווית ישרה" }]), 0);
  assert.equal(glossary.mergeAliases([{ conceptId: "square", phrase: "משולש עם זווית ישרה" }]), 0);
  assert.equal(glossary.mergeAliases([{ conceptId: "square", phrase: "<script>" }]), 0);
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

test("Pythagoras square-sum language is numeric, not the geometric square", () => {
  const pythagoras = glossary.findTerms("בדקו בעזרת סכום ריבועים שהמוטות מקיימים את משפט פיתגורס.", 8);
  assert.equal(pythagoras.some(match => match.id === "square"), false);
  assert.ok(pythagoras.some(match => match.id === "numeric-square"));
  assert.ok(pythagoras.some(match => match.id === "pythagorean"));
  const helper = glossary.findTerms("הכריעו בעזרת ריבועים אם המשולש ישר־זווית.", 8);
  assert.equal(helper.some(match => match.id === "square"), false);
  assert.ok(helper.some(match => match.id === "numeric-square"));
});

test("geometric square stays linked in its own definition context", () => {
  assert.deepEqual(
    glossary.findTerms("הגדרה של ריבוע: מרובע שכל צלעותיו שוות.", 8).map(match => match.id),
    ["square"]
  );
  assert.deepEqual(glossary.findTerms("הזווית הישרה בריבוע", 9).map(match => match.id), ["right-angle", "square"]);
  const shape = glossary.findTerms("ומהו ריבוע כצורה גאומטרית?", 8);
  assert.ok(shape.some(match => match.id === "square"));
  assert.equal(shape.some(match => match.id === "numeric-square"), false);
});

test("Pythagoras 'הריבוע של הצלעות' is numeric even next to the word sides", () => {
  const live =
    '"סכום ריבועים" פירושו לחבר את הריבוע של שתי הצלעות הקצרות: 12² + 35².';
  const matches = glossary.findTerms(live, 8);
  assert.equal(matches.some(match => match.id === "square"), false);
  assert.ok(matches.some(match => match.id === "numeric-square"));
  const singular = glossary.findTerms("לחבר את הריבוע של שתי הצלעות הקצרות.", 8);
  assert.equal(singular.some(match => match.id === "square"), false);
  assert.ok(singular.some(match => match.id === "numeric-square"));
  assert.equal(singular.find(match => match.id === "numeric-square").text, "הריבוע");
});

test("the viewer exposes hover, focus, tap and a free detailed explanation tab", () => {
  assert.match(viewer, /noam-glossary-curriculum\.js\?v=[^<]+<\/script>\s*<script src="noam-glossary\.js/);
  assert.match(viewer, /noam-glossary\.js\?v=/);
  assert.match(viewer, /NOAM_GLOSSARY_FEED_URL[\s\S]*?exec\?feed=1/);
  assert.match(viewer, /NoamGlossary\.mergeAliases\(feed\.aliases\)/);
  assert.match(viewer, /pointerenter[\s\S]*?focus[\s\S]*?click/);
  assert.match(viewer, /role=\\?"tablist\\?"[\s\S]*?שיחה[\s\S]*?הסבר/);
  assert.match(viewer, /NoamGlossary\.findTerms\(node\.nodeValue,g,6\)/);
  assert.match(viewer, /noamDrafts\[selectedExercise\.id\]=entry\.question/);
});
