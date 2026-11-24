/**
 * חפיפת משולשים ומשפטי החפיפה — an engine game.
 *
 * Congruent triangles can be laid exactly on each other, so every side and
 * angle has a partner, and the order of letters in ΔABC ≅ ΔFDE carries that
 * partnership. Three parts are often enough to lock a triangle (צ.ז.צ, ז.צ.ז,
 * ז.ז.צ, צ.צ.צ), but two sides with a non-included angle can leave room for a
 * second triangle, and three angles only give a similar triangle.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var CA = PAL.dark, CB = '#c2410c', CC = '#6d28d9', CS = '#0f766e';
  var BAD = '#b91c1c', MUTED = '#475569';
  var DEG = Math.PI / 180;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function setAttrs(el, obj) {
    if (!el) return;
    Object.keys(obj).forEach(function (k) { el.setAttribute(k, obj[k]); });
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function polyStr(Q) { return Q.map(function (p) { return r1(p.x) + ',' + r1(p.y); }).join(' '); }
  function centroid(Q) {
    return { x: (Q[0].x + Q[1].x + Q[2].x) / 3, y: (Q[0].y + Q[1].y + Q[2].y) / 3 };
  }
  function unit(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / L, y: dy / L };
  }
  function dist(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }
  function mathT(x, y, size, fill, text, extra) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle" ' + (extra || '') + '>' + text + '</text>';
  }
  function heText(x, y, size, fill, text) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-family="Heebo, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle">' + text + '</text>';
  }
  /** Vertex letter placed just outside its corner. */
  function nameLabel(Q, i, text, fill, d) {
    var c = centroid(Q), u = unit(c, Q[i]);
    return mathT(Q[i].x + u.x * (d || 17), Q[i].y + u.y * (d || 17) + 5, 16, fill, text);
  }
  /** A small tick mark (or n of them) across the middle of side i-j. */
  function tickMarks(Q, i, j, n, col) {
    var a = Q[i], b = Q[j], u = unit(a, b), s = '';
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    for (var k = 0; k < n; k++) {
      var off = (k - (n - 1) / 2) * 6;
      var cx = mx + u.x * off, cy = my + u.y * off;
      s += '<line x1="' + r1(cx - u.y * 7) + '" y1="' + r1(cy + u.x * 7) + '" x2="' + r1(cx + u.y * 7) + '" y2="' + r1(cy - u.x * 7)
        + '" stroke="' + col + '" stroke-width="3" stroke-linecap="round"/>';
    }
    return s;
  }
  /** n concentric arcs at vertex i, between the two sides that meet there. */
  function arcMarks(Q, i, n, col, r0) {
    var V = Q[i], p = Q[(i + 1) % 3], q = Q[(i + 2) % 3], s = '';
    var al = Math.atan2(p.y - V.y, p.x - V.x), be = Math.atan2(q.y - V.y, q.x - V.x);
    var d = be - al;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    for (var k = 0; k < n; k++) {
      var r = (r0 || 20) + k * 6;
      s += '<path d="M' + r1(V.x + r * Math.cos(al)) + ' ' + r1(V.y + r * Math.sin(al)) + ' A' + r + ' ' + r + ' 0 0 ' + (d > 0 ? 1 : 0) + ' '
        + r1(V.x + r * Math.cos(be)) + ' ' + r1(V.y + r * Math.sin(be)) + '" fill="none" stroke="' + col + '" stroke-width="2.5"/>';
    }
    return s;
  }
  /** Angle value written inside the corner, along the bisector. */
  function angLabel(Q, i, text, fill, d) {
    var V = Q[i], u1 = unit(V, Q[(i + 1) % 3]), u2 = unit(V, Q[(i + 2) % 3]);
    var bx = u1.x + u2.x, by = u1.y + u2.y, L = Math.sqrt(bx * bx + by * by) || 1;
    var dd = d || 40;
    return mathT(V.x + bx / L * dd, V.y + by / L * dd + 5, 13, fill, text, 'stroke="#fff" stroke-width="3" paint-order="stroke"');
  }
  /** Triangle with base V0V1 from (x0, y0), angles a0 a1 a2 at V0 V1 V2. Optionally rotated, then centred. */
  function baseTri(a0, a1, a2, L, cx, cy, rot) {
    var b = L * Math.sin(a1 * DEG) / Math.sin(a2 * DEG);
    var Q = [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: b * Math.cos(a0 * DEG), y: -b * Math.sin(a0 * DEG) }];
    if (rot) {
      var c = centroid(Q), co = Math.cos(rot * DEG), si = Math.sin(rot * DEG);
      Q = Q.map(function (p) {
        var x = p.x - c.x, y = p.y - c.y;
        return { x: x * co - y * si, y: x * si + y * co };
      });
    }
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    Q.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var ox = cx - (minX + maxX) / 2, oy = cy - (minY + maxY) / 2;
    return Q.map(function (p) { return { x: p.x + ox, y: p.y + oy }; });
  }
  /** Markup for one labelled triangle. o: { names, angs, ticks:[[i,j,n]], arcs:[n,n,n], fill, stroke } */
  function drawTri(Q, o) {
    var s = '<polygon points="' + polyStr(Q) + '" fill="' + (o.fill || PAL.soft) + '" stroke="' + (o.stroke || INK)
      + '" stroke-width="2.5" stroke-linejoin="round"/>';
    (o.ticks || []).forEach(function (t) { s += tickMarks(Q, t[0], t[1], t[2], CB); });
    (o.arcs || []).forEach(function (n, i) { if (n) s += arcMarks(Q, i, n, CC, 17); });
    (o.angs || []).forEach(function (t, i) { if (t) s += angLabel(Q, i, t, INK, o.angD); });
    (o.names || []).forEach(function (t, i) { if (t) s += nameLabel(Q, i, t, CA); });
    return s;
  }

  /* =====================================================================
     Step 1: lay one triangle on the other
     ===================================================================== */
  var LOCAL = (function () {
    var L = 112, a = 40 * DEG, b = 60 * DEG;
    var ac = L * Math.sin(b) / Math.sin(80 * DEG);
    var Q = [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: ac * Math.cos(a), y: -ac * Math.sin(a) }];
    var c = centroid(Q);
    return Q.map(function (p) { return { x: p.x - c.x, y: p.y - c.y }; });
  }());
  var TARGET = { x: 250, y: 130 }, TARGET_TH = 105;
  var MOVER_NAMES = ['A', 'B', 'C'];
  var TARGET_NAMES = ['F', 'D', 'E'];
  function world(c, th) {
    var co = Math.cos(th * DEG), si = Math.sin(th * DEG);
    return LOCAL.map(function (p) { return { x: c.x + p.x * co - p.y * si, y: c.y + p.x * si + p.y * co }; });
  }
  function overlayScene(ctx) {
    var pos = { x: 110, y: 190 }, th = 0, locked = false, doneOnce = false;
    var TQ = world(TARGET, TARGET_TH);
    var svg = '<polygon points="' + polyStr(TQ) + '" fill="#f1f5f9" stroke="' + MUTED + '" stroke-width="2.5" stroke-dasharray="8 5" stroke-linejoin="round"/>'
      + '<g id="marks"></g>'
      + '<g id="mv" tabindex="0" role="button" aria-label="המשולש הכתום ABC. חצים מזיזים אותו, PageUp ו־PageDown מסובבים אותו" style="cursor:grab">'
      + '<polygon id="mPoly" points="" fill="' + PAL.warmSoft + '" fill-opacity=".92" stroke="' + CB + '" stroke-width="3" stroke-linejoin="round"/></g>'
      + '<g id="labs"></g>'
      + heText(201, 306, 13, MUTED, 'המשולש המקווקו הוא היעד')
      ;
    ctx.draw(svg);
    var mv = ctx.el('mv'), mPoly = ctx.el('mPoly'), labs = ctx.el('labs'), marks = ctx.el('marks');
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>סיבוב המשולש הכתום</b><span class="math" dir="ltr" data-v="th" style="color:' + CB + '"></span></div>'
      + '<div><b>התאמה</b><span data-v="st" style="color:' + INK + '"></span></div></div>');
    function readout() {
      box.querySelector('[data-v="th"]').textContent = th + '°';
      box.querySelector('[data-v="st"]').textContent = locked ? 'כל הקודקודים נופלים זה על זה' : (th === TARGET_TH ? 'הכיוון נכון' : 'עוד לא');
    }
    function render() {
      var Q = world(pos, th);
      mPoly.setAttribute('points', polyStr(Q));
      var s = '';
      if (locked) {
        s += nameLabel(TQ, 0, 'A↔F', CB, 24) + nameLabel(TQ, 1, 'B↔D', CB, 24) + nameLabel(TQ, 2, 'C↔E', CB, 24);
      } else {
        for (var i = 0; i < 3; i++) s += nameLabel(Q, i, MOVER_NAMES[i], CB);
        for (var j = 0; j < 3; j++) s += nameLabel(TQ, j, TARGET_NAMES[j], MUTED);
      }
      labs.innerHTML = s;
      readout();
    }
    function reveal() {
      var s = '';
      [[0, 1, 1], [1, 2, 2], [2, 0, 3]].forEach(function (t) { s += tickMarks(TQ, t[0], t[1], t[2], CS); });
      [1, 2, 3].forEach(function (n, i) { s += arcMarks(TQ, i, n, CC, 17); });
      marks.innerHTML = s;
    }
    function check() {
      var d = dist(pos, TARGET);
      var match = th === TARGET_TH;
      if (match && d <= 12) {
        pos = { x: TARGET.x, y: TARGET.y };
        locked = true;
        reveal();
        render();
        ctx.caption(m('ΔABC ≅ ΔFDE'));
        ctx.note('המשולשים מתלכדים. הצלע ' + m('AB') + ' נופלת על ' + m('FD') + ', הצלע ' + m('BC') + ' על ' + m('DE') + ', והצלע ' + m('CA') + ' על ' + m('EF')
          + '. הזוויות ' + m('A') + ', ' + m('B') + ', ' + m('C') + ' נופלות על ' + m('F') + ', ' + m('D') + ', ' + m('E') + '. לכן כותבים ' + m('ΔABC ≅ ΔFDE') + ': סדר האותיות הוא ההתאמה.', 'good');
        if (!doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
        return;
      }
      if (match) {
        ctx.note('הכיוון כבר נכון. עכשיו הזז את המשולש הכתום אל המשולש המקווקו, עד שהקודקודים נופלים זה על זה.');
      } else if (d <= 25) {
        ctx.note('המשולשים כמעט באותו מקום, אבל הקודקודים לא נופלים זה על זה כי הכיוון שונה. סובב את המשולש הכתום ולא רק תזיז אותו.');
      } else {
        ctx.note('התאמה מתחילה בהזזה וגם בסיבוב. הזז את המשולש הכתום אל המקווקו וסובב אותו עד שהכיוון זהה.');
      }
    }
    function commit(nx, ny, nth, quiet) {
      if (locked) {
        ctx.sfx('error');
        ctx.note('המשולשים כבר מתלכדים. כדי לנסות שוב לחץ "מההתחלה".');
        return;
      }
      nx = clamp(nx, 90, 312);
      ny = clamp(ny, 80, 230);
      nth = ((nth % 360) + 360) % 360;
      if (nx === pos.x && ny === pos.y && nth === th) {
        if (!quiet) { ctx.sfx('error'); ctx.note('זה קצה האזור. הזז לכיוון אחר או סובב.'); }
        return;
      }
      pos = { x: nx, y: ny };
      th = nth;
      ctx.sfx('tick');
      render();
      check();
    }
    function reset() {
      locked = false;
      pos = { x: 110, y: 190 };
      th = 0;
      marks.innerHTML = '';
      ctx.caption('');
      render();
      ctx.sfx('click');
      ctx.note('המשולש הכתום חופף למקווקו, אבל מוטל אחרת. הזז וסובב אותו עד שיתלכד.');
    }
    var STEP = 10, BIG = 20, ROT = 15;
    mv.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') commit(pos.x - STEP, pos.y, th);
      else if (k === 'ArrowRight') commit(pos.x + STEP, pos.y, th);
      else if (k === 'ArrowUp') commit(pos.x, pos.y - STEP, th);
      else if (k === 'ArrowDown') commit(pos.x, pos.y + STEP, th);
      else if (k === 'PageUp' || k === 'r' || k === 'R') commit(pos.x, pos.y, th + ROT);
      else if (k === 'PageDown' || k === 'e' || k === 'E') commit(pos.x, pos.y, th - ROT);
      else if (k === 'Home') { e.preventDefault(); reset(); return; }
      else used = false;
      if (used) e.preventDefault();
    });
    var off = { x: 0, y: 0 };
    ctx.drag(mv, {
      start: function (x, y) { off = { x: pos.x - x, y: pos.y - y }; },
      move: function (x, y) { commit(Math.round(x + off.x), Math.round(y + off.y), th, true); },
      end: function () { if (!locked) check(); }
    });
    ctx.button('◀ שמאלה', function () { commit(pos.x - BIG, pos.y, th); }, { id: 'goL' });
    ctx.button('ימינה ▶', function () { commit(pos.x + BIG, pos.y, th); }, { id: 'goR' });
    ctx.button('▲ למעלה', function () { commit(pos.x, pos.y - BIG, th); }, { id: 'goU' });
    ctx.button('▼ למטה', function () { commit(pos.x, pos.y + BIG, th); }, { id: 'goD' });
    ctx.button('↺ סובב שמאלה', function () { commit(pos.x, pos.y, th - ROT); }, { id: 'rotL', target: 'rot' });
    ctx.button('↻ סובב ימינה', function () { commit(pos.x, pos.y, th + ROT); }, { id: 'rotR' });
    ctx.button('מההתחלה', reset, { ghost: true, id: 'resetBtn' });
    render();
    ctx.note('המשולש הכתום חופף למקווקו, אבל מוטל אחרת. הזז וסובב אותו עד שיתלכד.');
  }

  /* =====================================================================
     Step 3: which three parts lock the triangle
     ===================================================================== */
  var TA = 50, TB = 60, TCc = 70;
  var VANG = [TA, TB, TCc];
  var TRI = (function () {
    var c = 190, b = c * Math.sin(TB * DEG) / Math.sin(TCc * DEG);
    return [{ x: 55, y: 250 }, { x: 245, y: 250 }, { x: 55 + b * Math.cos(TA * DEG), y: 250 - b * Math.sin(TA * DEG) }];
  }());
  var VN = ['A', 'B', 'C'];
  var SIDE_ENDS = { AB: [0, 1], BC: [1, 2], CA: [2, 0] };
  var OPP_SIDE = ['BC', 'CA', 'AB'];
  var ALL_KEYS = ['AB', 'BC', 'CA', 'A', 'B', 'C'];
  function isSide(k) { return k.length === 2; }
  /** What do these three given parts do to the triangle? */
  function classify(sel) {
    if (sel.length < 3) return null;
    var sides = sel.filter(isSide), angs = sel.filter(function (k) { return !isSide(k); });
    var n = sides.length;
    if (n === 3) return { kind: 'צ.צ.צ', forced: true, cat: 'lock', text: 'שלוש הצלעות קובעות משולש אחד בלבד. זה משפט החפיפה צ.צ.צ.' };
    if (n === 0) {
      return { kind: 'ז.ז.ז', forced: false, cat: 'aaa', alt: 'scale', text: 'שלוש זוויות נותנות משולש דומה בגודל אחר (הכתום מוגדל פי ' + m('1.4') + '), לא משולש חופף. ז.ז.ז אינו משפט חפיפה.' };
    }
    if (n === 2) {
      var i = VN.indexOf(angs[0]);
      var adj = sides.filter(function (s) { return s !== OPP_SIDE[i]; });
      if (adj.length === 2) return { kind: 'צ.ז.צ', forced: true, cat: 'lock', text: 'שתי צלעות והזווית שביניהן נועלות את המשולש. זה משפט החפיפה צ.ז.צ.' };
      var y = adj[0];
      var ends = SIDE_ENDS[y];
      var j = ends[0] === i ? ends[1] : ends[0];
      var k = 3 - i - j;
      var dTrue = dist(TRI[i], TRI[k]);
      var yLen = dist(TRI[i], TRI[j]);
      var d2 = 2 * yLen * Math.cos(VANG[i] * DEG) - dTrue;
      var amb = d2 > 1 && Math.abs(d2 - dTrue) > 1;
      if (amb) {
        var u = unit(TRI[i], TRI[k]);
        return {
          kind: 'צ.צ.ז', forced: false, cat: 'ssa', k: k,
          alt: { x: TRI[i].x + u.x * d2, y: TRI[i].y + u.y * d2 },
          text: 'שתי צלעות וזווית שאינה ביניהן, והיא מול הצלע הקטנה מבין השתיים. אפשר להשלים משולש שני, שונה (הכתום), עם אותם נתונים. אין משפט חפיפה כזה.'
        };
      }
      return { kind: 'צ.צ.ז', forced: true, cat: 'lock', text: 'שתי צלעות וזווית שאינה ביניהן, אבל כאן הזווית מול הצלע הגדולה מבין השתיים, ולכן יוצא משולש אחד בלבד. זה מקרה מיוחד, ואי אפשר לסמוך עליו בלי לבדוק איזו צלע גדולה יותר.' };
    }
    var s1 = sides[0];
    var chosen = angs.map(function (a) { return VN.indexOf(a); });
    var third = 3 - chosen[0] - chosen[1];
    if (OPP_SIDE[third] === s1) return { kind: 'ז.צ.ז', forced: true, cat: 'lock', text: 'שתי זוויות והצלע שביניהן נועלות את המשולש. זה משפט החפיפה ז.צ.ז.' };
    return { kind: 'ז.ז.צ', forced: true, cat: 'lock', text: 'שתי זוויות וצלע שאינה ביניהן: הזווית השלישית ידועה (' + m('180°') + ' פחות השתיים), ולכן זה כמו ז.צ.ז. זה משפט החפיפה ז.ז.צ.' };
  }
  function partName(k) { return isSide(k) ? 'הצלע ' + m(k) : 'הזווית ' + m('∠' + k); }
  function theoremScene(ctx) {
    var sel = [], seen = { lock: false, ssa: false, aaa: false }, doneOnce = false;
    function btnHtml(k) {
      var lab = isSide(k) ? 'צלע ' + bdi(k) : 'זווית ' + bdi('∠' + k);
      var al = isSide(k) ? 'צלע ' + k : 'זווית ' + k;
      return '<button type="button" class="pbtn" data-k="' + k + '" aria-pressed="false" aria-label="' + al + '" '
        + 'style="min-height:44px;min-width:44px;flex:1 1 0;padding:8px 6px;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;border:2px solid ' + PAL.line + ';background:#fff;color:' + INK + '">'
        + lab + '</button>';
    }
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>סוג הנתונים</b><span data-v="kind" style="color:' + INK + '">בחר שלושה</span></div>'
      + '<div><b>האם המשולש נקבע?</b><span data-v="lock" style="color:' + INK + '">עוד לא נבחר</span></div></div>'
      + '<div style="display:flex;gap:8px;margin-top:8px" role="group" aria-label="צלעות">' + ['AB', 'BC', 'CA'].map(btnHtml).join('') + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:8px" role="group" aria-label="זוויות">' + ['A', 'B', 'C'].map(btnHtml).join('') + '</div>'
      + '<div data-v="seen" style="margin-top:8px;font-weight:700;font-size:14px;color:' + MUTED + '"></div>');
    ctx.register('parts', box);
    var btns = {};
    box.querySelectorAll('.pbtn').forEach(function (b) { btns[b.getAttribute('data-k')] = b; });
    function seenText() {
      function mk(v, t) { return (v ? '✓ ' : '○ ') + t; }
      box.querySelector('[data-v="seen"]').textContent = 'נבדקו: ' + mk(seen.lock, 'נתונים שנועלים') + ' · ' + mk(seen.ssa, 'צ.צ.ז עם שני משולשים') + ' · ' + mk(seen.aaa, 'שלוש זוויות');
    }
    function render() {
      var res = classify(sel);
      var h = '';
      if (res && res.alt) {
        if (res.alt === 'scale') {
          var big = [TRI[0], { x: TRI[0].x + (TRI[1].x - TRI[0].x) * 1.4, y: TRI[0].y }, { x: TRI[0].x + (TRI[2].x - TRI[0].x) * 1.4, y: TRI[0].y + (TRI[2].y - TRI[0].y) * 1.4 }];
          h += '<polygon points="' + polyStr(big) + '" fill="#ffedd5" fill-opacity=".8" stroke="' + CB + '" stroke-width="2.5" stroke-dasharray="8 5" stroke-linejoin="round"/>';
        } else {
          var ij = [0, 1, 2].filter(function (q) { return q !== res.k; });
          var Q2 = [TRI[0], TRI[1], TRI[2]];
          Q2[res.k] = res.alt;
          h += '<polygon points="' + polyStr(Q2) + '" fill="#ffedd5" fill-opacity=".85" stroke="' + CB + '" stroke-width="2.5" stroke-dasharray="8 5" stroke-linejoin="round"/>';
          h += nameLabel(Q2, res.k, VN[res.k] + '′', CB, 16);
          ij = null;
        }
      }
      h += '<polygon points="' + polyStr(TRI) + '" fill="' + PAL.soft + '" fill-opacity=".85" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
      sel.forEach(function (k) {
        if (isSide(k)) {
          var e = SIDE_ENDS[k], a = TRI[e[0]], b = TRI[e[1]];
          h += '<line x1="' + r1(a.x) + '" y1="' + r1(a.y) + '" x2="' + r1(b.x) + '" y2="' + r1(b.y) + '" stroke="' + CS + '" stroke-width="6" stroke-linecap="round"/>';
          h += tickMarks(TRI, e[0], e[1], 1, '#fff');
          var c = centroid(TRI), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, u = unit(c, mid);
          h += mathT(mid.x + u.x * 20, mid.y + u.y * 20 + 5, 14, CS, k);
        } else {
          var vi = VN.indexOf(k);
          h += arcMarks(TRI, vi, 2, CC, 22);
          h += angLabel(TRI, vi, VANG[vi] + '°', CC, 48);
        }
      });
      VN.forEach(function (t, i) { h += nameLabel(TRI, i, t, CA, 18); });
      if (res) h += heText(300, 26, 16, res.forced ? CS : CB, res.forced ? 'משולש אחד בלבד' : 'יש יותר ממשולש אחד');
      else h += heText(300, 26, 15, MUTED, 'בחר שלושה נתונים');
      ctx.draw(h);
      Object.keys(btns).forEach(function (k) {
        var on = sel.indexOf(k) >= 0;
        btns[k].setAttribute('aria-pressed', String(on));
        btns[k].style.background = on ? CA : '#fff';
        btns[k].style.color = on ? '#fff' : INK;
        btns[k].style.borderColor = on ? CA : PAL.line;
      });
      box.querySelector('[data-v="kind"]').textContent = res ? res.kind : (sel.length ? 'עוד ' + (3 - sel.length) : 'בחר שלושה');
      box.querySelector('[data-v="lock"]').textContent = res ? (res.forced ? 'כן, משולש יחיד' : 'לא, יש עוד משולש') : 'עוד לא נבחר';
      seenText();
      ctx.caption(res ? res.kind : '');
    }
    function toggle(k) {
      var at = sel.indexOf(k), dropped = null;
      if (at >= 0) { sel.splice(at, 1); ctx.sfx('tick'); }
      else {
        if (sel.length === 3) dropped = sel.shift();
        sel.push(k);
        ctx.sfx('click');
      }
      render();
      var res = classify(sel);
      if (!res) {
        ctx.note('בחרת ' + sel.length + ' מתוך שלושה נתונים. בחר עוד ' + (3 - sel.length) + '.');
        return;
      }
      var lead = dropped ? partName(dropped) + ' הוסרה כדי לפנות מקום. ' : '';
      ctx.note(lead + res.text, res.forced ? 'good' : null);
      seen[res.cat] = true;
      seenText();
      if (seen.lock && seen.ssa && seen.aaa && !doneOnce) {
        doneOnce = true;
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.solved();
      }
    }
    Object.keys(btns).forEach(function (k) {
      btns[k].addEventListener('click', function () { toggle(k); });
    });
    ctx.button('נקה בחירה', function () {
      sel = [];
      ctx.sfx('click');
      render();
      ctx.note('בחר שלושה נתונים מבין שש הצלעות והזוויות. בדוק אילו נתונים נועלים את המשולש.');
    }, { ghost: true, id: 'clearBtn', target: 'clear' });
    render();
    ctx.note('בחר שלושה נתונים מבין שש הצלעות והזוויות. בדוק אילו נתונים נועלים את המשולש.');
  }

  /* =====================================================================
     Step 5: put the proof in order
     ===================================================================== */
  var PROOF = [
    { id: 1, rank: 0, html: 'נתון: ' + bdi('M') + ' אמצע ' + bdi('AB') + ', לכן ' + bdi('AM = MB'), plain: 'נתון: M אמצע AB, לכן AM שווה MB' },
    { id: 2, rank: 0, html: 'נתון: ' + bdi('M') + ' אמצע ' + bdi('CD') + ', לכן ' + bdi('CM = MD'), plain: 'נתון: M אמצע CD, לכן CM שווה MD' },
    { id: 3, rank: 0, html: bdi('∠AMC = ∠BMD') + ' כי הן זוויות קודקודיות', plain: 'הזוויות AMC ו־BMD שוות כי הן קודקודיות' },
    { id: 4, rank: 1, html: 'בשני המשולשים שתי צלעות והזווית שביניהן שוות', plain: 'בשני המשולשים שתי צלעות והזווית שביניהן שוות' },
    { id: 5, rank: 2, html: 'לכן ' + bdi('ΔAMC ≅ ΔBMD') + ' לפי צ.ז.צ', plain: 'לכן המשולשים חופפים לפי צ.ז.צ' }
  ];
  function proofFigure() {
    var A = { x: 80, y: 30 }, B = { x: 320, y: 190 }, C = { x: 90, y: 180 }, D = { x: 310, y: 40 }, M = { x: 200, y: 110 };
    var s = '<polygon points="' + polyStr([A, M, C]) + '" fill="' + PAL.soft + '" stroke="none"/>'
      + '<polygon points="' + polyStr([B, M, D]) + '" fill="#ffedd5" stroke="none"/>'
      + '<line x1="80" y1="30" x2="320" y2="190" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="90" y1="180" x2="310" y2="40" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
    function tk(P1, P2, n) { return tickMarks([P1, P2, M], 0, 1, n, CS); }
    s += tk(A, M, 1) + tk(M, B, 1) + tk(C, M, 2) + tk(M, D, 2);
    s += arcMarks([M, A, C], 0, 1, CC, 24) + arcMarks([M, D, B], 0, 1, CC, 24);
    s += mathT(A.x - 12, A.y + 2, 16, CA, 'A') + mathT(B.x + 12, B.y + 14, 16, CA, 'B') + mathT(C.x - 12, C.y + 14, 16, CA, 'C')
      + mathT(D.x + 12, D.y + 2, 16, CA, 'D') + mathT(M.x, M.y - 12, 16, CA, 'M');
    return s;
  }
  function proofScene(ctx) {
    var order = [4, 1, 5, 3, 2], locked = false, doneOnce = false;
    ctx.draw(proofFigure());
    var byId = {};
    PROOF.forEach(function (p) { byId[p.id] = p; });
    var box = ctx.extra('<div id="proof" role="list" aria-label="שלבי ההוכחה" style="display:flex;flex-direction:column;gap:8px"></div>');
    var list = box.querySelector('#proof');
    var rows = {};
    function grip(id) {
      return '<div class="grip" data-id="' + id + '" tabindex="0" role="button" aria-label="" '
        + 'style="min-height:48px;min-width:44px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:grab;touch-action:none;color:' + MUTED + ';border-radius:10px;user-select:none">⠿</div>';
    }
    function mini(dir, id) {
      return '<button type="button" class="mv" data-dir="' + dir + '" data-id="' + id + '" style="min-height:44px;min-width:44px;font-size:18px;font-weight:800;border-radius:10px;border:2px solid ' + PAL.line + ';background:#fff;color:' + INK + ';cursor:pointer"></button>';
    }
    PROOF.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'prow';
      row.setAttribute('role', 'listitem');
      row.setAttribute('data-id', String(p.id));
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;border:2px solid ' + PAL.line + ';border-radius:14px;background:#fff;min-height:56px';
      row.innerHTML = grip(p.id)
        + '<span class="num" dir="ltr" style="font-family:Secular One,sans-serif;font-size:18px;min-width:22px;text-align:center;color:' + CA + '"></span>'
        + '<span style="flex:1;font-size:14.5px;line-height:1.4;font-weight:700">' + p.html + '</span>'
        + mini('up', p.id) + mini('down', p.id);
      row.querySelectorAll('.mv').forEach(function (b) {
        b.textContent = b.getAttribute('data-dir') === 'up' ? '▲' : '▼';
        b.setAttribute('aria-label', (b.getAttribute('data-dir') === 'up' ? 'הזז למעלה: ' : 'הזז למטה: ') + p.plain);
      });
      rows[p.id] = row;
    });
    function paintRows() {
      order.forEach(function (id) { list.appendChild(rows[id]); });
      order.forEach(function (id, i) {
        var row = rows[id];
        row.querySelector('.num').textContent = String(i + 1);
        row.querySelector('.grip').setAttribute('aria-label', 'שלב ' + (i + 1) + ' מתוך 5: ' + byId[id].plain + '. חצים למעלה ולמטה מזיזים אותו');
        row.style.borderColor = locked ? PAL.good : PAL.line;
        row.style.background = locked ? PAL.goodSoft : '#fff';
      });
    }
    function moveTo(id, to) {
      if (locked) {
        ctx.sfx('error');
        ctx.note('ההוכחה כבר מסודרת. כדי לנסות שוב לחץ "ערבב".');
        return false;
      }
      var at = order.indexOf(id);
      to = clamp(to, 0, order.length - 1);
      if (to === at) return false;
      order.splice(at, 1);
      order.splice(to, 0, id);
      ctx.sfx('tick');
      paintRows();
      return true;
    }
    function focusRow(id, what) {
      var el = rows[id].querySelector(what);
      if (el) el.focus();
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.mv');
      if (!b) return;
      var id = Number(b.getAttribute('data-id')), dir = b.getAttribute('data-dir');
      var moved = moveTo(id, order.indexOf(id) + (dir === 'up' ? -1 : 1));
      if (!moved && !locked) { ctx.sfx('error'); ctx.note('השלב כבר ' + (dir === 'up' ? 'ראשון' : 'אחרון') + ' ברשימה.'); }
      focusRow(id, '.mv[data-dir="' + dir + '"]');
    });
    list.addEventListener('keydown', function (e) {
      var g = e.target.closest('.grip');
      if (!g) return;
      var id = Number(g.getAttribute('data-id')), at = order.indexOf(id);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); moveTo(id, at - 1); focusRow(id, '.grip'); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); moveTo(id, at + 1); focusRow(id, '.grip'); }
      else if (e.key === 'Home') { e.preventDefault(); moveTo(id, 0); focusRow(id, '.grip'); }
      else if (e.key === 'End') { e.preventDefault(); moveTo(id, order.length - 1); focusRow(id, '.grip'); }
    });
    /* pointer drag: the grip is captured, so no listener on window or document is needed */
    var dragId = null;
    list.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.grip');
      if (!g || locked) return;
      dragId = Number(g.getAttribute('data-id'));
      try { g.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      ctx.dragging(true);
    });
    list.addEventListener('pointermove', function (e) {
      if (dragId == null) return;
      var to = order.indexOf(dragId);
      for (var i = 0; i < order.length; i++) {
        var r = rows[order[i]].getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) { to = i; break; }
      }
      if (to !== order.indexOf(dragId)) moveTo(dragId, to);
    });
    function endDrag() {
      if (dragId == null) return;
      dragId = null;
      ctx.dragging(false);
    }
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);
    function verify() {
      if (locked) return;
      var ranks = order.map(function (id) { return byId[id].rank; });
      var ok = true;
      for (var i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) ok = false;
      if (ok) {
        locked = true;
        paintRows();
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.caption(m('ΔAMC ≅ ΔBMD'));
        ctx.note('ההוכחה מסודרת: שלושה נתונים (שתי צלעות וזוויות קודקודיות), אחר כך צ.ז.צ, ורק בסוף המסקנה.', 'good');
        if (!doneOnce) { doneOnce = true; ctx.solved(); }
        return;
      }
      ctx.sfx('error');
      if (order[order.length - 1] !== 5) {
        ctx.note('המסקנה ' + m('ΔAMC ≅ ΔBMD') + ' באה אחרונה: קודם צריך להראות את הנתונים ואת המשפט, ורק אז אפשר לקבוע חפיפה.');
      } else {
        ctx.note('אי אפשר לומר ששתי צלעות והזווית שביניהן שוות לפני שהראית את שלושת הנתונים: שתי הצלעות והזוויות הקודקודיות.');
      }
    }
    ctx.button('בדוק את הסדר', verify, { id: 'checkBtn', target: 'check' });
    ctx.button('ערבב', function () {
      locked = false;
      order = [4, 1, 5, 3, 2];
      paintRows();
      ctx.caption('');
      ctx.sfx('click');
      ctx.note('סדר את השלבים: קודם הנתונים, אחר כך המשפט, ובסוף המסקנה.');
    }, { ghost: true, id: 'shuffleBtn' });
    paintRows();
    ctx.note('סדר את השלבים: קודם הנתונים, אחר כך המשפט, ובסוף המסקנה.');
  }

  /* =====================================================================
     Quiz pictures
     ===================================================================== */
  function pictureMatch(ctx) {
    var k = 160;
    var Q1 = baseTri(35, 75, 70, k * Math.sin(70 * DEG), 105, 118, 0);
    var Q2 = baseTri(70, 35, 75, k * Math.sin(75 * DEG), 297, 118, 0);
    ctx.draw(drawTri(Q1, { names: ['A', 'B', 'C'], angs: ['35°', '75°', '70°'] })
      + drawTri(Q2, { names: ['D', 'E', 'F'], angs: ['70°', '35°', '75°'] }));
  }
  function pictureSSA(ctx) {
    var X = 40, y = 100, x = 80, s = 1.5;
    var root = Math.sqrt(x * x - y * y * Math.pow(Math.sin(X * DEG), 2));
    var d1 = y * Math.cos(X * DEG) + root, d2 = y * Math.cos(X * DEG) - root;
    function build(x0, d) {
      return [{ x: x0, y: 205 }, { x: x0 + y * s, y: 205 }, { x: x0 + d * s * Math.cos(X * DEG), y: 205 - d * s * Math.sin(X * DEG) }];
    }
    var Q1 = build(30, d1), Q2 = build(222, d2);
    ctx.draw(drawTri(Q1, { names: ['A', 'B', 'C'], ticks: [[0, 1, 1], [1, 2, 2]], arcs: [1, 0, 0], angs: ['40°', '', ''], angD: 48 })
      + drawTri(Q2, { names: ['D', 'E', 'F'], ticks: [[0, 1, 1], [1, 2, 2]], arcs: [1, 0, 0], angs: ['40°', '', ''], angD: 48 }));
  }
  function pictureAAA(ctx) {
    var Q1 = baseTri(50, 60, 70, 100, 110, 150, 0);
    var Q2 = baseTri(50, 60, 70, 170, 285, 150, 0);
    ctx.draw(drawTri(Q1, { names: ['A', 'B', 'C'], arcs: [1, 2, 3], angs: ['50°', '60°', '70°'], angD: 36 })
      + drawTri(Q2, { names: ['D', 'E', 'F'], arcs: [1, 2, 3], angs: ['50°', '60°', '70°'], angD: 46 }));
  }
  function pictureASA(ctx) {
    var Q1 = baseTri(40, 65, 75, 130, 105, 118, 0);
    var Q2 = baseTri(40, 65, 75, 130, 297, 118, 200);
    ctx.draw(drawTri(Q1, { names: ['A', 'B', 'C'], ticks: [[0, 1, 1]], arcs: [1, 2, 0], angs: ['40°', '65°', ''], angD: 46 })
      + drawTri(Q2, { names: ['D', 'E', 'F'], ticks: [[0, 1, 1]], arcs: [1, 2, 0], angs: ['40°', '65°', ''], angD: 46 }));
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'חפיפת משולשים',
      sub: 'מניחים משולש על משולש, ובודקים אילו נתונים באמת מספיקים כדי להכריע.',
      tip: 'שלום, אני אליהו. היום נבדוק מתי שני משולשים הם בדיוק אותו משולש.',
      emoji: '🔺',
      eq: m('ΔABC ≅ ΔFDE'),
      note: 'משולשים חופפים אפשר להניח זה על זה בלי רווח: כל צלע וכל זווית מוצאות בן זוג שווה. סדר האותיות בכתיבה קובע מי בן הזוג של מי. ובדרך כלל מספיקים שלושה נתונים נכונים כדי לדעת שהם חופפים.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מניחים משולש על משולש',
      sub: 'הזז וסובב את המשולש הכתום בגרירה, בכפתורים או בחיצים, עד שהוא מתלכד עם המקווקו.',
      tip: 'הכתום חופף למקווקו אבל מוטל אחרת. הזז אותו, וסובב אותו ב־PageUp ו־PageDown או בכפתורי הסיבוב.',
      cue: 'התאם את שני המשולשים עד שהם מתלכדים',
      cueDone: 'המשולשים מתלכדים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 320],
      alt: 'משולש כתום שאפשר להזיז ולסובב, ומשולש מקווקו אפור כיעד. כשהם מתלכדים רואים אילו קודקודים נופלים זה על זה',
      nudge: { target: 'rot', text: 'לחץ על כפתורי הסיבוב כדי לסובב את המשולש הכתום, ואז הזז אותו אל המקווקו.' },
      setup: overlayScene
    },
    {
      mode: 'quiz',
      tA: 'באיזה סדר כותבים',
      sub: 'המשולשים ' + m('ABC') + ' ו־' + m('DEF') + ' חופפים. איך נכון לכתוב את החפיפה, כך שכל אות תהיה מול בת הזוג שלה?',
      tip: 'בחפיפה כתובה האות הראשונה מול הראשונה, השנייה מול השנייה. התחל מהזווית ' + m('A') + ' ומצא אותה בשני.',
      btn: 'המשך ←',
      aspect: [402, 230],
      alt: 'שני משולשים חופפים. במשולש הראשון הזוויות בקודקודים A, B, C הן 35, 75 ו־70 מעלות. במשולש השני הזוויות בקודקודים D, E, F הן 70, 35 ו־75 מעלות',
      setup: pictureMatch,
      win: 'נכון. כל אות נכתבה מול הזווית השווה לה.',
      wrongSay: 'מצא את הזווית של 35° בכל משולש, ואז את 75° ואת 70°.',
      opts: [
        { t: m('ΔABC ≅ ΔDEF'), f: 'כתבת את האותיות בסדר האלפבית. אבל הזווית ' + m('A = 35°') + ' מול ' + m('E') + ' ולא מול ' + m('D') + ', ולכן סדר האותיות צריך לעקוב אחרי הזוויות.' },
        { t: m('ΔABC ≅ ΔEFD'), c: true, f: m('A = 35°') + ' כמו ' + m('E') + ', ' + m('B = 75°') + ' כמו ' + m('F') + ', ו־' + m('C = 70°') + ' כמו ' + m('D') + '. לכן ' + m('ΔABC ≅ ΔEFD') + '.' },
        { t: m('ΔABC ≅ ΔFDE'), f: 'כאן ' + m('A') + ' מול ' + m('F') + ' שהיא ' + m('75°') + ', אבל ' + m('A') + ' היא ' + m('35°') + '. התאמת את האותיות בסבב אחד לכיוון הלא נכון.' },
        { t: m('ΔABC ≅ ΔDFE'), f: 'כאן ' + m('A') + ' מול ' + m('D') + ' שהיא ' + m('70°') + ', אבל ' + m('A') + ' היא ' + m('35°') + '. מצא קודם את בת הזוג של ' + m('A') + '.' }
      ],
      hints: [
        'סדר האותיות בכתיבת החפיפה הוא ההתאמה: האות הראשונה מול הראשונה.',
        'מצא איזו אות בשני המשולשים נמצאת בזווית ' + m('35°') + ', ואיזו בזווית ' + m('75°') + '.',
        m('A') + ' מול ' + m('E') + ', ו־' + m('B') + ' מול ' + m('F') + '. מי נשארה ל־' + m('C') + '?'
      ]
    },
    {
      mode: 'scene',
      tA: 'שלושה נתונים שנועלים',
      sub: 'בחר שלושה נתונים בכפתורים או במקלדת, ובדוק אם המשולש נקבע או שאפשר לצייר עוד אחד.',
      tip: 'בחר שלוש צלעות או זוויות. אם יש משולש כתום מקווקו, הנתונים לא מספיקים.',
      cue: 'בדוק נתונים נועלים, צ.צ.ז עם שני משולשים, ושלוש זוויות',
      cueDone: 'בדקת את שלושת המקרים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 300],
      alt: 'משולש ABC עם זוויות 50, 60 ו־70 מעלות. הנתונים שנבחרו מודגשים, ואם הם לא קובעים משולש יחיד מצויר משולש נוסף בכתום',
      nudge: { target: 'parts', text: 'לחץ על שלושה כפתורים: למשל צלע, זווית וצלע, ותראה אם המשולש נקבע.' },
      setup: theoremScene
    },
    {
      mode: 'quiz',
      tA: 'שתי צלעות וזווית',
      sub: 'בציור שתי צלעות שוות בהתאמה: ' + m('AB = DE') + ' ו־' + m('BC = EF') + ', וזווית ' + m('A = D = 40°') + '. האם אפשר להסיק ' + m('ΔABC ≅ ΔDEF') + '?',
      tip: 'בדוק איפה נמצאת הזווית השווה. האם היא בין שתי הצלעות השוות?',
      btn: 'המשך ←',
      aspect: [402, 230],
      alt: 'שני משולשים. בכל אחד הצלע AB או DE מסומנת בקו אחד, הצלע BC או EF בשני קווים, והזווית בקודקוד A או D מסומנת בקשת. המשולשים שונים זה מזה',
      setup: pictureSSA,
      win: 'נכון. זווית שאינה בין שתי הצלעות לא מבטיחה חפיפה.',
      wrongSay: 'הזווית ' + m('A') + ' נמצאת בין ' + m('AB') + ' ל־' + m('AC') + '. האם ' + m('BC') + ' אחת מהן?',
      opts: [
        { t: 'כן, לפי צ.ז.צ, כי יש שתי צלעות וזווית שוות', f: 'ב־צ.ז.צ הזווית חייבת להיות בין שתי הצלעות. כאן ' + m('BC') + ' מול הזווית ' + m('A') + ', ולא בצידה, ולכן זה לא צ.ז.צ.' },
        { t: 'כן, כי שתי צלעות וזווית אחת שוות מספיקות תמיד', f: 'לא תמיד. בציור שני המשולשים שונים, למרות שאותם שלושה נתונים שווים בהם.' },
        { t: 'לא בהכרח: הזווית אינה בין הצלעות, ואפשר לבנות שני משולשים שונים', c: true, f: 'נכון: הזווית ' + m('A') + ' אינה בין ' + m('AB') + ' ל־' + m('BC') + '. אותה זווית ואותן צלעות מאפשרות שני משולשים שונים, ולכן צ.צ.ז אינו משפט חפיפה.' },
        { t: 'לא, כי חפיפה דורשת ששש הזוויות והצלעות יהיו נתונות', f: 'אין צורך בשש. משפטי החפיפה מבטיחים חפיפה משלושה נתונים נכונים, אבל לא מכל שלושה נתונים.' }
      ],
      hints: [
        'במשפט צ.ז.צ הזווית נמצאת בין שתי הצלעות.',
        'בדוק בין אילו שתי צלעות נמצאת הזווית ' + m('A') + '.',
        'הצלעות הנתונות הן ' + m('AB') + ' ו־' + m('BC') + ', והזווית ' + m('A') + ' אינה ביניהן.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מסדרים הוכחת חפיפה',
      sub: 'סדר את שלבי ההוכחה בגרירה, בכפתורי החצים או בחיצים במקלדת, ואז בדוק.',
      tip: 'קודם הנתונים, אחר כך המשפט, ובסוף המסקנה. לחץ על הידית ⠿ והזז אותה בחיצים.',
      cue: 'סדר את חמשת השלבים ולחץ "בדוק את הסדר"',
      cueDone: 'ההוכחה מסודרת. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 220],
      alt: 'שני קטעים ' + 'AB ו־CD חותכים בנקודה M שהיא אמצע שניהם. ציור שני המשולשים AMC ו־BMD עם סימוני צלעות שוות וזוויות קודקודיות',
      nudge: { target: 'check', text: 'הזז את השלבים עם החיצים ▲ ▼ ואז לחץ על "בדוק את הסדר".' },
      setup: proofScene
    },
    {
      mode: 'quiz',
      tA: 'שלוש זוויות שוות',
      sub: 'בשני משולשים שלוש הזוויות שוות בהתאמה: ' + m('50°') + ', ' + m('60°') + ' ו־' + m('70°') + '. מה אפשר להסיק?',
      tip: 'שימו לב לגדלים של שני המשולשים בציור. האם הם באותו גודל?',
      btn: 'המשך ←',
      aspect: [402, 230],
      alt: 'שני משולשים בעלי אותן זוויות של 50, 60 ו־70 מעלות, אחד קטן ואחד גדול',
      setup: pictureAAA,
      win: 'נכון. אותן זוויות נותנות משולשים דומים, ולא בהכרח חופפים.',
      wrongSay: 'השווה את גודל שני המשולשים בציור. האם אפשר להניח אחד על השני בדיוק?',
      opts: [
        { t: 'המשולשים חופפים, לפי ז.ז.ז', f: 'אין משפט חפיפה ז.ז.ז. בציור שני המשולשים בעלי אותן זוויות אבל גדלים שונים.' },
        { t: 'המשולשים חופפים, כי סכום הזוויות הוא ' + m('180°') + ' בשניהם', f: 'סכום הזוויות הוא ' + m('180°') + ' בכל משולש, וזה לא אומר שהמשולשים באותו גודל.' },
        { t: 'אי אפשר להסיק שום דבר', f: 'אפשר להסיק משהו: המשולשים באותו צורה. זה דמיון, ולא חפיפה.' },
        { t: 'המשולשים דומים, אבל לא בהכרח חופפים', c: true, f: 'נכון: אותן זוויות נותנות אותה צורה, אבל הצלעות יכולות להיות גדולות או קטנות יותר.' }
      ],
      hints: [
        'חפיפה דורשת שהמשולשים יהיו באותו גודל וגם באותה צורה.',
        'בציור שני משולשים באותן זוויות. האם יש לשניהם אותו גודל?',
        'אותן זוויות נותנות אותה צורה בגדלים שונים. זה דמיון.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'איזה משפט מתאים',
      sub: 'בציור מסומנות שתי זוויות שוות והצלע שביניהן שווה. באיזה משפט חפיפה משתמשים?',
      tip: 'שימו לב איפה נמצאת הצלע המסומנת ביחס לשתי הזוויות.',
      btn: 'לסיכום ←',
      aspect: [402, 230],
      alt: 'שני משולשים, השני מסובב. בכל אחד שתי זוויות של 40 ו־65 מעלות והצלע שביניהן מסומנת בקו',
      setup: pictureASA,
      win: 'מעולה. הצלע נמצאת בין שתי הזוויות, ולכן זה ז.צ.ז.',
      wrongSay: 'ספור כמה צלעות וכמה זוויות מסומנות, ובדוק איפה הצלע.',
      opts: [
        { t: 'ז.צ.ז', c: true, f: 'נכון: שתי זוויות שוות והצלע שביניהן שווה. כך הצורה והגודל נקבעים.' },
        { t: 'צ.ז.צ', f: 'ב־צ.ז.צ צריכות להיות שתי צלעות והזווית שביניהן. בציור יש רק צלע אחת וגם שתי זוויות.' },
        { t: 'צ.צ.צ', f: 'ב־צ.צ.צ צריך שלוש צלעות. בציור מסומנת רק צלע אחת.' },
        { t: 'ז.ז.ז', f: 'אין משפט חפיפה ז.ז.ז, ובנוסף בציור יש גם צלע מסומנת, ולכן ז.צ.ז מתאים יותר.' }
      ],
      hints: [
        'ספור כמה צלעות וכמה זוויות מסומנות בציור.',
        'שתי זוויות וצלע אחת. איפה הצלע ביחס לזוויות?',
        'הצלע בין שתי הזוויות: זוויות, צלע, זוויות.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את חפיפת המשולשים',
      sub: 'התאמת קודקודים, בחרת נתונים נועלים וסידרת הוכחה.',
      tip: 'כל הכבוד. לפני שמכריזים על חפיפה בדוק שיש שלושה נתונים מהמשפטים הנכונים.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'משולשים חופפים כשכל הצלעות והזוויות שוות בהתאמה, ומספיקים שלושה נתונים מאחד המשפטים:',
      formula: 'צ.ז.צ · ז.צ.ז · ז.ז.צ · צ.צ.צ'
    }
  ];

  window.NoamGame.boot({
    slug: 'chafifat-meshulashim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'התאמת קודקודים בחפיפה', math: 'ΔABC ≅ ΔEFD' },
      { step: 4, name: 'צ.צ.ז אינו משפט חפיפה', math: 'AB = DE, BC = EF, ∠A = ∠D' },
      { step: 6, name: 'שלוש זוויות נותנות דמיון', math: '50°, 60°, 70°' },
      { step: 7, name: 'בחירת משפט החפיפה', math: 'ז.צ.ז' }
    ],
    bonus: {
      label: 'מכונת משפטי החפיפה 🔺',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל שלושה נתונים שווים בשני משולשים, ובחר איזה משפט חפיפה הם מקיימים.',
      setup: function (box, ctx) {
        var OPTS = ['צ.ז.צ', 'ז.צ.ז', 'ז.ז.צ', 'צ.צ.צ', 'אין משפט'];
        var q = null;
        function rnd(n) { return Math.floor(Math.random() * n); }
        var SIDES = [['AB', 'DE'], ['BC', 'EF'], ['CA', 'FD']];
        var ANGS = [['A', 'D'], ['B', 'E'], ['C', 'F']];
        function sideTxt(i) { return SIDES[i][0] + ' = ' + SIDES[i][1]; }
        function angTxt(i) { return '∠' + ANGS[i][0] + ' = ∠' + ANGS[i][1]; }
        function roll() {
          var kind = ['צ.ז.צ', 'ז.צ.ז', 'ז.ז.צ', 'צ.צ.צ', 'אין משפט', 'אין משפט'][rnd(6)];
          var parts = [], why = '';
          var v = rnd(3);
          if (kind === 'צ.צ.צ') {
            parts = [sideTxt(0), sideTxt(1), sideTxt(2)];
            why = 'שלוש הצלעות שוות בהתאמה.';
          } else if (kind === 'צ.ז.צ') {
            parts = [sideTxt(v), sideTxt((v + 1) % 3), angTxt((v + 1) % 3)];
            why = 'הזווית ' + ANGS[(v + 1) % 3][0] + ' נמצאת בין שתי הצלעות הנתונות.';
          } else if (kind === 'ז.צ.ז') {
            parts = [angTxt(v), angTxt((v + 1) % 3), sideTxt(v)];
            why = 'הצלע ' + SIDES[v][0] + ' נמצאת בין הזוויות ' + ANGS[v][0] + ' ו־' + ANGS[(v + 1) % 3][0] + '.';
          } else if (kind === 'ז.ז.צ') {
            parts = [angTxt(v), angTxt((v + 1) % 3), sideTxt((v + 1) % 3)];
            why = 'הצלע ' + SIDES[(v + 1) % 3][0] + ' אינה בין שתי הזוויות הנתונות.';
          } else if (rnd(2) === 0) {
            parts = [angTxt(0), angTxt(1), angTxt(2)];
            why = 'שלוש זוויות נותנות דמיון בלבד.';
          } else {
            // two sides and an angle that is NOT between them: angle at vertex v, sides opposite and one adjacent
            var opp = (v + 1) % 3, adj = v;
            parts = [angTxt(v), sideTxt(opp), sideTxt(adj)];
            why = 'הזווית ' + ANGS[v][0] + ' אינה בין שתי הצלעות הנתונות.';
          }
          var shown = parts.slice();
          q = { ans: kind, parts: shown, why: why };
        }
        box.innerHTML = '<div class="bTitle">מכונת משפטי החפיפה</div><div class="bSub">בשני משולשים, ' + bdi('ΔABC') + ' ו־' + bdi('ΔDEF') + ', שלושה נתונים שווים. איזה משפט חפיפה מתאים?</div>'
          + '<div class="bChip" data-chip dir="ltr"></div>'
          + '<div data-opts style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center"></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">🎲 תרגיל חדש</button>';
        var chip = box.querySelector('[data-chip]');
        var optBox = box.querySelector('[data-opts]');
        var ok = box.querySelector('[data-ok]');
        var forms = box.querySelector('[data-forms]');
        optBox.innerHTML = OPTS.map(function (t, i) {
          return '<button type="button" class="bDice" data-i="' + i + '" style="min-height:44px;min-width:44px">' + t + '</button>';
        }).join('');
        function draw() {
          chip.textContent = q.parts.join('   ·   ');
          ok.hidden = true;
          forms.hidden = true;
        }
        optBox.querySelectorAll('[data-i]').forEach(function (bt) {
          bt.addEventListener('click', function () {
            var pick = OPTS[Number(bt.getAttribute('data-i'))];
            ok.hidden = false;
            if (pick === q.ans) {
              ctx.sfx('correct');
              ok.style.color = PAL.good;
              ok.textContent = 'נכון! ' + (q.ans === 'אין משפט' ? 'אלה נתונים שלא מבטיחים חפיפה.' : 'המשפט: ' + q.ans + '.');
              forms.hidden = false;
              forms.textContent = q.why;
            } else {
              ctx.sfx('error');
              ok.style.color = BAD;
              ok.textContent = 'נסה שוב: בדוק איפה נמצאת הזווית או הצלע ביחס לשאר הנתונים.';
              forms.hidden = true;
            }
          });
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); draw(); });
        roll();
        draw();
      }
    }
  });
}());
