'use strict';

// Pure catalog overlay: legacy fields never change; unpublished rows never
// reach the public catalog. A publication entry is a complete three-level set.
const LEVELS = { a: ['A', 'רמה א׳'], b: ['B', 'רמה ב׳'], c: ['E', 'מצוינות'] };
const HASH_FIELDS = ['pdfSha256', 'canonicalSourceSha256', 'manifestSha256',
  'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256'];
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

function mergeWorksheetEditions(catalog, registry) {
  keys(registry, ['version', 'editions'], 'registry');
  requireValue(registry.version === 1 && Array.isArray(registry.editions), 'unsupported registry');
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
    keys(row, ['grade', 'topicId', 'editionId', 'label', 'status', 'isDefault', 'levels'], 'edition');
    const key = `${row.grade}:${row.topicId}`;
    const topic = topics.get(key);
    requireValue(Number.isInteger(row.grade) && row.grade >= 1 && row.grade <= 6 &&
      Number.isInteger(row.topicId) && topic, 'unknown elementary topic ' + key);
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
      keys(level, ['key', 'viewerLevel', 'pdfId', 'worksheetId', 'revision', ...HASH_FIELDS], 'level');
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
      for (const field of HASH_FIELDS) requireValue(typeof level[field] === 'string' && SHA.test(level[field]), 'invalid ' + field);
      requireValue(!pdfHashes.has(level.pdfSha256), 'identical PDF content reused'); pdfHashes.add(level.pdfSha256);
    }
    if (row.status !== 'published') continue;
    if (row.isDefault) {
      requireValue(!defaults.has(key), 'multiple published defaults for ' + key); defaults.add(key);
    }
    const levels = Object.keys(LEVELS).map(k => {
      const level = row.levels.find(l => l.key === k);
      return { ...level, label: LEVELS[k][1], labelSource: 'edition',
        learningId: worksheetLearningId(row.grade, row.topicId, k, row.editionId) };
    });
    const prefix = `G${row.grade}-T${String(row.topicId).padStart(2, '0')}`;
    const edition = { editionId: row.editionId, label: row.label, status: 'published', levels,
      // Noam approved elementary PDF/teacher publication only, without AI or
      // a database rollout. Keep these editions on the direct PDF path.
      routing: { resolvedNoamPrefix: prefix, aiHintShown: false, usesViewer: false,
        viewerPath: catalog.config.viewer.path,
        siblingPdfQuery: Object.fromEntries(levels.map(l => ['p' + l.key, l.pdfId])) } };
    const entry = published.get(key) || { editions: [], defaultEditionId: 'legacy' };
    entry.editions.push(edition);
    if (row.isDefault) entry.defaultEditionId = row.editionId;
    published.set(key, entry);
  }
  if (!published.size) return catalog;
  return { ...catalog, grades: catalog.grades.map(g => ({ ...g, topics: g.topics.map(t => {
    const extra = published.get(`${g.grade}:${t.id}`);
    return extra ? { ...t, ...extra } : t;
  }) })) };
}

module.exports = { mergeWorksheetEditions, worksheetLearningId };
