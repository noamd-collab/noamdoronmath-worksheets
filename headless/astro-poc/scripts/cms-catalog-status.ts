#!/usr/bin/env node
/**
 * CMS-43 — catalog CMS status / dry-run (read-only).
 *
 * Reports what is snapshot-backed vs live-CMS-connected.
 * Never writes to Wix CMS. Never prints secrets.
 *
 * Usage:
 *   npx tsx scripts/cms-catalog-status.ts
 *   npm run check:cms
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCatalogCmsStatus,
  DEFAULT_CMS_CONNECTIONS,
} from '../src/lib/cms/catalogCmsContract.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadJson(p: string, fallback: unknown = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const connectionsPath = path.join(root, 'src/data/cms.connections.json');
const connections = loadJson(connectionsPath, DEFAULT_CMS_CONNECTIONS) as typeof DEFAULT_CMS_CONNECTIONS;

// Runtime catalog (pdfBase normalized to Wix Media CDN in loadCatalog).
const catalog = loadCatalog();
const rawSnap = loadJson(path.join(root, 'src/data/catalog.v1.json'), null) as {
  config?: { pdfBase?: string };
} | null;

const status = buildCatalogCmsStatus({ connections, catalogRaw: catalog });
if (rawSnap?.config?.pdfBase && rawSnap.config.pdfBase !== catalog.config.pdfBase) {
  status.notes.push(
    `raw snapshot pdfBase=${rawSnap.config.pdfBase} → runtime normalizePdfBase → ${catalog.config.pdfBase}`
  );
}

const outDir = path.join(root, 'reports', 'cms-43');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'catalog-cms-status.json');
fs.writeFileSync(outPath, JSON.stringify(status, null, 2) + '\n');

console.log(JSON.stringify(status, null, 2));
console.log('report:', outPath);
console.log(
  status.liveCmsConnected ? 'CMS_CATALOG: LIVE_CONNECTED' : 'CMS_CATALOG: SNAPSHOT_ONLY'
);
if (status.missingExternalInput) {
  console.log('MISSING_EXTERNAL_INPUT:', status.missingExternalInput);
}
process.exit(status.ok ? 0 : 1);
