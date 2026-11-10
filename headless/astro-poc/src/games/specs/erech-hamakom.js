/**
 * ערך המקום והמספר העשרוני — an engine game.
 *
 * The idea: when you multiply or divide by ten, the decimal point never moves.
 * The digits are the ones that slide to another column. Once you see the
 * columns, you can also build a decimal from tenths and hundredths and compare
 * two decimals on a number line.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef';
  var FONT = 'Secular One, sans-serif';

  /** Text of a decimal given in hundredths (45 -> "0.45", 50 -> "0.5", 100 -> "1"). */
  function dec(h) {
    if (h === 0) return '0';
    if (h === 100) return '1';
    return String(h / 100);
  }

  /* ---------- step 1: the place value board ---------- */
  var COLS = [60, 122, 184, 280, 342];          // hundreds, tens, ones, tenths, hundredths
  var COL_NAMES = ['מאות', 'עשרות', 'יחידות', 'עשיריות', 'מאיות'];
  var POINT_X = 232;

  function colAt(i) {
    var lo = Math.max(0, Math.min(COLS.length - 2, Math.floor(i)));
    return COLS[lo] + (COLS[lo + 1] - COLS[lo]) * (i - lo);
  }

  function boardScene(ctx) {
    var p = 0, busy = false, done = false;
    var svg = '';
    var i;
    for (i = 0; i < COLS.length; i++) {
      svg += '<rect x="' + (COLS[i] - 30) + '" y="70" width="60" height="150" rx="10"'
        + ' fill="' + (i % 2 ? '#ffffff' : SOFT) + '" stroke="' + LINE + '" stroke-width="1.6"/>'
        + '<text x="' + COLS[i] + '" y="60" font-size="14" text-anchor="middle" fill="' + INK + '"'
        + ' font-family="' + FONT + '">' + COL_NAMES[i] + '</text>';
    }
    svg += '<line x1="' + POINT_X + '" y1="70" x2="' + POINT_X + '" y2="236" stroke="' + INK + '"'
      + ' stroke-width="2" stroke-dasharray="5 5"/>'
      + '<circle cx="' + POINT_X + '" cy="190" r="8" fill="' + INK + '"/>'
      + '<text x="' + POINT_X + '" y="256" font-size="13" text-anchor="middle" fill="' + INK + '"'
      + ' font-family="' + FONT + '">הנקודה נשארת כאן</text>'
      + '<text id="z0" x="' + COLS[2] + '" y="196" font-size="72" text-anchor="middle" fill="' + LINE + '"'
      + ' font-family="' + FONT + '" opacity="0">0</text>'
      + '<text id="d4" x="' + COLS[2] + '" y="196" font-size="72" text-anchor="middle" fill="' + MAIN + '"'
      + ' font-family="' + FONT + '">4</text>'
      + '<text id="d7" x="' + COLS[3] + '" y="196" font-size="72" text-anchor="middle" fill="' + WARM + '"'
      + ' font-family="' + FONT + '">7</text>';
    ctx.draw(svg);

    function place(q) {
      ctx.el('d4').setAttribute('x', colAt(2 - q));
      ctx.el('d7').setAttribute('x', colAt(3 - q));
    }
    var CAP = { '-1': '4.7 ÷ 10 = 0.47', '0': '4.7', '1': '4.7 × 10 = 47', '2': '4.7 × 10 × 10 = 470' };

    var mul = ctx.button('כפול בעשר ×10', function () { go(1); }, { target: 'mul' });
    var div = ctx.button('חלק בעשר ÷10', function () { go(-1); }, { ghost: true, target: 'div' });
    ctx.register('mul', mul);
    ctx.register('div', div);

    function refresh() {
      mul.disabled = busy || p >= 2;
      div.disabled = busy || p <= -1;
      ctx.caption(m(CAP[String(p)]));
      ctx.el('z0').setAttribute('opacity', (p === 2 || p === -1) ? '1' : '0');
    }

    function go(d) {
      if (busy) return;
      var from = p;
      busy = true;
      ctx.busy(true);
      ctx.sfx('click');
      ctx.el('z0').setAttribute('opacity', '0');
      mul.disabled = true;
      div.disabled = true;
      ctx.tween(650, function (l) {
        place(from + d * window.NoamGame.ez(l));
      }).then(function () {
        p = from + d;
        busy = false;
        ctx.busy(false);
        place(p);
        refresh();
        if (p === 2) {
          if (!done) {
            done = true;
            ctx.sfx('correct');
            ctx.burst(16);
            ctx.note('הגעת ל־' + m('470') + '. שים לב: הנקודה לא זזה בכלל, והספרות עברו שתי עמודות. '
              + 'האפס ביחידות שומר את המקום.', 'good');
            ctx.say('הספרות זזו, לא הנקודה. ככה כופלים בעשר.', { mood: 'happy', attn: true });
            ctx.solved();
          }
        } else if (p === -1) {
          ctx.note('חילקת בעשר, והספרות זזו עמודה אחת ימינה. עכשיו יש ' + m('0.47') + '. הנקודה נשארה במקומה.');
        } else if (p === 1) {
          ctx.note('כל ספרה זזה עמודה אחת שמאלה. ' + m('4') + ' כבר בעשרות. הנקודה נשארה במקומה.');
        } else {
          ctx.note('הספרות ' + m('4') + ' ו־' + m('7') + ' חזרו למקום המקורי. הנקודה לא זזה.');
        }
      });
    }

    ctx.note('הספרה ' + m('4') + ' ביחידות והספרה ' + m('7') + ' בעשיריות. אתה רואה את ' + m('4.7') + '.');
    refresh();
  }

  /* ---------- step 3: build a decimal from a hundred squares ---------- */
  function buildScene(ctx) {
    var CS = 20, OX = 101, OY = 56;
    var filled = [];
    var done = false;
    var i, c, r;
    for (i = 0; i < 100; i++) filled.push(false);

    var svg = '<rect x="' + (OX - 3) + '" y="' + (OY - 3) + '" width="' + (CS * 10 + 6) + '" height="' + (CS * 10 + 6) + '"'
      + ' rx="6" fill="#ffffff" stroke="' + INK + '" stroke-width="2"/><g id="cells">';
    for (c = 0; c < 10; c++) {
      for (r = 0; r < 10; r++) {
        svg += '<rect id="c' + (c * 10 + r) + '" x="' + (OX + c * CS + 1) + '" y="' + (OY + r * CS + 1) + '"'
          + ' width="' + (CS - 2) + '" height="' + (CS - 2) + '" rx="3" fill="' + SOFT + '"'
          + ' stroke="' + LINE + '" stroke-width="1" style="cursor:pointer"/>';
      }
    }
    svg += '</g>';
    for (c = 0; c < 10; c++) {
      var tx = OX + c * CS + CS / 2;
      svg += '<polygon id="t' + c + '" points="' + (tx - 7) + ',38 ' + (tx + 7) + ',38 ' + tx + ',50"'
        + ' fill="' + LINE + '" style="cursor:pointer"/>'
        + '<rect id="tt' + c + '" x="' + (tx - 10) + '" y="34" width="20" height="18" fill="transparent"'
        + ' style="cursor:pointer"/>';
    }
    svg += '<text x="' + (OX + CS * 5) + '" y="272" font-size="12" text-anchor="middle" fill="' + INK + '"'
      + ' font-family="' + FONT + '">כל הריבוע הוא שלם אחד</text>';
    ctx.draw(svg);

    var strip = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>רצועות (עשיריות)</b><span data-s>0</span></div>'
      + '<div><b>משבצות (מאיות)</b><span data-l>0</span></div>'
      + '<div><b>המספר שבנית</b><span data-n dir="ltr">0</span></div>'
      + '</div>'
    );
    ctx.register('grid', ctx.el('cells'));

    function colFull(cc) {
      for (var k = 0; k < 10; k++) if (!filled[cc * 10 + k]) return false;
      return true;
    }

    function render() {
      var count = 0, S = 0, cc, k;
      for (cc = 0; cc < 10; cc++) {
        var full = colFull(cc);
        if (full) S++;
        for (k = 0; k < 10; k++) {
          var on = filled[cc * 10 + k];
          if (on) count++;
          ctx.el('c' + (cc * 10 + k)).setAttribute('fill', on ? (full ? MAIN : WARM) : SOFT);
        }
        ctx.el('t' + cc).setAttribute('fill', full ? MAIN : LINE);
      }
      var L = count - S * 10;
      strip.querySelector('[data-s]').textContent = String(S);
      strip.querySelector('[data-l]').textContent = String(L);
      strip.querySelector('[data-n]').textContent = dec(count);
      ctx.caption(m(dec(count)));
      if (count === 35) {
        if (!done) {
          done = true;
          ctx.sfx('correct');
          ctx.burst(18);
          ctx.say('שלוש עשיריות וחמש מאיות הן ' + m('0.35') + '. בנית את זה בעצמך.', { mood: 'happy', attn: true });
          ctx.solved();
        }
        ctx.note('בדיוק ' + m('0.35') + '. זה ' + m('35') + ' משבצות מתוך מאה, כלומר שלוש עשיריות ועוד חמש מאיות.', 'good');
      } else if (!done) {
        ctx.note('עכשיו צבעת ' + m(String(count)) + ' משבצות מתוך מאה. זה ' + m(dec(count)) + '. צריך ' + m('0.35') + '.');
      } else {
        ctx.note('עכשיו זה ' + m(dec(count)) + '. אפשר לחזור ל־' + m('0.35') + ' או להמשיך הלאה.', 'good');
      }
    }

    function toggleCell(idx) {
      filled[idx] = !filled[idx];
      ctx.sfx('tick');
      render();
    }
    function toggleCol(cc) {
      var v = !colFull(cc);
      for (var k = 0; k < 10; k++) filled[cc * 10 + k] = v;
      ctx.sfx('click');
      render();
    }
    for (i = 0; i < 100; i++) {
      (function (idx) {
        ctx.el('c' + idx).addEventListener('click', function () { toggleCell(idx); });
      }(i));
    }
    for (c = 0; c < 10; c++) {
      (function (cc) {
        ctx.el('tt' + cc).addEventListener('click', function () { toggleCol(cc); });
        ctx.el('t' + cc).addEventListener('click', function () { toggleCol(cc); });
      }(c));
    }
    ctx.button('נקה הכול', function () {
      for (var k = 0; k < 100; k++) filled[k] = false;
      ctx.sfx('click');
      render();
    }, { ghost: true });
    render();
  }

  /* ---------- step 5: compare two decimals on a number line ---------- */
  function lineScene(ctx) {
    var X0 = 40, LEN = 320, AY = 130;
    var vA = 20, vB = 80, active = null, done = false;
    function xOf(h) { return X0 + LEN * h / 100; }
    function lensX(h) { return 60 + (h - 40) * 2.8; }

    var svg = '<polygon points="' + xOf(40) + ',138 ' + xOf(50) + ',138 340,196 60,196"'
      + ' fill="' + WARM_SOFT + '" stroke="' + WARM + '" stroke-width="1.4"/>'
      + '<rect x="' + xOf(40) + '" y="123" width="' + (xOf(50) - xOf(40)) + '" height="14" fill="' + WARM + '" opacity="0.45"/>'
      + '<line x1="' + X0 + '" y1="' + AY + '" x2="' + (X0 + LEN) + '" y2="' + AY + '" stroke="' + INK + '"'
      + ' stroke-width="3" stroke-linecap="round"/>';
    var j;
    for (j = 0; j <= 10; j++) {
      svg += '<line x1="' + xOf(j * 10) + '" y1="' + (AY - 8) + '" x2="' + xOf(j * 10) + '" y2="' + (AY + 8) + '"'
        + ' stroke="' + INK + '" stroke-width="2"/>'
        + '<text x="' + xOf(j * 10) + '" y="' + (AY + 26) + '" font-size="12" text-anchor="middle" fill="' + INK + '"'
        + ' font-family="' + FONT + '">' + (j === 0 ? '0' : (j === 10 ? '1' : '0.' + j)) + '</text>';
    }
    svg += '<text x="200" y="178" font-size="11.5" text-anchor="middle" fill="' + INK + '"'
      + ' font-family="' + FONT + '">מגדלת: עשירית חתוכה לעשר מאיות</text>'
      + '<rect x="60" y="196" width="280" height="32" rx="4" fill="#ffffff" stroke="' + WARM + '" stroke-width="2"/>';
    for (j = 0; j <= 10; j++) {
      svg += '<line x1="' + (60 + j * 28) + '" y1="' + (j === 0 || j === 10 ? 196 : 204) + '" x2="' + (60 + j * 28) + '" y2="228"'
        + ' stroke="' + INK + '" stroke-width="1.5"/>'
        + '<text x="' + (60 + j * 28) + '" y="246" font-size="9.5" text-anchor="middle" fill="' + INK + '"'
        + ' font-family="' + FONT + '">' + ((40 + j) / 100).toFixed(2) + '</text>';
    }
    svg += '<circle id="lA" cx="60" cy="214" r="8" fill="' + MAIN + '" opacity="0"/>'
      + '<text id="lAt" x="60" y="218" font-size="10" text-anchor="middle" fill="#fff" font-family="' + FONT + '" opacity="0">א</text>'
      + '<circle id="lB" cx="60" cy="214" r="8" fill="' + WARM + '" opacity="0"/>'
      + '<text id="lBt" x="60" y="218" font-size="10" text-anchor="middle" fill="#fff" font-family="' + FONT + '" opacity="0">ב</text>'
      + '<circle cx="86" cy="52" r="12" fill="' + MAIN + '"/>'
      + '<text x="86" y="57" font-size="14" text-anchor="middle" fill="#fff" font-family="' + FONT + '">א</text>'
      + '<text id="rA" x="106" y="58" font-size="20" fill="' + MAIN + '" font-family="' + FONT + '">0.2</text>'
      + '<circle cx="246" cy="52" r="12" fill="' + WARM + '"/>'
      + '<text x="246" y="57" font-size="14" text-anchor="middle" fill="#fff" font-family="' + FONT + '">ב</text>'
      + '<text id="rB" x="266" y="58" font-size="20" fill="' + WARM + '" font-family="' + FONT + '">0.8</text>'
      + '<g id="dB" style="cursor:ew-resize"><circle id="dBc" cx="' + xOf(vB) + '" cy="' + AY + '" r="13" fill="' + WARM + '" stroke="#fff" stroke-width="2"/>'
      + '<text id="dBt" x="' + xOf(vB) + '" y="' + (AY + 5) + '" font-size="14" text-anchor="middle" fill="#fff" font-family="' + FONT + '" pointer-events="none">ב</text></g>'
      + '<g id="dA" style="cursor:ew-resize"><circle id="dAc" cx="' + xOf(vA) + '" cy="' + AY + '" r="13" fill="' + MAIN + '" stroke="#fff" stroke-width="2"/>'
      + '<text id="dAt" x="' + xOf(vA) + '" y="' + (AY + 5) + '" font-size="14" text-anchor="middle" fill="#fff" font-family="' + FONT + '" pointer-events="none">א</text></g>'
      + '<rect id="hit" x="20" y="92" width="362" height="72" fill="transparent" style="cursor:ew-resize"/>';
    ctx.draw(svg);
    ctx.register('dots', ctx.el('hit'));

    function setDot(key, h) {
      var x = xOf(h);
      ctx.el('d' + key + 'c').setAttribute('cx', x);
      ctx.el('d' + key + 't').setAttribute('x', x);
      ctx.el('r' + key).textContent = dec(h);
      var inLens = h >= 40 && h <= 50;
      var lx = lensX(Math.max(40, Math.min(50, h)));
      ctx.el('l' + key).setAttribute('cx', lx);
      ctx.el('l' + key + 't').setAttribute('x', lx);
      ctx.el('l' + key).setAttribute('opacity', inLens ? '1' : '0');
      ctx.el('l' + key + 't').setAttribute('opacity', inLens ? '1' : '0');
    }

    function describe() {
      if (vA === vB) {
        ctx.note('שתי הנקודות באותו מקום, אז המספרים שווים. גרור אחת מהן.');
        return;
      }
      var big = vA > vB ? vA : vB, small = vA > vB ? vB : vA;
      var txt = m(dec(big)) + ' נמצא ימינה מ־' + m(dec(small)) + ' על הציר, ולכן הוא הגדול יותר.';
      if (!done) txt += ' מקם את ' + 'א' + ' על ' + m('0.5') + ' ואת ב על ' + m('0.45') + '.';
      ctx.note(txt);
    }

    ctx.drag(ctx.el('hit'), {
      start: function (x) {
        active = Math.abs(x - xOf(vA)) <= Math.abs(x - xOf(vB)) ? 'A' : 'B';
        var h = Math.max(0, Math.min(100, Math.round((x - X0) * 100 / LEN)));
        if (active === 'A') vA = h; else vB = h;
        setDot(active, h);
        describe();
      },
      move: function (x) {
        if (!active) return;
        var h = Math.max(0, Math.min(100, Math.round((x - X0) * 100 / LEN)));
        var cur = active === 'A' ? vA : vB;
        if (h !== cur) {
          if (active === 'A') vA = h; else vB = h;
          ctx.sfx('tick');
          setDot(active, h);
          describe();
        }
      },
      end: function () {
        active = null;
        if (done || vA !== 50 || vB !== 45) return;
        done = true;
        ctx.sfx('correct');
        ctx.burst(18);
        ctx.note('ראית בזכוכית המגדלת: ' + m('0.5') + ' הוא ' + m('0.50') + ', חמש עשיריות שלמות. '
          + m('0.45') + ' הוא ארבע עשיריות וחמש מאיות. לכן ' + m('0.5') + ' גדול יותר.', 'good');
        ctx.say('ארבעים וחמש מאיות פחות מחמישים מאיות. אורך המספר לא קובע.', { mood: 'happy', attn: true });
        ctx.solved();
      }
    });

    setDot('A', vA);
    setDot('B', vB);
    ctx.caption(m('0.5 > 0.45'));
    ctx.note('גרור את ' + 'א' + ' ל־' + m('0.5') + ' ואת ב ל־' + m('0.45') + '. הנקודות קופצות בקפיצות של מאית.');
  }

  /** The place value board as a still picture for a question. */
  function boardStill(ctx) {
    var svg = '';
    var i;
    for (i = 0; i < COLS.length; i++) {
      svg += '<rect x="' + (COLS[i] - 30) + '" y="70" width="60" height="150" rx="10"'
        + ' fill="' + (i % 2 ? '#ffffff' : SOFT) + '" stroke="' + LINE + '" stroke-width="1.6"/>'
        + '<text x="' + COLS[i] + '" y="60" font-size="14" text-anchor="middle" fill="' + INK + '"'
        + ' font-family="' + FONT + '">' + COL_NAMES[i] + '</text>';
    }
    svg += '<circle cx="' + POINT_X + '" cy="190" r="8" fill="' + INK + '"/>'
      + '<text x="' + COLS[2] + '" y="196" font-size="72" text-anchor="middle" fill="' + MAIN + '" font-family="' + FONT + '">2</text>'
      + '<text x="' + COLS[3] + '" y="196" font-size="72" text-anchor="middle" fill="' + LINE + '" font-family="' + FONT + '">0</text>'
      + '<text x="' + COLS[4] + '" y="196" font-size="72" text-anchor="middle" fill="' + WARM + '" font-family="' + FONT + '">7</text>';
    ctx.draw(svg);
  }

  /** A hundred square with a given count shaded, as the picture of a question. */
  function squareStill(ctx) {
    var CS = 20, OX = 101, OY = 50, svg = '', c, r;
    for (c = 0; c < 10; c++) {
      for (r = 0; r < 10; r++) {
        svg += '<rect x="' + (OX + c * CS + 1) + '" y="' + (OY + r * CS + 1) + '" width="' + (CS - 2) + '" height="' + (CS - 2) + '"'
          + ' rx="3" fill="' + (c < 5 ? MAIN : (c === 5 && r < 6 ? WARM : SOFT)) + '" stroke="' + LINE + '" stroke-width="1"/>';
      }
    }
    ctx.draw(svg);
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'מי באמת זז? ', tM: '4.7 × 10', tB: ' = ?',
      sub: 'כשכופלים או מחלקים בעשר, לא הנקודה זזה. הספרות זזות.',
      tip: 'שלום, אני אליהו. כולם אומרים שהנקודה זזה. בוא נבדוק מי באמת זז.',
      emoji: '🔢',
      eq: m('4.7 × 10 = 47'),
      note: 'אליהו יראה לך איך הספרות עוברות בין העמודות, איך בונים מספר עשרוני, ואיך משווים שני מספרים.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'הספרות עוברות עמודה',
      sub: 'לחץ על הכפתורים וראה מה זז ומה נשאר במקומו.',
      tip: 'לפניך לוח ערך מקום עם המספר ' + m('4.7') + '. כפול אותו בעשר פעמיים, ותראה מי זז.',
      cue: 'הגע ל־470',
      cueDone: 'ראית את זה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'לוח ערך מקום עם עמודות מאות, עשרות, יחידות, עשיריות ומאיות והספרות 4 ו־7',
      nudge: { target: 'mul', text: 'לחץ על כפול בעשר.' },
      setup: boardScene
    },
    {
      mode: 'quiz',
      tA: 'כמה הם ', tM: '3.4 × 10', tB: '?',
      sub: 'כל ספרה זזה עמודה אחת שמאלה, והנקודה נשארת.',
      tip: 'חשוב על הלוח. הספרה ' + m('3') + ' עוברת לעשרות והספרה ' + m('4') + ' עוברת ליחידות.',
      btn: 'המשך ←',
      win: 'נכון. הספרות זזו עמודה, והתוצאה היא ' + m('34') + '.',
      wrongSay: 'תחשוב על הספרות. לאן עוברת כל אחת מהן?',
      opts: [
        { t: '34', c: true, f: 'ה־' + m('3') + ' עברה לעשרות וה־' + m('4') + ' עברה ליחידות, ולכן ' + m('34') + '.' },
        { t: '3.40', f: 'הוספת אפס בסוף, אבל זה לא משנה את הערך. הספרות צריכות לעבור עמודה.' },
        { t: '30.4', f: 'רק הספרה ' + m('3') + ' זזה. הספרה ' + m('4') + ' נשארה בעשיריות, וזה לא נכון.' },
        { t: '0.34', f: 'הספרות זזו ימינה, כמו בחילוק בעשר. בכפל הן זזות שמאלה.' }
      ],
      hints: [
        'כפל בעשר מגדיל את המספר, אז הספרות עוברות לעמודות גדולות יותר.',
        'ה־' + m('4') + ' הייתה בעשיריות. היא עוברת ליחידות.'
      ]
    },
    {
      mode: 'scene',
      tA: 'בונים מספר עשרוני',
      sub: 'צבע רצועות של עשיריות ומשבצות של מאיות ושים לב מה נכתב.',
      tip: 'הריבוע הזה הוא שלם אחד, והוא חתוך למאה משבצות קטנות. בנה בו את ' + m('0.35') + '.',
      cue: 'בנה את 0.35',
      cueDone: 'בנית אותו. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ריבוע של עשר על עשר משבצות שאפשר לצבוע, שמייצג שלם אחד',
      nudge: { target: 'grid', text: 'לחץ על משבצות, או על החץ מעל עמודה כדי לצבוע רצועה שלמה.' },
      setup: buildScene
    },
    {
      mode: 'quiz',
      tA: 'מה ערך הספרה ', tM: '7', tB: ' במספר ' + m('2.07') + '?',
      sub: 'שים לב באיזו עמודה היא יושבת.',
      tip: 'הספרה ' + m('7') + ' במספר ' + m('2.07') + ' יושבת אחרי האפס. באיזו עמודה היא?',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'לוח ערך מקום עם המספר 2.07',
      setup: boardStill,
      win: 'נכון. שבע מאיות, כלומר ' + m('0.07') + '.',
      wrongSay: 'ספור עמודות אחרי הנקודה. העמודה הראשונה היא עשיריות.',
      opts: [
        { t: m('7') + ' מאיות', c: true, f: 'אחרי הנקודה העמודה השנייה היא מאיות, ולכן הערך הוא ' + m('0.07') + '.' },
        { t: m('7') + ' עשיריות', f: 'שבע עשיריות היו ' + m('0.7') + '. כאן יש אפס בעשיריות, ו־' + m('7') + ' בעמודה הבאה.' },
        { t: m('7') + ' יחידות', f: 'היחידות הן לפני הנקודה, ושם יושבת הספרה ' + m('2') + '.' },
        { t: '70', f: 'ערך הספרה לא יכול להיות גדול מהמספר כולו. כאן המספר קטן מ־' + m('3') + '.' }
      ],
      hints: [
        'אחרי הנקודה: עשיריות, ואז מאיות.',
        'בין הנקודה לבין ה־' + m('7') + ' יש רק את הספרה ' + m('0') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מי גדול יותר על הציר?',
      sub: 'גרור את שתי הנקודות למקומן והשתמש בזכוכית המגדלת.',
      tip: 'אצל מספרים עשרוניים לא מספיק להסתכל על האורך. בוא נשים אותם על ציר.',
      cue: 'גרור את א אל 0.5 ואת ב אל 0.45',
      cueDone: 'מצוין. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ציר מספרים בין 0 ל־1 עם שתי נקודות נגררות וזכוכית מגדלת שמחלקת את הקטע בין 0.4 ל־0.5 למאיות',
      nudge: { target: 'dots', text: 'גרור את אחת הנקודות לאורך הציר.' },
      setup: lineScene
    },
    {
      mode: 'quiz',
      tA: 'איזה מספר גדול יותר?',
      sub: m('0.5') + ' או ' + m('0.45') + '?',
      tip: 'אל תשאל איזה מספר ארוך יותר. שאל איזה מהם רחוק יותר מאפס.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ריבוע של מאה משבצות שבו חמישים משבצות צבועות',
      setup: squareStill,
      win: 'בדיוק. ' + m('0.5') + ' זה ' + m('0.50') + ', ו־' + m('50') + ' מאיות גדולות מ־' + m('45') + ' מאיות.',
      wrongSay: 'כתוב את ' + m('0.5') + ' בתור ' + m('0.50') + ' ותשווה מאיות.',
      opts: [
        { t: m('0.5') + ' גדול יותר', c: true, f: m('0.5 = 0.50') + ', וחמישים מאיות גדולות מארבעים וחמש מאיות.' },
        { t: m('0.45') + ' גדול יותר', f: 'ארבעים וחמש גדול מחמש, אבל כאן מדובר במאיות מול עשיריות. ' + m('0.45') + ' קטן מחצי.' },
        { t: 'הם שווים', f: m('0.5') + ' הוא חצי שלם, ו־' + m('0.45') + ' חסר חמש מאיות לחצי.' },
        { t: 'אי אפשר לדעת', f: 'אפשר. מספיק להשוות בעמודה אחת, עשיריות ואז מאיות.' }
      ],
      hints: [
        'כתוב את שני המספרים עם אותו מספר ספרות אחרי הנקודה.',
        m('0.5 = 0.50') + '. עכשיו השווה ' + m('50') + ' ל־' + m('45') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'ועכשיו לחילוק: ', tM: '56 ÷ 100',
      sub: 'כשמחלקים במאה, הספרות זזות שתי עמודות ימינה.',
      tip: 'חילוק במאה הוא חילוק בעשר פעמיים. הספרות זזות שתי עמודות ימינה.',
      btn: 'לסיכום ←',
      win: 'מעולה. הספרות זזו שתי עמודות, והנקודה לא זזה.',
      wrongSay: 'מחלקים במאה, אז כל ספרה זזה שתי עמודות ימינה. בדוק איפה נגמרות הספרות.',
      opts: [
        { t: '0.56', c: true, f: 'כל ספרה זזה שתי עמודות ימינה: ה־' + m('6') + ' למאיות וה־' + m('5') + ' לעשיריות. מקבלים ' + m('0.56') + '.' },
        { t: '5.6', f: 'זה חילוק בעשר, שזז עמודה אחת. במאה זזים שתי עמודות.' },
        { t: '0.056', f: 'זה חילוק באלף, שלוש עמודות. כאן רק שתיים.' },
        { t: '5600', f: 'זה כפל במאה. בחילוק המספר קטן.' }
      ],
      hints: [
        'הנקודה נשארת במקומה. הספרות הן שזזות.',
        'שתי עמודות ימינה: ה־' + m('6') + ' למאיות וה־' + m('5') + ' לעשיריות.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את ערך המקום',
      sub: 'הנקודה העשרונית לא זזה אף פעם. הספרות עוברות בין העמודות.',
      tip: 'כל הכבוד. עכשיו אתה יודע לכפול ולחלק בעשר, לבנות עשרוניים ולהשוות ביניהם.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית:',
      formula: m('4.7 × 10 = 47') + ' ו־' + m('4.7 ÷ 10 = 0.47')
    }
  ];

  window.NoamGame.boot({
    slug: 'erech-hamakom',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'כפל בעשר', math: '3.4 × 10' },
      { step: 4, name: 'ערך הספרה', math: '2.07' },
      { step: 6, name: 'השוואת עשרוניים', math: '0.5 > 0.45' },
      { step: 7, name: 'חילוק במאה', math: '56 ÷ 100' }
    ],
    bonus: {
      label: 'מכונת הזזת הספרות 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הקובייה, חשב בראש לאן עוברות הספרות, ואז בדוק.',
      setup: function (box, ctx) {
        var ops = [
          { sym: '× 10', s: 1 }, { sym: '× 100', s: 2 },
          { sym: '÷ 10', s: -1 }, { sym: '÷ 100', s: -2 }
        ];
        var d = 34, e = 1, op = ops[0], open = false;

        /** Digits d with e places after the point, shifted by s columns to the left. */
        function fmt(dd, ee) {
          var s = String(dd), z = '', k;
          if (ee <= 0) {
            for (k = 0; k < -ee; k++) z += '0';
            return s + z;
          }
          while (s.length <= ee) s = '0' + s;
          return s.slice(0, s.length - ee) + '.' + s.slice(s.length - ee);
        }

        box.innerHTML = '<div class="bTitle">מכונת הזזת הספרות</div>'
          + '<div class="bSub">קבל תרגיל, חשב לאן עוברות הספרות, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<button type="button" class="bDice" data-roll>🎲 תרגיל חדש</button>'
          + '<button type="button" class="bDice" data-show>גלה את התשובה</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');

        function draw() {
          chip.textContent = fmt(d, e) + ' ' + op.sym + ' = ?';
          sol.innerHTML = '<div>' + fmt(d, e) + ' ' + op.sym + ' = ' + fmt(d, e - op.s) + '</div>'
            + '<div>' + (Math.abs(op.s) === 1 ? 'הספרות זזו עמודה אחת' : 'הספרות זזו שתי עמודות')
            + (op.s > 0 ? ' שמאלה' : ' ימינה') + '</div>';
          sol.hidden = !open;
        }

        box.querySelector('[data-roll]').addEventListener('click', function () {
          do { d = 12 + Math.floor(Math.random() * 87); } while (d % 10 === 0);
          e = Math.floor(Math.random() * 3);
          op = ops[Math.floor(Math.random() * ops.length)];
          open = false;
          ctx.sfx('click');
          draw();
        });
        box.querySelector('[data-show]').addEventListener('click', function () {
          open = !open;
          ctx.sfx(open ? 'correct' : 'click');
          draw();
        });
        draw();
      }
    }
  });
}());
