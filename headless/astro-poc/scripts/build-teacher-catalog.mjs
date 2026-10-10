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

/**
 * Text-line pitch from the pins. The tight gaps that are clearly shorter than
 * the typical part step are one line (baseline to baseline). When every step
 * is a taller part, that part is the label line plus the exercise line, so
 * the label line is half the tightest step.
 */
export function labelLineHeight(exercises) {
  const gaps = [];
  for (let i = 1; i < exercises.length; i += 1) {
    const previous = exercises[i - 1] && exercises[i - 1].pin;
    const next = exercises[i] && exercises[i].pin;
    if (!previous || !next || previous.page !== next.page) continue;
    const gap = next.y - previous.y;
    if (gap > 0.012 && gap < 0.25) gaps.push(gap);
  }
  if (!gaps.length) return 0.026;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor((gaps.length - 1) / 2)];
  const single = gaps.filter((gap) => gap <= median * 0.6);
  if (single.length) return single[Math.floor((single.length - 1) / 2)];
  return gaps[0] / 2;
}

/**
 * How far above the pin the crop starts.
 * Half a line clears the label, but on a tall pitch that also catches the
 * previous part's dashed answer rule. Cap the ascent so that rule stays out.
 */
export function labelAscent(lineHeight) {
  const line = lineHeight > 0 ? lineHeight : 0.026;
  return Math.min(line / 2, 0.0042);
}

/** Label line box. The pin is the anchor; the top sits just above the label ink. */
export function labelLineBox(pin, lineHeight) {
  const height = lineHeight > 0 ? lineHeight : 0.026;
  const y = Math.max(0, pin.y - labelAscent(height));
  return { page: pin.page, y, h: height };
}

function labelTop(pin, lineHeight) {
  return labelLineBox(pin, lineHeight).y;
}

/** Manifest Hebrew is extractor order, not a readable string. Synthetic labels are not. */
function manifestScrambled(text) {
  const value = String(text || '').trim();
  if (!value || /^שאלה\s+\d+/.test(value)) return false;
  return /[\u0590-\u05FF]/.test(value);
}

/** A boxed section title such as "חלק ב׳ — …" appended by the manifest extractor. */
function trailingSectionHeader(text) {
  return /חלק\s+[\u0590-\u05FF]\s*[׳']?\s*[—–-]/.test(String(text || ''));
}

/**
 * The question crop ends at the next question and includes the section-header
 * box in its last ~0.04. Stop just above that box, and never above the label.
 * Catalog sheets store only "שאלה N, סעיף X", so the box is also recognized
 * when the crop ends well before the next question and the cut still leaves
 * the label line.
 */
function sectionHeaderEnd(exercise, cropBottom, top, line, nextPinY) {
  const cut = cropBottom - 0.052;
  const floor = top + Math.max(line * 0.9, 0.012);
  if (!(cut > floor) || !(cropBottom < 0.92)) return null;
  const textHit = trailingSectionHeader(exercise.text);
  const gapNext = nextPinY == null ? Infinity : nextPinY - cropBottom;
  const geometric = cut > exercise.pin.y + 0.02 && gapNext >= 0.03;
  if (!textHit && !geometric) return null;
  return cut;
}

/** One crop per chosen part: from the top of its label line to the top of the next label line. */
export function partRows(exercises, index, lineHeight) {
  const exercise = exercises[index];
  const pin = exercise.pin;
  const line = lineHeight || labelLineHeight(exercises);
  const top = labelTop(pin, line);
  const slices = exercise.crops && exercise.crops.length ? exercise.crops : [exercise.crop];
  const here = slices.find((slice) => slice.page === pin.page) || exercise.crop || { x: 0, w: 1, y: pin.y, h: 0.04 };
  const nextPart = exercises.slice(index + 1).find((item) => (
    item.q === exercise.q && item.pin && item.pin.page === pin.page && item.pin.y > pin.y + 0.004
  ));
  if (nextPart) {
    const end = labelTop(nextPart.pin, line);
    return [cropBox(pin.page, here.x, top, here.w, Math.max(line * 0.5, end - top))];
  }
  const nextOnPage = exercises.slice(index + 1).find((item) => (
    item.pin && item.pin.page === pin.page && item.pin.y > pin.y + 0.004
  ));
  let end = here.page === pin.page ? here.y + here.h : top + line;
  if (nextOnPage) end = Math.min(end, labelTop(nextOnPage.pin, line));
  const headerEnd = here.page === pin.page
    ? sectionHeaderEnd(exercise, here.y + here.h, top, line, nextOnPage ? nextOnPage.pin.y : null)
    : null;
  if (headerEnd != null) end = Math.min(end, headerEnd);
  const rows = [cropBox(pin.page, here.x, top, here.w, Math.max(line * 0.5, end - top))];
  const next = exercises[index + 1];
  if (!next || next.q !== exercise.q || !next.pin || next.pin.page <= pin.page) return rows;
  for (const slice of slices) {
    if (slice.page <= pin.page) continue;
    if (slice.page < next.pin.page) rows.push(cropBox(slice.page, slice.x, slice.y, slice.w, slice.h));
    else if (slice.page === next.pin.page) {
      const clip = labelTop(next.pin, line);
      if (clip > slice.y + line * 0.35) {
        rows.push(cropBox(slice.page, slice.x, slice.y, slice.w, Math.min(slice.h, clip - slice.y)));
      }
    }
  }
  return rows;
}

function stemBox(exercises, exercise, lineHeight) {
  const first = exercises.find((item) => item.q === exercise.q);
  const crop = first && first.crop;
  if (!first || !crop || crop.page !== first.pin.page) return null;
  const height = labelTop(first.pin, lineHeight) - crop.y;
  if (height < 0.008) return null;
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
  const line = labelLineHeight(exercises);
  const questions = exercises.map((exercise, index) => {
    const part = exercise.part || '';
    const id = String(exercise.q) + part;
    const label = part ? `שאלה ${exercise.q} סעיף ${part}` : `שאלה ${exercise.q}`;
    const rows = partRows(exercises, index, line);
    const stem = stemBox(exercises, exercise, line);
    const labelLine = labelLineBox(exercise.pin, line);
    const text = exercise.text || label;
    const scrambled = manifestScrambled(exercise.text);
    return {
      id,
      q: exercise.q,
      part,
      page: exercise.pin.page,
      label,
      text,
      ...(scrambled ? { scrambled: true } : {}),
      box: markBox(exercise.pin),
      line: round(line),
      labelLine: { page: labelLine.page, y: round(labelLine.y), h: round(labelLine.h) },
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
