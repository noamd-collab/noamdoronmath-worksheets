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

const require = createRequire(import.meta.url);
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

test('real algebra landing routes all three hero topics to distinct groups and exposes the three new PDFs', async () => {
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
      groups.flatMap(group => group.levels.map(level => level.href)));
    expectedLegacy.push(...groups.find(group => group.editionId === 'legacy')!.levels.map(level => level.href));
  }
  assert.equal(expectedLegacy.length, 9);
  assert.deepEqual([...hero.querySelectorAll('a[data-edition-id="legacy"]')].map(a => a.getAttribute('href')), expectedLegacy);
  const newPdfIds = ['b376976911234b758027329c9ea05cbf', 'b6a76fb3eccd477b9788958efefbded2', '0fe476657595498194b93cdc46e39e5f'];
  const additions = [...hero.querySelectorAll('a[data-edition-id="ms-20261115-alg-01-r1"]')];
  assert.deepEqual(additions.map(a => a.getAttribute('href')), newPdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
  assert.ok(additions.every(a => a.textContent.includes('פתיחת PDF') && !a.getAttribute('href')!.includes('viewer')));
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
    assert.deepEqual(pdfLinks.map(a => a.getAttribute('href')), pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    assert.ok(pdfLinks.every(a => a.textContent.includes('פתיחת PDF') && !a.textContent.includes('רמז')));
    additions += pdfLinks.length;
    if (slug === 'frequency-grade-7') {
      assert.equal(ctas[1].getAttribute('href'), '#topic-levels-hero-26');
      assert.ok(ctas[1].textContent.includes('תרגול נוסף'));
      assert.equal(hero.querySelectorAll('#topic-levels-hero-26').length, 1);
    }
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.equal(additions, 6);
});
