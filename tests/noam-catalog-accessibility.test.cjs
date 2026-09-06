"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function fixture() {
  const elements = new Map(), timers = new Map(), scrolls = [];
  let nextTimer = 0;
  const document = { activeElement: null, referrer: "", documentElement: { scrollHeight: 1000, classList: { add() {} } } };
  function element(id = "", className = "") {
    const item = {
      id, className, dataset: {}, attributes: {}, children: [], listeners: {}, textContent: "", writes: 0,
      classList: { toggle() {} },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === "id") { this.id = value; elements.set(value, this); }
        if (name === "class") this.className = value;
        if (name === "tabindex") this.tabIndex = Number(value);
        if (name.startsWith("data-")) this.dataset[name.slice(5)] = value;
      },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      querySelectorAll(selector) { return this.children.filter(child => child.className.split(" ").includes(selector.slice(1))); },
      closest(selector) { return this.className.split(" ").includes(selector.slice(1)) ? this : null; },
      focus() { document.activeElement = this; }
    };
    Object.defineProperty(item, "innerHTML", {
      get() { return this.html || ""; },
      set(value) {
        this.html = value; this.writes++;
        this.children = [...value.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => {
          const child = element();
          for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(attr[1], attr[2]);
          child.textContent = match[2];
          return child;
        });
      }
    });
    if (id) elements.set(id, item);
    return item;
  }
  const markup = html.slice(0, html.indexOf("<script>"));
  for (const match of markup.matchAll(/\bid="([^"]+)"/g)) element(match[1]);
  elements.get("trackbar").innerHTML = markup.match(/<div class="trackbar"[^>]*>([\s\S]*?)<\/div>/)[1];
  document.getElementById = id => elements.get(id);
  document.querySelectorAll = () => [];
  const location = { href: "https://example.test/worksheetsfor7thgrade" };
  const ctx = {
    document, location,
    window: { parent: { location, postMessage() {} }, addEventListener() {}, scrollTo: options => scrolls.push(options), matchMedia: () => ({ matches: false }) },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame() {}
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const tabs = () => elements.get("grades").children;
  function key(grade, value, modifiers = {}) {
    const button = elements.get("grade-tab-" + grade);
    button.focus();
    const event = { target: button, key: value, prevented: false, preventDefault() { this.prevented = true; }, ...modifiers };
    elements.get("grades").listeners.keydown(event);
    return event;
  }
  function flush() {
    const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn());
  }
  return { ctx, document, elements, tabs, key, timers, flush, scrolls };
}

test("grade tabs have one tab stop, a labelled results panel, and stable nodes during selection", () => {
  const f = fixture(), original = f.tabs();
  assert.equal(original.length, 9);
  assert.deepEqual(original.filter(tab => tab.tabIndex === 0).map(tab => tab.dataset.grade), ["7"]);
  assert.equal(f.elements.get("list").attributes["aria-labelledby"], "grade-tab-7");
  original[7].focus();
  f.elements.get("grades").listeners.click({ target: original[7] });
  assert.equal(f.ctx.state.grade, 8);
  assert.equal(f.tabs(), original, "switching grades must not remove the focused tab");
  assert.equal(f.document.activeElement, original[7]);
  assert.deepEqual(original.filter(tab => tab.tabIndex === 0).map(tab => tab.dataset.grade), ["8"]);
  assert.equal(f.elements.get("list").attributes["aria-labelledby"], "grade-tab-8");
  assert.ok(original.every(tab => tab.attributes["aria-controls"] === "list"));
});

test("RTL arrows wrap, Home/End reach edge grades, and browser/scroll keys are untouched", () => {
  const f = fixture();
  assert.equal(f.key(7, "ArrowLeft").prevented, true);
  assert.equal(f.ctx.state.grade, 8);
  assert.equal(f.document.activeElement.id, "grade-tab-8");
  f.key(8, "ArrowRight"); assert.equal(f.ctx.state.grade, 7);
  f.key(7, "Home"); assert.equal(f.ctx.state.grade, 1);
  f.key(1, "ArrowRight"); assert.equal(f.ctx.state.grade, 9);
  f.key(9, "ArrowLeft"); assert.equal(f.ctx.state.grade, 1);
  f.key(1, "End"); assert.equal(f.ctx.state.grade, 9);
  for (const key of ["ArrowDown", "ArrowUp", "Tab", "Escape"]) assert.equal(f.key(9, key).prevented, false);
  assert.equal(f.key(9, "ArrowLeft", { altKey: true }).prevented, false);
  assert.equal(f.ctx.state.grade, 9);
});

test("track filter state resets visibly and accessibly when returning to grade9", () => {
  const f = fixture(); f.ctx.goToGrade(9);
  const bar = f.elements.get("trackbar"), [regular, reduced] = bar.children;
  bar.listeners.click({ target: reduced });
  assert.equal(f.ctx.state.track, "red");
  assert.equal(reduced.attributes["aria-pressed"], "true");
  f.ctx.goToGrade(7); assert.equal(bar.hidden, true);
  f.ctx.goToGrade(9); assert.equal(bar.hidden, false);
  assert.equal(f.ctx.state.track, "reg");
  assert.equal(regular.attributes["aria-pressed"], "true");
  assert.equal(reduced.attributes["aria-pressed"], "false");
});

test("rapid search updates announce only the latest result and do not move focus", () => {
  const f = fixture(), search = f.elements.get("q"), status = f.elements.get("results-status");
  f.flush(); search.focus();
  search.value = "no-result-xyz"; search.listeners.input({ target: search });
  search.value = "זוויות"; search.listeners.input({ target: search });
  assert.equal(f.timers.size, 1);
  f.flush();
  assert.match(status.textContent, /^נמצאו \d+ נושאים.*זוויות/);
  assert.equal(f.document.activeElement, search);
  search.value = "no-result-xyz"; search.listeners.input({ target: search }); f.flush();
  assert.match(status.textContent, /^לא נמצאו נושאים/);
  assert.match(f.elements.get("list").innerHTML, /אין נושא שמתאים לחיפוש/);
});

test("topic filtering keeps its focused chip and cross-grade results retain the tab relationship with a scope label", () => {
  const f = fixture(), chips = f.elements.get("chips"), original = chips.children, chip = original[1];
  chip.focus(); chips.listeners.click.call(chips, { target: chip });
  assert.equal(chips.children, original);
  assert.equal(f.document.activeElement, chip);
  assert.equal(chip.attributes["aria-pressed"], "true");
  const search = f.elements.get("q"), cross = f.elements.get("crossq");
  search.value = "זוויות"; search.listeners.input({ target: search });
  cross.checked = true; cross.listeners.change({ target: cross });
  assert.equal(f.elements.get("list").attributes["aria-labelledby"], "grade-tab-7 results-scope");
  search.value = ""; search.listeners.input({ target: search });
  assert.equal(f.elements.get("list").attributes["aria-labelledby"], "grade-tab-7");
});

test("bottom grade shortcuts restore useful focus and honor reduced motion", () => {
  const f = fixture(); f.ctx.window.matchMedia = () => ({ matches: true });
  const jump = f.elements.get("jump"), button = jump.children[0];
  button.focus(); jump.listeners.click({ target: button });
  assert.equal(f.document.activeElement.id, "grade-tab-1");
  assert.equal(f.scrolls.at(-1).behavior, "auto");
});

test("the skip destination is focusable and the catalog has a named main landmark and polite status", () => {
  assert.match(html, /<a class="skip-link" href="#list">דילוג לדפי העבודה<\/a>/);
  assert.match(html, /<main class="wrap" id="wrap" aria-labelledby="title">/);
  assert.match(html, /<div id="list" role="tabpanel" tabindex="0">/);
  assert.match(html, /id="results-status" role="status" aria-live="polite" aria-atomic="true"/);
});

function luminance(hex) {
  const value = hex.slice(1).length === 3 ? hex.slice(1).split("").map(c => c + c).join("") : hex.slice(1);
  const rgb = value.match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function ratio(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test("all grade palettes meet text contrast for selected controls, search placeholders and grade badges", () => {
  const props = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[\da-f]+)/gi)].map(m => [m[1], m[2]]));
  const defaults = props(html.match(/:root\{([^}]+)\}/)[1]);
  for (let grade = 1; grade <= 9; grade++) {
    const start = html.indexOf('.wrap[data-grade="' + grade + '"],');
    const palette = { ...defaults, ...props(html.slice(start, html.indexOf("}", start))) };
    assert.ok(ratio(palette["on-accent"], palette.accent) >= 4.5, "selected control text in grade " + grade);
    assert.ok(ratio(palette.muted, palette.paper) >= 4.5, "search placeholder in grade " + grade);
    assert.ok(ratio(grade === 8 ? palette["accent-dark"] : palette.accent, "#fff") >= 3, "large grade badge in grade " + grade);
  }
  assert.match(html, /\.search input::placeholder\{ color:var\(--muted\)/);
  assert.match(html, /\.wrap\[data-grade="8"\] \.gbadge\{ color:var\(--accent-dark\)/);
});
