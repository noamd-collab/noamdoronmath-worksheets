'use strict';

/**
 * Regression tests for tools/catalog-audit.cjs. Each test builds a small, clean repository
 * layout in a temp directory (audit result: no errors), injects one deliberate defect and
 * checks that the audit names it. PDFs are served by a local HTTP server; nothing reaches
 * the internet.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const audit = require('../tools/catalog-audit.cjs');
const { exportCatalog, loadIndexCatalog } = require('../scripts/lib/headless-catalog.cjs');

const P = audit.PATHS;
const id = (n) => crypto.createHash('md5').update('pdf-' + n).digest('hex');

const PDFS = {
  g1a: id('g1a'),
  g1b: id('g1b'),
  g1c: id('g1c'),
  g7t1a: id('g7t1a'),
  g7t1b: id('g7t1b'),
  g7t1c: id('g7t1c'),
  g7t2one: id('g7t2one'),
};

function baseData() {
  return {
    BASE: 'https://pdf.invalid/ugd/d8e7ad_',
    VIEWER: { enabled: true, path: 'worksheet-viewer-noam.html' },
    NOAM_PREFIX_FALLBACK: {},
    DATA: {
      1: {
        links: { 1: { a: PDFS.g1a, b: PDFS.g1b, c: PDFS.g1c } },
        groups: [{ key: 'num', name: 'Numbers' }],
        topics: [{ id: 1, ic: 'plus', g: 'num', t: 'Counting Apples' }],
      },
      7: {
        links: { 1: { a: PDFS.g7t1a, b: PDFS.g7t1b, c: PDFS.g7t1c }, 2: { one: PDFS.g7t2one } },
        groups: [
          { key: 'alg', name: 'Algebra' },
          { key: 'geo', name: 'Geometry' },
        ],
        topics: [
          { id: 1, x: 'G7-T01', ic: 'plus', g: 'alg', t: 'Linear Equations', d: 'Solving linear equations' },
          { id: 2, x: 'G7-T02', ic: 'plus', g: 'geo', t: 'Triangle Area', d: 'Area of triangles' },
        ],
      },
    },
    GRADE_EMOJI: { 1: '1', 7: '7' },
    GRADE_NAME: { 1: 'Grade 1', 7: 'Grade 7' },
    ELEMENTARY: [1],
    MIDDLE: [7],
    LEVELS: [
      { k: 'a', label: 'A', cls: 'lvl--a' },
      { k: 'b', label: 'B', cls: 'lvl--b' },
      { k: 'c', label: 'C', cls: 'lvl--c' },
    ],
    ICONS: { plus: '+' },
    TRACK_GROUPS: { r9sep: true },
    SEARCH_TERMS: { 7: { 1: ['equation'] } },
  };
}

function indexHtml(d) {
  const v = (name, value) => `var ${name} = ${JSON.stringify(value, null, 1)};`;
  return `<!doctype html><html><head><title>fixture</title></head><body><script>
${v('BASE', d.BASE)}
${v('VIEWER', d.VIEWER)}
${v('NOAM_PREFIX_FALLBACK', d.NOAM_PREFIX_FALLBACK)}
${v('DATA', d.DATA)}
${v('GRADE_EMOJI', d.GRADE_EMOJI)}
${v('GRADE_NAME', d.GRADE_NAME)}
${v('ELEMENTARY', d.ELEMENTARY)}
${v('MIDDLE', d.MIDDLE)}
${v('LEVELS', d.LEVELS)}
${v('ICONS', d.ICONS)}
${v('TRACK_GROUPS', d.TRACK_GROUPS)}
${v('SEARCH_TERMS', d.SEARCH_TERMS)}
</script></body></html>
`;
}

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2) + '\n');
}

/** A consistent repository: index.html plus every generated copy, manifest and page. */
function makeRepo(mutateData) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-audit-'));
  const d = baseData();
  if (mutateData) mutateData(d);
  write(root, P.index, indexHtml(d));
  regenerate(root);
  write(root, P.middleFixture, {
    grades: { 7: [{ id: 1, title: 'Linear Equations', prefix: 'G7-T01', links: { a: PDFS.g7t1a, b: PDFS.g7t1b, c: PDFS.g7t1c } }] },
  });
  const manifest = (pdf, topicId, level, topic, prefix) => ({ schemaVersion: 2, pdfHash: pdf, aliases: [], grade: 7, topicId, prefix, topic, level, pageCount: 2, reviewRequired: false, issues: [] });
  for (const [pdf, t, l, title, x] of [
    [PDFS.g7t1a, 1, 'a', 'Linear Equations', 'G7-T01'],
    [PDFS.g7t1b, 1, 'b', 'Linear Equations', 'G7-T01'],
    [PDFS.g7t1c, 1, 'c', 'Linear Equations', 'G7-T01'],
    [PDFS.g7t2one, 2, 'b', 'Triangle Area', 'G7-T02'],
  ]) {
    write(root, `${P.manifests}/${pdf}.json`, manifest(pdf, t, l, title, x));
    write(root, `${P.manifestsPublic}/${pdf}.json`, manifest(pdf, t, l, title, x));
  }
  write(root, `${P.topicPages}/linear-equations-grade-7.json`, {
    slug: 'linear-equations-grade-7',
    path: '/linear-equations-grade-7',
    grade: 7,
    h1: 'Linear Equations for grade 7',
    catalogCta: { href: '/worksheets?grade=7&topic=1', catalogTopicId: 1, catalogTopicTitle: 'Linear Equations' },
    relatedTopics: [{ href: '/grade-7', label: 'grade 7' }],
  });
  write(root, `${P.blogPosts}/equations-tips.json`, { path: '/post/equations-tips', related: [{ href: '/linear-equations-grade-7' }, { href: '/worksheets?grade=7&topic=2' }] });
  write(root, `${P.gradeHubs}/7.json`, { grade: 7, path: '/grade-7', topicLinks: [{ path: '/linear-equations-grade-7' }], catalogCta: { href: '/worksheets?grade=7' } });
  return root;
}

/** Rewrite every generated copy from the fixture's index.html (as the repo's scripts would). */
function regenerate(root) {
  const { text } = exportCatalog({ indexPath: path.join(root, P.index), outPath: path.join(root, P.export) });
  write(root, P.snapshot, text);
  write(root, P.snapshotSha, crypto.createHash('sha256').update(text).digest('hex') + '\n');
  write(root, P.legacyIndex, fs.readFileSync(path.join(root, P.index)));
  const { learningText, seedText } = audit.learningOutputs(loadIndexCatalog(path.join(root, P.index)));
  write(root, P.learning, learningText);
  write(root, P.learningPublic, learningText);
  write(root, P.seed, seedText);
}

const codes = (result, severity) => result.findings.filter((f) => !severity || f.severity === severity).map((f) => f.code);
const errors = (result) => result.findings.filter((f) => f.severity === 'error');

async function auditOf(root, opts = {}) {
  return audit.runAudit({ root, ...opts });
}

function editJson(root, rel, fn) {
  const file = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  fn(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// ─── clean baseline ───

test('a consistent fixture repository has no errors and full coverage', async () => {
  const r = await auditOf(makeRepo());
  assert.deepEqual(errors(r), []);
  assert.equal(r.coverage.topics, 3);
  assert.equal(r.coverage.worksheetLevels, 7);
  assert.equal(r.coverage.manifestsMatchedToCatalog, 4);
  assert.equal(r.coverage.pdf.unverified, 7, 'offline: every PDF is unverified, none passes');
  assert.ok(codes(r).includes('PDF_UNVERIFIED'));
});

// ─── index.html DATA ───

const dataCases = [
  ['DATA_DUP_TOPIC_ID', (d) => d.DATA[7].topics.push({ ...d.DATA[7].topics[0] })],
  ['DATA_LINKS_ORPHAN', (d) => (d.DATA[7].links[9] = { a: id('orphan') })],
  ['DATA_TOPIC_NO_LEVELS', (d) => delete d.DATA[7].links[2]],
  ['DATA_GROUP_UNKNOWN', (d) => (d.DATA[7].topics[1].g = 'nope')],
  ['DATA_TRACK_HIDDEN', (d) => {
    d.DATA[7].groups.push({ key: 'r9sep', name: 'September' });
    d.DATA[7].topics[1].g = 'r9sep';
  }],
  ['DATA_PARENT_MISSING', (d) => (d.DATA[7].topics[1].parent = 42)],
  ['DATA_PDF_ID_FORMAT', (d) => (d.DATA[7].links[1].b = 'NOT-AN-ID')],
  ['DATA_LEVEL_ONE_AND_ABC', (d) => (d.DATA[7].links[2].a = id('extra'))],
  ['DATA_PREFIX_GRADE', (d) => (d.DATA[7].topics[1].x = 'G8-T02')],
  ['PDF_SHARED_SUSPICIOUS', (d) => (d.DATA[1].links[1].c = PDFS.g7t2one)],
  ['DATA_SEARCH_TERMS_ORPHAN', (d) => (d.SEARCH_TERMS[7][77] = ['ghost'])],
  ['DATA_PREFIX_FALLBACK_ORPHAN', (d) => (d.NOAM_PREFIX_FALLBACK[7] = { 77: 'G7-T77' })],
];
for (const [code, mutate] of dataCases) {
  test(`index.html defect is reported: ${code}`, async () => {
    const r = await auditOf(makeRepo(mutate));
    assert.ok(codes(r).includes(code), `${code} missing; got ${[...new Set(codes(r))].join(', ')}`);
  });
}

test('a PDF shared by a topic and its subtopic is intended, not suspicious', async () => {
  const r = await auditOf(
    makeRepo((d) => {
      d.DATA[7].topics.push({ id: 3, x: 'G7-T03', ic: 'plus', g: 'alg', t: 'Equations part 2', parent: 1 });
      d.DATA[7].links[3] = { a: PDFS.g7t1a };
    })
  );
  assert.ok(codes(r).includes('PDF_SHARED_INTENDED'));
  assert.ok(!codes(r).includes('PDF_SHARED_SUSPICIOUS'));
});

test('titles: unit, grade letter, maqaf, exact and near duplicates', async () => {
  const r = await auditOf(
    makeRepo((d) => {
      d.DATA[1].topics.push(
        { id: 2, ic: 'plus', g: 'num', t: 'מדידות אורך סמ ומטר' },
        { id: 3, ic: 'plus', g: 'num', t: 'סיכום לכיתה ד' },
        { id: 4, ic: 'plus', g: 'num', t: 'חיבור דו ספרתי' },
        { id: 5, ic: 'plus', g: 'num', t: 'מרכיבים ומפרקים' },
        { id: 6, ic: 'plus', g: 'num', t: 'מרכיבים ומפרקים עד 10' },
        { id: 7, ic: 'plus', g: 'num', t: 'Counting Apples' }
      );
      for (const t of [2, 3, 4, 5, 6, 7]) d.DATA[1].links[t] = { a: id('t' + t), b: id('t' + t + 'b'), c: id('t' + t + 'c') };
    })
  );
  for (const code of ['TITLE_UNIT', 'TITLE_GRADE_GERESH', 'TITLE_MAQAF', 'TITLE_DUPLICATE', 'TITLE_NEAR_DUPLICATE']) {
    assert.ok(codes(r).includes(code), code);
  }
  const near = r.findings.find((f) => f.code === 'TITLE_NEAR_DUPLICATE');
  assert.equal(near.topicId, '5,6');
});

test('parts א / ב of one topic are not reported as near duplicates', async () => {
  const r = await auditOf(
    makeRepo((d) => {
      d.DATA[1].topics.push({ id: 2, ic: 'plus', g: 'num', t: 'זוגי אי־זוגי וסדרות א' }, { id: 3, ic: 'plus', g: 'num', t: 'זוגי אי־זוגי וסדרות ב' });
      d.DATA[1].links[2] = { a: id('p2'), b: id('p2b'), c: id('p2c') };
      d.DATA[1].links[3] = { a: id('p3'), b: id('p3b'), c: id('p3c') };
    })
  );
  assert.ok(!codes(r).includes('TITLE_NEAR_DUPLICATE'));
});

// ─── generated copies ───

test('stale export, snapshot, checksum, learning catalog and seed are reported', async () => {
  const root = makeRepo();
  // index.html changes but nothing is regenerated
  const d = baseData();
  d.DATA[7].topics[1].t = 'Triangle Area and Height';
  d.DATA[7].topics.push({ id: 3, x: 'G7-T03', ic: 'plus', g: 'geo', t: 'Circles', d: 'Circle area' });
  d.DATA[7].links[3] = { a: id('c3a'), b: id('c3b'), c: id('c3c') };
  write(root, P.index, indexHtml(d));
  const r = await auditOf(root);
  for (const code of ['EXPORT_STALE', 'SITE_TITLE_DRIFT', 'SITE_TOPIC_MISSING', 'LEARNING_CATALOG_STALE', 'LEARNING_SEED_STALE', 'LEGACY_COPY_DRIFT']) {
    assert.ok(codes(r).includes(code), code);
  }
  // once regenerated they all clear; the new middle-school topic still lacks viewer manifests
  regenerate(root);
  assert.deepEqual(
    errors(await auditOf(root)).map((f) => `${f.code} ${f.topicId}${f.level}`),
    ['MANIFEST_MISSING 3a', 'MANIFEST_MISSING 3b', 'MANIFEST_MISSING 3c']
  );
});

test('the site snapshot linking a different PDF than index.html is reported', async () => {
  const root = makeRepo();
  editJson(root, P.snapshot, (c) => {
    c.grades.find((g) => g.grade === 7).topics[0].levels[0].pdfId = id('swapped');
  });
  const r = await auditOf(root);
  assert.ok(codes(r).includes('SITE_PDF_DRIFT'));
  assert.ok(codes(r).includes('SNAPSHOT_STALE'));
  assert.ok(codes(r).includes('SNAPSHOT_SHA'));
});

test('an approved middle-school mapping that changed is reported', async () => {
  const r = await auditOf(makeRepo((d) => (d.DATA[7].links[1].b = id('replacement'))));
  const f = r.findings.find((x) => x.code === 'APPROVED_MAPPING_CHANGED');
  assert.ok(f);
  assert.equal(f.level, 'b');
});

// ─── manifests ───

test('a manifest made for another topic, and a missing manifest, are reported', async () => {
  const root = makeRepo();
  editJson(root, `${P.manifests}/${PDFS.g7t1b}.json`, (m) => {
    m.topicId = 2;
    m.topic = 'Triangle Area';
  });
  fs.rmSync(path.join(root, P.manifests, `${PDFS.g7t1c}.json`));
  const r = await auditOf(root);
  assert.ok(codes(r).includes('MANIFEST_MISMATCH'));
  assert.ok(codes(r).includes('MANIFEST_MISSING'));
  assert.ok(codes(r).includes('MANIFEST_COPY_DRIFT'));
});

// ─── pages and links ───

test('topic page CTA defects are reported', async () => {
  const root = makeRepo();
  write(root, `${P.topicPages}/broken-grade-7.json`, {
    slug: 'broken-grade-7',
    path: '/broken-grade-7',
    grade: 7,
    h1: 'Circles and circumference',
    catalogCta: { href: '/worksheets?grade=7&topic=2', catalogTopicId: 1, catalogTopicTitle: 'Old title' },
    catalogCtas: [
      { href: '/worksheets?grade=8&topic=1', catalogTopicId: 1 },
      { href: '/worksheets?grade=7&topic=99', catalogTopicId: 99 },
    ],
  });
  const r = await auditOf(root);
  for (const code of ['PAGE_CTA_HREF_TOPIC', 'PAGE_CTA_TITLE_DRIFT', 'PAGE_TOPIC_FIT', 'PAGE_CTA_GRADE', 'PAGE_CTA_TOPIC_MISSING']) {
    assert.ok(codes(r).includes(code), code);
  }
});

test('a main button that is a weaker match than a secondary one is reported for review', async () => {
  const root = makeRepo();
  write(root, `${P.topicPages}/triangle-area-grade-7.json`, {
    slug: 'triangle-area-grade-7',
    path: '/triangle-area-grade-7',
    grade: 7,
    h1: 'Triangle Area for grade 7',
    catalogCta: { href: '/worksheets?grade=7&topic=1', catalogTopicId: 1, catalogTopicTitle: 'Linear Equations' },
    catalogCtas: [{ href: '/worksheets?grade=7&topic=2', catalogTopicId: 2, catalogTopicTitle: 'Triangle Area' }],
  });
  const r = await auditOf(root);
  const f = r.findings.find((x) => x.code === 'PAGE_PRIMARY_CTA');
  assert.ok(f);
  assert.equal(f.subject, '/triangle-area-grade-7');
  assert.ok(!r.findings.some((x) => x.code === 'PAGE_TOPIC_FIT' && x.subject === '/triangle-area-grade-7'));
});

test('search terms that describe another topic are reported', async () => {
  const r = await auditOf(makeRepo((d) => (d.SEARCH_TERMS[7] = { 1: 'triangle area height', 2: 'area' })));
  const f = r.findings.find((x) => x.code === 'SEARCH_TERMS_MISPLACED');
  assert.ok(f);
  assert.equal(f.topicId, 1);
  assert.match(f.evidence, /topic 2/);
});

test('links with no target are reported', async () => {
  const root = makeRepo();
  write(root, `${P.blogPosts}/broken.json`, {
    path: '/post/broken',
    related: [{ href: '/no-such-page' }, { href: '/worksheets?grade=7&topic=999' }, { href: '/worksheets?grade=5' }, { href: '/worksheets?grade=7&group=nope' }],
  });
  const r = await auditOf(root);
  for (const code of ['LINK_TARGET_MISSING', 'LINK_TOPIC_MISSING', 'LINK_GRADE_MISSING', 'LINK_GROUP_MISSING']) {
    assert.ok(codes(r).includes(code), code);
  }
});

// ─── PDFs over HTTP (local server) ───

function pdfWithText(text, { pages = 1, compress = false } = {}) {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const stream = compress ? zlib.deflateSync(Buffer.from(content, 'latin1')) : Buffer.from(content, 'latin1');
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i} 0 R`).join(' ');
  const objs = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`),
    Buffer.concat([Buffer.from(`<< /Length ${stream.length}${compress ? ' /Filter /FlateDecode' : ''} >>\nstream\n`), stream, Buffer.from('\nendstream')]),
    ...Array.from({ length: pages }, () => Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 3 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>')),
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  objs.forEach((body, i) => parts.push(Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')));
  parts.push(Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'));
  return Buffer.concat(parts);
}

test('inspectPdf reads signature, page count and text, also from Flate streams', () => {
  const plain = audit.inspectPdf(pdfWithText('Linear Equations Grade 7', { pages: 3 }));
  assert.equal(plain.isPdf, true);
  assert.equal(plain.pages, 3);
  assert.match(plain.text, /Linear Equations Grade 7/);
  const packed = audit.inspectPdf(pdfWithText('Triangle Area', { compress: true }));
  assert.equal(packed.pages, 1);
  assert.match(packed.text, /Triangle Area/);
  const html = audit.inspectPdf(Buffer.from('<!DOCTYPE html><html><body>Not found</body></html>'));
  assert.equal(html.isPdf, false);
  assert.equal(html.kind, 'html');
});

async function withServer(routes, fn) {
  const server = http.createServer((req, res) => {
    const name = path.basename(req.url).replace(/^d8e7ad_/, '').replace(/\.pdf$/, '');
    const route = routes[name];
    if (!route) {
      res.writeHead(404).end('missing');
      return;
    }
    res.writeHead(route.status || 200, { 'content-type': route.type || 'application/pdf' }).end(route.body || '');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}/ugd/d8e7ad_`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('network PDF checks: verified, not a PDF, missing, wrong grade, wrong title, no access', async () => {
  const root = makeRepo();
  const r = await withServer(
    {
      [PDFS.g7t1a]: { body: pdfWithText('Linear Equations - Grade 7', { pages: 2 }) },
      [PDFS.g7t1b]: { body: '<!doctype html><html><body>Error</body></html>', type: 'text/html' },
      // g7t1c: not served → 404
      [PDFS.g7t2one]: { body: pdfWithText('Triangle Area - Grade 8') },
      [PDFS.g1a]: { body: pdfWithText('Fractions and Decimals') },
      [PDFS.g1b]: { status: 403, body: 'forbidden' },
      [PDFS.g1c]: { status: 503, body: 'busy' },
    },
    (base) => auditOf(root, { pdf: 'network', pdfBase: base, pdfTimeoutMs: 5000 })
  );
  assert.ok(codes(r).includes('PDF_NOT_PDF'));
  assert.ok(codes(r).includes('PDF_MISSING'));
  assert.ok(codes(r).includes('PDF_GRADE_MISMATCH'));
  assert.ok(codes(r).includes('PDF_TITLE_MISMATCH'));
  const status = Object.fromEntries(r.relations.filter((x) => x.relation === 'pdf check').map((x) => [x.pdfId, x.target]));
  assert.equal(status[PDFS.g7t1a], 'verified');
  assert.equal(status[PDFS.g7t1b], 'failed');
  assert.equal(status[PDFS.g7t1c], 'failed');
  assert.equal(status[PDFS.g7t2one], 'mismatch');
  assert.equal(status[PDFS.g1a], 'mismatch');
  assert.equal(status[PDFS.g1b], 'unverified', '403 is lack of access, not a failed PDF');
  assert.equal(status[PDFS.g1c], 'unverified');
  assert.deepEqual(r.coverage.pdf, { mode: 'network', total: 7, verified: 1, mismatch: 2, failed: 2, unverified: 2 });
});

test('a host that cannot be reached leaves every PDF unverified, with no failure', async () => {
  const root = makeRepo();
  const closed = await new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
  const r = await auditOf(root, { pdf: 'network', pdfBase: `http://127.0.0.1:${closed}/ugd/d8e7ad_`, pdfTimeoutMs: 3000 });
  assert.deepEqual(errors(r), []);
  assert.equal(r.coverage.pdf.unverified, 7);
  assert.ok(r.relations.filter((x) => x.relation === 'pdf check').every((x) => x.target === 'unverified' && /no access/.test(x.evidence)));
});

// ─── tool behaviour ───

test('the audit is deterministic and never writes to the repository', async () => {
  const root = makeRepo((d) => (d.DATA[7].links[1].b = 'NOT-AN-ID'));
  const snapshot = () => {
    const out = {};
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir).sort()) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else out[path.relative(root, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
      }
    };
    walk(root);
    return out;
  };
  const before = snapshot();
  const out1 = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-'));
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-'));
  audit.writeOutputs(await auditOf(root), out1);
  audit.writeOutputs(await auditOf(root), out2);
  assert.deepEqual(snapshot(), before, 'inputs unchanged');
  for (const f of ['report.md', 'audit.json', 'findings.csv', 'relations.csv']) {
    assert.equal(fs.readFileSync(path.join(out1, f), 'utf8'), fs.readFileSync(path.join(out2, f), 'utf8'), f);
  }
});

test('exit codes: 0 clean, 1 errors (or warnings with --fail-on warning), 2 bad arguments', async () => {
  const quiet = console.log;
  console.log = () => {};
  try {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-'));
    assert.equal(await audit.main(['--root', makeRepo(), '--out', out]), 0);
    assert.equal(await audit.main(['--root', makeRepo((d) => (d.DATA[7].links[1].b = 'x')), '--out', out]), 1);
    assert.equal(await audit.main(['--root', makeRepo((d) => d.DATA[1].topics.push({ id: 2, ic: 'plus', g: 'num', t: 'חיבור דו ספרתי' }) && (d.DATA[1].links[2] = { a: id('w'), b: id('w2'), c: id('w3') })), '--out', out, '--fail-on', 'warning']), 1);
    const err = console.error;
    console.error = () => {};
    try {
      assert.equal(await audit.main(['--pdf', 'sometimes']), 2);
    } finally {
      console.error = err;
    }
  } finally {
    console.log = quiet;
  }
});

test('outputs: report sections, JSON summary and CSV headers', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-'));
  audit.writeOutputs(await auditOf(makeRepo((d) => (d.DATA[7].topics[1].g = 'nope'))), out);
  const report = fs.readFileSync(path.join(out, 'report.md'), 'utf8');
  assert.match(report, /## שגיאה/);
  assert.match(report, /DATA_GROUP_UNKNOWN/);
  const json = JSON.parse(fs.readFileSync(path.join(out, 'audit.json'), 'utf8'));
  assert.equal(json.summary.bySeverity.error, json.findings.filter((f) => f.severity === 'error').length);
  assert.match(fs.readFileSync(path.join(out, 'findings.csv'), 'utf8'), /^﻿severity,code,grade,topic_id,level,pdf_id,subject,message,source_file,evidence\n/);
  assert.match(fs.readFileSync(path.join(out, 'relations.csv'), 'utf8'), /^﻿relation,grade,topic_id,topic_title,level,pdf_id,target,source_file,evidence\n/);
});
