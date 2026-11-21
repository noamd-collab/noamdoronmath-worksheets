// Synthetic offline tests. No live hints, network access or activation evidence.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const pdf = Buffer.from('LOCAL_SYNTHETIC_PDF_BYTES');
const text = 'Synthetic exercise text';
const config = {
  url: 'https://offline-fixture.supabase.co',
  key: 'SYNTHETIC_NON_CREDENTIAL',
};
function setup() {
  const c = {
    Promise,
    AbortController,
    TextEncoder,
    Uint8Array,
    setTimeout,
    clearTimeout,
    crypto: crypto.webcrypto,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'noam-curated-hints.js'), 'utf8'),
    c,
  );
  return c.NoamCuratedHints;
}
function manifest(prefix = 'G8-T142', levelCode = 'A') {
  return {
    editionId: 'synthetic-local-test',
    geometryContract: 'measured-v1',
    publishable: true,
    reviewRequired: false,
    prefix,
    levelCode,
    grade: Number(prefix[1]),
    pdfHash: 'a'.repeat(32),
    sourceSha256: sha(pdf),
    canonicalSourceSha256: 'b'.repeat(64),
    exercises: [
      {
        id: prefix + '-' + levelCode + '-Q01א',
        q: 1,
        part: 'א',
        canonicalItemId: 'q1a',
        canonicalQuestionId: 'q1',
        canonicalQuestionSha256: 'c'.repeat(64),
        sourceExerciseSha256: sha(text),
        text,
      },
    ],
  };
}
const ctx = (m) => ({
  gradeNumber: m.grade,
  editionId: m.editionId,
  pdfHash: m.pdfHash,
  prefix: m.prefix,
  levelCode: m.levelCode,
});
const row = (m) => ({
  edition_id: m.editionId,
  exercise_id: m.exercises[0].id,
  source_pdf_hash: m.pdfHash,
  source_pdf_sha256: m.sourceSha256,
  canonical_source_sha256: m.canonicalSourceSha256,
  canonical_question_sha256: m.exercises[0].canonicalQuestionSha256,
  canonical_item_id: 'q1a',
  source_exercise_sha256: sha(text),
  hint_1: 'first step',
  hint_2: 'next step',
  hint_3: 'last hint',
  status: 'verified',
});

test('published and root client copies stay identical', () =>
  assert.equal(
    fs.readFileSync(path.join(root, 'noam-curated-hints.js'), 'utf8'),
    fs.readFileSync(
      path.join(root, 'headless/astro-poc/public/noam-curated-hints.js'),
      'utf8',
    ),
  ));
test('reviewed two- and three-digit editions verify the same exact PDF and item binding', async () => {
  for (const prefix of ['G1-T05', 'G7-T99', 'G8-T142', 'G9-T134'])
    for (const level of ['A', 'B', 'E', 'E2']) {
      const m = manifest(prefix, level);
      assert.equal(
        await setup().validateViewerBinding(m, ctx(m), pdf),
        true,
        prefix + level,
      );
    }
});
test('invalid prefixes and mismatched sources remain rejected', async () => {
  for (const prefix of [
    'G8-T9',
    'G8-T1000',
    'G0-T142',
    'G10-T142',
    'G8-T14x',
    'G1-T142',
    'G6-T999',
    'G9-T001',
    'G8-T142\n',
    'G8-T142extra',
  ]) {
    const m = manifest(prefix);
    assert.equal(
      await setup().validateViewerBinding(m, ctx(m), pdf),
      false,
      prefix,
    );
  }
  const m = manifest(),
    bank = setup();
  for (const change of [
    { prefix: 'G8-T143' },
    { gradeNumber: 9 },
    { editionId: 'another' },
    { levelCode: 'B' },
    { pdfHash: 'f'.repeat(32) },
  ])
    assert.equal(
      await bank.validateViewerBinding(m, { ...ctx(m), ...change }, pdf),
      false,
    );
  for (const change of [
    { publishable: false },
    { reviewRequired: true },
    { syntheticTestFixture: true },
    { sourceSha256: 'd'.repeat(64) },
    { grade: 9 },
  ])
    assert.equal(
      await bank.validateViewerBinding({ ...m, ...change }, ctx(m), pdf),
      false,
    );
  const changed = structuredClone(m);
  changed.exercises[0].text += ' changed';
  assert.equal(await bank.validateViewerBinding(changed, ctx(m), pdf), false);
});
test('three-digit hint read accepts only all-bound verified rows', async () => {
  const m = manifest();
  let queries = 0;
  const valid = row(m),
    bank = setup();
  assert.equal(
    await bank.prefetch(m, {
      config,
      fetch: async (url) => {
        queries++;
        assert.ok(url.includes('noam_worksheet_edition_hints'));
        assert.ok(url.includes('G8-T142-A-Q*'));
        return { ok: true, json: async () => [valid] };
      },
    }),
    1,
  );
  assert.equal(queries, 1);
  assert.deepEqual(Array.from(bank.get(m, m.exercises[0].id).hints), [
    'first step',
    'next step',
    'last hint',
  ]);
  for (const change of [
    { status: 'review' },
    { edition_id: 'other' },
    { exercise_id: 'G8-T143-A-Q01א' },
    { source_pdf_hash: 'd'.repeat(32) },
    { source_pdf_sha256: 'd'.repeat(64) },
    { canonical_source_sha256: 'd'.repeat(64) },
    { canonical_question_sha256: 'd'.repeat(64) },
    { canonical_item_id: 'another-item' },
    { source_exercise_sha256: 'd'.repeat(64) },
    { hint_3: '' },
  ]) {
    const b = setup();
    assert.equal(
      await b.prefetch(m, {
        config,
        fetch: async () => ({
          ok: true,
          json: async () => [{ ...valid, ...change }],
        }),
      }),
      0,
      JSON.stringify(change),
    );
    assert.equal(b.get(m, m.exercises[0].id), null);
  }
  assert.equal(
    await setup().prefetch(m, {
      config,
      fetch: async () => ({ ok: true, json: async () => [valid, valid] }),
    }),
    0,
  );
});
test('legacy three-digit requests are not enabled by the edition change', async () => {
  const legacy = {
    prefix: 'G8-T142',
    levelCode: 'A',
    pdfHash: 'a'.repeat(32),
    exercises: [{ id: 'G8-T142-A-Q01א' }],
  };
  let fetched = false;
  assert.equal(
    await setup().prefetch(legacy, {
      config,
      fetch: async () => {
        fetched = true;
        throw new Error('must not fetch');
      },
    }),
    0,
  );
  assert.equal(fetched, false);
});
test('both viewer copies gate three-digit links on edition mode and retain grade binding', () => {
  for (const rel of [
    'worksheet-viewer-noam.html',
    'headless/astro-poc/public/worksheet-viewer-noam.html',
  ]) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const code = src.slice(src.indexOf('var okX ='), src.indexOf('var okLv ='));
    for (const [x, g, editionRequested, want] of [
      ['G8-T142', 8, true, true],
      ['G8-T142', 8, false, false],
      ['G8-T99', 8, false, true],
      ['G8-T142', 7, true, false],
      ['G8-T1420', 8, true, false],
      ['G8-T142\n', 8, true, false],
    ]) {
      const c = { x, g, editionRequested };
      vm.runInNewContext(code, c);
      assert.equal(c.okX, want, rel + ' ' + JSON.stringify(c));
    }
    assert.ok(
      src.includes('noam-curated-hints.js?v=20261120-three-digit-editions'),
    );
  }
});
