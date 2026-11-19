'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), catalogDir = path.join(root, 'headless/catalog'), pub = path.join(root, 'headless/astro-poc/public');
const { loadRamziActivationEvidence, validateRamziActivation } = require('../scripts/lib/worksheet-ramzi-activation.cjs');
const { mergeWorksheetEditions } = require('../scripts/lib/worksheet-editions.cjs');
const { validateHintCorrection, hintCorrectionScope } = require('../scripts/lib/worksheet-hint-correction.mjs');
const { hintCorrectionBuildScope, validateHintCorrectionRows } = require('../scripts/lib/worksheet-hint-correction-build.cjs');
const { exportCatalog, loadIndexCatalog } = require('../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../scripts/build-learning-catalog.cjs');
const { mergeReviewedCatalog } = require('../scripts/lib/reviewed-ramzi-activation.mjs');
const { loadAdditionalEvidence } = require('../scripts/lib/reviewed-ramzi-activation-build.cjs');
// The committed, receipt-backed additional activation is independent of the hint correction.
const additional = loadAdditionalEvidence(catalogDir, pub);
const registry = JSON.parse(fs.readFileSync(path.join(catalogDir, 'worksheet-editions.v1.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(catalogDir, 'catalog.v1.json')));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = value => JSON.stringify(value, null, 2) + '\n';
const clone = value => JSON.parse(JSON.stringify(value));
function deployedEvidence() { return loadRamziActivationEvidence(catalogDir, pub); }
function baseline() {
  const evidence = deployedEvidence();
  delete evidence.hintCorrection; delete evidence.hintCorrectionRows;
  return evidence;
}
// Synthetic transaction/readback only, constructed in memory or a temp directory.
// These synthetic receipts exercise the historical validator; they do not replace
// the separate real correction metadata now committed in the production catalog.
// This fixture never creates an applied correction file in the production catalog.
function fixture() {
  const b = baseline(), scope = hintCorrectionBuildScope();
  const pins = { ...scope.pins }; delete pins.baselineReadyObjectSha256;
  const common = { ...pins, ...scope.payloads, authorId: 'antigravity-flash', reviewerId: 'codex-root' };
  const readback = { schema: 'noam-first567-hint-correction-db-readback/v2', status: 'verified_exact_readback', ...common,
    sourceReceiptSha256: hash('synthetic actual-readback-shaped test receipt only'), observedAt: '2026-11-15T12:10:00.000Z',
    counts: { correctedRows: 15, correctedHints: 45, first567Rows: 567, unchangedRows: 552, legacyRows: 31761, learningRows: 968 },
    before: clone(scope.preserved), after: clone(scope.preserved), ...scope.rowScope };
  const record = { schema: 'noam-first567-hint-correction/v2', status: 'applied_verified', ...common,
    readbackReceiptSha256: hash(bytes(readback)), ...scope.rowScope };
  b.hintCorrection = { record, readback }; b.hintCorrectionRows = Buffer.from(JSON.stringify(scope.rows)); return b;
}
function rejectedEverywhere(b) {
  assert.throws(() => validateRamziActivation(registry, b), /Hint correction|Ramzi activation/);
  assert.throws(() => mergeWorksheetEditions(catalog, registry, b.ready, b.hintCorrection), /Hint correction|Ramzi readiness/);
}

test('explicitly absent correction preserves historical evidence and all learning rows', () => {
  const b = baseline(); assert(!Object.hasOwn(b, 'hintCorrection'));
  assert.equal(validateHintCorrection(b.ready, undefined), undefined);
  const historical = mergeWorksheetEditions(catalog, registry, b.ready);
  assert(!Object.hasOwn(historical, 'ramziHintCorrection'));
  assert.deepEqual(exportCatalog({ indexPath: path.join(root, 'index.html'), ramziActivation: b, dryRun: true }).catalog,
    mergeReviewedCatalog(historical, registry, b.ready, undefined, catalog.reviewedRamziActivations, additional.trust));
  const learning = buildLearningCatalog(loadIndexCatalog(path.join(root, 'index.html')), registry, b, additional);
  assert.equal('/* Generated from index.html; do not edit by hand. */\nwindow.NOAM_LEARNING_CATALOG=' + JSON.stringify(learning) + ';\n',
    fs.readFileSync(path.join(root, 'noam-learning-catalog.js'), 'utf8'));
});
test('committed real15/45 correction loads exact independently verified readback into build and SSR', () => {
  const b = deployedEvidence(), bundle = b.hintCorrection;
  assert(bundle, 'actual committed correction required');
  assert.equal(hash(fs.readFileSync(path.join(catalogDir, 'worksheet-ramzi-hint-correction.v2.json'))),
    '4958a1f3457f984f0f8e878a67bf47cba8bbfc9472ac92635ccaefa15603c4ff');
  assert.equal(bundle.record.readbackReceiptSha256, '01e60d4e1c477c53685bc95ec6e35bbd03520bdc59dce6f7e186e2f395188cf6');
  assert.equal(bundle.readback.sourceReceiptSha256, '0b8ebd7a0e2a1c868cd47e198240b667816e1f5b5d5aaa9195f838f85e0c35da');
  assert.equal(bundle.readback.observedAt, '2026-11-16T15:43:13.045Z');
  assert.equal(bundle.record.effectivePayloadSha256, '1a90e0be1dc8dced441ff37415de84ebab7f72c964cd633fb4d937ffccfbefee');
  assert.equal(validateHintCorrectionRows(b.hintCorrectionRows).length, 15);
  const checked = validateRamziActivation(registry, b);
  assert.equal(checked.size, 12);
  const out = exportCatalog({ indexPath: path.join(root, 'index.html'), dryRun: true });
  assert.equal(out.validation.ok, true);
  assert.equal(out.text, fs.readFileSync(path.join(catalogDir, 'catalog.v1.json'), 'utf8'));
  assert.deepEqual(out.catalog.ramziHintCorrection, bundle);
  assert.deepEqual(mergeReviewedCatalog(out.catalog, registry, b.ready, bundle, out.catalog.reviewedRamziActivations, additional.trust), out.catalog);
  for (const ready of checked.values()) assert.equal(ready.payloadSha256, bundle.record.effectivePayloadSha256);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(path.join(root, 'index.html')), registry, b),
    buildLearningCatalog(loadIndexCatalog(path.join(root, 'index.html')), registry, baseline()));
});
test('synthetic exact15/45 correction is shared by build and SSR while keeping source/v1/learning unchanged', () => {
  const b = fixture(), saved = bytes(b.ready), old = mergeWorksheetEditions(catalog, registry, b.ready);
  const checked = validateRamziActivation(registry, b);
  const next = mergeWorksheetEditions(catalog, registry, b.ready, b.hintCorrection);
  assert.equal(checked.size, 12); assert.equal(bytes(b.ready), saved); assert.deepEqual(next.ramziActivation, old.ramziActivation);
  for (const g of next.grades) for (const t of g.topics) for (const e of t.editions || []) for (const l of e.levels) {
    if (!l.ramzi) continue;
    assert.deepEqual(l.ramzi, checked.get(e.editionId + ':' + l.key));
    assert.equal(l.ramzi.payloadSha256, b.hintCorrection.record.effectivePayloadSha256);
  }
  assert.deepEqual(mergeWorksheetEditions(next, registry, b.ready), old, 'withdrawing correction removes stale overlay');
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(path.join(root, 'index.html')), registry, b),
    buildLearningCatalog(loadIndexCatalog(path.join(root, 'index.html')), registry, baseline()));
});

for (const [name, mutate] of [
  ['null bundle', b => b.hintCorrection = null],
  ['unknown bundle key', b => b.hintCorrection.extra = true],
  ['custom record prototype', b => Object.setPrototypeOf(b.hintCorrection.record, { unreviewed: true })],
  ['JSON prototype key', b => b.hintCorrection.record = JSON.parse(JSON.stringify(b.hintCorrection.record).replace('{', '{\"__proto__\":{},'))],
  ['missing readback', b => delete b.hintCorrection.readback],
  ['unknown record key/private hints', b => b.hintCorrection.record.hint_1 = 'private text'],
  ['missing record pin', b => delete b.hintCorrection.record.semanticReviewSha256],
  ['pending correction', b => b.hintCorrection.record.status = 'prepared_not_applied'],
  ['fake readback phase', b => b.hintCorrection.readback.status = 'prepared_not_executed'],
  ['wrong baseline', b => b.hintCorrection.record.baselineReadySha256 = 'a'.repeat(64)],
  ['baseline source/manifest changed', b => b.ready.units[0].manifestSha256 = 'a'.repeat(64)],
  ['baseline release changed', b => b.ready.deployedCommit = 'a'.repeat(40)],
  ['wrong reviewed CSV', b => b.hintCorrection.record.correctedCsvSha256 = 'a'.repeat(64)],
  ['wrong root acceptance', b => b.hintCorrection.record.rootAcceptanceSha256 = 'a'.repeat(64)],
  ['wrong independent review', b => b.hintCorrection.record.semanticReviewSha256 = 'a'.repeat(64)],
  ['wrong fresh before snapshot', b => b.hintCorrection.record.beforeSnapshotSha256 = 'a'.repeat(64)],
  ['private path in payload hash', b => b.hintCorrection.record.correctionPayloadSha256 = '/Users/private/receipt.json'],
  ['newline in hash', b => b.hintCorrection.record.correctionPayloadSha256 += '\n'],
  ['author reviewing themselves', b => b.hintCorrection.record.reviewerId = b.hintCorrection.record.authorId],
  ['readback different reviewer', b => b.hintCorrection.readback.reviewerId = 'other-reviewer'],
  ['readback different effective payload', b => b.hintCorrection.readback.effectivePayloadSha256 = 'a'.repeat(64)],
  ['substituted transaction hash in both record and rehashed readback', b => b.hintCorrection.record.correctionPayloadSha256 = b.hintCorrection.readback.correctionPayloadSha256 = 'a'.repeat(64)],
  ['substituted effective payload in both record and rehashed readback', b => b.hintCorrection.record.effectivePayloadSha256 = b.hintCorrection.readback.effectivePayloadSha256 = 'a'.repeat(64)],
  ['readback private local field', b => b.hintCorrection.readback.path = '/Users/private'],
  ['readback missing observation', b => delete b.hintCorrection.readback.observedAt],
  ['readback invalid date', b => b.hintCorrection.readback.observedAt = '2026-02-31T00:00:00.000Z'],
  ['readback older than before snapshot', b => b.hintCorrection.readback.observedAt = '2026-11-14T12:10:00.000Z'],
  ['future readback date', b => b.hintCorrection.readback.observedAt = new Date(Date.now() + 86_400_000).toISOString()],
  ['v1 public record', b => b.hintCorrection.record.schema = 'noam-first567-hint-correction/v1'],
  ['v1 public readback', b => b.hintCorrection.readback.schema = 'noam-first567-hint-correction-db-readback/v1'],
  ['full rows leaked into public record', b => b.hintCorrection.record.rows = hintCorrectionBuildScope().rows],
  ['missing scope digest', b => delete b.hintCorrection.record.rowScopeSha256],
  ['different public scope digest', b => b.hintCorrection.record.rowScopeSha256 = 'a'.repeat(64)],
  ['matching substituted public scope digests', b => b.hintCorrection.record.rowScopeSha256 = b.hintCorrection.readback.rowScopeSha256 = 'a'.repeat(64)],
  ['different public row count', b => b.hintCorrection.record.rowCount = 14],
  ['different public hint count', b => b.hintCorrection.record.hintCount = 44],
  ['different readback scope digest', b => b.hintCorrection.readback.rowScopeSha256 = 'a'.repeat(64)],
  ['different readback row count', b => b.hintCorrection.readback.rowCount = 16],
  ['changed preserved row digest', b => b.hintCorrection.readback.after.unchangedRowsSha256 = 'a'.repeat(64)],
  ['forged equal preserved digests', b => b.hintCorrection.readback.before.unchangedRowsSha256 = b.hintCorrection.readback.after.unchangedRowsSha256 = 'a'.repeat(64)],
  ['changed legacy digest', b => b.hintCorrection.readback.after.legacyRowsSha256 = 'a'.repeat(64)],
  ['changed learning digest', b => b.hintCorrection.readback.after.learningRowsSha256 = 'a'.repeat(64)],
  ['changed legacy count', b => b.hintCorrection.readback.counts.legacyRows--],
  ['changed learning count', b => b.hintCorrection.readback.counts.learningRows++],
  ['wrong hint count', b => b.hintCorrection.readback.counts.correctedHints--],
]) test('build and SSR reject ' + name, () => {
  const b = fixture(); mutate(b);
  // Rehash mutated receipts to test semantics, not merely transport integrity.
  if (b.hintCorrection?.record && b.hintCorrection?.readback)
    b.hintCorrection.record.readbackReceiptSha256 = hash(bytes(b.hintCorrection.readback));
  rejectedEverywhere(b);
});


// Full row proof is build-only. A substituted scope cannot pass SSR either,
// even after a caller recomputes both public hashes around its changed rows.
for (const [name, mutate] of [
  ['missing target', rows => rows.pop()],
  ['sixteenth target', rows => rows.push(clone(rows[0]))],
  ['duplicate target', rows => rows[1] = clone(rows[0])],
  ['different target order', rows => rows.reverse()],
  ['out of scope exercise', rows => rows[0].exerciseId = 'G9-T88-A-Q06ב'],
  ['out of scope edition', rows => rows[0].editionId = 'ms-20261113-par2-r1'],
  ['different canonical ID', rows => rows[0].canonicalItemId += '.other'],
  ['different source/PDF binding', rows => rows[0].sourceBindingSha256 = 'a'.repeat(64)],
  ['unreviewed new hint', rows => rows[0].afterHintSha256[1] = 'a'.repeat(64)],
  ['different original hint', rows => rows[0].beforeHintSha256[2] = 'a'.repeat(64)],
  ['only two new tiers', rows => rows[0].afterHintSha256.pop()],
  ['sparse tier array', rows => delete rows[0].afterHintSha256[1]],
  ['readback wrong hint', rows => rows[14].afterHintSha256[0] = 'a'.repeat(64)],
  ['readback missing target', rows => rows.pop()],
]) test('build and SSR reject repacked ' + name, () => {
  const b = fixture(), rows = hintCorrectionBuildScope().rows;
  mutate(rows); b.hintCorrectionRows = Buffer.from(JSON.stringify(rows));
  const forgedScope = hash(b.hintCorrectionRows);
  b.hintCorrection.record.rowScopeSha256 = forgedScope;
  b.hintCorrection.readback.rowScopeSha256 = forgedScope;
  b.hintCorrection.record.readbackReceiptSha256 = hash(bytes(b.hintCorrection.readback));
  rejectedEverywhere(b);
  assert.throws(() => validateHintCorrectionRows(b.hintCorrectionRows), /row proof hash|exact 15/);
});

test('full build requires hash-bound row proof, independent of unchanged public claims', () => {
  for (const mode of ['absent', 'changed', 'whitespace']) {
    const b = fixture();
    if (mode === 'absent') delete b.hintCorrectionRows;
    else if (mode === 'whitespace') b.hintCorrectionRows = Buffer.concat([b.hintCorrectionRows, Buffer.from(' ')]);
    else { const rows = hintCorrectionBuildScope().rows; rows[0].afterHintSha256[0] = 'a'.repeat(64); b.hintCorrectionRows = Buffer.from(JSON.stringify(rows)); }
    assert.throws(() => validateRamziActivation(registry, b), /row proof/);
    // SSR consumes the build-verified compact projection; raw proof is not in its API.
    assert.doesNotThrow(() => validateHintCorrection(b.ready, b.hintCorrection));
  }
});
test('orphan full proof is rejected and compact output contains no row identities', () => {
  const b = fixture();
  assert.equal(hash(b.hintCorrectionRows), hintCorrectionScope().rowScope.rowScopeSha256);
  assert.equal(validateHintCorrectionRows(b.hintCorrectionRows).length, 15);
  assert(!JSON.stringify(b.hintCorrection).includes('canonicalItemId'));
  const snapshot = mergeWorksheetEditions(catalog, registry, b.ready, b.hintCorrection);
  assert(!Object.hasOwn(snapshot, 'hintCorrectionRows'));
  delete b.hintCorrection;
  assert.throws(() => validateRamziActivation(registry, b), /orphan correction/);
});

test('SSR compares the entire baseline independently of object property order', () => {
  const b = fixture();
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])) : value;
  assert.deepEqual(validateHintCorrection(reorder(b.ready), b.hintCorrection), validateHintCorrection(b.ready, b.hintCorrection));
});

test('regeneration carries exact correction evidence into a snapshot accepted by SSR', () => {
  const b = fixture();
  const out = exportCatalog({ indexPath: path.join(root, 'index.html'), ramziActivation: b, dryRun: true });
  assert.equal(out.validation.ok, true);
  const snapshot = JSON.parse(out.text);
  assert.deepEqual(snapshot.ramziHintCorrection, b.hintCorrection);
  assert.deepEqual(mergeReviewedCatalog(snapshot, registry, snapshot.ramziActivation, snapshot.ramziHintCorrection, snapshot.reviewedRamziActivations, additional.trust), snapshot);
  assert.deepEqual(snapshot.grades.map(g => g.topics.map(t => t.levels)), catalog.grades.map(g => g.topics.map(t => t.levels)));
});

test('full build rejects a readback digest which does not match its bytes', () => {
  const b = fixture(); b.hintCorrection.record.readbackReceiptSha256 = 'a'.repeat(64);
  assert.throws(() => validateRamziActivation(registry, b), /readback content hash/);
});
test('loader hashes both original v1 bytes and new readback and refuses orphan evidence', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'noam-hint-correction-'));
  try {
    fs.mkdirSync(path.join(temp, 'ramzi-evidence')); const b = fixture();
    const correctionPath = path.join(temp, 'worksheet-ramzi-hint-correction.v2.json');
    fs.writeFileSync(correctionPath, bytes(b.hintCorrection.record));
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /correction without baseline/);
    fs.copyFileSync(path.join(catalogDir, 'worksheet-ramzi-ready.v1.json'), path.join(temp, 'worksheet-ramzi-ready.v1.json'));
    for (const [h, raw] of Object.entries(b.receipts)) fs.writeFileSync(path.join(temp, 'ramzi-evidence', h + '.json'), raw);
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /ENOENT/);
    const receipt = path.join(temp, 'ramzi-evidence', b.hintCorrection.record.readbackReceiptSha256 + '.json');
    fs.writeFileSync(receipt, bytes(b.hintCorrection.readback));
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /ENOENT/);
    const rowsPath = path.join(temp, 'ramzi-evidence', b.hintCorrection.record.rowScopeSha256 + '.json');
    fs.writeFileSync(rowsPath, b.hintCorrectionRows);
    assert.deepEqual(loadRamziActivationEvidence(temp, pub).hintCorrection, b.hintCorrection);
    assert.equal(validateRamziActivation(registry, loadRamziActivationEvidence(temp, pub)).size, 12);
    fs.appendFileSync(receipt, ' ');
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /correction readback hash mismatch/);
    fs.writeFileSync(receipt, bytes(b.hintCorrection.readback));
    fs.appendFileSync(rowsPath, ' ');
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /row proof hash/);
    fs.writeFileSync(rowsPath, b.hintCorrectionRows);
    fs.appendFileSync(path.join(temp, 'worksheet-ramzi-ready.v1.json'), ' ');
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /correction baseline bytes/);
  } finally { fs.rmSync(temp, { recursive: true }); }
});
