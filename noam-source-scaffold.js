(function (root, factory) {
  'use strict';
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NoamSourceScaffold = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var WORD_NUMBER = { 'אחד': 1, 'אחת': 1, 'שני': 2, 'שתי': 2, 'שניים': 2, 'שתיים': 2, 'שלושה': 3, 'שלוש': 3, 'ארבעה': 4, 'ארבע': 4, 'חמישה': 5, 'חמש': 5, 'שישה': 6, 'שש': 6 };
  function sourceText(value) { return Array.isArray(value) && value.every(function (s) { return typeof s === 'string'; }) ? value.join('\n') : typeof value === 'string' ? value : ''; }
  function plain(value) { return value.replace(/[−–]/g, '-').replace(/\$/g, '').replace(/\s+/g, ' ').trim(); }
  function number(value, max) { return /^\d+$/.test(value) && +value <= (max || 100) ? +value : null; }
  function count(value, max) { return Object.prototype.hasOwnProperty.call(WORD_NUMBER, value) ? WORD_NUMBER[value] : number(value, max); }
  function request(options) {
    if (!options || options.drawCurrentStep !== true) return false;
    var s = String(options.studentMessage || '').trim();
    // Only the current exercise drawing action is authorized here. A new free
    // construction, hint answer or model-generated number cannot supply facts.
    return /^(?:(?:אפשר\s+)?רמז(?:\s*[123])?|שרטוט\s+להמחשה|(?:הצג|הראה|צייר|שרטט|המחיש)(?:ו)?\s+(?:(?:לי|את)\s+)?(?:המחשה|שרטוט|תרשים)(?:\s+(?:של\s+הנתונים|לפי\s+הנתונים|לשאלה|לסעיף|של\s+השאלה|של\s+הסעיף|לשאלה\s+הנוכחית|לסעיף\s+הנוכחי|מהנתונים\s+בשאלה|לפי\s+הנתונים\s+בשאלה))?)[?!.]*$/.test(s);
  }
  function spec(kind, title, caption, facts) {
    return Object.assign({ version: 1, kind: 'source-scaffold-' + kind, presentation: 'instructional-scaffold', title: title,
      caption: caption + ' זו המחשת עזר, לא איור מקורי ולא פתרון.' }, facts || {});
  }
  function boxDependency(q, part, currentText, values) {
    // This is an explicit discourse dependency, not permission to import all
    // siblings. The selected clause must refer to the added fourth box and to
    // redistribution; exactly one earlier authored fact and one following
    // equalization instruction must match. Later items and q.given are ignored.
    if (!/^מדוע מספר העפרונות בכל קופסה קטן אחרי שהוסיפו את הקופסה הרביעית\? הסבירו\.$/.test(currentText) || values.length !== 3) return null;
    var index = q.items.indexOf(part), earlier = q.items.slice(0, index);
    if (earlier.length !== 3 || earlier.some(function (item) { return item.figure_id; })) return null;
    var first = plain(sourceText(earlier[0].text)).match(/^([א-ת]+) מעבירה עפרונות מקופסה לקופסה, עד שבכל הקופסאות יש אותו מספר עפרונות\. כמה עפרונות יהיו בכל קופסה\?$/);
    var addition = plain(sourceText(earlier[1].text)).match(/^([א-ת]+) הוסיפה קופסה רביעית ובה (\d+) עפרונות\. כמה עפרונות יש עכשיו בסך הכול\?$/);
    var redistribution = plain(sourceText(earlier[2].text)).match(/^([א-ת]+) מחלקת שוב את העפרונות שווה בשווה\. כמה עפרונות יהיו בכל קופסה\?$/);
    if (!first || !addition || !redistribution || first[1] !== addition[1] || first[1] !== redistribution[1]) return null;
    var added = number(addition[2], 30);
    if (added === null) return null;
    return { added: added, dependencyItemIds: earlier.map(function (item) { return item.id; }) };
  }
  function resolve(data, exercise, options, svgText) {
    if (!request(options) || !root.NoamNativeVisual || typeof root.NoamNativeVisual.authoredContext !== 'function') return null;
    // A reviewed multi-panel source always owns its original-source route.
    if (root.NoamSourcePanels && root.NoamSourcePanels.isReviewed && root.NoamSourcePanels.isReviewed(exercise)) return null;
    var context = root.NoamNativeVisual.authoredContext(data, exercise, svgText || '');
    if (!context || context.hasFigure !== false || 'sourcePanels' in context) return null;
    var qs = data.questions.filter(function (q) { return q.id === context.questionId; });
    if (qs.length !== 1 || !Array.isArray(qs[0].items)) return null;
    var q = qs[0], parts = q.items.filter(function (p) { return p.id === context.itemId; });
    if (parts.length !== 1 || new Set(q.items.map(function (p) { return p.id; })).size !== q.items.length) return null;
    var part = parts[0], qt = plain(context.questionText), pt = plain(context.partText), m, n, v, found;
    if (!qt || !pt || qt.length > 1800 || pt.length > 1000) return null;

    if (/תכננו שתי הרחבות שונות שיאפשרו להוכיח דמיון/.test(qt) && /^כתבו את ההוכחה של כל הרחבה\. בהרחבה המקוננת כתבו שרשרת בת חמישה שלבים: נתון, שתי טענות זווית מנומקות, דמיון, ולבסוף פרופורציה\.$/.test(pt)) {
      found = spec('proof-lanes', 'מארגנים את שתי ההוכחות', 'השלבים נלקחו מהוראות הסעיף. יש להשלים אותם לפי ההרחבות שתכננתם; לא נבחרו משולשים או נתונים.', { slots: ['נתון', 'טענת זווית ונימוק', 'טענת זווית ונימוק', 'דמיון', 'פרופורציה'] });
    } else if (/^מה יש לדרוש לפני שמחסרים שטח פנימי מן השלם\?$/.test(pt)) {
      found = spec('area-comparison', 'משווים שני מצבים אפשריים', 'סכמות כלליות לבדיקת הרעיון שבשאלה, ללא נתונים או מידות. איזה מצב מתאים לתנאי שאתם מציעים?', {});
    } else if ((m = qt.match(/^בשלוש קופסאות יש עפרונות\. מספר העפרונות בכל קופסה: (\d+),\s*(\d+),\s*(\d+)$/))) {
      v = m.slice(1).map(function (s) { return number(s, 30); });
      var dep = v.every(function (x) { return x !== null; }) && boxDependency(q, part, pt, v);
      if (dep) found = spec('redistribution', 'לפני החלוקה מחדש', 'הקופסאות המקוריות והקופסה שנוספה מוצגות לפי הנתונים המפורשים. הכמות לאחר החלוקה השווה נשארה פתוחה.', { values: v, added: dep.added, dependencyItemIds: dep.dependencyItemIds });
    } else if ((m = qt.match(/^בתחרות באולינג השתתפו שתי קבוצות\. בקבוצה א[׳'] (\d+) שחקנים, שהפילו בממוצע (\d+) פינים כל אחד\.$/))) {
      var second = pt.match(/^בתחרות הראשונה היו גם בקבוצה ב[׳'] (\d+) שחקנים, שהפילו בממוצע (\d+) פינים\. חשבו את הממוצע של כל (עשרת|\d+) השחקנים\.$/);
      v = second && [m[1], m[2], second[1], second[2]].map(function (s) { return number(s, 40); });
      if (v && v.every(function (x) { return x !== null && x > 0; }) && (second[3] === 'עשרת' ? 10 : number(second[3], 80)) === v[0] + v[2]) found = spec('group-averages', 'הנתונים של שתי הקבוצות', 'העמודות מציגות ממוצעים נתונים, ולא תוצאות של שחקנים יחידים. הממוצע המאוחד לא חושב.', { groups: [{ count: v[0], average: v[1] }, { count: v[2], average: v[3] }] });
    } else if ((m = qt.match(/^מבנה ([a-z]) הוא מלבן של אריחים: ברוחבו \1 אריחים, ובאורכו ([א-ת]+|\d+) אריחים יותר מברוחבו\.$/)) && /^כתבו ביטוי למספר האריחים במבנה [a-z]\.$/.test(pt) && pt.includes(' ' + m[1] + '.')) {
      n = count(m[2], 8);
      if (n !== null && n > 0) found = spec('symbolic-rectangle', 'רוחב ואורך המבנה', 'המידות מתארות את הנתון המילולי; אין קנה מידה או מספר אריחים מחושב. הביטוי לשטח נשאר לבנייתכם.', { variable: m[1], extra: n });
    } else if (/^כתבו את הביטוי המתאים לכל משפט, וחשבו\.$/.test(qt) && (m = pt.match(/^המספרים ([+-]?\d+), ([+-]?\d+) ו[־-]([+-]?\d+) מוכפלים כולם יחד\.$/))) {
      v = m.slice(1).map(Number);
      if (v.every(function (x) { return Math.abs(x) <= 30; })) found = spec('signed-factors', 'הגורמים הנתונים', 'שלושת הגורמים ממוקמים ביחס לאפס. מסדרים את החישוב בלי לחשב את המכפלה או את סימנה.', { values: v });
    } else if (/^נזכיר: שתי משוואות שקולות אם הפתרונות שלהן זהים\.$/.test(qt) && /^האם המשוואות .+ וגם .+ שקולות\? פתרו את שתיהן והחליטו\.$/.test(pt)) {
      var spans = Array.from(context.partText.matchAll(/\$([^$\n]+)\$/g)).map(function (x) { return x[1]; });
      var compiler = root.NoamVisualData;
      if (spans.length === 2 && compiler && spans.every(function (s) {
        if (!/^[a-z0-9 +−-]+=[a-z0-9 +−-]+$/.test(s) || s.length > 35 || s.split('=').some(function (half) { return half.trim().length > 10; })) return false;
        var checked = compiler.inspect({ version: 2, status: 'ok', family: 'operations', expression: s, evidence: [{ source: 'part', quote: context.partText }] }, Object.assign({}, context, { hintText: '' }));
        return checked && checked.ok;
      })) found = spec('equation-comparison', 'בודקים כל משוואה בנפרד', 'כל מאזניים מציגים משוואה נתונה לבדיקה. הפתרונות וההחלטה אם הם זהים לא מולאו.', { equations: spans });
    } else if ((m = qt.match(/^[א-ת]+ קנתה (\d+) מחברות במחיר זהה, וגם תיק שעולה (\d+) שקלים\. היא שילמה בסך הכול (\d+) שקלים\.$/))) {
      var symbol = pt.match(/^סמנו ב[־-]([a-z]) את המחיר של מחברת אחת, וכתבו משוואה\.$/);
      v = [number(m[1], 8), number(m[2], 1000), number(m[3], 1000)];
      if (symbol && v.every(function (x) { return x !== null && x > 0; })) found = spec('purchase-groups', 'מארגנים את הקנייה', 'הכרטיסים מציגים את הפריטים והמחירים הנתונים. מחירי המחברות זהים ולא ידועים; המשוואה והפתרון לא נכתבו.', { count: v[0], knownPrice: v[1], total: v[2], variable: symbol[1] });
    } else if (/^בכל סעיף השלימו במקום התיבה מספר מתאים\./.test(qt) && (m = context.partText.trim().match(/^\$\\(?:f|frac)\{\(?([−-]?\d+)\)?\}\{□\}\s*=\s*([−-]?\d+)\$$/))) {
      v = [+m[1].replace('−', '-'), +m[2].replace('−', '-')];
      if (v.every(function (x) { return Number.isInteger(x) && Math.abs(x) <= 100; })) found = spec('fraction-placeholder', 'בודקים מספר לתיבה', 'זהו השוויון הנתון לבדיקה, לא קביעה שיש לו פתרון. התיבה נשארה ריקה; בכל הצבה יש לבדוק גם שהחילוק מוגדר.', { numerator: v[0], result: v[1] });
    } else if ((m = qt.match(/^מתוך (\d+) ניסיונות זהים שנערכו בתנאים דומים הצליחו (\d+)\. משתמשים בשכיחות היחסית כאומדן\.$/)) && /^האם הצפי מחייב את מספר ההצלחות בפועל\? הסבירו\.$/.test(pt)) {
      v = [number(m[1], 100), number(m[2], 100)];
      if (v.every(function (x) { return x !== null; }) && v[0] > 0 && v[1] <= v[0]) found = spec('observed-future', 'תצפית קודמת וניסיון עתידי', 'הנקודות מתארות רק את הניסיונות שכבר נערכו. לא הודמה תוצאה עתידית ולא חושבו הסתברות או צפי.', { trials: v[0], successes: v[1] });
    }
    if (!found) return null;
    found.questionId = context.questionId; found.itemId = context.itemId; found.exerciseId = context.exerciseId;
    return found;
  }
  function node(doc, tag, attrs, value) { var el = doc.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, String(attrs[key])); }); if (value !== undefined) el.textContent = String(value); return el; }
  function text(doc, svg, x, y, value, size, rtl) { svg.appendChild(node(doc, 'text', { x: x, y: y, 'font-size': size || 18, fill: '#25364b', 'text-anchor': 'middle', direction: rtl ? 'rtl' : 'ltr', 'unicode-bidi': 'isolate' }, value)); }
  function rect(doc, svg, x, y, w, h, fill, role) { svg.appendChild(node(doc, 'rect', { x: x, y: y, width: w, height: h, rx: 8, fill: fill || '#edf5fc', stroke: '#3877a6', 'stroke-width': 2, 'data-role': role || 'frame' })); }
  function line(doc, svg, x1, y1, x2, y2, dash) { svg.appendChild(node(doc, 'line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: '#3877a6', 'stroke-width': 2, 'stroke-dasharray': dash || '' })); }
  function arrow(doc, svg, x, y) { line(doc, svg, x, y, x, y + 25); svg.appendChild(node(doc, 'path', { d: 'M' + (x - 5) + ' ' + (y + 20) + ' L' + x + ' ' + (y + 26) + ' L' + (x + 5) + ' ' + (y + 20), fill: 'none', stroke: '#3877a6', 'stroke-width': 2 })); }
  function dots(doc, svg, value, x, y, cols, color, role) { for (var i = 0; i < value; i++) svg.appendChild(node(doc, 'circle', { cx: x + i % cols * 13, cy: y + Math.floor(i / cols) * 13, r: 4, fill: color || '#216f9f', 'data-role': role || 'given-unit' })); }
  function render(document, data, exercise, options, svgText) {
    // Re-resolve trusted source at render time. A saved/edited scene object is
    // never a renderer input and cannot donate answer values or foreign facts.
    var s = resolve(data, exercise, options, svgText); if (!s || !document) return null;
    var figure = document.createElement('figure'); figure.className = 'noam-geometry noam-source-scaffold';
    figure.setAttribute('data-visual-kind', s.kind); figure.setAttribute('data-presentation', s.presentation);
    figure.style.cssText = 'margin:12px 0;padding:10px;border:1px solid #d8e4ef;border-radius:14px;background:white';
    var heights = { 'proof-lanes': 580, 'area-comparison': 430, redistribution: 575, 'group-averages': 340, 'symbolic-rectangle': 340, 'signed-factors': 340, 'equation-comparison': 450, 'purchase-groups': 370, 'fraction-placeholder': 425, 'observed-future': 350 };
    var kind = s.kind.replace('source-scaffold-', ''), h = heights[kind];
    var svg = node(document, 'svg', { viewBox: '0 0 520 ' + h, role: 'img', 'aria-label': s.title, class: 'noam-geometry-svg' });
    svg.style.cssText = 'display:block;width:100%;height:auto;max-height:none;font-family:Heebo,Arial,sans-serif;background:white';
    text(document, svg, 260, 30, s.title, 22, true);
    if (kind === 'proof-lanes') {
      text(document, svg, 380, 67, 'הרחבה מקוננת', 19, true); text(document, svg, 140, 67, 'הרחבה נפרדת', 19, true);
      s.slots.forEach(function (slot, i) { var y = 85 + i * 96; rect(document, svg, 275, y, 210, 65); text(document, svg, 380, y + 25, slot, 18, true); text(document, svg, 380, y + 53, '?', 22); if (i < 4) arrow(document, svg, 380, y + 65); });
      rect(document, svg, 35, 85, 210, 450, '#fff'); text(document, svg, 140, 130, 'ההוכחה שתכננתם', 17, true);
      for (var i = 0; i < 5; i++) line(document, svg, 65, 180 + i * 65, 215, 180 + i * 65, '5 5');
    } else if (kind === 'area-comparison') {
      [0, 1].forEach(function (variant) { var y = 75 + variant * 170; text(document, svg, 440, y + 70, variant ? 'מצב ב' : 'מצב א', 18, true); rect(document, svg, 45, y, 290, 130, '#f4f7fa', 'whole'); rect(document, svg, variant ? 265 : 130, y + 35, 110, 65, '#bcded5', 'marked-region'); text(document, svg, 90, y + 25, 'שלם', 16, true); });
      text(document, svg, 260, 409, 'מה צריך לבדוק לפני חיסור השטחים?', 19, true);
    } else if (kind === 'redistribution') {
      s.values.forEach(function (value, i) { var x = 55 + i * 145; rect(document, svg, x, 75, 120, 120, '#edf5fc', 'given-box'); text(document, svg, x + 60, 63, 'קופסה ' + (i + 1), 17, true); text(document, svg, x + 60, 102, value, 22); dots(document, svg, value, x + 25, 130, 6); });
      arrow(document, svg, 260, 200); text(document, svg, 260, 254, 'חלוקה שווה ראשונה; מצרפים קופסה', 19, true);
      s.values.forEach(function (_, i) { rect(document, svg, 25 + i * 125, 280, 105, 120, '#fff', 'first-equalization'); text(document, svg, 77 + i * 125, 350, '?', 26); });
      rect(document, svg, 400, 280, 105, 120, '#e0f2e9', 'added-box'); text(document, svg, 452, 275, 'נוספה', 16, true); text(document, svg, 452, 309, s.added, 22); dots(document, svg, s.added, 418, 330, 6);
      text(document, svg, 260, 430, 'מחלקים שוב שווה בשווה', 20, true); arrow(document, svg, 260, 439);
      s.values.concat([s.added]).forEach(function (_, i) { rect(document, svg, 25 + i * 125, 485, 105, 60, '#fff', 'second-equalization'); text(document, svg, 77 + i * 125, 524, '?', 26); });
    } else if (kind === 'group-averages') {
      s.groups.forEach(function (group, i) { var x = 25 + i * 255; rect(document, svg, x, 65, 230, 210); text(document, svg, x + 117, 95, i ? 'קבוצה ב׳' : 'קבוצה א׳', 20, true); text(document, svg, x + 117, 127, group.count + ' שחקנים', 19, true); var bar = group.average / Math.max(s.groups[0].average, s.groups[1].average) * 85; rect(document, svg, x + 85, 243 - bar, 65, bar, '#9dc6e6', 'given-average'); text(document, svg, x + 117, 158, 'ממוצע נתון: ' + group.average, 18, true); });
      text(document, svg, 260, 316, 'ממוצע כל השחקנים: ?', 22, true);
    } else if (kind === 'symbolic-rectangle') {
      rect(document, svg, 100, 80, 300, 160, '#edf5fc', 'symbolic-whole'); line(document, svg, 270, 80, 270, 240, '6 5');
      text(document, svg, 185, 68, s.variable, 23); text(document, svg, 335, 68, s.extra + ' נוספים', 18, true);
      for (var i = 1; i < s.extra; i++) line(document, svg, 270 + i * 130 / s.extra, 80, 270 + i * 130 / s.extra, 240, '3 5');
      text(document, svg, 60, 170, s.variable, 23); text(document, svg, 260, 280, 'רוחב; ולצדו התוספת לאורך', 18, true); text(document, svg, 260, 318, 'מספר האריחים: ?', 21, true);
    } else if (kind === 'signed-factors') {
      var low = Math.min.apply(null, [0].concat(s.values)) - 2, high = Math.max.apply(null, [0].concat(s.values)) + 2, px = function (v) { return 45 + (v - low) / (high - low) * 430; };
      line(document, svg, 35, 145, 485, 145); line(document, svg, px(0), 133, px(0), 157); text(document, svg, px(0), 184, '0', 19);
      s.values.filter(function (v, i, all) { return all.indexOf(v) === i; }).forEach(function (v, i) { svg.appendChild(node(document, 'circle', { cx: px(v), cy: 145, r: 6, fill: '#216f9f' })); text(document, svg, px(v), 116 - i * 25, v, 23); });
      s.values.forEach(function (v, i) { rect(document, svg, 40 + i * 165, 215, 110, 55); text(document, svg, 95 + i * 165, 250, v, 24); if (i < 2) text(document, svg, 177 + i * 165, 250, '×', 26); });
      text(document, svg, 260, 317, 'המכפלה: ?', 21, true);
    } else if (kind === 'equation-comparison') {
      s.equations.forEach(function (eq, i) { var y = 90 + i * 180, halves = plain(eq).split('='); line(document, svg, 90, y + 32, 430, y + 32); svg.appendChild(node(document, 'path', { d: 'M235 ' + (y + 95) + ' L260 ' + (y + 32) + ' L285 ' + (y + 95) + ' Z', fill: '#d9e8f4', stroke: '#3877a6' }));
        [100, 350].forEach(function (x, j) { rect(document, svg, x - 50, y - 25, 120, 55, '#fff'); text(document, svg, x + 10, y + 10, halves[j], 22); });
        text(document, svg, 260, y + 9, '=', 23); text(document, svg, 260, y + 131, 'פתרון: ?', 21, true); });
    } else if (kind === 'purchase-groups') {
      var width = 420 / s.count; for (var i = 0; i < s.count; i++) { rect(document, svg, 50 + i * width, 75, width - 8, 75, '#edf5fc', 'unknown-notebook'); text(document, svg, 50 + i * width + (width - 8) / 2, 120, s.variable, 25); }
      text(document, svg, 260, 177, 'מחברות במחיר זהה', 20, true); rect(document, svg, 190, 200, 140, 65, '#e0f2e9'); text(document, svg, 260, 228, 'תיק', 18, true); text(document, svg, 260, 253, s.knownPrice, 22);
      line(document, svg, 45, 284, 475, 284); text(document, svg, 260, 316, 'סך התשלום: ' + s.total, 22, true); text(document, svg, 260, 351, 'המשוואה: ?', 20, true);
    } else if (kind === 'fraction-placeholder') {
      text(document, svg, 130, 76, 'מונה נתון', 20, true); text(document, svg, 390, 76, 'מחלק בתיבה', 20, true);
      rect(document, svg, 70, 95, 120, 65, '#edf5fc', 'given-numerator'); text(document, svg, 130, 138, s.numerator, 30);
      rect(document, svg, 330, 95, 120, 65, '#fff', 'unfilled-divisor'); text(document, svg, 390, 138, '□', 30);
      line(document, svg, 130, 160, 245, 215); line(document, svg, 390, 160, 275, 215);
      svg.appendChild(node(document, 'circle', { cx: 260, cy: 228, r: 30, fill: '#e8f2fc', stroke: '#3877a6', 'stroke-width': 2 })); text(document, svg, 260, 238, '÷', 32);
      line(document, svg, 260, 258, 260, 300, '5 4'); rect(document, svg, 190, 300, 140, 75, '#f4f7fa', 'required-result'); text(document, svg, 260, 325, 'תוצאה נדרשת', 17, true); text(document, svg, 260, 359, s.result, 28);
      text(document, svg, 260, 410, 'בודקים גם אם החילוק מוגדר', 20, true);
    } else if (kind === 'observed-future') {
      rect(document, svg, 25, 65, 285, 210, '#f4f7fa'); text(document, svg, 167, 95, 'ניסיונות שכבר נערכו', 19, true);
      var cols = 15; for (var i = 0; i < s.trials; i++) svg.appendChild(node(document, 'circle', { cx: 48 + i % cols * 16, cy: 124 + Math.floor(i / cols) * 16, r: 5, fill: i < s.successes ? '#216f9f' : '#fff', stroke: '#7995ac', 'data-role': i < s.successes ? 'observed-success' : 'observed-other' }));
      text(document, svg, 167, 251, s.successes + ' הצלחות מתוך ' + s.trials, 18, true); line(document, svg, 330, 70, 330, 280, '6 6'); rect(document, svg, 350, 90, 145, 155, '#fff'); text(document, svg, 422, 122, 'בהמשך', 20, true); text(document, svg, 422, 193, '?', 45); text(document, svg, 260, 319, 'מה ידוע, ומה עדיין לא נצפה?', 21, true);
    }
    figure.appendChild(svg); var caption = document.createElement('figcaption'); caption.setAttribute('dir', 'rtl'); caption.style.cssText = 'line-height:1.6;font-size:15px;margin-top:8px'; caption.textContent = s.caption; figure.appendChild(caption);
    return figure;
  }
  return { resolve: resolve, render: render };
});
