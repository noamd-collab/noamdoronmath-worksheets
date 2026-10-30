import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

const pub = new URL('../public/', import.meta.url);
const repairs = JSON.parse(readFileSync(new URL('./fixtures/native-geometry-repair.json', import.meta.url), 'utf8'));
const read = (relative: string) => JSON.parse(readFileSync(new URL(relative, pub), 'utf8'));

it('repaired native questions preserve exact tasks and give every subsection the whole question image', () => {
  let exercises = 0;
  for (const row of repairs.files) {
    const relative = `noam-ai/manifests/${row.pdfId}.json`;
    const manifest = read(relative), native = read(manifest.nativeExportUrl.slice(1));
    assert.equal(manifest.sourceSha256, row.pdfSha256);
    assert.equal(manifest.exercises.length, row.subsections);
    assert.equal(manifest.questions.length, row.mainQuestions);
    assert.equal(readFileSync(new URL('../../../' + relative, import.meta.url), 'utf8'), readFileSync(new URL(relative, pub), 'utf8'));
    for (const question of native.questions) {
      const parts = manifest.exercises.filter((e: any) => e.nativeQuestionId === question.id);
      for (const exercise of parts) {
        exercises++;
        const item = question.items.find((i: any) => i.id === exercise.nativeItemId);
        assert.equal(exercise.part, item.label);
        assert.equal(exercise.text, item.text);
        assert.ok(exercise.prompt.includes('הסעיף הנבחר: ' + item.text));
        assert.equal(exercise.requiresVision, true, 'source geometry repair must not bypass image verification');
        assert.deepEqual(exercise.crops, parts[0].crops, 'shared question image must include the introduction and figure for later parts');
        assert.ok(exercise.crops.some((c: any) => c.page === exercise.pin.page && c.y - .001 <= exercise.pin.y && c.y + c.h + .001 >= exercise.pin.y));
      }
    }
  }
  assert.equal(exercises, repairs.subsections);
});

it('W07 q12c image includes the actual introduction, graph and selected text instead of blank page space', () => {
  const manifest = read('noam-ai/manifests/d7eaeb9328c44b029e283beb206d3c67.json');
  const exercise = manifest.exercises.find((e: any) => e.id === 'G8-T12-B-Q12ג');
  assert.equal(manifest.sourceSha256, 'd1c9c0224f34a385d9ab3d91c9988caa39bda20071f871de858c40cdf6d61d4c');
  // Measured from the exact approved PDF, page 11 (841.8897705078125pt high).
  const height = 841.8897705078125;
  const crop = exercise.crops.find((c: any) => c.page === 11);
  for (const y of [48.95, 79.45, 256.53, 449.31, 479.7]) {
    assert.ok(crop.y <= y / height + .00001 && crop.y + crop.h >= y / height - .00001, `source ink at ${y}pt is included`);
  }
  assert.ok(Math.abs(exercise.pin.y - 449.31 / height) < .00001);
  assert.ok(crop.y + crop.h < .8, 'do not send the former blank bottom-page band');
  assert.equal(exercise.crops.length, 1, 'q13 on the following page must not enter this image');
});

it('corrected geometry refreshes cached manifests and OCR while retaining conversation history', () => {
  for (const url of [new URL('../public/worksheet-viewer-noam.html', import.meta.url), new URL('../../../worksheet-viewer-noam.html', import.meta.url)]) {
    const viewer = readFileSync(url, 'utf8');
    assert.match(viewer, /MANIFEST_PATH = [^\n]+\.json\?v=20261028-item-figure-scope/);
    assert.match(viewer, /ANALYSIS_STORAGE_KEY = "noam-static-analysis-v3-source-bound-20261030:"/);
    assert.match(viewer, /THREAD_STORAGE_KEY = "noam-static-threads-v1:"/);
  }
});

it('teacher source crops follow the same repaired PDF geometry and retain subsection identities', () => {
  for (const row of repairs.files) {
    const manifest = read(`noam-ai/manifests/${row.pdfId}.json`);
    const sheet = read(`teachers/sheets/${row.pdfId}.json`);
    assert.equal(sheet.sourceSha256, manifest.sourceSha256);
    assert.deepEqual(sheet.questions.map((q: any) => [q.q, q.part, q.text]), manifest.exercises.map((e: any) => [e.q, e.part, e.text]));
  }
  const question = read('teachers/sheets/d7eaeb9328c44b029e283beb206d3c67.json').questions.find((q: any) => q.id === '12ג');
  assert.equal(question.page, 11);
  assert.ok(question.row.y <= .533696 && question.row.y + question.row.h >= 479.7 / 841.8897705078125);
  assert.ok(question.stem.y <= 49 / 841.8897705078125 && question.stem.y + question.stem.h >= 285 / 841.8897705078125);
});
