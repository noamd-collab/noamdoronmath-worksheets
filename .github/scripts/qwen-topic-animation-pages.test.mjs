import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pagesTouchedByDiff,TOPIC_ANIMATION_FILES,TOPIC_ANIMATION_PAGES,MAX_SCREENSHOT_PAGES} from './pr-pages.mjs';
test('animation-only changes receive actual lesson screenshots, not unrelated fallback pages',()=>{
  for(const file of TOPIC_ANIMATION_FILES){
    const result=pagesTouchedByDiff([file]);
    assert.equal(result.fallback,false);
    assert.deepEqual(result.pages,TOPIC_ANIMATION_PAGES);
    assert.ok(result.pages.length<=MAX_SCREENSHOT_PAGES);
  }
});
