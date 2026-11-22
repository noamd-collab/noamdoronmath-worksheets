/** תיבה ומנסרה: שכבות, חיתוך אלכסוני ופריסה של חמש פאות. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c';

  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function halfText(value) { return value % 2 === 0 ? String(value / 2) : value + ' ÷ 2'; }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function mathText(x, y, text, size) {
    return '<text x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 16) + '" text-anchor="middle" fill="' + PAL.ink + '">' + text + '</text>';
  }
  function poly(points, fill, opacity) {
    return '<polygon points="' + points.map(function (pt) { return pt[0] + ',' + pt[1]; }).join(' ') + '" fill="' + fill + '" fill-opacity="' + (opacity || 1) + '" stroke="' + PAL.dark + '" stroke-width="1.8" stroke-linejoin="round"/>';
  }
  function lineSeg(a, b, colour, dash) {
    return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + (colour || PAL.line) + '" stroke-width="1.3"' + (dash ? ' stroke-dasharray="6 4"' : '') + '/>';
  }
  function stepperMarkup(prefix, items) {
    return '<div class="stepper" dir="ltr" style="gap:8px;margin-top:8px">' + items.map(function (it) {
      return '<div class="unit" dir="ltr" style="gap:5px;padding:6px">' + bdi(it.key)
        + '<button type="button" id="' + prefix + it.key + 'Minus" data-key="' + it.key + '" data-d="-1" aria-label="הקטן את ' + it.label + '">−</button>'
        + '<bdi class="var math" dir="ltr" data-val="' + it.key + '" style="min-width:28px" aria-live="polite"></bdi>'
        + '<button type="button" id="' + prefix + it.key + 'Plus" data-key="' + it.key + '" data-d="1" aria-label="הגדל את ' + it.label + '">+</button></div>';
    }).join('') + '</div>';
  }
  function bindSteppers(box, values, ranges, onChange) {
    box.querySelectorAll('[data-d]').forEach(function (btnNode) {
      btnNode.addEventListener('click', function () {
        var key = btnNode.getAttribute('data-key');
        values[key] = clamp(values[key] + Number(btnNode.getAttribute('data-d')), ranges[key][0], ranges[key][1]);
        onChange(true);
      });
    });
  }
  function updateSteppers(box, values, ranges) {
    Object.keys(values).forEach(function (key) {
      var valNode = box.querySelector('[data-val="' + key + '"]');
      if (valNode) valNode.textContent = String(values[key]);
    });
    box.querySelectorAll('[data-d]').forEach(function (btnNode) {
      var key = btnNode.getAttribute('data-key'), delta = Number(btnNode.getAttribute('data-d'));
      btnNode.disabled = delta < 0 ? values[key] <= ranges[key][0] : values[key] >= ranges[key][1];
    });
  }
  function heightMarkup(id, lo, hi, value) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="גובה המנסרה או התיבה; חצים מוסיפים או מורידים שכבה" aria-valuemin="' + lo + '" aria-valuemax="' + hi + '" aria-valuenow="' + value + '" aria-orientation="vertical" style="cursor:grab">'
      + '<rect x="-32" y="-32" width="64" height="64" rx="12" fill="transparent"/>'
      + '<circle r="12" fill="#fff" stroke="' + PAL.dark + '" stroke-width="3"/>'
      + '<path d="M-5 -3 L0 -8 L5 -3 M-5 3 L0 8 L5 3" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/></g>';
  }
  function wireHeight(ctx, id, values, lo, hi, onChange) {
    var handleNode = ctx.el(id), startY = 0, startH = values.H;
    function setHeight(value) { values.H = clamp(value, lo, hi); onChange(true); }
    handleNode.addEventListener('keydown', function (event) {
      var delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (event.key === 'Home') { event.preventDefault(); setHeight(lo); return; }
      if (event.key === 'End') { event.preventDefault(); setHeight(hi); return; }
      if (!delta) return;
      event.preventDefault(); setHeight(values.H + delta);
    });
    ctx.drag(handleNode, {
      start: function (x, y) { startY = y; startH = values.H; },
      move: function (x, y) { setHeight(startH + Math.round((startY - y) / 20)); }
    });
  }
  function placeHeight(ctx, id, x, y, value) {
    var handleNode = ctx.el(id);
    handleNode.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    handleNode.setAttribute('aria-valuenow', String(value));
    handleNode.setAttribute('aria-valuetext', m(String(value)) + ' שכבות או ס״מ, לפי המשימה');
  }

  /* Cabinet projection: unit cubes are square at the front, half-depth behind. */
  function boxDrawing(a, b, height) {
    function pt(x, y, z) { return [65 + x * 25 + y * 12.5, 252 - z * 25 - y * 9]; }
    var front = [pt(0, 0, 0), pt(a, 0, 0), pt(a, 0, height), pt(0, 0, height)];
    var side = [pt(a, 0, 0), pt(a, b, 0), pt(a, b, height), pt(a, 0, height)];
    var top = [pt(0, 0, height), pt(a, 0, height), pt(a, b, height), pt(0, b, height)];
    var html = poly(side, PAL.line) + poly(front, PAL.soft)
      + poly([pt(0, 0, 0), pt(a, 0, 0), pt(a, 0, 1), pt(0, 0, 1)], PAL.warmSoft)
      + poly([pt(a, 0, 0), pt(a, b, 0), pt(a, b, 1), pt(a, 0, 1)], PAL.warmSoft)
      + poly(top, PAL.soft);
    var i;
    for (i = 1; i < a; i++) html += lineSeg(pt(i, 0, 0), pt(i, 0, height), PAL.dark) + lineSeg(pt(i, 0, height), pt(i, b, height), PAL.dark);
    for (i = 1; i < b; i++) html += lineSeg(pt(a, i, 0), pt(a, i, height), PAL.dark) + lineSeg(pt(0, i, height), pt(a, i, height), PAL.dark);
    for (i = 1; i < height; i++) html += lineSeg(pt(0, 0, i), pt(a, 0, i), PAL.dark) + lineSeg(pt(a, 0, i), pt(a, b, i), PAL.dark);
    html += mathText(65 + a * 12.5, 281, 'a = ' + a)
      + mathText(65 + a * 25 + b * 12.5 + 34, 252 - b * 4.5, 'b = ' + b, 14)
      + mathText(32, 252 - height * 12.5 + 6, 'H = ' + height, 18);
    return html;
  }
  function layersScene(ctx) {
    var values = { a: 2, b: 2, H: 2 }, ranges = { a: [1, 6], b: [1, 4], H: [1, 6] };
    var doneOnce = false;
    ctx.draw('<g id="solid"></g>' + heightMarkup('layersHandle', 1, 6, 2));
    var layerBox = ctx.extra('<div class="sceneStrip"><div><b>קוביות בשכבה אחת</b><span dir="ltr" data-base></span></div><div><b>מספר השכבות</b><span dir="ltr" data-height></span></div><div><b>כל הקוביות בתיבה</b><span dir="ltr" data-volume></span></div></div>'
      + stepperMarkup('layers', [{ key: 'a', label: 'האורך' }, { key: 'b', label: 'הרוחב' }, { key: 'H', label: 'מספר השכבות' }]));
    ctx.register('layersControls', layerBox);
    function renderLayers(acted) {
      var baseArea = values.a * values.b, volume = baseArea * values.H;
      ctx.el('solid').innerHTML = boxDrawing(values.a, values.b, values.H);
      placeHeight(ctx, 'layersHandle', 65 + values.a * 12.5 + values.b * 6.25, 252 - values.H * 25 - values.b * 4.5, values.H);
      updateSteppers(layerBox, values, ranges);
      layerBox.querySelector('[data-base]').textContent = 'S = a · b = ' + values.a + ' · ' + values.b + ' = ' + baseArea;
      layerBox.querySelector('[data-height]').textContent = 'H = ' + values.H;
      layerBox.querySelector('[data-volume]').textContent = 'V = S · H = ' + baseArea + ' · ' + values.H + ' = ' + volume;
      ctx.caption('השכבה התחתונה בצבע חם; כל קובייה היא יחידת נפח');
      if (baseArea === 8 && values.H === 3) {
        ctx.note('בנית ' + m('3') + ' שכבות של ' + m('8') + ' קוביות: ' + m('8 · 3 = 24') + '.', 'good');
        if (acted && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (volume === 24) {
        ctx.note('הנפח נכון: ' + m('24') + '. עכשיו בנה בדיוק שלוש שכבות; הבסיס צריך להכיל ' + m('8') + ' קוביות.');
      } else if (values.a === values.b && values.b === values.H) {
        ctx.note('התיבה הזאת היא קובייה: כל המקצועות שווים. ' + m('V = a³ = ' + values.a + '³ = ' + volume) + '. למשימה צריך בדיוק שלוש שכבות ונפח ' + m('24') + '.');
      } else {
        ctx.note('כרגע הנפח ' + m(String(volume)) + '. כוון לבסיס של ' + m('8') + ' קוביות ולשלוש שכבות.');
      }
    }
    bindSteppers(layerBox, values, ranges, renderLayers);
    wireHeight(ctx, 'layersHandle', values, 1, 6, renderLayers);
    renderLayers(false);
  }

  function cutDrawing(p, q, height, cut) {
    function pt(x, y, z) { return [72 + x * 28 + y * 12, 278 - z * 22 - y * 8]; }
    var aa = pt(0, 0, 0), bb = pt(p, 0, 0), cc = pt(0, q, 0), dd = pt(p, q, 0);
    var at = pt(0, 0, height), bt = pt(p, 0, height), ct = pt(0, q, height), dt = pt(p, q, height);
    var html = '';
    if (!cut) html += poly([bb, dd, dt, bt], PAL.line) + poly([at, bt, dt, ct], PAL.soft);
    else html += '<g opacity=".14">' + poly([bb, dd, dt, bt], PAL.line) + poly([bt, dt, ct], PAL.soft) + '</g>';
    html += poly([aa, bb, bt, at], PAL.soft) + poly([aa, cc, ct, at], PAL.line);
    if (cut) html += poly([bb, cc, ct, bt], PAL.soft, 0.86) + poly([at, bt, ct], PAL.warmSoft) + lineSeg(bb, cc, PAL.dark);
    else html += lineSeg(bt, ct, PAL.dark, true) + lineSeg(bb, cc, PAL.dark, true);
    html += '<path d="M' + (aa[0] + 11) + ' ' + aa[1] + ' l0 -7 l-11 -7" stroke="' + PAL.dark + '" fill="none" stroke-width="1.5"/>';
    html += mathText(72 + p * 14, 304, 'p = ' + p)
      + mathText(38, 277 - q * 4, 'q = ' + q, 14)
      + mathText(72 + p * 28 + q * 12 + 34, 278 - q * 8 - height * 11 + 6, 'H = ' + height, 18);
    return html;
  }
  function halfScene(ctx) {
    var values = { p: 2, q: 3, H: 5 }, ranges = { p: [2, 6], q: [2, 6], H: [2, 8] };
    var cut = false, doneOnce = false;
    ctx.draw('<g id="cutSolid"></g>' + heightMarkup('cutHandle', 2, 8, 5));
    var cutBox = ctx.extra('<div class="sceneStrip"><div><b>שטח הבסיס המשולש</b><span dir="ltr" data-base></span></div><div><b>נפח המנסרה אחרי החצייה</b><span dir="ltr" data-volume></span></div></div>'
      + stepperMarkup('cut', [{ key: 'p', label: 'הניצב הראשון' }, { key: 'q', label: 'הניצב השני' }, { key: 'H', label: 'גובה המנסרה' }]));
    ctx.register('cutControls', cutBox);
    function renderHalf(acted) {
      var product = values.p * values.q * values.H, baseArea = values.p * values.q / 2;
      ctx.el('cutSolid').innerHTML = cutDrawing(values.p, values.q, values.H, cut);
      placeHeight(ctx, 'cutHandle', 72 + values.p * 28 / 3 + values.q * 12 / 3, 278 - values.H * 22 - values.q * 8 / 3, values.H);
      updateSteppers(cutBox, values, ranges);
      cutBox.querySelector('[data-base]').textContent = 'S = ' + values.p + ' · ' + values.q + ' ÷ 2 = ' + halfText(values.p * values.q);
      cutBox.querySelector('[data-volume]').textContent = 'V = S · H = ' + (values.p * values.q % 2 ? '(' + halfText(values.p * values.q) + ')' : String(baseArea)) + ' · ' + values.H + ' = ' + halfText(product);
      ctx.caption(cut ? 'נשארה מנסרה משולשת — בדיוק חצי מהתיבה' : 'האלכסון מחלק את הבסיס לשני משולשים חופפים');
      if (product === 60 && cut) {
        ctx.note('שטח הבסיס ' + m(halfText(values.p * values.q)) + ' כפול הגובה ' + m(String(values.H)) + ': נפח המנסרה ' + m('30') + ' סמ״ק.', 'good');
        if (acted && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (product === 30) {
        ctx.note(m('30') + ' הוא נפח התיבה השלמה. המנסרה היא חצי ממנה, ולכן נפחה כאן ' + m('15') + ' סמ״ק. צריך תיבה בנפח ' + m('60') + ' לפני החצייה.');
      } else if (!cut && product === 60) {
        ctx.note('המידות מתאימות. עכשיו לחץ על ״חצה את התיבה״ כדי לקבל מנסרה בנפח ' + m('30') + ' סמ״ק.');
      } else {
        ctx.note('נפח המנסרה יהיה ' + m(halfText(product)) + ' סמ״ק. זכור לחלק את שטח הבסיס לשניים וגם לחצות את התיבה.');
      }
    }
    bindSteppers(cutBox, values, ranges, renderHalf);
    wireHeight(ctx, 'cutHandle', values, 2, 8, renderHalf);
    var cutButton = ctx.button('חצה את התיבה', function () {
      cut = true;
      cutButton.setAttribute('aria-pressed', 'true');
      renderHalf(true);
    }, { id: 'cutBtn', target: 'cutBtn' });
    cutButton.setAttribute('aria-pressed', 'false');
    renderHalf(false);
  }

  /* The net has a 3-4-5 right triangle at each end of its first rectangle. */
  function netScene(ctx) {
    var values = { H: 4 }, ranges = { H: [2, 9] }, unfolded = false;
    var counted = [false, false, false, false, false], doneOnce = false, faceButtons = [];
    var faceNames = ['מלבן ראשון', 'מלבן שני', 'מלבן שלישי', 'בסיס ראשון', 'בסיס שני'];
    ctx.draw('<g id="netBody"></g>' + heightMarkup('netHandle', 2, 9, 4));
    var netBox = ctx.extra('<div class="sceneStrip"><div><b>מעטפת: היקף הבסיס כפול הגובה</b><span dir="ltr" data-lateral></span></div><div><b>שני הבסיסים</b><span dir="ltr">2 · 6 = 12</span></div><div><b>שטח הפנים של כל הפאות</b><span dir="ltr" data-total></span></div><div><b>הסכום שסימנת עד עכשיו</b><span dir="ltr" data-counted aria-live="polite"></span></div></div>'
      + stepperMarkup('net', [{ key: 'H', label: 'גובה המנסרה' }]));
    ctx.register('netControls', netBox);
    function faceArea(index) { return index < 3 ? [3, 4, 5][index] * values.H : 6; }
    function faceFill(index) { return counted[index] ? PAL.goodSoft : index < 3 ? PAL.soft : PAL.warmSoft; }
    function drawNet() {
      var hh = values.H * 20, html = '', xx = 48;
      [3, 4, 5].forEach(function (sideLength, index) {
        var ww = sideLength * 20;
        html += '<g id="netFace' + index + '" tabindex="0" role="button" aria-label="ספור או בטל ספירת ' + faceNames[index] + '" aria-pressed="' + counted[index] + '" style="cursor:pointer">'
          + '<rect x="' + xx + '" y="' + (94 + hh / 2 - Math.max(hh, 64) / 2) + '" width="' + ww + '" height="' + Math.max(hh, 64) + '" fill="transparent"/>'
          + '<rect x="' + xx + '" y="94" width="' + ww + '" height="' + hh + '" fill="' + faceFill(index) + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
          + mathText(xx + ww / 2, 94 + hh / 2 + 6, sideLength + ' · ' + values.H, 15) + '</g>';
        xx += ww;
      });
      [[[[48, 94], [108, 94], [48, 14]], 3, 61], [[[48, 94 + hh], [108, 94 + hh], [48, 174 + hh]], 4, 130 + hh]].forEach(function (entry) {
        html += '<g id="netFace' + entry[1] + '" tabindex="0" role="button" aria-label="ספור או בטל ספירת ' + faceNames[entry[1]] + '" aria-pressed="' + counted[entry[1]] + '" style="cursor:pointer">'
          + poly(entry[0], faceFill(entry[1])) + mathText(65, entry[2], '6', 16) + '</g>';
      });
      html += mathText(228, 60, '3 + 4 + 5 = 12', 18) + mathText(245, 290, 'H = ' + values.H, 18);
      return html;
    }
    function drawFolded() {
      var hh = values.H * 20;
      var aa = [82, 310], bb = [166, 310], cc = [138, 270];
      var at = [82, 310 - hh], bt = [166, 310 - hh], ct = [138, 270 - hh];
      return poly([aa, cc, ct, at], faceFill(1)) + poly([aa, bb, bt, at], faceFill(0))
        + poly([bb, cc, ct, bt], faceFill(2), 0.85) + poly([at, bt, ct], faceFill(3))
        + lineSeg(aa, cc, PAL.dark, true) + lineSeg(cc, bb, PAL.dark, true)
        + mathText(121, 338, '3', 18) + mathText(193, 286, '5', 18)
        + mathText(89, 279, '4', 18) + mathText(42, 310 - hh / 2 + 6, 'H = ' + values.H, 18)
        + '<text x="283" y="215" direction="rtl" font-family="Heebo, sans-serif" font-size="14" text-anchor="middle" fill="' + PAL.ink + '">שני בסיסים זהים</text>'
        + mathText(283, 241, 'S = 6', 18);
    }
    function renderNet(acted) {
      var sum = counted.reduce(function (acc, yes, index) { return acc + (yes ? faceArea(index) : 0); }, 0);
      var count = counted.filter(function (yes) { return yes; }).length;
      ctx.el('netBody').innerHTML = unfolded ? drawNet() : drawFolded();
      placeHeight(ctx, 'netHandle', unfolded ? 363 : 128, unfolded ? 280 - values.H * 16 : 289 - values.H * 20, values.H);
      updateSteppers(netBox, values, ranges);
      netBox.querySelector('[data-lateral]').textContent = '(3 + 4 + 5) · ' + values.H + ' = 12 · ' + values.H + ' = ' + 12 * values.H;
      netBox.querySelector('[data-total]').textContent = '12 · ' + values.H + ' + 12 = ' + (12 * values.H + 12);
      netBox.querySelector('[data-counted]').textContent = String(sum);
      faceButtons.forEach(function (btnNode, index) {
        btnNode.textContent = (counted[index] ? '✓ ' : '') + faceNames[index] + ': ' + m(String(faceArea(index))) + ' סמ״ר';
        btnNode.setAttribute('aria-pressed', String(counted[index]));
      });
      ctx.el('netBody').querySelectorAll('[id^="netFace"]').forEach(function (faceNode) {
        var index = Number(faceNode.id.slice(7));
        faceNode.addEventListener('click', function () { toggleFace(index); });
        faceNode.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault(); toggleFace(index, true);
        });
      });
      ctx.caption('כל פאה נספרת פעם אחת; לחיצה נוספת מבטלת את הסימון');
      if (count === 5 && values.H === 5) {
        ctx.note('ספרת את כל חמש הפאות: מעטפת ' + m('60') + ' ועוד שני בסיסים ' + m('12') + ', יחד ' + m('72') + ' סמ״ר.', 'good');
        if (acted && !doneOnce) { doneOnce = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (count === 4 && (!counted[3] || !counted[4])) {
        ctx.note('חסר משולש אחד. למנסרה יש שני בסיסים, לא בסיס אחד. ספור גם את המשולש השני.');
      } else if (counted[0] && counted[1] && counted[2] && !counted[3] && !counted[4]) {
        ctx.note('ספרת רק את המעטפת: ' + m(String(sum)) + ' סמ״ר. גם שני המשולשים הם פאות; הוסף את שני הבסיסים.');
      } else if (count === 5) {
        ctx.note('כל הפאות נספרו, אבל שטח הפנים ' + m(String(sum)) + ' סמ״ר. כוון את הגובה כך ש־' + m('12 · H + 12 = 72') + '.');
      } else {
        ctx.note('סימנת ' + m(String(count)) + ' פאות. פרוס כדי לראות שלושה מלבנים ושני משולשים, וספור את כולם.');
      }
    }
    function toggleFace(index, restoreFocus) {
      counted[index] = !counted[index]; renderNet(true);
      if (restoreFocus) ctx.el('netFace' + index).focus();
    }
    bindSteppers(netBox, values, ranges, renderNet);
    wireHeight(ctx, 'netHandle', values, 2, 9, renderNet);
    var unfoldButton = ctx.button('פרוס', function () {
      unfolded = !unfolded;
      unfoldButton.textContent = unfolded ? 'קפל' : 'פרוס';
      unfoldButton.setAttribute('aria-pressed', String(unfolded));
      renderNet(true);
    }, { id: 'unfoldBtn', target: 'unfoldBtn' });
    unfoldButton.setAttribute('aria-pressed', 'false');
    faceNames.forEach(function (label, index) {
      faceButtons.push(ctx.button(label, function () { toggleFace(index); }, { id: 'face' + index, ghost: true }));
    });
    renderNet(false);
  }

  var steps = [
    {
      mode: 'intro', tA: 'בונים תיבה ומנסרה', sub: 'שכבה אחת, הרבה שכבות, וחמש פאות שנפתחות לפריסה.',
      tip: 'שלום, אני אליהו. ' + m('S') + ' הוא שטח הבסיס, ו־' + m('H') + ' הוא הגובה. בכל מנסרה כופלים אותם כדי למצוא נפח.',
      emoji: '🧊', eq: m('V = S · H'), note: 'תיבה היא מנסרה. שטח הבסיס אומר כמה קוביות יש בשכבה; הגובה אומר כמה שכבות יש.',
      cue: 'בוא נבנה ונגלה', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'שכבות של קוביות', sub: 'בנה נפח ' + m('24') + ' עם בדיוק ' + m('3') + ' שכבות. שנה מידות בכפתורים; שנה גובה בגרירה, בכפתורים או בחיצים.',
      tip: 'בחר כמה קוביות יש בבסיס וכמה שכבות מעליו. כל שכבה מכילה אותה כמות.',
      aspect: [402, 300], alt: 'תיבה בהיטל אלכסוני עם רשת קוביות יחידה, שכבה תחתונה בצבע חם וידית גובה על הפאה העליונה',
      cue: 'בנה שלוש שכבות ונפח של עשרים וארבע', cueDone: 'שלוש שכבות, שמונה קוביות בכל שכבה. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'layersControls', text: 'שנה את האורך או הרוחב בכפתורים; הגובה משתנה גם בגרירה או בחיצים.' }, setup: layersScene
    },
    {
      mode: 'quiz', tA: 'נפח קובייה', sub: 'צלע של קובייה היא ' + m('3') + ' ס״מ. מה הנפח שלה?',
      tip: 'נפח סופר את הקוביות בכל השכבות, לא רק בפאה אחת.', btn: 'המשך ←',
      win: 'נכון. בקובייה כופלים את הצלע בעצמה שלוש פעמים.', wrongSay: 'הבחן בין שטח של פאה, שטח פנים ונפח.',
      opts: [
        { t: m('27') + ' סמ״ק', c: true, f: 'נכון: ' + m('3 · 3 · 3 = 27') + '. שלוש שכבות, ובכל אחת תשע קוביות.' },
        { t: m('9') + ' סמ״ק', f: m('3 · 3 = 9') + ' הוא שטח של פאה אחת. חסרה הכפלה בגובה כדי למצוא נפח.' },
        { t: m('54') + ' סמ״ק', f: m('6 · 9 = 54') + ' הוא שטח הפנים של הקובייה, לא הנפח שלה.' },
        { t: m('18') + ' סמ״ק', f: 'כפלת את הצלע במספר הפאות: ' + m('3 · 6 = 18') + '. לנפח כופלים אורך, רוחב וגובה.' }
      ],
      hints: ['חשוב על שכבות של קוביות בתוך הקובייה.', 'בכל שכבה יש ' + m('3 · 3') + ' קוביות, ויש שלוש שכבות.', 'חשב ' + m('9 · 3') + '.']
    },
    {
      mode: 'scene', tA: 'חצי תיבה', sub: 'בנה מנסרה בנפח ' + m('30') + ' סמ״ק. שנה מידות בכפתורים וגובה בגרירה, בכפתורים או בחיצים, ואז חצה את התיבה.',
      tip: 'האלכסון חוצה את הבסיס לשני משולשים שווים. כל מנסרה משולשת היא חצי מהתיבה.',
      aspect: [402, 322], alt: 'תיבה עם בסיס מלבני, אלכסון המחלק אותו לשני משולשים ישרי זווית וידית גובה על הפאה העליונה; אחרי חצייה נשארת מנסרה אחת',
      cue: 'בחר מידות מתאימות וחצה את התיבה', cueDone: 'בנית מנסרה בנפח שלושים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'cutBtn', text: 'חשב קודם חצי משטח הבסיס כפול הגובה. כשתהיה מוכן, חצה את התיבה.' }, setup: halfScene
    },
    {
      mode: 'quiz', tA: 'נפח מנסרה משולשת', sub: 'הבסיס הוא משולש ישר־זווית עם ניצבים ' + m('6') + ' ו־' + m('8') + ' ס״מ. גובה המנסרה ' + m('10') + ' ס״מ. מה הנפח?',
      tip: 'קודם מוצאים את שטח המשולש בבסיס, ואז כופלים בגובה המנסרה.', btn: 'המשך ←',
      win: 'בדיוק. חצי מלבן בבסיס, כפול גובה המנסרה.', wrongSay: 'בדוק שחצית את שטח הבסיס ולא עצרת בו.',
      opts: [
        { t: m('480') + ' סמ״ק', f: 'שכחת לחצות את הבסיס: ' + m('6 · 8 · 10 = 480') + ' הוא נפח התיבה השלמה.' },
        { t: m('240') + ' סמ״ק', c: true, f: 'נכון: ' + m('S = 6 · 8 ÷ 2 = 24') + ', ואז ' + m('V = 24 · 10 = 240') + '.' },
        { t: m('24') + ' סמ״ק', f: m('24') + ' הוא שטח הבסיס בלבד, בסמ״ר. כדי למצוא נפח צריך לכפול גם בגובה.' },
        { t: m('140') + ' סמ״ק', f: 'כפלת את סכום הניצבים בגובה: ' + m('(6 + 8) · 10 = 140') + '. נפח משתמש בשטח הבסיס, לא בסכום צלעות.' }
      ],
      hints: ['הבסיס הוא חצי מלבן עם אותם ניצבים.', 'חשב את ' + m('6 · 8 ÷ 2') + ' לפני הכפל בגובה.', 'שטח הבסיס ' + m('24') + ' סמ״ר. עכשיו כפל ב־' + m('10') + '.']
    },
    {
      mode: 'scene', tA: 'פורסים את המנסרה', sub: 'ספור את חמש הפאות והגע לשטח פנים ' + m('72') + ' סמ״ר. שנה גובה בגרירה, בכפתורים או בחיצים. פרוס וסמן פאות בציור או בכפתורים.',
      tip: 'הבסיס הוא משולש עם צלעות ' + m('3, 4, 5') + '. יש שלושה מלבנים ושני משולשים. כל פאה נחשבת.',
      aspect: [402, 368], alt: 'מנסרה שבסיסה משולש ישר זווית עם צלעות שלוש, ארבע וחמש; בפריסה נראים שלושה מלבנים ברצף ושני משולשים, עם ידית לשינוי הגובה',
      cue: 'ספור חמש פאות וכוון לשטח פנים של שבעים ושתיים', cueDone: 'כל הפאות נספרו ושטח הפנים מתאים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'unfoldBtn', text: 'פרוס את המנסרה וסמן גם את שני הבסיסים. כוון את הגובה בכפתורים או בחיצים.' }, setup: netScene
    },
    {
      mode: 'quiz', tA: 'שטח המעטפת בלבד', sub: 'צלעות הבסיס הן ' + m('5') + ', ' + m('5') + ' ו־' + m('6') + ' ס״מ. שטח הבסיס ' + m('12') + ' סמ״ר וגובה המנסרה ' + m('10') + ' ס״מ. מה שטח המעטפת?',
      tip: 'בפריסה שלושת המלבנים יוצרים מלבן באורך היקף הבסיס. הבסיסים אינם חלק מהמעטפת.', btn: 'המשך ←',
      win: 'נכון. שטח מעטפת הוא היקף הבסיס כפול הגובה.', wrongSay: 'למעטפת צריך היקף, לא שטח בסיס, ולא מוסיפים בסיסים.',
      opts: [
        { t: m('184') + ' סמ״ר', f: 'הוספת גם שני בסיסים: ' + m('160 + 2 · 12 = 184') + ' הוא שטח הפנים הכולל, לא המעטפת בלבד.' },
        { t: m('120') + ' סמ״ר', f: 'כפלת שטח בסיס בגובה: ' + m('12 · 10 = 120') + ' הוא נפח, בסמ״ק, ולא שטח מעטפת.' },
        { t: m('160') + ' סמ״ר', c: true, f: 'נכון: היקף הבסיס ' + m('5 + 5 + 6 = 16') + ', ולכן המעטפת ' + m('16 · 10 = 160') + '.' },
        { t: m('80') + ' סמ״ר', f: 'חילקת את המעטפת לשניים בלי סיבה. חצייה נדרשת בשטח משולש, לא בשלושת מלבני המעטפת.' }
      ],
      hints: ['הפריסה של המעטפת כוללת רק את שלושת המלבנים.', 'רוחביהם הם צלעות הבסיס. חבר אותם כדי למצוא היקף.', 'ההיקף ' + m('16') + ' ס״מ. חשב ' + m('16 · 10') + '.']
    },
    {
      mode: 'quiz', tA: 'מוצאים את הגובה', sub: 'נפח מנסרה הוא ' + m('84') + ' סמ״ק ושטח הבסיס שלה ' + m('12') + ' סמ״ר. מה גובה המנסרה?',
      tip: 'הנפח הוא שטח שכבה כפול מספר השכבות. כדי למצוא גובה, הפוך את הכפל.', btn: 'לסיכום ←',
      win: 'מעולה. חילקת נפח בשטח הבסיס ומצאת את הגובה.', wrongSay: 'הפוך את הכפל בנוסחה. שטח הבסיס כבר נתון.',
      opts: [
        { t: m('72') + ' ס״מ', f: 'חיסרת שטח בסיס מנפח: ' + m('84 − 12 = 72') + '. הגובה מתקבל בחילוק, לא בחיסור.' },
        { t: m('14') + ' ס״מ', f: 'חצית שוב את שטח הבסיס וחילקת ב־' + m('6') + '. השטח ' + m('12') + ' כבר נתון; לא מחלקים אותו שוב לשניים.' },
        { t: m('1008') + ' ס״מ', f: 'כפלת ' + m('84 · 12 = 1008') + ' במקום להפוך את כפל שטח הבסיס בגובה.' },
        { t: m('7') + ' ס״מ', c: true, f: 'נכון: ' + m('H = V ÷ S = 84 ÷ 12 = 7') + '. בדיקה: ' + m('12 · 7 = 84') + '.' }
      ],
      hints: ['שאל כמה שכבות של שטח הבסיס נכנסות בנפח.', 'בנוסחה ' + m('84 = 12 · H') + ' צריך לבטל כפל בשתים עשרה.', 'חשב ' + m('84 ÷ 12') + ' ובדוק בכפל.']
    },
    {
      mode: 'finish', tA: 'סיימת לבנות ולפרוס', sub: 'שכבות מסבירות נפח; פריסה מסבירה שטח פנים.',
      tip: 'כל הכבוד. עכשיו אתה יודע מה סופרים בפנים ומה סופרים על הפאות.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'בנפח סופרים שכבות; בשטח פנים פורסים וסופרים את כל הפאות.',
      setup: function (ctx) { ctx.draw('<style>#finalEq{white-space:pre-line;font-family:Heebo,sans-serif;font-size:18px;line-height:1.7}#finalEq .math{font-family:Secular One,sans-serif}</style>'); },
      formula: 'בכל מנסרה: ' + m('V = S · H') + '\nבקובייה: ' + m('V = a³') + ', שטח פנים ' + m('6a²') + '\nשטח הפנים = שני הבסיסים ועוד המעטפת.\nהמעטפת = היקף הבסיס כפול הגובה.'
    }
  ];

  window.NoamGame.boot({
    slug: 'bonim-minsara', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'נפח קובייה', math: 'V = a³' },
      { step: 4, name: 'נפח מנסרה משולשת', math: 'V = S · H' },
      { step: 6, name: 'שטח מעטפת', math: '(5 + 5 + 6) · 10' },
      { step: 7, name: 'מציאת גובה מנסרה', math: 'H = V ÷ S' }
    ],
    bonus: {
      label: 'מכונת המנסרות', closeLabel: 'סגור את המכונה', hint: 'בחר נפח, שטח פנים של תיבה או גובה חסר. הכול במספרים שלמים.',
      setup: function (box, ctx) {
        var sample = null, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת המנסרות</div><div class="bSub" data-question></div><div class="bChip" dir="ltr" data-expression></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr"><button type="button" data-delta="-10" aria-label="הקטן בעשר">−10</button><button type="button" data-delta="-1" aria-label="הקטן באחת">−1</button><bdi class="var math" dir="ltr" data-guess style="min-width:40px" aria-live="polite">0</bdi><button type="button" data-delta="1" aria-label="הגדל באחת">+1</button><button type="button" data-delta="10" aria-label="הגדל בעשר">+10</button></div></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-note hidden role="status"></div><button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button><button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">תרגיל חדש ↻</button>';
        function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function rollPractice() {
          var kind = rnd(0, 2), triangle = kind !== 1 && Math.random() < 0.5;
          var a = triangle ? rnd(1, 3) * 2 : rnd(2, 6), b = rnd(2, 5), hh = rnd(2, 6);
          var area = a * b / (triangle ? 2 : 1), volume = area * hh;
          sample = { kind: kind, triangle: triangle, a: a, b: b, H: hh, area: area, volume: volume };
          sample.answer = kind === 0 ? volume : kind === 1 ? 2 * (a * b + a * hh + b * hh) : hh;
          guess = 0;
          box.querySelector('[data-expression]').textContent = kind === 2 ? 'V = ' + volume + ', S = ' + area + ', H = ?' : (triangle ? 'p = ' : 'a = ') + a + ', ' + (triangle ? 'q = ' : 'b = ') + b + ', H = ' + hh;
          box.querySelector('[data-question]').textContent = (triangle ? 'מנסרה עם בסיס משולש ישר־זווית. ' : 'תיבה. ') + (kind === 0 ? 'מה הנפח בסמ״ק?' : kind === 1 ? 'מה שטח הפנים בסמ״ר?' : 'מה הגובה בס״מ?');
          refreshGuess();
        }
        function refreshGuess() {
          box.querySelector('[data-guess]').textContent = String(guess);
          box.querySelector('[data-note]').hidden = true;
          box.querySelector('[data-forms]').hidden = true;
        }
        box.querySelectorAll('[data-delta]').forEach(function (btnNode) {
          btnNode.addEventListener('click', function () { guess = clamp(guess + Number(btnNode.getAttribute('data-delta')), 0, 240); refreshGuess(); });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var correct = guess === sample.answer, noteNode = box.querySelector('[data-note]');
          noteNode.hidden = false; noteNode.style.color = correct ? PAL.good : BAD;
          noteNode.textContent = correct ? 'נכון! הבחנת בין נפח, שטח פנים וגובה.' : sample.kind === 1 ? 'נסה שוב: ספור שלושה זוגות של פאות בתיבה.' : sample.kind === 2 ? 'נסה שוב: חלק את הנפח בשטח הבסיס שכבר נתון.' : 'נסה שוב: שטח הבסיס כפול הגובה; במשולש הבסיס הוא חצי מלבן.';
          if (correct) {
            var formText = sample.kind === 2 ? sample.volume + ' ÷ ' + sample.area + ' = ' + sample.H : sample.kind === 1 ? '2 · (' + sample.a * sample.b + ' + ' + sample.a * sample.H + ' + ' + sample.b * sample.H + ') = ' + sample.answer : sample.area + ' · ' + sample.H + ' = ' + sample.volume;
            box.querySelector('[data-forms]').innerHTML = bdi(formText);
            box.querySelector('[data-forms]').hidden = false;
          }
          ctx.sfx(correct ? 'correct' : 'error');
        });
        box.querySelector('[data-roll]').addEventListener('click', rollPractice);
        rollPractice();
      }
    }
  });
}());
