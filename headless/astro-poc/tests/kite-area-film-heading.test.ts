import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('kite area film title (SEO audit נ-3)', () => {
  const film = readFileSync('src/components/KiteAreaFilm.astro', 'utf8');

  it('adds no h1 to the topic page', () => {
    assert.doesNotMatch(film, /<h1[\s>]/);
    assert.ok(film.includes('<div class="ka-title">שטח דלתון</div>'));
  });

  it('keeps the old title look', () => {
    const rule = film.match(/\.title-wrap \.ka-title \{[\s\S]*?\}/)?.[0] || '';
    assert.ok(rule.includes("font-family: 'Secular One'"), 'Secular One came from the global h1 rule');
    assert.ok(rule.includes('font-size: 56px;'));
    assert.ok(rule.includes('font-weight: 850;'));
    assert.ok(rule.includes('margin: 0;'));
    assert.ok(film.includes('.title-wrap .ka-title { font-size: 45px; }'));
    assert.doesNotMatch(film, /\.title-wrap h1/);
  });
});
