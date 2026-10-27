import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { blogPostDateLabel, hebrewDateLabel } from '../src/lib/hebrewDate';
import { readingTimeLabel } from '../src/lib/readingTime';

describe('blog post visible date (stale "לפני 4 ימים")', () => {
  it('formats the Israel calendar day in Hebrew', () => {
    // 22:18 UTC on 19 Sept is 01:18 on 20 Sept in Israel (UTC+3).
    assert.equal(hebrewDateLabel('2026-09-19T22:18:23.690Z'), '20 בספטמבר 2026');
    assert.equal(hebrewDateLabel('2026-01-05T08:00:00.000Z'), '5 בינואר 2026');
    assert.equal(hebrewDateLabel('not a date'), null);
    assert.equal(hebrewDateLabel(undefined), null);
  });

  it('never shows a stored relative date', () => {
    assert.equal(
      blogPostDateLabel({ datePublished: '2026-08-24T09:00:00.000Z', dateDisplay: 'לפני 4 ימים' }),
      '24 באוגוסט 2026',
    );
    assert.equal(blogPostDateLabel({ dateDisplay: 'לפני 4 ימים' }), null);
    assert.equal(blogPostDateLabel({ dateDisplay: '27 בספט׳' }), '27 בספט׳');
  });

  it('every stored post gets an absolute date', () => {
    const dir = 'src/data/blog-posts';
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    assert.ok(files.length >= 60);
    for (const f of files) {
      const post = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      const label = blogPostDateLabel(post);
      assert.ok(label && /^\d{1,2} ב\S+ \d{4}$/.test(label), `${f}: ${label}`);
    }
  });

  it('reads one minute as "דקה אחת" and leaves other reading times alone', () => {
    assert.equal(readingTimeLabel('זמן קריאה 1 דקות'), 'זמן קריאה דקה אחת');
    assert.equal(readingTimeLabel('זמן קריאה 4 דקות'), 'זמן קריאה 4 דקות');
    assert.equal(readingTimeLabel('זמן קריאה 11 דקות'), 'זמן קריאה 11 דקות');
    assert.equal(readingTimeLabel(''), null);
    const dir = 'src/data/blog-posts';
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const post = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      if (post.readingTime) assert.doesNotMatch(readingTimeLabel(post.readingTime) || '', /(^|\s)1 דקות/, f);
    }
    const tpl = readFileSync('src/components/BlogPostPage.astro', 'utf8');
    assert.ok(tpl.includes('{readingTimeLabel(post.readingTime)}'));
  });

  it('the post template renders the label, not the stored dateDisplay', () => {
    const tpl = readFileSync('src/components/BlogPostPage.astro', 'utf8');
    assert.ok(tpl.includes('const dateLabel = blogPostDateLabel(post);'));
    assert.ok(!tpl.includes('{post.dateDisplay || post.datePublished}'));
    assert.match(tpl, /data-blog-date\s+datetime=\{post\.datePublished \|\| undefined\}/);
  });
});
