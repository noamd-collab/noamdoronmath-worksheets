/** מכונת הפונקציות: לכל קלט בדיוק פלט אחד; f(x) הוא שם הפלט, וחזרה מפלט לקלט היא ביטול הכלל. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var MUTED = '#475569', BAD = '#b91c1c';
  var TX0 = 36, TX1 = 366;

  function num(value) { return value < 0 ? '\u2212' + Math.abs(value) : String(value); }
  function paren(value) { return value < 0 ? '(' + num(value) + ')' : String(value); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function mathText(x, y, label, size, colour, anchor, id, extra) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 14)
      + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '"' + (extra || '') + '>' + label + '</text>';
  }
  function hebText(x, y, label, size, colour, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif"'
      + ' font-size="' + (size || 13) + '" font-weight="700" fill="' + (colour || MUTED) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function rule(x) { return 2 * x + 1; }
  function ruleLabel(a, b) {
    return (a === 1 ? '' : String(a)) + 'x' + (b > 0 ? ' + ' + b : b < 0 ? ' \u2212 ' + Math.abs(b) : '');
  }

  /* ---------- the machine drawing shared by the two scenes ---------- */
  function machineMarkup(cfg) {
    var html = '<rect x="2" y="2" width="398" height="326" rx="16" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>'
      + '<line x1="' + TX0 + '" y1="26" x2="' + TX1 + '" y2="26" stroke="' + PAL.line + '" stroke-width="3" stroke-linecap="round"/>';
    for (var v = cfg.min; v <= cfg.max; v++) {
      html += '<line x1="' + cfg.pos(v) + '" y1="21" x2="' + cfg.pos(v) + '" y2="31" stroke="' + PAL.ink + '" stroke-width="1.2"/>';
      if ((v - cfg.min) % cfg.labelEvery === 0) html += mathText(cfg.pos(v), 15, num(v), 11, MUTED);
    }
    html += '<polygon points="120,92 220,92 190,126 150,126" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2.5" stroke-linejoin="round"/>'
      + '<g id="fxBody"><rect x="84" y="126" width="172" height="100" rx="16" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="3"/>'
      + '<circle cx="104" cy="144" r="5" fill="' + PAL.warm + '"/><circle cx="122" cy="144" r="5" fill="' + PAL.good + '"/>'
      + mathText(170, 188, '?', 38, PAL.dark, 'middle', 'fxRule') + '</g>'
      + '<rect x="150" y="226" width="40" height="20" fill="' + PAL.line + '"/>'
      + '<rect x="96" y="246" width="148" height="54" rx="12" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2.5" id="fxTray"/>'
      + mathText(170, 285, '?', 28, PAL.ink, 'middle', 'fxOut')
      + hebText(170, 320, 'מגש הפלט', 12, MUTED)
      + '<path d="M64 ' + (cfg.back ? '280 V122' : '122 V280') + '" fill="none" stroke="' + PAL.dark + '" stroke-width="2.5" stroke-dasharray="6 4"/>'
      + '<path d="' + (cfg.back ? 'M58 128 L64 116 L70 128 Z' : 'M58 274 L64 286 L70 274 Z') + '" fill="' + PAL.dark + '"/>'
      + hebText(30, 204, cfg.back ? 'אחורה' : 'קדימה', 12, PAL.dark, 'middle')
      + '<g id="fxTok" opacity="0" transform="translate(170 100)"><circle r="17" fill="' + PAL.main + '" stroke="#fff" stroke-width="2.5"/>'
      + mathText(0, 5, '0', 15, '#fff', 'middle', 'fxTokT') + '</g>'
      + '<g id="fxTok2" opacity="0" transform="translate(170 232)"><circle r="17" fill="' + PAL.warm + '" stroke="#fff" stroke-width="2.5"/>'
      + mathText(0, 5, '0', 15, PAL.ink, 'middle', 'fxTok2T') + '</g>'
      + '<g id="fxCard" tabindex="0" role="slider" aria-label="' + cfg.label + '" aria-valuemin="' + cfg.min
      + '" aria-valuemax="' + cfg.max + '" aria-valuenow="' + cfg.start + '" style="cursor:grab">'
      + '<rect x="-31" y="32" width="62" height="58" rx="12" fill="' + PAL.main + '" stroke="#fff" stroke-width="2.5"/>'
      + mathText(0, 70, num(cfg.start), 26, '#fff', 'middle', 'fxCardVal') + '</g>';
    return html;
  }

  function stepperHtml() {
    return '<div class="stepper" dir="ltr" style="align-self:stretch"><div class="unit" dir="ltr">'
      + '<bdi class="math var" dir="ltr">x</bdi>'
      + '<button type="button" id="xMinus" aria-label="הקטן את הקלט ב־1">\u2212</button>'
      + '<bdi class="var math" dir="ltr" id="xVal" aria-live="polite" style="min-width:34px">0</bdi>'
      + '<button type="button" id="xPlus" aria-label="הגדל את הקלט ב־1">+</button></div></div>';
  }

  /** Wires the focusable input card, the stepper and the drag to one setX. */
  function wireInput(ctx, cfg, onX) {
    var current = cfg.start;
    var handle = ctx.el('fxCard');
    var box = ctx.extra(stepperHtml());
    ctx.register('stepper', box);
    function setX(next, acted) {
      current = clamp(next, cfg.min, cfg.max);
      handle.setAttribute('transform', 'translate(' + cfg.pos(current) + ' 0)');
      handle.setAttribute('aria-valuenow', String(current));
      handle.setAttribute('aria-valuetext', 'x = ' + num(current));
      ctx.el('fxCardVal').textContent = num(current);
      box.querySelector('#xVal').textContent = num(current);
      onX(current, acted);
    }
    box.querySelector('#xMinus').addEventListener('click', function () { ctx.sfx('tick'); setX(current - 1, true); });
    box.querySelector('#xPlus').addEventListener('click', function () { ctx.sfx('tick'); setX(current + 1, true); });
    handle.addEventListener('keydown', function (event) {
      var key = event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(key) < 0) return;
      event.preventDefault();
      ctx.sfx('tick');
      if (key === 'ArrowRight' || key === 'ArrowUp') setX(current + 1, true);
      else if (key === 'ArrowLeft' || key === 'ArrowDown') setX(current - 1, true);
      else if (key === 'Home') setX(cfg.min, true);
      else setX(cfg.max, true);
    });
    ctx.drag(handle, {
      move: function (px) {
        var raw = cfg.min + (px - TX0) / (TX1 - TX0) * (cfg.max - cfg.min);
        var next = clamp(Math.round(raw), cfg.min, cfg.max);
        if (next !== current) setX(next, false);
      },
      end: function () { setX(current, true); }
    });
    return { setX: setX, get: function () { return current; } };
  }

  function makeCfg(min, max, start, labelEvery, back, label) {
    return {
      min: min, max: max, start: start, labelEvery: labelEvery, back: back, label: label,
      pos: function (v) { return TX0 + (TX1 - TX0) * (v - min) / (max - min); }
    };
  }

  /* ---------- scene 1: discover the rule ---------- */
  var RULES = [
    { t: '2x + 1', f: function (x) { return 2 * x + 1; } },
    { t: 'x + 2', f: function (x) { return x + 2; } },
    { t: '2x \u2212 1', f: function (x) { return 2 * x - 1; } },
    { t: 'x\u00B2 + 1', f: function (x) { return x * x + 1; } }
  ];

  function discoverScene(ctx) {
    var cfg = makeCfg(-5, 5, 0, 1, false, 'כרטיס הקלט x; הזז בגרירה, בכפתורים או במקשי החצים');
    var rows = [], busy = false, solvedDone = false, ruleButtons = [];
    ctx.draw(machineMarkup(cfg)
      + '<rect x="262" y="92" width="132" height="206" rx="12" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>'
      + mathText(290, 116, 'x', 18, PAL.main) + mathText(366, 116, 'y', 18, PAL.main)
      + '<line x1="270" y1="126" x2="386" y2="126" stroke="' + PAL.line + '" stroke-width="1.5"/>'
      + '<g id="fxTable"></g>');
    function drawTable() {
      var html = '';
      if (!rows.length) html = hebText(328, 208, 'הטבלה עוד ריקה', 13, MUTED);
      rows.slice(-5).forEach(function (row, i) {
        var yy = 152 + 30 * i;
        html += mathText(290, yy, num(row.x), 20, PAL.ink) + mathText(328, yy, '\u2192', 18, MUTED) + mathText(366, yy, num(row.y), 20, PAL.dark);
      });
      ctx.el('fxTable').innerHTML = html;
    }
    function resetTray() {
      ctx.el('fxOut').textContent = '?';
      ctx.el('fxTok').setAttribute('opacity', '0');
      ctx.el('fxTok2').setAttribute('opacity', '0');
    }
    function revealRows() {
      return rows.reduce(function (acc, row) { return acc.indexOf(row.x) < 0 ? acc.concat(row.x) : acc; }, []).length;
    }
    function showRuleButtons() {
      ruleButtons.forEach(function (b) { b.hidden = false; });
    }
    var input = wireInput(ctx, cfg, function (x, acted) {
      if (busy) return;
      resetTray();
      ctx.caption('הקלט עכשיו: ' + m('x = ' + num(x)) + ' · הפלט: ' + m('?'));
      if (acted && !solvedDone) ctx.note('הקלט ' + m('x = ' + num(x)) + ' מוכן. לחץ על "הפעל את המכונה" כדי לראות מה יוצא.');
    });
    var runBtn = ctx.button('הפעל את המכונה', function () {
      if (busy) return;
      var x = input.get();
      var y = rule(x);
      var seen = rows.some(function (row) { return row.x === x; });
      busy = true; ctx.busy(true); runBtn.disabled = true;
      var tok = ctx.el('fxTok'), tokT = ctx.el('fxTokT'), tok2 = ctx.el('fxTok2'), tok2T = ctx.el('fxTok2T');
      tokT.textContent = num(x); tok2T.textContent = num(y);
      var sx = cfg.pos(x);
      ctx.sfx('click');
      ctx.tween(reduced() ? 0 : 1100, function (l) {
        if (l < 0.5) {
          var a = l / 0.5;
          tok.setAttribute('opacity', '1'); tok2.setAttribute('opacity', '0');
          tok.setAttribute('transform', 'translate(' + (sx + (170 - sx) * a) + ' ' + (61 + 41 * a) + ') scale(' + (1 - 0.15 * a) + ')');
        } else {
          var b = (l - 0.5) / 0.5;
          tok.setAttribute('opacity', '0');
          tok2.setAttribute('opacity', l >= 1 ? '0' : '1');
          tok2.setAttribute('transform', 'translate(170 ' + (232 + 36 * b) + ')');
        }
        ctx.el('fxBody').setAttribute('transform', 'translate(' + (l > 0.2 && l < 0.7 ? Math.sin(l * 90) * 1.5 : 0) + ' 0)');
      }).then(function () {
        tok.setAttribute('opacity', '0'); tok2.setAttribute('opacity', '0');
        ctx.el('fxBody').removeAttribute('transform');
        ctx.el('fxOut').textContent = num(y);
        busy = false; ctx.busy(false); runBtn.disabled = false;
        if (!seen) rows.push({ x: x, y: y });
        drawTable();
        ctx.caption('הקלט ' + m('x = ' + num(x)) + ' · הפלט ' + m('y = ' + num(y)));
        var distinct = revealRows();
        if (seen) {
          ctx.note('את ' + m('x = ' + num(x)) + ' כבר ניסית, ושוב יצא ' + m(num(y)) + '. כלל נותן אותו פלט לאותו קלט. נסה קלט אחר.');
        } else if (distinct < 3) {
          ctx.note('מ־' + m('x = ' + num(x)) + ' יצא ' + m('y = ' + num(y)) + '. נסה עוד ' + (3 - distinct === 1 ? 'קלט אחד' : m(String(3 - distinct)) + ' קלטים') + ' שונים.');
        } else if (!solvedDone) {
          showRuleButtons();
          ctx.note('עכשיו יש מספיק שורות בטבלה. איזה כלל מסביר את כולן? בדוק כל אפשרות מול הטבלה.');
          ctx.point('rule0', 'בחר את הכלל שמתאים לכל השורות בטבלה.');
        }
      });
    }, { id: 'runBtn', target: 'runBtn' });
    RULES.forEach(function (candidate, index) {
      var b = ctx.button(m(candidate.t), function () {
        if (busy || solvedDone) return;
        var bad = rows.filter(function (row) { return candidate.f(row.x) !== row.y; })[0];
        if (!bad) {
          solvedDone = true;
          ctx.el('fxRule').textContent = candidate.t;
          ctx.el('fxRule').setAttribute('font-size', '30');
          ctx.note('נכון! הכלל הוא ' + m('y = 2x + 1') + ': כופלים את הקלט ב־' + m('2') + ' ואז מוסיפים ' + m('1') + '. כל קלט נותן פלט אחד.', 'good');
          ctx.sfx('correct'); ctx.burst(14); ctx.solved();
          return;
        }
        ctx.sfx('error');
        var rowText = 'בשורה ' + m(num(bad.x) + ' \u2192 ' + num(bad.y)) + ' המכונה נתנה ' + m(num(bad.y)) + ', אבל הכלל ' + m(candidate.t) + ' נותן ' + m(num(candidate.f(bad.x))) + '.';
        if (index === 1) ctx.note('בדוק את הכלל ' + m('x + 2') + ' מול שורה שכבר בטבלה. ' + rowText);
        else if (index === 2) ctx.note('כמעט, אבל הסימן אחרי הכפל לא מתאים. ' + rowText);
        else ctx.note('הכלל ' + m(candidate.t) + ' לא מסביר את כל הטבלה. ' + rowText);
      }, { id: 'rule' + index, target: 'rule' + index, ghost: true });
      b.hidden = true;
      b.setAttribute('aria-label', 'הכלל ' + candidate.t.replace('\u00B2', ' בריבוע'));
      ruleButtons.push(b);
    });
    input.setX(0, false);
    drawTable();
    ctx.note('בחר קלט בגרירה, בכפתורים או במקשי החצים, והפעל את המכונה. נסה לפחות שלושה קלטים שונים.');
  }

  /* ---------- scene 3: from the output back to the input ---------- */
  function backwardScene(ctx) {
    var cfg = makeCfg(0, 14, 0, 2, true, 'כרטיס הקלט x; הזז בגרירה, בכפתורים או במקשי החצים');
    var done = false;
    ctx.draw(machineMarkup(cfg)
      + '<rect x="262" y="92" width="132" height="226" rx="12" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>'
      + hebText(328, 114, 'מהפלט אל הקלט', 13, PAL.dark)
      + '<rect x="270" y="126" width="116" height="34" rx="8" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>'
      + mathText(328, 150, '13', 18, PAL.ink)
      + '<path d="M328 162 V174 M322 170 L328 178 L334 170" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<rect x="270" y="180" width="116" height="34" rx="8" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
      + mathText(328, 204, '\u2212 1', 17, PAL.dark, 'middle', 'fxOp1')
      + '<path d="M328 216 V228 M322 224 L328 232 L334 224" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<rect x="270" y="234" width="116" height="34" rx="8" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
      + mathText(328, 258, '\u00F7 2', 17, PAL.dark, 'middle', 'fxOp2')
      + '<path d="M328 270 V282 M322 278 L328 286 L334 278" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<rect x="270" y="288" width="116" height="26" rx="8" fill="#fff" stroke="' + PAL.line + '" stroke-width="2" stroke-dasharray="4 3" id="fxEnd"/>'
      + mathText(328, 307, 'x = ?', 15, PAL.ink, 'middle', 'fxEndT'));
    var input = wireInput(ctx, cfg, function (x, acted) {
      var y = rule(x);
      ctx.el('fxOut').textContent = num(y);
      ctx.el('fxTray').setAttribute('fill', y === 13 ? PAL.goodSoft : PAL.warmSoft);
      ctx.el('fxTray').setAttribute('stroke', y === 13 ? PAL.good : PAL.warm);
      ctx.caption(m('f(x) = 2x + 1') + ' · יעד: ' + m('13') + ' · עכשיו: ' + m('f(' + num(x) + ') = ' + num(y)));
      if (y === 13 && x === 6) {
        if (!done) {
          done = true;
          ctx.el('fxOp1').textContent = '13 \u2212 1 = 12';
          ctx.el('fxOp2').textContent = '12 \u00F7 2 = 6';
          ctx.el('fxEndT').textContent = 'x = 6';
          ctx.note('בדיוק! ' + m('f(6) = 2 \u00B7 6 + 1 = 13') + '. ביטלנו את הכלל בסדר הפוך: קודם החסרנו ' + m('1') + ', ואז חילקנו ב־' + m('2') + '.', 'good');
          if (acted) { ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
        }
        return;
      }
      if (!acted) return;
      if (x === 13) ctx.note(m('13') + ' הוא הפלט שאנחנו מחפשים, לא הקלט. הקלט ' + m('13') + ' נותן ' + m('27') + '. בטל את הכלל צעד אחר צעד: ' + m('\u2212 1') + ' ואז ' + m('\u00F7 2') + '.');
      else if (x === 7) ctx.note(m('x = 7') + ' נותן ' + m('15') + '. הוספת ' + m('1') + ' במקום להחסיר אותו. התחל מ־' + m('13') + ' והחסר ' + m('1') + '.');
      else if (x === 12) ctx.note(m('x = 12') + ' הוא התוצאה אחרי החיסור בלבד. עוד צעד אחד בביטול: חלוקה ב־' + m('2') + '.');
      else if (y > 13) ctx.note('המגש מראה ' + m(num(y)) + ', יותר מ־' + m('13') + '. הקטן את ' + m('x') + '.');
      else ctx.note('המגש מראה ' + m(num(y)) + ', פחות מ־' + m('13') + '. הגדל את ' + m('x') + '.');
    });
    input.setX(0, false);
    ctx.note('הפלט קבוע: ' + m('13') + '. מצא איזה קלט מביא אותו, בגרירה, בכפתורים או במקשי החצים.');
  }

  /* ---------- scene 5: function or not ---------- */
  var DIAGRAMS = [
    { id: 'A', name: 'א', x0: 274, ins: [1, 2, 3], outs: [2, 4, 6], arrows: [[0, 0], [1, 1], [2, 2]], isFn: true },
    { id: 'B', name: 'ב', x0: 140, ins: [1, 2, 3], outs: [3, 5, 6, 7], arrows: [[0, 0], [1, 1], [1, 2], [2, 3]], isFn: false },
    { id: 'C', name: 'ג', x0: 6, ins: [1, 2, 3], outs: [4, 6], arrows: [[0, 0], [1, 0], [2, 1]], isFn: true }
  ];
  function rowY(count, i) {
    var base = { 2: [115, 165], 3: [90, 140, 190], 4: [65, 115, 165, 215] }[count];
    return base[i];
  }
  function diagramMarkup(d) {
    var html = '<g id="diag' + d.id + '" tabindex="0" role="group" aria-label="דיאגרמה ' + d.name
      + '׳. עבור בין החצים במקשי החצים כדי לשמוע לאן כל חץ מוביל" style="outline-offset:2px">'
      + '<rect x="' + d.x0 + '" y="30" width="124" height="206" rx="10" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>'
      + hebText(d.x0 + 62, 24, 'דיאגרמה ' + d.name + '׳', 13, PAL.dark)
      + hebText(d.x0 + 20, 52, 'קלט', 12, MUTED) + hebText(d.x0 + 104, 52, 'פלט', 12, MUTED);
    d.ins.forEach(function (v, i) {
      html += mathText(d.x0 + 18, rowY(3, i) + 6, String(v), 18, PAL.ink)
        + '<circle id="dot' + d.id + 'i' + i + '" cx="' + (d.x0 + 38) + '" cy="' + rowY(3, i) + '" r="6" fill="' + PAL.main + '"/>';
    });
    d.outs.forEach(function (v, i) {
      html += '<circle cx="' + (d.x0 + 88) + '" cy="' + rowY(d.outs.length, i) + '" r="6" fill="' + PAL.good + '"/>'
        + mathText(d.x0 + 106, rowY(d.outs.length, i) + 6, String(v), 18, PAL.ink);
    });
    d.arrows.forEach(function (ar, k) {
      var y1 = rowY(3, ar[0]), y2 = rowY(d.outs.length, ar[1]);
      var label = 'חץ מהקלט ' + d.ins[ar[0]] + ' אל הפלט ' + d.outs[ar[1]] + ' בדיאגרמה ' + d.name;
      html += '<g id="arr' + d.id + k + '" data-d="' + d.id + '" data-k="' + k + '" aria-label="' + label + '" style="cursor:pointer">'
        + '<line x1="' + (d.x0 + 44) + '" y1="' + y1 + '" x2="' + (d.x0 + 82) + '" y2="' + y2 + '" stroke="transparent" stroke-width="26"/>'
        + '<line class="vis" x1="' + (d.x0 + 44) + '" y1="' + y1 + '" x2="' + (d.x0 + 81) + '" y2="' + y2 + '" stroke="' + PAL.ink + '" stroke-width="2.5" marker-end="url(#fnAh)"/></g>';
    });
    return html + '</g>';
  }
  function judgeScene(ctx) {
    var answers = { A: null, B: null, C: null }, finished = false;
    ctx.draw('<defs><marker id="fnAh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="' + PAL.ink + '"/></marker>'
      + '<marker id="fnAhSel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="' + PAL.warm + '"/></marker></defs>'
      + '<rect x="2" y="2" width="398" height="246" rx="16" fill="' + PAL.soft + '" opacity="0.35"/>'
      + DIAGRAMS.map(diagramMarkup).join(''));
    var btnStyle = 'min-height:44px;min-width:44px;width:100%;border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.soft
      + ';color:' + PAL.dark + ';font-size:14px;font-weight:700;padding:0 4px;cursor:pointer';
    var box = ctx.extra('<div dir="rtl" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
      + DIAGRAMS.map(function (d) {
        return '<div style="display:flex;flex-direction:column;gap:6px;align-items:stretch">'
          + '<b style="font-size:12.5px;text-align:center">דיאגרמה ' + d.name + '׳</b>'
          + '<button type="button" id="yes' + d.id + '" data-d="' + d.id + '" data-v="yes" aria-pressed="false" aria-label="דיאגרמה ' + d.name + ': פונקציה" style="' + btnStyle + '">פונקציה</button>'
          + '<button type="button" id="no' + d.id + '" data-d="' + d.id + '" data-v="no" aria-pressed="false" aria-label="דיאגרמה ' + d.name + ': לא פונקציה" style="' + btnStyle + '">לא פונקציה</button>'
          + '<div data-status="' + d.id + '" style="min-height:20px;font-size:13px;font-weight:800;text-align:center"></div></div>';
      }).join('') + '</div>');
    ctx.register('judge', box);
    function find(id) { return DIAGRAMS.filter(function (d) { return d.id === id; })[0]; }
    function outCount(d, i) { return d.arrows.filter(function (a) { return a[0] === i; }).length; }
    function selectArrow(g) {
      var d = find(g.getAttribute('data-d')), k = Number(g.getAttribute('data-k')), ar = d.arrows[k];
      DIAGRAMS.forEach(function (dd) {
        dd.arrows.forEach(function (_, kk) {
          var node = ctx.el('arr' + dd.id + kk);
          var on = node === g;
          node.querySelector('.vis').setAttribute('stroke', on ? PAL.warm : PAL.ink);
          node.querySelector('.vis').setAttribute('stroke-width', on ? '4' : '2.5');
          node.querySelector('.vis').setAttribute('marker-end', on ? 'url(#fnAhSel)' : 'url(#fnAh)');
        });
      });
      var n = outCount(d, ar[0]);
      var targets = d.arrows.filter(function (a) { return a[0] === ar[0]; }).map(function (a) { return m(String(d.outs[a[1]])); });
      ctx.sfx('tick');
      if (n === 1) ctx.note('בדיאגרמה ' + d.name + '׳ מהקלט ' + m(String(d.ins[ar[0]])) + ' יוצא חץ אחד, אל ' + targets[0] + '.');
      else ctx.note('בדיאגרמה ' + d.name + '׳ מהקלט ' + m(String(d.ins[ar[0]])) + ' יוצאים ' + n + ' חצים: אל ' + targets.join(' ואל ') + '.');
    }
    var cursor = { A: -1, B: -1, C: -1 };
    ctx.svg.querySelectorAll('[data-k]').forEach(function (g) {
      g.addEventListener('click', function () {
        cursor[g.getAttribute('data-d')] = Number(g.getAttribute('data-k'));
        selectArrow(g);
      });
    });
    DIAGRAMS.forEach(function (d) {
      ctx.el('diag' + d.id).addEventListener('keydown', function (event) {
        var key = event.key;
        var step = (key === 'ArrowRight' || key === 'ArrowDown') ? 1 : (key === 'ArrowLeft' || key === 'ArrowUp') ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        cursor[d.id] = (cursor[d.id] + step + d.arrows.length) % d.arrows.length;
        selectArrow(ctx.el('arr' + d.id + cursor[d.id]));
      });
    });
    function paintAnswers() {
      DIAGRAMS.forEach(function (d) {
        var ans = answers[d.id];
        ['yes', 'no'].forEach(function (v) {
          var b = box.querySelector('#' + v + d.id);
          var pressed = ans === v;
          var right = pressed && ((v === 'yes') === d.isFn);
          b.setAttribute('aria-pressed', String(pressed));
          b.style.background = pressed ? (right ? PAL.goodSoft : '#fde8ec') : PAL.soft;
          b.style.borderColor = pressed ? (right ? PAL.good : BAD) : PAL.main;
        });
        var st = box.querySelector('[data-status="' + d.id + '"]');
        if (!ans) st.textContent = '';
        else if ((ans === 'yes') === d.isFn) { st.textContent = '✓ נכון'; st.style.color = PAL.good; }
        else { st.textContent = '✗ בדוק שוב'; st.style.color = BAD; }
      });
    }
    box.querySelectorAll('button[data-d]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = find(b.getAttribute('data-d')), v = b.getAttribute('data-v');
        answers[d.id] = v;
        paintAnswers();
        var right = (v === 'yes') === d.isFn;
        ctx.sfx(right ? 'tick' : 'error');
        if (d.id === 'A') {
          ctx.note(right ? 'דיאגרמה א׳ היא פונקציה: מכל קלט יוצא חץ אחד בלבד.' : 'בדוק כל קלט בנפרד: מכל אחד יוצא חץ אחד בלבד, ולכן זו פונקציה.', right ? 'good' : undefined);
        } else if (d.id === 'B') {
          ctx.note(right ? 'נכון: מהקלט ' + m('2') + ' יוצאים שני חצים, אל ' + m('5') + ' ואל ' + m('6') + '. לקלט אחד אסור שני פלטים.' : 'שים לב לקלט ' + m('2') + ': יוצאים ממנו שני חצים, אל ' + m('5') + ' ואל ' + m('6') + '. לקלט אחד אסור שני פלטים, ולכן זו לא פונקציה.', right ? 'good' : undefined);
        } else {
          ctx.note(right ? 'דיאגרמה ג׳ היא פונקציה: שני קלטים יכולים להגיע לאותו פלט.' : 'שני קלטים יכולים להגיע לאותו פלט, וזה בסדר. מה שאסור הוא קלט אחד עם שני פלטים. כאן לכל קלט יוצא חץ אחד.', right ? 'good' : undefined);
        }
        var all = DIAGRAMS.every(function (dd) { return (answers[dd.id] === 'yes') === dd.isFn && answers[dd.id]; });
        if (all && !finished) {
          finished = true;
          ctx.note('שלושתן נכונות: א׳ ו־ג׳ הן פונקציות, ב׳ לא. מכל קלט יוצא חץ אחד בדיוק.', 'good');
          ctx.sfx('correct'); ctx.burst(14); ctx.solved();
        }
      });
    });
    ctx.note('בכל דיאגרמה, בדוק כמה חצים יוצאים מכל קלט. אפשר לעבור בין החצים עם מקשי החצים ולבחור בכפתורים.');
  }

  /* ---------- picture for the graph quiz ---------- */
  function graphPicture(ctx) {
    var ox = 60, oy = 260, ux = 70, uy = 28;
    function gx(v) { return ox + ux * v; }
    function gy(v) { return oy - uy * v; }
    var html = '<rect x="2" y="2" width="398" height="296" rx="16" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>';
    for (var i = 1; i <= 4; i++) html += '<line x1="' + gx(i) + '" y1="36" x2="' + gx(i) + '" y2="' + oy + '" stroke="' + PAL.line + '" stroke-width="0.8"/>'
      + mathText(gx(i), oy + 18, String(i), 13, MUTED);
    for (var j = 1; j <= 8; j++) html += '<line x1="' + ox + '" y1="' + gy(j) + '" x2="' + (gx(4) + 4) + '" y2="' + gy(j) + '" stroke="' + PAL.line + '" stroke-width="0.8"/>'
      + (j % 2 === 0 ? mathText(ox - 8, gy(j) + 4, String(j), 13, MUTED, 'end') : '');
    html += '<path d="M' + ox + ' ' + oy + ' H358 M' + ox + ' ' + oy + ' V30" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<path d="M352 256 L358 260 L352 264 M56 36 L60 30 L64 36" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + mathText(374, 265, 'x', 17) + mathText(76, 30, 'y', 17) + mathText(ox - 8, oy + 18, '0', 13, MUTED, 'end')
      + '<line x1="' + gx(0.5) + '" y1="' + gy(2) + '" x2="' + gx(3.4) + '" y2="' + gy(7.8) + '" stroke="' + PAL.main + '" stroke-width="2.5" stroke-linecap="round"/>';
    [[1, 3], [2, 5], [3, 7]].forEach(function (p) {
      html += '<circle cx="' + gx(p[0]) + '" cy="' + gy(p[1]) + '" r="7" fill="' + PAL.warm + '" stroke="#fff" stroke-width="2.5"/>'
        + mathText(gx(p[0]) + 12, gy(p[1]) + 24, '(' + p[0] + ', ' + p[1] + ')', 15, PAL.ink, 'start');
    });
    ctx.draw(html);
  }

  var steps = [
    {
      mode: 'intro', tA: 'מכונת הפונקציות', sub: 'מכניסים מספר, מקבלים מספר, ומגלים את הכלל שבפנים.',
      tip: 'שלום, אני אליהו. יש לי מכונה: מכניסים מספר מלמעלה, ומקבלים מספר במגש. בוא נגלה מה היא עושה.',
      emoji: '⚙️', eq: m('f(x) = 2x + 1'),
      note: m('x') + ' הוא הקלט, ו־' + m('f(x)') + ' הוא הפלט. לכל קלט המכונה נותנת בדיוק פלט אחד.',
      cue: 'מוכן לנסות את המכונה?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מגלים את הכלל', sub: 'בחר קלט בגרירה, בכפתורים או במקשי החצים, הפעל את המכונה וגלה מה הכלל.',
      tip: 'הכנס שלושה מספרים שונים וקרא את הטבלה. אחר כך תבחר את הכלל שמסביר את כולם.',
      aspect: [402, 330], alt: 'מכונה עם משפך למעלה ומגש למטה. מעל המשפך שורת מספרים מ־מינוס חמש עד חמש וכרטיס קלט שאפשר להזיז. מימין טבלה של קלטים ופלטים שנוסו',
      cue: 'נסה שלושה קלטים ובחר את הכלל', cueDone: 'מצאת את הכלל. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'runBtn', text: 'לחץ על "הפעל את המכונה" כדי להפיל את הקלט פנימה.' }, setup: discoverScene
    },
    {
      mode: 'quiz', tA: 'מחשבים ערך', sub: 'נתון ' + m('f(x) = 3x \u2212 2') + '. כמה שווה ' + m('f(4)') + '?',
      tip: m('f(4)') + ' הוא מספר: מה שיוצא מהמכונה כשמכניסים ' + m('4') + '. הצב ' + m('4') + ' במקום ' + m('x') + '.', btn: 'המשך ←',
      win: 'בדיוק. מציבים ' + m('4') + ' ומחשבים לפי הסדר.', wrongSay: 'בדוק מה עושים עם ' + m('x') + ' ומה עושים עם ה־' + m('2') + '.',
      opts: [
        { t: m('10'), c: true, f: m('f(4) = 3 \u00B7 4 \u2212 2 = 12 \u2212 2 = 10') + '. הצבת ' + m('4') + ' במקום ' + m('x') + ' וחישבת נכון.' },
        { t: m('14'), f: 'הוספת ' + m('2') + ' במקום להחסיר. בכלל כתוב ' + m('\u2212 2') + ', ולכן ' + m('12 \u2212 2 = 10') + '.' },
        { t: m('5'), f: 'חיברת ' + m('3 + 4 \u2212 2') + ', אבל ' + m('3x') + ' פירושו ' + m('3') + ' כפול ' + m('x') + ', לא ' + m('3') + ' ועוד ' + m('x') + '. ' + m('f(4)') + ' הוא לא כפל של ' + m('f') + ' ב־' + m('4') + '.' },
        { t: m('12'), f: 'כפלת נכון, ' + m('3 \u00B7 4 = 12') + ', אבל שכחת להחסיר את ' + m('2') + ' מהכלל.' }
      ],
      hints: ['הצב את המספר ' + m('4') + ' במקום האות ' + m('x') + ' בכלל.', 'קודם כפל: ' + m('3') + ' כפול ' + m('4') + '. רק אחר כך החיסור.', m('3 \u00B7 4') + ' ואז מחסרים ' + m('2') + '.']
    },
    {
      mode: 'scene', tA: 'מהתמונה אל המקור', sub: 'הפלט קבוע: ' + m('13') + '. מצא את הקלט בגרירה, בכפתורים או במקשי החצים.',
      tip: 'עכשיו המכונה פועלת לאחור. הפלט ידוע, ואנחנו מחפשים איזה קלט הביא אותו.',
      aspect: [402, 330], alt: 'אותה מכונה כשהמטרה היא פלט ' + 'שלוש עשרה. מעל המשפך שורת מספרים מאפס עד ארבע עשרה וכרטיס קלט שאפשר להזיז. מימין שרשרת ביטול: חיסור אחד ואז חלוקה בשתיים',
      cue: 'הזז את הקלט עד שהמגש מראה 13', cueDone: 'מצאת את המקור. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'stepper', text: 'הזז את ' + m('x') + ' וראה מה המגש מראה. אפשר גם לבטל את הכלל בסדר הפוך.' }, setup: backwardScene
    },
    {
      mode: 'quiz', tA: 'מוצאים את הקלט', sub: 'נתון ' + m('f(x) = 2x + 1') + '. לאיזה ' + m('x') + ' מתקבל ' + m('f(x) = 9') + '?',
      tip: 'הפלט הוא ' + m('9') + '. בטל את הכלל מהסוף להתחלה: קודם החיסור, אחר כך החלוקה.', btn: 'המשך ←',
      win: 'בדיוק. ביטלת את הכלל בסדר הפוך.', wrongSay: 'אל תפעיל את הכלל מחדש. בטל אותו צעד אחר צעד.',
      opts: [
        { t: m('4'), c: true, f: m('2 \u00B7 4 + 1 = 9') + '. ביטלת נכון: ' + m('9 \u2212 1 = 8') + ' ואז ' + m('8 \u00F7 2 = 4') + '.' },
        { t: m('19'), f: 'הפעלת את הכלל על ' + m('9') + ' במקום לבטל אותו: ' + m('2 \u00B7 9 + 1 = 19') + '. ' + m('9') + ' הוא הפלט, לא הקלט.' },
        { t: m('5'), f: 'הוספת ' + m('1') + ' במקום להחסיר אותו: ' + m('9 + 1 = 10') + ' ואז ' + m('10 \u00F7 2 = 5') + '. בדוק: ' + m('f(5) = 11') + '.' },
        { t: m('4.5'), f: 'חילקת את ' + m('9') + ' ב־' + m('2') + ' ושכחת קודם להחסיר ' + m('1') + '. בדוק: ' + m('f(4.5) = 10') + '.' }
      ],
      hints: ['הכלל כפל ואז חיבור. כדי לבטל, עושים את הפעולות ההפוכות בסדר הפוך.', 'קודם מבטלים את ה־' + m('+ 1') + ', ואחר כך את הכפל ב־' + m('2') + '.', 'התחל מ־' + m('9 \u2212 1') + ' ואז חלק ב־' + m('2') + '.']
    },
    {
      mode: 'scene', tA: 'פונקציה או לא', sub: 'שלוש דיאגרמות חיצים. בדוק כמה חצים יוצאים מכל קלט ושפוט כל אחת.',
      tip: 'פונקציה נותנת לכל קלט בדיוק פלט אחד. ספור את החצים שיוצאים מכל קלט.',
      aspect: [402, 250], alt: 'שלוש דיאגרמות חיצים, לכל אחת עמודת קלטים משמאל ועמודת פלטים מימין. בדיאגרמה א מכל קלט יוצא חץ אחד. בדיאגרמה ב מהקלט שתיים יוצאים שני חצים. בדיאגרמה ג שני קלטים מגיעים לאותו פלט',
      cue: 'שפוט את שלוש הדיאגרמות', cueDone: 'שפטת נכון את שלושתן. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'judge', text: 'בחר "פונקציה" או "לא פונקציה" מתחת לכל דיאגרמה.' }, setup: judgeScene
    },
    {
      mode: 'quiz', tA: 'מה הופך התאמה לפונקציה?', sub: 'בחר את המשפט שמתאר פונקציה.',
      tip: 'חשוב על דיאגרמות החיצים. מה אסור שיקרה לקלט?', btn: 'המשך ←',
      win: 'בדיוק. הקלט הוא זה שקובע פלט אחד.', wrongSay: 'חשוב על הקלט: כמה פלטים מותר לו?',
      opts: [
        { t: 'לכל קלט יש בדיוק פלט אחד', c: true, f: 'זו ההגדרה: כל קלט מוביל לפלט אחד בלבד. מותר ששני קלטים יגיעו לאותו פלט.' },
        { t: 'לכל פלט יש בדיוק קלט אחד', f: 'זו תכונה אחרת. בדיאגרמה ג׳ שני קלטים הגיעו לאותו פלט, והיא עדיין פונקציה.' },
        { t: 'כל הפלטים שונים זה מזה', f: 'פלטים יכולים להיות זהים: ' + m('f(x) = x\u00B2') + ' נותנת ' + m('4') + ' גם ל־' + m('2') + ' וגם ל־' + m('\u22122') + '.' },
        { t: 'הכלל חייב להיות כפל ועוד', f: 'הכלל יכול להיות כל פעולה, כמו חיסור או ריבוע. מה שקובע הוא פלט אחד לכל קלט.' }
      ],
      hints: ['בדיאגרמה ב׳ משהו השתבש בקלט ' + m('2') + '. מה בדיוק?', 'ההגדרה מדברת על הקלט ועל מספר הפלטים שלו.', 'כל קלט, פלט אחד בדיוק.']
    },
    {
      mode: 'quiz', tA: 'קוראים מהגרף', sub: 'הגרף עובר דרך שלוש הנקודות. כמה שווה ' + m('f(3)') + '?',
      tip: m('f(3)') + ' פירושו הפלט כשהקלט ' + m('3') + '. מצא את ' + m('3') + ' על ציר ' + m('x') + ' וקרא את הגובה.', btn: 'לסיכום ←',
      aspect: [402, 300], alt: 'גרף עם צירים. ציר איקס מאפס עד ארבע וציר וואי מאפס עד שמונה. שלוש נקודות מסומנות: אחת ושלוש, שתיים וחמש, שלוש ושבע, והישר שעובר דרכן',
      setup: graphPicture,
      win: 'בדיוק. הקלט ' + m('3') + ' נמצא בציר האופקי, והפלט בגובה.', wrongSay: 'קרא את הנקודה שבה ' + m('x = 3') + ' ובדוק איזה מספר הוא הגובה.',
      opts: [
        { t: m('7'), c: true, f: 'הנקודה ' + m('(3, 7)') + ' אומרת שהקלט ' + m('3') + ' נותן פלט ' + m('7') + ', ולכן ' + m('f(3) = 7') + '.' },
        { t: m('3'), f: 'קראת את ה־' + m('x') + ', שהוא הקלט. ' + m('f(3)') + ' הוא הפלט, הגובה של הנקודה.' },
        { t: m('5'), f: 'קראת את הנקודה השכנה ' + m('(2, 5)') + '. היא שייכת ל־' + m('f(2)') + ', לא ל־' + m('f(3)') + '.' },
        { t: m('9'), f: 'המשכת את הסדרה צעד אחד יותר מדי: ' + m('9') + ' הוא ' + m('f(4)') + '. אנחנו מחפשים את ' + m('f(3)') + '.' }
      ],
      hints: ['מצא את המספר ' + m('3') + ' על הציר האופקי.', 'עלה מ־' + m('3') + ' עד הנקודה וקרא את הגובה.', 'הנקודה היא ' + m('(3, ?)') + ' והסימן ' + m('?') + ' הוא ' + m('f(3)') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את מכונת הפונקציות', sub: 'כלל אחד, וכל קלט מקבל פלט אחד.',
      tip: 'כל הכבוד. עכשיו אתה יודע לקרוא f(x), לחשב אותו ולחזור אחורה מפלט אל קלט.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'פונקציה נותנת לכל קלט בדיוק פלט אחד.',
      formula: m('f(x)') + ' הוא הפלט עבור הקלט ' + m('x')
    }
  ];

  window.NoamGame.boot({
    slug: 'mechonat-hapunktsiyot', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'חישוב ערך הפונקציה', math: 'f(4) = 10' },
      { step: 4, name: 'מציאת הקלט מהפלט', math: 'f(x) = 9' },
      { step: 6, name: 'מהי פונקציה', math: 'x \u2192 f(x)' },
      { step: 7, name: 'קריאת ערך מגרף', math: 'f(3) = 7' }
    ],
    bonus: {
      label: 'מכונת הכללים', closeLabel: 'סגור את המכונה', hint: 'קבל כלל חדש, וחשב פלט או מצא קלט.',
      setup: function (box, ctx) {
        var ruleA = 2, ruleB = 1, kind = 'value', k = 0, answer = 0, guess = 0, out = 0;
        box.innerHTML = '<div class="bTitle">מכונת הכללים</div><div class="bSub" data-q></div>'
          + '<div class="bChip" data-rule dir="ltr"></div>'
          + '<div class="stepper" dir="ltr" style="align-self:stretch"><div class="unit" dir="ltr">'
          + '<bdi class="math var" dir="ltr" data-var>x</bdi>'
          + '<button type="button" data-d="-5" aria-label="הקטן ב־5" style="min-height:44px;min-width:44px">\u22125</button>'
          + '<button type="button" data-d="-1" aria-label="הקטן ב־1">\u2212</button>'
          + '<bdi class="var math" dir="ltr" data-val aria-live="polite" style="min-width:40px">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל ב־1">+</button>'
          + '<button type="button" data-d="5" aria-label="הגדל ב־5" style="min-height:44px;min-width:44px">+5</button></div></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">כלל חדש ↻</button>';
        function setGuess(value) {
          guess = clamp(value, -60, 60);
          box.querySelector('[data-val]').textContent = num(guess);
          box.querySelector('[data-ok]').hidden = true;
          box.querySelector('[data-forms]').hidden = true;
        }
        function randomRule() {
          ruleA = 2 + Math.floor(Math.random() * 4);
          ruleB = Math.floor(Math.random() * 13) - 6;
          if (ruleB === 0) ruleB = 3;
          kind = Math.random() < 0.5 ? 'value' : 'preimage';
          box.querySelector('[data-rule]').textContent = 'f(x) = ' + ruleLabel(ruleA, ruleB);
          if (kind === 'value') {
            k = Math.floor(Math.random() * 9) - 3;
            answer = ruleA * k + ruleB;
            box.querySelector('[data-q]').innerHTML = 'כמה שווה ' + bdi('f(' + num(k) + ')') + '?';
            box.querySelector('[data-var]').textContent = 'f(' + num(k) + ')';
          } else {
            answer = Math.floor(Math.random() * 10) - 3;
            out = ruleA * answer + ruleB;
            box.querySelector('[data-q]').innerHTML = 'לאיזה ' + bdi('x') + ' מתקבל ' + bdi('f(x) = ' + num(out)) + '?';
            box.querySelector('[data-var]').textContent = 'x';
          }
          setGuess(0);
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () { ctx.sfx('click'); setGuess(guess + Number(b.getAttribute('data-d'))); });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var ok = guess === answer;
          var note = box.querySelector('[data-ok]');
          var forms = box.querySelector('[data-forms]');
          note.hidden = false;
          ctx.sfx(ok ? 'correct' : 'error');
          note.style.color = ok ? PAL.good : BAD;
          if (ok) {
            note.textContent = 'נכון!';
            forms.hidden = false;
            var lin = ruleA + '\u00B7' + paren(kind === 'value' ? k : answer) + (ruleB > 0 ? ' + ' + ruleB : ' \u2212 ' + Math.abs(ruleB));
            if (kind === 'value') {
              forms.innerHTML = bdi('f(' + num(k) + ') = ' + lin) + bdi('f(' + num(k) + ') = ' + num(answer));
            } else {
              forms.innerHTML = bdi(ruleLabel(ruleA, ruleB) + ' = ' + num(out)) + bdi(ruleA + 'x = ' + num(out - ruleB))
                + bdi('x = ' + num(out - ruleB) + ' \u00F7 ' + ruleA + ' = ' + num(answer));
            }
          } else if (kind === 'value') {
            note.textContent = 'נסה שוב: הצב את המספר במקום x, כפול קודם, ואז חבר או חסר.';
            forms.hidden = true;
          } else {
            note.textContent = 'נסה שוב: אל תפעיל את הכלל. בטל אותו, קודם את החיבור או החיסור ואז את הכפל.';
            forms.hidden = true;
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); randomRule(); });
        randomRule();
      }
    }
  });
}());
