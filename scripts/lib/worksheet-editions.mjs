'use strict';
import { validateHintCorrection } from './worksheet-hint-correction.mjs';
// Self-contained pure overlay for Node builds and Vite SSR; one readiness implementation.
const validateRamziReadiness = (() => {
const SHA=/^[0-9a-f]{64}$(?![\s\S])/;
const SCOPE={'ms-20261113-trn-r1':'G7-T86','ms-20261113-cyl-r1':'G8-T84','ms-20261113-con-r1':'G8-T87','ms-20261113-par-r1':'G9-T85'};
const HASHES=['releaseReceiptSha256','payloadSha256','publicationReceiptSha256','finalManifestReviewReceiptSha256','verifiedDbReadbackReceiptSha256','learningWorksheetsReceiptSha256'];
const UNIT=['editionId','prefix','level','worksheetId','revision','pdfId','pdfSha256','sourceNativeExportSha256','nativeExportSha256','canonicalSourceSha256','manifestSha256','itemCount','hintCount'];
function must(ok,why){if(!ok)throw Error('Ramzi readiness: '+why);}
function exact(v,fields,label){must(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(f=>Object.hasOwn(v,f)),label+' fields');}
function validateRamziReadiness(registry,ready){
 if(ready===undefined)return new Map();
 exact(ready,['schema','status','finalManifestsPublished','contentReviewedHead','deployedCommit','itemCount','hintCount','hintReviewSha256',...HASHES,'units'],'ready');
 must(ready.schema==='noam-first567-activation-ready/v1'&&ready.status==='ready_for_activation'&&ready.finalManifestsPublished===false,'phase');
 must(ready.contentReviewedHead==='4f155ebb1f1c1bf85f91dba313df1be3d1cc7217'&&typeof ready.deployedCommit==='string'&&/^[0-9a-f]{40}$(?![\s\S])/.test(ready.deployedCommit),'release');
 must(HASHES.every(k=>typeof ready[k]==='string'&&SHA.test(ready[k])),'receipt hashes');
 must(ready.hintReviewSha256==='3a2438b4076088398e0fb5b167051eb1d57b7a2c1911fcca427abcc35348bd50'&&ready.itemCount===567&&ready.hintCount===1701,'review scope');
 must(Array.isArray(ready.units)&&ready.units.length===12,'unit count');
 const found=new Map();let total=0;
 for(const u of ready.units){
  exact(u,UNIT,'unit');const k=u.editionId+':'+u.level;
  must(Object.hasOwn(SCOPE,u.editionId)&&SCOPE[u.editionId]===u.prefix&&['a','b','c'].includes(u.level)&&!found.has(k),'unit identity');
  const row=registry.editions.find(e=>e.editionId===u.editionId),lv=row?.levels.find(l=>l.key===u.level);
  must(row&&row.status==='published'&&row.publicationMode==='pdf-only'&&row.isDefault===false&&row.nativePrefix===u.prefix&&lv,'registry edition');
  for(const field of ['worksheetId','revision','pdfId','pdfSha256'])must(u[field]===lv[field],'registry '+field);
  must(u.sourceNativeExportSha256===lv.nativeExportSha256,'source native');
  must(['pdfSha256','sourceNativeExportSha256','nativeExportSha256','canonicalSourceSha256','manifestSha256'].every(f=>typeof u[f]==='string'&&SHA.test(u[f])),'source hashes');
  must(Number.isInteger(u.itemCount)&&u.itemCount>0&&u.hintCount===u.itemCount*3,'item counts');total+=u.itemCount;
  found.set(k,{status:'ready',manifestSha256:u.manifestSha256,nativeExportSha256:u.nativeExportSha256,sourceNativeExportSha256:u.sourceNativeExportSha256,canonicalSourceSha256:u.canonicalSourceSha256,itemCount:u.itemCount,hintCount:u.hintCount,payloadSha256:ready.payloadSha256,verifiedDbReadbackReceiptSha256:ready.verifiedDbReadbackReceiptSha256});
 }
 must(total===567,'item total');for(const id of Object.keys(SCOPE))for(const lv of ['a','b','c'])must(found.has(id+':'+lv),'complete level set');
 return found;
}
return validateRamziReadiness;
})();

// Pure catalog overlay: legacy fields never change; unpublished rows never
// reach the public catalog. A publication entry is a complete three-level set.
const LEVELS = { a: ['A', 'רמה א׳'], b: ['B', 'רמה ב׳'], c: ['E', 'מצוינות'] };
const HASH_FIELDS = ['pdfSha256', 'canonicalSourceSha256', 'manifestSha256',
  'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256'];
// The first Grade 7 assessment was approved as three student PDFs. Its
// questions-only sources have no native Ramzi export. Bind this exception to
// the independent print review, the decision on coverage, and the actual files.
const ASSESSMENT_ONE = {
  "editionId": "ms-20261122-g7-ast-01-r1",
  "grade": 7,
  "topicId": 50,
  "nativePrefix": "G7-T141",
  "evidence": {
    "kind": "assessment-questions-only",
    "scopeApprovalSha256": "ca4ce1772bbdd0df3d1d77d12d04f08232d24e7fd8c7affd985a80945d256e1c",
    "independentReviewSha256": "81e39fda9a6b40aaf8d835fac22648ddd1be73c31f5616983babbfd0a3c73b63",
    "freezeSha256": "eecfcd11e7cc4de158397a6aeb5743990a0f3ba30732853d4d345129c742969d"
  },
  "files": {
    "a": [
      "5ff5ffe2f35e0ff5b333d0fff2a691c38db2addf528c99167b3969422fe2e02d",
      "5f67f148af1442441e17e17344cafd441e59b23df02a993914a94e0a17d2cb53"
    ],
    "b": [
      "b0cb5dc2eee858998e54ff5105386ae7311b189f7bdb522d2ce5406b7d5a6fb5",
      "7d3f888aa7321193c59756e73b3e83d71c98153f06e1a4db049caccb1bdf9108"
    ],
    "c": [
      "814eb1686a6cdec037546896c9c515d8adb389ceb5c9a7b361685dadf8e5cbe7",
      "c7e497bca3ddf3c823495b7ec1812f876a379c7dd9f5eec8b0c18b947dc7159f"
    ]
  }
};
function validateAssessmentPdf(row) {
  const evidence = row.assessmentPdfEvidence;
  keys(evidence, Object.keys(ASSESSMENT_ONE.evidence), 'assessment PDF evidence');
  requireValue(row.grade === ASSESSMENT_ONE.grade && row.topicId === ASSESSMENT_ONE.topicId &&
    row.nativePrefix === ASSESSMENT_ONE.nativePrefix && row.editionId === ASSESSMENT_ONE.editionId &&
    row.publicationMode === 'pdf-only' && !row.isDefault &&
    Object.entries(ASSESSMENT_ONE.evidence).every(([k, v]) => evidence[k] === v),
    'assessment PDF requires the reviewed questions-only source and signed print scope');
}

const PDF_ONLY_HASH_FIELDS = ['pdfSha256', 'sourceSha256'];
const ID = /^[a-z0-9][a-z0-9-]{0,63}$(?![\s\S])/;
const SHA = /^[0-9a-f]{64}$/;
function requireValue(ok, message) { if (!ok) throw new Error('Worksheet editions: ' + message); }
function keys(value, allowed, name) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), name + ' must be an object');
  requireValue(Object.keys(value).every(k => allowed.includes(k)), name + ' has unknown fields');
}

function worksheetLearningId(grade, topicId, levelKey, editionId = 'legacy') {
  requireValue(Number.isInteger(grade) && grade >= 1 && grade <= 9 && Number.isInteger(topicId) && topicId > 0,
    'invalid learning topic');
  requireValue(['a', 'b', 'c', 'c2', 'one'].includes(levelKey), 'invalid learning level');
  requireValue(typeof editionId === 'string' && ID.test(editionId), 'invalid editionId');
  return `g${grade}-t${topicId}-${levelKey}` + (editionId === 'legacy' ? '' : `-e-${editionId}`);
}

function mergeWorksheetEditions(catalog, registry, readiness, hintCorrection) {
  keys(registry, ['version', 'editions'], 'registry');
  requireValue(registry.version === 1 && Array.isArray(registry.editions), 'unsupported registry');
  const ramzi = validateRamziReadiness(registry, readiness);
  const correction = validateHintCorrection(readiness, hintCorrection);
  if (correction) for (const [key, unit] of ramzi) ramzi.set(key, { ...unit, ...correction });
  // Withdrawal must also remove stale public readiness from refreshed snapshots.
  if (Object.hasOwn(catalog, 'ramziActivation') || Object.hasOwn(catalog, 'ramziHintCorrection')) {
    const { ramziActivation, ramziHintCorrection, ...withoutReadiness } = catalog; catalog = withoutReadiness;
  }
  // A refreshed snapshot may already contain an overlay. Rebuild it from the
  // registry so a withdrawn publication cannot survive in a stale snapshot.
  if (catalog.grades.some(g => g.topics.some(t => t.editions || t.defaultEditionId))) {
    catalog = { ...catalog, grades: catalog.grades.map(g => ({ ...g, topics: g.topics.map(t => {
      const { editions, defaultEditionId, ...legacy } = t;
      return legacy;
    }) })) };
  }
  const topics = new Map(); const pdfIds = new Set(); const pdfHashes = new Set();
  for (const g of catalog.grades) for (const t of g.topics) {
    topics.set(`${g.grade}:${t.id}`, t);
    for (const level of t.levels) pdfIds.add(level.pdfId);
  }
  const records = new Set(); const canonicalRevisions = new Set(); const defaults = new Set();
  const published = new Map();
  for (const row of registry.editions) {
    keys(row, ['grade', 'topicId', 'editionId', 'label', 'status', 'isDefault', 'levels', 'nativePrefix', 'publicationMode', 'assessmentPdfEvidence'], 'edition');
    const key = `${row.grade}:${row.topicId}`;
    const topic = topics.get(key);
    requireValue(Number.isInteger(row.grade) && row.grade >= 1 && row.grade <= 9 &&
      Number.isInteger(row.topicId) && topic, 'unknown worksheet topic ' + key);
    const middle = row.grade >= 7;
    const pdfOnly = row.publicationMode === 'pdf-only';
    requireValue(!Object.hasOwn(row, 'publicationMode') || (pdfOnly && middle),
      'publicationMode must be pdf-only for middle school only');
    const assessmentPdf = Object.hasOwn(row, 'assessmentPdfEvidence');
    if (assessmentPdf) validateAssessmentPdf(row);
    const hashFields = pdfOnly ? PDF_ONLY_HASH_FIELDS : HASH_FIELDS;
    // Native package numbers are independent of catalog topic IDs. Never
    // silently send a new edition to the legacy topic's question/hint bank.
    requireValue(middle ? typeof row.nativePrefix === 'string' &&
      new RegExp(`^G${row.grade}-T[0-9]{2,3}$(?![\\s\\S])`).test(row.nativePrefix) :
      !Object.hasOwn(row, 'nativePrefix'), 'nativePrefix must be explicit for middle school only');
    requireValue(typeof row.editionId === 'string' && ID.test(row.editionId) && row.editionId !== 'legacy', 'invalid/reserved editionId');
    requireValue(typeof row.label === 'string' && row.label.trim() === row.label && row.label.length > 0 &&
      row.label.length <= 80 && !/[<>\u0000-\u001f]/.test(row.label), 'invalid display label');
    requireValue(['draft', 'reviewed', 'published'].includes(row.status), 'invalid status');
    requireValue(typeof row.isDefault === 'boolean', 'isDefault must be explicit');
    const recordKey = key + ':' + row.editionId;
    requireValue(!records.has(recordKey), 'duplicate topic edition ' + recordKey); records.add(recordKey);
    requireValue(Array.isArray(row.levels) && row.levels.length === 3, 'edition requires exactly a/b/c');
    const seenLevels = new Set();
    for (const level of row.levels) {
      keys(level, ['key', 'viewerLevel', 'pdfId', 'worksheetId', 'revision', ...hashFields,
        ...(middle && !assessmentPdf ? ['nativeExportSha256'] : [])], 'level');
      requireValue(Object.hasOwn(LEVELS, level.key) && !seenLevels.has(level.key), 'duplicate/invalid level');
      seenLevels.add(level.key);
      requireValue(level.viewerLevel === LEVELS[level.key][0], 'viewerLevel must match a/b/c → A/B/E');
      requireValue(typeof level.pdfId === 'string' && /^[0-9a-f]{32}$/.test(level.pdfId), 'invalid media ID');
      requireValue(!pdfIds.has(level.pdfId), 'media ID reused from legacy or another edition: ' + level.pdfId);
      pdfIds.add(level.pdfId);
      requireValue(typeof level.worksheetId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(level.worksheetId), 'invalid worksheetId');
      requireValue(Number.isInteger(level.revision) && level.revision >= 1, 'invalid revision');
      const canonicalKey = level.worksheetId + ':' + level.revision;
      requireValue(!canonicalRevisions.has(canonicalKey), 'canonical revision reused'); canonicalRevisions.add(canonicalKey);
      for (const field of hashFields) requireValue(typeof level[field] === 'string' && SHA.test(level[field]), 'invalid ' + field);
      if (assessmentPdf) {
        const [pdf, source] = ASSESSMENT_ONE.files[level.key];
        requireValue(level.pdfSha256 === pdf && level.sourceSha256 === source &&
          !ramzi.has(row.editionId + ':' + level.key), 'assessment PDF differs from its signed source');
      }
      if (middle && !assessmentPdf) requireValue(typeof level.nativeExportSha256 === 'string' && SHA.test(level.nativeExportSha256),
        'invalid nativeExportSha256');
      requireValue(!pdfHashes.has(level.pdfSha256), 'identical PDF content reused'); pdfHashes.add(level.pdfSha256);
    }
    if (row.status !== 'published') continue;
    if (row.isDefault) {
      requireValue(!defaults.has(key), 'multiple published defaults for ' + key); defaults.add(key);
    }
    const levels = Object.keys(LEVELS).map(k => {
      const level = row.levels.find(l => l.key === k);
      return { ...level, ...(ramzi.has(row.editionId + ':' + k) ? { ramzi: ramzi.get(row.editionId + ':' + k) } : {}),
        label: LEVELS[k][1], labelSource: 'edition',
        learningId: worksheetLearningId(row.grade, row.topicId, k, row.editionId) };
    });
    const prefix = middle ? row.nativePrefix : `G${row.grade}-T${String(row.topicId).padStart(2, '0')}`;
    const edition = { editionId: row.editionId, label: row.label, status: 'published', levels,
      ...(pdfOnly ? { publicationMode: 'pdf-only' } : {}),
      ...(assessmentPdf ? { assessmentPdfEvidence: { ...row.assessmentPdfEvidence } } : {}),
      // PDF deliverables stay PDF-only. Only the separate, verified twelve-unit
      // readiness bundle may enable the source-bound viewer and reviewed hints.
      routing: { resolvedNoamPrefix: prefix, aiHintShown: levels.every(l => l.ramzi?.status === 'ready'),
        usesViewer: levels.every(l => l.ramzi?.status === 'ready'),
        viewerPath: catalog.config.viewer.path,
        siblingPdfQuery: Object.fromEntries(levels.map(l => ['p' + l.key, l.pdfId])) } };
    const entry = published.get(key) || { editions: [], defaultEditionId: 'legacy' };
    entry.editions.push(edition);
    if (row.isDefault) entry.defaultEditionId = row.editionId;
    published.set(key, entry);
  }
  if (!published.size) return catalog;
  return { ...catalog, ...(readiness ? { ramziActivation: readiness } : {}), ...(correction ? { ramziHintCorrection: hintCorrection } : {}), grades: catalog.grades.map(g => ({ ...g, topics: g.topics.map(t => {
    const extra = published.get(`${g.grade}:${t.id}`);
    return extra ? { ...t, ...extra } : t;
  }) })) };
}

export { mergeWorksheetEditions, worksheetLearningId, validateRamziReadiness };
