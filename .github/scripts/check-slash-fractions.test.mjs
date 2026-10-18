import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  checkTree,
  findSlashFractions,
  filesToScan,
  replaceSlashFractions,
  scanSource,
} from './check-slash-fractions.mjs';

describe('findSlashFractions', () => {
  it('reports a numeric fraction and an algebraic quotient', () => {
    const hits = findSlashFractions('ראו 3/4 וגם (x+1)/(x-1) בסוף');
    assert.deepEqual(
      hits.map((hit) => hit.text),
      ['3/4', '(x+1)/(x-1)'],
    );
  });

  it('ignores units, word pairs, dates, times, and urls', () => {
    const samples = [
      'המהירות 90 km/h ואז 12 m/s',
      'and/or w/o n/a',
      'עודכן ב־18/10/2026',
      'עודכן ב־18/10',
      '18/10',
      '0:00 / 0:19',
      'https://example.com/a/b',
      'src/pages/index.astro',
    ];
    for (const sample of samples) {
      assert.deepEqual(findSlashFractions(sample), [], sample);
    }
  });

  it('keeps real fractions that look a bit like dates', () => {
    assert.equal(findSlashFractions('1/2')[0].text, '1/2');
    assert.equal(findSlashFractions('11/12')[0].text, '11/12');
    assert.equal(findSlashFractions('15/4 = 3.75')[0].text, '15/4');
    assert.equal(findSlashFractions('התשובה היא 15/4')[0].text, '15/4');
  });

  it('splits a product on × and keeps a middle-dot numerator', () => {
    assert.equal(replaceSlashFractions('2/3 × 1/2'), '⟨2¦3⟩ × ⟨1¦2⟩');
    assert.equal(replaceSlashFractions('S = a·h/2'), 'S = ⟨a·h¦2⟩');
    assert.equal(replaceSlashFractions('(−3)/4 ו־3/(−4) ו־−3/4'), '⟨(−3)¦4⟩ ו־⟨3¦(−4)⟩ ו־−⟨3¦4⟩');
  });
});

describe('scanSource', () => {
  it('fails a topic page fixture and reports file, line, and text', () => {
    const source = ['{', '  "intro": "אין שבר כאן",', '  "text": "ראו 3/4 וגם (x+1)/(x-1)"', '}', ''].join('\n');
    const hits = scanSource('headless/astro-poc/src/data/topic-pages/fixture.json', source, []);
    assert.equal(hits.length, 2);
    assert.deepEqual(
      hits.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`),
      [
        'headless/astro-poc/src/data/topic-pages/fixture.json:3: 3/4',
        'headless/astro-poc/src/data/topic-pages/fixture.json:3: (x+1)/(x-1)',
      ],
    );
  });

  it('skips comments, blogs are not in the scan, and an exact allowlist match', () => {
    const astro = ['---', '// 3/4 stays in a comment', 'const note = "3/4";', '---', '<p>3/4</p>', '<!-- (x+1)/(x-1) -->', ''].join('\n');
    const hits = scanSource('headless/astro-poc/src/pages/sample.astro', astro, []);
    assert.deepEqual(
      hits.map((hit) => hit.text),
      ['3/4', '3/4'],
    );
    const allowed = scanSource('headless/astro-poc/src/pages/sample.astro', astro, [{ match: '3/4' }]);
    assert.deepEqual(allowed, []);
    const files = filesToScan();
    assert.equal(files.some((file) => file.includes('/blog-posts/') || file.includes('/pages/blog/')), false);
  });

  it('fails checkTree on a topic-page fixture', () => {
    const root = mkdtempSync(join(tmpdir(), 'slash-frac-'));
    const dir = join(root, 'headless/astro-poc/src/data/topic-pages');
    mkdirSync(dir, { recursive: true });
    const rel = 'headless/astro-poc/src/data/topic-pages/fixture.json';
    writeFileSync(join(root, rel), '{\n  "text": "3/4 and (x+1)/(x-1)"\n}\n');
    try {
      const hits = checkTree(root, []);
      assert.ok(hits.length >= 2);
      assert.ok(hits.some((hit) => hit.file === rel && hit.text === '3/4' && hit.line === 2));
      assert.ok(hits.some((hit) => hit.file === rel && hit.text === '(x+1)/(x-1)' && hit.line === 2));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('repository', () => {
  it('has no slash fractions in visible site text', () => {
    const hits = checkTree();
    assert.deepEqual(
      hits.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`),
      [],
    );
  });
});
