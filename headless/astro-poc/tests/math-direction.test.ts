/**
 * RTL math isolates (U+2066 LRI … U+2069 PDI) for topic pages and blog posts.
 * Stored JSON stays unchanged; isolates are applied when the page is loaded.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isolateBlogPostDisplay, isolateMathRuns } from '../src/lib/mathDirection.ts';
import { listServedBlogPosts } from '../src/lib/blogPosts.ts';
import { synthesizeBodyFlow, loadTopicPage } from '../src/lib/topicPages.ts';
import { contentToParitySnapshot } from '../src/lib/parity/contentToParitySnapshot.ts';
import { cleanText, diffTopicParity, type TopicParitySnapshot } from '../src/lib/parity/topicParity.ts';

const LRI = '\u2066';
const PDI = '\u2069';

function bare(s: string): string {
  return s.replace(/[\u2066\u2069]/g, '');
}

describe('isolateMathRuns', () => {
  it('wraps a pure-math paragraph as one LTR isolate', () => {
    const src = '(−3) − (−5) = (−3) + 5 = 2';
    const out = isolateMathRuns(src);
    assert.equal(out, `${LRI}${src}${PDI}`);
    assert.equal(bare(out), src);
  });

  it('isolates the math run inside a Hebrew question', () => {
    const out = isolateMathRuns('מהו (−7)+4?');
    assert.equal(out, `מהו ${LRI}(−7)+4${PDI}?`);
  });

  it('keeps Hebrew around separate number runs', () => {
    const src = 'התשובה היא −3, כי מתקדמים 4 צעדים ימינה מ־−7.';
    const out = isolateMathRuns(src);
    assert.equal(bare(out), src);
    assert.ok(out.includes(`${LRI}−3${PDI}`));
    assert.ok(out.includes(`${LRI}4${PDI}`));
    assert.ok(out.includes(`${LRI}−7${PDI}`));
    assert.ok(!out.includes(`${LRI}מ`));
  });

  it('keeps an equation with operators as one run', () => {
    assert.equal(isolateMathRuns('12×5÷2=30'), `${LRI}12×5÷2=30${PDI}`);
    assert.equal(isolateMathRuns('a²+b²=c²'), `${LRI}a²+b²=c²${PDI}`);
    assert.equal(isolateMathRuns('(180−40):2=70'), `${LRI}(180−40):2=70${PDI}`);
    assert.equal(isolateMathRuns('|−7| = 7'), `${LRI}|−7| = 7${PDI}`);
  });

  it('is idempotent and leaves Hebrew prose unchanged', () => {
    const hebrew = 'דפי העבודה פתוחים בחינם וללא הרשמה.';
    assert.equal(isolateMathRuns(hebrew), hebrew);
    const once = isolateMathRuns('מהו (−7)+4?');
    assert.equal(isolateMathRuns(once), once);
  });
});

describe('topic pages apply math isolates without rewriting JSON', () => {
  it('signed-numbers body flow isolates the mirrored examples', () => {
    const raw = readFileSync('src/data/topic-pages/signed-numbers-grade-7.json', 'utf8');
    assert.equal(raw.includes(LRI), false);
    assert.equal(raw.includes(PDI), false);

    const page = loadTopicPage('signed-numbers-grade-7');
    const flow = synthesizeBodyFlow(page);
    const eq = flow.find((b) => b.type === 'paragraph' && bare(b.text) === '(−3) − (−5) = (−3) + 5 = 2');
    const q = flow.find((b) => b.type === 'paragraph' && bare(b.text) === 'מהו (−7)+4?');
    assert.ok(eq && eq.type === 'paragraph');
    assert.ok(q && q.type === 'paragraph');
    assert.equal(eq.text, `${LRI}(−3) − (−5) = (−3) + 5 = 2${PDI}`);
    assert.equal(q.text, `מהו ${LRI}(−7)+4${PDI}?`);
    assert.equal(
      page.sections.flatMap((s) => s.blocks).find((b) => b.text?.includes('−5'))?.text,
      '(−3) − (−5) = (−3) + 5 = 2'
    );
  });

  it('parity comparison ignores the isolates', () => {
    const page = loadTopicPage('signed-numbers-grade-7');
    const preview = contentToParitySnapshot(page, 'preview');
    const source = JSON.parse(
      readFileSync('tests/fixtures/topic-parity/signed-numbers-grade-7.production.json', 'utf8')
    ) as TopicParitySnapshot;
    const diffs = diffTopicParity(source, preview).filter((d) => d.severity === 'error');
    assert.deepEqual(
      diffs.map((d) => d.field),
      []
    );
    const eq = preview.bodyFlow?.find(
      (b) => b.type === 'paragraph' && b.text.includes('−5')
    );
    assert.ok(eq && eq.type === 'paragraph' && eq.text.includes(LRI));
    assert.equal(cleanText(eq.text), '(−3) − (−5) = (−3) + 5 = 2');
  });
});

describe('blog posts isolate math at display time', () => {
  it('wraps inline equations and leaves the stored post untouched', () => {
    const post = listServedBlogPosts().find((p) => p.fileSlug === 'order-of-operations-guide');
    assert.ok(post);
    const raw = JSON.stringify(post.blocks);
    assert.equal(raw.includes(LRI), false);
    const view = isolateBlogPostDisplay(post);
    const formula = view.blocks.find((b) => b.type === 'p' && bare(b.text) === '`8 + 2 × 3`');
    assert.ok(formula && formula.type === 'p');
    assert.ok(formula.text.includes(`${LRI}8 + 2 × 3${PDI}`));
    const tpl = readFileSync('src/components/BlogPostPage.astro', 'utf8');
    assert.ok(tpl.includes('isolateBlogPostDisplay'));
  });
});
