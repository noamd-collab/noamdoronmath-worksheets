"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const helpers = html.slice(html.indexOf("function announceNoam(text){"), html.indexOf("function syncMobilePanel(){"));
const askSource = html.slice(html.indexOf("function askNoam(helpKind,studentMessage){"), html.indexOf("function postJson(endpoint,payload){"));

function helperFixture() {
  let nextTimer = 0;
  const timers = new Map();
  const status = { textContent: "" };
  const elements = new Map([["noamAnnouncements", status]]);
  const ctx = {
    noamAnnouncementTimer: null,
    panel: { classList: { contains: () => false } },
    document: { getElementById: id => elements.get(id) },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(ctx);
  vm.runInContext(helpers, ctx);
  return { ctx, status, elements, flush() { for (const fn of timers.values()) fn(); timers.clear(); } };
}

test("status announcements replace the prior event and can repeat the same message", () => {
  const f = helperFixture();
  f.ctx.announceNoam("thinking");
  f.ctx.announceNoam("new answer");
  f.flush();
  assert.equal(f.status.textContent, "new answer");
  f.ctx.announceNoam("new answer");
  assert.equal(f.status.textContent, "");
  f.flush();
  assert.equal(f.status.textContent, "new answer");
});

test("chat focus returns to a recreated control, or the conversation while controls are disabled", () => {
  const f = helperFixture();
  const focused = [];
  const input = { disabled: false, getClientRects: () => [1], focus: () => focused.push("input") };
  const transcript = { focus: () => focused.push("transcript") };
  f.elements.set("noamQuestion", input);
  f.elements.set("noamTranscript", transcript);
  f.ctx.restoreNoamChatFocus("noamQuestion");
  input.disabled = true;
  f.ctx.restoreNoamChatFocus("noamQuestion");
  f.ctx.restoreNoamChatFocus("removed-control");
  f.ctx.restoreNoamChatFocus("");
  f.ctx.panel.classList.contains = () => true;
  f.ctx.restoreNoamChatFocus("noamQuestion");
  assert.deepEqual(focused, ["input", "transcript", "transcript"]);
});

async function requestFixture(result) {
  const notices = [];
  const thread = { hintIndex: 0, history: [], messages: [{ role: "assistant", text: "old answer must not repeat" }] };
  const focusRestores = [];
  const ctx = {
    selectedExercise: { id: "q1a", q: 1, part: "א" }, busy: false,
    noamDrafts: {}, API: "/test", g: 7, lv: "a", LEVEL: { a: "A" }, ttl: "test",
    SOLVER_MESSAGE_MAX: 700, MATH_OUTPUT_INSTRUCTION: "", MIN_WAIT: 0,
    panelBody: { contains: () => true }, document: { activeElement: { id: "noamHint" } },
    exerciseThread: () => thread, exerciseLabel: () => "שאלה 1 · סעיף א",
    saveNoamState() {}, renderNoamChat() {},
    setNoamBusy(value) { ctx.busy = value; },
    restoreNoamChatFocus(id) { focusRestores.push(id); },
    announceNoam(value) { notices.push(value); },
    getExerciseAnalysis: () => Promise.resolve({ readable: true }),
    postJson: () => result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    setTimeout(fn) { fn(); }
  };
  vm.createContext(ctx);
  vm.runInContext(askSource, ctx);
  ctx.askNoam("hint", "help");
  await new Promise(resolve => setImmediate(resolve));
  return { notices, thread, focusRestores, ctx };
}

test("a successful request announces only its new answer, with the selected question", async () => {
  const f = await requestFixture({ ok: true, answer: "new answer" });
  assert.equal(f.notices.length, 2);
  assert.match(f.notices[0], /מכין תשובה.*שאלה 1/);
  assert.match(f.notices[1], /שאלה 1.*נועם AI: new answer/);
  assert.ok(f.notices.every(text => !text.includes("old answer")));
  assert.deepEqual(f.focusRestores, ["noamHint"]);
  assert.equal(f.ctx.busy, false);
});

test("a refused request announces its actual error without announcing old history", async () => {
  const f = await requestFixture(new Error("verification refused"));
  assert.equal(f.notices.length, 2);
  assert.match(f.notices[1], /שאלה 1.*verification refused/);
  assert.ok(f.notices.every(text => !text.includes("old answer")));
  assert.equal(f.ctx.busy, false);
});

function luminance(hex) {
  return hex.match(/\w\w/g).map(pair => parseInt(pair, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
}

test("active accent controls retain readable text for every grade", () => {
  const defaults = html.match(/:root\{([\s\S]*?)\}/)[1];
  const defaultOnAccent = defaults.match(/--on-accent:(#[0-9a-f]+);/i)[1];
  for (const grade of [7, 8, 9]) {
    const rules = html.match(new RegExp('\\[data-grade="' + grade + '"\\]\\{([\\s\\S]*?)\\}'))[1];
    const background = rules.match(/--accent:(#[0-9a-f]+);/i)[1];
    const color = (rules.match(/--on-accent:(#[0-9a-f]+);/i) || [null, defaultOnAccent])[1];
    const expand = hex => hex.length === 4 ? "#" + [...hex.slice(1)].map(c => c + c).join("") : hex;
    const values = [luminance(expand(background)), luminance(expand(color))].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, "grade " + grade);
  }
});

test("the viewer remains valid JavaScript with one main target and one persistent announcer", () => {
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.equal((html.match(/<\/main>/g) || []).length, 1);
  assert.match(html, /href="#worksheetMain"/);
  assert.match(html, /<main[^>]+id="worksheetMain"[^>]+tabindex="-1"/);
  assert.equal((html.match(/id="noamAnnouncements"/g) || []).length, 1);
  assert.match(html, /\.noam-compose textarea:focus-visible\{outline:3px/);
});
