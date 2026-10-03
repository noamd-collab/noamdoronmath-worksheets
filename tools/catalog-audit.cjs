#!/usr/bin/env node
'use strict';

/**
 * Catalog / topic page / worksheet PDF audit.
 *
 *   node tools/catalog-audit.cjs                      # offline: every local check, PDFs "not verified"
 *   node tools/catalog-audit.cjs --pdf network        # also fetch each PDF (signature, pages, title text)
 *   node tools/catalog-audit.cjs --out DIR --root DIR --pdf-limit N --pdf-timeout MS --fail-on error|warning
 *
 * Writes DIR/report.md (readable, by severity), DIR/audit.json (machine), DIR/relations.csv
 * (every grade → topic → level → PDF link and every page → topic link, with source file and
 * evidence) and DIR/findings.csv. Default DIR: catalog-audit-report/ (git-ignored).
 *
 * Read-only: it never writes outside --out and never edits a data file. Deterministic: no
 * timestamps; every list is sorted; the same inputs give byte-identical outputs.
 * Exit code: 0 = no finding at or above --fail-on (default "error"), 1 = such findings,
 * 2 = the audit itself could not run. A PDF that cannot be reached is "unverified", never a pass
 * and never a failure.
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const { loadIndexCatalog, buildCatalog, validateCatalog, stableStringify } = require('../scripts/lib/headless-catalog.cjs');

const SEVERITIES = ['error', 'warning', 'review', 'info'];
const PDF_ID = /^[0-9a-f]{32}$/;
const LEVEL_ORDER = { a: 0, b: 1, c: 2, one: 3 };
const HEB_GRADE = { 1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט' };

const P = {
  index: 'index.html',
  legacyIndex: 'headless/astro-poc/public/legacy-github/index.html',
  export: 'headless/catalog/catalog.v1.json',
  snapshot: 'headless/astro-poc/src/data/catalog.v1.json',
  snapshotSha: 'headless/astro-poc/src/data/catalog.v1.json.sha256',
  learning: 'noam-learning-catalog.js',
  learningPublic: 'headless/astro-poc/public/noam-learning-catalog.js',
  seed: 'learning/catalog-seed.sql',
  middleFixture: 'tests/fixtures/middle-school-levels.json',
  manifests: 'noam-ai/manifests',
  manifestsPublic: 'headless/astro-poc/public/noam-ai/manifests',
  topicPages: 'headless/astro-poc/src/data/topic-pages',
  blogPosts: 'headless/astro-poc/src/data/blog-posts',
  gradeHubs: 'headless/astro-poc/src/data/grade-hubs',
  sitePages: 'headless/astro-poc/src/data/site-pages',
  homePage: 'headless/astro-poc/src/data/home-page.json',
  redirects: 'headless/astro-poc/src/data/redirects.json',
  pages: 'headless/astro-poc/src/pages',
};

// ───────────────────────────── small helpers ─────────────────────────────

function readText(root, rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
function readJson(root, rel) {
  const text = readText(root, rel);
  if (text == null) return null;
  return JSON.parse(text);
}
function listJson(root, rel) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return null;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
}
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const levelSort = (a, b) => (LEVEL_ORDER[a] ?? 9) - (LEVEL_ORDER[b] ?? 9) || cmp(a, b);

/** Hebrew-aware tokens: niqqud, maqaf and punctuation dropped, final letters normalised. */
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
function words(text, { digits = false } = {}) {
  return String(text || '')
    .toLowerCase()
    .replace(/\u05BE/g, ' ')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL[c])
    .replace(digits ? /[׳״'"`.,:;!?()[\]{}|/\\—–\-+=×·<>]/g : /[׳״'"`.,:;!?()[\]{}|/\\—–\-+=×·<>0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 || digits);
}
const STOP = new Set(['לכיתה', 'כיתה', 'חלק', 'דפי', 'עבודה', 'של', 'עמ', 'את', 'על', 'או', 'גמ', 'רמה', 'תרגול', 'ז', 'ח', 'ט']);
/** Same word up to a plural/feminine ending and one leading prefix letter (ה, ו, ב, ל, מ, ש, כ) on either word. */
function sameWord(a, b) {
  const forms = (w) => {
    const base = w.length > 4 ? w.replace(/(ימ|ות|ית|יה)$/, '') : w;
    const out = [base];
    if (base.length > 3 && 'הובלמשכ'.includes(base[0])) out.push(base.slice(1));
    return out;
  };
  const fa = forms(a);
  return forms(b).some((f) => fa.includes(f));
}
function tokens(text, digits) {
  return [...new Set(words(text, { digits }).filter((w) => !STOP.has(w)))];
}
/** Share of the shorter text's words found in the other one (0..1). */
function similarity(a, b) {
  const A = tokens(a, false);
  const B = tokens(b, false);
  if (!A.length || !B.length) return 0;
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  return small.filter((w) => big.some((v) => sameWord(w, v))).length / small.length;
}
/** Both titles have the same words (numbers included): only word forms differ. */
function sameWords(a, b) {
  const A = tokens(a, true);
  const B = tokens(b, true);
  if (!A.length || A.length !== B.length) return false;
  return A.every((w) => B.some((v) => sameWord(w, v))) && B.every((w) => A.some((v) => sameWord(w, v)));
}
/** One title is the other plus only numbers/"עד"/"בתחום" (e.g. "מרכיבים ומפרקים" vs "… עד 10"). */
function subsetOnlyNumbers(a, b) {
  const A = tokens(a, true);
  const B = tokens(b, true);
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  if (small.length < 2 || small.length === big.length) return false;
  if (!small.every((w) => big.some((v) => sameWord(w, v)))) return false;
  const extra = big.filter((v) => !small.some((w) => sameWord(w, v)));
  return extra.every((w) => /^\d+$/.test(w) || w === 'עד' || w === 'בתחומ');
}
function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

// ───────────────────────────── the audit ─────────────────────────────

class Audit {
  constructor(root) {
    this.root = root;
    this.findings = [];
    this.relations = [];
    this.inputs = [];
    this.coverage = {};
  }

  find(severity, code, fields, message) {
    if (!SEVERITIES.includes(severity)) throw new Error('bad severity ' + severity);
    this.findings.push({
      severity,
      code,
      grade: fields.grade ?? '',
      topicId: fields.topicId ?? '',
      level: fields.level ?? '',
      pdfId: fields.pdfId ?? '',
      subject: fields.subject ?? '',
      message,
      source: fields.source ?? '',
      evidence: fields.evidence ?? '',
    });
  }

  relate(relation, fields) {
    this.relations.push({
      relation,
      grade: fields.grade ?? '',
      topicId: fields.topicId ?? '',
      topicTitle: fields.topicTitle ?? '',
      level: fields.level ?? '',
      pdfId: fields.pdfId ?? '',
      target: fields.target ?? '',
      source: fields.source ?? '',
      evidence: fields.evidence ?? '',
    });
  }

  input(rel, required) {
    const file = path.join(this.root, rel);
    const exists = fs.existsSync(file);
    const isDir = exists && fs.statSync(file).isDirectory();
    this.inputs.push({ path: rel, present: exists, kind: isDir ? 'dir' : 'file', sha256: exists && !isDir ? sha256(fs.readFileSync(file)) : '' });
    if (!exists) {
      this.find(required ? 'error' : 'warning', 'INPUT_MISSING', { source: rel }, `input ${rel} is missing`);
    }
    return exists;
  }
}

/** Grade → topic → level → PDF from index.html DATA (the source of truth). */
function checkIndexData(au, raw) {
  const topicsByGrade = new Map();
  const pdfOwners = new Map();
  let topicCount = 0;
  let levelCount = 0;
  for (const gk of Object.keys(raw.DATA).sort((a, b) => Number(a) - Number(b))) {
    const grade = Number(gk);
    const gd = raw.DATA[gk];
    const src = (s) => `index.html DATA[${grade}]${s}`;
    const groups = new Map((gd.groups || []).map((g) => [g.key, g]));
    const byId = new Map();
    for (const [i, t] of (gd.topics || []).entries()) {
      topicCount++;
      if (byId.has(t.id)) {
        au.find('error', 'DATA_DUP_TOPIC_ID', { grade, topicId: t.id, source: P.index, evidence: src(`.topics[${i}]`) }, `topic id ${t.id} appears twice in grade ${grade}`);
        continue;
      }
      byId.set(t.id, t);
      au.relate('grade→topic', { grade, topicId: t.id, topicTitle: t.t, target: `group ${t.g}`, source: P.index, evidence: src(`.topics[${i}]`) });
      const trackGroup = !!(raw.TRACK_GROUPS || {})[t.g];
      if (trackGroup && grade !== 9) au.find('error', 'DATA_TRACK_HIDDEN', { grade, topicId: t.id, subject: t.t, source: P.index, evidence: src(`.topics[${i}].g = "${t.g}"`) }, 'topic sits in a grade 9 track group in another grade: the catalog never shows it');
      if (!groups.has(t.g)) {
        au.find('error', 'DATA_GROUP_UNKNOWN', { grade, topicId: t.id, subject: t.t, source: P.index, evidence: src(`.topics[${i}].g = "${t.g}"`) }, `group "${t.g}" is not a group of grade ${grade}: the catalog never shows this topic`);
      }
      if (t.x != null && t.x !== '') {
        const m = /^G(\d)-T(\d+)$/.exec(t.x);
        if (!m) au.find('warning', 'DATA_PREFIX_FORMAT', { grade, topicId: t.id, source: P.index, evidence: src(`.topics[${i}].x = "${t.x}"`) }, `Noam prefix "${t.x}" is not G<grade>-T<nn>`);
        else if (Number(m[1]) !== grade) au.find('error', 'DATA_PREFIX_GRADE', { grade, topicId: t.id, subject: t.t, source: P.index, evidence: src(`.topics[${i}].x = "${t.x}"`) }, `Noam prefix ${t.x} names grade ${m[1]}, topic is in grade ${grade}`);
      }
    }
    topicsByGrade.set(grade, byId);

    // parents
    for (const t of byId.values()) {
      if (t.parent === undefined) continue;
      const parent = byId.get(t.parent);
      if (!parent) au.find('error', 'DATA_PARENT_MISSING', { grade, topicId: t.id, subject: t.t, source: P.index, evidence: `parent ${t.parent}` }, `parent topic ${t.parent} does not exist: the subtopic is never shown`);
      else if (parent.parent !== undefined) au.find('error', 'DATA_PARENT_NESTED', { grade, topicId: t.id, source: P.index, evidence: `parent ${t.parent} has parent ${parent.parent}` }, 'subtopic of a subtopic is never shown');
      else au.relate('topic→subtopic', { grade, topicId: t.parent, topicTitle: parent.t, target: `topic ${t.id} ${t.t}`, source: P.index, evidence: src(`topic ${t.id}.parent = ${t.parent}`) });
    }
    // empty groups (shown as a filter chip with nothing behind it)
    for (const g of groups.values()) {
      const shown = [...byId.values()].filter((t) => t.g === g.key && t.parent === undefined);
      if (!shown.length) au.find('warning', 'DATA_GROUP_EMPTY', { grade, subject: g.name, source: P.index, evidence: src(`.groups key "${g.key}"`) }, `group "${g.name}" has no topics`);
    }

    // links
    const links = gd.links || {};
    for (const tid of Object.keys(links).sort((a, b) => Number(a) - Number(b))) {
      if (!byId.has(Number(tid))) au.find('error', 'DATA_LINKS_ORPHAN', { grade, topicId: tid, source: P.index, evidence: src(`.links[${tid}]`) }, `links for topic ${tid}, which does not exist`);
    }
    for (const t of byId.values()) {
      const row = links[t.id];
      const levels = row ? Object.keys(row).filter((k) => k in LEVEL_ORDER).sort(levelSort) : [];
      if (!levels.length) {
        au.find('error', 'DATA_TOPIC_NO_LEVELS', { grade, topicId: t.id, subject: t.t, source: P.index, evidence: src(`.links[${t.id}]`) }, 'topic has no worksheet level');
        continue;
      }
      if (levels.includes('one') && levels.some((l) => l !== 'one')) au.find('error', 'DATA_LEVEL_ONE_AND_ABC', { grade, topicId: t.id, source: P.index, evidence: src(`.links[${t.id}]`) }, 'topic has a single shared sheet and separate levels');
      else if (!levels.includes('one') && levels.join() !== 'a,b,c') {
        au.find('review', 'DATA_LEVELS_PARTIAL', { grade, topicId: t.id, subject: t.t, source: P.index, evidence: `levels ${levels.join(',')}${t.aLabel ? '; aLabel "' + t.aLabel + '"' : ''}${t.cLabel ? '; cLabel "' + t.cLabel + '"' : ''}` }, `only level(s) ${levels.join(', ')}${t.parent !== undefined ? ' (subtopic of ' + t.parent + ')' : ''}`);
      }
      for (const lv of levels) {
        const id = row[lv];
        levelCount++;
        const ev = src(`.links[${t.id}].${lv}`);
        if (!PDF_ID.test(String(id))) {
          au.find('error', 'DATA_PDF_ID_FORMAT', { grade, topicId: t.id, level: lv, pdfId: id, source: P.index, evidence: ev }, `PDF id "${id}" is not 32 lowercase hex characters`);
          continue;
        }
        au.relate('topic→level→pdf', { grade, topicId: t.id, topicTitle: t.t, level: lv, pdfId: id, target: `${raw.BASE}${id}.pdf`, source: P.index, evidence: ev });
        if (!pdfOwners.has(id)) pdfOwners.set(id, []);
        pdfOwners.get(id).push({ grade, topicId: t.id, level: lv, title: t.t, parent: t.parent });
      }
    }
  }

  // same PDF in several places
  for (const [id, owners] of [...pdfOwners.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    if (owners.length < 2) continue;
    const list = owners.map((o) => `${o.grade}:${o.topicId}:${o.level} "${o.title}"`).join(' | ');
    const sameTopic = owners.every((o) => o.grade === owners[0].grade && o.topicId === owners[0].topicId);
    const family = owners.every((o) => o.grade === owners[0].grade && (o.parent ?? o.topicId) === (owners[0].parent ?? owners[0].topicId));
    const sameTitle = owners.every((o) => similarity(o.title, owners[0].title) >= 0.8);
    if (sameTopic) au.find('warning', 'PDF_SAME_FILE_SEVERAL_LEVELS', { grade: owners[0].grade, topicId: owners[0].topicId, pdfId: id, source: P.index, evidence: list }, 'one PDF serves several levels of the same topic');
    else if (family || sameTitle) au.find('info', 'PDF_SHARED_INTENDED', { pdfId: id, source: P.index, evidence: list }, family ? 'shared between a topic and its subtopic' : 'shared between topics with the same title (deliberate reuse)');
    else au.find('error', 'PDF_SHARED_SUSPICIOUS', { pdfId: id, source: P.index, evidence: list }, 'the same PDF is linked from unrelated topics');
  }

  // fallback prefixes and search terms that point at nothing
  for (const g of Object.keys(raw.NOAM_PREFIX_FALLBACK || {})) {
    for (const tid of Object.keys(raw.NOAM_PREFIX_FALLBACK[g])) {
      if (!topicsByGrade.get(Number(g))?.has(Number(tid))) au.find('warning', 'DATA_PREFIX_FALLBACK_ORPHAN', { grade: g, topicId: tid, source: P.index, evidence: `NOAM_PREFIX_FALLBACK[${g}][${tid}]` }, 'prefix fallback for a topic that does not exist');
    }
  }
  for (const g of Object.keys(raw.SEARCH_TERMS || {})) {
    for (const tid of Object.keys(raw.SEARCH_TERMS[g] || {})) {
      if (!topicsByGrade.get(Number(g))?.has(Number(tid))) au.find('warning', 'DATA_SEARCH_TERMS_ORPHAN', { grade: g, topicId: tid, source: P.index, evidence: `SEARCH_TERMS[${g}][${tid}]` }, 'search terms for a topic that does not exist');
    }
  }

  // search terms that describe another topic of the grade better than their own
  for (const [grade, byId] of topicsByGrade) {
    const terms = (raw.SEARCH_TERMS || {})[grade] || {};
    for (const tid of Object.keys(terms).sort((a, b) => Number(a) - Number(b))) {
      const own = byId.get(Number(tid));
      if (!own) continue;
      const text = Array.isArray(terms[tid]) ? terms[tid].join(' ') : String(terms[tid]);
      const ownFit = similarity(text, `${own.t} ${own.d || ''}`);
      let best = null;
      for (const t of byId.values()) {
        if (t.id === own.id) continue;
        const fit = similarity(text, `${t.t} ${t.d || ''}`);
        if (!best || fit > best.fit) best = { t, fit };
      }
      if (ownFit === 0 && best && best.fit >= 0.5) {
        au.find('warning', 'SEARCH_TERMS_MISPLACED', { grade, topicId: own.id, subject: own.t, source: P.index, evidence: `SEARCH_TERMS[${grade}][${tid}] "${text}" fits topic ${best.t.id} "${best.t.t}" (${best.fit.toFixed(2)}), not its own (0.00)` }, 'search terms seem to belong to another topic');
      }
    }
  }

  au.coverage.grades = topicsByGrade.size;
  au.coverage.topics = topicCount;
  au.coverage.worksheetLevels = levelCount;
  au.coverage.uniquePdfIds = pdfOwners.size;
  return { topicsByGrade, pdfOwners };
}

/** Titles: grade letters, units, maqaf, spacing, near-duplicates in a grade. */
function checkTitles(au, topicsByGrade) {
  const he = 'א-ת';
  const rules = [
    ['TITLE_GRADE_GERESH', new RegExp(`(כיתה|לכיתה|כיתות) [${he}](?![׳'${he}])`, 'u'), 'grade letter without geresh'],
    ['TITLE_UNIT', new RegExp(`(?<![${he}])(סמ|סמק|מק|קמ|ממ)(?![${he}״"])`, 'u'), 'unit abbreviation without gershayim (ס״מ, סמ״ק, מ״ק…)'],
    ['TITLE_MAQAF', /(דו|רב|תלת|חד|ישר|אי|שווה) (ספרתי|ספרתיים|שלבי|שלביות|ממד|ממדי|זווית|זוויות|זוגי|זוגיים|שוקיים|איבר)/u, 'compound written with a space instead of maqaf'],
    ['TITLE_SPACING', /^\s|\s$|\s{2,}/u, 'leading, trailing or double space'],
  ];
  for (const [grade, byId] of topicsByGrade) {
    const list = [...byId.values()];
    for (const t of list) {
      for (const [code, re, what] of rules) {
        const m = re.exec(t.t);
        if (m) au.find('warning', code, { grade, topicId: t.id, subject: t.t, source: P.index, evidence: `"${m[0]}"` }, what);
      }
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.parent === b.id || b.parent === a.id) continue;
        if (a.t.trim() === b.t.trim()) au.find('error', 'TITLE_DUPLICATE', { grade, topicId: `${a.id},${b.id}`, subject: a.t, source: P.index, evidence: `topics ${a.id} and ${b.id}` }, 'two topics in the same grade have the same title');
        else if (sameWords(a.t, b.t)) au.find('review', 'TITLE_NEAR_DUPLICATE', { grade, topicId: `${a.id},${b.id}`, subject: `${a.t} | ${b.t}`, source: P.index, evidence: 'same words, different forms' }, 'two topics in the same grade have nearly the same title: rename or confirm they differ');
        else if (subsetOnlyNumbers(a.t, b.t)) au.find('review', 'TITLE_NEAR_DUPLICATE', { grade, topicId: `${a.id},${b.id}`, subject: `${a.t} | ${b.t}`, source: P.index, evidence: 'one title is the other plus only a number range' }, 'two topics in the same grade have nearly the same title: rename or confirm they differ');
      }
    }
  }
}

/** Generated copies must equal what their generators would write from index.html today. */
function checkGenerated(au, raw, rawLegacy) {
  const built = buildCatalog(raw);
  const v = validateCatalog(built, raw);
  for (const e of v.errors) au.find('error', 'EXPORT_VALIDATION', { source: P.index, evidence: 'scripts/lib/headless-catalog.cjs validateCatalog' }, e);
  for (const w of v.warnings) au.find('warning', 'EXPORT_VALIDATION', { source: P.index, evidence: 'scripts/lib/headless-catalog.cjs validateCatalog' }, w);
  const expected = stableStringify(built);
  const exportText = readText(au.root, P.export);
  if (exportText != null && exportText !== expected) au.find('error', 'EXPORT_STALE', { source: P.export, evidence: `sha256 ${sha256(exportText).slice(0, 12)} ≠ rebuilt ${sha256(expected).slice(0, 12)}` }, 'headless/catalog/catalog.v1.json is not what export-headless-catalog.cjs builds from index.html: run it');
  const snap = readText(au.root, P.snapshot);
  if (snap != null && exportText != null && snap !== exportText) au.find('error', 'SNAPSHOT_STALE', { source: P.snapshot, evidence: `sha256 ${sha256(snap).slice(0, 12)} ≠ export ${sha256(exportText).slice(0, 12)}` }, 'the site snapshot differs from the authoritative export: run npm run refresh:catalog');
  const snapSha = readText(au.root, P.snapshotSha);
  if (snap != null && snapSha != null && snapSha.trim().split(/\s+/)[0] !== sha256(snap)) au.find('error', 'SNAPSHOT_SHA', { source: P.snapshotSha, evidence: snapSha.trim().slice(0, 16) }, 'catalog.v1.json.sha256 does not match the snapshot bytes');

  // the site renders catalog.v1.json: compare it with index.html topic by topic
  if (snap != null) {
    const site = JSON.parse(snap);
    for (const g of site.grades || []) {
      const gd = raw.DATA[g.grade];
      if (!gd) {
        au.find('error', 'SITE_GRADE_UNKNOWN', { grade: g.grade, source: P.snapshot }, 'grade shown on the site is not in index.html');
        continue;
      }
      const src = new Map(gd.topics.map((t) => [t.id, t]));
      for (const t of g.topics) {
        const s = src.get(t.id);
        if (!s) {
          au.find('error', 'SITE_TOPIC_UNKNOWN', { grade: g.grade, topicId: t.id, subject: t.title, source: P.snapshot }, 'topic shown on the site is not in index.html');
          continue;
        }
        if (s.t !== t.title) au.find('error', 'SITE_TITLE_DRIFT', { grade: g.grade, topicId: t.id, subject: t.title, source: P.snapshot, evidence: `index.html: "${s.t}"` }, 'site catalog title differs from index.html');
        const row = gd.links[t.id] || {};
        for (const l of t.levels) {
          if (row[l.key] !== l.pdfId) au.find('error', 'SITE_PDF_DRIFT', { grade: g.grade, topicId: t.id, level: l.key, pdfId: l.pdfId, source: P.snapshot, evidence: `index.html: ${row[l.key] || '(none)'}` }, 'site catalog links a different PDF than index.html');
        }
      }
      for (const s of gd.topics) if (!g.topics.some((t) => t.id === s.id)) au.find('error', 'SITE_TOPIC_MISSING', { grade: g.grade, topicId: s.id, subject: s.t, source: P.snapshot }, 'topic in index.html is missing from the site catalog');
    }
  }

  // legacy GitHub copy of index.html
  if (rawLegacy) {
    if (stableStringify(rawLegacy.DATA) !== stableStringify(raw.DATA)) au.find('warning', 'LEGACY_COPY_DRIFT', { source: P.legacyIndex, evidence: 'DATA differs' }, 'public/legacy-github/index.html carries a different catalog than index.html: run npm run sync:static');
  }

  // learning catalog (built by scripts/build-learning-catalog.cjs)
  const { items, learningText, seedText } = learningOutputs(raw);
  for (const rel of [P.learning, P.learningPublic]) {
    const text = readText(au.root, rel);
    if (text != null && text !== learningText) au.find('error', 'LEARNING_CATALOG_STALE', { source: rel, evidence: describeLearningDiff(text, items) }, `${rel} is not what build-learning-catalog.cjs writes from index.html`);
  }
  const seed = readText(au.root, P.seed);
  if (seed != null && seed !== seedText) au.find('error', 'LEARNING_SEED_STALE', { source: P.seed }, 'learning/catalog-seed.sql is not what build-learning-catalog.cjs writes from index.html');
  au.coverage.learningItems = items.length;
}

/** What scripts/build-learning-catalog.cjs writes for this index.html (same algorithm, in memory). */
function learningOutputs(raw) {
  const items = [];
  for (const [g, data] of Object.entries(raw.DATA)) {
    for (const t of data.topics) {
      const row = data.links[t.id] || {};
      for (const l of ['a', 'b', 'c', 'one']) {
        if (!row[l]) continue;
        items.push({
          id: `g${g}-t${t.id}-${l}`,
          g: Number(g),
          t: t.id,
          parent: t.parent || t.id,
          title: t.t,
          l,
          label: l === 'one' ? row.oneLabel || 'כל הרמות' : t[l + 'Label'] || { a: 'רמה א׳', b: 'רמה ב׳', c: 'מצוינות' }[l],
          pdf: row[l],
          x: t.x || (raw.NOAM_PREFIX_FALLBACK[g] || {})[t.id] || '',
        });
      }
    }
  }
  const learningText = '/* Generated from index.html; do not edit by hand. */\nwindow.NOAM_LEARNING_CATALOG=' + JSON.stringify(items) + ';\n';
  const seedText = 'insert into public.noam_learning_worksheets (worksheet_id) values\n' + items.map((x) => "('" + x.id + "')").join(',\n') + '\non conflict do nothing;\n';
  return { items, learningText, seedText };
}

function describeLearningDiff(text, items) {
  const m = /window\.NOAM_LEARNING_CATALOG=(\[.*\]);/s.exec(text);
  if (!m) return 'unparseable';
  let have;
  try {
    have = JSON.parse(m[1]);
  } catch {
    return 'unparseable';
  }
  const H = new Map(have.map((x) => [x.id, x]));
  const E = new Map(items.map((x) => [x.id, x]));
  const missing = [...E.keys()].filter((k) => !H.has(k));
  const extra = [...H.keys()].filter((k) => !E.has(k));
  const changed = [...E.keys()].filter((k) => H.has(k) && JSON.stringify(H.get(k)) !== JSON.stringify(E.get(k)));
  return `missing ${missing.length}, extra ${extra.length}, changed ${changed.length}${changed.length ? ' e.g. ' + changed.slice(0, 3).join(' ') : ''}`;
}

/** Approved middle-school mapping fixture: every approved PDF must still be where it was approved. */
function checkMiddleFixture(au, raw) {
  const fx = readJson(au.root, P.middleFixture);
  if (!fx) return;
  let n = 0;
  for (const [g, topics] of Object.entries(fx.grades || {})) {
    for (const t of topics) {
      for (const [lv, id] of Object.entries(t.links || {})) {
        n++;
        const now = (raw.DATA[g]?.links?.[t.id] || {})[lv];
        if (now !== id) au.find('error', 'APPROVED_MAPPING_CHANGED', { grade: g, topicId: t.id, level: lv, pdfId: id, subject: t.title, source: P.middleFixture, evidence: `index.html now: ${now || '(none)'}` }, 'an approved middle-school level no longer links its approved PDF');
      }
    }
  }
  au.coverage.approvedMiddleLevels = n;
}

/** Viewer manifests (derived from each PDF by the Noam AI pipeline): grade/topic/level must agree. */
function checkManifests(au, raw, pdfOwners) {
  const names = listJson(au.root, P.manifests);
  if (!names) return;
  const manifests = new Map();
  for (const f of names) {
    let m;
    try {
      m = JSON.parse(fs.readFileSync(path.join(au.root, P.manifests, f), 'utf8'));
    } catch (e) {
      au.find('error', 'MANIFEST_UNREADABLE', { source: `${P.manifests}/${f}` }, String(e.message));
      continue;
    }
    if (`${m.pdfHash}.json` !== f) au.find('error', 'MANIFEST_NAME', { pdfId: m.pdfHash, source: `${P.manifests}/${f}` }, 'manifest file name and pdfHash differ');
    manifests.set(m.pdfHash, m);
  }
  const middle = new Set((raw.MIDDLE || []).map(Number));
  let matched = 0;
  for (const [id, owners] of [...pdfOwners.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    for (const o of owners) {
      if (!middle.has(o.grade)) continue; // elementary sheets open as plain PDFs; no viewer manifest
      const m = manifests.get(id);
      const src = `${P.manifests}/${id}.json`;
      if (!m) {
        au.find('error', 'MANIFEST_MISSING', { grade: o.grade, topicId: o.topicId, level: o.level, pdfId: id, subject: o.title, source: src }, 'middle-school PDF has no viewer manifest (Noam AI help cannot open it)');
        continue;
      }
      matched++;
      const diffs = [];
      if (m.grade !== o.grade) diffs.push(`grade ${m.grade}`);
      if (m.topicId !== o.topicId) diffs.push(`topicId ${m.topicId}`);
      const ml = String(m.level || '').toLowerCase();
      if (o.level !== 'one' && ml !== o.level) diffs.push(`level ${m.level}`);
      au.relate('pdf→manifest', { grade: m.grade, topicId: m.topicId, topicTitle: m.topic, level: ml, pdfId: id, target: `${m.prefix} pages ${m.pageCount}`, source: src, evidence: `pdfHash ${m.pdfHash}; sourceSha256 ${m.sourceSha256 || '(none)'}` });
      if (diffs.length) au.find('error', 'MANIFEST_MISMATCH', { grade: o.grade, topicId: o.topicId, level: o.level, pdfId: id, subject: o.title, source: src, evidence: `manifest: ${diffs.join(', ')} "${m.topic}"` }, 'the PDF\'s manifest was made for another grade/topic/level');
      else if (similarity(m.topic, o.title) < 0.5) au.find('review', 'MANIFEST_TITLE_DIFFERS', { grade: o.grade, topicId: o.topicId, level: o.level, pdfId: id, subject: o.title, source: src, evidence: `manifest topic "${m.topic}"` }, 'catalog title and the title the manifest was built with differ');
      if (m.reviewRequired) au.find('info', 'MANIFEST_REVIEW_REQUIRED', { grade: o.grade, topicId: o.topicId, level: o.level, pdfId: id, source: src, evidence: (m.issues || []).join('; ').slice(0, 200) }, 'the PDF parser flagged this sheet for review');
    }
  }
  const orphans = [...manifests.keys()].filter((id) => !pdfOwners.has(id)).sort();
  if (orphans.length) au.find('info', 'MANIFEST_ORPHANS', { source: P.manifests, evidence: orphans.slice(0, 10).join(' ') + (orphans.length > 10 ? ' …' : '') }, `${orphans.length} manifests describe PDFs that no catalog level links (older versions or aliases)`);
  // Headless copies must be byte-identical to the canonical ones
  const pub = listJson(au.root, P.manifestsPublic) || [];
  let drift = 0;
  for (const f of pub) {
    const a = readText(au.root, `${P.manifestsPublic}/${f}`);
    const b = readText(au.root, `${P.manifests}/${f}`);
    if (b == null || a !== b) drift++;
  }
  if (drift) au.find('warning', 'MANIFEST_COPY_DRIFT', { source: P.manifestsPublic, evidence: `${drift} of ${pub.length}` }, 'Headless manifest copies differ from noam-ai/manifests: run npm run sync:static');
  au.coverage.manifests = manifests.size;
  au.coverage.manifestsMatchedToCatalog = matched;
  au.coverage.manifestOrphans = orphans.length;
}

/** Paths the site can serve, for link checks. */
function knownPaths(au) {
  const paths = new Set(['/', '/worksheets', '/blog', '/learning.html']);
  for (const [rel, key] of [
    [P.topicPages, 'path'],
    [P.blogPosts, 'path'],
    [P.gradeHubs, 'path'],
  ]) {
    for (const f of listJson(au.root, rel) || []) {
      const d = JSON.parse(fs.readFileSync(path.join(au.root, rel, f), 'utf8'));
      if (d[key]) {
        paths.add(d[key]);
        try {
          paths.add(decodeURIComponent(d[key]));
        } catch {
          /* keep encoded only */
        }
      }
    }
  }
  const pagesDir = path.join(au.root, P.pages);
  if (fs.existsSync(pagesDir)) {
    for (const f of fs.readdirSync(pagesDir)) {
      const m = /^([^[].*)\.(astro|ts)$/.exec(f);
      if (m && m[1] !== 'index') paths.add('/' + m[1].replace(/\.xml$/, '.xml'));
    }
  }
  const sp = path.join(au.root, P.sitePages);
  if (fs.existsSync(sp)) {
    for (const f of fs.readdirSync(sp).filter((x) => x.endsWith('.json'))) paths.add('/' + f.replace(/\.json$/, ''));
  }
  const redirects = readJson(au.root, P.redirects);
  const rules = redirects && (Array.isArray(redirects) ? redirects : redirects.rules || redirects.redirects);
  for (const r of Array.isArray(rules) ? rules : []) if (r && (r.from || r.source)) paths.add(r.from || r.source);
  return paths;
}

/** Topic pages → catalog topic, and every internal link in pages, posts and hubs. */
function checkPages(au, raw, topicsByGrade) {
  const paths = knownPaths(au);
  const topicPagePaths = new Set((listJson(au.root, P.topicPages) || []).map((f) => JSON.parse(fs.readFileSync(path.join(au.root, P.topicPages, f), 'utf8')).path));
  const topicOf = (g, t) => topicsByGrade.get(Number(g))?.get(Number(t));
  let pages = 0;
  let links = 0;

  const checkHref = (href, from, source, evidence) => {
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return;
    links++;
    const u = new URL(href, 'https://site.invalid');
    if (u.pathname === '/worksheets') {
      const g = u.searchParams.get('grade');
      const t = u.searchParams.get('topic');
      const grp = u.searchParams.get('group');
      if (g && !topicsByGrade.has(Number(g))) au.find('error', 'LINK_GRADE_MISSING', { grade: g, subject: from, source, evidence: `${evidence}: ${href}` }, 'link to a grade the catalog does not have');
      else if (g && t && !topicOf(g, t)) au.find('error', 'LINK_TOPIC_MISSING', { grade: g, topicId: t, subject: from, source, evidence: `${evidence}: ${href}` }, 'link to a catalog topic that does not exist');
      else if (g && grp && !(raw.DATA[g]?.groups || []).some((x) => x.key === grp)) au.find('error', 'LINK_GROUP_MISSING', { grade: g, subject: from, source, evidence: `${evidence}: ${href}` }, 'link to a catalog group that does not exist');
      else if (g && t) {
        const topic = topicOf(g, t);
        au.relate('page→catalog topic', { grade: g, topicId: t, topicTitle: topic.t, target: from, source, evidence: `${evidence}: ${href}` });
      }
      return;
    }
    let p = u.pathname.replace(/\/$/, '') || '/';
    try {
      p = decodeURIComponent(p);
    } catch {
      /* as is */
    }
    if (!paths.has(p) && !paths.has(u.pathname)) au.find('error', 'LINK_TARGET_MISSING', { subject: from, source, evidence: `${evidence}: ${href}` }, 'internal link has no page behind it');
    else if (topicPagePaths.has(p) && p !== from) au.relate('page→topic page', { target: p, topicTitle: from, source, evidence });
  };

  const walk = (node, visit, trail = '') => {
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, visit, `${trail}[${i}]`));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) {
      if ((k === 'href' || k === 'path') && typeof v === 'string') visit(v, `${trail}.${k}`);
      else walk(v, visit, `${trail}.${k}`);
    }
  };

  for (const f of listJson(au.root, P.topicPages) || []) {
    const rel = `${P.topicPages}/${f}`;
    const page = JSON.parse(fs.readFileSync(path.join(au.root, rel), 'utf8'));
    pages++;
    const ctas = [page.catalogCta, ...(page.catalogCtas || [])].filter(Boolean);
    const seen = new Set();
    const fits = [];
    for (const [i, cta] of ctas.entries()) {
      const ev = i === 0 ? 'catalogCta' : `catalogCtas[${i - 1}]`;
      const key = `${cta.href}|${cta.catalogTopicId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const u = cta.href ? new URL(cta.href, 'https://site.invalid') : null;
      const hrefGrade = u && Number(u.searchParams.get('grade'));
      const hrefTopic = u && u.searchParams.get('topic') != null ? Number(u.searchParams.get('topic')) : null;
      const tid = cta.catalogTopicId;
      if (tid == null) continue;
      const topic = topicOf(page.grade, tid);
      if (hrefGrade && hrefGrade !== page.grade) au.find('error', 'PAGE_CTA_GRADE', { grade: page.grade, topicId: tid, subject: page.path, source: rel, evidence: `${ev}.href ${cta.href}` }, `topic page for grade ${page.grade} sends to grade ${hrefGrade}`);
      if (hrefTopic != null && hrefTopic !== tid) au.find('error', 'PAGE_CTA_HREF_TOPIC', { grade: page.grade, topicId: tid, subject: page.path, source: rel, evidence: `${ev}.href ${cta.href} vs catalogTopicId ${tid}` }, 'CTA link and its catalogTopicId name different topics');
      if (!topic) {
        au.find('error', 'PAGE_CTA_TOPIC_MISSING', { grade: page.grade, topicId: tid, subject: page.path, source: rel, evidence: ev }, 'topic page links a catalog topic that does not exist');
        continue;
      }
      au.relate('topic page→catalog topic', { grade: page.grade, topicId: tid, topicTitle: topic.t, target: page.path, source: rel, evidence: `${ev} (${cta.source || 'no source'}) ${cta.href || ''}` });
      if (cta.catalogTopicTitle && cta.catalogTopicTitle !== topic.t) au.find('warning', 'PAGE_CTA_TITLE_DRIFT', { grade: page.grade, topicId: tid, subject: page.path, source: rel, evidence: `${ev}.catalogTopicTitle "${cta.catalogTopicTitle}" vs catalog "${topic.t}"` }, 'the topic title recorded on the page no longer matches the catalog');
      fits.push({ tid, topic, primary: i === 0, fit: Math.max(similarity(page.h1, topic.t), similarity(page.h1, `${topic.t} ${topic.d || ''}`) * 0.9) });
    }
    const primary = fits.find((f) => f.primary);
    const best = fits.reduce((b, f) => (!b || f.fit > b.fit ? f : b), null);
    if (primary && best && best.fit < 0.5) {
      au.find('review', 'PAGE_TOPIC_FIT', { grade: page.grade, topicId: primary.tid, subject: page.path, source: rel, evidence: `h1 "${page.h1}"; linked: ${fits.map((f) => `${f.tid} "${f.topic.t}" ${f.fit.toFixed(2)}`).join(', ')}` }, 'none of the worksheet topics this page links matches the page\'s subject');
    } else if (primary && best && primary.fit < 0.5 && best.tid !== primary.tid) {
      au.find('review', 'PAGE_PRIMARY_CTA', { grade: page.grade, topicId: primary.tid, subject: page.path, source: rel, evidence: `h1 "${page.h1}"; main button ${primary.tid} "${primary.topic.t}" ${primary.fit.toFixed(2)}; better: ${best.tid} "${best.topic.t}" ${best.fit.toFixed(2)}` }, 'the main worksheet button goes to a weaker match than another topic the page links');
    }
    walk(page, (href, trail) => checkHref(href, page.path, rel, trail));
  }
  for (const [dir, label] of [
    [P.blogPosts, 'post'],
    [P.gradeHubs, 'hub'],
  ]) {
    for (const f of listJson(au.root, dir) || []) {
      const rel = `${dir}/${f}`;
      const d = JSON.parse(fs.readFileSync(path.join(au.root, rel), 'utf8'));
      walk(d, (href, trail) => checkHref(href, d.path || `${label} ${f}`, rel, trail));
    }
  }
  au.coverage.topicPages = pages;
  au.coverage.internalLinksChecked = links;
}

// ───────────────────────────── PDFs ─────────────────────────────

/** Count pages and pull simple text out of a PDF (uncompressed or Flate streams, literal strings). */
function inspectPdf(buf) {
  const head = buf.subarray(0, 1024).toString('latin1');
  if (!head.startsWith('%PDF-')) {
    const html = /<(!doctype|html|head|body)\b/i.test(head);
    return { isPdf: false, kind: html ? 'html' : 'other', head: head.slice(0, 80).replace(/\s+/g, ' ') };
  }
  const chunks = [buf.toString('latin1')];
  const re = /stream\r?\n/g;
  const raw = chunks[0];
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const body = buf.subarray(start, end);
    try {
      chunks.push(zlib.inflateSync(body).toString('latin1'));
    } catch {
      /* not Flate or not compressed */
    }
    re.lastIndex = end;
  }
  const all = chunks.join('\n');
  const pages = (all.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
  const strings = [];
  for (const s of all.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:\([^)]*\)|[^\]])*)\]\s*TJ/g)) {
    if (s[1] != null) strings.push(s[1]);
    else strings.push([...s[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((x) => x[1]).join(''));
  }
  const text = strings.join(' ').replace(/\\([()\\])/g, '$1').replace(/\s+/g, ' ').trim();
  const printable = text && /^[\x20-\x7E֐-׿]+$/.test(text);
  return { isPdf: true, pages, text: printable ? text : '', textNote: printable ? 'extracted' : 'not extractable without a PDF text engine (embedded/CID fonts)' };
}

async function fetchPdf(url, { timeoutMs, fetchImpl }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { redirect: 'follow', signal: ctl.signal });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, buf, contentType: res.headers.get('content-type') || '' };
  } catch (e) {
    const cause = e && (e.cause?.code || e.code || e.name || '');
    return { status: 0, error: `${cause} ${String(e.message || e)}`.trim() };
  } finally {
    clearTimeout(timer);
  }
}

async function checkPdfs(au, raw, pdfOwners, opts) {
  const ids = [...pdfOwners.keys()].sort();
  const results = new Map();
  const counts = { verified: 0, mismatch: 0, failed: 0, unverified: 0 };
  const selected = opts.pdf === 'network' ? ids.slice(0, opts.pdfLimit || ids.length) : [];
  const base = opts.pdfBase || raw.BASE;
  let next = 0;
  const work = async () => {
    while (next < selected.length) {
      const id = selected[next++];
      const url = `${base}${id}.pdf`;
      const r = await fetchPdf(url, { timeoutMs: opts.pdfTimeoutMs, fetchImpl: opts.fetchImpl });
      results.set(id, { url, ...r });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, work));

  for (const id of ids) {
    const owners = pdfOwners.get(id);
    const o = owners[0];
    const r = results.get(id);
    const where = { grade: o.grade, topicId: o.topicId, level: o.level, pdfId: id, subject: o.title, source: P.index };
    let status;
    let detail;
    if (!r) {
      status = 'unverified';
      detail = opts.pdf === 'network' ? 'not fetched (--pdf-limit)' : 'offline run (use --pdf network)';
    } else if (r.status === 0) {
      status = 'unverified';
      detail = `no access: ${r.error}`;
    } else if (r.status === 404 || r.status === 410) {
      status = 'failed';
      detail = `HTTP ${r.status}`;
      au.find('error', 'PDF_MISSING', { ...where, evidence: r.url }, `the linked PDF does not exist (HTTP ${r.status})`);
    } else if (r.status !== 200) {
      status = 'unverified';
      detail = `no access: HTTP ${r.status}`;
    } else {
      const info = inspectPdf(r.buf);
      if (!info.isPdf) {
        status = 'failed';
        detail = `not a PDF (${info.kind}: ${info.head})`;
        au.find('error', 'PDF_NOT_PDF', { ...where, evidence: `${r.url} content-type ${r.contentType}` }, `the link returns ${info.kind === 'html' ? 'an HTML page' : 'something else'}, not a PDF`);
      } else {
        const checks = [`pages ${info.pages || '?'}`];
        let bad = false;
        if (!info.pages) au.find('warning', 'PDF_NO_PAGES', { ...where, evidence: r.url }, 'PDF signature present but no page found');
        if (info.text) {
          const gm = info.text.match(/(?:כיתה|לכיתה|grade)\s*([א-ט]|\d)/i);
          if (gm) {
            const g = /\d/.test(gm[1]) ? Number(gm[1]) : Number(Object.keys(HEB_GRADE).find((k) => HEB_GRADE[k] === gm[1]));
            if (g && !owners.some((x) => x.grade === g)) {
              bad = true;
              au.find('error', 'PDF_GRADE_MISMATCH', { ...where, evidence: `PDF text "${gm[0]}"` }, `the PDF says grade ${g}, the catalog links it from grade ${o.grade}`);
            }
            checks.push(`grade text "${gm[0]}"`);
          }
          const fit = Math.max(...owners.map((x) => similarity(info.text.slice(0, 400), x.title)));
          if (fit < 0.34) {
            bad = true;
            au.find('review', 'PDF_TITLE_MISMATCH', { ...where, evidence: `PDF text "${info.text.slice(0, 120)}"` }, 'the PDF text does not name the catalog topic');
          }
          checks.push(`title overlap ${fit.toFixed(2)}`);
        } else checks.push(info.textNote);
        status = bad ? 'mismatch' : 'verified';
        detail = checks.join('; ');
      }
    }
    counts[status]++;
    for (const w of owners) au.relate('pdf check', { grade: w.grade, topicId: w.topicId, topicTitle: w.title, level: w.level, pdfId: id, target: status, source: r ? r.url : `${base}${id}.pdf`, evidence: detail });
  }
  au.coverage.pdf = { mode: opts.pdf, total: ids.length, ...counts };
  if (counts.unverified) au.find('info', 'PDF_UNVERIFIED', { source: P.index, evidence: opts.pdf === 'network' ? 'see relations.csv rows "pdf check"' : 'offline run' }, `${counts.unverified} of ${ids.length} PDFs not verified (no access or not fetched): their existence, PDF signature, pages and titles are unknown`);
}

// ───────────────────────────── run + output ─────────────────────────────

async function runAudit(options = {}) {
  const opts = { root: process.cwd(), pdf: 'off', pdfTimeoutMs: 20000, fetchImpl: globalThis.fetch, ...options };
  const au = new Audit(path.resolve(opts.root));
  if (!au.input(P.index, true)) return finish(au);
  for (const k of ['legacyIndex', 'export', 'snapshot', 'snapshotSha', 'learning', 'learningPublic', 'seed', 'middleFixture', 'manifests', 'manifestsPublic', 'topicPages', 'blogPosts', 'gradeHubs']) au.input(P[k], false);

  const raw = loadIndexCatalog(path.join(au.root, P.index));
  let rawLegacy = null;
  if (fs.existsSync(path.join(au.root, P.legacyIndex))) {
    try {
      rawLegacy = loadIndexCatalog(path.join(au.root, P.legacyIndex));
    } catch (e) {
      au.find('warning', 'LEGACY_COPY_UNREADABLE', { source: P.legacyIndex }, String(e.message));
    }
  }
  const { topicsByGrade, pdfOwners } = checkIndexData(au, raw);
  checkTitles(au, topicsByGrade);
  checkGenerated(au, raw, rawLegacy);
  checkMiddleFixture(au, raw);
  checkManifests(au, raw, pdfOwners);
  checkPages(au, raw, topicsByGrade);
  await checkPdfs(au, raw, pdfOwners, opts);
  return finish(au);
}

function finish(au) {
  const sevRank = (s) => SEVERITIES.indexOf(s);
  const key = (f) => [sevRank(f.severity), f.code, String(f.grade).padStart(2, '0'), String(f.topicId).padStart(4, '0'), f.level, f.pdfId, f.subject, f.evidence, f.message].join('\u0000');
  au.findings.sort((a, b) => cmp(key(a), key(b)));
  const rkey = (r) => [r.relation, String(r.grade).padStart(2, '0'), String(r.topicId).padStart(4, '0'), String(LEVEL_ORDER[r.level] ?? 9), r.pdfId, r.target, r.source, r.evidence].join('\u0000');
  au.relations.sort((a, b) => cmp(rkey(a), rkey(b)));
  au.inputs.sort((a, b) => cmp(a.path, b.path));
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, au.findings.filter((f) => f.severity === s).length]));
  const byCode = {};
  for (const f of au.findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  return {
    tool: 'catalog-audit',
    version: 1,
    inputs: au.inputs,
    coverage: au.coverage,
    summary: { bySeverity, byCode: Object.fromEntries(Object.entries(byCode).sort((a, b) => cmp(a[0], b[0]))) },
    findings: au.findings,
    relations: au.relations,
  };
}

function renderReport(result) {
  const s = result.summary.bySeverity;
  const label = { error: 'שגיאה', warning: 'אזהרה', review: 'לבדיקת אדם', info: 'מידע' };
  const lines = [];
  lines.push('# בקרת איכות: קטלוג, דפי נושא ודפי עבודה', '');
  lines.push(`שגיאות ${s.error} · אזהרות ${s.warning} · לבדיקה ${s.review} · מידע ${s.info}`, '');
  lines.push('## כיסוי', '');
  const cov = result.coverage;
  for (const [k, v] of Object.entries(cov)) lines.push(`- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  lines.push('', '## קלטים', '');
  for (const i of result.inputs) lines.push(`- ${i.present ? '✓' : '✗'} \`${i.path}\`${i.sha256 ? ' `' + i.sha256.slice(0, 12) + '`' : ''}`);
  for (const sev of SEVERITIES) {
    const list = result.findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    lines.push('', `## ${label[sev]} (${list.length})`, '');
    const byCode = new Map();
    for (const f of list) {
      if (!byCode.has(f.code)) byCode.set(f.code, []);
      byCode.get(f.code).push(f);
    }
    for (const [code, fs2] of byCode) {
      lines.push(`### ${code} (${fs2.length})`, '');
      for (const f of fs2.slice(0, 60)) {
        const where = [f.grade && `כיתה ${f.grade}`, f.topicId !== '' && `נושא ${f.topicId}`, f.level && `רמה ${f.level}`, f.pdfId && `PDF ${String(f.pdfId).slice(0, 8)}`].filter(Boolean).join(' · ');
        lines.push(`- ${where ? where + ' — ' : ''}${f.subject ? '«' + f.subject + '» — ' : ''}${f.message}${f.evidence ? ` _(${f.evidence})_` : ''} \`${f.source}\``);
      }
      if (fs2.length > 60) lines.push(`- … ועוד ${fs2.length - 60} (ראו findings.csv)`);
      lines.push('');
    }
  }
  return lines.join('\n') + '\n';
}

function writeOutputs(result, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(result));
  fs.writeFileSync(
    path.join(outDir, 'findings.csv'),
    toCsv(
      ['severity', 'code', 'grade', 'topic_id', 'level', 'pdf_id', 'subject', 'message', 'source_file', 'evidence'],
      result.findings.map((f) => [f.severity, f.code, f.grade, f.topicId, f.level, f.pdfId, f.subject, f.message, f.source, f.evidence])
    )
  );
  fs.writeFileSync(
    path.join(outDir, 'relations.csv'),
    toCsv(
      ['relation', 'grade', 'topic_id', 'topic_title', 'level', 'pdf_id', 'target', 'source_file', 'evidence'],
      result.relations.map((r) => [r.relation, r.grade, r.topicId, r.topicTitle, r.level, r.pdfId, r.target, r.source, r.evidence])
    )
  );
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), out: 'catalog-audit-report', pdf: 'off', failOn: 'error' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--root') opts.root = v();
    else if (a === '--out') opts.out = v();
    else if (a === '--pdf') opts.pdf = v();
    else if (a === '--pdf-base') opts.pdfBase = v();
    else if (a === '--pdf-limit') opts.pdfLimit = Number(v());
    else if (a === '--pdf-timeout') opts.pdfTimeoutMs = Number(v());
    else if (a === '--fail-on') opts.failOn = v();
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!['off', 'network'].includes(opts.pdf)) throw new Error('--pdf must be off or network');
  if (!SEVERITIES.includes(opts.failOn)) throw new Error('--fail-on must be ' + SEVERITIES.join('|'));
  return opts;
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(String(e.message));
    return 2;
  }
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return 0;
  }
  let result;
  try {
    result = await runAudit(opts);
  } catch (e) {
    console.error('catalog-audit could not run:', e && e.stack ? e.stack : e);
    return 2;
  }
  const out = path.resolve(opts.out);
  writeOutputs(result, out);
  const s = result.summary.bySeverity;
  console.log(`catalog-audit: ${s.error} errors, ${s.warning} warnings, ${s.review} to review, ${s.info} info → ${path.relative(process.cwd(), out) || '.'}/report.md`);
  const limit = SEVERITIES.indexOf(opts.failOn);
  const failing = SEVERITIES.slice(0, limit + 1).reduce((n, sev) => n + s[sev], 0);
  return failing ? 1 : 0;
}

module.exports = { runAudit, writeOutputs, renderReport, inspectPdf, similarity, learningOutputs, parseArgs, main, PATHS: P };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
