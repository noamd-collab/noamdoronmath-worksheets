(function (root, factory) {
  'use strict';
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NoamAuthoredVisual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function clean(value) {
    return String(value || '').slice(0, 12000).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
      .replace(/[−–—]/g, '-').replace(/\u00a0/g, ' ').trim();
  }
  function prose(value) { return clean(value).replace(/[$]/g, '').replace(/\\(?:left|right)/g, '').replace(/\s+/g, ' '); }
  function standard(options) { return options.helpKind === 'hint' && /^(?:אפשר\s+)?רמז(?:\s*[123])?\s*[?؟]?$/.test(prose(options.studentMessage)); }
  function focus(options) { return prose(standard(options) ? options.answer : options.studentMessage); }
  function request(options, family) {
    var text = focus(options);
    if (!text || /(?:שרטוט|ציור|שאלה|דף)\s+(?:ה)?מקורי/.test(text)) return false;
    if (options.drawCurrentStep === true) return true;
    return family.test(text) && (standard(options) || /שרטט|צייר|הראה|הצג|תראה|סמן|המח/.test(text));
  }

  // A bounded expression parser. No eval, Function, property access, identifiers
  // other than x, or executable markup; the whole expression must be consumed.
  function parseExpression(raw) {
    var text = clean(raw).replace(/\\(?:left|right)/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\f(?=\{)/g, '\\frac').replace(/[×·]/g, '*').replace(/²/g, '^2');
    if (!text || text.length > 240 || /[^0-9x+*/^().{}\\\sA-Za-z-]/.test(text) || /x\s*x|\/\s*[+-]?\d+(?:\.\d+)?\s*x/.test(text)) return null;
    var index = 0, nodes = 0;
    function space() { while (/\s/.test(text.charAt(index)) && index < text.length) index++; }
    function node(type, value, left, right) { if (++nodes > 70) throw new Error('expression too large'); return { type: type, value: value, left: left, right: right }; }
    function group(open, close) { space(); if (text[index++] !== open) throw new Error('group'); var n = add(); space(); if (text[index++] !== close) throw new Error('group'); return n; }
    function atom() {
      space();
      if (text.slice(index, index + 5) === '\\frac') { index += 5; return node('div', null, group('{', '}'), group('{', '}')); }
      if (text.slice(index, index + 5) === '\\sqrt') { index += 5; return node('sqrt', null, group('{', '}')); }
      if (text.slice(index, index + 4) === 'sqrt') { index += 4; return node('sqrt', null, group('(', ')')); }
      if (text[index] === '(') return group('(', ')');
      if (text[index] === '{') return group('{', '}');
      if (text[index] === 'x') { index++; return node('x'); }
      var m = text.slice(index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
      if (!m || !Number.isFinite(Number(m[0])) || Number(m[0]) > 10000) throw new Error('number');
      index += m[0].length; return node('number', Number(m[0]));
    }
    function power() {
      var left = atom(); space();
      if (text[index] === '^') { index++; space(); var brace = text[index] === '{'; if (brace) index++; var m = text.slice(index).match(/^[0-6](?!\d)/); if (!m) throw new Error('power'); index++; if (brace && text[index++] !== '}') throw new Error('power'); left = node('pow', Number(m[0]), left); }
      return left;
    }
    function unary() { space(); if (text[index] === '+' || text[index] === '-') { var sign = text[index++]; return sign === '-' ? node('neg', null, unary()) : unary(); } return power(); }
    function product() {
      var left = unary();
      while (true) { space(); var token = text[index];
        if (token === '*' || token === '/') { index++; left = node(token === '*' ? 'mul' : 'div', null, left, unary()); }
        else if (token === 'x' || token === '(' || token === '\\' || text.slice(index, index + 4) === 'sqrt') left = node('mul', null, left, unary());
        else return left;
      }
    }
    function add() { var left = product(); while (true) { space(); var token = text[index]; if (token !== '+' && token !== '-') return left; index++; left = node(token === '+' ? 'add' : 'sub', null, left, product()); } }
    try { var ast = add(); space(); if (index !== text.length) return null; return ast; } catch (_error) { return null; }
  }
  function evaluate(ast, x) {
    if (!ast) return NaN;
    var a = ast.left && evaluate(ast.left, x), b = ast.right && evaluate(ast.right, x), result;
    switch (ast.type) {
      case 'number': return ast.value;
      case 'x': return x;
      case 'add': result = a + b; break;
      case 'sub': result = a - b; break;
      case 'mul': result = a * b; break;
      case 'div': result = Math.abs(b) < 1e-10 ? NaN : a / b; break;
      case 'neg': result = -a; break;
      case 'pow': result = a===0&&ast.value===0?NaN:Math.pow(a, ast.value); break;
      case 'sqrt': result = a < 0 ? NaN : Math.sqrt(a); break;
      default: return NaN;
    }
    return Number.isFinite(result) ? result : NaN;
  }
  function expressionText(ast) {
    if (ast.type === 'number') return String(ast.value);
    if (ast.type === 'x') return 'x';
    if (ast.type === 'neg') return '-(' + expressionText(ast.left) + ')';
    if (ast.type === 'sqrt') return '√(' + expressionText(ast.left) + ')';
    if (ast.type === 'pow') return '(' + expressionText(ast.left) + ')^' + ast.value;
    return '(' + expressionText(ast.left) + ({ add: '+', sub: '-', mul: '×', div: '÷' })[ast.type] + expressionText(ast.right) + ')';
  }
  function contains(ast, type) { return !!ast && (ast.type === type || contains(ast.left, type) || contains(ast.right, type)); }
  function formulas(text) {
    var out = [], invalid = false, input = clean(text), chunks = [], m, math = /\$([^$]+)\$/g;
    while ((m = math.exec(input))) chunks.push(m[1]);
    // A vertical-line equation or separate x assignment is not part of this
    // explicit-function contract; do not silently drop it from a source system.
    if(/(?:^|[^A-Za-z0-9])x\s*=/.test(input))invalid=true;
    if (!chunks.length) chunks = [input];
    chunks.forEach(function (chunk) {
      var matches = Array.from(chunk.matchAll(/(?:^|[^A-Za-z])((?:[fgh]\(x\)|y))\s*=\s*/g));
      matches.forEach(function (match, i) {
        if(!/^[\s;,]*(?:[fgh]\(x\)|y)\s*=/.test(match[0])){invalid=true;return;}
        var before=chunk.slice(i?matches[i-1].index+matches[i-1][0].length:0,match.index).trim();
        if(i===0&&/[A-Za-z0-9=+*/^()\\-]/.test(before)){invalid=true;return;}
        // A coefficient directly before y belongs to the left-hand side.
        if(match.index>0&&/[A-Za-z0-9+*/^()-]/.test(chunk.charAt(match.index))){invalid=true;return;}
        var expression = chunk.slice(match.index + match[0].length, i + 1 < matches.length ? matches[i + 1].index : chunk.length).trim();
        // Prose outside math delimiters terminates a formula; arbitrary latin
        // symbols/operators do not, so malformed formulas cannot become prefixes.
        var stop=expression.search(/[א-ת\n;?!]/);
        if(stop>=0&&/[A-Za-z0-9+*/^\\]/.test(expression.slice(stop))){invalid=true;return;}
        expression = expression.split(/[א-ת\n;?!]/)[0].replace(/[.,:]\s*$/, '').trim();
        var ast = parseExpression(expression);
        if (ast) out.push({ expression: expression, label: match[1], ast: ast }); else invalid=true;
      });
    });
    if(invalid){var empty=[];empty.invalid=true;return empty;}
    return out.filter(function (f, i) { return out.findIndex(function (g) { return JSON.stringify(g.ast) === JSON.stringify(f.ast); }) === i; });
  }
  function authoredRule(context) {
    var part = formulas(context.partText), question = formulas(context.questionText);
    if(part.invalid||question.invalid)return null;
    // An ordinal selects one authored system/function, not every declaration
    // in a shared stem. Without formulas in this part, their membership is not
    // proved by text or by panel order: keep the validated original figure.
    if(!part.length&&question.length>1&&/(?:מערכת|בדיקה|פונקציה|גרף)\s+(?:ה)?(?:ראשו(?:ן|נה)|שני(?:יה|ה)?|שלישי(?:ת)?|רביעי(?:ת)?)(?=$|[^א-תA-Za-z0-9])/.test(prose(context.partText)))return null;
    var all=question.concat(part).filter(function(f,i,list){return list.findIndex(function(g){return JSON.stringify(g.ast)===JSON.stringify(f.ast);})===i;});
    return all.length>=1&&all.length<=4?all:null;
  }
  function proseRule(context) {
    var text = prose(context.questionText), m;
    // A deliberately exact linguistic form, not a general natural-language
    // guess. It preserves the order of the two stated subtraction operands.
    m = text.match(/^(?:כלל|הכלל)\s+מחלק\s+את\s+([+-]?\d+(?:\.\d+)?)\s+בהפרש\s+בין\s+הקלט\s+ל[־-]?\s*([+-]?\d+(?:\.\d+)?)(?:[.\s]|$)/);
    if (!m || /טוע|טעה|שגו|אינו|לא נכון/.test(text)) return null;
    var expr = m[1] + '/(x-' + m[2] + ')', ast = parseExpression(expr);
    return ast ? { expression: expr, ast: ast } : null;
  }
  function restrictedFunctionDomain(text) {
    var value=prose(text).replace(/\\(?:leq?|geq?|lt|gt)(?![A-Za-z])/g,'<').replace(/\\in(?![A-Za-z])/g,'∈');
    // Domain restrictions are never silently discarded by the default plot
    // window. Explicit clipping is not yet a supported scene contract.
    return /(?:[<>≤≥≠]\s*x\b|\bx\s*[<>≤≥≠∈])/.test(value) || /(?:בתחום|בקטע|בין)\s*[[(]?[+-]?\d|(?:קלטים|ערכי x)\s+(?:חיוביים|שליליים|אי[־-]?שליליים)|(?:מוגדרת|מוגדר)\s+רק/.test(value);
  }
  function functionScene(context, options) {
    if (!request(options, /גרף|פונקצי|קלט|פלט|כלל|מכנה|ציר|פרבול|\b[fgh]\(x\)\s*=|\by\s*=/)) return null;
    var scope=prose(context.questionText+' '+context.partText);
    var text = focus(options), typed = !standard(options), own = typed && /(?:\b[fgh]\(x\)|\by)\s*=/.test(text) ? formulas(text) : [];
    if (typed && /(?:\b[fgh]\(x\)|\by)\s*=/.test(text) && (!own.length || own.length > 4)) return null;
    if((!own.length&&restrictedFunctionDomain(scope))||restrictedFunctionDomain(text))return null;
    if(!own.length&&/טבעי|מספרים שלמים|קלטים שלמים|הסיפור שלכם|הסיפור שבחרתם|כללים שבחרתם|פונקציות שבחרתם|(?:הזיזו|הזזה|מוזז|מוזזת|פרבולה חדשה)/.test(scope)){return null;}
    var sources = own.length ? own : authoredRule(context), rule = !sources && proseRule(context);
    if (!sources && rule) sources = [rule];
    if (!sources || (!own.length && /טוע|טעה|שגו|אינו נכון|לא נכון/.test(prose(context.questionText)))) return null;
    var machine = !own.length && sources.length === 1 && contains(sources[0].ast, 'div') && /קלט אסור|תחום ההגדרה|מכנה/.test(prose(context.partText) + ' ' + text) && !/גרף|עקומה/.test(text);
    return { kind: machine ? 'authored-input-machine' : 'authored-function', expression: sources[0].expression, expressions: sources.map(function(source){return {expression:source.expression,label:source.label||'y'};}),
      caption: machine ? 'הכלל הנתון כתרשים קלט ופעולה. לא הוצב קלט ולא חושב פלט.' : 'גרף של הנוסחה הנתונה. לא סומנו פתרונות או ערכים שהתבקשת למצוא.' };
  }
  function intervals(context, options) {
    if (!request(options, /מחלק|תחום|מספרים|ציר|בין|קצוות|חפיפה/)) return null;
    var part=prose(context.partText);
    var newPartition=/(?:^|[^א-ת])(?:בנו|תקנו|הציעו)(?:$|[^א-ת])|חלוקתכם|מחלקות שבחרתם|בתיקון שלכם/.test(part);
    var text = prose(context.questionText), declaration=/(?:^|[^א-תA-Za-z0-9_])(?:ו?[בלכמ]?ה?)מחלק(?:ה|ות)(?=$|[^א-תA-Za-z0-9_])/.exec(text);
    if(!declaration)return null;
    var source=text.slice(declaration.index+declaration[0].length), ranges = [], covered = [], re = /(?:מ[־-]?)?\s*([+-]?\d+(?:\.\d+)?)\s*(?:עד|-)\s*([+-]?\d+(?:\.\d+)?)(\s*(?:לא כולל|כולל)(?=$|[^א-תA-Za-z0-9_]))?/g, m;
    while ((m = re.exec(source))) {
      var start = Number(m[1]), end = Number(m[2]);
      if (!(start < end) || Math.abs(start) > 10000 || Math.abs(end) > 10000) return null;
      if(/[A-Za-z0-9+*/^).}\\-]$/.test(source.slice(0,m.index).trim())||/^(?:[A-Za-z0-9+*/^({\\-]|\.\d)/.test(source.slice(re.lastIndex).trim()))return null;
      var closedEnd=/כל הקצוות כלולים/.test(text)||!!m[3]&&!/לא/.test(m[3]);
      if(!/כל הקצוות כלולים/.test(text)&&!m[3])return null;
      ranges.push({ start: start, end: end, closedStart: true, closedEnd: closedEnd });
      covered.push([m.index,re.lastIndex]);
    }
    // Every range connector must belong to one fully accepted interval. An
    // unknown bound must not disappear while another class still renders.
    var connector, connectors=/עד|-/g;
    while((connector=connectors.exec(source))){
      var at=connector.index, before=source.slice(0,at).trim().slice(-1), after=source.slice(at+connector[0].length).trim().charAt(0);
      if(connector[0]==='עד'&&(/[א-ת]/.test(source.charAt(at-1))||/[א-ת]/.test(source.charAt(at+2))))continue;
      if(connector[0]==='-'&&!/[0-9A-Za-z∞]/.test(before+after))continue;
      if(!covered.some(function(span){return at>=span[0]&&at+connector[0].length<=span[1];}))return null;
    }
    if (ranges.length < 1 || ranges.length > 6) return null;
    if(newPartition){
      var hint=focus(options),mentioned=ranges.flatMap(function(r){return [r.start,r.end];}).filter(function(v,i,list){return list.indexOf(v)===i&&new RegExp('(^|[^0-9.])'+String(v).replace('.', '\\.')+'(?=$|[^0-9.])').test(hint);});
      if(!standard(options)||!/בין|קצוות|רווח|חפיפה/.test(hint)||mentioned.length<2)return null;
    }
    var discrete=/שלם|שלמים|בדיד|לספירת/.test(part+' '+text)&&!/מסות|ק״ג|קילוגר|רציפ/.test(part);
    if(discrete&&ranges.some(function(r){return !Number.isInteger(r.start)||!Number.isInteger(r.end)||r.end-r.start>50;}))return null;
    return { kind: 'authored-intervals', intervals: ranges, discrete:discrete,
      caption: discrete?'המחלקות הנתונות, עם המספרים השלמים בלבד כפי שנדרש בסעיף. החלוקה לא תוקנה.':'המחלקות כפי שהוצעו בשאלה, על ציר מספרים. החלוקה לא תוקנה.' };
  }
  function numberLine(context,options){
    if(!request(options,/ציר|ישר מספרים|קבוצה|נקוד|שנתות|אפס|קטן|גדול/))return null;
    var q=prose(context.questionText), part=prose(context.partText), text=q+' '+part;
    var axisIntent=/ציר מספרים|ישר מספרים/.test(text+' '+focus(options));
    if(!axisIntent||/מערכת צירים/.test(part))return null;
    var points=[],m,math=[],raw=clean(context.questionText+' '+context.partText),mathRe=/\$([^$]+)\$/g;
    while((m=mathRe.exec(raw)))math.push(prose(m[1]));
    function addPoint(name,value){if(!Number.isFinite(value)||Math.abs(value)>10000||points.some(function(p){return p.name===name&&p.value!==value;}))return false;if(!points.some(function(p){return p.name===name;}))points.push({name:name,value:value});return true;}
    var pointRe=/נקודה\s+([A-Z])\s+במספר\s+([+-]?\d+(?:\.\d+)?)(?!\d|\.\d)/g;
    while((m=pointRe.exec(text))){if(/^[A-Za-z0-9+*/^()\\-]/.test(text.slice(pointRe.lastIndex).trim())||!addPoint(m[1],Number(m[2])))return null;}
    for(var chunk of math){
      if(/^[A-Z]\s*=/.test(chunk)){
        m=chunk.match(/^([A-Z])\s*=\s*([+-]?\d+(?:\.\d+)?)$/);if(!m||!addPoint(m[1],Number(m[2])))return null;
      }
    }
    var bounds=text.match(/(?:ציר|ישר)\s+מספרים\s+מ[־-]?\s*([+-]?\d+(?:\.\d+)?)\s+עד\s+([+-]?\d+(?:\.\d+)?)/);
    var inequalities=math.filter(function(chunk){return /[<>≤≥]|\\leq|\\geq/.test(chunk);}),condition=null;
    if(inequalities.length){
      // One complete atomic authored condition only. A negative/coefficient
      // LHS, a chained inequality, or conjunction needs solving/composition.
      if(inequalities.length!==1)return null;
      condition=inequalities[0].match(/^x\s*(<=|>=|<|>|≤|≥|\\leq|\\geq)\s*([+-]?\d+(?:\.\d+)?)$/);
      if(!condition)return null;
    }else{
      var words=q.match(/\bx\s+(?:נדרש\s+להיות\s+)?(קטן|גדול)\s+מ[־-]?\s*([+-]?\d+(?:\.\d+)?)(?!\d|\.\d)/);
      if(words)condition=[words[0],words[1]==='קטן'?'<':'>',words[2]];
    }
    if(!points.length&&!condition)return null;
    if(points.length>8||condition&&Math.abs(Number(condition[2]))>10000)return null;
    var values=points.map(function(p){return p.value;});if(condition)values.push(Number(condition[2]));
    var lo=bounds?Number(bounds[1]):Math.floor(Math.min.apply(Math,[0].concat(values)))-2,hi=bounds?Number(bounds[2]):Math.ceil(Math.max.apply(Math,[0].concat(values)))+2;
    if(!(lo<hi)||Math.abs(lo)>10000||Math.abs(hi)>10000||points.some(function(p){return p.value<lo||p.value>hi;}))return null;
    var op=condition&&condition[1].replace(/\\leq|≤/,'<=').replace(/\\geq|≥/,'>=');
    return {kind:'authored-number-line',min:lo,max:hi,tick:/חצי יחידה/.test(part)?0.5:/כל יחידה/.test(part)?1:null,points:points,
      condition:condition?{operator:op,boundary:Number(condition[2])}:null,
      caption:condition?'האי־שוויון הנתון מסומן על ישר מספרים. לא נוסף אילוץ שלא נכתב.':'הנקודות ומספריהן כפי שנכתבו בשאלה. לא חושבו נקודות נוספות.'};
  }

  function resolve(data, exercise, options, svgText) {
    options = options || {};
    var native = root.NoamNativeVisual, context = native && native.authoredContext && native.authoredContext(data, exercise, svgText);
    if(!context)return null;
    var explicitFormula=!standard(options)&&formulas(focus(options)).length>0;
    if (!explicitFormula&&/דוגמה\s+נגדית|דוגמה\s+אחרת|נניח\s+ש/.test(focus(options))) return null;
    if (!explicitFormula&&/הטענה\s+(?:אינה|לא)\s+נכונה\s+תמיד|דוגמה\s+נגדית/.test(prose(context.partText))) return null;
    return fromContext(context,options);
  }
  function fromContext(context,options){
    var scene = intervals(context, options) || numberLine(context, options) || functionScene(context, options);
    if (!scene && root.NoamAuthoredGeometry && typeof root.NoamAuthoredGeometry.resolve === 'function') scene = root.NoamAuthoredGeometry.resolve(context, options);
    return scene || null;
  }
  function svgNode(document, tag, attrs, text) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, String(attrs[key])); });
    if (text != null) node.textContent = String(text);
    return node;
  }
  function line(document, svg, x1, y1, x2, y2, attrs) { svg.appendChild(svgNode(document, 'line', Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2, stroke: '#475569', 'stroke-width': 1.5 }, attrs || {}))); }
  function label(document, svg, x, y, text, attrs) { svg.appendChild(svgNode(document, 'text', Object.assign({ x: x, y: y, fill: '#142c49', 'font-family': 'Arial,sans-serif', 'font-size': 14, 'text-anchor': 'middle', direction: 'ltr', 'unicode-bidi': 'isolate' }, attrs || {}), text)); }
  function card(document, kind, caption, height) {
    var figure = document.createElement('figure'); figure.className = 'noam-visual-card noam-geometry noam-authored-visual'; figure.dataset.visualKind = kind;
    var svg = svgNode(document, 'svg', { viewBox: '0 0 480 ' + height, role: 'img', 'aria-label': caption });
    svg.style.cssText = 'display:block;width:100%;height:auto;max-height:480px;background:white';
    var cap = document.createElement('figcaption'); cap.textContent = caption; figure.appendChild(svg); figure.appendChild(cap);
    return { figure: figure, svg: svg, caption: cap };
  }
  function intervalFigure(document, scene) {
    if(scene.discrete!==undefined&&typeof scene.discrete!=='boolean')return null;
    if (!Array.isArray(scene.intervals) || scene.intervals.length < 1 || scene.intervals.length > 6 || scene.intervals.some(function (r) { return !r || !Number.isFinite(r.start) || !Number.isFinite(r.end) || !(r.start < r.end) || Math.abs(r.start) > 10000 || Math.abs(r.end) > 10000 || typeof r.closedStart !== 'boolean' || typeof r.closedEnd !== 'boolean'; })) return null;
    var min = Math.min.apply(Math, scene.intervals.map(function (r) { return r.start; })), max = Math.max.apply(Math, scene.intervals.map(function (r) { return r.end; }));
    var c = card(document, scene.kind, scene.caption, 100 + scene.intervals.length * 48), px = function (x) { return 45 + (x - min) / (max - min) * 390; };
    var colors = ['#1769aa', '#c56816', '#157d72'];
    line(document, c.svg, 30, 40, 450, 40); label(document, c.svg, 450, 26, 'x');
    var ends = Array.from(new Set(scene.intervals.flatMap(function (r) { return [r.start, r.end]; }))).sort(function (a, b) { return a - b; });
    ends.forEach(function (x) { line(document, c.svg, px(x), 35, px(x), 45); label(document, c.svg, px(x), 64, x); });
    scene.intervals.forEach(function (r, i) {
      var y = 90 + i * 48, color = colors[i % colors.length];
      if(scene.discrete){
        if(!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.end-r.start>50)return;
        var group=svgNode(document,'g',{'data-role':'given-interval'});
        for(var v=r.start;v<=r.end;v++){if(v===r.start&&!r.closedStart||v===r.end&&!r.closedEnd)continue;group.appendChild(svgNode(document,'circle',{cx:px(v),cy:y,r:4,fill:color,'data-role':'given-integer'}));}
        c.svg.appendChild(group);
      }else line(document, c.svg, px(r.start), y, px(r.end), y, { stroke: color, 'stroke-width': 5, 'data-role': 'given-interval' });
      [[r.start, r.closedStart], [r.end, r.closedEnd]].forEach(function (pair) { c.svg.appendChild(svgNode(document, 'circle', { cx: px(pair[0]), cy: y, r: 5, fill: pair[1] ? color : 'white', stroke: color, 'stroke-width': 2 })); });
      label(document, c.svg, (px(r.start) + px(r.end)) / 2, y + 25, r.start + (r.closedStart?' ≤ x':' < x') + (r.closedEnd?' ≤ ':' < ') + r.end);
    });
    return c.figure;
  }
  function numberLineFigure(document,scene){
    if(!Number.isFinite(scene.min)||!Number.isFinite(scene.max)||!(scene.min<scene.max)||Math.abs(scene.min)>10000||Math.abs(scene.max)>10000||!Array.isArray(scene.points)||scene.points.length>8)return null;
    if(scene.points.some(function(p){return !p||!/^[A-Z]$/.test(p.name)||!Number.isFinite(p.value)||p.value<scene.min||p.value>scene.max;}))return null;
    var cond=scene.condition;if(cond&&(!/^(?:<|>|<=|>=)$/.test(cond.operator)||!Number.isFinite(cond.boundary)||cond.boundary<scene.min||cond.boundary>scene.max))return null;
    if(!scene.points.length&&!cond)return null;
    var c=card(document,scene.kind,scene.caption,180),px=function(x){return 45+(x-scene.min)/(scene.max-scene.min)*390;};
    line(document,c.svg,30,90,450,90);label(document,c.svg,460,95,'x');
    var span=scene.max-scene.min,step=scene.tick||Math.pow(10,Math.floor(Math.log10(span/10)));if(!(step>0)||span/step>50)step=span/10;
    for(var x=Math.ceil(scene.min/step)*step;x<=scene.max+step/100;x+=step){var v=Number(x.toPrecision(10));line(document,c.svg,px(v),84,px(v),96);label(document,c.svg,px(v),118,v,{'font-size':12});}
    if(cond){var y=60,start=cond.operator.charAt(0)==='<'?30:px(cond.boundary),end=cond.operator.charAt(0)==='<'?px(cond.boundary):450;
      line(document,c.svg,start,y,end,y,{stroke:'#1769aa','stroke-width':5,'data-role':'given-inequality'});
      var arrow=cond.operator.charAt(0)==='<'?start:end,dir=cond.operator.charAt(0)==='<'?1:-1;line(document,c.svg,arrow,y,arrow+dir*8,y-6,{stroke:'#1769aa','stroke-width':3});line(document,c.svg,arrow,y,arrow+dir*8,y+6,{stroke:'#1769aa','stroke-width':3});
      c.svg.appendChild(svgNode(document,'circle',{cx:px(cond.boundary),cy:y,r:5,fill:cond.operator.length===2?'#1769aa':'white',stroke:'#1769aa','stroke-width':2}));label(document,c.svg,px(cond.boundary),40,cond.boundary);}
    scene.points.forEach(function(p,i){c.svg.appendChild(svgNode(document,'circle',{cx:px(p.value),cy:90,r:5,fill:'#1769aa','data-role':'given-point'}));label(document,c.svg,px(p.value),65-(i%2)*18,p.name+'='+p.value);});
    return c.figure;
  }
  function machineFigure(document, scene, ast) {
    var c = card(document, scene.kind, scene.caption, 180);
    [['x', 48, 58, 64], [expressionText(ast), 150, 42, 205], ['?', 395, 58, 64]].forEach(function (part) {
      c.svg.appendChild(svgNode(document, 'rect', { x: part[1], y: part[2], width: part[3], height: part[1] === 150 ? 90 : 58, rx: 8, fill: '#f2f7ff', stroke: '#1769aa', 'stroke-width': 2 }));
      label(document, c.svg, part[1] + part[3] / 2, 96, part[0], { 'font-size': part[1] === 150 ? 19 : 22 });
    });
    line(document, c.svg, 114, 88, 145, 88); line(document, c.svg, 358, 88, 391, 88);
    label(document, c.svg, 80, 144, 'קלט', { direction: 'rtl' }); label(document, c.svg, 428, 144, 'פלט', { direction: 'rtl' });
    return c.figure;
  }
  // Interval arithmetic certifies every drawn segment stays inside the domain.
  // In particular, a rational curve must not connect across a hidden pole.
  function range(ast, lo, hi) {
    if (ast.type === 'number') return [ast.value, ast.value];
    if (ast.type === 'x') return [lo, hi];
    var a = range(ast.left, lo, hi), b = ast.right && range(ast.right, lo, hi); if (!a || ast.right && !b) return null;
    if (ast.type === 'neg') return [-a[1], -a[0]];
    if (ast.type === 'sqrt') return a[0] < 0 ? null : [Math.sqrt(a[0]), Math.sqrt(a[1])];
    if (ast.type === 'pow') { if(ast.value===0&&a[0]<=0&&a[1]>=0)return null; var n = ast.value, values = [Math.pow(a[0], n), Math.pow(a[1], n)]; if (n % 2 === 0 && a[0] <= 0 && a[1] >= 0) values.push(n === 0 ? 1 : 0); return [Math.min.apply(Math, values), Math.max.apply(Math, values)]; }
    if (ast.type === 'add') return [a[0] + b[0], a[1] + b[1]];
    if (ast.type === 'sub') return [a[0] - b[1], a[1] - b[0]];
    if (ast.type === 'div') { if (b[0] <= 0 && b[1] >= 0) return null; b = [1 / b[1], 1 / b[0]]; }
    var products = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]; return [Math.min.apply(Math, products), Math.max.apply(Math, products)];
  }
  function functionFigure(document, scene, asts) {
    var c = card(document, scene.kind, scene.caption, 350), left = 45, top = 25, w = 400, h = 280, min = -10, max = 10;
    var values = []; asts.forEach(function(ast){for (var n = 0; n <= 400; n++) { var value = evaluate(ast, min + (max - min) * n / 400); if (Number.isFinite(value) && Math.abs(value) < 10000) values.push(Math.abs(value)); }});
    if (values.length < 4) return null;
    values.sort(function (a, b) { return a - b; }); var limit = Math.max(5, Math.min(100, values[Math.floor(values.length * .75)] * 1.2));
    var px = function (x) { return left + (x - min) / (max - min) * w; }, py = function (y) { return top + (limit - y) / (2 * limit) * h; };
    for (var x = -10; x <= 10; x += 2) { line(document, c.svg, px(x), top, px(x), top + h, { stroke: '#e2e8f0', 'stroke-width': 1 }); label(document, c.svg, px(x), top + h + 20, x); }
    line(document, c.svg, left, py(0), left + w, py(0)); line(document, c.svg, px(0), top, px(0), top + h);
    label(document, c.svg, left + w + 12, py(0) + 4, 'x'); label(document, c.svg, px(0) + 14, top + 8, 'y');
    [-limit, limit].forEach(function (v) { label(document, c.svg, left - 6, py(v) + 4, Number(v.toPrecision(3)), { 'text-anchor': 'end', 'font-size': 11 }); });
    var colors = ['#1769aa', '#bd5712', '#157d72', '#993f89'];
    for(var a=0;a<asts.length;a++){
      var ast=asts[a], path = '', active = false, previous = min;
      for (var i = 0; i <= 800; i++) {
        var current = min + (max - min) * i / 800, y = evaluate(ast, current), domain = range(ast, previous, current);
        if (!Number.isFinite(y) || Math.abs(y) > limit || !domain) { active = false; previous = current; continue; }
        path += (active ? ' L' : ' M') + px(current).toFixed(3) + ' ' + py(y).toFixed(3); active = true; previous = current;
      }
      if (!path) return null;
      c.svg.appendChild(svgNode(document, 'path', { d: path.trim(), fill: 'none', stroke: colors[a], 'stroke-width': 2.5, 'data-role': 'given-function' }));
      var entry=scene.expressions&&scene.expressions[a]||{expression:scene.expression,label:'y'};
      var formula = document.createElement('bdi'); formula.dir = 'ltr'; formula.textContent = entry.label+'='+entry.expression; formula.style.color=colors[a]; c.caption.appendChild(document.createElement('br')); c.caption.appendChild(formula);
    }
    return c.figure;
  }

  function render(document, scene) {
    if (!document || !scene || typeof scene.caption !== 'string' || scene.caption.length > 500) return null;
    if (scene.kind === 'authored-intervals') return intervalFigure(document, scene);
    if (scene.kind === 'authored-number-line') return numberLineFigure(document,scene);
    if (scene.kind === 'authored-function' || scene.kind === 'authored-input-machine') {
      var expressions=scene.expressions||[{expression:scene.expression,label:'y'}];
      if(!Array.isArray(expressions)||expressions.length<1||expressions.length>4||expressions.some(function(e){return !e||typeof e.expression!=='string'||!/^(?:y|[fgh]\(x\))$/.test(e.label);})){return null;}
      var asts=expressions.map(function(e){return parseExpression(e.expression);});
      if(asts.some(function(ast){return !ast;})){return null;}
      return scene.kind === 'authored-input-machine' ? (asts.length===1?machineFigure(document, scene, asts[0]):null) : functionFigure(document, scene, asts);
    }
    return root.NoamAuthoredGeometry && typeof root.NoamAuthoredGeometry.render === 'function' ? root.NoamAuthoredGeometry.render(document, scene) : null;
  }
  return { restrictedFunctionDomain:restrictedFunctionDomain, functionSources:authoredRule, resolve: resolve, fromContext: fromContext, render: render, parseExpression: parseExpression, evaluate: evaluate, formulas: formulas, range: range };
});
