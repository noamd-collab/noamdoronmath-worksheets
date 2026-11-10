/**
 * שטח והיקף עם אליהו.
 *
 * The idea: area is how many squares fit inside, perimeter is how many steps
 * it takes to walk around. The same area can have very different perimeters.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#c2410c', WARM_SOFT = '#fdf0d8';
  var GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef', PALE = '#eef1f6', PALE_LINE = '#d5dbe6';
  var SIDE_COL = ['#1d4ed8', '#c2410c', '#1d7a46', '#7c3aed'];

  function txt(x, y, s, size, fill, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + fill + '"'
      + ' text-anchor="' + (anchor || 'middle') + '" font-family="Secular One, sans-serif">' + s + '</text>';
  }

  /** Plain grid of unit squares; fillOf(r, c) may return a colour. */
  function cells(rows, cols, cs, ox, oy, fill, stroke) {
    var out = '';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        out += '<rect x="' + (ox + c * cs + 1) + '" y="' + (oy + r * cs + 1) + '"'
          + ' width="' + (cs - 2) + '" height="' + (cs - 2) + '" rx="3"'
          + ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>';
      }
    }
    return out;
  }

  /** Thick outline around a rectangle: this is the perimeter. */
  function outline(rows, cols, cs, ox, oy) {
    return '<rect x="' + ox + '" y="' + oy + '" width="' + (cols * cs) + '" height="' + (rows * cs) + '"'
      + ' rx="4" fill="none" stroke="' + WARM + '" stroke-width="5" stroke-linejoin="round"/>';
  }

  /** Length labels above and beside a rectangle. */
  function dims(rows, cols, cs, ox, oy, color) {
    return txt(ox + cols * cs / 2, oy - 12, cols, 17, color)
      + txt(ox - 14, oy + rows * cs / 2 + 6, rows, 17, color);
  }

  function centered(rows, cols, cs) {
    return { x: (W - cols * cs) / 2, y: 150 - rows * cs / 2 };
  }

  /* ---------- step 1: build a rectangle with area 12 ---------- */
  function buildScene(ctx) {
    var CS = 25, OX = 51, OY = 44, MAXC = 12, MAXR = 8;
    var cols = 3, rows = 2, done = false;
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:1fr 1fr">'
      + '<div><b>שטח: כמה משבצות בפנים</b><span data-a style="color:' + MAIN + '"></span></div>'
      + '<div><b>היקף: כמה צעדים מסביב</b><span data-p style="color:' + WARM + '"></span></div>'
      + '</div>'
    );
    var html = '<g id="cg">' + cells(MAXR, MAXC, CS, OX, OY, '#fff', PALE_LINE) + '</g>'
      + '<rect id="bd" x="' + OX + '" y="' + OY + '" width="0" height="0" rx="4" fill="none"'
      + ' stroke="' + WARM + '" stroke-width="5" stroke-linejoin="round"/>'
      + '<text id="lc" y="' + (OY - 12) + '" font-size="17" fill="' + MAIN + '" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif"></text>'
      + '<text id="lr" x="' + (OX - 14) + '" font-size="17" fill="' + MAIN + '" text-anchor="middle"'
      + ' font-family="Secular One, sans-serif"></text>'
      + '<g id="hg" style="cursor:nwse-resize">'
      + '<circle id="hk" r="11" fill="' + INK + '" stroke="#fff" stroke-width="2"/>'
      + '<text id="ha" font-size="12" fill="#fff" text-anchor="middle" font-family="Secular One, sans-serif">⤡</text>'
      + '<circle id="hb" r="24" fill="transparent"/></g>';
    ctx.draw(html);
    var rects = [].slice.call(ctx.el('cg').children);
    ctx.register('handle', ctx.el('hk'));

    function render() {
      rects.forEach(function (rect, i) {
        var r = Math.floor(i / MAXC), c = i % MAXC;
        var inside = r < rows && c < cols;
        rect.setAttribute('fill', inside ? SOFT : '#fff');
        rect.setAttribute('stroke', inside ? LINE : PALE_LINE);
      });
      var bd = ctx.el('bd');
      bd.setAttribute('width', cols * CS);
      bd.setAttribute('height', rows * CS);
      var hx = OX + cols * CS, hy = OY + rows * CS;
      ['hk', 'hb'].forEach(function (id) {
        ctx.el(id).setAttribute('cx', hx);
        ctx.el(id).setAttribute('cy', hy);
      });
      ctx.el('ha').setAttribute('x', hx);
      ctx.el('ha').setAttribute('y', hy + 4);
      var lc = ctx.el('lc'), lr = ctx.el('lr');
      lc.setAttribute('x', OX + cols * CS / 2);
      lc.textContent = String(cols);
      lr.setAttribute('y', OY + rows * CS / 2 + 6);
      lr.textContent = String(rows);
      var area = cols * rows, per = 2 * (cols + rows);
      box.querySelector('[data-a]').textContent = m(cols + ' × ' + rows + ' = ' + area);
      box.querySelector('[data-p]').textContent = m('2 × (' + cols + ' + ' + rows + ') = ' + per);
      ctx.caption('שטח ' + m(String(area)) + ' משבצות, היקף ' + m(String(per)) + ' צעדים');
      if (!done) {
        ctx.note('כרגע השטח הוא ' + m(String(area)) + '. אתה צריך ' + m('12') + '.');
      }
    }
    function check() {
      if (done || cols * rows !== 12) return;
      done = true;
      ctx.sfx('correct');
      ctx.burst(16);
      ctx.note('בדיוק ' + m('12') + ' משבצות בפנים. שים לב להיקף: הוא תלוי באיזה מלבן בנית.', 'good');
      ctx.say('מצאת! נסה עכשיו מלבן אחר, ותראה מה קורה להיקף.', { mood: 'happy', attn: true });
      ctx.solved();
    }
    ctx.drag(ctx.el('hg'), {
      move: function (x, y) {
        var nc = Math.max(1, Math.min(MAXC, Math.round((x - OX) / CS)));
        var nr = Math.max(1, Math.min(MAXR, Math.round((y - OY) / CS)));
        if (nc !== cols || nr !== rows) {
          cols = nc; rows = nr;
          ctx.sfx('tick');
          render();
          check();
        }
      },
      end: function () { check(); }
    });
    render();
  }

  /* ---------- step 3: walk around the rectangle ---------- */
  function walkScene(ctx) {
    var COLS = 5, ROWS = 3, CS = 40, OX = 101, OY = 95;
    var P = [
      [OX, OY], [OX + COLS * CS, OY], [OX + COLS * CS, OY + ROWS * CS], [OX, OY + ROWS * CS], [OX, OY]
    ];
    var LEN = [COLS, ROWS, COLS, ROWS];
    var CUM = [0, 5, 8, 13, 16];
    var OUT = [[0, -14], [14, 0], [0, 14], [-14, 0]];
    var busy = false, finished = false;
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(5,1fr)">'
      + '<div><b>למעלה</b><span data-s="0" style="color:' + SIDE_COL[0] + '">0</span></div>'
      + '<div><b>ימין</b><span data-s="1" style="color:' + SIDE_COL[1] + '">0</span></div>'
      + '<div><b>למטה</b><span data-s="2" style="color:' + SIDE_COL[2] + '">0</span></div>'
      + '<div><b>שמאל</b><span data-s="3" style="color:' + SIDE_COL[3] + '">0</span></div>'
      + '<div><b>סך הכול</b><span data-s="t" style="color:' + INK + '">0</span></div>'
      + '</div>'
    );
    var html = cells(ROWS, COLS, CS, OX, OY, SOFT, LINE)
      + '<rect x="' + OX + '" y="' + OY + '" width="' + (COLS * CS) + '" height="' + (ROWS * CS) + '"'
      + ' rx="4" fill="none" stroke="' + PALE_LINE + '" stroke-width="5" stroke-linejoin="round"/>';
    for (var i = 0; i < 4; i++) {
      html += '<line id="sd' + i + '" x1="' + P[i][0] + '" y1="' + P[i][1] + '" x2="' + P[i][0] + '" y2="' + P[i][1] + '"'
        + ' stroke="' + SIDE_COL[i] + '" stroke-width="6" stroke-linecap="round"/>';
    }
    var k = 0;
    for (var s = 0; s < 4; s++) {
      for (var j = 0; j < LEN[s]; j++) {
        k++;
        var mx = P[s][0] + (P[s + 1][0] - P[s][0]) * (j + 0.5) / LEN[s] + OUT[s][0];
        var my = P[s][1] + (P[s + 1][1] - P[s][1]) * (j + 0.5) / LEN[s] + OUT[s][1] + 4;
        html += '<text id="n' + k + '" x="' + mx + '" y="' + my + '" font-size="12" opacity="0"'
          + ' fill="' + SIDE_COL[s] + '" text-anchor="middle" font-family="Secular One, sans-serif">' + k + '</text>';
      }
    }
    html += txt(OX + COLS * CS / 2, OY + ROWS * CS / 2 + 6, '5 × 3 = 15', 15, MAIN)
      + '<circle id="dot" cx="' + OX + '" cy="' + OY + '" r="10" fill="' + INK + '" stroke="#fff" stroke-width="2.5"/>';
    ctx.draw(html);

    function upd(d) {
      var si = 0;
      while (si < 3 && d > CUM[si + 1]) si++;
      var t = Math.max(0, Math.min(1, (d - CUM[si]) / LEN[si]));
      var x = P[si][0] + (P[si + 1][0] - P[si][0]) * t;
      var y = P[si][1] + (P[si + 1][1] - P[si][1]) * t;
      ctx.el('dot').setAttribute('cx', x);
      ctx.el('dot').setAttribute('cy', y);
      for (var q = 0; q < 4; q++) {
        var e = ctx.el('sd' + q);
        var ex = P[q][0], ey = P[q][1];
        if (q < si) { ex = P[q + 1][0]; ey = P[q + 1][1]; }
        else if (q === si) { ex = x; ey = y; }
        e.setAttribute('x2', ex);
        e.setAttribute('y2', ey);
        var cnt = Math.max(0, Math.min(LEN[q], Math.floor(d + 1e-6) - CUM[q]));
        box.querySelector('[data-s="' + q + '"]').textContent = String(cnt);
      }
      var total = Math.floor(d + 1e-6);
      box.querySelector('[data-s="t"]').textContent = String(total);
      for (var n = 1; n <= 16; n++) ctx.el('n' + n).setAttribute('opacity', total >= n ? '1' : '0');
      return total;
    }
    var last = 0;
    var btn = ctx.button('צעד סביב המלבן 👣', function () {
      if (busy) return;
      busy = true;
      ctx.busy(true);
      ctx.sfx('click');
      last = 0;
      upd(0);
      ctx.note('הנקודה הולכת סביב המלבן, צעד אחרי צעד.');
      ctx.tween(4200, function (l) {
        var total = upd(l * 16);
        if (total !== last) { last = total; ctx.sfx('tick'); }
      }).then(function () {
        upd(16);
        busy = false;
        ctx.busy(false);
        btn.textContent = 'צעד שוב ↻';
        ctx.caption(m('5 + 3 + 5 + 3 = 16'));
        ctx.note('ההיקף הוא ' + m('16') + ' צעדים. זה סכום ארבע הצלעות, ולא מספר המשבצות שבפנים.', 'good');
        if (!finished) {
          finished = true;
          ctx.sfx('correct');
          ctx.burst(14);
          ctx.say('ההיקף הוא כל הדרך מסביב. השטח הוא רק מה שבפנים.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      });
    }, { target: 'walk' });
    ctx.register('walk', btn);
    ctx.caption(m('5 + 3 + 5 + 3 = ?'));
    ctx.note('לחץ על הכפתור וצעד סביב המלבן.');
  }

  /* ---------- step 5: same area, different perimeter ---------- */
  function sameAreaScene(ctx) {
    var OPTS = [
      { r: 1, c: 24, cs: 12 },
      { r: 2, c: 12, cs: 24 },
      { r: 3, c: 8, cs: 34 },
      { r: 4, c: 6, cs: 44 }
    ];
    var seen = [false, false, false, false], cur = -1, done = false;
    function per(o) { return 2 * (o.r + o.c); }
    var barsHtml = '';
    OPTS.forEach(function (o, i) {
      barsHtml += '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="width:58px;font-family:\'Secular One\',sans-serif;font-size:13px;text-align:left">'
        + o.r + ' × ' + o.c + '</span>'
        + '<div style="flex:1;background:' + PALE + ';border-radius:8px;height:18px;overflow:hidden">'
        + '<div data-bar="' + i + '" style="height:100%;width:0;background:' + WARM + ';border-radius:8px;'
        + 'transition:width .45s"></div></div>'
        + '<span data-val="' + i + '" style="width:26px;font-family:\'Secular One\',sans-serif;font-size:13px">?</span>'
        + '</div>';
    });
    var box = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:1fr 1fr">'
      + '<div><b>שטח: תמיד אותו דבר</b><span data-a style="color:' + MAIN + '"></span></div>'
      + '<div><b>היקף: כמה צעדים מסביב</b><span data-p style="color:' + WARM + '"></span></div>'
      + '</div>'
      + '<div dir="ltr" style="display:grid;gap:6px;background:#fff;border:1.5px solid #d9e2f0;'
      + 'border-radius:14px;padding:10px 12px">' + barsHtml + '</div>'
    );
    var btns = [];
    function show(i) {
      cur = i;
      var o = OPTS[i];
      var cs = o.cs, w = o.c * cs, h = o.r * cs;
      var ox = (W - w) / 2, oy = 150 - h / 2;
      ctx.draw(cells(o.r, o.c, cs, ox, oy, SOFT, LINE) + outline(o.r, o.c, cs, ox, oy)
        + dims(o.r, o.c, cs, ox - 0, oy - 4, MAIN));
      var p = per(o);
      box.querySelector('[data-a]').textContent = m(o.r + ' × ' + o.c + ' = 24');
      box.querySelector('[data-p]').textContent = m(String(p));
      seen[i] = true;
      var bar = box.querySelector('[data-bar="' + i + '"]');
      bar.style.width = Math.round(p / 50 * 100) + '%';
      bar.style.background = p === 20 ? GOOD : WARM;
      box.querySelector('[data-val="' + i + '"]').textContent = String(p);
      btns.forEach(function (b, k) {
        b.style.outline = k === i ? '3px solid ' + MAIN : 'none';
      });
      ctx.caption(m('2 × (' + o.r + ' + ' + o.c + ') = ' + p));
      if (i === 3) {
        if (!done) {
          done = true;
          ctx.sfx('correct');
          ctx.burst(16);
          ctx.note('מלבן ' + m('4 × 6') + ': אותם ' + m('24') + ' משבצות, אבל רק ' + m('20') + ' צעדים מסביב. זה ההיקף הקטן ביותר.', 'good');
          ctx.say('הכי קרוב לריבוע, הכי קצר מסביב. שים לב כמה שונים ההיקפים.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      } else {
        ctx.sfx('click');
        ctx.note('אותם ' + m('24') + ' משבצות, והיקף של ' + m(String(p)) + ' צעדים. נסה מלבן אחר.');
      }
    }
    OPTS.forEach(function (o, i) {
      var b = ctx.button(o.r + ' × ' + o.c, function () { show(i); }, { ghost: true, target: 'opt' + i });
      b.setAttribute('dir', 'ltr');
      btns.push(b);
      ctx.register('opt' + i, b);
    });
    show(0);
    ctx.note('החלף בין המלבנים וראה מה קורה להיקף. חפש את ההיקף הקטן ביותר.');
  }

  /* ---------- quiz pictures ---------- */
  function areaPicture(ctx) {
    var cs = 44, o = centered(3, 5, cs);
    ctx.draw(cells(3, 5, cs, o.x, o.y, SOFT, LINE) + dims(3, 5, cs, o.x, o.y - 4, MAIN));
  }

  function perimeterPicture(ctx) {
    var cs = 44, o = centered(3, 5, cs);
    ctx.draw(cells(3, 5, cs, o.x, o.y, WARM_SOFT, '#f0c98a') + outline(3, 5, cs, o.x, o.y)
      + txt(o.x + 110, o.y - 12, 5, 17, WARM)
      + txt(o.x + 110, o.y + 132 + 28, 5, 17, WARM)
      + txt(o.x - 14, o.y + 72, 3, 17, WARM)
      + txt(o.x + 220 + 14, o.y + 72, 3, 17, WARM));
  }

  function referencePicture(ctx) {
    var cs = 30, o = centered(2, 9, cs);
    ctx.draw(cells(2, 9, cs, o.x, o.y, SOFT, LINE) + outline(2, 9, cs, o.x, o.y)
      + dims(2, 9, cs, o.x, o.y - 4, MAIN));
  }

  function gardenPicture(ctx) {
    var cs = 36, o = centered(4, 6, cs);
    var w = 6 * cs, h = 4 * cs, g = '';
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 6; c++) {
        g += '<circle cx="' + (o.x + c * cs + cs / 2) + '" cy="' + (o.y + r * cs + cs / 2) + '" r="5"'
          + ' fill="#7fc98f"/>';
      }
    }
    ctx.draw('<rect x="' + o.x + '" y="' + o.y + '" width="' + w + '" height="' + h + '" fill="' + GOOD_SOFT + '"/>'
      + g
      + '<rect x="' + (o.x - 6) + '" y="' + (o.y - 6) + '" width="' + (w + 12) + '" height="' + (h + 12) + '"'
      + ' fill="none" stroke="#8a5a2b" stroke-width="5" stroke-dasharray="3 7" stroke-linecap="round"/>'
      + txt(o.x + w / 2, o.y - 18, 6, 17, '#8a5a2b')
      + txt(o.x - 20, o.y + h / 2 + 6, 4, 17, '#8a5a2b'));
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'שטח והיקף עם אליהו',
      sub: 'שני מספרים שכולם מערבבים ביניהם. אחרי המשחק הזה לא תתבלבל יותר.',
      tip: 'שלום, אני אליהו. היום נגלה מה ההבדל בין מה שבפנים לבין מה שמסביב.',
      emoji: '📐',
      eq: 'שטח הוא בפנים, והיקף הוא מסביב',
      note: 'אליהו יראה לך שאותו שטח יכול לתת היקפים שונים לגמרי.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'בונים מלבן',
      sub: 'גרור את העיגול השחור בפינה כדי לשנות את האורך ואת הרוחב.',
      tip: 'שטח הוא כמה משבצות יש בפנים. בנה לי מלבן עם ' + m('12') + ' משבצות.',
      cue: 'בנה מלבן עם שטח 12',
      cueDone: 'יפה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'רשת משבצות עם מלבן שאפשר להגדיל ולהקטין בגרירת הפינה',
      nudge: { target: 'handle', text: 'גרור את העיגול השחור בפינה של המלבן.' },
      setup: buildScene
    },
    {
      mode: 'quiz',
      tA: 'מה השטח של המלבן?',
      sub: 'המלבן ארוך חמש משבצות ורחב שלוש משבצות.',
      tip: 'שטח הוא כמה משבצות יש בפנים. ספור שורה אחת, ואז חשוב כמה שורות יש.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של שלוש שורות, ובכל שורה חמש משבצות',
      setup: areaPicture,
      win: 'נכון. שטח הוא אורך כפול רוחב.',
      wrongSay: 'שטח זה מה שבפנים. כמה שורות יש, וכמה משבצות בכל שורה?',
      opts: [
        { t: '15', c: true, f: 'שלוש שורות של חמש משבצות: ' + m('5 × 3 = 15') + '.' },
        { t: '16', f: 'זה ההיקף, כלומר הצעדים מסביב. כאן שואלים כמה משבצות יש בפנים.' },
        { t: '8', f: 'זה ' + m('5 + 3') + '. חיבור האורך והרוחב לא סופר משבצות.' },
        { t: '30', f: 'זה כפול מדי. ספור שוב: שלוש שורות, חמש בכל שורה.' }
      ],
      hints: [
        'שורה אחת היא ' + m('5') + ' משבצות. יש שלוש שורות כאלה.',
        m('5 + 5 + 5') + ' הם ' + m('15') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'הולכים מסביב',
      sub: 'לחץ על הכפתור והנקודה תלך סביב המלבן ותספור צעדים.',
      tip: 'עכשיו נלך מסביב. היקף הוא כמה צעדים עושים בדרך חזרה למקום שיצאנו ממנו.',
      cue: 'לחץ והפעל את הצעידה',
      cueDone: 'ראית את זה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של חמש משבצות על שלוש, ונקודה שהולכת לאורך המסגרת וסופרת צעדים',
      nudge: { target: 'walk', text: 'לחץ על כפתור הצעידה.' },
      setup: walkScene
    },
    {
      mode: 'quiz',
      tA: 'מה ההיקף של אותו מלבן?',
      sub: 'ארבע צלעות: חמש, שלוש, חמש ושלוש.',
      tip: 'היקף הוא כל הצלעות ביחד. אל תשכח אף צלע.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של חמש על שלוש עם מסגרת עבה ומספרים ליד כל צלע',
      setup: perimeterPicture,
      win: 'בדיוק. ההיקף הוא סכום כל הצלעות.',
      wrongSay: 'ההיקף הוא כל הדרך מסביב. עברת על ארבע הצלעות?',
      opts: [
        { t: '16', c: true, f: m('5 + 3 + 5 + 3 = 16') + '. כל ארבע הצלעות.' },
        { t: '15', f: 'זה השטח, כלומר המשבצות שבפנים. כאן שואלים על הצעדים מסביב.' },
        { t: '8', f: 'זה ' + m('5 + 3') + ', רק חצי מהדרך. יש עוד שתי צלעות.' },
        { t: '13', f: 'חיברת רק שלוש צלעות: ' + m('5 + 3 + 5') + '. חסרה צלע אחת של ' + m('3') + '.' }
      ],
      hints: [
        'במלבן יש שתי צלעות באורך ' + m('5') + ' ושתיים באורך ' + m('3') + '.',
        m('5 + 5 = 10') + ' ו־' + m('3 + 3 = 6') + '. עכשיו חבר.'
      ]
    },
    {
      mode: 'scene',
      tA: 'אותו שטח, היקף אחר',
      sub: 'בכל המלבנים יש בדיוק ' + m('24') + ' משבצות. בחר אחד ובדוק את ההיקף.',
      tip: 'הנה הסוד: אותו שטח יכול לתת היקפים שונים. מצא את המלבן עם ההיקף הקטן ביותר.',
      cue: 'מצא את ההיקף הקטן ביותר',
      cueDone: 'מצאת אותו. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'ארבעה מלבנים שונים עם שטח של עשרים וארבע משבצות, ולכל אחד היקף אחר',
      nudge: { target: 'opt3', text: 'נסה את המלבן שקרוב יותר לריבוע.' },
      setup: sameAreaScene
    },
    {
      mode: 'quiz',
      tA: 'איזה מלבן עם אותו שטח?',
      sub: 'למלבן שבתמונה יש ' + m('2 × 9 = 18') + ' משבצות. איזה מלבן יש לו אותו שטח, אבל היקף אחר?',
      tip: 'חשב שטח לכל אפשרות. רק אחת נותנת ' + m('18') + ', ורק היא שונה בהיקף.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של שתי שורות ותשע עמודות',
      setup: referencePicture,
      win: 'נכון. אותו שטח, היקף קטן יותר: ' + m('18') + ' לעומת ' + m('22') + '.',
      wrongSay: 'חשב קודם את השטח של כל אפשרות. מחפשים שטח ' + m('18') + '.',
      opts: [
        { t: '3 × 6', c: true, f: m('3 × 6 = 18') + ', אותו שטח. ההיקף הוא ' + m('18') + ' ולא ' + m('22') + '.' },
        { t: '9 × 2', f: 'זה אותו מלבן, רק מסובב. גם ההיקף זהה, ' + m('22') + '.' },
        { t: '5 × 6', f: 'ההיקף כאן הוא ' + m('22') + ' כמו במקור, אבל השטח הוא ' + m('30') + '. התבלבלת בין שטח להיקף.' },
        { t: '4 × 5', f: m('4 × 5 = 20') + '. זה קרוב ל־' + m('18') + ', אבל זה לא אותו שטח.' }
      ],
      hints: [
        'חשב ' + m('a × b') + ' לכל אחת מהאפשרויות.',
        'שלוש שורות של ' + m('6') + ' משבצות הן ' + m('18') + '.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'גדר לגינה',
      sub: 'הגינה של דני היא מלבן: ' + m('6') + ' מטרים על ' + m('4') + ' מטרים. הוא רוצה להקיף אותה בגדר. מה הוא צריך לחשב, וכמה יצא?',
      tip: 'שאל את עצמך: הגדר עוברת מסביב, או מכסה את מה שבפנים?',
      btn: 'לסיכום ←',
      aspect: [W, H],
      alt: 'גינה מלבנית של שישה מטרים על ארבעה, עם גדר מסביב',
      setup: gardenPicture,
      win: 'מעולה. גדר הולכת מסביב, אז זה היקף.',
      wrongSay: 'גדר עוברת מסביב לגינה. לכן צריך להבין מה מחשבים: שטח או היקף.',
      opts: [
        { t: 'היקף: ' + m('20') + ' מטר', c: true, f: m('6 + 4 + 6 + 4 = 20') + '. גדר מקיפה, אז מחשבים היקף.' },
        { t: 'שטח: ' + m('24') + ' מטר רבוע', f: 'שטח הוא מה שבפנים, למשל כמה דשא יש לזרוע. הגדר לא מכסה את הגינה.' },
        { t: 'היקף: ' + m('24') + ' מטר', f: 'הבחירה נכונה, אבל החישוב לא. ' + m('24') + ' הוא השטח. ההיקף הוא ' + m('6 + 4 + 6 + 4') + '.' },
        { t: 'שטח: ' + m('20') + ' מטר רבוע', f: 'שטח הוא ' + m('6 × 4 = 24') + ', ועוד לא שאלו עליו.' }
      ],
      hints: [
        'גדר עוברת מסביב לגינה, בדיוק כמו הצעדים שלנו.',
        'שתי צלעות של ' + m('6') + ' ושתי צלעות של ' + m('4') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את שטח והיקף',
      sub: 'שטח הוא מה שבפנים, והיקף הוא מה שמסביב. אותו שטח יכול לבוא עם היקפים שונים.',
      tip: 'כל הכבוד. מעכשיו תדע מתי סופרים משבצות ומתי סופרים צעדים.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוקים שגילית:',
      formula: 'שטח: ' + m('a × b') + ' · היקף: ' + m('a + b + a + b')
    }
  ];

  window.NoamGame.boot({
    slug: 'shetach-vehekef',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'חישוב שטח', math: '5 × 3' },
      { step: 4, name: 'חישוב היקף', math: '5 + 3 + 5 + 3' },
      { step: 6, name: 'אותו שטח, היקף אחר', math: '2 × 9' },
      { step: 7, name: 'שטח או היקף', math: '6 × 4' }
    ],
    bonus: {
      label: 'מכונת המלבנים 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הקובייה וקבל מלבן חדש. חשב בראש, ואז בדוק.',
      setup: function (box, ctx) {
        var a = 7, b = 4, showA = false, showP = false;
        box.innerHTML = '<div class="bTitle">מכונת המלבנים</div>'
          + '<div class="bSub">קבל מלבן, חשב שטח והיקף בראש, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol></div>'
          + '<button type="button" class="bDice" data-roll>🎲 מלבן חדש</button>'
          + '<button type="button" class="bDice" data-area>גלה את השטח</button>'
          + '<button type="button" class="bDice" data-per>גלה את ההיקף</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        function draw() {
          chip.textContent = a + ' × ' + b;
          var html = '';
          if (showA) html += '<div>שטח: ' + m(a + ' × ' + b + ' = ' + (a * b)) + '</div>';
          if (showP) html += '<div>היקף: ' + m(a + ' + ' + b + ' + ' + a + ' + ' + b + ' = ' + (2 * (a + b))) + '</div>';
          sol.innerHTML = html;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          a = 3 + Math.floor(Math.random() * 8);
          b = 2 + Math.floor(Math.random() * 7);
          showA = false;
          showP = false;
          ctx.sfx('click');
          draw();
        });
        box.querySelector('[data-area]').addEventListener('click', function () {
          showA = !showA;
          ctx.sfx(showA ? 'correct' : 'click');
          draw();
        });
        box.querySelector('[data-per]').addEventListener('click', function () {
          showP = !showP;
          ctx.sfx(showP ? 'correct' : 'click');
          draw();
        });
        draw();
      }
    }
  });
}());
