/**
 * השיפוע של הפונקציה הקווית — an engine game.
 *
 * The idea: in y = mx + b, the number m says how much you climb for every
 * single step to the right, and b says where the line crosses the y axis.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', MUTED = '#64748b';
  var RED = '#c2410c';

  /* The coordinate system: x from -6 to 6, y from -4 to 4, one unit = 28px. */
  var U = 28, OX = 201, OY = 150;
  function px(x) { return OX + U * x; }
  function py(y) { return OY - U * y; }

  function num(n) { return n < 0 ? '\u2212' + (-n) : String(n); }

  /** The text of y = mx + b, with the usual shortcuts (1x becomes x). */
  function eqText(sl, ic) {
    var mp = sl === 0 ? '' : (sl === 1 ? 'x' : (sl === -1 ? '\u2212x' : num(sl) + 'x'));
    if (sl === 0) return 'y = ' + num(ic);
    if (ic === 0) return 'y = ' + mp;
    return 'y = ' + mp + (ic > 0 ? ' + ' + ic : ' \u2212 ' + (-ic));
  }

  /** Grid, axes and tick numbers. Everything stays inside x 33..369, y 38..262. */
  function base() {
    var out = '<defs><clipPath id="clipG"><rect x="' + px(-6) + '" y="' + py(4) + '" width="' + (12 * U)
      + '" height="' + (8 * U) + '"/></clipPath></defs>';
    var i;
    for (i = -6; i <= 6; i++) {
      out += '<line x1="' + px(i) + '" y1="' + py(4) + '" x2="' + px(i) + '" y2="' + py(-4) + '"'
        + ' stroke="' + LINE + '" stroke-width="' + (i === 0 ? 0 : 0.8) + '" opacity=".7"/>';
    }
    for (i = -4; i <= 4; i++) {
      out += '<line x1="' + px(-6) + '" y1="' + py(i) + '" x2="' + px(6) + '" y2="' + py(i) + '"'
        + ' stroke="' + LINE + '" stroke-width="' + (i === 0 ? 0 : 0.8) + '" opacity=".7"/>';
    }
    out += '<line x1="' + px(-6) + '" y1="' + OY + '" x2="' + px(6) + '" y2="' + OY + '" stroke="' + INK + '" stroke-width="1.8"/>'
      + '<line x1="' + OX + '" y1="' + py(4) + '" x2="' + OX + '" y2="' + py(-4) + '" stroke="' + INK + '" stroke-width="1.8"/>'
      + '<g font-family="Secular One, sans-serif" font-size="10" fill="' + MUTED + '" direction="ltr">';
    for (i = -5; i <= 5; i++) {
      if (i !== 0) out += '<text x="' + px(i) + '" y="' + (OY + 13) + '" text-anchor="middle">' + num(i) + '</text>';
    }
    for (i = -3; i <= 3; i++) {
      if (i !== 0) out += '<text x="' + (OX - 6) + '" y="' + (py(i) + 3.5) + '" text-anchor="end">' + num(i) + '</text>';
    }
    out += '</g><g font-family="Secular One, sans-serif" font-size="13" fill="' + INK + '">'
      + '<text x="' + (px(6) + 6) + '" y="' + (OY + 4) + '">x</text>'
      + '<text x="' + (OX + 8) + '" y="' + (py(4) - 3) + '">y</text></g>';
    return out;
  }

  function lineSVG(id, sl, ic, color, w, dash) {
    return '<line id="' + id + '" x1="' + px(-6) + '" y1="' + py(-6 * sl + ic) + '" x2="' + px(6) + '" y2="' + py(6 * sl + ic) + '"'
      + ' stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"'
      + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' clip-path="url(#clipG)"/>';
  }
  function setLine(el, sl, ic) {
    el.setAttribute('y1', py(-6 * sl + ic));
    el.setAttribute('y2', py(6 * sl + ic));
  }

  function dot(x, y, color, r) {
    return '<circle cx="' + px(x) + '" cy="' + py(y) + '" r="' + (r || 5) + '" fill="' + color + '" stroke="#fff" stroke-width="2"/>';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function stripCell(label, key, color) {
    return '<div><b>' + label + '</b><span class="math" data-v="' + key + '" style="color:' + color + '">0</span></div>';
  }

  /* ---------- step 1: two points, a staircase, the slope ---------- */
  function stairsScene(ctx) {
    var P = [{ x: -2, y: -1 }, { x: 1, y: 1 }];
    var done = false;
    var strip = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + stripCell('צעד ימינה', 'run', WARM) + stripCell('עלייה', 'rise', MAIN) + stripCell('שיפוע', 'slope', GOOD) + '</div>');
    ctx.register('strip', strip);
    function pointG(id) {
      return '<g id="' + id + '" style="cursor:grab">'
        + '<circle r="20" fill="transparent"/>'
        + '<circle r="8" fill="' + MAIN + '" stroke="#fff" stroke-width="2.5"/></g>';
    }
    ctx.draw(base()
      + lineSVG('ln', 0, 0, INK, 3)
      + '<polygon id="tri" points="0,0 0,0 0,0" fill="' + WARM_SOFT + '" fill-opacity=".8" stroke="none"/>'
      + '<line id="legRun" x1="0" y1="0" x2="0" y2="0" stroke="' + WARM + '" stroke-width="3.5" stroke-linecap="round"/>'
      + '<line id="legRise" x1="0" y1="0" x2="0" y2="0" stroke="' + MAIN + '" stroke-width="3.5" stroke-linecap="round"/>'
      + '<text id="tRun" x="0" y="0" text-anchor="middle" font-size="15" fill="' + RED + '" font-family="Secular One, sans-serif"></text>'
      + '<text id="tRise" x="0" y="0" text-anchor="start" font-size="15" fill="' + MAIN + '" font-family="Secular One, sans-serif"></text>'
      + '<g id="pts">' + pointG('pA') + pointG('pB') + '</g>');
    var gA = ctx.el('pA'), gB = ctx.el('pB');
    function setStrip(k, v) { strip.querySelector('[data-v="' + k + '"]').textContent = v; }
    function render() {
      var l = P[0].x < P[1].x ? P[0] : P[1];
      var r = l === P[0] ? P[1] : P[0];
      var run = r.x - l.x, rise = r.y - l.y;
      var sl = rise / run;
      var ic = l.y - sl * l.x;
      setLine(ctx.el('ln'), sl, ic);
      ctx.el('tri').setAttribute('points', px(l.x) + ',' + py(l.y) + ' ' + px(r.x) + ',' + py(l.y) + ' ' + px(r.x) + ',' + py(r.y));
      var run1 = ctx.el('legRun'), rise1 = ctx.el('legRise');
      run1.setAttribute('x1', px(l.x)); run1.setAttribute('x2', px(r.x));
      run1.setAttribute('y1', py(l.y)); run1.setAttribute('y2', py(l.y));
      rise1.setAttribute('x1', px(r.x)); rise1.setAttribute('x2', px(r.x));
      rise1.setAttribute('y1', py(l.y)); rise1.setAttribute('y2', py(r.y));
      var tr = ctx.el('tRun'), ts = ctx.el('tRise');
      tr.textContent = String(run);
      tr.setAttribute('x', (px(l.x) + px(r.x)) / 2);
      tr.setAttribute('y', clamp(py(l.y) + (rise >= 0 ? 17 : -8), 46, 258));
      ts.textContent = num(rise);
      ts.setAttribute('x', px(r.x) + 10);
      ts.setAttribute('y', (py(l.y) + py(r.y)) / 2 + 5);
      gA.setAttribute('transform', 'translate(' + px(P[0].x) + ' ' + py(P[0].y) + ')');
      gB.setAttribute('transform', 'translate(' + px(P[1].x) + ' ' + py(P[1].y) + ')');
      var exact = rise % run === 0;
      var val = Math.round(sl * 100) / 100;
      setStrip('run', String(run));
      setStrip('rise', num(rise));
      setStrip('slope', (exact ? '' : '\u2248 ') + num(val));
      ctx.caption(m('m = ' + num(rise) + ' \u00F7 ' + run + (exact ? ' = ' : ' \u2248 ') + num(val)));
      if (!done) {
        if (sl === 2) ctx.note('השיפוע הוא ' + m('2') + '. על כל צעד ימינה אתה עולה שניים.', 'good');
        else if (sl < 0) ctx.note('הישר יורד. בינתיים חפש ישר שעולה.');
        else ctx.note('בינתיים השיפוע הוא ' + m(String(exact ? val : '\u2248 ' + val)) + '. צריך ' + m('2') + '.');
      }
      return sl;
    }
    var which = 0;
    ctx.drag(ctx.el('pts'), {
      start: function (x, y) {
        var d0 = Math.abs(x - px(P[0].x)) + Math.abs(y - py(P[0].y));
        var d1 = Math.abs(x - px(P[1].x)) + Math.abs(y - py(P[1].y));
        which = d0 <= d1 ? 0 : 1;
      },
      move: function (x, y) {
        var gx = clamp(Math.round((x - OX) / U), -5, 5);
        var gy = clamp(Math.round((OY - y) / U), -4, 4);
        var other = P[1 - which];
        if (gx === other.x) return;
        if (gx !== P[which].x || gy !== P[which].y) {
          P[which].x = gx; P[which].y = gy;
          ctx.sfx('tick');
          render();
        }
      },
      end: function () {
        if (done) return;
        var l = P[0].x < P[1].x ? P[0] : P[1];
        var r = l === P[0] ? P[1] : P[0];
        if ((r.y - l.y) / (r.x - l.x) === 2) {
          done = true;
          ctx.sfx('correct');
          ctx.burst(18);
          ctx.say('מצוין. שיפוע ' + m('2') + ' אומר: על כל צעד ימינה, שני צעדים למעלה.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      }
    });
    render();
  }

  /* ---------- step 3: two sliders, match the dashed line ---------- */
  function matchScene(ctx) {
    var TM = 3, TB = -2;
    var cm = 1, cb = 1, done = false;
    function slider(key, label, lo, hi, val, color) {
      return '<div style="display:flex;align-items:center;gap:10px;direction:ltr">'
        + '<b style="font-family:Secular One,sans-serif;font-size:18px;color:' + color + ';width:22px">' + key + '</b>'
        + '<input type="range" data-s="' + key + '" min="' + lo + '" max="' + hi + '" step="1" value="' + val + '"'
        + ' aria-label="' + label + '" style="flex:1;accent-color:' + color + '">'
        + '<span class="math" data-r="' + key + '" style="font-family:Secular One,sans-serif;font-size:18px;color:' + color
        + ';width:30px;text-align:center">' + num(val) + '</span></div>';
    }
    var box = ctx.extra('<div class="sceneStrip" style="gap:10px;padding:12px 14px">'
      + slider('m', 'השיפוע', 0, 4, cm, MAIN) + slider('b', 'נקודת החיתוך עם ציר y', -3, 3, cb, WARM) + '</div>');
    ctx.register('sliders', box);
    ctx.draw(base()
      + lineSVG('target', TM, TB, RED, 3, '8 7')
      + lineSVG('mine', cm, cb, MAIN, 3.5)
      + '<circle id="bDot" cx="' + OX + '" cy="' + py(cb) + '" r="6" fill="' + WARM + '" stroke="#fff" stroke-width="2"/>');
    function render() {
      setLine(ctx.el('mine'), cm, cb);
      ctx.el('bDot').setAttribute('cy', py(cb));
      box.querySelector('[data-r="m"]').textContent = num(cm);
      box.querySelector('[data-r="b"]').textContent = num(cb);
      ctx.caption(m(eqText(cm, cb)));
      if (cm === TM && cb === TB) {
        ctx.el('mine').setAttribute('stroke', GOOD);
        if (!done) {
          done = true;
          ctx.sfx('correct');
          ctx.burst(18);
          ctx.note('הישר שלך יושב בדיוק על הישר המקווקו. השיפוע ' + m('3') + ' והחיתוך ' + m('\u22122') + '.', 'good');
          ctx.say('בדיוק. ' + m('m') + ' קובע את התלילות, ו־' + m('b') + ' קובע איפה הישר חוצה את ציר ' + m('y') + '.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      } else {
        ctx.el('mine').setAttribute('stroke', MAIN);
        if (!done) {
          if (cm === TM) ctx.note('התלילות כבר נכונה. עכשיו הזז את הישר למעלה או למטה עם הסרגל של ' + m('b') + '.');
          else if (cb === TB) ctx.note('נקודת החיתוך נכונה. עכשיו שנה את התלילות עם הסרגל של ' + m('m') + '.');
          else ctx.note('התאם את שני הסרגלים עד שהישר הכחול יתכסה על הישר המקווקו.');
        }
      }
    }
    box.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = Number(inp.value);
        if (inp.getAttribute('data-s') === 'm') cm = v; else cb = v;
        ctx.sfx('tick');
        render();
      });
    });
    render();
  }

  /* ---------- step 5: walking down a negative slope ---------- */
  function walkScene(ctx) {
    var X0 = -1, Y0 = 4, STEPS = 4, k = 0, busy = false, done = false;
    ctx.draw(base()
      + lineSVG('ln', -2, 2, INK, 3)
      + '<g id="trail"></g>'
      + dot(X0, Y0, MAIN, 5)
      + '<circle id="walker" cx="' + px(X0) + '" cy="' + py(Y0) + '" r="9" fill="' + WARM + '" stroke="#fff" stroke-width="2.5"/>');
    var walker = ctx.el('walker');
    ctx.caption(m('m = ?'));
    ctx.note('לחץ על הכפתור ותראה איך הצעד מתקדם לאורך הישר.');
    var btn = ctx.button('צעד אחד ימינה 👣', function () {
      if (busy || k >= STEPS) return;
      busy = true;
      ctx.busy(true);
      ctx.sfx('click');
      var sx = X0 + k, sy = Y0 - 2 * k;
      ctx.tween(1100, function (l) {
        var a = Math.min(1, l * 2), c = Math.max(0, l * 2 - 1);
        walker.setAttribute('cx', px(sx + a));
        walker.setAttribute('cy', py(sy - 2 * c));
      }).then(function () {
        k += 1;
        ctx.el('trail').insertAdjacentHTML('beforeend',
          '<line x1="' + px(sx) + '" y1="' + py(sy) + '" x2="' + px(sx + 1) + '" y2="' + py(sy) + '" stroke="' + WARM + '" stroke-width="3.5" stroke-linecap="round"/>'
          + '<line x1="' + px(sx + 1) + '" y1="' + py(sy) + '" x2="' + px(sx + 1) + '" y2="' + py(sy - 2) + '" stroke="' + MAIN + '" stroke-width="3.5" stroke-linecap="round"/>'
          + '<text x="' + px(sx + 0.5) + '" y="' + (py(sy) - 7) + '" text-anchor="middle" font-size="14" fill="' + RED + '" font-family="Secular One, sans-serif">1</text>'
          + '<text x="' + (px(sx + 1) + 8) + '" y="' + (py(sy - 1) + 5) + '" direction="ltr" font-size="14" fill="' + MAIN + '" font-family="Secular One, sans-serif">\u22122</text>');
        busy = false;
        ctx.busy(false);
        ctx.caption(m('m = ' + '\u22122' + ' \u00F7 1 = \u22122'));
        if (k < 3) {
          ctx.note('צעד ימינה ' + m('1') + ', ירידה של ' + m('2') + '. ' + (k === 1 ? 'עוד צעד.' : 'שוב אותו דבר.'));
          ctx.sfx('tick');
        } else if (!done) {
          done = true;
          ctx.sfx('correct');
          ctx.burst(18);
          ctx.note('בכל צעד ימינה ירדת ' + m('2') + '. לכן מסמנים את השיפוע ' + m('\u22122') + '. המינוס אומר ירידה.', 'good');
          ctx.say('ישר יורד הוא ישר עם שיפוע שלילי. המינוס הוא הירידה.', { mood: 'happy', attn: true });
          ctx.solved();
        }
        if (k >= STEPS) btn.disabled = true;
      });
    }, { target: 'walk' });
    ctx.register('walk', btn);
  }

  /** A static picture for a question: a line, optionally with a staircase. */
  function picture(sl, ic, stairs, mark) {
    return function (ctx) {
      var out = base() + lineSVG('qln', sl, ic, INK, 3);
      if (stairs) {
        out += '<polyline points="' + px(stairs.x) + ',' + py(stairs.y) + ' ' + px(stairs.x + 1) + ',' + py(stairs.y)
          + ' ' + px(stairs.x + 1) + ',' + py(stairs.y + sl) + '" fill="none" stroke="' + WARM + '" stroke-width="3.5"'
          + ' stroke-linejoin="round" stroke-linecap="round"/>'
          + '<text x="' + px(stairs.x + 0.5) + '" y="' + (py(stairs.y) + (sl >= 0 ? 17 : -8)) + '" text-anchor="middle" font-size="14" fill="' + RED
          + '" font-family="Secular One, sans-serif">1</text>';
      }
      if (mark) out += dot(mark.x, mark.y, WARM, 6);
      ctx.draw(out);
    };
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'השיפוע של הישר',
      tM: ' y = mx + b',
      sub: 'כמה אתה עולה על כל צעד ימינה, ומאיפה אתה מתחיל.',
      tip: 'שלום, אני אליהו. היום נלמד לקרוא ישר כמו מדרגות: כמה עולים בכל צעד.',
      emoji: '📈',
      eq: m('y = mx + b'),
      note: 'אליהו יראה לך ש־' + m('m') + ' הוא כמה עולים על כל צעד ימינה, ו־' + m('b') + ' הוא המקום שבו הישר חוצה את ציר ' + m('y') + '.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'מדרגות על הישר',
      sub: 'גרור את שתי הנקודות הכחולות ותראה איך המדרגה משתנה.',
      tip: 'שתי נקודות על ישר יוצרות מדרגה. גרור אותן עד שהשיפוע יהיה ' + m('2') + '.',
      cue: 'גרור את הנקודות עד שהשיפוע יהיה 2',
      cueDone: 'יפה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מערכת צירים עם ישר, שתי נקודות נגררות ומשולש מדרגות שמראה את הצעד ימינה ואת העלייה',
      nudge: { target: 'scene', text: 'גרור את אחת הנקודות הכחולות למקום אחר.' },
      setup: stairsScene
    },
    {
      mode: 'quiz',
      tA: 'מה השיפוע של הישר?',
      sub: 'הישר עולה שניים על כל צעד אחד ימינה.',
      tip: 'סמן בראש מדרגה אחת: צעד ימינה, ואז כמה למעלה.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ישר עולה עם מדרגה אחת: צעד אחד ימינה ועלייה של שתי יחידות',
      setup: picture(2, 0, { x: -1, y: -2 }),
      win: 'נכון. שיפוע הוא העלייה על כל צעד אחד ימינה.',
      wrongSay: 'חפש כמה עולים על צעד אחד ימינה.',
      opts: [
        { t: 'm = 2', c: true, f: 'צעד אחד ימינה, שניים למעלה. השיפוע הוא ' + m('2') + '.' },
        { t: 'm = 0.5', f: 'הפכת את היחס. כאן העלייה גדולה מהצעד, אז השיפוע גדול מ־' + m('1') + '.' },
        { t: 'm = 3', f: 'חיברת את הצעד ואת העלייה. השיפוע הוא רק העלייה על צעד אחד.' },
        { t: 'm = −2', f: 'הישר עולה, לא יורד, ולכן השיפוע חיובי.' }
      ],
      hints: [
        'הסתכל על המדרגה בציור. הקו הכתום הוא צעד אחד ימינה.',
        'כמה יחידות עולה הישר אחרי הצעד הזה?'
      ]
    },
    {
      mode: 'scene',
      tA: 'שני סרגלים, ישר אחד',
      sub: 'הסרגל של ' + m('m') + ' משנה את התלילות. הסרגל של ' + m('b') + ' מזיז את הישר למעלה ולמטה.',
      tip: 'יש ישר מקווקו אדום. התאם אליו את הישר הכחול בעזרת שני הסרגלים.',
      cue: 'כסה את הישר המקווקו',
      cueDone: 'התאמה מושלמת. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מערכת צירים עם ישר מקווקו אדום ועם ישר כחול שמשנים בעזרת שני סרגלים',
      nudge: { target: 'sliders', text: 'הזז את הסרגל של ' + m('m') + ' ואחר כך את הסרגל של ' + m('b') + '.' },
      setup: matchScene
    },
    {
      mode: 'quiz',
      tA: 'איפה הישר חוצה את ציר ',
      tM: 'y',
      tB: '?',
      sub: 'הישר הוא ' + m('y = x + 3') + '. מה הנקודה שבה הוא חוצה את ציר ' + m('y') + '?',
      tip: 'ב־' + m('b') + ' כתוב איפה הישר חוצה את ציר ' + m('y') + '. מה קורה שם לערך של ' + m('x') + '?',
      btn: 'המשך ←',
      win: 'נכון. b הוא הגובה שבו הישר חוצה את ציר y.',
      wrongSay: 'על ציר y הערך של x הוא אפס. הצב ' + m('x = 0') + '.',
      opts: [
        { t: '(0, 3)', c: true, f: 'כש־' + m('x = 0') + ' מקבלים ' + m('y = 3') + '. זה בדיוק ה־' + m('b') + '.' },
        { t: '(3, 0)', f: 'הספרות הוחלפו. ' + m('(3, 0)') + ' נמצאת על ציר x, לא על ציר y.' },
        { t: '(1, 3)', f: 'ב־' + m('x = 1') + ' מקבלים ' + m('y = 4') + '. וגם זו לא נקודה על ציר y.' },
        { t: '(0, 1)', f: 'זה ה־' + m('m') + ' ולא ה־' + m('b') + '. הנקודה על ציר y נקבעת לפי ' + m('b') + '.' }
      ],
      hints: [
        'כל נקודה על ציר y נראית כך: ' + m('x = 0') + '.',
        'הצב ' + m('x = 0') + ' בנוסחה ' + m('y = x + 3') + ' וחשב את ' + m('y') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'שיפוע שלילי',
      sub: 'הישר יורד. לחץ על הכפתור והלך לאורכו, צעד ימינה ואחר כך ירידה.',
      tip: 'הפעם הישר יורד. בוא נלך עליו צעד אחרי צעד ונראה מה קורה למספר.',
      cue: 'הלך שלושה צעדים לאורך הישר',
      cueDone: 'הבנת למה השיפוע שלילי. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ישר יורד במערכת צירים, ונקודה שצועדת לאורכו: צעד ימינה ואחר כך ירידה של שתי יחידות',
      nudge: { target: 'walk', text: 'לחץ על הכפתור כדי לצעוד.' },
      setup: walkScene
    },
    {
      mode: 'quiz',
      tA: 'מה השיפוע של הישר היורד?',
      sub: 'על כל צעד ימינה הישר יורד שלוש יחידות.',
      tip: 'זכור מה ראית בצעידה: ירידה נותנת שיפוע עם מינוס.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ישר יורד שעובר דרך הנקודה אפס, שלוש ודרך הנקודה אחת, אפס',
      setup: picture(-3, 3, { x: 0, y: 3 }),
      win: 'נכון. ירידה היא שיפוע שלילי.',
      wrongSay: 'הישר יורד כשהולכים ימינה. איזה סימן מתאים לירידה?',
      opts: [
        { t: 'm = −3', c: true, f: 'ירידה של ' + m('3') + ' על כל צעד ימינה היא ' + m('m = \u22123') + '.' },
        { t: 'm = 3', f: 'הגודל נכון, אבל הסימן הפוך. ישר חיובי עולה.' },
        { t: 'm = 0', f: 'שיפוע אפס הוא ישר אופקי שלא עולה ולא יורד.' },
        { t: 'm = −1', f: 'הסימן נכון, אבל הישר יורד שלוש על כל צעד, לא אחת.' }
      ],
      hints: [
        'כשהישר יורד כשהולכים ימינה, השיפוע קטן מאפס.',
        'ירדת ' + m('3') + ' על צעד אחד. אילו מספרים קטנים מאפס מופיעים בתשובות?'
      ]
    },
    {
      mode: 'quiz',
      tA: 'איזה ישר תלול יותר?',
      sub: 'בחר את הישר שעולה הכי מהר כשהולכים ימינה.',
      tip: 'תלילות תלויה ב־' + m('m') + ' בלבד. את ' + m('b') + ' אפשר להתעלם ממנו כאן.',
      btn: 'לסיכום ←',
      win: 'מעולה. הישר עם m הגדול ביותר הוא התלול ביותר.',
      wrongSay: 'חפש את המספר שעומד לפני ה־' + m('x') + '. אותו צריך להשוות.',
      opts: [
        { t: 'y = 6x + 1', c: true, f: 'כאן ' + m('m = 6') + ', הגדול מכולם. הישר הזה עולה הכי מהר.' },
        { t: 'y = 3x + 8', f: 'ה־' + m('b = 8') + ' גבוה, אבל הוא רק מזיז את הישר למעלה. התלילות נקבעת לפי ' + m('m = 3') + '.' },
        { t: 'y = 4x + 5', f: m('m = 4') + ' קטן מ־' + m('6') + '. הישר הזה עולה לאט יותר.' },
        { t: 'y = 5x + 2', f: m('m = 5') + ' קרוב, אבל ' + m('6') + ' גדול ממנו.' }
      ],
      hints: [
        'התלילות היא השיפוע, כלומר ה־' + m('m') + '. את ' + m('b') + ' אפשר להתעלם ממנו.',
        'מצא בכל נוסחה את המספר שליד ה־' + m('x') + ', והשווה ביניהם.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את השיפוע של הישר',
      sub: 'עכשיו אתה קורא ישר כמו מדרגות: כמה עולים או יורדים בכל צעד, ואיפה מתחילים.',
      tip: 'כל הכבוד. כל ישר שתפגוש הוא שיפוע אחד ונקודת חיתוך אחת.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית:',
      formula: m('y = mx + b')
    }
  ];

  window.NoamGame.boot({
    slug: 'shipua-kavi',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'קריאת שיפוע', math: 'm = 2' },
      { step: 4, name: 'משמעות b', math: 'b' },
      { step: 6, name: 'שיפוע שלילי', math: 'm < 0' },
      { step: 7, name: 'השוואת תלילות', math: 'y = 6x + 1' }
    ],
    bonus: {
      label: 'מכונת השיפועים 📐',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל שתי נקודות וחשב את השיפוע של הישר שעובר דרכן.',
      setup: function (box, ctx) {
        var p, guess = 0, solved = false;
        function roll() {
          var sl = Math.floor(Math.random() * 7) - 3;
          if (sl === 0) sl = 2;
          var dx = 1 + Math.floor(Math.random() * 3);
          var x1 = Math.floor(Math.random() * 5) - 2;
          var y1 = Math.floor(Math.random() * 7) - 3;
          p = { x1: x1, y1: y1, x2: x1 + dx, y2: y1 + sl * dx, dx: dx, sl: sl };
        }
        box.innerHTML = '<div class="bTitle">מכונת השיפועים</div>'
          + '<div class="bSub">הישר עובר דרך שתי נקודות. חשב את השיפוע, בחר אותו ובדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="stepper"><div class="unit">'
          + '<button type="button" data-d="-1" aria-label="פחות">−</button>'
          + '<b style="font-size:12.5px">m</b><span class="var math" data-g>0</span>'
          + '<button type="button" data-d="1" aria-label="עוד">+</button></div></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<div class="bOk" data-ok hidden></div>'
          + '<button type="button" class="bDice" data-check>בדוק</button>'
          + '<button type="button" class="bDice" data-roll>🎲 שתי נקודות חדשות</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        var ok = box.querySelector('[data-ok]');
        var gEl = box.querySelector('[data-g]');
        function draw() {
          chip.textContent = 'A(' + p.x1 + ', ' + p.y1 + ')   B(' + p.x2 + ', ' + p.y2 + ')';
          gEl.textContent = num(guess);
          sol.hidden = true;
          ok.hidden = true;
          solved = false;
        }
        function reveal() {
          sol.innerHTML = '<div>' + num(p.y2 - p.y1) + ' \u00F7 ' + p.dx + ' = ' + num(p.sl) + '</div>';
          sol.hidden = false;
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () {
            guess = clamp(guess + Number(b.getAttribute('data-d')), -9, 9);
            ctx.sfx('click');
            gEl.textContent = num(guess);
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          if (guess === p.sl) {
            ctx.sfx('correct');
            ok.textContent = 'נכון. עלייה חלקי צעד ימינה נותנת את השיפוע.';
            ok.hidden = false;
            solved = true;
          } else {
            ctx.sfx('error');
            ok.hidden = true;
          }
          reveal();
        });
        box.querySelector('[data-roll]').addEventListener('click', function () {
          roll();
          guess = 0;
          ctx.sfx('click');
          draw();
        });
        roll();
        draw();
      }
    }
  });
}());
