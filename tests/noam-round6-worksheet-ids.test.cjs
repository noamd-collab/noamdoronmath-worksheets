'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

// Round 6 (grades 3 and 6). Each old Wix media id is replaced by the new one.
const pairs = [
  ['g3-t7-c', 3, 7, 'c', 'c56f00dc2cea45f9b2d5419e32905a5b', '22813f57f1034c7b80df73e6e9496470'],
  ['g3-t8-c', 3, 8, 'c', '652a1fb7418e41e5839d61b95251303a', '1296a0ef1ab440d68f1e3c9e10425c97'],
  ['g3-t8-a', 3, 8, 'a', 'c579c4f978274253ba29af6ba8da4661', 'd20fd2994fe64cd3997be592ef561653'],
  ['g3-t8-b', 3, 8, 'b', '69da324200a74e408a80d2106f2033c3', '52340dcb35954cc8bdfe933387bf16e1'],
  ['g3-t19-c', 3, 19, 'c', '88f49314d9c2498f9c86302eb3b0c373', '2e182f19f2c54e76beb131f96776c21e'],
  ['g3-t19-a', 3, 19, 'a', 'ed57ab38a2f44bd18228d010f57cdfc1', 'a480f051c7344ba2ab8fd3935c09faa7'],
  ['g3-t19-b', 3, 19, 'b', '7cce3054ea8e4899ae903677c141f058', '5bbc525274c241fcbe747582964ece8a'],
  ['g3-t20-c', 3, 20, 'c', '108e6d047d00490b9499a1e80171b2fe', 'e6fae3d718084454ba5a185b3a9f14a2'],
  ['g3-t20-a', 3, 20, 'a', '026062778c5e44b0b34f4945bedda34f', '0efc9bdb7f8c4350b067c45ae2f68a3e'],
  ['g3-t20-b', 3, 20, 'b', 'd9d2a864cd754df8a0d0a4de77d90e8b', 'bddfb8950fdd49ba9e5feb0a6fdbb672'],
  ['g3-t24-c', 3, 24, 'c', 'c7b404e2a8604ebda53acdb8764c2d9b', '6c93f766bbed4704b34ef616cf3b2281'],
  ['g3-t24-a', 3, 24, 'a', '3f0642dc56b74ae7999a58732368cf68', '73ee7605ba8f442db3725b63eae596b0'],
  ['g3-t24-b', 3, 24, 'b', '4591b9e193264cad8fc7c1c35a09e010', '3ee8b06ccfa6415ca9fc87eafa0cd2b1'],
  ['g6-t21-c', 6, 21, 'c', '366d3e1d5f4745359cfa5b1afc32ff3a', 'e76fe2ed7c15497da019eb0989b0a0b1'],
  ['g6-t23-c', 6, 23, 'c', '5b8cf4a731194480ba7ae7b209dbd6e1', '84592328cbd3460f9fa860ec5aa536f3'],
  ['g6-t23-a', 6, 23, 'a', '6134fd28ceef44dea885a9a10818c26f', '5845c92848604001a850327cc12b9233'],
  ['g6-t23-b', 6, 23, 'b', '5cf26d7842c94b9fa3a9ed286689257f', '144b323401d547b5b0d7251e415d701b'],
  ['g6-t24-c', 6, 24, 'c', 'a4d9b10a5ec9440cbb72aeea32b15e05', '87c7df37ef5d4319badccbc7fb49ba35'],
  ['g6-t24-a', 6, 24, 'a', '023bea915d664537ab3f8ebc5c54019a', '7411d987d16044fd865e7a4388042850'],
  ['g6-t24-b', 6, 24, 'b', 'c5ccf54cbd2144f5a650ac6edbdf4aa9', '0cae47513a4c4701add68eb94159551d'],
  ['g6-t25-c', 6, 25, 'c', 'a14eb0b9e66a4bc69ccc39e36bf4273a', 'cbb330d419134c1992b8e796aa47d836'],
  ['g6-t25-a', 6, 25, 'a', 'ef41934296044efeb6f8e36c80c7a1e3', '5c38d44d6eed4484bcb4dc43ea80f14d'],
  ['g6-t25-b', 6, 25, 'b', 'fdd86091d2d34c81ae2e008fd5b4b09b', '91645de7a8294cbfb6c0643ce8a87949']
];

const files = [
  'index.html',
  'noam-learning-catalog.js',
  'headless/catalog/catalog.v1.json',
  'headless/astro-poc/src/data/catalog.v1.json',
  'headless/astro-poc/public/noam-learning-catalog.js',
  'headless/astro-poc/public/legacy-github/index.html',
  'noam-ai/site-companion/DEPLOY_WIX/backend/noam-site-catalog.js'
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function count(text, id) {
  let n = 0;
  let from = 0;
  while (true) {
    const at = text.indexOf(id, from);
    if (at < 0) return n;
    n += 1;
    from = at + id.length;
  }
}

test('round 6: the 23 new media ids are present and the 23 old ids are absent', () => {
  for (const rel of files) {
    const text = read(rel);
    for (const row of pairs) {
      const oldId = row[4];
      const newId = row[5];
      assert.equal(count(text, oldId), 0, oldId + ' still in ' + rel);
      assert.equal(count(text, newId), 1, newId + ' missing or duplicated in ' + rel);
    }
  }
});

function catalogPdf(catalog, grade, topicId, level) {
  const g = catalog.grades.find((row) => row.grade === grade);
  const topic = g.topics.find((row) => row.id === topicId);
  return topic.levels.find((row) => row.key === level).pdfId;
}

function loadCatalogJs(rel) {
  const text = read(rel);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(text.slice(start, end + 1));
}

function loadLearning(rel) {
  const text = read(rel).trim();
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  return JSON.parse(json);
}

function loadData(rel) {
  const text = read(rel);
  const start = text.indexOf('var DATA = {');
  const end = text.indexOf('\n};', start);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(text.slice(start, end + 3), ctx);
  return ctx.DATA;
}

test('round 6: each catalog entry keeps its topic and level and points at the new id', () => {
  const catalogs = [
    'headless/catalog/catalog.v1.json',
    'headless/astro-poc/src/data/catalog.v1.json'
  ].map((rel) => JSON.parse(read(rel)));
  catalogs.push(loadCatalogJs('noam-ai/site-companion/DEPLOY_WIX/backend/noam-site-catalog.js'));
  const learning = [
    'noam-learning-catalog.js',
    'headless/astro-poc/public/noam-learning-catalog.js'
  ].map(loadLearning);
  const pages = [
    'index.html',
    'headless/astro-poc/public/legacy-github/index.html'
  ].map(loadData);

  for (const [entryId, grade, topicId, level, , newId] of pairs) {
    for (const catalog of catalogs) {
      assert.equal(catalogPdf(catalog, grade, topicId, level), newId, entryId);
    }
    for (const rows of learning) {
      const row = rows.find((item) => item.id === entryId);
      assert.equal(row.pdf, newId, entryId);
      assert.equal(row.g, grade);
      assert.equal(row.t, topicId);
      assert.equal(row.l, level);
    }
    for (const data of pages) {
      assert.equal(data[grade].links[topicId][level], newId, entryId);
    }
  }
});
