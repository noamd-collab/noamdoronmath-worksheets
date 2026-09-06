"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const viewer = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const syncSource = viewer.slice(viewer.indexOf("function syncMobilePanel(){"), viewer.indexOf("\nmobileLayout.addEventListener"));
const panelSource = viewer.slice(viewer.indexOf("function openNoamPanel(){"), viewer.indexOf("\nclosePanelButton.addEventListener"));

function fixture() {
  const document = { activeElement: null };
  function element(id, insidePanel = false) {
    const classes = new Set();
    const item = {
      id, insidePanel, isConnected: true, attributes: {}, variables: {},
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      style: { setProperty(name, value) { item.variables[name] = value; } },
      contains: target => !!(target && target.insidePanel),
      getClientRects: () => [1],
      focus() { document.activeElement = this; },
      blur() { if (document.activeElement === this) document.activeElement = null; }
    };
    return item;
  }
  document.body = element("body");
  const background = { ".bar": element("bar"), ".pdfwrap": element("pdfwrap") };
  document.querySelector = selector => background[selector];
  const ctx = {
    document,
    window: { innerHeight: 800, visualViewport: { height: 800, offsetTop: 0, scale: 1 } },
    mobileLayout: { matches: true },
    panel: element("panel"), closePanelButton: element("close", true),
    fab: element("fab"), panelReturnFocus: null, manifestReady: true
  };
  ctx.panel.classList.add("hidden");
  const robot = element("questionRobot");
  robot.focus();
  vm.createContext(ctx);
  vm.runInContext(syncSource + "\n" + panelSource, ctx);
  return { ctx, background, robot, element };
}

test("opening and closing phone help restores worksheet access and the triggering focus", () => {
  const { ctx, background, robot, element } = fixture();
  ctx.openNoamPanel();
  assert.equal(ctx.panel.attributes.role, "dialog");
  assert.equal(ctx.panel.attributes["aria-modal"], "true");
  assert.equal(background[".bar"].inert, true);
  assert.equal(background[".pdfwrap"].inert, true);
  assert.equal(ctx.document.body.classList.contains("noam-panel-open"), true);
  assert.equal(ctx.document.activeElement, ctx.closePanelButton);
  element("noamQuestion", true).focus();
  ctx.closeNoamPanel();
  assert.equal(ctx.panel.classList.contains("hidden"), true);
  assert.equal(background[".bar"].inert, false);
  assert.equal(background[".pdfwrap"].inert, false);
  assert.equal(ctx.document.body.classList.contains("noam-panel-open"), false);
  assert.equal(ctx.panel.attributes["aria-modal"], undefined);
  assert.equal(ctx.fab.classList.contains("hidden"), false);
  assert.equal(ctx.document.activeElement, robot);
});

test("expanding to desktop releases the background while leaving help open", () => {
  const { ctx, background } = fixture();
  ctx.openNoamPanel();
  ctx.mobileLayout.matches = false;
  ctx.syncMobilePanel();
  assert.equal(ctx.panel.classList.contains("hidden"), false);
  assert.equal(ctx.panel.attributes.role, undefined);
  assert.equal(ctx.panel.attributes["aria-modal"], undefined);
  assert.equal(background[".bar"].inert, false);
  assert.equal(background[".pdfwrap"].inert, false);
  assert.equal(ctx.closePanelButton.attributes["aria-label"], "סגירה");
});

test("keyboard viewport follows available height and offset without treating pinch zoom as a keyboard", () => {
  const { ctx, element } = fixture();
  ctx.openNoamPanel();
  element("noamQuestion", true).focus();
  ctx.window.visualViewport = { height: 318, offsetTop: 127, scale: 1 };
  ctx.syncMobilePanel();
  assert.equal(ctx.panel.variables["--noam-viewport-height"], "318px");
  assert.equal(ctx.panel.variables["--noam-viewport-top"], "127px");
  assert.equal(ctx.document.body.variables["--noam-keyboard-gap"], "355px");
  assert.equal(ctx.panel.classList.contains("is-short"), true);
  assert.equal(ctx.panel.classList.contains("is-typing"), true);
  ctx.window.visualViewport.scale = 2;
  ctx.syncMobilePanel();
  assert.equal(ctx.panel.variables["--noam-viewport-height"], "800px");
  assert.equal(ctx.panel.variables["--noam-viewport-top"], "0px");
  assert.equal(ctx.document.body.variables["--noam-keyboard-gap"], "0px");
});
