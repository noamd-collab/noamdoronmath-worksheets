import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { enhanceTopicSelect } from '../public/teachers/teacher-topic-search.js';

type Choice = (value: string, select: HTMLSelectElement) => unknown | Promise<unknown>;
function harness(options: { onChoose?: Choice; focused?: boolean; empty?: boolean } = {}) {
  const { document, window } = parseHTML(`<html><body><div><label for="topic">נושא</label><select id="topic">
    ${options.empty ? '' : '<option value="1">שְׁבָרִים פשוטים</option><option value="2">חיבור שברים</option><option value="3">משוואות ממעלה ראשונה</option><option value="4">משוואות ריבועיות</option>'}
    </select></div><button id="outside">המשך</button></body></html>`);
  let active: HTMLElement | null = null;
  Object.defineProperty(document, 'activeElement', { get: () => active });
  const decorate = (element: HTMLElement) => {
    Object.defineProperty(element, 'focus', { value: () => {
      if (active === element) return;
      const previous = active;
      active = element;
      previous?.dispatchEvent(new window.Event('blur'));
      element.dispatchEvent(new window.Event('focus'));
    } });
    Object.defineProperty(element, 'blur', { value: () => {
      if (active === element) active = null;
      element.dispatchEvent(new window.Event('blur'));
    } });
    if (element.tagName === 'INPUT') {
      Object.defineProperty(element, 'select', { value: () => { element.setAttribute('data-selected-text', (element as HTMLInputElement).value); } });
    }
    return element;
  };
  const create = document.createElement.bind(document);
  document.createElement = ((name: string) => decorate(create(name))) as typeof document.createElement;
  const select = decorate(document.getElementById('topic')!) as HTMLSelectElement;
  const outside = decorate(document.getElementById('outside')!);
  let value = options.empty ? '' : '3';
  Object.defineProperty(select, 'value', { get: () => value, set: (next: string) => { value = String(next); } });
  select.disabled = false;
  if (options.focused) select.focus();
  const calls: string[] = [];
  let nativeChanges = 0;
  select.addEventListener('change', () => { nativeChanges += 1; });
  const controller = enhanceTopicSelect(select, { onChoose: async chosen => {
    calls.push(chosen);
    if (options.onChoose) return options.onChoose(chosen, select);
    select.value = chosen;
  } });
  const input = document.getElementById('topic-search')! as HTMLInputElement;
  const toggle = document.querySelector('.topic-search-toggle')! as HTMLButtonElement;
  const list = document.getElementById('topic-search-list')!;
  const popup = document.querySelector('.topic-search-popup')! as HTMLElement;
  const status = document.querySelector('.topic-search-status')!;
  const event = (type: string, fields: Record<string, unknown> = {}) => {
    const next = new window.Event(type, { bubbles: true, cancelable: true });
    Object.entries(fields).forEach(([key, field]) => Object.defineProperty(next, key, { value: field }));
    return next;
  };
  return { document, select, input, list, toggle, popup, status, calls, controller, outside, event,
    nativeChanges: () => nativeChanges,
    type(text: string) { input.value = text; input.dispatchEvent(event('input')); },
    key(key: string, extra: Record<string, unknown> = {}) { input.dispatchEvent(event('keydown', { key, ...extra })); },
    clickOption(index: number) { list.children[index].dispatchEvent(event('click', { pointerType: 'touch' })); },
    shown() { return [...list.children].map(option => option.textContent); },
  };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('enhancement preserves native options and associates the existing label with an accessible search field', () => {
  const app = harness();
  assert.equal(app.select.hidden, true);
  assert.equal(app.select.querySelectorAll('option').length, 4);
  assert.equal(app.select.value, '3');
  assert.equal(app.input.value, 'משוואות ממעלה ראשונה');
  assert.equal(app.document.querySelector('label')?.getAttribute('for'), 'topic-search');
  assert.equal(app.input.getAttribute('role'), 'combobox');
  assert.equal(app.input.getAttribute('aria-autocomplete'), 'list');
  assert.equal(app.input.getAttribute('aria-controls'), app.list.id);
  assert.match(app.input.getAttribute('aria-describedby')!, /topic-search-help/);
  assert.equal(app.document.getElementById('topic-search-help')?.textContent, 'הקלידו לחיפוש או פתחו את הרשימה');
  assert.equal(app.list.getAttribute('role'), 'listbox');
  assert.equal(app.document.querySelectorAll('[role="status"]').length, 1);
  assert.equal(app.popup.hidden, true);
  app.input.focus();
  assert.equal(app.input.getAttribute('data-selected-text'), 'משוואות ממעלה ראשונה');
  assert.equal(app.shown().length, 4, 'Focus on the current title offers the full native list');
});

test('typing filters normalized Hebrew titles without choosing a topic or emitting native changes', () => {
  const app = harness();
  app.input.focus();
  app.type(' שברים   ');
  assert.deepEqual(app.shown(), ['שְׁבָרִים פשוטים', 'חיבור שברים']);
  assert.equal(app.input.getAttribute('aria-activedescendant'), null);
  assert.equal(app.select.value, '3');
  assert.deepEqual(app.calls, []);
  assert.equal(app.nativeChanges(), 0);
  assert.match(app.status.textContent!, /2/);
  app.controller.sync();
  assert.equal(app.input.value, ' שברים   ', 'An unrelated render must not erase the search draft');
  assert.equal(app.popup.hidden, false);
});

test('zero results remain uncommitted and Enter cannot turn arbitrary text into a topic', async () => {
  const app = harness();
  app.type('נושא שלא קיים');
  assert.equal(app.shown().length, 0);
  assert.equal((app.document.querySelector('.topic-search-empty') as HTMLElement).hidden, false);
  assert.match(app.status.textContent!, /לא נמצאו/);
  app.key('ArrowDown');
  app.key('Enter');
  await settle();
  assert.equal(app.select.value, '3');
  assert.deepEqual(app.calls, []);
});

test('arrows only highlight; Enter commits exactly the explicitly highlighted native option', async () => {
  const app = harness();
  app.input.focus();
  app.type('שברים');
  Object.defineProperty(app.list, 'clientHeight', { value: 44 });
  Object.defineProperty(app.list, 'clientTop', { value: 0 });
  app.list.scrollTop = 0;
  app.list.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
  [...app.list.children].forEach((option, index) => {
    option.getBoundingClientRect = () => ({ top: 100 + index * 44 - app.list.scrollTop, height: 44 } as DOMRect);
    (option as HTMLElement).scrollIntoView = () => { assert.fail('Keyboard navigation must not scroll the page'); };
  });
  app.key('ArrowDown');
  assert.equal(app.input.getAttribute('aria-activedescendant'), app.list.children[0].id);
  assert.equal(app.list.children[0].getAttribute('aria-selected'), 'true');
  app.key('ArrowDown');
  assert.equal(app.list.children[0].getAttribute('aria-selected'), 'false');
  assert.equal(app.list.children[1].getAttribute('aria-selected'), 'true');
  assert.equal(app.list.scrollTop, 44, 'The second result is revealed inside the result list');
  assert.equal(app.select.value, '3');
  assert.deepEqual(app.calls, []);
  app.key('Enter');
  await settle();
  assert.deepEqual(app.calls, ['2']);
  assert.equal(app.select.value, '2');
  assert.equal(app.input.value, 'חיבור שברים');
  assert.equal(app.popup.hidden, true);
  assert.equal(app.document.activeElement, app.input);
});

test('IME key events cannot commit a composing search', async () => {
  const app = harness();
  app.input.focus();
  app.type('שברים');
  app.key('ArrowDown');
  app.key('Enter', { isComposing: true });
  app.key('Enter', { keyCode: 229 });
  await settle();
  assert.deepEqual(app.calls, []);
  assert.equal(app.select.value, '3');
});

for (const way of ['Escape', 'Tab', 'blur', 'close']) {
  test(`${way} restores the actual selected title without committing typed text`, () => {
    const app = harness();
    app.input.focus();
    app.type('שברים');
    app.key('ArrowDown');
    if (way === 'blur') app.outside.focus();
    else if (way === 'close') app.controller.close();
    else app.key(way);
    assert.equal(app.popup.hidden, true);
    assert.equal(app.input.value, 'משוואות ממעלה ראשונה');
    assert.equal(app.input.getAttribute('aria-activedescendant'), null);
    assert.equal(app.select.value, '3');
    assert.deepEqual(app.calls, []);
  });
}

test('cancelling the caller confirmation restores the canonical topic, while touch/click commits only once', async () => {
  const app = harness({ onChoose: () => {} });
  app.type('שברים');
  app.clickOption(1);
  await settle();
  assert.deepEqual(app.calls, ['2']);
  assert.equal(app.select.value, '3');
  assert.equal(app.input.value, 'משוואות ממעלה ראשונה');
  assert.equal(app.popup.hidden, true);
});

test('the full-list button ignores an active search query and keeps focus in the input', () => {
  const app = harness();
  app.input.focus();
  app.type('משוואות ריבועיות');
  assert.equal(app.shown().length, 1);
  app.toggle.dispatchEvent(app.event('click'));
  assert.equal(app.shown().length, 4);
  assert.equal(app.input.value, 'משוואות ממעלה ראשונה', 'The complete list must not retain a misleading filter draft');
  assert.equal(app.document.activeElement, app.input);
  assert.equal(app.select.value, '3');
  assert.deepEqual(app.calls, []);
});

test('opening a late current topic reveals it inside the list and filtering resets old scrolling', () => {
  const app = harness();
  Object.defineProperty(app.list, 'clientHeight', { value: 88 });
  Object.defineProperty(app.list, 'clientTop', { value: 0 });
  app.list.scrollTop = 0;
  app.list.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
  const append = app.list.appendChild.bind(app.list);
  app.list.appendChild = ((node: HTMLElement) => {
    const index = app.list.children.length;
    node.getBoundingClientRect = () => ({ top: 100 + index * 44 - app.list.scrollTop, height: 44 } as DOMRect);
    node.scrollIntoView = () => { assert.fail('Opening the popup must not scroll the page'); };
    return append(node);
  }) as typeof app.list.appendChild;
  app.select.value = '4';
  app.controller.sync();
  app.input.focus();
  assert.equal(app.list.scrollTop, 88, 'The fourth current option must be visible in a two-row list');
  assert.equal(app.input.getAttribute('aria-activedescendant'), app.list.children[3].id);
  app.type('שברים');
  assert.equal(app.list.scrollTop, 0, 'A fresh filtered result list starts at its first result');
  assert.equal(app.input.getAttribute('aria-activedescendant'), null);
});

test('sync drops stale results after a grade/options change and supports initially empty native options', () => {
  for (const empty of [false, true]) {
    const app = harness({ empty });
    app.type('שברים');
    app.select.innerHTML = '<option value="10">מצולעים</option><option value="11">זוויות</option>';
    app.select.value = '11';
    app.controller.sync();
    assert.equal(app.popup.hidden, true);
    assert.equal(app.input.value, 'זוויות');
    assert.equal(app.list.children.length, 0);
    app.toggle.dispatchEvent(app.event('click'));
    assert.deepEqual(app.shown(), ['מצולעים', 'זוויות']);
    assert.deepEqual(app.calls, []);
  }
});

test('a stale result cannot choose a topic after native options changed before sync', async () => {
  const app = harness();
  app.type('שברים');
  app.select.innerHTML = '<option value="10">מצולעים</option>';
  app.select.value = '10';
  app.clickOption(0);
  await settle();
  assert.deepEqual(app.calls, []);
  assert.equal(app.input.value, 'מצולעים');
  assert.equal(app.popup.hidden, true);
});

test('native fallback restores the select, its label and focus permanently even if an async choice finishes later', async () => {
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const app = harness({ onChoose: async (value, select) => { await wait; select.value = value; } });
  app.type('שברים');
  app.clickOption(1);
  assert.equal(app.input.readOnly, true);
  app.document.querySelector('.topic-search-fallback')!.dispatchEvent(app.event('click'));
  assert.equal(app.document.querySelector('.topic-search'), null);
  assert.equal(app.select.hidden, false);
  assert.equal(app.document.querySelector('label')?.getAttribute('for'), 'topic');
  assert.equal(app.document.activeElement, app.select);
  finish();
  await settle();
  app.controller.sync();
  app.controller.close();
  app.controller.focus();
  assert.equal(app.document.activeElement, app.select);
  assert.equal(app.select.hidden, false);
  assert.equal(app.document.querySelector('.topic-search'), null);
});

test('delayed enhancement transfers existing native focus and API focus selects the current title', () => {
  const app = harness({ focused: true });
  assert.equal(app.document.activeElement, app.input);
  assert.equal(app.input.getAttribute('data-selected-text'), 'משוואות ממעלה ראשונה');
  app.outside.focus();
  app.controller.focus();
  assert.equal(app.document.activeElement, app.input);
  assert.equal(app.input.getAttribute('data-selected-text'), app.input.value);
});

test('a rejected caller choice restores the selected topic and reports one actionable status', async () => {
  const app = harness({ onChoose: () => { throw new Error('load failed'); } });
  app.type('שברים');
  app.clickOption(1);
  await settle();
  assert.equal(app.input.value, 'משוואות ממעלה ראשונה');
  assert.equal(app.input.readOnly, false);
  assert.match(app.status.textContent!, /אפשר לנסות שוב/);
  assert.equal(app.document.querySelectorAll('[role="status"]').length, 1);
});

test('the public topic search module is identical to its demo copy', () => {
  assert.equal(readFileSync(new URL('../public/teachers/teacher-topic-search.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../../../demos/teacher-topic-search.js', import.meta.url), 'utf8'));
});
