import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { studentFacingEditions } from '../src/lib/catalog/editions';
import { RETIRED_JUNIOR_WORKSHEET_REDIRECTS } from '../src/lib/retiredJuniorWorksheets';
import { retiredJuniorEdgeResponse } from '../src/worker/retiredJuniorEdge';
import { injectRetiredJuniorEdge } from '../scripts/retired-junior-worker-plugin.mjs';

const REMOVED = 'b6b9bf5985484191b71c0c864fd04c31';
const TOPIC = '/coordinate-plane-scale-grade-7';

function keptPdfId(): string {
  const catalog = loadCatalog();
  for (const grade of catalog.grades) {
    if (grade.grade < 7) continue;
    for (const topic of grade.topics) {
      for (const edition of studentFacingEditions(topic, grade.grade)) {
        for (const level of edition.levels) {
          if (!RETIRED_JUNIOR_WORKSHEET_REDIRECTS[level.pdfId]) return level.pdfId;
        }
      }
    }
  }
  throw new Error('expected a still-listed junior sheet');
}

test('worker edge 301s retired sheet URLs before static assets', () => {
  assert.equal(RETIRED_JUNIOR_WORKSHEET_REDIRECTS[REMOVED], TOPIC);
  const pdf = retiredJuniorEdgeResponse(new Request(
    `https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_${REMOVED}.pdf`,
  ));
  assert.equal(pdf?.status, 301);
  assert.equal(pdf?.headers.get('Location'), TOPIC);
  assert.equal(pdf?.headers.get('X-Noam-Retired-Sheet'), '1');

  const viewer = retiredJuniorEdgeResponse(new Request(
    `https://www.noamdoronmath.co.il/worksheet-viewer-noam.html?pdf=${REMOVED}&g=7`,
  ));
  assert.equal(viewer?.status, 301);
  assert.equal(viewer?.headers.get('Location'), TOPIC);

  const kept = keptPdfId();
  assert.equal(retiredJuniorEdgeResponse(new Request(
    `https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_${kept}.pdf`,
  )), null);
  assert.equal(retiredJuniorEdgeResponse(new Request(
    `https://www.noamdoronmath.co.il/worksheet-viewer-noam.html?pdf=${kept}`,
  )), null);
  assert.equal(retiredJuniorEdgeResponse(new Request(
    'https://www.noamdoronmath.co.il/grade-9',
  )), null);
});

test('grade 9 topics 21, 41, 42 and 43 stay reachable', () => {
  const catalog = loadCatalog();
  const grade = catalog.grades.find((item) => item.grade === 9)!;
  for (const topicId of [21, 41, 42, 43]) {
    const topic = grade.topics.find((item) => item.id === topicId)!;
    assert.ok(topic.levels.length > 0, String(topicId));
    for (const level of topic.levels) {
      assert.equal(RETIRED_JUNIOR_WORKSHEET_REDIRECTS[level.pdfId], undefined, level.pdfId);
      assert.equal(retiredJuniorEdgeResponse(new Request(
        `https://www.noamdoronmath.co.il/worksheet-viewer-noam.html?pdf=${level.pdfId}`,
      )), null);
    }
  }
});

test('worker fetch answers retired sheets before the asset handler', () => {
  const source = [
    'import { App } from "astro/app";',
    'function createExports(manifest) {',
    '\tconst fetch = async (request, env = {}, context) => {',
    '\t\tif (typeof env.ASSETS?.fetch === "function") {',
    '\t\t\treturn await handle(manifest, app, request, env, context);',
    '\t\t}',
    '\t\treturn await app.render(request);',
    '\t};',
    '}',
  ].join('\n');
  const next = injectRetiredJuniorEdge(source);
  assert.ok(next);
  const guard = next.indexOf('retiredJuniorEdgeResponse(request)');
  const assets = next.indexOf('env.ASSETS');
  assert.ok(guard > 0 && guard < assets);
  assert.equal(injectRetiredJuniorEdge('no fetch here'), null);
  const wiring = readFileSync(new URL('../scripts/lib/compact-server-build.mjs', import.meta.url), 'utf8');
  assert.match(wiring, /retiredJuniorWorkerPlugin\(\)/);
});
