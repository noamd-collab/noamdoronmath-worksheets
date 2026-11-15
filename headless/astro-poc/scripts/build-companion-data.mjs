// Preserve authoritative source bytes; only the worker representation is packed.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export function packCompanionSource(raw, kind) {
  const value = JSON.parse(raw.toString('utf8'));
  const count = kind === 'guide' ? value.records?.length : Array.isArray(value) ? value.length : undefined;
  if (!Number.isSafeInteger(count) || count < 1) throw Error('Invalid companion source shape');
  const gzip = gzipSync(raw, { level: 9 });
  if (!gunzipSync(gzip).equals(raw)) throw Error('Companion pack round-trip failed');
  return { version: 1, kind, count, rawBytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'), gzipBase64: gzip.toString('base64') };
}
export function compileCompanionData() {
  const data = new URL('../src/data/', import.meta.url);
  return JSON.stringify({ version: 1,
    guide: packCompanionSource(readFileSync(new URL('site-guide.v1.json', data)), 'guide'),
    teacherIndex: packCompanionSource(readFileSync(new URL('teacher-pick-index.json', data)), 'teacherIndex'),
  }) + '\n';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('../src/data/companion-worker-data.json', import.meta.url), output = compileCompanionData();
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw Error('Companion worker data is stale');
  } else writeFileSync(target, output);
  console.log(JSON.stringify({ packedBytes: Buffer.byteLength(output), sourceFiles: 2 }));
}
