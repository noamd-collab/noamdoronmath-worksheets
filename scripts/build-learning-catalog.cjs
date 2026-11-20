'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadIndexCatalog, buildCatalog, EDITIONS_PATH } = require('./lib/headless-catalog.cjs');
const { mergeWorksheetEditions } = require('./lib/worksheet-editions.cjs');
const { mergeReviewedCatalog } = require('./lib/reviewed-ramzi-activation.mjs');
const { loadAdditionalEvidence, validateAdditionalEvidence } = require('./lib/reviewed-ramzi-activation-build.cjs');
const { isPdfOnlyTopic } = require('./lib/base-worksheet-publication.mjs');
const { loadRamziActivationEvidence, validateRamziActivation } = require('./lib/worksheet-ramzi-activation.cjs');

function buildLearningCatalog(raw, registry, activationEvidence, additional = {trust:{version:1,scopes:[]},bundle:undefined}) {
  // Validate base publication modes even when this generator runs independently.
  const baseCatalog = buildCatalog(raw);
  const items = [];
  // Preserve every pre-edition ID, field, label and order exactly.
  for (const [g, data] of Object.entries(raw.DATA)) for (const t of data.topics) {
    if (isPdfOnlyTopic(t)) continue;
    const row = data.links[t.id] || {};
    for (const l of ['a', 'b', 'c', 'c2', 'one']) if (row[l]) items.push({
      id: `g${g}-t${t.id}-${l}`, g: Number(g), t: t.id, parent: t.parent || t.id, title: t.t, l,
      label: l === 'one' ? (row.oneLabel || 'כל הרמות') : (t[l + 'Label'] || ({ a: 'רמה א׳', b: 'רמה ב׳', c: 'מצוינות', c2: 'מצוינות 2' })[l]),
      pdf: row[l], ...(row.viewerLevel ? { viewerLevel: row.viewerLevel } : {}),
      ...(row.sourceGrade ? { sourceGrade: row.sourceGrade, sourcePrefix: row.sourcePrefix, sourceTitle: row.sourceTitle } : {}),
      x: t.x || (raw.NOAM_PREFIX_FALLBACK[g] || {})[t.id] || '',
    });
  }
  validateRamziActivation(registry, activationEvidence);
  const initial = mergeWorksheetEditions(baseCatalog, registry, activationEvidence?.ready, activationEvidence?.hintCorrection);
  const projection = validateAdditionalEvidence(initial, registry, additional.bundle);
  const catalog = mergeReviewedCatalog(initial, registry, activationEvidence?.ready, activationEvidence?.hintCorrection, projection, additional.trust);
  // Keep every previously emitted row in its original position. Append only
  // the additional reviewed editions after the complete historical catalog.
  const historicalIds = new Set(initial.grades.flatMap(g => g.topics.flatMap(t => (t.editions || []).filter(e => e.routing.usesViewer).map(e => e.editionId))));
  const editionRows = catalog.grades.flatMap(g => g.topics.flatMap(t => [...(t.editions || []), ...(t.reviewedBaseBinding ? [t.reviewedBaseBinding] : [])].map(edition => ({g,t,edition}))));
  for (const {g,t,edition} of [...editionRows.filter(x => historicalIds.has(x.edition.editionId)), ...editionRows.filter(x => !historicalIds.has(x.edition.editionId))]) {
    // Static PDF editions have no deployed progress identities. Do not expose
    // account controls whose worksheet IDs would require a database rollout.
    if (!edition.routing.usesViewer) continue;
    for (const level of edition.levels) items.push({
      id: level.learningId, g: g.grade, t: t.id, parent: t.parent || t.id, title: t.title,
      l: level.key, label: level.label + ' — ' + edition.label, pdf: level.pdfId,
      viewerLevel: level.key, x: edition.routing.resolvedNoamPrefix,
      editionId: edition.editionId, editionLabel: edition.label,
      siblingPdfQuery: edition.routing.siblingPdfQuery,
    });
  }
  if (new Set(items.map(x => x.id)).size !== items.length) throw Error('Duplicate learning IDs');
  return items;
}

function main() {
  const root = path.join(__dirname, '..');
  const evidence = loadRamziActivationEvidence(path.dirname(EDITIONS_PATH), path.join(root, 'headless/astro-poc/public'));
  const additional = loadAdditionalEvidence(path.dirname(EDITIONS_PATH), path.join(root, 'headless/astro-poc/public'));
  const items = buildLearningCatalog(loadIndexCatalog(), JSON.parse(fs.readFileSync(EDITIONS_PATH, 'utf8')), evidence, additional);
  const text = '/* Generated from index.html; do not edit by hand. */\nwindow.NOAM_LEARNING_CATALOG=' + JSON.stringify(items) + ';\n';
  const output = path.join(root, 'noam-learning-catalog.js');
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8') !== text) throw Error('Learning catalog is stale');
  } else if (!process.argv.includes('--dry-run')) {
    fs.writeFileSync(output, text);
    fs.writeFileSync(path.join(root, 'learning/catalog-seed.sql'),
      'insert into public.noam_learning_worksheets (worksheet_id) values\n' +
      items.map(x => "('" + x.id + "')").join(',\n') + '\non conflict do nothing;\n');
  }
  console.log(items.length + ' worksheet levels indexed; legacy identities unchanged');
}

module.exports = { buildLearningCatalog };
if (require.main === module) main();
