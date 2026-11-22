/** הממוצע הוא חלוקה שווה של הסכום; הטווח מתאר פיזור והחציון עמיד לנתון קיצוני. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var WIDTH = 402;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function totalOf(values) { return values.reduce(function (a, b) { return a + b; }, 0); }
  function showNumber(v) { return String(Math.round(v * 100) / 100); }
  function bdi(v) { return '<bdi class="math" dir="ltr">' + v + '</bdi>'; }
  function fraction(top, bottom) {
    return '<span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.25;margin:0 5px;font-family:Secular One,sans-serif" dir="ltr">'
      + '<span style="padding:0 7px;border-bottom:2px solid currentColor">' + bdi(top) + '</span><span>' + bdi(bottom) + '</span></span>';
  }
  function meanRule() {
    return '<div style="display:flex;align-items:center;justify-content:center;gap:7px;font:700 17px Heebo,sans-serif" dir="rtl">'
      + '<span>ממוצע</span>' + bdi('=') + '<span style="display:inline-flex;flex-direction:column;text-align:center;line-height:1.5"><span style="border-bottom:2px solid currentColor;padding:0 8px">סכום</span><span>כמות</span></span></div>';
  }
  function mathSvg(id, x, y, text, colour, size) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 16) + '" text-anchor="middle" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function hebSvg(x, y, text) {
    return '<text x="' + x + '" y="' + y + '" font-family="Heebo, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="' + PAL.ink + '">' + text + '</text>';
  }
  function axisMarkup(max, y, tickStep) {
    var out = '<line x1="50" y1="' + y + '" x2="352" y2="' + y + '" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (var tick = 0; tick <= max; tick += tickStep) {
      var tickX = 50 + 302 * tick / max;
      out += '<line x1="' + tickX + '" y1="' + (y - 5) + '" x2="' + tickX + '" y2="' + (y + 5) + '" stroke="' + PAL.ink + '"/>' + mathSvg('', tickX, y + 24, tick, PAL.ink, 13);
    }
    return out;
  }
  function sliderMarkup(id, label, max) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="0" style="cursor:grab">'
      + '<rect x="-30" y="-30" width="60" height="60" rx="10" fill="transparent"/>'
      + '<circle class="dotFace" r="10" fill="' + PAL.main + '" stroke="#fff" stroke-width="3"/>' + mathSvg(id + 'Value', 0, 27, '', PAL.dark, 15) + '</g>';
  }
  function stepperMarkup(prefix, label) {
    return '<div class="stepper" dir="ltr" style="margin-top:10px"><div class="unit" dir="ltr">'
      + '<button type="button" id="' + prefix + 'Minus" aria-label="הקטן את ' + label + ' באחד">−</button>'
      + '<bdi class="var math" dir="ltr" id="' + prefix + 'Value" style="min-width:40px" aria-live="polite">0</bdi>'
      + '<button type="button" id="' + prefix + 'Plus" aria-label="הגדל את ' + label + ' באחד">+</button></div></div>';
  }
  function wireSliderKeys(handle, getValue, setValue, maximum) {
    handle.addEventListener('keydown', function (event) {
      var delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }[event.key];
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); setValue(event.key === 'Home' ? 0 : maximum); return;
      }
      if (!delta) return;
      event.preventDefault(); setValue(getValue() + delta);
    });
  }

  function towersScene(ctx) {
    var heights = [3, 7, 4, 9, 2], selected = -1, movedOnce = false, finished = false;
    var centers = [57, 129, 201, 273, 345], towerHandles = [], towerButtons = [];
    var cubeUnit = 22, bottomY = 330;
    var markup = '<style>#sceneSvg [role="button"] *{cursor:default}</style><line id="meanHeight" x1="22" x2="380" stroke="' + PAL.dark + '" stroke-width="2" stroke-dasharray="6 5"/>'
      + mathSvg('meanHeightLabel', 201, 23, '5', PAL.dark, 16);
    heights.forEach(function (_, index) {
      markup += '<g id="tower' + index + '" tabindex="0" role="button" aria-label="מגדל" style="cursor:grab">'
        + '<rect id="towerBack' + index + '" x="' + (centers[index] - 32) + '" y="32" width="64" height="310" rx="10" fill="transparent"/>'
        + '<g id="cubes' + index + '" style="pointer-events:none"></g>'
        + mathSvg('height' + index, centers[index], 368, '', PAL.dark, 20) + '</g>';
    });
    markup += '<rect id="travellingCube" x="0" y="0" width="42" height="20" rx="3" fill="' + PAL.warm + '" stroke="' + PAL.ink + '" stroke-width="2" opacity="0" style="pointer-events:none"/>';
    ctx.draw(markup);
    var extraNode = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)"><div><b>סכום</b>' + bdi('25') + '</div><div><b>כמות</b>' + bdi('5') + '</div><div><b>ממוצע</b><div dir="ltr">' + fraction('25', '5') + bdi('= 5') + '</div></div></div>' + meanRule());
    ctx.register('towerControls', extraNode);
    function renderTowers() {
      cubeUnit = Math.min(22, 280 / Math.max.apply(null, heights.concat([9])));
      var meanY = bottomY - 5 * cubeUnit;
      ctx.el('meanHeight').setAttribute('y1', meanY); ctx.el('meanHeight').setAttribute('y2', meanY);
      ctx.el('meanHeightLabel').setAttribute('y', Math.max(23, meanY - 10));
      heights.forEach(function (height, index) {
        var cubesMarkup = '';
        for (var level = 0; level < height; level++) {
          cubesMarkup += '<rect x="' + (centers[index] - 21) + '" y="' + (bottomY - (level + 1) * cubeUnit) + '" width="42" height="' + (cubeUnit - 1) + '" rx="2" fill="' + (index === selected ? PAL.warm : PAL.main) + '" stroke="' + PAL.dark + '" stroke-width="1"/>';
        }
        ctx.el('cubes' + index).innerHTML = cubesMarkup;
        ctx.el('height' + index).textContent = String(height);
        ctx.el('towerBack' + index).setAttribute('fill', index === selected ? PAL.warmSoft : 'transparent');
        towerHandles[index].setAttribute('aria-label', 'מגדל ' + m(String(index + 1)) + ', ' + m(String(height)) + ' קוביות. אנטר או רווח בוחר מקור או מעביר אליו; החיצים עוברים בין מגדלים');
        towerHandles[index].setAttribute('aria-pressed', String(selected === index));
        towerButtons[index].setAttribute('aria-pressed', String(selected === index));
      });
    }
    function moveCube(from, to) {
      if (heights[from] === 0) { ctx.note('במגדל הזה אין קובייה להעביר. בחר מגדל שיש בו קוביות.'); ctx.sfx('error'); selected = -1; renderTowers(); return; }
      if (from === to) { selected = -1; renderTowers(); ctx.note('זה אותו מגדל. כדי להעביר קובייה בחר מגדל אחר.'); return; }
      heights[from]--; heights[to]++; selected = -1; ctx.sfx('tick'); renderTowers();
      if (heights.every(function (v) { return v === 5; })) {
        ctx.note('כל מגדל קיבל ' + m('5') + ' קוביות. הסכום נשאר ' + m('25') + ', ולכן הממוצע נשאר ' + m('5') + '.', 'good');
        if (!finished) { finished = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (!movedOnce) {
        ctx.note('הסכום נשאר ' + m('25') + ', ולכן הממוצע לא השתנה: עדיין ' + m('5') + '. העברת קובייה, לא הוספת ולא הורדת.');
      } else { ctx.note('הסכום עדיין ' + m('25') + '. העבר ממגדל גבוה למגדל נמוך עד שכולם יגיעו לקו הממוצע.'); }
      movedOnce = true;
    }
    function chooseTower(index) {
      if (selected >= 0) { moveCube(selected, index); return; }
      if (heights[index] === 0) { ctx.note('במגדל הזה אין קובייה להעביר. בחר מגדל שיש בו קוביות.'); ctx.sfx('error'); return; }
      selected = index; renderTowers(); ctx.note('בחרת מאיפה: מגדל ' + m(String(index + 1)) + '. בחר עכשיו מגדל אחר להעברת קובייה אחת.');
    }
    heights.forEach(function (_, index) {
      var towerNode = ctx.el('tower' + index);
      towerHandles.push(towerNode);
      towerButtons.push(ctx.button('מגדל ' + m(String(index + 1)), function () { chooseTower(index); }, { id: 'towerButton' + index, ghost: true }));
      towerNode.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseTower(index); return; }
        var direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
        if (!direction) return;
        event.preventDefault(); towerHandles[(index + direction + 5) % 5].focus();
      });
      var startX = 0, startY = 0, lastX = 0, lastY = 0, hasMoved = false, ignoreClickUntil = 0;
      towerNode.addEventListener('click', function () { if (Date.now() > ignoreClickUntil) chooseTower(index); });
      ctx.drag(towerNode, {
        start: function (x, y) { startX = lastX = x; startY = lastY = y; hasMoved = false; },
        move: function (x, y) {
          lastX = x; lastY = y; hasMoved = Math.hypot(x - startX, y - startY) > 8;
          if (!hasMoved || !heights[index]) return;
          var movingNode = ctx.el('travellingCube');
          movingNode.setAttribute('opacity', '1'); movingNode.setAttribute('x', centers[index] - 21 + x - startX);
          movingNode.setAttribute('y', bottomY - heights[index] * cubeUnit + y - startY);
        },
        end: function () {
          ctx.el('travellingCube').setAttribute('opacity', '0'); ignoreClickUntil = Date.now() + 400;
          if (!hasMoved) { chooseTower(index); return; }
          if (lastX < 22 || lastX > 380 || lastY < 20 || lastY > 385) { ctx.note('הנח את הקובייה על מגדל אחר. הסכום לא השתנה.'); return; }
          var targetIndex = clamp(Math.round((lastX - centers[0]) / 72), 0, 4);
          moveCube(index, targetIndex);
        }
      });
    });
    ctx.button('בטל בחירה', function () { selected = -1; renderTowers(); ctx.note('הבחירה בוטלה. בחר מגדל שממנו תרצה להעביר קובייה.'); }, { id: 'cancelTower', ghost: true });
    ctx.button('התחל מחדש', function () { heights = [3, 7, 4, 9, 2]; selected = -1; movedOnce = false; renderTowers(); ctx.note('חזרנו למגדלים הפותחים. הסכום ' + m('25') + ' והממוצע ' + m('5') + '.'); }, { id: 'resetTowers', ghost: true });
    renderTowers(); ctx.note('יש ' + m('25') + ' קוביות בחמישה מגדלים. הקו המקווקו מראה כמה יקבל כל מגדל בחלוקה שווה.');
  }

  function missingScene(ctx) {
    var missingValue = 0, solvedMissing = false;
    var drawing = axisMarkup(40, 150, 5) + hebSvg(201, 25, 'שלושה נתונים ידועים ונתון חסר');
    [6, 8, 10].forEach(function (v, index) {
      var fixedX = 50 + 302 * v / 40, fixedY = 58 + index * 30;
      drawing += '<line x1="' + fixedX + '" x2="' + fixedX + '" y1="' + fixedY + '" y2="150" stroke="' + PAL.line + '" stroke-dasharray="3 3"/>'
        + '<circle cx="' + fixedX + '" cy="' + fixedY + '" r="6" fill="' + PAL.dark + '"/>' + mathSvg('', fixedX + 26, fixedY + 5, v, PAL.dark, 15);
    });
    drawing += sliderMarkup('missingDot', 'הנתון החסר איקס; חיצים משנים באחד ומקשי עמוד בחמש', 40)
      + '<line x1="50" x2="352" y1="267" y2="267" stroke="' + PAL.line + '"/>'
      + '<line x1="50" x2="352" y1="316" y2="316" stroke="' + PAL.line + '"/>'
      + '<path id="meanMarker" d="M0 -9 L7 3 L-7 3 Z" fill="' + PAL.dark + '"/>'
      + '<path id="medianMarker" d="M0 -9 L7 3 L-7 3 Z" fill="#a34b0a"/>'
      + hebSvg(301, 258, 'ממוצע') + hebSvg(301, 307, 'חציון');
    ctx.draw(drawing);
    var missingHandle = ctx.el('missingDot');
    var missingBox = ctx.extra('<div class="sceneStrip" style="grid-template-columns:1fr 1fr"><div><b>סכום</b><span dir="ltr" class="math" id="missingSum"></span></div><div><b>ממוצע</b><div id="missingMean" dir="ltr"></div></div></div>'
      + '<div class="sceneStrip" style="margin-top:8px"><b>שני האמצעיים אחרי מיון והחציון שלהם</b><span dir="ltr" class="math" id="missingMedian"></span></div>' + stepperMarkup('missing', 'הנתון החסר'));
    ctx.register('missingControls', missingBox);
    function updateMissing(acted) {
      var sumValue = 24 + missingValue;
      var sortedValues = [6, 8, 10, missingValue].sort(function (a, b) { return a - b; });
      var medianValue = (sortedValues[1] + sortedValues[2]) / 2;
      missingHandle.setAttribute('transform', 'translate(' + (50 + 302 * missingValue / 40) + ' 207)');
      missingHandle.setAttribute('aria-valuenow', missingValue);
      missingHandle.setAttribute('aria-valuetext', 'איקס ' + m(String(missingValue)));
      ctx.el('missingDotValue').textContent = 'x = ' + missingValue;
      ctx.el('meanMarker').setAttribute('transform', 'translate(' + (50 + 302 * sumValue / 160) + ' 267)');
      ctx.el('medianMarker').setAttribute('transform', 'translate(' + (50 + 302 * medianValue / 40) + ' 316)');
      missingBox.querySelector('#missingSum').textContent = String(sumValue);
      missingBox.querySelector('#missingMean').innerHTML = fraction(sumValue, 4) + bdi('= ' + showNumber(sumValue / 4));
      missingBox.querySelector('#missingMedian').textContent = '(' + sortedValues[1] + ' + ' + sortedValues[2] + ') ÷ 2 = ' + showNumber(medianValue);
      missingBox.querySelector('#missingValue').textContent = String(missingValue);
      if (missingValue === 12) {
        ctx.note('נכון: ' + m('6 + 8 + 10 + 12 = 36') + ', ולכן ' + m('36 ÷ 4 = 9') + '.', 'good');
        if (acted && !solvedMissing) { solvedMissing = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (missingValue === 9) {
        ctx.note('הנתון החסר אינו הממוצע עצמו. ארבעת הנתונים יחד צריכים לתת ' + m('4 · 9 = 36') + '. כרגע הסכום רק ' + m('33') + '.');
      } else if (missingValue > 30) {
        ctx.note('הממוצע עלה ל־' + m(showNumber(sumValue / 4)) + ', אבל החציון נשאר ' + m('9') + '. נתון קיצוני מושך את הממוצע, ולא את החציון כאן.');
      } else { ctx.note('כדי שממוצע ארבעת הנתונים יהיה ' + m('9') + ', הסכום צריך להיות ' + m('36') + '. כרגע: ' + m(String(sumValue)) + '.'); }
    }
    function setMissing(v) { missingValue = clamp(Math.round(v), 0, 40); ctx.sfx('tick'); updateMissing(true); }
    wireSliderKeys(missingHandle, function () { return missingValue; }, setMissing, 40);
    missingBox.querySelector('#missingMinus').addEventListener('click', function () { setMissing(missingValue - 1); });
    missingBox.querySelector('#missingPlus').addEventListener('click', function () { setMissing(missingValue + 1); });
    ctx.drag(missingHandle, { move: function (x) { setMissing((x - 50) * 40 / 302); } });
    updateMissing(false);
  }

  function spreadScene(ctx) {
    var dataB = [1, 9, 5, 2, 8], chosenDot = 0, solvedSpread = false, chipButtons = [];
    var plotMarkup = hebSvg(201, 23, 'קבוצה א — קבועה') + axisMarkup(10, 130, 1);
    var countAt = {};
    [4, 5, 5, 6, 5].forEach(function (v) {
      var stackIndex = countAt[v] || 0; countAt[v] = stackIndex + 1;
      plotMarkup += '<circle cx="' + (50 + 302 * v / 10) + '" cy="' + (104 - 24 * stackIndex) + '" r="8" fill="' + PAL.dark + '" stroke="#fff" stroke-width="2"/>';
    });
    plotMarkup += hebSvg(201, 184, 'קבוצה ב — אתה משנה') + axisMarkup(10, 531, 1);
    dataB.forEach(function (_, index) { plotMarkup += sliderMarkup('studentDot' + index, 'הנתון של תלמיד ' + (index + 1) + '; חיצים משנים באחד', 10); });
    ctx.draw(plotMarkup);
    var spreadBox = ctx.extra('<div class="sceneStrip"><b>קבוצה א: ממוצע</b><span class="math" dir="ltr">25 ÷ 5 = 5</span><b>קבוצה א: טווח</b><span class="math" dir="ltr">6 − 4 = 2</span></div>'
      + '<div class="sceneStrip" style="margin-top:8px"><b>קבוצה ב: ממוצע</b><div id="spreadMean" dir="ltr"></div><b>קבוצה ב: טווח</b><span class="math" dir="ltr" id="spreadRange"></span></div>'
      + '<div id="studentChips" style="display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin-top:10px"></div>' + stepperMarkup('spread', 'הנתון של התלמיד הנבחר'));
    ctx.register('spreadControls', spreadBox);
    var chipsBox = spreadBox.querySelector('#studentChips');
    function paintSpread(acted) {
      var lanes = [], positions = [];
      dataB.map(function (v, index) { return { v: v, index: index }; }).sort(function (a, b) { return a.v - b.v; }).forEach(function (item) {
        var laneIndex = 0;
        while (lanes[laneIndex] !== undefined && item.v - lanes[laneIndex] < 2.2) laneIndex++;
        lanes[laneIndex] = item.v; positions[item.index] = 492 - laneIndex * 64;
      });
      dataB.forEach(function (v, index) {
        var dotNode = ctx.el('studentDot' + index);
        dotNode.setAttribute('transform', 'translate(' + (50 + 302 * v / 10) + ' ' + positions[index] + ')');
        dotNode.setAttribute('aria-valuenow', v);
        dotNode.setAttribute('aria-valuetext', 'תלמיד ' + m(String(index + 1)) + ', ערך ' + m(String(v)));
        dotNode.querySelector('.dotFace').setAttribute('fill', index === chosenDot ? '#a34b0a' : PAL.main);
        ctx.el('studentDot' + index + 'Value').textContent = String(v);
        chipButtons[index].setAttribute('aria-pressed', String(index === chosenDot));
        chipButtons[index].style.background = index === chosenDot ? PAL.warmSoft : '#fff';
      });
      var sumB = totalOf(dataB), minB = Math.min.apply(null, dataB), maxB = Math.max.apply(null, dataB), rangeB = maxB - minB;
      spreadBox.querySelector('#spreadMean').innerHTML = fraction(sumB, 5) + bdi('= ' + showNumber(sumB / 5));
      spreadBox.querySelector('#spreadRange').textContent = maxB + ' − ' + minB + ' = ' + rangeB;
      spreadBox.querySelector('#spreadValue').textContent = String(dataB[chosenDot]);
      if (sumB === 25 && rangeB === 4) {
        ctx.note('מצוין: הממוצע נשאר ' + m('5') + ', והטווח עכשיו ' + m('4') + '. אותו ממוצע יכול לבוא עם פיזור שונה.', 'good');
        if (acted && !solvedSpread) { solvedSpread = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (rangeB === 4) {
        ctx.note('הטווח כבר ' + m('4') + ', אבל הממוצע עכשיו ' + m(showNumber(sumB / 5)) + '. הסכום חייב להישאר ' + m('25') + ' כדי שהממוצע יהיה ' + m('5') + '.');
      } else if (!acted && sumB === 25 && rangeB === 8) { ctx.note('לשתי הקבוצות אותו ממוצע: ' + m('5') + '. אבל בקבוצה ב הטווח ' + m('8') + ', לעומת ' + m('2') + ' בקבוצה א — היא מפוזרת הרבה יותר.'); }
      else { ctx.note('בדוק את שני התנאים: סכום ' + m('25') + ' שומר על הממוצע, והגדול פחות הקטן צריך לתת ' + m('4') + '.'); }
    }
    function setStudent(index, v) { chosenDot = index; dataB[index] = clamp(Math.round(v), 0, 10); ctx.sfx('tick'); paintSpread(true); }
    dataB.forEach(function (_, index) {
      var chipNode = document.createElement('button');
      chipNode.type = 'button'; chipNode.id = 'studentChip' + index; chipNode.textContent = 'תלמיד ' + m(String(index + 1));
      chipNode.style.cssText = 'min-height:44px;min-width:44px;padding:6px 10px;border:2px solid ' + PAL.main + ';border-radius:12px;color:' + PAL.dark + ';font:700 14px Heebo,sans-serif';
      chipNode.addEventListener('click', function () { chosenDot = index; paintSpread(false); }); chipsBox.appendChild(chipNode); chipButtons.push(chipNode);
      var studentHandle = ctx.el('studentDot' + index);
      wireSliderKeys(studentHandle, function () { return dataB[index]; }, function (v) { setStudent(index, v); }, 10);
      ctx.drag(studentHandle, { move: function (x) { setStudent(index, (x - 50) * 10 / 302); } });
    });
    spreadBox.querySelector('#spreadMinus').addEventListener('click', function () { setStudent(chosenDot, dataB[chosenDot] - 1); });
    spreadBox.querySelector('#spreadPlus').addEventListener('click', function () { setStudent(chosenDot, dataB[chosenDot] + 1); });
    ctx.button('התחל מחדש', function () { dataB = [1, 9, 5, 2, 8]; chosenDot = 0; paintSpread(false); }, { id: 'resetSpread', ghost: true });
    paintSpread(false);
  }

  var steps = [
    {
      mode: 'intro', tA: 'ממוצע, טווח ובחירת מדד', sub: 'מחלקים בשווה, משווים פיזור ובוחרים מה מתאר נתון טיפוסי.',
      tip: 'שלום, אני אליהו. הממוצע הוא הסכום מחולק בכמות: כמה יקבל כל אחד אם נחלק בשווה.',
      emoji: '📊', eq: m('25 ÷ 5 = 5'), note: 'הסכום הוא ' + m('25') + ', הכמות ' + m('5') + ', ולכן בחלוקה שווה כל מגדל יקבל ' + m('5') + ' קוביות.',
      cue: 'מוכן לחלק בשווה?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מיישרים את המגדלים', sub: 'העבר קובייה עליונה בגרירה, בכפתורים או בחיצים ואנטר. בחר מאיפה, ואז לאן; יישר את כל המגדלים לקו.',
      tip: 'הקוביות רק עוברות בין המגדלים. הסכום לא משתנה, וגם הממוצע לא משתנה.',
      aspect: [WIDTH, 392], alt: 'חמישה מגדלי קוביות בגבהים שלוש, שבע, ארבע, תשע ושתיים, וקו מקווקו בגובה חמש המראה את הממוצע',
      cue: 'יישר את כל חמשת המגדלים לקו הממוצע', cueDone: 'כל המגדלים שווים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'towerControls', text: 'בחר מגדל גבוה כמקור, ואז מגדל נמוך כדי להעביר אליו קובייה אחת.' }, setup: towersScene
    },
    {
      mode: 'quiz', tA: 'מה הממוצע של דנה?', sub: 'הציונים של דנה הם ' + m('70') + ', ' + m('80') + ', ' + m('90') + ', ' + m('100') + '. מה הממוצע?',
      tip: 'חבר את כל הציונים וחלק בכמות הציונים.', btn: 'המשך ←', win: 'נכון. סכום חלקי כמות, כמו בחלוקה שווה.', wrongSay: 'הסכום לבדו אינו הממוצע. בדוק בכמה ציונים מחלקים.',
      opts: [
        { t: m('85'), c: true, f: 'נכון: ' + m('70 + 80 + 90 + 100 = 340') + ', ואז ' + m('340 ÷ 4 = 85') + '.' },
        { t: m('340'), f: 'רק חיברת את הציונים. זה הסכום, וצריך לחלק אותו ב־' + m('4') + '.' },
        { t: m('30'), f: 'חישבת את הטווח: ' + m('100 − 70 = 30') + '. הטווח מודד פיזור, לא ממוצע.' },
        { t: m('80'), f: 'בחרת ציון אחד מתוך הנתונים במקום לחבר את כולם ולחלק בכמות.' }
      ], hints: ['הממוצע הוא מה שהיה לכל ציון בחלוקה שווה של הסכום.', 'חבר את ארבעת הציונים, ואז חלק בארבע.', 'הסכום ' + m('340') + '. חשב ' + m('340 ÷ 4') + '.']
    },
    {
      mode: 'scene', tA: 'הנתון החסר', sub: 'הנתונים הם ' + m('6') + ', ' + m('8') + ', ' + m('10') + ' ו־' + m('x') + '. הממוצע צריך להיות ' + m('9') + '. מצא את ' + m('x') + ' בגרירה, בכפתורים או בחיצים.',
      tip: 'מצא קודם את הסכום הדרוש: כמות כפול ממוצע. החציון מחושב משני האמצעיים אחרי מיון.',
      aspect: [WIDTH, 342], alt: 'ציר מספרים מאפס עד ארבעים עם שלושת הנתונים הידועים והנתון החסר שניתן להזיז, וסמנים נפרדים לממוצע ולחציון',
      cue: 'שנה את הנתון החסר עד שהממוצע יתאים', cueDone: 'מצאת את הנתון החסר. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'missingControls', text: 'חשב את הסכום שארבעה נתונים צריכים לתת, ואז חסר את סכום שלושת הנתונים הידועים.' }, setup: missingScene
    },
    {
      mode: 'quiz', tA: 'מה המספר החמישי?', sub: 'הממוצע של חמישה מספרים הוא ' + m('8') + '. ארבעה מהם הם ' + m('6') + ', ' + m('7') + ', ' + m('9') + ', ' + m('10') + '. מה המספר החמישי?',
      tip: 'כמות כפול ממוצע נותן את הסכום. חסר ממנו את הידועים.', btn: 'המשך ←', win: 'יפה. מצאת את הסכום הדרוש ואז את מה שחסר.', wrongSay: 'הבחן בין הסכום הכולל, סכום הידועים והנתון החסר.',
      opts: [
        { t: m('40'), f: 'זה הסכום הכולל של כל החמישה: ' + m('5 · 8 = 40') + '. עדיין צריך לחסר את הידועים.' },
        { t: m('8'), c: true, f: 'נכון: הסכום הדרוש ' + m('40') + ', סכום הידועים ' + m('32') + ', ולכן ' + m('40 − 32 = 8') + '.' },
        { t: m('32'), f: 'זה סכום ארבעת הנתונים הידועים, לא הנתון החסר. חסר אותו מהסכום הדרוש.' },
        { t: m('10'), f: 'חישבת ' + m('40 ÷ 4') + '. לא מחלקים את הסכום לארבעה; מחסרים ממנו את סכום הידועים.' }
      ], hints: ['התחל מהסכום של כל החמישה, לא מניחוש קרוב לממוצע.', 'הסכום הדרוש הוא ' + m('5 · 8 = 40') + '.', 'הידועים נותנים ' + m('6 + 7 + 9 + 10 = 32') + '. מה חסר עד ' + m('40') + '?']
    },
    {
      mode: 'scene', tA: 'אותו ממוצע, פיזור אחר', sub: 'שנה את קבוצה ב בגרירה, בכפתורים או בחיצים: שמור על ממוצע ' + m('5') + ' והגע לטווח ' + m('4') + '. הכפתורים בוחרים תלמיד ואז משנים את הנתון שלו.',
      tip: 'הממוצע מתאר מרכז. הטווח הוא הגדול ביותר פחות הקטן ביותר, והוא מתאר את הפיזור.',
      aspect: [WIDTH, 562], alt: 'שתי קבוצות של חמש נקודות על צירי מספרים מאפס עד עשר; קבוצה א קבועה וקבוצה ב ניתנת לשינוי בגרירה, במקלדת ובכפתורים',
      cue: 'שמור על הממוצע והקטן את הטווח לפי המשימה', cueDone: 'הממוצע נשמר והטווח מתאים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'spreadControls', text: 'כשמגדילים נתון אחד, אפשר להקטין אחר באותה כמות כדי לשמור על הסכום.' }, setup: spreadScene
    },
    {
      mode: 'quiz', tA: 'מה ממוצע הכיתה?', sub: 'בכיתה ' + m('10') + ' תלמידים קיבלו ' + m('80') + ' במבחן ו־' + m('20') + ' תלמידים קיבלו ' + m('95') + '. מה ממוצע הכיתה?',
      tip: 'לכל ציון יש משקל: כמה תלמידים קיבלו אותו. ספור את כל התלמידים.', btn: 'המשך ←', win: 'מצוין. שקלת כל ציון לפי מספר התלמידים.', wrongSay: 'הקבוצות אינן שוות בגודל. צריך לסכום ציונים של כל התלמידים.',
      opts: [
        { t: m('87.5'), f: 'מיצעת את ' + m('80') + ' ואת ' + m('95') + ' כאילו הקבוצות שוות, אבל בקבוצה השנייה פי שניים תלמידים.' },
        { t: m('2700'), f: 'זה סכום הציונים של כל התלמידים, לא הממוצע. צריך לחלק ב־' + m('30') + '.' },
        { t: m('90'), c: true, f: 'נכון: ' + m('10 · 80 + 20 · 95 = 2700') + ', ולכן ' + m('2700 ÷ 30 = 90') + '.' },
        { t: m('85'), f: 'החלפת את המשקלים: חישבת כאילו ' + m('20') + ' תלמידים קיבלו ' + m('80') + ' ורק ' + m('10') + ' קיבלו ' + m('95') + '.' }
      ], hints: ['כפול כל ציון במספר התלמידים שקיבלו אותו.', 'חבר ' + m('10 · 80') + ' ו־' + m('20 · 95') + ', וחלק במספר כל התלמידים.', 'הסכום ' + m('2700') + ' והכמות ' + m('30') + '. חשב ' + m('2700 ÷ 30') + '.']
    },
    {
      mode: 'quiz', tA: 'משכורת של עובד טיפוסי', sub: 'המשכורות בחברה קטנה, באלפי ₪, הן ' + m('8') + ', ' + m('9') + ', ' + m('9') + ', ' + m('10') + ', ' + m('64') + '. איזה מדד מתאר הכי טוב עובד טיפוסי?',
      tip: 'בדוק אם משכורת קיצונית מושכת את הממוצע הרחק מרוב העובדים.', btn: 'לסיכום ←', win: 'נכון. החציון נשאר קרוב לרוב העובדים למרות המשכורת הקיצונית.', wrongSay: 'חפש מדד של מרכז שאינו נמשך הרבה אחרי הנתון הקיצוני.',
      opts: [
        { t: 'הממוצע, ' + m('20'), f: 'המשכורת הגבוהה האחת מושכת את הממוצע ל־' + m('20') + ', הרחק ממשכורות רוב העובדים.' },
        { t: 'הטווח, ' + m('56'), f: 'הטווח ' + m('64 − 8 = 56') + ' מודד פיזור. הוא אינו משכורת של עובד טיפוסי.' },
        { t: 'המשכורת הגבוהה, ' + m('64'), f: 'בחרת נתון קיצוני של עובד אחד. הוא אינו מתאר את רוב העובדים.' },
        { t: 'החציון, ' + m('9'), c: true, f: 'נכון: לאחר מיון, האמצעי הוא ' + m('9') + '. הנתון הקיצוני מושך את הממוצע, אבל לא את החציון כאן.' }
      ], hints: ['ארבע משכורות קרובות זו לזו ואחת רחוקה מאוד.', 'אחרי מיון, החציון הוא הנתון האמצעי מבין החמישה.', 'ברשימה הממוינת ' + m('8, 9, 9, 10, 64') + ' חפש את הנתון השלישי.']
    },
    {
      mode: 'finish', tA: 'סיימת: מרכז ופיזור', sub: 'הממוצע מחלק בשווה; הטווח מודד פיזור; החציון עוזר מול נתון קיצוני.',
      tip: 'כל הכבוד. לפני שבוחרים מדד, הסתכל על הנתונים ועל השאלה שרוצים לענות עליה.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הממוצע הוא מה שכל אחד מקבל בחלוקה שווה של הסכום. נתון קיצוני מושך אותו, אך כמעט אינו מזיז את החציון.',
      formula: 'טווח = הגדול ביותר פחות הקטן ביותר. חציון = האמצעי אחרי מיון; בכמות זוגית — ממוצע שני האמצעיים.',
      setup: function (ctx) {
        var ruleNode = ctx.el('meanFinishRule');
        if (!ruleNode) { ruleNode = document.createElement('div'); ruleNode.id = 'meanFinishRule'; ruleNode.innerHTML = meanRule(); ctx.el('panelFinish').insertBefore(ruleNode, ctx.el('finalLead')); }
        ctx.el('finalEq').style.whiteSpace = 'normal';
      }
    }
  ];

  window.NoamGame.boot({
    slug: 'maazan-hamemutsa', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'חישוב ממוצע', math: '340 ÷ 4 = 85' },
      { step: 4, name: 'מציאת נתון חסר', math: '5 · 8 − 32 = 8' },
      { step: 6, name: 'ממוצע משוקלל', math: '2700 ÷ 30 = 90' },
      { step: 7, name: 'בחירת מדד מתאים', math: '9' }
    ],
    bonus: {
      label: 'מכונת המרכז והפיזור', closeLabel: 'סגור את המכונה', hint: 'קבל נתונים חדשים ותרגל ממוצע, טווח או נתון חסר.',
      setup: function (box, ctx) {
        var bonusData = [], bonusMean = 0, bonusKind = 0, bonusAnswer = 0, bonusGuess = 0;
        box.innerHTML = '<div class="bTitle">מכונת המרכז והפיזור</div><div class="bSub" data-bonus-question></div>'
          + '<div class="bChip" data-bonus-data dir="ltr" style="font-size:18px;max-width:100%;white-space:normal"></div>'
          + stepperMarkup('bonusGuess', 'התשובה')
          + '<div class="bForms" data-bonus-forms hidden></div><div class="bOk" data-bonus-note hidden role="status"></div>'
          + '<button type="button" class="bDice" data-bonus-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll style="min-height:44px;min-width:44px">תרגיל חדש ↻</button>';
        function randomInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        function rollBonus() {
          bonusMean = randomInt(5, 12); bonusKind = randomInt(0, 2); bonusGuess = 0;
          var dataCount = randomInt(4, 6); bonusData = [];
          for (var pairIndex = 0; pairIndex < Math.floor(dataCount / 2); pairIndex++) { var deviation = randomInt(0, 4); bonusData.push(bonusMean - deviation, bonusMean + deviation); }
          if (dataCount % 2) bonusData.push(bonusMean);
          bonusData = window.NoamGame.shuffle(bonusData);
          bonusAnswer = bonusKind === 0 ? bonusMean : bonusKind === 1 ? Math.max.apply(null, bonusData) - Math.min.apply(null, bonusData) : bonusData[dataCount - 1];
          box.querySelector('[data-bonus-question]').innerHTML = bonusKind === 0 ? 'מה הממוצע של הנתונים?' : bonusKind === 1 ? 'מה הטווח של הנתונים?' : 'הממוצע הוא ' + bdi(String(bonusMean)) + '. מה הנתון החסר?';
          box.querySelector('[data-bonus-data]').textContent = bonusData.map(function (v, index) { return bonusKind === 2 && index === dataCount - 1 ? 'x' : String(v); }).join(', ');
          refreshBonus();
        }
        function refreshBonus() {
          box.querySelector('#bonusGuessValue').textContent = String(bonusGuess);
          box.querySelector('[data-bonus-forms]').hidden = true; box.querySelector('[data-bonus-note]').hidden = true;
        }
        box.querySelector('#bonusGuessMinus').addEventListener('click', function () { bonusGuess = clamp(bonusGuess - 1, 0, 40); refreshBonus(); });
        box.querySelector('#bonusGuessPlus').addEventListener('click', function () { bonusGuess = clamp(bonusGuess + 1, 0, 40); refreshBonus(); });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var resultNode = box.querySelector('[data-bonus-note]'); resultNode.hidden = false;
          if (bonusGuess !== bonusAnswer) {
            resultNode.style.color = '#b91c1c'; resultNode.textContent = bonusKind === 0 ? 'נסה שוב: חבר את כל הנתונים וחלק בכמות.' : bonusKind === 1 ? 'נסה שוב: חסר את הקטן ביותר מהגדול ביותר.' : 'נסה שוב: כמות כפול ממוצע נותן את הסכום, ואז מחסרים את הידועים.';
            ctx.sfx('error'); return;
          }
          resultNode.style.color = PAL.good; resultNode.textContent = 'נכון! בחרת את הפעולה המתאימה לשאלה.'; ctx.sfx('correct');
          var formsNode = box.querySelector('[data-bonus-forms]'); formsNode.hidden = false;
          formsNode.innerHTML = bonusKind === 0 ? '<div dir="ltr">' + fraction(totalOf(bonusData), bonusData.length) + bdi('= ' + bonusAnswer) + '</div>' : bonusKind === 1 ? bdi(Math.max.apply(null, bonusData) + ' − ' + Math.min.apply(null, bonusData) + ' = ' + bonusAnswer) : bdi(bonusData.length + ' · ' + bonusMean + ' − ' + totalOf(bonusData.slice(0, -1)) + ' = ' + bonusAnswer);
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { ctx.sfx('click'); rollBonus(); });
        rollBonus();
      }
    }
  });
}());
