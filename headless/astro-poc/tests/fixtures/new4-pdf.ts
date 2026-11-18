import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Noam, 18 Nov 2026: four reviewed packages open new PDF-only base topics, each with
 * its own landing: G8-TRF-01 (8/68), G9-PLN-01 (9/50), G9-COI-01 (9/51) and
 * G9-LIT-01 (9/52). Bound to the independently reviewed PDFs by their media ids.
 * Topics 50 and 51 sit in one new regular grade-9 group, 'geopar' (parallel lines and
 * angles), so they are not listed among the quadrilaterals. No track group, Noam
 * prefix or edition is added.
 */
export const reviewedNew4 = {
  receipt: 'docs/new-topics-four-pdf-first-20261118.json',
  topics: [
    {
      "grade": 8,
      "topicId": 68,
      "slug": "isometric-transformations-grade-8",
      "sheetId": "G8-TRF-01",
      "title": "טרנספורמציות איזומטריות וצורות חופפות",
      "group": "geo",
      "pdfIds": [
        "afaa5abcd06844629f6916203a910dce",
        "3910adaab83f48698e496177a24a3416",
        "4f585164428346d8972abf102c1f61a7"
      ],
      "topicSha256": "c0a2a32cb4079a10499d33fcceb8d1eaf82ececdf9e75c354386f7ecd61e61b4",
      "neighbours": [
        62,
        63
      ],
      "searchTerms": "טרנספורמציה טרנספורמציות העתקה איזומטרית העתקות הזזה שיקוף סיבוב ציר שיקוף מרכז סיבוב צורות חופפות חפיפה שמירת אורכים וזוויות מערכת צירים"
    },
    {
      "grade": 9,
      "topicId": 50,
      "slug": "parallel-lines-angles-grade-9",
      "sheetId": "G9-PLN-01",
      "title": "ישרים מקבילים — זוויות מתאימות ומתחלפות",
      "group": "geopar",
      "pdfIds": [
        "221e8bbea775437bbe4ab68b4ef870fd",
        "c273ce799c22473ea9baaf67404e0803",
        "c68c316690dd4ea485e0b24bdbd677fb"
      ],
      "topicSha256": "fc102753b81aebe70d36a78d73ef401da80ac94a606caca716f9dbcd432f15ce",
      "neighbours": [
        48,
        51
      ],
      "searchTerms": "ישרים מקבילים מקבילות זוויות מתאימות זוויות מתחלפות משפט הפוך תנאי להקבלה ישר חותך המרחק בין ישרים מקבילים הוכחת הקבלה"
    },
    {
      "grade": 9,
      "topicId": 51,
      "slug": "co-interior-angles-grade-9",
      "sheetId": "G9-COI-01",
      "title": "זוויות חד־צדדיות בין ישרים מקבילים",
      "group": "geopar",
      "pdfIds": [
        "69f6ddca043f42a4bfba28ebb4914b35",
        "dc02a54d258e4e55990640ca1b850193",
        "a808a520c70c499e94d0d1654b4c4692"
      ],
      "topicSha256": "8bdc51f50568b1d32dd32404817999575f73dba34ebd3f925a732e57e8daea40",
      "neighbours": [
        50,
        11
      ],
      "searchTerms": "זוויות חד צדדיות חד־צדדיות חד-צדדיות סכום 180 ישרים מקבילים ישר חותך בדיקת הקבלה משוואה"
    },
    {
      "grade": 9,
      "topicId": 52,
      "slug": "math-literacy-tasks-grade-9",
      "sheetId": "G9-LIT-01",
      "title": "משימות אוריינות — מודל מתמטי בהקשר מציאותי",
      "group": "stat",
      "pdfIds": [
        "4b17f470a73c4aa481c37ed580475f64",
        "19fe882096f24455b25d132832048557",
        "956a9a595952409ab7c5bc92aba46515"
      ],
      "topicSha256": "53139bf1739cd5706e3b9281e6171c00278e7f3e0b9f96cc9a8be4c7a262748a",
      "neighbours": [
        18,
        40
      ],
      "searchTerms": "אוריינות מתמטית משימות אוריינות משימה אוריינית מודל מתמטי הקשר מציאותי השוואת מחירים תעריף שטח פיתגורס משוואה ריבועית החלטה"
    }
  ],
  group: {
    "grade": 9,
    "value": {
      "key": "geopar",
      "label": "גיאומטריה — ישרים מקבילים וזוויות",
      "reducedProgram": false
    },
    "neighbours": [
      "fun",
      "geo"
    ]
  },
} as const;
export const reviewedNew4Slugs = reviewedNew4.topics.map(t => t.slug);

/**
 * Reverse exactly these four base topics and their search terms before every older
 * catalog fence. Any other change, or a moved or edited topic, must fail.
 */
export function beforeNew4Catalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  for (const t of reviewedNew4.topics) {
    const grade = restored.grades.find((g: any) => g.grade === t.grade);
    assert.equal(grade.topics.filter((x: any) => x.id === t.topicId).length, 1, `NEW4: exactly one topic ${t.grade}/${t.topicId}`);
    const index = grade.topics.findIndex((x: any) => x.id === t.topicId);
    assert.deepEqual([grade.topics[index - 1].id, grade.topics[index + 1].id], t.neighbours, `NEW4: reviewed position of ${t.grade}/${t.topicId}`);
    assert.deepEqual(grade.topics[index].levels.map((l: any) => l.pdfId), t.pdfIds, `NEW4: reviewed PDFs of ${t.grade}/${t.topicId}`);
    assert.equal(sha(grade.topics[index]), t.topicSha256, `NEW4: exact base topic ${t.grade}/${t.topicId}`);
    assert.equal(restored.searchTerms[String(t.grade)][String(t.topicId)], t.searchTerms, `NEW4: exact search terms ${t.grade}/${t.topicId}`);
  }
  const g9 = restored.grades.find((g: any) => g.grade === reviewedNew4.group.grade);
  assert.equal(g9.groups.filter((g: any) => g.key === reviewedNew4.group.value.key).length, 1, 'NEW4: exactly one geopar group');
  const gi = g9.groups.findIndex((g: any) => g.key === reviewedNew4.group.value.key);
  assert.deepEqual([g9.groups[gi - 1].key, g9.groups[gi + 1].key], reviewedNew4.group.neighbours, 'NEW4: reviewed group position');
  assert.deepEqual(g9.groups[gi], reviewedNew4.group.value, 'NEW4: exact geopar group');
  g9.groups.splice(gi, 1);
  for (const t of reviewedNew4.topics) {
    const grade = restored.grades.find((g: any) => g.grade === t.grade);
    grade.topics.splice(grade.topics.findIndex((x: any) => x.id === t.topicId), 1);
    delete restored.searchTerms[String(t.grade)][String(t.topicId)];
  }
  return restored;
}
