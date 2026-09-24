/**
 * Assert catalog.css pins בס״ד to physical `right` (not RTL inset-inline-end).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('basad physical top-right (M33)', () => {
  it('uses physical right/top, not inset-inline-end', () => {
    const css = readFileSync('src/styles/catalog.css', 'utf8');
    const block = css.match(/\.basad\s*\{[^}]+\}/s);
    assert.ok(block, 'missing .basad rule');
    assert.ok(/right:\s*\d+px/.test(block[0]), block[0]);
    assert.ok(/top:\s*\d+px/.test(block[0]), block[0]);
    assert.ok(!/inset-inline-end/.test(block[0]), 'must not use inset-inline-end under RTL');
    assert.ok(css.includes('[data-basad]') || readFileSync('src/components/SiteHeader.astro', 'utf8').includes('data-basad'));
  });
});
