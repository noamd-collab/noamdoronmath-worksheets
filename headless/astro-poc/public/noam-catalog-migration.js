(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root) return;
  root.NoamCatalogMigration = api;
  if (root.location && root.NoamCatalogMigrations) {
    var next = api.resolve(root.location.href, root.NoamCatalogMigrations);
    if (next) root.location.replace(next);
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function resolve(href, migrations) {
    var url;
    try { url = new URL(href); } catch (_) { return null; }
    if (url.pathname !== '/worksheet-viewer-noam.html' || !migrations || migrations.schemaVersion !== 1) return null;
    var p = url.searchParams, id = (p.get('pdf') || '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(id)) return null;
    var target = migrations.byPdf && migrations.byPdf[id];
    if (!target || !target.original || target.pdfId === id || !/^[0-9a-f]{32}$/.test(target.pdfId) ||
        !/^G[789]-T\d{2}$/.test(target.prefix) || ![7, 8, 9].includes(target.grade) ||
        !/^(?:a|b|c|one)$/.test(target.level) || target.prefix.indexOf('G' + target.grade + '-') !== 0) return null;
    if (p.get('x') !== target.original.prefix || Number(p.get('g')) !== target.original.grade ||
        (p.get('lv') !== target.original.level && !(target.original.level === 'one' && p.get('lv') === 'b'))) return null;
    // Replace the complete sheet bundle, including level switches. Old thread
    // storage is keyed by PDF, so it cannot migrate onto a different question.
    p.set('pdf', target.pdfId); p.set('x', target.prefix); p.set('g', String(target.grade)); p.set('lv', target.level);
    p.set('t', target.title);
    if (!p.has('back')) p.set('back', '/worksheets?grade=' + target.original.grade);
    if (!p.has('topic') && Number.isInteger(target.topicId)) p.set('topic', String(target.topicId));
    ['pa', 'pb', 'pc', 'pc2'].forEach(function (key) {
      var value = target.siblings && target.siblings[key];
      if (/^[0-9a-f]{32}$/.test(value || '')) p.set(key, value); else p.delete(key);
    });
    // Selection IDs and page positions belonged to the old document.
    ['exercise', 'exerciseId', 'question', 'page'].forEach(function (key) { p.delete(key); });
    url.hash = '';
    return url.href;
  }
  return { resolve: resolve };
});
