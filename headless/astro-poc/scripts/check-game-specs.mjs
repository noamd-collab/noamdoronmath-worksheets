/**
 * Structural check for the game specs in src/games/specs.
 *
 * Each spec is a browser script that calls window.NoamGame.boot(spec). Here it
 * runs against a stub that captures the spec, so the shape of a game can be
 * checked without a browser. Scene drawing is not exercised; open the game in
 * a browser for that.
 *
 *   node scripts/check-game-specs.mjs            # every spec
 *   node scripts/check-game-specs.mjs achuzim    # one spec
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const specsDir = resolve(here, '../src/games/specs');
const LRI = '\u2066';
const PDI = '\u2069';

/** Run one spec file against a stubbed engine and return the spec it booted. */
function loadSpec(file) {
  const source = readFileSync(join(specsDir, file), 'utf8');
  let captured = null;
  const sandbox = {
    window: {
      NoamGame: {
        m: (t) => LRI + t + PDI,
        palette: {
          ink: '#0c2340', main: '#1d4ed8', dark: '#1e3a8a', soft: '#e2ecff',
          line: '#a3c0f5', warm: '#f59e0b', warmSoft: '#fdf0d8',
          good: '#1d7a46', goodSoft: '#e9f9ef'
        },
        ez: (l) => l,
        shuffle: (a) => a.slice(),
        boot: (spec) => { captured = spec; }
      }
    },
    document: undefined,
    console
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(source, sandbox, { filename: file, timeout: 5000 });
  if (!captured) throw new Error('the file never called NoamGame.boot');
  return captured;
}

/** Visible Hebrew copy must never spell a fraction with a slash. */
function slashFraction(text) {
  return /\d\s*\/\s*\d/.test(String(text));
}

/**
 * m() isolates its argument as left-to-right mathematics, so Hebrew inside it
 * is reordered on screen. Each call must carry mathematics only.
 */
function hebrewInsideMath(source) {
  const out = [];
  const hebrew = /[\u0590-\u05FF]/;
  for (const line of source.split('\n')) {
    for (const match of line.matchAll(/\bm\(/g)) {
      let i = match.index + match[0].length;
      let depth = 1;
      while (i < line.length && depth > 0) {
        if (line[i] === '(') depth += 1;
        else if (line[i] === ')') depth -= 1;
        i += 1;
      }
      const inner = line.slice(match.index + match[0].length, i - 1);
      if (hebrew.test(inner)) out.push(inner.trim().slice(0, 70));
    }
  }
  return out;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'function') continue;
      if (k === 'art') continue;
      collectStrings(v, out);
    }
  }
  return out;
}

/**
 * A spec is one long function body, so a `var` and a `function` with the same
 * name silently collide: the assignment wins and every call to the function
 * throws at run time. The stub never calls scene code, so catch it by reading.
 */
function shadowedNames(source) {
  const functions = new Set();
  const variables = new Set();
  for (const line of source.split('\n')) {
    const fn = line.match(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (fn) functions.add(fn[1]);
    const v = line.match(/^\s*var\s+([A-Za-z_$][\w$]*)\s*=/);
    if (v) variables.add(v[1]);
  }
  return [...functions].filter((name) => variables.has(name));
}

function checkSpec(file, spec) {
  const problems = [];
  const slug = file.replace(/\.js$/, '');
  const add = (msg) => problems.push(msg);

  if (spec.slug !== slug) add(`slug is "${spec.slug}" but the file is ${file}`);
  if (!spec.mascot) add('no mascot name');
  const steps = spec.steps;
  if (!Array.isArray(steps) || steps.length < 6) {
    add('a game needs at least six steps');
    return problems;
  }
  if (steps[0].mode !== 'intro') add('the first step must be an intro');
  if (steps[steps.length - 1].mode !== 'finish') add('the last step must be a finish');

  const quizIndexes = [];
  steps.forEach((step, i) => {
    const at = `step ${i} (${step.mode})`;
    if (!step.mode) add(`${at}: no mode`);
    if (!step.tA) add(`${at}: no title`);
    if (!step.btn) add(`${at}: no button label`);
    if (!step.tip) add(`${at}: no tip — that is what the mascot says on entry`);
    if (step.mode === 'quiz') {
      quizIndexes.push(i);
      const opts = step.opts || [];
      if (opts.length < 3) add(`${at}: needs at least three options`);
      const correct = opts.filter((o) => o.c);
      if (correct.length !== 1) add(`${at}: ${correct.length} options marked correct, expected one`);
      opts.forEach((o, k) => {
        if (!o.t) add(`${at}: option ${k} has no label`);
        if (!o.f) add(`${at}: option ${k} has no explanation`);
      });
      if (!step.win) add(`${at}: no win line`);
      if (!step.wrongSay) add(`${at}: no wrongSay line`);
      if (!(step.hints || []).length) add(`${at}: no hints`);
    }
    if (step.mode === 'scene') {
      if (typeof step.setup !== 'function') add(`${at}: no setup function`);
      if (!Array.isArray(step.aspect) || step.aspect.length !== 2) add(`${at}: no aspect`);
      if (!step.alt) add(`${at}: no alt text for the drawing`);
      if (!step.cueDone && step.needDone !== false) add(`${at}: no cueDone`);
    }
    if (step.mode === 'finish' && !step.formula) add(`${at}: no closing formula`);
  });

  if (quizIndexes.length < 3) add(`only ${quizIndexes.length} quizzes, expected at least three`);

  const skills = spec.skills || [];
  if (skills.length !== quizIndexes.length) {
    add(`${skills.length} skills for ${quizIndexes.length} quizzes — they must match`);
  }
  skills.forEach((skill, i) => {
    if (!skill.name) add(`skill ${i}: no name`);
    if (!quizIndexes.includes(skill.step)) add(`skill ${i}: step ${skill.step} is not a quiz`);
  });

  const source = readFileSync(join(specsDir, file), 'utf8');
  if (/\bfetch\s*\(/.test(source)) add('uses fetch — the document must stay self-contained');
  if (/XMLHttpRequest/.test(source)) add('uses XMLHttpRequest — the document must stay self-contained');
  if (/\bimport\s|\bexport\s/.test(source)) add('uses modules — a spec is a plain browser script');
  hebrewInsideMath(source).forEach((inner) => {
    add(`Hebrew inside m(): ${JSON.stringify(inner)} — isolate the numbers, not the sentence`);
  });
  shadowedNames(source).forEach((name) => {
    add(`"${name}" is both a function and a var — the assignment overwrites the function`);
  });

  collectStrings(spec).forEach((text) => {
    if (slashFraction(text)) add(`a fraction is written with a slash: ${JSON.stringify(text.slice(0, 60))}`);
  });

  return problems;
}

const only = process.argv[2];
const files = readdirSync(specsDir)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => !only || f === `${only}.js`)
  .sort();

if (only && files.length === 0) {
  console.error(`No spec named ${only}.js in src/games/specs`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  let problems;
  try {
    problems = checkSpec(file, loadSpec(file));
  } catch (error) {
    problems = [`did not load: ${error.message}`];
  }
  if (problems.length) {
    failed += 1;
    console.error(`FAIL ${file}`);
    problems.forEach((p) => console.error(`  - ${p}`));
  } else {
    console.log(`ok   ${file}`);
  }
}

if (!files.length) console.log('No specs yet.');
if (failed) {
  console.error(`\n${failed} spec(s) need work.`);
  process.exit(1);
}
