import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isTeacherGenerationDraftReady, WORKSHEET_WIRE_5_SKIP_ALLOWED } from '../src/lib/teacherGenerationContract';

// The same cases and answers the PGlite verifier checks against the database rule (M1).
type ReadinessCase = { name: string; document: unknown; ready: boolean };
const fixture = JSON.parse(readFileSync(new URL('../../../tools/security/fixtures/teacher-draft-readiness-cases.json', import.meta.url), 'utf8')) as
  Record<'accepted' | 'denied' | 'legacy', ReadinessCase[]>;
const groups = (['accepted', 'denied', 'legacy'] as const).map(group => [group, fixture[group]] as const);

test('the server copy of the readiness rule gives the database answer for every shared case', () => {
  for (const [group, cases] of groups) {
    assert.ok(Array.isArray(cases) && cases.length > 0, group);
    for (const { name, document, ready } of cases) {
      assert.equal(typeof ready, 'boolean', name);
      assert.strictEqual(isTeacherGenerationDraftReady(structuredClone(document)), ready, `${group}: ${name}`);
    }
  }
  assert.ok(fixture.accepted.every(entry => entry.ready === true));
  assert.ok(fixture.denied.every(entry => entry.ready === false));
  assert.ok(fixture.legacy.some(entry => entry.ready) && fixture.legacy.some(entry => !entry.ready));
});

test('the D22 list of the server and browser copies is exactly runner.V5_NOT_RUN_ALLOWED', () => {
  const quoted = (text: string) => [...text.matchAll(/'([^']*)'/g)].map(match => match[1]);
  const runner = readFileSync(new URL('../../../tools/teacher-generation/runner.py', import.meta.url), 'utf8');
  const strings = quoted(runner.match(/V5_NOT_RUN_ALLOWED=frozenset\(\{([\s\S]*?)\}\)/)![1]).map(text => text.replace(/\\u2013/g, '–'));
  const template = strings.filter(text => text.includes('%s'));
  assert.equal(template.length, 1);
  const gates = strings.filter(text => /^G\d+-/.test(text));
  const python = [...strings.filter(text => !template.includes(text) && !gates.includes(text)),
    ...gates.map(gate => template[0].replace('%s', gate))].sort();
  assert.equal(python.length, 9);
  assert.deepEqual([...WORKSHEET_WIRE_5_SKIP_ALLOWED].sort(), python);
  assert.equal(new Set(WORKSHEET_WIRE_5_SKIP_ALLOWED).size, WORKSHEET_WIRE_5_SKIP_ALLOWED.length);
  const browser = readFileSync(new URL('../public/teachers/generation-v3.js', import.meta.url), 'utf8');
  const lists = [...browser.matchAll(/const v5SkipAllowed=\[([\s\S]*?)\];/g)];
  assert.equal(lists.length, 1);
  const shipped = quoted(lists[0][1]);
  assert.deepEqual([...shipped].sort(), python);
  assert.equal(new Set(shipped).size, shipped.length);
});
