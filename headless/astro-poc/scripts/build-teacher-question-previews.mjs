// Compile only public crop geometry for active teacher sheets. Serving this from
// one API route avoids adding hundreds of files to Wix's static-asset allowance.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const catalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
const previews = {};
for (const grade of catalog.grades) {
  for (const topic of grade.topics) {
    for (const sheet of topic.sheets) {
      if (sheet.mode !== 'exercise') throw new Error('Missing question-level data for ' + sheet.pdfId);
      if (previews[sheet.pdfId]) continue;
      const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + sheet.pdfId + '.json', import.meta.url), 'utf8'));
      if (!Array.isArray(manifest.exercises) || !manifest.exercises.length) {
        throw new Error('Missing preview exercises for ' + sheet.pdfId);
      }
      previews[sheet.pdfId] = {
        sourceSha256: manifest.sourceSha256,
        exercises: manifest.exercises.map((exercise) => {
          const item = { q: exercise.q };
          for (const key of ['crop', 'crops', 'pin', 'contextQuestionNumbers']) {
            if (exercise[key] !== undefined) item[key] = exercise[key];
          }
          return item;
        }),
      };
    }
  }
}
if (!Object.keys(previews).length) throw new Error('No active teacher exercise sheets found');
// Wix sends server modules in one deployment request. Keep the geometry compact
// in that request; the endpoint expands it once per running worker.
const source = JSON.stringify(previews);
const output = JSON.stringify({ version: 1, sheets: Object.keys(previews).length, gzipBase64: gzipSync(source, { level: 9 }).toString('base64') }) + '\n';
const target = new URL('../src/data/teacher-question-previews.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Teacher question preview geometry is stale. Run node scripts/build-teacher-question-previews.mjs');
} else {
  writeFileSync(target, output);
}
console.log(JSON.stringify({ sheets: Object.keys(previews).length, bytes: Buffer.byteLength(output) }));
