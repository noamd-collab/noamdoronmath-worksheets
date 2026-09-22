'use strict';

/**
 * Shared helpers for Phase 0 headless catalog export.
 * Source of truth remains index.html — this module only reads it.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'headless', 'catalog');
const OUT_JSON = path.join(OUT_DIR, 'catalog.v1.json');
const CONTRACT_VERSION = 1;

/** Default one-level button label from index.html levelLinksHTML (row.oneLabel || …). */
const DEFAULT_ONE_LABEL = 'דף יחיד — כל הרמות';

const LEVEL_KEYS = ['a', 'b', 'c'];

function extractBraceBlock(text, varName, openChar, closeChar) {
  const re = new RegExp('var\\s+' + varName + '\\s*=\\s*\\' + openChar);
  const startMatch = re.exec(text);
  if (!startMatch) throw new Error('Missing declaration: var ' + varName);
  const braceStart = startMatch.index + startMatch[0].length - 1;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    const c = text[i];
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return text.slice(startMatch.index, i + 1) + ';';
    }
  }
  throw new Error('Unbalanced braces for ' + varName);
}

function extractObject(text, varName) {
  return extractBraceBlock(text, varName, '{', '}');
}

function extractArray(text, varName) {
  return extractBraceBlock(text, varName, '[', ']');
}

function extractStringAssign(text, varName) {
  const re = new RegExp('var\\s+' + varName + '\\s*=\\s*("(?:\\\\.|[^"\\\\])*")\\s*;');
  const m = re.exec(text);
  if (!m) throw new Error('Missing string assignment: var ' + varName);
  return 'var ' + varName + ' = ' + m[1] + ';';
}

/**
 * Load catalog-related declarations from index.html into a plain object.
 * Does not execute UI code — only data/config blocks needed for the contract.
 */
function loadIndexCatalog(indexPath) {
  const html = fs.readFileSync(indexPath || INDEX_PATH, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No <script> block in index.html');
  const script = scriptMatch[1];

  const slice = [
    extractStringAssign(script, 'BASE'),
    extractObject(script, 'VIEWER'),
    extractObject(script, 'NOAM_PREFIX_FALLBACK'),
    extractObject(script, 'DATA'),
    extractObject(script, 'GRADE_EMOJI'),
    extractObject(script, 'GRADE_NAME'),
    extractArray(script, 'ELEMENTARY'),
    extractArray(script, 'MIDDLE'),
    extractArray(script, 'LEVELS'),
    extractObject(script, 'ICONS'),
    extractObject(script, 'TRACK_GROUPS'),
    extractObject(script, 'SEARCH_TERMS'),
  ].join('\n');

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(slice, sandbox, { filename: 'index-catalog-slice.js' });

  return {
    html,
    script,
    BASE: sandbox.BASE,
    VIEWER: cloneJson(sandbox.VIEWER),
    NOAM_PREFIX_FALLBACK: cloneJson(sandbox.NOAM_PREFIX_FALLBACK),
    DATA: cloneJson(sandbox.DATA),
    GRADE_EMOJI: cloneJson(sandbox.GRADE_EMOJI),
    GRADE_NAME: cloneJson(sandbox.GRADE_NAME),
    ELEMENTARY: cloneJson(sandbox.ELEMENTARY),
    MIDDLE: cloneJson(sandbox.MIDDLE),
    LEVELS: cloneJson(sandbox.LEVELS),
    ICONS: cloneJson(sandbox.ICONS),
    TRACK_GROUPS: cloneJson(sandbox.TRACK_GROUPS),
    SEARCH_TERMS: cloneJson(sandbox.SEARCH_TERMS),
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function numKeySort(a, b) {
  return Number(a) - Number(b);
}

/** Shape-aware key orders so nested records stay readable while remaining deterministic. */
const ORDERS = {
  root: [
    'contractVersion',
    'sourceOfTruth',
    'config',
    'icons',
    'searchTerms',
    'grades',
  ],
  sourceOfTruth: ['path', 'authoritative', 'note'],
  config: [
    'pdfBase',
    'viewer',
    'levels',
    'defaults',
    'elementaryGrades',
    'middleGrades',
    'gradeNames',
    'gradeEmojis',
    'trackGroups',
    'noamPrefixFallback',
  ],
  viewer: ['enabled', 'path'],
  defaults: ['oneLabel'],
  levelDefault: ['key', 'label', 'cssClass'],
  grade: ['grade', 'label', 'emoji', 'groups', 'topics'],
  group: ['key', 'label', 'reducedProgram'],
  topic: [
    'id',
    'title',
    'description',
    'note',
    'group',
    'icon',
    'parent',
    'noamTopicId',
    'levels',
    'routing',
  ],
  level: ['key', 'label', 'pdfId', 'labelSource'],
  routing: [
    'resolvedNoamPrefix',
    'aiHintShown',
    'usesViewer',
    'viewerPath',
    'siblingPdfQuery',
  ],
};

function orderFor(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'contractVersion')) return ORDERS.root;
  if (Object.prototype.hasOwnProperty.call(value, 'authoritative')) return ORDERS.sourceOfTruth;
  if (Object.prototype.hasOwnProperty.call(value, 'pdfBase')) return ORDERS.config;
  if (
    Object.prototype.hasOwnProperty.call(value, 'enabled') &&
    Object.prototype.hasOwnProperty.call(value, 'path') &&
    Object.keys(value).length <= 2
  ) {
    return ORDERS.viewer;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'oneLabel') && Object.keys(value).length === 1) {
    return ORDERS.defaults;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'cssClass') &&
    Object.prototype.hasOwnProperty.call(value, 'key')
  ) {
    return ORDERS.levelDefault;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'grade') &&
    Object.prototype.hasOwnProperty.call(value, 'topics')
  ) {
    return ORDERS.grade;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'reducedProgram') &&
    Object.prototype.hasOwnProperty.call(value, 'key')
  ) {
    return ORDERS.group;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'routing') &&
    Object.prototype.hasOwnProperty.call(value, 'id')
  ) {
    return ORDERS.topic;
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'pdfId') &&
    Object.prototype.hasOwnProperty.call(value, 'labelSource')
  ) {
    return ORDERS.level;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'resolvedNoamPrefix')) return ORDERS.routing;
  return null;
}

function stableStringify(value) {
  return JSON.stringify(value, stableReplacer, 2) + '\n';
}

function stableReplacer(_key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const preferred = orderFor(value);
  const keys = Object.keys(value);
  keys.sort((a, b) => compareKeys(a, b, preferred));
  const sorted = {};
  for (const k of keys) sorted[k] = value[k];
  return sorted;
}

function compareKeys(a, b, preferred) {
  if (preferred) {
    const ra = preferred.indexOf(a);
    const rb = preferred.indexOf(b);
    if (ra !== -1 && rb !== -1 && ra !== rb) return ra - rb;
    if (ra !== -1 && rb === -1) return -1;
    if (ra === -1 && rb !== -1) return 1;
  }

  const na = Number(a);
  const nb = Number(b);
  const aNum = String(na) === a;
  const bNum = String(nb) === b;
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function resolvedNoamPrefix(topic, grade, fallback) {
  if (topic && topic.x) return String(topic.x);
  const gradeMap = fallback[grade] || fallback[String(grade)] || {};
  const id = topic && topic.id;
  const hit = gradeMap[id] != null ? gradeMap[id] : gradeMap[String(id)];
  return hit ? String(hit) : null;
}

function buildLevels(topic, linkRow, levelDefaults) {
  const row = linkRow || {};
  if (Object.prototype.hasOwnProperty.call(row, 'one')) {
    return [
      {
        key: 'one',
        label: row.oneLabel || DEFAULT_ONE_LABEL,
        pdfId: row.one,
        labelSource: row.oneLabel ? 'link.oneLabel' : 'default',
      },
    ];
  }

  const out = [];
  for (const def of levelDefaults) {
    const key = def.key;
    const custom = topic[key + 'Label'];
    if (row[key] == null && custom === undefined) continue;
    if (row[key] == null) continue;
    out.push({
      key,
      label: custom || def.label,
      pdfId: row[key],
      labelSource: custom ? 'topic.' + key + 'Label' : 'default',
    });
  }
  return out;
}

function siblingPdfParams(linkRow) {
  const row = linkRow || {};
  const siblings = {};
  for (const k of LEVEL_KEYS) {
    if (row[k]) siblings['p' + k] = row[k];
  }
  return siblings;
}

/**
 * Build the versioned catalog document from a loaded index snapshot.
 */
function buildCatalog(raw) {
  const trackGroupKeys = Object.keys(raw.TRACK_GROUPS || {})
    .filter((k) => raw.TRACK_GROUPS[k])
    .sort();

  const levelDefaults = (raw.LEVELS || []).map((lv) => ({
    key: lv.k,
    label: lv.label,
    cssClass: lv.cls,
  }));

  const gradeNames = {};
  const gradeEmojis = {};
  for (const g of Object.keys(raw.GRADE_NAME).sort(numKeySort)) {
    gradeNames[String(g)] = raw.GRADE_NAME[g];
    gradeEmojis[String(g)] = raw.GRADE_EMOJI[g];
  }

  const noamPrefixFallback = {};
  for (const g of Object.keys(raw.NOAM_PREFIX_FALLBACK || {}).sort(numKeySort)) {
    const inner = {};
    const src = raw.NOAM_PREFIX_FALLBACK[g];
    for (const tid of Object.keys(src).sort(numKeySort)) {
      inner[String(tid)] = src[tid];
    }
    noamPrefixFallback[String(g)] = inner;
  }

  const searchTerms = {};
  for (const g of Object.keys(raw.SEARCH_TERMS || {}).sort(numKeySort)) {
    const inner = {};
    const src = raw.SEARCH_TERMS[g];
    for (const tid of Object.keys(src).sort(numKeySort)) {
      inner[String(tid)] = src[tid];
    }
    searchTerms[String(g)] = inner;
  }

  const icons = {};
  for (const key of Object.keys(raw.ICONS).sort()) {
    icons[key] = raw.ICONS[key];
  }

  const grades = [];
  for (const gk of Object.keys(raw.DATA).sort(numKeySort)) {
    const grade = Number(gk);
    const gd = raw.DATA[gk];
    const groups = (gd.groups || []).map((gr) => ({
      key: gr.key,
      label: gr.name,
      reducedProgram: trackGroupKeys.indexOf(gr.key) !== -1,
    }));

    const topics = (gd.topics || []).map((t) => {
      const linkRow = (gd.links && gd.links[t.id]) || {};
      const prefix = resolvedNoamPrefix(t, grade, raw.NOAM_PREFIX_FALLBACK || {});
      const middle =
        (raw.MIDDLE || []).indexOf(grade) !== -1 ||
        (raw.MIDDLE || []).indexOf(Number(grade)) !== -1;
      const viewerEnabled = !!(raw.VIEWER && raw.VIEWER.enabled);
      const usesViewer = !!(viewerEnabled && prefix && middle);

      const topic = {
        id: t.id,
        title: t.t,
        group: t.g,
        icon: t.ic,
        levels: buildLevels(t, linkRow, levelDefaults),
      };

      if (t.d != null && t.d !== '') topic.description = t.d;
      if (t.n != null && t.n !== '') topic.note = t.n;
      if (t.parent !== undefined) topic.parent = t.parent;
      if (t.x != null && t.x !== '') topic.noamTopicId = t.x;

      // Derived routing facts — documented in schema; not present as fields in DATA.
      topic.routing = {
        resolvedNoamPrefix: prefix,
        aiHintShown: !!(t.x != null && t.x !== ''),
        usesViewer,
        viewerPath: usesViewer ? raw.VIEWER.path : null,
        siblingPdfQuery: usesViewer ? siblingPdfParams(linkRow) : {},
      };

      return topic;
    });

    grades.push({
      grade,
      label: raw.GRADE_NAME[gk] || raw.GRADE_NAME[grade],
      emoji: raw.GRADE_EMOJI[gk] || raw.GRADE_EMOJI[grade],
      groups,
      topics,
    });
  }

  const catalog = {
    contractVersion: CONTRACT_VERSION,
    sourceOfTruth: {
      path: 'index.html',
      authoritative: true,
      note:
        'index.html DATA / SEARCH_TERMS / BASE / VIEWER remain the live source of truth. This JSON is a generated contract for a future Headless frontend and must be regenerated after catalog edits.',
    },
    config: {
      pdfBase: raw.BASE,
      viewer: {
        enabled: !!(raw.VIEWER && raw.VIEWER.enabled),
        path: raw.VIEWER && raw.VIEWER.path,
      },
      levels: levelDefaults,
      defaults: {
        oneLabel: DEFAULT_ONE_LABEL,
      },
      elementaryGrades: (raw.ELEMENTARY || []).slice(),
      middleGrades: (raw.MIDDLE || []).slice(),
      gradeNames,
      gradeEmojis,
      trackGroups: trackGroupKeys,
      noamPrefixFallback,
    },
    icons,
    searchTerms,
    grades,
  };

  return catalog;
}

function catalogStats(catalog) {
  let topics = 0;
  let parentTopics = 0;
  let childTopics = 0;
  let levels = 0;
  let withNoamTopicId = 0;
  let viewerRoutedLevels = 0;
  const pdfIds = [];
  const topicIdsByGrade = {};

  for (const g of catalog.grades) {
    topicIdsByGrade[g.grade] = new Set();
    for (const t of g.topics) {
      topics++;
      topicIdsByGrade[g.grade].add(t.id);
      if (t.parent !== undefined) childTopics++;
      else parentTopics++;
      if (t.noamTopicId) withNoamTopicId++;
      for (const lv of t.levels) {
        levels++;
        pdfIds.push(lv.pdfId);
        if (t.routing && t.routing.usesViewer) viewerRoutedLevels++;
      }
    }
  }

  let searchEntries = 0;
  for (const g of Object.keys(catalog.searchTerms || {})) {
    searchEntries += Object.keys(catalog.searchTerms[g]).length;
  }

  return {
    grades: catalog.grades.length,
    topics,
    parentTopics,
    childTopics,
    levels,
    uniquePdfIds: new Set(pdfIds).size,
    pdfIds,
    withNoamTopicId,
    viewerRoutedLevels,
    searchEntries,
    iconKeys: Object.keys(catalog.icons || {}).length,
    groups: catalog.grades.reduce((n, g) => n + g.groups.length, 0),
  };
}

/**
 * Parity + integrity checks against the live index.html snapshot.
 * Returns { ok, errors, warnings, stats }.
 */
function validateCatalog(catalog, raw) {
  const errors = [];
  const warnings = [];
  const hexRe = /^[0-9a-f]{32}$/;

  if (catalog.contractVersion !== CONTRACT_VERSION) {
    errors.push('contractVersion mismatch');
  }
  if (!catalog.config || catalog.config.pdfBase !== raw.BASE) {
    errors.push('config.pdfBase does not match BASE');
  }
  if (!catalog.config.viewer || catalog.config.viewer.path !== raw.VIEWER.path) {
    errors.push('config.viewer.path does not match VIEWER.path');
  }
  if (!!catalog.config.viewer.enabled !== !!raw.VIEWER.enabled) {
    errors.push('config.viewer.enabled does not match VIEWER.enabled');
  }

  const rawGradeKeys = Object.keys(raw.DATA).map(Number).sort((a, b) => a - b);
  const catGrades = catalog.grades.map((g) => g.grade);
  if (JSON.stringify(catGrades) !== JSON.stringify(rawGradeKeys)) {
    errors.push(
      'grade list mismatch: catalog=' +
        JSON.stringify(catGrades) +
        ' raw=' +
        JSON.stringify(rawGradeKeys)
    );
  }

  const allPdf = [];
  const seenTopicKeys = new Set();

  for (const g of catalog.grades) {
    const gd = raw.DATA[g.grade] || raw.DATA[String(g.grade)];
    if (!gd) {
      errors.push('catalog grade ' + g.grade + ' missing from DATA');
      continue;
    }

    if ((gd.topics || []).length !== g.topics.length) {
      errors.push(
        'grade ' +
          g.grade +
          ' topic count: catalog=' +
          g.topics.length +
          ' DATA=' +
          gd.topics.length
      );
    }
    if ((gd.groups || []).length !== g.groups.length) {
      errors.push(
        'grade ' +
          g.grade +
          ' group count: catalog=' +
          g.groups.length +
          ' DATA=' +
          gd.groups.length
      );
    }

    const groupKeys = new Set((gd.groups || []).map((x) => x.key));
    const topicIds = new Set();

    for (let i = 0; i < g.topics.length; i++) {
      const ct = g.topics[i];
      const rt = (gd.topics || [])[i];
      const key = g.grade + ':' + ct.id;
      if (seenTopicKeys.has(key)) errors.push('duplicate topic id ' + key);
      seenTopicKeys.add(key);
      topicIds.add(ct.id);

      if (!rt || rt.id !== ct.id) {
        errors.push(
          'grade ' +
            g.grade +
            ' topic order/id mismatch at index ' +
            i +
            ' (catalog ' +
            ct.id +
            ' vs DATA ' +
            (rt && rt.id) +
            ')'
        );
        continue;
      }
      if (ct.title !== rt.t) errors.push(key + ' title mismatch');
      if (ct.group !== rt.g) errors.push(key + ' group mismatch');
      if (ct.icon !== rt.ic) errors.push(key + ' icon mismatch');
      if ((ct.description || null) !== (rt.d || null)) errors.push(key + ' description mismatch');
      if ((ct.note || null) !== (rt.n || null)) errors.push(key + ' note mismatch');
      if ((ct.parent === undefined ? null : ct.parent) !== (rt.parent === undefined ? null : rt.parent)) {
        errors.push(key + ' parent mismatch');
      }
      if ((ct.noamTopicId || null) !== (rt.x || null)) errors.push(key + ' noamTopicId/x mismatch');
      if (!groupKeys.has(ct.group)) errors.push(key + ' orphan group "' + ct.group + '"');
      if (!raw.ICONS[ct.icon]) errors.push(key + ' unknown icon "' + ct.icon + '"');

      const linkRow = (gd.links && gd.links[rt.id]) || {};
      const expectedPrefix = resolvedNoamPrefix(rt, g.grade, raw.NOAM_PREFIX_FALLBACK || {});
      if ((ct.routing && ct.routing.resolvedNoamPrefix) !== expectedPrefix) {
        errors.push(key + ' resolvedNoamPrefix mismatch');
      }

      const expectedLevels = buildLevels(rt, linkRow, catalog.config.levels);
      if (expectedLevels.length !== ct.levels.length) {
        errors.push(
          key +
            ' level count mismatch: catalog=' +
            ct.levels.length +
            ' expected=' +
            expectedLevels.length
        );
      } else {
        for (let li = 0; li < expectedLevels.length; li++) {
          const el = expectedLevels[li];
          const cl = ct.levels[li];
          if (cl.key !== el.key || cl.pdfId !== el.pdfId || cl.label !== el.label) {
            errors.push(
              key +
                ' level[' +
                li +
                '] mismatch: ' +
                JSON.stringify(cl) +
                ' vs ' +
                JSON.stringify(el)
            );
          }
          if (!hexRe.test(cl.pdfId)) errors.push(key + '/' + cl.key + ' bad pdfId ' + cl.pdfId);
          allPdf.push({ hex: cl.pdfId, where: key + '/' + cl.key });
        }
      }
    }

    // Parent references must resolve within the same grade.
    for (const ct of g.topics) {
      if (ct.parent === undefined) continue;
      if (!topicIds.has(ct.parent)) {
        errors.push('grade ' + g.grade + ' topic ' + ct.id + ' orphan parent ' + ct.parent);
      }
    }

    // links ↔ topics bijection (same iron rule as validate.js)
    for (const lid of Object.keys(gd.links || {})) {
      if (!topicIds.has(Number(lid)) && !topicIds.has(lid)) {
        // keys from VM are usually numbers when accessed via topic.id, but Object.keys are strings
        const asNum = Number(lid);
        if (!topicIds.has(asNum)) {
          warnings.push('grade ' + g.grade + ': links[' + lid + '] has no matching topic');
        }
      }
    }
  }

  // SEARCH_TERMS parity
  const rawSearch = raw.SEARCH_TERMS || {};
  const catSearch = catalog.searchTerms || {};
  const searchGrades = new Set([
    ...Object.keys(rawSearch).map(String),
    ...Object.keys(catSearch).map(String),
  ]);
  for (const gk of searchGrades) {
    const r = rawSearch[gk] || rawSearch[Number(gk)] || {};
    const c = catSearch[gk] || {};
    const ids = new Set([...Object.keys(r).map(String), ...Object.keys(c).map(String)]);
    for (const tid of ids) {
      const rv = r[tid] != null ? r[tid] : r[Number(tid)];
      const cv = c[tid];
      if (rv !== cv) {
        errors.push('SEARCH_TERMS[' + gk + '][' + tid + '] mismatch');
      }
    }
  }

  // NOAM_PREFIX_FALLBACK parity
  const rawFb = raw.NOAM_PREFIX_FALLBACK || {};
  const catFb = (catalog.config && catalog.config.noamPrefixFallback) || {};
  for (const gk of new Set([...Object.keys(rawFb), ...Object.keys(catFb)].map(String))) {
    const r = rawFb[gk] || rawFb[Number(gk)] || {};
    const c = catFb[gk] || {};
    for (const tid of new Set([...Object.keys(r), ...Object.keys(c)].map(String))) {
      const rv = r[tid] != null ? r[tid] : r[Number(tid)];
      const cv = c[tid];
      if (rv !== cv) errors.push('noamPrefixFallback[' + gk + '][' + tid + '] mismatch');
    }
  }

  // TRACK_GROUPS
  const rawTracks = Object.keys(raw.TRACK_GROUPS || {})
    .filter((k) => raw.TRACK_GROUPS[k])
    .sort();
  const catTracks = (catalog.config.trackGroups || []).slice().sort();
  if (JSON.stringify(rawTracks) !== JSON.stringify(catTracks)) {
    errors.push('trackGroups mismatch');
  }

  // Unique PDF IDs
  const seen = {};
  for (const e of allPdf) {
    if (seen[e.hex]) {
      errors.push('duplicate pdfId ' + e.hex + ' (' + seen[e.hex] + ' <-> ' + e.where + ')');
    } else {
      seen[e.hex] = e.where;
    }
  }

  // Icon key set parity
  const rawIcons = Object.keys(raw.ICONS).sort();
  const catIcons = Object.keys(catalog.icons || {}).sort();
  if (JSON.stringify(rawIcons) !== JSON.stringify(catIcons)) {
    errors.push('icon key set mismatch');
  } else {
    for (const k of rawIcons) {
      if (catalog.icons[k] !== raw.ICONS[k]) errors.push('icon body mismatch for ' + k);
    }
  }

  const stats = catalogStats(catalog);
  // Cross-check level count vs unique pdfs (current catalog: 1:1 unique)
  if (stats.levels !== stats.uniquePdfIds) {
    warnings.push(
      'level count (' +
        stats.levels +
        ') != unique pdf ids (' +
        stats.uniquePdfIds +
        ') — reuse may be intentional'
    );
  }

  return { ok: errors.length === 0, errors, warnings, stats };
}

function exportCatalog(options) {
  const opts = options || {};
  const indexPath = opts.indexPath || INDEX_PATH;
  const outPath = opts.outPath || OUT_JSON;
  const raw = loadIndexCatalog(indexPath);
  const catalog = buildCatalog(raw);
  const validation = validateCatalog(catalog, raw);
  const text = stableStringify(catalog);
  const hash = crypto.createHash('sha256').update(text).digest('hex');

  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text);
  }

  return { catalog, validation, text, hash, outPath, raw };
}

function assertDeterministic(indexPath) {
  const a = exportCatalog({ indexPath, dryRun: true });
  const b = exportCatalog({ indexPath, dryRun: true });
  if (a.text !== b.text || a.hash !== b.hash) {
    throw new Error('Non-deterministic catalog export');
  }
  return a;
}

module.exports = {
  ROOT,
  INDEX_PATH,
  OUT_DIR,
  OUT_JSON,
  CONTRACT_VERSION,
  DEFAULT_ONE_LABEL,
  loadIndexCatalog,
  buildCatalog,
  validateCatalog,
  catalogStats,
  exportCatalog,
  assertDeterministic,
  stableStringify,
  resolvedNoamPrefix,
};
