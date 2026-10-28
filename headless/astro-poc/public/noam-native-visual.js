(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NoamNativeVisual = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var NATIVE = /^\/noam-ai\/native\/(G[789]-(?:T[0-9]+|ASSESS1|CIRCLE|INTERP|TWOSRC|3060|KITE|SIDEANG|TRAP))\/([abc])\/figures\/([a-zA-Z0-9_-]+\.svg)$/;
  var SHAPES = ["line", "path", "circle", "ellipse", "polygon", "polyline", "rect"];
  // Published legacy directory aliases contain these same native packages.
  var PACKAGE_ALIASES = { "G7-ASSESS1": "G7-T50", "G8-ASSESS1": "G8-T64", "G8-CIRCLE": "G8-T63", "G8-INTERP": "G8-T61",
    "G8-TWOSRC": "G8-T66", "G9-3060": "G9-T37", "G9-KITE": "G9-T46", "G9-SIDEANG": "G9-T38", "G9-TRAP": "G9-T39", "G9-T40": "G9-T32" };
  function canonicalPackage(value) { return PACKAGE_ALIASES[value] || value; }
  function clean(value) {
    return String(value || "").slice(0, 6000).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/[−–—]/g, "-").replace(/\\(?:left|right|text|mathrm|operatorname)/g, "")
      .replace(/\\angle\b\s*/g, "∠").replace(/\\[()[\]]/g, "").replace(/[${}]/g, "").replace(/\s+/g, " ").trim();
  }
  function point(p) { return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite); }
  function near(a, b, tolerance) { return point(a) && point(b) && Math.hypot(a[0] - b[0], a[1] - b[1]) <= (tolerance || .25); }
  function uniq(values) { return values.filter(function (v, i) { return values.indexOf(v) === i; }); }
  function standardHint(options) {
    return options && options.helpKind === "hint" && /^(?:אפשר\s+)?רמז(?:\s*[123])?\s*[?؟]?$/.test(clean(options.studentMessage));
  }
  function focusText(options) {
    // A new request owns its focus. Never silently inherit the previous answer.
    return clean(standardHint(options) ? options.answer : options && options.studentMessage);
  }
  function coordinates(text) {
    var out = [], match, re = /\(\s*([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)\s*\)/g;
    while ((match = re.exec(clean(text))) && out.length < 8) {
      var xy = [Number(match[1]), Number(match[2])];
      if (xy.every(function (n) { return Math.abs(n) <= 100; }) && !out.some(function (p) { return near(p, xy, .00001); })) out.push(xy);
    }
    return out;
  }
  function attrs(raw) {
    var out = Object.create(null), m, re = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
    while ((m = re.exec(raw))) out[m[1]] = m[2];
    return out;
  }
  function svgShapes(text) {
    if (typeof text !== "string" || text.length > 1500000) return null;
    var header = text.match(/<svg\b([^>]*)>/i), m, out = [], ids = Object.create(null);
    if (!header || /<!DOCTYPE|<!ENTITY/i.test(text)) return null;
    var box = String(attrs(header[1]).viewBox || "").trim().split(/[ ,]+/).map(Number);
    if (box.length !== 4 || !box.every(Number.isFinite) || box[0] !== 0 || box[1] !== 0 || box[2] <= 0 || box[3] <= 0) return null;
    // Parse only primitive data. Never insert supplied markup, event handlers,
    // foreignObject, scripts, styles, URLs, or arbitrary SVG attributes.
    var re = /<(line|path|circle|ellipse|polygon|polyline|rect|text)\b([^>]*?)(?:\/\s*>|>([^<]*)<\/text\s*>|>)/gi;
    while ((m = re.exec(text)) && out.length < 15000) {
      var a = attrs(m[2]), shape = { tag: m[1].toLowerCase(), attrs: a, text: m[3] || "" };
      out.push(shape);
      if (a.id) { if (ids[a.id]) return null; ids[a.id] = shape; }
    }
    // Older exports attach semantic IDs to a group whose line has no ID.
    // Keep those exact group memberships for angle-ray verification only.
    var groups = Object.create(null), stack = [], groupIds = Object.create(null), gr = /<(\/?g|line)\b([^>]*?)(?:\/\s*>|>)/gi;
    while ((m = gr.exec(text))) {
      var tag = m[1].toLowerCase(), ga = attrs(m[2]);
      if (tag === "/g") { if (!stack.length) return null; stack.pop(); }
      else if (tag === "g") {
        var group = [];
        if (ga.id) { if (ids[ga.id] || groupIds[ga.id]) return null; groupIds[ga.id] = true; groups[ga.id] = group; }
        if (!/\/\s*>$/.test(m[0])) stack.push(group);
      } else { stack.forEach(function (group) { group.push({ tag: "line", attrs: ga }); }); }
    }
    if (stack.length) return null;
    return { shapes: out, ids: ids, groups: groups, box: box, transformedGroups: /<(?:svg|g)\b[^>]*\btransform\s*=/i.test(text) };
  }
  function selected(data, exercise, source) {
    if (!data || !exercise || !Array.isArray(data.questions)) return null;
    var levelCode = { a: "A", b: "B", c: "E" }[data.level];
    // Verified canonical PDF/native registry aliases retain legacy exercise IDs.
    // This is an exact package+level allowlist, never a general level fallback.
    var publishedLevelAliases = { "G8-T01:a": "B", "G8-T35:a": "B", "G8-T26:a": "B", "G8-T27:a": "B", "G7-T16:a": "B", "G8-T56:c": "A", "G8-T57:c": "A" };
    var alias = publishedLevelAliases[data.package + ":" + data.level];
    if (alias && String(exercise.id || "").indexOf(data.package + "-" + alias + "-Q") === 0) levelCode = alias;
    var exercisePackage = String(exercise.id || "").split("-" + levelCode + "-Q")[0];
    if (!/^G[789]-(?:T[0-9]+|ASSESS1|CIRCLE|INTERP|TWOSRC|3060|KITE|SIDEANG|TRAP)$/.test(data.package || "") || !levelCode ||
        canonicalPackage(exercisePackage) !== canonicalPackage(data.package)) return null;
    var q = data.questions.find(function (q) { return q.id === exercise.nativeQuestionId; });
    var part = q && Array.isArray(q.items) && q.items.find(function (p) { return p.id === exercise.nativeItemId && p.label === exercise.part; });
    var selectedId = String(exercise.id || "").match(/-Q0*(\d+)([א-ת])$/);
    if (!q || !part || !selectedId || q.id !== "q" + Number(selectedId[1]) || part.label !== selectedId[2]) return null;
    var url = String(exercise.nativeFigureUrl || ""), match = url.match(NATIVE);
    if (url && (!match || canonicalPackage(match[1]) !== canonicalPackage(data.package) || match[2] !== data.level)) return null;
    var f = (data.figures || []).find(function (f) { return f.id === part.figure_id; });
    if (!f && !part.figure_id && !url) return { q: q, part: part, figure: null, model: null, source: null, url: "" };
    var model = f && f.visual_model;
    if (!match || !f || f.id !== exercise.nativeFigureId || f.question !== q.id || f.svg !== "figures/" + match[3] ||
        (f.item && f.item !== part.id) || !model || model.schema_version !== "visual-model/v1" || model.id !== f.id ||
        model.question !== q.id || model.svg !== f.svg || (model.item && model.item !== part.id) || !Array.isArray(model.objects)) return null;
    var view = f.view && f.view.viewbox;
    if (!point(view) || view.some(function (n) { return n < 20 || n > 4000; }) || !source ||
        Math.abs(view[0] - source.box[2]) > .03 || Math.abs(view[1] - source.box[3]) > .03) return null;
    var ids = Object.create(null);
    for (var obj of model.objects) {
      if (!obj || typeof obj.id !== "string" || ids[obj.id]) return null;
      ids[obj.id] = true;
      if (obj.svg_xy) {
        var positions = point(obj.svg_xy) ? [obj.svg_xy] : obj.svg_xy;
        if (!Array.isArray(positions) || positions.some(function (p) { return !point(p) || p[0] < -.1 || p[1] < -.1 || p[0] > view[0] + .1 || p[1] > view[1] + .1; })) return null;
      }
    }
    return { q: q, part: part, figure: f, model: model, source: source, url: url };
  }
  function lineXY(s) {
    if (!s || s.tag !== "line") return null;
    var a = s.attrs, p = [[Number(a.x1), Number(a.y1)], [Number(a.x2), Number(a.y2)]];
    return p.every(point) ? p : null;
  }
  function axisMap(ctx) {
    if (!ctx.figure || !/coordinate_plane|function_graph/.test(ctx.model.kind)) return null;
    var shapes = ctx.source.shapes, objects = ctx.model.objects;
    function axis(name) {
      var tagged = shapes.filter(function (s) { return s.tag === "line" && s.attrs["data-axis"] === name; });
      if (tagged.length === 1) return lineXY(tagged[0]);
      var obj = objects.filter(function (o) { return o.type === "segment" && o.part === "axis" && o.name === "axis-" + name; });
      return obj.length === 1 && Array.isArray(obj[0].svg_xy) && obj[0].svg_xy.every(point) ? obj[0].svg_xy : null;
    }
    var x = axis("x"), y = axis("y");
    if (!x || !y || Math.abs(x[0][1] - x[1][1]) > .03 || Math.abs(y[0][0] - y[1][0]) > .03) return null;
    var origin = [y[0][0], x[0][1]];
    function scale(name) {
      var samples = [], idx = name === "x" ? 0 : 1;
      shapes.forEach(function (s) {
        var tag = s.attrs["data-num"], value = Number(clean(s.text));
        if (s.tag !== "text" || !tag || !tag.startsWith(name + " ") || !Number.isFinite(value)) return;
        var tick = shapes.filter(function (t) { return t.tag === "line" && t.attrs["data-tick"] === tag; });
        if (tick.length !== 1) return;
        var xy = lineXY(tick[0]); if (xy) samples.push([value, (xy[0][idx] + xy[1][idx]) / 2]);
      });
      // Older export dialect has stable x/y numeric label IDs and geometry axes.
      if (samples.length < 2) {
        var labels = objects.filter(function (o) { return o.type === "label" && new RegExp("^" + name + "(?:m)?[0-9]+$").test(o.name || "") && point(o.svg_xy); });
        if (labels.length < 2) return null;
        var slopes = [];
        for (var i = 1; i < labels.length; i++) {
          var v1 = Number(clean(labels[0].text)), v2 = Number(clean(labels[i].text));
          if (Number.isFinite(v1) && Number.isFinite(v2) && v1 !== v2) slopes.push((labels[i].svg_xy[idx] - labels[0].svg_xy[idx]) / (v2 - v1));
        }
        slopes.sort(function (a, b) { return a - b; }); var median = slopes[Math.floor(slopes.length / 2)];
        if (!Number.isFinite(median) || slopes.some(function (v) { return Math.abs(v - median) > .1; })) return null;
        return median;
      }
      samples.push([0, origin[idx]]);
      var first = samples.find(function (p) { return p[0] !== 0; });
      if (!first) return null;
      var unit = (first[1] - origin[idx]) / first[0];
      if (!Number.isFinite(unit) || Math.abs(unit) < .1 || samples.some(function (p) { return Math.abs(origin[idx] + unit * p[0] - p[1]) > .15; })) return null;
      return unit;
    }
    var sx = scale("x"), sy = scale("y");
    if (!(sx > 0) || !(sy < 0)) return null;
    return { origin: origin, sx: sx, sy: sy, toSvg: function (xy) { return [origin[0] + xy[0] * sx, origin[1] + xy[1] * sy]; } };
  }
  function objectIds(obj) {
    return uniq([obj.svg_id].concat((obj.parts || []).map(function (p) { return p.svg_id; })).filter(function (v) { return typeof v === "string"; }));
  }
  function named(text, name) { return !!name && new RegExp("(^|[^A-Za-z0-9])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^A-Za-z0-9])").test(text); }
  function safeInitial(obj) { return obj.display === "initial" && obj.role !== "to_prove" && obj.role !== "answer"; }
  function formula(text) {
    var input = clean(text);
    if ((input.match(/(?:\b[a-z]\(x\)|\by)\s*=/g) || []).length !== 1) return null;
    var m = input.match(/(?:^|[^A-Za-z])(?:y|f\(x\))\s*=\s*([+-]?(?:\d+(?:\.\d+)?)?\s*x(?:\s*(?:\^\s*2|²))?(?:\s*[+-]\s*(?:\d+(?:\.\d+)?\s*x(?:\s*(?:\^\s*2|²))?|\d+(?:\.\d+)?))*)(?=$|[^A-Za-z0-9+^²])/);
    if (!m) return null;
    // Accept the complete expression, never a valid prefix of x/2, x(x+1),
    // LaTeX fractions, powers outside this grammar, or multiplication.
    var tail = input.slice(m.index + m[0].length).trim();
    if (/^[A-Za-z0-9+*/^²(\\−-]/.test(tail)) return null;
    var expr = m[1].replace(/\s/g, "").replace(/²/g, "^2"), terms = expr.match(/[+-]?[^+-]+/g), coef = [0, 0, 0];
    if (!terms || terms.join("") !== expr) return null;
    for (var term of terms) {
      var t = term.match(/^([+-]?(?:\d+(?:\.\d+)?)?)(x(?:\^2)?)?$/);
      if (!t) return null;
      var degree = t[2] === "x^2" ? 2 : t[2] === "x" ? 1 : 0;
      var value = t[1] === "" || t[1] === "+" ? 1 : t[1] === "-" ? -1 : Number(t[1]);
      if (!Number.isFinite(value) || Math.abs(value) > 100) return null;
      coef[degree] += value;
    }
    return { expression: "y=" + expr, coefficients: coef };
  }
  function illustration(ctx, options, focus) {
    var typed = !standardHint(options), requested = coordinates(focus), given = coordinates(ctx.part.text);
    var drawCurrentStep = options.drawCurrentStep === true && !construction(focus);
    var explicitDraw = drawCurrentStep || /שרטט|צייר|הצג|הראה|סמן|גרף|המח|מערכת|נקוד/.test(focus);
    // A generic drawing button may use one authored formula from the current
    // question/item. Multiple formulas and parent relation arrays are ambiguous.
    var sourceFormula = formula(String(ctx.q.text || "") + " " + String(ctx.part.text || ""));
    // A formula the task asks to discover is never inferred from its points.
    var plotFormula = typed && explicitDraw ? formula(focus) : null;
    if (!plotFormula && sourceFormula && !construction(focus) && (drawCurrentStep || /גרף|פונקצי|ישר|פרבול/.test(focus))) plotFormula = sourceFormula;
    var points = requested.filter(function (p) { return typed && explicitDraw || given.some(function (g) { return near(g, p, .00001); }); });
    if (!points.length && !plotFormula && !ctx.figure && explicitDraw) points = given;
    if (!points.length && !plotFormula) return null;
    return { kind: "coordinate-illustration", points: points, formula: plotFormula,
      caption: plotFormula ? "המחשה של הפונקציה שנכתבה במפורש: " + plotFormula.expression + "." : "המחשה במערכת צירים של הנקודות שנכתבו במפורש. לא נוספו משוואה או חיבור בין הנקודות." };
  }
  function construction(text) {
    // Hebrew letters are not JavaScript word characters. Explicit boundaries
    // prevent the imperative בנו from matching ordinary prose such as בנוסחת.
    return /(?:^|[^א-תA-Za-z0-9])(?:בנה|בני|בנו|בניית|הוסף|הוסיפו|הוסיפי|הארך|האריכו|האריכי|חדש(?:ה|ים|ות)?|נוסף(?:ת|ים|ות)?|שקף|שקפו|שקפי|שיקוף|הזז|הזיזו|הזיזי|סובב|סובבו|סובבי|שרטט(?:ו|י)?\s+(?:גובה|תיכון|אנך|חוצה))(?=$|[^א-תA-Za-z0-9])/.test(text);
  }
  function asksCounterexample(part) {
    return /דוגמה\s+נגדית|הטענה\s+(?:אינה|לא)\s+נכונה\s+תמיד/.test(clean(part.text)) ||
      (Array.isArray(part.to_prove) ? part.to_prove : []).some(function (target) {
        return target && target.type === "find" && /דוגמה\s+נגדית/.test(clean(target.what));
      });
  }
  function resolve(data, exercise, options, svgText) {
    options = options || {};
    var source = svgText ? svgShapes(svgText) : null, ctx = selected(data, exercise, source), focus = focusText(options);
    if (!ctx || !focus) return null;
    // A requested new constrained construction must not become a highlight of
    // whichever old objects happen to be mentioned in that construction.
    if (/(?:^|[^א-תA-Za-z0-9])(?:שרטט|צייר|העבר|צור|בנה|בנו)(?=$|[^א-תA-Za-z0-9]).{0,100}(?:מקביל|אנך|מאונך|חוצה|תיכון|גובה)/.test(focus)) return null;
    // Showing the existing source cannot demonstrate a different hypothetical
    // case. Only an explicitly supplied supported formula defines a new plot.
    if (/דוגמה\s+נגדית|דוגמה\s+אחרת|נניח\s+ש|אילו\s+ה|אם\s+היינו|גרף\s+(?:אחר|חדש)/.test(focus)) {
      return !standardHint(options) && formula(focus) ? illustration(ctx, Object.assign({}, options, { drawCurrentStep: false }), focus) : null;
    }
    // Explicit formula requests own the graph. Do not substitute the existing
    // source curve when the requested expression is outside our numeric grammar.
    if (!standardHint(options) && /(?:\b[a-z]\(x\)|\by)\s*=/.test(focus)) return illustration(ctx, options, focus);
    // The authored selected item can require a counterexample even when its
    // hint omits that word. Its original figure cannot represent the new case.
    if ((standardHint(options) || options.drawCurrentStep === true) && asksCounterexample(ctx.part)) return null;
    if (!ctx.figure) return illustration(ctx, options, focus);
    var objects = ctx.model.objects.filter(safeInitial), selectedObjects = [], markers = [], arcs = [], names = [], unknown = false;
    function select(o, label) { if (selectedObjects.indexOf(o) < 0) selectedObjects.push(o); if (label) names.push(label); }
    var namedPoints = Object.create(null);
    var duplicatePoint = false;
    objects.forEach(function (o) { if (o.type === "point" && /^[A-Z]$/.test(o.name || "") && point(o.svg_xy)) {
      if (namedPoints[o.name]) duplicatePoint = true;
      namedPoints[o.name] = o;
    } });
    if (duplicatePoint) return null;
    // Names alone cannot authorize a new edge or a wider parent line.
    // Verify subsegments and angle rays against the actual source line.
    function covers(shape, a, b) {
      if (source.transformedGroups || !shape || shape.attrs.transform) return false;
      var xy = lineXY(shape); if (!xy || !point(a) || !point(b) || near(a, b, .01)) return false;
      var dx = xy[1][0] - xy[0][0], dy = xy[1][1] - xy[0][1], len = Math.hypot(dx, dy);
      if (len < .01) return false;
      return [a, b].every(function (p) {
        var x = p[0] - xy[0][0], y = p[1] - xy[0][1], along = (x * dx + y * dy) / len;
        return Math.abs(x * dy - y * dx) / len <= .15 && along >= -.15 && along <= len + .15;
      });
    }
    function boundedPart(part, owner) {
      var span = part.span;
      if (!Array.isArray(span) || span.length !== 2 || span[0] === span[1] ||
          !namedPoints[span[0]] || !namedPoints[span[1]]) return null;
      var a = namedPoints[span[0]].svg_xy, b = namedPoints[span[1]].svg_xy;
      if (!covers(source.ids[part.svg_id], a, b)) return null;
      // A composite authored segment may have several smaller spans, but no
      // span may extend beyond the requested segment or polygon boundary.
      var name = owner.name || "", edges = [];
      if (/^(segment|ray|line)$/.test(owner.type) && /^[A-Z]{2}$/.test(name)) edges.push(name);
      if (owner.type === "polygon" && /^[A-Z]{3,8}$/.test(name)) {
        for (var i = 0; i < name.length; i++) edges.push(name[i] + name[(i + 1) % name.length]);
      }
      if (edges.length && !edges.some(function (edge) {
        var u = namedPoints[edge[0]], v = namedPoints[edge[1]];
        return u && v && covers({ tag: "line", attrs: { x1: u.svg_xy[0], y1: u.svg_xy[1], x2: v.svg_xy[0], y2: v.svg_xy[1] } }, a, b);
      })) return null;
      return { tag: "line", attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] } };
    }
    function verifiedSide(u, v, exact) {
      var a = namedPoints[u], b = namedPoints[v]; if (!a || !b) return false;
      var edges = objects.filter(function (o) { return /^(segment|ray|line)$/.test(o.type) && (o.name === u + v || o.name === v + u); });
      if (exact) edges.push(exact);
      return edges.some(function (o) { return objectIds(o).some(function (id) {
        if (covers(source.ids[id], a.svg_xy, b.svg_xy)) return true;
        // A group reference must belong to the named authored edge, with
        // matching endpoints and one unambiguous covering source primitive.
        if (!/^(segment|ray|line)$/.test(o.type) || !Array.isArray(o.svg_xy) || o.svg_xy.length !== 2 ||
            !(near(o.svg_xy[0], a.svg_xy, .15) && near(o.svg_xy[1], b.svg_xy, .15) ||
              near(o.svg_xy[1], a.svg_xy, .15) && near(o.svg_xy[0], b.svg_xy, .15))) return false;
        var candidates = (source.groups[id] || []).filter(function (s) { return covers(s, a.svg_xy, b.svg_xy); });
        if (!candidates.length) return false;
        var first = JSON.stringify(candidates[0].attrs);
        return candidates.every(function (s) { return JSON.stringify(s.attrs) === first; });
      }); });
    }
    // Explicit three-letter angle requests are scoped to their two existing rays.
    var angleNames = [], am, ar = /(?:∠\s*|זווית\s+(?:ה)?|זוויות\s+)([A-Z]{3})(?![A-Za-z0-9])/g;
    while ((am = ar.exec(focus))) {
      // In "משולש ישר־זווית ABC", ABC names the triangle. The adjective
      // must not invent an angle at B; an explicit ∠ABC remains an angle.
      if (am[0].charAt(0) !== "∠" && /(?:^|[^א-ת])(?:ישר|חד|קהה)[\s־-]+ה?$/.test(focus.slice(0, am.index))) continue;
      angleNames.push(am[1]);
    }
    angleNames.forEach(function (name) {
      var exact = objects.find(function (o) { return o.type === "angle" && o.name === name; });
      var a = namedPoints[name[0]], v = namedPoints[name[1]], b = namedPoints[name[2]];
      if (!a || !v || !b || !verifiedSide(name[0], name[1], exact) || !verifiedSide(name[1], name[2], exact)) { unknown = true; return; }
      var u = [a.svg_xy[0] - v.svg_xy[0], a.svg_xy[1] - v.svg_xy[1]], w = [b.svg_xy[0] - v.svg_xy[0], b.svg_xy[1] - v.svg_xy[1]];
      if (Math.abs(u[0] * w[1] - u[1] * w[0]) < .01) { unknown = true; return; }
      arcs.push([a.svg_xy, v.svg_xy, b.svg_xy]); names.push("∠" + name);
    });
    if (/משולש|מרובע|מלבן|ריבוע|מקבילית|דלתון|טרפז|מצולע/.test(focus)) {
      var polygons = focus.match(/(?:^|[^A-Za-z])[A-Z]{3,8}(?=$|[^A-Za-z])/g) || [];
      polygons.forEach(function (token) {
        var name = token.replace(/[^A-Z]/g, "");
        if (angleNames.indexOf(name) >= 0) return;
        var polygon = objects.find(function (o) { return o.type === "polygon" && o.name === name; });
        if (polygon) { select(polygon, name); return; }
        var edges = [];
        for (var i = 0; i < name.length; i++) {
          var pair = name[i] + name[(i + 1) % name.length];
          var edge = objects.find(function (o) { return /^(segment|line|ray)$/.test(o.type) && (o.name === pair || o.name === pair[1] + pair[0]); });
          if (!edge) { unknown = true; return; } edges.push(edge);
        }
        edges.forEach(function (e) { select(e); }); names.push(name);
      });
    }
    var tokens = focus.match(/(?:^|[^A-Za-z])([A-Z]{1,2})(?=$|[^A-Za-z])/g) || [];
    tokens.map(function (t) { return t.replace(/[^A-Z]/g, ""); }).forEach(function (name) {
      var matches = objects.filter(function (o) {
        if (/^(label|ticks|parallel|right_angle|overlay_mark)$/.test(o.type)) return false;
        if (o.type === "circle" && !/מעגל|עיגול/.test(focus)) return false;
        if (o.type === "arc" && !/זווית|קשת/.test(focus)) return false;
        return o.name === name || (name.length === 2 && /segment|line|ray/.test(o.type) && o.name === name[1] + name[0]);
      });
      if (!matches.length) { unknown = true; return; }
      matches.forEach(function (o) { select(o, name); });
    });
    // A→C→B is a route through existing source edges, not permission to invent AB.
    if (/מסלול|שביל/.test(focus) && /אל|דרך|משם|→|->/.test(focus)) {
      var route = (focus.match(/(?:^|[^A-Za-z])[A-Z](?=$|[^A-Za-z])/g) || []).map(function (s) { return s.replace(/[^A-Z]/g, ""); });
      for (var i = 1; i < route.length; i++) {
        var a = route[i - 1], b = route[i], edge = objects.find(function (o) { return /segment|line|ray/.test(o.type) && (o.name === a + b || o.name === b + a); });
        if (edge) select(edge, a + b); else unknown = true;
      }
    }
    var axes = [];
    if (/ציר(?:\s+ה)?\s*[-־]?\s*x\b|ציר\s+(?:ה)?אופקי/.test(focus)) axes.push("x");
    if (/ציר(?:\s+ה)?\s*[-־]?\s*y\b|ציר\s+(?:ה)?אנכי/.test(focus)) axes.push("y");
    if (/צירים/.test(focus) && !axes.length) axes = ["x", "y"];
    axes.forEach(function (axis) {
      var o = objects.find(function (o) { return o.id === "axis:" + axis || o.name === "axis-" + axis || o.type === "axis" && o.name === axis; });
      if (o) select(o, "ציר " + axis);
    });
    var coords = coordinates(focus), mapping = coords.length ? axisMap(ctx) : null;
    coords.forEach(function (p) {
      if (!mapping) { unknown = true; return; }
      var location = mapping.toSvg(p), found = objects.filter(function (o) { return /^(point|mark)$/.test(o.type) && near(o.svg_xy, location, .3); });
      if (found.length === 1) select(found[0], "הנקודה שנזכרה"); else unknown = true;
    });
    if (!selectedObjects.length && !arcs.length) {
      var family = /מעגל|עיגול/.test(focus) ? /^(circle|build_circle)$/ : /גרף|עקומה|פונקצי|פרבול/.test(focus) ? /^(curve|data_series)$/ : /דיאגרמ|תרשים/.test(focus) ? /^(data_series|pie|sector)$/ : null;
      if (family) objects.filter(function (o) { return family.test(o.type); }).forEach(function (o) { select(o); });
    }
    var constructing = construction(focus);
    if (constructing || unknown && !selectedObjects.length && !arcs.length) return illustration(ctx, options, focus);
    // A combined focus must be complete even for a standard hint. Showing CH
    // alone for a request naming BH and CH would misrepresent the requested step.
    if (unknown) return null;
    if (!selectedObjects.length && !arcs.length) {
      var graph = illustration(ctx, options, focus); if (graph) return graph;
      // A source-only aid is explicit, never reported as generated focus.
      if (!standardHint(options) && !/שרטוט|ציור|המחשה|דף|שאלה|תראה|הראה|הצג/.test(focus)) return null;
      return { kind: "source-context", url: ctx.url, width: source.box[2], height: source.box[3], shapes: [], markers: [], arcs: [],
        caption: "השרטוט המקורי מהדף. לא נוספה הדגשה לשלב הזה." };
    }
    var highlighted = [], seen = Object.create(null), invalidSpan = false;
    selectedObjects.forEach(function (o) {
      if (/^(point|mark)$/.test(o.type) && point(o.svg_xy)) { markers.push(o.svg_xy.slice()); return; }
      var ids = objectIds(o);
      var parts = Array.isArray(o.parts) ? o.parts : [], refs = parts.slice();
      if (o.svg_id && !parts.some(function (p) { return p.svg_id === o.svg_id; })) refs.unshift({ svg_id: o.svg_id });
      refs.forEach(function (part) {
        var id = part.svg_id, shape = source.ids[id], key = id;
        if (Object.prototype.hasOwnProperty.call(part, "span")) {
          shape = boundedPart(part, o); if (!shape) { invalidSpan = true; return; }
          key += "@" + part.span.join(":");
        }
        if (shape && SHAPES.indexOf(shape.tag) >= 0 && !seen[key]) { highlighted.push(shape); seen[key] = true; }
      });
      // Some old source SVGs have semantic geometry but no element IDs.
      if (!ids.some(function (id) { return source.ids[id]; }) && /^(segment|line|ray)$/.test(o.type) && Array.isArray(o.svg_xy) && o.svg_xy.length === 2 && o.svg_xy.every(point)) {
        highlighted.push({ tag: "line", attrs: { x1: o.svg_xy[0][0], y1: o.svg_xy[0][1], x2: o.svg_xy[1][0], y2: o.svg_xy[1][1] } });
      }
    });
    if (invalidSpan || !highlighted.length && !markers.length && !arcs.length) return null;
    return { kind: "source-focus", url: ctx.url, width: source.box[2], height: source.box[3], shapes: highlighted, markers: markers, arcs: arcs,
      objectIds: selectedObjects.map(function (o) { return o.id; }), caption: "הדגשה על השרטוט המקורי" + (names.length ? ": " + uniq(names).join(", ") : "") + ". הצבע מסמן את המוקד שביקשת, ללא הוספת נתונים או מסקנות." };
  }
  function element(document, tag, attributes, text) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attributes || {}).forEach(function (k) { el.setAttribute(k, String(attributes[k])); });
    if (text != null) el.textContent = text;
    return el;
  }
  function shapeOverlay(document, shape, width) {
    var allowed = ["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "points", "transform"];
    var a = {}, valid = true;
    allowed.forEach(function (key) {
      if (shape.attrs[key] === undefined) return;
      var value = String(shape.attrs[key]);
      if (key === "d" || key === "points") { if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(value)) valid = false; }
      else if (key === "transform") { if (!/^(?:(?:matrix|translate|scale|rotate)\([0-9eE+.,\s-]+\)\s*)+$/.test(value)) valid = false; }
      else if (!Number.isFinite(Number(value))) valid = false;
      a[key] = value;
    });
    if (!valid) return null;
    a.fill = "none"; a.stroke = "#1769aa"; a["stroke-width"] = width; a["stroke-opacity"] = ".8";
    a["stroke-linecap"] = "round"; a["stroke-linejoin"] = "round";
    return element(document, shape.tag, a);
  }
  function graphSvg(document, spec) {
    var w = 440, h = 340, pad = 42, points = spec.points || [], xmin = -5, xmax = 5, ymin = -5, ymax = 5;
    points.forEach(function (p) { xmin = Math.min(xmin, p[0] - 1); xmax = Math.max(xmax, p[0] + 1); ymin = Math.min(ymin, p[1] - 1); ymax = Math.max(ymax, p[1] + 1); });
    if (spec.formula) { var c = spec.formula.coefficients; for (var x = xmin; x <= xmax; x += .5) { var y = c[0] + c[1] * x + c[2] * x * x; ymin = Math.max(-100, Math.min(ymin, y)); ymax = Math.min(100, Math.max(ymax, y)); } }
    var sx = (w - pad * 2) / (xmax - xmin), sy = (h - pad * 2) / (ymax - ymin);
    function xy(p) { return [pad + (p[0] - xmin) * sx, h - pad - (p[1] - ymin) * sy]; }
    var svg = element(document, "svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": spec.caption, "class": "noam-geometry-svg" });
    var origin = xy([0, 0]);
    function line(a, b, attrs) { svg.appendChild(element(document, "line", Object.assign({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, attrs))); }
    function step(range) { var n = Math.pow(10, Math.floor(Math.log10(range / 8))); return range / n > 40 ? n * 5 : range / n > 16 ? n * 2 : n; }
    var dx = step(xmax - xmin), dy = step(ymax - ymin);
    for (var xv = Math.ceil(xmin / dx) * dx; xv <= xmax; xv += dx) {
      var p = xy([xv, 0]); line([p[0], pad], [p[0], h - pad], { stroke: "#d9e0e8", "stroke-width": 1 });
      if (Math.abs(xv) > .00001) svg.appendChild(element(document, "text", { x: p[0], y: origin[1] + 17, "text-anchor": "middle", "font-size": 12, direction: "ltr" }, Number(xv.toFixed(2))));
    }
    for (var yv = Math.ceil(ymin / dy) * dy; yv <= ymax; yv += dy) {
      var p = xy([0, yv]); line([pad, p[1]], [w - pad, p[1]], { stroke: "#d9e0e8", "stroke-width": 1 });
      if (Math.abs(yv) > .00001) svg.appendChild(element(document, "text", { x: origin[0] - 8, y: p[1] + 4, "text-anchor": "end", "font-size": 12, direction: "ltr" }, Number(yv.toFixed(2))));
    }
    line([pad, origin[1]], [w - pad + 8, origin[1]], { stroke: "#26364a", "stroke-width": 1.8 });
    line([origin[0], h - pad], [origin[0], pad - 8], { stroke: "#26364a", "stroke-width": 1.8 });
    svg.appendChild(element(document, "text", { x: w - pad + 14, y: origin[1] + 4, "font-size": 15 }, "x"));
    svg.appendChild(element(document, "text", { x: origin[0] - 7, y: pad - 15, "font-size": 15 }, "y"));
    if (spec.formula) {
      var c = spec.formula.coefficients, path = "", pen = false;
      for (var i = 0; i <= 180; i++) {
        var x = xmin + (xmax - xmin) * i / 180, y = c[0] + c[1] * x + c[2] * x * x;
        if (y < ymin || y > ymax) { pen = false; continue; }
        var p = xy([x, y]); path += (pen ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2) + " "; pen = true;
      }
      svg.appendChild(element(document, "path", { d: path, fill: "none", stroke: "#1769aa", "stroke-width": 2.5, "data-role": "given-function" }));
    }
    points.forEach(function (p) {
      var pos = xy(p); svg.appendChild(element(document, "circle", { cx: pos[0], cy: pos[1], r: 5, fill: "#1769aa", "data-role": "explicit-point" }));
      // Place the complete tuple away from both axes so tick labels cannot
      // obscure a sign or digit, including in the expanded diagram clone.
      var label = "(" + p.join(", ") + ")", anchor = p[0] < 0 ? "end" : "start";
      var labelWidth = label.length * 13 * .65, labelX = pos[0] + (p[0] < 0 ? -9 : 9);
      // At the far canvas edges shift only the label inward, leaving the
      // coordinate system and the plotted point unchanged.
      labelX = anchor === "end" ? Math.max(4 + labelWidth, Math.min(w - 4, labelX)) : Math.max(4, Math.min(w - 4 - labelWidth, labelX));
      svg.appendChild(element(document, "text", { x: labelX, y: pos[1] + (p[1] < 0 ? 20 : -9), "font-size": 13, direction: "ltr", "text-anchor": anchor }, label));
    });
    return svg;
  }
  function captionNode(document, spec) {
    var caption = document.createElement("figcaption"), text = spec.caption;
    function isolated(value) {
      var token = document.createElement("bdi"); token.setAttribute("dir", "ltr");
      token.style.cssText = "direction:ltr;unicode-bidi:isolate;white-space:nowrap";
      token.textContent = value; caption.appendChild(token);
    }
    var expression = spec.formula && spec.formula.expression, at = expression ? text.indexOf(expression) : -1;
    if (at >= 0) {
      // Keep powers and signs in one LTR island, including after dialog cloning.
      // The viewer's reading/glossary passes retain ordinary Hebrew text nodes.
      caption.appendChild(document.createTextNode(text.slice(0, at)));
      isolated(expression);
      caption.appendChild(document.createTextNode(text.slice(at + expression.length)));
    } else {
      var re = /∠?[A-Za-z]+/g, match, cursor = 0;
      while ((match = re.exec(text))) {
        caption.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        isolated(match[0]); cursor = match.index + match[0].length;
      }
      caption.appendChild(document.createTextNode(text.slice(cursor)));
    }
    return caption;
  }
  function render(document, data, exercise, options, svgText) {
    var spec = resolve(data, exercise, options, svgText); if (!spec) return null;
    var figure = document.createElement("figure"); figure.className = "noam-native-figure noam-geometry";
    figure.setAttribute("data-visual-kind", spec.kind);
    var svg;
    if (spec.kind === "coordinate-illustration") svg = graphSvg(document, spec);
    else {
      svg = element(document, "svg", { viewBox: "0 0 " + spec.width + " " + spec.height, role: "img", "aria-label": spec.caption, "class": "noam-geometry-svg" });
      svg.appendChild(element(document, "image", { href: spec.url, width: spec.width, height: spec.height }));
      var width = Math.max(1.8, Math.min(spec.width, spec.height) / 105);
      var overlays = 0;
      spec.shapes.forEach(function (s) { var node = shapeOverlay(document, s, width); if (node) { svg.appendChild(node); overlays++; } });
      spec.markers.forEach(function (p) { svg.appendChild(element(document, "circle", { cx: p[0], cy: p[1], r: width * 2.5, fill: "none", stroke: "#1769aa", "stroke-width": width, "data-role": "focus-point" })); });
      spec.arcs.forEach(function (a) {
        var u = [a[0][0] - a[1][0], a[0][1] - a[1][1]], v = [a[2][0] - a[1][0], a[2][1] - a[1][1]], lu = Math.hypot.apply(Math, u), lv = Math.hypot.apply(Math, v);
        if (lu < 1 || lv < 1) return;
        var r = Math.min(lu, lv) * .22, start = [a[1][0] + u[0] / lu * r, a[1][1] + u[1] / lu * r], end = [a[1][0] + v[0] / lv * r, a[1][1] + v[1] / lv * r];
        svg.appendChild(element(document, "path", { d: "M" + start.join(" ") + " A" + r + " " + r + " 0 0 " + (u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0) + " " + end.join(" "), fill: "none", stroke: "#1769aa", "stroke-width": width }));
      });
      if (spec.kind === "source-focus" && !overlays && !spec.markers.length && !spec.arcs.length) return null;
    }
    svg.style.cssText = "display:block;width:100%;height:auto;max-height:480px;background:white";
    figure.appendChild(svg);
    figure.appendChild(captionNode(document, spec));
    return figure;
  }
  function authoredContext(data, exercise, svgText) {
    var ctx = selected(data, exercise, svgText ? svgShapes(svgText) : null);
    if (!ctx) return null;
    function sourceText(value) { return (Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : "").slice(0, 12000); }
    return { questionText: sourceText(ctx.q.text), partText: sourceText(ctx.part.text),
      questionId: ctx.q.id, itemId: ctx.part.id, exerciseId: exercise.id, hasFigure: !!ctx.figure,
      questionTable: ctx.q.table ? JSON.parse(JSON.stringify(ctx.q.table)) : null, partTable: ctx.part.table ? JSON.parse(JSON.stringify(ctx.part.table)) : null };
  }
  return { resolve: resolve, render: render, coordinates: coordinates, formula: formula, authoredContext: authoredContext };
});
