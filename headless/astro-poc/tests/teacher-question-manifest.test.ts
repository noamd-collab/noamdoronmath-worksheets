import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { GET } from '../src/pages/api/teacherQuestionManifest.ts';

const catalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
const bundle = JSON.parse(readFileSync(new URL('../src/data/teacher-question-previews.json', import.meta.url), 'utf8'));
const previews = JSON.parse(gunzipSync(Buffer.from(bundle.gzipBase64, 'base64')).toString('utf8'));
const activeIds = [...new Set<string>(catalog.grades.flatMap((grade: any) => grade.topics.flatMap((topic: any) => topic.sheets.filter((sheet: any) => sheet.mode === 'exercise').map((sheet: any) => sheet.pdfId))))];
const request = (query: string) => GET({ url: new URL('https://www.noamdoronmath.co.il/api/teacherQuestionManifest?' + query) } as Parameters<typeof GET>[0]);

test('serves the live factoring sheet even though it has no public manifest file', async () => {
  const response = await request('pdfId=6a37fe7160324a17ad107b3dbe43c1db');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  const body = await response.json();
  assert.ok(body.sourceSha256);
  assert.ok(body.exercises.some((item: any) => item.q === 1 && (item.crop || item.crops?.length)));
});

test('preview geometry includes every active exercise sheet and no other sheet', () => {
  assert.equal(activeIds.length, 452);
  assert.ok(bundle.gzipBase64.length < 1_000_000, 'geometry must fit in the Wix deployment request');
  assert.deepEqual(Object.keys(previews).sort(), [...activeIds].sort());
  for (const pdfId of activeIds) {
    const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + pdfId + '.json', import.meta.url), 'utf8'));
    assert.equal(previews[pdfId].sourceSha256, manifest.sourceSha256, pdfId);
    assert.equal(previews[pdfId].exercises.length, manifest.exercises.length, pdfId);
    for (const exercise of previews[pdfId].exercises) {
      assert.ok(exercise.crop || exercise.crops?.length, pdfId + ': ' + exercise.q);
      assert.ok(Object.keys(exercise).every((key) => ['q', 'crop', 'crops', 'pin', 'contextQuestionNumbers'].includes(key)));
    }
  }
});

test('rejects malformed identifiers and never serves a nonactive worksheet', async () => {
  for (const query of ['', 'pdfId=../../secret', 'pdfId=constructor', 'pdfId=not-a-pdf']) {
    assert.equal((await request(query)).status, 400);
  }
  assert.equal((await request('pdfId=00000000000000000000000000000000')).status, 404);
});

test('committed geometry matches the current source manifests and teacher catalog', () => {
  const script = fileURLToPath(new URL('../scripts/build-teacher-question-previews.mjs', import.meta.url));
  execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' });
});
