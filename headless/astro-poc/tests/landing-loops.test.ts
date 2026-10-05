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
  CSS_LOOP_VARIANTS,
  GRADE_CONCEPT_LOOP,
  LOOP_FORMULAS,
  MARKETING_LANDING_LOOPS,
  MINUS,
  NON_LANDING_SITE_SLUGS,
  formulaMarkup,
  marketingLandingLoop,
  signedLabel,
  topicLandingLoop,
} from '../src/lib/landingLoops.ts';
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
    const counts = { concept: 0, css: 0 };
    for (const slug of TOPIC_PAGE_SLUGS) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.ok(loop.marker, slug);
      assert.equal(loop.marker.length > 0, true, slug);
      counts[loop.kind] += 1;
      if (loop.kind === 'css') {
        assert.ok(CSS_LOOP_VARIANTS.includes(loop.variant), `${slug} variant ${loop.variant}`);
      }
    }
    assert.equal(counts.concept + counts.css, TOPIC_PAGE_SLUGS.length);
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
    assert.equal(topicLandingLoop(loadTopicPage('exponent-rules-grade-9')).variant, 'powers');
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
    assert.match(loop, /prefers-reduced-motion:\s*reduce/);
    assert.match(loop, /html\.nd-motion-off/);
    assert.match(loop, /html\.noam-a11y-motion/);
    assert.match(loop, /IntersectionObserver/);
    assert.match(loop, /ll--off/);
    assert.match(loop, /animation-play-state:\s*paused/);
    assert.doesNotMatch(loop, /<video\b|lottie|gsap|bodymovin/i);
    for (const variant of CSS_LOOP_VARIANTS) {
      assert.ok(loop.includes(`variant === '${variant}'`), `missing scene ${variant}`);
    }
  });

  it('glues exponents to the base and uses a real minus', () => {
    assert.equal(MINUS, '\u2212');
    assert.equal(formulaMarkup(LOOP_FORMULAS.powers), `(${MINUS}3)<sup>2</sup> = 9`);
    assert.equal(formulaMarkup(LOOP_FORMULAS.powersExpand), `(${MINUS}3) × (${MINUS}3)`);
    assert.equal(formulaMarkup(LOOP_FORMULAS.signed), `${MINUS}2 + 5 = 3`);
    assert.equal(formulaMarkup(LOOP_FORMULAS.circleArea), 'S = πr<sup>2</sup>');
    assert.equal(formulaMarkup(LOOP_FORMULAS.cylinder), 'V = πr<sup>2</sup>h');
    assert.equal(formulaMarkup(LOOP_FORMULAS.parabola), 'y = x<sup>2</sup>');
    assert.equal(formulaMarkup(LOOP_FORMULAS.toolsCube), '2<sup>3</sup> = 8');
    assert.equal(signedLabel(-2), `${MINUS}2`);
    assert.equal(signedLabel(4), '4');

    for (const [name, formula] of Object.entries(LOOP_FORMULAS)) {
      const html = formulaMarkup(formula);
      assert.equal(html.includes('-'), false, `${name} uses hyphen-minus`);
      assert.equal(/\s<sup>/.test(html), false, `${name} has space before <sup>`);
      if (formula.sup) assert.match(html, /[^\s]<sup>/, name);
    }

    const loop = read('src/components/LandingLoop.astro');
    assert.match(loop, /\{LOOP_FORMULAS\.powers\.base\}<sup class="ll-sup">/);
    assert.match(loop, /\{LOOP_FORMULAS\.circleArea\.base\}<sup>/);
    assert.match(loop, /\{LOOP_FORMULAS\.cylinder\.base\}<sup>/);
    assert.match(loop, /\{LOOP_FORMULAS\.parabola\.base\}<sup>/);
    assert.match(loop, /\{LOOP_FORMULAS\.toolsCube\.base\}<sup>/);
    assert.doesNotMatch(loop, /\(-3\)|πr²|x²|2³|>-2 /);
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
