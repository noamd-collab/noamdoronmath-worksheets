/** מפת הצירים: קודם x, אחר כך y; קנה המידה משנה את הציור בלבד. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402, H = 374, UNIT = 20, OX = 201, OY = 198;
  var MUTED = '#475569', BAD = '#b91c1c';

  function num(value) { return value < 0 ? '−' + Math.abs(value) : String(value); }
  function pair(x, y) { return '(' + num(x) + ', ' + num(y) + ')'; }
  function posX(intervals) { return OX + UNIT * intervals; }
  function posY(intervals) { return OY - UNIT * intervals; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function mathText(x, y, label, size, colour, anchor, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 14)
      + '" fill="' + (colour || PAL.ink) + '" text-anchor="' + (anchor || 'middle') + '">' + label + '</text>';
  }
  function hebText(x, y, label) {
    return '<text x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif"'
      + ' font-size="14" font-weight="700" fill="' + BAD + '" text-anchor="middle">' + label + '</text>';
  }
  function grid(scale, clipId) {
    var html = '<defs><clipPath id="' + clipId + '"><rect x="41" y="38" width="320" height="320"/></clipPath></defs>'
      + '<rect x="41" y="38" width="320" height="320" fill="#fff" stroke="' + PAL.line + '" stroke-width="1.5"/>';
    for (var tick = -8; tick <= 8; tick++) {
      if (tick !== 0) {
        html += '<line x1="' + posX(tick) + '" y1="38" x2="' + posX(tick) + '" y2="358" stroke="' + PAL.line + '" stroke-width="0.8"/>'
          + '<line x1="41" y1="' + posY(tick) + '" x2="361" y2="' + posY(tick) + '" stroke="' + PAL.line + '" stroke-width="0.8"/>'
          + '<line x1="' + posX(tick) + '" y1="194" x2="' + posX(tick) + '" y2="202" stroke="' + PAL.ink + '"/>'
          + '<line x1="197" y1="' + posY(tick) + '" x2="205" y2="' + posY(tick) + '" stroke="' + PAL.ink + '"/>';
        if (tick % 2 === 0) {
          html += mathText(posX(tick), OY + 19, num(tick * scale), 13, MUTED)
            + mathText(OX - 9, posY(tick) + 4, num(tick * scale), 13, MUTED, 'end');
        }
      }
    }
    html += '<path d="M41 198 H374 M201 358 V25" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<path d="M369 194 L375 198 L369 202 M197 30 L201 24 L205 30" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + mathText(388, 202, 'x', 17) + mathText(216, 24, 'y', 17) + mathText(189, 215, '0', 13, MUTED);
    return html;
  }
  function point(intervalX, intervalY, label, colour) {
    return '<circle cx="' + posX(intervalX) + '" cy="' + posY(intervalY) + '" r="7" fill="' + colour + '" stroke="#fff" stroke-width="2.5"/>'
      + mathText(posX(intervalX) + 13, posY(intervalY) - 12, label, 17, colour);
  }
  function route(intervalX, intervalY) {
    return '<polyline points="' + OX + ',' + OY + ' ' + posX(intervalX) + ',' + OY + ' ' + posX(intervalX) + ',' + posY(intervalY)
      + '" fill="none" stroke="' + PAL.dark + '" stroke-width="2.5" stroke-dasharray="5 4"/>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function stepperMarkup(prefix) {
    return '<div class="stepper" dir="ltr" style="align-self:stretch">'
      + ['x', 'y'].map(function (axis) {
        return '<div class="unit" dir="ltr"><bdi class="math var" dir="ltr">' + axis + '</bdi>'
          + '<button type="button" id="' + prefix + axis + 'Minus" data-axis="' + axis + '" data-delta="-1" aria-label="הקטן את שיעור ' + axis + '">−</button>'
          + '<bdi class="var math" dir="ltr" data-value="' + axis + '" style="min-width:34px" aria-live="polite">0</bdi>'
          + '<button type="button" id="' + prefix + axis + 'Plus" data-axis="' + axis + '" data-delta="1" aria-label="הגדל את שיעור ' + axis + '">+</button></div>';
      }).join('') + '</div>';
  }

  function orderedScene(ctx) {
    var coordX = 0, coordY = 0, completed = false;
    ctx.draw(grid(1, 'mapClip') + '<polyline id="mapRoute" fill="none" stroke="' + PAL.dark + '" stroke-width="2.5" stroke-dasharray="5 4"/>'
      + '<style>#mapHandle:focus-visible .handleRing{stroke:' + PAL.dark + ';stroke-width:3}</style>'
      + '<g id="mapHandle" tabindex="0" role="button" aria-label="הנקודה הנגררת; הזז בעזרת מקשי החצים" style="cursor:grab">'
      + '<rect class="handleRing" x="-30" y="-30" width="60" height="60" rx="12" fill="transparent"/>'
      + '<circle r="9" fill="' + PAL.main + '" stroke="#fff" stroke-width="3"/></g>');
    var handle = ctx.el('mapHandle');
    var extraBox = ctx.extra('<div class="sceneStrip"><b>הנקודה שלך</b><bdi class="math" dir="ltr" data-pair style="font-size:21px" aria-live="polite"></bdi></div>'
      + '<div dir="ltr" style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px">'
      + [['Left', '←', 'שמאלה'], ['Right', '→', 'ימינה'], ['Up', '↑', 'למעלה'], ['Down', '↓', 'למטה']].map(function (entry) {
        return '<button type="button" id="move' + entry[0] + '" data-move="' + entry[0] + '" aria-label="' + entry[2]
          + ' ברווח אחד" style="min-height:44px;min-width:44px;width:56px;border:2px solid ' + PAL.main + ';border-radius:12px;background:' + PAL.soft
          + ';color:' + PAL.dark + ';font-size:23px">' + entry[1] + '</button>';
      }).join('') + '</div>');
    ctx.register('moves', extraBox);
    function updatePoint(acted) {
      handle.setAttribute('transform', 'translate(' + posX(coordX) + ' ' + posY(coordY) + ')');
      handle.setAttribute('aria-label', 'הנקודה ' + m(pair(coordX, coordY)) + '; הזז בעזרת מקשי החצים');
      ctx.el('mapRoute').setAttribute('points', OX + ',' + OY + ' ' + posX(coordX) + ',' + OY + ' ' + posX(coordX) + ',' + posY(coordY));
      extraBox.querySelector('[data-pair]').textContent = pair(coordX, coordY);
      ctx.caption('המטרה: ' + m('(3, −2)') + ' · כרגע: ' + m(pair(coordX, coordY)));
      if (coordX === 3 && coordY === -2) {
        ctx.note('בדיוק: ' + m('3') + ' ימינה, ואז ' + m('2') + ' למטה. קודם ' + m('x') + ', אחר כך ' + m('y') + '.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else if (coordX === -2 && coordY === 3) {
        ctx.note('החלפת בין השיעורים: התחלת ב־' + m('−2') + ' במקום ב־' + m('3') + '. בזוג הסדור קודם ' + m('x') + ', אחר כך ' + m('y') + '.');
      } else if (coordX === 3 && coordY === 2) {
        ctx.note('הכיוון האופקי נכון, אבל סימן ' + m('y') + ' הפוך. ' + m('−2') + ' אומר למטה, לא למעלה.');
      } else {
        ctx.note('מהראשית: ' + m('3') + ' רווחים ימינה ואז ' + m('2') + ' רווחים למטה. כל רווח שווה יחידה אחת.');
      }
    }
    function movePoint(key) {
      if (key === 'Left') coordX = clamp(coordX - 1, -8, 8);
      if (key === 'Right') coordX = clamp(coordX + 1, -8, 8);
      if (key === 'Up') coordY = clamp(coordY + 1, -8, 8);
      if (key === 'Down') coordY = clamp(coordY - 1, -8, 8);
      ctx.sfx('tick'); updatePoint(true);
    }
    extraBox.querySelectorAll('[data-move]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () { movePoint(buttonNode.getAttribute('data-move')); });
    });
    handle.addEventListener('keydown', function (event) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.key) < 0) return;
      event.preventDefault(); movePoint(event.key.slice(5));
    });
    ctx.drag(handle, {
      move: function (x, y) {
        coordX = clamp(Math.round((x - OX) / UNIT), -8, 8);
        coordY = clamp(Math.round((OY - y) / UNIT), -8, 8);
        updatePoint(false);
      },
      end: function () { updatePoint(true); }
    });
    updatePoint(false);
  }

  function scaleDrawing(scale) {
    var html = grid(scale, 'scaleClip');
    [{ x: 12, y: -6, label: 'A', colour: PAL.main }, { x: -8, y: 10, label: 'B', colour: PAL.good }].forEach(function (sample) {
      var ix = sample.x / scale, iy = sample.y / scale;
      var cx = posX(clamp(ix, -8, 8)), cy = posY(clamp(iy, -8, 8));
      var outside = Math.abs(ix) > 8 || Math.abs(iy) > 8;
      html += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="' + sample.colour + '" stroke="#fff" stroke-width="2" clip-path="url(#scaleClip)"/>';
      html += mathText(clamp(cx + 14, 61, 340), clamp(cy + (sample.label === 'A' && !outside ? 22 : -12), 57, 338), sample.label, 17, sample.colour);
      if (outside && sample.label === 'A') {
        html += '<path d="M350 313 L361 318 L350 323 Z" fill="' + BAD + '"/>' + hebText(305, 344, 'מחוץ למפה');
      } else if (outside) {
        html += '<path d="M36 49 L41 38 L46 49 Z" fill="' + BAD + '"/>' + hebText(104, 77, 'מחוץ למפה');
      }
    });
    return html;
  }
  function scaleScene(ctx) {
    var scaleValue = 1, completed = false, scaleButtons = [];
    ctx.extra('<div class="sceneStrip"><b>השיעורים נשארים קבועים</b><div dir="ltr" style="font-family:Secular One,sans-serif;font-size:18px">'
      + bdi('A(12, −6)') + ' &nbsp; ' + bdi('B(−8, 10)') + '</div></div>');
    function updateScale(acted) {
      ctx.draw(scaleDrawing(scaleValue));
      scaleButtons.forEach(function (buttonNode, index) { buttonNode.setAttribute('aria-pressed', String([1, 2, 5][index] === scaleValue)); });
      ctx.caption(scaleValue === 1 ? 'כל רווח שווה יחידה אחת' : 'כל רווח שווה ' + m(String(scaleValue)) + ' יחידות');
      if (scaleValue === 1) {
        ctx.note('בקנה מידה ' + m('1') + ' יש מקום עד ' + m('8') + ' בכל כיוון. ' + m('x = 12') + ' של ' + m('A') + ' ו־' + m('y = 10') + ' של ' + m('B') + ' מחוץ למפה.');
      } else if (scaleValue === 5) {
        ctx.note('גם ' + m('5') + ' מכניס את שתי הנקודות, אבל הוא לא הקטן ביותר שמתאים. הנקודות קרובות יותר למרכז, וחלק מהשיעורים בין קווי הרשת. נסה קנה מידה קטן יותר.');
      } else {
        ctx.note('נכון: בקנה מידה ' + m('2') + ' יש מקום עד ' + m('16') + '. ' + m('A') + ' נמצאת ' + m('6') + ' רווחים ימינה ו־' + m('3') + ' למטה; ' + m('B') + ' נמצאת ' + m('4') + ' שמאלה ו־' + m('5') + ' למעלה.', 'good');
        if (acted && !completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      }
    }
    [1, 2, 5].forEach(function (choice) {
      var scaleButton = ctx.button(m(String(choice)), function () { scaleValue = choice; ctx.sfx('click'); updateScale(true); }, { id: 'scale' + choice, target: 'scale' + choice, ghost: true });
      scaleButton.setAttribute('aria-label', 'קנה מידה ' + m(String(choice)) + ' יחידות לרווח');
      scaleButtons.push(scaleButton);
    });
    updateScale(false);
  }

  function readScene(ctx) {
    var guessX = 0, guessY = 0, completed = false;
    ctx.draw(grid(2, 'readClip') + route(-3, 2) + point(-3, 2, 'C', PAL.main));
    var readBox = ctx.extra(stepperMarkup('read'));
    ctx.register('readControls', readBox);
    function updateGuess() {
      readBox.querySelector('[data-value="x"]').textContent = num(guessX);
      readBox.querySelector('[data-value="y"]').textContent = num(guessY);
      ctx.caption('הזוג שבחרת: ' + m(pair(guessX, guessY)));
    }
    readBox.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        var delta = Number(buttonNode.getAttribute('data-delta'));
        if (buttonNode.getAttribute('data-axis') === 'x') guessX = clamp(guessX + delta, -16, 16);
        else guessY = clamp(guessY + delta, -16, 16);
        ctx.sfx('tick'); updateGuess(); ctx.note('בחרת ' + m(pair(guessX, guessY)) + '. לחץ על בדוק כשתהיה מוכן.');
      });
    });
    ctx.button('בדוק', function () {
      if (guessX === -6 && guessY === 4) {
        ctx.note('נכון! ' + m('x = −3 · 2 = −6') + ', ואז ' + m('y = 2 · 2 = 4') + '.', 'good');
        if (!completed) { completed = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
      } else {
        ctx.sfx('error');
        if (guessX === -3 && guessY === 2) ctx.note('ספרת רווחים, אבל כל רווח שווה ' + m('2') + ' יחידות. הכפל כל מספר רווחים בקנה המידה.');
        else if (guessX === 4 && guessY === -6) ctx.note('החלפת בין ' + m('x') + ' ל־' + m('y') + '. קודם השיעור האופקי, ורק אחריו האנכי.');
        else if (guessX > 0 || guessY < 0) ctx.note('בדוק את הסימנים: הנקודה שמאלה מהראשית ולכן ' + m('x < 0') + ', ומעליה ולכן ' + m('y > 0') + '.');
        else ctx.note('ספור בנפרד רווחים שמאלה ורווחים למעלה, ואז הכפל כל ספירה ב־' + m('2') + '.');
      }
    }, { id: 'readCheck', target: 'readCheck' });
    updateGuess(); ctx.note('כל רווח שווה ' + m('2') + ' יחידות. קרא קודם את ' + m('x') + ', ואז את ' + m('y') + '.');
  }
  function quizPicture(scale, ix, iy) {
    return function (ctx) {
      ctx.draw(grid(scale, 'quizClip') + route(ix, iy) + point(ix, iy, 'D', PAL.main));
      ctx.caption(scale === 1 ? 'כל רווח שווה יחידה אחת' : 'כל רווח שווה ' + m(String(scale)) + ' יחידות');
    };
  }

  var steps = [
    {
      mode: 'intro', tA: 'מפת הצירים', sub: 'זוג סדור וקנה מידה — כך קוראים מפה מתמטית.',
      tip: 'שלום, אני אליהו. נתחיל בראשית הצירים ונגלה איך זוג מספרים מוביל לנקודה.',
      emoji: '🗺️', eq: m('(x, y)'),
      note: 'קודם ' + m('x') + ': ימינה או שמאלה. אחר כך ' + m('y') + ': למעלה או למטה. קנה המידה אומר כמה יחידות שווה כל רווח.',
      cue: 'מוכן למצוא את הנקודה?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'הזוג הסדור', sub: 'הזז את הנקודה אל ' + m('(3, −2)') + ' בגרירה, בכפתורים או במקשי החצים.',
      tip: 'קודם ימינה או שמאלה, אחר כך למעלה או למטה. כל רווח כאן שווה יחידה אחת.',
      aspect: [W, H], alt: 'מערכת צירים עם שמונה רווחים בכל כיוון, ראשית ונקודה נגררת; קנה מידה יחידה אחת לרווח',
      cue: 'מקם את הנקודה בזוג הסדור המבוקש', cueDone: 'הנקודה במקום. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'moves', text: 'לחץ על החצים כדי להזיז את הנקודה ברווח אחד בכל לחיצה.' }, setup: orderedScene
    },
    {
      mode: 'quiz', tA: 'מהו הזוג הסדור?', sub: 'הנקודה נמצאת שלושה רווחים ימינה ושניים למטה. כל רווח שווה יחידה אחת.',
      tip: 'קרא קודם את השיעור האופקי. לירידה יש סימן מינוס.', btn: 'המשך ←',
      aspect: [W, H], alt: 'נקודה שלושה רווחים ימינה ושני רווחים למטה מהראשית, בקנה מידה יחידה אחת לרווח', setup: quizPicture(1, 3, -2),
      win: 'בדיוק. קודם ימינה, ואז למטה.', wrongSay: 'בדוק גם את הסדר וגם את סימן הגובה.',
      opts: [
        { t: m('(3, −2)'), c: true, f: 'נכון: ' + m('x = 3') + ' כי הולכים ימינה, ו־' + m('y = −2') + ' כי יורדים.' },
        { t: m('(−2, 3)'), f: 'החלפת בין השיעורים. בזוג הסדור קודם ' + m('x') + ' ורק אחריו ' + m('y') + '.' },
        { t: m('(3, 2)'), f: 'הכיוון האופקי נכון, אבל הפכת את סימן ' + m('y') + '. מתחת לראשית הגובה שלילי.' },
        { t: m('(2, −3)'), f: 'החלפת בין מספרי הרווחים: ימינה הולכים שלושה, ולמטה רק שניים.' }
      ],
      hints: ['התחל מהראשית וקרא את התנועה האופקית לפני האנכית.', 'ימינה פירושו חיובי; למטה פירושו שלילי.', 'המספר הראשון הוא ' + m('3') + ', והשני שלילי וגודלו ' + m('2') + '.']
    },
    {
      mode: 'scene', tA: 'קנה מידה', sub: 'יש שמונה רווחים בכל כיוון. בחר את קנה המידה הקטן ביותר שמכניס את שתי הנקודות.',
      tip: 'שנה כמה יחידות שווה רווח אחד. שים לב: השיעורים של הנקודות לא משתנים.',
      aspect: [W, H], alt: 'מפה עם שמונה רווחים בכל כיוון, הנקודות איי ובי ובחירה של יחידה אחת, שתיים או חמש לרווח',
      cue: 'בחר את קנה המידה הקטן ביותר שמתאים', cueDone: 'בחרת את קנה המידה המתאים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scale2', text: 'נסה קנה מידה אחר ובדוק אם שתי הנקודות נכנסות למפה.' }, setup: scaleScene
    },
    {
      mode: 'quiz', tA: 'איזה קנה מידה מתאים?',
      sub: 'שמונה רווחים בכל כיוון. צריך להכניס את ' + m('A(12, −6)') + ' ואת ' + m('B(−8, 10)') + '. בחר את הקטן ביותר מבין האפשרויות.',
      tip: 'בדוק כמה יחידות נכנסות בשמונה רווחים, ואז בחר את האפשרות הקטנה ביותר שמספיקה.', btn: 'המשך ←',
      win: 'נכון. שתי יחידות לרווח מספיקות, ואחת אינה מספיקה.', wrongSay: 'לא מספיק שהנקודות נכנסות. חפש את קנה המידה הקטן ביותר שמתאים.',
      opts: [
        { t: m('2'), c: true, f: 'בשמונה רווחים נכנסות ' + m('8 · 2 = 16') + ' יחידות לכל כיוון. כל השיעורים מתאימים, וקנה מידה ' + m('1') + ' לא מספיק.' },
        { t: m('1'), f: 'בשמונה רווחים נכנסות רק ' + m('8') + ' יחידות. שיעור ' + m('12') + ' דורש שנים עשר רווחים, ולכן לא נכנס.' },
        { t: m('5'), f: 'הנקודות נכנסות עד ' + m('40') + ' יחידות, אבל בחרת קנה מידה גדול מהנחוץ. ' + m('2') + ' כבר מספיק.' },
        { t: m('10'), f: 'גם עד ' + m('80') + ' יחידות אפשר להכניס אותן, אבל זה לא קנה המידה הקטן ביותר שמתאים.' }
      ],
      hints: ['הסתכל על השיעור שהכי רחוק מאפס.', 'השיעור הגדול ביותר בערך מוחלט הוא ' + m('12') + '. השווה אותו לשמונה כפול קנה המידה.', m('8 · 1 = 8') + ' לא מספיק; ' + m('8 · 2 = 16') + ' כבר מספיק.']
    },
    {
      mode: 'scene', tA: 'קוראים בקנה מידה', sub: 'כל רווח שווה ' + m('2') + ' יחידות. קרא את שיעורי הנקודה ' + m('C') + ' ובדוק.',
      tip: 'אל תעצור בספירת הרווחים. הכפל את מספר הרווחים בקנה המידה.',
      aspect: [W, H], alt: 'נקודה סי שלושה רווחים שמאלה ושני רווחים למעלה מהראשית, בקנה מידה שתי יחידות לרווח',
      cue: 'בחר את שני השיעורים ולחץ על בדוק', cueDone: 'קראת את השיעורים נכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'readControls', text: 'בחר את השיעור האופקי ואת השיעור האנכי בכפתורי הפלוס והמינוס.' }, setup: readScene
    },
    {
      mode: 'quiz', tA: 'מה השיעורים בקנה מידה חדש?', sub: 'כל רווח שווה ' + m('5') + ' יחידות. הנקודה שני רווחים ימינה ושלושה למטה.',
      tip: 'ספור רווחים, הכפל בחמש, ושמור על הסימן של כל כיוון.', btn: 'המשך ←',
      aspect: [W, H], alt: 'נקודה שני רווחים ימינה ושלושה רווחים למטה מהראשית, בקנה מידה חמש יחידות לרווח', setup: quizPicture(5, 2, -3),
      win: 'מצוין. קנה המידה הופך רווחים ליחידות.', wrongSay: 'בדוק את הכפל בקנה המידה, את הסדר ואת הסימנים.',
      opts: [
        { t: m('(10, −15)'), c: true, f: 'נכון: ' + m('x = 2 · 5 = 10') + ', ו־' + m('y = −3 · 5 = −15') + '.' },
        { t: m('(2, −3)'), f: 'ספרת רק רווחים ושכחת שכל רווח שווה ' + m('5') + ' יחידות.' },
        { t: m('(−15, 10)'), f: 'חישבת את הגדלים נכון, אבל החלפת בין ' + m('x') + ' ל־' + m('y') + '.' },
        { t: m('(10, 15)'), f: 'הגדלים נכונים, אבל סימן הגובה הפוך. הנקודה למטה ולכן ' + m('y') + ' שלילי.' }
      ],
      hints: ['מצא בנפרד את הכיוון האופקי ואת הכיוון האנכי.', 'הכפל את מספר הרווחים בכל כיוון ב־' + m('5') + '.', 'שני רווחים ימינה הם ' + m('10') + ' יחידות; שלושה למטה הם ' + m('15') + ' יחידות עם מינוס.']
    },
    {
      mode: 'quiz', tA: 'איפה נמצאת הנקודה?', sub: 'מצא את המקום של ' + m('(0, −4)') + '.',
      tip: 'כשאין תנועה ימינה או שמאלה, נשארים על הציר האנכי.', btn: 'לסיכום ←',
      win: 'נכון. אפס בתנועה האופקית משאיר אותך על הציר האנכי.', wrongSay: 'בדוק איזה שיעור אפס, ומה אומר הסימן של השיעור השני.',
      opts: [
        { t: 'על ציר ' + m('y') + ', מתחת לראשית', c: true, f: m('x = 0') + ' משאיר אותך על ציר ' + m('y') + ', ו־' + m('y = −4') + ' נמצא מתחת לראשית.' },
        { t: 'על ציר ' + m('x') + ', משמאל לראשית', f: 'בלבלת בין הצירים. על ציר ' + m('x') + ' השיעור ' + m('y') + ' חייב להיות אפס, וכאן הוא ' + m('−4') + '.' },
        { t: 'על ציר ' + m('y') + ', מעל הראשית', f: 'הציר נכון, אבל הכיוון הפוך. שיעור ' + m('y') + ' שלילי נמצא מתחת לראשית.' },
        { t: 'בראשית הצירים', f: 'בראשית שני השיעורים אפס: ' + m('(0, 0)') + '. כאן רק השיעור הראשון אפס.' }
      ],
      hints: ['שיעור אחד הוא אפס. בדוק איזו תנועה אינה מתבצעת.', m('x = 0') + ' אומר שאין תנועה אופקית, ולכן נשארים על ציר ' + m('y') + '.', 'השיעור השני שלילי, ולכן יורדים מהראשית.']
    },
    {
      mode: 'finish', tA: 'סיימת את מפת הצירים', sub: 'קנה המידה משנה את הציור, לא את השיעורים של הנקודה.',
      tip: 'כל הכבוד. עכשיו אתה יודע למצוא נקודה וגם לבחור מפה שמתאימה לה.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:', formula: m('(x, y)') + ' — קודם ימינה או שמאלה, ואז למעלה או למטה.'
    }
  ];

  window.NoamGame.boot({
    slug: 'mapat-hatsirim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'סדר השיעורים והסימנים', math: '(x, y)' },
      { step: 4, name: 'בחירת קנה מידה', math: '8 · 2 ≥ 12' },
      { step: 6, name: 'קריאת נקודה בקנה מידה', math: '(10, −15)' },
      { step: 7, name: 'נקודה על ציר', math: 'x = 0' }
    ],
    bonus: {
      label: 'מכונת הנקודות', closeLabel: 'סגור את המכונה', hint: 'קבל נקודה וקנה מידה חדשים, וקרא את שני השיעורים.',
      setup: function (box, ctx) {
        var sampleScale = 1, sampleX = 0, sampleY = 0, bonusX = 0, bonusY = 0;
        box.innerHTML = '<div class="bTitle">מכונת הנקודות</div><div class="bSub" data-bonus-scale></div>'
          + '<svg data-bonus-map viewBox="0 0 402 398" dir="ltr" role="img" aria-label="נקודה אקראית על מערכת צירים" style="width:100%;height:auto;display:block"></svg>'
          + '<div class="bChip" data-bonus-pair dir="ltr"></div>' + stepperMarkup('bonus')
          + '<div class="bForms" data-bonus-forms hidden></div><div class="bOk" data-bonus-note hidden aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-bonus-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll style="min-height:44px;min-width:44px">נקודה חדשה ↻</button>';
        function updateBonus() {
          box.querySelector('[data-value="x"]').textContent = num(bonusX);
          box.querySelector('[data-value="y"]').textContent = num(bonusY);
          box.querySelector('[data-bonus-pair]').textContent = pair(bonusX, bonusY);
          box.querySelector('[data-bonus-note]').hidden = true;
          box.querySelector('[data-bonus-forms]').hidden = true;
        }
        function randomPoint() {
          sampleScale = [1, 2, 5][Math.floor(Math.random() * 3)];
          sampleX = Math.floor(Math.random() * 11) - 5;
          sampleY = Math.floor(Math.random() * 11) - 5;
          if (sampleX === 0 && sampleY === 0) sampleX = 1;
          bonusX = 0; bonusY = 0;
          box.querySelector('[data-bonus-map]').innerHTML = grid(sampleScale, 'bonusClip') + route(sampleX, sampleY) + point(sampleX, sampleY, 'E', PAL.main);
          box.querySelector('[data-bonus-scale]').innerHTML = (sampleScale === 1 ? 'כל רווח שווה יחידה אחת.' : 'כל רווח שווה ' + bdi(String(sampleScale)) + ' יחידות.') + ' מהו הזוג הסדור?';
          updateBonus();
        }
        box.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () {
            var delta = Number(buttonNode.getAttribute('data-delta'));
            if (buttonNode.getAttribute('data-axis') === 'x') bonusX = clamp(bonusX + delta, -40, 40);
            else bonusY = clamp(bonusY + delta, -40, 40);
            ctx.sfx('click'); updateBonus();
          });
        });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var correct = bonusX === sampleX * sampleScale && bonusY === sampleY * sampleScale;
          var statusNode = box.querySelector('[data-bonus-note]');
          statusNode.hidden = false;
          statusNode.textContent = correct ? 'נכון! קראת את שני השיעורים.' : 'נסה שוב: הכפל כל מספר רווחים בקנה המידה, ושמור על הסדר והסימנים.';
          statusNode.style.color = correct ? PAL.good : BAD;
          ctx.sfx(correct ? 'correct' : 'error');
          if (correct) {
            var formsNode = box.querySelector('[data-bonus-forms]');
            formsNode.hidden = false;
            formsNode.innerHTML = bdi('x = ' + num(sampleX) + ' · ' + sampleScale + ' = ' + num(sampleX * sampleScale))
              + bdi('y = ' + num(sampleY) + ' · ' + sampleScale + ' = ' + num(sampleY * sampleScale));
          }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { ctx.sfx('click'); randomPoint(); });
        randomPoint();
      }
    }
  });
}());
