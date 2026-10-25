/**
 * redirects-map.csv is the cut-over report.
 * High-confidence 301 rows must match redirects.json. Uncertain rows are not implemented.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { REDIRECT_RULES, resolveRedirect } from '../src/lib/redirects';

type Row = {
  oldUrl: string;
  newUrl: string;
  status: string;
  confidence: string;
};

function parseCsv(text: string): Row[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  assert.deepEqual(header, ['כתובת ישנה', 'כתובת חדשה', 'סטטוס', 'ביטחון בהתאמה']);
  return lines.slice(1).map((line) => {
    const [oldUrl, newUrl, status, confidence] = line.split(',');
    return { oldUrl, newUrl, status, confidence };
  });
}

const rows = parseCsv(readFileSync(new URL('../redirects-map.csv', import.meta.url), 'utf8'));

describe('redirects-map.csv', () => {
  it('keeps the triangle-area worksheets redirect off /powers-grade-7', () => {
    const row = rows.find((r) => r.oldUrl.endsWith('/triangle-area-grade-7-worksheets'));
    assert.ok(row);
    assert.equal(row.status, '301');
    assert.equal(row.confidence, 'גבוה');
    assert.equal(row.newUrl, 'https://www.noamdoronmath.co.il/triangle-area-grade-7');
    assert.equal(resolveRedirect('/triangle-area-grade-7-worksheets'), '/triangle-area-grade-7');
  });

  it('implements only high-confidence 301 rows, and they match the middleware map', () => {
    const implemented = rows.filter((r) => r.status === '301');
    assert.equal(implemented.length, REDIRECT_RULES.length);
    for (const row of implemented) {
      assert.equal(row.confidence, 'גבוה', row.oldUrl);
      const from = new URL(row.oldUrl).pathname;
      const rule = REDIRECT_RULES.find((r) => r.from === from);
      assert.ok(rule, from);
      assert.equal(row.newUrl, `https://www.noamdoronmath.co.il${rule.to}`);
    }
    for (const row of rows.filter((r) => r.confidence === 'לא ודאי')) {
      assert.equal(row.status, 'דוח-בלבד');
      assert.equal(resolveRedirect(new URL(row.oldUrl).pathname), null);
    }
  });

  it('does not redirect /workflow', () => {
    const row = rows.find((r) => r.oldUrl.endsWith('/workflow'));
    assert.ok(row);
    assert.equal(row.status, '404-מכוון');
    assert.equal(resolveRedirect('/workflow'), null);
  });
});
