"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const publicRoot = path.join(root, "headless/astro-poc/public");
const viewer = fs.readFileSync(path.join(root, "worksheet-viewer-noam.html"), "utf8");
const adapter = viewer.match(/<script id="exact-viewer-adapter">([\s\S]*?)<\/script>/)[1];
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

// Frozen from the supplied design/assets, not regenerated from either deployment
// copy. A visual asset change requires reviewing the design source separately.
const suppliedAssets = {
  "avatar/ramzi-A-error.svg": "b9a56e82a5e1234ba348ec618a67aac86e06e98c06d7534ec7c6dce1da95d845",
  "avatar/ramzi-A-hint.svg": "0ad09aaf6d5e47ae2fb74cfd9c55c3ce44fd9ef6ab8e4516dea1ed0290c87e2e",
  "avatar/ramzi-A-idle.svg": "fe9e0f5f49f2f4b5cf3641f083a3007f36392500009a4087286266368af42943",
  "avatar/ramzi-A-success.svg": "63b8652c0fbee8fc64da16b0999d653513ad9584a3571efc334e8b8d73e2356f",
  "avatar/ramzi-A-thinking.svg": "89da9f1b12b4da7e012b3a56b980bcddda031ceeba96a4afb1c4d3d9dbeb1168",
  "doodles/cube-plant.webp": "b1ec6f8a32b78f221c7ddc5d49237da69af42c4579e1745e2e840593256a18f3",
  "doodles/curious-cat.webp": "793225f7486043d150c9a727f633df6bf060be5fe4b980b7e8cec8ffe0474426",
  "doodles/eye-spiral.webp": "b64378fe2bc55f7f10a53cdcfc918e293153d7064476e3eb3ea54421113ae30e",
  "doodles/geometry-fish.webp": "e10d83d9141d98c5315662666c70bfd34c6536f8864effdb741c7a2165af1853",
  "doodles/kite.webp": "60d6f33daf51742fb1fb85cc362c83c3b15254cbfaae505b50aaa48076dc3580",
  "doodles/notebook-doodles-v1.webp": "a06433ff93fa8e8730306b465afeeb7b80f56cbcc60b19506c7ca9f9d5ee5cbd",
  "doodles/orbit-pencil.webp": "ff21cee1ba2768c2e1f141094ffa14836eb00acee37969a3efeb47222e054277",
  "doodles/paper-boat.webp": "71c0074af1789f67bff99a4be214354ffc1310c3cb08997a448275c6a8e974b9",
  "doodles/sleeping-cat.svg": "b6c570127ccf304637359b990693673793825c06bfcba0b22eb28dc15e1b03a5",
  "doodles/sleepy-owl.webp": "e9f2a83b23fddf41958c506f01c5b60c42c9c57aed0aeef0062361bf4416b3c8",
  "doodles/snail.webp": "d08a670612af5fb947eb6f49d8ce48fac5e87ef181ad31f292e745e4a1f6a300",
  "doodles/telescope.webp": "d8a8701755faa506634c747c0186bfde8bcd1437e6d2b1c47e9751783404ff5e",
  "logo.png": "65c775dd6bae7ad46991db990ef895baae00d4e0b9635cee1e07ab0cb368bc33",
  "whatsapp-group-qr.png": "66a51ea3b2e43620782ff9082ec0301d67bd932b975d02c791c3fe7a51b29866",
};

test("both deployment roots contain all 19 unmodified supplied assets", () => {
  for (const deploymentRoot of [root, publicRoot]) {
    for (const [asset, expected] of Object.entries(suppliedAssets)) {
      const file = path.join(deploymentRoot, "design-exact/assets", asset);
      assert.equal(sha256(fs.readFileSync(file)), expected, file);
    }
  }
});

test("new presentation assets resolve beside the viewer on Wix and repository-scoped GitHub Pages", () => {
  assert.doesNotMatch(viewer, /["']\/design-exact\/assets\//);
  const imagePaths = [...viewer.matchAll(/\bsrc="(design-exact\/assets\/[^"]+)"/g)].map(m => m[1]);
  assert.equal(imagePaths.length, 3, "logo and two static Ramzi images");
  const moodPath = adapter.match(/fetch\((['"]design-exact\/assets\/avatar\/ramzi-A-['"]\+mood\+['"]\.svg['"])\)/)?.[1];
  assert.ok(moodPath, "the mood fetch must also be relative to the viewer document");
  const allPaths = [...imagePaths, ...["idle", "thinking", "hint", "success", "error"].map(mood => vm.runInNewContext(moodPath, { mood }))];
  for (const base of [
    "https://www.noamdoronmath.co.il/worksheet-viewer-noam.html?g=7&lv=a#question",
    "https://noamdoronmath.github.io/noamdoronmath-worksheets/worksheet-viewer-noam.html?g=7&lv=a#question",
  ]) {
    const directory = new URL(".", base);
    for (const assetPath of allPaths) {
      const resolved = new URL(assetPath, base);
      assert.equal(resolved.href, directory.href + assetPath);
      assert.equal(resolved.search, "");
      assert.equal(resolved.hash, "");
      assert.ok(fs.existsSync(path.join(root, assetPath)));
      assert.ok(fs.existsSync(path.join(publicRoot, assetPath)));
    }
  }
});

test("only the new header navigation uses the verified main-site origin", () => {
  const header = viewer.match(/<header class="exact-viewer-header">([\s\S]*?)<\/header>/)?.[1];
  assert.ok(header);
  assert.deepEqual([...header.matchAll(/\bhref="([^"]+)"/g)].map(m => m[1]), [
    "https://www.noamdoronmath.co.il/",
    "https://www.noamdoronmath.co.il/",
    "https://www.noamdoronmath.co.il/worksheets",
    "https://www.noamdoronmath.co.il/learning.html",
  ]);
});

test("portable presentation preserves the released head and all 13 original scripts", () => {
  const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
  assert.ok(head);
  assert.equal(sha256(head), "7497944ebb6915e1bc9c751e50d73bbe0d552b9f4b6937be4f6c78f6370465d3");
  const scripts = [...viewer.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m => m[0]);
  assert.equal(scripts.length, 14);
  assert.match(scripts.at(-1), /^<script id="exact-viewer-adapter">/);
  assert.equal(sha256(JSON.stringify(scripts.slice(0, -1))), "edcb33b3f75f0bbd5f9b0f415578f98b887093948b43eeb8b340ac8fe1edf2d0");
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/, "").replace(/<\/script>$/, "");
    new vm.Script(body);
  }
});

test("root and Astro public viewers remain identical", () => {
  assert.equal(viewer, fs.readFileSync(path.join(publicRoot, "worksheet-viewer-noam.html"), "utf8"));
});

test("desktop auto-open waits for the released runtime availability mutation, not the initial visible button", () => {
  assert.match(adapter, /initialWideOpened=false,helpReadyObserved=false/);
  assert.match(adapter, /!initialWideOpened&&helpReadyObserved&&!helpTab\.disabled/);
  const functionSource = adapter.match(/function observeHelpAvailability\(records\)\{([\s\S]*?)\n  \}/)?.[0];
  assert.ok(functionSource);
  let hidden = false, scheduled = 0;
  const fab = { classList: { contains: () => hidden } };
  const sandbox = { fab, helpReadyObserved: false, schedule: () => scheduled++ };
  vm.runInNewContext(functionSource, sandbox);
  assert.equal(sandbox.helpReadyObserved, false, "initial fab visibility never proves readiness");
  sandbox.observeHelpAvailability([{ target: {}, attributeName: "class" }]);
  assert.equal(sandbox.helpReadyObserved, false, "panel mutations are not manifest readiness");
  hidden = true;
  sandbox.observeHelpAvailability([{ target: fab, attributeName: "class" }]);
  assert.equal(sandbox.helpReadyObserved, false, "hidden/unavailable must not auto-open");
  hidden = false;
  sandbox.observeHelpAvailability([{ target: fab, attributeName: "class" }]);
  assert.equal(sandbox.helpReadyObserved, true, "post-script visible fab mutation is observed");
  assert.equal(scheduled, 3);
  assert.match(adapter, /fab\.addEventListener\('click',function\(\)\{initialWideOpened=true;\}\)/);
  assert.doesNotMatch(functionSource, /fetch|manifestReady\s*=|renderExercisePicker|loadStaticManifest/);
});
