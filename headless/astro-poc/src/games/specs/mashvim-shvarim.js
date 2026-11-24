/** משווים שברים: שלמים שווים, יחידות שוות ונקודות על ישר אחד. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c', ORANGE = '#b45309', MUTED = '#475569';
  var W = 402;

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function mathSvg(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 19)
      + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function hebSvg(x, y, text, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="16" font-weight="700" fill="' + MUTED + '">' + text + '</text>';
  }
  function fractionSvg(x, y, numerator, denominator, colour, prefix) {
    return mathSvg(x, y - 10, numerator, 24, colour, prefix ? prefix + 'Num' : '')
      + '<line x1="' + (x - 19) + '" y1="' + y + '" x2="' + (x + 19) + '" y2="' + y + '" stroke="' + (colour || PAL.ink) + '" stroke-width="2.4"/>'
      + mathSvg(x, y + 29, denominator, 24, colour, prefix ? prefix + 'Den' : '');
  }
  function stripSvg(prefix, y, numerator, denominator, colour) {
    var out = '<rect x="40" y="' + y + '" width="280" height="38" rx="5" fill="#fff" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<rect id="' + prefix + 'Fill" x="40" y="' + y + '" width="' + (280 * numerator / denominator) + '" height="38" fill="' + colour + '" opacity=".82"/>';
    for (var i = 1; i < denominator; i++) {
      out += '<line x1="' + (40 + 280 * i / denominator) + '" y1="' + y + '" x2="' + (40 + 280 * i / denominator)
        + '" y2="' + (y + 38) + '" stroke="' + PAL.ink + '" stroke-width="1.6"/>';
    }
    return out + fractionSvg(362, y + 13, numerator, denominator, colour, prefix);
  }
  function handleSvg(id, label, low, high, value) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + low
      + '" aria-valuemax="' + high + '" aria-valuenow="' + value + '" aria-orientation="horizontal" style="cursor:grab;touch-action:none">'
      + '<rect x="-32" y="-32" width="64" height="64" rx="12" fill="transparent"/>'
      + '<circle r="12" fill="#fff" stroke="' + PAL.dark + '" stroke-width="4"/>'
      + '<path d="M-5 0 H5 M-5 0 L-1 -4 M-5 0 L-1 4 M5 0 L1 -4 M5 0 L1 4" stroke="' + PAL.dark + '" stroke-width="2" fill="none"/></g>';
  }
  function stepperBox(ctx, prefix, label) {
    return ctx.extra('<div class="stepper" dir="ltr"><div class="unit" dir="ltr">'
      + '<button type="button" id="' + prefix + 'Minus" aria-label="הקטן את ' + label + '">−</button>'
      + '<span dir="rtl" style="font:700 14px Heebo,sans-serif">' + label + '</span>'
      + '<bdi class="var math" dir="ltr" id="' + prefix + 'Value" style="min-width:28px" aria-live="polite"></bdi>'
      + '<button type="button" id="' + prefix + 'Plus" aria-label="הגדל את ' + label + '">+</button></div></div>');
  }
  /** All routes use setValue for preview and commit for mathematical acceptance. */
  function wireSlider(ctx, id, prefix, options) {
    var handleNode = ctx.el(id);
    ctx.el(prefix + 'Minus').addEventListener('click', function () { options.setValue(options.getValue() - 1); });
    ctx.el(prefix + 'Plus').addEventListener('click', function () { options.setValue(options.getValue() + 1); });
    handleNode.addEventListener('keydown', function (event) {
      var key = event.key;
      var delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[key];
      if (delta) { event.preventDefault(); options.setValue(options.getValue() + delta); }
      else if (key === 'Home') { event.preventDefault(); options.setValue(options.low); }
      else if (key === 'End') { event.preventDefault(); options.setValue(options.high); }
      else if (key === 'Enter' || key === ' ') { event.preventDefault(); options.commit(); }
    });
    var offsetX = 0;
    ctx.drag(handleNode, {
      start: function (x) { offsetX = x - options.position(options.getValue()); handleNode.focus(); },
      move: function (x) { options.setValue(options.fromPosition(x - offsetX)); },
      end: function () { options.commit(); }
    });
    ctx.button('בדוק את הבחירה', options.commit, { id: prefix + 'Check', target: prefix + 'Check' });
    ctx.register('controls', ctx.el(prefix + 'Plus'));
  }
  function setHandle(ctx, id, prefix, value, x, y, spoken) {
    var handleNode = ctx.el(id);
    handleNode.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    handleNode.setAttribute('aria-valuenow', String(value));
    handleNode.setAttribute('aria-valuetext', spoken);
    ctx.el(prefix + 'Value').textContent = String(value);
  }

  function denominatorScene(ctx) {
    var count = 2, completed = false;
    ctx.draw(hebSvg(201, 27, 'שני שלמים שווים — חלקים שווים')
      + stripSvg('fixed', 57, 3, 8, PAL.main) + stripSvg('mine', 145, count, 8, ORANGE)
      + '<line x1="40" y1="236" x2="320" y2="236" stroke="' + PAL.line + '" stroke-width="5"/>'
      + handleSvg('fractionHandle', 'מספר השמיניות הכתומות. חצים משנים; אנטר או רווח בודקים', 0, 8, count));
    stepperBox(ctx, 's1', 'חלקים צבועים');
    function position(value) { return 40 + 35 * value; }
    function preview() {
      ctx.el('mineFill').setAttribute('width', 35 * count);
      ctx.el('mineNum').textContent = String(count);
      setHandle(ctx, 'fractionHandle', 's1', count, position(count), 236, count + ' שמיניות');
      ctx.set({ numerator: count, denominator: 8 });
      ctx.caption('הסגול: שלוש שמיניות · הכתום: ' + m(String(count)) + ' שמיניות');
      if (count === 3) ctx.note('שלוש שמיניות שוות לשלוש שמיניות. כדי לקבל שבר גדול יותר צריך עוד חלקים באותו גודל.');
      else if (count < 3) ctx.note('צבעת פחות משלושה חלקים. המכנה זהה, ולכן השבר הכתום כרגע קטן מהסגול.');
      else if (count !== 5) ctx.note('הכתום כבר גדול מהסגול. במשימה הזאת צריך בדיוק חמש שמיניות; שנה את מספר החלקים.');
      else ctx.note('חמש שמיניות ארוכות משלוש שמיניות: ' + m('5 > 3') + '. בדוק את הבחירה.');
    }
    function setCount(value) {
      var nextCount = clamp(Math.round(value), 0, 8);
      if (nextCount === count) return;
      count = nextCount; ctx.sfx('tick'); preview();
    }
    function commitCount() {
      if (count !== 5) { ctx.sfx('error'); preview(); return; }
      ctx.note('בדיוק! שני השלמים שווים, כל חלק הוא שמינית, וחמישה חלקים גדולים משלושה. כשהמכנה שווה משווים מונים.', 'good');
      if (!completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
    }
    wireSlider(ctx, 'fractionHandle', 's1', { low: 0, high: 8, getValue: function () { return count; }, setValue: setCount,
      position: position, fromPosition: function (x) { return (x - 40) / 35; }, commit: commitCount });
    preview();
  }

  function numeratorScene(ctx) {
    var divisor = 2, completed = false;
    ctx.draw(hebSvg(201, 27, 'אותו מונה — גודל החלק משתנה')
      + stripSvg('thirds', 57, 2, 3, PAL.main) + '<g id="variableStrip"></g>'
      + '<line x1="40" y1="236" x2="320" y2="236" stroke="' + PAL.line + '" stroke-width="5"/>'
      + handleSvg('denominatorHandle', 'המכנה של השבר הכתום. חצים משנים; אנטר או רווח בודקים', 2, 8, divisor));
    stepperBox(ctx, 's3', 'המכנה');
    function divisorPosition(value) { return 40 + (value - 2) * 280 / 6; }
    function drawDivisor() {
      ctx.el('variableStrip').innerHTML = stripSvg('variable', 145, 2, divisor, ORANGE);
      setHandle(ctx, 'denominatorHandle', 's3', divisor, divisorPosition(divisor), 236, 'שתיים מתוך ' + divisor + ' חלקים שווים');
      ctx.set({ numerator: 2, denominator: divisor });
      ctx.caption('המונה נשאר ' + m('2') + ' · המכנה הכתום: ' + m(String(divisor)));
      if (divisor === 2) ctx.note('שני חצאים הם שלם אחד, והוא גדול משני שלישים. מכנה קטן יוצר חלקים גדולים יותר, לא קטנים יותר.');
      else if (divisor === 3) ctx.note('אותו מונה ואותו מכנה נותנים שברים שווים. צריך שבר קטן משני שלישים, לא שווה לו.');
      else if (divisor > 4) ctx.note('השבר הכתום אכן קטן משני שלישים, אבל זה לא המכנה הקטן ביותר שמתאים. נסה מכנה קטן יותר.');
      else ctx.note('שני רבעים קטנים משני שלישים. בדוק אם זה המכנה הקטן ביותר שמתאים.');
    }
    function setDivisor(value) {
      var nextDivisor = clamp(Math.round(value), 2, 8);
      if (nextDivisor === divisor) return;
      divisor = nextDivisor; ctx.sfx('tick'); drawDivisor();
    }
    function commitDivisor() {
      if (divisor !== 4) { ctx.sfx('error'); drawDivisor(); return; }
      ctx.note('נכון! רבע קטן משליש. לקחנו שני חלקים בשתי הרצועות, ולכן שני רבעים קטנים משני שלישים. המכנה ארבע הוא הראשון שמתאים.', 'good');
      if (!completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
    }
    wireSlider(ctx, 'denominatorHandle', 's3', { low: 2, high: 8, getValue: function () { return divisor; }, setValue: setDivisor,
      position: divisorPosition, fromPosition: function (x) { return 2 + (x - 40) * 6 / 280; }, commit: commitDivisor });
    drawDivisor();
  }

  function numberLineScene(ctx) {
    var twelfths = 4, completed = false;
    var drawing = hebSvg(110, 24, 'השבר שאתה ממקם') + fractionSvg(110, 57, 3, 4, PAL.main)
      + fractionSvg(290, 74, 5, 6, ORANGE)
      + '<line x1="40" y1="132" x2="340" y2="132" stroke="' + PAL.ink + '" stroke-width="3"/>';
    for (var i = 0; i <= 12; i++) {
      drawing += '<line x1="' + (40 + 25 * i) + '" y1="124" x2="' + (40 + 25 * i) + '" y2="140" stroke="' + PAL.ink + '" stroke-width="2"/>';
    }
    drawing += mathSvg(40, 166, '0', 18) + mathSvg(340, 166, '1', 18)
      + fractionSvg(190, 163, 1, 2, PAL.dark) + '<circle cx="290" cy="132" r="8" fill="' + ORANGE + '"/>'
      + '<line id="positionGuide" y1="132" y2="238" stroke="' + PAL.main + '" stroke-width="2" stroke-dasharray="5 4"/>'
      + '<circle id="movingDot" cy="132" r="8" fill="' + PAL.main + '"/>'
      + '<line x1="40" y1="238" x2="340" y2="238" stroke="' + PAL.line + '" stroke-width="5"/>'
      + handleSvg('numberHandle', 'המקום של שלושה רבעים. חצים מזיזים; אנטר או רווח בודקים', 0, 12, twelfths);
    ctx.draw(drawing);
    var extraNode = stepperBox(ctx, 's5', 'שתים עשריות');
    extraNode.insertAdjacentHTML('beforeend', '<div style="display:flex;gap:22px;align-items:center;justify-content:center;margin-top:8px" dir="ltr">'
      + '<svg id="lineReadout" viewBox="0 0 200 80" role="img" aria-label="הנקודה שלך מול חמש שישיות" style="width:200px;max-width:100%;height:auto">'
      + fractionSvg(35, 38, twelfths, 12, PAL.main, 'read') + mathSvg(100, 49, '?', 25, PAL.ink, 'readRelation')
      + fractionSvg(165, 38, 10, 12, ORANGE) + '</svg></div>');
    function linePosition(value) { return 40 + 25 * value; }
    function paintPosition() {
      var x = linePosition(twelfths);
      setHandle(ctx, 'numberHandle', 's5', twelfths, x, 238, twelfths + ' שתים עשריות');
      ctx.el('movingDot').setAttribute('cx', x);
      ctx.el('positionGuide').setAttribute('x1', x); ctx.el('positionGuide').setAttribute('x2', x);
      ctx.el('readNum').textContent = String(twelfths);
      ctx.el('readRelation').textContent = twelfths < 10 ? '<' : twelfths === 10 ? '=' : '>';
      ctx.set({ twelfths: twelfths });
      ctx.caption('החצי: שש שתים עשריות');
      if (twelfths === 3) ctx.note('שמרת רק את המונה שלוש. כשמחליפים רבעים בשתים עשריות, כל רבע מתפצל לשלושה חלקים; גם המונה גדל פי שלושה.');
      else if (twelfths <= 6) ctx.note('שלושה רבעים גדולים מחצי, ולכן הנקודה צריכה להיות מימין לחצי. כל רבע שווה שלוש שתים עשריות.');
      else if (twelfths === 10) ctx.note('זו הנקודה של חמש שישיות, לא שלושה רבעים. ברבע יש שלוש שתים עשריות; ספור שלוש קבוצות כאלה.');
      else if (twelfths !== 9) ctx.note('המכנה המשותף הוא ' + m('12') + '. כל רבע הוא שלוש שתים עשריות. ספור שלוש קבוצות של שלושה חלקים.');
      else ctx.note('שלוש קבוצות של שלושה חלקים הן ' + m('3 × 3 = 9') + ' שתים עשריות. בדוק את המקום.');
    }
    function setTwelfths(value) {
      var nextTwelfths = clamp(Math.round(value), 0, 12);
      if (nextTwelfths === twelfths) return;
      twelfths = nextTwelfths; ctx.sfx('tick'); paintPosition();
    }
    function commitPosition() {
      if (twelfths !== 9) { ctx.sfx('error'); paintPosition(); return; }
      ctx.note('בדיוק! שלושה רבעים הם תשע שתים עשריות, וחמש שישיות הן עשר שתים עשריות. שניהם גדולים מחצי, אבל ' + m('9 < 10') + ' ולכן שלושה רבעים קטנים מחמש שישיות.', 'good');
      if (!completed) { completed = true; ctx.sfx('correct'); ctx.solved(); }
    }
    wireSlider(ctx, 'numberHandle', 's5', { low: 0, high: 12, getValue: function () { return twelfths; }, setValue: setTwelfths,
      position: linePosition, fromPosition: function (x) { return (x - 40) / 25; }, commit: commitPosition });
    paintPosition();
  }
  function comparisonPicture(n1, d1, n2, d2) {
    return function (ctx) {
      ctx.draw(hebSvg(201, 27, 'משווים על שלמים שווים') + stripSvg('qa', 57, n1, d1, PAL.main) + stripSvg('qb', 142, n2, d2, ORANGE));
    };
  }

  var steps = [
    {
      mode: 'intro', tA: 'משווים שברים', sub: 'אותו שלם, רצועות צבעוניות וישר מספרים אחד.',
      tip: 'שלום, אני אליהו. בוא נגלה איזה שבר גדול יותר, בלי לשפוט רק לפי הספרות.',
      emoji: '◆', eq: 'קודם בודקים שהשלמים שווים',
      art: '<svg viewBox="0 0 402 210" width="402" height="210">' + stripSvg('introA', 25, 3, 8, PAL.main) + stripSvg('introB', 120, 5, 8, ORANGE) + '</svg>',
      note: 'המכנה אומר לכמה חלקים שווים חילקנו. המונה אומר כמה חלקים לקחנו. משווים בגרירה, בכפתורים או בחיצים, ומאשרים באנטר או ברווח.',
      cue: 'מוכן להשוות?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'אותו מכנה, מי גדול יותר?', sub: 'צבע חמש שמיניות בגרירה, בכפתורים או בחיצים. שחרר את הידית או לחץ על בדוק; במקלדת: אנטר או רווח.',
      tip: 'כל חלק הוא שמינית של אותו שלם. שנה רק את מספר החלקים הכתומים.', aspect: [W, 280],
      alt: 'שתי רצועות שוות מחולקות לשמונה חלקים. הסגולה מציגה שלוש שמיניות והכתומה משתנה באמצעות ידית או כפתורים.',
      cue: 'בנה חמש שמיניות ובדוק', cueDone: 'חמש שמיניות גדולות משלוש. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'controls', text: 'שנה את מספר השמיניות בגרירה, בכפתורים או בחיצים, ואז בדוק.' }, setup: denominatorScene
    },
    {
      mode: 'quiz', tA: 'איזה שבר גדול יותר?', sub: 'חמש תשיעיות מול שבע תשיעיות, על אותו שלם.',
      tip: 'המכנה זהה, ולכן כל חלק בשתי הרצועות באותו גודל.', btn: 'המשך ←', aspect: [W, 205],
      alt: 'שתי רצועות שוות מחולקות לתשיעיות: חמש תשיעיות בסגול ושבע תשיעיות בכתום.', setup: comparisonPicture(5, 9, 7, 9),
      win: 'נכון. כשגודל החלק שווה, יותר חלקים נותנים שבר גדול יותר.', wrongSay: 'השווה את מספר החלקים, לא את המכנה המשותף.',
      opts: [
        { t: 'חמש תשיעיות', f: 'בחרת פחות חלקים מאותו גודל. חמישה חלקים קטנים משבעה חלקים כאשר השלמים שווים.' },
        { t: 'השברים שווים', f: 'מכנה שווה אומר שגודל החלקים שווה, לא שמספר החלקים הצבועים שווה.' },
        { t: 'שבע תשיעיות', c: true, f: 'נכון: החלקים הם תשיעיות בשני השברים, ו־' + m('7 > 5') + '. לכן שבע תשיעיות גדולות יותר.' },
        { t: 'אי אפשר להשוות', f: 'כאן השלמים שווים והמכנים שווים. יש מספיק מידע להשוואה בעזרת המונים.' }
      ],
      hints: ['בדוק מה כבר זהה בשני השברים.', 'כל חלק הוא תשיעית. נשאר להשוות כמה חלקים לקחו.', 'איזה מונה גדול יותר: ' + m('5') + ' או ' + m('7') + '?']
    },
    {
      mode: 'scene', tA: 'אותו מונה, חלקים אחרים', sub: 'בין שתיים לשמונה, מצא את המכנה הקטן ביותר שנותן שבר כתום קטן משני שלישים. בגרירה, בכפתורים או בחיצים; אנטר או רווח לבדיקה.',
      tip: 'בשתי הרצועות לקחנו שני חלקים. יותר חלוקות באותו שלם יוצרות חלקים קטנים יותר.', aspect: [W, 280],
      alt: 'שתי רצועות שוות: שני שלישים בסגול ושתיים מתוך מספר משתנה של חלקים בכתום. הידית משנה את המכנה.',
      cue: 'בחר את המכנה הקטן ביותר שמתאים ובדוק', cueDone: 'שני רבעים קטנים משני שלישים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'controls', text: 'נסה מכנה אחר בגרירה, בכפתורים או בחיצים, ואז בדוק.' }, setup: numeratorScene
    },
    {
      mode: 'quiz', tA: 'שלושה חלקים, אבל מאיזה גודל?', sub: 'שלושה רבעים מול שלוש שמיניות, על אותו שלם.',
      tip: 'המונה שווה. הסתכל על גודל כל חלק, לא רק על המספר שמתחת לקו.', btn: 'המשך ←', aspect: [W, 205],
      alt: 'שלושה רבעים בסגול מול שלוש שמיניות בכתום, ברצועות בעלות שלם שווה.', setup: comparisonPicture(3, 4, 3, 8),
      win: 'בדיוק. אותו מספר חלקים, אבל כל רבע גדול מכל שמינית.', wrongSay: 'מכנה גדול יותר יוצר חלקים קטנים יותר של אותו שלם.',
      opts: [
        { t: 'שלוש שמיניות גדולות יותר', f: 'התייחסת למכנה כמו למספר שלם: שמונה גדול מארבע, אבל שמינית קטנה מרבע. המונה שווה, ולכן שלוש שמיניות קטנות יותר.' },
        { t: 'שלושה רבעים גדולים יותר', c: true, f: 'נכון: לקחנו שלושה חלקים בשני השברים. רבע גדול משמינית, ולכן שלושה רבעים גדולים משלוש שמיניות.' },
        { t: 'השברים שווים', f: 'המונה שווה, אבל החלקים אינם באותו גודל. שלושה רבעים אינם שלוש שמיניות.' },
        { t: 'אי אפשר לדעת', f: 'נתון אותו שלם, ואפשר להשוות את גודל החלקים. אין צורך במידע נוסף.' }
      ],
      hints: ['מה נשאר זהה בשני השברים?', 'חלק את אותו שלם לארבעה חלקים ואחר כך לשמונה. באיזו חלוקה כל חלק גדול יותר?', 'בשני השברים יש שלושה חלקים. כל רבע גדול מכל שמינית.']
    },
    {
      mode: 'scene', tA: 'מקום אחד על ישר אחד', sub: 'מקם שלושה רבעים על ישר המחולק לשתים עשריות. בגרירה, בכפתורים או בחיצים; שחרור, בדוק, אנטר או רווח מאשרים.',
      tip: 'סמן קודם את החצי. אחר כך המר רבעים לשתים עשריות כדי להשוות לחמש שישיות.', aspect: [W, 280],
      alt: 'ישר מספרים מאפס עד אחד, מחולק לשנים עשר רווחים. חצי במרכז וחמש שישיות בנקודה העשירית. ידית ממקמת את שלושה רבעים.',
      cue: 'מקם שלושה רבעים ובדוק', cueDone: 'תשע שתים עשריות קטנות מעשר. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'controls', text: 'כל רבע שווה שלוש שתים עשריות. מקם בגרירה, בכפתורים או בחיצים, ואז בדוק.' }, setup: numberLineScene
    },
    {
      mode: 'quiz', tA: 'החצי עוזר להשוות', sub: 'מה גדול יותר: חמש שתים עשריות או שבע עשיריות?',
      tip: 'אין צורך להשוות את הספרות לבדן. בדוק באיזה צד של החצי נמצא כל שבר.', btn: 'המשך ←',
      win: 'נכון. שבר שמעל חצי גדול משבר שמתחת לחצי.', wrongSay: 'מצא כמה חלקים הם בדיוק חצי בכל אחד מהמכנים.',
      opts: [
        { t: 'שבע עשיריות', c: true, f: 'נכון: חמש שתים עשריות קטנות מחצי כי ' + m('5 < 6') + '. שבע עשיריות גדולות מחצי כי ' + m('7 > 5') + '. לכן שבע עשיריות גדולות יותר.' },
        { t: 'חמש שתים עשריות', f: 'מכנה שנים עשר גדול מעשר, אבל זה לא הופך את השבר לגדול. השבר הראשון מתחת לחצי והשני מעליו.' },
        { t: 'השברים שווים', f: 'שני השברים אינם חצי: חמש מתוך שנים עשר פחות מחצי, ושבע מתוך עשר יותר מחצי.' },
        { t: 'אי אפשר בלי מחשבון', f: 'אפשר להשתמש בחצי בלי לחשב עשרוניים. חצי הוא שש שתים עשריות או חמש עשיריות.' }
      ],
      hints: ['השתמש בחצי כנקודת השוואה.', 'חצי של שנים עשר חלקים הוא שישה; חצי של עשרה חלקים הוא חמישה.', 'הראשון מתחת לחצי, והשני מעל לחצי. איזה מהם גדול יותר?']
    },
    {
      mode: 'quiz', tA: 'מכנה משותף, השוואה מדויקת', sub: 'שבע שתים עשריות מול שני שלישים. איזה משפט נכון?',
      tip: 'שני שלישים גדולים מחצי, וגם שבע שתים עשריות. הפעם החצי לבדו לא מכריע: המר לשלמים מחולקים באותו אופן.', btn: 'לסיכום ←',
      win: 'מעולה. אחרי ההמרה משווים שמונה חלקים לשבעה, כולם שתים עשריות.', wrongSay: 'כשמכפילים את המכנה, צריך להכפיל גם את המונה באותו מספר.',
      opts: [
        { t: 'שבע שתים עשריות גדולות יותר', f: 'השווית שבע לשתיים לפני שהחלקים היו שווים. שני שלישים הם שמונה שתים עשריות, ושמונה גדולים משבע.' },
        { t: 'השברים שווים', f: 'שניהם גדולים מחצי, אבל זה לא אומר שהם שווים. במכנה שנים עשר המונים הם שבע ושמונה.' },
        { t: 'החצי לבדו מוכיח שהם שווים', f: 'החצי רק אומר ששניהם באותו צד. כדי להשוות ביניהם צריך מכנה משותף או מיקום מדויק על ישר.' },
        { t: 'שני שלישים גדולים יותר', c: true, f: 'נכון: משלישים לשתים עשריות מכפילים פי ארבע גם את המונה: ' + m('2 × 4 = 8') + '. שמונה שתים עשריות גדולות משבע שתים עשריות.' }
      ],
      hints: ['שני השברים מעל החצי. חפש חלקים באותו גודל.', 'המר שני שלישים לשתים עשריות. משלוש לשנים עשר מכפילים פי ארבע.', 'גם המונה מוכפל: ' + m('2 × 4 = 8') + '. עכשיו השווה שמונה חלקים לשבעה.']
    },
    {
      mode: 'finish', tA: 'סיימת להשוות שברים', sub: 'קודם אותו שלם. אחר כך גודל החלק ומספר החלקים.',
      tip: 'כל הכבוד. עכשיו יש לך כמה דרכים: מכנה שווה, מונה שווה, החצי ומכנה משותף.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'הכלל שלקחת איתך:',
      formula: 'על אותו שלם: חלקים שווים → משווים מונים'
    }
  ];

  window.NoamGame.boot({
    slug: 'mashvim-shvarim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'השוואה במכנה שווה', math: '7 > 5' },
      { step: 4, name: 'השוואה במונה שווה', math: '4 < 8' },
      { step: 6, name: 'השוואה בעזרת החצי', math: '5 < 6; 7 > 5' },
      { step: 7, name: 'השוואה במכנה משותף', math: '2 × 4 = 8 > 7' }
    ],
    bonus: {
      label: 'מכונת ההשוואות', closeLabel: 'סגור את המכונה', hint: 'קבל שני שברים חדשים, בחר מי גדול יותר ובדוק.',
      setup: function (box, ctx) {
        var samples = [[3, 8, 5, 8], [2, 3, 2, 6], [3, 4, 5, 6], [7, 12, 2, 3], [1, 2, 3, 6], [5, 12, 7, 10]];
        var sample = samples[0], relation = 0;
        var relationWords = ['השמאלי קטן יותר', 'השברים שווים', 'השמאלי גדול יותר'];
        box.innerHTML = '<div class="bTitle">מכונת ההשוואות</div><div class="bSub">השלמים שווים. בחר את היחס בין השבר השמאלי לימני.</div>'
          + '<div class="bChip" style="padding:8px"><svg data-bonus-pic viewBox="0 0 260 90" role="img" aria-label="שני השברים להשוואה" style="display:block;width:260px;max-width:100%;height:auto"></svg></div>'
          + '<div class="stepper"><div class="unit" dir="ltr"><button type="button" data-bonus-d="-1" aria-label="בחר יחס קודם">←</button>'
          + '<span data-bonus-choice dir="rtl" style="font:700 13px Heebo,sans-serif;min-width:100px;text-align:center"></span>'
          + '<button type="button" data-bonus-d="1" aria-label="בחר יחס הבא">→</button></div></div>'
          + '<div class="bForms" data-bonus-forms hidden></div><div class="bOk" data-bonus-note role="status" hidden></div>'
          + '<button type="button" class="bDice" data-bonus-check style="min-width:44px;min-height:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll style="min-width:44px;min-height:44px">שברים חדשים ↻</button>';
        function drawBonus() {
          box.querySelector('[data-bonus-pic]').innerHTML = fractionSvg(60, 38, sample[0], sample[1], PAL.main)
            + mathSvg(130, 50, ['<', '=', '>'][relation + 1], 28) + fractionSvg(200, 38, sample[2], sample[3], ORANGE);
          box.querySelector('[data-bonus-choice]').textContent = relationWords[relation + 1];
          box.querySelector('[data-bonus-note]').hidden = true; box.querySelector('[data-bonus-forms]').hidden = true;
        }
        box.querySelectorAll('[data-bonus-d]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { relation = clamp(relation + Number(buttonNode.getAttribute('data-bonus-d')), -1, 1); ctx.sfx('tick'); drawBonus(); });
        });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var leftCount = sample[0] * sample[3], rightCount = sample[2] * sample[1];
          var expected = leftCount < rightCount ? -1 : leftCount > rightCount ? 1 : 0;
          var statusNode = box.querySelector('[data-bonus-note]');
          statusNode.hidden = false; statusNode.style.color = relation === expected ? PAL.good : BAD;
          statusNode.textContent = relation === expected ? 'נכון! במכנה משותף משווים את מספר החלקים.' : 'עוד לא: אל תשווה רק את הספרות. צור חלקים באותו גודל ואז השווה מונים.';
          ctx.sfx(relation === expected ? 'correct' : 'error');
          if (relation === expected) {
            var formsNode = box.querySelector('[data-bonus-forms]');
            formsNode.hidden = false;
            formsNode.innerHTML = '<div>מכנה משותף: <bdi class="math" dir="ltr">' + (sample[1] * sample[3]) + '</bdi></div>'
              + '<div>מונים חדשים: <bdi class="math" dir="ltr">' + leftCount + ' ' + ['<', '=', '>'][expected + 1] + ' ' + rightCount + '</bdi></div>';
          }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () {
          sample = samples[Math.floor(Math.random() * samples.length)]; relation = 0; ctx.sfx('click'); drawBonus();
        });
        sample = samples[Math.floor(Math.random() * samples.length)]; drawBonus();
      }
    }
  });
}());
