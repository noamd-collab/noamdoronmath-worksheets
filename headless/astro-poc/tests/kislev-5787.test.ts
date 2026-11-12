/**
 * Home-page Kislev 5787 strip: date window and the greeting wiring.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isKislev5787, KISLEV_5787_END_MS, KISLEV_5787_START_MS } from '../src/lib/kislev5787.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (iso: string) => Date.parse(iso);

describe('Kislev 5787 home greeting', () => {
  it('is visible only from 11 Nov 2026 through 12 Dec 2026, Israel time', () => {
    assert.equal(KISLEV_5787_START_MS, at('2026-11-11T00:00:00+02:00'));
    assert.equal(KISLEV_5787_END_MS, at('2026-12-13T00:00:00+02:00'));
    assert.equal(isKislev5787(at('2026-11-10T23:59:59+02:00')), false);
    assert.equal(isKislev5787(KISLEV_5787_START_MS), true);
    assert.equal(isKislev5787(at('2026-11-12T20:00:00+02:00')), true);
    assert.equal(isKislev5787(at('2026-12-04T16:00:00+02:00')), true);
    assert.equal(isKislev5787(at('2026-12-10T12:00:00+02:00')), true);
    assert.equal(isKislev5787(KISLEV_5787_END_MS - 1), true);
    assert.equal(isKislev5787(KISLEV_5787_END_MS), false);
    assert.equal(isKislev5787(at('2025-12-15T12:00:00+02:00')), false);
    assert.equal(isKislev5787(at('2027-11-11T12:00:00+02:00')), false);
  });

  it('puts a real-text greeting on the home page without a second h1', () => {
    const cmp = readFileSync(join(root, 'src/components/KislevGreeting.astro'), 'utf8');
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
    assert.match(cmp, /חודש כסלו טוב!/);
    assert.match(cmp, /שמונה לילות אור, וסכום נרות המצווה/);
    assert.match(cmp, /1\+2\+…\+8 = 36/);
    assert.match(cmp, /define:vars=\{\{ start: KISLEV_5787_START_MS, end: KISLEV_5787_END_MS \}\}/);
    assert.match(cmp, /classList\.add\('kislev-5787'\)/);
    assert.match(cmp, /id="kislev-5787"/);
    assert.match(cmp, /data-kislev-greeting/);
    assert.match(cmp, /prefers-reduced-motion:\s*reduce/);
    assert.match(cmp, /html\.nd-motion-off/);
    assert.match(cmp, /html\.noam-a11y-motion/);
    assert.match(cmp, /unicode-bidi:\s*isolate/);
    assert.match(cmp, /white-space:\s*nowrap/);
    assert.doesNotMatch(cmp, /<h1\b/);
    assert.doesNotMatch(cmp, /<aside\b/);
    assert.match(index, /import KislevGreeting from '\.\.\/components\/KislevGreeting\.astro'/);
    assert.match(index, /<KislevGreeting \/>/);
    assert.equal((index.match(/<h1\b/g) || []).length, 1);
    assert.ok(index.indexOf('<KislevGreeting />') < index.indexOf('<h1'), 'greeting stays above the h1');
  });
});
