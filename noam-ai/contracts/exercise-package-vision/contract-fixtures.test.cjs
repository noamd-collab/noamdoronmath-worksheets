/**
 * Frozen contract tests: ExercisePackage.geometry, VisionObservation,
 * ValidationReport schemas + Q19 / ABC fixtures.
 * No live prompt, publish, Production, or Secrets involvement.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname);
const SCHEMAS = path.join(ROOT, 'schemas');
const FIXTURES = path.join(ROOT, 'fixtures');

const requireFromPkg = createRequire(path.join(ROOT, 'package.json'));
const Ajv2020 = requireFromPkg('ajv/dist/2020').default;

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compileSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const geometry = loadJson(path.join(SCHEMAS, 'exercise-package.geometry.schema.json'));
  const observation = loadJson(path.join(SCHEMAS, 'vision-observation.schema.json'));
  const report = loadJson(path.join(SCHEMAS, 'validation-report.schema.json'));
  return {
    geometry: ajv.compile(geometry),
    observation: ajv.compile(observation),
    report: ajv.compile(report),
  };
}

function assertValid(validate, data, label) {
  const ok = validate(data);
  if (!ok) {
    assert.fail(`${label} schema errors:\n${JSON.stringify(validate.errors, null, 2)}`);
  }
}

function assertInvalid(validate, data, label) {
  assert.equal(validate(data), false, `${label} should fail schema`);
}

describe('exercise-package-vision contract freeze', () => {
  const validators = compileSchemas();

  it('schema files exist', () => {
    for (const name of [
      'exercise-package.geometry.schema.json',
      'vision-observation.schema.json',
      'validation-report.schema.json',
    ]) {
      assert.ok(fs.existsSync(path.join(SCHEMAS, name)), name);
    }
  });

  describe('fixture q19-unlabeled-isosceles', () => {
    const dir = path.join(FIXTURES, 'q19-unlabeled-isosceles');
    const packageGeometry = loadJson(path.join(dir, 'package.geometry.json'));
    const observation = loadJson(path.join(dir, 'vision.observation.json'));
    const report = loadJson(path.join(dir, 'validation.report.json'));

    it('validates against schemas', () => {
      assertValid(validators.geometry, packageGeometry, 'q19 package.geometry');
      assertValid(validators.observation, observation, 'q19 vision.observation');
      assertValid(validators.report, report, 'q19 validation.report');
    });

    it('treats empty vertex glyphs as a valid state for unlabeled PDF', () => {
      assert.deepEqual(observation.layers.vertex_labels.visible_labels, []);
      assert.equal(observation.layers.vertex_labels.emptiness_is_confident, true);
      assert.equal(packageGeometry.expected.labels_on_pdf.A, false);
      assert.equal(packageGeometry.expected.labels_on_pdf.B, false);
      assert.equal(packageGeometry.expected.labels_on_pdf.C, false);
      assert.equal(packageGeometry.expected.labels_on_pdf.H, false);
      assert.equal(report.layers.vertex_labels.status, 'match');
    });

    it('keeps structural geometry anonymous and binds only in the report', () => {
      for (const node of observation.layers.structural.nodes) {
        assert.match(node.id, /^n\d+$/);
      }
      assert.ok(report.bindings.length >= 4);
      for (const binding of report.bindings) {
        assert.match(binding.package, /^[A-Z]$/);
        assert.match(binding.observation, /^n\d+$/);
        assert.equal(binding.visible_glyph, null);
        assert.notEqual(binding.basis, 'glyph');
      }
      assert.equal(report.drawing_policy.reason, 'structure_matched_unlabeled_figure');
      assert.equal(report.drawing_policy.require_visible_labels, false);
      assert.equal(report.drawing_policy.may_use_package_names, true);
    });

    it('records explicit confidence and empty mismatch list when matched', () => {
      assert.ok(report.overall_confidence > 0 && report.overall_confidence <= 1);
      assert.deepEqual(report.mismatches, []);
      assert.equal(report.ok, true);
    });
  });

  describe('fixture abc-labeled-triangle', () => {
    const dir = path.join(FIXTURES, 'abc-labeled-triangle');
    const packageGeometry = loadJson(path.join(dir, 'package.geometry.json'));
    const observation = loadJson(path.join(dir, 'vision.observation.json'));
    const report = loadJson(path.join(dir, 'validation.report.json'));

    it('validates against schemas', () => {
      assertValid(validators.geometry, packageGeometry, 'abc package.geometry');
      assertValid(validators.observation, observation, 'abc vision.observation');
      assertValid(validators.report, report, 'abc validation.report');
    });

    it('requires visible glyphs for the labeled control path', () => {
      const glyphs = observation.layers.vertex_labels.visible_labels.map((x) => x.glyph).sort();
      assert.deepEqual(glyphs, ['A', 'B', 'C']);
      assert.equal(packageGeometry.expected.labels_on_pdf.A, true);
      assert.equal(report.drawing_policy.reason, 'glyph_and_structure_binding');
      assert.equal(report.drawing_policy.require_visible_labels, true);
    });

    it('binds glyph → package without Vision inventing extra names', () => {
      for (const binding of report.bindings) {
        assert.equal(binding.visible_glyph, binding.package);
        assert.equal(binding.basis, 'glyph_and_structure');
        assert.match(binding.observation, /^n\d+$/);
      }
      const observedGlyphs = new Set(
        observation.layers.vertex_labels.visible_labels.map((x) => x.glyph)
      );
      for (const binding of report.bindings) {
        assert.ok(observedGlyphs.has(binding.package), 'binding only uses observed glyphs');
      }
    });
  });

  describe('negative guards (Vision must not invent labels)', () => {
    it('rejects a vertex_labels entry that is not a single A–Z glyph', () => {
      const observation = loadJson(
        path.join(FIXTURES, 'q19-unlabeled-isosceles', 'vision.observation.json')
      );
      observation.layers.vertex_labels.visible_labels = [
        { glyph: 'apex', near: 'vertex', bbox: null, confidence: 0.9 },
      ];
      assertInvalid(validators.observation, observation, 'invented non-glyph label');
    });

    it('rejects structural nodes that use package letters instead of anonymous ids', () => {
      const observation = loadJson(
        path.join(FIXTURES, 'abc-labeled-triangle', 'vision.observation.json')
      );
      observation.layers.structural.nodes[0].id = 'A';
      assertInvalid(validators.observation, observation, 'semantic id in structural layer');
    });

    it('rejects a report binding basis glyph when visible_glyph is null', () => {
      // Encode the product rule in a fixture-level check (schema cannot express
      // cross-field implication without if/then across the whole draft yet).
      const report = loadJson(
        path.join(FIXTURES, 'q19-unlabeled-isosceles', 'validation.report.json')
      );
      for (const binding of report.bindings) {
        if (binding.basis === 'glyph' || binding.basis === 'glyph_and_structure') {
          assert.ok(binding.visible_glyph, 'glyph bases require visible_glyph');
        }
        if (binding.visible_glyph == null) {
          assert.notEqual(binding.basis, 'glyph');
          assert.notEqual(binding.basis, 'glyph_and_structure');
        }
      }
    });
  });
});
