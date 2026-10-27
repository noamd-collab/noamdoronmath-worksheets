import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { matchingTopicsLabel, resultCountLabel, topicCountLabel } from '../src/lib/catalog/topicCount';

describe('worksheets catalog count labels (SEO audit נ-11)', () => {
  it('uses the singular for one topic and the plural otherwise', () => {
    assert.equal(topicCountLabel(1), 'נושא אחד');
    assert.equal(topicCountLabel(0), '0 נושאים');
    assert.equal(topicCountLabel(2), '2 נושאים');
    assert.equal(topicCountLabel(43), '43 נושאים');
    assert.equal(matchingTopicsLabel(1), 'נושא אחד תואם');
    assert.equal(matchingTopicsLabel(5), '5 נושאים תואמים');
    assert.equal(resultCountLabel(1), 'תוצאה אחת');
    assert.equal(resultCountLabel(3), '3 תוצאות');
  });

  it('every rendered count in the catalog goes through the helpers', () => {
    const src = readFileSync('src/components/WorksheetsClient.tsx', 'utf8');
    assert.doesNotMatch(src, /\{(?:listTopics|list)\.length\} נושאים/);
    assert.doesNotMatch(src, /\{topLevelCount\} נושאים/);
    assert.doesNotMatch(src, /\$\{visibleCount\} נושאים (?:תואמים|בכיתה|בקבוצה)/);
    assert.doesNotMatch(src, /\$\{other\} תוצאות/);
    assert.ok(src.includes('<span className="count">{topicCountLabel(listTopics.length)}</span>'));
    assert.ok(src.includes('<span className="count">{topicCountLabel(list.length)}</span>'));
  });

  it('topic-code badges on coral and amber use dark ink that passes 4.5:1', () => {
    const src = readFileSync('src/components/WorksheetsClient.tsx', 'utf8');
    assert.ok(src.includes("const badgeInk = ({ m10: '#1d1c19', m11: '#1d1c19' } as Record<string, string>)[topic.group];"));
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const bg of ['#e5735c', '#c98a1a']) assert.ok(ratio('#1d1c19', bg) >= 4.5, bg);
    for (const bg of ['#2a7c7a', '#22305a']) assert.ok(ratio('#ffffff', bg) >= 4.5, bg);
  });
});
