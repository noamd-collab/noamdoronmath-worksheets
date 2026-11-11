/**
 * סוד לוח הכפל — the reference engine game.
 *
 * The idea: a multiplication exercise is a rectangle. Once you see it, you can
 * rotate it (commutativity) and cut it (distributivity), and a "hard" fact
 * turns into two easy ones.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef';

  /** Cell size that keeps a rows x cols grid inside the drawing. */
  function cellSize(rows, cols) {
    return Math.min(36, Math.floor(300 / Math.max(cols, 1)), Math.floor(210 / Math.max(rows, 1)));
  }

  function originOf(rows, cols, cs) {
    return { x: (W - cols * cs) / 2, y: 48 + (212 - rows * cs) / 2 };
  }

  /**
   * One rectangle of unit squares.
   * paint(r, c) returns the fill of a cell, so a scene can colour parts of it.
   */
  function gridCells(rows, cols, cs, ox, oy, paint) {
    var out = '';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        out += '<rect x="' + (ox + c * cs + 1.5) + '" y="' + (oy + r * cs + 1.5) + '"'
          + ' width="' + (cs - 3) + '" height="' + (cs - 3) + '" rx="4"'
          + ' fill="' + (paint ? paint(r, c) : SOFT) + '" stroke="' + LINE + '" stroke-width="1.4"/>';
      }
    }
    return out;
  }

  /** The "cols" brace above the rectangle and the "rows" brace beside it. */
  function labels(rows, cols, cs, ox, oy) {
    var w = cols * cs, h = rows * cs;
    return '<g font-family="Secular One, sans-serif" fill="' + MAIN + '">'
      + '<line x1="' + ox + '" y1="' + (oy - 12) + '" x2="' + (ox + w) + '" y2="' + (oy - 12) + '"'
      + ' stroke="' + MAIN + '" stroke-width="2" stroke-linecap="round"/>'
      + '<text x="' + (ox + w / 2) + '" y="' + (oy - 20) + '" font-size="17" text-anchor="middle">' + cols + '</text>'
      + '<line x1="' + (ox + w + 12) + '" y1="' + oy + '" x2="' + (ox + w + 12) + '" y2="' + (oy + h) + '"'
      + ' stroke="' + MAIN + '" stroke-width="2" stroke-linecap="round"/>'
      + '<text x="' + (ox + w + 26) + '" y="' + (oy + h / 2 + 6) + '" font-size="17" text-anchor="middle">' + rows + '</text>'
      + '</g>';
  }

  /* ---------- step 1: build a rectangle ---------- */
  function buildScene(ctx) {
    var rows = 2, cols = 3, hit = false;
    var box = ctx.extra(
      '<div class="stepper">'
      + '<div class="unit"><button type="button" data-k="rows" data-d="-1" aria-label="פחות שורות">−</button>'
      + '<b style="font-size:12.5px">שורות</b><span class="var" data-v="rows">2</span>'
      + '<button type="button" data-k="rows" data-d="1" aria-label="עוד שורות">+</button></div>'
      + '<div class="unit"><button type="button" data-k="cols" data-d="-1" aria-label="פחות משבצות בשורה">−</button>'
      + '<b style="font-size:12.5px">בכל שורה</b><span class="var" data-v="cols">3</span>'
      + '<button type="button" data-k="cols" data-d="1" aria-label="עוד משבצות בשורה">+</button></div>'
      + '</div>'
    );
    function render() {
      var cs = cellSize(rows, cols);
      var o = originOf(rows, cols, cs);
      ctx.draw(gridCells(rows, cols, cs, o.x, o.y) + labels(rows, cols, cs, o.x, o.y));
      box.querySelector('[data-v="rows"]').textContent = String(rows);
      box.querySelector('[data-v="cols"]').textContent = String(cols);
      box.querySelectorAll('button').forEach(function (b) {
        var k = b.getAttribute('data-k'), d = Number(b.getAttribute('data-d'));
        var v = k === 'rows' ? rows : cols;
        b.disabled = (d < 0 && v <= 1) || (d > 0 && v >= 9);
      });
      ctx.caption(m(cols + ' × ' + rows + ' = ' + (rows * cols)));
      var total = rows * cols;
      if (total === 24 && !hit) {
        hit = true;
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.note('בדיוק ' + m('24') + ' משבצות. שים לב: יש עוד מלבנים עם אותו מספר משבצות.', 'good');
        ctx.say('מצאת! עכשיו נסה מלבן אחר עם אותן ' + m('24') + ' משבצות.', { mood: 'happy', attn: true });
        ctx.solved();
      } else if (total === 24) {
        ctx.note('בדיוק ' + m('24') + ' משבצות. שים לב: יש עוד מלבנים עם אותו מספר משבצות.', 'good');
      } else {
        ctx.note('כרגע יש ' + m(String(total)) + ' משבצות. צריך ' + m('24') + '.');
      }
    }
    function bump(k, d) {
      if (k === 'rows') rows = Math.max(1, Math.min(9, rows + d));
      else cols = Math.max(1, Math.min(9, cols + d));
      ctx.sfx('click');
      render();
    }
    box.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        bump(b.getAttribute('data-k'), Number(b.getAttribute('data-d')));
      });
    });
    ctx.register('stepper', box);
    render();
  }

  /* ---------- step 3: turn the rectangle ---------- */
  function turnScene(ctx) {
    var rows = 3, cols = 8, turned = false, busy = false;
    var cs = cellSize(cols, cols);
    var o = originOf(rows, cols, cs);
    var cx = o.x + cols * cs / 2, cy = o.y + rows * cs / 2;
    function render(angle, marks) {
      ctx.draw('<g id="gTurn" transform="rotate(' + angle + ' ' + cx + ' ' + cy + ')">'
        + gridCells(rows, cols, cs, o.x, o.y) + '</g>'
        + (marks ? labels(cols, rows, cs, cx - rows * cs / 2, cy - cols * cs / 2) : ''));
    }
    render(0);
    ctx.caption(m('8 × 3 = 24'));
    ctx.note('שלוש שורות, שמונה בכל שורה.');
    var btn = ctx.button('סובב את המלבן ↻', function () {
      if (busy || turned) return;
      busy = true;
      ctx.busy(true);
      ctx.sfx('click');
      ctx.tween(900, function (l) {
        render(window.NoamGame.ez(l) * 90);
      }).then(function () {
        render(90, true);
        turned = true;
        busy = false;
        ctx.busy(false);
        btn.disabled = true;
        ctx.caption(m('3 × 8 = 24'));
        ctx.note('אותו מלבן בדיוק. רק הסתכלנו עליו מהצד. לכן ' + m('8 × 3') + ' ו־' + m('3 × 8')
          + ' תמיד שווים.', 'good');
        ctx.sfx('correct');
        ctx.burst(14);
        ctx.say('זה חוק החילוף. הוא חוסך לך חצי מלוח הכפל.', { mood: 'happy', attn: true });
        ctx.solved();
      });
    }, { target: 'turn' });
    ctx.register('turn', btn);
  }

  /* ---------- step 5: cut the rectangle ---------- */
  function cutScene(ctx) {
    var rows = 7, cols = 8, k = 1, done = false;
    var cs = cellSize(rows, cols);
    var o = originOf(rows, cols, cs);
    var splitY0 = o.y - 6, splitY1 = o.y + rows * cs + 6;
    ctx.draw(
      '<g id="cells">' + gridCells(rows, cols, cs, o.x, o.y, function () { return SOFT; }) + '</g>'
      + labels(rows, cols, cs, o.x, o.y)
      + '<g id="cut" style="cursor:ew-resize">'
      + '<line id="cutLine" x1="0" y1="' + splitY0 + '" x2="0" y2="' + splitY1 + '"'
      + ' stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
      + '<circle id="cutKnob" cx="0" cy="' + (o.y + rows * cs + 16) + '" r="11" fill="' + INK + '"/>'
      + '<text id="cutArrow" x="0" y="' + (o.y + rows * cs + 21) + '" font-size="13" fill="#fff"'
      + ' text-anchor="middle" font-family="Secular One, sans-serif">↔</text>'
      + '<rect id="cutGrab" x="0" y="' + (o.y - 10) + '" width="40"'
      + ' height="' + (rows * cs + 40) + '" fill="transparent"/></g>'
    );
    var cells = [].slice.call(ctx.el('cells').children);
    function render() {
      var splitX = o.x + k * cs;
      cells.forEach(function (rect, i) {
        rect.setAttribute('fill', (i % cols) < k ? SOFT : WARM_SOFT);
      });
      ctx.el('cutLine').setAttribute('x1', splitX);
      ctx.el('cutLine').setAttribute('x2', splitX);
      ctx.el('cutKnob').setAttribute('cx', splitX);
      ctx.el('cutArrow').setAttribute('x', splitX);
      ctx.el('cutGrab').setAttribute('x', splitX - 20);
      ctx.caption(m('7 × 8 = 7 × ' + k + ' + 7 × ' + (cols - k)));
      ctx.note('החלק הכחול הוא ' + m('7 × ' + k + ' = ' + (7 * k))
        + ', החלק הכתום הוא ' + m('7 × ' + (cols - k) + ' = ' + (7 * (cols - k))) + '.',
        done ? 'good' : null);
    }
    ctx.drag(ctx.el('cut'), {
      move: function (x) {
        var nk = Math.max(1, Math.min(cols - 1, Math.round((x - o.x) / cs)));
        if (nk !== k) { k = nk; ctx.sfx('tick'); render(); }
      },
      end: function () { check(); }
    });
    function check() {
      if (done || k !== 5) return;
      done = true;
      ctx.sfx('correct');
      ctx.burst(18);
      ctx.note('זה הפירוק הנוח: ' + m('7 × 5 = 35') + ' ועוד ' + m('7 × 3 = 21')
        + '. יחד ' + m('56') + '.', 'good');
      ctx.say('ככה מפרקים תרגיל קשה לשניים קלים.', { mood: 'happy', attn: true });
      ctx.solved();
    }
    render();
  }

  /** A static rectangle, used as the picture of a question. */
  function still(rows, cols) {
    return function (ctx) {
      var cs = cellSize(rows, cols);
      var o = originOf(rows, cols, cs);
      ctx.draw(gridCells(rows, cols, cs, o.x, o.y) + labels(rows, cols, cs, o.x, o.y));
    };
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'סוד לוח הכפל', tM: '7 × 8', tB: ' = ?',
      sub: 'לא צריך לזכור את כל לוח הכפל בעל פה. צריך לדעת לראות אותו.',
      tip: 'שלום, אני אליהו. בוא נגלה למה אף אחד לא באמת צריך לשנן את כל לוח הכפל.',
      emoji: '🟦',
      eq: m('7 × 8 = 7 × 5 + 7 × 3'),
      note: 'אליהו יראה לך איך תרגיל שנראה קשה מתפרק לשני תרגילים שאתה כבר יודע.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'כפל הוא מלבן',
      sub: 'שנה את מספר השורות ואת מספר המשבצות בשורה, וראה איך התרגיל משתנה.',
      tip: 'כל תרגיל כפל הוא מלבן. בנה לי מלבן עם ' + m('24') + ' משבצות.',
      cue: 'בנה מלבן עם 24 משבצות',
      cueDone: 'יפה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של משבצות שאפשר לשנות את גודלו',
      nudge: { target: 'stepper', text: 'השתמש בכפתורים כדי להגדיל את המלבן.' },
      setup: buildScene
    },
    {
      mode: 'quiz',
      tA: 'כמה משבצות יש במלבן?',
      sub: 'ארבע שורות, ובכל שורה שבע משבצות.',
      tip: 'ספור שורה אחת, ואז חשוב כמה שורות כאלה יש.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של ארבע שורות ושבע עמודות',
      setup: still(4, 7),
      win: 'יפה. מלבן זה כפל, וכפל זה מלבן.',
      wrongSay: 'תסתכל שוב על המלבן. כמה שורות, וכמה בכל שורה?',
      opts: [
        { t: '4 × 7 = 28', c: true, f: 'ארבע שורות של שבע הן ' + m('28') + ' משבצות.' },
        { t: '4 + 7 = 11', f: 'חיברת את מספר השורות למספר המשבצות בשורה. כאן יש ארבע שורות שלמות, ובכל אחת שבע משבצות.' },
        { t: '7 − 4 = 3', f: 'חיסור מוריד, והמלבן לא מוריד כלום.' },
        { t: '4 × 7 = 24', f: 'הפעולה נכונה, התוצאה לא. ספור שוב.' }
      ],
      hints: [
        'שורה אחת היא ' + m('7') + '. יש ארבע שורות כאלה.',
        m('7 + 7 = 14') + ', ועוד ' + m('14') + ' הם ' + m('28') + '.'
      ]
    },
    {
      mode: 'scene',
      tA: 'אותו מלבן, מכיוון אחר',
      sub: 'סובב את המלבן ברבע סיבוב וראה מה קורה למספר המשבצות.',
      tip: 'מה קורה אם מסובבים את המלבן רבע סיבוב?',
      cue: 'סובב את המלבן',
      cueDone: 'ראית את זה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של שלוש שורות ושמונה עמודות שמסתובב',
      nudge: { target: 'turn', text: 'לחץ על הכפתור כדי לסובב.' },
      setup: turnScene
    },
    {
      mode: 'quiz',
      tA: 'אתה כבר יודע ש־', tM: '8 × 3 = 24',
      sub: 'אז כמה הם ' + m('3 × 8') + '?',
      tip: 'זה אותו מלבן בדיוק. רק הסתכלנו עליו מכיוון אחר.',
      btn: 'המשך ←',
      win: 'נכון. סיבוב לא מוסיף ולא מוריד משבצות.',
      wrongSay: 'זה אותו מלבן, רק מכיוון אחר.',
      opts: [
        { t: '24', c: true, f: 'אותו מלבן בדיוק, ולכן אותה תשובה.' },
        { t: '11', f: 'זה ' + m('8 + 3') + '. חיבור, לא כפל.' },
        { t: '38', f: 'כתבת את ' + m('3') + ' ואת ' + m('8') + ' זה ליד זה. בכפל סופרים משבצות, לא מצמידים ספרות.' },
        { t: '12', f: 'זה חצי. בדוק שוב את המלבן.' }
      ],
      hints: [
        'חשוב על המלבן שסובבנו.',
        'בכפל אפשר להחליף את סדר המספרים בלי לשנות את התוצאה.'
      ]
    },
    {
      mode: 'scene',
      tA: 'חותכים את המלבן',
      sub: 'גרור את הקו השחור וחתוך את המלבן לשני חלקים קלים.',
      tip: 'עכשיו הקטע היפה. אפשר לחתוך את המלבן לשני חלקים נוחים.',
      cue: 'גרור את הקו עד שבחלק הכחול יהיו 5 עמודות',
      cueDone: 'מצוין. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מלבן של שבע שורות ושמונה עמודות עם קו חיתוך נגרר',
      nudge: { target: 'scene', text: 'גרור את העיגול השחור ימינה או שמאלה.' },
      setup: cutScene
    },
    {
      mode: 'quiz',
      tA: 'ועכשיו התרגיל עצמו: ', tM: '7 × 8',
      sub: 'השתמש בפירוק שראית: ' + m('7 × 5') + ' ועוד ' + m('7 × 3') + '.',
      tip: 'חשב כל חלק בנפרד, ורק אז חבר את שניהם.',
      btn: 'המשך ←',
      win: 'בדיוק. שני תרגילים קלים במקום אחד קשה.',
      wrongSay: 'חשב כל חלק בנפרד, ורק אז חבר.',
      opts: [
        { t: '56', c: true, f: m('35') + ' ועוד ' + m('21') + ' הם ' + m('56') + '.' },
        { t: '54', f: 'זה ' + m('6 × 9') + '. קרוב, אבל לא כאן.' },
        { t: '49', f: 'זה ' + m('7 × 7') + '. חסרה עוד עמודה אחת של ' + m('7') + '.' },
        { t: '63', f: 'זה ' + m('7 × 9') + '. ספרת עמודה אחת יותר מדי.' }
      ],
      hints: [
        m('7 × 5 = 35') + '. זה החלק הכחול.',
        m('7 × 3 = 21') + '. עכשיו חבר את שני החלקים.'
      ]
    },
    {
      mode: 'quiz',
      tA: 'תורך לפרק: ', tM: '6 × 9',
      sub: 'פרק את ' + m('9') + ' לשני מספרים נוחים, וחבר.',
      tip: 'עכשיו תורך. פרק את ' + m('9') + ' למשהו נוח ותראה כמה זה קל.',
      btn: 'לסיכום ←',
      win: 'מעולה. עכשיו הסוד בידיים שלך.',
      wrongSay: 'פרק את ' + m('9') + ' ל־' + m('5') + ' ועוד ' + m('4') + ' ונסה שוב.',
      opts: [
        { t: '54', c: true, f: m('30') + ' ועוד ' + m('24') + ' הם ' + m('54') + '.' },
        { t: '45', f: 'זה ' + m('5 × 9') + '. חסרה עוד שורה של ' + m('9') + '.' },
        { t: '56', f: 'זה ' + m('7 × 8') + ', התרגיל הקודם.' },
        { t: '63', f: 'זה ' + m('7 × 9') + '. יש לנו רק שש שורות.' }
      ],
      hints: [
        m('6 × 5 = 30'),
        m('6 × 4 = 24') + '. חבר את שניהם.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את סוד לוח הכפל',
      sub: 'כל תרגיל כפל הוא מלבן, ואפשר לסובב אותו ולחתוך אותו.',
      tip: 'כל הכבוד. עכשיו אתה יודע לפרק כל תרגיל כפל שתפגוש.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוק שגילית:',
      formula: m('a × (b + c) = a × b + a × c')
    }
  ];

  window.NoamGame.boot({
    slug: 'luach-hakefel',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'מלבן ככפל', math: '4 × 7' },
      { step: 4, name: 'חוק החילוף', math: 'a × b = b × a' },
      { step: 6, name: 'פירוק תרגיל', math: '7 × 8' },
      { step: 7, name: 'פירוק עצמאי', math: '6 × 9' }
    ],
    bonus: {
      label: 'מכונת הפירוק 🎲',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הקובייה וקבל תרגיל חדש לפרק.',
      setup: function (box, ctx) {
        var a = 7, b = 8, open = false;
        box.innerHTML = '<div class="bTitle">מכונת הפירוק</div>'
          + '<div class="bSub">קבל תרגיל, נסה לפרק אותו בראש, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<button type="button" class="bDice" data-roll>🎲 תרגיל חדש</button>'
          + '<button type="button" class="bDice" data-show>גלה את הפירוק</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        function draw() {
          chip.textContent = a + ' × ' + b + ' = ?';
          var cut = b > 5 ? 5 : b - 1;
          sol.innerHTML = '<div>' + a + ' × ' + cut + ' = ' + (a * cut) + '</div>'
            + '<div>' + a + ' × ' + (b - cut) + ' = ' + (a * (b - cut)) + '</div>'
            + '<div>' + (a * cut) + ' + ' + (a * (b - cut)) + ' = ' + (a * b) + '</div>';
          sol.hidden = !open;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          a = 3 + Math.floor(Math.random() * 7);
          b = 4 + Math.floor(Math.random() * 6);
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
