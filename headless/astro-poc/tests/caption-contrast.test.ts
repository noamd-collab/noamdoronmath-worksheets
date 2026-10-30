import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('loop caption green text contrast (SEO audit ב-4)', () => {
  it('darkens only HTML caption text and keeps SVG fills on var(--green)', () => {
    const css = readFileSync('src/styles/catalog.css', 'utf8');
    assert.ok(css.includes('.cl-tc-ok, .cl-ok { fill: var(--green); color: var(--green); }'));
    assert.ok(css.includes('.concept-loop__caption .cl-ok { color: #1f7a42; }'));
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (lum('#ffffff') + 0.05) / (lum('#1f7a42') + 0.05);
    assert.ok(ratio >= 4.5, String(ratio));
  });
});
