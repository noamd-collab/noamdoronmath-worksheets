// The GRW source bodies are real disabled artifacts. Every activation receipt
// in these tests is synthetic, in memory only, and never an import approval.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture, bytes, hash } = require('./fixtures/reviewed-ramzi-additional.cjs');
const { validateAdditionalEvidence } = require('../scripts/lib/reviewed-ramzi-activation-build.cjs');
const { mergeReviewedCatalog } = require('../scripts/lib/reviewed-ramzi-activation.mjs');
const { buildLearningCatalog } = require('../scripts/build-learning-catalog.cjs');
const { loadIndexCatalog } = require('../scripts/lib/headless-catalog.cjs');
const { loadRamziActivationEvidence } = require('../scripts/lib/worksheet-ramzi-activation.cjs');
const navigation = require('../noam-ai/site-companion/retrieve.js');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'headless/catalog/catalog.v1.json')));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'headless/catalog/worksheet-editions.v1.json')));
const old = loadRamziActivationEvidence(path.join(root, 'headless/catalog'), path.join(root, 'headless/astro-poc/public'));
const raw = loadIndexCatalog(path.join(root, 'index.html'));
const editionId = 'ms-20261115-grw-01-r1';
const grw = ['G7-T61', 7, 6, 'edition', 'grw'];
const make = () => fixture(registry, [grw]);
const build = b => validateAdditionalEvidence(catalog, registry, b);
const merge = b => mergeReviewedCatalog(catalog, registry, old.ready, old.hintCorrection, build(b), b.trust);
const originalTopic = catalog.grades.find(g => g.grade === 7).topics.find(t => t.id === 6);
const exactIds = ['A', 'B', 'E'].flatMap(level => Array.from({ length: 6 }, (_, q) =>
  ['א', 'ב', 'ג'].map(part => `G7-T61-${level}-Q${String(q + 1).padStart(2, '0')}${part}`)).flat());

function resignReceipt(b, field, mutate) {
  const request = b.requests.batches[0];
  const receipt = JSON.parse(b.receipts[request[field]]);
  mutate(receipt);
  const body = bytes(receipt);
  request[field] = hash(body);
  b.receipts[request[field]] = body;
  b.trust.scopes[0].activation = { readbackReceiptSha256: request.dbReadbackReceiptSha256,
    evidenceSha256: hash(JSON.stringify(request)) };
}

test('GRW uses all 54 real source identities and three exact published PDFs', () => {
  const b = make(), scope = JSON.parse(b.scopes[editionId]);
  assert.deepEqual(scope.items.map(i => i.exerciseId), exactIds);
  assert.equal(new Set(scope.items.map(i => i.canonicalItemId)).size, 54);
  assert.equal(scope.items.reduce((n, i) => n + i.hintSha256.length, 0), 162);
  assert.equal(scope.batch.units.reduce((n, u) => n + u.itemCount, 0), 54);
  const row = registry.editions.find(e => e.editionId === editionId);
  for (const unit of scope.batch.units) {
    const level = row.levels.find(l => l.key === unit.level);
    assert.equal(unit.pdfId, level.pdfId);
    assert.equal(unit.pdfSha256, level.pdfSha256);
    assert.equal(unit.sourceNativeExportSha256, level.nativeExportSha256);
  }
  assert.equal(build(b).batches.length, 1);
});

test('GRW generic activation appends three learning rows and preserves every previous row', () => {
  const b = make(), next = merge(b), topic = next.grades.find(g => g.grade === 7).topics.find(t => t.id === 6);
  assert.deepEqual(topic.levels, originalTopic.levels);
  assert.deepEqual(topic.routing, originalTopic.routing);
  assert.equal(topic.defaultEditionId, originalTopic.defaultEditionId);
  assert.deepEqual(topic.editions.filter(e => e.editionId !== editionId), originalTopic.editions.filter(e => e.editionId !== editionId));
  assert.deepEqual(next.ramziActivation, catalog.ramziActivation);
  assert.deepEqual(next.ramziHintCorrection, catalog.ramziHintCorrection);
  const before = buildLearningCatalog(raw, registry, old);
  const after = buildLearningCatalog(raw, registry, old, { trust: b.trust, bundle: b });
  assert.deepEqual(after.slice(0, before.length), before);
  assert.deepEqual(after.slice(before.length).map(r => r.id), ['a', 'b', 'c'].map(l => `g7-t6-${l}-e-${editionId}`));
  assert.equal(new Set(after.map(r => r.id)).size, after.length);
  assert.deepEqual(mergeReviewedCatalog(next, registry, old.ready, old.hintCorrection, undefined, b.trust), catalog);
});

test('one generic collection supports GRW alongside an edition and a PDF-only base topic', () => {
  const b = fixture(registry, [['G9-T93', 9, 47, 'base-topic', 'rat'], ['G7-T88', 7, 26, 'edition', 'frq'], grw]);
  assert.equal(build(b).batches.length, 3);
  assert.equal(b.trust.scopes.reduce((n, s) => n + s.batch.units.reduce((x, u) => x + u.itemCount, 0), 0), 162);
  const original = buildLearningCatalog(raw, registry, old);
  const next = buildLearningCatalog(raw, registry, old, { trust: b.trust, bundle: b });
  assert.deepEqual(next.slice(0, original.length), original);
  assert.equal(next.length, original.length + 9);
});

test('Noam AI discovers three GRW viewer links with correct native identity and site topic', () => {
  const b = make(), next = merge(b);
  const before = navigation.buildCatalogRecords(catalog);
  const after = navigation.buildCatalogRecords(next);
  const records = after.filter(r => r.editionId === editionId);
  assert.deepEqual(after.filter(r => r.editionId !== editionId), before);
  assert.equal(records.length, 3);
  for (const record of records) {
    const url = new URL(record.href, 'https://example.test');
    assert.equal(url.searchParams.get('edition'), editionId);
    assert.equal(url.searchParams.get('x'), 'G7-T61');
    assert.equal(url.searchParams.get('topic'), '6');
    assert.equal(url.searchParams.get('g'), '7');
    assert.equal(url.searchParams.get('lv'), record.levelKey);
    assert.equal(url.searchParams.get('pdf'), record.pdfId);
  }
  const hits = navigation.retrieveRecords(next, 'חזקות גדילה והקטנה רמזי חדש כיתה ז', 6);
  assert(hits.some(r => r.editionId === editionId));
});

for (const [name, mutate] of [
  ['missing GRW part', r => r.rows.pop()],
  ['wrong GRW canonical item', r => r.rows[0].canonicalItemId += '-wrong'],
  ['wrong GRW tier', r => r.rows[0].hintSha256[2] = '0'.repeat(64)],
  ['GRW review rows instead of verified readback', r => r.rows[0].status = 'review'],
]) test('GRW rejects ' + name, () => {
  const b = make(); resignReceipt(b, 'dbReadbackReceiptSha256', mutate);
  assert.throws(() => build(b));
});

test('GRW cannot gain drawing permission through a fully re-pinned profile', () => {
  const b = make(), request = b.requests.batches[0], trust = b.trust.scopes[0];
  const scope = JSON.parse(b.scopes[editionId]);
  const profile = JSON.parse(b.assets.learningScopes[editionId]);
  profile.drawingsAllowed = true;
  b.assets.learningScopes[editionId] = bytes(profile);
  scope.batch.learningScopeSha256 = hash(bytes(profile));
  b.scopes[editionId] = bytes(scope); request.scopeSha256 = hash(bytes(scope));
  trust.scopeSha256 = request.scopeSha256; trust.batch = structuredClone(scope.batch);
  for (const field of ['assetReceiptSha256', 'dbReadbackReceiptSha256', 'learningReceiptSha256', 'scopeEnforcementReceiptSha256']) {
    resignReceipt(b, field, receipt => {
      if (Object.hasOwn(receipt, 'scopeSha256')) receipt.scopeSha256 = request.scopeSha256;
      if (Object.hasOwn(receipt, 'learningScopeSha256')) receipt.learningScopeSha256 = scope.batch.learningScopeSha256;
    });
  }
  assert.throws(() => build(b), /drawing policy/);
});

test('committed GRW sources remain disabled and expose no activation receipts', () => {
  for (const level of registry.editions.find(e => e.editionId === editionId).levels) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, `headless/astro-poc/public/noam-ai/manifests/${level.pdfId}.json`)));
    assert.equal(manifest.publishable, false);
    assert.equal(manifest.reviewRequired, true);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'headless/catalog/ramzi-additional-trust.v1.json'))), { version: 1, scopes: [] });
  assert.equal(fs.existsSync(path.join(root, 'headless/catalog/ramzi-additional-requests.v1.json')), false);
  assert.equal(originalTopic.editions.find(e => e.editionId === editionId).routing.usesViewer, false);
});
