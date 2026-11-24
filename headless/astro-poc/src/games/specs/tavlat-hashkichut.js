/**
 * טבלת השכיחות — an engine game.
 *
 * The idea: raw answers become a frequency table (the counts add up to the
 * number of answers). Dividing each count by the total gives the relative
 * frequency, and those percentages add up to 100%. A bar chart tells the truth
 * only when its axis starts at zero.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var BAD = '#b91c1c', MUTED = '#475569', GRID = '#cbd5e1';
  var CATS = [
    { n: 'כלב', c: '#b45309', l: 'כ' },
    { n: 'חתול', c: '#6d28d9', l: 'ח' },
    { n: 'ציפור', c: '#0f766e', l: 'צ' },
    { n: 'דג', c: '#be123c', l: 'ד' }
  ];
  /* twenty raw answers: indexes into CATS */
  var RAW = [0, 1, 0, 3, 0, 1, 2, 0, 1, 3, 0, 1, 0, 3, 1, 0, 2, 3, 1, 0];
  var N = RAW.length;
  var TRUE_COUNTS = CATS.map(function (_, i) {
    return RAW.filter(function (r) { return r === i; }).length;
  });
  var TRUE_PCT = TRUE_COUNTS.map(function (c) { return Math.round(c * 100 / N); });
  var BIGGEST = Math.max.apply(null, TRUE_COUNTS);
  var CLUBS = [
    { n: 'ספורט', v: 50, c: '#b45309' },
    { n: 'מוזיקה', v: 45, c: '#6d28d9' },
    { n: 'ציור', v: 48, c: '#0f766e' },
    { n: 'שחמט', v: 40, c: '#be123c' }
  ];
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function setAttrs(el, obj) {
    if (!el) return;
    Object.keys(obj).forEach(function (k) { el.setAttribute(k, obj[k]); });
  }
  function mathT(id, size, fill, anchor) {
    return '<text id="' + id + '" x="0" y="0" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="' + (anchor || 'middle') + '"></text>';
  }
  function numT(x, y, size, fill, anchor, text) {
    return '<text x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="' + (anchor || 'middle') + '">' + text + '</text>';
  }
  function heT(x, y, size, fill, anchor, text) {
    return '<text x="' + x + '" y="' + y + '" font-family="Heebo, sans-serif" font-size="' + size
      + '" font-weight="700" fill="' + fill + '" text-anchor="' + (anchor || 'middle') + '">' + text + '</text>';
  }
  function handleG(id, label, color, min, max, val, text, orient) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + min + '" aria-valuemax="' + max
      + '" aria-valuenow="' + val + '" aria-valuetext="' + text + '" aria-orientation="' + (orient || 'vertical') + '" style="cursor:grab">'
      + '<circle r="32" fill="transparent"/><circle r="11" fill="#fff" stroke="' + color + '" stroke-width="4.5"/></g>';
  }
  /** Arrow keys, Page keys, Home and End on a handle. All routes call the same set(). */
  function bindKeys(el, get, set, lo, hi, step, big) {
    el.addEventListener('keydown', function (e) {
      var d = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
      else if (e.key === 'PageUp') d = big;
      else if (e.key === 'PageDown') d = -big;
      else if (e.key === 'Home') { e.preventDefault(); set(lo); return; }
      else if (e.key === 'End') { e.preventDefault(); set(hi); return; }
      if (!d) return;
      e.preventDefault();
      set(get() + d);
    });
  }
  /** items: [{ k, name, color, deltas, aria }] */
  function stepperHtml(items) {
    return '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px">' + items.map(function (it) {
      var neg = it.deltas.filter(function (d) { return d < 0; }).sort(function (x, y) { return x - y; });
      var pos = it.deltas.filter(function (d) { return d > 0; }).sort(function (x, y) { return x - y; });
      function btn(d) {
        return '<button type="button" data-k="' + it.k + '" data-delta="' + d + '" aria-label="'
          + (d < 0 ? 'הקטן' : 'הגדל') + ' ' + it.aria + ' ב־' + Math.abs(d) + '">' + (d < 0 ? '\u2212' : '+') + Math.abs(d) + '</button>';
      }
      return '<div class="unit" dir="ltr" style="gap:5px;padding:6px 6px"><span dir="rtl" style="font-family:Heebo,sans-serif;font-weight:800;font-size:13px;color:'
        + it.color + ';min-width:50px;text-align:center">' + it.name + '</span>'
        + neg.map(btn).join('')
        + '<bdi class="var math" dir="ltr" data-val="' + it.k + '" style="min-width:52px" aria-live="polite"></bdi>'
        + pos.map(btn).join('') + '</div>';
    }).join('') + '</div>';
  }
  function bindSteppers(box, set) {
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        set(bt.getAttribute('data-k'), Number(bt.getAttribute('data-delta')));
      });
    });
  }
  function cell(label, key, color) {
    return '<div><b>' + label + '</b><span class="math" dir="ltr" data-v="' + key + '" style="color:' + color + '"></span></div>';
  }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }

  /* ---------- scene 1: raw data to frequency table ---------- */
  var X1 = [80, 170, 260, 350], BASE1 = 290, UNIT1 = 12, MAX1 = 12;
  function chipsMarkup(prefix) {
    var s = '';
    RAW.forEach(function (r, i) {
      var cx = 30 + (i % 10) * 38, cy = 20 + Math.floor(i / 10) * 28;
      s += '<circle id="' + prefix + 'c' + i + '" cx="' + cx + '" cy="' + cy + '" r="12" fill="' + CATS[r].c + '" stroke="#fff" stroke-width="2"/>'
        + heT(cx, cy + 4.5, 13, '#fff', 'middle', CATS[r].l);
    });
    return s;
  }
  function countScene(ctx) {
    var vals = [5, 5, 5, 5], active = -1, doneOnce = false;
    var s = chipsMarkup('r')
      + heT(201, 80, 13, MUTED, 'middle', 'תשובות התלמידים: עיגול אחד הוא תלמיד אחד');
    for (var t = 0; t <= MAX1; t += 2) {
      var gy = BASE1 - t * UNIT1;
      s += '<line x1="52" y1="' + gy + '" x2="384" y2="' + gy + '" stroke="' + GRID + '" stroke-width="1"/>'
        + numT(44, gy + 4, 12, MUTED, 'end', t);
    }
    CATS.forEach(function (c, i) {
      s += '<rect id="bar' + i + '" x="' + (X1[i] - 28) + '" width="56" fill="' + c.c + '" fill-opacity=".35" stroke="' + c.c + '" stroke-width="2.5"/>'
        + mathT('val' + i, 18, c.c)
        + heT(X1[i], 314, 14, c.c, 'middle', c.n);
    });
    s += '<line x1="52" y1="' + BASE1 + '" x2="384" y2="' + BASE1 + '" stroke="' + INK + '" stroke-width="2.5"/>';
    CATS.forEach(function (c, i) {
      s += handleG('h' + i, 'גובה העמודה של ' + c.n + ': השכיחות. חצים משנים אותה', c.c, 0, MAX1, vals[i], vals[i] + ' תשובות');
    });
    ctx.draw(s);
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(5,1fr)">'
      + CATS.map(function (c, i) { return cell(c.n, 'f' + i, c.c); }).join('')
      + '<div><b>סך הכול</b><span class="math" dir="ltr" data-v="tot" style="color:' + INK + '"></span></div></div>'
      + '<div style="margin-top:8px">' + stepperHtml(CATS.map(function (c, i) {
        return { k: i, name: c.n, color: c.c, deltas: [-1, 1], aria: 'השכיחות של ' + c.n };
      })) + '</div>');
    ctx.register('controls', box);
    function render() {
      CATS.forEach(function (c, i) {
        var top = BASE1 - vals[i] * UNIT1;
        setAttrs(ctx.el('bar' + i), { y: top, height: vals[i] * UNIT1 });
        ctx.el('h' + i).setAttribute('transform', 'translate(' + X1[i] + ' ' + top + ')');
        setAttrs(ctx.el('h' + i), { 'aria-valuenow': vals[i], 'aria-valuetext': vals[i] + ' תשובות' });
        var v = ctx.el('val' + i);
        v.textContent = vals[i];
        setAttrs(v, { x: X1[i], y: top - 20 });
        box.querySelector('[data-v="f' + i + '"]').textContent = vals[i];
        box.querySelector('[data-val="' + i + '"]').textContent = vals[i];
      });
      RAW.forEach(function (r, i) {
        var chip = ctx.el('rc' + i);
        setAttrs(chip, { stroke: r === active ? INK : '#fff', 'stroke-width': r === active ? 4 : 2 });
      });
      var tot = sum(vals);
      box.querySelector('[data-v="tot"]').textContent = tot;
      box.querySelector('[data-v="tot"]').style.color = tot === N ? PAL.good : BAD;
      ctx.caption(m(vals.join(' + ') + ' = ' + tot));
    }
    function defaultNote() {
      var tot = sum(vals);
      if (tot === N) ctx.note('הסכום הוא ' + m(String(tot)) + ', כמספר התשובות. עכשיו לחץ "בדוק את הטבלה".');
      else ctx.note('סכום השכיחויות עכשיו ' + m(String(tot)) + ', ואילו יש ' + m(String(N)) + ' תשובות. כל תשובה נספרת פעם אחת, ולכן הסכום חייב להיות שווה למספר התשובות.');
    }
    function setCount(i, v) {
      i = Number(i);
      var nv = clamp(v, 0, MAX1);
      active = i;
      if (nv !== vals[i]) {
        vals[i] = nv;
        ctx.sfx('tick');
      }
      render();
      defaultNote();
    }
    bindSteppers(box, function (k, d) { setCount(k, vals[Number(k)] + d); });
    CATS.forEach(function (c, i) {
      var h = ctx.el('h' + i);
      bindKeys(h, function () { return vals[i]; }, function (v) { setCount(i, v); }, 0, MAX1, 1, 2);
      h.addEventListener('focus', function () { active = i; render(); });
    });
    var which = -1;
    ctx.drag(ctx.svg, {
      start: function (x, y) {
        which = -1;
        if (y < 96) return;
        var best = 0;
        X1.forEach(function (cx, i) { if (Math.abs(x - cx) < Math.abs(x - X1[best])) best = i; });
        which = best;
      },
      move: function (x, y) {
        if (which < 0) return;
        setCount(which, Math.round((BASE1 - y) / UNIT1));
      }
    });
    ctx.button('בדוק את הטבלה', function () {
      var tot = sum(vals);
      if (tot !== N) {
        ctx.sfx('error');
        ctx.note('הסכום ' + m(String(tot)) + ' שונה מ־' + m(String(N)) + '. ' + (tot < N ? 'פספסת תשובות.' : 'ספרת תשובות כפולות.') + ' ספור שוב: הדגש את הקטגוריה והשווה לעיגולים.');
        return;
      }
      var bad = [], more = 0, less = 0;
      CATS.forEach(function (c, i) {
        if (vals[i] !== TRUE_COUNTS[i]) {
          bad.push(c.n);
          if (vals[i] > TRUE_COUNTS[i]) more += 1; else less += 1;
        }
      });
      if (bad.length) {
        ctx.sfx('error');
        ctx.note('הסכום ' + m(String(N)) + ' נכון, אבל זה לא מספיק: קטגוריה אחת קיבלה יותר מדי ואחרת פחות. בדוק שוב את: ' + bad.join(', ') + '. ספור את העיגולים בצבע של כל אחת.');
        return;
      }
      ctx.sfx('correct');
      ctx.note('כל הספירות נכונות והסכום הוא ' + m(String(N)) + '. זו טבלת שכיחויות: ' + m(TRUE_COUNTS.join(' + ') + ' = ' + N) + '.', 'good');
      if (!doneOnce) { doneOnce = true; ctx.burst(16); ctx.solved(); }
    }, { id: 'chk', target: 'check' });
    render();
    defaultNote();
  }

  /* ---------- scene 2: relative frequency ---------- */
  var X2 = 120, SC2 = 2.4, CY2 = [66, 128, 190, 252];
  function percentScene(ctx) {
    var vals = [10, 10, 10, 10], doneOnce = false;
    var s = heT(201, 18, 13, MUTED, 'middle', 'כל התשובות יחד הן מאה אחוז');
    [0, 25, 50, 75, 100].forEach(function (p) {
      var x = X2 + p * SC2;
      s += '<line x1="' + x + '" y1="40" x2="' + x + '" y2="278" stroke="' + GRID + '" stroke-width="1"/>'
        + numT(x, 296, 12, MUTED, 'middle', p + '%');
    });
    CATS.forEach(function (c, i) {
      var cy = CY2[i];
      s += '<circle cx="22" cy="' + cy + '" r="15" fill="' + c.c + '"/>' + numT(22, cy + 5, 14, '#fff', 'middle', TRUE_COUNTS[i])
        + heT(72, cy + 5, 14, c.c, 'middle', c.n)
        + '<rect x="' + X2 + '" y="' + (cy - 13) + '" width="' + (100 * SC2) + '" height="26" rx="4" fill="#f1f5f9"/>'
        + '<rect id="pb' + i + '" x="' + X2 + '" y="' + (cy - 13) + '" height="26" rx="4" fill="' + c.c + '" fill-opacity=".4" stroke="' + c.c + '" stroke-width="2.5"/>'
        + mathT('pv' + i, 16, c.c);
    });
    CATS.forEach(function (c, i) {
      s += handleG('h' + i, 'האחוז של ' + c.n + ': החלק שלה מכל התשובות. חצים משנים אותו', c.c, 0, 100, vals[i], vals[i] + ' אחוז', 'horizontal');
    });
    ctx.draw(s);
    var box = ctx.extra('<div style="display:flex;align-items:center;justify-content:center;gap:8px;direction:rtl;font-weight:800;font-size:14px;color:' + INK + ';background:#fff;border:1.5px solid var(--main-line);border-radius:14px;padding:8px 6px">'
      + '<span>שכיחות יחסית =</span>'
      + '<span style="display:inline-flex;flex-direction:column;align-items:center;line-height:1.35"><span style="padding:0 6px">שכיחות</span><span style="border-top:2px solid ' + INK + ';padding:0 6px">סך הכול</span></span>'
      + '<span dir="ltr">\u00D7 <bdi class="math" dir="ltr">100%</bdi></span></div>'
      + '<div class="sceneStrip" style="grid-template-columns:repeat(5,1fr);margin-top:8px">'
      + CATS.map(function (c, i) { return cell(c.n, 'p' + i, c.c); }).join('')
      + '<div><b>סכום האחוזים</b><span class="math" dir="ltr" data-v="tot" style="color:' + INK + '"></span></div></div>'
      + '<div style="margin-top:8px">' + stepperHtml(CATS.map(function (c, i) {
        return { k: i, name: c.n, color: c.c, deltas: [-5, -1, 1, 5], aria: 'האחוז של ' + c.n };
      })) + '</div>');
    ctx.register('controls', box);
    function render() {
      CATS.forEach(function (c, i) {
        var x = X2 + vals[i] * SC2;
        setAttrs(ctx.el('pb' + i), { width: Math.max(0.1, vals[i] * SC2) });
        ctx.el('h' + i).setAttribute('transform', 'translate(' + r1(x) + ' ' + CY2[i] + ')');
        setAttrs(ctx.el('h' + i), { 'aria-valuenow': vals[i], 'aria-valuetext': vals[i] + ' אחוז' });
        var v = ctx.el('pv' + i);
        v.textContent = vals[i] + '%';
        setAttrs(v, { x: r1(clamp(x, 146, 372)), y: CY2[i] - 21 });
        box.querySelector('[data-v="p' + i + '"]').textContent = vals[i] + '%';
        box.querySelector('[data-val="' + i + '"]').textContent = vals[i] + '%';
      });
      var tot = sum(vals);
      box.querySelector('[data-v="tot"]').textContent = tot + '%';
      box.querySelector('[data-v="tot"]').style.color = tot === 100 ? PAL.good : BAD;
      ctx.caption(m(vals.join('% + ') + '% = ' + tot + '%'));
    }
    function defaultNote() {
      var tot = sum(vals);
      ctx.note('סכום האחוזים עכשיו ' + m(tot + '%') + '. חשב לכל קטגוריה את השכיחות שלה חלקי ' + m(String(N)) + ', ואז הכפל ב־' + m('100') + '. כל האחוזים יחד חייבים להיות ' + m('100%') + '.');
    }
    function setPct(i, v) {
      i = Number(i);
      var nv = clamp(v, 0, 100);
      if (nv !== vals[i]) { vals[i] = nv; ctx.sfx('tick'); }
      render();
      defaultNote();
    }
    bindSteppers(box, function (k, d) { setPct(k, vals[Number(k)] + d); });
    CATS.forEach(function (c, i) {
      var h = ctx.el('h' + i);
      bindKeys(h, function () { return vals[i]; }, function (v) { setPct(i, v); }, 0, 100, 1, 5);
    });
    var which = -1;
    ctx.drag(ctx.svg, {
      start: function (x, y) {
        which = -1;
        if (y < 38 || y > 280) return;
        var best = 0;
        CY2.forEach(function (cy, i) { if (Math.abs(y - cy) < Math.abs(y - CY2[best])) best = i; });
        which = best;
      },
      move: function (x) {
        if (which < 0) return;
        setPct(which, Math.round((x - X2) / SC2));
      }
    });
    ctx.button('בדוק את האחוזים', function () {
      var tot = sum(vals), msg = '';
      CATS.forEach(function (c, i) {
        if (msg || vals[i] === TRUE_PCT[i]) return;
        if (vals[i] === Math.round(TRUE_COUNTS[i] * 100 / BIGGEST)) {
          msg = 'באחוזים של ' + c.n + ' חילקת בשכיחות הגדולה ביותר, ' + m(String(BIGGEST)) + ', ולא בסך הכול, ' + m(String(N)) + '. החלק נמדד תמיד מתוך כל התשובות.';
        } else if (vals[i] === TRUE_COUNTS[i]) {
          msg = 'כתבת את השכיחות של ' + c.n + ' כאילו היא אחוז: ' + m(vals[i] + '%') + '. כדי לקבל אחוז צריך לחלק בסך הכול ולהכפיל ב־' + m('100') + '.';
        }
      });
      if (!msg && tot !== 100) msg = 'האחוזים מסתכמים ב־' + m(tot + '%') + ' ולא ב־' + m('100%') + '. כל התשובות יחד הן מאה אחוז, ולכן אחד האחוזים חושב לא נכון.';
      if (!msg && vals.some(function (v, i) { return v !== TRUE_PCT[i]; })) {
        msg = 'הסכום ' + m('100%') + ' לא מספיק: האחוזים מתחלקים לא נכון בין הקטגוריות. לכל אחת חשב את השכיחות חלקי ' + m(String(N)) + ' והכפל ב־' + m('100') + '.';
      }
      if (msg) { ctx.sfx('error'); ctx.note(msg); return; }
      ctx.sfx('correct');
      ctx.note(m(TRUE_COUNTS[0] + ' ÷ ' + N + ' = ' + (TRUE_COUNTS[0] / N) + ' = ' + TRUE_PCT[0] + '%') + ', וכך לכל קטגוריה. הסכום הוא ' + m('100%') + '.', 'good');
      if (!doneOnce) { doneOnce = true; ctx.burst(16); ctx.solved(); }
    }, { id: 'chk', target: 'check' });
    render();
    defaultNote();
  }

  /* ---------- scene 3: bar chart and the axis ---------- */
  var XB = [130, 200, 270, 340], BASE3 = 270, H3 = 220, TMAX = 60, AXX = 34, AUNIT = 5;
  function axisScene(ctx) {
    var vals = [30, 30, 30, 30], st = 0, seen = false, doneOnce = false;
    function yOf(v) { return BASE3 - Math.max(0, v - st) / (TMAX - st) * H3; }
    var s = heT(235, 22, 13, MUTED, 'middle', 'כמה תלמידים בכל חוג')
      + heT(AXX, 42, 12, MUTED, 'middle', 'תחילת הציר')
      + '<line x1="' + AXX + '" y1="' + (BASE3 - 30 * AUNIT) + '" x2="' + AXX + '" y2="' + BASE3 + '" stroke="' + GRID + '" stroke-width="6" stroke-linecap="round"/>'
      + '<g id="ticks"></g>'
      + '<line x1="90" y1="' + BASE3 + '" x2="388" y2="' + BASE3 + '" stroke="' + INK + '" stroke-width="2.5"/>'
      + '<line x1="90" y1="50" x2="90" y2="' + BASE3 + '" stroke="' + INK + '" stroke-width="2.5"/>'
      + '<g id="brk" opacity="0"><path d="M82 262 l8 -5 l-8 -5 l8 -5" fill="none" stroke="' + BAD + '" stroke-width="3" stroke-linecap="round"/>'
      + heT(235, 322, 13, BAD, 'middle', 'הציר לא מתחיל באפס') + '</g>';
    CLUBS.forEach(function (c, i) {
      s += '<rect id="bar' + i + '" x="' + (XB[i] - 26) + '" width="52" fill="' + c.c + '" fill-opacity=".35" stroke="' + c.c + '" stroke-width="2.5"/>'
        + mathT('val' + i, 17, c.c)
        + heT(XB[i], 292, 13, c.c, 'middle', c.n);
    });
    CLUBS.forEach(function (c, i) {
      s += handleG('b' + i, 'גובה העמודה של ' + c.n + '. חצים משנים אותו', c.c, 0, TMAX, vals[i], vals[i] + ' תלמידים');
    });
    s += handleG('ax', 'תחילת הציר האנכי. חצים מזיזים אותו בקפיצות של עשר', '#475569', 0, 30, st, st + ' תחילת הציר');
    ctx.draw(s);
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(5,1fr)">'
      + CLUBS.map(function (c, i) { return cell(c.n, 'd' + i, c.c).replace('data-v="d' + i + '" style', 'data-v="d' + i + '" style'); }).join('')
      + '<div><b>תחילת הציר</b><span class="math" dir="ltr" data-v="st" style="color:' + INK + '"></span></div></div>'
      + '<div style="margin-top:8px">' + stepperHtml(CLUBS.map(function (c, i) {
        return { k: 'b' + i, name: c.n, color: c.c, deltas: [-5, -1, 1, 5], aria: 'גובה העמודה של ' + c.n };
      }).concat([{ k: 'ax', name: 'תחילת הציר', color: '#475569', deltas: [-10, 10], aria: 'תחילת הציר' }])) + '</div>');
    ctx.register('controls', box);
    CLUBS.forEach(function (c, i) { box.querySelector('[data-v="d' + i + '"]').textContent = c.v; });
    function allOk() { return vals.every(function (v, i) { return v === CLUBS[i].v; }); }
    function okCount() { return vals.filter(function (v, i) { return v === CLUBS[i].v; }).length; }
    function drawTicks() {
      var t = '';
      var first = Math.ceil(st / 10) * 10;
      for (var v = first; v <= TMAX; v += 10) {
        var y = yOf(v);
        t += '<line x1="90" y1="' + r1(y) + '" x2="388" y2="' + r1(y) + '" stroke="' + GRID + '" stroke-width="1"/>'
          + numT(82, r1(y) + 4, 12, MUTED, 'end', v);
      }
      ctx.el('ticks').innerHTML = t;
    }
    function render() {
      drawTicks();
      CLUBS.forEach(function (c, i) {
        var y = yOf(vals[i]);
        setAttrs(ctx.el('bar' + i), { y: r1(y), height: r1(BASE3 - y) });
        ctx.el('b' + i).setAttribute('transform', 'translate(' + XB[i] + ' ' + r1(y) + ')');
        setAttrs(ctx.el('b' + i), { 'aria-valuenow': vals[i], 'aria-valuetext': vals[i] + ' תלמידים' });
        var v = ctx.el('val' + i);
        v.textContent = vals[i];
        setAttrs(v, { x: XB[i], y: r1(y) - 20 });
        box.querySelector('[data-val="b' + i + '"]').textContent = vals[i];
      });
      ctx.el('ax').setAttribute('transform', 'translate(' + AXX + ' ' + (BASE3 - st * AUNIT) + ')');
      setAttrs(ctx.el('ax'), { 'aria-valuenow': st, 'aria-valuetext': 'הציר מתחיל ב־' + st });
      ctx.el('brk').setAttribute('opacity', st > 0 ? '1' : '0');
      box.querySelector('[data-val="ax"]').textContent = st;
      box.querySelector('[data-v="st"]').textContent = st;
      ctx.caption(allOk() ? m('50 ÷ 40 = 1.25') : '');
    }
    function note() {
      if (!allOk()) {
        if (st > 0) {
          ctx.note('קודם בנה את העמודות לפי הטבלה על ציר שמתחיל באפס. כרגע ' + m(String(okCount())) + ' מתוך ' + m('4') + ' עמודות נכונות.');
          return;
        }
        var wrong = '';
        CLUBS.forEach(function (c, i) {
          if (!wrong && vals[i] !== c.v) wrong = 'העמודה של ' + c.n + ' ' + (vals[i] < c.v ? 'נמוכה' : 'גבוהה') + ' מהנתון בטבלה.';
        });
        ctx.note(m(String(okCount())) + ' מתוך ' + m('4') + ' עמודות תואמות לטבלה. ' + wrong);
        return;
      }
      if (st === 0 && !seen) {
        ctx.note('העמודות תואמות לטבלה, והציר מתחיל באפס. עכשיו הרם את תחילת הציר עד ' + m('30') + ' וראה מה קורה להפרשים.');
      } else if (st === 0) {
        ctx.note('עכשיו העמודות והציר ישרים: הגובה מייצג את הנתון עצמו. ' + m('50 ÷ 40 = 1.25') + ': העמודה הגבוהה גבוהה רק ברבע מהנמוכה.', 'good');
      } else {
        var ratio = Math.round((50 - st) / (40 - st) * 100) / 100;
        ctx.note('כשהציר מתחיל ב־' + m(String(st)) + ', עמודת הספורט נראית פי ' + m(String(ratio)) + ' מעמודת השחמט, אבל בנתונים היחס הוא ' + m('50 ÷ 40 = 1.25') + ' בלבד. ציר שלא מתחיל באפס מגזים בהבדל. החזר אותו לאפס.');
      }
    }
    function check() {
      if (allOk() && st >= 30) seen = true;
      if (allOk() && st === 0 && seen && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    function setBar(i, v) {
      i = Number(i);
      if (st > 0) {
        ctx.sfx('error');
        ctx.note('כדי לשנות עמודה צריך להחזיר את תחילת הציר לאפס. עמודות נבנות מציר שמתחיל ב־' + m('0') + '.');
        return;
      }
      var nv = clamp(v, 0, TMAX);
      if (nv !== vals[i]) { vals[i] = nv; ctx.sfx('tick'); }
      render(); note(); check(); render(); note();
    }
    function setAxis(v) {
      var nv = clamp(Math.round(v / 10) * 10, 0, 30);
      if (nv !== st) { st = nv; ctx.sfx('tick'); }
      render(); check(); render(); note();
    }
    bindSteppers(box, function (k, d) {
      if (k === 'ax') setAxis(st + d); else setBar(k.slice(1), vals[Number(k.slice(1))] + d);
    });
    CLUBS.forEach(function (c, i) {
      bindKeys(ctx.el('b' + i), function () { return vals[i]; }, function (v) { setBar(i, v); }, 0, TMAX, 1, 5);
    });
    bindKeys(ctx.el('ax'), function () { return st; }, setAxis, 0, 30, 10, 10);
    var which = -2;
    ctx.drag(ctx.svg, {
      start: function (x, y) {
        which = -2;
        if (x < 64) { which = -1; return; }
        if (y < 36 || y > 280) return;
        var best = 0;
        XB.forEach(function (cx, i) { if (Math.abs(x - cx) < Math.abs(x - XB[best])) best = i; });
        which = best;
      },
      move: function (x, y) {
        if (which === -2) return;
        if (which === -1) { setAxis((BASE3 - y) / AUNIT); return; }
        setBar(which, Math.round(st + (BASE3 - y) / H3 * (TMAX - st)));
      }
    });
    render();
    note();
  }

  /* ---------- quiz pictures ---------- */
  function pictogramPicture(ctx) {
    var rows = [{ n: 'פיצה', k: 3.5, c: '#b45309' }, { n: 'פסטה', k: 2, c: '#6d28d9' }, { n: 'סושי', k: 5, c: '#0f766e' }];
    var s = '';
    rows.forEach(function (r, ri) {
      var cy = 36 + ri * 48;
      s += heT(392, cy + 5, 15, r.c, 'end', r.n);
      for (var i = 0; i < Math.ceil(r.k); i++) {
        var cx = 318 - i * 46;
        var half = r.k - i < 1;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="17" fill="' + (half ? '#fff' : r.c) + '" stroke="' + r.c + '" stroke-width="3"/>';
        if (half) s += '<path d="M' + cx + ' ' + (cy - 17) + ' A17 17 0 0 1 ' + cx + ' ' + (cy + 17) + ' Z" fill="' + r.c + '"/>';
      }
    });
    s += '<line x1="20" y1="170" x2="392" y2="170" stroke="' + GRID + '" stroke-width="1.5"/>'
      + heT(392, 196, 14, INK, 'end', 'מפתח:')
      + '<circle cx="335" cy="191" r="12" fill="' + MUTED + '"/>'
      + numT(312, 197, 16, INK, 'middle', '=')
      + numT(290, 197, 16, INK, 'middle', '4')
      + heT(262, 196, 14, INK, 'end', 'תלמידים');
    ctx.draw(s);
  }
  function axisPicture(ctx) {
    function chart(x0, lo, ticks, title) {
      var s = heT(x0 + 80, 26, 14, INK, 'middle', title);
      var H = 140, BASE = 190, TOP = 50;
      ticks.forEach(function (t) {
        var y = BASE - (t - lo) / (50 - lo) * H;
        s += '<line x1="' + (x0 + 8) + '" y1="' + y + '" x2="' + (x0 + 168) + '" y2="' + y + '" stroke="' + GRID + '" stroke-width="1"/>'
          + numT(x0 + 4, y + 4, 12, MUTED, 'end', t);
      });
      [{ v: 44, cx: x0 + 52, c: '#0f766e', n: 'חברה א׳' }, { v: 48, cx: x0 + 122, c: '#be123c', n: 'חברה ב׳' }].forEach(function (b) {
        var h = (b.v - lo) / (50 - lo) * H;
        s += '<rect x="' + (b.cx - 22) + '" y="' + (BASE - h) + '" width="44" height="' + h + '" fill="' + b.c + '" fill-opacity=".4" stroke="' + b.c + '" stroke-width="2.5"/>'
          + heT(b.cx, 212, 12, b.c, 'middle', b.n);
      });
      s += '<line x1="' + (x0 + 8) + '" y1="' + BASE + '" x2="' + (x0 + 168) + '" y2="' + BASE + '" stroke="' + INK + '" stroke-width="2.5"/>';
      return s + '<rect x="0" y="0" width="0" height="0" data-t="' + TOP + '"/>';
    }
    ctx.draw(chart(26, 0, [0, 25, 50], 'גרף א׳') + chart(214, 40, [40, 45, 50], 'גרף ב׳'));
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'טבלת השכיחות',
      sub: 'מרשימת תשובות גולמית לטבלה, לאחוזים ולעמודות שמספרות אמת.',
      tip: 'שלום, אני אליהו. היום נהפוך רשימת תשובות לטבלה, נחשב אחוזים ונבנה עמודות שלא מטעות.',
      emoji: '📊',
      eq: 'שכיחות · שכיחות יחסית · עמודות',
      note: 'שכיחות היא מספר הפעמים שערך מופיע. שכיחות יחסית היא החלק שלו מכל הנתונים, ' + 'השכיחות חלקי סך הכול' + ', ואפשר לכתוב אותו באחוזים. אחרי שיש טבלה, מציירים עמודות.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מנתונים גולמיים לטבלה',
      sub: 'שאלו ' + m(String(N)) + ' תלמידים איזו חיה הם אוהבים. קבע את השכיחות של כל קטגוריה בגרירה, בכפתורים או בחיצים, ולחץ "בדוק את הטבלה".',
      tip: 'ספור כמה עיגולים יש מכל צבע. הסכום של כל השכיחויות חייב להיות כמספר התשובות.',
      cue: 'הגדר את כל השכיחויות ובדוק את הטבלה',
      cueDone: 'הטבלה נכונה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 330],
      alt: 'עשרים עיגולים צבעוניים, כל אחד הוא תשובה של תלמיד, ומתחתיהם ארבע עמודות לכלב, חתול, ציפור ודג, שגובה כל אחת הוא השכיחות וניתן לשנות אותו',
      nudge: { target: 'controls', text: 'ספור את העיגולים של כל צבע והזן את השכיחות בכפתורי הפלוס והמינוס.' },
      setup: countScene
    },
    {
      mode: 'quiz',
      tA: 'קוראים פיקטוגרמה',
      sub: 'בפיקטוגרמה כל עיגול מייצג ' + m('4') + ' תלמידים. מה השכיחות של פיצה?',
      tip: 'המפתח אומר כמה כל סמל שווה. כמה סמלים יש בשורת הפיצה, וכמה שווה חצי סמל?',
      btn: 'המשך ←',
      aspect: [402, 220],
      alt: 'פיקטוגרמה של אוכל אהוב: שורת פיצה עם שלושה עיגולים וחצי, שורת פסטה עם שני עיגולים ושורת סושי עם חמישה. המפתח: עיגול אחד הוא ארבעה תלמידים',
      setup: pictogramPicture,
      win: 'נכון. סמלים כפול ערך המפתח, וחצי סמל הוא חצי מהערך.',
      wrongSay: 'ספור את הסמלים ואז הכפל בערך של סמל אחד במפתח.',
      opts: [
        { t: m('16'), f: 'ספרת את החצי כסמל שלם. חצי סמל שווה רק חצי מ־' + m('4') + ', כלומר ' + m('2') + '.' },
        { t: m('14'), c: true, f: 'נכון: ' + m('3.5 × 4 = 14') + ', כי שלושה סמלים שלמים הם ' + m('12') + ' וחצי סמל הוא ' + m('2') + '.' },
        { t: m('3.5'), f: 'ספרת רק את מספר הסמלים והתעלמת מהמפתח. כל סמל שווה ' + m('4') + ' תלמידים, לא תלמיד אחד.' },
        { t: m('7.5'), f: 'הוספת את ערך המפתח למספר הסמלים. צריך להכפיל: מספר הסמלים כפול ערך סמל אחד.' }
      ],
      hints: [
        'הסתכל במפתח: כמה תלמידים מייצג סמל אחד?',
        'ספור את הסמלים בשורת הפיצה, כולל החצי, ואז הכפל בערך של סמל.',
        'בשורת הפיצה ' + m('3.5') + ' סמלים, וכל סמל שווה ' + m('4') + '. חשב ' + m('3.5 × 4') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'שכיחות יחסית באחוזים',
      sub: 'הפוך כל שכיחות לאחוז מכל ' + m(String(N)) + ' התשובות. קבע את האחוזים בגרירה, בכפתורים או בחיצים, ולחץ "בדוק את האחוזים".',
      tip: 'חלק כל שכיחות בסך הכול, ' + m(String(N)) + ', והכפל במאה אחוז. הסכום חייב להיות מאה אחוז.',
      cue: 'הגדר את האחוזים ובדוק אותם',
      cueDone: 'האחוזים נכונים ומסתכמים ב־100%. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 310],
      alt: 'ארבעה פסים אופקיים, אחד לכל קטגוריה, שאורכם הוא האחוז של הקטגוריה מכל התשובות, ולצד כל פס עיגול עם השכיחות. אפשר להזיז את קצה כל פס',
      nudge: { target: 'controls', text: 'חשב לקטגוריה אחת שכיחות ÷ סך הכול, והזן את התוצאה באחוזים.' },
      setup: percentScene
    },
    {
      mode: 'quiz',
      tA: 'שכיחות או שכיחות יחסית',
      sub: 'בכיתה א׳ ' + m('6') + ' מתוך ' + m('20') + ' תלמידים בחרו כדורגל. בכיתה ב׳ ' + m('9') + ' מתוך ' + m('45') + '. באיזו כיתה החלק של הבוחרים גדול יותר?',
      tip: 'הכיתות שונות בגודלן, ולכן שכיחות לבדה לא מספיקה. מה משווים במקום?',
      btn: 'המשך ←',
      win: 'נכון. כדי להשוות קבוצות בגדלים שונים משווים שכיחויות יחסיות.',
      wrongSay: 'חשב לכל כיתה את החלק של הבוחרים מתוך כל הכיתה.',
      opts: [
        { t: 'כיתה ב׳, כי ' + m('9') + ' גדול מ־' + m('6'), f: 'השווית שכיחויות בלבד. כיתה ב׳ גדולה יותר, ולכן שכיחות גבוהה בה לא אומרת שהחלק גדול יותר.' },
        { t: 'אי אפשר לדעת, כי הכיתות שונות בגודלן', f: 'אפשר: שכיחות יחסית נועדה בדיוק להשוות קבוצות בגדלים שונים.' },
        { t: 'שווה בשתי הכיתות, כי בשתיהן הבוחרים הם פחות ממחצית', f: 'פחות ממחצית אינו אומר שווה. החלקים שונים: ' + m('30%') + ' מול ' + m('20%') + '.' },
        { t: 'כיתה א׳, כי ' + m('6 ÷ 20 = 30%') + ' ו־' + m('9 ÷ 45 = 20%'), c: true, f: 'נכון: ' + m('6 ÷ 20 = 0.3 = 30%') + ' ו־' + m('9 ÷ 45 = 0.2 = 20%') + '. החלק בכיתה א׳ גדול יותר.' }
      ],
      hints: [
        'כדי להשוות חלקים, מחשבים את החלק של הבוחרים מכל כיתה.',
        'חלק את מספר הבוחרים בגודל הכיתה, ואז השווה את שתי התוצאות.',
        'חשב ' + m('6 ÷ 20') + ' ואת ' + m('9 ÷ 45') + ', והפוך כל אחת לאחוזים.'
      ]
    },
    {
      mode: 'scene',
      tA: 'עמודות בלי להטעות',
      sub: 'בנה את העמודות לפי הטבלה בגרירה, בכפתורים או בחיצים. אחר כך הזז את תחילת הציר ל־' + m('30') + ' וראה מה קורה, והחזר אותו לאפס.',
      tip: 'שני הציורים מציגים אותם נתונים. ראה איך תחילת הציר משנה את מה שהעין רואה.',
      cue: 'בנה את העמודות, הרם את הציר ל־30 והחזר לאפס',
      cueDone: 'ציר שמתחיל באפס מראה את האמת. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 330],
      alt: 'דיאגרמת עמודות של ארבעה חוגים עם ציר אנכי. בצד שמאל מחוון שמזיז את תחילת הציר, ועל ראש כל עמודה ידית שמשנה את גובהה',
      nudge: { target: 'controls', text: 'שנה את גובה העמודות לפי הטבלה, ואז הזז את תחילת הציר בכפתורי הפלוס והמינוס.' },
      setup: axisScene
    },
    {
      mode: 'quiz',
      tA: 'ציר שמטעה',
      sub: 'שני הגרפים מציגים מכירות של שתי חברות: ' + m('44') + ' ו־' + m('48') + '. בגרף ב׳ נראה שחברה ב׳ מכרה כמעט פי שניים. מה נכון?',
      tip: 'שני הגרפים מראים אותם נתונים. מה שונה ביניהם, ומה זה עושה לעמודות?',
      btn: 'המשך ←',
      aspect: [402, 230],
      alt: 'שני גרפי עמודות עם אותם נתונים של שתי חברות. בגרף א׳ הציר מתחיל באפס והעמודות כמעט שוות. בגרף ב׳ הציר מתחיל בארבעים והעמודה של חברה ב׳ נראית כפולה',
      setup: axisPicture,
      win: 'נכון. תחילת ציר שאינה אפס מגזימה בהבדלים.',
      wrongSay: 'השווה את תחילת הציר בשני הגרפים, ואת המספרים עצמם.',
      opts: [
        { t: 'ציר גרף ב׳ מתחיל ב־' + m('40') + ', ולכן ההפרש נראה גדול. בפועל ' + m('48') + ' מול ' + m('44'), c: true, f: 'נכון: הציר מתחיל ב־' + m('40') + ', ולכן הגבהים הם ' + m('4') + ' ו־' + m('8') + '. בנתונים ההפרש הוא ' + m('4') + ' בלבד.' },
        { t: 'חברה ב׳ מכרה בדיוק פי שניים, וגרף א׳ שגוי', f: 'חברה ב׳ מכרה ' + m('48') + ' ולא ' + m('88') + '. גובה העמודה בגרף ב׳ הוא אשליה של תחילת הציר.' },
        { t: 'הגרפים מראים נתונים שונים, ולכן הם סותרים', f: 'הנתונים זהים, ' + m('44') + ' ו־' + m('48') + ' בשניהם. רק תחילת הציר שונה.' },
        { t: 'גרף ב׳ טוב יותר כי הוא מדגיש את ההפרש', f: 'הדגשה כזו היא הטעיה: הציור מראה הבדל גדול מזה שבנתונים. גרף ישר מתחיל באפס.' }
      ],
      hints: [
        'השווה את הציר האנכי בשני הגרפים: מאיפה כל אחד מתחיל?',
        'בגרף ב׳ הציר מתחיל במספר שאינו אפס. מה זה עושה לגובה העמודות?',
        'בגרף ב׳ הגבהים מתחילים ממספר גדול, ולכן ' + m('48 − 40 = 8') + ' נראה כפול מ־' + m('44 − 40 = 4') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'אחוזים שלא מסתכמים',
      sub: 'בסקר חישבו אחוזים לארבע קטגוריות: ' + m('45%') + ', ' + m('30%') + ', ' + m('20%') + ' ו־' + m('15%') + '. מה הבעיה?',
      tip: 'כל הקטגוריות יחד הן כל הנתונים. כמה צריך להיות הסכום?',
      btn: 'לסיכום ←',
      win: 'מעולה. אחוזים של כל הקטגוריות חייבים להסתכם ב־100%.',
      wrongSay: 'חבר את ארבעת האחוזים והשווה למאה אחוז.',
      opts: [
        { t: 'אין בעיה, אחוזים אינם חייבים להסתכם ב־' + m('100%'), f: 'שכיחויות יחסיות של כל הקטגוריות מכסות את כל הנתונים, ולכן הן מסתכמות בדיוק ב־' + m('100%') + '.' },
        { t: 'חסרים ' + m('10%') + ' כדי להגיע ל־' + m('100%'), f: 'הכיוון הפוך: ' + m('45 + 30 + 20 + 15 = 110') + ', כלומר יש עודף של ' + m('10%') + ' ולא חסר.' },
        { t: 'הסכום ' + m('110%') + ' גדול מ־' + m('100%') + ', ולכן אחד האחוזים חושב לא נכון', c: true, f: 'נכון: ' + m('45% + 30% + 20% + 15% = 110%') + '. כנראה חילקו בסך כולל קטן מדי, וצריך לחשב מחדש.' },
        { t: 'הקטגוריה הראשונה צריכה להיות ' + m('100%'), f: 'קטגוריה אחת אינה צריכה להיות ' + m('100%') + '. כולן יחד מסתכמות בכך.' }
      ],
      hints: [
        'כל הקטגוריות יחד מכסות את כל הנתונים. כמה זה באחוזים?',
        'חבר את ארבעת האחוזים והשווה לתוצאה שצריכה לצאת.',
        'חשב ' + m('45 + 30 + 20 + 15') + ' והשווה ל־' + m('100') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את טבלת השכיחות',
      sub: 'שכיחויות שמסתכמות בסך הכול, אחוזים שמסתכמים במאה, ועמודות מאפס.',
      tip: 'כל הכבוד. לפני שמאמינים לגרף, בודקים מאיפה הציר מתחיל.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'שכיחות סופרים, שכיחות יחסית מחלקים בסך הכול, ועמודות בונים מציר שמתחיל באפס:',
      formula: 'שכיחות יחסית = השכיחות חלקי סך הכול; באחוזים כופלים ב־' + m('100') + ', וסכום כל האחוזים הוא ' + m('100%')
    }
  ];
  window.NoamGame.boot({
    slug: 'tavlat-hashkichut',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'קריאת פיקטוגרמה', math: '3.5 × 4' },
      { step: 4, name: 'שכיחות יחסית', math: '6 ÷ 20 = 30%' },
      { step: 6, name: 'ציר שמטעה', math: '48 − 40 = 8' },
      { step: 7, name: 'סכום האחוזים', math: '45% + 30% + 20% + 15%' }
    ],
    bonus: {
      label: 'מכונת האחוזים 📊',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל שכיחות וסך הכול, ומצא את השכיחות היחסית באחוזים.',
      setup: function (box, ctx) {
        var q = null, guess = 50;
        var WORDS = ['כדורגל', 'כדורסל', 'שחייה', 'ריקוד', 'שחמט', 'ציור'];
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          var total = [20, 25, 40, 50][rnd(0, 3)];
          var f;
          do { f = rnd(2, total - 2); } while ((f * 100) % total !== 0 || f * 100 / total === 50);
          q = { total: total, f: f, ans: f * 100 / total, w: WORDS[rnd(0, WORDS.length - 1)] };
          guess = 50;
        }
        box.innerHTML = '<div class="bTitle">מכונת האחוזים</div><div class="bSub" data-sub></div>'
          + '<div class="bChip" data-chip dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr" style="gap:5px;padding:6px 6px">'
          + '<button type="button" data-d="-10" aria-label="הקטן ב־10 אחוזים">\u221210</button>'
          + '<button type="button" data-d="-1" aria-label="הקטן באחוז אחד">\u22121</button>'
          + '<bdi class="var math" dir="ltr" data-g style="min-width:56px" aria-live="polite"></bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל באחוז אחד">+1</button>'
          + '<button type="button" data-d="10" aria-label="הגדל ב־10 אחוזים">+10</button></div></div>'
          + '<div class="bForms" data-forms dir="ltr" hidden></div><div class="bOk" data-ok role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">🎲 תרגיל חדש</button>';
        var sub = box.querySelector('[data-sub]');
        var chip = box.querySelector('[data-chip]');
        var gEl = box.querySelector('[data-g]');
        var ok = box.querySelector('[data-ok]');
        var forms = box.querySelector('[data-forms]');
        function show() {
          sub.innerHTML = 'בסקר השתתפו ' + bdi(q.total) + ' תלמידים, ו־' + bdi(q.f) + ' מהם בחרו ' + q.w + '. מהי השכיחות היחסית שלהם באחוזים?';
          chip.textContent = q.f + ' \u00F7 ' + q.total + ' = ?';
          gEl.textContent = guess + '%';
          ok.hidden = true;
          forms.hidden = true;
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () {
            guess = clamp(guess + Number(b.getAttribute('data-d')), 0, 100);
            ctx.sfx('click');
            gEl.textContent = guess + '%';
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          ok.hidden = false;
          if (guess === q.ans) {
            ctx.sfx('correct');
            ok.style.color = PAL.good;
            ok.textContent = 'נכון! חילקת את השכיחות בסך הכול והכפלת ב־100%.';
            forms.hidden = false;
            forms.textContent = q.f + ' \u00F7 ' + q.total + ' = ' + (q.f / q.total) + ' = ' + q.ans + '%';
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            ok.textContent = guess === q.f ? 'נסה שוב: השכיחות עצמה אינה האחוז. חלק בסך הכול והכפל ב־100%.' : 'נסה שוב: חלק את השכיחות בסך הכול, והכפל ב־100%.';
            forms.hidden = true;
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); show(); });
        roll();
        show();
      }
    }
  });
}());
