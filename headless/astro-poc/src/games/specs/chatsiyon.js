/** החציון: מסדרים, מסמנים זוגות, ומשווים לממוצע. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var W = 402;

  function svgNumber(x, y, value, size, color) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 25) + '" fill="' + (color || PAL.ink) + '">' + value + '</text>';
  }
  function svgHebrew(x, y, text, size, color) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-weight="700" font-size="' + (size || 17) + '" fill="' + (color || PAL.ink) + '">' + text + '</text>';
  }
  function cardRow(values, y, prefix) {
    var gap = values.length === 6 ? 60 : 74;
    var width = values.length === 6 ? 50 : 64;
    var left = (W - ((values.length - 1) * gap + width)) / 2;
    return values.map(function (value, i) {
      var x = left + i * gap;
      return '<g id="' + prefix + i + '"><rect x="' + x + '" y="' + y + '" width="' + width + '" height="60" rx="12" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
        + svgNumber(x + width / 2, y + 39, value) + '</g>';
    }).join('');
  }
  function staticCards(values, label) {
    return function (ctx) {
      ctx.draw(svgHebrew(201, 27, label) + cardRow(values, 45, 'data'));
    };
  }

  function sortingScene(ctx) {
    var values = [7, 3, 9, 4, 6];
    var selected = -1, marked = 0, busy = false;
    var html = svgHebrew(201, 25, 'מהקטן לגדול, משמאל לימין');
    values.forEach(function (value, i) {
      var x = 17 + i * 74;
      html += '<g id="sortCard' + i + '" role="button" tabindex="0" aria-label="בחר כרטיס" aria-pressed="false" style="cursor:pointer">'
        + '<rect id="sortRect' + i + '" x="' + x + '" y="49" width="68" height="70" rx="12" fill="#fff" stroke="' + PAL.line + '" stroke-width="2.5"/>'
        + '<text id="sortValue' + i + '" x="' + (x + 34) + '" y="94" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="29" fill="' + PAL.ink + '">' + value + '</text>'
        + '<path id="sortCross' + i + '" d="M' + (x + 9) + ' 61 L' + (x + 59) + ' 106 M' + (x + 59) + ' 61 L' + (x + 9) + ' 106" stroke="' + PAL.dark + '" stroke-width="3" opacity="0" pointer-events="none"/></g>';
    });
    html += '<path id="pairOuter" d="M51 126 V157 H347 V126" fill="none" stroke="' + PAL.main + '" stroke-width="3" opacity="0"/>'
      + '<path id="pairInner" d="M125 126 V141 H273 V126" fill="none" stroke="' + PAL.main + '" stroke-width="3" opacity="0"/>'
      + svgHebrew(201, 195, 'זוג מכל קצה משאיר את האמצע');
    ctx.draw(html);
    ctx.extra('<div style="text-align:center;font-size:13px;line-height:1.6">לחץ על כרטיס ואז על אחר כדי להחליף. במקלדת: בחר עם Enter או רווח, והזז עם החצים.</div>');
    function sorted() {
      return values.every(function (value, i) { return i === 0 || values[i - 1] <= value; });
    }
    function renderSort() {
      values.forEach(function (value, i) {
        var crossed = marked >= 1 && (i === 0 || i === 4) || marked >= 2 && (i === 1 || i === 3);
        var middle = marked === 2 && i === 2;
        ctx.el('sortValue' + i).textContent = String(value);
        ctx.el('sortRect' + i).setAttribute('fill', middle ? PAL.goodSoft : selected === i ? PAL.soft : '#fff');
        ctx.el('sortRect' + i).setAttribute('stroke', middle ? PAL.good : selected === i ? PAL.main : PAL.line);
        ctx.el('sortCross' + i).setAttribute('opacity', crossed ? '0.7' : '0');
        ctx.el('sortCard' + i).setAttribute('aria-pressed', String(selected === i));
        ctx.el('sortCard' + i).setAttribute('aria-label', 'כרטיס ' + value + ', מקום ' + (i + 1) + '. בחר והחלף, או הזז בחצים.');
      });
      ctx.el('pairOuter').setAttribute('opacity', marked >= 1 ? '1' : '0');
      ctx.el('pairInner').setAttribute('opacity', marked >= 2 ? '1' : '0');
    }
    function swapCards(a, b) {
      var temp = values[a]; values[a] = values[b]; values[b] = temp;
      selected = -1;
      ctx.sfx('tick');
      renderSort();
      ctx.note(sorted() ? 'הכרטיסים מסודרים! עכשיו סמן זוגות מהקצוות.' : 'החלפת בין שני כרטיסים. המשך לסדר מהקטן לגדול.');
    }
    function chooseCard(i) {
      if (busy || marked) return;
      if (selected === -1 || selected === i) {
        selected = selected === i ? -1 : i;
        renderSort();
        ctx.note(selected < 0 ? 'הבחירה בוטלה. בחר כרטיס להחלפה.' : 'בחרת ' + m(String(values[i])) + '. לחץ על כרטיס אחר, או הזז בחצים.');
      } else swapCards(selected, i);
    }
    values.forEach(function (_, i) {
      var handle = ctx.el('sortCard' + i);
      handle.addEventListener('click', function () { chooseCard(i); });
      handle.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); chooseCard(i); return; }
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        ev.preventDefault();
        if (busy || marked) return;
        var other = i + (ev.key === 'ArrowRight' ? 1 : -1);
        if (other < 0 || other >= values.length) return;
        if (selected !== i) { ctx.note('בחר את הכרטיס עם Enter או רווח לפני שאתה מזיז אותו.'); return; }
        swapCards(i, other);
        selected = other;
        renderSort();
        ctx.el('sortCard' + other).focus();
      });
    });
    var markButton = ctx.button('סמן זוגות מהקצוות', function () {
      if (busy || marked) return;
      if (!sorted()) {
        ctx.note('קודם מסדרים! הכרטיס שבאמצע עכשיו אינו בהכרח החציון. סדר מהקטן לגדול לפני סימון זוגות.');
        ctx.sfx('error'); return;
      }
      busy = true; selected = -1; markButton.disabled = true; ctx.busy(true);
      ctx.tween(600, function (progress) {
        marked = progress < 0.5 ? 1 : 2;
        renderSort();
      }).then(function () {
        busy = false; ctx.busy(false);
        ctx.caption('החציון הוא ' + m('6'));
        ctx.note('סימנת זוגות מהקצוות: ' + m('3, 9') + ' ואז ' + m('4, 7') + '. נשאר ' + m('6') + ' באמצע.', 'good');
        ctx.sfx('correct'); ctx.burst(14); ctx.solved();
      });
    }, { id: 'markSort', target: 'markSort' });
    renderSort();
    ctx.note('סדר את כל הכרטיסים מהקטן לגדול. רק אחר כך מחפשים את האמצע.');
  }

  function evenScene(ctx) {
    var values = [2, 4, 6, 8, 10];
    var added = false, paired = false, busy = false, done = false;
    var answerButtons = [];
    function renderEven(pairCount) {
      var out = svgHebrew(201, 25, added ? 'מספר זוגי: נשארים שני אמצעיים' : 'התחלנו עם מספר אי־זוגי') + cardRow(values, 47, 'evenCard');
      if (added && pairCount) {
        [0, 1, 4, 5].forEach(function (i) {
          if (pairCount === 1 && (i === 1 || i === 4)) return;
          var x = 26 + i * 60;
          out += '<path d="M' + (x + 6) + ' 55 L' + (x + 44) + ' 99 M' + (x + 44) + ' 55 L' + (x + 6) + ' 99" stroke="' + PAL.dark + '" stroke-width="3" opacity=".7"/>';
        });
        if (pairCount === 2) {
          out += '<rect x="142" y="43" width="118" height="69" rx="13" fill="none" stroke="' + PAL.good + '" stroke-width="3"/>'
            + svgNumber(201, 148, done ? '(6 + 8) ÷ 2 = 7' : '(6 + 8) ÷ 2 = ?', 23, PAL.good);
        }
      } else out += svgHebrew(201, 147, added ? 'סמן זוגות מהקצוות' : 'הוסף כרטיס וראה מה משתנה');
      ctx.draw(out);
    }
    var addButton = ctx.button('הוסף כרטיס', function () {
      if (added) return;
      added = true; values.push(42); addButton.disabled = true;
      renderEven(0); ctx.sfx('tick');
      ctx.note('הוספת ' + m('42') + '. עכשיו יש ' + m('6') + ' נתונים מסודרים. סמן זוגות והשאר את שני האמצעיים.');
    }, { id: 'addCard', target: 'addCard' });
    var pairButton = ctx.button('סמן זוגות', function () {
      if (paired || busy) return;
      if (!added) { ctx.note('קודם הוסף כרטיס. עם חמישה נתונים נשאר אמצעי אחד; אנחנו בודקים מה קורה כשיש שישה.'); ctx.sfx('error'); return; }
      busy = true; ctx.busy(true); pairButton.disabled = true;
      ctx.tween(600, function (progress) { renderEven(progress < 0.5 ? 1 : 2); }).then(function () {
        paired = true; busy = false; ctx.busy(false);
        answerButtons.forEach(function (button) { button.hidden = false; });
        ctx.note('נשארו ' + m('6') + ' ו־' + m('8') + '. בחר את הממוצע שלהם, לא רק אחד מהם.');
      });
    }, { id: 'markEven', ghost: true });
    [6, 7, 8, 14].forEach(function (value) {
      var answerButton = ctx.button(m(String(value)), function () {
        if (!paired || done) return;
        if (value === 7) {
          done = true; renderEven(2);
          ctx.note('בדיוק: ' + m('(6 + 8) ÷ 2 = 7') + '. החציון אינו חייב להיות אחד מהנתונים!', 'good');
          ctx.caption('החציון הוא ' + m('7'));
          ctx.sfx('correct'); ctx.burst(14); ctx.solved();
        } else {
          ctx.sfx('error');
          ctx.note(value === 14 ? 'חיברת את שני האמצעיים, אבל לא חילקת בשניים. צריך את הממוצע שלהם.' : 'בחרת רק אחד משני האמצעיים. במספר זוגי של נתונים צריך את הממוצע של שניהם.');
        }
      }, { id: 'median' + value, ghost: value !== 7 });
      answerButton.hidden = true; answerButtons.push(answerButton);
    });
    renderEven(0);
    ctx.note('הוסף כרטיס כדי לעבור מחמישה נתונים לשישה.');
  }

  function compareScene(ctx) {
    var last = 10, done = false;
    var extraBox = ctx.extra('<div class="sceneStrip" style="grid-template-columns:repeat(2,1fr)">'
      + '<div><b>חציון</b><span class="math" dir="ltr" data-median>7</span></div>'
      + '<div><b>ממוצע</b><span class="math" dir="ltr" data-mean></span></div></div>'
      + '<div class="stepper" style="margin-top:10px"><div class="unit" dir="ltr">'
      + '<button id="lastLess" type="button" aria-label="הקטן את הכרטיס האחרון בשמונה">−</button>'
      + '<span class="var math" data-last dir="ltr">10</span>'
      + '<button id="lastMore" type="button" aria-label="הגדל את הכרטיס האחרון בשמונה">+</button></div></div>');
    var moreButton = extraBox.querySelector('#lastMore');
    var lessButton = extraBox.querySelector('#lastLess');
    ctx.register('lastMore', moreButton);
    function renderCompare() {
      var mean = (30 + last) / 6;
      var exact = (30 + last) % 6 === 0;
      var meanText = exact ? String(mean) : '≈ ' + mean.toFixed(2);
      ctx.draw(svgHebrew(201, 23, 'הכרטיס האחרון נשאר הגדול ביותר')
        + cardRow([2, 4, 6, 8, 10, last], 38, 'compareCard')
        + svgHebrew(201, 125, 'חציון', 17, PAL.good)
        + '<rect x="38" y="137" width="308" height="19" rx="7" fill="' + PAL.goodSoft + '"/>'
        + '<rect x="38" y="137" width="154" height="19" rx="7" fill="' + PAL.good + '"/>'
        + svgNumber(213, 153, 7, 19, PAL.good)
        + svgHebrew(201, 187, 'ממוצע', 17, PAL.main)
        + '<rect x="38" y="199" width="308" height="19" rx="7" fill="' + PAL.soft + '"/>'
        + '<rect x="38" y="199" width="' + (mean * 22) + '" height="19" rx="7" fill="' + PAL.main + '"/>'
        + svgNumber(346, 193, meanText, 17, PAL.main)
        + '<line x1="38" y1="241" x2="346" y2="241" stroke="' + PAL.ink + '" stroke-width="1.5"/>'
        + svgNumber(38, 263, 0, 15) + svgNumber(192, 263, 7, 15) + svgNumber(346, 263, 14, 15));
      extraBox.querySelector('[data-last]').textContent = String(last);
      extraBox.querySelector('[data-mean]').textContent = meanText;
      moreButton.disabled = last === 42;
      ctx.caption('ממוצע: ' + m('(30 + ' + last + ') ÷ 6 ' + (exact ? '= ' : '≈ ') + (exact ? mean : mean.toFixed(2))));
      ctx.note(last === 42 ? 'כאן החציון נשאר ' + m('7') + ' כי הכרטיס נשאר הגדול ביותר. הממוצע עלה ל־' + m('12') + '. זה לא אומר שערך קיצוני לעולם לא משנה חציון.' : 'שני האמצעיים עדיין ' + m('6, 8') + ', לכן החציון ' + m('7') + '. הגדל את הכרטיס האחרון עד ' + m('42') + '.', last === 42 ? 'good' : undefined);
      if (last === 42 && !done) { done = true; ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }
    }
    moreButton.addEventListener('click', function () { last = Math.min(42, last + 8); ctx.sfx('tick'); renderCompare(); });
    lessButton.addEventListener('click', function () {
      if (last === 10) { ctx.note('הכרטיס כבר בערך הקטן ביותר בתרגיל: ' + m('10') + '. כדי להשוות השפעה של ערך גדול, הגדל אותו.'); return; }
      last -= 8; ctx.sfx('tick'); renderCompare();
    });
    ctx.button('גם החציון עלה', function () {
      ctx.note('לא כאן: הגדלת את הכרטיס האחרון, לא את שני האמצעיים. הם נשארו ' + m('6, 8') + ', ולכן החציון נשאר ' + m('7') + '. הממוצע כן תלוי בגודל של כל הנתונים.');
      ctx.sfx('error');
    }, { id: 'medianMoved', ghost: true });
    renderCompare();
  }

  var steps = [
    {
      mode: 'intro', tA: 'אליהו מחפש את האמצע',
      sub: 'החציון מתחבא באמצע — אבל קודם צריך לסדר את הנתונים.',
      tip: 'שלום, אני אליהו. בוא נסדר כרטיסים ונגלה מי באמת באמצע.',
      emoji: '🎯', eq: 'החציון: האמצע לאחר מיון',
      note: 'קודם מסדרים מהקטן לגדול. אחר כך מסמנים זוגות מהקצוות ומחפשים את האמצע.',
      cue: 'מוכן לחפש את האמצע?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מסדרים את הכרטיסים',
      sub: 'החלף בין הכרטיסים עד שהם מסודרים, ואז סמן זוגות מהקצוות.',
      tip: 'הכרטיס באמצע עוד לא בהכרח החציון. סדר מהקטן לגדול, ואז סמן זוגות.',
      aspect: [W, 210], alt: 'חמישה כרטיסי מספרים שאפשר להחליף בלחיצה או במקלדת, וסימון זוגות מהקצוות לאחר מיון',
      cue: 'קודם מיון, אחר כך סימון זוגות', cueDone: 'נשאר האמצע. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'בחר כרטיס ואז כרטיס אחר, כדי להחליף ביניהם.' }, setup: sortingScene
    },
    {
      mode: 'quiz', tA: 'מה החציון של הכרטיסים?',
      sub: 'הנתונים: ' + m('8, 2, 9, 5, 4') + '. סדר אותם לפני שאתה בוחר.',
      tip: 'אל תיקח את הכרטיס שבאמצע לפני המיון. קודם סדר בראש.', btn: 'המשך ←',
      aspect: [W, 125], alt: 'כרטיסי הנתונים שמונה, שתיים, תשע, חמש וארבע לפני מיון', setup: staticCards([8, 2, 9, 5, 4], 'לפני מיון'),
      opts: [
        { t: '5', c: true, f: 'נכון. אחרי מיון: ' + m('2, 4, 5, 8, 9') + '. באמצע נמצא ' + m('5') + '.' },
        { t: '9', f: 'לקחת את הכרטיס האמצעי לפני המיון. החציון הוא האמצע רק לאחר שמסדרים.' },
        { t: '5.6', f: 'חישבת ממוצע: ' + m('28 ÷ 5 = 5.6') + '. החציון נקבע לפי המקום, לא לפי סכום הנתונים.' },
        { t: '4', f: 'לאחר המיון זה הנתון השני, לא האמצעי. בחמישה נתונים מחפשים את השלישי.' }
      ],
      win: 'בדיוק. המיון מגלה את האמצע האמיתי.', wrongSay: 'בדוק שהכרטיסים מסודרים מהקטן לגדול.',
      hints: ['סדר את כל הנתונים מהקטן לגדול.', 'אחרי המיון יש שני נתונים קטנים מהאמצעי ושניים גדולים ממנו.', 'בסדר ' + m('2, 4, 5, 8, 9') + ' חפש את הכרטיס השלישי.']
    },
    {
      mode: 'scene', tA: 'מספר זוגי של נתונים',
      sub: 'הוסף כרטיס, סמן זוגות, ובחר את החציון החדש.',
      tip: 'כשנשארים שני כרטיסים באמצע, החציון הוא הממוצע של שניהם.',
      aspect: [W, 170], alt: 'חמישה נתונים מסודרים, כרטיס נוסף של ארבעים ושתיים, ושני האמצעיים שש ושמונה לאחר סימון זוגות',
      cue: 'הוסף, סמן זוגות ובחר חציון', cueDone: 'מצאת את ממוצע האמצעיים ←', btn: 'המשך ←',
      nudge: { target: 'addCard', text: 'הוסף כרטיס כדי לקבל מספר זוגי של נתונים.' }, setup: evenScene
    },
    {
      mode: 'quiz', tA: 'מה החציון כשיש ארבעה נתונים?',
      sub: 'הנתונים כבר מסודרים: ' + m('3, 5, 9, 15') + '.',
      tip: 'יש שני אמצעיים. אל תבחר רק אחד מהם.', btn: 'המשך ←',
      aspect: [W, 125], alt: 'ארבעה כרטיסי נתונים מסודרים: שלוש, חמש, תשע וחמש עשרה', setup: staticCards([3, 5, 9, 15], 'כבר מסודרים'),
      opts: [
        { t: '7', c: true, f: 'בדיוק: שני האמצעיים הם ' + m('5, 9') + ', ולכן ' + m('(5 + 9) ÷ 2 = 7') + '.' },
        { t: '8', f: 'זה הממוצע של כל הנתונים: ' + m('32 ÷ 4 = 8') + '. החציון משתמש רק בשני האמצעיים.' },
        { t: '9', f: 'בחרת רק אחד משני האמצעיים. צריך את הממוצע של ' + m('5') + ' ו־' + m('9') + '.' },
        { t: '14', f: 'חיברת את שני האמצעיים בלי לחלק בשניים. החציון הוא הממוצע שלהם, לא הסכום.' }
      ],
      win: 'מעולה. בחציון זוגי ממוצעים רק את שני האמצעיים.', wrongSay: 'סמן בראש את שני הנתונים שבמרכז.',
      hints: ['סמן זוג מהקצוות ובדוק מה נשאר.', 'נשארו ' + m('5') + ' ו־' + m('9') + '. חשב את הממוצע שלהם.', 'הסכום הוא ' + m('14') + '. עכשיו חלק בשניים.']
    },
    {
      mode: 'scene', tA: 'חציון מול ממוצע',
      sub: 'הגדל רק את הכרטיס האחרון עד ' + m('42') + ' והשווה בין שני המדדים.',
      tip: 'מה ישתנה כשכרטיס אחד גדל מאוד? הזז אותו ושים לב לשני האמצעיים.',
      aspect: [W, 280], alt: 'שישה כרטיסים מסודרים ושני פסים באותו קנה מידה: חציון שבע וממוצע המשתנה עם הכרטיס האחרון',
      cue: 'הגדל את הכרטיס האחרון והשווה', cueDone: 'כאן הממוצע עלה והחציון נשאר ←', btn: 'המשך ←',
      nudge: { target: 'lastMore', text: 'לחץ על הפלוס כדי להגדיל את הכרטיס האחרון.' }, setup: compareScene
    },
    {
      mode: 'quiz', tA: 'מה מתאר שכר טיפוסי טוב יותר?',
      sub: 'משכורות חודשיות באלפי שקלים: ' + m('5, 6, 6, 7, 46') + '.',
      tip: 'משכורת אחת גבוהה מאוד. איזה מדד קרוב יותר לרוב המשכורות?', btn: 'המשך ←',
      aspect: [W, 125], alt: 'משכורות באלפי שקלים: חמש, שש, שש, שבע וארבעים ושש', setup: staticCards([5, 6, 6, 7, 46], 'משכורות באלפי שקלים'),
      opts: [
        { t: 'החציון, ' + m('6'), c: true, f: 'נכון. החציון ' + m('6') + ' קרוב לרוב המשכורות. המשכורת ' + m('46') + ' מושכת את הממוצע למעלה.' },
        { t: 'הממוצע, ' + m('14'), f: 'הממוצע אכן ' + m('70 ÷ 5 = 14') + ', אבל המשכורת החריגה ' + m('46') + ' מושכת אותו הרחק מרוב המשכורות.' },
        { t: 'הממוצע, ' + m('6'), f: 'בלבלת בין המדדים: ' + m('6') + ' הוא החציון. הממוצע הוא סכום כל המשכורות חלקי מספרן.' },
        { t: 'החציון, ' + m('7'), f: 'בחרת את הנתון הרביעי. בחמישה נתונים מסודרים החציון הוא הנתון השלישי, כאן ' + m('6') + '.' }
      ],
      win: 'בדיוק. כאן החציון מתאר טוב יותר משכורת טיפוסית.', wrongSay: 'בחר מדד שקרוב לרוב המשכורות, לא למשכורת החריגה.',
      hints: ['השווה את רוב המשכורות למשכורת הגבוהה מאוד.', 'החציון הוא הכרטיס השלישי לאחר מיון. הממוצע משתמש גם במשכורת החריגה.', 'הנתון השלישי הוא ' + m('6') + ', ורוב המשכורות קרובות אליו.']
    },
    {
      mode: 'quiz', tA: 'איזה כרטיס כדאי להוסיף?',
      sub: 'הוסף נתון ל־' + m('1, 3, 5') + ' כדי שהחציון החדש יהיה ' + m('4') + '.',
      tip: 'אחרי ההוספה יהיו ארבעה נתונים. חפש שני אמצעיים שהממוצע שלהם מתאים.', btn: 'לסיכום ←',
      aspect: [W, 125], alt: 'שלושה כרטיסים: אחת, שלוש וחמש, וכרטיס רביעי עם סימן שאלה', setup: staticCards([1, 3, 5, '?'], 'מה תוסיף כדי לקבל את החציון המבוקש?'),
      opts: [
        { t: '7', c: true, f: 'נכון. אחרי הוספת ' + m('7') + ' הסדר הוא ' + m('1, 3, 5, 7') + '. החציון הוא ' + m('(3 + 5) ÷ 2 = 4') + '.' },
        { t: '2', f: 'אחרי מיון נשארים ' + m('2, 3') + ' באמצע, והחציון הוא ' + m('2.5') + ', לא ' + m('4') + '.' },
        { t: '4', f: 'הוספת את החציון המבוקש, אבל אחרי המיון האמצעיים הם ' + m('3, 4') + '. הממוצע שלהם הוא ' + m('3.5') + '.' },
        { t: '3', f: 'אחרי הוספת ' + m('3') + ' שני האמצעיים הם ' + m('3, 3') + ', ולכן החציון נשאר ' + m('3') + '.' }
      ],
      win: 'מצוין. אתה יודע לתכנן נתונים לפי החציון.', wrongSay: 'הוסף כל מועמד בראש, מיין מחדש, ובדוק את שני האמצעיים.',
      hints: ['אחרי ההוספה מיין את ארבעת הנתונים.', 'כדי לקבל חציון ' + m('4') + ', אפשר להשאיר את ' + m('3, 5') + ' באמצע.', 'חפש כרטיס גדול מ־' + m('5') + ' כדי ששני האמצעיים לא ישתנו.']
    },
    {
      mode: 'finish', tA: 'מצאת את האמצע עם אליהו',
      sub: 'מיון קודם, אמצע אחר כך. עכשיו אתה גם מבדיל בין חציון לממוצע.',
      tip: 'כל הכבוד. החציון תלוי באמצע לאחר מיון, והממוצע בגודל של כל הנתונים.',
      cue: 'אפשר לתרגל עוד או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'הכלל שגילית:',
      formula: 'מסדרים ומוצאים אמצע; בזוגי: ממוצע האמצעיים'
    }
  ];

  window.NoamGame.boot({
    slug: 'chatsiyon', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'מיון לפני החציון', math: '2, 4, 5, 8, 9' },
      { step: 4, name: 'חציון במספר זוגי', math: '(5 + 9) ÷ 2 = 7' },
      { step: 6, name: 'חציון מול ממוצע', math: '6 ≠ 14' },
      { step: 7, name: 'תכנון נתונים', math: '(3 + 5) ÷ 2 = 4' }
    ],
    bonus: {
      label: 'מכונת החציונים', closeLabel: 'סגור את המכונה',
      hint: 'מיין את הנתונים, בחר חציון ובדוק.',
      setup: function (box, ctx) {
        var data = [], ordered = [], guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת החציונים</div>'
          + '<div class="bSub">חמישה או שישה נתונים. מיין בראש ובחר חציון בצעדים של חצי.</div>'
          + '<div class="bChip math" data-data dir="ltr" style="font-size:18px;padding:8px 10px"></div>'
          + '<div class="stepper"><div class="unit" dir="ltr">'
          + '<button type="button" data-change="-0.5" aria-label="הקטן את הניחוש בחצי">−</button>'
          + '<span class="var math" data-guess dir="ltr">0</span>'
          + '<button type="button" data-change="0.5" aria-label="הגדל את הניחוש בחצי">+</button></div></div>'
          + '<div class="bForms" data-order dir="ltr" hidden></div><div class="bOk" data-result hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק חציון</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">נתונים חדשים ↻</button>';
        function rollData() {
          var count = Math.random() < 0.5 ? 5 : 6;
          data = [];
          for (var i = 0; i < count; i++) data.push(1 + Math.floor(Math.random() * 12));
          ordered = data.slice().sort(function (a, b) { return a - b; });
          guess = 0;
          box.querySelector('[data-data]').textContent = data.join(', ');
          box.querySelector('[data-guess]').textContent = '0';
          box.querySelector('[data-order]').hidden = true;
          box.querySelector('[data-result]').hidden = true;
        }
        box.querySelectorAll('[data-change]').forEach(function (button) {
          button.addEventListener('click', function () {
            guess = Math.max(0, Math.min(12, guess + Number(button.getAttribute('data-change'))));
            box.querySelector('[data-guess]').textContent = String(guess);
            box.querySelector('[data-result]').hidden = true;
            ctx.sfx('tick');
          });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var middle = Math.floor(ordered.length / 2);
          var expected = ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
          var result = box.querySelector('[data-result]');
          var orderEl = box.querySelector('[data-order]');
          orderEl.textContent = ordered.join(', '); orderEl.hidden = false;
          result.textContent = guess === expected ? 'נכון! מצאת את האמצע לאחר מיון.' : 'עוד ניסיון: הסדר מוצג למעלה. באי־זוגי קח את האמצעי; בזוגי חשב ממוצע של שני האמצעיים.';
          result.style.color = guess === expected ? PAL.good : PAL.dark;
          result.hidden = false; ctx.sfx(guess === expected ? 'correct' : 'error');
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { rollData(); ctx.sfx('click'); });
        rollData();
      }
    }
  });
}());
