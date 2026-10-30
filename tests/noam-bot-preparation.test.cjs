"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Google and HTTP are simulated. No provider, verification or model is called.
function page(file, behavior = {}) {
  const scripts = [], actions = [], posts = [], configs = [], warnings = [];
  let serial = 0;
  const win = { console: { warn(...args) { warnings.push(args); } } };
  const doc = {
    createElement() { return {}; },
    head: {
      appendChild(script) {
        scripts.push(script);
        script.parentNode = this;
        queueMicrotask(() => {
          win.grecaptcha = {
            ready(callback) { callback(); },
            async execute(key, details) {
              const call = { key, action: details.action, ordinal: ++serial };
              actions.push(call);
              if (behavior.execute) await behavior.execute(call);
              return "synthetic-token-" + call.ordinal;
            }
          };
          script.onload();
        });
      },
      removeChild(script) { script.parentNode = null; }
    }
  };
  function client(extra = {}) {
    // Load a separate factory each time, as can happen with two page widgets.
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      { module, setTimeout, clearTimeout }, { filename: file });
    const fetcher = async (url, init) => {
      if (url.endsWith("/noamBotConfig")) {
        configs.push(url);
        if (extra.config) return extra.config();
        return response(200, { ok: true, provider: "recaptcha-v3", mode: "enforce", siteKey: "synthetic-public-key" });
      }
      const body = JSON.parse(init.body);
      posts.push(body);
      return behavior.server ? behavior.server(body) : response(200, { ok: true });
    };
    return module.exports.create({
      api: "/api", enabled: extra.enabled !== false, window: win, document: doc,
      fetch: fetcher, networkRetryDelayMs: 0,
      verificationTimeoutMs: extra.timeout || 300
    });
  }
  return { client, win, scripts, actions, posts, configs, warnings };
}

for (const file of ["noam-bot-client.js", "headless/astro-poc/public/noam-bot-client.js"]) {
  test(`${file}: two clients prepare one shared SDK without creating a token or sending a model request`, async () => {
    const p = page(file);
    const first = p.client(), second = p.client();
    assert.deepEqual(await Promise.all([first.prepare(), second.prepare()]), [true, true]);
    assert.equal(p.scripts.length, 1);
    assert.equal(p.actions.length, 0);
    assert.equal(p.posts.length, 0);
    assert.equal(p.configs.length, 2);
    assert.deepEqual(p.warnings, []);
  });

  test(`${file}: prepared 5, 10 and 15 choices each get a new action token`, async () => {
    const p = page(file), first = p.client(), second = p.client();
    await first.prepare();
    for (const count of [5, 10, 15]) {
      await (count === 10 ? second : first).postJson("/api/noamSiteCompanion", { teacher: { count } });
    }
    assert.equal(p.scripts.length, 1);
    assert.deepEqual(p.posts.map(body => body.teacher.count), [5, 10, 15]);
    assert.equal(new Set(p.posts.map(body => body.botVerification.token)).size, 3);
    assert.deepEqual(p.actions.map(call => call.action), Array(3).fill("noam_site_companion"));
  });

  test(`${file}: one client's queued preparation timeout cannot erase another client's active SDK`, async () => {
    let finish;
    const p = page(file, { execute: () => new Promise(resolve => { finish = resolve; }) });
    const first = p.client(), second = p.client({ timeout: 30 });
    await first.prepare();
    const activeApi = p.win.grecaptcha;
    const request = first.postJson("/api/noamSiteCompanion", { teacher: { count: 5 } });
    while (!finish) await flush();
    await assert.rejects(second.prepare(), { code: "BOT_VERIFICATION_TIMEOUT" });
    assert.equal(p.win.grecaptcha, activeApi);
    assert.ok(p.scripts[0].parentNode);
    assert.equal(p.scripts.length, 1);
    assert.equal(p.actions.length, 1);
    finish();
    await request;
    assert.equal(p.posts.length, 1);
    assert.equal(await second.prepare(), true);
    assert.equal(p.scripts.length, 1);
    assert.equal(p.actions.length, 1);
  });

  test(`${file}: a second client's config timeout does not reset a prepared SDK`, async () => {
    const p = page(file), first = p.client();
    await first.prepare();
    const activeApi = p.win.grecaptcha;
    const second = p.client({ timeout: 20, config: () => new Promise(() => {}) });
    await assert.rejects(second.prepare(), { code: "BOT_VERIFICATION_TIMEOUT" });
    assert.equal(p.win.grecaptcha, activeApi);
    await first.postJson("/api/noamSiteCompanion", { teacher: { count: 10 } });
    assert.equal(p.scripts.length, 1);
    assert.equal(p.posts.length, 1);
  });

  test(`${file}: concurrent clients serialize token issuance while retaining distinct requests`, async () => {
    let active = 0, peak = 0;
    const p = page(file, { async execute() {
      active += 1; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
    } });
    const first = p.client(), second = p.client();
    await Promise.all([
      first.postJson("/api/noamSiteCompanion", { teacher: { count: 5 } }),
      second.postJson("/api/noamSiteCompanion", { teacher: { count: 15 } })
    ]);
    assert.equal(peak, 1);
    assert.equal(p.scripts.length, 1);
    assert.equal(p.posts.length, 2);
    assert.equal(new Set(p.posts.map(body => body.botVerification.token)).size, 2);
  });

  test(`${file}: preparation preserves a 403 denial and never retries it automatically`, async () => {
    const p = page(file, { server: () => response(403, { ok: false, code: "BOT_VERIFICATION_FAILED" }) });
    const client = p.client();
    await client.prepare();
    await assert.rejects(client.postJson("/api/noamSiteCompanion", { teacher: { count: 15 } }),
      error => error.code === "BOT_VERIFICATION_FAILED" && error.status === 403);
    assert.equal(p.posts.length, 1);
    assert.equal(p.actions.length, 1);
    assert.equal(p.scripts.length, 1);
  });

  test(`${file}: an expired execute result cannot change the next client's SDK or send a stale request`, async () => {
    let finishExpired;
    const p = page(file, { execute(call) {
      if (call.ordinal === 1) return new Promise(resolve => { finishExpired = resolve; });
    } });
    const first = p.client({ timeout: 40 }), second = p.client();
    await assert.rejects(first.postJson("/api/noamSiteCompanion", { teacher: { count: 5 } }),
      { code: "BOT_VERIFICATION_TIMEOUT" });
    await second.postJson("/api/noamSiteCompanion", { teacher: { count: 10 } });
    const currentApi = p.win.grecaptcha;
    assert.equal(p.posts.length, 1);
    assert.equal(p.posts[0].teacher.count, 10);
    finishExpired();
    await flush();
    assert.equal(p.win.grecaptcha, currentApi);
    assert.equal(p.posts.length, 1);
    assert.equal(p.actions.length, 2);
    await second.postJson("/api/noamSiteCompanion", { teacher: { count: 15 } });
    assert.equal(p.posts.length, 2);
    assert.equal(p.posts[1].teacher.count, 15);
    assert.equal(new Set(p.posts.map(body => body.botVerification.token)).size, 2);
  });

  test(`${file}: preparation of a disabled client does not load or request anything`, async () => {
    const p = page(file), client = p.client({ enabled: false });
    assert.equal(await client.prepare(), false);
    assert.equal(p.configs.length, 0);
    assert.equal(p.scripts.length, 0);
    assert.equal(p.actions.length, 0);
    assert.equal(p.posts.length, 0);
  });
}
