#!/usr/bin/env node
// Deterministic builder for the additional reviewed Ramzi activation artifacts.
//
// It never queries or writes a database. Every public hash is computed from real
// bytes: staged manifests and native exports in this checkout, the reviewed
// learning-scope profiles inside the published server commit, downloaded CDN PDFs,
// and private review/import/readback artifacts named in a private sources file.
// Hint, answer and solution text is read only to hash it; it is never written.
//
// Usage (the sources file and every path inside it stay private):
//   node scripts/build-ramzi-additional-evidence.mjs --sources <private-sources.json> [--check]
//
// --check verifies the committed artifacts byte-for-byte without writing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { loadAdditionalEvidence } = require('./lib/reviewed-ramzi-activation-build.cjs');
const { exportCatalog } = require('./lib/headless-catalog.cjs');

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytesOf = value => JSON.stringify(value, null, 2) + '\n';
const SHA = /^[0-9a-f]{64}$/;
function must(ok, why) { if (!ok) throw Error('Ramzi additional evidence: ' + why); }

// Public scope list. Grade/topic of editions come from the registry; the RAT
// base topic is fixed here and checked against its manifests and server pins.
const SCOPES = [
  { scopeId: 'ms-20261115-rat-01-r1', targetKind: 'base-topic', grade: 9, topicId: 47, nativePrefix: 'G9-T93', set: 'ratfrq' },
  { scopeId: 'ms-20261115-frq-01-r1', targetKind: 'edition', nativePrefix: 'G7-T88', set: 'ratfrq' },
  { scopeId: 'ms-20261115-sgn-01-r1', targetKind: 'edition', nativePrefix: 'G7-T91', set: 'next958' },
  { scopeId: 'ms-20261115-alg-01-r1', targetKind: 'edition', nativePrefix: 'G7-T87', set: 'next958' },
  { scopeId: 'ms-20261115-eqn-01-r1', targetKind: 'edition', nativePrefix: 'G7-T90', set: 'next958' },
  { scopeId: 'ms-20261115-prb-01-r1', targetKind: 'edition', nativePrefix: 'G7-T89', set: 'next958' },
  { scopeId: 'ms-20261115-grw-01-r1', targetKind: 'edition', nativePrefix: 'G7-T61', set: 'next958' },
  { scopeId: 'ms-20261115-ext-01-r1', targetKind: 'edition', nativePrefix: 'G9-T70', set: 'next958' },
  { scopeId: 'ms-20261115-sml-01-r1', targetKind: 'edition', nativePrefix: 'G9-T71', set: 'next958' },
  { scopeId: 'ms-20261115-afr-01-r1', targetKind: 'edition', nativePrefix: 'G9-T72', set: 'next958' },
  { scopeId: 'ms-20261115-fac-01-r1', targetKind: 'edition', nativePrefix: 'G9-T87', set: 'next958' },
  { scopeId: 'ms-20261113-par-02-r1', targetKind: 'edition', nativePrefix: 'G9-T88', set: 'next958' },
  { scopeId: 'ms-20261113-par-03-r1', targetKind: 'edition', nativePrefix: 'G9-T89', set: 'next958' },
  { scopeId: 'ms-20261113-par-04-r1', targetKind: 'edition', nativePrefix: 'G9-T90', set: 'next958' },
];
const LEVELS = ['a', 'b', 'c'];
const LEVEL_CODE = { a: 'A', b: 'B', c: 'E' };
const FLAGS = ['publishable', 'reviewRequired', 'nativeExportPublished'];

const catalogDir = path.join(root, 'headless/catalog');
const publicDir = path.join(root, 'headless/astro-poc/public');
const evidenceDir = path.join(catalogDir, 'ramzi-additional-evidence');

function args() {
  const out = { check: false, sources: undefined };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') out.check = true;
    else if (argv[i] === '--sources') out.sources = argv[++i];
    else throw Error('Unknown argument ' + argv[i]);
  }
  must(out.sources, '--sources <private-sources.json> is required');
  return out;
}
function readPrivate(file, label) {
  must(typeof file === 'string' && path.isAbsolute(file), label + ' must be an absolute private path');
  must(!path.resolve(file).startsWith(root + path.sep), label + ' must stay outside the public checkout');
  return fs.readFileSync(file);
}
function contains(bytes, hex) { return Buffer.from(bytes).toString('utf8').includes(hex); }
function strings(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach(v => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => strings(v, out));
  else if (typeof value === 'string') out.add(value);
  return out;
}
const byBytes = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

/** The disabled staged manifest. Re-runs reconstruct it from the final bytes: the
 * three flags are the only edits, and an absent nativeExportPublished was appended. */
function stagedManifest(raw) {
  const m = JSON.parse(raw);
  if (m.publishable === false) {
    must(m.reviewRequired === true && (m.nativeExportPublished === false || !Object.hasOwn(m, 'nativeExportPublished')), 'staged manifest is not disabled');
    must(raw.toString('utf8') === bytesOf(m), 'staged manifest is not canonical JSON');
    return m;
  }
  must(m.publishable === true && m.reviewRequired === false && m.nativeExportPublished === true, 'manifest is neither staged nor final');
  const keys = Object.keys(m);
  const staged = { ...m, publishable: false, reviewRequired: true };
  if (keys.at(-1) === 'nativeExportPublished') delete staged.nativeExportPublished; else staged.nativeExportPublished = false;
  must(bytesOf(finalManifest(staged)) === raw.toString('utf8'), 'final manifest differs from its staged source beyond the three flags');
  return staged;
}
function finalManifest(staged) {
  const m = structuredClone(staged);
  m.publishable = true; m.reviewRequired = false; m.nativeExportPublished = true;
  return m;
}

function serverPins(cfg) {
  const { repo, commit, file } = cfg;
  must(/^[0-9a-f]{40}$/.test(commit) && typeof file === 'string', 'server commit pin');
  const raw = execFileSync('git', ['-C', repo, 'show', `${commit}:${file}`], { maxBuffer: 64 << 20 });
  const text = raw.toString('utf8');
  const slice = (start, end) => {
    const a = text.indexOf(start), b = text.indexOf(end, a);
    must(a >= 0 && b > a, 'server source shape');
    return JSON.parse(text.slice(a + start.length, b).trim().replace(/;$/, ''));
  };
  return { sha256: sha(raw), profiles: slice('const PROFILES = ', '\nconst SOURCES = '), sources: slice('const SOURCES = ', '\nfunction record(') };
}

function build(sourcesFile) {
  const cfg = JSON.parse(readPrivate(sourcesFile, 'sources file'));
  const registry = JSON.parse(fs.readFileSync(path.join(catalogDir, 'worksheet-editions.v1.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(catalogDir, 'catalog.v1.json'), 'utf8'));
  const server = serverPins(cfg.serverScope);

  // Fresh read-only observations, recorded privately at query time.
  const freshHintsRaw = readPrivate(cfg.fresh.hints, 'fresh hint readback');
  const freshPinsRaw = readPrivate(cfg.fresh.reviewPins, 'fresh review pins');
  const freshLearningRaw = readPrivate(cfg.fresh.learning, 'fresh learning readback');
  const freshHints = new Map(JSON.parse(freshHintsRaw).hintRows.map(r => [r.edition_id, r]));
  const freshPins = new Map(JSON.parse(freshPinsRaw).rows.map(r => [r.edition_id, r]));
  const freshLearning = JSON.parse(freshLearningRaw).result;
  const learningPresent = new Set(freshLearning.present);
  const learningReceiptSource = sha(freshLearningRaw);

  // Private import sets: verified payload, postcommit readback, Root acceptance.
  const sets = {};
  for (const [name, set] of Object.entries(cfg.sets)) {
    const payload = readPrivate(set.payload, name + ' payload');
    const readback = readPrivate(set.postcommitReadback, name + ' postcommit readback');
    const acceptance = readPrivate(set.rootAcceptance, name + ' Root acceptance');
    const parsed = JSON.parse(readback);
    must(parsed.commitConfirmedByRoot === true && parsed.payloadSha256 === sha(payload), name + ' readback must confirm the exact verified payload');
    const out = { payloadSha256: sha(payload), readbackSha256: sha(readback), rootAcceptanceSha256: sha(acceptance), acceptance, rows: new Map() };
    for (const row of parsed.insertedHintRows) { const list = out.rows.get(row.edition_id) || []; list.push(row); out.rows.set(row.edition_id, list); }
    if (set.rootAcceptanceContract) {
      const contract = readPrivate(set.rootAcceptanceContract, name + ' Root accepted contract');
      must(JSON.parse(acceptance).contractSha256 === sha(contract), name + ' Root acceptance must pin the contract');
      out.contract = contract;
    }
    if (set.reviewReference) {
      const reference = readPrivate(set.reviewReference, name + ' review reference');
      out.reviewReference = reference; out.reviewReferenceSha256 = sha(reference);
    }
    sets[name] = out;
  }

  const files = new Map(); // relative public path -> bytes
  const put = (rel, text) => { must(!files.has(rel), 'duplicate output ' + rel); files.set(rel, Buffer.from(text, 'utf8')); };
  const trust = { version: 1, scopes: [] }, requests = { schema: 'noam-reviewed-additional-requests/v1', batches: [] };

  for (const def of SCOPES) {
    const { scopeId, targetKind, nativePrefix } = def;
    const set = sets[def.set];
    const scopeCfg = cfg.scopes[scopeId];
    must(set && scopeCfg, 'missing private sources for ' + scopeId);
    const row = registry.editions.find(e => e.editionId === scopeId);
    const grade = targetKind === 'edition' ? row?.grade : def.grade, topicId = targetKind === 'edition' ? row?.topicId : def.topicId;
    const topic = catalog.grades.find(g => g.grade === grade)?.topics.find(t => t.id === topicId);
    must(topic, 'topic for ' + scopeId);
    if (targetKind === 'edition') must(row && row.nativePrefix === nativePrefix && row.status === 'published' && row.publicationMode === 'pdf-only', 'registry edition ' + scopeId);
    else must(!row && topic.publicationMode === 'pdf-only' && !topic.routing.usesViewer, 'PDF-only base topic ' + scopeId);
    const label = targetKind === 'edition' ? row.label : topic.title;

    // Learning scope: byte-identical to the profile the published server pins.
    const pinned = server.profiles[scopeId];
    must(pinned && SHA.test(pinned.sha256), 'server profile ' + scopeId);
    const profileText = bytesOf(pinned.profile);
    must(sha(profileText) === pinned.sha256 && pinned.profile.scopeId === scopeId, 'server profile bytes ' + scopeId);
    put(`headless/astro-poc/public/noam-ai/learning-scopes/${scopeId}.json`, profileText);
    const learningScopeSha256 = pinned.sha256;

    // Units, final manifests and items.
    const readbackRows = new Map((set.rows.get(scopeId) || []).map(r => [r.exercise_id, r]));
    const units = [], items = [], pdfs = [];
    const levels = targetKind === 'edition' ? row.levels : topic.levels;
    for (const level of LEVELS) {
      const lv = levels.find(l => l.key === level);
      must(lv, `${scopeId} level ${level}`);
      const manifestRel = `headless/astro-poc/public/noam-ai/manifests/${lv.pdfId}.json`;
      const staged = stagedManifest(fs.readFileSync(path.join(root, manifestRel)));
      if (cfg.stagedRev) {
        const git = execFileSync('git', ['-C', root, 'show', `${cfg.stagedRev}:${manifestRel}`]);
        must(git.toString('utf8') === bytesOf(staged), 'staged manifest differs from ' + cfg.stagedRev + ' for ' + lv.pdfId);
      }
      const finalText = bytesOf(finalManifest(staged));
      put(manifestRel, finalText);
      const nativeRaw = fs.readFileSync(path.join(publicDir, 'noam-ai/native', nativePrefix, level, 'noam-ai.json'));
      const native = JSON.parse(nativeRaw);
      const source = server.sources.find(s => s.editionId === scopeId && s.level === level);
      must(source, `server source pin ${scopeId}/${level}`);
      const pdf = readPrivate(path.join(cfg.cdnPdfDir, lv.pdfId + '.pdf'), 'CDN PDF');
      must(staged.pdfHash === lv.pdfId && staged.editionId === scopeId && staged.prefix === nativePrefix && staged.level === level
        && staged.levelCode === LEVEL_CODE[level] && staged.grade === grade && staged.topicId === topicId, `manifest identity ${scopeId}/${level}`);
      must(sha(nativeRaw) === staged.nativeExportSha256 && native.package === nativePrefix && native.level === level, `native bytes ${scopeId}/${level}`);
      must(source.pdfId === lv.pdfId && source.pdfSha256 === staged.sourceSha256 && source.canonicalSourceSha256 === staged.canonicalSourceSha256
        && source.sourceNativeExportSha256 === staged.nativeExportSha256 && source.nativePackage === nativePrefix, `server source binding ${scopeId}/${level}`);
      must(JSON.stringify(source.items.map(i => i[0])) === JSON.stringify(staged.exercises.map(e => e.id)), `server item list ${scopeId}/${level}`);
      must(sha(pdf) === staged.sourceSha256, `downloaded CDN PDF bytes ${scopeId}/${level}`);
      let worksheetId, revision;
      if (targetKind === 'edition') {
        must(lv.pdfSha256 === staged.sourceSha256 && lv.nativeExportSha256 === staged.sourceNativeExportSha256, `registry PDF/native ${scopeId}/${level}`);
        worksheetId = lv.worksheetId; revision = lv.revision;
      } else { worksheetId = source.canonicalWorksheetId; revision = 1; }
      must(staged.exercises.every(e => e.canonicalItemId.split('.question.')[0] === worksheetId) && source.canonicalWorksheetId === worksheetId, `worksheet identity ${scopeId}/${level}`);
      for (const e of staged.exercises) {
        const r = readbackRows.get(e.id);
        must(r, 'verified readback row for ' + e.id);
        const item = { editionId: scopeId, exerciseId: e.id, pdfId: lv.pdfId, pdfSha256: staged.sourceSha256, canonicalSourceSha256: staged.canonicalSourceSha256,
          canonicalQuestionSha256: e.canonicalQuestionSha256, canonicalItemId: e.canonicalItemId, sourceExerciseSha256: e.sourceExerciseSha256,
          hintSha256: [r.hint_1, r.hint_2, r.hint_3].map(t => { must(typeof t === 'string' && t.trim(), 'hint tier text ' + e.id); return sha(Buffer.from(t, 'utf8')); }) };
        must(r.status === 'verified' && r.edition_id === scopeId && r.source_pdf_hash === item.pdfId && r.source_pdf_sha256 === item.pdfSha256
          && r.canonical_source_sha256 === item.canonicalSourceSha256 && r.canonical_question_sha256 === item.canonicalQuestionSha256
          && r.canonical_item_id === item.canonicalItemId && r.source_exercise_sha256 === item.sourceExerciseSha256, 'readback binding ' + e.id);
        items.push(item);
      }
      units.push({ level, worksheetId, revision, pdfId: lv.pdfId, pdfSha256: staged.sourceSha256, sourceNativeExportSha256: staged.sourceNativeExportSha256,
        nativeExportSha256: staged.nativeExportSha256, canonicalSourceSha256: staged.canonicalSourceSha256, manifestSha256: sha(finalText),
        itemCount: staged.exercises.length, hintCount: staged.exercises.length * 3 });
      pdfs.push({ pdfId: lv.pdfId, pdfSha256: sha(pdf) });
    }
    must(readbackRows.size === items.length, 'readback rows must equal manifest items for ' + scopeId);

    // Fresh database state must equal the readback rows on every compared field.
    const fresh = freshHints.get(scopeId), pins = freshPins.get(scopeId);
    must(fresh && fresh.n === items.length && fresh.verified === items.length && fresh.author_ids.length === 1 && fresh.reviewer_ids.length === 1, 'fresh DB count/status ' + scopeId);
    const line = i => [i.editionId, i.exerciseId, i.pdfId, i.pdfSha256, i.canonicalSourceSha256, i.canonicalQuestionSha256, i.canonicalItemId, i.sourceExerciseSha256, ...i.hintSha256, 'verified'].join('|');
    must(sha(Buffer.from(items.slice().sort((a, b) => byBytes(a.exerciseId, b.exerciseId)).map(line).join('\n'), 'utf8')) === fresh.rows_digest, 'fresh DB rows digest ' + scopeId);
    const authorId = fresh.author_ids[0], reviewerId = fresh.reviewer_ids[0];
    // PostgreSQL ->> returns a JSON object identity as its jsonb text; compare structurally.
    const sameIdentity = (value, text) => typeof value === 'string' ? value === text : JSON.stringify(value) === JSON.stringify(JSON.parse(text));
    must([...readbackRows.values()].every(r => sameIdentity(r.review_reference?.authorId, authorId) && sameIdentity(r.review_reference?.reviewerId, reviewerId)), 'review identities ' + scopeId);
    must(pins && pins.distinct_pins === 1 && pins.n === items.length, 'fresh review pins ' + scopeId);

    // Review chain: independent hint review, Root acceptance, reviewed hint bundle.
    const review = readPrivate(scopeCfg.independentReview, 'independent review'), bundle = readPrivate(scopeCfg.hintsBundle, 'hint bundle');
    const independentReviewSha256 = sha(review), hintsBundleSha256 = sha(bundle);
    if (def.set === 'next958') {
      must(pins.existing_content_review_sha256 === independentReviewSha256 && pins.source_hint_artifact_sha256 === hintsBundleSha256, 'DB-pinned review/bundle ' + scopeId);
      must(contains(set.acceptance, pins.independent_binding_review_sha256), 'Root acceptance pins the binding review ' + scopeId);
      must(contains(set.contract, independentReviewSha256) && contains(set.contract, hintsBundleSha256), 'Root accepted contract pins review/bundle ' + scopeId);
    } else {
      must(pins.verified_preparation_decision_sha256 === set.rootAcceptanceSha256 && pins.review_reference_sha256 === set.reviewReferenceSha256, 'DB-pinned Root decision ' + scopeId);
      must(JSON.parse(set.reviewReference).independentDeltaReviewSha256.includes(independentReviewSha256) && contains(set.acceptance, independentReviewSha256), 'Root decision pins review ' + scopeId);
      must(contains(review, hintsBundleSha256.slice(0, 8)), 'independent review names its hint bundle ' + scopeId);
    }
    const bundleStrings = strings(JSON.parse(bundle));
    must([...readbackRows.values()].every(r => [r.hint_1, r.hint_2, r.hint_3].every(t => bundleStrings.has(t))), 'every verified hint is in the reviewed bundle ' + scopeId);
    const worksheetIds = LEVELS.map(l => `g${grade}-t${topicId}-${l}-e-${scopeId}`);
    must(worksheetIds.every(id => learningPresent.has(id)), 'fresh learning IDs ' + scopeId);

    const batch = { targetKind, grade, topicId, editionId: scopeId, nativePrefix, label, learningScopeSha256,
      learningScopeUrl: `/noam-ai/learning-scopes/${scopeId}.json`, payloadSha256: set.payloadSha256, units };
    const scope = { schema: 'noam-reviewed-additional-scope/v1', batch, items, rootAcceptanceSha256: set.rootAcceptanceSha256,
      independentReviewSha256, authorId, reviewerId, hintsBundleSha256 };
    const scopeText = bytesOf(scope), scopeSha256 = sha(scopeText);
    put(`headless/catalog/ramzi-additional-evidence/${scopeSha256}.json`, scopeText);
    const receipts = {
      assetReceiptSha256: { schema: 'noam-reviewed-additional-assets/v1', status: 'reviewed_local_final_assets_with_verified_cdn_pdfs', scopeId, scopeSha256,
        pdfs, localManifestHashes: units.map(u => u.manifestSha256), localNativeHashes: units.map(u => u.nativeExportSha256), learningScopeSha256 },
      dbReadbackReceiptSha256: { schema: 'noam-reviewed-additional-db-readback/v1', status: 'verified_exact_readback', scopeId, scopeSha256,
        payloadSha256: set.payloadSha256, sourceReceiptSha256: set.readbackSha256, observedAt: fresh.observed_at, authorId, reviewerId,
        rows: items.map(i => ({ ...i, status: 'verified' })) },
      learningReceiptSha256: { schema: 'noam-reviewed-additional-learning-readback/v1', status: 'verified_exact_readback', scopeId, worksheetIds,
        sourceReceiptSha256: learningReceiptSource },
      scopeEnforcementReceiptSha256: { schema: 'noam-reviewed-additional-scope-enforcement/v1', status: 'verified_server_scope_and_drawing_policy', scopeId,
        learningScopeSha256, sourceReceiptSha256: server.sha256 },
    };
    const request = { scopeId, scopeSha256 };
    for (const [field, receipt] of Object.entries(receipts)) {
      const text = bytesOf(receipt), h = sha(text);
      request[field] = h;
      if (!files.has(`headless/catalog/ramzi-additional-evidence/${h}.json`)) put(`headless/catalog/ramzi-additional-evidence/${h}.json`, text);
    }
    requests.batches.push(request);
    trust.scopes.push({ scopeId, scopeSha256, rootAcceptanceSha256: set.rootAcceptanceSha256, independentReviewSha256, batch: structuredClone(batch),
      activation: { readbackReceiptSha256: request.dbReadbackReceiptSha256, evidenceSha256: sha(JSON.stringify(request)) } });
  }
  put('headless/catalog/ramzi-additional-requests.v1.json', bytesOf(requests));
  put('headless/catalog/ramzi-additional-trust.v1.json', bytesOf(trust));
  return files;
}

function verify() {
  // The same loader and validator that the catalog export and SSR use.
  const additional = loadAdditionalEvidence(catalogDir, publicDir);
  const { catalog, validation } = exportCatalog({ dryRun: true });
  must(validation.ok, 'catalog validation');
  must(additional.bundle && additional.bundle.requests.batches.length === SCOPES.length, 'all requests load');
  const active = [];
  for (const g of catalog.grades) for (const t of g.topics) {
    for (const e of t.editions || []) if (SCOPES.some(s => s.scopeId === e.editionId)) { must(e.routing.aiHintShown === true && e.routing.usesViewer === true, 'routing ' + e.editionId); active.push(e.editionId); }
    if (t.reviewedBaseBinding) { must(t.reviewedBaseBinding.routing.usesViewer === true && t.reviewedBaseBinding.routing.aiHintShown === true, 'base binding'); active.push(t.reviewedBaseBinding.editionId); }
  }
  must(active.length === SCOPES.length && SCOPES.every(s => active.includes(s.scopeId)), 'exactly the reviewed scopes are active');
  return active;
}

function main() {
  const { check, sources } = args();
  const files = build(sources);
  const stale = [];
  for (const [rel, text] of files) {
    const file = path.join(root, rel);
    const same = fs.existsSync(file) && fs.readFileSync(file).equals(text);
    if (same) continue;
    if (check) stale.push(rel); else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
  }
  const expected = new Set([...files.keys()].filter(r => r.startsWith('headless/catalog/ramzi-additional-evidence/')).map(r => path.basename(r)));
  const present = fs.existsSync(evidenceDir) ? fs.readdirSync(evidenceDir) : [];
  const extra = present.filter(f => !expected.has(f));
  if (check) {
    must(!stale.length && !extra.length, 'stale artifacts: ' + [...stale, ...extra].join(', '));
  } else for (const f of extra) fs.rmSync(path.join(evidenceDir, f));
  const active = verify();
  console.log(`${files.size} artifacts ${check ? 'verified' : 'written'}; ${active.length} reviewed scopes active`);
}
main();
