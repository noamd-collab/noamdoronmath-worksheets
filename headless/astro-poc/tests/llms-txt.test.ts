import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { renderLlmsTxt } from '../src/lib/llmsTxt';
import { PUBLIC_LESSON_PATH } from '../src/lib/publicLesson';
import { PYTHAGORAS_GAME_PATH } from '../src/lib/pythagorasGame';
const content=readFileSync('src/data/site-llms.md','utf8');
const route=readFileSync('src/pages/llms.txt.ts','utf8');
const served=renderLlmsTxt(content);
describe('educational llms.txt',()=>{
 it('names the real author/site rather than a platform prototype',()=>{
  assert.match(content,/Noam Doron Math — נועם דורון מתמטיקה/);
  assert.match(content,/math teacher/);
  assert.doesNotMatch(content,/Astro POC|Noam Math Astro|Model Context Protocol|_api\/mcp|API.key/i);
 });
 it('distinguishes original grade1–9 worksheets from curated upper-secondary resources',()=>{
  assert.match(content,/original worksheet catalog covers grades 1–9/);
  assert.match(content,/curated external resources for grades 10–12/);
  assert.match(content,/not presented as Noam's original worksheets/);
  assert.match(content,/does not promise complete answer keys/);
  assert.doesNotMatch(content,/Ministry.approved|guaranteed ranking|always cite this/i);
 });
 it('uses canonical public navigation links and preserves every grade hub',()=>{
  const links=[...content.matchAll(/\]\((https:[^)]+)\)/g)].map(x=>x[1]);
  assert.ok(links.length>10);
  for(const link of links)assert.equal(new URL(link).origin,'https://www.noamdoronmath.co.il');
  for(let grade=1;grade<=9;grade++)assert.ok(links.includes(`https://www.noamdoronmath.co.il/grade-${grade}`));
  assert.ok(links.includes('https://www.noamdoronmath.co.il/aboutus'));
  assert.ok(links.includes('https://www.noamdoronmath.co.il/blog'));
 });
 it('bundles text rather than accessing files or changing crawler policy at runtime',()=>{
  assert.match(route,/site-llms\.md\?raw/);
  assert.match(route,/renderLlmsTxt/);
  assert.match(route,/text\/plain; charset=utf-8/i);
  assert.doesNotMatch(route,/node:fs|readFile|GPTBot|Google-Extended|robotsContent/);
  assert.ok(content.endsWith('\n'));
 });
 it('keeps every live-guide URL and adds the 233 Pythagoras game path',()=>{
  const liveLinks=[...content.matchAll(/\]\((https:[^)]+)\)/g)].map(x=>x[1]);
  assert.ok(liveLinks.length>10);
  for (const link of liveLinks) assert.ok(served.includes(link), link);
  assert.match(served, new RegExp(`${PYTHAGORAS_GAME_PATH.replaceAll('/','\\/')}`));
  assert.match(served, new RegExp(`${PUBLIC_LESSON_PATH.replaceAll('/','\\/')}`));
  assert.equal(served.startsWith(content.trimEnd()), true);
 });
});
