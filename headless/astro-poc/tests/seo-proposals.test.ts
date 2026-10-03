/**
 * SEO proposals are review copy. The layout may use a row only when approved is true.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { approvedSeoProposal, listSeoProposals } from '../src/lib/seoProposals';

const items = listSeoProposals();

describe('seo proposals', () => {
  it('covers 328 catalog topics and 60 posts, all unapproved, within length limits', () => {
    const topics = items.filter((item) => item.kind !== 'blog-post');
    const posts = items.filter((item) => item.kind === 'blog-post');
    assert.ok(topics.length >= 328, `topics ${topics.length}`);
    assert.equal(posts.length, 60);
    assert.equal(items.filter((item) => item.approved).length, 0);
    for (const item of items) {
      assert.ok([...item.title].length <= 60, item.path);
      assert.ok([...item.description].length <= 155, item.path);
      assert.ok(item.title.length > 0 && item.description.length > 0, item.path);
    }
    const csv = readFileSync(new URL('../seo-review.csv', import.meta.url), 'utf8');
    assert.match(csv, /^נתיב,סוג,כותרת נוכחית,כותרת מוצעת/);
    assert.equal(csv.trim().split('\n').length, items.length + 1);
  });

  it('triangle-area proposal follows the page h1, not the mismatched live title', () => {
    const row = items.find((item) => item.path === '/triangle-area-grade-7');
    assert.ok(row?.currentTitle);
    assert.match(row.currentTitle, /מפשטים ואז פותרים/);
    assert.doesNotMatch(row.title, /מפשטים ואז פותרים/);
    assert.match(row.title, /שטח משולש/);
    assert.equal(row.approved, false);
  });

  it('layout lookup ignores unapproved rows', () => {
    assert.equal(approvedSeoProposal('/triangle-area-grade-7'), null);
    assert.equal(approvedSeoProposal(undefined), null);
    const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
    assert.match(layout, /approvedSeoProposal\(seoPath\)/);
  });
});
