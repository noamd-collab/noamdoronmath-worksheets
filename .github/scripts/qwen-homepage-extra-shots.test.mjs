import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { shouldCaptureHomepageGameShots } from './qwen-homepage-extra-shots.mjs';

describe('shouldCaptureHomepageGameShots', () => {
  it('runs only for homepage, GamePromoCard, or doodle changes', () => {
    assert.equal(shouldCaptureHomepageGameShots(['headless/astro-poc/src/pages/index.astro']), true);
    assert.equal(shouldCaptureHomepageGameShots(['headless/astro-poc/src/components/GamePromoCard.astro']), true);
    assert.equal(shouldCaptureHomepageGameShots(['headless/astro-poc/public/design-exact/assets/doodles/kite-240.webp']), true);
    assert.equal(shouldCaptureHomepageGameShots(['headless/astro-poc/src/pages/grade-9.astro']), false);
    assert.equal(shouldCaptureHomepageGameShots(['headless/astro-poc/src/layouts/BaseLayout.astro']), false);
  });
  it('waits for asynchronous decode, fonts and paint rather than download completion alone', () => {
    const source = readFileSync(new URL('./qwen-homepage-extra-shots.mjs', import.meta.url), 'utf8');
    assert.match(source, /await image\.decode\(\)/);
    assert.match(source, /await document\.fonts\.ready/);
    assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  });
});
