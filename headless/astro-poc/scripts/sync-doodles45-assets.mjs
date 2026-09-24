#!/usr/bin/env node
/**
 * DOODLES-45 — copy peer media webp + verify SHA256 into public/brand/doodles
 * and refresh src/data/doodles.manifest.json.
 *
 * Usage:
 *   node scripts/sync-doodles45-assets.mjs
 *   DOODLES45_MEDIA=/path node scripts/sync-doodles45-assets.mjs
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir =
  process.env.DOODLES45_MEDIA ||
  '/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/media/doodles-45';
const publicDir = join(root, 'public', 'brand', 'doodles');
const manifestPath = join(root, 'src', 'data', 'doodles.manifest.json');

mkdirSync(publicDir, { recursive: true });

if (!existsSync(mediaDir)) {
  console.error('BLOCKER: media dir missing:', mediaDir);
  console.error(
    'ACTION_NEEDED: supervisor must place 10 transparent *.webp (+ manifest.json) under media/doodles-45/'
  );
  process.exit(2);
}

const sidecarPath = join(mediaDir, 'manifest.json');
let supervisorAssets = null;
if (existsSync(sidecarPath)) {
  const raw = JSON.parse(readFileSync(sidecarPath, 'utf8'));
  if (Array.isArray(raw.assets) && raw.assets.length) {
    supervisorAssets = raw.assets;
    console.log('using supervisor manifest assets=', supervisorAssets.length);
  }
}

const webpOnDisk = new Set(
  readdirSync(mediaDir).filter((f) => f.toLowerCase().endsWith('.webp'))
);

/** @type {{ id: string, file: string, src: string, sha256?: string, bytes?: number }[]} */
let plan = [];
if (supervisorAssets) {
  for (const a of supervisorAssets) {
    const file = `${a.id}.webp`;
    if (!webpOnDisk.has(file)) {
      console.error(`BLOCKER: missing file for asset id=${a.id} expected ${file}`);
      process.exit(2);
    }
    plan.push({
      id: a.id,
      file,
      src: a.src || `/brand/doodles/${file}`,
      sha256: a.sha256,
      bytes: a.bytes,
    });
  }
} else {
  const files = [...webpOnDisk].sort();
  if (!files.length) {
    console.error('BLOCKER: no .webp files in', mediaDir);
    console.error(
      'ACTION_NEEDED: drop 10 individual transparent doodle webp assets into media/doodles-45/ then re-run sync.'
    );
    process.exit(2);
  }
  plan = files.map((file) => ({
    id: file.replace(/\.webp$/i, ''),
    file,
    src: `/brand/doodles/${file}`,
  }));
}

const motifs = [];
const hashReport = [];

for (const item of plan) {
  const srcPath = join(mediaDir, item.file);
  const buf = readFileSync(srcPath);
  const sha = createHash('sha256').update(buf).digest('hex');
  if (item.bytes != null && buf.length !== item.bytes) {
    console.error(`BYTES_MISMATCH ${item.file}: got ${buf.length} want ${item.bytes}`);
    process.exit(3);
  }
  if (item.sha256) {
    const want = String(item.sha256).toLowerCase();
    if (want !== sha) {
      console.error(`HASH_MISMATCH ${item.file}: got ${sha} want ${want}`);
      process.exit(3);
    }
    hashReport.push({ file: item.file, sha256: sha, verified: true, bytes: buf.length });
  } else {
    hashReport.push({ file: item.file, sha256: sha, verified: false, bytes: buf.length });
  }
  copyFileSync(srcPath, join(publicDir, item.file));
  motifs.push({ id: item.id, src: item.src });
  console.log('copied', item.file, `(${buf.length} B)`, sha.slice(0, 12) + '…');
}

if (motifs.length < 10) {
  console.warn(`WARN: expected 10 motifs, found ${motifs.length}`);
}

const prev = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : {};

const next = {
  version: 1,
  updatedAt: new Date().toISOString(),
  publicBase: '/brand/doodles',
  note:
    'DOODLES-45 — ten individual transparent webp motifs from peer media/doodles-45/.',
  coverage: prev.coverage || {
    includes: 'All public Astro pages via BaseLayout → SiteDoodles (pathname-seeded).',
    excludes: [
      'Homepage / — keeps DOODLES-44 HeroIllustrations two-cluster (no double density)',
      'public/worksheet-viewer-noam.html — exercise viewer; no BaseLayout',
      'public/learning.html and learning UI — no BaseLayout doodle injection',
      'Printed PDFs / @media print — site doodles display:none',
      'Static tools under public/ (fx-82ms etc.) — outside Astro shell',
    ],
  },
  motifs,
  hashReport,
};

writeFileSync(manifestPath, JSON.stringify(next, null, 2) + '\n');
writeFileSync(
  join(mediaDir, 'sync-report.json'),
  JSON.stringify({ ok: true, motifs, hashReport }, null, 2) + '\n'
);

console.log(`SYNC_OK motifs=${motifs.length} manifest=${manifestPath}`);
if (motifs.length < 10) process.exit(4);
