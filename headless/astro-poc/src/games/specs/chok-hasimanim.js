/** חוק הסימנים: הגודל והסימן הם שתי החלטות נפרדות. סופרים כמה גורמים שליליים יש. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var MUTED = '#475569', WARMDARK = '#92580a', BAD = '#b91c1c';
  var LRI = '\u2066', PDI = '\u2069';
  var MINUS = '\u2212', DOT = ' \u00B7 ', DIV = ' \u00F7 ';

  function num(v) { return v < 0 ? MINUS + Math.abs(v) : String(v); }
  function par(v) { return v < 0 ? '(' + MINUS + Math.abs(v) + ')' : String(v); }
  function iso(text) { return LRI + text + PDI; }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mathText(x, y, label, size, colour, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 14)
      + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function hebText(x, y, label, size, colour, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 14)
      + '" font-weight="700" fill="' + (colour || MUTED) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function unitMarkup(id, label, ariaMinus, ariaPlus) {
    return '<div class="unit" dir="ltr"><bdi class="math var" dir="ltr">' + label + '</bdi>'
      + '<button type="button" id="' + id + 'Minus" data-key="' + id + '" data-delta="-1" aria-label="' + ariaMinus + '">' + MINUS + '</button>'
      + '<bdi class="var math" dir="ltr" data-value="' + id + '" style="min-width:34px" aria-live="polite">0</bdi>'
      + '<button type="button" id="' + id + 'Plus" data-key="' + id + '" data-delta="1" aria-label="' + ariaPlus + '">+</button></div>';
  }
  function focusStyle(id) {
    return '<style>#' + id + ':focus-visible .handleRing{stroke:' + PAL.dark + ';stroke-width:3}</style>';
  }

  /* ---------- scene 1: the sign machine ---------- */
  var CX = 201, UN = 7.2, AX = 105, HX = 27, AY_A = 178, AY_B = 222;
  function lx(v) { return CX + UN * v; }
  function hx(v) { return CX + HX * v; }

  function jumpsMarkup(a, b) {
    var dir = b > 0 ? a : -a;
    var n = Math.abs(b);
    var sgn = dir > 0 ? 1 : -1;
    var colour = dir > 0 ? PAL.main : WARMDARK;
    var h = Math.min(40, 10 + 6 * Math.abs(a));
    var html = '';
    for (var k = 0; k < n; k++) {
      var s = lx(dir * k), e = lx(dir * (k + 1)), mid = (s + e) / 2;
      html += '<path d="M' + s + ' ' + AX + ' Q' + mid + ' ' + (AX - 2 * h) + ' ' + e + ' ' + AX
        + '" fill="none" stroke="' + colour + '" stroke-width="2.6"/>'
        + '<circle cx="' + e + '" cy="' + AX + '" r="3.2" fill="' + colour + '"/>';
    }
    var end = lx(dir * n);
    html += '<path d="M' + end + ' ' + AX + ' L' + (end - sgn * 8) + ' ' + (AX - 8) + ' L' + (end - sgn * 1) + ' ' + (AX - 10)
      + ' Z" fill="' + colour + '"/>';
    html += '<circle cx="' + lx(a * b) + '" cy="' + AX + '" r="8" fill="' + PAL.good + '" stroke="#fff" stroke-width="2.5"/>';
    return html;
  }

  function machineScene(ctx) {
    var a = 3, b = 2, completed = false;
    var html = '';
    for (var t = -25; t <= 25; t++) {
      html += '<line x1="' + lx(t) + '" y1="' + (t % 5 === 0 ? AX - 6 : AX - 3) + '" x2="' + lx(t) + '" y2="' + (t % 5 === 0 ? AX + 6 : AX + 3)
        + '" stroke="' + (t % 5 === 0 ? PAL.ink : PAL.line) + '" stroke-width="1"/>';
      if (t % 5 === 0) html += mathText(lx(t), AX + 22, num(t), 11, MUTED);
    }
    html += '<path d="M12 ' + AX + ' H390" stroke="' + PAL.ink + '" stroke-width="2" fill="none"/>';
    html += '<g id="jumps"></g>' + mathText(201, 30, '', 20, PAL.ink, 'middle', 'prodText');
    [['A', 'a', AY_A], ['B', 'b', AY_B]].forEach(function (row) {
      html += '<path d="M' + hx(-5) + ' ' + row[2] + ' H' + hx(5) + '" stroke="' + PAL.line + '" stroke-width="3" stroke-linecap="round"/>'
        + mathText(32, row[2] + 6, row[1], 18, PAL.dark);
      for (var v = -5; v <= 5; v++) {
        if (v !== 0) html += mathText(hx(v), row[2] + 25, num(v), 11, MUTED);
      }
      html += '<line x1="' + hx(0) + '" y1="' + (row[2] - 6) + '" x2="' + hx(0) + '" y2="' + (row[2] + 6) + '" stroke="' + BAD + '" stroke-width="2"/>';
    });
    [['hA', 'a', AY_A], ['hB', 'b', AY_B]].forEach(function (row) {
      html += focusStyle(row[0]) + '<g id="' + row[0] + '" tabindex="0" role="slider" aria-label="" aria-valuemin="-5" aria-valuemax="5" aria-valuenow="0" style="cursor:grab">'
        + '<rect class="handleRing" x="-30" y="-30" width="60" height="60" rx="12" fill="transparent"/>'
        + '<circle r="11" fill="' + PAL.main + '" stroke="#fff" stroke-width="3"/></g>';
    });
    ctx.draw(html);
    var box = ctx.extra('<div class="stepper" dir="ltr" style="align-self:stretch">'
      + unitMarkup('a', 'a', 'הקטן את הגורם a', 'הגדל את הגורם a')
      + unitMarkup('b', 'b', 'הקטן את הגורם b', 'הגדל את הגורם b') + '</div>');
    ctx.register('steps', box);
    var handles = { a: ctx.el('hA'), b: ctx.el('hB') };

    function set(key, value) {
      var v = clamp(value, -5, 5);
      if (v === 0) v = (key === 'a' ? a : b) > 0 ? -1 : 1;
      if (key === 'a') a = v; else b = v;
    }
    function nudge(key, delta) {
      var cur = key === 'a' ? a : b;
      var v = cur + delta;
      if (v === 0) v += delta;
      if (v < -5 || v > 5) v = cur;
      if (key === 'a') a = v; else b = v;
    }
    function update(acted) {
      var p = a * b;
      [['a', 'hA', AY_A, a], ['b', 'hB', AY_B, b]].forEach(function (row) {
        var node = handles[row[0]];
        node.setAttribute('transform', 'translate(' + hx(row[3]) + ' ' + row[2] + ')');
        node.setAttribute('aria-valuenow', String(row[3]));
        node.setAttribute('aria-valuetext', num(row[3]));
        node.setAttribute('aria-label', 'הגורם ' + row[0] + ' שווה ' + num(row[3]) + '; הזז בגרירה, בכפתורים או בחיצים, בלי אפס');
        box.querySelector('[data-value="' + row[0] + '"]').textContent = num(row[3]);
      });
      ctx.el('jumps').innerHTML = jumpsMarkup(a, b);
      ctx.el('prodText').textContent = iso(par(a) + DOT + par(b) + ' = ' + num(p));
      ctx.caption('בצע ' + m(String(Math.abs(b))) + ' קפיצות בגודל ' + m(String(Math.abs(a))) + ' ' + (b > 0 ? 'בכיוון של ' : 'בכיוון ההפוך ל־') + m('a'));
      var neg = (a < 0 ? 1 : 0) + (b < 0 ? 1 : 0);
      if (neg === 2) {
        ctx.note('בדיוק: ' + m(par(a) + DOT + par(b) + ' = ' + p) + '. יש שני גורמים שליליים, מספר זוגי של מינוסים. הקפיצות בגודל ' + m('a') + ' פונות שמאלה, ו־' + m('b') + ' שלילי הופך את הכיוון שוב, ולכן נוחתים ימינה, על מספר חיובי.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (neg === 1) {
        ctx.note('מינוס אחד הופך את הכיוון פעם אחת, ולכן המכפלה ' + m(num(p)) + ' שלילית. כדי לקבל מכפלה חיובית צריך עוד מינוס: שנה גם את הגורם השני.');
      } else {
        ctx.note('שני הגורמים חיוביים, ולכן כל הקפיצות ימינה והמכפלה ' + m(String(p)) + ' חיובית. הפוך את שני הגורמים לשליליים ובדוק מה קורה.');
      }
    }
    box.querySelectorAll('[data-delta]').forEach(function (button) {
      button.addEventListener('click', function () {
        nudge(button.getAttribute('data-key'), Number(button.getAttribute('data-delta')));
        ctx.sfx('tick'); update(true);
      });
    });
    function bindKeys(key) {
      handles[key].addEventListener('keydown', function (event) {
        var k = event.key;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) < 0) return;
        event.preventDefault();
        if (k === 'ArrowLeft' || k === 'ArrowDown') nudge(key, -1);
        else if (k === 'ArrowRight' || k === 'ArrowUp') nudge(key, 1);
        else if (k === 'Home') set(key, -5);
        else set(key, 5);
        ctx.sfx('tick'); update(true);
      });
      ctx.drag(handles[key], {
        move: function (x) {
          var v = Math.round((x - CX) / HX);
          if (v === 0) v = x >= CX ? 1 : -1;
          set(key, v);
          update(false);
        },
        end: function () { update(true); }
      });
    }
    bindKeys('a'); bindKeys('b');
    update(false);
  }

  /* ---------- scene 2: counting the minus factors ---------- */
  function countScene(ctx) {
    var sizes = [2, 3, 1, 5];
    var neg = [false, false, false, false];
    var checked = false, completed = false;
    ctx.draw(
      '<text id="cExpr" x="201" y="50" direction="ltr" font-family="Secular One, sans-serif" font-size="17" fill="' + PAL.ink + '" text-anchor="middle"></text>'
      + hebText(392, 92, 'הגודל', 14, MUTED, 'start')
      + mathText(150, 94, '2' + DOT + '3' + DOT + '1' + DOT + '5 = 30', 19, PAL.dark)
      + hebText(392, 136, 'הסימן', 14, MUTED, 'start')
      + hebText(150, 136, '', 17, PAL.ink, 'middle').replace('<text ', '<text id="cSign" '));
    var box = ctx.extra('<div dir="ltr" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">'
      + sizes.map(function (s, i) {
        return '<button type="button" data-chip="' + i + '" aria-pressed="false" style="min-height:56px;min-width:56px;border:2px solid ' + PAL.main
          + ';border-radius:12px;background:' + PAL.soft + ';color:' + PAL.dark + ';font-family:Secular One,sans-serif;font-size:22px"></button>';
      }).join('') + '</div>'
      + '<div class="sceneStrip" style="margin-top:10px"><div dir="rtl"><b>כמה גורמים שליליים יש עכשיו</b><span data-count>0</span></div>'
      + '<div dir="rtl"><b>הסימן הצפוי של המכפלה</b><span data-expect style="font-family:Heebo,sans-serif;font-weight:800"></span></div></div>');
    ctx.register('chips', box);
    var chips = box.querySelectorAll('[data-chip]');
    function minusCount() { return neg.filter(Boolean).length; }
    function product() {
      var p = 1;
      sizes.forEach(function (s, i) { p *= neg[i] ? -s : s; });
      return p;
    }
    function expr(show) {
      return sizes.map(function (s, i) { return neg[i] ? par(-s) : String(s); }).join(DOT) + ' = ' + (show ? num(product()) : '?');
    }
    function render() {
      var n = minusCount();
      chips.forEach(function (chip, i) {
        chip.textContent = neg[i] ? MINUS + sizes[i] : String(sizes[i]);
        chip.setAttribute('aria-pressed', String(neg[i]));
        chip.setAttribute('aria-label', 'הגורם ' + sizes[i] + ', כרגע ' + (neg[i] ? 'שלילי' : 'חיובי') + '. לחיצה הופכת את הסימן');
        chip.style.background = neg[i] ? PAL.warmSoft : PAL.soft;
        chip.style.borderColor = neg[i] ? WARMDARK : PAL.main;
      });
      box.querySelector('[data-count]').textContent = String(n);
      box.querySelector('[data-expect]').textContent = n % 2 === 1 ? 'מינוס' : 'פלוס';
      ctx.el('cExpr').textContent = iso(expr(checked));
      ctx.el('cSign').textContent = checked ? (n % 2 === 1 ? 'אי־זוגי: מינוס' : 'זוגי: פלוס') : 'עוד לא נבדק';
    }
    chips.forEach(function (chip, i) {
      chip.addEventListener('click', function () {
        neg[i] = !neg[i]; checked = false;
        ctx.sfx('tick'); render();
        ctx.note('ספרת ' + m(String(minusCount())) + ' גורמים שליליים. לחץ על בדוק את הסימן כדי לראות את המכפלה.');
      });
    });
    ctx.button('בדוק את הסימן', function () {
      checked = true; render();
      var n = minusCount(), p = product();
      if (n % 2 === 1) {
        ctx.note('המכפלה היא ' + m(expr(true)) + '. הגודל ' + m('30') + ' לא השתנה, והסימן נקבע לפי מספר המינוסים: ' + m(String(n)) + ', מספר אי־זוגי, ולכן מינוס.'
          + (n === 1 ? ' מינוס אחד מספיק כאן, אבל נסה גם שלושה.' : ''), 'good');
        if (!completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else {
        ctx.sfx('error');
        ctx.note('מספר זוגי של מינוסים תמיד נותן פלוס, ולכן ' + m(num(p)) + ' אינו שלילי. ספור שוב: צריך מספר אי־זוגי של גורמים שליליים.');
      }
    }, { id: 'checkSign', target: 'checkSign' });
    render();
    ctx.note('הפוך כמה שרוצים מהגורמים לשליליים. המטרה: מכפלה שלילית, למשל בשלושה מינוסים.');
  }

  /* ---------- scene 3: division with a sign ---------- */
  var DIVS = [-6, -4, -3, -2, 2, 3, 4, 6];
  var DX0 = 55, DXS = 42, DAY = 168;
  function divScene(ctx) {
    var idx = 4, completed = false;
    var html = '<path d="M' + DX0 + ' ' + DAY + ' H' + (DX0 + 7 * DXS) + '" stroke="' + PAL.line + '" stroke-width="3" stroke-linecap="round"/>';
    DIVS.forEach(function (d, i) {
      html += '<line x1="' + (DX0 + i * DXS) + '" y1="' + (DAY - 6) + '" x2="' + (DX0 + i * DXS) + '" y2="' + (DAY + 6) + '" stroke="' + PAL.ink + '"/>'
        + mathText(DX0 + i * DXS, DAY + 30, num(d), 14, MUTED);
    });
    html += hebText(201, 138, 'בחר את המחלק', 13, MUTED)
      + mathText(201, 46, '', 26, PAL.ink, 'middle', 'dExpr')
      + hebText(201, 86, 'בדיקה בכפל', 14, MUTED)
      + mathText(201, 114, '', 20, PAL.dark, 'middle', 'dCheck')
      + focusStyle('hD') + '<g id="hD" tabindex="0" role="slider" aria-label="" aria-valuemin="0" aria-valuemax="7" aria-valuenow="4" style="cursor:grab">'
      + '<rect class="handleRing" x="-30" y="-30" width="60" height="60" rx="12" fill="transparent"/>'
      + '<circle r="11" fill="' + PAL.main + '" stroke="#fff" stroke-width="3"/></g>';
    ctx.draw(html);
    var box = ctx.extra('<div class="stepper" dir="ltr" style="align-self:stretch">' + unitMarkup('d', 'b', 'המחלק הקודם ברשימה', 'המחלק הבא ברשימה') + '</div>');
    ctx.register('divControls', box);
    var handle = ctx.el('hD');
    function update(acted) {
      var d = DIVS[idx], q = -24 / d;
      handle.setAttribute('transform', 'translate(' + (DX0 + idx * DXS) + ' ' + DAY + ')');
      handle.setAttribute('aria-valuenow', String(idx));
      handle.setAttribute('aria-valuetext', num(d));
      handle.setAttribute('aria-label', 'המחלק שווה ' + num(d) + '; הזז בגרירה, בכפתורים או בחיצים בין שמונה מחלקים');
      box.querySelector('[data-value="d"]').textContent = num(d);
      ctx.el('dExpr').textContent = iso(MINUS + '24' + DIV + par(d) + ' = ' + num(q));
      ctx.el('dCheck').textContent = iso(num(q) + DOT + par(d) + ' = ' + MINUS + '24');
      ctx.caption('הגודל: ' + m('24' + DIV + Math.abs(d) + ' = ' + Math.abs(q)) + ' · הסימן: ' + (q < 0 ? 'מינוס' : 'פלוס'));
      if (q === 4) {
        ctx.note('בדיוק: ' + m(MINUS + '24' + DIV + par(d) + ' = 4') + '. בדיקה: ' + m('4' + DOT + par(d) + ' = ' + MINUS + '24') + '. המחלק שלילי והמנה חיובית, ולכן במכפלה יש מינוס אחד והתוצאה שלילית. זו אותה ספירת מינוסים כמו בכפל.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (d > 0) {
        ctx.note('מחלקים מספר שלילי במחלק חיובי: יש מינוס אחד, ולכן המנה ' + m(num(q)) + ' שלילית. כדי לקבל ' + m('4') + ' חיובי צריך שהמחלק יהיה שלילי.');
      } else {
        ctx.note('המחלק שלילי ולכן יש שני מינוסים והמנה חיובית, אבל הגודל ' + m('24' + DIV + Math.abs(d)) + ' הוא ' + m(String(Math.abs(q))) + ' ולא ' + m('4') + '. בחר מחלק אחר מתוך הרשימה.');
      }
    }
    function go(next) { idx = clamp(next, 0, 7); ctx.sfx('tick'); update(true); }
    box.querySelectorAll('[data-delta]').forEach(function (button) {
      button.addEventListener('click', function () { go(idx + Number(button.getAttribute('data-delta'))); });
    });
    handle.addEventListener('keydown', function (event) {
      var k = event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) < 0) return;
      event.preventDefault();
      if (k === 'ArrowLeft' || k === 'ArrowDown') go(idx - 1);
      else if (k === 'ArrowRight' || k === 'ArrowUp') go(idx + 1);
      else if (k === 'Home') go(0);
      else go(7);
    });
    ctx.drag(handle, {
      move: function (x) { idx = clamp(Math.round((x - DX0) / DXS), 0, 7); update(false); },
      end: function () { update(true); }
    });
    update(false);
  }

  var steps = [
    {
      mode: 'intro', tA: 'חוק הסימנים', sub: 'הגודל והסימן הם שתי החלטות נפרדות.',
      tip: 'שלום, אני אליהו. כשמכפילים מספרים מכוונים מחליטים פעמיים: קודם הגודל, אחר כך הסימן.',
      emoji: '➖', eq: 'מינוס כפול מינוס = פלוס',
      note: 'זה לא קסם. נראה למה, ונלמד לספור כמה גורמים שליליים יש כדי לדעת את הסימן מראש.',
      cue: 'מוכן לראות איך זה עובד?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מכונת הסימנים', sub: 'שנה את ' + m('a') + ' ואת ' + m('b') + ' בגרירה, בכפתורים או בחיצים, עד שמכפלה חיובית מגיעה משני גורמים שליליים.',
      tip: 'המכפלה היא ' + m('|b|') + ' קפיצות בגודל ' + m('a') + '. כש־' + m('b') + ' שלילי, כיוון הקפיצות מתהפך.',
      aspect: [402, 256], alt: 'ציר מספרים מ־מינוס עשרים וחמש עד עשרים וחמש עם קפיצות שמראות מכפלה של שני גורמים, ומתחתיו שני צירים קטנים עם ידיות לגורם a ולגורם b',
      cue: 'הגע למכפלה חיובית משני גורמים שליליים', cueDone: 'מצאת. שני מינוסים נותנים פלוס. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'steps', text: 'לחץ על המינוס ליד a ועל המינוס ליד b, ותראה לאן הקפיצות נוחתות.' }, setup: machineScene
    },
    {
      mode: 'quiz', tA: 'כמה יוצא ', tM: '(−3) · (−5)', tB: '?', sub: 'קודם הגודל, ואחר כך הסימן.',
      tip: 'כפול קודם את הגדלים, ואז ספור כמה גורמים שליליים יש.', btn: 'המשך ←',
      win: 'בדיוק. שני מינוסים, ולכן פלוס.', wrongSay: 'בדוק גם את הפעולה וגם את מספר המינוסים.',
      opts: [
        { t: m('15'), c: true, f: 'נכון: ' + m('3 · 5 = 15') + ', ויש שני גורמים שליליים, מספר זוגי, ולכן המכפלה חיובית.' },
        { t: m('−15'), f: 'ספרת מינוס אחד במקום שניים. בשני הגורמים יש מינוס, ושני מינוסים נותנים פלוס.' },
        { t: m('8'), f: 'חיברת ' + m('3 + 5') + ' במקום להכפיל. בכפל מחשבים ' + m('3 · 5') + '.' },
        { t: m('−8'), f: 'חיברת את הגדלים ושמרת את המינוס. צריך להכפיל, ואז לספור שני מינוסים.' }
      ],
      hints: ['הפרד בין שתי ההחלטות: גודל וסימן.', 'הגודל הוא ' + m('3 · 5') + '. ספור כמה גורמים שליליים יש.', 'שני גורמים שליליים הם מספר זוגי של מינוסים, והסימן חיובי.']
    },
    {
      mode: 'scene', tA: 'סופרים מינוסים', sub: 'לחץ על גורמים כדי להפוך את הסימן שלהם, ואז לחץ על בדוק את הסימן.',
      tip: 'הגודל כאן תמיד ' + m('30') + '. רק מספר הגורמים השליליים קובע את הסימן.',
      aspect: [402, 170], alt: 'ארבעה גורמים: שניים, שלוש, אחד וחמש, עם הגודל שלושים והסימן שנקבע לפי מספר הגורמים השליליים',
      cue: 'הפוך את המכפלה לשלילית ובדוק', cueDone: 'מספר אי־זוגי של מינוסים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'chips', text: 'לחץ על אחד המספרים כדי להפוך אותו לשלילי, וספור את המינוסים.' }, setup: countScene
    },
    {
      mode: 'quiz', tA: 'מה הסימן של ', tM: '(−2) · (−3) · (−4) · (−5) · (−1)', tB: '?', sub: 'ספור את הגורמים השליליים, ואז חשב את הגודל.',
      tip: 'אל תכפול בזוגות בלי לספור. ספור את כל המינוסים.', btn: 'המשך ←',
      win: 'נכון. חמישה מינוסים, מספר אי־זוגי, ולכן המכפלה שלילית.', wrongSay: 'ספור שוב את המינוסים ובדוק גם את הכפל.',
      opts: [
        { t: m(MINUS + '120'), c: true, f: 'נכון: יש חמישה גורמים שליליים, מספר אי־זוגי, והגודל ' + m('2 · 3 · 4 · 5 · 1 = 120') + '.' },
        { t: m('120'), f: 'ספרת את המינוסים כמספר זוגי. יש חמישה, לא ארבעה, ולכן הסימן שלילי.' },
        { t: m(MINUS + '60'), f: 'הסימן נכון, אבל הגודל שגוי: דילגת על גורם בכפל. ' + m('2 · 3 · 4 · 5 = 120') + '.' },
        { t: m('60'), f: 'גם הגודל שגוי וגם הסימן. הגודל ' + m('120') + ', ולחמישה מינוסים סימן שלילי.' }
      ],
      hints: ['ספור כמה גורמים כתובים עם מינוס.', 'יש חמישה. האם חמש הוא מספר זוגי או אי־זוגי?', 'מספר אי־זוגי של מינוסים נותן מינוס, והגודל הוא ' + m('2 · 3 · 4 · 5 · 1 = 120') + '.']
    },
    {
      mode: 'scene', tA: 'חילוק עם סימן', sub: 'בחר מחלק ' + m('b') + ' בגרירה, בכפתורים או בחיצים, כדי שהמנה תהיה ' + m('4') + '.',
      tip: 'חילוק הוא ההפך של כפל. בדוק כל מנה בכפל, וראה שכלל הסימנים זהה.',
      aspect: [402, 230], alt: 'חילוק של מינוס עשרים וארבע במחלק שאפשר לבחור מתוך שמונה ערכים על ציר, ומתחתיו בדיקת הכפל',
      cue: 'בחר מחלק שנותן מנה ארבע', cueDone: 'המנה ארבע. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'divControls', text: 'לחץ על כפתורי המינוס והפלוס כדי לעבור בין המחלקים, ועקוב אחרי המנה.' }, setup: divScene
    },
    {
      mode: 'quiz', tA: 'כמה יוצא ', tM: '−36 ÷ (−9)', tB: '?', sub: 'אותו כלל סימנים כמו בכפל.',
      tip: 'שאל מה המספר שכפול ' + m(MINUS + '9') + ' נותן ' + m(MINUS + '36') + '.', btn: 'המשך ←',
      win: 'נכון. שני מינוסים גם בחילוק נותנים פלוס.', wrongSay: 'בדוק את הפעולה, ואחר כך את מספר המינוסים.',
      opts: [
        { t: m('4'), c: true, f: 'נכון: ' + m('36 ÷ 9 = 4') + ', ושני הגורמים שליליים, ולכן המנה חיובית. בדיקה: ' + m('4 · (' + MINUS + '9) = ' + MINUS + '36') + '.' },
        { t: m(MINUS + '4'), f: 'ספרת מינוס אחד במקום שניים. גם במחלק וגם במחולק יש מינוס, ולכן המנה חיובית.' },
        { t: m('27'), f: 'חיסרת ' + m('36 − 9') + ' במקום לחלק. צריך לחשב ' + m('36 ÷ 9') + '.' },
        { t: m(MINUS + '27'), f: 'חיסרת במקום לחלק: ' + m(MINUS + '36 − (' + MINUS + '9)') + '. בחילוק מחשבים כמה פעמים ' + m('9') + ' נכנס ב־' + m('36') + '.' }
      ],
      hints: ['חשב את הגודל לבד: כמה פעמים ' + m('9') + ' נכנס ב־' + m('36') + '.', 'ספור כמה מינוסים יש בתרגיל. הכלל זהה לכפל.', 'שני מינוסים, מספר זוגי, ולכן הסימן חיובי.']
    },
    {
      mode: 'quiz', tA: 'כמה יוצא ', tM: '−2 + 3 · (−4)', tB: '?', sub: 'שים לב לסדר הפעולות.',
      tip: 'כפל לפני חיבור. קודם חשב את המכפלה כולה, כולל הסימן שלה.', btn: 'לסיכום ←',
      win: 'נכון. כפל קודם, ואחר כך חיבור.', wrongSay: 'חשב קודם את המכפלה ורק אחר כך חבר.',
      opts: [
        { t: m(MINUS + '14'), c: true, f: 'נכון: כפל קודם, ' + m('3 · (' + MINUS + '4) = ' + MINUS + '12') + ', ואחר כך ' + m(MINUS + '2 + (' + MINUS + '12) = ' + MINUS + '14') + '.' },
        { t: m(MINUS + '4'), f: 'חיברת קודם ' + m(MINUS + '2 + 3') + ' וכפלת ב־' + m(MINUS + '4') + '. בסדר פעולות כפל קודם לחיבור, בלי סוגריים.' },
        { t: m('10'), f: 'חישבת ' + m('3 · (' + MINUS + '4)') + ' כ־' + m('12') + ' והפסדת את המינוס. כפל קודם, אבל מינוס אחד נותן מכפלה שלילית.' },
        { t: m('14'), f: 'הגודל נכון, אבל איבדת את הסימן. שני המחוברים שליליים, ולכן הסכום ' + m(MINUS + '14') + '.' }
      ],
      hints: ['במה מתחילים כשיש כפל וחיבור בלי סוגריים.', 'חשב קודם ' + m('3 · (' + MINUS + '4)') + ' ושמור על הסימן.', 'המכפלה היא ' + m(MINUS + '12') + '. עכשיו חבר אותה ל־' + m(MINUS + '2') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את חוק הסימנים', sub: 'קודם הגודל, אחר כך הסימן.',
      tip: 'כל הכבוד. עכשיו אתה יודע לספור מינוסים ולדעת את הסימן לפני שמחשבים.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'שתי החלטות נפרדות: הגודל, ואז הסימן.',
      formula: 'מספר זוגי של גורמים שליליים נותן פלוס, מספר אי־זוגי נותן מינוס. חילוק פועל באותו כלל.'
    }
  ];

  window.NoamGame.boot({
    slug: 'chok-hasimanim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'כפל שני גורמים שליליים', math: '(−3) · (−5) = 15' },
      { step: 4, name: 'ספירת מינוסים במכפלה', math: '(−2) · (−3) · (−4) · (−5) · (−1) = −120' },
      { step: 6, name: 'חילוק עם סימנים', math: '−36 ÷ (−9) = 4' },
      { step: 7, name: 'סדר פעולות עם מינוס', math: '−2 + 3 · (−4) = −14' }
    ],
    bonus: {
      label: 'מכונת הסימנים לתרגול', closeLabel: 'סגור את המכונה', hint: 'בחר קודם סימן, אחר כך גודל, ובדוק.',
      setup: function (box, ctx) {
        var task = null, pick = null, size = 0;
        box.innerHTML = '<div class="bTitle">מכונת הסימנים</div>'
          + '<div class="bSub">בחר קודם את הסימן של התוצאה, ואחר כך את הגודל שלה.</div>'
          + '<div class="bChip" data-expr dir="ltr"></div>'
          + '<div dir="ltr" style="display:flex;justify-content:center;gap:10px">'
          + '<button type="button" data-sign="plus" aria-pressed="false" aria-label="הסימן חיובי" style="min-height:44px;min-width:56px;border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.soft + ';color:' + PAL.dark + ';font-family:Secular One,sans-serif;font-size:22px">+</button>'
          + '<button type="button" data-sign="minus" aria-pressed="false" aria-label="הסימן שלילי" style="min-height:44px;min-width:56px;border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.soft + ';color:' + PAL.dark + ';font-family:Secular One,sans-serif;font-size:22px">' + MINUS + '</button></div>'
          + '<div class="stepper" dir="ltr" style="align-self:stretch"><div class="unit" dir="ltr">'
          + '<button type="button" data-step="-10" aria-label="הקטן את הגודל ב־10">' + MINUS + '10</button>'
          + '<button type="button" data-step="-1" aria-label="הקטן את הגודל ב־1">' + MINUS + '</button>'
          + '<bdi class="var math" dir="ltr" data-size style="min-width:34px" aria-live="polite">0</bdi>'
          + '<button type="button" data-step="1" aria-label="הגדל את הגודל ב־1">+</button>'
          + '<button type="button" data-step="10" aria-label="הגדל את הגודל ב־10">+10</button></div></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">תרגיל חדש ↻</button>';
        var okNode = box.querySelector('[data-ok]'), formsNode = box.querySelector('[data-forms]');
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function randomSign() { return Math.random() < 0.5 ? -1 : 1; }
        function build() {
          var kind = rnd(0, 2), t = { kind: kind, factors: [], text: '', answer: 0, minuses: 0 };
          if (kind === 2) {
            var d = rnd(2, 9) * randomSign(), q = rnd(2, 9) * randomSign();
            t.factors = [d * q, d];
            t.answer = q;
            t.text = num(d * q) + DIV + par(d) + ' = ?';
          } else {
            var count = kind === 0 ? 2 : 3, p = 1;
            for (var i = 0; i < count; i++) {
              var f = (kind === 0 ? rnd(2, 9) : rnd(2, 4)) * randomSign();
              t.factors.push(f); p *= f;
            }
            t.answer = p;
            t.text = t.factors.map(par).join(DOT) + ' = ?';
          }
          t.factors.forEach(function (f) { if (f < 0) t.minuses += 1; });
          return t;
        }
        function render() {
          box.querySelector('[data-expr]').textContent = task.text;
          box.querySelector('[data-size]').textContent = String(size);
          box.querySelectorAll('[data-sign]').forEach(function (b) {
            var on = pick === b.getAttribute('data-sign');
            b.setAttribute('aria-pressed', String(on));
            b.style.background = on ? PAL.warmSoft : PAL.soft;
            b.style.borderColor = on ? WARMDARK : PAL.main;
          });
        }
        function roll() {
          task = build(); pick = null; size = 0;
          okNode.hidden = true; formsNode.hidden = true;
          render();
        }
        box.querySelectorAll('[data-sign]').forEach(function (b) {
          b.addEventListener('click', function () { pick = b.getAttribute('data-sign'); okNode.hidden = true; ctx.sfx('click'); render(); });
        });
        box.querySelectorAll('[data-step]').forEach(function (b) {
          b.addEventListener('click', function () {
            size = clamp(size + Number(b.getAttribute('data-step')), 0, 99);
            okNode.hidden = true; ctx.sfx('tick'); render();
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          okNode.hidden = false;
          var wantSign = task.answer < 0 ? 'minus' : 'plus';
          var parity = task.minuses % 2 === 1 ? 'אי־זוגי' : 'זוגי';
          var countText = 'יש ' + bdi(String(task.minuses)) + ' גורמים שליליים, מספר ' + parity + ', ולכן הסימן ' + (task.answer < 0 ? 'שלילי' : 'חיובי') + '.';
          var good = false, text;
          if (!pick) text = 'בחר קודם סימן, פלוס או מינוס.';
          else if (pick === wantSign && size === Math.abs(task.answer)) { good = true; text = 'נכון! הסימן והגודל נכונים. ' + countText; }
          else if (pick === wantSign) text = 'הסימן נכון. הגודל עדיין לא: כפול או חלק את הגדלים, בלי הסימנים.';
          else if (size === Math.abs(task.answer)) text = 'הגודל נכון, אבל הסימן לא. ספור את הגורמים השליליים: ' + countText;
          else text = 'גם הסימן וגם הגודל לא מדויקים. קודם ספור מינוסים, ואחר כך חשב את הגודל.';
          okNode.innerHTML = text;
          okNode.style.color = good ? PAL.good : BAD;
          ctx.sfx(good ? 'correct' : 'error');
          if (good) {
            formsNode.hidden = false;
            formsNode.innerHTML = bdi(task.text.replace('?', num(task.answer)));
          } else formsNode.hidden = true;
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); });
        roll();
      }
    }
  });
}());
