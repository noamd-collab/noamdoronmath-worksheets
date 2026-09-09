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
      id, className, dataset: {}, attributes: {}, children: [], listeners: {}, listenerOptions: {}, textContent: "", writes: 0,
      classList: { toggle() {} },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === "id") { this.id = value; elements.set(value, this); }
        if (name === "class") this.className = value;
        if (name === "tabindex") this.tabIndex = Number(value);
        if (name.startsWith("data-")) this.dataset[name.slice(5)] = value;
      },
      addEventListener(name, fn, options) { this.listeners[name] = fn; this.listenerOptions[name] = options; },
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

function renderedLinks(markup) {
  return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match => {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attr => [attr[1], attr[2].replace(/&amp;/g, "&")]));
    return { ...attributes, text: match[2].replace(/<[^>]+>/g, "") };
  });
}

// Synthetic worksheets isolate generic bundle behavior from catalog changes.
function bundleFixture() {
  const f = fixture();
  f.ctx.DATA[9].topics = [
    { id: 901, x: "G9-TEST-P", ic: "factor", g: "alg", t: "פירוק לגורמים", d: "תרגול פירוק" },
    { id: 902, x: "G9-TEST-C1", parent: 901, aLabel: "גורם משותף · רמה א׳", ic: "factor", g: "alg", t: "הוצאת גורם משותף", d: "מחוץ לסוגריים" },
    { id: 903, x: "G9-TEST-C2", parent: 901, aLabel: "כפל מקוצר וטרינום · רמה א׳", ic: "factor", g: "alg", t: "כפל מקוצר וטרינום" },
    { id: 904, x: "G9-TEST-C3", parent: 901, cLabel: "פירוק מלא ומשוואות · רמת מצוינות", ic: "factor", g: "alg", t: "פירוק מלא ומשוואות" }
  ];
  f.ctx.DATA[9].links = {
    901: { a: "fixture-parent-a", b: "fixture-parent-b", c: "fixture-parent-c" },
    902: { a: "fixture-child-1-a" },
    903: { a: "fixture-child-2-a" },
    904: { c: "fixture-child-3-c" }
  };
  f.ctx._hayCache = {};
  return f;
}

test("a worksheet bundle renders once with primary PDFs and a native disclosure for original levels", () => {
  const f = bundleFixture(); f.ctx.goToGrade(9);
  const familyIds = [901, 902, 903, 904];
  assert.deepEqual(Array.from(f.ctx.matchesIn(9, true)).filter(topic => familyIds.includes(topic.id)).map(topic => topic.id), [901]);
  const cards = [...f.elements.get("list").innerHTML.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
  const familyCards = cards.filter(card => /[?&]x=G9-TEST-(?:P|C[123])&/.test(card));
  assert.equal(familyCards.length, 1);
  const card = familyCards[0];
  assert.match(card, /<h4>פירוק לגורמים<span\b/);
  const disclosure = card.match(/<details\b([^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(disclosure, "original worksheets stay accessible through a native keyboard-operable disclosure");
  assert.doesNotMatch(disclosure[1], /\bopen(?:\s|=|$)/);
  assert.match(disclosure[2], /<summary\b[^>]*>תרגול נוסף לפי רמות<\/summary>/);
  const primary = renderedLinks(card.replace(disclosure[0], ""));
  assert.deepEqual(primary.map(link => new URL(link.href, "https://example.test/").searchParams.get("x")), ["G9-TEST-C1", "G9-TEST-C2", "G9-TEST-C3"]);
  assert.equal(renderedLinks(disclosure[2]).length, 3);
  assert.doesNotMatch(card, /lvl--soon|אין לינק כעת/);
});

test("a grouped card preserves each PDF's exact prefix, level and isolated sibling map", () => {
  const f = bundleFixture(), parent = f.ctx.DATA[9].topics.find(topic => topic.id === 901);
  const links = renderedLinks(f.ctx.cardHTML(parent, 9, 0));
  const original = {
    a: "fixture-parent-a",
    b: "fixture-parent-b",
    c: "fixture-parent-c"
  };
  const expected = [
    ["G9-TEST-C1", "a", "fixture-child-1-a", { a: "fixture-child-1-a" }],
    ["G9-TEST-C2", "a", "fixture-child-2-a", { a: "fixture-child-2-a" }],
    ["G9-TEST-C3", "c", "fixture-child-3-c", { c: "fixture-child-3-c" }],
    ...Object.entries(original).map(([level, pdf]) => ["G9-TEST-P", level, pdf, original])
  ];
  assert.equal(links.length, 6);
  assert.equal(new Set(links.map(link => link.href)).size, 6);
  const urls = links.map(link => new URL(link.href, "https://example.test/"));
  for (const [prefix, level, pdf, siblings] of expected) {
    const index = urls.findIndex(url => url.searchParams.get("pdf") === pdf);
    assert.ok(index >= 0, pdf + " remains accessible");
    const url = urls[index], link = links[index];
    assert.equal(url.pathname, "/worksheet-viewer-noam.html");
    assert.equal(url.searchParams.get("g"), "9");
    assert.equal(url.searchParams.get("x"), prefix);
    assert.equal(url.searchParams.get("lv"), level);
    for (const key of ["a", "b", "c"]) assert.equal(url.searchParams.get("p" + key), siblings[key] || null, prefix + " sibling " + key);
    const topic = f.ctx.DATA[9].topics.find(item => item.x === prefix);
    assert.equal(url.searchParams.get("t"), topic.t);
    assert.ok(link["aria-label"].includes(topic.t), "link has its own worksheet title");
    const label = {
      "G9-TEST-C1": "גורם משותף · רמה א׳",
      "G9-TEST-C2": "כפל מקוצר וטרינום · רמה א׳",
      "G9-TEST-C3": "פירוק מלא ומשוואות · רמת מצוינות"
    }[prefix] || (level === "c" ? "רמת מצוינות" : "רמה " + (level === "a" ? "א׳" : "ב׳"));
    assert.equal(link.text, label);
    assert.ok(link["aria-label"].includes(label));
    assert.equal(link.target, "_blank");
    assert.match(link.rel, /\bnoopener\b/);
  }
});

test("searching child worksheet content returns its parent once and obeys grade and group filters", () => {
  const f = bundleFixture(); f.ctx.goToGrade(9);
  for (const query of ["טרינום", "משוואות", "גורם משותף", "מחוץ לסוגריים"]) {
    f.ctx.state.q = query;
    const results = Array.from(f.ctx.matchesIn(9, true));
    assert.deepEqual(results.filter(topic => [901, 902, 903, 904].includes(topic.id)).map(topic => topic.id), [901], query);
  }
  f.ctx.state.group = "geo";
  assert.ok(!Array.from(f.ctx.matchesIn(9, true)).some(topic => topic.id === 901));
  f.ctx.state.group = "all";
  f.ctx.state.track = "red";
  assert.ok(!Array.from(f.ctx.matchesIn(9, true)).some(topic => topic.id === 901));
  f.ctx.state.track = "reg";
  f.ctx.state.q = "";
  for (let grade = 1; grade <= 8; grade++) {
    const topic = f.ctx.DATA[grade].topics.find(item => item.parent === undefined);
    const card = f.ctx.cardHTML(topic, grade, 0), row = f.ctx.DATA[grade].links[topic.id];
    assert.doesNotMatch(card, /<details\b|x=G9-TEST-/);
    assert.equal(renderedLinks(card).length, row.one !== undefined ? 1 : ["a", "b", "c"].filter(key => row[key]).length);
  }
});

test("the grade9 header counts a grouped topic once without promising unavailable levels", () => {
  const f = bundleFixture();
  f.ctx.DATA[9].topics.push({ id: 905, x: "G9-TEST-SINGLE", ic: "factor", g: "alg", t: "נושא נוסף" });
  f.ctx.DATA[9].links[905] = { b: "fixture-single-b" };
  f.ctx.goToGrade(9);
  assert.match(f.elements.get("lede").textContent, /^2 נושאים\./);
  assert.doesNotMatch(f.elements.get("lede").textContent, /שלוש|3 רמות/);
  for (const grade of [7, 8]) {
    f.ctx.goToGrade(grade);
    assert.ok(f.elements.get("lede").textContent.startsWith(f.ctx.DATA[grade].topics.length + " נושאים."));
  }
});

test("the catalog groups all factorization worksheets once and preserves their original PDF links", () => {
  const f = fixture(); f.ctx.goToGrade(9);
  const parent = f.ctx.DATA[9].topics.find(topic => topic.id === 2);
  assert.equal(parent.x, "G9-T03");
  assert.deepEqual(Array.from(f.ctx.topicChildren(9, parent)).map(topic => topic.id), [41, 42, 43]);
  assert.deepEqual(Array.from(f.ctx.matchesIn(9, true)).filter(topic => [2, 41, 42, 43].includes(topic.id)).map(topic => topic.id), [2]);
  const cards = [...f.elements.get("list").innerHTML.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
  assert.equal(cards.filter(card => /[?&]x=G9-T(?:03|41|42|43)&/.test(card)).length, 1);
  const card = f.ctx.cardHTML(parent, 9, 0), links = renderedLinks(card);
  assert.match(card, /<details\b/);
  assert.doesNotMatch(card, /lvl--soon/);
  assert.deepEqual(links.map(link => new URL(link.href, "https://example.test/").searchParams.get("pdf")), [
    "3f9546987fea4b9aa4294249ea017278", "3329215ba8e24999b3522228011baae2", "9764420460f84628acbffb2ea2ee53a5",
    "6a37fe7160324a17ad107b3dbe43c1db", "4008f04978f9488c85e916d69a753323", "43bd9f8b67bc40bc9f653764eba1a930"
  ]);
  assert.equal(new Set(links.map(link => link.href)).size, 6);
});

test("all six reported grade9 topics expose every level and preserve the exact sibling PDF map", () => {
  const f = fixture(); f.ctx.goToGrade(9);
  const expected = [
    [9, "G9-T10", ["31daf6adaab54967ab25cdcf14367728", "de61f3fb197e481796aa9ba2e98dc89a", "1481ffdfa63d416982e7ccbfe09bb71e"]],
    [40, "G9-T40", ["cbc951ad64d347099b1eaf5b10b34e7f", "5b1d05c4655144eba82e34199475706c", "a260c5eec7a84cf5929f89921d10dec8"]],
    [12, "G9-T12", ["a8ebcc5274e04de69ae964eb823e33a4", "fd50cac43f14444eabc6f685999ac05b", "453125b31ea24576910f04f190698bdc"]],
    [15, "G9-T08", ["ee0dffce722c4682bff4d4d9cb9ba435", "c02ba4059e964dacbda49a0dc501e05d", "2e4554c89aa9465ebb44e91b3ce0806f"]],
    [4, "G9-T15", ["34aa5bdaa1f640299cb058c576b4f3f4", "948a3944cc3245228f701c916681ac49", "d6ee4238793f49e881c9b2a70915efa6"]],
    [17, "G9-T05", ["4b7ef32fdaa04b8580e0cdbb46e4aa0d", "aa0ae3dc2ccf44c09ec54313391523fd", "3b9f18232fdc42f3bd8c0d9e236a16cd"]]
  ];
  const cards = [...f.elements.get("list").innerHTML.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
  for (const [id, prefix, pdfs] of expected) {
    const topic = f.ctx.DATA[9].topics.find(item => item.id === id);
    assert.equal(topic.x, prefix);
    const matchingCards = cards.filter(card => card.includes("x=" + prefix + "&"));
    assert.equal(matchingCards.length, 1, prefix + " renders once");
    const links = renderedLinks(matchingCards[0]);
    assert.deepEqual(links.map(link => link.text), ["רמה א׳", "רמה ב׳", "רמת מצוינות"], prefix + " level buttons");
    links.forEach((link, index) => {
      const url = new URL(link.href, "https://example.test/");
      assert.equal(url.searchParams.get("x"), prefix);
      assert.equal(url.searchParams.get("g"), "9");
      assert.equal(url.searchParams.get("lv"), ["a", "b", "c"][index]);
      assert.equal(url.searchParams.get("pdf"), pdfs[index]);
      ["a", "b", "c"].forEach((level, siblingIndex) => {
        assert.equal(url.searchParams.get("p" + level), pdfs[siblingIndex], prefix + " sibling " + level);
      });
    });
  }
});

test("expanding or collapsing original worksheets reports the new iframe height through captured toggle events", () => {
  const f = fixture(), list = f.elements.get("list"), messages = [];
  f.ctx.window.parent.postMessage = (message, origin) => messages.push({ ...message, origin });
  assert.equal(list.listenerOptions.toggle, true, "native details toggle needs capture because it does not bubble");
  const disclosure = { classList: { contains: name => name === "more-worksheets" } };
  f.document.documentElement.scrollHeight = 1200;
  list.listeners.toggle({ target: disclosure, newState: "open" });
  f.document.documentElement.scrollHeight = 1000;
  list.listeners.toggle({ target: disclosure, newState: "closed" });
  list.listeners.toggle({ target: { classList: { contains: () => false } } });
  assert.deepEqual(messages, [
    { type: "setHeight", height: 1200, origin: "*" },
    { type: "setHeight", height: 1000, origin: "*" }
  ]);
  assert.match(html, /\.more-worksheets summary:focus-visible\{/);
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
