/**
 * ציד הזוויות — an engine game.
 *
 * The idea: one known angle is enough. With adjacent angles (they sum to 180),
 * vertical angles (they are equal) and parallel lines (corresponding angles are
 * equal) you can derive every other angle without a protractor.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink, MAIN = PAL.main, SOFT = PAL.soft, LINE = PAL.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef';
  var BAD = '#b42318';
  var FONT = 'Secular One, sans-serif';

  /* ---------- geometry helpers (angles in degrees, counter-clockwise, y points down) ---------- */
  function rad(d) { return d * Math.PI / 180; }
  function f(n) { return Math.round(n * 100) / 100; }
  function P(cx, cy, r, a) { return [f(cx + r * Math.cos(rad(a))), f(cy - r * Math.sin(rad(a)))]; }

  /** A pie slice from angle a0 to angle a1 around (cx, cy). */
  function sector(cx, cy, r, a0, a1) {
    var p0 = P(cx, cy, r, a0), p1 = P(cx, cy, r, a1);
    return 'M ' + cx + ' ' + cy + ' L ' + p0[0] + ' ' + p0[1]
      + ' A ' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 0 ' + p1[0] + ' ' + p1[1] + ' Z';
  }

  /** A label placed on the bisector of a slice. */
  function label(cx, cy, r, a0, a1, text, color, id, size) {
    var p = P(cx, cy, r, (a0 + a1) / 2);
    return '<text id="' + (id || '') + '" x="' + p[0] + '" y="' + f(p[1] + 5) + '" font-size="' + (size || 15) + '"'
      + ' text-anchor="middle" direction="ltr" font-family="' + FONT + '" fill="' + color + '"'
      + ' stroke="#fff" stroke-width="3" style="paint-order:stroke;pointer-events:none">' + text + '</text>';
  }

  function seg(x1, y1, x2, y2, color, w, id) {
    return '<line' + (id ? ' id="' + id + '"' : '') + ' x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2)
      + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" style="pointer-events:none"/>';
  }

  /** Shake an element sideways, then settle it back. */
  function shake(ctx, el) {
    ctx.tween(380, function (l) {
      el.setAttribute('transform', 'translate(' + f(Math.sin(l * 26) * (1 - l) * 6) + ' 0)');
    }).then(function () { el.removeAttribute('transform'); });
  }

  /* ---------- a line with three consecutive angles on one side ---------- */
  var CV = { x: 201, y: 205 };

  function chainSvg(a, c, unknown, known) {
    var b = 180 - a - c;
    var r0 = a, r1 = a + b;
    var R = 96, RL = 112;
    var s = '';
    s += '<path id="w0" d="' + sector(CV.x, CV.y, R, 0, r0) + '" fill="' + SOFT + '" stroke="' + LINE + '" stroke-width="1.5" style="cursor:pointer"/>';
    s += '<path id="w1" d="' + sector(CV.x, CV.y, R, r0, r1) + '" fill="' + WARM_SOFT + '" stroke="' + WARM + '" stroke-width="1.5" style="cursor:pointer"/>';
    s += '<path id="w2" d="' + sector(CV.x, CV.y, R, r1, 180) + '" fill="' + SOFT + '" stroke="' + LINE + '" stroke-width="1.5" style="cursor:pointer"/>';
    s += seg(30, CV.y, 372, CV.y, INK, 3);
    var p0 = P(CV.x, CV.y, RL, r0), p1 = P(CV.x, CV.y, RL, r1);
    s += seg(CV.x, CV.y, p0[0], p0[1], INK, 3) + seg(CV.x, CV.y, p1[0], p1[1], INK, 3);
    var arcA = P(CV.x, CV.y, RL, 0), arcB = P(CV.x, CV.y, RL, 180);
    s += '<path d="M ' + arcA[0] + ' ' + arcA[1] + ' A ' + RL + ' ' + RL + ' 0 0 0 ' + arcB[0] + ' ' + arcB[1] + '"'
      + ' fill="none" stroke="' + MAIN + '" stroke-width="2" stroke-dasharray="5 5" style="pointer-events:none"/>';
    s += '<text x="' + CV.x + '" y="' + (CV.y - RL - 8) + '" font-size="15" text-anchor="middle" direction="ltr" font-family="' + FONT + '" fill="' + MAIN + '">180°</text>';
    s += '<circle cx="' + CV.x + '" cy="' + CV.y + '" r="5" fill="' + INK + '" style="pointer-events:none"/>';
    s += label(CV.x, CV.y, 62, 0, r0, a + '°', MAIN, 'l0');
    s += label(CV.x, CV.y, 62, r0, r1, unknown ? '?' : (b + '°'), WARM, 'l1', 18);
    s += label(CV.x, CV.y, 62, r1, 180, c + '°', MAIN, 'l2');
    return s;
  }

  /* ---------- two parallel lines and a transversal ---------- */
  var QS = [0, 1, 2, 3];
  function qRange(phi, q) {
    return [[0, phi], [phi, 180], [180, 180 + phi], [180 + phi, 360]][q];
  }
  function qValue(phi, q) { return (q === 0 || q === 2) ? phi : 180 - phi; }

  /** Intersection points of the transversal with the two parallel lines. */
  function crossings(phi) {
    var dx = 100 / Math.tan(rad(phi));
    return [{ x: 232, y: 100 }, { x: f(232 - dx), y: 200 }];
  }

  /**
   * labelOf(i, q) gives the label text of a slice; fillOf(i, q) its fill.
   * Slices are ids "s<i><q>", labels "t<i><q>".
   */
  function parallelSvg(phi, labelOf, fillOf) {
    var X = crossings(phi);
    var R = 40;
    var s = '';
    [0, 1].forEach(function (i) {
      QS.forEach(function (q) {
        var rg = qRange(phi, q);
        s += '<path id="s' + i + q + '" d="' + sector(X[i].x, X[i].y, R, rg[0], rg[1]) + '" fill="' + fillOf(i, q)
          + '" stroke="' + LINE + '" stroke-width="1.5" style="cursor:pointer"/>';
      });
    });
    s += seg(30, 100, 372, 100, INK, 3) + seg(30, 200, 372, 200, INK, 3);
    var top = P(X[0].x, X[0].y, 60 / Math.sin(rad(phi)) + 8, phi);
    var bot = P(X[1].x, X[1].y, 60 / Math.sin(rad(phi)) + 8, phi + 180);
    s += seg(top[0], top[1], bot[0], bot[1], INK, 3);
    /* parallel marks on both lines */
    [100, 200].forEach(function (y) {
      s += '<polyline points="60,' + (y - 7) + ' 68,' + y + ' 60,' + (y + 7) + '" fill="none" stroke="' + MAIN + '" stroke-width="2.2" stroke-linecap="round" style="pointer-events:none"/>';
      s += '<polyline points="70,' + (y - 7) + ' 78,' + y + ' 70,' + (y + 7) + '" fill="none" stroke="' + MAIN + '" stroke-width="2.2" stroke-linecap="round" style="pointer-events:none"/>';
    });
    [0, 1].forEach(function (i) {
      QS.forEach(function (q) {
        var rg = qRange(phi, q);
        var col = i === 0 && q === 0 ? WARM : MAIN;
        s += label(X[i].x, X[i].y, 27, rg[0], rg[1], labelOf(i, q), col, 't' + i + q, 13);
      });
    });
    return s;
  }

  /* ---------- scene 1: two crossing lines ---------- */
  function crossScene(ctx) {
    var cx = 201, cy = 150, L = 118, th = 115, done = false;
    var rot = Math.round(th);
    var s = '';
    for (var k = 0; k < 4; k++) {
      s += '<path id="a' + k + '" d="" fill="' + (k % 2 === 0 ? WARM_SOFT : SOFT) + '" stroke="' + (k % 2 === 0 ? WARM : LINE) + '" stroke-width="1.5"/>';
    }
    s += seg(24, cy, 378, cy, INK, 3);
    s += '<line id="rot" x1="0" y1="0" x2="0" y2="0" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + INK + '"/>';
    for (k = 0; k < 4; k++) {
      s += '<text id="b' + k + '" x="0" y="0" font-size="15" text-anchor="middle" direction="ltr" font-family="' + FONT + '"'
        + ' fill="' + (k % 2 === 0 ? '#b45309' : MAIN) + '" stroke="#fff" stroke-width="3" style="paint-order:stroke;pointer-events:none"></text>';
    }
    s += '<g id="knobG" style="cursor:grab"><circle id="knob" cx="0" cy="0" r="12" fill="' + INK + '"/>'
      + '<text id="knobT" x="0" y="0" font-size="13" fill="#fff" text-anchor="middle" font-family="' + FONT + '" style="pointer-events:none">↻</text>'
      + '<circle id="grab" cx="0" cy="0" r="24" fill="transparent"/></g>';
    ctx.draw(s);

    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>הזוג הכתום (קודקודיות)</b><span data-s="w" dir="ltr"></span></div>'
      + '<div><b>הזוג הכחול (קודקודיות)</b><span data-s="c" dir="ltr"></span></div>'
      + '</div>'
    );
    var sw = box.querySelector('[data-s="w"]'), sc = box.querySelector('[data-s="c"]');

    function render() {
      var A = rot, B = 180 - rot;
      var arcs = [[0, A], [A, 180], [180, 180 + A], [180 + A, 360]];
      for (var i = 0; i < 4; i++) {
        ctx.el('a' + i).setAttribute('d', sector(cx, cy, 58, arcs[i][0], arcs[i][1]));
        var p = P(cx, cy, 76, (arcs[i][0] + arcs[i][1]) / 2);
        var t = ctx.el('b' + i);
        t.setAttribute('x', p[0]);
        t.setAttribute('y', f(p[1] + 5));
        t.textContent = (i % 2 === 0 ? A : B) + '°';
      }
      var q = P(cx, cy, L, A), o = P(cx, cy, L, A + 180);
      var line = ctx.el('rot');
      line.setAttribute('x1', o[0]); line.setAttribute('y1', o[1]);
      line.setAttribute('x2', q[0]); line.setAttribute('y2', q[1]);
      ctx.el('knob').setAttribute('cx', q[0]); ctx.el('knob').setAttribute('cy', q[1]);
      ctx.el('grab').setAttribute('cx', q[0]); ctx.el('grab').setAttribute('cy', q[1]);
      ctx.el('knobT').setAttribute('x', q[0]); ctx.el('knobT').setAttribute('y', f(q[1] + 4.5));
      sw.textContent = A + '° = ' + A + '°';
      sc.textContent = B + '° = ' + B + '°';
      ctx.caption(m(A + '° + ' + B + '° = 180°'));
      if (!done) ctx.note('הזווית הכתומה היא ' + m(A + '°') + '. הצמודה לה היא ' + m(B + '°') + '.');
    }

    ctx.drag(ctx.el('knobG'), {
      move: function (x, y) {
        var a = Math.atan2(cy - y, x - cx) * 180 / Math.PI;
        if (a < 0) a += 180;
        var n = Math.max(12, Math.min(168, Math.round(a)));
        if (n !== rot) { rot = n; ctx.sfx('tick'); render(); }
      },
      end: function () {
        if (done || rot < 60 || rot > 70) return;
        done = true;
        ctx.sfx('correct');
        ctx.burst(18);
        ctx.note('הזווית הכתומה היא ' + m(rot + '°') + ', והכחולה ' + m((180 - rot) + '°') + '. שים לב שהזוויות שבאותו צבע תמיד שוות.', 'good');
        ctx.say('כל שתי זוויות צמודות נותנות ' + m('180°') + ', וזוויות קודקודיות שוות זו לזו.', { mood: 'happy', attn: true });
        ctx.solved();
      }
    });
    render();
  }

  /* ---------- scene 2: the chain on a line ---------- */
  function chainScene(ctx) {
    var A = 55, C = 75, MID = 50;
    var got = [false, false], revealed = false;
    ctx.draw(chainSvg(A, C, true));
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b>ידועה ראשונה</b><span data-s="0" dir="ltr">—</span></div>'
      + '<div><b>ידועה שנייה</b><span data-s="1" dir="ltr">—</span></div>'
      + '<div><b>סכום הידועות</b><span data-s="2" dir="ltr">—</span></div>'
      + '</div>'
    );
    function cell(k) { return box.querySelector('[data-s="' + k + '"]'); }
    ctx.register('chain', ctx.el('w0'));
    ctx.caption(m('55° + ? + 75° = 180°'));
    ctx.note('לחץ על שתי הזוויות הכחולות כדי לאסוף אותן.');

    function collect(k, val) {
      if (got[k === 0 ? 0 : 1]) return;
      got[k === 0 ? 0 : 1] = true;
      ctx.el('w' + k).setAttribute('fill', GOOD_SOFT);
      ctx.el('w' + k).setAttribute('stroke', GOOD);
      cell(k === 0 ? 0 : 1).textContent = val + '°';
      ctx.sfx('click');
      if (got[0] && got[1]) {
        cell(2).textContent = (A + C) + '°';
        ctx.caption(m('180° − ' + (A + C) + '° = ?'));
        ctx.note('נאספו שתיהן: ' + m(A + '° + ' + C + '° = ' + (A + C) + '°') + '. עכשיו לחץ על הזווית הכתומה.');
        ctx.say('יש לך את הסכום. מה נשאר עד ' + m('180°') + '?', { mood: 'happy' });
      } else {
        ctx.note('אספת ' + m(val + '°') + '. נשארה עוד זווית ידועה אחת.');
      }
    }
    ctx.el('w0').addEventListener('click', function () { if (!revealed) collect(0, A); });
    ctx.el('w2').addEventListener('click', function () { if (!revealed) collect(2, C); });
    ctx.el('w1').addEventListener('click', function () {
      if (revealed) return;
      if (!(got[0] && got[1])) {
        ctx.sfx('error');
        shake(ctx, ctx.el('w1'));
        ctx.note('קודם אסוף את שתי הזוויות הכחולות, ואז תוכל לחשב את החסרה.');
        return;
      }
      revealed = true;
      ctx.el('l1').textContent = MID + '°';
      ctx.el('l1').setAttribute('fill', GOOD);
      ctx.el('w1').setAttribute('fill', GOOD_SOFT);
      ctx.el('w1').setAttribute('stroke', GOOD);
      ctx.caption(m('180° − ' + (A + C) + '° = ' + MID + '°'));
      ctx.sfx('correct');
      ctx.burst(18);
      ctx.note('הזווית החסרה היא ' + m(MID + '°') + '. בדיקה: ' + m(A + ' + ' + MID + ' + ' + C + ' = 180') + '.', 'good');
      ctx.say('שלוש זוויות על ישר נותנות ' + m('180°') + '. אספת את הידועות, והחסרה נשארה לבד.', { mood: 'happy', attn: true });
      ctx.solved();
    });
  }

  /* ---------- scene 3: parallel lines ---------- */
  function parallelScene(ctx) {
    var phi = 60, found = {}, total = 0, done = false, wrongs = 0;
    var targets = { '02': true, '10': true, '12': true };
    function isGiven(i, q) { return i === 0 && q === 0; }
    ctx.draw(parallelSvg(phi,
      function (i, q) { return isGiven(i, q) ? '60°' : ''; },
      function (i, q) { return isGiven(i, q) ? WARM_SOFT : SOFT; }));
    ctx.caption(m('60° = 60°'));
    ctx.note('הזווית הכתומה היא ' + m('60°') + '. לחץ על כל זווית שגדולה בדיוק כמוה.');
    ctx.register('par', ctx.el('s10'));

    [0, 1].forEach(function (i) {
      QS.forEach(function (q) {
        if (isGiven(i, q)) return;
        var id = '' + i + q;
        ctx.el('s' + id).addEventListener('click', function () {
          if (done || found[id]) return;
          var val = qValue(phi, q);
          if (val === phi) {
            found[id] = true;
            total++;
            var X = crossings(phi)[i];
            var rg = qRange(phi, q);
            var d = P(X.x, X.y, 19, (rg[0] + rg[1]) / 2);
            ctx.el('s' + id).setAttribute('fill', GOOD_SOFT);
            ctx.el('s' + id).setAttribute('stroke', GOOD);
            ctx.el('t' + id).textContent = '60°';
            ctx.el('t' + id).setAttribute('fill', GOOD);
            ctx.el('s' + id).insertAdjacentHTML('afterend', '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="4" fill="' + GOOD + '" style="pointer-events:none"/>');
            ctx.sfx('correct');
            if (total < 3) {
              ctx.note('נכון, זו ' + m('60°') + '. מצאת ' + m(String(total)) + ' מתוך ' + m('3') + '.');
            } else {
              done = true;
              ctx.burst(20);
              ctx.note('מצאת את כל השלוש. כל הזוויות הירוקות והכתומה שוות ' + m('60°') + ', והארבע האחרות הן ' + m('120°') + '.', 'good');
              ctx.say('בין מקבילים, זוויות מתאימות שוות, וזוויות קודקודיות שוות. מזווית אחת קיבלת ארבע.', { mood: 'happy', attn: true });
              ctx.solved();
            }
          } else {
            wrongs++;
            ctx.sfx('error');
            shake(ctx, ctx.el('s' + id));
            ctx.el('t' + id).textContent = '120°';
            ctx.el('t' + id).setAttribute('fill', BAD);
            ctx.note('זו זווית של ' + m('120°') + ': היא צמודה לזווית של ' + m('60°') + ' ולכן סכומן ' + m('180°') + ', והיא לא שווה לה.');
          }
        });
      });
    });
  }

  /* ---------- static pictures for quiz questions ---------- */
  function fanStill(ctx) {
    var cx = 201, cy = 215, R = 100;
    var p = P(cx, cy, 120, 70);
    ctx.draw(
      '<path d="' + sector(cx, cy, R, 0, 70) + '" fill="' + WARM_SOFT + '" stroke="' + WARM + '" stroke-width="1.5"/>'
      + '<path d="' + sector(cx, cy, R, 70, 180) + '" fill="' + SOFT + '" stroke="' + LINE + '" stroke-width="1.5"/>'
      + seg(30, cy, 372, cy, INK, 3) + seg(cx, cy, p[0], p[1], INK, 3)
      + '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + INK + '"/>'
      + label(cx, cy, 66, 0, 70, '70°', '#b45309', '', 16)
      + label(cx, cy, 66, 70, 180, '?', MAIN, '', 22));
  }

  function crossStill(ctx) {
    var cx = 201, cy = 150, th = 130, L = 118;
    var q = P(cx, cy, L, th), o = P(cx, cy, L, th + 180);
    var arcs = [[0, th], [th, 180], [180, 180 + th], [180 + th, 360]];
    var s = '';
    for (var i = 0; i < 4; i++) {
      s += '<path d="' + sector(cx, cy, 52, arcs[i][0], arcs[i][1]) + '" fill="' + (i === 0 ? WARM_SOFT : (i === 2 ? SOFT : '#fff')) + '" stroke="' + LINE + '" stroke-width="1.5"/>';
    }
    s += seg(24, cy, 378, cy, INK, 3) + seg(o[0], o[1], q[0], q[1], INK, 3)
      + '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + INK + '"/>'
      + label(cx, cy, 70, 0, th, '130°', '#b45309', '', 16)
      + label(cx, cy, 70, 180, 180 + th, '?', MAIN, '', 22);
    ctx.draw(s);
  }

  function parallelStill(ctx) {
    var phi = 70;
    ctx.draw(parallelSvg(phi,
      function (i, q) { return i === 0 && q === 0 ? '70°' : (i === 1 && q === 0 ? '?' : ''); },
      function (i, q) { return i === 0 && q === 0 ? WARM_SOFT : (i === 1 && q === 0 ? '#dbe7ff' : '#fff'); }));
  }

  function chainStill(ctx) {
    ctx.draw(chainSvg(48, 67, true));
  }

  /* ---------- the game ---------- */
  var W = 402, H = 300;

  var steps = [
    {
      mode: 'intro',
      tA: 'ציד הזוויות', tM: '70° + ? = 180°',
      sub: 'אין לך מד זווית? לא צריך. מזווית אחת אפשר לגלות את כל השאר.',
      tip: 'שלום, אני אליהו. בוא נצא לציד זוויות, בלי מד זווית ובלי למדוד כלום.',
      emoji: '📐',
      eq: m('a + b = 180°'),
      note: 'אליהו יראה לך שלושה כללים קטנים שמגלים זוויות נסתרות, וכל אחד מהם מתחיל מזווית אחת שאתה כבר מכיר.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'שני ישרים נחתכים',
      sub: 'גרור את העיגול השחור וסובב את הישר. ארבע זוויות משתנות יחד.',
      tip: 'שני ישרים נחתכים יוצרים ארבע זוויות. סובב את הישר, ותראה מה נשאר קבוע.',
      cue: 'סובב עד שהזווית הכתומה בין 60 ל־70 מעלות',
      cueDone: 'יפה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שני ישרים נחתכים, אחד מהם ניתן לסיבוב בגרירה, וארבע זוויות צבועות בשני צבעים',
      nudge: { target: 'scene', text: 'גרור את העיגול השחור סביב נקודת החיתוך.' },
      setup: crossScene
    },
    {
      mode: 'quiz',
      tA: 'הזווית הצמודה',
      sub: 'על הישר יש זווית של ' + m('70°') + '. מה גודל הזווית הצמודה לה?',
      tip: 'שתי זוויות צמודות על ישר משלימות זו את זו לישר שלם.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ישר ועליו קרן היוצרת זווית של שבעים מעלות וזווית צמודה לא ידועה',
      setup: fanStill,
      win: 'נכון. זוויות צמודות מסתכמות ב־' + m('180°') + '.',
      wrongSay: 'ישר שלם הוא ' + m('180°') + '. כמה חסר לך עד שם?',
      opts: [
        { t: '110°', c: true, f: m('70° + 110° = 180°') + ', בדיוק ישר שלם.' },
        { t: '20°', f: 'זה ' + m('90° − 70°') + '. אבל ישר שלם הוא ' + m('180°') + ', לא ' + m('90°') + '.' },
        { t: '290°', f: 'זה ' + m('360° − 70°') + '. זה מעגל שלם, ואנחנו על ישר.' },
        { t: '70°', f: 'זוויות שוות הן קודקודיות. כאן הזוויות צמודות, ולכן הן מסתכמות ב־' + m('180°') + '.' }
      ],
      hints: [
        'ישר הוא זווית של ' + m('180°') + '.',
        'חשב ' + m('180° − 70°') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'שרשרת על ישר',
      sub: 'שלוש זוויות עוקבות על ישר. שתיים ידועות, אחת חסרה.',
      tip: 'כל הזוויות על ישר ביחד הן ' + m('180°') + '. אסוף את הידועות ותגלה את החסרה.',
      cue: 'אסוף את שתי הכחולות ואז לחץ על הכתומה',
      cueDone: 'השרשרת הושלמה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ישר ועליו שלוש זוויות עוקבות, שתיים ידועות ואחת חסרה',
      nudge: { target: 'chain', text: 'לחץ על אחת הזוויות הכחולות כדי לאסוף אותה.' },
      setup: chainScene
    },
    {
      mode: 'quiz',
      tA: 'הזווית הקודקודית',
      sub: 'שני ישרים נחתכים, ואחת הזוויות היא ' + m('130°') + '. מה גודל הזווית שממול לה?',
      tip: 'הזווית שממול נקראת קודקודית. חשוב מה למדת על זוגות הצבעים.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שני ישרים נחתכים עם זווית של מאה ושלושים מעלות וזווית קודקודית לא ידועה',
      setup: crossStill,
      win: 'נכון. זוויות קודקודיות שוות.',
      wrongSay: 'חשוב על הצבעים בסצנה: מה היה בזוג הצבוע באותו צבע?',
      opts: [
        { t: '130°', c: true, f: 'זוויות קודקודיות שוות זו לזו, בדיוק כמו הזוג בצבע אחד.' },
        { t: '50°', f: 'זו הזווית הצמודה, ' + m('180° − 130°') + '. אבל המבוקשת נמצאת ממול, לא בצד.' },
        { t: '230°', f: 'זה ' + m('360° − 130°') + '. זה חיבור של שתי זוויות אחרות, לא התשובה.' },
        { t: '40°', f: 'אין כלל שמוביל למספר הזה. הזווית שממול שווה בדיוק לנתונה.' }
      ],
      hints: [
        'הזווית שממול נמצאת באותו צבע בסצנה שראית.',
        'זוויות קודקודיות הן תמיד שוות.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מקבילים וישר חותך',
      sub: 'שני ישרים מקבילים ושלישי חותך אותם. מצא את כל הזוויות השוות לזווית הכתומה.',
      tip: 'כשהישרים מקבילים, אותה זווית חוזרת על עצמה. מצא את כל המופעים שלה.',
      cue: 'לחץ על כל הזוויות השוות לכתומה',
      cueDone: 'מצאת את כולן. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שני ישרים מקבילים וישר חותך, עם שמונה זוויות, אחת מהן נתונה',
      nudge: { target: 'par', text: 'נסה ללחוץ על זווית בישר התחתון, באותו מקום שבו הכתומה בעליון.' },
      setup: parallelScene
    },
    {
      mode: 'quiz',
      tA: 'זווית מתאימה',
      sub: 'הישרים מקבילים. בצומת העליון יש זווית של ' + m('70°'
      ) + '. מה גודל הזווית המסומנת בצומת התחתון, באותו מקום?',
      tip: 'באותו מקום בצומת התחתון, בין מקבילים. מה חוזר על עצמו?',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'שני ישרים מקבילים וישר חותך, בצומת העליון זווית של שבעים מעלות ובצומת התחתון זווית מתאימה לא ידועה',
      setup: parallelStill,
      win: 'נכון. זוויות מתאימות בין מקבילים שוות.',
      wrongSay: 'שתי הזוויות נמצאות באותו מקום בכל צומת. מה זה אומר עליהן?',
      opts: [
        { t: '70°', c: true, f: 'זוויות מתאימות בין ישרים מקבילים שוות.' },
        { t: '110°', f: 'זו הצמודה, ' + m('180° − 70°') + '. הזווית המסומנת היא מתאימה, לא צמודה.' },
        { t: '20°', f: 'זה ' + m('90° − 70°') + '. אין לזה קשר לשום כלל כאן.' },
        { t: '180°', f: 'זה ישר שלם. זווית אחת בצומת קטנה בהרבה.' }
      ],
      hints: [
        'חשוב על הסצנה: הזווית הכתומה חזרה גם בישר התחתון, באותו מקום.',
        'בין מקבילים, זוויות מתאימות שוות.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'חישוב בשרשרת',
      sub: 'על ישר יש שלוש זוויות עוקבות: ' + m('48°') + ', זווית חסרה, ו־' + m('67°') + '. מה גודל החסרה?',
      tip: 'כל הזוויות על ישר מסתכמות ב־' + m('180°') + '. חבר את הידועות ופחת אותן מהישר.',
      btn: 'לסיכום ←',
      aspect: [W, H],
      alt: 'ישר ועליו שלוש זוויות עוקבות: ארבעים ושמונה מעלות, זווית חסרה, ושישים ושבע מעלות',
      setup: chainStill,
      win: 'מעולה. עכשיו אתה יודע לגזור זוויות בעצמך.',
      wrongSay: 'חבר קודם את שתי הידועות, ואז הפחת מ־' + m('180°') + '.',
      opts: [
        { t: '65°', c: true, f: m('48° + 67° = 115°') + ', ו־' + m('180° − 115° = 65°') + '.' },
        { t: '115°', f: 'זה סכום שתי הידועות. עוד לא הפחתת אותו מ־' + m('180°') + '.' },
        { t: '132°', f: 'זה ' + m('180° − 48°') + '. התעלמת מהזווית של ' + m('67°') + '.' },
        { t: '113°', f: 'זה ' + m('180° − 67°') + '. התעלמת מהזווית של ' + m('48°') + '.' }
      ],
      hints: [
        m('48° + 67°') + ' הן שתי הזוויות הידועות.',
        'הסכום הוא ' + m('115°') + '. כמה חסר לו עד ' + m('180°') + '?'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את ציד הזוויות',
      sub: 'מזווית אחת גזרת זוויות צמודות, קודקודיות, מתאימות ושרשרת שלמה.',
      tip: 'כל הכבוד. מעכשיו כל זווית נסתרת היא רק שאלה של כלל אחד.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית: מזווית אחת אפשר לגזור את כולן.',
      formula: m('a + b = 180°')
    }
  ];

  window.NoamGame.boot({
    slug: 'tzayid-hazaviyot',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'זוויות צמודות', math: '180° − a' },
      { step: 4, name: 'זוויות קודקודיות', math: 'a = a' },
      { step: 6, name: 'זוויות מתאימות', math: '70° = 70°' },
      { step: 7, name: 'שרשרת על ישר', math: '180° − 115°' }
    ],
    bonus: {
      label: 'מכונת הזוויות 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הקובייה וקבל שאלת זווית חדשה.',
      setup: function (box, ctx) {
        var task = null, open = false;
        box.innerHTML = '<div class="bTitle">מכונת הזוויות</div>'
          + '<div class="bSub" data-q>קבל שאלה, חשב בראש, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol hidden></div>'
          + '<button type="button" class="bDice" data-roll>🎲 שאלה חדשה</button>'
          + '<button type="button" class="bDice" data-show>גלה את התשובה</button>';
        var qEl = box.querySelector('[data-q]');
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');

        function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

        function make() {
          var kind = rnd(0, 3), g = rnd(6, 30) * 5;
          if (g === 90) g = 65;
          if (kind === 0) {
            return { q: 'מה הזווית הצמודה לזווית הנתונה?', ex: g + '° + ? = 180°', ans: [(180 - g) + '°', m('180° − ' + g + '° = ' + (180 - g) + '°')] };
          }
          if (kind === 1) {
            return { q: 'מה הזווית הקודקודית לזווית הנתונה?', ex: g + '° = ?', ans: [g + '°', 'זוויות קודקודיות שוות'] };
          }
          if (kind === 2) {
            return { q: 'הישרים מקבילים. מה הזווית המתאימה לזווית הנתונה?', ex: g + '° = ?', ans: [g + '°', 'זוויות מתאימות שוות'] };
          }
          var a = rnd(4, 14) * 5, c = rnd(4, 14) * 5;
          return { q: 'שלוש זוויות על ישר, שתיים ידועות. מה השלישית?', ex: a + '° + ? + ' + c + '° = 180°',
            ans: [(180 - a - c) + '°', m('180° − ' + (a + c) + '° = ' + (180 - a - c) + '°')] };
        }

        function draw() {
          if (!task) task = make();
          qEl.textContent = task.q;
          chip.textContent = task.ex;
          sol.innerHTML = '<div>' + task.ans[1] + '</div><div class="bOk">התשובה: ' + task.ans[0] + '</div>';
          sol.hidden = !open;
        }

        box.querySelector('[data-roll]').addEventListener('click', function () {
          task = make();
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
