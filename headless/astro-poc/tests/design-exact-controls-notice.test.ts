/**
 * Deterministic exact-design adapter checks: no browser, network, production
 * storage, or fixture writes. These are source/contract checks, not visual or
 * IntersectionObserver acceptance tests.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadHomePage } from '../src/lib/homePage.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const wrapper = read('src/components/ExactHeroControls.astro');
const hero = read('src/components/HeroLoop.astro');
const notice = read('src/components/SiteDevelopmentNotice.astro');
const layout = read('src/layouts/BaseLayout.astro');
const footer = read('src/components/SiteFooter.astro');

function frontmatter(source: string): string {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'Astro frontmatter must be present');
  return match[1];
}

function initializer(source: string, name: string): ts.Expression {
  const tree = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  let found: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found, `${name} must have a static initializer`);
  return ts.isAsExpression(found) ? found.expression : found;
}

function strings(node: ts.Expression): string[] {
  assert.ok(ts.isArrayLiteralExpression(node), 'Expected a static array');
  return node.elements.map((entry) => {
    assert.ok(ts.isStringLiteral(entry), 'Inventory must contain literal strings only');
    return entry.text;
  });
}

function metadata(): Record<string, [string, string]> {
  const node = initializer(frontmatter(wrapper), 'topics');
  assert.ok(ts.isObjectLiteralExpression(node), 'Hero metadata must be a static record');
  const seen = new Set<string>();
  return Object.fromEntries(node.properties.map((entry) => {
    assert.ok(ts.isPropertyAssignment(entry));
    assert.ok(ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name));
    assert.ok(!seen.has(entry.name.text), `${entry.name.text}: duplicate variant metadata`);
    seen.add(entry.name.text);
    const fields = strings(entry.initializer);
    assert.equal(fields.length, 2, `${entry.name.text}: label and destination required`);
    return [entry.name.text, fields];
  })) as Record<string, [string, string]>;
}

function executableScript(source: string): string {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'Notice must have only its local dismiss script');
  return scripts[0][1];
}

describe('exact hero presentation adapter inventory', () => {
  it('labels every one of the actual 73 protected hero variants exactly once', () => {
    const pool = strings(initializer(frontmatter(hero), 'HERO_POOL'));
    const topics = metadata();
    assert.equal(pool.length, 73, 'Do not silently invent or remove variants');
    assert.equal(new Set(pool).size, 73);
    assert.deepEqual(Object.keys(topics).sort(), pool.toSorted());
    for (const [variant, [label]] of Object.entries(topics)) {
      assert.ok(label.trim().length > 0 && label.length <= 32, `${variant}: short label required`);
      assert.doesNotMatch(label, /^הדגמה:|[\r\n]/);
    }
    assert.doesNotMatch(wrapper, /getAttribute\(['"]aria-label['"]\)/, 'Do not turn long SVG narration into a chip label');
  });

  it('uses 30 existing topic routes and 43 honest catalog destinations', () => {
    let topicCount = 0;
    let catalogCount = 0;
    for (const [variant, [, href]] of Object.entries(metadata())) {
      assert.ok(href.startsWith('/') && !href.startsWith('//'), `${variant}: same-origin route required`);
      if (href.startsWith('/worksheets')) {
        assert.match(href, /^\/worksheets(?:\?grade=[1-9])?$/, `${variant}: no fabricated filter route`);
        catalogCount += 1;
      } else {
        const page = loadTopicPage(href.slice(1));
        assert.equal(page.slug, href.slice(1), `${variant}: destination must be in the served topic inventory`);
        topicCount += 1;
      }
    }
    assert.equal(topicCount, 30);
    assert.equal(catalogCount, 43);
    assert.match(wrapper, /isCatalog\s*\?\s*'למאגר התרגול ←'\s*:\s*'לדף הנושא ←'/);
    assert.match(wrapper, /info\?\.\[0\]\s*\|\|\s*'הדגמה מתמטית'/);
    assert.match(wrapper, /info\?\.\[1\]\s*\|\|\s*'\/worksheets'/);
  });

  it('renders only the triangle on the homepage and fetches the rest of the rotation', () => {
    assert.match(hero, /<ConceptLoop\s+variant=\{DEFAULT\}\s*\/>/);
    assert.equal((hero.match(/<ConceptLoop\b/g) || []).length, 1);
    assert.doesNotMatch(hero, /data-hero-loop-variant|data-pending/);
    assert.match(wrapper, /fetch\('\/hero-loops\/'/);
    assert.match(wrapper, /originals\.set\('triangle', defaultSource\)/);
    assert.doesNotMatch(wrapper, /<ConceptLoop\b/);
    assert.match(wrapper, /כיתה \$\{spin\.grade\} · \$\{spin\.label\}/);
    assert.match(wrapper, /data-exact-hero-panel/);
  });

  it('reuses initialized nodes in a hidden connected cache instead of discarding them', () => {
    assert.match(wrapper, /let next = mounted\.get\(variant\)/);
    assert.match(wrapper, /if \(!next\)\s*\{[\s\S]*?cloneNode\(true\)[\s\S]*?mounted\.set\(variant, next\)/);
    assert.match(wrapper, /cache\.hidden = true/);
    assert.match(wrapper, /cache\.style\.display = 'none'/);
    assert.match(wrapper, /hero\.append\(cache\)/);
    assert.match(wrapper, /prior\?\.__loop\?\.pause\(\);\s*if \(prior\) cache\.append\(prior\);\s*current\.append\(next\)/);
    assert.doesNotMatch(wrapper, /current\.replaceChildren|prior\??\.remove\(/);
    assert.equal((wrapper.match(/window\.setInterval\(/g) || []).length, 1, 'One shared ARIA timer, not one per shuffle');
  });

  it('delegates later-card keyboard and pause state to unchanged engine hooks', () => {
    assert.match(wrapper, /!adapted\.has\(loop\)/, 'Initial card must not gain a second pause adapter');
    assert.match(wrapper, /event\.key === 'Enter' \|\| event\.key === ' ' \|\| event\.key === 'Spacebar'/);
    assert.match(wrapper, /k3-pause:/, 'Retain the existing session pause key');
    assert.match(wrapper, /if \(!state \|\| state\.static\) return/);
    assert.match(wrapper, /card\.tabIndex = state\.static \? -1 : 0/);
    assert.match(wrapper, /prefers-reduced-motion: reduce/);
    assert.match(wrapper, /wasStatic\.set\(loop, state\.static\);\s*if \(motionResumed\) restoreManualPause\(loop\)/,
      'Record preference state before synchronous toggle events can reenter the adapter');
  });
});

describe('protected math sources remain byte-identical to verified live 8a098020', () => {
  // Read independently with git show from live-base commit
  // 8a098020ca33f374224338b8ac3fd08faa8ad5f1, not regenerated from this candidate.
  const expected = {
    // HeroLoop.astro is the homepage shell. It may stop inlining every loop.
    // The diagram engine stays byte-identical.
    // Reviewed 2026-10-03: the only changes since 8a098020 are the loop copy,
    // RTL unit labels and stacked fractions merged in PR #41 (approved, includes
    // PR #40 per the PR #37 audit) and the hidden-label alignment in PR #50.
    // The engine (src/lib/conceptLoops.ts, next entry) is still the live bytes.
    'src/components/ConceptLoop.astro': '4fc2e8948eed7e32714c32382602d511e7d1e06742e129bca7b413183d841199',
    'src/lib/conceptLoops.ts': 'b9e5a864e93b08e70fa7257dcf9d7fedae7dcb4cd5798996b7325d98575be53d',
  };
  for (const [file, digest] of Object.entries(expected)) {
    it(file, () => {
      assert.equal(createHash('sha256').update(readFileSync(join(root, file))).digest('hex'), digest);
    });
  }
});

describe('non-blocking site-development notice', () => {
  it('is an in-flow aside, not a dialog, overlay, consent form or focus trap', () => {
    assert.match(notice, /<aside[^>]*data-development-notice/);
    // The accessible name starts with the visible text "הבנתי" (WCAG 2.5.3 label in name).
    assert.match(notice, /<button\s+type="button"\s+aria-label="הבנתי – סגירת הודעת הפיתוח">הבנתי<\/button>/);
    assert.match(notice, /min-width:44px;min-height:44px/);
    assert.doesNotMatch(notice, /<dialog\b|aria-modal\s*=|role\s*=\s*['"](?:dialog|alertdialog)['"]|\bautofocus\b|\binert\b|type\s*=\s*['"]checkbox['"]/i);
    assert.doesNotMatch(notice, /position\s*:\s*(?:fixed|absolute)|overflow(?:-[xy])?\s*:\s*(?:hidden|clip)|overscroll-behavior\s*:\s*none/i);
    assert.doesNotMatch(notice, /nd_gate_accepted_v1|ndGateOverlay|showModal\s*\(/);
  });

  it('contains no storage, consent, focus capture or scroll-lock code, even in inactive branches', () => {
    const tree = ts.createSourceFile('notice.ts', executableScript(notice), ts.ScriptTarget.Latest, true);
    const forbidden = new Set(['localStorage', 'sessionStorage', 'indexedDB', 'Storage', 'cookie',
      'focus', 'blur', 'activeElement', 'showModal', 'scrollTo', 'scrollBy', 'requestFullscreen']);
    function visit(node: ts.Node) {
      if (ts.isIdentifier(node)) assert.ok(!forbidden.has(node.text), `Notice accesses forbidden API ${node.text}`);
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.doesNotMatch(executableScript(notice), /document\.(?:body|documentElement)|preventDefault\s*\(|keydown|touchmove|wheel/);
  });

  it('dismisses only itself in a sandbox that rejects storage, focus, scroll and network access', () => {
    const effects: string[] = [];
    let removed = 0;
    const clicks: Array<() => void> = [];
    const forbidden = (name: string): never => { effects.push(name); throw new Error(`Forbidden effect: ${name}`); };
    const fakeButton = {
      addEventListener(type: string, handler: () => void) {
        assert.equal(type, 'click');
        assert.equal(clicks.length, 0, 'Only one dismiss listener is needed');
        clicks.push(handler);
      },
      focus: () => forbidden('focus'),
    };
    const fakeNotice = {
      querySelector(selector: string) { assert.equal(selector, 'button'); return fakeButton; },
      remove() { removed += 1; },
    };
    const fakeDocument = new Proxy({
      querySelectorAll(selector: string) {
        assert.equal(selector, '[data-development-notice]');
        return [fakeNotice];
      },
    }, {
      get(target, property) {
        if (property === 'querySelectorAll') return target.querySelectorAll;
        return forbidden(`document.${String(property)}`);
      },
      set(_target, property) { return forbidden(`document.${String(property)} write`); },
    });
    const sandbox: Record<string, unknown> = { document: fakeDocument };
    for (const name of ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'fetch', 'XMLHttpRequest']) {
      Object.defineProperty(sandbox, name, { get: () => forbidden(name) });
    }
    const script = ts.transpileModule(executableScript(notice), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    runInNewContext(script, sandbox, { timeout: 1000 });
    assert.equal(removed, 0, 'Notice must not dismiss or block content during initialization');
    assert.equal(clicks.length, 1, 'Dismiss control must be wired');
    clicks[0]();
    assert.equal(removed, 1);
    assert.deepEqual(effects, [], 'Dismissal must never be interpreted as legal consent');
  });

  it('mounts the notice with normal content and leaves legal destinations in the shared footer', () => {
    assert.match(layout, /<SiteDevelopmentNotice\s*\/>\s*<slot\s*\/>\s*<SiteFooter\s+footer=\{footer\}/);
    assert.doesNotMatch(layout, /<script\b[^>]*src=['"]\/nd-site-gate\.js['"]/);
    const byLabel = Object.fromEntries(loadHomePage().footer.legal.map((entry) => [entry.label, entry.href]));
    assert.equal(byLabel['תקנון שימוש בדפי עבודה חינמיים'], '/conditionforfreeworksheets');
    assert.equal(byLabel['תנאי השימוש'], '/terms');
    assert.equal(byLabel['הצהרת נגישות'], '/accessibilityadaptation');
    assert.equal(byLabel['מדיניות פרטיות'], '/accessibilityadaptation#privacy-policy');
    assert.match(footer, /footer\.legal\.map\([\s\S]*?<a\s+href=\{item\.href\}/);
    assert.doesNotMatch(footer, /footer\.legal\.(?:filter|slice)\(/, 'Do not hide real legal links when removing the modal');
  });
});
