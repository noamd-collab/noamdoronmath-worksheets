'use strict';

/**
 * Independent catalog parity + routing checks for Phase 0.1.
 *
 * Expected values come from index.html production DATA + sheetHref (via
 * tests/helpers/independent-catalog-parity.cjs). Actual values come from the
 * committed headless/catalog/catalog.v1.json. Does not import the exporter.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadProductionCatalog,
  readCommittedCatalog,
  walkExpectedFromProduction,
  contractHref,
  assertHrefMeaningEqual,
  hrefMeaning,
  renderedLevelHrefs,
  assertSearchTermsEqual,
} = require('./helpers/independent-catalog-parity.cjs');

const prod = loadProductionCatalog();
const expected = walkExpectedFromProduction(prod);
const catalog = readCommittedCatalog();

function catalogTopic(grade, topicId) {
  const g = catalog.grades.find((x) => x.grade === Number(grade));
  assert.ok(g, 'missing catalog grade ' + grade);
  const t = g.topics.find((x) => x.id === topicId);
  assert.ok(t, 'missing catalog topic ' + grade + ':' + topicId);
  return t;
}

test('independent: grade/topic/group order and associations match catalog.v1.json', () => {
  assert.equal(catalog.grades.length, expected.grades.length);
  for (let gi = 0; gi < expected.grades.length; gi++) {
    const eg = expected.grades[gi];
    const cg = catalog.grades[gi];
    assert.equal(cg.grade, eg.grade, 'grade order');
    assert.equal(cg.groups.length, eg.groupOrder.length);
    for (let i = 0; i < eg.groupOrder.length; i++) {
      assert.equal(cg.groups[i].key, eg.groupOrder[i].key, 'group key order g' + eg.grade);
      assert.equal(cg.groups[i].label, eg.groupOrder[i].name, 'group label g' + eg.grade);
    }
    assert.equal(cg.topics.length, eg.topics.length, 'topic count g' + eg.grade);
    for (let i = 0; i < eg.topics.length; i++) {
      const et = eg.topics[i];
      const ct = cg.topics[i];
      assert.equal(ct.id, et.id, 'topic order g' + eg.grade + '[' + i + ']');
      assert.equal(ct.title, et.title);
      assert.equal(ct.group, et.group);
      assert.equal(ct.icon, et.icon);
      assert.equal(ct.description || null, et.description || null);
      assert.equal(ct.note || null, et.note || null);
      assert.equal(ct.parent === undefined ? null : ct.parent, et.parent === undefined ? null : et.parent);
      assert.equal(ct.noamTopicId || null, et.explicitX);
      assert.equal(ct.routing.resolvedNoamPrefix, et.prefix || null);
      assert.equal(ct.levels.length, et.levels.length, 'levels g' + eg.grade + ':' + et.id);
      for (let li = 0; li < et.levels.length; li++) {
        assert.equal(ct.levels[li].key, et.levels[li].key);
        assert.equal(ct.levels[li].pdfId, et.levels[li].pdfId);
      }
    }
  }
});

test('independent: SEARCH_TERMS, explicit x, effective prefixes, mapping vs unique PDF counts', () => {
  // Complete SEARCH_TERMS structure (extra/missing grade or topic entries must fail).
  assertSearchTermsEqual(catalog.searchTerms, expected.searchTerms, 'SEARCH_TERMS full structure');

  let catX = 0;
  let catEff = 0;
  let catLevels = 0;
  const catPdfs = [];
  for (const g of catalog.grades) {
    for (const t of g.topics) {
      if (t.noamTopicId) catX++;
      if (t.routing && t.routing.resolvedNoamPrefix) catEff++;
      for (const lv of t.levels) {
        catLevels++;
        catPdfs.push(lv.pdfId);
      }
    }
  }

  // Derived from this run's independent walk — not hardcoded prior report counts.
  assert.equal(catX, expected.explicitX, 'explicit x count');
  assert.equal(catEff, expected.effectivePrefixTopics, 'effective prefix topic count');
  assert.equal(catLevels, expected.totalMappings, 'total worksheet-level mappings');
  assert.equal(new Set(catPdfs).size, expected.uniquePdfIds, 'unique PDF media ids');
  assert.equal(expected.totalMappings, catLevels);
  assert.notEqual(
    expected.totalMappings,
    undefined,
    'sanity: totalMappings derived'
  );
  // Counts reported separately (may coincidentally be equal when no PDF reuse).
  assert.equal(typeof expected.totalMappings, 'number');
  assert.equal(typeof expected.uniquePdfIds, 'number');
  assert.equal(expected.duplicateWorksheetIds, 0);
});

test('independent: contract consumer href meaning matches production sheetHref for every mapping', () => {
  let viewerAbc = 0;
  let viewerOne = 0;
  let direct = 0;
  let fallbackOnly = 0;
  let withSiblings = 0;

  for (const m of expected.mappings) {
    const topic = catalogTopic(m.grade, m.topicId);
    const level = topic.levels.find((l) => l.key === m.levelKey);
    assert.ok(level, 'catalog level ' + m.grade + ':' + m.topicId + '/' + m.levelKey);

    const fromContract = contractHref(catalog, m.grade, topic, level);
    assertHrefMeaningEqual(
      fromContract,
      m.href,
      'href mismatch g' + m.grade + ' t' + m.topicId + ' ' + m.levelKey
    );

    const meaning = (() => {
      const { hrefMeaning } = require('./helpers/independent-catalog-parity.cjs');
      return hrefMeaning(fromContract);
    })();

    if (meaning.kind === 'pdf') {
      direct++;
      assert.equal(topic.routing.usesViewer, false);
    } else {
      assert.equal(meaning.path, catalog.config.viewer.path);
      assert.equal(meaning.g, String(m.grade));
      assert.equal(meaning.x, m.prefix);
      assert.equal(meaning.pdf, m.pdfId);
      assert.equal(meaning.t, m.title);
      assert.equal(meaning.lv, m.viewerLevelArg);
      if (m.levelKey === 'one') {
        assert.equal(meaning.lv, 'b', 'one-level viewer lv must be b');
        assert.equal(level.key, 'one', 'catalog key stays one');
        viewerOne++;
      } else {
        assert.equal(meaning.lv, m.levelKey);
        viewerAbc++;
      }
      if (!m.explicitX && m.prefix) fallbackOnly++;
      if (meaning.pa || meaning.pb || meaning.pc) withSiblings++;
      // siblings from production row a/b/c only
      const row = prod.DATA[m.grade].links[m.topicId];
      for (const k of ['a', 'b', 'c']) {
        const q = 'p' + k;
        assert.equal(meaning[q] || null, row[k] || null, q + ' sibling');
      }
    }
  }

  assert.ok(viewerAbc > 0, 'expected some a/b/c viewer routes');
  assert.ok(viewerOne > 0, 'expected some one→lv=b viewer routes');
  assert.ok(direct > 0, 'expected some direct PDF routes (elementary)');
  assert.ok(fallbackOnly > 0, 'expected some NOAM_PREFIX_FALLBACK-only routes');
  assert.ok(withSiblings > 0, 'expected some pa/pb/pc siblings');
  assert.equal(
    viewerAbc + viewerOne + direct,
    expected.mappings.length,
    'coverage of all mappings'
  );
});

test('independent: elementary mappings are direct PDF even when catalog is consulted', () => {
  for (const m of expected.mappings.filter((x) => x.grade <= 6)) {
    const topic = catalogTopic(m.grade, m.topicId);
    const level = topic.levels.find((l) => l.key === m.levelKey);
    const href = contractHref(catalog, m.grade, topic, level);
    assert.match(href, /\.pdf$/);
    assert.equal(href.indexOf('?'), -1);
    assert.equal(topic.routing.usesViewer, false);
  }
});

test('independent: viewer-disabled override forces direct PDF for all contract consumers', () => {
  for (const m of expected.mappings) {
    const topic = catalogTopic(m.grade, m.topicId);
    const level = topic.levels.find((l) => l.key === m.levelKey);
    const href = contractHref(catalog, m.grade, topic, level, { viewerEnabled: false });
    assert.equal(
      href,
      catalog.config.pdfBase + level.pdfId + '.pdf',
      'viewer-disabled contract href g' + m.grade + ':' + m.topicId + '/' + m.levelKey
    );
  }

  // Production sandbox with VIEWER.enabled = false: every mapping becomes direct PDF.
  const disabled = loadProductionCatalog();
  disabled.VIEWER.enabled = false;
  let checked = 0;
  for (const gk of Object.keys(disabled.DATA)) {
    const grade = Number(gk);
    for (const t of disabled.DATA[gk].topics) {
      const row = disabled.DATA[gk].links[t.id] || {};
      const keys = Object.prototype.hasOwnProperty.call(row, 'one')
        ? ['one']
        : ['a', 'b', 'c'].filter((k) => row[k] != null);
      for (const key of keys) {
        const pdf = row[key];
        const prodHref = disabled.sheetHref(t, grade, key === 'one' ? 'b' : key, pdf, row);
        assert.equal(prodHref, disabled.BASE + pdf + '.pdf', 'prod disabled g' + grade + ':' + t.id);
        checked++;
      }
    }
  }
  assert.equal(checked, expected.mappings.length);
});

test('independent: production levelLinksHTML rendered hrefs match contract consumer', () => {
  assert.equal(typeof prod.levelLinksHTML, 'function');
  let oneViewerChecked = 0;
  let totalAnchors = 0;

  for (const gk of Object.keys(prod.DATA)) {
    const grade = Number(gk);
    for (const t of prod.DATA[gk].topics) {
      const rendered = renderedLevelHrefs(prod, t, grade);
      const catTopic = catalogTopic(grade, t.id);
      assert.equal(
        rendered.length,
        catTopic.levels.length,
        'anchor count g' + grade + ':' + t.id
      );

      for (let i = 0; i < catTopic.levels.length; i++) {
        const level = catTopic.levels[i];
        const fromContract = contractHref(catalog, grade, catTopic, level);
        assertHrefMeaningEqual(
          fromContract,
          rendered[i],
          'levelLinksHTML vs contract g' + grade + ':' + t.id + '/' + level.key
        );
        totalAnchors++;
        if (level.key === 'one' && hrefMeaning(rendered[i]).kind === 'viewer') {
          assert.equal(hrefMeaning(rendered[i]).lv, 'b');
          assert.equal(level.key, 'one');
          oneViewerChecked++;
        }
      }
    }
  }

  assert.ok(totalAnchors > 0);
  assert.equal(totalAnchors, expected.mappings.length);
  assert.ok(oneViewerChecked > 0, 'levelLinksHTML must render viewer-routed one with lv=b');
});

test('independent: one-level viewer-routed rows keep catalog key one and production lv=b', () => {
  const ones = expected.mappings.filter((m) => m.levelKey === 'one' && m.href.indexOf('?') !== -1);
  assert.ok(ones.length > 0, 'need at least one viewer-routed one-level mapping');
  for (const m of ones) {
    const topic = catalogTopic(m.grade, m.topicId);
    const level = topic.levels.find((l) => l.key === 'one');
    assert.equal(level.key, 'one');
    const href = contractHref(catalog, m.grade, topic, level);
    assertHrefMeaningEqual(href, m.href, 'one-level ' + m.grade + ':' + m.topicId);
    const { hrefMeaning } = require('./helpers/independent-catalog-parity.cjs');
    assert.equal(hrefMeaning(href).lv, 'b');
  }

  // Not every one-level is viewer-routed (document preservation of direct-PDF conditions).
  // If any one-level is direct, assert catalog usesViewer false.
  const directOnes = expected.mappings.filter((m) => m.levelKey === 'one' && m.href.indexOf('?') === -1);
  for (const m of directOnes) {
    assert.equal(catalogTopic(m.grade, m.topicId).routing.usesViewer, false);
  }
});

test('independent negative control: mutated catalog PDF id is detected', () => {
  const m = expected.mappings.find((x) => x.grade === 7 && x.levelKey === 'a');
  assert.ok(m);
  const topic = catalogTopic(m.grade, m.topicId);
  const mutated = JSON.parse(JSON.stringify(topic));
  const level = mutated.levels.find((l) => l.key === m.levelKey);
  const original = level.pdfId;
  level.pdfId = original.replace(/0/g, 'f').replace(/[^0-9a-f]/g, 'a');
  if (level.pdfId === original) {
    level.pdfId = (original.slice(0, 31) + (original[31] === '0' ? '1' : '0'));
  }
  assert.notEqual(level.pdfId, original);

  const badHref = contractHref(catalog, m.grade, mutated, level);
  let detected = false;
  try {
    assertHrefMeaningEqual(badHref, m.href, 'should fail');
  } catch (err) {
    detected = true;
    assert.match(String(err.message || err), /pdf|deep|equal|mismatch/i);
  }
  assert.equal(detected, true, 'parity must detect mutated PDF id');

  // Committed catalog untouched
  const reloaded = readCommittedCatalog();
  const still = reloaded.grades
    .find((g) => g.grade === m.grade)
    .topics.find((t) => t.id === m.topicId)
    .levels.find((l) => l.key === m.levelKey).pdfId;
  assert.equal(still, original);
});

test('independent negative control: mutated resolved prefix is detected', () => {
  const m = expected.mappings.find((x) => x.prefix && x.href.indexOf('?') !== -1);
  assert.ok(m);
  const topic = catalogTopic(m.grade, m.topicId);
  const mutated = JSON.parse(JSON.stringify(topic));
  mutated.routing.resolvedNoamPrefix = 'MUTATED-PREFIX-XYZ';
  const level = mutated.levels.find((l) => l.key === m.levelKey);
  const badHref = contractHref(catalog, m.grade, mutated, level);
  let detected = false;
  try {
    assertHrefMeaningEqual(badHref, m.href, 'should fail');
  } catch (err) {
    detected = true;
  }
  assert.equal(detected, true);

  const reloaded = readCommittedCatalog();
  assert.equal(
    reloaded.grades.find((g) => g.grade === m.grade).topics.find((t) => t.id === m.topicId).routing
      .resolvedNoamPrefix,
    m.prefix
  );
});

test('independent negative control: extra SEARCH_TERMS entry is detected', () => {
  const mutated = JSON.parse(JSON.stringify(catalog.searchTerms));
  const gradeKey = Object.keys(mutated)[0];
  mutated[gradeKey]['999999'] = 'ערך שלא אמור להיות כאן';
  let detected = false;
  try {
    assertSearchTermsEqual(mutated, expected.searchTerms, 'should fail on extra entry');
  } catch (err) {
    detected = true;
  }
  assert.equal(detected, true);
  // committed catalog untouched
  assertSearchTermsEqual(readCommittedCatalog().searchTerms, expected.searchTerms);
});
