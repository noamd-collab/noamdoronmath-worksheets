/**
 * SEO-2 — the ט׳ מצומצמת hub (/grade-9-reduced), the "לפי הפריסה" month
 * index on /grade-7, /grade-8 and /grade-9, and optional TopicPage section
 * anchors. Data comes from src/data/prisa-units.v1.json, a committed copy of
 * the curriculum mapping (all-units.csv) and the official prisa PDFs.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform as compileAstro } from '@astrojs/compiler';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import {
  PRISA_MONTH_KEYS,
  PRISA_TRACK_KEYS,
  REDUCED_HUB_PATH,
  currentPrisaMonthKey,
  loadPrisaTrack,
  pageLabelWithoutGrade,
  prisaHrefs,
  prisaItemListJsonLd,
  prisaTracksForGrade,
  resolvePrisaPage,
  unitCountLabel,
} from '../src/lib/prisaIndex.ts';
import {
  TOPIC_PAGE_SLUGS,
  loadAllTopicPages,
  loadTopicPage,
  synthesizeBodyFlow,
  validateTopicSectionAnchors,
  type TopicPageContent,
} from '../src/lib/topicPages.ts';
import { resolveSiteHref } from '../src/lib/resolveSiteHref.ts';
import { resolveActiveNav, resolveWorksheetsNavBand } from '../src/lib/activeNav.ts';
import { renderPagesSitemapXml } from '../src/lib/siteSitemaps.ts';
import { SITE_CANONICAL_ORIGIN } from '../src/lib/siteSeo.ts';
import { breadcrumbList, jsonLdTypes, validateJsonLdDocument } from '../src/lib/structuredData.ts';

const require = createRequire(import.meta.url);
const fromTest = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const raw = JSON.parse(readFileSync(fromTest('../src/data/prisa-units.v1.json'), 'utf8'));
const NOW = new Date('2026-11-17T10:00:00Z');

/** The 12 units the mapping marks no_topic: no same-grade page exists. */
const NO_PAGE_UNITS = [
  'st.g8.transformations.isometries_congruence',
  'st.g8.triangle_parts.triangle_inequality',
  'st.g9r.parallels_trapezoid.properties',
  'st.g9r.parallels_trapezoid.alternate_corresponding',
  'st.g9r.parallels_trapezoid.converse',
  'st.g9r.parallels_trapezoid.co_interior',
  'st.g9r.integrative_literacy.real_world_tasks',
  'st.g9m.percentages.part_of_whole',
  'st.g9m.percentages.increase_decrease',
  'st.g9m.parallels_and_parallelogram.review',
  'st.g9m.equations.numeric_denominator',
  'st.g9m.word_problems_integrative.literacy_contexts',
];

describe('prisa data (committed copy of all-units.csv + prisa PDFs)', () => {
  it('records each source path and sha256, and the build reads only this file', () => {
    assert.equal(raw.schema, 'noam-prisa-units/v1');
    assert.equal(raw.sources.units.path, 'פרויקט החלפת דפי חטיבת הביניים/reports/curriculum-mapping-20261116/all-units.csv');
    assert.equal(raw.sources.units.sha256, 'ea7641d4a492833a933c4e4f9d05d49b2f206c0755c771b479d09753fa9e232e');
    assert.equal(raw.sources.units.rows, 173);
    assert.match(raw.sources.landings.sha256, /^[0-9a-f]{64}$/);
    assert.match(raw.sources.landings.corrections.sha256, /^[0-9a-f]{64}$/);
    const prisa = { g7: 'prisa_7.pdf', g8: 'prisa_8.pdf', g9r: 'prisa_9A.pdf', g9m: 'prisa_9B.pdf' } as const;
    for (const track of raw.tracks) {
      assert.equal(
        track.source.url,
        `https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpaz/${prisa[track.key as keyof typeof prisa]}`
      );
      assert.match(track.source.sha256, /^[0-9a-f]{64}$/);
    }
    // No absolute local path ships in the bundle; no runtime read of the source.
    assert.equal(JSON.stringify(raw).includes('/Users/'), false);
    const lib = readFileSync(fromTest('../src/lib/prisaIndex.ts'), 'utf8');
    assert.doesNotMatch(lib, /node:fs|readFileSync|process\.cwd/);
  });

  it('has all 173 units once: ז 49, ח 37, ט רגילה 48, ט מצומצמת 39', () => {
    const counts = Object.fromEntries(PRISA_TRACK_KEYS.map((k) => [k, loadPrisaTrack(k).unitCount]));
    assert.deepEqual(counts, { g7: 49, g8: 37, g9r: 48, g9m: 39 });
    const ids = raw.tracks.flatMap((t: any) => t.months.flatMap((m: any) => m.units.map((u: any) => u.id)));
    assert.equal(ids.length, 173);
    assert.equal(new Set(ids).size, 173);
    const prefix = { g7: 'st.g7.', g8: 'st.g8.', g9r: 'st.g9r.', g9m: 'st.g9m.' } as Record<string, string>;
    for (const track of raw.tracks) {
      for (const month of track.months) {
        for (const unit of month.units) assert.ok(unit.id.startsWith(prefix[track.key]), unit.id);
      }
    }
  });

  it('lists months in school-year order, none empty, with official names and no slash fractions', () => {
    for (const track of raw.tracks) {
      const keys = track.months.map((m: any) => m.key);
      const order = keys.map((k: string) => PRISA_MONTH_KEYS.indexOf(k as any));
      assert.ok(order.every((i: number) => i >= 0), `${track.key} month keys`);
      assert.deepEqual(order, [...order].sort((a, b) => a - b), `${track.key} month order`);
      assert.equal(new Set(keys).size, keys.length);
      for (const month of track.months) {
        assert.ok(month.units.length > 0, `${track.key} ${month.key} is empty`);
        assert.ok(Number.isInteger(month.prisaPage) && month.prisaPage >= 2);
        for (const unit of month.units) {
          assert.ok(unit.name.trim().length > 3, unit.id);
          assert.equal(unit.name.includes('/'), false, `${unit.id} writes a slash`);
          if (unit.note) assert.equal(unit.note.includes('/'), false, unit.id);
        }
      }
    }
  });

  it('places reduced-track units in the prisa_9B months (verify.json corrections)', () => {
    const track = loadPrisaTrack('g9m');
    const monthOf = (id: string) => track.months.find((m) => m.units.some((u) => u.id === id))!.key;
    assert.deepEqual(track.months.map((m) => m.key), ['m09', 'm10', 'm11', 'm12', 'm01', 'm02', 'm03', 'm04', 'm05']);
    // prisa_9B p4: משוואות עם מכנה מספרי in ינואר (not the registry's topic-18 slot).
    assert.equal(monthOf('st.g9m.equations.numeric_denominator'), 'm01');
    assert.equal(monthOf('st.g9m.percentages.part_of_whole'), 'm11');
    assert.equal(monthOf('st.g9m.graph_reading.phenomena_axes'), 'm09');
    assert.equal(monthOf('st.g9m.areas_and_perimeters.polygons_and_circle'), 'm05');
    // prisa_9B p5: the quadratic-function properties are not taught this year.
    const quad = track.months.flatMap((m) => m.units).find((u) => u.id === 'st.g9m.quad_partial.table_and_graph')!;
    assert.equal(quad.primary?.href, '/quadratic-function-grade-9');
    assert.match(quad.note || '', /תכונות הפונקציה הריבועית לא נלמדות השנה/);
    const optional = track.months.flatMap((m) => m.units).filter((u) => u.optional).map((u) => u.id);
    assert.deepEqual(optional, ['st.g9m.linear_function.line_equation_optional']);
  });
});

describe('prisa links', () => {
  it('every page in the data is a served topic page of the same grade', () => {
    const served = new Set<string>(TOPIC_PAGE_SLUGS);
    for (const track of raw.tracks) {
      for (const month of track.months) {
        for (const unit of month.units) {
          for (const ref of unit.pages) {
            const slug = ref.split('#')[0];
            assert.ok(served.has(slug), `${unit.id} -> ${slug} is not served`);
            assert.equal(loadTopicPage(slug).grade, track.grade, `${unit.id} -> ${slug}`);
          }
        }
      }
    }
  });

  it('a unit without a served page is plain text; all others link their first page', () => {
    const noPage: string[] = [];
    for (const key of PRISA_TRACK_KEYS) {
      for (const unit of loadPrisaTrack(key).months.flatMap((m) => m.units)) {
        if (!unit.primary) {
          noPage.push(unit.id);
          assert.equal(unit.more.length, 0);
        }
      }
    }
    assert.deepEqual(noPage.sort(), [...NO_PAGE_UNITS].sort());
    const reduced = loadPrisaTrack('g9m');
    assert.equal(reduced.linkedUnitCount, 34);
    assert.equal(loadPrisaTrack('g7').linkedUnitCount, 49);
  });

  it('drops a page that is not served and refuses a missing section anchor', () => {
    assert.equal(resolvePrisaPage('no-such-page-grade-9', 9), null);
    assert.throws(() => resolvePrisaPage('kite-grade-9#no-such-anchor', 9), /no section anchor/);
    assert.throws(() => resolvePrisaPage('kite-grade-9', 8), /grade 9, expected 8/);
    assert.deepEqual(resolvePrisaPage('kite-grade-9', 9), { slug: 'kite-grade-9', href: '/kite-grade-9', label: 'דלתון' });
  });

  it('every rendered href is a page this site serves (internal-link check)', () => {
    const hrefs = prisaHrefs();
    assert.ok(hrefs.includes(REDUCED_HUB_PATH));
    assert.ok(hrefs.length > 100);
    const broken = hrefs.filter((href) => resolveSiteHref(href).reason !== 'local');
    assert.deepEqual(broken, []);
    for (const href of ['/grade-9#prisa', '/worksheets?grade=9&track=red']) {
      assert.equal(resolveSiteHref(href).reason, 'local', href);
    }
  });

  it('labels the extra-page chips with the topic H1 minus the grade words', () => {
    assert.equal(pageLabelWithoutGrade('זוויות לכיתה ז׳ — היכרות, סימון ומדידה'), 'זוויות — היכרות, סימון ומדידה');
    assert.equal(pageLabelWithoutGrade('סטטיסטיקה לכיתה ח׳: איסוף מידע'), 'סטטיסטיקה: איסוף מידע');
    assert.equal(pageLabelWithoutGrade('שטחים ב׳ חלק 2 — מצולעים מורכבים — לכיתה ט׳'), 'שטחים ב׳ חלק 2 — מצולעים מורכבים');
    assert.equal(pageLabelWithoutGrade('דלתון לכיתה ט׳'), 'דלתון');
    const angles = loadPrisaTrack('g9r').months.flatMap((m) => m.units)
      .find((u) => u.id === 'st.g9r.right_triangle_30_60_90.theorem_and_converse')!;
    assert.equal(angles.name, 'משולש ישר־זווית שזוויותיו 30°, 60°, 90° והמשפט ההפוך');
    assert.equal(angles.displayName, 'משולש ישר־זווית שזוויותיו \u206630°, 60°, 90°\u2069 והמשפט ההפוך');
    assert.equal(unitCountLabel(1), 'נושא אחד');
    assert.equal(unitCountLabel(7), '7 נושאים');
  });

  it('opens the current school month in Israel time; summer points to September', () => {
    assert.equal(currentPrisaMonthKey(NOW), 'm11');
    assert.equal(currentPrisaMonthKey(new Date('2026-11-30T23:30:00Z')), 'm12');
    assert.equal(currentPrisaMonthKey(new Date('2027-07-15T12:00:00Z')), 'm09');
    assert.equal(currentPrisaMonthKey(new Date('2027-08-31T12:00:00Z')), 'm09');
    assert.equal(currentPrisaMonthKey(new Date('2027-01-10T12:00:00Z')), 'm01');
  });

  it('grade hubs: 7 and 8 have one track, 9 has רגילה then מצומצמת; elementary none', () => {
    assert.deepEqual(prisaTracksForGrade(7).map((t) => t.key), ['g7']);
    assert.deepEqual(prisaTracksForGrade(8).map((t) => t.key), ['g8']);
    assert.deepEqual(prisaTracksForGrade(9).map((t) => t.shortLabel), ['ט׳ רגילה', 'ט׳ מצומצמת']);
    assert.deepEqual(prisaTracksForGrade(4), []);
  });
});

describe('/grade-9-reduced route, sitemap, nav and JSON-LD', () => {
  it('is in the pages sitemap, served locally and under the worksheets nav', () => {
    const keys = readdirSync(fromTest('../src/pages')).filter((n) => n.endsWith('.astro')).map((n) => `./${n}`);
    const xml = renderPagesSitemapXml(keys);
    assert.ok(xml.includes(`<loc>${SITE_CANONICAL_ORIGIN}${REDUCED_HUB_PATH}</loc>`));
    assert.equal(resolveSiteHref(REDUCED_HUB_PATH).reason, 'local');
    assert.equal(resolveActiveNav(REDUCED_HUB_PATH), 'worksheets');
    assert.equal(resolveWorksheetsNavBand(REDUCED_HUB_PATH), 'hatzava');
    assert.equal(resolveActiveNav('/grade-9'), 'worksheets');
  });

  it('ItemList lists all 39 units in order with absolute www URLs where a page exists', () => {
    const track = loadPrisaTrack('g9m');
    const ld = prisaItemListJsonLd(track, { name: 'נושאי הפריסה', path: REDUCED_HUB_PATH });
    assert.deepEqual(validateJsonLdDocument(ld), []);
    assert.deepEqual(jsonLdTypes(ld), ['ItemList']);
    assert.equal(ld.url, `${SITE_CANONICAL_ORIGIN}${REDUCED_HUB_PATH}`);
    assert.equal(ld.numberOfItems, 39);
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    assert.deepEqual(items.map((i) => i.position), Array.from({ length: 39 }, (_, i) => i + 1));
    assert.equal(items.filter((i) => typeof i.url === 'string').length, 34);
    for (const item of items) {
      assert.equal(item['@type'], 'ListItem');
      assert.ok(typeof item.name === 'string' && (item.name as string).length > 3);
      assert.equal(/[⁦-⁩]/.test(item.name as string), false, 'no bidi isolates in JSON-LD');
      if (item.url) assert.ok(String(item.url).startsWith(`${SITE_CANONICAL_ORIGIN}/`));
    }
    assert.equal(items[0].name, 'קריאת מידע מגרפים של תופעות במערכת צירים (ספטמבר)');
    const crumbs = breadcrumbList([
      { name: 'בית', path: '/' },
      { name: 'כיתה ט׳', path: '/grade-9' },
      { name: 'ט׳ מצומצמת', path: REDUCED_HUB_PATH },
    ]);
    assert.deepEqual(validateJsonLdDocument(crumbs), []);
  });
});

describe('TopicPage section anchors (optional, back-compatible)', () => {
  function rawPage(slug: string): TopicPageContent {
    return JSON.parse(readFileSync(fromTest(`../src/data/topic-pages/${slug}.json`), 'utf8'));
  }

  it('no current topic page declares an anchor, so every H2 renders as before', () => {
    for (const page of loadAllTopicPages()) {
      const headings = synthesizeBodyFlow(page).filter((b) => b.type === 'heading');
      assert.ok(headings.every((b) => !('anchor' in b)), page.slug);
    }
  });

  it('a section anchor reaches its heading, with or without a captured bodyFlow', () => {
    const withFlow = rawPage('kite-grade-9');
    assert.ok(withFlow.bodyFlow && withFlow.bodyFlow.length);
    withFlow.sections[1] = { ...withFlow.sections[1], anchor: 'common-mistakes' };
    validateTopicSectionAnchors(withFlow);
    const heading = synthesizeBodyFlow(withFlow).find((b) => b.type === 'heading' && b.text === 'טעויות נפוצות');
    assert.deepEqual(heading, { type: 'heading', text: 'טעויות נפוצות', anchor: 'common-mistakes' });

    const legacy = { ...withFlow, bodyFlow: undefined };
    const legacyHeading = synthesizeBodyFlow(legacy).find((b) => b.type === 'heading' && b.text === 'טעויות נפוצות');
    assert.deepEqual(legacyHeading, { type: 'heading', text: 'טעויות נפוצות', anchor: 'common-mistakes' });
    const plain = synthesizeBodyFlow(legacy).find((b) => b.type === 'heading' && b.text === 'הסבר ודוגמה');
    assert.deepEqual(plain, { type: 'heading', text: 'הסבר ודוגמה' });
  });

  it('rejects unsafe, reserved, duplicate and orphan anchors', () => {
    const base = rawPage('kite-grade-9');
    const withAnchors = (a: string | undefined, b?: string) => {
      const page = structuredClone(base);
      page.sections[0] = { ...page.sections[0], anchor: a };
      if (b !== undefined) page.sections[1] = { ...page.sections[1], anchor: b };
      return page;
    };
    assert.throws(() => validateTopicSectionAnchors(withAnchors('Bad Anchor')), /invalid section anchor/);
    assert.throws(() => validateTopicSectionAnchors(withAnchors('a/b')), /invalid section anchor/);
    assert.throws(() => validateTopicSectionAnchors(withAnchors('topic-levels')), /reserved topic- prefix/);
    assert.throws(() => validateTopicSectionAnchors(withAnchors('same', 'same')), /duplicate section anchor/);
    const orphan = structuredClone(base);
    orphan.sections[0] = { ...orphan.sections[0], heading: 'כותרת שלא מופיעה', anchor: 'orphan' };
    assert.throws(() => validateTopicSectionAnchors(orphan), /not on a rendered heading/);
    validateTopicSectionAnchors(withAnchors(undefined));
  });

  it('TopicPage renders the anchor as the H2 id', () => {
    const tpl = readFileSync(fromTest('../src/components/TopicPage.astro'), 'utf8');
    assert.match(tpl, /<h2 id=\{unit\.anchor\}>\{unit\.heading\}<\/h2>/);
    assert.match(tpl, /current = \{ heading: b\.text, anchor: b\.anchor, blocks: \[\] \}/);
  });
});

// Server-render the real components. Only the site shell (BaseLayout) and
// unrelated islands become <slot />; prisa components, data and libs are real.
const REAL = new Set(['PrisaMonthIndex.astro', 'PrisaUnitList.astro', 'grade-9-reduced.astro', 'TopicPage.astro', 'TopicWorksheetEditions.astro', 'TopicInline.astro']);
const componentCache = new Map<string, Promise<any>>();
function realComponent(rel: string) {
  if (!componentCache.has(rel)) {
    componentCache.set(rel, (async () => {
      const file = fromTest(rel);
      const options = { internalURL: 'astro/compiler-runtime', resultScopedSlot: true,
        renderScript: true, resolvePath: (specifier: string) => specifier };
      const bundled = await build({
        entryPoints: [file], bundle: true, write: false, format: 'esm', platform: 'node',
        plugins: [{ name: 'prisa-render-test', setup(builder) {
          builder.onResolve({ filter: /\?astro&type=style|\.css$/ }, (args) => ({ path: args.path, namespace: 'style' }));
          builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
          builder.onResolve({ filter: /\.astro$/ }, (args) => ({ path: resolve(args.resolveDir, args.path), namespace: 'astro-test' }));
          builder.onLoad({ filter: /.*/, namespace: 'astro-test' }, async (args) => {
            const source = REAL.has(basename(args.path)) ? readFileSync(args.path, 'utf8') : '<slot />';
            const compiled = await compileAstro(source, { ...options, filename: args.path });
            return { contents: compiled.code, loader: 'ts', resolveDir: dirname(args.path) };
          });
          builder.onResolve({ filter: /^astro\/(compiler-runtime|runtime\/)/ }, (args) => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
        } }],
      });
      return (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)).default;
    })());
  }
  return componentCache.get(rel)!;
}

async function render(rel: string, props: Record<string, unknown>, path = '/') {
  const container = await AstroContainer.create();
  const html = await container.renderToString(await realComponent(rel), {
    props, request: new Request(`https://prisa.test${path}`),
  });
  return parseHTML(`<!doctype html><html><body>${html}</body></html>`).document;
}

describe('rendered HTML', () => {
  it('/grade-9-reduced: one H1, nine month H2s, 39 units, 34 links, ItemList JSON-LD', async () => {
    const doc = await render('../src/pages/grade-9-reduced.astro', {}, REDUCED_HUB_PATH);
    const h1 = [...doc.querySelectorAll('h1')].map((h) => h.textContent.trim());
    assert.deepEqual(h1, ['מתמטיקה לכיתה ט׳ מצומצמת — דפי עבודה לפי הפריסה']);
    const months = [...doc.querySelectorAll('.prisa-hub__month')];
    assert.equal(months.length, 9);
    assert.deepEqual(months.map((m) => m.getAttribute('id')), loadPrisaTrack('g9m').months.map((m) => m.id));
    assert.equal(doc.querySelectorAll('.prisa-hub__month h2').length, 9);
    assert.equal(doc.querySelectorAll('li.prisa-unit').length, 39);
    assert.equal(doc.querySelectorAll('a.prisa-unit__link').length, 34);
    assert.equal(doc.querySelectorAll('li.prisa-unit[data-unit-linked="no"] a.prisa-unit__link').length, 0);
    const plain = [...doc.querySelectorAll('li.prisa-unit[data-unit-linked="no"]')].map((li) => li.getAttribute('data-unit-id'));
    assert.deepEqual(plain.sort(), NO_PAGE_UNITS.filter((id) => id.startsWith('st.g9m.')).sort());
    const lds = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
    assert.deepEqual(lds.map((ld) => ld['@type']), ['ItemList', 'LearningResource']);
    for (const ld of lds) assert.deepEqual(validateJsonLdDocument(ld), []);
    const hrefs = [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!);
    assert.ok(hrefs.includes('/worksheets?grade=9&track=red'));
    assert.ok(hrefs.includes('/grade-9#prisa'));
    for (const href of hrefs) {
      const reason = resolveSiteHref(href).reason;
      // Local pages, or the official prisa PDF on meyda.education.gov.il (media).
      assert.ok(reason === 'local' || (reason === 'media' && href.startsWith('https://meyda.education.gov.il/')), `${href} ${reason}`);
    }
    const text = doc.querySelector('main')!.textContent;
    assert.doesNotMatch(text, /\d\s*\/\s*\d/);
    assert.match(text, /במסלול המצומצם מציבים ערכים בלבד/);
  });

  it('grade 9 index: two native radios switch רגילה and מצומצמת; the current month is open', async () => {
    const doc = await render('../src/components/PrisaMonthIndex.astro', { grade: 9, now: NOW }, '/grade-9');
    const section = doc.querySelector('section#prisa')!;
    assert.ok(section);
    assert.equal(section.querySelector('h2')!.textContent.trim(), 'לפי הפריסה');
    const radios = [...section.querySelectorAll('input[type="radio"]')];
    assert.deepEqual(radios.map((r) => r.getAttribute('id')), ['prisa-track-g9r', 'prisa-track-g9m']);
    assert.equal(radios[0].hasAttribute('checked'), true);
    assert.equal(radios[1].hasAttribute('checked'), false);
    assert.deepEqual([...section.querySelectorAll('label.prisa-switch__option')].map((l) => l.textContent.trim()), ['ט׳ רגילה', 'ט׳ מצומצמת']);
    const panels = [...section.querySelectorAll('.prisa-index__panel')];
    assert.deepEqual(panels.map((p) => p.getAttribute('data-track')), ['g9r', 'g9m']);
    // Radios come before the panels, as the CSS sibling switch needs.
    const children = [...section.children];
    assert.ok(children.indexOf(radios[1]) < children.indexOf(panels[0]));
    assert.equal(panels[0].querySelectorAll('details.prisa-month').length, 9);
    assert.equal(panels[1].querySelectorAll('li.prisa-unit').length, 39);
    assert.equal(panels[0].querySelectorAll('li.prisa-unit').length, 48);
    const open = [...section.querySelectorAll('details[open]')].map((d) => d.getAttribute('id'));
    assert.deepEqual(open, ['prisa-g9r-m11', 'prisa-g9m-m11']);
    assert.equal(panels[1].querySelector(`a[href="${REDUCED_HUB_PATH}"]`)!.textContent.trim(), 'כל נושאי ט׳ מצומצמת בדף אחד');
    assert.equal(panels[0].querySelector(`a[href="${REDUCED_HUB_PATH}"]`), null);
    // "30°, 60°, 90°" is one unbroken LTR run inside the RTL link.
    const angles = section.querySelector('li[data-unit-id="st.g9r.right_triangle_30_60_90.theorem_and_converse"] a.prisa-unit__link')!;
    const math = [...angles.querySelectorAll('.prisa-math[dir="ltr"]')].map((m) => m.textContent);
    assert.deepEqual(math, ['30°, 60°, 90°']);
    assert.equal(/[\u2066-\u2069]/.test(angles.textContent), false);
    const css = readFileSync(fromTest('../src/styles/prisa-index.css'), 'utf8');
    assert.match(css, /#prisa-track-g9r:checked ~ \.prisa-index__panel\[data-track='g9m'\]/);
    assert.match(css, /#prisa-track-g9m:checked ~ \.prisa-index__panel\[data-track='g9r'\]/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\.prisa-math \{\s*white-space: nowrap;/);
  });

  it('grade 7 and 8 indexes have one track and no switch', async () => {
    for (const [grade, count] of [[7, 49], [8, 37]] as const) {
      const doc = await render('../src/components/PrisaMonthIndex.astro', { grade, now: new Date('2027-04-10T09:00:00Z') });
      assert.equal(doc.querySelectorAll('input[type="radio"]').length, 0);
      assert.equal(doc.querySelectorAll('.prisa-index__panel').length, 1);
      assert.equal(doc.querySelectorAll('li.prisa-unit').length, count);
      const open = [...doc.querySelectorAll('details[open]')].map((d) => d.getAttribute('data-month'));
      assert.deepEqual(open, grade === 7 ? ['m04'] : []);
    }
    const none = await render('../src/components/PrisaMonthIndex.astro', { grade: 3, now: NOW });
    assert.equal(none.querySelectorAll('section').length, 0);
  });

  it('a real topic landing still renders its H2s without ids', async () => {
    const doc = await render('../src/components/TopicPage.astro', { slug: 'kite-grade-9' }, '/kite-grade-9');
    const h2 = [...doc.querySelectorAll('.topic-page__section h2')];
    assert.ok(h2.length >= 3);
    assert.ok(h2.every((h) => !h.hasAttribute('id')));
  });
});

describe('links into the hub', () => {
  it('/grade-9 header and the home page link /grade-9-reduced; hubs 7–9 mount the index', () => {
    const hub = readFileSync(fromTest('../src/components/GradeHubPage.astro'), 'utf8');
    assert.match(hub, /grade === 9 && \(\s*<p class="grade-hub__track-link">\s*<a href=\{REDUCED_HUB_PATH\}>כיתה ט׳ מצומצמת — דפי עבודה לפי הפריסה<\/a>/);
    assert.match(hub, /\{grade >= 7 && <PrisaMonthIndex grade=\{grade\} \/>\}/);
    const home = readFileSync(fromTest('../src/pages/index.astro'), 'utf8');
    assert.match(home, /<p data-home-reduced-track[^>]*>\s*<a href="\/grade-9-reduced"[^>]*min-height:44px[^>]*>כיתה ט׳ מצומצמת — דפי עבודה לפי הפריסה<\/a>/);
  });
});
