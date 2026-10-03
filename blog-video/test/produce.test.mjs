import test from 'node:test';
import assert from 'node:assert/strict';
import { blockers, fillTemplate, jobKey } from '../lib/produce.mjs';

const video = { id: 'p--short', variant: 'short', scriptHash: 's1', narrationHash: 'n1', qa: { errors: 0 }, review: 'current', contentStatus: 'noam-approved', production: { status: 'not-started', attempts: 0 } };
const ready = { pilot: { sampleVideoApproved: false, videos: ['p--short'] }, format: { decision: null }, heygen: { avatarId: 'A', voiceId: 'V', avatarOwnerConfirmed: true, voiceOwnerConfirmed: true, narrationText: 'niqqud', quotaChecked: true } };
const contract = { verifiedFromDocs: true };

test('a fully approved pilot video with verified IDs and contract is allowed', () => {
  assert.deepEqual(blockers(video, ready, contract), []);
});

test('each missing approval blocks generation', () => {
  assert.ok(blockers({ ...video, contentStatus: 'awaiting-noam-review' }, ready, contract).length);
  assert.ok(blockers({ ...video, review: 'cited-source-changed' }, ready, contract).length);
  assert.ok(blockers(video, { ...ready, pilot: { sampleVideoApproved: false, videos: [] } }, contract).length);
  assert.ok(blockers(video, { ...ready, heygen: { ...ready.heygen, avatarOwnerConfirmed: false } }, contract).length);
  assert.ok(blockers(video, { ...ready, heygen: { ...ready.heygen, voiceId: null } }, contract).length);
  assert.ok(blockers(video, { ...ready, heygen: { ...ready.heygen, quotaChecked: false } }, contract).length);
  assert.ok(blockers(video, ready, { verifiedFromDocs: false }).length);
  assert.ok(blockers(video, ready, null).length);
  assert.ok(blockers(video, ready, contract, { needKey: true, env: {} }).length);
});

test('after the sample is approved, only the chosen format is produced', () => {
  const after = { ...ready, pilot: { sampleVideoApproved: true, videos: ['p--short'] }, format: { decision: 'long' } };
  assert.ok(blockers(video, after, contract).some((r) => /format decision/.test(r)));
  assert.deepEqual(blockers(video, { ...after, format: { decision: 'short' } }, contract), []);
});

test('no duplicate generation for the same script, voice and avatar', () => {
  const key = jobKey(video, ready.heygen);
  const done = { ...video, production: { status: 'rendered', videoId: 'v123', jobKey: key, attempts: 1 } };
  assert.ok(blockers(done, ready, contract).some((r) => /already generated/.test(r)));
  const inflight = { ...video, production: { status: 'submitted', jobKey: key, attempts: 1 } };
  assert.ok(blockers(inflight, ready, contract).some((r) => /already submitted/.test(r)));
  const spent = { ...video, production: { status: 'failed', jobKey: key, attempts: 2 } };
  assert.ok(blockers(spent, ready, contract).some((r) => /attempt limit/.test(r)));
  // A changed script is a different job.
  assert.notEqual(jobKey({ ...video, scriptHash: 's2' }, ready.heygen), key);
});

test('templates are filled only from known values', () => {
  assert.deepEqual(fillTemplate({ a: '{{x}}', b: ['id-{{y}}'] }, { x: 5, y: 'q' }), { a: 5, b: ['id-q'] });
  assert.throws(() => fillTemplate({ a: '{{missing}}' }, {}));
});

import { compareTranscript } from '../lib/produce.mjs';
test('subtitle comparison flags a paraphrased narration and accepts a verbatim one', () => {
  const script = 'מי שמחשב משמאל לימין מקבל שלושים. אבל התשובה הנכונה היא ארבע עשרה.';
  const srt = '1\n00:00:00,000 --> 00:00:02,000\nמי שמחשב משמאל לימין מקבל שלושים.\n\n2\n00:00:02,000 --> 00:00:04,000\nאבל התשובה הנכונה היא ארבע עשרה.\n';
  assert.equal(compareTranscript(script, srt).ratio, 1);
  const para = 'WEBVTT\n\n00:00.000 --> 00:02.000\nאם מחשבים משמאל לימין יוצא שלושים, אבל התשובה היא 14.\n';
  const r = compareTranscript(script, para);
  assert.ok(r.ratio < 0.8);
  assert.ok(r.missing.includes('הנכונה'));
});
