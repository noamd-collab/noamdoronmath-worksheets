/**
 * SEO cut-over audit.
 *
 * Runs on the data and routes the Astro build renders. `wix build` needs
 * Wix credentials that are not in this public repo, so CI does not boot a
 * preview. The checks below are the same contracts the HTML would have:
 * one title, one description, one production canonical, sitemap coverage,
 * internal links, JSON-LD, and lang/dir.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listBlogArchives } from '../src/lib/blogArchives.ts';
import { listBlogSitemapEntries, renderBlogSitemapXml } from '../src/lib/blogSitemap.ts';
import { collectBlogPostHrefs, listServedBlogPosts, localizeBlogHref } from '../src/lib/blogPosts.ts';
import { loadAllGradeHubs } from '../src/lib/gradeHubs.ts';
import { homePageJsonLd, loadHomePage } from '../src/lib/homePage.ts';
import { didacticSequence } from '../../../noam-ai/site-companion/topic-order.js';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import {
  LLMS_FULL_TOPICS_HEADING,
  LLMS_FULL_UNPLACED_GROUP,
  landingScopeSentence,
  llmsFullTracks,
  plainText,
  renderLlmsFullTxt,
  withoutPromoClauses,
} from '../src/lib/llmsFullTxt.ts';
import { oneLine, renderLlmsTxt } from '../src/lib/llmsTxt.ts';
import { REDIRECT_RULES } from '../src/lib/redirects.ts';
import { resolveSiteHref } from '../src/lib/resolveSiteHref.ts';
import { listMainPagePaths, renderPagesSitemapXml, renderSitemapIndexXml } from '../src/lib/siteSitemaps.ts';
import { SITE_CANONICAL_ORIGIN, renderRobotsTxt } from '../src/lib/siteSeo.ts';
import {
  breadcrumbList,
  educationalLevelForGrade,
  jsonLdTypes,
  learningResourceJsonLd,
  siteIdentityJsonLd,
  validateEmittedJsonLd,
  validateJsonLdDocument,
} from '../src/lib/structuredData.ts';
import { nextGradeRelatedTopics } from '../src/lib/topicFamilies.ts';
import { loadAllTopicPages } from '../src/lib/topicPages.ts';
import { GET as getLlmsFullTxt } from '../src/pages/llms-full.txt.ts';
import { REDUCED_HUB_PATH, prisaHrefs } from '../src/lib/prisaIndex.ts';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function pageGlobKeysFromDisk(): string[] {
  return readdirSync(fromTest('../src/pages'))
    .filter((name) => name.endsWith('.astro'))
    .map((name) => `./${name}`);
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function assertCopy(kind: string, path: string, title: string, description: string) {
  assert.ok(title.trim(), `${kind} ${path} missing title`);
  assert.ok(description.trim(), `${kind} ${path} missing description`);
  assert.equal(title.includes('\0'), false);
  assert.equal(description.includes('\0'), false);
}

describe('seo audit', () => {
  it('layout emits one title, one description, one canonical, and Hebrew RTL', () => {
    const layout = readFileSync(fromTest('../src/layouts/BaseLayout.astro'), 'utf8');
    assert.equal((layout.match(/<title[\s>]/g) || []).length, 1);
    assert.equal((layout.match(/<meta\b[^>]*\bname="description"/g) || []).length, 1);
    assert.equal((layout.match(/rel="canonical"/g) || []).length, 1);
    assert.match(layout, /<html lang="he" dir="rtl">/);
    assert.match(layout, /canonicalUrl\(Astro\.url\.pathname/);
    assert.match(layout, /buildSocialMeta\(/);
    assert.equal(layout.includes('EducationalOrganization'), false);
  });

  it('home, grades, topics, posts, and archives each have title and description', () => {
    const home = loadHomePage();
    assertCopy('home', '/', home.title, home.description);
    for (const hub of loadAllGradeHubs()) assertCopy('grade', hub.path, hub.title, hub.description);
    for (const page of loadAllTopicPages()) assertCopy('topic', page.path, page.title, page.description);
    for (const post of listServedBlogPosts()) assertCopy('post', post.path, post.title, post.description);
    for (const archive of listBlogArchives()) {
      assertCopy('archive', archive.path, archive.title, archive.description);
    }
    const notFound = readFileSync(fromTest('../src/pages/404.astro'), 'utf8');
    assert.match(notFound, /title="/);
    assert.match(notFound, /description="/);
    assert.match(notFound, /Astro\.response\.status = 404/);
  });

  it('sitemap index, pages, and blog cover the public routes on www', () => {
    const index = renderSitemapIndexXml();
    const indexLocs = locs(index);
    assert.deepEqual(indexLocs.sort(), [
      `${SITE_CANONICAL_ORIGIN}/sitemap-blog.xml`,
      `${SITE_CANONICAL_ORIGIN}/sitemap-pages.xml`,
    ]);

    const pageLocs = locs(renderPagesSitemapXml(pageGlobKeysFromDisk()));
    const pagePaths = new Set(pageLocs.map((loc) => loc.slice(SITE_CANONICAL_ORIGIN.length) || '/'));
    for (const hub of loadAllGradeHubs()) assert.ok(pagePaths.has(hub.path), hub.path);
    for (const page of loadAllTopicPages()) assert.ok(pagePaths.has(page.path), page.path);
    assert.ok(pagePaths.has('/worksheets'));
    assert.ok(pagePaths.has(REDUCED_HUB_PATH));
    assert.ok(pagePaths.has('/aboutus'));
    assert.equal(pagePaths.has('/404'), false);
    assert.equal(pagePaths.has('/dev-loops'), false);
    for (const rule of REDIRECT_RULES) assert.equal(pagePaths.has(rule.from), false, rule.from);

    const blogLocs = locs(renderBlogSitemapXml());
    const blogPaths = new Set(
      listBlogSitemapEntries().map((entry) => new URL(entry.loc).pathname),
    );
    assert.equal(blogLocs.length, blogPaths.size);
    for (const post of listServedBlogPosts()) assert.ok(blogPaths.has(post.path), post.path);
    for (const archive of listBlogArchives()) assert.ok(blogPaths.has(archive.path), archive.path);
    assert.ok(listServedBlogPosts().length >= 68);
    assert.equal(listBlogArchives().length, 4);

    const all = [...indexLocs, ...pageLocs, ...blogLocs];
    for (const loc of all) {
      assert.ok(loc.startsWith(`${SITE_CANONICAL_ORIGIN}/`), loc);
      assert.equal(loc.includes('wix-site-host'), false, loc);
    }
  });

  it('internal links from grades, topics, and blog resolve to a served page', () => {
    const broken: string[] = [];
    const check = (where: string, href: string | null | undefined) => {
      if (!href) return;
      const resolved = resolveSiteHref(href);
      if (resolved.reason === 'unserved-prod') broken.push(`${where} -> ${resolved.href}`);
    };

    for (const page of loadAllTopicPages()) {
      for (const rel of page.relatedTopics) check(`${page.path} related`, rel.productionHref || rel.path);
      for (const rel of nextGradeRelatedTopics(page.slug, page.grade)) {
        check(`${page.path} next`, rel.productionHref || rel.path);
      }
      for (const cta of page.catalogCtas || []) check(`${page.path} cta`, cta.href);
      check(`${page.path} hub`, page.gradeHubHref);
      check(`${page.path} terms`, page.terms?.href);
      for (const author of page.author?.links || []) check(`${page.path} author`, author.href);
    }

    for (const hub of loadAllGradeHubs()) {
      for (const link of hub.topicLinks) check(`${hub.path} topic`, link.productionHref || link.path);
      for (const section of hub.topicSections || []) {
        for (const link of section.links) check(`${hub.path} section`, link.productionHref || link.path);
      }
      for (const link of hub.footerLinks || []) check(`${hub.path} footer`, link.href);
      check(`${hub.path} cta`, hub.catalogCta?.href);
      check(`${hub.path} whatsapp`, hub.whatsapp?.href);
      check(`${hub.path} terms`, hub.terms?.href);
    }

    for (const post of listServedBlogPosts()) {
      for (const row of collectBlogPostHrefs(post)) {
        check(`${post.path} ${row.where}`, localizeBlogHref(row.href));
      }
    }

    for (const archive of listBlogArchives()) {
      for (const item of archive.nav) check(`${archive.path} nav`, localizeBlogHref(item.href));
      for (const card of archive.cards) check(`${archive.path} card`, localizeBlogHref(card.href));
    }

    // SEO-2: the "לפי הפריסה" month index and the /grade-9-reduced hub.
    for (const href of prisaHrefs()) check(`${REDUCED_HUB_PATH} prisa`, href);

    assert.deepEqual(broken, []);
  });

  it('JSON-LD on home, topics, and posts is valid and typed', () => {
    const layout = readFileSync(fromTest('../src/layouts/BaseLayout.astro'), 'utf8');
    assert.match(layout, /breadcrumbList\(crumbItems\)/);
    assert.match(layout, /set:html=\{JSON\.stringify\(breadcrumbLd\)\}/);
    for (const file of [
      '../src/components/TopicPage.astro',
      '../src/components/GradeHubPage.astro',
      '../src/components/BlogPostPage.astro',
      '../src/components/BlogArchivePage.astro',
      '../src/pages/index.astro',
      '../src/pages/worksheets.astro',
    ]) {
      assert.match(readFileSync(fromTest(file), 'utf8'), /crumbs=/);
    }

    const homeDocs = [siteIdentityJsonLd(homePageJsonLd())];
    assert.deepEqual(validateJsonLdDocument(homeDocs), []);
    assert.deepEqual(validateEmittedJsonLd(homeDocs), []);
    assert.deepEqual(homeDocs.flatMap((doc) => jsonLdTypes(doc)), ['EducationalOrganization', 'WebSite']);

    const topics = loadAllTopicPages();
    const missingResource = topics.filter((page) => !jsonLdTypes(page.jsonLd).includes('LearningResource'));
    assert.deepEqual(
      missingResource.map((page) => page.path),
      ['/pythagorean-theorem-grade-7'],
    );
    for (const page of topics) {
      assert.deepEqual(validateJsonLdDocument(page.jsonLd), [], page.path);
      const crumbs = breadcrumbList([
        { name: 'בית', path: '/' },
        { name: page.h1, path: page.path },
      ]);
      assert.deepEqual(validateJsonLdDocument(crumbs), [], page.path);
      if (!jsonLdTypes(page.jsonLd).includes('LearningResource')) {
        const extra = learningResourceJsonLd({
          name: page.h1,
          path: page.path,
          description: page.description,
          educationalLevel: educationalLevelForGrade(page.grade),
        });
        assert.deepEqual(validateJsonLdDocument(extra), [], page.path);
      }
    }

    for (const post of listServedBlogPosts()) {
      const types = jsonLdTypes(post.jsonLd);
      assert.ok(types.includes('BlogPosting') || types.includes('Article'), post.path);
      assert.deepEqual(validateJsonLdDocument(post.jsonLd), [], post.path);
    }
  });

  it('llms.txt lists grades and topics on the production origin', () => {
    const route = readFileSync(fromTest('../src/pages/llms.txt.ts'), 'utf8');
    assert.equal(route.includes('node:fs'), false);
    assert.equal(route.includes('readdirSync'), false);
    assert.equal(existsSync(fromTest('../public/llms.txt')), false);

    assert.match(renderRobotsTxt(true), /# https:\/\/www\.noamdoronmath\.co\.il\/llms\.txt/);
    const text = renderLlmsTxt();
    assert.match(text, /^# נועם דורון מתמטיקה/u);
    assert.equal(text.includes('wix-site-host'), false);
    for (const hub of loadAllGradeHubs()) {
      assert.ok(text.includes(`${SITE_CANONICAL_ORIGIN}${hub.path}`), hub.path);
    }
    for (const page of loadAllTopicPages()) {
      assert.ok(text.includes(`${SITE_CANONICAL_ORIGIN}${page.path}`), page.path);
    }
    assert.ok(text.includes(`${SITE_CANONICAL_ORIGIN}/blog`));
    assert.equal((text.match(/https:\/\/www\.noamdoronmath\.co\.il\/grade-[1-9]/g) || []).length >= 9, true);
    assert.ok(text.includes(`(${SITE_CANONICAL_ORIGIN}/llms-full.txt)`), 'llms.txt links the full map');
  });

  it('llms-full.txt route is bundled data, announced in robots.txt and llms.txt', () => {
    const route = readFileSync(fromTest('../src/pages/llms-full.txt.ts'), 'utf8');
    assert.equal(route.includes('node:fs'), false);
    assert.equal(route.includes('readdirSync'), false);
    assert.match(route, /export const prerender = false;/);
    assert.match(route, /renderLlmsFullTxt\(\)/);
    assert.match(route, /'content-type': 'text\/plain; charset=utf-8'/);
    assert.match(route, /'x-robots-tag': 'noindex'/);
    assert.equal(existsSync(fromTest('../public/llms-full.txt')), false);
    for (const indexable of [true, false]) {
      assert.match(
        renderRobotsTxt(indexable),
        /^# LLM index: https:\/\/www\.noamdoronmath\.co\.il\/llms-full\.txt$/m,
      );
    }
  });

  it('llms-full.txt is served as plain text that search engines do not index', async () => {
    const response = await getLlmsFullTxt({} as never);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex', 'a text copy of all landings must not rank against them');
    assert.equal(await response.text(), renderLlmsFullTxt());
  });

  it('llms-full.txt lists every topic landing once, by grade, track and catalog order', () => {
    const text = renderLlmsFullTxt();
    assert.match(text, /^# נועם דורון מתמטיקה/u);
    assert.equal(text.includes('wix-site-host'), false);
    for (const hub of loadAllGradeHubs()) {
      assert.ok(text.includes(`(${SITE_CANONICAL_ORIGIN}${hub.path})`), hub.path);
    }
    assert.ok(text.includes(`(${SITE_CANONICAL_ORIGIN}/blog)`));

    const lines = text.split('\n');
    const start = lines.indexOf(LLMS_FULL_TOPICS_HEADING);
    const end = lines.indexOf('## בלוג');
    assert.ok(start > 0 && end > start, 'topic map sits between the grade hubs and the blog');
    const section = lines.slice(start + 1, end);
    assert.equal(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(section.join('\n')), false, 'no bidi controls');

    // Parse ### track / #### group / landing lines.
    const LINE = /^- \[([^\]]+)\]\(https:\/\/www\.noamdoronmath\.co\.il(\/[^)\s]+)\): (.+)$/u;
    const tracks: Array<{ heading: string; groups: Array<{ label: string; paths: string[] }> }> = [];
    const scopeByPath = new Map<string, string>();
    const titleByPath = new Map<string, string>();
    for (const line of section) {
      if (line.startsWith('### ')) tracks.push({ heading: line.slice(4), groups: [] });
      else if (line.startsWith('#### ')) tracks.at(-1)?.groups.push({ label: line.slice(5), paths: [] });
      else if (line.startsWith('- ')) {
        const match = LINE.exec(line);
        assert.ok(match, `landing line shape: ${line}`);
        const group = tracks.at(-1)?.groups.at(-1);
        assert.ok(group, `landing line outside a group: ${line}`);
        group.paths.push(match[2]);
        titleByPath.set(match[2], match[1]);
        scopeByPath.set(match[2], match[3]);
      } else {
        assert.ok(line === '' || line.startsWith('> '), `unexpected line: ${line}`);
      }
    }

    assert.deepEqual(
      tracks.map((track) => track.heading),
      [
        'כיתה א׳',
        'כיתה ב׳',
        'כיתה ג׳',
        'כיתה ד׳',
        'כיתה ה׳',
        'כיתה ו׳',
        'כיתה ז׳',
        'כיתה ח׳',
        'כיתה ט׳ רגילה',
        'כיתה ט׳ מצומצמת',
      ],
    );

    // Every served landing exactly once, and every listed path is a routed page.
    const redirected = new Set(REDIRECT_RULES.map((rule) => rule.from));
    const pages = loadAllTopicPages().filter((page) => !redirected.has(page.path));
    const listed = tracks.flatMap((track) => track.groups.flatMap((group) => group.paths));
    assert.equal(new Set(listed).size, listed.length, 'no landing listed twice');
    assert.deepEqual([...listed].sort(), pages.map((page) => page.path).sort());
    for (const path of listed) {
      assert.ok(existsSync(fromTest(`../src/pages${path}.astro`)), `route for ${path}`);
    }
    assert.equal(
      tracks.some((track) => track.groups.some((group) => group.label === LLMS_FULL_UNPLACED_GROUP)),
      false,
      'every landing CTA resolves to a catalog topic; fix the landing CTA instead of listing it unplaced',
    );

    // Catalog order: group headings follow catalog groups, landings follow didacticSequence().
    const catalog = loadCatalog();
    const sequence = didacticSequence(catalog) as Array<{ grade: number; topicId: number; index: number }>;
    const rank = new Map(sequence.map((item) => [`${item.grade}:${item.topicId}`, item.index]));
    const byPath = new Map(pages.map((page) => [page.path, page]));
    const trackPages = new Map(tracks.map((track) => [track.heading, track]));
    for (const grade of catalog.grades) {
      for (const reduced of [false, true]) {
        const groups = grade.groups.filter((group) => group.reducedProgram === reduced);
        if (!groups.length) continue;
        const heading = grade.groups.some((group) => group.reducedProgram)
          ? `${grade.label} ${reduced ? 'מצומצמת' : 'רגילה'}`
          : grade.label;
        const track = trackPages.get(heading);
        assert.ok(track, heading);
        const labels = groups.map((group) => group.label);
        const shown = track.groups.map((group) => group.label);
        assert.deepEqual(shown, labels.filter((label) => shown.includes(label)), `${heading} group order`);
        let last = -1;
        for (const group of track.groups) {
          for (const path of group.paths) {
            const page = byPath.get(path);
            assert.ok(page, path);
            assert.equal(page.grade, grade.grade, `${path} sits under its own grade`);
            let topicId = page.catalogCta.catalogTopicId ?? Number(/[?&]topic=(\d+)/.exec(page.catalogCta.href)?.[1]);
            const topic = grade.topics.find((entry) => entry.id === topicId);
            assert.ok(topic, `${path} CTA topic ${topicId} is in the grade ${grade.grade} catalog`);
            if (topic.parent != null) topicId = topic.parent;
            const catalogGroup = grade.groups.find((entry) => entry.key === topic.group);
            assert.equal(catalogGroup?.label, group.label, `${path} under its catalog group`);
            assert.equal(Boolean(catalogGroup?.reducedProgram), reduced, `${path} under its catalog track`);
            const position = rank.get(`${grade.grade}:${topicId}`);
            assert.ok(position != null && position >= last, `${path} keeps catalog order`);
            last = position;
          }
        }
      }
    }
    assert.deepEqual(
      trackPages.get('כיתה ז׳')?.groups.map((group) => group.label),
      catalog.grades.find((grade) => grade.grade === 7)?.groups.map((group) => group.label),
      'grade 7 runs by month, September to June',
    );
    // The reduced track holds exactly the landings whose CTA topic sits in a
    // reducedProgram catalog group, under those groups in catalog order. Derived
    // from the catalog so new reduced-track topics and months need no test edit.
    for (const grade of catalog.grades.filter((entry) => entry.groups.some((group) => group.reducedProgram))) {
      const reducedGroups = grade.groups.filter((group) => group.reducedProgram);
      const groupOfLanding = (page: (typeof pages)[number]) => {
        let topicId = page.catalogCta.catalogTopicId ?? Number(/[?&]topic=(\d+)/.exec(page.catalogCta.href)?.[1]);
        const topic = grade.topics.find((entry) => entry.id === topicId);
        if (topic?.parent != null) topicId = topic.parent;
        const group = grade.topics.find((entry) => entry.id === topicId)?.group;
        return reducedGroups.find((entry) => entry.key === group);
      };
      const reducedLandings = pages.filter((page) => page.grade === grade.grade && groupOfLanding(page));
      const reducedTrack = trackPages.get(`${grade.label} מצומצמת`);
      assert.ok(reducedLandings.length > 0, `${grade.label}: the catalog marks reduced-track topics with landings`);
      assert.ok(reducedTrack, `${grade.label} מצומצמת is listed`);
      assert.deepEqual(
        reducedTrack.groups.map((group) => group.label),
        reducedGroups
          .filter((group) => reducedLandings.some((page) => groupOfLanding(page) === group))
          .map((group) => group.label),
        `${grade.label} מצומצמת groups follow the reducedProgram catalog groups`,
      );
      assert.deepEqual(
        reducedTrack.groups.flatMap((group) => group.paths).sort(),
        reducedLandings.map((page) => page.path).sort(),
        `${grade.label} מצומצמת lists exactly the reduced-track landings`,
      );
    }
    // The reduced-track note must not say every regular ט׳ page is in the reduced track.
    const reducedNote = llmsFullTracks().find((track) => track.reduced)?.note ?? '';
    assert.ok(reducedNote.includes('מסלול נפרד לקראת 3 יח״ל'), 'reduced track described in the site wording');
    assert.ok(reducedNote.includes('חלק מהנושאים של כיתה ט׳ רגילה'), 'only some regular topics are shared');
    assert.equal(/משמשים גם|כל דפי|כל הנושאים/u.test(reducedNote), false, 'no claim that all regular topics are shared');
    assert.ok(lines.includes(`> ${reducedNote}`), 'reduced-track note is printed under its heading');
    assert.deepEqual(
      llmsFullTracks().map((track) => track.groups.reduce((n, group) => n + group.pages.length, 0)),
      tracks.map((track) => track.groups.reduce((n, group) => n + group.paths.length, 0)),
    );

    // One line per landing: page title, then one sentence taken from its own description.
    for (const path of listed) {
      const page = byPath.get(path);
      assert.ok(page, path);
      assert.equal(titleByPath.get(path), oneLine(plainText(page.h1), 80), path);
      const scope = scopeByPath.get(path) ?? '';
      assert.equal(scope, landingScopeSentence(page.description), path);
      assert.equal(scope.split(/(?<=[.!?])\s+/u).length, 1, `${path} scope is one sentence`);
      // Words of the scope appear in the description in the same order (promo clauses may be cut).
      const bare = (word: string) => word.replace(/[,;:.!?]$/u, '');
      const descriptionWords = plainText(page.description).split(' ');
      const scopeWords = scope.replace(/…$/u, '').split(' ');
      let from = 0;
      scopeWords.forEach((word, position) => {
        const truncatedWord = scope.endsWith('…') && position === scopeWords.length - 1;
        const at = descriptionWords.findIndex(
          (candidate, index) =>
            index >= from && (truncatedWord ? candidate.startsWith(word) : bare(candidate) === bare(word)),
        );
        assert.ok(at >= 0, `${path} scope comes from the description, in order: ${word}`);
        from = at + 1;
      });
      assert.equal(/\d\s*\/\s*\d/.test(`${titleByPath.get(path)} ${scope}`), false, `${path} has no slash fraction`);
    }
  });

  it('llms-full.txt picks up the content-train landing of topic 9/49 under כיתה ט׳ מצומצמת, ינואר', () => {
    const path = '/equations-numeric-denominator-grade-9';
    const tracks = llmsFullTracks();
    const reduced = tracks.filter((track) => track.reduced);
    assert.deepEqual(reduced.map((track) => [track.grade, track.heading]), [[9, 'כיתה ט׳ מצומצמת']]);
    // r9jan is a catalog month group with this one landing; it follows ספטמבר, אוקטובר and נובמבר
    // (r9nov, opened by topic 53 in batch 10, 18.11).
    assert.deepEqual(reduced[0].groups.map((group) => [group.key, group.label]), [['r9sep', 'ספטמבר'], ['r9oct', 'אוקטובר'], ['r9nov', 'נובמבר'], ['r9jan', 'ינואר']]);
    assert.deepEqual(reduced[0].groups.at(-1)?.pages.map((page) => page.path), [path]);
    for (const track of tracks.filter((entry) => !entry.reduced)) {
      assert.equal(track.groups.some((group) => group.pages.some((page) => page.path === path)), false, track.heading);
    }
    const lines = renderLlmsFullTxt().split('\n');
    const line = `- [משוואות עם מכנה מספרי לכיתה ט׳ מצומצמת](${SITE_CANONICAL_ORIGIN}${path}): דפי עבודה במשוואות עם מכנה מספרי לכיתה ט׳ מצומצמת: כפל במכנה המשותף, מונה בסוגריים וסימן חיסור לפני שבר.`;
    assert.equal(lines.filter((entry) => entry === line).length, 1);
    const at = lines.indexOf(line);
    assert.equal(lines[at - 1], '#### ינואר');
    assert.ok(lines.lastIndexOf('### כיתה ט׳ מצומצמת') < at && lines.lastIndexOf('### כיתה ט׳ מצומצמת') > lines.indexOf('### כיתה ט׳ רגילה'));
    // The four batch-4 landings stay listed once each, with the first sentence of their new description.
    for (const [slug, scope] of [
      ['kite-grade-9', 'דלתון לכיתה ט׳: הגדרת הדלתון, תכונות הזוויות, האלכסון הראשי ושטח דלתון.'],
      ['triangle-30-60-90-grade-9', 'משולש 30–60–90 לכיתה ט׳: יחסי הצלעות, הניצב שמול הזווית בת 30° שווה למחצית היתר, והמשפט ההפוך.'],
      ['solids-box-cube-prism-grade-7', 'נפח ושטח פנים של תיבה, קובייה ומנסרה משולשת לכיתה ז׳.'],
      ['similar-triangles-grade-8', 'דמיון משולשים לכיתה ח׳: יחס הדמיון, דמיון משולשים לפי זוויות (ז.ז) ויחס שטחים.'],
    ]) {
      const matches = lines.filter((entry) => entry.includes(`(${SITE_CANONICAL_ORIGIN}/${slug}): `));
      assert.equal(matches.length, 1, slug);
      assert.ok(matches[0].endsWith(`: ${scope}`), `${slug}: ${matches[0]}`);
    }
  });

  it('llms-full scope sentence skips sentences that only advertise the sheets', () => {
    assert.equal(
      landingScopeSentence('דפי עבודה בזוויות לכיתה ז׳ בשלוש רמות, בחינם וללא הרשמה. מזהים זוויות צמודות וקודקודיות.'),
      'מזהים זוויות צמודות וקודקודיות.',
    );
    assert.equal(
      landingScopeSentence('משפט פיתגורס לכיתה ז׳: זיהוי היתר והניצבים. דפי PDF נוספים בשלוש רמות, עם תשובות סופיות.'),
      'משפט פיתגורס לכיתה ז׳: זיהוי היתר והניצבים.',
    );
    assert.equal(
      landingScopeSentence('שיפוע לכיתה ח׳: הישר \u2066y = 0.5x\u2069 ומשמעותו. בחינם.'),
      'שיפוע לכיתה ח׳: הישר y = 0.5x ומשמעותו.',
    );
    // No sentence survives without its promo text: the first sentence is kept.
    assert.equal(
      landingScopeSentence('דפי עבודה חינמיים בנפח חרוט לכיתה ח׳. הורידו בחינם.'),
      'דפי עבודה חינמיים בנפח חרוט לכיתה ח׳.',
    );
  });

  it('llms-full scope sentence strips a promo clause and keeps the scope sentence', () => {
    // isosceles-triangle-properties-grade-8 as it read at 37213b1c, before batch 2a
    // rewrote it: both sentences carry a promo phrase. The first is about the free
    // sheets; the second is the scope once its "ללא הרשמה" clause is removed.
    assert.equal(
      landingScopeSentence(
        'דפי עבודה חינמיים במשולש שווה שוקיים לכיתה ח׳, בשלוש רמות: א׳, ב׳ ומצוינות. תרגלו זוויות בסיס, זווית ראש ותכונות המשולש וקבלו רמז מנועם AI ללא הרשמה בבית היום.',
      ),
      'תרגלו זוויות בסיס, זווית ראש ותכונות המשולש.',
    );
    const isosceles = loadAllTopicPages().find((page) => page.slug === 'isosceles-triangle-properties-grade-8');
    assert.ok(isosceles, 'isosceles-triangle-properties-grade-8 landing');
    assert.equal(
      /בחינם|ללא הרשמה|חינמי|להורדה/u.test(landingScopeSentence(isosceles.description)),
      false,
      'the live isosceles landing scope carries no promo text',
    );

    // A promo clause after a comma or a dash goes whole; the rest of the sentence stays.
    assert.equal(
      withoutPromoClauses('תרגלו הצבה בנוסחה πr²h, פתרו בעיות נפח והורידו דפי תרגול עם תשובות להדפסה, ללא הרשמה.'),
      'תרגלו הצבה בנוסחה πr²h, פתרו בעיות נפח והורידו דפי תרגול עם תשובות להדפסה.',
    );
    assert.equal(
      withoutPromoClauses('קישורים לדפי עבודה בשלוש רמות, בחינם וללא הרשמה, לתרגול בכיתה ובבית עם נועם AI.'),
      'קישורים לדפי עבודה בשלוש רמות, לתרגול בכיתה ובבית עם נועם AI.',
    );
    assert.equal(
      withoutPromoClauses('בוחרים דפי עבודה קיימים ברמות א׳, ב׳ ומצוינות — בחינם וללא הרשמה.'),
      'בוחרים דפי עבודה קיימים ברמות א׳, ב׳ ומצוינות.',
    );
    // A clause that joins with a verb-like "ו…" word is cut from that word.
    assert.equal(
      withoutPromoClauses('למדו לחשב מעטפת ושני בסיסים, פתרו תרגילים וקבלו רמז מנועם AI ללא הרשמה בכל עת בבית.'),
      'למדו לחשב מעטפת ושני בסיסים, פתרו תרגילים.',
    );
    // The cut is at the verb, not at a noun "ו…" that follows it.
    assert.equal(
      withoutPromoClauses('למדו לחשב נפח גליל, פתרו תרגילים וקבלו רמז והסבר מנועם AI ללא הרשמה.'),
      'למדו לחשב נפח גליל, פתרו תרגילים.',
    );
    // A noun conjunction is not a clause boundary: "חיבור וחיסור … בחינם" is never
    // cut to "חיבור". The sentence is left alone and the caller keeps it in full.
    for (const sentence of [
      'חיבור וחיסור של שברים בחינם.',
      'דפי תרגול על חיבור וחיסור של שברים בחינם.',
      'תרגלו צמצום של שברים, חיבור וחיסור של שברים בחינם.',
    ]) {
      assert.equal(withoutPromoClauses(sentence), null, sentence);
    }
    assert.equal(
      landingScopeSentence('תרגלו צמצום של שברים, חיבור וחיסור של שברים בחינם.'),
      'תרגלו צמצום של שברים, חיבור וחיסור של שברים בחינם.',
    );
    // With no sentence to strip, the fallback stays the first sentence in full.
    assert.equal(
      landingScopeSentence('דפי עבודה חינמיים בשברים לכיתה ז׳. תרגלו חיבור וחיסור של שברים בחינם.'),
      'דפי עבודה חינמיים בשברים לכיתה ז׳.',
    );
    // Nothing meaningful left, or the promo opens the sentence: not kept.
    assert.equal(withoutPromoClauses('דפי עבודה בחינם וללא הרשמה.'), null);
    assert.equal(withoutPromoClauses('הורידו בחינם.'), null);
    assert.equal(withoutPromoClauses('דפי עבודה חינמיים בנפח חרוט לכיתה ח׳, בשלוש רמות: א׳, ב׳ ומצוינות.'), null);
    assert.equal(withoutPromoClauses('בחינם וללא הרשמה, עם אפשרות לבקש רמז מנועם AI.'), null);
    // A sentence with no promo phrase is returned unchanged.
    assert.equal(withoutPromoClauses('מזהים זוויות צמודות וקודקודיות.'), 'מזהים זוויות צמודות וקודקודיות.');
  });
});
