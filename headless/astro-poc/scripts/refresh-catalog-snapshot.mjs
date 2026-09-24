#!/usr/bin/env node
/**
 * Refresh the in-repo catalog snapshot from the authoritative generated file.
 *
 * Source (do not hand-edit): headless/catalog/catalog.v1.json
 * Destination:               src/data/catalog.v1.json
 * Metadata:                  src/data/catalog.snapshot.json
 * Hash file:                 src/data/catalog.v1.json.sha256
 *
 * Usage:
 *   npm run refresh:catalog
 *   npm run check:catalog
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.resolve(root, '..', 'catalog', 'catalog.v1.json');
const destDir = path.join(root, 'src', 'data');
const dest = path.join(destDir, 'catalog.v1.json');
const metaPath = path.join(destDir, 'catalog.snapshot.json');
const hashPath = path.join(destDir, 'catalog.v1.json.sha256');

const mode = process.argv[2] === 'check' ? 'check' : 'refresh';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readSource() {
  if (!fs.existsSync(source)) {
    throw new Error('Authoritative catalog missing: ' + source);
  }
  return fs.readFileSync(source);
}

if (mode === 'refresh') {
  const buf = readSource();
  const hash = sha256(buf);
  fs.mkdirSync(destDir, { recursive: true });
  // Remove symlink if present — snapshot must be a real file.
  try {
    if (fs.lstatSync(dest).isSymbolicLink()) fs.unlinkSync(dest);
  } catch {
    /* absent ok */
  }
  fs.writeFileSync(dest, buf);
  fs.writeFileSync(hashPath, hash + '  catalog.v1.json\n');
  const meta = {
    generatedAt: new Date().toISOString(),
    sourcePath: 'headless/catalog/catalog.v1.json',
    sourceSha256: hash,
    bytes: buf.length,
    note: 'Deterministic snapshot copied from authoritative generated catalog. Do not hand-edit. Refresh via npm run refresh:catalog.',
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  console.log('Refreshed catalog snapshot');
  console.log('  source:', source);
  console.log('  dest:  ', dest);
  console.log('  sha256:', hash);
  console.log('  bytes: ', buf.length);
  process.exit(0);
}

// check mode: snapshot must match authoritative when available; always match its sidecar hash
if (!fs.existsSync(dest) || fs.lstatSync(dest).isSymbolicLink()) {
  console.error('FAIL: src/data/catalog.v1.json must be a real file snapshot (not a symlink)');
  process.exit(1);
}
const snap = fs.readFileSync(dest);
const snapHash = sha256(snap);
const recorded = fs.existsSync(hashPath)
  ? fs.readFileSync(hashPath, 'utf8').trim().split(/\s+/)[0]
  : null;
if (recorded !== snapHash) {
  console.error('FAIL: snapshot bytes do not match catalog.v1.json.sha256');
  console.error('  file:', snapHash);
  console.error('  meta:', recorded);
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
if (meta.sourceSha256 !== snapHash) {
  console.error('FAIL: catalog.snapshot.json sourceSha256 mismatch');
  process.exit(1);
}
if (fs.existsSync(source)) {
  const authHash = sha256(fs.readFileSync(source));
  if (authHash !== snapHash) {
    console.error('FAIL: snapshot is stale vs authoritative catalog');
    console.error('  snapshot:     ', snapHash);
    console.error('  authoritative:', authHash);
    console.error('  run: npm run refresh:catalog');
    process.exit(1);
  }
  console.log('OK: snapshot matches authoritative catalog', snapHash);
} else {
  console.log('OK: snapshot self-consistent (authoritative source not present)', snapHash);
}
process.exit(0);
