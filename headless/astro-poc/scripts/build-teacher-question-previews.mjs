// Compile only public crop geometry for active teacher sheets. Serving this from
// one API route avoids adding hundreds of files to Wix's static-asset allowance.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { verifyQuestionPreviewArtifact } from './lib/question-preview-artifact.mjs';
import { measuredQuestionPreview } from './lib/measured-worksheet.mjs';
import { fileURLToPath } from 'node:url';

export function compileQuestionPreviews(catalog, loadManifest, options) {
const previews = {};
for (const grade of catalog.grades) {
  for (const topic of grade.topics) {
    for (const sheet of topic.sheets) {
      if (sheet.mode !== 'exercise') throw new Error('Missing question-level data for ' + sheet.pdfId);
      if (previews[sheet.pdfId]) continue;
      const manifest = loadManifest(sheet.pdfId);
      if (manifest.geometryContract !== undefined && manifest.geometryContract !== 'measured-v1') throw new Error('Unsupported worksheet geometry contract');
      if (!Array.isArray(manifest.exercises) || !manifest.exercises.length) {
        throw new Error('Missing preview exercises for ' + sheet.pdfId);
      }
      previews[sheet.pdfId] = manifest.geometryContract === 'measured-v1' ? measuredQuestionPreview(manifest, options) : {
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
return previews;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
const catalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
const previews = compileQuestionPreviews(catalog, pdfId => JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + pdfId + '.json', import.meta.url), 'utf8')));
// Wix sends server modules in one deployment request. Keep the geometry compact
// in that request; the endpoint expands it once per running worker.
const source = JSON.stringify(previews);
const output = JSON.stringify({ version: 1, sheets: Object.keys(previews).length, gzipBase64: gzipSync(source, { level: 9 }).toString('base64') }) + '\n';
const target = new URL('../src/data/teacher-question-previews.json', import.meta.url);
if (process.argv.includes('--check')) {
  verifyQuestionPreviewArtifact(readFileSync(target, 'utf8'), previews);
} else {
  writeFileSync(target, output);
}
console.log(JSON.stringify({ sheets: Object.keys(previews).length, bytes: Buffer.byteLength(output) }));
}
