"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const html = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const cropSource = html.slice(html.indexOf("function cropExerciseCanvas(exercise){"), html.indexOf("function cacheExercisePreview("));
const analysisSource = html.slice(html.indexOf("function getExerciseAnalysis(exercise){"), html.indexOf("function askNoam("));

function cropFixture(states = ["ready"], encode = () => "data:image/jpeg;base64,abc") {
  const drawCalls = [], renders = [], qualities = [];
  const pages = states.map((state, index) => ({
    state, source: { id: index + 1, width: 1600, height: 2000 },
    getAttribute() { return this.state; },
    querySelector() { return this.source; }
  }));
  const ctx = {
    pdfRenderVersion: 1,
    pdfPages: { querySelector(selector) { return pages[Number(selector.match(/data-page="(\d+)"/)[1]) - 1]; } },
    renderPdfPage(n) { renders.push(n); pages[n - 1].state = "ready"; },
    setTimeout(fn) { queueMicrotask(fn); },
    document: { createElement() {
      return {
        getContext: () => ({ fillRect() {}, drawImage(...args) { drawCalls.push(args); } }),
        toDataURL(type, quality) { qualities.push(quality); return encode(quality); }
      };
    } }
  };
  vm.createContext(ctx);
  vm.runInContext(cropSource, ctx);
  return { ctx, pages, drawCalls, renders, qualities };
}

test("legacy single-page crops retain their image region and aspect ratio", async () => {
  const f = cropFixture();
  const canvas = await f.ctx.cropExerciseCanvas({ crop: { page: 1, x: .1, y: .2, w: .5, h: .25 } });
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 500);
  assert.deepEqual(f.drawCalls[0].slice(1), [160, 400, 800, 500, 0, 0, 800, 500]);
  assert.equal(f.renders.length, 0);
});

test("a continuation page is rendered and stitched after the beginning of the question", async () => {
  const f = cropFixture(["ready", "idle"]);
  const canvas = await f.ctx.cropExerciseCanvas({ crops: [
    { page: 1, x: .1, y: .6, w: .5, h: .3 },
    { page: 2, x: .1, y: .1, w: .5, h: .2 }
  ] });
  assert.deepEqual(f.renders, [2]);
  assert.deepEqual(f.drawCalls.map(c => c[0].id), [1, 2]);
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 1012);
  assert.equal(f.drawCalls[1][6], 612);
});

test("zooming during a pending crop prevents an image combining different render versions", async () => {
  const f = cropFixture(["idle"]);
  f.ctx.setTimeout = fn => { f.ctx.pdfRenderVersion++; queueMicrotask(fn); };
  await assert.rejects(f.ctx.cropExerciseCanvas({ crop: { page: 1 } }), /התצוגה השתנתה/);
  assert.equal(f.drawCalls.length, 0);
});

test("JPEG quality is reduced only when necessary to fit the existing backend limit", async () => {
  const f = cropFixture(["ready"], q => "x".repeat(q > .72 ? 390001 : 389999));
  const image = await f.ctx.cropExerciseImage({ crop: { page: 1 } });
  assert.equal(image.length, 389999);
  assert.deepEqual(f.qualities, [.84, .72]);
});

test("an image that cannot fit is rejected before any API request", async () => {
  const f = cropFixture(["ready"], () => "x".repeat(390001));
  await assert.rejects(f.ctx.cropExerciseImage({ crop: { page: 1 } }), /גדולה מדי/);
});

function analysisFixture(result, cropFailure = null) {
  const calls = [];
  const ctx = {
    analysisCache: {}, API: "/test", console: { warn() {} },
    syntheticAnalysis: () => ({ readable: true, problem_statement: "selector only" }),
    saveNoamState() {},
    cropExerciseImage: () => cropFailure ? Promise.reject(cropFailure) : Promise.resolve("image"),
    postJson: async (...args) => { calls.push(args); return result; },
    isBotProtectionError: error => error && error.bot === true
  };
  vm.createContext(ctx);
  vm.runInContext(analysisSource, ctx);
  return { ctx, calls };
}

test("a required worksheet image cannot fall back to a question selector when analysis fails", async () => {
  const f = analysisFixture({ ok: false });
  await assert.rejects(f.ctx.getExerciseAnalysis({ id: "new", requiresVision: true }), /לא הצלחנו לקרוא/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.ctx.analysisCache.new, undefined);
});

test("an unreadable image is rejected instead of being sent to the solver", async () => {
  const f = analysisFixture({ ok: true, analysis: { readable: false } });
  await assert.rejects(f.ctx.getExerciseAnalysis({ id: "new", needsVision: true, requiresVision: true }), /לא הצלחנו לקרוא/);
  assert.equal(f.ctx.analysisCache.new, undefined);
});

test("successful image analysis includes the selected question and section", async () => {
  const f = analysisFixture({ ok: true, analysis: { readable: true, problem_statement: "visible mathematics" } });
  const a = await f.ctx.getExerciseAnalysis({ id: "new", requiresVision: true, prompt: "שאלה 7 סעיף ג" });
  assert.match(a.problem_statement, /שאלה 7 סעיף ג\nvisible mathematics/);
  assert.equal(f.ctx.analysisCache.new, a);
});

test("a readable result without worksheet content cannot turn a selector into solver input", async () => {
  for (const analysis of [{ readable: true }, { readable: true, transcription: "  ", problem_statement: "", student_work: "handwriting only" }]) {
    const f = analysisFixture({ ok: true, analysis });
    await assert.rejects(f.ctx.getExerciseAnalysis({ id: "new", requiresVision: true, prompt: "שאלה 7 סעיף ג" }), /לא הצלחנו לקרוא/);
    assert.equal(Object.keys(f.ctx.analysisCache).length, 0);
  }
});

test("sections sharing a question image reuse analysis without leaking the previous section selection", async () => {
  const f = analysisFixture({ ok: true, analysis: { readable: true, problem_statement: "visible mathematics" } });
  const crops = [{ page: 1, x: .1, y: .2, w: .8, h: .3 }];
  const first = await f.ctx.getExerciseAnalysis({ id: "a", requiresVision: true, crops, prompt: "selected A" });
  const second = await f.ctx.getExerciseAnalysis({ id: "b", requiresVision: true, crops, prompt: "selected B" });
  assert.equal(f.calls.length, 1);
  assert.equal(first.problem_statement, "selected A\nvisible mathematics");
  assert.equal(second.problem_statement, "selected B\nvisible mathematics");
  await f.ctx.getExerciseAnalysis({ id: "c", requiresVision: true, crops: [{ ...crops[0], page: 2 }], prompt: "different image" });
  assert.equal(f.calls.length, 2);
});

test("legacy text fallback remains available and security errors never fall back", async () => {
  const legacy = analysisFixture({ ok: false });
  const result = await legacy.ctx.getExerciseAnalysis({ id: "old", needsVision: true });
  assert.equal(result.problem_statement, "selector only");
  const error = Object.assign(new Error("verification refused"), { bot: true });
  const guarded = analysisFixture(null, error);
  await assert.rejects(guarded.ctx.getExerciseAnalysis({ id: "new", requiresVision: true }), error);
  assert.equal(guarded.calls.length, 0);
  assert.equal(guarded.ctx.analysisCache.new, undefined);
});
