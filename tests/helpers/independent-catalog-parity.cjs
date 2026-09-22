'use strict';

/**
 * Test-only helpers for independent Phase 0.1 catalog parity / routing checks.
 *
 * Loads production declarations + sheetHref/url/noamTopicPrefix from index.html via
 * the same lightweight vm slice pattern used by tests/noam-middle-levels.test.cjs.
 * Does NOT import scripts/lib/headless-catalog.cjs or the exporter.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'index.html');
const CATALOG_JSON = path.join(ROOT, 'headless', 'catalog', 'catalog.v1.json');

function extractBraceAssign(source, varName, openChar, closeChar) {
  const re = new RegExp('var\\s+' + varName + '\\s*=\\s*\\' + openChar);
  const m = re.exec(source);
  assert.ok(m, 'Missing declaration: ' + varName);
  const braceStart = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const c = source[i];
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return source.slice(m.index, i + 1) + ';';
    }
  }
  assert.fail('Unbalanced declaration: ' + varName);
}

function extractStringAssign(source, varName) {
  const re = new RegExp('var\\s+' + varName + '\\s*=\\s*("(?:\\\\.|[^"\\\\])*")\\s*;');
  const m = re.exec(source);
  assert.ok(m, 'Missing string declaration: ' + varName);
  return 'var ' + varName + ' = ' + m[1] + ';';
}

function productionFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Missing function: ' + name);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, 'Unterminated function: ' + name);
  return source.slice(start, end + 2);
}

/** Fresh production sandbox from index.html (not shared with exporter). */
function loadProductionCatalog(indexPath) {
  const source = fs.readFileSync(indexPath || INDEX, 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  const slice = [
    extractStringAssign(source, 'BASE'),
    extractStringAssign(source, 'NO_LINK'),
    extractBraceAssign(source, 'VIEWER', '{', '}'),
    extractBraceAssign(source, 'NOAM_PREFIX_FALLBACK', '{', '}'),
    extractBraceAssign(source, 'DATA', '{', '}'),
    extractBraceAssign(source, 'GRADE_NAME', '{', '}'),
    extractBraceAssign(source, 'TRACK_GROUPS', '{', '}'),
    extractBraceAssign(source, 'SEARCH_TERMS', '{', '}'),
    extractBraceAssign(source, 'LEVELS', '[', ']'),
    extractBraceAssign(source, 'ELEMENTARY', '[', ']'),
    extractBraceAssign(source, 'MIDDLE', '[', ']'),
    productionFunction(source, 'url'),
    productionFunction(source, 'noamTopicPrefix'),
    productionFunction(source, 'sheetHref'),
    productionFunction(source, 'esc'),
    productionFunction(source, 'levelLinksHTML'),
  ].join('\n');
  vm.runInContext(slice, sandbox, { filename: 'independent-index-slice.js' });
  return sandbox;
}

function readCommittedCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
}

function resolvedPrefixFromData(topic, grade, fallback) {
  if (topic && topic.x) return String(topic.x);
  const map = (fallback && (fallback[grade] || fallback[String(grade)])) || {};
  const hit = map[topic.id] != null ? map[topic.id] : map[String(topic.id)];
  return hit ? String(hit) : '';
}

/**
 * Walk DATA into flat expected mappings + topic/group order (independent of exporter).
 */
function walkExpectedFromProduction(prod) {
  const mappings = [];
  const grades = [];
  let searchEntries = 0;
  let explicitX = 0;
  let effectivePrefixTopics = 0;
  const pdfIds = [];
  const worksheetIds = [];

  for (const gk of Object.keys(prod.DATA).sort((a, b) => Number(a) - Number(b))) {
    const grade = Number(gk);
    const gd = prod.DATA[gk];
    const groupOrder = (gd.groups || []).map((g) => ({ key: g.key, name: g.name }));
    const topicOrder = [];
    const topics = [];

    for (const t of gd.topics || []) {
      topicOrder.push(t.id);
      if (t.x) explicitX++;
      const prefix = resolvedPrefixFromData(t, grade, prod.NOAM_PREFIX_FALLBACK);
      if (prefix) effectivePrefixTopics++;

      const row = (gd.links && gd.links[t.id]) || {};
      const levelKeys = Object.prototype.hasOwnProperty.call(row, 'one')
        ? ['one']
        : ['a', 'b', 'c'].filter((k) => row[k] != null);

      const levels = [];
      for (const key of levelKeys) {
        const pdfId = row[key];
        pdfIds.push(pdfId);
        worksheetIds.push('g' + grade + '-t' + t.id + '-' + key);
        // Production levelLinksHTML: one → sheetHref level arg "b"; else key.
        const viewerLevelArg = key === 'one' ? 'b' : key;
        const href = prod.sheetHref(t, grade, viewerLevelArg, pdfId, row);
        levels.push({ key, pdfId, viewerLevelArg, href });
        mappings.push({
          grade,
          topicId: t.id,
          title: t.t,
          parent: t.parent,
          group: t.g,
          icon: t.ic,
          description: t.d,
          note: t.n,
          explicitX: t.x || null,
          prefix: prefix || null,
          levelKey: key,
          pdfId,
          viewerLevelArg,
          href,
        });
      }

      topics.push({
        id: t.id,
        title: t.t,
        description: t.d,
        note: t.n,
        group: t.g,
        icon: t.ic,
        parent: t.parent,
        explicitX: t.x || null,
        prefix: prefix || null,
        levels,
      });
    }

    grades.push({ grade, groupOrder, topicOrder, topics });
  }

  for (const g of Object.keys(prod.SEARCH_TERMS || {})) {
    searchEntries += Object.keys(prod.SEARCH_TERMS[g]).length;
  }

  return {
    grades,
    mappings,
    searchEntries,
    explicitX,
    effectivePrefixTopics,
    totalMappings: mappings.length,
    uniquePdfIds: new Set(pdfIds).size,
    uniqueWorksheetIds: new Set(worksheetIds).size,
    duplicateWorksheetIds: worksheetIds.length - new Set(worksheetIds).size,
    searchTerms: prod.SEARCH_TERMS,
    trackGroups: Object.keys(prod.TRACK_GROUPS || {}).filter((k) => prod.TRACK_GROUPS[k]),
    base: prod.BASE,
    viewer: { enabled: !!prod.VIEWER.enabled, path: prod.VIEWER.path },
    noamPrefixFallback: prod.NOAM_PREFIX_FALLBACK,
  };
}

/**
 * Minimal test-only consumer of the exported contract → href string.
 * Implements corrected sheetHref semantics (including one → lv=b when viewer-routed).
 */
function contractHref(catalog, gradeNum, topic, level, options) {
  const opts = options || {};
  const viewerEnabled =
    opts.viewerEnabled != null ? !!opts.viewerEnabled : !!(catalog.config && catalog.config.viewer && catalog.config.viewer.enabled);
  const pdfBase = catalog.config.pdfBase;
  const viewerPath = catalog.config.viewer && catalog.config.viewer.path;
  const middle = (catalog.config.middleGrades || []).map(Number);
  const pdfId = level.pdfId;
  const prefix = topic.routing && topic.routing.resolvedNoamPrefix;

  const direct = function () {
    return pdfBase + pdfId + '.pdf';
  };

  if (!viewerEnabled || !topic || !pdfId) return direct();
  if (!prefix || middle.indexOf(Number(gradeNum)) === -1) return direct();

  const viewerLevel = level.key === 'one' ? 'b' : level.key;
  const params = new URLSearchParams();
  params.set('g', String(gradeNum));
  params.set('x', String(prefix));
  params.set('lv', viewerLevel);
  params.set('pdf', pdfId);
  params.set('t', topic.title);

  const siblings = (topic.routing && topic.routing.siblingPdfQuery) || {};
  for (const k of ['pa', 'pb', 'pc']) {
    if (siblings[k]) params.set(k, siblings[k]);
  }

  return viewerPath + '?' + params.toString();
}

/** Compare href meaning (path + params), ignoring incidental param order / encoding style. */
function hrefMeaning(href) {
  if (!href) return { kind: 'empty' };
  if (/\.pdf$/i.test(href) && href.indexOf('?') === -1) {
    return { kind: 'pdf', url: href };
  }
  const q = href.indexOf('?');
  assert.ok(q > 0, 'expected query URL: ' + href);
  const path = href.slice(0, q);
  const params = new URLSearchParams(href.slice(q + 1));
  const obj = { kind: 'viewer', path };
  for (const key of ['g', 'x', 'lv', 'pdf', 't', 'pa', 'pb', 'pc']) {
    if (params.has(key)) obj[key] = params.get(key);
  }
  return obj;
}

function assertHrefMeaningEqual(actual, expected, label) {
  assert.deepEqual(hrefMeaning(actual), hrefMeaning(expected), label);
}

/**
 * Parse href attributes from production levelLinksHTML markup.
 * Relies on the real renderer (including one → sheetHref(..., "b", ...)).
 */
function parseAnchorHrefs(html) {
  const hrefs = [];
  const re = /<a\b[^>]*\bhref="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    hrefs.push(m[1].replace(/&amp;/g, '&'));
  }
  return hrefs;
}

function renderedLevelHrefs(prod, topic, grade) {
  assert.equal(typeof prod.levelLinksHTML, 'function', 'levelLinksHTML must be loaded from index.html');
  return parseAnchorHrefs(prod.levelLinksHTML(topic, grade));
}

/**
 * Normalize SEARCH_TERMS-like maps so grade/topic keys are strings (cross-VM parity).
 * Extra or missing entries fail deepEqual.
 */
function normalizeSearchTerms(raw) {
  const out = {};
  for (const gk of Object.keys(raw || {}).sort((a, b) => Number(a) - Number(b))) {
    const inner = {};
    const src = raw[gk];
    for (const tid of Object.keys(src).sort((a, b) => Number(a) - Number(b))) {
      inner[String(tid)] = src[tid];
    }
    out[String(gk)] = inner;
  }
  return out;
}

function assertSearchTermsEqual(actual, expected, label) {
  assert.deepEqual(
    normalizeSearchTerms(actual),
    normalizeSearchTerms(expected),
    label || 'SEARCH_TERMS structure mismatch'
  );
}

module.exports = {
  ROOT,
  INDEX,
  CATALOG_JSON,
  loadProductionCatalog,
  readCommittedCatalog,
  walkExpectedFromProduction,
  contractHref,
  hrefMeaning,
  assertHrefMeaningEqual,
  resolvedPrefixFromData,
  parseAnchorHrefs,
  renderedLevelHrefs,
  normalizeSearchTerms,
  assertSearchTermsEqual,
};
