/** * משחק המשוואה הריבועית ונוסחת השורשים — an engine game.
 *
 * The idea: the solutions of ax² + bx + c = 0 are where the parabola meets the
 * x axis, the discriminant Δ = b² − 4ac says how many there are, and the
 * formula says who they are.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var MUTED = '#475569', BAD = '#b91c1c', AMBER = '#b45309';

  function num(n) { return n < 0 ? '\u2212' + (-n) : String(n); }
  function par(n) { return n < 0 ? '(' + num(n) + ')' : String(n); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function bdi(t) { return '<bdi class="math" dir="ltr">' + t + '</bdi>'; }
  function mt(x, y, t, size, fill, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="ltr"'
      + ' font-family="Secular One, sans-serif" font-size="' + (size || 14) + '" fill="' + (fill || PAL.ink)
      + '" text-anchor="' + (anchor || 'middle') + '">' + t + '</text>';
  }
  function ht(x, y, t, size, fill, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 14)
      + '" font-weight="700" fill="' + (fill || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + t + '</text>';
  }
  function perfect(d) { var s = Math.round(Math.sqrt(d)); return s * s === d; }
  function round2(v) { return String(Math.round(v * 100) / 100); }
  function poly(a, b, c) {
    var s = (a === 1 ? '' : String(a)) + 'x\u00B2';
    if (b !== 0) s += (b < 0 ? ' \u2212 ' : ' + ') + (Math.abs(b) === 1 ? '' : String(Math.abs(b))) + 'x';
    if (c !== 0) s += (c < 0 ? ' \u2212 ' : ' + ') + Math.abs(c);
    return s;
  }
  function pill(style) {
    return 'min-height:44px;min-width:44px;border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.soft
      + ';color:' + PAL.dark + ';font-family:Secular One,sans-serif;font-size:18px;cursor:pointer;' + (style || '');
  }
  function stepUnit(key, label, aria, lo, hi, val) {
    return '<div class="unit" dir="ltr"><bdi class="math var" dir="ltr">' + label + '</bdi>'
      + '<button type="button" id="' + key + 'Minus" data-key="' + key + '" data-delta="-1" aria-label="הקטן את ' + aria + '">\u2212</button>'
      + '<bdi class="var math" dir="ltr" data-val="' + key + '" style="min-width:34px" aria-live="polite">' + num(val) + '</bdi>'
      + '<button type="button" id="' + key + 'Plus" data-key="' + key + '" data-delta="1" aria-label="הגדל את ' + aria + '">+</button></div>';
  }
  function keyDelta(event) {
    var k = event.key;
    if (k === 'ArrowRight' || k === 'ArrowUp') return 1;
    if (k === 'ArrowLeft' || k === 'ArrowDown') return -1;
    return 0;
  }

  /* ---------- scene 1: the parabola y = x² − 5x + c ---------- */
  var X0 = 60, UX = 46, Y0 = 20, UY = 22;
  function ax(x) { return X0 + UX * (x + 1); }
  function ay(y) { return Y0 + UY * (9 - y); }
  function curveD(c) {
    var d = '', x, y;
    for (x = -1; x <= 6.001; x += 0.125) {
      y = clamp(x * x - 5 * x + c, -6, 11);
      d += (d ? 'L' : 'M') + ax(x).toFixed(1) + ' ' + ay(y).toFixed(1);
    }
    return d;
  }
  function baseOne() {
    var out = '<defs><clipPath id="clipOne"><rect x="' + ax(-1) + '" y="' + ay(9) + '" width="' + (7 * UX) + '" height="' + (14 * UY) + '"/></clipPath></defs>'
      + '<rect x="' + ax(-1) + '" y="' + ay(9) + '" width="' + (7 * UX) + '" height="' + (14 * UY) + '" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>';
    var i;
    for (i = -1; i <= 6; i++) out += '<line x1="' + ax(i) + '" y1="' + ay(9) + '" x2="' + ax(i) + '" y2="' + ay(-5) + '" stroke="' + PAL.line + '" stroke-width="0.8" opacity=".7"/>';
    for (i = -5; i <= 9; i++) out += '<line x1="' + ax(-1) + '" y1="' + ay(i) + '" x2="' + ax(6) + '" y2="' + ay(i) + '" stroke="' + PAL.line + '" stroke-width="0.8" opacity=".7"/>';
    out += '<line x1="' + ax(-1) + '" y1="' + ay(0) + '" x2="' + ax(6) + '" y2="' + ay(0) + '" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<line x1="' + ax(0) + '" y1="' + ay(9) + '" x2="' + ax(0) + '" y2="' + ay(-5) + '" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (i = -1; i <= 6; i++) if (i !== 0) out += mt(ax(i), ay(0) + 15, num(i), 12, MUTED);
    for (i = -4; i <= 8; i += 2) if (i !== 0) out += mt(ax(0) - 6, ay(i) + 4, num(i), 12, MUTED, 'end');
    out += mt(392, ay(0) + 4, 'x', 15) + mt(ax(0) + 12, ay(9) + 14, 'y', 15);
    return out;
  }

  function meetScene(ctx) {
    var c = 3, done = false;
    ctx.draw(baseOne()
      + '<path id="curve" d="" fill="none" stroke="' + PAL.main + '" stroke-width="3.5" stroke-linecap="round" clip-path="url(#clipOne)"/>'
      + '<circle id="z1" r="7.5" fill="' + PAL.good + '" stroke="#fff" stroke-width="2.5"/>'
      + '<circle id="z2" r="7.5" fill="' + PAL.good + '" stroke="#fff" stroke-width="2.5"/>'
      + '<g id="hC" tabindex="0" role="slider" aria-label="הערך של c: הפרבולה עולה ויורדת. החיצים משנים אותו" aria-valuemin="2" aria-valuemax="8" aria-valuenow="3" style="cursor:grab">'
      + '<circle r="30" fill="transparent"/><circle r="9" fill="' + PAL.warm + '" stroke="#fff" stroke-width="3"/></g>');
    var handle = ctx.el('hC');
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>הערך של c</b><span data-v="c" dir="ltr"></span></div>'
      + '<div><b>הפתרונות</b><span data-v="z" dir="ltr"></span></div>'
      + '<div><b>חיתוכים עם ציר x</b><span data-v="n" dir="ltr"></span></div></div>'
      + '<div class="stepper" dir="ltr" style="margin-top:10px">' + stepUnit('c', 'c', 'c', 2, 8, 3) + '</div>');
    ctx.register('strip', box);
    function setV(k, t) { box.querySelector('[data-v="' + k + '"]').textContent = t; }
    function render() {
      var disc = 25 - 4 * c, s, r1 = 0, r2 = 0, has = disc >= 0;
      ctx.el('curve').setAttribute('d', curveD(c));
      handle.setAttribute('transform', 'translate(' + ax(2.5) + ' ' + ay(c - 6.25) + ')');
      handle.setAttribute('aria-valuenow', String(c));
      handle.setAttribute('aria-valuetext', 'c = ' + c);
      if (has) { s = Math.sqrt(disc); r1 = (5 - s) / 2; r2 = (5 + s) / 2; }
      ctx.el('z1').setAttribute('display', has ? 'inline' : 'none');
      ctx.el('z2').setAttribute('display', has ? 'inline' : 'none');
      if (has) {
        ctx.el('z1').setAttribute('cx', ax(r1)); ctx.el('z1').setAttribute('cy', ay(0));
        ctx.el('z2').setAttribute('cx', ax(r2)); ctx.el('z2').setAttribute('cy', ay(0));
      }
      setV('c', 'c = ' + c);
      if (!has) setV('z', '\u2014');
      else setV('z', (perfect(disc) ? '' : '\u2248 ') + round2(r1) + ', ' + round2(r2));
      setV('n', has ? '2' : '0');
      box.querySelector('[data-val="c"]').textContent = String(c);
      box.querySelector('#cMinus').disabled = c <= 2;
      box.querySelector('#cPlus').disabled = c >= 8;
      ctx.caption(m('y = x\u00B2 \u2212 5x + ' + c));
      if (c === 6) {
        ctx.note('בדיוק: ב־' + m('c = 6') + ' הפרבולה חותכת את ציר ' + m('x') + ' ב־' + m('2') + ' וב־' + m('3') + '. אלה הפתרונות של ' + m('x\u00B2 \u2212 5x + 6 = 0') + '.', 'good');
      } else if (!has) {
        ctx.note('ב־' + m('c = ' + c) + ' העקומה מרחפת מעל הציר ולא נוגעת בו, ולכן למשוואה ' + m('x\u00B2 \u2212 5x + ' + c + ' = 0') + ' אין פתרון ממשי. זו ההתחלה של הדיסקרימיננטה.');
      } else {
        ctx.note('ב־' + m('c = ' + c) + ' יש שני חיתוכים עם ציר ' + m('x') + ', כלומר שני פתרונות. המשימה: מצא את ' + m('c = 6') + ' וקרא את הפתרונות ' + m('2') + ' ו־' + m('3') + '.');
      }
    }
    function check() {
      if (c === 6 && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
    }
    function setC(v) { c = clamp(v, 2, 8); ctx.sfx('tick'); render(); check(); }
    box.querySelectorAll('[data-delta]').forEach(function (b) {
      b.addEventListener('click', function () { setC(c + Number(b.getAttribute('data-delta'))); });
    });
    handle.addEventListener('keydown', function (event) {
      var d = keyDelta(event);
      if (d) { event.preventDefault(); setC(c + d); return; }
      if (event.key === 'Home') { event.preventDefault(); setC(2); }
      if (event.key === 'End') { event.preventDefault(); setC(8); }
    });
    ctx.drag(handle, {
      move: function (x, y) {
        var v = clamp(Math.round((9 - (y - Y0) / UY) + 6.25), 2, 8);
        if (v !== c) { c = v; ctx.sfx('tick'); render(); }
      },
      end: function () { render(); check(); }
    });
    render();
  }

  /* ---------- scene 3: the discriminant ---------- */
  var QX = 201, QU = 24, QY0 = 14, QU2 = 14;
  function qx(x) { return QX + QU * x; }
  function qy(y) { return QY0 + QU2 * (10 - y); }
  var ROWS = [284, 330, 376];
  var KEYS = [
    { id: 'a', lo: 1, hi: 3, col: PAL.main, name: 'a' },
    { id: 'b', lo: -6, hi: 6, col: AMBER, name: 'b' },
    { id: 'c', lo: -6, hi: 6, col: PAL.good, name: 'c' }
  ];
  var TX0 = 90, TX1 = 340;
  function knobX(k, v) { return TX0 + (TX1 - TX0) * (v - k.lo) / (k.hi - k.lo); }
  function parabolaD(a, b, c) {
    var d = '', x, y;
    for (x = -7; x <= 7.001; x += 0.125) {
      y = clamp(a * x * x + b * x + c, -9, 13);
      d += (d ? 'L' : 'M') + qx(x).toFixed(1) + ' ' + qy(y).toFixed(1);
    }
    return d;
  }
  function baseTwo() {
    var out = '<defs><clipPath id="clipTwo"><rect x="' + qx(-7) + '" y="' + qy(10) + '" width="' + (14 * QU) + '" height="' + (16 * QU2) + '"/></clipPath></defs>'
      + '<rect x="' + qx(-7) + '" y="' + qy(10) + '" width="' + (14 * QU) + '" height="' + (16 * QU2) + '" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>';
    var i;
    for (i = -6; i <= 6; i++) if (i !== 0) out += '<line x1="' + qx(i) + '" y1="' + qy(10) + '" x2="' + qx(i) + '" y2="' + qy(-6) + '" stroke="' + PAL.line + '" stroke-width="0.7" opacity=".7"/>';
    for (i = -5; i <= 9; i++) if (i !== 0) out += '<line x1="' + qx(-7) + '" y1="' + qy(i) + '" x2="' + qx(7) + '" y2="' + qy(i) + '" stroke="' + PAL.line + '" stroke-width="0.7" opacity=".7"/>';
    out += '<line x1="' + qx(-7) + '" y1="' + qy(0) + '" x2="' + qx(7) + '" y2="' + qy(0) + '" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<line x1="' + qx(0) + '" y1="' + qy(10) + '" x2="' + qx(0) + '" y2="' + qy(-6) + '" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (i = -6; i <= 6; i += 2) if (i !== 0) out += mt(qx(i), qy(0) + 12, num(i), 10, MUTED);
    for (i = -4; i <= 8; i += 4) if (i !== 0) out += mt(qx(0) - 4, qy(i) + 3.5, num(i), 10, MUTED, 'end');
    return out;
  }

  function discScene(ctx) {
    var vals = { a: 1, b: -2, c: -3 }, done = false, which = 0, i;
    var tracks = '<g id="knobs">';
    KEYS.forEach(function (k, r) {
      tracks += mt(34, ROWS[r] + 7, k.name, 22, k.col)
        + '<line x1="' + TX0 + '" y1="' + ROWS[r] + '" x2="' + TX1 + '" y2="' + ROWS[r] + '" stroke="' + PAL.line + '" stroke-width="5" stroke-linecap="round"/>';
      for (i = k.lo; i <= k.hi; i++) tracks += '<circle cx="' + knobX(k, i) + '" cy="' + ROWS[r] + '" r="2.6" fill="' + PAL.dark + '"/>';
      tracks += mt(374, ROWS[r] + 7, '0', 20, k.col, 'middle', 'val' + k.id)
        + '<g id="h' + k.id.toUpperCase() + '" tabindex="0" role="slider" aria-label="הערך של ' + k.name + '. החיצים משנים אותו" aria-valuemin="' + k.lo
        + '" aria-valuemax="' + k.hi + '" aria-valuenow="0" style="cursor:grab"><circle r="30" fill="transparent"/>'
        + '<circle r="11" fill="' + k.col + '" stroke="#fff" stroke-width="3"/></g>';
    });
    tracks += '</g>';
    ctx.draw(baseTwo()
      + '<path id="curve2" d="" fill="none" stroke="' + PAL.main + '" stroke-width="3.5" stroke-linecap="round" clip-path="url(#clipTwo)"/>'
      + '<circle id="r1" r="7" fill="' + PAL.good + '" stroke="#fff" stroke-width="2.5"/><circle id="r2" r="7" fill="' + PAL.good + '" stroke="#fff" stroke-width="2.5"/>'
      + tracks);
    var box = ctx.extra('<div class="stepper" dir="ltr">' + KEYS.map(function (k) { return stepUnit(k.id, k.name, k.name, k.lo, k.hi, vals[k.id]); }).join('') + '</div>'
      + '<div class="sceneStrip" style="margin-top:10px;gap:6px;padding:12px 8px">'
      + '<b>הדיסקרימיננטה נבנית כך</b>'
      + '<div><span dir="ltr">' + 'Δ = b\u00B2 \u2212 4ac' + '</span></div>'
      + '<div><span dir="ltr" data-l="2"></span></div>'
      + '<div><span dir="ltr" data-l="3"></span></div>'
      + '<div data-verdict role="status" style="justify-self:center;padding:8px 18px;border-radius:999px;font-weight:800;font-size:15px;border:2px solid"></div></div>');
    ctx.register('strip', box);
    function handleOf(k) { return ctx.el('h' + k.id.toUpperCase()); }
    function render() {
      var a = vals.a, b = vals.b, c = vals.c;
      var disc = b * b - 4 * a * c, four = 4 * a * c, v = box.querySelector('[data-verdict]');
      ctx.el('curve2').setAttribute('d', parabolaD(a, b, c));
      KEYS.forEach(function (k, r) {
        var h = handleOf(k);
        h.setAttribute('transform', 'translate(' + knobX(k, vals[k.id]) + ' ' + ROWS[r] + ')');
        h.setAttribute('aria-valuenow', String(vals[k.id]));
        ctx.el('val' + k.id).textContent = num(vals[k.id]);
        box.querySelector('[data-val="' + k.id + '"]').textContent = num(vals[k.id]);
        box.querySelector('#' + k.id + 'Minus').disabled = vals[k.id] <= k.lo;
        box.querySelector('#' + k.id + 'Plus').disabled = vals[k.id] >= k.hi;
      });
      var r1 = 0, r2 = 0;
      if (disc >= 0) { r1 = (-b - Math.sqrt(disc)) / (2 * a); r2 = (-b + Math.sqrt(disc)) / (2 * a); }
      [['r1', r1], ['r2', r2]].forEach(function (p, idx) {
        var el = ctx.el(p[0]);
        var show = disc >= 0 && Math.abs(p[1]) <= 7 && !(disc === 0 && idx === 1);
        el.setAttribute('display', show ? 'inline' : 'none');
        if (show) { el.setAttribute('cx', qx(p[1])); el.setAttribute('cy', qy(0)); }
      });
      box.querySelector('[data-l="2"]').textContent = 'Δ = ' + par(b) + '\u00B2 \u2212 4 \u00B7 ' + a + ' \u00B7 ' + par(c);
      box.querySelector('[data-l="3"]').textContent = 'Δ = ' + (b * b) + ' \u2212 ' + par(four) + ' = ' + num(disc);
      if (disc > 0) { v.textContent = 'שני פתרונות'; v.style.background = PAL.goodSoft; v.style.color = PAL.good; v.style.borderColor = PAL.good; }
      else if (disc === 0) { v.textContent = 'פתרון אחד'; v.style.background = PAL.warmSoft; v.style.color = AMBER; v.style.borderColor = AMBER; }
      else { v.textContent = 'אין פתרון ממשי'; v.style.background = '#fde8ec'; v.style.color = BAD; v.style.borderColor = BAD; }
      ctx.caption(m('y = ' + poly(a, b, c)));
      if (disc === 0) {
        ctx.note(m('Δ = 0') + ': הפרבולה רק נוגעת בציר ' + m('x') + ' בנקודה אחת, ולכן יש פתרון אחד: ' + m('x = ' + (perfect(disc) ? round2(-b / (2 * a)) : '')) + '.', 'good');
      } else if (disc < 0) {
        ctx.note(m('Δ = ' + num(disc)) + ' שלילית. אם ציפית לשני פתרונות: הפרבולה כולה מעל הציר ולא מגיעה אליו, ולכן אין פתרון ממשי.');
      } else {
        ctx.note(m('Δ = ' + disc) + ' חיובית: הפרבולה חותכת את הציר בשתי נקודות, כלומר שני פתרונות. המשימה: בנה מצב עם ' + m('Δ = 0') + (b < 0 ? '. שים לב: ' + m(par(b) + '\u00B2 = ' + (b * b)) + ', בלי מינוס.' : '.'));
      }
      return disc;
    }
    function check() {
      if (!done && vals.b * vals.b - 4 * vals.a * vals.c === 0) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
    }
    function change(k, v) { vals[k.id] = clamp(v, k.lo, k.hi); ctx.sfx('tick'); render(); check(); }
    box.querySelectorAll('[data-delta]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = KEYS.filter(function (q) { return q.id === btn.getAttribute('data-key'); })[0];
        change(k, vals[k.id] + Number(btn.getAttribute('data-delta')));
      });
    });
    KEYS.forEach(function (k) {
      handleOf(k).addEventListener('keydown', function (event) {
        var d = keyDelta(event);
        if (d) { event.preventDefault(); change(k, vals[k.id] + d); return; }
        if (event.key === 'Home') { event.preventDefault(); change(k, k.lo); }
        if (event.key === 'End') { event.preventDefault(); change(k, k.hi); }
      });
    });
    ctx.drag(ctx.el('knobs'), {
      start: function (x, y) {
        var best = 0;
        ROWS.forEach(function (ry, r) { if (Math.abs(y - ry) < Math.abs(y - ROWS[best])) best = r; });
        which = best;
      },
      move: function (x) {
        var k = KEYS[which];
        var v = clamp(Math.round(k.lo + (x - TX0) / (TX1 - TX0) * (k.hi - k.lo)), k.lo, k.hi);
        if (v !== vals[k.id]) { vals[k.id] = v; ctx.sfx('tick'); render(); }
      },
      end: function () { render(); check(); }
    });
    render();
  }

  /* ---------- scene 5: filling the formula ---------- */
  var SLOT_LABEL = ['\u2212b', '\u221AΔ', '2a'];
  var SLOT_ASK = ['הערך של ', 'הערך של ', 'הערך של '];
  var CHOICES = [[-7, 7, 3], [25, 5, 7], [4, 6, 2]];
  var ANSWERS = [7, 5, 4];
  var WRONG_NOTE = [
    { '-7': 'ב־' + m('b = \u22127') + ' המספר כבר שלילי, לכן ' + m('\u2212b') + ' הוא ' + m('7') + '. מינוס של מינוס שבע הוא שבע.',
      '3': m('3') + ' הוא ' + m('c') + '. בנוסחה צריך את ' + m('\u2212b') + ', כלומר ההופכי של ' + m('b = \u22127') + '.' },
    { '25': m('25') + ' הוא ' + m('Δ') + ' עצמה. בנוסחה כתוב ' + m('\u221AΔ') + ', והשורש של ' + m('25') + ' הוא ' + m('5') + '.',
      '7': m('\u221A49 = 7') + ', אבל ' + m('Δ') + ' היא ' + m('49 \u2212 24 = 25') + '. שכחת לחסר את ' + m('4ac') + '.' },
    { '2': m('2') + ' הוא ' + m('a') + ' בלבד. במכנה כתוב ' + m('2a') + ', כלומר ' + m('2 \u00B7 2 = 4') + '.',
      '6': m('6') + ' הוא ' + m('2c') + '. במכנה בא ' + m('2a') + ', ו־' + m('a = 2') + ', לכן ' + m('4') + '.' }
  ];
  function frac(cx, cy, top, bottom, w, size, fill) {
    return '<line x1="' + (cx - w / 2) + '" y1="' + cy + '" x2="' + (cx + w / 2) + '" y2="' + cy + '" stroke="' + PAL.ink + '" stroke-width="2.2" stroke-linecap="round"/>'
      + mt(cx, cy - 6, top, size, fill || PAL.ink) + mt(cx, cy + size + 3, bottom, size, fill || PAL.ink);
  }
  function slotBox(x, y, val, filled) {
    return '<rect x="' + x + '" y="' + y + '" width="50" height="34" rx="8" fill="' + (filled ? PAL.goodSoft : '#fff') + '" stroke="' + (filled ? PAL.good : PAL.main) + '" stroke-width="2.2"'
      + (filled ? '' : ' stroke-dasharray="5 4"') + '/>'
      + mt(x + 25, y + 24, filled ? num(val) : '?', 20, filled ? PAL.good : MUTED);
  }

  function formulaScene(ctx) {
    var filled = [false, false, false], shown = false, done = false;
    function drawAll() {
      var out = mt(201, 30, '2x\u00B2 \u2212 7x + 3 = 0', 21)
        + mt(100, 56, 'a = 2', 15, MUTED) + mt(201, 56, 'b = \u22127', 15, MUTED) + mt(302, 56, 'c = 3', 15, MUTED)
        + mt(201, 80, 'Δ = (\u22127)\u00B2 \u2212 4 \u00B7 2 \u00B7 3 = 25', 15, PAL.dark)
        + mt(84, 172, 'x =', 22)
        + '<line x1="118" y1="164" x2="290" y2="164" stroke="' + PAL.ink + '" stroke-width="2.6" stroke-linecap="round"/>'
        + slotBox(126, 118, 7, filled[0])
        + mt(190, 143, '\u00B1', 22)
        + '<path d="M205 134 L210 130 L217 152 L225 112 H284" fill="none" stroke="' + PAL.ink + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        + slotBox(230, 118, 5, filled[1])
        + slotBox(179, 176, 4, filled[2]);
      if (shown) {
        out += mt(40, 266, 'x =', 20) + frac(108, 262, '7 + 5', '4', 64, 18) + mt(160, 266, '=', 20) + frac(196, 262, '12', '4', 34, 18)
          + mt(238, 266, '=', 20) + mt(262, 268, '3', 26, PAL.good) + ht(352, 266, 'פתרון א׳', 13, MUTED)
          + mt(40, 326, 'x =', 20) + frac(108, 322, '7 \u2212 5', '4', 64, 18) + mt(160, 326, '=', 20) + frac(196, 322, '2', '4', 34, 18)
          + mt(238, 326, '=', 20) + frac(272, 322, '1', '2', 34, 18, PAL.good) + ht(352, 326, 'פתרון ב׳', 13, MUTED);
      } else {
        out += ht(201, 300, 'הפתרונות יופיעו כאן אחרי החישוב', 14, MUTED);
      }
      ctx.draw(out);
    }
    var rows = '';
    CHOICES.forEach(function (list, s) {
      rows += '<div data-row="' + s + '" style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">'
        + '<span style="font-weight:700;font-size:14.5px">' + SLOT_ASK[s] + bdi(SLOT_LABEL[s]) + '?</span>'
        + '<span dir="ltr" style="display:flex;gap:8px">'
        + list.map(function (v, k) {
          return '<button type="button" id="s' + s + 'c' + k + '" data-slot="' + s + '" data-val="' + v + '" style="' + pill('min-width:56px') + '">' + num(v) + '</button>';
        }).join('') + '</span></div>';
    });
    var box = ctx.extra(rows);
    ctx.register('slots', box);
    function pick(btn) {
      var s = Number(btn.getAttribute('data-slot')), v = Number(btn.getAttribute('data-val'));
      if (filled[s]) return;
      if (v === ANSWERS[s]) {
        filled[s] = true; ctx.sfx('correct');
        btn.style.background = PAL.goodSoft; btn.style.borderColor = PAL.good; btn.style.color = PAL.good;
        box.querySelectorAll('[data-slot="' + s + '"]').forEach(function (o) { o.disabled = true; });
        drawAll();
        var left = filled.filter(function (f) { return !f; }).length;
        ctx.note(left ? 'נכון. ' + (left === 1 ? 'נשארה משבצת אחת.' : 'נשארו ' + left + ' משבצות.') : 'כל המשבצות מלאות. לחץ על חישוב הפתרונות.', left ? '' : 'good');
      } else {
        ctx.sfx('error');
        btn.style.background = '#fde8ec'; btn.style.borderColor = BAD; btn.style.color = BAD;
        ctx.note(WRONG_NOTE[s][String(v)]);
      }
    }
    box.querySelectorAll('[data-slot]').forEach(function (b) { b.addEventListener('click', function () { pick(b); }); });
    ctx.button('חשב את שני הפתרונות', function () {
      if (!(filled[0] && filled[1] && filled[2])) {
        ctx.sfx('error');
        ctx.note('קודם ממלאים את שלוש המשבצות: ' + m('\u2212b') + ', ' + m('\u221AΔ') + ' ו־' + m('2a') + '.');
        return;
      }
      shown = true; drawAll(); ctx.sfx('correct');
      ctx.note('שני הפתרונות הם ' + m('x = 3') + ' ו־' + m('x') + ' שווה חצי, כמו בציור עם קו השבר. את הפלוס מחשבים ' + m('7 + 5') + ', ואת המינוס ' + m('7 \u2212 5') + ', ושניהם מחולקים ב־' + m('4') + '.', 'good');
      if (!done) { done = true; ctx.burst(14); ctx.solved(); }
    }, { id: 'calc', target: 'calc' });
    drawAll();
    ctx.note('מלא את שלוש המשבצות לפי ' + m('a = 2') + ', ' + m('b = \u22127') + ' ו־' + m('Δ = 25') + '. אחר כך חשב את שני הפתרונות.');
  }

  /* ---------- picture for the rectangle question ---------- */
  function rectPicture(ctx) {
    ctx.draw('<rect x="100" y="16" width="200" height="110" rx="4" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="3"/>'
      + mt(200, 152, 'x + 2', 18, PAL.dark) + mt(84, 76, 'x', 18, PAL.dark, 'end')
      + ht(268, 78, 'שטח', 16, PAL.ink) + mt(214, 78, '24', 20, PAL.ink) + ht(160, 78, 'סמ״ר', 16, PAL.ink));
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'המשוואה הריבועית ונוסחת השורשים',
      sub: 'איפה הפרבולה פוגשת את הציר, וכמה פתרונות יש למשוואה.',
      tip: 'שלום, אני אליהו. נחפש פתרונות של משוואה ריבועית: קודם נראה אותם על הפרבולה, אחר כך נחשב אותם.',
      emoji: '🔎',
      eq: m('x\u00B2 \u2212 5x + 6 = 0'),
      note: 'הפתרונות הם המקומות שבהם הפרבולה חותכת את ציר ' + m('x') + '. הדיסקרימיננטה ' + m('Δ = b\u00B2 \u2212 4ac') + ' אומר כמה פתרונות יש, והנוסחה אומרת מי הם.',
      cue: 'מוכן לחפש פתרונות?',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'איפה הפרבולה חותכת',
      sub: 'שנה את ' + m('c') + ' בגרירה, בכפתורים או בחיצים. מצא את ' + m('c = 6') + ' וקרא את הפתרונות.',
      tip: 'הפרבולה ' + m('y = x\u00B2 \u2212 5x + c') + ' עולה ויורדת כש־' + m('c') + ' משתנה. הפתרונות הם המקומות שבהם היא חותכת את ציר ' + m('x') + '.',
      cue: 'קבע c = 6 וקרא את שני הפתרונות',
      cueDone: 'מצאת: הפתרונות הם 2 ו־3. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 350],
      alt: 'מערכת צירים עם פרבולה שפותחת כלפי מעלה. הנקודה הכתומה על הקודקוד מזיזה את הפרבולה למעלה ולמטה, והנקודות הירוקות מסמנות איפה היא חותכת את ציר x',
      nudge: { target: 'strip', text: 'לחץ על הפלוס והמינוס של ' + m('c') + ' ותראה איך הפרבולה עולה ויורדת.' },
      setup: meetScene
    },
    {
      mode: 'quiz',
      tA: 'מהם הפתרונות של',
      tM: 'x\u00B2 \u2212 5x + 6 = 0',
      tB: '?',
      sub: 'בסצנה ראית איפה הפרבולה חותכת את הציר כש־' + m('c = 6') + '.',
      tip: 'חפש שני מספרים שהמכפלה שלהם ' + m('6') + ' והסכום שלהם ' + m('5') + '. או הצב ותבדוק.',
      btn: 'המשך ←',
      win: 'נכון. שני החיתוכים עם הציר הם ' + m('x = 2') + ' ו־' + m('x = 3') + '.',
      wrongSay: 'הצב כל מספר במשוואה ובדוק אם יוצא אפס.',
      opts: [
        { t: m('2') + ' ו־' + m('3'), c: true, f: m('2 + 3 = 5') + ' ו־' + m('2 \u00B7 3 = 6') + '. אפשר לפרק: ' + m('(x \u2212 2)(x \u2212 3) = 0') + '.' },
        { t: m('\u22122') + ' ו־' + m('\u22123'), f: 'הפכת את הסימנים. הצבה של ' + m('x = \u22122') + ' נותנת ' + m('4 + 10 + 6 = 20') + ', לא אפס.' },
        { t: m('1') + ' ו־' + m('6'), f: 'המכפלה ' + m('1 \u00B7 6 = 6') + ' מתאימה, אבל הסכום ' + m('7') + ' צריך להיות ' + m('5') + '. הצבה של ' + m('x = 1') + ' נותנת ' + m('\u22126') + '.' },
        { t: m('5') + ' ו־' + m('6'), f: 'לקחת את המספרים שמופיעים במשוואה. הצבה של ' + m('x = 5') + ' נותנת ' + m('25 \u2212 25 + 6 = 6') + ', לא אפס.' }
      ],
      hints: [
        'פתרון הוא מספר שמציבים ב־' + m('x') + ' ומקבלים אפס.',
        'חפש שני מספרים שהמכפלה שלהם ' + m('6') + ' והסכום שלהם ' + m('5') + '.',
        'הזוג ' + m('2') + ' ו־' + m('3') + ' מתאים. בדוק בהצבה.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מחשבים דיסקרימיננטה',
      sub: 'שנה את ' + m('a') + ', ' + m('b') + ' ו־' + m('c') + ' בגרירה, בכפתורים או בחיצים. בנה מצב עם ' + m('Δ = 0') + '.',
      tip: 'הדיסקרימיננטה ' + m('Δ = b\u00B2 \u2212 4ac') + ' אומרת כמה פתרונות יש, עוד לפני שמחשבים אותם. נסה לגרום לפרבולה רק לגעת בציר.',
      cue: 'בנה מצב שבו Δ = 0',
      cueDone: 'הפרבולה נוגעת בציר בנקודה אחת. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 410],
      alt: 'פרבולה שפותחת כלפי מעלה, ומתחתיה שלושה סרגלים עם ידיות לערכים a, b ו־c. נקודות ירוקות מסמנות איפה הפרבולה חותכת את ציר x',
      nudge: { target: 'strip', text: 'לחץ על הפלוס או המינוס של ' + m('c') + ' וראה מה קורה ל־' + m('Δ') + '.' },
      setup: discScene
    },
    {
      mode: 'quiz',
      tA: 'מהי הדיסקרימיננטה של',
      tM: '2x\u00B2 + 3x + 5 = 0',
      tB: ' וכמה פתרונות יש?',
      sub: 'כאן ' + m('a = 2') + ', ' + m('b = 3') + ' ו־' + m('c = 5') + '.',
      tip: 'הצב בנוסחה ' + m('Δ = b\u00B2 \u2212 4ac') + ', ושים לב לסימן שבאמצע.',
      btn: 'המשך ←',
      win: 'נכון. דיסקרימיננטה שלילית פירושה שאין פתרון ממשי.',
      wrongSay: 'חשב שוב: קודם ' + m('b\u00B2') + ', ואז חסר ממנו את ' + m('4ac') + '.',
      opts: [
        { t: m('Δ = \u221231') + ', אין פתרון ממשי', c: true, f: m('Δ = 9 \u2212 4 \u00B7 2 \u00B7 5 = 9 \u2212 40 = \u221231') + '. Δ שלילית, לכן הפרבולה לא מגיעה לציר.' },
        { t: m('Δ = 31') + ', שני פתרונות', f: 'איבדת את הסימן: ' + m('9 \u2212 40') + ' הוא ' + m('\u221231') + ', לא ' + m('31') + '.' },
        { t: m('Δ = 49') + ', שני פתרונות', f: 'חיברת ' + m('9 + 40') + '. הנוסחה היא ' + m('b\u00B2 \u2212 4ac') + ', עם חיסור.' },
        { t: m('Δ = 0') + ', פתרון אחד', f: m('Δ = 0') + ' מתקבלת רק כש־' + m('b\u00B2') + ' שווה ל־' + m('4ac') + '. כאן ' + m('9') + ' ו־' + m('40') + ' רחוקים זה מזה.' }
      ],
      hints: [
        'זהה את ' + m('a') + ', ' + m('b') + ' ו־' + m('c') + ' במשוואה.',
        'חשב ' + m('b\u00B2 = 9') + ' ואת ' + m('4ac = 4 \u00B7 2 \u00B7 5') + ', ואז חסר.',
        m('9 \u2212 40') + ' קטן מאפס. מה זה אומר על מספר הפתרונות?'
      ]
    },
    {
      mode: 'scene',
      tA: 'מציבים בנוסחה',
      sub: 'פתור את ' + m('2x\u00B2 \u2212 7x + 3 = 0') + ': מלא את שלוש המשבצות ואז חשב את שני הפתרונות.',
      tip: 'נוסחת השורשים היא ' + m('\u2212b \u00B1 \u221AΔ') + ' חלקי ' + m('2a') + '. כאן ' + m('a = 2') + ', ' + m('b = \u22127') + ' ו־' + m('Δ = 25') + '.',
      cue: 'מלא את המשבצות ולחץ על חישוב הפתרונות',
      cueDone: 'חישבת את שני הפתרונות. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 360],
      alt: 'נוסחת השורשים עם קו שבר: למעלה מינוס b פלוס מינוס שורש דלתא, ולמטה שתיים a. שלוש משבצות ריקות למילוי',
      nudge: { target: 'slots', text: 'בחר בכל שורה את הערך הנכון. בכל משבצת יש רק תשובה אחת.' },
      setup: formulaScene
    },
    {
      mode: 'quiz',
      tA: 'מהם הפתרונות של',
      tM: 'x\u00B2 \u2212 x \u2212 6 = 0',
      tB: '?',
      sub: 'אפשר להשתמש בנוסחה, ואפשר לפרק לגורמים אם המספרים ידידותיים.',
      tip: 'חפש שני מספרים שהמכפלה שלהם ' + m('\u22126') + ' והסכום שלהם ' + m('1') + '. כאן ' + m('b = \u22121') + '.',
      btn: 'המשך ←',
      win: 'נכון. ' + m('(x \u2212 3)(x + 2) = 0') + ' נותן ' + m('x = 3') + ' או ' + m('x = \u22122') + '.',
      wrongSay: 'בדוק גם את המכפלה וגם את הסכום של שני המספרים.',
      opts: [
        { t: m('3') + ' ו־' + m('\u22122'), c: true, f: m('3 \u00B7 (\u22122) = \u22126') + ' ו־' + m('3 + (\u22122) = 1') + '. בנוסחה: ' + m('Δ = 1 + 24 = 25') + ', ו־' + m('x = (1 \u00B1 5) \u00F7 2') + '.' },
        { t: m('\u22123') + ' ו־' + m('2'), f: 'הפכת את הסימנים. הצבה של ' + m('x = \u22123') + ' נותנת ' + m('9 + 3 \u2212 6 = 6') + ', לא אפס. הסכום חייב להיות ' + m('1') + ', לא ' + m('\u22121') + '.' },
        { t: m('6') + ' ו־' + m('\u22121'), f: 'המכפלה ' + m('6 \u00B7 (\u22121) = \u22126') + ' נכונה, אבל הסכום ' + m('5') + ' אינו ' + m('1') + '. הצבה של ' + m('x = 6') + ' נותנת ' + m('24') + '.' },
        { t: m('1') + ' ו־' + m('6'), f: 'המכפלה ' + m('1 \u00B7 6 = 6') + ' חיובית, אבל צריך ' + m('\u22126') + '. הצבה של ' + m('x = 1') + ' נותנת ' + m('\u22126') + ', לא אפס.' }
      ],
      hints: [
        'הצב ' + m('a = 1') + ', ' + m('b = \u22121') + ' ו־' + m('c = \u22126') + ' בנוסחה, או חפש שני מספרים לפי מכפלה וסכום.',
        'מכפלה ' + m('\u22126') + ' פירושה שהסימנים שונים. הסכום ' + m('1') + ' אומר שהגדול מביניהם חיובי.',
        'נסה ' + m('3') + ' ו־' + m('\u22122') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'בעיית המלבן',
      sub: 'שטח מלבן הוא ' + m('24') + ' סמ״ר, וצלע אחת גדולה ב־' + m('2') + ' ס״מ מהשנייה. מהן הצלעות?',
      tip: 'קרא את הצלע הקצרה ' + m('x') + '. אז הצלע השנייה היא ' + m('x + 2') + ', והשטח הוא ' + m('x(x + 2) = 24') + '.',
      btn: 'לסיכום ←',
      aspect: [402, 170],
      alt: 'מלבן שצלעו האנכית x וצלעו האופקית x ועוד שתיים, ושטחו עשרים וארבעה סנטימטרים רבועים',
      setup: rectPicture,
      win: 'נכון. ' + m('x\u00B2 + 2x \u2212 24 = 0') + ' נותנת ' + m('x = 4') + ', והצלעות הן ' + m('4') + ' ו־' + m('6') + '.',
      wrongSay: 'בדוק שהמכפלה היא ' + m('24') + ' וגם שההפרש בין הצלעות הוא ' + m('2') + '.',
      opts: [
        { t: m('4') + ' ו־' + m('6'), c: true, f: m('x(x + 2) = 24') + ' נותנת ' + m('x\u00B2 + 2x \u2212 24 = 0') + ', ו־' + m('Δ = 4 + 96 = 100') + '. ' + m('x = 4') + ' (הפתרון ' + m('\u22126') + ' לא מתאים לאורך), והצלעות ' + m('4 \u00B7 6 = 24') + '.' },
        { t: m('2') + ' ו־' + m('12'), f: 'המכפלה ' + m('2 \u00B7 12 = 24') + ' נכונה, אבל ההפרש הוא ' + m('10') + ' ולא ' + m('2') + '. במשוואה ' + m('x\u00B2 + 2x \u2212 24 = 0') + ' הצבה של ' + m('x = 2') + ' נותנת ' + m('\u221216') + '.' },
        { t: m('3') + ' ו־' + m('8'), f: 'המכפלה ' + m('3 \u00B7 8 = 24') + ' נכונה, אבל ההפרש הוא ' + m('5') + '. צריך הפרש ' + m('2') + '.' },
        { t: m('4') + ' ו־' + m('8'), f: 'ההפרש ' + m('4') + ' אינו ' + m('2') + ', ולא בדקת את השטח: ' + m('4 \u00B7 8 = 32') + ' ולא ' + m('24') + '.' }
      ],
      hints: [
        'סמן צלע אחת ב־' + m('x') + ' וכתוב את הצלע השנייה בעזרתה.',
        'שטח הוא מכפלה: ' + m('x(x + 2) = 24') + '. פתח סוגריים והעבר אגף.',
        'המשוואה ' + m('x\u00B2 + 2x \u2212 24 = 0') + ' מתפרקת ל־' + m('(x \u2212 4)(x + 6) = 0') + '. אורך הצלע חיובי.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את המשוואה הריבועית',
      sub: 'שתי שאלות על כל משוואה ריבועית: כמה פתרונות יש, ומי הם.',
      tip: 'כל הכבוד. עכשיו אתה יודע לבדוק את הדיסקרימיננטה לפני שמחשבים.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:',
      formula: m('Δ = b\u00B2 \u2212 4ac') + ' אומרת כמה; ' + m('\u2212b \u00B1 \u221AΔ') + ' חלקי ' + m('2a') + ' אומר מי.'
    }
  ];

  window.NoamGame.boot({
    slug: 'nuschat-hashorashim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'פתרונות משוואה ריבועית', math: 'x² − 5x + 6 = 0' },
      { step: 4, name: 'חישוב דיסקרימיננטה', math: 'Δ = b² − 4ac' },
      { step: 6, name: 'פירוק או נוסחה', math: 'x² − x − 6 = 0' },
      { step: 7, name: 'בעיית מלבן', math: 'x² + 2x − 24 = 0' }
    ],
    bonus: {
      label: 'מכונת המשוואות 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל משוואה ריבועית אקראית, חשב את הדיסקרימיננטה ואז מצא את שני הפתרונות.',
      setup: function (box, ctx) {
        var p, q, B, C, D, guess, phase, picked, cands;
        function roll() {
          do {
            p = Math.floor(Math.random() * 11) - 5;
            q = Math.floor(Math.random() * 11) - 5;
            if (p > q) { var t = p; p = q; q = t; }
          } while (q - p < 1 || q - p > 6);
          B = -(p + q); C = p * q; D = (q - p) * (q - p);
          var extra = window.NoamGame.shuffle([-p, -q, p + 1, q + 1, p - 1, q - 1, 0, 1, -1, 2, -2, 3, -3]);
          cands = [p, q];
          extra.forEach(function (v) { if (cands.length < 6 && cands.indexOf(v) < 0) cands.push(v); });
          cands = window.NoamGame.shuffle(cands);
        }
        function factor(r) { return r === 0 ? 'x' : (r > 0 ? '(x \u2212 ' + r + ')' : '(x + ' + (-r) + ')'); }
        function eqText() {
          var s = 'x\u00B2';
          if (B !== 0) s += (B < 0 ? ' \u2212 ' : ' + ') + (Math.abs(B) === 1 ? '' : Math.abs(B)) + 'x';
          if (C !== 0) s += (C < 0 ? ' \u2212 ' : ' + ') + Math.abs(C);
          return s + ' = 0';
        }
        box.innerHTML = '<div class="bTitle">מכונת המשוואות</div>'
          + '<div class="bSub" data-sub></div>'
          + '<div class="bChip" data-eq dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr"><bdi class="math var" dir="ltr">Δ</bdi>'
          + '<button type="button" data-d="-10" aria-label="הקטן את Δ ב־10" style="width:52px">\u221210</button>'
          + '<button type="button" data-d="-1" aria-label="הקטן את Δ ב־1">\u2212</button>'
          + '<bdi class="var math" dir="ltr" data-g style="min-width:40px" aria-live="polite">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל את Δ ב־1">+</button>'
          + '<button type="button" data-d="10" aria-label="הגדל את Δ ב־10" style="width:52px">+10</button></div></div>'
          + '<div class="bForms" data-roots hidden></div>'
          + '<div class="bForms" data-forms dir="ltr" hidden></div>'
          + '<div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק את Δ</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">משוואה חדשה ↻</button>';
        var sub = box.querySelector('[data-sub]'), eq = box.querySelector('[data-eq]'), g = box.querySelector('[data-g]');
        var roots = box.querySelector('[data-roots]'), forms = box.querySelector('[data-forms]'), ok = box.querySelector('[data-ok]');
        var checkBtn = box.querySelector('[data-check]'), stepper = box.querySelector('.stepper');
        function say(text, good) { ok.hidden = false; ok.innerHTML = text; ok.style.color = good ? PAL.good : BAD; }
        function drawPhase() {
          g.textContent = String(guess);
          if (phase === 1) {
            sub.innerHTML = 'שלב א: חשב ' + bdi('Δ = b\u00B2 \u2212 4ac') + ' ובחר אותה בכפתורים.';
          } else {
            sub.innerHTML = 'שלב ב: בחר את שני הפתרונות של המשוואה.';
          }
        }
        function drawRoots() {
          roots.hidden = false;
          roots.innerHTML = '<div dir="ltr" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
            + cands.map(function (v) {
              return '<button type="button" data-r="' + v + '" aria-pressed="false" style="' + pill('min-width:56px') + '">' + num(v) + '</button>';
            }).join('') + '</div>';
          roots.querySelectorAll('[data-r]').forEach(function (b) {
            b.addEventListener('click', function () {
              var v = Number(b.getAttribute('data-r')), at = picked.indexOf(v);
              if (at >= 0) picked.splice(at, 1); else picked.push(v);
              var on = picked.indexOf(v) >= 0;
              b.setAttribute('aria-pressed', String(on));
              b.style.background = on ? PAL.main : PAL.soft;
              b.style.color = on ? '#fff' : PAL.dark;
              ctx.sfx('click');
            });
          });
        }
        function reset() {
          roll(); guess = 0; phase = 1; picked = [];
          eq.textContent = eqText();
          roots.hidden = true; roots.innerHTML = ''; forms.hidden = true; ok.hidden = true; stepper.hidden = false;
          checkBtn.textContent = 'בדוק את Δ';
          drawPhase();
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (phase !== 1) return;
            guess = clamp(guess + Number(b.getAttribute('data-d')), -40, 99);
            ctx.sfx('click'); g.textContent = String(guess);
          });
        });
        checkBtn.addEventListener('click', function () {
          if (phase === 1) {
            if (guess === D) {
              phase = 2; ctx.sfx('correct');
              stepper.hidden = true;
              say('נכון! ' + bdi('Δ = ' + par(B) + '\u00B2 \u2212 4 \u00B7 ' + par(C) + ' = ' + D), true);
              forms.hidden = false;
              forms.innerHTML = '<div>' + 'x = (' + num(-B) + ' \u00B1 \u221A' + D + ') \u00F7 2' + '</div>';
              drawRoots(); checkBtn.textContent = 'בדוק את הפתרונות'; drawPhase();
            } else {
              ctx.sfx('error');
              if (guess === B * B + 4 * C) say('חיברת את ' + bdi('4ac') + ' במקום לחסר אותו. חשב שוב.', false);
              else if (guess === -D) say('בדוק את הסימן: ' + bdi('b\u00B2') + ' אינו שלילי, ו־' + bdi('4ac') + ' נחסר. חשב שוב.', false);
              else say('חשב שוב: ' + bdi('b\u00B2') + ' פחות ' + bdi('4ac') + ', כש־' + bdi('a = 1') + '.', false);
            }
          } else {
            if (picked.length !== 2) { ctx.sfx('error'); say('בחר בדיוק שני פתרונות.', false); return; }
            var good = picked.indexOf(p) >= 0 && picked.indexOf(q) >= 0;
            if (good) {
              ctx.sfx('correct');
              say('נכון! שני הפתרונות הם ' + bdi(num(p)) + ' ו־' + bdi(num(q)) + '.', true);
              forms.hidden = false;
              forms.innerHTML = '<div>' + factor(p) + factor(q) + ' = 0</div><div>x = ' + num(p) + '  ,  x = ' + num(q) + '</div>';
            } else {
              ctx.sfx('error');
              say('בדוק שוב: הצב כל מספר במשוואה ' + bdi(eqText()) + ', ובדוק אם יוצא אפס. שים לב לסימנים.', false);
            }
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); reset(); });
        reset();
      }
    }
  });
}());
