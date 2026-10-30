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
    async execute(_key, details) {
      const last = scripts[scripts.length - 1];
      if (options.executeFailHost && last && String(last.src || "").includes(options.executeFailHost)) {
        throw options.executeError || new Error("execute blocked");
      }
      if (options.executeHangHost && last && String(last.src || "").includes(options.executeHangHost)) {
        return new Promise(() => {});
      }
      if (options.slowExecuteHost && last && String(last.src || "").includes(options.slowExecuteHost)) {
        return new Promise(resolve => setTimeout(() => {
          actions.push(details.action);
          resolve("test-verification-token");
        }, options.slowExecuteMs || 0));
      }
      if (options.emptyTokenHost && last && String(last.src || "").includes(options.emptyTokenHost)) {
        return "";
      }
      actions.push(details.action);
      return "test-verification-token";
    }
  };
  const win = { console: { warn(...args) { warnings.push(args); } } };
  function attachRecaptcha(script) {
    // A new object per host so leftover google.com grecaptcha is not reused.
    win.grecaptcha = {
      ready(callback) { recaptcha.ready(callback); },
      execute(key, details) { return recaptcha.execute(key, details); }
    };
    script.onload();
  }
  const document = {
    createElement(tag) { assert.equal(tag, "script"); return {}; },
    head: {
      appendChild(script) {
        scripts.push(script);
        script.parentNode = this;
        queueMicrotask(() => {
          if (options.holdHost && String(script.src || "").includes(options.holdHost)) {
            return;
          }
          if (options.failHostOnce && String(script.src || "").includes(options.failHostOnce) &&
              !options._failedHostOnce) {
            options._failedHostOnce = true;
            script.onerror(new Error("host blocked"));
          } else if (options.failHost && String(script.src || "").includes(options.failHost)) {
            script.onerror(new Error("host blocked"));
          } else if (options.scriptError) { script.onerror(options.scriptError); }
          else {
            attachRecaptcha(script);
          }
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
  return { client, requests, scripts, warnings, actions, win,
    attachRecaptcha,
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
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[0].src, "https://www.google.com/recaptcha/api.js?render=public-test-key");
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.equal(h.scripts[0].parentNode, null);
    assert.equal(h.scripts[1].parentNode, null);
  });

  test(`${file}: recaptcha.net is tried after google.com without skipping the token`, async () => {
    const h = harness(file, { failHost: "google.com/recaptcha" });
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[0].src, "https://www.google.com/recaptcha/api.js?render=public-test-key");
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "test-verification-token");
    assert.deepEqual(h.warnings, []);
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
    assert.equal(h.scripts.length, 2);
    assert.equal(JSON.stringify(h.warnings).includes(privateText), false);
    assert.equal(JSON.stringify(h.warnings).includes(config.siteKey), false);
  });

  test(`${file}: execute failure on google.com falls back to recaptcha.net without skipping the token`, async () => {
    const h = harness(file, { executeFailHost: "google.com/recaptcha" });
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[0].src, "https://www.google.com/recaptcha/api.js?render=public-test-key");
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "test-verification-token");
    assert.deepEqual(h.warnings, []);
  });

  test(`${file}: a late first-host script must not drop recaptcha.net or send a stale token`, async () => {
    const h = harness(file, { timeout: 150, holdHost: "google.com/recaptcha" });
    const pending = h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" });
    while (h.scripts.length < 1) { await flush(); }
    assert.equal(h.scripts.length, 1);
    const lateLoad = h.scripts[0].onload;
    assert.equal(typeof lateLoad, "function");
    assert.equal((await pending).answer, "רמז");
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.ok(h.scripts[1].parentNode, "recaptcha.net script must survive the first-host timer");
    assert.equal(h.scripts[0].parentNode, null);
    assert.equal(h.actions.length, 1);
    h.win.grecaptcha = {
      ready(callback) { callback(); },
      async execute() {
        h.actions.push("stale-host1");
        return "stale-host1-token";
      }
    };
    lateLoad();
    await flush();
    assert.ok(h.scripts[1].parentNode, "late first-host onload must not remove recaptcha.net");
    assert.equal(h.actions.includes("stale-host1"), false);
    assert.equal(h.modelCalls().length, 1);
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "test-verification-token");
  });

  test(`${file}: a late first-host ready callback must not execute after recaptcha.net`, async () => {
    let host1Ready;
    const h = harness(file, {
      timeout: 150,
      recaptcha: {
        ready(callback) {
          const last = h.scripts[h.scripts.length - 1];
          if (last && String(last.src || "").includes("google.com/recaptcha")) {
            host1Ready = callback;
            return;
          }
          callback();
        },
        async execute(_key, details) {
          h.actions.push(details.action);
          const last = h.scripts[h.scripts.length - 1];
          if (last && String(last.src || "").includes("google.com/recaptcha")) {
            return "stale-host1-token";
          }
          return "test-verification-token";
        }
      }
    });
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(typeof host1Ready, "function");
    assert.equal(h.actions.length, 1);
    host1Ready();
    await flush();
    assert.equal(h.actions.length, 1);
    assert.equal(h.modelCalls().length, 1);
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "test-verification-token");
  });

  test(`${file}: a hanging google.com execute uses the remaining overall budget instead of a second widget`, async () => {
    const h = harness(file, { timeout: 150, executeHangHost: "google.com/recaptcha" });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_VERIFICATION_TIMEOUT" });
    assertDiagnostic(h, "execute", "BOT_VERIFICATION_TIMEOUT");
    assert.equal(h.scripts.length, 1);
    assert.equal(h.modelCalls().length, 0);
  });

  test(`${file}: a slow first-host execute after the host cap still sends a token without recaptcha.net`, async () => {
    const h = harness(file, {
      timeout: 250,
      slowExecuteHost: "google.com/recaptcha",
      slowExecuteMs: 120
    });
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 1);
    assert.equal(h.scripts[0].src, "https://www.google.com/recaptcha/api.js?render=public-test-key");
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "test-verification-token");
    assert.deepEqual(h.warnings, []);
  });

  test(`${file}: a stalled google.com ready falls back to recaptcha.net without skipping the token`, async () => {
    const h = harness(file, {
      timeout: 150,
      recaptcha: {
        ready(callback) {
          const last = h.scripts[h.scripts.length - 1];
          if (last && String(last.src || "").includes("google.com/recaptcha")) {
            return;
          }
          callback();
        },
        async execute(_key, details) {
          h.actions.push(details.action);
          return "test-verification-token";
        }
      }
    });
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "test-verification-token");
    assert.equal(h.modelCalls().length, 1);
    assert.deepEqual(h.warnings, []);
  });

  test(`${file}: a consecutive request reuses the working recaptcha.net SDK`, async () => {
    const h = harness(file, { failHostOnce: "google.com/recaptcha" });
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 2);
    assert.equal(h.scripts[1].src, "https://www.recaptcha.net/recaptcha/api.js?render=public-test-key");
    assert.equal(h.modelCalls().length, 2);
    assert.equal(JSON.parse(h.modelCalls()[1].request.body).botVerification.token, "test-verification-token");
    assert.deepEqual(h.warnings, []);
  });

  test(`${file}: a later request reloads after execute failed on both hosts`, async () => {
    let pass = 0;
    const h = harness(file, { recaptcha: {
      ready(callback) { callback(); },
      async execute() {
        pass += 1;
        if (pass <= 2) { throw new Error("first pass blocked"); }
        return "retry-token";
      }
    } });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_VERIFICATION_FAILED" });
    assert.equal(h.modelCalls().length, 0);
    assert.equal((await h.client.postJson(`${api}/noamImageSolve`, { exerciseId: "synthetic-exercise" })).answer, "רמז");
    assert.equal(h.scripts.length, 3);
    assert.equal(h.scripts[2].src, "https://www.google.com/recaptcha/api.js?render=public-test-key");
    assert.equal(JSON.parse(h.modelCalls()[0].request.body).botVerification.token, "retry-token");
  });

  test(`${file}: an empty token is rejected before any model call`, async () => {
    const h = harness(file, { recaptcha: {
      ready(callback) { callback(); },
      async execute() { return ""; }
    } });
    await assert.rejects(h.client.postJson(`${api}/noamImageSolve`, {}), { code: "BOT_VERIFICATION_FAILED" });
    assertDiagnostic(h, "token", "BOT_VERIFICATION_FAILED");
    assert.equal(h.scripts.length, 2);
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
