/** Exercise the shipped adapter with rendered math, not just source assertions. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
function source(name: string, next: string) {
  return viewer.slice(viewer.indexOf(`  function ${name}(`), viewer.indexOf(`  function ${next}(`));
}
const functions = [source('userContent', 'veilStudentPrompts'), source('prefixRetryLead', 'replayLocalChecks'), source('isolateMath', 'shapeReading'), source('shapeReading', 'decoratePins')].join('\n');
const lead = 'זה בסדר גמור, בואו ננסה אחרת.';
// KaTeX stores three representations. Only katex-html is visually displayed.
function math(tex: string, visible: string) {
  return `<span class="katex"><span class="katex-mathml"><math><semantics><mrow><mn>${visible}</mn></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="mord">${visible}</span></span></span>`;
}
function setup(body: string) {
  const { document } = parseHTML(`<html><body><div id="transcript"><div class="noam-row user"><div class="noam-bubble"><span>לא הבנתי</span></div></div><div class="noam-row assistant"><div class="noam-bubble"><span id="reply">${body}</span></div></div></div></body></html>`);
  const api = runInNewContext(functions + '\n({prefixRetryLead,isolateMath,shapeReading})', { document, window: {}, NodeFilter: { SHOW_TEXT: 4 } });
  const transcript = document.querySelector('#transcript')!;
  const reply = document.querySelector('#reply')!;
  return { transcript, reply, decorate() { api.prefixRetryLead(transcript); api.isolateMath(transcript); api.shapeReading(transcript); } };
}

test('לא הבנתי preserves math nodes and hidden TeX through repeated decoration', () => {
  const view = setup(`במעבר הראשון יש ${math('12','12')} אריזות.\nכל אחת הופכת ל-${math('3','3')}.\nכמה זה ${math('12 \\cdot 3','12⋅3')}?`);
  const before = Array.from(view.reply.querySelectorAll('.katex'));
  const markup = before.map(node => node.outerHTML);
  for (let i = 0; i < 3; i++) view.decorate();
  assert.deepEqual(Array.from(view.reply.querySelectorAll('.katex')), before);
  assert.deepEqual(before.map(node => node.outerHTML), markup);
  assert.equal(view.reply.querySelectorAll('.ramzi-line').length, 4);
  assert.equal(view.reply.textContent.split(lead).length - 1, 1);
  const visible = view.reply.cloneNode(true) as Element;
  visible.querySelectorAll('.katex-mathml').forEach(node => node.remove());
  assert.match(visible.textContent!, /יש 12 אריזות/);
  assert.match(visible.textContent!, /כמה זה 12⋅3/);
  assert.doesNotMatch(visible.textContent!, /121212|333|\\cdot/);
});

test('plain text, legitimate repeated digits, and existing opening are preserved', () => {
  for (const body of ['מספר ההזמנה הוא 121212.\nחשבו 12 + 3.', `${lead}\nחשבו 12 + 3.`]) {
    const view = setup(body);
    view.decorate(); view.decorate();
    assert.equal(view.reply.textContent.split(lead).length - 1, 1);
    assert.ok(view.reply.textContent.endsWith(body.replaceAll('\n', '')));
  }
});

test('an already shaped reply keeps its math while adding one opening', () => {
  const view = setup(`<p class="ramzi-line">${math('x = 12/3','x = 12/3')}</p>`);
  const formula = view.reply.querySelector('.katex')!;
  const before = formula.outerHTML;
  view.decorate(); view.decorate();
  assert.equal(view.reply.querySelector('.katex'), formula);
  assert.equal(formula.outerHTML, before);
  assert.equal(view.reply.querySelectorAll('.ramzi-line').length, 2);
});
