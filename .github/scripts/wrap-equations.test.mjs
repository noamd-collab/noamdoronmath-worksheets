import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const viewer = readFileSync(join(root, 'headless/astro-poc/public/worksheet-viewer-noam.html'), 'utf8');

function loadFractionHtml() {
  const start = viewer.indexOf('function equationCoreQualifies');
  const end = viewer.indexOf('function showNoamGlossaryPopover');
  const escStart = viewer.indexOf('function escAttr(s)');
  const escEnd = viewer.indexOf('})();', escStart);
  assert.ok(start > 0 && end > start && escStart > end, 'viewer fraction helpers must stay in the released script');
  const code = `${viewer.slice(start, end)}\n${viewer.slice(escStart, escEnd)}`;
  return new Function(`${code}\nreturn { wrapEquations, noamFractionHtml };`)();
}

const { wrapEquations, noamFractionHtml } = loadFractionHtml();

function labels(html) {
  return [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
}

describe('wrapEquations', () => {
  const unchanged = [
    'בין ⟨1¦2⟩ ל-⟨3¦4⟩: ⟨5¦8⟩',
    '15 מתוך 20 = ⟨3¦4⟩',
    '⟨23¦6⟩ = 3 ו-⟨5¦6⟩',
    '⟨5¦4⟩ = שלם ועוד רבע',
    'P(לא זוגי) = 1 − ⟨1¦2⟩',
    'מציבים ‎−2, 0.5, ⟨3¦4⟩',
    '⟨7¦4⟩ מול ⟨18¦12⟩: מי גדול?',
    '0.73 = ⟨73¦100⟩',
    'נפח חרוט הוא שליש מנפח גליל בעל אותו בסיס ואותו גובה: ⟨πr²h¦3⟩.',
  ];

  it('leaves mixed Hebrew sentences in source order', () => {
    for (const sample of unchanged) {
      assert.equal(wrapEquations(sample), sample, sample);
      const html = noamFractionHtml(sample);
      assert.equal(html.includes('exact-eq'), false, sample);
      assert.deepEqual(
        labels(html),
        [...sample.matchAll(/⟨([^⟩¦]+)¦([^⟩]+)⟩/g)].map((match) => `${match[1]} חלקי ${match[2]}`),
        sample,
      );
    }
  });

  it('keeps a colon and a period outside a wrapped power equation', () => {
    const power = 'ההגדרה מתרחבת למעריך שלם: a⁰ = 1 ו־a⁻ⁿ = ⟨1¦aⁿ⟩ (כאשר a ≠ 0).';
    const html = wrapEquations(power);
    assert.match(html, /שלם: a⁰ = 1 ו־<span class="exact-eq" dir="ltr">a⁻ⁿ = ⟨1¦aⁿ⟩<\/span> \(כאשר/);
    const example = '3⁴ = 3×3×3×3; וגם 2⁻³ = ⟨1¦2³⟩.';
    assert.match(
      wrapEquations(example),
      /3×3×3×3; וגם <span class="exact-eq" dir="ltr">2⁻³ = ⟨1¦2³⟩<\/span>\./,
    );
  });

  it('wraps a pure letter equation and a pure numeric equation', () => {
    const letters = noamFractionHtml('בפרופורציה ⟨a¦b⟩=⟨c¦d⟩ אפשר');
    assert.match(letters, /<span class="exact-eq" dir="ltr"><span class="exact-frac" role="img" aria-label="a חלקי b">/);
    assert.ok(letters.indexOf('a חלקי b') < letters.indexOf('c חלקי d'));
    assert.ok(letters.startsWith('בפרופורציה <span class="exact-eq"'));
    assert.ok(letters.endsWith('</span> אפשר'));

    const numbers = noamFractionHtml('⟨2¦3⟩=⟨8¦12⟩');
    assert.match(numbers, /^<span class="exact-eq" dir="ltr">/);
    assert.ok(numbers.indexOf('2 חלקי 3') < numbers.indexOf('8 חלקי 12'));
  });

  it('wraps the fifteen pure glossary equations and no mixed sentence', () => {
    const files = [
      'headless/astro-poc/public/noam-glossary.js',
      'headless/astro-poc/public/noam-glossary-curriculum.js',
    ];
    const quoted = /"((?:\\.|[^"\\])*)"/g;
    const wrapped = [];
    let entries = 0;
    for (const rel of files) {
      const source = readFileSync(join(root, rel), 'utf8');
      entries += (source.match(rel.endsWith('noam-glossary-curriculum.js') ? /"id":/g : /id:"/g) || []).length;
      for (const match of source.matchAll(quoted)) {
        const text = JSON.parse(`"${match[1]}"`);
        if (!text.includes('⟨')) continue;
        if (wrapEquations(text).includes('exact-eq')) wrapped.push(text);
      }
    }
    assert.equal(entries, 300);
    assert.equal(wrapped.length, 15);
    assert.ok(wrapped.some((text) => text.includes('⟨a¦b⟩=⟨c¦d⟩')));
    assert.ok(wrapped.some((text) => text.includes('⟨2¦3⟩=⟨8¦12⟩')));
    for (const sample of unchanged) {
      assert.equal(wrapped.includes(sample), false, sample);
    }
  });
});
