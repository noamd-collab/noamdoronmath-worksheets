import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { companionPanelSize } from '../../../noam-ai/site-companion/panel-size.js';
import { retrieveRecords } from '../../../noam-ai/site-companion/retrieve.js';
import {
  FALLBACK_TEXT,
  MAX_PAGE_PATH_CHARS,
  MAX_PAGE_TITLE_CHARS,
  MAX_TEACHER_NOTE_CHARS,
  QWEN_MODEL,
  SOLVE_REQUEST_SOURCE,
  SYSTEM_PROMPT,
  handleCompanionTurn,
  isWorksheetSolveRequest,
  qwenRequestBody,
} from '../../../noam-ai/site-companion/companion.js';
import {
  SITE_ORIGINS,
  clientKey,
  corsHeadersFor,
  guardCompanionRequest,
  isAllowedOrigin,
  pruneRateStore,
} from '../../../noam-ai/site-companion/bot-guard.js';
import { starterLinksFor } from '../../../noam-ai/site-companion/starters.js';

const require = createRequire(import.meta.url);
const { create: createBotClient } = require('../public/noam-bot-client.js') as { create: (options: Record<string, unknown>) => { postJson: (endpoint: string, payload: unknown) => Promise<unknown> } };
const CALM_MESSAGE = 'נועם AI עוד לא פעיל. אפשר להמשיך לבחור ולהדפיס.';

const catalog = JSON.parse(
  readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')
);

describe('Noam AI panel size', () => {
  it('uses a 360×225 right-anchored box on 1440×900, exactly 1/16', () => {
    const box = companionPanelSize(1440, 900);
    assert.equal(box.width, 360);
    assert.equal(box.height, 225);
    assert.equal(box.area, 81000);
    assert.equal(box.area, (1440 * 900) / 16);
    assert.equal(box.anchor, 'right');
  });

  it('keeps 390×844 and 360×800 inside 1/16 with a readable width', () => {
    const phone = companionPanelSize(390, 844);
    const narrow = companionPanelSize(360, 800);
    assert.equal(phone.width, 168);
    assert.equal(phone.height, 122);
    assert.ok(phone.area <= (390 * 844) / 16);
    assert.equal(narrow.width, 168);
    assert.equal(narrow.height, 107);
    assert.ok(narrow.area <= (360 * 800) / 16);
  });
});

describe('Noam AI catalog grounding', () => {
  it('returns real factoring worksheets and no Mishbetzet sheet', () => {
    const rows = retrieveRecords(catalog, 'כיתה ט׳ פירוק לגורמים', 6);
    assert.ok(rows.length > 0);
    assert.ok(rows.some((row) => row.pdfId === '6a37fe7160324a17ad107b3dbe43c1db'));
    const blob = JSON.stringify(rows);
    assert.equal(blob.includes('משבצת'), false);
    assert.equal(blob.includes('mishbetzet'), false);
    for (const row of rows) {
      assert.match(row.href, /6a37fe7160324a17ad107b3dbe43c1db|worksheet-viewer-noam\.html|static\.wixstatic\.com/);
    }
  });

  it('says the catalog has no match instead of inventing a sheet', async () => {
    const result = await handleCompanionTurn(
      { message: 'xxxxqqqq yyyywwww', page: { kind: 'home', path: '/', title: 'בית' }, teacher: null },
      { catalog, apiKey: 'test', fetch: async () => { throw new Error('should not call'); } }
    );
    assert.equal(result.source, 'catalog-gap');
    assert.equal(result.links.length, 0);
    assert.match(result.text, /לא מצאתי/);
  });
});

describe('Noam AI model role', () => {
  it('sends qwen3.8-flash a companion prompt that is not Ramzi hints', () => {
    const records = retrieveRecords(catalog, 'פירוק לגורמים', 2);
    const body = qwenRequestBody(
      { message: 'איפה הדף?', page: { kind: 'teachers', path: '/teachers', title: 'מורים' }, teacher: { gradeLabel: 'כיתה ט׳', topicLabel: 'פירוק לגורמים' } },
      records
    );
    assert.equal(body.model, QWEN_MODEL);
    assert.equal(body.enable_thinking, false);
    assert.equal(body.stream, false);
    assert.equal(body.messages[0].content, SYSTEM_PROMPT);
    assert.match(SYSTEM_PROMPT, /אתה לא רמזי/);
    assert.match(SYSTEM_PROMPT, /אסור לך לתת רמז/);
    const huge = 'א'.repeat(5000);
    const capped = qwenRequestBody(
      {
        message: 'איפה הדף?',
        page: { kind: 'teachers', path: huge, title: huge },
        teacher: { note: huge, topicLabel: 'פירוק לגורמים' },
      },
      records
    );
    const prompt = capped.messages[1].content;
    assert.equal(prompt.includes(huge), false);
    const titleLine = prompt.split('\n')[0];
    const parts = titleLine.split(' ');
    assert.equal(parts[parts.length - 1].length, MAX_PAGE_TITLE_CHARS);
    assert.equal(parts[parts.length - 2].length, MAX_PAGE_PATH_CHARS);
    assert.ok(prompt.includes('א'.repeat(MAX_TEACHER_NOTE_CHARS)));
    assert.equal(prompt.includes('א'.repeat(MAX_TEACHER_NOTE_CHARS + 1)), false);
  });

  it('keeps only catalog links from the model and leaves essentials unmarked', async () => {
    const records = retrieveRecords(catalog, 'כיתה ט׳ פירוק לגורמים', 4);
    const allowed = records[0];
    let called = 0;
    const result = await handleCompanionTurn(
      {
        message: 'צריך דף לפירוק לגורמים',
        page: { kind: 'teachers', path: '/demo', title: 'מורים' },
        teacher: { gradeLabel: 'כיתה ט׳', topicLabel: 'פירוק לגורמים', goalLabel: 'מפגש ראשון' },
      },
      {
        catalog,
        apiKey: 'server-side',
        fetch: async (url, init) => {
          called += 1;
          assert.match(String(url), /qwen3\.8-flash|compatible-mode/);
          const sent = JSON.parse(String(init.body));
          assert.equal(sent.model, 'qwen3.8-flash');
          assert.equal(String(init.headers.Authorization).startsWith('Bearer '), true);
          return {
            ok: true,
            json: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify({
                    answer: 'לחצו על הקישור. המצאה https://evil.example/sheet',
                    details: 'שאלות 1א 9ב לא קיימות בקטלוג',
                    primaryRecordId: allowed.id,
                    chipRecordIds: [records[1].id, records[2].id, 'invented-sheet', records[3].id],
                  }),
                },
              }],
            }),
          };
        },
      }
    );
    assert.equal(called, 1);
    assert.equal(result.source, 'model');
    assert.equal(result.model, 'qwen3.8-flash');
    assert.equal(result.primary.href, allowed.href);
    assert.equal(result.chips.length, 2);
    assert.equal(result.links.length, 3);
    assert.equal(result.essential.length, 0);
    assert.match(result.essentialNote, /לא ממציא שאלות/);
    assert.match(result.details, /לסמן את השאלות שנבחרו/);
    assert.match(result.details, /דף מצומצם שנחתך מאותו מקור/);
    assert.equal(result.answer.includes('evil.example'), false);
  });

  it('points a worksheet solve request to Ramzi and does not call the model', async () => {
    assert.equal(isWorksheetSolveRequest('worksheet', 'תן לי רמז'), true);
    assert.equal(isWorksheetSolveRequest('home', 'תן לי רמז'), false);
    let called = 0;
    const result = await handleCompanionTurn(
      { message: 'איך פותרים את שאלה 4?', page: { kind: 'worksheet', path: '/worksheet-viewer-noam.html', title: 'דף' } },
      { catalog, apiKey: 'server-side', fetch: async () => { called += 1; return { ok: false }; } }
    );
    assert.equal(called, 0);
    assert.equal(result.source, 'ramzi-redirect');
    assert.match(result.answer, /רמזי/);
    assert.equal(result.primary.action, 'ramzi');
    assert.equal(result.chips.length, 0);
    assert.equal(result.links.length, 0);
    assert.equal(isWorksheetSolveRequest('worksheet', 'יש דף פתרונות לכיתה ה?'), false);
    assert.equal(isWorksheetSolveRequest('worksheet', 'איך פותרים את שאלה 3?'), true);
  });

  it('returns the safe fallback when the model call fails', async () => {
    const result = await handleCompanionTurn(
      { message: 'פירוק לגורמים', page: { kind: 'topic', path: '/factoring-grade-9', title: 'פירוק' } },
      { catalog, apiKey: 'server-side', fetch: async () => { throw new Error('down'); } }
    );
    assert.equal(result.ok, false);
    assert.equal(result.source, 'fallback');
    assert.equal(result.answer, FALLBACK_TEXT);
    assert.equal(result.primary, null);
    assert.equal(result.chips.length, 0);
    assert.equal(result.links.length, 0);
  });
});

describe('Noam AI starters and client guard', () => {
  it('does not offer the current page, and home does not offer בית', () => {
    const home = starterLinksFor('home', '/', (path) => path);
    assert.equal(home.some((item) => item.label === 'בית' || item.href === '/'), false);
    assert.ok(home.some((item) => item.href === '/worksheets'));
    const topic = starterLinksFor('topic', '/factoring-grade-9', (path) => path);
    assert.equal(topic.some((item) => item.href === '/factoring-grade-9'), false);
    assert.ok(topic.some((item) => item.href === '/grade-9' && item.label === 'כיתה ט׳'));
  });

  it('checks a solve request in the browser before the network call', () => {
    const client = readFileSync(new URL('../public/noam-site-companion.js', import.meta.url), 'utf8');
    assert.ok(client.includes(SOLVE_REQUEST_SOURCE));
    assert.ok(client.includes('isLocalSolve(message)'));
    const solveAt = client.indexOf('isLocalSolve(message)');
    const postAt = client.indexOf('client.postJson(API');
    assert.ok(solveAt > 0 && postAt > solveAt);
    assert.equal(client.includes('found.length < 3'), false);
    assert.ok(client.includes('panel.parentNode === parent'));
    assert.ok(client.includes('panelFocused()'));
    assert.ok(client.includes('noam_site_companion') === false);
    assert.ok(client.includes('if (!modeOn && toggle) toggle.click()'));
    assert.ok(client.includes('exactHelpTab'));
    assert.ok(client.includes('getBoundingClientRect()'));
    assert.equal(client.includes('font-size:14px'), false);
    assert.equal(client.includes('Heebo,Arial,sans-serif'), false);
    assert.equal(client.includes('font-family:inherit'), false);
    assert.ok(client.includes('var SITE_FONT = "Heebo,\'Arial Hebrew\',Arial,sans-serif"'));
    assert.ok(client.includes('font-family:" + SITE_FONT + "'));
    assert.ok(client.includes('#noam-site-companion-answer,#noam-site-companion-details,#noam-site-companion-chips{font-family:" + SITE_FONT + "}"'));
    assert.ok(client.includes('#noam-site-companion,#noam-site-companion *,#noam-site-companion-panel,#noam-site-companion-panel *{font-family:" + SITE_FONT + "!important}"'));
    assert.ok(client.includes('setProperty("font-family", SITE_FONT, "important")'));
    assert.ok(client.includes('var API_BASE = "/api"'));
    assert.equal(client.includes('my-site-2'), false);
    assert.ok(client.includes('client.postJson(API'));
    assert.ok(client.includes('var TEACHER_QUIET = "נועם AI עוד לא פעיל. אפשר להמשיך לבחור ולהדפיס."'));
    assert.ok(client.includes('NOAM_PANEL_FAILED'));
    assert.ok(client.includes('var text = TEACHER_QUIET;'));
    assert.equal(client.includes('teacher ? TEACHER_QUIET'), false);
    assert.equal(client.includes('לא הצלחנו להשלים את בדיקת האבטחה'), false);
    assert.ok(client.includes('#noam-site-companion-form{width:100%;gap:4px;box-sizing:border-box;padding-inline-end:46px}'));
    assert.ok(client.includes('#noam-site-companion-panel.is-compact.is-xtight #noam-site-companion-form{padding-inline-end:0}'));
    assert.ok(client.includes('#noam-site-companion-panel.is-compact.is-tight.has-answer #noam-site-companion-form{padding-inline-end:0}'));
    assert.ok(client.includes('#noam-site-companion-answer{font-size:16px;-webkit-line-clamp:1;min-height:0;box-sizing:border-box;padding-inline-end:46px}'));
    assert.ok(client.includes('אחר'));
    assert.ok(client.includes('noam-teacher-option'));
    assert.ok(client.includes('document.querySelector("dialog[open]")'));
    assert.equal(client.includes('input.focus();\n          engage("typing")'), false);
    assert.equal(client.includes('סימון וחיתוך של דף המקור עדיין לא ממומשים'), false);
  });
});

describe('Noam AI bot guard', () => {
  it('rejects a wildcard and any origin outside the site allowlist', () => {
    assert.equal(corsHeadersFor('https://www.noamdoronmath.co.il')?.['Access-Control-Allow-Origin'], 'https://www.noamdoronmath.co.il');
    assert.equal(corsHeadersFor('*'), null);
    assert.equal(corsHeadersFor('https://evil.example'), null);
    assert.equal(isAllowedOrigin('https://preview.wix-site-host.com'), false);
    assert.ok(SITE_ORIGINS.includes('https://www.noamdoronmath.co.il'));
  });

  it('caps the message, rate-limits, and requires a passing reCAPTCHA token', async () => {
    const store = new Map();
    const okFetch = async () => ({ ok: true, json: async () => ({ success: true, score: 0.9, action: 'noam_site_companion', hostname: 'www.noamdoronmath.co.il' }) });
    const base = {
      origin: 'https://www.noamdoronmath.co.il',
      clientIp: '203.0.113.8',
      message: 'פירוק לגורמים',
      botVerification: { provider: 'recaptcha-v3', token: 'token' },
      now: 1_000,
    };
    const passed = await guardCompanionRequest(base, { store, secret: 'secret', fetch: okFetch });
    assert.equal(passed.ok, true);
    const foreign = await guardCompanionRequest({ ...base, origin: 'https://evil.example' }, { store, secret: 'secret', fetch: okFetch });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.code, 'ORIGIN_NOT_ALLOWED');
    const long = await guardCompanionRequest({ ...base, message: 'א'.repeat(701), clientIp: '203.0.113.9' }, { store, secret: 'secret', fetch: okFetch });
    assert.equal(long.status, 400);
    const low = await guardCompanionRequest(
      { ...base, clientIp: '203.0.113.10' },
      { store, secret: 'secret', fetch: async () => ({ ok: true, json: async () => ({ success: true, score: 0.1, action: 'noam_site_companion' }) }) }
    );
    assert.equal(low.status, 403);
    assert.equal(low.code, 'BOT_VERIFICATION_FAILED');
    for (let i = 0; i < 12; i += 1) {
      const slot = await guardCompanionRequest({ ...base, now: 2_000, clientIp: '203.0.113.11' }, { store, secret: 'secret', fetch: okFetch });
      assert.equal(slot.ok, true);
    }
    const blocked = await guardCompanionRequest(
      { ...base, now: 2_000, clientIp: '203.0.113.11', forwardedFor: '198.51.100.77' },
      { store, secret: 'secret', fetch: okFetch }
    );
    assert.equal(blocked.status, 429);
    const otherIp = await guardCompanionRequest({ ...base, now: 2_000, clientIp: '203.0.113.12' }, { store, secret: 'secret', fetch: okFetch });
    assert.equal(otherIp.ok, true);
    assert.equal(clientKey('203.0.113.11, 198.51.100.9'), 'untrusted');
    const stale = new Map<string, number[]>([['gone', [1]], ['kept', [3_000]]]);
    pruneRateStore(stale, 2_000 + 60_000);
    assert.equal(stale.has('gone'), false);
    assert.equal(stale.has('kept'), true);
  });

  it('ships a paste-ready Wix folder with backend imports and the real catalog', () => {
    const dir = new URL('../../../noam-ai/site-companion/DEPLOY_WIX/backend/', import.meta.url);
    const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');
    const handler = read('noam-site-companion.js');
    const core = read('noam-site-companion-core.js');
    const paste = read('PASTE-AT-END-OF-http-functions.js');
    const catalogJs = read('noam-site-catalog.js');
    assert.match(handler, /from 'wix-fetch'/);
    assert.match(handler, /from 'backend\/noam-site-companion-core'/);
    assert.match(handler, /request\.ip/);
    assert.equal(handler.includes('X-Forwarded-For'), false);
    assert.match(core, /from 'backend\/noam-site-companion-retrieve'/);
    assert.equal(core.includes('./retrieve'), false);
    assert.match(paste, /from 'backend\/noam-site-companion'/);
    assert.match(paste, /export function post_noamSiteCompanion/);
    assert.match(catalogJs, /export const catalog =/);
    assert.match(catalogJs, /6a37fe7160324a17ad107b3dbe43c1db/);
    assert.equal(catalogJs.includes('export const catalog = []') || catalogJs.includes('export const catalog =[];'), false);
  });
});

describe('Noam AI calm failure text', () => {
  async function failure(fetchImpl: (url: string) => Promise<unknown>, extra: Record<string, unknown> = {}) {
    const client = createBotClient({
      api: '/api',
      enabled: extra.enabled === true,
      networkRetryDelayMs: 0,
      modelTimeoutMs: 30,
      fetch: fetchImpl,
      window: {},
    });
    try {
      await client.postJson('/api/noamSiteCompanion', { message: 'שלום' });
    } catch (error) {
      return error as { message: string; code?: string; status?: number };
    }
    assert.fail('expected a failure');
  }

  it('shows one calm sentence for recaptcha, 403, timeout, network, and 5xx', async () => {
    const bot = readFileSync(new URL('../public/noam-bot-client.js', import.meta.url), 'utf8');
    assert.equal(bot.includes('לא הצלחנו להשלים את בדיקת האבטחה'), false);
    assert.equal(bot.includes('לא זמין כרגע'), false);
    assert.equal(bot.includes('התשובה מתעכבת'), false);
    assert.equal(bot.includes('החיבור לנועם AI נקטע'), false);
    assert.ok(bot.includes(`var VERIFY_MESSAGE = "${CALM_MESSAGE}"`));
    const denied = await failure(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'לא הצלחנו להשלים את בדיקת האבטחה. נסו שוב בעוד רגע.', code: 'BOT_VERIFICATION_FAILED' }),
    }));
    assert.equal(denied.message, CALM_MESSAGE);
    assert.equal(denied.status, 403);
    const server = await failure(async () => ({ ok: false, status: 500, json: async () => ({ error: 'internal' }) }));
    assert.equal(server.message, CALM_MESSAGE);
    const down = await failure(async () => { throw new TypeError('Failed to fetch'); });
    assert.equal(down.message, CALM_MESSAGE);
    assert.equal(down.code, 'NETWORK_UNAVAILABLE');
    const slow = await failure(() => new Promise(() => {}));
    assert.equal(slow.message, CALM_MESSAGE);
    assert.equal(slow.code, 'REQUEST_TIMEOUT');
    const inactive = await failure(async (url) => {
      if (String(url).includes('noamBotConfig')) return { ok: true, status: 200, json: async () => ({ active: false, error: 'secret missing' }) };
      return { ok: false, status: 500, json: async () => ({}) };
    }, { enabled: true });
    assert.equal(inactive.message, CALM_MESSAGE);
    assert.equal(inactive.code, 'NOT_ACTIVE');
  });
});
