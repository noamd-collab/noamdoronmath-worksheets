import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { setupTopicSharing } from '../src/lib/topicSharing';
import { canonicalUrl } from '../src/lib/siteSeo';
import { buildWorksheetHref, worksheetActionLabel } from '../src/lib/worksheetLinks';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';

const topicUrl = 'https://www.noamdoronmath.co.il/counting-grade-1';

function control() {
  const { document } = parseHTML(`<html><body>
    <div data-topic-share>
      <button type="button" data-copy-topic-url>העתקת קישור לנושא</button>
      <span role="status" data-topic-share-status></span>
      <label hidden data-topic-share-fallback><input readonly value="${topicUrl}" /></label>
    </div>
  </body></html>`);
  const button = document.querySelector('button') as HTMLButtonElement;
  const status = document.querySelector('[role="status"]') as HTMLElement;
  const fallback = document.querySelector('label') as HTMLElement;
  const input = document.querySelector('input') as HTMLInputElement;
  let selected = false;
  input.select = () => { selected = true; };
  return { document, button, status, fallback, input, selected: () => selected };
}

test('copying a topic shares its branded landing page once, with success only after clipboard completion', async () => {
  const f = control();
  const copied: string[] = [];
  let complete!: () => void;
  const clipboard = { writeText: (text: string) => {
    copied.push(text);
    return new Promise<void>((resolve) => { complete = resolve; });
  } };
  setupTopicSharing(f.document, clipboard);
  setupTopicSharing(f.document, clipboard);
  f.button.click();
  assert.deepEqual(copied, [topicUrl]);
  assert.equal(f.button.disabled, true);
  assert.equal(f.status.textContent, '');
  complete();
  await Promise.resolve();
  assert.equal(f.status.textContent, 'הקישור לנושא הועתק');
  assert.equal(f.button.disabled, false);
  assert.equal(f.fallback.hidden, true);
});

test('denied clipboard reveals and selects the same landing URL, without claiming success', async () => {
  const f = control();
  setupTopicSharing(f.document, { writeText: async () => { throw new Error('NotAllowedError'); } });
  f.button.click();
  await Promise.resolve();
  assert.equal(f.fallback.hidden, false);
  assert.equal(f.input.value, topicUrl);
  assert.equal(f.selected(), true);
  assert.doesNotMatch(f.status.textContent || '', /הועתק/);
  assert.equal(f.button.disabled, false);
});

test('missing clipboard API still gives a manually copyable URL', () => {
  const f = control();
  setupTopicSharing(f.document, undefined);
  f.button.click();
  assert.equal(f.fallback.hidden, false);
  assert.equal(f.selected(), true);
  assert.equal(f.button.disabled, false);
});

test('topic canonical is independent of preview host and tracking state', () => {
  assert.equal(canonicalUrl('/counting-grade-1', '?utm_source=whatsapp&lv=b'), topicUrl);
});

test('real counting level B names a PDF action while preserving the original file', () => {
  const catalog = loadCatalog();
  const topic = catalog.grades.find((g) => g.grade === 1)!.topics.find((t) => t.id === 1)!;
  const href = buildWorksheetHref({ catalog, grade: 1, topic, levelKey: 'b' });
  assert.equal(href, 'https://static.wixstatic.com/ugd/d8e7ad_93024cad97864567b17f16023aec04ed.pdf');
  assert.equal(worksheetActionLabel('רמה ב׳', href), 'רמה ב׳ · פתיחת PDF');
  assert.equal(worksheetActionLabel('פתיחת PDF', href), 'פתיחת PDF');
  assert.equal(worksheetActionLabel('רמה א׳', '/worksheets/new.PDF?download=1#page=2'), 'רמה א׳ · פתיחת PDF');
});

test('viewer and in-page navigation do not claim to open a direct PDF', () => {
  assert.equal(worksheetActionLabel('רמה א׳', '/worksheet-viewer-noam.html?pdf=example.pdf'), 'רמה א׳');
  assert.equal(worksheetActionLabel('בחירת רמה', '#topic-levels'), 'בחירת רמה');
});
