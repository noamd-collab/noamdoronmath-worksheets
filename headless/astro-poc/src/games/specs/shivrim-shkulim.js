/**
 * שברים שקולים — an engine game for grades 4-5.
 *
 * The idea: cut every piece in two and both the number of painted pieces and
 * the number of all pieces double together. The painted area never changes,
 * so the fraction is the same fraction. Dividing both numbers by the same
 * number (reducing) is the same move run backwards.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var CHOC = '#7b4a2a', CHOC_SOFT = '#f6e8d6', CHOC_LINE = '#c9a27a';
  var WARM = '#f59e0b', GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef';
  var FONT = 'Secular One, sans-serif';

  /** A stacked fraction in SVG: numerator over a line over a denominator. */
  function frac(cx, yLine, n, d, fs, color, idN, idD) {
    var len = Math.max(String(n).length, String(d).length);
    var hw = Math.max(10, len * fs * 0.32 + 6);
    return '<g font-family="' + FONT + '" font-size="' + fs + '" fill="' + color + '" text-anchor="middle">'
      + '<text' + (idN ? ' id="' + idN + '"' : '') + ' x="' + cx + '" y="' + (yLine - fs * 0.28) + '">' + n + '</text>'
      + '<line x1="' + (cx - hw) + '" y1="' + yLine + '" x2="' + (cx + hw) + '" y2="' + yLine + '"'
      + ' stroke="' + color + '" stroke-width="' + Math.max(2, fs / 14) + '" stroke-linecap="round"/>'
      + '<text' + (idD ? ' id="' + idD + '"' : '') + ' x="' + cx + '" y="' + (yLine + fs * 0.92) + '">' + d + '</text>'
      + '</g>';
  }

  /** A bar of `parts` equal cells, the first `colored` painted. */
  function barCells(x, y, w, h, parts, colored, fillOn, fillOff, line, idPrefix) {
    var out = '', cw = w / parts, i;
    for (i = 0; i < parts; i++) {
      out += '<rect' + (idPrefix ? ' id="' + idPrefix + i + '"' : '')
        + ' x="' + (x + i * cw) + '" y="' + y + '" width="' + cw + '" height="' + h + '"'
        + ' fill="' + (i < colored ? fillOn : fillOff) + '" stroke="' + line + '" stroke-width="1.6"/>';
    }
    return out;
  }

  /* ---------- step 1: cut every piece in two ---------- */
  function chocolateScene(ctx) {
    var p = 2, done = false, busy = false;
    var X = 30, Y = 100, BW = 240, BH = 100;

    function render(prev, l) {
      var cur = prev ? prev : p;
      var colored = cur / 2;
      var cw = BW / cur, out = '', i;
      out += '<rect x="' + (X - 4) + '" y="' + (Y - 4) + '" width="' + (BW + 8) + '" height="' + (BH + 8) + '" rx="10"'
        + ' fill="' + CHOC_SOFT + '" stroke="' + CHOC_LINE + '" stroke-width="2"/>';
      out += barCells(X, Y, BW, BH, cur, colored, CHOC, CHOC_SOFT, '#fff7ec');
      if (prev) {
        for (i = 0; i < cur; i++) {
          out += '<line x1="' + (X + i * cw + cw / 2) + '" y1="' + Y + '" x2="' + (X + i * cw + cw / 2) + '" y2="' + (Y + BH) + '"'
            + ' stroke="' + INK + '" stroke-width="3" stroke-dasharray="6 5" opacity="' + l + '"/>';
        }
      }
      out += '<line x1="' + (X + BW / 2) + '" y1="' + (Y - 14) + '" x2="' + (X + BW / 2) + '" y2="' + (Y + BH + 14) + '"'
        + ' stroke="' + WARM + '" stroke-width="3" stroke-linecap="round"/>';
      out += '<text x="' + (X + BW / 2) + '" y="' + (Y + BH + 36) + '" font-size="14" font-weight="700" fill="' + INK + '"'
        + ' text-anchor="middle" font-family="' + FONT + '">הקו הכתום מסמן בדיוק חצי</text>';
      out += frac(332, 150, colored, cur, 44, MAIN);
      ctx.draw(out);
    }

    function status() {
      ctx.caption('צבועות ' + m(String(p / 2)) + ' מתוך ' + m(String(p)) + ' חתיכות');
    }

    var cutBtn = ctx.button('חתוך כל חתיכה לשתיים ✂', function () {
      if (busy || done || p >= 8) return;
      busy = true;
      ctx.busy(true);
      ctx.sfx('click');
      var prev = p;
      p = p * 2;
      ctx.tween(700, function (l) { render(prev, l); }).then(function () {
        render();
        status();
        busy = false;
        ctx.busy(false);
        resetBtn.disabled = false;
        if (p === 8) {
          done = true;
          cutBtn.disabled = true;
          ctx.sfx('correct');
          ctx.burst(16);
          ctx.note('חתכת כל חתיכה לשתיים: מספר החתיכות הצבועות וגם מספר החתיכות הכולל הוכפלו. השטח הצבוע לא השתנה.', 'good');
          ctx.say('ארבע שמיניות הן בדיוק חצי, כמו שני רבעים וכמו חתיכה אחת מתוך שתיים.', { mood: 'happy', attn: true });
          ctx.solved();
        } else {
          cutBtn.disabled = false;
          ctx.note('עכשיו יש ' + m(String(p)) + ' חתיכות, ו־' + m(String(p / 2)) + ' מהן צבועות. הצבע ממלא עדיין חצי.');
        }
      });
    }, { target: 'cut' });
    var resetBtn = ctx.button('התחל מחדש', function () {
      if (busy) return;
      p = 2;
      done = false;
      cutBtn.disabled = false;
      resetBtn.disabled = true;
      ctx.sfx('click');
      render();
      status();
      ctx.note('חזרנו לחצי: חתיכה אחת צבועה מתוך שתיים.');
    }, { ghost: true });
    resetBtn.disabled = true;
    ctx.register('cut', cutBtn);
    render();
    status();
    ctx.note('חתיכה אחת צבועה מתוך שתיים. חתוך כל חתיכה לשתיים, פעמיים.');
  }

  /* ---------- step 3: two bars that must line up ---------- */
  function barsScene(ctx) {
    var X0 = 40, BW = 320, CW = BW / 8, k = 2, done = false;
    var guideX = X0 + BW * 3 / 4;
    var out = ''
      + barCells(X0, 78, BW, 44, 4, 3, MAIN, SOFT, LINE)
      + '<g id="botBar">'
      + '<g id="cells2">' + barCells(X0, 172, BW, 44, 8, 0, WARM, '#fff7e6', '#e8c98a', 'c') + '</g>'
      + '<rect x="20" y="160" width="362" height="68" fill="transparent" style="cursor:ew-resize"/>'
      + '<g id="knobG" style="cursor:ew-resize"><circle id="knob" cx="0" cy="194" r="12" fill="' + INK + '"/>'
      + '<text id="knobT" x="0" y="199" font-size="14" fill="#fff" text-anchor="middle" font-family="' + FONT + '">↔</text></g>'
      + '</g>'
      + '<line id="guide" x1="' + guideX + '" y1="72" x2="' + guideX + '" y2="222" stroke="' + INK + '"'
      + ' stroke-width="2.4" stroke-dasharray="5 5"/>'
      + frac(201, 52, 3, 4, 16, MAIN)
      + frac(201, 241, k, 8, 16, '#b45309', 'bn', 'bd');
    ctx.draw(out);
    var cells = [].slice.call(ctx.el('cells2').children);

    function render() {
      var x = X0 + k * CW;
      cells.forEach(function (r, i) { r.setAttribute('fill', i < k ? WARM : '#fff7e6'); });
      ctx.el('knob').setAttribute('cx', x);
      ctx.el('knobT').setAttribute('x', x);
      ctx.el('bn').textContent = String(k);
      var aligned = k === 6;
      ctx.el('guide').setAttribute('stroke', aligned ? GOOD : INK);
      ctx.el('guide').setAttribute('stroke-width', aligned ? 4 : 2.4);
      ctx.caption('בפס התחתון צבועות ' + m(String(k)) + ' חתיכות מתוך ' + m('8'));
      if (k === 6) ctx.note('הקצוות מתיישרים בדיוק על הקו.', 'good');
      else if (k < 6) ctx.note('הפס התחתון קצר מהעליון. הוסף עוד חתיכות צבועות.');
      else ctx.note('הפס התחתון ארוך מהעליון. הורד חתיכות צבועות.');
    }
    function set(nk) {
      nk = Math.max(0, Math.min(8, nk));
      if (nk !== k) { k = nk; ctx.sfx('tick'); render(); }
    }
    function check() {
      if (done || k !== 6) return;
      done = true;
      ctx.sfx('correct');
      ctx.burst(18);
      ctx.note('שישה משמונה וגם שלושה מארבעה: שני הפסים מסתיימים באותה נקודה. אלה שברים שקולים.', 'good');
      ctx.say('כפלנו את שלוש וארבע בשתיים, וקיבלנו שש ושמונה. אותה כמות בדיוק.', { mood: 'happy', attn: true });
      ctx.solved();
    }
    ctx.drag(ctx.el('botBar'), {
      move: function (x) { set(Math.round((x - X0) / CW)); },
      end: function () { check(); }
    });
    var minus = ctx.button('פחות חתיכה −', function () { set(k - 1); check(); }, { ghost: true });
    var plus = ctx.button('עוד חתיכה +', function () { set(k + 1); check(); }, { ghost: true });
    ctx.register('minus', minus);
    ctx.register('plus', plus);
    render();
  }

  /* ---------- step 5: reduce ---------- */
  function reduceScene(ctx) {
    var n = 24, d = 36, last = 0, done = false;
    var X = 50, BW = 300, Y = 62, BH = 56;

    function render() {
      var boundary = X + BW * n / d;
      var out = barCells(X, Y, BW, BH, d, n, MAIN, SOFT, LINE)
        + '<line x1="' + boundary + '" y1="' + (Y - 10) + '" x2="' + boundary + '" y2="' + (Y + BH + 10) + '"'
        + ' stroke="' + WARM + '" stroke-width="3.5" stroke-linecap="round"/>'
        + frac(201, 188, n, d, 44, done ? GOOD : MAIN);
      if (last) {
        out += '<g font-family="' + FONT + '" font-size="26" fill="' + WARM + '" text-anchor="middle">'
          + '<text x="289" y="190">÷</text><text x="313" y="190">' + last + '</text></g>';
      }
      ctx.draw(out);
      ctx.caption('הפס צבוע ' + m(String(n)) + ' מתוך ' + m(String(d)) + ' חלקים');
    }
    function divide(k) {
      if (done) return;
      if (n % k !== 0 || d % k !== 0) {
        ctx.sfx('error');
        var who = n % k !== 0 && d % k !== 0 ? 'לא המונה וגם לא המכנה מתחלקים'
          : (n % k !== 0 ? 'המונה ' + m(String(n)) + ' לא מתחלק' : 'המכנה ' + m(String(d)) + ' לא מתחלק');
        ctx.note('אי אפשר לחלק ב־' + m(String(k)) + ': ' + who + ' ב־' + m(String(k)) + ' בלי שארית.');
        return;
      }
      n = n / k;
      d = d / k;
      last = k;
      ctx.sfx('click');
      if (n === 2 && d === 3) {
        done = true;
        render();
        ctx.sfx('correct');
        ctx.burst(18);
        ctx.note('הגעת ל־' + m('2') + ' מתוך ' + m('3') + '. אין מספר גדול מ־' + m('1') + ' שמחלק את שניהם, אז זה השבר המצומצם. הפס נשאר צבוע באותו אורך.', 'good');
        ctx.say('חילקת מונה ומכנה באותו מספר שוב ושוב, והשבר לא השתנה. זה צמצום.', { mood: 'happy', attn: true });
        ctx.solved();
        return;
      }
      render();
      ctx.note('חילקת את המונה ואת המכנה ב־' + m(String(k)) + '. עכשיו יש ' + m(String(n)) + ' מתוך ' + m(String(d))
        + ', והפס נשאר צבוע באותו אורך.');
    }
    var b2 = ctx.button('חלק ב־2 ÷', function () { divide(2); }, { target: 'div2' });
    var b3 = ctx.button('חלק ב־3 ÷', function () { divide(3); }, { target: 'div3' });
    ctx.button('התחל מחדש', function () {
      n = 24; d = 36; last = 0; done = false;
      ctx.sfx('click');
      render();
      ctx.note('חזרנו לשבר הגדול. נסה שוב לחלק ב־' + m('2') + ' או ב־' + m('3') + '.');
    }, { ghost: true });
    ctx.register('div2', b2);
    ctx.register('div3', b3);
    render();
    ctx.note('חלק את המונה ואת המכנה באותו מספר, עד שאי אפשר להמשיך.');
  }

  /* ---------- pictures for the quizzes ---------- */
  function halfPicture(ctx) {
    ctx.draw(barCells(60, 110, 282, 70, 2, 1, MAIN, SOFT, LINE)
      + '<text x="201" y="215" font-size="15" font-weight="700" fill="' + INK + '" text-anchor="middle"'
      + ' font-family="' + FONT + '">חתיכה אחת מתוך שתיים: חצי</text>');
  }
  function missingPicture(ctx) {
    ctx.draw(barCells(60, 70, 282, 44, 3, 2, MAIN, SOFT, LINE)
      + barCells(60, 150, 282, 44, 12, 0, WARM, '#fff7e6', '#e8c98a')
      + '<line x1="' + (60 + 282 * 2 / 3) + '" y1="64" x2="' + (60 + 282 * 2 / 3) + '" y2="200" stroke="' + INK + '"'
      + ' stroke-width="2.4" stroke-dasharray="5 5"/>'
      + frac(201, 242, '?', 12, 18, '#b45309'));
  }
  function comparePicture(ctx) {
    ctx.draw(frac(110, 150, 3, 4, 52, MAIN)
      + '<text x="201" y="152" font-size="22" font-weight="700" fill="' + INK + '" text-anchor="middle"'
      + ' font-family="' + FONT + '">או</text>'
      + frac(292, 150, 5, 8, 52, '#b45309'));
  }
  function reducePicture(ctx) {
    ctx.draw(barCells(60, 70, 282, 40, 18, 12, MAIN, SOFT, LINE)
      + frac(201, 188, 12, 18, 46, MAIN));
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'שברים שקולים: אותה כמות, שם אחר',
      sub: 'חצי שוקולד יכול להיקרא בהרבה שמות, ועדיין זה אותו חצי.',
      tip: 'שלום, אני אליהו. בוא נגלה איך שני שברים שונים לגמרי יכולים להיות אותה כמות בדיוק.',
      emoji: '🍫',
      eq: 'חצי = שניים מארבעה = ארבעה משמונה',
      note: 'תחתוך שוקולד, תשווה פסים ותצמצם שברים, ותגלה את הסוד שמסתתר מאחורי כל השמות.',
      art: '<svg viewBox="0 0 402 120" role="img" aria-label="חצי, שניים מארבעה וארבעה משמונה הם אותה כמות" '
        + 'style="width:100%;max-width:360px;height:auto">'
        + barCells(30, 24, 100, 34, 2, 1, CHOC, CHOC_SOFT, '#fff7ec')
        + barCells(151, 24, 100, 34, 4, 2, CHOC, CHOC_SOFT, '#fff7ec')
        + barCells(272, 24, 100, 34, 8, 4, CHOC, CHOC_SOFT, '#fff7ec')
        + frac(80, 92, 1, 2, 22, MAIN) + frac(201, 92, 2, 4, 22, MAIN) + frac(322, 92, 4, 8, 22, MAIN)
        + '</svg>',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'חותכים כל חתיכה לשתיים',
      sub: 'חתוך את החתיכות של חפיסת השוקולד וראה מה קורה לשבר.',
      tip: 'חצי חפיסה צבוע. חתוך כל חתיכה לשתיים, ושים לב למספרים ליד החפיסה.',
      cue: 'חתוך עד שיהיו 8 חתיכות',
      cueDone: 'מצוין. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'חפיסת שוקולד מחולקת לחתיכות, חצי מהן צבועות, ושבר מוערם ליד החפיסה',
      nudge: { target: 'cut', text: 'לחץ על כפתור החיתוך כדי לחתוך כל חתיכה לשתיים.' },
      setup: chocolateScene
    },
    {
      mode: 'quiz',
      tA: 'איזה שבר שווה לחצי?',
      sub: 'הפס צבוע חצי. מצא את השבר שמתאר בדיוק את אותה כמות.',
      tip: 'חצי פירושו שהצבועות הן בדיוק חצי מכל החתיכות. בדוק כל שבר.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'פס שמחולק לשתי חתיכות, אחת מהן צבועה',
      setup: halfPicture,
      win: 'נכון. כשהמונה הוא חצי מהמכנה, השבר שווה לחצי.',
      wrongSay: 'חצי פירושו שהמונה הוא חצי מהמכנה. בדוק שוב.',
      opts: [
        { t: 'שלוש שישיות', c: true, f: m('3') + ' הוא חצי של ' + m('6') + ', ולכן שלוש שישיות הן בדיוק חצי.' },
        { t: 'שלוש שמיניות', f: 'חצי של ' + m('8') + ' הוא ' + m('4') + ', לא ' + m('3') + '. זה קצת פחות מחצי.' },
        { t: 'שתי חמישיות', f: 'חצי של ' + m('5') + ' הוא ' + m('2.5') + '. שתי חמישיות הן פחות מחצי.' },
        { t: 'ארבע תשיעיות', f: 'חצי של ' + m('9') + ' הוא ' + m('4.5') + '. ארבע תשיעיות הן קצת פחות מחצי.' }
      ],
      hints: [
        'בשבר שווה לחצי, המונה הוא חצי מהמכנה.',
        'שאל את עצמך: ' + m('6') + ' חלקי שניים הם כמה? ו־' + m('8') + ' חלקי שניים?'
      ]
    },
    {
      mode: 'scene',
      tA: 'שני פסים באותו אורך',
      sub: 'הפס העליון קבוע. גרור כדי לצבוע את הפס התחתון עד שהקצוות יתיישרו.',
      tip: 'שלושה רבעים למעלה. כמה שמיניות צריך לצבוע למטה כדי להגיע לאותה נקודה?',
      cue: 'גרור את העיגול עד שהקצוות מתיישרים',
      cueDone: 'הקצוות התיישרו. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שני פסים זה מתחת לזה, העליון מחולק לארבע חתיכות ושלוש צבועות, והתחתון מחולק לשמונה חתיכות עם עיגול גרירה',
      nudge: { target: 'scene', text: 'גרור את העיגול השחור ימינה כדי לצבוע עוד חתיכות.' },
      setup: barsScene
    },
    {
      mode: 'quiz',
      tA: 'מה המספר החסר?',
      sub: 'שלוש חתיכות הפכו לשתים־עשרה. מה צריך להיות במונה כדי לקבל אותה כמות?',
      tip: 'המכנה הוכפל ב־' + m('4') + '. מה צריך לעשות למונה?',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'פס של שלוש חתיכות עם שתיים צבועות, ומתחתיו פס של שתים־עשרה חתיכות וסימן שאלה במונה',
      setup: missingPicture,
      win: 'נכון. כפלת את שני המספרים באותו מספר, והשבר נשאר אותו שבר.',
      wrongSay: 'כמה פעמים נכנס ' + m('3') + ' בתוך ' + m('12') + '? עשה את אותו דבר למונה.',
      opts: [
        { t: '8', c: true, f: m('3 × 4 = 12') + ', לכן גם ' + m('2 × 4 = 8') + '. שני שלישים הם שמונה חלקי שתים־עשרה.' },
        { t: '11', f: 'זה חיבור: הוספת ' + m('9') + ' לשני המספרים. כדי לשמור על אותה כמות צריך לכפול, לא להוסיף.' },
        { t: '6', f: 'זה ' + m('2 × 3') + '. המכנה הוכפל ב־' + m('4') + ', אז גם המונה צריך להיות מוכפל ב־' + m('4') + '.' },
        { t: '9', f: 'זה המספר שהוספת למכנה. כדי לשמור על אותו שבר המונה צריך להיות מוכפל, לא מוסף.' }
      ],
      hints: [
        'חשב: ' + m('3') + ' כפול כמה הוא ' + m('12') + '?',
        'עכשיו הכפל את המונה ' + m('2') + ' באותו מספר.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מצמצמים שבר',
      sub: 'חלק את המונה ואת המכנה באותו מספר, וראה שהפס נשאר צבוע באותו אורך.',
      tip: 'הרבה שברים אפשר לצמצם. חלק את המונה ואת המכנה באותו מספר, ותראה מה קורה.',
      cue: 'צמצם עד שאי אפשר להמשיך',
      cueDone: 'השבר מצומצם. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'פס של שלושים ושישה חלקים שעשרים וארבעה מהם צבועים, ושבר מוערם מתחתיו',
      nudge: { target: 'div2', text: 'לחץ על אחד מכפתורי החלוקה כדי להקטין את השבר.' },
      setup: reduceScene
    },
    {
      mode: 'quiz',
      tA: 'איזה שבר גדול יותר?',
      sub: 'שלושה רבעים או חמש שמיניות? המכנים שונים, אז צריך להשוות בזהירות.',
      tip: 'כשהמכנים שונים, הפוך אותם למכנה זהה ואז השווה.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שלושה חלקי ארבעה לצד חמישה חלקי שמונה',
      setup: comparePicture,
      win: 'בדיוק. שברים שקולים עוזרים להשוות שברים עם מכנים שונים.',
      wrongSay: 'הפוך את שני השברים לשמיניות ואז השווה.',
      opts: [
        { t: 'שלושה רבעים', c: true, f: m('3 × 2 = 6') + ' ו־' + m('4 × 2 = 8') + ', לכן שלושה רבעים הם שש שמיניות, וזה יותר מחמש שמיניות.' },
        { t: 'חמש שמיניות', f: 'המספר ' + m('5') + ' גדול מ־' + m('3') + ', אבל שמיניות קטנות מרבעים. צריך להשוות באותו מכנה.' },
        { t: 'הם שווים', f: 'שלושה רבעים הם שש שמיניות, ושש שמיניות גדולות מחמש שמיניות.' },
        { t: 'אי אפשר לדעת', f: 'אפשר לדעת: הופכים את הרבעים לשמיניות ומשווים.' }
      ],
      hints: [
        'הפוך את שלושה רבעים לשמיניות: כפול את המונה ואת המכנה ב־' + m('2') + '.',
        'עכשיו השווה שש שמיניות לחמש שמיניות.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'צמצם את השבר',
      sub: 'מה הצורה הפשוטה ביותר של שתים־עשרה חלקי שמונה־עשר?',
      tip: 'חפש מספר גדול שמחלק גם את ' + m('12') + ' וגם את ' + m('18') + '.',
      btn: 'לסיכום ←',
      aspect: [W, H],
      alt: 'פס של שמונה־עשר חלקים שנים־עשר מהם צבועים, ושבר מוערם מתחתיו',
      setup: reducePicture,
      win: 'מעולה. הצורה הפשוטה ביותר היא שני שלישים.',
      wrongSay: 'חלק את שני המספרים במספר גדול שמחלק את שניהם, ובדוק אם אפשר להמשיך.',
      opts: [
        { t: 'שני שלישים', c: true, f: m('12 ÷ 6 = 2') + ' ו־' + m('18 ÷ 6 = 3') + '. אי אפשר לחלק את ' + m('2') + ' ו־' + m('3') + ' יחד, אז זה מצומצם עד הסוף.' },
        { t: 'שש תשיעיות', f: 'חילקת ב־' + m('2') + ' וזה נכון, אבל אפשר להמשיך: ' + m('6') + ' ו־' + m('9') + ' מתחלקים ב־' + m('3') + '.' },
        { t: 'ארבע שישיות', f: 'חילקת ב־' + m('3') + ' וזה נכון, אבל אפשר להמשיך: ' + m('4') + ' ו־' + m('6') + ' מתחלקים ב־' + m('2') + '.' },
        { t: 'שלושה רבעים', f: 'זה שבר אחר: שלושה רבעים הם ' + m('9') + ' מתוך ' + m('12') + ', לא ' + m('12') + ' מתוך ' + m('18') + '.' }
      ],
      hints: [
        'נסה לחלק את ' + m('12') + ' ואת ' + m('18') + ' ב־' + m('2') + ', ואחר כך ב־' + m('3') + '.',
        'המספר הגדול ביותר שמחלק את שניהם הוא ' + m('6') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את שברים שקולים',
      sub: 'כל שבר יכול להופיע בהרבה צורות, והכמות נשארת אותה כמות.',
      tip: 'כל הכבוד. עכשיו אתה יודע לראות שברים שונים שהם אותו שבר.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית:',
      formula: 'כופלים או מחלקים את המונה ואת המכנה באותו מספר ' + m('k') + ' שאינו אפס, והשבר לא משתנה'
    }
  ];

  window.NoamGame.boot({
    slug: 'shivrim-shkulim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'שבר שווה לחצי', math: '1 ÷ 2' },
      { step: 4, name: 'מספר חסר במונה', math: '2 × 4' },
      { step: 6, name: 'השוואת שברים', math: '6 ÷ 8' },
      { step: 7, name: 'צמצום שבר', math: '12 ÷ 6' }
    ],
    bonus: {
      label: 'מכונת השברים השקולים 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הקובייה וקבל שבר חדש להרחיב.',
      setup: function (box, ctx) {
        var a = 2, b = 3, k = 4, open = false;
        function fr(n, d) {
          return '<span style="display:inline-flex;flex-direction:column;align-items:center;line-height:1.15;vertical-align:middle">'
            + '<span style="padding:0 6px;border-bottom:2.5px solid currentColor">' + n + '</span>'
            + '<span style="padding:0 6px">' + d + '</span></span>';
        }
        box.innerHTML = '<div class="bTitle">מכונת השברים השקולים</div>'
          + '<div class="bSub">קבל שבר ומספר, נסה למצוא את השבר השקול בראש, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<button type="button" class="bDice" data-roll>🎲 תרגיל חדש</button>'
          + '<button type="button" class="bDice" data-show>גלה את התשובה</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        function draw() {
          chip.innerHTML = fr(a, b) + ' &nbsp;=&nbsp; ' + fr('?', b * k) + ' &nbsp;&nbsp;<small>(× ' + k + ')</small>';
          sol.innerHTML = '<div>' + a + ' × ' + k + ' = ' + (a * k) + '</div>'
            + '<div>' + b + ' × ' + k + ' = ' + (b * k) + '</div>'
            + '<div>' + fr(a, b) + ' &nbsp;=&nbsp; ' + fr(a * k, b * k) + '</div>';
          sol.hidden = !open;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          b = 2 + Math.floor(Math.random() * 7);
          a = 1 + Math.floor(Math.random() * (b - 1));
          k = 2 + Math.floor(Math.random() * 4);
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
