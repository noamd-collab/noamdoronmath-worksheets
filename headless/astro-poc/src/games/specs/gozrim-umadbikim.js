/** גוזרים ומדביקים: שינוי הצורה שומר על השטח. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c';

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function attrs(node, values) { Object.keys(values).forEach(function (key) { node.setAttribute(key, values[key]); }); }
  function mathLabel(id, x, y, value, size) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 17) + '" fill="' + PAL.ink + '">' + value + '</text>';
  }
  function hebLabel(id, x, y, value) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="13" font-weight="700" fill="' + PAL.dark + '">' + value + '</text>';
  }
  function handleMarkup(id, label, slider, low, high, value) {
    return '<g id="' + id + '" tabindex="0" role="' + (slider ? 'slider' : 'button') + '" aria-label="' + label + '"'
      + (slider ? ' aria-valuemin="' + low + '" aria-valuemax="' + high + '" aria-valuenow="' + value + '"' : '')
      + ' style="cursor:grab"><rect x="-30" y="-30" width="60" height="60" rx="10" fill="transparent"/>'
      + '<circle r="9" fill="#fff" stroke="' + PAL.main + '" stroke-width="4"/></g>';
  }
  function gridMarkup(x, bottom, unit, cols, rows) {
    var out = '<g pointer-events="none" stroke="' + PAL.line + '" stroke-width="0.8" opacity=".8">';
    for (var i = 0; i <= cols; i++) out += '<line x1="' + (x + unit * i) + '" y1="' + (bottom - rows * unit) + '" x2="' + (x + unit * i) + '" y2="' + bottom + '"/>';
    for (var j = 0; j <= rows; j++) out += '<line x1="' + x + '" y1="' + (bottom - unit * j) + '" x2="' + (x + cols * unit) + '" y2="' + (bottom - unit * j) + '"/>';
    return out + '</g>';
  }
  function stepperMarkup(prefix, entries) {
    return '<div class="stepper" dir="ltr" style="gap:8px">' + entries.map(function (entry) {
      return '<div class="unit" dir="ltr" style="gap:5px;padding:6px"><span class="var math" dir="ltr">' + entry.key + '</span>'
        + '<button type="button" id="' + prefix + entry.key + 'Minus" data-key="' + entry.key + '" data-delta="-1" aria-label="הקטן את ' + entry.label + '">−</button>'
        + '<bdi class="var math" dir="ltr" data-value="' + entry.key + '" style="min-width:28px" aria-live="polite"></bdi>'
        + '<button type="button" id="' + prefix + entry.key + 'Plus" data-key="' + entry.key + '" data-delta="1" aria-label="הגדל את ' + entry.label + '">+</button></div>';
    }).join('') + '</div>';
  }
  function putValues(box, values) { Object.keys(values).forEach(function (key) { box.querySelector('[data-value="' + key + '"]').textContent = String(values[key]); }); }

  function parallelogramScene(ctx) {
    var baseValue = 5, heightValue = 3, cutShown = false, completed = false;
    var unit = 24, left = 40, bottom = 230;
    function gx(value) { return left + unit * value; }
    function gy(value) { return bottom - unit * value; }
    ctx.draw('<polygon id="paraBody" fill="' + PAL.soft + '" stroke="' + PAL.ink + '" stroke-width="2.5"/>'
      + '<polygon id="paraTriangle" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>'
      + gridMarkup(left, bottom, unit, 13, 7)
      + '<line id="paraSlant" stroke="' + PAL.warm + '" stroke-width="3" stroke-dasharray="6 4"/>'
      + '<line id="paraHeight" stroke="' + PAL.good + '" stroke-width="2.5" stroke-dasharray="4 3"/>'
      + '<path id="paraRightAngle" fill="none" stroke="' + PAL.good + '" stroke-width="2"/>'
      + mathLabel('paraBase', 200, 259, '') + mathLabel('paraH', 100, 160, '')
      + hebLabel('paraSlantLabel', 95, 55, 'צלע משופעת')
      + handleMarkup('paraHandle', 'הקודקוד העליון: ימינה ושמאלה משנים בסיס, למעלה ולמטה משנים גובה', false));
    var paraHandle = ctx.el('paraHandle');
    var paraBox = ctx.extra(stepperMarkup('para', [{ key: 'a', label: 'הבסיס' }, { key: 'h', label: 'הגובה' }])
      + '<div class="sceneStrip" style="margin-top:8px"><b>כל משבצת היא יחידת שטח אחת</b><span class="math" dir="ltr" data-area></span></div>');
    ctx.register('paraControls', paraBox);
    function paraRender() {
      var top = gy(heightValue), right = gx(baseValue + 3);
      attrs(ctx.el('paraBody'), { points: cutShown ? gx(3) + ',' + top + ' ' + right + ',' + top + ' ' + gx(baseValue) + ',' + bottom + ' ' + gx(3) + ',' + bottom
        : gx(0) + ',' + bottom + ' ' + gx(baseValue) + ',' + bottom + ' ' + right + ',' + top + ' ' + gx(3) + ',' + top });
      attrs(ctx.el('paraTriangle'), { points: (cutShown ? gx(baseValue) : gx(0)) + ',' + bottom + ' ' + (cutShown ? right : gx(3)) + ',' + top + ' ' + (cutShown ? right : gx(3)) + ',' + bottom });
      attrs(ctx.el('paraSlant'), { x1: gx(0), y1: bottom, x2: gx(3), y2: top, opacity: cutShown ? '0' : '1' });
      ctx.el('paraSlantLabel').setAttribute('opacity', cutShown ? '0' : '1');
      attrs(ctx.el('paraHeight'), { x1: gx(3), y1: top, x2: gx(3), y2: bottom });
      attrs(ctx.el('paraRightAngle'), { d: 'M' + gx(3) + ' ' + (bottom - 9) + ' h9 v9' });
      attrs(paraHandle, { transform: 'translate(' + right + ' ' + top + ')', 'aria-label': 'בסיס ' + m(String(baseValue)) + ', גובה ' + m(String(heightValue)) + '. שמאלה וימינה משנים בסיס; למעלה ולמטה משנים גובה' });
      attrs(ctx.el('paraBase'), { x: cutShown ? (gx(3) + right) / 2 : (gx(0) + gx(baseValue)) / 2 });
      ctx.el('paraBase').textContent = 'a = ' + baseValue;
      attrs(ctx.el('paraH'), { x: gx(3) + 20, y: (top + bottom) / 2 });
      ctx.el('paraH').textContent = 'h = ' + heightValue;
      putValues(paraBox, { a: baseValue, h: heightValue });
      paraBox.querySelector('[data-area]').textContent = 'S = ' + baseValue + ' · ' + heightValue + ' = ' + baseValue * heightValue;
      ctx.caption(m('S = a · h'));
      if (cutShown) {
        var correct = baseValue * heightValue === 24;
        ctx.note((correct ? 'בדיוק: השטח נשאר ' + m('24') + '.' : 'השטח עכשיו ' + m(String(baseValue * heightValue)) + ', וצריך ' + m('24') + '.')
          + ' הגובה הוא המרחק הישר למעלה בין הבסיסים, לא הצלע המשופעת.', correct ? 'good' : undefined);
        if (correct && !completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
      } else ctx.note('בנה שטח ' + m('24') + ' ואז גזור והזז. הגובה הירוק ניצב לבסיס.');
    }
    function paraSet(nextBase, nextHeight) {
      baseValue = clamp(nextBase, 3, 10); heightValue = clamp(nextHeight, 2, 6); cutShown = false;
      ctx.sfx('tick'); paraRender();
    }
    paraBox.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        var delta = Number(buttonNode.getAttribute('data-delta'));
        paraSet(baseValue + (buttonNode.getAttribute('data-key') === 'a' ? delta : 0), heightValue + (buttonNode.getAttribute('data-key') === 'h' ? delta : 0));
      });
    });
    paraHandle.addEventListener('keydown', function (event) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.key) < 0) return;
      event.preventDefault();
      paraSet(baseValue + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0), heightValue + (event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0));
    });
    ctx.drag(paraHandle, { move: function (x, y) { paraSet(Math.round((x - left) / unit) - 3, Math.round((bottom - y) / unit)); } });
    ctx.button('גזור והזז', function () { cutShown = true; ctx.sfx('click'); paraRender(); }, { id: 'paraCut', target: 'paraCut' });
    paraRender();
  }

  function trapezoidScene(ctx) {
    var shortBase = 3, longBase = 5, trapHeight = 2, copyShown = false, completedTrap = false;
    var unit = 17, left = 35, bottom = 215;
    function tx(value) { return left + unit * value; }
    function ty(value) { return bottom - unit * value; }
    ctx.draw('<polygon id="trapOriginal" fill="' + PAL.soft + '" stroke="' + PAL.ink + '" stroke-width="2.5"/>'
      + '<polygon id="trapCopy" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '" stroke-width="2.5" opacity="0"/>'
      + gridMarkup(left, bottom, unit, 19, 8)
      + '<line id="trapHeightLine" stroke="' + PAL.good + '" stroke-width="2" stroke-dasharray="4 3"/>'
      + mathLabel('trapA', 100, 140, '') + mathLabel('trapB', 100, 241, '') + mathLabel('trapH', 100, 170, '')
      + mathLabel('trapCombined', 230, 65, '')
      + handleMarkup('trapAHandle', 'קצה הבסיס העליון: חצים משנים את הבסיס הקצר', true, 1, 8, shortBase)
      + handleMarkup('trapHHandle', 'הפינה העליונה השמאלית: חצים משנים את הגובה', true, 2, 6, trapHeight));
    var aHandle = ctx.el('trapAHandle'), hHandle = ctx.el('trapHHandle');
    var trapBox = ctx.extra(stepperMarkup('trap', [{ key: 'a', label: 'הבסיס הקצר' }, { key: 'b', label: 'הבסיס הארוך' }, { key: 'h', label: 'הגובה' }])
      + '<div class="sceneStrip" style="margin-top:8px"><b>שני טרפזים: שטח המקבילית</b><span class="math" dir="ltr" data-double></span>'
      + '<b>טרפז אחד: מחצית השטח</b><span class="math" dir="ltr" data-single></span></div>');
    ctx.register('trapControls', trapBox);
    function trapRender() {
      var top = ty(trapHeight), twice = (shortBase + longBase) * trapHeight;
      attrs(ctx.el('trapOriginal'), { points: tx(0) + ',' + bottom + ' ' + tx(longBase) + ',' + bottom + ' ' + tx(1 + shortBase) + ',' + top + ' ' + tx(1) + ',' + top });
      attrs(ctx.el('trapCopy'), { opacity: copyShown ? '1' : '0', points: tx(longBase) + ',' + bottom + ' ' + tx(longBase + shortBase) + ',' + bottom + ' ' + tx(1 + longBase + shortBase) + ',' + top + ' ' + tx(1 + shortBase) + ',' + top });
      attrs(ctx.el('trapHeightLine'), { x1: tx(1), y1: top, x2: tx(1), y2: bottom });
      attrs(aHandle, { transform: 'translate(' + tx(1 + shortBase) + ' ' + top + ')', 'aria-valuenow': shortBase });
      attrs(hHandle, { transform: 'translate(' + tx(1) + ' ' + top + ')', 'aria-valuenow': trapHeight });
      attrs(ctx.el('trapA'), { x: tx(1 + shortBase / 2), y: top - 34 }); ctx.el('trapA').textContent = 'a = ' + shortBase;
      attrs(ctx.el('trapB'), { x: tx(longBase / 2) }); ctx.el('trapB').textContent = 'b = ' + longBase;
      attrs(ctx.el('trapH'), { x: tx(1) + 28, y: (top + bottom) / 2 + 5 }); ctx.el('trapH').textContent = 'h = ' + trapHeight;
      ctx.el('trapCombined').textContent = copyShown ? 'a + b = ' + (shortBase + longBase) : '';
      putValues(trapBox, { a: shortBase, b: longBase, h: trapHeight });
      trapBox.querySelector('[data-double]').textContent = '(' + shortBase + ' + ' + longBase + ') · ' + trapHeight + ' = ' + twice;
      trapBox.querySelector('[data-single]').textContent = twice + ' ÷ 2 = ' + twice / 2;
      ctx.caption(m('S = (a + b) · h ÷ 2'));
      if (shortBase === longBase) ctx.note('כששני הבסיסים שווים זו כבר מקבילית, ולא טרפז בעל בסיסים שונים. שנה אחד מהבסיסים.');
      else if (twice === 20) ctx.note('זה שטח המקבילית של שני טרפזים: ' + m('20') + '. טרפז אחד הוא חצי ממנו: ' + m('10') + '. צריך שטח ' + m('20') + ' לטרפז אחד.');
      else if (twice === 40 && copyShown) {
        ctx.note('שני העותקים יוצרים מקבילית בשטח ' + m('40') + '. כל טרפז הוא חצי: ' + m('40 ÷ 2 = 20') + '.', 'good');
        if (!completedTrap) { completedTrap = true; ctx.sfx('correct'); ctx.solved(); }
      } else ctx.note('שטח הטרפז עכשיו ' + m(String(twice / 2)) + '. בנה שטח ' + m('20') + ' והצמד עותק מסובב.');
    }
    function trapSet(key, value) {
      if (key === 'a') shortBase = clamp(value, 1, 8);
      if (key === 'b') longBase = clamp(value, 2, 10);
      if (key === 'h') trapHeight = clamp(value, 2, 6);
      copyShown = false; ctx.sfx('tick'); trapRender();
    }
    trapBox.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        var key = buttonNode.getAttribute('data-key');
        trapSet(key, (key === 'a' ? shortBase : key === 'b' ? longBase : trapHeight) + Number(buttonNode.getAttribute('data-delta')));
      });
    });
    [['a', aHandle], ['h', hHandle]].forEach(function (entry) {
      entry[1].addEventListener('keydown', function (event) {
        var delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
        if (!delta && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        trapSet(entry[0], event.key === 'Home' ? (entry[0] === 'a' ? 1 : 2) : event.key === 'End' ? (entry[0] === 'a' ? 8 : 6) : (entry[0] === 'a' ? shortBase : trapHeight) + delta);
      });
    });
    ctx.drag(aHandle, { move: function (x) { trapSet('a', Math.round((x - left) / unit) - 1); } });
    ctx.drag(hHandle, { move: function (x, y) { trapSet('h', Math.round((bottom - y) / unit)); } });
    ctx.button('סובב עותק והצמד', function () { copyShown = true; ctx.sfx('click'); trapRender(); }, { id: 'trapJoin', target: 'trapJoin' });
    trapRender();
  }

  function compositeScene(ctx) {
    var horizontal = true, cutValue = 2, cleanSeen = false, completionSeen = false, compositeDone = false;
    var unit = 28, left = 55, bottom = 258;
    function lx(value) { return left + unit * value; }
    function ly(value) { return bottom - unit * value; }
    var shapePoints = lx(0) + ',' + ly(0) + ' ' + lx(10) + ',' + ly(0) + ' ' + lx(10) + ',' + ly(5) + ' ' + lx(6) + ',' + ly(5) + ' ' + lx(6) + ',' + ly(8) + ' ' + lx(0) + ',' + ly(8);
    ctx.draw('<defs><clipPath id="lClipA"><rect id="lRectA"/></clipPath><clipPath id="lClipB"><rect id="lRectB"/></clipPath></defs>'
      + '<polygon points="' + shapePoints + '" fill="' + PAL.soft + '" clip-path="url(#lClipA)"/>'
      + '<polygon points="' + shapePoints + '" fill="' + PAL.goodSoft + '" clip-path="url(#lClipB)"/>'
      + '<rect id="lMissing" x="' + lx(6) + '" y="' + ly(8) + '" width="112" height="84" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2" stroke-dasharray="6 4" opacity="0"/>'
      + gridMarkup(left, bottom, unit, 10, 8)
      + '<polygon points="' + shapePoints + '" fill="none" stroke="' + PAL.ink + '" stroke-width="2.5"/>'
      + '<line id="lCut" stroke="' + PAL.main + '" stroke-width="3" stroke-dasharray="6 3"/>'
      + mathLabel('lAreaA', 160, 210, '', 20) + mathLabel('lAreaB', 140, 100, '', 20)
      + mathLabel('lMissingArea', lx(8), ly(6.5) + 7, '')
      + mathLabel('lWidth', lx(5), 287, '10') + mathLabel('lHeight', 30, ly(4), '8')
      + mathLabel('lHoleWidth', lx(8), 23, '4') + mathLabel('lHoleHeight', 359, ly(6.5), '3')
      + handleMarkup('lHandle', 'קו הפירוק: הזז בחיצים עד ששני החלקים מלבנים', true, 1, 7, cutValue));
    var cutHandle = ctx.el('lHandle');
    var lBox = ctx.extra(stepperMarkup('l', [{ key: 'cut', label: 'מיקום קו הפירוק' }])
      + '<div class="sceneStrip" style="margin-top:8px"><b data-direction></b><span class="math" dir="ltr" data-split></span><b data-progress></b></div>');
    ctx.register('lControls', lBox);
    function checkComposite() {
      if (cleanSeen && completionSeen && !compositeDone) { compositeDone = true; ctx.sfx('correct'); ctx.solved(); }
    }
    function splitRender(acted) {
      var clean = horizontal ? cutValue === 5 : cutValue === 6;
      var areaA = horizontal ? 10 * Math.min(cutValue, 5) + 6 * Math.max(cutValue - 5, 0) : 8 * Math.min(cutValue, 6) + 5 * Math.max(cutValue - 6, 0);
      if (horizontal) {
        attrs(ctx.el('lRectA'), { x: left, y: ly(cutValue), width: 280, height: unit * cutValue });
        attrs(ctx.el('lRectB'), { x: left, y: ly(8), width: 280, height: unit * (8 - cutValue) });
        attrs(ctx.el('lCut'), { x1: left, y1: ly(cutValue), x2: lx(cutValue > 5 ? 6 : 10), y2: ly(cutValue) });
        attrs(cutHandle, { transform: 'translate(' + lx(5) + ' ' + ly(cutValue) + ')', 'aria-valuemax': 7 });
        attrs(ctx.el('lAreaA'), { x: lx(cutValue > 5 ? 3 : 5), y: ly(cutValue / 2) + 7 });
        attrs(ctx.el('lAreaB'), { x: lx(3), y: ly((cutValue + 8) / 2) + 7 });
      } else {
        attrs(ctx.el('lRectA'), { x: left, y: ly(8), width: unit * cutValue, height: 224 });
        attrs(ctx.el('lRectB'), { x: lx(cutValue), y: ly(8), width: unit * (10 - cutValue), height: 224 });
        attrs(ctx.el('lCut'), { x1: lx(cutValue), y1: bottom, x2: lx(cutValue), y2: ly(cutValue > 6 ? 5 : 8) });
        attrs(cutHandle, { transform: 'translate(' + lx(cutValue) + ' ' + ly(3) + ')', 'aria-valuemax': 9 });
        attrs(ctx.el('lAreaA'), { x: lx(cutValue / 2), y: ly(4) + 7 });
        attrs(ctx.el('lAreaB'), { x: lx((cutValue + 10) / 2), y: ly(2.5) + 7 });
      }
      cutHandle.setAttribute('aria-valuenow', cutValue);
      ctx.el('lAreaA').textContent = String(areaA); ctx.el('lAreaB').textContent = String(68 - areaA);
      putValues(lBox, { cut: cutValue });
      lBox.querySelector('[data-direction]').textContent = horizontal ? 'פירוק אופקי — הגובה נמדד מלמטה' : 'פירוק אנכי — המיקום נמדד משמאל';
      lBox.querySelector('[data-split]').textContent = clean ? (horizontal ? '10 · 5 + 6 · 3 = 50 + 18 = 68' : '6 · 8 + 4 · 5 = 48 + 20 = 68') : areaA + ' + ' + (68 - areaA) + ' = 68';
      if (clean && acted) cleanSeen = true;
      lBox.querySelector('[data-progress]').textContent = 'פירוק למלבנים: ' + (cleanSeen ? 'נבדק' : 'עוד לא') + ' · השלמה וחיסור: ' + (completionSeen ? 'נבדקו' : 'עוד לא');
      ctx.caption(m('S = ' + areaA + ' + ' + (68 - areaA) + ' = 68'));
      ctx.note(clean ? 'זה פירוק נקי לשני מלבנים. ' + (completionSeen ? 'גם השלמת וחיסרת: אותה תוצאה בשתי דרכים.' : 'עכשיו לחץ על השלם וחסר כדי למצוא את השטח בדרך שנייה.')
        : 'אחד החלקים עדיין אינו מלבן. הזז את הקו עד ששני החלקים יהיו מלבנים.', clean ? 'good' : undefined);
      checkComposite();
    }
    function setCut(value) { cutValue = clamp(value, 1, horizontal ? 7 : 9); ctx.sfx('tick'); splitRender(true); }
    lBox.querySelectorAll('[data-delta]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { setCut(cutValue + Number(buttonNode.getAttribute('data-delta'))); }); });
    cutHandle.addEventListener('keydown', function (event) {
      var delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
      if (!delta && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault(); setCut(event.key === 'Home' ? 1 : event.key === 'End' ? (horizontal ? 7 : 9) : cutValue + delta);
    });
    ctx.drag(cutHandle, { move: function (x, y) { setCut(Math.round(horizontal ? (bottom - y) / unit : (x - left) / unit)); } });
    ctx.button('החלף אופקי ואנכי', function () { horizontal = !horizontal; cutValue = clamp(cutValue, 1, horizontal ? 7 : 9); splitRender(true); }, { id: 'lToggle', ghost: true });
    ctx.button('השלם וחסר', function () {
      completionSeen = true; ctx.el('lMissing').setAttribute('opacity', '1'); ctx.el('lMissingArea').textContent = '12';
      splitRender(false); ctx.caption(m('80 − 12 = 68'));
      ctx.note('המלבן הגדול: ' + m('10 · 8 = 80') + '. הפינה החסרה: ' + m('4 · 3 = 12') + '. מחסרים: ' + m('80 − 12 = 68') + '.' + (cleanSeen ? ' מצאת אותו שטח בשתי דרכים.' : ' עכשיו מצא גם פירוק נקי למלבנים.'), 'good');
      checkComposite();
    }, { id: 'lComplete', target: 'lComplete' });
    ctx.button('חבר את החלק החסר', function () {
      ctx.el('lMissing').setAttribute('opacity', '1'); ctx.el('lMissingArea').textContent = '12';
      ctx.caption(m('80 + 12 = 92'));
      ctx.note('הפינה החסרה אינה חלק מהצורה, ולכן מחסרים אותה. חיבור נותן ' + m('80 + 12 = 92') + ', ולא את שטח הצורה.');
      ctx.sfx('error');
    }, { id: 'lWrongAdd', ghost: true });
    splitRender(false);
  }

  var steps = [
    { mode: 'intro', tA: 'גוזרים ומדביקים', sub: 'מקבילית, טרפז וצורה מורכבת — השטח מתגלה מתוך הציור.',
      tip: 'שלום, אני אליהו. בוא נגזור ונזיז חלקים, בלי להוסיף ובלי לאבד שטח.', emoji: '✂️', eq: m('S = a · h'),
      note: 'משבצת אחת היא יחידת שטח אחת. משנים את הצורה, אבל כל החלקים נשארים.', cue: 'מוכן לגלות את השטח?', btn: 'בוא נתחיל ←' },
    { mode: 'scene', tA: 'מקבילית הופכת למלבן', sub: 'שנה בסיס וגובה בגרירה, בכפתורים או בחיצים. בנה שטח ' + m('24') + ' ולחץ על גזור והזז.',
      tip: 'חפש בסיס כפול גובה שנותנים ' + m('24') + '. שים לב לגובה הירוק, ולא לצלע המשופעת.',
      aspect: [402, 280], alt: 'מקבילית על רשת משבצות עם בסיס וגובה משתנים, משולש לגזירה וקודקוד נגיש להזזה',
      cue: 'בנה את השטח המבוקש וגזור', cueDone: 'השטח נשמר במלבן. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'paraControls', text: 'שנה את הבסיס ואת הגובה, ואז לחץ על גזור והזז.' }, setup: parallelogramScene },
    { mode: 'quiz', tA: 'מה שטח המקבילית?', sub: 'הבסיס ' + m('9') + ' ס״מ, הגובה לבסיס ' + m('4') + ' ס״מ, והצלע המשופעת ' + m('5') + ' ס״מ.',
      tip: 'בחר את המרחק הניצב בין הבסיסים. זו המידה שצריך לכפול בבסיס.', btn: 'המשך ←', win: 'נכון. כופלים בסיס בגובה, לא בצלע המשופעת.', wrongSay: 'בדוק אם השתמשת בגובה, ואם חישבת שטח ולא היקף.',
      opts: [
        { t: m('36') + ' סמ״ר', c: true, f: 'נכון: ' + m('9 · 4 = 36') + '. הגובה ניצב לבסיס.' },
        { t: m('45') + ' סמ״ר', f: 'כפלת בצלע המשופעת: ' + m('9 · 5') + '. צריך לכפול בגובה לבסיס, שהוא ' + m('4') + '.' },
        { t: m('18') + ' סמ״ר', f: 'חילקת לשניים כאילו זו משולש. מקבילית הופכת למלבן שלם, ואין לחלק את השטח לשניים.' },
        { t: m('28') + ' סמ״ר', f: 'חישבת היקף: ' + m('2 · (9 + 5) = 28') + '. שטח מחושב באמצעות הבסיס והגובה.' }
      ], hints: ['איזו מידה ניצבת לבסיס?', 'במקבילית כופלים בסיס בגובה, בלי לחלק לשניים.', 'חשב ' + m('9 · 4') + '.'] },
    { mode: 'scene', tA: 'שני טרפזים יוצרים מקבילית', sub: 'שנה את הבסיסים והגובה בגרירה, בכפתורים או בחיצים. בנה טרפז בשטח ' + m('20') + ' והצמד עותק מסובב.',
      tip: 'שני טרפזים זהים יוצרים מקבילית. שטח של טרפז אחד הוא חצי משטח שניהם.',
      aspect: [402, 260], alt: 'טרפז על רשת עם בסיסים וגובה משתנים, שתי ידיות נגישות ועותק שמסתובב חצי סיבוב ונצמד למקבילית',
      cue: 'בנה טרפז בשטח המבוקש והצמד עותק', cueDone: 'שני טרפזים, מקבילית אחת. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'trapControls', text: 'חבר את שני הבסיסים, כפל בגובה וחלק לשניים.' }, setup: trapezoidScene },
    { mode: 'quiz', tA: 'מה שטח הטרפז?', sub: 'הבסיסים ' + m('6') + ' ס״מ ו־' + m('10') + ' ס״מ, והגובה ' + m('5') + ' ס״מ.',
      tip: 'חבר את שני הבסיסים. המקבילית של שני העותקים גדולה פי שניים מטרפז אחד.', btn: 'המשך ←', win: 'נכון. סכום הבסיסים כפול הגובה, ואז חצי.', wrongSay: 'חשוב על שני העותקים: מה שטח שניהם, ומה שטח אחד?',
      opts: [
        { t: m('80') + ' סמ״ר', f: 'זה שטח המקבילית של שני טרפזים: ' + m('(6 + 10) · 5 = 80') + '. שכחת לחלק לשניים.' },
        { t: m('40') + ' סמ״ר', c: true, f: 'נכון: ' + m('(6 + 10) · 5 ÷ 2 = 40') + '.' },
        { t: m('300') + ' סמ״ר', f: 'כפלת את כל שלוש המידות. את שני הבסיסים מחברים, לא כופלים זה בזה.' },
        { t: m('21') + ' סמ״ר', f: 'חיברת את כל המידות: ' + m('6 + 10 + 5 = 21') + '. אחרי חיבור הבסיסים צריך לכפול בגובה ולחלק לשניים.' }
      ], hints: ['התחל משני הבסיסים, לא מכפל שלוש מידות.', 'חבר בסיסים, כפל בגובה, וקח חצי.', 'חשב ' + m('16 · 5 ÷ 2') + '.'] },
    { mode: 'scene', tA: 'מפרקים או משלימים', sub: 'הזז את קו הפירוק בגרירה, בכפתורים או בחיצים. מצא שטח ' + m('68') + ' בפירוק למלבנים וגם בהשלמה וחיסור.',
      tip: 'אפשר לפרק לצורות מוכרות, או להשלים למלבן ולחסר את הפינה החסרה.',
      aspect: [402, 304], alt: 'צורה בצורת האות אל על רשת: מלבן עשר על שמונה עם פינה ימנית עליונה ארבע על שלוש חסרה; קו חיתוך נגיש',
      cue: 'מצא פירוק נקי וגם השלמה וחיסור', cueDone: 'אותו שטח בשתי דרכים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'lControls', text: 'הזז את הקו עד ששני החלקים מלבנים, ואז לחץ על השלם וחסר.' }, setup: compositeScene },
    { mode: 'quiz', tA: 'מלבן עם חור', sub: 'מלבן בגודל ' + m('12') + ' על ' + m('9') + ' ס״מ. באמצעו חור ריבועי בגודל ' + m('3') + ' על ' + m('3') + ' ס״מ. מה שטח הצורה?',
      tip: 'החור אינו חלק מהצורה. חשב את שטחו לפני שתחסר.', btn: 'המשך ←', win: 'נכון. מחסרים את שטח החור משטח המלבן.', wrongSay: 'בדוק שחיסרת שטח, לא אורך, ושהחור לא נוסף לצורה.',
      opts: [
        { t: m('117') + ' סמ״ר', f: 'הוספת את החור: ' + m('108 + 9 = 117') + '. החור חסר מהצורה, ולכן צריך לחסר.' },
        { t: m('105') + ' סמ״ר', f: 'חיסרת אורך ' + m('3') + ' במקום את שטח החור. שטח הריבוע הוא ' + m('3 · 3 = 9') + '.' },
        { t: m('99') + ' סמ״ר', c: true, f: 'נכון: ' + m('12 · 9 − 3 · 3 = 108 − 9 = 99') + '.' },
        { t: m('42') + ' סמ״ר', f: 'חישבת את היקף המלבן: ' + m('2 · (12 + 9) = 42') + '. כאן מבקשים את השטח שנשאר.' }
      ], hints: ['חשב בנפרד את המלבן ואת החור.', 'שטח החור הריבועי הוא צלע כפול צלע.', 'מהשטח ' + m('108') + ' חסר ' + m('9') + '.'] },
    { mode: 'quiz', tA: 'מוצאים את הגובה', sub: 'שטח מקבילית הוא ' + m('42') + ' סמ״ר והבסיס ' + m('7') + ' ס״מ. מה הגובה לבסיס הזה?',
      tip: 'בסיס כפול גובה נותנים את השטח. איזו פעולה מבטלת את הכפל בבסיס?', btn: 'לסיכום ←', win: 'נכון. גובה הוא השטח חלקי הבסיס.', wrongSay: 'חפש איזה גובה, כשהוא מוכפל בבסיס, נותן את השטח.',
      opts: [
        { t: m('12') + ' ס״מ', f: 'הכפלת את השטח בשניים כמו בנוסחת משולש. זו מקבילית, ולכן אין גורם של שניים.' },
        { t: m('35') + ' ס״מ', f: 'חיסרת בסיס משטח. כדי לבטל את הכפל בבסיס, מחלקים בו.' },
        { t: m('294') + ' ס״מ', f: 'כפלת שטח בבסיס במקום לחלק. הכפל בבסיס כבר נמצא בנוסחת השטח.' },
        { t: m('6') + ' ס״מ', c: true, f: 'נכון: ' + m('h = 42 ÷ 7 = 6') + '. בדיקה: ' + m('7 · 6 = 42') + '.' }
      ], hints: ['כתוב בסיס כפול גובה שווה שטח.', 'בטל את הכפל בבסיס בעזרת חילוק.', 'חשב ' + m('42 ÷ 7') + '.'] },
    { mode: 'finish', tA: 'השטח נשאר, הצורה משתנה', sub: 'גזרת, הצמדת ופירקת — וגילית את נוסחאות השטח.',
      tip: 'כל הכבוד. חפש גובה ניצב, ושמור על כל החלקים כשאתה משנה את הצורה.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'גזירה והזזה שומרות על השטח. שני טרפזים יוצרים מקבילית; מצולע מורכב מפרקים או משלימים ומחסרים.',
      formula: 'מקבילית: ' + m('S = a · h') + ' · טרפז: ' + m('S = (a + b) · h ÷ 2') }
  ];

  window.NoamGame.boot({
    slug: 'gozrim-umadbikim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'גובה ושטח מקבילית', math: 'S = a · h' },
      { step: 4, name: 'שטח טרפז', math: 'S = (a + b) · h ÷ 2' },
      { step: 6, name: 'שטח צורה עם חור', math: '108 − 9 = 99' },
      { step: 7, name: 'מציאת גובה', math: 'h = S ÷ a' }
    ],
    bonus: {
      label: 'מכונת השטחים', closeLabel: 'סגור את המכונה', hint: 'קבל צורה חדשה ומצא את השטח, או את הגובה החסר.',
      setup: function (box, ctx) {
        var sample = null, guess = 0;
        function randomInt(low, high) { return low + Math.floor(Math.random() * (high - low + 1)); }
        box.innerHTML = '<div class="bTitle">מכונת השטחים</div><div class="bSub" data-question></div><div class="bChip" data-expression dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr"><button type="button" data-d="-10" aria-label="הקטן בעשר">−10</button>'
          + '<button type="button" data-d="-1" aria-label="הקטן באחת">−1</button><bdi class="var math" data-guess dir="ltr" aria-live="polite" style="min-width:40px">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל באחת">+1</button><button type="button" data-d="10" aria-label="הגדל בעשר">+10</button></div></div>'
          + '<div class="bForms" data-solution dir="ltr" hidden></div><div class="bOk" data-result role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">צורה חדשה ↻</button>';
        function rollSample() {
          var kind = randomInt(0, 2), base = randomInt(3, 10), height = randomInt(2, 6), other = randomInt(1, 8);
          var missingHeight = Math.random() < 0.3 && kind !== 2;
          if (kind === 0) sample = { answer: missingHeight ? height : base * height, question: missingHeight ? 'מקבילית: נתונים שטח ובסיס. מה הגובה?' : 'מקבילית: נתונים בסיס וגובה. מה השטח?', expression: missingHeight ? 'S = ' + base * height + ', a = ' + base : 'a = ' + base + ', h = ' + height, solution: missingHeight ? base * height + ' ÷ ' + base + ' = ' + height : base + ' · ' + height + ' = ' + base * height };
          if (kind === 1) {
            if (base === other) other = base - 1;
            height = randomInt(1, 3) * 2;
            var area = (base + other) * height / 2;
            sample = { answer: missingHeight ? height : area, question: missingHeight ? 'טרפז: נתונים שטח ובסיסים. מה הגובה?' : 'טרפז: נתונים בסיסים וגובה. מה השטח?', expression: 'a = ' + Math.min(base, other) + ', b = ' + Math.max(base, other) + (missingHeight ? ', S = ' + area : ', h = ' + height), solution: missingHeight ? '2 · ' + area + ' ÷ (' + base + ' + ' + other + ') = ' + height : '(' + base + ' + ' + other + ') · ' + height + ' ÷ 2 = ' + area };
          }
          if (kind === 2) {
            var width = randomInt(6, 12), tall = randomInt(4, 10), holeWidth = randomInt(1, width - 2), holeHeight = randomInt(1, tall - 2);
            var lArea = width * tall - holeWidth * holeHeight;
            sample = { answer: lArea, question: 'צורת אל: ממלבן גדול חסרה פינה. מה השטח?', expression: width + ' × ' + tall + ' − ' + holeWidth + ' × ' + holeHeight, solution: width * tall + ' − ' + holeWidth * holeHeight + ' = ' + lArea };
          }
          guess = 0; box.querySelector('[data-question]').textContent = sample.question;
          box.querySelector('[data-expression]').textContent = sample.expression;
          bonusShowGuess();
        }
        function bonusShowGuess() { box.querySelector('[data-guess]').textContent = String(guess); box.querySelector('[data-result]').hidden = true; box.querySelector('[data-solution]').hidden = true; }
        box.querySelectorAll('[data-d]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-d')), 0, 120); ctx.sfx('tick'); bonusShowGuess(); }); });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var resultNode = box.querySelector('[data-result]'), correct = guess === sample.answer;
          resultNode.hidden = false; resultNode.textContent = correct ? 'נכון! שמרת על השטח ועל החלקים.' : 'עוד לא. בדוק בסיס וגובה, חצי בטרפז, וחיסור של החלק החסר.';
          resultNode.style.color = correct ? PAL.good : BAD; ctx.sfx(correct ? 'correct' : 'error');
          if (correct) { box.querySelector('[data-solution]').hidden = false; box.querySelector('[data-solution]').textContent = sample.solution; }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); rollSample(); });
        rollSample();
      }
    }
  });
}());
