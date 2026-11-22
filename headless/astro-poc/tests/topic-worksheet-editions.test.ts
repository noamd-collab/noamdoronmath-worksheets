import { reviewedNext12 } from './fixtures/next12-pdf';
import { reviewedNext21 } from './fixtures/next21-pdf';
import { reviewedBatch01 } from './fixtures/batch01-pdf';
import { reviewedBatch02a } from './fixtures/batch02a-pdf';
import { reviewedBatch03 } from './fixtures/batch03-pdf';
import { reviewedProbabilityNine } from './fixtures/probability-nine-pdf';
import { reviewedBatch04 } from './fixtures/batch04-pdf';
import { reviewedBatch05 } from './fixtures/batch05-pdf';
import { reviewedBatch06 } from './fixtures/batch06-pdf';
import { reviewedSaoWpc } from './fixtures/sao-wpc-pdf';
import { reviewedExtSmlAfr } from './fixtures/ext-sml-afr-pdf';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform as compileAstro } from '@astrojs/compiler';
import { build, transform as parseJavaScript } from 'esbuild';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import type { CatalogEdition, CatalogV1 } from '../src/lib/catalog/types';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { loadTopicPage } from '../src/lib/topicPages';
import { reviewedEqnSgnFac } from './fixtures/eqn-sgn-fac-pdf';
import { reviewedBatch07 } from './fixtures/batch07-pdf';
import { reviewedBatch08 } from './fixtures/batch08-pdf';
import { reviewedBatch09 } from './fixtures/batch09-pdf';
import { reviewedBatch10 } from './fixtures/batch10-pdf';
import { reviewedBatch11 } from './fixtures/batch11-pdf';
import { reviewedBatch12 } from './fixtures/batch12-pdf';
import { reviewedBatch13 } from './fixtures/batch13-pdf';
import { reviewedPcm53 } from './fixtures/pcm53-pdf';
import { afterLandingCorrections } from './fixtures/landing-corrections-20261118';
import { afterRamziActivationCopy } from './fixtures/ramzi-activation-copy-20261119';

const require = createRequire(import.meta.url);
// The receipt-backed reviewed activation (headless/catalog/ramzi-additional-trust.v1.json)
// opens these editions' own PDFs in the Ramzi viewer; every other edition keeps its direct PDF link.
const reviewedPrefix = new Map<string, string>(JSON.parse(readFileSync(new URL('../../catalog/ramzi-additional-trust.v1.json', import.meta.url), 'utf8'))
  .scopes.map((s: any) => [s.scopeId, s.batch.nativePrefix]));
function assertEditionLinks(catalog: CatalogV1, links: Element[], editionId: string, pdfIds: string[]) {
  if (!reviewedPrefix.has(editionId)) {
    assert.deepEqual(links.map(a => a.getAttribute('href')), pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמז') && !a.getAttribute('href')!.includes('viewer')));
    return;
  }
  assert.deepEqual(links.map(a => { const u = new URL(a.getAttribute('href')!, 'https://example.test');
    return [u.pathname, u.searchParams.get('edition'), u.searchParams.get('x'), u.searchParams.get('pdf')]; }),
    pdfIds.map(id => ['/worksheet-viewer-noam.html', editionId, reviewedPrefix.get(editionId), id]));
  assert.ok(links.every(a => !a.textContent.includes('פתיחת PDF')));
}
const routes = [
  [7, 17, 'congruent-polygons-transformations-grade-7'],
  [8, 14, 'cylinder-volume-grade-8'],
  [8, 15, 'cone-grade-8'],
  [9, 7, 'parallelogram-grade-9'],
] as const;

function fixture(): CatalogV1 {
  const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')) as CatalogV1;
  for (const g of catalog.grades) for (const topic of g.topics) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
  for (const [grade, topicId] of routes) {
    const topic = catalog.grades.find(g => g.grade === grade)!.topics.find(t => t.id === topicId)!;
    topic.editions = [{
      editionId: 'test-pdf-only-r1', label: `תרגול ממוקד ${grade}:${topicId}`,
      status: 'published', publicationMode: 'pdf-only',
      routing: { resolvedNoamPrefix: null, aiHintShown: false, usesViewer: false,
        viewerPath: null, siblingPdfQuery: {} },
      levels: (['a', 'b', 'c'] as const).map((key, i) => ({
        key, label: ['רמה א׳', 'רמה ב׳', 'מצוינות'][i], labelSource: 'test',
        pdfId: `${grade}${topicId}${i}`.padEnd(32, '0'),
        viewerLevel: (['A', 'B', 'E'] as const)[i], worksheetId: `test-${grade}-${topicId}-${key}`,
        revision: 1, pdfSha256: '1'.repeat(64), sourceSha256: '2'.repeat(64), nativeExportSha256: '3'.repeat(64),
      })),
    }];
  }
  return catalog;
}

test('all four landing topics retain legacy links and expose three distinct direct-PDF additions', () => {
  const catalog = fixture();
  for (const [grade, topicId, slug] of routes) {
    const page = JSON.parse(readFileSync(new URL(`../src/data/topic-pages/${slug}.json`, import.meta.url), 'utf8'));
    assert.equal(page.grade, grade);
    assert.equal(page.catalogCta.catalogTopicId, topicId);
    const topic = catalog.grades.find(g => g.grade === grade)!.topics.find(t => t.id === topicId)!;
    const back = `/worksheets?grade=${grade}&topic=${topicId}`;
    const groups = topicWorksheetEditionLinks(catalog, grade, topicId, back);
    assert.deepEqual(groups.map(e => e.editionId), ['legacy', 'test-pdf-only-r1']);
    assert.equal(groups[0].pdfOnly, false);
    assert.equal(groups[1].pdfOnly, true);
    for (const [i, level] of groups[0].levels.entries()) {
      assert.equal(level.href, buildWorksheetHref({ catalog, grade, topic, levelKey: level.key,
        editionId: 'legacy', backPath: back }));
      const addition = groups[1].levels[i];
      assert.equal(addition.href, `${catalog.config.pdfBase}${topic.editions![0].levels[i].pdfId}.pdf`);
      assert.notEqual(addition.href, level.href);
      assert.ok(!addition.href.includes('worksheet-viewer'));
    }
  }
});

test('missing topics and unpublished editions stay hidden; an existing non-legacy default stays first', () => {
  const catalog = fixture();
  assert.deepEqual(topicWorksheetEditionLinks(catalog, 7, null, '/'), []);
  assert.deepEqual(topicWorksheetEditionLinks(catalog, 7, 999, '/'), []);
  const topic = catalog.grades.find(g => g.grade === 7)!.topics.find(t => t.id === 17)!;
  topic.editions!.push({ ...topic.editions![0], editionId: 'draft-secret', status: 'draft' } as unknown as CatalogEdition);
  assert.equal(topicWorksheetEditionLinks(catalog, 7, 17, '/').length, 2);
  topic.defaultEditionId = 'test-pdf-only-r1';
  assert.deepEqual(topicWorksheetEditionLinks(catalog, 7, 17, '/').map(e => e.editionId), ['test-pdf-only-r1', 'legacy']);
});

test('the real Astro control renders visible edition labels and every level link without a client island', async () => {
  const file = new URL('../src/components/TopicWorksheetEditions.astro', import.meta.url);
  const compiled = await compileAstro(readFileSync(file, 'utf8'), {
    filename: fileURLToPath(file), internalURL: 'astro/compiler-runtime', resultScopedSlot: true,
    renderScript: true, resolvePath: specifier => specifier,
  });
  const bundled = await build({
    stdin: { contents: compiled.code, loader: 'ts', resolveDir: dirname(fileURLToPath(file)) },
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'astro-static-test', setup(builder) {
      // Styles are checked by the normal Astro build; this test renders server markup.
      builder.onResolve({ filter: /\?astro&type=style/ }, args => ({ path: args.path, namespace: 'style' }));
      builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
      builder.onResolve({ filter: /^astro\/(compiler-runtime|runtime\/)/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
    } }],
  });
  const component = (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)).default;
  const container = await AstroContainer.create();
  const groups = topicWorksheetEditionLinks(fixture(), 8, 15, '/worksheets?grade=8&topic=15');
  const html = await container.renderToString(component, { props: { id: 'topic-levels', editions: groups } });
  const { document } = parseHTML(html);
  assert.equal(document.querySelectorAll('[data-topic-levels]').length, 1);
  assert.deepEqual([...document.querySelectorAll('strong')].map(e => e.textContent), groups.map(e => e.label));
  assert.equal(document.querySelectorAll('a').length, 6);
  assert.equal(document.querySelectorAll('[hidden], details, astro-island').length, 0);
  for (const group of groups) {
    const links = [...document.querySelectorAll(`a[data-edition-id="${group.editionId}"]`)];
    assert.deepEqual(links.map(e => e.getAttribute('href')), group.levels.map(l => l.href));
    if (group.pdfOnly) assert.ok(links.every(e => e.textContent.includes('פתיחת PDF')));
  }
  const single = await container.renderToString(component, { props: { id: 'topic-levels', editions: [groups[0]] } });
  const one = parseHTML(single).document;
  assert.equal(one.querySelectorAll('a').length, 3);
  assert.equal(one.querySelectorAll('strong, .topic-worksheet-edition-note').length, 0);
});

test('TopicPage uses the shared control in the header, hero and body and compiles', async () => {
  const file = new URL('../src/components/TopicPage.astro', import.meta.url);
  const source = readFileSync(file, 'utf8');
  assert.match(source, /editions=\{preEditions\}/);
  assert.match(source, /editions=\{group.editions\}/);
  assert.match(source, /editions=\{flowEditions\}/);
  const compiled = await compileAstro(source, { filename: fileURLToPath(file) });
  await parseJavaScript(compiled.code, { loader: 'ts' });
});

// Render the actual page, catalog loader and download controls together. Only
// the unrelated site shell/animations are omitted; no CTA or edition fixtures
// replace the production data, selection logic or href builder.
let topicPageComponent: Promise<any> | undefined;
function realTopicPage() {
  return topicPageComponent ??= (async () => {
    const file = new URL('../src/components/TopicPage.astro', import.meta.url);
    const options = { internalURL: 'astro/compiler-runtime', resultScopedSlot: true,
      renderScript: true, resolvePath: (specifier: string) => specifier };
    const bundled = await build({
      entryPoints: [fileURLToPath(file)], bundle: true, write: false,
      format: 'esm', platform: 'node',
      plugins: [{ name: 'topic-page-render-test', setup(builder) {
        builder.onResolve({ filter: /\?astro&type=style|\.css$/ }, args => ({ path: args.path, namespace: 'style' }));
        builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
        builder.onResolve({ filter: /\.astro$/ }, args => ({ path: resolve(args.resolveDir, args.path), namespace: 'astro-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'astro-test' }, async args => {
          const real = ['TopicPage.astro', 'TopicWorksheetEditions.astro', 'TopicInline.astro'].includes(basename(args.path));
          const compiled = await compileAstro(real ? readFileSync(args.path, 'utf8') : '<slot />', { ...options, filename: args.path });
          return { contents: compiled.code, loader: 'ts', resolveDir: dirname(args.path) };
        });
        builder.onResolve({ filter: /^astro\/(compiler-runtime|runtime\/)/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
      } }],
    });
    return (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)).default;
  })();
}

async function renderTopic(slug: string) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(await realTopicPage(), {
    props: { slug }, request: new Request(`https://topic.test/${slug}`),
  });
  return parseHTML(html).document;
}

test('the activated PAR-02/03/04 editions and the RAT base binding open their own PDFs in the Ramzi viewer on the real landings', async () => {
  const catalog = loadCatalog();
  const grade9: any = catalog.grades.find(g => g.grade === 9)!;
  const parTopic = grade9.topics.find((t: any) => t.id === 7);
  const parHero = (await renderTopic('parallelogram-grade-9')).querySelector('.exact-topic-copy')!;
  for (const editionId of ['ms-20261113-par-02-r1', 'ms-20261113-par-03-r1', 'ms-20261113-par-04-r1']) {
    assert.ok(reviewedPrefix.has(editionId), `${editionId}: trusted scope`);
    const edition = parTopic.editions.find((e: any) => e.editionId === editionId);
    const links = [...parHero.querySelectorAll(`a[data-edition-id="${editionId}"]`)];
    assert.equal(links.length, 3, `${editionId}: three level links`);
    assertEditionLinks(catalog, links, editionId, edition.levels.map((l: any) => l.pdfId));
  }
  const binding = grade9.topics.find((t: any) => t.id === 47).reviewedBaseBinding;
  assert.equal(binding.editionId, 'ms-20261115-rat-01-r1');
  const ratLinks = [...(await renderTopic('rational-equations-grade-9')).querySelector('.exact-topic-copy')!.querySelectorAll('a[data-edition-id="legacy"]')];
  assert.deepEqual(ratLinks.map(a => { const u = new URL(a.getAttribute('href')!, 'https://example.test');
    return [u.pathname, u.searchParams.get('edition'), u.searchParams.get('x'), u.searchParams.get('pdf')]; }),
    binding.levels.map((l: any) => ['/worksheet-viewer-noam.html', binding.editionId, reviewedPrefix.get(binding.editionId), l.pdfId]));
  assert.ok(ratLinks.every(a => !a.textContent.includes('פתיחת PDF')));
});

test('real equation, signed-number and factoring landings expose nine PDF links with the correct topic groups', async () => {
  const catalog = loadCatalog();
  for (const addition of reviewedEqnSgnFac.additions) {
    const document = await renderTopic(addition.slug);
    const hero = document.querySelector('.exact-topic-copy')!;
    const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
    assertEditionLinks(catalog, links, addition.editionId, addition.pdfIds);
    const text = document.querySelector('main')!.textContent.replace(/[\u2066-\u2069]/g, '');
    assert.ok(text.includes(reviewedEqnSgnFac.landingDeltas.find(d => d.slug === addition.slug)!.appendedSection.blocks[0].text));
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(ids).size, ids.length, `${addition.slug}: unique anchors`);
    if (addition.topicId === 32) {
      const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
      assert.deepEqual(ctas.map(link => link.getAttribute('data-catalog-topic')), ['23', '34', '32']);
      for (const cta of ctas) {
        const topicId = Number(cta.getAttribute('data-catalog-topic'));
        const target = cta.getAttribute('href')!;
        assert.equal(target, topicId === 23 ? '#topic-levels' : `#topic-levels-hero-${topicId}`);
        const control = hero.querySelector(target)!;
        const expected = topicWorksheetEditionLinks(catalog, 7, topicId, `/worksheets?grade=7&topic=${topicId}`);
        assert.deepEqual([...control.querySelectorAll('a')].map(a => a.getAttribute('href')), expected.flatMap(e => e.levels.map(l => l.href)));
        assert.equal(control.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`).length, topicId === 32 ? 3 : 0);
      }
    }
  }
});

test('real algebra landing routes all three hero topics to distinct groups and exposes the original PDFs and reviewed common-factor hints', async () => {
  const document = await renderTopic('algebraic-expressions-grade-7');
  const hero = document.querySelector('.exact-topic-copy')!;
  const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
  assert.deepEqual(ctas.map(a => a.getAttribute('data-catalog-topic')), ['30', '23', '22']);
  const catalog = loadCatalog();
  const expectedLegacy: string[] = [];
  for (const cta of ctas) {
    const topicId = Number(cta.getAttribute('data-catalog-topic'));
    const target = cta.getAttribute('href')!;
    assert.equal(target, topicId === 30 ? '#topic-levels' : `#topic-levels-hero-${topicId}`);
    const controls = hero.querySelectorAll(target);
    assert.equal(controls.length, 1, `one target for topic ${topicId}`);
    const groups = topicWorksheetEditionLinks(catalog, 7, topicId, `/worksheets?grade=7&topic=${topicId}`);
    assert.deepEqual([...controls[0].querySelectorAll('a')].map(a => a.getAttribute('href')),
      groups.flatMap(group => group.levels.flatMap(level =>
        level.partialHints ? [level.href, level.partialHints.href] : [level.href])));
    expectedLegacy.push(...groups.find(group => group.editionId === 'legacy')!.levels.map(level => level.href));
  }
  const commonFactorPdfIds = [
    '9023d70c7ee24eb185454683d723c60b', '58f6082fb2734aa2998fa899e3c02023', '5ae9b8d9161444b1b17df22793c172ab',
  ];
  const hintLinks = [...hero.querySelectorAll('#topic-levels a.partial-ramzi-link')];
  assert.deepEqual(hintLinks.map(link => link.getAttribute('href')), commonFactorPdfIds.map(id => `/ramzi-partial?pdf=${id}`));
  assert.equal(expectedLegacy.length, 9);
  assert.deepEqual([...hero.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')), expectedLegacy);
  const newPdfIds = ['b376976911234b758027329c9ea05cbf', 'b6a76fb3eccd477b9788958efefbded2', '0fe476657595498194b93cdc46e39e5f'];
  const additions = [...hero.querySelectorAll('a[data-edition-id="ms-20261115-alg-01-r1"]')];
  assertEditionLinks(catalog, additions, 'ms-20261115-alg-01-r1', newPdfIds);
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate anchors');
});

test('real single-topic hero retains one download group and direct level-B/excellence CTAs', async () => {
  const slug = 'congruence-theorems-grade-8';
  const document = await renderTopic(slug);
  const hero = document.querySelector('.exact-topic-copy')!;
  const page = loadTopicPage(slug);
  assert.deepEqual(page.catalogCtas.map(c => c.catalogTopicId), [37, 37, 37]);
  const groups = topicWorksheetEditionLinks(loadCatalog(), 8, 37, '/worksheets?grade=8&topic=37');
  assert.equal(hero.querySelectorAll('[data-topic-levels]').length, 1);
  const control = hero.querySelector('[data-topic-levels]')!;
  assert.equal(control.id, 'topic-levels');
  const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
  assert.deepEqual(ctas.map(a => a.getAttribute('href')), ['#topic-levels',
    groups[0].levels.find(level => level.key === 'b')!.href,
    groups[0].levels.find(level => level.key === 'c')!.href]);
  assert.deepEqual([...control.querySelectorAll('a')].map(a => a.getAttribute('href')),
    groups.flatMap(group => group.levels.map(level => level.href)));
  assert.equal(hero.querySelector('[data-topic-levels]')?.previousElementSibling, ctas.at(-1)!.parentElement);
});

test('the probability introduction landing pairs each 091 PDF with its reviewed reader and preserves the original edition', async () => {
  const catalog = loadCatalog();
  const document = await renderTopic('probability-introduction-grade-7');
  const group = document.querySelector('#topic-levels')!;
  const ids = ['1b11ff7dc82e4b05a85ea3a5dce99af5', 'b3be66e753874bdfa561d965dc62b63e', 'ae3bc69e774149e7befd969c4949b4a8'];
  const pdfLinks = [...group.querySelectorAll('a[data-edition-id="ms-20261121-pri-01-r1"]')];
  assert.deepEqual(pdfLinks.map(pdf => [pdf.getAttribute('href'), pdf.nextElementSibling?.getAttribute('href')]),
    ids.map(id => [`${catalog.config.pdfBase}${id}.pdf`, `/ramzi-partial?pdf=${id}`]));
  assert.equal(group.querySelectorAll('a.partial-ramzi-link').length, 3);
  const original = topicWorksheetEditionLinks(catalog, 7, 28, '/worksheets?grade=7&topic=28')
    .find(entry => entry.editionId === 'legacy')!;
  assert.deepEqual([...group.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')),
    original.levels.map(level => level.href));
});

test('both frequency landings expose six direct FRQ links while keeping their original topics and downloads', async () => {
  const catalog = loadCatalog();
  const editionId = 'ms-20261115-frq-01-r1';
  const pdfIds = ['941793a9b6614849bd5b7465c894ba87', '6cdddaac6d8c472580f2be5b4bdd0323', '659db2eb8dab43aaae976e9a669d503b'];
  let additions = 0;
  for (const [slug, expectedTopicIds] of [
    ['relative-frequency-grade-7', [26]], ['frequency-grade-7', [25, 26]],
  ] as const) {
    const page = loadTopicPage(slug);
    assert.equal(page.catalogCta.catalogTopicId, expectedTopicIds[0]);
    const document = await renderTopic(slug);
    const hero = document.querySelector('.exact-topic-copy')!;
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), [...expectedTopicIds]);
    const expectedLegacy = expectedTopicIds.flatMap(topicId =>
      topicWorksheetEditionLinks(catalog, 7, topicId, `/worksheets?grade=7&topic=${topicId}`)
        .find(group => group.editionId === 'legacy')!.levels.map(level => level.href));
    assert.deepEqual([...hero.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')), expectedLegacy);
    const pdfLinks = [...hero.querySelectorAll(`a[data-edition-id="${editionId}"]`)];
    assertEditionLinks(catalog, pdfLinks, editionId, pdfIds);
    additions += pdfLinks.length;
    if (slug === 'frequency-grade-7') {
      assert.equal(ctas[1].getAttribute('href'), '#topic-levels-hero-26');
      assert.ok(ctas[1].textContent.includes('תרגול נוסף'));
      assert.equal(hero.querySelectorAll('#topic-levels-hero-26').length, 1);
      const frequency090Ids = ['d1c095409f6b44c5b4b2b80493a5ec50', 'e1a2834fb3a14ca1be9d8fd85219100f', 'b2ac6fabde404b3d87570154b77c7b34'];
      const frequency090Links = [...hero.querySelectorAll('#topic-levels a[data-edition-id="ms-20261121-frq-02-r4"]')];
      assert.deepEqual(frequency090Links.map(pdf => [
        pdf.getAttribute('href'), pdf.nextElementSibling?.getAttribute('href'),
      ]), frequency090Ids.map(id => [`${catalog.config.pdfBase}${id}.pdf`, `/ramzi-partial?pdf=${id}`]));
      assert.equal(hero.querySelectorAll('#topic-levels-hero-26 a[data-edition-id="ms-20261121-frq-02-r4"]').length, 0);
    }
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.equal(additions, 6);
});


test('real EXT/SML/AFR pages expose nine distinct PDFs, with the shared SML secondary route preserving topic45', async () => {
  const catalog = loadCatalog();
  const urls = new Set<string>();
  for (const slug of [...reviewedExtSmlAfr.additions.map(a => a.slug), 'difference-of-squares-grade-9']) {
    const addition = reviewedExtSmlAfr.additions.find(a => a.slug === slug)
      ?? reviewedExtSmlAfr.additions.find(a => a.topicId === 44)!;
    const document = await renderTopic(slug);
    const hero = document.querySelector('.exact-topic-copy')!;
    const controls = slug === 'difference-of-squares-grade-9' ? document : hero;
    const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
    assertEditionLinks(catalog, links, addition.editionId, addition.pdfIds);
    for (const a of links) urls.add(a.getAttribute('href')!);
    const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
    const legacy = [...hero.querySelectorAll('a[data-edition-id="legacy"]')];
    assert.ok(legacy.length >= 3, `${slug}: old PDFs retained`);
    if (slug === 'difference-of-squares-grade-9') {
      assert.deepEqual([...document.querySelectorAll('a[data-catalog-topic]')].map(a => a.getAttribute('data-catalog-topic')), ['45', '44']);
      const secondaryCta = document.querySelector('a[data-catalog-topic="44"]')!;
      const secondary = document.querySelector(secondaryCta.getAttribute('href')!)!;
      assert.ok(secondary);
      assert.equal(secondary.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`).length, 3);
    }
  }
  assert.equal(urls.size, 9, 'secondary SML links do not duplicate worksheet inventory');
});

test('actual SAO/WPC pages expose six PDFs while preserving legacy 38 and 41/40/39 controls', async () => {
  const catalog = loadCatalog();
  for (const addition of reviewedSaoWpc.additions) {
    const document = await renderTopic(addition.slug), hero = document.querySelector('.exact-topic-copy')!;
    const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
    assert.deepEqual(links.map(l => l.getAttribute('href')), addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    assert.ok(links.every(l => l.textContent.includes('פתיחת PDF') && !l.textContent.includes('רמזי')));
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')], topics = addition.grade === 7 ? [41, 40, 39] : [38];
    assert.deepEqual(ctas.map(l => Number(l.getAttribute('data-catalog-topic'))), topics);
    const followingGroups = [...document.querySelectorAll('.exact-topic[data-topic-slug="equations-both-sides-word-problems-grade-7"] .exact-topic-copy > [data-topic-levels] + .topic-page__cta-row')];
    assert.deepEqual(followingGroups, addition.grade === 7 ? ctas.slice(1).map(cta => cta.parentElement) : [],
      'only the second and third WPC groups receive separation; not the first CTA or SAO');
    assert.deepEqual(followingGroups.map(group => group.previousElementSibling?.id),
      addition.grade === 7 ? ['topic-levels', 'topic-levels-hero-40'] : []);
    let legacyLinks = 0;
    for (const [i, cta] of ctas.entries()) {
      const topicId = topics[i], target = cta.getAttribute('href')!;
      assert.equal(target, i === 0 ? '#topic-levels' : `#topic-levels-hero-${topicId}`);
      const control = hero.querySelector(target)!;
      const expected = topicWorksheetEditionLinks(catalog, addition.grade, topicId, `/worksheets?grade=${addition.grade}&topic=${topicId}`);
      assert.deepEqual([...control.querySelectorAll('a')].map(a => a.getAttribute('href')), expected.flatMap(e => e.levels.map(l => l.href)));
      const legacy = [...control.querySelectorAll('a[data-edition-id="legacy"]')];
      assert.equal(legacy.length, 3); legacyLinks += legacy.length;
      assert.equal(control.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`).length, i === 0 ? 3 : 0);
    }
    assert.equal(legacyLinks, addition.grade === 7 ? 9 : 3);
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
    const text = document.querySelector('main')!.textContent.replace(/[\u2066-\u2069]/g, '');
    assert.ok(text.includes(reviewedSaoWpc.landingDeltas.find(d => d.slug === addition.slug)!.appendedSection.blocks[0].text));
  }
});

test('real next12 pages expose twelve PDFs and preserve shared perimeter44 then area18 with six old links', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  for (const slug of ['trapezoid-grade-9', 'similar-triangles-grade-9', 'area-rectangle-perimeter-grade-7']) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedNext12.additions.filter(a => a.slug === slug);
    const topics = slug === 'area-rectangle-perimeter-grade-7' ? [44, 18] : [additions[0].topicId];
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), topics);
    const separated = [...document.querySelectorAll('.exact-topic[data-topic-slug="area-rectangle-perimeter-grade-7"] .exact-topic-copy > [data-topic-levels] + .topic-page__cta-row')];
    assert.equal(separated.length, topics.length === 2 ? 1 : 0);
    if (separated.length) {
      assert.equal(separated[0], ctas[1].parentElement, 'only the following area group receives separation');
      assert.equal(separated[0].previousElementSibling?.id, 'topic-levels');
    }
    for (const [index, topicId] of topics.entries()) {
      const addition = additions.find(a => a.topicId === topicId)!;
      const target = index === 0 ? '#topic-levels' : `#topic-levels-hero-${topicId}`;
      assert.equal(ctas[index].getAttribute('href'), target);
      const controls = hero.querySelector(target)!;
      const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(a => a.getAttribute('href')), addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
      assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמזי')));
      links.forEach(a => urls.add(a.getAttribute('href')!));
      const expectedOld = topicWorksheetEditionLinks(catalog, addition.grade, topicId, `/worksheets?grade=${addition.grade}&topic=${topicId}`)[0].levels.map(l => l.href);
      assert.deepEqual([...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')), expectedOld);
    }
    assert.equal(hero.querySelectorAll('a[data-edition-id="legacy"]').length, topics.length * 3);
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.equal(urls.size, 12);
});

test('real next21 pages expose twenty-one PDFs only in their mapped groups and preserve both shared CTA orders', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  for (const addition of reviewedNext21.additions) {
    const document = await renderTopic(addition.slug), hero = document.querySelector('.exact-topic-copy')!;
    const topics = addition.slug === 'area-parallelogram-trapezoid-composite-grade-7' ? [46, 45]
      : addition.slug === 'patterns-and-graphs-grade-7' ? [31, 21] : [addition.topicId];
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), topics);
    for (const [index, topicId] of topics.entries()) {
      const target = index === 0 ? '#topic-levels' : `#topic-levels-hero-${topicId}`;
      assert.equal(ctas[index].getAttribute('href'), target);
      const controls = hero.querySelector(target)!;
      assert.ok(controls, `${addition.slug}: group${topicId}`);
      const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assertEditionLinks(catalog, links, addition.editionId, topicId === addition.topicId ? addition.pdfIds : []);
      links.forEach(a => urls.add(a.getAttribute('href')!));
      const oldLinks = topicWorksheetEditionLinks(catalog, addition.grade, topicId, `/worksheets?grade=${addition.grade}&topic=${topicId}`)[0].levels.map(l => l.href);
      assert.deepEqual([...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')), oldLinks);
    }
    assert.equal(hero.querySelectorAll('a[data-edition-id="legacy"]').length, topics.length * 3);
    const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(anchors).size, anchors.length, `${addition.slug}: unique anchors`);
  }
  assert.equal(urls.size, 21);
});

test('real batch-01 pages expose twelve PDFs in their single topic group after every earlier choice', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  for (const addition of reviewedBatch01.additions) {
    const document = await renderTopic(addition.slug), hero = document.querySelector('.exact-topic-copy')!;
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), [addition.topicId]);
    assert.equal(ctas[0].getAttribute('href'), '#topic-levels');
    const controls = hero.querySelector('#topic-levels')!;
    assert.ok(controls, `${addition.slug}: topic group`);
    const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
    assert.deepEqual(links.map(a => a.getAttribute('href')), addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמזי')));
    links.forEach(a => urls.add(a.getAttribute('href')!));
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, `/worksheets?grade=${addition.grade}&topic=${addition.topicId}`);
    const legacy = [...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href'));
    assert.deepEqual(legacy, groups[0].levels.map(l => l.href));
    assert.equal(legacy.length, addition.topicId === 54 && addition.grade === 8 ? 4 : 3);
    const order = [...controls.querySelectorAll('a[data-edition-id]')].map(a => a.getAttribute('data-edition-id'));
    assert.deepEqual([...new Set(order)], ['legacy', ...addition.baselineEditionIds, addition.editionId]);
    const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(anchors).size, anchors.length, `${addition.slug}: unique anchors`);
  }
  assert.equal(urls.size, 12);
});

test('real batch-02a pages expose forty-eight PDFs only in their mapped group and preserve every CTA and old link', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  for (const addition of reviewedBatch02a.additions) {
    const document = await renderTopic(addition.slug), hero = document.querySelector('.exact-topic-copy')!;
    // equations-advanced-grade-7 keeps its four hero topics (38, 23, 37, 36); the edition joins 37 only.
    const topics = addition.ctaTopics;
    assert.ok(topics.includes(addition.topicId), addition.slug);
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), topics);
    for (const [index, topicId] of topics.entries()) {
      const target = index === 0 ? '#topic-levels' : `#topic-levels-hero-${topicId}`;
      assert.equal(ctas[index].getAttribute('href'), target);
      const controls = hero.querySelector(target)!;
      assert.ok(controls, `${addition.slug}: group${topicId}`);
      const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(a => a.getAttribute('href')), topicId === addition.topicId
        ? addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`) : []);
      assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמזי')));
      links.forEach(a => urls.add(a.getAttribute('href')!));
      const groups = topicWorksheetEditionLinks(catalog, addition.grade, topicId, `/worksheets?grade=${addition.grade}&topic=${topicId}`);
      assert.deepEqual([...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')), groups[0].levels.map(l => l.href));
      const order = [...controls.querySelectorAll('a[data-edition-id]')].map(a => a.getAttribute('data-edition-id'));
      const laterIds = [...reviewedBatch05.additions, ...reviewedBatch06.additions, ...reviewedBatch08.additions, ...reviewedBatch09.additions]
        .filter(a => a.grade === addition.grade && a.topicId === topicId).map(a => a.editionId);
      assert.deepEqual([...new Set(order)], topicId === addition.topicId
        ? ['legacy', ...addition.baselineEditionIds, addition.editionId, ...laterIds] : groups.map(g => g.editionId));
    }
    assert.equal(hero.querySelectorAll('a[data-edition-id="legacy"]').length, topics.length * 3);
    const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(anchors).size, anchors.length, `${addition.slug}: unique anchors`);
  }
  assert.equal(urls.size, 48);
});

test('real batch-03 pages expose twenty-four PDFs only in their mapped group, two series on 9/8, after every earlier choice', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  for (const addition of reviewedBatch03.additions) {
    const document = await renderTopic(addition.slug), hero = document.querySelector('.exact-topic-copy')!;
    assert.deepEqual(addition.ctaTopics, [addition.topicId]);
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), [addition.topicId]);
    assert.equal(ctas[0].getAttribute('href'), '#topic-levels');
    const controls = hero.querySelector('#topic-levels')!;
    assert.ok(controls, `${addition.slug}: topic group`);
    const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
    assert.deepEqual(links.map(a => a.getAttribute('href')), addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמזי')));
    links.forEach(a => urls.add(a.getAttribute('href')!));
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, `/worksheets?grade=${addition.grade}&topic=${addition.topicId}`);
    const legacy = [...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href'));
    assert.deepEqual(legacy, groups[0].levels.map(l => l.href));
    assert.equal(legacy.length, 3);
    // G9-QIN-01 and G9-SYQ-01 share topic 9/8: both follow the legacy links, in registry order.
    const sameTopic = reviewedBatch03.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId);
    const laterBatch06 = reviewedBatch06.additions
      .filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId);
    const laterBatch07 = reviewedBatch07.additions
      .filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId);
    const order = [...controls.querySelectorAll('a[data-edition-id]')].map(a => a.getAttribute('data-edition-id'));
    // Batch 11 (18.11) adds G9-QFR-01 on 9/6 after G9-QFM-01.
    const laterBatch11 = reviewedBatch11.additions
      .filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId);
    assert.deepEqual([...new Set(order)], ['legacy', ...addition.baselineEditionIds, ...sameTopic, ...laterBatch06, ...laterBatch07, ...laterBatch11]);
    for (const earlier of addition.baselineEditionIds) assert.equal(controls.querySelectorAll(`a[data-edition-id="${earlier}"]`).length, 3);
    const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(anchors).size, anchors.length, `${addition.slug}: unique anchors`);
  }
  assert.equal(urls.size, 24);
});

test('the real grade-9 probability page exposes nine PDFs in three series after the legacy links only', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  const [first] = reviewedProbabilityNine.additions;
  assert.ok(reviewedProbabilityNine.additions.every(a => a.slug === first.slug && a.grade === 9 && a.topicId === 10));
  const document = await renderTopic(first.slug), hero = document.querySelector('.exact-topic-copy')!;
  const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
  assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), [10]);
  assert.equal(ctas[0].getAttribute('href'), '#topic-levels');
  const controls = hero.querySelector('#topic-levels')!;
  assert.ok(controls, 'topic group');
  for (const addition of reviewedProbabilityNine.additions) {
    assert.deepEqual(addition.ctaTopics, [10]);
    const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
    assert.deepEqual(links.map(a => a.getAttribute('href')), addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמזי')));
    links.forEach(a => urls.add(a.getAttribute('href')!));
  }
  const groups = topicWorksheetEditionLinks(catalog, 9, 10, '/worksheets?grade=9&topic=10');
  const legacy = [...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href'));
  assert.deepEqual(legacy, groups[0].levels.map(l => l.href));
  assert.equal(legacy.length, 3);
  const order = [...controls.querySelectorAll('a[data-edition-id]')].map(a => a.getAttribute('data-edition-id'));
  const laterBatch06 = reviewedBatch06.additions
    .filter(a => a.grade === 9 && a.topicId === 10).map(a => a.editionId);
  assert.deepEqual([...new Set(order)], ['legacy', ...reviewedProbabilityNine.additions.map(a => a.editionId), ...laterBatch06]);
  const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
  assert.equal(new Set(anchors).size, anchors.length, 'unique anchors');
  assert.equal(urls.size, 9);
});

test('real batch-04 pages expose twelve PDFs only in their mapped group and preserve every CTA and old link', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  for (const addition of reviewedBatch04.additions) {
    const document = await renderTopic(addition.slug), hero = document.querySelector('.exact-topic-copy')!;
    // solids-box-cube-prism-grade-7 keeps its three hero topics (48, 47, 20); the prism edition joins 48 only.
    const topics = addition.ctaTopics;
    assert.ok(topics.includes(addition.topicId), addition.slug);
    assert.deepEqual(addition.baselineEditionIds, []);
    const ctas = [...hero.querySelectorAll('a[data-catalog-topic]')];
    assert.deepEqual(ctas.map(a => Number(a.getAttribute('data-catalog-topic'))), topics);
    let legacyLinks = 0;
    for (const [index, topicId] of topics.entries()) {
      const target = index === 0 ? '#topic-levels' : `#topic-levels-hero-${topicId}`;
      assert.equal(ctas[index].getAttribute('href'), target);
      const controls = hero.querySelector(target)!;
      assert.ok(controls, `${addition.slug}: group${topicId}`);
      const links = [...controls.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(a => a.getAttribute('href')), topicId === addition.topicId
        ? addition.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`) : []);
      assert.ok(links.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמזי')));
      links.forEach(a => urls.add(a.getAttribute('href')!));
      const groups = topicWorksheetEditionLinks(catalog, addition.grade, topicId, `/worksheets?grade=${addition.grade}&topic=${topicId}`);
      const legacy = [...controls.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href'));
      assert.deepEqual(legacy, groups[0].levels.map(l => l.href));
      // Topic 8/43 keeps its four legacy levels (a, b, c, c2); every other topic here has three.
      assert.equal(legacy.length, addition.grade === 8 && topicId === 43 ? 4 : 3);
      legacyLinks += legacy.length;
      const order = [...controls.querySelectorAll('a[data-edition-id]')].map(a => a.getAttribute('data-edition-id'));
      assert.deepEqual([...new Set(order)], topicId === addition.topicId ? ['legacy', addition.editionId] : groups.map(g => g.editionId));
    }
    assert.equal(hero.querySelectorAll('a[data-edition-id="legacy"]').length, legacyLinks);
    assert.equal(hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`).length, 3);
    // As #494 did for its multi-topic landings, the shared grade-7 landing separates consecutive
    // worksheet groups: the second and third hero groups, not the first CTA and not the other pages.
    const separated = [...document.querySelectorAll('.exact-topic[data-topic-slug="solids-box-cube-prism-grade-7"] .exact-topic-copy > [data-topic-levels] + .topic-page__cta-row')];
    assert.deepEqual(separated, topics.length > 1 ? ctas.slice(1).map(cta => cta.parentElement) : []);
    assert.deepEqual(separated.map(group => group.previousElementSibling?.id), topics.length > 1 ? ['topic-levels', 'topic-levels-hero-47'] : []);
    const anchors = [...document.querySelectorAll('[id]')].map(e => e.id);
    assert.equal(new Set(anchors).size, anchors.length, `${addition.slug}: unique anchors`);
  }
  assert.equal(urls.size, 12);
  assert.match(readFileSync(new URL('../src/styles/exact-topic.css', import.meta.url), 'utf8'),
    /\.exact-topic\[data-topic-slug="solids-box-cube-prism-grade-7"\] \.exact-topic-copy > \[data-topic-levels\] \+ \.topic-page__cta-row,\n/);
});

test('real batch-05 pages expose all 33 direct PDFs in their mapped edition groups', async () => {
  const catalog = loadCatalog(), urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch05.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedBatch05.additions.filter(addition => addition.slug === slug);
    for (const addition of additions) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `${catalog.config.pdfBase}${level.pdfId}.pdf`));
      assert.equal(links.length, 3, `${slug}/${addition.editionId}: all three levels`);
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
    }
    const delta = reviewedBatch05.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[\u2066-\u2069]/g, '');
    // The 18 Nov landing corrections may rewrite a reviewed sentence; the page shows the corrected text.
    assert.ok(mainText.includes(afterLandingCorrections(slug, delta.appendedSection.blocks[0].text)), `${slug}: reviewed landing section`);
    assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length >= 3, `${slug}: old downloads remain`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 10);
  assert.equal(urls.size, 33);
  const reduced = reviewedBatch05.additions.filter(addition => ['G9-DIS-01', 'G9-EQD-01'].includes(addition.sheetId));
  assert.ok(reduced.every(addition => addition.edition.label.includes('ט׳ מצומצמת')));
  const enrichment = reviewedBatch05.additions.find(addition => addition.sheetId === 'G9-POW-02')!;
  assert.ok(enrichment.edition.label.includes('העשרה'));
});

test('real batch-06 pages expose all 33 direct PDFs in their mapped edition groups', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch06.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedBatch06.additions.filter(addition => addition.slug === slug);
    for (const addition of additions) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.equal(links.length, 3, `${slug}/${addition.editionId}: all three levels`);
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
    }
    const delta = reviewedBatch06.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[\u2066-\u2069]/g, '');
    assert.ok(mainText.includes(delta.appendedSection.blocks[0].text), `${slug}: reviewed landing section`);
    assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length >= 3, `${slug}: old downloads remain`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 9);
  assert.equal(urls.size, 33);
  const reduced = reviewedBatch06.additions.filter(addition =>
    ['G9-GRD-01', 'G9-PBM-01', 'G9-QFM-01', 'G9-QVL-01', 'G9-SMM-01'].includes(addition.sheetId));
  assert.equal(reduced.length, 5);
  assert.ok(reduced.every(addition => addition.track === 'ט_מצומצמת'
    && addition.edition.label.includes('ט׳ מצומצמת')));
});

test('real batch-07 pages expose all 9 direct PDFs in their mapped edition groups', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch07.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedBatch07.additions.filter(addition => addition.slug === slug);
    for (const addition of additions) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.equal(links.length, 3, `${slug}/${addition.editionId}: all three levels`);
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
    }
    const delta = reviewedBatch07.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[\u2066-\u2069]/g, '');
    assert.ok(mainText.includes(delta.appendedSection.blocks[0].text), `${slug}: reviewed landing section`);
    assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length >= 3, `${slug}: old downloads remain`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 3);
  assert.equal(urls.size, 9);
  const reduced = reviewedBatch07.additions.filter(addition => addition.sheetId === 'G9-LNM-01');
  assert.equal(reduced.length, 1);
  assert.ok(reduced.every(addition => addition.track === 'ט_מצומצמת'
    && addition.edition.label.includes('ט׳ מצומצמת')));
});

test('real batch-08 pages expose all 15 direct PDFs in their mapped edition groups', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch08.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedBatch08.additions.filter(addition => addition.slug === slug);
    for (const addition of additions) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.equal(links.length, 3, `${slug}/${addition.editionId}: all three levels`);
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
    }
    const delta = reviewedBatch08.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[\u2066-\u2069]/g, '');
    assert.ok(mainText.includes(delta.appendedSection.blocks[0].text), `${slug}: reviewed landing section`);
    assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length >= 3, `${slug}: old downloads remain`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 5);
  assert.equal(urls.size, 15);
  const reduced = reviewedBatch08.additions.filter(addition => ['G9-RHM-01', 'G9-SQM-01'].includes(addition.sheetId));
  assert.equal(reduced.length, 2);
  assert.ok(reduced.every(addition => addition.track === 'ט_מצומצמת'
    && addition.edition.label.includes('ט׳ מצומצמת')));
});

test('real batch-09 pages expose all 18 direct PDFs in their mapped edition groups', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch09.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedBatch09.additions.filter(addition => addition.slug === slug);
    for (const addition of additions) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.equal(links.length, 3, `${slug}/${addition.editionId}: all three levels`);
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
    }
    const delta = reviewedBatch09.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[⁦-⁩]/g, '');
    for (const block of delta.appendedSection.blocks) assert.ok(mainText.includes(afterRamziActivationCopy(slug, block.text)), `${slug}: reviewed landing section`);
    assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length >= 3, `${slug}: old downloads remain`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 6);
  assert.equal(urls.size, 18);
  const reduced = reviewedBatch09.additions.filter(addition => addition.sheetId === 'G9-STR-01');
  assert.equal(reduced.length, 1);
  assert.ok(reduced.every(addition => addition.track === 'ט_מצומצמת'
    && addition.edition.label.includes('ט׳ מצומצמת')));
});

test('real batch-10 pages expose all 18 direct PDFs in their mapped edition groups', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch10.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    const additions = reviewedBatch10.additions.filter(addition => addition.slug === slug);
    for (const addition of additions) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.equal(links.length, 3, `${slug}/${addition.editionId}: all three levels`);
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
    }
    const delta = reviewedBatch10.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[⁦-⁩]/g, '');
    for (const block of delta.appendedSection.blocks) assert.ok(mainText.includes(afterRamziActivationCopy(slug, block.text)), `${slug}: reviewed landing section`);
    assert.ok(!mainText.includes('נועם AI'), `${slug}: no Noam AI hint copy`);
    assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length >= 3, `${slug}: old downloads remain`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 6);
  assert.equal(urls.size, 18);
  // G9-QSH-01 is a later edition on 9/5, after G9-QVL-01 (batch 6).
  const quadratic = await renderTopic('quadratic-function-grade-9');
  const groups = [...new Set([...quadratic.querySelector('.exact-topic-copy')!.querySelectorAll('a[data-edition-id]')]
    .map(link => link.getAttribute('data-edition-id')))];
  assert.deepEqual(groups, ['legacy', 'ms-20261117-qvl-01-r1', 'ms-20261118-qsh-01-r1']);
});

test('real batch-11 pages expose all 12 direct PDFs after the earlier editions of their topics', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch11.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    for (const addition of reviewedBatch11.additions.filter(item => item.slug === slug)) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
      const groups = [...new Set([...hero.querySelectorAll('a[data-edition-id]')].map(link => link.getAttribute('data-edition-id')))];
      assert.deepEqual(groups, ['legacy', ...addition.baselineEditionIds, addition.editionId], `${slug}: later edition after the earlier ones`);
    }
    const delta = reviewedBatch11.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[⁦-⁩]/g, '');
    for (const block of delta.appendedSection.blocks) assert.ok(mainText.includes(afterRamziActivationCopy(slug, block.text)), `${slug}: reviewed landing section`);
    assert.ok(!mainText.includes('נועם AI'), `${slug}: no Noam AI hint copy`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 4);
  assert.equal(urls.size, 12);
});

test('the real batch-12 page exposes the three ANG-02 PDFs after the earlier editions of topic 7/12', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch12.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    for (const addition of reviewedBatch12.additions.filter(item => item.slug === slug)) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
      const groups = [...new Set([...hero.querySelectorAll('a[data-edition-id]')].map(link => link.getAttribute('data-edition-id')))];
      assert.deepEqual(groups, ['legacy', ...addition.baselineEditionIds, addition.editionId], `${slug}: later edition after the earlier ones`);
    }
    const delta = reviewedBatch12.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[⁦-⁩]/g, '');
    for (const block of delta.appendedSection.blocks) assert.ok(mainText.includes(afterRamziActivationCopy(slug, block.text)), `${slug}: reviewed landing section`);
    assert.ok(!mainText.includes('נועם AI'), `${slug}: no Noam AI hint copy`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 1);
  assert.equal(urls.size, 3);
});

test('real batch-13 pages expose all 30 direct PDFs as the first edition after the old worksheets of their topics', async () => {
  const urls = new Set<string>();
  const slugs = [...new Set(reviewedBatch13.additions.map(addition => addition.slug))];
  for (const slug of slugs) {
    const document = await renderTopic(slug), hero = document.querySelector('.exact-topic-copy')!;
    for (const addition of reviewedBatch13.additions.filter(item => item.slug === slug)) {
      const links = [...hero.querySelectorAll(`a[data-edition-id="${addition.editionId}"]`)];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        addition.edition.levels.map(level => `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`));
      assert.ok(links.every(link => link.textContent.includes('פתיחת PDF')
        && !link.textContent.includes('רמזי') && !link.getAttribute('href')!.includes('viewer')));
      links.forEach(link => urls.add(link.getAttribute('href')!));
      const groups = [...new Set([...hero.querySelectorAll('a[data-edition-id]')].map(link => link.getAttribute('data-edition-id')))];
      assert.deepEqual(groups, ['legacy', ...addition.baselineEditionIds, addition.editionId], `${slug}: the PDF edition after the old worksheets`);
      assert.ok(hero.querySelectorAll('a[data-edition-id="legacy"]').length > 0, `${slug}: the old worksheets stay`);
    }
    const delta = reviewedBatch13.landingDeltas.find(item => item.slug === slug)!;
    const mainText = document.querySelector('main')!.textContent.replace(/[⁦-⁩]/g, '');
    assert.ok(mainText.includes(delta.appendedSection.heading), `${slug}: reviewed landing heading`);
    for (const block of delta.appendedSection.blocks) assert.ok(mainText.includes(block.text), `${slug}: reviewed landing section`);
    assert.ok(!mainText.includes('נועם AI'), `${slug}: no Noam AI hint copy`);
    const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: unique anchors`);
  }
  assert.equal(slugs.length, 10);
  assert.equal(urls.size, 30);
});

test('the new reduced-track landing percentages-grade-9 exposes exactly the three reviewed PCM PDFs and no hint tool', async () => {
  const document = await renderTopic('percentages-grade-9'), hero = document.querySelector('.exact-topic-copy')!;
  const pdfs = reviewedPcm53.pdfIds.map(id => `https://static.wixstatic.com/ugd/d8e7ad_${id}.pdf`);
  const hrefs = [...hero.querySelectorAll('a[href]')].map(link => link.getAttribute('href')!);
  assert.deepEqual(hrefs.filter(href => href.includes('static.wixstatic.com')), pdfs);
  assert.ok(hrefs.every(href => !href.includes('viewer')), 'no viewer link');
  const mainText = document.querySelector('main')!.textContent.replace(/[⁦-⁩]/g, '');
  assert.ok(!/רמזי|רמזים|נועם AI/.test(mainText), 'no hint tool on a PDF-only topic');
  const anchors = [...document.querySelectorAll('[id]')].map(element => element.id);
  assert.equal(new Set(anchors).size, anchors.length, 'unique anchors');
});
