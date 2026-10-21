"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const api = "https://example.test/_functions";
const config = { ok: true, provider: "recaptcha-v3", mode: "enforce", siteKey: "public-test-key" };
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Exercise the actual SDK script loader in both shipped entry points. Google's
// API is simulated here; these are lifecycle regressions, not live acceptance.
function harness(file, options = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    { module, setTimeout, clearTimeout }, { filename: file });
  const requests = [], scripts = [], warnings = [], actions = [];
  const recaptcha = options.recaptcha || {
    ready(callback) { callback(); },
    async execute(_key, details) { actions.push(details.action); return "test-verification-token"; }
  };
  const win = { console: { warn(...args) { warnings.push(args); } } };
  const document = {
    createElement(tag) { assert.equal(tag, "script"); return {}; },
    head: {
      appendChild(script) {
        scripts.push(script);
        script.parentNode = this;
        queueMicrotask(() => {
          if (options.scriptError) { script.onerror(options.scriptError); }
          else { win.grecaptcha = recaptcha; script.onload(); }
        });
      },
      removeChild(script) { script.parentNode = null; }
    }
  };
  const client = module.exports.create({
    api, enabled: true, window: win, document,
    verificationTimeoutMs: options.timeout || 100,
    networkRetryDelayMs: 0,
    fetch: async (url, request) => {
      requests.push({ url, request });
      if (url.endsWith("/noamBotConfig")) {
        if (options.configError) { throw options.configError; }
        return response(200, options.config || config);
      }
      return options.modelResponse || response(200, { ok: true, answer: "רמז" });
    }
  });
  return { client, requests, scripts, warnings, actions,
    modelCalls() { return requests.filter(call => call.request.method === "POST"); } };
}

function assertDiagnostic(h, stage, code) {
  assert.deepEqual(h.warnings, [["NOAM_VERIFICATION_FAILED", JSON.stringify({
    action: "noam_image_solve", stage, code
  })]]);
  assert.equal(h.modelCalls().length, 0);
}

for (const file of ["noam-bot-client.js", "headless/astro-poc/public/noam-bot-client.js"]) {
  test(`${file}: waits for Google's ready callback before requiring execute`, async () => {
    let ready;
    const recaptcha = { ready(callback) { ready = callback; } };
    const h = harness(file, { recaptcha });
    const pending = h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" });
    await flush();
    assert.equal(h.modelCalls().length, 0);
    assert.equal(h.scripts.length, 1);
    assert.equal(h.scripts[0].src, "https://www.google.com/recaptcha/api.js?render=public-test-key");
    recaptcha.execute = async (_key, details) => {
      assert.equal(details.action, "noam_image_solve");
      return "fresh-test-token";
    };
    ready();
    assert.equal((await pending).answer, "רמז");
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "fresh-test-token");
    assert.deepEqual(h.warnings, []);
  });

  test(`${file}: config failure records only its fixed stage and code`, async () => {
    const h = harness(file, { configError: new Error("private diagnostic detail") });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_CONFIG_UNAVAILABLE" });
    assertDiagnostic(h, "config", "BOT_CONFIG_UNAVAILABLE");
    assert.equal(h.scripts.length, 0);
  });

  test(`${file}: script failure is separate from a server verification denial`, async () => {
    const h = harness(file, { scriptError: new Error("private script event detail") });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_CLIENT_UNAVAILABLE" });
    assertDiagnostic(h, "script", "BOT_CLIENT_UNAVAILABLE");
    assert.equal(h.scripts[0].parentNode, null);
  });

  test(`${file}: a late ready callback cannot send a model request after timeout`, async () => {
    let ready, executions = 0;
    const h = harness(file, { timeout: 30, recaptcha: {
      ready(callback) { ready = callback; },
      async execute() { executions += 1; return "late-token"; }
    } });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_VERIFICATION_TIMEOUT" });
    assertDiagnostic(h, "ready", "BOT_VERIFICATION_TIMEOUT");
    ready();
    await flush();
    assert.equal(executions, 0);
    assert.equal(h.modelCalls().length, 0);
  });

  test(`${file}: a late Google token cannot send a model request after timeout`, async () => {
    let finish;
    const h = harness(file, { timeout: 30, recaptcha: {
      ready(callback) { callback(); },
      execute() { return new Promise(resolve => { finish = resolve; }); }
    } });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_VERIFICATION_TIMEOUT" });
    assertDiagnostic(h, "execute", "BOT_VERIFICATION_TIMEOUT");
    finish("late-private-token");
    await flush();
    assert.equal(h.modelCalls().length, 0);
  });

  test(`${file}: provider messages and arbitrary error codes never enter diagnostics`, async () => {
    const privateText = "PRIVATE_KEY_TOKEN_QUESTION_CONTENT";
    const failure = Object.assign(new Error(privateText), { code: `BOT_${privateText}` });
    const h = harness(file, { recaptcha: {
      ready(callback) { callback(); },
      async execute() { throw failure; }
    } });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, { question: privateText }));
    assertDiagnostic(h, "execute", "BOT_VERIFICATION_FAILED");
    assert.equal(JSON.stringify(h.warnings).includes(privateText), false);
    assert.equal(JSON.stringify(h.warnings).includes(config.siteKey), false);
  });

  test(`${file}: an empty token is rejected before any model call`, async () => {
    const h = harness(file, { recaptcha: {
      ready(callback) { callback(); },
      async execute() { return ""; }
    } });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_VERIFICATION_FAILED" });
    assertDiagnostic(h, "token", "BOT_VERIFICATION_FAILED");
  });

  test(`${file}: server denial is still enforced once after successful Google verification`, async () => {
    const h = harness(file, { modelResponse: response(403, { ok: false, code: "BOT_VERIFICATION_FAILED" }) });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), error =>
      error.code === "BOT_VERIFICATION_FAILED" && error.status === 403);
    assert.equal(h.modelCalls().length, 1);
    assert.deepEqual(h.actions, ["noam_image_solve"]);
    assert.equal(h.warnings.length, 1);
    assert.equal(h.warnings[0][0], "NOAM_REQUEST_FAILED");
  });
}

test("public client preserves active=false without loading Google or requesting a model", async () => {
  const h = harness("headless/astro-poc/public/noam-bot-client.js", { config: { active: false } });
  await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "NOT_ACTIVE" });
  assertDiagnostic(h, "config", "NOT_ACTIVE");
  assert.equal(h.scripts.length, 0);
});
