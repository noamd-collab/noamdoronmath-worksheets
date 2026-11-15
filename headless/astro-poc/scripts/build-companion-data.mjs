// Preserve authoritative source bytes; only the worker representation is packed.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
function sourceMetadata(raw, kind) {
  const value = JSON.parse(raw.toString('utf8'));
  const records = kind === 'guide' ? value.records : kind === 'teacherIndex' ? value : null;
  const count = Array.isArray(records) ? records.length : undefined;
  if (!Number.isSafeInteger(count) || count < 1 || raw.length < 1 || raw.length > 8_000_000) throw Error('Invalid companion source shape');
  return { version: 1, kind, count, rawBytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex') };
}
export function packCompanionSource(raw, kind) {
  const metadata = sourceMetadata(raw, kind);
  const gzip = gzipSync(raw, { level: 9 });
  if (!gunzipSync(gzip).equals(raw)) throw Error('Companion pack round-trip failed');
  return { ...metadata, gzipBase64: gzip.toString('base64') };
}
function sources() {
  const data = new URL('../src/data/', import.meta.url);
  return {
    guide: readFileSync(new URL('site-guide.v1.json', data)),
    teacherIndex: readFileSync(new URL('teacher-pick-index.json', data)),
  };
}
export function compileCompanionData() {
  const raw = sources();
  return JSON.stringify({ version: 1,
    guide: packCompanionSource(raw.guide, 'guide'),
    teacherIndex: packCompanionSource(raw.teacherIndex, 'teacherIndex'),
  }) + '\n';
}
/** zlib versions may emit different gzip bytes for identical source bytes. */
export function validateCompanionData(packed) {
  if (!packed || packed.version !== 1 ||
      Object.keys(packed).sort().join(',') !== 'guide,teacherIndex,version') throw Error('Invalid companion pack envelope');
  for (const [kind, raw] of Object.entries(sources())) {
    const descriptor = packed[kind], expected = sourceMetadata(raw, kind);
    if (!descriptor || Object.keys(descriptor).sort().join(',') !== 'count,gzipBase64,kind,rawBytes,sha256,version' ||
        Object.entries(expected).some(([key, value]) => descriptor[key] !== value) ||
        typeof descriptor.gzipBase64 !== 'string' || descriptor.gzipBase64.length > 4_000_000) throw Error('Companion worker data is stale');
    const compressed = Buffer.from(descriptor.gzipBase64, 'base64');
    if (compressed.toString('base64') !== descriptor.gzipBase64) throw Error('Invalid companion base64');
    if (!gunzipSync(compressed, { maxOutputLength: raw.length }).equals(raw)) {
      throw Error('Companion worker source bytes differ');
    }
  }
  return true;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('../src/data/companion-worker-data.json', import.meta.url);
  let output;
  if (process.argv.includes('--check')) {
    output = readFileSync(target, 'utf8');
    validateCompanionData(JSON.parse(output));
  } else {
    output = compileCompanionData();
    writeFileSync(target, output);
  }
  console.log(JSON.stringify({ packedBytes: Buffer.byteLength(output), sourceFiles: 2 }));
}
