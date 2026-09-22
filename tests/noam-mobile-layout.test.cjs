"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const viewer = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const source = viewer.slice(viewer.indexOf("function getPdfPageWidth(){"), viewer.indexOf("\nfunction setPdfZoom("));
const previewSource = viewer.slice(viewer.indexOf("function cacheExercisePreview(exerciseId,dataUrl){"), viewer.indexOf("\nfunction getExerciseAnalysis(exercise){"));

// The rectangles respond to each page's current size and scrollTop, as they do
// in the layout engine. These tests check scroll-position math, not CSS layout.
function fixture(pageCount = 6) {
  const padding = 8;
  const gap = 10;
  const viewportTop = 100;
  const pages = [];
  const scroll = {
    clientWidth: 664, scrollTop: 0,
    getBoundingClientRect: () => ({ top: viewportTop })
  };
  for (let index = 0; index < pageCount; index++) {
    const canvas = { width: 1200, height: 1680, style: {} };
    const page = {
      isConnected: true,
      style: {}, attributes: {},
      classList: { remove() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector(selector) { assert.equal(selector, "canvas"); return canvas; },
      getBoundingClientRect() {
        const width = parseFloat(this.style.width) || 600;
        const height = parseFloat(this.style.height) || 840;
        const previousHeight = pages.slice(0, index).reduce((total, previous) => total + previous.getBoundingClientRect().height + gap, 0);
        const top = viewportTop + padding + previousHeight - scroll.scrollTop;
        return { top, bottom: top + height, width, height };
      }
    };
    pages.push(page);
  }
  const ctx = {
    pdfScroll: scroll,
    pdfPages: { querySelectorAll(selector) { assert.equal(selector, ".pdf-page"); return pages; } },
    mobileLayout: { matches: true }, pdfZoom: 1, pdfDocument: {},
    pdfRenderVersion: 2, observationCount: 0,
    observePdfPages() { ctx.observationCount++; }
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, pages, scroll, padding, gap };
}

test("shrinking the page width keeps the reader halfway through page four", () => {
  const f = fixture();
  f.scroll.scrollTop = f.padding + 3 * (840 + f.gap) + 420;
  const before = f.ctx.capturePdfPosition();
  assert.equal(before.page, f.pages[3]);
  assert.equal(before.fraction, .5);

  f.scroll.clientWidth = 390;
  f.ctx.resetPdfRendering();

  const after = f.ctx.capturePdfPosition();
  assert.equal(after.page, f.pages[3]);
  assert.ok(Math.abs(after.fraction - .5) < 1e-9, "resize must preserve the same point on the current page");
  assert.ok(f.pages[3].getBoundingClientRect().width < 600);
  assert.ok(f.pages.every(page => Math.abs(page.getBoundingClientRect().height / page.getBoundingClientRect().width - 1.4) < 1e-9));
  assert.equal(f.ctx.pdfRenderVersion, 3);
  assert.equal(f.ctx.observationCount, 1);
});

test("a resize at the start of the worksheet stays at the start", () => {
  const f = fixture();
  f.scroll.clientWidth = 390;
  f.ctx.resetPdfRendering();
  assert.equal(f.ctx.capturePdfPosition().page, f.pages[0]);
  assert.equal(f.ctx.capturePdfPosition().fraction, 0);
  assert.ok(f.scroll.scrollTop >= 0 && f.scroll.scrollTop <= f.padding, "only the small scroll-container inset may move");
});

test("missing or detached page anchors leave scroll position unchanged", () => {
  const f = fixture(0);
  f.scroll.scrollTop = 123;
  assert.equal(f.ctx.capturePdfPosition(), null);
  f.ctx.restorePdfPosition(null);
  f.ctx.restorePdfPosition({ page: { isConnected: false }, fraction: .5 });
  assert.equal(f.scroll.scrollTop, 123);
});


test("phone PDF fills the available width at 70% while buttons keep their fixed gutter", () => {
  const f = fixture();
  const desktopGutter = Number(viewer.match(/margin-right:(\d+)px;/)[1]);
  const mobileGutter = Number(viewer.match(/\.pdf-page\{width:calc\(100vw - \d+px\);min-height:0;margin-right:(\d+)px/)[1]);
  for (const mobile of [true, false]) {
    f.ctx.mobileLayout.matches = mobile;
    const gutter = mobile ? mobileGutter : desktopGutter;
    const containerInset = mobile ? 12 : 34;
    for (const width of [280, 320, 380, 664, 1024]) {
      f.scroll.clientWidth = width;
      f.ctx.pdfZoom = mobile ? .7 : 1;
      const fitted = f.ctx.getPdfPageWidth();
      assert.ok(Math.abs(fitted + gutter + containerInset - width) < 1e-9,
        "the fitted PDF and buttons fill the viewport");
      f.ctx.pdfZoom = mobile ? .85 : 2;
      assert.ok(Math.abs(f.ctx.getPdfPageWidth() / fitted - (mobile ? .85 / .7 : 2)) < 1e-9,
        "changing zoom scales the PDF, not the button gutter");
    }
  }
});

test("an early tap on a phone waits for the PDF instead of showing reconstructed question text", async () => {
  const timers = [];
  const calls = [];
  const imageHolder = { hidden: true, replaceChildren(image) { this.image = image; } };
  const fallback = { hidden: false, replaceChildren(node) { this.child = node; } };
  const exercise = { id: "q3a", crop: { page: 1 }, q: 3, text: "OCR text must stay hidden" };
  const ctx = {
    document: {
      getElementById(id) { return id === "noamPickedPreview" ? imageHolder : id === "noamPickedText" ? fallback : null; },
      createElement(tag) { return { tag }; }
    },
    panelBody: { querySelectorAll() { return []; } },
    selectedExercise: exercise,
    exercisePreviewCache: {}, exercisePreviewOrder: [],
    pdfDocument: null, pdfNativeActive: false, pdfUrl: "/actual.pdf",
    mobileLayout: { matches: true },
    setTimeout(fn) { timers.push(fn); },
    exerciseLabel() { return "שאלה 3 · סעיף א"; },
    cropExerciseCanvasFromPdf(_exercise, options) {
      calls.push(options);
      return Promise.resolve({ width: 900, toDataURL() { return "data:image/png;base64,PDF"; } });
    },
    cropExerciseCanvasFromView() { throw new Error("not needed"); },
    renderPdfPage() { throw new Error("not needed"); },
    pdfRenderVersion: 0
  };
  vm.createContext(ctx);
  vm.runInContext(previewSource, ctx);
  ctx.renderExercisePreview(exercise, 0);
  assert.equal(calls.length, 0);
  assert.equal(imageHolder.hidden, true);
  ctx.pdfDocument = {};
  timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].targetWidth, 1200);
  assert.equal(calls[0].maxPagePixels, 8000000);
  assert.equal(imageHolder.hidden, false);
  assert.match(imageHolder.image.src, /^data:image\/png/);
  assert.equal(fallback.hidden, true);
});

test("a phone with no PDF renderer offers the original PDF, never HTML question text", () => {
  const fallback = { replaceChildren(node) { this.child = node; } };
  const exercise = { id: "q3a", crop: { page: 1 }, text: "OCR text must stay hidden" };
  const ctx = {
    document: {
      getElementById(id) { return id === "noamPickedText" ? fallback : null; },
      createElement(tag) { return { tag }; }
    },
    selectedExercise: exercise,
    exercisePreviewCache: {}, exercisePreviewOrder: [],
    pdfDocument: null, pdfNativeActive: true, pdfUrl: "/actual.pdf"
  };
  vm.createContext(ctx);
  vm.runInContext(previewSource, ctx);
  ctx.renderExercisePreview(exercise, 0);
  assert.equal(fallback.child.tag, "a");
  assert.equal(fallback.child.href, "/actual.pdf");
  assert.doesNotMatch(fallback.child.textContent, /OCR/);
});
