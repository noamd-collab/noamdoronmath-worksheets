/**
 * משוואות על מאזניים — an engine game.
 *
 * The idea: an equation is a balanced scale. Anything you do to one pan you
 * must do to the other, and that is how you solve it.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', BAD = '#b91c1c';
  var PX = 201, PY = 96, BEAM = 110, STR = 78;

  /** One item on a pan: a bag of x (b) or a single weight (w). yb is its bottom edge. */
  function item(t, x, yb) {
    if (t === 'b') {
      return '<rect x="' + x + '" y="' + (yb - 22) + '" width="26" height="22" rx="8" fill="' + WARM_SOFT
        + '" stroke="' + WARM + '" stroke-width="1.8"/>'
        + '<text x="' + (x + 13) + '" y="' + (yb - 6) + '" font-size="15" text-anchor="middle" fill="' + INK
        + '" font-family="Secular One, sans-serif">x</text>';
    }
    return '<rect x="' + x + '" y="' + (yb - 18) + '" width="18" height="18" rx="3" fill="' + MAIN
      + '" stroke="' + INK + '" stroke-width="1"/>'
      + '<text x="' + (x + 9) + '" y="' + (yb - 5) + '" font-size="11" text-anchor="middle" fill="#fff"'
      + ' font-family="Secular One, sans-serif">1</text>';
  }

  function iw(t) { return t === 'b' ? 26 : 18; }

  /** Items laid out in rows that wrap, centred on a pan. */
  function flow(items, cx, py) {
    var rows = [], cur = [], w = 0, out = '';
    items.forEach(function (t) {
      if (w + iw(t) > 128 && cur.length) { rows.push({ a: cur, w: w - 3 }); cur = []; w = 0; }
      cur.push(t);
      w += iw(t) + 3;
    });
    if (cur.length) rows.push({ a: cur, w: w - 3 });
    rows.forEach(function (r, i) {
      var x = cx - r.w / 2, yb = py - 3 - i * 22;
      r.a.forEach(function (t) { out += item(t, x, yb); x += iw(t) + 3; });
    });
    return out;
  }

  /** Items laid out in columns (one group per column), used when we divide. */
  function columns(groups, cx, py, hi) {
    var out = '';
    groups.forEach(function (g, i) {
      var x0 = cx - 70 + i * 35;
      out += '<rect x="' + (x0 + 1) + '" y="' + (py - 70) + '" width="33" height="68" rx="6" fill="'
        + (i % 2 ? '#ffffff' : SOFT) + '" fill-opacity="0.8" stroke="' + (hi && i === 0 ? GOOD : 'none')
        + '" stroke-width="2.4"/>';
      var yb = py - 5;
      g.forEach(function (t) {
        out += item(t, x0 + 17.5 - iw(t) / 2, yb);
        yb -= (t === 'b' ? 24 : 20);
      });
    });
    return out;
  }

  /**
   * The scale. o.angle in degrees (positive: the left pan is heavier and goes down),
   * o.L / o.R arrays of 'b' and 'w', or o.gl / o.gr groups for column mode.
   */
  function drawScale(o) {
    var a = (o.angle || 0) * Math.PI / 180;
    var dx = BEAM * Math.cos(a), dy = BEAM * Math.sin(a);
    var lx = PX - dx, ly = PY + dy, rx = PX + dx, ry = PY - dy;
    var lpy = ly + STR, rpy = ry + STR;
    var out = '<rect x="151" y="262" width="100" height="8" rx="4" fill="' + INK + '"/>'
      + '<rect x="196" y="' + PY + '" width="10" height="168" rx="3" fill="' + INK + '"/>';
    out += '<line x1="' + lx + '" y1="' + ly + '" x2="' + rx + '" y2="' + ry + '" stroke="' + INK
      + '" stroke-width="8" stroke-linecap="round"/>';
    [[lx, ly, lpy], [rx, ry, rpy]].forEach(function (p) {
      out += '<path d="M' + p[0] + ' ' + p[1] + ' L' + (p[0] - 62) + ' ' + p[2] + ' M' + p[0] + ' ' + p[1]
        + ' L' + (p[0] + 62) + ' ' + p[2] + '" stroke="' + LINE + '" stroke-width="2" fill="none"/>'
        + '<rect x="' + (p[0] - 70) + '" y="' + p[2] + '" width="140" height="8" rx="4" fill="' + MAIN + '"/>';
    });
    if (o.gl) {
      out += columns(o.gl, lx, lpy, o.hi) + columns(o.gr, rx, rpy, o.hi);
    } else {
      out += flow(o.L, lx, lpy) + flow(o.R, rx, rpy);
    }
    out += '<circle cx="' + PX + '" cy="' + PY + '" r="9" fill="' + WARM + '" stroke="' + INK + '" stroke-width="2"/>';
    return out;
  }

  function rep(t, n) { var r = [], i; for (i = 0; i < n; i++) r.push(t); return r; }
  function side(bags, ws) { return rep('b', bags).concat(rep('w', ws)); }

  /* ---------- scene 1: do it to both pans ---------- */
  function bothScene(ctx) {
    var Lw = 3, Rw = 11, busy = false, triedA = false, triedB = false, done = false;
    var red = ctx.extra('<div data-red style="min-height:40px;border-radius:12px;padding:8px 12px;'
      + 'background:' + SOFT + ';color:' + INK + ';font-size:13.5px;line-height:1.5;text-align:center">'
      + 'נסה להוריד משקולת בכל אחת משתי הדרכים, ושים לב מה קורה לקורה.</div>');
    function say(txt, bad) {
      var d = red.querySelector('[data-red]');
      d.innerHTML = txt;
      d.style.background = bad ? '#fdecec' : '#e9f9ef';
      d.style.color = bad ? BAD : GOOD;
    }
    function render(angle, l, r) {
      ctx.draw(drawScale({ angle: angle, L: side(2, l === undefined ? Lw : l), R: rep('w', r === undefined ? Rw : r) }));
    }
    function caption() { ctx.caption(m('2x + ' + Lw + ' = ' + Rw)); }
    function check() {
      if (!done && triedA && triedB) {
        done = true;
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.say('ראית את ההבדל. רק כשעושים אותו דבר לשתי הכפות, המשוואה נשארת נכונה.', { mood: 'happy', attn: true });
        ctx.solved();
      }
    }
    var btnA = ctx.button('הורד משקולת מכף אחת בלבד', function () {
      if (busy) return;
      busy = true;
      ctx.busy(true);
      ctx.sfx('click');
      var fromLeft = Lw > 0;
      var l = fromLeft ? Lw - 1 : Lw, r = fromLeft ? Rw : Rw - 1;
      var target = fromLeft ? -9 : 9;
      ctx.tween(700, function (t) { render(window.NoamGame.ez(t) * target, l, r); }).then(function () {
        ctx.sfx('error');
        say('הקורה נטתה. הורדת משקולת מכף אחת בלבד, ולכן שני הצדדים כבר לא שווים. זו לא פעולה חוקית.', true);
        triedA = true;
        return ctx.wait(1700);
      }).then(function () {
        return ctx.tween(600, function (t) { render((1 - window.NoamGame.ez(t)) * target, l, r); });
      }).then(function () {
        render(0);
        say('החזרנו את המשקולת. עכשיו נסה את הפעולה השנייה.', false);
        busy = false;
        ctx.busy(false);
        check();
      });
    }, { target: 'btnA', ghost: true });
    var btnB = ctx.button('הורד משקולת משתי הכפות', function () {
      if (busy || Lw < 1) return;
      Lw--; Rw--;
      busy = true;
      ctx.busy(true);
      ctx.sfx('tick');
      ctx.tween(700, function (t) { render(3 * Math.sin(t * Math.PI * 3) * (1 - t)); }).then(function () {
        render(0);
        caption();
        busy = false;
        ctx.busy(false);
        say('הקורה נשארה ישרה. הורדת אותה כמות משני הצדדים, אז המשוואה ' + m('2x + ' + Lw + ' = ' + Rw)
          + ' עדיין נכונה.', false);
        btnB.disabled = Lw < 1;
        triedB = true;
        check();
      });
    }, { target: 'btnB' });
    ctx.register('btnA', btnA);
    ctx.register('btnB', btnB);
    render(0);
    caption();
    ctx.note('בכף אחת שני שקים של ' + m('x') + ' ועוד שלוש משקולות. בכף השנייה אחת עשרה משקולות.');
  }

  /* ---------- scene 2: solve 3x + 2 = 11 ---------- */
  function guidedScene(ctx) {
    var stage = 0, busy = false;
    var states = [
      { L: side(3, 2), R: rep('w', 11), eq: '3x + 2 = 11' },
      { L: side(3, 0), R: rep('w', 9), eq: '3x = 9' },
      { L: side(1, 0), R: rep('w', 3), eq: 'x = 3' }
    ];
    var choices = [
      [
        { t: 'הורד שתי משקולות מהכף השמאלית בלבד', L: side(3, 0), R: rep('w', 11), ang: -9,
          why: 'הורדת רק מהכף השמאלית, והיא נעשתה קלה מדי. חייבים לעשות אותו דבר לשתי הכפות.' },
        { t: 'הורד שתי משקולות משתי הכפות', ok: true,
          log: 'הורדנו ' + m('2') + ' משני הצדדים' },
        { t: 'הוסף שתי משקולות לכף הימנית בלבד', L: side(3, 2), R: rep('w', 13), ang: -9,
          why: 'הוספת רק לכף הימנית, והיא נעשתה כבדה מדי. המאזניים לא מאוזנים.' }
      ],
      [
        { t: 'חלק את שתי הכפות בשלוש', ok: true,
          log: 'חילקנו את שני הצדדים ב־' + m('3') },
        { t: 'הורד שלוש משקולות מהכף הימנית בלבד', L: side(3, 0), R: rep('w', 6), ang: 9,
          why: 'הורדת משקולות רק מצד אחד, והכף השמאלית נעשתה כבדה. זו לא פעולה חוקית.' },
        { t: 'חלק רק את הכף השמאלית בשלוש', L: side(1, 0), R: rep('w', 9), ang: -9,
          why: 'חילקת רק צד אחד, והכף השמאלית נעשתה קלה מדי. צריך לחלק את שני הצדדים.' }
      ]
    ];
    var logBox = ctx.extra('<div data-log style="font-size:13px;line-height:1.7;color:' + INK
      + ';text-align:center;min-height:22px"></div>');
    var log = logBox.querySelector('[data-log]');
    var lines = [];
    var btns = [];
    function render(angle, s) {
      ctx.draw(drawScale({ angle: angle || 0, L: (s || states[stage]).L, R: (s || states[stage]).R }));
    }
    function labels() {
      var ch = choices[stage];
      btns.forEach(function (b, i) {
        b.textContent = ch ? ch[i].t : '';
        b.disabled = !ch;
      });
      if (stage === 0) ctx.note('המטרה: להשאיר שק ' + m('x') + ' אחד לבד. בחר פעולה.');
      else if (stage === 1) ctx.note('עכשיו יש שלושה שקים ותשע משקולות. מה עושים?');
    }
    function pick(i) {
      if (busy || stage > 1) return;
      var c = choices[stage][i];
      busy = true;
      ctx.busy(true);
      if (c.ok) {
        ctx.sfx('correct');
        stage++;
        render(0);
        lines.push(m(states[stage].eq) + ' (' + c.log + ')');
        log.innerHTML = lines.join('<br>');
        ctx.caption(m(states[stage].eq));
        busy = false;
        ctx.busy(false);
        if (stage === 2) {
          labels();
          ctx.note('שק אחד שווה שלוש משקולות. ' + m('x = 3') + '. פתרת את המשוואה בלי לנחש.', 'good');
          ctx.burst(18);
          ctx.say('בדיוק. כל פעולה שעשית, עשית לשתי הכפות.', { mood: 'happy', attn: true });
          ctx.solved();
        } else {
          labels();
        }
        return;
      }
      ctx.sfx('error');
      var tmp = { L: c.L, R: c.R };
      ctx.tween(600, function (t) { render(window.NoamGame.ez(t) * c.ang, tmp); }).then(function () {
        ctx.note(c.why);
        return ctx.wait(1300);
      }).then(function () {
        return ctx.tween(500, function (t) { render((1 - window.NoamGame.ez(t)) * c.ang, tmp); });
      }).then(function () {
        render(0);
        busy = false;
        ctx.busy(false);
        labels();
      });
    }
    [0, 1, 2].forEach(function (i) {
      var b = ctx.button('', function () { pick(i); }, { target: 'opt' + i, ghost: i !== 0 });
      ctx.register('opt' + i, b);
      btns.push(b);
    });
    lines.push(m('3x + 2 = 11'));
    log.innerHTML = lines.join('<br>');
    ctx.caption(m('3x + 2 = 11'));
    render(0);
    labels();
  }

  /* ---------- scene 3: divide both pans ---------- */
  function divideScene(ctx) {
    var done = false;
    var L = side(4, 0), R = rep('w', 12);
    ctx.draw(drawScale({ angle: 0, L: L, R: R }));
    ctx.caption(m('4x = 12'));
    ctx.note('ארבעה שקים שווים שתים עשרה משקולות. כמה משקולות שווה שק אחד?');
    var btn = ctx.button('חלק את שני הצדדים לארבע קבוצות', function () {
      if (done) return;
      done = true;
      btn.disabled = true;
      ctx.busy(true);
      ctx.sfx('click');
      var gl = [['b'], ['b'], ['b'], ['b']];
      var gr = [rep('w', 3), rep('w', 3), rep('w', 3), rep('w', 3)];
      ctx.draw(drawScale({ angle: 0, gl: gl, gr: gr }));
      ctx.tween(800, function () {}).then(function () {
        ctx.draw(drawScale({ angle: 0, gl: gl, gr: gr, hi: true }));
        ctx.caption(m('x = 12 ÷ 4 = 3'));
        ctx.note('בכל קבוצה שק אחד מול שלוש משקולות. לכן ' + m('x = 3') + '.', 'good');
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.say('חילקת את שני הצדדים באותו מספר, והמאזניים נשארו מאוזנים.', { mood: 'happy', attn: true });
        ctx.busy(false);
        ctx.solved();
      });
    }, { target: 'divide' });
    ctx.register('divide', btn);
  }

  /** A static scale, used as the picture of a question. */
  function stillTilt(l, r, angle) {
    return function (ctx) {
      ctx.draw(drawScale({ angle: angle, L: rep('w', l), R: rep('w', r) }));
    };
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'משוואה היא ', tM: '', tB: 'מאזניים',
      sub: 'כשהמאזניים מאוזנים, שתי הכפות שוות. כך בדיוק נראית משוואה.',
      tip: 'שלום, אני אליהו. בוא נגלה איך לפתור משוואות בעזרת מאזניים.',
      emoji: '⚖️',
      eq: m('3x + 2 = 11'),
      note: 'אליהו יראה לך שכל פעולה חוקית היא פעולה שעושים לשתי הכפות.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'שתי הכפות ביחד',
      sub: 'נסה להוריד משקולת מכף אחת, ואחר כך משתי הכפות, והשווה.',
      tip: 'נסה את שתי הפעולות ותראה איזו מהן שומרת על האיזון.',
      cue: 'נסה את שני הכפתורים',
      cueDone: 'הבנת את ההבדל. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מאזניים עם שני שקי איקס ושלוש משקולות בכף אחת ואחת עשרה משקולות בכף השנייה',
      nudge: { target: 'btnA', text: 'לחץ על הכפתור כדי להוריד משקולת מכף אחת.' },
      setup: bothScene
    },
    {
      mode: 'quiz',
      tA: 'איזו פעולה חוקית?',
      sub: 'נתונה המשוואה ' + m('x + 4 = 10') + '. איזו פעולה אפשר לעשות עליה?',
      tip: 'זכור את המאזניים: מה שעושים לכף אחת, עושים גם לשנייה.',
      btn: 'המשך ←',
      win: 'נכון. אותה פעולה, לשני הצדדים.',
      wrongSay: 'חשוב על המאזניים. האם הפעולה נעשית לשתי הכפות?',
      opts: [
        { t: 'להוריד 4 משני הצדדים', c: true, f: 'מורידים אותה כמות משתי הכפות, ולכן המאזניים נשארים מאוזנים. מקבלים ' + m('x = 6') + '.' },
        { t: 'להוריד 4 מהצד השמאלי בלבד', f: 'רק הצד השמאלי נעשה קל יותר, והמאזניים נוטים.' },
        { t: 'להוסיף 4 משמאל ולהוריד 4 מימין', f: 'כאן הצד השמאלי גדל והימני קטן. זו לא אותה פעולה בשני הצדדים.' },
        { t: 'להכפיל ב־2 רק את x', f: 'הכפלת רק חלק מצד אחד משנה את המאזניים. צריך להכפיל את כל הצד, ואת שני הצדדים.' }
      ],
      hints: [
        'חפש את האפשרות שבה שתי הכפות עוברות בדיוק את אותו הדבר.',
        'כדי להישאר עם ' + m('x') + ' לבד, אפשר להוריד ' + m('4') + ' משתי הכפות.'
      ]
    },
    {
      mode: 'scene',
      tA: 'פותרים צעד אחר צעד',
      sub: 'בכל צעד בחר את הפעולה החוקית שמקרבת אותך לשק אחד לבד.',
      tip: 'עכשיו תפתור בעצמך את ' + m('3x + 2 = 11') + '. רק פעולה אחת בכל צעד נכונה.',
      cue: 'בחר פעולה עד שתגיע ל־x = 3',
      cueDone: 'פתרת את המשוואה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מאזניים עם שלושה שקי איקס ושתי משקולות בכף אחת ואחת עשרה משקולות בכף השנייה',
      nudge: { target: 'opt0', text: 'בחר אחת משלוש הפעולות שמתחת למאזניים.' },
      setup: guidedScene
    },
    {
      mode: 'quiz',
      tA: 'פתור: ', tM: '2x + 5 = 13',
      sub: 'פעל כמו במאזניים, וקבל ערך אחד ל־' + m('x') + '.',
      tip: 'קודם מורידים ' + m('5') + ' משני הצדדים, ורק אחר כך מחלקים.',
      btn: 'המשך ←',
      win: 'מצוין. שני צעדים, ושניהם לשני הצדדים.',
      wrongSay: 'התחל בלהוריד ' + m('5') + ' משני הצדדים, ואז חלק.',
      opts: [
        { t: 'x = 4', c: true, f: m('13 − 5 = 8') + ', ואז ' + m('8 ÷ 2 = 4') + '. בדיקה: ' + m('2 × 4 + 5 = 13') + '.' },
        { t: 'x = 9', f: 'הוספת ' + m('5') + ' במקום להוריד אותם. צריך להוריד.' },
        { t: 'x = 8', f: 'הורדת ' + m('5') + ' אבל שכחת לחלק ב־' + m('2') + '. יש שני שקים, לא אחד.' },
        { t: 'x = 6.5', f: 'חילקת את ' + m('13') + ' ב־' + m('2') + ' בלי להוריד קודם את ' + m('5') + '.' }
      ],
      hints: [
        'אחרי שמורידים ' + m('5') + ' משני הצדדים נשאר ' + m('2x = 8') + '.',
        'שני שקים שווים שמונה משקולות. כמה משקולות בשק אחד?'
      ]
    },
    {
      mode: 'scene',
      tA: 'חילוק בשני הצדדים',
      sub: 'לחץ על הכפתור וראה כמה משקולות שוקל שק אחד.',
      tip: 'אם יש לך כמה שקים שווים, אפשר לחלק לקבוצות שוות.',
      cue: 'חלק את שני הצדדים',
      cueDone: 'ראית כמה שווה שק. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מאזניים עם ארבעה שקי איקס בכף אחת ושתים עשרה משקולות בכף השנייה, מחולקים לארבע קבוצות שוות',
      nudge: { target: 'divide', text: 'לחץ על הכפתור כדי לחלק לארבע קבוצות.' },
      setup: divideScene
    },
    {
      mode: 'quiz',
      tA: 'מי מתאימה לסיפור?',
      sub: 'בכל אחת משלוש שקיות יש ' + m('x') + ' סוכריות. עוד ' + m('4') + ' סוכריות בכיס. בסך הכול ' + m('19') + '.',
      tip: 'כמה שקיות יש, וכמה סוכריות בכל אחת? זה מה שכופלים.',
      btn: 'המשך ←',
      win: 'נכון. תרגמת סיפור למשוואה.',
      wrongSay: 'שלוש שקיות, ובכל אחת ' + m('x') + '. איך כותבים את זה?',
      opts: [
        { t: '3x + 4 = 19', c: true, f: 'שלוש שקיות של ' + m('x') + ' הן ' + m('3x') + ', ועוד ' + m('4') + ' מהכיס, בסך הכול ' + m('19') + '.' },
        { t: '3 + x + 4 = 19', f: 'ב־' + m('x') + ' יש סוכריות בכל שקית, ואי אפשר לחבר אותו ל־' + m('3') + '. צריך לכפול.' },
        { t: '4x + 3 = 19', f: 'כאן ' + m('4') + ' ו־' + m('3') + ' התחלפו. השקיות הן שלוש, והכיס הוא ארבע.' },
        { t: '3x − 4 = 19', f: 'הסוכריות מהכיס מתווספות, הן לא נלקחות.' }
      ],
      hints: [
        'שקית אחת היא ' + m('x') + '. שלוש שקיות הן ' + m('3x') + '.',
        'הסוכריות בכיס מתווספות לשקיות.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'מה קורה כשמכפילים רק צד אחד?',
      sub: 'המאזניים היו מאוזנים עם חמש משקולות בכל כף. הכפלנו את הכף השמאלית פי שניים.',
      tip: 'ספור כמה משקולות יש עכשיו בכל כף.',
      btn: 'לסיכום ←',
      aspect: [W, H],
      alt: 'מאזניים שבהם עשר משקולות בכף שמאל וחמש בכף ימין, והכף השמאלית למטה',
      setup: stillTilt(10, 5, 9),
      win: 'נכון. פעולה בצד אחד בלבד שוברת את האיזון.',
      wrongSay: 'ספור שוב: ' + m('10') + ' משקולות מול ' + m('5') + '.',
      opts: [
        { t: 'הכף השמאלית כבדה יותר והמאזניים נוטים', c: true, f: m('10') + ' משקולות מול ' + m('5') + ', אז הכף השמאלית יורדת.' },
        { t: 'המאזניים נשארים מאוזנים כי כפל הוא פעולה חוקית', f: 'כפל חוקי רק כשעושים אותו לשני הצדדים.' },
        { t: 'הכף הימנית כבדה יותר', f: 'דווקא הצד השמאלי הוכפל, אז הוא זה שגדל.' },
        { t: 'אי אפשר לדעת בלי לדעת מה x', f: 'כאן אין x בכלל. יש משקולות רגילות, ואפשר לספור אותן.' }
      ],
      hints: [
        'כמה משקולות יש בכף השמאלית אחרי שמכפילים פי שניים?',
        m('2 × 5 = 10') + ' בצד אחד, ועדיין ' + m('5') + ' בצד השני.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את המשוואות על המאזניים',
      sub: 'משוואה היא מאזניים מאוזנים, ופותרים אותה בפעולות שעושים לשתי הכפות.',
      tip: 'כל הכבוד. עכשיו אתה יודע לפתור משוואה בלי לנחש.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית:',
      formula: m('a = b ⇒ a + c = b + c')
    }
  ];

  window.NoamGame.boot({
    slug: 'maznayim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'פעולה חוקית', math: 'x + 4 = 10' },
      { step: 4, name: 'פתרון בשני צעדים', math: '2x + 5 = 13' },
      { step: 6, name: 'משוואה מסיפור', math: '3x + 4 = 19' },
      { step: 7, name: 'שמירה על איזון', math: 'a = b' }
    ],
    bonus: {
      label: 'מכונת המשוואות ⚖️',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הכפתור וקבל משוואה חדשה לפתור.',
      setup: function (box, ctx) {
        var a = 3, b = 2, x = 3, open = false;
        box.innerHTML = '<div class="bTitle">מכונת המשוואות</div>'
          + '<div class="bSub">קבל משוואה, פתור אותה בראש, ואז בדוק את הצעדים.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<button type="button" class="bDice" data-roll>⚖️ משוואה חדשה</button>'
          + '<button type="button" class="bDice" data-show>גלה את הצעדים</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        function draw() {
          var c = a * x + b;
          chip.textContent = a + 'x + ' + b + ' = ' + c;
          sol.innerHTML = '<div>' + a + 'x + ' + b + ' − ' + b + ' = ' + c + ' − ' + b + '</div>'
            + '<div>' + a + 'x = ' + (c - b) + '</div>'
            + '<div>' + a + 'x ÷ ' + a + ' = ' + (c - b) + ' ÷ ' + a + '</div>'
            + '<div>x = ' + x + '</div>';
          sol.hidden = !open;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          a = 2 + Math.floor(Math.random() * 4);
          b = 1 + Math.floor(Math.random() * 9);
          x = 2 + Math.floor(Math.random() * 8);
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
