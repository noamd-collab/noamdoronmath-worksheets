import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { viewerVisualFixture } from './qwen-visual-review.mjs';

describe('viewerVisualFixture', () => {
  it('derives one real viewer-enabled catalog resource without contacting a model', () => {
    const fixture = viewerVisualFixture();
    const url = new URL(fixture.route, 'https://preview.local');
    const catalog = JSON.parse(readFileSync('headless/astro-poc/src/data/catalog.v1.json', 'utf8'));
    const grade = catalog.grades.find((candidate) => String(candidate.grade) === url.searchParams.get('g'));
    const topic = grade?.topics.find((candidate) => String(candidate.id) === url.searchParams.get('topic'));
    const level = topic?.levels.find((candidate) => candidate.key === url.searchParams.get('lv'));

    assert.equal(url.pathname, '/worksheet-viewer-noam.html');
    assert.ok(grade);
    assert.ok(topic?.routing.usesViewer);
    assert.ok(level);
    assert.equal(level.pdfId, url.searchParams.get('pdf'));
    assert.equal(topic.title, url.searchParams.get('t'));
    assert.equal(fixture.title, `${topic.title} — ${grade.label} — ${level.label} | נועם דורון`);
  });
});
