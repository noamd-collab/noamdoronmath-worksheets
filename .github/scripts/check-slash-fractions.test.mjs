import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  checkTree,
  findBuiltSlashFractions,
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
      '18/10/2026',
      '2026/10/18',
      '0:00 / 0:19',
      '12:30 / 13:00',
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
    for (const sample of ['18/10', '18/12', '13/12', '20/10', '31/12', '10/2026']) {
      assert.equal(findSlashFractions(sample)[0].text, sample, sample);
    }
    assert.equal(findSlashFractions('⟨7¦4⟩ מול 18/12: מי גדול?')[0].text, '18/12');
    assert.equal(findSlashFractions('בין ⟨1¦2⟩ ל-3/4: ⟨5¦8⟩')[0].text, '3/4');
    assert.equal(findSlashFractions('ל-3/4:')[0].text, '3/4');
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

describe('review gaps', () => {
  it('flags algebraic quotients and keeps the documented non-fractions', () => {
    for (const sample of ['2x/3', 'π/2', '2a/3b', '(a+b)/2', 'p/100', '8/100']) {
      assert.equal(findSlashFractions(sample)[0].text, sample, sample);
    }
    const quiet = [
      'בית / כיתה',
      '01 / מתחילים',
      'יחידות/סימנים',
      '7 / 100',
      '90 km/h',
      '12 m/s',
      'and/or',
      'עודכן ב־18/10/2026',
      'https://example.com/a/b',
      'src/pages/index.astro',
      'border-radius:8px / 8px',
      'font:16px/1.5 Heebo',
    ];
    for (const sample of quiet) {
      assert.deepEqual(findSlashFractions(sample), [], sample);
    }
    assert.equal(replaceSlashFractions('ב-3/4 המכנה'), 'ב-⟨3¦4⟩ המכנה');
  });

  it('flags template text, a string after a tag, and an export string', () => {
    const astro = [
      '<p>',
      '3/4',
      '</p>',
      '</span> (a+b)/2',
      '<p>{Math.floor(m / 5)}</p>',
      '{cond && (<em>2x/3</em>)}',
      '<script>',
      'const code = (a+b)/2;',
      'const shown = "π/2";',
      'const re = /"/g;',
      'const after = "2a/3b";',
      '</script>',
      '',
    ].join('\n');
    const hits = scanSource('headless/astro-poc/src/pages/gap.astro', astro, []);
    assert.deepEqual(
      hits.map((hit) => `${hit.line}: ${hit.text}`).sort(),
      ['11: 2a/3b', '2: 3/4', '4: (a+b)/2', '6: 2x/3', '9: π/2'],
    );
  });

  it('flags svg text inside a topicFilms string and an exported string', () => {
    const source = [
      'export const svg = `<svg><text>3/4</text></svg>`;',
      'export const X = "1/2";',
      'const hidden = (a+b)/2;',
      'import film from "./grades/a/b";',
      'stage.style.aspectRatio = "4 / 3";',
      '',
    ].join('\n');
    const hits = scanSource('headless/astro-poc/src/lib/topicFilms/gap.ts', source, []);
    assert.deepEqual(
      hits.map((hit) => `${hit.line}: ${hit.text}`),
      ['1: 3/4', '2: 1/2'],
    );
  });

  it('scans conceptLoops.ts and public JavaScript', () => {
    const files = filesToScan();
    assert.equal(files.some((file) => file.endsWith('/src/lib/conceptLoops.ts')), true);
    assert.equal(files.some((file) => file.endsWith('/src/lib/loopHelpers.ts')), true);
    assert.equal(files.some((file) => file.endsWith('/src/lib/landingLoops.ts')), true);
    assert.equal(files.some((file) => file.endsWith('/src/lib/kiteAreaFilm.ts')), true);
    assert.equal(files.some((file) => file.endsWith('/src/public-lesson/lesson.html')), true);
    assert.equal(files.some((file) => file === 'headless/astro-poc/public/noam-glossary.js'), true);
    const root = mkdtempSync(join(tmpdir(), 'slash-gap-'));
    const rel = 'headless/astro-poc/public/gap.js';
    mkdirSync(join(root, 'headless/astro-poc/public'), { recursive: true });
    writeFileSync(join(root, rel), 'export const label = "3/4";\nconst code = (a+b)/2;\n');
    try {
      const hits = checkTree(root, []);
      assert.deepEqual(
        hits.filter((hit) => hit.file === rel).map((hit) => `${hit.line}: ${hit.text}`),
        ['1: 3/4'],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('flags a fraction built at runtime and keeps a path join', () => {
    const source = [
      'const label = n + "/" + d;',
      'const shown = `${n}/${d}`;',
      'const file = dir + "/" + name;',
      'const url = `${base}/${slug}`;',
      'const joined = `${PROD}/${slug}`;',
      'const built = String(a) + "/" + String(b);',
      'const foldered = `${folder}/${name}`;',
      'const prefixed = `${prefix}/${id}`;',
      'const paged = `${lang}/${page}`;',
      '',
    ].join('\n');
    assert.deepEqual(
      findBuiltSlashFractions(source).map((hit) => `${hit.line}: ${hit.text}`),
      ['1: n + "/" + d', '2: ${n}/${d}', '6: String(a) + "/" + String(b)'],
    );
    const hits = scanSource('headless/astro-poc/src/lib/topicFilms/gap.ts', source, []);
    assert.deepEqual(
      hits.map((hit) => `${hit.line}: ${hit.text}`),
      ['1: n + "/" + d', '2: ${n}/${d}', '6: String(a) + "/" + String(b)'],
    );
    const astro = ['---', 'const hidden = (a+b)/2;', '---', '<p>{num}/{den}</p>', '<p>{folder}/{name}</p>', ''].join('\n');
    const markupHits = scanSource('headless/astro-poc/src/pages/gap.astro', astro, []);
    assert.deepEqual(
      markupHits.map((hit) => `${hit.line}: ${hit.text}`),
      ['4: {num}/{den}'],
    );
  });
});

describe('repository', () => {
  it('has no slash fractions in visible site text', () => {
    // Bare pairs such as 18/12 and a colon after a fraction (ל-3/4:) are hits.
    const hits = checkTree();
    assert.deepEqual(
      hits.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`),
      [],
    );
  });
});
