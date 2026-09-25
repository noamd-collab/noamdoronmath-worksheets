#!/usr/bin/env node
/**
 * HEADLESS-MIGRATION-11/12/13 — copy the DESIGN-FROZEN GitHub viewer + supporting
 * assets into public/, then apply minimal path adapters only.
 *
 * Does NOT copy PDF files (Wix Media). Manifests are synced separately via
 * `npm run sync:static` into public/noam-ai/manifests/ with provenance hashes.
 *
 * Usage: node scripts/sync-viewer-assets.mjs
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pocRoot = join(__dirname, '..');
const repoRoot = join(pocRoot, '..', '..');
const pub = join(pocRoot, 'public');
const vendorPub = join(pub, 'vendor');

const FILES = [
  'worksheet-viewer-noam.html',
  'learning.html',
  'noam-accessibility.js',
  'noam-bot-client.js',
  'noam-diagram-plan.js',
  'noam-didactic-guides.js',
  'noam-geometry.js',
  'noam-geometry-guides.js',
  'noam-glossary-curriculum.js',
  'noam-glossary.js',
  'noam-learning-boot.js',
  'noam-learning-catalog.js',
  'noam-learning-config.js',
  'noam-learning-core.js',
  'noam-learning.js',
  'noam-local-visual.js',
  'noam-learning.css',
];

const LEARNING_BASAD_STYLE =
  '<style id="nl-basad-headless">/* M37 Headless-only בס״ד — physical top-right; do not redesign learning layout */.nl-basad{position:absolute;top:8px;right:12px;left:auto;z-index:40;font-size:13px;font-weight:600;color:#1a2b4a;line-height:1;pointer-events:none}body.nl-page{position:relative}@media(max-width:650px){.nl-basad{top:6px;right:10px;font-size:12px}}</style>';

const LEARNING_LOGO_CSS =
  '.nl-header .nl-brand{display:inline-flex;align-items:center;line-height:0;text-decoration:none;color:inherit}.nl-brand__logo{display:block;width:min(168px,42vw);height:auto;border-radius:0;background:transparent;box-shadow:none}.nl-header{padding-top:14px}@media(max-width:650px){.nl-brand__logo{width:min(148px,46vw)}.nl-header{padding-top:16px}}';

const LEARNING_LOGO_IMG =
  '<img class="nl-brand__logo" src="/brand/noam-doron-math-logo-cropped.png" alt="נועם דורון מתמטיקה" width="573" height="243">';

/**
 * Headless-only chrome for learning.html, re-applied after the upstream copy.
 * Idempotent: a second run does not add another בס״ד, style block, or logo.
 * Does not rewrite worksheet-viewer markup.
 */
export function ensureHeadlessLearningChrome(html) {
  let learning = html;
  if (!learning.includes('id="nl-basad-headless"')) {
    if (!learning.includes('</head>')) {
      throw new Error('Failed to ensure Headless בס״ד on learning.html');
    }
    learning = learning.replace('</head>', `${LEARNING_BASAD_STYLE}</head>`);
  }
  if (!learning.includes('data-basad')) {
    if (!learning.includes('<body class="nl-page">')) {
      throw new Error('Failed to ensure Headless בס״ד on learning.html');
    }
    learning = learning.replace(
      '<body class="nl-page">',
      '<body class="nl-page"><div class="nl-basad" lang="he" data-basad>בס״ד</div>'
    );
  }
  learning = learning.replace(
    /(<style id="nl-basad-headless">)([\s\S]*?)(<\/style>)/,
    (full, open, body, close) =>
      body.includes('.nl-brand__logo{') ? full : `${open}${body}${LEARNING_LOGO_CSS}${close}`
  );
  // Upgrade already-generated learning pages as well as fresh upstream copies.
  // Only the base logo rule is owned here; retain mobile sizing and other styles.
  learning = learning.replace(
    /(<style id="nl-basad-headless">)([\s\S]*?)(<\/style>)/,
    (_, open, css, close) => `${open}${css.replace(
      /\.nl-brand__logo\{([^}]*\bdisplay\s*:[^}]*)\}/,
      (_, declarations) => `.nl-brand__logo{${declarations
        .split(';')
        .filter((declaration) => !/^\s*(?:background(?:-color)?|border-radius|box-shadow)\s*:/.test(declaration))
        .filter(Boolean)
        .join(';')};border-radius:0;background:transparent;box-shadow:none}`
    )}${close}`
  );
  const brandRe = /<a class="nl-brand" href="\/">([\s\S]*?)<\/a>/;
  const brand = learning.match(brandRe);
  if (!brand) throw new Error('Failed to ensure Headless learning logo');
  const logos = brand[1].match(/<img class="nl-brand__logo"/g) || [];
  if (logos.length > 1) throw new Error('Failed to ensure Headless learning logo');
  if (logos.length === 0) {
    learning = learning.replace(
      brandRe,
      `<a class="nl-brand" href="/">${LEARNING_LOGO_IMG}</a>`
    );
  }
  if (!learning.includes('data-basad') || !learning.includes('nl-basad')) {
    throw new Error('Failed to ensure Headless בס״ד on learning.html');
  }
  if ((learning.match(/<img class="nl-brand__logo"/g) || []).length !== 1) {
    throw new Error('Failed to ensure Headless learning logo');
  }
  return learning;
}

/**
 * Upstream viewer back= block (root worksheet-viewer-noam.html) and the
 * Headless replacement. headlessViewerBackBlock must stay identical to the
 * block in public/worksheet-viewer-noam.html.
 */
const headlessViewerBackUpstream = `/* BACK */

if (okGrade){

  document
    .getElementById("backBtn")
    .href =
    "./?grade=" +
    g;
}

/* PANEL — STATIC MANIFEST / NO SUPABASE CONTENT */

// Only accept a return path to this catalog, never an arbitrary redirect.
try {
  var navigationParams = new URL(location.href).searchParams;
  var catalogRoot = new URL('./', location.href);
  var returnPath = navigationParams.get('back');
  if (returnPath) {
    var catalogReturn = new URL(returnPath, location.href);
    if (catalogReturn.origin === location.origin &&
        (catalogReturn.pathname === catalogRoot.pathname || catalogReturn.pathname === catalogRoot.pathname + 'index.html')) {
      document.getElementById('backBtn').href = catalogReturn.href;
    }
  }
  if (/^\\d+$/.test(navigationParams.get('topic') || '') && okGrade) {
    var topicBack = document.createElement('a');
    topicBack.className = 'btn topic-back';
    topicBack.textContent = 'חזרה לנושא';
    topicBack.href = './?grade=' + g + '&topic=' + navigationParams.get('topic');
    document.getElementById('backBtn').after(topicBack);
  }
} catch (navigationError) { /* The default grade link remains available. */ }`;

export const headlessViewerBackBlock = `/* BACK — Headless adapter: default to legacy GitHub catalog (same UX target). */

if (okGrade){

  document
    .getElementById("backBtn")
    .href =
    "/worksheets?grade=" +
    g;
}

/* PANEL — STATIC MANIFEST / NO SUPABASE CONTENT */

// back= allowlist: same origin, or the production pair (www <-> apex).
// *.wix-site-host.com and localhost are managed viewer hosts only, so a
// page on those hosts still rejects github.io, but they are not back=
// targets from www or apex. A *.wix-site-host.com preview may return only
// to the production pair or to itself, not to another preview host.
try {
  var normalizeViewerHost = function (hostname) {
    return String(hostname || "").toLowerCase().replace(/\\.$/, "");
  };
  var isProductionPairHost = function (hostname) {
    var host = normalizeViewerHost(hostname);
    return host === "www.noamdoronmath.co.il" || host === "noamdoronmath.co.il";
  };
  var isManagedViewerHost = function (hostname) {
    var host = normalizeViewerHost(hostname);
    if (isProductionPairHost(host)) return true;
    if (/\\.wix-site-host\\.com$/i.test(host)) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
    return false;
  };
  // From www or apex, back= may only land on that pair.
  // From a *.wix-site-host.com preview, only the production pair or the
  // same preview host. Elsewhere, any managed viewer host remains a target.
  var allowlistedBackHost = function (currentHost, targetHost) {
    var current = normalizeViewerHost(currentHost);
    var target = normalizeViewerHost(targetHost);
    if (isProductionPairHost(current)) return isProductionPairHost(target);
    if (/\\.wix-site-host\\.com$/i.test(current)) {
      return isProductionPairHost(target) || target === current;
    }
    return isManagedViewerHost(target);
  };
  var navigationParams = new URL(location.href).searchParams;
  var catalogRoot = new URL('./', location.href);
  var legacyRoot = new URL(HEADLESS_LEGACY_PAGES);
  var isHeadlessHost = isManagedViewerHost(location.hostname);
  var returnPath = navigationParams.get('back');
  if (returnPath) {
    var catalogReturn;
    if (/^https?:\\/\\//i.test(returnPath)) {
      catalogReturn = new URL(returnPath);
    } else if (returnPath.indexOf("/noamdoronmath-worksheets") === 0) {
      catalogReturn = new URL(returnPath, legacyRoot.origin);
    } else if (returnPath.indexOf("/worksheets") === 0) {
      catalogReturn = new URL(returnPath, location.href);
    } else {
      catalogReturn = new URL(returnPath, location.href);
    }
    var catalogPathOk =
      catalogReturn.pathname === catalogRoot.pathname ||
      catalogReturn.pathname === catalogRoot.pathname + "index.html" ||
      catalogReturn.pathname === "/" ||
      catalogReturn.pathname === "/learning.html" ||
      catalogReturn.pathname === "/worksheets" ||
      catalogReturn.pathname.indexOf("/worksheets/") === 0;
    var sameOriginCatalog =
      catalogReturn.origin === location.origin &&
      catalogPathOk;
    var allowlistedCrossHost =
      catalogReturn.origin !== location.origin &&
      allowlistedBackHost(location.hostname, catalogReturn.hostname) &&
      catalogPathOk;
    var legacyCatalog =
      !isHeadlessHost &&
      catalogReturn.origin === legacyRoot.origin &&
      catalogReturn.pathname.indexOf(legacyRoot.pathname.replace(/\\/$/, "")) === 0;
    if (sameOriginCatalog || allowlistedCrossHost || legacyCatalog) {
      document.getElementById("backBtn").href = catalogReturn.href;
    } else if (isHeadlessHost && okGrade) {
      // Safe fallback: stay on this site's worksheets for this grade (never github.io).
      document.getElementById("backBtn").href = "/worksheets?grade=" + g;
    }
  }
  if (/^\\d+$/.test(navigationParams.get("topic") || "") && okGrade) {
    var topicBack = document.createElement("a");
    topicBack.className = "btn topic-back";
    topicBack.textContent = "חזרה לנושא";
    topicBack.href =
      "/worksheets?grade=" +
      g +
      "&topic=" +
      navigationParams.get("topic");
    document.getElementById("backBtn").after(topicBack);
  }
} catch (navigationError) { /* The default grade link remains available. */ }`;

export function applyHeadlessViewerBack(html) {
  if (html.includes(headlessViewerBackUpstream)) {
    html = html.replace(headlessViewerBackUpstream, headlessViewerBackBlock);
  } else if (!html.includes('HEADLESS_LEGACY_PAGES +') || !html.includes('legacyCatalog')) {
    console.warn('WARN: back-navigation block already patched or diverged; verify manually.');
  }
  if (html.includes('pathname.indexOf("/worksheets") === 0')) {
    throw new Error('back= guard regressed to pathname.indexOf("/worksheets") === 0');
  }
  return html;
}

const isDirectRun =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
mkdirSync(vendorPub, { recursive: true });

for (const name of FILES) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error('Missing source asset: ' + src);
  copyFileSync(src, join(pub, name));
}
copyFileSync(
  join(repoRoot, 'vendor', 'supabase-2.116.0.js'),
  join(vendorPub, 'supabase-2.116.0.js')
);
copyFileSync(
  join(repoRoot, 'vendor', 'supabase-LICENSE'),
  join(vendorPub, 'supabase-LICENSE')
);

const viewerPath = join(pub, 'worksheet-viewer-noam.html');
let html = readFileSync(viewerPath, 'utf8');

if (!html.includes('HEADLESS_MANIFEST_BASE')) {
  const apiNeedle =
    'var API =\n  "https://amiramnoam.wixstudio.com/my-site-2/_functions";';
  if (!html.includes(apiNeedle)) throw new Error('API config needle not found');
  html = html.replace(
    apiNeedle,
    `${apiNeedle}

/* HEADLESS-MIGRATION-11/13 adapters (reversible): keep UI identical; only path bases change.
   Manifests: same-origin public/noam-ai/manifests when HEADLESS_USE_LOCAL_MANIFESTS is true
   (rollback: set false to fetch GitHub Pages). PDFs stay on Wix Media. */
var HEADLESS_LEGACY_PAGES =
  "https://noamd-collab.github.io/noamdoronmath-worksheets/";
var HEADLESS_USE_LOCAL_MANIFESTS = true;
var HEADLESS_MANIFEST_BASE = HEADLESS_USE_LOCAL_MANIFESTS
  ? "./noam-ai/manifests/"
  : HEADLESS_LEGACY_PAGES + "noam-ai/manifests/";
var HEADLESS_LEGACY_INDEX = HEADLESS_USE_LOCAL_MANIFESTS
  ? "./legacy-github/index.html"
  : HEADLESS_LEGACY_PAGES + "index.html";`
  );
} else if (!html.includes('HEADLESS_USE_LOCAL_MANIFESTS')) {
  // Upgrade older adapter block in place.
  html = html.replace(
    `var HEADLESS_LEGACY_PAGES =
  "https://noamd-collab.github.io/noamdoronmath-worksheets/";
var HEADLESS_MANIFEST_BASE =
  HEADLESS_LEGACY_PAGES + "noam-ai/manifests/";`,
    `var HEADLESS_LEGACY_PAGES =
  "https://noamd-collab.github.io/noamdoronmath-worksheets/";
var HEADLESS_USE_LOCAL_MANIFESTS = true;
var HEADLESS_MANIFEST_BASE = HEADLESS_USE_LOCAL_MANIFESTS
  ? "./noam-ai/manifests/"
  : HEADLESS_LEGACY_PAGES + "noam-ai/manifests/";
var HEADLESS_LEGACY_INDEX = HEADLESS_USE_LOCAL_MANIFESTS
  ? "./legacy-github/index.html"
  : HEADLESS_LEGACY_PAGES + "index.html";`
  );
}

html = html.replace(
  'var MANIFEST_PATH = "./noam-ai/manifests/" + pdf + ".json?v=20260920-geometry";',
  'var MANIFEST_PATH = HEADLESS_MANIFEST_BASE + pdf + ".json?v=20260920-geometry";'
);

// M36: PDF base → domain-independent Wix Media CDN (cutover-safe; no PDF copies).
html = html.replace(
  /var BASE =\s*"https:\/\/www\.noamdoronmath\.co\.il\/_files\/ugd\/d8e7ad_";/,
  'var BASE =\n  "https://static.wixstatic.com/ugd/d8e7ad_";'
);
if (!html.includes('static.wixstatic.com/ugd/d8e7ad_')) {
  throw new Error('Viewer PDF BASE was not rewritten to Wix Media CDN');
}

html = html.replace(
  `function getPdfPageWidth(){
  // Reserve the fixed button gutter before scaling the document; gutter itself never scales.
  return Math.max(120,pdfScroll.clientWidth - (mobileLayout.matches ? 116 : 78)) * pdfZoom;
}`,
  `function getPdfPageWidth(){
  // Match live GitHub viewer: on phones, 70% zoom is the width that fits
  // beside the fixed button gutter. Scale only the PDF from there.
  if (mobileLayout.matches){
    return Math.max(120,pdfScroll.clientWidth - 116) * pdfZoom / .7;
  }
  return Math.max(120,pdfScroll.clientWidth - 78) * pdfZoom;
}`
);

html = html.replace(
  `  fetch(
    "./index.html",
    {
      cache:"default"
    }
  )`,
  `  fetch(
    HEADLESS_LEGACY_INDEX,
    {
      cache:"default"
    }
  )`
);

html = html.replace(
  `  fetch(
    HEADLESS_LEGACY_PAGES + "index.html",
    {
      cache:"default"
    }
  )`,
  `  fetch(
    HEADLESS_LEGACY_INDEX,
    {
      cache:"default"
    }
  )`
);

html = html.replace(
  `    '<a href="./">' +\n    'חזרה לדפי העבודה' +\n    '</a>'`,
  `    '<a href="/worksheets">' +\n    'חזרה לדפי העבודה' +\n    '</a>'`
);

html = applyHeadlessViewerBack(html);

if (!html.includes('HEADLESS_MANIFEST_BASE + pdf')) {
  throw new Error('Failed to apply MANIFEST_PATH adapter');
}

if (!html.includes('pdfZoom / .7')) {
  throw new Error('Failed to apply live GitHub mobile getPdfPageWidth');
}

writeFileSync(viewerPath, html);

const learningPath = join(pub, 'learning.html');
let learning = readFileSync(learningPath, 'utf8');
learning = learning.replaceAll('href="./"', 'href="/worksheets"');
// Preview brand/home must stay on the isolated Headless site, not production.
learning = learning.replaceAll(
  'href="https://www.noamdoronmath.co.il/"',
  'href="/"'
);
// M36: privacy policy → same-origin Headless page (not absolute production).
learning = learning.replaceAll(
  'href="https://www.noamdoronmath.co.il/accessibilityadaptation"',
  'href="/accessibilityadaptation"'
);
// M37 בס״ד plus the cropped logo. Re-inject after the upstream copy.
learning = ensureHeadlessLearningChrome(learning);
writeFileSync(learningPath, learning);

// M36: learning.js PDF construction → CDN (cutover-safe).
const learningJsPath = join(pub, 'noam-learning.js');
let learningJs = readFileSync(learningJsPath, 'utf8');
learningJs = learningJs.replaceAll(
  "https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_",
  'https://static.wixstatic.com/ugd/d8e7ad_'
);
writeFileSync(learningJsPath, learningJs);

console.log('Synced viewer assets → public/ (+ Headless path adapters)');
console.log('Manifests: run npm run sync:static (same-origin; rollback HEADLESS_USE_LOCAL_MANIFESTS=false)');
console.log('learning.html: ./ → /worksheets; brand → / (preview home)');
console.log('PDF BASE: static.wixstatic.com/ugd/d8e7ad_ (M36 cutover-safe CDN)');
console.log('Catalog links: PUBLIC_USE_HEADLESS_VIEWER in .env.local');
}
