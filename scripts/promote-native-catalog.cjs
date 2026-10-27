#!/usr/bin/env node
'use strict';

// Promote reviewed worksheet packages as whole PDF/manifest/SVG releases.
// Never attach a newer figure export to an older, potentially different PDF.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loadIndexCatalog, resolvedNoamPrefix } = require('./lib/headless-catalog.cjs');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'headless/astro-poc');
const names = ['pilot', 'next-ten', 'second-ten', 'third-ten', 'fourth-ten', 'remaining-101'];
const rows = names.flatMap(name => JSON.parse(fs.readFileSync(path.join(app, `src/data/worksheet-${name}.v1.json`))).sheets);
const sourceReuse = JSON.parse(fs.readFileSync(path.join(app, 'src/data/native-catalog-reuse.v1.json'))).duplicates;
const indexPath = path.join(root, 'index.html');
const raw = loadIndexCatalog(indexPath);
const packages = new Map();
for (const row of rows) {
  const manifest = JSON.parse(fs.readFileSync(path.join(app, `public/noam-ai/manifests/${row.pdfId}.json`)));
  assert.equal(manifest.sourceSha256, row.pdfSha256, `${row.package}: PDF provenance`);
  assert.ok(manifest.exercises.every(ex => ex.nativeQuestionId && ex.nativeItemId), `${row.package}: native question wiring`);
  assert.ok(manifest.prefix === row.x || (row.x === 'G9-T40' && manifest.prefix === 'G9-T32'), `${row.package}: manifest prefix`);
  const group = packages.get(row.x) || [];
  group.push(row); packages.set(row.x, group);
}
const migrationPath = path.join(root, 'noam-ai/catalog-migrations.json');
const migrations = fs.existsSync(migrationPath) ? JSON.parse(fs.readFileSync(migrationPath)) : { schemaVersion: 1, byPdf: {} };
const promoted = [];
const unmatched = [];

// This reviewed package was not present in the old catalog at all.
if (!raw.DATA[8].topics.some(t => t.x === 'G8-T66')) {
  assert.ok(!raw.DATA[8].topics.some(t => t.id === 66), 'topic 66 must be free');
  raw.DATA[8].topics.push({ id: 66, x: 'G8-T66', ic: 'table', g: 'data', t: 'שני מקורות מידע', d: 'השוואה ושילוב של נתונים משני מקורות מידע.' });
  raw.DATA[8].links[66] = {};
}
for (const grade of [7, 8, 9]) {
  for (const topic of raw.DATA[grade].topics) {
    const oldPrefix = resolvedNoamPrefix(topic, grade, raw.NOAM_PREFIX_FALLBACK);
    const prefix = sourceReuse[oldPrefix] || oldPrefix;
    const sheets = packages.get(prefix);
    if (!sheets) { unmatched.push({ grade, topicId: topic.id, prefix: oldPrefix, title: topic.t }); continue; }
    const oldRow = raw.DATA[grade].links[topic.id] || {};
    const next = {};
    if (sheets.length === 1 && sheets[0].level === 'one') {
      next.one = sheets[0].pdfId;
      next.viewerLevel = 'one';
      if (oldRow.oneLabel || topic.aLabel) next.oneLabel = oldRow.oneLabel || topic.aLabel;
    } else {
      for (const row of sheets) next[row.level] = row.pdfId;
      // Extra reviewed excellence sheets have no native replacement yet.
      if (oldRow.c2) next.c2 = oldRow.c2;
    }
    if (sourceReuse[oldPrefix]) {
      next.sourceGrade = sheets[0].grade; next.sourcePrefix = sheets[0].x; next.sourceTitle = sheets[0].title;
      topic.n = 'דף חזרה מכיתה ז׳ לתרגול בכיתה ט׳.';
    }
    const siblings = {};
    for (const row of sheets) if (row.level !== 'one') siblings['p' + row.level] = row.pdfId;
    if (next.c2) siblings.pc2 = next.c2;
    for (const [oldLevel, oldPdf] of Object.entries(oldRow)) {
      if (!['a', 'b', 'c', 'c2', 'one'].includes(oldLevel)) continue;
      const target = sheets.length === 1 ? sheets[0] : sheets.find(row => row.level === oldLevel);
      if (!target || oldPdf === target.pdfId) continue;
      const migration = {
        original: { prefix: oldPrefix, grade, level: oldLevel === 'one' ? (oldRow.viewerLevel || 'b') : oldLevel },
        pdfId: target.pdfId, prefix, grade: target.grade, level: target.level,
        topicId: topic.parent || topic.id, title: next.sourceTitle || topic.t, siblings,
      };
      assert.ok(!migrations.byPdf[oldPdf] || JSON.stringify(migrations.byPdf[oldPdf]) === JSON.stringify(migration), `ambiguous old PDF ${oldPdf}`);
      migrations.byPdf[oldPdf] = migration;
    }
    topic.x = oldPrefix;
    raw.DATA[grade].links[topic.id] = next;
    promoted.push(...sheets.map(row => ({ key: row.key, pdfId: row.pdfId, prefix, grade, level: row.level, topicId: topic.id })));
  }
}
assert.equal(new Set(promoted.map(row => row.key)).size, rows.length, 'every reviewed sheet must be reachable from the ordinary catalog');

// Locate balanced data blocks without reformatting the unrelated catalog/UI.
function blockEnd(text, start) {
  let depth = 0, quote = '', escape = false, line = false, comment = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (comment) { if (c === '*' && n === '/') { comment = false; i++; } continue; }
    if (quote) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{' || c === '[') depth++;
    if ((c === '}' || c === ']') && --depth === 0) return i + 1;
  }
  throw new Error('Unbalanced catalog block');
}
let html = fs.readFileSync(indexPath, 'utf8');
for (const grade of [7, 8, 9]) {
  const match = new RegExp('^  ' + grade + ': \\{', 'm').exec(html);
  assert.ok(match, `grade ${grade}`);
  const start = html.indexOf('{', match.index), end = blockEnd(html, start);
  let section = html.slice(start, end);
  const ls = section.indexOf('{', section.indexOf('links:')), le = blockEnd(section, ls);
  const links = '{\n' + Object.entries(raw.DATA[grade].links).map(([id, row]) => '      ' + id + ': ' + JSON.stringify(row)).join(',\n') + '\n    }';
  section = section.slice(0, ls) + links + section.slice(le);
  if (grade === 8 && !section.includes('x:"G8-T66"')) {
    const ts = section.indexOf('[', section.indexOf('topics:')), te = blockEnd(section, ts);
    const topic = raw.DATA[8].topics.find(t => t.x === 'G8-T66');
    section = section.slice(0, te - 1).trimEnd() + ',\n      { id:66, x:"G8-T66", ic:"table", g:"data", t:' + JSON.stringify(topic.t) + ',\n        d:' + JSON.stringify(topic.d) + ' }\n    ' + section.slice(te - 1);
  }
  for (const topic of raw.DATA[grade].topics) {
    if (!sourceReuse[resolvedNoamPrefix(topic, grade, raw.NOAM_PREFIX_FALLBACK)]) continue;
    const tm = new RegExp('\\{\\s*(?:"id"|id)\\s*:\\s*' + topic.id + '(?=,|\\s)').exec(section);
    assert.ok(tm, 'source reuse topic ' + topic.id);
    section = section.slice(0, tm.index) + JSON.stringify(topic) + section.slice(blockEnd(section, tm.index));
  }
  html = html.slice(0, start) + section + html.slice(end);
}
fs.writeFileSync(indexPath, html);
for (const destination of [migrationPath, path.join(app, 'public/noam-ai/catalog-migrations.json')]) {
  fs.writeFileSync(destination, JSON.stringify(migrations, null, 2) + '\n');
  fs.writeFileSync(destination.replace(/\.json$/, '.js'), 'window.NoamCatalogMigrations = ' + JSON.stringify(migrations) + ';\n');
}
console.log(JSON.stringify({ promotedSheets: new Set(promoted.map(row => row.key)).size, oldPdfMigrations: Object.keys(migrations.byPdf).length, unmatchedTopics: unmatched }, null, 2));
