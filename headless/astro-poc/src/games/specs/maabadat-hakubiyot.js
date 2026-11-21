/**
 * משחק ההסתברות והקובייה — an engine game.
 *
 * The idea: the sample space lists every outcome; a probability is the number
 * of favourable outcomes out of all outcomes, always between 0 and 1. The
 * relative frequency is what really happened, and it settles near the
 * probability as the number of trials grows; it never has to hit it exactly.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var MUTED = '#475569', ORANGE = '#b45309', BAD = '#b91c1c', ODD = '#d97706';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }

  /* ---------- number display ---------- */
  function decText(n, d) {
    var v = n / d;
    var exact = Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
    return (exact ? '= ' : '\u2248 ') + String(Math.round(v * 100) / 100);
  }
  function pctText(n, d) {
    var v = n * 100 / d;
    var exact = Math.abs(v - Math.round(v)) < 1e-9;
    return (exact ? '= ' : '\u2248 ') + Math.round(v) + '%';
  }
  function decPlain(v) { return String(Math.round(v * 100) / 100); }

  /** A fraction bar drawn in SVG: numerator, a line, denominator. */
  function svgFrac(cx, cy, n, d, size, colour) {
    var a = String(n), b = String(d);
    var half = Math.max(a.length, b.length) * size * 0.34 + 10;
    var attrs = ' text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size + '" fill="' + colour + '"';
    return '<text x="' + cx + '" y="' + (cy - 7) + '"' + attrs + '>' + a + '</text>'
      + '<line x1="' + (cx - half) + '" y1="' + cy + '" x2="' + (cx + half) + '" y2="' + cy + '" stroke="' + colour + '" stroke-width="3" stroke-linecap="round"/>'
      + '<text x="' + cx + '" y="' + (cy + size + 2) + '"' + attrs + '>' + b + '</text>';
  }
  /** The same fraction bar as stacked HTML, for the controls area. */
  function fracHtml(n, d) {
    return '<span dir="ltr" style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1.15;font-family:Secular One,sans-serif">'
      + '<span style="padding:0 6px;border-bottom:2px solid currentColor;font-size:inherit">' + n + '</span>'
      + '<span style="padding:0 6px;font-size:inherit">' + d + '</span></span>';
  }

  /* ---------- die faces ---------- */
  var PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };
  var CW = 58, CH = 64;
  /** mode: plain, lit or dim. Returns the drawing of one face card. */
  function faceCard(v, x, y, mode) {
    var fill = mode === 'lit' ? PAL.warmSoft : (mode === 'dim' ? '#f1f5f9' : '#fff');
    var stroke = mode === 'lit' ? ORANGE : (mode === 'dim' ? PAL.line : PAL.main);
    var sw = mode === 'lit' ? 4 : 2;
    var pip = mode === 'dim' ? '#94a3b8' : PAL.ink;
    var out = '<rect x="' + x + '" y="' + y + '" width="' + CW + '" height="' + CH + '" rx="11" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    PIPS[v].forEach(function (k) {
      var r = Math.floor(k / 3), c = k % 3;
      out += '<circle cx="' + (x + CW * (0.25 + 0.25 * c)) + '" cy="' + (y + CH * (0.25 + 0.25 * r)) + '" r="5.5" fill="' + pip + '"/>';
    });
    return out;
  }
  function cardX(i) { return 7 + 66 * i; }
  function numeral(x, y, label) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="15" fill="' + MUTED + '">' + label + '</text>';
  }
  function facesPicture(faces) {
    return function (ctx) {
      var out = '';
      for (var v = 1; v <= 6; v++) {
        out += faceCard(v, cardX(v - 1), 14, faces.indexOf(v) >= 0 ? 'lit' : 'dim') + numeral(cardX(v - 1) + CW / 2, 98, String(v));
      }
      ctx.draw(out);
    };
  }

  /* ---------- scene 1: the sample space and the event ---------- */
  var EVENTS = [
    { k: 'even', btn: 'זוגי', label: 'זוגי', faces: [2, 4, 6] },
    { k: 'gt4', btn: 'גדול מ־4', label: 'גדול מ־' + m('4'), faces: [5, 6] },
    { k: 'eq7', btn: 'שווה ל־7', label: 'שווה ל־' + m('7'), faces: [] },
    { k: 'lt7', btn: 'קטן מ־7', label: 'קטן מ־' + m('7'), faces: [1, 2, 3, 4, 5, 6] }
  ];

  function spaceScene(ctx) {
    var ev = null, done = false, info;
    var btns = [];
    ctx.extra('<div class="sceneStrip" style="grid-template-columns:1fr 1fr"><div><b>תוצאות מתאימות</b><span class="math" data-v="good">?</span></div>'
      + '<div><b>כל התוצאות האפשריות</b><span class="math" data-v="all">6</span></div></div>');
    info = ctx.el('sceneExtra');
    ctx.register('events', info);
    function noteFor(e) {
      if (e.k === 'even') return 'שלוש פאות זוגיות: ' + m('2') + ', ' + m('4') + ', ' + m('6') + ', מתוך שש. ההסתברות היא ' + m('0.5') + ', כלומר ' + m('50%') + '.';
      if (e.k === 'gt4') return 'רק ' + m('5') + ' ו־' + m('6') + ' גדולות מ־' + m('4') + ': שתיים מתוך שש, בערך ' + m('0.33') + '. ' + m('4') + ' עצמה לא נספרת. עכשיו בחר "זוגי".';
      if (e.k === 'eq7') return 'אין פאה ' + m('7') + ' בקובייה: אפס מתוך שש. מאורע בלתי אפשרי, וההסתברות שלו היא ' + m('0') + '.';
      return 'כל שש הפאות קטנות מ־' + m('7') + ': שש מתוך שש. מאורע ודאי, וההסתברות שלו היא ' + m('1') + '. עכשיו בחר "זוגי".';
    }
    function faceLabel(v) {
      if (!ev) return 'פאה ' + v;
      return 'פאה ' + v + (ev.faces.indexOf(v) >= 0 ? ', שייכת למאורע ' : ', לא שייכת למאורע ') + ev.btn;
    }
    function render() {
      var out = '<defs><style>.face:focus-visible rect{stroke:' + PAL.dark + ';stroke-width:5}</style></defs>';
      for (var v = 1; v <= 6; v++) {
        var mode = !ev ? 'plain' : (ev.faces.indexOf(v) >= 0 ? 'lit' : 'dim');
        out += '<g class="face" data-face="' + v + '" tabindex="0" role="button" style="cursor:pointer" aria-label="' + faceLabel(v) + '">'
          + faceCard(v, cardX(v - 1), 14, mode) + '</g>' + numeral(cardX(v - 1) + CW / 2, 98, String(v));
      }
      var k = ev ? ev.faces.length : null;
      if (ev) {
        out += svgFrac(82, 168, k, 6, 36, PAL.ink)
          + '<text x="150" y="176" direction="ltr" font-family="Secular One, sans-serif" font-size="30" fill="' + PAL.dark + '">' + decText(k, 6) + '</text>'
          + '<text x="270" y="176" direction="ltr" font-family="Secular One, sans-serif" font-size="30" fill="' + PAL.dark + '">' + pctText(k, 6) + '</text>';
      } else {
        out += '<text x="201" y="176" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="40" fill="' + MUTED + '">?</text>';
      }
      ctx.draw(out);
      info.querySelector('[data-v="good"]').textContent = ev ? String(k) : '?';
      ctx.caption(ev ? 'המאורע: ' + ev.label : 'בחר מאורע בכפתורים');
      btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(ev === EVENTS[i])); });
      var cards = [].slice.call(ctx.svg.querySelectorAll('.face'));
      cards.forEach(function (c, idx) {
        c.addEventListener('keydown', function (e) {
          var to = -1;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = Math.max(0, idx - 1);
          else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = Math.min(5, idx + 1);
          else if (e.key === 'Home') to = 0;
          else if (e.key === 'End') to = 5;
          else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ctx.note(ev ? 'פאה ' + m(String(idx + 1)) + (ev.faces.indexOf(idx + 1) >= 0 ? ' שייכת' : ' לא שייכת') + ' למאורע. ' + 'במאורע יש ' + m(String(ev.faces.length)) + ' פאות מתאימות מתוך ' + m('6') + '.' : 'בחר קודם מאורע בכפתורים, ואז בדוק אילו פאות שייכות אליו.');
            return;
          } else return;
          e.preventDefault();
          cards[to].focus();
        });
      });
    }
    EVENTS.forEach(function (e, i) {
      btns.push(ctx.button(e.btn, function () {
        ev = e;
        ctx.sfx('click');
        render();
        ctx.note(noteFor(e), e.k === 'even' ? 'good' : '');
        if (e.k === 'even' && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      }, { id: 'ev-' + e.k, ghost: true, target: i === 0 ? 'ev-even' : undefined }));
    });
    render();
    ctx.note('כל פאה היא תוצאה אפשרית אחת, ויש שש. בחר מאורע ותראה אילו פאות מתאימות לו.');
  }

  /* ---------- scene 2: throwing many times ---------- */
  function rollSvg(counts, hist, n, last) {
    var xmax = Math.max(200, n);
    var maxC = Math.max(5, Math.max.apply(null, counts));
    var out = '';
    var i;
    var tx = 'direction="ltr" font-family="Secular One, sans-serif"';
    out += '<line x1="30" y1="150" x2="378" y2="150" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (i = 0; i < 6; i++) {
      var x = 36 + 58 * i, h = counts[i] / maxC * 100;
      var even = (i + 1) % 2 === 0;
      out += '<rect x="' + x + '" y="' + (150 - h) + '" width="40" height="' + h + '" rx="4" fill="' + (even ? PAL.main : ODD) + '"'
        + (last === i + 1 ? ' stroke="' + PAL.ink + '" stroke-width="3"' : '') + '/>'
        + '<text x="' + (x + 20) + '" y="' + (150 - h - 6) + '" text-anchor="middle" ' + tx + ' font-size="14" fill="' + PAL.ink + '">' + counts[i] + '</text>'
        + '<text x="' + (x + 20) + '" y="172" text-anchor="middle" ' + tx + ' font-size="15" fill="' + MUTED + '">' + (i + 1) + '</text>';
    }
    out += '<rect x="352" y="186" width="13" height="13" rx="3" fill="' + PAL.main + '"/>'
      + '<text x="324" y="197" text-anchor="middle" font-family="Heebo, sans-serif" font-size="12.5" fill="' + PAL.ink + '">זוגיות</text>'
      + '<rect x="262" y="186" width="13" height="13" rx="3" fill="' + ODD + '"/>'
      + '<text x="226" y="197" text-anchor="middle" font-family="Heebo, sans-serif" font-size="12.5" fill="' + PAL.ink + '">אי־זוגיות</text>';
    function px(v) { return 50 + 340 * v / xmax; }
    function py(f) { return 304 - 90 * f; }
    out += '<rect x="50" y="214" width="340" height="90" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>'
      + '<line x1="50" y1="' + py(0.5) + '" x2="390" y2="' + py(0.5) + '" stroke="' + ORANGE + '" stroke-width="2" stroke-dasharray="6 5"/>'
      + '<text x="44" y="219" text-anchor="end" ' + tx + ' font-size="12" fill="' + MUTED + '">1</text>'
      + '<text x="44" y="' + (py(0.5) + 4) + '" text-anchor="end" ' + tx + ' font-size="12" fill="' + ORANGE + '">0.5</text>'
      + '<text x="44" y="308" text-anchor="end" ' + tx + ' font-size="12" fill="' + MUTED + '">0</text>'
      + '<text x="50" y="321" text-anchor="middle" ' + tx + ' font-size="12" fill="' + MUTED + '">0</text>'
      + '<text x="390" y="321" text-anchor="end" ' + tx + ' font-size="12" fill="' + MUTED + '">' + xmax + '</text>'
      + '<text x="335" y="' + (py(0.5) - 6) + '" text-anchor="middle" font-family="Heebo, sans-serif" font-size="11.5" font-weight="700" fill="' + ORANGE + '">ההסתברות</text>'
      + '<text x="201" y="337" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="12" fill="' + MUTED + '">כל נקודה: השכיחות היחסית של זוגי עד אותו רגע</text>';
    if (hist.length) {
      out += '<polyline points="' + hist.map(function (p) { return px(p.n).toFixed(1) + ',' + py(p.f).toFixed(1); }).join(' ') + '" fill="none" stroke="' + PAL.main + '" stroke-width="2.5" stroke-linejoin="round"/>';
      if (hist.length <= 40) {
        hist.forEach(function (p) { out += '<circle cx="' + px(p.n).toFixed(1) + '" cy="' + py(p.f).toFixed(1) + '" r="3.5" fill="' + PAL.main + '"/>'; });
      }
      var q = hist[hist.length - 1];
      out += '<circle cx="' + px(q.n).toFixed(1) + '" cy="' + py(q.f).toFixed(1) + '" r="5.5" fill="' + PAL.main + '" stroke="#fff" stroke-width="2"/>';
    }
    return out;
  }

  function rollScene(ctx) {
    var counts = [0, 0, 0, 0, 0, 0], n = 0, evens = 0, hist = [], last = 0, done = false;
    var strip = ctx.extra('<div class="sceneStrip" style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 18px">'
      + '<div><b>הטלות</b><span class="math" data-v="n">0</span></div>'
      + '<div><b>זוגיות</b><span class="math" data-v="k">0</span></div>'
      + '<div><b>שכיחות יחסית של זוגי</b><span data-v="f" dir="ltr" style="display:inline-flex;align-items:center;gap:10px;font-size:19px">?</span></div></div>');
    ctx.register('strip', strip);
    ctx.caption('המטרה: ' + m('200') + ' הטלות · ההסתברות לזוגי: ' + m('0.5'));
    function setV(k, html) { strip.querySelector('[data-v="' + k + '"]').innerHTML = html; }
    function render() {
      ctx.draw(rollSvg(counts, hist, n, last));
      setV('n', String(n));
      setV('k', String(evens));
      if (n === 0) setV('f', '?');
      else setV('f', fracHtml(evens, n) + '<span>' + decText(evens, n) + '</span><span>' + pctText(evens, n) + '</span>');
    }
    function describe() {
      if (n === 0) { ctx.note('הקו המקווקו הוא ההסתברות ' + m('0.5') + '. הטל, ובדוק איפה השכיחות היחסית נוחתת.'); return; }
      var f = evens / n;
      var diff = Math.abs(f - 0.5);
      if (n < 200) {
        if (n <= 10) ctx.note('אחרי ' + m(String(n)) + ' הטלות השכיחות היחסית היא ' + m(decPlain(f)) + '. עשר הטלות או פחות יכולות להיראות רחוקות מ־' + m('0.5') + ', וזה נורמלי.');
        else ctx.note('השכיחות היחסית כרגע ' + m(decPlain(f)) + '. עוד ' + m(String(200 - n)) + ' הטלות עד ' + m('200') + '. תראה איך הקו נרגע לאט סביב הקו המקווקו.');
      } else {
        ctx.note('אחרי ' + m(String(n)) + ' הטלות השכיחות היחסית היא ' + m(String(Math.round(f * 1000) / 1000)) + ', במרחק ' + m(String(Math.round(diff * 1000) / 1000)) + ' מ־' + m('0.5')
          + '. היא קרובה אבל לא חייבת להיות שווה בדיוק. הטל שוב והיא תזוז עוד קצת.', 'good');
      }
    }
    function throwMany(c, every) {
      for (var i = 0; i < c; i++) {
        var f = 1 + Math.floor(Math.random() * 6);
        counts[f - 1] += 1; n += 1; last = f;
        if (f % 2 === 0) evens += 1;
        if (every && n % every === 0) hist.push({ n: n, f: evens / n });
      }
      if (!hist.length || hist[hist.length - 1].n !== n) hist.push({ n: n, f: evens / n });
      ctx.sfx('click');
      render();
      describe();
      if (n >= 200 && !done) { done = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
    }
    ctx.button('הטל פעם אחת', function () { throwMany(1, 0); }, { id: 't1', target: 't1' });
    ctx.button('הטל 10 פעמים', function () { throwMany(10, 0); }, { id: 't10', target: 't10' });
    ctx.button('הטל 100 פעמים', function () { throwMany(100, 10); }, { id: 't100', target: 't100' });
    ctx.button('התחל מחדש', function () {
      counts = [0, 0, 0, 0, 0, 0]; n = 0; evens = 0; hist = []; last = 0;
      ctx.sfx('click'); render(); describe();
    }, { id: 'tReset', ghost: true });
    render();
    describe();
  }

  /* ---------- scene 3: certain, possible, impossible ---------- */
  var LANE = [44, 106, 168];
  var MKCOL = [PAL.main, PAL.good, ORANGE];
  var LETTER = ['א', 'ב', 'ג'];
  var CARDS = [
    { text: 'התוצאה קטנה מ־' + m('7'), plain: 'התוצאה קטנה מ־7', goal: 10, start: 4 },
    { text: 'התוצאה שווה ל־' + m('7'), plain: 'התוצאה שווה ל־7', goal: 0, start: 6 },
    { text: 'התוצאה זוגית', plain: 'התוצאה זוגית', goal: 5, start: 3 }
  ];
  function mx(t) { return 80 + 24 * t; }
  function tenthText(t) { return String(t / 10); }

  function lineScene(ctx) {
    var t = CARDS.map(function (c) { return c.start; });
    var lastMoved = -1, done = false;
    var out = '<defs><style>.mk:focus-visible circle{stroke:' + PAL.ink + ';stroke-width:5}</style></defs>'
      + '<rect x="' + mx(-2) + '" y="16" width="' + (mx(0) - mx(-2)) + '" height="184" fill="#fde8ec" opacity=".8"/>'
      + '<rect x="' + mx(10) + '" y="16" width="' + (mx(12) - mx(10)) + '" height="184" fill="#fde8ec" opacity=".8"/>';
    [0, 5, 10].forEach(function (g) {
      out += '<line x1="' + mx(g) + '" y1="16" x2="' + mx(g) + '" y2="200" stroke="' + PAL.line + '" stroke-width="1.5" stroke-dasharray="5 4"/>'
        + '<text x="' + mx(g) + '" y="222" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="15" fill="' + PAL.ink + '">' + (g === 0 ? '0' : g === 5 ? '0.5' : '1') + '</text>';
    });
    LANE.forEach(function (y) {
      out += '<line x1="' + mx(-2) + '" y1="' + y + '" x2="' + mx(12) + '" y2="' + y + '" stroke="' + PAL.line + '" stroke-width="2"/>'
        + '<line x1="' + mx(0) + '" y1="' + y + '" x2="' + mx(10) + '" y2="' + y + '" stroke="' + PAL.ink + '" stroke-width="3.5"/>';
    });
    out += '<g id="markers">';
    CARDS.forEach(function (c, i) {
      out += '<g class="mk" data-i="' + i + '" id="mk' + i + '" tabindex="0" role="slider" style="cursor:grab" aria-valuemin="-0.2" aria-valuemax="1.2" aria-valuenow="0"'
        + ' aria-label="סמן ' + LETTER[i] + ': ' + c.plain + '. החצים מזיזים אותו לאורך הקו">'
        + '<rect x="-30" y="-30" width="60" height="60" rx="12" fill="transparent"/>'
        + '<circle r="17" fill="' + MKCOL[i] + '" stroke="#fff" stroke-width="3"/>'
        + '<text y="6" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="18" font-weight="800" fill="#fff" pointer-events="none">' + LETTER[i] + '</text></g>';
    });
    out += '</g>';
    ctx.draw(out);
    var mk = CARDS.map(function (c, i) { return ctx.el('mk' + i); });
    var rowsHtml = '<div style="display:flex;flex-direction:column;gap:8px">';
    CARDS.forEach(function (c, i) {
      rowsHtml += '<div data-row="' + i + '" class="sceneStrip" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:8px 10px;text-align:start">'
        + '<span style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:' + MKCOL[i] + ';color:#fff;font-family:Heebo,sans-serif;font-weight:800">' + LETTER[i] + '</span>'
        + '<span style="font-family:Heebo,sans-serif;font-size:14.5px;font-weight:700;flex:1;min-width:130px">' + c.text.replace(/\u2066([^\u2069]*)\u2069/g, function (a, b) { return bdi(b); }) + '</span>'
        + '<bdi class="math" dir="ltr" data-val style="font-family:Secular One,sans-serif;font-size:16px;min-width:34px;text-align:center"></bdi>'
        + '<span style="display:flex;gap:6px" dir="ltr">'
        + [['0', '0', 'על אפס'], ['חצי', '5', 'על חצי'], ['1', '10', 'על אחת']].map(function (b) {
          return '<button type="button" data-set="' + i + ',' + b[1] + '" aria-label="סמן ' + LETTER[i] + ' ' + b[2] + '" style="min-height:44px;min-width:44px;padding:0 12px;border:2px solid ' + MKCOL[i]
            + ';border-radius:12px;background:#fff;color:' + MKCOL[i] + ';font-family:Secular One,Heebo,sans-serif;font-size:15px;cursor:pointer">' + b[0] + '</button>';
        }).join('') + '</span></div>';
    });
    rowsHtml += '</div>';
    var box = ctx.extra(rowsHtml);
    ctx.register('cards', box);
    function allRight() { return t.every(function (v, i) { return v === CARDS[i].goal; }); }
    function noteFor(j) {
      if (t[j] < 0 || t[j] > 10) return 'הסתברות אף פעם אינה קטנה מ־' + m('0') + ' ואף פעם אינה גדולה מ־' + m('1') + '. החזר את סמן ' + LETTER[j] + ' אל הקו.';
      if (j === 0) return t[j] === 10 ? 'סמן א במקום: כל שש הפאות קטנות מ־' + m('7') + ', מאורע ודאי, ' + m('1') + '.'
        : 'כל שש הפאות קטנות מ־' + m('7') + ': שש מתוך שש. מאורע ודאי הוא בדיוק ' + m('1') + '.';
      if (j === 1) return t[j] === 0 ? 'סמן ב במקום: אין פאה ' + m('7') + ', אפס מתוך שש, מאורע בלתי אפשרי, ' + m('0') + '.'
        : 'אין על הקובייה פאה ' + m('7') + ': אפס מתוך שש. מאורע בלתי אפשרי הוא בדיוק ' + m('0') + '.';
      return t[j] === 5 ? 'סמן ג במקום: שלוש פאות זוגיות מתוך שש הן חצי, ' + m('0.5') + '.'
        : 'שלוש פאות זוגיות (' + m('2') + ', ' + m('4') + ', ' + m('6') + ') מתוך שש: זה חצי, ' + m('0.5') + '.';
    }
    function render(acted) {
      mk.forEach(function (g, i) {
        g.setAttribute('transform', 'translate(' + mx(t[i]) + ' ' + LANE[i] + ')');
        g.setAttribute('aria-valuenow', tenthText(t[i]));
        g.setAttribute('aria-valuetext', tenthText(t[i]));
        var rowVal = box.querySelector('[data-row="' + i + '"] [data-val]');
        rowVal.textContent = tenthText(t[i]);
        rowVal.style.color = (t[i] < 0 || t[i] > 10) ? BAD : PAL.ink;
      });
      ctx.caption('הערכים כרגע: ' + m(tenthText(t[0])) + ', ' + m(tenthText(t[1])) + ', ' + m(tenthText(t[2])));
      if (allRight()) {
        ctx.note('שלושתם במקום: ודאי הוא ' + m('1') + ', בלתי אפשרי הוא ' + m('0') + ', וחצי מהפאות הוא ' + m('0.5') + '.', 'good');
        if (acted && !done) { done = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
      } else if (lastMoved >= 0) ctx.note(noteFor(lastMoved));
      else ctx.note('הצב כל סמן במקומו על הקו: בכפתורים, בחיצים או בגרירה. כל מה שמחוץ לקו אדום הוא לא הסתברות.');
    }
    function setTenths(i, v, acted) {
      t[i] = clamp(v, -2, 12);
      lastMoved = i;
      ctx.sfx('tick');
      render(acted);
    }
    box.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-set').split(',');
        setTenths(Number(p[0]), Number(p[1]), true);
      });
    });
    mk.forEach(function (g, i) {
      g.addEventListener('keydown', function (e) {
        var v = t[i];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= 1;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += 1;
        else if (e.key === 'Home') v = 0;
        else if (e.key === 'End') v = 10;
        else return;
        e.preventDefault();
        setTenths(i, v, true);
      });
    });
    var which = 0;
    ctx.drag(ctx.el('markers'), {
      start: function (x, y) {
        var best = 0;
        LANE.forEach(function (ly, i) { if (Math.abs(y - ly) < Math.abs(y - LANE[best])) best = i; });
        which = best;
      },
      move: function (x) {
        var v = clamp(Math.round((x - 80) / 24), -2, 12);
        if (v !== t[which]) { t[which] = v; lastMoved = which; ctx.sfx('tick'); render(false); }
      },
      end: function () { render(true); }
    });
    render(false);
  }

  /* ---------- quiz pictures ---------- */
  function twentyPicture(ctx) {
    var base = 160;
    var tx = 'direction="ltr" font-family="Secular One, sans-serif"';
    var out = '<line x1="60" y1="' + base + '" x2="360" y2="' + base + '" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<rect x="110" y="' + (base - 96) + '" width="70" height="96" rx="4" fill="' + PAL.main + '"/>'
      + '<rect x="220" y="' + (base - 64) + '" width="70" height="64" rx="4" fill="' + ORANGE + '"/>'
      + '<text x="145" y="' + (base - 96 + 28) + '" text-anchor="middle" ' + tx + ' font-size="20" fill="#fff">12</text>'
      + '<text x="255" y="' + (base - 64 + 28) + '" text-anchor="middle" ' + tx + ' font-size="20" fill="#fff">8</text>'
      + '<line x1="60" y1="' + (base - 80) + '" x2="360" y2="' + (base - 80) + '" stroke="' + ORANGE + '" stroke-width="2" stroke-dasharray="6 5"/>'
      + '<text x="54" y="' + (base - 76) + '" text-anchor="end" ' + tx + ' font-size="13" fill="' + ORANGE + '">10</text>'
      + '<text x="145" y="184" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="14" fill="' + PAL.ink + '">זוגיות</text>'
      + '<text x="255" y="184" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="14" fill="' + PAL.ink + '">אי־זוגיות</text>';
    ctx.draw(out);
  }

  var steps = [
    {
      mode: 'intro', tA: 'משחק ההסתברות והקובייה', sub: 'מה יכול לקרות, ומה באמת קורה כשמטילים.',
      tip: 'שלום, אני אליהו. נבנה את כל התוצאות של קובייה, נטיל אותה הרבה פעמים ונראה מה מתייצב.',
      emoji: '🎲', eq: 'הסתברות בין ' + m('0') + ' ל־' + m('1'),
      note: 'ההסתברות היא כמה תוצאות מתאימות יש מתוך כל התוצאות. השכיחות היחסית היא מה שקרה בפועל בניסוי.',
      cue: 'מוכן להטיל?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מרחב התוצאות', sub: 'שש הפאות הן כל התוצאות האפשריות. בחר מאורע בכפתורים או במקלדת ובדוק אילו פאות שייכות אליו.',
      tip: 'כל פאה היא תוצאה אפשרית. בחר מאורע ותראה אילו פאות נדלקות, וכמה הן מתוך שש.',
      aspect: [402, 232],
      alt: 'שש פאות של קובייה, ' + 'מאחת עד שש. הפאות שמתאימות למאורע שנבחר מוארות, ומתחתן שבר ההסתברות, הערך העשרוני והאחוז',
      cue: 'בחר את המאורע "זוגי" וקרא את ההסתברות', cueDone: 'קראת נכון: חצי. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'ev-even', text: 'לחץ על "זוגי" וראה אילו פאות נדלקות.' }, setup: spaceScene
    },
    {
      mode: 'quiz', tA: 'מהי ההסתברות לקבל תוצאה גדולה מ־', tM: '4', tB: '?',
      sub: 'מטילים קובייה הוגנת. הפאות שמתאימות מוארות בציור.',
      tip: 'ספור כמה פאות מתאימות, ואז כמה פאות יש בסך הכול.', btn: 'המשך ←',
      aspect: [402, 110], alt: 'שש פאות של קובייה. הפאות חמש ושש מוארות, והשאר עמומות', setup: facesPicture([5, 6]),
      win: 'בדיוק. שתיים מתוך שש.', wrongSay: 'בדוק אילו פאות באמת גדולות מ־4, ומתוך כמה.',
      opts: [
        { t: 'שתיים מתוך שש', c: true, f: 'רק ' + m('5') + ' ו־' + m('6') + ' גדולות מ־' + m('4') + ', לכן שתיים מתוך שש.' },
        { t: 'אחת מתוך שש', f: 'ספרת רק את ' + m('6') + ', אבל גם ' + m('5') + ' גדולה מ־' + m('4') + '.' },
        { t: 'ארבע מתוך שש', f: 'ספרת יותר מדי: גדול מ־' + m('4') + ' לא כולל את ' + m('4') + ' עצמה, ורק שתי פאות מתאימות.' },
        { t: 'שלוש מתוך שש', f: 'שלוש פאות הן זוגיות: ' + m('2') + ', ' + m('4') + ', ' + m('6') + '. כאן שואלים על "גדול מ־' + m('4') + '", וזה מאורע אחר.' }
      ],
      hints: ['כתוב את כל התוצאות של הקובייה, ובדוק איזו מהן גדולה מ־4.', 'האם ' + m('4') + ' עצמה גדולה מ־' + m('4') + '?', 'רק ' + m('5') + ' ו־' + m('6') + ' מתאימות, מתוך שש פאות.']
    },
    {
      mode: 'scene', tA: 'מטילים הרבה פעמים', sub: 'הטל ושים לב: הקו הכחול מראה את השכיחות היחסית של זוגי, והקו המקווקו הוא ההסתברות.',
      tip: 'הטל קובייה ועקוב אחרי הקו. כמה הטלות צריך כדי שהוא יתיישב?',
      aspect: [402, 342],
      alt: 'שישה עמודים שמראים כמה פעמים יצאה כל פאה, ומתחתם גרף של השכיחות היחסית של תוצאה זוגית אחרי כל סבב הטלות, עם קו מקווקו בחצי',
      cue: 'הגע לפחות ל־200 הטלות', cueDone: 'עברת 200 הטלות. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 't100', text: 'לחץ על "הטל 100 פעמים" כדי לצבור הטלות מהר.' }, setup: rollScene
    },
    {
      mode: 'quiz', tA: 'אחרי 20 הטלות יצאו 12 זוגיות', sub: 'מה נכון לומר על הקובייה?',
      tip: 'חשוב על מספר ההטלות. כמה זה בהשוואה למה שראית בגרף?', btn: 'המשך ←',
      aspect: [402, 196], alt: 'שני עמודים: שתים עשרה תוצאות זוגיות ושמונה תוצאות אי זוגיות מתוך עשרים הטלות, וקו מקווקו בעשר', setup: twentyPicture,
      win: 'נכון. מעט הטלות לא מוכיחות כלום.', wrongSay: 'בדוק מה אפשר להסיק מעשרים הטלות בלבד.',
      opts: [
        { t: 'עדיין ייתכן שהקובייה הוגנת, 20 הטלות זה מעט', c: true, f: 'שתים עשרה מתוך עשרים זה ' + m('0.6') + ', קרוב ל־' + m('0.5') + '. אחרי מעט הטלות סטייה כזו נפוצה, ולכן אי אפשר להסיק שהקובייה לא הוגנת.' },
        { t: 'הקובייה אינה הוגנת', f: 'מדגם קטן לא מוכיח זאת. גם קובייה הוגנת נותנת לפעמים ' + m('12') + ' זוגיות מתוך ' + m('20') + '.' },
        { t: 'ההסתברות השתנתה ל־' + m('0.6'), f: 'ההסתברות לא זזה. מי שזז הוא השכיחות היחסית, והיא ' + m('0.6') + ' רק בניסוי הזה.' },
        { t: 'בהטלה הבאה בטוח תצא תוצאה אי־זוגית', f: 'לקובייה אין זיכרון. כל הטלה מתחילה מחדש, וההסתברות לזוגי נשארת ' + m('0.5') + '.' }
      ],
      hints: ['חשוב מה אפשר ללמוד מהגרף כשיש מעט הטלות.', 'ההסתברות היא תכונה של הקובייה, והשכיחות היחסית היא תוצאה של ניסוי מסוים.', 'עשרים הטלות הן מעט, והקובייה לא זוכרת מה יצא קודם.']
    },
    {
      mode: 'scene', tA: 'ודאי, אפשרי, בלתי אפשרי', sub: 'הצב כל סמן במקומו על הקו מאפס עד אחד, בגרירה, בכפתורים או בחיצים.',
      tip: 'לכל מאורע יש מקום על הקו. אפס הוא בלתי אפשרי, אחד הוא ודאי, ובאמצע נמצא החצי.',
      aspect: [402, 236],
      alt: 'קו ערכים מאפס עד אחד עם שלושה סמנים שמזיזים. מחוץ לקו יש אזורים אדומים שמסמנים ערכים שאינם הסתברות',
      cue: 'הצב את שלושת הסמנים במקום', cueDone: 'כל המאורעות במקומם. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'cards', text: 'לחץ על 0, חצי או 1 ליד כל מאורע כדי להניח את הסמן שלו.' }, setup: lineScene
    },
    {
      mode: 'quiz', tA: 'איזה מאורע הוא ודאי בהטלת קובייה הוגנת?', sub: 'ודאי פירושו שההסתברות שלו היא בדיוק אחד.',
      tip: 'חפש את המאורע שמתקיים בכל אחת מהפאות.', btn: 'המשך ←',
      win: 'נכון. כל הפאות מתאימות, ולכן ההסתברות היא ' + m('1') + '.', wrongSay: 'בדוק אם המאורע מתקיים בכל שש הפאות.',
      opts: [
        { t: 'התוצאה קטנה מ־' + m('7'), c: true, f: 'כל שש הפאות קטנות מ־' + m('7') + ': שש מתוך שש, ההסתברות ' + m('1') + '.' },
        { t: 'התוצאה זוגית', f: 'זוגיות רק שלוש פאות מתוך שש. זה חצי, לא ודאי.' },
        { t: 'התוצאה ' + m('6'), f: 'רק פאה אחת מתוך שש, ולכן ההסתברות היא ' + m('0.17') + ' בקירוב, רחוקה מאוד מוודאות.' },
        { t: 'התוצאה גדולה מ־' + m('6'), f: 'אין פאה גדולה מ־' + m('6') + ', ולכן המאורע בלתי אפשרי והסתברותו ' + m('0') + '.' }
      ],
      hints: ['ודאי אומר שאין שום פאה שלא מתאימה.', 'בדוק כל מאורע מול כל שש הפאות.', 'שאל: האם גם ' + m('1') + ' וגם ' + m('6') + ' קטנות מ־' + m('7') + '?']
    },
    {
      mode: 'quiz', tA: 'מהי השכיחות היחסית של ', tM: '6', tB: '?',
      sub: 'מתוך ' + m('50') + ' הטלות התקבל ' + m('6') + ' שמונה פעמים.',
      tip: 'שכיחות יחסית היא כמה פעמים זה קרה מתוך כל ההטלות.', btn: 'לסיכום ←',
      win: 'נכון. שמונה מתוך חמישים הם ' + m('0.16') + '.', wrongSay: 'בדוק מה צריך לחלק במה.',
      opts: [
        { t: m('16%'), c: true, f: m('8 ÷ 50 = 0.16 = 16%') + '. שמונה פעמים מתוך חמישים הטלות.' },
        { t: m('8%'), f: 'שמונה הוא מספר הפעמים, לא השכיחות היחסית. צריך לחלק אותו במספר ההטלות.' },
        { t: m('6%'), f: m('6') + ' היא הפאה שיצאה, לא מספר הפעמים שהיא יצאה.' },
        { t: m('50%'), f: m('50') + ' הוא מספר ההטלות, כלומר המכנה. השכיחות היחסית היא ' + m('8') + ' מתוכן.' }
      ],
      hints: ['כמה פעמים יצא ' + m('6') + ', ומתוך כמה הטלות?', 'חלק את מספר הפעמים במספר ההטלות.', m('8 ÷ 50') + ' ואז הפוך לאחוזים.']
    },
    {
      mode: 'finish', tA: 'סיימת את משחק ההסתברות', sub: 'עכשיו אתה יודע מה יכול לקרות, וגם מה באמת קורה כשמטילים.',
      tip: 'כל הכבוד. בפעם הבאה שתטיל קובייה, תדע מה לצפות ומה רק נראה כך.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'מה שגילית: ההסתברות היא מה שמצפים לו, והשכיחות היחסית היא מה שקרה. עם יותר הטלות הן מתקרבות, בלי חובה להיות שוות בדיוק.',
      formula: m('0 ≤ P ≤ 1') + ' · מתאימות מתוך כולן'
    }
  ];

  /* ---------- bonus: the experiment machine ---------- */
  var EXPERIMENTS = [
    { t: 'מטילים קובייה הוגנת. המאורע: התוצאה זוגית.', d: 6, good: [1, 3, 5] },
    { t: 'מטילים קובייה הוגנת. המאורע: התוצאה גדולה מ־' + bdi('2') + '.', d: 6, good: [2, 3, 4, 5] },
    { t: 'מטילים קובייה הוגנת. המאורע: התוצאה ראשונית (' + bdi('2') + ', ' + bdi('3') + ' או ' + bdi('5') + ').', d: 6, good: [1, 2, 4] },
    { t: 'מטילים קובייה הוגנת. המאורע: התוצאה קטנה מ־' + bdi('3') + '.', d: 6, good: [0, 1] },
    { t: 'מטילים קובייה הוגנת. המאורע: התוצאה היא כפולה של ' + bdi('3') + '.', d: 6, good: [2, 5] },
    { t: 'מטילים שני מטבעות הוגנים. המאורע: שניהם יוצאים עץ.', d: 4, good: [0] },
    { t: 'מטילים שני מטבעות הוגנים. המאורע: יוצא לפחות עץ אחד.', d: 4, good: [0, 1, 2] },
    { t: 'מטילים שני מטבעות הוגנים. המאורע: שתי התוצאות שונות.', d: 4, good: [1, 2] },
    { t: 'סביבון עם ארבעה חלקים שווים: אדום, כחול, ירוק וצהוב. המאורע: הוא עוצר על אדום.', d: 4, good: [0] },
    { t: 'סביבון עם ארבעה חלקים שווים: אדום, כחול, ירוק וצהוב. המאורע: הוא עוצר על כחול או ירוק.', d: 4, good: [1, 2] },
    { t: 'סביבון עם ארבעה חלקים שווים: אדום, כחול, ירוק וצהוב. המאורע: הוא לא עוצר על צהוב.', d: 4, good: [0, 1, 2] }
  ];

  window.NoamGame.boot({
    slug: 'maabadat-hakubiyot',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'מרחב התוצאות והסתברות', math: '2 ÷ 6' },
      { step: 4, name: 'שכיחות יחסית מול הסתברות', math: '12 ÷ 20' },
      { step: 6, name: 'ודאי ובלתי אפשרי', math: '0 ≤ P ≤ 1' },
      { step: 7, name: 'חישוב שכיחות יחסית', math: '8 ÷ 50 = 16%' }
    ],
    bonus: {
      label: 'מכונת הניסויים 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'בחר את ההסתברות הנכונה ואז ראה מה קורה ב־100 ניסויים.',
      setup: function (box, ctx) {
        var exp, answered, optBtns;
        box.innerHTML = '<div class="bTitle">מכונת הניסויים</div>'
          + '<div class="bSub" data-desc></div>'
          + '<div class="bSub"><b>מהי ההסתברות למאורע?</b></div>'
          + '<div data-opts style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>'
          + '<div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<div class="bForms" data-res hidden></div>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">ניסוי חדש ↻</button>';
        var desc = box.querySelector('[data-desc]');
        var optBox = box.querySelector('[data-opts]');
        var ok = box.querySelector('[data-ok]');
        var res = box.querySelector('[data-res]');
        function roll() {
          exp = EXPERIMENTS[Math.floor(Math.random() * EXPERIMENTS.length)];
          answered = false;
          var n = exp.good.length;
          var pool = [];
          for (var k = 0; k <= exp.d; k++) if (k !== n) pool.push(k);
          var nums = window.NoamGame.shuffle(pool).slice(0, 3).concat([n]);
          nums = window.NoamGame.shuffle(nums);
          desc.innerHTML = exp.t;
          optBox.innerHTML = '';
          optBtns = nums.map(function (value) {
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('aria-label', value + ' מתוך ' + exp.d);
            b.style.cssText = 'min-height:64px;min-width:44px;border:2px solid ' + PAL.main + ';border-radius:12px;background:#fff;color:' + PAL.ink + ';font-size:20px;cursor:pointer';
            b.innerHTML = fracHtml(value, exp.d);
            b.addEventListener('click', function () { pickValue(value, b); });
            optBox.appendChild(b);
            return b;
          });
          ok.hidden = true;
          res.hidden = true;
        }
        function pickValue(value, b) {
          if (answered) return;
          var n = exp.good.length;
          ok.hidden = false;
          if (value !== n) {
            ctx.sfx('error');
            b.disabled = true;
            b.style.opacity = '.45';
            ok.style.color = BAD;
            ok.textContent = 'עוד לא. ספור כמה תוצאות מתאימות למאורע, ומתוך כמה תוצאות אפשריות. נסה שוב.';
            return;
          }
          answered = true;
          ctx.sfx('correct');
          optBtns.forEach(function (x) { x.disabled = true; });
          b.style.background = PAL.goodSoft;
          b.style.borderColor = PAL.good;
          var hits = 0;
          for (var i = 0; i < 100; i++) {
            if (exp.good.indexOf(Math.floor(Math.random() * exp.d)) >= 0) hits += 1;
          }
          var p = n / exp.d;
          ok.style.color = PAL.good;
          ok.textContent = 'נכון! עכשיו המכונה מריצה ' + 100 + ' ניסויים.';
          res.hidden = false;
          res.innerHTML = '<div>ההסתברות: ' + fracHtml(n, exp.d) + ' ' + bdi(decText(n, exp.d) + ' ' + pctText(n, exp.d)) + '</div>'
            + '<div>בניסוי יצא ' + bdi(String(hits)) + ' פעמים מתוך ' + bdi('100') + ': שכיחות יחסית ' + bdi(hits + '%') + '.</div>'
            + '<div style="font-family:Heebo,sans-serif;font-size:13.5px">'
            + (Math.abs(hits / 100 - p) <= 0.1 ? 'קרוב להסתברות, אבל לא חייב להיות שווה.' : 'הפעם יצאה סטייה גדולה יחסית. עם יותר ניסויים היא בדרך כלל קטנה.') + '</div>';
        }
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); });
        roll();
      }
    }
  });
}());
