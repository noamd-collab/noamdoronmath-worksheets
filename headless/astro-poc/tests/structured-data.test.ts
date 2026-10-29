/**
 * JSON-LD for the cut-over. FAQ is only valid when it has real questions.
 * Builders do not invent FAQ or reviews.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { listBlogArchives } from '../src/lib/blogArchives';
import { listServedBlogPosts } from '../src/lib/blogPosts';
import { homePageJsonLd } from '../src/lib/homePage';
import { loadTopicPage, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages';
import {
  articleJsonLd,
  breadcrumbList,
  educationalLevelForGrade,
  jsonLdTypes,
  learningResourceJsonLd,
  organizationJsonLd,
  validateJsonLdNode,
} from '../src/lib/structuredData';

describe('structured data builders', () => {
  it('builds a BreadcrumbList, LearningResource, Article, and Organization', () => {
    const crumbs = breadcrumbList([
      { name: 'בית', path: '/' },
      { name: 'כיתה ז׳', path: '/grade-7' },
      { name: 'שטח משולש', path: '/triangle-area-grade-7' },
    ]);
    const resource = learningResourceJsonLd({
      name: 'שטח משולש',
      path: '/triangle-area-grade-7',
      description: 'תרגול שטח משולש לכיתה ז׳',
      educationalLevel: educationalLevelForGrade(7),
    });
    const article = articleJsonLd({
      headline: 'מדריך',
      path: '/post/example',
      description: 'תקציר',
      datePublished: '2026-01-01',
      dateModified: '2026-01-02',
    });
    for (const node of [crumbs, resource, article, organizationJsonLd()]) {
      assert.deepEqual(validateJsonLdNode(node), [], String(node['@type']));
    }
    assert.equal(resource.inLanguage, 'he');
    assert.equal(resource.educationalLevel, 'כיתה ז׳');
  });

  it('does not generate FAQ or review nodes', () => {
    const src = readFileSync(new URL('../src/lib/structuredData.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /'@type': 'FAQPage'|@type': 'Review'|AggregateRating/);
  });

  it('topic pages already carry LearningResource, or the page adds one', () => {
    const topic = readFileSync(new URL('../src/components/TopicPage.astro', import.meta.url), 'utf8');
    assert.match(topic, /learningResourceJsonLd/);
    let supplemented = 0;
    for (const slug of TOPIC_PAGE_SLUGS) {
      const page = loadTopicPage(slug);
      const types = jsonLdTypes(page.jsonLd);
      if (!types.includes('LearningResource')) {
        supplemented += 1;
        const node = learningResourceJsonLd({
          name: page.h1,
          path: page.path,
          description: page.description,
          educationalLevel: educationalLevelForGrade(page.grade),
        });
        assert.deepEqual(validateJsonLdNode(node), [], slug);
      }
      if (types.includes('FAQPage')) assert.ok(page.faq.length > 0, slug);
    }
    assert.equal(supplemented, 1);
  });

  it('every served post is an Article via BlogPosting, and the home page has WebSite plus Organization', () => {
    for (const post of listServedBlogPosts()) {
      const types = jsonLdTypes(post.jsonLd);
      assert.ok(types.includes('BlogPosting') || types.includes('Article'), post.path);
    }
    assert.equal(listBlogArchives().length, 4);
    const homeTypes = homePageJsonLd().map((block) => block['@type']);
    assert.ok(homeTypes.includes('WebSite'));
    assert.equal(organizationJsonLd()['@type'], 'Organization');
    const index = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
    assert.match(index, /organizationJsonLd/);
    const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
    assert.match(layout, /breadcrumbList/);
    assert.doesNotMatch(layout, /EducationalOrganization/);
  });
});
