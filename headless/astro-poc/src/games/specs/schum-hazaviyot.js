/**
 * סכום הזוויות במשולש ובמרובע — an engine game.
 *
 * The idea: the three angles of a triangle lie down on one straight line, so
 * they add to 180°. An exterior angle makes a straight line with its
 * neighbour, so it equals the two far angles. A diagonal cuts a quadrilateral
 * into two triangles, so its angles add to 360°.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var CA = PAL.dark, CB = '#c2410c', CC = '#6d28d9', CX = '#b45309';
  var BAD = '#b91c1c', MUTED = '#475569';
  var COL = { a: CA, b: CB, c: CC };
  var DEG = Math.PI / 180;
  var VW = 402;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function norm(t) { return ((t % 360) + 360) % 360; }
  function pol(cx, cy, r, t) { return { x: cx + r * Math.cos(t * DEG), y: cy - r * Math.sin(t * DEG) }; }
  /** Direction from P to Q in degrees, mathematical orientation (y up). */
  function dirAng(P1, Q1) { return norm(Math.atan2(P1.y - Q1.y, Q1.x - P1.x) / DEG); }
  function wedgeD(cx, cy, r, t1, span) {
    var p1 = pol(cx, cy, r, t1), p2 = pol(cx, cy, r, t1 + span);
    return 'M' + r3(cx) + ' ' + r3(cy) + ' L' + r3(p1.x) + ' ' + r3(p1.y) + ' A' + r + ' ' + r + ' 0 '
      + (span > 180 ? 1 : 0) + ' 0 ' + r3(p2.x) + ' ' + r3(p2.y) + ' Z';
  }
  function setAttrs(el, obj) {
    if (!el) return;
    Object.keys(obj).forEach(function (k) { el.setAttribute(k, obj[k]); });
  }
  function mathT(id, size, fill) {
    return '<text id="' + id + '" x="0" y="0" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle"></text>';
  }
  function putLabel(el, pos, text) {
    if (!el) return;
    el.textContent = text;
    el.setAttribute('x', r1(clamp(pos.x, 22, VW - 22)));
    el.setAttribute('y', r1(pos.y + 5));
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }

  /* ---------- triangle figure ---------- */
  function triLayout(a, b, box) {
    var c = 180 - a - b;
    var ac = Math.sin(b * DEG) / Math.sin(c * DEG);
    var cx = ac * Math.cos(a * DEG), cy = ac * Math.sin(a * DEG);
    var minX = Math.min(0, cx), maxX = Math.max(1, cx);
    var s = Math.min(box.w / (maxX - minX), box.h / cy);
    var x0 = box.x + (box.w - (maxX - minX) * s) / 2 - minX * s;
    var yb = box.y + box.h;
    return { A: { x: x0, y: yb }, B: { x: x0 + s, y: yb }, C: { x: x0 + cx * s, y: yb - cy * s } };
  }
  function triMarkup(pre, withExt) {
    var s = '<polygon id="' + pre + 'Poly" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    ['a', 'b', 'c'].forEach(function (k) {
      s += '<path id="' + pre + 'W' + k + '" fill="' + COL[k] + '" fill-opacity=".26" stroke="' + COL[k] + '" stroke-width="2"/>'
        + mathT(pre + 'L' + k, 15, COL[k]);
    });
    if (withExt) {
      s += '<line id="' + pre + 'Ext" stroke="' + INK + '" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round"/>'
        + '<path id="' + pre + 'WX" fill="' + CX + '" fill-opacity=".3" stroke="' + CX + '" stroke-width="2"/>'
        + mathT(pre + 'LX', 16, CX);
    }
    return s;
  }
  /** Position the triangle, its three corner wedges and (optionally) the exterior angle at C. */
  function placeTri(get, pre, a, b, box, o) {
    var c = 180 - a - b;
    var T = triLayout(a, b, box);
    var R = o.r || 30;
    setAttrs(get(pre + 'Poly'), { points: [T.A, T.B, T.C].map(function (p) { return r1(p.x) + ',' + r1(p.y); }).join(' ') });
    var items = [
      { k: 'a', V: T.A, t1: dirAng(T.A, T.B), span: a },
      { k: 'b', V: T.B, t1: dirAng(T.B, T.C), span: b },
      { k: 'c', V: T.C, t1: dirAng(T.C, T.A), span: c }
    ];
    items.forEach(function (it) {
      setAttrs(get(pre + 'W' + it.k), { d: wedgeD(it.V.x, it.V.y, R, it.t1, it.span) });
      var lab = o.labels ? o.labels[it.k] : '';
      putLabel(get(pre + 'L' + it.k), pol(it.V.x, it.V.y, R + 17, it.t1 + it.span / 2), lab || '');
    });
    if (o.ext) {
      var end = pol(T.C.x, T.C.y, o.extLen || 64, a);
      setAttrs(get(pre + 'Ext'), { x1: r1(T.C.x), y1: r1(T.C.y), x2: r1(end.x), y2: r1(end.y) });
      var tx = norm(-b);
      setAttrs(get(pre + 'WX'), { d: wedgeD(T.C.x, T.C.y, R + 10, tx, a + b) });
      putLabel(get(pre + 'LX'), pol(T.C.x, T.C.y, R + 34, tx + (a + b) / 2), o.extLabel || '');
    }
    return T;
  }
  function triPicture(a, b, labels, opts) {
    opts = opts || {};
    return function (ctx) {
      var box = opts.ext ? { x: 76, y: 84, w: 250, h: 146 } : { x: 70, y: 30, w: 262, h: 196 };
      ctx.draw(triMarkup('q', !!opts.ext));
      var T = placeTri(ctx.el, 'q', a, b, box, { r: 30, labels: labels, ext: !!opts.ext, extLabel: opts.extLabel });
      if (opts.ticks) {
        var s = '';
        [[T.A, T.C], [T.B, T.C]].forEach(function (pr) {
          var mx = (pr[0].x + pr[1].x) / 2, my = (pr[0].y + pr[1].y) / 2;
          var dx = pr[1].x - pr[0].x, dy = pr[1].y - pr[0].y, L = Math.sqrt(dx * dx + dy * dy);
          var nx = -dy / L * 7, ny = dx / L * 7;
          s += '<line x1="' + r1(mx - nx) + '" y1="' + r1(my - ny) + '" x2="' + r1(mx + nx) + '" y2="' + r1(my + ny)
            + '" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
        });
        ctx.svg.insertAdjacentHTML('beforeend', s);
      }
    };
  }

  /* ---------- quadrilateral figure ---------- */
  /** Vertices of a convex quadrilateral with the given interior angles, fitted into a box (screen coordinates). */
  function quadLayout(angles, box) {
    var d1 = 0, d2 = 180 - angles[1], d3 = d2 + 180 - angles[2], d4 = d3 + 180 - angles[3];
    var tries = [0.8, 1, 0.6, 1.2, 0.5, 1.4, 0.4, 1.7, 0.3, 2.1];
    var i, l2, l3 = 0, l4 = 0, ok = false;
    for (i = 0; i < tries.length && !ok; i++) {
      l2 = tries[i];
      var det = Math.sin((d4 - d3) * DEG);
      var rx = -(1 + l2 * Math.cos(d2 * DEG)), ry = -(l2 * Math.sin(d2 * DEG));
      l3 = (rx * Math.sin(d4 * DEG) - Math.cos(d4 * DEG) * ry) / det;
      l4 = (Math.cos(d3 * DEG) * ry - Math.sin(d3 * DEG) * rx) / det;
      ok = l3 > 0.35 && l4 > 0.35;
    }
    var P0 = { x: 0, y: 0 };
    var P1 = { x: Math.cos(d1 * DEG), y: Math.sin(d1 * DEG) };
    var P2 = { x: P1.x + l2 * Math.cos(d2 * DEG), y: P1.y + l2 * Math.sin(d2 * DEG) };
    var P3 = { x: P2.x + l3 * Math.cos(d3 * DEG), y: P2.y + l3 * Math.sin(d3 * DEG) };
    var pts = [P0, P1, P2, P3];
    var minX = 9, maxX = -9, minY = 9, maxY = -9;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var s = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
    var ox = box.x + (box.w - (maxX - minX) * s) / 2, oy = box.y + (box.h - (maxY - minY) * s) / 2;
    return pts.map(function (p) { return { x: ox + (p.x - minX) * s, y: oy + (maxY - p.y) * s }; });
  }
  var QCOL = [CA, CA, CA, CX];
  function quadMarkup(pre) {
    var s = '<polygon id="' + pre + 'Poly" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    for (var i = 0; i < 4; i++) {
      s += '<path id="' + pre + 'W' + i + '" fill="' + QCOL[i] + '" fill-opacity=".26" stroke="' + QCOL[i] + '" stroke-width="2"/>'
        + mathT(pre + 'L' + i, 15, QCOL[i]);
    }
    return s;
  }
  function placeQuad(get, pre, angles, box, labels, skipWedge, diagSplit) {
    var V = quadLayout(angles, box);
    setAttrs(get(pre + 'Poly'), { points: V.map(function (p) { return r1(p.x) + ',' + r1(p.y); }).join(' ') });
    for (var i = 0; i < 4; i++) {
      var t1 = dirAng(V[i], V[(i + 1) % 4]);
      if (skipWedge === i) setAttrs(get(pre + 'W' + i), { d: '' });
      else setAttrs(get(pre + 'W' + i), { d: wedgeD(V[i].x, V[i].y, 28, t1, angles[i]) });
      var mid = t1 + angles[i] / 2, rad = 46;
      if (diagSplit && (i === 0 || i === 2)) {
        var s1 = norm(dirAng(V[i], V[2 - i]) - t1);
        if (s1 > 0 && s1 < angles[i]) {
          mid = s1 > angles[i] - s1 ? t1 + s1 / 2 : t1 + s1 + (angles[i] - s1) / 2;
          rad = 56;
        }
      }
      putLabel(get(pre + 'L' + i), pol(V[i].x, V[i].y, rad, mid), labels[i] || '');
    }
    return V;
  }

  /* ---------- shared controls ---------- */
  /** items: [{ key, color, deltas, label }]; the value text is written by the scene. */
  function stepperHtml(items) {
    return '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px">' + items.map(function (it) {
      var neg = it.deltas.filter(function (d) { return d < 0; }).sort(function (x, y) { return x - y; });
      var pos = it.deltas.filter(function (d) { return d > 0; }).sort(function (x, y) { return x - y; });
      function btn(d) {
        return '<button type="button" data-key="' + it.key + '" data-delta="' + d + '" aria-label="'
          + (d < 0 ? 'הקטן' : 'הגדל') + ' את ' + it.label + ' ב־' + Math.abs(d) + ' מעלות">' + (d < 0 ? '−' : '+') + Math.abs(d) + '</button>';
      }
      return '<div class="unit" dir="ltr" style="gap:5px;padding:6px 6px"><bdi class="math var" dir="ltr" style="color:' + it.color + '">' + it.key + '</bdi>'
        + neg.map(btn).join('')
        + '<bdi class="var math" dir="ltr" data-value="' + it.key + '" style="min-width:46px" aria-live="polite"></bdi>'
        + pos.map(btn).join('') + '</div>';
    }).join('') + '</div>';
  }
  function cell(label, key, color) {
    return '<div><b>' + label + '</b><span class="math" dir="ltr" data-v="' + key + '" style="color:' + color + '"></span></div>';
  }
  function handleG(id, label, color, min, max, val) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + min + '" aria-valuemax="' + max
      + '" aria-valuenow="' + val + '" aria-valuetext="' + val + ' מעלות" style="cursor:grab">'
      + '<circle r="32" fill="transparent"/><circle r="9" fill="#fff" stroke="' + color + '" stroke-width="4.5"/></g>';
  }
  function keyDelta(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -1;
    if (e.key === 'PageUp') return 5;
    if (e.key === 'PageDown') return -5;
    return 0;
  }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ---------- step 1: join the corners on a straight line ---------- */
  function joinScene(ctx) {
    var a = 60, b = 70, joined = false, joining = false, doneOnce = false, T = null;
    var BOX = { x: 60, y: 24, w: 282, h: 166 };
    var PX = 201, PY = 300, RJ = 62, R0 = 30;
    var svgHtml = triMarkup('t', false)
      + '<line x1="40" y1="' + PY + '" x2="362" y2="' + PY + '" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
      + '<text id="jHint" x="201" y="262" text-anchor="middle" font-family="Heebo, sans-serif" font-size="14" font-weight="700" fill="' + MUTED + '">כאן יתיישרו שלוש הפינות</text>'
      + '<g id="joinG" opacity="0">';
    ['a', 'b', 'c'].forEach(function (k) {
      svgHtml += '<g id="jw' + k + '"><path id="jp' + k + '" fill="' + COL[k] + '" fill-opacity=".3" stroke="' + COL[k] + '" stroke-width="2" vector-effect="non-scaling-stroke"/></g>'
        + mathT('jt' + k, 15, COL[k]);
    });
    svgHtml += mathT('jSum', 17, INK) + '</g>'
      + '<g id="pts">' + handleG('hA', 'הקודקוד השמאלי: זווית a. חצים משנים אותה', CA, 30, 110, a)
      + handleG('hB', 'הקודקוד הימני: זווית b. חצים משנים אותה', CB, 30, 110, b) + '</g>';
    ctx.draw(svgHtml);
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + cell('זווית a', 'a', CA) + cell('זווית b', 'b', CB) + cell('זווית c', 'c', CC) + '</div>'
      + '<div style="margin-top:8px">' + stepperHtml([
        { key: 'a', color: CA, deltas: [-5, -1, 1, 5], label: 'הזווית a' },
        { key: 'b', color: CB, deltas: [-5, -1, 1, 5], label: 'הזווית b' }]) + '</div>');
    ctx.register('controls', box);
    var hA = ctx.el('hA'), hB = ctx.el('hB');

    function defaultNote() {
      ctx.note('הזווית ' + m('c') + ' היא מה שנשאר: ' + m('c = 180° − ' + a + '° − ' + b + '° = ' + (180 - a - b) + '°')
        + '. בחר משולש שונה מהפותח, ואז הצמד את הפינות.');
    }
    function pose(l) {
      var c = 180 - a - b;
      var s1 = { a: dirAng(T.A, T.B), b: dirAng(T.B, T.C), c: dirAng(T.C, T.A) };
      var tg = { a: b + c, b: 0, c: b };
      var sp = { a: a, b: b, c: c };
      ['a', 'b', 'c'].forEach(function (k) {
        var v = T[k.toUpperCase()];
        var d = ((tg[k] - s1[k] + 540) % 360) - 180;
        var th = s1[k] + d * l;
        var rr = R0 + (RJ - R0) * l;
        setAttrs(ctx.el('jp' + k), { d: wedgeD(0, 0, 1, 0, sp[k]) });
        setAttrs(ctx.el('jw' + k), { transform: 'translate(' + r1(v.x + (PX - v.x) * l) + ' ' + r1(v.y + (PY - v.y) * l)
          + ') rotate(' + r1(-th) + ') scale(' + r1(rr) + ')' });
        var lp = pol(PX, PY, RJ + 20, tg[k] + sp[k] / 2);
        putLabel(ctx.el('jt' + k), lp, sp[k] + '°');
        ctx.el('jt' + k).setAttribute('opacity', l >= 1 ? '1' : '0');
      });
      putLabel(ctx.el('jSum'), { x: PX, y: PY + 24 }, '180°');
      ctx.el('jSum').setAttribute('opacity', l >= 1 ? '1' : '0');
    }
    function hideJoin() {
      joined = false;
      ctx.el('joinG').setAttribute('opacity', '0');
      ctx.el('jHint').setAttribute('opacity', '1');
    }
    function render() {
      var c = 180 - a - b;
      T = placeTri(ctx.el, 't', a, b, BOX, { r: R0, labels: { a: a + '°', b: b + '°', c: c + '°' } });
      hA.setAttribute('transform', 'translate(' + r1(T.A.x) + ' ' + r1(T.A.y) + ')');
      hB.setAttribute('transform', 'translate(' + r1(T.B.x) + ' ' + r1(T.B.y) + ')');
      setAttrs(hA, { 'aria-valuenow': a, 'aria-valuetext': a + ' מעלות', 'aria-valuemax': Math.min(110, 150 - b) });
      setAttrs(hB, { 'aria-valuenow': b, 'aria-valuetext': b + ' מעלות', 'aria-valuemax': Math.min(110, 150 - a) });
      box.querySelector('[data-v="a"]').textContent = a + '°';
      box.querySelector('[data-v="b"]').textContent = b + '°';
      box.querySelector('[data-v="c"]').textContent = c + '°';
      box.querySelector('[data-value="a"]').textContent = a + '°';
      box.querySelector('[data-value="b"]').textContent = b + '°';
      ctx.caption(joined ? m('a + b + c = 180°') : m('c = 180° − ' + a + '° − ' + b + '° = ' + c + '°'));
    }
    function setAngle(key, val) {
      if (joining) return;
      var cur = key === 'a' ? a : b, other = key === 'a' ? b : a;
      val = clamp(val, 30, 110);
      var over = val + other > 150;
      if (over) val = Math.min(val, 150 - other);
      if (val !== cur) {
        if (key === 'a') a = val; else b = val;
        if (joined) hideJoin();
        ctx.sfx('tick');
        render();
        if (!over) defaultNote();
      }
      if (over) {
        ctx.sfx('error');
        ctx.note('כבר ' + m('a + b = ' + (a + b) + '°') + '. אם נגדיל עוד, לא יישאר מקום לזווית השלישית: היא צריכה להיות לפחות ' + m('30°') + ', ולכן ' + m('a + b') + ' לא עולה על ' + m('150°') + '.');
      }
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        var k = bt.getAttribute('data-key');
        setAngle(k, (k === 'a' ? a : b) + Number(bt.getAttribute('data-delta')));
      });
    });
    [['a', hA], ['b', hB]].forEach(function (pr) {
      pr[1].addEventListener('keydown', function (e) {
        var d = keyDelta(e), cur = pr[0] === 'a' ? a : b;
        if (e.key === 'Home') { e.preventDefault(); setAngle(pr[0], 30); return; }
        if (e.key === 'End') { e.preventDefault(); setAngle(pr[0], 110); return; }
        if (!d) return;
        e.preventDefault();
        setAngle(pr[0], cur + d);
      });
    });
    var which = 'a';
    ctx.drag(ctx.svg, {
      start: function (x, y) {
        which = Math.abs(x - T.A.x) + Math.abs(y - T.A.y) <= Math.abs(x - T.B.x) + Math.abs(y - T.B.y) ? 'a' : 'b';
      },
      move: function (x, y) {
        var ang = which === 'a' ? dirAng(T.A, { x: x, y: y }) : 180 - dirAng(T.B, { x: x, y: y });
        if (ang > 180) ang = ang - 360;
        setAngle(which, Math.round(ang));
      }
    });
    ctx.button('הצמד את הפינות לקו', function () {
      if (joining) return;
      if (a === 60 && b === 70) {
        ctx.sfx('error');
        ctx.note('זה המשולש הפותח. שנה את ' + m('a') + ' או את ' + m('b') + ' כדי לבחור משולש אחר, ואז הצמד את הפינות.');
        return;
      }
      joining = true;
      ctx.busy(true);
      joined = true;
      ctx.sfx('click');
      ctx.el('jHint').setAttribute('opacity', '0');
      ctx.el('joinG').setAttribute('opacity', '1');
      ctx.tween(reduced() ? 1 : 1200, function (l) { pose(window.NoamGame.ez(l)); }).then(function () {
        joining = false;
        ctx.busy(false);
        render();
        ctx.note('שלוש הפינות יושבות על קו ישר: ' + m('a + b + c = 180°') + '. במספרים: ' + m(a + '° + ' + b + '° + ' + (180 - a - b) + '° = 180°') + '.', 'good');
        if (!doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
      });
    }, { id: 'joinBtn', target: 'join' });
    render();
    defaultNote();
  }

  /* ---------- step 3: the exterior angle ---------- */
  function exteriorScene(ctx) {
    var a = 50, b = 40, doneOnce = false, T = null;
    var BOX = { x: 76, y: 100, w: 250, h: 140 };
    ctx.draw(triMarkup('e', true)
      + '<g id="pts">' + handleG('hA', 'הקודקוד השמאלי: זווית a. חצים משנים אותה', CA, 30, 110, a)
      + handleG('hB', 'הקודקוד הימני: זווית b. חצים משנים אותה', CB, 30, 110, b)
      + '<g id="hC" tabindex="0" role="button" aria-label="הקודקוד העליון: הזווית c נקבעת לפי a ו־b" style="cursor:grab">'
      + '<circle r="32" fill="transparent"/><circle r="9" fill="#fff" stroke="' + CC + '" stroke-width="4.5"/></g></g>');
    var box = ctx.extra('<div class="sceneStrip">'
      + '<div><b>הזווית החיצונית שווה לסכום שתי הרחוקות</b><span class="math" dir="ltr" data-v="r1" style="color:' + CX + '"></span></div>'
      + '<div><b>היא וזווית c יוצרות קו ישר</b><span class="math" dir="ltr" data-v="r2" style="color:' + INK + '"></span></div></div>'
      + '<div style="margin-top:8px">' + stepperHtml([
        { key: 'a', color: CA, deltas: [-5, -1, 1, 5], label: 'הזווית a' },
        { key: 'b', color: CB, deltas: [-5, -1, 1, 5], label: 'הזווית b' }]) + '</div>');
    ctx.register('controls', box);
    var hA = ctx.el('hA'), hB = ctx.el('hB'), hC = ctx.el('hC');

    function render() {
      var c = 180 - a - b, ext = a + b;
      T = placeTri(ctx.el, 'e', a, b, BOX, { r: 28, labels: { a: a + '°', b: b + '°', c: c + '°' }, ext: true, extLen: 66, extLabel: ext + '°' });
      hA.setAttribute('transform', 'translate(' + r1(T.A.x) + ' ' + r1(T.A.y) + ')');
      hB.setAttribute('transform', 'translate(' + r1(T.B.x) + ' ' + r1(T.B.y) + ')');
      hC.setAttribute('transform', 'translate(' + r1(T.C.x) + ' ' + r1(T.C.y) + ')');
      setAttrs(hA, { 'aria-valuenow': a, 'aria-valuetext': a + ' מעלות', 'aria-valuemax': Math.min(110, 150 - b) });
      setAttrs(hB, { 'aria-valuenow': b, 'aria-valuetext': b + ' מעלות', 'aria-valuemax': Math.min(110, 150 - a) });
      box.querySelector('[data-v="r1"]').textContent = a + '° + ' + b + '° = ' + ext + '°';
      box.querySelector('[data-v="r2"]').textContent = ext + '° + ' + c + '° = 180°';
      box.querySelector('[data-value="a"]').textContent = a + '°';
      box.querySelector('[data-value="b"]').textContent = b + '°';
      ctx.caption(m(ext + '° = ' + a + '° + ' + b + '°'));
    }
    function note() {
      var ext = a + b;
      if (ext === 120) {
        ctx.note('בדיוק ' + m('120°') + '! ' + m('120° = ' + a + '° + ' + b + '°') + ', ובנוסף ' + m('120° + ' + (180 - a - b) + '° = 180°') + ' כי הן יושבות על קו ישר.', 'good');
      } else {
        ctx.note('הזווית החיצונית עכשיו ' + m(ext + '°') + '. ' + (ext < 120 ? 'כדי להגיע ל־' + m('120°') + ' צריך להגדיל את ' + m('a') + ' או את ' + m('b') + '.'
          : 'כדי להגיע ל־' + m('120°') + ' צריך להקטין את ' + m('a') + ' או את ' + m('b') + '.'));
      }
    }
    function setAngle(key, val) {
      var cur = key === 'a' ? a : b, other = key === 'a' ? b : a;
      val = clamp(val, 30, 110);
      var over = val + other > 150;
      if (over) val = Math.min(val, 150 - other);
      if (val !== cur) {
        if (key === 'a') a = val; else b = val;
        ctx.sfx('tick');
        render();
        note();
        if (a + b === 120 && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
      }
      if (over) {
        ctx.sfx('error');
        ctx.note('כבר ' + m('a + b = ' + (a + b) + '°') + ', ואז ' + m('c') + ' קטן מ־' + m('30°') + ' ואין מקום לגדול יותר. מספיק להגיע ל־' + m('120°') + '.');
      }
    }
    function cNote() {
      ctx.sfx('error');
      ctx.note('הזווית ' + m('c') + ' היא מה שנשאר: ' + m('c = 180° − a − b') + '. כדי לשנות את הזווית החיצונית, הזז את ' + m('a') + ' או את ' + m('b') + '.');
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        var k = bt.getAttribute('data-key');
        setAngle(k, (k === 'a' ? a : b) + Number(bt.getAttribute('data-delta')));
      });
    });
    [['a', hA], ['b', hB]].forEach(function (pr) {
      pr[1].addEventListener('keydown', function (e) {
        var d = keyDelta(e), cur = pr[0] === 'a' ? a : b;
        if (e.key === 'Home') { e.preventDefault(); setAngle(pr[0], 30); return; }
        if (e.key === 'End') { e.preventDefault(); setAngle(pr[0], 110); return; }
        if (!d) return;
        e.preventDefault();
        setAngle(pr[0], cur + d);
      });
    });
    hC.addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].indexOf(e.key) < 0) return;
      e.preventDefault();
      cNote();
    });
    var which = 'a';
    ctx.drag(ctx.svg, {
      start: function (x, y) {
        var dA = Math.abs(x - T.A.x) + Math.abs(y - T.A.y), dB = Math.abs(x - T.B.x) + Math.abs(y - T.B.y), dC = Math.abs(x - T.C.x) + Math.abs(y - T.C.y);
        which = dC < dA && dC < dB ? 'c' : (dA <= dB ? 'a' : 'b');
        if (which === 'c') cNote();
      },
      move: function (x, y) {
        if (which === 'c') {
          var angA = dirAng(T.A, { x: x, y: y }), angB = 180 - dirAng(T.B, { x: x, y: y });
          if (angA > 180) angA = angA - 360;
          if (angB > 180) angB = angB - 360;
          setBoth(Math.round(angA), Math.round(angB));
          return;
        }
        var ang = which === 'a' ? dirAng(T.A, { x: x, y: y }) : 180 - dirAng(T.B, { x: x, y: y });
        if (ang > 180) ang = ang - 360;
        setAngle(which, Math.round(ang));
      },
      end: function () { if (which === 'c' && a + b !== 120) cNote(); }
    });
    function setBoth(na, nb) {
      na = clamp(na, 30, 110);
      nb = clamp(nb, 30, 110);
      if (na + nb > 150) nb = 150 - na;
      if (nb < 30 || (na === a && nb === b)) return;
      a = na; b = nb;
      ctx.sfx('tick');
      render();
      note();
      if (a + b === 120 && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    render();
    note();
  }

  /* ---------- step 5: a quadrilateral cut into two triangles ---------- */
  function quadScene(ctx) {
    var KNOWN = [80, 95, 110], D_TRUE = 75;
    var d = 60, diag = false, doneOnce = false, V = null, dirC = 0;
    var BOX = { x: 56, y: 28, w: 290, h: 214 };
    ctx.draw(quadMarkup('s')
      + '<polygon id="sT1" fill="' + CA + '" fill-opacity=".14" points="" opacity="0"/>'
      + '<polygon id="sT2" fill="' + CX + '" fill-opacity=".16" points="" opacity="0"/>'
      + '<line id="sDiag" stroke="' + INK + '" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round" opacity="0"/>'
      + '<path id="sGuess" fill="' + CX + '" fill-opacity=".34" stroke="' + CX + '" stroke-width="2"/>'
      + '<line id="sRay" stroke="' + CX + '" stroke-width="3" stroke-linecap="round"/>'
      + mathT('sTx1', 17, CA) + mathT('sTx2', 17, '#92400e')
      + '<g id="pts">' + handleG('hD', 'הקודקוד של הזווית הרביעית. חצים משנים אותה', CX, 40, 140, d) + '</g>');
    var box = ctx.extra('<div class="sceneStrip">'
      + '<div><b>סכום ארבע הזוויות עכשיו</b><span class="math" dir="ltr" data-v="sum" style="color:' + INK + '"></span></div>'
      + '<div><b>אחרי האלכסון</b><span class="math" dir="ltr" data-v="tri" style="color:' + CA + '">?</span></div></div>'
      + '<div style="margin-top:8px">' + stepperHtml([{ key: 'd', color: CX, deltas: [-5, -1, 1, 5], label: 'הזווית הרביעית' }]) + '</div>');
    ctx.register('controls', box);
    var hD = ctx.el('hD');

    function render() {
      V = placeQuad(ctx.el, 's', [KNOWN[0], KNOWN[1], KNOWN[2], D_TRUE], BOX, [KNOWN[0] + '°', KNOWN[1] + '°', KNOWN[2] + '°', ''], 3, diag);
      dirC = dirAng(V[3], V[2]);
      var lenDA = Math.sqrt(Math.pow(V[3].x - V[0].x, 2) + Math.pow(V[3].y - V[0].y, 2));
      var R = Math.min(78, lenDA * 0.8);
      var tip = pol(V[3].x, V[3].y, R, dirC - d);
      setAttrs(ctx.el('sGuess'), { d: wedgeD(V[3].x, V[3].y, 30, dirC - d, d) });
      setAttrs(ctx.el('sRay'), { x1: r1(V[3].x), y1: r1(V[3].y), x2: r1(tip.x), y2: r1(tip.y) });
      putLabel(ctx.el('sL3'), pol(V[3].x, V[3].y, 50, dirC - d / 2), d + '°');
      ctx.el('sL3').setAttribute('fill', '#92400e');
      hD.setAttribute('transform', 'translate(' + r1(tip.x) + ' ' + r1(tip.y) + ')');
      setAttrs(hD, { 'aria-valuenow': d, 'aria-valuetext': d + ' מעלות' });
      setAttrs(ctx.el('sT1'), { points: [V[0], V[1], V[2]].map(function (p) { return r1(p.x) + ',' + r1(p.y); }).join(' ') });
      setAttrs(ctx.el('sT2'), { points: [V[0], V[2], V[3]].map(function (p) { return r1(p.x) + ',' + r1(p.y); }).join(' ') });
      setAttrs(ctx.el('sDiag'), { x1: r1(V[0].x), y1: r1(V[0].y), x2: r1(V[2].x), y2: r1(V[2].y) });
      var dm = { x: (V[0].x + V[2].x) / 2, y: (V[0].y + V[2].y) / 2 };
      function towards(P1) {
        var dx = P1.x - dm.x, dy = P1.y - dm.y, L = Math.sqrt(dx * dx + dy * dy);
        return { x: dm.x + dx / L * 40, y: dm.y + dy / L * 40 };
      }
      var c1 = towards(V[1]);
      var c2 = towards(V[3]);
      putLabel(ctx.el('sTx1'), c1, diag ? '180°' : '');
      putLabel(ctx.el('sTx2'), c2, diag ? '180°' : '');
      var sum = 285 + d;
      box.querySelector('[data-v="sum"]').textContent = '80° + 95° + 110° + ' + d + '° = ' + sum + '°';
      box.querySelector('[data-v="tri"]').textContent = diag ? '180° + 180° = 360°' : '?';
      box.querySelector('[data-value="d"]').textContent = d + '°';
      ctx.caption(diag ? m('180° + 180° = 360°') : m('80° + 95° + 110° + ' + d + '° = ' + sum + '°'));
    }
    function note() {
      var sum = 285 + d;
      if (d === D_TRUE && diag) {
        ctx.note('כל משולש הוא ' + m('180°') + ', ולכן המרובע הוא ' + m('180° + 180° = 360°') + '. הרביעית: ' + m('360° − 285° = 75°') + '.', 'good');
      } else if (d === D_TRUE) {
        ctx.note('הזווית נכונה: הקו הכתום נשכב בדיוק על הצלע, והסכום הוא ' + m('360°') + '. עכשיו שרטט אלכסון ותראה למה.');
      } else if (d === 90) {
        ctx.note('מרובע אינו תמיד מלבן. חבר את שלוש הזוויות הידועות, ' + m('80° + 95° + 110° = 285°') + ', וחסר מ־' + m('360°') + '.');
      } else if (sum > 360) {
        ctx.note('הסכום ' + m(sum + '°') + ' גדול מ־' + m('360°') + ': הקו הכתום עבר את הצלע. הקטן את הזווית הרביעית.');
      } else {
        ctx.note('הסכום ' + m(sum + '°') + ' קטן מ־' + m('360°') + ': נשאר רווח בין הקו הכתום לצלע. הגדל את הזווית הרביעית.');
      }
    }
    function check() {
      if (d === D_TRUE && diag && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    function setD(val) {
      val = clamp(val, 40, 140);
      if (val === d) return;
      d = val;
      ctx.sfx('tick');
      render(); note(); check();
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { setD(d + Number(bt.getAttribute('data-delta'))); });
    });
    hD.addEventListener('keydown', function (e) {
      if (e.key === 'Home') { e.preventDefault(); setD(40); return; }
      if (e.key === 'End') { e.preventDefault(); setD(140); return; }
      var k = keyDelta(e);
      if (!k) return;
      e.preventDefault();
      setD(d + k);
    });
    ctx.drag(ctx.svg, {
      move: function (x, y) {
        var dd = norm(dirC - dirAng(V[3], { x: x, y: y }));
        if (dd > 180) dd = dd - 360;
        setD(Math.round(dd));
      }
    });
    ctx.button('שרטט אלכסון', function () {
      if (diag) return;
      diag = true;
      ctx.sfx('click');
      ['sT1', 'sT2', 'sDiag'].forEach(function (id) { ctx.el(id).setAttribute('opacity', '1'); });
      render(); note(); check();
    }, { id: 'diagBtn', target: 'diag' });
    render();
    ctx.note('שלוש זוויות ידועות: ' + m('80°') + ', ' + m('95°') + ', ' + m('110°') + '. הגדר את הרביעית כך שהקו הכתום ישב על הצלע, ושרטט אלכסון.');
  }

  function quadPicture(angles, labels) {
    return function (ctx) {
      ctx.draw(quadMarkup('qq'));
      placeQuad(ctx.el, 'qq', angles, { x: 56, y: 24, w: 290, h: 200 }, labels, -1);
    };
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'סכום הזוויות',
      sub: 'שלוש פינות על קו ישר, ומרובע שנחתך לשני משולשים.',
      tip: 'שלום, אני אליהו. היום נגלה למה שלוש הזוויות של כל משולש מסתכמות באותו מספר.',
      emoji: '📐',
      eq: m('180°') + ' בכל משולש',
      note: 'כשמצמידים את שלוש הפינות של משולש זו לזו הן יוצרות קו ישר, ולכן הסכום שלהן הוא ' + m('180°') + '. מכאן נגלה גם את הזווית החיצונית ואת סכום הזוויות במרובע.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מצמידים את הפינות',
      sub: 'בחר משולש אחר מהפותח בגרירה, בכפתורים או בחיצים, ואז הצמד את שלוש הפינות לקו ישר.',
      tip: 'שנה את ' + m('a') + ' ואת ' + m('b') + '. ' + m('c') + ' היא מה שנשאר. אחרי שתבחר משולש חדש, הצמד את הפינות לקו.',
      cue: 'בחר משולש חדש והצמד את הפינות לקו',
      cueDone: 'שלוש הפינות על קו אחד. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 336],
      alt: 'משולש עם שלוש זוויות צבעוניות ושני קודקודים שאפשר להזיז, וקו ישר מתחתיו שעליו מצמידים את שלוש הפינות זו לצד זו',
      nudge: { target: 'controls', text: 'שנה את אחת הזוויות בכפתורי הפלוס והמינוס, ואז לחץ על "הצמד את הפינות לקו".' },
      setup: joinScene
    },
    {
      mode: 'quiz',
      tA: 'הזווית השלישית',
      sub: 'במשולש שתי זוויות הן ' + m('52°') + ' ו־' + m('61°') + '. מהי השלישית?',
      tip: 'שלוש הפינות מתיישרות לקו ישר. כמה מהקו נשאר אחרי שתי הזוויות?',
      btn: 'המשך ←',
      aspect: [402, 250],
      alt: 'משולש עם זוויות של 52 מעלות ו־61 מעלות בבסיס, וסימן שאלה בזווית העליונה',
      setup: triPicture(52, 61, { a: '52°', b: '61°', c: '?' }),
      win: 'נכון. חיברת את שתי הזוויות והשלמת ל־180°.',
      wrongSay: 'חבר קודם את שתי הזוויות הידועות, ואז בדוק כמה חסר עד סכום המשולש.',
      opts: [
        { t: m('67°'), c: true, f: 'נכון: ' + m('52° + 61° = 113°') + ', ו־' + m('180° − 113° = 67°') + '.' },
        { t: m('68°'), f: 'טעות חישוב קטנה: ' + m('52° + 61°') + ' הוא ' + m('113°') + ' ולא ' + m('112°') + '. חבר שוב לפני שמחסרים.' },
        { t: m('77°'), f: 'חיסרת את הסכום מ־' + m('190°') + '. סכום הזוויות במשולש הוא ' + m('180°') + ', לא ' + m('190°') + '.' },
        { t: m('180°'), f: 'נתת את סכום כל הזוויות במקום את הזווית החסרה. ה־' + m('180°') + ' כולל גם את ' + m('52°') + ' ואת ' + m('61°') + '.' }
      ],
      hints: [
        'סכום שלוש הזוויות במשולש תמיד אותו מספר.',
        'חבר את שתי הזוויות הידועות, ואז חשב כמה חסר עד סכום המשולש.',
        m('52° + 61° = 113°') + ', ועכשיו ' + m('180° − 113°') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'הזווית החיצונית',
      sub: 'הארכנו צלע מעבר לקודקוד ' + m('C') + '. הגדר את ' + m('a') + ' ואת ' + m('b') + ' בגרירה, בכפתורים או בחיצים, כך שהזווית החיצונית תהיה ' + m('120°') + '.',
      tip: 'הזווית החיצונית וזווית ' + m('c') + ' יושבות על קו ישר. תראה מה קורה לסכום ' + m('a + b') + '.',
      cue: 'הגדר זווית חיצונית של 120°',
      cueDone: 'הזווית החיצונית היא 120°. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 282],
      alt: 'משולש שצלע אחת שלו מוארכת מעבר לקודקוד העליון, עם הזווית החיצונית מסומנת בכתום וקודקודים שאפשר להזיז',
      nudge: { target: 'controls', text: 'שנה את ' + m('a') + ' או את ' + m('b') + ' בכפתורים ותראה את הזווית החיצונית משתנה.' },
      setup: exteriorScene
    },
    {
      mode: 'quiz',
      tA: 'הזווית הרחוקה השנייה',
      sub: 'זווית חיצונית היא ' + m('140°') + ', ואחת הזוויות הרחוקות היא ' + m('65°') + '. מהי השנייה?',
      tip: 'זווית חיצונית שווה לסכום שתי הזוויות הרחוקות ממנה.',
      btn: 'המשך ←',
      aspect: [402, 250],
      alt: 'משולש עם זווית חיצונית של 140 מעלות בקודקוד העליון, זווית רחוקה של 65 מעלות, וסימן שאלה בזווית הרחוקה השנייה',
      setup: triPicture(65, 75, { a
: '65°', b: '?', c: '' }, { ext: true, extLabel: '140°' }),
      win: 'נכון. הזווית החיצונית היא סכום שתי הרחוקות, ולכן חיסרת ממנה את הידועה.',
      wrongSay: 'הזווית החיצונית שווה לסכום שתי הרחוקות. מה עושים עם ' + m('140°') + ' ועם ' + m('65°') + '?',
      opts: [
        { t: m('75°'), c: true, f: 'נכון: ' + m('140° = 65° + ?') + ', ולכן ' + m('140° − 65° = 75°') + '.' },
        { t: m('40°'), f: m('180° − 140° = 40°') + ' היא הזווית הפנימית הסמוכה לחיצונית, לא הזווית הרחוקה השנייה.' },
        { t: m('115°'), f: 'חיסרת את ' + m('65°') + ' מ־' + m('180°') + '. הזווית החיצונית היא סכום שתי הרחוקות, ולכן חוסרים את הידועה ממנה.' },
        { t: m('65°'), f: 'העתקת את הזווית הנתונה. שתי הזוויות הרחוקות הן שתי זוויות שונות שביחד נותנות את החיצונית.' }
      ],
      hints: [
        'הזווית החיצונית שווה לסכום שתי הזוויות הרחוקות ממנה.',
        'כתוב ' + m('140° = 65° + ?') + ' ושאל מה חסר.',
        'חסר את ' + m('65°') + ' מ־' + m('140°') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מרובע לשני משולשים',
      sub: 'שלוש זוויות ידועות. הגדר את הרביעית בגרירה, בכפתורים או בחיצים, ושרטט אלכסון.',
      tip: 'אלכסון חותך את המרובע לשני משולשים. כמה זה ' + m('180°') + ' ועוד ' + m('180°') + '?',
      cue: 'שרטט אלכסון והגדר את הזווית הרביעית',
      cueDone: 'שני משולשים, ' + m('360°') + ' במרובע. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 270],
      alt: 'מרובע עם שלוש זוויות ידועות של 80, 95 ו־110 מעלות, קו כתום שמראה את הזווית הרביעית שאפשר להזיז, ואלכסון שמחלק אותו לשני משולשים',
      nudge: { target: 'controls', text: 'שנה את הזווית הרביעית בכפתורים, ולחץ על "שרטט אלכסון".' },
      setup: quadScene
    },
    {
      mode: 'quiz',
      tA: 'הזווית הרביעית במרובע',
      sub: 'במרובע הזוויות הן ' + m('100°') + ', ' + m('85°') + ' ו־' + m('95°') + '. מהי הרביעית?',
      tip: 'מרובע הוא שני משולשים. כמה הסכום של כל הזוויות שלו?',
      btn: 'המשך ←',
      aspect: [402, 250],
      alt: 'מרובע עם זוויות של 100, 85 ו־95 מעלות וסימן שאלה בזווית הרביעית',
      setup: quadPicture([100, 85, 95, 80], ['100°', '85°', '95°', '?']),
      win: 'נכון. סכום זוויות המרובע הוא 360°, והשלמת את מה שחסר.',
      wrongSay: 'חבר את שלוש הזוויות, ובדוק כמה חסר עד סכום המרובע.',
      opts: [
        { t: m('80°'), c: true, f: 'נכון: ' + m('100° + 85° + 95° = 280°') + ', ו־' + m('360° − 280° = 80°') + '.' },
        { t: m('90°'), f: 'הנחת שהמרובע הוא מלבן. אבל מרובע אינו תמיד מלבן: חבר את שלוש הזוויות וחסר מ־' + m('360°') + '.' },
        { t: m('75°'), f: 'חיסרת מ־' + m('355°') + '. סכום זוויות המרובע הוא ' + m('360°') + ' ולא ' + m('355°') + '.' },
        { t: m('180°'), f: 'השתמשת ב־' + m('180°') + ' כמו במשולש. במרובע הסכום הוא ' + m('360°') + ', כי הוא שני משולשים.' }
      ],
      hints: [
        'מרובע מתחלק בעזרת אלכסון לשני משולשים, ולכן סכום זוויותיו קבוע.',
        'חבר את שלוש הזוויות הידועות, ואז חסר אותן מסכום המרובע.',
        m('100° + 85° + 95° = 280°') + ', ועכשיו ' + m('360° − 280°') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'משולש שווה־שוקיים',
      sub: 'במשולש שווה־שוקיים זווית הראש היא ' + m('40°') + '. מהי כל זווית בסיס?',
      tip: 'בשווה־שוקיים שתי זוויות הבסיס שוות. כמה נשאר אחרי זווית הראש, ואיך מחלקים אותו?',
      btn: 'לסיכום ←',
      aspect: [402, 250],
      alt: 'משולש שווה־שוקיים עם זווית ראש של 40 מעלות, וסימן שאלה בכל אחת משתי זוויות הבסיס השוות',
      setup: triPicture(70, 70, { a: '?', b: '?', c: '40°' }, { ticks: true }),
      win: 'מעולה. זווית הראש יוצאת מהסכום, והשאר מתחלק בשווה.',
      wrongSay: 'זווית הראש היא אחת משלוש. מה נשאר לשתי זוויות הבסיס השוות?',
      opts: [
        { t: m('70°'), c: true, f: 'נכון: ' + m('180° − 40° = 140°') + ', ו־' + m('140° ÷ 2 = 70°') + ' לכל זווית בסיס.' },
        { t: m('140°'), f: 'חיסרת נכון, אבל שכחת לחלק לשניים. ' + m('140°') + ' הוא סכום שתי זוויות הבסיס, לא כל אחת.' },
        { t: m('40°'), f: 'העתקת את זווית הראש. השוות זו לזו הן שתי זוויות הבסיס, לא זווית הראש.' },
        { t: m('100°'), f: 'חיסרת ' + m('40°') + ' פעמיים. זווית הראש נחסרת פעם אחת, והשאר מתחלק לשתי זוויות בסיס שוות.' }
      ],
      hints: [
        'בשווה־שוקיים שתי זוויות הבסיס שוות זו לזו.',
        'חסר את זווית הראש מ־' + m('180°') + ', ואז חלק את מה שנשאר לשניים.',
        m('180° − 40° = 140°') + ', ועכשיו ' + m('140° ÷ 2') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את סכום הזוויות',
      sub: 'שלוש פינות על קו ישר, וזווית חיצונית שווה לשתי הרחוקות.',
      tip: 'כל הכבוד. כשחסרה זווית, חפש את הקו הישר או את המשולשים.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'שלוש הפינות של משולש מתיישרות לקו ישר אחד, וזווית חיצונית שווה לסכום שתי הרחוקות:',
      formula: m('180°') + ' במשולש · ' + m('360°') + ' במרובע'
    }
  ];

  window.NoamGame.boot({
    slug: 'schum-hazaviyot',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'הזווית השלישית במשולש', math: '180° − 52° − 61°' },
      { step: 4, name: 'זווית חיצונית', math: '140° − 65°' },
      { step: 6, name: 'הזווית הרביעית במרובע', math: '360° − 280°' },
      { step: 7, name: 'משולש שווה־שוקיים', math: '(180° − 40°) ÷ 2' }
    ],
    bonus: {
      label: 'מכונת הזוויות 📐',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל משולש, מרובע או זווית חיצונית, ומצא את הזווית החסרה.',
      setup: function (box, ctx) {
        var q = null, guess = 90;
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          var kind = ['tri', 'quad', 'ext'][rnd(0, 2)];
          var x, y, z, ans;
          if (kind === 'tri') {
            do { x = rnd(35, 90); y = rnd(35, 90); } while (x + y > 150 || 180 - x - y === 90);
            q = { kind: kind, x: x, y: y, ans: 180 - x - y };
          } else if (kind === 'quad') {
            do {
              x = rnd(60, 120); y = rnd(60, 120); z = rnd(60, 120); ans = 360 - x - y - z;
            } while (ans < 55 || ans > 125 || ans === 90);
            q = { kind: kind, x: x, y: y, z: z, ans: ans };
          } else {
            do { x = rnd(30, 80); y = rnd(30, 80); } while (x === y || y === 90);
            q = { kind: kind, x: x, y: y, ans: y };
          }
          guess = 90;
        }
        box.innerHTML = '<div class="bTitle">מכונת הזוויות</div><div class="bSub" data-sub></div>'
          + '<svg data-pic viewBox="0 0 402 250" dir="ltr" role="img" aria-label="ציור של התרגיל" style="width:100%;height:auto;display:block"></svg>'
          + '<div class="bChip" data-chip dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr" style="gap:5px;padding:6px 6px">'
          + '<button type="button" data-d="-10" aria-label="הקטן ב־10 מעלות">−10</button>'
          + '<button type="button" data-d="-1" aria-label="הקטן במעלה אחת">−1</button>'
          + '<bdi class="var math" dir="ltr" data-g style="min-width:50px" aria-live="polite"></bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל במעלה אחת">+1</button>'
          + '<button type="button" data-d="10" aria-label="הגדל ב־10 מעלות">+10</button></div></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">🎲 תרגיל חדש</button>';
        var pic = box.querySelector('[data-pic]');
        var chip = box.querySelector('[data-chip]');
        var sub = box.querySelector('[data-sub]');
        var gEl = box.querySelector('[data-g]');
        var ok = box.querySelector('[data-ok]');
        var forms = box.querySelector('[data-forms]');
        function get(id) { return pic.querySelector('#' + id); }
        function draw() {
          if (q.kind === 'tri') {
            pic.innerHTML = triMarkup('bn', false);
            placeTri(get, 'bn', q.x, q.y, { x: 70, y: 30, w: 262, h: 196 }, { r: 30, labels: { a: q.x + '°', b: q.y + '°', c: '?' } });
            chip.textContent = q.x + '° + ' + q.y + '° + ? = 180°';
            sub.textContent = 'במשולש יש שתי זוויות נתונות. מצא את השלישית.';
          } else if (q.kind === 'quad') {
            pic.innerHTML = quadMarkup('bn');
            placeQuad(get, 'bn', [q.x, q.y, q.z, q.ans], { x: 56, y: 24, w: 290, h: 200 }, [q.x + '°', q.y + '°', q.z + '°', '?'], -1);
            chip.textContent = q.x + '° + ' + q.y + '° + ' + q.z + '° + ? = 360°';
            sub.textContent = 'במרובע יש שלוש זוויות נתונות. מצא את הרביעית.';
          } else {
            pic.innerHTML = triMarkup('bn', true);
            placeTri(get, 'bn', q.x, q.y, { x: 76, y: 84, w: 250, h: 146 },
              { r: 30, labels: { a: q.x + '°', b: '?', c: '' }, ext: true, extLabel: (q.x + q.y) + '°' });
            chip.textContent = (q.x + q.y) + '° = ' + q.x + '° + ?';
            sub.textContent = 'זווית חיצונית ואחת הזוויות הרחוקות נתונות. מצא את הרחוקה השנייה.';
          }
          gEl.textContent = guess + '°';
          ok.hidden = true;
          forms.hidden = true;
        }
        function solution() {
          if (q.kind === 'tri') return '180° − ' + q.x + '° − ' + q.y + '° = ' + q.ans + '°';
          if (q.kind === 'quad') return '360° − ' + (q.x + q.y + q.z) + '° = ' + q.ans + '°';
          return (q.x + q.y) + '° − ' + q.x + '° = ' + q.ans + '°';
        }
        box.querySelectorAll('[data-d]').forEach(function (bt) {
          bt.addEventListener('click', function () {
            guess = clamp(guess + Number(bt.getAttribute('data-d')), 1, 179);
            ctx.sfx('click');
            gEl.textContent = guess + '°';
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          ok.hidden = false;
          if (guess === q.ans) {
            ctx.sfx('correct');
            ok.style.color = PAL.good;
            ok.textContent = 'נכון! ' + (q.kind === 'ext' ? 'הזווית החיצונית שווה לסכום שתי הרחוקות.' : q.kind === 'tri' ? 'שלוש הזוויות מסתכמות ב־180°.' : 'ארבע הזוויות מסתכמות ב־360°.');
            forms.hidden = false;
            forms.innerHTML = bdi(solution());
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            ok.textContent = q.kind === 'ext' ? 'נסה שוב: חסר את הזווית הידועה מהזווית החיצונית.'
              : q.kind === 'tri' ? 'נסה שוב: חבר את שתי הזוויות וחסר מ־180°.' : 'נסה שוב: חבר את שלוש הזוויות וחסר מ־360°.';
            forms.hidden = true;
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); draw(); });
        roll();
        draw();
      }
    }
  });
}());
