/**
 * מד הזווית — an engine game.
 *
 * The idea: an angle is measured from one ray (the "shok") by reading the
 * protractor scale that starts at 0 on that ray. Angles are named by their
 * size (acute, right, obtuse, straight, full), and two angles that together
 * make a right angle (90°) or a straight angle (180°) complete each other.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var CA = PAL.dark, CB = '#c2410c', CG = '#15803d';
  var BAD = '#b91c1c', MUTED = '#475569';
  var DEG = Math.PI / 180;
  var VW = 402;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function pol(cx, cy, r, t) { return { x: cx + r * Math.cos(t * DEG), y: cy - r * Math.sin(t * DEG) }; }
  /** Angle of the point (x, y) seen from the centre, 0 to 360, counter-clockwise from the right. */
  function pointAng(cx, cy, x, y) {
    var a = Math.atan2(cy - y, x - cx) / DEG;
    return a < 0 ? a + 360 : a;
  }
  function wedgeD(cx, cy, r, t1, span) {
    if (span <= 0) return '';
    if (span >= 359.99) {
      return 'M' + r3(cx - r) + ' ' + r3(cy) + ' A' + r + ' ' + r + ' 0 1 0 ' + r3(cx + r) + ' ' + r3(cy)
        + ' A' + r + ' ' + r + ' 0 1 0 ' + r3(cx - r) + ' ' + r3(cy) + ' Z';
    }
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
    el.setAttribute('x', r1(clamp(pos.x, 24, VW - 24)));
    el.setAttribute('y', r1(pos.y + 5));
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function handleG(id, label, color, min, max, val) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + min + '" aria-valuemax="' + max
      + '" aria-valuenow="' + val + '" aria-valuetext="' + val + ' מעלות" style="cursor:grab">'
      + '<circle r="32" fill="transparent"/><circle r="10" fill="#fff" stroke="' + color + '" stroke-width="4.5"/></g>';
  }
  function stepperHtml(deltas, label, color) {
    var neg = deltas.filter(function (d) { return d < 0; }).sort(function (x, y) { return x - y; });
    var pos = deltas.filter(function (d) { return d > 0; }).sort(function (x, y) { return x - y; });
    function btn(d) {
      return '<button type="button" data-delta="' + d + '" aria-label="' + (d < 0 ? 'הקטן' : 'הגדל') + ' את ' + label + ' ב־'
        + Math.abs(d) + ' מעלות">' + (d < 0 ? '−' : '+') + Math.abs(d) + '</button>';
    }
    return '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px"><div class="unit" dir="ltr" style="gap:5px;padding:6px 6px">'
      + neg.map(btn).join('')
      + '<bdi class="var math" dir="ltr" data-value="a" style="min-width:54px;color:' + color + '" aria-live="polite"></bdi>'
      + pos.map(btn).join('') + '</div></div>';
  }
  function cell(label, key, color) {
    return '<div><b>' + label + '</b><span class="math" dir="ltr" data-v="' + key + '" style="color:' + color + '"></span></div>';
  }
  function tcell(label, key, color) {
    return '<div><b>' + label + '</b><span data-v="' + key + '" style="color:' + color + ';font-weight:800"></span></div>';
  }
  /**
   * The three routes to change the value: stepper buttons, arrow keys on the
   * handle, and a pointer drag. All of them call o.set(value).
   */
  function bindControls(ctx, box, handle, o) {
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { o.set(o.get() + Number(bt.getAttribute('data-delta'))); });
    });
    handle.addEventListener('keydown', function (e) {
      var d = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -1;
      else if (e.key === 'PageUp') d = o.big;
      else if (e.key === 'PageDown') d = -o.big;
      else if (e.key === 'Home') { e.preventDefault(); o.set(o.min()); return; }
      else if (e.key === 'End') { e.preventDefault(); o.set(o.max()); return; }
      if (!d) return;
      e.preventDefault();
      o.set(o.get() + d);
    });
    ctx.drag(ctx.svg, { move: function (x, y) { o.set(o.fromPoint(x, y)); } });
  }
  /* ---------- the protractor ---------- */
  /** A protractor on a baseline. Inner scale: 0 at the right. Outer scale: 0 at the left. */
  function protractorMarkup(cx, cy, R) {
    var d1 = '', d5 = '', d10 = '', t, p, q, len, s;
    for (t = 0; t <= 180; t += 1) {
      len = t % 10 === 0 ? 13 : (t % 5 === 0 ? 9 : 5);
      p = pol(cx, cy, R, t); q = pol(cx, cy, R - len, t);
      s = 'M' + r1(p.x) + ' ' + r1(p.y) + ' L' + r1(q.x) + ' ' + r1(q.y) + ' ';
      if (len === 13) d10 += s; else if (len === 9) d5 += s; else d1 += s;
    }
    var out = '<path d="M' + (cx - R) + ' ' + cy + ' A' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy + ' Z" fill="' + PAL.soft
      + '" fill-opacity=".6" stroke="' + INK + '" stroke-width="2"/>'
      + '<line x1="' + (cx - R - 8) + '" y1="' + cy + '" x2="' + (cx + R + 8) + '" y2="' + cy + '" stroke="' + INK + '" stroke-width="1.5"/>'
      + '<path d="' + d1 + '" stroke="' + MUTED + '" stroke-width="0.8" fill="none"/>'
      + '<path d="' + d5 + '" stroke="' + MUTED + '" stroke-width="1" fill="none"/>'
      + '<path d="' + d10 + '" stroke="' + INK + '" stroke-width="1.4" fill="none"/>';
    for (t = 0; t <= 180; t += 10) {
      p = pol(cx, cy, R - 25, t); q = pol(cx, cy, R - 49, t);
      out += '<text x="' + r1(p.x) + '" y="' + r1(p.y + 3.5) + '" direction="ltr" font-family="Secular One, sans-serif" font-size="9.5" fill="'
        + MUTED + '" text-anchor="middle">' + (180 - t) + '</text>'
        + '<text x="' + r1(q.x) + '" y="' + r1(q.y + 4) + '" direction="ltr" font-family="Secular One, sans-serif" font-size="11" font-weight="700" fill="'
        + INK + '" text-anchor="middle">' + t + '</text>';
    }
    return out + '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + INK + '"/>';
  }
  /* ---------- a pair of angles that complete each other ---------- */
  var PCX = 201, PCY = 228, PR = 150;
  function pairMarkup(pre) {
    return '<line id="' + pre + 'Tg" stroke="' + CG + '" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round"/>'
      + '<path id="' + pre + 'Wx" fill="' + CA + '" fill-opacity=".26" stroke="' + CA + '" stroke-width="2"/>'
      + '<path id="' + pre + 'Wy" fill="' + CB + '" fill-opacity=".26" stroke="' + CB + '" stroke-width="2"/>'
      + '<path id="' + pre + 'Sq" fill="none" stroke="' + CG + '" stroke-width="2"/>'
      + '<line x1="' + PCX + '" y1="' + PCY + '" x2="' + (PCX + PR) + '" y2="' + PCY + '" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>'
      + '<line id="' + pre + 'Kn" stroke="' + CA + '" stroke-width="3.5" stroke-linecap="round"/>'
      + '<line id="' + pre + 'En" stroke="' + CB + '" stroke-width="3.5" stroke-linecap="round"/>'
      + mathT(pre + 'Lx', 16, CA) + mathT(pre + 'Ly', 16, '#9a3412');
  }
  function pairUpdate(get, pre, x, y, total, lx, ly) {
    var tg = pol(PCX, PCY, PR, total), kn = pol(PCX, PCY, PR - 22, x), en = pol(PCX, PCY, PR, x + y);
    setAttrs(get(pre + 'Tg'), { x1: PCX, y1: PCY, x2: r1(tg.x), y2: r1(tg.y) });
    setAttrs(get(pre + 'Kn'), { x1: PCX, y1: PCY, x2: r1(kn.x), y2: r1(kn.y) });
    setAttrs(get(pre + 'En'), { x1: PCX, y1: PCY, x2: r1(en.x), y2: r1(en.y), stroke: x + y === total ? CG : CB });
    setAttrs(get(pre + 'Wx'), { d: wedgeD(PCX, PCY, 34, 0, x) });
    setAttrs(get(pre + 'Wy'), { d: wedgeD(PCX, PCY, 54, x, y) });
    setAttrs(get(pre + 'Sq'), { d: total === 90 ? 'M' + (PCX + 20) + ' ' + PCY + ' L' + (PCX + 20) + ' ' + (PCY - 20) + ' L' + PCX + ' ' + (PCY - 20) : '' });
    putLabel(get(pre + 'Lx'), pol(PCX, PCY, 84, x / 2), lx);
    putLabel(get(pre + 'Ly'), pol(PCX, PCY, 104, x + y / 2), ly);
  }
  /* ---------- step 1: measuring on the protractor ---------- */
  function measureScene(ctx) {
    var CX0 = 201, CY0 = 236, RR = 160, LEN = 168;
    var TASKS = [65, 140], ti = 0, a = 30, doneAll = false;
    ctx.draw(protractorMarkup(CX0, CY0, RR)
      + '<path id="wd" fill="' + CB + '" fill-opacity=".28" stroke="' + CB + '" stroke-width="2"/>'
      + '<line x1="' + CX0 + '" y1="' + CY0 + '" x2="' + (CX0 + LEN) + '" y2="' + CY0 + '" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>'
      + '<text x="' + (CX0 + 100) + '" y="' + (CY0 + 24) + '" text-anchor="middle" font-family="Heebo, sans-serif" font-size="14" font-weight="700" fill="' + INK + '">השוק (0 פנימי)</text>'
      + '<line id="ray" stroke="' + CB + '" stroke-width="4.5" stroke-linecap="round"/>'
      + handleG('hR', 'קצה הקרן הנמדדת. חצים משנים את הזווית ממנה לשוק', CB, 0, 180, a));
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + cell('המטרה', 'goal', CG) + cell('סקאלה פנימית', 'in', INK) + cell('סקאלה חיצונית', 'out', MUTED) + '</div>'
      + '<div style="margin-top:8px">' + stepperHtml([-5, -1, 1, 5], 'הזווית', CB) + '</div>');
    ctx.register('controls', box);
    var hR = ctx.el('hR');
    function render() {
      var tip = pol(CX0, CY0, LEN, a);
      setAttrs(ctx.el('ray'), { x1: CX0, y1: CY0, x2: r1(tip.x), y2: r1(tip.y) });
      setAttrs(ctx.el('wd'), { d: wedgeD(CX0, CY0, 40, 0, a) });
      hR.setAttribute('transform', 'translate(' + r1(tip.x) + ' ' + r1(tip.y) + ')');
      setAttrs(hR, { 'aria-valuenow': a, 'aria-valuetext': a + ' מעלות' });
      box.querySelector('[data-v="goal"]').textContent = (doneAll ? TASKS[1] : TASKS[ti]) + '°';
      box.querySelector('[data-v="in"]').textContent = a + '°';
      box.querySelector('[data-v="out"]').textContent = (180 - a) + '°';
      box.querySelector('[data-value="a"]').textContent = a + '°';
      ctx.caption('קריאה בפנימית ' + m(a + '°') + ' · בחיצונית ' + m((180 - a) + '°'));
    }
    function note() {
      var t = doneAll ? TASKS[1] : TASKS[ti], out = 180 - t;
      if (a === t) {
        ctx.note('הקרן על ' + m(t + '°') + ' בסקאלה הפנימית, זו שמתחילה ב־0 על השוק. לחץ על "אשר את המדידה".', 'good');
      } else if (a === out) {
        ctx.note('הקרן על ' + m(a + '°') + ' בסקאלה הפנימית. המספר ' + m(t + '°') + ' נמצא בסקאלה החיצונית, שמתחילה ב־0 בצד שמאל, ולא בשוק שלך. קרא תמיד מהסקאלה שבה השוק עומד על ' + m('0') + '.');
      } else if (a < t) {
        ctx.note('הזווית ' + m(a + '°') + ' קטנה מ־' + m(t + '°') + ' ב־' + m((t - a) + '°') + '. הגדל אותה.');
      } else {
        ctx.note('הזווית ' + m(a + '°') + ' גדולה מ־' + m(t + '°') + ' ב־' + m((a - t) + '°') + '. הקטן אותה.');
      }
    }
    function set(v) {
      v = clamp(Math.round(v), 0, 180);
      if (v === a) return;
      a = v;
      ctx.sfx('tick');
      render(); note();
    }
    bindControls(ctx, box, hR, {
      get: function () { return a; }, set: set, big: 5,
      min: function () { return 0; }, max: function () { return 180; },
      fromPoint: function (x, y) {
        var p = pointAng(CX0, CY0, x, y);
        return p > 180 ? (p > 270 ? 0 : 180) : p;
      }
    });
    ctx.button('אשר את המדידה', function () {
      if (doneAll) return;
      var t = TASKS[ti];
      if (a !== t) {
        ctx.sfx('error');
        if (a === 180 - t) {
          ctx.note('זו קריאה מהסקאלה החיצונית: ' + m('180° − ' + t + '° = ' + a + '°') + '. השוק בצד ימין, ולכן קוראים בסקאלה הפנימית. הקרן צריכה להיות על ' + m(t + '°') + '.');
        } else {
          ctx.note('הקרן עדיין לא על ' + m(t + '°') + '. היא על ' + m(a + '°') + ' בסקאלה הפנימית.');
        }
        return;
      }
      ctx.sfx('correct');
      if (ti === 0) {
        ti = 1;
        ctx.burst(8);
        render();
        ctx.note('נכון, ' + m('65°') + '. עכשיו ' + m('140°') + '. זהירות: בסקאלה החיצונית אותה קרן תיראה כמו ' + m('40°') + ', וזה לא התשובה.', 'good');
      } else {
        doneAll = true;
        ctx.burst(16);
        ctx.note('שתי מדידות נכונות. הסקאלה הנכונה היא זו שמתחילה ב־' + m('0') + ' על הקרן שממנה מודדים.', 'good');
        ctx.solved();
      }
    }, { id: 'okBtn', target: 'controls' });
    render();
    ctx.note('הצב את הקרן על ' + m('65°') + ': השוק בצד ימין, ולכן קוראים בסקאלה הפנימית, זו שמתחילה ב־' + m('0') + ' על השוק.');
  }
  /* ---------- step 3: naming angles by size ---------- */
  function cls(a) {
    if (a === 0) return 'אפס';
    if (a < 90) return 'חדה';
    if (a === 90) return 'ישרה';
    if (a < 180) return 'קהה';
    if (a === 180) return 'שטוחה';
    if (a < 360) return 'קעורה';
    return 'מלאה';
  }
  function classScene(ctx) {
    var CX0 = 201, CY0 = 150, LEN = 108;
    var TASKS = ['קהה', 'ישרה', 'שטוחה', 'מלאה'], ti = 0, a = 45, doneAll = false;
    ctx.draw('<circle cx="' + CX0 + '" cy="' + CY0 + '" r="' + LEN + '" fill="none" stroke="' + PAL.line + '" stroke-width="1.5" stroke-dasharray="3 5"/>'
      + '<line x1="' + CX0 + '" y1="' + (CY0 - 118) + '" x2="' + CX0 + '" y2="' + (CY0 + 118) + '" stroke="' + PAL.line + '" stroke-width="1.5" stroke-dasharray="3 5"/>'
      + '<line x1="' + (CX0 - 118) + '" y1="' + CY0 + '" x2="' + (CX0 + 118) + '" y2="' + CY0 + '" stroke="' + PAL.line + '" stroke-width="1.5" stroke-dasharray="3 5"/>'
      + '<text x="' + CX0 + '" y="' + (CY0 - 128) + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="13" fill="' + MUTED + '">90°</text>'
      + '<text x="' + (CX0 - 128) + '" y="' + (CY0 + 5) + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="13" fill="' + MUTED + '">180°</text>'
      + '<text x="' + CX0 + '" y="' + (CY0 + 142) + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="13" fill="' + MUTED + '">270°</text>'
      + '<text x="' + (CX0 + 140) + '" y="' + (CY0 + 5) + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="13" fill="' + MUTED + '">0°</text>'
      + '<path id="wd" fill="' + CB + '" fill-opacity=".28" stroke="' + CB + '" stroke-width="2"/>'
      + '<path id="sq" fill="none" stroke="' + CG + '" stroke-width="2.5"/>'
      + '<line x1="' + CX0 + '" y1="' + CY0 + '" x2="' + (CX0 + LEN) + '" y2="' + CY0 + '" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>'
      + '<line id="ray" stroke="' + CB + '" stroke-width="4.5" stroke-linecap="round"/>'
      + mathT('lab', 18, '#9a3412')
      + handleG('hR', 'קצה הקרן המסתובבת. חצים משנים את גודל הזווית', CB, 0, 360, a));
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + tcell('המשימה', 'goal', CG) + cell('הגודל', 'size', CB) + tcell('הסוג עכשיו', 'cls', INK) + '</div>'
      + '<div style="margin-top:8px">' + stepperHtml([-10, -1, 1, 10], 'הזווית', CB) + '</div>');
    ctx.register('controls', box);
    var hR = ctx.el('hR');
    function render() {
      var tip = pol(CX0, CY0, LEN, a);
      setAttrs(ctx.el('ray'), { x1: CX0, y1: CY0, x2: r1(tip.x), y2: r1(tip.y) });
      setAttrs(ctx.el('wd'), { d: wedgeD(CX0, CY0, 46, 0, a) });
      setAttrs(ctx.el('sq'), { d: a === 90 ? 'M' + (CX0 + 24) + ' ' + CY0 + ' L' + (CX0 + 24) + ' ' + (CY0 - 24) + ' L' + CX0 + ' ' + (CY0 - 24) : '' });
      putLabel(ctx.el('lab'), pol(CX0, CY0, 74, a >= 360 ? 45 : a / 2), a >= 8 ? a + '°' : '');
      hR.setAttribute('transform', 'translate(' + r1(tip.x) + ' ' + r1(tip.y) + ')');
      setAttrs(hR, { 'aria-valuenow': a, 'aria-valuetext': a + ' מעלות, ' + cls(a) });
      box.querySelector('[data-v="goal"]').textContent = doneAll ? 'סיימת' : TASKS[ti];
      box.querySelector('[data-v="size"]').textContent = a + '°';
      box.querySelector('[data-v="cls"]').textContent = cls(a);
      box.querySelector('[data-value="a"]').textContent = a + '°';
      ctx.caption(m(a + '°') + ' · ' + cls(a));
    }
    function note() {
      var t = doneAll ? 'מלאה' : TASKS[ti];
      if (cls(a) === t) {
        ctx.note(m(a + '°') + ' היא זווית ' + t + '. לחץ על "אשר את הסיווג".', 'good');
      } else {
        ctx.note('כרגע ' + m(a + '°') + ' היא זווית ' + cls(a) + '. צריך זווית ' + t + '.');
      }
    }
    function set(v) {
      v = clamp(Math.round(v), 0, 360);
      if (v === a) return;
      a = v;
      ctx.sfx('tick');
      render(); note();
    }
    bindControls(ctx, box, hR, {
      get: function () { return a; }, set: set, big: 10,
      min: function () { return 0; }, max: function () { return 360; },
      fromPoint: function (x, y) {
        var p = pointAng(CX0, CY0, x, y) % 360;
        var d = p - (a % 360);
        if (d > 180) d -= 360;
        if (d <= -180) d += 360;
        return clamp(a + d, 0, 360);
      }
    });
    function wrongNote(t) {
      if (t === 'קהה' && a === 90) return m('90°') + ' היא בדיוק זווית ישרה, לא קהה. קהה גדולה מ־' + m('90°') + ' וקטנה מ־' + m('180°') + '.';
      if (t === 'קהה' && a === 180) return m('180°') + ' היא זווית שטוחה, לא קהה. קהה קטנה מ־' + m('180°') + '.';
      if (t === 'ישרה') return m(a + '°') + ' היא זווית ' + cls(a) + '. זווית ישרה היא בדיוק ' + m('90°') + ', לא ' + (a > 90 ? 'יותר' : 'פחות') + '.';
      if (t === 'שטוחה') return m(a + '°') + ' היא זווית ' + cls(a) + '. שטוחה היא בדיוק ' + m('180°') + ', קו ישר.';
      if (t === 'מלאה') return m(a + '°') + ' היא זווית ' + cls(a) + '. מלאה היא סיבוב שלם: ' + m('360°') + ', והקרן חוזרת אל השוק.';
      return m(a + '°') + ' היא זווית ' + cls(a) + ', ולא זווית ' + t + '.';
    }
    ctx.button('אשר את הסיווג', function () {
      if (doneAll) return;
      var t = TASKS[ti];
      if (cls(a) !== t) {
        ctx.sfx('error');
        ctx.note(wrongNote(t));
        return;
      }
      ctx.sfx('correct');
      if (ti < TASKS.length - 1) {
        ti += 1;
        ctx.burst(8);
        render();
        ctx.note('נכון. עכשיו הצב זווית ' + TASKS[ti] + '.', 'good');
      } else {
        doneAll = true;
        ctx.burst(16);
        render();
        ctx.note('ארבע זוויות, ארבעה שמות. הגבולות ' + m('90°') + ' ו־' + m('180°') + ' הם בדיוק ישרה ושטוחה.', 'good');
        ctx.solved();
      }
    }, { id: 'okBtn', target: 'controls' });
    render();
    ctx.note('כרגע ' + m('45°') + ' היא זווית חדה. הצב זווית קהה.');
  }
  /* ---------- step 5: pairs that complete to 90 or to 180 ---------- */
  function pairScene(ctx) {
    var TASKS = [{ total: 90, x: 38, y0: 20 }, { total: 180, x: 117, y0: 40 }];
    var ti = 0, y = TASKS[0].y0, doneAll = false;
    ctx.draw(pairMarkup('p') + handleG('hY', 'קצה הקרן של הזווית החסרה. חצים משנים אותה', CB, 1, 142, y));
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + cell('הזווית הנתונה', 'x', CA) + cell('הזווית שלך', 'y', CB) + cell('הסכום', 'sum', INK) + '</div>'
      + '<div style="margin-top:8px">' + stepperHtml([-10, -1, 1, 10], 'הזווית החסרה', CB) + '</div>');
    ctx.register('controls', box);
    var hY = ctx.el('hY');
    function T() { return TASKS[Math.min(ti, TASKS.length - 1)]; }
    function maxY() { return 180 - T().x; }
    function render() {
      var t = T(), tip = pol(PCX, PCY, PR, t.x + y);
      pairUpdate(ctx.el, 'p', t.x, y, t.total, t.x + '°', y + '°');
      hY.setAttribute('transform', 'translate(' + r1(tip.x) + ' ' + r1(tip.y) + ')');
      setAttrs(hY, { 'aria-valuenow': y, 'aria-valuemax': maxY(), 'aria-valuetext': y + ' מעלות' });
      box.querySelector('[data-v="x"]').textContent = t.x + '°';
      box.querySelector('[data-v="y"]').textContent = y + '°';
      box.querySelector('[data-v="sum"]').textContent = t.x + '° + ' + y + '° = ' + (t.x + y) + '°';
      box.querySelector('[data-value="a"]').textContent = y + '°';
      ctx.caption(m(t.x + '° + ' + y + '° = ' + (t.x + y) + '°') + ' · המטרה ' + m(t.total + '°'));
    }
    function note() {
      var t = T(), s = t.x + y;
      if (s === t.total) {
        ctx.note(m(t.x + '° + ' + y + '° = ' + t.total + '°') + ': הזוויות משלימות זו את זו ל־' + m(t.total + '°') + '. לחץ על "אשר את ההשלמה".', 'good');
      } else if (t.total === 90 && s === 180) {
        ctx.note('הסכום ' + m('180°') + ' הוא קו ישר, לא זווית ישרה. כאן מחפשים השלמה ל־' + m('90°') + ', כלומר עד הקרן הירוקה.');
      } else if (t.total === 180 && y === t.x - 90) {
        ctx.note('חיסרת ' + m('90°') + ' מ־' + m(t.x + '°') + '. כאן משלימים ל־' + m('180°') + ', עד הקו הישר: ' + m('180° − ' + t.x + '°') + '.');
      } else if (s < t.total) {
        ctx.note('הסכום ' + m(s + '°') + ' קטן מ־' + m(t.total + '°') + ' ב־' + m((t.total - s) + '°') + '. הגדל את הזווית שלך.');
      } else {
        ctx.note('הסכום ' + m(s + '°') + ' גדול מ־' + m(t.total + '°') + ' ב־' + m((s - t.total) + '°') + '. הקטן את הזווית שלך.');
      }
    }
    function set(v) {
      v = clamp(Math.round(v), 1, maxY());
      if (v === y) return;
      y = v;
      ctx.sfx('tick');
      render(); note();
    }
    bindControls(ctx, box, hY, {
      get: function () { return y; }, set: set, big: 10,
      min: function () { return 1; }, max: function () { return maxY(); },
      fromPoint: function (x, yy) {
        var p = pointAng(PCX, PCY, x, yy);
        if (p > 180) p = p > 270 ? 0 : 180;
        return Math.round(p) - T().x;
      }
    });
    ctx.button('אשר את ההשלמה', function () {
      if (doneAll) return;
      var t = T();
      if (t.x + y !== t.total) {
        ctx.sfx('error');
        note();
        return;
      }
      ctx.sfx('correct');
      if (ti === 0) {
        ti = 1; y = TASKS[1].y0;
        ctx.burst(8);
        render();
        ctx.note('נכון: ' + m('90° − 38° = 52°') + '. עכשיו זווית ' + m('117°') + ' על קו ישר: מה משלים אותה ל־' + m('180°') + '?', 'good');
      } else {
        doneAll = true;
        ctx.burst(16);
        ctx.note('נכון: ' + m('180° − 117° = 63°') + '. משלימות ל־' + m('90°') + ' או ל־' + m('180°') + ': מחסרים את הנתונה מהסכום.', 'good');
        ctx.solved();
      }
    }, { id: 'okBtn', target: 'controls' });
    render();
    ctx.note('נתונה זווית ' + m('38°') + '. הגדל את הזווית השנייה עד שהקרן תגיע לקרן הירוקה: סכום ' + m('90°') + '.');
  }
  /* ---------- quiz pictures ---------- */
  function protractorPicture(ctx) {
    var cx = 201, cy = 215, R = 160, LEN = 168;
    var tip = pol(cx, cy, LEN, 130);
    ctx.draw(protractorMarkup(cx, cy, R)
      + '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx - LEN) + '" y2="' + cy + '" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>'
      + '<line x1="' + cx + '" y1="' + cy + '" x2="' + r1(tip.x) + '" y2="' + r1(tip.y) + '" stroke="' + CB + '" stroke-width="4.5" stroke-linecap="round"/>'
      + '<circle cx="' + r1(tip.x) + '" cy="' + r1(tip.y) + '" r="5" fill="' + CB + '"/>'
      + '<text x="' + (cx - 100) + '" y="' + (cy + 24) + '" text-anchor="middle" font-family="Heebo, sans-serif" font-size="14" font-weight="700" fill="' + INK + '">השוק</text>');
  }
  function straightPicture(ctx) {
    var cx = 201, cy = 190;
    ctx.draw('<line x1="40" y1="' + cy + '" x2="362" y2="' + cy + '" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>'
      + '<path d="' + wedgeD(cx, cy, 70, 0, 180) + '" fill="' + CB + '" fill-opacity=".24" stroke="' + CB + '" stroke-width="2.5"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + INK + '"/>'
      + mathT('qm', 26, '#9a3412'));
    putLabel(ctx.el('qm'), { x: cx, y: cy - 36 }, '?');
  }
  function crossPicture(ctx) {
    var cx = 201, cy = 150, L = 125;
    function ln(t) {
      var p = pol(cx, cy, L, t), q = pol(cx, cy, L, t + 180);
      return '<line x1="' + r1(q.x) + '" y1="' + r1(q.y) + '" x2="' + r1(p.x) + '" y2="' + r1(p.y) + '" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>';
    }
    ctx.draw('<path d="' + wedgeD(cx, cy, 52, 24, 48) + '" fill="' + CA + '" fill-opacity=".28" stroke="' + CA + '" stroke-width="2"/>'
      + '<path d="' + wedgeD(cx, cy, 52, 204, 48) + '" fill="' + CB + '" fill-opacity=".28" stroke="' + CB + '" stroke-width="2"/>'
      + ln(24) + ln(72) + '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + INK + '"/>'
      + mathT('qa', 17, CA) + mathT('qb', 20, '#9a3412'));
    putLabel(ctx.el('qa'), pol(cx, cy, 82, 48), '48°');
    putLabel(ctx.el('qb'), pol(cx, cy, 82, 228), '?');
  }
  function pairPicture(x, total, lx, ly) {
    return function (ctx) {
      ctx.draw(pairMarkup('q'));
      pairUpdate(ctx.el, 'q', x, total - x, total, lx, ly);
    };
  }
  var steps = [
    {
      mode: 'intro',
      tA: 'מד הזווית',
      sub: 'מודדים זוויות, נותנים להן שם, ומשלימים ל־90° או ל־180°.',
      tip: 'שלום, אני אליהו. היום נלמד לקרוא מד זווית נכון, ולא לטעות בסקאלה.',
      emoji: '📐',
      eq: 'משלימים ל־' + m('90°') + ' או ל־' + m('180°'),
      note: 'מד זווית מודדים מהשוק, הקרן ששם ה־' + m('0') + '. נקרא את הסקאלה הנכונה, נסווג זוויות לפי גודלן, ונמצא זווית שמשלימה זווית אחרת ל־' + m('90°') + ' או ל־' + m('180°') + '.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מודדים על מד הזווית',
      sub: 'הצב את הקרן בגרירה, בכפתורים או בחיצים, על הזווית המבוקשת, וקרא בסקאלה שמתחילה ב־0 על השוק.',
      tip: 'השוק בצד ימין. קרא בסקאלה הפנימית, ' + m('0') + ' שלה על השוק. הצב קודם ' + m('65°') + ', ואז ' + m('140°') + '.',
      cue: 'הצב את הקרן ולחץ על "אשר את המדידה"',
      cueDone: 'שתי מדידות נכונות. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 270],
      alt: 'מד זווית חצי עיגול עם שתי סקאלות, פנימית שמתחילה ב־0 בצד ימין וחיצונית שמתחילה ב־0 בצד שמאל, שוק על הקו התחתון וקרן כתומה עם ידית בקצה שאפשר להזיז',
      nudge: { target: 'controls', text: 'שנה את הזווית בכפתורי הפלוס והמינוס, ואז לחץ על "אשר את המדידה".' },
      setup: measureScene
    },
    {
      mode: 'quiz',
      tA: 'באיזו סקאלה קוראים?',
      sub: 'השוק של הזווית נמצא בצד שמאל. מהי הזווית בין השוק לקרן הכתומה?',
      tip: 'איפה נמצא ה־' + m('0') + ' על השוק? משם מתחילה הסקאלה הנכונה.',
      btn: 'המשך ←',
      aspect: [402, 250],
      alt: 'מד זווית שבו השוק הוא הקו התחתון בצד שמאל, וקרן כתומה בקצה העליון משמאל לאמצע',
      setup: protractorPicture,
      win: 'נכון. השוק בצד שמאל, ולכן קוראים בסקאלה החיצונית שמתחילה שם ב־0.',
      wrongSay: 'חפש איפה נמצא ה־0 על השוק, וקרא בסקאלה שמתחילה שם.',
      opts: [
        { t: m('130°'), f: 'קראת בסקאלה הפנימית, אבל ה־0 שלה בצד ימין, לא על השוק. ' + m('130°') + ' היא הזווית מהצד השני: ' + m('180° − 50°') + '.' },
        { t: m('40°'), f: 'חיסרת את ' + m('50°') + ' מ־' + m('90°') + '. זה השלמה ל־90°, ולא מה שהמד מראה.' },
        { t: m('50°'), c: true, f: 'נכון: בסקאלה שמתחילה ב־0 על השוק, הקרן על ' + m('50°') + '. בסקאלה השנייה היא ' + m('130°') + ', ו־' + m('50° + 130° = 180°') + '.' },
        { t: m('60°'), f: 'קפצת לסימון המספר הגדול הבא. קוראים את הקו שהקרן באמת חוצה, לא את המספר הקרוב.' }
      ],
      hints: [
        'מצא את הנקודה שבה ה־0 נמצא על השוק, והסתכל על הסקאלה שמתחילה בה.',
        'השוק בצד שמאל, והסקאלה שמתחילה שם היא החיצונית, האפורה.',
        'בסקאלה השנייה הקרן על ' + m('130°') + ', והסקאלה שלנו נותנת ' + m('180° − 130°') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'חדה, ישרה, קהה, שטוחה, מלאה',
      sub: 'סובב את הקרן בגרירה, בכפתורים או בחיצים, אל הסוג המבוקש, ואשר.',
      tip: 'חדה קטנה מ־' + m('90°') + ', ישרה בדיוק ' + m('90°') + ', קהה בין ' + m('90°') + ' ל־' + m('180°') + ', שטוחה ' + m('180°') + ', מלאה ' + m('360°') + '.',
      cue: 'הצב זווית מהסוג המבוקש ולחץ על "אשר"',
      cueDone: 'ארבעה סוגים מוכנים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 300],
      alt: 'עיגול מקווקו עם קרן קבועה ימינה וקרן כתומה מסתובבת עם ידית בקצה, ושמונת סימוני 0, 90, 180 ו־270 מעלות סביבו',
      nudge: { target: 'controls', text: 'הזז את הקרן בכפתורי הפלוס והמינוס, ובדוק איזה סוג מופיע.' },
      setup: classScene
    },
    {
      mode: 'quiz',
      tA: 'קו ישר הוא זווית?',
      sub: 'שתי קרניים יוצאות מנקודה בכיוונים הפוכים ויוצרות קו ישר, ' + m('180°') + '. איך נקראת הזווית?',
      tip: 'חשוב על הגבולות: ' + m('90°') + ' ו־' + m('180°') + ' הם שמות מיוחדים.',
      btn: 'המשך ←',
      aspect: [402, 250],
      alt: 'קו ישר אופקי עם נקודה במרכזו וחצי עיגול כתום מעליו עם סימן שאלה',
      setup: straightPicture,
      win: 'נכון. זווית של בדיוק 180° היא זווית שטוחה.',
      wrongSay: 'זווית ישרה היא ' + m('90°') + '. איך קוראים לזווית שהיא קו ישר?',
      opts: [
        { t: 'זווית ישרה', f: 'השם "ישרה" שמור לזווית של בדיוק ' + m('90°') + ', והקו הישר הוא ' + m('180°') + '.' },
        { t: 'זווית קהה', f: 'קהה גדולה מ־' + m('90°') + ' אבל קטנה מ־' + m('180°') + '. בדיוק ' + m('180°') + ' כבר לא קהה.' },
        { t: 'זווית מלאה', f: 'מלאה היא סיבוב שלם, ' + m('360°') + ', והיא חוזרת אל הקרן ממנה יצאה. קו ישר הוא חצי סיבוב.' },
        { t: 'זווית שטוחה', c: true, f: 'נכון: ' + m('180°') + ' היא חצי סיבוב, והקרניים יוצרות קו ישר. זו זווית שטוחה.' }
      ],
      hints: [
        'קו ישר הוא חצי סיבוב. כמה מעלות זה?',
        'זווית ישרה היא בדיוק ' + m('90°') + ', ואת קו ישר נוח לדמיין כשטוח.',
        'זווית של חצי סיבוב, קו שטוח לגמרי, נקראת זווית שטוחה.'
      ]
    },
    {
      mode: 'scene',
      tA: 'זוויות שמשלימות זו את זו',
      sub: 'הגדר את הזווית החסרה בגרירה, בכפתורים או בחיצים, כך שהסכום יהיה ' + m('90°') + ' או ' + m('180°') + '.',
      tip: 'נתונה זווית כחולה. הזווית הכתומה נשארת צמודה אליה. עצור כשהקרן הכתומה על הקרן הירוקה.',
      cue: 'השלם את הזווית ולחץ על "אשר את ההשלמה"',
      cueDone: 'שתי ההשלמות נכונות. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 270],
      alt: 'זווית כחולה נתונה מהקרן האופקית הימנית, זווית כתומה צמודה אליה עם ידית בקצה הקרן, וקרן ירוקה מקווקווה שמסמנת את הסכום המבוקש',
      nudge: { target: 'controls', text: 'שנה את הזווית הכתומה בכפתורים ותראה את הסכום משתנה.' },
      setup: pairScene
    },
    {
      mode: 'quiz',
      tA: 'השלמה על קו ישר',
      sub: 'שתי זוויות צמודות על קו ישר. אחת מהן ' + m('64°') + '. כמה השנייה?',
      tip: 'קו ישר הוא ' + m('180°') + '. כמה נשאר אחרי הזווית הנתונה?',
      btn: 'המשך ←',
      aspect: [402, 250],
      alt: 'קו ישר ובו קרן שיוצרת זווית של 64 מעלות מצד ימין וזווית עם סימן שאלה מצד שמאל',
      setup: pairPicture(64, 180, '64°', '?'),
      win: 'נכון. על קו ישר שתי הזוויות מסתכמות ב־180°.',
      wrongSay: 'כמה מעלות יש בקו ישר? ומה נשאר אחרי ' + m('64°') + '?',
      opts: [
        { t: m('116°'), c: true, f: 'נכון: ' + m('180° − 64° = 116°') + '. הזוויות הצמודות על קו ישר משלימות ל־' + m('180°') + '.' },
        { t: m('26°'), f: 'חיסרת מ־' + m('90°') + '. זו השלמה לזווית ישרה, אבל הזוויות כאן על קו ישר, ' + m('180°') + '.' },
        { t: m('296°'), f: 'חיסרת מ־' + m('360°') + '. סיבוב שלם הוא ' + m('360°') + ', אבל קו ישר הוא חצי סיבוב, ' + m('180°') + '.' },
        { t: m('64°'), f: 'הנחת ששתי הזוויות שוות. שתיהן יחד ' + m('180°') + ', והן לא בהכרח שוות.' }
      ],
      hints: [
        'שתי הזוויות יושבות על קו ישר. כמה מעלות בקו ישר?',
        'חסר את הזווית הנתונה מהסכום של הקו הישר.',
        m('180° − 64°') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'זוויות קודקודיות',
      sub: 'שני ישרים נחתכים. זווית אחת היא ' + m('48°') + '. כמה היא הזווית שממול לה, הקודקודית?',
      tip: 'שני ישרים נחתכים יוצרים זוויות שממול זו לזו. מה הקשר ביניהן?',
      btn: 'לסיכום ←',
      aspect: [402, 300],
      alt: 'שני ישרים נחתכים, זווית של 48 מעלות בצבע כחול, וממולה זווית כתומה עם סימן שאלה',
      setup: crossPicture,
      win: 'נכון. זוויות קודקודיות שוות זו לזו.',
      wrongSay: 'הזווית שממול נמצאת בצד הנגדי של נקודת החיתוך. מה הקשר בין שתיהן?',
      opts: [
        { t: m('132°'), f: 'זו הזווית הצמודה, ' + m('180° − 48°') + '. הקודקודית יושבת ממול, לא ליד.' },
        { t: m('48°'), c: true, f: 'נכון: זוויות קודקודיות שוות. שתיהן צמודות לאותה זווית של ' + m('132°') + ', ולכן שתיהן ' + m('48°') + '.' },
        { t: m('42°'), f: 'חיסרת מ־' + m('90°') + '. הישרים לא בהכרח מאונכים, ולכן אין כאן זווית ישרה.' },
        { t: m('312°'), f: 'חיסרת מ־' + m('360°') + '. זה הסכום של שלוש הזוויות האחרות, ולא הזווית שממול.' }
      ],
      hints: [
        'שני ישרים נחתכים יוצרים שני זוגות של זוויות שממול זו לזו.',
        'הזווית שממול וזו הנתונה צמודות לאותה זווית על קו ישר.',
        'שוות זו לזו: ' + m('48°') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת עם מד הזווית',
      sub: 'קראת, סיווגת והשלמת זוויות.',
      tip: 'כל הכבוד. מודדים מהשוק בסקאלה שה־0 שלה עליו, ומשלימים לסכום המבוקש.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'קוראים בסקאלה שמתחילה ב־0 על השוק, ושתי זוויות משלימות מסתכמות בסכום קבוע:',
      formula: m('α + β = 90°') + ' · ' + m('α + β = 180°')
    }
  ];
  window.NoamGame.boot({
    slug: 'mad-hazavit',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'קריאה מהסקאלה הנכונה', math: '180° − 130° = 50°' },
      { step: 4, name: 'סיווג זוויות', math: '∠ = 180°' },
      { step: 6, name: 'השלמה ל־180°', math: '180° − 64°' },
      { step: 7, name: 'זוויות קודקודיות', math: '48° = 48°' }
    ],
    bonus: {
      label: 'מכונת ההשלמות 📐',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל זווית, והשלם אותה ל־90° או ל־180°.',
      setup: function (box, ctx) {
        var q = null, guess = 45;
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          var total = rnd(0, 1) ? 90 : 180, x;
          do { x = total === 90 ? rnd(11, 79) : rnd(21, 169); } while (x === total / 2);
          q = { total: total, x: x, ans: total - x };
          guess = 45;
        }
        box.innerHTML = '<div class="bTitle">מכונת ההשלמות</div><div class="bSub" data-sub></div>'
          + '<svg data-pic viewBox="0 0 402 250" dir="ltr" role="img" aria-label="ציור של זווית נתונה וזווית חסרה" style="width:100%;height:auto;display:block"></svg>'
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
          pic.innerHTML = pairMarkup('bn');
          pairUpdate(get, 'bn', q.x, q.ans, q.total, q.x + '°', '?');
          chip.textContent = q.x + '° + ? = ' + q.total + '°';
          sub.textContent = q.total === 90 ? 'משלימים ל־90°: זווית ישרה.' : 'משלימים ל־180°: קו ישר.';
          gEl.textContent = guess + '°';
          ok.hidden = true;
          forms.hidden = true;
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
            ok.textContent = 'נכון! ' + (q.total === 90 ? 'שתי הזוויות מסתכמות ב־90°.' : 'שתי הזוויות מסתכמות ב־180°.');
            forms.hidden = false;
            forms.innerHTML = bdi(q.total + '° − ' + q.x + '° = ' + q.ans + '°');
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            ok.textContent = guess === (q.total === 90 ? 180 : 90) - q.x ? 'נסה שוב: בדוק לאיזה סכום משלימים, 90° או 180°.' : 'נסה שוב: חסר את הזווית הנתונה מהסכום.';
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
