/**
 * Schema.org JSON-LD for the cut-over.
 * FAQ and reviews are not generated here. Callers emit FAQ only from visible Q&A.
 */
import { gradeHubLabel, isGradeHubGrade } from './gradeHubs';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';

export type Crumb = { name: string; path: string };
type JsonLdNode = Record<string, unknown>;

/** One id per site entity, so every page names the same publisher and website. */
export const SITE_ORGANIZATION_ID = `${SITE_CANONICAL_ORIGIN}/#organization`;
export const SITE_WEBSITE_ID = `${SITE_CANONICAL_ORIGIN}/#website`;
const SITE_HOME_URL = `${SITE_CANONICAL_ORIGIN}/`;
const SITE_NAME = 'נועם דורון מתמטיקה';
const SITE_LOGO = `${SITE_CANONICAL_ORIGIN}/brand/noam-doron-math-logo-cropped.png`;

/** Ministry of Education middle-school mathematics curriculum (educationalAlignment target). */
export const CURRICULUM_FRAMEWORK = 'תוכנית הלימודים במתמטיקה לחטיבת הביניים';
export const CURRICULUM_TARGET_URL =
  'https://pop.education.gov.il/tchumey_daat/matmatika/chativat-beynayim/teaching-mathematics/tohnit-limudim/';
export const ALIGNMENT_TYPES = ['teaches', 'educationalSubject'] as const;
export type CurriculumAlignmentType = (typeof ALIGNMENT_TYPES)[number];

/**
 * LRI, RLI, FSI and PDI. Visible text keeps them for RTL math runs; JSON-LD is
 * read by machines, so they only corrupt names and answers there.
 */
const BIDI_ISOLATES = /[\u2066-\u2069]/g;

export function stripBidiIsolates(text: string): string {
  return text.replace(BIDI_ISOLATES, '');
}

/** Deep copy with every string free of bidi isolate controls. */
export function stripJsonLdBidi<T>(value: T): T {
  if (typeof value === 'string') return stripBidiIsolates(value) as T;
  if (Array.isArray(value)) return value.map((item) => stripJsonLdBidi(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = stripJsonLdBidi(item);
    }
    return out as T;
  }
  return value;
}

/**
 * The site publisher. Topic pages, hubs and the catalog name it; the home page
 * defines the same @id with the facts siteIdentityJsonLd merges in.
 */
export function sitePublisherNode(): JsonLdNode {
  return {
    '@type': 'EducationalOrganization',
    '@id': SITE_ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_HOME_URL,
    logo: SITE_LOGO,
  };
}

/** The one WebSite. Its name matches the WebSite block Wix adds to the home page head. */
export function siteWebSiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': SITE_WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_HOME_URL,
    inLanguage: 'he',
    publisher: { '@id': SITE_ORGANIZATION_ID },
  };
}

const ORGANIZATION_TYPES = ['Organization', 'EducationalOrganization', 'LocalBusiness'];
const ORGANIZATION_FACTS = ['image', 'address', 'subjectOf', 'sameAs', 'description'];

function oneOrMany(values: Set<string>): string | string[] | undefined {
  const list = [...values];
  if (list.length === 0) return undefined;
  return list.length === 1 ? list[0] : list;
}

/**
 * The home page's identity blocks (LocalBusiness, WebSite,
 * EducationalOrganization, Organization) describe one organization and one
 * website. Merge them into one EducationalOrganization and one WebSite in a
 * single graph, linked by @id. Their facts (image, address, about page) and
 * other names (alternateName) are kept. Any other block joins the graph.
 */
export function siteIdentityJsonLd(blocks: readonly JsonLdNode[]): JsonLdNode {
  const organization: JsonLdNode = sitePublisherNode();
  const website: JsonLdNode = siteWebSiteNode();
  const organizationNames = new Set<string>();
  const websiteNames = new Set<string>();
  const others: JsonLdNode[] = [];
  for (const block of blocks) {
    const types = jsonLdTypes(block);
    const names = [block.name, block.alternateName].flat().filter((n): n is string => typeof n === 'string');
    if (types.includes('WebSite')) {
      names.forEach((name) => websiteNames.add(name));
    } else if (types.some((type) => ORGANIZATION_TYPES.includes(type))) {
      names.forEach((name) => organizationNames.add(name));
      for (const key of ORGANIZATION_FACTS) {
        if (block[key] !== undefined && organization[key] === undefined) organization[key] = block[key];
      }
    } else {
      const { '@context': _context, ...node } = block;
      others.push(node);
    }
  }
  organizationNames.delete(SITE_NAME);
  websiteNames.delete(SITE_NAME);
  const organizationAlternate = oneOrMany(organizationNames);
  const websiteAlternate = oneOrMany(websiteNames);
  if (organizationAlternate) organization.alternateName = organizationAlternate;
  if (websiteAlternate) website.alternateName = websiteAlternate;
  return stripJsonLdBidi({
    '@context': 'https://schema.org',
    '@graph': [organization, website, ...others],
  });
}

/** Students of the page's grade, from the same label as educationalLevel. */
export function educationalAudience(educationalLevel: string): JsonLdNode {
  return {
    '@type': 'EducationalAudience',
    educationalRole: 'student',
    audienceType: `תלמידי ${stripBidiIsolates(educationalLevel)}`,
  };
}

export function curriculumAlignmentObject(input: {
  targetName: string;
  alignmentType: CurriculumAlignmentType;
  /** The track the unit belongs to, for example "כיתה ט׳ · תוכנית מצומצמת". */
  targetDescription?: string;
}): JsonLdNode {
  return {
    '@type': 'AlignmentObject',
    alignmentType: input.alignmentType,
    educationalFramework: CURRICULUM_FRAMEWORK,
    targetName: stripBidiIsolates(input.targetName),
    ...(input.targetDescription ? { targetDescription: stripBidiIsolates(input.targetDescription) } : {}),
    targetUrl: CURRICULUM_TARGET_URL,
  };
}

/** One printable worksheet file. */
export function pdfMediaObject(input: { name: string; contentUrl: string }): JsonLdNode {
  return {
    '@type': 'MediaObject',
    name: stripBidiIsolates(input.name),
    encodingFormat: 'application/pdf',
    contentUrl: input.contentUrl,
    inLanguage: 'he',
    isAccessibleForFree: true,
  };
}

export function absolutePageUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_CANONICAL_ORIGIN}${normalized === '/' ? '/' : normalized}`;
}

export function educationalLevelForGrade(grade: number): string {
  if (isGradeHubGrade(grade)) return `כיתה ${gradeHubLabel(grade)}`;
  return `כיתה ${grade}`;
}

export function breadcrumbList(crumbs: readonly Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: stripBidiIsolates(crumb.name),
      item: absolutePageUrl(crumb.path),
    })),
  };
}

export function learningResourceJsonLd(input: {
  name: string;
  path: string;
  description: string;
  educationalLevel: string;
  learningResourceType?: string;
  /** ISO date that matches the page's visible update line. Omitted when unknown. */
  dateModified?: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: stripBidiIsolates(input.name),
    url: absolutePageUrl(input.path),
    description: stripBidiIsolates(input.description),
    educationalLevel: stripBidiIsolates(input.educationalLevel),
    audience: educationalAudience(input.educationalLevel),
    learningResourceType: input.learningResourceType || 'דפי עבודה',
    inLanguage: 'he',
    isAccessibleForFree: true,
    publisher: sitePublisherNode(),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  };
}

export interface LearningResourceEnrichment {
  educationalLevel: string;
  /** Official curriculum units for this page; empty when none is known. */
  alignment: Array<{ targetName: string; alignmentType: CurriculumAlignmentType; targetDescription?: string }>;
  /** Official unit names the page teaches. Added after any authored teaches value. */
  teaches: string[];
  /** Used only when the node has no teaches and no official unit is taught. */
  teachesFallback: string[];
  /** Printable PDF files the page links to. */
  pdfParts: Array<{ name: string; contentUrl: string }>;
}

function isGraphBlock(block: JsonLdNode): boolean {
  return Array.isArray(block['@graph']);
}

function nodeHasType(node: JsonLdNode, type: string): boolean {
  const value = node['@type'];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/**
 * Final JSON-LD for a topic page: every LearningResource gets its audience,
 * curriculum alignment, what it teaches, its PDF files and the site publisher.
 * Inside an @graph the publisher is an @id reference and the graph defines the
 * node once; a stand-alone block keeps the node inline. Bidi isolates are removed.
 */
export function enrichLearningResourceJsonLd(
  blocks: readonly JsonLdNode[],
  input: LearningResourceEnrichment,
): JsonLdNode[] {
  const enrich = (node: JsonLdNode, inGraph: boolean): JsonLdNode => {
    if (!nodeHasType(node, 'LearningResource')) return node;
    const out: JsonLdNode = { ...node };
    out.audience ??= educationalAudience(String(out.educationalLevel || input.educationalLevel));
    if (input.alignment.length) out.educationalAlignment = input.alignment.map(curriculumAlignmentObject);
    const authored = [out.teaches].flat().filter((t): t is string => typeof t === 'string' && !!t);
    const taught = [...new Set([...authored, ...(input.teaches.length || authored.length ? input.teaches : input.teachesFallback)])];
    if (taught.length > authored.length) out.teaches = taught.length === 1 ? taught[0] : taught;
    if (input.pdfParts.length) out.hasPart = input.pdfParts.map(pdfMediaObject);
    out.publisher = inGraph ? { '@id': SITE_ORGANIZATION_ID } : sitePublisherNode();
    return out;
  };
  const result = blocks.map((block) => {
    if (!isGraphBlock(block)) return enrich(block, false);
    const graph = (block['@graph'] as JsonLdNode[]).map((node) => enrich(node, true));
    const referencesPublisher = graph.some(
      (node) => (node.publisher as JsonLdNode | undefined)?.['@id'] === SITE_ORGANIZATION_ID,
    );
    if (referencesPublisher && !graph.some((node) => node['@id'] === SITE_ORGANIZATION_ID)) {
      graph.push(sitePublisherNode());
    }
    return { ...block, '@graph': graph };
  });
  return stripJsonLdBidi(result);
}

/** BlogPosting is the Article type already stored on posts. This is the fallback. */
export function articleJsonLd(input: {
  headline: string;
  path: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: stripBidiIsolates(input.headline),
    description: stripBidiIsolates(input.description),
    mainEntityOfPage: absolutePageUrl(input.path),
    inLanguage: 'he',
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: {
      '@type': 'Person',
      name: 'נועם דורון',
      url: `${SITE_CANONICAL_ORIGIN}/aboutus`,
    },
  };
}

export function jsonLdTypes(value: unknown): string[] {
  const nodes: unknown[] = [];
  if (Array.isArray(value)) nodes.push(...value);
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    nodes.push(record);
    if (Array.isArray(record['@graph'])) nodes.push(...record['@graph']);
  }
  const types: string[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const type = (node as Record<string, unknown>)['@type'];
    if (typeof type === 'string') types.push(type);
    else if (Array.isArray(type)) types.push(...type.filter((item) => typeof item === 'string'));
  }
  return types;
}

/**
 * Walk a JSON-LD document. Nodes inside `@graph` inherit the parent `@context`.
 */
export function validateJsonLdDocument(value: unknown): string[] {
  const errors: string[] = [];
  const visit = (node: unknown, inheritedContext: boolean) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, inheritedContext);
      return;
    }
    const record = node as Record<string, unknown>;
    const hasContext =
      typeof record['@context'] === 'string' && String(record['@context']).includes('schema.org');
    if (Array.isArray(record['@graph'])) {
      if (!hasContext && !inheritedContext) errors.push('graph missing @context');
      for (const child of record['@graph']) visit(child, hasContext || inheritedContext);
      return;
    }
    if (typeof record['@type'] !== 'string' || !record['@type']) return;
    const check =
      hasContext || inheritedContext
        ? { ...record, '@context': record['@context'] || 'https://schema.org' }
        : record;
    errors.push(...validateJsonLdNode(check));
  };
  visit(value, false);
  return errors;
}

export function validateJsonLdNode(node: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof node['@context'] !== 'string' || !String(node['@context']).includes('schema.org')) {
    errors.push('missing @context');
  }
  const type = node['@type'];
  if (typeof type !== 'string' || !type) errors.push('missing @type');
  if (type === 'BreadcrumbList') {
    const items = node.itemListElement;
    if (!Array.isArray(items) || items.length === 0) errors.push('empty BreadcrumbList');
    else {
      items.forEach((item, index) => {
        const row = item as Record<string, unknown>;
        if (row['@type'] !== 'ListItem') errors.push(`crumb ${index} type`);
        if (row.position !== index + 1) errors.push(`crumb ${index} position`);
        if (typeof row.name !== 'string' || !row.name) errors.push(`crumb ${index} name`);
        if (typeof row.item !== 'string' || !row.item.startsWith('https://www.noamdoronmath.co.il')) {
          errors.push(`crumb ${index} item`);
        }
      });
    }
  }
  if (type === 'LearningResource') {
    if (node.inLanguage !== 'he') errors.push('LearningResource inLanguage');
    if (typeof node.educationalLevel !== 'string' || !node.educationalLevel) {
      errors.push('LearningResource educationalLevel');
    }
    if (typeof node.name !== 'string' || !node.name) errors.push('LearningResource name');
    errors.push(...learningResourceExtrasErrors(node));
  }
  if (type === 'Article' || type === 'BlogPosting') {
    const headline = node.headline || node.name;
    if (typeof headline !== 'string' || !headline) errors.push(`${type} headline`);
    if (node.inLanguage !== undefined && node.inLanguage !== 'he') errors.push(`${type} inLanguage`);
  }
  if (type === 'FAQPage') {
    const main = node.mainEntity;
    if (!Array.isArray(main) || main.length === 0) errors.push('FAQPage without questions');
  }
  if (type === 'Organization' || type === 'EducationalOrganization' || type === 'WebSite') {
    if (typeof node.name !== 'string' || !node.name) errors.push(`${type} name`);
    if (typeof node.url !== 'string' || !node.url.startsWith('https://www.noamdoronmath.co.il')) {
      errors.push(`${type} url`);
    }
  }
  return errors;
}

const isHttpsUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value);

/** The SEO-4 properties a LearningResource may carry: audience, alignment, teaches, PDFs, publisher. */
function learningResourceExtrasErrors(node: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const audience = node.audience as Record<string, unknown> | undefined;
  if (audience !== undefined) {
    if (audience['@type'] !== 'EducationalAudience') errors.push('LearningResource audience type');
    if (typeof audience.audienceType !== 'string' || !audience.audienceType) {
      errors.push('LearningResource audienceType');
    }
  }
  if (node.educationalAlignment !== undefined) {
    const list = node.educationalAlignment;
    if (!Array.isArray(list) || list.length === 0) errors.push('LearningResource educationalAlignment');
    else {
      list.forEach((item, index) => {
        const row = item as Record<string, unknown>;
        if (row['@type'] !== 'AlignmentObject') errors.push(`alignment ${index} type`);
        if (!(ALIGNMENT_TYPES as readonly unknown[]).includes(row.alignmentType)) {
          errors.push(`alignment ${index} alignmentType`);
        }
        if (row.educationalFramework !== CURRICULUM_FRAMEWORK) errors.push(`alignment ${index} framework`);
        if (typeof row.targetName !== 'string' || !row.targetName) errors.push(`alignment ${index} targetName`);
        if (row.targetUrl !== CURRICULUM_TARGET_URL) errors.push(`alignment ${index} targetUrl`);
      });
    }
  }
  if (node.teaches !== undefined) {
    const list = [node.teaches].flat();
    if (list.length === 0 || list.some((item) => typeof item !== 'string' || !item)) {
      errors.push('LearningResource teaches');
    }
  }
  if (node.hasPart !== undefined) {
    const list = node.hasPart;
    if (!Array.isArray(list) || list.length === 0) errors.push('LearningResource hasPart');
    else {
      const seen = new Set<string>();
      list.forEach((item, index) => {
        const row = item as Record<string, unknown>;
        if (row['@type'] !== 'MediaObject') errors.push(`part ${index} type`);
        if (row.encodingFormat !== 'application/pdf') errors.push(`part ${index} encodingFormat`);
        if (!isHttpsUrl(row.contentUrl) || !row.contentUrl.endsWith('.pdf')) errors.push(`part ${index} contentUrl`);
        else if (seen.has(row.contentUrl)) errors.push(`part ${index} duplicate contentUrl`);
        else seen.add(row.contentUrl);
        if (typeof row.name !== 'string' || !row.name) errors.push(`part ${index} name`);
      });
    }
  }
  if (node.publisher !== undefined) {
    const publisher = node.publisher as Record<string, unknown>;
    if (publisher['@id'] !== SITE_ORGANIZATION_ID) errors.push('LearningResource publisher @id');
  }
  return errors;
}

/** Strings that still carry bidi isolate controls, as JSON paths. */
export function jsonLdBidiErrors(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') return /[\u2066-\u2069]/.test(value) ? [`bidi control at ${path}`] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => jsonLdBidiErrors(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      jsonLdBidiErrors(item, `${path}.${key}`),
    );
  }
  return [];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Every node with an @id across the blocks of one page. A node that only has
 * an @id is a reference; anything more is a definition.
 */
export function jsonLdIdNodes(blocks: readonly unknown[]): {
  definitions: Map<string, Record<string, unknown>[]>;
  references: Set<string>;
} {
  const definitions = new Map<string, Record<string, unknown>[]>();
  const references = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const id = record['@id'];
    if (typeof id === 'string') {
      if (Object.keys(record).length === 1) references.add(id);
      else definitions.set(id, [...(definitions.get(id) || []), record]);
    }
    for (const [key, item] of Object.entries(record)) {
      if (key !== '@context') visit(item);
    }
  };
  visit(blocks);
  return { definitions, references };
}

/**
 * Two definitions of one @id must agree on every property they share, and a
 * reference to a node on this site must be defined on the same page.
 */
export function jsonLdIdErrors(blocks: readonly unknown[]): string[] {
  const errors: string[] = [];
  const { definitions, references } = jsonLdIdNodes(blocks);
  for (const [id, nodes] of definitions) {
    for (const node of nodes.slice(1)) {
      for (const [key, value] of Object.entries(node)) {
        if (key in nodes[0] && stableJson(nodes[0][key]) !== stableJson(value)) {
          errors.push(`@id ${id} conflicts on ${key}`);
        }
      }
    }
  }
  for (const id of references) {
    if (id.startsWith(SITE_CANONICAL_ORIGIN) && !definitions.has(id)) errors.push(`@id ${id} is not defined`);
  }
  return errors;
}

/** Everything a page emits: valid nodes, consistent @ids, no bidi controls. */
export function validateEmittedJsonLd(blocks: readonly unknown[]): string[] {
  return [
    ...blocks.flatMap((block) => validateJsonLdDocument(block)),
    ...jsonLdIdErrors(blocks),
    ...jsonLdBidiErrors(blocks),
  ];
}
