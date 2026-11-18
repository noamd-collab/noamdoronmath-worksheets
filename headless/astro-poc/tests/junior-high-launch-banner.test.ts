/**
 * Homepage announcement for the new junior-high worksheet editions.
 * One component, included once on the home page.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('junior-high launch banner', () => {
  it('announces the new editions above the fold and links each grade hub', () => {
    const cmp = readFileSync(join(root, 'src/components/JuniorHighLaunchBanner.astro'), 'utf8');
    const index = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');

    assert.match(cmp, /גרסה חדשה לגמרי עלתה לדפי חטיבת הביניים!/);
    assert.match(cmp, /לא אהבתם את הקודמים\? <span class="jh-launch__love">עכשיו תתכוננו להתאהב מחדש\.<\/span>/);
    assert.match(cmp, /href: '\/grade-7'/);
    assert.match(cmp, /href: '\/grade-8'/);
    assert.match(cmp, /href: '\/grade-9'/);
    assert.match(cmp, /כיתה ז׳/);
    assert.match(cmp, /כיתה ח׳/);
    assert.match(cmp, /כיתה ט׳/);
    assert.match(cmp, /data-junior-high-launch/);
    assert.match(cmp, /aria-label="לדפי העבודה החדשים"/);
    assert.match(cmp, /aria-label="סגירת ההודעה על הגרסה החדשה"/);
    assert.match(cmp, /aria-hidden="true"/);
    assert.match(cmp, /prefers-reduced-motion:\s*reduce/);
    assert.match(cmp, /html\.nd-motion-off/);
    assert.match(cmp, /html\.noam-a11y-motion/);
    assert.match(cmp, /data-nd-motion/);
    assert.doesNotMatch(cmp, /<h1\b/);

    assert.match(index, /import JuniorHighLaunchBanner from '\.\.\/components\/JuniorHighLaunchBanner\.astro'/);
    assert.equal((index.match(/<JuniorHighLaunchBanner \/>/g) || []).length, 1);
    assert.ok(index.indexOf('<JuniorHighLaunchBanner />') < index.indexOf('<KislevGreeting />'));
    assert.ok(index.indexOf('<JuniorHighLaunchBanner />') < index.indexOf('<h1'));
    assert.equal((index.match(/<h1\b/g) || []).length, 1);
  });
});
