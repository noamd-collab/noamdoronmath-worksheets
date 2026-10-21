/**
 * Compact teacher catalog for the Noam AI classifier.
 * Question ids only — no crop geometry — so the server bundle stays small.
 * Source of truth: public/teachers/teacher-catalog.json and public/teachers/sheets/.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'public/teachers/teacher-catalog.json'), 'utf8'));
const sheetDir = join(root, 'public/teachers/sheets');
const have = new Set(readdirSync(sheetDir).map((name) => name.replace(/\.json$/, '')));

const sheets = [];
for (const grade of catalog.grades || []) {
  for (const topic of grade.topics || []) {
    for (const sheet of topic.sheets || []) {
      const pdfId = String(sheet.pdfId || '');
      if (!/^[0-9a-f]{32}$/i.test(pdfId)) continue;
      // Elementary sheets are catalog rows (topic / level / pdf). Only middle school
      // has a per-exercise file, and only those ids may be picked.
      let questions = [];
      if (sheet.mode === 'exercise' && have.has(pdfId)) {
        const source = JSON.parse(readFileSync(join(sheetDir, pdfId + '.json'), 'utf8'));
        const seen = new Set();
        for (const question of source.questions || []) {
          const id = String(question.id || '').replace(/\s+/g, '');
          if (!id || id.length > 12 || seen.has(id)) continue;
          seen.add(id);
          questions.push(id);
        }
      }
      sheets.push({
        pdfId,
        grade: Number(grade.grade),
        gradeLabel: String(grade.label || ''),
        band: grade.band === 'elementary' ? 'elementary' : 'middle',
        topicId: String(topic.id),
        topic: String(topic.title || ''),
        level: String(sheet.level || ''),
        levelLabel: String(sheet.levelLabel || ''),
        title: String(sheet.title || topic.title || ''),
        mode: sheet.mode === 'exercise' ? 'exercise' : 'sheet',
        pdfUrl: String(sheet.pdfUrl || ''),
        questions,
      });
    }
  }
}

const out = join(root, 'src/data/teacher-pick-index.json');
writeFileSync(out, JSON.stringify(sheets));
const bytes = Buffer.byteLength(JSON.stringify(sheets));
console.log(`sheets=${sheets.length} bytes=${bytes}`);
