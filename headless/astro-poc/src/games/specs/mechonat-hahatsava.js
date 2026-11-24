/**
 * מכונת ההצבה — an engine game about variables, algebraic expressions and substitution.
 *
 * Scene 1 builds an expression from a short story with blocks (drag, tap, buttons, keys).
 * Scene 2 is a substitution machine on a number line that shows the order of operations.
 * Scene 3 compares 3x, x³, 2x², (2x)², −x² and (−x)² by substituting the same x.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink, MAIN = PAL.main, SOFT = PAL.soft, LINE = PAL.line;
  var WARM = PAL.warm, WARM_SOFT = PAL.warmSoft, GOOD = PAL.good, GOOD_SOFT = PAL.goodSoft;
  var BAD = '#b91c1c', MUTED = '#475569';
  var MINUS = '\u2212';
  var NUM = 'font-family="Secular One, sans-serif" direction="ltr"';
  var HEB = 'font-family="Heebo, sans-serif"';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  /** A number as displayed: real minus sign. */
  function sg(n) { return n < 0 ? MINUS + Math.abs(n) : String(n); }
  /** A number inside an expression: negatives in parentheses. */
  function par(n) { return n < 0 ? '(' + MINUS + Math.abs(n) + ')' : String(n); }
  function numText(x, y, size, fill, id, anchor, text) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle')
      + '" ' + NUM + ' font-size="' + size + '" fill="' + fill + '">' + (text || '') + '</text>';
  }
  function hebText(x, y, size, fill, anchor, text, id) {
    /* the drawing is right-to-left, so Hebrew text-anchor start is the right edge */
    if (anchor === 'end') anchor = 'start';
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle')
      + '" ' + HEB + ' font-size="' + size + '" font-weight="700" fill="' + fill + '">' + text + '</text>';
  }
  function stepperHtml(unitLabel) {
    return '<div class="stepper" dir="ltr"><div class="unit" dir="ltr">'
      + '<button type="button" dir="ltr" id="xMinus" aria-label="הקטן את x ב־1">\u22121</button>'
      + '<span dir="rtl" style="font:700 13px Heebo,sans-serif;color:' + INK + '">' + unitLabel + '</span>'
      + '<button type="button" dir="ltr" id="xPlus" aria-label="הגדל את x ב־1">+1</button></div></div>';
  }
  /* ---------- the number-line slider shared by scenes 2 and 3 ---------- */
  var TX0 = 41, TW = 320;
  function trackX(v, lo, hi) { return TX0 + (v - lo) / (hi - lo) * TW; }
  function sliderMarkup(lo, hi, y, label) {
    var out = '<line x1="' + TX0 + '" y1="' + y + '" x2="' + (TX0 + TW) + '" y2="' + y + '" stroke="' + LINE
      + '" stroke-width="6" stroke-linecap="round"/>';
    for (var v = lo; v <= hi; v++) {
      out += '<line x1="' + trackX(v, lo, hi) + '" y1="' + (y - 7) + '" x2="' + trackX(v, lo, hi) + '" y2="' + (y + 7)
        + '" stroke="' + (v === 0 ? INK : LINE) + '" stroke-width="' + (v === 0 ? 3 : 2) + '"/>'
        + numText(trackX(v, lo, hi), y + 36, 14, v === 0 ? INK : MUTED, '', 'middle', sg(v));
    }
    out += '<g id="knob" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + lo
      + '" aria-valuemax="' + hi + '" aria-valuenow="0" aria-valuetext="0">'
      + '<rect x="-34" y="-34" width="68" height="68" fill="transparent" style="cursor:grab"/>'
      + '<circle r="17" fill="' + MAIN + '" stroke="' + INK + '" stroke-width="2.5" style="pointer-events:none"/>'
      + '<text id="knobTxt" y="5" text-anchor="middle" ' + NUM + ' font-size="14" fill="#ffffff" style="pointer-events:none"></text>'
      + '</g>';
    return out;
  }
  /** Wires drag, keys and the two stepper buttons. All of them end in set(value, final). */
  function wireSlider(ctx, strip, lo, hi, getX, set) {
    var knob = ctx.el('knob');
    ctx.register('knob', knob);
    knob.addEventListener('keydown', function (event) {
      var step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (event.key === 'Home') { event.preventDefault(); set(lo, true); return; }
      if (event.key === 'End') { event.preventDefault(); set(hi, true); return; }
      if (!step) return;
      event.preventDefault();
      set(clamp(getX() + step, lo, hi), true);
    });
    ctx.drag(knob, {
      start: function () {},
      move: function (px) { set(clamp(Math.round(lo + (px - TX0) / TW * (hi - lo)), lo, hi), false); },
      end: function () { set(getX(), true); }
    });
    strip.querySelector('#xMinus').addEventListener('click', function () { set(clamp(getX() - 1, lo, hi), true); });
    strip.querySelector('#xPlus').addEventListener('click', function () { set(clamp(getX() + 1, lo, hi), true); });
  }
  function moveKnob(ctx, lo, hi, y, x) {
    var knob = ctx.el('knob');
    knob.setAttribute('transform', 'translate(' + trackX(x, lo, hi) + ' ' + y + ')');
    knob.setAttribute('aria-valuenow', x);
    knob.setAttribute('aria-valuetext', sg(x));
    ctx.el('knobTxt').textContent = sg(x);
  }
  /* ---------- scene 1: from a story to an expression ---------- */
  var ROUNDS = [
    {
      story: 'חולצה אחת עולה ' + m('x') + ' שקלים. קונים ' + m('3') + ' חולצות, ועל המשלוח משלמים עוד ' + m('5')
        + ' שקלים. כתוב ביטוי למחיר כל הקנייה.',
      pool: ['3', 'x', '+', '5', MINUS],
      ok: ['3x+5', '5+3x'],
      good: 'נכון! ' + m('3x') + ' הוא מחיר שלוש חולצות (שלוש פעמים ' + m('x') + ') ו־' + m('+ 5') + ' הוא המשלוח, שמשלמים פעם אחת. לחץ על "הסיפור הבא".',
      notes: {
        '3+x': m('3 + x') + ' הוא ' + m('3') + ' ועוד ' + m('x') + ': חולצה אחת ועוד שלושה שקלים. שלוש חולצות במחיר ' + m('x') + ' כל אחת הן ' + m('3x') + ', כלומר ' + m('3 \u00B7 x') + ', בלי סימן חיבור.',
        '3+x+5': m('3 + x') + ' הוא ' + m('3') + ' ועוד ' + m('x') + ': חולצה אחת ועוד שלושה שקלים. שלוש חולצות במחיר ' + m('x') + ' כל אחת הן ' + m('3x') + ', בלי סימן חיבור.',
        'x3': 'כשמספר כופל אות כותבים קודם את המספר: ' + m('3x') + ', לא ' + m('x3') + '. וגם עוד לא הוספת את המשלוח.',
        'x3+5': 'כשמספר כופל אות כותבים קודם את המספר: ' + m('3x') + ', לא ' + m('x3') + '.',
        '3x': 'יש כבר את מחיר שלוש החולצות, אבל המשלוח עוד לא נכנס. מוסיפים אותו בחיבור.',
        '3x\u22125': 'המשלוח הוא תוספת למחיר ולא הנחה: משלמים ' + m('5') + ' שקלים יותר, לכן חיבור ולא חיסור.',
        'x+5': m('x + 5') + ' הוא חולצה אחת ועוד משלוח. אבל קונים ' + m('3') + ' חולצות, ולכן צריך ' + m('3x') + '.',
        '5x+3': m('5x') + ' הוא חמש חולצות. המספר שלפני ה־' + m('x') + ' הוא מספר החולצות, ' + m('3') + '. המשלוח ' + m('5') + ' נכתב בנפרד.',
        '3x5': 'בין ' + m('3x') + ' ל־' + m('5') + ' חסר סימן פעולה. המשלוח נוסף למחיר.'
      },
      fallback: 'עוד לא. שאל את עצמך: כמה חולצות קונים? כמה עולה כל אחת? ומה משלמים פעם אחת בלבד?'
    },
    {
      story: 'בכיתה יש ' + m('n') + ' ילדים. כל ילד מקבל ' + m('4') + ' סוכריות, ואחר כך המורה לוקחת בחזרה ' + m('2')
        + ' סוכריות. כתוב ביטוי למספר הסוכריות שנשארו.',
      pool: ['4', 'n', '+', MINUS, '2'],
      ok: ['4n\u22122', '\u22122+4n'],
      good: 'נכון! ' + m('4n') + ' הוא כל הסוכריות שחולקו, ו־' + m('\u2212 2') + ' הן אלה שנלקחו בחזרה. יש לך ביטוי לכל סיפור.',
      notes: {
        '2\u22124n': m('2 \u2212 4n') + ' מחסיר את הסוכריות של כל הילדים מ־' + m('2') + '. בסיפור מחסירים ' + m('2') + ' מתוך ' + m('4n') + ', כלומר ' + m('4n \u2212 2') + '.',
        '4n+2': 'המורה לוקחת סוכריות בחזרה, לא מוסיפה. לכן ' + m('4n \u2212 2') + ' ולא ' + m('4n + 2') + '.',
        '4+n': 'כל ילד מקבל ' + m('4') + ' סוכריות, לכן ' + m('4') + ' פעמים ' + m('n') + ', כלומר ' + m('4n') + '. ' + m('4 + n') + ' הוא חיבור.',
        '4+n\u22122': 'כל ילד מקבל ' + m('4') + ' סוכריות, לכן ' + m('4') + ' פעמים ' + m('n') + ', כלומר ' + m('4n') + '. ' + m('4 + n') + ' הוא חיבור.',
        'n4': 'כשמספר כופל אות כותבים קודם את המספר: ' + m('4n') + ', לא ' + m('n4') + '.',
        'n4\u22122': 'כשמספר כופל אות כותבים קודם את המספר: ' + m('4n') + ', לא ' + m('n4') + '.',
        '4n': 'חולקו ' + m('4n') + ' סוכריות, אבל המורה לקחה ' + m('2') + ' בחזרה. עוד לא הכנסת אותן.',
        '4n2': 'בין ' + m('4n') + ' ל־' + m('2') + ' חסר סימן פעולה: מחסירים את ' + m('2') + '.'
      },
      fallback: 'עוד לא. כמה סוכריות חולקו בסך הכול (כל ילד ' + m('4') + ')? ומה קרה אחר כך, הוספה או הורדה?'
    }
  ];
  function showExpr(toks) {
    var out = '';
    toks.forEach(function (t, i) {
      if (t === '+' || t === MINUS) out += i === 0 ? t : ' ' + t + ' ';
      else out += t;
    });
    return out;
  }
  function storyScene(ctx) {
    var rnd = 0, toks = [], solvedRound = [false, false], finished = false;
    var CX = [49, 125, 201, 277, 353], PY = 172, MAXT = 5;
    var svgHtml = hebText(390, 26, 15, MUTED, 'end', 'הביטוי שלך')
      + '<rect x="21" y="38" width="360" height="74" rx="16" fill="#ffffff" stroke="' + MAIN + '" stroke-width="2.5"/>'
      + hebText(201, 83, 15, MUTED, 'middle', 'לחץ או גרור בלוקים לכאן', 'barHint')
      + numText(201, 92, 40, INK, 'barTxt', 'middle', '')
      + hebText(390, 140, 15, MUTED, 'end', 'בלוקים לבחירה');
    CX.forEach(function (cx, i) {
      svgHtml += '<g id="tok' + i + '" tabindex="0" role="button" aria-label="" transform="translate(' + cx + ' ' + PY + ')">'
        + '<rect x="-34" y="-32" width="68" height="64" fill="transparent" style="cursor:grab"/>'
        + '<rect x="-28" y="-24" width="56" height="48" rx="12" fill="' + WARM_SOFT + '" stroke="' + WARM
        + '" stroke-width="2.5" style="pointer-events:none"/>'
        + '<text id="tokT' + i + '" y="9" text-anchor="middle" ' + NUM + ' font-size="28" fill="' + INK
        + '" style="pointer-events:none"></text></g>';
    });
    ctx.draw(svgHtml);
    var box = ctx.extra('<div id="storyBox" style="background:' + SOFT + ';border:1.5px solid ' + LINE
      + ';border-radius:12px;padding:10px 12px;font:600 15px/1.5 Heebo,sans-serif;color:' + INK + ';text-align:right"></div>'
      + '<div id="tray" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px" dir="ltr"></div>');
    var storyBox = box.querySelector('#storyBox'), tray = box.querySelector('#tray');
    var trayBtns = [];
    function addTok(t) {
      if (solvedRound[rnd]) {
        ctx.sfx('error');
        ctx.note('הביטוי הזה כבר נכון. לחץ על "הסיפור הבא".');
        return;
      }
      if (toks.length >= MAXT) {
        ctx.sfx('error');
        ctx.note('הביטוי מלא (חמישה בלוקים לכל היותר). מחק בלוק אחרון או נקה.');
        return;
      }
      toks.push(t);
      ctx.sfx('tick');
      render();
      ctx.note('הביטוי עכשיו: ' + m(showExpr(toks)) + '. אפשר להוסיף עוד בלוק או ללחוץ על "בדוק את הביטוי".');
    }
    function undo() {
      if (solvedRound[rnd] || !toks.length) return;
      toks.pop();
      ctx.sfx('click');
      render();
      ctx.note(toks.length ? 'מחקת בלוק. הביטוי: ' + m(showExpr(toks)) + '.' : 'הביטוי ריק. בחר בלוקים.');
    }
    function clearAll() {
      if (solvedRound[rnd]) return;
      toks = [];
      ctx.sfx('click');
      render();
      ctx.note('ניקית את הביטוי. בנה אותו מחדש לפי הסיפור.');
    }
    function render() {
      var txt = ctx.el('barTxt'), hint = ctx.el('barHint');
      txt.textContent = showExpr(toks);
      hint.setAttribute('display', toks.length ? 'none' : 'inline');
    }
    function loadRound() {
      var R = ROUNDS[rnd];
      storyBox.innerHTML = R.story;
      tray.innerHTML = '';
      trayBtns = [];
      R.pool.forEach(function (t, i) {
        ctx.el('tokT' + i).textContent = t;
        ctx.el('tok' + i).setAttribute('aria-label', 'בלוק ' + (t === MINUS ? 'מינוס' : t === '+' ? 'פלוס' : t)
          + '. Enter או חץ ימינה מוסיף לביטוי, חץ שמאלה מוחק את הבלוק האחרון');
        var b = document.createElement('button');
        b.type = 'button';
        b.id = 'tkB' + i;
        b.textContent = t;
        b.setAttribute('aria-label', 'הוסף לביטוי את ' + (t === MINUS ? 'מינוס' : t === '+' ? 'פלוס' : t));
        b.setAttribute('dir', 'ltr');
        b.style.cssText = 'min-height:44px;min-width:44px;font:400 22px "Secular One",sans-serif;color:' + INK
          + ';background:' + WARM_SOFT + ';border:2px solid ' + WARM + ';border-radius:12px;cursor:pointer';
        b.addEventListener('click', function () { addTok(R.pool[i]); });
        tray.appendChild(b);
        trayBtns.push(b);
        if (i === 0) ctx.register('tkB0', b);
      });
      render();
    }
    CX.forEach(function (cx, i) {
      var g = ctx.el('tok' + i);
      g.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          addTok(ROUNDS[rnd].pool[i]);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'Backspace') {
          event.preventDefault();
          undo();
        }
      });
      var sx = 0, sy = 0, mx = 0, my = 0;
      ctx.drag(g, {
        start: function (x, y) { sx = x; sy = y; mx = 0; my = 0; },
        move: function (x, y) {
          mx = x - sx; my = y - sy;
          g.setAttribute('transform', 'translate(' + (cx + mx) + ' ' + (PY + my) + ')');
        },
        end: function () {
          g.setAttribute('transform', 'translate(' + cx + ' ' + PY + ')');
          var moved = Math.hypot(mx, my);
          if (moved < 12 || PY + my < 135) addTok(ROUNDS[rnd].pool[i]);
        }
      });
    });
    function check() {
      var R = ROUNDS[rnd];
      var key = toks.join('');
      if (solvedRound[rnd]) {
        ctx.note('הביטוי הזה כבר נכון. לחץ על "הסיפור הבא".', 'good');
        return;
      }
      if (!toks.length) {
        ctx.sfx('error');
        ctx.note('עוד אין ביטוי. בחר בלוקים לפי הסיפור.');
        return;
      }
      var last = toks[toks.length - 1];
      if (R.ok.indexOf(key) >= 0) {
        solvedRound[rnd] = true;
        ctx.sfx('correct');
        ctx.burst(rnd === 1 ? 18 : 8);
        ctx.note(R.good, 'good');
        if (rnd === 1 && !finished) {
          finished = true;
          ctx.say('תרגמת שני סיפורים לביטויים אלגבריים. עכשיו נציב בהם מספרים.', { mood: 'happy', attn: true });
          ctx.solved();
        }
        return;
      }
      ctx.sfx('error');
      if (last === '+' || last === MINUS) {
        ctx.note('הביטוי ' + m(showExpr(toks)) + ' נגמר בסימן פעולה. אחרי הסימן צריך להיות מספר או אות.');
        return;
      }
      ctx.note(R.notes[key] || R.fallback);
    }
    ctx.button('מחק בלוק אחרון', undo, { id: 'undoBtn', ghost: true });
    ctx.button('נקה', clearAll, { id: 'clrBtn', ghost: true });
    ctx.button('בדוק את הביטוי', check, { id: 'chkBtn', target: 'chkBtn' });
    ctx.button('הסיפור הבא', function () {
      if (!solvedRound[rnd]) {
        ctx.sfx('error');
        ctx.note('קודם בנה ביטוי נכון לסיפור הזה ולחץ על "בדוק את הביטוי".');
        return;
      }
      if (rnd === 1) {
        ctx.note('כבר פתרת את שני הסיפורים. אפשר להמשיך לשלב הבא.', 'good');
        return;
      }
      rnd = 1;
      toks = [];
      ctx.sfx('click');
      loadRound();
      ctx.note('סיפור חדש, ואות חדשה: ' + m('n') + '. בנה את הביטוי.');
    }, { id: 'nextStoryBtn', ghost: true });
    loadRound();
    ctx.note('קרא את הסיפור ובנה ממנו ביטוי: גרור בלוקים לתיבה, הקש על בלוק, או לחץ על הכפתורים.');
  }
  /* ---------- scene 2: the substitution machine for 5 \u2212 2x ---------- */
  var M_LO = -5, M_HI = 5, M_Y = 84, TARGETS = [11, -1];
  /** The lines of the substitution, in the right order of operations. */
  function machineLines(x) {
    var p = par(x);
    if (x < 0) {
      return [
        ['הצבה', '5 ' + MINUS + ' 2\u00B7' + p],
        ['כפל קודם', '5 ' + MINUS + ' ' + par(2 * x)],
        ['מינוס מינוס', '5 + ' + Math.abs(2 * x)],
        ['תוצאה', sg(5 - 2 * x)]
      ];
    }
    return [
      ['הצבה', '5 ' + MINUS + ' 2\u00B7' + p],
      ['כפל קודם', '5 ' + MINUS + ' ' + (2 * x)],
      ['תוצאה', sg(5 - 2 * x)],
      ['', '']
    ];
  }
  function machineScene(ctx) {
    var x = 1, t = 0, done = false;
    var out = numText(20, 30, 24, INK, 'xNow', 'start', '')
      + hebText(392, 20, 14, MUTED, 'end', 'היעד')
      + numText(392, 48, 26, GOOD, 'tgt', 'end', '')
      + sliderMarkup(M_LO, M_HI, M_Y, 'הערך של איקס. חץ ימינה מגדיל ב־1, חץ שמאלה מקטין ב־1')
      + '<rect x="14" y="140" width="374" height="134" rx="16" fill="#ffffff" stroke="' + LINE + '" stroke-width="2"/>'
      + numText(110, 164, 15, MUTED, '', 'middle', '5 ' + MINUS + ' 2x');
    for (var i = 0; i < 4; i++) {
      out += numText(130, 196 + i * 28, 22, i === 3 ? INK : MAIN, 'ln' + i, 'middle', '')
        + hebText(380, 196 + i * 28, 13, MUTED, 'end', '', 'lb' + i);
    }
    ctx.draw(out);
    var strip = ctx.extra(stepperHtml('הערך של x'));
    var lrBtn;
    function show() {
      moveKnob(ctx, M_LO, M_HI, M_Y, x);
      ctx.el('xNow').textContent = 'x = ' + sg(x);
      ctx.el('tgt').textContent = done ? sg(TARGETS[1]) : sg(TARGETS[t]);
      var ls = machineLines(x);
      for (var i = 0; i < 4; i++) {
        ctx.el('ln' + i).textContent = ls[i][1];
        ctx.el('lb' + i).textContent = ls[i][0];
      }
      strip.querySelector('#xMinus').disabled = x <= M_LO;
      strip.querySelector('#xPlus').disabled = x >= M_HI;
    }
    function set(v, final) {
      if (v !== x) { x = v; ctx.sfx('tick'); }
      show();
      if (final) check();
    }
    function check() {
      if (done) return;
      var val = 5 - 2 * x;
      var target = TARGETS[t];
      if (val === target) {
        ctx.sfx('correct');
        if (t === 0) {
          t = 1;
          ctx.burst(8);
          show();
          ctx.note('יפה: כש־' + m('x = ' + sg(x)) + ' התוצאה היא ' + m(sg(val)) + '. שים לב: ' + m('2 \u00B7 ' + par(x) + ' = ' + sg(2 * x)) + ', ואז ' + m('5 ' + MINUS + ' ' + par(2 * x))
            + ' הופך לחיבור. יעד חדש: ' + m(sg(TARGETS[1])) + '.', 'good');
        } else {
          done = true;
          show();
          ctx.burst(18);
          ctx.note('כש־' + m('x = ' + sg(x)) + ' התוצאה היא ' + m(sg(val)) + '. שני היעדים הושגו: מציבים בסוגריים, כופלים קודם, ורק אחר כך מחסרים.', 'good');
          ctx.say('הצבת מספר חיובי ומספר שלילי ושמרת על סדר הפעולות.', { mood: 'happy', attn: true });
          ctx.solved();
        }
        return;
      }
      ctx.sfx('error');
      ctx.note('כש־' + m('x = ' + sg(x)) + ' התוצאה היא ' + m(sg(val)) + ', והיעד ' + m(sg(target)) + '. '
        + (val < target ? 'צריך תוצאה גדולה יותר: כל צעד שמאלה של ' + m('x') + ' מעלה אותה ב־' + m('2') + '.'
          : 'צריך תוצאה קטנה יותר: כל צעד ימינה של ' + m('x') + ' מוריד אותה ב־' + m('2') + '.'));
    }
    wireSlider(ctx, strip, M_LO, M_HI, function () { return x; }, set);
    lrBtn = ctx.button('חשב משמאל לימין (טעות נפוצה)', function () {
      var a = 5 - 2;
      ctx.sfx('error');
      ctx.note('משמאל לימין יוצא ' + m('5 ' + MINUS + ' 2 = 3') + ' ואז ' + m('3 \u00B7 ' + par(x) + ' = ' + sg(3 * x)) + '. זו טעות: כפל וחילוק קודמים לחיבור וחיסור. הנכון: ' + m('5 ' + MINUS + ' 2 \u00B7 ' + par(x) + ' = ' + sg(5 - 2 * x)) + '.');
      return a;
    }, { id: 'lrBtn', ghost: true });
    show();
    ctx.note('הזז את ' + m('x') + ' בגרירה, בכפתורי ' + m('\u00B11') + ' או בחיצים, וראה איך המכונה מחשבת. היעד הראשון: ' + m('11') + '.');
  }
  /* ---------- scene 3: comparing powers and signs ---------- */
  var C_LO = -4, C_HI = 4, C_Y = 66, ROW_Y = [116, 192, 268];
  var ROWS = [
    {
      tgt: 'x\u00B3 = ' + MINUS + '8', tv: -8, side: 0,
      l: ['x\u00B3', function (x) { return par(x) + '\u00B3 = ' + sg(x * x * x); }, function (x) { return x * x * x; }],
      r: ['3x', function (x) { return '3\u00B7' + par(x) + ' = ' + sg(3 * x); }, function (x) { return 3 * x; }]
    },
    {
      tgt: '(2x)\u00B2 = 64', tv: 64, side: 1,
      l: ['2x\u00B2', function (x) { return '2\u00B7' + par(x) + '\u00B2 = ' + sg(2 * x * x); }, function (x) { return 2 * x * x; }],
      r: ['(2x)\u00B2', function (x) { return '(2\u00B7' + par(x) + ')\u00B2 = ' + sg(4 * x * x); }, function (x) { return 4 * x * x; }]
    },
    {
      tgt: MINUS + 'x\u00B2 = ' + MINUS + '9', tv: -9, side: 0,
      l: [MINUS + 'x\u00B2', function (x) { return MINUS + par(x) + '\u00B2 = ' + sg(-x * x); }, function (x) { return -x * x; }],
      r: ['(' + MINUS + 'x)\u00B2', function (x) { return '(' + MINUS + par(x) + ')\u00B2 = ' + sg(x * x); }, function (x) { return x * x; }]
    }
  ];
  function rowValue(r, x) { return (r.side === 0 ? r.l : r.r)[2](x); }
  function rowHint(i, x) {
    var r = ROWS[i];
    var a = r.l[2](x), b = r.r[2](x);
    var head = 'כש־' + m('x = ' + sg(x)) + ': ' + m(r.l[0] + ' = ' + sg(a)) + ' ו־' + m(r.r[0] + ' = ' + sg(b)) + '. ';
    if (i === 0) {
      return head + m('x\u00B3') + ' הוא ' + m('x \u00B7 x \u00B7 x') + ', ולא ' + m('3 \u00B7 x') + '. היעד: ' + m(r.tgt) + '. '
        + (x >= 0 ? 'חזקה אי־זוגית של מספר שלילי נשארת שלילית, נסה ' + m('x') + ' שלילי.' : 'עוד לא הגעת ליעד, שנה את ' + m('x') + '.');
    }
    if (i === 1) {
      return head + 'ב־' + m('2x\u00B2') + ' רק ה־' + m('x') + ' בריבוע, וב־' + m('(2x)\u00B2') + ' גם ה־' + m('2') + ' בריבוע, ולכן התוצאה גדולה פי ' + m('4') + '. היעד: ' + m(r.tgt) + '.';
    }
    return head + 'ב־' + m(MINUS + 'x\u00B2') + ' מעלים בריבוע רק את ' + m('x') + ' ואז הופכים סימן. ב־' + m('(' + MINUS + 'x)\u00B2') + ' הסוגריים מרבעים גם את המינוס. היעד: ' + m(r.tgt) + '.';
  }
  function rowWin(i, x) {
    var r = ROWS[i];
    var a = r.l[2](x), b = r.r[2](x);
    if (i === 0) {
      return m('x\u00B3 = ' + r.l[1](x)) + ', אבל ' + m('3x = ' + sg(b)) + '. חזקה היא כפל חוזר: ' + m('(' + MINUS + '2) \u00B7 (' + MINUS + '2) \u00B7 (' + MINUS + '2) = ' + MINUS + '8') + '.';
    }
    if (i === 1) {
      return m('(2x)\u00B2 = ' + sg(b)) + ' ולעומתו ' + m('2x\u00B2 = ' + sg(a)) + '. בסוגריים גם ה־' + m('2') + ' בריבוע, ולכן פי ' + m('4') + ' ולא פי ' + m('2') + '.';
    }
    return m(MINUS + 'x\u00B2 = ' + sg(a)) + ' ולעומתו ' + m('(' + MINUS + 'x)\u00B2 = ' + sg(b)) + '. בלי סוגריים רק ה־' + m('x') + ' בריבוע, והמינוס נשאר בחוץ.';
  }
  function compareScene(ctx) {
    var x = 1, locked = [false, false, false], done = false;
    var out = numText(20, 30, 24, INK, 'xNow', 'start', '') + sliderMarkup(C_LO, C_HI, C_Y, 'הערך של איקס. חץ ימינה מגדיל ב־1, חץ שמאלה מקטין ב־1');
    ROWS.forEach(function (r, i) {
      var y = ROW_Y[i];
      out += '<rect id="rowBox' + i + '" x="12" y="' + y + '" width="378" height="68" rx="12" fill="#ffffff" stroke="' + LINE + '" stroke-width="2"/>'
        + hebText(392 - 6, y + 17, 13, MUTED, 'end', 'יעד')
        + numText(350 - 6, y + 17, 15, GOOD, '', 'end', r.tgt)
        + '<g id="ok' + i + '" display="none"><circle cx="30" cy="' + (y + 14) + '" r="9" fill="' + GOOD + '"/>'
        + '<path d="M25 ' + (y + 14) + ' l4 4 l7 -8" stroke="#ffffff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
        + numText(100, y + 40, 15, MUTED, '', 'middle', r.l[0])
        + numText(300, y + 40, 15, MUTED, '', 'middle', r.r[0])
        + numText(100, y + 60, 17, INK, 'rl' + i, 'middle', '')
        + numText(300, y + 60, 17, INK, 'rr' + i, 'middle', '')
        + '<line x1="201" y1="' + (y + 28) + '" x2="201" y2="' + (y + 62) + '" stroke="' + LINE + '" stroke-width="1.5"/>';
    });
    ctx.draw(out);
    var strip = ctx.extra(stepperHtml('הערך של x'));
    function show() {
      moveKnob(ctx, C_LO, C_HI, C_Y, x);
      ctx.el('xNow').textContent = 'x = ' + sg(x);
      ROWS.forEach(function (r, i) {
        ctx.el('rl' + i).textContent = r.l[1](x);
        ctx.el('rr' + i).textContent = r.r[1](x);
        var hit = rowValue(r, x) === r.tv;
        var box = ctx.el('rowBox' + i);
        box.setAttribute('fill', locked[i] ? GOOD_SOFT : '#ffffff');
        box.setAttribute('stroke', locked[i] ? GOOD : (hit ? WARM : LINE));
        ctx.el('ok' + i).setAttribute('display', locked[i] ? 'inline' : 'none');
      });
      strip.querySelector('#xMinus').disabled = x <= C_LO;
      strip.querySelector('#xPlus').disabled = x >= C_HI;
    }
    function set(v, final) {
      if (v !== x) { x = v; ctx.sfx('tick'); }
      show();
      if (final) check();
    }
    function check() {
      if (done) return;
      var fresh = -1;
      ROWS.forEach(function (r, i) {
        if (!locked[i] && rowValue(r, x) === r.tv) {
          locked[i] = true;
          if (fresh < 0) fresh = i;
        }
      });
      show();
      var left = locked.filter(function (v) { return !v; }).length;
      if (fresh >= 0) {
        ctx.sfx('correct');
        if (left === 0) {
          done = true;
          ctx.burst(18);
          ctx.note(rowWin(fresh, x) + ' כל שלושת הזוגות הושוו.', 'good');
          ctx.say('אותו x, ביטויים שונים וערכים שונים. הסוגריים והמעריך קובעים הכול.', { mood: 'happy', attn: true });
          ctx.solved();
        } else {
          ctx.burst(8);
          ctx.note(rowWin(fresh, x) + ' נשארו עוד ' + (left === 1 ? 'יעד אחד' : 'שני יעדים') + '.', 'good');
        }
        return;
      }
      ctx.sfx('error');
      if (x === 0) {
        ctx.note('ב־' + m('x = 0') + ' כל הביטויים שווים ' + m('0') + ', ולכן אי אפשר לראות הבדל. הזז את ' + m('x') + ' למספר אחר.');
        return;
      }
      ctx.note(rowHint(locked.indexOf(false), x));
    }
    wireSlider(ctx, strip, C_LO, C_HI, function () { return x; }, set);
    show();
    ctx.note('הצב את אותו ' + m('x') + ' בשני ביטויים ומצא ערך שמגיע לכל יעד. הזז בגרירה, בכפתורים או בחיצים.');
  }
  /* ---------- steps ---------- */
  var steps = [
    {
      mode: 'intro',
      tA: 'מכונת ההצבה',
      sub: 'מתרגמים סיפור לביטוי אלגברי, ואז מציבים בו מספרים, גם שליליים.',
      tip: 'שלום, אני אליהו. אות כמו ' + m('x') + ' מחליפה מספר. נבנה ביטויים ונציב בהם.',
      emoji: '🔧',
      eq: m('3x + 5'),
      note: 'כשמציבים ' + m('x = 10') + ' מקבלים ' + m('3 \u00B7 10 + 5 = 35') + '. בדרך נפגוש חזקות, סוגריים ומינוסים.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מסיפור לביטוי',
      sub: 'בנה ביטוי אלגברי מבלוקים: בגרירה, בכפתורים או בחיצים.',
      tip: 'קרא את הסיפור ושאל מה משתנה ומה קבוע. אות אחת מייצגת את המספר שלא ידוע.',
      cue: 'בנה נכון את שני הביטויים',
      cueDone: 'בנית שני ביטויים נכונים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 214],
      alt: 'תיבת ביטוי ריקה ומתחתיה חמישה בלוקים לבחירה: מספרים, אות, פלוס ומינוס',
      nudge: { target: 'tkB0', text: 'הקש על בלוק כדי להוסיף אותו לביטוי.' },
      setup: storyScene
    },
    {
      mode: 'quiz',
      tA: 'מהו הערך של ', tM: 'x\u00B3', tB: ' כאשר x הוא 4?',
      sub: 'מציבים ' + m('4') + ' במקום ' + m('x') + ' ומחשבים.',
      tip: 'שים לב: ' + m('x\u00B3') + ' ו־' + m('3x') + ' אינם אותו דבר.',
      btn: 'המשך ←',
      win: 'נכון. ' + m('4\u00B3 = 4 \u00B7 4 \u00B7 4 = 64') + '.',
      wrongSay: 'חזקה היא כפל חוזר של אותו מספר, לא כפל במעריך.',
      opts: [
        { t: m('12'), f: 'חישבת ' + m('3 \u00B7 4 = 12') + ', כלומר ' + m('3x') + '. אבל ' + m('x\u00B3') + ' הוא ' + m('x') + ' שלוש פעמים בכפל, לא פי ' + m('3') + '.' },
        { t: m('64'), c: true, f: m('4\u00B3 = 4 \u00B7 4 \u00B7 4 = 16 \u00B7 4 = 64') + '. כך מחשבים חזקה.' },
        { t: m('81'), f: 'החלפת בין הבסיס למעריך וחישבת ' + m('3\u2074 = 81') + '. ב־' + m('x\u00B3') + ' הבסיס הוא ' + m('x') + ', כלומר ' + m('4') + '.' },
        { t: m('7'), f: 'חיברת ' + m('4 + 3 = 7') + '. מעריך אינו מספר שמחברים, הוא אומר כמה פעמים לכפול.' }
      ],
      hints: [
        'מעריך ' + m('3') + ' אומר כמה פעמים כותבים את הבסיס בכפל.',
        m('x\u00B3') + ' הוא ' + m('x \u00B7 x \u00B7 x') + '. מציבים ' + m('4') + ' בכל מקום.',
        m('4 \u00B7 4 = 16') + ', ועוד כפל אחד ב־' + m('4') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מכונת ההצבה',
      sub: 'מציבים מספר במקום ' + m('x') + ' וצופים בחישוב. בגרירה, בכפתורים או בחיצים.',
      tip: 'מציבים בסוגריים, כופלים קודם, ורק אחר כך מחברים ומחסרים.',
      cue: 'הגע לשני היעדים',
      cueDone: 'הגעת לשני היעדים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 284],
      alt: 'ציר מספרים מ־מינוס חמש עד חמש עם ידית להזזת איקס, ומתחתיו שלבי החישוב של חמש פחות שתיים איקס',
      nudge: { target: 'knob', text: 'הזז את הידית, או לחץ על מינוס אחד, ועקוב אחרי החישוב.' },
      setup: machineScene
    },
    {
      mode: 'quiz',
      tA: 'מהו הערך של ', tM: MINUS + 'x\u00B2', tB: ' כאשר x הוא 5?',
      sub: 'שים לב למה שמועלה בריבוע.',
      tip: 'אין סוגריים סביב המינוס. מה מרבעים?',
      btn: 'המשך ←',
      win: 'נכון. מרבעים רק את ' + m('x') + ': ' + m('5\u00B2 = 25') + ', ואז המינוס: ' + m(MINUS + '25') + '.',
      wrongSay: 'בלי סוגריים, החזקה חלה רק על ' + m('x') + '.',
      opts: [
        { t: m('25'), f: 'העלית בריבוע גם את המינוס, כאילו כתוב ' + m('(' + MINUS + 'x)\u00B2') + '. בלי סוגריים רק ' + m('x') + ' בריבוע, והמינוס נשאר.' },
        { t: m(MINUS + '10'), f: 'חישבת ' + m('' + MINUS + '5 \u00B7 2') + '. ריבוע הוא כפל של המספר בעצמו, ' + m('5 \u00B7 5') + ', לא כפל ב־' + m('2') + '.' },
        { t: m('10'), f: 'הכפלת ' + m('5 \u00B7 2') + '. ריבוע הוא ' + m('5 \u00B7 5') + ', ובנוסף המינוס נשאר.' },
        { t: m(MINUS + '25'), c: true, f: m('5\u00B2 = 25') + ' ואחר כך הופכים סימן: ' + m(MINUS + '25') + '. לכן ' + m(MINUS + 'x\u00B2') + ' אינו חיובי.' }
      ],
      hints: [
        'שאל: מי נמצא בבסיס החזקה, ' + m('x') + ' או ' + m(MINUS + 'x') + '?',
        'מחשבים קודם את החזקה ' + m('x\u00B2') + ', ואחר כך מוסיפים את המינוס.',
        m('5\u00B2 = 25') + '. ועכשיו המינוס שלפניו.'
      ]
    },
    {
      mode: 'scene',
      tA: 'אותו x, ביטויים שונים',
      sub: 'הצב אותו ' + m('x') + ' בשני ביטויים והשווה. בגרירה, בכפתורים או בחיצים.',
      tip: 'חזקה, מקדם וסוגריים נראים דומים, אבל הערכים שונים. בוא נראה.',
      cue: 'מצא ערך של x לכל שלושת היעדים',
      cueDone: 'מצאת את שלושת היעדים. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 348],
      alt: 'ציר מ־מינוס ארבע עד ארבע עם ידית לאיקס, ומתחתיו שלוש שורות השוואה: איקס בשלישית מול שלוש איקס, שתיים איקס בריבוע מול שתיים איקס בסוגריים בריבוע, ומינוס איקס בריבוע מול מינוס איקס בסוגריים בריבוע',
      nudge: { target: 'knob', text: 'הזז את הידית כדי להציב ערך אחר ל־' + m('x') + '.' },
      setup: compareScene
    },
    {
      mode: 'quiz',
      tA: 'מהו הערך של ', tM: '3 + 2x', tB: ' כאשר x הוא ' + m(MINUS + '5') + '?',
      sub: 'הצב בסוגריים וחשב לפי סדר הפעולות.',
      tip: 'כפל קודם לחיבור. ואל תאבד את המינוס.',
      btn: 'המשך ←',
      win: 'נכון. ' + m('3 + 2 \u00B7 (' + MINUS + '5) = 3 + (' + MINUS + '10) = ' + MINUS + '7') + '.',
      wrongSay: 'כופלים קודם, ושומרים על הסימן של ' + m(MINUS + '5') + '.',
      opts: [
        { t: m(MINUS + '7'), c: true, f: 'כפל קודם: ' + m('2 \u00B7 (' + MINUS + '5) = ' + MINUS + '10') + ', ואז ' + m('3 + (' + MINUS + '10) = ' + MINUS + '7') + '.' },
        { t: m('13'), f: 'התעלמת מהמינוס וחישבת ' + m('3 + 10') + '. ' + m('2 \u00B7 (' + MINUS + '5)') + ' שלילי: ' + m(MINUS + '10') + '.' },
        { t: m(MINUS + '25'), f: 'חישבת משמאל לימין: ' + m('(3 + 2) \u00B7 (' + MINUS + '5)') + '. כפל קודם לחיבור, ולכן קודם ' + m('2 \u00B7 (' + MINUS + '5)') + '.' },
        { t: m('0'), f: 'הצבת ' + m(MINUS + '5') + ' ליד ה־' + m('2') + ' וקראת ' + m('3 + 2 ' + MINUS + ' 5 = 0') + '. בין ' + m('2') + ' ל־' + m('x') + ' יש כפל, ולכן ' + m('2 \u00B7 (' + MINUS + '5)') + '.' }
      ],
      hints: [
        'כפל וחילוק קודמים לחיבור וחיסור. מה כופלים כאן?',
        'מציבים ' + m('x = ' + MINUS + '5') + ' בסוגריים: ' + m('2 \u00B7 (' + MINUS + '5)') + '.',
        m('2 \u00B7 (' + MINUS + '5) = ' + MINUS + '10') + '. עכשיו ' + m('3') + ' ועוד המספר הזה.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'אילן בן ', tM: 'n', tB: ' שנים. אביו גדול ממנו פי 4. מהו גיל האב?',
      sub: 'שים לב להבדל בין "גדול פי 4" לבין "גדול ב־4".',
      tip: 'פי ' + m('4') + ' הוא כפל, וב־' + m('4') + ' הוא חיבור.',
      btn: 'לסיכום ←',
      win: 'נכון. גדול פי ' + m('4') + ' פירושו ' + m('4 \u00B7 n') + ', כלומר ' + m('4n') + '.',
      wrongSay: '"פי" פירושו כפל. "ב־" פירושו חיבור.',
      opts: [
        { t: m('n + 4'), f: 'זה מתאים ל"גדול ב־4", כלומר ארבע שנים יותר. "פי 4" הוא כפל.' },
        { t: m('n\u2074'), f: 'ערבבת חזקה עם כפל. ' + m('n\u2074') + ' הוא ' + m('n \u00B7 n \u00B7 n \u00B7 n') + ', ולא ארבע פעמים ' + m('n') + '.' },
        { t: m('4n'), c: true, f: 'ארבע פעמים הגיל ' + m('n') + ', ובקיצור ' + m('4n') + '. למשל אילן בן ' + m('10') + ' ואביו בן ' + m('40') + '.' },
        { t: m('n \u00F7 4'), f: 'חילקת, כלומר האב היה קטן פי ' + m('4') + '. כשהוא גדול פי ' + m('4') + ' כופלים.' }
      ],
      hints: [
        'נסה מספר: אילן בן ' + m('10') + '. כמה שנים יש לאב אם הוא גדול ממנו פי ' + m('4') + '?',
        'מה עשית עם ' + m('10') + ' כדי לקבל את גיל האב? עשה אותו דבר עם ' + m('n') + '.',
        'כפלת ב־' + m('4') + '. כותבים את המספר לפני האות.'
      ]
    },
    {
      mode: 'finish',
      tA: 'מכונת ההצבה עובדת',
      sub: 'תירגמת סיפורים לביטויים והצבת בהם מספרים, גם שליליים.',
      tip: 'כל הכבוד. ביטוי אלגברי הוא מכונה: מציבים מספר ומקבלים תוצאה.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:',
      formula: 'מציבים בסוגריים, חזקה קודם, אחר כך כפל, ואחר כך חיבור וחיסור: ' + m('5 ' + MINUS + ' 2 \u00B7 (' + MINUS + '3) = 11')
    }
  ];
  window.NoamGame.boot({
    slug: 'mechonat-hahatsava',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'חזקה מול כפל', math: 'x\u00B3 \u2260 3x' },
      { step: 4, name: 'מינוס וריבוע', math: '\u2212x\u00B2 \u2260 (\u2212x)\u00B2' },
      { step: 6, name: 'סדר פעולות בהצבה', math: '3 + 2x' },
      { step: 7, name: 'מילים לביטוי', math: '4n' }
    ],
    bonus: {
      label: 'מכונת ההצבה האקראית 🔧',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל ביטוי ומספר, חשב את הערך ובדוק.',
      setup: function (box, ctx) {
        var q = null, guess = 0;
        function pick(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          var type = pick(1, 5), x = pick(-5, 5), a = pick(2, 5), b = pick(1, 9), c = pick(2, 12), p = par(x), expr, work, val;
          if (type === 1) {
            val = a * x + b; expr = a + 'x + ' + b;
            work = a + '\u00B7' + p + ' + ' + b + ' = ' + sg(a * x) + ' + ' + b + ' = ' + sg(val);
          } else if (type === 2) {
            val = b - a * x; expr = b + ' ' + MINUS + ' ' + a + 'x';
            work = b + ' ' + MINUS + ' ' + a + '\u00B7' + p + ' = ' + b + ' ' + MINUS + ' ' + par(a * x) + ' = ' + sg(val);
          } else if (type === 3) {
            val = x * x - c; expr = 'x\u00B2 ' + MINUS + ' ' + c;
            work = p + '\u00B2 ' + MINUS + ' ' + c + ' = ' + (x * x) + ' ' + MINUS + ' ' + c + ' = ' + sg(val);
          } else if (type === 4) {
            val = -x * x + c; expr = MINUS + 'x\u00B2 + ' + c;
            work = MINUS + p + '\u00B2 + ' + c + ' = ' + MINUS + (x * x) + ' + ' + c + ' = ' + sg(val);
          } else {
            val = a * x * x; expr = a + 'x\u00B2';
            work = a + '\u00B7' + p + '\u00B2 = ' + a + '\u00B7' + (x * x) + ' = ' + sg(val);
          }
          q = { expr: expr, x: x, val: val, work: work };
        }
        box.innerHTML = '<div class="bTitle">מכונת ההצבה</div>'
          + '<div class="bSub">הצב את המספר בביטוי, חשב בראש, בחר את התוצאה ובדוק.</div>'
          + '<div class="bChip" data-eq dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr">'
          + '<button type="button" data-d="-10" aria-label="הקטן את התוצאה ב־10">\u221210</button>'
          + '<button type="button" data-d="-1" aria-label="הקטן את התוצאה ב־1">\u22121</button>'
          + '<bdi class="var math" dir="ltr" data-g aria-live="polite">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל את התוצאה ב־1">+1</button>'
          + '<button type="button" data-d="10" aria-label="הגדל את התוצאה ב־10">+10</button></div></div>'
          + '<div class="bForms" data-forms dir="ltr" hidden></div>'
          + '<div class="bOk" data-ok role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק את התוצאה</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">🔧 ביטוי חדש</button>';
        var chip = box.querySelector('[data-eq]');
        var gEl = box.querySelector('[data-g]');
        var forms = box.querySelector('[data-forms]');
        var ok = box.querySelector('[data-ok]');
        function show() {
          chip.textContent = q.expr + ',  x = ' + sg(q.x);
          gEl.textContent = sg(guess);
          forms.hidden = true;
          ok.hidden = true;
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () {
            guess = clamp(guess + Number(b.getAttribute('data-d')), -99, 99);
            ctx.sfx('click');
            show();
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          forms.innerHTML = '<div>' + q.work + '</div>';
          forms.hidden = false;
          ok.hidden = false;
          if (guess === q.val) {
            ctx.sfx('correct');
            ok.style.color = GOOD;
            ok.textContent = 'נכון! התוצאה היא ' + sg(q.val) + '.';
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            ok.textContent = 'עוד לא. התוצאה הנכונה היא ' + sg(q.val) + ', והחישוב מופיע למעלה.';
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () {
          roll();
          guess = 0;
          ctx.sfx('click');
          show();
        });
        roll();
        show();
      }
    }
  });
}());
