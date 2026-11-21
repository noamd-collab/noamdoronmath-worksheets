/**
 * מגדל החזקות — an engine game.
 *
 * The idea: the exponent counts how many times the base is a factor; a square of side n
 * holds n² tiles, and the square root walks back from the area to the side.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402, H = 330;
  var MUTED = '#475569', BAD = '#b91c1c', NEG = '#c2410c';
  var MINUS = '\u2212';

  function num(v) { return v < 0 ? MINUS + Math.abs(v) : String(v); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mt(x, y, label, size, colour, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 16)
      + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function ht(x, y, label, size, colour, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 13)
      + '" font-weight="700" fill="' + (colour || MUTED) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function stepperHtml(id, label, minusLabel, plusLabel, start) {
    return '<div class="stepper" dir="ltr" style="align-self:stretch"><div class="unit" dir="ltr">'
      + '<bdi class="math var" dir="ltr">' + label + '</bdi>'
      + '<button type="button" id="' + id + 'Minus" aria-label="' + minusLabel + '">' + MINUS + '</button>'
      + '<bdi class="var math" dir="ltr" data-value style="min-width:44px" aria-live="polite">' + start + '</bdi>'
      + '<button type="button" id="' + id + 'Plus" aria-label="' + plusLabel + '">+</button></div></div>';
  }
  function handleHtml(id, label, lo, hi) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + lo + '" aria-valuemax="' + hi
      + '" aria-valuenow="' + lo + '" style="cursor:grab">'
      + '<rect x="-30" y="-30" width="60" height="60" rx="12" fill="transparent"/>'
      + '<circle r="10" fill="' + PAL.dark + '" stroke="#fff" stroke-width="3"/></g>';
  }
  /** Arrow keys, Home and End on a slider handle. */
  function wireKeys(handle, lo, hi, get, set) {
    handle.addEventListener('keydown', function (event) {
      var k = event.key, v = get();
      if (k === 'ArrowRight' || k === 'ArrowUp') v += 1;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') v -= 1;
      else if (k === 'Home') v = lo;
      else if (k === 'End') v = hi;
      else return;
      event.preventDefault();
      set(clamp(v, lo, hi), true);
    });
  }
  function wireStepper(box, id, get, set, lo, hi) {
    box.querySelector('#' + id + 'Minus').addEventListener('click', function () { set(clamp(get() - 1, lo, hi), true); });
    box.querySelector('#' + id + 'Plus').addEventListener('click', function () { set(clamp(get() + 1, lo, hi), true); });
  }
  function syncStepper(box, id, v, lo, hi) {
    box.querySelector('[data-value]').textContent = String(v);
    box.querySelector('#' + id + 'Minus').disabled = v <= lo;
    box.querySelector('#' + id + 'Plus').disabled = v >= hi;
  }

  /* ---------- scene 1: building a square ---------- */
  var U1 = 26, GX = 24, GY = 306;
  function squareScene(ctx) {
    var n = 3, completed = false;
    var statics = '';
    for (var g = 0; g <= 10; g++) {
      statics += '<line x1="' + (GX + g * U1) + '" y1="' + (GY - 10 * U1) + '" x2="' + (GX + g * U1) + '" y2="' + GY + '" stroke="' + PAL.line + '" stroke-width="0.7" opacity=".6"/>'
        + '<line x1="' + GX + '" y1="' + (GY - g * U1) + '" x2="' + (GX + 10 * U1) + '" y2="' + (GY - g * U1) + '" stroke="' + PAL.line + '" stroke-width="0.7" opacity=".6"/>';
    }
    ctx.draw(statics + '<g id="sqDyn"></g>' + handleHtml('sqHandle', 'פינת הריבוע; שנה את הצלע בעזרת מקשי החצים', 1, 10));
    var handle = ctx.el('sqHandle');
    var box = ctx.extra(stepperHtml('sq', 'n', 'הקטן את הצלע באחד', 'הגדל את הצלע באחד', n));
    ctx.register('sqControls', box);
    function update(acted) {
      var v = n * n, tiles = '';
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          tiles += '<rect x="' + (GX + i * U1 + 0.5) + '" y="' + (GY - (j + 1) * U1 + 0.5) + '" width="' + (U1 - 1) + '" height="' + (U1 - 1)
            + '" rx="3" fill="' + ((i + j) % 2 ? PAL.soft : PAL.warmSoft) + '" stroke="' + PAL.main + '" stroke-width="1.2"/>';
        }
      }
      var dyn = tiles + mt(GX + n * U1 / 2, GY + 17, 'n = ' + n, 14, PAL.dark)
        + mt(346, 120, n + '² = ' + v, 19, PAL.dark) + mt(346, 152, n + ' · ' + n, 17, PAL.ink) + ht(346, 180, 'אריחים', 14, MUTED);
      ctx.el('sqDyn').innerHTML = dyn;
      handle.setAttribute('transform', 'translate(' + (GX + n * U1) + ' ' + (GY - n * U1) + ')');
      handle.setAttribute('aria-valuenow', String(n));
      handle.setAttribute('aria-valuetext', 'צלע ' + n + ', ' + v + ' אריחים');
      syncStepper(box, 'sq', n, 1, 10);
      ctx.caption('המטרה: ' + m('49') + ' אריחים · כרגע: ' + m(n + '² = ' + v));
      if (n === 7) {
        ctx.note('בדיוק: ' + m('7²= 7 · 7 = 49') + ' אריחים. הצלע ' + m('7') + ' נספרת פעמיים, פעם לכל שורה.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else {
        ctx.note('המעריך אומר שוב מכפילים: ' + m(n + '² = ' + n + ' · ' + n + ' = ' + v) + ', ולא ' + m(n + ' · 2 = ' + (2 * n))
          + '. ' + (v < 49 ? 'עוד חסרים אריחים, הגדל את הצלע.' : 'יש יותר מדי אריחים, הקטן את הצלע.'));
      }
    }
    function setN(v, acted) { n = v; ctx.sfx('tick'); update(acted); }
    wireStepper(box, 'sq', function () { return n; }, setN, 1, 10);
    wireKeys(handle, 1, 10, function () { return n; }, setN);
    ctx.drag(handle, {
      move: function (x, y) { n = clamp(Math.round(((x - GX) + (GY - y)) / 2 / U1), 1, 10); update(false); },
      end: function () { update(true); }
    });
    update(false);
  }

  /* ---------- scene 3: where is the minus ---------- */
  var TX0 = 70, TDX = 65, TY = 138;
  function minusScene(ctx) {
    var b = 1, completed = false;
    var s = '<rect x="8" y="6" width="188" height="96" rx="12" fill="' + PAL.warmSoft + '" stroke="' + NEG + '" stroke-width="1.5"/>'
      + '<rect x="206" y="6" width="188" height="96" rx="12" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '" stroke-width="1.5"/>'
      + '<line x1="' + TX0 + '" y1="' + TY + '" x2="' + (TX0 + 4 * TDX) + '" y2="' + TY + '" stroke="' + PAL.line + '" stroke-width="4" stroke-linecap="round"/>'
      + mt(32, TY + 5, 'b', 17, PAL.dark);
    for (var t = 1; t <= 5; t++) s += mt(TX0 + (t - 1) * TDX, TY - 24, String(t), 13, MUTED);
    s += '<line x1="30" y1="232" x2="250" y2="232" stroke="' + PAL.ink + '" stroke-width="1.8"/>'
      + ht(322, 236, 'קו האפס', 13, MUTED) + ht(322, 190, 'מעל האפס', 12, PAL.good) + ht(322, 280, 'מתחת לאפס', 12, NEG);
    ctx.draw(s + '<g id="mnDyn"></g>' + handleHtml('bHandle', 'הבסיס b; שנה את הערך בעזרת מקשי החצים', 1, 5));
    var handle = ctx.el('bHandle');
    var box = ctx.extra(stepperHtml('bs', 'b', 'הקטן את b באחד', 'הגדל את b באחד', b));
    ctx.register('bControls', box);
    function update() {
      var sq = b * b;
      var dyn = mt(102, 34, MINUS + b + '²', 24, NEG) + mt(102, 62, MINUS + '(' + b + ' · ' + b + ') = ' + MINUS + sq, 15, PAL.ink)
        + ht(102, 88, 'המינוס מחוץ לחזקה', 13, NEG)
        + mt(300, 34, '(' + MINUS + b + ')²', 24, PAL.good) + mt(300, 62, '(' + MINUS + b + ') · (' + MINUS + b + ') = ' + sq, 15, PAL.ink)
        + ht(300, 88, 'המינוס בתוך החזקה', 13, PAL.good)
        + '<rect x="70" y="232" width="60" height="' + (3 * sq) + '" fill="' + NEG + '"/>' + mt(100, 232 + 3 * sq + 16, MINUS + sq, 15, NEG)
        + '<rect x="160" y="' + (232 - 3 * sq) + '" width="60" height="' + (3 * sq) + '" fill="' + PAL.good + '"/>' + mt(190, 232 - 3 * sq - 6, String(sq), 15, PAL.good);
      ctx.el('mnDyn').innerHTML = dyn;
      handle.setAttribute('transform', 'translate(' + (TX0 + (b - 1) * TDX) + ' ' + TY + ')');
      handle.setAttribute('aria-valuenow', String(b));
      syncStepper(box, 'bs', b, 1, 5);
      ctx.caption('המטרה: ' + m('b = 3') + ' ובחירה בכרטיס הגדול · כרגע ' + m('b = ' + b));
    }
    function setB(v) { b = v; ctx.sfx('tick'); update(); ctx.note('כל כרטיס מראה את הערך שלו לפי ' + m('b = ' + b) + '. השווה את שני הפסים ביחס לקו האפס.'); }
    wireStepper(box, 'bs', function () { return b; }, setB, 1, 5);
    wireKeys(handle, 1, 5, function () { return b; }, setB);
    ctx.drag(handle, {
      move: function (x) { var nb = clamp(Math.round((x - TX0) / TDX) + 1, 1, 5); if (nb !== b) { b = nb; update(); } },
      end: function () { setB(b); }
    });
    ctx.button('הכרטיס הימני גדול יותר', function () {
      if (b !== 3) {
        ctx.sfx('error');
        ctx.note('קודם קבע ' + m('b = 3') + '. כרגע ' + m('b = ' + b) + ', וכל כרטיס מראה ערך אחר.');
      } else {
        ctx.note('נכון: ' + m('(' + MINUS + '3)² = 9') + ' חיובי, ואילו ' + m(MINUS + '3² = ' + MINUS + '9') + ' שלילי. הסוגריים מכניסים את המינוס לבסיס.', 'good');
        if (!completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      }
    }, { id: 'pickRight', target: 'pickRight' });
    ctx.button('הכרטיס השמאלי גדול יותר', function () {
      ctx.sfx('error');
      ctx.note(b === 3
        ? 'בלי סוגריים החזקה שייכת ל־' + m('3') + ' בלבד, והמינוס נשאר בחוץ: ' + m(MINUS + '(3 · 3) = ' + MINUS + '9') + ', מתחת לאפס. הכרטיס הימני גדול יותר.'
        : 'בלי סוגריים החזקה שייכת לבסיס בלבד, והמינוס נשאר בחוץ, ולכן הפס השמאלי יורד מתחת לאפס. התבונן שוב בשני הפסים.');
    }, { id: 'pickLeft', target: 'pickLeft' });
    update();
    ctx.note('קבע ' + m('b = 3') + ' ובחר איזה כרטיס גדול יותר.');
  }

  /* ---------- scene 5: from area to side ---------- */
  var AREAS = [4, 9, 16, 25, 36, 49, 50, 64, 81, 100];
  var U5 = 24;
  function rootScene(ctx) {
    var idx = 0, completed = false;
    var s = '';
    for (var g = 0; g <= 10; g++) {
      s += '<line x1="' + (GX + g * U5) + '" y1="' + (GY - 10 * U5) + '" x2="' + (GX + g * U5) + '" y2="' + GY + '" stroke="' + PAL.line + '" stroke-width="0.6" opacity=".5"/>'
        + '<line x1="' + GX + '" y1="' + (GY - g * U5) + '" x2="' + (GX + 10 * U5) + '" y2="' + (GY - g * U5) + '" stroke="' + PAL.line + '" stroke-width="0.6" opacity=".5"/>';
    }
    ctx.draw(s + '<g id="rtDyn"></g>' + handleHtml('areaHandle', 'פינת הריבוע; שנה את השטח בעזרת מקשי החצים', 0, 9));
    var handle = ctx.el('areaHandle');
    var box = ctx.extra(stepperHtml('ar', 'A', 'הקטן את השטח לערך הקודם', 'הגדל את השטח לערך הבא', AREAS[0]));
    ctx.register('arControls', box);
    function drawSq(side, fill, stroke, dash) {
      return '<rect x="' + GX + '" y="' + (GY - side * U5) + '" width="' + (side * U5) + '" height="' + (side * U5) + '" fill="' + fill + '" stroke="' + stroke
        + '" stroke-width="2"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    }
    function update(acted) {
      var A = AREAS[idx], side = Math.sqrt(A), perfect = Math.round(side) * Math.round(side) === A, dyn;
      if (perfect) {
        dyn = drawSq(side, PAL.soft, PAL.main, false) + mt(GX + side * U5 / 2, GY - side * U5 / 2 + 6, 'A = ' + A, 17, PAL.dark)
          + mt(GX + side * U5 / 2, GY + 17, side, 14, PAL.dark)
          + ht(346, 96, 'הצלע היא', 13, MUTED) + mt(346, 128, '\u221A' + A + ' = ' + side, 19, PAL.dark)
          + mt(346, 160, side + ' · ' + side + ' = ' + A, 14, PAL.ink);
      } else {
        dyn = drawSq(8, 'none', PAL.good, true) + drawSq(7, 'none', PAL.good, true) + drawSq(side, PAL.soft, PAL.main, false)
          + mt(GX + side * U5 / 2, GY - side * U5 / 2 + 6, 'A = ' + A, 17, PAL.dark)
          + ht(346, 96, 'הצלע בין', 13, MUTED) + mt(346, 124, '7 < \u221A50 < 8', 14, PAL.dark)
          + mt(346, 152, '7² = 49', 14, PAL.ink) + mt(346, 174, '8² = 64', 14, PAL.ink);
      }
      ctx.el('rtDyn').innerHTML = dyn;
      handle.setAttribute('transform', 'translate(' + (GX + side * U5) + ' ' + (GY - side * U5) + ')');
      handle.setAttribute('aria-valuenow', String(idx));
      handle.setAttribute('aria-valuetext', 'שטח ' + A);
      syncStepper(box, 'ar', A, 0, 0);
      box.querySelector('#arMinus').disabled = idx <= 0;
      box.querySelector('#arPlus').disabled = idx >= AREAS.length - 1;
      ctx.caption('המטרה: שטח ' + m('64') + ' · כרגע: ' + m('A = ' + A));
      if (A === 64) {
        ctx.note('נכון: ' + m('\u221A64 = 8') + ', כי ' + m('8 · 8 = 64') + '. השורש חוזר מהשטח אל הצלע.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (perfect) {
        ctx.note('הצלע של שטח ' + m(String(A)) + ' היא ' + m(String(side)) + ', כי ' + m(side + ' · ' + side + ' = ' + A) + '. השורש אינו חצי מהשטח, שהיה ' + m(String(A / 2)) + '.');
      } else {
        ctx.note('שטח ' + m('50') + ' אינו ריבוע שלם: הצלע גדולה מ־' + m('7') + ' וקטנה מ־' + m('8') + ', בין שני הריבועים המקווקווים.');
      }
    }
    function setIdx(v, acted) { idx = v; ctx.sfx('tick'); update(acted); }
    wireStepper(box, 'ar', function () { return idx; }, setIdx, 0, AREAS.length - 1);
    wireKeys(handle, 0, AREAS.length - 1, function () { return idx; }, setIdx);
    ctx.drag(handle, {
      move: function (x, y) {
        var want = ((x - GX) + (GY - y)) / 2 / U5, best = 0;
        AREAS.forEach(function (a, i) { if (Math.abs(Math.sqrt(a) - want) < Math.abs(Math.sqrt(AREAS[best]) - want)) best = i; });
        idx = best; update(false);
      },
      end: function () { update(true); }
    });
    update(false);
  }

  var steps = [
    {
      mode: 'intro', tA: 'מגדל החזקות', sub: 'חזקה אומרת כמה פעמים הבסיס הוא גורם.',
      tip: 'שלום, אני אליהו. נבנה ריבועים מאריחים ונגלה מה עושה המעריך.',
      emoji: '🧱', eq: m('3² = 3 · 3'),
      note: 'המעריך ' + m('2') + ' אומר שכופלים את ' + m('3') + ' בעצמו פעמיים. ' + m('3²') + ' אינו ' + m('3 · 2') + '.',
      cue: 'מוכן לבנות ריבוע?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'בונים ריבוע', sub: 'הגדל את הצלע בגרירה, בכפתורים או בחיצים עד שהריבוע מכיל ' + m('49') + ' אריחים.',
      tip: 'כל שורה מכילה ' + m('n') + ' אריחים, ויש ' + m('n') + ' שורות. גרור את הפינה או לחץ על החצים.',
      aspect: [W, H], alt: 'רשת של עשר על עשר משבצות ובה ריבוע אריחים שצלעו n, עם ידית בפינה העליונה הימנית',
      cue: 'בנה ריבוע של 49 אריחים', cueDone: 'בנית ריבוע של 49 אריחים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'sqControls', text: 'לחץ על הפלוס כדי להגדיל את הצלע, ובדוק כמה אריחים יש.' }, setup: squareScene
    },
    {
      mode: 'quiz', tA: 'כמה יוצא', tM: '5²', tB: '?', sub: 'חזקה היא כפל חוזר של הבסיס.',
      tip: 'חשוב על ריבוע שצלעו ' + m('5') + '. כמה אריחים יש בו?', btn: 'המשך ←',
      win: 'בדיוק. חמש שורות של חמישה.', wrongSay: 'בדוק כמה פעמים כופלים ומה כופלים.',
      opts: [
        { t: m('25'), c: true, f: m('5² = 5 · 5 = 25') + ': הבסיס ' + m('5') + ' הוא גורם פעמיים.' },
        { t: m('10'), f: 'הכפלת ' + m('5') + ' ב־' + m('2') + ', כלומר ' + m('5 · 2') + '. המעריך אינו המספר שכופלים בו, אלא כמה פעמים הבסיס מופיע כגורם.' },
        { t: m('15'), f: 'חיברת ' + m('5') + ' שלוש פעמים. חזקה היא כפל, לא חיבור, והמעריך כאן ' + m('2') + ', לא ' + m('3') + '.' },
        { t: m('55'), f: 'כתבת את הספרה ' + m('5') + ' פעמיים ולא כפלת. ' + m('5²') + ' פירושו ' + m('5 · 5') + '.' }
      ],
      hints: ['המעריך אומר כמה פעמים כותבים את הבסיס כגורם.', 'כתוב ' + m('5²') + ' כמכפלה של שני גורמים שווים.', m('5 · 5') + ' הוא ריבוע עם חמש שורות.']
    },
    {
      mode: 'scene', tA: 'איפה המינוס', sub: 'קבע ' + m('b = 3') + ' בגרירה, בכפתורים או בחיצים, ובחר איזה כרטיס גדול יותר.',
      tip: 'הסוגריים קובעים אם המינוס נכנס לחזקה. שים לב איפה הפס נוחת.',
      aspect: [W, H], alt: 'שני כרטיסים, ' + 'מינוס בי בריבוע משמאל וסוגריים מינוס בי בריבוע מימין, ומתחתם תרשים פסים ביחס לקו האפס',
      cue: 'קבע b = 3 ובחר את הכרטיס הגדול', cueDone: 'בחרת נכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'bControls', text: 'שנה את ' + m('b') + ' וראה מה קורה לשני הפסים.' }, setup: minusScene
    },
    {
      mode: 'quiz', tA: 'כמה יוצא', tM: '(' + MINUS + '2)⁴', tB: '?', sub: 'ארבעה גורמים, וכולם ' + m(MINUS + '2') + '.',
      tip: 'כתוב ארבעה גורמים וחשב בזוגות.', btn: 'המשך ←',
      win: 'נכון. מספר זוגי של מינוסים נותן תוצאה חיובית.', wrongSay: 'בדוק את הסימן ואת הכפל.',
      opts: [
        { t: m('16'), c: true, f: m('(' + MINUS + '2)(' + MINUS + '2) = 4') + ' ואז ' + m('4 · 4 = 16') + ': ארבעה מינוסים מתחלקים לזוגות וההפיכה חוזרת לחיובי.' },
        { t: m(MINUS + '16'), f: 'השארת את המינוס אף על פי שהמעריך זוגי. כל שני מינוסים נותנים חיובי, ולכן ארבעה נותנים חיובי.' },
        { t: m('8'), f: 'כפלת ' + m('2') + ' ב־' + m('4') + ' במקום לכפול את ' + m(MINUS + '2') + ' בעצמו ארבע פעמים.' },
        { t: m(MINUS + '8'), f: 'כפלת את הבסיס במעריך, ועוד שמרת מינוס. שני הדברים שגויים: זו חזקה ולא כפל פשוט.' }
      ],
      hints: ['כתוב את הבסיס ' + m(MINUS + '2') + ' ארבע פעמים בכפל.', 'כפול שני גורמים בכל פעם והסתכל על הסימן.', m('(' + MINUS + '2)² = 4') + ', ועוד פעם ' + m('4') + ' בכפל ' + m('4') + '.']
    },
    {
      mode: 'scene', tA: 'מהשטח אל הצלע', sub: 'בחר שטח ' + m('64') + ' בגרירה, בכפתורים או בחיצים וקרא את הצלע.',
      tip: 'השורש מחפש את המספר שכפול בעצמו נותן את השטח.',
      aspect: [W, H], alt: 'ריבוע על רשת עשר על עשר ששטחו נבחר מרשימה, עם ידית בפינה וקריאת הצלע מצד ימין',
      cue: 'הגע לשטח 64 וקרא את הצלע', cueDone: 'קראת את הצלע של שטח 64. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'arControls', text: 'לחץ על הפלוס כדי לעבור לשטח הבא ברשימה.' }, setup: rootScene
    },
    {
      mode: 'quiz', tA: 'כמה יוצא', tM: '\u221A81', tB: '?', sub: 'מחפשים את אורך הצלע של ריבוע ששטחו ' + m('81') + '.',
      tip: 'איזה מספר כפול עצמו נותן ' + m('81') + '?', btn: 'המשך ←',
      win: 'נכון. תשע על תשע הוא שמונים ואחד.', wrongSay: 'בדוק אם המספר כפול עצמו נותן ' + m('81') + '.',
      opts: [
        { t: m('9'), c: true, f: m('9 · 9 = 81') + ', ולכן ' + m('\u221A81 = 9') + '.' },
        { t: m('40.5'), f: 'חילקת את ' + m('81') + ' בשתיים. השורש אינו חצי: מחפשים מספר שכפול בעצמו נותן ' + m('81') + '.' },
        { t: m('8'), f: 'בלבלת עם ' + m('\u221A64 = 8') + '. ' + m('8 · 8 = 64') + ', לא ' + m('81') + '.' },
        { t: m('18'), f: 'כפלת את ' + m('9') + ' בשתיים. השורש הוא ' + m('9') + ' עצמו, כי ' + m('9 · 9 = 81') + '.' }
      ],
      hints: ['חפש מספר שכפול בעצמו נותן את השטח.', 'נסה מספרים בין ' + m('8') + ' ל־' + m('10') + '.', m('9 · 9') + ' הוא ' + m('81') + '.']
    },
    {
      mode: 'quiz', tA: 'כמה יוצא', tM: '2³ · 2²', tB: '?', sub: 'אותו בסיס בשתי חזקות.',
      tip: 'כמה גורמים של ' + m('2') + ' יש בסך הכול?', btn: 'לסיכום ←',
      win: 'נכון. אותו בסיס, והמעריכים מתחברים.', wrongSay: 'ספור כמה פעמים ' + m('2') + ' מופיע כגורם.',
      opts: [
        { t: m('32'), c: true, f: m('2³ · 2² = 2⁵ = 32') + ': אותו בסיס נשאר, והמעריכים מתחברים.' },
        { t: m('64'), f: 'כפלת את המעריכים ' + m('3 · 2 = 6') + ' וקיבלת ' + m('2⁶') + '. בכפל חזקות עם אותו בסיס המעריכים מתחברים.' },
        { t: m('16'), f: m('2⁴') + ' כולל רק ארבעה גורמים של ' + m('2') + '. כאן יש שלושה ועוד שניים, חמישה בסך הכול.' },
        { t: m('10'), f: 'חיברת את המעריכים נכון, ' + m('5') + ', אבל אז כפלת את הבסיס ב־' + m('5') + '. החיבור בא במעריך: ' + m('2⁵') + '.' }
      ],
      hints: ['כתוב כל חזקה כמכפלה של גורמים.', m('2³') + ' הם שלושה גורמים ו־' + m('2²') + ' הם שניים.', 'יש חמישה גורמים של ' + m('2') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את מגדל החזקות', sub: 'החזקה בונה ריבוע, והשורש מחזיר את הצלע.',
      tip: 'כל הכבוד. עכשיו אתה יודע מה עושה המעריך ואיך חוזרים מהשטח אל הצלע.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'החזקה בונה את הריבוע, השורש נותן את הצלע, ובכפל חזקות עם אותו בסיס המעריכים מתחברים:',
      formula: m('aⁿ · aᵐ = aⁿ⁺ᵐ')
    }
  ];

  function pow(a, k) { var r = 1; for (var i = 0; i < k; i++) r *= a; return r; }
  function shuffle(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }
  function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  window.NoamGame.boot({
    slug: 'migdal-hechezkot', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'חזקה כמכפלה חוזרת', math: '5² = 25' },
      { step: 4, name: 'סוגריים ומינוס בחזקה', math: '(−2)⁴ = 16' },
      { step: 6, name: 'שורש ריבועי', math: '√81 = 9' },
      { step: 7, name: 'כפל חזקות באותו בסיס', math: '2³ · 2² = 2⁵' }
    ],
    bonus: {
      label: 'מכונת החזקות והשורשים', closeLabel: 'סגור את המכונה', hint: 'חזקה, שורש או אומדן: לחץ על ההטלה לשאלה חדשה.',
      setup: function (box, ctx) {
        var kind = rnd(0, 2), answer = 0, lower = 5, solvedNow = false;
        box.innerHTML = '<div class="bTitle">מכונת החזקות והשורשים</div><div class="bSub" data-q></div>'
          + '<div class="bChip" data-expr dir="ltr"></div>'
          + '<div data-ans style="display:flex;flex-direction:column;gap:8px;align-items:stretch"></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">שאלה חדשה ↻</button>';
        var q = box.querySelector('[data-q]'), expr = box.querySelector('[data-expr]'), ans = box.querySelector('[data-ans]');
        var forms = box.querySelector('[data-forms]'), ok = box.querySelector('[data-ok]');
        function verdict(good, text, formula) {
          ok.hidden = false; ok.textContent = text; ok.style.color = good ? PAL.good : BAD;
          ctx.sfx(good ? 'correct' : 'error');
          if (good) { forms.hidden = false; forms.innerHTML = bdi(formula); solvedNow = true; }
        }
        function optionButtons(values, hintWrong) {
          ans.innerHTML = '';
          shuffle(values).forEach(function (v) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'bDice'; b.style.minHeight = '44px'; b.style.minWidth = '44px';
            b.innerHTML = bdi(num(v)); b.setAttribute('aria-label', num(v));
            b.addEventListener('click', function () {
              if (solvedNow) return;
              if (v === answer) verdict(true, 'נכון!', box.getAttribute('data-formula'));
              else verdict(false, hintWrong(v));
            });
            ans.appendChild(b);
          });
        }
        function uniq(list, fix) {
          var out = [];
          list.forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); });
          var extra = 1;
          while (out.length < 4) { var c = fix + extra * (extra % 2 ? 1 : -1) * 2; extra++; if (out.indexOf(c) < 0) out.push(c); }
          return out.slice(0, 4);
        }
        function roll() {
          kind = (kind + 1) % 3; solvedNow = false; forms.hidden = true; ok.hidden = true;
          if (kind === 0) {
            var a = rnd(2, 6), k = rnd(2, 3), neg = Math.random() < 0.4 && a <= 4;
            answer = neg ? pow(-a, k) : pow(a, k);
            q.textContent = 'כמה יוצא הביטוי?';
            expr.textContent = neg ? '(' + MINUS + a + ')' + (k === 2 ? '²' : '³') : a + (k === 2 ? '²' : '³');
            box.setAttribute('data-formula', expr.textContent + ' = ' + num(answer));
            optionButtons(uniq([answer, a * k, -answer, answer + a], answer), function (v) {
              if (v === a * k) return 'כפלת את הבסיס במעריך. המעריך אומר כמה פעמים הבסיס הוא גורם.';
              if (v === -answer) return 'בדוק את הסימן: סוגריים, ומספר זוגי או אי־זוגי של גורמים שליליים.';
              return 'כתוב את הבסיס כגורם כמה פעמים שהמעריך אומר, וכפול.';
            });
          } else if (kind === 1) {
            var r = rnd(3, 15);
            answer = r;
            q.textContent = 'מהי הצלע של ריבוע שהשטח שלו:';
            expr.textContent = '\u221A' + (r * r);
            box.setAttribute('data-formula', '\u221A' + (r * r) + ' = ' + r + ', ' + r + ' · ' + r + ' = ' + (r * r));
            optionButtons(uniq([r, r - 1, r + 1, r * r / 2], r), function (v) {
              if (v === r * r / 2) return 'חילקת את השטח בשתיים. השורש אינו חצי: חפש מספר שכפול בעצמו נותן את השטח.';
              return 'בדוק: כפול את המספר בעצמו. האם יצא השטח?';
            });
          } else {
            var low = rnd(2, 11), nn = rnd(low * low + 1, (low + 1) * (low + 1) - 1);
            answer = low; lower = rnd(1, 12);
            q.innerHTML = '';
            q.textContent = 'בין אילו שני מספרים שלמים נמצא הערך? בחר את הקטן.';
            expr.textContent = '\u221A' + nn;
            box.setAttribute('data-formula', low + '² = ' + (low * low) + ' < ' + nn + ' < ' + ((low + 1) * (low + 1)) + ' = ' + (low + 1) + '²');
            ans.innerHTML = '<div class="stepper" dir="ltr"><div class="unit" dir="ltr">'
              + '<button type="button" id="bRangeMinus" aria-label="הקטן את המספר התחתון">' + MINUS + '</button>'
              + '<bdi class="var math" dir="ltr" data-range style="min-width:110px"></bdi>'
              + '<button type="button" id="bRangePlus" aria-label="הגדל את המספר התחתון">+</button></div></div>'
              + '<button type="button" class="bDice" id="bRangeCheck" style="min-height:44px;min-width:44px">בדוק</button>';
            var show = function () { ans.querySelector('[data-range]').textContent = lower + ' < \u221A' + nn + ' < ' + (lower + 1); };
            show();
            ans.querySelector('#bRangeMinus').addEventListener('click', function () { lower = clamp(lower - 1, 1, 12); show(); });
            ans.querySelector('#bRangePlus').addEventListener('click', function () { lower = clamp(lower + 1, 1, 12); show(); });
            ans.querySelector('#bRangeCheck').addEventListener('click', function () {
              if (solvedNow) return;
              if (lower === low) verdict(true, 'נכון!', box.getAttribute('data-formula'));
              else verdict(false, lower * lower > nn ? 'הריבוע של התחתון כבר גדול מהשטח. הקטן.' : 'הריבוע של העליון עדיין קטן מהשטח. הגדל.');
            });
          }
        }
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); });
        roll();
      }
    }
  });
}());
