/**
 * Entry-gate (ndGate) tests against an isolated fixture — never accepts terms
 * against production/live user storage.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'tests/fixtures/nd-gate');
const fixtureHtml = join(fixtureDir, 'gate-harness.html');

describe('M35 ndGate fixture-only', () => {
  it('source uses production copy + combined privacy href; storage key unchanged', () => {
    const gate = readFileSync(join(root, 'public/nd-site-gate.js'), 'utf8');
    assert.ok(gate.includes("STORAGE_KEY = 'nd_gate_accepted_v1'"));
    assert.ok(gate.includes('/accessibilityadaptation#privacy-policy'));
    assert.ok(gate.includes('הבהרה'));
    assert.ok(!gate.includes("PRIVACY_URL = '/privacy'"));
  });

  it('harness shows gate when storage empty and hides after accept (isolated context)', async () => {
    mkdirSync(fixtureDir, { recursive: true });
    const gateJs = readFileSync(join(root, 'public/nd-site-gate.js'), 'utf8');
    writeFileSync(
      fixtureHtml,
      `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>gate fixture</title>
<style>${readFileSync(join(root, 'src/styles/catalog.css'), 'utf8').match(/#ndGateOverlay[\s\S]*?\.nd-gate-foot[\s\S]*?}/)?.[0] || ''}</style>
</head><body><main>fixture</main><script>${gateJs}</script></body></html>`
    );
    const chrome = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(existsSync);
    assert.ok(chrome);
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.goto('file://' + fixtureHtml, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 300));
    const before = await page.evaluate(() => ({
      gate: !!document.getElementById('ndGateOverlay'),
      ls: localStorage.getItem('nd_gate_accepted_v1'),
    }));
    assert.equal(before.gate, true);
    assert.equal(before.ls, null);
    await page.click('#ndGateCheck');
    await page.click('#ndGateBtn');
    await new Promise((r) => setTimeout(r, 400));
    const after = await page.evaluate(() => ({
      gate: !!document.getElementById('ndGateOverlay'),
      ls: !!localStorage.getItem('nd_gate_accepted_v1'),
    }));
    assert.equal(after.gate, false);
    assert.equal(after.ls, true);
    await ctx.close();
    await browser.close();
  });
});
