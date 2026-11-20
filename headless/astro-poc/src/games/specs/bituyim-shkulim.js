/** מעבדת הביטויים השקולים: כרטיסי איברים, פילוג ודוגמה נגדית. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;

  function signedNum(n) { return n < 0 ? '−' + Math.abs(n) : String(n); }
  function variableTerm(n) { return n === 1 ? 'x' : n === -1 ? '−x' : signedNum(n) + 'x'; }
  function constantTail(n) { return n === 0 ? '' : n < 0 ? ' − ' + Math.abs(n) : ' + ' + n; }
  function simplifiedText(a, b) { return a === 0 ? signedNum(b) : variableTerm(a) + constantTail(b); }
  function mathText(x, y, text, size, color, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="'
      + (size || 23) + '" fill="' + (color || PAL.ink) + '">' + text + '</text>';
  }
  function hebrewText(x, y, text, size) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="'
      + (size || 17) + '" fill="' + PAL.ink + '">' + text + '</text>';
  }
  function mathHtml(text) { return '<bdi class="math" dir="ltr" style="font-family:Secular One,sans-serif">' + text + '</bdi>'; }

  function bundlesScene(ctx) {
    var opened = 0, opening = false;
    var formulaStages = ['3(x + 2)', 'x + 2 + 2(x + 2)', 'x + 2 + x + 2 + (x + 2)', '3x + 6'];
    var drawing = hebrewText(201, 24, 'שלוש חבילות זהות', 18);
    for (var i = 0; i < 3; i++) {
      var bx = 15 + i * 127;
      drawing += '<g id="bundle' + i + '"><rect x="' + bx + '" y="43" width="118" height="174" rx="16" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
        + '<rect x="' + (bx + 17) + '" y="78" width="84" height="51" rx="10" fill="#fff" stroke="' + PAL.line + '"/>'
        + mathText(bx + 59, 112, 'x', 28)
        + '<rect x="' + (bx + 17) + '" y="140" width="84" height="51" rx="10" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '"/>'
        + mathText(bx + 59, 175, '+2', 26)
        + '<path id="seal' + i + '" d="M' + bx + ' 62 H' + (bx + 118) + '" stroke="' + PAL.main + '" stroke-width="7"/>'
        + hebrewText(bx + 59, 239, 'סגורה', 16).replace('<text ', '<text id="bundleState' + i + '" ')
        + '</g>';
    }
    ctx.draw(drawing);
    var historyBox = ctx.extra('<div style="text-align:center;font-size:14px;line-height:1.7">כרטיסים של איברים — לא אורכים.<div data-expanded hidden>'
      + mathHtml('x + 2 + x + 2 + x + 2') + '</div></div>');
    ctx.caption(m(formulaStages[0]));
    ctx.note('בכל חבילה יש ' + m('x') + ' וגם ' + m('+2') + '. פתח את כולן.');
    var openBtn = ctx.button('פתח חבילה', function () {
      if (opening || opened >= 3) return;
      opening = true;
      ctx.busy(true);
      openBtn.disabled = true;
      var sealEl = ctx.el('seal' + opened);
      ctx.sfx('click');
      ctx.tween(420, function (t) {
        sealEl.setAttribute('opacity', String(1 - t));
        sealEl.setAttribute('transform', 'translate(0 ' + (-18 * t) + ')');
      }).then(function () {
        ctx.el('bundleState' + opened).textContent = 'פתוחה';
        opened += 1;
        ctx.set({ opened: opened });
        ctx.caption(m(formulaStages[opened]));
        opening = false;
        ctx.busy(false);
        openBtn.disabled = opened === 3;
        if (opened === 3) {
          historyBox.querySelector('[data-expanded]').hidden = false;
          ctx.note('קיבלת ' + m('3x + 6') + ': שלושה כרטיסי ' + m('x') + ' ושלוש פעמים ' + m('2') + '. המכפיל פועל על שני האיברים.', 'good');
          ctx.sfx('correct');
          ctx.burst(12);
          ctx.solved();
        } else {
          ctx.note('גם ' + m('x') + ' וגם ' + m('+2') + ' יצאו מהחבילה. המשך לפתוח.');
        }
      });
    }, { id: 'openBundle', target: 'openBundle' });
    ctx.button('נסה לכפול רק את האיבר הראשון', function () {
      ctx.note('זה ייתן ' + m('3x + 2') + ', וזה לא נכון: בכל אחת משלוש החבילות יש גם ' + m('+2') + '. צריך ' + m('3 · 2 = 6') + '.');
      ctx.sfx('error');
    }, { id: 'onlyFirst', ghost: true });
  }

  function sortScene(ctx) {
    var cards = [
      { label: '3x', kind: 'x', x: 20 },
      { label: '+6', kind: 'n', x: 114 },
      { label: '+2x', kind: 'x', x: 208 },
      { label: '−1', kind: 'n', x: 302 }
    ];
    var selected = -1, sorted = 0, sorting = false, trayCounts = { x: 0, n: 0 };
    var svgParts = hebrewText(201, 24, 'בחר כרטיס, ואז מגש', 18)
      + '<rect x="12" y="130" width="184" height="180" rx="16" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>'
      + '<rect x="206" y="130" width="184" height="180" rx="16" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>'
      + hebrewText(121, 157, 'איברי', 17) + mathText(78, 157, 'x', 19)
      + hebrewText(298, 157, 'מספרים', 17)
      + mathText(104, 281, '', 19, PAL.dark, 'sumX')
      + mathText(298, 281, '', 19, PAL.ink, 'sumN');
    cards.forEach(function (card, k) {
      svgParts += '<g id="term' + k + '" transform="translate(' + card.x + ' 50)" tabindex="0" role="button" aria-label="בחר את הכרטיס ' + m(card.label)
        + '" aria-pressed="false" style="cursor:pointer"><rect id="termBorder' + k + '" width="78" height="64" rx="12" fill="#fff" stroke="' + PAL.main + '" stroke-width="2"/>'
        + mathText(39, 42, card.label, 26) + '</g>';
    });
    ctx.draw(svgParts);
    function selectCard(k) {
      if (sorting || cards[k].sorted) return;
      selected = k;
      cards.forEach(function (card, j) {
        ctx.el('termBorder' + j).setAttribute('stroke', j === k ? PAL.dark : card.sorted ? PAL.good : PAL.main);
        ctx.el('termBorder' + j).setAttribute('stroke-width', j === k ? '4' : '2');
        ctx.el('term' + j).setAttribute('aria-pressed', String(j === k));
      });
      ctx.note('בחרת ' + m(cards[k].label) + '. לאיזה מגש הוא שייך?');
      ctx.sfx('click');
    }
    cards.forEach(function (card, k) {
      var handle = ctx.el('term' + k);
      handle.addEventListener('click', function () { selectCard(k); });
      handle.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectCard(k); }
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          var delta = ev.key === 'ArrowRight' ? 1 : -1;
          for (var tries = 1; tries <= cards.length; tries++) {
            var nextCard = (k + delta * tries + cards.length * 2) % cards.length;
            if (!cards[nextCard].sorted) { ctx.el('term' + nextCard).focus(); break; }
          }
        }
      });
    });
    function putInTray(kind) {
      if (sorting || sorted === 4) return;
      if (selected < 0) { ctx.note('קודם בחר כרטיס. אחר כך בחר מגש.'); return; }
      var card = cards[selected];
      if (card.kind !== kind) {
        ctx.sfx('error');
        if (card.kind === 'x') ctx.note(m(card.label) + ' הוא איבר עם ' + m('x') + ', לא מספר קבוע. אי אפשר לכנס איברי ' + m('x') + ' עם מספרים.');
        else if (card.label === '−1') ctx.note(m('−1') + ' הוא מספר בלי ' + m('x') + '. שמור את סימן המינוס ומיין למספרים.');
        else ctx.note(m('+6') + ' הוא מספר בלי ' + m('x') + '. הוא שייך למגש המספרים, ולא מצטרף למקדם של ' + m('x') + '.');
        return;
      }
      sorting = true;
      ctx.busy(true);
      var cardIndex = selected;
      var termEl = ctx.el('term' + cardIndex);
      var tx = (kind === 'x' ? 20 : 214) + trayCounts[kind] * 88;
      trayCounts[kind] += 1;
      ctx.tween(350, function (t) {
        var eased = window.NoamGame.ez(t);
        termEl.setAttribute('transform', 'translate(' + (card.x + (tx - card.x) * eased) + ' ' + (50 + 132 * eased) + ')');
      }).then(function () {
        card.sorted = true;
        sorted += 1;
        selected = -1;
        termEl.setAttribute('tabindex', '-1');
        termEl.setAttribute('aria-disabled', 'true');
        termEl.setAttribute('aria-pressed', 'false');
        ctx.el('termBorder' + cardIndex).setAttribute('stroke', PAL.good);
        ctx.el('termBorder' + cardIndex).setAttribute('stroke-width', '2');
        sorting = false;
        ctx.busy(false);
        ctx.set({ sorted: sorted });
        if (sorted === 4) {
          ctx.el('sumX').textContent = '3x + 2x = 5x';
          ctx.el('sumN').textContent = '6 − 1 = 5';
          ctx.caption(m('3(x + 2) + 2x − 1 = 5x + 5'));
          ctx.note('כינסת רק איברים דומים. ' + m('−1') + ' נשאר שלילי, ולכן המספרים נותנים ' + m('5') + '.', 'good');
          ctx.sfx('correct');
          ctx.burst(12);
          ctx.solved();
        } else {
          ctx.note('מיון נכון. ' + (card.label === '−1' ? 'סימן המינוס נשאר עם הכרטיס. ' : '') + 'בחר את הכרטיס הבא.', 'good');
        }
      });
    }
    ctx.button('למגש איברי ' + m('x'), function () { putInTray('x'); }, { id: 'sortX', target: 'sortX' });
    ctx.button('למגש המספרים', function () { putInTray('n'); }, { id: 'sortN', ghost: true });
    ctx.caption(m('3x + 6 + 2x − 1'));
    ctx.note('כרטיסי האיברים שומרים על הסימן שלהם. בחר אחד.');
  }

  function equivalenceScene(ctx) {
    var valueX = 1, checkedRows = [], found = false;
    ctx.draw('<rect x="14" y="12" width="180" height="100" rx="14" fill="' + PAL.soft + '" stroke="' + PAL.line + '"/>'
      + '<rect x="208" y="12" width="180" height="100" rx="14" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '"/>'
      + mathText(104, 47, '5x + 5', 25) + mathText(298, 47, '3x + 7', 25)
      + mathText(104, 89, '10', 28, PAL.dark, 'valueA') + mathText(298, 89, '10', 28, PAL.ink, 'valueB'));
    var comparisonBox = ctx.extra('<div class="stepper" dir="ltr"><div class="unit">'
      + '<button type="button" id="xLess" aria-label="הקטן את איקס">−</button>'
      + '<span class="var math" dir="ltr">x = <span id="chosenX">1</span></span>'
      + '<button type="button" id="xMore" aria-label="הגדל את איקס">+</button></div></div>'
      + '<table style="width:100%;border-collapse:collapse;text-align:center;margin-top:10px;font-size:16px" dir="ltr" aria-label="טבלת ערכי הביטויים">'
      + '<thead><tr><th style="padding:6px">' + mathHtml('x') + '</th><th style="padding:6px">' + mathHtml('5x + 5') + '</th><th style="padding:6px">' + mathHtml('3x + 7') + '</th></tr></thead>'
      + '<tbody id="comparisonRows"></tbody></table><div id="lawProof" hidden style="text-align:center;line-height:1.7;font-size:14px">לעומת זאת, לפי חוק הפילוג:<br>'
      + mathHtml('5(x + 1) = 5x + 5') + '<br>השוויון הזה נכון לכל ערך של ' + mathHtml('x') + '.</div>');
    function updateComparison() {
      comparisonBox.querySelector('#chosenX').textContent = signedNum(valueX);
      ctx.el('valueA').textContent = signedNum(5 * valueX + 5);
      ctx.el('valueB').textContent = signedNum(3 * valueX + 7);
      comparisonBox.querySelector('#xLess').disabled = valueX === -3;
      comparisonBox.querySelector('#xMore').disabled = valueX === 5;
      var displayRows = checkedRows.slice();
      if (displayRows.indexOf(valueX) < 0) displayRows.push(valueX);
      comparisonBox.querySelector('#comparisonRows').innerHTML = displayRows.map(function (x) {
        return '<tr style="background:' + (x === 1 ? PAL.soft : PAL.goodSoft) + '"><td style="padding:7px">' + mathHtml(signedNum(x))
          + '</td><td>' + mathHtml(signedNum(5 * x + 5)) + '</td><td>' + mathHtml(signedNum(3 * x + 7)) + '</td></tr>';
      }).join('');
      ctx.caption(m('x = ' + signedNum(valueX)));
    }
    function changeX(delta) {
      valueX = Math.max(-3, Math.min(5, valueX + delta));
      ctx.sfx('tick');
      updateComparison();
      if (!found) ctx.note('עכשיו בדוק את ההצבה שבחרת. האם הערכים שונים?');
    }
    comparisonBox.querySelector('#xLess').addEventListener('click', function () { changeX(-1); });
    comparisonBox.querySelector('#xMore').addEventListener('click', function () { changeX(1); });
    ctx.button('בדוק את ההצבה', function () {
      if (checkedRows.indexOf(valueX) < 0) checkedRows.push(valueX);
      updateComparison();
      if (valueX === 1) {
        ctx.note('שניהם נותנים ' + m('10') + ', אבל הצבה אחת לא מוכיחה שקילות. נסה ערך אחר של ' + m('x') + '.');
        ctx.sfx('error');
        return;
      }
      found = true;
      ctx.note('מצאת דוגמה נגדית: ב־' + m('x = ' + signedNum(valueX)) + ' מתקבלים ' + m(signedNum(5 * valueX + 5)) + ' ו־' + m(signedNum(3 * valueX + 7)) + '. לכן הביטויים אינם שקולים.', 'good');
      comparisonBox.querySelector('#lawProof').hidden = false;
      ctx.set({ counterexample: valueX });
      ctx.sfx('correct');
      ctx.solved();
    }, { id: 'checkX', target: 'checkX' });
    checkedRows.push(1);
    updateComparison();
    ctx.note('ראית שב־' + m('x = 1') + ' שניהם נותנים ' + m('10') + '. מצא ערך אחר שבו הם שונים, ובדוק.');
  }

  var steps = [
    {
      mode: 'intro', tA: 'מעבדת הביטויים השקולים',
      sub: 'פותחים סוגריים, ממיינים איברים ובודקים שקילות.',
      tip: 'שלום, אני אליהו. בוא נגלה איך ביטוי משנה צורה בלי לשנות את הערך.',
      emoji: '🧪', eq: m('3(x + 2) + 2x − 1 = 5x + 5'),
      note: 'ביטויים שקולים נותנים אותו ערך לכל הצבה של ' + m('x') + '. הכרטיסים מייצגים איברים, לא אורכים.',
      cue: 'המעבדה מוכנה', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'פותחים חבילות',
      sub: m('3(x + 2)') + ' פירושו שלוש חבילות של אותו סכום.',
      tip: 'פתח חבילה בכל לחיצה. בדוק מה יוצא מכל אחת.',
      cue: 'פתח את שלוש החבילות', cueDone: 'המכפיל פועל על שני האיברים. המשך ←', btn: 'המשך ←',
      aspect: [402, 258], alt: 'שלוש חבילות של כרטיסי איברים. בכל חבילה כרטיס איקס וכרטיס ועוד שתיים.',
      nudge: { target: 'openBundle', text: 'לחץ על פתח חבילה וראה את שני האיברים.' }, setup: bundlesScene
    },
    {
      mode: 'quiz', tA: 'פתח סוגריים', tM: '4(x + 3)',
      sub: 'איזה ביטוי שקול מתקבל?', tip: 'המכפיל שמחוץ לסוגריים פועל על כל איבר שבפנים.', btn: 'המשך ←',
      win: 'בדיוק. כופלים גם את האיבר עם איקס וגם את המספר.', wrongSay: 'בדוק אם כפלת את שני האיברים.',
      opts: [
        { t: '4x + 12', c: true, f: 'נכון: ' + m('4 · x = 4x') + ' וגם ' + m('4 · 3 = 12') + '.' },
        { t: '4x + 3', f: 'כפלת רק את האיבר הראשון. גם ' + m('3') + ' צריך להיות מוכפל ב־' + m('4') + '.' },
        { t: '4x + 7', f: 'חיברת ' + m('4 + 3') + ' במקום לכפול ' + m('4 · 3') + '.' },
        { t: 'x + 12', f: 'כפלת את המספר, אבל שכחת לכפול גם את ' + m('x') + ' ב־' + m('4') + '.' }
      ],
      hints: ['דמיין ארבע חבילות זהות. מה יש בכל אחת?', 'כתוב בנפרד ' + m('4 · x') + ' ו־' + m('4 · 3') + '.', 'ארבע פעמים שלוש הן ' + m('12') + '. אל תשכח גם את המקדם של ' + m('x') + '.']
    },
    {
      mode: 'scene', tA: 'ממיינים איברים',
      sub: 'בחר כרטיס בלחיצה או במקלדת, ואז בחר את המגש שלו.',
      tip: 'איברי איקס במגש אחד, מספרים במגש אחר. הסימן נשאר עם הכרטיס.',
      cue: 'מיין את כל ארבעת הכרטיסים', cueDone: 'כינסת רק איברים דומים. המשך ←', btn: 'המשך ←',
      aspect: [402, 324], alt: 'ארבעה כרטיסים: שלוש איקס, ועוד שש, ועוד שתי איקס ומינוס אחת. מגש לאיברי איקס ומגש למספרים.',
      nudge: { target: 'scene', text: 'בחר כרטיס, ואז לחץ על כפתור המגש המתאים.' }, setup: sortScene
    },
    {
      mode: 'quiz', tA: 'כנס איברים דומים', tM: '7x − 3 + 2 − 4x',
      sub: 'מה הביטוי המצומצם?', tip: 'קח עם כל איבר את הסימן שלפניו.', btn: 'המשך ←',
      win: 'יפה. כינסת איקס עם איקס ומספרים עם מספרים.', wrongSay: 'בדוק את הסימנים לפני שתכנס.',
      opts: [
        { t: '3x − 1', c: true, f: 'נכון: ' + m('7x − 4x = 3x') + ' ו־' + m('−3 + 2 = −1') + '.' },
        { t: '11x − 1', f: 'איבדת את המינוס של ' + m('−4x') + '. צריך לחסר ארבע איקס, לא להוסיף.' },
        { t: '3x − 5', f: 'הפכת את ' + m('+2') + ' לשלילי. כאן ' + m('−3 + 2 = −1') + ', לא ' + m('−5') + '.' },
        { t: '2x', f: 'כינסת איברים לא דומים. המספרים הקבועים אינם איברי ' + m('x') + ' ולא משנים את המקדם שלו.' }
      ],
      hints: ['מיין בראש לשתי קבוצות, עם הסימנים.', 'חשב בנפרד ' + m('7 − 4') + ' ו־' + m('−3 + 2') + '.', 'מקדם האיקס הוא ' + m('3') + '. הסכום של המספרים שלילי וקרוב לאפס.']
    },
    {
      mode: 'scene', tA: 'בדיקת שקילות',
      sub: 'התאמה בהצבה אחת אינה הוכחה. חפש הצבה שבה הביטויים שונים.',
      tip: 'שניהם נותנים עשר כשאיקס שווה אחת. האם זה מספיק? בדוק ערך אחר.',
      cue: 'בחר ערך אחר ובדוק את ההצבה', cueDone: 'דוגמה נגדית אחת מפריכה שקילות. המשך ←', btn: 'המשך ←',
      aspect: [402, 126], alt: 'שני ביטויים: חמש איקס ועוד חמש ושלוש איקס ועוד שבע. בהתחלה ערך שניהם עשר.',
      nudge: { target: 'checkX', text: 'שנה את איקס בכפתור פלוס או מינוס, ואז בדוק.' }, setup: equivalenceScene
    },
    {
      mode: 'quiz', tA: 'איזה ביטוי שקול?',
      sub: 'בחר ביטוי שקול ל־' + m('5x + 5') + ' לכל ערך של ' + m('x') + '.', tip: 'אפשר להשתמש בחוק הפילוג גם בכיוון ההפוך.', btn: 'המשך ←',
      win: 'בדיוק. חמש הוא גורם משותף לשני האיברים.', wrongSay: 'פתח את הסוגריים של האפשרות שבחרת ובדוק.',
      opts: [
        { t: '5(x + 1)', c: true, f: 'נכון: לפי חוק הפילוג ' + m('5(x + 1) = 5x + 5') + ', לכל ' + m('x') + '.' },
        { t: '5(x + 5)', f: 'המכפיל פועל גם על החמש שבסוגריים. מתקבל ' + m('5x + 25') + ', לא ' + m('5x + 5') + '.' },
        { t: '10x', f: 'חיברת איברים לא דומים. ' + m('5') + ' אינו ' + m('5x') + ', ולכן אי אפשר לכנס אותם ל־' + m('10x') + '.' },
        { t: '5x + 1', f: 'המספר הקבוע השתנה מחמש לאחת. זה משנה את ערך הביטוי בכל הצבה.' }
      ],
      hints: ['איזה מספר כופל כל אחד משני האיברים?', 'אם מוציאים ' + m('5') + ' כגורם משותף, מה נשאר מכל איבר?', 'מהמספר הקבוע נשאר ' + m('1') + ' בתוך הסוגריים.']
    },
    {
      mode: 'quiz', tA: 'האם ההצבה של דנה מספיקה?',
      sub: 'דנה הציבה ' + m('x = 1') + ' ב־' + m('3x + 7') + ' וב־' + m('5x + 5') + '. בשניהם קיבלה ' + m('10') + '. האם הם שקולים?',
      tip: 'שקילות דורשת אותו ערך בכל הצבה, לא רק בהצבה אחת.', btn: 'לסיכום ←',
      win: 'נכון. דוגמה נגדית אחת מספיקה כדי להפריך שקילות.', wrongSay: 'בדוק אם אפשר למצוא הצבה שבה הערכים שונים.',
      opts: [
        { t: 'לא. ב־' + m('x = 2') + ' מתקבלים ' + m('13') + ' ו־' + m('15') + '.', c: true, f: 'נכון: ' + m('3 · 2 + 7 = 13') + ' ואילו ' + m('5 · 2 + 5 = 15') + '. ערכים שונים מפריכים שקילות.' },
        { t: 'כן, הצבה אחת מספיקה.', f: 'הצבה אחת בודקת ערך אחד בלבד. שקילות חייבת להתקיים לכל ערך של ' + m('x') + '.' },
        { t: 'כן, בשניהם יש ' + m('x') + '.', f: 'אותו משתנה אינו מספיק. המקדמים והמספרים הקבועים משפיעים על הערכים.' },
        { t: 'אי אפשר לדעת.', f: 'ההצבה של דנה לבדה אינה מספיקה, אבל יש דרך להכריע: למשל בהצבת ' + m('x = 2') + ' הערכים שונים.' }
      ],
      hints: ['נסה עוד הצבה, וחפש הבדל בין הערכים.', 'הצב ' + m('x = 2') + ' בשני הביטויים.', 'בביטוי הראשון מתקבל ' + m('13') + '. האם גם בשני?']
    },
    {
      mode: 'finish', tA: 'סיימת את מעבדת הביטויים',
      sub: 'פילוג על כל איבר, כינוס רק של דומים, ודוגמה נגדית לבדיקת שקילות.',
      tip: 'כל הכבוד. עכשיו אתה משנה צורה של ביטוי וגם יודע להסביר למה זה חוקי.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'הכללים שגילית:',
      formula: m('a(b + c) = ab + ac') + ' — מכנסים רק איברים דומים.'
    }
  ];

  window.NoamGame.boot({
    slug: 'bituyim-shkulim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'פילוג על שני איברים', math: '4(x + 3)' },
      { step: 4, name: 'כינוס עם סימנים', math: '3x − 1' },
      { step: 6, name: 'זיהוי ביטוי שקול', math: '5(x + 1)' },
      { step: 7, name: 'דוגמה נגדית', math: '13 ≠ 15' }
    ],
    bonus: {
      label: 'מכונת הביטויים', closeLabel: 'סגור את המכונה', hint: 'בחר את מקדם האיקס ואת המספר הקבוע, ואז בדוק.',
      setup: function (box, ctx) {
        var bonusData, coefficientGuess = 0, constantGuess = 0;
        box.innerHTML = '<div class="bTitle">מכונת הביטויים</div><div class="bSub">פתח סוגריים וכנס איברים. בחר מקדם ומספר קבוע.</div>'
          + '<div class="bChip math" data-expression dir="ltr" style="max-width:100%;font-size:19px;padding:8px 10px"></div>'
          + '<div class="stepper"><div class="unit"><span style="font-size:12px">מקדם איקס</span><button type="button" data-coeff="-1" aria-label="הקטן מקדם">−</button><span class="var math" data-coeff-value dir="ltr">0</span><button type="button" data-coeff="1" aria-label="הגדל מקדם">+</button></div>'
          + '<div class="unit"><span style="font-size:12px">מספר קבוע</span><button type="button" data-constant="-1" aria-label="הקטן קבוע">−</button><span class="var math" data-constant-value dir="ltr">0</span><button type="button" data-constant="1" aria-label="הגדל קבוע">+</button></div></div>'
          + '<div class="bForms" data-guess dir="ltr"></div><div class="bForms" data-solution dir="ltr" hidden></div><div class="bOk" data-bonus-note hidden></div>'
          + '<button type="button" class="bDice" data-bonus-check>בדוק</button><button type="button" class="bDice" data-bonus-roll>ביטוי חדש ↻</button>';
        function refreshGuess() {
          box.querySelector('[data-coeff-value]').textContent = signedNum(coefficientGuess);
          box.querySelector('[data-constant-value]').textContent = signedNum(constantGuess);
          box.querySelector('[data-guess]').textContent = 'הבחירה שלך: ';
          box.querySelector('[data-guess]').dir = 'rtl';
          box.querySelector('[data-guess]').insertAdjacentHTML('beforeend', mathHtml(simplifiedText(coefficientGuess, constantGuess)));
          box.querySelector('[data-bonus-note]').hidden = true;
          box.querySelector('[data-solution]').hidden = true;
        }
        function newExpression() {
          bonusData = { a: 2 + Math.floor(Math.random() * 4), b: Math.floor(Math.random() * 8) - 3, c: Math.floor(Math.random() * 8) - 3, d: Math.floor(Math.random() * 11) - 5 };
          var cPart = bonusData.c === 0 ? '' : bonusData.c < 0 ? ' − ' + variableTerm(-bonusData.c) : ' + ' + variableTerm(bonusData.c);
          box.querySelector('[data-expression]').textContent = bonusData.a + '(x' + constantTail(bonusData.b) + ')' + cPart + constantTail(bonusData.d);
          coefficientGuess = 0;
          constantGuess = 0;
          refreshGuess();
        }
        box.querySelectorAll('[data-coeff]').forEach(function (control) {
          control.addEventListener('click', function () { coefficientGuess = Math.max(-30, Math.min(30, coefficientGuess + Number(control.getAttribute('data-coeff')))); refreshGuess(); ctx.sfx('tick'); });
        });
        box.querySelectorAll('[data-constant]').forEach(function (control) {
          control.addEventListener('click', function () { constantGuess = Math.max(-30, Math.min(30, constantGuess + Number(control.getAttribute('data-constant')))); refreshGuess(); ctx.sfx('tick'); });
        });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var correctCoefficient = bonusData.a + bonusData.c;
          var correctConstant = bonusData.a * bonusData.b + bonusData.d;
          var bonusNote = box.querySelector('[data-bonus-note]');
          bonusNote.hidden = false;
          if (coefficientGuess === correctCoefficient && constantGuess === correctConstant) {
            bonusNote.textContent = 'נכון. פילגת על שני האיברים וכינסת רק איברים דומים.';
            bonusNote.style.color = PAL.good;
            box.querySelector('[data-solution]').textContent = simplifiedText(correctCoefficient, correctConstant);
            box.querySelector('[data-solution]').hidden = false;
            ctx.sfx('correct');
          } else {
            bonusNote.textContent = coefficientGuess !== correctCoefficient ? 'כנס את שני מקדמי האיקס, עם הסימנים שלהם.' : 'למספר הקבוע: קודם כפול את המספר שבסוגריים, ואז הוסף את המספר שמחוץ להם.';
            bonusNote.style.color = PAL.ink;
            ctx.sfx('error');
          }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { newExpression(); ctx.sfx('click'); });
        newExpression();
      }
    }
  });
}());
