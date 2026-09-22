'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  ROOT,
  OUT_JSON,
  loadIndexCatalog,
  buildCatalog,
  validateCatalog,
  exportCatalog,
  assertDeterministic,
  catalogStats,
  stableStringify,
  resolvedNoamPrefix,
} = require('../scripts/lib/headless-catalog.cjs');

const schemaPath = path.join(ROOT, 'headless', 'catalog', 'catalog.schema.json');

test('deterministic export from index.html is stable across two runs', () => {
  const a = assertDeterministic();
  assert.equal(a.validation.ok, true, a.validation.errors.join('\n'));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
});

test('catalog.v1.json exists, parses, and matches fresh export', () => {
  assert.ok(fs.existsSync(OUT_JSON), 'missing catalog.v1.json — run node scripts/export-headless-catalog.cjs');
  const onDisk = fs.readFileSync(OUT_JSON, 'utf8');
  const fresh = exportCatalog({ dryRun: true });
  assert.equal(onDisk, fresh.text, 'catalog.v1.json out of date with index.html');
  const parsed = JSON.parse(onDisk);
  assert.equal(parsed.contractVersion, 1);
  assert.equal(parsed.sourceOfTruth.path, 'index.html');
  assert.equal(parsed.sourceOfTruth.authoritative, true);
});

test('parity with index.html: grades, topics, levels, PDF ids, parents, groups, SEARCH_TERMS, Noam ids', () => {
  const raw = loadIndexCatalog();
  const catalog = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  const result = validateCatalog(catalog, raw);
  assert.equal(result.ok, true, result.errors.join('\n'));

  const s = result.stats;
  assert.equal(s.grades, 9);
  assert.equal(s.topics, 328);
  assert.equal(s.levels, 956);
  assert.equal(s.uniquePdfIds, 956);
  assert.equal(s.childTopics, 3);
  assert.equal(s.withNoamTopicId, 148);
  assert.equal(s.searchEntries, 116);
  assert.equal(s.iconKeys, 80);

  // Exact per-grade topic counts from DATA
  const expected = { 1: 23, 2: 29, 3: 25, 4: 30, 5: 35, 6: 27, 7: 50, 8: 65, 9: 44 };
  for (const g of catalog.grades) {
    assert.equal(g.topics.length, expected[g.grade], 'grade ' + g.grade + ' topic count');
  }

  // Parent/child: grade 9 topics 41/42/43 parent 2
  const g9 = catalog.grades.find((g) => g.grade === 9);
  const children = g9.topics.filter((t) => t.parent === 2);
  assert.equal(children.length, 3);
  assert.deepEqual(
    children.map((t) => t.id).sort((a, b) => a - b),
    [41, 42, 43]
  );

  // No duplicate topic ids within a grade; no orphan parents
  for (const g of catalog.grades) {
    const ids = g.topics.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids in grade ' + g.grade);
    const idSet = new Set(ids);
    for (const t of g.topics) {
      if (t.parent !== undefined) assert.ok(idSet.has(t.parent), 'orphan parent ' + t.parent);
    }
  }

  // PDF id set exact match vs DATA links
  const rawPdfs = new Set();
  for (const gd of Object.values(raw.DATA)) {
    for (const row of Object.values(gd.links || {})) {
      if (row.one) rawPdfs.add(row.one);
      for (const k of ['a', 'b', 'c']) if (row[k]) rawPdfs.add(row[k]);
    }
  }
  const catPdfs = new Set();
  for (const g of catalog.grades) {
    for (const t of g.topics) for (const lv of t.levels) catPdfs.add(lv.pdfId);
  }
  assert.equal(catPdfs.size, rawPdfs.size);
  for (const id of rawPdfs) assert.ok(catPdfs.has(id), 'missing pdf ' + id);

  // SEARCH_TERMS keys/values
  for (const [gk, map] of Object.entries(raw.SEARCH_TERMS)) {
    for (const [tid, terms] of Object.entries(map)) {
      assert.equal(catalog.searchTerms[String(gk)][String(tid)], terms);
    }
  }

  // Noam explicit x + fallback resolution sample
  const g7 = catalog.grades.find((g) => g.grade === 7);
  const t16 = g7.topics.find((t) => t.id === 16);
  assert.equal(t16.noamTopicId, undefined);
  assert.equal(t16.routing.resolvedNoamPrefix, 'G7-T16');
  assert.equal(t16.routing.aiHintShown, false);
  assert.equal(t16.routing.usesViewer, true);

  const withX = g7.topics.find((t) => t.noamTopicId);
  assert.ok(withX);
  assert.equal(withX.routing.resolvedNoamPrefix, withX.noamTopicId);
  assert.equal(withX.routing.aiHintShown, true);

  // Elementary never uses viewer even if somehow prefixed — current DATA has no x on elementary
  for (const g of catalog.grades.filter((x) => x.grade <= 6)) {
    for (const t of g.topics) {
      assert.equal(t.routing.usesViewer, false);
    }
  }

  // Track groups
  assert.deepEqual(catalog.config.trackGroups, ['r9oct', 'r9sep']);
  const reduced = g9.groups.filter((gr) => gr.reducedProgram).map((gr) => gr.key).sort();
  assert.deepEqual(reduced, ['r9oct', 'r9sep']);

  // BASE / VIEWER
  assert.equal(catalog.config.pdfBase, raw.BASE);
  assert.equal(catalog.config.viewer.path, raw.VIEWER.path);
  assert.equal(catalog.config.viewer.enabled, raw.VIEWER.enabled);
});

test('schema file documents required contractVersion and sheetHref recipe', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.equal(schema.properties.contractVersion.const, 1);
  assert.ok(schema.required.includes('grades'));
  assert.ok(schema['x-field-classification']);
  assert.ok(schema['x-field-classification']['sheetHref-recipe']);
  assert.ok(schema['x-field-classification']['generated-derived'].length > 0);
});

test('export CLI --check exits 0 when JSON is current', () => {
  const cli = path.join(ROOT, 'scripts', 'export-headless-catalog.cjs');
  const result = spawnSync(process.execPath, [cli, '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK/);
});

test('resolvedNoamPrefix matches production noamTopicPrefix semantics', () => {
  const raw = loadIndexCatalog();
  for (const [gk, gd] of Object.entries(raw.DATA)) {
    const grade = Number(gk);
    for (const t of gd.topics) {
      const expected = t.x
        ? String(t.x)
        : (raw.NOAM_PREFIX_FALLBACK[grade] && raw.NOAM_PREFIX_FALLBACK[grade][t.id]) ||
          (raw.NOAM_PREFIX_FALLBACK[gk] && raw.NOAM_PREFIX_FALLBACK[gk][t.id]) ||
          null;
      const got = resolvedNoamPrefix(t, grade, raw.NOAM_PREFIX_FALLBACK);
      const normExpected = expected ? String(expected) : null;
      assert.equal(got, normExpected, 'grade ' + grade + ' topic ' + t.id);
    }
  }
});

test('buildCatalog stats helper agrees with validateCatalog stats', () => {
  const raw = loadIndexCatalog();
  const catalog = buildCatalog(raw);
  const a = catalogStats(catalog);
  const b = validateCatalog(catalog, raw).stats;
  assert.equal(a.topics, b.topics);
  assert.equal(a.levels, b.levels);
  assert.equal(a.uniquePdfIds, b.uniquePdfIds);
  assert.equal(stableStringify(catalog), stableStringify(buildCatalog(raw)));
});
