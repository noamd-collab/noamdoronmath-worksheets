/**
 * משחק המשוואות בשני שלבים — an engine game.
 *
 * The idea: do the same thing to both sides, undo in reverse order (first the
 * adding or subtracting, then the multiplying), and when x stands on both sides
 * take the smaller group of x away first. Always substitute back and check.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var INK = PAL.ink, MAIN = PAL.main, SOFT = PAL.soft, LINE = PAL.line;
  var WARM = PAL.warm, WARM_SOFT = PAL.warmSoft, GOOD = PAL.good;
  var BAD = '#b91c1c', MUTED = '#475569';

  var W = 402, H = 290, PX = 201, PY = 88, BEAM = 110, STR = 76;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function ns(n) { return String(n); }

  /** One side of an equation as text, e.g. sideText(3, 4) is "3x + 4". */
  function sideText(bags, units) {
    var parts = [];
    if (bags > 0) parts.push((bags > 1 ? bags : '') + 'x');
    if (units > 0) parts.push(ns(units));
    return parts.length ? parts.join(' + ') : '0';
  }
  function eqText(md) { return sideText(md.lb, md.lu) + ' = ' + sideText(md.rb, md.ru); }

  /* ---------- the balance drawing (built once, updated in place) ---------- */

  function bagItem(x, y) {
    return '<rect x="' + x + '" y="' + y + '" width="26" height="22" rx="8" fill="' + WARM_SOFT
      + '" stroke="' + WARM + '" stroke-width="1.8"/>'
      + '<path d="M' + (x + 8.5) + ' ' + (y + 6.5) + ' l9 9 m0 -9 l-9 9" stroke="' + INK
      + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
  }
  function unitItem(x, y) {
    return '<rect x="' + x + '" y="' + y + '" width="11" height="11" rx="2" fill="' + MAIN
      + '" stroke="' + INK + '" stroke-width="0.8"/>';
  }

  /** Geometry and markup of one pan: bags on the left of the plate, unit weights after them. */
  function layoutPan(bags, units, bagSlot) {
    var bagCols = bags > 0 ? Math.min(bags, 3) : (bagSlot ? 1 : 0);
    var bagW = bagCols ? bagCols * 29 - 3 : 0;
    var gap = bagW ? 10 : 0;
    var perRow = Math.max(1, Math.floor((154 - bagW - gap + 2) / 13));
    var unitCols = units > 0 ? Math.min(units, perRow) : 2;
    var unitW = unitCols * 13 - 2;
    var bx = -77;
    var ux = bagW ? bx + bagW + gap : -unitW / 2;
    var split = bagW ? bx + bagW + gap / 2 : -80;
    var bagHtml = '', unitHtml = '', i;
    for (i = 0; i < bags; i++) {
      bagHtml += bagItem(bx + (i % 3) * 29, -3 - 22 - Math.floor(i / 3) * 25);
    }
    for (i = 0; i < units; i++) {
      unitHtml += unitItem(ux + (i % perRow) * 13, -3 - 11 - Math.floor(i / perRow) * 13);
    }
    return {
      bagHtml: bagHtml, unitHtml: unitHtml,
      bagRect: { x: -80, y: -62, w: split + 80, h: 64 },
      unitRect: { x: split, y: -62, w: 80 - split, h: 64 }
    };
  }

  function handleMarkup(side, kind, focusable) {
    var id = side + kind;
    if (!focusable) return '<g id="d' + id + '"></g>';
    return '<g id="h' + id + '" tabindex="0" role="slider" aria-label="" aria-valuemin="0" aria-valuemax="1"'
      + ' aria-valuenow="0">'
      + '<rect id="r' + id + '" fill="transparent" rx="8" style="cursor:grab"></rect>'
      + '<g id="d' + id + '" style="pointer-events:none;cursor:default"></g></g>';
  }
  function panMarkup(side, bagHandles) {
    return '<g id="pan' + side + '">'
      + '<path d="M0 0 L-75 ' + STR + ' M0 0 L75 ' + STR + '" stroke="' + LINE + '" stroke-width="2" fill="none"/>'
      + '<rect x="-80" y="' + STR + '" width="160" height="8" rx="4" fill="' + MAIN + '"/>'
      + '<g transform="translate(0 ' + STR + ')">'
      + handleMarkup(side, 'b', bagHandles) + handleMarkup(side, 'u', true)
      + '</g></g>';
  }

  /**
   * The balance. Handles and drawing are created once; set() only changes
   * attributes and the contents of the item groups, so focus and drags survive.
   */
  function makeBalance(ctx, bagHandles) {
    ctx.draw('<rect x="151" y="268" width="100" height="8" rx="4" fill="' + INK + '"/>'
      + '<rect x="196" y="' + PY + '" width="10" height="182" rx="3" fill="' + INK + '"/>'
      + '<line id="beam" x1="91" y1="' + PY + '" x2="311" y2="' + PY + '" stroke="' + INK
      + '" stroke-width="8" stroke-linecap="round"/>'
      + panMarkup('L', bagHandles) + panMarkup('R', bagHandles)
      + '<circle cx="' + PX + '" cy="' + PY + '" r="9" fill="' + WARM + '" stroke="' + INK + '" stroke-width="2"/>');
    var api = { meta: {} };
    function put(id, html) { var e = ctx.el(id); if (e) e.innerHTML = html; }
    function rectOf(id, r, empty) {
      var e = ctx.el(id);
      if (!e) return;
      e.setAttribute('x', r.x); e.setAttribute('y', r.y);
      e.setAttribute('width', r.w); e.setAttribute('height', r.h);
      e.setAttribute('stroke', empty ? LINE : 'none');
      e.setAttribute('stroke-width', '1.6');
      e.setAttribute('stroke-dasharray', empty ? '4 3' : '0');
    }
    function aria(id, label, now, lo, hi) {
      var e = ctx.el(id);
      if (!e) return;
      e.setAttribute('aria-label', label);
      e.setAttribute('aria-valuemin', lo);
      e.setAttribute('aria-valuemax', hi);
      e.setAttribute('aria-valuenow', now);
    }
    function fillPan(side, bags, units) {
      var pan = layoutPan(bags, units, bagHandles);
      put('d' + side + 'b', pan.bagHtml);
      put('d' + side + 'u', pan.unitHtml);
      if (bagHandles) rectOf('r' + side + 'b', pan.bagRect, bags === 0);
      rectOf('r' + side + 'u', pan.unitRect, units === 0);
      var name = side === 'L' ? 'הכף השמאלית' : 'הכף הימנית';
      var mt = api.meta;
      aria('h' + side + 'u', 'משקולות יחידה ב' + name + ': ' + units
        + '. חץ שמאלה או למטה מוריד משקולת משני הצדדים, חץ ימינה או למעלה מוסיף משקולת לשני הצדדים',
      units, mt[side + 'u'] ? mt[side + 'u'][0] : 0, mt[side + 'u'] ? mt[side + 'u'][1] : units);
      if (bagHandles) {
        aria('h' + side + 'b', 'שקי איקס ב' + name + ': ' + bags
          + '. חץ שמאלה או למטה מוריד איקס אחד משני הצדדים, חץ ימינה או למעלה מחזיר איקס אחד לשני הצדדים',
        bags, mt[side + 'b'] ? mt[side + 'b'][0] : 0, mt[side + 'b'] ? mt[side + 'b'][1] : bags);
      }
    }
    api.set = function (md, angle) {
      var a = (angle || 0) * Math.PI / 180;
      var dx = BEAM * Math.cos(a), dy = BEAM * Math.sin(a);
      var lx = PX - dx, ly = PY + dy, rx = PX + dx, ry = PY - dy;
      var beam = ctx.el('beam');
      beam.setAttribute('x1', lx); beam.setAttribute('y1', ly);
      beam.setAttribute('x2', rx); beam.setAttribute('y2', ry);
      ctx.el('panL').setAttribute('transform', 'translate(' + lx + ' ' + ly + ')');
      ctx.el('panR').setAttribute('transform', 'translate(' + rx + ' ' + ry + ')');
      fillPan('L', md.lb, md.lu);
      fillPan('R', md.rb, md.ru);
    };
    return api;
  }

  /** Keys and pointer drag on one handle. dir is -1 to take away, +1 to give back. */
  function wireHandle(ctx, id, act) {
    var handle = ctx.el('h' + id), body = ctx.el('d' + id);
    if (!handle || !body) return;
    handle.addEventListener('keydown', function (event) {
      var dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (!dir) return;
      event.preventDefault();
      act(dir);
    });
    var sx = 0, sy = 0, mx = 0, my = 0;
    ctx.drag(handle, {
      start: function (x, y) { sx = x; sy = y; mx = 0; my = 0; },
      move: function (x, y) {
        mx = x - sx; my = y - sy;
        body.setAttribute('transform', 'translate(' + mx + ' ' + my + ')');
      },
      end: function () {
        body.removeAttribute('transform');
        if (Math.hypot(mx, my) > 30) act(-1);
      }
    });
  }

  function stepperHtml(units) {
    return '<div class="stepper" dir="ltr">' + units.map(function (u) {
      return '<div class="unit" dir="ltr">'
        + '<button type="button" dir="ltr" id="' + u.id + 'Minus" aria-label="' + u.minus + '">\u2212' + u.sym + '</button>'
        + '<span dir="rtl" style="font:700 13px Heebo,sans-serif;color:' + INK + '">' + u.label + '</span>'
        + '<button type="button" dir="ltr" id="' + u.id + 'Plus" aria-label="' + u.plus + '">+' + u.sym + '</button></div>';
    }).join('') + '</div>';
  }

  function inactive(btn, off) {
    if (off) { btn.setAttribute('aria-disabled', 'true'); btn.style.opacity = '0.55'; }
    else { btn.removeAttribute('aria-disabled'); btn.style.opacity = ''; }
  }

  /* ---------- scene 1: 3x + 4 = 19 ---------- */
  function twoStepScene(ctx) {
    var k = 0, divided = false, solvedOnce = false;
    var bal = makeBalance(ctx, false);
    bal.meta = { Lu: [0, 8], Ru: [15, 23] };
    var strip = ctx.extra(stepperHtml([{ id: 's1', sym: '1', label: 'משני הצדדים',
      minus: 'הורד משקולת יחידה אחת משני הצדדים', plus: 'הוסף משקולת יחידה אחת לשני הצדדים' }]));
    var minus = strip.querySelector('#s1Minus'), plus = strip.querySelector('#s1Plus');
    ctx.register('s1Minus', minus);

    function model() {
      return divided ? { lb: 1, lu: 0, rb: 0, ru: 5 } : { lb: 3, lu: 4 - k, rb: 0, ru: 19 - k };
    }
    function show(angle) {
      var md = model();
      bal.set(md, angle || 0);
      ctx.caption(m(eqText(md)));
      minus.disabled = divided || k >= 4;
      plus.disabled = divided || k <= -4;
      inactive(divBtn, divided || md.lu > 0);
    }
    function wobble() {
      ctx.tween(450, function (l) { bal.set(model(), 3 * Math.sin(l * Math.PI * 3) * (1 - l)); })
        .then(function () { show(0); });
    }
    function act(dir) {
      if (divided) {
        ctx.sfx('error');
        ctx.note('אחרי החילוק המשוואה היא ' + m('x = 5') + '. כדי לנסות דרך אחרת לחץ על "התחל מחדש".');
        return;
      }
      var next = k - dir;
      if (next > 4 || next < -4) {
        ctx.sfx('error');
        ctx.note(next > 4 ? 'בצד השמאלי כבר אין יחידות להוריד.' : 'זה מספיק יחידות. מורידים, לא מוסיפים.');
        return;
      }
      k = next;
      ctx.sfx('tick');
      var md = model();
      if (dir < 0) {
        ctx.note('הורדת ' + m('1') + ' משני הצדדים והמאזניים נשארו ישרים: ' + m(eqText(md)) + '.'
          + (md.lu === 0 ? ' נשארו רק שקי ' + m('x') + '. עכשיו אפשר לחלק.' : ''));
      } else {
        ctx.note('הוספת ' + m('1') + ' לשני הצדדים. המשוואה נכונה, אבל ה־' + m('x') + ' מרוחק יותר. כדי לבודד אותו מורידים את היחידות.');
      }
      wobble();
    }
    minus.addEventListener('click', function () { act(-1); });
    plus.addEventListener('click', function () { act(1); });
    wireHandle(ctx, 'Lu', act);
    wireHandle(ctx, 'Ru', act);

    var divBtn = ctx.button(m('\u00F73') + ' לשני הצדדים', function () {
      if (divided) return;
      var md = model();
      if (md.lu > 0) {
        ctx.sfx('error');
        ctx.note('חילוק ב־' + m('3') + ' חייב לחלק את כל האגף, גם את ' + m(ns(md.lu)) + '. '
          + (md.lu % 3 ? m(ns(md.lu) + ' \u00F7 3') + ' אינו מספר שלם. ' : '')
          + 'קודם מורידים את היחידות משני הצדדים, ורק אחר כך מחלקים.');
        return;
      }
      divided = true;
      ctx.sfx('click');
      ctx.note('חילקנו את שני הצדדים ב־' + m('3') + ': ' + m('3x \u00F7 3 = x') + ' ו־' + m('15 \u00F7 3 = 5')
        + '. נשאר ' + m('x = 5') + '. עכשיו לחץ על "בדוק פתרון".');
      wobble();
    }, { id: 'divBtn', target: 'divBtn', ghost: true });
    ctx.button('בדוק פתרון', function () {
      var md = model();
      if (divided) {
        ctx.sfx('correct');
        ctx.note('מציבים ' + m('x = 5') + ' במשוואה המקורית: ' + m('3 \u00B7 5 + 4 = 15 + 4 = 19') + '. יצא ' + m('19') + ', כמו בצד הימני. הפתרון נכון.', 'good');
        if (!solvedOnce) {
          solvedOnce = true;
          ctx.burst(18);
          ctx.say('קודם הורדת את ה־' + m('4') + ', ורק אחר כך חילקת. כך מבטלים בסדר הפוך.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      } else if (md.lu > 0) {
        ctx.sfx('error');
        ctx.note('עוד לא בודדת את ' + m('x') + ': נשארו ' + m(ns(md.lu)) + ' יחידות ליד השקים. הורד אותן משני הצדדים, ואז חלק.');
      } else {
        ctx.sfx('error');
        ctx.note('נשאר ' + m('3x = 15') + '. יש שלושה שקים, ולכן צריך עוד צעד: חלק את שני הצדדים ב־' + m('3') + '.');
      }
    }, { id: 'chkBtn', target: 'chkBtn' });
    ctx.button('התחל מחדש', function () {
      k = 0; divided = false;
      ctx.sfx('click');
      ctx.note('חזרנו להתחלה: שלושה שקי ' + m('x') + ' וארבע יחידות מול תשע עשרה יחידות.');
      show(0);
    }, { id: 'resetBtn', ghost: true });
    show(0);
    ctx.note('משמאל שלושה שקי ' + m('x') + ' וארבע יחידות, מימין תשע עשרה יחידות. מה מורידים קודם?');
  }

  /* ---------- scene 3: 5x + 2 = 2x + 11 ---------- */
  function bothSidesScene(ctx) {
    var r = 0, k = 0, divided = false, solvedOnce = false, locked = false;
    var bal = makeBalance(ctx, true);
    bal.meta = { Lb: [3, 5], Rb: [0, 2], Lu: [0, 5], Ru: [9, 14] };
    var strip = ctx.extra(stepperHtml([
      { id: 's3x', sym: 'x', label: 'משני הצדדים', minus: 'הורד איקס אחד משני הצדדים', plus: 'החזר איקס אחד לשני הצדדים' },
      { id: 's3u', sym: '1', label: 'משני הצדדים', minus: 'הורד משקולת יחידה אחת משני הצדדים', plus: 'הוסף משקולת יחידה אחת לשני הצדדים' }
    ]));
    var xMinus = strip.querySelector('#s3xMinus'), xPlus = strip.querySelector('#s3xPlus');
    var uMinus = strip.querySelector('#s3uMinus'), uPlus = strip.querySelector('#s3uPlus');
    ctx.register('s3xMinus', xMinus);

    function model() {
      return divided ? { lb: 1, lu: 0, rb: 0, ru: 3 } : { lb: 5 - r, lu: 2 - k, rb: 2 - r, ru: 11 - k };
    }
    function show(angle) {
      var md = model();
      bal.set(md, angle || 0);
      ctx.caption(m(eqText(md)));
      xMinus.disabled = divided || r >= 2;
      xPlus.disabled = divided || r <= 0;
      uMinus.disabled = divided || k >= 2;
      uPlus.disabled = divided || k <= -3;
      inactive(divBtn, divided || r < 2 || md.lu > 0);
    }
    function wobble() {
      ctx.tween(450, function (l) { bal.set(model(), 3 * Math.sin(l * Math.PI * 3) * (1 - l)); })
        .then(function () { show(0); });
    }
    function afterDivide() {
      ctx.sfx('error');
      ctx.note('אחרי החילוק המשוואה היא ' + m('x = 3') + '. כדי לנסות דרך אחרת לחץ על "התחל מחדש".');
    }
    function actX(dir) {
      if (locked) return;
      if (divided) { afterDivide(); return; }
      var next = r - dir;
      if (next > 2) {
        ctx.sfx('error');
        ctx.note('בצד הימני כבר אין ' + m('x') + ' להוריד. אפשר להוריד לכל היותר ' + m('2x') + ' משני הצדדים, הקבוצה הקטנה יותר.');
        return;
      }
      if (next < 0) {
        ctx.sfx('error');
        ctx.note('כבר החזרת את כל שקי ה־' + m('x') + '. אלה הם השקים של המשוואה המקורית.');
        return;
      }
      r = next;
      ctx.sfx('tick');
      var md = model();
      ctx.note((dir < 0 ? 'הורדת ' : 'החזרת ') + m('x') + ' אחד משני הצדדים והמאזניים נשארו ישרים: ' + m(eqText(md)) + '.');
      wobble();
    }
    function actU(dir) {
      if (locked) return;
      if (divided) { afterDivide(); return; }
      var next = k - dir;
      if (next > 2 || next < -3) {
        ctx.sfx('error');
        ctx.note(next > 2 ? 'בצד השמאלי כבר אין יחידות להוריד.' : 'זה מספיק יחידות. מורידים, לא מוסיפים.');
        return;
      }
      k = next;
      ctx.sfx('tick');
      ctx.note((dir < 0 ? 'הורדת ' : 'הוספת ') + m('1') + (dir < 0 ? ' משני הצדדים: ' : ' לשני הצדדים: ') + m(eqText(model())) + '.');
      wobble();
    }
    xMinus.addEventListener('click', function () { actX(-1); });
    xPlus.addEventListener('click', function () { actX(1); });
    uMinus.addEventListener('click', function () { actU(-1); });
    uPlus.addEventListener('click', function () { actU(1); });
    wireHandle(ctx, 'Lb', actX);
    wireHandle(ctx, 'Rb', actX);
    wireHandle(ctx, 'Lu', actU);
    wireHandle(ctx, 'Ru', actU);

    ctx.button('הורד ' + m('2x') + ' משני הצדדים', function () {
      if (locked) return;
      if (divided) { afterDivide(); return; }
      if (r === 2) {
        ctx.note('כבר הורדנו ' + m('2x') + ' משני הצדדים. עכשיו מורידים את היחידות.');
        return;
      }
      r = 2;
      ctx.sfx('click');
      ctx.note('הורדנו את הקבוצה הקטנה, ' + m('2x') + ', משני הצדדים. ה־' + m('x') + ' נשאר רק בצד אחד: ' + m(eqText(model())) + '.');
      wobble();
    }, { id: 'rm2x', target: 'rm2x' });
    var divBtn = ctx.button(m('\u00F73') + ' לשני הצדדים', function () {
      if (locked || divided) return;
      var md = model();
      if (r < 2) {
        ctx.sfx('error');
        ctx.note('עדיין יש ' + m('x') + ' בשני האגפים. קודם מורידים את ' + m('2x') + ' משני הצדדים, ואחר כך את היחידות. רק אז מחלקים.');
        return;
      }
      if (md.lu > 0) {
        ctx.sfx('error');
        ctx.note('חילוק ב־' + m('3') + ' חייב לחלק את כל האגף, גם את ' + m(ns(md.lu)) + '. קודם מורידים את היחידות משני הצדדים.');
        return;
      }
      divided = true;
      ctx.sfx('click');
      ctx.note('חילקנו את שני הצדדים ב־' + m('3') + ': ' + m('3x \u00F7 3 = x') + ' ו־' + m('9 \u00F7 3 = 3')
        + '. נשאר ' + m('x = 3') + '. עכשיו לחץ על "בדוק פתרון".');
      wobble();
    }, { id: 'divBtn3', target: 'divBtn3', ghost: true });
    ctx.button('בדוק פתרון', function () {
      if (locked) return;
      var md = model();
      if (divided) {
        ctx.sfx('correct');
        ctx.note('מציבים ' + m('x = 3') + ' במשוואה המקורית: ' + m('5 \u00B7 3 + 2 = 17') + ' ו־' + m('2 \u00B7 3 + 11 = 17') + '. שני הצדדים שווים, הפתרון נכון.', 'good');
        if (!solvedOnce) {
          solvedOnce = true;
          ctx.burst(18);
          ctx.say('הורדת קודם את הקבוצה הקטנה של ' + m('x') + ', ואחר כך את היחידות, ואז חילקת. כל צעד היה לשני הצדדים.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      } else if (r < 2) {
        ctx.sfx('error');
        ctx.note('עדיין יש ' + m('x') + ' בשני האגפים. הורד את ' + m('2x') + ' משני הצדדים.');
      } else if (md.lu > 0) {
        ctx.sfx('error');
        ctx.note('נשארו ' + m(ns(md.lu)) + ' יחידות ליד ה־' + m('x') + '. הורד אותן משני הצדדים.');
      } else {
        ctx.sfx('error');
        ctx.note('נשאר ' + m('3x = 9') + '. עוד צעד: חלק את שני הצדדים ב־' + m('3') + '.');
      }
    }, { id: 'chkBtn3', target: 'chkBtn3' });
    ctx.button('נסה להוריד x מצד אחד בלבד', function () {
      if (locked) return;
      if (divided) { afterDivide(); return; }
      var md = model();
      var tmp = { lb: md.lb - 1, lu: md.lu, rb: md.rb, ru: md.ru };
      locked = true;
      ctx.busy(true);
      ctx.sfx('error');
      ctx.tween(500, function (l) { bal.set(tmp, -9 * window.NoamGame.ez(l)); }).then(function () {
        ctx.note('הורדת ' + m('x') + ' רק מהכף השמאלית, והמאזניים נטו: הצד הימני כבד יותר. כשעושים פעולה בצד אחד בלבד המשוואה כבר לא נכונה. מחזירים את ה־' + m('x') + '.');
        return ctx.wait(1500);
      }).then(function () {
        return ctx.tween(500, function (l) { bal.set(tmp, -9 * (1 - window.NoamGame.ez(l))); });
      }).then(function () {
        locked = false;
        ctx.busy(false);
        show(0);
      });
    }, { id: 'oneSide', ghost: true });
    ctx.button('התחל מחדש', function () {
      if (locked) return;
      r = 0; k = 0; divided = false;
      ctx.sfx('click');
      ctx.note('חזרנו להתחלה: ' + m('5x + 2 = 2x + 11') + '.');
      show(0);
    }, { id: 'resetBtn3', ghost: true });
    show(0);
    ctx.note('משמאל חמישה שקי ' + m('x') + ' ושתי יחידות, מימין שני שקי ' + m('x') + ' ואחת עשרה יחידות. הורד קודם את הקבוצה הקטנה של ' + m('x') + '.');
  }

  /* ---------- scene 5: special cases ---------- */
  var CARDS = [
    { eq: '2x + 5 = 3x + 1', lines: ['5 = x + 1', 'x = 4'], kind: 'one' },
    { eq: '2x + 5 = 2x + 9', lines: ['5 = 9'], kind: 'none' },
    { eq: '2x + 5 = 2x + 5', lines: ['5 = 5'], kind: 'all' }
  ];
  var VERDICT_NAME = { one: 'פתרון אחד', none: 'אין פתרון', all: 'אינסוף פתרונות' };
  var WRONG = {
    0: {
      none: 'אחרי שמורידים ' + m('2x') + ' נשאר ' + m('5 = x + 1') + ', וה־' + m('x') + ' לא נעלם. אפשר לפתור: ' + m('x = 4') + '. בדיקה: ' + m('2 \u00B7 4 + 5 = 13') + ' ו־' + m('3 \u00B7 4 + 1 = 13') + '.',
      all: 'כשנשאר ' + m('5 = x + 1') + ', רק מספר אחד מתאים: ' + m('x = 4') + '. אינסוף פתרונות יש רק כשה־' + m('x') + ' נעלם ונשארת אמירה נכונה.'
    },
    1: {
      one: 'קרא מה נשאר אחרי שה־' + m('x') + ' נעלם: ' + m('5 = 9') + '. זו אמירה שקרית, ולכן אף ערך של ' + m('x') + ' לא יתקן אותה. אין פתרון.',
      all: 'נשארה ' + m('5 = 9') + ', אמירה שקרית. אמירה שקרית פירושה שאף מספר לא מתאים, לא שכל מספר מתאים.'
    },
    2: {
      one: 'ה־' + m('x') + ' נעלם ונשארה ' + m('5 = 5') + '. אין ערך אחד מיוחד: אותה אמירה נכונה לכל ' + m('x') + '.',
      none: 'נשארה ' + m('5 = 5') + ', אמירה נכונה. אמירה נכונה פירושה שכל מספר מתאים, לא שאין אף אחד.'
    }
  };

  function cardDrawing(index, simplified, status) {
    var card = CARDS[index];
    var out = '<rect x="14" y="10" width="374" height="176" rx="16" fill="#ffffff" stroke="' + LINE + '" stroke-width="2"/>'
      + '<text x="201" y="38" text-anchor="middle" font-family="Heebo, sans-serif" font-size="14" font-weight="700" fill="' + MUTED + '">כרטיס ' + (index + 1) + ' מתוך 3</text>'
      + '<text x="201" y="82" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="32" fill="' + INK + '">' + card.eq + '</text>';
    if (simplified) {
      out += '<text x="201" y="108" text-anchor="middle" font-family="Heebo, sans-serif" font-size="13" fill="' + MUTED + '">אחרי הסרת הקבוצה הקטנה משני הצדדים:</text>';
      if (card.lines.length === 2) {
        out += '<text x="201" y="142" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="28" fill="' + MAIN + '">' + card.lines[0] + '</text>'
          + '<text x="201" y="174" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="24" fill="' + MAIN + '">' + card.lines[1] + '</text>';
      } else {
        out += '<text x="201" y="152" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="34" fill="' + MAIN + '">' + card.lines[0] + '</text>';
      }
    } else {
      out += '<text x="201" y="132" text-anchor="middle" font-family="Heebo, sans-serif" font-size="14" fill="' + MUTED + '">הסר קודם את הקבוצה הקטנה של איקס, ואז קרא מה נשאר</text>';
    }
    for (var i = 0; i < 3; i++) {
      out += '<circle cx="' + (181 + i * 20) + '" cy="208" r="7" fill="' + (status[i] ? GOOD : '#ffffff') + '" stroke="'
        + (i === index ? INK : LINE) + '" stroke-width="' + (i === index ? 3 : 1.6) + '"/>';
    }
    return out;
  }

  function casesScene(ctx) {
    var cur = 0, simp = [false, false, false], right = [false, false, false], finished = false;
    var vbtn = {};
    function draw() {
      ctx.draw(cardDrawing(cur, simp[cur], right));
      ctx.caption(m(CARDS[cur].eq));
      Object.keys(vbtn).forEach(function (key) {
        vbtn[key].setAttribute('aria-pressed', String(right[cur] && CARDS[cur].kind === key));
      });
      prev.disabled = cur === 0;
      next.disabled = cur === 2;
      inactive(simpBtn, simp[cur]);
    }
    function go(step) {
      cur = clamp(cur + step, 0, 2);
      ctx.sfx('click');
      draw();
      ctx.note(right[cur]
        ? 'את הכרטיס הזה כבר סיווגת: ' + VERDICT_NAME[CARDS[cur].kind] + '.'
        : 'כרטיס ' + (cur + 1) + ': הסר את הקבוצה הקטנה של ' + m('x') + ' משני הצדדים ואז קרא מה נשאר.');
    }
    var prev = ctx.button('כרטיס קודם', function () { go(-1); }, { id: 'cPrev', ghost: true });
    var next = ctx.button('כרטיס הבא', function () { go(1); }, { id: 'cNext', ghost: true, target: 'cNext' });
    var simpBtn = ctx.button('הורד ' + m('2x') + ' משני הצדדים', function () {
      if (simp[cur]) {
        ctx.note('כבר הורדנו ' + m('2x') + ' משני הצדדים. קרא מה נשאר ובחר.');
        return;
      }
      simp[cur] = true;
      ctx.sfx('click');
      draw();
      if (cur === 0) ctx.note('אחרי שמורידים ' + m('2x') + ' משני הצדדים נשאר ' + m('5 = x + 1') + '. ה־' + m('x') + ' עדיין כאן. מה זה אומר על מספר הפתרונות?');
      else ctx.note('אחרי שמורידים ' + m('2x') + ' משני הצדדים נשאר ' + m(CARDS[cur].lines[0]) + '. ה־' + m('x') + ' נעלם. האם האמירה שנשארה נכונה?');
    }, { id: 'cSimp', target: 'cSimp' });
    [['one', 'vOne'], ['none', 'vNone'], ['all', 'vAll']].forEach(function (pair) {
      vbtn[pair[0]] = ctx.button(VERDICT_NAME[pair[0]], function () {
        if (right[cur]) {
          ctx.note('את הכרטיס הזה כבר סיווגת נכון. עבור לכרטיס הבא.');
          return;
        }
        if (!simp[cur]) {
          ctx.sfx('error');
          ctx.note('קודם הורד ' + m('2x') + ' משני הצדדים וקרא מה נשאר, ורק אחר כך בחר.');
          return;
        }
        if (CARDS[cur].kind !== pair[0]) {
          ctx.sfx('error');
          ctx.note(WRONG[cur][pair[0]]);
          return;
        }
        right[cur] = true;
        ctx.sfx('correct');
        draw();
        var left = right.filter(function (v) { return !v; }).length;
        if (left > 0) {
          ctx.note('נכון: ' + VERDICT_NAME[pair[0]] + '. נשארו עוד ' + (left === 1 ? 'כרטיס אחד' : 'שני כרטיסים') + '. לחץ על "כרטיס הבא" או "כרטיס קודם".', 'good');
        } else if (!finished) {
          finished = true;
          ctx.note('שלושת הכרטיסים סווגו נכון. כשה־' + m('x') + ' נעלם, קוראים את מה שנשאר: אמירה שקרית היא אין פתרון, ואמירה נכונה היא אינסוף פתרונות.', 'good');
          ctx.burst(18);
          ctx.say('קראת מה נשאר אחרי שה־' + m('x') + ' נעלם. זה כל הסוד.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      }, { id: pair[1], ghost: true, target: pair[1] });
    });
    draw();
    ctx.note('כרטיס 1: הסר את הקבוצה הקטנה של ' + m('x') + ' משני הצדדים ואז קרא מה נשאר. עבור בין הכרטיסים בכפתורים.');
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'משוואה בשני שלבים',
      sub: 'מבטלים את הפעולות בסדר הפוך, ובכל צעד עושים אותו דבר לשני הצדדים.',
      tip: 'שלום, אני אליהו. הפעם צריך שני צעדים כדי לבודד את ' + m('x') + ', ולפעמים ' + m('x') + ' עומד בשני האגפים.',
      emoji: '⚖️',
      eq: m('3x + 4 = 19'),
      note: 'קודם מורידים את ה־' + m('4') + ', ואחר כך מחלקים ב־' + m('3') + '. בסוף מציבים בחזרה ובודקים.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'שני שלבים',
      sub: 'המטרה: ' + m('x = 5') + '. הורד משקולות משני הצדדים בגרירה, בכפתורים או בחיצים, חלק ב־' + m('3') + ' ובדוק.',
      tip: 'קודם מורידים את ה־' + m('4') + ' משני הצדדים, ורק אחר כך מחלקים.',
      cue: 'הגע ל־' + m('x = 5') + ' ולחץ על בדוק פתרון',
      cueDone: 'הפתרון נבדק ונכון. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מאזניים: בכף השמאלית שלושה שקי איקס וארבע משקולות יחידה, בכף הימנית תשע עשרה משקולות יחידה',
      nudge: { target: 's1Minus', text: 'לחץ על מינוס אחד כדי להוריד משקולת משני הצדדים.' },
      setup: twoStepScene
    },
    {
      mode: 'quiz',
      tA: 'פתור: ', tM: '2x + 3 = 11',
      sub: 'שני צעדים: קודם הפעולה ההפוכה לחיבור, ואז הפעולה ההפוכה לכפל.',
      tip: 'התחל מה־' + m('3') + ' שליד ה־' + m('x') + '.',
      btn: 'המשך ←',
      win: 'נכון. הורדת ' + m('3') + ' וחילקת ב־' + m('2') + ', שניהם בשני הצדדים.',
      wrongSay: 'התחל בלהוריד ' + m('3') + ' משני הצדדים, ואז חלק.',
      opts: [
        { t: m('x = 4'), c: true, f: m('11 \u2212 3 = 8') + ', ואז ' + m('8 \u00F7 2 = 4') + '. בדיקה: ' + m('2 \u00B7 4 + 3 = 11') + '.' },
        { t: m('x = 8'), f: 'עצרת ב־' + m('2x = 8') + '. ' + m('8') + ' הוא ערך של שני שקים, לא של שק אחד. צריך לחלק ב־' + m('2') + '.' },
        { t: m('x = 5.5'), f: 'חילקת את ' + m('11') + ' ב־' + m('2') + ' לפני שהורדת את ' + m('3') + ', ולכן ה־' + m('3') + ' לא חולק. בדיקה: ' + m('2 \u00B7 5.5 + 3 = 14') + ', לא ' + m('11') + '.' },
        { t: m('x = 14'), f: 'חיברת ' + m('3') + ' במקום להוריד: ' + m('11 + 3 = 14') + '. הפעולה ההפוכה לחיבור היא חיסור, ועוד צריך לחלק ב־' + m('2') + '.' }
      ],
      hints: [
        'בטל קודם את החיבור, ואז את הכפל. כל פעולה נעשית בשני הצדדים.',
        'אחרי שמורידים ' + m('3') + ' משני הצדדים מקבלים ' + m('2x = 8') + '.',
        'שני שקים שווים ' + m('8') + '. כמה שווה שק אחד?'
      ]
    },
    {
      mode: 'scene',
      tA: 'x בשני האגפים',
      sub: 'המטרה: ' + m('x = 3') + '. הורד אותו דבר משני האגפים בגרירה, בכפתורים או בחיצים.',
      tip: 'כש־' + m('x') + ' בשני האגפים, מורידים את הקבוצה הקטנה של ' + m('x') + ' משני הצדדים.',
      cue: 'הגע ל־' + m('x = 3') + ' ולחץ על בדוק פתרון',
      cueDone: 'הפתרון נבדק ונכון. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'מאזניים: בכף השמאלית חמישה שקי איקס ושתי משקולות יחידה, בכף הימנית שני שקי איקס ואחת עשרה משקולות יחידה',
      nudge: { target: 'rm2x', text: 'לחץ כדי להוריד את ' + m('2x') + ' משני הצדדים.' },
      setup: bothSidesScene
    },
    {
      mode: 'quiz',
      tA: 'פתור: ', tM: '5x + 2 = 2x + 11',
      sub: 'הורד קודם את הקבוצה הקטנה של ' + m('x') + ', אחר כך את היחידות, ואז חלק.',
      tip: 'את ' + m('2x') + ' מורידים משני הצדדים, לא מוסיפים.',
      btn: 'המשך ←',
      win: 'נכון. ' + m('3x = 9') + ', ולכן ' + m('x = 3') + '.',
      wrongSay: 'הורד ' + m('2x') + ' ואת ' + m('2') + ' משני הצדדים, ואז חלק.',
      opts: [
        { t: m('x = 3'), c: true, f: 'מורידים ' + m('2x') + ' ו־' + m('2') + ' משני הצדדים: ' + m('3x = 9') + '. בדיקה: ' + m('5 \u00B7 3 + 2 = 17') + ' ו־' + m('2 \u00B7 3 + 11 = 17') + '.' },
        { t: m('x = 13'), f: 'חיברת ' + m('11 + 2 = 13') + ' במקום להוריד ולהמשיך. בדיקה: ' + m('5 \u00B7 13 + 2 = 67') + ' ו־' + m('2 \u00B7 13 + 11 = 37') + ', לא שווים.' },
        { t: m('x = 4'), f: 'הגעת נכון ל־' + m('3x = 9') + ', אבל ' + m('9 \u00F7 3 = 3') + ' ולא ' + m('4') + '. בדיקה: ' + m('5 \u00B7 4 + 2 = 22') + ' ו־' + m('2 \u00B7 4 + 11 = 19') + '.' },
        { t: m('x = 2'), f: 'לקחת את ' + m('2') + ' שבצד שמאל, אבל זה מספר חופשי ולא הפתרון. בדיקה: ' + m('5 \u00B7 2 + 2 = 12') + ' ו־' + m('2 \u00B7 2 + 11 = 15') + '.' }
      ],
      hints: [
        'קודם מאחדים את ה־' + m('x') + ' בצד אחד: מורידים את הקבוצה הקטנה משני הצדדים.',
        'אחרי שמורידים ' + m('2x') + ' נשאר ' + m('3x + 2 = 11') + '. עכשיו מורידים ' + m('2') + '.',
        'נשאר ' + m('3x = 9') + '. כמה שווה שק אחד?'
      ]
    },
    {
      mode: 'scene',
      tA: 'מקרים מיוחדים',
      sub: 'לפעמים ה־' + m('x') + ' נעלם. הסר אותו משני הצדדים, קרא מה נשאר וסווג כל כרטיס.',
      tip: 'אחרי שה־' + m('x') + ' נעלם, קרא את מה שנשאר: שקר או אמת?',
      cue: 'סווג את שלושת הכרטיסים נכון',
      cueDone: 'סיווגת את שלושת הכרטיסים נכון. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [402, 224],
      alt: 'כרטיס משוואה אחד מתוך שלושה: שתיים איקס ועוד חמש מול שלוש איקס ועוד אחת, או מול שתיים איקס ועוד תשע, או מול שתיים איקס ועוד חמש. אחרי הסרת שתיים איקס רואים מה נשאר',
      nudge: { target: 'cSimp', text: 'לחץ כדי להוריד ' + m('2x') + ' משני הצדדים ולראות מה נשאר.' },
      setup: casesScene
    },
    {
      mode: 'quiz',
      tA: 'כמה פתרונות יש למשוואה ', tM: '4x + 7 = 4x + 2', tB: ' שלפניך?',
      sub: 'הורד את ' + m('4x') + ' משני הצדדים וקרא מה נשאר.',
      tip: 'כשה־' + m('x') + ' נעלם, בדוק אם האמירה שנשארה נכונה.',
      btn: 'המשך ←',
      win: 'נכון. נשארה ' + m('7 = 2') + ', אמירה שקרית, ולכן אין פתרון.',
      wrongSay: 'הורד ' + m('4x') + ' משני הצדדים ובדוק אם נשארה אמירה נכונה.',
      opts: [
        { t: 'אין פתרון', c: true, f: 'מורידים ' + m('4x') + ' משני הצדדים ונשאר ' + m('7 = 2') + '. זו אמירה שקרית לכל ' + m('x') + ', ולכן אין פתרון.' },
        { t: 'פתרון אחד: ' + m('x = 0'), f: 'בדיקה: ' + m('x = 0') + ' נותן ' + m('7') + ' בצד שמאל ו־' + m('2') + ' בצד ימין. ה־' + m('x') + ' נעלם ולא נשאר ערך אחד.' },
        { t: 'אינסוף פתרונות', f: 'אינסוף פתרונות נשארים כשנשארת אמירה נכונה, כמו ' + m('5 = 5') + '. כאן נשארת ' + m('7 = 2') + ', שקרית.' },
        { t: m('x = \u22121.25'), f: 'חישבת ' + m('4x = 2 \u2212 7') + ' כאילו ה־' + m('4x') + ' בצד ימין לא קיים. בדיקה: שמאל ' + m('4 \u00B7 (\u22121.25) + 7 = 2') + ', ימין ' + m('4 \u00B7 (\u22121.25) + 2 = \u22123') + '. לא שווים.' }
      ],
      hints: [
        'הורד את אותה קבוצה של ' + m('x') + ' משני הצדדים.',
        'נשארת משוואה בלי ' + m('x') + '. האם היא נכונה?',
        'נשארה ' + m('7 = 2') + '. האם יש מספר שהופך אותה לנכונה?'
      ]
    },
    {
      mode: 'quiz',
      tA: 'מהו המספר?',
      sub: 'מספר מוכפל ב־' + m('4') + ' ועוד ' + m('6') + ' שווה לאותו מספר ועוד ' + m('24') + '. מהו המספר?',
      tip: 'כתוב משוואה: אותו מספר מופיע בשני האגפים.',
      btn: 'לסיכום ←',
      win: 'נכון. ' + m('4x + 6 = x + 24') + ', ואז ' + m('3x = 18') + ' ו־' + m('x = 6') + '.',
      wrongSay: 'כתוב ' + m('4x + 6 = x + 24') + ', הורד ' + m('x') + ' ו־' + m('6') + ' משני הצדדים, ואז חלק.',
      opts: [
        { t: m('6'), c: true, f: 'המשוואה ' + m('4x + 6 = x + 24') + ': מורידים ' + m('x') + ' ו־' + m('6') + ' ונשאר ' + m('3x = 18') + '. בדיקה: ' + m('4 \u00B7 6 + 6 = 30') + ' ו־' + m('6 + 24 = 30') + '.' },
        { t: m('10'), f: 'קיבלת ' + m('10') + ' כי הפכת את הסימן של ' + m('6') + ' ופתרת ' + m('4x \u2212 6 = x + 24') + '. בבעיה ' + m('6') + ' מתווסף. בדיקה: ' + m('4 \u00B7 10 + 6 = 46') + ' ו־' + m('10 + 24 = 34') + '.' },
        { t: m('5'), f: 'אחרי שמורידים ' + m('x') + ' ו־' + m('6') + ' נשאר ' + m('3x = 18') + ', לא ' + m('3x = 15') + '. בדיקה: ' + m('4 \u00B7 5 + 6 = 26') + ' ו־' + m('5 + 24 = 29') + '.' },
        { t: m('30'), f: 'חיברת ' + m('6 + 24 = 30') + ', אבל אלה המספרים החופשיים ולא הנעלם. בדיקה: ' + m('4 \u00B7 30 + 6 = 126') + ' ו־' + m('30 + 24 = 54') + '.' }
      ],
      hints: [
        'קרא את הסיפור כמשוואה: ' + m('x') + ' הוא המספר, פעמיים בשני האגפים.',
        'צד אחד: ' + m('4x + 6') + '. הצד השני: ' + m('x + 24') + '.',
        'הורד ' + m('x') + ' ו־' + m('6') + ' משני הצדדים. נשאר ' + m('3x = 18') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את המשוואות בשני שלבים',
      sub: 'שומרים על האיזון: אותה פעולה בשני הצדדים, ומציבים בחזרה כדי לבדוק.',
      tip: 'כל הכבוד. עכשיו אתה יודע לפתור משוואה גם כש־' + m('x') + ' בשני האגפים.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:',
      formula: 'אותו דבר בשני הצדדים, ואז בדיקה: ' + m('3 \u00B7 5 + 4 = 19')
    }
  ];

  window.NoamGame.boot({
    slug: 'maznayim-2',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'פתרון בשני שלבים', math: '2x + 3 = 11' },
      { step: 4, name: 'x בשני האגפים', math: '5x + 2 = 2x + 11' },
      { step: 6, name: 'מקרים מיוחדים', math: '4x + 7 = 4x + 2' },
      { step: 7, name: 'משוואה מסיפור', math: '4x + 6 = x + 24' }
    ],
    bonus: {
      label: 'מכונת המשוואות ⚖️',
      closeLabel: 'סגור את המכונה',
      hint: 'קבל משוואה, בחר את הפתרון ובדוק אותו בהצבה.',
      setup: function (box, ctx) {
        var q = null, guess = 0;
        function coef(c) { return (c === 1 ? '' : String(c)) + 'x'; }
        function pick(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function roll() {
          var x = pick(1, 9), b = pick(1, 9), a;
          if (Math.random() < 0.65) {
            a = pick(2, 6);
            q = { both: false, a: a, b: b, x: x, c: a * x + b };
          } else {
            a = pick(3, 7);
            var d = pick(1, a - 1);
            q = { both: true, a: a, b: b, d: d, x: x, e: b + (a - d) * x };
          }
        }
        function rightValue(v) { return q.both ? q.d * v + q.e : q.c; }
        function leftValue(v) { return q.a * v + q.b; }
        box.innerHTML = '<div class="bTitle">מכונת המשוואות</div>'
          + '<div class="bSub">פתור בראש, בחר את הפתרון ובדוק: המכונה מציבה אותו בשני הצדדים.</div>'
          + '<div class="bChip" data-eq dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr">'
          + '<button type="button" data-d="-1" aria-label="הקטן את הפתרון">\u2212</button>'
          + '<bdi class="math var" dir="ltr">x =</bdi><bdi class="var math" dir="ltr" data-g aria-live="polite">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל את הפתרון">+</button></div></div>'
          + '<div class="bForms" data-forms dir="ltr" hidden></div>'
          + '<div class="bOk" data-ok role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק בהצבה</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">⚖️ משוואה חדשה</button>';
        var chip = box.querySelector('[data-eq]');
        var gEl = box.querySelector('[data-g]');
        var forms = box.querySelector('[data-forms]');
        var ok = box.querySelector('[data-ok]');
        function show() {
          chip.textContent = coef(q.a) + ' + ' + q.b + ' = ' + (q.both ? coef(q.d) + ' + ' + q.e : q.c);
          gEl.textContent = (guess < 0 ? '\u2212' + Math.abs(guess) : String(guess));
          forms.hidden = true;
          ok.hidden = true;
        }
        box.querySelectorAll('[data-d]').forEach(function (b) {
          b.addEventListener('click', function () {
            guess = clamp(guess + Number(b.getAttribute('data-d')), -20, 20);
            ctx.sfx('click');
            show();
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var gl = leftValue(guess), gr = rightValue(guess);
          var shown = guess < 0 ? '(\u2212' + Math.abs(guess) + ')' : String(guess);
          var leftTxt = q.a + ' \u00B7 ' + shown + ' + ' + q.b + ' = ' + gl;
          var rightTxt = q.both ? q.d + ' \u00B7 ' + shown + ' + ' + q.e + ' = ' + gr : String(q.c);
          forms.innerHTML = '<div>' + leftTxt + '</div><div>' + rightTxt + '</div>';
          forms.hidden = false;
          ok.hidden = false;
          if (gl === gr) {
            ctx.sfx('correct');
            ok.style.color = GOOD;
            ok.textContent = 'נכון! שני הצדדים שווים ' + gl + '.';
          } else {
            ctx.sfx('error');
            ok.style.color = BAD;
            ok.textContent = 'עוד לא: בהצבה הצדדים לא שווים (' + gl + ' מול ' + gr + '). נסה ערך אחר.';
          }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () {
          roll();
          guess = 0;
          ctx.sfx('click');
          show();
        });
        roll();
        show();
      }
    }
  });
}());
