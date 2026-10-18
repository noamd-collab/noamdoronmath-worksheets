/**
 * Every topic, grade, and marketing landing must expose a looping animation.
 * The marker is data-landing-loop. A new page file fails until it is classified.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CSS_LOOP_IDEAS,
  CSS_LOOP_VARIANTS,
  captionMathHtml,
  GRADE_CONCEPT_LOOP,
  LOOP_TABLE_NOTES,
  MARKETING_LANDING_LOOPS,
  MINUS,
  NON_LANDING_SITE_SLUGS,
  POWERS_ROWS,
  marketingLandingLoop,
  powerMarkup,
  topicLandingLoop,
} from '../src/lib/landingLoops.ts';
import { isLessonLoop, LESSON_LOOPS } from '../src/lib/lessonLoops.ts';
import { GRADE_HUB_GRADES } from '../src/lib/gradeHubs.ts';
import { TOPIC_PAGE_SLUGS, loadTopicPage } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

const NON_LANDING_PAGES = new Set([
  '404.astro',
  'worksheets.astro',
  'dev-loops.astro',
  'hero-loops/[variant].astro',
  'blog/index.astro',
  'blog/categories/[slug].astro',
  'post/[...slug].astro',
]);

function astroPages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...astroPages(abs));
    else if (name.endsWith('.astro')) out.push(abs);
  }
  return out;
}

describe('landing loop coverage', () => {
  it('resolves a loop for every topic landing', () => {
    const counts = { concept: 0, css: 0, film: 0 };
    for (const slug of TOPIC_PAGE_SLUGS) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.ok(loop.marker, slug);
      assert.equal(loop.marker.length > 0, true, slug);
      counts[loop.kind] += 1;
      if (loop.kind === 'css') {
        assert.ok(CSS_LOOP_VARIANTS.includes(loop.variant), `${slug} variant ${loop.variant}`);
      }
      if (loop.kind === 'film') {
        const films = {
          'analytic-geometry-grade-9': {
            src: '/loops/distance-between-points.html',
            marker: 'distance-between-points',
          },
          'triangle-quadrilateral-angle-sum-grade-7': {
            src: '/loops/triangle-angle-sum-vertex-descent.html',
            marker: 'triangle-angle-sum-vertex-descent',
          },
          'parallel-lines-angles-grade-8': {
            src: '/loops/parallel-cointerior-angles.html',
            marker: 'parallel-cointerior-angles',
          },
        };
        assert.deepEqual(
          { src: loop.src, marker: loop.marker },
          films[slug as keyof typeof films],
          slug,
        );
      }
    }
    assert.equal(counts.concept + counts.css + counts.film, TOPIC_PAGE_SLUGS.length);
    assert.equal(counts.film, 3);
    assert.ok(counts.css > 0);
    assert.ok(counts.concept > 0);
  });

  it('powers-grade-7 gets the exponent loop, and existing films stay films', () => {
    assert.deepEqual(topicLandingLoop(loadTopicPage('powers-grade-7')), {
      kind: 'css',
      variant: 'powers',
      marker: 'powers',
    });
    assert.equal(topicLandingLoop(loadTopicPage('pythagorean-theorem-grade-8')).kind, 'concept');
    assert.equal(topicLandingLoop(loadTopicPage('pythagorean-theorem-grade-8')).variant, 'pythagoras');
    assert.equal(topicLandingLoop(loadTopicPage('triangle-area-grade-7')).variant, 'triangle-area');
    assert.equal(topicLandingLoop(loadTopicPage('square-root-grade-7')).variant, 'roots');
    assert.equal(topicLandingLoop(loadTopicPage('exponent-rules-grade-9')).variant, 'exp-rules');
    assert.equal(topicLandingLoop(loadTopicPage('multiplying-signed-numbers-grade-7')).variant, 'signed-mul');
    assert.deepEqual(topicLandingLoop(loadTopicPage('parallel-lines-angles-grade-8')), {
      kind: 'film',
      marker: 'parallel-cointerior-angles',
      src: '/loops/parallel-cointerior-angles.html',
    });
    assert.equal(topicLandingLoop(loadTopicPage('geometric-proof-grade-8')).variant, 'proof');
    assert.equal(topicLandingLoop(loadTopicPage('transition-to-high-school-grade-9')).variant, 'quad-factor');
    assert.equal(marketingLandingLoop('high-school-math'), 'parabola');
  });

  it('reviewed elementary pages play a film of their own lesson', () => {
    const expected: Record<string, string> = {
      'counting-grade-1': 'css:count-mark',
      'addition-to-10-grade-1': 'concept:add-within',
      'numbers-operations-review-grade-2': 'concept:array',
      'perimeter-polygons-grade-3': 'concept:peri-rect',
      'order-of-operations-grade-4': 'concept:order-ops',
      'distributive-area-model-grade-4': 'css:distrib-area',
      'multiplication-multi-digit-grade-4': 'css:col-mul',
      'grade-4-summary': 'concept:baseten',
      'parallelogram-area-grade-5': 'css:area-para',
      'fraction-division-meaning-grade-6': 'css:frac-div',
      'measurement-geometry-synthesis-grade-6': 'concept:rect-count',
    };
    for (const [slug, want] of Object.entries(expected)) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.equal(`${loop.kind}:${loop.kind === 'film' ? loop.marker : loop.variant}`, want, slug);
    }
    for (const slug of Object.keys(expected)) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      const variant = loop.kind === 'film' ? loop.marker : loop.variant;
      for (const wrong of ['coords', 'area-model', 'frac-product', 'order', 'tenframes', 'sticks', 'triangle', 'area']) {
        assert.notEqual(variant, wrong, slug);
      }
    }
  });

  it('follow-up elementary pages play a film of their own lesson', () => {
    const expected: Record<string, string> = {
      'compose-decompose-10-grade-1': 'concept:add-within',
      'subtraction-to-10-grade-1': 'concept:birds-sub',
      'order-of-operations-grade-5': 'concept:order-ops',
      'subtraction-to-20-grade-1': 'css:sub-via-10',
      'compose-decompose-grade-1': 'css:split-ways',
      'shapes-compose-decompose-grade-1': 'css:tri-square',
      'number-bonds-10-20-grade-2': 'css:bonds-10-20',
      'multiplication-multi-digit-grade-5': 'css:long-mul',
      'fraction-division-algorithm-grade-6': 'css:frac-recip',
      // Bridging through ten is these two pages' own idea, so they keep 7 + 5.
      'making-20-via-10-grade-1': 'concept:tenframes',
      'addition-to-20-grade-1': 'concept:tenframes',
    };
    for (const [slug, want] of Object.entries(expected)) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.equal(`${loop.kind}:${loop.kind === 'film' ? loop.marker : loop.variant}`, want, slug);
    }
    const tenframes = TOPIC_PAGE_SLUGS.filter((slug) => {
      const loop = topicLandingLoop(loadTopicPage(slug));
      return loop.kind === 'concept' && loop.variant === 'tenframes';
    });
    assert.deepEqual([...tenframes].sort(), ['addition-to-20-grade-1', 'making-20-via-10-grade-1']);
    // Algebra and negative numbers belong to grade 7 and up.
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      if (page.grade > 6) continue;
      const loop = topicLandingLoop(page);
      const variant = loop.kind === 'film' ? loop.marker : loop.variant;
      for (const wrong of ['area-model', 'order', 'signed', 'signed-jump', 'signed-ops', 'coords']) {
        assert.notEqual(variant, wrong, slug);
      }
    }
  });

  it('follow-up loops show the example written on their page', () => {
    const sketch = read('src/components/LoopSketch.astro');
    const formula = read('src/components/LoopFormula.astro');
    const pageText = (slug: string) => JSON.stringify(loadTopicPage(slug).sections);

    assert.ok(pageText('subtraction-to-20-grade-1').includes(`15 ${MINUS} 7 = 15 ${MINUS} 5 ${MINUS} 2 = 8`));
    assert.ok(
      sketch.includes(
        '15 {MINUS} 7 <span class="sk-sv-step1">= 15 {MINUS} 5</span> <span class="sk-sv-step2">{MINUS} 2</span> <span class="sk-sv-step3">= 8</span>',
      ),
    );
    assert.match(CSS_LOOP_IDEAS['sub-via-10'], new RegExp(`15 ${MINUS} 7 .*5 .*10.*2.*8`));

    assert.ok(pageText('compose-decompose-grade-1').includes('1 + 5, 2 + 4 ו־3 + 3'));
    assert.ok(sketch.includes('6 = {row.k} + {6 - row.k}'));
    assert.match(sketch, /const splitRows = \[1, 2, 3\]/);
    assert.match(CSS_LOOP_IDEAS['split-ways'], /1 \+ 5, 2 \+ 4, 3 \+ 3/);

    assert.match(pageText('shapes-compose-decompose-grade-1'), /שני משולשים[^"]*ריבוע/);
    assert.match(CSS_LOOP_IDEAS['tri-square'], /שני משולשים.*ריבוע/);

    assert.ok(pageText('number-bonds-10-20-grade-2').includes('6 + 4'));
    assert.ok(pageText('number-bonds-10-20-grade-2').includes('13 + 7 = 20'));
    assert.ok(sketch.includes('>6 + 4 = 10</text>'));
    assert.ok(sketch.includes('>13 + 7 = 20</text>'));
    assert.match(CSS_LOOP_IDEAS['bonds-10-20'], /6 \+ 4 = 10.*13 \+ 7 = 20/);

    assert.ok(pageText('multiplication-multi-digit-grade-5').includes('257 × 23 = 257 × 20 + 257 × 3 = 5,140 + 771 = 5,911'));
    assert.ok(pageText('multiplication-multi-digit-grade-5').includes('250 × 20 = 5,000'));
    for (const note of ['257 × 3 = 771', '257 × 20 = 5,140', '≈ 250 × 20 = 5,000']) assert.ok(sketch.includes(note), note);
    assert.match(CSS_LOOP_IDEAS['long-mul'], /771 \+ 5,140 = 5,911/);

    assert.ok(pageText('fraction-division-algorithm-grade-6').includes('1/2 : 1/4 = 1/2 × 4 = 2'));
    assert.match(
      formula,
      /<span class="ll-frac__n"><span class="ll-rc-up">4<\/span><\/span><span class="ll-frac__d"><span class="ll-rc-down">1<\/span><\/span>/,
    );
    assert.match(formula, /<span class="ll-rc-mul">×<\/span>/);
    assert.match(formula, /<span class="ll-rc-ans">= 2<\/span>/);
    assert.match(CSS_LOOP_IDEAS['frac-recip'], /רק את המחלק/);
  });

  it('kite-grade-9 plays the kite-construct film', () => {
    assert.deepEqual(topicLandingLoop(loadTopicPage('kite-grade-9')), {
      kind: 'concept',
      variant: 'kite-construct',
      marker: 'concept-kite-construct',
    });
  });

  it('difference-of-squares-grade-9 gets its own L14 diff-sq film; no other page plays it', () => {
    assert.deepEqual(topicLandingLoop(loadTopicPage('difference-of-squares-grade-9')), {
      kind: 'concept',
      variant: 'diff-sq',
      marker: 'concept-diff-sq',
    });
    for (const slug of TOPIC_PAGE_SLUGS) {
      if (slug === 'difference-of-squares-grade-9') continue;
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.notEqual(loop.kind === 'concept' ? loop.variant : '', 'diff-sq', slug);
    }
  });

  it('topic, grade, home, and marketing templates emit data-landing-loop', () => {
    const topic = read('src/components/TopicPage.astro');
    const loop = read('src/components/LandingLoop.astro');
    const hub = read('src/components/GradeHubPage.astro');
    const home = read('src/pages/index.astro');
    const site = read('src/components/SitePage.astro');

    assert.match(topic, /const hasDemo = landingLoop\.kind === 'concept' \|\| landingLoop\.kind === 'css'/);
    assert.match(topic, /data-landing-loop=\{loopVariant \? landingLoop\.marker : undefined\}/);
    assert.match(topic, /\{cssVariant && <LandingLoop variant=\{cssVariant\} \/>\}/);
    assert.match(topic, /\{loopVariant && <ConceptLoop variant=\{loopVariant\} \/>\}/);
    assert.match(topic, /landingLoop\.kind === 'film' && landingLoop\.marker === 'distance-between-points'/);
    assert.match(topic, /<DistancePointsLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\} \/>/);
    assert.match(topic, /<TriangleAngleSumLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\} \/>/);
    assert.match(topic, /<ParallelCointeriorLoop src=\{landingLoop\.src\} marker=\{landingLoop\.marker\} \/>/);
    assert.match(loop, /data-landing-loop=\{variant\}/);
    assert.match(hub, /data-landing-loop=\{`grade-\$\{grade\}`\}/);
    assert.match(home, /data-landing-loop="hero"/);
    assert.match(site, /marketingLoop && \([\s\S]*<LandingLoop variant=\{marketingLoop\} \/>/);

    for (const grade of GRADE_HUB_GRADES) {
      assert.ok(GRADE_CONCEPT_LOOP[grade], `grade ${grade}`);
    }
    assert.equal(marketingLandingLoop('high-school-math'), 'parabola');
    assert.equal(marketingLandingLoop('math-tools'), 'tools');
    for (const slug of NON_LANDING_SITE_SLUGS) {
      assert.equal(marketingLandingLoop(slug), undefined, slug);
    }
  });

  it('css loops are transform/opacity, pause off-screen, and honor motion-off', () => {
    const loop = read('src/components/LandingLoop.astro');
    const scenes = [
      loop,
      read('src/components/LoopFormula.astro'),
      read('src/components/LoopSketch.astro'),
      read('src/components/LessonLoop.astro'),
    ].join('\n');
    assert.match(loop, /prefers-reduced-motion:\s*reduce/);
    assert.match(loop, /html\.nd-motion-off/);
    assert.match(loop, /html\.noam-a11y-motion/);
    assert.match(loop, /IntersectionObserver/);
    assert.match(loop, /ll--off/);
    assert.match(loop, /animation-play-state:\s*paused/);
    assert.doesNotMatch(scenes, /<video\b|lottie|gsap|bodymovin/i);
    for (const variant of CSS_LOOP_VARIANTS) {
      if (isLessonLoop(variant)) {
        assert.ok(scenes.includes(`lesson.picture === '${LESSON_LOOPS[variant].picture}'`) || ['equation', 'place'].includes(LESSON_LOOPS[variant].picture), `missing lesson renderer ${variant}`);
      } else assert.ok(scenes.includes(`variant === '${variant}'`), `missing scene ${variant}`);
    }
  });

  it('glues exponents to the base and uses a real minus', () => {
    assert.equal(MINUS, '\u2212');
    assert.equal(powerMarkup(POWERS_ROWS[0]), `(${MINUS}3)<sup>2</sup> = 9`);
    assert.equal(powerMarkup(POWERS_ROWS[1]), `${MINUS}3<sup>2</sup> = ${MINUS}9`);
    assert.equal(powerMarkup(POWERS_ROWS[2]), `(${MINUS}3)<sup>3</sup> = ${MINUS}27`);
    assert.equal(POWERS_ROWS[0].expand, `(${MINUS}3) × (${MINUS}3)`);
    assert.equal(POWERS_ROWS[1].expand, `${MINUS}(3 × 3)`);
    assert.equal(POWERS_ROWS[2].expand, `(${MINUS}3) × (${MINUS}3) × (${MINUS}3)`);

    for (const row of POWERS_ROWS) {
      const html = powerMarkup(row);
      assert.equal(html.includes('-'), false, html);
      assert.equal(/\s<sup>/.test(html), false, html);
      assert.match(html, /[^\s]<sup>/);
    }

    const formula = read('src/components/LoopFormula.astro');
    const sketch = read('src/components/LoopSketch.astro');
    assert.match(formula, /<span class="ll-parens">\{even\.base\}<\/span><sup>\{even\.sup\}<\/sup>/);
    assert.match(formula, /<span class="ll-parens">\{odd\.base\}<\/span><sup>\{odd\.sup\}<\/sup>/);
    assert.match(formula, /<span class="ll-sign">\{MINUS\}<\/span>3<sup>2<\/sup>/);
    assert.match(formula, /2<sup class="ll-hot">3<\/sup> × 2<sup/);
    assert.match(sketch, /S = πr<sup>2<\/sup>/);
    assert.match(sketch, /V = πr<sup>2<\/sup>h/);
    assert.match(formula, /dir="ltr"/);
    assert.match(formula, /unicode-bidi:\s*isolate/);
  });

  it('every new loop states one Hebrew idea', () => {
    assert.deepEqual(Object.keys(CSS_LOOP_IDEAS).sort(), [...CSS_LOOP_VARIANTS].sort());
    const hebrew = /[\u0590-\u05FF]/;
    for (const variant of CSS_LOOP_VARIANTS) {
      const idea = CSS_LOOP_IDEAS[variant];
      assert.equal(hebrew.test(idea), true, variant);
      assert.equal(idea.includes('\n'), false, variant);
      assert.equal(idea.includes('-'), false, `${variant} uses hyphen-minus`);
    }
    let cssPages = 0;
    for (const slug of TOPIC_PAGE_SLUGS) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      if (loop.kind !== 'css') continue;
      cssPages += 1;
      assert.equal(hebrew.test(CSS_LOOP_IDEAS[loop.variant]), true, slug);
    }
    for (const slug of Object.keys(MARKETING_LANDING_LOOPS)) {
      cssPages += 1;
      const variant = marketingLandingLoop(slug);
      assert.ok(variant, slug);
      assert.equal(hebrew.test(CSS_LOOP_IDEAS[variant]), true, slug);
    }
    assert.ok(cssPages >= 128, `expected coverage of at least the existing 128 CSS pages, got ${cssPages}`);
    assert.equal(topicLandingLoop(loadTopicPage('analytic-geometry-grade-9')).kind, 'film');
    assert.equal(CSS_LOOP_IDEAS.t306090.includes('היתר'), true);
    assert.equal(CSS_LOOP_IDEAS.t306090.includes('המיתר'), false);
    assert.equal(CSS_LOOP_IDEAS.stats.includes('16/3'), false);
    assert.match(CSS_LOOP_IDEAS.stats, /4, 6 ו־8 הוא 6/);
    assert.match(LOOP_TABLE_NOTES['high-school-math'], /פרבולה/);
    const shown = [
      read('src/components/LoopFormula.astro'),
      read('src/components/LoopSketch.astro'),
      ...Object.values(CSS_LOOP_IDEAS),
    ].join('\n');
    assert.equal(shown.includes('÷'), false);
    assert.equal(shown.includes('·'), false);
    assert.equal(shown.includes('∙'), false);
    assert.equal(shown.includes('⋅'), false);
    assert.equal(/\d\/\d/.test(shown), false);
  });

  it('new review loops show the same numbers as their captions', () => {
    const sketch = read('src/components/LoopSketch.astro');
    assert.match(CSS_LOOP_IDEAS['col-mul'], /175 × 5 = 875/);
    for (const step of ['5 × 5 = 25', '7 × 5 + 2 = 37', '1 × 5 + 3 = 8']) assert.ok(sketch.includes(step), step);
    assert.match(CSS_LOOP_IDEAS['distrib-area'], /150 \+ 90 = 240/);
    assert.ok(sketch.includes('15 × 16 = 150 + 90 = 240'));
    assert.match(CSS_LOOP_IDEAS['frac-div'], /8 רבעים/);
    assert.match(sketch, /2 : <span class="ll-frac"><span class="ll-frac__n">1<\/span><span class="ll-frac__d">4<\/span><\/span>/);
    assert.match(CSS_LOOP_IDEAS['count-mark'], /האחרון, 7,/);
    assert.match(sketch, /length: 7 \}, \(_, i\) => \(\{\s*n: i \+ 1,\s*x: 408 - i \* 56/);
  });

  it('isolates every math fragment inside a Hebrew loop caption', () => {
    const mathCore = /[0-9A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉π°−+×÷=≠<>≤≥±√∞%*]/;
    const decode = (html: string) =>
      html.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    for (const variant of CSS_LOOP_VARIANTS) {
      const idea = CSS_LOOP_IDEAS[variant];
      const html = captionMathHtml(idea);
      const plain = decode(html.replace(/<bdi dir="ltr" class="ll-math">/g, '').replace(/<\/bdi>/g, ''));
      assert.equal(plain, idea, variant);
      const outside = html.replace(/<bdi dir="ltr" class="ll-math">[\s\S]*?<\/bdi>/g, '');
      assert.equal(mathCore.test(outside), false, `${variant} left math outside an isolate: ${outside}`);
      for (const fragment of html.match(/<bdi dir="ltr" class="ll-math">[\s\S]*?<\/bdi>/g) ?? []) {
        assert.equal(fragment.includes('־'), false, `${variant} pulled a Hebrew prefix into ${fragment}`);
      }
    }
    assert.match(captionMathHtml(CSS_LOOP_IDEAS.order), /ל־<bdi dir="ltr" class="ll-math">−2<\/bdi>/);
    assert.match(captionMathHtml(CSS_LOOP_IDEAS.signed), /ב־<bdi dir="ltr" class="ll-math">−2<\/bdi>/);
    assert.match(
      captionMathHtml(CSS_LOOP_IDEAS['exp-rules']),
      /: <bdi dir="ltr" class="ll-math">2³ × 2² = 2⁵<\/bdi>/,
    );
    const quad = captionMathHtml(CSS_LOOP_IDEAS['quad-ineq']);
    assert.match(quad, /<bdi dir="ltr" class="ll-math">x² &gt; 9<\/bdi>/);
    assert.match(quad, /<bdi dir="ltr" class="ll-math">x &lt; −3<\/bdi>/);
    assert.match(quad, /<bdi dir="ltr" class="ll-math">x &gt; 3<\/bdi>/);
    assert.match(captionMathHtml(CSS_LOOP_IDEAS['quad-factor']), /<bdi dir="ltr" class="ll-math">x = 3<\/bdi>/);
    assert.match(captionMathHtml('12 : 4'), /<bdi dir="ltr" class="ll-math">12 : 4<\/bdi>/);
    assert.match(captionMathHtml(CSS_LOOP_IDEAS.circle), /<bdi dir="ltr" class="ll-math">2πr<\/bdi>/);
    assert.match(captionMathHtml(CSS_LOOP_IDEAS.angles), /ל־<bdi dir="ltr" class="ll-math">180°<\/bdi>/);

    const formula = read('src/components/LoopFormula.astro');
    const sketch = read('src/components/LoopSketch.astro');
    const shell = read('src/components/LandingLoop.astro');
    assert.match(formula, /set:html=\{captionMathHtml\(/);
    assert.match(sketch, /set:html=\{captionMathHtml\(/);
    assert.equal(formula.includes('צמודות משלימות לזווית שטוחה'), false);
    assert.match(formula, /captionMathHtml\('זוויות צמודות'\)/);
    assert.match(sketch, /sk-ray--left/);
    assert.match(sketch, /\.sk-ray\s*\{[^}]*stroke:\s*#e6a534/);
    assert.match(shell, /\.ll :global\(\.ll-math\)\s*\{[^}]*unicode-bidi:\s*isolate/);
    assert.match(shell, /\.ll :global\(\.ll-math\)\s*\{[^}]*direction:\s*ltr/);
    assert.match(shell, /\.ll :global\(\.ll-math\)\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('draws y = x² opening upward and never leaves a shape fill unset', () => {
    const sketch = read('src/components/LoopSketch.astro');
    assert.match(sketch, /d="M160 88 Q240 312 320 88"/);
    assert.match(sketch, /\(\{MINUS\}2, 4\)/);
    assert.match(sketch, /\(2, 4\)/);
    assert.match(sketch, /class="sk-box" points="250,118 340,200 160,200"/);
    assert.match(sketch, /24%, 86% \{ transform: scale\(1\); \}/);
    assert.match(sketch, /V = S × ℓ/);
    assert.equal(sketch.includes('y="120" font-size="22">V = S'), false);

    const fillClass =
      /sk-stage|sk-dot|sk-ink-dot|sk-open|sk-ring|sk-box|sk-wedge|sk-ghost-box|sk-ghost|sk-track|sk-fill|sk-cell|sk-disc|sk-col|sk-gift|sk-ink|sk-gold|sk-coral|sk-teal|sk-arrow|sk-ray|sk-bar/;
    const shapes = sketch.match(/<(?:rect|polygon|circle|ellipse|path)\b[^>]*>/g) ?? [];
    assert.ok(shapes.length > 20);
    for (const tag of shapes) {
      const named = tag.match(/class="([^"]*)"/);
      const painted = (named && fillClass.test(named[1])) || /fill="/.test(tag);
      assert.equal(painted, true, tag);
    }
  });

  it('fails when a page file is not classified as a landing or a non-landing', () => {
    const pagesRoot = join(root, 'src/pages');
    for (const abs of astroPages(pagesRoot)) {
      const rel = relative(pagesRoot, abs).split('\\').join('/');
      const src = readFileSync(abs, 'utf8');
      if (src.includes('<TopicPage')) {
        const slug = src.match(/slug="([^"]+)"/)?.[1];
        assert.ok(slug, `${rel} TopicPage is missing a slug`);
        const loop = topicLandingLoop(loadTopicPage(slug));
        assert.ok(loop.marker, rel);
        continue;
      }
      if (src.includes('<GradeHubPage')) {
        assert.match(read('src/components/GradeHubPage.astro'), /data-landing-loop=/);
        continue;
      }
      if (rel === 'index.astro') {
        assert.match(src, /data-landing-loop="hero"/);
        continue;
      }
      if (src.includes('<SitePage')) {
        const slug = src.match(/slug="([^"]+)"/)?.[1];
        assert.ok(slug, rel);
        const marketing = marketingLandingLoop(slug);
        const policy = (NON_LANDING_SITE_SLUGS as readonly string[]).includes(slug);
        assert.ok(marketing || policy, `${rel} site page ${slug} needs a loop or an explicit non-landing mark`);
        if (marketing) {
          assert.match(read('src/components/SitePage.astro'), /<LandingLoop variant=\{marketingLoop\} \/>/);
        }
        continue;
      }
      assert.ok(NON_LANDING_PAGES.has(rel), `${rel} is unclassified — add a data-landing-loop or mark it as not a landing`);
    }
  });
});
