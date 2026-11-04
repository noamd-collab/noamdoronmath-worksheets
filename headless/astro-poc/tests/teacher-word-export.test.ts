import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { DOMParser } from 'linkedom';
import { createTeacherDocx, mathXml, richXml } from '../../../demos/teacher-word-export.js';
import { selectWordQuestions } from '../src/lib/teacherWordSelection';

const encoded = JSON.parse(readFileSync(new URL('../src/data/teacher-word-content.json', import.meta.url), 'utf8'));
const bank = JSON.parse(gunzipSync(Buffer.from(encoded.gzipBase64, 'base64')).toString());
function unzipStored(bytes: Uint8Array) {
  const b = Buffer.from(bytes), files: Record<string, string> = {}; let at = 0;
  while (b.readUInt32LE(at) === 0x04034b50) {
    assert.equal(b.readUInt16LE(at + 8), 0);
    const size = b.readUInt32LE(at + 18), n = b.readUInt16LE(at + 26), extra = b.readUInt16LE(at + 28);
    const name = b.subarray(at + 30, at + 30 + n).toString(); const start = at + 30 + n + extra;
    files[name] = b.subarray(start, start + size).toString(); at = start + size;
  }
  assert.equal(b.readUInt32LE(at), 0x02014b50); return files;
}
const fixture = (id = 'a'.repeat(32) + ':2') => ({ id, q: 2, topic: 'שברים', levelLabel: 'רמה א׳', text: 'חשבו $x^2 + \\f{1}{2}$.', items: [
  { label: 'א', text: 'נתון $x=3$.', answer: '$\\f{19}{2}$' },
  { label: 'ב', text: 'נתון $x=4$.', answer: '$\\f{33}{2}$' },
] });

test('Word file contains editable equations and all selected answers after the questions, with RTL paragraphs', async () => {
  const files = unzipStored(await createTeacherDocx({ questions: [fixture()], note: '<בדיקה> $literal$' }, () => { throw Error('no figures'); }));
  const document = files['word/document.xml'];
  assert.ok(document.indexOf('תשובות סופיות') > document.indexOf('נתון'));
  assert.equal((document.match(/<m:f>/g) || []).length, 3);
  assert.equal((document.match(/<m:sSup>/g) || []).length, 1);
  assert.ok(document.includes('&lt;בדיקה&gt; $literal$'));
  assert.equal(Object.keys(files).some((x) => x.includes('media')), false);
  const dom = new DOMParser().parseFromString(document, 'text/xml');
  for (const p of dom.getElementsByTagName('w:p')) {
    assert.equal(p.getElementsByTagName('w:bidi').length, 1);
    assert.equal(p.getElementsByTagName('w:jc')[0].getAttribute('w:val'), 'left'); // RTL start in Word.
  }
  assert.ok(files['word/header1.xml'].includes('בס״ד'));
  assert.ok(files['word/settings.xml'].includes('he-IL'));
  assert.ok(!files['word/settings.xml'].includes('documentProtection'));
  assert.ok(!document.includes('altChunk'));
});

test('selection is strict, deduplicates source/question, keeps same number at other levels, and rejects partial output', () => {
  const entries = Object.entries(bank.sheets).slice(0, 2) as [string, any][];
  const selection = entries.map(([pdfId, sheet]) => ({ pdfId, sourceSha256: sheet.sourceSha256, q: Number(Object.keys(sheet.questions)[0]) }));
  const selected = selectWordQuestions(bank, [...selection, selection[0]]);
  assert.equal(selected.questions.length, 2); assert.deepEqual(selected.missing, []);
  const missing = selectWordQuestions(bank, [...selection, { pdfId: '0'.repeat(32), sourceSha256: '0'.repeat(64), q: 1 }]);
  assert.equal(missing.questions.length, 0); assert.equal(missing.missing.length, 1);
  assert.throws(() => selectWordQuestions(bank, []));
  assert.throws(() => selectWordQuestions(bank, [{ ...selection[0], q: '1' }]));
  assert.throws(() => selectWordQuestions(bank, [{ ...selection[0], pdfId: '../private' }]));
  assert.equal(selectWordQuestions(bank, [{ ...selection[0], sourceSha256: '0'.repeat(64) }]).missing.length, 1);
});

test('missing answer, duplicate question, malformed math and unsupported conversion fail rather than produce incomplete Word', async () => {
  await assert.rejects(createTeacherDocx({ questions: [{ ...fixture(), items: [{ label: 'א', text: 'בדיקה', answer: '' }] }] }));
  await assert.rejects(createTeacherDocx({ questions: [fixture(), fixture()] }));
  assert.throws(() => richXml('נתון $x'), /UNBALANCED/);
  assert.throws(() => mathXml('1/2'), /SLASH/);
  assert.throws(() => mathXml('\\unknown{x}'), /UNSUPPORTED/);
  const nested = mathXml('\\d{\\f{1}{2}}{\\sqrt{3}}');
  assert.equal((nested.match(/<m:f>/g) || []).length, 2);
  assert.ok(nested.includes('<m:rad>'));
  assert.ok(mathXml('___ + x_1^2').includes('___'));
});

test('every included source has every question and subpart and all public text/formulas convert without fallback', () => {
  let count = 0;
  const approved = JSON.parse(readFileSync(new URL('../src/data/teacher-word-approved-g6.json', import.meta.url), 'utf8'));
  const partial = new Set(approved.questions.map((q:any) => q.pdfId));
  for (const [pdfId, sheet] of Object.entries(bank.sheets) as [string, any][]) {
    const source = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${pdfId}.json`, import.meta.url), 'utf8'));
    assert.equal(sheet.sourceSha256, source.sourceSha256);
    if (!partial.has(pdfId)) assert.deepEqual(Object.keys(sheet.questions).map(Number).sort((a,b)=>a-b), [...new Set(source.questions.map((q:any)=>q.q))].sort((a:any,b:any)=>a-b));
    for (const question of Object.values(sheet.questions) as any[]) {
      const originalParts = [...new Set(source.questions.filter((q:any)=>q.q===question.q).map((q:any)=>q.part).filter(Boolean))];
      assert.deepEqual(new Set(question.items.map((p:any)=>p.label).filter(Boolean)), new Set(originalParts));
      for (const part of [question, ...question.items]) {
        if (part !== question) assert.ok(part.answer.trim());
        for (const text of [part.text,part.answer,part.example?.title,...(part.example?.lines||[]),...(part.table?.head||[]),...(part.table?.rows?.flat()||[])].filter(Boolean)) assert.doesNotThrow(()=>richXml(text), question.id);
      }
      count++;
    }
  }
  assert.equal(count, encoded.questions); assert.equal(Object.keys(bank.sheets).length, encoded.sheets);
});

test('a referenced exercise must be explicitly selected and its reference follows the Word numbering', async () => {
  const pdfId = '5613be2eafda43008092bceb6c01e1cd', sheet = bank.sheets[pdfId];
  const request = (q:number) => ({ pdfId, sourceSha256: sheet.sourceSha256, q });
  const alone = selectWordQuestions(bank, [request(15)]);
  assert.equal(alone.questions.length, 0); assert.ok(alone.required.some(q=>q.q===10));
  const selected = selectWordQuestions(bank, [request(10),request(15)]);
  assert.equal(selected.questions.length, 2);
  const files = unzipStored(await createTeacherDocx({questions:selected.questions},()=>{throw Error('no figures');}));
  assert.ok(files['word/document.xml'].includes('בשאלה 1'));
  assert.ok(!files['word/document.xml'].includes('בשאלה 10'));
});
