/**
 * Verified curated hints from Supabase (public.noam_ramzi_hints) reach Ramzi as
 * text-only didactic guides: three graded hints, then הבנתי / לא הבנתי as before.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
require(join(root, 'public/noam-didactic-guides.js'));
const guides = globalThis.NoamDidacticGuides;
const curated = require(join(root, 'public/noam-curated-hints.js'));
const viewer = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');

const config = { url: 'https://example123.supabase.co', key: 'sb_publishable_test' };
const hints = ['רמז ראשון', 'רמז שני', 'רמז שלישי'];

function manifest(prefix: string, level: string, ids: string[]) {
  return { prefix, levelCode: level, exercises: ids.map((id) => ({ id })) };
}

function fakeFetch(rows: unknown, calls: { url: string; init: any }[] = [], ok = true) {
  return (url: string, init: any) => {
    calls.push({ url, init });
    return Promise.resolve({ ok, json: () => Promise.resolve(rows) });
  };
}

describe('curated hint guides', () => {
  it('registers three text hints for a viewer exercise id only', () => {
    assert.equal(guides.register('G7-T02-A-Q03א', { hints }), true);
    assert.equal(guides.register('G7-T02-C-Q03א', { hints }), false, 'level C is not a site level');
    assert.equal(guides.register('__proto__', { hints }), false);
    assert.equal(guides.register('G7-T02-A-Q04א', { hints: hints.slice(0, 2) }), false);
    assert.equal(guides.register('G7-T02-A-Q04א', { hints: ['א', 'ב', 'x'.repeat(601)] }), false);
    assert.equal(guides.get('constructor'), null);
  });

  it('never replaces an authored geometry guide', () => {
    const before = guides.get('G9-T15-E-Q04א');
    assert.equal(guides.register('G9-T15-E-Q04א', { hints }), false);
    assert.equal(guides.get('G9-T15-E-Q04א'), before);
  });

  it('serves the hints in order without a drawing, then hands other questions to the AI', () => {
    const id = 'G7-T03-B-Q05א';
    guides.register(id, { hints });
    guides.resetUnderstanding(id);
    hints.forEach((text, index) => {
      const reply = guides.respond(id, { helpKind: 'hint', hintIndex: index, progress: index });
      assert.equal(reply.text, text);
      assert.equal(reply.visual, null);
      assert.equal(reply.source, 'didactic-guide');
    });
    assert.equal(guides.respond(id, { helpKind: 'free_question', studentMessage: 'השרטוט קטן, אפשר להגדיל?' }), null);
    assert.equal(guides.respond(id, { helpKind: 'free_question', studentMessage: 'ואז מה?' }), null);
  });

  it('keeps הבנתי / לא הבנתי on the curated hints, then asks the AI for another angle', () => {
    const id = 'G7-T03-B-Q06א';
    guides.register(id, { hints });
    guides.resetUnderstanding(id);
    guides.respond(id, { helpKind: 'hint', hintIndex: 0, progress: 0 });
    const understood = guides.planUnderstanding(id, 'understood', { progress: 1 });
    assert.equal(understood.action, 'local', 'הבנתי does not open the next curated hint');
    assert.equal(understood.text, guides.understoodText);
    const plan = guides.planUnderstanding(id, 'not-understood', { progress: 1 });
    assert.equal(plan.action, 'hint');
    assert.equal(plan.display, 'לא הבנתי');
    const softer = guides.respond(id, { helpKind: 'free_question', studentMessage: 'לא הבנתי', hintIndex: 0, progress: 1 });
    assert.match(softer.text, /^זה בסדר גמור, בואו ננסה אחרת\.\nרמז שני$/);
    guides.respond(id, { helpKind: 'hint', hintIndex: 2, progress: 2 });
    assert.equal(guides.planUnderstanding(id, 'not-understood', { progress: 3 }).action, 'ai');
  });

  it('gives the model the verified hints as its guard', () => {
    const id = 'G7-T03-B-Q07א';
    guides.register(id, { hints });
    const prompt = guides.prompt(id);
    hints.forEach((text) => assert.ok(prompt.includes(text)));
    assert.match(prompt, /אל תחשוף את התשובה הסופית/);
  });
});

describe('curated hint loading', () => {
  it('asks Supabase once per worksheet with the publishable key and registers its own parts', async () => {
    const calls: { url: string; init: any }[] = [];
    const rows = [
      { exercise_id: 'G8-T24-A-Q01א', hint_1: 'א1', hint_2: 'א2', hint_3: 'א3' },
      { exercise_id: 'G8-T24-A-Q09ב', hint_1: 'ב1', hint_2: 'ב2', hint_3: 'ב3' },
      { exercise_id: 'G8-T24-B-Q01א', hint_1: 'x', hint_2: 'x', hint_3: 'x' },
      { exercise_id: 'G8-T24-A-Q02א', hint_1: 'x', hint_2: '', hint_3: 'x' },
    ];
    const sheet = manifest('G8-T24', 'A', ['G8-T24-A-Q01א', 'G8-T24-A-Q02א']);
    const fetch = fakeFetch(rows, calls);
    const count = await curated.prefetch(sheet, { config, guides, fetch });
    assert.equal(count, 1);
    assert.equal(guides.get('G8-T24-A-Q01א').hints[2], 'א3');
    assert.equal(guides.get('G8-T24-A-Q09ב'), null, 'parts that are not on this PDF are ignored');
    assert.equal(guides.get('G8-T24-A-Q02א'), null, 'incomplete rows are ignored');
    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.origin + url.pathname, 'https://example123.supabase.co/rest/v1/noam_ramzi_hints');
    assert.equal(url.searchParams.get('select'), 'exercise_id,hint_1,hint_2,hint_3');
    assert.equal(url.searchParams.get('exercise_id'), 'like.G8-T24-A-Q*');
    assert.deepEqual(calls[0].init.headers, { apikey: 'sb_publishable_test', Accept: 'application/json' });
    assert.equal(calls[0].init.credentials, 'omit');
    await curated.prefetch(sheet, { config, guides, fetch });
    assert.equal(calls.length, 1, 'the worksheet is not fetched twice');
  });

  it('follows the exercise level of a single-level worksheet, never another prefix', async () => {
    const calls: { url: string; init: any }[] = [];
    const rows = [{ exercise_id: 'G8-T56-A-Q01א', hint_1: 'ג1', hint_2: 'ג2', hint_3: 'ג3' }];
    const single = manifest('G8-T56', 'B', ['G8-T56-A-Q01א']);
    assert.equal(await curated.prefetch(single, { config, guides, fetch: fakeFetch(rows, calls) }), 1);
    assert.equal(new URL(calls[0].url).searchParams.get('exercise_id'), 'like.G8-T56-A-Q*');
    const foreign = manifest('G8-T57', 'B', ['G8-T58-A-Q01א']);
    assert.equal(await curated.prefetch(foreign, { config, guides, fetch: fakeFetch(rows, calls) }), 0);
    assert.equal(new URL(calls[1].url).searchParams.get('exercise_id'), 'like.G8-T57-B-Q*');
  });

  it('leaves Ramzi unchanged when Supabase fails or the input is unsafe', async () => {
    const calls: { url: string; init: any }[] = [];
    const failing = fakeFetch([], calls, false);
    assert.equal(await curated.prefetch(manifest('G7-T30', 'E', ['G7-T30-E-Q01א']), { config, guides, fetch: failing }), 0);
    const rejecting = () => Promise.reject(new Error('offline'));
    assert.equal(await curated.prefetch(manifest('G7-T31', 'B', ['G7-T31-B-Q01א']), { config, guides, fetch: rejecting }), 0);
    assert.equal(await curated.prefetch(manifest('G7-T32&x=1', 'A', []), { config, guides, fetch: failing }), 0);
    assert.equal(await curated.prefetch(manifest('G7-T33', 'C', []), { config, guides, fetch: failing }), 0);
    const foreign = { url: 'https://attacker.example', key: 'k' };
    const before = calls.length;
    globalThis.NOAM_LEARNING_CONFIG = foreign;
    assert.equal(await curated.prefetch(manifest('G7-T34', 'A', ['G7-T34-A-Q01א']), { guides, fetch: failing }), 0);
    delete globalThis.NOAM_LEARNING_CONFIG;
    assert.equal(calls.length, before, 'no request leaves for a non-Supabase host');
  });
});

describe('viewer wiring', () => {
  it('loads the module before the viewer script and prefetches after the manifest loads', () => {
    assert.match(viewer, /noam-glossary\.js\?v=20261029-context6"><\/script>\n<script src="noam-curated-hints\.js\?v=20261030-curated1"><\/script>\n<script>\n/);
    assert.match(viewer, /noam-didactic-guides\.js\?v=20261030-understood1/);
    assert.match(
      viewer,
      /manifest = data;\n\s+manifestReady = true;[\s\S]{0,400}window\.NoamCuratedHints\.prefetch\(data\);/,
    );
    assert.match(viewer, /noam-learning-config\.js\?v=[^"]+" defer/);
  });

  it('keeps the guided hint path ahead of the AI request', () => {
    const ask = viewer.slice(viewer.indexOf('function askNoam('), viewer.indexOf('function noamRetryActionLabel('));
    assert.ok(ask.indexOf('noamDidacticResponse(') < ask.indexOf('API+"/noamImageSolve"'));
  });
});

describe('config timing', () => {
  it('waits for the deferred public config when the manifest arrives first', async () => {
    const listeners: Record<string, () => void> = {};
    const previousDocument = (globalThis as any).document;
    const previousAdd = (globalThis as any).addEventListener;
    (globalThis as any).document = {
      readyState: 'interactive',
      addEventListener: (type: string, fn: () => void) => { listeners['doc:' + type] = fn; },
    };
    (globalThis as any).addEventListener = (type: string, fn: () => void) => { listeners['win:' + type] = fn; };
    try {
      const calls: { url: string; init: any }[] = [];
      const rows = [{ exercise_id: 'G9-T45-A-Q01א', hint_1: 'ט1', hint_2: 'ט2', hint_3: 'ט3' }];
      const pending = curated.prefetch(manifest('G9-T45', 'A', ['G9-T45-A-Q01א']), { guides, fetch: fakeFetch(rows, calls) });
      assert.equal(calls.length, 0, 'no request before the config exists');
      (globalThis as any).NOAM_LEARNING_CONFIG = config;
      listeners['doc:DOMContentLoaded']();
      assert.equal(await pending, 1);
      assert.equal(calls.length, 1);
    } finally {
      delete (globalThis as any).NOAM_LEARNING_CONFIG;
      (globalThis as any).document = previousDocument;
      (globalThis as any).addEventListener = previousAdd;
    }
  });
});
