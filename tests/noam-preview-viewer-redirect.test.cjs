"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "worksheet-viewer-noam.html"), "utf8");
const tag = html.match(/<script id="noam-preview-viewer-redirect">([\s\S]*?)<\/script>/);
assert.ok(tag, "viewer must ship the preview redirect");
const preview = "https://dcayws-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com";
const official = "https://www.noamdoronmath.co.il";
const viewerPath = "/worksheet-viewer-noam.html";

function navigate(href) {
  const url = new URL(href);
  const destinations = [];
  vm.runInNewContext(tag[1], { window: { location: {
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    replace: destination => destinations.push(destination),
    assign: () => { throw new Error("redirect must replace the broken history entry"); },
  } } });
  return destinations;
}

test("preview viewer redirects before the worksheet and AI scripts run", () => {
  assert.ok(html.indexOf(tag[0]) < html.indexOf("</head>"));
  assert.equal(html.indexOf("<script"), html.indexOf(tag[0]));
  assert.equal(html.split('id="noam-preview-viewer-redirect"').length, 2);
});

test("preserves the selected worksheet, level, siblings, title, back path and fragment byte-for-byte", () => {
  const suffix = "?g=7&x=G7-T09&lv=b&pdf=0b23b804f188450d900c4c514ff0d1fb&t=%D7%94%D7%A8%D7%97%D7%91%D7%94+%D7%97%D7%9C%D7%A7+1&pa=e8740dd02e8e412c9b099b231c6c255c&pb=0b23b804f188450d900c4c514ff0d1fb&pc=0f3f544c8e5a4cfe81d86d652bdbdf31&topic=9&back=%2Fworksheets%3Fgrade%3D7%26q%3Da%252Bb#worksheetMain";
  assert.deepEqual(navigate(preview + viewerPath + suffix), [official + viewerPath + suffix]);
});

test("covers new Noam previews and direct links with no query", () => {
  assert.deepEqual(navigate("https://abc123-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com" + viewerPath), [official + viewerPath]);
});

test("does not loop on the official domain or disrupt local and GitHub previews", () => {
  for (const origin of [official, "https://noamdoronmath.co.il", "http://localhost:4321", "http://127.0.0.1:4321", "https://noamd-collab.github.io"]) {
    assert.deepEqual(navigate(origin + viewerPath + "?g=7"), [], origin);
  }
});

test("does not redirect other Wix sites or misleading hostname suffixes", () => {
  for (const origin of [
    "https://other-site.wix-site-host.com",
    preview + ".example.org",
    "https://evil." + new URL(preview).hostname,
    "https://wix-site-host.com",
  ]) {
    assert.deepEqual(navigate(origin + viewerPath), [], origin);
  }
});

test("does not redirect catalogs, authentication pages, or other preview paths", () => {
  for (const pathname of ["/worksheets", "/learning.html", "/auth/callback", "/", "/other/worksheet-viewer-noam.html"]) {
    assert.deepEqual(navigate(preview + pathname + "?g=7#state"), [], pathname);
  }
});

test("query parameters cannot choose a different destination origin", () => {
  const suffix = "?redirect=https%3A%2F%2Fevil.example&back=%2F%2Fevil.example#https://evil.example";
  const [destination] = navigate(preview + viewerPath + suffix);
  assert.equal(new URL(destination).origin, official);
  assert.equal(destination, official + viewerPath + suffix);
});

test("the static copy and server HTML shell both receive the shared guard", () => {
  const publicHtml = fs.readFileSync(path.join(root, "headless/astro-poc/public/worksheet-viewer-noam.html"), "utf8");
  assert.equal(publicHtml.match(/<script id="noam-preview-viewer-redirect">[\s\S]*?<\/script>/)?.[0], tag[0]);
  const shells = fs.readFileSync(path.join(root, "headless/astro-poc/src/lib/publicHtmlShells.ts"), "utf8");
  assert.match(shells, /worksheet-viewer-noam\.html\?raw/);
});
