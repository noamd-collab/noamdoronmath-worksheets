// The switch values committed in wrangler.jsonc are checked here, before any release. Otherwise a bad
// value is first met by the live preflight, after the old runtime was drained and the new version deployed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { v5Switches } from '../src/controller.ts';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

test('wrangler.jsonc declares only the reviewed plain variables', () => {
  const allowed = ['SOURCE_SHA', 'TEACHER_V5_SITE_READY', 'TEACHER_V5_TOPICS'];
  assert.deepEqual(Object.keys(config.vars).filter(name => !allowed.includes(name)), []);
  assert.equal(typeof config.vars.SOURCE_SHA, 'string');
});

test('the committed switch values are ones the supervisor forwards', () => {
  const { TEACHER_V5_TOPICS: topics = '', TEACHER_V5_SITE_READY: ready = '' } = config.vars;
  assert.doesNotThrow(() => v5Switches(topics, ready));
  // The validator is the one the supervisor uses: it refuses what a release must not carry.
  for (const [badTopics, badReady] of [['g7:a, g7:b', ''], ['g7:a,', ''], ['', 1], ['', 'true'], [['g7:a'], '']])
    assert.throws(() => v5Switches(badTopics, badReady), /^Error: CLOUD_OPERATION_FAILED$/);
  assert.deepEqual(v5Switches('', ''), {});
  assert.deepEqual(v5Switches('ד10,g7:algebraic_expressions', '1'),
    { TEACHER_V5_TOPICS: 'ד10,g7:algebraic_expressions', TEACHER_V5_SITE_READY: '1' });
});
