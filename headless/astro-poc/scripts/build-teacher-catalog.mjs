/**
 * Teacher picker data, from the site catalog only.
 * Middle-school sheets (grades 7–9) also get per-exercise crops from the
 * existing manifests. Elementary sheets stay sheet / level records.
 * Does not invent exercises. The grade-9 factoring level A file is copied
 * as-is so the pilot boxes stay the ones already checked.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const catalogPath = join(scriptDir, '../src/data/catalog.v1.json');
const manifestDir = join(repoRoot, 'noam-ai/manifests');
const richPath = join(repoRoot, 'demos/factoring-grade-9-a-source.json');
const outDir = join(scriptDir, '../public/teachers');
const sheetDir = join(outDir, 'sheets');
const PDF_BASE = 'https://static.wixstatic.com/ugd/d8e7ad_';

function round(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function markBox(pin) {
  const w = 0.16;
  const h = 0.028;
  let x = pin.x - w * 0.85;
  let y = pin.y - h / 2;
  x = Math.max(0, Math.min(x, 1 - w));
  y = Math.max(0, Math.min(y, 1 - h));
  return { x: round(x), y: round(y), w, h };
}

function cropBox(page, x, y, w, h) {
  const left = Math.max(0, Math.min(0.2, Number(x) || 0));
  const width = Math.max(0.5, Math.min(1 - left, Number(w) || 1));
  const top = Math.max(0, Math.min(0.98, Number(y) || 0));
  const height = Math.max(0.008, Math.min(0.995 - top, Number(h) || 0.008));
  return { page, x: round(left), y: round(top), w: round(width), h: round(height) };
}

/** One crop per chosen part: from this pin to the next part on the same page. */
export function partRows(exercises, index) {
  const exercise = exercises[index];
  const pin = exercise.pin;
  const slices = exercise.crops && exercise.crops.length ? exercise.crops : [exercise.crop];
  const here = slices.find((slice) => slice.page === pin.page) || exercise.crop || { x: 0, w: 1, y: pin.y, h: 0.04 };
  const nextPart = exercises.slice(index + 1).find((item) => (
    item.q === exercise.q && item.pin && item.pin.page === pin.page && item.pin.y > pin.y + 0.004
  ));
  if (nextPart) return [cropBox(pin.page, here.x, pin.y, here.w, nextPart.pin.y - pin.y)];
  const end = here.page === pin.page ? here.y + here.h : pin.y + 0.04;
  const rows = [cropBox(pin.page, here.x, pin.y, here.w, Math.max(0.012, end - pin.y))];
  const next = exercises[index + 1];
  if (!next || next.q !== exercise.q || !next.pin || next.pin.page <= pin.page) return rows;
  for (const slice of slices) {
    if (slice.page <= pin.page) continue;
    if (slice.page < next.pin.page) rows.push(cropBox(slice.page, slice.x, slice.y, slice.w, slice.h));
    else if (slice.page === next.pin.page && next.pin.y > slice.y + 0.008) {
      rows.push(cropBox(slice.page, slice.x, slice.y, slice.w, Math.min(slice.h, next.pin.y - slice.y)));
    }
  }
  return rows;
}

function stemBox(exercises, exercise) {
  const first = exercises.find((item) => item.q === exercise.q);
  const crop = first && first.crop;
  if (!first || !crop || crop.page !== first.pin.page) return null;
  const height = first.pin.y - crop.y;
  if (height < 0.012) return null;
  return { page: crop.page, x: round(crop.x || 0), y: round(crop.y), w: round(crop.w || 1), h: round(height) };
}

export function pdfUrl(pdfId) {
  return PDF_BASE + pdfId + '.pdf';
}

export function sheetFromManifest(meta, manifest) {
  const exercises = manifest.exercises || [];
  const first = exercises[0];
  const last = exercises[exercises.length - 1];
  const headerH = first && first.crop && first.crop.page === 1
    ? Math.min(0.42, Math.max(0.04, first.crop.y))
    : 0.08;
  const end = last ? last.crop.y + last.crop.h : 0.94;
  const footerY = end > 0.97 ? 0.985 : Math.max(end, 0.94);
  const questions = exercises.map((exercise, index) => {
    const part = exercise.part || '';
    const id = String(exercise.q) + part;
    const label = part ? `שאלה ${exercise.q} סעיף ${part}` : `שאלה ${exercise.q}`;
    const rows = partRows(exercises, index);
    const stem = stemBox(exercises, exercise);
    return {
      id,
      q: exercise.q,
      part,
      page: exercise.pin.page,
      label,
      text: exercise.text || label,
      box: markBox(exercise.pin),
      row: rows[0],
      rows,
      ...(stem ? { stem } : {}),
    };
  });
  return {
    case: `catalog-${meta.grade}-${meta.topicId}-${meta.level}`,
    grade: meta.grade,
    topicId: meta.topicId,
    topic: meta.topic,
    level: meta.level,
    levelLabel: meta.levelLabel,
    pdfId: meta.pdfId,
    pdfUrl: meta.pdfUrl,
    title: meta.title,
    pageCount: manifest.pageCount,
    mode: 'exercise',
    headerCrop: { page: 1, x: 0, y: 0, w: 1, h: round(headerH) },
    footerCrop: {
      page: last ? last.crop.page : 1,
      x: 0,
      y: round(Math.min(footerY, 0.99)),
      w: 1,
      h: round(Math.max(0.01, 1 - Math.min(footerY, 0.99))),
    },
    questions,
  };
}

export function buildTeacherCatalog(catalog) {
  const elementary = new Set(catalog.config.elementaryGrades);
  const grades = catalog.grades.map((grade) => ({
    grade: grade.grade,
    label: grade.label,
    band: elementary.has(grade.grade) ? 'elementary' : 'middle',
    topics: grade.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      sheets: topic.levels.map((level) => ({
        pdfId: level.pdfId,
        pdfUrl: pdfUrl(level.pdfId),
        level: level.key,
        levelLabel: level.label,
        title: `${topic.title} · ${level.label}`,
        mode: elementary.has(grade.grade) ? 'sheet' : 'exercise',
      })),
    })),
  }));
  return { pdfBase: PDF_BASE, grades };
}

export function catalogSheets(index) {
  const sheets = [];
  for (const grade of index.grades) {
    for (const topic of grade.topics) {
      for (const sheet of topic.sheets) {
        sheets.push({
          grade: grade.grade,
          gradeLabel: grade.label,
          band: grade.band,
          topicId: topic.id,
          topic: topic.title,
          ...sheet,
        });
      }
    }
  }
  return sheets;
}

function writeOutputs() {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const rich = JSON.parse(readFileSync(richPath, 'utf8'));
  const index = buildTeacherCatalog(catalog);
  rmSync(sheetDir, { recursive: true, force: true });
  mkdirSync(sheetDir, { recursive: true });
  writeFileSync(join(outDir, 'teacher-catalog.json'), JSON.stringify(index));
  let exerciseSheets = 0;
  let questions = 0;
  for (const sheet of catalogSheets(index)) {
    if (sheet.mode !== 'exercise') continue;
    exerciseSheets += 1;
    if (sheet.pdfId === rich.pdfId) {
      writeFileSync(join(sheetDir, sheet.pdfId + '.json'), readFileSync(richPath));
      questions += rich.questions.length;
      continue;
    }
    const manifest = JSON.parse(readFileSync(join(manifestDir, sheet.pdfId + '.json'), 'utf8'));
    const source = sheetFromManifest(sheet, manifest);
    questions += source.questions.length;
    writeFileSync(join(sheetDir, sheet.pdfId + '.json'), JSON.stringify(source));
  }
  return { sheets: catalogSheets(index).length, exerciseSheets, questions };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const stats = writeOutputs();
  console.log(JSON.stringify(stats));
}
