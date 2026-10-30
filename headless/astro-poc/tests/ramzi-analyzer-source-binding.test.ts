import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';

const pub = new URL('../public/', import.meta.url);
const copy = (value: any) => JSON.parse(JSON.stringify(value));
const sha = 'a'.repeat(64), otherSha = 'b'.repeat(64);
function fn(viewer: string, name: string) {
  const start = viewer.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = viewer.indexOf('\nfunction ', start + 1);
  return viewer.slice(start, end);
}
function fixture(viewer: string) {
  const exercise: any = { id: 'G7-T09-A-Q03ג', part: 'ג', nativeQuestionId: 'q3', nativeItemId: 'q3c',
    requiresVision: true, crops: [{ page: 1, x: .1, y: .2, w: .8, h: .3 }] };
  const calls: any[] = [], attachments: any[] = [];
  const context: any = { Promise, console: { warn() {} }, manifest: { nativeExportSha256: sha, sourceSha256: 'c'.repeat(64) },
    pdf: 'sample-pdf', analysisCache: {}, exercisePreviewCache: {}, API: '/model', saveNoamState() {},
    currentAttachments: () => attachments, noamManifestOcrUnreliable: () => false, noamExerciseNeedsLiveVision: () => true,
    syntheticAnalysis: () => ({ readable: true, transcription: 'synthetic' }),
    noamScopedExerciseSemantic: () => 'stale manifest expression', ensurePdfDocumentForCrop: async () => null,
    noamRebuildSelectedPartExpression: async () => ({ expression: 'stale PDF expression' }),
    cropExerciseImage: async () => 'worksheet-image',
    exerciseImageWithAttachments: async (_e: any, snapshot: any[]) => JSON.stringify(snapshot),
    isBotProtectionError: (error: any) => error?.bot === true,
    postJson: async (url: string, payload: any) => {
      calls.push({ url, payload: copy(payload) });
      return { ok: true, analysis: { readable: true, readability_confidence: .8, transcription: 'printed task',
        problem_statement: 'printed task', math_content: '7-2n', diagram_description: 'unverified visual',
        content_type: 'native_source_text', source_context: { serverVerified: true, status: 'verified',
          verificationScope: 'printed_text', exerciseId: payload.exerciseId, selectedPart: payload.selectedPart,
          sourceSha256: payload.sourceIdentity?.nativeSha256 || sha, questionId: payload.sourceIdentity?.questionId || 'q3',
          itemId: payload.sourceIdentity?.itemId || 'q3c', attachmentStatus: 'none', visualStatus: 'unverified' } } };
    } };
  runInNewContext(fn(viewer, 'getExerciseAnalysis') + '\n' + fn(viewer, 'clearExerciseVisionCache'), context);
  return { c: context, exercise, calls, attachments };
}

for (const relative of ['../public/worksheet-viewer-noam.html', '../../../worksheet-viewer-noam.html']) {
  const viewer = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const name = relative.includes('public') ? 'public' : 'root';
  it(name + ': worksheet metadata is captured before crop and verified printed text survives all viewer transforms', async () => {
    const f = fixture(viewer); let finish: any;
    f.c.cropExerciseImage = () => new Promise(resolve => { finish = resolve; });
    const pending = f.c.getExerciseAnalysis(f.exercise, []);
    while (!finish) await Promise.resolve();
    f.c.manifest = { nativeExportSha256: otherSha };
    f.c.selectedExercise = { id: 'G8-T11-B-Q02א', part: 'א' };
    f.attachments.push({ image: 'added later' });
    finish('worksheet-image'); const result = await pending;
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].payload.sourceIdentity, { nativeSha256: sha, questionId: 'q3', itemId: 'q3c' });
    assert.equal(f.calls[0].payload.exerciseId, f.exercise.id);
    assert.equal(f.calls[0].payload.selectedPart, 'ג');
    assert.equal(f.calls[0].payload.hasStudentAttachments, false);
    assert.equal(result.math_content, '7-2n');
    assert.equal(result.transcription, 'printed task');
    assert.equal(result.problem_statement, 'printed task');
    assert.equal(result.selected_part_expression, undefined);
    assert.equal(result.diagram_description, 'unverified visual');
    assert.equal(result.readability_confidence, .8);
  });
  it(name + ': photo requests preserve their captured membership and all OCR work without caching', async () => {
    const f = fixture(viewer); f.attachments.push({ image: 'photo-A' }); let finish: any;
    f.c.exerciseImageWithAttachments = async (_e: any, snapshot: any[]) => {
      await new Promise(resolve => { finish = resolve; }); return JSON.stringify(snapshot);
    };
    const work = { readable: true, transcription: 'student work in transcription', problem_statement: 'student steps', student_work: 'handwritten work' };
    f.c.postJson = async (url: string, payload: any) => { f.calls.push({ url, payload: copy(payload) }); return { ok: true, analysis: copy(work) }; };
    const pending = f.c.getExerciseAnalysis(f.exercise);
    f.attachments.splice(0, 1, { image: 'photo-B' }); finish(); const result = await pending;
    assert.equal(f.calls[0].payload.hasStudentAttachments, true);
    assert.deepEqual(JSON.parse(f.calls[0].payload.imageDataUrl), [{ image: 'photo-A' }]);
    assert.equal(f.calls[0].payload.exerciseId, f.exercise.id);
    assert.equal(result.student_work, work.student_work);
    assert.ok(result.transcription.includes(work.transcription));
    assert.ok(result.problem_statement.includes(work.problem_statement));
    assert.deepEqual(Object.keys(f.c.analysisCache), []);
  });
  it(name + ': wrong part, exercise, source hash or native IDs cannot authorize skipping PDF rebuilding', async () => {
    for (const change of [{ exerciseId: 'other' }, { selectedPart: 'א' }, { sourceSha256: otherSha },
      { questionId: 'q4' }, { itemId: 'q3a' }, { attachmentStatus: 'present' }, { serverVerified: false },
      { verificationScope: 'visual' }, { status: 'unavailable' }]) {
      const f = fixture(viewer), post = f.c.postJson;
      f.c.postJson = async (...args: any[]) => { const result = await post(...args); Object.assign(result.analysis.source_context, change); return result; };
      const result = await f.c.getExerciseAnalysis(f.exercise, []);
      assert.equal(result.selected_part_expression, 'stale PDF expression', JSON.stringify(change));
    }
  });
  it(name + ': identical requests reuse cache; sibling tasks and changed source revisions cannot', async () => {
    const f = fixture(viewer);
    await f.c.getExerciseAnalysis(f.exercise, []); await f.c.getExerciseAnalysis(f.exercise, []);
    assert.equal(f.calls.length, 1);
    const sibling = { ...f.exercise, id: 'G7-T09-A-Q03ב', part: 'ב', nativeItemId: 'q3b' };
    await f.c.getExerciseAnalysis(sibling, []); assert.equal(f.calls.length, 2);
    f.c.manifest.nativeExportSha256 = otherSha;
    await f.c.getExerciseAnalysis(f.exercise, []); assert.equal(f.calls.length, 3);
    f.c.clearExerciseVisionCache(f.exercise);
    assert.ok(!Object.keys(f.c.analysisCache).some(key => key.startsWith('image:' + f.exercise.id + ':')));
    assert.equal(f.c.analysisCache['identity:' + f.exercise.id], undefined);
    assert.ok(f.c.analysisCache[sibling.id]);
    await f.c.getExerciseAnalysis(f.exercise, []); assert.equal(f.calls.length, 4);
  });
  it(name + ': incomplete native metadata is omitted and bot refusals do not cause a second paid request', async () => {
    const f = fixture(viewer); f.c.manifest.nativeExportSha256 = 'invalid';
    await f.c.getExerciseAnalysis(f.exercise, []);
    assert.equal(f.calls[0].payload.sourceIdentity, undefined);
    const g = fixture(viewer), refused = Object.assign(new Error('verification refused'), { bot: true });
    g.c.postJson = async () => { g.calls.push('refused'); throw refused; };
    await assert.rejects(g.c.getExerciseAnalysis(g.exercise, []), refused);
    assert.equal(g.calls.length, 1);
  });
  it(name + ': only the analysis namespace is refreshed, preserving saved conversations', () => {
    assert.match(viewer, /ANALYSIS_STORAGE_KEY = "noam-static-analysis-v3-source-bound-20261030:"/);
    assert.match(viewer, /THREAD_STORAGE_KEY = "noam-static-threads-v1:"/);
  });
}

it('every published native SHA selector names the exact unchanged native JSON bytes', () => {
  let checked = 0;
  for (const file of readdirSync(new URL('noam-ai/manifests/', pub))) {
    if (!file.endsWith('.json')) continue;
    const manifest = JSON.parse(readFileSync(new URL('noam-ai/manifests/' + file, pub), 'utf8'));
    if (!manifest.nativeExportUrl || !manifest.nativeExportSha256) continue;
    const bytes = readFileSync(new URL(manifest.nativeExportUrl.slice(1), pub));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.nativeExportSha256, file);
    checked++;
  }
  assert.ok(checked > 400);
});
