const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  SCIENTIFIC_CONSTANTS,
  UNIT_CONVERSIONS,
  SCIENTIFIC_CATALOG_EDITION,
  convertScientificUnit,
} = require('./catalog.js');

function close(actual, expected, label, tolerance = 1e-12) {
  assert.ok(Number.isFinite(actual), `${label}: result must be finite`);
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(expected), 1e-300),
    `${label}: expected ${expected}, got ${actual}`);
}

test('both PLUS catalogues are complete, uniquely indexed and sourced', () => {
  const expectedIDs = Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, '0'));
  assert.deepEqual(SCIENTIFIC_CONSTANTS.map(item => item.id), expectedIDs);
  assert.deepEqual(UNIT_CONVERSIONS.map(item => item.id), expectedIDs);
  assert.match(SCIENTIFIC_CATALOG_EDITION, /PLUS 2nd edition.*2014.*2008/);
  for (const item of SCIENTIFIC_CONSTANTS) {
    assert.ok(Number.isFinite(item.value), `constant ${item.id}`);
    assert.ok(item.nameHe && item.symbol && typeof item.unit === 'string');
    assert.match(item.source, /fx-570ESPLUS_991ESPLUS_EN\.pdf#page=/);
    assert.match(item.valuesSource, /nist\.gov.*2014/);
    assert.match(item.edition, /2014/);
  }
  for (const item of UNIT_CONVERSIONS) {
    assert.ok(item.from && item.to && item.label, `conversion ${item.id}`);
    assert.ok(item.factor > 0 && Number.isFinite(item.factor));
    assert.ok(Number.isFinite(item.offset));
    assert.match(item.source, /fx-570ESPLUS_991ESPLUS_EN\.pdf#page=/);
  }
});

test('CODATA2014 constants retain device edition, signs and magnitude', () => {
  // NIST CODATA2014 anchors; the PLUS manual specifies this edition rather
  // than the original ES1998 catalogue or the redefined SI2019 constants.
  const anchors = [
    ['01', 1.672621898e-27], ['06', 6.626070040e-34],
    ['08', 9.274009994e-24], ['19', -9.284764620e-24],
    ['20', -9.6623650e-27], ['23', 1.6021766208e-19],
    ['24', 6.022140857e23], ['26', .022710947], ['28', 299792458],
    ['33', 1.2566370614359173e-6], ['38', 273.15],
    ['39', 6.67408e-11], ['40', 101325],
  ];
  for (const [id, expected] of anchors) {
    close(SCIENTIFIC_CONSTANTS.find(item => item.id === id).value, expected, `constant ${id}`, 1e-14);
  }
  const value=id=>SCIENTIFIC_CONSTANTS.find(item=>item.id===id).value;
  close(1/Math.sqrt(value('32')*value('33')),value('28'),'manual speed-of-light example',1e-14);
  close(value('32')*value('37')*value('28'),1,'vacuum impedance identity',1e-14);
  close(value('24')*value('23'),value('22'),'Faraday from rounded CODATA data',1e-9);
});

test('20 conversion pairs invert each other for positive, negative and zero inputs', () => {
  for (let i = 0; i < UNIT_CONVERSIONS.length; i += 2) {
    const forward = UNIT_CONVERSIONS[i];
    const reverse = UNIT_CONVERSIONS[i + 1];
    assert.equal(forward.from, reverse.to, `${forward.id} reverse units`);
    assert.equal(forward.to, reverse.from, `${forward.id} reverse units`);
    for (const value of [-987.654, 0, 123.456]) {
      const roundTrip = convertScientificUnit(convertScientificUnit(value, forward.id), reverse.id);
      if (value === 0) assert.ok(Math.abs(roundTrip) < 1e-12, `${forward.id}: zero round trip`);
      else close(roundTrip, value, `round trip ${forward.id} → ${reverse.id}`);
    }
  }
});

test('independent reference cases catch unit, scale, calorie and temperature errors', () => {
  // PLUS manual p43–44 / NIST SP8112008 factors. The manual's 100 g -> oz
  // is 3.527396584, demonstrating that the device uses the rounded factor.
  const cases = [
    [5, '02', 5 / 2.54], [3, '03', 0.9144],
    [1, '07', 1.609344], [1, '09', 1852],
    [1, '11', 4046.856], [1, '13', 3.785412],
    [1, '15', 4.54609], [1, '17', 3.085678e13],
    [90, '19', 25], [100, '22', 100 / 28.34952],
    [1, '23', 0.4535924], [1, '25', 101325],
    [1, '27', 133.3224], [1, '29', 0.7457],
    [1, '31', 98066.5], [1, '33', 9.80665],
    [1, '35', 6.894757], [100, '38', 212],
    [-31, '38', -23.8], [-40, '37', -40],
    [4.1858, '39', 1], [1, '40', 4.1858],
  ];
  for (const [value, id, expected] of cases) {
    close(convertScientificUnit(value, id), expected, `${value} via ${id}`);
  }
  assert.equal(convertScientificUnit(32, '37'), 0);
  assert.equal(Number(convertScientificUnit(100,'22').toPrecision(10)),3.527396584);
});

test('finite tiny values are preserved; invalid IDs and nonfinite results are rejected', () => {
  close(convertScientificUnit(1e-30, '01'), 2.54e-30, 'tiny length');
  assert.equal(convertScientificUnit(1, 1), 2.54, 'numeric IDs normalize');
  assert.equal(convertScientificUnit('2', '01'), 5.08, 'numeric input text works');
  assert.equal(Object.is(convertScientificUnit(-0, '01'), -0), false);
  for (const id of ['00', '41', 'bad']) assert.throws(() => convertScientificUnit(1, id), RangeError);
  for (const value of [NaN, Infinity, -Infinity, 'invalid']) {
    assert.throws(() => convertScientificUnit(value, '01'), TypeError);
  }
  assert.throws(() => convertScientificUnit(Number.MAX_VALUE, '17'), RangeError);
});

test('catalogue loads as a browser script without CommonJS or runtime requests', () => {
  const code = fs.readFileSync(path.join(__dirname, 'catalog.js'), 'utf8');
  const sandbox = Object.create(null);
  sandbox.fetch = () => { throw new Error('unexpected runtime network request'); };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 1000 });
  assert.equal(vm.runInContext('SCIENTIFIC_CONSTANTS.length', sandbox), 40);
  assert.equal(vm.runInContext('UNIT_CONVERSIONS.length', sandbox), 40);
  assert.equal(vm.runInContext('convertScientificUnit(1,"40")', sandbox), 4.1858);
});
