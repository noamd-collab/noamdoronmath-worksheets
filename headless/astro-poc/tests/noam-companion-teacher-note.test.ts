import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

type CompanionPayload = {
  message: string;
  page: { kind: string; path: string; title: string };
  teacher: { note: string; grade: string; topic: string } | null;
};

const clients = [
  ['served', new URL('../public/noam-site-companion.js', import.meta.url)],
  ['legacy', new URL('../../../noam-site-companion.js', import.meta.url)],
] as const;

function definition(source: string, name: string) {
  const start = source.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, `Missing shipped ${name}`);
  const end = source.indexOf('\n  function ', start + 1);
  assert.notEqual(end, -1, `Missing boundary after ${name}`);
  return source.slice(start, end);
}

function ordinaryRequest(source: string, aiNote: string | null, printedNote: string, teachers = true) {
  const { document, window } = parseHTML(`<html><head><title>דף מורים</title></head>
    <body ${teachers ? 'data-noam-companion="teacher"' : ''}>
      <select id="grade"><option value="9" selected>כיתה ט׳</option></select>
      <select id="topic"><option value="7" selected>משוואות</option></select>
      <input type="radio" name="scenario" value="practice" checked>
      <input type="radio" name="style" value="blended" checked>
      <textarea id="teacher-note"></textarea>
      ${aiNote === null ? '' : '<textarea id="teacher-ai-note"></textarea>'}
      <form id="request"><input id="message"></form>
    </body></html>`);
  for (const id of ['grade', 'topic']) {
    const select = document.getElementById(id)!;
    Object.defineProperty(select, 'selectedOptions', { get: () => select.querySelectorAll('[selected]') });
  }
  (document.getElementById('teacher-note') as HTMLTextAreaElement).value = printedNote;
  if (aiNote !== null) (document.getElementById('teacher-ai-note') as HTMLTextAreaElement).value = aiNote;
  const input = document.getElementById('message') as HTMLInputElement;
  input.value = 'איפה מוצאים דפי עבודה?';
  let capture!: (payload: CompanionPayload) => void;
  const submitted = new Promise<CompanionPayload>(resolve => { capture = resolve; });
  const submitAt = source.indexOf('  form.addEventListener("submit"');
  const submitEnd = source.indexOf('  document.addEventListener("keydown"', submitAt);
  assert.ok(submitAt >= 0 && submitEnd > submitAt, 'Exercise the shipped ordinary companion submit handler');
  const bind = new Function('document', 'capture', `
    const location = { pathname: ${JSON.stringify(teachers ? '/teachers/' : '/')}, search: '?grade=9&topic=7' };
    const form = document.getElementById('request'), input = document.getElementById('message');
    const answerEl = document.createElement('p');
    const API = '/api/noamSiteCompanion', FALLBACK = 'unavailable', EXPORT_NOTE = '';
    let streaming = false;
    const isLocalSolve = () => false, showThinking = () => {}, showResult = () => {}, siteHref = path => path;
    const ensureBotClient = async () => ({ postJson: async (url, payload) => { capture(payload); return { answer: 'ok' }; } });
    ${definition(source, 'pageKind')}
    ${definition(source, 'teacherContext')}
    ${source.slice(submitAt, submitEnd)}
  `);
  bind(document, capture);
  document.getElementById('request')!.dispatchEvent(new window.Event('submit', { cancelable: true }));
  return { submitted, document };
}

for (const [name, path] of clients) {
  const source = readFileSync(path, 'utf8');
  test(`${name} companion sends only the AI note in an ordinary teacher request`, async () => {
    const aiNote = 'AI_CONTEXT_ONLY_'.repeat(30);
    const printedNote = 'PRINT_FOR_STUDENTS_ONLY_'.repeat(25);
    const request = ordinaryRequest(source, ` \n${aiNote}\n `, printedNote);
    const payload = await request.submitted;
    assert.equal(payload.page.kind, 'teachers');
    assert.equal(payload.teacher?.grade, '9');
    assert.equal(payload.teacher?.topic, '7');
    assert.equal(payload.teacher?.note, aiNote.slice(0, 400));
    assert.equal(payload.teacher?.note.length, 400);
    assert.equal(JSON.stringify(payload).includes('PRINT_FOR_STUDENTS_ONLY_'), false);
    assert.equal((request.document.getElementById('teacher-note') as HTMLTextAreaElement).value, printedNote);
  });

  test(`${name} companion never falls back to a printed note when the AI note is blank or absent`, async () => {
    for (const aiNote of [null, '', ' \n\t ']) {
      const payload = await ordinaryRequest(source, aiNote, 'PRINT_ONLY_SENTINEL').submitted;
      assert.equal(payload.teacher?.note, '');
      assert.equal(JSON.stringify(payload).includes('PRINT_ONLY_SENTINEL'), false);
    }
  });

  test(`${name} companion leaves ordinary non-teacher requests without teacher context`, async () => {
    const payload = await ordinaryRequest(source, 'AI_CONTEXT_ONLY', 'PRINT_ONLY_SENTINEL', false).submitted;
    assert.equal(payload.page.kind, 'home');
    assert.equal(payload.teacher, null);
  });
}
