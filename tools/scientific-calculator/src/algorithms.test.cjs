const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('mathjs');
const { createAlgorithms } = require('./algorithms.js');
const a = createAlgorithms(math);
const close = (actual, expected, eps = 1e-8) => assert.ok(Math.abs(actual - expected) <= eps * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test('integration: polynomial, reversed interval, trigonometric, Gaussian, singular endpoint rejection', () => {
  close(a.integrate(x => x ** 4, 0, 2).value, 6.4);
  close(a.integrate(x => x ** 2, 3, -2).value, -35 / 3);
  close(a.integrate(Math.sin, 0, Math.PI).value, 2);
  const gauss = a.integrate(x => Math.exp(-x * x), -3, 3);
  close(gauss.value, Math.sqrt(Math.PI) * math.erf(3));
  assert.ok(gauss.error < 1e-8);
  close(a.integrate(x => Math.sin(17 * x), 0, 1).value, (1 - Math.cos(17)) / 17);
  close(a.integrate(x => Math.cos(128 * Math.PI * x), 0, 1).value, 0);
  assert.deepEqual(a.integrate(() => { throw new Error('unused'); }, 2, 2), { value: 0, error: 0 });
  assert.throws(() => a.integrate(x => 1 / x, 0, 1));
  assert.throws(() => a.integrate(Math.sin, 0, Infinity));
  assert.throws(() => a.integrate(Math.sin, 0, 1, 0));
  close(a.integrate(Math.log,1,Math.E).value,1);
  close(a.integrate(x=>1/(x*x),1,5,1e-7).value,.8);
  close(a.integrate(x=>x,0,1,1e-14).value,.5);
  assert.throws(()=>a.integrate(x=>x,0,1,1e-15));
});

test('derivatives: known smooth derivatives and undefined derivative', () => {
  close(a.derivative(x => x ** 3, 2).value, 12);
  close(a.derivative(Math.sin, 0).value, 1);
  close(a.derivative(Math.exp, 1).value, Math.E);
  close(a.derivative(x => x * x, 0).value, 0);
  close(a.derivative(() => 17, 3).value, 0);
  close(a.derivative(x => 1e9 * x * x, 0).value, 0);
  close(a.derivative(x => Math.exp(1000 * x), 0).value, 1000);
  close(a.derivative(Math.log,.01).value,100);
  close(a.derivative(x=>3*x*x-5*x+2,2,1e-12).value,7,1e-12);
  close(a.derivative(Math.sin,Math.PI/2).value,0);
  assert.throws(()=>a.derivative(Math.sin,0,1e-15));
  assert.throws(()=>a.derivative(x=>1e20*x,1,1e-14));
  assert.throws(() => a.derivative(Math.abs, 0));
  assert.throws(() => a.derivative(Math.sqrt, 0));
});

test('solver: Newton, repeated root, default zero derivative, non-real and discontinuity rejection', () => {
  close(a.solve(x => x * x - 2, 1).root, Math.SQRT2);
  close(a.solve(x => Math.cos(x) - x, 0).root, 0.7390851332151607);
  close(a.solve(x => x ** 3 - 8, 0).root, 2);
  close(a.solve(x => (x - 3) ** 2, 2).root, 3, 1e-7);
  close(a.solve(x => Math.log(x) - 1, 0).root, Math.E);
  const root = a.solve(x => x * x - 4, -3);
  close(root.root, -2); assert.ok(root.residual < 1e-9 && root.iterations > 0);
  assert.throws(() => a.solve(x => x * x + 1, 0));
  assert.throws(() => a.solve(x => 1 / x, 0));
  assert.throws(() => a.solve(() => 1e-14, 0));
  close(a.solve(x=>x-1e20,1e20).root,1e20);
  close(a.solve(x=>x-1e20,9e19).root,1e20);
});

test('summation and table use inclusive endpoints and enforce finite bounded work', () => {
  close(a.summation(x => x * x, 1, 100), 338350);
  close(a.summation(x => x, -3, 3), 0);
  assert.equal(a.table(x => x * x, 0, 0.3, 0.1).length, 4);
  assert.equal(a.table(x => x, 0, 29, 1).length, 30);
  assert.throws(() => a.table(x => x, 0, 30, 1), /30/);
  assert.deepEqual(a.table(x => x*x+.5, -1, 1, .5), [{x:-1,y:1.5},{x:-.5,y:.75},{x:0,y:.5},{x:.5,y:.75},{x:1,y:1.5}]);
  assert.throws(() => a.table(x => x, 2, 0, -1));
  assert.throws(() => a.table(x => x, 2, 2, 1));
  assert.throws(() => a.table(x => x, 0, 5, -1));
  assert.throws(() => a.table(x => x, 0, 100, 1));
  assert.throws(() => a.table(x => x, 0, 5, 0));
  assert.throws(() => a.summation(x => x, 1.5, 10));
  assert.throws(() => a.summation(x => x, 0, 100001));
  assert.throws(() => a.summation(x=>x,1e10,1e10));
});

test('linear systems: pivoting, scaling, 3x3 and singular rejection', () => {
  const x = a.linear([[0, 2], [3, -1]], [4, 1]); close(x[0], 1); close(x[1], 2);
  const y = a.linear([[1, 1, 1], [2, -1, 3], [3, 2, -1]], [6, 9, 4]);
  y.forEach((v, i) => close(v, i + 1));
  const scaled = a.linear([[1e-20, 2e-20], [3e20, 4e20]], [5e-20, 11e20]);
  close(scaled[0], 1); close(scaled[1], 2);
  assert.throws(() => a.linear([[1, 2], [2, 4]], [3, 6]));
  assert.throws(() => a.linear([[1, 0], [0, 0]], [2, 3]));
  assert.throws(() => a.linear([[1]], [2]));
});

test('polynomials: stable quadratics and every cubic root satisfies original equation', () => {
  a.polynomial([1, -5, 6]).forEach((x, i) => close(x, i + 2));
  assert.deepEqual(a.polynomial([1, 0, 0]), [0, 0]);
  const im = a.polynomial([1, 0, 1]); close(im[0].re, 0); close(Math.abs(im[0].im), 1);
  const stable = a.polynomial([1, -1e8, 1]); close(stable[0], 1e-8, 1e-12); close(stable[1], 1e8);
  for (const coeffs of [[1, -6, 11, -6], [1, 0, 0, -1], [1, -3, 3, -1], [2, -4, -22, 24], [1, 0, 0, 0], [1, 0, 1, 1]]) {
    const roots = a.polynomial(coeffs); assert.equal(roots.length, 3);
    for (const root of roots) {
      const residual = coeffs.reduce((s, c) => math.add(math.multiply(s, root), c), 0);
      assert.ok(math.abs(residual) < 1e-8, `bad root ${root} for ${coeffs}: ${residual}`);
    }
  }
  assert.throws(() => a.polynomial([0, 1, 2]));
});

test('frequency statistics are weighted and sample/population deviations are distinct', () => {
  const s = a.stats([{ x: 1, freq: 2 }, { x: 3, freq: 2 }, { x: 999, freq: 0 }]);
  assert.equal(s.n, 4); close(s.meanX, 2); close(s.popStdX, 1); close(s.sampleStdX, Math.sqrt(4 / 3));
  assert.deepEqual(s.sums, { x: 8, x2: 20 }); assert.equal(s.minX, 1); assert.equal(s.maxX, 3);
  close(s.normalized(4), 2);
  assert.equal(a.stats([{ x: 9 }]).sampleStdX, null);
  assert.throws(() => a.stats([{ x: 9, freq: -1 }]));
  assert.throws(() => a.stats([{ x: 9, freq: 0 }]));
});

test('all seven regression models recover independent constructed data and inverse predictions', () => {
  const models = [
    ['linear', x => 2 + 3 * x, 2, 3], ['quadratic', x => 2 + 3 * x + 4 * x * x, 2, 3, 4],
    ['log', x => 2 + 3 * Math.log(x), 2, 3], ['exp', x => 2 * Math.exp(0.3 * x), 2, 0.3],
    ['ab', x => 2 * 1.3 ** x, 2, 1.3], ['power', x => 2 * x ** 1.3, 2, 1.3], ['inverse', x => 2 + 3 / x, 2, 3]
  ];
  for (const [type, f, A, B, C] of models) {
    const result = a.stats([1, 2, 3, 4, 5].map((x, i) => ({ x, y: f(x), freq: i + 1 })), type);
    close(result.coefficients.A, A); close(result.coefficients.B, B);
    if (C) close(result.coefficients.C, C); else close(result.coefficients.r, type === 'inverse' ? 1 : 1);
    close(result.predictY(2.5), f(2.5));
    const predicted = result.predictX(f(2.5));
    if (Array.isArray(predicted)) assert.ok(predicted.some(x => Math.abs(x - 2.5) < 1e-8)); else close(predicted, 2.5);
    close(result.sums.xy, [1, 2, 3, 4, 5].reduce((sum, x, i) => sum + x * f(x) * (i + 1), 0));
  }
  assert.throws(() => a.stats([{ x: 0, y: 1 }, { x: 1, y: 2 }], 'log'));
  assert.throws(() => a.stats([{ x: 1, y: 0 }, { x: 2, y: 2 }], 'exp'));
  assert.throws(() => a.stats([{ x: 1, y: 1 }, { x: 1, y: 2 }], 'linear'));
  assert.throws(() => a.stats([{ x: 1, y: 1 }, { x: 2, y: 2 }], 'quadratic'));
});

test('normal distribution obeys symmetry, center, and standard reference probabilities', () => {
  close(a.normalP(0), 0.5); close(a.normalQ(0), 0); close(a.normalR(0), 0.5);
  close(a.normalP(1.96), 0.9750021048517795, 1e-12);
  close(a.normalQ(-1), -0.3413447460685429, 1e-12);
  close(a.normalR(1), a.normalP(-1), 1e-12);
  close(a.normalP(2) + a.normalR(2), 1, 1e-14);
});

test('BASE-N: conversion, signed widths, precedence, two’s complement and truncated integer arithmetic', () => {
  assert.deepEqual(a.baseCalc('30', 'dec'), { value: 30, dec: '30', hex: '1E', oct: '36', bin: '11110' });
  assert.equal(a.baseCalc('1F + 1', 'hex').hex, '20');
  assert.equal(a.baseCalc('h:FF + d:1', 'dec').value, 256);
  assert.equal(a.baseCalc('d5 + h5', 10).value, 10);
  assert.equal(a.baseCalc('1111111111111111', 2).value, -1);
  assert.equal(a.baseCalc('FFFFFFFF', 16).value, -1);
  assert.equal(a.baseCalc('37777777777', 8).value, -1);
  assert.equal(a.baseCalc('not(0)', 2).bin, '1111111111111111');
  assert.equal(a.baseCalc('neg(1)', 16).hex, 'FFFFFFFF');
  assert.equal(a.baseCalc('not(0)', 10).value, -1);
  assert.equal(a.baseCalc('1010 and 1100', 2).value, 8);
  assert.equal(a.baseCalc('1010 or 1100', 2).value, 14);
  assert.equal(a.baseCalc('1010 xor 1100', 2).value, 6);
  assert.equal(a.baseCalc('1010 xnor 1100', 2).value, -7);
  assert.equal(a.baseCalc('1 + 2 * 3 and 6', 10).value, 6);
  assert.equal(a.baseCalc('(1 + 2) * 3', 10).value, 9);
  assert.equal(a.baseCalc('-7 / 3', 10).value, -2);
  assert.equal(a.baseCalc('-2147483648', 10).value, -2147483648);
  assert.equal(a.baseCalc('32768', 10).bin, null);
});

test('BASE-N rejects overflow, invalid digits, fractions, division by zero, and executable syntax', () => {
  for (const [expression, base] of [['2147483647+1', 10], ['111111111111111+1', 2], ['FFFFFFFFF', 16], ['2', 2], ['8', 8], ['1.5', 10], ['1 / 0', 10], ['foo()', 10], ['1;alert(1)', 10], ['(1+2', 10], ['1 2', 10], ['__proto__', 16], ['-(-2147483648)', 10]]) {
    assert.throws(() => a.baseCalc(expression, base), expression);
  }
});
