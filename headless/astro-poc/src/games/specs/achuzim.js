/**
 * אחוזים בחיים — an engine game.
 *
 * The idea: a percent is a hundredth. A grid of one hundred squares turns every
 * discount in a shop into something you can see, and the same grid translates
 * "15 out of 60" into a percent.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef';

  function pct(n) { return m(n + '%'); }
  function shekel(n) { return m(n + ' ₪'); }

  /* ---------- step 1: paint the hundred grid ---------- */
  function gridScene(ctx) {
    var N = 100, SUM = 200, CS = 23, OX = 86, OY = 38;
    var count = 0, done = false;
    var cells = '';
    for (var i = 0; i < N; i++) {
      var r = Math.floor(i / 10), c = i % 10;
      cells += '<rect x="' + (OX + c * CS + 1) + '" y="' + (OY + r * CS + 1) + '" width="' + (CS - 2)
        + '" height="' + (CS - 2) + '" rx="3" fill="' + SOFT + '" stroke="' + LINE + '" stroke-width="1.2"/>';
    }
    ctx.draw(
      '<g id="cells">' + cells + '</g>'
      + '<rect id="grab" x="' + OX + '" y="' + OY + '" width="' + (CS * 10) + '" height="' + (CS * 10)
      + '" fill="transparent" style="cursor:crosshair;touch-action:none"/>'
    );
    var rects = [].slice.call(ctx.el('cells').children);
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>משבצות צבועות</b><span data-v="n">0</span></div>'
      + '<div><b>אחוז</b><span data-v="p" dir="ltr">0%</span></div>'
      + '<div><b>מתוך 200 ₪</b><span data-v="a" dir="ltr">0 ₪</span></div>'
      + '</div>'
    );
    ctx.register('grid', ctx.el('grab'));
    function render() {
      for (var k = 0; k < N; k++) rects[k].setAttribute('fill', k < count ? MAIN : SOFT);
      box.querySelector('[data-v="n"]').textContent = String(count);
      box.querySelector('[data-v="p"]').textContent = count + '%';
      box.querySelector('[data-v="a"]').textContent = (count * SUM / N) + ' ₪';
      ctx.caption(m(count + '%') + ' מתוך ' + m(String(SUM)) + ' = ' + m(String(count * SUM / N)));
      if (!done) ctx.note('צבעת ' + m(String(count)) + ' משבצות. צריך ' + m('25') + '.');
    }
    function at(x, y) {
      var c = Math.max(0, Math.min(9, Math.floor((x - OX) / CS)));
      var r = Math.max(0, Math.min(9, Math.floor((y - OY) / CS)));
      var n = r * 10 + c + 1;
      if (n !== count) { count = n; ctx.sfx('tick'); render(); }
    }
    ctx.drag(ctx.el('grab'), {
      start: at,
      move: at,
      end: function () {
        if (done || count !== 25) return;
        done = true;
        ctx.sfx('correct');
        ctx.burst(18);
        ctx.note('צבעת ' + m('25') + ' משבצות מתוך ' + m('100') + '. זה ' + pct(25)
          + ', וזה ' + shekel(50) + ' מתוך ' + shekel(200) + '.', 'good');
        ctx.say('כל משבצת היא אחוז אחד, וכל אחוז הוא ' + shekel(2) + ' מתוך ' + shekel(200) + '.',
          { mood: 'happy', attn: true });
        ctx.solved();
      }
    });
    render();
  }

  /* ---------- step 3: the price tag ---------- */
  function priceScene(ctx) {
    var PRICE = 150, BX = 40, BW = 322, BY = 78, BH = 46;
    var TX = 50, TW = 302, TY = 212;
    var p = 0, done = false;
    var ticks = '';
    for (var t = 0; t <= 50; t += 10) {
      var tx = TX + t / 50 * TW;
      ticks += '<line x1="' + tx + '" y1="' + (TY - 6) + '" x2="' + tx + '" y2="' + (TY + 6)
        + '" stroke="' + LINE + '" stroke-width="2"/>'
        + '<text x="' + tx + '" y="' + (TY + 26) + '" font-size="13" fill="' + INK
        + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif">' + t + '%</text>';
    }
    ctx.draw(
      '<rect x="' + BX + '" y="' + BY + '" width="' + BW + '" height="' + BH + '" rx="10" fill="#fff"'
      + ' stroke="' + LINE + '" stroke-width="2"/>'
      + '<rect id="cut" x="' + (BX + BW) + '" y="' + BY + '" width="0" height="' + BH + '" rx="10" fill="'
      + WARM + '"/>'
      + '<rect id="paid" x="' + BX + '" y="' + BY + '" width="' + BW + '" height="' + BH + '" rx="10" fill="'
      + MAIN + '"/>'
      + '<text x="201" y="62" font-size="15" fill="' + INK + '" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif">מחיר הנעל</text>'
      + '<text id="payTxt" x="201" y="108" font-size="22" fill="#fff" text-anchor="middle" direction="ltr"'
      + ' font-family="Secular One, sans-serif">150 ₪</text>'
      + '<text id="saveTxt" x="201" y="160" font-size="15" fill="' + WARM + '" text-anchor="middle"'
      + ' direction="ltr" font-family="Secular One, sans-serif"> </text>'
      + '<line x1="' + TX + '" y1="' + TY + '" x2="' + (TX + TW) + '" y2="' + TY + '" stroke="' + LINE
      + '" stroke-width="6" stroke-linecap="round"/>'
      + '<line id="fill" x1="' + TX + '" y1="' + TY + '" x2="' + TX + '" y2="' + TY + '" stroke="' + WARM
      + '" stroke-width="6" stroke-linecap="round"/>'
      + ticks
      + '<g id="knobG" style="cursor:ew-resize"><circle id="knob" cx="' + TX + '" cy="' + TY + '" r="13" fill="'
      + INK + '"/><text id="arrow" x="' + TX + '" y="' + (TY + 5) + '" font-size="14" fill="#fff"'
      + ' text-anchor="middle" font-family="Secular One, sans-serif">↔</text></g>'
      + '<rect id="grab" x="' + (TX - 20) + '" y="' + (TY - 30) + '" width="' + (TW + 40)
      + '" height="60" fill="transparent" style="touch-action:none"/>'
    );
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>הנחה</b><span data-v="p" dir="ltr">0%</span></div>'
      + '<div><b>אתה חוסך</b><span data-v="s" dir="ltr">0 ₪</span></div>'
      + '<div><b>אתה משלם</b><span data-v="a" dir="ltr">150 ₪</span></div>'
      + '</div>'
    );
    ctx.register('slider', ctx.el('grab'));
    function render() {
      var save = PRICE * p / 100, pay = PRICE - save;
      var paidW = BW * (1 - p / 100);
      ctx.el('paid').setAttribute('width', paidW);
      ctx.el('cut').setAttribute('x', BX + paidW);
      ctx.el('cut').setAttribute('width', BW - paidW);
      ctx.el('payTxt').textContent = pay + ' ₪';
      ctx.el('payTxt').setAttribute('x', BX + paidW / 2);
      ctx.el('saveTxt').textContent = save > 0 ? ('חסכת ' + save + ' ₪') : ' ';
      var kx = TX + p / 50 * TW;
      ctx.el('fill').setAttribute('x2', kx);
      ctx.el('knob').setAttribute('cx', kx);
      ctx.el('arrow').setAttribute('x', kx);
      box.querySelector('[data-v="p"]').textContent = p + '%';
      box.querySelector('[data-v="s"]').textContent = save + ' ₪';
      box.querySelector('[data-v="a"]').textContent = pay + ' ₪';
      ctx.caption(m(PRICE + ' − ' + p + '% = ' + pay));
      if (!done) {
        ctx.note('ההנחה היא ' + pct(p) + ', ואתה משלם ' + shekel(pay) + '. צריך ' + pct(20) + '.');
      }
    }
    function at(x) {
      var raw = (x - TX) / TW * 50;
      var np = Math.max(0, Math.min(50, Math.round(raw / 5) * 5));
      if (np !== p) { p = np; ctx.sfx('tick'); render(); }
    }
    ctx.drag(ctx.el('grab'), {
      start: at,
      move: at,
      end: function () {
        if (done || p !== 20) return;
        done = true;
        ctx.sfx('correct');
        ctx.burst(18);
        ctx.note(pct(20) + ' מ־' + shekel(150) + ' הם ' + shekel(30) + '. לכן אתה משלם ' + shekel(120) + '.', 'good');
        ctx.say('מצאת. המחיר שירד הוא החלק הכתום, והכחול הוא מה שנשאר לשלם.', { mood: 'happy', attn: true });
        ctx.solved();
      }
    });
    render();
  }

  /* ---------- step 5: the other direction ---------- */
  function reverseScene(ctx) {
    var TOTAL = 60, CHOSEN = 15;
    var DX = 30, DY = 82, DS = 15;          // students: 10 columns x 6 rows
    var GX = 242, GY = 52, GS = 12;         // hundred grid
    var SX = 50, SW = 302, SY = 226;        // slider track
    var p = 0, done = false, i;
    var dots = '', cells = '';
    for (i = 0; i < TOTAL; i++) {
      var dr = Math.floor(i / 10), dc = i % 10;
      dots += '<circle cx="' + (DX + dc * DS + DS / 2) + '" cy="' + (DY + dr * DS + DS / 2) + '" r="5.4" fill="'
        + SOFT + '" stroke="' + (i < CHOSEN ? WARM : LINE) + '" stroke-width="' + (i < CHOSEN ? 2.4 : 1.2) + '"/>';
    }
    for (i = 0; i < 100; i++) {
      var gr = Math.floor(i / 10), gc = i % 10;
      cells += '<rect x="' + (GX + gc * GS + 0.8) + '" y="' + (GY + gr * GS + 0.8) + '" width="' + (GS - 1.6)
        + '" height="' + (GS - 1.6) + '" rx="2" fill="' + SOFT + '" stroke="' + LINE + '" stroke-width="1"/>';
    }
    var ticks = '';
    for (var t = 0; t <= 100; t += 25) {
      var tx = SX + t / 100 * SW;
      ticks += '<line x1="' + tx + '" y1="' + (SY - 6) + '" x2="' + tx + '" y2="' + (SY + 6)
        + '" stroke="' + LINE + '" stroke-width="2"/>'
        + '<text x="' + tx + '" y="' + (SY + 26) + '" font-size="13" fill="' + INK
        + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif">' + t + '%</text>';
    }
    ctx.draw(
      '<text x="105" y="62" font-size="14" fill="' + INK + '" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif">התלמידים בכיתה</text>'
      + '<text x="302" y="42" font-size="14" fill="' + INK + '" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif">מאה משבצות</text>'
      + '<g id="dots">' + dots + '</g>'
      + '<g id="cells">' + cells + '</g>'
      + '<text x="105" y="190" font-size="12.5" fill="' + WARM + '" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif">בעיגול כתום: מי שבחר</text>'
      + '<line x1="' + SX + '" y1="' + SY + '" x2="' + (SX + SW) + '" y2="' + SY + '" stroke="' + LINE
      + '" stroke-width="6" stroke-linecap="round"/>'
      + '<line id="fill" x1="' + SX + '" y1="' + SY + '" x2="' + SX + '" y2="' + SY + '" stroke="' + MAIN
      + '" stroke-width="6" stroke-linecap="round"/>'
      + ticks
      + '<g style="cursor:ew-resize"><circle id="knob" cx="' + SX + '" cy="' + SY + '" r="13" fill="' + INK + '"/>'
      + '<text id="arrow" x="' + SX + '" y="' + (SY + 5) + '" font-size="14" fill="#fff" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif">↔</text></g>'
      + '<rect id="grab" x="' + (SX - 20) + '" y="' + (SY - 30) + '" width="' + (SW + 40)
      + '" height="60" fill="transparent" style="touch-action:none"/>'
    );
    var dotEls = [].slice.call(ctx.el('dots').children);
    var cellEls = [].slice.call(ctx.el('cells').children);
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>אחוז</b><span data-v="p" dir="ltr">0%</span></div>'
      + '<div><b>תלמידים צבועים</b><span data-v="s">0</span></div>'
      + '<div><b>מתוך</b><span data-v="t">60</span></div>'
      + '</div>'
    );
    ctx.register('slider', ctx.el('grab'));
    function render() {
      var s = p * TOTAL / 100;
      var k;
      for (k = 0; k < TOTAL; k++) dotEls[k].setAttribute('fill', k < s ? MAIN : SOFT);
      for (k = 0; k < 100; k++) cellEls[k].setAttribute('fill', k < p ? MAIN : SOFT);
      var kx = SX + p / 100 * SW;
      ctx.el('fill').setAttribute('x2', kx);
      ctx.el('knob').setAttribute('cx', kx);
      ctx.el('arrow').setAttribute('x', kx);
      box.querySelector('[data-v="p"]').textContent = p + '%';
      box.querySelector('[data-v="s"]').textContent = String(s);
      ctx.caption(m(String(s)) + ' מתוך ' + m(String(TOTAL)) + ' = ' + m(p + '%'));
      if (!done) {
        ctx.note('צבעת ' + m(String(s)) + ' תלמידים. צריך להגיע לעיגולים הכתומים, ' + m(String(CHOSEN)) + ' תלמידים.');
      }
    }
    function at(x) {
      var raw = (x - SX) / SW * 100;
      var np = Math.max(0, Math.min(100, Math.round(raw / 5) * 5));
      if (np !== p) { p = np; ctx.sfx('tick'); render(); }
    }
    ctx.drag(ctx.el('grab'), {
      start: at,
      move: at,
      end: function () {
        if (done || p !== 25) return;
        done = true;
        ctx.sfx('correct');
        ctx.burst(18);
        ctx.note(m('15') + ' מתוך ' + m('60') + ' הם ' + pct(25) + '. כל ' + m('15') + ' תלמידים הם רבע מהכיתה.', 'good');
        ctx.say('כשהכיתה מחולקת לארבע קבוצות שוות, כל קבוצה היא רבע. וזה בדיוק ' + pct(25) + '.',
          { mood: 'happy', attn: true });
        ctx.solved();
      }
    });
    render();
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'אחוזים בחיים', tM: '25%', tB: ' = ?',
      sub: 'אחוז הוא פשוט מאית. כשאתה רואה את המאה, ההנחות בחנות הופכות לקלות.',
      tip: 'שלום, אני אליהו. בוא נגלה איך לדעת כמה באמת תשלם כשכתוב על השלט הנחה.',
      emoji: '🏷️',
      eq: m('25% = 25 ÷ 100'),
      note: 'אליהו יראה לך מאה משבצות, תווית מחיר וכיתה שלמה, ואיך אחוזים מתחברים לכולם.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מאה משבצות',
      sub: 'גרור על הרשת כדי לצבוע משבצות. כל משבצת היא אחוז אחד.',
      tip: 'הרשת הזאת היא ' + m('100') + ' משבצות, וכל משבצת היא אחוז אחד. צבע ' + pct(25) + ' ממנה.',
      cue: 'צבע בדיוק 25 משבצות',
      cueDone: 'יפה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'רשת של עשר על עשר משבצות שאפשר לצבוע בגרירה',
      nudge: { target: 'grid', text: 'גרור באצבע או בעכבר על הרשת כדי לצבוע.' },
      setup: gridScene
    },
    {
      mode: 'quiz',
      tA: 'כמה הם ', tM: '25%', tB: ' מתוך ' + m('80') + '?',
      sub: 'עשרים וחמישה אחוזים הם רבע. חלק את שמונים לארבעה חלקים שווים.',
      tip: 'חשוב על רבע מתוך שמונים, כמו בכיתה שמחלקים לארבע קבוצות.',
      btn: 'המשך ←',
      win: 'נכון. רבע משמונים הוא עשרים.',
      wrongSay: 'עשרים וחמישה אחוזים הם רבע. חלק את שמונים בארבע.',
      opts: [
        { t: '20', c: true, f: m('80 ÷ 4 = 20') + '. רבע הוא ' + pct(25) + '.' },
        { t: '25', f: 'זה המספר שבתוך האחוז. האחוז הוא חלק מהכמות, לא הכמות עצמה.' },
        { t: '55', f: 'זה ' + m('80 − 25') + '. אחוז הוא חלק מהשלם, לא מספר להחסיר.' },
        { t: '40', f: 'זה חצי, כלומר ' + pct(50) + '. רבע קטן יותר.' }
      ],
      hints: [
        pct(25) + ' הם רבע, כלומר מחלקים לארבעה חלקים שווים.',
        m('80 ÷ 4') + ' הם כמה?'
      ]
    },
    {
      mode: 'scene',
      tA: 'תווית מחיר',
      sub: 'גרור את הסרגל וראה איך המחיר מתקצר כשההנחה גדלה.',
      tip: 'בנעליים יש תווית של ' + shekel(150) + '. הזז את ההנחה עד ' + pct(20) + ' וראה כמה תשלם.',
      cue: 'גרור עד הנחה של 20%',
      cueDone: 'מצוין. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'פס מחיר של מאה וחמישים שקלים עם סרגל הנחה נגרר בין אפס לחמישים אחוז',
      nudge: { target: 'slider', text: 'גרור את העיגול השחור ימינה כדי להגדיל את ההנחה.' },
      setup: priceScene
    },
    {
      mode: 'quiz',
      tA: 'מחיר אחרי הנחה של ', tM: '20%',
      sub: 'נעליים עולות ' + shekel(150) + ', ויש עליהן הנחה של עשרים אחוז. כמה תשלם?',
      tip: 'קודם חשב כמה ההנחה, ורק אחר כך הורד אותה מהמחיר.',
      btn: 'המשך ←',
      win: 'בדיוק. קודם ההנחה, ואחר כך מורידים.',
      wrongSay: 'קודם חשב כמה שקלים ההנחה, ואז הורד אותם מהמחיר.',
      opts: [
        { t: '120 ₪', c: true, f: pct(20) + ' מ־' + m('150') + ' הם ' + m('30') + ', ו־' + m('150 − 30 = 120') + '.' },
        { t: '30 ₪', f: 'זה גודל ההנחה, לא המחיר לתשלום. עוד צריך להוריד אותה.' },
        { t: '130 ₪', f: 'הורדת ' + m('20') + ' שקלים, אבל עשרים אחוזים הם לא עשרים שקלים.' },
        { t: '180 ₪', f: 'הוספת את ההנחה במקום להוריד אותה.' }
      ],
      hints: [
        'עשרה אחוזים מ־' + m('150') + ' הם ' + m('15') + '.',
        pct(20) + ' הם פעמיים עשרה אחוזים, כלומר ' + m('30') + '. עכשיו הורד.'
      ]
    },
    {
      mode: 'scene',
      tA: 'הכיוון ההפוך',
      sub: 'אתה יודע כמה תלמידים בחרו, ועכשיו תגלה איזה אחוז הם. גרור את הסרגל עד שהצבע מכסה את מי שבחר.',
      tip: 'בכיתה יש ' + m('60') + ' תלמידים, ו־' + m('15') + ' מהם בחרו פיצה. גרור כדי למצוא איזה אחוז הם.',
      cue: 'גרור עד שתתאים לעיגולים הכתומים',
      cueDone: 'נהדר. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שישים תלמידים ומאה משבצות, וסרגל שגורר אחוז משותף לשניהם',
      nudge: { target: 'slider', text: 'גרור את העיגול השחור ימינה והסתכל על העיגולים הכתומים.' },
      setup: reverseScene
    },
    {
      mode: 'quiz',
      tA: 'חמישה עשר מתוך שישים',
      sub: 'כמה אחוז הם ' + m('15') + ' תלמידים מתוך כיתה של ' + m('60') + '?',
      tip: 'חשוב כמה פעמים ' + m('15') + ' נכנס בתוך ' + m('60') + '.',
      btn: 'המשך ←',
      win: 'יפה. ארבע קבוצות של חמישה עשר הן הכיתה כולה.',
      wrongSay: 'בדוק כמה פעמים חמישה עשר נכנס בשישים, ואז חשוב איזה אחוז זה.',
      opts: [
        { t: '25%', c: true, f: m('15 × 4 = 60') + ', לכן ' + m('15') + ' הם רבע, וזה ' + pct(25) + '.' },
        { t: '15%', f: 'זה המספר שלקחת מהשאלה. מצאת תלמידים, לא אחוזים.' },
        { t: '40%', f: 'זה ' + m('60 ÷ 15 = 4') + '. ארבע הוא מספר הקבוצות, לא האחוז.' },
        { t: '45%', f: 'זה ' + m('60 − 15') + '. החיסור לא נותן אחוז.' }
      ],
      hints: [
        m('15 + 15 + 15 + 15') + ' הם כמה?',
        'אם הכיתה היא ארבע קבוצות שוות, כל קבוצה היא רבע, ורבע הוא ' + pct(25) + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'מה עדיף: ', tM: '30%', tB: ' או רבע?',
      sub: 'בחנות אחת יש הנחה של שלושים אחוז, ובחנות אחרת הנחה של רבע. המחיר המקורי זהה: ' + shekel(200) + '.',
      tip: 'הפוך את שתי ההנחות לאותה שפה: כמה שקלים תחסוך בכל חנות.',
      btn: 'לסיכום ←',
      win: 'נכון. שלושים אחוז גדול מרבע, ולכן חוסכים יותר.',
      wrongSay: 'רבע הוא עשרים וחמישה אחוזים. השווה אותו לשלושים.',
      opts: [
        { t: 'שלושים אחוז', c: true, f: pct(30) + ' מ־' + m('200') + ' הם ' + m('60') + ', ורבע הוא ' + m('50') + '. ' + m('60') + ' יותר.' },
        { t: 'הנחה של רבע', f: 'רבע הוא ' + pct(25) + ', וזה פחות מ־' + pct(30) + '.' },
        { t: 'שתיהן שוות', f: 'שלושים אחוז ועשרים וחמישה אחוז הם לא אותו מספר.' },
        { t: 'אי אפשר לדעת', f: 'אפשר: הפוך את הרבע לאחוזים והשווה.' }
      ],
      hints: [
        'רבע הוא ' + pct(25) + '. השווה אותו ל־' + pct(30) + '.',
        pct(30) + ' מ־' + m('200') + ' הם ' + m('60') + '. כמה הם רבע מ־' + m('200') + '?'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את אחוזים בחיים',
      sub: 'אחוז הוא מאית, ואפשר לחשב איתו הנחות ולהפוך חלקים לאחוזים.',
      tip: 'כל הכבוד. בפעם הבאה שתראה שלט הנחה, אתה כבר יודע לחשב כמה תשלם.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית: כדי למצוא אחוז מכמות, מחלקים את הכמות במאה וכופלים במספר האחוזים.',
      formula: m('S ÷ 100 × p')
    }
  ];

  window.NoamGame.boot({
    slug: 'achuzim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'אחוז כחלק מהכמות', math: '0.25 × 80' },
      { step: 4, name: 'מחיר אחרי הנחה', math: '150 − 20%' },
      { step: 6, name: 'מחלק לאחוזים', math: '15 : 60' },
      { step: 7, name: 'השוואת הנחות', math: '30% > 25%' }
    ],
    bonus: {
      label: 'מכונת ההנחות 🏷️',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הכפתור וקבל הנחה חדשה לחשב.',
      setup: function (box, ctx) {
        var prices = [40, 60, 80, 120, 200];
        var pcts = [10, 20, 25, 50, 75];
        var price = 80, p = 25, open = false;
        box.innerHTML = '<div class="bTitle">מכונת ההנחות</div>'
          + '<div class="bSub">חשב בראש כמה תשלם, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<button type="button" class="bDice" data-roll>🏷️ הנחה חדשה</button>'
          + '<button type="button" class="bDice" data-show>גלה את התשובה</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        function draw() {
          var save = price * p / 100;
          chip.textContent = price + ' ₪, ' + p + '% off';
          var how = p === 10 ? price + ' ÷ 10 = ' + save
            : p === 20 ? '2 × (' + price + ' ÷ 10) = ' + save
            : p === 25 ? price + ' ÷ 4 = ' + save
            : p === 50 ? price + ' ÷ 2 = ' + save
            : '3 × (' + price + ' ÷ 4) = ' + save;
          sol.innerHTML = '<div>' + p + '% = ' + how + '</div>'
            + '<div>' + price + ' − ' + save + ' = ' + (price - save) + '</div>';
          sol.hidden = !open;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          price = prices[Math.floor(Math.random() * prices.length)];
          p = pcts[Math.floor(Math.random() * pcts.length)];
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
