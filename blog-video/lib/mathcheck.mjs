// Exact checker for the arithmetic a video shows on screen or in captions.
// Parses school notation (× : − ² √ [ ]) into exact fractions; never uses eval.
// Expressions with letters are reported as "symbolic" and left to the human reviewer.

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Q {
  constructor(n, d = 1n) { if (d === 0n) throw new Error('division by zero'); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; this.n = n / g; this.d = d / g; }
  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d); }
  div(o) { return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  pow(o) {
    if (o.d !== 1n) throw new Error('non-integer exponent');
    if (o.n < 0n) return new Q(1n).div(this.pow(o.neg()));
    if (o.n === 0n && this.n === 0n) throw new Error('0^0');
    return new Q(this.n ** o.n, this.d ** o.n);
  }
  sqrt() {
    if (this.n < 0n) throw new Error('square root of a negative number has no real value');
    const r = (x) => { if (x < 2n) return x; let y = x, z = (x + 1n) / 2n; while (z < y) { y = z; z = (x / z + z) / 2n; } return y; };
    const a = r(this.n), b = r(this.d);
    if (a * a !== this.n || b * b !== this.d) return new Irrational(`√${this.toString()}`);
    return new Q(a, b);
  }
  eq(o) { return o instanceof Q && this.n === o.n && this.d === o.d; }
  toString() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
}
class Irrational { constructor(label) { this.label = label; } }

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')' };

export function tokenize(src) {
  const s = src.replace(/[\u2066-\u2069\u200E\u200F]/g, '');
  const out = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c)) { let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++; out.push({ t: 'num', v: s.slice(i, j) }); i = j; continue; }
    if (c in SUP) {
      let j = i, e = '';
      while (j < s.length && s[j] in SUP) e += SUP[s[j++]];
      out.push({ t: 'sup', v: e }); i = j; continue;
    }
    if (/[A-Za-zא-ת]/.test(c)) { out.push({ t: 'var', v: c }); i++; continue; }
    const map = { '+': '+', '-': '-', '−': '-', '×': '*', '·': '*', ':': '/', '÷': '/', '(': '(', ')': ')', '[': '(', ']': ')', '√': 'sqrt', '^': '^', '=': '=', '≠': '!=' };
    if (c in map) { out.push({ t: 'op', v: map[c] }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

/** Recursive descent: sum → product → unary → power → atom. Unary minus binds looser than powers (−3² = −9). */
function parseExpr(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const take = (v) => { const t = tokens[i]; if (!t || (v && t.v !== v)) throw new Error(`expected ${v || 'token'}`); i++; return t; };
  const sum = () => { let l = product(); while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = take().v; const r = product(); l = { op, l, r }; } return l; };
  const product = () => { let l = unary(); while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) { const op = take().v; const r = unary(); l = { op, l, r }; } return l; };
  const unary = () => { if (peek()?.t === 'op' && peek().v === '-') { take(); return { op: 'neg', x: unary() }; } return power(); };
  const power = () => {
    let b = atom();
    for (;;) {
      if (peek()?.t === 'sup') { const e = parseExpr(tokenize(take().v.replace(/-/g, '−'))); b = { op: '^', l: b, r: e }; continue; }
      if (peek()?.t === 'op' && peek().v === '^') { take(); b = { op: '^', l: b, r: unary() }; continue; }
      // Implicit product: 2√5, 2(3), 3x.
      if (peek() && (peek().t === 'var' || peek().t === 'num' || (peek().t === 'op' && (peek().v === 'sqrt' || peek().v === '(')))) { const r = power(); b = { op: '*', l: b, r }; continue; }
      return b;
    }
  };
  const atom = () => {
    const t = take();
    if (t.t === 'num') return { num: t.v };
    if (t.t === 'var') return { var: t.v };
    if (t.v === '(') { const e = sum(); take(')'); return e; }
    if (t.v === 'sqrt') { return { op: 'sqrt', x: power() }; }
    throw new Error(`unexpected ${t.v}`);
  };
  const tree = sum();
  if (i !== tokens.length) throw new Error(`unexpected ${tokens[i].v}`);
  return tree;
}

const toQ = (str) => { const [a, b = ''] = str.split('.'); return new Q(BigInt(a + b), 10n ** BigInt(b.length)); };
function evaluate(node) {
  if (node.num) return toQ(node.num);
  if (node.var) throw Object.assign(new Error('symbolic'), { symbolic: true });
  if (node.op === 'neg') return evaluate(node.x).neg();
  if (node.op === 'sqrt') { const v = evaluate(node.x); if (!(v instanceof Q)) throw new Error('nested irrational'); return v.sqrt(); }
  const l = evaluate(node.l), r = evaluate(node.r);
  if (l instanceof Irrational || r instanceof Irrational) throw Object.assign(new Error('irrational'), { symbolic: true });
  return { '+': () => l.add(r), '-': () => l.sub(r), '*': () => l.mul(r), '/': () => l.div(r), '^': () => l.pow(r) }[node.op]();
}

/**
 * Checks one formula: a chain "A = B = C" (all equal) or "A ≠ B" (must differ).
 * Returns { status: 'ok' | 'wrong' | 'symbolic' | 'error', detail }.
 */
export function checkFormula(src) {
  let tokens;
  try { tokens = tokenize(src); } catch (e) { return { status: 'error', detail: e.message }; }
  const parts = [[]];
  const rels = [];
  for (const t of tokens) {
    if (t.t === 'op' && (t.v === '=' || t.v === '!=')) { rels.push(t.v); parts.push([]); } else parts.at(-1).push(t);
  }
  let values;
  try {
    values = parts.map((p) => {
      if (!p.length) throw new Error('empty side');
      try { return evaluate(parseExpr(p)); } catch (e) { if (e.symbolic) return null; throw e; }
    });
  } catch (e) { return { status: 'error', detail: e.message }; }
  if (values.some((v) => v === null || v instanceof Irrational)) return { status: 'symbolic', detail: 'contains letters or an irrational value; review by hand' };
  for (let k = 0; k < rels.length; k++) {
    const same = values[k].eq(values[k + 1]);
    if (rels[k] === '=' && !same) return { status: 'wrong', detail: `${values[k]} ≠ ${values[k + 1]}` };
    if (rels[k] === '!=' && same) return { status: 'wrong', detail: `both sides equal ${values[k]}` };
  }
  return { status: 'ok', detail: rels.length ? values.map(String).join(' | ') : `value ${values[0]}` };
}
