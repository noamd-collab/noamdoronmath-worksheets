import baselineReady from '../../headless/catalog/worksheet-ramzi-ready.v1.json' with { type: 'json' };
// Approved correction scope only; no applied correction or database receipt.
// Hint hashes are SHA-256 of each exact UTF-8 cell. Source binding hashes use
// JSON.stringify of SOURCE_BINDING_FIELDS values in their declared order.
const PINS = {
  "beforeSnapshotSha256": "54e03d2cced524d1fc50126c624dcc395239541bb5d1a1eeae589aaa06e53ab1",
  "baselineReadySha256": "bb9561f9b878f7ddf8c95b64785ba0a2426e53aba531f519b75b2c2809aafc5d",
  "baselineReadyObjectSha256": "9ac0d7e9d7eade6f465f4a07831a602ebb02067837a43500a113e2003533e08b",
  "baselinePayloadSha256": "18556e703b4af97a75e5f27eab32336b6e55290fb0ae8077fd0e2b2a89ff3b22",
  "baselineDbReadbackReceiptSha256": "bd2f58db3ad0afd5a29291d7a74cc27597be84b403f9183c60202c5b577aff85",
  "correctedCsvSha256": "161a1f971deb0b6a75697d1a9abb4f4f0145c36cd0ecb1cdc272a3ba231363ca",
  "semanticReviewSha256": "d4d24d5b351acaac3107cdfd2371823e4134542ab60cf482a37769e7d50ccde1",
  "rootAcceptanceSha256": "e2f3b99244496aaea513bf558d9d3763e6ced5f335daaabf90c1a670818a78a2"
};
// SHA-256 of UTF-8 JSON.stringify of the exact ordered build-only row array.
const ROW_SCOPE = Object.freeze({ rowScopeSha256: 'c0374126e3b7b1cfb086ee84e38536dc9c0e3928b733c37dc3b1961c6b23b47f', rowCount: 15, hintCount: 45 });

const SHA = /^[0-9a-f]{64}$(?![\s\S])/;
const PIN_FIELDS = Object.keys(PINS).filter(k => k !== 'baselineReadyObjectSha256');
const REVIEWED_PAYLOADS = {
  correctionPayloadSha256: '50d3a0133e94938c5b055d85fd3787fb26ca5b927c10f4a80b5f25a80167591b',
  effectivePayloadSha256: '1a90e0be1dc8dced441ff37415de84ebab7f72c964cd633fb4d937ffccfbefee',
};
const CHANGE_FIELDS = Object.keys(REVIEWED_PAYLOADS);
const PRESERVED = {
  "unchangedRowsSha256": "34f250ecbdbf10bea05394cba79780dd1f83456ddbc695dd743f10e4e5c9f61b",
  "legacyRowsSha256": "37dbedff9816a741081f34585f9d99f2502a836ba51fc6580578b5423a8e4f8e",
  "learningRowsSha256": "0a075a04d8acbf67e7b2d26c9ad5d71089939bc98ef19f545b16ae2d32d79d41"
};
const DIGEST_FIELDS = ['unchangedRowsSha256', 'legacyRowsSha256', 'learningRowsSha256'];
function must(ok, why) { if (!ok) throw Error('Hint correction: ' + why); }
function exact(value, fields, label) {
  must(value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.keys(value).length === fields.length && fields.every(f => Object.hasOwn(value, f)), label + ' fields');
}
function hash(value, label) { must(typeof value === 'string' && SHA.test(value), label + ' hash'); }
function sameStructure(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && a.length !== b.length) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && sameStructure(a[k], b[k]));
}
function same(a, b, fields, label) { for (const f of fields) must(a[f] === b[f], label + ' ' + f); }
function rowScope(value, label) { same(value, ROW_SCOPE, Object.keys(ROW_SCOPE), label + ' fixed row scope'); }
function pinned(value, label) { same(value, PINS, PIN_FIELDS, label + ' approval/baseline'); }

/** Copies for build validation/tests; these contain hashes and identities, never hints. */
export function hintCorrectionScope() { return JSON.parse(JSON.stringify({ pins: PINS, rowScope: ROW_SCOPE, preserved: PRESERVED, payloads: REVIEWED_PAYLOADS })); }

/** Shared, IO-free build/SSR contract. The clock only rejects future observations.
 * Raw evidence bytes are additionally hashed by the loader and build gate. */
export function validateHintCorrection(ready, bundle) {
  if (bundle === undefined) return undefined;
  must(ready && ready.schema === 'noam-first567-activation-ready/v1', 'baseline readiness required');
  must(sameStructure(ready, baselineReady), 'entire historical baseline changed');
  must(ready.payloadSha256 === PINS.baselinePayloadSha256 &&
    ready.verifiedDbReadbackReceiptSha256 === PINS.baselineDbReadbackReceiptSha256, 'historical baseline changed');
  exact(bundle, ['record', 'readback'], 'bundle');
  const c = bundle.record, r = bundle.readback;
  exact(c, ['schema', 'status', ...PIN_FIELDS, ...CHANGE_FIELDS, 'readbackReceiptSha256', 'authorId', 'reviewerId', ...Object.keys(ROW_SCOPE)], 'record');
  must(c.schema === 'noam-first567-hint-correction/v2' && c.status === 'applied_verified', 'applied correction required');
  pinned(c, 'record');
  same(c, REVIEWED_PAYLOADS, CHANGE_FIELDS, 'reviewed immutable payload');
  for (const f of [...CHANGE_FIELDS, 'readbackReceiptSha256']) hash(c[f], f);
  must(c.effectivePayloadSha256 !== PINS.baselinePayloadSha256, 'effective payload must change');
  must(c.authorId === 'antigravity-flash' && c.reviewerId === 'codex-root' &&
    c.authorId.toLowerCase() !== c.reviewerId.toLowerCase(), 'independent author/reviewer required');
  rowScope(c, 'record');
  exact(r, ['schema', 'status', ...PIN_FIELDS, ...CHANGE_FIELDS, 'sourceReceiptSha256', 'observedAt',
    'authorId', 'reviewerId', 'counts', 'before', 'after', ...Object.keys(ROW_SCOPE)], 'readback');
  must(r.schema === 'noam-first567-hint-correction-db-readback/v2' &&
    r.status === 'verified_exact_readback', 'actual verified readback required');
  pinned(r, 'readback'); same(r, c, [...CHANGE_FIELDS, 'authorId', 'reviewerId'], 'readback correction');
  hash(r.sourceReceiptSha256, 'private source readback');
  must(typeof r.observedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.observedAt) &&
    Number.isFinite(Date.parse(r.observedAt)) && new Date(r.observedAt).toISOString() === r.observedAt &&
    Date.parse(r.observedAt) >= Date.parse("2026-11-15T12:02:43.60833+00:00") &&
    Date.parse(r.observedAt) <= Date.now() + 60_000, 'readback observation time');
  const counts = { correctedRows: 15, correctedHints: 45, first567Rows: 567, unchangedRows: 552, legacyRows: 31761, learningRows: 968 };
  exact(r.counts, Object.keys(counts), 'readback counts'); same(r.counts, counts, Object.keys(counts), 'readback count');
  exact(r.before, DIGEST_FIELDS, 'before preservation'); exact(r.after, DIGEST_FIELDS, 'after preservation');
  for (const f of DIGEST_FIELDS) {
    must(r.before[f] === PRESERVED[f] && r.before[f] === r.after[f], 'preservation ' + f);
  }
  rowScope(r, 'readback');
  return { payloadSha256: c.effectivePayloadSha256, verifiedDbReadbackReceiptSha256: c.readbackReceiptSha256 };
}
