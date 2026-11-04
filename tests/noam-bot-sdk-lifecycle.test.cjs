"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the actual script loader with synthetic Google/HTTP implementations.
// No network, CAPTCHA solving, provider requests or real credentials are used.
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const proof = () => ({ provider: "recaptcha-v2", siteKey: "synthetic-v2-public-key",
  requestToken: "synthetic-signed-ticket", expiresAt: Date.now() + 10000 });

function page(file, behavior = {}) {
  const scripts = [], posts = [], executions = [], renders = [], resets = [], warnings = [];
  const config = { clients: { existing: { fallback: "synthetic-google-client" } } };
  const win = { innerWidth: 390, console: { warn(...args) { warnings.push(args); } } };
  const api = {
    ready(callback) { if (behavior.ready) behavior.ready(callback); else callback(); },
    execute(key, details) {
      executions.push({ key, action: details.action });
      return behavior.execute ? behavior.execute(executions.length) : Promise.resolve("synthetic-fresh-token-" + executions.length);
    },
    render(container, options) {
      // Late Google callbacks rely on the original client registry remaining alive.
      assert.equal(win.grecaptcha, api);
      assert.equal(win.___grecaptcha_cfg, config);
      assert.equal(win.___grecaptcha_cfg.clients.existing.fallback, "synthetic-google-client");
      renders.push({ container, options });
      return renders.length - 1;
    },
    reset(id) { resets.push(id); }
  };
  const doc = { createElement: () => ({}), head: {
    appendChild(script) {
      scripts.push(script); script.parentNode = this;
      queueMicrotask(() => {
        if (behavior.failFirstScript && scripts.length === 1) { script.onerror(); return; }
        win.grecaptcha = api; win.___grecaptcha_cfg = config;
        script.onload();
      });
    },
    removeChild(script) { script.parentNode = null; }
  } };
  function client(options = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { module, setTimeout, clearTimeout });
    return module.exports.create({ api: "/api", enabled: true, window: win, document: doc,
      verificationTimeoutMs: 100, networkRetryDelayMs: 0,
      fetch: async (url, init) => {
        if (url.endsWith("/noamBotConfig")) return response(200, {
          ok: true, provider: "recaptcha-v3", mode: "enforce", siteKey: "synthetic-v3-public-key"
        });
        const body = JSON.parse(init.body); posts.push(body);
        return behavior.server ? behavior.server(body, posts.length) : response(200, { ok: true });
      }, ...options });
  }
  return { win, api, config, scripts, posts, executions, renders, resets, warnings, client };
}

for (const file of ["noam-bot-client.js", "headless/astro-poc/public/noam-bot-client.js"]) {
  test(`${file}: late timed-out v3 cannot corrupt a subsequent human v2 task or submit its stale payload`, async () => {
    let finishExpired;
    const challenge = proof();
    const p = page(file, {
      execute(n) { return n === 1 ? new Promise(resolve => { finishExpired = resolve; }) : Promise.resolve("fresh-v3-for-step-up"); },
      server(body) { return body.botVerification.provider === "recaptcha-v3"
        ? response(403, { code: "BOT_STEP_UP_REQUIRED", challenge }) : response(200, { ok: true }); }
    });
    await assert.rejects(p.client({ verificationTimeoutMs: 30 }).postJson("/api/noamSiteCompanion", { marker: "expired" }),
      { code: "BOT_VERIFICATION_TIMEOUT" });
    assert.equal(p.win.grecaptcha, p.api);
    assert.equal(p.win.___grecaptcha_cfg, p.config);
    assert.ok(p.scripts[0].parentNode);
    assert.equal(p.posts.length, 0);
    const current = p.client();
    const pending = current.postJson("/api/noamSiteCompanion", { marker: "current" }, {
      onChallenge(value) { return current.completeChallenge(value, {}); }
    });
    while (!p.renders.length) await flush();
    assert.equal(p.scripts.length, 1, "v2 reuses the original Google SDK");
    assert.equal(p.posts.length, 1, "human answer is still required");
    assert.equal(p.renders[0].options.sitekey, challenge.siteKey);
    finishExpired("late-unused-v3-token"); await flush();
    assert.equal(p.posts.length, 1);
    assert.equal(p.win.___grecaptcha_cfg, p.config);
    p.renders[0].options.callback("synthetic-human-token");
    assert.equal((await pending).ok, true);
    assert.deepEqual(p.posts.map(x => x.marker), ["current", "current"]);
    assert.deepEqual(p.posts.map(x => x.botVerification.provider), ["recaptcha-v3", "recaptcha-v2"]);
    assert.equal(p.posts[1].botVerification.requestToken, challenge.requestToken);
    assert.deepEqual(p.resets, [0]);
    assert.equal(p.scripts.length, 1);
    assert.doesNotMatch(JSON.stringify(p.warnings), /late-unused|synthetic-human-token|synthetic-signed-ticket/);
  });

  test(`${file}: execute rejection preserves Google's registry for the next explicit action`, async () => {
    const p = page(file, { execute(n) { return n === 1 ? Promise.reject(new Error("synthetic SDK error")) : Promise.resolve("next-fresh-token"); } });
    const client = p.client();
    await assert.rejects(client.postJson("/api/noamSiteCompanion", {}), { code: "BOT_VERIFICATION_FAILED" });
    assert.equal(p.scripts.length, 1);
    assert.equal(p.win.grecaptcha, p.api);
    assert.equal(p.win.___grecaptcha_cfg, p.config);
    assert.equal(p.posts.length, 0);
    assert.equal(await client.prepare(), true);
    assert.equal((await client.postJson("/api/noamSiteCompanion", {})).ok, true);
    assert.equal(p.scripts.length, 1);
    assert.equal(p.executions.length, 2);
    assert.equal(p.posts[0].botVerification.token, "next-fresh-token");
  });

  test(`${file}: exact server browser-error retries a fresh token without reinjecting Google`, async () => {
    const p = page(file, { server(_body, n) { return n === 1 ? response(403, {
      ok: false, code: "BOT_VERIFICATION_FAILED", siteverify: { errorCodes: ["browser-error"], score: null, hostname: "", action: "" }
    }) : response(200, { ok: true }); } });
    assert.equal((await p.client().postJson("/api/noamSiteCompanion", {})).ok, true);
    assert.equal(p.scripts.length, 1);
    assert.equal(p.win.___grecaptcha_cfg, p.config);
    assert.equal(p.posts.length, 2);
    assert.notEqual(p.posts[0].botVerification.token, p.posts[1].botVerification.token);
  });

  test(`${file}: installed but non-ready SDK times out repeatedly without new scripts or tokens`, async () => {
    const callbacks = [];
    const p = page(file, { ready(callback) { callbacks.push(callback); } });
    const client = p.client({ verificationTimeoutMs: 30 });
    await assert.rejects(client.prepare(), { code: "BOT_VERIFICATION_TIMEOUT" });
    await assert.rejects(client.postJson("/api/noamSiteCompanion", {}), { code: "BOT_VERIFICATION_TIMEOUT" });
    assert.equal(p.scripts.length, 1);
    assert.equal(p.win.___grecaptcha_cfg, p.config);
    callbacks.forEach(callback => callback()); await flush();
    assert.equal(p.executions.length, 0);
    assert.equal(p.posts.length, 0);
  });

  test(`${file}: a late-ready installed SDK can render v2 without reviving expired v3`, async () => {
    const callbacks = []; let ready = false;
    const p = page(file, { ready(callback) { if (ready) callback(); else callbacks.push(callback); } });
    await assert.rejects(p.client({ verificationTimeoutMs: 30 }).prepare(), { code: "BOT_VERIFICATION_TIMEOUT" });
    ready = true; callbacks.forEach(callback => callback()); await flush();
    const current = p.client(), controller = new AbortController();
    const pending = current.completeChallenge(proof(), {}, { signal: controller.signal });
    while (!p.renders.length) await flush();
    assert.equal(p.scripts.length, 1);
    assert.equal(p.win.___grecaptcha_cfg, p.config);
    assert.equal(p.executions.length, 0);
    controller.abort();
    await assert.rejects(pending, { code: "BOT_CHALLENGE_CANCELLED" });
    assert.deepEqual(p.resets, [0]);
    assert.equal(p.posts.length, 0);
    assert.equal(await current.prepare(), true, "cancel releases the SDK lease");
  });

  test(`${file}: an API script failure before installation still uses the allowed fallback host`, async () => {
    const p = page(file, { failFirstScript: true });
    assert.equal((await p.client().postJson("/api/noamSiteCompanion", {})).ok, true);
    assert.equal(p.scripts.length, 2);
    assert.match(p.scripts[0].src, /www\.google\.com/);
    assert.match(p.scripts[1].src, /www\.recaptcha\.net/);
    assert.equal(p.scripts[0].parentNode, null);
    assert.ok(p.scripts[1].parentNode);
    assert.equal(p.executions.length, 1);
    assert.equal(p.posts.length, 1);
  });
}
