/**
 * HEADLESS-MIGRATION-32 — worksheets URL-state contract unit tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildWorksheetsHref,
  parseWorksheetsUrlState,
  worksheetsBackPath,
  worksheetsHrefForGrade,
  worksheetsSearchParams,
  worksheetsStateEqual,
} from '../src/lib/worksheetsUrlState.ts';

describe('worksheetsUrlState contract (M32)', () => {
  it('round-trips grade + q + group + cross + track', () => {
    const href = buildWorksheetsHref({
      grade: 9,
      q: 'משוואות',
      group: 'alg',
      cross: true,
      track: 'red',
      topic: 12,
    });
    assert.equal(
      href,
      '/worksheets?grade=9&q=%D7%9E%D7%A9%D7%95%D7%95%D7%90%D7%95%D7%AA&group=alg&cross=1&track=red&topic=12'
    );
    const parsed = parseWorksheetsUrlState(new URL(href, 'https://example.test').searchParams);
    assert.equal(parsed.grade, 9);
    assert.equal(parsed.q, 'משוואות');
    assert.equal(parsed.group, 'alg');
    assert.equal(parsed.cross, true);
    assert.equal(parsed.track, 'red');
    assert.equal(parsed.topic, 12);
  });

  it('omits default filter params from the URL', () => {
    const href = buildWorksheetsHref({
      grade: 7,
      q: '',
      group: 'all',
      cross: false,
      track: 'reg',
      topic: null,
    });
    assert.equal(href, '/worksheets?grade=7');
    const p = worksheetsSearchParams({
      grade: 7,
      q: '  ',
      group: 'all',
      cross: false,
      track: 'reg',
      topic: null,
    });
    assert.equal(p.toString(), 'grade=7');
  });

  it('preserves q/cross across grade tabs; resets group and topic', () => {
    const href = worksheetsHrefForGrade(8, {
      q: 'משוואות',
      group: 'geo',
      cross: true,
      track: 'red',
      topic: 99,
    });
    assert.equal(href, '/worksheets?grade=8&q=%D7%9E%D7%A9%D7%95%D7%95%D7%90%D7%95%D7%AA&cross=1');
    const parsed = parseWorksheetsUrlState(new URL(href, 'https://x.test').searchParams);
    assert.equal(parsed.group, 'all');
    assert.equal(parsed.topic, null);
    assert.equal(parsed.track, 'reg');
  });

  it('keeps track only when destination is grade 9', () => {
    assert.equal(
      worksheetsHrefForGrade(9, { q: 'x', track: 'red' }),
      '/worksheets?grade=9&q=x&track=red'
    );
    assert.equal(
      worksheetsHrefForGrade(7, { q: 'x', track: 'red' }),
      '/worksheets?grade=7&q=x'
    );
  });

  it('viewer back path drops topic highlight but keeps filters', () => {
    const back = worksheetsBackPath({
      grade: 7,
      q: 'משוואות',
      group: 'alg',
      cross: true,
      track: 'reg',
      topic: 5,
    });
    assert.equal(
      back,
      '/worksheets?grade=7&q=%D7%9E%D7%A9%D7%95%D7%95%D7%90%D7%95%D7%AA&group=alg&cross=1'
    );
    assert.ok(!back.includes('topic='));
  });

  it('state equality ignores stringify differences in whitespace q', () => {
    assert.equal(
      worksheetsStateEqual(
        { grade: 7, q: 'ab', group: 'all', cross: false, track: 'reg', topic: null },
        { grade: 7, q: 'ab', group: 'all', cross: false, track: 'reg', topic: null }
      ),
      true
    );
  });

  it('worksheets document titles do not carry the Astro POC suffix', () => {
    const src = readFileSync('src/pages/worksheets.astro', 'utf8');
    assert.equal(src.includes('(Astro POC)'), false);
    assert.equal(src.includes('אב־טיפוס Astro'), false);
    assert.ok(src.includes('title={`דפי עבודה · ${gradeEntry!.label}`}'));
    assert.ok(src.includes('title="כיתה לא חוקית"'));
    assert.ok(src.includes('title="כיתה חסרה"'));
  });
});
