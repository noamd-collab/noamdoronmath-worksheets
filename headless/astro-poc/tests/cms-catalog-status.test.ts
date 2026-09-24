/**
 * CMS-43 — catalog CMS contract / status (no live SDK).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildCatalogCmsStatus,
  DEFAULT_CMS_CONNECTIONS,
  HEADLESS_PROJECT,
  summarizeCatalog,
  validateCatalogShape,
} from '../src/lib/cms/catalogCmsContract.ts';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';

describe('CMS-43 catalog CMS contract', () => {
  it('validates live snapshot shape and Wix Media pdfBase', () => {
    const catalog = loadCatalog();
    const v = validateCatalogShape(catalog);
    assert.equal(v.ok, true);
    assert.equal(v.errors.length, 0);
    assert.equal(catalog.contractVersion, 1);
    assert.match(catalog.config.pdfBase, /^https:\/\/static\.wixstatic\.com\//);
  });

  it('status is snapshot-only when collectionId is null', () => {
    const catalog = loadCatalog();
    const status = buildCatalogCmsStatus({
      connections: DEFAULT_CMS_CONNECTIONS,
      catalogRaw: catalog,
    });
    assert.equal(status.ok, true);
    assert.equal(status.liveCmsConnected, false);
    assert.equal(status.liveCmsConfigured, false);
    assert.equal(status.mode, 'snapshot');
    assert.ok(status.missingExternalInput);
    assert.match(status.missingExternalInput, /collectionId/i);
    assert.ok(status.missingPrerequisites.length >= 3);
    assert.ok(status.missingPrerequisites.some((p) => /collectionId/i.test(p)));
    assert.ok(status.missingPrerequisites.some((p) => /adapter/i.test(p)));
    assert.ok(status.missingPrerequisites.some((p) => /durableAuth/i.test(p)));
    assert.equal(status.project.siteId, HEADLESS_PROJECT.siteId);
    assert.ok(status.snapshot.gradeCount && status.snapshot.gradeCount >= 1);
    assert.equal(status.snapshot.pdfBaseIsWixMediaCdn, true);
  });

  it('cms.connections.json does not invent a collectionId', () => {
    const raw = JSON.parse(readFileSync('src/data/cms.connections.json', 'utf8'));
    assert.equal(raw.catalog.collectionId, null);
    assert.equal(raw.catalog.mode, 'snapshot');
  });

  it('rejects invented live mode without collectionId', () => {
    const catalog = loadCatalog();
    const status = buildCatalogCmsStatus({
      connections: {
        updatedAt: null,
        catalog: {
          kind: 'catalog',
          mode: 'cms-live',
          collectionId: null,
          contractVersion: 1,
          note: 'test',
        },
      },
      catalogRaw: catalog,
    });
    assert.equal(status.liveCmsConnected, false);
    assert.equal(status.liveCmsConfigured, false);
    assert.ok(status.missingExternalInput);
  });

  it('does not claim live when collectionId set but mode stays snapshot', () => {
    const catalog = loadCatalog();
    const status = buildCatalogCmsStatus({
      connections: {
        updatedAt: null,
        catalog: {
          kind: 'catalog',
          mode: 'snapshot',
          collectionId: '00000000-0000-0000-0000-000000000000',
          contractVersion: 1,
          note: 'test placeholder id only',
        },
      },
      catalogRaw: catalog,
    });
    assert.equal(status.liveCmsConnected, false);
    assert.equal(status.liveCmsConfigured, false);
    assert.ok(status.missingPrerequisites.some((p) => /cms-live|mode/i.test(p)));
  });

  it('configured collectionId+mode without adapter is NOT liveCmsConnected', () => {
    const catalog = loadCatalog();
    const status = buildCatalogCmsStatus({
      connections: {
        updatedAt: null,
        catalog: {
          kind: 'catalog',
          mode: 'cms-live',
          collectionId: '11111111-1111-1111-1111-111111111111',
          contractVersion: 1,
          note: 'configured id but no adapter / no live read',
        },
      },
      catalogRaw: catalog,
      liveReadAdapterAvailable: false,
      liveReadEvidence: null,
    });
    assert.equal(status.liveCmsConfigured, true);
    assert.equal(status.liveCmsConnected, false);
    assert.equal(status.mode, 'snapshot');
    assert.ok(status.missingPrerequisites.some((p) => /adapter/i.test(p)));
    assert.ok(status.missingPrerequisites.some((p) => /durableAuth/i.test(p)));
    assert.match(
      status.notes.join(' '),
      /configured but liveCmsConnected=false/i
    );
  });

  it('rejects malformed grades:[null] without throwing in summarizeCatalog path', () => {
    const catalog = loadCatalog();
    const malformed = {
      ...catalog,
      grades: [null],
    };
    const v = validateCatalogShape(malformed);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /grades\[0\].*null/i.test(e)));
    assert.equal(v.catalog, null);
    const status = buildCatalogCmsStatus({
      connections: DEFAULT_CMS_CONNECTIONS,
      catalogRaw: malformed,
    });
    assert.equal(status.ok, false);
    assert.equal(status.snapshot.present, false);
    assert.equal(status.snapshot.gradeCount, null);
    assert.ok(status.notes.some((n) => /grades\[0\].*null/i.test(n)));
    // Nested topic null also fails cleanly (no throw through status path).
    const malformedTopic = {
      ...catalog,
      grades: [{ grade: 1, label: 'א', groups: [], topics: [null] }],
    };
    const vt = validateCatalogShape(malformedTopic);
    assert.equal(vt.ok, false);
    assert.ok(vt.errors.some((e) => /topics\[0\].*object/i.test(e)));
    const statusTopic = buildCatalogCmsStatus({
      connections: DEFAULT_CMS_CONNECTIONS,
      catalogRaw: malformedTopic,
    });
    assert.equal(statusTopic.ok, false);
    assert.equal(statusTopic.snapshot.present, false);
    // Defensive: summarizeCatalog is only safe after validate; status never calls it on fail.
    void summarizeCatalog;
  });
});
