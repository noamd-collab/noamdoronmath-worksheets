/** שני ישרים: פתרון של מערכת הוא נקודת המפגש, והאלגברה מוצאת את אותה נקודה. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402, H = 340, UNIT = 24, OX = 201, OY = 172;
  var MUTED = '#475569', BAD = '#b91c1c';
  var C1 = PAL.main, C2 = '#b45309';

  function num(value) { return value < 0 ? '\u2212' + Math.abs(value) : String(value); }
  function dec(value) { return String(value).replace('-', '\u2212'); }
  function pair(x, y) { return '(' + dec(x) + ', ' + dec(y) + ')'; }
  function posX(units) { return OX + UNIT * units; }
  function posY(units) { return OY - UNIT * units; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function bdi(text, colour) {
    return '<bdi class="math" dir="ltr"' + (colour ? ' style="color:' + colour + '"' : '') + '>' + text + '</bdi>';
  }
  function lin(slope, intercept) {
    var s = '';
    if (slope === 0) return 'y = ' + num(intercept);
    if (slope === 1) s = 'x'; else if (slope === -1) s = '\u2212x';
    else s = num(slope) + 'x';
    if (intercept > 0) s += ' + ' + intercept; else if (intercept < 0) s += ' \u2212 ' + Math.abs(intercept);
    return 'y = ' + s;
  }
  function mathText(x, y, label, size, colour, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="'
      + (size || 14) + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function grid(clipId) {
    var html = '<defs><clipPath id="' + clipId + '"><rect x="57" y="28" width="288" height="288"/></clipPath></defs>'
      + '<rect x="57" y="28" width="288" height="288" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>';
    for (var tick = -6; tick <= 6; tick++) {
      if (tick !== 0) {
        html += '<line x1="' + posX(tick) + '" y1="28" x2="' + posX(tick) + '" y2="316" stroke="' + PAL.line + '" stroke-width="0.8"/>'
          + '<line x1="57" y1="' + posY(tick) + '" x2="345" y2="' + posY(tick) + '" stroke="' + PAL.line + '" stroke-width="0.8"/>';
        if (tick % 2 === 0) {
          html += mathText(posX(tick), OY + 19, num(tick), 13, MUTED) + mathText(OX - 8, posY(tick) + 4, num(tick), 13, MUTED, 'end');
        }
      }
    }
    html += '<path d="M57 172 H362 M201 316 V16" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<path d="M356 168 L362 172 L356 176 M197 22 L201 16 L205 22" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + mathText(380, 177, 'x', 17) + mathText(216, 22, 'y', 17) + mathText(190, 187, '0', 13, MUTED);
    return html;
  }
  function lineTag(id, colour, dash) {
    return '<line id="' + id + '" stroke="' + colour + '" stroke-width="3.5" stroke-linecap="round"'
      + (dash ? ' stroke-dasharray="9 6"' : '') + ' clip-path="url(#' + dash2clip(id) + ')"/>';
  }
  var CLIP_OF = {};
  function dash2clip(id) { return CLIP_OF[id]; }
  function setLine(node, slope, intercept) {
    node.setAttribute('x1', posX(-8)); node.setAttribute('y1', posY(slope * -8 + intercept));
    node.setAttribute('x2', posX(8)); node.setAttribute('y2', posY(slope * 8 + intercept));
  }
  function handleTag(id, colour, label) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0" style="cursor:grab">'
      + '<circle class="ring" r="32" fill="transparent" stroke="none"/>'
      + '<circle r="10" fill="' + colour + '" stroke="#fff" stroke-width="3"/></g>';
  }
  function unit(id, label, aria) {
    return '<div class="unit" dir="ltr"><bdi class="math var" dir="ltr">' + label + '</bdi>'
      + '<button type="button" id="' + id + 'Minus" data-delta="-1" aria-label="הקטן ' + aria + '">\u2212</button>'
      + '<bdi class="var math" dir="ltr" data-value="' + id + '" style="min-width:34px" aria-live="polite">0</bdi>'
      + '<button type="button" id="' + id + 'Plus" data-delta="1" aria-label="הגדל ' + aria + '">+</button></div>';
  }

  /* ---------- scene 1: move until they meet ---------- */
  function meetScene(ctx) {
    var b = 2, completed = false;
    CLIP_OF.fixed1 = 'meetClip'; CLIP_OF.moving1 = 'meetClip';
    ctx.draw(grid('meetClip') + lineTag('fixed1', C1, false) + lineTag('moving1', C2, false)
      + '<circle cx="' + posX(2) + '" cy="' + posY(3) + '" r="12" fill="none" stroke="' + PAL.good + '" stroke-width="2.5" stroke-dasharray="4 3"/>'
      + '<circle id="meetDot" r="7" fill="' + PAL.ink + '" stroke="#fff" stroke-width="2.5"/>'
      + '<text id="meetLabel" direction="ltr" font-family="Secular One, sans-serif" font-size="16" fill="' + PAL.ink + '" text-anchor="start"></text>'
      + '<style>#bHandle:focus-visible .ring{stroke:' + PAL.dark + ';stroke-width:3}</style>'
      + handleTag('bHandle', C2, 'הישר השני; הזז אותו בגרירה או במקשי החצים'));
    var handle = ctx.el('bHandle');
    setLine(ctx.el('fixed1'), 1, 1);
    var box = ctx.extra('<div class="sceneStrip"><b>שתי המשוואות</b>'
      + '<div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;font-size:18px">'
      + '<bdi class="math" dir="ltr" style="font-family:Secular One,sans-serif;color:' + C1 + '">y = x + 1</bdi>'
      + '<bdi class="math" dir="ltr" data-eq style="font-family:Secular One,sans-serif;color:' + C2 + '"></bdi></div>'
      + '<b style="margin-top:6px">הישרים נפגשים ב־</b><bdi class="math" dir="ltr" data-meet style="font-family:Secular One,sans-serif;font-size:21px" aria-live="polite"></bdi></div>'
      + '<div class="stepper" dir="ltr" style="margin-top:10px">' + unit('bVal', 'b', 'את b') + '</div>');
    ctx.register('stepper', box);
    var first = true;
    function update(acted) {
      if (acted !== undefined) first = false;
      var mx = (b - 1) / 2, my = (b + 1) / 2;
      setLine(ctx.el('moving1'), -1, b);
      handle.setAttribute('transform', 'translate(' + posX(4) + ' ' + posY(b - 4) + ')');
      handle.setAttribute('aria-valuenow', String(b));
      handle.setAttribute('aria-valuetext', 'b = ' + b + ', המפגש ב־' + pair(mx, my));
      ctx.el('meetDot').setAttribute('cx', posX(mx)); ctx.el('meetDot').setAttribute('cy', posY(my));
      var label = ctx.el('meetLabel');
      label.setAttribute('x', posX(mx) + 12); label.setAttribute('y', posY(my) + 24); label.textContent = pair(mx, my);
      box.querySelector('[data-value="bVal"]').textContent = String(b);
      box.querySelector('[data-eq]').textContent = lin(-1, b);
      box.querySelector('[data-meet]').textContent = pair(mx, my);
      ctx.caption('המטרה: ' + m('(2, 3)') + ' · כרגע: ' + m('b = ' + b));
      box.querySelector('[data-value="bVal"]').parentNode.querySelector('#bValMinus').disabled = b <= 0;
      box.querySelector('#bValPlus').disabled = b >= 8;
      if (first) {
        ctx.note('הישר הכתום חותך את ציר ' + m('y') + ' ב־' + m('(0, ' + b + ')') + '. המטרה: שהישרים ייפגשו ב־' + m('(2, 3)') + '. שנה את ' + m('b') + ' וראה לאן זזה נקודת המפגש.');
      } else if (b === 5) {
        ctx.note('בדיוק: ' + m('x + 1 = \u2212x + 5') + ' נותן ' + m('x = 2') + ', ואז ' + m('y = 3') + '. הנקודה ' + m('(2, 3)') + ' מתאימה לשתי המשוואות.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (b === 1 || b === 2 || b === 3) {
        ctx.note('שים לב: הישר השני חותך את ציר ' + m('y') + ' ב־' + m('(0, ' + b + ')') + '. אבל הפתרון הוא המקום שבו שני הישרים נפגשים, ' + m(pair(mx, my)) + ', ולא המקום שבו ישר אחד חותך ציר. הגדל את ' + m('b') + '.');
      } else if (b < 5) {
        ctx.note('הנקודה ' + m(pair(mx, my)) + ' עוד נמוכה ושמאלית מ־' + m('(2, 3)') + '. הגדל את ' + m('b') + ' והישר יעלה.');
      } else {
        ctx.note('הנקודה ' + m(pair(mx, my)) + ' כבר גבוהה וימנית מ־' + m('(2, 3)') + '. הקטן את ' + m('b') + '.');
      }
    }
    function step(delta) { b = clamp(b + delta, 0, 8); ctx.sfx('tick'); update(true); }
    box.querySelectorAll('[data-delta]').forEach(function (node) {
      node.addEventListener('click', function () { step(Number(node.getAttribute('data-delta'))); });
    });
    handle.addEventListener('keydown', function (event) {
      var k = event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) < 0) return;
      event.preventDefault();
      if (k === 'Home') { b = 0; update(true); } else if (k === 'End') { b = 8; update(true); }
      else step(k === 'ArrowRight' || k === 'ArrowUp' ? 1 : -1);
    });
    ctx.drag(handle, {
      move: function (x, y) {
        b = clamp(Math.round((OY - y) / UNIT + (x - OX) / UNIT), 0, 8);
        update(false);
      },
      end: function () { update(true); }
    });
    update();
  }

  /* ---------- scene 3: no solution, infinitely many ---------- */
  function casesScene(ctx) {
    var s = { m1: 1, b1: 0, m2: -1, b2: 2 };
    var got = { one: false, none: false, inf: false };
    CLIP_OF.l1 = 'caseClip'; CLIP_OF.l2 = 'caseClip';
    ctx.draw(grid('caseClip') + lineTag('l1', C1, false) + lineTag('l2', C2, true)
      + '<style>#h1:focus-visible .ring,#h2:focus-visible .ring{stroke:' + PAL.dark + ';stroke-width:3}</style>'
      + handleTag('h1', C1, 'הישר הכחול; שנה את החותך בגרירה או במקשי החצים')
      + handleTag('h2', C2, 'הישר הכתום; שנה את החותך בגרירה או במקשי החצים'));
    function row(i, colour) {
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:8px">'
        + '<bdi class="math" dir="ltr" data-eq="' + i + '" style="font-family:Secular One,sans-serif;font-size:18px;color:' + colour + '"></bdi>'
        + '<div class="stepper" dir="ltr">' + unit('m' + i, i === 1 ? 'm\u2081' : 'm\u2082', 'את השיפוע של ישר ' + i)
        + unit('b' + i, i === 1 ? 'b\u2081' : 'b\u2082', 'את החותך של ישר ' + i) + '</div></div>';
    }
    var box = ctx.extra('<div class="sceneStrip"><b>המשוואות שלך</b></div>' + row(1, C1) + row(2, C2)
      + '<ul data-list style="list-style:none;margin:10px 0 0;padding:0;display:flex;gap:8px;flex-wrap:wrap;justify-content:center"></ul>');
    ctx.register('stepper', box);
    var handles = { 1: ctx.el('h1'), 2: ctx.el('h2') };
    var HX = { 1: -1, 2: 1 };
    function kind() {
      if (s.m1 !== s.m2) return 'one';
      return s.b1 === s.b2 ? 'inf' : 'none';
    }
    var NAMES = { one: 'פתרון אחד', none: 'אין פתרון', inf: 'אינסוף פתרונות' };
    function update(msg, tone) {
      [1, 2].forEach(function (i) {
        var mm = s['m' + i], bb = s['b' + i];
        setLine(ctx.el('l' + i), mm, bb);
        handles[i].setAttribute('transform', 'translate(' + posX(HX[i]) + ' ' + posY(mm * HX[i] + bb) + ')');
        handles[i].setAttribute('aria-valuemin', '-4'); handles[i].setAttribute('aria-valuemax', '4');
        handles[i].setAttribute('aria-valuenow', String(bb));
        handles[i].setAttribute('aria-valuetext', lin(mm, bb));
        box.querySelector('[data-eq="' + i + '"]').textContent = lin(mm, bb);
        box.querySelector('[data-value="m' + i + '"]').textContent = num(mm);
        box.querySelector('[data-value="b' + i + '"]').textContent = num(bb);
        box.querySelector('#m' + i + 'Minus').disabled = mm <= -2; box.querySelector('#m' + i + 'Plus').disabled = mm >= 2;
        box.querySelector('#b' + i + 'Minus').disabled = bb <= -4; box.querySelector('#b' + i + 'Plus').disabled = bb >= 4;
      });
      box.querySelector('[data-list]').innerHTML = ['one', 'none', 'inf'].map(function (k) {
        return '<li style="font-weight:800;font-size:13.5px;padding:6px 12px;border-radius:999px;border:1.5px solid '
          + (got[k] ? '#9fd8b4' : PAL.line) + ';background:' + (got[k] ? PAL.goodSoft : '#fff') + ';color:' + (got[k] ? PAL.good : MUTED) + '">'
          + (got[k] ? '\u2713 ' : '\u25CB ') + NAMES[k] + '</li>';
      }).join('');
      var count = (got.one ? 1 : 0) + (got.none ? 1 : 0) + (got.inf ? 1 : 0);
      ctx.caption('סיווגת ' + m(String(count)) + ' מתוך ' + m('3') + ' מקרים');
      ctx.note(msg || 'שנה את השיפועים והחותכים עד שתראה מצב שעוד לא סיווגת, ואז לחץ על התשובה המתאימה.', tone);
    }
    function change(i, prop, delta) {
      var key = prop + i;
      s[key] = clamp(s[key] + delta, prop === 'm' ? -2 : -4, prop === 'm' ? 2 : 4);
      ctx.sfx('tick'); update();
    }
    box.querySelectorAll('[data-delta]').forEach(function (node) {
      node.addEventListener('click', function () {
        change(Number(node.id.charAt(1)), node.id.charAt(0), Number(node.getAttribute('data-delta')));
      });
    });
    [1, 2].forEach(function (i) {
      handles[i].addEventListener('keydown', function (event) {
        var k = event.key;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) < 0) return;
        event.preventDefault();
        if (k === 'Home') { s['b' + i] = -4; ctx.sfx('tick'); update(); } else if (k === 'End') { s['b' + i] = 4; ctx.sfx('tick'); update(); }
        else change(i, 'b', k === 'ArrowRight' || k === 'ArrowUp' ? 1 : -1);
      });
      ctx.drag(handles[i], {
        move: function (x, y) {
          s['b' + i] = clamp(Math.round((OY - y) / UNIT - s['m' + i] * HX[i]), -4, 4);
          update();
        },
        end: function () { update(); }
      });
    });
    function verdict(claim) {
      var real = kind();
      if (claim === real) {
        var fresh = !got[real];
        got[real] = true;
        var texts = {
          one: 'נכון: שיפועים שונים, ולכן הישרים נחתכים בנקודה אחת. הנקודה הזאת מתאימה לשתי המשוואות.',
          none: 'נכון: אותו שיפוע וחותכים שונים. הישרים מקבילים, והמרחק ביניהם לא משתנה, אז אין נקודה משותפת.',
          inf: 'נכון: אותו שיפוע ואותו חותך. זה אותו ישר, וכל נקודה עליו מתאימה לשתי המשוואות.'
        };
        ctx.sfx('correct');
        update(texts[real] + (fresh ? '' : ' את המקרה הזה כבר סיווגת. נסה מצב אחר.'), 'good');
        if (got.one && got.none && got.inf) { ctx.burst(16); ctx.solved(); }
        return;
      }
      ctx.sfx('error');
      var wrong;
      if (real === 'none' && claim === 'one') wrong = 'שני הישרים באותו שיפוע ' + m(num(s.m1)) + ' וחותכים שונים. שיפוע זהה שומר על אותו מרחק לנצח, ולכן הם לא ייפגשו.';
      else if (real === 'none' && claim === 'inf') wrong = 'אינסוף פתרונות יש רק כשהישרים זהים. כאן החותכים שונים, ' + m(num(s.b1)) + ' ו־' + m(num(s.b2)) + ', ולכן אין אף נקודה משותפת.';
      else if (real === 'one') wrong = claim === 'none'
        ? 'השיפועים שונים, ' + m(num(s.m1)) + ' ו־' + m(num(s.m2)) + '. ישרים שאינם מקבילים נפגשים, גם אם הנקודה מחוץ לציור.'
        : 'ישרים עם שיפועים שונים נחתכים רק פעם אחת, ולכן יש פתרון אחד בלבד.';
      else wrong = claim === 'none'
        ? 'זה אותו ישר בדיוק, והוא נוגע בעצמו בכל נקודה. לכן יש אינסוף פתרונות, לא אפס.'
        : 'שני הישרים זהים: אותו שיפוע ואותו חותך. כל נקודה משותפת, לא רק אחת.';
      update(wrong);
    }
    ctx.button(NAMES.one, function () { verdict('one'); }, { id: 'verdictOne', target: 'verdicts' });
    ctx.button(NAMES.none, function () { verdict('none'); }, { id: 'verdictNone' });
    ctx.button(NAMES.inf, function () { verdict('inf'); }, { id: 'verdictInf' });
    update();
  }

  /* ---------- scene 5: substitution ---------- */
  function substScene(ctx) {
    var stage = 0, completed = false;
    CLIP_OF.sA = 'subClip'; CLIP_OF.sB = 'subClip';
    ctx.draw(grid('subClip') + lineTag('sA', C1, false) + lineTag('sB', C2, true)
      + '<g id="subPoint" visibility="hidden"><circle cx="' + posX(3) + '" cy="' + posY(5) + '" r="14" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '" stroke-width="3"/>'
      + '<circle cx="' + posX(3) + '" cy="' + posY(5) + '" r="6" fill="' + PAL.good + '"/>'
      + mathText(posX(3) + 20, posY(5) - 10, '(3, 5)', 17, PAL.good, 'start') + '</g>');
    setLine(ctx.el('sA'), 2, -1); setLine(ctx.el('sB'), -1, 8);
    var box = ctx.extra('<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'
      + '<div style="border:2px solid ' + C1 + ';border-radius:12px;padding:8px 14px;text-align:center"><b style="display:block;font-size:11.5px;color:' + MUTED + '">משוואה ראשונה</b>'
      + '<bdi class="math" dir="ltr" style="font-family:Secular One,sans-serif;font-size:19px;color:' + C1 + '">y = 2x \u2212 1</bdi></div>'
      + '<div style="border:2px solid ' + C2 + ';border-radius:12px;padding:8px 14px;text-align:center"><b style="display:block;font-size:11.5px;color:' + MUTED + '">משוואה שנייה</b>'
      + '<bdi class="math" dir="ltr" style="font-family:Secular One,sans-serif;font-size:19px;color:' + C2 + '">x + y = 8</bdi></div></div>'
      + '<div data-paper aria-live="polite" style="margin-top:10px;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:48px;font-family:Secular One,sans-serif;font-size:18px"></div>');
    ctx.register('paper', box);
    var paper = box.querySelector('[data-paper]');
    var LINES = [
      ['x + 2x \u2212 1 = 8'],
      ['3x \u2212 1 = 8', '3x = 9'],
      ['x = 3'],
      ['y = 2 \u00B7 3 \u2212 1 = 5', '3 + 5 = 8']
    ];
    var shown = [];
    function paintPaper() {
      paper.innerHTML = shown.map(function (t) { return '<bdi class="math" dir="ltr">' + t + '</bdi>'; }).join('');
    }
    function press(k) {
      ctx.sfx('click');
      if (stage >= 4) { ctx.note('כבר בדקת: ' + m('(3, 5)') + ' מתאימה לשתי המשוואות. אפשר להמשיך.', 'good'); return; }
      if (k <= stage) { ctx.note('את הצעד הזה כבר עשית. המשך לצעד הבא בשרשרת.'); return; }
      if (k > stage + 1) {
        var need = ['להציב את ' + m('y') + ' במשוואה השנייה', 'לכנס איברים', 'לחלק ב־' + m('3'), 'לבדוק'][stage];
        ctx.sfx('error'); ctx.note('עוד מוקדם. קודם צריך ' + need + ', ואז אפשר להמשיך.'); return;
      }
      stage = k;
      shown = shown.concat(LINES[k - 1]);
      paintPaper();
      if (k === 1) ctx.note('במשוואה השנייה החלפנו את ' + m('y') + ' ב־' + m('2x \u2212 1') + ', ונשארה משוואה עם ' + m('x') + ' בלבד.');
      else if (k === 2) ctx.note('כינסנו ' + m('x + 2x = 3x') + ', ואז הוספנו ' + m('1') + ' לשני האגפים: ' + m('3x = 9') + '.');
      else if (k === 3) ctx.note('חילקנו שני אגפים ב־' + m('3') + ' ומצאנו ' + m('x = 3') + '. עוד חסר ' + m('y') + ', ואחר כך בודקים בשתי המשוואות.');
      else {
        ctx.el('subPoint').setAttribute('visibility', 'visible');
        ctx.note('נכון: ' + m('2 · 3 \u2212 1 = 5') + ' ו־' + m('3 + 5 = 8') + '. הנקודה ' + m('(3, 5)') + ' מתאימה לשתי המשוואות, והיא בדיוק מקום המפגש בגרף.', 'good');
        ctx.caption('הפתרון: ' + m('(3, 5)'));
        if (!completed) { completed = true; ctx.sfx('correct'); ctx.burst(16); ctx.solved(); }
      }
    }
    ctx.button('הצב את y במשוואה השנייה', function () { press(1); }, { id: 'subStep1', target: 'step1' });
    ctx.button('כנס איברים', function () { press(2); }, { id: 'subStep2' });
    ctx.button('חלק ב־3', function () { press(3); }, { id: 'subStep3' });
    ctx.button('בדוק בשתי המשוואות', function () { press(4); }, { id: 'subStep4' });
    ctx.button('הצב את y גם בראשונה', function () {
      ctx.sfx('error');
      ctx.note('הצבת ' + m('y = 2x \u2212 1') + ' בתוך עצמה ונשארה ' + m('2x \u2212 1 = 2x \u2212 1') + '. זה נכון תמיד, אבל ריק: אין בו מידע על ' + m('x') + '. הצב במשוואה השנייה.');
    }, { id: 'subFirst', ghost: true });
    ctx.caption('מקום המפגש בגרף הוא הפתרון');
    ctx.note('הקש על הכפתורים לפי הסדר: הצבה, כינוס, חלוקה ובדיקה. כל לחיצה כותבת שורה חדשה.');
  }

  var steps = [
    {
      mode: 'intro', tA: 'נקודה אחת, שתי משוואות', sub: 'פתרון של מערכת הוא זוג מספרים אחד שמתאים לשתי המשוואות יחד.',
      tip: 'שלום, אני אליהו. כל משוואה היא ישר, והפתרון הוא המקום שבו הישרים נפגשים.',
      emoji: '🎯', eq: 'נקודה אחת, שתי משוואות',
      note: 'ישר אחד: ' + m('y = x + 1') + '. ישר שני: ' + m('y = \u2212x + 5') + '. הם נפגשים בנקודה ' + m('(2, 3)') + ', והזוג הזה מתאים לשתיהן.',
      cue: 'מוכן להזיז ישרים?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מזיזים עד שנפגשים', sub: 'הזז את הישר השני כך שייפגש עם הראשון ב־' + m('(2, 3)') + '. בגרירה, בכפתורים או בחיצים.',
      tip: 'שנה את ' + m('b') + ' והסתכל לאן זזה נקודת המפגש. אני מחפש בדיוק את ' + m('(2, 3)') + '.',
      aspect: [W, H], alt: 'מערכת צירים מ־6 שלילי עד 6 עם ישר קבוע y שווה x ועוד 1 וישר כתום שנע, y שווה מינוס x ועוד b. עיגול מקווקו מסמן את היעד 2 ו־3',
      cue: 'הזז את הישר עד שהוא עובר דרך היעד', cueDone: 'הישרים נפגשים ביעד. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'stepper', text: 'לחץ על פלוס ומינוס, או על הנקודה הכתומה והחצים, ועקוב אחרי נקודת המפגש.' }, setup: meetScene
    },
    {
      mode: 'quiz', tA: 'מהי נקודת החיתוך של הישרים?',
      sub: m('y = 2x') + ' ו־' + m('y = x + 3') + '. מצא את הנקודה שמתאימה לשתי המשוואות.',
      tip: 'כשהישרים נפגשים, ' + m('y') + ' שווה בשתי המשוואות. השווה בין שני הצדדים.', btn: 'המשך ←',
      win: 'בדיוק. שני הישרים נפגשים בנקודה אחת.', wrongSay: 'בדוק את הזוג בשתי המשוואות ושים לב לסדר.',
      opts: [
        { t: m('(3, 6)'), c: true, f: 'נכון: ' + m('2x = x + 3') + ' נותן ' + m('x = 3') + ', ואז ' + m('y = 6') + '. הזוג מתאים לשתי המשוואות.' },
        { t: m('(3, 3)'), f: 'מצאת ' + m('x = 3') + ' ועצרת. את ' + m('y') + ' מוצאים מהצבה: ' + m('y = 2 · 3 = 6') + '.' },
        { t: m('(6, 3)'), f: 'החלפת בין ' + m('x') + ' ל־' + m('y') + '. בזוג הסדור קודם ' + m('x') + ', ו־' + m('x') + ' כאן הוא ' + m('3') + '.' },
        { t: m('(1, 2)'), f: 'ניחשת מהציור בלי לבדוק. ' + m('y = 2x') + ' מתקיימת, אבל ' + m('1 + 3 = 4') + ' ולא ' + m('2') + '.' }
      ],
      hints: ['בנקודת המפגש ' + m('y') + ' הוא אותו מספר בשתי המשוואות.', 'כתוב ' + m('2x = x + 3') + ' ופתור קודם את ' + m('x') + '.', m('x = 3') + '. הצב אותו באחת המשוואות וחשב את ' + m('y') + '.']
    },
    {
      mode: 'scene', tA: 'אין פתרון, אינסוף פתרונות', sub: 'שנה שיפוע וחותך של כל ישר, בכפתורים, בחיצים או בגרירה. הפק כל מקרה וסווג אותו.',
      tip: 'צריך להפיק שלושה מצבים: נפגשים פעם אחת, לא נפגשים בכלל, או שהישרים זהים. אחרי כל מצב סווג אותו.',
      aspect: [W, H], alt: 'מערכת צירים עם שני ישרים שאפשר לשנות להם שיפוע וחותך: ישר כחול וישר כתום מקווקו. על כל ישר נקודה שמזיזה את החותך',
      cue: 'סווג את שלושת המקרים', cueDone: 'סיווגת את כל שלושת המקרים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'stepper', text: 'שנה את השיפוע של אחד הישרים ובדוק מה קורה לנקודת המפגש.' }, setup: casesScene
    },
    {
      mode: 'quiz', tA: 'כמה פתרונות יש למערכת?',
      sub: m('y = 3x + 2') + ' ו־' + m('y = 3x \u2212 1') + '. קרא את השיפועים ואת החותכים לפני שתענה.',
      tip: 'השווה קודם את השיפועים, ואם הם שווים השווה את החותכים.', btn: 'המשך ←',
      win: 'נכון. אותו שיפוע וחותכים שונים: ישרים מקבילים.', wrongSay: 'בדוק מה אומר השיפוע, ואחר כך החותך.',
      opts: [
        { t: 'אין פתרון', c: true, f: 'נכון: שני השיפועים ' + m('3') + ' והחותכים ' + m('2') + ' ו־' + m('\u22121') + '. הישרים מקבילים ולא ייפגשו.' },
        { t: 'פתרון אחד', f: 'פתרון אחד יש כששיפועים שונים. כאן שניהם ' + m('3') + ', והמרחק בין הישרים נשאר קבוע.' },
        { t: 'אינסוף פתרונות', f: 'אינסוף פתרונות צריכים אותו שיפוע וגם אותו חותך. כאן החותכים שונים, ' + m('2') + ' ו־' + m('\u22121') + '.' },
        { t: m('(0, 2)'), f: 'הנקודה ' + m('(0, 2)') + ' על הישר הראשון, אבל בשני ' + m('y = \u22121') + ' כש־' + m('x = 0') + '. היא לא מתאימה לשתיהן.' }
      ],
      hints: ['השווה את השיפועים של שתי המשוואות.', 'כשהשיפועים שווים, בדוק אם החותכים שווים גם הם.', 'אותו שיפוע וחותכים שונים הם ישרים מקבילים.']
    },
    {
      mode: 'scene', tA: 'פותרים בהצבה', sub: 'הפוך את המערכת לשורות של אלגברה, ובדוק שהנקודה מתאימה לשתי המשוואות.',
      tip: 'משוואה אחת כבר אומרת מה שווה ' + m('y') + '. שים אותו במשוואה השנייה ונשאר רק ' + m('x') + '.',
      aspect: [W, H], alt: 'מערכת צירים עם הישר y שווה 2x פחות 1 והישר הכתום x ועוד y שווה 8. הנקודה 3 ו־5 תידלק כשהבדיקה תצליח',
      cue: 'סיים את שרשרת הצעדים ובדוק את הנקודה', cueDone: 'הנקודה נבדקה בשתי המשוואות. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'step1', text: 'התחל בכפתור הראשון: הצב את ' + m('y') + ' במשוואה השנייה.' }, setup: substScene
    },
    {
      mode: 'quiz', tA: 'פתור את המערכת',
      sub: m('y = x + 4') + ' ו־' + m('2x + y = 10') + '. הצב את ' + m('y') + ' במשוואה השנייה, ואז בדוק את הזוג.',
      tip: 'אחרי שמצאת את ' + m('x') + ', חשב את ' + m('y') + ' ובדוק בשתי המשוואות.', btn: 'המשך ←',
      win: 'מצוין. הצבה וחישוב נותנים את הנקודה.', wrongSay: 'בדוק את הזוג בשתי המשוואות, לא רק באחת.',
      opts: [
        { t: m('(2, 6)'), c: true, f: 'נכון: ' + m('2x + x + 4 = 10') + ' נותן ' + m('x = 2') + ', ' + m('y = 6') + ', ו־' + m('2 · 2 + 6 = 10') + '.' },
        { t: m('(3, 7)'), f: 'הזוג מתאים רק ל־' + m('y = x + 4') + '. ב־' + m('2x + y = 10') + ' מקבלים ' + m('13') + ', לא ' + m('10') + '.' },
        { t: m('(2, 8)'), f: 'חישבת ' + m('y = 10 \u2212 2 = 8') + ' ושכחת את ה־' + m('2') + ' ב־' + m('2x') + '. ב־' + m('2x + y = 10') + ' מחסירים ' + m('4') + ', לא ' + m('2') + '.' },
        { t: m('(6, 2)'), f: 'החלפת בין ' + m('x') + ' ל־' + m('y') + '. בזוג הסדור קודם ' + m('x') + ', ובדיקה ב־' + m('y = x + 4') + ' נותנת ' + m('2 ≠ 10') + '.' }
      ],
      hints: ['שים ' + m('x + 4') + ' במקום ' + m('y') + ' במשוואה השנייה.', m('2x + x + 4 = 10') + ' ואז ' + m('3x = 6') + '.', m('x = 2') + '. את ' + m('y') + ' קבל מ־' + m('y = x + 4') + '.']
    },
    {
      mode: 'quiz', tA: 'שני מנויים', sub: 'מנוי א׳ עולה ' + m('20 ₪') + ' ועוד ' + m('2 ₪') + ' לשעה, ומנוי ב׳ עולה ' + m('8 ₪') + ' ועוד ' + m('5 ₪') + ' לשעה. אחרי כמה שעות המחיר שווה?',
      tip: 'כתוב מחיר לכל מנוי, השווה ביניהם ופתור. אחר כך בדוק בשני המחירים.', btn: 'לסיכום ←',
      win: 'נכון. אחרי ארבע שעות שני המנויים עולים אותו דבר.', wrongSay: 'חשב את המחיר של שני המנויים באותו מספר שעות.',
      opts: [
        { t: m('4') + ' שעות', c: true, f: m('20 + 2 · 4 = 28') + ' ו־' + m('8 + 5 · 4 = 28') + '. שני המחירים שווים.' },
        { t: m('3') + ' שעות', f: 'שגיאת חישוב: אחרי ' + m('3') + ' שעות מנוי א׳ עולה ' + m('26') + ' ומנוי ב׳ ' + m('23') + '. המחירים לא שווים.' },
        { t: m('5') + ' שעות', f: 'אחרי ' + m('5') + ' שעות מנוי א׳ עולה ' + m('30') + ' ומנוי ב׳ ' + m('33') + '. כבר עברנו את נקודת השוויון.' },
        { t: m('6') + ' שעות', f: 'חילקת ' + m('12') + ' ב־' + m('2') + ' והתעלמת מ־' + m('5') + ' השקלים לשעה של מנוי ב׳. צריך לחלק ב־' + m('3') + '.' }
      ],
      hints: ['כתוב ביטוי למחיר של כל מנוי, לפי מספר השעות ' + m('t') + '.', m('20 + 2t = 8 + 5t') + '. העבר איברים כדי שה־' + m('t') + ' יהיה בצד אחד.', m('12 = 3t') + '. חלק את שני האגפים ב־' + m('3') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את מערכת שתי המשוואות', sub: 'הגרף והאלגברה מגיעים לאותה נקודה.',
      tip: 'כל הכבוד. עכשיו אתה יודע לקרוא פתרון מהגרף ולמצוא אותו בהצבה.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'נקודה אחת שמתאימה לשתי המשוואות:',
      formula: 'הפתרון הוא נקודת המפגש של הישרים'
    }
  ];

  window.NoamGame.boot({
    slug: 'shnei-yesharim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'נקודת חיתוך של שני ישרים', math: '(3, 6)' },
      { step: 4, name: 'מספר הפתרונות של מערכת', math: 'm₁ = m₂' },
      { step: 6, name: 'פתרון בהצבה', math: '(2, 6)' },
      { step: 7, name: 'בעיה עם שני מנויים', math: '20 + 2t = 8 + 5t' }
    ],
    bonus: {
      label: 'מכונת המערכות', closeLabel: 'סגור את המכונה', hint: 'בחר x ובדוק אם שתי המשוואות נותנות את אותו y.',
      setup: function (box, ctx) {
        var A = 1, B = 0, S = 0, X0 = 0, pick = 0;
        box.innerHTML = '<div class="bTitle">מכונת המערכות</div><div class="bSub">בחר ערך ל־x ובדוק אם שתי המשוואות נותנות את אותו y.</div>'
          + '<div class="bChip" dir="ltr" data-sys style="display:flex;flex-direction:column;gap:4px;align-items:center;font-size:19px"></div>'
          + '<div class="stepper" dir="ltr">' + unit('bonusX', 'x', 'את x') + '</div>'
          + '<div class="bForms" data-forms></div><div class="bOk" data-ok hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">מערכת חדשה ↻</button>';
        function roll() {
          A = 1 + Math.floor(Math.random() * 3);
          B = Math.floor(Math.random() * 7) - 3;
          X0 = 1 + Math.floor(Math.random() * 5);
          S = X0 + A * X0 + B;
          pick = 0;
          box.querySelector('[data-sys]').innerHTML = '<span dir="ltr">' + lin(A, B) + '</span><span dir="ltr">x + y = ' + S + '</span>';
          show();
        }
        function show() {
          var y1 = A * pick + B, y2 = S - pick;
          box.querySelector('[data-value="bonusX"]').textContent = num(pick);
          box.querySelector('[data-forms]').innerHTML = '<bdi class="math" dir="ltr">y = ' + A + ' \u00B7 ' + num(pick) + (B >= 0 ? ' + ' + B : ' \u2212 ' + Math.abs(B)) + ' = ' + num(y1) + '</bdi>'
            + '<bdi class="math" dir="ltr">y = ' + S + (pick >= 0 ? ' \u2212 ' + pick : ' + ' + Math.abs(pick)) + ' = ' + num(y2) + '</bdi>';
          var ok = box.querySelector('[data-ok]');
          ok.hidden = false;
          if (y1 === y2) {
            ok.style.color = PAL.good;
            ok.innerHTML = 'שתי המשוואות מסכימות: הפתרון הוא ' + bdi(pair(pick, y1)) + '.';
            ctx.sfx('correct');
          } else {
            ok.style.color = BAD;
            ok.innerHTML = 'שתי המשוואות נותנות ' + bdi(num(y1)) + ' ו־' + bdi(num(y2)) + '. הנקודה לא מתאימה לשתיהן, נסה x אחר.';
          }
        }
        box.querySelectorAll('[data-delta]').forEach(function (node) {
          node.addEventListener('click', function () {
            pick = clamp(pick + Number(node.getAttribute('data-delta')), -10, 10);
            ctx.sfx('tick'); show();
          });
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); roll(); });
        roll();
      }
    }
  });
}());
