/**
 * Teacher picker data, from the site catalog only.
 * Middle-school sheets (grades 7–9) also get per-exercise crops from the
 * existing manifests. Elementary sheets stay sheet / level records.
 * Does not invent exercises. The grade-9 factoring level A file is copied
 * as-is so the pilot boxes stay the ones already checked.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const measureScript = join(scriptDir, 'measure-label-gaps.py');
// Worksheet PDFs downloaded while measuring crops. Override with TEACHER_PDF_CACHE.
const pdfCacheDir = process.env.TEACHER_PDF_CACHE || join(tmpdir(), 'noam-teacher-pdfs');

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
 * Fallback when the rendered page has no empty row above the label.
 * Half a line keeps a table border that fills the search window, such as
 * grade 8 17א. A measured white row is used instead whenever one exists,
 * so a dashed answer rule above a real gap stays out of the crop.
 */
export function labelAscent(lineHeight) {
  const line = lineHeight > 0 ? lineHeight : 0.026;
  return line / 2;
}

/** Label line box for the fallback path. The pin is the anchor. */
export function labelLineBox(pin, lineHeight) {
  const height = lineHeight > 0 ? lineHeight : 0.026;
  const y = Math.max(0, pin.y - labelAscent(height));
  return { page: pin.page, y, h: height };
}

function exerciseId(exercise) {
  return String(exercise.q) + (exercise.part || '');
}

/** Measured white-row top when the build found one; otherwise half a line. */
function labelTop(pin, lineHeight, measured) {
  if (typeof measured === 'number' && Number.isFinite(measured) && measured >= 0 && measured < pin.y) {
    return measured;
  }
  return Math.max(0, pin.y - labelAscent(lineHeight));
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

function splitGap(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return { y: raw, bottom: null };
  if (raw && typeof raw === 'object') {
    const y = typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : null;
    const bottom = typeof raw.bottom === 'number' && Number.isFinite(raw.bottom) ? raw.bottom : null;
    return { y, bottom };
  }
  return { y: null, bottom: null };
}

/** One crop per chosen part: from the top of its label line to the top of the next label line. */
export function partRows(exercises, index, lineHeight, gaps, bottoms) {
  const exercise = exercises[index];
  const pin = exercise.pin;
  const line = lineHeight || labelLineHeight(exercises);
  const id = exerciseId(exercise);
  const top = labelTop(pin, line, gaps && gaps[id]);
  const slices = exercise.crops && exercise.crops.length ? exercise.crops : [exercise.crop];
  const here = slices.find((slice) => slice.page === pin.page) || exercise.crop || { x: 0, w: 1, y: pin.y, h: 0.04 };
  const nextPart = exercises.slice(index + 1).find((item) => (
    item.q === exercise.q && item.pin && item.pin.page === pin.page && item.pin.y > pin.y + 0.004
  ));
  const extraBottom = bottoms && bottoms[id];
  if (nextPart) {
    let end = labelTop(nextPart.pin, line, gaps && gaps[exerciseId(nextPart)]);
    if (typeof extraBottom === 'number' && extraBottom > end && extraBottom < 0.995) end = extraBottom;
    return [cropBox(pin.page, here.x, top, here.w, Math.max(line * 0.5, end - top))];
  }
  const nextOnPage = exercises.slice(index + 1).find((item) => (
    item.pin && item.pin.page === pin.page && item.pin.y > pin.y + 0.004
  ));
  let end = here.page === pin.page ? here.y + here.h : top + line;
  if (nextOnPage) end = Math.min(end, labelTop(nextOnPage.pin, line, gaps && gaps[exerciseId(nextOnPage)]));
  if (typeof extraBottom === 'number' && extraBottom > end && extraBottom < 0.995) end = extraBottom;
  // A lifted figure top can sit above a short manifest crop that ends before the label.
  if (end < pin.y + 0.008) end = pin.y + Math.min(0.02, Math.max(line * 0.45, 0.012));
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
      const clip = labelTop(next.pin, line, gaps && gaps[exerciseId(next)]);
      if (clip > slice.y + line * 0.35) {
        rows.push(cropBox(slice.page, slice.x, slice.y, slice.w, Math.min(slice.h, clip - slice.y)));
      }
    }
  }
  return rows;
}

function stemBox(exercises, exercise, lineHeight, gaps) {
  const first = exercises.find((item) => item.q === exercise.q);
  const crop = first && first.crop;
  if (!first || !crop || crop.page !== first.pin.page) return null;
  const height = labelTop(first.pin, lineHeight, gaps && gaps[exerciseId(first)]) - crop.y;
  if (height < 0.008) return null;
  return { page: crop.page, x: round(crop.x || 0), y: round(crop.y), w: round(crop.w || 1), h: round(height) };
}

export function pdfUrl(pdfId) {
  return PDF_BASE + pdfId + '.pdf';
}

export function sheetFromManifest(meta, manifest, gaps) {
  const exercises = manifest.exercises || [];
  const first = exercises[0];
  const last = exercises[exercises.length - 1];
  const headerH = first && first.crop && first.crop.page === 1
    ? Math.min(0.42, Math.max(0.04, first.crop.y))
    : 0.08;
  const end = last ? last.crop.y + last.crop.h : 0.94;
  const footerY = end > 0.97 ? 0.985 : Math.max(end, 0.94);
  const line = labelLineHeight(exercises);
  const tops = {};
  const bottoms = {};
  if (gaps) {
    for (const exercise of exercises) {
      const key = exerciseId(exercise);
      const split = splitGap(gaps[key]);
      const measured = split.y == null ? null : round(split.y);
      tops[key] = measured != null && measured >= 0 && measured < exercise.pin.y ? measured : null;
      const bottom = split.bottom == null ? null : round(split.bottom);
      if (bottom != null && bottom > exercise.pin.y && bottom < 0.995) bottoms[key] = bottom;
    }
  }
  const questions = exercises.map((exercise, index) => {
    const part = exercise.part || '';
    const id = String(exercise.q) + part;
    const label = part ? `שאלה ${exercise.q} סעיף ${part}` : `שאלה ${exercise.q}`;
    const inkTop = gaps ? tops[id] : null;
    const inkBottom = gaps ? bottoms[id] : null;
    const rows = partRows(exercises, index, line, gaps ? tops : undefined, gaps ? bottoms : undefined);
    const stem = stemBox(exercises, exercise, line, gaps ? tops : undefined);
    const labelLine = { page: exercise.pin.page, y: rows[0].y, h: line };
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
      inkTop,
      ...(inkBottom != null ? { inkBottom } : {}),
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

function cachedPdf(pdfId) {
  const path = join(pdfCacheDir, `${pdfId}.pdf`);
  if (existsSync(path) && statSync(path).size > 1000) return path;
  return null;
}

export async function ensureWorksheetPdf(pdfId) {
  const cached = cachedPdf(pdfId);
  if (cached) return cached;
  mkdirSync(pdfCacheDir, { recursive: true });
  const dest = join(pdfCacheDir, `${pdfId}.pdf`);
  const response = await fetch(pdfUrl(pdfId));
  if (!response.ok) throw new Error(`pdf ${pdfId} ${response.status}`);
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function measureJobs(jobs) {
  if (!jobs.length) return [];
  const result = spawnSync('python3', [measureScript], {
    input: JSON.stringify(jobs),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'measure-label-gaps failed');
  }
  return JSON.parse(result.stdout);
}

/** White-row tops for one worksheet, keyed by question id. null means half-line fallback. */
export function measureExerciseGaps(pdfPath, exercises) {
  const line = labelLineHeight(exercises);
  const pages = new Map();
  for (const exercise of exercises) {
    const page = exercise.pin.page;
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push({ id: exerciseId(exercise), y: exercise.pin.y, line, q: exercise.q });
  }
  const [measured] = measureJobs([{
    id: 'one',
    pdf: pdfPath,
    pages: [...pages.entries()].map(([page, pins]) => ({ page, pins })),
  }]);
  return measured.gaps;
}

/** Dark-pixel counts on the first and last row of a crop, at 300 dpi. */
export function cropEdgeInk(pdfPath, crops) {
  const result = spawnSync('python3', [measureScript], {
    input: JSON.stringify({ cmd: 'edges', pdf: pdfPath, crops }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'crop edge check failed');
  return JSON.parse(result.stdout);
}

async function writeOutputs() {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const rich = JSON.parse(readFileSync(richPath, 'utf8'));
  const index = buildTeacherCatalog(catalog);
  rmSync(sheetDir, { recursive: true, force: true });
  mkdirSync(sheetDir, { recursive: true });
  writeFileSync(join(outDir, 'teacher-catalog.json'), JSON.stringify(index));
  let exerciseSheets = 0;
  let questions = 0;
  const pending = [];
  for (const sheet of catalogSheets(index)) {
    if (sheet.mode !== 'exercise') continue;
    exerciseSheets += 1;
    if (sheet.pdfId === rich.pdfId) {
      writeFileSync(join(sheetDir, sheet.pdfId + '.json'), readFileSync(richPath));
      questions += rich.questions.length;
      continue;
    }
    pending.push(sheet);
  }
  process.stderr.write(`downloading ${pending.length} worksheets\n`);
  const paths = await mapPool(pending, 12, (sheet) => ensureWorksheetPdf(sheet.pdfId));
  const jobs = pending.map((sheet, index) => {
    const manifest = JSON.parse(readFileSync(join(manifestDir, sheet.pdfId + '.json'), 'utf8'));
    const line = labelLineHeight(manifest.exercises || []);
    const pages = new Map();
    for (const exercise of manifest.exercises || []) {
      const page = exercise.pin.page;
      if (!pages.has(page)) pages.set(page, []);
      pages.get(page).push({ id: exerciseId(exercise), y: exercise.pin.y, line, q: exercise.q });
    }
    return {
      id: sheet.pdfId,
      pdf: paths[index],
      manifest,
      sheet,
      pages: [...pages.entries()].map(([page, pins]) => ({ page, pins })),
    };
  });
  process.stderr.write(`measuring ${jobs.length} worksheets\n`);
  const measured = measureJobs(jobs.map(({ id, pdf, pages }) => ({ id, pdf, pages })));
  const byId = new Map(measured.map((item) => [item.id, item.gaps]));
  let fallbacks = 0;
  let measuredTops = 0;
  for (const job of jobs) {
    const gaps = byId.get(job.id) || {};
    for (const value of Object.values(gaps)) {
      const split = splitGap(value);
      if (split.y == null && split.bottom == null) fallbacks += 1;
      else measuredTops += 1;
    }
    const source = sheetFromManifest(job.sheet, job.manifest, gaps);
    questions += source.questions.length;
    writeFileSync(join(sheetDir, job.id + '.json'), JSON.stringify(source));
  }
  return { sheets: catalogSheets(index).length, exerciseSheets, questions, measuredTops, fallbacks };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const stats = await writeOutputs();
  console.log(JSON.stringify(stats));
}
