import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium.ts';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');
const controls = [
  'noamOverview', 'noamHint', 'noamMistake', 'noamDraw', 'noamSend',
  'noamQuestion', 'noamNewThread', 'noamMathToggle',
];

// Execute the released functions, including the real thread lookup. The DOM
// fixture supplies controls only; it does not duplicate the exhaustion rule.
function releasedFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the released viewer`);
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${name} must have a complete declaration`);
  return source.slice(start, end + 2);
}

function harness(source: string, hintIndex: number) {
  const id = 'G9-T44-B-Q01א';
  const elements = Object.fromEntries(controls.map(name => [name, { disabled: true }]));
  const mathKeys = [{ disabled: true }, { disabled: true }];
  const threads: Record<string, { hintIndex: number; history: unknown[]; messages: unknown[] }> = {
    [id]: { hintIndex, history: [], messages: [] },
  };
  const state = {
    busy: false,
    pendingExerciseId: id as string | null,
    selectedExercise: { id } as { id: string } | null,
    threads,
    document: { getElementById: (name: string) => elements[name] || null },
    panelBody: {
      querySelectorAll: (selector: string) => {
        assert.equal(selector, '[data-math]');
        return mathKeys;
      },
    },
  };
  const setBusy = runInNewContext(
    `${releasedFunction(source, 'exerciseThread')}\n${releasedFunction(source, 'setNoamBusy')}\nsetNoamBusy;`,
    state,
  ) as (busy: boolean) => void;
  return { id, elements, mathKeys, state, setBusy };
}

for (const [label, file] of [
  ['packaged site viewer', join(appRoot, 'public/worksheet-viewer-noam.html')],
  ['source viewer', join(repoRoot, 'worksheet-viewer-noam.html')],
] as const) {
  const source = readFileSync(file, 'utf8');
  describe(`Ramzi hint exhaustion: ${label}`, () => {
    it('keeps the hint button disabled when busy state clears after the third hint', () => {
      const h = harness(source, 3);
      h.setBusy(false);
      assert.equal(h.elements.noamHint.disabled, true);
      assert.equal(h.elements.noamSend.disabled, false);
      assert.equal(h.elements.noamNewThread.disabled, false);
      assert.equal(h.state.pendingExerciseId, null);
    });

    it('reenables a hint when a new thread resets the exhausted hint count', () => {
      const h = harness(source, 3);
      h.setBusy(false);
      assert.equal(h.elements.noamHint.disabled, true);
      h.state.threads[h.id] = { hintIndex: 0, history: [], messages: [] };
      h.setBusy(false);
      assert.equal(h.elements.noamHint.disabled, false);
    });

    it('keeps all composer controls disabled during an active operation', () => {
      for (const count of [0, 3]) {
        const h = harness(source, count);
        h.setBusy(true);
        for (const element of Object.values(h.elements)) assert.equal(element.disabled, true);
        for (const key of h.mathKeys) assert.equal(key.disabled, true);
        assert.equal(h.state.pendingExerciseId, h.id);
      }
    });

    it('permits remaining hints and handles an empty selection', () => {
      for (const count of [0, 1, 2]) {
        const h = harness(source, count);
        h.setBusy(false);
        assert.equal(h.elements.noamHint.disabled, false);
      }
      const h = harness(source, 0);
      h.state.selectedExercise = null;
      assert.doesNotThrow(() => h.setBusy(false));
      assert.equal(h.elements.noamHint.disabled, false);
    });
  });
}

it('keeps hidden drawing controls out of both released layouts at desktop and phone widths', async () => {
  const browser = await puppeteer.launch({
    executablePath: resolveTestBrowser(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    // This fixture exercises the real CSS cascade, with no server, catalogue,
    // model, login or external request involved.
    await page.setOfflineMode(true);
    for (const file of [
      join(appRoot, 'public/worksheet-viewer-noam.html'),
      join(repoRoot, 'worksheet-viewer-noam.html'),
    ]) {
      const source = readFileSync(file, 'utf8');
      const head = source.slice(0, source.indexOf('</head>'));
      const styles = [...head.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
        .map(match => match[1]).join('\n');
      assert.ok(styles.length, 'The released inline styles must be present');
      for (const width of [1280, 390]) {
        await page.setViewport({ width, height: 844 });
        await page.setContent(`<!doctype html><html lang="he" dir="rtl"><head><style>${styles}</style></head>
          <body class="exact-viewer"><div class="noam-compose"><div class="noam-input-actions">
          <button id="noamDraw" class="noam-action" hidden>שרטוט להמחשה</button>
          <button id="visibleControl" class="noam-action">רמז</button>
          </div></div></body></html>`, { waitUntil: 'domcontentloaded' });
        const hidden = await page.$eval('#noamDraw', element => ({
          display: getComputedStyle(element).display,
          rectangles: element.getClientRects().length,
        }));
        assert.equal(hidden.display, 'none', `${file}: hidden draw control at width ${width}`);
        assert.equal(hidden.rectangles, 0);
        assert.equal(await page.$eval('#visibleControl', element => element.getClientRects().length > 0), true);
        await page.$eval('#noamDraw', element => { element.hidden = false; });
        assert.equal(await page.$eval('#noamDraw', element => element.getClientRects().length > 0), true,
          'A drawing control that policy permits must remain available');
      }
    }
  } finally {
    await browser.close();
  }
});
