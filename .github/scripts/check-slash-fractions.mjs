/**
 * Fail when visible site text writes a fraction or division with '/'.
 *
 * Noam, 18.10.2026: every fraction uses a horizontal bar. Blogs are out of
 * scope. URLs, paths, imports, comments, code, unit rates, and/or pairs,
 * and dates are not fractions.
 *
 *   node .github/scripts/check-slash-fractions.mjs
 *
 * Exit 1 prints "file:line: <offending text>" for each hit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../..');
const ALLOWLIST_PATH = join(REPO_ROOT, '.github/slash-fraction-allowlist.json');
const OPEN = '⟨';
const BAR = '¦';
const CLOSE = '⟩';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉';
const UNIT_LEFT = new Set(['km', 'm', 'cm', 'mm', 'kg', 'g', 'mg', 's', 'h', 'min', 'sec', 'l', 'ml', 'bit', 'kb', 'mb', 'gb', 'n', 'w', 'rev']);
const UNIT_RIGHT = new Set(['h', 'hr', 's', 'sec', 'min', 'm', 'cm', 'km', 'l', 'ml', 's²', 'm²', 'm³', 'cm²', 'cm³']);
const WORD_PAIRS = new Set(['and/or', 'w/o', 'n/a', 'yes/no', 'on/off']);
const DATE_WORD = /תאריך|ביום|עודכן|בחודש|לוח/;
const MATH_WORD = /שבר|תשובה|חשבו|דוגמה|כפול|חלקי|שווה|מכנה|מונה/;
const MATH_OP = /[=+−×·÷:<>≤≥]/;

const SKIP_DIR = new Set(['node_modules', 'dist', 'sheets', '.git']);
const SCAN_EXT = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.html', '.json']);

const ROOTS = [
  'headless/astro-poc/src/data/topic-pages',
  'headless/astro-poc/src/data/site-pages',
  'headless/astro-poc/src/data/grade-hubs',
  'headless/astro-poc/src/data/home-page.json',
  'headless/astro-poc/src/data/site-guide.v1.json',
  'headless/astro-poc/src/pages',
  'headless/astro-poc/src/components',
  'headless/astro-poc/src/layouts',
  'headless/astro-poc/src/lib/topicFilms',
  'headless/astro-poc/public',
];

function isBlog(rel) {
  return (
    rel.includes('/blog-posts/') ||
    rel.includes('/blog-archives/') ||
    rel.includes('/pages/blog/') ||
    rel.includes('/pages/post/') ||
    rel.endsWith('/pages/blog.astro')
  );
}

function isProseIdent(token) {
  const core = token.startsWith('(') && token.endsWith(')') ? token.slice(1, -1) : token;
  if (/[·×]/.test(core)) return false;
  const words = core.match(/[A-Za-z]{4,}/g);
  return Boolean(words && words.length);
}

function isLetter(ch) {
  return /[A-Za-z]/.test(ch || '');
}
function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}
function isSup(ch) {
  return SUP.includes(ch || '');
}

function readAtomBackward(text, end) {
  let j = end - 1;
  if (j < 0) return null;
  const ch = text[j];
  if (isDigit(ch)) {
    while (j >= 0 && isDigit(text[j])) j -= 1;
    return { start: j + 1, text: text.slice(j + 1, end) };
  }
  if (isLetter(ch) || isSup(ch)) {
    while (j >= 0 && (isLetter(text[j]) || isDigit(text[j]) || isSup(text[j]))) j -= 1;
    if (!isLetter(text[j + 1])) return null;
    return { start: j + 1, text: text.slice(j + 1, end) };
  }
  return null;
}

function readAtomForward(text, start) {
  if (start >= text.length) return null;
  const ch = text[start];
  if (isDigit(ch)) {
    let j = start + 1;
    while (j < text.length && isDigit(text[j])) j += 1;
    return { end: j, text: text.slice(start, j) };
  }
  if (isLetter(ch)) {
    let j = start + 1;
    while (j < text.length && (isLetter(text[j]) || isDigit(text[j]) || isSup(text[j]))) j += 1;
    return { end: j, text: text.slice(start, j) };
  }
  return null;
}

function readGroupBackward(text, closeIdx) {
  let depth = 0;
  for (let i = closeIdx; i >= 0; i -= 1) {
    if (text[i] === ')') depth += 1;
    else if (text[i] === '(') {
      depth -= 1;
      if (depth === 0) {
        const inner = text.slice(i + 1, closeIdx);
        if (inner.includes('/')) return null;
        return { start: i, text: text.slice(i, closeIdx + 1) };
      }
    }
  }
  return null;
}

function readGroupForward(text, openIdx) {
  let depth = 0;
  for (let j = openIdx; j < text.length; j += 1) {
    if (text[j] === '(') depth += 1;
    else if (text[j] === ')') {
      depth -= 1;
      if (depth === 0) {
        const inner = text.slice(openIdx + 1, j);
        if (inner.includes('/')) return null;
        return { end: j + 1, text: text.slice(openIdx, j + 1) };
      }
    }
  }
  return null;
}

/** Numerator ending just before the slash. Spaces around the slash are consumed. */
function readNumerator(text, slash) {
  let i = slash - 1;
  while (i >= 0 && text[i] === ' ') i -= 1;
  if (i < 0) return null;
  if (text[i] === ')') {
    const group = readGroupBackward(text, i);
    if (!group) return null;
    return { start: group.start, token: group.text, bareNumber: false };
  }
  let end = i + 1;
  let start = null;
  while (true) {
    const atom = readAtomBackward(text, end);
    if (!atom) break;
    start = atom.start;
    let k = atom.start - 1;
    while (k >= 0 && text[k] === ' ') k -= 1;
    if (k >= 0 && text[k] === '·') {
      let k2 = k - 1;
      while (k2 >= 0 && text[k2] === ' ') k2 -= 1;
      end = k2 + 1;
      continue;
    }
    break;
  }
  if (start == null) return null;
  const token = text.slice(start, i + 1).replace(/\s+/g, '');
  return { start, token, bareNumber: /^\d+$/.test(token) };
}

function readDenominator(text, slash) {
  let i = slash + 1;
  while (i < text.length && text[i] === ' ') i += 1;
  if (i >= text.length) return null;
  if (text[i] === '(') {
    const group = readGroupForward(text, i);
    if (!group) return null;
    return { end: group.end, token: group.text };
  }
  const atom = readAtomForward(text, i);
  if (!atom) return null;
  return { end: atom.end, token: atom.text };
}

function inUrlOrPath(text, start, end) {
  let a = start;
  let b = end;
  while (a > 0 && !/\s/.test(text[a - 1]) && text[a - 1] !== '"' && text[a - 1] !== "'" && text[a - 1] !== '`') a -= 1;
  while (b < text.length && !/\s/.test(text[b]) && text[b] !== '"' && text[b] !== "'" && text[b] !== '`') b += 1;
  const tok = text.slice(a, b);
  if (/https?:\/\//.test(tok) || /www\./i.test(tok) || /\.[a-z]{2,}\//i.test(tok)) return true;
  if (tok.startsWith('/') || tok.startsWith('./') || tok.startsWith('../') || tok.includes('../')) return true;
  if (/\.(?:astro|tsx?|jsx?|mjs|cjs|css|json|html|svg|png|jpe?g|webp|gif|woff2?)$/i.test(tok)) return true;
  if (/^(?:src|public|headless|node_modules)\//.test(tok)) return true;
  return false;
}

function looksLikeTime(text, hit) {
  const before = text[hit.start - 1];
  const after = text[hit.end];
  return before === ':' || after === ':';
}

function isUnitOrWordPair(num, den) {
  const pair = `${num}/${den}`.toLowerCase();
  if (WORD_PAIRS.has(pair)) return true;
  if (UNIT_LEFT.has(num.toLowerCase()) && UNIT_RIGHT.has(den.toLowerCase())) return true;
  return false;
}

function isDate(text, hit) {
  const num = hit.num;
  const den = hit.den;
  if (!/^\d{1,2}$/.test(num)) return false;
  const after = text.slice(hit.end);
  if (/^\d{1,2}$/.test(den) && /^\/(?:\d{2}|\d{4})\b/.test(after)) return true;
  if (/^(?:19|20)\d{2}$/.test(den) && /^\d{1,2}$/.test(num) && Number(num) >= 1 && Number(num) <= 31) return true;
  const window = text.slice(Math.max(0, hit.start - 30), Math.min(text.length, hit.end + 8));
  if (DATE_WORD.test(window) && /^\d{1,2}$/.test(den)) {
    const month = Number(den);
    const day = Number(num);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return true;
  }
  if (!/^\d{1,2}$/.test(den)) return false;
  const day = Number(num);
  const month = Number(den);
  if (day < 13 || day > 31 || month < 1 || month > 12) return false;
  const around = text.slice(Math.max(0, hit.start - 2), hit.start) + text.slice(hit.end, hit.end + 2);
  if (MATH_OP.test(around)) return false;
  if (MATH_WORD.test(window)) return false;
  return true;
}

/**
 * @returns {Array<{start:number,end:number,num:string,den:string,sign:string,text:string}>}
 */
export function findSlashFractions(text) {
  const hits = [];
  if (!text || !text.includes('/')) return hits;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '/') continue;
    const left = readNumerator(text, i);
    const right = readDenominator(text, i);
    if (!left || !right) continue;
    let start = left.start;
    let sign = '';
    let num = left.token;
    if (left.bareNumber && start > 0 && (text[start - 1] === '−' || text[start - 1] === '-')) {
      const prev = start === 1 ? '' : text[start - 2];
      if (!/[A-Za-z0-9)]/.test(prev)) {
        sign = text[start - 1];
        start -= 1;
      }
    }
    const hit = {
      start,
      end: right.end,
      num,
      den: right.token,
      sign,
      text: text.slice(start, right.end),
    };
    if (inUrlOrPath(text, hit.start, hit.end)) {
      i = hit.end - 1;
      continue;
    }
    if (
      looksLikeTime(text, hit) ||
      isUnitOrWordPair(hit.num, hit.den) ||
      isDate(text, hit) ||
      isProseIdent(hit.num) ||
      isProseIdent(hit.den)
    ) {
      i = hit.end - 1;
      continue;
    }
    hits.push(hit);
    i = hit.end - 1;
  }
  return hits;
}

export function replaceSlashFractions(text) {
  const hits = findSlashFractions(text);
  if (!hits.length) return text;
  let out = '';
  let at = 0;
  for (const hit of hits) {
    out += text.slice(at, hit.start);
    out += `${hit.sign}${OPEN}${hit.num}${BAR}${hit.den}${CLOSE}`;
    at = hit.end;
  }
  return out + text.slice(at);
}

export function loadAllowlist(path = ALLOWLIST_PATH) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(data.snippets) ? data.snippets : [];
}

function allowed(rel, hit, snippets) {
  return snippets.some((entry) => {
    if (!entry || typeof entry.match !== 'string' || !entry.match.includes('/')) return false;
    if (entry.file && entry.file !== rel) return false;
    return hit.text === entry.match;
  });
}

function blankRegions(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, (m) => ' '.repeat(m.length))
    .replace(/\sstyle\s*=\s*'[^']*'/gi, (m) => ' '.repeat(m.length))
    .replace(/\s(?:href|src|srcset|poster|data-src)\s*=\s*"[^"]*"/gi, (m) => ' '.repeat(m.length))
    .replace(/\s(?:href|src|srcset|poster|data-src)\s*=\s*'[^']*'/gi, (m) => ' '.repeat(m.length));
}

function stripLineComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

function quotedPieces(line) {
  const pieces = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch !== '"' && ch !== "'" && ch !== '`') {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < line.length) {
      if (line[j] === '\\') {
        j += 2;
        continue;
      }
      if (line[j] === ch) break;
      j += 1;
    }
    pieces.push(line.slice(i + 1, j));
    i = j + 1;
  }
  return pieces;
}

function textNodes(line) {
  const pieces = [];
  const re = />([^<]*)</g;
  for (const match of line.matchAll(re)) pieces.push(match[1]);
  return pieces;
}

function skipQuotedPath(piece) {
  if (!piece.includes('/')) return false;
  if (piece.includes(' ') || /[א-ת]/.test(piece)) return false;
  return inUrlOrPath(piece, 0, piece.length) || piece.startsWith('/') || piece.includes('../') || piece.startsWith('./');
}

/**
 * @returns {Array<{file:string,line:number,text:string}>}
 */
export function scanSource(rel, source, snippets = []) {
  const findings = [];
  const push = (lineNo, piece) => {
    if (!piece || !piece.includes('/')) return;
    if (skipQuotedPath(piece)) return;
    for (const hit of findSlashFractions(piece)) {
      if (allowed(rel, hit, snippets)) continue;
      findings.push({ file: rel, line: lineNo, text: hit.text });
    }
  };

  const markup = rel.endsWith('.astro') || rel.endsWith('.html');
  if (markup) {
    const fm = rel.endsWith('.astro') ? source.match(/^---\n([\s\S]*?)\n---/) : null;
    if (fm) {
      fm[1].split('\n').forEach((raw, idx) => {
        const line = stripLineComment(raw);
        if (/^\s*(?:import|export)\b/.test(line)) return;
        for (const piece of quotedPieces(line)) push(idx + 2, piece);
      });
    }
    const body = blankRegions(fm ? source.slice(fm[0].length) : source);
    const bodyStartLine = fm ? fm[0].split('\n').length : 1;
    body.split('\n').forEach((raw, idx) => {
      const lineNo = bodyStartLine + idx;
      const line = stripLineComment(raw);
      for (const piece of textNodes(line)) push(lineNo, piece);
      const attrs = line.matchAll(/\s(?:aria-label|alt|title)\s*=\s*"([^"]*)"/gi);
      for (const match of attrs) push(lineNo, match[1]);
      const attrsSingle = line.matchAll(/\s(?:aria-label|alt|title)\s*=\s*'([^']*)'/gi);
      for (const match of attrsSingle) push(lineNo, match[1]);
    });
    return findings;
  }

  if (rel.endsWith('.json')) {
    const lines = source.split('\n');
    let orphanDepth = null;
    lines.forEach((raw, idx) => {
      if (orphanDepth !== null) {
        for (const ch of raw) {
          if (ch === '[' || ch === '{') orphanDepth += 1;
          else if (ch === ']' || ch === '}') orphanDepth -= 1;
        }
        if (orphanDepth <= 0) orphanDepth = null;
        return;
      }
      if (raw.includes('"removedOrphans"')) {
        orphanDepth = 0;
        for (const ch of raw) {
          if (ch === '[' || ch === '{') orphanDepth += 1;
          else if (ch === ']' || ch === '}') orphanDepth -= 1;
        }
        return;
      }
      if (/"[^"]*(?:[Hh]ref|[Pp]ath|sourceUrl|ogImage|canonical|[Uu]rl|src)"\s*:/.test(raw)) return;
      push(idx + 1, raw);
    });
    return findings;
  }

  const masked = blankRegions(source);
  const lines = masked.split('\n');
  const codeOnly = rel.endsWith('.ts') || rel.endsWith('.tsx') || rel.endsWith('.js') || rel.endsWith('.mjs');
  lines.forEach((raw, idx) => {
    const line = stripLineComment(raw);
    if (/^\s*(?:import|export)\b/.test(line)) return;
    for (const piece of quotedPieces(line)) push(idx + 1, piece);
    if (!codeOnly) {
      for (const piece of textNodes(line)) push(idx + 1, piece);
    }
  });
  return findings;
}

function walk(dir, out, root) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name) || name === 'vendor') continue;
    const abs = join(dir, name);
    const rel = relative(root, abs).replaceAll('\\', '/');
    if (isBlog(rel) || rel.includes('/public/teachers/sheets/') || rel.includes('/public/noam-ai/')) continue;
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out, root);
      continue;
    }
    if (rel.includes('/public/') && !rel.endsWith('.html')) continue;
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot) : '';
    if (!SCAN_EXT.has(ext)) continue;
    if ((ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.mjs') && !rel.includes('/src/lib/topicFilms/')) continue;
    out.push(rel);
  }
}

export function filesToScan(root = REPO_ROOT) {
  const files = [];
  for (const rel of ROOTS) {
    const abs = join(root, rel);
    try {
      if (statSync(abs).isDirectory()) walk(abs, files, root);
      else files.push(rel);
    } catch {
      /* root may be absent in a fixture */
    }
  }
  return files;
}

export function checkTree(root = REPO_ROOT, snippets = loadAllowlist()) {
  const findings = [];
  for (const rel of filesToScan(root)) {
    const source = readFileSync(join(root, rel), 'utf8');
    findings.push(...scanSource(rel, source, snippets));
  }
  return findings;
}

function main() {
  const findings = checkTree();
  if (!findings.length) {
    console.log('slash-fraction check: no slash fractions in visible site text');
    return;
  }
  console.error(`slash-fraction check: ${findings.length} slash fraction${findings.length === 1 ? '' : 's'}`);
  for (const hit of findings) {
    console.error(`${hit.file}:${hit.line}: ${hit.text}`);
  }
  process.exitCode = 1;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
