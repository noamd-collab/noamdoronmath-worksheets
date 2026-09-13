"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const viewer = fs.readFileSync(path.join(__dirname, "../worksheet-viewer-noam.html"), "utf8");
const mediaSource = viewer.match(/var mobileLayout = [^;]+;/)[0];
const source = viewer.slice(viewer.indexOf("var noamNarrowPinsMedia ="), viewer.indexOf("\nif (window.MutationObserver)"));

function button() {
  const item = { className: "", dataset: {}, style: {}, attributes: {}, listeners: {} };
  item.classList = {
    add: name => { item.className = [...new Set(item.className.split(/\s+/).filter(Boolean).concat(name))].join(" "); },
    remove: (...names) => { item.className = item.className.split(/\s+/).filter(value => !names.includes(value)).join(" "); },
    contains: name => item.className.split(/\s+/).includes(name)
  };
  item.setAttribute = (name, value) => { item.attributes[name] = value; };
  item.getAttribute = name => item.attributes[name];
  item.addEventListener = (name, callback) => { item.listeners[name] = callback; };
  item.click = () => item.listeners.click({ preventDefault() {}, stopPropagation() {} });
  item.remove = () => { item.parent.children = item.parent.children.filter(child => child !== item); };
  return item;
}

function fixture(exercises, narrow = true, pageHeight = 500, legacyMedia = false) {
  const pages = new Map();
  exercises.forEach(exercise => {
    const page = exercise.pin.page;
    if (!pages.has(page)) pages.set(page, { clientHeight: pageHeight, children: [], appendChild(item) { item.parent = this; this.children.push(item); } });
  });
  const viewportWidth = narrow ? 390 : 901;
  const media = { matches: narrow };
  if (legacyMedia) media.addListener = callback => { media.onChange = callback; };
  else media.addEventListener = (name, callback) => { assert.equal(name, "change"); media.onChange = callback; };
  const picker = { ...button(), buttons: [], querySelectorAll: () => picker.buttons };
  Object.defineProperty(picker, "innerHTML", { set(html) {
    picker.html = html;
    picker.buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => {
      const item = button();
      for (const attribute of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) item.setAttribute(attribute[1], attribute[2]);
      item.textContent = match[2];
      return item;
    });
  } });
  const selections = [];
  const ctx = {
    window: { innerWidth: viewportWidth, matchMedia: query => {
      media.maxWidth = Number(query.match(/^\(max-width:(\d+)px\)$/)[1]);
      media.matches = viewportWidth <= media.maxWidth;
      return media;
    } },
    document: { createElement: tag => {
      assert.equal(tag, "button");
      const item = button();
      item.focus = () => { ctx.document.activeElement = item; };
      return item;
    } },
    manifestReady: true, manifest: { exercises }, selectedExercise: null, selectedPin: null,
    panelBack: {}, panelBody: picker, openings: 0,
    pdfScroll: { clientWidth: viewportWidth }, pdfLastWidth: viewportWidth,
    pdfResetCount: 0, toolsVisible: !narrow,
    showPdfTools: visible => { ctx.toolsVisible = visible; },
    resetPdfRendering: () => { ctx.pdfResetCount++; },
    pdfPages: {
      querySelectorAll: selector => [...pages.values()].flatMap(page => page.children)
        .filter(item => !selector || selector.split(",").some(part => {
          const match = part.trim().match(/^\.([\w-]+)/);
          return !match || item.classList.contains(match[1]);
        })),
      querySelector: selector => pages.get(Number(selector.match(/data-page="(\d+)"/)[1]))
    },
    exerciseLabel: exercise => "שאלה " + exercise.q + (exercise.part ? " · סעיף " + exercise.part : ""),
    esc: String, escAttr: String,
    openNoamPanel: () => { ctx.openings++; },
    selectManifestExercise: (exercise, pin) => {
      ctx.selectedExercise = exercise; ctx.selectedPin = pin; selections.push({ exercise, pin });
    }
  };
  vm.createContext(ctx);
  vm.runInContext(mediaSource + "\n" + source, ctx);
  return { ctx, media, pages, picker, selections,
    pins: () => [...pages.values()].flatMap(page => page.children)
      .filter(pin => pin.classList.contains("noam-exercise-pin")),
    reports: () => [...pages.values()].flatMap(page => page.children)
      .filter(pin => pin.classList.contains("noam-report-pin")),
    resize(width) {
      const wasMobile = media.matches;
      ctx.window.innerWidth = width;
      ctx.pdfScroll.clientWidth = width;
      media.matches = width <= media.maxWidth;
      if (media.matches !== wasMobile) media.onChange();
    },
  };
}

const parts = [
  { id: "q1a", q: 1, part: "א", pin: { page: 1, x: .85, y: .2 } },
  { id: "q1b", q: 1, part: "ב", pin: { page: 1, x: .85, y: .24 } },
  { id: "q1c", q: 1, part: "ג", pin: { page: 2, x: .85, y: .1 } },
  { id: "q2", q: 2, part: "", pin: { page: 2, x: .92, y: .4 } }
];

test("phone robots group by both question and page, anchored at the first part", () => {
  const f = fixture(parts);
  f.ctx.renderManifestPins();
  assert.equal(f.pins().length, 3);
  assert.equal(f.pins()[0].dataset.exerciseIds, "q1a q1b");
  assert.equal(f.pins()[0].style.top, "100px");
  assert.equal(f.pins()[0].style.left, "calc(100% + 26px)");
  assert.ok(f.pins().every(pin => pin.classList.contains("noam-question-pin")));
  assert.match(f.pins()[0].attributes["aria-label"], /שאלה 1.*בחירת/);
});

test("every Noam AI target gets a separate feedback target", () => {
  const f = fixture(parts);
  const reports = [];
  f.ctx.showFeedbackPicker = exercises => reports.push(exercises.map(exercise => exercise.id));
  f.ctx.renderManifestPins();
  assert.equal(f.reports().length, f.pins().length);
  assert.equal(f.reports()[0].attributes["aria-label"], "דיווח על שאלה 1 · בחירת שאלה וסעיף");
  assert.equal(f.reports()[2].attributes["aria-label"], "דיווח על שאלה 2");
  f.reports()[0].click();
  assert.deepEqual([...reports[0]], ["q1a", "q1b"]);
});

test("group selection opens accessible part choices without choosing or requesting AI prematurely", () => {
  const f = fixture(parts);
  f.ctx.renderManifestPins();
  const pin = f.pins()[0];
  f.picker.classList.add("is-chat");
  f.picker.classList.add("is-previewing");
  pin.click();
  assert.equal(f.ctx.openings, 1);
  assert.equal(f.selections.length, 0);
  assert.equal(f.picker.buttons.length, 2);
  assert.equal(f.picker.buttons[1].attributes["aria-label"], "שאלה 1 · סעיף ב");
  assert.equal(f.ctx.panelBack.hidden, false);
  assert.equal(f.picker.classList.contains("is-chat"), false);
  assert.equal(f.picker.classList.contains("is-previewing"), false);
  f.picker.buttons[1].click();
  assert.equal(f.selections[0].exercise.id, "q1b");
  assert.equal(f.selections[0].pin, pin);
});

test("single-part phone robots open the existing question flow directly", () => {
  const f = fixture(parts);
  f.ctx.renderManifestPins();
  f.pins()[2].click();
  assert.equal(f.selections[0].exercise.id, "q2");
  assert.equal(f.picker.buttons.length, 0);
});

test("crossing the breakpoint restores exact per-part desktop robots and selected-part highlighting", () => {
  const f = fixture(parts);
  f.ctx.selectedExercise = parts[1];
  f.ctx.renderManifestPins();
  assert.equal(f.ctx.selectedPin.dataset.exerciseIds, "q1a q1b");
  f.media.matches = false;
  f.media.onChange();
  assert.equal(f.pins().length, parts.length);
  assert.equal(f.ctx.selectedPin.dataset.exerciseId, "q1b");
  assert.equal(f.pins().filter(pin => pin.classList.contains("is-active")).length, 1);
  assert.ok(f.pins().every(pin => !pin.classList.contains("noam-question-pin")));
  assert.ok(f.pins().every(pin => pin.style.left.includes("+ 52px")));
});

test("a one-pixel crossing from 901 to 900 redraws the PDF and keeps every part reachable", () => {
  const f = fixture(parts, false);
  f.ctx.selectedExercise = parts[1];
  f.ctx.renderManifestPins();
  assert.equal(f.ctx.mobileLayout, f.ctx.noamNarrowPinsMedia, "panel and pin modes share the same media query");
  assert.equal(f.ctx.toolsVisible, true);
  assert.equal(f.pins().length, parts.length);
  f.resize(900);
  assert.equal(f.ctx.pdfResetCount, 1, "mode change must bypass the ordinary <3px resize tolerance");
  assert.equal(f.ctx.pdfLastWidth, 900);
  assert.equal(f.ctx.toolsVisible, false, "phone tools start closed");
  assert.ok(f.pins().every(pin => pin.classList.contains("noam-question-pin")));
  assert.deepEqual(f.pins().flatMap(pin => pin.dataset.exerciseIds.split(" ")).sort(), parts.map(part => part.id).sort());
  assert.equal(f.ctx.selectedPin.dataset.exerciseIds, "q1a q1b");
  f.resize(901);
  assert.equal(f.ctx.pdfResetCount, 2);
  assert.equal(f.ctx.toolsVisible, true);
  assert.equal(f.ctx.selectedPin.dataset.exerciseId, "q1b");
});

test("landscape phone widths retain grouped targets and legacy media listeners still refresh them", () => {
  const f = fixture(parts, false, 500, true);
  f.ctx.renderManifestPins();
  f.resize(844);
  assert.equal(f.ctx.pdfResetCount, 1);
  assert.equal(f.ctx.toolsVisible, false);
  assert.ok(f.pins().every(pin => pin.classList.contains("noam-question-pin")));
  assert.deepEqual(f.pins().flatMap(pin => pin.dataset.exerciseIds.split(" ")).sort(), parts.map(part => part.id).sort());
});

test("an open group picker keeps its active robot through responsive rebuilding", () => {
  const f = fixture(parts);
  f.ctx.renderManifestPins();
  f.pins()[0].click();
  f.media.matches = false;
  f.media.onChange();
  assert.equal(f.pins().filter(pin => pin.classList.contains("is-active")).length, 1);
  f.picker.buttons[1].click();
  assert.equal(f.selections[0].exercise.id, "q1b");
  assert.equal(f.selections[0].pin.dataset.exerciseId, "q1b");
});

test("the reported division worksheets keep every part reachable after grouping", () => {
  for (const hash of ["0a5c457239e84a3591baf1b6415f58fa", "18fbe974ec364f43b9eba4f385144af0", "35a728b150764a5595819565c5a84cf9"]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../noam-ai/manifests/" + hash + ".json"), "utf8"));
    const f = fixture(manifest.exercises);
    f.ctx.renderManifestPins();
    const reachable = f.pins().flatMap(pin => pin.dataset.exerciseIds.split(" "));
    assert.deepEqual(reachable.sort(), manifest.exercises.map(exercise => exercise.id).sort());
    assert.ok(f.pins().length <= new Set(manifest.exercises.map(exercise => exercise.pin.page + ":" + exercise.q)).size);
  }
});

test("nearby questions share a robot with unambiguous question and part choices", () => {
  const exercises = [parts[0], parts[1], { ...parts[3], pin: { page: 1, x: .92, y: .25 } }];
  const f = fixture(exercises);
  f.ctx.renderManifestPins();
  assert.equal(f.pins().length, 1);
  assert.match(f.pins()[0].attributes["aria-label"], /שאלות 1, 2/);
  f.pins()[0].click();
  assert.equal(f.picker.buttons[0].textContent, "שאלה 1 · סעיף א");
  assert.equal(f.picker.buttons[2].textContent, "שאלה 2");
  f.picker.buttons[2].click();
  assert.equal(f.selections[0].exercise.id, "q2");
});

test("small rendered pages, including a real 14-question page, keep every target separated and every exercise reachable", () => {
  const hashes = [
    "0a5c457239e84a3591baf1b6415f58fa", "18fbe974ec364f43b9eba4f385144af0",
    "35a728b150764a5595819565c5a84cf9", "e8b13d00bacd4785a129755e31070e31"
  ];
  for (const height of [240, 280, 350, 240 * 297 / 210, 280 * 297 / 210, 350 * 297 / 210]) {
    for (const hash of hashes) {
      const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../noam-ai/manifests/" + hash + ".json"), "utf8"));
      const f = fixture(manifest.exercises, true, height);
      f.ctx.renderManifestPins();
      const reachable = f.pins().flatMap(pin => pin.dataset.exerciseIds.split(" "));
      assert.deepEqual(reachable.sort(), manifest.exercises.map(exercise => exercise.id).sort());
      for (const page of f.pages.values()) {
        const centers = page.children.filter(pin => pin.classList.contains("noam-exercise-pin"))
          .map(pin => parseFloat(pin.style.top)).sort((a, b) => a - b);
        centers.forEach((center, index) => {
          assert.ok(center >= 22 && center <= height - 22, "44px target remains within the page height");
          if (index) assert.ok(center - centers[index - 1] >= 48 - 1e-8, "neighboring touch targets have at least4px space");
        });
      }
    }
  }
});

test("rendering at a new zoom height rebuilds clusters without stale pins or lost selection", () => {
  const exercises = [parts[0], { ...parts[3], pin: { page: 1, x: .92, y: .3 } }];
  const f = fixture(exercises, true, 500);
  f.ctx.selectedExercise = exercises[1];
  f.ctx.renderManifestPins();
  assert.equal(f.pins().length, 2);
  f.pages.get(1).clientHeight = 280;
  f.ctx.renderManifestPins();
  assert.equal(f.pins().length, 1);
  assert.equal(f.ctx.selectedPin.dataset.exerciseIds, "q1a q2");
  f.pages.get(1).clientHeight = 800;
  f.ctx.renderManifestPins();
  assert.equal(f.pins().length, 2);
  assert.equal(f.ctx.selectedPin.dataset.exerciseId, "q2");
});

test("every installed worksheet keeps all questions reachable with separated phone targets", () => {
  const directory = path.join(__dirname, "../noam-ai/manifests");
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".json"))) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
    if (!manifest.exercises || !manifest.exercises.length) continue;
    for (const height of [280, 500]) {
      const f = fixture(manifest.exercises, true, height);
      f.ctx.renderManifestPins();
      const reachable = f.pins().flatMap(pin => pin.dataset.exerciseIds.split(" "));
      assert.deepEqual(reachable.sort(), manifest.exercises.map(exercise => exercise.id).sort(), file);
      for (const page of f.pages.values()) {
        const centers = page.children.filter(pin => pin.classList.contains("noam-exercise-pin"))
          .map(pin => parseFloat(pin.style.top)).sort((a, b) => a - b);
        centers.forEach((center, index) => {
          assert.ok(center >= 22 && center <= height - 22, file + ": target within page");
          if (index) assert.ok(center - centers[index - 1] >= 48 - 1e-8, file + ": targets separated");
        });
      }
    }
  }
});


test("report focus survives lazy rerenders and question regrouping", () => {
  const f = fixture(parts, false);
  f.ctx.renderManifestPins();
  f.reports()[1].focus();
  const oldReport = f.ctx.document.activeElement;
  f.ctx.renderManifestPins();
  assert.notEqual(f.ctx.document.activeElement, oldReport);
  assert.equal(f.ctx.document.activeElement, f.reports()[1]);
  assert.match(f.ctx.document.activeElement.attributes["aria-label"], /שאלה 1.*סעיף ב/);
  f.resize(390);
  assert.ok(f.ctx.document.activeElement.classList.contains("noam-report-pin"));
  assert.equal(f.ctx.document.activeElement.dataset.exerciseIds, "q1a q1b");
});

// Evaluate the generated CSS coordinates independently at real rendered widths.
// Browser QA also checks actual element bounds and scroll-container clipping.
function cssPixels(value, pageWidth) {
  const expression = value.replace(/([\d.]+)%/g, (_, number) => String(Number(number) * pageWidth / 100))
    .replace(/px/g, "").replace(/calc\(/g, "(");
  return vm.runInNewContext(expression, { clamp: (min, value, max) => Math.max(min, Math.min(value, max)) });
}

test("desktop pairs retain a gap and stay inside the reserved gutter at narrow and wide PDF zooms", () => {
  const exercises = Array.from({ length: 99 }, (_, index) => ({
    id: "x" + index, q: index + 1, pin: { page: 1, x: (index + 1) / 100, y: .4 }
  }));
  const f = fixture(exercises, false);
  f.ctx.renderManifestPins();
  const desktopGutter = Number(viewer.match(/margin-right:(\d+)px;/)[1]);
  for (const width of [120, 240, 436, 500, 582, 654, 761, 1200, 1800]) {
    f.pins().forEach((pin, index) => {
      const ai = cssPixels(pin.style.left, width);
      const report = cssPixels(f.reports()[index].style.left, width);
      assert.ok(report - 12.5 - (ai + 14.5) >= 12.99, `width ${width}: pair keeps 13px gap`);
      assert.ok(ai - 14.5 >= 0, `width ${width}: AI stays within page left edge`);
      assert.ok(report + 12.5 <= width + desktopGutter, `width ${width}: report inside right gutter`);
    });
  }
});

test("mobile pairs fit the reserved gutter with a ten-pixel gap at every document zoom", () => {
  const f = fixture(parts);
  f.ctx.renderManifestPins();
  const mobileGutter = Number(viewer.match(/\.pdf-page\{width:calc\(100vw - \d+px\);min-height:0;margin-right:(\d+)px/)[1]);
  for (const width of [120, 185, 264, 316, 528, 792]) {
    const ai = cssPixels(f.pins()[0].style.left, width);
    const report = cssPixels(f.reports()[0].style.left, width);
    assert.ok(ai - 22 >= width, "AI never covers printed content");
    assert.equal(report - 18 - (ai + 22), 10);
    assert.ok(report + 18 <= width + mobileGutter, "report fits even at 100% and higher zoom");
  }
});


test("closing the feedback picker restores its opener after that report was rebuilt", () => {
  const f = fixture(parts);
  const events = {};
  Object.assign(f.ctx, {
    feedbackReturnExerciseId: null,
    feedbackDialog: {
      showModal() { this.open = true; },
      close() { this.open = false; events.close(); },
      addEventListener(name, listener) { events[name] = listener; }
    },
    feedbackContext: {}, feedbackClose: { addEventListener() {} },
    feedbackChoices: { appendChild() {}, querySelector() { return null; } },
    feedbackLocation: f.ctx.exerciseLabel
  });
  const pickerSource = viewer.slice(viewer.indexOf("function showFeedbackPicker(exercises){"), viewer.indexOf("\nfunction openNoamPanel(){"));
  vm.runInContext(pickerSource, f.ctx);
  f.ctx.renderManifestPins();
  f.reports()[0].focus();
  const opener = f.ctx.document.activeElement;
  f.ctx.showFeedbackPicker(parts.slice(0, 2));
  f.ctx.document.activeElement = f.ctx.feedbackDialog;
  f.ctx.renderManifestPins();
  f.ctx.feedbackDialog.close();
  assert.notEqual(f.ctx.document.activeElement, opener);
  assert.equal(f.ctx.document.activeElement, f.reports()[0]);
  assert.equal(f.ctx.feedbackReturnExerciseId, null);
});
