/** מעבדת הפרבולות: קודקוד, אפסים, הצגות שקולות, חיתוך ושליליות. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402, H = 370, U = 28, OX = 136, OY = 198;
  var MUTED = '#55537a', LINE_COLOR = '#b45309';

  function num(n) { return n < 0 ? '−' + Math.abs(n) : String(n); }
  function px(x) { return OX + U * x; }
  function py(y) { return OY - U * y; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pair(x, y) { return '(' + num(x) + ', ' + num(y) + ')'; }
  function valF(x) { return x * x - 4 * x; }
  function valG(x) { return x - 4; }
  function vertexEq(a, p, k) {
    var term = p === 0 ? 'x²' : '(x ' + (p > 0 ? '− ' + p : '+ ' + Math.abs(p)) + ')²';
    var coeff = a === 1 ? '' : a === -1 ? '−' : num(a);
    return 'f(x) = ' + coeff + term + (k === 0 ? '' : k > 0 ? ' + ' + k : ' − ' + Math.abs(k));
  }
  function svgText(x, y, text, color, size, anchor) {
    return '<text x="' + x + '" y="' + y + '" direction="ltr" font-family="Secular One, sans-serif"'
      + ' font-size="' + (size || 12) + '" text-anchor="' + (anchor || 'middle') + '" fill="' + (color || MUTED) + '">' + text + '</text>';
  }
  function baseGrid() {
    var html = '<defs><clipPath id="paraClip"><rect x="52" y="30" width="280" height="308"/></clipPath></defs>'
      + '<rect x="52" y="30" width="280" height="308" rx="2" fill="#fff" stroke="' + PAL.line + '"/>';
    var tick;
    for (tick = -3; tick <= 7; tick++) {
      html += '<line x1="' + px(tick) + '" y1="30" x2="' + px(tick) + '" y2="338" stroke="' + PAL.line + '" stroke-width=".7" opacity=".7"/>';
    }
    for (tick = -5; tick <= 6; tick++) {
      html += '<line x1="52" y1="' + py(tick) + '" x2="332" y2="' + py(tick) + '" stroke="' + PAL.line + '" stroke-width=".7" opacity=".7"/>';
    }
    html += '<line x1="52" y1="198" x2="340" y2="198" stroke="' + PAL.ink + '" stroke-width="1.8"/>'
      + '<line x1="136" y1="22" x2="136" y2="338" stroke="' + PAL.ink + '" stroke-width="1.8"/>';
    for (tick = -3; tick <= 7; tick++) {
      if (tick !== 0) html += svgText(px(tick), OY + 17, num(tick), MUTED, 11);
    }
    for (tick = -5; tick <= 6; tick++) {
      if (tick !== 0) html += svgText(OX - 8, py(tick) + 4, num(tick), MUTED, 11, 'end');
    }
    return html + svgText(352, 202, 'x', PAL.ink, 15) + svgText(148, 20, 'y', PAL.ink, 15);
  }
  // An exact quadratic Bézier; control ordinate follows the derivative at x = −3.
  function curveD(a, p, k) {
    var leftY = a * Math.pow(-3 - p, 2) + k;
    var controlY = leftY + 10 * a * (-3 - p);
    var rightY = a * Math.pow(7 - p, 2) + k;
    return 'M ' + px(-3) + ' ' + py(leftY) + ' Q ' + px(2) + ' ' + py(controlY) + ' ' + px(7) + ' ' + py(rightY);
  }
  function curveSvg(id, a, p, k, color) {
    return '<path id="' + id + '" d="' + curveD(a, p, k) + '" fill="none" stroke="' + color
      + '" stroke-width="3.5" clip-path="url(#paraClip)"/>';
  }
  function straightSvg() {
    return '<line x1="' + px(-3) + '" y1="' + py(valG(-3)) + '" x2="' + px(7) + '" y2="' + py(valG(7))
      + '" stroke="' + LINE_COLOR + '" stroke-width="3" stroke-dasharray="8 4" clip-path="url(#paraClip)"/>';
  }
  function dotSvg(id, x, y, color) {
    return '<circle id="' + id + '" cx="' + px(x) + '" cy="' + py(y) + '" r="6" fill="' + color
      + '" stroke="#fff" stroke-width="2" clip-path="url(#paraClip)"/>';
  }
  function handleSvg(id, label, lo, hi) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + lo
      + '" aria-valuemax="' + hi + '" aria-valuenow="0" style="cursor:grab;outline-color:' + PAL.main + '">'
      + '<circle r="29" fill="transparent"/><circle r="9" fill="' + PAL.warm + '" stroke="' + PAL.ink + '" stroke-width="2"/></g>';
  }
  function setDot(ctx, id, x, y) {
    ctx.el(id).setAttribute('cx', px(x));
    ctx.el(id).setAttribute('cy', py(y));
  }
  function stepperHtml(key, label, value) {
    return '<div class="unit" dir="ltr"><button type="button" data-adjust="' + key + '" data-d="-1" aria-label="הקטן את ' + label + '">−</button>'
      + '<span class="var math" data-read="' + key + '">' + key + ' = ' + num(value) + '</span>'
      + '<button type="button" data-adjust="' + key + '" data-d="1" aria-label="הגדל את ' + label + '">+</button></div>';
  }
  function readCell(label, key) {
    return '<div><b>' + label + '</b><span data-value="' + key + '" class="math" dir="ltr"></span></div>';
  }
  function finishScene(ctx) { ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }

  function vertexScene(ctx) {
    var p = 0, k = 0, a = 1, achieved = false;
    var box = ctx.extra('<div class="stepper">' + stepperHtml('p', 'המיקום האופקי', p) + stepperHtml('k', 'הגובה', k) + '</div>'
      + '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr);margin-top:10px">'
      + readCell('קודקוד', 'vertex') + readCell('ציר סימטריה', 'axis') + readCell('מקדם', 'a') + '</div>');
    box.style.width = '100%';
    ctx.draw(baseGrid() + curveSvg('liveCurve', a, p, k, PAL.main)
      + '<line id="symAxis" x1="136" y1="30" x2="136" y2="338" stroke="' + PAL.good + '" stroke-width="2" stroke-dasharray="5 5"/>'
      + '<circle cx="' + px(2) + '" cy="' + py(-4) + '" r="13" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '" stroke-width="2" stroke-dasharray="4 3"/>'
      + '<text x="' + px(2) + '" y="' + (py(-4) - 20) + '" direction="rtl" text-anchor="middle" font-family="Heebo, sans-serif" font-size="13" fill="' + PAL.good + '">יעד</text>'
      + handleSvg('vertexHandle', 'קודקוד הפרבולה; חצים ימינה ושמאלה מזיזים אופקית, למעלה ולמטה משנים גובה', -2, 6));
    var handle = ctx.el('vertexHandle');
    var aButtons = [];
    function renderVertex(action) {
      ctx.el('liveCurve').setAttribute('d', curveD(a, p, k));
      ctx.el('symAxis').setAttribute('x1', px(p)); ctx.el('symAxis').setAttribute('x2', px(p));
      handle.setAttribute('transform', 'translate(' + px(p) + ' ' + py(k) + ')');
      handle.setAttribute('aria-valuenow', p);
      handle.setAttribute('aria-valuetext', 'קודקוד ' + m(pair(p, k)) + ', מקדם ' + m(num(a)));
      box.querySelector('[data-read="p"]').textContent = 'p = ' + num(p);
      box.querySelector('[data-read="k"]').textContent = 'k = ' + num(k);
      box.querySelector('[data-value="vertex"]').textContent = pair(p, k);
      box.querySelector('[data-value="axis"]').textContent = 'x = ' + num(p);
      box.querySelector('[data-value="a"]').textContent = num(a);
      aButtons.forEach(function (button, index) { button.setAttribute('aria-pressed', String([1, -1, 2][index] === a)); });
      box.querySelectorAll('[data-adjust]').forEach(function (button) {
        var key = button.getAttribute('data-adjust'), d = Number(button.getAttribute('data-d'));
        button.disabled = key === 'p' ? p + d < -2 || p + d > 6 : k + d < -4 || k + d > 5;
      });
      ctx.caption(m(vertexEq(a, p, k)));
      if (p === 2 && k === -4 && a === 1) {
        ctx.note('בדיוק: הקודקוד ' + m('(2, −4)') + ' וציר הסימטריה ' + m('x = 2') + '.', 'good');
        if (action && !achieved) { achieved = true; finishScene(ctx); }
      } else if (p < 0) {
        ctx.note('הזזת שמאלה. ' + m('(x − 2)²') + ' מזיז ימינה, לא שמאלה: הסוגריים מתאפסים ב־' + m('x = 2') + '.');
      } else if (a !== 1) {
        ctx.note(a === -1 ? 'מקדם שלילי פותח את הפרבולה כלפי מטה. ליעד צריך ' + m('a = 1') + '.'
          : 'המקדם ' + m('2') + ' נותן פרבולה צרה יותר. ליעד צריך ' + m('a = 1') + '.');
      } else if (k > 0) {
        ctx.note('הזזת למעלה. היעד נמוך מציר ' + m('x') + ': צריך גובה ' + m('k = −4') + '.');
      } else {
        ctx.note('הזז את הקודקוד שתי יחידות ימינה וארבע למטה מן ההתחלה. עכשיו הוא ' + m(pair(p, k)) + '.');
      }
    }
    function moveVertex(dp, dk) {
      p = clamp(p + dp, -2, 6); k = clamp(k + dk, -4, 5);
      ctx.sfx('tick'); renderVertex(true);
    }
    box.querySelectorAll('[data-adjust]').forEach(function (button) {
      button.addEventListener('click', function () {
        var d = Number(button.getAttribute('data-d'));
        moveVertex(button.getAttribute('data-adjust') === 'p' ? d : 0, button.getAttribute('data-adjust') === 'k' ? d : 0);
      });
    });
    [1, -1, 2].forEach(function (coefficient) {
      aButtons.push(ctx.button(m('a = ' + num(coefficient)), function () { a = coefficient; renderVertex(true); }, { ghost: true, id: 'a' + (coefficient < 0 ? 'Minus' : coefficient) }));
    });
    handle.addEventListener('keydown', function (event) {
      var delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
      if (!delta) return;
      event.preventDefault(); moveVertex(delta[0], delta[1]);
    });
    ctx.drag(handle, { move: function (x, y) {
      p = clamp(Math.round((x - OX) / U), -2, 6); k = clamp(Math.round((OY - y) / U), -4, 5); renderVertex(true);
    } });
    renderVertex(false);
  }

  function zerosScene(ctx) {
    var x = 2, zeros = [], form = 0;
    var forms = ['f(x) = (x − 2)² − 4', 'f(x) = x² − 4x', 'f(x) = x(x − 4)'];
    var formButtons = [];
    var box = ctx.extra('<div class="stepper">' + stepperHtml('x', 'ערך איקס', x) + '</div>'
      + '<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr);margin-top:10px">'
      + readCell('ערך הפונקציה', 'f') + readCell('אפסים שסימנת', 'zeros') + '</div>');
    box.style.width = '100%';
    ctx.draw(baseGrid() + curveSvg('fixedCurve', 1, 2, -4, PAL.main) + '<g id="zeroMarks"></g>'
      + dotSvg('sampleF', x, valF(x), PAL.main)
      + handleSvg('zeroHandle', 'סמן על ציר איקס; חצים ימינה ושמאלה משנים את ערך איקס', -2, 6));
    var handle = ctx.el('zeroHandle');
    function renderZeros() {
      handle.setAttribute('transform', 'translate(' + px(x) + ' ' + OY + ')');
      handle.setAttribute('aria-valuenow', x);
      handle.setAttribute('aria-valuetext', m('x = ' + num(x) + ', f(x) = ' + num(valF(x))));
      setDot(ctx, 'sampleF', x, valF(x));
      box.querySelector('[data-read="x"]').textContent = 'x = ' + num(x);
      box.querySelector('[data-value="f"]').textContent = 'f(' + num(x) + ') = ' + num(valF(x));
      box.querySelector('[data-value="zeros"]').textContent = zeros.length ? zeros.slice().sort(function (aa, bb) { return aa - bb; }).map(num).join(', ') : '∅';
      formButtons.forEach(function (button, index) { button.setAttribute('aria-pressed', String(form === index)); });
      box.querySelectorAll('[data-adjust]').forEach(function (button) { button.disabled = x + Number(button.getAttribute('data-d')) < -2 || x + Number(button.getAttribute('data-d')) > 6; });
      ctx.caption(m(forms[form]));
    }
    function shiftZeros(delta) {
      x = clamp(x + delta, -2, 6); renderZeros();
      ctx.note('ב־' + m('x = ' + num(x)) + ' מתקבל ' + m('f(x) = ' + num(valF(x))) + '. אפס מתקבל רק כשהגובה הוא אפס.');
    }
    box.querySelectorAll('[data-adjust]').forEach(function (button) {
      button.addEventListener('click', function () { shiftZeros(Number(button.getAttribute('data-d'))); });
    });
    ctx.button('סמן כאפס', function () {
      if (valF(x) !== 0) {
        ctx.sfx('error');
        ctx.note(x === 2 ? 'זה הקודקוד, לא אפס: ' + m('f(2) = −4') + '. חפש נקודה בגובה ' + m('0') + '.'
          : 'זה לא אפס: ' + m('f(' + num(x) + ') = ' + num(valF(x))) + ', ולא ' + m('0') + '.');
        return;
      }
      if (zeros.indexOf(x) >= 0) { ctx.note('כבר סימנת את האפס הזה. חפש את האפס השני.'); return; }
      zeros.push(x);
      ctx.el('zeroMarks').insertAdjacentHTML('beforeend', dotSvg('zero' + x, x, 0, PAL.good));
      renderZeros();
      if (zeros.length === 2) {
        ctx.note('מצאת את שני האפסים: ' + m('0') + ' ו־' + m('4') + '. החלף הצגה: זה תמיד אותו גרף.', 'good');
        finishScene(ctx);
      } else { ctx.note('נכון: ' + m('f(' + num(x) + ') = 0') + '. נשאר עוד אפס אחד.', 'good'); }
    }, { id: 'markZero', target: 'markZero' });
    ['קודקודית', 'כללית', 'מכפלה'].forEach(function (label, index) {
      formButtons.push(ctx.button(label, function () {
        form = index; renderZeros();
        ctx.note('ההצגה השתנתה, אבל הגרף לא השתנה. כל ההצגות שקולות: ' + m('(x − 2)² − 4 = x² − 4x = x(x − 4)') + '.');
      }, { ghost: true, id: 'form' + index }));
    });
    handle.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); shiftZeros(event.key === 'ArrowLeft' ? -1 : 1);
    });
    ctx.drag(handle, { move: function (pointerX) { x = clamp(Math.round((pointerX - OX) / U), -2, 6); renderZeros(); } });
    renderZeros();
    ctx.note('מצא שתי נקודות שבהן ' + m('f(x) = 0') + '. הכפתור מסמן רק אפס אמיתי.');
  }

  function intersectionScene(ctx) {
    var x = 0, intersections = [];
    var box = ctx.extra('<div class="stepper">' + stepperHtml('x', 'ערך איקס', x) + '</div>'
      + '<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr);margin-top:10px">'
      + readCell('פרבולה — קו מלא', 'f') + readCell('ישר — קו מקווקו', 'g') + '</div>'
      + '<div data-found style="text-align:center;font-size:14px;margin-top:8px" role="status">טרם סומנו חיתוכים</div>');
    box.style.width = '100%';
    ctx.draw(baseGrid() + curveSvg('intersectionCurve', 1, 2, -4, PAL.main) + straightSvg()
      + '<line id="probeLine" x1="136" y1="30" x2="136" y2="338" stroke="' + PAL.ink + '" stroke-width="1.5" stroke-dasharray="3 4"/>'
      + '<g id="intersectionMarks"></g>' + dotSvg('probeF', x, valF(x), PAL.main) + dotSvg('probeG', x, valG(x), LINE_COLOR)
      + handleSvg('probeHandle', 'גשש החיתוך; חצים ימינה ושמאלה משנים את ערך איקס', -1, 6));
    var handle = ctx.el('probeHandle');
    function renderProbe() {
      handle.setAttribute('transform', 'translate(' + px(x) + ' ' + OY + ')');
      handle.setAttribute('aria-valuenow', x);
      handle.setAttribute('aria-valuetext', m('x = ' + num(x) + ', f(x) = ' + num(valF(x)) + ', g(x) = ' + num(valG(x))));
      ctx.el('probeLine').setAttribute('x1', px(x)); ctx.el('probeLine').setAttribute('x2', px(x));
      setDot(ctx, 'probeF', x, valF(x)); setDot(ctx, 'probeG', x, valG(x));
      box.querySelector('[data-read="x"]').textContent = 'x = ' + num(x);
      box.querySelector('[data-value="f"]').textContent = 'f(' + num(x) + ') = ' + num(valF(x));
      box.querySelector('[data-value="g"]').textContent = 'g(' + num(x) + ') = ' + num(valG(x));
      box.querySelectorAll('[data-adjust]').forEach(function (button) { button.disabled = x + Number(button.getAttribute('data-d')) < -1 || x + Number(button.getAttribute('data-d')) > 6; });
      if (intersections.length) {
        box.querySelector('[data-found]').textContent = 'חיתוכים שסימנת: ' + intersections.slice().sort(function (aa, bb) { return aa - bb; }).map(function (value) { return m(pair(value, valF(value))); }).join(' ו־');
      }
      ctx.caption(m('f(x) = x² − 4x') + ' ; ' + m('g(x) = x − 4'));
    }
    function shiftProbe(delta) {
      x = clamp(x + delta, -1, 6); renderProbe();
      ctx.note(valF(x) === valG(x) ? 'שני הגבהים שווים כאן. לחץ כדי לסמן את החיתוך.' : 'בדוק את שני הגבהים: בחיתוך הם חייבים להיות שווים.');
    }
    box.querySelectorAll('[data-adjust]').forEach(function (button) {
      button.addEventListener('click', function () { shiftProbe(Number(button.getAttribute('data-d'))); });
    });
    ctx.button('סמן כחיתוך', function () {
      if (valF(x) !== valG(x)) {
        ctx.sfx('error');
        ctx.note(x === 0 ? 'זה אפס של הפרבולה, לא חיתוך עם הישר: ' + m('f(0) = 0') + ' אבל ' + m('g(0) = −4') + '. בחיתוך צריך ' + m('f(x) = g(x)') + '.'
          : 'הגבהים שונים: ' + m('f(' + num(x) + ') = ' + num(valF(x))) + ' אבל ' + m('g(' + num(x) + ') = ' + num(valG(x))) + '. זה לא חיתוך.');
        return;
      }
      if (intersections.indexOf(x) >= 0) { ctx.note('כבר סימנת את החיתוך הזה. חפש את השני.'); return; }
      intersections.push(x);
      ctx.el('intersectionMarks').insertAdjacentHTML('beforeend', dotSvg('cross' + x, x, valF(x), PAL.good));
      renderProbe();
      if (intersections.length === 2) {
        ctx.note('שני חיתוכים: ' + m('(1, −3)') + ' ו־' + m('(4, 0)') + '. אפסי הפרבולה הם ' + m('0') + ' ו־' + m('4') + ' — זו שאלה אחרת.', 'good');
        finishScene(ctx);
      } else { ctx.note('נכון: ' + m('f(' + num(x) + ') = g(' + num(x) + ') = ' + num(valF(x))) + '. חפש עוד חיתוך.', 'good'); }
    }, { id: 'markIntersection', target: 'markIntersection' });
    handle.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); shiftProbe(event.key === 'ArrowLeft' ? -1 : 1);
    });
    ctx.drag(handle, { move: function (pointerX) { x = clamp(Math.round((pointerX - OX) / U), -1, 6); renderProbe(); } });
    renderProbe();
    ctx.note('אפס שואל אם ' + m('f(x) = 0') + '. חיתוך שואל אם ' + m('f(x) = g(x)') + '. מצא שני חיתוכים.');
  }

  function vertexPicture(ctx) { ctx.draw(baseGrid() + curveSvg('quizVertex', 1, -1, -3, PAL.main) + dotSvg('quizV', -1, -3, PAL.warm)); }
  function factorPicture(ctx) {
    ctx.draw('<rect x="24" y="30" width="354" height="174" rx="18" fill="' + PAL.soft + '" stroke="' + PAL.line + '"/>'
      + svgText(201, 68, 'f(x) = (x − 1)(x + 5)', PAL.ink, 22)
      + '<rect x="44" y="92" width="142" height="70" rx="12" fill="#fff" stroke="' + PAL.main + '"/>'
      + '<rect x="216" y="92" width="142" height="70" rx="12" fill="#fff" stroke="' + PAL.main + '"/>'
      + svgText(115, 135, 'x − 1 = 0', PAL.main, 19) + svgText(287, 135, 'x + 5 = 0', PAL.main, 19)
      + '<text x="201" y="188" text-anchor="middle" font-family="Heebo, sans-serif" font-size="14" fill="' + PAL.ink + '">די שגורם אחד יתאפס</text>');
  }
  function crossPicture(ctx) { ctx.draw(baseGrid() + curveSvg('quizCross', 1, 2, -4, PAL.main) + straightSvg()); }
  function negativePicture(ctx) {
    // Between the roots, the shaded area lies strictly below the x axis.
    var area = 'M ' + px(0) + ' ' + OY + ' Q ' + px(2) + ' ' + py(-8) + ' ' + px(4) + ' ' + OY + ' Z';
    ctx.draw(baseGrid() + '<path d="' + area + '" fill="' + PAL.warmSoft + '" clip-path="url(#paraClip)"/>'
      + curveSvg('quizNegative', 1, 2, -4, PAL.main) + dotSvg('rootLeft', 0, 0, PAL.good) + dotSvg('rootRight', 4, 0, PAL.good));
  }

  var steps = [
    {
      mode: 'intro', tA: 'מעבדת הפרבולות',
      sub: 'מזיזים קודקוד, מוצאים אפסים ומשווים בין שני גרפים.',
      tip: 'שלום, אני אליהו. בוא תראה איך נוסחה וגרף מספרים את אותו הסיפור.',
      emoji: '🎢', eq: m('f(x) = a(x − p)² + k'),
      note: 'הקודקוד הוא ' + m('(p, k)') + '. ציר הסימטריה הוא ' + m('x = p') + '. נבדוק אפסים, חיתוכים ושליליות.',
      cue: 'לחץ כדי לפתוח את המעבדה', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מזיזים את הקודקוד',
      sub: 'היעד: קודקוד ' + m('(2, −4)') + ' עם ' + m('a = 1') + '. גרור, לחץ על הכפתורים או השתמש בחצים.',
      tip: 'התחלנו ב־' + m('f(x) = x²') + '. הזז את הקודקוד ימינה ולמטה אל העיגול המקווקו.',
      aspect: [W, H], alt: 'רשת צירים, פרבולה נגררת, קודקוד כתום, יעד ירוק וציר סימטריה מקווקו',
      cue: 'התאם את הקודקוד ואת המקדם ליעד', cueDone: 'הגעת ליעד. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'השתמש בכפתורי המיקום והגובה שמתחת לגרף.' }, setup: vertexScene
    },
    {
      mode: 'quiz', tA: 'מה הקודקוד?', sub: 'נתונה הפונקציה ' + m('f(x) = (x + 1)² − 3') + '.',
      tip: 'חפש היכן הסוגריים מתאפסים. זה המיקום האופקי של הקודקוד.', btn: 'המשך ←',
      aspect: [W, H], alt: 'פרבולה הפתוחה כלפי מעלה עם הקודקוד מסומן בכתום', setup: vertexPicture,
      win: 'נכון. הסימן בתוך הסוגריים הפוך מסימן המיקום האופקי.',
      wrongSay: 'קודם אפס את הסוגריים, ואחר כך קרא את הגובה שמחוץ להם.',
      opts: [
        { t: m('(−1, −3)'), c: true, f: 'נכון: ב־' + m('x = −1') + ' הסוגריים מתאפסים, והגובה הוא ' + m('−3') + '.' },
        { t: m('(1, −3)'), f: 'קראת את הפלוס כמיקום ימינה. אבל ' + m('x + 1 = 0') + ' מתקיים ב־' + m('x = −1') + '.' },
        { t: m('(−1, 3)'), f: 'המיקום האופקי נכון, אבל הפכת את סימן הגובה. מחוץ לסוגריים כתוב ' + m('−3') + '.' },
        { t: m('(−3, −1)'), f: 'החלפת את סדר השיעורים. קודם המיקום האופקי, ורק אחריו הגובה.' }
      ],
      hints: ['בדוק מתי הביטוי שבתוך הסוגריים שווה לאפס.', 'פתור ' + m('x + 1 = 0') + '. הגובה כתוב מחוץ לסוגריים.', 'הסוגריים מתאפסים ב־' + m('−1') + ', והגובה הוא ' + m('−3') + '.']
    },
    {
      mode: 'scene', tA: 'האפסים וההצגות',
      sub: 'בחר ערך של ' + m('x') + ' וסמן את שני האפסים. אחר כך השווה בין שלוש ההצגות.',
      tip: 'אפס הוא מקום שבו הגרף מגיע לציר ' + m('x') + '. הקודקוד לא חייב להיות אפס.',
      aspect: [W, H], alt: 'הפרבולה עם קודקוד שתיים, מינוס ארבע; סמן כתום על ציר איקס ונקודת בדיקה על הגרף',
      cue: 'מצא וסמן שני אפסים שונים', cueDone: 'שני האפסים נמצאו. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'markZero', text: 'שנה את ערך ' + m('x') + ' עד שהפונקציה תתאפס, ואז סמן.' }, setup: zerosScene
    },
    {
      mode: 'quiz', tA: 'מהם האפסים של המכפלה?', sub: 'נתונה הפונקציה ' + m('f(x) = (x − 1)(x + 5)') + '.',
      tip: 'מכפלה מתאפסת אם אחד הגורמים מתאפס. בדוק כל סוגריים בנפרד.', btn: 'המשך ←',
      aspect: [W, 230], alt: 'שני גורמים במכפלה; בכל תיבה משווים גורם אחד לאפס', setup: factorPicture,
      win: 'בדיוק. כל גורם נתן אפס אחד.', wrongSay: 'אל תעתיק רק את המספר שבסוגריים. מצא איזה ערך מאפס אותם.',
      opts: [
        { t: m('1') + ' ו־' + m('−5'), c: true, f: 'נכון: ' + m('x − 1 = 0 ⇒ x = 1') + ' ו־' + m('x + 5 = 0 ⇒ x = −5') + '.' },
        { t: m('−1') + ' ו־' + m('5'), f: 'העתקת את סימני המספרים מתוך הגורמים. כדי לאפס כל גורם צריך את הסימן ההפוך.' },
        { t: m('1') + ' ו־' + m('5'), f: 'הגורם הראשון התאפס, אבל ' + m('x + 5') + ' מתאפס ב־' + m('−5') + ', לא ב־' + m('5') + '.' },
        { t: m('0') + ' ו־' + m('−5'), f: 'אין כאן גורם ' + m('x') + ' לבדו. ב־' + m('x = 0') + ' המכפלה היא ' + m('−5') + ', לא אפס.' }
      ],
      hints: ['אפס כל גורם בנפרד.', 'איזה מספר מאפס את ' + m('x − 1') + '? איזה מספר מאפס את ' + m('x + 5') + '?', 'הגורם הראשון מתאפס ב־' + m('1') + ', והשני במספר שלילי.']
    },
    {
      mode: 'scene', tA: 'ישר חותך פרבולה',
      sub: 'הזז את הגשש וסמן שני חיתוכים. בחיתוך שני הגרפים באותו גובה.',
      tip: 'כאן לא מחפשים רק גובה אפס. מחפשים שוויון בין ערכי שתי הפונקציות.',
      aspect: [W, H], alt: 'פרבולה סגולה בקו מלא וישר חום בקו מקווקו; גשש אנכי מראה את שני הגבהים',
      cue: 'מצא וסמן שני חיתוכים שונים', cueDone: 'שני החיתוכים נמצאו. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'markIntersection', text: 'שנה את ' + m('x') + ' והשווה את שני הגבהים שמתחת לגרף.' }, setup: intersectionScene
    },
    {
      mode: 'quiz', tA: 'איפה הגרפים נפגשים?', sub: m('f(x) = x² − 4x') + ' וגם ' + m('g(x) = x − 4') + '.',
      tip: 'בכל נקודת חיתוך, אותו ערך של ' + m('x') + ' נותן אותו גובה בשני הגרפים.', btn: 'המשך ←',
      aspect: [W, H], alt: 'פרבולה סגולה בקו מלא וישר חום מקווקו החותך אותה פעמיים', setup: crossPicture,
      win: 'נכון. בדקת שוויון בין הפונקציות, לא רק אפסים.', wrongSay: 'אפס של הפרבולה אינו בהכרח חיתוך עם הישר. בדוק את שתי הפונקציות.',
      opts: [
        { t: m('(1, −3)') + ' ו־' + m('(4, 0)'), c: true, f: 'נכון: ' + m('f(1) = g(1) = −3') + ' וגם ' + m('f(4) = g(4) = 0') + '.' },
        { t: m('(0, 0)') + ' ו־' + m('(4, 0)'), f: 'אלה אפסי הפרבולה. אבל ' + m('g(0) = −4') + ', ולכן ' + m('(0, 0)') + ' אינה על הישר.' },
        { t: 'רק ' + m('(4, 0)'), f: 'מצאת חיתוך אחד על הציר, אבל החמצת את החיתוך מתחתיו: גם ' + m('f(1) = g(1)') + '.' },
        { t: m('(−3, 1)') + ' ו־' + m('(0, 4)'), f: 'החלפת בין המיקום האופקי לגובה בכל זוג. שיעורים נכתבים בסדר ' + m('(x, y)') + '.' }
      ],
      hints: ['השווה את ערכי שתי הפונקציות באותו מיקום אופקי.', 'פתור ' + m('x² − 4x = x − 4') + ', כלומר ' + m('(x − 1)(x − 4) = 0') + '.', 'המיקומים האופקיים הם ' + m('1') + ' ו־' + m('4') + '. הצב כדי למצוא את הגבהים.']
    },
    {
      mode: 'quiz', tA: 'איפה הפרבולה שלילית?', sub: 'באיזה תחום מתקיים ' + m('f(x) = x² − 4x < 0') + '?',
      tip: 'שלילית פירושו מתחת לציר ' + m('x') + '. זה לא אותו דבר כמו יורדת.', btn: 'לסיכום ←',
      aspect: [W, H], alt: 'הפרבולה פתוחה כלפי מעלה; השטח שבין הגרף לציר איקס מוצלל בין האפסים', setup: negativePicture,
      win: 'נכון. בין שני האפסים הפרבולה נמצאת מתחת לציר.', wrongSay: 'בדוק איפה הגובה שלילי, לא באיזה כיוון הגרף מתקדם.',
      opts: [
        { t: m('0 < x < 4'), c: true, f: 'נכון. בין האפסים ' + m('0') + ' ו־' + m('4') + ' הגובה שלילי. הקצוות אינם כלולים כי שם הגובה אפס.' },
        { t: m('x < 0') + ' או ' + m('x > 4'), f: 'זה התחום שבו הגרף מעל הציר והפונקציה חיובית, לא שלילית.' },
        { t: m('x < 2'), f: 'זה תחום הירידה. חלק ממנו מעל הציר, ולכן ירידה אינה שליליות.' },
        { t: m('x > 4'), f: 'מימין לאפס השני שני הגורמים חיוביים, ולכן הפונקציה חיובית.' }
      ],
      hints: ['הסתכל על החלק שמתחת לציר האופקי.', 'האפסים מחלקים את הציר לשלושה תחומים. באיזה מהם הגרף מתחת לציר?', 'התחום השלילי נמצא בין ' + m('0') + ' ל־' + m('4') + ', בלי הקצוות.']
    },
    {
      mode: 'finish', tA: 'סיימת את מעבדת הפרבולות', sub: 'קודקוד, אפסים, חיתוכים ותחום שליליות — כל אחד מספר משהו אחר.',
      tip: 'כל הכבוד. אתה יודע להבדיל בין אפס של פונקציה לבין חיתוך של שני גרפים.',
      cue: 'אפשר לשחק שוב או לתרגל קודקוד חדש', btn: 'שחק שוב ↻',
      finalLead: 'אותו גרף בכל הצגה:', formula: m('(x − 2)² − 4 = x(x − 4)')
    }
  ];

  window.NoamGame.boot({
    slug: 'maabadat-haparabolot', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'קודקוד וציר סימטריה', math: '(p, k)' },
      { step: 4, name: 'אפסים של מכפלה', math: 'f(x) = 0' },
      { step: 6, name: 'חיתוך בין גרפים', math: 'f(x) = g(x)' },
      { step: 7, name: 'תחום שליליות', math: 'f(x) < 0' }
    ],
    bonus: {
      label: 'מכונת הקודקודים', closeLabel: 'סגור את המכונה', hint: 'קבל קודקוד חדש וכתוב פונקציה מתאימה.',
      setup: function (box, ctx) {
        var targetP = 0, targetK = 0, guessP = 0, guessK = 0;
        box.innerHTML = '<div class="bTitle">מכונת הקודקודים</div><div class="bSub">התאם את הנוסחה לקודקוד הנתון. המקדם הוא <bdi class="math" dir="ltr">a = 1</bdi>.</div>'
          + '<div class="bChip" data-target dir="ltr"></div><div class="stepper">'
          + stepperHtml('p', 'המיקום האופקי', 0) + stepperHtml('k', 'הגובה', 0) + '</div>'
          + '<div class="bForms" data-form dir="ltr"></div><div class="bOk" data-feedback role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check>בדוק את הנוסחה</button><button type="button" class="bDice" data-roll>קודקוד חדש</button>';
        function renderBonus() {
          box.querySelector('[data-target]').textContent = pair(targetP, targetK);
          box.querySelector('[data-read="p"]').textContent = 'p = ' + num(guessP);
          box.querySelector('[data-read="k"]').textContent = 'k = ' + num(guessK);
          box.querySelector('[data-form]').textContent = vertexEq(1, guessP, guessK);
          box.querySelector('[data-feedback]').hidden = true;
          box.querySelectorAll('[data-adjust]').forEach(function (button) {
            var value = button.getAttribute('data-adjust') === 'p' ? guessP : guessK;
            button.disabled = Math.abs(value + Number(button.getAttribute('data-d'))) > 5;
          });
        }
        function rollBonus() {
          targetP = Math.floor(Math.random() * 7) - 3;
          targetK = Math.floor(Math.random() * 9) - 4;
          if (targetP === 0 && targetK === 0) targetK = -1;
          guessP = 0; guessK = 0; renderBonus();
        }
        box.querySelectorAll('[data-adjust]').forEach(function (button) {
          button.addEventListener('click', function () {
            var d = Number(button.getAttribute('data-d'));
            if (button.getAttribute('data-adjust') === 'p') guessP = clamp(guessP + d, -5, 5); else guessK = clamp(guessK + d, -5, 5);
            renderBonus();
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var ok = guessP === targetP && guessK === targetK;
          var feedback = box.querySelector('[data-feedback]');
          feedback.textContent = ok ? 'נכון. הנוסחה שלך נותנת בדיוק את הקודקוד הנתון.' : 'עוד לא. המספר הראשון הוא המיקום האופקי, והשני הוא הגובה. בסוגריים סימן המיקום מתהפך.';
          feedback.style.color = ok ? PAL.good : PAL.ink;
          feedback.hidden = false; ctx.sfx(ok ? 'correct' : 'error');
        });
        box.querySelector('[data-roll]').addEventListener('click', rollBonus);
        rollBonus();
      }
    }
  });
}());
