import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { companionPanelSize } from '../../../noam-ai/site-companion/panel-size.js';
import { retrieveRecords } from '../../../noam-ai/site-companion/retrieve.js';
import {
  FALLBACK_TEXT,
  QWEN_MODEL,
  SYSTEM_PROMPT,
  handleCompanionTurn,
  isWorksheetSolveRequest,
  qwenRequestBody,
} from '../../../noam-ai/site-companion/companion.js';

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
    assert.match(result.essentialNote, /אי אפשר לסמן/);
    assert.match(result.details, /עדיין לא ממומשים/);
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
