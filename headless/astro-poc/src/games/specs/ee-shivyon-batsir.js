/** אי־שוויון על הציר: מסמנים, פותרים (והופכים סימן בכפל וחילוק במספר שלילי) ובודקים ערכים. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c', MUTED = '#475569';
  var W = 402, LO = -6, HI = 6;
  function num(v) { return v < 0 ? '\u2212' + Math.abs(v) : String(v); }
  function sub(v) { return v < 0 ? '(' + num(v) + ')' : String(v); }
  function px(v) { return 201 + 30 * v; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function bdi(t) { return '<bdi class="math" dir="ltr">' + t + '</bdi>'; }
  function mt(x, y, label, size, fill, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="'
      + (size || 13) + '" fill="' + (fill || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function ht(x, y, label, size, fill, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 13)
      + '" font-weight="700" fill="' + (fill || PAL.ink) + '" text-anchor="' + (anchor || 'start') + '">' + label + '</text>';
  }
  /** The number line: axis, ticks and labels, with the axis at height y. */
  function lineBase(y, labels) {
    var h = '<path d="M12 ' + y + ' H392" stroke="' + PAL.ink + '" stroke-width="2.5" fill="none"/>'
      + '<path d="M386 ' + (y - 5) + ' L392 ' + y + ' L386 ' + (y + 5) + '" stroke="' + PAL.ink + '" stroke-width="2.5" fill="none"/>';
    for (var v = LO; v <= HI; v++) {
      h += '<line x1="' + px(v) + '" y1="' + (y - 6) + '" x2="' + px(v) + '" y2="' + (y + 6) + '" stroke="' + PAL.ink + '" stroke-width="2"/>';
      if (labels) h += mt(px(v), y + 28, num(v), 13, v === 0 ? PAL.ink : MUTED);
    }
    return h;
  }
  function rayHtml(p, dir, y) {
    var R = dir === 'R';
    return '<line id="ray" x1="' + px(p) + '" y1="' + y + '" x2="' + (R ? 384 : 18) + '" y2="' + y + '" stroke="' + PAL.main + '" stroke-width="8" stroke-linecap="butt" opacity=".5"/>'
      + '<polygon id="rayTip" points="' + (R ? '398,' + y + ' 384,' + (y - 9) + ' 384,' + (y + 9) : '4,' + y + ' 18,' + (y - 9) + ' 18,' + (y + 9)) + '" fill="' + PAL.main + '" opacity=".5"/>';
  }
  function setRay(root, p, dir, y) {
    var R = dir === 'R';
    var ray = root.querySelector('#ray'), tip = root.querySelector('#rayTip');
    ray.setAttribute('x1', px(p)); ray.setAttribute('x2', R ? 384 : 18);
    tip.setAttribute('points', R ? '398,' + y + ' 384,' + (y - 9) + ' 384,' + (y + 9) : '4,' + y + ' 18,' + (y - 9) + ' 18,' + (y + 9));
  }
  function circleAttrs(open) {
    return open ? { fill: '#fff', stroke: PAL.main } : { fill: PAL.main, stroke: PAL.dark };
  }
  function signOf(dir, open) { return dir === 'R' ? (open ? '>' : '\u2265') : (open ? '<' : '\u2264'); }
  function ctrlBtn(id, label, aria, extra) {
    return '<button type="button" id="' + id + '" aria-label="' + aria + '" style="min-height:44px;min-width:44px;' + (extra || 'width:56px;')
      + 'border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.soft + ';color:' + PAL.dark + ';font-size:20px;font-family:Secular One,sans-serif;cursor:pointer">' + label + '</button>';
  }
  function keyDelta(key) {
    if (key === 'ArrowLeft' || key === 'ArrowDown') return -1;
    if (key === 'ArrowRight' || key === 'ArrowUp') return 1;
    return 0;
  }
  /** One handler for the keyboard: arrows move by one, Home and End jump to the ends. */
  function bindKeys(handle, get, set) {
    handle.addEventListener('keydown', function (event) {
      var d = keyDelta(event.key);
      if (d) { event.preventDefault(); set(clamp(get() + d, LO, HI)); return; }
      if (event.key === 'Home') { event.preventDefault(); set(LO); }
      if (event.key === 'End') { event.preventDefault(); set(HI); }
    });
  }
  function handleMarkup(id, label, y, value) {
    return '<style>#' + id + ':focus-visible .hRing{stroke:' + PAL.dark + ';stroke-width:3}</style>'
      + '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + LO + '" aria-valuemax="' + HI + '" aria-valuenow="' + value + '" style="cursor:grab">'
      + '<rect class="hRing" x="-32" y="-32" width="64" height="64" rx="14" fill="transparent"/>'
      + '<circle id="' + id + 'Dot" r="11" stroke-width="3"/></g>';
  }
  function place(handle, v, y, text) {
    handle.setAttribute('transform', 'translate(' + px(v) + ' ' + y + ')');
    handle.setAttribute('aria-valuenow', String(v));
    handle.setAttribute('aria-valuetext', text);
  }

  /* ---------- scene 1: mark x ≥ −2 ---------- */
  var T1 = -2, Y1 = 62;
  function markScene(ctx) {
    var pos = 0, dir = 'L', open = true, done = false;
    ctx.draw(lineBase(Y1, true) + rayHtml(pos, dir, Y1) + handleMarkup('markHandle', 'נקודת הקצה של הסימון; הזז בעזרת מקשי החצים', Y1, 0));
    var root = ctx.svg, handle = ctx.el('markHandle'), dot = ctx.el('markHandleDot');
    var box = ctx.extra('<div class="sceneStrip"><b>הסימון שלך נקרא</b><bdi class="math" dir="ltr" data-read style="font-size:21px;font-family:Secular One,sans-serif" aria-live="polite"></bdi></div>'
      + '<div dir="ltr" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px">'
      + ctrlBtn('moveLeft', '←', 'הזז את הנקודה שמאלה ביחידה אחת') + ctrlBtn('moveRight', '→', 'הזז את הנקודה ימינה ביחידה אחת') + '</div>'
      + '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:8px">'
      + ctrlBtn('dirBtn', 'הפוך כיוון הצביעה ⇄', 'הפוך את כיוון הצביעה', 'padding:0 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:15px;')
      + ctrlBtn('circBtn', 'פתוח ⇄ סגור', 'החלף עיגול פתוח ועיגול סגור', 'padding:0 14px;font-family:Heebo,sans-serif;font-weight:700;font-size:15px;') + '</div>');
    ctx.register('moves', box);
    function render(acted) {
      place(handle, pos, Y1, 'x ' + signOf(dir, open) + ' ' + num(pos));
      var a = circleAttrs(open);
      dot.setAttribute('fill', a.fill); dot.setAttribute('stroke', a.stroke);
      setRay(root, pos, dir, Y1);
      box.querySelector('[data-read]').textContent = 'x ' + signOf(dir, open) + ' ' + num(pos);
      box.querySelector('#dirBtn').setAttribute('aria-pressed', String(dir === 'R'));
      box.querySelector('#circBtn').setAttribute('aria-pressed', String(!open));
      ctx.caption('המטרה: ' + m('x \u2265 \u22122') + ' · הסימון שלך: ' + m('x ' + signOf(dir, open) + ' ' + num(pos)));
      if (pos === T1 && dir === 'R' && !open) {
        ctx.note('בדיוק: ' + m('\u22122') + ' עצמו שייך לפתרון (עיגול סגור), וגם כל מספר גדול ממנו (צביעה ימינה).', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (pos === T1 && dir === 'R' && open) {
        ctx.note('עיגול פתוח אומר ש־' + m('\u22122') + ' לא נכלל, וזה ' + m('x > \u22122') + '. בסימן ' + m('\u2265') + ' המספר עצמו כן נכלל: סגור את העיגול.');
      } else if (pos === T1) {
        ctx.note('הצביעה פונה שמאלה, אל המספרים הקטנים. ' + m('\u2265') + ' פירושו גדול או שווה, ולכן הצביעה פונה ימינה.');
      } else if (pos === 2) {
        ctx.note('שמת את הנקודה על ' + m('2') + ', אבל באי־השוויון כתוב ' + m('\u22122') + '. המינוס מעביר אותה לשמאל האפס.');
      } else {
        ctx.note('הנקודה צריכה לעמוד על המספר שבאי־השוויון, ' + m('\u22122') + '. כרגע היא על ' + m(num(pos)) + '.');
      }
    }
    function setPos(v) { pos = v; ctx.sfx('tick'); render(true); }
    function flipDir() { dir = dir === 'R' ? 'L' : 'R'; ctx.sfx('click'); render(true); }
    function flipOpen() { open = !open; ctx.sfx('click'); render(true); }
    box.querySelector('#moveLeft').addEventListener('click', function () { setPos(clamp(pos - 1, LO, HI)); });
    box.querySelector('#moveRight').addEventListener('click', function () { setPos(clamp(pos + 1, LO, HI)); });
    box.querySelector('#dirBtn').addEventListener('click', flipDir);
    box.querySelector('#circBtn').addEventListener('click', flipOpen);
    bindKeys(handle, function () { return pos; }, setPos);
    ctx.drag(handle, {
      move: function (x) { pos = clamp(Math.round((x - 201) / 30), LO, HI); render(false); },
      end: function () { render(true); }
    });
    render(false);
    ctx.note('המטרה: ' + m('x \u2265 \u22122') + '. הזז את הנקודה, בחר כיוון וסוג עיגול.');
  }

  /* ---------- scene 2: solve −3x + 4 > 13 ---------- */
  var ORIG = { a: -3, c: 4, s: '>', r: 13 };
  function fmt(l) {
    var left = l.a === 1 ? 'x' : l.a === -1 ? '\u2212x' : num(l.a) + 'x';
    if (l.c !== 0) left += l.c > 0 ? ' + ' + l.c : ' \u2212 ' + Math.abs(l.c);
    return left + ' ' + l.s + ' ' + num(l.r);
  }
  function truth(l, v) { var lhs = l.a * v + l.c; return l.s === '>' ? lhs > l.r : lhs < l.r; }
  function same(l) {
    for (var v = LO; v <= HI; v++) if (truth(l, v) !== truth(ORIG, v)) return false;
    return true;
  }
  function counter(l) {
    var order = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];
    for (var i = 0; i < order.length; i++) if (truth(l, order[i]) !== truth(ORIG, order[i])) return order[i];
    return null;
  }
  function rowDots(l, y, cols) {
    var h = '';
    for (var v = LO; v <= HI; v++) {
      h += truth(l, v)
        ? '<circle cx="' + px(v) + '" cy="' + y + '" r="9" fill="' + PAL.main + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
        : '<circle cx="' + px(v) + '" cy="' + y + '" r="5" fill="#fff" stroke="#64748b" stroke-width="2"/>';
    }
    return h;
  }
  function solveDrawing(l) {
    var h = '';
    for (var v = LO; v <= HI; v++) {
      if (truth(l, v) !== truth(ORIG, v)) h += '<rect x="' + (px(v) - 14) + '" y="30" width="28" height="104" rx="8" fill="#fde8ec" stroke="' + BAD + '" stroke-width="1.5"/>';
    }
    h += ht(392, 22, 'המקורי', 13, PAL.dark) + '<path d="M12 50 H392" stroke="' + PAL.line + '" stroke-width="2"/>' + rowDots(ORIG, 50);
    h += ht(392, 90, 'השורה שלך', 13, PAL.dark) + '<path d="M12 112 H392" stroke="' + PAL.line + '" stroke-width="2"/>' + rowDots(l, 112);
    for (var k = LO; k <= HI; k++) h += mt(px(k), 150, num(k), 12, MUTED);
    return h;
  }
  function solveScene(ctx) {
    var line = { a: ORIG.a, c: ORIG.c, s: ORIG.s, r: ORIG.r }, hist = [], done = false;
    var box = ctx.extra('<div class="sceneStrip"><b>השורה שלך</b><bdi class="math" dir="ltr" data-line style="font-size:22px;font-family:Secular One,sans-serif" aria-live="polite"></bdi></div>');
    ctx.register('ops', box);
    function paintLine(acted) {
      ctx.draw(solveDrawing(line));
      box.querySelector('[data-line]').textContent = fmt(line);
      ctx.caption('כל פעולה נעשית בשני האגפים · עיגול מלא = הערך מקיים את אי־השוויון');
      var ok = same(line);
      var last = hist.length ? hist[hist.length - 1] : null;
      if (!ok) {
        var v = counter(line);
        var lhs = ORIG.a * v + ORIG.c;
        var lead = 'הצעד האחרון שינה את קבוצת הפתרונות. ';
        if (last && last.kind === 'neg' && last.prev.s === line.s) lead = 'חילקת במספר שלילי ושכחת להפוך את הסימן. ';
        else if (last && last.kind === 'flip') lead = 'הפכת סימן כשלא היה צורך: ההפיכה נעשית רק בכפל או בחילוק במספר שלילי. ';
        ctx.note(lead + 'לדוגמה ב־' + m('x = ' + num(v)) + ': במקור ' + m(num(ORIG.a) + ' \u00B7 ' + sub(v) + ' + 4 = ' + num(lhs))
          + ', ולכן הוא ' + (truth(ORIG, v) ? 'מקיים' : 'לא מקיים') + ' את המקורי, אבל ' + (truth(line, v) ? 'מקיים' : 'לא מקיים') + ' את השורה שלך.');
        return;
      }
      if (line.a === 1 && line.c === 0) {
        ctx.note('נכון: ' + m(fmt(line)) + '. כשחילקת במספר שלילי הסימן התהפך, וכל הערכים מהמקורי נשמרו.', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (line.c !== 0) {
        ctx.note('הצעד שמר על הפתרונות. עוד נשאר מספר חופשי ליד ' + m('x') + ': בטל אותו בפעולה הפוכה בשני האגפים.');
      } else {
        ctx.note('הצעד שמר על הפתרונות. נשאר מקדם ליד ' + m('x') + ': חלק או כפול כדי להשאיר את ' + m('x') + ' לבד.');
      }
    }
    function apply(kind, next, ctrlText) {
      hist.push({ prev: line, kind: kind });
      line = next; ctx.sfx('click'); paintLine(true);
    }
    function addK(k) { apply('add', { a: line.a, c: line.c + k, s: line.s, r: line.r + k }); }
    function divK(k) {
      if (line.a % k !== 0 || line.c % k !== 0 || line.r % k !== 0) {
        ctx.sfx('error'); ctx.note('החילוק ב־' + m(num(k)) + ' לא יוצא בשלמים. נסה קודם לבודד את האיבר עם ' + m('x') + ', או בחר מחלק אחר.'); return;
      }
      apply(k < 0 ? 'neg' : 'pos', { a: line.a / k, c: line.c / k, s: line.s, r: line.r / k });
    }
    function mulNeg() { apply('neg', { a: -line.a, c: -line.c, s: line.s, r: -line.r }); }
    function flip() { apply('flip', { a: line.a, c: line.c, s: line.s === '>' ? '<' : '>', r: line.r }); }
    function undo() {
      if (!hist.length) { ctx.note('אין צעד לבטל. השורה היא השורה המקורית.'); return; }
      line = hist.pop().prev; ctx.sfx('tick'); paintLine(false);
    }
    ctx.button('חסר ' + m('4'), function () { addK(-4); }, { id: 'opSub4', target: 'ops' }).setAttribute('aria-label', 'חסר ארבע משני האגפים');
    ctx.button('חבר ' + m('4'), function () { addK(4); }, { id: 'opAdd4', ghost: true }).setAttribute('aria-label', 'חבר ארבע לשני האגפים');
    ctx.button('חלק ב־' + m('3'), function () { divK(3); }, { id: 'opDiv3', ghost: true }).setAttribute('aria-label', 'חלק את שני האגפים בשלוש');
    ctx.button('חלק ב־' + m('(\u22123)'), function () { divK(-3); }, { id: 'opDivN3' }).setAttribute('aria-label', 'חלק את שני האגפים במינוס שלוש');
    ctx.button('כפול ב־' + m('(\u22121)'), mulNeg, { id: 'opMulN1', ghost: true }).setAttribute('aria-label', 'כפול את שני האגפים במינוס אחד');
    ctx.button('הפוך סימן ⇄', flip, { id: 'flipSign', target: 'flip' }).setAttribute('aria-label', 'הפוך את כיוון סימן אי־השוויון');
    ctx.button('בטל צעד ↶', undo, { id: 'undoStep', ghost: true });
    paintLine(false);
    ctx.note('המטרה: להשאיר ' + m('x') + ' לבד. אל תשכח מה קורה לסימן כשפועלים במספר שלילי.');
  }

  /* ---------- scene 3: check 2x − 1 ≤ 5 ---------- */
  var Y3 = 82;
  function checkScene(ctx) {
    var t = 0, seen = {}, done = false;
    var h = lineBase(Y3, true);
    for (var v = LO; v <= HI; v++) h += '<g id="mk' + v + '" visibility="hidden"></g>';
    // rayHtml already sets id="ray"/"rayTip"; a second id attribute would be ignored by the parser,
    // so rename the ids instead of appending new ones.
    h += rayHtml(3, 'L', Y3).replace('id="ray"', 'id="finalRay"').replace('id="rayTip"', 'id="finalTip"')
      .replace('opacity=".5"', 'opacity="0"').replace('opacity=".5"', 'opacity="0"');
    h += '<circle id="finalDot" cx="' + px(3) + '" cy="' + Y3 + '" r="11" fill="' + PAL.main + '" stroke="' + PAL.dark + '" stroke-width="3" opacity="0"/>';
    h += handleMarkup('tHandle', 'נקודת הבדיקה; הזז בעזרת מקשי החצים', Y3, 0);
    ctx.draw(h);
    var handle = ctx.el('tHandle'), dot = ctx.el('tHandleDot');
    dot.setAttribute('fill', PAL.warm); dot.setAttribute('stroke', '#fff');
    var box = ctx.extra('<div class="sceneStrip"><b>בדיקה של אי־השוויון</b><bdi class="math" dir="ltr" data-eq style="font-size:21px;font-family:Secular One,sans-serif">2x \u2212 1 \u2264 5</bdi>'
      + '<div style="font-size:13px;font-weight:700;color:' + MUTED + '" data-count></div></div>'
      + '<div dir="ltr" style="display:flex;justify-content:center;gap:8px;margin-top:10px">'
      + ctrlBtn('tMinus', '\u2212', 'הקטן את נקודת הבדיקה ביחידה אחת') + ctrlBtn('tPlus', '+', 'הגדל את נקודת הבדיקה ביחידה אחת') + '</div>');
    ctx.register('tests', box);
    function mark(v) {
      var ok = 2 * v - 1 <= 5, g = ctx.el('mk' + v), y = 36;
      g.innerHTML = ok
        ? '<circle cx="' + px(v) + '" cy="' + y + '" r="9" fill="' + PAL.good + '" stroke="#fff" stroke-width="2"/><path d="M' + (px(v) - 4) + ' ' + y + ' l3 3 l6 -6" stroke="#fff" stroke-width="2.4" fill="none"/>'
        : '<rect x="' + (px(v) - 9) + '" y="' + (y - 9) + '" width="18" height="18" rx="4" fill="' + BAD + '" stroke="#fff" stroke-width="2"/><path d="M' + (px(v) - 4) + ' ' + (y - 4) + ' l8 8 m0 -8 l-8 8" stroke="#fff" stroke-width="2.4" fill="none"/>';
      g.setAttribute('visibility', 'visible');
    }
    function render() {
      place(handle, t, Y3, 'x = ' + num(t));
      var n = 0, yes = 0;
      for (var k = LO; k <= HI; k++) if (seen[k]) { n++; if (2 * k - 1 <= 5) yes++; }
      box.querySelector('[data-count]').textContent = 'נבדקו ' + n + ' ערכים, ' + yes + ' מהם מקיימים';
    }
    function say(v) {
      var r = 2 * v - 1, ok = r <= 5;
      var calc = m('2 \u00B7 ' + sub(v) + ' \u2212 1 = ' + num(r)) + ', ' + m(num(r) + ' \u2264 5') + (ok ? ' נכון, אז ' : ' לא נכון, אז ') + m('x = ' + num(v)) + (ok ? ' מקיים.' : ' לא מקיים.');
      var tail = '';
      if (v === 3) tail = ' הסימן ' + m('\u2264') + ' מרשה שוויון, לכן גם הקצה ' + m('3') + ' בפנים.';
      return calc + tail;
    }
    function commit(v, acted) {
      t = v; seen[v] = true; mark(v); ctx.sfx(2 * v - 1 <= 5 ? 'tick' : 'error'); render();
      var good = 0;
      for (var k = LO; k < 3; k++) if (seen[k]) good++;
      var ready = seen[3] && seen[4] && good >= 2;
      if (ready) {
        ctx.el('finalRay').setAttribute('opacity', '.5'); ctx.el('finalTip').setAttribute('opacity', '.5'); ctx.el('finalDot').setAttribute('opacity', '1');
        ctx.note(say(v) + ' סיכום: מקיימים גם ' + m('3') + ' וגם כל מספר קטן ממנו, ולכן הפתרון הוא ' + m('x \u2264 3') + ', קבוצה שלמה ולא מספר יחיד.', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (v === 3 && !good) {
        ctx.note(say(v) + ' האם ' + m('3') + ' הוא הפתרון היחיד? בדוק גם מספרים קטנים ממנו.');
      } else if (v > 3) {
        ctx.note(say(v) + ' עברת את הקצה: כל מספר גדול מ־' + m('3') + ' נכשל.');
      } else {
        ctx.note(say(v) + ' המשך לבדוק: קטן יותר, גם ' + m('3') + ' עצמו, וגם ' + m('4') + '.');
      }
    }
    function setT(v) { commit(v, true); }
    box.querySelector('#tMinus').addEventListener('click', function () { setT(clamp(t - 1, LO, HI)); });
    box.querySelector('#tPlus').addEventListener('click', function () { setT(clamp(t + 1, LO, HI)); });
    bindKeys(handle, function () { return t; }, setT);
    ctx.drag(handle, {
      move: function (x) { var v = clamp(Math.round((x - 201) / 30), LO, HI); if (v !== t) commit(v, false); },
      end: function () { commit(t, true); }
    });
    render();
    ctx.caption('עיגול ירוק = מקיים · ריבוע אדום = לא מקיים');
    ctx.note('גרור את נקודת הבדיקה לאורך הציר, בכפתורים או בחיצים, ובדוק אילו ערכים מקיימים ' + m('2x \u2212 1 \u2264 5') + '.');
  }

  function quizLine(p, dir, open) {
    return function (ctx) {
      var a = circleAttrs(open);
      ctx.draw(lineBase(50, true) + rayHtml(p, dir, 50)
        + '<circle cx="' + px(p) + '" cy="50" r="11" fill="' + a.fill + '" stroke="' + a.stroke + '" stroke-width="3"/>');
    };
  }

  var steps = [
    {
      mode: 'intro', tA: 'אי־שוויון על הציר', sub: 'פותרים, מסמנים ובודקים: כל הערכים שמתאימים, לא רק אחד.',
      tip: 'שלום, אני אליהו. באי־השוויון יש הרבה תשובות, ונלמד לראות אותן על ציר המספרים.',
      emoji: '📏', eq: m('x \u2265 \u22122'),
      note: 'עיגול סגור כולל את המספר, עיגול פתוח לא. הצביעה פונה אל הערכים שמקיימים. ' + 'וכשמכפילים או מחלקים במספר שלילי, הסימן מתהפך.',
      cue: 'מוכן לסמן פתרון על הציר?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מסמנים על הציר', sub: 'סמן את ' + m('x \u2265 \u22122') + ' בגרירה, בכפתורים או בחיצים.',
      tip: 'הזז את הנקודה אל ' + m('\u22122') + ', בחר לאן צובעים ואם העיגול פתוח או סגור.',
      aspect: [W, 130], alt: 'ציר מספרים מפחות שש עד שש עם נקודת קצה נגררת, צביעה בכיוון אחד ועיגול פתוח או סגור',
      cue: 'התאם את הציר לאי־השוויון', cueDone: 'הסימון נכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'moves', text: 'לחץ על החצים או על הכפתורים כדי להזיז את הנקודה ולשנות כיוון ועיגול.' }, setup: markScene
    },
    {
      mode: 'quiz', tA: 'איזה אי־שוויון מסומן?', sub: 'העיגול על ' + m('\u22121') + ' סגור, והצביעה פונה שמאלה.',
      tip: 'שים לב גם לסוג העיגול וגם לכיוון הצביעה.', btn: 'המשך ←',
      aspect: [W, 100], alt: 'ציר מספרים עם עיגול סגור על מינוס אחד וצביעה שמאלה', setup: quizLine(-1, 'L', false),
      win: 'בדיוק. עיגול סגור כולל את המספר, והצביעה שמאלה היא לקטנים.', wrongSay: 'בדוק מה אומר העיגול ולאן הצביעה פונה.',
      opts: [
        { t: m('x \u2264 \u22121'), c: true, f: m('\u22121') + ' שייך לפתרון (עיגול סגור), והצביעה שמאלה כוללת את כל המספרים הקטנים ממנו.' },
        { t: m('x < \u22121'), f: 'העיגול כאן סגור, ולכן המספר ' + m('\u22121') + ' כן נכלל. ' + m('<') + ' היה דורש עיגול פתוח.' },
        { t: m('x \u2265 \u22121'), f: 'הצביעה פונה שמאלה, אל הקטנים. ' + m('\u2265') + ' היה צובע ימינה.' },
        { t: m('x > \u22121'), f: 'שתי טעויות יחד: העיגול סגור (לא ' + m('>') + ') והצביעה שמאלה (לא ימינה).' }
      ],
      hints: ['שאל את עצמך שתי שאלות: האם המספר עצמו נכלל, ולאן מתרחבים?', 'עיגול סגור מתאים ל־' + m('\u2264') + ' או ל־' + m('\u2265') + '. הצביעה שמאלה היא למספרים קטנים.', 'קטן או שווה למינוס אחד: ' + m('x \u2264 \u22121') + '.']
    },
    {
      mode: 'scene', tA: 'פותרים צעד אחר צעד', sub: 'פתור את ' + m('\u22123x + 4 > 13') + ' והשאר את ' + m('x') + ' לבד.',
      tip: 'כל פעולה נעשית בשני האגפים. כשפועלים במספר שלילי, הסימן מתהפך, ואם תשכח אראה לך דוגמה שנכשלת.',
      aspect: [W, 160], alt: 'שתי שורות של נקודות על ציר מספרים: הערכים שמקיימים את אי־השוויון המקורי ואת השורה שלך; עמודות אדומות מראות הבדל',
      cue: 'השאר את x לבד בלי לאבד פתרונות', cueDone: 'פתרת נכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'ops', text: 'התחל בביטול המספר החופשי: חסר ארבע משני האגפים.' }, setup: solveScene
    },
    {
      mode: 'quiz', tA: 'מה הפתרון?', sub: 'פתור את ' + m('\u22122x < 8') + '.',
      tip: 'חלק את שני האגפים ב־' + m('\u22122') + ' ושאל מה קורה לסימן.', btn: 'המשך ←',
      win: 'נכון. חילקת במספר שלילי, ולכן הסימן התהפך.', wrongSay: 'בדוק את הסימן של המספר ואת כיוון הסימן.',
      opts: [
        { t: m('x < \u22124'), f: 'חילקת ב־' + m('\u22122') + ' ושכחת להפוך את הסימן. בדיקה: ' + m('x = \u22125') + ' נותן ' + m('10 < 8') + ', וזה לא נכון.' },
        { t: m('x > 4'), f: 'הסימן אמנם התהפך, אבל ' + m('8') + ' חלקי ' + m('\u22122') + ' הוא ' + m('\u22124') + ' ולא ' + m('4') + '. שים לב לסימן של המספר.' },
        { t: m('x > \u22124'), c: true, f: m('8 \u00F7 (\u22122) = \u22124') + ', והסימן התהפך כי חילקנו במספר שלילי. בדיקה: ' + m('x = 0') + ' נותן ' + m('0 < 8') + ', נכון.' },
        { t: m('x < 4'), f: 'שתי טעויות: המספר צריך להיות ' + m('\u22124') + ', והסימן צריך להתהפך.' }
      ],
      hints: ['בדוק מה קורה לסימן כשמחלקים במספר שלילי.', m('8 \u00F7 (\u22122)') + ' הוא ' + m('\u22124') + '. עכשיו הפוך את הסימן.', 'בדוק את התשובה שלך עם ' + m('x = 0') + ' באי־השוויון המקורי.']
    },
    {
      mode: 'scene', tA: 'בודקים ערכים', sub: 'מצא אילו ערכים מקיימים ' + m('2x \u2212 1 \u2264 5') + ' בגרירה, בכפתורים או בחיצים.',
      tip: 'הזז את נקודת הבדיקה. כל ערך שתבדוק יקבל סימון ירוק או אדום על הציר.',
      aspect: [W, 130], alt: 'ציר מספרים עם נקודת בדיקה נגררת; כל ערך שנבדק מסומן בעיגול ירוק אם הוא מקיים או בריבוע אדום אם לא',
      cue: 'בדוק ערכים משני צדי הקצה, וגם את הקצה עצמו', cueDone: 'ראית את כל הקבוצה. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'tests', text: 'לחץ על פלוס ומינוס, או גרור את הנקודה, וראה איפה הסימון הופך לאדום.' }, setup: checkScene
    },
    {
      mode: 'quiz', tA: 'חמש גדול מ־x', sub: 'איזה אי־שוויון אומר אותו דבר כמו ' + m('5 > x') + '?',
      tip: 'קרא את הכתוב מהצד של ' + m('x') + ': מי גדול ומי קטן.', btn: 'המשך ←',
      win: 'נכון. אם ' + 'חמש גדול מ־x אז x קטן מחמש.', wrongSay: 'התחל מהצד של x: האם הוא גדול מחמש או קטן ממנה?',
      opts: [
        { t: m('x > 5'), f: 'קראת את ' + m('5 > x') + ' משמאל לימין וקבעת ש־' + m('x') + ' גדול. אבל החמש היא הגדולה, ולכן ' + m('x') + ' קטן ממנה.' },
        { t: m('x \u2264 5'), f: 'הכיוון נכון, אבל ' + m('\u2264') + ' כולל את ' + m('5') + '. ב־' + m('5 > x') + ' אין שוויון, ו־' + m('5 > 5') + ' לא נכון.' },
        { t: m('x \u2265 5'), f: 'גם הכיוון הפוך וגם הוספת שוויון. ' + m('5 > 7') + ' לא נכון, ולכן ' + m('x = 7') + ' לא יכול להיות פתרון.' },
        { t: m('x < 5'), c: true, f: 'הסימן פונה אל הצד הקטן. ' + m('5 > x') + ' ו־' + m('x < 5') + ' הם אותו אי־שוויון, כתוב מהצד השני.' }
      ],
      hints: ['נסה ערך: האם ' + m('x = 7') + ' מקיים את ' + m('5 > x') + '?', 'כשהופכים את הצדדים, הופכים גם את כיוון הסימן.', 'כתוב מחדש עם ' + m('x') + ' בצד שמאל.']
    },
    {
      mode: 'quiz', tA: 'כמה פתרונות יש?', sub: 'פתור את ' + m('x + 3 > x + 1') + '.',
      tip: 'חסר ' + m('x') + ' משני האגפים ובדוק מה נשאר.', btn: 'לסיכום ←',
      win: 'נכון. נשאר ' + 'משפט אמת לכל x, ולכן כל מספר הוא פתרון.', wrongSay: 'בדוק מה נשאר אחרי שה־x נעלם, ואם זה משפט אמת.',
      opts: [
        { t: 'אין פתרון', f: 'נשאר ' + m('3 > 1') + ', וזה משפט אמת. אם נשאר משפט שקר, כמו ' + m('1 > 3') + ', אז באמת אין פתרון.' },
        { t: 'כל מספר הוא פתרון', c: true, f: 'אחרי חיסור ' + m('x') + ' נשאר ' + m('3 > 1') + ', משפט אמת בלי קשר ל־' + m('x') + '. לכן כל מספר מקיים.' },
        { t: m('x > 2'), f: 'ה־' + m('x') + ' התקזז בשני האגפים, ולכן אין תנאי עליו. לא נוצר ' + m('x > 2') + '.' },
        { t: m('x > \u22122'), f: 'ה־' + m('x') + ' מתקזז בשני האגפים, ולכן לא נשארת שום הגבלה על ' + m('x') + '.' }
      ],
      hints: ['חסר ' + m('x') + ' משני האגפים.', 'האם ' + m('3 > 1') + ' נכון, ותלוי ב־' + m('x') + '?', 'אם נשאר משפט אמת תמיד, כל מספר מתאים.']
    },
    {
      mode: 'finish', tA: 'סיימת: אי־שוויון על הציר', sub: 'פתרון של אי־שוויון הוא קבוצה של ערכים, ולא מספר אחד.',
      tip: 'כל הכבוד. אתה יודע לפתור, לסמן ולבדוק אי־שוויון.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:', formula: 'מחלקים או כופלים במספר שלילי: ' + m('\u2212 2x < 8') + ' נותן ' + m('x > \u22124') + ' (הסימן מתהפך).'
    }
  ];

  window.NoamGame.boot({
    slug: 'ee-shivyon-batsir', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'עיגול פתוח וסגור', math: 'x ≤ −1' },
      { step: 4, name: 'היפוך הסימן', math: '−2x < 8' },
      { step: 6, name: 'קריאת כיוון האי־שוויון', math: '5 > x' },
      { step: 7, name: 'אין פתרון או כל מספר', math: '3 > 1' }
    ],
    bonus: {
      label: 'מכונת האי־שוויונות', closeLabel: 'סגור את המכונה', hint: 'קבל אי־שוויון חדש, פתור אותו ובחר את הפתרון.',
      setup: function (box, ctx) {
        var q, k = 0, signIdx = 0;
        var SIGNS = ['<', '\u2264', '>', '\u2265'];
        box.innerHTML = '<div class="bTitle">מכונת האי־שוויונות</div><div class="bSub">פתור, בחר את המספר ואת הסימן, ולחץ על בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit"><bdi class="math var" dir="ltr">x</bdi>'
          + '<button type="button" data-sign aria-label="החלף סימן" style="min-width:56px"></button>'
          + '<button type="button" data-d="-1" aria-label="הקטן את המספר">\u2212</button>'
          + '<bdi class="var math" dir="ltr" data-g style="min-width:34px" aria-live="polite">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל את המספר">+</button></div></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">אי־שוויון חדש ↻</button>';
        var chip = box.querySelector('[data-ex]'), gEl = box.querySelector('[data-g]'), sol = box.querySelector('[data-sol]'), ok = box.querySelector('[data-ok]'), sg = box.querySelector('[data-sign]');
        function flipS(s) { return { '<': '>', '>': '<', '\u2264': '\u2265', '\u2265': '\u2264' }[s]; }
        function roll() {
          var as = [-5, -4, -3, -2, 2, 3, 4, 5];
          var a = as[Math.floor(Math.random() * as.length)];
          var x0 = Math.floor(Math.random() * 13) - 6;
          var b = Math.floor(Math.random() * 15) - 7;
          var s = SIGNS[Math.floor(Math.random() * 4)];
          q = { a: a, b: b, s: s, x0: x0, c: a * x0 + b, ans: a > 0 ? s : flipS(s) };
          k = 0; signIdx = 0;
        }
        function draw() {
          chip.textContent = (q.a + 'x ' + (q.b < 0 ? '\u2212 ' + Math.abs(q.b) : '+ ' + q.b) + ' ' + q.s + ' ' + num(q.c)).replace(/^-/, '\u2212');
          gEl.textContent = num(k); sg.textContent = SIGNS[signIdx];
          sol.hidden = true; ok.hidden = true;
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () { k = clamp(k + Number(b.getAttribute('data-d')), -12, 12); ctx.sfx('click'); gEl.textContent = num(k); });
        });
        sg.addEventListener('click', function () { signIdx = (signIdx + 1) % 4; ctx.sfx('click'); sg.textContent = SIGNS[signIdx]; });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var good = k === q.x0 && SIGNS[signIdx] === q.ans;
          ok.hidden = false;
          ok.textContent = good ? 'נכון! הצלחת לפתור ולהחליט אם הסימן מתהפך.' : (SIGNS[signIdx] !== q.ans && k === q.x0 ? 'המספר נכון. בדוק אם חילקת במספר שלילי: אז הסימן מתהפך.' : 'נסה שוב: בודדים את x בשני האגפים, ובמספר שלילי הופכים סימן.');
          ok.style.color = good ? PAL.good : BAD;
          ctx.sfx(good ? 'correct' : 'error');
          if (good) {
            sol.hidden = false; sol.innerHTML = '';
            [q.a + 'x ' + q.s + ' ' + num(q.c - q.b), 'x ' + q.ans + ' ' + num(q.x0)].forEach(function (line, i) {
              var d = document.createElement('div'); d.textContent = (i === 0 ? line.replace(/^-/, '\u2212') : line);
              sol.appendChild(d);
            });
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); draw(); });
        roll(); draw();
      }
    }
  });
}());
