/** סדנת היחסים: משכפלים חבילות, שומרים מנה או מכפלה קבועה. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var RED = '#b91c1c', BLUE = '#1d4ed8';

  function bounded(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function svgMath(x, y, value, size, color) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 18) + '" fill="' + (color || PAL.ink) + '">' + value + '</text>';
  }
  function svgHebrew(x, y, value, size) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 16) + '" fill="' + PAL.ink + '">' + value + '</text>';
  }
  function readout(label, key, color) {
    return '<div><b>' + label + '</b><span dir="ltr" class="math" data-v="' + key + '" style="color:' + (color || PAL.ink) + '"></span></div>';
  }

  function bundleScene(ctx) {
    var bundles = 1, complete = false;
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(4,minmax(0,1fr))">'
      + readout('חבילות', 'bundles') + readout('אדומים', 'red', RED)
      + readout('כחולים', 'blue', BLUE) + readout('סך הכול', 'total') + '</div>');
    box.style.width = '100%';
    function renderBundles() {
      var drawing = svgHebrew(113, 25, 'אדום: עיגול', 15) + svgHebrew(287, 25, 'כחול: ריבוע', 15);
      for (var j = 0; j < bundles; j++) {
        var left = j % 2 === 0 ? 22 : 210;
        var top = 44 + Math.floor(j / 2) * 52;
        drawing += '<rect x="' + left + '" y="' + top + '" width="170" height="42" rx="12" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>';
        for (var token = 0; token < 5; token++) {
          var center = left + 25 + token * 30;
          drawing += token < 2
            ? '<circle cx="' + center + '" cy="' + (top + 21) + '" r="9" fill="' + RED + '"/>'
            : '<rect x="' + (center - 9) + '" y="' + (top + 12) + '" width="18" height="18" rx="3" fill="' + BLUE + '"/>';
        }
      }
      ctx.draw(drawing);
      box.querySelector('[data-v="bundles"]').textContent = String(bundles);
      box.querySelector('[data-v="red"]').textContent = String(2 * bundles);
      box.querySelector('[data-v="blue"]').textContent = String(3 * bundles);
      box.querySelector('[data-v="total"]').textContent = String(5 * bundles);
      ctx.caption(m('2 + 3 = 5') + ' אסימונים בחבילה');
      if (bundles === 8) {
        complete = true;
        ctx.note('בנית ' + m('8') + ' חבילות: ' + m('16') + ' אדומים ו־' + m('24') + ' כחולים. היחס ' + m('16 : 24') + ' הוא עדיין ' + m('2 : 3') + '.', 'good');
        plusBundle.disabled = true;
        minusBundle.disabled = true;
        equalParts.disabled = true;
        ctx.sfx('correct');
        ctx.burst(14);
        ctx.solved();
      } else {
        ctx.note('כרגע יש ' + m(String(5 * bundles)) + ' אסימונים. הוסף חבילות שלמות עד ' + m('40') + '; בכל חבילה שני אדומים ושלושה כחולים.');
      }
    }
    var plusBundle = ctx.button('+ חבילה', function () {
      if (complete) return;
      bundles = bounded(bundles + 1, 0, 8);
      ctx.sfx('click');
      renderBundles();
    }, { id: 'ratio-add', target: 'bundles' });
    var minusBundle = ctx.button('− חבילה', function () {
      if (complete) return;
      bundles = bounded(bundles - 1, 0, 8);
      ctx.sfx('click');
      renderBundles();
    }, { id: 'ratio-minus', ghost: true });
    var equalParts = ctx.button('חלק שווה בשווה?', function () {
      if (complete) return;
      ctx.note('חלוקה שווה של ' + m('40') + ' תיתן ' + m('20') + ' מכל צבע: יחס ' + m('1 : 1') + ', לא ' + m('2 : 3') + '. שכפל את שתי הכמויות יחד, לא חצי־חצי.');
      ctx.sfx('error');
    }, { id: 'ratio-equal', ghost: true });
    renderBundles();
  }

  function directScene(ctx) {
    var price = 12, complete = false;
    var table = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,minmax(0,1fr))">'
      + readout('מחברות במחיר ידוע', 'known-count') + readout('מחיר ידוע בשקלים', 'known-price')
      + readout('מחברות במשימה', 'target-count') + readout('המחיר שהצעת', 'guess') + '</div>');
    table.style.width = '100%';
    table.querySelector('[data-v="known-count"]').textContent = '3';
    table.querySelector('[data-v="known-price"]').textContent = '12';
    table.querySelector('[data-v="target-count"]').textContent = '7';
    function renderDirect() {
      var drawing = svgHebrew(110, 23, 'מחיר בשקלים', 15) + svgHebrew(320, 253, 'מחברות', 15);
      var originX = 58, originY = 216;
      [0, 12, 28, 32].forEach(function (amount) {
        var height = originY - amount * 5;
        drawing += '<line x1="58" y1="' + height + '" x2="346" y2="' + height + '" stroke="' + PAL.line + '" stroke-width="1"/>';
        drawing += svgMath(34, height + 5, String(amount), 14);
      });
      drawing += '<path d="M58 48 V216 H346" fill="none" stroke="' + PAL.ink + '" stroke-width="2"/>';
      [0, 1, 3, 7, 8].forEach(function (count) {
        drawing += svgMath(originX + count * 36, 236, String(count), 14);
      });
      drawing += '<line x1="58" y1="216" x2="346" y2="56" stroke="' + PAL.main + '" stroke-width="3"/>';
      [0, 1, 3].forEach(function (count) {
        drawing += '<circle cx="' + (originX + count * 36) + '" cy="' + (originY - count * 20) + '" r="5" fill="' + PAL.main + '" stroke="#fff" stroke-width="2"/>';
      });
      drawing += svgMath(214, 146, '(3, 12)', 16, PAL.dark);
      var candidateY = originY - Math.min(price, 32) * 5;
      drawing += '<line x1="310" y1="216" x2="310" y2="' + candidateY + '" stroke="' + PAL.warm + '" stroke-width="2" stroke-dasharray="5 4"/>';
      drawing += '<circle cx="310" cy="' + candidateY + '" r="7" fill="' + (complete ? PAL.good : PAL.warmSoft) + '" stroke="' + (complete ? PAL.good : PAL.dark) + '" stroke-width="2"/>';
      if (price > 32) drawing += svgMath(310, 37, '↑ ' + price, 16);
      ctx.draw(drawing);
      table.querySelector('[data-v="guess"]').textContent = String(price);
      ctx.caption('מחיר ליחידה: ' + m('12 ÷ 3 = 4') + ' שקלים');
    }
    var addPrice = ctx.button(m('+4') + ' ₪', function () {
      if (complete) return;
      price = bounded(price + 4, 0, 88);
      ctx.sfx('tick');
      renderDirect();
      ctx.note('העיגול מציג את הצעתך עבור שבע מחברות. בחר מחיר ולחץ בדוק.');
    }, { id: 'direct-add', target: 'price' });
    var lowerPrice = ctx.button(m('−4') + ' ₪', function () {
      if (complete) return;
      price = bounded(price - 4, 0, 88);
      ctx.sfx('tick');
      renderDirect();
      ctx.note('העיגול מציג את הצעתך עבור שבע מחברות. בחר מחיר ולחץ בדוק.');
    }, { id: 'direct-minus', ghost: true });
    var checkPrice = ctx.button('בדוק', function () {
      if (complete) return;
      if (price === 28) {
        complete = true;
        renderDirect();
        ctx.note('נכון: ' + m('7 × 4 = 28') + ' שקלים. המנה נשמרת: ' + m('28 ÷ 7 = 4') + '.', 'good');
        addPrice.disabled = true;
        lowerPrice.disabled = true;
        checkPrice.disabled = true;
        ctx.sfx('correct');
        ctx.burst(14);
        ctx.solved();
      } else {
        if (price === 16) ctx.note('הוספת רק ' + m('4') + ' למחיר ' + m('12') + '. נוספו ארבע מחברות, וכל אחת עולה ' + m('4') + ' שקלים; צריך להוסיף את המחיר של כולן.');
        else if (price === 84) ctx.note('כפלת את ' + m('12') + ' ב־' + m('7') + ', אבל ' + m('12') + ' הוא מחיר של שלוש מחברות, לא של אחת. קודם מצא מחיר ליחידה.');
        else ctx.note('בדוק מחיר ליחידה: מחברת אחת עולה ' + m('4') + ' שקלים. כפל במחברות שבמשימה, לא במחיר של שלוש מחברות.');
        ctx.sfx('error');
      }
    }, { id: 'direct-check' });
    renderDirect();
    ctx.note('אין הנחת כמות או תשלום נוסף. הנקודות המלאות הן מחירים ידועים; העיגול הוא ההצעה שלך.');
  }

  function inverseScene(ctx) {
    var workers = 4, complete = false;
    var box = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(3,minmax(0,1fr))">'
      + readout('עובדים', 'workers') + readout('שעות', 'hours') + readout('שעות־עובד', 'work') + '</div>'
      + '<div class="stepper" style="margin-top:10px"><div class="unit">'
      + '<button type="button" id="inverse-minus" aria-label="עובד אחד פחות">−</button>'
      + '<b style="font-size:13px">עובדים</b><span class="var math" dir="ltr" data-worker-value></span>'
      + '<button type="button" id="inverse-add" aria-label="עובד אחד נוסף">+</button></div></div>'
      + '<p style="font-size:13px;line-height:1.5;text-align:center;margin:10px 0 0">כולם עובדים באותו קצב, איש אינו מפריע לאחר, ואפשר לחלק את העבודה ביניהם.</p>');
    var moreWorkers = box.querySelector('#inverse-add');
    var fewerWorkers = box.querySelector('#inverse-minus');
    function renderInverse() {
      var hours = 24 / workers;
      var hoursText = workers === 7 ? '≈ 3.43' : String(hours);
      var rectWidth = workers * 32, rectHeight = hours * 8;
      var top = 252 - rectHeight;
      var drawing = svgHebrew(201, 24, 'אותה עבודה, צורה משתנה', 17)
        + svgHebrew(33, 46, 'שעות', 14) + svgHebrew(335, 278, 'עובדים', 14);
      drawing += '<path d="M70 56 V252 H336 M66 62 L70 56 L74 62 M330 248 L336 252 L330 256" fill="none" stroke="' + PAL.ink + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
      drawing += '<rect x="70" y="' + top + '" width="' + rectWidth + '" height="' + rectHeight + '" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>';
      for (var column = 1; column < workers; column++) {
        drawing += '<line x1="' + (70 + column * 32) + '" y1="' + top + '" x2="' + (70 + column * 32) + '" y2="252" stroke="' + PAL.line + '"/>';
      }
      for (var hourLine = 1; hourLine < hours; hourLine++) {
        drawing += '<line x1="70" y1="' + (252 - hourLine * 8) + '" x2="' + (70 + rectWidth) + '" y2="' + (252 - hourLine * 8) + '" stroke="' + PAL.line + '"/>';
      }
      drawing += svgMath(70 + rectWidth / 2, 277, String(workers), 18, PAL.dark);
      drawing += svgMath(35, top + rectHeight / 2 + 5, hoursText, workers === 7 ? 13 : 17, PAL.dark);
      drawing += '<rect x="' + (70 + rectWidth / 2 - 14) + '" y="' + (top + rectHeight / 2 - 11) + '" width="28" height="22" rx="5" fill="#fff"/>';
      drawing += svgMath(70 + rectWidth / 2, top + rectHeight / 2 + 6, '24', 17);
      ctx.draw(drawing);
      box.querySelector('[data-v="workers"]').textContent = String(workers);
      box.querySelector('[data-v="hours"]').textContent = hoursText;
      box.querySelector('[data-v="work"]').textContent = '24';
      box.querySelector('[data-worker-value]').textContent = String(workers);
      fewerWorkers.disabled = complete || workers === 1;
      moreWorkers.disabled = complete || workers === 8;
      ctx.caption(workers === 7 ? m('7 × (24 ÷ 7) = 24') : m(workers + ' × ' + hoursText + ' = 24'));
    }
    function changeWorkers(delta) {
      if (complete) return;
      workers = bounded(workers + delta, 1, 8);
      ctx.sfx('tick');
      renderInverse();
      ctx.note('יותר עובדים — פחות שעות. מצא את מספר העובדים שייתן שלוש שעות, ואז בדוק.');
    }
    moreWorkers.addEventListener('click', function () { changeWorkers(1); });
    fewerWorkers.addEventListener('click', function () { changeWorkers(-1); });
    ctx.register('workers', box);
    var checkWorkers = ctx.button('בדוק', function () {
      if (complete) return;
      if (workers === 8) {
        complete = true;
        renderInverse();
        checkWorkers.disabled = true;
        doubleTime.disabled = true;
        ctx.note('נכון: ' + m('8 × 3 = 24') + '. הכפלת את מספר העובדים, ולכן הזמן נחצה משש לשלוש שעות.', 'good');
        ctx.sfx('correct');
        ctx.burst(14);
        ctx.solved();
      } else {
        if (workers === 2) ctx.note('הקטנת את מספר העובדים, ולכן הזמן התארך ל־' + m('12') + ' שעות. כדי לקצר לשלוש שעות צריך יותר עובדים, לא פחות.');
        else ctx.note('המכפלה צריכה להישאר ' + m('24') + '. חפש מספר עובדים שעבורו ' + m('24 ÷ x = 3') + '.');
        ctx.sfx('error');
      }
    }, { id: 'inverse-check' });
    var doubleTime = ctx.button('גם השעות מוכפלות?', function () {
      if (complete) return;
      ctx.note('לא. שמונה עובדים במשך שתים עשרה שעות יתנו ' + m('8 × 12 = 96') + ' שעות־עובד, אבל העבודה היא ' + m('24') + '. זו חשיבה על פרופורציה ישרה; כאן הכפלת העובדים חוצה את הזמן.');
      ctx.sfx('error');
    }, { id: 'inverse-double', ghost: true });
    renderInverse();
    ctx.note('בהתחלה: ' + m('4 × 6 = 24') + ' שעות־עובד. השטח מייצג את כמות העבודה, לא שטח פיזי.');
  }

  var steps = [
    {
      mode: 'intro', tA: 'סדנת היחסים',
      sub: 'חבילה קבועה, מחיר קבוע ליחידה ועבודה קבועה.',
      tip: 'שלום, אני אליהו. בוא נגלה מה נשאר קבוע כשמשנים כמויות.',
      emoji: '🧮', eq: m('2 : 3'),
      note: 'על כל שני אסימונים אדומים יש שלושה כחולים. יחס הוא חבילה שאפשר לשכפל.',
      cue: 'לחץ כדי להתחיל', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'חבילת היחס',
      sub: 'בנה ' + m('40') + ' אסימונים ביחס ' + m('2 : 3') + ' — אדומים לכחולים.',
      tip: 'כל לחיצה מוסיפה חבילה שלמה: שני אדומים ושלושה כחולים.',
      aspect: [402, 265], alt: 'חבילות של שני עיגולים אדומים ושלושה ריבועים כחולים; טבלת חבילות, צבעים וסך הכול מתעדכנת עם הכפתורים',
      cue: 'הוסף חבילות עד ארבעים אסימונים', cueDone: 'היחס נשמר. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'bundles', text: 'הוסף חבילה שלמה, וספור את הסכום בטבלה.' }, setup: bundleScene
    },
    {
      mode: 'quiz', tA: 'כמה אסימונים אדומים?',
      sub: 'חלק ' + m('40') + ' אסימונים ביחס ' + m('2 : 3') + ' — אדומים לכחולים.',
      tip: 'מצא כמה חבילות יש, ואז ספור רק את האדומים.', btn: 'המשך ←',
      opts: [
        { t: '16', c: true, f: 'נכון: ' + m('40 ÷ 5 = 8') + ' חבילות, ובכל אחת שני אדומים. לכן ' + m('8 × 2 = 16') + '.' },
        { t: '20', f: 'חילקת חצי־חצי. זה יחס ' + m('1 : 1') + ', ולא היחס המבוקש ' + m('2 : 3') + '.' },
        { t: '24', f: 'ספרת את הכחולים: ' + m('8 × 3 = 24') + '. נשאלת על האדומים, שהם החלק הקטן.' },
        { t: '8', f: 'זה מספר החבילות, לא מספר האדומים. בכל חבילה יש שני אדומים.' }
      ],
      win: 'בדיוק. מספר החבילות כפול החלק האדום.', wrongSay: 'היחס אינו חצי־חצי. ספור חבילות שלמות.',
      hints: ['חבר את שני חלקי היחס כדי לדעת כמה אסימונים בחבילה.', m('40 ÷ (2 + 3) = 8') + ' חבילות. כפל את מספר החבילות בשני אדומים.']
    },
    {
      mode: 'scene', tA: 'פרופורציה ישרה',
      sub: m('3') + ' מחברות עולות ' + m('12') + ' ₪. קבע מחיר ל־' + m('7') + ' מחברות ובדוק.',
      tip: 'מחיר ליחידה נשאר קבוע. קודם מצא מחיר של מחברת אחת.',
      aspect: [402, 270], alt: 'גרף מחיר מול מספר מחברות: ישר דרך הראשית, נקודות במחירים ידועים ועיגול של המחיר המוצע לשבע מחברות',
      cue: 'קבע מחיר לשבע מחברות ובדוק', cueDone: 'המחיר ליחידה נשמר. המשך ←', btn: 'המשך ←',
      nudge: { target: 'price', text: 'המחיר משתנה בארבעה שקלים בכל לחיצה. אחר כך לחץ בדוק.' }, setup: directScene
    },
    {
      mode: 'quiz', tA: 'קונים לפי משקל',
      sub: m('5') + ' ק״ג עולים ' + m('35') + ' ₪. כמה יעלו ' + m('8') + ' ק״ג באותו מחיר לק״ג?',
      tip: 'אין הנחת כמות. מצא מחיר לקילוגרם אחד, ואז כפל במשקל.', btn: 'המשך ←',
      opts: [
        { t: '56', c: true, f: 'נכון: ' + m('35 ÷ 5 = 7') + ' שקלים לק״ג, ולכן ' + m('8 × 7 = 56') + ' שקלים.' },
        { t: '38', f: 'הוספת שלושה שקלים כי נוספו שלושה ק״ג. כל ק״ג נוסף עולה שבעה שקלים, לא שקל אחד.' },
        { t: '40', f: 'הוספת את המספר חמש למחיר. חמש הוא המשקל המקורי; צריך לחשב מחיר ליחידה ולכפול במשקל החדש.' },
        { t: '280', f: 'כפלת את מחיר חמשת הק״ג בשמונה. ' + m('35') + ' אינו מחיר של ק״ג אחד.' }
      ],
      win: 'מצוין. אותה מנה של מחיר ומשקל.', wrongSay: 'אל תחבר משקל למחיר. מצא קודם מחיר לק״ג.',
      hints: ['חשב כמה עולה קילוגרם אחד.', m('35 ÷ 5 = 7') + '. כעת חשב ' + m('8 × 7') + '.']
    },
    {
      mode: 'scene', tA: 'פרופורציה הפוכה',
      sub: 'העבודה דורשת ' + m('24') + ' שעות־עובד. בחר עובדים כך שהעבודה תיקח ' + m('3') + ' שעות.',
      tip: 'כאן העבודה קבועה. יותר עובדים יקצרו את הזמן, בתנאים שכתובים מתחת למלבן.',
      aspect: [402, 290], alt: 'מלבן עבודה ששטחו קבוע: רוחב הוא מספר העובדים וגובה הוא מספר השעות. כפתורי עובדים משנים את הצורה בלי לשנות את המכפלה',
      cue: 'בחר עובדים עבור שלוש שעות ובדוק', cueDone: 'המכפלה נשמרת. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'workers', text: 'הוסף עובד ותראה איך גובה המלבן קטן.' }, setup: inverseScene
    },
    {
      mode: 'quiz', tA: 'פי שניים עובדים — כמה זמן?',
      sub: m('4') + ' עובדים מסיימים עבודה ב־' + m('6') + ' שעות. כמה שעות יידרשו ל־' + m('8') + ' עובדים?',
      tip: 'אותה עבודה, אותו קצב לכל עובד, בלי הפרעות. שמור על המכפלה.', btn: 'המשך ←',
      opts: [
        { t: '3', c: true, f: 'נכון: העבודה היא ' + m('4 × 6 = 24') + ' שעות־עובד, ולכן ' + m('24 ÷ 8 = 3') + ' שעות.' },
        { t: '12', f: 'הכפלת גם את העובדים וגם את הזמן, כאילו זו פרופורציה ישרה. באותה עבודה, פי שניים עובדים דורשים חצי מהזמן.' },
        { t: '10', f: 'הוספת את ארבעת העובדים הנוספים לשש השעות. עובדים ושעות הן כמויות שונות; שומרים על המכפלה, לא מחברים אותן.' },
        { t: '2', f: 'חילקת את הזמן בשלוש במקום בשתיים. מספר העובדים הוכפל פי שניים בלבד.' }
      ],
      win: 'נכון. יותר עובדים, פחות זמן, אותה עבודה.', wrongSay: 'מספר העובדים הוכפל. כדי לשמור מכפלה, מה יקרה לזמן?',
      hints: ['חשב את כמות העבודה: עובדים כפול שעות.', m('4 × 6 = 24') + '. חלק את העבודה בשמונה עובדים.']
    },
    {
      mode: 'quiz', tA: 'איפה הפרופורציה הפוכה?',
      sub: 'בחר זוג כמויות שמכפלתן קבועה.',
      tip: 'חפש מצב שבו הכפלת כמות אחת חוצה את השנייה.', btn: 'לסיכום ←',
      opts: [
        { t: 'מספר הברזים הפתוחים וזמן מילוי הבריכה', c: true, f: 'נכון, לבריכה קבועה וברזים זהים בספיקה קבועה, בלי הפרעות או יציאת מים: פי שניים ברזים ימלאו בחצי מהזמן.' },
        { t: 'מספר המחברות והמחיר הכולל', f: 'במחיר קבוע למחברת זו פרופורציה ישרה: יותר מחברות עולות יותר. המנה קבועה, לא המכפלה.' },
        { t: 'גיל של ילד וגובהו', f: 'אלה אינם בפרופורציה. הגובה אינו מוכפל בכל פעם שהגיל מוכפל, וגם מכפלת גיל וגובה אינה קבועה.' },
        { t: 'מספר העוגות וכמות הקמח', f: 'באותו מתכון לעוגות זהות זו פרופורציה ישרה: פי שניים עוגות דורשות פי שניים קמח.' }
      ],
      win: 'יפה. זיהית מצב שבו יותר מקצר את הזמן.', wrongSay: 'לא כל קשר בין כמויות הוא פרופורציה. חפש מכפלה קבועה.',
      hints: ['בחלק מהמצבים שתי הכמויות גדלות יחד. זה לא הקשר המבוקש.', 'חשוב על בריכה קבועה וברזים זהים. מה יקרה לזמן אם תפתח פי שניים ברזים?']
    },
    {
      mode: 'finish', tA: 'סיימת את סדנת היחסים',
      sub: 'יחס הוא חבילה שמשכפלים. בישרה המנה קבועה; בהפוכה המכפלה קבועה.',
      tip: 'כל הכבוד. קודם שאל מה נשאר קבוע, ורק אחר כך חשב.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'לכמויות חיוביות, הכללים שגילית:', formula: 'ישרה: ' + m('y ÷ x = k') + ' · הפוכה: ' + m('x · y = k')
    }
  ];

  window.NoamGame.boot({
    slug: 'sadnat-hayachasim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'חלוקה לפי יחס', math: '2 : 3' },
      { step: 4, name: 'פרופורציה ישרה', math: 'y ÷ x = k' },
      { step: 6, name: 'פרופורציה הפוכה', math: 'x · y = k' },
      { step: 7, name: 'זיהוי קשר בין כמויות', math: 'k' }
    ],
    bonus: {
      label: 'מכונת חלוקה לפי יחס', closeLabel: 'סגור את המכונה', hint: 'מצא כמה חבילות יש, ואז חשב את החלק הגדול.',
      setup: function (box, ctx) {
        var ratioA = 2, ratioB = 3, bundleCount = 8, guess = 0;
        box.innerHTML = '<div class="bTitle">החלק הגדול</div>'
          + '<div class="bSub" data-question></div><div class="bChip" data-ratio dir="ltr"></div>'
          + '<div class="stepper"><div class="unit">'
          + '<button type="button" data-delta="-1" aria-label="הקטן את החלק באחד">−</button>'
          + '<span class="var math" dir="ltr" data-guess>0</span>'
          + '<button type="button" data-delta="1" aria-label="הגדל את החלק באחד">+</button></div></div>'
          + '<div class="bForms" data-calculation dir="ltr" hidden></div><div class="bOk" data-feedback hidden></div>'
          + '<button type="button" class="bDice" style="min-width:44px" data-check>בדוק</button>'
          + '<button type="button" class="bDice" style="min-width:44px" data-new>תרגיל חדש</button>';
        var question = box.querySelector('[data-question]');
        var ratioChip = box.querySelector('[data-ratio]');
        var guessNode = box.querySelector('[data-guess]');
        var calculation = box.querySelector('[data-calculation]');
        var feedback = box.querySelector('[data-feedback]');
        function refreshBonus() {
          question.textContent = 'חלק ' + m(String((ratioA + ratioB) * bundleCount)) + ' אסימונים לפי היחס. כמה בחלק הגדול?';
          ratioChip.textContent = ratioA + ' : ' + ratioB;
          guessNode.textContent = String(guess);
          calculation.hidden = true;
          feedback.hidden = true;
          box.querySelector('[data-delta="-1"]').disabled = guess === 0;
          box.querySelector('[data-delta="1"]').disabled = guess === (ratioA + ratioB) * bundleCount;
        }
        box.querySelectorAll('[data-delta]').forEach(function (button) {
          button.addEventListener('click', function () {
            guess = bounded(guess + Number(button.getAttribute('data-delta')), 0, (ratioA + ratioB) * bundleCount);
            ctx.sfx('tick');
            refreshBonus();
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var answer = Math.max(ratioA, ratioB) * bundleCount;
          feedback.hidden = false;
          if (guess === answer) {
            feedback.textContent = 'נכון. החלק הגדול מכיל יותר אסימונים בכל חבילה.';
            feedback.style.color = PAL.good;
            calculation.innerHTML = '<div class="math" dir="ltr">' + ((ratioA + ratioB) * bundleCount) + ' ÷ (' + ratioA + ' + ' + ratioB + ') = ' + bundleCount + '</div>'
              + '<div class="math" dir="ltr">' + bundleCount + ' × ' + Math.max(ratioA, ratioB) + ' = ' + answer + '</div>';
            calculation.hidden = false;
            ctx.sfx('correct');
          } else {
            feedback.textContent = 'נסה שוב. חלק את הסכום במספר האסימונים בחבילה, ואז כפל בחלק הגדול של היחס.';
            feedback.style.color = PAL.dark;
            ctx.sfx('error');
          }
        });
        box.querySelector('[data-new]').addEventListener('click', function () {
          ratioA = 1 + Math.floor(Math.random() * 4);
          ratioB = ratioA + 1 + Math.floor(Math.random() * 3);
          bundleCount = 2 + Math.floor(Math.random() * 7);
          guess = 0;
          ctx.sfx('click');
          refreshBonus();
        });
        refreshBonus();
      }
    }
  });
}());
