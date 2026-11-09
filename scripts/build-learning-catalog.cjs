'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadIndexCatalog, buildCatalog, EDITIONS_PATH } = require('./lib/headless-catalog.cjs');
const { mergeWorksheetEditions } = require('./lib/worksheet-editions.cjs');

function buildLearningCatalog(raw, registry) {
  const items = [];
  // Preserve every pre-edition ID, field, label and order exactly.
  for (const [g, data] of Object.entries(raw.DATA)) for (const t of data.topics) {
    const row = data.links[t.id] || {};
    for (const l of ['a', 'b', 'c', 'c2', 'one']) if (row[l]) items.push({
      id: `g${g}-t${t.id}-${l}`, g: Number(g), t: t.id, parent: t.parent || t.id, title: t.t, l,
      label: l === 'one' ? (row.oneLabel || 'כל הרמות') : (t[l + 'Label'] || ({ a: 'רמה א׳', b: 'רמה ב׳', c: 'מצוינות', c2: 'מצוינות 2' })[l]),
      pdf: row[l], ...(row.viewerLevel ? { viewerLevel: row.viewerLevel } : {}),
      ...(row.sourceGrade ? { sourceGrade: row.sourceGrade, sourcePrefix: row.sourcePrefix, sourceTitle: row.sourceTitle } : {}),
      x: t.x || (raw.NOAM_PREFIX_FALLBACK[g] || {})[t.id] || '',
    });
  }
  const catalog = mergeWorksheetEditions(buildCatalog(raw), registry);
  for (const g of catalog.grades) for (const t of g.topics) for (const edition of t.editions || []) {
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
  const items = buildLearningCatalog(loadIndexCatalog(), JSON.parse(fs.readFileSync(EDITIONS_PATH, 'utf8')));
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
