"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Offline Google/HTTP doubles: no CAPTCHA or AI service is contacted.
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const challenge = (extra = {}) => ({ provider: "recaptcha-v2", siteKey: "synthetic-public-v2-key",
  requestToken: "synthetic-signed-request-ticket", expiresAt: Date.now() + 10000, ...extra });

function page(file, server, extra = {}) {
  const scripts = [], actions = [], posts = [], renders = [], resets = [], warnings = [];
  let serial = 0;
  const win = { innerWidth: extra.width || 390, console: { warn(...args) { warnings.push(args); } } };
  const google = {
    ready(callback) { extra.ready ? extra.ready(callback) : callback(); },
    execute: async (_key, options) => { actions.push(options.action); return "synthetic-v3-" + (++serial); },
    render(container, options) { renders.push({ container, options }); return renders.length - 1; },
    reset(id) { resets.push(id); }
  };
  const doc = { createElement: () => ({}), head: {
    appendChild(script) {
      scripts.push(script); script.parentNode = this;
      queueMicrotask(() => { win.grecaptcha = google; if (script.onload) script.onload(); });
    },
    removeChild(script) { script.parentNode = null; }
  } };
  function client(options = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { module, setTimeout, clearTimeout });
    return module.exports.create({ api: "/api", enabled: true, window: win, document: doc,
      verificationTimeoutMs: 200, networkRetryDelayMs: 0,
      fetch: async (url, init) => {
        if (url.endsWith("/noamBotConfig")) return response(200, { ok: true, provider: "recaptcha-v3", mode: "enforce", siteKey: "synthetic-public-v3-key" });
        const body = JSON.parse(init.body); posts.push(body);
        return server ? server(body, posts.length) : response(200, { ok: true });
      }, ...options });
  }
  return { client, google, scripts, actions, posts, renders, resets, warnings, win };
}

for (const file of ["noam-bot-client.js", "headless/astro-poc/public/noam-bot-client.js"]) {
  test(`${file}: a human answer resumes the captured payload exactly once with v2 proof`, async () => {
    const proof = challenge();
    const p = page(file, (_body, n) => n === 1 ? response(403, { code: "BOT_STEP_UP_REQUIRED", challenge: proof }) : response(200, { ok: true }));
    let answer, callbacks = 0;
    const payload = { message: "בחר שאלות", teacher: { count: 5, planCounts: [5, 10, 15], candidates: [{ id: "a:1" }] } };
    const original = JSON.parse(JSON.stringify(payload));
    const pending = p.client().postJson("/api/noamSiteCompanion", payload, { onChallenge(received) {
      callbacks += 1;
      assert.equal(JSON.stringify(received), JSON.stringify(proof));
      return new Promise(resolve => { answer = resolve; });
    } });
    while (!answer) await flush();
    payload.teacher.count = 15; payload.teacher.candidates.push({ id: "b:99" });
    assert.equal(p.posts.length, 1, "No resume before actual human callback");
    answer("synthetic-human-token");
    assert.equal((await pending).ok, true);
    assert.equal(callbacks, 1); assert.equal(p.posts.length, 2);
    assert.deepEqual(p.actions, ["noam_site_companion"]);
    assert.deepEqual(p.posts[1], { ...original, botVerification: { provider: "recaptcha-v2", token: "synthetic-human-token", requestToken: proof.requestToken } });
    assert.doesNotMatch(JSON.stringify(p.warnings), /synthetic-human-token|synthetic-signed-request-ticket/);
  });

  for (const [status, code] of [[403, "BOT_VERIFICATION_FAILED"], [429, "RATE_LIMITED"], [500, "BOT_STEP_UP_REQUIRED"]]) {
    test(`${file}: ${status} ${code} cannot open a widget or retry`, async () => {
      const p = page(file, () => response(status, { code, challenge: challenge() }));
      let called = false;
      await assert.rejects(p.client().postJson("/api/noamSiteCompanion", {}, { onChallenge() { called = true; } }), error => error.status === status);
      assert.equal(called, false); assert.equal(p.posts.length, 1);
    });
  }

  for (const invalid of [null, { provider: "other" }, { expiresAt: 0 }, { expiresAt: Date.now() + 600000 }, { siteKey: "<script>" }, { requestToken: "bad token" }]) {
    test(`${file}: malformed or expired challenge ${JSON.stringify(invalid)} remains blocked`, async () => {
      const p = page(file, () => response(403, { code: "BOT_STEP_UP_REQUIRED", challenge: invalid === null ? null : challenge(invalid) }));
      let called = false;
      await assert.rejects(p.client().postJson("/api/noamSiteCompanion", {}, { onChallenge() { called = true; } }), { code: "BOT_STEP_UP_REQUIRED" });
      assert.equal(called, false); assert.equal(p.posts.length, 1);
    });
  }

  test(`${file}: cancellation, invalid human token and expiry never send a second POST`, async () => {
    for (const outcome of ["cancel", "invalid", "expired"]) {
      const proof = challenge({ expiresAt: Date.now() + (outcome === "expired" ? 30 : 10000) });
      const p = page(file, () => response(403, { code: "BOT_STEP_UP_REQUIRED", challenge: proof }));
      const expected = outcome === "cancel" ? "BOT_CHALLENGE_CANCELLED" : outcome === "expired" ? "BOT_CHALLENGE_EXPIRED" : "BOT_VERIFICATION_FAILED";
      await assert.rejects(p.client().postJson("/api/noamSiteCompanion", {}, { async onChallenge() {
        if (outcome === "cancel") throw Object.assign(new Error("cancelled"), { code: expected });
        if (outcome === "expired") await new Promise(resolve => setTimeout(resolve, 45));
        return outcome === "invalid" ? ["wrong type"] : "synthetic-human-token";
      } }), { code: expected });
      assert.equal(p.posts.length, 1);
    }
  });

  test(`${file}: a v2 network failure or a repeated challenge is never retried`, async () => {
    for (const networkFailure of [true, false]) {
      const p = page(file, (_body, n) => {
        if (n > 1 && networkFailure) throw new TypeError("Failed to fetch");
        return response(403, { code: "BOT_STEP_UP_REQUIRED", challenge: challenge() });
      });
      let calls = 0;
      await assert.rejects(p.client().postJson("/api/noamSiteCompanion", {}, { onChallenge() { calls += 1; return "synthetic-human-token"; } }));
      assert.equal(calls, 1); assert.equal(p.posts.length, 2); assert.equal(p.actions.length, 1);
    }
  });

  test(`${file}: explicit render waits for SDK readiness; only the human callback resolves it`, async () => {
    let ready;
    const p = page(file, null, { ready(callback) { ready = callback; } });
    const client = p.client(), container = {};
    let resolved = false;
    const waiting = client.completeChallenge(challenge(), container).then(token => { resolved = true; return token; });
    while (!ready) await flush();
    assert.equal(p.renders.length, 0); assert.equal(p.actions.length, 0); assert.equal(p.posts.length, 0);
    ready(); await flush();
    assert.equal(p.renders.length, 1); assert.equal(resolved, false);
    assert.equal(p.renders[0].container, container); assert.equal(p.renders[0].options.size, "compact");
    assert.equal(p.renders[0].options.sitekey, "synthetic-public-v2-key");
    p.renders[0].options.callback("synthetic-human-token");
    assert.equal(await waiting, "synthetic-human-token");
    p.renders[0].options.callback("late-token");
    assert.deepEqual(p.resets, [0], "Widget zero is reset once before its container is removed");
    assert.equal(p.actions.length, 0); assert.equal(p.posts.length, 0);
  });

  for (const failure of ["cancel", "expired-callback", "error-callback", "deadline"]) {
    test(`${file}: ${failure} resets its own widget and releases the SDK queue`, async () => {
      const p = page(file), first = p.client(), second = p.client();
      const controller = new AbortController();
      const waiting = first.completeChallenge(challenge({ expiresAt: Date.now() + (failure === "deadline" ? 40 : 10000) }), {}, { signal: controller.signal });
      const rejected = assert.rejects(waiting, { code: failure === "cancel" ? "BOT_CHALLENGE_CANCELLED" : failure === "error-callback" ? "BOT_CHALLENGE_UNAVAILABLE" : "BOT_CHALLENGE_EXPIRED" });
      while (!p.renders.length) await flush();
      if (failure === "cancel") controller.abort();
      else if (failure !== "deadline") p.renders[0].options[failure]();
      await rejected;
      p.renders[0].options.callback("late-token");
      assert.deepEqual(p.resets, [0]);
      await second.postJson("/api/noamSiteCompanion", { teacher: { count: 10 } });
      assert.equal(p.posts.length, 1); assert.equal(p.actions.length, 1); assert.equal(p.scripts.length, 1);
    });
  }

  test(`${file}: a queued client's timeout cannot remove the SDK serving a human widget`, async () => {
    const p = page(file), first = p.client(), second = p.client({ verificationTimeoutMs: 25 });
    const waiting = first.completeChallenge(challenge(), {});
    while (!p.renders.length) await flush();
    await assert.rejects(second.prepare(), { code: "BOT_VERIFICATION_TIMEOUT" });
    assert.equal(p.win.grecaptcha, p.google); assert.ok(p.scripts[0].parentNode); assert.equal(p.resets.length, 0);
    p.renders[0].options.callback("synthetic-human-token"); await waiting;
    await second.prepare(); assert.equal(p.scripts.length, 1); assert.equal(p.actions.length, 0);
  });

  test(`${file}: cancellation before ready cannot render a late widget`, async () => {
    let ready;
    const p = page(file, null, { ready(callback) { ready = callback; } });
    const controller = new AbortController();
    const waiting = p.client().completeChallenge(challenge(), {}, { signal: controller.signal });
    const rejected = assert.rejects(waiting, { code: "BOT_CHALLENGE_CANCELLED" });
    while (!ready) await flush();
    controller.abort(); await rejected; ready(); await flush();
    assert.equal(p.renders.length, 0); assert.equal(p.actions.length, 0); assert.equal(p.posts.length, 0);
  });

  for (const [width, size] of [[320, "compact"], [390, "compact"], [1280, "normal"]]) {
    test(`${file}: a ${width}px phone/desktop uses the supported ${size} widget size`, async () => {
      const p = page(file, null, { width });
      const waiting = p.client().completeChallenge(challenge(), {});
      while (!p.renders.length) await flush();
      assert.equal(p.renders[0].options.size, size);
      assert.equal(p.renders[0].options.tabindex, 0);
      p.renders[0].options.callback("synthetic-human-token"); await waiting;
      assert.equal(p.actions.length, 0); assert.deepEqual(p.resets, [0]);
    });
  }
}
