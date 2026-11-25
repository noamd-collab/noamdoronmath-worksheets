/**
 * מרחב התוצאות — an engine game.
 *
 * The idea: a probability is a part of a whole. Count the outcomes that fit
 * the event, count all the equally likely outcomes, and compare them.
 * Scene 1: a bag of coloured balls (the learner adds red balls).
 * Scene 2: the 6 x 6 grid of two dice (the learner marks the event "sum 7").
 * Scene 3: a spinner game, adjusted until both players have the same chance.
 * Nothing the learner has to do depends on a random result.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402;
  var RED = '#c62828', BLUE = '#1d4ed8', GREEN = '#2e7d32', ORANGE = '#b45309', GREY = '#cbd5e1', MUTED = '#475569', BAD = '#b91c1c';
  var KINDS = {
    red: { color: RED, letter: 'א' },
    blue: { color: BLUE, letter: 'כ' },
    green: { color: GREEN, letter: 'י' }
  };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mathText(x, y, label, size, colour, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 14)
      + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function hebText(x, y, label, size, colour, anchor, id, weight) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 14)
      + '" font-weight="' + (weight || 700) + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  /** A fraction drawn with a horizontal bar: numerator, a line, denominator. */
  function fracSvg(cx, yBar, numId, denId, n, d, size, colour) {
    return mathText(cx, yBar - 6, String(n), size, colour, 'middle', numId)
      + '<line x1="' + (cx - 26) + '" y1="' + yBar + '" x2="' + (cx + 26) + '" y2="' + yBar + '" stroke="' + colour + '" stroke-width="2.5" stroke-linecap="round"/>'
      + mathText(cx, yBar + size + 2, String(d), size, colour, 'middle', denId);
  }
  function ballSvg(cx, cy, rad, kind) {
    var k = KINDS[kind];
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="' + k.color + '" stroke="#fff" stroke-width="2"/>'
      + hebText(cx, cy + 4.5, k.letter, 13, '#fff', 'middle');
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function stepperHtml(prefix, label, aria) {
    return '<div class="stepper" dir="ltr" style="align-self:stretch"><div class="unit" dir="ltr">'
      + '<b style="font-size:13px">' + label + '</b>'
      + '<button type="button" id="' + prefix + 'Minus" aria-label="הפחת ' + aria + '">−</button>'
      + '<bdi class="var math" dir="ltr" data-value aria-live="polite" style="min-width:34px">0</bdi>'
      + '<button type="button" id="' + prefix + 'Plus" aria-label="הוסף ' + aria + '">+</button></div></div>';
  }
  function handleHtml(id, label, lo, hi, val) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + lo + '" aria-valuemax="' + hi
      + '" aria-valuenow="' + val + '" style="cursor:grab">'
      + '<rect x="-30" y="-30" width="60" height="60" rx="15" fill="transparent"/>'
      + '<circle r="13" fill="' + PAL.main + '" stroke="#fff" stroke-width="3"/></g>';
  }
  /** Drag, keyboard and buttons all end in the same setter. */
  function hookSlider(ctx, handle, cfg) {
    handle.addEventListener('keydown', function (ev) {
      var v = cfg.get();
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') v -= 1;
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') v += 1;
      else if (ev.key === 'Home') v = cfg.lo;
      else if (ev.key === 'End') v = cfg.hi;
      else return;
      ev.preventDefault();
      ctx.sfx('tick');
      cfg.set(v, true);
    });
    ctx.drag(handle, {
      move: function (x) { cfg.set(Math.round((x - cfg.x0) / cfg.step), false); },
      end: function () { cfg.set(cfg.get(), true); }
    });
  }
  function trackSvg(y, x0, step, lo, hi, tickEvery) {
    var out = '<line x1="' + x0 + '" y1="' + y + '" x2="' + (x0 + (hi - lo) * step) + '" y2="' + y + '" stroke="' + PAL.line + '" stroke-width="6" stroke-linecap="round"/>';
    for (var i = lo; i <= hi; i++) {
      if ((i - lo) % tickEvery === 0) {
        out += '<line x1="' + (x0 + (i - lo) * step) + '" y1="' + (y + 12) + '" x2="' + (x0 + (i - lo) * step) + '" y2="' + (y + 20) + '" stroke="' + MUTED + '" stroke-width="1.5"/>'
          + mathText(x0 + (i - lo) * step, y + 38, String(i), 12, MUTED);
      }
    }
    return out;
  }

  /* ---------------- scene 1: the bag of balls ---------------- */
  var BAG_OTHERS = 6;
  function bagScene(ctx) {
    var red = 2, done = false;
    var X0 = 51, STEP = 25, TRACK_Y = 286;
    ctx.draw('<rect x="36" y="12" width="330" height="130" rx="22" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>'
      + '<g id="balls"></g>'
      // RTL page: 'start' keeps the right edge at x so the label runs left, inside the frame.
      + hebText(372, 190, 'ההסתברות לאדום', 15, PAL.ink, 'start')
      + mathText(246, 198, '=', 24, PAL.ink)
      + '<g id="fr">' + fracSvg(200, 190, 'fn', 'fd', 0, 0, 20, PAL.dark) + '</g>'
      + '<rect x="36" y="222" width="330" height="22" rx="8" fill="' + GREY + '"/>'
      + '<rect id="redBar" x="36" y="222" width="10" height="22" rx="8" fill="' + RED + '"/>'
      + trackSvg(TRACK_Y, X0, STEP, 0, 12, 2)
      + handleHtml('hdl', 'מספר הכדורים האדומים בשק. החיצים משנים כדור אחד בכל לחיצה', 0, 12, red));
    var handle = ctx.el('hdl');
    var box = ctx.extra(stepperHtml('red', 'כדורים אדומים', 'כדור אדום'));
    ctx.register('steps', box);
    var valueEl = box.querySelector('[data-value]');
    function paintBalls() {
      var list = [], i;
      for (i = 0; i < red; i++) list.push('red');
      for (i = 0; i < 4; i++) list.push('blue');
      for (i = 0; i < 2; i++) list.push('green');
      var rows = Math.ceil(list.length / 9), html = '';
      list.forEach(function (kind, idx) {
        html += ballSvg(65 + 34 * (idx % 9), rows === 1 ? 82 : 60 + 44 * Math.floor(idx / 9), 14, kind);
      });
      ctx.el('balls').innerHTML = html;
    }
    function update(acted) {
      var tot = red + BAG_OTHERS;
      paintBalls();
      handle.setAttribute('transform', 'translate(' + (X0 + red * STEP) + ' ' + TRACK_Y + ')');
      handle.setAttribute('aria-valuenow', String(red));
      handle.setAttribute('aria-valuetext', red + ' אדומים מתוך ' + tot + ' כדורים');
      ctx.el('fn').textContent = String(red);
      ctx.el('fd').textContent = String(tot);
      ctx.el('redBar').setAttribute('width', String(Math.max(0, 330 * red / tot)));
      ctx.el('redBar').setAttribute('rx', red === 0 ? '0' : '8');
      valueEl.textContent = String(red);
      ctx.caption('בשק: ' + m(String(red)) + ' אדומים · ' + m('4') + ' כחולים · ' + m('2') + ' ירוקים · ' + m(String(tot)) + ' כדורים');
      if (red === 6) {
        ctx.note('בדיוק! ' + m('6') + ' אדומים מתוך ' + m('12') + ' כדורים: חצי. שים לב שהמכנה הוא כל הכדורים, כולל האדומים.', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (red === 0) {
        ctx.note('בלי אדומים אי אפשר להוציא אדום: ' + m('0') + ' מתוך ' + m('6') + '. זה אירוע בלתי אפשרי, והסתברותו ' + m('0') + '.');
      } else if (red === 3) {
        ctx.note(m('3') + ' אדומים מתוך ' + m('9') + ' כדורים: שליש. כשמוסיפים אדום, גם המכנה גדל.');
      } else if (red < 6) {
        ctx.note(m(String(red)) + ' אדומים מתוך ' + m(String(tot)) + ' כדורים. עוד לא חצי: בחצי, מספר האדומים שווה למספר שאר הכדורים.');
      } else {
        ctx.note(m(String(red)) + ' אדומים מתוך ' + m(String(tot)) + ' כדורים. זה כבר יותר מחצי. הוצא כמה אדומים.');
      }
    }
    function setRed(v, acted) {
      red = clamp(v, 0, 12);
      update(acted);
    }
    box.querySelector('#redMinus').addEventListener('click', function () { ctx.sfx('tick'); setRed(red - 1, true); });
    box.querySelector('#redPlus').addEventListener('click', function () { ctx.sfx('tick'); setRed(red + 1, true); });
    hookSlider(ctx, handle, { lo: 0, hi: 12, x0: X0, step: STEP, get: function () { return red; }, set: setRed });
    update(false);
  }

  /* ---------------- scene 2: two dice grid ---------------- */
  var GX = 84, GY = 60, CELL = 50;
  function diceScene(ctx) {
    var marked = {}, curR = 0, curC = 0, paintMode = true, done = false;
    var html = hebText(234, 20, 'הקובייה הראשונה', 14, PAL.ink, 'middle');
    var r, c;
    for (c = 0; c < 6; c++) html += mathText(GX + CELL * c + CELL / 2, 46, String(c + 1), 15, MUTED);
    for (r = 0; r < 6; r++) {
      html += mathText(GX - 14, GY + CELL * r + CELL / 2 + 5, String(r + 1), 15, MUTED);
      for (c = 0; c < 6; c++) {
        html += '<rect id="cell' + r + '_' + c + '" x="' + (GX + CELL * c + 2) + '" y="' + (GY + CELL * r + 2) + '" width="' + (CELL - 4)
          + '" height="' + (CELL - 4) + '" rx="8" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>'
          + mathText(GX + CELL * c + CELL / 2, GY + CELL * r + CELL / 2 + 6, String(r + c + 2), 17, PAL.ink, 'middle', 'sum' + r + '_' + c);
      }
    }
    html += hebText(30, 36, 'השנייה', 12, MUTED, 'middle')
      + '<rect id="cursor" x="' + GX + '" y="' + GY + '" width="' + CELL + '" height="' + CELL + '" rx="10" fill="none" stroke="' + PAL.dark + '" stroke-width="4" pointer-events="none"/>'
      + '<rect id="grid" tabindex="0" role="application" aria-label="לוח שתי הקוביות: שישה על שישה. החיצים מזיזים את הסמן, אנטר או רווח מסמנים או מבטלים תא" x="' + GX + '" y="' + GY + '" width="' + (CELL * 6)
      + '" height="' + (CELL * 6) + '" rx="10" fill="transparent" style="cursor:grab"/>';
    ctx.draw(html);
    var grid = ctx.el('grid');
    var arrows = [['Left', '←', 'שמאלה'], ['Up', '↑', 'למעלה'], ['Down', '↓', 'למטה'], ['Right', '→', 'ימינה']];
    var box = ctx.extra('<div class="sceneStrip"><b>ההסתברות לפי הסימון</b>'
      + '<span dir="ltr" style="display:inline-flex;flex-direction:column;align-items:center;font-family:Secular One,sans-serif;font-size:19px;line-height:1.25;min-width:38px">'
      + '<span data-n>0</span><span style="border-top:2px solid currentColor;width:100%;text-align:center">36</span></span></div>'
      + '<div dir="ltr" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px">'
      + arrows.map(function (a) {
        return '<button type="button" id="mv' + a[0] + '" data-mv="' + a[0] + '" aria-label="הזז את הסמן ' + a[2] + '" style="min-height:44px;min-width:44px;width:56px;border:2px solid '
          + PAL.main + ';border-radius:12px;background:' + PAL.soft + ';color:' + PAL.dark + ';font-size:23px">' + a[1] + '</button>';
      }).join('') + '</div>'
      + '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:8px">'
      + '<button type="button" id="mark" style="min-height:44px;min-width:44px;padding:0 16px;border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.main + ';color:#fff;font-weight:800;font-size:15px">סמן או בטל תא</button>'
      + '<button type="button" id="clear" style="min-height:44px;min-width:44px;padding:0 16px;border:2px solid ' + PAL.line + ';border-radius:12px;background:#fff;color:' + PAL.ink + ';font-weight:800;font-size:15px">נקה הכול</button></div>');
    ctx.register('arrows', box);
    function key(rr, cc) { return rr + '_' + cc; }
    function analyse() {
      var wrong = 0, missing = 0, count = 0;
      for (var a = 0; a < 6; a++) {
        for (var b = 0; b < 6; b++) {
          var on = !!marked[key(a, b)], fits = a + b + 2 === 7;
          if (on) count++;
          if (on && !fits) wrong++;
          if (!on && fits) missing++;
        }
      }
      return { wrong: wrong, missing: missing, count: count };
    }
    function update(acted) {
      for (var a = 0; a < 6; a++) {
        for (var b = 0; b < 6; b++) {
          var on = !!marked[key(a, b)], cell = ctx.el('cell' + a + '_' + b), txt = ctx.el('sum' + a + '_' + b);
          cell.setAttribute('fill', on ? PAL.main : '#fff');
          txt.setAttribute('fill', on ? '#fff' : PAL.ink);
        }
      }
      ctx.el('cursor').setAttribute('x', String(GX + CELL * curC));
      ctx.el('cursor').setAttribute('y', String(GY + CELL * curR));
      grid.setAttribute('aria-label', 'לוח שתי הקוביות. הסמן בקובייה ראשונה ' + (curC + 1) + ' ובשנייה ' + (curR + 1) + ', סכום ' + (curR + curC + 2)
        + (marked[key(curR, curC)] ? ', מסומן' : ', לא מסומן') + '. אנטר או רווח מסמנים או מבטלים');
      var s = analyse();
      box.querySelector('[data-n]').textContent = String(s.count);
      ctx.caption('סימנת ' + m(String(s.count)) + ' תאים מתוך ' + m('36'));
      if (s.count === 0) {
        ctx.note('כל תא הוא צירוף אחד של שתי הקוביות, ולכל התאים אותו סיכוי. סמן את התאים שבהם הסכום הוא ' + m('7') + ': בגרירה, בחיצים ובאנטר או בכפתורים.');
      } else if (s.wrong === 0 && s.missing === 0) {
        ctx.note('נכון: ' + m('6') + ' תאים מתוך ' + m('36') + ', כלומר שישית. הסכום ' + m('7') + ' מקבל הכי הרבה תאים, ולכן אינו שווה בסיכוי לסכום ' + m('2') + ', שמקבל תא אחד.', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (s.wrong === 0 && s.count === 1) {
        ctx.note('תא אחד הוא רק צירוף אחד. הסכום ' + m('7') + ' אינו "אחד מתוך ' + m('11') + ' סכומים": סופרים צירופים של שתי הקוביות. חסרים עוד ' + m(String(s.missing)) + ' תאים.');
      } else if (s.wrong > 0) {
        ctx.note('יש ' + m(String(s.wrong)) + ' תאים שהסכום שלהם אינו ' + m('7') + '. לחץ עליהם שוב כדי לבטל. התאים הנכונים יושבים על אלכסון.');
      } else {
        ctx.note('כל התאים שסימנת נכונים. חסרים עוד ' + m(String(s.missing)) + ' תאים שסכומם ' + m('7') + '. חפש אותם לאורך האלכסון.');
      }
    }
    function toggleAt(rr, cc, acted) {
      var k = key(rr, cc);
      if (marked[k]) delete marked[k]; else marked[k] = true;
      curR = rr; curC = cc;
      update(acted);
    }
    function moveCursor(name) {
      if (name === 'Left') curC = clamp(curC - 1, 0, 5);
      else if (name === 'Right') curC = clamp(curC + 1, 0, 5);
      else if (name === 'Up') curR = clamp(curR - 1, 0, 5);
      else if (name === 'Down') curR = clamp(curR + 1, 0, 5);
      ctx.sfx('tick');
      update(false);
    }
    box.querySelectorAll('[data-mv]').forEach(function (b) {
      b.addEventListener('click', function () { moveCursor(b.getAttribute('data-mv')); });
    });
    box.querySelector('#mark').addEventListener('click', function () { ctx.sfx('click'); toggleAt(curR, curC, true); });
    box.querySelector('#clear').addEventListener('click', function () { ctx.sfx('click'); marked = {}; update(false); });
    grid.addEventListener('keydown', function (ev) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(ev.key) >= 0) {
        ev.preventDefault(); moveCursor(ev.key.slice(5));
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); ctx.sfx('click'); toggleAt(curR, curC, true);
      }
    });
    function cellAt(x, y) {
      var cc = Math.floor((x - GX) / CELL), rr = Math.floor((y - GY) / CELL);
      if (cc < 0 || cc > 5 || rr < 0 || rr > 5) return null;
      return { r: rr, c: cc };
    }
    var lastKey = '';
    ctx.drag(grid, {
      start: function (x, y) {
        var p = cellAt(x, y);
        if (!p) return;
        paintMode = !marked[key(p.r, p.c)];
        lastKey = '';
        paintCell(p);
      },
      move: function (x, y) {
        var p = cellAt(x, y);
        if (p) paintCell(p);
      },
      end: function () { update(true); }
    });
    function paintCell(p) {
      var k = key(p.r, p.c);
      if (k === lastKey) return;
      lastKey = k;
      if (paintMode) marked[k] = true; else delete marked[k];
      curR = p.r; curC = p.c;
      update(false);
    }
    update(false);
  }

  /* ---------------- scene 3: a fair spinner game ---------------- */
  var RON = 4;
  function sectorPath(i, cx, cy, rad) {
    var a1 = (-90 + 30 * i) * Math.PI / 180, a2 = (-90 + 30 * (i + 1)) * Math.PI / 180;
    function pt(a) { return (cx + rad * Math.cos(a)).toFixed(1) + ' ' + (cy + rad * Math.sin(a)).toFixed(1); }
    return 'M' + cx + ' ' + cy + ' L' + pt(a1) + ' A' + rad + ' ' + rad + ' 0 0 1 ' + pt(a2) + ' Z';
  }
  function fairScene(ctx) {
    var dan = 1, done = false;
    var X0 = 51, STEP = 37.5, TRACK_Y = 338, CX = 201, CY = 114, RAD = 94;
    var html = '', i;
    for (i = 0; i < 12; i++) {
      var mid = (-90 + 30 * i + 15) * Math.PI / 180;
      html += '<path id="sec' + i + '" d="' + sectorPath(i, CX, CY, RAD) + '" fill="#fff" stroke="' + PAL.ink + '" stroke-width="1.5"/>'
        + hebText((CX + 64 * Math.cos(mid)).toFixed(1), (CY + 64 * Math.sin(mid) + 5).toFixed(1), '', 15, '#fff', 'middle', 'let' + i);
    }
    html += '<path d="M189 6 L213 6 L201 28 Z" fill="' + PAL.ink + '" stroke="#fff" stroke-width="1.5"/>'
      + hebText(201, 232, '', 12, MUTED, 'middle', 'legend', 600)
      + hebText(292, 252, 'דן', 15, BLUE, 'middle') + hebText(110, 252, 'רון', 15, ORANGE, 'middle')
      + fracSvg(292, 284, 'dn', 'dd', 0, 12, 18, BLUE) + fracSvg(110, 284, 'rn', 'rd', RON, 12, 18, ORANGE)
      + mathText(201, 282, '=', 28, PAL.ink, 'middle', 'eq')
      + trackSvg(TRACK_Y, X0, STEP, 0, 8, 1)
      + handleHtml('hdl', 'מספר הסקטורים שבהם דן מנצח. החיצים משנים סקטור אחד בכל לחיצה', 0, 8, dan);
    ctx.draw(html);
    var handle = ctx.el('hdl');
    var box = ctx.extra(stepperHtml('dan', 'סקטורים של דן', 'סקטור של דן'));
    ctx.register('steps', box);
    var valueEl = box.querySelector('[data-value]');
    function update(acted) {
      var k, draws = 12 - RON - dan;
      for (k = 0; k < 12; k++) {
        var isRon = k < RON, isDan = !isRon && k < RON + dan;
        ctx.el('sec' + k).setAttribute('fill', isRon ? ORANGE : isDan ? BLUE : '#fff');
        ctx.el('let' + k).textContent = isRon ? 'ר' : isDan ? 'ד' : '';
      }
      handle.setAttribute('transform', 'translate(' + (X0 + dan * STEP) + ' ' + TRACK_Y + ')');
      handle.setAttribute('aria-valuenow', String(dan));
      handle.setAttribute('aria-valuetext', 'לדן ' + dan + ' סקטורים מתוך 12, לרון ' + RON);
      ctx.el('dn').textContent = String(dan);
      ctx.el('eq').textContent = dan === RON ? '=' : '≠';
      ctx.el('eq').setAttribute('fill', dan === RON ? GREEN : BAD);
      ctx.el('legend').textContent = 'לבן = תיקו (' + draws + ' סקטורים), מסובבים שוב';
      valueEl.textContent = String(dan);
      ctx.caption('דן: ' + m(String(dan)) + ' מתוך ' + m('12') + ' · רון: ' + m(String(RON)) + ' מתוך ' + m('12'));
      if (dan === RON) {
        ctx.note('הוגן! לשניהם ' + m('4') + ' מתוך ' + m('12') + ', כלומר שליש. משחק הוגן הוא משחק שבו ההסתברויות שוות. תיקו לא משנה זאת, כי הוא פוגע בשניהם באותה מידה.', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (dan === 0) {
        ctx.note('לדן אין סיכוי לנצח: ' + m('0') + ' מתוך ' + m('12') + '. זה בטוח לא הוגן.');
      } else if (dan === 1) {
        ctx.note('לשניהם יש סיכוי לנצח, אבל לא סיכוי שווה: ' + m('1') + ' מתוך ' + m('12') + ' מול ' + m('4') + ' מתוך ' + m('12') + '. "אפשר לנצח" אינו אומר "הוגן".');
      } else if (dan === 8) {
        ctx.note('אין תיקו בכלל, אבל לדן ' + m('8') + ' מתוך ' + m('12') + ' ולרון ' + m('4') + ' מתוך ' + m('12') + '. הסיכוי של דן כפול.');
      } else if (dan > RON) {
        ctx.note('לדן ' + m(String(dan)) + ' מתוך ' + m('12') + ' ולרון ' + m('4') + ' מתוך ' + m('12') + '. הסיכוי של דן גדול יותר. הפחת סקטורים.');
      } else {
        ctx.note('לדן ' + m(String(dan)) + ' מתוך ' + m('12') + ' ולרון ' + m('4') + ' מתוך ' + m('12') + '. הסיכוי של רון גדול יותר. הוסף סקטורים לדן.');
      }
    }
    function setDan(v, acted) {
      dan = clamp(v, 0, 8);
      update(acted);
    }
    box.querySelector('#danMinus').addEventListener('click', function () { ctx.sfx('tick'); setDan(dan - 1, true); });
    box.querySelector('#danPlus').addEventListener('click', function () { ctx.sfx('tick'); setDan(dan + 1, true); });
    hookSlider(ctx, handle, { lo: 0, hi: 8, x0: X0, step: STEP, get: function () { return dan; }, set: setDan });
    update(false);
  }

  /* ---------------- quiz picture ---------------- */
  function quizBag(ctx) {
    var list = ['red', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue'];
    var html = '<rect x="46" y="10" width="310" height="110" rx="22" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>';
    list.forEach(function (kind, idx) { html += ballSvg(86 + 46 * (idx % 6) + (idx > 5 ? 23 : 0), idx > 5 ? 82 : 42, 16, kind); });
    ctx.draw(html);
    ctx.caption(m('3') + ' אדומים ו־' + m('5') + ' כחולים');
  }

  var steps = [
    {
      mode: 'intro', tA: 'מרחב התוצאות', sub: 'בונים את כל התוצאות האפשריות, ואז סופרים את אלה שמתאימות לאירוע.',
      tip: 'שלום, אני אליהו. כדי לדעת מה הסיכוי, קודם צריך לדעת מה כל האפשרויות.',
      emoji: '🎲', eq: m('0 ≤ P ≤ 1'),
      note: 'מרחב התוצאות הוא כל מה שיכול לקרות. אירוע הוא חלק ממנו. ההסתברות היא החלק הזה מתוך השלם.',
      cue: 'מוכן לספור תוצאות?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'שק הכדורים', sub: 'בשק ' + m('4') + ' כחולים ו־' + m('2') + ' ירוקים. הוסף אדומים עד שההסתברות להוציא אדום תהיה חצי. בגרירה, בכפתורים או בחיצים.',
      tip: 'כל כדור הוא תוצאה אחת. ההסתברות לאדום היא האדומים מתוך כל הכדורים בשק.',
      aspect: [W, 336], alt: 'שק עם כדורים אדומים, ארבעה כחולים ושני ירוקים; שבר שמראה את האדומים מתוך כל הכדורים, פס יחס וידית שמוסיפה כדורים אדומים',
      cue: 'הוסף אדומים עד שההסתברות לאדום היא חצי', cueDone: 'ההסתברות היא חצי. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'steps', text: 'לחץ על הפלוס כדי להוסיף כדור אדום, ועקוב אחרי השבר.' }, setup: bagScene
    },
    {
      mode: 'quiz', tA: 'מה ההסתברות לאדום?', sub: 'מוציאים כדור אחד באקראי מהשק.',
      tip: 'ספור את כל הכדורים בשק, לא רק את הכחולים.', btn: 'המשך ←',
      aspect: [W, 130], alt: 'שק עם שלושה כדורים אדומים וחמישה כדורים כחולים', setup: quizBag,
      win: 'נכון. האדומים הם חלק מכל הכדורים.', wrongSay: 'ההסתברות משווה את האדומים לכל הכדורים בשק.',
      opts: [
        { t: m('3') + ' מתוך ' + m('5'), f: 'השווית אדומים לכחולים. ההסתברות משווה לכל הכדורים, כולל האדומים, כלומר ל־' + m('8') + '.' },
        { t: 'חצי, כי יש שני צבעים', f: 'שני צבעים לא אומר סיכוי שווה. הצבעים לא מופיעים באותה כמות, ולכן אין כאן חצי.' },
        { t: m('3') + ' מתוך ' + m('8'), c: true, f: m('3') + ' כדורים אדומים מתוך ' + m('8') + ' כדורים בסך הכול: ' + m('3') + ' מתוך ' + m('8') + '.' },
        { t: m('5') + ' מתוך ' + m('8'), f: 'זו ההסתברות לכחול. האירוע שביקשו הוא אדום, ולכן המונה הוא ' + m('3') + '.' }
      ],
      hints: ['ספור כמה כדורים יש בשק בסך הכול.', 'המכנה הוא כל הכדורים. המונה הוא הכדורים שמתאימים לאירוע.', 'שלושה אדומים, ובשק שמונה כדורים.']
    },
    {
      mode: 'scene', tA: 'שתי קוביות', sub: 'הטלת שתי קוביות. סמן את כל התאים שבהם הסכום הוא ' + m('7') + '. בגרירה, בחיצים ובאנטר או בכפתורים.',
      tip: 'כל תא בלוח הוא תוצאה אחת של שתי הקוביות, ולכל התאים אותו סיכוי.',
      aspect: [W, 372], alt: 'לוח של שש שורות ושש עמודות: כל תא הוא זוג תוצאות של שתי קוביות וכתוב בו הסכום; אפשר לסמן תאים',
      cue: 'סמן את כל התאים שסכומם ' + m('7'), cueDone: 'סימנת את כל התוצאות הנכונות. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'arrows', text: 'הזז את הסמן בחצים וסמן תא באנטר או בכפתור. חפש סכום 7 לאורך אלכסון.' }, setup: diceScene
    },
    {
      mode: 'quiz', tA: 'מה ההסתברות לסכום 2?', sub: 'מטילים שתי קוביות הוגנות. הסכומים האפשריים הם ' + m('2') + ' עד ' + m('12') + ', כלומר ' + m('11') + ' סכומים.',
      tip: 'חשוב על הלוח שהרגע מילאת. כמה תאים יש לסכום 2, וכמה תאים יש בסך הכול?', btn: 'המשך ←',
      win: 'נכון. סכום 2 מתקבל רק כש־1 יוצא בשתי הקוביות.', wrongSay: 'ספור צירופים של שתי הקוביות, לא סכומים.',
      opts: [
        { t: m('1') + ' מתוך ' + m('36'), c: true, f: 'רק הצירוף ' + m('1') + ' ו־' + m('1') + ' נותן סכום ' + m('2') + ', מתוך ' + m('36') + ' צירופים שווי סיכוי.' },
        { t: m('1') + ' מתוך ' + m('11'), f: 'ספרת סכומים, אבל הסכומים אינם שווי סיכוי. מרחב התוצאות הוא ' + m('36') + ' הצירופים, לא ' + m('11') + ' הסכומים.' },
        { t: m('2') + ' מתוך ' + m('36'), f: 'ספרת את הסכום כשתי תוצאות. אבל ' + m('1') + ' ו־' + m('1') + ' הוא צירוף אחד בלבד, תא אחד בלוח.' },
        { t: m('1') + ' מתוך ' + m('6'), f: 'זה הסיכוי לתוצאה מסוימת בקובייה אחת. כאן צריך שתי קוביות, ולכן ' + m('36') + ' תוצאות.' }
      ],
      hints: ['חשוב על לוח הקוביות: כמה תאים יש בו בסך הכול?', 'במה ' + m('2') + ' אפשר לקבל כסכום של שתי קוביות?', 'רק ' + m('1') + ' ו־' + m('1') + '. תא אחד מתוך כל התאים בלוח.']
    },
    {
      mode: 'scene', tA: 'משחק הוגן', sub: 'רון מנצח ב־' + m('4') + ' סקטורים. קבע כמה סקטורים לדן, כך שהמשחק יהיה הוגן. בגרירה, בכפתורים או בחיצים.',
      tip: 'הוגן אומר שלשני השחקנים אותה הסתברות לנצח. השוו את השברים של דן ושל רון.',
      aspect: [W, 388], alt: 'גלגל מסתובב עם שנים עשר סקטורים שווים: ארבעה של רון, כמה של דן והשאר תיקו; שני שברים ווידית שקובעת כמה סקטורים לדן',
      cue: 'הגדר את הסקטורים של דן כך שההסתברויות שוות', cueDone: 'המשחק הוגן. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'steps', text: 'לחץ על הפלוס או על המינוס והשווה בין שני השברים.' }, setup: fairScene
    },
    {
      mode: 'quiz', tA: 'הטלת מטבע ברצף', sub: 'מטבע הוגן הוטל חמש פעמים, וכל פעם יצא עץ.',
      tip: 'מה "זוכר" המטבע מההטלות הקודמות?', btn: 'המשך ←',
      win: 'נכון. למטבע אין זיכרון.', wrongSay: 'כל הטלה היא ניסוי חדש. מה ההסתברות לעץ במטבע הוגן?',
      opts: [
        { t: 'גבוהה מחצי, כי יש רצף של עץ', f: 'רצף לא משנה את המטבע. ההטלות בלתי תלויות, ולכן ההסתברות נשארת חצי.' },
        { t: 'נמוכה מחצי, כי הגיע תורו של פלי', f: 'זו הטעות של המהמר: מחכים ל"איזון". המטבע לא זוכר, וההסתברות לעץ עדיין חצי.' },
        { t: m('1') + ' מתוך ' + m('64'), f: 'זו ההסתברות לשש הטלות עץ ברצף, לפני שהטילו. בהטלה השישית כבר ידוע מה קרה.' },
        { t: 'חצי, כי למטבע אין זיכרון', c: true, f: 'ההטלה השישית היא ניסוי חדש עם שתי תוצאות שוות סיכוי: חצי.' }
      ],
      hints: ['שאל את עצמך אם ההטלות הקודמות משנות את המטבע.', 'במטבע הוגן יש שתי תוצאות שוות סיכוי בכל הטלה.', 'ההסתברות לעץ היא חצי בכל הטלה, בלי קשר לעבר.']
    },
    {
      mode: 'quiz', tA: 'אירוע בלתי אפשרי', sub: 'מטילים קובייה רגילה פעם אחת, והפאות הן ' + m('1') + ' עד ' + m('6') + '. איזה אירוע בלתי אפשרי, כלומר הסתברותו ' + m('0') + '?',
      tip: 'בלתי אפשרי פירושו שאין שום תוצאה שמתאימה לאירוע, לא שהסיכוי קטן.', btn: 'לסיכום ←',
      win: 'נכון. אין פאה ' + m('7'), wrongSay: 'חפש אירוע שאין בו אף תוצאה אפשרית.',
      opts: [
        { t: 'יוצא ' + m('6'), f: 'הסיכוי הוא ' + m('1') + ' מתוך ' + m('6') + '. סיכוי קטן עדיין אפשרי, והסתברותו גדולה מ־' + m('0') + '.' },
        { t: 'יוצא ' + m('7'), c: true, f: 'אין פאה ' + m('7') + ', ולכן ' + m('0') + ' תוצאות מתאימות: הסתברות ' + m('0') + '.' },
        { t: 'יוצא מספר קטן מ־' + m('7'), f: 'כל ' + m('6') + ' התוצאות מתאימות, לכן זה אירוע בטוח: הסתברותו ' + m('1') + ', לא ' + m('0') + '.' },
        { t: 'יוצא מספר שאינו ' + m('3'), f: 'ל־' + m('5') + ' תוצאות מתוך ' + m('6') + ' זה מתאים. סביר מאוד, אבל לא בטוח וגם לא בלתי אפשרי.' }
      ],
      hints: ['בדוק אילו מספרים יש על קובייה רגילה.', 'אירוע בלתי אפשרי לא מכיל אף תוצאה מהמרחב.', 'חפש מספר שלא נמצא בין ' + m('1') + ' ל־' + m('6') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את מרחב התוצאות', sub: 'עכשיו אתה בונה מרחב תוצאות, סופר ומשווה.',
      tip: 'כל הכבוד. כל בעיית הסתברות מתחילה בספירת כל התוצאות שוות הסיכוי.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:',
      formula: 'הסתברות = מספר התוצאות המתאימות ÷ מספר כל התוצאות שוות הסיכוי'
    }
  ];

  window.NoamGame.boot({
    slug: 'merchav-hatotsaot',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'הסתברות כחלק מהשלם', math: 'P = 3 ÷ 8' },
      { step: 4, name: 'סכומים של שתי קוביות', math: '2, 3, …, 12' },
      { step: 6, name: 'אין זיכרון למטבע', math: 'P = 0.5' },
      { step: 7, name: 'בלתי אפשרי ובטוח', math: '0 ≤ P ≤ 1' }
    ],
    bonus: {
      label: 'מכונת השקים 🎲', closeLabel: 'סגור את המכונה', hint: 'קבל שק חדש ומצא את ההסתברות לצבע שמבקשים.',
      setup: function (box, ctx) {
        var bag, want, gNum = 0, gDen = 1;
        var names = { red: 'אדום', blue: 'כחול', green: 'ירוק' };
        box.innerHTML = '<div class="bTitle">מכונת השקים</div><div class="bSub" data-q></div>'
          + '<svg data-bag viewBox="0 0 402 130" dir="ltr" role="img" aria-label="שק כדורים אקראי" style="width:100%;height:auto;display:block"></svg>'
          + stepperHtml('bn', 'מונה', 'מונה').replace(/id="bnMinus"/, 'data-bn="-1"').replace(/id="bnPlus"/, 'data-bn="1"')
          + stepperHtml('bd', 'מכנה', 'מכנה').replace(/id="bdMinus"/, 'data-bd="-1"').replace(/id="bdPlus"/, 'data-bd="1"')
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">שק חדש ↻</button>';
        var vals = box.querySelectorAll('[data-value]');
        function showGuess() { vals[0].textContent = String(gNum); vals[1].textContent = String(gDen); }
        function roll() {
          bag = { red: 1 + Math.floor(Math.random() * 5), blue: 1 + Math.floor(Math.random() * 5), green: Math.floor(Math.random() * 4) };
          var opts = ['red', 'blue'];
          if (bag.green > 0) opts.push('green');
          want = opts[Math.floor(Math.random() * opts.length)];
          var list = [];
          ['red', 'blue', 'green'].forEach(function (kind) { for (var i = 0; i < bag[kind]; i++) list.push(kind); });
          var svg = '<rect x="10" y="6" width="382" height="118" rx="22" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>';
          list.forEach(function (kind, idx) { svg += ballSvg(36 + 34 * (idx % 11), idx > 10 ? 86 : 46, 14, kind); });
          box.querySelector('[data-bag]').innerHTML = svg;
          box.querySelector('[data-q]').innerHTML = 'מוציאים כדור אחד. מה ההסתברות להוציא ' + names[want] + '? בחר מונה ומכנה.';
          gNum = 0; gDen = 1;
          showGuess();
          box.querySelector('[data-ok]').hidden = true;
          box.querySelector('[data-forms]').hidden = true;
        }
        box.querySelectorAll('[data-bn]').forEach(function (b) {
          b.addEventListener('click', function () { gNum = clamp(gNum + Number(b.getAttribute('data-bn')), 0, 20); ctx.sfx('click'); showGuess(); });
        });
        box.querySelectorAll('[data-bd]').forEach(function (b) {
          b.addEventListener('click', function () { gDen = clamp(gDen + Number(b.getAttribute('data-bd')), 1, 20); ctx.sfx('click'); showGuess(); });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var total = bag.red + bag.blue + bag.green, k = bag[want];
          var ok = gNum * total === k * gDen;
          var okEl = box.querySelector('[data-ok]'), forms = box.querySelector('[data-forms]');
          okEl.hidden = false;
          okEl.textContent = ok ? 'נכון! קראת את החלק מתוך השלם.' : 'נסה שוב: המונה הוא הכדורים בצבע המבוקש, והמכנה הוא כל הכדורים בשק.';
          okEl.style.color = ok ? PAL.good : BAD;
          ctx.sfx(ok ? 'correct' : 'error');
          if (ok) {
            forms.hidden = false;
            forms.innerHTML = bdi(k + ' ÷ ' + total);
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); });
        roll();
      }
    }
  });
}());
