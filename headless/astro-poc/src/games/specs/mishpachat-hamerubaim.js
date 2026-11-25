/** משפחת המרובעים: האלכסונים, הזוויות ושטח הדלתון. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var DEG = Math.PI / 180;
  var MUTED = '#475569', BAD = '#b91c1c';

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function attrs(node, values) {
    Object.keys(values).forEach(function (key) { node.setAttribute(key, values[key]); });
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function svgText(id, size, colour) {
    return '<text id="' + id + '" x="201" y="20" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size + '" fill="' + colour + '"></text>';
  }
  function labelAt(ctx, id, x, y, text) {
    var node = ctx.el(id);
    attrs(node, { x: clamp(x, 28, 374), y: clamp(y, 23, 327) });
    node.textContent = text;
  }
  function handleMarkup(id, label, low, high, value, colour, role) {
    return '<g id="' + id + '" tabindex="0" role="' + (role || 'slider') + '" aria-label="' + label + '"'
      + (role === 'button' ? '' : ' aria-valuemin="' + low + '" aria-valuemax="' + high + '" aria-valuenow="' + value + '"')
      + ' style="cursor:grab"><circle r="30" fill="transparent" style="pointer-events:all"/>'
      + '<circle r="9" fill="#fff" stroke="' + colour + '" stroke-width="4" style="pointer-events:none"/></g>';
  }
  function stepperUnit(key, label, symbol) {
    return '<div class="unit" dir="ltr" style="padding:6px;gap:5px">'
      + '<bdi class="math var" dir="ltr" data-symbol="' + key + '">' + (symbol || key) + '</bdi>'
      + '<button type="button" id="' + key + 'Minus" data-key="' + key + '" data-delta="-1" aria-label="הקטן את ' + label + '">−</button>'
      + '<bdi class="math var" dir="ltr" data-value="' + key + '" style="min-width:30px" aria-live="polite"></bdi>'
      + '<button type="button" id="' + key + 'Plus" data-key="' + key + '" data-delta="1" aria-label="הגדל את ' + label + '">+</button></div>';
  }
  function cell(key) {
    return '<div><bdi class="math" dir="ltr" style="font-size:12px;color:' + MUTED + '">' + key + '</bdi>'
      + '<br><span class="math" dir="ltr" data-read="' + key + '"></span></div>';
  }
  function arrowDelta(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') return 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') return -1;
    return 0;
  }
  function shapeInfo(distances, theta) {
    var bisectsAC = distances.A === distances.C;
    var bisectsBD = distances.B === distances.D;
    var equal = distances.A + distances.C === distances.B + distances.D;
    var perpendicular = theta === 90;
    if (bisectsAC && bisectsBD) {
      if (equal && perpendicular) return { name: 'ריבוע', reason: 'האלכסונים חוצים זה את זה, שווים ומאונכים' };
      if (equal) return { name: 'מלבן', reason: 'האלכסונים חוצים זה את זה ושווים' };
      if (perpendicular) return { name: 'מעוין', reason: 'האלכסונים חוצים זה את זה ומאונכים' };
      return { name: 'מקבילית', reason: 'האלכסונים חוצים זה את זה' };
    }
    if (perpendicular && bisectsAC !== bisectsBD) return { name: 'דלתון', reason: 'אלכסון אחד הוא האנך האמצעי של האחר, אך לא להפך' };
    if (distances.A * distances.D === distances.B * distances.C) {
      return { name: 'טרפז', reason: m('OA : OC = OB : OD') + ' ולא בחצי; לכן ' + m('AB ∥ CD') };
    }
    if (distances.A * distances.B === distances.C * distances.D) {
      return { name: 'טרפז', reason: m('OA : OC = OD : OB') + ' ולא בחצי; לכן ' + m('AD ∥ BC') };
    }
    return { name: 'מרובע כללי', reason: 'אין כאן תנאי שמבטיח משפחה מיוחדת' };
  }

  /* Scene 1: four vertices on their own half-diagonals; stable DOM preserves focus. */
  function diagonalsScene(ctx) {
    var distances = { A: 3, B: 2, C: 3, D: 2 };
    var theta = 60, selected = 'A', builtRhombus = false, builtRectangle = false;
    var originX = 201, originY = 175, unit = 25;
    var vertices = {};
    var markup = '<polygon id="quad" fill="' + PAL.soft + '" stroke="' + PAL.ink + '" stroke-width="3" stroke-linejoin="round"/>'
      + '<line id="diagAC" stroke="' + PAL.main + '" stroke-width="2.5" stroke-dasharray="6 4"/>'
      + '<line id="diagBD" stroke="' + PAL.dark + '" stroke-width="2.5" stroke-dasharray="6 4"/>'
      + '<path id="thetaArc" fill="' + PAL.warmSoft + '" stroke="#b45309" stroke-width="2"/>'
      + '<circle cx="201" cy="175" r="4" fill="' + PAL.ink + '"/>'
      + svgText('thetaLabel', 14, '#92400e') + svgText('originLabel', 14, PAL.ink);
    ['A', 'B', 'C', 'D'].forEach(function (key) {
      markup += svgText('label' + key, 17, PAL.ink) + handleMarkup('h' + key, 'קודקוד ' + m(key) + ': שנה את המרחק מהמפגש בחיצים', 1, 5, distances[key], PAL.main);
    });
    ctx.draw(markup);
    var controls = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(5,minmax(0,1fr))">'
      + ['OA', 'OC', 'OB', 'OD', 'θ'].map(cell).join('') + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:10px 0" dir="ltr">'
      + ['A', 'B', 'C', 'D'].map(function (key) {
        return '<button type="button" id="choose' + key + '" data-vertex="' + key + '" aria-label="בחר קודקוד ' + m(key) + '" aria-pressed="false" style="min-height:44px;min-width:44px;border:2px solid ' + PAL.main + ';border-radius:12px;background:#fff;color:' + PAL.dark + ';font-family:Secular One,sans-serif">' + key + '</button>';
      }).join('') + '</div><div class="stepper" dir="ltr" style="gap:8px">'
      + stepperUnit('distance', 'המרחק של הקודקוד הנבחר מהמפגש', 'OA') + stepperUnit('theta', 'הזווית בין האלכסונים במרווח של חמש עשרה מעלות', 'θ')
      + '</div><div data-tasks style="text-align:center;font-size:13px;line-height:1.7;margin-top:8px" aria-live="polite"></div>');
    ctx.register('diagControls', controls);
    function direction(key) {
      if (key === 'A') return { x: -1, y: 0 };
      if (key === 'C') return { x: 1, y: 0 };
      var sign = key === 'B' ? 1 : -1;
      return { x: sign * Math.cos(theta * DEG), y: -sign * Math.sin(theta * DEG) };
    }
    function drawState(acted) {
      ['A', 'B', 'C', 'D'].forEach(function (key) {
        var ray = direction(key);
        vertices[key] = { x: originX + ray.x * unit * distances[key], y: originY + ray.y * unit * distances[key] };
        var vertex = vertices[key];
        attrs(ctx.el('h' + key), { transform: 'translate(' + vertex.x + ' ' + vertex.y + ')', 'aria-valuenow': distances[key], 'aria-valuetext': m(String(distances[key])) + ' יחידות מהמפגש' });
        labelAt(ctx, 'label' + key, vertex.x + ray.x * 23, vertex.y + ray.y * 23 + 5, key);
        controls.querySelector('[data-read="O' + key + '"]').textContent = distances[key];
        var chip = controls.querySelector('[data-vertex="' + key + '"]');
        chip.setAttribute('aria-pressed', String(selected === key));
        chip.style.background = selected === key ? PAL.soft : '#fff';
      });
      ctx.el('quad').setAttribute('points', ['A', 'B', 'C', 'D'].map(function (key) { return vertices[key].x + ',' + vertices[key].y; }).join(' '));
      attrs(ctx.el('diagAC'), { x1: vertices.A.x, y1: vertices.A.y, x2: vertices.C.x, y2: vertices.C.y });
      attrs(ctx.el('diagBD'), { x1: vertices.B.x, y1: vertices.B.y, x2: vertices.D.x, y2: vertices.D.y });
      var arcX = originX + 27 * Math.cos(theta * DEG), arcY = originY - 27 * Math.sin(theta * DEG);
      ctx.el('thetaArc').setAttribute('d', 'M201 175 L228 175 A27 27 0 0 0 ' + arcX + ' ' + arcY + ' Z');
      labelAt(ctx, 'thetaLabel', originX + 43 * Math.cos(theta * DEG / 2), originY - 43 * Math.sin(theta * DEG / 2), theta + '°');
      labelAt(ctx, 'originLabel', originX - 13, originY + 21, 'O');
      controls.querySelector('[data-read="θ"]').textContent = theta + '°';
      controls.querySelector('[data-symbol="distance"]').textContent = 'O' + selected;
      controls.querySelector('[data-value="distance"]').textContent = distances[selected];
      controls.querySelector('[data-value="theta"]').textContent = theta + '°';
      controls.querySelector('#distanceMinus').disabled = distances[selected] === 1;
      controls.querySelector('#distancePlus').disabled = distances[selected] === 5;
      controls.querySelector('#thetaMinus').disabled = theta === 30;
      controls.querySelector('#thetaPlus').disabled = theta === 90;
      var info = shapeInfo(distances, theta);
      ctx.caption(info.name + ' — ' + info.reason);
      if (acted && info.name === 'מעוין') builtRhombus = true;
      if (acted && info.name === 'מלבן') builtRectangle = true;
      controls.querySelector('[data-tasks]').textContent = (builtRhombus ? '✓' : '○') + ' מעוין שאינו ריבוע · ' + (builtRectangle ? '✓' : '○') + ' מלבן שאינו ריבוע';
      if (info.name === 'ריבוע') ctx.note('ריבוע הוא מעוין מיוחד וגם מלבן מיוחד. כאן צריך מעוין בלי מלבן, ומלבן בלי מעוין: שנה את האורכים או את הזווית.');
      else if (distances.A !== distances.C || distances.B !== distances.D) ctx.note('האלכסונים עדיין לא חוצים זה את זה. זה אפילו לא מקבילית עדיין: התאם את שני החצאים של כל אלכסון.');
      else if (builtRhombus && builtRectangle) ctx.note('בנית את שני המרובעים: במעוין האלכסונים מאונכים ולא שווים; במלבן הם שווים ולא מאונכים.', 'good');
      else if (info.name === 'מעוין') ctx.note('מעוין שאינו ריבוע נבנה! עכשיו השווה גם את אורכי האלכסונים ושנה את הזווית כדי לבנות מלבן שאינו ריבוע.', 'good');
      else if (info.name === 'מלבן') ctx.note('מלבן שאינו ריבוע נבנה! עכשיו בנה אלכסונים מאונכים שאינם שווים כדי לקבל מעוין שאינו ריבוע.', 'good');
      else ctx.note('שני האלכסונים נחצים: זו מקבילית. חפש אלכסונים מאונכים למעוין, ושווים למלבן. אל תבנה ריבוע.');
      if (acted && builtRhombus && builtRectangle) ctx.solved();
    }
    function setDistance(key, value) {
      var nextValue = clamp(Math.round(value), 1, 5);
      if (nextValue === distances[key]) return;
      distances[key] = nextValue; selected = key;
      ctx.sfx('tick'); drawState(true);
    }
    controls.querySelectorAll('[data-vertex]').forEach(function (chip) {
      chip.addEventListener('click', function () { selected = chip.getAttribute('data-vertex'); drawState(false); });
    });
    controls.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        var delta = Number(buttonNode.getAttribute('data-delta'));
        if (buttonNode.getAttribute('data-key') === 'distance') setDistance(selected, distances[selected] + delta);
        else { theta = clamp(theta + delta * 15, 30, 90); ctx.sfx('tick'); drawState(true); }
      });
    });
    ['A', 'B', 'C', 'D'].forEach(function (key) {
      var handle = ctx.el('h' + key);
      handle.addEventListener('keydown', function (event) {
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setDistance(key, event.key === 'Home' ? 1 : 5); return; }
        var delta = arrowDelta(event);
        if (!delta) return;
        event.preventDefault(); setDistance(key, distances[key] + delta);
      });
      ctx.drag(handle, { move: function (x, y) {
        var ray = direction(key);
        setDistance(key, ((x - originX) * ray.x + (y - originY) * ray.y) / unit);
      } });
    });
    drawState(false);
  }

  /* Scene 3: sides and angle define an actual parallelogram. */
  function anglesScene(ctx) {
    var sideA = 4, sideB = 5, alpha = 90, completed = false;
    var topLeft = { x: 0, y: 0 }, scale = 1, baseLeft = { x: 0, y: 0 };
    var html = '<polygon id="para" fill="' + PAL.soft + '" stroke="' + PAL.ink + '" stroke-width="3"/>'
      + '<path id="neighbours" fill="none" stroke="#b45309" stroke-width="2"/>'
      + svgText('sum180', 18, '#92400e') + svgText('sideALabel', 16, PAL.dark) + svgText('sideBLabel', 16, PAL.dark);
    for (var index = 0; index < 4; index++) html += '<path id="angleW' + index + '" fill="' + (index < 2 ? PAL.warmSoft : PAL.goodSoft) + '" stroke="' + PAL.line + '"/>' + svgText('angleL' + index, 14, PAL.ink);
    html += handleMarkup('angleHandle', 'הקודקוד השמאלי העליון: למעלה ולמטה משנים את הזווית, שמאלה וימינה משנים את הצלע השנייה', 0, 0, 0, PAL.main, 'button');
    ctx.draw(html);
    var controls = ctx.extra('<div class="stepper" dir="ltr" style="gap:8px">' + stepperUnit('a', 'אורך הצלע הראשונה') + stepperUnit('b', 'אורך הצלע השנייה') + stepperUnit('alpha', 'הזווית במרווח של חמש עשרה מעלות', 'α') + '</div>');
    ctx.register('angleControls', controls);
    function polar(vertex, radius, angle) { return { x: vertex.x + radius * Math.cos(angle * DEG), y: vertex.y - radius * Math.sin(angle * DEG) }; }
    function updateAngles(acted) {
      var offset = sideB * Math.cos(alpha * DEG), height = sideB * Math.sin(alpha * DEG);
      var minX = Math.min(0, offset), maxX = Math.max(sideA, sideA + offset);
      scale = Math.min(260 / (maxX - minX), 176 / height);
      var x0 = 201 - (maxX - minX) * scale / 2 - minX * scale;
      baseLeft = { x: x0, y: 250 };
      topLeft = { x: x0 + offset * scale, y: 250 - height * scale };
      var corners = [baseLeft, { x: x0 + sideA * scale, y: 250 }, { x: topLeft.x + sideA * scale, y: topLeft.y }, topLeft];
      ctx.el('para').setAttribute('points', corners.map(function (vertex) { return vertex.x + ',' + vertex.y; }).join(' '));
      var starts = [0, alpha, 180, alpha + 180];
      var values = [alpha, 180 - alpha, alpha, 180 - alpha];
      corners.forEach(function (vertex, i) {
        var from = polar(vertex, 19, starts[i]), to = polar(vertex, 19, starts[i] + values[i]);
        ctx.el('angleW' + i).setAttribute('d', 'M' + vertex.x + ' ' + vertex.y + ' L' + from.x + ' ' + from.y + ' A19 19 0 0 0 ' + to.x + ' ' + to.y + ' Z');
        var labelPos = polar(vertex, 41, starts[i] + values[i] / 2);
        labelAt(ctx, 'angleL' + i, labelPos.x, labelPos.y + 5, values[i] + '°');
      });
      attrs(ctx.el('angleHandle'), { transform: 'translate(' + topLeft.x + ' ' + topLeft.y + ')', 'aria-label': 'הקודקוד: זווית ' + m(alpha + '°') + ', צלע ' + m(String(sideB)) + '. חיצים למעלה ולמטה משנים זווית; שמאלה וימינה משנים צלע' });
      ctx.el('neighbours').setAttribute('d', 'M' + corners[0].x + ' 267 V276 H' + corners[1].x + ' V267');
      labelAt(ctx, 'sum180', (corners[0].x + corners[1].x) / 2, 306, '180°');
      labelAt(ctx, 'sideALabel', (corners[2].x + corners[3].x) / 2, topLeft.y - 14, 'a = ' + sideA);
      labelAt(ctx, 'sideBLabel', (baseLeft.x + topLeft.x) / 2 - 25, (baseLeft.y + topLeft.y) / 2, 'b = ' + sideB);
      controls.querySelector('[data-value="a"]').textContent = sideA;
      controls.querySelector('[data-value="b"]').textContent = sideB;
      controls.querySelector('[data-value="alpha"]').textContent = alpha + '°';
      ['a', 'b', 'alpha'].forEach(function (key) {
        var value = key === 'a' ? sideA : key === 'b' ? sideB : alpha;
        controls.querySelector('#' + key + 'Minus').disabled = value === (key === 'alpha' ? 30 : 2);
        controls.querySelector('#' + key + 'Plus').disabled = value === (key === 'alpha' ? 150 : 8);
      });
      ctx.caption(m(alpha + '° + ' + (180 - alpha) + '° = 180°') + ' · הזוויות הנגדיות שוות');
      if (sideA === sideB && (alpha === 60 || alpha === 120)) {
        ctx.note('בנית מעוין עם זווית ' + m('60°') + '! כל הצלעות שוות, והזוויות הן ' + m('60°, 120°, 60°, 120°') + '.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
      } else if (sideA === sideB && alpha === 90) ctx.note('זה ריבוע, מעוין מיוחד. כל הזוויות שלו ' + m('90°') + ', אבל אנחנו רוצים מעוין עם זווית ' + m('60°') + '.');
      else if ((alpha === 60 || alpha === 120) && sideA !== sideB) ctx.note('הזווית נכונה! במעוין כל ארבע הצלעות שוות, ולכן צריך גם ' + m('a = b') + '.');
      else ctx.note('זו מקבילית. השווה את ' + m('a') + ' ואת ' + m('b') + ', ובחר זווית ' + m('60°') + ' או ' + m('120°') + '.');
    }
    function setShape(key, value) {
      if (key === 'a') sideA = clamp(Math.round(value), 2, 8);
      if (key === 'b') sideB = clamp(Math.round(value), 2, 8);
      if (key === 'alpha') alpha = clamp(Math.round(value / 15) * 15, 30, 150);
      ctx.sfx('tick'); updateAngles(true);
    }
    controls.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        var key = buttonNode.getAttribute('data-key'), delta = Number(buttonNode.getAttribute('data-delta'));
        setShape(key, (key === 'a' ? sideA : key === 'b' ? sideB : alpha) + delta * (key === 'alpha' ? 15 : 1));
      });
    });
    var handle = ctx.el('angleHandle');
    handle.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setShape('b', sideB + (event.key === 'ArrowRight' ? 1 : -1)); }
      else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setShape('alpha', alpha + (event.key === 'ArrowUp' ? 15 : -15)); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setShape('alpha', event.key === 'Home' ? 30 : 150); }
    });
    var dragScale = 1, dragBase = { x: 0, y: 0 };
    ctx.drag(handle, { start: function () { dragScale = scale; dragBase = { x: baseLeft.x, y: baseLeft.y }; }, move: function (x, y) {
      var dx = x - dragBase.x, dy = dragBase.y - y;
      sideB = clamp(Math.round(Math.hypot(dx, dy) / dragScale), 2, 8);
      alpha = clamp(Math.round(Math.atan2(dy, dx) / DEG / 15) * 15, 30, 150);
      updateAngles(true);
    } });
    updateAngles(false);
  }

  /* Scene 5: perpendicular diagonals, a surrounding rectangle and its four outside triangles. */
  function kiteScene(ctx) {
    var diagonalOne = 6, diagonalTwo = 4, crossing = 3, completed = false;
    var unit = 20, leftX = 141, centreY = 175;
    var html = '<g id="outsideTriangles" fill="' + PAL.warmSoft + '">';
    for (var index = 0; index < 4; index++) html += '<polygon id="outside' + index + '"/>';
    html += '</g><rect id="aroundKite" fill="none" stroke="#92400e" stroke-width="2" stroke-dasharray="7 5"/>'
      + '<polygon id="kite" fill="' + PAL.soft + '" stroke="' + PAL.ink + '" stroke-width="3"/>'
      + '<line id="kiteD1" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<line id="kiteD2" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<path id="rightAngle" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + svgText('kiteD1Label', 17, PAL.dark) + svgText('kiteD2Label', 17, PAL.dark) + svgText('kiteTLabel', 14, PAL.ink)
      + handleMarkup('crossHandle', 'נקודת המפגש: חצים משנים את המרחק מהקצה השמאלי', 1, 5, crossing, PAL.dark)
      + handleMarkup('topHandle', 'הקודקוד העליון: חצים משנים את אורך האלכסון האנכי', 2, 12, diagonalTwo, PAL.main);
    ctx.draw(html);
    var controls = ctx.extra('<div class="stepper" dir="ltr" style="gap:8px">' + stepperUnit('d1', 'האלכסון האופקי', 'd₁') + stepperUnit('d2', 'האלכסון האנכי', 'd₂') + stepperUnit('t', 'מרחק המפגש מהקצה השמאלי') + '</div>'
      + '<div class="sceneStrip" style="margin-top:10px"><b>הדלתון הוא חצי מהמלבן המקווקו</b>'
      + '<div dir="ltr" style="display:flex;align-items:center;justify-content:center;gap:10px;font-family:Secular One,sans-serif;font-size:20px">'
      + bdi('S =') + '<div style="display:inline-flex;flex-direction:column;text-align:center"><bdi class="math" dir="ltr" data-numerator style="border-bottom:2px solid ' + PAL.ink + ';padding:0 8px 2px"></bdi><bdi class="math" dir="ltr">2</bdi></div>'
      + '<bdi class="math" dir="ltr" data-area></bdi></div></div>');
    ctx.register('kiteControls', controls);
    function updateKite(acted) {
      leftX = 201 - diagonalOne * unit / 2;
      var rightX = leftX + diagonalOne * unit, crossX = leftX + crossing * unit;
      var topY = centreY - diagonalTwo * unit / 2, bottomY = centreY + diagonalTwo * unit / 2;
      var pointStrings = [leftX + ',' + centreY, crossX + ',' + topY, rightX + ',' + centreY, crossX + ',' + bottomY];
      ctx.el('kite').setAttribute('points', pointStrings.join(' '));
      var corners = [leftX + ',' + topY, rightX + ',' + topY, rightX + ',' + bottomY, leftX + ',' + bottomY];
      for (var i = 0; i < 4; i++) ctx.el('outside' + i).setAttribute('points', corners[i] + ' ' + pointStrings[i] + ' ' + pointStrings[(i + 1) % 4]);
      attrs(ctx.el('aroundKite'), { x: leftX, y: topY, width: diagonalOne * unit, height: diagonalTwo * unit });
      attrs(ctx.el('kiteD1'), { x1: leftX, y1: centreY, x2: rightX, y2: centreY });
      attrs(ctx.el('kiteD2'), { x1: crossX, y1: topY, x2: crossX, y2: bottomY });
      ctx.el('rightAngle').setAttribute('d', 'M' + (crossX + 13) + ' 175 V162 H' + crossX);
      attrs(ctx.el('crossHandle'), { transform: 'translate(' + crossX + ' 175)', 'aria-valuemax': diagonalOne - 1, 'aria-valuenow': crossing });
      attrs(ctx.el('topHandle'), { transform: 'translate(' + crossX + ' ' + topY + ')', 'aria-valuenow': diagonalTwo });
      labelAt(ctx, 'kiteD1Label', 201, bottomY + 25, 'd₁ = ' + diagonalOne);
      labelAt(ctx, 'kiteD2Label', rightX + 32, centreY + 5, 'd₂ = ' + diagonalTwo);
      labelAt(ctx, 'kiteTLabel', (leftX + crossX) / 2, centreY + 28, 't = ' + crossing);
      controls.querySelector('[data-value="d1"]').textContent = diagonalOne;
      controls.querySelector('[data-value="d2"]').textContent = diagonalTwo;
      controls.querySelector('[data-value="t"]').textContent = crossing;
      controls.querySelector('[data-numerator]').textContent = diagonalOne + ' · ' + diagonalTwo;
      controls.querySelector('[data-area]').textContent = '= ' + (diagonalOne * diagonalTwo / 2);
      ['d1', 'd2', 't'].forEach(function (key) {
        var value = key === 'd1' ? diagonalOne : key === 'd2' ? diagonalTwo : crossing;
        controls.querySelector('#' + key + 'Minus').disabled = value === (key === 't' ? 1 : 2);
        controls.querySelector('#' + key + 'Plus').disabled = value === (key === 't' ? diagonalOne - 1 : 12);
      });
      var rhombus = 2 * crossing === diagonalOne, product = diagonalOne * diagonalTwo;
      ctx.caption((rhombus ? 'מעוין' : 'דלתון שאינו מעוין') + ': ' + m('2t ' + (rhombus ? '=' : '≠') + ' d₁'));
      if (rhombus) ctx.note('שני האלכסונים נחצים, לכן זה מעוין. הזז את המפגש מהאמצע כדי לבנות דלתון שאינו מעוין.');
      else if (product === 24) ctx.note('המכפלה ' + m('24') + ' היא שטח המלבן סביב הדלתון. הדלתון הוא חצי ממנו: השטח שלו רק ' + m('12') + '.');
      else if (product === 48) {
        ctx.note('בדיוק! חצי משטח המלבן הוא ' + m('48 ÷ 2 = 24') + ', ורק האלכסון האנכי נחצה: זה דלתון שאינו מעוין.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
      } else ctx.note('שטח הדלתון עכשיו ' + m(String(product / 2)) + '. כדי להגיע ל־' + m('24') + ', שטח המלבן סביבו צריך להיות כפול.');
    }
    function setKite(key, value) {
      if (key === 'd1') { diagonalOne = clamp(Math.round(value), 2, 12); crossing = clamp(crossing, 1, diagonalOne - 1); }
      if (key === 'd2') diagonalTwo = clamp(Math.round(value), 2, 12);
      if (key === 't') crossing = clamp(Math.round(value), 1, diagonalOne - 1);
      ctx.sfx('tick'); updateKite(true);
    }
    controls.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        var key = buttonNode.getAttribute('data-key');
        setKite(key, (key === 'd1' ? diagonalOne : key === 'd2' ? diagonalTwo : crossing) + Number(buttonNode.getAttribute('data-delta')));
      });
    });
    [['crossHandle', 't'], ['topHandle', 'd2']].forEach(function (pair) {
      var handle = ctx.el(pair[0]);
      handle.addEventListener('keydown', function (event) {
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setKite(pair[1], event.key === 'Home' ? (pair[1] === 't' ? 1 : 2) : (pair[1] === 't' ? diagonalOne - 1 : 12)); return; }
        var delta = arrowDelta(event);
        if (!delta) return;
        event.preventDefault(); setKite(pair[1], (pair[1] === 't' ? crossing : diagonalTwo) + delta);
      });
      ctx.drag(handle, { move: function (x, y) { setKite(pair[1], pair[1] === 't' ? (x - leftX) / unit : 2 * (centreY - y) / unit); } });
    });
    updateKite(false);
  }

  var steps = [
    {
      mode: 'intro', tA: 'משפחת המרובעים', sub: 'האלכסונים מגלים את הצורה — ואת השטח שלה.',
      tip: 'שלום, אני אליהו. בוא נבנה מרובעים ונגלה מה האלכסונים מספרים עליהם.',
      emoji: '🪁', eq: m('S = d₁ · d₂ ÷ 2'),
      note: 'נכיר מקבילית, מלבן, מעוין, ריבוע, דלתון וטרפז. במעוין ובדלתון האלכסונים מאונכים, והשטח הוא חצי מהמלבן שסביבם.',
      cue: 'מוכן לבנות את המשפחה?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'בונים מרובע מאלכסונים',
      sub: 'בנה מעוין שאינו ריבוע וגם מלבן שאינו ריבוע, בכל סדר. שנה קודקודים בגרירה, בכפתורים או בחיצים; את הזווית שנה בכפתורים.',
      tip: 'כל קודקוד נע על חצי אלכסון. קודם דאג שהאלכסונים יחצו זה את זה.',
      aspect: [402, 350], alt: 'מרובע עם אלכסון אופקי ואלכסון נטוי, נקודת מפגש וארבעה קודקודים ניתנים לשינוי בגרירה, בכפתורים או בחיצים',
      cue: 'בנה את שני המרובעים בלי לבנות ריבוע', cueDone: 'בנית מעוין ומלבן שאינם ריבועים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'diagControls', text: 'בחר קודקוד ושנה את מרחקו בכפתורים. הזווית בין האלכסונים משנה את המשפחה.' }, setup: diagonalsScene
    },
    {
      mode: 'quiz', tA: 'מה אפשר לדעת בוודאות?', sub: 'האלכסונים של מרובע חוצים זה את זה ושווים זה לזה. איזה מרובע זה בוודאות?',
      tip: 'לא צריך לנחש לפי המראה. חפש את התנאים שמובטחים בשאלה.', btn: 'המשך ←',
      win: 'נכון. חוצים זה את זה ושווים — זה מלבן.', wrongSay: 'בדוק איזה תנאי נוסף דורשת כל צורה, והאם הוא נתון.',
      opts: [
        { t: 'מלבן', c: true, f: 'נכון. אלכסונים שחוצים זה את זה יוצרים מקבילית; אם הם גם שווים, זה מלבן. ייתכן שהוא ריבוע, אבל לא חייב להיות.' },
        { t: 'ריבוע', f: 'לריבוע צריך גם אלכסונים מאונכים. בשאלה נאמר שהם שווים, אבל לא נאמר שהם מאונכים.' },
        { t: 'מעוין', f: 'במעוין האלכסונים מאונכים, ולא בהכרח שווים. שוויון לבדו אינו מבטיח מעוין.' },
        { t: 'דלתון', f: 'בדלתון שאינו מעוין רק אלכסון אחד נחצה. כאן שני האלכסונים חוצים זה את זה, והשוויון ביניהם מבטיח מלבן.' }
      ],
      hints: ['התחל מהתנאי: האלכסונים חוצים זה את זה.', 'כעת הוסף שהם שווים. איזה סוג של מקבילית מתקבל?', 'מאונכות אינה נתונה, ולכן אין ודאות שזה ריבוע.']
    },
    {
      mode: 'scene', tA: 'המקבילית והזוויות שלה', sub: 'בנה מעוין עם זווית ' + m('60°') + ' בגרירה, בכפתורים או בחיצים. בקודקוד העליון: למעלה ולמטה משנים זווית; שמאלה וימינה משנים את ' + m('b') + '.',
      tip: 'במקבילית הזוויות הנגדיות שוות, ושתי זוויות שכנות משלימות ל־' + m('180°') + '.',
      aspect: [402, 330], alt: 'מקבילית עם ארבע זוויות מסומנות, שתי צלעות משתנות וקודקוד עליון נגיש לגרירה, לכפתורים ולחיצים; הזוויות השכנות מסומנות יחד',
      cue: 'השווה את הצלעות ובנה זווית של שישים מעלות', cueDone: 'מעוין עם זווית מתאימה נבנה. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'angleControls', text: 'השווה את הצלעות, ואז שנה את הזווית. גם ' + m('120°') + ' נותנת זווית שכנה של ' + m('60°') + '.' }, setup: anglesScene
    },
    {
      mode: 'quiz', tA: 'שלוש הזוויות האחרות', sub: 'במקבילית אחת הזוויות היא ' + m('70°') + '. מהן שלוש הזוויות האחרות, לפי הסדר סביב המרובע?',
      tip: 'השכנה משלימה לקו ישר, והנגדית שווה לזווית הנתונה.', btn: 'המשך ←',
      win: 'בדיוק. שכנות משלימות, ונגדיות שוות.', wrongSay: 'בדוק גם את סכום השכנות וגם את הזווית שממול.',
      opts: [
        { t: m('70°, 70°, 220°'), f: 'זווית פנימית של מקבילית קטנה מ־' + m('180°') + '. ' + m('220°') + ' אינה אפשרית כאן.' },
        { t: m('110°, 70°, 110°'), c: true, f: 'נכון: ' + m('180° − 70° = 110°') + ' בכל שכנה, והזווית הנגדית היא שוב ' + m('70°') + '.' },
        { t: m('110°, 110°, 110°'), f: 'שכחת שהזווית הנגדית שווה לנתונה: אחת מהשלוש חייבת להיות ' + m('70°') + '.' },
        { t: m('20°, 70°, 20°'), f: 'השלמת ל־' + m('90°') + '. זוויות שכנות במקבילית משלימות ל־' + m('180°') + ', לא לזווית ישרה.' }
      ],
      hints: ['מצא קודם את הזווית השכנה לנתונה.', 'השכנות משלימות ל־' + m('180°') + ', והנגדיות שוות.', 'השכנה היא ' + m('180° − 70°') + '; ממול נמצאת שוב ' + m('70°') + '.']
    },
    {
      mode: 'scene', tA: 'שטח הדלתון', sub: 'בנה דלתון ששטחו ' + m('24') + ' ואינו מעוין, בגרירה, בכפתורים או בחיצים. הזז את המפגש ואת הקודקוד העליון; את האלכסון האופקי שנה בכפתורים.',
      tip: 'הדלתון ממלא חצי מהמלבן המקווקו. המפגש לא צריך להיות באמצע האלכסון האופקי.',
      aspect: [402, 350], alt: 'דלתון בתוך מלבן מקווקו, ארבעה משולשים חיצוניים מוצללים, אלכסונים מאונכים, נקודת מפגש וקודקוד עליון הניתנים לשינוי בגרירה, בכפתורים או בחיצים',
      cue: 'בנה שטח עשרים וארבע ומפגש שאינו באמצע', cueDone: 'בנית דלתון בשטח המבוקש. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'kiteControls', text: 'חשב את שטח המלבן שסביב הדלתון, ואז חלק לשניים. הזז את המפגש מהאמצע.' }, setup: kiteScene
    },
    {
      mode: 'quiz', tA: 'שטח המעוין', sub: 'אלכסוני מעוין הם ' + m('10') + ' ס״מ ו־' + m('24') + ' ס״מ. מה שטחו?',
      tip: 'האלכסונים הם אורכי המלבן שסביב המעוין. איזה חלק ממנו הוא המעוין?', btn: 'המשך ←',
      win: 'נכון. כופלים את האלכסונים ולוקחים חצי.', wrongSay: 'בדוק אם חישבת שטח של מעוין, של המלבן שסביבו או אורך צלע.',
      opts: [
        { t: m('240') + ' סמ״ר', f: 'כפלת את האלכסונים אבל שכחת לחלק לשניים. ' + m('240') + ' הוא שטח המלבן סביב המעוין.' },
        { t: m('34') + ' סמ״ר', f: 'חיברת את אורכי האלכסונים. כדי למצוא שטח צריך לכפול אותם ולקחת חצי.' },
        { t: m('120') + ' סמ״ר', c: true, f: 'נכון: ' + m('10 · 24 ÷ 2 = 120') + ' סמ״ר. המעוין הוא חצי מהמלבן סביבו.' },
        { t: m('13') + ' סמ״ר', f: m('13') + ' ס״מ הוא אורך צלע המעוין: חצאי האלכסונים הם ' + m('5') + ' ו־' + m('12') + '. אורך צלע אינו שטח.' }
      ],
      hints: ['זכור את המלבן המקווקו סביב הדלתון: אותו רעיון עובד במעוין.', 'כפול את שני האלכסונים, ואז קח חצי.', 'המכפלה היא ' + m('240') + '; עכשיו חלק אותה לשניים.']
    },
    {
      mode: 'quiz', tA: 'שתי זוויות באותה שוק', sub: 'בטרפז, הזווית ליד הבסיס הגדול היא ' + m('65°') + '. מה הזווית ליד אותה שוק, ליד הבסיס הקטן?',
      tip: 'הבסיסים מקבילים. השוק חותכת אותם, ושתי הזוויות שבאותו צד משלימות לקו ישר.', btn: 'לסיכום ←',
      win: 'יפה. באותה שוק של טרפז הזוויות משלימות למאה ושמונים מעלות.', wrongSay: 'בחר את הסכום המתאים לזוויות שבאותה שוק בין בסיסים מקבילים.',
      opts: [
        { t: m('65°'), f: 'שתי הזוויות באותה שוק אינן בהכרח שוות; הן מסתכמות ב־' + m('180°') + '.' },
        { t: m('25°'), f: 'השלמת ל־' + m('90°') + '. בין הבסיסים המקבילים משלימים ל־' + m('180°') + '.' },
        { t: m('295°'), f: 'השלמת ל־' + m('360°') + ', סכום כל זוויות המרובע. כאן מדובר בשתי הזוויות שבאותה שוק בלבד.' },
        { t: m('115°'), c: true, f: 'נכון: ' + m('180° − 65° = 115°') + '. שתי הזוויות שבאותה שוק משלימות ל־' + m('180°') + '.' }
      ],
      hints: ['השתמש במקבילות של שני הבסיסים.', 'השוק חותכת את המקבילים, ולכן שתי הזוויות באותו צד מסתכמות ב־' + m('180°') + '.', 'חשב את מה שחסר ב־' + m('65° + ? = 180°') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת להכיר את משפחת המרובעים', sub: 'מזהים לפי תכונות, לא רק לפי מראה. עכשיו אפשר לתרגל עוד.',
      tip: 'כל הכבוד. האלכסונים מספרים לך איזו צורה לפניך וגם איך לחשב את השטח.',
      finalLead: 'האלכסונים מספרים את שם המרובע. אלה הכללים שגילית:',
      formula: 'מקבילית: האלכסונים חוצים זה את זה.\nמלבן: גם שווים. מעוין: גם מאונכים.\nריבוע: גם שווים וגם מאונכים.\nדלתון: אלכסון אחד הוא האנך האמצעי של האחר.\nשטח מעוין או דלתון: ' + m('d₁ · d₂ ÷ 2') + '.\nזוויות שכנות במקבילית, או באותה שוק בטרפז: ' + m('180°') + '.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻'
    }
  ];

  window.NoamGame.boot({
    slug: 'mishpachat-hamerubaim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'זיהוי לפי אלכסונים', math: 'AC = BD' },
      { step: 4, name: 'זוויות המקבילית', math: '70° + 110° = 180°' },
      { step: 6, name: 'שטח לפי אלכסונים', math: 'd₁ · d₂ ÷ 2' },
      { step: 7, name: 'זוויות הטרפז', math: '65° + 115° = 180°' }
    ],
    bonus: {
      label: 'מכונת שטחי המרובעים', closeLabel: 'סגור את המכונה', hint: 'קבל מעוין או דלתון עם אלכסונים חדשים וחשב את השטח.',
      setup: function (box, ctx) {
        var first = 6, second = 8, guess = 0;
        box.innerHTML = '<style>#finalEq{white-space:pre-line;font-family:Heebo,sans-serif;font-size:15px;line-height:1.6;padding:12px}#finalEq .math{font-family:Secular One,sans-serif}</style>'
          + '<div class="bTitle">מכונת שטחי המרובעים</div><div class="bSub" data-description></div>'
          + '<div class="bChip" data-diagonals dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" dir="ltr"><button type="button" data-delta="-10" aria-label="הקטן את השטח בעשר">−10</button>'
          + '<button type="button" data-delta="-1" aria-label="הקטן את השטח באחת">−</button><bdi class="math var" dir="ltr" data-guess style="min-width:32px"></bdi>'
          + '<button type="button" data-delta="1" aria-label="הגדל את השטח באחת">+</button><button type="button" data-delta="10" aria-label="הגדל את השטח בעשר">+10</button></div></div>'
          + '<div class="bForms" data-solution hidden></div><div class="bOk" data-message role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-width:44px">בדוק</button><button type="button" class="bDice" data-roll style="min-width:44px">מרובע חדש ↻</button>';
        function showGuess() {
          box.querySelector('[data-guess]').textContent = guess;
          box.querySelector('[data-solution]').hidden = true;
          box.querySelector('[data-message]').hidden = true;
        }
        function rollArea() {
          first = 2 * (1 + Math.floor(Math.random() * 6));
          second = 2 + Math.floor(Math.random() * 11);
          guess = 0;
          box.querySelector('[data-description]').textContent = (Math.random() < 0.5 ? 'מעוין' : 'דלתון') + ' עם האלכסונים האלה. מה השטח ביחידות שטח?';
          box.querySelector('[data-diagonals]').textContent = 'd₁ = ' + first + ', d₂ = ' + second;
          showGuess();
        }
        box.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-delta')), 0, 144); ctx.sfx('click'); showGuess(); });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var correct = guess === first * second / 2;
          var statusNode = box.querySelector('[data-message]');
          statusNode.hidden = false; statusNode.style.color = correct ? PAL.good : BAD;
          statusNode.textContent = correct ? 'נכון! לקחת חצי ממכפלת האלכסונים.' : 'נסה שוב: כופלים את האלכסונים ואז לוקחים חצי, ולא מחברים אותם.';
          if (correct) {
            var formsNode = box.querySelector('[data-solution]');
            formsNode.hidden = false;
            formsNode.innerHTML = '<div dir="ltr" style="display:flex;gap:10px;justify-content:center;align-items:center">'
              + '<div style="display:inline-flex;flex-direction:column"><bdi class="math" dir="ltr" style="border-bottom:2px solid ' + PAL.ink + '">' + first + ' · ' + second + '</bdi>'
              + '<bdi class="math" dir="ltr">2</bdi></div>' + bdi('= ' + (first * second / 2)) + '</div>';
          }
          ctx.sfx(correct ? 'correct' : 'error');
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); rollArea(); });
        rollArea();
      }
    }
  });
}());
