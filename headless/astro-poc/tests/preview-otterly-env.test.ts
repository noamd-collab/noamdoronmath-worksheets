import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('preview build sees the Otterly env field', () => {
  it('declares optional OTTERLY_API_KEY the same way as astro.config.mjs', () => {
    const line = /OTTERLY_API_KEY: envField\.string\(\{ context: 'server', access: 'secret', optional: true \}\)/;
    for (const file of ['astro.config.mjs', 'astro.config.preview.mjs', 'astro.config.open07-verify.mjs']) {
      assert.match(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), line, file);
    }
  });
});
