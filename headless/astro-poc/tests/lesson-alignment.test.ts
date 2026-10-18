import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LESSON_LOOPS, LESSON_TOPIC_MAP, type Lesson } from '../src/lib/lessonLoops.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage, TOPIC_PAGE_SLUGS, synthesizeBodyFlow } from '../src/lib/topicPages.ts';
import { textParts } from '../src/lib/topicText.ts';
import { lessonMathParts, spokenLessonMath } from '../src/lib/lessonMath.ts';

describe('lesson alignment regressions',()=>{
  it('renders every authored fraction as a numerator and denominator, preserving its surrounding expression',()=>{
    assert.deepEqual(lessonMathParts('(x² − 9)/(x − 3); x ≠ 3'),[
      {numerator:'x² − 9',denominator:'x − 3'}, '; x ≠ 3',
    ]);
    assert.deepEqual(lessonMathParts('((x − 3)(x + 3))/(x − 3)'),[
      {numerator:'(x − 3)(x + 3)',denominator:'x − 3'},
    ]);
    assert.deepEqual(lessonMathParts('1/2 + 1/3'),[
      {numerator:'1',denominator:'2'}, ' + ', {numerator:'1',denominator:'3'},
    ]);
    for(const lesson of Object.values(LESSON_LOOPS) as Lesson[]){
      for(const value of [...lesson.steps.map(s=>s.math),...(lesson.bars??[]).map(b=>b.label)]){
        const parts=lessonMathParts(value);
        assert.ok(parts.every(p=>typeof p==='string' ? !p.includes('/') : p.numerator && p.denominator),value);
        if(!value.includes('/')) assert.equal(parts.join(''),value);
      }
    }
  });
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


it('renders numeric, signed, algebraic and ratio fractions from every topic paragraph',()=>{
  for(const slug of TOPIC_PAGE_SLUGS){
    for(const b of synthesizeBodyFlow(loadTopicPage(slug))){
      if(b.type!=='paragraph') continue;
      for(const segment of textParts(b.text)){
        const rendered = lessonMathParts(segment.text);
        for(const part of rendered) if(typeof part==='string') {
          assert.doesNotMatch(part,/[\dA-Za-z²)]\s*\/\s*[\dA-Za-z(−]/, `${slug}: ${part}`);
        }
      }
    }
  }
  assert.deepEqual(lessonMathParts('(x²−4)/(x−2)'),[{numerator:'x²−4',denominator:'x−2'}]);
  assert.deepEqual(lessonMathParts('AB/DE=2/3'),[{numerator:'AB',denominator:'DE'},'=',{numerator:'2',denominator:'3'}]);
  assert.deepEqual(lessonMathParts('(−3)/(−4)'),[{numerator:'−3',denominator:'−4'}]);
  assert.deepEqual(lessonMathParts('https://example.com/1/2'),['https://example.com/1/2']);
  assert.match(spokenLessonMath('3/4'),/המונה 3, המכנה 4/);
});
it('describes A as regular, B as easier, excellence as harder in both visible and structured FAQ',()=>{
  for(const slug of TOPIC_PAGE_SLUGS){
    const p=loadTopicPage(slug);
    const text=JSON.stringify([p.faq,p.faqGroups,p.jsonLd]);
    assert.doesNotMatch(text,/רמה א׳ מתאימה לביסוס/);
    for(const f of p.faq.filter(f=>f.question.includes('רמת תרגול'))){
      assert.match(f.answer,/רמה א׳ היא רמת התרגול הרגילה/);
      assert.match(f.answer,/רמה ב׳ קלה יותר/);
    }
  }
});
it('routes the reviewed topics to the actual concept being taught',()=>{
  const expected={
    'classify-triangles-grade-3':'triangle-angles','read-graphs-grade-5':'read-linegraph',
    'read-tables-grade-5':'read-table','collect-represent-data-grade-6':'data-mean',
    'compare-groups-conclusions-grade-6':'compare-groups','fractions-numberline-compare-grade-4':'fraction-numberline',
    'fractions-numberline-compare-grade-5':'fraction-numberline','compare-fractions-decimals-grade-5':'fraction-decimal-compare',
    'lines-angles-shapes-grade-3':'para-perp','angles-lines-plane-grade-4':'para-perp',
    'precalculus-functions-graphs-grade-9':'linear-table',
  };
  for(const [slug,variant] of Object.entries(expected)){
    const loop=topicLandingLoop(loadTopicPage(slug));
    assert.ok(loop.kind!=='film' && loop.variant===variant,slug);
  }
});

 it('renders current-main fraction markers and legacy algebra together without losing surrounding prose', () => {
  assert.deepEqual(lessonMathParts('כי ⟨45¦100⟩ × 200 = 90; (x²−4)/(x−2)'), [
    'כי ', {numerator:'45',denominator:'100'}, ' × 200 = 90; ', {numerator:'x²−4',denominator:'x−2'}
  ]);
  assert.match(spokenLessonMath('⟨3¦4⟩'), /המונה 3, המכנה 4/);
 });
