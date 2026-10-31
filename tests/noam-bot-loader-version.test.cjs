"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sdk = require("../noam-bot-client.js");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const version = "20261031-browser-error";

function loader(file, kind, initialSdk, keepOld = false) {
  const source = read(file), scripts = [];
  const start = source.indexOf(kind === "teacher" ? "function ensureTeacherBotClient()" : "  function botClientSrc()");
  const end = source.indexOf(kind === "teacher" ? "const QUESTION_ROLES" : "  form.addEventListener", start);
  assert.ok(start >= 0 && end > start);
  const window = { NoamBotClient: initialSdk };
  const document = {
    createElement() { return {}; },
    getElementsByTagName() { return [{ getAttribute: () => "/assets/noam-site-companion.js?v=" + version + "#loaded" }]; },
    head: { appendChild(script) {
      scripts.push(script);
      queueMicrotask(() => {
        if (!keepOld) window.NoamBotClient = sdk;
        script.onload();
      });
    } }
  };
  const context = { window, document };
  const prefix = kind === "teacher"
    ? "let teacherBotClientPromise = null;"
    : "var botClientPromise = null, API_BASE = '/api', FALLBACK = 'unavailable';";
  const fn = vm.runInNewContext(prefix + source.slice(start, end) +
    (kind === "teacher" ? "\nensureTeacherBotClient" : "\nensureBotClient"), context);
  return { run: fn, scripts };
}

test("both SDK entry points publish the required version", () => {
  assert.equal(sdk.version, version);
  const module = { exports: {} };
  vm.runInNewContext(read("headless/astro-poc/public/noam-bot-client.js"), { module, setTimeout, clearTimeout });
  assert.equal(module.exports.version, version);
});

for (const [file, kind] of [
  ["demos/teacher-factoring-print.js", "teacher"],
  ["headless/astro-poc/public/teachers/teacher-factoring-print.js", "teacher"],
  ["noam-site-companion.js", "companion"],
  ["headless/astro-poc/public/noam-site-companion.js", "companion"]
]) {
  test(`${file}: an old page-global SDK is upgraded before it can create a client`, async () => {
    let oldCreates = 0;
    const old = { create() { oldCreates += 1; return {}; } };
    const h = loader(file, kind, old);
    const client = await h.run();
    assert.equal(oldCreates, 0);
    assert.equal(typeof client.prepare, "function");
    assert.equal(h.scripts.length, 1);
    const url = new URL(h.scripts[0].src, "https://example.test");
    assert.equal(url.search, "?v=" + version);
    assert.equal(url.hash, "");
    assert.ok(url.pathname.endsWith("/noam-bot-client.js"));
  });

  test(`${file}: the current SDK is reused without loading another copy`, async () => {
    const h = loader(file, kind, sdk);
    assert.equal(typeof (await h.run()).prepare, "function");
    assert.equal(h.scripts.length, 0);
  });

  test(`${file}: a stale script response cannot silently retain the old SDK`, async () => {
    const h = loader(file, kind, { create() { throw new Error("old SDK must not run"); } }, true);
    await assert.rejects(h.run());
    assert.equal(h.scripts.length, 1);
  });
}

for (const file of ["demos/teacher-practice-picker-site-style.html", "headless/astro-poc/public/teachers/index.html"]) {
  test(`${file}: teacher and companion scripts use their independently current cache versions`, () => {
    const html = read(file);
    for (const [asset, expectedVersion] of [
      ["teacher-factoring-print.js", "20261031-plan-recovery"],
      ["noam-site-companion.js", version]
    ]) {
      const escaped = asset.replaceAll(".", "\\.");
      assert.match(html, new RegExp('src="[^"]*' + escaped + '\\?v=' + expectedVersion + '"'));
      assert.doesNotMatch(html, new RegExp('src="[^"]*' + escaped + '"'));
    }
  });
}
