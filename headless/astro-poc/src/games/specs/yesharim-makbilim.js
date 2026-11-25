/**
 * ישרים מקבילים — an engine game.
 *
 * The idea: a transversal cuts two parallel lines and makes eight angles.
 * Corresponding angles (מתאימות) are equal, alternate angles (מתחלפות) are
 * equal, and co-interior angles (חד־צדדיות) add to 180°. When the lines are
 * not parallel, none of this holds, and the relations can be read backwards.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var C1 = '#c2410c', C2 = '#6d28d9', CT = '#0f766e', BAD = '#b91c1c', MUTED = '#475569';
  var DEG = Math.PI / 180;
  var VW = 402, VH = 300, MX = 201, MY = 155, HALF = 55, PY = MY - HALF, QY = MY + HALF;
  var TMIN = 35, TMAX = 145;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function pol(cx, cy, r, t) { return { x: cx + r * Math.cos(t * DEG), y: cy - r * Math.sin(t * DEG) }; }
  function wedgeD(cx, cy, r, t1, span) {
    var p1 = pol(cx, cy, r, t1), p2 = pol(cx, cy, r, t1 + span);
    return 'M' + r3(cx) + ' ' + r3(cy) + ' L' + r3(p1.x) + ' ' + r3(p1.y) + ' A' + r + ' ' + r + ' 0 '
      + (span > 180 ? 1 : 0) + ' 0 ' + r3(p2.x) + ' ' + r3(p2.y) + ' Z';
  }
  function setAttrs(el, obj) {
    if (!el) return;
    Object.keys(obj).forEach(function (k) { el.setAttribute(k, obj[k]); });
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function mathT(id, size, fill) {
    return '<text id="' + id + '" x="0" y="0" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle"></text>';
  }
  function keyDelta(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -1;
    if (e.key === 'PageUp') return 5;
    if (e.key === 'PageDown') return -5;
    return 0;
  }
  /* ---------- the eight angles ----------
     1-4 at the upper line (upper right, upper left, lower left, lower right),
     5-8 at the lower line, in the same order. */
  function valOf(i, th, tau) {
    var k = (i - 1) % 4, phi = i <= 4 ? th : th - tau;
    return (k === 0 || k === 2) ? phi : 180 - phi;
  }
  function rel(i, j) {
    var vi = i <= 4 ? 0 : 1, vj = j <= 4 ? 0 : 1;
    var ki = (i - 1) % 4, kj = (j - 1) % 4;
    if (vi === vj) return (Math.abs(ki - kj) === 2) ? 'vert' : 'adj';
    var udI = ki < 2, udJ = kj < 2, lrI = (ki === 0 || ki === 3), lrJ = (kj === 0 || kj === 3);
    var P1 = vi === 0 ? { ud: udI, lr: lrI } : { ud: udJ, lr: lrJ };
    var Q1 = vi === 0 ? { ud: udJ, lr: lrJ } : { ud: udI, lr: lrI };
    var sameUD = P1.ud === Q1.ud, sameLR = P1.lr === Q1.lr;
    if (sameUD && sameLR) return 'corr';
    if (!sameUD && !sameLR) return P1.ud ? 'altOut' : 'altIn';
    if (!sameUD && sameLR) return P1.ud ? 'coOut' : 'coIn';
    return 'mix';
  }
  /* ---------- the figure ---------- */
  function figMarkup(pre, withHandle) {
    var s = '<defs><clipPath id="' + pre + 'Clip"><rect x="4" y="2" width="394" height="296"/></clipPath></defs>'
      + '<g clip-path="url(#' + pre + 'Clip)">'
      + '<line id="' + pre + 'L1" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
      + '<line id="' + pre + 'L2" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
      + '<line id="' + pre + 'T" stroke="' + CT + '" stroke-width="3" stroke-linecap="round"/></g>';
    for (var i = 1; i <= 8; i++) {
      s += '<path id="' + pre + 'W' + i + '" stroke-width="1.5" pointer-events="none"/>'
        + mathT(pre + 'N' + i, 14, INK);
    }
    s += '<path id="' + pre + 'A1" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path id="' + pre + 'A2" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + mathT(pre + 'Ta', 16, INK) + mathT(pre + 'Tb', 16, INK);
    if (withHandle) {
      s += '<g id="hT" tabindex="0" role="slider" aria-label="קצה החותך. חצים משנים את זווית החותך" aria-valuemin="' + TMIN
        + '" aria-valuemax="' + TMAX + '" aria-valuenow="65" style="cursor:grab">'
        + '<circle r="44" fill="transparent"/><circle r="10" fill="#fff" stroke="' + C1 + '" stroke-width="4.5"/></g>';
    }
    return s;
  }
  var SELC = [{ f: '#ea580c', o: '.42' }, { f: '#7c3aed', o: '.4' }];
  function placeFig(get, pre, th, tau, o) {
    o = o || {};
    var tt = Math.tan(tau * DEG), c = Math.cos(th * DEG), s = Math.sin(th * DEG);
    var P = { x: MX + HALF * c / s, y: PY }, Q = { x: MX - HALF * c / s, y: QY };
    setAttrs(get(pre + 'L1'), { x1: -20, y1: PY, x2: VW + 20, y2: PY });
    setAttrs(get(pre + 'L2'), { x1: -20, y1: r1(Q.y + (Q.x + 20) * tt), x2: VW + 20, y2: r1(Q.y - (VW + 20 - Q.x) * tt) });
    var T1 = { x: P.x + 62 * c, y: P.y - 62 * s }, T2 = { x: Q.x - 52 * c, y: Q.y + 52 * s };
    setAttrs(get(pre + 'T'), { x1: r1(T1.x), y1: r1(T1.y), x2: r1(T2.x), y2: r1(T2.y) });
    for (var i = 1; i <= 8; i++) {
      var v = i <= 4 ? P : Q, al = i <= 4 ? 0 : tau, k = (i - 1) % 4, phi = th - al, t1, span;
      if (k === 0) { t1 = al; span = phi; }
      else if (k === 1) { t1 = th; span = 180 - phi; }
      else if (k === 2) { t1 = al + 180; span = phi; }
      else { t1 = th + 180; span = 180 - phi; }
      var si = o.sel ? o.sel.indexOf(i) : -1;
      var w = get(pre + 'W' + i), n = get(pre + 'N' + i);
      setAttrs(w, { d: wedgeD(v.x, v.y, 24, t1, span), fill: si >= 0 ? SELC[si].f : PAL.main, 'fill-opacity': si >= 0 ? SELC[si].o : '.14',
        stroke: si >= 0 ? SELC[si].f : PAL.dark });
      var lab = o.labels ? (o.labels[i - 1] || '') : String(i);
      var lp = pol(v.x, v.y, span < 40 ? 52 : 46, t1 + span / 2);
      n.textContent = lab;
      setAttrs(n, { x: r1(clamp(lp.x, 22, VW - 22)), y: r1(clamp(lp.y + 5, 16, VH - 8)), 'font-size': lab.length > 3 ? 13 : 15,
        fill: lab === '?' ? BAD : INK });
    }
    var par = tau === 0;
    setAttrs(get(pre + 'A1'), { d: 'M360 ' + (PY - 7) + ' L368 ' + PY + ' L360 ' + (PY + 7) + ' M370 ' + (PY - 7) + ' L378 ' + PY + ' L370 ' + (PY + 7), opacity: par ? 1 : 0 });
    setAttrs(get(pre + 'A2'), { d: 'M360 ' + (QY - 7) + ' L368 ' + QY + ' L360 ' + (QY + 7) + ' M370 ' + (QY - 7) + ' L378 ' + QY + ' L370 ' + (QY + 7), opacity: par ? 1 : 0 });
    var ta = get(pre + 'Ta'), tb = get(pre + 'Tb');
    ta.textContent = 'a'; tb.textContent = 'b';
    setAttrs(ta, { x: 22, y: PY - 10 });
    setAttrs(tb, { x: 22, y: r1(Q.y + (Q.x - 22) * tt - 10) });
    var H = get('hT');
    if (H) H.setAttribute('transform', 'translate(' + r1(T1.x) + ' ' + r1(T1.y) + ')');
    return { P: P, Q: Q };
  }
  function figPic(th, tau, labels) {
    return function (ctx) {
      ctx.draw(figMarkup('q', false));
      placeFig(ctx.el, 'q', th, tau, { labels: labels });
    };
  }
  /* ---------- shared scene builder ---------- */
  var BTN = 'min-height:44px;min-width:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.5px solid '
    + PAL.line + ';border-radius:12px;background:#fff;color:' + INK + ';cursor:pointer;font-family:Heebo,sans-serif;padding:2px 4px;line-height:1.15';
  function buildScene(ctx, cfg) {
    var S = { theta: cfg.theta, tau: 0, sel: [] };
    ctx.draw(figMarkup('f', !!cfg.handle));
    var html = (cfg.strip || '') + '<div dir="ltr" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px">';
    for (var i = 1; i <= 8; i++) {
      html += '<button type="button" data-i="' + i + '" aria-pressed="false" aria-label="סמן זווית ' + i + '" style="' + BTN + '">'
        + '<b style="font-family:Secular One,sans-serif;font-size:16px">' + i + '</b>'
        + (cfg.values ? '<span class="math" data-bv="' + i + '" style="font-family:Secular One,sans-serif;font-size:13px;color:' + MUTED + '"></span>' : '') + '</button>';
    }
    html += '</div>';
    if (cfg.handle) {
      html += '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px;margin-top:8px"><div class="unit" dir="ltr" style="gap:5px;padding:6px 6px">'
        + '<b style="font-size:13px">זווית 1</b>'
        + [-5, -1].map(function (d) { return '<button type="button" data-d="' + d + '" aria-label="הקטן את זווית 1 ב־' + Math.abs(d) + ' מעלות">−' + Math.abs(d) + '</button>'; }).join('')
        + '<bdi class="var math" dir="ltr" data-tv style="min-width:50px" aria-live="polite"></bdi>'
        + [1, 5].map(function (d) { return '<button type="button" data-d="' + d + '" aria-label="הגדל את זווית 1 ב־' + d + ' מעלות">+' + d + '</button>'; }).join('')
        + '</div></div>';
    }
    html += (cfg.after || '');
    var box = ctx.extra(html);
    ctx.register('controls', box);
    var hT = ctx.el('hT');
    var api = { S: S, box: box };
    function paint() {
      placeFig(ctx.el, 'f', S.theta, S.tau, { sel: S.sel });
      box.querySelectorAll('[data-i]').forEach(function (b) {
        var i = Number(b.getAttribute('data-i')), si = S.sel.indexOf(i);
        b.setAttribute('aria-pressed', si >= 0 ? 'true' : 'false');
        b.style.background = si >= 0 ? (si === 0 ? '#ffedd5' : '#ede9fe') : '#fff';
        b.style.borderColor = si >= 0 ? SELC[si].f : PAL.line;
        var bv = b.querySelector('[data-bv]');
        if (bv) bv.textContent = valOf(i, S.theta, S.tau) + '°';
      });
      var tv = box.querySelector('[data-tv]');
      if (tv) tv.textContent = S.theta + '°';
      if (hT) setAttrs(hT, { 'aria-valuenow': S.theta, 'aria-valuetext': S.theta + ' מעלות' });
      if (cfg.paint) cfg.paint(S, box);
    }
    api.paint = paint;
    api.setTheta = function (v) {
      v = clamp(Math.round(v), TMIN, TMAX);
      if (v === S.theta) return;
      S.theta = v;
      ctx.sfx('tick');
      paint();
      cfg.on('theta', S, api);
    };
    api.setTau = function (t) {
      S.tau = t;
      paint();
      cfg.on('tau', S, api);
    };
    box.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-i')), p = S.sel.indexOf(i);
        if (p >= 0) S.sel.splice(p, 1);
        else { if (S.sel.length === 2) S.sel.shift(); S.sel.push(i); }
        ctx.sfx('click');
        paint();
        cfg.on('pick', S, api);
      });
    });
    box.querySelectorAll('[data-d]').forEach(function (b) {
      b.addEventListener('click', function () { api.setTheta(S.theta + Number(b.getAttribute('data-d'))); });
    });
    if (hT) {
      hT.addEventListener('keydown', function (e) {
        if (e.key === 'Home') { e.preventDefault(); api.setTheta(TMIN); return; }
        if (e.key === 'End') { e.preventDefault(); api.setTheta(TMAX); return; }
        var d = keyDelta(e);
        if (!d) return;
        e.preventDefault();
        api.setTheta(S.theta + d);
      });
      ctx.drag(hT, {
        move: function (x, y) {
          var ang = Math.atan2(-(y - MY), x - MX) / DEG;
          ang = ((ang % 180) + 180) % 180;
          api.setTheta(Math.round(ang));
        }
      });
    }
    paint();
    return api;
  }
  function cellHtml(label, key, color) {
    return '<div><b>' + label + '</b><span class="math" dir="ltr" data-v="' + key + '" style="color:' + color + '"></span></div>';
  }
  function pairStr(a, b) {
    return a === b ? a + '° = ' + b + '°' : (a + b === 180 ? a + '° + ' + b + '° = 180°' : a + '°  ,  ' + b + '°');
  }
  function pairName(i, j) { return m('∠' + i) + ' ו־' + m('∠' + j); }
  /* what to say about a wrong pair, shared by every scene */
  function wrongPair(r, i, j, want) {
    var who = pairName(i, j);
    if (r === 'vert') return who + ' הן קדקודיות: הן שוות תמיד, גם בלי מקבילים. ' + want;
    if (r === 'adj') return who + ' סמוכות על אותו קו ישר, ולכן הן משלימות ל־' + m('180°') + '. ' + want;
    if (r === 'corr') return who + ' מתאימות: אותו מקום בשתי נקודות החיתוך, ושוות. ' + want;
    if (r === 'altIn' || r === 'altOut') return who + ' מתחלפות: בצדדים מנוגדים של החותך, ושוות. ' + want;
    if (r === 'coIn' || r === 'coOut') return who + ' חד־צדדיות: באותו צד של החותך, והן משלימות ל־' + m('180°') + '. ' + want;
    return who + ' מצד אחד של החותך ומצד שני: הן משלימות ל־' + m('180°') + ', אבל זה לא זוג עם שם מיוחד כאן. ' + want;
  }
  /* ---------- step 1: corresponding angles ---------- */
  function corrScene(ctx) {
    var vis = {}, doneOnce = false, api = null;
    function nVis() { return Object.keys(vis).length; }
    function curCorr(S) { return S.sel.length === 2 && rel(S.sel[0], S.sel[1]) === 'corr'; }
    function progress(S) {
      var a = S.sel[0], b = S.sel[1], va = valOf(a, S.theta, 0), vb = valOf(b, S.theta, 0);
      if (nVis() >= 3) {
        ctx.note(pairName(a, b) + ' מתאימות, והן שוות בכל זווית חותך שבדקת: ' + m(va + '° = ' + vb + '°') + '. כשהישרים מקבילים, מתאימות שוות.', 'good');
        if (!doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
      } else {
        ctx.note(pairName(a, b) + ' מתאימות: ' + m(va + '° = ' + vb + '°') + '. שנה את זווית החותך ובדוק שהן נשארות שוות (' + nVis() + ' מתוך 3).');
      }
    }
    function mark(S) { if (curCorr(S)) vis[S.theta] = 1; }
    api = buildScene(ctx, {
      theta: 65, handle: true, values: true,
      strip: '<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">' + cellHtml('הזוג שסימנת', 'pair', INK)
        + '<div><b>זוויות חותך שבדקת</b><span data-v="seen" style="color:' + CT + '"></span></div></div>',
      paint: function (S, box) {
        var p = box.querySelector('[data-v="pair"]'), sn = box.querySelector('[data-v="seen"]');
        p.textContent = S.sel.length === 2 ? pairStr(valOf(S.sel[0], S.theta, 0), valOf(S.sel[1], S.theta, 0)) : '—';
        sn.textContent = nVis() + ' מתוך 3';
      },
      on: function (kind, S, a) {
        if (kind === 'pick') {
          if (S.sel.length < 2) { ctx.note('בחר זווית נוספת. מתאימות נמצאות באותו מקום בשתי נקודות החיתוך.'); return; }
          var r = rel(S.sel[0], S.sel[1]);
          if (r === 'corr') { mark(S); a.paint(); progress(S); return; }
          ctx.sfx('error');
          ctx.note(wrongPair(r, S.sel[0], S.sel[1], 'חפש זוג שנמצא באותו מקום בכל נקודת חיתוך, למשל שתיהן מעל הישר ומימין לחותך.'));
        } else if (kind === 'theta') {
          if (S.sel.length === 2 && curCorr(S)) { mark(S); a.paint(); progress(S); }
          else ctx.note('זווית ' + m('1') + ' היא עכשיו ' + m(S.theta + '°') + '. סמן זוג זוויות מתאימות כדי לראות אם הן נשארות שוות.');
        }
      }
    });
    ctx.note('החותך חותך שני ישרים מקבילים ויוצר שמונה זוויות. סמן שתי זוויות מתאימות, ואז שנה את זווית החותך בגרירה, בכפתורים או בחיצים.');
  }
  /* ---------- step 3: alternate angles ---------- */
  function altScene(ctx) {
    var TH = 58, KNOWN = 4, UNK = 6, ANS = 180 - TH, guess = 90, pairOK = false, ansOK = false, doneOnce = false;
    var gHtml = '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px;margin-top:8px"><div class="unit" dir="ltr" style="gap:4px;padding:6px 4px">'
      + '<b style="font-size:13px">זווית 6</b>'
      + [-10, -1].map(function (d) { return '<button type="button" data-g="' + d + '" aria-label="הקטן את הניחוש ב־' + Math.abs(d) + ' מעלות">−' + Math.abs(d) + '</button>'; }).join('')
      + '<bdi class="var math" dir="ltr" data-gv style="min-width:50px" aria-live="polite"></bdi>'
      + [1, 10].map(function (d) { return '<button type="button" data-g="' + d + '" aria-label="הגדל את הניחוש ב־' + d + ' מעלות">+' + d + '</button>'; }).join('')
      + '</div></div>';
    function finish() {
      if (pairOK && ansOK && !doneOnce) {
        doneOnce = true;
        ctx.sfx('correct'); ctx.burst(16); ctx.solved();
        ctx.note('מתחלפות שוות כשהישרים מקבילים: ' + m('∠6 = ∠4 = ' + ANS + '°') + '. זוג מתחלפות וגם הזווית החסרה, שניהם מוכנים.', 'good');
      }
    }
    var api = buildScene(ctx, {
      theta: TH, handle: false, values: false,
      strip: '<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
        + '<div><b>זווית 4 נתונה</b><span class="math" dir="ltr" style="color:' + C1 + '">' + ANS + '°</span></div>'
        + '<div><b>זווית 6 היא</b><span class="math" dir="ltr" data-v="g" style="color:' + C2 + '"></span></div></div>',
      after: gHtml,
      paint: function (S, box) {
        box.querySelector('[data-v="g"]').textContent = guess + '°';
        var gv = box.querySelector('[data-gv]');
        if (gv) gv.textContent = guess + '°';
      },
      on: function (kind, S, a) {
        if (kind !== 'pick') return;
        if (S.sel.length < 2) { ctx.note('בחר זווית נוספת. מתחלפות נמצאות בין שני הישרים, בצדדים מנוגדים של החותך.'); return; }
        var r = rel(S.sel[0], S.sel[1]);
        if (r === 'altIn') {
          pairOK = true;
          ctx.sfx('correct');
          ctx.note(pairName(S.sel[0], S.sel[1]) + ' מתחלפות: בין הישרים ובצדדים מנוגדים. הן שוות. ' + (ansOK ? '' : 'עכשיו מצא את זווית ' + m('6') + ' והקש "בדוק".'));
          finish();
        } else if (r === 'altOut') {
          ctx.sfx('error');
          ctx.note(pairName(S.sel[0], S.sel[1]) + ' גם הן מתחלפות ושוות, אבל מחוץ לישרים (מתחלפות חיצוניות). כאן חפש זוג שנמצא בין שני הישרים.');
        } else {
          ctx.sfx('error');
          ctx.note(wrongPair(r, S.sel[0], S.sel[1], 'מתחלפות הן בין הישרים, אחת מכל צד של החותך.'));
        }
      }
    });
    function setG(v) {
      v = clamp(v, 10, 170);
      if (v === guess) return;
      guess = v; ctx.sfx('tick'); api.paint();
    }
    api.box.querySelectorAll('[data-g]').forEach(function (b) {
      b.addEventListener('click', function () { setG(guess + Number(b.getAttribute('data-g'))); });
    });
    ctx.button('בדוק את זווית 6', function () {
      if (guess === ANS) {
        ansOK = true; ctx.sfx('correct');
        if (pairOK) finish();
        else ctx.note('נכון: ' + m('∠6 = ∠4 = ' + ANS + '°') + '. עכשיו סמן את זוג המתחלפות בין שני הישרים.', 'good');
      } else if (guess === TH) {
        ctx.sfx('error');
        ctx.note('קיבלת ' + m(TH + '°') + ', כלומר ' + m('180° − ' + ANS + '°') + '. זו זווית ' + m('5') + ', החד־צדדית של זווית ' + m('4') + '. מתחלפת שווה, ולא משלימה.');
      } else if (guess === 90) {
        ctx.sfx('error');
        ctx.note('הזווית ' + m('4') + ' היא ' + m(ANS + '°') + ', ומתחלפת לה שווה לה. מה ערך ' + m('6') + '?');
      } else {
        ctx.sfx('error');
        ctx.note('עוד לא. זווית ' + m('6') + ' מתחלפת לזווית ' + m('4') + ' ' + (guess < ANS ? ', ולכן גדולה יותר.' : ', ולכן קטנה יותר.'));
      }
    }, { id: 'chk', target: 'chk' });
    ctx.note('זווית ' + m('4') + ' היא ' + m(ANS + '°') + '. סמן זוג זוויות מתחלפות בין שני הישרים, והגדר את זווית ' + m('6') + ' בכפתורים.');
  }
  /* ---------- step 5: co-interior angles, and lines that are not parallel ---------- */
  function coScene(ctx) {
    var TILT = 12, vis = {}, tiltSeen = false, doneOnce = false;
    function nVis() { return Object.keys(vis).length; }
    function isCo(S) { return S.sel.length === 2 && rel(S.sel[0], S.sel[1]) === 'coIn'; }
    function check(S) {
      if (!isCo(S)) return;
      if (S.tau === 0) vis[S.theta] = 1; else tiltSeen = true;
      if (!doneOnce && nVis() >= 3 && tiltSeen) {
        doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved();
        ctx.note('כשהישרים מקבילים, חד־צדדיות משלימות ל־' + m('180°') + ' בכל זווית חותך. כשהם לא מקבילים, הסכום אחר.', 'good');
      }
    }
    var tiltBtn = null;
    var api = buildScene(ctx, {
      theta: 65, handle: true, values: true,
      strip: '<div class="sceneStrip"><div><b>סכום הזוג שסימנת</b><span class="math" dir="ltr" data-v="sum" style="color:' + INK + '">—</span></div>'
        + '<div><b>זוויות חותך שבדקת על ישרים מקבילים</b><span data-v="seen" style="color:' + CT + '"></span></div></div>',
      paint: function (S, box) {
        var sm = box.querySelector('[data-v="sum"]');
        if (S.sel.length === 2) {
          var a = valOf(S.sel[0], S.theta, S.tau), b = valOf(S.sel[1], S.theta, S.tau);
          sm.textContent = a + '° + ' + b + '° = ' + (a + b) + '°';
          sm.style.color = a + b === 180 ? PAL.good : BAD;
        } else { sm.textContent = '—'; sm.style.color = INK; }
        box.querySelector('[data-v="seen"]').textContent = nVis() + ' מתוך 3' + (tiltSeen ? ' · ראית גם ישרים לא מקבילים' : '');
      },
      on: function (kind, S, a) {
        if (kind === 'pick') {
          if (S.sel.length < 2) { ctx.note('בחר זווית נוספת. חד־צדדיות נמצאות בין הישרים, באותו צד של החותך.'); return; }
          var r = rel(S.sel[0], S.sel[1]);
          if (r === 'coIn') {
            var x = valOf(S.sel[0], S.theta, S.tau), y = valOf(S.sel[1], S.theta, S.tau);
            if (x === y && S.tau === 0) ctx.note('כאן שתיהן ' + m('90°') + ', ולכן במקרה שוות. שנה את זווית החותך ותראה שהן לא שוות, אלא משלימות ל־' + m('180°') + '.');
            else ctx.note(pairName(S.sel[0], S.sel[1]) + ' חד־צדדיות: ' + m(x + '°') + ' ו־' + m(y + '°') + '. הן לא שוות, הסכום שלהן הוא מה שקבוע.');
            check(S); a.paint();
            if (!doneOnce) ctx.note('נבדקו ' + nVis() + ' מתוך 3 זוויות חותך על ישרים מקבילים' + (tiltSeen ? '.' : ', ועדיין לא הטית את הישר התחתון.'));
          } else {
            ctx.sfx('error');
            ctx.note(wrongPair(r, S.sel[0], S.sel[1], 'חד־צדדיות הן בין הישרים, שתיהן באותו צד של החותך.'));
          }
        } else if (kind === 'theta') {
          if (!isCo(S)) { ctx.note('סמן קודם זוג חד־צדדיות: שתי זוויות בין הישרים, באותו צד של החותך.'); return; }
          check(S); a.paint();
          var p = valOf(S.sel[0], S.theta, S.tau), q = valOf(S.sel[1], S.theta, S.tau);
          if (!doneOnce) {
            ctx.note(S.tau === 0 ? 'שוב ' + m(p + '° + ' + q + '° = 180°') + ' (' + nVis() + ' מתוך 3). הזוג לא שווה, אבל הסכום נשאר.'
              : 'הישרים לא מקבילים, והסכום ' + m((p + q) + '°') + ' כבר לא ' + m('180°') + '.');
          }
        } else if (kind === 'tau') {
          if (!isCo(S)) { ctx.note('סמן קודם זוג חד־צדדיות, ואז הטה את הישר התחתון כדי לראות מה קורה.'); return; }
          check(S); a.paint();
          var u = valOf(S.sel[0], S.theta, S.tau), v = valOf(S.sel[1], S.theta, S.tau);
          if (S.tau !== 0) ctx.note('הישר התחתון מוטה, והישרים לא מקבילים: ' + m(u + '° + ' + v + '° = ' + (u + v) + '°') + '. הקשר ל־' + m('180°') + ' נשבר.');
          else ctx.note('חזרו ישרים מקבילים, והסכום ' + m('180°') + ' חזר.');
        }
      }
    });
    tiltBtn = ctx.button('הטה את הישר התחתון', function (b) {
      api.setTau(api.S.tau === 0 ? TILT : 0);
      b.textContent = api.S.tau === 0 ? 'הטה את הישר התחתון' : 'החזר לישרים מקבילים';
      ctx.sfx('click');
    }, { id: 'tiltBtn', target: 'tilt' });
    ctx.note('חד־צדדיות הן שתי זוויות בין הישרים, באותו צד של החותך. סמן זוג כזה ושנה את זווית החותך בגרירה, בכפתורים או בחיצים.');
  }
  /* ---------- steps ---------- */
  var steps = [
    {
      mode: 'intro',
      tA: 'ישרים מקבילים',
      sub: 'חותך אחד, שמונה זוויות, וכמה חוקים פשוטים.',
      tip: 'שלום, אני אליהו. כשחותך פוגש שני ישרים מקבילים, הזוויות שנוצרות מתנהגות לפי חוקים קבועים. נגלה אותם.',
      emoji: '📐',
      eq: 'מתאימות ומתחלפות שוות · חד־צדדיות ' + m('180°'),
      note: 'חותך שעובר בשני ישרים מקבילים יוצר שמונה זוויות. זוויות מתאימות שוות, זוויות מתחלפות שוות, וזוויות חד־צדדיות משלימות ל־' + m('180°') + '. את זה אפשר גם להפוך: אם הקשר מתקיים, הישרים מקבילים.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'זוויות מתאימות',
      sub: 'סמן זוג זוויות מתאימות, ושנה את זווית החותך בגרירה, בכפתורים או בחיצים.',
      tip: 'מתאימות נמצאות באותו מקום בכל אחת מנקודות החיתוך. סמן זוג כזה, ושנה את החותך כדי לבדוק שהן נשארות שוות.',
      cue: 'סמן זוג מתאימות ובדוק שלוש זוויות חותך',
      cueDone: 'מתאימות שוות בכל זווית חותך. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [VW, VH],
      alt: 'שני ישרים מקבילים אופקיים ואחד חותך אותם, עם שמונה זוויות ממוספרות. בקצה העליון של החותך ידית שאפשר להזיז כדי לשנות את זווית החותך',
      nudge: { target: 'controls', text: 'לחץ על שתי זוויות שנמצאות באותו מקום בשתי נקודות החיתוך, ואז שנה את זווית החותך בכפתורי הפלוס והמינוס.' },
      setup: corrScene
    },
    {
      mode: 'quiz',
      tA: 'איך קוראים לזוג?',
      sub: 'הישרים ' + m('a') + ' ו־' + m('b') + ' מקבילים. מה היחס בין הזווית ' + m('70°') + ' לזווית ' + m('?') + ', ומה ערכה של ' + m('?') + '?',
      tip: 'הסתכל איפה כל זווית נמצאת ביחס לישר ולחותך. אחר כך הכרע אם הזוג שווה או משלים.',
      btn: 'המשך ←',
      aspect: [VW, VH],
      alt: 'שני ישרים מקבילים וחותך. בנקודת החיתוך העליונה הזווית שמעל הישר ומימין לחותך היא 70 מעלות, ובנקודת החיתוך התחתונה אותה זווית מסומנת בסימן שאלה',
      setup: figPic(70, 0, ['70°', '', '', '', '?', '', '', '']),
      win: 'נכון. שתיהן מעל הישר ומימין לחותך, ולכן מתאימות ושוות.',
      wrongSay: 'בדוק אם שתי הזוויות באותו מקום בשתי נקודות החיתוך או בצדדים מנוגדים. ואז, שוות או משלימות?',
      opts: [
        { t: 'מתחלפות, ' + m('70°'), f: 'מתחלפות הן בצדדים מנוגדים של החותך. כאן שתי הזוויות מימין לחותך ומעל הישר, ולכן הן מתאימות.' },
        { t: 'מתאימות, ' + m('70°'), c: true, f: 'נכון: אותו מקום בכל נקודת חיתוך, ולכן מתאימות, והן שוות: ' + m('70°') + '.' },
        { t: 'מתאימות, ' + m('110°'), f: 'זיהית נכון שהן מתאימות, אבל מתאימות שוות ולא משלימות. ' + m('110°') + ' היה נכון לזווית סמוכה.' },
        { t: 'חד־צדדיות, ' + m('110°'), f: 'חד־צדדיות נמצאות בין הישרים, באותו צד של החותך. כאן שתיהן מעל הישר שלהן, והן מתאימות.' }
      ],
      hints: [
        'שאל את עצמך: האם שתי הזוויות באותו מקום בשתי נקודות החיתוך?',
        'כשהן באותו מקום, הן מתאימות. ומה היחס בין מתאימות כששני הישרים מקבילים?',
        'מתאימות שוות, ולכן ערך ' + m('?') + ' הוא ' + m('70°') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'זוויות מתחלפות',
      sub: 'סמן זוג מתחלפות בין שני הישרים, ומצא את זווית ' + m('6') + ' בכפתורים.',
      tip: 'מתחלפות נמצאות בין הישרים, בצדדים מנוגדים של החותך. אם ידעת אחת, מה ערך האחרת?',
      cue: 'סמן זוג מתחלפות וקבע את זווית 6',
      cueDone: 'מצאת זוג מתחלפות ואת הזווית החסרה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [VW, VH],
      alt: 'שני ישרים מקבילים וחותך עם שמונה זוויות ממוספרות. זווית 4 נתונה, וזווית 6 היא הזווית שצריך למצוא',
      nudge: { target: 'controls', text: 'סמן שתי זוויות שנמצאות בין הישרים, אחת בכל צד של החותך. אחר כך קבע את זווית 6 ולחץ "בדוק".' },
      setup: altScene
    },
    {
      mode: 'quiz',
      tA: 'מתחלפות עם x',
      sub: 'הישרים מקבילים. שתי הזוויות המתחלפות הן ' + m('3x') + ' ו־' + m('x + 40') + '. כמה הוא ' + m('x') + '?',
      tip: 'מתחלפות שוות. כתוב משוואה, ופתור אותה.',
      btn: 'המשך ←',
      aspect: [VW, VH],
      alt: 'שני ישרים מקבילים וחותך. בין הישרים, משמאל לחותך למעלה, זווית 3x, ובצד הנגדי למטה זווית x ועוד 40',
      setup: figPic(60, 0, ['', '', '3x', '', 'x+40', '', '', '']),
      win: 'מעולה. מתחלפות שוות, ולכן ' + m('3x = x + 40') + ' ומקבלים ' + m('x = 20') + '.',
      wrongSay: 'מתחלפות שוות זו לזו. כתוב משוואה: ' + m('3x') + ' שווה ל־' + m('x + 40') + '.',
      opts: [
        { t: m('x = 40'), f: 'מ־' + m('3x = x + 40') + ' מקבלים ' + m('2x = 40') + '. עוד צריך לחלק ב־' + m('2') + '.' },
        { t: m('x = 35'), f: 'כתבת ' + m('3x + x + 40 = 180') + ', כאילו הן חד־צדדיות. מתחלפות שוות ולא משלימות.' },
        { t: m('x = 60'), f: m('60°') + ' הוא ערך הזווית ' + m('3x') + ', לא ערך ' + m('x') + '. נציב ' + m('x = 20') + ': ' + m('3 · 20 = 60') + '.' },
        { t: m('x = 20'), c: true, f: 'נכון: ' + m('3x = x + 40') + ', ' + m('2x = 40') + ', ' + m('x = 20') + '. כל זווית ' + m('60°') + '.' }
      ],
      hints: [
        'מתחלפות הן זוויות שוות כשהישרים מקבילים.',
        'כתוב ' + m('3x = x + 40') + ' והעבר את ' + m('x') + ' לצד אחד.',
        m('2x = 40') + ', ועכשיו חלק ב־' + m('2') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'חד־צדדיות והטיה',
      sub: 'סמן זוג חד־צדדיות, שנה את החותך בגרירה, בכפתורים או בחיצים, והטה את הישר התחתון.',
      tip: 'חד־צדדיות נמצאות בין הישרים, באותו צד של החותך. הן לא שוות. מה כן קבוע בהן?',
      cue: 'סמן חד־צדדיות, בדוק שלוש זוויות והטה את הישר',
      cueDone: 'ראית מקבילים ולא מקבילים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [VW, VH],
      alt: 'שני ישרים וחותך עם שמונה זוויות ממוספרות. בקצה העליון של החותך ידית לשינוי זווית החותך, וכפתור שמטה את הישר התחתון כך שהישרים כבר לא מקבילים',
      nudge: { target: 'controls', text: 'סמן את זוויות 3 ו־6, שנה את זווית החותך, ואז לחץ "הטה את הישר התחתון".' },
      setup: coScene
    },
    {
      mode: 'quiz',
      tA: 'חד־צדדיות',
      sub: 'הישרים מקבילים. שתי זוויות חד־צדדיות, האחת ' + m('115°') + '. מהי השנייה?',
      tip: 'חד־צדדיות לא שוות. מה הסכום שלהן?',
      btn: 'המשך ←',
      aspect: [VW, VH],
      alt: 'שני ישרים מקבילים וחותך. בין הישרים, בצד שמאל של החותך: בקודקוד העליון הזווית היא 115 מעלות, ובקודקוד התחתון הזווית שבאותו צד מסומנת בסימן שאלה',
      setup: figPic(115, 0, ['', '', '115°', '', '', '?', '', '']),
      win: 'נכון. חד־צדדיות משלימות ל־180°.',
      wrongSay: 'חד־צדדיות לא שוות. חשב מה צריך להוסיף ל־' + m('115°') + ' כדי להגיע לסכום הקבוע.',
      opts: [
        { t: m('65°'), c: true, f: 'נכון: ' + m('115° + ? = 180°') + ', ולכן ' + m('? = 65°') + '.' },
        { t: m('115°'), f: 'חשבת שחד־צדדיות שוות. אבל שוות הן מתאימות ומתחלפות. חד־צדדיות משלימות ל־' + m('180°') + '.' },
        { t: m('75°'), f: 'טעות חישוב: ' + m('180° − 115°') + ' הוא ' + m('65°') + ' ולא ' + m('75°') + '. חסר שוב.' },
        { t: m('245°'), f: 'השתמשת ב־' + m('360°') + '. כאן שתי הזוויות על אותו קו ישר צדדי, והסכום הוא ' + m('180°') + '.' }
      ],
      hints: [
        'חד־צדדיות אינן שוות. יש להן סכום קבוע.',
        'הסכום הקבוע הוא כמו של זוויות על קו ישר.',
        m('180° − 115°') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'האם הישרים מקבילים?',
      sub: 'בשרטוט שתי מתחלפות: ' + m('72°') + ' ו־' + m('68°') + '. האם הישרים ' + m('a') + ' ו־' + m('b') + ' מקבילים?',
      tip: 'אפשר להשתמש בקשר גם הפוך. מה קורה לישרים כשמתחלפות לא שוות?',
      btn: 'לסיכום ←',
      aspect: [VW, VH],
      alt: 'שני ישרים וחותך. הישר התחתון מוטה מעט, כך שהם כמעט מקבילים. בין הישרים משמאל לחותך למעלה זווית 72 מעלות, ובצד הנגדי למטה זווית 68 מעלות',
      setup: figPic(72, 4, ['', '', '72°', '', '68°', '', '', '']),
      win: 'נכון. אם המתחלפות לא שוות, הישרים לא מקבילים, גם אם נראים כמעט מקבילים.',
      wrongSay: 'השווה את שתי המתחלפות. האם הן שוות בדיוק?',
      opts: [
        { t: 'כן. כל שני ישרים עם חותך הם מקבילים', f: 'חותך אפשר להעביר גם דרך ישרים שאינם מקבילים. רק שוויון זוויות מבטיח מקבילות.' },
        { t: 'כן, כי ' + m('72°') + ' קרוב ל־' + m('68°'), f: 'קרוב לא מספיק. מקבילות דורשת שוויון מדויק של המתחלפות.' },
        { t: 'לא, כי המתחלפות לא שוות', c: true, f: 'נכון: ' + m('72° ≠ 68°') + '. מתחלפות שוות רק כשהישרים מקבילים, ולכן כאן הם לא.' },
        { t: 'לא, כי חד־צדדיות צריכות להיות שוות', f: 'חד־צדדיות לא צריכות להיות שוות. הן אמורות להשלים ל־' + m('180°') + ' כשהישרים מקבילים.' }
      ],
      hints: [
        'כשהישרים מקבילים, מתחלפות שוות. אפשר לבדוק את זה גם בכיוון ההפוך.',
        'האם ' + m('72°') + ' ו־' + m('68°') + ' שוות?',
        'אם המתחלפות לא שוות, הישרים לא מקבילים.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את הישרים המקבילים',
      sub: 'מתאימות, מתחלפות וחד־צדדיות, וגם איך להשתמש בהן להפך.',
      tip: 'כל הכבוד. כשרואים חותך, שאל איפה הזוויות נמצאות ואיזה קשר יש ביניהן.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'כשחותך פוגש שני ישרים מקבילים: מתאימות שוות, מתחלפות שוות, וחד־צדדיות משלימות. ואם הקשר לא מתקיים, הישרים לא מקבילים:',
      formula: 'מתאימות = מתחלפות · חד־צדדיות ' + m('180°')
    }
  ];
  window.NoamGame.boot({
    slug: 'yesharim-makbilim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'זיהוי מתאימות', math: '70° = 70°' },
      { step: 4, name: 'מתחלפות במשוואה', math: '3x = x + 40' },
      { step: 6, name: 'חד־צדדיות משלימות', math: '180° − 115°' },
      { step: 7, name: 'הוכחה שישרים לא מקבילים', math: '72° ≠ 68°' }
    ],
    bonus: {
      label: 'מכונת הזוויות 📐',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל חותך בין מקבילים, ומצא את הזווית החסרה.',
      setup: function (box, ctx) {
        var q = null, guess = 90;
        var KIND = { corr: 'מתאימות', alt: 'מתחלפות', co: 'חד־צדדיות' };
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          var kind = ['corr', 'alt', 'co'][rnd(0, 2)], th, known, target;
          do { th = rnd(40, 140); } while (th === 90);
          if (kind === 'corr') { known = rnd(1, 4); target = known + 4; if (rnd(0, 1)) { var t0 = known; known = target; target = t0; } }
          else if (kind === 'alt') { known = rnd(0, 1) ? 3 : 4; target = known === 3 ? 5 : 6; if (rnd(0, 1)) { var t1 = known; known = target; target = t1; } }
          else { known = rnd(0, 1) ? 3 : 4; target = known === 3 ? 6 : 5; if (rnd(0, 1)) { var t2 = known; known = target; target = t2; } }
          q = { kind: kind, th: th, known: known, target: target, kv: valOf(known, th, 0), ans: valOf(target, th, 0) };
          guess = 90;
        }
        box.innerHTML = '<div class="bTitle">מכונת הזוויות</div><div class="bSub" data-sub></div>'
          + '<svg data-pic viewBox="0 0 ' + VW + ' ' + VH + '" dir="ltr" role="img" aria-label="חותך בין שני ישרים מקבילים" style="width:100%;height:auto;display:block"></svg>'
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
          var labels = ['', '', '', '', '', '', '', ''];
          labels[q.known - 1] = q.kv + '°';
          labels[q.target - 1] = '?';
          pic.innerHTML = figMarkup('bn', false);
          placeFig(get, 'bn', q.th, 0, { labels: labels });
          chip.textContent = q.kv + '° → ?';
          sub.textContent = 'הישרים מקבילים. הזוויות המסומנות הן ' + KIND[q.kind] + '. מצא את הזווית עם סימן השאלה.';
          gEl.textContent = guess + '°';
          ok.hidden = true;
          forms.hidden = true;
        }
        function solution() {
          return q.kind === 'co' ? '180° − ' + q.kv + '° = ' + q.ans + '°' : q.ans + '° = ' + q.kv + '°';
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
            ok.textContent = 'נכון! ' + (q.kind === 'co' ? 'חד־צדדיות משלימות ל־180°.' : q.kind === 'alt' ? 'מתחלפות שוות.' : 'מתאימות שוות.');
            forms.hidden = false;
            forms.innerHTML = bdi(solution());
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            ok.textContent = q.kind === 'co' ? 'נסה שוב: חד־צדדיות משלימות ל־180°.' : 'נסה שוב: ' + KIND[q.kind] + ' שוות זו לזו.';
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
