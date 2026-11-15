'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), catalogDir = path.join(root, 'headless/catalog'), pub = path.join(root, 'headless/astro-poc/public');
const { loadRamziActivationEvidence, validateRamziActivation } = require('../scripts/lib/worksheet-ramzi-activation.cjs');
const { mergeWorksheetEditions } = require('../scripts/lib/worksheet-editions.cjs');
const { validateHintCorrection, hintCorrectionScope } = require('../scripts/lib/worksheet-hint-correction.mjs');
const { exportCatalog, loadIndexCatalog } = require('../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../scripts/build-learning-catalog.cjs');
const registry = JSON.parse(fs.readFileSync(path.join(catalogDir, 'worksheet-editions.v1.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(catalogDir, 'catalog.v1.json')));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = value => JSON.stringify(value, null, 2) + '\n';
const clone = value => JSON.parse(JSON.stringify(value));
function baseline() { return loadRamziActivationEvidence(catalogDir, pub); }
// Synthetic transaction/readback only, constructed in memory or a temp directory.
// The private proposal hashes are real pinned proposals, not executed transactions.
// This fixture never creates an applied correction file in the production catalog.
function fixture() {
  const b = baseline(), scope = hintCorrectionScope();
  const pins = { ...scope.pins }; delete pins.baselineReadyObjectSha256;
  const common = { ...pins, ...scope.payloads, authorId: 'antigravity-flash', reviewerId: 'codex-root' };
  const readback = { schema: 'noam-first567-hint-correction-db-readback/v1', status: 'verified_exact_readback', ...common,
    sourceReceiptSha256: hash('synthetic actual-readback-shaped test receipt only'), observedAt: '2026-11-15T12:10:00.000Z',
    counts: { correctedRows: 15, correctedHints: 45, first567Rows: 567, unchangedRows: 552, legacyRows: 31761, learningRows: 968 },
    before: clone(scope.preserved), after: clone(scope.preserved), rows: clone(scope.rows) };
  const record = { schema: 'noam-first567-hint-correction/v1', status: 'applied_verified', ...common,
    readbackReceiptSha256: hash(bytes(readback)), rows: clone(scope.rows) };
  b.hintCorrection = { record, readback }; return b;
}
function rejectedEverywhere(b) {
  assert.throws(() => validateRamziActivation(registry, b), /Hint correction|Ramzi activation/);
  assert.throws(() => mergeWorksheetEditions(catalog, registry, b.ready, b.hintCorrection), /Hint correction|Ramzi readiness/);
}

test('absent correction preserves baseline evidence, catalog bytes and all learning rows', () => {
  const b = baseline(); assert(!Object.hasOwn(b, 'hintCorrection'));
  assert.equal(validateHintCorrection(b.ready, undefined), undefined);
  assert.deepEqual(mergeWorksheetEditions(catalog, registry, b.ready), catalog);
  assert.equal(exportCatalog({ indexPath: path.join(root, 'index.html') }).text,
    fs.readFileSync(path.join(catalogDir, 'catalog.v1.json'), 'utf8'));
  const learning = buildLearningCatalog(loadIndexCatalog(path.join(root, 'index.html')), registry, b);
  assert.equal('/* Generated from index.html; do not edit by hand. */\nwindow.NOAM_LEARNING_CATALOG=' + JSON.stringify(learning) + ';\n',
    fs.readFileSync(path.join(root, 'noam-learning-catalog.js'), 'utf8'));
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
  ['missing target', b => b.hintCorrection.record.rows.pop()],
  ['sixteenth target', b => b.hintCorrection.record.rows.push(clone(b.hintCorrection.record.rows[0]))],
  ['duplicate target', b => b.hintCorrection.record.rows[1] = clone(b.hintCorrection.record.rows[0])],
  ['different target order', b => b.hintCorrection.record.rows.reverse()],
  ['out of scope exercise', b => b.hintCorrection.record.rows[0].exerciseId = 'G9-T88-A-Q06ב'],
  ['out of scope edition', b => b.hintCorrection.record.rows[0].editionId = 'ms-20261113-par2-r1'],
  ['different canonical ID', b => b.hintCorrection.record.rows[0].canonicalItemId += '.other'],
  ['different source/PDF binding', b => b.hintCorrection.record.rows[0].sourceBindingSha256 = 'a'.repeat(64)],
  ['unreviewed new hint', b => b.hintCorrection.record.rows[0].afterHintSha256[1] = 'a'.repeat(64)],
  ['different original hint', b => b.hintCorrection.record.rows[0].beforeHintSha256[2] = 'a'.repeat(64)],
  ['only two new tiers', b => b.hintCorrection.record.rows[0].afterHintSha256.pop()],
  ['sparse tier array', b => delete b.hintCorrection.record.rows[0].afterHintSha256[1]],
  ['readback wrong hint', b => b.hintCorrection.readback.rows[14].afterHintSha256[0] = 'a'.repeat(64)],
  ['readback missing target', b => b.hintCorrection.readback.rows.pop()],
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
  assert.deepEqual(mergeWorksheetEditions(snapshot, registry, snapshot.ramziActivation, snapshot.ramziHintCorrection), snapshot);
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
    const correctionPath = path.join(temp, 'worksheet-ramzi-hint-correction.v1.json');
    fs.writeFileSync(correctionPath, bytes(b.hintCorrection.record));
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /correction without baseline/);
    fs.copyFileSync(path.join(catalogDir, 'worksheet-ramzi-ready.v1.json'), path.join(temp, 'worksheet-ramzi-ready.v1.json'));
    for (const [h, raw] of Object.entries(b.receipts)) fs.writeFileSync(path.join(temp, 'ramzi-evidence', h + '.json'), raw);
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /ENOENT/);
    const receipt = path.join(temp, 'ramzi-evidence', b.hintCorrection.record.readbackReceiptSha256 + '.json');
    fs.writeFileSync(receipt, bytes(b.hintCorrection.readback));
    assert.deepEqual(loadRamziActivationEvidence(temp, pub).hintCorrection, b.hintCorrection);
    assert.equal(validateRamziActivation(registry, loadRamziActivationEvidence(temp, pub)).size, 12);
    fs.appendFileSync(receipt, ' ');
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /correction readback hash mismatch/);
    fs.writeFileSync(receipt, bytes(b.hintCorrection.readback));
    fs.appendFileSync(path.join(temp, 'worksheet-ramzi-ready.v1.json'), ' ');
    assert.throws(() => loadRamziActivationEvidence(temp, pub), /correction baseline bytes/);
  } finally { fs.rmSync(temp, { recursive: true }); }
});
