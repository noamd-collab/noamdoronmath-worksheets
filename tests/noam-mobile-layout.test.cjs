"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const viewer = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const source = viewer.slice(viewer.indexOf("function getPdfPageWidth(){"), viewer.indexOf("\nfunction setPdfZoom("));

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
