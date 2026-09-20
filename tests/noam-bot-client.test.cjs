"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const NoamBotClient = require("../noam-bot-client.js");

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function recaptcha(tokens) {
  return {
    ready(callback) { callback(); },
    execute: async () => tokens.shift()
  };
}

test("a transient model network failure retries once with a fresh verification token", async () => {
  const calls = [];
  const tokens = ["first-token", "second-token"];
  const client = NoamBotClient.create({
    api: "https://example.test/_functions",
    enabled: true,
    networkRetryDelayMs: 0,
    loadRecaptcha: async () => recaptcha(tokens),
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/noamBotConfig")) {
        return response(200, { ok: true, provider: "recaptcha-v3", mode: "enforce", siteKey: "public-site-key" });
      }
      const modelCalls = calls.filter(call => call.url.endsWith("/noamImageSolve"));
      if (modelCalls.length === 1) { throw new TypeError("Failed to fetch"); }
      return response(200, { ok: true, answer: "רמז" });
    }
  });

  const result = await client.postJson("https://example.test/_functions/noamImageSolve", { question: 1 });
  const modelCalls = calls.filter(call => call.url.endsWith("/noamImageSolve"));
  assert.equal(result.answer, "רמז");
  assert.equal(modelCalls.length, 2);
  assert.deepEqual(modelCalls.map(call => JSON.parse(call.options.body).botVerification.token),
    ["first-token", "second-token"]);
});

test("two network failures become a clear Hebrew error instead of Failed to fetch", async () => {
  const client = NoamBotClient.create({
    api: "https://example.test/_functions",
    enabled: false,
    networkRetryDelayMs: 0,
    fetch: async () => { throw new TypeError("Failed to fetch"); }
  });

  await assert.rejects(
    client.postJson("https://example.test/_functions/noamImageSolve", {}),
    error => error.code === "NETWORK_UNAVAILABLE" &&
      /החיבור לנועם AI נקטע/.test(error.message) &&
      !/Failed to fetch/i.test(error.message)
  );
});

test("an HTTP failure is returned once without retrying a paid request", async () => {
  let calls = 0;
  const client = NoamBotClient.create({
    api: "https://example.test/_functions",
    enabled: false,
    networkRetryDelayMs: 0,
    fetch: async () => {
      calls += 1;
      return response(503, { ok: false, error: "השירות עמוס" });
    }
  });

  await assert.rejects(
    client.postJson("https://example.test/_functions/noamImageSolve", {}),
    error => error.status === 503 && error.message === "השירות עמוס"
  );
  assert.equal(calls, 1);
});

test("diagram plans use their own verified action and cannot be sent to an unknown host or route",async()=>{
  const actions=[],requests=[];
  const client=NoamBotClient.create({api:"https://api.test/_functions",enabled:true,
    loadRecaptcha:async()=>({ready(fn){fn();},execute:async(_key,options)=>{actions.push(options.action);return "diagram-token";}}),
    fetch:async(url,options)=>{
      if(url.endsWith("/noamBotConfig")){return response(200,{ok:true,provider:"recaptcha-v3",mode:"enforce",siteKey:"public-site-key"});}
      requests.push({url,body:JSON.parse(options.body)});return response(200,{ok:true,plan:{version:1,status:"unsupported"}});
    }});
  await client.postJson("https://api.test/_functions/noamDiagramPlan",{exerciseId:"G8-T09-A-Q02א"});
  assert.deepEqual(actions,["noam_diagram_plan"]);
  assert.equal(requests[0].body.botVerification.token,"diagram-token");
  for(const endpoint of ["https://other.test/_functions/noamDiagramPlan","https://api.test/_functions/noamDiagramPlan?bypass=1"]){
    await assert.rejects(client.postJson(endpoint,{}),error=>error.code==="BOT_ROUTE_UNSUPPORTED");
  }
  assert.equal(requests.length,1);
});
