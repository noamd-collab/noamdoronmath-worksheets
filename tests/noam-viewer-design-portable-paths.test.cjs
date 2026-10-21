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

// 3433651 "perf: shrink doodles, self-host fonts, cut phone LCP" (PR #39, approved
// by Noam 2.10.2026) replaced these 11 Headless copies with ~400px WebP resizes and
// updated src/data/doodles.manifest.json to match. The root copies stay the
// supplied originals above. Hashes are the 3433651 blobs.
const headlessResizedDoodles = {
  "doodles/cube-plant.webp": "f331a06368b0037ea9b353345c2ae4f0022b18e9eab00af1ec4abb4c14b63853",
  "doodles/curious-cat.webp": "cf07fccc9bfb1887cd645b7795ffdcb5b912fb4b0e198246e203b38d77c745ab",
  "doodles/eye-spiral.webp": "c689890ce0b295ce0b2a8f0eccbe812c73448fb644478e900b1a5676cbd59815",
  "doodles/geometry-fish.webp": "26bce1459299e8d23b0b6f52cf0a67f358a8d77688417b5621b638a355913616",
  "doodles/kite.webp": "5e2089996f0dd1b7a6a43c398e04ebfcf50cb36da3bdc9a576dccb35a5cb5978",
  "doodles/notebook-doodles-v1.webp": "6cd4aafaac0cf4b20d07289e70e6a7db29a317e6662600d5bdd30fe03b0a9ead",
  "doodles/orbit-pencil.webp": "5cba2366a60d5bfa0b42bfeddc0947fda2492e55d7f368d09c44e2e577fea287",
  "doodles/paper-boat.webp": "c0c9ee87833931665ed3f760fbdf46daed452fe5fd0d2ec3327f6c9810879ff2",
  "doodles/sleepy-owl.webp": "0570561cf4af4190f782dba4c076c34b4d3605180fd8f2cf79e6b5d01a3b520b",
  "doodles/snail.webp": "1ac8097d75a52456e60dfd04d54b0fa9d1a34ddc1c4360003ffaea6e07fc1415",
  "doodles/telescope.webp": "ea31e45d0480c22329999610d8ac3b534ddb10a8e23659128ebd60f4201c29dc",
};

test("both deployment roots contain all 19 supplied assets, with only the reviewed Headless doodle resizes", () => {
  assert.equal(Object.keys(suppliedAssets).length, 19);
  for (const asset of Object.keys(headlessResizedDoodles)) assert.ok(asset in suppliedAssets, asset);
  for (const deploymentRoot of [root, publicRoot]) {
    for (const [asset, supplied] of Object.entries(suppliedAssets)) {
      const file = path.join(deploymentRoot, "design-exact/assets", asset);
      const expected = deploymentRoot === publicRoot && headlessResizedDoodles[asset] || supplied;
      assert.equal(sha256(fs.readFileSync(file)), expected, file);
    }
  }
});

test("new presentation assets resolve beside the viewer on Wix and repository-scoped GitHub Pages", () => {
  assert.doesNotMatch(viewer, /["']\/design-exact\/assets\//);
  const imagePaths = [...viewer.matchAll(/\bsrc="(design-exact\/assets\/[^"]+)"/g)].map(m => m[1]);
  assert.equal(imagePaths.length, 3, "logo and two static Ramzi images");
  // c538673 "Restyle the worksheet help console around רמזי" (PR #34, approved by
  // Noam 2.10.2026) moved the mood fetch out of this adapter into the released
  // ramzi/ramzi-avatar.js element (also pinned as a released script in
  // headless/astro-poc/tests/design-exact-protected.test.ts). The adapter passes a
  // relative asset-base; the element fetches `${base}/ramzi-A-${mood}.svg`
  // resolved against document.baseURI. Both pieces must stay viewer-relative.
  const elementPath = "ramzi/ramzi-avatar.js";
  assert.ok(viewer.includes('<script src="' + elementPath + '"></script>'));
  const element = fs.readFileSync(path.join(root, elementPath), "utf8");
  assert.equal(element, fs.readFileSync(path.join(publicRoot, elementPath), "utf8"), "root and Astro public Ramzi elements remain identical");
  assert.match(element, /svg = \(await loadSvg\(assetUrl\(base, mood\)\)\)/);
  assert.match(element, /pending = fetch\(url\)/);
  const assetUrl = element.match(/function assetUrl\(base, mood\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(assetUrl);
  const moodBase = adapter.match(/el\.setAttribute\('asset-base','([^']+)'\)/)?.[1];
  assert.equal(moodBase, "design-exact/assets/avatar", "the mood fetch must also be relative to the viewer document");
  const moods = ["idle", "thinking", "hint", "success", "error"];
  const allPaths = [...imagePaths, elementPath, ...moods.map(mood => moodBase + "/ramzi-A-" + mood + ".svg")];
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
      assert.ok(fs.existsSync(path.join(root, assetPath)), path.join(root, assetPath));
      assert.ok(fs.existsSync(path.join(publicRoot, assetPath)), path.join(publicRoot, assetPath));
    }
    const sandbox = { URL, document: { baseURI: base } };
    vm.runInNewContext(assetUrl, sandbox);
    for (const mood of moods) {
      assert.equal(sandbox.assetUrl(moodBase, mood), directory.href + "design-exact/assets/avatar/ramzi-A-" + mood + ".svg");
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

// Re-pinned for PR #34 (merge 28eba36, "approved by Noam 2.10.2026"), changes
// reviewed in that PR and applied to both viewer copies:
// - head: b7eab08 "Install the chosen favicon set" added the favicon/manifest/
//   theme-color tags (was 7497944e...).
// - scripts: c538673 added the released ramzi/ramzi-avatar.js before the adapter
//   (13 -> 14 released, 15 total; the Headless fence in design-exact-protected.test.ts
//   records "ramzi-avatar.js is a released script (15 total)"), and 71ed0ac
//   and 394fe07 edited the released inline viewer script (was edcb33b3...).
test("portable presentation preserves the released head and all 14 released scripts", () => {
  const head = viewer.match(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/i)?.[0];
  assert.ok(head);
  assert.equal(sha256(head), "bcdaa06ff426b90ec4d5919341c9ffe9d13854a19fab9b05719b46cb614c9d3b");
  const scripts = [...viewer.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m => m[0]);
  assert.equal(scripts.length, 15);
  assert.equal(scripts.at(-2), '<script src="ramzi/ramzi-avatar.js"></script>');
  assert.match(scripts.at(-1), /^<script id="exact-viewer-adapter">/);
  assert.equal(sha256(JSON.stringify(scripts.slice(0, -1))), "287bef0492d5143075bf83b2f2a797bf58cf4467f22cbb7f6941497670ddf903");
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/, "").replace(/<\/script>$/, "");
    new vm.Script(body);
  }
});

// The copies may no longer be byte-identical. 02b9903 (PR #32) wired the Headless
// copy with "Leave the GitHub Pages root viewer untouched", and
// headless/astro-poc/tests/design-exact-protected.test.ts ("keeps Headless viewer
// adapters without rewriting the GitHub Pages root viewer") requires onHeadlessHost
// only in the Headless copy. PR #39 (3433651, bdff022, f5964e9, approved by Noam
// 2.10.2026) changed only the Headless copy and re-pinned its fence there. Every other
// byte must still match: the Headless copy is exactly the root copy plus these
// reviewed edits, each applied once.
const headlessOnlyEdits = [
  // 3433651 perf (PR #39): self-hosted Hebrew+Latin fonts replace Google Fonts in the head
  ["\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"preconnect\" href=\"https://cdn.jsdelivr.net\" crossorigin>\n<link rel=\"preconnect\" href=\"https://www.noamdoronmath.co.il\" crossorigin>\n\n<link href=\"https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Heebo:wght@500;700;800;900&display=swap\" rel=\"stylesheet\" media=\"print\" onload=\"this.media='all'\">\n",
   "\n<link rel=\"preconnect\" href=\"https://cdn.jsdelivr.net\" crossorigin>\n<link rel=\"preconnect\" href=\"https://www.noamdoronmath.co.il\" crossorigin>\n<link rel=\"stylesheet\" href=\"/fonts/site-fonts.css\">\n<link rel=\"preload\" href=\"/fonts/heebo-hebrew.f1f7cfae.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n<link rel=\"preload\" href=\"/fonts/heebo-latin.50dae2e1.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n"],
  // bdff022 (PR #39): font faces load from the head, so the presentation @import is dropped
  ["     Keep this outside head: the released metadata, PDF engine, and AI scripts\n     below remain unchanged. Real PDF content and its controls are retained. -->\n<style id=\"exact-viewer-presentation\">\n@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Secular+One&display=swap');\nbody.exact-viewer{",
   "     Keep this outside head: the released metadata, PDF engine, and AI scripts\n     below remain unchanged. Real PDF content and its controls are retained.\n     Font faces live in the head so Hebrew is measured before first paint. -->\n<style id=\"exact-viewer-presentation\">\nbody.exact-viewer{"],
  // 3433651/bdff022/f5964e9 (PR #39): reserve the PDF box and the tools column until they first open
  ["}\n.exact-viewer .pdf-page{box-shadow:0 3px 0 rgba(34,48,90,.08);outline:1.5px solid #c9cfdc}\n.exact-viewer .pdf-status{background:#fbfaf5;font-weight:700}",
   "}\n.exact-viewer .pdf-page{box-shadow:0 3px 0 rgba(34,48,90,.08);outline:1.5px solid #c9cfdc;aspect-ratio:210 / 297}\n@media(min-width:901px){\n  .pdf-page--reserve{display:none}\n  /* Reserve the tools column only until they first open, so load does not\n     jump, and closing כלי PDF still lets the page widen. */\n  .exact-viewer .pdf-surface:not([data-tools-settled]){grid-template-columns:var(--pdf-tools-width) minmax(0,1fr)}\n  .exact-viewer .pdf-surface:not([data-tools-settled]) .pdf-scroll,\n  .exact-viewer .pdf-surface:not([data-tools-settled]) .pdf-native{grid-column:2}\n  .exact-viewer .pdf-surface:not([data-tools-settled]) .pdf-status{inset-inline-start:var(--pdf-tools-width)}\n}\n@media(max-width:900px){\n  .exact-viewer .pdf-page--reserve{min-height:calc((100vw - 128px) * 297 / 210)}\n}\n.exact-viewer .pdf-status{background:#fbfaf5;font-weight:700}"],
  // 02b9903 (PR #32) same-origin Headless header links; 3433651 (PR #39) 320px logo.webp
  ["<header class=\"exact-viewer-header\">\n  <a href=\"https://www.noamdoronmath.co.il/\" aria-label=\"נועם דורון מתמטיקה — בית\"><img src=\"design-exact/assets/logo.png\" alt=\"נועם דורון מתמטיקה\"></a>\n  <nav aria-label=\"ראשי\"><a href=\"https://www.noamdoronmath.co.il/\">בית</a><a href=\"https://www.noamdoronmath.co.il/worksheets\" aria-current=\"page\">דפי עבודה</a><a href=\"https://www.noamdoronmath.co.il/learning.html\">הלמידה שלי</a></nav>\n</header>",
   "<header class=\"exact-viewer-header\">\n  <a href=\"/\" aria-label=\"נועם דורון מתמטיקה — בית\"><img src=\"design-exact/assets/logo.webp\" alt=\"נועם דורון מתמטיקה\" width=\"320\" height=\"136\" decoding=\"async\"></a>\n  <nav aria-label=\"ראשי\"><a href=\"/\">בית</a><a href=\"/worksheets\" aria-current=\"page\">דפי עבודה</a><a href=\"/learning.html\">הלמידה שלי</a></nav>\n</header>"],
  // 3433651 (PR #39): reserved A4 placeholder page
  ["      >\n        <div class=\"pdf-pages\" id=\"pdfPages\"></div>\n      </div>",
   "      >\n        <div class=\"pdf-pages\" id=\"pdfPages\"><div class=\"pdf-page pdf-page--reserve\" aria-hidden=\"true\"></div></div>\n      </div>"],
  // 3433651 (PR #39): intrinsic size for the console avatar
  ["\n        <img class=\"exact-ramzi-avatar\" src=\"design-exact/assets/avatar/ramzi-A-idle.svg\" alt=\"\">\n        <div class=\"exact-ramzi-title\">",
   "\n        <img class=\"exact-ramzi-avatar\" src=\"design-exact/assets/avatar/ramzi-A-idle.svg\" alt=\"\" width=\"44\" height=\"44\" decoding=\"async\">\n        <div class=\"exact-ramzi-title\">"],
  // 3433651 (PR #39): intrinsic size for the help button avatar
  [">\n  <img src=\"design-exact/assets/avatar/ramzi-A-idle.svg\" alt=\"\"><span>עזרה מרמזי</span>\n</button>",
   ">\n  <img src=\"design-exact/assets/avatar/ramzi-A-idle.svg\" alt=\"\" width=\"36\" height=\"36\" decoding=\"async\"><span>עזרה מרמזי</span>\n</button>"],
  // 02b9903/f951efb (PR #32): Headless, preview and localhost hosts keep same-origin back links
  ["  var liveHost = /(?:^|\\.)noamdoronmath\\.co\\.il$/i.test(location.hostname);\n  var returnPath = navigationParams.get('back');\n  function worksheetsHrefFromReturn(urlObj, gradeNum, topicId){\n    var out = new URL(\"/worksheets\", location.origin);\n    if (urlObj && urlObj.searchParams){",
   "  var liveHost = /(?:^|\\.)noamdoronmath\\.co\\.il$/i.test(location.hostname);\n  var previewHost = /\\.wix-site-host\\.com$/i.test(location.hostname);\n  var localPreview = /^(localhost|127\\.0\\.0\\.1)$/i.test(location.hostname);\n  var onHeadlessHost = liveHost || previewHost || localPreview;\n  var worksheetsCatalogOrigin = onHeadlessHost\n    ? location.origin\n    : \"https://www.noamdoronmath.co.il\";\n  var returnPath = navigationParams.get('back');\n  function worksheetsHrefFromReturn(urlObj, gradeNum, topicId){\n    var out = new URL(\"/worksheets\", worksheetsCatalogOrigin);\n    if (urlObj && urlObj.searchParams){"],
  // 02b9903 (PR #32): same-origin back link path on Headless hosts
  ["    if (topicId){ out.searchParams.set(\"topic\", String(topicId)); }\n    return out.pathname + out.search;\n  }",
   "    if (topicId){ out.searchParams.set(\"topic\", String(topicId)); }\n    return onHeadlessHost ? out.pathname + out.search : out.href;\n  }"],
  // 02b9903 (PR #32): back links use the Headless catalog origin
  ["      var backHref;\n      if (liveHost || catalogReturn.pathname.indexOf(\"/worksheets\") === 0){\n        backHref = worksheetsHrefFromReturn(\n          catalogReturn.pathname.indexOf(\"/worksheets\") === 0 ? catalogReturn : new URL(\"/worksheets\"+catalogReturn.search, location.origin),\n          okGrade ? g : null,\n          null\n        );\n      } else if (!liveHost && legacyCatalog){\n        backHref = catalogReturn.href;\n      } else {",
   "      var backHref;\n      if (onHeadlessHost || catalogReturn.pathname.indexOf(\"/worksheets\") === 0){\n        backHref = worksheetsHrefFromReturn(\n          catalogReturn.pathname.indexOf(\"/worksheets\") === 0 ? catalogReturn : new URL(\"/worksheets\"+catalogReturn.search, worksheetsCatalogOrigin),\n          okGrade ? g : null,\n          null\n        );\n      } else if (!onHeadlessHost && legacyCatalog){\n        backHref = worksheetsHrefFromReturn(\n          new URL(\"/worksheets\" + catalogReturn.search, worksheetsCatalogOrigin),\n          okGrade ? g : null,\n          null\n        );\n      } else {"],
  // 3433651 (PR #39): noam-learning-boot.js lazy-Supabase cache-bust
  ["<script src=\"noam-learning-core.js?v=20260908-1\" defer></script>\n<script src=\"noam-learning-boot.js?v=20260908-1\" defer></script>\n<script src=\"ramzi/ramzi-avatar.js\"></script>",
   "<script src=\"noam-learning-core.js?v=20260908-1\" defer></script>\n<script src=\"noam-learning-boot.js?v=20261002-lazy-supabase\" defer></script>\n<script src=\"ramzi/ramzi-avatar.js\"></script>"],
  // f5964e9 (PR #39): mark the tools column settled once the tools open
  ["  if(!panel||!panelIn||!panelBody||!paper||!header||!fab||!close){return;}\n",
   "  if(!panel||!panelIn||!panelBody||!paper||!header||!fab||!close){return;}\n  var pdfSurface=document.getElementById('pdfSurface');\n  if(pdfSurface&&window.MutationObserver){\n    var markTools=function(){if(pdfSurface.classList.contains('has-pdf-tools')){pdfSurface.dataset.toolsSettled='1';}};\n    markTools();\n    new MutationObserver(markTools).observe(pdfSurface,{attributes:true,attributeFilter:['class']});\n  }\n"],
];

function headlessViewerFromRoot(source) {
  // 3433651 (PR #39): size-adjusted 'Heebo Fallback' in the presentation stylesheet only.
  let result = source.replace(/<style id="exact-viewer-presentation">[\s\S]*?<\/style>/, style => {
    assert.equal(style.split("Heebo,sans-serif").length - 1, 32);
    return style.replaceAll("Heebo,sans-serif", "Heebo,'Heebo Fallback',sans-serif");
  });
  for (const [from, to] of headlessOnlyEdits) {
    assert.equal(result.split(from).length - 1, 1, "Headless edit anchor must occur exactly once: " + from.slice(0, 80));
    result = result.replace(from, () => to);
  }
  return result;
}

test("root and Astro public viewers differ only by the reviewed Headless edits", () => {
  assert.equal(headlessViewerFromRoot(viewer), fs.readFileSync(path.join(publicRoot, "worksheet-viewer-noam.html"), "utf8"));
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
