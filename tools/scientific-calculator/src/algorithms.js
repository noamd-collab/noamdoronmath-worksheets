/* Numerical scientific-calculator helpers. Approximations use IEEE-754 doubles.
 * Mode definitions: fx-991ES PLUS 2nd edition English manual, pp30–78.
 * This is an independent implementation, not Casio firmware emulation. */
function createAlgorithms(math) {
  'use strict';
  const finite = (x, name = 'ערך') => {
    if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`${name} חייב להיות מספר ממשי סופי`);
    return x;
  };
  const call = (f, x) => finite(f(x), 'ערך הפונקציה');
  const total = a => {
    let s = 0, c = 0;
    for (const v of a) { const y = v - c, t = s + y; c = (t - s) - y; s = t; }
    return finite(s, 'סכום');
  };
  function integrate(f, a, b, tol = 1e-5) {
    finite(a); finite(b); finite(tol);
    if (tol < 1e-14) throw new Error('הדיוק המבוקש חייב להיות 1e-14 או גדול ממנו');
    if (a === b) return { value: 0, error: 0 };
    const sign = a > b ? -1 : 1;
    if (a > b) [a, b] = [b, a];
    let evaluations = 0;
    const evaluate = x => { if (++evaluations > 100000) throw new Error('האינטגרל לא התכנס; נסו לפצל את התחום'); return call(f, x); };
    // Gauss–Kronrod 7/15 quadrature. Abscissae/weights: netlib.org/quadpack/dqk15.f.
    // Two nested rules and a variation estimate are safer than a uniform Simpson
    // mesh for classroom trigonometric expressions with many complete cycles.
    const nodes = [.9914553711208126, .9491079123427585, .8648644233597691, .7415311855993945, .5860872354676911, .4058451513773972, .2077849550078985];
    const weights = [.022935322010529225, .06309209262997855, .10479001032225018, .14065325971552592, .1690047266392679, .19035057806478542, .20443294007529889, .20948214108472782];
    const gauss = [.1294849661688697, .27970539148927664, .3818300505051189, .4179591836734694];
    function adaptive(l, r, eps, depth) {
      const half = (r - l) / 2, middle = l + half, center = evaluate(middle);
      let kronrod = weights[7] * center, g = gauss[3] * center, absolute = Math.abs(kronrod);
      const sampled = [];
      for (let i = 0; i < 7; i++) {
        const fp = evaluate(middle + half * nodes[i]), fm = evaluate(middle - half * nodes[i]);
        sampled.push([fp, fm]);
        kronrod += weights[i] * (fp + fm);
        absolute += weights[i] * (Math.abs(fp) + Math.abs(fm));
        if (i % 2) g += gauss[(i - 1) / 2] * (fp + fm);
      }
      const average = kronrod / 2;
      let variation = weights[7] * Math.abs(center - average);
      sampled.forEach(([fp, fm], i) => { variation += weights[i] * (Math.abs(fp - average) + Math.abs(fm - average)); });
      variation *= half; absolute *= half;
      let error = Math.abs((kronrod - g) * half);
      if (variation && error) error = variation * Math.min(1, (200 * error / variation) ** 1.5);
      error = Math.max(error, 50 * Number.EPSILON * absolute);
      if (error <= eps) return { value: kronrod * half, error };
      if (!depth || middle === l || middle === r) throw new Error('האינטגרל לא התכנס בדיוק המבוקש');
      const p = adaptive(l, middle, eps / 2, depth - 1), q = adaptive(middle, r, eps / 2, depth - 1);
      return { value: p.value + q.value, error: p.error + q.error };
    }
    // This finite-interval calculator deliberately does not infer improper limits.
    evaluate(a); evaluate(b);
    const intervals = [], coarse = [];
    // Nonuniform initial subdivisions reduce accidental periodic aliasing.
    for (let i = 0; i < 16; i++) {
      const l = a + (b - a) * (i / 16) ** 1.13, r = a + (b - a) * ((i + 1) / 16) ** 1.13;
      intervals.push([l,r]);coarse.push(adaptive(l,r,Infinity,0));
    }
    // Compare the complete error budget first. At very tight tolerances,
    // assigning tol/16 to each piece can falsely reject a simple function:
    // its uneven roundoff distribution still meets the total requested tol.
    const coarseError=total(coarse.map(p=>p.error));
    if(coarseError<=tol)return {value:sign*total(coarse.map(p=>p.value)),error:coarseError};
    const parts=intervals.map(([l,r])=>adaptive(l,r,tol/16,22));
    return { value: sign * total(parts.map(p => p.value)), error: total(parts.map(p => p.error)) };
  }
  function derivative(f, x, tol) {
    finite(x);
    const explicitTolerance=tol!==undefined;
    if(explicitTolerance){finite(tol);if(tol<1e-14)throw new Error('הדיוק המבוקש חייב להיות 1e-14 או גדול ממנו');}
    const scale = Math.max(1, Math.abs(x)), f0 = call(f, x);
    let best = null, previous = null, previousGap = null;
    for (let i = 0; i < 20; i++) {
      const h = 0.125 * scale / 2 ** i;
      let fp,fm,hp,hm;
      try{fp=call(f,x+h);fm=call(f,x-h);hp=call(f,x+h/2);hm=call(f,x-h/2);}
      catch(_){previous=null;previousGap=null;continue;}
      const coarse = (fp - fm) / (2 * h);
      const fine = (hp - hm) / h, value = (4 * fine - coarse) / 3;
      const roundoff = Number.EPSILON * (Math.abs(fp) + Math.abs(fm) + Math.abs(hp) + Math.abs(hm)) / h;
      const error = Math.max(roundoff, previous === null ? Math.abs(value-fine) : Math.abs(value-previous)/15);
      const oneSideGap = Math.abs((hp - f0) / (h / 2) - (f0 - hm) / (h / 2));
      if (!best || error < best.error) best = { value: finite(value), error, oneSideGap, h };
      previous = value;
      // A smooth function's one-sided slopes converge as h shrinks, even when
      // curvature is large. A persistent gap indicates a corner or jump.
      if (i === 19 && oneSideGap > 1e-4 * Math.max(1, Math.abs(value)) + 100 * roundoff && oneSideGap > 0.8 * previousGap) {
        throw new Error('הנגזרת אינה יציבה בנקודה; ייתכן שהפונקציה אינה גזירה');
      }
      previousGap = oneSideGap;
    }
    if(!best)throw new Error('הנגזרת אינה מוגדרת או שהחישוב לא התכנס');
    if(explicitTolerance&&best.error>tol)throw new Error('הנגזרת לא התכנסה בדיוק המבוקש');
    return { value: best.value, error: best.error };
  }
  function solve(f, guess = 0) {
    finite(guess);
    const bound = 9.999999999e99;
    if (Math.abs(guess) > bound) throw new Error('הניחוש חורג מטווח המחשבון');
    let evaluations = 0;
    const safe = x => {
      if (!Number.isFinite(x) || Math.abs(x) > bound) return null;
      try { evaluations++; return call(f, x); } catch (_) { return null; }
    };
    const initial = safe(guess);
    if (initial === 0) return { root: guess, residual: 0, iterations: evaluations };
    const tolerance = 1e-11 * Math.max(Math.abs(initial || 0), 1e-12);
    let x = guess, fx = initial;
    for (let i = 0; i < 75 && fx !== null; i++) {
      const h = Math.cbrt(Number.EPSILON) * Math.max(1, Math.abs(x));
      const p = safe(x + h), m = safe(x - h);
      const d = p !== null && m !== null ? (p - m) / (2 * h) : p !== null ? (p - fx) / h : m !== null ? (fx - m) / h : NaN;
      if (!Number.isFinite(d) || d === 0) break;
      let step = fx / d, next = x - step, fn = safe(next);
      for (let j = 0; j < 15 && (fn === null || Math.abs(fn) > Math.abs(fx)); j++) {
        step /= 2; next = x - step; fn = safe(next);
      }
      if (fn === null || Math.abs(fn) > Math.abs(fx) || next === x) break;
      if (fn === 0 || (Math.abs(fn) <= tolerance && Math.abs(next - x) < 1e-8 * Math.max(1, Math.abs(next)))) {
        return { root: next, residual: Math.abs(fn), iterations: evaluations };
      }
      x = next; fx = fn;
    }
    let samples = [{ x: guess, y: initial }];
    for (let k = 0; k < 60; k++) {
      const radius = 0.25 * Math.max(1, Math.abs(guess)) * 1.8 ** k;
      for (const xx of [Math.max(-bound, guess - radius), Math.min(bound, guess + radius)]) {
        const yy = safe(xx);
        if (yy === 0) return { root: xx, residual: 0, iterations: evaluations };
        samples.push({ x: xx, y: yy });
      }
      samples.sort((p, q) => p.x - q.x);
      for (let j = 0; j < samples.length - 1; j++) {
        const p = samples[j], q = samples[j + 1];
        if (p.y === null || q.y === null || Math.sign(p.y) === Math.sign(q.y)) continue;
        let l = p.x, r = q.x, fl = p.y, fr = q.y;
        for (let it = 0; it < 140; it++) {
          const mid = l + (r - l) / 2, fm = safe(mid);
          if (fm === null) break;
          if (fm === 0 || Math.abs(fm) <= tolerance) return { root: mid, residual: Math.abs(fm), iterations: evaluations };
          if (mid === l || mid === r) break;
          if (Math.sign(fl) !== Math.sign(fm)) { r = mid; fr = fm; } else { l = mid; fl = fm; }
        }
      }
      if (radius > 2 * bound) break;
    }
    throw new Error('לא נמצא פתרון שהתכנס. נסו ניחוש אחר; ייתכן שאין פתרון ממשי');
  }
  function summation(f, start, end) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || Math.abs(start)>=1e10 || Math.abs(end)>=1e10 || end < start || end - start > 100000) throw new Error('גבולות הסכום חייבים להיות שלמים בסדר עולה בין ‎−10¹⁰ ל־10¹⁰, עד 100,001 איברים');
    const terms = [];
    for (let x = start; x <= end; x++) terms.push(call(f, x));
    return total(terms);
  }
  function table(f, start, end, step) {
    finite(start); finite(end); finite(step);
    if (step <= 0 || end <= start) throw new Error('נדרש סוף גדול מההתחלה וצעד חיובי');
    const span = (end - start) / step, count = Math.floor(span + 1e-10) + 1;
    if (count > 30) throw new Error('הטבלה מוגבלת ל־30 שורות');
    return Array.from({ length: count }, (_, i) => { const x = start + i * step; return { x, y: call(f, x) }; });
  }
  function linear(A, b) {
    if (!Array.isArray(A) || ![2, 3].includes(A.length) || !Array.isArray(b) || b.length !== A.length || A.some(r => !Array.isArray(r) || r.length !== A.length)) throw new Error('נדרשת מערכת של 2 או 3 משוואות');
    const n = A.length, m = A.map((r, i) => [...r.map(v => finite(v)), finite(b[i])]);
    const scales = A.map(r => Math.max(...r.map(Math.abs)));
    if (scales.some(s => s === 0)) throw new Error('למערכת אין פתרון יחיד');
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) / scales[i] > Math.abs(m[p][k]) / scales[p]) p = i;
      if (Math.abs(m[p][k]) / scales[p] < 1e-13) throw new Error('המערכת סינגולרית או קרובה לכך; אין פתרון יחיד יציב');
      [m[k], m[p]] = [m[p], m[k]]; [scales[k], scales[p]] = [scales[p], scales[k]];
      for (let i = k + 1; i < n; i++) {
        const factor = m[i][k] / m[k][k];
        m[i][k] = 0;
        for (let j = k + 1; j <= n; j++) m[i][j] -= factor * m[k][j];
      }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) x[i] = finite((m[i][n] - total(x.slice(i + 1).map((v, j) => v * m[i][i + j + 1]))) / m[i][i]);
    return x;
  }
  function polynomial(coeffs) {
    if (!Array.isArray(coeffs) || ![3, 4].includes(coeffs.length)) throw new Error('נדרשים 3 מקדמים לריבועית או 4 למעלה שלישית');
    coeffs.forEach(v => finite(v));
    const scale = Math.max(...coeffs.map(Math.abs));
    if (!scale || coeffs[0] === 0) throw new Error('המקדם המוביל חייב להיות שונה מאפס');
    const c = coeffs.map(v => v / scale);
    if (c.length === 3) {
      const [a, b, d] = c, disc = b * b - 4 * a * d;
      if (disc < 0) return [math.complex(-b / (2 * a), Math.sqrt(-disc) / Math.abs(2 * a)), math.complex(-b / (2 * a), -Math.sqrt(-disc) / Math.abs(2 * a))];
      const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(disc));
      if (q === 0) return [0, 0];
      return [finite(q / a), finite(d / q)].sort((a, b) => a - b);
    }
    const [a, b, cc, d] = c, A = b / a, B = cc / a, C = d / a;
    const p = B - A * A / 3, q = 2 * A * A * A / 27 - A * B / 3 + C;
    const u = q * q / 4, v = p * p * p / 27, disc = u + v;
    const tiny = 64 * Number.EPSILON * Math.max(Math.abs(u), Math.abs(v), Number.MIN_VALUE);
    let roots;
    if (Math.abs(disc) <= tiny) {
      const t = Math.cbrt(-q / 2);
      roots = [2 * t - A / 3, -t - A / 3, -t - A / 3];
    } else if (disc < 0) {
      const radius = 2 * Math.sqrt(-p / 3), theta = Math.acos(Math.max(-1, Math.min(1, (3 * q / (2 * p)) * Math.sqrt(-3 / p)))) / 3;
      roots = [0, 1, 2].map(k => radius * Math.cos(theta - 2 * Math.PI * k / 3) - A / 3);
    } else {
      const s = Math.sqrt(disc), t = Math.cbrt(-q / 2 + (q > 0 ? -s : s)), w = t === 0 ? 0 : -p / (3 * t);
      const real = t + w, re = -real / 2 - A / 3, im = Math.sqrt(3) * Math.abs(t - w) / 2;
      roots = [real - A / 3, math.complex(re, im), math.complex(re, -im)];
    }
    roots.forEach(r => typeof r === 'number' ? finite(r) : (finite(r.re), finite(r.im)));
    return roots.sort((r, s) => (typeof r === 'number' ? r : r.re) - (typeof s === 'number' ? s : s.re));
  }
  function stats(rows, type = 'one') {
    if (!['one', 'linear', 'quadratic', 'log', 'exp', 'ab', 'power', 'inverse'].includes(type)) throw new Error('סוג רגרסיה לא מוכר');
    if (!Array.isArray(rows) || !rows.length || rows.length > 10000) throw new Error('יש להזין בין 1 ל־10,000 שורות');
    const paired = type !== 'one';
    const data = rows.map(r => {
      const freq = r.freq === undefined ? 1 : r.freq;
      if (!Number.isSafeInteger(freq) || freq < 0 || freq > 1e9) throw new Error('שכיחות חייבת להיות מספר שלם לא שלילי, עד מיליארד');
      return { x: finite(r.x), y: paired ? finite(r.y, 'y') : undefined, freq };
    }).filter(r => r.freq > 0);
    const sum = f => total(data.map(r => r.freq * f(r)));
    const n = sum(() => 1);
    if (!n || n > 1e12) throw new Error('סכום השכיחויות חייב להיות חיובי ולא לעלות על 1e12');
    const sx = sum(r => r.x), sx2 = sum(r => r.x ** 2), mx = sx / n;
    const vx = sum(r => (r.x - mx) ** 2);
    const result = { n, sums: { x: sx, x2: sx2 }, meanX: mx, popStdX: Math.sqrt(vx / n), sampleStdX: n > 1 ? Math.sqrt(vx / (n - 1)) : null, minX: Math.min(...data.map(r => r.x)), maxX: Math.max(...data.map(r => r.x)) };
    result.normalized = x => { finite(x); if (!result.popStdX) throw new Error('סטיית התקן היא אפס'); return (x - mx) / result.popStdX; };
    if (!paired) return result;
    const sy = sum(r => r.y), sy2 = sum(r => r.y ** 2), my = sy / n, vy = sum(r => (r.y - my) ** 2);
    Object.assign(result.sums, { y: sy, y2: sy2, xy: sum(r => r.x * r.y), x3: sum(r => r.x ** 3), x2y: sum(r => r.x * r.x * r.y), x4: sum(r => r.x ** 4) });
    Object.assign(result, { meanY: my, popStdY: Math.sqrt(vy / n), sampleStdY: n > 1 ? Math.sqrt(vy / (n - 1)) : null, minY: Math.min(...data.map(r => r.y)), maxY: Math.max(...data.map(r => r.y)) });
    if (n < 2 || !vx) throw new Error('לרגרסיה דרושים לפחות שני ערכי x שונים');
    let A, B, C, r = null;
    if (type === 'quadratic') {
      const scaleX = Math.sqrt(vx / n), t = row => (row.x - mx) / scaleX;
      const s1 = sum(t), s2 = sum(row => t(row) ** 2), s3 = sum(row => t(row) ** 3), s4 = sum(row => t(row) ** 4);
      const co = linear([[n, s1, s2], [s1, s2, s3], [s2, s3, s4]], [sy, sum(row => t(row) * row.y), sum(row => t(row) ** 2 * row.y)]);
      C = co[2] / scaleX ** 2; B = co[1] / scaleX - 2 * C * mx; A = co[0] - co[1] * mx / scaleX + C * mx ** 2;
    } else {
      const tx = row => {
        if (['log', 'power'].includes(type)) { if (row.x <= 0) throw new Error('ברגרסיה זו כל ערכי x חייבים להיות חיוביים'); return Math.log(row.x); }
        if (type === 'inverse') { if (row.x === 0) throw new Error('ברגרסיה הפוכה x אינו יכול להיות אפס'); return 1 / row.x; }
        return row.x;
      };
      const ty = row => { if (['exp', 'ab', 'power'].includes(type)) { if (row.y <= 0) throw new Error('ברגרסיה זו כל ערכי y חייבים להיות חיוביים'); return Math.log(row.y); } return row.y; };
      const mu = sum(tx) / n, mv = sum(ty) / n, vu = sum(row => (tx(row) - mu) ** 2), vv = sum(row => (ty(row) - mv) ** 2), cov = sum(row => (tx(row) - mu) * (ty(row) - mv));
      if (!vu) throw new Error('אין שונות מספקת בנתונים');
      B = cov / vu; A = mv - B * mu;
      if (vv > 0) r = Math.max(-1, Math.min(1, cov / Math.sqrt(vu * vv)));
      if (['exp', 'ab', 'power'].includes(type)) A = Math.exp(A);
      if (type === 'ab') B = Math.exp(B);
    }
    finite(A); finite(B); if (C !== undefined) finite(C);
    result.coefficients = C === undefined ? { A, B, r } : { A, B, C };
    result.predictY = x => {
      finite(x);
      if (['log', 'power'].includes(type) && x <= 0) throw new Error('x חייב להיות חיובי');
      if (type === 'inverse' && x === 0) throw new Error('x אינו יכול להיות אפס');
      return finite(type === 'linear' ? A + B * x : type === 'quadratic' ? A + B * x + C * x * x : type === 'log' ? A + B * Math.log(x) : type === 'exp' ? A * Math.exp(B * x) : type === 'ab' ? A * B ** x : type === 'power' ? A * x ** B : A + B / x);
    };
    result.predictX = y => {
      finite(y);
      if (type === 'quadratic' && C !== 0) {
        const roots = polynomial([C, B, A - y]);
        if (roots.some(r => typeof r !== 'number')) throw new Error('לא קיים אומדן x ממשי עבור y זה');
        return roots;
      }
      if (B === 0 || (type === 'ab' && B === 1)) throw new Error('אין אומדן x יחיד במודל קבוע');
      if (['exp', 'ab', 'power'].includes(type) && y / A <= 0) throw new Error('y חייב להיות חיובי ברגרסיה זו');
      return finite(type === 'linear' || type === 'quadratic' ? (y - A) / B : type === 'log' ? Math.exp((y - A) / B) : type === 'exp' ? Math.log(y / A) / B : type === 'ab' ? Math.log(y / A) / Math.log(B) : type === 'power' ? (y / A) ** (1 / B) : B / (y - A));
    };
    return result;
  }
  function normalP(t) { finite(t); return 0.5 * (1 + math.erf(t / Math.SQRT2)); }
  function normalQ(t) { finite(t); return 0.5 * math.erf(t / Math.SQRT2); }
  function normalR(t) { finite(t); return 0.5 * (1 - math.erf(t / Math.SQRT2)); }
  function baseCalc(expr, base = 10) {
    const baseMap = { dec: 10, hex: 16, oct: 8, bin: 2 };
    base = baseMap[String(base).toLowerCase()] || Number(base);
    if (![2, 8, 10, 16].includes(base)) throw new Error('הבסיס חייב להיות 2, 8, 10 או 16');
    if (typeof expr !== 'string' || !expr.trim() || expr.length > 2000) throw new Error('הביטוי ריק או ארוך מדי');
    const bits = base === 2 ? 16 : 32, width = BigInt(bits), mod = 1n << width, min = -(mod >> 1n), max = (mod >> 1n) - 1n;
    const checked = n => { if (n < min || n > max) throw new Error(`חריגה מטווח ${bits} סיביות עם סימן`); return n; };
    const signed = n => BigInt.asIntN(bits, n);
    const source = expr.replace(/−/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
    const tokens = []; let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      const rest = source.slice(i);
      const op = /^(xnor|xor|and|not|neg|or)\b/i.exec(rest);
      if (op) { tokens.push({ op: op[0].toLowerCase() }); i += op[0].length; continue; }
      if ('()+-*/'.includes(source[i])) { tokens.push({ op: source[i++] }); continue; }
      // Lower-case d/h/b/o are explicit radix prefixes; upper-case A–F are hex digits.
      const prefix = /^(0x|0b|0o|[dhbo]:?)/.exec(rest);
      let radix = base, offset = 0;
      if (prefix) { radix = { '0x': 16, '0b': 2, '0o': 8, d: 10, h: 16, b: 2, o: 8 }[prefix[0].replace(':', '')]; offset = prefix[0].length; }
      const digits = /^[0-9A-Fa-f]+/.exec(rest.slice(offset));
      if (!digits) throw new Error('סימן לא מוכר בביטוי הבסיסים');
      const text = digits[0];
      const valid = radix === 2 ? /^[01]+$/ : radix === 8 ? /^[0-7]+$/ : radix === 10 ? /^\d+$/ : /^[\dA-Fa-f]+$/;
      if (!valid.test(text)) throw new Error(`ספרה שאינה חוקית בבסיס ${radix}`);
      let n = 0n;
      for (const digit of text.toUpperCase()) n = n * BigInt(radix) + BigInt(parseInt(digit, 16));
      const literalBits = radix === 2 ? 16 : 32, literalMod = 1n << BigInt(literalBits);
      if (radix !== 10) { if (n >= literalMod) throw new Error('המספר חורג מטווח הבסיס'); n = BigInt.asIntN(literalBits, n); }
      // Permit the unsigned magnitude of minimum signed decimal only immediately after unary minus.
      tokens.push({ n, decimal: radix === 10 }); i += offset + text.length;
    }
    let pos = 0, depth = 0;
    const peek = op => tokens[pos] && tokens[pos].op === op;
    function atom() {
      if (++depth > 100) throw new Error('יותר מדי סוגריים');
      let v;
      const token = tokens[pos++];
      if (!token) throw new Error('ביטוי לא שלם');
      if ('n' in token) v = checked(token.n);
      else if (token.op === '(') { v = expression(0); if (!peek(')')) throw new Error('חסר סוגר סוגר'); pos++; }
      else if (['+', '-', 'not', 'neg'].includes(token.op)) {
        if (token.op === '-' && tokens[pos] && tokens[pos].decimal && tokens[pos].n === -min) { v = min; pos++; }
        else { const arg = atom(); v = token.op === 'not' ? signed(~arg) : token.op === '+' ? arg : token.op === 'neg' ? signed(-arg) : checked(-arg); }
      } else throw new Error('תחביר לא תקין');
      depth--; return v;
    }
    const precedence = { or: 1, xor: 1, xnor: 1, and: 2, '+': 3, '-': 3, '*': 4, '/': 4 };
    function expression(level) {
      let left = atom();
      while (tokens[pos] && precedence[tokens[pos].op] >= level) {
        const op = tokens[pos++].op, right = expression(precedence[op] + 1);
        if (op === '+') left = checked(left + right);
        else if (op === '-') left = checked(left - right);
        else if (op === '*') left = checked(left * right);
        else if (op === '/') { if (right === 0n) throw new Error('אין לחלק באפס'); left = checked(left / right); }
        else if (op === 'and') left = signed(left & right);
        else if (op === 'or') left = signed(left | right);
        else if (op === 'xor') left = signed(left ^ right);
        else left = signed(~(left ^ right));
      }
      return left;
    }
    const n = expression(0);
    if (pos !== tokens.length) throw new Error('סימנים מיותרים בביטוי');
    const format = radix => {
      const w = radix === 2 ? 16 : 32;
      if (radix === 2 && (n < -32768n || n > 32767n)) return null;
      return (n < 0 ? BigInt.asUintN(w, n) : n).toString(radix).toUpperCase();
    };
    return { value: Number(n), dec: n.toString(), hex: format(16), oct: format(8), bin: format(2) };
  }
  return { integrate, derivative, solve, summation, table, linear, polynomial, stats, normalP, normalQ, normalR, baseCalc };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { createAlgorithms };
