import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const rendererSource = fs.readFileSync(new URL('../site/noam-latex-renderer.js', import.meta.url), 'utf8');

function browserHarness({ pathname = '/post/example', text = 'עברית \\(x_1^2=9\\)' } = {}) {
  let typesetCalls = 0;
  let capturedConfig = null;
  const attributes = new Map();
  const root = {
    isConnected: true,
    textContent: text,
    cloneNode() {
      return {
        textContent: this.textContent,
        querySelectorAll() { return []; },
      };
    },
    setAttribute(name, value) { attributes.set(name, value); },
  };
  const styles = new Map();
  const document = {
    readyState: 'complete',
    documentElement: {},
    head: {
      appendChild(node) {
        if (node.tagName === 'STYLE') {
          styles.set(node.id, node);
          return;
        }
        capturedConfig = context.window.MathJax;
        context.window.MathJax.typesetPromise = async ([target]) => {
          typesetCalls += 1;
          target.textContent = 'עברית [נוסחה מעוצבת]';
        };
        node.listeners.load();
      },
    },
    getElementById(id) { return styles.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll(selector) {
      return selector.includes('post-') || selector === 'article' ? [root] : [];
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        listeners: {},
        setAttribute() {},
        addEventListener(name, handler) { this.listeners[name] = handler; },
      };
    },
    addEventListener() {},
  };
  class MutationObserver {
    observe() {}
    disconnect() {}
  }
  const context = vm.createContext({
    window: { location: { pathname } },
    document,
    MutationObserver,
    Promise,
    Error,
    String,
    clearInterval() {},
    setInterval() { return 1; },
    clearTimeout() {},
    setTimeout(handler) { handler(); return 1; },
  });
  context.window.MutationObserver = MutationObserver;
  vm.runInContext(rendererSource, context, { filename: 'noam-latex-renderer.js' });
  return {
    context,
    root,
    attributes,
    get typesetCalls() { return typesetCalls; },
    get capturedConfig() { return capturedConfig; },
  };
}

test('renderer typesets a Wix post root and marks it complete', async () => {
  const harness = browserHarness();
  await harness.context.window.NoamBlogLatex.render();

  assert.equal(harness.typesetCalls, 1);
  assert.equal(harness.attributes.get('data-noam-latex-rendered'), '1');
  assert.equal(harness.context.window.NoamBlogLatex.state.status, 'rendered');
  assert.equal(JSON.stringify(harness.capturedConfig.tex.inlineMath), JSON.stringify([['\\(', '\\)']]));
  assert.equal(JSON.stringify(harness.capturedConfig.tex.displayMath), JSON.stringify([['$$', '$$'], ['\\[', '\\]']]));
  assert.equal(JSON.stringify(harness.capturedConfig.tex.packages['[-]']), JSON.stringify(['require', 'autoload']));
});

test('renderer processes LaTeX that Wix inserts after the first render', async () => {
  const harness = browserHarness();
  await harness.context.window.NoamBlogLatex.render();
  harness.root.textContent = 'תוכן שהוחלף \\[y=\\frac{1}{2}\\]';
  await harness.context.window.NoamBlogLatex.render();

  assert.equal(harness.typesetCalls, 2);
  assert.equal(harness.context.window.NoamBlogLatex.state.renders, 2);
});

test('renderer stays inactive outside blog post paths', async () => {
  const harness = browserHarness({ pathname: '/math-tools' });
  await harness.context.window.NoamBlogLatex.render();

  assert.equal(harness.typesetCalls, 0);
  assert.equal(harness.context.window.NoamBlogLatex.state.status, 'not a blog post');
});

test('single dollar signs do not trigger MathJax loading', async () => {
  const harness = browserHarness({ text: 'המחיר הוא $20 בלבד.' });
  await harness.context.window.NoamBlogLatex.render();

  assert.equal(harness.typesetCalls, 0);
  assert.equal(harness.context.window.NoamBlogLatex.state.status, 'waiting for LaTeX in the post');
});
