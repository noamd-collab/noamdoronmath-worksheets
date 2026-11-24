/** כפל בזק — משפחות עובדות, הכפלה וקרוב לעשר; בלי מגבלת זמן. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c';

  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function mathLabel(id, x, y, text, size, colour) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + size + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function hebLabel(id, x, y, text, size) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="' + size + '" font-weight="700" fill="' + PAL.dark + '">' + text + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function controlsHtml() {
    return '<div class="stepper" dir="ltr"><div class="unit">'
      + '<button id="bezekPrev" type="button" aria-label="האפשרות הקודמת">←</button>'
      + '<span dir="rtl" style="font:700 13px Heebo,sans-serif">בחירה</span>'
      + '<button id="bezekNext" type="button" aria-label="האפשרות הבאה">→</button></div></div>';
  }

  /* Missing factors: real numerical movement, then confirmation. */
  function familyScene(ctx) {
    var round = 0, factor = 3, doneOnce = false;
    var targets = [7, 6];
    var equations = ['6 × ? = 42', '? × 7 = 42'];
    ctx.draw('<rect x="12" y="12" width="378" height="116" rx="18" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
      + hebLabel('familyTitle', 201, 38, 'מצא את הגורם החסר', 16)
      + mathLabel('familyTask', 201, 87, equations[0], 34)
      + '<line x1="60" y1="198" x2="342" y2="198" stroke="' + PAL.line + '" stroke-width="8" stroke-linecap="round"/>'
      + [3, 4, 5, 6, 7, 8, 9].map(function (value) {
        var xx = 60 + (value - 3) * 47;
        return '<circle cx="' + xx + '" cy="198" r="5" fill="' + PAL.dark + '"/>' + mathLabel('tick' + value, xx, 266, String(value), 18);
      }).join('')
      + '<g id="bezekHandle" tabindex="0" role="slider" aria-label="הגורם החסר; חיצים משנים, אנטר או רווח בודקים" aria-valuemin="3" aria-valuemax="9" aria-valuenow="3" style="cursor:grab">'
      + '<rect x="-42" y="-50" width="84" height="100" rx="16" fill="transparent"/>'
      + '<rect x="-28" y="-28" width="56" height="56" rx="16" fill="' + PAL.main + '" stroke="#fff" stroke-width="3"/>'
      + mathLabel('factorValue', 0, 9, '3', 26, '#fff') + '</g>'
      + hebLabel('familyProgress', 201, 306, 'השלם שתי עובדות קשורות', 15));
    var handle = ctx.el('bezekHandle');
    var pad = ctx.extra(controlsHtml());
    function renderFamily() {
      handle.setAttribute('transform', 'translate(' + (60 + (factor - 3) * 47) + ' 198)');
      handle.setAttribute('aria-valuenow', factor);
      handle.setAttribute('aria-valuetext', String(factor));
      ctx.el('factorValue').textContent = String(factor);
      ctx.el('familyTask').textContent = equations[Math.min(round, 1)];
      ctx.el('familyProgress').textContent = round === 2 ? 'שתי העובדות הושלמו' : (round === 0 ? 'עובדה ראשונה' : 'עובדה שנייה');
      var product = round === 0 ? 6 * factor : factor * 7;
      ctx.caption('הבחירה שלך: ' + m(round === 0 ? '6 × ' + factor + ' = ' + product : factor + ' × 7 = ' + product));
      ctx.set({ round: round, factor: factor });
    }
    function actFamily(value, commit) {
      factor = clamp(value, 3, 9);
      renderFamily();
      if (round >= 2) { ctx.note('השלמת את המשפחה: ' + m('6 × 7 = 7 × 6 = 42') + '.', 'good'); return; }
      if (!commit) { ctx.sfx('tick'); ctx.note('בחרת גורם ' + m(String(factor)) + '. בדוק אם המכפלה מגיעה ל־' + m('42') + ', ואז אשר.'); return; }
      if (factor !== targets[round]) {
        ctx.sfx('error');
        var currentProduct = round === 0 ? 6 * factor : factor * 7;
        if (factor === 6 && round === 0) ctx.note('בחרת שוב את הגורם הנתון: ' + m('6 × 6 = 36') + '. מחפשים את הגורם השני, לא מעתיקים את הראשון.');
        else if (factor === 7 && round === 1) ctx.note('החלפת מקומות, אבל צריך לשמור את שני הגורמים: ' + m('7 × 7 = 49') + '. במשפחה נשארים הגורמים ' + m('6') + ' ו־' + m('7') + '.');
        else ctx.note('המכפלה שבחרת היא ' + m(String(currentProduct)) + ', ' + (currentProduct < 42 ? 'קטנה' : 'גדולה') + ' מ־' + m('42') + '. שנה את הגורם, לא את התוצאה המבוקשת.');
        return;
      }
      round += 1;
      ctx.sfx('correct');
      if (round === 1) {
        factor = 3;
        renderFamily();
        ctx.note('נכון: ' + m('6 × 7 = 42') + '. עכשיו השלם את העובדה ההפוכה; החלפת סדר הגורמים אינה משנה את המכפלה.', 'good');
      } else {
        renderFamily();
        ctx.note('בדיוק: ' + m('6 × 7 = 7 × 6 = 42') + '. גם ' + m('42 ÷ 7 = 6') + ' שייכת למשפחה.', 'good');
        if (!doneOnce) { doneOnce = true; ctx.solved(); }
      }
    }
    pad.querySelector('#bezekPrev').addEventListener('click', function () { actFamily(factor - 1, false); });
    pad.querySelector('#bezekNext').addEventListener('click', function () { actFamily(factor + 1, false); });
    ctx.button('אשר גורם', function () { actFamily(factor, true); }, { id: 'bezekCheck', target: 'bezekCheck' });
    handle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); actFamily(factor, true); return; }
      var delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (event.key === 'Home') { event.preventDefault(); actFamily(3, false); return; }
      if (event.key === 'End') { event.preventDefault(); actFamily(9, false); return; }
      if (!delta) return;
      event.preventDefault(); actFamily(factor + delta, false);
    });
    ctx.drag(handle, {
      move: function (x) { actFamily(Math.round((x - 60) / 47) + 3, false); },
      end: function () { actFamily(factor, true); }
    });
    renderFamily();
    ctx.note('המכפלה נשארת ' + m('42') + '. מצא את הגורם החסר, ואז אשר.');
  }

  /* Four spaced targets, one stable draggable/keyboard cursor and one action path.
     Mathematical rounds differ: choose a valid calculation, then retrieve facts. */
  function choiceBoard(ctx, tasks, completionText) {
    var taskIndex = 0, selection = 0, doneOnce = false;
    var locations = [{ x: 104, y: 164 }, { x: 298, y: 164 }, { x: 104, y: 262 }, { x: 298, y: 262 }];
    ctx.draw('<rect x="12" y="8" width="378" height="104" rx="18" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
      + hebLabel('boardTitle', 201, 34, '', 15) + mathLabel('boardTask', 201, 78, '', 30)
      + locations.map(function (place, idx) {
        return '<rect id="tile' + idx + '" x="' + (place.x - 84) + '" y="' + (place.y - 36) + '" width="168" height="72" rx="15" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
          + mathLabel('choice' + idx, place.x, place.y + 8, '', 23);
      }).join('')
      + '<g id="bezekHandle" tabindex="0" role="slider" aria-label="בחירת כרטיס; חיצים מזיזים, אנטר או רווח מאשרים" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0" style="cursor:grab">'
      + '<rect x="-87" y="-39" width="174" height="78" rx="16" fill="transparent" stroke="' + PAL.main + '" stroke-width="4"/>'
      + '<circle cx="70" cy="-23" r="7" fill="' + PAL.main + '"/></g>'
      + '<g id="boardTrail"></g>');
    var handle = ctx.el('bezekHandle');
    var pad = ctx.extra(controlsHtml());
    function currentTask() { return tasks[Math.min(taskIndex, tasks.length - 1)]; }
    function renderBoard() {
      var task = currentTask();
      ctx.el('boardTitle').textContent = task.label;
      ctx.el('boardTask').textContent = task.eq;
      task.options.forEach(function (option, idx) { ctx.el('choice' + idx).textContent = option; });
      handle.setAttribute('transform', 'translate(' + locations[selection].x + ' ' + locations[selection].y + ')');
      handle.setAttribute('aria-valuenow', selection);
      handle.setAttribute('aria-valuetext', task.options[selection]);
      ctx.el('boardTrail').innerHTML = tasks.map(function (_, idx) {
        return '<circle cx="' + (201 + (idx - (tasks.length - 1) / 2) * 26) + '" cy="327" r="8" fill="' + (idx < taskIndex ? PAL.good : '#fff') + '" stroke="' + PAL.dark + '" stroke-width="2"/>';
      }).join('');
      ctx.caption('הכרטיס שבחרת: ' + m(task.options[selection]));
      ctx.set({ round: taskIndex, selection: selection });
    }
    function actBoard(value, commit) {
      selection = clamp(value, 0, 3);
      renderBoard();
      if (taskIndex >= tasks.length) { ctx.note(completionText, 'good'); return; }
      var task = currentTask();
      if (!commit) { ctx.sfx('tick'); ctx.note('בחרת ' + m(task.options[selection]) + '. אשר את הכרטיס כשתהיה מוכן.'); return; }
      if (selection !== task.correct) { ctx.sfx('error'); ctx.note(task.errors[selection]); return; }
      var confirmation = task.confirm;
      taskIndex += 1;
      ctx.sfx('correct');
      if (taskIndex < tasks.length) {
        selection = 0;
        renderBoard();
        ctx.note(confirmation + ' עבור לעובדה הבאה שמופיעה למעלה.', 'good');
      } else {
        renderBoard();
        ctx.note(confirmation + ' ' + completionText, 'good');
        if (!doneOnce) { doneOnce = true; ctx.solved(); }
      }
    }
    pad.querySelector('#bezekPrev').addEventListener('click', function () { actBoard(selection - 1, false); });
    pad.querySelector('#bezekNext').addEventListener('click', function () { actBoard(selection + 1, false); });
    ctx.button('אשר כרטיס', function () { actBoard(selection, true); }, { id: 'bezekCheck', target: 'bezekCheck' });
    handle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); actBoard(selection, true); return; }
      var delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[event.key];
      if (event.key === 'Home') { event.preventDefault(); actBoard(0, false); return; }
      if (event.key === 'End') { event.preventDefault(); actBoard(3, false); return; }
      if (!delta) return;
      event.preventDefault(); actBoard(selection + delta, false);
    });
    ctx.drag(handle, {
      move: function (x, y) {
        var nearest = 0, best = Infinity;
        locations.forEach(function (place, idx) {
          var distance = Math.hypot(x - place.x, y - place.y);
          if (distance < best) { nearest = idx; best = distance; }
        });
        actBoard(nearest, false);
      },
      end: function () { actBoard(selection, true); }
    });
    renderBoard();
    ctx.note('המסגרת הכחולה מסמנת את הבחירה. העבר אותה לכרטיס המתאים, ואז אשר.');
  }

  function strategyScene(ctx) {
    choiceBoard(ctx, [
      { label: 'ידוע: ארבע פעמים שמונה הן שלושים ושתיים', eq: '8 × 8 = ?', options: ['32 + 8', '32 + 4', '32 + 32', '32 + 2'], correct: 2,
        confirm: 'נכון: הכפלת את הגורם מארבע לשמונה, ולכן גם את המכפלה: ' + m('32 + 32 = 64') + '.',
        errors: ['הוספת קבוצה אחת של ' + m('8') + ', ולכן קיבלת ' + m('5 × 8 = 40') + '. להכפיל את מספר הקבוצות צריך עותק נוסף של כל המכפלה.', 'הוספת את הגורם ' + m('4') + ' במקום להכפיל את המכפלה. מכפלה מוכפלת היא שני עותקים של ' + m('32') + '.', '', 'הכפלה פי שניים אינה הוספת ' + m('2') + '. צריך לחבר את המכפלה לעצמה.'] },
      { label: 'מתחילים מעשר קבוצות של שבע', eq: '9 × 7 = ?', options: ['70 − 1', '70 − 7', '70 + 7', '7 + 9'], correct: 1,
        confirm: 'בדיוק: ' + m('10 × 7 = 70') + ', ומורידים קבוצה אחת של שבע: ' + m('70 − 7 = 63') + '.',
        errors: ['קבוצה אחת אינה פריט אחד. כדי לעבור מעשר קבוצות לתשע מורידים ' + m('7') + ', לא ' + m('1') + '.', '', 'הוספת קבוצה נותנת אחת עשרה קבוצות. לתשע קבוצות צריך להוריד קבוצה אחת.', 'חיברת את הגורמים במקום לכפול. נוח להתחיל מ־' + m('10 × 7') + ' ולהוריד קבוצה אחת.'] }
    ], 'מצאת שני קיצורים: להכפיל מכפלה, או להוריד קבוצה מעשר.');
  }

  function fluencyScene(ctx) {
    choiceBoard(ctx, [
      { label: 'עובדה ראשונה · בחר את המכפלה', eq: '7 × 8 = ?', options: ['54', '56', '15', '64'], correct: 1, confirm: 'נכון: ' + m('7 × 8 = 56') + '.',
        errors: ['בלבלת עם ' + m('6 × 9 = 54') + '. כאן שבע קבוצות של שמונה.', '', 'חיברת ' + m('7 + 8') + ' במקום לכפול.', 'זו המכפלה ' + m('8 × 8') + '. יש כאן קבוצה אחת פחות של שמונה.'] },
      { label: 'עובדה שנייה · שני גורמים שווים', eq: '6 × 6 = ?', options: ['12', '30', '36', '42'], correct: 2, confirm: 'נכון: ' + m('6 × 6 = 36') + '.',
        errors: ['חיברת את הגורמים. בכפל יש שש קבוצות של שש, לא פעמיים שש.', 'זה ' + m('5 × 6') + '. חסרה קבוצה אחת של שש.', '', 'זה ' + m('7 × 6') + '. נוספה קבוצה אחת של שש.'] },
      { label: 'עובדה שלישית · קרוב לעשר', eq: '4 × 9 = ?', options: ['36', '40', '13', '32'], correct: 0, confirm: 'נכון: ' + m('4 × 9 = 40 − 4 = 36') + '.',
        errors: ['', 'זו המכפלה בעשר. צריך להוריד ארבע כדי לעבור לתשע.', 'חיברת ' + m('4 + 9') + ' במקום לכפול.', 'זה ' + m('4 × 8') + '. חסרה עוד קבוצה של ארבע.'] },
      { label: 'עובדה רביעית · אין אף קבוצה', eq: '0 × 8 = ?', options: ['8', '1', '80', '0'], correct: 3, confirm: 'נכון: ' + m('0 × 8 = 0') + '. אין קבוצות, ולכן אין פריטים.',
        errors: ['בלבלת בין כפל באפס לכפל באחד. אפס קבוצות אינן קבוצה אחת.', 'כפל באפס נותן אפס; כפל באחד משאיר את הגורם האחר.', 'זה ' + m('10 × 8') + '. אפס אינו עשר.', ''] }
    ], 'כל ארבע העובדות הושלמו. דיוק קודם למהירות; אין כאן מגבלת זמן.');
  }

  var steps = [
    { mode: 'intro', tA: 'כפל בזק', sub: 'עובדות כפל בראש: משפחות, קיצורים ואתגר קצר — בקצב שלך.',
      tip: 'שלום, אני אליהו. נלמד למצוא עובדות כפל בעזרת קשרים, לא רק בעזרת זיכרון.',
      emoji: '×', eq: m('6 × 7 = 7 × 6'), note: 'מחליפים גורמים, מכפילים מכפלה מוכרת, או מתחילים מעשר קבוצות. אין שעון חובה ואין צורך בצליל.',
      cue: 'דיוק קודם למהירות', btn: 'בוא נתחיל ←' },
    { mode: 'scene', tA: 'משפחת הכפל', sub: 'בחר גורם בגרירה, בכפתורים או בחיצים. שחרר את הגרירה או אשר בכפתור, באנטר או ברווח.',
      tip: 'המכפלה קבועה. מצא את הגורם החסר בשתי עובדות מאותה משפחה.', aspect: [402, 330], alt: 'שתי עובדות כפל עם מכפלה ארבעים ושתיים וסרגל גורמים משלוש עד תשע; ידית כחולה עם בחירה ואישור',
      cue: 'השלם את שתי העובדות', cueDone: 'הגורמים קשורים. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'bezekCheck', text: 'בחר גורם ובדוק אם המכפלה מתאימה, ואז אשר.' }, setup: familyScene },
    { mode: 'quiz', tA: 'איזו עובדה שייכת למשפחה?', sub: 'ידוע ש־' + m('6 × 8 = 48') + '. איזו עובדה חייבת להיות נכונה?', tip: 'החלפת סדר שני הגורמים לא משנה את המכפלה.', btn: 'המשך ←',
      win: 'נכון. אותם גורמים בסדר הפוך נותנים אותה מכפלה.', wrongSay: 'שמור על אותם שני גורמים, ורק החלף את סדרם.',
      opts: [
        { t: m('8 × 6 = 48'), c: true, f: 'נכון: החלפת את סדר ' + m('6') + ' ו־' + m('8') + ', והמכפלה נשארה ' + m('48') + '.' },
        { t: m('6 + 8 = 48'), f: 'החלפת כפל בחיבור. חיבור הגורמים הוא ' + m('14') + ', לא המכפלה.' },
        { t: m('8 × 8 = 48'), f: 'שינית גורם, לא רק סדר. ' + m('8 × 8 = 64') + ', ולכן זו משפחה אחרת.' },
        { t: m('8 × 6 = 46'), f: 'החלפת סדר אינה מקטינה את המכפלה. אותה מכפלה נשארת ' + m('48') + '.' }
      ], hints: ['חפש את אותם שני גורמים.', 'אפשר לכתוב קודם את הגורם השני בלי לשנות את התוצאה.', 'חפש ' + m('8 × 6') + ' עם המכפלה המקורית.'] },
    { mode: 'scene', tA: 'קיצור שמחשב נכון', sub: 'העבר את המסגרת בגרירה, בכפתורים או בחיצים. שחרר או אשר בכפתור, באנטר או ברווח.',
      tip: 'בחר חישוב שמפיק את המכפלה: פעם הכפלה של עובדה מוכרת, ופעם קבוצה אחת פחות מעשר.', aspect: [402, 344], alt: 'שני אתגרי קיצור כפל; בכל אחד ארבעה כרטיסי חישוב ומסגרת כחולה שאפשר להעביר ולבחור',
      cue: 'בחר שני קיצורים נכונים', cueDone: 'שני הקיצורים חושבו. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'bezekCheck', text: 'בדוק אם הכרטיס מכפיל את המכפלה או מוריד קבוצה שלמה, ואז אשר.' }, setup: strategyScene },
    { mode: 'quiz', tA: 'מכפילים עובדה מוכרת', sub: 'ידוע ש־' + m('3 × 7 = 21') + '. כמה הם ' + m('6 × 7') + '?', tip: 'מספר הקבוצות הוכפל. מה קורה למספר הפריטים הכולל?', btn: 'המשך ←',
      win: 'בדיוק. כשגורם אחד מוכפל, גם המכפלה מוכפלת.', wrongSay: 'אל תוסיף שתיים למכפלה. קח שני עותקים של המכפלה המוכרת.',
      opts: [
        { t: m('23'), f: 'הוספת ' + m('2') + ' במקום להכפיל פי שניים. צריך ' + m('21 + 21') + '.' },
        { t: m('42'), c: true, f: 'נכון: ' + m('6') + ' הוא פעמיים ' + m('3') + ', ולכן ' + m('21 + 21 = 42') + '.' },
        { t: m('28'), f: 'הוספת רק קבוצה אחת של שבע. כך מתקבלים ' + m('4 × 7') + ', לא ' + m('6 × 7') + '.' },
        { t: m('126'), f: 'הכפלת את המכפלה שוב ב־' + m('6') + '. עובדת ' + m('3 × 7') + ' כבר כוללת שלוש קבוצות; צריך להכפיל רק פי שניים.' }
      ], hints: ['השווה את מספר הקבוצות בעובדה הידועה ובחדשה.', 'שש קבוצות הן שני עותקים של שלוש קבוצות.', 'חשב ' + m('21 + 21') + '.'] },
    { mode: 'scene', tA: 'ארבע עובדות בקצב שלך', sub: 'בחר מכפלה בגרירה, בכפתורים או בחיצים; שחרר או אשר בכפתור, באנטר או ברווח. אין שעון.',
      tip: 'נסה ארבע עובדות שונות. אם אינך זוכר, השתמש בקבוצה נוספת או בקיצור שלמדת.', aspect: [402, 344], alt: 'ארבע עובדות כפל בזו אחר זו; ארבעה כרטיסי תשובה, מסגרת בחירה וסימני התקדמות',
      cue: 'פתור את ארבע העובדות', cueDone: 'כל העובדות הושלמו. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'bezekCheck', text: 'בחר את המכפלה הנכונה לעובדה שבראש הלוח, ואז אשר.' }, setup: fluencyScene },
    { mode: 'quiz', tA: 'קבוצה אחת פחות מעשר', sub: 'כמה הם ' + m('9 × 8') + '?', tip: 'התחל מעשר קבוצות של שמונה, והורד קבוצה אחת.', btn: 'המשך ←',
      win: 'נכון. הורדת קבוצה שלמה של שמונה מעשר קבוצות.', wrongSay: 'קבוצה אחת של שמונה כוללת שמונה פריטים, לא פריט אחד.',
      opts: [
        { t: m('79'), f: 'הורדת פריט אחד מ־' + m('80') + '. צריך להוריד קבוצה אחת של ' + m('8') + '.' },
        { t: m('80'), f: 'עצרת ב־' + m('10 × 8') + '. כאן יש תשע קבוצות, ולכן צריך להוריד אחת.' },
        { t: m('72'), c: true, f: 'נכון: ' + m('10 × 8 = 80') + ', ואז ' + m('80 − 8 = 72') + '.' },
        { t: m('88'), f: 'הוספת קבוצה במקום להוריד. זו המכפלה ' + m('11 × 8') + ', לא תשע פעמים שמונה.' }
      ], hints: ['נוח להתחיל מכפל בעשר.', 'תשע קבוצות הן עשר קבוצות פחות אחת.', 'חשב ' + m('80 − 8') + '.'] },
    { mode: 'quiz', tA: 'מעובדה סמוכה לעובדה חדשה', sub: 'ידוע ש־' + m('7 × 8 = 56') + '. כמה הם ' + m('7 × 9') + '?', tip: 'הגורם השני גדל באחד. בכמה פריטים גדלה המכפלה?', btn: 'לסיכום ←',
      win: 'מעולה. הוספת עוד שבע, לא עוד אחד.', wrongSay: 'בכל אחת משבע הקבוצות נוסף פריט אחד. כמה נוספו יחד?',
      opts: [
        { t: m('57'), f: 'הוספת רק אחד למכפלה. הגורם גדל באחד, אבל יש שבע קבוצות, ולכן נוספו שבעה פריטים.' },
        { t: m('64'), f: 'הוספת שמונה. הגורם שנשאר קבוע הוא ' + m('7') + ', ולכן מוסיפים שבע.' },
        { t: m('49'), f: 'הורדת שבע במקום להוסיף. הגורם גדל משמונה לתשע, ולכן המכפלה גדלה.' },
        { t: m('63'), c: true, f: 'נכון: בכל אחת משבע הקבוצות נוסף אחד, ולכן ' + m('56 + 7 = 63') + '.' }
      ], hints: ['בדוק איזה גורם גדל ואיזה גורם נשאר קבוע.', 'בכל אחת משבע הקבוצות נוסף פריט אחד.', 'חשב ' + m('56 + 7') + '.'] },
    { mode: 'finish', tA: 'סיימת את כפל בזק', sub: 'מצא קשר לעובדה מוכרת — ואז חשב בביטחון, בקצב שלך.', tip: 'כל הכבוד. קשרים בין עובדות הופכים כפל חדש לעובדה מוכרת.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלך: החלפת סדר לא משנה מכפלה; הכפלת גורם מכפילה אותה; בכפל בתשע מורידים קבוצה מעשר.', formula: m('9 × 7 = 70 − 7 = 63') }
  ];

  window.NoamGame.boot({
    slug: 'kefel-bezek', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'משפחות עובדות', math: '6 × 8 = 8 × 6' },
      { step: 4, name: 'הכפלת מכפלה', math: '6 × 7 = 21 + 21' },
      { step: 6, name: 'קרוב לעשר', math: '9 × 8 = 80 − 8' },
      { step: 7, name: 'עובדות סמוכות', math: '7 × 9 = 56 + 7' }
    ],
    bonus: {
      label: 'מכונת הכפל', closeLabel: 'סגור את המכונה', hint: 'קבל עובדה חדשה ובחר את המכפלה. אין מגבלת זמן.',
      setup: function (box, ctx) {
        var aa = 0, bb = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת הכפל</div><div class="bSub">פתור בקצב שלך. הכפתורים משנים תשובה; בדוק כשתהיה מוכן.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit" style="gap:5px;padding:6px">'
          + '<button type="button" data-d="-10" aria-label="הקטן בעשר">−10</button><button type="button" data-d="-1" aria-label="הקטן באחד">−1</button>'
          + '<bdi class="var math" dir="ltr" data-guess style="min-width:34px">0</bdi>'
          + '<button type="button" data-d="1" aria-label="הגדל באחד">+1</button><button type="button" data-d="10" aria-label="הגדל בעשר">+10</button></div></div>'
          + '<div class="bForms" data-form hidden></div><div class="bOk" data-ok role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-width:44px">בדוק</button><button type="button" class="bDice" data-new style="min-width:44px">עובדה חדשה ↻</button>';
        function freshFact() {
          aa = Math.floor(Math.random() * 10);
          bb = 2 + Math.floor(Math.random() * 8);
          guess = 0;
          box.querySelector('[data-ex]').textContent = aa + ' × ' + bb + ' = ?';
          updateGuess();
        }
        function updateGuess() {
          box.querySelector('[data-guess]').textContent = String(guess);
          box.querySelector('[data-form]').hidden = true;
          box.querySelector('[data-ok]').hidden = true;
        }
        box.querySelectorAll('[data-d]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-d')), 0, 90); ctx.sfx('tick'); updateGuess(); });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var answer = aa * bb;
          var correct = guess === answer;
          var noteNode = box.querySelector('[data-ok]');
          noteNode.hidden = false;
          noteNode.style.color = correct ? PAL.good : BAD;
          if (correct) {
            ctx.sfx('correct'); noteNode.textContent = 'נכון! השתמש בעובדה הזו בפעם הבאה.';
            box.querySelector('[data-form]').innerHTML = bdi(aa + ' × ' + bb + ' = ' + answer);
            box.querySelector('[data-form]').hidden = false;
          } else {
            ctx.sfx('error');
            noteNode.innerHTML = aa === 0 ? 'אפס קבוצות נותנות אפס פריטים, לא קבוצה אחת.' : guess === aa + bb ? 'חיברת את הגורמים במקום לכפול. בכל קבוצה יש אותו מספר פריטים.' : 'נסה שוב: התשובה שלך ' + (guess < answer ? 'קטנה' : 'גדולה') + ' מהמכפלה. התחל מעובדה סמוכה והוסף או הורד קבוצה.';
          }
        });
        box.querySelector('[data-new]').addEventListener('click', function () { ctx.sfx('click'); freshFact(); });
        freshFact();
      }
    }
  });
}());
