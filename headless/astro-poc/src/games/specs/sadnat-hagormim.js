/** סדנת הגורמים — גורם משותף, טרינום, הפרש ריבועים ותחום הגדרה. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402;
  var BAD = '#a12d24';

  function svgMath(x, y, text, size, color) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 22) + '" fill="' + (color || PAL.ink) + '">' + text + '</text>';
  }
  function svgHebrew(x, y, text, size, color) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 17) + '" fill="' + (color || PAL.ink) + '">' + text + '</text>';
  }
  function cardSvg(x, y, width, height, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="12" fill="' + fill + '" stroke="' + PAL.line + '" stroke-width="2"/>';
  }
  function fractionSvg(top, bottom, equals) {
    return svgMath(181, 84, top, 22)
      + '<line x1="28" y1="99" x2="334" y2="99" stroke="' + PAL.ink + '" stroke-width="2.5"/>'
      + svgMath(181, 130, bottom, 22)
      + (equals ? svgMath(369, 109, '= 4', 22) : '');
  }
  function htmlMath(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }

  function commonFactorScene(ctx) {
    var chosen = false;
    var opened = false;
    var factorButtons = [];
    function renderFactor() {
      var terms = chosen ? ['x²', '5x', '6'] : ['2x²', '10x', '12'];
      var out = svgHebrew(201, 30, chosen ? 'כל איבר חולק בגורם המשותף' : 'מהו הגורם המשותף הגדול ביותר?');
      terms.forEach(function (term, i) {
        out += cardSvg(31 + i * 118, 54, 104, 68, chosen ? PAL.goodSoft : PAL.soft)
          + svgMath(83 + i * 118, 99, term, 26);
      });
      out += svgMath(201, 161, chosen ? '2(x² + 5x + 6)' : '2x² + 10x + 12', 25, PAL.main);
      out += svgHebrew(201, 195, opened ? 'פתחנו בחזרה וקיבלנו את אותו ביטוי' : (chosen ? 'הגורם בחוץ מכפיל את כל הסוגריים' : 'הגורם צריך לחלק את כל שלושת האיברים'), 16);
      if (opened) out += svgMath(201, 231, '2·x² + 2·5x + 2·6', 22);
      ctx.draw(out);
      ctx.caption(chosen ? m('2x² + 10x + 12 = 2(x² + 5x + 6)') : m('2x² + 10x + 12'));
    }
    function chooseFactor(value) {
      ctx.sfx('click');
      if (value === '2') {
        chosen = true;
        factorButtons.forEach(function (b) { b.disabled = true; });
        openButton.disabled = false;
        renderFactor();
        ctx.note('בדיוק. ' + m('2') + ' מחלק את כל האיברים, והוא הגדול ביותר. פתח בחזרה כדי לבדוק.', 'good');
        ctx.sfx('correct');
        ctx.solved();
      } else if (value === 'x' || value === '2x') {
        ctx.note('באיבר ' + m('12') + ' אין גורם ' + m('x') + '. לכן ' + m(value) + ' אינו גורם משותף לכל האיברים.');
      } else if (value === '4') {
        ctx.note(m('10') + ' אינו מתחלק ב־' + m('4') + ' למספר שלם. גם המקדם ' + m('2') + ' לא מתחלק בו למספר שלם.');
      } else {
        ctx.note('הגורם ' + m('1') + ' אכן משותף, אבל אינו משנה את הביטוי. חפש את הגורם המשותף הגדול ביותר.');
      }
    }
    ['1', '2', '4', 'x', '2x'].forEach(function (value, i) {
      factorButtons.push(ctx.button(m(value), function () { chooseFactor(value); }, { id: 'factor-' + i, ghost: true, target: 'factors' }));
    });
    var openButton = ctx.button('פתח בחזרה', function () {
      if (!chosen) return;
      opened = true;
      renderFactor();
      ctx.note(m('2·x² = 2x²') + ', ' + m('2·5x = 10x') + ', ' + m('2·6 = 12') + '. הפירוק והביטוי המקורי שקולים.', 'good');
      openButton.disabled = true;
    }, { id: 'factor-open' });
    openButton.disabled = true;
    renderFactor();
    ctx.note('בחר גורם שמחלק את כל האיברים ומשאיר מקדמים שלמים בתוך הסוגריים.');
  }

  function rectangleScene(ctx) {
    var part = 1;
    var closed = false;
    var unit = 22;
    var extraBox = ctx.extra('<div class="stepper" dir="ltr"><div class="unit">'
      + '<button type="button" id="split-minus" aria-label="הקטן את החלק הראשון">−</button>'
      + '<span class="var">p</span><span class="var" id="split-value">1</span>'
      + '<button type="button" id="split-plus" aria-label="הגדל את החלק הראשון">+</button></div></div>'
      + '<div class="sceneStrip" style="margin-top:10px;gap:8px">'
      + '<div><b>סכום החלקים</b><span class="math" dir="ltr" id="split-sum"></span></div>'
      + '<div><b>יחידות שנדרשות למלבן</b><span class="math" dir="ltr" id="split-product"></span></div></div>');
    var less = extraBox.querySelector('#split-minus');
    var more = extraBox.querySelector('#split-plus');
    ctx.register('split', extraBox);
    function renderRectangle() {
      var otherPart = 5 - part;
      var required = part * otherPart;
      var leftOver = 6 - required;
      var out = svgMath(187, 29, 'x² + 5x + 6', 24, PAL.main)
        + svgMath(165, 56, 'x + ' + otherPart, 19)
        + cardSvg(61, 69, 90, 90, PAL.soft) + svgMath(106, 121, 'x²', 26);
      var i;
      for (i = 0; i < otherPart; i++) {
        out += '<rect x="' + (151 + i * unit) + '" y="69" width="22" height="90" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '"/>'
          + svgMath(162 + i * unit, 121, 'x', 17);
      }
      for (i = 0; i < part; i++) {
        out += '<rect x="61" y="' + (159 + i * unit) + '" width="90" height="22" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '"/>'
          + svgMath(106, 175 + i * unit, 'x', 17);
      }
      for (var row = 0; row < part; row++) {
        for (var col = 0; col < otherPart; col++) {
          out += '<rect x="' + (151 + col * unit) + '" y="' + (159 + row * unit) + '" width="22" height="22" fill="' + PAL.soft + '" stroke="' + PAL.main + '"/>'
            + svgMath(162 + col * unit, 175 + row * unit, '1', 14);
        }
      }
      out += '<rect x="61" y="69" width="' + (90 + otherPart * unit) + '" height="' + (90 + part * unit) + '" fill="none" stroke="' + (leftOver === 0 ? PAL.good : PAL.ink) + '" stroke-width="2.5"/>'
        + svgMath(27, 143, 'x', 19) + svgMath(27, 167, '+ ' + part, 17)
        + svgHebrew(334, 88, 'נותרו בצד', 15);
      for (i = 0; i < leftOver; i++) {
        out += '<rect x="' + (308 + (i % 2) * unit) + '" y="' + (102 + Math.floor(i / 2) * unit) + '" width="22" height="22" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '"/>'
          + svgMath(319 + (i % 2) * unit, 118 + Math.floor(i / 2) * unit, '1', 14);
      }
      out += svgMath(334, 199, String(leftOver), 25, leftOver ? BAD : PAL.good);
      ctx.draw(out);
      extraBox.querySelector('#split-value').textContent = String(part);
      extraBox.querySelector('#split-sum').textContent = part + ' + ' + otherPart + ' = 5';
      extraBox.querySelector('#split-product').textContent = part + ' · ' + otherPart + ' = ' + required + (required === 6 ? '' : ' ≠ 6');
      less.disabled = part === 0 || closed;
      more.disabled = part === 5 || closed;
      if (required === 6) {
        ctx.caption(m('x² + 5x + 6 = (x + ' + part + ')(x + ' + otherPart + ')'));
        ctx.note('הסכום ' + m('5') + ' וגם המכפלה ' + m('6') + ' מתאימים. כל היחידות נכנסו למלבן.', 'good');
      } else {
        ctx.caption(m('p + q = 5') + ' וגם צריך ' + m('p·q = 6'));
        ctx.note('הסכום נכון, אבל המכפלה ' + m(String(required)) + ' אינה ' + m('6') + '. נותרו ' + m(String(leftOver)) + ' יחידות מחוץ למלבן; שנה את החלוקה.');
      }
    }
    function changeSplit(delta) {
      if (closed) return;
      part = Math.max(0, Math.min(5, part + delta));
      if (part * (5 - part) === 6) {
        closed = true;
        ctx.sfx('correct');
        ctx.solved();
      } else ctx.sfx('tick');
      renderRectangle();
    }
    less.addEventListener('click', function () { changeSplit(-1); });
    more.addEventListener('click', function () { changeSplit(1); });
    ctx.button('פתח את המכפלה בחזרה', function () {
      if (!closed) { ctx.note('עדיין נותרו יחידות בחוץ. קודם בנה מלבן שמשתמש בכל ' + m('6') + ' היחידות.'); return; }
      ctx.caption(m('x² + ' + part + 'x + ' + (5 - part) + 'x + 6 = x² + 5x + 6'));
      ctx.note('פתיחת המכפלה מחזירה את הטרינום המקורי: שני פסי השטח יחד הם ' + m('5x') + '.', 'good');
    }, { id: 'rectangle-open', ghost: true });
    renderRectangle();
  }

  function rationalScene(ctx) {
    var phase = 0;
    var excluded = [false, false, false, false];
    var domainValues = ['3', '−3', '−2', '0'];
    var domainButtons = [];
    var solutionButtons = [];
    function renderRational() {
      var top = phase < 2 ? '2x² + 10x + 12' : phase === 2 ? '2(x + 2)(x + 3)' : '2(x + 2)';
      var bottom = phase < 2 ? 'x² − 9' : phase === 2 ? '(x − 3)(x + 3)' : 'x − 3';
      var out = svgHebrew(201, 30, phase === 0 ? 'תחום ההגדרה קודם לפירוק' : phase === 2 ? 'מצמצמים גורמים, לא איברים' : phase >= 4 ? 'כופלים את שני האגפים במכנה' : 'שומרים על תחום ההגדרה');
      out += fractionSvg(top, bottom, true);
      out += phase === 0 ? svgHebrew(201, 175, 'אילו ערכים מאפסים את המכנה?', 17)
        : svgMath(201, 175, 'x ≠ 3,  x ≠ −3', 22, PAL.good);
      if (phase === 2) {
        out += svgMath(201, 215, 'x² − 9 = (x − 3)(x + 3)', 20, PAL.main);
      } else if (phase === 3) {
        out += svgHebrew(201, 215, 'הגורם המשותף צומצם; האיסורים נשארים', 16, PAL.good);
      } else if (phase >= 4) {
        out += svgMath(201, 216, '2x + 4 = 4x − 12', 22, PAL.main)
          + svgMath(201, 253, '16 = 2x', 22, PAL.main);
      }
      ctx.draw(out);
      domainButtons.forEach(function (b, i) { b.hidden = phase !== 0; b.setAttribute('aria-pressed', String(excluded[i])); b.style.background = excluded[i] ? PAL.main : '#ffffff'; b.style.color = excluded[i] ? '#ffffff' : PAL.main; });
      confirmButton.hidden = phase !== 0;
      factorButton.hidden = phase !== 1;
      wrongCancelButton.hidden = phase !== 1;
      cancelButton.hidden = phase !== 2;
      solveButton.hidden = phase !== 3;
      solutionButtons.forEach(function (b) { b.hidden = phase !== 4; });
      if (phase >= 1) ctx.caption(m('x ≠ 3, x ≠ −3'));
    }
    domainValues.forEach(function (value, i) {
      domainButtons.push(ctx.button(m('x = ' + value), function () {
        if (phase !== 0) return;
        excluded[i] = !excluded[i];
        renderRational();
        if (excluded[i] && i === 2) ctx.note('ב־' + m('x = −2') + ' המונה מתאפס, אבל המכנה הוא ' + m('−5') + '. אפס במונה מותר; האיסור נקבע לפי המכנה.');
        else if (excluded[i] && i === 3) ctx.note('ב־' + m('x = 0') + ' המכנה הוא ' + m('−9') + ', לא אפס. לכן אין סיבה לאסור את הערך הזה.');
        else ctx.note('סמן רק את הערכים שמאפסים את המכנה המקורי, ואז אשר.');
      }, { id: 'domain-' + i, ghost: true }));
    });
    var confirmButton = ctx.button('אישור תחום ההגדרה', function () {
      if (!(excluded[0] && excluded[1] && !excluded[2] && !excluded[3])) {
        if (excluded[2] || excluded[3]) ctx.note('סימנת גם ערך שהמכנה שלו אינו אפס. בדוק את המכנה, לא את המונה.');
        else ctx.note('חסר ערך אסור: גם מספר שלילי יכול לקיים ' + m('x² = 9') + '. בחר את שני שורשי המכנה.');
        ctx.sfx('error');
        return;
      }
      phase = 1;
      renderRational();
      ctx.note('נכון. ' + m('3² − 9 = 0') + ' וגם ' + m('(−3)² − 9 = 0') + '. שני הערכים אסורים לאורך כל הפתרון.', 'good');
    }, { id: 'domain-confirm', target: 'rational-action' });
    var factorButton = ctx.button('פרק מונה ומכנה לגורמים', function () {
      phase = 2;
      renderRational();
      ctx.note('המונה משתמש בגורם משותף ובטרינום. המכנה הוא הפרש ריבועים. עכשיו חפש גורם משותף שלם.');
    }, { id: 'rational-factor' });
    var wrongCancelButton = ctx.button('צמצם את ' + m('x²') + ' עם ' + m('x²'), function () {
      ctx.note('אי אפשר לצמצם איברים מתוך סכום. מצמצמים רק גורם שמכפיל את כל המונה ואת כל המכנה; קודם פרק לגורמים.');
      ctx.sfx('error');
    }, { id: 'rational-bad-cancel', ghost: true });
    var cancelButton = ctx.button('צמצם את הגורם ' + m('(x + 3)'), function () {
      phase = 3;
      renderRational();
      ctx.note('צמצמת גורם שלם שאינו אפס בתחום. ' + m('x = −3') + ' עדיין אסור, גם כשהגורם כבר לא כתוב.', 'good');
    }, { id: 'rational-cancel' });
    var solveButton = ctx.button('כפול במכנה ופתור', function () {
      phase = 4;
      renderRational();
      ctx.note('בתחום, ' + m('x − 3 ≠ 0') + '. כפל במכנה נותן ' + m('2x + 4 = 4x − 12') + ', ומכאן ' + m('16 = 2x') + '. בחר פתרון.');
    }, { id: 'rational-solve' });
    ['8', '−3', '3', '2'].forEach(function (value, i) {
      solutionButtons.push(ctx.button(m('x = ' + value), function () {
        if (phase !== 4) return;
        if (value === '8') {
          phase = 5;
          renderRational();
          ctx.caption(m('x = 8') + ' וגם ' + m('x ≠ 3, x ≠ −3'));
          ctx.note('בדיקה במקור: המונה ' + m('220') + ', המכנה ' + m('55') + ', ולכן ' + m('220 ÷ 55 = 4') + '. הפתרון מותר!', 'good');
          ctx.sfx('correct');
          ctx.solved();
        } else if (value === '−3' || value === '3') {
          ctx.note(m('x = ' + value) + ' מאפס את המכנה המקורי ולכן אסור בתחום. צמצום לא מחזיר ערך שנאסר.');
        } else {
          ctx.note('ב־' + m('x = 2') + ' מקבלים במשוואה הליניארית ' + m('8 ≠ −4') + '. עדיין צריך לחלק את ' + m('16') + ' ב־' + m('2') + '.');
        }
      }, { id: 'solution-' + i, ghost: true }));
    });
    renderRational();
    ctx.note('סמן את כל הערכים שאסור להציב. בלי תחום נכון לא מתחילים לצמצם.');
  }

  var steps = [
    {
      mode: 'intro', tA: 'סדנת הגורמים',
      sub: 'הופכים סכום למכפלה, ופותחים בחזרה כדי לבדוק.',
      tip: 'שלום, אני אליהו. בוא נבנה מכפלות, ונשמור על תחום ההגדרה.',
      emoji: '🔧', eq: m('2x² + 10x + 12 = 2(x + 2)(x + 3)'),
      note: 'נתרגל גורם משותף, טרינום, הפרש ריבועים ומשוואה אחת עם שבר. זה חלק מהנושא פירוק לגורמים.',
      cue: 'לחץ כדי להתחיל', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'גורם משותף',
      sub: 'בחר את הגורם המשותף הגדול ביותר לשלושת האיברים.',
      tip: 'הגורם צריך לחלק כל איבר, גם את האיבר בלי ' + m('x') + '.',
      aspect: [W, 250], alt: 'שלושה כרטיסים עם שני איקס בריבוע, עשרה איקס ושתים עשרה; לאחר הבחירה כל כרטיס מחולק בשניים',
      cue: 'בחר את הגורם המשותף הגדול ביותר', cueDone: 'הוצאת גורם משותף. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'factors', text: 'בדוק איזה גורם מחלק גם את האיבר הקבוע.' }, setup: commonFactorScene
    },
    {
      mode: 'quiz', tA: 'מהו הפירוק המלא?',
      sub: 'הוצא את הגורם המשותף הגדול ביותר מ־' + m('6x² + 9x') + '.',
      tip: 'בדוק את המקדמים ואת החזקה המשותפת של ' + m('x') + '.', btn: 'המשך ←',
      win: 'בדיוק. הגורם המשותף הגדול ביותר הוא ' + m('3x') + '.',
      wrongSay: 'נסה לפתוח את הסוגריים, ואז בדוק אם נשאר גורם משותף בפנים.',
      opts: [
        { t: '3x(2x + 3)', c: true, f: 'נכון. ' + m('3x·2x = 6x²') + ' וגם ' + m('3x·3 = 9x') + '. בפנים לא נשאר גורם משותף שאינו ' + m('1') + '.' },
        { t: '3(2x² + 3x)', f: 'זה ביטוי שקול, אבל הוצאת רק ' + m('3') + '. נשאר גורם ' + m('x') + ' משותף בסוגריים, ולכן הפירוק אינו מלא.' },
        { t: 'x(6x + 9)', f: 'זה ביטוי שקול, אבל הוצאת רק ' + m('x') + '. גם ' + m('3') + ' משותף לשני המקדמים בסוגריים.' },
        { t: '3x(2x + 9)', f: 'החלוקה של האיבר השני שגויה: ' + m('3x·9 = 27x') + ', לא ' + m('9x') + '.' }
      ],
      hints: ['מצא מחלק משותף למקדמים וגורם אות משותף.', 'למקדמים משותף ' + m('3') + ', ולשני האיברים משותף ' + m('x') + '.', 'הוצא ' + m('3x') + ' וחלק בו כל איבר.']
    },
    {
      mode: 'scene', tA: 'טרינום כמלבן',
      sub: 'חלק את ' + m('5x') + ' לשני חלקים. הסכום והמכפלה צריכים להתאים.',
      tip: 'הסכום כבר קבוע. שנה את החלוקה עד שכל היחידות ייכנסו למלבן.',
      aspect: [W, 285], alt: 'מודל שטח: ריבוע איקס בריבוע, חמישה פסי איקס, ושש יחידות; החלוקה משנה את מספר היחידות במלבן ואת השארית בחוץ',
      cue: 'סגור מלבן בלי יחידות שנותרו בחוץ', cueDone: 'המלבן נסגר. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'split', text: 'הגדל או הקטן את החלק הראשון ובדוק את המכפלה.' }, setup: rectangleScene
    },
    {
      mode: 'quiz', tA: 'איזו מכפלה מתאימה?', sub: m('x² + 7x + 12 = ?'),
      tip: 'חפש שני מספרים שהסכום והמכפלה שלהם מתאימים.', btn: 'המשך ←',
      win: 'נכון. גם הסכום וגם המכפלה חייבים להתאים.', wrongSay: 'בדוק בנפרד את האיבר של ' + m('x') + ' ואת האיבר הקבוע.',
      opts: [
        { t: '(x + 3)(x + 4)', c: true, f: 'בדיוק. ' + m('3 + 4 = 7') + ' וגם ' + m('3·4 = 12') + '.' },
        { t: '(x + 2)(x + 6)', f: 'בדקת רק את המכפלה: ' + m('2·6 = 12') + ', אבל ' + m('2 + 6 = 8') + ', לא ' + m('7') + '.' },
        { t: '(x + 1)(x + 12)', f: 'המכפלה נכונה, אבל הסכום ' + m('1 + 12 = 13') + ' נותן ' + m('13x') + ', לא ' + m('7x') + '.' },
        { t: '(x − 3)(x − 4)', f: 'הסימנים הפוכים. הסכום ' + m('−3 + (−4) = −7') + ' נותן ' + m('−7x') + ', לא ' + m('7x') + '.' }
      ],
      hints: ['מצא זוג גורמים של האיבר הקבוע.', 'מבין הזוגות שמכפלתם ' + m('12') + ', חפש סכום ' + m('7') + '.', 'הזוג הוא ' + m('3') + ' ו־' + m('4') + '; בדוק את הסימנים.']
    },
    {
      mode: 'scene', tA: 'משוואה עם שבר',
      sub: 'תחום הגדרה, פירוק, צמצום ורק אז פתרון.',
      tip: 'לפני שמצמצמים, מצא אילו ערכים מאפסים את המכנה.',
      aspect: [W, 280], alt: 'משוואה עם שבר: שני איקס בריבוע ועוד עשרה איקס ועוד שתים עשרה במונה, איקס בריבוע פחות תשע במכנה, שווה ארבע; המכנה מפורק ושני הערכים האסורים נשארים גלויים',
      cue: 'אשר תחום הגדרה ופתור את המשוואה', cueDone: 'הפתרון מותר ונבדק במקור. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'rational-action', text: 'בדוק את המכנה המקורי. בחר את כל הערכים שמאפסים אותו.' }, setup: rationalScene
    },
    {
      mode: 'quiz', tA: 'הפרש של שני ריבועים', sub: m('x² − 25 = ?'),
      tip: 'זה הפרש ריבועים, לא ריבוע של הפרש.', btn: 'המשך ←',
      win: 'נכון. גורמים צמודים מבטלים את האיברים האמצעיים.', wrongSay: 'פתח את המכפלה שבחרת ובדוק אם מופיע איבר של ' + m('x') + '.',
      opts: [
        { t: '(x − 5)(x + 5)', c: true, f: 'נכון. ' + m('25 = 5²') + ', והאיברים ' + m('5x') + ' ו־' + m('−5x') + ' מבטלים זה את זה.' },
        { t: '(x − 5)²', f: 'בלבלת הפרש ריבועים עם ריבוע של הפרש. כאן מתקבל ' + m('x² − 10x + 25') + '.' },
        { t: '(x + 5)²', f: 'ריבוע של סכום מוסיף איבר אמצעי וגם קבוע חיובי: ' + m('x² + 10x + 25') + '.' },
        { t: '(x − 25)(x + 1)', f: 'השתמשת ב־' + m('25') + ' במקום בשורש שלו. המכפלה נותנת ' + m('x² − 24x − 25') + '.' }
      ],
      hints: ['זהה את שני הביטויים שמעלים בריבוע.', m('25 = 5²') + '. בחר שני גורמים עם סימנים מנוגדים.', 'לפי ' + m('a² − b² = (a − b)(a + b)') + ', כאן ' + m('a = x, b = 5') + '.']
    },
    {
      mode: 'quiz', tA: 'מהו תחום ההגדרה?', sub: 'בחר את כל הערכים האסורים בשבר שבציור.',
      tip: 'התחום נקבע לפי המכנה המקורי בלבד.', btn: 'לסיכום ←',
      aspect: [W, 165], alt: 'שבר עם איקס ועוד אחת במונה ואיקס בריבוע פחות ארבעה איקס במכנה, עם קו שבר אופקי',
      setup: function (ctx) { ctx.draw(fractionSvg('x + 1', 'x² − 4x', false)); },
      win: 'בדיוק. כל גורם במכנה יכול לאפס אותו.', wrongSay: 'פרק את המכנה לגורמים ובדוק מתי כל גורם מתאפס.',
      opts: [
        { t: 'x ≠ 0, x ≠ 4', c: true, f: 'נכון. ' + m('x² − 4x = x(x − 4)') + ', ולכן ' + m('0') + ' ו־' + m('4') + ' מאפסים את המכנה.' },
        { t: 'x ≠ 4', f: 'שכחת את הגורם ' + m('x') + '. גם ' + m('x = 0') + ' מאפס את המכנה.' },
        { t: 'x ≠ −1', f: 'בדקת את המונה. אפס במונה מותר; ב־' + m('x = −1') + ' המכנה הוא ' + m('5') + ', לא אפס.' },
        { t: 'x ≠ 2, x ≠ −2', f: 'קראת את המכנה כאילו היה ' + m('x² − 4') + '. בפועל כתוב ' + m('x² − 4x') + ', ולכן זה לא הפרש ריבועים.' }
      ],
      hints: ['חפש גורם משותף במכנה, לא במונה.', 'המכנה מתפרק ל־' + m('x(x − 4)') + '.', 'בדוק את ' + m('x = 0') + ' ואת ' + m('x − 4 = 0') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את סדנת הגורמים',
      sub: 'פירקת, פתחת בחזרה ובדקת פתרון במשוואה המקורית.',
      tip: 'כל הכבוד. פירוק נכון שומר על הביטוי, וצמצום שומר על האיסורים.',
      cue: 'אפשר לשחק שוב או לתרגל בבונוס', btn: 'שחק שוב ↻',
      finalLead: 'הפירוק שקול למקור. הגבלות תחום ההגדרה נשארות גם אחרי צמצום.',
      formula: m('2x² + 10x + 12 = 2(x + 2)(x + 3)')
    }
  ];

  window.NoamGame.boot({
    slug: 'sadnat-hagormim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'גורם משותף', math: '3x(2x + 3)' },
      { step: 4, name: 'פירוק טרינום', math: '(x + 3)(x + 4)' },
      { step: 6, name: 'הפרש ריבועים', math: '(x − 5)(x + 5)' },
      { step: 7, name: 'תחום הגדרה', math: 'x ≠ 0, x ≠ 4' }
    ],
    bonus: {
      label: 'מכונת הטרינומים', closeLabel: 'סגור את המכונה',
      hint: 'מצא שני מספרים שהסכום והמכפלה שלהם מתאימים לטרינום.',
      setup: function (box, ctx) {
        var targetA = 2, targetB = 3;
        var guessA = 0, guessB = 0;
        box.innerHTML = '<div class="bTitle">מכונת הטרינומים</div>'
          + '<div class="bSub">שנה את שני המספרים ובדוק גם סכום וגם מכפלה.</div>'
          + '<div class="bChip" data-trinomial dir="ltr" style="font-size:19px"></div>'
          + '<div class="stepper" dir="ltr">'
          + '<div class="unit"><button type="button" data-key="a" data-delta="-1" aria-label="הקטן את המספר הראשון">−</button><span class="var">a</span><span class="var" data-guess-a>0</span><button type="button" data-key="a" data-delta="1" aria-label="הגדל את המספר הראשון">+</button></div>'
          + '<div class="unit"><button type="button" data-key="b" data-delta="-1" aria-label="הקטן את המספר השני">−</button><span class="var">b</span><span class="var" data-guess-b>0</span><button type="button" data-key="b" data-delta="1" aria-label="הגדל את המספר השני">+</button></div></div>'
          + '<div class="bForms" data-bonus-forms dir="ltr"></div>'
          + '<div class="bOk" data-bonus-note role="status" aria-live="polite"></div>'
          + '<button type="button" class="bDice" data-bonus-check>בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll>טרינום חדש ↻</button>';
        var bonusNote = box.querySelector('[data-bonus-note]');
        function drawBonus() {
          box.querySelector('[data-trinomial]').textContent = 'x² + ' + (targetA + targetB) + 'x + ' + (targetA * targetB);
          box.querySelector('[data-guess-a]').textContent = String(guessA);
          box.querySelector('[data-guess-b]').textContent = String(guessB);
          box.querySelector('[data-bonus-forms]').innerHTML = htmlMath(guessA + ' + ' + guessB + ' = ' + (guessA + guessB))
            + htmlMath(guessA + ' · ' + guessB + ' = ' + (guessA * guessB));
          bonusNote.textContent = '';
          box.querySelectorAll('[data-delta]').forEach(function (b) {
            var current = b.getAttribute('data-key') === 'a' ? guessA : guessB;
            b.disabled = Number(b.getAttribute('data-delta')) < 0 ? current === 0 : current === 6;
          });
        }
        box.querySelectorAll('[data-delta]').forEach(function (b) {
          b.addEventListener('click', function () {
            var delta = Number(b.getAttribute('data-delta'));
            if (b.getAttribute('data-key') === 'a') guessA = Math.max(0, Math.min(6, guessA + delta));
            else guessB = Math.max(0, Math.min(6, guessB + delta));
            drawBonus();
          });
        });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var sumOk = guessA + guessB === targetA + targetB;
          var productOk = guessA * guessB === targetA * targetB;
          if (sumOk && productOk) {
            bonusNote.textContent = 'נכון. גם הסכום וגם המכפלה מתאימים!';
            box.querySelector('[data-bonus-forms]').innerHTML += htmlMath('(x + ' + guessA + ')(x + ' + guessB + ')');
            ctx.sfx('correct');
          } else {
            bonusNote.textContent = sumOk ? 'הסכום מתאים, אבל המכפלה עדיין לא.' : productOk ? 'המכפלה מתאימה, אבל הסכום עדיין לא.' : 'בדוק שוב את הסכום ואת המכפלה.';
            ctx.sfx('error');
          }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () {
          targetA = 1 + Math.floor(Math.random() * 5);
          targetB = 1 + Math.floor(Math.random() * 5);
          guessA = 0; guessB = 0;
          drawBonus();
        });
        targetA = 1 + Math.floor(Math.random() * 5);
        targetB = 1 + Math.floor(Math.random() * 5);
        drawBonus();
      }
    }
  });
}());
