/**
 * Schema.org JSON-LD for the cut-over.
 * FAQ and reviews are not generated here. Callers emit FAQ only from visible Q&A.
 */
import { gradeHubLabel, isGradeHubGrade } from './gradeHubs';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';

export type Crumb = { name: string; path: string };

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
      name: crumb.name,
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
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: input.name,
    url: absolutePageUrl(input.path),
    description: input.description,
    educationalLevel: input.educationalLevel,
    learningResourceType: input.learningResourceType || 'דפי עבודה',
    inLanguage: 'he',
    isAccessibleForFree: true,
  };
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
    headline: input.headline,
    description: input.description,
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

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'נועם דורון מתמטיקה',
    url: `${SITE_CANONICAL_ORIGIN}/`,
    logo: `${SITE_CANONICAL_ORIGIN}/brand/noam-doron-math-logo-cropped.png`,
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
  if (type === 'Organization' || type === 'WebSite') {
    if (typeof node.name !== 'string' || !node.name) errors.push(`${type} name`);
    if (typeof node.url !== 'string' || !node.url.startsWith('https://www.noamdoronmath.co.il')) {
      errors.push(`${type} url`);
    }
  }
  return errors;
}
