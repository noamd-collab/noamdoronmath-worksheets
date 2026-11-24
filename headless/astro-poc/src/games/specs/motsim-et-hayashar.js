/** מוצאים את הישר: חיתוך צירים, שתי נקודות ומקבילים לצירים. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402, H = 362, UNIT = 24, OX = 141, OY = 226;
  var BAD = '#b91c1c', ORANGE = '#92400e';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  function pair(x, y) { return '(' + num(x) + ', ' + num(y) + ')'; }
  function px(v) { return OX + UNIT * v; }
  function py(v) { return OY - UNIT * v; }
  function attrs(el, values) { Object.keys(values).forEach(function (key) { el.setAttribute(key, values[key]); }); }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var remainder = a % b; a = b; b = remainder; } return a || 1; }
  function rational(n, d) { if (d < 0) { n = -n; d = -d; } var divisor = gcd(n, d); return { n: n / divisor, d: d / divisor }; }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function mathText(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 13) + '" fill="' + (colour || PAL.ink) + '" text-anchor="middle">' + text + '</text>';
  }
  function fractionSvg(top, bottom) {
    return '<svg viewBox="0 0 116 58" width="116" height="58" role="img" aria-label="' + m(String(top) + ' ÷ ' + String(bottom)) + '" style="max-width:100%;vertical-align:middle" dir="ltr">'
      + mathText(58, 22, top, 16) + '<line x1="6" y1="29" x2="110" y2="29" stroke="' + PAL.ink + '" stroke-width="1.5"/>' + mathText(58, 49, bottom, 16) + '</svg>';
  }
  function fractionHtml(n, d) {
    var reducedValue = rational(n, d);
    if (reducedValue.d === 1) return bdi(num(reducedValue.n));
    return '<span dir="ltr" class="math" style="display:inline-flex;vertical-align:middle;flex-direction:column;text-align:center;line-height:1.25;margin:0 3px;font-family:Secular One,sans-serif"><span>' + num(reducedValue.n) + '</span><span style="border-top:1.5px solid currentColor;padding:1px 4px">' + reducedValue.d + '</span></span>';
  }
  function equationHtml(sn, sd, bn, bd) {
    var slopeValue = rational(sn, sd), interceptValue = rational(bn, bd);
    if (slopeValue.n === 0) return bdi('y = ') + fractionHtml(interceptValue.n, interceptValue.d);
    var coefficient = slopeValue.d === 1 && Math.abs(slopeValue.n) === 1 ? bdi(slopeValue.n < 0 ? '−' : '') : fractionHtml(slopeValue.n, slopeValue.d);
    return bdi('y = ') + coefficient + bdi('x') + (interceptValue.n ? bdi(interceptValue.n > 0 ? ' + ' : ' − ') + fractionHtml(Math.abs(interceptValue.n), interceptValue.d) : '');
  }
  function grid() {
    var path = '', html = '<defs><clipPath id="lineGridClip"><rect x="45" y="34" width="288" height="288"/></clipPath></defs><rect x="45" y="34" width="288" height="288" fill="#fff" stroke="' + PAL.line + '"/>';
    for (var tick = -4; tick <= 8; tick++) { path += 'M' + px(tick) + ' 34V322 M45 ' + py(tick) + 'H333 '; }
    html += '<path d="' + path + '" fill="none" stroke="' + PAL.line + '" stroke-width="0.7"/>'
      + '<path d="M45 226H345 M141 322V25" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<path d="M339 222L345 226L339 230 M137 31L141 25L145 31" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (var labelTick = -4; labelTick <= 8; labelTick++) {
      if (labelTick !== 0) html += mathText(px(labelTick), OY + 17, num(labelTick), 10) + mathText(OX - 14, py(labelTick) + 4, num(labelTick), 10);
    }
    return html + mathText(361, 231, 'x', 17) + mathText(157, 23, 'y', 17) + mathText(130, 244, '0', 10);
  }
  function lineMarkup(id, colour, width) { return '<line id="' + id + '" stroke="' + colour + '" stroke-width="' + (width || 3) + '" clip-path="url(#lineGridClip)"/>'; }
  function setLine(el, slope, intercept) { attrs(el, { x1: px(-4), y1: py(-4 * slope + intercept), x2: px(8), y2: py(8 * slope + intercept) }); }
  function handleMarkup(id, label, colour, slider) {
    return '<g id="' + id + '" tabindex="0" role="' + (slider ? 'slider' : 'button') + '" aria-label="' + label + '"' + (slider ? ' aria-valuemin="-4" aria-valuemax="8" aria-valuenow="1"' : '') + ' style="cursor:grab">'
      + '<circle r="32" fill="transparent" style="cursor:default"/><circle r="9" fill="' + colour + '" stroke="#fff" stroke-width="3" style="cursor:default"/></g>';
  }
  function stepperHtml(keys, prefix) {
    return '<div class="stepper" dir="ltr" style="margin-top:8px;gap:8px">' + keys.map(function (key) {
      return '<div class="unit" dir="ltr" style="gap:6px;padding:6px"><bdi class="math var" dir="ltr">' + key + '</bdi>'
        + '<button type="button" id="' + prefix + key + 'Minus" data-key="' + key + '" data-d="-1" aria-label="הקטן את ' + key + '">−</button>'
        + '<bdi class="var math" dir="ltr" data-value="' + key + '" style="min-width:30px" aria-live="polite"></bdi>'
        + '<button type="button" id="' + prefix + key + 'Plus" data-key="' + key + '" data-d="1" aria-label="הגדל את ' + key + '">+</button></div>';
    }).join('') + '</div>';
  }
  function wireAxis(ctx, handle, vertical, getValue, setValue) {
    handle.addEventListener('keydown', function (event) {
      var delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setValue(event.key === 'Home' ? -4 : 8, true); return; }
      if (!delta) return;
      event.preventDefault(); setValue(getValue() + delta, true);
    });
    ctx.drag(handle, { move: function (x, y) { setValue(Math.round(vertical ? (OY - y) / UNIT : (x - OX) / UNIT), false); }, end: function () { setValue(getValue(), true); } });
  }

  function interceptScene(ctx) {
    var a = 1, b = 2, completed = false;
    ctx.draw(grid() + lineMarkup('interceptLine', PAL.main) + '<line id="positiveLine" stroke="' + PAL.good + '" stroke-width="9" opacity="0" clip-path="url(#lineGridClip)"/>'
      + handleMarkup('interceptA', 'חיתוך ציר איקס; חצים מזיזים לאורך הציר, אפס מדולג', PAL.main, true)
      + handleMarkup('interceptB', 'חיתוך ציר וואי; חצים מזיזים לאורך הציר, אפס מדולג', ORANGE, true));
    var aHandle = ctx.el('interceptA'), bHandle = ctx.el('interceptB');
    var panel = ctx.extra('<div class="sceneStrip"><b>נקודות החיתוך שלך</b><div data-points dir="ltr" style="font-size:18px"></div><b>השיפוע: מינוס החיתוך האנכי, חלקי החיתוך האופקי</b><div data-slope dir="ltr"></div><b>משוואת הישר שלך</b><div data-eq dir="ltr" style="font:18px Secular One,sans-serif"></div></div>' + stepperHtml(['a', 'b'], 'int'));
    ctx.register('interceptControls', panel);
    function update(acted) {
      setLine(ctx.el('interceptLine'), -b / a, b);
      attrs(aHandle, { transform: 'translate(' + px(a) + ' ' + OY + ')', 'aria-valuenow': a, 'aria-valuetext': m(pair(a, 0)), 'aria-orientation': 'horizontal' });
      attrs(bHandle, { transform: 'translate(' + OX + ' ' + py(b) + ')', 'aria-valuenow': b, 'aria-valuetext': m(pair(0, b)), 'aria-orientation': 'vertical' });
      panel.querySelector('[data-points]').innerHTML = bdi('(' + num(a) + ', 0)') + ' &nbsp; ' + bdi('(0, ' + num(b) + ')');
      var reducedSlope = rational(-b, a);
      panel.querySelector('[data-slope]').innerHTML = bdi('m = ') + fractionSvg(num(-b), num(a)) + bdi(' = ') + fractionHtml(reducedSlope.n, reducedSlope.d);
      panel.querySelector('[data-eq]').innerHTML = equationHtml(-b, a, b, 1);
      ['a', 'b'].forEach(function (key) { panel.querySelector('[data-value="' + key + '"]').textContent = num(key === 'a' ? a : b); });
      var correct = a === 3 && b === 6;
      ctx.el('positiveLine').setAttribute('opacity', correct ? '.55' : '0');
      if (correct) {
        attrs(ctx.el('positiveLine'), { x1: px(-4), y1: py(14), x2: px(3), y2: py(0) });
        ctx.note('בדיוק: החיתוכים הם ' + m('(3, 0)') + ' ו־' + m('(0, 6)') + '. הישר חיובי כאשר ' + m('x < 3') + ', כי שם הוא מעל ציר ' + m('x') + '.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (a === 6 && b === 3) {
        ctx.note('החלפת בין הצירים. על ציר ' + m('x') + ' מתקיים ' + m('y = 0') + ': ' + m('0 = −2x + 6') + ' נותן ' + m('x = 3') + ', לא ' + m('6') + '.');
      } else if (b === 6) {
        ctx.note('החיתוך עם ציר ' + m('y') + ' נכון. עכשיו הצב ' + m('y = 0') + ' ב־' + m('0 = −2x + 6') + ' ומצא את החיתוך האופקי.');
      } else { ctx.note('על ציר ' + m('x') + ' מציבים ' + m('y = 0') + '; על ציר ' + m('y') + ' מציבים ' + m('x = 0') + '. כל משבצת היא יחידה אחת.'); }
    }
    function setIntercept(key, value, acted) {
      var current = key === 'a' ? a : b;
      value = clamp(value, -4, 8);
      if (value === 0) value = current < 0 ? 1 : -1;
      if (key === 'a') a = value; else b = value;
      update(acted);
    }
    panel.querySelectorAll('[data-d]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { var key = buttonNode.getAttribute('data-key'); setIntercept(key, (key === 'a' ? a : b) + Number(buttonNode.getAttribute('data-d')), true); }); });
    wireAxis(ctx, aHandle, false, function () { return a; }, function (value, acted) { setIntercept('a', value, acted); });
    wireAxis(ctx, bHandle, true, function () { return b; }, function (value, acted) { setIntercept('b', value, acted); });
    update(false);
  }

  function twoPointScene(ctx) {
    var points = [{ x: 0, y: 2 }, { x: 3, y: 2 }], selected = 0, completed = false;
    ctx.draw(grid() + lineMarkup('twoPointLine', PAL.main) + '<circle cx="' + px(4) + '" cy="' + py(7) + '" r="6" fill="' + PAL.good + '" stroke="#fff" stroke-width="2"/>' + mathText(px(4) + 16, py(7) - 10, 'C', 17, PAL.good)
      + handleMarkup('pointA', 'נקודה איי; החצים מזיזים יחידה אחת במערכת הצירים', PAL.main, false)
      + handleMarkup('pointB', 'נקודה בי; החצים מזיזים יחידה אחת במערכת הצירים', ORANGE, false));
    var handles = [ctx.el('pointA'), ctx.el('pointB')];
    var panel = ctx.extra('<div class="sceneStrip"><div data-points dir="ltr" style="font-size:17px"></div><div data-deltas dir="ltr"></div><div data-slope dir="ltr"></div><div data-b dir="ltr"></div><div data-eq dir="ltr" style="font:18px Secular One,sans-serif"></div><b>בדיקת הנקודה הקבועה</b><div data-check dir="ltr" style="font:16px Secular One,sans-serif"></div></div>'
      + '<div dir="ltr" style="display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:10px"><button type="button" id="chooseA" data-select="0" aria-label="בחר את נקודה איי" aria-pressed="true" style="min-height:44px;min-width:44px">A</button><button type="button" id="chooseB" data-select="1" aria-label="בחר את נקודה בי" aria-pressed="false" style="min-height:44px;min-width:44px">B</button>'
      + [['Left', '←', 'שמאלה'], ['Right', '→', 'ימינה'], ['Up', '↑', 'למעלה'], ['Down', '↓', 'למטה']].map(function (entry) { return '<button type="button" id="pointMove' + entry[0] + '" data-move="' + entry[0] + '" aria-label="הזז את הנקודה הנבחרת ' + entry[2] + '" style="min-height:44px;min-width:44px;font-size:21px;color:' + PAL.dark + '">' + entry[1] + '</button>'; }).join('') + '</div>');
    ctx.register('pointControls', panel);
    function updatePoints(acted) {
      var first = points[0], second = points[1], dx = second.x - first.x, dy = second.y - first.y;
      handles.forEach(function (handle, index) { attrs(handle, { transform: 'translate(' + px(points[index].x) + ' ' + py(points[index].y) + ')', 'aria-label': (index ? 'נקודה בי ' : 'נקודה איי ') + m(pair(points[index].x, points[index].y)) + '; החצים מזיזים יחידה אחת' }); });
      panel.querySelector('[data-points]').innerHTML = bdi('A' + pair(first.x, first.y)) + ' &nbsp; ' + bdi('B' + pair(second.x, second.y));
      panel.querySelector('[data-deltas]').innerHTML = bdi('Δy = ' + num(dy)) + ' &nbsp; ' + bdi('Δx = ' + num(dx));
      var samePoint = dx === 0 && dy === 0;
      ctx.el('twoPointLine').setAttribute('opacity', samePoint ? '0' : '1');
      if (dx === 0) {
        attrs(ctx.el('twoPointLine'), { x1: px(first.x), x2: px(first.x), y1: py(-4), y2: py(8) });
        panel.querySelector('[data-slope]').textContent = 'השיפוע אינו מוגדר';
        panel.querySelector('[data-b]').textContent = 'אין חיתוך אנכי יחיד';
        panel.querySelector('[data-eq]').innerHTML = samePoint ? 'צריך שתי נקודות שונות' : bdi('x = ' + num(first.x));
        panel.querySelector('[data-check]').innerHTML = bdi('C(4, 7)') + (samePoint ? ' — אין ישר יחיד' : bdi(' : 4 ' + (first.x === 4 ? '=' : '≠') + ' ' + num(first.x)) + (first.x === 4 ? ' ✓' : ' ✗'));
        ctx.note(samePoint ? 'שתי הנקודות באותו מקום. נקודה אחת אינה קובעת ישר. הפרד ביניהן; כש־' + m('Δx = 0') + ' אי אפשר לחשב שיפוע.' : 'זה ישר אנכי: ' + m('x = ' + num(first.x)) + ' קבוע. כש־' + m('Δx = 0') + ' השיפוע אינו מוגדר. הזז נקודה אחת ימינה או שמאלה.');
        return;
      }
      var sn = dy, sd = dx, bn = first.y * dx - dy * first.x, bd = dx;
      var slopeValue = rational(sn, sd), interceptValue = rational(bn, bd);
      setLine(ctx.el('twoPointLine'), sn / sd, bn / bd);
      panel.querySelector('[data-slope]').innerHTML = bdi('m = ') + fractionSvg(num(dy), num(dx)) + bdi(' = ') + fractionHtml(sn, sd);
      panel.querySelector('[data-b]').innerHTML = bdi('b = ') + fractionHtml(bn, bd);
      panel.querySelector('[data-eq]').innerHTML = equationHtml(sn, sd, bn, bd);
      var cNumerator = 4 * sn + bn, cFits = cNumerator === 7 * dx;
      panel.querySelector('[data-check]').innerHTML = bdi('C(4, 7): ') + fractionHtml(sn, sd) + bdi(' · 4') + (interceptValue.n < 0 ? bdi(' − ') : bdi(' + ')) + fractionHtml(Math.abs(interceptValue.n), interceptValue.d) + bdi(' = ') + fractionHtml(cNumerator, dx) + (cFits ? ' ✓' : bdi(' ≠ 7') + ' ✗');
      var target = first.y === 2 * first.x - 1 && second.y === 2 * second.x - 1;
      if (target) {
        ctx.note('בנית את ' + m('y = 2x − 1') + '. גם ' + m('C(4, 7)') + ' על הישר: ' + m('2 · 4 − 1 = 7') + ' ✓.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (slopeValue.n === 2 * slopeValue.d) {
        ctx.note('השיפוע נכון, אבל הישר מקביל לישר המבוקש. הזז אותו כך שיחתוך את ציר ' + m('y') + ' בגובה ' + m('−1') + '.');
      } else { ctx.note('שתי הנקודות צריכות לקיים ' + m('y = 2x − 1') + '. מצא את השיפוע מהפרשי השיעורים, ואז את ' + m('b = y₁ − mx₁') + '.'); }
    }
    function setPoint(index, x, y, acted) { points[index].x = clamp(x, -4, 8); points[index].y = clamp(y, -4, 8); updatePoints(acted); }
    function movePoint(index, key) { var dx = key === 'Left' ? -1 : key === 'Right' ? 1 : 0, dy = key === 'Down' ? -1 : key === 'Up' ? 1 : 0; setPoint(index, points[index].x + dx, points[index].y + dy, true); }
    handles.forEach(function (handle, index) {
      handle.addEventListener('keydown', function (event) { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.key) < 0) return; event.preventDefault(); movePoint(index, event.key.slice(5)); });
      ctx.drag(handle, { move: function (x, y) { setPoint(index, Math.round((x - OX) / UNIT), Math.round((OY - y) / UNIT), false); }, end: function () { updatePoints(true); } });
    });
    panel.querySelectorAll('[data-select]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { selected = Number(buttonNode.getAttribute('data-select')); panel.querySelectorAll('[data-select]').forEach(function (other) { other.setAttribute('aria-pressed', String(other === buttonNode)); other.style.border = other === buttonNode ? '3px solid ' + PAL.main : '1px solid ' + PAL.line; }); }); });
    panel.querySelector('#chooseA').style.border = '3px solid ' + PAL.main;
    panel.querySelectorAll('[data-move]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { movePoint(selected, buttonNode.getAttribute('data-move')); }); });
    updatePoints(false);
  }

  function parallelScene(ctx) {
    var h = 2, k = 3, completed = false;
    ctx.draw(grid() + '<rect id="axisRectangle" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '" stroke-width="1.5"/>'
      + lineMarkup('verticalLine', PAL.main) + lineMarkup('horizontalLine', ORANGE)
      + handleMarkup('verticalHandle', 'ישר אנכי; חצים משנים את שיעור איקס הקבוע', PAL.main, true)
      + handleMarkup('horizontalHandle', 'ישר אופקי; חצים משנים את שיעור וואי הקבוע', ORANGE, true)
      + mathText(126, 351, '', 18, PAL.main, 'parallelXLabel') + mathText(270, 351, '', 18, ORANGE, 'parallelYLabel'));
    var verticalHandle = ctx.el('verticalHandle'), horizontalHandle = ctx.el('horizontalHandle');
    var panel = ctx.extra('<div class="sceneStrip"><b>הפינה שמול הראשית</b><div data-corner dir="ltr" style="font-size:18px"></div><b>שטח המלבן</b><div data-area dir="ltr" style="font-size:18px"></div><div style="font:700 12px Heebo,sans-serif">ישר שמקביל לציר ' + bdi('x') + ' אינו מכיל ' + bdi('x') + ' במשוואה.</div></div>' + stepperHtml(['h', 'k'], 'par'));
    ctx.register('parallelControls', panel);
    function updateParallel(acted) {
      attrs(ctx.el('verticalLine'), { x1: px(h), x2: px(h), y1: py(-4), y2: py(8) });
      attrs(ctx.el('horizontalLine'), { x1: px(-4), x2: px(8), y1: py(k), y2: py(k) });
      attrs(verticalHandle, { transform: 'translate(' + px(h) + ' ' + py(7) + ')', 'aria-valuenow': h, 'aria-valuetext': m('x = ' + num(h)), 'aria-orientation': 'horizontal' });
      attrs(horizontalHandle, { transform: 'translate(' + px(h > 4 ? -1 : 7) + ' ' + py(k) + ')', 'aria-valuenow': k, 'aria-valuetext': m('y = ' + num(k)), 'aria-orientation': 'vertical' });
      attrs(ctx.el('axisRectangle'), { x: px(Math.min(0, h)), y: py(Math.max(0, k)), width: Math.abs(h) * UNIT, height: Math.abs(k) * UNIT });
      ctx.el('parallelXLabel').textContent = 'x = ' + num(h);
      ctx.el('parallelYLabel').textContent = 'y = ' + num(k);
      panel.querySelector('[data-corner]').innerHTML = bdi(pair(h, k));
      var area = Math.abs(h) * Math.abs(k);
      panel.querySelector('[data-area]').innerHTML = bdi('|h| · |k| = ' + Math.abs(h) + ' · ' + Math.abs(k) + ' = ' + area);
      ['h', 'k'].forEach(function (key) { panel.querySelector('[data-value="' + key + '"]').textContent = num(key === 'h' ? h : k); });
      if (h < 0 && k > 0 && area === 12) {
        ctx.note('נכון! הפינה ברביע השני: ' + m('h < 0') + ', ' + m('k > 0') + ', והשטח ' + m(String(area)) + '. לישר האנכי אין שיפוע מוגדר, ולאופקי השיפוע אפס.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (h === 0 || k === 0) { ctx.note('אחד הישרים נמצא על ציר: ' + m(h === 0 ? 'x = 0' : 'y = 0') + '. אין מלבן, כי אחד האורכים אפס.'); }
      else if (area === 12 && h > 0) { ctx.note('השטח נכון, אבל הפינה צריכה להיות משמאל לציר ' + m('y') + '. ברביע השני ' + m('h < 0') + ' וגם ' + m('k > 0') + '.'); }
      else if (h < 0 && k < 0) { ctx.note('הפינה שמאלה, אבל מתחת לציר ' + m('x') + ': זה הרביע השלישי. ברביע השני הגובה חיובי.'); }
      else { ctx.note('בנה מלבן בשטח ' + m('12') + ' עם פינה שמאלה ולמעלה: ' + m('h < 0') + ', ' + m('k > 0') + '.'); }
    }
    function setParallel(key, value, acted) { if (key === 'h') h = clamp(value, -4, 8); else k = clamp(value, -4, 8); updateParallel(acted); }
    panel.querySelectorAll('[data-d]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { var key = buttonNode.getAttribute('data-key'); setParallel(key, (key === 'h' ? h : k) + Number(buttonNode.getAttribute('data-d')), true); }); });
    wireAxis(ctx, verticalHandle, false, function () { return h; }, function (value, acted) { setParallel('h', value, acted); });
    wireAxis(ctx, horizontalHandle, true, function () { return k; }, function (value, acted) { setParallel('k', value, acted); });
    updateParallel(false);
  }

  function finishDetails(ctx) {
    var oldDetails = ctx.el('lineFinishDetails');
    if (oldDetails) oldDetails.remove();
    var detailsNode = document.createElement('div');
    detailsNode.id = 'lineFinishDetails';
    detailsNode.className = 'sceneStrip';
    detailsNode.innerHTML = '<b>שיפוע משתי נקודות שונות</b><div dir="ltr">' + bdi('m = ') + fractionSvg('y₂ − y₁', 'x₂ − x₁') + '</div><div style="font:700 13px Heebo,sans-serif">כאשר ' + bdi('x₂ ≠ x₁') + '. אחר כך ' + bdi('b = y₁ − mx₁') + '.</div><div style="font:700 13px Heebo,sans-serif">מקביל לציר ' + bdi('x') + ': ' + bdi('y = k') + '. מקביל לציר ' + bdi('y') + ': ' + bdi('x = h') + ' — השיפוע אינו מוגדר.</div>';
    ctx.el('finalEq').insertAdjacentElement('afterend', detailsNode);
  }

  var steps = [
    {
      mode: 'intro', tA: 'מוצאים את הישר', sub: 'חיתוך צירים, ישר משתי נקודות והישרים המקבילים לצירים.',
      tip: 'שלום, אני אליהו. שתי נקודות שונות מספיקות כדי למצוא ישר. נתחיל בנקודות החיתוך עם הצירים.',
      emoji: '📍', eq: m('y = mx + b'), note: 'על ציר ' + m('x') + ' הגובה הוא ' + m('y = 0') + '. על ציר ' + m('y') + ' מתקיים ' + m('x = 0') + ', והנקודה היא ' + m('(0, b)') + '.',
      cue: 'מוכן למצוא את הישר?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'איפה הישר חותך את הצירים?', sub: 'מצא איפה הישר ' + m('y = −2x + 6') + ' חותך את הצירים. שנה את שתי הנקודות בגרירה, בכפתורים או בחיצים.',
      tip: 'הנקודה הכחולה על ציר ' + m('x') + ', והכתומה על ציר ' + m('y') + '. בכל חיתוך אחד השיעורים אפס.',
      aspect: [W, H], alt: 'רשת ביחידות שלמות ממינוס ארבע עד שמונה בכל ציר, ישר ושתי ידיות לחיתוכים עם הצירים',
      cue: 'מצא את שני החיתוכים של הישר המבוקש', cueDone: 'שני החיתוכים נמצאו. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'interceptControls', text: 'שנה את החיתוכים בגרירה, בכפתורים או בחיצים. על ציר ' + m('x') + ' מציבים ' + m('y = 0') + '.' }, setup: interceptScene
    },
    {
      mode: 'quiz', tA: 'איפה הישר חותך את ציר האיקס?', sub: 'הישר הוא ' + m('y = 2x − 8') + '. מהי נקודת החיתוך עם ציר ' + m('x') + '?',
      tip: 'על הציר האופקי הגובה אפס. הצב אותו במשוואה.', btn: 'המשך ←',
      win: 'נכון. מציבים גובה אפס ומקבלים את החיתוך האופקי.', wrongSay: 'בדוק באיזה ציר מדובר, ואז את הסימן ואת החלוקה.',
      opts: [
        { t: m('(4, 0)'), c: true, f: 'נכון: ' + m('0 = 2x − 8') + ' ולכן ' + m('2x = 8') + ', ' + m('x = 4') + '.' },
        { t: m('(0, −8)'), f: 'זו נקודת החיתוך עם ציר ' + m('y') + ', כי בה ' + m('x = 0') + '. התבקש החיתוך עם ציר ' + m('x') + '.' },
        { t: m('(−4, 0)'), f: 'הסימן התהפך. אחרי הוספת ' + m('8') + ' מקבלים ' + m('2x = 8') + ', מספר חיובי.' },
        { t: m('(8, 0)'), f: 'שכחת לחלק ב־' + m('2') + '. ' + m('8') + ' הוא ערך ' + m('2x') + ', לא ערך ' + m('x') + '.' }
      ], hints: ['איזה שיעור מתאפס על הציר האופקי?', 'הצב ' + m('y = 0') + ' וקבל ' + m('2x = 8') + '. עכשיו חלק במקדם של ' + m('x') + '.']
    },
    {
      mode: 'scene', tA: 'ישר משתי נקודות', sub: 'בנה את ' + m('y = 2x − 1') + ' משתי נקודות שונות ובדוק את ' + m('C(4, 7)') + '. הזז בגרירה, בכפתורים או בחיצים.',
      tip: 'הפרשי השיעורים נותנים שיפוע. אחר כך מציבים נקודה אחת כדי למצוא את החיתוך האנכי.',
      aspect: [W, H], alt: 'מערכת צירים עם שתי נקודות שאפשר להזיז, ישר שעובר דרכן, ונקודה קבועה שהשיעורים שלה ארבע ושבע',
      cue: 'מקם שתי נקודות שונות על הישר המבוקש', cueDone: 'הישר נבנה והנקודה נבדקה. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'pointControls', text: 'בחר נקודה והזז אותה בגרירה, בכפתורים או בחיצים. שתיהן צריכות לקיים את המשוואה.' }, setup: twoPointScene
    },
    {
      mode: 'quiz', tA: 'מהי משוואת הישר משתי הנקודות?', sub: 'הישר עובר דרך ' + m('(1, 3)') + ' ו־' + m('(3, 7)') + '.',
      tip: 'חשב שיפוע מהפרשי השיעורים, ואז הצב נקודה כדי למצוא את החיתוך האנכי.', btn: 'המשך ←',
      win: 'מצוין. מצאת את השיפוע ואז את החיתוך, ובדקת את שתי הנקודות.', wrongSay: 'בדוק מה מייצג כל מספר: הפרש, שיפוע או חיתוך.',
      opts: [
        { t: m('y = 2x + 3'), f: 'לקחת את הגובה של הנקודה הראשונה בתור ' + m('b') + '. אבל היא לא על ציר ' + m('y') + '. צריך ' + m('b = 3 − 2 · 1 = 1') + '.' },
        { t: m('y = 2x + 1'), c: true, f: 'נכון: ' + m('m = (7 − 3) ÷ (3 − 1) = 2') + ', ואז ' + m('b = 3 − 2 · 1 = 1') + '.' },
        { t: m('y = 0.5x + 2.5'), f: 'הפכת את היחס וחילקת את ' + m('Δx') + ' ב־' + m('Δy') + '. השיפוע הוא הפרש הגבהים חלקי הפרש השיעורים האופקיים.' },
        { t: m('y = 4x − 1'), f: 'לקחת את ' + m('Δy = 4') + ' כשיפוע בלי לחלק ב־' + m('Δx = 2') + '. השיפוע הוא ' + m('2') + '.' }
      ], hints: ['התחל מהפרש הגבהים ומהפרש השיעורים האופקיים.', m('Δy = 4') + ' ו־' + m('Δx = 2') + '. אחרי החלוקה הצב ' + m('(1, 3)') + ' כדי למצוא את ' + m('b') + '.']
    },
    {
      mode: 'scene', tA: 'ישרים מקבילים לצירים', sub: 'בנה מלבן בשטח ' + m('12') + ' שהפינה שמול הראשית ברביע השני. שנה את הישרים בגרירה, בכפתורים או בחיצים.',
      tip: 'ברביע השני הפינה שמאלה ולמעלה. השטח הוא מכפלת שני אורכים חיוביים.',
      aspect: [W, H], alt: 'ישר אנכי וישר אופקי עם ידיות, והמלבן שהם תוחמים יחד עם הצירים ברשת ביחידות שלמות',
      cue: 'בנה מלבן בשטח המבוקש ברביע השני', cueDone: 'השטח והרביע נכונים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'parallelControls', text: 'שנה את שני הישרים בגרירה, בכפתורים או בחיצים. הפינה צריכה להיות שמאלה ולמעלה.' }, setup: parallelScene
    },
    {
      mode: 'quiz', tA: 'איזה ישר מקביל לציר האיקס?', sub: 'הישר מקביל לציר ' + m('x') + ' ועובר דרך ' + m('(5, −3)') + '. מהי משוואתו?',
      tip: 'בישר אופקי הגובה נשאר קבוע גם כשנעים ימינה ושמאלה.', btn: 'המשך ←',
      win: 'נכון. על ישר אופקי הגובה קבוע, ולכן אין איקס במשוואה.', wrongSay: 'בדוק מה קבוע בישר אופקי: המקום האופקי או הגובה?',
      opts: [
        { t: m('x = 5'), f: 'זה ישר אנכי, מקביל לציר ' + m('y') + '. התבקש ישר אופקי, מקביל לציר ' + m('x') + '.' },
        { t: m('y = 5'), f: 'לקחת את שיעור ' + m('x = 5') + ' של הנקודה במקום את הגובה ' + m('y = −3') + '.' },
        { t: m('y = −3'), c: true, f: 'נכון: הגובה בכל נקודה על הישר הוא ' + m('−3') + '. שיעור ' + m('x') + ' יכול להשתנות.' },
        { t: m('x = −3'), f: 'גם החלפת בין השיעורים וגם כתבת ישר אנכי. בישר המבוקש דווקא ' + m('y') + ' קבוע ושווה לגובה הנקודה.' }
      ], hints: ['ישר מקביל לציר האופקי שומר על אותו גובה.', 'קרא את השיעור השני של ' + m('(5, −3)') + ' וכתוב ' + m('y = k') + '.']
    },
    {
      mode: 'quiz', tA: 'מתי הישר חיובי?', sub: 'מצא מתי ' + m('y > 0') + ' עבור הישר ' + m('y = −2x + 6') + '.',
      tip: 'הישר יורד. חיובי פירושו מעל הציר האופקי, לא מימין לציר האנכי.', btn: 'לסיכום ←',
      win: 'בדיוק. בישר יורד החלק החיובי נמצא משמאל לחיתוך עם ציר האיקס.', wrongSay: 'מצא את החיתוך האופקי ואז בדוק לאיזה צד הישר נמצא מעל הציר.',
      opts: [
        { t: m('x > 3'), f: 'שכחת שהישר יורד. מימין ל־' + m('3') + ' הוא מתחת לציר ' + m('x') + ', ולכן שלילי.' },
        { t: m('x < 6'), f: 'השתמשת ב־' + m('b = 6') + ' במקום בחיתוך האופקי ' + m('x = 3') + '. את תחום החיוביות קובע החיתוך עם ציר ' + m('x') + '.' },
        { t: m('x > −3'), f: 'גם סימן החיתוך וגם הכיוון התהפכו. ' + m('0 = −2x + 6') + ' נותן ' + m('x = 3') + ', ובישר יורד החיוביות משמאל לחיתוך.' },
        { t: m('x < 3'), c: true, f: 'נכון. הישר חותך ב־' + m('(3, 0)') + ', ומשמאל לנקודה זו מתקיים ' + m('y > 0') + '. ב־' + m('x = 3') + ' הוא אפס, לא חיובי.' }
      ], hints: ['חיובי פירושו שהגובה גדול מאפס. איפה הישר מעל הציר?', 'החיתוך הוא ' + m('x = 3') + '. בדוק למשל את ' + m('x = 0') + ': הגובה ' + m('6') + ' חיובי.']
    },
    {
      mode: 'finish', tA: 'סיימת למצוא את הישר', sub: 'חיתוכים, שתי נקודות, מקבילים לצירים וחיוביות — עכשיו הכול מתחבר.',
      tip: 'כל הכבוד. שתי נקודות שונות מספיקות כדי לקבוע ישר. תמיד אפשר לבדוק נקודה בהצבה.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'שתי נקודות שונות קובעות ישר; בדוק את המשוואה בהצבת שיעורי הנקודה.',
      formula: m('y = mx + b') + ' · בציר ' + m('x') + ': ' + m('y = 0') + ' · בציר ' + m('y') + ': ' + m('x = 0'), setup: finishDetails
    }
  ];

  window.NoamGame.boot({
    slug: 'motsim-et-hayashar', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'חיתוך עם הציר האופקי', math: 'y = 0' },
      { step: 4, name: 'משוואה משתי נקודות', math: 'y = 2x + 1' },
      { step: 6, name: 'ישר מקביל לציר', math: 'y = −3' },
      { step: 7, name: 'תחום חיוביות', math: 'x < 3' }
    ],
    bonus: {
      label: 'מכונת הישרים', closeLabel: 'סגור את המכונה', hint: 'קבל ישר חדש, בחר תשובה ובדוק.',
      setup: function (box, ctx) {
        var question = null, guess = 0, yesNo = null;
        function randomInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        box.innerHTML = '<div class="bTitle">מכונת הישרים</div><div class="bSub" data-sub></div><div class="bChip" data-question dir="ltr" style="font-size:18px;max-width:100%;padding:8px"></div>'
          + '<div data-stepper>' + stepperHtml(['answer'], 'bonus') + '</div><div data-chips style="display:flex;gap:8px;justify-content:center"><button type="button" data-yes="1" style="min-height:44px;min-width:44px">כן</button><button type="button" data-yes="0" style="min-height:44px;min-width:44px">לא</button></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok role="status" hidden></div><button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button><button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">ישר חדש ↻</button>';
        var subNode = box.querySelector('[data-sub]'), questionNode = box.querySelector('[data-question]'), answerNode = box.querySelector('[data-value="answer"]'), okNode = box.querySelector('[data-ok]'), formsNode = box.querySelector('[data-forms]');
        box.querySelector('.stepper .var').textContent = '?';
        function refreshGuess() { answerNode.textContent = num(guess); okNode.hidden = true; formsNode.hidden = true; }
        function rollBonus() {
          var kind = randomInt(0, 3), slope = [1, 2, -1, -2][randomInt(0, 3)], intercept;
          guess = 0; yesNo = null;
          if (kind === 0) {
            var xIntercept = randomInt(1, 4); intercept = -slope * xIntercept;
            question = { kind: kind, ans: xIntercept, sn: slope, bn: intercept };
            subNode.textContent = 'מהו שיעור החיתוך עם הציר האופקי?';
            questionNode.innerHTML = equationHtml(slope, 1, intercept, 1);
          } else {
            var x1, y1, x2, y2;
            do { intercept = randomInt(-3, 4); x1 = randomInt(-2, 3); x2 = x1 + randomInt(1, 2); y1 = slope * x1 + intercept; y2 = slope * x2 + intercept; } while (y1 < -4 || y1 > 8 || y2 < -4 || y2 > 8);
            question = { kind: kind, sn: slope, bn: intercept, ans: kind === 1 ? slope : intercept, x1: x1, y1: y1, x2: x2, y2: y2 };
            if (kind === 3) {
              var cx = randomInt(-2, 3), cy = slope * cx + intercept + (randomInt(0, 1) ? 0 : 1);
              question.ans = cy === slope * cx + intercept ? 1 : 0; question.cx = cx; question.cy = cy;
              subNode.textContent = 'האם הנקודה נמצאת על הישר?';
              questionNode.innerHTML = equationHtml(slope, 1, intercept, 1) + '<br>' + bdi(pair(cx, cy));
            } else { subNode.textContent = kind === 1 ? 'מהו שיפוע הישר משתי הנקודות?' : 'מהו החיתוך עם הציר האנכי?'; questionNode.innerHTML = bdi('A' + pair(x1, y1)) + '<br>' + bdi('B' + pair(x2, y2)); }
          }
          box.querySelector('[data-stepper]').hidden = kind === 3;
          box.querySelector('[data-chips]').hidden = kind !== 3;
          box.querySelectorAll('[data-yes]').forEach(function (buttonNode) { buttonNode.setAttribute('aria-pressed', 'false'); });
          refreshGuess();
        }
        box.querySelectorAll('[data-d]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-d')), -12, 12); refreshGuess(); }); });
        box.querySelectorAll('[data-yes]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { yesNo = Number(buttonNode.getAttribute('data-yes')); box.querySelectorAll('[data-yes]').forEach(function (other) { other.setAttribute('aria-pressed', String(other === buttonNode)); }); okNode.hidden = true; formsNode.hidden = true; }); });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var answer = question.kind === 3 ? yesNo : guess, correct = answer === question.ans;
          okNode.hidden = false; okNode.style.color = correct ? PAL.good : BAD;
          okNode.textContent = correct ? 'נכון! בדקת את הכלל, לא רק את הציור.' : question.kind === 0 ? 'נסה שוב: הצב גובה אפס וחלק במקדם.' : question.kind === 1 ? 'נסה שוב: הפרש הגבהים חלקי הפרש השיעורים האופקיים.' : question.kind === 2 ? 'נסה שוב: הצב נקודה וחסר את השיפוע כפול השיעור האופקי.' : 'בחר כן או לא אחרי הצבת שיעורי הנקודה במשוואה.';
          formsNode.hidden = !correct;
          if (correct) {
            formsNode.innerHTML = question.kind === 0 ? bdi('0 = ' + num(question.sn) + ' · ' + num(question.ans) + (question.bn >= 0 ? ' + ' + question.bn : ' − ' + Math.abs(question.bn)))
              : question.kind === 1 ? fractionSvg(num(question.y2 - question.y1), num(question.x2 - question.x1)) + bdi(' = ' + num(question.ans))
              : question.kind === 2 ? bdi('b = ' + num(question.y1) + ' − (' + num(question.sn) + ' · ' + num(question.x1) + ') = ' + num(question.ans))
              : bdi(num(question.sn) + ' · (' + num(question.cx) + ')' + (question.bn >= 0 ? ' + ' + question.bn : ' − ' + Math.abs(question.bn)) + ' = ' + num(question.sn * question.cx + question.bn) + (question.ans ? ' = ' : ' ≠ ') + num(question.cy));
          }
          ctx.sfx(correct ? 'correct' : 'error');
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { rollBonus(); });
        rollBonus();
      }
    }
  });
}());
