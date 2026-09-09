"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const approved = require("./fixtures/middle-school-levels.json");
const levels = ["a", "b", "c", "one"];

// Run the production catalog and link renderer without loading a browser or network.
function declaration(name, terminator) {
  const start = source.indexOf("var " + name + " = ");
  assert.notEqual(start, -1, "Missing catalog declaration: " + name);
  const end = source.indexOf(terminator, start);
  assert.ok(end > start, "Unterminated catalog declaration: " + name);
  return source.slice(start, end + terminator.length);
}

function productionFunction(name) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "Missing production renderer: " + name);
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, "Unterminated production renderer: " + name);
  return source.slice(start, end + 2);
}

const catalog = {};
vm.createContext(catalog);
for (const name of ["DATA", "NOAM_PREFIX_FALLBACK"]) {
  vm.runInContext(declaration(name, "\n};"), catalog);
}
for (const name of ["BASE", "VIEWER", "NO_LINK"]) {
  vm.runInContext(declaration(name, ";"), catalog);
}
vm.runInContext(declaration("LEVELS", "\n];"), catalog);
for (const name of ["url", "noamTopicPrefix", "sheetHref", "esc", "levelLinksHTML"]) {
  vm.runInContext(productionFunction(name), catalog);
}

function approvedTopics() {
  return Object.entries(approved.grades).flatMap(([grade, topics]) =>
    topics.map(topic => ({ grade: Number(grade), ...topic })));
}

function currentTopic(grade, item) {
  const topic = catalog.DATA[grade]?.topics.find(topic => topic.id === item.id);
  assert.ok(topic, `Missing grade ${grade} topic ${item.id}: ${item.title}`);
  return topic;
}

function renderedLinks(markup) {
  return [...markup.matchAll(/<a\b([^>]*)>[\s\S]*?<\/a>/g)].map(match =>
    Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute =>
      [attribute[1], attribute[2].replace(/&amp;/g, "&")])));
}

test("approved middle-school level mappings cannot silently disappear or change PDF", () => {
  assert.deepEqual(approved.expectedLinkCounts, { 7: 148, 8: 174, 9: 127 });
  for (const [grade, topics] of Object.entries(approved.grades)) {
    const count = topics.reduce((total, topic) => total + Object.keys(topic.links).length, 0);
    assert.equal(count, approved.expectedLinkCounts[grade], `Incomplete approved grade ${grade} fixture`);
    assert.equal(new Set(topics.map(topic => topic.id)).size, topics.length, "Duplicate fixture topic");
  }
  for (const item of approvedTopics()) {
    const topic = currentTopic(item.grade, item);
    assert.equal(catalog.noamTopicPrefix(topic, item.grade), item.prefix,
      `AI topic routing changed: grade ${item.grade}, topic ${item.id}`);
    for (const [level, pdf] of Object.entries(item.links)) {
      assert.ok(levels.includes(level), "Invalid fixture level: " + level);
      assert.equal(catalog.DATA[item.grade].links[item.id]?.[level], pdf,
        `Missing/replaced PDF: grade ${item.grade}, topic ${item.id}, level ${level}`);
    }
  }
});

test("each protected level renders its own AI viewer link with correct sibling levels", () => {
  for (const item of approvedTopics()) {
    const topic = currentTopic(item.grade, item);
    const row = catalog.DATA[item.grade].links[item.id];
    const rendered = renderedLinks(catalog.levelLinksHTML(topic, item.grade));
    for (const [level, pdf] of Object.entries(item.links)) {
      const viewerLevel = level === "one" ? "b" : level;
      // A PDF may legitimately be reused by another level or grade.
      const links = rendered.filter(link => {
        const params = new URL(link.href, "https://catalog.test/").searchParams;
        return params.get("pdf") === pdf && params.get("lv") === viewerLevel;
      });
      assert.equal(links.length, 1, `Expected one visible link: grade ${item.grade}, topic ${item.id}, level ${level}`);
      const link = links[0];
      const destination = new URL(link.href, "https://catalog.test/");
      assert.equal(destination.origin, "https://catalog.test");
      assert.equal(destination.pathname, "/worksheet-viewer-noam.html");
      assert.equal(destination.searchParams.get("g"), String(item.grade));
      assert.equal(destination.searchParams.get("x"), item.prefix);
      assert.equal(destination.searchParams.get("lv"), viewerLevel);
      assert.equal(destination.searchParams.get("t"), topic.t);
      for (const sibling of ["a", "b", "c"]) {
        assert.equal(destination.searchParams.get("p" + sibling), row[sibling] || null,
          `Wrong sibling ${sibling}: grade ${item.grade}, topic ${item.id}, level ${level}`);
      }
      assert.equal(link.target, "_blank");
      assert.ok(link.rel.split(/\s+/).includes("noopener"));
      assert.ok(link.rel.split(/\s+/).includes("noreferrer"));
      assert.ok(link["aria-label"], "Worksheet link needs an accessible name");
    }
  }
});

test("personal progress retains every protected worksheet and its exact PDF", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "noam-learning-catalog.js"), "utf8"), context);
  const generated = context.window.NOAM_LEARNING_CATALOG;
  assert.ok(Array.isArray(generated), "Missing generated learning catalog");
  assert.equal(new Set(generated.map(item => item.id)).size, generated.length, "Duplicate progress identifier");
  const byId = new Map(generated.map(item => [item.id, item]));
  for (const topic of approvedTopics()) {
    for (const [level, pdf] of Object.entries(topic.links)) {
      const id = `g${topic.grade}-t${topic.id}-${level}`;
      const item = byId.get(id);
      assert.ok(item, "Missing progress worksheet: " + id);
      assert.equal(item.pdf, pdf, "Progress PDF changed: " + id);
      assert.equal(item.g, topic.grade);
      assert.equal(item.t, topic.id);
      assert.equal(item.l, level);
      assert.equal(item.x, topic.prefix);
    }
  }
});
