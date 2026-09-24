/**
 * CMS-43 — catalog CMS contract (read-path readiness).
 *
 * Established schema: headless/catalog/catalog.schema.json + CatalogV1.
 * Runtime today: in-repo snapshot via loadCatalog() — NOT live Wix CMS.
 *
 * Do NOT invent Wix collection names/IDs here. When a collection exists on
 * Headless site df6b8141-…, record its ID in src/data/cms.connections.json
 * (collectionId only) and wire @wix/data in a later authorized milestone.
 *
 * liveCmsConnected requires successful live-read evidence — configured ID ≠ connected.
 */
import type { CatalogGrade, CatalogTopic, CatalogV1 } from '../catalog/types';

/** Public Headless project identifiers (not secrets). */
export const HEADLESS_PROJECT = {
  siteId: 'df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46',
  appId: 'e774b8bf-6d43-4041-ae2d-82b04ba6e9e3',
  /** Production Studio metaSite that owns Forms / legal HTML — not Headless CMS. */
  productionStudioMetaSiteId: '36dd9544-acf9-4e85-a01a-798f3c1efbb9',
} as const;

export type CatalogCmsMode = 'snapshot' | 'cms-live';

export type CatalogCmsConnection = {
  /** Always "catalog" — logical content kind, not a Wix collection name. */
  kind: 'catalog';
  mode: CatalogCmsMode;
  /**
   * Wix Data collection ID when live CMS is authorized.
   * null = not connected; do not invent.
   */
  collectionId: string | null;
  contractVersion: 1;
  note: string;
};

export type CatalogCmsConnectionsFile = {
  updatedAt: string | null;
  catalog: CatalogCmsConnection;
};

export const DEFAULT_CMS_CONNECTIONS: CatalogCmsConnectionsFile = {
  updatedAt: null,
  catalog: {
    kind: 'catalog',
    mode: 'snapshot',
    collectionId: null,
    contractVersion: 1,
    note:
      'Catalog served from src/data/catalog.v1.json snapshot. Live Wix CMS not connected — no collectionId configured.',
  },
};

/** Field map for a future CMS item — mirrors catalog.schema.json / CatalogV1. */
export const CATALOG_CMS_FIELD_CONTRACT = {
  contractVersion: { required: true, type: 'integer', const: 1 },
  sourceOfTruth: { required: true, type: 'object' },
  config: {
    required: true,
    requiredKeys: [
      'pdfBase',
      'viewer',
      'levels',
      'defaults',
      'elementaryGrades',
      'middleGrades',
      'gradeNames',
      'gradeEmojis',
      'trackGroups',
      'noamPrefixFallback',
    ],
  },
  icons: { required: true, type: 'object' },
  searchTerms: { required: true, type: 'object' },
  grades: { required: true, type: 'array' },
} as const;

/** Proposed CMS collection field mapping (documentation only — not created). */
export const PROPOSED_CATALOG_CMS_SCHEMA = {
  logicalKind: 'catalog',
  contractVersion: 1,
  sourceContract: 'headless/catalog/catalog.schema.json',
  /** Prefer one document holding full CatalogV1 JSON (matches current snapshot). */
  recommendedShape: 'single-document-catalog-v1',
  fields: [
    { key: 'contractVersion', type: 'number', required: true },
    { key: 'sourceOfTruth', type: 'object', required: true },
    { key: 'config', type: 'object', required: true },
    { key: 'icons', type: 'object', required: true },
    { key: 'searchTerms', type: 'object', required: true },
    { key: 'grades', type: 'array', required: true },
  ],
  pdfPolicy: 'Store pdfBase + per-level pdfId only; never embed PDF bytes; Wix Media CDN remains SoT.',
  importPlan:
    'Idempotent: stage CatalogV1 from authoritative catalog → validate → upsert single CMS item by fixed key; never wipe unknown collections; dry-run before write.',
} as const;

export type LiveCmsReadEvidence = {
  /** True only after an actual successful live CMS read this run. */
  success: boolean;
  collectionId: string;
  readAt?: string;
  itemCount?: number;
  note?: string;
};

export type CatalogCmsStatus = {
  ok: boolean;
  mode: CatalogCmsMode;
  /** True only when liveReadEvidence.success — never from config alone. */
  liveCmsConnected: boolean;
  /** Config has collectionId + mode cms-live, but adapter may still be missing. */
  liveCmsConfigured: boolean;
  project: typeof HEADLESS_PROJECT;
  connection: CatalogCmsConnection;
  snapshot: {
    present: boolean;
    contractVersion: number | null;
    gradeCount: number | null;
    topicCount: number | null;
    pdfBaseHost: string | null;
    pdfBaseIsWixMediaCdn: boolean | null;
  };
  /** Multiple honest prerequisites for live CMS. */
  missingPrerequisites: string[];
  /** First prerequisite (compat); prefer missingPrerequisites. */
  missingExternalInput: string | null;
  notes: string[];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validateTopic(topic: unknown, path: string, errors: string[]) {
  if (!isPlainObject(topic)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof topic.id !== 'number') errors.push(`${path}.id must be a number`);
  if (typeof topic.title !== 'string' || !topic.title) errors.push(`${path}.title must be a non-empty string`);
  if (typeof topic.group !== 'string') errors.push(`${path}.group must be a string`);
  if (typeof topic.icon !== 'string') errors.push(`${path}.icon must be a string`);
  if (!Array.isArray(topic.levels)) errors.push(`${path}.levels must be an array`);
  if (!isPlainObject(topic.routing)) errors.push(`${path}.routing must be an object`);
}

function validateGrade(grade: unknown, index: number, errors: string[]) {
  const path = `grades[${index}]`;
  if (grade == null) {
    errors.push(`${path} must not be null`);
    return;
  }
  if (!isPlainObject(grade)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof grade.grade !== 'number') errors.push(`${path}.grade must be a number`);
  if (typeof grade.label !== 'string' || !grade.label) errors.push(`${path}.label must be a non-empty string`);
  if (!Array.isArray(grade.groups)) errors.push(`${path}.groups must be an array`);
  if (!Array.isArray(grade.topics)) {
    errors.push(`${path}.topics must be an array`);
    return;
  }
  grade.topics.forEach((t, i) => validateTopic(t, `${path}.topics[${i}]`, errors));
}

export function validateCatalogShape(data: unknown): {
  ok: boolean;
  errors: string[];
  catalog: CatalogV1 | null;
} {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['catalog is not an object'], catalog: null };
  }
  const c = data as Record<string, unknown>;
  if (c.contractVersion !== 1) errors.push('contractVersion must be 1');
  if (!c.sourceOfTruth || typeof c.sourceOfTruth !== 'object') {
    errors.push('sourceOfTruth missing');
  }
  if (!c.config || typeof c.config !== 'object') errors.push('config missing');
  else {
    const cfg = c.config as Record<string, unknown>;
    for (const k of CATALOG_CMS_FIELD_CONTRACT.config.requiredKeys) {
      if (!(k in cfg)) errors.push(`config.${k} missing`);
    }
  }
  if (!c.icons || typeof c.icons !== 'object') errors.push('icons missing');
  if (!c.searchTerms || typeof c.searchTerms !== 'object') errors.push('searchTerms missing');
  if (!Array.isArray(c.grades)) errors.push('grades must be an array');
  else if (c.grades.length === 0) errors.push('grades must be a non-empty array');
  else c.grades.forEach((g, i) => validateGrade(g, i, errors));

  if (errors.length) return { ok: false, errors, catalog: null };
  return { ok: true, errors: [], catalog: data as CatalogV1 };
}

export function summarizeCatalog(catalog: CatalogV1) {
  const topicCount = catalog.grades.reduce((n, g: CatalogGrade) => {
    const topics: CatalogTopic[] = Array.isArray(g?.topics) ? g.topics : [];
    return n + topics.length;
  }, 0);
  let pdfHost: string | null = null;
  try {
    pdfHost = new URL(catalog.config.pdfBase).host;
  } catch {
    pdfHost = null;
  }
  return {
    contractVersion: catalog.contractVersion,
    gradeCount: catalog.grades.length,
    topicCount,
    pdfBaseHost: pdfHost,
    pdfBaseIsWixMediaCdn: pdfHost === 'static.wixstatic.com',
  };
}

export function buildCatalogCmsStatus(opts: {
  connections: CatalogCmsConnectionsFile;
  catalogRaw: unknown;
  /** Optional evidence from an actual live CMS read. Config alone never sets connected. */
  liveReadEvidence?: LiveCmsReadEvidence | null;
  /** Explicit: live read adapter module is present and callable. */
  liveReadAdapterAvailable?: boolean;
}): CatalogCmsStatus {
  const { connections, catalogRaw, liveReadEvidence = null, liveReadAdapterAvailable = false } =
    opts;
  const connection = connections.catalog || DEFAULT_CMS_CONNECTIONS.catalog;
  const validated = validateCatalogShape(catalogRaw);
  const notes: string[] = [];
  const summary = validated.catalog
    ? summarizeCatalog(validated.catalog)
    : {
        contractVersion: null,
        gradeCount: null,
        topicCount: null,
        pdfBaseHost: null,
        pdfBaseIsWixMediaCdn: null,
      };

  if (!validated.ok) notes.push(...validated.errors.map((e) => `shape: ${e}`));

  const hasCollectionId =
    typeof connection.collectionId === 'string' && connection.collectionId.trim().length > 0;
  const liveCmsConfigured = connection.mode === 'cms-live' && hasCollectionId;

  // Configured ≠ connected. Require successful live read evidence.
  const liveCmsConnected = !!(
    liveCmsConfigured &&
    liveReadAdapterAvailable &&
    liveReadEvidence &&
    liveReadEvidence.success &&
    liveReadEvidence.collectionId === connection.collectionId
  );

  const missingPrerequisites: string[] = [];
  if (!hasCollectionId) {
    missingPrerequisites.push(
      'collectionId: Wix CMS collection for worksheet catalog on Headless site df6b8141-… (create to match catalog.v1 / catalog.schema.json, then set src/data/cms.connections.json — do not invent the name/ID)'
    );
  }
  if (!liveReadAdapterAvailable) {
    missingPrerequisites.push(
      'adapter: install/wire authorized @wix/data (or equivalent) read adapter — none present today'
    );
  }
  if (hasCollectionId && connection.mode !== 'cms-live') {
    missingPrerequisites.push(
      'mode: set catalog.mode to "cms-live" only after collectionId + adapter + durable auth are ready'
    );
  }
  missingPrerequisites.push(
    'durableAuth: server-only runtime credential for Headless site (never CLI session token / never browser-exposed secret)'
  );
  if (liveCmsConfigured && !liveCmsConnected) {
    notes.push(
      'collectionId/mode configured but liveCmsConnected=false until a successful live read proves the adapter works.'
    );
  }
  if (!liveCmsConnected) {
    notes.push('Live CMS read path not proven — snapshot remains source for Headless catalog.');
  } else {
    notes.push(
      `Live CMS read OK for collectionId=${liveReadEvidence?.collectionId} items=${liveReadEvidence?.itemCount ?? '?'}`
    );
  }

  if (summary.pdfBaseIsWixMediaCdn === false) {
    notes.push('pdfBase is not static.wixstatic.com — investigate before cutover.');
  }

  const ok =
    validated.ok && (summary.pdfBaseIsWixMediaCdn === true || summary.pdfBaseIsWixMediaCdn === null);

  return {
    ok,
    mode: liveCmsConnected ? 'cms-live' : 'snapshot',
    liveCmsConnected,
    liveCmsConfigured,
    project: HEADLESS_PROJECT,
    connection: {
      ...connection,
      // Do not rewrite configured mode when merely configured; mode string reflects connection file.
    },
    snapshot: {
      present: validated.ok,
      ...summary,
    },
    missingPrerequisites: liveCmsConnected ? [] : missingPrerequisites,
    missingExternalInput: liveCmsConnected ? null : missingPrerequisites[0] || null,
    notes,
  };
}
