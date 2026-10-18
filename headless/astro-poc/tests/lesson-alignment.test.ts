import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LESSON_LOOPS, LESSON_TOPIC_MAP, type Lesson } from '../src/lib/lessonLoops.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';

describe('lesson alignment regressions',()=>{
  it('does not substitute related but different mathematical operations',()=>{
    const expected = {
      'reflection-symmetry-grade-2':'reflect-fold',
      'box-surface-area-grade-6':'box-net',
      'angles-types-grade-3':'angle-kinds',
      'polygons-diagonals-grade-4':'two-diag',
      'fraction-division-algorithm-grade-6':'frac-recip',
      'multiplication-multi-digit-grade-5':'long-mul',
      'addition-two-digit-no-carry-grade-2':'add-no-carry',
      'subtraction-two-digit-no-borrow-grade-2':'subtract-no-borrow',
      'algebraic-fractions-grade-9':'algebra-fraction',
      'equations-basics-grade-7':'balance',
      'equations-advanced-grade-7':'equation-expand',
      'parallelogram-trapezoid-area-grade-9':'trap-area',
    };
    for(const [slug,variant] of Object.entries(expected)) {
      const loop=topicLandingLoop(loadTopicPage(slug));
      assert.notEqual(loop.kind,'film');
      if(loop.kind!=='film') assert.equal(loop.variant,variant,slug);
    }
  });
  it('keeps averaging and advanced angle relationships off introductory pages',()=>{
    for(const slug of TOPIC_PAGE_SLUGS){
      const p=loadTopicPage(slug), loop=topicLandingLoop(p);
      if(p.grade<=4 && loop.kind!=='film') assert.ok(!['stats','angles'].includes(loop.variant),slug);
    }
  });
  it('uses real page slugs and renders each fraction against an equal-sized whole',()=>{
    for(const [slug,variant] of Object.entries(LESSON_TOPIC_MAP)) {
      assert.ok(TOPIC_PAGE_SLUGS.includes(slug),slug);
      assert.ok(LESSON_LOOPS[variant],variant);
    }
    for(const [variant,lesson] of Object.entries(LESSON_LOOPS) as [string,Lesson][]){
      assert.equal(lesson.steps.length,3,variant);
      assert.ok(lesson.steps.every(s=>s.text.trim()),variant);
      if(lesson.picture==='bars') assert.ok(lesson.bars?.length,variant);
      for(const bar of lesson.bars??[]) {
        assert.ok(Number.isInteger(bar.total)&&bar.total>0,variant);
        assert.ok(Number.isInteger(bar.filled)&&bar.filled>=0&&bar.filled<=bar.total,variant);
      }
    }
  });
  it('retains the domain restriction after cancelling the common factor',()=>{
    const l=LESSON_LOOPS['algebra-fraction'];
    assert.match(l.steps[0].math,/x ≠ 3/);
    assert.match(l.steps[2].math,/x ≠ 3/);
    for(const x of [-2,0,2,4,7]) assert.equal((x*x-9)/(x-3),x+3);
  });
});
