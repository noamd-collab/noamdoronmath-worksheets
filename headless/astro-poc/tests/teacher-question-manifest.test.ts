import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { test, type TestContext } from 'node:test';
import { GET } from '../src/pages/api/teacherQuestionManifest.ts';
import { TEACHER_ACCESS_CONFIG } from '../src/lib/teacherAccessConfig';
import { TEACHER_PRIVATE_HEADERS, TEACHER_SESSION_COOKIE } from '../src/lib/teacherAccess';

const catalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
const bundle = JSON.parse(readFileSync(new URL('../src/data/teacher-question-previews.json', import.meta.url), 'utf8'));
const previews = JSON.parse(gunzipSync(Buffer.from(bundle.gzipBase64, 'base64')).toString('utf8'));
const activeIds = [...new Set<string>(catalog.grades.flatMap((grade: any) => grade.topics.flatMap((topic: any) => topic.sheets.filter((sheet: any) => sheet.mode === 'exercise').map((sheet: any) => sheet.pdfId))))];
function request(query: string, token?: string) {
  const url = new URL('https://www.noamdoronmath.co.il/api/teacherQuestionManifest?' + query);
  return GET({ url, request: new Request(url, {
    headers: token ? { cookie: TEACHER_SESSION_COOKIE + '=' + token } : {},
  }) } as Parameters<typeof GET>[0]);
}

/** Exercise the real route and owner verifier while isolating every Auth request. */
function ownerRequests(t: TestContext, userId = TEACHER_ACCESS_CONFIG.ownerUserId) {
  const token = 'header.' + Buffer.from(JSON.stringify({ sub: userId,
    iss: TEACHER_ACCESS_CONFIG.supabaseUrl + '/auth/v1', aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url') + '.synthetic-signature';
  let authCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    authCalls++;
    assert.equal(url, TEACHER_ACCESS_CONFIG.supabaseUrl + '/auth/v1/user');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer ' + token);
    return Response.json({ id: userId, email: 'fixture@example.test', email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'google' }, identities: [{ provider: 'google', user_id: userId }] });
  });
  return async (query: string) => {
    const before = authCalls;
    const response = await request(query, token);
    assert.equal(authCalls, before + 1, 'Every geometry request verifies the owner before serving content');
    for (const [key, value] of Object.entries(TEACHER_PRIVATE_HEADERS)) assert.equal(response.headers.get(key), value);
    return response;
  };
}

test('serves the current factoring release from compiled preview geometry to the authenticated owner', async (t) => {
  const request = ownerRequests(t);
  const factoring = catalog.grades.find((grade: any) => grade.grade === 9).topics.find((topic: any) => topic.id === 2);
  const sheet = factoring.sheets.find((sheet: any) => sheet.level === 'a');
  assert.equal(sheet.pdfId, '2a6385d4e649433e89a2636d05be7e99');
  const response = await request('pdfId=' + sheet.pdfId);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  const body = await response.json();
  assert.ok(body.sourceSha256);
  assert.ok(body.exercises.some((item: any) => item.q === 1 && (item.crop || item.crops?.length)));
});

test('preview geometry includes every active exercise sheet and no other sheet', () => {
  assert.equal(activeIds.filter(id => previews[id].geometryContract !== 'measured-v1').length, 936); // +3 sheets: grade 8 topic 67 (Noam, 2026-11-09)
  assert.ok(bundle.gzipBase64.length < 1_000_000, 'geometry must fit in the Wix deployment request');
  assert.deepEqual(Object.keys(previews).sort(), [...activeIds].sort());
  for (const pdfId of activeIds) {
    const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + pdfId + '.json', import.meta.url), 'utf8'));
    assert.equal(previews[pdfId].sourceSha256, manifest.sourceSha256, pdfId);
    assert.equal(previews[pdfId].exercises.length, manifest.exercises.length, pdfId);
    for (const exercise of previews[pdfId].exercises) {
      assert.ok(exercise.crop || exercise.crops?.length, pdfId + ': ' + exercise.q);
      if (manifest.geometryContract === 'measured-v1') {
        const original = manifest.exercises.find((row: any) => row.id === exercise.id);
        assert.ok(original);
        for (const [key,value] of Object.entries(exercise)) assert.deepEqual(value,original[key],key);
      } else assert.ok(Object.keys(exercise).every((key) => ['q', 'crop', 'crops', 'pin', 'contextQuestionNumbers'].includes(key)));
    }
  }
});

test('every elementary original is mapped to full questions with valid physical crops', async (t) => {
  const request = ownerRequests(t);
  let sheets = 0;
  for (const grade of catalog.grades.filter((grade: any) => grade.grade <= 6)) {
    for (const topic of grade.topics) for (const sheet of topic.sheets.filter((sheet: any) => !sheet.editionId)) {
      sheets += 1;
      assert.equal(sheet.mode, 'exercise', sheet.pdfId);
      const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + sheet.pdfId + '.json', import.meta.url), 'utf8'));
      const source = JSON.parse(readFileSync(new URL('../public/teachers/sheets/' + sheet.pdfId + '.json', import.meta.url), 'utf8'));
      assert.equal(manifest.wholeQuestionGeometry, true, sheet.pdfId);
      assert.equal(source.wholeQuestionGeometry, true, sheet.pdfId);
      assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
      assert.equal(source.sourceSha256, manifest.sourceSha256);
      assert.ok(manifest.answerStartPage > manifest.exercisePageCount);
      assert.ok(manifest.answerStartPage <= manifest.pageCount);
      assert.deepEqual(manifest.exercises.map((e: any) => e.q), Array.from({length: manifest.questionCount}, (_, i) => i + 1), sheet.pdfId);
      assert.equal(source.questions.length, manifest.questionCount);
      for (const exercise of manifest.exercises) {
        const question = source.questions.find((q: any) => q.q === exercise.q);
        assert.ok(question, `${sheet.pdfId}: ${exercise.q}`);
        assert.equal(question.id, String(exercise.q));
        assert.equal(question.part, '');
        const crops = exercise.crops?.length ? exercise.crops : [exercise.crop];
        assert.equal(question.rows.length, crops.length);
        assert.ok(crops.some((box: any) => box.page === exercise.pin.page && exercise.pin.x >= box.x - 0.001 && exercise.pin.x <= box.x + box.w + 0.001 && exercise.pin.y >= box.y - 0.001 && exercise.pin.y <= box.y + box.h + 0.001));
        for (let i = 0; i < crops.length; i++) {
          const box = crops[i];
          assert.ok(box.page >= 1 && box.page <= manifest.exercisePageCount);
          assert.ok(box.x >= 0 && box.y >= 0 && box.w > 0 && box.h > 0);
          assert.ok(box.x + box.w <= 1.00001 && box.y + box.h <= 1.00001);
          for (const coordinate of ['x', 'y', 'w', 'h']) {
            assert.ok(Math.abs(box[coordinate] - question.rows[i][coordinate]) < 0.0001, `${sheet.pdfId}:${exercise.q}:${coordinate}`);
          }
        }
      }
      assert.equal((await request('pdfId=' + sheet.pdfId)).status, 200);
    }
  }
  assert.equal(sheets, 507);
});

test('kite excellence includes starred questions 14, 16 and 20 with unique physical subparts', () => {
  const pdfId = '7adbcdb3bb5c49d1b9e3c38ea74a1285';
  const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + pdfId + '.json', import.meta.url), 'utf8'));
  const source = JSON.parse(readFileSync(new URL('../public/teachers/sheets/' + pdfId + '.json', import.meta.url), 'utf8'));
  assert.equal(manifest.questionCount, 20);
  assert.equal(manifest.exercises.length, 71);
  assert.equal(new Set(source.questions.map((q: any) => q.id)).size, 71);
  assert.deepEqual([...new Set(manifest.exercises.map((q: any) => q.q))], Array.from({length: 20}, (_, i) => i + 1));
  for (const [q, pages] of [[14, [11]], [16, [12, 13]], [20, [15, 16]]] as [number, number[]][]) {
    const rows = manifest.exercises.find((exercise: any) => exercise.q === q).crops;
    assert.deepEqual(rows.map((row: any) => row.page), pages);
    assert.ok(rows.every((row: any) => row.h > 0.01));
  }
});

test('rejects malformed identifiers and never serves a nonactive worksheet for the authenticated owner', async (t) => {
  const request = ownerRequests(t);
  for (const query of ['', 'pdfId=../../secret', 'pdfId=constructor', 'pdfId=not-a-pdf']) {
    assert.equal((await request(query)).status, 400);
  }
  assert.equal((await request('pdfId=00000000000000000000000000000000')).status, 404);
  assert.equal((await request('pdfId=6a37fe7160324a17ad107b3dbe43c1db')).status, 404, 'Archived factoring stays available as a sheet file but is not an active preview release');
});

test('anonymous preview requests are denied before identifier validation without any Auth or content fetch', async (t) => {
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetches++; throw new Error('Unexpected anonymous network request'); });
  for (const query of ['pdfId=' + activeIds[0], 'pdfId=../../secret', '']) {
    const response = await request(query);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: 'TEACHER_SIGN_IN_REQUIRED' });
    for (const [key, value] of Object.entries(TEACHER_PRIVATE_HEADERS)) assert.equal(response.headers.get(key), value);
  }
  assert.equal(fetches, 0);
});

test('a valid Google session belonging to another user cannot read active preview geometry', async (t) => {
  const request = ownerRequests(t, '99999999-2222-4333-8444-555555555555');
  const response = await request('pdfId=' + activeIds[0]);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: 'TEACHER_ACCESS_DENIED' });
});

test('committed geometry matches the current source manifests and teacher catalog', () => {
  const script = fileURLToPath(new URL('../scripts/build-teacher-question-previews.mjs', import.meta.url));
  execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' });
});
