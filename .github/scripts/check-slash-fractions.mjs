/**
 * Fail when visible site text writes a fraction or division with '/'.
 *
 * Noam, 18.10.2026: every fraction uses a horizontal bar. Blogs are out of
 * scope. URLs, paths, imports, comments, non-string code, CSS lengths,
 * unit rates, and/or pairs, dates, breadcrumbs, step labels, and spaced
 * game scores (N / 100) are not fractions. String literals in scripts,
 * topicFilms, conceptLoops.ts, loopHelpers.ts, landingLoops.ts,
 * kiteAreaFilm.ts, public-lesson/lesson.html, and public JavaScript are
 * scanned. A fraction built in code (`n + "/" + d`, `${n}/${d}`) is scanned
 * too, unless the line is a path, url, or file join.
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

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ₀₁₂₃₄₅₆₇₈₉';
const UNIT_LEFT = new Set(['km', 'm', 'cm', 'mm', 'kg', 'g', 'mg', 's', 'h', 'min', 'sec', 'l', 'ml', 'bit', 'kb', 'mb', 'gb', 'n', 'w', 'rev']);
const UNIT_RIGHT = new Set(['h', 'hr', 's', 'sec', 'min', 'm', 'cm', 'km', 'l', 'ml', 's²', 'm²', 'm³', 'cm²', 'cm³']);
const WORD_PAIRS = new Set(['and/or', 'w/o', 'n/a', 'yes/no', 'on/off']);
const DATE_WORD = /תאריך|ביום|עודכן|בחודש|לוח/;
const NON_TEXT_SIDE = /\b(?:path|url|href|src|slug|file|dir|base|origin|import|join|pathname)\b/i;

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
  'headless/astro-poc/src/lib/conceptLoops.ts',
  'headless/astro-poc/src/lib/loopHelpers.ts',
  'headless/astro-poc/src/lib/landingLoops.ts',
  'headless/astro-poc/src/lib/kiteAreaFilm.ts',
  'headless/astro-poc/src/public-lesson/lesson.html',
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

const GREEK = 'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

function isLetter(ch) {
  return /[A-Za-z]/.test(ch || '');
}
function isGreek(ch) {
  return GREEK.includes(ch || '');
}
function isIdentChar(ch) {
  return isDigit(ch) || isLetter(ch) || isGreek(ch) || isSup(ch);
}
function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}
function isSup(ch) {
  return SUP.includes(ch || '');
}

function readAtomBackward(text, end) {
  let j = end - 1;
  if (j < 0 || !isIdentChar(text[j])) return null;
  while (j >= 0 && isIdentChar(text[j])) j -= 1;
  const token = text.slice(j + 1, end);
  if (![...token].some((ch) => isDigit(ch) || isLetter(ch) || isGreek(ch))) return null;
  return { start: j + 1, text: token };
}

function readAtomForward(text, start) {
  if (start >= text.length || !isIdentChar(text[start])) return null;
  let j = start + 1;
  while (j < text.length && isIdentChar(text[j])) j += 1;
  const token = text.slice(start, j);
  if (![...token].some((ch) => isDigit(ch) || isLetter(ch) || isGreek(ch))) return null;
  return { end: j, text: token };
}

function groupPair(ch) {
  if (ch === ')') return '(';
  if (ch === ']') return '[';
  if (ch === '(') return ')';
  if (ch === '[') return ']';
  return '';
}

function readGroupBackward(text, closeIdx) {
  const open = groupPair(text[closeIdx]);
  if (open !== '(' && open !== '[') return null;
  let depth = 0;
  for (let i = closeIdx; i >= 0; i -= 1) {
    if (text[i] === text[closeIdx]) depth += 1;
    else if (text[i] === open) {
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
  const close = groupPair(text[openIdx]);
  if (close !== ')' && close !== ']') return null;
  let depth = 0;
  for (let j = openIdx; j < text.length; j += 1) {
    if (text[j] === text[openIdx]) depth += 1;
    else if (text[j] === close) {
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
  if (text[i] === ')' || text[i] === ']') {
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
  if (text[i] === '(' || text[i] === '[') {
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

/** A colon is a clock only when a digit sits on both sides, as in 12:30. */
function colonIsClock(text, index) {
  return text[index] === ':' && isDigit(text[index - 1]) && isDigit(text[index + 1]);
}

function looksLikeTime(text, hit) {
  return colonIsClock(text, hit.start - 1) || colonIsClock(text, hit.end);
}

/** A spaced "N / 100" is a game score, not a quotient. `p/100` stays a fraction. */
function isGameScore(hit) {
  return /^\d+\s+\/\s+100$/.test(hit.text);
}

function isCssLength(token) {
  return /^\d+(?:\.\d+)?(?:px|em|rem|vh|vw|dvh|dvw|ch|ex|%)$/i.test(token);
}

/** `8px / 8px` is a border-radius slash. `13px/1.5` is a font shorthand. */
function isCssFraction(text, hit) {
  if (isCssLength(hit.num) && isCssLength(hit.den)) return true;
  if (!isCssLength(hit.num) || !/^\d+(?:\.\d+)?$/.test(hit.den)) return false;
  const around = text.slice(Math.max(0, hit.start - 24), hit.start);
  return /font(?:-size)?\s*:\s*[^\n]*$/i.test(around) || /line-height\s*:\s*$/i.test(around);
}

function isAspectRatio(line, hit) {
  return Boolean(line) && /aspect-?ratio/i.test(line) && /^\d+$/.test(hit.num) && /^\d+$/.test(hit.den);
}

function isUnitOrWordPair(num, den) {
  const pair = `${num}/${den}`.toLowerCase();
  if (WORD_PAIRS.has(pair)) return true;
  if (UNIT_LEFT.has(num.toLowerCase()) && UNIT_RIGHT.has(den.toLowerCase())) return true;
  return false;
}

function inDayMonth(dayText, monthText) {
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{1,2}$/.test(monthText)) return false;
  const day = Number(dayText);
  const month = Number(monthText);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

/**
 * A date has three parts (18/10/2026, 2026/10/18) or an explicit date word
 * (עודכן ב־18/10). A bare pair such as 18/12 or 18/10 is a fraction.
 */
function isDate(text, hit) {
  const num = hit.num;
  const den = hit.den;
  if (!/^\d{1,4}$/.test(num) || !/^\d{1,4}$/.test(den)) return false;
  const after = text.slice(hit.end);
  const before = text.slice(0, hit.start);
  if (inDayMonth(num, den) && /^\/(?:\d{4}|\d{2})\b/.test(after)) return true;
  if (/^(?:19|20)\d{2}$/.test(num) && /^\d{1,2}$/.test(den) && /^\/\d{1,2}\b/.test(after) && Number(den) >= 1 && Number(den) <= 12) {
    return true;
  }
  if (/^\d{1,2}$/.test(num) && /^(?:\d{2}|\d{4})$/.test(den) && /\d{1,2}\/$/.test(before) && Number(num) >= 1 && Number(num) <= 12) {
    return true;
  }
  if (inDayMonth(num, den) && /(?:19|20)\d{2}\/$/.test(before)) return true;
  const window = text.slice(Math.max(0, hit.start - 30), Math.min(text.length, hit.end + 8));
  return DATE_WORD.test(window) && inDayMonth(num, den);
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
      const prefixHyphen = text[start - 1] === '-' && /[\u0590-\u05FF]/.test(prev);
      if (!prefixHyphen && !/[A-Za-z0-9)]/.test(prev)) {
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
      isGameScore(hit) ||
      isUnitOrWordPair(hit.num, hit.den) ||
      isCssFraction(text, hit) ||
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

const BEFORE_EXPR = new Set([
  'case', 'default', 'do', 'else', 'return', 'throw', 'new', 'in', 'instanceof',
  'typeof', 'void', 'delete', 'extends', 'await', 'yield', 'of',
]);
const FN_STATEMENT_PREV = new Set(['eof', 'semi', 'else', 'do', 'try', 'finally', 'export', 'block-end', '{']);

/**
 * String and template literals. Regex literals are skipped so a quote inside
 * `/["']/ ` does not look like the start of a string. `${...}` is scanned as
 * code; its source is blanked in the template text.
 */
export function extractStrings(source) {
  const pieces = [];
  scanCode(source, 0, source.length, 1, pieces, false);
  return pieces;
}

function scanCode(source, start, end, startLine, pieces, stopAtBrace) {
  let i = start;
  let line = startLine;
  let exprAllowed = true;
  let prevKind = 'eof';
  let newlineSince = true;
  /** @type {Array<'block'|'expr'|'fn-body'|{type:'fn',kind:'fn-expr'|'fn-stmt',params:number,paramsClosed:boolean,body:boolean}>} */
  const stack = [];

  const topFn = () => {
    const top = stack[stack.length - 1];
    return top && typeof top === 'object' && top.type === 'fn' && !top.body ? top : null;
  };

  while (i < end) {
    const ch = source[i];
    if (ch === '\n') {
      line += 1;
      newlineSince = true;
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f') {
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < end && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < end && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') {
          line += 1;
          newlineSince = true;
        }
        i += 1;
      }
      i = Math.min(end, i + 2);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const read = readQuoted(source, i, end, line);
      pieces.push({ line, text: read.text, start: read.start, end: read.end });
      i = read.i;
      line = read.line;
      exprAllowed = false;
      prevKind = 'value';
      newlineSince = false;
      continue;
    }
    if (ch === '`') {
      const read = readTemplate(source, i, end, line, pieces);
      i = read.i;
      line = read.line;
      exprAllowed = false;
      prevKind = 'value';
      newlineSince = false;
      continue;
    }
    if (ch === '/') {
      if (exprAllowed) {
        const next = skipRegexp(source, i, end);
        if (next != null) {
          i = next;
          exprAllowed = false;
          prevKind = 'value';
          newlineSince = false;
          continue;
        }
      }
      i += 1;
      if (source[i] === '=') i += 1;
      exprAllowed = true;
      prevKind = 'op';
      newlineSince = false;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      i += 1;
      while (i < end && /[0-9A-Za-z_.]/.test(source[i])) i += 1;
      exprAllowed = false;
      prevKind = 'value';
      newlineSince = false;
      continue;
    }
    if (isIdentStart(ch)) {
      const wordStart = i;
      i += 1;
      while (i < end && isIdentPart(source[i])) i += 1;
      const word = source.slice(wordStart, i);
      if (word === 'function' || (word === 'async' && keywordAhead(source, i, end, 'function'))) {
        if (word === 'async') {
          while (i < end && (source[i] === ' ' || source[i] === '\t')) i += 1;
          i += 'function'.length;
        }
        const kind = FN_STATEMENT_PREV.has(prevKind) || (prevKind === 'return' && newlineSince) ? 'fn-stmt' : 'fn-expr';
        stack.push({ type: 'fn', kind, params: 0, paramsClosed: false, body: false });
        exprAllowed = false;
        prevKind = 'function';
        newlineSince = false;
        continue;
      }
      if (word === 'export') {
        exprAllowed = true;
        prevKind = 'export';
        newlineSince = false;
        continue;
      }
      if (BEFORE_EXPR.has(word)) {
        exprAllowed = true;
        prevKind = word === 'return' || word === 'else' || word === 'do' || word === 'throw' || word === 'yield' ? word : 'op';
      } else {
        exprAllowed = false;
        prevKind = word === 'const' || word === 'let' || word === 'var' ? word : 'ident';
      }
      newlineSince = false;
      continue;
    }
    if (ch === '{') {
      const fn = topFn();
      if (fn && fn.paramsClosed) {
        fn.body = true;
        stack.push('fn-body');
      } else if (isBlockBrace(prevKind, exprAllowed, newlineSince, stack)) {
        stack.push('block');
      } else {
        stack.push('expr');
      }
      exprAllowed = true;
      prevKind = '{';
      newlineSince = false;
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (stack.length === 0 && stopAtBrace) return { i: i + 1, line };
      const frame = stack.pop();
      if (frame === 'fn-body') {
        const fn = stack.pop();
        exprAllowed = !fn || fn.kind === 'fn-stmt';
        prevKind = exprAllowed ? 'block-end' : 'expr-end';
      } else if (frame === 'block') {
        exprAllowed = true;
        prevKind = 'block-end';
      } else {
        exprAllowed = false;
        prevKind = 'expr-end';
      }
      newlineSince = false;
      i += 1;
      continue;
    }
    if (ch === '(') {
      const fn = topFn();
      if (fn && !fn.body) fn.params += 1;
      exprAllowed = true;
      prevKind = '(';
      newlineSince = false;
      i += 1;
      continue;
    }
    if (ch === ')') {
      const fn = topFn();
      if (fn && !fn.body && fn.params > 0) {
        fn.params -= 1;
        if (fn.params === 0) fn.paramsClosed = true;
      }
      exprAllowed = false;
      prevKind = ')';
      newlineSince = false;
      i += 1;
      continue;
    }
    if (ch === '.' && source[i + 1] === '.' && source[i + 2] === '.') {
      i += 3;
      exprAllowed = true;
      prevKind = 'op';
      newlineSince = false;
      continue;
    }
    if (ch === '=' && source[i + 1] === '>') {
      i += 2;
      exprAllowed = true;
      prevKind = '=>';
      newlineSince = false;
      continue;
    }
    if (ch === '+' && source[i + 1] === '+' || ch === '-' && source[i + 1] === '-') {
      i += 2;
      newlineSince = false;
      continue;
    }
    if (ch === '?' && source[i + 1] === '.') {
      i += 2;
      exprAllowed = false;
      prevKind = '.';
      newlineSince = false;
      continue;
    }
    if (ch === '?' && source[i + 1] === '?') {
      i += 2;
      exprAllowed = true;
      prevKind = 'op';
      newlineSince = false;
      continue;
    }
    if (ch === ']') {
      exprAllowed = false;
      prevKind = 'value';
      newlineSince = false;
      i += 1;
      continue;
    }
    if ('=+-*%&|^!~,:;?<>['.includes(ch)) {
      if ((ch === '=' || ch === '!' || ch === '<' || ch === '>') && source[i + 1] === '=') {
        i += source[i + 2] === '=' ? 3 : 2;
      } else if ((ch === '&' || ch === '|') && source[i + 1] === ch) {
        i += 2;
      } else if (ch === '*' && source[i + 1] === '*') {
        i += 2;
      } else if ('+-*%&|^'.includes(ch) && source[i + 1] === '=') {
        i += 2;
      } else {
        i += 1;
      }
      exprAllowed = true;
      prevKind = ch === ';' ? 'semi' : 'op';
      newlineSince = false;
      continue;
    }
    if (ch === '.') {
      exprAllowed = false;
      prevKind = '.';
      newlineSince = false;
      i += 1;
      continue;
    }
    i += 1;
  }
  return { i, line };
}

function isBlockBrace(prevKind, exprAllowed, newlineSince, stack) {
  if (prevKind === '=>' || prevKind === 'else' || prevKind === 'do' || prevKind === 'try' || prevKind === 'finally' || prevKind === 'semi' || prevKind === 'eof' || prevKind === ')' || prevKind === 'block-end') {
    return true;
  }
  if (prevKind === '{') {
    const top = stack[stack.length - 1];
    return top === 'block' || top === 'fn-body';
  }
  if (prevKind === 'return' || prevKind === 'yield' || prevKind === 'throw') return newlineSince;
  if (prevKind === 'var' || prevKind === 'let' || prevKind === 'const') return false;
  return !exprAllowed;
}

function isIdentStart(ch) {
  return /[A-Za-z_$]/.test(ch || '') || (ch && ch.codePointAt(0) > 127 && /[\p{L}]/u.test(ch));
}
function isIdentPart(ch) {
  return /[A-Za-z0-9_$]/.test(ch || '') || (ch && ch.codePointAt(0) > 127 && /[\p{L}\p{N}]/u.test(ch));
}

function keywordAhead(source, i, end, word) {
  while (i < end && (source[i] === ' ' || source[i] === '\t' || source[i] === '\n' || source[i] === '\r')) i += 1;
  return source.slice(i, i + word.length) === word && !isIdentPart(source[i + word.length] || '');
}

function readQuoted(source, i, end, line) {
  const quote = source[i];
  const start = i + 1;
  i += 1;
  let text = '';
  while (i < end) {
    if (source[i] === '\n') line += 1;
    if (source[i] === '\\') {
      text += source[i + 1] === '\n' ? '\n' : source[i + 1] || '';
      if (source[i + 1] === '\n') line += 1;
      i += 2;
      continue;
    }
    if (source[i] === quote) {
      i += 1;
      break;
    }
    text += source[i];
    i += 1;
  }
  return { i, line, text, start, end: i - 1 };
}

function readTemplate(source, i, end, line, pieces) {
  const startLine = line;
  i += 1;
  let text = '';
  while (i < end) {
    if (source[i] === '\\') {
      text += source[i + 1] === '\n' ? '\n' : source[i + 1] || '';
      if (source[i + 1] === '\n') line += 1;
      i += 2;
      continue;
    }
    if (source[i] === '`') {
      i += 1;
      break;
    }
    if (source[i] === '$' && source[i + 1] === '{') {
      const from = i;
      const nested = scanCode(source, i + 2, end, line, pieces, true);
      text += source.slice(from, nested.i).replace(/[^\n]/g, ' ');
      i = nested.i;
      line = nested.line;
      continue;
    }
    if (source[i] === '\n') line += 1;
    text += source[i];
    i += 1;
  }
  pieces.push({ line: startLine, text });
  return { i, line };
}

/** End index of a regex literal starting at `i`, or null when it does not close. */
function skipRegexp(source, i, end) {
  let j = i + 1;
  let inClass = false;
  while (j < end) {
    const c = source[j];
    if (c === '\n') return null;
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      j += 1;
      continue;
    }
    if (c === '[') {
      inClass = true;
      j += 1;
      continue;
    }
    if (c === '/') {
      j += 1;
      while (j < end && /[a-z]/i.test(source[j])) j += 1;
      return j;
    }
    j += 1;
  }
  return null;
}

function lineOfOffset(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
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

/** Text that is not inside a tag, including a line that is only text. */
function visibleLine(line) {
  return line.replace(/<[^>]*>/g, ' ');
}

function skipQuotedPath(piece) {
  if (!piece.includes('/')) return false;
  if (piece.includes(' ') || /[א-ת]/.test(piece)) return false;
  return inUrlOrPath(piece, 0, piece.length) || piece.startsWith('/') || piece.includes('../') || piece.startsWith('./');
}

/**
 * @returns {Array<{file:string,line:number,text:string}>}
 */
function pushHits(findings, rel, snippets, lineNo, piece, sourceLine = '') {
  if (!piece || !piece.includes('/')) return;
  if (skipQuotedPath(piece)) return;
  for (const hit of findSlashFractions(piece)) {
    if (allowed(rel, hit, snippets)) continue;
    const lineOff = lineOfOffset(piece, hit.start) - 1;
    if (lineOff === 0 && isAspectRatio(sourceLine, hit)) continue;
    findings.push({ file: rel, line: lineNo + lineOff, text: hit.text });
  }
}

function sideIsNonText(side) {
  return NON_TEXT_SIDE.test(side);
}

/**
 * A quotient assembled in code, where the slash never sits inside one literal:
 * `n + "/" + d` or `${n}/${d}`. Path and url joins stay quiet.
 * @returns {Array<{line:number,text:string}>}
 */
export function findBuiltSlashFractions(source) {
  const hits = [];
  const masked = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
  masked.split('\n').forEach((raw, idx) => {
    const line = stripLineComment(raw);
    if (!line.includes('/')) return;
    if (sideIsNonText(line)) return;
    const concat = /([A-Za-z_$][\w$]*)\s*\+\s*(['"])\/\2\s*\+\s*([A-Za-z_$][\w$]*)/g;
    for (const match of line.matchAll(concat)) {
      if (sideIsNonText(match[1]) || sideIsNonText(match[3])) continue;
      hits.push({ line: idx + 1, text: `${match[1]} + "/" + ${match[3]}` });
    }
    const templ = /\$\{([^{}]{1,80})\}\s*\/\s*\$\{([^{}]{1,80})\}/g;
    for (const match of line.matchAll(templ)) {
      const left = match[1].trim();
      const right = match[2].trim();
      if (sideIsNonText(left) || sideIsNonText(right)) continue;
      if (left.includes('/') || right.includes('/')) continue;
      hits.push({ line: idx + 1, text: `\${${left}}/\${${right}}` });
    }
  });
  return hits;
}

function scanCodeStrings(rel, source, baseLine, snippets, findings) {
  const lines = source.split('\n');
  for (const piece of extractStrings(source)) {
    const head = lines[piece.line - 1] || '';
    if (/^\s*import\b/.test(head)) continue;
    pushHits(findings, rel, snippets, baseLine + piece.line - 1, piece.text, head);
  }
  for (const hit of findBuiltSlashFractions(source)) {
    findings.push({ file: rel, line: baseLine + hit.line - 1, text: hit.text });
  }
}

/**
 * Astro and HTML `{...}` expressions are code. Blank the ones that are not
 * JSX, and keep scanning the strings inside them. JSX children stay visible.
 */
function blankMarkupExpressions(rel, source, baseLine, snippets, findings) {
  const chars = [...source];
  function walk(from, to) {
    let i = from;
    while (i < to) {
      if (chars[i] !== '{') {
        i += 1;
        continue;
      }
      const end = matchBrace(chars, i, to);
      if (end < 0) {
        i += 1;
        continue;
      }
      if (!regionHasJsx(chars, i + 1, end)) {
        const code = chars.slice(i + 1, end).join('');
        const line = baseLine + lineOfOffset(source, i) - 1;
        scanCodeStrings(rel, code, line, snippets, findings);
        for (let k = i + 1; k < end; k += 1) {
          if (chars[k] !== '\n') chars[k] = ' ';
        }
      } else {
        walk(i + 1, end);
      }
      i = end + 1;
    }
  }
  walk(0, chars.length);
  return chars.join('');
}

function matchBrace(chars, open, limit) {
  let depth = 0;
  let i = open;
  /** @type {number[]} */
  const templateResume = [];
  let inTemplate = false;
  while (i < limit) {
    const ch = chars[i];
    if (!inTemplate && ch === '/' && chars[i + 1] === '/') {
      while (i < limit && chars[i] !== '\n') i += 1;
      continue;
    }
    if (!inTemplate && ch === '/' && chars[i + 1] === '*') {
      i += 2;
      while (i < limit && !(chars[i] === '*' && chars[i + 1] === '/')) i += 1;
      i = Math.min(limit, i + 2);
      continue;
    }
    if (!inTemplate && (ch === '"' || ch === "'")) {
      const quote = ch;
      i += 1;
      while (i < limit) {
        if (chars[i] === '\\') {
          i += 2;
          continue;
        }
        if (chars[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (!inTemplate && ch === '`') {
      inTemplate = true;
      i += 1;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '`') {
        inTemplate = false;
        i += 1;
        continue;
      }
      if (ch === '$' && chars[i + 1] === '{') {
        i += 2;
        depth += 1;
        templateResume.push(depth - 1);
        inTemplate = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (templateResume.length && depth === templateResume[templateResume.length - 1]) {
        templateResume.pop();
        inTemplate = true;
      }
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function regionHasJsx(chars, from, to) {
  let i = from;
  while (i < to) {
    const ch = chars[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < to) {
        if (chars[i] === '\\') {
          i += 2;
          continue;
        }
        if (chars[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === '<' && /[A-Za-z/!]/.test(chars[i + 1] || '')) return true;
    i += 1;
  }
  return false;
}

export function scanSource(rel, source, snippets = []) {
  const findings = [];
  const push = (lineNo, piece, sourceLine = '') => pushHits(findings, rel, snippets, lineNo, piece, sourceLine);

  const markup = rel.endsWith('.astro') || rel.endsWith('.html');
  if (markup) {
    const fm = rel.endsWith('.astro') ? source.match(/^---\n([\s\S]*?)\n---/) : null;
    if (fm) scanCodeStrings(rel, fm[1], 2, snippets, findings);
    const body = fm ? source.slice(fm[0].length) : source;
    const bodyStartLine = fm ? fm[0].split('\n').length : 1;
    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of body.matchAll(scriptRe)) {
      const start = bodyStartLine + lineOfOffset(body, match.index || 0) - 1;
      scanCodeStrings(rel, match[1], start, snippets, findings);
    }
    const masked = blankMarkupExpressions(rel, blankRegions(body), bodyStartLine, snippets, findings);
    masked.split('\n').forEach((raw, idx) => {
      const lineNo = bodyStartLine + idx;
      const line = stripLineComment(raw);
      push(lineNo, visibleLine(line), line);
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

  const code = rel.endsWith('.ts') || rel.endsWith('.tsx') || rel.endsWith('.js') || rel.endsWith('.mjs');
  if (code) {
    scanCodeStrings(rel, source, 1, snippets, findings);
    return findings;
  }
  const masked = blankRegions(source);
  masked.split('\n').forEach((raw, idx) => {
    const line = stripLineComment(raw);
    if (/^\s*import\b/.test(line)) return;
    push(idx + 1, visibleLine(line));
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
    if (rel.includes('/public/') && !rel.endsWith('.html') && !rel.endsWith('.js')) continue;
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot) : '';
    if (!SCAN_EXT.has(ext)) continue;
    const code = ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.mjs';
    const codeAllowed =
      rel.includes('/src/lib/topicFilms/') ||
      rel.endsWith('/src/lib/conceptLoops.ts') ||
      rel.includes('/public/');
    if (code && !codeAllowed) continue;
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
