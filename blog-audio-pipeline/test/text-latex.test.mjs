import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScript, chunkScript, normalizeForSpeech, splitMathSegments } from '../src/text.mjs';

test('normalization preserves delimited LaTeX and cleans Markdown only in prose', () => {
  const source = '**דוגמה:** למשל, \\(x_{12}^{2}-3x=0\\), וגם \\[\\sqrt{49}=7\\].';
  const normalized = normalizeForSpeech(source);

  assert.equal(normalized.includes('**'), false);
  assert.match(normalized, /\\\(x_\{12\}\^\{2\}-3x=0\\\)/);
  assert.match(normalized, /\\\[\\sqrt\{49\}=7\\\]/);
});

test('a Markdown link keeps a LaTeX label but drops its destination', () => {
  const normalized = normalizeForSpeech('[\\(x^2\\)](https://example.com/math)');
  assert.equal(normalized.includes('https://'), false);
  assert.equal(normalized, '\\(x^2\\).');
});

test('supported math delimiters are identified without enabling single-dollar math', () => {
  const parts = splitMathSegments('מחיר $20 ואז \\(x_1\\), $$y^2$$ וגם \\[z\\]');
  assert.deepEqual(parts.filter((part) => part.math).map((part) => part.text), [
    '\\(x_1\\)', '$$y^2$$', '\\[z\\]',
  ]);
});

test('chunking never splits a formula near a hard boundary', () => {
  const formula = '\\(x_{123}^{2}+\\sqrt{49}-(-3)^2=0\\)';
  const body = `פתיחה ${'מילה '.repeat(55)}${formula} ${'המשך '.repeat(55)}סוף`;
  const script = buildScript({ title: 'בדיקה', body });
  const chunks = chunkScript(script, { chunkTargetChars: 90, chunkMaxChars: 110 });

  assert.ok(chunks.length > 2);
  assert.equal(chunks.filter((chunk) => chunk.includes(formula)).length, 1);
  assert.equal(chunks.some((chunk) => chunk.includes('\\(') !== chunk.includes('\\)')), false);
  assert.equal(chunks.join('').replace(/\s+/g, ''), script.replace(/\s+/g, ''));
});

test('sentence punctuation inside a formula does not create a chunk boundary', () => {
  const formula = '\\(\\text{נסמן a. ואז b. ונקבל }x_1=2\\)';
  const script = `פתיחה ארוכה ${'מילה '.repeat(30)}${formula} ${'המשך '.repeat(30)}סוף.`;
  const chunks = chunkScript(script, { chunkTargetChars: 85, chunkMaxChars: 105 });

  assert.equal(chunks.filter((chunk) => chunk.includes(formula)).length, 1);
  assert.equal(chunks.join('').replace(/\s+/g, ''), script.replace(/\s+/g, ''));
});

test('an oversized formula remains one atomic chunk', () => {
  const formula = `\\(${Array.from({ length: 80 }, (_, i) => `x_{${i}}`).join('+')}\\)`;
  const chunks = chunkScript(`לפני ${formula} אחרי.`, { chunkTargetChars: 80, chunkMaxChars: 100 });

  assert.equal(chunks.filter((chunk) => chunk.includes(formula)).length, 1);
  assert.equal(chunks.join('').replace(/\s+/g, ''), `לפני ${formula} אחרי.`.replace(/\s+/g, ''));
});
