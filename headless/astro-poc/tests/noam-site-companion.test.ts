import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { companionPanelSize } from '../../../noam-ai/site-companion/panel-size.js';
import { retrieveGuide, retrieveRecords } from '../../../noam-ai/site-companion/retrieve.js';
import {
  FALLBACK_TEXT,
  ROLE_TEXT,
  MAX_PAGE_PATH_CHARS,
  MAX_PAGE_TITLE_CHARS,
  MAX_TEACHER_NOTE_CHARS,
  QWEN_MODEL,
  SOLVE_REQUEST_SOURCE,
  SYSTEM_PROMPT,
  groundModelPayload,
  handleCompanionTurn,
  isRoleQuestion,
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
import { runCompanionTurn } from '../../../noam-ai/site-companion/endpoint.js';
import { didacticSequence } from '../../../noam-ai/site-companion/topic-order.js';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { bareTopicTitle, catalogQuadrilateralTitles } from '../src/lib/gradeHubQuadrilaterals.ts';

const catalog = JSON.parse(
  readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')
);
const guide = JSON.parse(
  readFileSync(new URL('../src/data/site-guide.v1.json', import.meta.url), 'utf8')
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
    assert.ok(rows.some((row) => row.pdfId === 'dd5036296f084fb7ad7fc6c1bbb25088'));
    const blob = JSON.stringify(rows);
    assert.equal(blob.includes('משבצת'), false);
    assert.equal(blob.includes('mishbetzet'), false);
    for (const row of rows) {
      assert.match(row.href, /dd5036296f084fb7ad7fc6c1bbb25088|worksheet-viewer-noam\.html|static\.wixstatic\.com/);
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
    assert.match(result.text, /באיזו כיתה/);
  });
});

function catalogPdfIds(source) {
  const ids = [];
  for (const grade of source.grades || []) {
    for (const topic of grade.topics || []) {
      for (const level of topic.levels || []) {
        const pdfId = String(level.pdfId || '').toLowerCase();
        if (/^[0-9a-f]{32}$/.test(pdfId)) ids.push(pdfId);
      }
    }
  }
  return ids;
}

function factoringLevelA() {
  const grade = catalog.grades.find((item) => item.grade === 9);
  const topic = grade.topics.find((item) => item.id === 2 && item.title === 'פירוק לגורמים');
  return topic.levels.find((level) => level.key === 'a');
}

describe('Noam AI site manual', () => {
  it('covers repo pages and keeps worksheet ids on the catalog', () => {
    const catalogIds = catalogPdfIds(catalog).sort();
    const guideIds = guide.records
      .filter((row) => row.type === 'worksheet')
      .map((row) => String(row.pdfId).toLowerCase())
      .sort();
    assert.deepEqual(guideIds, catalogIds);
    assert.equal(guide.counts.worksheet, catalogIds.length);
    for (const id of [
      'dd5036296f084fb7ad7fc6c1bbb25088',
      '073d5168d4b448dea8e2e69eda37dc48',
      'b62b8ffe166e46a5ba3f8bea511bafb8',
    ]) {
      assert.ok(guideIds.includes(id), id);
    }
    assert.equal(guideIds.includes('6a37fe7160324a17ad107b3dbe43c1db'), false);
    assert.equal(guide.counts.topic, 128);
    const counting = guide.records.find((row) => row.id === 'topic-counting-grade-1');
    assert.equal(counting && counting.href, '/counting-grade-1');
    assert.equal(counting && counting.topic, 'מונים בלי לפספס');
    const kite = guide.records.find((row) => row.id === 'topic-kite-grade-9');
    assert.equal(kite && kite.href, '/kite-grade-9');
    assert.equal(kite && kite.topic, 'דלתון');
    assert.equal(guide.counts.hub, 9);
    assert.equal(guide.counts.blog, 68);
    assert.equal(guide.counts.game, 1);
    assert.ok(guide.counts.page >= 10);
    assert.equal(typeof guide.manifestMatches, 'number');
    const level = factoringLevelA();
    const sheet = guide.records.find((row) => row.id === 'g9-t2-a');
    assert.ok(sheet);
    assert.equal(sheet.pdfId, level.pdfId);
    assert.equal(sheet.levelLabel, 'רמה א׳');
    assert.match(sheet.href, new RegExp(level.pdfId));
    assert.match(sheet.how, /הורדה \/ הדפסה/);
    assert.equal(sheet.contains.includes('alg'), false);
    const manifestUrl = new URL('../public/noam-ai/manifests/' + level.pdfId + '.json', import.meta.url);
    assert.equal(existsSync(manifestUrl), true);
    const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
    assert.equal(String(manifest.pdfHash).toLowerCase(), String(level.pdfId).toLowerCase());
    assert.match(sheet.contains, new RegExp(manifest.questionCount + ' שאלות'));
    assert.match(sheet.contains, new RegExp(manifest.exerciseCount + ' תרגילים'));
    assert.match(sheet.contains, new RegExp(manifest.pageCount + ' עמודים'));
    const topic = guide.records.find((row) => row.href === '/factoring-grade-9');
    assert.match(topic.contains, /בדקו את עצמכם/);
    assert.match(topic.how, /רמה א׳ מתאימה לביסוס/);
    assert.equal(topic.contains.includes('(x−3)(x+3)'), false);
    const teachers = guide.records.find((row) => row.href === '/teachers');
    assert.match(teachers.how, /כיתה, נושא ומטרת השיעור/);
    assert.match(teachers.audience, /מרחב למורה/);
    assert.ok(guide.records.some((row) => row.type === 'game' && row.href === '/games/kefel-mekutsar-2'));
  });

  it('fails when the committed guide differs from a fresh build', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const result = spawnSync('npx', ['tsx', 'scripts/build-site-guide.ts', '--check'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000,
    });
    assert.equal(result.status, 0, (result.stderr || '') + (result.stdout || ''));
  });

  it('retrieves a real factoring page and does not call the model when nothing matches', async () => {
    const pdfId = factoringLevelA().pdfId;
    const rows = retrieveGuide(guide, 'כיתה ט׳ פירוק לגורמים', 6);
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.grade === 9));
    assert.ok(rows.some((row) => row.href.includes(pdfId) || row.href === '/factoring-grade-9'));
    let called = 0;
    const result = await handleCompanionTurn(
      { message: 'xxxxqqqq yyyywwww', page: { kind: 'home', path: '/', title: 'בית' } },
      { guide, catalog, apiKey: 'test', fetch: async () => { called += 1; throw new Error('should not call'); } }
    );
    assert.equal(called, 0);
    assert.equal(result.source, 'catalog-gap');
    assert.equal(result.links.length, 0);
    assert.match(result.text, /באיזו כיתה/);
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
    assert.equal(result.chips.length, 1);
    assert.equal(result.chips[0].id, records[3].id);
    assert.equal(result.chips.some((chip) => chip.label === result.primary.label), false);
    assert.equal(result.links.length, 2);
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

  it('answers what Noam AI does without calling the model', async () => {
    assert.equal(isRoleQuestion('במה אתה עוזר לי באתר?'), true);
    assert.equal(isRoleQuestion('הי במה אתה יכול לעזור לי?'), true);
    assert.equal(isRoleQuestion('שלום'), true);
    assert.equal(isRoleQuestion('הי'), true);
    assert.equal(isRoleQuestion('במה אתה יכול לעזור'), true);
    assert.equal(isRoleQuestion('מה אתה עושה'), true);
    assert.equal(isRoleQuestion('הי יש דף שברים לכיתה ג'), false);
    assert.equal(isRoleQuestion('איך פותרים את שאלה 4?'), false);
    assert.equal(isRoleQuestion('פירוק לגורמים לכיתה ט'), false);
    let called = 0;
    const result = await handleCompanionTurn(
      { message: 'במה אתה עוזר לי באתר?', page: { kind: 'home', path: '/', title: 'בית' } },
      { catalog, apiKey: 'server-side', fetch: async () => { called += 1; throw new Error('should not call'); } }
    );
    assert.equal(called, 0);
    assert.equal(result.ok, true);
    assert.equal(result.source, 'role');
    assert.equal(result.answer, ROLE_TEXT);
    assert.match(result.answer, /דפי עבודה/);
    assert.match(result.answer, /תרגילים שכבר כתובים/);
    assert.equal(result.links.length, 0);
    assert.equal(result.chips.length, 0);
    assert.equal(result.model, null);
    const teacher = await runCompanionTurn(
      { message: 'במה אתה עוזר לי באתר?', page: { kind: 'teachers', path: '/teachers', title: 'מורים' } },
      { catalog, apiKey: 'server-side', fetch: async () => { called += 1; throw new Error('should not call'); } }
    );
    assert.equal(called, 0);
    assert.equal(teacher.answer, ROLE_TEXT);
    assert.equal(teacher.source, 'role');
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
    assert.ok(client.includes('#noam-site-companion-form{width:100%;gap:4px;box-sizing:border-box;padding-inline-end:46px}'));
    assert.ok(client.includes('#noam-site-companion-panel.is-compact.is-xtight #noam-site-companion-form{padding-inline-end:0}'));
    assert.ok(client.includes('#noam-site-companion-panel.is-compact.is-tight.has-answer #noam-site-companion-form{padding-inline-end:0}'));
    assert.ok(client.includes('#noam-site-companion-answer{font-size:16px;-webkit-line-clamp:1;min-height:0;box-sizing:border-box;padding-inline-end:46px}'));
    assert.ok(client.includes('var SITE_FONT = "Heebo,\'Arial Hebrew\',Arial,sans-serif"'));
    assert.ok(client.includes('font-family:" + SITE_FONT + "'));
    assert.ok(client.includes('#noam-site-companion-answer,#noam-site-companion-details,#noam-site-companion-chips{font-family:" + SITE_FONT + "}"'));
    assert.ok(client.includes('#noam-site-companion,#noam-site-companion *,#noam-site-companion-panel,#noam-site-companion-panel *{font-family:" + SITE_FONT + " !important}"'));
    assert.ok(client.includes('noam-bot-client.js?v=20260921-diagnostics1'));
    assert.ok(client.includes('setProperty("font-family", SITE_FONT, "important")'));
    assert.ok(client.includes('אחר'));
    assert.ok(client.includes('noam-teacher-option'));
    assert.ok(client.includes('document.querySelector("dialog[open]")'));
    assert.equal(client.includes('input.focus();\n          engage("typing")'), false);
    assert.equal(client.includes('סימון וחיתוך של דף המקור עדיין לא ממומשים'), false);
    assert.ok(client.includes('function thinkingLabel(seconds)'));
    assert.ok(client.includes('return "חושב…";'));
    assert.ok(client.includes('return "חושב… 1 שנייה";'));
    assert.ok(client.includes('return "חושב… " + seconds + " שניות";'));
    assert.ok(client.includes('aria-live="polite"'));
    assert.ok(client.includes('#noam-site-companion-thinking .noam-think-dots i{animation:none;opacity:1}'));
    assert.ok(client.includes('button.disabled = true'));
    assert.ok(client.includes('clearInterval(thinkTimer)'));
    assert.ok(client.includes('showThinking();'));
    const thinkAt = client.indexOf('showThinking();');
    assert.ok(solveAt > 0 && thinkAt > solveAt);
  });

  it('clears the composer after send and keeps the phone sheet off the lesson card', () => {
    const client = readFileSync(new URL('../public/noam-site-companion.js', import.meta.url), 'utf8');
    const submitAt = client.indexOf('form.addEventListener("submit"');
    const submit = client.slice(submitAt);
    const clearAt = submit.indexOf('input.value = ""');
    const focusAt = submit.indexOf('input.focus()');
    const solveAt = submit.indexOf('isLocalSolve(message)');
    const postAt = submit.indexOf('client.postJson(API');
    assert.ok(clearAt > 0 && focusAt > clearAt);
    assert.ok(clearAt < solveAt && focusAt < postAt);
    assert.equal(client.includes('bottom:calc(40dvh + 8px)'), false);
    assert.ok(client.includes('closer.textContent = window.innerWidth < 768 ? "סגירה" : "×"'));
    assert.ok(client.includes('revealLessonCard'));
    assert.ok(client.includes('.exact-topic-demo, .concept-loop__card, .ka-film'));
    assert.ok(client.includes('html.noam-ai-engaged #noam-accessibility{top:auto!important;bottom:8px!important'));
    assert.ok(client.includes('seen["label:" + label]'));
    const a11y = readFileSync(new URL('../public/noam-accessibility.js', import.meta.url), 'utf8');
    assert.match(a11y, /\.exact-topic-demo,\.concept-loop__card,\.ka-film/);
    assert.match(a11y, /function parkOffLessonCard/);
  });
});

describe('Noam AI page context and topic order', () => {
  function parentTopics(gradeNumber: number, groupKey: string) {
    const grade = catalog.grades.find((item) => item.grade === gradeNumber);
    return (grade?.topics || [])
      .filter((topic) => topic.group === groupKey && topic.parent == null)
      .map((topic) => topic.title);
  }

  it('reads each grade topic order from the catalog, with kite before the trapezoid', () => {
    const sequence = didacticSequence(catalog);
    for (const gradeNumber of [8, 9]) {
      const grade = catalog.grades.find((item) => item.grade === gradeNumber);
      for (const group of grade?.groups || []) {
        const fromCatalog = parentTopics(gradeNumber, group.key);
        const fromOrder = sequence
          .filter((row) => row.grade === gradeNumber && row.groupKey === group.key)
          .map((row) => row.title);
        assert.deepEqual(fromOrder, fromCatalog);
      }
    }
    const geo = parentTopics(9, 'geo');
    const kite = geo.indexOf('דלתון');
    const square = geo.indexOf('הריבוע');
    const trapezoid = geo.indexOf('הטרפז');
    assert.ok(kite >= 0 && kite < geo.indexOf('המקבילית'));
    assert.ok(square >= 0 && trapezoid > square);
    const kitePage = guide.records.find((row) => row.id === 'topic-kite-grade-9');
    assert.equal(kitePage && kitePage.href, '/kite-grade-9');
    assert.equal(kitePage && kitePage.grade, 9);
    assert.equal(kitePage && kitePage.topic, 'דלתון');
  });

  it('offers grade 9 quadrilaterals in site order, once each, from the kite page', async () => {
    let called = 0;
    const result = await handleCompanionTurn(
      {
        message: 'יש מרובעים?',
        page: { kind: 'topic', path: '/kite-grade-9', title: 'דלתון לכיתה ט׳ | דפי עבודה במתמטיקה – נועם דורון' },
      },
      { catalog, guide, apiKey: 'server-side', fetch: async () => { called += 1; throw new Error('should not call'); } }
    );
    assert.equal(called, 0);
    assert.equal(result.source, 'topic-order');
    assert.match(result.answer, /כיתה ט׳/);
    assert.equal(result.answer.includes('כיתה ג'), false);
    assert.equal(/[A-Za-z]/.test(result.answer), false);
    assert.ok(result.answer.indexOf('דלתון') < result.answer.indexOf('המקבילית'));
    assert.ok(result.answer.indexOf('הריבוע') < result.answer.indexOf('הטרפז'));
    assert.match(result.answer, /הנושא הבא הוא המקבילית/);
    assert.match(result.answer, /הנושא הקודם הוא משולש שווה שוקיים/);
    const titles = result.chips.map((chip) => chip.label);
    assert.deepEqual(titles, [
      'כיתה ט׳ · דלתון',
      'כיתה ט׳ · המקבילית',
      'כיתה ט׳ · המלבן',
      'כיתה ט׳ · המעוין',
      'כיתה ט׳ · הריבוע',
      'כיתה ט׳ · הטרפז',
    ]);
    assert.equal(new Set(titles).size, titles.length);
    assert.equal(result.chips.find((chip) => chip.label.endsWith('דלתון'))?.href, '/kite-grade-9');
    const quadrilaterals = parentTopics(9, 'geo').filter((title) => !title.includes('משולש'));
    assert.deepEqual(result.chips.map((chip) => chip.label.split(' · ')[1]), quadrilaterals);
    assert.deepEqual(quadrilaterals, catalogQuadrilateralTitles(catalog, 9));
    const section = loadGradeHub(9).topicSections.find((item) => item.heading === 'מרובעים ומשולשים');
    const pageQuads = (section?.links || [])
      .map((link) => link.label)
      .filter((label) => quadrilaterals.some((title) => bareTopicTitle(title) === bareTopicTitle(label)));
    assert.deepEqual(pageQuads.map(bareTopicTitle), quadrilaterals.map(bareTopicTitle));
  });

  it('names the next catalog topic after the open page', async () => {
    const result = await handleCompanionTurn(
      { message: 'מה הנושא הבא?', page: { kind: 'topic', path: '/kite-grade-9', title: 'דלתון לכיתה ט׳' } },
      { catalog, guide, apiKey: 'server-side', fetch: async () => { throw new Error('should not call'); } }
    );
    assert.equal(result.source, 'topic-order');
    assert.match(result.answer, /המקבילית/);
    assert.equal(result.chips[0].href, '/parallelogram-grade-9');
    assert.equal(result.chips.length, 1);
  });

  it('does not repeat a suggestion button for two levels of the same sheet', async () => {
    const records = retrieveRecords(catalog, 'כיתה ג׳ מרובעים לפי תכונות', 4);
    const same = records.filter((row) => row.title === 'מרובעים לפי תכונות');
    assert.ok(same.length >= 2);
    const result = groundModelPayload(
      {
        answer: 'דפי המרובעים בכיתה ג׳',
        primaryRecordId: same[0].id,
        chipRecordIds: same.slice(1).map((row) => row.id),
      },
      records,
      { page: { kind: 'topic', path: '/kite-grade-9', title: 'דלתון' } }
    );
    const labels = [result.primary.label, ...result.chips.map((chip) => chip.label)];
    assert.equal(new Set(labels).size, labels.length);
    assert.equal(result.chips.some((chip) => chip.label === result.primary.label), false);
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

  it('logs siteverify error-codes, score, hostname, and action without the secret or token', async () => {
    const lines: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      lines.push(args.map((item) => String(item)).join(' '));
    };
    try {
      const failed = await guardCompanionRequest(
        {
          origin: 'https://www.noamdoronmath.co.il',
          clientIp: '203.0.113.40',
          message: 'פירוק לגורמים',
          botVerification: { provider: 'recaptcha-v3', token: 'do-not-log-token' },
          now: 9_000,
        },
        {
          store: new Map(),
          secret: 'do-not-log-secret',
          fetch: async () => ({
            ok: true,
            json: async () => ({
              success: false,
              score: 0.2,
              action: 'noam_site_companion',
              hostname: 'www.noamdoronmath.co.il',
              'error-codes': ['invalid-input-response'],
            }),
          }),
        }
      );
      assert.equal(failed.code, 'BOT_VERIFICATION_FAILED');
    } finally {
      console.warn = original;
    }
    const line = lines.find((item) => item.includes('NOAM_BOT_VERIFICATION_FAILED')) || '';
    assert.match(line, /invalid-input-response/);
    assert.match(line, /"score":0\.2/);
    assert.match(line, /www\.noamdoronmath\.co\.il/);
    assert.match(line, /noam_site_companion/);
    assert.equal(line.includes('do-not-log-secret'), false);
    assert.equal(line.includes('do-not-log-token'), false);
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
    assert.match(catalogJs, /dd5036296f084fb7ad7fc6c1bbb25088/);
    assert.equal(catalogJs.includes('export const catalog = []') || catalogJs.includes('export const catalog =[];'), false);
  });
});
