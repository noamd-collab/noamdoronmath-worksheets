"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(
  path.join(__dirname, "../headless/astro-poc/public/worksheet-viewer-noam.html"),
  "utf8"
);

function loadLabelFn() {
  const start = html.indexOf("function noamRetryActionLabel(message){");
  const end = html.indexOf("\nfunction postJson(", start);
  assert.ok(start > 0 && end > start, "noamRetryActionLabel must exist before postJson");
  const source = html.slice(start, end);
  const ctx = {
    isBotProtectionError(error) {
      const status = error && (error.status || error.httpStatus);
      return !!(
        error &&
        (/^(BOT_|HTTP_ERROR_BODY_)/.test(String(error.code || "")) ||
          status === 401 ||
          status === 403 ||
          status === 429)
      );
    }
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return ctx.noamRetryActionLabel;
}

test("retry CTA matches bot security failures instead of implying unread image", () => {
  const label = loadLabelFn();
  assert.equal(
    label({
      answerError: true,
      answerErrorCode: "BOT_CONFIG_UNAVAILABLE",
      text: "לא הצלחנו להשלים את בדיקת האבטחה. נסו שוב בעוד רגע."
    }),
    "נסו שוב את בדיקת האבטחה"
  );
  assert.equal(
    label({
      answerError: true,
      answerErrorCode: "QUESTION_IMAGE_UNREADABLE",
      text: "לא הצלחנו לקרוא את תמונת השאלה. אפשר לנסות שוב — בלי לנחש את תוכן השאלה."
    }),
    "נסו שוב לקרוא את השאלה"
  );
  assert.equal(
    label({
      answerError: true,
      answerErrorCode: "NETWORK_UNAVAILABLE",
      text: "החיבור לנועם AI נקטע. בדקו את החיבור ונסו שוב בעוד רגע."
    }),
    "נסו שוב להתחבר"
  );
  assert.equal(
    label({ answerError: true, answerErrorCode: "", text: "נועם AI לא זמין כרגע." }),
    "נסו שוב"
  );
});

test("answerError persists answerErrorCode for retry labeling", () => {
  assert.match(html, /answerErrorCode:String\(error&&error\.code\|\|""\)/);
  assert.match(html, /retry\.textContent=noamRetryActionLabel\(message\)/);
});
