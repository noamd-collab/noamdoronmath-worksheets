import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatBlogDateDisplay,
  isFrozenRelativeDate,
  resolveBlogDateDisplay,
} from '../src/lib/blogDates';
import { listServedBlogPosts } from '../src/lib/blogPosts';

describe('blog absolute dates', () => {
  it('detects frozen relative Hebrew snapshot strings', () => {
    assert.equal(isFrozenRelativeDate('לפני 7 שעות'), true);
    assert.equal(isFrozenRelativeDate('לפני יומיים (2)'), true);
    assert.equal(isFrozenRelativeDate('14 בספט׳'), false);
    assert.equal(isFrozenRelativeDate('25 בספט׳ 2026'), false);
  });

  it('formats ISO dates in he-IL without relative wording', () => {
    const out = formatBlogDateDisplay('2026-09-25T01:23:04.560Z');
    assert.ok(out.length > 3);
    assert.equal(isFrozenRelativeDate(out), false);
    assert.match(out, /2026|ספט/);
  });

  it('resolves relative dateDisplay to absolute from datePublished', () => {
    const out = resolveBlogDateDisplay('2026-09-25T01:23:04.560Z', 'לפני 7 שעות');
    assert.equal(isFrozenRelativeDate(out), false);
    assert.ok(out.length > 3);
  });

  it('no served post resolves to a relative display date', () => {
    for (const post of listServedBlogPosts()) {
      const display = resolveBlogDateDisplay(post.datePublished, post.dateDisplay);
      assert.equal(isFrozenRelativeDate(display), false, post.fileSlug);
    }
  });
});
