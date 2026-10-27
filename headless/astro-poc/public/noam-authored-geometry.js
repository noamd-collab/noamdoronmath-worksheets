(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NoamAuthoredGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg", BLUE = "#1769aa", INK = "#27364a";
  var CAPTIONS = {
    "authored-triangular-prism": "המחשה של בסיס המנסרה והמידות הנתונות. אורך שלא ניתן נשאר לא ידוע; לא חושב נפח או אורך חדש.",
    "authored-triangle-sides": "המחשה של אורכי הצלעות וההיקף שנכתבו בשאלה. לא נבחרה משוואה ולא חושב ערך הנעלם.",
    "authored-rectangle": "המחשה של מידות המלבן שנכתבו בשאלה. לא חושבו מידות או שטחים חדשים.",
    "authored-equal-perimeter": "המחשה סכמטית של הצורות בעלות ההיקף השווה. סימן שאלה מציין אורך שלא ניתן. הגדלים בציור אינם השוואת שטחים.",
    "authored-correspondence": "סקיצה של שני המשולשים החופפים לפי הנתון. לא נוספו מידות, סימוני התאמה או תשובות לסעיף."
  };
  function clean(text) {
    return String(text || "").slice(0, 6000).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/[−–—]/g, "-").replace(/[־]/g, "-").replace(/\$/g, "").replace(/\\[()[\]]/g, "")
      .replace(/\s+/g, " ").trim();
  }
  function expr(text, unknown) {
    var s = clean(text);
    if (unknown && s === "?") return s;
    if (!s || s.length > 24 || !/^(?:\d+(?:\.\d+)?[a-z]?|[a-z])(?:\s*[+-]\s*(?:\d+(?:\.\d+)?[a-z]?|[a-z])){0,2}$/.test(s)) return null;
    var variables = s.match(/[a-z]/g) || [];
    if (variables.some(function (v) { return v !== variables[0]; })) return null;
    if ((s.match(/\d+(?:\.\d+)?/g) || []).some(function (v) { return Number(v) > 10000; })) return null;
    if (!variables.length && (!/^\d+(?:\.\d+)?$/.test(s) || Number(s) <= 0)) return null;
    return s.replace(/\s*([+-])\s*/g, " $1 ");
  }
  function math(text) {
    var out = [], re = /\$([^$\n]{1,100})\$|\\\(([^\n]{1,100}?)\\\)/g, m;
    while ((m = re.exec(String(text || "")))) out.push(clean(m[1] || m[2]));
    return out;
  }
  function number(text) { var s = String(text); return /^\d+(?:\.\d+)?$/.test(s) && Number(s) > 0 && Number(s) <= 10000 ? Number(s) : null; }
  function unit(text) { return /מ״מ|מ"מ/.test(text) ? "מ״מ" : /ס״מ|ס"מ|סמ״ק|סמ"ק/.test(text) ? "ס״מ" : /מטר/.test(text) ? "מטרים" : "יחידות אורך"; }
  function perimeter(text) { var m = clean(text).match(/היקף(?:\s+(?:המשולש|המלבן|שלו|הצורות))?\s*(?:הוא\s*)?([0-9]+(?:\.[0-9]+)?)/); return m && expr(m[1]); }
  function scene(kind, data) { return { version: 1, kind: kind, caption: CAPTIONS[kind], data: data }; }
  function request(options, context) {
    if (!options) return false;
    var student = clean(options.studentMessage), part = clean(context.partText);
    if (/דוגמה\s+נגדית|השרטוט\s+המקורי|בחרו\s+בעצמכם\s+שני\s+בסיסים/.test(student + " " + part)) return false;
    var explicit = /(?:^|[^א-ת])(?:שרטט[וי]?|צייר[וי]?|הראה|הצג|תראה|המחשה|סמן[וי]?)(?=$|[^א-ת])/.test(student);
    if (explicit && /[0-9=]|חדש|אחר|נגדית|שווה.?צלעות|שווה.?שוקיים|מקביל|חוצה|תיכון|אנך/.test(student)) return false;
    if (options.drawCurrentStep === true) return true;
    if (!/(?:^|[^א-ת])(?:שרטט[וי]?|צייר[וי]?|הראה|הצג|תראה|המחשה|סמן[וי]?)(?=$|[^א-ת])/.test(student)) return false;
    // This route illustrates authored givens. A new construction or a different
    // numerical problem belongs to another explicitly supported contract.
    return !/[0-9=]|חדש|אחר|נגדית|שווה.?צלעות|שווה.?שוקיים|מקביל|חוצה|תיכון|אנך/.test(student);
  }
  function prism(text) {
    var s = clean(text);
    if (!/מנסר/.test(s) || !/בסיס/.test(s) || !/ישר(?:י)?-?\s*זווית/.test(s) || /(?:שתי|לשתי|זוג)\s+מנסרות|בסיס\s+ב(?=\s|$)/.test(s)) return null;
    var triple = s.match(/(?:בעל(?:י|ת)?\s+)?צלעות\s+(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
    var legs = s.match(/ניצבים\s+(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
    var hyp = s.match(/(?:צלע\s+שלישית|יתר)\s+(\d+(?:\.\d+)?)/);
    var values = triple ? triple.slice(1).map(number).sort(function (a, b) { return a - b; }) : legs && hyp ? [number(legs[1]), number(legs[2])].sort(function (a, b) { return a - b; }).concat(number(hyp[1])) : null;
    if (!values || values.some(function (n) { return !n; }) || Math.abs(values[0] * values[0] + values[1] * values[1] - values[2] * values[2]) > .000001 * values[2] * values[2]) return null;
    var length = s.match(/(?:אורך|גובה)\s+(?:ה)?מנסרה\s*(?:הוא\s*)?(\d+(?:\.\d+)?)(?=\s|$)/);
    var parameter = s.match(/אורך\s+(?:מנסרה\s+)?(?:חיובי\s+)?([a-z])(?=\s|$)/);
    var volume = s.match(/נפח(?:ה|ו)?\s+(\d+(?:\.\d+)?)(?=\s|$)/);
    return scene("authored-triangular-prism", { sides: values.map(String), length: length && expr(length[1]) || parameter && expr(parameter[1]) || "?", volume: volume && expr(volume[1]) || null, unit: unit(s) });
  }
  function equalPerimeter(text) {
    var s = clean(text);
    if (!/ריבוע/.test(s) || !/מלבן/.test(s) || !/אותו היקף/.test(s)) return null;
    var shared = s.match(/אותו היקף\s*,?\s*(\d+(?:\.\d+)?)/);
    var re = /מלבן\s+שאחת\s+מהצלעות\s+שלו\s+(\d+(?:\.\d+)?)/g, m, rectangles = [];
    while ((m = re.exec(s))) rectangles.push({ width: expr(m[1]), height: "?" });
    if (shared && rectangles.length >= 1 && rectangles.length <= 2 && rectangles.every(function (r) { return r.width && Number(r.width) < Number(shared[1]) / 2; })) {
      return scene("authored-equal-perimeter", { perimeter: expr(shared[1]), squareSide: "?", rectangles: rectangles, unit: unit(s) });
    }
    var sides = s.match(/למלבן\s+יש\s+צלעות\s+של\s+(\d+(?:\.\d+)?)\s+(?:מטרים|ס״מ|ס"מ|מ״מ)\s+ושל\s+(\d+(?:\.\d+)?)/);
    if (sides && number(sides[1]) && number(sides[2])) return scene("authored-equal-perimeter", { perimeter: null, squareSide: "?", rectangles: [{ width: expr(sides[1]), height: expr(sides[2]) }], unit: unit(s) });
    return null;
  }
  function correspondence(text, options) {
    var s = clean(text), m = s.match(/(?:^|[.!]\s*)נתון\s+כי\s*[△Δ]?([A-Z]{3})\s+חופף\s+ל-?\s*[△Δ]?([A-Z]{3})\s+לפי\s+הסדר/);
    if (!m || new Set(m[1] + m[2]).size !== 6 || /[0-9]/.test(s)) return null;
    // Extra numerical/angle givens need a renderer that can satisfy all of
    // them. Do not silently drop those constraints or copy a target answer.
    var focus = clean(options.helpKind === "hint" ? options.answer : options.studentMessage);
    var edges = [], tokens = focus.match(/(?:^|[^A-Za-z])[A-Z]{2}(?=$|[^A-Za-z])/g) || [];
    tokens.forEach(function (token) {
      var edge = token.replace(/[^A-Z]/g, "");
      if ([m[1], m[2]].some(function (name) { return name.includes(edge[0]) && name.includes(edge[1]) && edge[0] !== edge[1]; }) && edges.indexOf(edge) < 0) edges.push(edge);
    });
    return scene("authored-correspondence", { names: [m[1], m[2]], focusEdges: edges.slice(0, 2) });
  }
  function triangle(text) {
    var s = clean(text);
    if (!/משולש/.test(s) || !/צלעות/.test(s) || !/אורכים|אורכי|צלעות.{0,25}(?:הן|של)/.test(s) || /מנסר|שווה.?צלעות|שווה.?שוקיים|ישר.?זווית|זווית/.test(s)) return null;
    var prefix = String(text).split(/היקף/)[0], labels = math(prefix);
    if (labels.length === 1 && /^\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?$/.test(labels[0])) labels = labels[0].split(",");
    if (labels.length !== 3 || labels.some(function (v) { return !expr(v); })) return null;
    var numbers = labels.map(number);
    if (numbers.every(Boolean) && numbers.some(function (v, i) { return v >= numbers[(i + 1) % 3] + numbers[(i + 2) % 3]; })) return null;
    return scene("authored-triangle-sides", { sides: labels.map(function (v) { return expr(v); }), perimeter: perimeter(s), unit: unit(s) });
  }
  function rectangle(text) {
    var s = clean(text);
    if (!/מלבן/.test(s) || /ריבוע|מנסר|תיבה|משולש|אותו היקף/.test(s)) return null;
    var raw = String(text).split(/היקף|שטח/)[0];
    if (/גדול|קטן|יותר|פחות|פי\s/.test(clean(raw))) return null;
    // A number occurring near a rectangle is not necessarily a side: it may
    // be a wire perimeter, tile count or sequence index. Bind both dimensions
    // to explicit length/width clauses or an explicit pair of rectangle sides.
    var length = raw.match(/(?:אורכו|אורך(?:\s+המלבן)?)\s+(?:(?:של|הוא)\s+)?\$([^$]+)\$/);
    var width = raw.match(/(?:רוחבו|רוחב(?:\s+המלבן)?)\s+(?:(?:של|הוא)\s+)?\$([^$]+)\$/);
    var values = length && width ? [length[1], width[1]] : /צלעות(?:\s+המלבן)?\s+(?:הן|של|באורכים)/.test(raw) ? math(raw) : [];
    if (values.length !== 2 || values.some(function (v) { return !expr(v); })) return null;
    return scene("authored-rectangle", { width: expr(values[0]), height: expr(values[1]), perimeter: perimeter(s), unit: unit(s) });
  }
  function resolve(context, options) {
    if (!context || context.hasFigure !== false || typeof context.questionText !== "string" || typeof context.partText !== "string" || !request(options, context)) return null;
    // Do not read parent given arrays or sibling parts. Family data must occur
    // in the printed common stem, or in a self-contained selected subsection.
    var sources = [context.questionText, context.partText];
    for (var i = 0; i < sources.length; i++) {
      var text = sources[i];
      if (!text || text.length > 6000 || /(?:^|[.!?])\s*(?:האם|אילו|נניח|אם\s)|דוגמה\s+נגדית/.test(clean(text))) continue;
      var result = prism(text) || equalPerimeter(text) || correspondence(text, options) || triangle(text) || rectangle(text);
      if (result && result.kind === "authored-triangular-prism" && /לידו|שני הגופים|שני גופים|זוג מנסרות|שתי מנסרות/.test(clean(context.partText))) return null;
      if (result) return result;
    }
    return null;
  }
  function safeTree(value, depth) {
    if (depth > 6) return false;
    if (value === null || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.length <= 500;
    if (!value || typeof value !== "object" || Object.keys(value).length > 20) return false;
    var proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return false;
    return Object.keys(value).every(function (key) { var d = Object.getOwnPropertyDescriptor(value, key); return !/^(?:__proto__|constructor|prototype)$/.test(key) && d && !d.get && !d.set && safeTree(d.value, depth + 1); });
  }
  function keys(value, allowed) { return value && !Array.isArray(value) && Object.keys(value).every(function (k) { return allowed.indexOf(k) >= 0; }); }
  function validate(s) {
    if (!safeTree(s, 0) || !keys(s, ["version", "kind", "caption", "data"]) || s.version !== 1 || s.caption !== CAPTIONS[s.kind]) return false;
    var d = s.data, dim = function (v) { return typeof v === "string" && expr(v, true) === v; };
    var un = function () { return /^(?:ס״מ|מ״מ|מטרים|יחידות אורך)$/.test(d.unit); };
    if (s.kind === "authored-triangular-prism") {
      if (!keys(d, ["sides", "length", "volume", "unit"]) || !Array.isArray(d.sides) || d.sides.length !== 3 || !d.sides.every(number) || !dim(d.length) || !(d.volume === null || number(d.volume)) || !un()) return false;
      var n = d.sides.map(Number); return Math.abs(n[0] * n[0] + n[1] * n[1] - n[2] * n[2]) < .000001 * n[2] * n[2];
    }
    if (s.kind === "authored-triangle-sides") return keys(d, ["sides", "perimeter", "unit"]) && Array.isArray(d.sides) && d.sides.length === 3 && d.sides.every(function (v) { return dim(v) && v !== "?"; }) && (!d.sides.every(number) || d.sides.map(Number).every(function(v,i,a){return v<a[(i+1)%3]+a[(i+2)%3];})) && (d.perimeter === null || number(d.perimeter)) && un();
    if (s.kind === "authored-rectangle") return keys(d, ["width", "height", "perimeter", "unit"]) && dim(d.width) && dim(d.height) && d.width !== "?" && d.height !== "?" && (d.perimeter === null || number(d.perimeter)) && un();
    if (s.kind === "authored-equal-perimeter") return keys(d, ["perimeter", "squareSide", "rectangles", "unit"]) && (d.perimeter === null || number(d.perimeter)) && dim(d.squareSide) && Array.isArray(d.rectangles) && d.rectangles.length > 0 && d.rectangles.length <= 2 && d.rectangles.every(function (r) { return keys(r, ["width", "height"]) && dim(r.width) && dim(r.height) && (!d.perimeter || !number(r.width) || Number(r.width)<Number(d.perimeter)/2); }) && un();
    if (s.kind === "authored-correspondence") return keys(d, ["names", "focusEdges"]) && Array.isArray(d.names) && d.names.length === 2 && d.names.every(function (n) { return /^[A-Z]{3}$/.test(n); }) && new Set(d.names.join("")).size === 6 && Array.isArray(d.focusEdges) && d.focusEdges.length <= 2 && d.focusEdges.every(function (e) { return /^[A-Z]{2}$/.test(e) && e[0] !== e[1] && d.names.some(function (n) { return n.includes(e[0]) && n.includes(e[1]); }); });
    return false;
  }
  function el(doc, name, attrs, text) { var e = doc.createElementNS(NS, name); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, String(attrs[k])); }); if (text !== undefined) e.textContent = text; return e; }
  function label(doc, svg, x, y, text, rtl, role) {
    if (!rtl && role !== "vertex-label") { var w = Math.min(280, String(text).length * 12 + 12); svg.appendChild(el(doc, "rect", { x: x-w/2, y: y-20, width: w, height: 27, rx: 4, fill: "white", "fill-opacity": .95, "data-role": "label-background" })); }
    svg.appendChild(el(doc, "text", { x: x, y: y, "text-anchor": "middle", "font-size": 20, fill: INK, direction: rtl ? "rtl" : "ltr", "unicode-bidi": "isolate", "data-role": role || "given-label" }, text));
  }
  function line(doc, svg, a, b, color, dashed) { var attrs = { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color || INK, "stroke-width": color ? 4 : 2.5, fill: "none" }; if (dashed) attrs["stroke-dasharray"] = "7 5"; svg.appendChild(el(doc, "line", attrs)); }
  function polygon(doc, svg, points, fill) { svg.appendChild(el(doc, "polygon", { points: points.map(function (p) { return p.join(","); }).join(" "), fill: fill || "#eef5fc", stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round" })); }
  function block(doc, figure, text) { var p = doc.createElement("div"); p.style.cssText = "text-align:center;direction:rtl;font-size:16px;line-height:1.6;margin:4px 0"; p.textContent = text; figure.appendChild(p); }
  function canvas(doc, figure, height) { var svg = el(doc, "svg", { viewBox: "0 0 440 " + height, role: "img", "aria-label": figure.getAttribute("aria-label") }); svg.style.cssText = "display:block;width:100%;height:auto;max-height:none;background:white;font-family:Heebo,Arial,sans-serif"; figure.appendChild(svg); return svg; }
  function drawRectangle(doc, svg, x, y, w, h, a, b, title) { label(doc, svg, x + w / 2, y - 38, title, true, "shape-title"); polygon(doc, svg, [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]); label(doc, svg, x+w/2,y+h+29,a,false); label(doc, svg,x+w+25,y+h/2+7,b,false); }
  function render(doc, spec) {
    if (!doc || !validate(spec)) return null;
    var figure = doc.createElement("figure"); figure.className = "noam-geometry noam-authored-geometry"; figure.setAttribute("data-visual-kind", spec.kind); figure.setAttribute("aria-label", spec.caption);
    figure.style.cssText = "margin:12px 0;padding:12px;border:1px solid #d8e4ef;border-radius:14px;background:white";
    var d = spec.data, svg;
    if (d.unit) block(doc, figure, "מידות ב" + d.unit + " · שרטוט סכמטי, ללא קנה מידה");
    if (spec.kind === "authored-triangular-prism") {
      if (d.volume) block(doc, figure, "נפח נתון: " + d.volume + (d.unit === "ס״מ" ? " סמ״ק" : " יחידות נפח"));
      svg = canvas(doc, figure, 350);
      var ratio = Number(d.sides[0]) / Number(d.sides[1]), front = [[75,270],[260,270],[75,270-185*ratio]], back = front.map(function (p) { return [p[0]+105,p[1]-60]; });
      polygon(doc,svg,[front[1],back[1],back[2],front[2]],"#f4f8fc"); polygon(doc,svg,front,"#e8f2fc");
      line(doc,svg,front[0],back[0],null,true); line(doc,svg,back[0],back[1],null,true); line(doc,svg,back[0],back[2],null,true);
      line(doc,svg,[front[0][0]+15,front[0][1]],[front[0][0]+15,front[0][1]-15]); line(doc,svg,[front[0][0]+15,front[0][1]-15],[front[0][0],front[0][1]-15]);
      label(doc,svg,46,(front[0][1]+front[2][1])/2,d.sides[0],false); label(doc,svg,167,303,d.sides[1],false); label(doc,svg,167.5,(front[1][1]+front[2][1])/2+6,d.sides[2],false);
      label(doc,svg,330,252,d.length,false,d.length==="?"?"unknown-length":"given-label");
      block(doc,figure,"אורך המנסרה: " + (d.length === "?" ? "?" : d.length));
    } else if (spec.kind === "authored-correspondence") {
      svg=canvas(doc,figure,275); var points=[[[35,210],[193,178],[92,60]],[[405,65],[247,97],[348,215]]];
      points.forEach(function (p,index) { polygon(doc,svg,p,"#f4f8fc"); var name=d.names[index]; p.forEach(function (xy,i) { label(doc,svg,xy[0]+(index? -4:4),xy[1]+(i===2&&!index?-14:index&&i===0?-17:25),name[i],false,"vertex-label"); }); d.focusEdges.forEach(function(edge){if(name.includes(edge[0])&&name.includes(edge[1]))line(doc,svg,p[name.indexOf(edge[0])],p[name.indexOf(edge[1])],BLUE);}); });
      block(doc,figure,"סקיצה בלבד — לא נתונות זוויות או מידות מספריות.");
    } else if (spec.kind === "authored-equal-perimeter") {
      block(doc,figure,d.perimeter?"היקף נתון לכל צורה: "+d.perimeter+" "+d.unit:"לצורות אותו היקף; ערכו לא חושב כאן.");
      svg=canvas(doc,figure,250*(d.rectangles.length+1)); drawRectangle(doc,svg,145,60,130,130,d.squareSide,d.squareSide,"ריבוע");
      d.rectangles.forEach(function(r,i){drawRectangle(doc,svg,100,310+i*250,220,105,r.width,r.height,"מלבן "+(i+1));});
    } else if (spec.kind === "authored-rectangle") {
      svg=canvas(doc,figure,300);drawRectangle(doc,svg,80,80,260,140,d.width,d.height,"מלבן");if(d.perimeter)block(doc,figure,"היקף נתון: "+d.perimeter+" "+d.unit);
    } else {
      svg=canvas(doc,figure,310);var p=[[75,230],[355,230],[175,65]];polygon(doc,svg,p);
      label(doc,svg,210,268,d.sides[0],false);label(doc,svg,302,141,d.sides[1],false);label(doc,svg,98,138,d.sides[2],false);
      if(d.perimeter)block(doc,figure,"היקף נתון: "+d.perimeter+" "+d.unit);
    }
    var caption=doc.createElement("figcaption");caption.setAttribute("dir","rtl");caption.style.cssText="font-size:15px;line-height:1.6;margin-top:10px";caption.textContent=spec.caption;figure.appendChild(caption);return figure;
  }
  return { resolve: resolve, render: render };
});
