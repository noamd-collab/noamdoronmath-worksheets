(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NoamVisualData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var CAPTIONS = {
    operations: 'עץ הפעולות של הביטוי או המשוואה הנתונים. המספרים והמשתנים הועתקו מהשאלה; לא חושבה תוצאה ולא נפתרה משוואה.',
    table: 'הנתונים כפי שנכתבו בטבלה המקורית. סימן שאלה מציין תא ריק; לא הושלמו תוצאות.',
    'bar-chart': 'המחשת הערכים המספריים הנתונים בטבלה. לא חושבו שכיחויות, סכומים או ערכים חדשים.'
  };
  function safe(value, depth) {
    if (depth > 24) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.length <= 24000;
    if (!value || typeof value !== 'object' || Object.keys(value).length > 50) return false;
    var p = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && p !== Object.prototype && p !== null) return false;
    return Object.keys(value).every(function (key) {
      var d = Object.getOwnPropertyDescriptor(value, key);
      return !/^(?:__proto__|constructor|prototype)$/.test(key) && d && !d.get && !d.set && safe(d.value, depth + 1);
    });
  }
  function keys(value, allowed, required) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(function (key) { return allowed.indexOf(key) >= 0; }) && required.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); });
  }
  function fail(reason) { return { ok: false, scene: null, reason: reason }; }
  function plain(value) {
    return String(value).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[−–]/g, '-').trim();
  }
  // This parser only groups supplied symbols. It has no evaluator, variable
  // substitution, property access, executable strings or external references.
  function expression(raw, allowLeaf, spellings) {
    if (typeof raw !== 'string' || !raw || raw.length > 200) return null;
    if (raw.includes('=')) {
      var sides = raw.split('=');
      if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return null;
      var a = expression(sides[0], true, spellings), b = expression(sides[1], true, spellings);
      if (!a || !b) return null;
      var combined = { type: 'operator', value: '=', children: [a, b] }, total = 0, maxDepth = 0;
      (function visit(n, d) { total++; maxDepth = Math.max(maxDepth, d); n.children.forEach(function (child) { visit(child, d + 1); }); })(combined, 1);
      if (total > 31 || maxDepth > 7) return null;
      if (spellings) spellings.set(combined, raw.trim());
      return combined;
    }
    var text = plain(raw).replace(/\\(?:left|right)/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
      .replace(/\\f(?=\{)/g, '\\frac').replace(/[×·]/g, '*').replace(/[÷:]/g, '/').replace(/²/g, '^2').replace(/³/g, '^3');
    if (/[^0-9A-Za-z+*/^().{}\\\s-]/.test(text) || /[A-Za-z]{2}/.test(text.replace(/\\frac/g, '')) || /[fghFGH]\s*\(/.test(text) || /\d[eE][+-]?\d/.test(text)) return null;
    var index = 0, count = 0, groups = 0, starts = spellings ? new Map() : null;
    function skip() { while (index < text.length && /\s/.test(text[index])) index++; }
    function node(type, value, children, start) {
      if (++count > 31) throw Error('large');
      var n = { type: type, value: value, children: children || [] };
      if (spellings) { if (start === undefined) start = starts.get(n.children[0]); starts.set(n, start); spellings.set(n, text.slice(start, index).trim()); }
      return n;
    }
    function group(open, close) {
      skip(); var start = index; if (text[index++] !== open || ++groups > 6) throw Error('group');
      var value = add(); skip(); if (text[index++] !== close) throw Error('group'); groups--;
      if (spellings) { starts.set(value, start); spellings.set(value, text.slice(start, index).trim()); } return value;
    }
    function atom() {
      skip(); var start = index;
      if (text.slice(index, index + 5) === '\\frac') { index += 5; return node('operator', '÷', [group('{', '}'), group('{', '}')], start); }
      if (text[index] === '(') return group('(', ')');
      if (text[index] === '{') return group('{', '}');
      if (/[A-Za-z]/.test(text[index] || '')) return node('symbol', text[index++], [], start);
      var match = text.slice(index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
      if (!match || !Number.isFinite(Number(match[0])) || Number(match[0]) > 10000) throw Error('number');
      index += match[0].length; return node('number', match[0], [], start);
    }
    function power() {
      var left = atom(); skip();
      if (text[index] === '^') {
        index++; skip(); var exponent = text[index] === '{' ? group('{', '}') : atom();
        if (exponent.type !== 'number' || !/^[0-9]$/.test(exponent.value)) throw Error('exponent');
        left = node('operator', '^', [left, exponent]);
      }
      return left;
    }
    function unary() { skip(); var start = index; if (text[index] === '+' || text[index] === '-') return node('operator', text[index++] === '-' ? '−' : '+', [unary()], start); return power(); }
    function multiply() {
      var left = unary();
      while (true) {
        skip(); var token = text[index];
        if (token === '*' || token === '/') { index++; left = node('operator', token === '*' ? '×' : '÷', [left, unary()]); }
        else if (token && (/[A-Za-z]/.test(token) || token === '(' || token === '{' || token === '\\')) left = node('operator', '×', [left, unary()]);
        else return left;
      }
    }
    function add() { var left = multiply(); while (true) { skip(); var token = text[index]; if (token !== '+' && token !== '-') return left; index++; left = node('operator', token === '+' ? '+' : '−', [left, multiply()]); } }
    function depth(tree) { return 1 + Math.max.apply(null, [0].concat(tree.children.map(depth))); }
    try { var tree = add(); skip(); if (index !== text.length || !(allowLeaf || tree.type === 'operator') || depth(tree) > 7) return null; if (spellings) spellings.set(tree, raw.trim()); return tree; } catch (_error) { return null; }
  }
  function mathSpans(text) {
    var spans = [], re = /\$([^$\n]+)\$|\\\(([^\n]+?)\\\)/g, m;
    while ((m = re.exec(text))) spans.push(m[1] || m[2]);
    return spans;
  }
  function completeExpressions(text) {
    var spans = mathSpans(text);
    if (spans.length) return spans;
    // Consume complete mathematical runs, not candidate-sized substrings. A
    // partial number or an operand sliced from a larger token cannot be proof.
    return (String(text || '').match(/[0-9A-Za-z+*/^().{}\\\s−–×·÷:=²³-]+/g) || []).map(function (span) { return span.trim(); }).filter(Boolean);
  }
  function givenExpression(target, source, quote, hint) {
    var expected = JSON.stringify(target);
    function find(n) { if (!n) return null; if (JSON.stringify(n) === expected) return n; for (var child of n.children) { var found = find(child); if (found) return found; } return null; }
    var hintFocus = null;
    for (var span of completeExpressions(source)) {
      // Evidence stays literal. It must quote the entire authored expression
      // containing a focus, even when the candidate uses another spelling.
      if (!quote.includes(span)) continue;
      var spellings = new Map(), tree = expression(span, false, spellings), selected = find(tree);
      if (!selected) continue;
      if (selected !== tree) {
        if (hintFocus === null) hintFocus = completeExpressions(hint).some(function (value) { return !!find(expression(value)); });
        if (!hintFocus) continue;
      }
      return { expression: spellings.get(selected) || span, tree: selected };
    }
    return null;
  }
  function newScope(text) { return /(?:משולש|מלבן|ריבוע|מנסרה|צורה|גוף|טבלה)\s+(?:ה)?(?:חדש|חדשה|אחר|אחרת|שונה)|(?:^|[^א-ת])(?:משנים|שנו|הגדילו|הקטינו|מחליפים|החליפו)(?=$|[^א-ת])/.test(text); }
  function cell(value) {
    if (typeof value !== 'string' || value.length > 160 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
    var text = plain(value).replace(/^\$([\s\S]*)\$$/, '$1').replace(/^\\\(([\s\S]*)\\\)$/, '$1');
    return !text || /^(?:\?|[_.…\s]|\\_)+$/.test(text) ? '?' : text;
  }
  function table(value) {
    if (!safe(value, 0) || !keys(value, ['head', 'rows'], ['head', 'rows']) || !Array.isArray(value.head) || !Array.isArray(value.rows) || value.head.length < 2 || value.head.length > 6 || value.rows.length < 1 || value.rows.length > 20) return null;
    if (!value.head.every(function (v) { return typeof v === 'string' && cell(v) !== null; }) || !value.rows.every(function (row) { return Array.isArray(row) && row.length === value.head.length && row.every(function (v) { return cell(v) !== null; }); })) return null;
    return { head: value.head.map(cell), rows: value.rows.map(function (row) { return row.map(cell); }) };
  }
  function numberCell(text) { return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) && Number.isFinite(Number(text)) && Math.abs(Number(text)) <= 100000 ? Number(text) : null; }
  function chart(value) {
    return value.head.length === 2 && value.head.every(function (v) { return v !== '?'; }) && value.rows.length <= 13 && value.rows.every(function (row) { return row[0] !== '?' && row[0].length <= 40 && numberCell(row[1]) !== null; }) && new Set(value.rows.map(function (row) { return row[0]; })).size === value.rows.length && chartRows(value).length > 0 && chartRows(value).length <= 12;
  }
  function chartRows(value) { return value.rows.filter(function (row) { return !/^(?:סך\s+הכ[ו]?ל|סה[״"]כ|total)$/i.test(row[0]); }); }
  function inspect(plan, context) {
    if (!safe(plan, 0) || !keys(plan, ['version', 'status', 'family', 'expression', 'tableSource', 'evidence'], ['version', 'status', 'family', 'evidence']) || plan.version !== 2 || plan.status !== 'ok' || !Object.prototype.hasOwnProperty.call(CAPTIONS, plan.family)) return fail('invalid-plan');
    if (!context || typeof context.questionText !== 'string' || typeof context.partText !== 'string' || context.questionText.length > 24000 || context.partText.length > 24000) return fail('invalid-context');
    if (!Array.isArray(plan.evidence) || !plan.evidence.length || plan.evidence.length > 4) return fail('missing-evidence');
    for (var i = 0; i < plan.evidence.length; i++) {
      var e = plan.evidence[i], text = e && e.source === 'question' ? context.questionText : e && e.source === 'part' ? context.partText : null;
      if (!keys(e, ['source', 'quote'], ['source', 'quote']) || typeof e.quote !== 'string' || !e.quote.trim() || e.quote.length > 2000 || text === null || !text.includes(e.quote)) return fail('evidence-mismatch');
    }
    var scene = { version: 2, kind: 'typed-' + plan.family, caption: CAPTIONS[plan.family] };
    if (plan.family === 'operations') {
      if (Object.prototype.hasOwnProperty.call(plan, 'tableSource') || typeof plan.expression !== 'string') return fail('invalid-operations');
      var tree = expression(plan.expression); if (!tree) return fail('unsupported-expression');
      var matches = plan.evidence.map(function (e) { return { source: e.source, proof: givenExpression(tree, e.source === 'part' ? context.partText : context.questionText, e.quote, context.hintText) }; }).filter(function (match) { return match.proof; });
      if (!matches.length) return fail('expression-not-given');
      var inPart = matches.some(function (e) { return e.source === 'part'; });
      if (!inPart && (newScope(context.partText) || mathSpans(context.partText).some(function (v) { return expression(v) !== null; }))) return fail('selected-part-scope');
      var selected = matches.find(function (match) { return match.source === 'part'; }) || matches[0];
      scene.expression = selected.proof.expression; scene.tree = selected.proof.tree;
    } else {
      if (Object.prototype.hasOwnProperty.call(plan, 'expression') || !/^(?:question|part)$/.test(plan.tableSource || '') || !plan.evidence.some(function (e) { return e.source === plan.tableSource; })) return fail('invalid-table-source');
      if (plan.tableSource === 'question' && (context.partTable || newScope(context.partText))) return fail('selected-part-scope');
      var data = table(plan.tableSource === 'part' ? context.partTable : context.questionTable); if (!data) return fail('unsupported-table');
      if (plan.family === 'bar-chart' && !chart(data)) return fail('incomplete-chart-data');
      scene.table = data;
    }
    return { ok: true, scene: scene, reason: null };
  }
  function validScene(scene) {
    if (!safe(scene, 0) || !keys(scene, ['version', 'kind', 'caption', 'expression', 'tree', 'table'], ['version', 'kind', 'caption']) || scene.version !== 2 || typeof scene.kind !== 'string') return false;
    var family = scene.kind.replace(/^typed-/, '');
    if (scene.kind !== 'typed-' + family || !Object.prototype.hasOwnProperty.call(CAPTIONS, family) || scene.caption !== CAPTIONS[family]) return false;
    if (family === 'operations') return !('table' in scene) && !!expression(scene.expression) && JSON.stringify(expression(scene.expression)) === JSON.stringify(scene.tree);
    var t = table(scene.table);
    return !('expression' in scene) && !('tree' in scene) && !!t && JSON.stringify(t) === JSON.stringify(scene.table) && (family !== 'bar-chart' || chart(t));
  }
  function el(doc, name, attrs, text) { var n = doc.createElementNS(NS, name); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, String(attrs[k])); }); if (text !== undefined) n.textContent = text; return n; }
  function text(doc, svg, x, y, value, size, rtl) { svg.appendChild(el(doc, 'text', { x: x, y: y, 'text-anchor': 'middle', 'font-size': size || 18, fill: '#27364a', direction: rtl ? 'rtl' : 'ltr', 'unicode-bidi': 'isolate' }, value)); }
  function svg(doc, figure, width, height, caption) { var s = el(doc, 'svg', { viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': caption }); s.style.cssText = 'display:block;width:100%;height:auto;font-family:Heebo,Arial,sans-serif;background:white'; figure.appendChild(s); return s; }
  function paragraph(doc, figure, value, math) { var p = doc.createElement('div'); p.style.cssText = 'text-align:center;font-size:19px;line-height:1.7;margin:8px 0;overflow-wrap:anywhere;direction:' + (math ? 'ltr' : 'rtl'); p.textContent = value; figure.appendChild(p); }
  function mathNode(doc, value) {
    var tree = expression(value); if (!tree) return doc.createTextNode(value);
    var ns = 'http://www.w3.org/1998/Math/MathML';
    function make(name, text) { var n = doc.createElementNS(ns, name); if (text !== undefined) n.textContent = text; return n; }
    function draw(n) {
      if (n.type !== 'operator') return make(n.type === 'number' ? 'mn' : 'mi', n.value);
      var row = make(n.value === '÷' ? 'mfrac' : n.value === '^' ? 'msup' : 'mrow');
      if (n.value === '÷' || n.value === '^') { n.children.forEach(function (child) { row.appendChild(draw(child)); }); return row; }
      row.appendChild(make('mo', '('));
      if (n.children.length === 1) row.appendChild(make('mo', n.value));
      n.children.forEach(function (child, i) { if (i) row.appendChild(make('mo', n.value)); row.appendChild(draw(child)); });
      row.appendChild(make('mo', ')')); return row;
    }
    var math = make('math'); math.setAttribute('dir', 'ltr'); math.appendChild(draw(tree)); return math;
  }
  function renderTable(doc, figure, data) {
    var scroll = doc.createElement('div'); scroll.style.cssText = 'overflow-x:auto;max-width:100%';
    var t = doc.createElement('table'); t.setAttribute('dir', 'rtl'); t.style.cssText = 'border-collapse:collapse;width:100%;font-size:17px;text-align:center';
    function row(values, header) { var tr = doc.createElement('tr'); values.forEach(function (value) { var td = doc.createElement(header ? 'th' : 'td'); if (header) td.setAttribute('scope', 'col'); td.style.cssText = 'padding:10px;border:1px solid #d8e4ef;min-width:65px;overflow-wrap:anywhere;' + (header ? 'background:#edf5fc' : ''); var span = doc.createElement('bdi'); span.setAttribute('dir', /[א-ת]/.test(value) ? 'rtl' : 'ltr'); span.appendChild(mathNode(doc, value)); td.appendChild(span); tr.appendChild(td); }); return tr; }
    var head = doc.createElement('thead'); head.appendChild(row(data.head, true)); var body = doc.createElement('tbody'); data.rows.forEach(function (r) { body.appendChild(row(r, false)); }); t.appendChild(head); t.appendChild(body); scroll.appendChild(t); figure.appendChild(scroll);
  }
  function render(doc, scene) {
    if (!doc || !validScene(scene)) return null;
    var figure = doc.createElement('figure'); figure.className = 'noam-geometry noam-visual-data'; figure.setAttribute('data-visual-kind', scene.kind); figure.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #d8e4ef;border-radius:14px;background:white';
    if (scene.kind === 'typed-operations') {
      paragraph(doc, figure, 'סדר הפעולות בביטוי הנתון'); var formula = doc.createElement('div'); formula.style.cssText = 'text-align:center;direction:ltr;font-size:22px;margin:10px 0'; formula.appendChild(mathNode(doc, scene.expression)); figure.appendChild(formula);
      var leaves = [], nodes = [], maxDepth = 0;
      function layout(tree, depth) { var n = { value: tree.value, depth: depth, type: tree.type, children: [] }; nodes.push(n); maxDepth = Math.max(maxDepth, depth); if (!tree.children.length) { n.slot = leaves.length; leaves.push(n); } else { n.children = tree.children.map(function (child) { return layout(child, depth + 1); }); n.slot = n.children.reduce(function (sum, child) { return sum + child.slot; }, 0) / n.children.length; } return n; }
      layout(scene.tree, 0); var width = Math.max(360, leaves.length * 64), height = maxDepth * 70 + 85, s = svg(doc, figure, width, height, scene.caption);
      function x(n) { return (n.slot + .5) * width / leaves.length; } function y(n) { return n.depth * 70 + 35; }
      nodes.forEach(function (n) { n.children.forEach(function (child) { s.appendChild(el(doc, 'line', { x1: x(n), y1: y(n), x2: x(child), y2: y(child), stroke: '#9bb2c8', 'stroke-width': 2 })); }); });
      nodes.forEach(function (n) { s.appendChild(el(doc, n.type === 'operator' ? 'circle' : 'rect', n.type === 'operator' ? { cx: x(n), cy: y(n), r: 23, fill: '#e8f2fc', stroke: '#1769aa' } : { x: x(n) - 29, y: y(n) - 21, width: 58, height: 42, rx: 8, fill: 'white', stroke: '#9bb2c8' })); text(doc, s, x(n), y(n) + 6, n.value, String(n.value).length > 5 ? 14 : 20); });
      paragraph(doc, figure, scene.tree.value === '=' ? 'פתרון: ?' : 'תוצאה: ?');
    } else if (scene.kind === 'typed-table') renderTable(doc, figure, scene.table);
    else {
      var data = scene.table, rows = chartRows(data), values = rows.map(function (r) { return numberCell(r[1]); }), low = Math.min.apply(null, [0].concat(values)), high = Math.max.apply(null, [0].concat(values));
      var span = high - low || 1, chartWidth = 480, start = 190, end = 420, height = rows.length * 54 + 110, chartSvg = svg(doc, figure, chartWidth, height, scene.caption);
      var px = function (v) { return start + (v - low) / span * (end - start); }, zero = px(0);
      paragraph(doc, figure, data.head[0] + ' · ' + data.head[1]);
      chartSvg.appendChild(el(doc, 'line', { x1: zero, y1: 22, x2: zero, y2: height - 45, stroke: '#27364a', 'stroke-width': 2 }));
      text(doc, chartSvg, zero, height - 18, '0', 16);
      rows.forEach(function (r, i) { var y = i * 54 + 40, value = values[i], edge = px(value); chartSvg.appendChild(el(doc, 'rect', { x: Math.min(edge, zero), y: y - 13, width: Math.max(0, Math.abs(edge - zero)), height: 26, rx: 3, fill: value < 0 ? '#8a69ac' : '#2c80b9', 'data-value': r[1] })); text(doc, chartSvg, 87, y + 6, r[0], r[0].length > 16 ? 12 : 16, /[א-ת]/.test(r[0])); text(doc, chartSvg, 452, y + 6, r[1], 16); });
      if (rows.length !== data.rows.length) paragraph(doc, figure, 'שורת הסך הכול נשמרת בטבלה ואינה קטגוריה בתרשים.');
      renderTable(doc, figure, data);
    }
    var caption = doc.createElement('figcaption'); caption.setAttribute('dir', 'rtl'); caption.style.cssText = 'font-size:15px;line-height:1.6;margin-top:10px'; caption.textContent = scene.caption; figure.appendChild(caption); return figure;
  }
  return { inspect: inspect, render: render };
});
