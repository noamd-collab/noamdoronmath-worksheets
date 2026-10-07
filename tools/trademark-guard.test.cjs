'use strict';
// Fails if a calculator brand, model name, or proprietary feature name
// reappears in files GitHub Pages can serve. The historical folder token
// used only as a URL path is skipped so existing links can stay up.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const scanRoots = [
  path.join(root, 'tools/scientific-calculator'),
  path.join(root, 'tools/fx-82ms'),
  path.join(root, 'headless/astro-poc/src/data'),
].filter(dir => fs.existsSync(dir));

const textExt = new Set(['.html', '.js', '.cjs', '.css', '.md', '.json', '.txt', '.mjs', '.astro']);
const patterns = [
  /casio/i,
  /קסיו/,
  /v\s*\.?\s*p\s*\.?\s*a\s*\.?\s*m/i,
  /\bfx\s*-?\s*\d+/i,
  /991\s*-?\s*es/i,
  /82\s*-?\s*ms/i,
  /570\s*-?\s*es/i,
  /\bes\s*plus\b/i,
  /two\s*way\s*power/i,
  /natural-v/i,
  /s-v\.p/i,
];

function scrubPathToken(text) {
  return text.replace(/(^|[/])fx-82ms(?=[/?#\s"'`]|$)/gi, '$1kept-path');
}

function filesIn(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'trademark-guard.test.cjs') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) filesIn(full, out);
    else if (textExt.has(path.extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

test('served calculator files do not name a commercial brand or model', () => {
  const hits = [];
  for (const dir of scanRoots) {
    for (const file of filesIn(dir)) {
      const raw = fs.readFileSync(file, 'utf8');
      const text = scrubPathToken(raw);
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) hits.push(`${path.relative(root, file)}: ${pattern} → ${JSON.stringify(match[0])}`);
      }
    }
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});
