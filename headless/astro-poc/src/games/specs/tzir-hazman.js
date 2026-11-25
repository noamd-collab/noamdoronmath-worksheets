/** ציר הזמן — three verified space milestones; dates and design in the source note. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c', MUTED = '#475569';
  var EVENTS = [
    { title: 'שיגור ספוטניק', short: 'ספוטניק', year: 1957 },
    { title: 'טיסת גגארין', short: 'גגארין', year: 1961 },
    { title: 'נחיתת אפולו', short: 'אפולו', year: 1969 }
  ];
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function mathSvg(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 18) + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function hebSvg(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-weight="700" font-size="' + (size || 15) + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function keyRoute(handle, getValue, setValue, commit, low, high) {
    handle.addEventListener('keydown', function (event) {
      var delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (delta) { event.preventDefault(); setValue(getValue() + delta); }
      else if (event.key === 'Home') { event.preventDefault(); setValue(low); }
      else if (event.key === 'End') { event.preventDefault(); setValue(high); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(); }
    });
  }
  function controls(ctx, prefix, label, getValue, setValue, commit) {
    var boxNode = ctx.extra('<div class="sceneStrip"><b>' + label + '</b><span dir="ltr" data-choice aria-live="polite"></span></div>'
      + '<div class="stepper" dir="ltr" style="margin-top:8px"><div class="unit">'
      + '<button type="button" id="' + prefix + 'Less" aria-label="צעד שמאלה, מוקדם יותר">←</button>'
      + '<span dir="rtl" style="font-size:13px;font-weight:700">צעד אחד</span>'
      + '<button type="button" id="' + prefix + 'More" aria-label="צעד ימינה, מאוחר יותר">→</button></div></div>');
    boxNode.querySelector('#' + prefix + 'Less').addEventListener('click', function () { setValue(getValue() - 1); });
    boxNode.querySelector('#' + prefix + 'More').addEventListener('click', function () { setValue(getValue() + 1); });
    ctx.button('אשר מיקום', commit, { id: prefix + 'Commit', target: prefix + 'Commit' });
    return boxNode.querySelector('[data-choice]');
  }
  function satellite() {
    return '<g stroke="' + PAL.dark + '" stroke-width="2" fill="none" aria-hidden="true"><circle cx="53" cy="50" r="16" fill="' + PAL.soft + '"/><path d="M40 40 L23 23 M66 40 L84 21 M40 60 L20 76 M66 60 L83 78"/></g>';
  }
  function orderScene(ctx) {
    var deck = [2, 0, 1], activeCard = 0, selectedSlot = 1, placedCards = [null, null, null], completed = false;
    var slotX = [76, 201, 326], slotNames = ['המוקדם', 'האמצעי', 'המאוחר'];
    var markup = hebSvg(201, 22, 'סדר בלבד — הרווחים אינם מייצגים שנים', 13, MUTED);
    for (var i = 0; i < 3; i++) {
      markup += '<rect id="orderSlot' + i + '" x="' + (slotX[i] - 56) + '" y="174" width="112" height="88" rx="13" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
        + hebSvg(slotX[i], 161, slotNames[i], 14, PAL.dark)
        + hebSvg(slotX[i], 207, '', 14, PAL.ink, 'placedName' + i)
        + mathSvg(slotX[i], 241, '', 22, PAL.dark, 'placedYear' + i);
    }
    markup += '<path d="M30 282 H371 L363 277 M371 282 L363 287" stroke="' + PAL.dark + '" stroke-width="2" fill="none"/>'
      + hebSvg(201, 310, 'השנים גדלות משמאל לימין', 14, MUTED)
      + '<g id="orderHandle" tabindex="0" role="slider" aria-label="כרטיס אירוע; חיצים בוחרים מקום, Enter או רווח מאשרים" aria-valuemin="1" aria-valuemax="3" aria-valuenow="2" style="cursor:grab">'
      + '<rect x="111" y="45" width="180" height="76" rx="14" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="3"/>'
      + hebSvg(201, 74, '', 17, PAL.ink, 'orderName') + mathSvg(201, 107, '', 25, PAL.dark, 'orderYear') + '</g>';
    ctx.draw(markup);
    var cardHandle = ctx.el('orderHandle');
    var orderReadout = controls(ctx, 'order', 'המקום שבחרת', function () { return selectedSlot; }, selectSlot, commitOrder);
    function renderOrder() {
      cardHandle.setAttribute('transform', 'translate(0 0)');
      cardHandle.setAttribute('aria-valuenow', selectedSlot + 1);
      cardHandle.setAttribute('aria-valuetext', slotNames[selectedSlot]);
      cardHandle.setAttribute('aria-label', (completed ? 'כל האירועים מוקמו' : EVENTS[deck[activeCard]].title) + '; חיצים בוחרים מקום, Enter או רווח מאשרים');
      ctx.el('orderName').textContent = completed ? 'סידרת את האירועים' : EVENTS[deck[activeCard]].title;
      ctx.el('orderYear').textContent = completed ? '1957 < 1961 < 1969' : EVENTS[deck[activeCard]].year;
      ctx.el('orderYear').setAttribute('font-size', completed ? 16 : 25);
      for (var j = 0; j < 3; j++) {
        var eventIndex = placedCards[j];
        ctx.el('orderSlot' + j).setAttribute('stroke', completed || eventIndex !== null ? PAL.good : j === selectedSlot ? PAL.dark : PAL.line);
        ctx.el('orderSlot' + j).setAttribute('stroke-width', j === selectedSlot ? 4 : 2);
        ctx.el('orderSlot' + j).setAttribute('fill', eventIndex !== null ? PAL.goodSoft : j === selectedSlot ? PAL.warmSoft : '#fff');
        ctx.el('placedName' + j).textContent = eventIndex !== null ? EVENTS[eventIndex].short : '';
        ctx.el('placedYear' + j).textContent = eventIndex !== null ? EVENTS[eventIndex].year : '';
      }
      orderReadout.textContent = slotNames[selectedSlot];
    }
    function selectSlot(value) {
      if (completed) return;
      selectedSlot = clamp(value, 0, 2); ctx.sfx('tick'); renderOrder();
      ctx.note('בחרת את המקום ' + slotNames[selectedSlot] + '. אשר בכפתור, ב־Enter או ברווח.');
    }
    function commitOrder() {
      if (completed) return;
      var itemIndex = deck[activeCard];
      if (selectedSlot !== itemIndex) {
        ctx.sfx('error');
        var compareYear = EVENTS[selectedSlot].year;
        ctx.note(EVENTS[itemIndex].title + ' בשנת ' + m(String(EVENTS[itemIndex].year)) + '. '
          + (itemIndex > selectedSlot ? 'בחרת מקום מוקדם מדי: השנה הזו גדולה מ־' : 'בחרת מקום מאוחר מדי: השנה הזו קטנה מ־')
          + m(String(compareYear)) + '. סדר לפי השנים, לא לפי סדר הכרטיסים.');
        return;
      }
      placedCards[selectedSlot] = itemIndex; activeCard += 1; ctx.sfx('correct');
      if (activeCard === 3) {
        completed = true;
        ctx.note('נכון: ספוטניק, גגארין, אפולו. ' + m('1957 < 1961 < 1969') + '. קודם השנה הקטנה יותר.', 'good');
        ctx.solved();
      } else {
        selectedSlot = 1;
        ctx.note('הכרטיס במקום הנכון. עכשיו מקם את ' + EVENTS[deck[activeCard]].title + '.', 'good');
      }
      renderOrder();
    }
    keyRoute(cardHandle, function () { return selectedSlot; }, selectSlot, commitOrder, 0, 2);
    ctx.drag(cardHandle, {
      move: function (x, y) {
        if (completed) return;
        selectedSlot = clamp(Math.round((x - 76) / 125), 0, 2);
        renderOrder();
        cardHandle.setAttribute('transform', 'translate(' + (clamp(x, 90, 312) - 201) + ' ' + (clamp(y, 60, 246) - 83) + ')');
      },
      end: function () { commitOrder(); renderOrder(); }
    });
    renderOrder(); ctx.note('מקם את נחיתת אפולו ביחס לשני האירועים האחרים. הכרטיסים מגיעים בסדר מעורב.');
  }
  function axisX(index) { return 50 + 37.75 * index; }
  function timelineBase() {
    var html = satellite() + hebSvg(239, 46, 'אבני דרך בחלל', 20, PAL.dark)
      + hebSvg(239, 73, 'כל רווח שווה שתי שנים', 14, MUTED)
      + '<path d="M50 174 H364 L357 169 M364 174 L357 179" fill="none" stroke="' + PAL.dark + '" stroke-width="3"/>';
    for (var k = 0; k <= 8; k++) {
      html += '<line x1="' + axisX(k) + '" y1="164" x2="' + axisX(k) + '" y2="181" stroke="' + PAL.ink + '" stroke-width="2"/>'
        + mathSvg(axisX(k), k % 2 ? 216 : 197, String(1955 + k * 2), 13, PAL.ink);
    }
    return html;
  }
  function locatorMarkup(id, label, low, high, value) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '; חיצים משנים, Enter או רווח מאשרים" aria-valuemin="' + low + '" aria-valuemax="' + high + '" aria-valuenow="' + value + '" style="cursor:grab">'
      + '<rect x="-32" y="-32" width="64" height="64" rx="12" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="3"/>'
      + mathSvg(0, 7, '', 17, PAL.dark, id + 'Year') + '</g>';
  }
  function timeScene(ctx) {
    var selectedTick = 1, finishedTime = false;
    ctx.draw(timelineBase() + hebSvg(201, 121, 'מקם את טיסת גגארין', 18, PAL.ink)
      + '<line id="timeLine" y1="175" y2="245" stroke="' + PAL.main + '" stroke-width="2" stroke-dasharray="4 3"/>'
      + locatorMarkup('timeHandle', 'השנה שבחרת עבור גגארין', 1955, 1971, 1957));
    var timeHandle = ctx.el('timeHandle');
    var timeReadout = controls(ctx, 'time', 'השנה שבחרת', function () { return selectedTick; }, setTick, commitTime);
    function renderTime() {
      var chosenYear = 1955 + selectedTick * 2;
      timeHandle.setAttribute('transform', 'translate(' + axisX(selectedTick) + ' 268)');
      timeHandle.setAttribute('aria-valuenow', chosenYear);
      timeHandle.setAttribute('aria-valuetext', chosenYear + ' — השנה שבחרת');
      ctx.el('timeHandleYear').textContent = chosenYear;
      ctx.el('timeLine').setAttribute('x1', axisX(selectedTick)); ctx.el('timeLine').setAttribute('x2', axisX(selectedTick));
      timeReadout.textContent = chosenYear;
      ctx.caption(m('1955 + ' + selectedTick + ' × 2 = ' + chosenYear));
    }
    function setTick(value) {
      selectedTick = clamp(value, 0, 8); ctx.sfx('tick'); renderTime();
      ctx.note('הידית בשנת ' + m(String(1955 + selectedTick * 2)) + '. כל צעד משנה שתי שנים. אשר כדי לבדוק.');
    }
    function commitTime() {
      var chosenYear = 1955 + selectedTick * 2;
      if (chosenYear === 1961) {
        ctx.note('בדיוק: טיסת גגארין בשנת ' + m('1961') + '. מההתחלה שלושה רווחים: ' + m('1955 + 3 × 2 = 1961') + '.', 'good');
        ctx.sfx('correct'); if (!finishedTime) { finishedTime = true; ctx.solved(); }
      } else {
        ctx.sfx('error');
        ctx.note(chosenYear === 1957 ? 'זה המקום של ספוטניק, לא של גגארין. גגארין בשנת ' + m('1961') + ', שתי קפיצות נוספות של שתי שנים.'
          : (chosenYear < 1961 ? 'מוקדם מדי. ' : 'מאוחר מדי. ') + 'טיסת גגארין בשנת ' + m('1961') + '. אל תספור כל רווח כשנה אחת: כל רווח שווה ' + m('2') + ' שנים.');
      }
    }
    keyRoute(timeHandle, function () { return selectedTick; }, setTick, commitTime, 0, 8);
    ctx.drag(timeHandle, { move: function (x) { setTick(Math.round((x - 50) / 37.75)); }, end: commitTime });
    renderTime(); ctx.note('הציר מתחיל בשנת ' + m('1955') + '. טיסת גגארין בשנת ' + m('1961') + '. מצא את הסימון המתאים.');
  }
  function spanScene(ctx) {
    var selectedSpan = 2, finishedSpan = false;
    ctx.draw(timelineBase() + '<g id="spanBlocks"></g>'
      + '<line x1="' + axisX(1) + '" y1="119" x2="' + axisX(1) + '" y2="175" stroke="' + PAL.good + '" stroke-width="3"/>'
      + hebSvg(axisX(1), 109, 'ספוטניק', 14, PAL.good)
      + '<line x1="' + axisX(7) + '" y1="119" x2="' + axisX(7) + '" y2="175" stroke="' + PAL.dark + '" stroke-width="3"/>'
      + hebSvg(axisX(7), 109, 'אפולו', 14, PAL.dark)
      + '<line id="spanLine" y1="174" y2="240" stroke="' + PAL.main + '" stroke-width="2" stroke-dasharray="4 3"/>'
      + locatorMarkup('spanHandle', 'קצה הקטע; מספר רווחים מספוטניק', 0, 7, 2));
    var spanHandle = ctx.el('spanHandle');
    var spanReadout = controls(ctx, 'span', 'מספר רווחים מספוטניק', function () { return selectedSpan; }, setSpan, commitSpan);
    function renderSpan() {
      var endpoint = axisX(1 + selectedSpan), blocks = '';
      for (var c = 0; c < selectedSpan; c++) {
        blocks += '<rect x="' + (axisX(1 + c) + 1) + '" y="137" width="35.75" height="24" rx="3" fill="' + (c % 2 ? PAL.warm : PAL.line) + '"/>';
      }
      ctx.el('spanBlocks').innerHTML = blocks;
      spanHandle.setAttribute('transform', 'translate(' + endpoint + ' 266)');
      spanHandle.setAttribute('aria-valuenow', selectedSpan);
      spanHandle.setAttribute('aria-valuetext', selectedSpan + ' רווחים, הפרש ' + selectedSpan * 2 + ' במספרי השנים');
      ctx.el('spanHandleYear').textContent = 1957 + selectedSpan * 2;
      ctx.el('spanLine').setAttribute('x1', endpoint); ctx.el('spanLine').setAttribute('x2', endpoint);
      spanReadout.textContent = selectedSpan;
      ctx.caption(m(selectedSpan + ' × 2 = ' + selectedSpan * 2) + ' — הפרש במספרי השנים');
    }
    function setSpan(value) {
      selectedSpan = clamp(value, 0, 7); ctx.sfx('tick'); renderSpan();
      ctx.note('צבעת ' + m(String(selectedSpan)) + ' רווחים. סופרים את הרווחים בין הסימונים, לא את סימוני הקצה. אשר כדי לבדוק.');
    }
    function commitSpan() {
      if (selectedSpan === 6) {
        ctx.note('נכון: שישה רווחים, שתי שנים בכל רווח. ' + m('6 × 2 = 12') + ', וגם ' + m('1969 − 1957 = 12') + '. זה הפרש במספרי השנים.', 'good');
        ctx.sfx('correct'); if (!finishedSpan) { finishedSpan = true; ctx.solved(); }
      } else {
        ctx.sfx('error');
        ctx.note(selectedSpan === 7 ? 'ספרת שבעה סימונים במקום שישה רווחים. הסימון הראשון הוא נקודת ההתחלה, לא רווח שעבר.'
          : selectedSpan === 4 ? 'ארבעה רווחים נותנים ' + m('4 × 2 = 8') + '. כאן מתחילים בספוטניק, לא בגגארין. מתח את הקטע עד אפולו.'
          : 'הקטע ' + (selectedSpan < 6 ? 'קצר מדי' : 'ארוך מדי') + '. התחל בספוטניק וסיים באפולו. כל רווח שווה ' + m('2') + ' שנים.');
      }
    }
    keyRoute(spanHandle, function () { return selectedSpan; }, setSpan, commitSpan, 0, 7);
    ctx.drag(spanHandle, { move: function (x) { setSpan(Math.round((x - axisX(1)) / 37.75)); }, end: commitSpan });
    renderSpan(); ctx.note('התחל בשנת ' + m('1957') + ' ומתח את הקטע עד שנת ' + m('1969') + '. כמה רווחים יש ביניהן?');
  }
  function factsPicture(ctx) {
    var html = '';
    EVENTS.forEach(function (eventItem, index) {
      var xx = 76 + index * 125;
      html += '<rect x="' + (xx - 56) + '" y="22" width="112" height="83" rx="13" fill="' + PAL.soft + '" stroke="' + PAL.line + '"/>'
        + hebSvg(xx, 53, eventItem.short, 16, PAL.ink) + mathSvg(xx, 88, String(eventItem.year), 23, PAL.dark);
    });
    ctx.draw(html);
  }
  var steps = [
    { mode: 'intro', tA: 'ציר הזמן', sub: 'מסדרים אבני דרך בחלל ומשווים הפרשים בין שנים.',
      tip: 'שלום, אני אליהו. בוא נסדר שלוש אבני דרך בחלל, ונגלה מה המרחק בין השנים.',
      emoji: '🛰️', eq: m('1957 < 1961 < 1969'),
      note: 'ספוטניק שוגר בשנת ' + m('1957') + ', גגארין טס בשנת ' + m('1961') + ', ואפולו נחתה על הירח בשנת ' + m('1969') + '. נשתמש בשנים, לא בתאריך היום והחודש.',
      cue: 'מוכן לצאת למסע?', btn: 'בוא נתחיל ←' },
    { mode: 'scene', tA: 'מי היה קודם?', sub: 'מקם כל כרטיס בגרירה, בכפתורים או בחיצים. בחיצים בוחרים, ב־Enter או ברווח מאשרים.',
      tip: 'השנה הקטנה יותר באה קודם. כאן מסדרים בלבד; הרווחים אינם קנה מידה.',
      aspect: [402, 328], alt: 'שלושה מקומות לסידור אירועים משמאל לימין: מוקדם, אמצעי ומאוחר; כרטיס עם אירוע ושנה',
      cue: 'מקם את כל שלושת האירועים', cueDone: 'כל האירועים בסדר הנכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'orderCommit', text: 'בחר מקום בכפתורי החצים ואז אשר מיקום.' }, setup: orderScene },
    { mode: 'quiz', tA: 'מה קדם לטיסת גגארין?', sub: 'הטיסה הייתה בשנת ' + m('1961') + '. בחר אירוע מוקדם ממנה.',
      tip: 'השווה את השנים, לא את סדר הופעת הכרטיסים.', btn: 'המשך ←', aspect: [402, 126], alt: 'ספוטניק בשנת 1957, גגארין בשנת 1961 ואפולו בשנת 1969', setup: factsPicture,
      win: 'נכון. שנה קטנה יותר מציינת אירוע מוקדם יותר.', wrongSay: 'קודם פירושו שנה קטנה יותר.',
      opts: [
        { t: 'נחיתת אפולו', f: 'אפולו בשנת ' + m('1969') + ' מאוחרת מ־' + m('1961') + '. הפכת בין לפני ואחרי.' },
        { t: 'שיגור ספוטניק', c: true, f: 'נכון: ' + m('1957 < 1961') + '. ספוטניק שוגר לפני טיסת גגארין.' },
        { t: 'טיסת גגארין', f: 'זה אותו אירוע, באותה שנה. אירוע אינו קודם לעצמו.' },
        { t: 'שום אירוע', f: 'יש ברשימה שנה קטנה מ־' + m('1961') + '. צריך להשוות שנים, לא רק לזהות את גגארין.' }
      ], hints: ['מצא את השנה של כל אירוע.', 'חפש שנה קטנה מ־' + m('1961') + '.', 'שנת ' + m('1957') + ' קטנה משנת ' + m('1961') + '.'] },
    { mode: 'scene', tA: 'מקום על ציר מדורג', sub: 'מקם את גגארין בגרירה, בכפתורים או בחיצים. אשר בכפתור, ב־Enter או ברווח.',
      tip: 'כל רווח הוא שתי שנים. כדי להגיע לגגארין, ספור קפיצות מהשנה שבתחילת הציר.',
      aspect: [402, 306], alt: 'ציר שנים גדל משמאל לימין מ־1955 עד 1971, עם רווחים של שתי שנים וידית בחירת שנה',
      cue: 'מקם את טיסת גגארין בשנה הנכונה', cueDone: 'גגארין במקום הנכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'timeCommit', text: 'כל לחיצה על חץ מזיזה שתי שנים. בחר ואז אשר.' }, setup: timeScene },
    { mode: 'quiz', tA: 'שלושה רווחים מההתחלה', sub: 'הציר מתחיל בשנת ' + m('1955') + '. כל רווח הוא ' + m('2') + ' שנים. לאיזו שנה מגיעים אחרי שלושה רווחים ימינה?',
      tip: 'קודם חשב כמה שנים שווים שלושה רווחים, ואז הוסף לשנת ההתחלה.', btn: 'המשך ←',
      win: 'בדיוק. קנה המידה הופך מספר רווחים למספר שנים.', wrongSay: 'רווח אחד אינו שנה אחת בציר הזה.',
      opts: [
        { t: m('1958'), f: 'הוספת שלוש שנים בלבד. שכחת שכל אחד משלושת הרווחים שווה שתי שנים.' },
        { t: m('1960'), f: 'ספרת את סימון ההתחלה כחלק מהמרחק. מתחילים ב־' + m('1955') + ' ומתקדמים שישה, לא חמישה.' },
        { t: m('1961'), c: true, f: 'נכון: ' + m('3 × 2 = 6') + ', ואז ' + m('1955 + 6 = 1961') + '.' },
        { t: m('1949'), f: 'חיסרת שש שנים במקום להוסיף. ימינה בציר הזה מוביל לשנה מאוחרת יותר.' }
      ], hints: ['בדוק כמה שנים שווה רווח אחד.', 'כפול את מספר הרווחים בשתי שנים.', 'הוסף ' + m('3 × 2 = 6') + ' לשנת ' + m('1955') + '.'] },
    { mode: 'scene', tA: 'מה המרחק בין השנים?', sub: 'מתח קטע מספוטניק עד אפולו בגרירה, בכפתורים או בחיצים. אשר בכפתור, ב־Enter או ברווח.',
      tip: 'סופרים רווחים בין סימונים. אל תספור את סימון ההתחלה כרווח שכבר עבר.',
      aspect: [402, 306], alt: 'ציר משנת 1955 עד 1971, ספוטניק בשנת 1957 ואפולו בשנת 1969, וקטע זמן צבעוני עם קצה שאפשר להזיז',
      cue: 'מתח את הקטע עד אפולו ואשר', cueDone: 'מדדת את ההפרש נכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'spanCommit', text: 'הזז את הקצה עד אפולו. כל רווח צבוע שווה שתי שנים.' }, setup: spanScene },
    { mode: 'quiz', tA: 'הפרש בין שתי שנות אירועים', sub: 'מה ההפרש בין שנת גגארין, ' + m('1961') + ', לשנת אפולו, ' + m('1969') + '?',
      tip: 'חסר את מספר השנה המוקדמת ממספר השנה המאוחרת. אין צורך לספור את סימוני הקצה.', btn: 'המשך ←', aspect: [402, 126], alt: 'שלוש אבני הדרך עם שנות האירועים', setup: factsPicture,
      win: 'נכון. ההפרש הוא השנה המאוחרת פחות המוקדמת.', wrongSay: 'ההפרש אינו סכום השנים, ואינו מספר סימוני הקצה.',
      opts: [
        { t: m('8'), c: true, f: 'נכון: ' + m('1969 − 1961 = 8') + '. זה הפרש בין מספרי השנים.' },
        { t: m('9'), f: 'ספרת גם את שנת ההתחלה כצעד. בין שתי השנים יש שמונה קפיצות של שנה, לא תשע.' },
        { t: m('4'), f: 'זה מספר הרווחים בציר של שתי שנים לרווח. כדי לקבל הפרש שנים צריך ' + m('4 × 2 = 8') + '.' },
        { t: m('3930'), f: 'חיברת את מספרי השנים. כדי למדוד הפרש מחסרים, לא מחברים.' }
      ], hints: ['בחר את השנה הגדולה ואת השנה הקטנה.', 'חסר את המוקדמת מהמאוחרת.', 'חשב ' + m('1969 − 1961') + '.'] },
    { mode: 'quiz', tA: 'משווים שני קטעים', sub: 'מספוטניק לגגארין: ' + m('1961 − 1957 = 4') + '. מגגארין לאפולו: ' + m('1969 − 1961 = 8') + '. מה נכון?',
      tip: 'השווה את ההפרשים, לא את מספר האירועים בכל קטע.', btn: 'לסיכום ←',
      win: 'מעולה. אותם שני אירועי קצה אינם מבטיחים אותו מרחק בזמן.', wrongSay: 'בשני הקטעים שני אירועי קצה, אבל המרחק נקבע לפי השנים.',
      opts: [
        { t: 'שני הקטעים שווים', f: 'בכל קטע יש שני אירועי קצה, אבל ' + m('4 ≠ 8') + '. מספר אירועים אינו אורך קטע בזמן.' },
        { t: 'הקטע מספוטניק לגגארין כפול', f: 'הפכת את ההשוואה: ' + m('4') + ' קטן מ־' + m('8') + ', לא גדול ממנו.' },
        { t: 'הקטע מגגארין לאפולו גדול בשנה אחת', f: 'ספרת אירועים במקום שנים. ההפרש בין אורכי הקטעים הוא ' + m('8 − 4 = 4') + ', לא שנה אחת.' },
        { t: 'הקטע מגגארין לאפולו כפול', c: true, f: 'נכון: ' + m('8 = 2 × 4') + '. ההפרש בין שנות גגארין ואפולו כפול מההפרש בין שנות ספוטניק וגגארין.' }
      ], hints: ['שני אורכי הקטעים כבר נתונים בשאלה.', 'בדוק כמה פעמים ' + m('4') + ' נכנס ב־' + m('8') + '.', m('4 + 4 = 8') + '. איזה קטע כפול?'] },
    { mode: 'finish', tA: 'סיימת את ציר הזמן', sub: 'סדר האירועים נקבע לפי השנים; המרחק נקבע לפי ההפרש וקנה המידה.',
      tip: 'כל הכבוד. עכשיו אתה קורא גם את הסדר וגם את המרחק בין השנים.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:', formula: 'הפרש שנים = מאוחרת פחות מוקדמת' }
  ];
  window.NoamGame.boot({
    slug: 'tzir-hazman', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'לפני ואחרי', math: '1957 < 1961' },
      { step: 4, name: 'קנה מידה של שנים', math: '1955 + 3 × 2 = 1961' },
      { step: 6, name: 'הפרש בין שנים', math: '1969 − 1961 = 8' },
      { step: 7, name: 'השוואת קטעי זמן', math: '8 = 2 × 4' }
    ],
    bonus: {
      label: 'מכונת הפרשי השנים', closeLabel: 'סגור את המכונה', hint: 'קבל שתי שנות אירועים והשווה ביניהן.',
      setup: function (box, ctx) {
        var pairs = [[0, 1], [1, 2], [0, 2]], pairIndex = 0, bonusGuess = 0;
        box.innerHTML = '<div class="bTitle">מכונת הפרשי השנים</div><div class="bSub" data-bonus-sub></div>'
          + '<div class="bChip" dir="ltr" data-bonus-chip></div>'
          + '<div class="stepper" dir="ltr"><div class="unit"><button type="button" data-bonus-d="-1" aria-label="הקטן את ההפרש">−</button>'
          + '<bdi class="var math" dir="ltr" data-bonus-g>0</bdi><button type="button" data-bonus-d="1" aria-label="הגדל את ההפרש">+</button></div></div>'
          + '<div class="bForms" data-bonus-forms hidden></div><div class="bOk" data-bonus-ok role="status" hidden></div>'
          + '<button type="button" class="bDice" data-bonus-check>בדוק הפרש</button><button type="button" class="bDice" data-bonus-roll>זוג שנים חדש ↻</button>';
        function renderBonus() {
          var pairItem = pairs[pairIndex], early = EVENTS[pairItem[0]], late = EVENTS[pairItem[1]];
          box.querySelector('[data-bonus-sub]').textContent = 'מה ההפרש בין שנת ' + early.short + ' לשנת ' + late.short + '?';
          box.querySelector('[data-bonus-chip]').textContent = late.year + ' − ' + early.year + ' = ?';
          box.querySelector('[data-bonus-g]').textContent = bonusGuess;
          box.querySelector('[data-bonus-forms]').hidden = true; box.querySelector('[data-bonus-ok]').hidden = true;
        }
        box.querySelectorAll('[data-bonus-d]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { bonusGuess = clamp(bonusGuess + Number(buttonNode.getAttribute('data-bonus-d')), 0, 16); ctx.sfx('tick'); renderBonus(); });
        });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var pairItem = pairs[pairIndex], earlyYear = EVENTS[pairItem[0]].year, lateYear = EVENTS[pairItem[1]].year;
          var correctBonus = bonusGuess === lateYear - earlyYear;
          var statusNode = box.querySelector('[data-bonus-ok]'); statusNode.hidden = false;
          statusNode.style.color = correctBonus ? PAL.good : BAD;
          statusNode.textContent = correctBonus ? 'נכון. חיסרת את המוקדמת מהמאוחרת.' : 'נסה שוב: מחסרים שנים, ולא סופרים את סימון ההתחלה כצעד.';
          ctx.sfx(correctBonus ? 'correct' : 'error');
          if (correctBonus) { var formsNode = box.querySelector('[data-bonus-forms]'); formsNode.hidden = false; formsNode.innerHTML = bdi(lateYear + ' − ' + earlyYear + ' = ' + bonusGuess); }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { pairIndex = (pairIndex + 1 + Math.floor(Math.random() * 2)) % pairs.length; bonusGuess = 0; ctx.sfx('click'); renderBonus(); });
        pairIndex = Math.floor(Math.random() * pairs.length); renderBonus();
      }
    }
  });
}());
