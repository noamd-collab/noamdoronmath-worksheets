/**
 * מודל השטח — an engine game about the distributive law.
 *
 * The idea: a rectangle with one side a and the other side b + c can be cut
 * into two rectangles, so a·(b + c) = a·b + a·c. A minus in front of the
 * brackets flips the sign of every term inside. Two brackets make four tiles,
 * (a + b)·(c + d) = ac + ad + bc + bd, and factoring is the same picture read
 * backwards.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var CA = '#1d4ed8', CB = '#c2410c', CC = '#6d28d9', CG = '#15803d';
  var BAD = '#b91c1c', MUTED = '#475569';
  var FM = 'Secular One, sans-serif', FH = 'Heebo, sans-serif';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function setAttrs(el, obj) {
    if (!el) return;
    Object.keys(obj).forEach(function (k) { el.setAttribute(k, obj[k]); });
  }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  /** Text in SVG that carries mathematics: left-to-right, number font. */
  function mt(id, x, y, size, fill, txt) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" direction="ltr" font-family="' + FM + '" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle">' + (txt || '') + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function keyDelta(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -1;
    return 0;
  }
  var BTN = 'display:block;width:100%;min-height:44px;margin:6px 0;padding:8px 10px;border:2px solid var(--main-line, #a3c0f5);'
    + 'border-radius:12px;background:#fff;color:var(--ink, #0c2340);font:inherit;font-weight:700;cursor:pointer;text-align:center';

  /* ---------- a static grid picture (used by the quizzes) ---------- */
  /** cols: [{w,label}], rows: [{h,label}], cells: 2D array of strings. */
  function gridPicture(cols, rows, cells, colors) {
    return function (ctx) {
      var tw = 0, th = 0, i, j, s = '';
      cols.forEach(function (c) { tw += c.w; });
      rows.forEach(function (r) { th += r.h; });
      var x0 = Math.round((402 - tw) / 2) + 14, y0 = 56;
      var cx = x0;
      for (i = 0; i < cols.length; i++) {
        s += mt('cl' + i, cx + cols[i].w / 2, 40, 20, INK, cols[i].label);
        var cy = y0;
        for (j = 0; j < rows.length; j++) {
          var col = colors[j][i];
          s += '<rect x="' + cx + '" y="' + cy + '" width="' + cols[i].w + '" height="' + rows[j].h + '" fill="' + col
            + '" fill-opacity=".2" stroke="' + col + '" stroke-width="2.5"/>'
            + mt('ce' + i + j, cx + cols[i].w / 2, cy + rows[j].h / 2 + 8, 22, col, cells[j][i]);
          cy += rows[j].h;
        }
        cx += cols[i].w;
      }
      var ry = y0;
      for (j = 0; j < rows.length; j++) {
        s += mt('rl' + j, x0 - 22, ry + rows[j].h / 2 + 7, 20, INK, rows[j].label);
        ry += rows[j].h;
      }
      ctx.draw(s);
    };
  }

  /* ---------- step 1: cut the rectangle ---------- */
  function cutScene(ctx) {
    var A = 3, TOT = 10, GOAL = 4;
    var X0 = 64, U = 30, Y0 = 70, HH = 96;
    var b = 2, reached = false, doneOnce = false;
    ctx.draw('<rect id="rL" y="' + Y0 + '" height="' + HH + '" fill="' + CA + '" fill-opacity=".2" stroke="' + CA + '" stroke-width="2.5"/>'
      + '<rect id="rR" y="' + Y0 + '" height="' + HH + '" fill="' + CB + '" fill-opacity=".2" stroke="' + CB + '" stroke-width="2.5"/>'
      + '<line x1="54" y1="' + Y0 + '" x2="54" y2="' + (Y0 + HH) + '" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>'
      + mt('lbA', 30, Y0 + HH / 2 + 6, 17, INK, 'a = 3')
      + mt('lbB', 100, 54, 18, CA, '') + mt('lbC', 250, 54, 18, CB, '')
      + mt('arL1', 100, 112, 17, CA, '') + mt('arL2', 100, 134, 17, CA, '')
      + mt('arR1', 250, 112, 17, CB, '') + mt('arR2', 250, 134, 17, CB, '')
      + '<line id="cutLine" y1="' + (Y0 - 8) + '" y2="' + (Y0 + HH + 24) + '" stroke="' + INK + '" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round"/>'
      + '<g id="hCut" tabindex="0" role="slider" aria-label="קו החיתוך של המלבן. חצים מזיזים אותו ימינה או שמאלה" aria-valuemin="1" aria-valuemax="9" aria-valuenow="' + b
      + '" aria-valuetext="b שווה ' + b + '" style="cursor:grab">'
      + '<rect x="-44" y="' + (Y0 + HH - 4) + '" width="88" height="86" fill="transparent"/>'
      + '<circle cx="0" cy="' + (Y0 + HH + 36) + '" r="14" fill="#fff" stroke="' + INK + '" stroke-width="4.5"/>'
      + '<path d="M-6 ' + (Y0 + HH + 36) + ' L-2 ' + (Y0 + HH + 32) + ' L-2 ' + (Y0 + HH + 40) + ' Z M6 ' + (Y0 + HH + 36) + ' L2 ' + (Y0 + HH + 32) + ' L2 ' + (Y0 + HH + 40) + ' Z" fill="' + INK + '"/>'
      + '</g>');
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>חלק שמאלי</b><span class="math" dir="ltr" data-v="l" style="color:' + CA + '"></span></div>'
      + '<div><b>חלק ימני</b><span class="math" dir="ltr" data-v="r" style="color:' + CB + '"></span></div>'
      + '<div><b>כל המלבן</b><span class="math" dir="ltr" data-v="t" style="color:' + INK + '"></span></div></div>'
      + '<div class="stepper" dir="ltr" style="margin-top:8px"><div class="unit" dir="ltr" style="gap:6px;padding:6px 6px">'
      + '<bdi class="math var" dir="ltr" style="color:' + CA + '">b</bdi>'
      + '<button type="button" id="bMinus" data-delta="-1" aria-label="הקטן את b ב־1: הקו זז שמאלה">−1</button>'
      + '<bdi class="var math" dir="ltr" data-value="b" style="min-width:34px" aria-live="polite"></bdi>'
      + '<button type="button" id="bPlus" data-delta="1" aria-label="הגדל את b ב־1: הקו זז ימינה">+1</button></div></div>'
      + '<div style="margin-top:8px"><div style="font-weight:700;font-size:14px;color:' + MUTED + '">איזו שורה מתארת את הציור?</div>'
      + '<button type="button" id="optA" data-k="A" style="' + BTN + '"></button>'
      + '<button type="button" id="optB" data-k="B" style="' + BTN + '"></button>'
      + '<button type="button" id="optC" data-k="C" style="' + BTN + '"></button></div>');
    ctx.register('controls', box);
    var hCut = ctx.el('hCut');
    function lines() {
      var c = TOT - b;
      return {
        A: m(A + '·(' + b + ' + ' + c + ') = ' + A + '·' + b + ' + ' + A + '·' + c),
        B: m(A + '·(' + b + ' + ' + c + ') = ' + A + '·' + b + ' + ' + c),
        C: m(A + '·(' + b + ' + ' + c + ') = ' + A + ' + ' + b + ' + ' + A + ' + ' + c)
      };
    }
    function render() {
      var c = TOT - b, cx = X0 + b * U, wl = b * U, wr = c * U;
      setAttrs(ctx.el('rL'), { x: X0, width: wl });
      setAttrs(ctx.el('rR'), { x: cx, width: wr });
      setAttrs(ctx.el('cutLine'), { x1: cx, x2: cx });
      hCut.setAttribute('transform', 'translate(' + cx + ' 0)');
      setAttrs(hCut, { 'aria-valuenow': b, 'aria-valuetext': 'b שווה ' + b + ', c שווה ' + c });
      function put(id, x, t, size) { var e = ctx.el(id); e.textContent = t; setAttrs(e, { x: clamp(x, X0 + 18, X0 + TOT * U - 18), 'font-size': size }); }
      var sl = wl < 50 ? 14 : 17, sr = wr < 50 ? 14 : 17;
      put('lbB', X0 + wl / 2, 'b = ' + b, 18);
      put('lbC', cx + wr / 2, 'c = ' + c, 18);
      put('arL1', X0 + wl / 2, A + '·' + b, sl);
      put('arL2', X0 + wl / 2, '= ' + (A * b), sl);
      put('arR1', cx + wr / 2, A + '·' + c, sr);
      put('arR2', cx + wr / 2, '= ' + (A * c), sr);
      box.querySelector('[data-v="l"]').textContent = A + '·' + b + ' = ' + (A * b);
      box.querySelector('[data-v="r"]').textContent = A + '·' + c + ' = ' + (A * c);
      box.querySelector('[data-v="t"]').textContent = A + '·' + TOT + ' = ' + (A * TOT);
      box.querySelector('[data-value="b"]').textContent = String(b);
      var L = lines();
      box.querySelector('#optA').innerHTML = L.A;
      box.querySelector('#optB').innerHTML = L.B;
      box.querySelector('#optC').innerHTML = L.C;
      ctx.caption(m(A + '·(' + b + ' + ' + c + ') = ' + (A * b) + ' + ' + (A * c) + ' = ' + (A * TOT)));
    }
    function note() {
      if (b === GOAL) {
        ctx.note('החיתוך במקום: ' + m('b = 4') + ' ו־' + m('c = 6') + '. עכשיו בחר את השורה שמתארת את שני החלקים.');
      } else {
        ctx.note('בכל חיתוך שני החלקים נותנים ביחד ' + m(String(A * TOT)) + '. מצא את החיתוך שבו ' + m('b = 4') + '.');
      }
    }
    function setB(v) {
      v = clamp(v, 1, 9);
      if (v === b) return;
      b = v;
      ctx.sfx('tick');
      render();
      note();
      if (b === GOAL && !reached) { reached = true; ctx.sfx('click'); }
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { setB(b + Number(bt.getAttribute('data-delta'))); });
    });
    hCut.addEventListener('keydown', function (e) {
      if (e.key === 'Home') { e.preventDefault(); setB(1); return; }
      if (e.key === 'End') { e.preventDefault(); setB(9); return; }
      var d = keyDelta(e);
      if (!d) return;
      e.preventDefault();
      setB(b + d);
    });
    ctx.drag(ctx.svg, {
      start: function (x) { setB(Math.round((x - X0) / U)); },
      move: function (x) { setB(Math.round((x - X0) / U)); }
    });
    function choose(k) {
      var c = TOT - b;
      if (k === 'B') {
        ctx.sfx('error');
        ctx.note('כתבת ' + m(A + '·' + b + ' + ' + c) + ': הכפלת בשלוש רק את החלק השמאלי. גם החלק הימני הוא מלבן בגובה ' + m(String(A)) + ', ושטחו ' + m(A + '·' + c) + ' ולא ' + m(String(c)) + '.');
      } else if (k === 'C') {
        ctx.sfx('error');
        ctx.note('חיברת את כל המספרים במקום לכפול. שטח הוא גובה כפול רוחב: ' + m(A + '·' + b) + ' ועוד ' + m(A + '·' + c) + '.');
      } else if (b !== GOAL) {
        ctx.sfx('click');
        ctx.note('השורה נכונה לכל חיתוך, ' + m(A + '·' + b + ' + ' + A + '·' + c + ' = ' + (A * TOT)) + '. אבל המשימה היא להזיז את החיתוך כך ש־' + m('b = 4') + '.');
      } else if (!doneOnce) {
        doneOnce = true;
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.note('כל חלק הוא מלבן בגובה ' + m('3') + ': ' + m('3·(4 + 6) = 3·4 + 3·6 = 12 + 18 = 30') + '. הכפל נכנס לשני החלקים.', 'good');
        ctx.solved();
      }
    }
    box.querySelectorAll('[data-k]').forEach(function (bt) {
      bt.addEventListener('click', function () { choose(bt.getAttribute('data-k')); });
    });
    render();
    note();
  }

  /* ---------- step 3: a minus before the brackets ---------- */
  var ROUNDS = [
    { expr: '3·(7 − 2) =', t1: '3·7', t2: '3·2', v1: 21, v2: 6, ok: [1, -1], target: 15 },
    { expr: '−(x − 5) =', t1: 'x', t2: '5', v1: 8, v2: 5, ok: [-1, 1], target: -3 }
  ];
  function signStr(n) { return n < 0 ? '\u2212' + Math.abs(n) : String(n); }
  function minusScene(ctx) {
    var round = 0, s1 = 1, s2 = 1, solvedRound = [false, false], doneOnce = false;
    ctx.draw('<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
      + '<rect width="8" height="8" fill="#fff"/><line x1="0" y1="0" x2="0" y2="8" stroke="' + CB + '" stroke-width="3"/></pattern></defs>'
      + '<g id="pic"></g>');
    var box = ctx.extra('<div id="mExpr" dir="ltr" style="display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;font-family:' + FM + ';font-size:20px;color:' + INK + '"></div>');
    var pic = ctx.el('pic');
    var chk = null;
    function tgBtn(id, label) {
      return '<button type="button" id="' + id + '" aria-label="' + label + '" style="min-height:44px;min-width:44px;border:2.5px solid ' + INK
        + ';border-radius:12px;background:#fff;color:' + INK + ';font-family:' + FM + ';font-size:24px;font-weight:700;cursor:pointer"></button>';
    }
    function buildExpr() {
      var R = ROUNDS[round];
      box.querySelector('#mExpr').innerHTML = '<span dir="ltr">' + R.expr + '</span>'
        + tgBtn('tg1', 'הסימן של האיבר הראשון. לחץ כדי להחליף בין פלוס למינוס')
        + '<span dir="ltr" style="color:' + CA + '">' + R.t1 + '</span>'
        + tgBtn('tg2', 'הסימן של האיבר השני. לחץ כדי להחליף בין פלוס למינוס')
        + '<span dir="ltr" style="color:' + CB + '">' + R.t2 + '</span>';
      var t1 = box.querySelector('#tg1'), t2 = box.querySelector('#tg2');
      t1.addEventListener('click', function () { s1 = -s1; ctx.sfx('tick'); render(); free(); });
      t2.addEventListener('click', function () { s2 = -s2; ctx.sfx('tick'); render(); free(); });
    }
    function free() {
      var R = ROUNDS[round];
      ctx.note('האיבר הראשון ' + (s1 > 0 ? 'חיובי' : 'שלילי') + ' והשני ' + (s2 > 0 ? 'חיובי' : 'שלילי') + ': התוצאה ' + m(signStr(s1 * R.v1 + s2 * R.v2)) + '. ' + (round === 0 ? 'השווה לשטח המקווקו הירוק.' : 'השווה לנקודה הירוקה.') + ' לחץ "בדוק" כשהסימנים נראים לך נכונים.');
    }
    function arrow(x1, x2, y, color) {
      if (x1 === x2) return '';
      var d = x2 > x1 ? 1 : -1;
      return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + color + '" stroke-width="5" stroke-linecap="round"/>'
        + '<polygon points="' + x2 + ',' + y + ' ' + (x2 - 12 * d) + ',' + (y - 8) + ' ' + (x2 - 12 * d) + ',' + (y + 8) + '" fill="' + color + '"/>';
    }
    function render() {
      var R = ROUNDS[round], val = s1 * R.v1 + s2 * R.v2, s = '';
      var t1 = box.querySelector('#tg1'), t2 = box.querySelector('#tg2');
      t1.textContent = s1 > 0 ? '+' : '\u2212';
      t2.textContent = s2 > 0 ? '+' : '\u2212';
      t1.setAttribute('aria-pressed', s1 < 0 ? 'true' : 'false');
      t2.setAttribute('aria-pressed', s2 < 0 ? 'true' : 'false');
      if (round === 0) {
        var x0 = 40, y0 = 66, U = 30, H = 84, i;
        for (i = 0; i <= 9; i++) s += '<line x1="' + (x0 + i * U) + '" y1="' + y0 + '" x2="' + (x0 + i * U) + '" y2="' + (y0 + H) + '" stroke="#cbd5e1" stroke-width="1"/>';
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="210" height="' + H + '" fill="' + (s1 > 0 ? CA : BAD) + '" fill-opacity=".2" stroke="'
          + (s1 > 0 ? CA : BAD) + '" stroke-width="2.5"' + (s1 > 0 ? '' : ' stroke-dasharray="7 5"') + '/>';
        if (s2 < 0) s += '<rect x="' + (x0 + 150) + '" y="' + y0 + '" width="60" height="' + H + '" fill="url(#hatch)" stroke="' + CB + '" stroke-width="2.5"/>';
        else s += '<rect x="' + (x0 + 210) + '" y="' + y0 + '" width="60" height="' + H + '" fill="' + CB + '" fill-opacity=".35" stroke="' + CB + '" stroke-width="2.5"/>';
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="150" height="' + H + '" fill="none" stroke="' + CG + '" stroke-width="4" stroke-dasharray="9 6"/>';
        s += mt('pTop', x0 + 75, 46, 16, CG, '3·(7 \u2212 2) = 3·5 = 15');
        s += mt('pL', x0 + (s2 < 0 ? 75 : 105), y0 + 52, 24, s1 > 0 ? CA : BAD, (s1 > 0 ? '' : '\u2212') + '21');
        s += mt('pR', x0 + (s2 < 0 ? 180 : 240), y0 + 52, 22, CB, (s2 < 0 ? '\u2212' : '+') + '6');
        s += mt('pRes', 201, 200, 22, INK, signStr(s1 * 21) + (s2 < 0 ? ' \u2212 ' : ' + ') + '6 = ' + signStr(val));
        ctx.caption(m('3·(7 \u2212 2) = ' + (s1 < 0 ? '\u2212' : '') + '3·7 ' + (s2 < 0 ? '\u2212' : '+') + ' 3·2'));
      } else {
        var ax = function (v) { return 201 + v * 13; };
        s += '<line x1="19" y1="200" x2="383" y2="200" stroke="' + INK + '" stroke-width="2.5"/>';
        [-10, -5, 0, 5, 10].forEach(function (t) {
          s += '<line x1="' + ax(t) + '" y1="194" x2="' + ax(t) + '" y2="206" stroke="' + INK + '" stroke-width="2.5"/>'
            + mt('nl' + (t + 20), ax(t), 226, 15, INK, signStr(t));
        });
        s += mt('pTop', 201, 40, 16, CG, '\u2212(8 \u2212 5) = \u22123');
        s += arrow(ax(0), ax(s1 * 8), 110, CA) + arrow(ax(s1 * 8), ax(s1 * 8 + s2 * 5), 146, CB);
        s += mt('pA', ax(s1 * 4), 98, 16, CA, signStr(s1 * 8)) + mt('pB', ax(s1 * 8 + s2 * 2.5), 134, 16, CB, signStr(s2 * 5));
        s += '<circle cx="' + ax(-3) + '" cy="200" r="11" fill="none" stroke="' + CG + '" stroke-width="4" stroke-dasharray="4 3"/>';
        s += '<circle cx="' + ax(val) + '" cy="200" r="6" fill="' + INK + '"/>';
        s += mt('pRes', clamp(ax(val), 40, 362), 176, 20, INK, signStr(val));
        ctx.caption(m('\u2212(x \u2212 5) = ' + (s1 < 0 ? '\u2212' : '') + 'x ' + (s2 < 0 ? '\u2212' : '+') + ' 5'));
      }
      pic.innerHTML = s;
    }
    function check() {
      var R = ROUNDS[round];
      if (s1 === R.ok[0] && s2 === R.ok[1]) {
        ctx.sfx('correct');
        ctx.burst(12);
        solvedRound[round] = true;
        if (round === 0) {
          ctx.note('נכון: ' + m('3·(7 \u2212 2) = 3·7 \u2212 3·2 = 21 \u2212 6 = 15') + '. ה־2 נחסר, ולכן גם החלק ' + m('3·2') + ' נחסר.', 'good');
          chk.textContent = 'לתרגיל השני ←';
        } else {
          ctx.note('נכון: ' + m('\u2212(x \u2212 5) = \u2212x + 5') + '. המינוס שלפני הסוגריים הפך את שני הסימנים: ' + m('x') + ' נעשה ' + m('\u2212x') + ', ו־' + m('\u22125') + ' נעשה ' + m('+5') + '. בדיקה עם ' + m('x = 8') + ': ' + m('\u2212(8 \u2212 5) = \u22123') + ' וגם ' + m('\u22128 + 5 = \u22123') + '.', 'good');
          chk.textContent = 'הושלם';
          if (!doneOnce) { doneOnce = true; ctx.solved(); }
        }
        return;
      }
      ctx.sfx('error');
      if (round === 0) {
        if (s1 === 1 && s2 === 1) ctx.note('השארת את ה־2 עם פלוס. אבל ' + m('7 \u2212 2') + ' פירושו שה־2 נחסר, ולכן גם ' + m('3·2') + ' נחסר. כך יוצא ' + m('21 + 6 = 27') + ', גדול מהשטח האמיתי ' + m('15') + '.');
        else if (s1 === -1) ctx.note('האיבר הראשון ' + m('3·7') + ' הוא המלבן השלם, והוא חיובי. רק החלק שמוציאים, ' + m('3·2') + ', מקבל מינוס.');
        else ctx.note('המלבן השלם ' + m('3·7') + ' הוא חיובי והחלק המוצא ' + m('3·2') + ' הוא שלילי. בדוק שוב את שני הסימנים.');
      } else if (s1 === -1 && s2 === -1) {
        ctx.note('השארת את הסימן של ה־5 כפי שהוא. אבל המינוס שלפני הסוגריים הופך את כל מה שבפנים, גם את ' + m('\u22125') + ': ' + m('\u2212(\u22125) = +5') + '. עם ' + m('x = 8') + ': ' + m('\u2212(8 \u2212 5) = \u22123') + ', ולא ' + m('\u22128 \u2212 5 = \u221213') + '.');
      } else if (s1 === 1 && s2 === 1) {
        ctx.note('התקבל ' + m('x + 5') + '. המינוס שלפני הסוגריים הופך את כל האיברים, גם את ' + m('x') + ' ולא רק את ה־5. עם ' + m('x = 8') + ' זה ' + m('13') + ' ולא ' + m('\u22123') + '.');
      } else {
        ctx.note('התקבל ' + m('x \u2212 5') + ', כאילו אין מינוס לפני הסוגריים. צריך להפוך את שני הסימנים, לא להשאיר אותם.');
      }
    }
    function next() {
      round = 1; s1 = 1; s2 = 1;
      buildExpr(); render();
      ctx.sfx('click');
      chk.textContent = 'בדוק';
      ctx.note('תרגיל 2 מתוך 2: מינוס לפני סוגריים. בחר את הסימן של כל איבר, ולחץ "בדוק".');
    }
    chk = ctx.button('בדוק', function () {
      if (doneOnce) return;
      if (round === 0 && solvedRound[0]) { next(); return; }
      check();
    }, { id: 'chkBtn', target: 'check' });
    ctx.register('controls', box);
    buildExpr();
    render();
    ctx.note('תרגיל 1 מתוך 2: שטח ירוק מקווקו הוא התוצאה הנכונה. החלף את הסימנים בלחיצה על הכפתורים, ולחץ "בדוק".');
  }

  /* ---------- step 5: four tiles ---------- */
  function tilesScene(ctx) {
    var COLW = [150, 96], ROWH = [96, 62];
    var X0 = 120, Y0 = 62;
    var TILES = [
      { c: 0, r: 0, f: 'x·x', ans: 'x²' },
      { c: 1, r: 0, f: '3·x', ans: '3x' },
      { c: 0, r: 1, f: 'x·2', ans: '2x' },
      { c: 1, r: 1, f: '3·2', ans: '6' }
    ];
    var CHIPS = ['2x', 'x²', '6', '3x', '5', 'x'];
    var colorOf = [CA, CB, CC, CG];
    var val = [null, null, null, null], sel = 0, doneOnce = false;
    var cx = [X0, X0 + COLW[0]], cy = [Y0, Y0 + ROWH[0]];
    var s = mt('tcx', X0 + COLW[0] / 2, 46, 20, INK, 'x') + mt('tc3', X0 + COLW[0] + COLW[1] / 2, 46, 20, INK, '3')
      + mt('trx', X0 - 22, Y0 + ROWH[0] / 2 + 7, 20, INK, 'x') + mt('tr2', X0 - 22, Y0 + ROWH[0] + ROWH[1] / 2 + 7, 20, INK, '2');
    TILES.forEach(function (t, i) {
      var x = cx[t.c], y = cy[t.r], w = COLW[t.c], h = ROWH[t.r];
      s += '<g id="tile' + i + '" tabindex="0" role="button" data-i="' + i + '" style="cursor:pointer">'
        + '<rect id="tr' + i + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + colorOf[i] + '" fill-opacity=".16" stroke="' + colorOf[i] + '" stroke-width="2.5"/>'
        + mt('tf' + i, x + w / 2, y + 20, 14, MUTED, t.f)
        + mt('tv' + i, x + w / 2, y + h / 2 + 18, 24, colorOf[i], '?')
        + '</g>';
    });
    s += mt('tSum', 201, 224, 20, INK, '');
    ctx.draw(s);
    var chipHtml = CHIPS.map(function (c, k) {
      return '<button type="button" id="chip' + k + '" data-chip="' + c + '" aria-label="שים במשבצת: ' + c + '" style="min-height:44px;min-width:44px;border:2.5px solid ' + INK
        + ';border-radius:12px;background:#fff;color:' + INK + ';font-family:' + FM + ';font-size:22px;font-weight:700;cursor:pointer">' + c + '</button>';
    }).join('');
    var box = ctx.extra('<div style="font-weight:700;font-size:14px;color:' + MUTED + ';margin-bottom:6px">בחר משבצת, ואז בחר את המכפלה שלה:</div>'
      + '<div dir="ltr" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px">' + chipHtml + '</div>');
    ctx.register('controls', box);
    function tileLabel(i) {
      var t = TILES[i];
      return 'משבצת ' + (i + 1) + ': ' + t.f.replace('·', ' כפול ') + (val[i] ? ', מכפלה ' + val[i] : ', עדיין ריקה');
    }
    function render() {
      TILES.forEach(function (t, i) {
        var g = ctx.el('tile' + i), tv = ctx.el('tv' + i);
        tv.textContent = val[i] || '?';
        setAttrs(ctx.el('tr' + i), { 'stroke-width': i === sel ? 5 : 2.5, 'fill-opacity': val[i] ? .3 : .12 });
        g.setAttribute('aria-label', tileLabel(i) + (i === sel ? ' (נבחרה)' : ''));
      });
      var all = val.every(function (v) { return v; });
      ctx.el('tSum').textContent = all ? 'x² + 3x + 2x + 6 = x² + 5x + 6' : '';
      ctx.caption(m(all ? '(x + 3)·(x + 2) = x² + 3x + 2x + 6 = x² + 5x + 6' : '(x + 3)·(x + 2) = ?'));
    }
    function nextEmpty(from) {
      for (var k = 0; k < 4; k++) { var j = (from + k) % 4; if (!val[j]) return j; }
      return from;
    }
    function select(i) { sel = i; ctx.sfx('tick'); render(); intro(); }
    function intro() {
      if (val.every(function (v) { return v; })) return;
      ctx.note('משבצת ' + (sel + 1) + ' נבחרה: ' + m(TILES[sel].f) + '. בחר מתחת את המכפלה שלה.');
    }
    function put(chip) {
      var i = sel, t = TILES[i];
      if (val[i] === t.ans) { ctx.note('המשבצת הזו כבר מלאה. בחר משבצת ריקה.'); return; }
      if (chip === t.ans) {
        val[i] = chip;
        ctx.sfx('correct');
        var all = val.every(function (v) { return v; });
        sel = nextEmpty(i);
        render();
        if (all) {
          ctx.burst(18);
          ctx.note('ארבע מכפלות, לא שתיים: ' + m('x² + 3x + 2x + 6 = x² + 5x + 6') + '. מי שמכפיל רק ' + m('x·x') + ' ו־' + m('3·2') + ' מקבל ' + m('x² + 6') + ', וחסרים שני המלבנים האמצעיים ' + m('3x') + ' ו־' + m('2x') + '.', 'good');
          if (!doneOnce) { doneOnce = true; ctx.solved(); }
        } else {
          ctx.note('נכון: ' + m(t.f + ' = ' + t.ans) + '. נשארו ' + (4 - val.filter(function (v) { return v; }).length) + ' משבצות.');
        }
        return;
      }
      ctx.sfx('error');
      if (i === 0 && chip === '2x') ctx.note(m('x·x') + ' אינו ' + m('2x') + ': ' + m('x + x') + ' הוא ' + m('2x') + ', אבל ' + m('x·x') + ' הוא ' + m('x²') + '.');
      else if (i === 0 && chip === 'x') ctx.note('כפל של ' + m('x') + ' ב־' + m('x') + ' נותן ' + m('x²') + ' ולא ' + m('x') + '.');
      else if (i === 3 && chip === '5') ctx.note('הגורמים ' + m('3') + ' ו־' + m('2') + ' נכפלים, לא מתחברים: ' + m('3·2 = 6') + ', לא ' + m('3 + 2 = 5') + '.');
      else if (i === 1 && chip === '2x') ctx.note('במשבצת הזו הגורמים הם ' + m('3') + ' ו־' + m('x') + ', לא ' + m('2') + ' ו־' + m('x') + '. המכפלה היא ' + m('3x') + '.');
      else if (i === 2 && chip === '3x') ctx.note('במשבצת הזו הגורמים הם ' + m('x') + ' ו־' + m('2') + ', לא ' + m('3') + ' ו־' + m('x') + '. המכפלה היא ' + m('2x') + '.');
      else ctx.note('זה לא מתאים: הכפל את שני הגורמים שכתובים בראש העמודה ובתחילת השורה, ' + m(t.f) + '.');
    }
    box.querySelectorAll('[data-chip]').forEach(function (bt) {
      bt.addEventListener('click', function () { put(bt.getAttribute('data-chip')); });
    });
    TILES.forEach(function (t, i) {
      var g = ctx.el('tile' + i);
      g.addEventListener('click', function () { select(i); });
      g.addEventListener('keydown', function (e) {
        var j = i;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); return; }
        if (e.key === 'ArrowRight') j = i % 2 === 0 ? i + 1 : i;
        else if (e.key === 'ArrowLeft') j = i % 2 === 1 ? i - 1 : i;
        else if (e.key === 'ArrowDown') j = i < 2 ? i + 2 : i;
        else if (e.key === 'ArrowUp') j = i >= 2 ? i - 2 : i;
        else return;
        e.preventDefault();
        sel = j;
        render();
        ctx.el('tile' + j).focus();
        intro();
      });
    });
    ctx.button('נקה משבצות', function () {
      if (doneOnce) return;
      val = [null, null, null, null]; sel = 0;
      ctx.sfx('click'); render(); intro();
    }, { ghost: true, id: 'clearBtn' });
    render();
    intro();
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'מודל השטח',
      sub: 'חותכים מלבן לחלקים ורואים למה חוק הפילוג עובד.',
      tip: 'שלום, אני אליהו. היום נחתוך מלבנים ונראה למה אפשר לפתוח סוגריים.',
      emoji: '🧱',
      eq: m('a·(b + c) = a·b + a·c'),
      note: 'מלבן שצלע אחת שלו ' + m('a') + ' והשנייה ' + m('b + c') + ' אפשר לחתוך לשני מלבנים. סכום שני השטחים הוא שטח המלבן כולו: זה חוק הפילוג. אחר כך נראה מה קורה עם מינוס, ועם שני סוגריים.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'חותכים את המלבן',
      sub: 'גובה המלבן ' + m('3') + ' והרוחב ' + m('10') + '. הזז את החיתוך בגרירה, בכפתורים או בחיצים עד ' + m('b = 4') + ', ובחר את השורה הנכונה.',
      tip: 'גבהו של המלבן ' + m('3') + '. כל חלק הוא מלבן, ושטחו הוא גובה כפול רוחב.',
      cue: 'הזז את החיתוך ל־4 ובחר את השורה',
      cueDone: 'שני חלקים, שני שטחים, סכום אחד. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 236],
      alt: 'מלבן בגובה 3 ורוחב 10 שנחתך בקו מקווקו לשני מלבנים, כחול משמאל וכתום מימין, עם ידית שמזיזים ימינה ושמאלה לקביעת מקום החיתוך',
      nudge: { target: 'controls', text: 'לחץ על +1 או על −1 כדי להזיז את החיתוך, ואז בחר שורה.' },
      setup: cutScene
    },
    {
      mode: 'quiz',
      tA: 'פותחים את הסוגריים',
      sub: 'מהי ' + m('3·(x + 5)') + ' אחרי פתיחת סוגריים?',
      tip: 'בציור: שני מלבנים בגובה ' + m('3') + '. מה שטחו של כל אחד?',
      btn: 'המשך ←',
      aspect: [402, 160],
      alt: 'מלבן בגובה 3 שנחתך לשני מלבנים, אחד ברוחב x ואחד ברוחב 5, ובשניהם סימן שאלה במקום השטח',
      setup: gridPicture([{ w: 140, label: 'x' }, { w: 90, label: '5' }], [{ h: 78, label: '3' }], [['?', '?']], [[CA, CB]]),
      win: 'נכון. השלוש מכפיל את שני האיברים שבסוגריים.',
      wrongSay: 'כל אחד משני המלבנים בגובה 3. מה שטח כל אחד?',
      opts: [
        { t: m('3x + 5'), f: 'הכפלת בשלוש רק את האיבר הראשון. ' + m('3') + ' מכפיל גם את ה־5: המלבן הימני הוא ' + m('3·5 = 15') + '.' },
        { t: m('3x + 15'), c: true, f: 'נכון: ' + m('3·x = 3x') + ' ו־' + m('3·5 = 15') + ', ולכן ' + m('3·(x + 5) = 3x + 15') + '.' },
        { t: m('x + 15'), f: 'הכפלת בשלוש רק את האיבר השני. גם ' + m('x') + ' מוכפל ב־' + m('3') + ': השטח הכחול הוא ' + m('3x') + '.' },
        { t: m('3x + 8'), f: 'חיברת ' + m('3 + 5') + ' במקום להכפיל. שטח הוא גובה כפול רוחב: ' + m('3·5 = 15') + '.' }
      ],
      hints: [
        'חתוך את המלבן לשני חלקים. שטח כל חלק הוא גובה כפול רוחב.',
        'המלבן השמאלי ' + m('3·x') + '. מה שטח המלבן הימני?',
        m('3·x = 3x') + ' ו־' + m('3·5') + ' הוא ' + m('15') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מינוס לפני הסוגריים',
      sub: 'בחר את הסימן של כל איבר, ולחץ "בדוק". שני תרגילים.',
      tip: 'כשמוציאים חלק מהמלבן, גם השטח שלו נחסר. ומינוס לפני סוגריים הופך את כל הסימנים שבפנים.',
      cue: 'בחר את הסימנים ולחץ "בדוק"',
      cueDone: 'שני תרגילים נכונים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 240],
      alt: 'ציור של מלבן שבו מסומן בקו ירוק מקווקו השטח הנכון, ועליו חלק מקווקו שנוסף או נחסר בהתאם לסימן שבוחרים. בתרגיל השני ציר מספרים עם חיצים',
      nudge: { target: 'controls', text: 'לחץ על כפתור הסימן כדי להחליף בין פלוס למינוס, ואז על "בדוק".' },
      setup: minusScene
    },
    {
      mode: 'quiz',
      tA: 'מינוס שהופך הכול',
      sub: 'מהי ' + m('\u2212(x \u2212 5)') + ' אחרי פתיחת סוגריים?',
      tip: 'המינוס שלפני הסוגריים הופך את הסימן של כל איבר שבפנים.',
      btn: 'המשך ←',
      win: 'מעולה. הפכת את שני הסימנים.',
      wrongSay: 'המינוס מקדימה משפיע על x ועל ה־5. מה קורה לכל אחד?',
      opts: [
        { t: m('x + 5'), f: 'הפכת רק את הסימן של ה־5. המינוס שלפני הסוגריים הופך גם את ' + m('x') + ', שנעשה ' + m('\u2212x') + '.' },
        { t: m('\u2212x \u2212 5'), f: 'הפכת את ' + m('x') + ' אבל השארת את הסימן של ה־5. ' + m('\u22125') + ' בתוך הסוגריים הופך ל־' + m('+5') + '.' },
        { t: m('x \u2212 5'), f: 'התעלמת מהמינוס שלפני הסוגריים. הוא לא נעלם, והוא הופך את שני הסימנים.' },
        { t: m('\u2212x + 5'), c: true, f: 'נכון: ' + m('\u2212(x \u2212 5) = \u22121·x + (\u22121)·(\u22125) = \u2212x + 5') + '.' }
      ],
      hints: [
        'מינוס לפני סוגריים הוא כמו כפל ב־' + m('\u22121') + '.',
        'הכפל ב־' + m('\u22121') + ' גם את ' + m('x') + ' וגם את ' + m('\u22125') + '.',
        m('\u22121·x = \u2212x') + ' ו־' + m('\u22121·(\u22125)') + ' הוא ' + m('+5') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'שני סוגריים, ארבע משבצות',
      sub: 'המלבן ' + m('(x + 3)·(x + 2)') + ' בנוי מארבע משבצות. בחר משבצת במגע, בכפתורים או בחיצים, ומלא בכל אחת את המכפלה שלה.',
      tip: 'כל איבר מהסוגריים הראשונים כופל כל איבר מהשניים. כמה משבצות זה?',
      cue: 'מלא את ארבע המשבצות',
      cueDone: 'ארבע מכפלות, ולא שתיים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 240],
      alt: 'מלבן שמחולק לארבע משבצות. רוחבו x ועוד 3 וגובהו x ועוד 2. בכל משבצת מופיע המכפלה שצריך למלא, וסימן שאלה במשבצות הריקות',
      nudge: { target: 'controls', text: 'לחץ על משבצת, ואז על המכפלה שלה למטה. התחל במשבצת ' + m('x·x') + '.' },
      setup: tilesScene
    },
    {
      mode: 'quiz',
      tA: 'ארבע מכפלות',
      sub: 'מהי ' + m('(x + 3)·(x + 2)') + ' אחרי פתיחת סוגריים?',
      tip: 'בציור ארבע משבצות. אף אחת מהן לא יכולה להיעלם.',
      btn: 'המשך ←',
      aspect: [402, 190],
      alt: 'מלבן בן ארבע משבצות עם רוחב x ועוד 3 וגובה x ועוד 2. המשבצת העליונה השמאלית x בריבוע, התחתונה הימנית 6, ובשתי האמצעיות סימני שאלה',
      setup: gridPicture([{ w: 130, label: 'x' }, { w: 84, label: '3' }], [{ h: 70, label: 'x' }, { h: 48, label: '2' }],
        [['x²', '?'], ['?', '6']], [[CA, CB], [CC, CG]]),
      win: 'נכון. כל ארבע המכפלות נכנסו, והאמצעיות התחברו.',
      wrongSay: 'ספור את המשבצות בציור. שתיים כבר ידועות, ומה עם השתיים האחרות?',
      opts: [
        { t: m('x² + 5x + 6'), c: true, f: 'נכון: ' + m('x² + 3x + 2x + 6') + ', והאמצעיות מתחברות ל־' + m('5x') + '.' },
        { t: m('x² + 6'), f: 'כפלת רק את האיברים הראשונים ביניהם ואת האחרונים ביניהם. חסר האיבר האמצעי: ' + m('3x') + ' ו־' + m('2x') + '.' },
        { t: m('2x + 5'), f: 'חיברת ' + m('x + x') + ' ו־' + m('3 + 2') + ' במקום לכפול. שני סוגריים הם כפל של ארבע משבצות.' },
        { t: m('x² + 5x + 5'), f: 'חישבת נכון את ' + m('x²') + ' ואת ' + m('5x') + ', אבל ' + m('3·2') + ' הוא ' + m('6') + ' ולא ' + m('5') + '.' }
      ],
      hints: [
        'בציור ארבע משבצות. כל אחת היא מכפלה של שני גורמים.',
        'שתי המשבצות האמצעיות הן ' + m('3x') + ' ו־' + m('2x') + '. מה סכומן?',
        m('x² + 3x + 2x + 6') + '. חבר את האיברים הדומים.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'חוזרים לאחור',
      sub: 'איזו כתיבה שווה ל־' + m('6x + 15') + ' אחרי הוצאת גורם משותף ' + m('3') + '?',
      tip: 'הוצאת גורם משותף היא חוק הפילוג בכיוון ההפוך. אחרי שהוצאת, פתח סוגריים ובדוק.',
      btn: 'לסיכום ←',
      win: 'מצוין. פתחת סוגריים וחזרת לביטוי המקורי.',
      wrongSay: 'פתח סוגריים בכל תשובה ובדוק מי נותנת בחזרה ' + m('6x + 15') + '.',
      opts: [
        { t: m('3·(6x + 5)'), f: 'חילקת ב־' + m('3') + ' רק את ה־15. גם ' + m('6x') + ' מתחלק: פתיחה נותנת ' + m('18x + 15') + ', לא ' + m('6x + 15') + '.' },
        { t: m('3·(2x + 15)'), f: 'חילקת ב־' + m('3') + ' רק את ' + m('6x') + '. גם ' + m('15') + ' מתחלק: פתיחה נותנת ' + m('6x + 45') + ', לא ' + m('6x + 15') + '.' },
        { t: m('3·(2x + 5)'), c: true, f: 'נכון: ' + m('6x ÷ 3 = 2x') + ' ו־' + m('15 ÷ 3 = 5') + '. פתיחה: ' + m('3·2x + 3·5 = 6x + 15') + '.' },
        { t: m('2x + 5'), f: 'שכחת לכתוב את ה־' + m('3') + ' שהוצאת. הגורם המשותף נשאר מחוץ לסוגריים.' }
      ],
      hints: [
        'כל איבר בביטוי מתחלק ב־' + m('3') + '. הגורם המשותף נכתב מחוץ לסוגריים.',
        'חלק ב־' + m('3') + ' את ' + m('6x') + ' ואת ' + m('15') + ', וכתוב את התוצאות בסוגריים.',
        m('6x ÷ 3 = 2x') + ' ו־' + m('15 ÷ 3 = 5') + '. בדוק בפתיחת סוגריים.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את מודל השטח',
      sub: 'מלבן חתוך הוא חוק פילוג שאפשר לראות.',
      tip: 'כל הכבוד. כשצריך לפתוח סוגריים, צייר מלבן וחתוך אותו.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'כל איבר בסוגריים נכפל בגורם שבחוץ, ובשני סוגריים כל איבר כופל כל איבר:',
      formula: m('a·(b + c) = a·b + a·c') + ' · ' + m('(a + b)·(c + d) = ac + ad + bc + bd')
    }
  ];

  window.NoamGame.boot({
    slug: 'model-hashetach',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'פתיחת סוגריים בחוק הפילוג', math: '3·(x + 5) = 3x + 15' },
      { step: 4, name: 'מינוס לפני סוגריים', math: '\u2212(x \u2212 5) = \u2212x + 5' },
      { step: 6, name: 'מכפלת שני סוגריים', math: '(x + 3)·(x + 2) = x² + 5x + 6' },
      { step: 7, name: 'הוצאת גורם משותף', math: '6x + 15 = 3·(2x + 5)' }
    ],
    bonus: {
      label: 'מכונת הסוגריים 🧱',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל תרגיל פתיחת סוגריים, ובחר את הביטוי הנכון.',
      setup: function (box, ctx) {
        var q = null, answered = false;
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function fmt(a2, a1, a0) {
          var out = '';
          function term(c, body) {
            if (!c) return;
            var neg = c < 0, mag = Math.abs(c);
            var txt = (mag === 1 && body ? '' : String(mag)) + body;
            out += out ? (neg ? ' \u2212 ' : ' + ') + txt : (neg ? '\u2212' : '') + txt;
          }
          term(a2, 'x²'); term(a1, 'x'); term(a0, '');
          return out || '0';
        }
        function roll() {
          var kind = rnd(0, 4), k, n, p, qq, ans, pool, text;
          if (kind === 0) {
            k = rnd(2, 6); n = rnd(2, 9);
            text = k + '·(x + ' + n + ')'; ans = [0, k, k * n];
            pool = [[0, k, n], [0, 1, k * n], [0, k, k + n], [0, k, -k * n]];
          } else if (kind === 1) {
            k = rnd(2, 6); n = rnd(2, 9);
            text = k + '·(x \u2212 ' + n + ')'; ans = [0, k, -k * n];
            pool = [[0, k, -n], [0, k, k * n], [0, 1, -k * n], [0, k, -(k + n)]];
          } else if (kind === 2) {
            k = rnd(1, 4); n = rnd(2, 9);
            text = (k === 1 ? '\u2212' : '\u2212' + k + '·') + '(x \u2212 ' + n + ')'; ans = [0, -k, k * n];
            pool = [[0, -k, -k * n], [0, k, k * n], [0, -k, n + 0 * k], [0, k, -k * n], [0, -k, k * n + 1]];
          } else if (kind === 3) {
            p = rnd(2, 6); qq = rnd(2, 6);
            text = '(x + ' + p + ')·(x + ' + qq + ')'; ans = [1, p + qq, p * qq];
            pool = [[1, 0, p * qq], [1, p + qq, p + qq], [1, p * qq, p + qq], [0, 2, p + qq]];
          } else {
            p = rnd(3, 8); qq = rnd(2, p - 1);
            text = '(x + ' + p + ')·(x \u2212 ' + qq + ')'; ans = [1, p - qq, -p * qq];
            pool = [[1, 0, -p * qq], [1, p + qq, -p * qq], [1, p - qq, p * qq], [1, p + qq, p * qq]];
          }
          var right = fmt(ans[0], ans[1], ans[2]);
          var texts = [right];
          pool.forEach(function (c) { var t = fmt(c[0], c[1], c[2]); if (texts.indexOf(t) < 0 && texts.length < 4) texts.push(t); });
          while (texts.length < 4) {
            var t2 = fmt(ans[0], ans[1] + rnd(1, 3), ans[2] + rnd(-3, 3));
            if (texts.indexOf(t2) < 0) texts.push(t2);
          }
          q = { text: text, right: right, opts: window.NoamGame.shuffle(texts), kind: kind };
          answered = false;
        }
        var HINT = [
          'הכפל את הגורם שבחוץ בכל איבר שבסוגריים.',
          'הכפל את הגורם שבחוץ בכל איבר שבסוגריים, ושים לב לסימן.',
          'המינוס שלפני הסוגריים הופך את כל הסימנים שבפנים.',
          'ארבע מכפלות: כל איבר כופל כל איבר, ואחר כך מחברים את האמצעיים.',
          'ארבע מכפלות: כל איבר כופל כל איבר, ושים לב לסימן של המינוס.'
        ];
        box.innerHTML = '<div class="bTitle">מכונת הסוגריים</div><div class="bSub">בחר את הביטוי השווה, אחרי פתיחת הסוגריים.</div>'
          + '<div class="bChip" data-chip dir="ltr"></div>'
          + '<div data-answers></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">🎲 תרגיל חדש</button>';
        var chip = box.querySelector('[data-chip]'), ans = box.querySelector('[data-answers]');
        var ok = box.querySelector('[data-ok]'), forms = box.querySelector('[data-forms]');
        function draw() {
          chip.textContent = q.text + ' = ?';
          ans.innerHTML = '';
          q.opts.forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'bDice';
            b.style.cssText = 'min-height:44px;min-width:44px;display:block;width:100%;margin:6px 0;direction:ltr;font-family:' + FM;
            b.textContent = t;
            b.addEventListener('click', function () {
              ok.hidden = false;
              if (t === q.right) {
                answered = true;
                ctx.sfx('correct');
                ok.style.color = PAL.good;
                ok.textContent = 'נכון!';
                forms.hidden = false;
                forms.innerHTML = bdi(q.text + ' = ' + q.right);
              } else {
                ctx.sfx('error');
                ok.style.color = BAD;
                ok.textContent = 'לא בדיוק. ' + HINT[q.kind];
                forms.hidden = true;
              }
            });
            ans.appendChild(b);
          });
          ok.hidden = true;
          forms.hidden = true;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); draw(); });
        roll();
        draw();
      }
    }
  });
}());
