import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWorksheetHref, PUBLIC_WORKSHEETS_BASE } from '../worksheetLinks';
import type { CatalogTopic, CatalogV1 } from '../catalog/types';
import {
  searchNorm,
  topicMatchesQuery,
  buildTopicHaystack,
} from '../search';

function minimalCatalog(overrides?: Partial<CatalogV1['config']>): CatalogV1 {
  return {
    contractVersion: 1,
    sourceOfTruth: { path: 'index.html', authoritative: true },
    config: {
      pdfBase: 'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_',
      viewer: { enabled: true, path: 'worksheet-viewer-noam.html' },
      levels: [],
      defaults: { oneLabel: 'דף יחיד — כל הרמות' },
      elementaryGrades: [1, 2, 3, 4, 5, 6],
      middleGrades: [7, 8, 9],
      gradeNames: {},
      gradeEmojis: {},
      trackGroups: [],
      noamPrefixFallback: {},
      ...overrides,
    },
    icons: {},
    searchTerms: {},
    grades: [],
  };
}

function topic(partial: Partial<CatalogTopic> & Pick<CatalogTopic, 'id' | 'title' | 'group' | 'levels' | 'routing'>): CatalogTopic {
  return {
    icon: 'star',
    ...partial,
  };
}

describe('worksheet link construction', () => {
  it('builds viewer URL on public base with one→lv=b, siblings, topic, back', () => {
    const catalog = minimalCatalog();
    const t = topic({
      id: 16,
      title: 'משולש שווה־צלעות',
      group: 'geo',
      levels: [{ key: 'one', label: 'דף יחיד', pdfId: '7d8f7aa1d3c743f896c9ddddb943355e', labelSource: 'default' }],
      routing: {
        resolvedNoamPrefix: 'G7-T16',
        aiHintShown: false,
        usesViewer: true,
        viewerPath: 'worksheet-viewer-noam.html',
        siblingPdfQuery: {},
      },
    });
    const href = buildWorksheetHref({ catalog, grade: 7, topic: t, levelKey: 'one' });
    assert.ok(href.startsWith(PUBLIC_WORKSHEETS_BASE));
    const u = new URL(href);
    assert.equal(u.pathname.endsWith('/worksheet-viewer-noam.html'), true);
    assert.equal(u.searchParams.get('g'), '7');
    assert.equal(u.searchParams.get('x'), 'G7-T16');
    assert.equal(u.searchParams.get('lv'), 'b');
    assert.equal(u.searchParams.get('pdf'), '7d8f7aa1d3c743f896c9ddddb943355e');
    assert.equal(u.searchParams.get('t'), 'משולש שווה־צלעות');
    assert.equal(u.searchParams.get('topic'), '16');
    assert.equal(u.searchParams.get('back'), '/noamdoronmath-worksheets/?grade=7');
  });

  it('builds a/b/c viewer links with sibling pa/pb/pc', () => {
    const catalog = minimalCatalog();
    const t = topic({
      id: 1,
      title: 'נושא לדוגמה',
      group: 'alg',
      levels: [
        { key: 'a', label: 'רמה א׳', pdfId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', labelSource: 'default' },
        { key: 'b', label: 'רמה ב׳', pdfId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', labelSource: 'default' },
        { key: 'c', label: 'מצוינות', pdfId: 'cccccccccccccccccccccccccccccccc', labelSource: 'default' },
      ],
      routing: {
        resolvedNoamPrefix: 'G7-T01',
        aiHintShown: true,
        usesViewer: true,
        viewerPath: 'worksheet-viewer-noam.html',
        siblingPdfQuery: {
          pa: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          pb: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          pc: 'cccccccccccccccccccccccccccccccc',
        },
      },
    });
    const href = buildWorksheetHref({ catalog, grade: 7, topic: t, levelKey: 'a' });
    const u = new URL(href);
    assert.equal(u.searchParams.get('lv'), 'a');
    assert.equal(u.searchParams.get('pa'), 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(u.searchParams.get('pb'), 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.equal(u.searchParams.get('pc'), 'cccccccccccccccccccccccccccccccc');
    assert.ok(!href.includes('localhost'));
    assert.ok(!href.includes('/worksheets?'));
  });

  it('returns direct PDF when viewer is not used', () => {
    const catalog = minimalCatalog();
    const t = topic({
      id: 2,
      title: 'יסודי',
      group: 'num',
      levels: [{ key: 'a', label: 'רמה א׳', pdfId: '0123456789abcdef0123456789abcdef', labelSource: 'default' }],
      routing: {
        resolvedNoamPrefix: null,
        aiHintShown: false,
        usesViewer: false,
        viewerPath: null,
        siblingPdfQuery: {},
      },
    });
    const href = buildWorksheetHref({ catalog, grade: 1, topic: t, levelKey: 'a' });
    assert.equal(
      href,
      'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_0123456789abcdef0123456789abcdef.pdf'
    );
  });
});

describe('hebrew local search', () => {
  it('matches stems and search extras (not english-only substring)', () => {
    const hay = buildTopicHaystack(
      { id: 1, title: 'משוואות עם נעלם', description: 'פתרון צעד אחר צעד', group: 'alg' },
      'אלגברה',
      'נעלמים איזון',
      []
    );
    assert.equal(topicMatchesQuery(hay, 'משוואה'), true);
    assert.equal(topicMatchesQuery(hay, 'נעלם'), true);
    assert.equal(topicMatchesQuery(hay, 'xyzzy'), false);
    assert.ok(searchNorm('גֵּאוֹמֶטְרִיָה').includes('גאומטריה') || searchNorm('גיאומטריה').includes('גאו'));
  });
});
