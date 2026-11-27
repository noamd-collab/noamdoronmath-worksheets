/**
 * Home-page Hanukkah 5787 strip: it replaces Kislev, and the sum stays behind a tap.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { HANUKKAH_5787_END_MS, HANUKKAH_5787_START_MS, homeHolidayStrip, isHanukkah5787 } from '../src/lib/hanukkah5787.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (iso: string) => Date.parse(iso);

describe('Hanukkah 5787 home greeting', () => {
  it('shows only from 3 Dec 2026 through 12 Dec 2026, Israel time, and replaces Kislev', () => {
    assert.equal(HANUKKAH_5787_START_MS, at('2026-12-03T00:00:00+02:00'));
    assert.equal(HANUKKAH_5787_END_MS, at('2026-12-13T00:00:00+02:00'));
    assert.equal(homeHolidayStrip(at('2026-12-02T23:59:59+02:00')), 'kislev');
    assert.equal(isHanukkah5787(at('2026-12-02T23:59:59+02:00')), false);
    assert.equal(homeHolidayStrip(HANUKKAH_5787_START_MS), 'hanukkah');
    assert.equal(homeHolidayStrip(at('2026-12-05T12:00:00+02:00')), 'hanukkah');
    assert.equal(homeHolidayStrip(HANUKKAH_5787_END_MS - 1), 'hanukkah');
    assert.equal(homeHolidayStrip(HANUKKAH_5787_END_MS), null);
    assert.equal(isHanukkah5787(HANUKKAH_5787_END_MS), false);
    assert.equal(homeHolidayStrip(at('2026-11-12T12:00:00+02:00')), 'kislev');
    assert.equal(homeHolidayStrip(at('2026-12-13T00:00:00+02:00')), null);
  });

  it('reuses the Kislev strip and reveals the candle sum on tap', () => {
    const cmp = readFileSync(join(root, 'src/components/KislevGreeting.astro'), 'utf8');
    assert.match(cmp, /חג חנוכה שמח! 🕎/);
    assert.match(cmp, /נר אחר נר מוסיפים אור, וגם בלמידה מוסיפים צעד אחר צעד\./);
    assert.match(cmp, /בלילה השמיני מדליקים 8 נרות, בלי השמש\. כמה נרות מדליקים בכל שמונת הלילות יחד, בלי השמש\?/);
    assert.match(cmp, /1\+2\+…\+8 = 36/);
    assert.match(cmp, /36\+8 = 44/);
    assert.match(cmp, /data-hanukkah-ask/);
    assert.match(cmp, /data-hanukkah-answer hidden/);
    assert.match(cmp, /answer\.hidden = false/);
    assert.match(cmp, /holidayDate/);
    assert.match(cmp, /classList\.add\('hanukkah-5787'\)/);
    assert.match(cmp, /else if \(now >= start && now < end\)/);
    assert.match(cmp, /@keyframes kislev-flame/);
    assert.doesNotMatch(cmp, /@keyframes (?!kislev-flame)/);
    assert.doesNotMatch(cmp, /<h1\b/);
    assert.equal((cmp.match(/classList\.add\(/g) || []).length, 2);
  });
});
