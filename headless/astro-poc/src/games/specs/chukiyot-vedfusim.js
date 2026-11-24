/**
 * ציידי החוקיות — an engine game.
 *
 * The idea: a row of squares built from matchsticks grows by the same number
 * of matches every time (here 3), so the number of matches in shape n is
 * 3·n + 1. The slope-like number a is the constant difference and b is what
 * is left when the first term is "rewound" to shape 0. The rule works in both
 * directions: from the position to the term, and from a number back to a
 * position (which must be a whole number).
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink;
  var WOOD = '#92400e', NEW = '#dc2626', MUTED = '#475569', BAD = '#b91c1c', GOOD = PAL.good;
  var BLUE = PAL.dark;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function f(x) { return x < 0 ? '\u2212' + (-x) : String(x); }
  /** The rule a·n + b as a display string (real minus, middle dot). */
  function expr(a, b) {
    var head = a === 0 ? '' : (a === 1 ? 'n' : a + '\u00B7n');
    if (a === 0) return f(b);
    if (b === 0) return head;
    return head + (b > 0 ? ' + ' + b : ' \u2212 ' + (-b));
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function keyDelta(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -1;
    return 0;
  }
  function numT(x, y, size, fill, text, anchor, extra) {
    return '<text x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size
      + '" fill="' + fill + '" text-anchor="' + (anchor || 'middle') + '"' + (extra || '') + '>' + text + '</text>';
  }
  function hebT(x, y, size, fill, text, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-family="Heebo, sans-serif" font-size="' + size + '" font-weight="700" fill="'
      + fill + '" text-anchor="' + (anchor || 'middle') + '">' + text + '</text>';
  }
  /* ---------- matchstick squares ---------- */
  var S = 52, X0 = 28, Y0 = 62;
  function stick(x1, y1, x2, y2, col) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col
      + '" stroke-width="7" stroke-linecap="round"/>'
      + '<circle cx="' + x1 + '" cy="' + y1 + '" r="4" fill="#b91c1c"/>';
  }
  /** Markup of n squares in a row; the last square's three new sticks are red. */
  function squares(n) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var x = X0 + i * S, col = (i === n - 1 && n > 1) ? NEW : WOOD;
      s += stick(x + 4, Y0, x + S - 4, Y0, col) + stick(x + 4, Y0 + S, x + S - 4, Y0 + S, col);
      s += stick(x + S, Y0 + 4, x + S, Y0 + S - 4, col);
      if (i === 0) s += stick(x, Y0 + 4, x, Y0 + S - 4, WOOD);
    }
    return s;
  }
  function sumText(n) {
    var parts = ['4'];
    for (var i = 1; i < n; i++) parts.push('3');
    return parts.join(' + ') + ' = ' + (3 * n + 1);
  }
  /** A picture (for quizzes) with n squares and a caption. */
  function squaresPicture(n, cap) {
    return function (ctx) {
      ctx.draw('<g>' + squares(n) + '</g>' + numT(201, 190, 20, INK, cap));
    };
  }
  function seqPicture(vals, cap) {
    return function (ctx) {
      var s = '', i, x;
      for (i = 0; i < vals.length; i++) {
        x = 60 + i * 95;
        s += '<rect x="' + (x - 34) + '" y="50" width="68" height="52" rx="10" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>'
          + numT(x, 85, 24, INK, vals[i]);
      }
      s += numT(201, 160, 18, MUTED, cap);
      ctx.draw(s);
    };
  }
  /* ---------- scene 1: build the shapes ---------- */
  function buildScene(ctx) {
    var n = 1, maxN = 1, doneOnce = false;
    ctx.draw('<g id="sq"></g>'
      + hebT(236, 30, 17, INK, 'ציור', 'middle')
      + '<text id="nTxt" x="196" y="31" direction="ltr" font-family="Secular One, sans-serif" font-size="19" fill="' + BLUE + '" text-anchor="end"></text>'
      + '<text id="sumTxt" x="201" y="198" direction="ltr" font-family="Secular One, sans-serif" font-size="20" fill="' + INK + '" text-anchor="middle"></text>'
      + '<g id="hN" tabindex="0" role="slider" aria-label="מספר הריבועים בציור. חצים משנים אותו" aria-valuemin="1" aria-valuemax="6" aria-valuenow="1" style="cursor:grab">'
      + '<circle r="30" fill="transparent"/><circle r="10" fill="#fff" stroke="' + BLUE + '" stroke-width="4.5"/></g>');
    var box = ctx.extra('<table dir="ltr" style="width:100%;border-collapse:collapse;text-align:center;font-size:14px" id="tbl"></table>'
      + '<div class="stepper" dir="ltr" style="margin-top:8px"><div class="unit" dir="ltr" style="gap:8px">'
      + '<button type="button" data-act="-1" aria-label="הסר את הריבוע האחרון">−</button>'
      + '<bdi class="var math" dir="ltr" data-n aria-live="polite" style="min-width:34px">1</bdi>'
      + '<button type="button" data-act="1" aria-label="הוסף ריבוע לציור">+</button></div></div>');
    ctx.register('controls', box);
    var h = ctx.el('hN');
    function renderTable() {
      var r1h = '', r2h = '', r3h = '', i;
      var cs = 'border:1.5px solid ' + PAL.line + ';padding:5px 2px;font-family:Secular One,sans-serif;';
      for (i = 1; i <= 6; i++) {
        var seen = i <= maxN;
        r1h += '<td style="' + cs + 'background:' + PAL.soft + '">' + i + '</td>';
        r2h += '<td style="' + cs + (i === n ? 'background:#fef3c7;' : '') + '">' + (seen ? (3 * i + 1) : '?') + '</td>';
        r3h += '<td style="' + cs + 'color:' + NEW + '">' + (i === 1 ? '' : (i <= maxN ? '+3' : '?')) + '</td>';
      }
      var lab = 'border:none;padding:5px 6px;font-weight:700;font-size:12.5px;color:' + MUTED + ';text-align:right;white-space:nowrap;';
      box.querySelector('#tbl').innerHTML = '<tr>' + r1h + '<td style="' + lab + '">ציור</td></tr>'
        + '<tr>' + r2h + '<td style="' + lab + '">גפרורים</td></tr>'
        + '<tr>' + r3h + '<td style="' + lab + '">תוספת</td></tr>';
    }
    function render() {
      ctx.el('sq').innerHTML = squares(n);
      ctx.el('nTxt').textContent = String(n);
      ctx.el('sumTxt').textContent = sumText(n);
      h.setAttribute('transform', 'translate(' + (X0 + n * S) + ' ' + (Y0 + S / 2) + ')');
      h.setAttribute('aria-valuenow', String(n));
      h.setAttribute('aria-valuetext', n + ' ריבועים, ' + (3 * n + 1) + ' גפרורים');
      box.querySelector('[data-n]').textContent = String(n);
      renderTable();
      ctx.caption(m(sumText(n)));
    }
    function setN(v) {
      v = clamp(v, 1, 6);
      if (v === n) {
        ctx.sfx('error');
        ctx.note(v === 6 ? 'זה הציור הגדול ביותר כאן: ' + m('n = 6') + '. אפשר גם להסיר ריבועים.' : 'זה כבר הציור הראשון: ריבוע אחד, ' + m('4') + ' גפרורים.');
        return;
      }
      var grew = v > n;
      n = v;
      if (n > maxN) maxN = n;
      ctx.sfx('tick');
      render();
      if (grew && n >= 2) {
        ctx.note('נוספו רק ' + m('3') + ' גפרורים ולא ' + m('4') + ': הריבוע החדש נשען על הצלע של הקודם. עכשיו יש ' + m(String(3 * n + 1)) + ' גפרורים.', 'good');
      } else if (!grew) {
        ctx.note('הסרנו ' + m('3') + ' גפרורים: נשארו ' + m(String(3 * n + 1)) + '.');
      }
      if (maxN >= 5 && n >= 5 && !doneOnce) {
        doneOnce = true;
        ctx.sfx('correct'); ctx.burst(16);
        ctx.note('ציור ' + m('5') + ' בנוי: ' + m(sumText(5)) + '. בכל צעד נוספו ' + m('3') + ' גפרורים. זהו ההפרש הקבוע של הסדרה.', 'good');
        ctx.solved();
      }
    }
    box.querySelectorAll('[data-act]').forEach(function (bt) {
      bt.addEventListener('click', function () { setN(n + Number(bt.getAttribute('data-act'))); });
    });
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Home') { e.preventDefault(); setN(1); return; }
      if (e.key === 'End') { e.preventDefault(); setN(6); return; }
      var d = keyDelta(e);
      if (!d) return;
      e.preventDefault();
      setN(n + d);
    });
    ctx.drag(ctx.svg, {
      move: function (x) { setN(Math.round((x - X0) / S)); }
    });
    render();
    ctx.note('ציור ' + m('1') + ' הוא ריבוע אחד: ' + m('4') + ' גפרורים. הוסף ריבועים עד ציור ' + m('5') + ' וראה כמה גפרורים נוספים בכל פעם.');
  }
  /* ---------- scene 2: assemble a·n + b ---------- */
  function formulaScene(ctx) {
    var a = 1, b = 0, doneOnce = false, touched = false;
    var ACT = [4, 7, 10, 13, 16];
    var CX = function (i) { return 44 + i * 62; };
    ctx.draw('<g id="tb"></g>');
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>ההפרש בין איברים סמוכים</b><span class="math" dir="ltr" style="color:' + NEW + '">+3</span></div>'
      + '<div><b>הנוסחה שלך</b><span class="math" dir="ltr" data-v="f" style="color:' + BLUE + '"></span></div></div>'
      + '<div class="stepper" dir="ltr" style="align-self:stretch;gap:8px;margin-top:8px">'
      + [['a', BLUE, 'a', 'ההפרש'], ['b', WOOD, 'b', 'ההתחלה']].map(function (it) {
        return '<div class="unit" dir="ltr" style="gap:5px;padding:6px 6px"><bdi class="math var" dir="ltr" style="color:' + it[1] + '">' + it[0] + '</bdi>'
          + '<button type="button" data-key="' + it[0] + '" data-delta="-1" aria-label="הקטן את ' + it[3] + ' ב־1">−</button>'
          + '<bdi class="var math" dir="ltr" data-value="' + it[0] + '" style="min-width:34px" aria-live="polite"></bdi>'
          + '<button type="button" data-key="' + it[0] + '" data-delta="1" aria-label="הגדל את ' + it[3] + ' ב־1">+</button></div>';
      }).join('') + '</div>');
    ctx.register('controls', box);
    function rows() {
      var s = '', i, okAll = 0;
      for (i = 0; i < 5; i++) {
        var n = i + 1, v = a * n + b, good = v === ACT[i];
        if (good) okAll++;
        var x = CX(i);
        s += '<rect x="' + (x - 26) + '" y="14" width="52" height="34" rx="8" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>' + numT(x, 38, 20, BLUE, n);
        s += '<rect x="' + (x - 26) + '" y="62" width="52" height="34" rx="8" fill="#fff" stroke="' + INK + '" stroke-width="2"/>' + numT(x, 86, 20, INK, ACT[i]);
        s += '<rect x="' + (x - 26) + '" y="140" width="52" height="34" rx="8" fill="' + (good ? PAL.goodSoft : '#fde8ec') + '" stroke="' + (good ? GOOD : BAD) + '" stroke-width="2.5"/>'
          + numT(x, 164, 20, good ? GOOD : BAD, f(v));
        s += hebT(x, 206, 22, good ? GOOD : BAD, good ? '✓' : '✗');
        if (i < 4) s += numT(x + 31, 114, 14, NEW, '+3');
      }
      s += hebT(394, 36, 14, MUTED, 'ציור', 'end') + hebT(394, 84, 14, MUTED, 'גפרורים', 'end')
        + hebT(394, 162, 14, MUTED, 'הנוסחה', 'end') + hebT(394, 206, 14, MUTED, 'התאמה', 'end');
      ctx.el('tb').innerHTML = s;
      return okAll;
    }
    function feedback(okAll) {
      var e = m(expr(a, b));
      if (a === 3 && b === 1) {
        ctx.note('כל חמש השורות מתאימות: ' + m('3\u00B7n + 1') + '. ההפרש ' + m('3') + ' הוא המקדם של ' + m('n') + ', וה־' + m('1') + ' הוא הגפרור הבודד שבצד שמאל.', 'good');
      } else if (a === 3) {
        ctx.note('הפרש נכון אבל ההתחלה לא מתאימה: ' + m('a = 3') + ' נכון, ובציור ' + m('1') + ' הנוסחה נותנת ' + m(String(3 + b)) + ' ולא ' + m('4') + '. שנה את ' + m('b') + '.');
      } else if (b === 1) {
        ctx.note('ההתחלה נכונה אבל ההפרש לא: בין שני ציורים סמוכים נוספים ' + m('3') + ' גפרורים, ואילו הנוסחה שלך מוסיפה ' + m(String(a)) + '. שנה את ' + m('a') + '.');
      } else if (a + b === 4) {
        ctx.note(e + ' נותן ' + m('4') + ' בציור הראשון בלבד. ציור ' + m('2') + ' צריך להיות ' + m('7') + ', והנוסחה נותנת ' + m(String(2 * a + b)) + '. בדוק את כל השורות, לא רק את הראשונה.');
      } else {
        ctx.note('הנוסחה ' + e + ' מתאימה ל־' + m(String(okAll)) + ' מתוך ' + m('5') + ' שורות. מצא קודם את ההפרש בין איברים סמוכים, ואז את ההתחלה.');
      }
    }
    function render() {
      var okAll = rows();
      box.querySelector('[data-value="a"]').textContent = f(a);
      box.querySelector('[data-value="b"]').textContent = f(b);
      box.querySelector('[data-v="f"]').textContent = expr(a, b);
      ctx.caption(m(expr(a, b)));
      return okAll;
    }
    function set(key, delta) {
      if (key === 'a') a = clamp(a + delta, 0, 6); else b = clamp(b + delta, -3, 6);
      touched = true;
      ctx.sfx('tick');
      var okAll = render();
      feedback(okAll);
      if (a === 3 && b === 1 && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    box.querySelectorAll('[data-delta]').forEach(function (bt) {
      bt.addEventListener('click', function () { set(bt.getAttribute('data-key'), Number(bt.getAttribute('data-delta'))); });
    });
    render();
    ctx.note('בטבלה ' + m('+3') + ' בין כל שני איברים. קבע את ' + m('a') + ' ואת ' + m('b') + ' עד שהנוסחה ' + m('a\u00B7n + b') + ' תתאים לכל שורה.');
  }
  /* ---------- scene 3: use the rule in both directions ---------- */
  function useScene(ctx) {
    var TASKS = [
      { kind: 'term', n: 50 },
      { kind: 'mem', x: 100, yes: true, k: 33 },
      { kind: 'mem', x: 120, yes: false },
      { kind: 'mem', x: 301, yes: true, k: 100 }
    ];
    var TERM_OPTS = [150, 153, 151, 54];
    var TERM_WHY = [
      'שכחת את ה־' + m('+1') + ': ' + m('3\u00B750 = 150') + ' הוא רק החלק הראשון של הנוסחה.',
      'כפלת ' + m('3\u00B7(50 + 1)') + '. הכפל חל על ' + m('n') + ' בלבד, וה־' + m('1') + ' מתווסף אחריו.',
      '',
      'חיברת ' + m('3 + 50 + 1') + '. צריך להכפיל: ' + m('3\u00B750') + ' ואז להוסיף ' + m('1') + '.'
    ];
    var t = 0, answered = false, doneOnce = false, wrongSet = {};
    ctx.draw('<g id="sc"></g>');
    var box = ctx.extra('<div id="prompt" style="text-align:center;font-weight:800;line-height:1.7;margin-bottom:8px"></div>'
      + '<div id="choices" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center"></div>'
      + '<div style="display:flex;justify-content:center;margin-top:8px"><button type="button" id="cn" hidden></button></div>');
    var BST = 'min-height:44px;min-width:44px;padding:8px 14px;border-radius:12px;border:2px solid ' + PAL.line
      + ';background:#fff;color:' + INK + ';font-family:Secular One,Heebo,sans-serif;font-size:17px;cursor:pointer';
    var choices = box.querySelector('#choices');
    var cn = box.querySelector('#cn');
    cn.style.cssText = BST + ';background:' + PAL.main + ';color:#fff;border-color:' + PAL.main;
    var btns = [];
    for (var i = 0; i < 4; i++) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.id = 'c' + i;
      bt.style.cssText = BST;
      (function (k, el) { el.addEventListener('click', function () { choose(k); }); }(i, bt));
      choices.appendChild(bt);
      btns.push(bt);
    }
    ctx.register('controls', box);
    function strip(val, nTxt, ok) {
      var s = '';
      [[1, 4], [2, 7], [3, 10]].forEach(function (p, i) {
        var x = 50 + i * 70;
        s += '<rect x="' + (x - 28) + '" y="52" width="56" height="44" rx="9" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>'
          + numT(x, 83, 20, INK, p[1]) + numT(x, 40, 15, BLUE, p[0]);
      });
      s += numT(268, 83, 26, MUTED, '…');
      s += numT(342, 40, 15, BLUE, nTxt)
        + '<rect x="302" y="52" width="80" height="44" rx="9" fill="' + (ok ? PAL.goodSoft : '#fdf0d8') + '" stroke="' + (ok ? GOOD : PAL.warm) + '" stroke-width="2.5"/>'
        + numT(342, 83, 20, ok ? GOOD : INK, val);
      return s;
    }
    function draw() {
      var T = TASKS[t], s;
      if (T.kind === 'term') {
        s = strip(answered ? '151' : '?', '50', answered)
          + numT(201, 160, 22, INK, answered ? '3\u00B750 + 1 = 151' : '3\u00B750 + 1 = ?');
      } else {
        var shown = answered && T.yes ? String(T.k) : '?';
        s = strip(String(T.x), shown === '?' ? 'n = ?' : 'n = ' + shown, answered && T.yes);
        var line = '3\u00B7n + 1 = ' + T.x;
        if (answered) line = T.yes ? '3\u00B7n = ' + (T.x - 1) + '  ,  n = ' + (T.x - 1) + ' \u00F7 3 = ' + T.k : '3\u00B7n = ' + (T.x - 1) + '  ,  n = ' + (T.x - 1) + ' \u00F7 3 \u2248 39.67';
        s += numT(201, 160, 20, INK, line);
      }
      ctx.el('sc').innerHTML = s;
    }
    function render() {
      var T = TASKS[t], i;
      var p = box.querySelector('#prompt');
      if (T.kind === 'term') {
        p.innerHTML = 'מצא את האיבר במקום ה־' + bdi('50') + ' בסדרה שהכלל שלה ' + bdi('3\u00B7n + 1');
        for (i = 0; i < 4; i++) { btns[i].hidden = false; btns[i].textContent = String(TERM_OPTS[i]); }
      } else {
        p.innerHTML = 'האם המספר ' + bdi(String(T.x)) + ' נמצא בסדרה ' + bdi('3\u00B7n + 1') + '? (משימה ' + bdi((t) + ' מתוך 3') + ')';
        btns[0].hidden = false; btns[1].hidden = false; btns[2].hidden = true; btns[3].hidden = true;
        btns[0].textContent = 'כן, הוא בסדרה';
        btns[1].textContent = 'לא, הוא לא בסדרה';
        btns[0].style.fontFamily = btns[1].style.fontFamily = 'Heebo,sans-serif';
      }
      for (i = 0; i < 4; i++) {
        btns[i].disabled = false;
        btns[i].style.opacity = '1';
        btns[i].style.background = '#fff';
        btns[i].style.borderColor = PAL.line;
        btns[i].removeAttribute('aria-disabled');
      }
      if (T.kind === 'term') for (i = 0; i < 4; i++) btns[i].style.fontFamily = 'Secular One,sans-serif';
      cn.hidden = true;
      draw();
      ctx.caption(m('3\u00B7n + 1'));
    }
    function choose(k) {
      var T = TASKS[t];
      if (answered || wrongSet[t + ':' + k]) return;
      var right = T.kind === 'term' ? TERM_OPTS[k] === 151 : (k === 0) === T.yes;
      if (!right) {
        wrongSet[t + ':' + k] = true;
        btns[k].disabled = true;
        btns[k].setAttribute('aria-disabled', 'true');
        btns[k].style.opacity = '.55';
        btns[k].style.background = '#fde8ec';
        ctx.sfx('error');
        if (T.kind === 'term') ctx.note(TERM_WHY[k]);
        else if (T.x === 100) ctx.note('חסר ' + m('1') + ' מהמספר: ' + m('100 \u2212 1 = 99') + ', ו־' + m('99') + ' מתחלק ב־' + m('3') + ' בדיוק. לכן יש מקום שלם בסדרה.');
        else if (T.x === 120) ctx.note('שים לב: ' + m('120') + ' מתחלק ב־' + m('3') + ', אבל צריך לבדוק את ' + m('120 \u2212 1 = 119') + '. האם ' + m('119') + ' מתחלק ב־' + m('3') + ' בלי שארית?');
        else ctx.note('חסר ' + m('1') + ' קודם: ' + m('301 \u2212 1 = 300') + ', ו־' + m('300 \u00F7 3 = 100') + ' הוא מספר שלם. לכן ' + m('301') + ' כן בסדרה.');
        return;
      }
      answered = true;
      ctx.sfx('correct');
      btns.forEach(function (b) { b.disabled = true; });
      btns[k].style.background = PAL.goodSoft;
      btns[k].style.borderColor = GOOD;
      draw();
      if (T.kind === 'term') ctx.note('נכון: ' + m('3\u00B750 + 1 = 150 + 1 = 151') + '. לא היה צריך לבנות 50 ציורים, הנוסחה קופצת ישר למקום.', 'good');
      else if (T.yes) ctx.note('נכון: ' + m('3\u00B7n + 1 = ' + T.x) + ' נותן ' + m('n = ' + T.k) + ', מקום שלם. המספר ' + m(String(T.x)) + ' הוא האיבר ה־' + m(String(T.k)) + '.', 'good');
      else ctx.note('נכון: ' + m('3\u00B7n = 119') + ', ו־' + m('119 \u00F7 3') + ' אינו מספר שלם (הוא בין ' + m('39') + ' ל־' + m('40') + '). אין מקום כזה בסדרה.', 'good');
      if (t === TASKS.length - 1) {
        if (!doneOnce) { doneOnce = true; ctx.burst(16); ctx.solved(); }
      } else {
        cn.hidden = false;
        cn.textContent = 'למשימה הבאה ←';
        cn.focus();
      }
    }
    cn.addEventListener('click', function () {
      if (t >= TASKS.length - 1) return;
      t++;
      answered = false;
      ctx.sfx('click');
      render();
      var T = TASKS[t];
      ctx.note(T.kind === 'mem' ? 'בדוק אם יש מקום שלם: חסר ' + m('1') + ' מהמספר וחלק ב־' + m('3') + '.' : '');
      btns[0].focus();
    });
    render();
    ctx.note('הכלל ' + m('3\u00B7n + 1') + ' עובד בשני הכיוונים: ממקום לאיבר, ומאיבר בחזרה למקום. קודם האיבר ה־' + m('50') + '.');
  }
  var steps = [
    {
      mode: 'intro',
      tA: 'ציידי החוקיות',
      sub: 'שורה של ריבועי גפרורים שגדלה לפי כלל, ואיבר כללי שמתאר את כולה.',
      tip: 'שלום, אני אליהו. היום נצוד את הכלל שמסתתר מאחורי סדרה, ונכתוב אותו בנוסחה אחת.',
      emoji: '🔁',
      eq: m('a\u00B7n + b'),
      note: 'בסדרה שגדלה באותו מספר בכל צעד, ' + m('n') + ' הוא מספר המקום, ' + m('a') + ' הוא ההפרש הקבוע, ו־' + m('b') + ' נקבע לפי האיבר הראשון. בעזרת הנוסחה אפשר למצוא איבר רחוק ולבדוק אם מספר שייך לסדרה.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'בונים את הציורים',
      sub: 'הוסף ריבועים בגרירה, בכפתורי הפלוס והמינוס או בחיצים, ועקוב אחרי הטבלה.',
      tip: 'גרור את העיגול, לחץ על הפלוס או השתמש בחיצים. בנה עד ציור ' + m('5') + ' וראה כמה גפרורים נוספים בכל פעם.',
      cue: 'בנה את ציור 5',
      cueDone: 'ציור 5 בנוי. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 220],
      alt: 'שורה של ריבועים שבנויים מגפרורים. הריבוע האחרון מסומן באדום כדי להראות שלושה גפרורים חדשים, ועיגול בקצה הימני שאפשר להזיז כדי להוסיף או להסיר ריבועים',
      nudge: { target: 'controls', text: 'לחץ על הפלוס כדי להוסיף ריבוע, ועקוב אחרי הטבלה.' },
      setup: buildScene
    },
    {
      mode: 'quiz',
      tA: 'מנחשים כלל משני איברים',
      sub: 'שני האיברים הראשונים של סדרה הם ' + m('2') + ' ו־' + m('4') + '. דנה אומרת: "ברור, תמיד מוסיפים 2". מה נכון?',
      tip: 'שני איברים הם מעט מאוד מידע. כמה סדרות שונות מתחילות ב־' + m('2, 4') + '?',
      btn: 'המשך ←',
      aspect: [402, 200],
      alt: 'שני ריבועים עם המספרים 2 ו־4 וסימני שאלה במקום האיבר השלישי',
      setup: function (ctx) {
        var s = '';
        [2, 4].forEach(function (v, i) {
          var x = 90 + i * 100;
          s += '<rect x="' + (x - 34) + '" y="50" width="68" height="52" rx="10" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>' + numT(x, 85, 24, INK, v);
        });
        s += '<rect x="256" y="50" width="68" height="52" rx="10" fill="#fdf0d8" stroke="' + PAL.warm + '" stroke-width="2" stroke-dasharray="6 4"/>' + numT(290, 85, 26, MUTED, '?');
        s += numT(201, 160, 18, MUTED, '2 , 4 , ?');
        ctx.draw(s);
      },
      win: 'נכון. שני איברים לא מספיקים כדי לקבוע כלל.',
      wrongSay: 'שאל את עצמך: האם אפשר לחשוב על עוד סדרה שמתחילה ב־' + m('2, 4') + '?',
      opts: [
        { t: 'האיבר השלישי הוא ' + m('8') + ', כי מכפילים ב־' + m('2'), f: 'גם זה ניחוש מתוך שני איברים. ' + m('2, 4, 8') + ' אפשרית, אבל ' + m('2, 4, 6') + ' אפשרית באותה מידה.' },
        { t: 'האיבר השלישי הוא ' + m('6') + ', כי תמיד מוסיפים ' + m('2'), f: 'לא "תמיד": הסדרה ' + m('2, 4, 8') + ' מתחילה בדיוק כך ולא מוסיפה ' + m('2') + '. זו רק אפשרות אחת.' },
        { t: 'שני איברים לא קובעים כלל: ' + m('2, 4, 6') + ' ו־' + m('2, 4, 8') + ' מתחילות אותו דבר', c: true, f: 'נכון: כדי להכריז על כלל צריך לבדוק עוד איברים, או לדעת איך הסדרה נבנית.' },
        { t: 'האיבר השלישי חייב להיות ' + m('7') + ', כי ההפרש גדל', f: 'גם זו אפשרות (' + m('2, 4, 7') + '), אבל לא "חייב". אין דרך לדעת משני איברים.' }
      ],
      hints: [
        'שאל: האם יש רק סדרה אחת שמתחילה ב־' + m('2, 4') + '?',
        'נסה להמציא שתי סדרות שונות שמתחילות באותם שני איברים.',
        m('2, 4, 6') + ' ו־' + m('2, 4, 8') + '. מה זה אומר על ניחוש משני איברים?'
      ]
    },
    {
      mode: 'scene',
      tA: 'בונים את האיבר הכללי',
      sub: 'קבע את ' + m('a') + ' ואת ' + m('b') + ' בכפתורי הפלוס והמינוס עד שהנוסחה מתאימה לכל שורה בטבלה.',
      tip: 'מצא קודם את ההפרש בין איברים סמוכים, ואז את ההתחלה. הנוסחה צריכה להתאים לכל חמש השורות.',
      cue: 'קבע a ו־b כך שכל השורות מתאימות',
      cueDone: 'הנוסחה מתאימה לכל השורות. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 224],
      alt: 'טבלה של חמישה ציורים: מספר הציור, מספר הגפרורים בפועל, הערך שהנוסחה שלך נותנת וסימן התאמה. בין האיברים מסומן ההפרש של שלושה',
      nudge: { target: 'controls', text: 'שנה את ' + m('a') + ' או את ' + m('b') + ' בכפתורים ובדוק כמה שורות מתאימות.' },
      setup: formulaScene
    },
    {
      mode: 'quiz',
      tA: 'כפל לפני חיבור',
      sub: 'האיבר הכללי של סדרה הוא ' + m('2\u00B7n + 5') + '. מהו האיבר במקום ה־' + m('4') + '?',
      tip: 'הצב את ' + m('4') + ' במקום ' + m('n') + ', וזכור: כפל לפני חיבור.',
      btn: 'המשך ←',
      aspect: [402, 170],
      alt: 'הנוסחה 2 כפול n ועוד 5 מוצגת בתוך מסגרת',
      setup: function (ctx) {
        ctx.draw('<rect x="76" y="40" width="250" height="64" rx="14" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>'
          + numT(201, 84, 30, INK, '2\u00B7n + 5') + numT(201, 144, 18, MUTED, 'n = 4'));
      },
      win: 'נכון. כפלת ' + m('2\u00B74 = 8') + ' ואז הוספת ' + m('5') + '.',
      wrongSay: 'כפל קודם: כמה זה ' + m('2\u00B74') + '? ורק אחר כך מוסיפים.',
      opts: [
        { t: m('13'), c: true, f: 'נכון: ' + m('2\u00B74 + 5 = 8 + 5 = 13') + '. כפל קודם, חיבור אחריו.' },
        { t: m('18'), f: 'חישבת ' + m('2\u00B7(4 + 5)') + ', כאילו הכפל חל גם על ה־' + m('5') + '. אבל הנוסחה היא ' + m('2\u00B7n + 5') + ': רק ' + m('n') + ' מוכפל.' },
        { t: m('11'), f: 'חיברת ' + m('2 + 4 + 5') + ' במקום להכפיל. הסימן בין ' + m('2') + ' ל־' + m('n') + ' הוא כפל.' },
        { t: m('9'), f: 'חיברת ' + m('4 + 5') + ' ושכחת את ' + m('2') + '. המקדם ' + m('2') + ' מכפיל את ' + m('n') + '.' }
      ],
      hints: [
        'בביטוי ' + m('2\u00B7n + 5') + ' מה מוכפל ב־' + m('2') + '?',
        'קודם הכפל: ' + m('2\u00B74') + '. אחר כך מוסיפים את ' + m('5') + '.',
        m('8 + 5') + ' שווה כמה?'
      ]
    },
    {
      mode: 'scene',
      tA: 'הכלל בשני הכיוונים',
      sub: 'הכלל ' + m('3\u00B7n + 1') + ': מצא איבר רחוק ובדוק אם מספרים שייכים לסדרה.',
      tip: 'קודם מהמקום אל האיבר. אחר כך חזרה: מספר שייך לסדרה רק אם המקום שלו הוא מספר שלם.',
      cue: 'סיים את ארבע המשימות',
      cueDone: 'כל המשימות הושלמו. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 190],
      alt: 'שלושת האיברים הראשונים 4, 7, 10 ושלוש נקודות, ובקצה ריבוע עם האיבר שמחפשים או מספר שבודקים אם שייך לסדרה',
      nudge: { target: 'controls', text: 'בחר תשובה. אפשר גם לעבור בין הכפתורים עם המקש Tab.' },
      setup: useScene
    },
    {
      mode: 'quiz',
      tA: 'המקום הוא לא האיבר הראשון',
      sub: 'בסדרה ' + m('7, 11, 15, 19, ...') + ' האיבר הראשון הוא ' + m('7') + '. מהו האיבר במקום ה־' + m('10') + '?',
      tip: 'בכל צעד מוסיפים ' + m('4') + '. כמה צעדים עוברים מהאיבר הראשון עד המקום העשירי?',
      btn: 'המשך ←',
      aspect: [402, 190],
      alt: 'סדרה של ארבעה איברים: 7, 11, 15, 19 ושלוש נקודות',
      setup: seqPicture(['7', '11', '15', '19'], 'n = 1 , 2 , 3 , 4'),
      win: 'נכון. הנוסחה היא ' + m('4\u00B7n + 3') + ', ולכן ' + m('4\u00B710 + 3 = 43') + '.',
      wrongSay: 'שים לב: ' + m('n') + ' הוא מספר המקום. איזה מספר מוסיפים ל־' + m('4\u00B7n') + ' כדי לקבל ' + m('7') + ' במקום הראשון?',
      opts: [
        { t: m('47'), f: 'הוספת ' + m('10') + ' קפיצות של ' + m('4') + ' אל ' + m('7') + '. אבל עד המקום העשירי יש רק ' + m('9') + ' קפיצות: ' + m('7 + 4\u00B79 = 43') + '.' },
        { t: m('43'), c: true, f: 'נכון: ' + m('7 + 9\u00B74 = 43') + ', וגם ' + m('4\u00B710 + 3 = 43') + '. ב־' + m('4\u00B7n + 3') + ' הבדיקה למקום הראשון היא ' + m('4 + 3 = 7') + '.' },
        { t: m('40'), f: 'כפלת ' + m('4\u00B710') + ' ושכחת את ההתחלה. בציור הראשון הנוסחה צריכה לתת ' + m('7') + ', ו־' + m('4\u00B71') + ' נותן רק ' + m('4') + '.' },
        { t: m('39'), f: 'הצבת ' + m('9') + ' בנוסחה ' + m('4\u00B7n + 3') + ', כאילו המקום העשירי הוא ' + m('n = 9') + '. המקום העשירי הוא ' + m('n = 10') + '.' }
      ],
      hints: [
        'מצא את ההפרש, ואז בדוק מה ' + m('b') + ' כדי שהמקום הראשון יתן ' + m('7') + '.',
        'ההפרש ' + m('4') + ', ולכן ' + m('4\u00B7n + b') + ' במקום ' + m('1') + ' נותן ' + m('4 + b = 7') + '.',
        m('b = 3') + ', ועכשיו ' + m('n = 10') + ' בנוסחה.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'קבוע או מכפיל',
      sub: 'איזו סדרה גדלה באותו הפרש בכל צעד, כך שאפשר לכתוב לה איבר כללי ' + m('a\u00B7n + b') + '?',
      tip: 'חשב את ההפרשים בין איברים סמוכים. אם הם לא שווים, אין נוסחה מהצורה ' + m('a\u00B7n + b') + '.',
      btn: 'לסיכום ←',
      aspect: [402, 170],
      alt: 'ארבע סדרות אפשריות מוצגות בתשובות למטה',
      setup: function (ctx) {
        ctx.draw(numT(201, 80, 22, INK, 'a\u00B7n + b') + numT(201, 120, 15, MUTED, '+d , +d , +d'));
      },
      win: 'נכון. ' + m('5, 8, 11, 14') + ' גדלה ב־' + m('3') + ' בכל צעד, ולכן ' + m('3\u00B7n + 2') + '.',
      wrongSay: 'חשב את ההפרשים: האם הם אותו מספר בכל צעד?',
      opts: [
        { t: m('2, 4, 8, 16'), f: 'כל איבר כפול מהקודם: ההפרשים ' + m('2, 4, 8') + ' משתנים. זו סדרה מכפילה, לא ' + m('a\u00B7n + b') + '.' },
        { t: m('5, 8, 11, 14'), c: true, f: 'נכון: ההפרשים ' + m('3, 3, 3') + ', והאיבר הכללי הוא ' + m('3\u00B7n + 2') + '.' },
        { t: m('3, 6, 12, 24'), f: 'שני האיברים הראשונים ' + m('3, 6') + ' מרמזים על הפרש ' + m('3') + ', אבל אחר כך ההפרשים ' + m('6') + ' ו־' + m('12') + '. הסדרה מכפילה.' },
        { t: m('1, 4, 9, 16'), f: 'הפרשים ' + m('3, 5, 7') + ' גדלים. אלה ריבועים ' + m('n\u00B2') + ', לא ' + m('a\u00B7n + b') + '.' }
      ],
      hints: [
        'חשב את ההפרש בין כל שני איברים סמוכים בכל סדרה.',
        'בסדרה שמתאימה ל־' + m('a\u00B7n + b') + ' כל ההפרשים שווים.',
        'חפש סדרה שבה ההפרש הוא אותו מספר שלוש פעמים.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת לצוד חוקיות',
      sub: 'ציורים, טבלה, ונוסחה אחת שמתארת את כל הסדרה.',
      tip: 'כל הכבוד. בסדרה עם הפרש קבוע, מוצאים את ההפרש, מבררים את ההתחלה וכותבים את הנוסחה.',
      cue: 'אפשר לתרגל או לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'בסדרה שגדלה בהפרש קבוע כל איבר נקבע לפי המקום שלו:',
      formula: m('a\u00B7n + b') + ' · ' + m('a') + ' הפרש, ' + m('n') + ' מקום'
    }
  ];
  window.NoamGame.boot({
    slug: 'chukiyot-vedfusim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'שני איברים לא קובעים כלל', math: '2, 4, ?' },
      { step: 4, name: 'כפל לפני חיבור באיבר הכללי', math: '2\u00B7n + 5' },
      { step: 6, name: 'מקום ואיבר ראשון', math: '4\u00B7n + 3' },
      { step: 7, name: 'הפרש קבוע או מכפיל', math: '5, 8, 11, 14' }
    ],
    bonus: {
      label: 'מכונת הסדרות 🔁',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל ארבעה איברים ראשונים ומצא את a ואת b.',
      setup: function (box, ctx) {
        var q = null, ga = 1, gb = 0;
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          q = { a: rnd(2, 6), b: rnd(-3, 8) };
          if (q.b === 0) q.b = 2;
          ga = 1; gb = 0;
        }
        box.innerHTML = '<div class="bTitle">מכונת הסדרות</div>'
          + '<div class="bSub">הנה ארבעת האיברים הראשונים. מצא את ההפרש ' + bdi('a') + ' ואת ' + bdi('b') + ' שבאיבר הכללי.</div>'
          + '<div class="bChip" data-chip dir="ltr"></div>'
          + '<div class="stepper" dir="ltr" style="gap:8px">'
          + [['a', 'ההפרש'], ['b', 'ההתחלה']].map(function (it) {
            return '<div class="unit" dir="ltr" style="gap:5px;padding:6px 6px"><bdi class="math var" dir="ltr">' + it[0] + '</bdi>'
              + '<button type="button" data-k="' + it[0] + '" data-d="-1" aria-label="הקטן את ' + it[1] + '">−</button>'
              + '<bdi class="var math" dir="ltr" data-g="' + it[0] + '" style="min-width:32px" aria-live="polite"></bdi>'
              + '<button type="button" data-k="' + it[0] + '" data-d="1" aria-label="הגדל את ' + it[1] + '">+</button></div>';
          }).join('') + '</div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">🎲 סדרה חדשה</button>';
        var chip = box.querySelector('[data-chip]');
        var ok = box.querySelector('[data-ok]');
        var forms = box.querySelector('[data-forms]');
        function draw() {
          var t = [1, 2, 3, 4].map(function (n) { return f(q.a * n + q.b); });
          chip.textContent = t.join(' , ') + ' , \u2026';
          box.querySelector('[data-g="a"]').textContent = f(ga);
          box.querySelector('[data-g="b"]').textContent = f(gb);
          ok.hidden = true;
          forms.hidden = true;
        }
        box.querySelectorAll('[data-d]').forEach(function (bt) {
          bt.addEventListener('click', function () {
            var d = Number(bt.getAttribute('data-d'));
            if (bt.getAttribute('data-k') === 'a') ga = clamp(ga + d, 0, 9); else gb = clamp(gb + d, -6, 12);
            ctx.sfx('click');
            draw();
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          ok.hidden = false;
          if (ga === q.a && gb === q.b) {
            ctx.sfx('correct');
            ok.style.color = PAL.good;
            ok.textContent = 'נכון! ההפרש הוא ' + q.a + ' וההתחלה ' + f(q.b) + '.';
            forms.hidden = false;
            forms.innerHTML = '<div dir="ltr">' + (q.a + q.b) + ' = ' + q.a + '\u00B71 + ' + (q.b < 0 ? '(' + f(q.b) + ')' : q.b) + '</div><div dir="ltr">n \u2192 ' + expr(q.a, q.b) + '</div>';
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            forms.hidden = true;
            if (ga === q.a) ok.textContent = 'ההפרש נכון, אבל ההתחלה לא מתאימה: בדוק את האיבר הראשון.';
            else if (gb === q.b) ok.textContent = 'ההתחלה נכונה, אבל ההפרש לא: חסר שני איברים סמוכים.';
            else ok.textContent = 'נסה שוב: ההפרש הוא מה שנוסף בין איברים סמוכים, ואז בדוק את האיבר הראשון.';
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); draw(); });
        roll();
        draw();
      }
    }
  });
}());
