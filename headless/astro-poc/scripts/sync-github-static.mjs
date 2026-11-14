#!/usr/bin/env node
/**
 * HEADLESS-MIGRATION-13 — sync static Noam AI manifests into public/ for
 * same-origin preview serving.
 *
 * Selection (generic, no worksheet exceptions):
 *   published non-PDF-only edition PDFs not explicitly disabled, plus legacy topics
 *   with routing.usesViewer (and siblingPdfQuery ids). PDFs are not copied.
 *
 * Source of truth: repo-root noam-ai/manifests/ (mirrors GitHub Pages).
 *
 * Usage:
 *   node scripts/sync-github-static.mjs          # sync + write provenance
 *   node scripts/sync-github-static.mjs check    # verify hashes vs provenance
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeWorksheetEditions } from '../../../scripts/lib/worksheet-editions.cjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pocRoot = join(__dirname, '..');
const repoRoot = join(pocRoot, '..', '..');
const catalogPath = join(pocRoot, 'src', 'data', 'catalog.v1.json');
const sourceDir = join(repoRoot, 'noam-ai', 'manifests');
const outDir = join(pocRoot, 'public', 'noam-ai', 'manifests');
const provenancePath = join(pocRoot, 'public', 'noam-ai', 'sync-provenance.json');
const legacyIndexOut = join(pocRoot, 'public', 'legacy-github', 'index.html');
const legacyIndexSrc = join(repoRoot, 'index.html');

const mode = process.argv[2] === 'check' ? 'check' : 'sync';

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function collectViewerPdfIds(catalog) {
  const ids = new Set();
  for (const g of catalog.grades || []) {
    for (const t of g.topics || []) {
      for (const edition of t.editions || []) if (edition.status === 'published' && edition.publicationMode !== 'pdf-only') {
        for (const level of edition.levels) if (level.aiReady !== false) ids.add(level.pdfId);
      }
      if (!t.routing?.usesViewer) continue;
      for (const lv of t.levels || []) {
        if (lv.pdfId) ids.add(String(lv.pdfId).toLowerCase());
      }
      const sib = t.routing.siblingPdfQuery || {};
      for (const key of ['pa', 'pb', 'pc']) {
        if (sib[key]) ids.add(String(sib[key]).toLowerCase());
      }
    }
  }
  return [...ids].sort();
}

function loadCatalog() {
  return mergeWorksheetEditions(JSON.parse(readFileSync(catalogPath, 'utf8')),
    JSON.parse(readFileSync(join(repoRoot, 'headless/catalog/worksheet-editions.v1.json'), 'utf8')));
}

function buildFileMap(pdfIds) {
  const files = {};
  const missing = [];
  for (const id of pdfIds) {
    const src = join(sourceDir, id + '.json');
    if (!existsSync(src)) {
      missing.push(id);
      continue;
    }
    files[id] = {
      source: 'noam-ai/manifests/' + id + '.json',
      sha256: sha256File(src),
      bytes: readFileSync(src).byteLength,
    };
  }
  if (missing.length) {
    throw new Error('Missing source manifests for viewer pdfIds: ' + missing.slice(0, 8).join(','));
  }
  return files;
}

function aggregateSha(files) {
  const h = createHash('sha256');
  for (const id of Object.keys(files).sort()) {
    h.update(id + ':' + files[id].sha256 + '\n');
  }
  return h.digest('hex');
}

function writeProvenance(pdfIds, files, extras = {}) {
  const provenance = {
    contractVersion: 1,
    purpose: 'HEADLESS-MIGRATION-13 same-origin static manifests for Wix preview',
    sourceOfTruth: {
      path: 'noam-ai/manifests/',
      mirrors: 'https://noamd-collab.github.io/noamdoronmath-worksheets/noam-ai/manifests/',
      note: 'Canonical bytes live in the repo; GitHub Pages serves the same tree. PDFs stay on Wix Media.',
    },
    selection: {
      rule: 'published non-PDF-only worksheet editions unless level.aiReady=false + legacy topics with routing.usesViewer (+ siblingPdfQuery)',
      catalogPath: 'src/data/catalog.v1.json',
      count: pdfIds.length,
    },
    generatedAt: new Date().toISOString(),
    aggregateSha256: aggregateSha(files),
    files,
    ...extras,
  };
  writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
  return provenance;
}

function sync() {
  if (!existsSync(sourceDir)) {
    throw new Error('Missing source dir: ' + sourceDir);
  }
  const catalog = loadCatalog();
  const pdfIds = collectViewerPdfIds(catalog);
  const files = buildFileMap(pdfIds);

  mkdirSync(outDir, { recursive: true });
  // Existing public manifests also serve historical releases and original
  // source references. A new edition must never prune those dependencies.
  const retainedLegacy = Object.fromEntries(readdirSync(outDir)
    .filter(name => /^[a-f0-9]{32}\.json$/.test(name) && !files[name.slice(0, -5)])
    .map(name => [name.slice(0, -5), sha256File(join(outDir, name))]));

  for (const id of pdfIds) {
    copyFileSync(join(sourceDir, id + '.json'), join(outDir, id + '.json'));
  }

  mkdirSync(dirname(legacyIndexOut), { recursive: true });
  copyFileSync(legacyIndexSrc, legacyIndexOut);
  const legacy = {
    path: 'public/legacy-github/index.html',
    source: 'index.html',
    sha256: sha256File(legacyIndexOut),
    bytes: readFileSync(legacyIndexOut).byteLength,
    note: 'Sibling-level discovery fallback when pa/pb/pc are incomplete; not the Astro home route.',
  };

  const provenance = writeProvenance(pdfIds, files, { legacyIndex: legacy, retainedLegacy });
  const bytes = Object.values(files).reduce((n, f) => n + f.bytes, 0);
  console.log(
    `Synced ${pdfIds.length} manifests → public/noam-ai/manifests/ (${(bytes / 1024 / 1024).toFixed(1)} MiB)`
  );
  console.log('aggregateSha256', provenance.aggregateSha256);
  console.log('legacy index →', legacy.path, legacy.sha256.slice(0, 12) + '…');
}

function check() {
  if (!existsSync(provenancePath)) {
    throw new Error('Missing provenance: ' + provenancePath + ' (run sync first)');
  }
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  const catalog = loadCatalog();
  const pdfIds = collectViewerPdfIds(catalog);
  if (pdfIds.length !== provenance.selection.count) {
    throw new Error(
      `Selection count drift: catalog ${pdfIds.length} vs provenance ${provenance.selection.count}`
    );
  }
  for (const id of pdfIds) {
    const meta = provenance.files[id];
    if (!meta) throw new Error('Provenance missing pdfId ' + id);
    const pub = join(outDir, id + '.json');
    const src = join(sourceDir, id + '.json');
    if (!existsSync(pub)) throw new Error('Missing public manifest ' + id);
    if (!existsSync(src)) throw new Error('Missing source manifest ' + id);
    const pubHash = sha256File(pub);
    const srcHash = sha256File(src);
    if (pubHash !== meta.sha256 || srcHash !== meta.sha256) {
      throw new Error(`Hash mismatch for ${id}: provenance=${meta.sha256} pub=${pubHash} src=${srcHash}`);
    }
  }
  const files = {};
  for (const id of pdfIds) files[id] = provenance.files[id];
  const agg = aggregateSha(files);
  if (agg !== provenance.aggregateSha256) {
    throw new Error('Aggregate sha mismatch');
  }
  if (provenance.legacyIndex) {
    if (!existsSync(legacyIndexOut)) throw new Error('Missing legacy index copy');
    const h = sha256File(legacyIndexOut);
    if (h !== provenance.legacyIndex.sha256) {
      throw new Error('Legacy index hash mismatch');
    }
  }
  for (const [id, digest] of Object.entries(provenance.retainedLegacy || {})) {
    if (sha256File(join(outDir, id + '.json')) !== digest) throw new Error('Retained legacy manifest changed: ' + id);
  }
  console.log(
    `OK: ${pdfIds.length} manifests match source+provenance ${provenance.aggregateSha256}`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (mode === 'check') check();
  else { sync(); check(); }
}
