/**
 * SEO-2: build src/data/prisa-units.v1.json, the official teaching layout
 * (פריסת הוראה תשפ״ז) by month with the topic pages that cover each unit.
 *
 *   npx tsx scripts/build-prisa-units.ts           # write the file
 *   npx tsx scripts/build-prisa-units.ts --check   # exit 1 if it is stale
 *
 * Inputs, all in the repo (scripts/data/prisa/):
 *   all-units.fields.v1.json  the four all-units.csv columns the index needs
 *   layout.v1.json            the month and PDF page of each unit, per track
 *   unit-pages.v1.json        topic pages per unit, best first, plus the slug
 *                             planned for a dedicated landing
 *
 * A listed page must be a served topic page of the unit's grade, and a
 * `slug#anchor` must hit a rendered section anchor; otherwise the build fails.
 * A planned slug is linked first as soon as that page is served, so a new
 * landing only needs a regenerate. The site build reads only the output file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isServedTopicSlug, prisaPageRefProblem } from '../src/lib/prisaPageRef';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT_DIR = 'scripts/data/prisa';
const REPO_INPUT_DIR = `headless/astro-poc/${INPUT_DIR}`;
export const PRISA_UNITS_OUTPUT = join(root, 'src/data/prisa-units.v1.json');

interface FieldsInput {
  source: { path: string; sha256: string; rows: number; columns: string[] };
  units: { id: string; track: string; name: string; mandatory: boolean }[];
}

interface LayoutInput {
  baseUrl: string;
  monthLabels: Record<string, string>;
  tracks: {
    key: string;
    grade: number;
    csvTrack: string;
    label: string;
    prefix: string;
    file: string;
    title: string;
    sha256: string;
    months: { key: string; prisaPage: number; units: string[] }[];
  }[];
}

export interface UnitPagesEntry {
  pages: string[];
  planned?: string[];
  note?: string;
}

export interface UnitPagesInput {
  origin: Record<string, unknown>;
  units: Record<string, UnitPagesEntry>;
}

function readInput<T>(name: string): T {
  return JSON.parse(readFileSync(join(root, INPUT_DIR, name), 'utf8')) as T;
}

export function readUnitPagesInput(): UnitPagesInput {
  return readInput<UnitPagesInput>('unit-pages.v1.json');
}

/** Python json.dumps(ensure_ascii=False) spacing, so the file keeps its format. */
function py(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(py).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${py(v)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}

/** The output file text. Throws with every problem listed when an input is wrong. */
export function buildPrisaUnitsJson(): string {
  const fields = readInput<FieldsInput>('all-units.fields.v1.json');
  const layout = readInput<LayoutInput>('layout.v1.json');
  const unitPages = readUnitPagesInput();
  const problems: string[] = [];

  const rows = new Map(fields.units.map((u) => [u.id, u]));
  if (rows.size !== fields.units.length || rows.size !== fields.source.rows) {
    problems.push(`all-units snapshot: ${fields.units.length} rows, ${rows.size} unique ids, ${fields.source.rows} expected`);
  }

  const seen = new Set<string>();
  const tracks = layout.tracks.map((track) => {
    const months = track.months.map((month) => {
      const units = month.units.map((suffix) => {
        const id = track.prefix + suffix;
        const row = rows.get(id);
        if (!row) {
          problems.push(`${id}: not in the all-units snapshot`);
          return null;
        }
        if (row.track !== track.csvTrack) problems.push(`${id}: track ${row.track}, expected ${track.csvTrack}`);
        if (seen.has(id)) problems.push(`${id}: listed twice in the layout`);
        seen.add(id);
        const entry = unitPages.units[id];
        if (!entry) {
          problems.push(`${id}: missing from unit-pages.v1.json`);
          return null;
        }
        const pages: string[] = [];
        for (const ref of entry.planned || []) {
          if (!isServedTopicSlug(ref.split('#')[0])) continue;
          const problem = prisaPageRefProblem(ref, track.grade);
          if (problem) problems.push(`${id}: planned ${problem}`);
          else if (!pages.includes(ref)) pages.push(ref);
        }
        for (const ref of entry.pages) {
          const problem = prisaPageRefProblem(ref, track.grade);
          if (problem) problems.push(`${id}: ${problem}`);
          else if (!pages.includes(ref)) pages.push(ref);
        }
        const unit: Record<string, unknown> = { id, name: row.name, pages };
        if (!row.mandatory) unit.optional = true;
        if (entry.note) unit.note = entry.note;
        for (const text of [row.name, entry.note || '']) {
          if (text.includes('/')) problems.push(`${id}: writes a slash in ${JSON.stringify(text)}`);
        }
        return unit;
      });
      return {
        key: month.key,
        label: layout.monthLabels[month.key],
        prisaPage: month.prisaPage,
        units: units.filter((u): u is Record<string, unknown> => u !== null),
      };
    });
    const expected = fields.units.filter((u) => u.track === track.csvTrack).length;
    const count = months.reduce((n, m) => n + m.units.length, 0);
    if (count !== expected) problems.push(`${track.key}: ${count} units in the layout, ${expected} in the snapshot`);
    return {
      key: track.key,
      grade: track.grade,
      label: track.label,
      source: { title: track.title, url: layout.baseUrl + track.file, sha256: track.sha256 },
      months,
    };
  });
  if (seen.size !== rows.size) problems.push(`layout lists ${seen.size} of ${rows.size} units`);
  for (const id of Object.keys(unitPages.units)) {
    if (!seen.has(id)) problems.push(`unit-pages.v1.json: ${id} is not in the layout`);
  }
  if (problems.length) {
    throw new Error(`prisa units: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  }

  const head = {
    schema: 'noam-prisa-units/v1',
    note: 'Official teaching-layout (פריסת הוראה תשפ״ז) units by month. Generated by headless/astro-poc/scripts/build-prisa-units.ts from the inputs below; the build reads only this file.',
    sources: {
      units: {
        path: `${REPO_INPUT_DIR}/all-units.fields.v1.json`,
        origin: { path: fields.source.path, sha256: fields.source.sha256 },
        columns: fields.source.columns,
        rows: fields.source.rows,
      },
      months: {
        path: `${REPO_INPUT_DIR}/layout.v1.json`,
        rule: 'Each track source below: the month in which the official PDF table first lists the unit (prisaPage is the PDF page).',
      },
      landings: {
        path: `${REPO_INPUT_DIR}/unit-pages.v1.json`,
        origin: unitPages.origin,
        rule: 'pages = served same-grade topic pages per unit, best first: a planned landing once it is served, then the listed pages; empty = no page yet (plain text)',
      },
    },
  };

  // One unit per line keeps the file small and the diffs readable.
  const lines = ['{'];
  for (const [k, v] of Object.entries(head)) lines.push(`  ${JSON.stringify(k)}: ${py(v)},`);
  lines.push('  "tracks": [');
  tracks.forEach((track, ti) => {
    lines.push('    {');
    for (const k of ['key', 'grade', 'label', 'source'] as const) lines.push(`      ${JSON.stringify(k)}: ${py(track[k])},`);
    lines.push('      "months": [');
    track.months.forEach((month, mi) => {
      lines.push(`        {"key": ${py(month.key)}, "label": ${py(month.label)}, "prisaPage": ${month.prisaPage}, "units": [`);
      month.units.forEach((unit, ui) => lines.push(`          ${py(unit)}${ui < month.units.length - 1 ? ',' : ''}`));
      lines.push(`        ]}${mi < track.months.length - 1 ? ',' : ''}`);
    });
    lines.push('      ]');
    lines.push(`    }${ti < tracks.length - 1 ? ',' : ''}`);
  });
  lines.push('  ]');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const out = buildPrisaUnitsJson();
  if (process.argv.includes('--check')) {
    const current = readFileSync(PRISA_UNITS_OUTPUT, 'utf8');
    if (current !== out) {
      console.error('src/data/prisa-units.v1.json is stale. Run: npx tsx scripts/build-prisa-units.ts');
      process.exit(1);
    }
    console.log('prisa-units.v1.json is up to date');
    return;
  }
  writeFileSync(PRISA_UNITS_OUTPUT, out);
  console.log(`wrote src/data/prisa-units.v1.json (${Buffer.byteLength(out)} bytes)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
