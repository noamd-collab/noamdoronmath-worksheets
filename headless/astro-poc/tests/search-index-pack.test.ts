import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

test('the packed search index inflates to the committed JSON bytes', () => {
  const text = readFileSync(new URL('../src/data/search-index.v1.json', import.meta.url));
  const packed = readFileSync(new URL('../src/data/search-index.v1.json.gz.b64', import.meta.url), 'utf8');
  assert.deepEqual(gunzipSync(Buffer.from(packed.trim(), 'base64')), text);
});
