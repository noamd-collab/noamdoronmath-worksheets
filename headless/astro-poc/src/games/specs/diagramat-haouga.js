/**
 * דיאגרמת העוגה — an engine game.
 *
 * The idea: the whole pie is 100% and also 360°, so every percent is 3.6°.
 * A pie of several categories must add up to exactly 100%. A percentage alone
 * never says how many people there are: you also need the total.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var ROSE = '#9d174d';
  var MUTED = '#475569';
  var BAD = '#b91c1c';
  var CATS = [
    { name: 'תפוח', count: 10, pct: 25, color: '#9d174d' },
    { name: 'בננה', count: 14, pct: 35, color: '#0369a1' },
    { name: 'ענבים', count: 12, pct: 30, color: '#15803d' },
    { name: 'אבטיח', count: 4, pct: 10, color: '#b45309' }
  ];
  var DEG = Math.PI / 180;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function deg(p) { return Math.round(p * 36) / 10; }
  function pt(cx, cy, r, a) { return { x: cx + r * Math.sin(a * DEG), y: cy - r * Math.cos(a * DEG) }; }
  /** Angle clockwise from twelve o'clock, 0 to 360. */
  function angleOf(cx, cy, x, y) {
    var a = Math.atan2(x - cx, -(y - cy)) / DEG;
    return a < 0 ? a + 360 : a;
  }
  function wedge(cx, cy, r, a0, a1) {
    var span = a1 - a0;
    if (span <= 0.01) return '';
    if (span >= 359.99) {
      return 'M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 1 1 ' + cx + ' ' + (cy + r)
        + ' A' + r + ' ' + r + ' 0 1 1 ' + cx + ' ' + (cy - r) + ' Z';
    }
    var p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r, a1);
    return 'M' + cx + ' ' + cy + ' L' + r3(p0.x) + ' ' + r3(p0.y) + ' A' + r + ' ' + r + ' 0 '
      + (span > 180 ? 1 : 0) + ' 1 ' + r3(p1.x) + ' ' + r3(p1.y) + ' Z';
  }
  function setAttrs(el, obj) {
    if (!el) return;
    Object.keys(obj).forEach(function (k) { el.setAttribute(k, obj[k]); });
  }
  function mathT(id, size, fill, x, y, text) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + (x || 0) + '" y="' + (y || 0)
      + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle">' + (text || '') + '</text>';
  }
  function hebT(x, y, size, fill, text) {
    return '<text x="' + x + '" y="' + y + '" font-family="Heebo, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="middle">' + text + '</text>';
  }
  function putText(el, x, y, text, vis) {
    if (!el) return;
    el.textContent = text;
    el.setAttribute('x', r1(x));
    el.setAttribute('y', r1(y + 5));
    el.setAttribute('opacity', vis === false ? '0' : '1');
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function keyDelta(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -1;
    if (e.key === 'PageUp') return 5;
    if (e.key === 'PageDown') return -5;
    return 0;
  }
  /** Keep a dragged percentage from jumping across the twelve o'clock line. */
  function unwrap(last, pct) {
    if (last > 85 && pct < 15) return 100;
    if (last < 15 && pct > 85) return 0;
    return pct;
  }
  function stepperHtml(unit) {
    function btn(id, d) {
      return '<button type="button" id="' + id + '" data-delta="' + d + '" aria-label="'
        + (d < 0 ? 'הקטן' : 'הגדל') + ' ב־' + Math.abs(d) + ' ' + unit + '">' + (d < 0 ? '−' : '+') + Math.abs(d) + '</button>';
    }
    return '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px"><div class="unit" dir="ltr" style="gap:5px;padding:6px 6px">'
      + btn('dm5', -5) + btn('dm1', -1)
      + '<bdi class="var math" dir="ltr" data-value="1" style="min-width:56px" aria-live="polite"></bdi>'
      + btn('dp1', 1) + btn('dp5', 5) + '</div></div>';
  }
  function cell(label, key, color) {
    return '<div><b>' + label + '</b><span class="math" dir="ltr" data-v="' + key + '" style="color:' + color + '"></span></div>';
  }
  function handleG(id, label, min, max, val) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + min + '" aria-valuemax="' + max
      + '" aria-valuenow="' + val + '" aria-valuetext="' + val + ' אחוזים" style="cursor:grab">'
      + '<circle r="30" fill="transparent"/><circle r="11" fill="#fff" stroke="' + ROSE + '" stroke-width="4.5"/></g>';
  }
  function attachKeys(el, set, get, lo, hi) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Home') { e.preventDefault(); set(lo); return; }
      if (e.key === 'End') { e.preventDefault(); set(hi); return; }
      var d = keyDelta(e);
      if (!d) return;
      e.preventDefault();
      set(get() + d);
    });
  }

  /* ---------- step 1: one sector, percent and degrees ---------- */
  function sectorScene(ctx) {
    var p = 50, done = false;
    var CX = 201, CY = 164, R = 118, GOAL = 35;
    var svg = '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5"/>'
      + '<path id="s1w" fill="' + ROSE + '" fill-opacity=".9" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    [[0, '0%'], [25, '25%'], [50, '50%'], [75, '75%']].forEach(function (t) {
      var a = t[0] * 3.6, p0 = pt(CX, CY, R - 8, a), p1 = pt(CX, CY, R + 6, a), tp = pt(CX, CY, R + 24, a);
      svg += '<line x1="' + r1(p0.x) + '" y1="' + r1(p0.y) + '" x2="' + r1(p1.x) + '" y2="' + r1(p1.y) + '" stroke="' + INK + '" stroke-width="2"/>'
        + mathT('', 13, MUTED, r1(tp.x), r1(tp.y + 5), t[1]);
    });
    svg += mathT('s1t', 22, '#fff', 0, 0, '')
      + mathT('s1d', 15, '#fff', 0, 0, '')
      + handleG('h1', 'קצה הסקטור: אחוז העוגה שנצבע. חצים משנים ב־1 אחוז', 1, 99, p);
    ctx.draw(svg);
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + cell('אחוז מהעוגה', 'p', ROSE) + cell('מעלות', 'd', INK) + '</div>'
      + '<div style="margin-top:8px">' + stepperHtml('אחוז') + '</div>');
    ctx.register('controls', box);
    var h = ctx.el('h1');

    function render() {
      var a = p * 3.6, e = pt(CX, CY, R, a), mid = pt(CX, CY, R * 0.62, a / 2);
      ctx.el('s1w').setAttribute('d', wedge(CX, CY, R, 0, a));
      h.setAttribute('transform', 'translate(' + r1(e.x) + ' ' + r1(e.y) + ')');
      setAttrs(h, { 'aria-valuenow': p, 'aria-valuetext': p + ' אחוזים, ' + deg(p) + ' מעלות' });
      putText(ctx.el('s1t'), mid.x, mid.y - 6, p + '%', p >= 6);
      putText(ctx.el('s1d'), mid.x, mid.y + 14, deg(p) + '°', p >= 6);
      box.querySelector('[data-v="p"]').textContent = p + '%';
      box.querySelector('[data-v="d"]').textContent = deg(p) + '°';
      box.querySelector('[data-value="1"]').textContent = p + '%';
      ctx.caption(m(p + '% · 3.6 = ' + deg(p) + '°'));
    }
    function note() {
      if (p === GOAL) {
        ctx.note('בדיוק! ' + m('35% · 3.6 = 126°') + '. כל אחוז מהעוגה הוא ' + m('3.6°') + ', כי ' + m('100%') + ' הם ' + m('360°') + '.', 'good');
      } else if (p === 10) {
        ctx.note('הגעת ל־' + m('36°') + ', אבל אחוזים ומעלות אינם אותו מספר. ' + m('35°') + ' הם רק כ־' + m('10%') + ' מהעוגה. אנחנו מחפשים ' + m('35%') + ', כלומר ' + m('126°') + '.');
      } else if (p === 25) {
        ctx.note(m('25%') + ' הם רבע עוגה, ' + m('90°') + '. צריך קצת יותר מרבע.');
      } else if (p < GOAL) {
        ctx.note('עכשיו ' + m(p + '%') + ', שהם ' + m(deg(p) + '°') + '. עוד לא הגענו ל־' + m('35%') + ': הגדל את הסקטור.');
      } else {
        ctx.note('עכשיו ' + m(p + '%') + ', שהם ' + m(deg(p) + '°') + '. עברת את ' + m('35%') + ': הקטן את הסקטור.');
      }
    }
    function setP(v) {
      v = clamp(Math.round(v), 1, 99);
      var changed = v !== p;
      p = v;
      if (changed) ctx.sfx('tick');
      render();
      note();
      if (p === GOAL && !done) { done = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { setP(p + Number(bt.getAttribute('data-delta'))); });
    });
    attachKeys(h, setP, function () { return p; }, 1, 99);
    ctx.drag(h, {
      move: function (x, y) { setP(unwrap(p, angleOf(CX, CY, x, y) / 3.6)); }
    });
    render();
    ctx.note('הסקטור מציג עכשיו ' + m('50%') + ', שהם ' + m('180°') + '. הזז את הקצה כך שהסקטור יציג ' + m('35%') + ', ותראה כמה מעלות זה.');
  }

  /* ---------- step 3: a whole pie from a frequency table ---------- */
  function pieScene(ctx) {
    var v = [20, 20, 20, 20], sel = 0, done = false;
    var CX = 201, CY = 150, R = 112;
    var svg = '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="#f1f5f9" stroke="#64748b" stroke-width="2" stroke-dasharray="6 5"/>'
      + '<path id="s2gap" fill="#f1f5f9" stroke="#64748b" stroke-width="2" stroke-dasharray="6 5"/>'
      + hebT(CX, CY + 5, 15, MUTED, '').replace('<text ', '<text id="s2gapT" ');
    CATS.forEach(function (c, i) {
      svg += '<path id="s2w' + i + '" fill="' + c.color + '" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>'
        + mathT('s2t' + i, 17, '#fff', 0, 0, '');
    });
    svg += '<circle id="s2ring" cx="' + CX + '" cy="' + CY + '" r="' + (R + 8) + '" fill="none" stroke="' + BAD + '" stroke-width="3" stroke-dasharray="7 5" opacity="0"/>'
      + handleG('h2', 'קצה הסקטור הנבחר. חצים משנים את האחוז שלו', 0, 100, v[0]);
    ctx.draw(svg);
    var chips = CATS.map(function (c, i) {
      return '<button type="button" id="cat' + i + '" data-cat="' + i + '" aria-pressed="false" style="min-height:56px;min-width:44px;border:2px solid ' + c.color
        + ';border-radius:12px;background:#fff;color:' + INK + ';padding:6px 8px;font:inherit;line-height:1.3;cursor:pointer">'
        + '<b style="color:' + c.color + '">' + c.name + '</b><br>' + bdi(String(c.count)) + ' תלמידים<br>'
        + '<span data-cv="' + i + '" class="math" dir="ltr" style="font-weight:700"></span></button>';
    }).join('');
    var box = ctx.extra('<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">' + chips + '</div>'
      + '<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr);margin-top:8px">'
      + cell('סכום האחוזים', 'sp', INK) + cell('סכום המעלות', 'sd', INK) + '</div>'
      + '<div style="margin-top:8px;text-align:center">אחוז <b data-sel></b></div>'
      + '<div>' + stepperHtml('אחוז') + '</div>');
    ctx.register('controls', box);
    var h = ctx.el('h2');
    var catBtns = box.querySelectorAll('[data-cat]');

    function sum() { return v.reduce(function (a, b) { return a + b; }, 0); }
    function startOf(i) { var s = 0, k; for (k = 0; k < i; k++) s += v[k]; return s; }
    function matches() { return CATS.every(function (c, i) { return v[i] === c.pct; }); }
    function render() {
      var cum = 0, total = sum();
      CATS.forEach(function (c, i) {
        var a0 = Math.min(cum, 100) * 3.6, a1 = Math.min(cum + v[i], 100) * 3.6;
        ctx.el('s2w' + i).setAttribute('d', wedge(CX, CY, R, a0, a1));
        var mid = pt(CX, CY, R * 0.68, (a0 + a1) / 2);
        putText(ctx.el('s2t' + i), mid.x, mid.y, v[i] + '%', a1 - a0 >= 14);
        box.querySelector('[data-cv="' + i + '"]').textContent = v[i] + '%';
        cum += v[i];
      });
      var gap = Math.max(0, 100 - total);
      ctx.el('s2gap').setAttribute('d', wedge(CX, CY, R, Math.min(total, 100) * 3.6, 360));
      var gm = pt(CX, CY, R * 0.6, (Math.min(total, 100) * 3.6 + 360) / 2);
      var gt = ctx.el('s2gapT');
      gt.textContent = gap > 0 ? 'ריק' : '';
      gt.setAttribute('x', r1(gm.x)); gt.setAttribute('y', r1(gm.y + 5));
      ctx.el('s2ring').setAttribute('opacity', total > 100 ? '1' : '0');
      var endPct = Math.min(startOf(sel) + v[sel], 100), e = pt(CX, CY, R, endPct * 3.6);
      h.setAttribute('transform', 'translate(' + r1(e.x) + ' ' + r1(e.y) + ')');
      setAttrs(h, {
        'aria-label': 'קצה הסקטור של ' + CATS[sel].name + '. חצים משנים את האחוז שלו',
        'aria-valuenow': v[sel], 'aria-valuetext': v[sel] + ' אחוזים'
      });
      catBtns.forEach(function (b, i) {
        b.setAttribute('aria-pressed', String(i === sel));
        b.style.background = i === sel ? PAL.soft : '#fff';
        b.style.boxShadow = i === sel ? '0 0 0 3px ' + CATS[i].color : 'none';
      });
      box.querySelector('[data-sel]').textContent = CATS[sel].name;
      box.querySelector('[data-value="1"]').textContent = v[sel] + '%';
      var sp = box.querySelector('[data-v="sp"]'), sd = box.querySelector('[data-v="sd"]');
      sp.textContent = total + '%'; sd.textContent = r1(total * 3.6) + '°';
      sp.style.color = sd.style.color = total === 100 ? PAL.good : BAD;
      ctx.caption(m(v.join('% + ') + '% = ' + total + '%'));
    }
    function note() {
      var total = sum(), i, bad = -1;
      if (matches()) {
        ctx.note('הטבלה והעוגה מתאימות: ' + m('25% + 35% + 30% + 10% = 100%') + ', כלומר ' + m('360°') + '. כל אחוז הוא מספר התלמידים ' + m('÷ 40 · 100') + '.', 'good');
        return;
      }
      if (v.every(function (x, k) { return x === CATS[k].count; })) {
        ctx.note('הכנסת את מספר התלמידים כאילו הם אחוזים. הסך הכול הוא ' + m('40') + ' תלמידים, ולכן ' + m('10') + ' תלמידים הם ' + m('10 ÷ 40 · 100 = 25%') + '.');
        return;
      }
      if (total > 100) {
        ctx.note('הסכום ' + m(total + '%') + ' גדול מ־' + m('100%') + ', כלומר ' + m(r1(total * 3.6) + '°') + ' במקום ' + m('360°') + '. הסקטורים לא נכנסים בעוגה אחת: הקטן אחד מהם.');
        return;
      }
      if (total < 100) {
        ctx.note('הסכום ' + m(total + '%') + ' קטן מ־' + m('100%') + ': נשאר חלק ריק של ' + m((100 - total) + '%') + ' בעוגה. עוגה שלמה היא ' + m('100%') + ', לכן הגדל סקטור.');
        return;
      }
      for (i = 0; i < CATS.length && bad < 0; i++) if (v[i] !== CATS[i].pct) bad = i;
      ctx.note('הסכום הוא ' + m('100%') + ', אבל זה עוד לא מספיק. בדוק את ' + CATS[bad].name + ': ' + m(String(CATS[bad].count)) + ' תלמידים מתוך ' + m('40') + '.');
    }
    function setV(val) {
      val = clamp(Math.round(val), 0, 100);
      var changed = val !== v[sel];
      v[sel] = val;
      if (changed) ctx.sfx('tick');
      render();
      note();
      if (matches() && !done) { done = true; ctx.sfx('correct'); ctx.burst(18); ctx.solved(); }
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { setV(v[sel] + Number(bt.getAttribute('data-delta'))); });
    });
    catBtns.forEach(function (b) {
      b.addEventListener('click', function () { sel = Number(b.getAttribute('data-cat')); ctx.sfx('click'); render(); });
    });
    attachKeys(h, setV, function () { return v[sel]; }, 0, 100);
    ctx.drag(h, {
      move: function (x, y) {
        var s = startOf(sel), pct = angleOf(CX, CY, x, y) / 3.6;
        if (pct < s - 50) pct += 100;
        setV(pct - s);
      }
    });
    render();
    ctx.note('בסקר ענו ' + m('40') + ' תלמידים. חשב כמה אחוזים הוא כל מספר, בחר קטגוריה והגדר את הסקטור שלה. כל העוגה חייבת להסתכם בדיוק ל־' + m('100%') + '.');
  }

  /* ---------- step 5: same percent, different totals ---------- */
  function compareScene(ctx) {
    var p = 40, done = false;
    var AY = 132, R = 78, AX = 101, BX = 301, NA = 50, NB = 200, PA = 40;
    var svg = hebT(AX, 24, 16, INK, 'קבוצה א׳') + hebT(BX, 24, 16, INK, 'קבוצה ב׳')
      + '<circle cx="' + AX + '" cy="' + AY + '" r="' + R + '" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5"/>'
      + '<path d="' + wedge(AX, AY, R, 0, PA * 3.6) + '" fill="' + ROSE + '" fill-opacity=".9" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>'
      + mathT('', 17, '#fff', pt(AX, AY, R * 0.6, PA * 1.8).x, pt(AX, AY, R * 0.6, PA * 1.8).y + 5, '40%')
      + '<circle cx="' + BX + '" cy="' + AY + '" r="' + R + '" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5"/>'
      + '<path id="s3w" fill="' + ROSE + '" fill-opacity=".9" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>'
      + mathT('s3t', 17, '#fff', 0, 0, '')
      + mathT('', 20, INK, AX, 236, String(NA)) + hebT(AX, 254, 14, MUTED, 'תלמידים בעוגה')
      + mathT('', 20, INK, BX, 236, String(NB)) + hebT(BX, 254, 14, MUTED, 'תלמידים בעוגה')
      + handleG('h3', 'קצה הסקטור של קבוצה ב׳. חצים משנים ב־1 אחוז', 1, 99, p);
    ctx.draw(svg);
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>קבוצה א׳: הסקטור</b><span class="math" dir="ltr" style="color:' + ROSE + '">' + '40% · 50 = 20</span></div>'
      + cell('קבוצה ב׳: הסקטור', 'b', ROSE) + '</div>'
      + '<div style="margin-top:8px">' + stepperHtml('אחוז') + '</div>');
    ctx.register('controls', box);
    var h = ctx.el('h3');

    function count() { return NB * p / 100; }
    function render() {
      var a = p * 3.6, e = pt(BX, AY, R, a), mid = pt(BX, AY, R * 0.6, a / 2);
      ctx.el('s3w').setAttribute('d', wedge(BX, AY, R, 0, a));
      h.setAttribute('transform', 'translate(' + r1(e.x) + ' ' + r1(e.y) + ')');
      setAttrs(h, { 'aria-valuenow': p, 'aria-valuetext': p + ' אחוזים, ' + count() + ' תלמידים' });
      putText(ctx.el('s3t'), mid.x, mid.y, p + '%', p >= 8);
      box.querySelector('[data-v="b"]').textContent = p + '% · 200 = ' + count();
      box.querySelector('[data-value="1"]').textContent = p + '%';
      ctx.caption('קבוצה ב׳: ' + m(p + '% · 200 = ' + count()) + ' תלמידים');
    }
    function note() {
      var c = count();
      if (c === 20) {
        ctx.note('נכון: ' + m('10% · 200 = 20') + '. אותם ' + m('20') + ' תלמידים כמו בקבוצה א׳, אבל סקטור קטן בהרבה, כי העוגה של ב׳ מייצגת ' + m('200') + ' תלמידים.', 'good');
      } else if (p === 40) {
        ctx.note('בשתי העוגות ' + m('40%') + ', אבל בקבוצה ב׳ זה ' + m('40% · 200 = 80') + ' תלמידים ובקבוצה א׳ רק ' + m('20') + '. אותו אחוז, לא אותו מספר אנשים.');
      } else if (c > 20) {
        ctx.note(m(p + '%') + ' מתוך ' + m('200') + ' הם ' + m(String(c)) + ' תלמידים: יותר מ־' + m('20') + '. הקטן את הסקטור.');
      } else {
        ctx.note(m(p + '%') + ' מתוך ' + m('200') + ' הם ' + m(String(c)) + ' תלמידים: פחות מ־' + m('20') + '. הגדל את הסקטור.');
      }
    }
    function setP(val) {
      val = clamp(Math.round(val), 1, 99);
      var changed = val !== p;
      p = val;
      if (changed) ctx.sfx('tick');
      render();
      note();
      if (count() === 20 && !done) { done = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { setP(p + Number(bt.getAttribute('data-delta'))); });
    });
    attachKeys(h, setP, function () { return p; }, 1, 99);
    ctx.drag(h, {
      move: function (x, y) { setP(unwrap(p, angleOf(BX, AY, x, y) / 3.6)); }
    });
    render();
    ctx.note('בקבוצה א׳ ' + m('40%') + ' מ־' + m('50') + ' תלמידים הם ' + m('20') + ' תלמידים. הזז את הסקטור של ב׳ כך שגם בה ' + m('20') + ' תלמידים אוהבים כדורגל.');
  }

  /* ---------- quiz pictures ---------- */
  function quizPies(list) {
    return function (ctx) {
      var s = '';
      list.forEach(function (o) {
        var a = o.deg;
        s += '<circle cx="' + o.cx + '" cy="' + o.cy + '" r="' + o.r + '" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5"/>'
          + '<path d="' + wedge(o.cx, o.cy, o.r, 0, a) + '" fill="' + ROSE + '" fill-opacity=".9" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
        var mp = pt(o.cx, o.cy, o.r * (a > 120 ? 0.55 : 0.68), a / 2);
        s += mathT('', o.size || 17, '#fff', r1(mp.x), r1(mp.y + 5), o.label);
        if (o.title) s += hebT(o.cx, 22, 16, INK, o.title);
        if (o.total) s += mathT('', 19, INK, o.cx, o.cy + o.r + 28, o.total) + hebT(o.cx, o.cy + o.r + 46, 14, MUTED, 'תלמידים בעוגה');
      });
      ctx.draw(s);
    };
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'דיאגרמת העוגה',
      sub: 'אחוזים, מעלות וסקטורים בעוגה אחת.',
      tip: 'שלום, אני אליהו. היום נחתוך עוגה ונגלה איך אחוזים הופכים למעלות.',
      emoji: '🥧',
      eq: m('1% = 3.6°'),
      note: 'העוגה השלמה היא ' + m('100%') + ' וגם ' + m('360°') + '. לכן כל אחוז הוא ' + m('3.6°') + ', וכל חלקי העוגה חייבים להסתכם בדיוק ל־' + m('100%') + '. נגלה גם למה אחוז לבדו לא אומר כמה אנשים יש.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'אחוזים ומעלות',
      sub: 'הזז את קצה הסקטור בגרירה, בכפתורים או בחיצים עד שהוא מציג ' + m('35%') + '.',
      tip: 'שים לב איך המעלות משתנות יחד עם האחוזים. כל אחוז הוא אותו מספר מעלות.',
      cue: 'הגדר סקטור של 35%',
      cueDone: 'סקטור של 35%, שהוא 126°. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 330],
      alt: 'עוגה עגולה עם סקטור ורוד שמתחיל בראש העוגה. בקצה הסקטור ידית שאפשר להזיז. בתוך הסקטור כתובים האחוז והמעלות שלו',
      nudge: { target: 'controls', text: 'לחץ על כפתורי הפלוס והמינוס כדי להזיז את הסקטור, ותראה כמה מעלות הוא מציג.' },
      setup: sectorScene
    },
    {
      mode: 'quiz',
      tA: 'מאחוזים למעלות',
      sub: 'סקטור מציג ' + m('20%') + ' מהעוגה. כמה מעלות יש בזווית שלו?',
      tip: 'כל העוגה היא ' + m('360°') + '. כמה מעלות הוא אחוז אחד?',
      btn: 'המשך ←',
      aspect: [402, 230],
      alt: 'עוגה עם סקטור של עשרים אחוזים וסימן שאלה במקום מספר המעלות',
      setup: quizPies([{ cx: 201, cy: 118, r: 100, deg: 72, label: '20%', size: 20 }]),
      win: 'נכון. כל אחוז הוא 3.6 מעלות, ולכן עשרים אחוזים הם 72 מעלות.',
      wrongSay: 'אחוזים ומעלות אינם אותו מספר. כל העוגה היא ' + m('100%') + ' וגם ' + m('360°') + '.',
      opts: [
        { t: m('20°'), f: 'העתקת את המספר. ' + m('20%') + ' אינם ' + m('20°') + ': כל אחוז הוא ' + m('3.6°') + ', ולכן ' + m('20% · 3.6 = 72°') + '.' },
        { t: m('18°'), f: 'חילקת ' + m('360°') + ' ב־' + m('20') + '. זה היה נכון לחלוקה ל־' + m('20') + ' חלקים שווים, אבל כאן צריך להכפיל: ' + m('20 · 3.6') + '.' },
        { t: m('72°'), c: true, f: 'נכון: ' + m('20% · 3.6° = 72°') + '. בדרך אחרת: ' + m('20%') + ' הם חמישית מהעוגה, ו־' + m('360° ÷ 5 = 72°') + '.' },
        { t: m('36°'), f: m('36°') + ' הם ' + m('10%') + ' מהעוגה. ' + m('20%') + ' הם פי שניים מזה.' }
      ],
      hints: [
        'כל העוגה היא אותו מספר באחוזים ובמעלות. מצא כמה מעלות הוא אחוז אחד.',
        'חלק ' + m('360°') + ' ב־' + m('100') + ' ותקבל את המעלות של אחוז אחד.',
        'אחוז אחד הוא ' + m('3.6°') + '. הכפל ב־' + m('20') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'עוגה שלמה מטבלה',
      sub: 'בחר קטגוריה והגדר את הסקטור שלה בגרירה, בכפתורים או בחיצים. כל העוגה חייבת להסתכם ל־' + m('100%') + '.',
      tip: 'חשב כמה אחוזים הוא כל מספר מתוך ' + m('40') + ' תלמידים. הסכום יראה לך אם העוגה שלמה.',
      cue: 'התאם כל סקטור לטבלה כך שהסכום יהיה 100%',
      cueDone: 'העוגה מתאימה לטבלה והסכום 100%. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 300],
      alt: 'עוגה עם ארבעה סקטורים בצבעים שונים לתפוח, בננה, ענבים ואבטיח. חלק ריק מוצג אם הסכום קטן מהמאה אחוז. לידה ידית שאפשר להזיז לקטגוריה הנבחרת',
      nudge: { target: 'controls', text: 'בחר קטגוריה וכוונן את האחוז שלה. שים לב לסכום האחוזים בשורה שמתחת לעוגה.' },
      setup: pieScene
    },
    {
      mode: 'quiz',
      tA: 'קוראים סקטור',
      sub: 'סקטור בעוגה הוא ' + m('45°') + '. איזה חלק מהעוגה השלמה הוא מייצג?',
      tip: 'כמה סקטורים של ' + m('45°') + ' נכנסים בעוגה של ' + m('360°') + '?',
      btn: 'המשך ←',
      aspect: [402, 230],
      alt: 'עוגה עם סקטור צר של ארבעים וחמש מעלות',
      setup: quizPies([{ cx: 201, cy: 118, r: 100, deg: 45, label: '45°', size: 18 }]),
      win: 'נכון. ארבעים וחמש מעלות נכנסות בעוגה שמונה פעמים, ולכן הסקטור הוא שמינית.',
      wrongSay: 'חלק ' + m('360°') + ' ב־' + m('45°') + ' ובדוק כמה חלקים כאלה יש.',
      opts: [
        { t: 'רבע מהעוגה, ' + m('25%'), f: 'רבע עוגה הוא ' + m('90°') + '. הסקטור הזה קטן פי שניים מזה.' },
        { t: 'שמינית מהעוגה, ' + m('12.5%'), c: true, f: 'נכון: ' + m('360° ÷ 45° = 8') + ', ולכן הסקטור הוא שמינית, ו־' + m('45° ÷ 3.6 = 12.5%') + '.' },
        { t: m('45%') + ' מהעוגה', f: 'החלפת מעלות באחוזים. ' + m('45%') + ' היו ' + m('162°') + ', הרבה יותר מסקטור צר.' },
        { t: 'עשירית מהעוגה, ' + m('10%'), f: 'עשירית היא ' + m('36°') + ', לא ' + m('45°') + '. חלק ' + m('360°') + ' ב־' + m('45°') + ', לא ב־' + m('36°') + '.' }
      ],
      hints: [
        'העוגה השלמה היא ' + m('360°') + '. בדוק כמה סקטורים כאלה נכנסים בה.',
        'חלק ' + m('360°') + ' ב־' + m('45°') + '.',
        m('360° ÷ 45° = 8') + ', ולכן הסקטור הוא חלק אחד משמונה.'
      ]
    },
    {
      mode: 'scene',
      tA: 'אותו אחוז, מספר אחר',
      sub: 'בשתי הקבוצות ' + m('40%') + ' אוהבים כדורגל. הזז את הסקטור של קבוצה ב׳ בגרירה, בכפתורים או בחיצים, כך שבשתי הקבוצות יהיה אותו מספר תלמידים.',
      tip: 'אחוז הוא חלק מהעוגה כולה. כדי לדעת כמה תלמידים, צריך לדעת כמה יש בעוגה כולה.',
      cue: 'הגדר סקטור שמייצג 20 תלמידים בקבוצה ב׳',
      cueDone: 'גם בקבוצה ב׳ עשרים תלמידים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 262],
      alt: 'שתי עוגות זו לצד זו. בקבוצה א׳ חמישים תלמידים וסקטור של ארבעים אחוז. בקבוצה ב׳ מאתיים תלמידים וסקטור שאפשר להזיז בידית',
      nudge: { target: 'controls', text: 'הקטן את האחוז של קבוצה ב׳ בכפתורי המינוס, ובדוק כמה תלמידים הסקטור מייצג.' },
      setup: compareScene
    },
    {
      mode: 'quiz',
      tA: 'באיזו עוגה יותר?',
      sub: 'בשתי עוגות מוצגים אוהבי כדורגל. באיזו עוגה יותר תלמידים אוהבים כדורגל?',
      tip: 'חשב בכל עוגה כמה תלמידים מייצג הסקטור, ורק אז השווה.',
      btn: 'המשך ←',
      aspect: [402, 270],
      alt: 'שתי עוגות. בקבוצה א׳ מאתיים תלמידים וסקטור של שלושים אחוז. בקבוצה ב׳ ארבעים תלמידים וסקטור של חמישים אחוז',
      setup: quizPies([
        { cx: 101, cy: 96, r: 70, deg: 108, label: '30%', title: 'קבוצה א׳', total: '200' },
        { cx: 301, cy: 96, r: 70, deg: 180, label: '50%', title: 'קבוצה ב׳', total: '40' }
      ]),
      win: 'נכון. שישים תלמידים בקבוצה א׳ לעומת עשרים בקבוצה ב׳.',
      wrongSay: 'סקטור גדול יותר אינו אומר יותר אנשים. חשב את מספר התלמידים בכל עוגה.',
      opts: [
        { t: 'בקבוצה ב׳, כי הסקטור גדול יותר', f: 'השווית רק אחוזים. ' + m('50%') + ' מ־' + m('40') + ' הם רק ' + m('20') + ' תלמידים, פחות מ־' + m('60') + ' בקבוצה א׳.' },
        { t: 'אותו מספר, כי בשתי העוגות מדובר באותה עוגה שלמה', f: 'כל עוגה היא ' + m('100%') + ', אבל ' + m('100%') + ' של קבוצה אחת הם ' + m('200') + ' תלמידים ושל השנייה ' + m('40') + '. החלקים אינם שווים.' },
        { t: 'אי אפשר לדעת, כי נתון רק אחוז', f: 'נתון גם הסך הכול של כל עוגה, ולכן אפשר לחשב: אחוז כפול הסך הכול נותן את מספר התלמידים.' },
        { t: 'בקבוצה א׳, ' + m('60') + ' לעומת ' + m('20'), c: true, f: 'נכון: ' + m('30% · 200 = 60') + ' ו־' + m('50% · 40 = 20') + '. הסקטור הקטן יותר מייצג עוגה גדולה יותר.' }
      ],
      hints: [
        'אל תשווה את גודל הסקטורים. שאל קודם: כמה תלמידים יש בכל עוגה?',
        'כדי למצוא חלק, כפול את האחוז בסך כל התלמידים של אותה עוגה.',
        m('30% · 200') + ' ו־' + m('50% · 40') + '. חשב ואז השווה.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'האם אפשר לצייר עוגה?',
      sub: 'תלמיד סיכם סקר בארבע קטגוריות: ' + m('30%') + ', ' + m('25%') + ', ' + m('20%') + ' ו־' + m('35%') + '. מה נכון?',
      tip: 'כל חלקי העוגה יחד צריכים לתת את העוגה השלמה. חבר את האחוזים.',
      btn: 'לסיכום ←',
      win: 'נכון. הסכום חייב להיות מאה אחוזים, ושלוש מאות שישים מעלות.',
      wrongSay: 'חבר את ארבעת האחוזים ובדוק אם מתקבלים בדיוק ' + m('100%') + '.',
      opts: [
        { t: 'הסכום ' + m('110%') + ', יותר מהעוגה השלמה, ולכן יש טעות בנתונים', c: true, f: 'נכון: ' + m('30 + 25 + 20 + 35 = 110') + '. זה ' + m('396°') + ' במקום ' + m('360°') + ', ואי אפשר לצייר את זה בעוגה אחת.' },
        { t: 'אין בעיה, כל אחוז קטן מ־' + m('100%'), f: 'לא מספיק שכל אחוז קטן מ־' + m('100%') + '. הסכום של כולם יחד חייב להיות בדיוק ' + m('100%') + '.' },
        { t: 'הסכום קטן מ־' + m('100%') + ', ולכן חסר סקטור', f: 'חיברת לא נכון. הסכום הוא ' + m('110%') + ', יותר מ־' + m('100%') + ', ולא פחות.' },
        { t: 'הסקטור של ' + m('35%') + ' הוא הטעות, ושאר הנתונים נכונים', f: 'הסכום אומר שיש טעות, אבל לא איפה. אי אפשר להצביע על ' + m('35%') + ' לפני שבודקים את הספירה המקורית.' }
      ],
      hints: [
        'עוגה שלמה היא תמיד אותו מספר אחוזים. חבר את הנתונים.',
        'חבר ' + m('30 + 25 + 20 + 35') + ' והשווה למספר השלם.',
        'הסכום הוא ' + m('110') + '. האם זה יכול להיות עוגה אחת?'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את דיאגרמת העוגה',
      sub: 'אחוזים, מעלות וסך הכול: שלושה דברים שעובדים יחד.',
      tip: 'כל הכבוד. עכשיו אתה יודע לחתוך עוגה, לבדוק אותה ולהשוות בין עוגות.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:',
      formula: m('100% = 360°') + ', כל אחוז הוא ' + m('3.6°') + ', וכל החלקים מסתכמים ל־' + m('100%') + '. אחוז נותן מספר אנשים רק יחד עם הסך הכול.'
    }
  ];

  window.NoamGame.boot({
    slug: 'diagramat-haouga', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'המרת אחוזים למעלות', math: '20% · 3.6 = 72°' },
      { step: 4, name: 'קריאת סקטור כחלק מהעוגה', math: '360° ÷ 45° = 8' },
      { step: 6, name: 'השוואה בין עוגות שונות', math: 'אחוז · סך הכול' },
      { step: 7, name: 'סכום העוגה הוא מאה אחוז', math: '100% = 360°' }
    ],
    bonus: {
      label: 'מכונת הסקטורים', closeLabel: 'סגור את המכונה', hint: 'קבל סקטור חדש, והגדר כמה מעלות יש בו.',
      setup: function (box, ctx) {
        var pctNow = 25, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת הסקטורים</div><div class="bSub">כמה מעלות יש בסקטור שמציג את האחוז הזה?</div>'
          + '<svg data-bsvg viewBox="0 0 402 250" dir="ltr" role="img" aria-label="עוגה עם סקטור אקראי" style="width:100%;height:auto;display:block"></svg>'
          + '<div class="bChip" dir="ltr" data-bchip></div>'
          + '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px"><div class="unit" dir="ltr" style="gap:5px;padding:6px 6px">'
          + [[-10, 'bm10'], [-1, 'bm1']].map(function (a) { return '<button type="button" data-bd="' + a[0] + '" aria-label="הקטן ב־' + Math.abs(a[0]) + ' מעלות">−' + Math.abs(a[0]) + '</button>'; }).join('')
          + '<bdi class="var math" dir="ltr" data-bval style="min-width:64px" aria-live="polite"></bdi>'
          + [[1, 'bp1'], [10, 'bp10']].map(function (a) { return '<button type="button" data-bd="' + a[0] + '" aria-label="הגדל ב־' + a[0] + ' מעלות">+' + a[0] + '</button>'; }).join('')
          + '</div></div>'
          + '<div class="bForms" data-bforms hidden></div><div class="bOk" data-bnote hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-bcheck style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-broll style="min-height:44px;min-width:44px">סקטור חדש ↻</button>';
        function drawBonus() {
          var a = pctNow * 3.6;
          box.querySelector('[data-bsvg]').innerHTML = '<circle cx="201" cy="125" r="100" fill="' + PAL.soft + '" stroke="' + INK + '" stroke-width="2.5"/>'
            + '<path d="' + wedge(201, 125, 100, 0, a) + '" fill="' + ROSE + '" fill-opacity=".9" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
          box.querySelector('[data-bchip]').textContent = pctNow + '%';
        }
        function showGuess() {
          box.querySelector('[data-bval]').textContent = guess + '°';
          box.querySelector('[data-bnote]').hidden = true;
          box.querySelector('[data-bforms]').hidden = true;
        }
        function roll() {
          pctNow = 5 * (1 + Math.floor(Math.random() * 19));
          guess = 0;
          drawBonus();
          showGuess();
        }
        box.querySelectorAll('[data-bd]').forEach(function (bt) {
          bt.addEventListener('click', function () {
            guess = clamp(guess + Number(bt.getAttribute('data-bd')), 0, 360);
            ctx.sfx('click');
            showGuess();
          });
        });
        box.querySelector('[data-bcheck]').addEventListener('click', function () {
          var ok = Math.abs(guess - pctNow * 3.6) < 0.001;
          var noteEl = box.querySelector('[data-bnote]');
          noteEl.hidden = false;
          noteEl.textContent = ok ? 'נכון! כל אחוז הוא 3.6 מעלות.' : 'נסה שוב: הכפל את האחוז ב־3.6, וזכור שהעוגה כולה היא 360 מעלות.';
          noteEl.style.color = ok ? PAL.good : BAD;
          ctx.sfx(ok ? 'correct' : 'error');
          if (ok) {
            var forms = box.querySelector('[data-bforms]');
            forms.hidden = false;
            forms.innerHTML = bdi(pctNow + '% · 3.6 = ' + deg(pctNow) + '°');
          }
        });
        box.querySelector('[data-broll]').addEventListener('click', function () { ctx.sfx('click'); roll(); });
        roll();
      }
    }
  });
}());
