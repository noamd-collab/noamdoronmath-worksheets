/*
 * LaTeX rendering for Wix Blog posts.
 *
 * Install this file once through Wix Custom Code (Body end, all pages), or load
 * it from the site's existing GitHub Pages assets. It is deliberately separate
 * from the narration player: the stored post text remains the single source for
 * both display and audio, while MathJax changes only the reader's current DOM.
 */

(function () {
  'use strict';

  if (window.NoamBlogLatex && window.NoamBlogLatex.started) return;

  var BUILD = 1;
  var MATHJAX_SRC = 'https://cdn.jsdelivr.net/npm/mathjax@4.0.0/tex-chtml.js';
  var SCRIPT_MARK = 'data-noam-mathjax';
  var STYLE_ID = 'noam-blog-latex-style';
  var DEBOUNCE_MS = 160;
  var ROOT_SELECTORS = [
    '[data-hook="post-content"]',
    '[data-hook="post-body"]',
    '[data-hook="post-description"]',
    '[data-hook="post-page"] article',
    'article',
  ];

  var state = {
    started: true,
    build: BUILD,
    status: 'initializing',
    renders: 0,
    lastPath: window.location.pathname,
    lastRenderedPath: null,
    lastError: null,
  };
  var observer = null;
  var navigationTimer = null;
  var debounceTimer = null;
  var renderChain = Promise.resolve();

  function isPostPage() {
    return /\/post\//.test(window.location.pathname);
  }

  function containsLatexText(text) {
    return /\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$\$[\s\S]+?\$\$/.test(String(text || ''));
  }

  function rootHasPendingLatex(root) {
    if (!root || !root.isConnected) return false;
    var copy = root.cloneNode(true);
    var rendered = copy.querySelectorAll('mjx-container, script, style, noscript');
    for (var i = 0; i < rendered.length; i++) rendered[i].remove();
    return containsLatexText(copy.textContent);
  }

  function findPostRoot() {
    var candidates = [];
    for (var i = 0; i < ROOT_SELECTORS.length; i++) {
      var found = document.querySelectorAll(ROOT_SELECTORS[i]);
      for (var j = 0; j < found.length; j++) {
        if (candidates.indexOf(found[j]) === -1 && rootHasPendingLatex(found[j])) {
          candidates.push(found[j]);
        }
      }
    }
    if (!candidates.length) return null;

    // Prefer the smallest matching container. This avoids processing comments,
    // navigation, or the audio bar when an article-specific hook is available.
    candidates.sort(function (a, b) {
      return (a.textContent || '').length - (b.textContent || '').length;
    });
    return candidates[0];
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'mjx-container{direction:ltr;unicode-bidi:isolate;max-width:100%;}',
      'mjx-container[display="true"]{overflow-x:auto;overflow-y:hidden;padding:.2em 0;',
      '-webkit-overflow-scrolling:touch;}',
      '[dir="rtl"] mjx-container[display="true"]{text-align:center;}',
      '@media (max-width:600px){mjx-container[display="true"]{font-size:96%;}}',
    ].join('');
    document.head.appendChild(style);
  }

  function configureAndLoadMathJax() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      return Promise.resolve();
    }

    if (!window.MathJax || !window.MathJax.startup) {
      window.MathJax = {
        loader: { load: ['ui/safe'] },
        tex: {
          inlineMath: [['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true,
          processEnvironments: false,
          packages: { '[-]': ['require', 'autoload'] },
        },
        chtml: {
          displayAlign: 'center',
          displayIndent: '0',
          displayOverflow: 'scroll',
        },
        options: {
          enableMenu: true,
          safeOptions: {
            allow: { URLs: 'safe', classes: 'safe', cssIDs: 'safe', styles: 'safe' },
            safeProtocols: { http: true, https: true, file: false, javascript: false, data: false },
          },
        },
        startup: { typeset: false },
      };
    }

    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[' + SCRIPT_MARK + ']');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', function () { reject(new Error('MathJax failed to load')); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = MATHJAX_SRC;
      script.async = true;
      script.setAttribute(SCRIPT_MARK, '1');
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', function () { reject(new Error('MathJax failed to load')); }, { once: true });
      document.head.appendChild(script);
    });
  }

  function renderNow() {
    if (!isPostPage()) {
      state.status = 'not a blog post';
      return Promise.resolve(false);
    }
    var root = findPostRoot();
    if (!root) {
      state.status = state.lastRenderedPath === window.location.pathname
        ? 'rendered'
        : 'waiting for LaTeX in the post';
      return Promise.resolve(false);
    }

    state.status = 'loading MathJax';
    return configureAndLoadMathJax().then(function () {
      if (!root.isConnected || !rootHasPendingLatex(root)) return false;
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
        throw new Error('MathJax loaded without typesetPromise');
      }
      state.status = 'rendering';
      return window.MathJax.typesetPromise([root]).then(function () {
        if (!root.isConnected) return false;
        root.setAttribute('data-noam-latex-rendered', String(BUILD));
        state.renders += 1;
        state.lastRenderedPath = window.location.pathname;
        state.status = 'rendered';
        state.lastError = null;
        return true;
      });
    }).catch(function (error) {
      // MathJax leaves the original source visible when it cannot process a
      // formula. Never blank or replace the article on failure.
      state.status = 'render failed';
      state.lastError = String(error && error.message || error).slice(0, 300);
      return false;
    });
  }

  function queueRender() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      renderChain = renderChain.then(renderNow, renderNow);
    }, DEBOUNCE_MS);
  }

  function start() {
    ensureStyle();
    if (window.MutationObserver && !observer) {
      observer = new MutationObserver(queueRender);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    if (!navigationTimer) {
      navigationTimer = setInterval(function () {
        if (window.location.pathname !== state.lastPath) {
          state.lastPath = window.location.pathname;
          state.status = 'navigation detected';
          queueRender();
        }
      }, 700);
    }
    queueRender();
  }

  function stop() {
    if (observer) observer.disconnect();
    if (navigationTimer) clearInterval(navigationTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
    observer = null;
    navigationTimer = null;
    debounceTimer = null;
    state.status = 'stopped';
  }

  window.NoamBlogLatex = {
    started: true,
    state: state,
    render: function () { renderChain = renderChain.then(renderNow, renderNow); return renderChain; },
    stop: stop,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
