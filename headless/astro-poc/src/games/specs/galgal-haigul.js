/** גלגל העיגול: היקף בגלגול, שטח מגזרות, וגליל בפריסה. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c';
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function mathText(id, x, y, text, size) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 16) + '" fill="' + PAL.ink + '">' + text + '</text>';
  }
  function attrs(el, values) { Object.keys(values).forEach(function (key) { el.setAttribute(key, values[key]); }); }
  function stepper(prefix, label, sym) {
    return '<div class="unit" dir="ltr"><button type="button" id="' + prefix + 'Minus" aria-label="הקטן את ' + label + '">−</button>'
      + '<span dir="rtl" style="font:700 13px Heebo,sans-serif">' + label + '</span>'
      + '<bdi class="var math" dir="ltr" id="' + prefix + 'Value">' + sym + '</bdi>'
      + '<button type="button" id="' + prefix + 'Plus" aria-label="הגדל את ' + label + '">+</button></div>';
  }
  function slider(id, label, lo, hi, value) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + lo + '" aria-valuemax="' + hi + '" aria-valuenow="' + value + '" style="cursor:grab">'
      + '<circle r="33" fill="transparent"/><circle r="8" fill="#fff" stroke="' + PAL.main + '" stroke-width="4"/></g>';
  }
  function wireKeys(el, get, set, lo, hi, delta) {
    el.addEventListener('keydown', function (event) {
      var change = { ArrowRight: delta, ArrowUp: delta, ArrowLeft: -delta, ArrowDown: -delta }[event.key];
      if (event.key === 'Home') { event.preventDefault(); set(lo); return; }
      if (event.key === 'End') { event.preventDefault(); set(hi); return; }
      if (!change) return;
      event.preventDefault(); set(get() + change);
    });
  }
  function wireVerticalDrag(ctx, handleNode, getValue, setValue, pixelsPerUnit) {
    var screenStart = 0, valueStart = 0, startScale = 1;
    ctx.drag(handleNode, {
      start: function (x, y) {
        var matrix = ctx.svg.getScreenCTM();
        screenStart = matrix.b * x + matrix.d * y + matrix.f;
        startScale = matrix.d; valueStart = getValue();
      },
      move: function (x, y) {
        var matrix = ctx.svg.getScreenCTM();
        var screenNow = matrix.b * x + matrix.d * y + matrix.f;
        setValue(valueStart + (screenStart - screenNow) / (pixelsPerUnit * startScale));
      }
    });
  }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function rollingScene(ctx) {
    var radius = 1, turn = 0, records = {}, rolling = false;
    var unit = 10, ground = 134, startX = 70;
    var ruler = '<line x1="42" y1="134" x2="376" y2="134" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (var tick = 0; tick <= 28; tick++) {
      var tx = startX + tick * unit;
      ruler += '<line x1="' + tx + '" y1="134" x2="' + tx + '" y2="' + (tick % 2 ? 141 : 146) + '" stroke="' + PAL.ink + '"/>';
      if (tick % 4 === 0) ruler += mathText('tick' + tick, tx, 166, String(tick), 13);
    }
    ctx.draw(ruler + '<line id="covered" x1="70" y1="134" x2="70" y2="134" stroke="' + PAL.good + '" stroke-width="6"/>'
      + '<g id="wheel" tabindex="0" role="slider" aria-label="גלגל: חצים מגלגלים שמינית סיבוב; בית מחזיר להתחלה" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0" style="cursor:grab">'
      + '<circle r="33" fill="transparent"/><circle id="rim" r="10" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="3"/>'
      + '<g id="spokes"><line id="spoke" x1="0" y1="0" x2="0" y2="10" stroke="' + PAL.main + '" stroke-width="2"/><circle id="redDot" cx="0" cy="10" r="4" fill="' + BAD + '"/></g>'
      + '<circle r="3" fill="' + PAL.ink + '"/></g>' + mathText('distance', 201, 196, '', 18));
    var extraBox = ctx.extra('<div class="stepper">' + stepper('wheelR', 'רדיוס', '1') + '</div>'
      + '<div class="sceneStrip" style="margin-top:8px;grid-template-columns:1fr 1fr"><div><b>קוטר</b><span id="diameter" dir="ltr"></span></div><div><b>היקף בסיבוב מלא</b><span id="fullLength" dir="ltr"></span></div></div>'
      + '<div class="sceneStrip" style="margin-top:8px"><b>בסיבוב מלא: היקף חלקי קוטר</b><div dir="ltr" style="display:flex;align-items:center;justify-content:center;gap:10px">'
      + '<div style="display:inline-flex;flex-direction:column;align-items:stretch;min-width:60px"><bdi id="ratioTop" class="math" dir="ltr" style="border-bottom:2px solid currentColor"></bdi><bdi id="ratioBottom" class="math" dir="ltr"></bdi></div>'
      + bdi('= π ≈ 3.14') + '</div></div><div id="rollTable" style="font-size:13px;text-align:center;margin-top:8px"></div>');
    var wheelNode = ctx.el('wheel');
    function paintRoll() {
      var radPx = radius * unit, full = 2 * Math.PI * radius, cx = startX + full * unit * turn;
      attrs(wheelNode, { transform: 'translate(' + cx + ' ' + (ground - radPx) + ')', 'aria-valuenow': turn, 'aria-valuetext': m((turn * 100).toFixed(0)) + ' אחוז מסיבוב' });
      ctx.el('rim').setAttribute('r', radPx);
      ctx.el('spoke').setAttribute('y2', radPx); ctx.el('redDot').setAttribute('cy', radPx);
      ctx.el('spokes').setAttribute('transform', 'rotate(' + (turn * 360) + ')');
      ctx.el('covered').setAttribute('x2', cx);
      ctx.el('distance').textContent = (turn === 1 ? 'P ≈ ' : 'ℓ ≈ ') + (full * turn).toFixed(2);
      extraBox.querySelector('#wheelRValue').textContent = radius;
      extraBox.querySelector('#diameter').textContent = 'd = ' + (2 * radius);
      extraBox.querySelector('#fullLength').textContent = (2 * radius) + 'π ≈ ' + full.toFixed(2);
      extraBox.querySelector('#ratioTop').textContent = (2 * radius) + 'π';
      extraBox.querySelector('#ratioBottom').textContent = String(2 * radius);
      extraBox.querySelector('#rollTable').innerHTML = Object.keys(records).length ? '<table style="margin:auto;border-collapse:collapse"><caption>סיבובים מלאים שבדקת</caption><thead><tr><th style="padding:3px 10px">רדיוס</th><th style="padding:3px 10px">היקף</th><th style="padding:3px 10px">היחס</th></tr></thead><tbody>' + Object.keys(records).map(function (rKey) {
        return '<tr><td>' + bdi(rKey) + '</td><td>' + bdi((2 * Number(rKey)) + 'π') + '</td><td>' + bdi('π ≈ 3.14') + '</td></tr>';
      }).join('') + '</tbody></table>' : 'השלם סיבוב כדי להוסיף שורה לטבלה.';
      ctx.caption('סיבוב מלא: ' + m('P = 2π · r = π · d'));
    }
    function setTurn(value) {
      if (rolling) return;
      turn = clamp(value, 0, 1);
      if (turn > 0.999) turn = 1;
      if (turn === 1) {
        var repeated = !!records[radius]; records[radius] = true;
        if (Object.keys(records).length >= 2) { ctx.note('ההיקף השתנה, אבל ' + m('P ÷ d') + ' נשאר ' + m('π') + '.', 'good'); ctx.solved(); }
        else ctx.note(repeated ? 'זה שוב אותו רדיוס. כדי להשוות את היחס, נסה רדיוס אחר ואז סיבוב מלא.' : 'השלמת סיבוב מלא. עכשיו נסה רדיוס אחר והשווה את היחס.');
      } else ctx.note('זה רק חלק מסיבוב. ההיקף הוא הדרך שעובר הגלגל בסיבוב מלא, כשהנקודה האדומה חוזרת למטה.');
      paintRoll();
    }
    function setRadius(value) { if (rolling) return; radius = clamp(Math.round(value), 1, 4); turn = 0; paintRoll(); ctx.note('בחרת רדיוס ' + m(String(radius)) + '. השלם סיבוב מלא; רדיוס חדש מוסיף שורה חדשה.'); }
    extraBox.querySelector('#wheelRMinus').addEventListener('click', function () { setRadius(radius - 1); });
    extraBox.querySelector('#wheelRPlus').addEventListener('click', function () { setRadius(radius + 1); });
    wireKeys(wheelNode, function () { return turn; }, setTurn, 0, 1, 0.125);
    var dragStart = 0, initialTurn = 0;
    ctx.drag(wheelNode, { start: function (x) { dragStart = x; initialTurn = turn; }, move: function (x) { setTurn(initialTurn + (x - dragStart) / (2 * Math.PI * radius * unit)); } });
    ctx.button('גלגל סיבוב אחד', function () {
      if (rolling) return;
      turn = 0; paintRoll();
      if (reduced()) { setTurn(1); return; }
      rolling = true; ctx.busy(true);
      var frame = 0;
      function advanceRoll() {
        if (!ctx.isActive()) return;
        frame++; turn = frame / 8; paintRoll();
        if (frame < 8) ctx.later(advanceRoll, 60);
        else { rolling = false; ctx.busy(false); setTurn(1); }
      }
      ctx.later(advanceRoll, 60);
    }, { id: 'rollFull', target: 'rollFull' });
    ctx.button('שמינית קדימה →', function () { setTurn(turn + 0.125); }, { id: 'rollEighth', ghost: true });
    ctx.button('שמינית אחורה ←', function () { setTurn(turn - 0.125); }, { id: 'rollBack', ghost: true });
    ctx.button('החזר להתחלה', function () { setTurn(0); }, { id: 'rollHome', ghost: true });
    paintRoll();
  }

  function sectorsScene(ctx) {
    var radius = 1, count = 4, arranged = false, widthNoted = false;
    ctx.draw('<g id="circleSectors"></g><g id="arrangedSectors"></g><line id="radiusLine" stroke="' + PAL.dark + '" stroke-width="3"/>'
      + slider('radiusHandle', 'רדיוס העיגול: חצים מגדילים או מקטינים', 1, 5, radius)
      + mathText('radiusLabel', 95, 258, '', 16) + mathText('rowWidth', 276, 254, '', 17)
      + mathText('rowHeight', 274, 280, '', 16));
    var extraBox = ctx.extra('<div class="stepper">' + stepper('sectorR', 'רדיוס', '1') + stepper('sectorN', 'גזרות', '4') + '</div>'
      + '<div class="sceneStrip" style="margin-top:8px"><b>השטח אינו משתנה כשמסדרים</b><span id="sectorArea" dir="ltr"></span></div>');
    var radiusNode = ctx.el('radiusHandle');
    function paintSectors() {
      var circleRad = 18 + 6 * radius, htmlCircle = '', halfAngle = Math.PI / count;
      for (var index = 0; index < count; index++) {
        var angA = 2 * Math.PI * index / count, angB = 2 * Math.PI * (index + 1) / count;
        htmlCircle += '<path d="M95 142 L' + (95 + circleRad * Math.cos(angA)) + ' ' + (142 + circleRad * Math.sin(angA)) + ' A' + circleRad + ' ' + circleRad + ' 0 0 1 ' + (95 + circleRad * Math.cos(angB)) + ' ' + (142 + circleRad * Math.sin(angB)) + ' Z" fill="' + (index < count / 2 ? PAL.main : PAL.soft) + '" stroke="' + PAL.dark + '" stroke-width="0.7"/>';
      }
      ctx.el('circleSectors').innerHTML = htmlCircle;
      attrs(ctx.el('radiusLine'), { x1: 95, y1: 142, x2: 95, y2: 142 - circleRad });
      attrs(radiusNode, { transform: 'translate(95 ' + (142 - circleRad) + ')', 'aria-valuenow': radius });
      var rowHtml = '';
      if (arranged) {
        var rowRad = circleRad, side = rowRad * Math.sin(halfAngle), ht = rowRad * Math.cos(halfAngle);
        var left = 276 - (count + 1) * side / 2, bottom = 167;
        for (var sector = 0; sector < count / 2; sector++) {
          var apexUp = left + side + 2 * side * sector, apexDown = apexUp + side;
          rowHtml += '<path d="M' + apexUp + ' ' + bottom + ' L' + (apexUp - side) + ' ' + (bottom - ht) + ' A' + rowRad + ' ' + rowRad + ' 0 0 1 ' + (apexUp + side) + ' ' + (bottom - ht) + ' Z" fill="' + PAL.main + '" stroke="' + PAL.dark + '" stroke-width="0.7"/>'
            + '<path d="M' + apexDown + ' ' + (bottom - ht) + ' L' + (apexDown + side) + ' ' + bottom + ' A' + rowRad + ' ' + rowRad + ' 0 0 1 ' + (apexDown - side) + ' ' + bottom + ' Z" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="0.7"/>';
        }
        rowHtml += '<path d="M' + left + ' 195 H' + (left + (count + 1) * side) + '" stroke="' + PAL.ink + '" stroke-width="2"/>';
      }
      ctx.el('arrangedSectors').innerHTML = rowHtml;
      ctx.el('radiusLabel').textContent = 'r = ' + radius;
      ctx.el('rowWidth').textContent = arranged ? 'π · r = ' + radius + 'π' : '';
      ctx.el('rowHeight').textContent = arranged ? 'r = ' + radius : '';
      extraBox.querySelector('#sectorRValue').textContent = radius; extraBox.querySelector('#sectorNValue').textContent = count;
      extraBox.querySelector('#sectorArea').textContent = 'π · ' + radius + ' · ' + radius + ' = ' + (radius * radius) + 'π';
      countButtons.forEach(function (btnNode, idx) { btnNode.setAttribute('aria-pressed', String(count === [4, 8, 16, 32][idx])); });
      ctx.caption(arranged ? 'מתקרב למלבן: רוחב ' + m('π · r') + ', גובה ' + m('r') : m('S = π · r²'));
    }
    function feedbackSectors() {
      if (arranged && count === 32 && radius === 3) { ctx.note('בדיוק: ' + m('S = π · 3² = 9π') + '. יותר גזרות מקרבות את הצורה למלבן.', 'good'); ctx.solved(); }
      else if (arranged && count === 4) ctx.note('הקצוות גליים. יותר גזרות יקרבו את הצורה למלבן. השטח נשאר ' + m(String(radius * radius) + 'π') + '.');
      else if (arranged && radius !== 3) ctx.note('השטח עכשיו ' + m(String(radius * radius) + 'π') + '. כדי לקבל ' + m('9π') + ', הרדיוס כפול עצמו צריך להיות ' + m('9') + '.');
      else if (arranged) ctx.note('הרדיוס מתאים. סדר ' + m('32') + ' גזרות כדי לקרב את הקצוות לקווים ישרים.');
      else ctx.note('בחר רדיוס ומספר גזרות, ואז סדר אותן. הסידור לא מוסיף ולא מוריד שטח.');
    }
    function setSectorRadius(value) { radius = clamp(Math.round(value), 1, 5); paintSectors(); feedbackSectors(); }
    function setSectorCount(value) { count = clamp(value, 4, 32); paintSectors(); feedbackSectors(); }
    var countButtons = [];
    [4, 8, 16, 32].forEach(function (choice) { countButtons.push(ctx.button(m(String(choice)) + ' גזרות', function () { setSectorCount(choice); }, { id: 'sectors' + choice, ghost: true })); });
    extraBox.querySelector('#sectorRMinus').addEventListener('click', function () { setSectorRadius(radius - 1); });
    extraBox.querySelector('#sectorRPlus').addEventListener('click', function () { setSectorRadius(radius + 1); });
    extraBox.querySelector('#sectorNMinus').addEventListener('click', function () { setSectorCount(count / 2); });
    extraBox.querySelector('#sectorNPlus').addEventListener('click', function () { setSectorCount(count * 2); });
    wireKeys(radiusNode, function () { return radius; }, setSectorRadius, 1, 5, 1);
    wireVerticalDrag(ctx, radiusNode, function () { return radius; }, setSectorRadius, 6);
    ctx.button('סדר את הגזרות', function () {
      arranged = true; paintSectors(); feedbackSectors();
      if (!widthNoted) {
        widthNoted = true;
        ctx.note((count === 4 ? 'הקצוות גליים; יותר גזרות יקרבו את הצורה למלבן. ' : '') + 'שים לב: השפה העליונה היא רק חצי מההיקף, לכן הרוחב מתקרב ל־' + m('π · r') + ' ולא ל־' + m('2π · r') + '.');
      }
    }, { id: 'arrangeSectors', target: 'arrangeSectors' });
    ctx.button('החזר לעיגול', function () { arranged = false; paintSectors(); feedbackSectors(); }, { id: 'restoreCircle', ghost: true });
    paintSectors();
  }

  function cylinderScene(ctx) {
    var radius = 1, height = 2, unfolded = false, netSeen = false;
    ctx.draw('<g id="cylinderBody"></g>' + slider('heightHandle', 'גובה הגליל: חצים משנים את הגובה', 1, 10, height)
      + mathText('cylRadius', 201, 255, '', 17) + mathText('cylHeight', 201, 280, '', 17));
    var extraBox = ctx.extra('<div class="stepper">' + stepper('cylR', 'רדיוס', '1') + stepper('cylH', 'גובה', '2') + '</div>'
      + '<div class="sceneStrip" style="margin-top:8px;grid-template-columns:1fr 1fr"><div><b>שטח בסיס, סמ״ר</b><span id="baseArea" dir="ltr"></span></div><div><b>שטח מעטפת, סמ״ר</b><span id="lateralArea" dir="ltr"></span></div><div><b>שטח פנים כולל, סמ״ר</b><span id="surfaceArea" dir="ltr"></span></div><div><b>נפח, סמ״ק</b><span id="volume" dir="ltr"></span></div></div>');
    var heightNode = ctx.el('heightHandle');
    function paintCylinder() {
      var bodyHtml = '', hx = 201, hy;
      if (unfolded) {
        var scale = Math.min(200 / (2 * Math.PI * radius), 90 / height, 23 / radius);
        var netW = 2 * Math.PI * radius * scale, netH = height * scale, netR = radius * scale, left = 201 - netW / 2;
        bodyHtml = '<rect x="' + left + '" y="75" width="' + netW + '" height="' + netH + '" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
          + '<circle cx="201" cy="' + (75 - netR) + '" r="' + netR + '" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
          + '<circle cx="201" cy="' + (75 + netH + netR) + '" r="' + netR + '" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
          + mathText('netWidth', 201, 75 + netH + 2 * netR + 24, (2 * radius) + 'π', 17)
          + mathText('netHeight', left + netW + 32, 75 + netH / 2 + 5, String(height), 17);
        hy = 75;
      } else {
        var visualR = 20 + 5 * radius, visualH = 10 * height, lidY = 210 - visualH;
        bodyHtml = '<path d="M' + (201 - visualR) + ' ' + lidY + ' V210 A' + visualR + ' 12 0 0 0 ' + (201 + visualR) + ' 210 V' + lidY + ' Z" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
          + '<ellipse cx="201" cy="' + lidY + '" rx="' + visualR + '" ry="12" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
          + '<line x1="201" y1="' + lidY + '" x2="' + (201 + visualR) + '" y2="' + lidY + '" stroke="' + PAL.dark + '" stroke-width="2"/>';
        hy = lidY;
      }
      ctx.el('cylinderBody').innerHTML = bodyHtml;
      attrs(heightNode, { transform: 'translate(' + hx + ' ' + hy + ')', 'aria-valuenow': height });
      ctx.el('cylRadius').textContent = 'r = ' + radius; ctx.el('cylHeight').textContent = 'h = ' + height;
      extraBox.querySelector('#cylRValue').textContent = radius; extraBox.querySelector('#cylHValue').textContent = height;
      extraBox.querySelector('#baseArea').textContent = (radius * radius) + 'π';
      extraBox.querySelector('#lateralArea').textContent = (2 * radius * height) + 'π';
      extraBox.querySelector('#surfaceArea').textContent = (2 * radius * radius + 2 * radius * height) + 'π';
      extraBox.querySelector('#volume').textContent = (radius * radius * height) + 'π';
      ctx.caption(m('V = π · r² · h = ' + (radius * radius * height) + 'π'));
    }
    function feedbackCylinder() {
      var volumeCoef = radius * radius * height;
      if (netSeen && volumeCoef === 36) { ctx.note('נכון! שטח הבסיס כפול הגובה: ' + m('π · ' + radius + '² · ' + height + ' = 36π') + ' סמ״ק.', 'good'); ctx.solved(); }
      else if (radius === 3 && height === 6) ctx.note('שטח המעטפת הוא ' + m('36π') + ' סמ״ר, אבל הנפח הוא ' + m('54π') + ' סמ״ק. נפח הוא שטח הבסיס כפול הגובה, לא שטח המעטפת.');
      else if (radius * height === 36 || 2 * radius * height === 36) ctx.note('המעטפת אינה הנפח. בנפח כופלים את הגובה בשטח הבסיס ' + m('π · r²') + ', לא בהיקף ' + m('2π · r') + '. כרגע הנפח ' + m(String(volumeCoef) + 'π') + ' סמ״ק.');
      else if (!netSeen) ctx.note('לפני הבנייה, לחץ על פרוס כדי לראות מלבן ושני בסיסים.');
      else ctx.note('הנפח כרגע ' + m(String(volumeCoef) + 'π') + ' סמ״ק. שנה רדיוס וגובה עד ששטח הבסיס כפול הגובה ייתן ' + m('36π') + '.');
    }
    function setCylinderRadius(value) { radius = clamp(Math.round(value), 1, 5); paintCylinder(); feedbackCylinder(); }
    function setCylinderHeight(value) { height = clamp(Math.round(value), 1, 10); paintCylinder(); feedbackCylinder(); }
    extraBox.querySelector('#cylRMinus').addEventListener('click', function () { setCylinderRadius(radius - 1); });
    extraBox.querySelector('#cylRPlus').addEventListener('click', function () { setCylinderRadius(radius + 1); });
    extraBox.querySelector('#cylHMinus').addEventListener('click', function () { setCylinderHeight(height - 1); });
    extraBox.querySelector('#cylHPlus').addEventListener('click', function () { setCylinderHeight(height + 1); });
    wireKeys(heightNode, function () { return height; }, setCylinderHeight, 1, 10, 1);
    wireVerticalDrag(ctx, heightNode, function () { return height; }, setCylinderHeight, 10);
    ctx.button('פרוס', function () { unfolded = true; netSeen = true; paintCylinder(); feedbackCylinder(); }, { id: 'unfoldCylinder', target: 'unfoldCylinder' });
    ctx.button('קפל', function () { unfolded = false; paintCylinder(); feedbackCylinder(); }, { id: 'foldCylinder', ghost: true });
    paintCylinder();
  }

  var steps = [
    { mode: 'intro', tA: 'העיגול והגליל', sub: 'גלגל על סרגל, עיגול מגזרות, וגליל שנפתח לפריסה.', tip: 'שלום, אני אליהו. נגלגל, נסדר ונפרוס כדי לגלות מאיפה הנוסחאות באות.',
      eq: m('P = 2π · r'), emoji: '🛞', note: 'סיבוב מלא מכסה את ההיקף. אחר כך נראה איך אותו רדיוס נותן גם שטח ונפח.', cue: 'מוכן לגלות את העיגול?', btn: 'בוא נתחיל ←' },
    { mode: 'scene', tA: 'גלגל על סרגל', sub: 'גלגל בגרירה, בכפתורים או בחיצים. בדוק סיבוב מלא בשני רדיוסים שונים. הסרגל מסומן ביחידות.', tip: 'הנקודה האדומה חוזרת למטה אחרי סיבוב מלא. השווה את ההיקף לקוטר.',
      aspect: [402, 220], alt: 'גלגל עם נקודה אדומה על שפתו, סרגל ביחידות וקטע ירוק שמראה את הדרך שכיסה הגלגל', cue: 'השלם סיבוב מלא בשני רדיוסים שונים', cueDone: 'שני היקפים שונים, אותו יחס. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'rollFull', text: 'השלם סיבוב, שנה את הרדיוס בכפתורים והשלם עוד סיבוב.' }, setup: rollingScene },
    { mode: 'quiz', tA: 'היקף של גלגל', sub: 'קוטר של גלגל הוא ' + m('10') + ' ס״מ. מה ההיקף שלו?', tip: 'קיבלת קוטר, לא רדיוס. בחר את נוסחת ההיקף המתאימה.', btn: 'המשך ←',
      win: 'נכון. ההיקף הוא ' + m('π') + ' כפול הקוטר.', wrongSay: 'ההיקף הוא אורך השפה. לא מחשבים כאן שטח.',
      opts: [
        { t: m('10π') + ' ס״מ', c: true, f: 'נכון: ' + m('P = π · d = π · 10 = 10π') + ' ס״מ.' },
        { t: m('20π') + ' ס״מ', f: 'השתמשת בקוטר ' + m('10') + ' כאילו הוא הרדיוס. הנוסחה עם קוטר היא ' + m('P = π · d') + '.' },
        { t: m('25π') + ' ס״מ', f: 'חישבת שטח עם הרדיוס ' + m('5') + ': ' + m('π · 5² = 25π') + '. כאן מבקשים היקף, לא שטח.' },
        { t: m('100π') + ' ס״מ', f: 'העלית את הקוטר בריבוע. בהיקף כופלים את הקוטר ב־' + m('π') + ', בלי ריבוע.' }
      ], hints: ['חשוב על הדרך שהגלגל עובר בסיבוב מלא.', 'היחס בין היקף לקוטר הוא ' + m('π') + '.', 'הצב את הקוטר בנוסחה ' + m('P = π · d') + '.'] },
    { mode: 'scene', tA: 'מעיגול למלבן', sub: 'שנה רדיוס בגרירה, בכפתורים או בחיצים. סדר ' + m('32') + ' גזרות ובנה עיגול ששטחו ' + m('9π') + '.', tip: 'מסדרים גזרות פעם למעלה ופעם למטה. ככל שיש יותר גזרות, הקצוות ישרים יותר.',
      aspect: [402, 306], alt: 'עיגול מחולק לגזרות, ידית לשינוי הרדיוס וסידור חלופי של גזרות כהות ובהירות שמתקרב למלבן', cue: 'סדר שלושים ושתיים גזרות וקבל שטח ' + m('9π'), cueDone: 'הגזרות מסודרות והשטח מתאים. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'arrangeSectors', text: 'הגדל את מספר הגזרות ואת הרדיוס, ואז לחץ על סדר את הגזרות.' }, setup: sectorsScene },
    { mode: 'quiz', tA: 'שטח העיגול', sub: 'רדיוס של עיגול הוא ' + m('6') + ' ס״מ. מה השטח שלו?', tip: 'בשטח כופלים את הרדיוס בעצמו. זכור את רוחב המלבן ואת גובהו.', btn: 'המשך ←', win: 'נכון. ' + m('π') + ' כפול הרדיוס בריבוע.', wrongSay: 'בדוק שהשתמשת ברדיוס בריבוע, ולא בהיקף או בקוטר.',
      opts: [
        { t: m('12π') + ' סמ״ר', f: 'חישבת את ההיקף ' + m('2π · 6 = 12π') + '. שטח הוא ' + m('π · r²') + ', לא היקף.' },
        { t: m('36π') + ' סמ״ר', c: true, f: 'נכון: ' + m('S = π · 6² = 36π') + ' סמ״ר.' },
        { t: m('144π') + ' סמ״ר', f: 'העלית את הקוטר ' + m('12') + ' בריבוע. בנוסחת השטח מעלים את הרדיוס בריבוע.' },
        { t: m('18π') + ' סמ״ר', f: 'כפלת את ' + m('6') + ' ב־' + m('3') + ' במקום בעצמו. ' + m('6² = 6 · 6') + '.' }
      ], hints: ['הסידור מתקרב למלבן שגובהו רדיוס ורוחבו חצי ההיקף.', 'הנוסחה היא ' + m('S = π · r²') + '.', 'חשב ' + m('6 · 6') + ' והשאר את ' + m('π') + ' בתשובה.'] },
    { mode: 'scene', tA: 'פורסים גליל', sub: 'פרוס פעם אחת. שנה רדיוס וגובה בגרירה, בכפתורים או בחיצים, ובנה נפח של ' + m('36π') + ' סמ״ק. המידות בס״מ.', tip: 'המעטפת נפתחת למלבן, ושני הבסיסים נשארים עיגולים. הנפח הוא שטח בסיס כפול גובה.',
      aspect: [402, 306], alt: 'גליל עם ידית על המכסה לשינוי הגובה, או פריסה עם מלבן ושני עיגולים; מוצגים רדיוס וגובה', cue: 'פרוס פעם אחת ובנה את הנפח המבוקש', cueDone: 'ראית פריסה ובנית את הנפח. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'unfoldCylinder', text: 'לחץ על פרוס ואז שנה את הרדיוס והגובה בכפתורים.' }, setup: cylinderScene },
    { mode: 'quiz', tA: 'שטח המעטפת', sub: 'לגליל רדיוס ' + m('3') + ' ס״מ וגובה ' + m('10') + ' ס״מ. מה שטח המעטפת שלו?', tip: 'רק המלבן שבפריסה: היקף הבסיס כפול הגובה.', btn: 'המשך ←', win: 'נכון. המעטפת היא מלבן שאורכו היקף הבסיס.', wrongSay: 'מבקשים מעטפת בלבד, בלי בסיסים ובלי נפח.',
      opts: [
        { t: m('90π') + ' סמ״ר', f: 'חישבת נפח ' + m('π · 3² · 10 = 90π') + '. במעטפת משתמשים בהיקף הבסיס, לא בשטחו.' },
        { t: m('78π') + ' סמ״ר', f: 'הוספת שני בסיסים: זה שטח הפנים הכולל. כאן מבקשים רק את המעטפת.' },
        { t: m('60π') + ' סמ״ר', c: true, f: 'נכון: ' + m('2π · 3 · 10 = 60π') + ' סמ״ר.' },
        { t: m('30π') + ' סמ״ר', f: 'שכחת את ' + m('2') + ' בהיקף ' + m('2π · r') + '. אורך המלבן הוא ההיקף המלא.' }
      ], hints: ['חשוב על המלבן שבפריסה.', 'צלעותיו הן ' + m('2π · r') + ' ו־' + m('h') + '.', 'חשב את המקדם ' + m('2 · 3 · 10') + ' והשאר את ' + m('π') + '.'] },
    { mode: 'quiz', tA: 'מוצאים את הגובה', sub: 'נפח גליל הוא ' + m('80π') + ' סמ״ק והרדיוס שלו ' + m('4') + ' ס״מ. מה הגובה?', tip: 'חלק את הנפח בשטח הבסיס. ה־' + m('π') + ' מצטמצם.', btn: 'לסיכום ←', win: 'נכון. הנפח חלקי שטח הבסיס נותן את הגובה.', wrongSay: 'מחלקים בשטח הבסיס, לא ברדיוס או בקוטר.',
      opts: [
        { t: m('10') + ' ס״מ', f: 'חילקת ב־' + m('2 · 4 = 8') + ', הקוטר. צריך לחלק במקדם של שטח הבסיס ' + m('4² = 16') + '.' },
        { t: m('20') + ' ס״מ', f: 'חילקת ברדיוס ' + m('4') + ' במקום ברדיוס בריבוע ' + m('16') + '.' },
        { t: m('64') + ' ס״מ', f: 'חיסרת ' + m('16') + ' מ־' + m('80') + '. הגובה מוכפל בשטח הבסיס, ולכן מבטלים את הכפל בחילוק.' },
        { t: m('5') + ' ס״מ', c: true, f: 'נכון: שטח הבסיס ' + m('16π') + ' סמ״ר, ולכן ' + m('h = 80 ÷ 16 = 5') + ' ס״מ.' }
      ], hints: ['הנפח הוא שטח הבסיס כפול הגובה.', 'שטח הבסיס הוא ' + m('π · 4² = 16π') + ' סמ״ר.', 'חשב ' + m('80 ÷ 16') + '.'] },
    { mode: 'finish', tA: 'סיימת את העיגול והגליל', sub: 'גלגול מגלה היקף; סידור גזרות מגלה שטח; פריסה מפרידה מעטפת ובסיסים.', tip: 'כל הכבוד. עכשיו הנוסחאות קשורות לציור, לא רק לזיכרון.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      setup: function (ctx) { ctx.el('finalEq').style.whiteSpace = 'normal'; },
      finalLead: 'גלגלת שפה שלמה וסידרת את השטח מחדש. אלה הכללים שגילית:', formula: 'היקף: ' + m('P = 2π · r = π · d') + ' · שטח: ' + m('S = π · r²') + ' · נפח גליל: ' + m('V = π · r² · h') + ' · מעטפת: ' + m('2π · r · h') }
  ];
  window.NoamGame.boot({
    slug: 'galgal-haigul', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'היקף מקוטר', math: 'P = π · d' },
      { step: 4, name: 'שטח עיגול', math: 'S = π · r²' },
      { step: 6, name: 'שטח מעטפת גליל', math: '2π · r · h' },
      { step: 7, name: 'גובה מנפח', math: 'h = V ÷ (π · r²)' }
    ],
    bonus: {
      label: 'מכונת העיגול והגליל', closeLabel: 'סגור את המכונה', hint: 'חשב את המקדם של ' + m('π') + ' ובדוק.',
      setup: function (box, ctx) {
        var randomR = 1, randomH = 1, kind = 0, guess = 0, answer = 0;
        var names = ['היקף העיגול', 'שטח העיגול', 'נפח הגליל', 'שטח מעטפת הגליל'];
        var units = ['ס״מ', 'סמ״ר', 'סמ״ק', 'סמ״ר'];
        box.innerHTML = '<div class="bTitle">מכונת העיגול והגליל</div><div class="bSub" data-question></div><div class="bChip" data-chip dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit"><button type="button" data-d="-10" aria-label="הקטן את המקדם בעשר">−10</button><button type="button" data-d="-1" aria-label="הקטן את המקדם באחד">−1</button>'
          + '<bdi class="var math" data-guess dir="ltr"></bdi><button type="button" data-d="1" aria-label="הגדל את המקדם באחד">+1</button><button type="button" data-d="10" aria-label="הגדל את המקדם בעשר">+10</button></div></div>'
          + '<div class="bForms" data-forms hidden></div><div class="bOk" data-ok role="status" hidden></div><button type="button" class="bDice" data-check style="min-width:44px">בדוק</button><button type="button" class="bDice" data-new style="min-width:44px">תרגיל חדש ↻</button>';
        function updateGuess() { box.querySelector('[data-guess]').textContent = guess + 'π'; box.querySelector('[data-chip]').textContent = guess + 'π'; box.querySelector('[data-ok]').hidden = true; box.querySelector('[data-forms]').hidden = true; }
        function randomise() {
          randomR = 1 + Math.floor(Math.random() * 6); randomH = 1 + Math.floor(Math.random() * 10); kind = Math.floor(Math.random() * 4); guess = 0;
          answer = [2 * randomR, randomR * randomR, randomR * randomR * randomH, 2 * randomR * randomH][kind];
          box.querySelector('[data-question]').innerHTML = 'מצא את ' + names[kind] + ': רדיוס ' + bdi(String(randomR)) + ' ס״מ' + (kind >= 2 ? ', גובה ' + bdi(String(randomH)) + ' ס״מ' : '') + '. התשובה ב־' + units[kind] + ', כמכפלה של ' + bdi('π') + '.';
          updateGuess();
        }
        box.querySelectorAll('[data-d]').forEach(function (bt) { bt.addEventListener('click', function () { guess = clamp(guess + Number(bt.getAttribute('data-d')), 0, 360); updateGuess(); }); });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var correct = guess === answer, noteNode = box.querySelector('[data-ok]'); noteNode.hidden = false; noteNode.style.color = correct ? PAL.good : BAD;
          noteNode.textContent = correct ? 'נכון! בחרת את הנוסחה ואת המקדם המתאימים.' : 'עוד לא. בדוק אם מבקשים היקף, שטח או נפח, ואז כפל את המידות המתאימות.';
          if (correct) {
            var expression = [ '2 · ' + randomR, randomR + '²', randomR + '² · ' + randomH, '2 · ' + randomR + ' · ' + randomH ][kind];
            box.querySelector('[data-forms]').innerHTML = bdi('π · ' + expression + ' = ' + answer + 'π') + ' ' + units[kind]; box.querySelector('[data-forms]').hidden = false;
          }
          ctx.sfx(correct ? 'correct' : 'error');
        });
        box.querySelector('[data-new]').addEventListener('click', randomise); randomise();
      }
    }
  });
}());
