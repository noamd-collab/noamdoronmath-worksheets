/**
 * Phone: a tap on הבנתי / לא הבנתי while the message field has focus counts
 * on the first tap. Blurring the field drops .is-typing and moves the buttons
 * before mouseup, so the viewer acts on touchend in that case and cancels the
 * synthesized click. Without a focused field the native click is kept.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
const adapter = viewer.match(/<script id="exact-viewer-adapter">([\s\S]*?)<\/script>/)?.[1] || '';
const start = adapter.indexOf('  var checkTouch=null');
const end = adapter.indexOf('  sync();', start);
const handlers = adapter.slice(start, end);

function setup() {
  const { document, window } = parseHTML(`<html><body><div id="panelBody">
    <div class="noam-row assistant"><div class="noam-bubble"><span>רמז</span>
      <div class="ramzi-check"><button type="button" class="ramzi-check-yes" data-ramzi-check="understood">הבנתי</button><button type="button" class="ramzi-check-no" data-ramzi-check="not-understood">לא הבנתי</button></div>
    </div></div>
    <textarea id="noamQuestion"></textarea>
  </div></body></html>`);
  const panelBody = document.getElementById('panelBody')!;
  const field = document.getElementById('noamQuestion')! as any;
  let active: any = document.body;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => active });
  field.blur = () => { if (active === field) active = document.body; };
  const submitted: string[] = [];
  runInNewContext(handlers, {
    document, window, panelBody, body: document.body,
    submitUnderstanding(intent: string) { submitted.push(intent); },
  });
  function touch(type: string, target: any, x: number, y: number, touches: number) {
    const event = new window.Event(type, { bubbles: true, cancelable: true }) as any;
    const point = { identifier: 1, clientX: x, clientY: y };
    Object.defineProperty(event, 'changedTouches', { value: [point] });
    Object.defineProperty(event, 'touches', { value: touches ? [point] : [] });
    target.dispatchEvent(event);
    return event;
  }
  function click(target: any, detail: number) {
    const event = new window.Event('click', { bubbles: true, cancelable: true }) as any;
    Object.defineProperty(event, 'detail', { value: detail });
    target.dispatchEvent(event);
  }
  return {
    yes: document.querySelector('.ramzi-check-yes')!, no: document.querySelector('.ramzi-check-no')!,
    field, submitted, touch, click,
    focusField() { active = field; },
    isActive(el: unknown) { return active === el; },
  };
}

test('a tap while the message field has focus answers on touchend, once', () => {
  const t = setup();
  for (const [button, intent] of [[t.yes, 'understood'], [t.no, 'not-understood']] as const) {
    t.focusField();
    t.touch('touchstart', button, 100, 200, 1);
    const end = t.touch('touchend', button, 102, 201, 0);
    assert.equal(end.defaultPrevented, true, 'the synthesized mouse events and click are cancelled');
    assert.equal(t.isActive(t.field), false, 'the field blurs so the keyboard closes');
    assert.equal(t.submitted.at(-1), intent);
    t.click(button, 1);
  }
  assert.deepEqual(t.submitted, ['understood', 'not-understood'], 'a click that still arrives is the same tap');
  t.click(t.yes, 0);
  assert.deepEqual(t.submitted, ['understood', 'not-understood', 'understood'], 'keyboard activation still counts');
});

test('without a focused field, or on a drag, the touch handler leaves the native click alone', () => {
  const t = setup();
  t.touch('touchstart', t.yes, 100, 200, 1);
  assert.equal(t.touch('touchend', t.yes, 100, 200, 0).defaultPrevented, false);
  assert.deepEqual(t.submitted, []);
  t.click(t.yes, 1);
  assert.deepEqual(t.submitted, ['understood']);

  t.focusField();
  t.touch('touchstart', t.no, 100, 200, 1);
  t.touch('touchmove', t.no, 100, 230, 1);
  assert.equal(t.touch('touchend', t.no, 100, 230, 0).defaultPrevented, false);
  assert.deepEqual(t.submitted, ['understood'], 'a scroll that starts on the button is not an answer');
  assert.equal(t.isActive(t.field), true);
});
