import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function releasedFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\n}\n', start);
  assert(start >= 0 && end > start, `complete released ${name}`);
  return source.slice(start, end + 2);
}

test('temporary drawing requests stay hidden, unfocusable and absent from accessibility while original diagrams still enlarge', async () => {
  const browser = await puppeteer.launch({ executablePath: resolveTestBrowser(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setOfflineMode(true);
    const client = await page.createCDPSession();
    for (const [label, file] of [
      ['public', join(root, 'public/worksheet-viewer-noam.html')],
      ['source', join(root, '../../worksheet-viewer-noam.html')],
    ]) {
      const source = readFileSync(file, 'utf8');
      const styles = [...source.slice(0, source.indexOf('</head>')).matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
        .map(match => match[1]).join('\n');
      const released = ['setNoamDiagramButtonLabel', 'noamVisualCanExpand', 'addTranscriptBubble', 'noamAddDiagramExpansion']
        .map(name => releasedFunction(source, name)).join('\n');
      for (const width of [1280, 390]) for (const phase of ['first', 'restored', 'retry']) {
        await page.setViewport({ width, height: 844 });
        await page.setContent(`<!doctype html><html lang="he" dir="rtl"><head><style>${styles}</style></head>
          <body class="exact-viewer"><main style="max-width:360px;margin:12px auto">
          <div id="host"></div><div class="noam-compose"><div class="noam-input-actions">
          <button id="noamDraw" class="noam-action">שרטוט להמחשה</button>
          <button id="noamHint" class="noam-action">רמז נוסף</button>
          </div></div></main></body></html>`, { waitUntil: 'domcontentloaded' });
        // Execute the actual released transcript renderer and enlargement handler.
        // Dependencies are isolated: no model, authentication or network service runs.
        await page.addScriptTag({ content: `
          var selectedExercise={id:'G9-T85-B-Q01א'}, drawingRequests=0, textRequests=0;
          var noamStripMarkdownEmphasis=function(v){return v;};
          var noamCanOfferDrawing=function(){return true;};
          var noamDiagramRuntime=function(){return {messages:new Map()};};
          var noamMessageVisualOptions=function(){return {};};
          var requestNoamDiagram=function(){drawingRequests++;};
          var noamAppendSourceDiagramHelp=function(){};
          var noamAppendSourceCropHelp=function(){};
          var noamRenderSourceCrop=function(){
            var figure=document.createElement('figure');figure.className='noam-native-figure noam-source-crop';
            figure.innerHTML='<svg class="noam-geometry-svg" viewBox="0 0 240 160" role="img" aria-label="איור השאלה המקורית"><path d="M20 140 L120 20 L220 140 Z" fill="none" stroke="black" stroke-width="3"/></svg><figcaption>איור השאלה המקורית</figcaption>';
            return figure;
          };
          ${released}
          document.getElementById('noamHint').addEventListener('click',function(){textRequests++;});
        ` });
        await page.evaluate((state) => {
          const w = window as any;
          const raw: any = { text: 'בדקו אילו נתונים מופיעים בשאלה.' };
          if (state === 'restored') raw.visual = { type: 'source-crop' };
          if (state === 'retry') raw.diagramError = 'אירעה שגיאה בשרטוט';
          const message = state === 'restored' ? JSON.parse(JSON.stringify(raw)) : raw;
          w.addTranscriptBubble(document.getElementById('host'), 'assistant', message.text, '', message.visual || null,
            message, { messages: [message], history: [] });
          // Busy/restored handlers can remove hidden or enable the control; CSS must still win.
          const main = document.getElementById('noamDraw') as HTMLButtonElement;
          main.hidden = false; main.disabled = false; main.style.display = 'block';
        }, phase);
        const hidden = await page.$$eval('#noamDraw,.noam-draw-action:not(.noam-diagram-expand)', nodes => nodes.map(node => {
          (node as HTMLElement).focus();
          return { display: getComputedStyle(node).display, rects: node.getClientRects().length,
            focused: document.activeElement === node, name: node.getAttribute('aria-label') || node.textContent };
        }));
        assert.equal(hidden.length, 2, `${label}/${width}/${phase}: main and rendered message control`);
        for (const item of hidden) assert.deepEqual([item.display, item.rects, item.focused], ['none', 0, false]);
        const ax = await client.send('Accessibility.getFullAXTree');
        const buttonNames = ax.nodes.filter(n => !n.ignored && n.role?.value === 'button').map(n => n.name?.value);
        for (const item of hidden) assert(!buttonNames.includes(item.name), 'hidden request absent from accessible buttons');
        await page.focus('#noamHint');
        for (let n = 0; n < 8; n++) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement?.matches('#noamDraw,.noam-draw-action:not(.noam-diagram-expand)')), false);
        }
        await page.click('#noamHint');
        assert.deepEqual(await page.evaluate(() => [(window as any).textRequests, (window as any).drawingRequests]), [1, 0]);
        assert.match(await page.$eval('#host', el => el.textContent || ''), /בדקו אילו נתונים/);
        if (process.env.NOAM_DRAWING_HIDE_SCREENSHOT_DIR) {
          mkdirSync(process.env.NOAM_DRAWING_HIDE_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: join(process.env.NOAM_DRAWING_HIDE_SCREENSHOT_DIR, `${label}-${width}-${phase}.png`) });
        }
        if (phase === 'restored') {
          assert.equal(await page.$eval('.noam-geometry-svg', el => el.getBoundingClientRect().width > 0), true);
          const original = await page.$eval('.noam-geometry-svg', el => el.outerHTML);
          await page.click('.noam-diagram-expand');
          assert.equal(await page.$eval('.noam-diagram-dialog', el => (el as HTMLDialogElement).open), true);
          assert.equal(await page.$eval('.noam-diagram-dialog .noam-geometry-svg', el => el.outerHTML), original);
          if (process.env.NOAM_DRAWING_HIDE_SCREENSHOT_DIR) {
            mkdirSync(process.env.NOAM_DRAWING_HIDE_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: join(process.env.NOAM_DRAWING_HIDE_SCREENSHOT_DIR, `${label}-${width}-source-enlargement.png`) });
          }
          await page.click('.noam-diagram-dialog-close');
          assert.equal(await page.$eval('.noam-diagram-expand', el => document.activeElement === el), true);
          assert.equal(await page.evaluate(() => (window as any).drawingRequests), 0, 'enlargement does not request a drawing');
        }
      }
    }
  } finally { await browser.close(); }
});
