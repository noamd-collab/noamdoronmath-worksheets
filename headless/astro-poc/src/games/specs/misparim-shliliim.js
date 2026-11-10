/**
 * מספרים שליליים — the number line is an elevator.
 *
 * The idea: adding goes up, subtracting goes down, and a minus in front of a
 * minus turns the direction around.
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

  /** A number with a real minus sign. */
  function fmt(n) { return n < 0 ? '\u2212' + (-n) : String(n); }
  /** A number that sits after an operator: negatives get parentheses. */
  function par(n) { return n < 0 ? '(' + fmt(n) + ')' : String(n); }

  /** An SVG text that never gets reordered by RTL. */
  function T(x, y, str, size, fill, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" font-size="' + size + '"'
      + ' fill="' + fill + '" text-anchor="' + (anchor || 'middle') + '" direction="ltr"'
      + ' font-family="' + FONT + '">' + str + '</text>';
  }
  /** A Hebrew SVG text. */
  function HT(x, y, str, size, fill, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" font-size="' + size + '"'
      + ' fill="' + fill + '" text-anchor="' + (anchor || 'middle') + '"'
      + ' font-family="Heebo, sans-serif" font-weight="700">' + str + '</text>';
  }

  /* ---------- step 1: the elevator ---------- */
  var EY = function (v) { return 150 - 11 * v; };

  function elevatorScene(ctx) {
    var cur = -3, moved = false, busy = false, trail = [];
    var s = '<rect x="170" y="32" width="120" height="236" rx="8" fill="' + SOFT + '" stroke="' + LINE + '" stroke-width="2"/>';
    var v;
    for (v = -10; v <= 10; v++) {
      s += '<line x1="290" y1="' + EY(v) + '" x2="' + (v % 2 === 0 ? 300 : 296) + '" y2="' + EY(v)
        + '" stroke="' + MAIN + '" stroke-width="' + (v === 0 ? 2.5 : 1.2) + '"/>';
      if (v % 2 === 0) s += T(308, EY(v) + 4, fmt(v), 11, v === 0 ? INK : MAIN, 'start');
    }
    s += '<line x1="40" y1="' + EY(0) + '" x2="170" y2="' + EY(0) + '" stroke="' + INK + '" stroke-width="1.6" stroke-dasharray="5 4"/>';
    s += HT(24, EY(0) - 6, 'קרקע', 11, INK, 'start');
    s += '<line id="arL" x1="150" y1="' + EY(-3) + '" x2="150" y2="' + EY(-3) + '" stroke="' + GOOD + '" stroke-width="4" stroke-linecap="round" opacity="0"/>';
    s += '<polygon id="arH" points="150,' + EY(-3) + ' 143,' + (EY(-3) + 9) + ' 157,' + (EY(-3) + 9) + '" fill="' + GOOD + '" opacity="0"/>';
    s += '<g id="cab" transform="translate(0,' + EY(-3) + ')">'
      + '<rect x="196" y="-10" width="68" height="20" rx="5" fill="' + MAIN + '"/>'
      + T(230, 5, fmt(-3), 14, '#fff', 'middle', 'cabT') + '</g>';
    ctx.draw(s);

    function setArrow(from, to) {
      var up = to > from, col = up ? GOOD : WARM;
      var y0 = EY(from), y1 = EY(to);
      var tip = y1, base = up ? y1 + 9 : y1 - 9;
      var L = ctx.el('arL'), Hd = ctx.el('arH');
      L.setAttribute('y1', y0); L.setAttribute('y2', base); L.setAttribute('stroke', col); L.setAttribute('opacity', '1');
      Hd.setAttribute('points', '150,' + tip + ' 143,' + base + ' 157,' + base);
      Hd.setAttribute('fill', col); Hd.setAttribute('opacity', '1');
    }

    var btns = [];
    function setEnabled() {
      btns.forEach(function (o) {
        var t = cur + o.d;
        o.b.disabled = busy || t < -10 || t > 10;
      });
    }
    function go(d, amount) {
      if (busy) return;
      var from = cur, to = cur + d;
      if (to < -10 || to > 10) return;
      busy = true; ctx.busy(true); ctx.sfx('click');
      setEnabled();
      setArrow(from, to);
      ctx.tween(650, function (l) {
        var y = EY(from) + (EY(to) - EY(from)) * window.NoamGame.ez(l);
        ctx.el('cab').setAttribute('transform', 'translate(0,' + y + ')');
      }).then(function () {
        cur = to; busy = false; ctx.busy(false);
        ctx.el('cabT').textContent = fmt(cur);
        moved = true;
        trail.push(m(fmt(from) + (d > 0 ? ' + ' : ' \u2212 ') + amount + ' = ' + fmt(to)));
        ctx.caption(m(fmt(from) + (d > 0 ? ' + ' : ' \u2212 ') + amount + ' = ' + fmt(to)));
        setEnabled();
        if (cur === 2) {
          ctx.sfx('correct'); ctx.burst(16);
          ctx.note('הגעת לקומה ' + m('2') + '. עלית ' + m('5') + ' קומות, ולכן ' + m('\u22123 + 5 = 2') + '.', 'good');
          ctx.say('חיבור מעלה את המעלית. ככה זה עובד גם עם מספרים שליליים.', { mood: 'happy', attn: true });
          ctx.solved();
        } else {
          ctx.sfx(d > 0 ? 'tick' : 'error');
          ctx.note('המעלית בקומה ' + m(fmt(cur)) + '. ' + (cur < 2 ? 'היעד עדיין למעלה.' : 'היעד למטה, כדאי לרדת.'));
        }
      });
    }
    function add(label, d) {
      var b = ctx.button(m(label), function () { go(d, Math.abs(d)); }, { target: 'lift' + (d > 0 ? 'p' + d : 'm' + (-d)) });
      btns.push({ b: b, d: d });
      return b;
    }
    var bp5 = add('+ 5', 5);
    add('+ 2', 2);
    add('\u2212 1', -1);
    add('\u2212 4', -4);
    ctx.button('חזור לקומה ' + m('\u22123'), function () {
      if (busy) return;
      cur = -3; trail = [];
      ctx.el('cab').setAttribute('transform', 'translate(0,' + EY(-3) + ')');
      ctx.el('cabT').textContent = fmt(-3);
      ctx.el('arL').setAttribute('opacity', '0'); ctx.el('arH').setAttribute('opacity', '0');
      ctx.caption(m('\u22123'));
      ctx.note('המעלית בקומה ' + m('\u22123') + '. הגע לקומה ' + m('2') + '.');
      setEnabled();
    }, { ghost: true, target: 'liftreset' });
    ctx.register('lift', bp5);
    ctx.caption(m('\u22123'));
    ctx.note('המעלית בקומה ' + m('\u22123') + '. הגע לקומה ' + m('2') + '.');
    setEnabled();
  }

  /* ---------- step 3: subtraction as distance ---------- */
  var AX0 = 201, AU = 21.375, AY = 190;
  function dx(v) { return AX0 + AU * v; }

  function distanceScene(ctx) {
    var a = -1, b = 3, done = false;
    var s = '<line x1="24" y1="' + AY + '" x2="378" y2="' + AY + '" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>';
    var v;
    for (v = -8; v <= 8; v++) {
      s += '<line x1="' + dx(v) + '" y1="' + (AY - 5) + '" x2="' + dx(v) + '" y2="' + (AY + 5) + '" stroke="' + INK + '" stroke-width="' + (v === 0 ? 2.5 : 1.2) + '"/>';
      if (v % 2 === 0) s += T(dx(v), AY + 28, fmt(v), 11, MAIN, 'middle');
    }
    s += '<path id="arc" d="M ' + dx(a) + ' ' + AY + ' Q ' + ((dx(a) + dx(b)) / 2) + ' 100 ' + dx(b) + ' ' + AY
      + '" fill="none" stroke="' + GOOD + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 0"/>';
    s += T(201, 60, '', 22, GOOD, 'middle', 'dist');
    s += '<g id="pB" style="cursor:ew-resize"><circle id="cB" cx="' + dx(b) + '" cy="' + AY + '" r="13" fill="' + WARM + '" stroke="#fff" stroke-width="2"/>'
      + T(dx(b), AY + 5, fmt(b), 13, '#fff', 'middle', 'tB') + '</g>';
    s += '<g id="pA" style="cursor:ew-resize"><circle id="cA" cx="' + dx(a) + '" cy="' + AY + '" r="13" fill="' + MAIN + '" stroke="#fff" stroke-width="2"/>'
      + T(dx(a), AY + 5, fmt(a), 13, '#fff', 'middle', 'tA') + '</g>';
    ctx.draw(s);

    function render() {
      var xa = dx(a), xb = dx(b), n = Math.abs(a - b);
      var ctrl = AY - (20 + n * 12);
      var col = a >= b ? GOOD : WARM;
      var arc = ctx.el('arc');
      arc.setAttribute('d', 'M ' + xa + ' ' + AY + ' Q ' + ((xa + xb) / 2) + ' ' + ctrl + ' ' + xb + ' ' + AY);
      arc.setAttribute('stroke', col);
      arc.setAttribute('opacity', n === 0 ? '0' : '1');
      ctx.el('cA').setAttribute('cx', xa); ctx.el('tA').setAttribute('x', xa); ctx.el('tA').textContent = fmt(a);
      ctx.el('cB').setAttribute('cx', xb); ctx.el('tB').setAttribute('x', xb); ctx.el('tB').textContent = fmt(b);
      var peak = AY - (AY - ctrl) / 2;
      var d = ctx.el('dist');
      d.setAttribute('x', (xa + xb) / 2); d.setAttribute('y', peak - 8); d.setAttribute('fill', col);
      d.textContent = n === 0 ? '0' : (a > b ? '+' : '\u2212') + n;
      ctx.caption(m(fmt(a) + ' \u2212 ' + par(b) + ' = ' + fmt(a - b)));
      var why = a > b ? 'הכחולה מימין לכתומה, ולכן ההפרש חיובי.'
        : (a < b ? 'הכחולה משמאל לכתומה, ולכן ההפרש שלילי.' : 'שתי הנקודות באותו מקום, ולכן ההפרש הוא אפס.');
      ctx.note('המרחק ביניהן הוא ' + m(String(n)) + '. ' + why, done ? 'good' : null);
    }
    function snap(x) { return Math.max(-8, Math.min(8, Math.round((x - AX0) / AU))); }
    function check() {
      if (done || a !== 2 || b !== -5) return;
      done = true;
      ctx.sfx('correct'); ctx.burst(18);
      ctx.note('מצאת! המרחק מ־' + m('\u22125') + ' עד ' + m('2') + ' הוא ' + m('7') + ', ולכן ' + m('2 \u2212 (\u22125) = 7') + '.', 'good');
      ctx.say('חיסור הוא המרחק בין שני מספרים. ' + 'כשהראשון גדול יותר, התוצאה חיובית.', { mood: 'happy', attn: true });
      ctx.solved();
    }
    ctx.drag(ctx.el('pA'), {
      move: function (x) { var n = snap(x); if (n !== a) { a = n; ctx.sfx('tick'); render(); check(); } },
      end: function () { check(); }
    });
    ctx.drag(ctx.el('pB'), {
      move: function (x) { var n = snap(x); if (n !== b) { b = n; ctx.sfx('tick'); render(); check(); } },
      end: function () { check(); }
    });
    ctx.register('ptA', ctx.el('pA'));
    render();
  }

  /* ---------- step 5: minus of a minus ---------- */
  var TX0 = 201, TU = 18.1, TY = 215;
  function tx(v) { return TX0 + TU * v; }

  function flipScene(ctx) {
    var flipped = false, driven = false, busy = false;
    var x0 = tx(-4), len = 6 * TU;
    var s = '<line x1="24" y1="' + TY + '" x2="378" y2="' + TY + '" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>';
    var v;
    for (v = -10; v <= 10; v++) {
      s += '<line x1="' + tx(v) + '" y1="' + (TY - 5) + '" x2="' + tx(v) + '" y2="' + (TY + 5) + '" stroke="' + INK + '" stroke-width="' + (v === 0 ? 2.5 : 1.2) + '"/>';
      if (v % 2 === 0) s += T(tx(v), TY + 24, fmt(v), 10.5, MAIN, 'middle');
    }
    s += '<g id="flip" transform="translate(' + x0 + ',0) scale(-1,1)">'
      + '<line x1="0" y1="140" x2="' + (len - 10) + '" y2="140" stroke="' + WARM + '" stroke-width="6" stroke-linecap="round"/>'
      + '<polygon points="' + len + ',140 ' + (len - 16) + ',129 ' + (len - 16) + ',151" fill="' + WARM + '"/></g>';
    s += '<line x1="' + x0 + '" y1="146" x2="' + x0 + '" y2="' + (TY - 8) + '" stroke="' + LINE + '" stroke-width="1.5" stroke-dasharray="4 3"/>';
    s += HT(201, 96, 'חיסור הולך שמאלה', 14, WARM, 'middle', 'say1');
    s += '<g id="dot"><circle cx="' + x0 + '" cy="' + TY + '" r="11" fill="' + MAIN + '" stroke="#fff" stroke-width="2"/>'
      + T(x0, TY + 4.5, fmt(-4), 11, '#fff', 'middle', 'dotT') + '</g>';
    ctx.draw(s);

    ctx.caption(m('\u22124 \u2212 (\u22126)'));
    ctx.note('החץ הכתום אומר: מחסרים, ולכן הולכים שמאלה. אבל מחסרים ' + m('\u22126') + '.');

    var go;
    var bFlip = ctx.button('שלב 1: הפוך את הכיוון', function () {
      if (busy || flipped) return;
      busy = true; ctx.busy(true); ctx.sfx('click');
      ctx.tween(800, function (l) {
        var sc = -1 + 2 * window.NoamGame.ez(l);
        ctx.el('flip').setAttribute('transform', 'translate(' + x0 + ',0) scale(' + sc + ',1)');
        if (l > 0.5) {
          ctx.el('flip').firstChild.setAttribute('stroke', GOOD);
          ctx.el('flip').lastChild.setAttribute('fill', GOOD);
        }
      }).then(function () {
        flipped = true; busy = false; ctx.busy(false);
        ctx.el('say1').textContent = 'מינוס על מינוס הולך ימינה';
        ctx.el('say1').setAttribute('fill', GOOD);
        bFlip.disabled = true; go.disabled = false;
        ctx.sfx('correct');
        ctx.caption(m('\u22124 + 6'));
        ctx.note('שני מינוסים הופכים כיוון, ולכן ' + m('\u2212 (\u22126)') + ' הופך ל־' + m('+ 6') + '.');
        ctx.say('מינוס של מינוס הוא פלוס. עכשיו סע ימינה.', { mood: 'happy', attn: true });
      });
    }, { target: 'flipbtn' });
    go = ctx.button('שלב 2: סע', function () {
      if (busy || !flipped || driven) return;
      busy = true; ctx.busy(true); ctx.sfx('click');
      ctx.tween(1100, function (l) {
        var x = x0 + (tx(2) - x0) * window.NoamGame.ez(l);
        var g = ctx.el('dot');
        g.setAttribute('transform', 'translate(' + (x - x0) + ',0)');
      }).then(function () {
        driven = true; busy = false; ctx.busy(false);
        ctx.el('dotT').textContent = fmt(2);
        go.disabled = true;
        ctx.caption(m('\u22124 \u2212 (\u22126) = 2'));
        ctx.note('התחלת ב־' + m('\u22124') + ', נסעת ' + m('6') + ' ימינה והגעת ל־' + m('2') + '.', 'good');
        ctx.sfx('correct'); ctx.burst(18);
        ctx.say('כך מינוס של מינוס הופך כיוון. פלוס ' + m('6') + ' נותן אותה תוצאה.', { mood: 'happy', attn: true });
        ctx.solved();
      });
    }, { target: 'gobtn' });
    go.disabled = true;
    ctx.register('flipbtn', bFlip);
  }

  /** A little picture for the quiz of the elevator: shows a number line. */
  var steps = [
    {
      mode: 'intro',
      tA: 'מספרים שליליים', tM: '\u22123 + 5', tB: ' = ?',
      sub: 'מתחת לאפס יש עוד קומות. בוא נעלה ונרד בהן במעלית.',
      tip: 'שלום, אני אליהו. מספרים שליליים הם סתם קומות מתחת לאדמה, ואני מזמין אותך למעלית.',
      emoji: '🛗',
      eq: m('\u22123 + 5 = 2'),
      note: 'חיבור מעלה, חיסור מוריד, ומינוס של מינוס הופך כיוון. עם שלושת הדברים האלה אתה פותר כל תרגיל.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'המעלית של האפס',
      sub: 'המעלית עומדת בקומה מינוס שלוש. לחץ על הכפתורים והגע לקומה שתיים.',
      tip: 'המעלית עומדת בקומה ' + m('\u22123') + '. תביא אותה לקומה ' + m('2') + '.',
      cue: 'הגע לקומה 2',
      cueDone: 'הגעת. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ציר מספרים אנכי בצורת בניין, מקומה מינוס עשר עד קומה עשר, עם מעלית שנעה בין הקומות',
      nudge: { target: 'lift', text: 'לחץ על כפתור הפלוס כדי לעלות.' },
      setup: elevatorScene
    },
    {
      mode: 'quiz',
      tA: 'כמה זה ', tM: '\u22123 + 5', tB: '?',
      sub: 'המעלית מתחילה בקומה מינוס שלוש ועולה חמש קומות.',
      tip: 'עלה חמש קומות מהקומה ' + m('\u22123') + ' וראה איפה אתה נעצר.',
      btn: 'המשך ←',
      win: 'נכון. חיבור מעלה, גם כשמתחילים מתחת לאפס.',
      wrongSay: 'עלה צעד אחר צעד: קודם עד האפס, ואז הלאה.',
      opts: [
        { t: '2', c: true, f: 'שלוש קומות עד האפס, ועוד שתיים, ביחד חמש. התשובה ' + m('2') + '.' },
        { t: '\u22128', f: 'זה ' + m('\u22123 \u2212 5') + '. כאן עולים, לא יורדים.' },
        { t: '8', f: 'זה ' + m('3 + 5') + '. התחלת מקומה מינוס שלוש ולא משלוש.' },
        { t: '\u22122', f: 'ירדת במקום לעלות, או שספרת עד האפס ושכחת להמשיך.' }
      ],
      hints: [
        'כמה קומות צריך לעלות כדי להגיע מ־' + m('\u22123') + ' לאפס?',
        'שלוש קומות עד האפס, ועוד ' + m('2') + ' שנשארו מתוך החמש.'
      ]
    },
    {
      mode: 'scene',
      tA: 'חיסור הוא מרחק',
      sub: 'גרור את שתי הנקודות על הציר וראה מה קורה לקשת שביניהן.',
      tip: 'חיסור הוא בעצם מרחק. גרור את הכחולה ל־' + m('2') + ' ואת הכתומה ל־' + m('\u22125') + '.',
      cue: 'גרור את הכחולה ל־2 ואת הכתומה ל־\u22125',
      cueDone: 'ראית את ההפרש. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ציר מספרים אופקי עם שתי נקודות נגררות וקשת שמראה את המרחק ביניהן',
      nudge: { target: 'ptA', text: 'גרור את הנקודה הכחולה ימינה או שמאלה.' },
      setup: distanceScene
    },
    {
      mode: 'quiz',
      tA: 'כמה זה ', tM: '2 \u2212 7', tB: '?',
      sub: 'מתחילים בקומה שתיים ויורדים שבע קומות.',
      tip: 'רד שבע קומות מהקומה שתיים. האפס לא עוצר אותך.',
      btn: 'המשך ←',
      win: 'נכון. אפשר לרדת מתחת לאפס, ואז מקבלים מספר שלילי.',
      wrongSay: 'רד קודם שתי קומות עד האפס, ואז המשך מתחת לאפס.',
      opts: [
        { t: '\u22125', c: true, f: 'שתי קומות עד האפס, ועוד חמש מתחתיו. התשובה ' + m('\u22125') + '.' },
        { t: '5', f: 'המרחק נכון, אבל התחלת למעלה וירדת מתחת לאפס, ולכן התוצאה שלילית.' },
        { t: '\u22129', f: 'זה ' + m('\u22122 \u2212 7') + '. אתה התחלת מקומה שתיים, לא ממינוס שתיים.' },
        { t: '9', f: 'זה ' + m('2 + 7') + '. כאן יורדים, לא עולים.' }
      ],
      hints: [
        'כמה קומות יורדים מהקומה ' + m('2') + ' עד האפס?',
        'שתיים עד האפס, ועוד ' + m('5') + ' שנשארו מתחת לאפס.'
      ]
    },
    {
      mode: 'scene',
      tA: 'מינוס של מינוס',
      sub: 'התרגיל הוא מינוס ארבע פחות מינוס שש. קודם הופכים את החץ, ואז נוסעים.',
      tip: 'מה קורה כשמחסרים מספר שלילי? קודם הפוך את החץ, ואז סע.',
      cue: 'הפעל את שני השלבים',
      cueDone: 'ראית איך הכיוון התהפך. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ציר מספרים אופקי עם חץ שמתהפך משמאל לימין, ונקודה שנוסעת ממינוס ארבע לשתיים',
      nudge: { target: 'flipbtn', text: 'לחץ על שלב 1 כדי להפוך את החץ.' },
      setup: flipScene
    },
    {
      mode: 'quiz',
      tA: 'כמה זה ', tM: '\u22124 \u2212 (\u22126)', tB: '?',
      sub: 'מחסרים מספר שלילי, ולכן הכיוון מתהפך.',
      tip: 'זכור: מינוס על מינוס הופך לפלוס. התחל ב־' + m('\u22124') + ' וסע ימינה.',
      btn: 'המשך ←',
      win: 'בדיוק. שני מינוסים הופכים כיוון ונותנים פלוס.',
      wrongSay: 'החיסור של מספר שלילי נוסע ימינה. נסה שוב.',
      opts: [
        { t: '2', c: true, f: m('\u22124 \u2212 (\u22126) = \u22124 + 6') + ', וזה ' + m('2') + '.' },
        { t: '\u221210', f: 'זה ' + m('\u22124 \u2212 6') + '. שכחת שהמספר שמחסרים הוא שלילי.' },
        { t: '10', f: 'זה ' + m('4 + 6') + '. התעלמת מהסימן של ' + m('\u22124') + '.' },
        { t: '\u22122', f: 'ההפרש נכון, אבל הכיוון לא. אחרי ההיפוך נוסעים ימינה והתוצאה חיובית.' }
      ],
      hints: [
        'שני מינוסים ברצף הופכים לפלוס. מה התרגיל החדש?',
        'עכשיו חשב ' + m('\u22124 + 6') + ': שש קומות למעלה מהקומה ' + m('\u22124') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'מי גדול יותר?',
      sub: m('\u22122') + ' או ' + m('\u22127') + '. בציר המספרים, המספר הגדול יותר נמצא יותר למעלה ויותר ימינה.',
      tip: 'דמיין את המעלית. איזו קומה גבוהה יותר, מינוס שתיים או מינוס שבע?',
      btn: 'לסיכום ←',
      win: 'נכון. ככל שהמספר השלילי קרוב יותר לאפס, הוא גדול יותר.',
      wrongSay: 'דמיין את שתי הקומות. איזו מהן קרובה יותר לקרקע?',
      opts: [
        { t: '\u22122', c: true, f: m('\u22122') + ' קרוב יותר לקרקע, ולכן הוא למעלה ולכן הוא גדול יותר.' },
        { t: '\u22127', f: 'הספרה גדולה יותר, אבל עם מינוס זה מעמיק את הירידה מתחת לאפס, ולכן המספר קטן יותר.' },
        { t: 'שווים', f: 'הם נמצאים בשתי קומות שונות, ולכן הם לא שווים.' },
        { t: 'אי אפשר לדעת', f: 'אפשר. מספיק להסתכל על ציר המספרים ולראות מי למעלה.' }
      ],
      hints: [
        'באיזו קומה אתה גבוה יותר: ' + m('\u22122') + ' או ' + m('\u22127') + '?',
        'מי מהשניים קרוב יותר לאפס?'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את המעלית',
      sub: 'חיבור מעלה, חיסור מוריד, ומינוס על מינוס הופך כיוון.',
      tip: 'כל הכבוד. עכשיו אתה יודע לנסוע במעלית גם מתחת לאפס.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית:',
      formula: m('a \u2212 (\u2212b) = a + b')
    }
  ];

  window.NoamGame.boot({
    slug: 'misparim-shliliim',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'חיבור עם שלילי', math: '\u22123 + 5' },
      { step: 4, name: 'חיסור מתחת לאפס', math: '2 \u2212 7' },
      { step: 6, name: 'מינוס של מינוס', math: '\u22124 \u2212 (\u22126)' },
      { step: 7, name: 'השוואת שליליים', math: '\u22122 , \u22127' }
    ],
    bonus: {
      label: 'מכונת המעלית 🛗',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל תרגיל חדש, נסה לפתור בראש, ואז בדוק.',
      setup: function (box, ctx) {
        var a = -3, b = 5, kind = 0, open = false;
        box.innerHTML = '<div class="bTitle">מכונת המעלית</div>'
          + '<div class="bSub">קבל תרגיל, פתור בראש ואז גלה את התשובה.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<div class="bSub" data-why hidden></div>'
          + '<button type="button" class="bDice" data-roll>🎲 תרגיל חדש</button>'
          + '<button type="button" class="bDice" data-show>גלה את התשובה</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        var why = box.querySelector('[data-why]');
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function expr() {
          if (kind === 0) return fmt(a) + ' + ' + b;
          if (kind === 1) return fmt(a) + ' \u2212 ' + b;
          return fmt(a) + ' \u2212 (' + fmt(-b) + ')';
        }
        function draw() {
          chip.textContent = expr() + ' = ?';
          sol.textContent = expr() + ' = ' + fmt(kind === 1 ? a - b : a + b);
          if (kind === 0) why.innerHTML = 'חיבור מעלה ' + m(String(b)) + ' קומות.';
          else if (kind === 1) why.innerHTML = 'חיסור מוריד ' + m(String(b)) + ' קומות.';
          else why.innerHTML = 'מינוס על מינוס הופך כיוון, ולכן מעלים ' + m(String(b)) + ' קומות.';
          sol.hidden = !open; why.hidden = !open;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          kind = rnd(0, 2);
          a = rnd(-8, 8);
          b = rnd(1, 9);
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
