/** דמיון משולשים: צלעות והיקף פי k, שטח פי k², וז.ז. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var DEG = Math.PI / 180;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dec(v) { return String(Math.round(v * 100) / 100); }
  function bdi(s) { return '<bdi class="math" dir="ltr">' + s + '</bdi>'; }
  function attrs(el, values) { Object.keys(values).forEach(function (key) { el.setAttribute(key, values[key]); }); }
  function mt(id, x, y, text, size, colour) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" text-anchor="middle" font-size="' + (size || 16) + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function ht(x, y, text) { return '<text x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif" text-anchor="middle" font-size="14" font-weight="700" fill="' + PAL.ink + '">' + text + '</text>'; }
  function slider(id, label, lo, hi, val) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + lo + '" aria-valuemax="' + hi + '" aria-valuenow="' + val + '" style="cursor:grab"><circle r="32" fill="transparent"/><circle r="9" fill="#fff" stroke="' + PAL.dark + '" stroke-width="4"/></g>';
  }
  function keys(el, lo, hi, step, get, set) {
    el.addEventListener('keydown', function (event) {
      var delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (event.key === 'Home') { event.preventDefault(); set(lo); }
      else if (event.key === 'End') { event.preventDefault(); set(hi); }
      else if (delta) { event.preventDefault(); set(get() + delta * step); }
    });
  }
  function control(key, label) {
    return '<div class="unit" dir="ltr"><button type="button" id="' + key + 'Minus" data-key="' + key + '" data-d="-1" aria-label="הקטן את ' + label + '">−</button>'
      + '<span dir="rtl" style="font:700 13px Heebo,sans-serif">' + label + '</span><bdi class="var math" dir="ltr" data-value="' + key + '" style="min-width:36px" aria-live="polite"></bdi>'
      + '<button type="button" id="' + key + 'Plus" data-key="' + key + '" data-d="1" aria-label="הגדל את ' + label + '">+</button></div>';
  }
  function wireButtons(box, callback) {
    box.querySelectorAll('[data-d]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { callback(buttonNode.getAttribute('data-key'), Number(buttonNode.getAttribute('data-d'))); }); });
  }
  function markValue(box, key, val, lo, hi) {
    box.querySelector('[data-value="' + key + '"]').textContent = val;
    box.querySelector('#' + key + 'Minus').disabled = parseFloat(val) <= lo;
    box.querySelector('#' + key + 'Plus').disabled = parseFloat(val) >= hi;
  }
  function arc(x, y, radius, start, span) {
    var x1 = x + radius * Math.cos(start * DEG), y1 = y - radius * Math.sin(start * DEG);
    var x2 = x + radius * Math.cos((start + span) * DEG), y2 = y - radius * Math.sin((start + span) * DEG);
    return 'M' + x1 + ' ' + y1 + ' A' + radius + ' ' + radius + ' 0 0 0 ' + x2 + ' ' + y2;
  }
  function trianglePoints(arr) { return arr.map(function (pt) { return pt.x + ',' + pt.y; }).join(' '); }

  function magnifyScene(ctx) {
    var factor = 1.5, completed = false;
    var centre = { x: 38, y: 254 };
    function vertices(k) { return [{ x: 38 + 20 * k, y: 254 - 14 * k }, { x: 38 + 80 * k, y: 254 - 14 * k }, { x: 38 + 20 * k, y: 254 - 59 * k }]; }
    var orig = vertices(1);
    ctx.draw('<path d="M38 254 L358 198 M38 254 L118 18 M38 254 L118 198" fill="none" stroke="' + PAL.line + '" stroke-dasharray="4 5"/>'
      + '<polygon id="imageTri" fill="' + PAL.soft + '" fill-opacity=".7" stroke="' + PAL.main + '" stroke-width="3"/>'
      + '<polygon points="' + trianglePoints(orig) + '" fill="' + PAL.warmSoft + '" fill-opacity=".75" stroke="' + PAL.ink + '" stroke-width="2" stroke-dasharray="4 3"/>'
      + '<path d="M58 230 H68 V240" stroke="' + PAL.ink + '" fill="none" stroke-width="2"/>'
      + '<path d="' + arc(118, 240, 18, 143.13, 36.87) + ' ' + arc(orig[2].x, orig[2].y, 17, 270, 53.13) + '" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<path id="imageRight" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/><path id="imageArcs" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + mt('side3', 0, 0, '', 16, PAL.dark) + mt('side4', 0, 0, '', 16, PAL.dark) + mt('side5', 0, 0, '', 16, PAL.dark)
      + '<circle cx="38" cy="254" r="4" fill="' + PAL.ink + '"/>' + ht(72, 287, 'מרכז קבוע')
      + ht(239, 287, 'מקור: צלעות') + mt('origSides', 239, 311, '3, 4, 5', 17)
      + slider('scaleHandle', 'קודקוד התמונה: חצים למעלה או ימינה מגדילים את יחס הדמיון', 0.5, 4, factor));
    var handle = ctx.el('scaleHandle');
    var box = ctx.extra('<div class="stepper">' + control('scale', 'יחס הדמיון') + '</div><div class="sceneStrip" style="margin-top:8px"><div><b>צלעות התמונה</b><bdi class="math" dir="ltr" data-sides></bdi></div><div><b>היקף התמונה ויחס ההיקפים</b><bdi class="math" dir="ltr" data-perimeter></bdi></div><div><b>שטח התמונה ויחס השטחים</b><bdi class="math" dir="ltr" data-area></bdi></div></div>');
    ctx.register('scaleControls', box);
    function render(acted) {
      var pts = vertices(factor), corner = pts[0], right = pts[1], top = pts[2];
      attrs(ctx.el('imageTri'), { points: trianglePoints(pts) });
      attrs(handle, { transform: 'translate(' + right.x + ' ' + right.y + ')', 'aria-valuenow': factor });
      attrs(ctx.el('imageRight'), { d: 'M' + corner.x + ' ' + (corner.y - 10) + ' h10 v10' });
      attrs(ctx.el('imageArcs'), { d: arc(right.x, right.y, 19, 143.13, 36.87) + ' ' + arc(top.x, top.y, 19, 270, 53.13) });
      [['side3', corner.x - 18, (corner.y + top.y) * 0.5, 3 * factor], ['side4', (corner.x + right.x) * 0.5, corner.y + 23, 4 * factor], ['side5', (right.x + top.x) * 0.5 + 12, (right.y + top.y) * 0.5 - 8, 5 * factor]].forEach(function (row) { attrs(ctx.el(row[0]), { x: row[1], y: row[2] }); ctx.el(row[0]).textContent = dec(row[3]); });
      markValue(box, 'scale', dec(factor), 0.5, 4);
      box.querySelector('[data-sides]').textContent = '3k = ' + dec(3 * factor) + ',  4k = ' + dec(4 * factor) + ',  5k = ' + dec(5 * factor);
      box.querySelector('[data-perimeter]').textContent = '12 · ' + factor + ' = ' + dec(12 * factor) + ',  k = ' + factor;
      box.querySelector('[data-area]').textContent = '6 · ' + factor + '² = ' + dec(6 * factor * factor) + ',  k² = ' + dec(factor * factor);
      ctx.caption('זוויות נשמרות, שטח המקור ' + m('6') + ', היקף המקור ' + m('12'));
      if (factor === 2) {
        ctx.note('בדיוק: הצלעות פי ' + m('2') + ', והשטח פי ' + m('2² = 4') + '. שטח התמונה ' + m('24') + '.', 'good');
        if (acted && !completed) { completed = true; ctx.solved(); ctx.sfx('correct'); }
      } else if (factor === 4) ctx.note('הצלעות ארוכות פי ' + m('4') + ', אבל השטח גדל פי ' + m('4² = 16') + ' והוא ' + m('96') + '. ביקשנו שטח פי ארבע, לא צלעות פי ארבע.');
      else if (factor === 0.5) ctx.note('זו הקטנה: כל צלע היא חצי, ולכן השטח הוא רבע מהמקור: ' + m('0.5² = 0.25') + '.');
      else ctx.note('יחס השטחים עכשיו ' + m(dec(factor * factor)) + '. שנה את יחס הדמיון עד שהשטח יגדל פי ' + m('4') + '.');
    }
    function setFactor(val) { factor = clamp(Math.round(val * 2) * 0.5, 0.5, 4); ctx.sfx('tick'); render(true); }
    wireButtons(box, function (_, delta) { setFactor(factor + delta * 0.5); });
    keys(handle, 0.5, 4, 0.5, function () { return factor; }, setFactor);
    ctx.drag(handle, { move: function (x, y) { setFactor(((x - centre.x) * 80 - (y - centre.y) * 14) / (80 * 80 + 14 * 14)); } });
    render(false);
  }

  function aaShape(a, b, length, bottom, unit, maxHeight) {
    var third = 180 - a - b;
    var width = length * unit;
    if (third <= 0) return [{ x: 201 - width * 0.5, y: bottom }, { x: 201 + width * 0.5, y: bottom }, null];
    var adjacent = width * Math.sin(b * DEG) / Math.sin(third * DEG);
    var height = adjacent * Math.sin(a * DEG);
    var zoom = Math.min(1, maxHeight / height);
    width *= zoom; adjacent *= zoom;
    var leftX = 201 - width * 0.5;
    return [{ x: leftX, y: bottom }, { x: leftX + width, y: bottom }, { x: leftX + adjacent * Math.cos(a * DEG), y: bottom - adjacent * Math.sin(a * DEG) }];
  }
  function aaMarkup(prefix) {
    return '<polygon id="' + prefix + 'Tri" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2.5"/>'
      + '<path id="' + prefix + 'Arcs" fill="none" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + mt(prefix + 'A', 0, 0, '') + mt(prefix + 'B', 0, 0, '') + mt(prefix + 'C', 0, 0, '') + mt(prefix + 'L', 201, 0, '');
  }
  function placeAA(ctx, prefix, pts, a, b, length) {
    var left = pts[0], right = pts[1], top = pts[2], third = 180 - a - b;
    ctx.el(prefix + 'Tri').setAttribute('points', top ? trianglePoints(pts) : '');
    ctx.el(prefix + 'Arcs').setAttribute('d', arc(left.x, left.y, 23, 0, a) + ' ' + arc(right.x, right.y, 23, 180 - b, b));
    [[prefix + 'A', left.x + 34 * Math.cos(a * DEG * 0.5), left.y - 34 * Math.sin(a * DEG * 0.5) - 8, a + '°'], [prefix + 'B', right.x - 34 * Math.cos(b * DEG * 0.5), right.y - 34 * Math.sin(b * DEG * 0.5) - 8, b + '°'], [prefix + 'C', top ? top.x : 201, top ? top.y - 12 : left.y - 90, third + '°'], [prefix + 'L', 201, left.y + 23, String(length)]].forEach(function (row) { attrs(ctx.el(row[0]), { x: row[1], y: row[2] }); ctx.el(row[0]).textContent = row[3]; });
  }
  function aaScene(ctx) {
    var angleA = 40, angleB = 60, baseLength = 4, completed = false, currentPts;
    ctx.draw(ht(201, 18, 'המקור') + aaMarkup('original') + ht(201, 193, 'המשולש שלך') + aaMarkup('new')
      + '<path id="newRays" fill="none" stroke="' + PAL.line + '" stroke-width="2" stroke-dasharray="4 3"/>'
      + slider('angleAHandle', 'הזווית השמאלית: חצים משנים בחמש מעלות', 30, 90, angleA)
      + slider('angleBHandle', 'הזווית הימנית: חצים משנים בחמש מעלות', 30, 90, angleB));
    placeAA(ctx, 'original', aaShape(50, 60, 4, 145, 28, 104), 50, 60, 4);
    var box = ctx.extra('<div class="stepper">' + control('base', 'בסיס') + control('angleA', 'זווית שמאל') + control('angleB', 'זווית ימין') + '</div><div class="sceneStrip" style="margin-top:8px"><b>יחסי הצלעות המתאימות לפי זוויות</b><div data-ratios>התאם שתי זוויות כדי להשוות יחסים.</div></div>');
    ctx.register('aaControls', box);
    function render(acted) {
      var third = 180 - angleA - angleB;
      currentPts = aaShape(angleA, angleB, baseLength, 365, 28, 140);
      placeAA(ctx, 'new', currentPts, angleA, angleB, baseLength);
      var left = currentPts[0], right = currentPts[1];
      var tipA = { x: left.x + 60 * Math.cos(angleA * DEG), y: left.y - 60 * Math.sin(angleA * DEG) };
      var tipB = { x: right.x - 60 * Math.cos(angleB * DEG), y: right.y - 60 * Math.sin(angleB * DEG) };
      attrs(ctx.el('angleAHandle'), { transform: 'translate(' + tipA.x + ' ' + tipA.y + ')', 'aria-valuenow': angleA });
      attrs(ctx.el('angleBHandle'), { transform: 'translate(' + tipB.x + ' ' + tipB.y + ')', 'aria-valuenow': angleB });
      attrs(ctx.el('newRays'), { d: 'M' + left.x + ' ' + left.y + ' L' + tipA.x + ' ' + tipA.y + ' M' + right.x + ' ' + right.y + ' L' + tipB.x + ' ' + tipB.y });
      markValue(box, 'base', String(baseLength), 2, 8); markValue(box, 'angleA', angleA + '°', 30, 90); markValue(box, 'angleB', angleB + '°', 30, 90);
      ctx.caption(m('C = 180° − ' + angleA + '° − ' + angleB + '° = ' + third + '°'));
      var similar = [angleA, angleB, third].sort(function (x, y) { return x - y; }).join(',') === '50,60,70';
      var ratiosNode = box.querySelector('[data-ratios]');
      if (similar) {
        /* Match sides by opposite angle, not by their position in the drawing. */
        var k = baseLength * Math.sin(70 * DEG) / (4 * Math.sin(third * DEG));
        ratiosNode.innerHTML = bdi('k₅₀ = ' + dec(k)) + ',  ' + bdi('k₆₀ = ' + dec(k)) + ',  ' + bdi('k₇₀ = ' + dec(k));
        if (third === 70) ctx.caption(m('k = ' + baseLength + ' ÷ 4 = ' + dec(k)) + '. שתי זוויות מספיקות: ז.ז');
        else ctx.caption('התאם צלעות לפי זוויות: ' + m('k ≈ ' + dec(k)));
        if (baseLength === 4) ctx.note('הזוויות מתאימות, אבל המשימה מבקשת בסיס שונה מ־' + m('4') + '. ' + (third === 70 ? 'זה משולש חופף: ' + m('k = 1') + '. ' : '') + 'שנה את הבסיס כדי להשלים את המשימה.');
        else {
          ctx.note('מצוין: אותן שלוש זוויות, גודל אחר, ושלושה יחסי צלעות שווים. שתי זוויות שוות מספיקות, כי השלישית משלימה ל־' + m('180°') + '.', 'good');
          if (acted && !completed) { completed = true; ctx.solved(); ctx.sfx('correct'); }
        }
      } else {
        ratiosNode.textContent = 'הזוויות עדיין אינן מתאימות; אין יחס דמיון משותף.';
        var matches = [angleA, angleB, third].filter(function (ang) { return [50, 60, 70].indexOf(ang) >= 0; });
        if (third <= 0) ctx.note('שתי הזוויות מסתכמות ב־' + m(angleA + angleB + '°') + '. שני הצדדים אינם נפגשים: אין משולש ואין זווית שלישית חיובית.');
        else if (matches.length === 1) ctx.note('רק זווית אחת מתאימה. זווית אחת שווה אינה מספיקה לדמיון; התאם עוד זווית.');
        else ctx.note('התאם שתי זוויות למקור. הזווית השלישית נקבעת מהסכום ' + m('180°') + '.');
      }
    }
    function setPart(key, val) {
      if (key === 'base') baseLength = clamp(Math.round(val), 2, 8);
      else if (key === 'angleA') angleA = clamp(Math.round(val / 5) * 5, 30, 90);
      else angleB = clamp(Math.round(val / 5) * 5, 30, 90);
      ctx.sfx('tick'); render(true);
    }
    wireButtons(box, function (key, delta) { setPart(key, (key === 'base' ? baseLength : key === 'angleA' ? angleA : angleB) + delta * (key === 'base' ? 1 : 5)); });
    [['angleA', 'angleAHandle'], ['angleB', 'angleBHandle']].forEach(function (pair) {
      var node = ctx.el(pair[1]);
      keys(node, 30, 90, 5, function () { return pair[0] === 'angleA' ? angleA : angleB; }, function (val) { setPart(pair[0], val); });
      ctx.drag(node, { move: function (x, y) {
        var anchor = pair[0] === 'angleA' ? currentPts[0] : currentPts[1];
        var degrees = Math.atan2(anchor.y - y, pair[0] === 'angleA' ? x - anchor.x : anchor.x - x) / DEG;
        setPart(pair[0], degrees);
      } });
    });
    render(false);
  }

  function copiesScene(ctx) {
    var factor = 1, guess = 1, filled = false, count = 0, token = 0, completed = false;
    ctx.draw(ht(78, 345, 'עותק קטן') + '<g id="bigLabel">' + ht(252, 0, 'המשולש הגדול') + '</g>'
      + '<polygon points="52,318 104,318 78,273" fill="' + PAL.warmSoft + '" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<polygon id="bigTri" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="3"/><g id="tiles"></g>'
      + mt('copyCount', 252, 350, '', 19, PAL.dark)
      + slider('copiesHandle', 'קודקוד המשולש הגדול: חצים מגדילים או מקטינים את יחס הדמיון', 1, 4, factor));
    var box = ctx.extra('<div class="stepper">' + control('copiesScale', 'יחס הדמיון') + control('guess', 'כמה עותקים?') + '</div>');
    ctx.register('copyControls', box);
    function render() {
      var topY = 318 - 45 * factor;
      attrs(ctx.el('bigTri'), { points: (252 - 26 * factor) + ',318 ' + (252 + 26 * factor) + ',318 252,' + topY });
      attrs(ctx.el('copiesHandle'), { transform: 'translate(252 ' + topY + ')', 'aria-valuenow': factor });
      attrs(ctx.el('bigLabel'), { transform: 'translate(0 ' + (topY - 22) + ')' });
      ctx.el('copyCount').textContent = 'k · k = ' + factor + ' · ' + factor + ' = ' + (filled ? factor * factor : '?');
      markValue(box, 'copiesScale', String(factor), 1, 4); markValue(box, 'guess', String(guess), 1, 20);
      ctx.caption(filled ? m(factor + ' · ' + factor + ' = ' + factor * factor) : 'הניחוש שלך: ' + m(String(guess)) + ' עותקים');
    }
    function change(key, val) {
      token += 1; filled = false; count = 0; ctx.busy(false); ctx.el('tiles').innerHTML = '';
      if (key === 'copiesScale') factor = clamp(Math.round(val), 1, 4); else guess = clamp(Math.round(val), 1, 20);
      ctx.sfx('tick'); render(); ctx.note('בחר יחס דמיון ' + m('3') + ', נחש כמה עותקים ייכנסו, ואז מלא ובדוק.');
    }
    wireButtons(box, function (key, delta) { change(key, (key === 'copiesScale' ? factor : guess) + delta); });
    keys(ctx.el('copiesHandle'), 1, 4, 1, function () { return factor; }, function (val) { change('copiesScale', val); });
    ctx.drag(ctx.el('copiesHandle'), { move: function (_, y) { change('copiesScale', (318 - y) / 45); } });
    ctx.button('מלא בעותקים', function () {
      var runToken = ++token, chosenFactor = factor, chosenGuess = guess;
      ctx.el('tiles').innerHTML = ''; count = 0; filled = false; ctx.busy(true);
      var rows = [];
      for (var row = 0; row < factor; row += 1) {
        var rowHtml = '', yy = 318 - 45 * factor + 45 * row;
        for (var col = 0; col <= row; col += 1) {
          var xx = 252 - 26 * row + 52 * col;
          rowHtml += '<polygon points="' + xx + ',' + yy + ' ' + (xx - 26) + ',' + (yy + 45) + ' ' + (xx + 26) + ',' + (yy + 45) + '" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="1.3"/>';
          if (col < row) rowHtml += '<polygon points="' + xx + ',' + yy + ' ' + (xx + 52) + ',' + yy + ' ' + (xx + 26) + ',' + (yy + 45) + '" fill="' + PAL.line + '" stroke="' + PAL.dark + '" stroke-width="1.3"/>';
        }
        rows.push(rowHtml);
      }
      function endFill() {
        filled = true; ctx.busy(false); render();
        if (chosenGuess === chosenFactor * chosenFactor && chosenFactor === 3) {
          ctx.note('נכון: בשורות יש ' + m('1 + 3 + 5 = 9') + ' עותקים. יחס השטחים הוא ' + m('3² = 9') + '.', 'good');
          if (!completed) { completed = true; ctx.solved(); ctx.sfx('correct'); }
        } else if (chosenGuess === 3 && chosenFactor === 3) ctx.note('הצלעות גדלו פי ' + m('3') + ', אבל השטח פי ' + m('3 · 3 = 9') + '. מספר העותקים הוא יחס השטחים, לא יחס הצלעות.');
        else if (chosenGuess === 6 && chosenFactor === 3) ctx.note('ספור שורה אחר שורה, כולל העותקים ההפוכים: ' + m('1 + 3 + 5 = 9') + ', לא ' + m('6') + '.');
        else if (chosenFactor !== 3) ctx.note('המילוי מראה ' + m(String(chosenFactor * chosenFactor)) + ' עותקים. המשימה מבקשת יחס דמיון ' + m('3') + '; שנה אותו, נחש ומלא שוב.');
        else ctx.note('נכנסו ' + m('9') + ' עותקים. תקן את הניחוש לפי השורות ומלא שוב.');
      }
      function reveal(index) {
        if (runToken !== token || !ctx.isActive()) return;
        ctx.el('tiles').insertAdjacentHTML('beforeend', rows[index]); count += 2 * index + 1;
        ctx.el('copyCount').textContent = String(count);
        if (index === rows.length - 1) endFill();
      }
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      rows.forEach(function (_, index) { if (reducedMotion) reveal(index); else ctx.later(function () { reveal(index); }, 120 * (index + 1)); });
    }, { id: 'fillCopies', target: 'fillCopies' });
    render(); ctx.note('בחר יחס דמיון ' + m('3') + '. לפני המילוי, נחש כמה עותקים קטנים יכסו את הגדול.');
  }

  var steps = [
    {
      mode: 'intro', tA: 'זכוכית המגדלת', sub: 'דמיון משולשים: מה גדל, ומה נשאר בדיוק אותו דבר?',
      tip: 'שלום, אני אליהו. בזכוכית המגדלת כל צלע מוכפלת באותו יחס ' + m('k') + '. נגלה מה קורה לשטח.',
      emoji: '🔍', eq: m('a → k · a'), note: 'הצלעות וההיקף משתנים פי ' + m('k') + '. הזוויות נשמרות, והשטח משתנה פי ' + m('k²') + '.', cue: 'מוכן להגדיל משולש?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'זכוכית מגדלת', sub: 'שנה את יחס הדמיון בגרירה, בכפתורים או בחיצים. בנה תמונה ששטחה פי ' + m('4') + ' מהמקור.',
      tip: 'השטח תלוי בשני ממדים. התבונן גם בצלעות וגם ביחס השטחים.', aspect: [402, 330], alt: 'משולש ישר זווית שצלעותיו שלוש, ארבע וחמש, ותמונתו בהגדלה ממרכז קבוע; סימוני זוויות תואמות וקודקוד נגיש לשינוי היחס',
      cue: 'הגדל את השטח פי ארבע', cueDone: 'שטח התמונה פי ארבע. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'scaleControls', text: 'שנה את יחס הדמיון ותראה איך יחס השטחים משתנה.' }, setup: magnifyScene
    },
    {
      mode: 'quiz', tA: 'הצלע הארוכה בתמונה', sub: 'במשולש צלעות ' + m('4') + ', ' + m('6') + ' ו־' + m('8') + ' ס״מ. במשולש דומה לו הצלע הקצרה ביותר היא ' + m('6') + ' ס״מ. מה אורך הצלע הארוכה ביותר?',
      tip: 'השווה את הצלע הקצרה לצלע הקצרה, ומצא את הכופל המשותף.', btn: 'המשך ←', win: 'נכון. כל צלע מוכפלת באותו יחס.', wrongSay: 'דמיון שומר על כופל משותף, לא על הפרש משותף.',
      opts: [
        { t: m('12') + ' ס״מ', c: true, f: 'נכון: ' + m('k = 6 ÷ 4 = 1.5') + ', ולכן הארוכה ' + m('8 · 1.5 = 12') + ' ס״מ.' },
        { t: m('10') + ' ס״מ', f: 'הוספת את ההפרש ' + m('6 − 4 = 2') + '. בדמיון כופלים כל צלע באותו יחס, לא מוסיפים אותו הפרש.' },
        { t: m('16') + ' ס״מ', f: 'הכפלת פי שניים, אבל ' + m('6 ÷ 4 = 1.5') + ' ולא ' + m('2') + '.' },
        { t: m('9') + ' ס״מ', f: 'זה אורך הצלע האמצעית: ' + m('6 · 1.5 = 9') + '. נשאלת על הארוכה, שמתחילה באורך ' + m('8') + '.' }
      ], hints: ['מצא קודם אילו צלעות מתאימות זו לזו.', 'חלק את הקצרה החדשה בקצרה המקורית.', m('6 ÷ 4 = 1.5') + '. הכפל את הארוכה בכופל הזה.']
    },
    {
      mode: 'scene', tA: 'שתי זוויות מספיקות', sub: 'בנה משולש דומה בגודל אחר: שנה זוויות בגרירה, בכפתורים או בחיצים, ושנה את הבסיס בכפתורים. הציור מותאם למסגרת.',
      tip: 'התאם שתי זוויות למקור. השלישית חייבת להשלים את הסכום ' + m('180°') + '.', aspect: [402, 405], alt: 'משולש מקור עם זוויות חמישים, שישים ושבעים ובסיס ארבע; מתחתיו משולש עם בסיס ושתי זוויות הניתנים לשינוי וידיות על קרני הצלעות',
      cue: 'התאם את הזוויות ושנה את הבסיס מארבע', cueDone: 'אותן זוויות, גודל אחר. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'aaControls', text: 'התאם שתי זוויות בעזרת הפלוס והמינוס. אל תשכח לבחור בסיס אחר.' }, setup: aaScene
    },
    {
      mode: 'quiz', tA: 'האם המשולשים דומים?', sub: 'במשולש אחד זוויות ' + m('40°') + ' ו־' + m('75°') + '. במשולש אחר זוויות ' + m('40°') + ' ו־' + m('65°') + '. האם המשולשים דומים?',
      tip: 'חשב את הזווית השלישית לפני שאתה משווה.', btn: 'המשך ←', win: 'בדיוק. שתי זוויות שוות מספיקות לדמיון: ז.ז.', wrongSay: 'אל תסתפק בזוויות שנכתבו. בכל משולש יש גם זווית שלישית.',
      opts: [
        { t: 'לא, כי ' + m('75° ≠ 65°'), f: 'השווית רק את הזוויות הנתונות ושכחת את השלישית. בראשון היא ' + m('65°') + ' ובשני ' + m('75°') + '.' },
        { t: 'כן, הזווית השלישית בראשון היא ' + m('65°'), c: true, f: 'נכון: ' + m('180° − 40° − 75° = 65°') + '. לשניהם הזוויות ' + m('40°, 65°, 75°') + ', ולכן הם דומים.' },
        { t: 'אי אפשר לדעת בלי הצלעות', f: 'אין צורך באורכי צלעות כשיש שתי זוויות מתאימות שוות. משפט ז.ז מספיק לדמיון.' },
        { t: 'כן, כי לשניהם זווית של ' + m('40°'), f: 'המסקנה נכונה, אך הנימוק אינו מספיק: זווית אחת שווה אינה מבטיחה דמיון. צריך למצוא עוד זווית תואמת.' }
      ], hints: ['השלם כל משולש לסכום הזוויות הקבוע.', 'חשב ' + m('180° − 40° − 75°') + ' והשווה לזוויות של השני.', 'בראשון הזווית הנוספת היא ' + m('65°') + '; בשני הנוספת היא ' + m('75°') + '.']
    },
    {
      mode: 'scene', tA: 'כמה עותקים נכנסים?', sub: 'קבע יחס דמיון ' + m('3') + ' בגרירה, בכפתורים או בחיצים. נחש בכפתורים כמה עותקים ייכנסו, ואז מלא בעותקים.',
      tip: 'לפני שאתה ממלא, נחש. ספור גם את המשולשים ההפוכים בין העותקים.', aspect: [402, 370], alt: 'משולש קטן ומשולש גדול דומה; קודקוד הגדול משנה את יחס הדמיון, והמילוי מציג עותקים של המשולש הקטן בשורות של מספרים אי זוגיים',
      cue: 'בחר יחס שלוש, נחש נכון ומלא', cueDone: 'תשעה עותקים ממלאים את הגדול. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'fillCopies', text: 'בחר יחס וניחוש בכפתורים, ואז לחץ על מלא בעותקים.' }, setup: copiesScene
    },
    {
      mode: 'quiz', tA: 'יחס הדמיון ויחס השטחים', sub: 'יחס הדמיון בין שני משולשים הוא ' + m('1 : 3') + '. שטח המשולש הקטן ' + m('5') + ' סמ״ר. מה שטח המשולש הגדול?',
      tip: 'היחס הנתון הוא יחס הצלעות. השטח משתנה בריבוע של היחס.', btn: 'המשך ←', win: 'נכון. השטח גדל פי תשע, לא פי שלוש.', wrongSay: 'היזכר בתשעת העותקים שמילאו את המשולש הגדול.',
      opts: [
        { t: m('15') + ' סמ״ר', f: 'הכפלת את השטח ב־' + m('k = 3') + ' כמו צלע. שטח צריך לכפול ב־' + m('k² = 9') + '.' },
        { t: m('25') + ' סמ״ר', f: 'העלית את שטח המקור בריבוע: ' + m('5²') + '. בריבוע מעלים את יחס הדמיון, לא את השטח.' },
        { t: m('45') + ' סמ״ר', c: true, f: 'נכון: יחס השטחים ' + m('3² = 9') + ', ולכן ' + m('5 · 9 = 45') + ' סמ״ר.' },
        { t: m('8') + ' סמ״ר', f: 'חיברת ' + m('5 + 3') + '. יחס דמיון הוא כופל, לא תוספת, והשטח מוכפל בריבוע שלו.' }
      ], hints: ['הפרד בין יחס צלעות ליחס שטחים.', 'חשב קודם את ריבוע יחס הדמיון.', m('3 · 3 = 9') + '. הכפל בו את שטח המקור.']
    },
    {
      mode: 'quiz', tA: 'מההיקף אל הצלע', sub: 'ההיקפים של שני משולשים דומים הם ' + m('12') + ' ס״מ ו־' + m('30') + ' ס״מ. צלע במשולש הקטן היא ' + m('4') + ' ס״מ. מה הצלע המתאימה במשולש הגדול?',
      tip: 'יחס ההיקפים שווה ליחס הצלעות. מצא אותו קודם.', btn: 'לסיכום ←', win: 'מעולה. ההיקף והצלעות גדלים באותו יחס.', wrongSay: 'חשב את יחס ההיקפים, והשתמש בו ככופל של הצלע.',
      opts: [
        { t: m('22') + ' ס״מ', f: 'הוספת את הפרש ההיקפים ' + m('30 − 12 = 18') + ' לצלע. בדמיון משתמשים ביחס, לא בהפרש.' },
        { t: m('25') + ' ס״מ', f: 'השתמשת ביחס השטחים ' + m('2.5² = 6.25') + '. צלע משתנה פי ' + m('2.5') + ', לא בריבוע.' },
        { t: m('8') + ' ס״מ', f: 'הכפלת פי שניים, אבל יחס ההיקפים הוא ' + m('30 ÷ 12 = 2.5') + '.' },
        { t: m('10') + ' ס״מ', c: true, f: 'נכון: ' + m('k = 30 ÷ 12 = 2.5') + ', והצלע המתאימה ' + m('4 · 2.5 = 10') + ' ס״מ.' }
      ], hints: ['מצא את היחס בין ההיקף הגדול לקטן.', 'חלק ' + m('30') + ' ב־' + m('12') + '. זה גם יחס הצלעות.', 'הכופל הוא ' + m('2.5') + '. הכפל בו את הצלע ' + m('4') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את זכוכית המגדלת', sub: 'עכשיו אתה יודע להבדיל בין יחס הצלעות ליחס השטחים.',
      tip: 'כל הכבוד. זכוכית המגדלת משנה את הגודל, לא את הזוויות. שתי זוויות מספיקות לדמיון.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'זכוכית המגדלת שומרת על הזוויות. שתי זוויות מתאימות שוות מספיקות לדמיון: ז.ז.',
      formula: 'צלעות והיקף ' + m('× k') + ' · שטח ' + m('× k²')
    }
  ];
  window.NoamGame.boot({
    slug: 'zchuchit-hamagdelet', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'יחס צלעות', math: '8 · 1.5 = 12' },
      { step: 4, name: 'דמיון לפי שתי זוויות', math: '180° − 40° − 75°' },
      { step: 6, name: 'יחס שטחים', math: '5 · 3² = 45' },
      { step: 7, name: 'יחס היקפים', math: '4 · 2.5 = 10' }
    ],
    bonus: {
      label: 'מכונת הדמיון', closeLabel: 'סגור את המכונה', hint: 'קבל זוג משולשים דומים ומצא צלע, שטח או יחס דמיון.',
      setup: function (box, ctx) {
        var question, guessValue = 1;
        box.innerHTML = '<div class="bTitle">מכונת הדמיון</div><div class="bSub" data-question></div>'
          + '<svg viewBox="0 0 402 190" role="img" aria-label="זוג משולשים דומים בגודל שונה" style="width:100%;height:auto"><polygon points="30,175 82,175 30,136" fill="' + PAL.warmSoft + '" stroke="' + PAL.ink + '" stroke-width="2"/><polygon data-bonus-tri fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/></svg>'
          + '<div class="bChip" data-answer dir="ltr"></div><div class="stepper">' + control('bonusGuess', 'התשובה שלך') + '</div><div class="bForms" data-form hidden></div><div class="bOk" data-result role="status" hidden></div><button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button><button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">תרגיל חדש ↻</button>';
        function showGuess() { markValue(box, 'bonusGuess', dec(guessValue), 0.5, 300); box.querySelector('[data-answer]').textContent = dec(guessValue); box.querySelector('[data-result]').hidden = true; box.querySelector('[data-form]').hidden = true; }
        function rollBonus() {
          var k = [2, 3, 4, 1.5][Math.floor(Math.random() * 4)], kind = Math.floor(Math.random() * 3), small = 2 * (1 + Math.floor(Math.random() * 4));
          box.querySelector('[data-bonus-tri]').setAttribute('points', '150,175 ' + (150 + 52 * k) + ',175 150,' + (175 - 39 * k));
          if (kind === 0) question = { text: 'יחס הדמיון ' + bdi('1 : ' + k) + '. צלע קטנה ' + bdi(String(small)) + ' ס״מ. מה הצלע המתאימה בגדול?', answer: small * k, formula: small + ' · ' + k + ' = ' + dec(small * k), hint: 'הכפל את הצלע ביחס הדמיון.' };
          else if (kind === 1) { small *= 2; question = { text: 'יחס הדמיון ' + bdi('1 : ' + k) + '. שטח קטן ' + bdi(String(small)) + ' סמ״ר. מה השטח הגדול?', answer: small * k * k, formula: small + ' · ' + k + '² = ' + dec(small * k * k), hint: 'הכפל את השטח בריבוע יחס הדמיון.' }; }
          else question = { text: 'היקף קטן ' + bdi('12') + ' ס״מ, היקף גדול ' + bdi(String(12 * k)) + ' ס״מ. מה יחס הדמיון מהקטן לגדול?', answer: k, formula: dec(12 * k) + ' ÷ 12 = ' + k, hint: 'חלק את ההיקף הגדול בקטן.' };
          box.querySelector('[data-question]').innerHTML = question.text; guessValue = 1; showGuess();
        }
        wireButtons(box, function (_, delta) { guessValue = clamp(guessValue + delta * 0.5, 0.5, 300); showGuess(); ctx.sfx('tick'); });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var correct = guessValue === question.answer, resultNode = box.querySelector('[data-result]');
          resultNode.hidden = false; resultNode.textContent = correct ? 'נכון! השתמשת ביחס המתאים.' : 'נסה שוב: ' + question.hint; resultNode.style.color = correct ? PAL.good : '#b91c1c'; ctx.sfx(correct ? 'correct' : 'error');
          if (correct) { box.querySelector('[data-form]').hidden = false; box.querySelector('[data-form]').innerHTML = bdi(question.formula); }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { rollBonus(); ctx.sfx('click'); });
        rollBonus();
      }
    }
  });
}());
