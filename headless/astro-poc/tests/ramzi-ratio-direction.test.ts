import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

const viewers = [
  ['root', new URL('../../../worksheet-viewer-noam.html', import.meta.url)],
  ['headless', new URL('../public/worksheet-viewer-noam.html', import.meta.url)],
] as const;

function adapter(source: string) {
  const start = source.indexOf('  function hasPendingMath(');
  const end = source.indexOf('  function decoratePins(', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

function setup(source: string, body = '') {
  const { document } = parseHTML('<html><body><div id="transcript"><div class="noam-row user"><div class="noam-bubble"><span id="reply"></span></div></div></div></body></html>');
  const transcript = document.querySelector('#transcript')!;
  const reply = document.querySelector('#reply')!;
  reply.innerHTML = body;
  const api = runInNewContext(adapter(source) + '\n({isolateMath,shapeReading:typeof shapeReading === "function" ? shapeReading : null})', {
    document, NodeFilter: { SHOW_TEXT: 4 },
  });
  return {
    document, transcript, reply,
    decorate() { api.isolateMath(transcript); if (api.shapeReading) api.shapeReading(transcript); },
  };
}

for (const [name, path] of viewers) {
  const source = readFileSync(path, 'utf8');
  describe(`${name} viewer ratio direction`, () => {
    it('isolates numeric and algebraic ratios as one LTR run without changing notation', () => {
      for (const ratio of ['1:15000', '1 : 15000', '1∶15000', '1 ∶ 15000', '15000 : 1', '1:25', 'a:b', 'a : b', 'a∶b', 'a ∶ b', '2x : 3y', 'x : x√3 : 2x', 'AB:CD', '-2x : 3y', '3.5 : 0.25']) {
        const view = setup(source);
        const text = `מה המשמעות של קנה המידה ${ratio} בשאלה הזאת?`;
        view.reply.textContent = text;
        view.decorate();
        const islands = view.reply.querySelectorAll('[data-noam-math-island]');
        assert.equal(islands.length, 1, ratio);
        assert.equal(islands[0].textContent, ratio);
        assert.equal(islands[0].getAttribute('dir'), 'ltr');
        assert.equal((islands[0] as HTMLElement).style.unicodeBidi, 'isolate');
        assert.equal(view.reply.textContent, text);
      }
    });

    it('keeps clocks and URL text intact', () => {
      for (const text of ['הפגישה בשעה 12:30 ומסתיימת ב־13:45:20.', 'הפגישה בשעה 12 : 30.', 'https://example.com/1:15000?ratio=x:y', 'www.example.com/1:15000', 'mailto:person1:15000@example.com']) {
        const view = setup(source);
        view.reply.textContent = text;
        view.decorate();
        assert.equal(view.reply.querySelectorAll('[data-noam-math-island]').length, 0, text);
        assert.equal(view.reply.textContent, text);
      }
    });

    it('keeps grouped numbers, roots, powers and Unicode spaces inside the complete ratio', () => {
      for (const ratio of ['1 : 15,000', '15,000 : 1', '15\u202f000 : 1', '1 : 15\u202f000', '1 : 15\u00a0000', '15 000 : 1', '√3 : 1', '1 : √3', 'x^-2 : y', '1 : 2^(-3)', '1\u00a0:\u00a015000', '1\u2009:\u200915000']) {
        const view = setup(source);
        const text = `קנה המידה הוא ${ratio}.`;
        view.reply.textContent = text;
        view.decorate();
        const islands = view.reply.querySelectorAll('[data-noam-math-island]');
        assert.equal(islands.length, 1, ratio);
        assert.equal(islands[0].textContent, ratio);
        assert.equal(view.reply.textContent, text);
      }
    });

    it('does not isolate a misleading partial ratio from unsupported operands', () => {
      for (const text of ['היחס הוא ∛3 : 1.', 'היחס הוא 1 : 2^(x+y).', 'היחס הוא 1234,567 : 1.', 'היחס הוא 1 : 15,00.', 'היחס הוא 1 : 2(x+1).', 'היחס הוא 1 : 2±3.', 'היחס הוא 1 : 2%.', 'היחס הוא 1 : 2٪.', 'היחס הוא 1 : 2!.']) {
        const view = setup(source);
        view.reply.textContent = text;
        view.decorate();
        assert.equal(view.reply.querySelectorAll('[data-noam-math-island]').length, 0, text);
        assert.equal(view.reply.textContent, text);
      }
    });

    it('does not mistake part of a fraction or parenthesized operand for a complete ratio', () => {
      for (const text of ['היחס הוא 1/2 : 3.', 'היחס הוא (x+1) : 2.', 'היחס הוא 1 : (x+2).']) {
        const view = setup(source);
        view.reply.textContent = text;
        view.decorate();
        const islands = Array.from(view.reply.querySelectorAll('[data-noam-math-island]'));
        assert.equal(islands.some(node => /[:∶]/.test(node.textContent || '')), false, text);
        // A standalone fraction can still receive the existing fraction-bar rendering.
        assert.equal(view.reply.textContent, text.replace('1/2', '12'));
      }
    });

    it('does not mutate links, existing KaTeX, MathML, or pending TeX', () => {
      const view = setup(source, '<a href="https://example.com/1:15000">1 : 15000</a><span class="katex"><span class="katex-html">a : b</span><span class="katex-mathml"><math><mn>1 : 15000</mn></math></span></span><math><mn>a : b</mn></math>');
      const protectedNodes = Array.from(view.reply.children);
      const markup = protectedNodes.map(node => node.outerHTML);
      view.decorate(); view.decorate();
      assert.deepEqual(protectedNodes.map(node => node.outerHTML), markup);
      protectedNodes.forEach(node => assert.equal(node.parentNode, view.reply));
      assert.equal(view.reply.querySelectorAll('[data-noam-math-island]').length, 0);

      for (const text of [String.raw`היחס הוא \(1 : 15000\).`, String.raw`היחס הוא $\rat{1}{15000}$.`]) {
        const pending = setup(source);
        pending.reply.textContent = text;
        pending.decorate(); pending.decorate();
        assert.equal(pending.reply.textContent, text);
        assert.equal(pending.reply.querySelectorAll('[data-noam-math-island]').length, 0);
      }
    });

    it('is idempotent and decorates replies arriving after the initial transcript', () => {
      const view = setup(source);
      view.reply.textContent = 'קנה המידה הוא 1 : 15000.';
      view.decorate();
      const first = view.reply.querySelector('[data-noam-math-island]')!;
      const original = first.outerHTML;
      const row = view.document.createElement('div');
      row.className = 'noam-row assistant';
      row.innerHTML = '<div class="noam-bubble"><span>היחס הוא x : y.</span></div>';
      view.transcript.appendChild(row);
      view.decorate(); view.decorate();
      assert.equal(view.reply.querySelector('[data-noam-math-island]'), first);
      assert.equal(first.outerHTML, original);
      assert.equal(row.querySelectorAll('[data-noam-math-island]').length, 1);
      assert.equal(row.querySelector('[data-noam-math-island]')!.textContent, 'x : y');
      assert.equal(view.transcript.querySelectorAll('[data-noam-math-island] [data-noam-math-island], [data-noam-math-island] bdi').length, 0);
    });
  });
}

it('keeps the ratio isolation implementation identical in both deployed viewers', () => {
  const blocks = viewers.map(([, path]) => {
    const source = adapter(readFileSync(path, 'utf8'));
    return source.split('  function shapeReading(')[0];
  });
  assert.equal(blocks[0], blocks[1]);
});
