import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import {
  GENERIC_VIEWER_METADATA,
  renderViewerHtmlWithMetadata,
  resolveViewerMetadata,
  type ViewerMetadata,
} from '../src/lib/viewerMetadata';

const fixture = {
  grade: '9',
  topic: '1',
  pdf: 'ec49833022f345f88360f3f5d4a7ab92',
  level: 'a',
};
const catalog = loadCatalog();
const rootViewer = readFileSync('../../worksheet-viewer-noam.html', 'utf8');
const publicViewer = readFileSync('public/worksheet-viewer-noam.html', 'utf8');

function resolve(search: Record<string, string>): ViewerMetadata {
  return resolveViewerMetadata(catalog, new URLSearchParams(search));
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('viewer metadata', () => {
  it('uses the verified catalog identity, never the display-title query', () => {
    const metadata = resolve({
      g: fixture.grade,
      topic: fixture.topic,
      pdf: fixture.pdf,
      lv: fixture.level,
      t: '<img src=x onerror=alert(1)>',
    });

    assert.deepEqual(metadata, {
      title: 'חוק הפילוג המורחב — כיתה ט׳ — רמה א׳ | נועם דורון',
      description: 'דף עבודה במתמטיקה בנושא חוק הפילוג המורחב לכיתה ט׳, רמה א׳, באתר נועם דורון.',
      verified: true,
    });
    assert.ok(!metadata.title.includes('img'));
  });

  it('resolves valid catalog level-switch URLs with their original labels', () => {
    const topic = catalog.grades
      .find((grade) => grade.grade === 9)
      ?.topics.find((candidate) => candidate.id === 1);
    assert.ok(topic);

    for (const level of topic.levels) {
      const metadata = resolve({
        g: '9',
        topic: '1',
        pdf: level.pdfId,
        lv: level.key,
      });
      assert.equal(metadata.verified, true);
      assert.ok(metadata.title.includes(level.label));
      assert.ok(!metadata.title.includes('רמה ג׳'));
    }
  });

  it('uses the truthful generic fallback for grade/PDF/level/topic mismatches', () => {
    const mismatches = [
      { g: '8', topic: fixture.topic, pdf: fixture.pdf, lv: fixture.level },
      { g: fixture.grade, topic: '999', pdf: fixture.pdf, lv: fixture.level },
      { g: fixture.grade, topic: fixture.topic, pdf: fixture.pdf, lv: 'b' },
      { g: fixture.grade, pdf: '0'.repeat(32), t: 'invented topic' },
    ];

    for (const query of mismatches) {
      assert.deepEqual(resolve(query), GENERIC_VIEWER_METADATA);
    }
  });

  it('escapes title text, attribute values, and JSON script data in the head shell', () => {
    const hostile: ViewerMetadata = {
      title: '</title><img src=x onerror=alert(1)>',
      description: '" onmouseover="alert(1) & </script>',
      verified: true,
    };
    const template = [
      '<title>fallback</title>',
      '<meta name="description" data-viewer-description content="fallback">',
      '<meta name="viewer-resource-title" content="">',
      '<meta name="viewer-resource-verified" content="false">',
      '<script id="viewer-resource-metadata" type="application/json">{}</script>',
      '<body>unchanged</body>',
    ].join('');
    const rendered = renderViewerHtmlWithMetadata(template, hostile);

    assert.match(rendered, /&lt;\/title&gt;&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(rendered, /content="&quot; onmouseover=&quot;alert\(1\) &amp; &lt;\/script&gt;"/);
    assert.match(rendered, /\\u003c\/script\\u003e/);
    assert.ok(!rendered.includes('<img src=x onerror=alert(1)>'));
    assert.ok(rendered.endsWith('<body>unchanged</body>'));
  });

  it('keeps the shared generic head guard synchronized and preserves public body/print rendering', () => {
    const headGuard = '<meta name="description" data-viewer-description content="דף עבודה במתמטיקה באתר נועם דורון. בחרו דף עבודה מתאים מתוך קטלוג דפי העבודה.">';
    const staticBootstrap = { ...GENERIC_VIEWER_METADATA, title: '' };
    for (const html of [rootViewer, publicViewer]) {
      assert.ok(html.includes('<title>דף עבודה במתמטיקה | נועם דורון</title>'));
      assert.ok(html.includes(headGuard));
      const bootstrap = html.match(/<script id="viewer-resource-metadata" type="application\/json">([\s\S]*?)<\/script>/);
      assert.ok(bootstrap, 'generic metadata bootstrap must be present');
      assert.equal(bootstrap[1], JSON.stringify(staticBootstrap));
      assert.deepEqual(JSON.parse(bootstrap[1]), staticBootstrap);
      assert.ok(html.includes('var trustedViewerMetadata'));
      assert.match(html, /document\.title\s*=\s*trustedDocumentTitle\s*\|\|\s*"דף עבודה במתמטיקה \| נועם דורון"/);
    }

    const bodyMarkup = publicViewer.slice(publicViewer.indexOf('<body'), publicViewer.indexOf('<script', publicViewer.indexOf('<body')));
    const printStart = publicViewer.lastIndexOf('<style', publicViewer.indexOf('@media print'));
    const printEnd = publicViewer.indexOf('</style>', printStart) + '</style>'.length;
    assert.equal(hash(bodyMarkup), 'dcd74c341c28cf834d8865870c098d6a85eccd6e4279b3d6fc374a94123cf424');
    assert.equal(hash(publicViewer.slice(printStart, printEnd)), '548e2303508a758017ad93a3cc8834088e70ff90b61070840df6f9d0fada4c0f');
  });
});
