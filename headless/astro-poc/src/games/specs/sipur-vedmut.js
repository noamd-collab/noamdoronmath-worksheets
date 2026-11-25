/** סיפור ודמות: התאמה, רצף והסקה מתוך המקרא. המקורות בהערת התכנון. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#a12a24';
  var VW = 402;
  var STATIONS = [330, 201, 72];

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function hebText(id, x, y, value, size, colour) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" direction="rtl" text-anchor="middle" font-family="Heebo, sans-serif" font-weight="700" font-size="'
      + (size || 16) + '" fill="' + (colour || PAL.ink) + '">' + value + '</text>';
  }
  function symbol(kind) {
    if (kind === 'ark') return '<path d="M-28 0 H28 L18 20 H-18 Z" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<path d="M-18 0 V-16 H18 V0 M-22 25 Q-11 19 0 25 T22 25" fill="none" stroke="' + PAL.main + '" stroke-width="2.5"/>';
    if (kind === 'basket') return '<path d="M-25 0 Q0-25 25 0 L19 20 H-19 Z" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2.5"/>'
      + '<path d="M-22 6 H22 M-19 13 H19 M-10 0 V20 M0 0 V20 M10 0 V20" stroke="' + PAL.main + '" stroke-width="1.5"/>';
    if (kind === 'wheat') return '<path d="M0 25 V-23 M0-16 Q-19-27-11-11 L0-5 M0-6 Q19-17 11-1 L0 5 M0 4 Q-19-7-11 9 L0 15" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2.5" stroke-linecap="round"/>';
    if (kind === 'dove' || kind === 'leaf') return '<path d="M-26 5 Q-5 6 1-11 Q8-18 17-8 L27-5 L17 0 Q10 25-10 18 L-25 25 L-17 12 Z" fill="#fff" stroke="' + PAL.main + '" stroke-width="2.5"/>'
      + '<path d="M-8 11 Q1-12-18-19 Q-23-3-8 11" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
      + (kind === 'leaf' ? '<path d="M21 3 Q36 2 31 15 Q20 15 21 3" fill="' + PAL.good + '"/>' : '');
    return '<path d="M0 24 C-45-5-12-31 0-13 C12-31 45-5 0 24 Z" fill="' + PAL.warmSoft + '" stroke="' + PAL.dark + '" stroke-width="2.5"/>';
  }

  var MATCH_DECK = [
    { lines: ['תיבה גדולה', 'משפחה ובעלי חיים'], icon: 'ark', right: 0, ref: 'בראשית ח, א',
      evidence: 'לפי המקרא, נח בתיבה עם בעלי החיים.',
      ok: 'נכון: התיבה הגדולה שייכת לסיפור נח, עם משפחתו ובעלי החיים.',
      errors: ['', 'המילה תיבה מופיעה גם אצל משה, אבל כאן משפחה ובעלי חיים: זה סיפור נח.', 'ליקוט שיבולים קשור לרות; התיבה ובעלי החיים קשורים לנח.'] },
    { lines: ['תיבת גומא', 'ילד על שפת היאור'], icon: 'basket', right: 1, ref: 'שמות ב, ג–י',
      evidence: 'אם הילד שמה אותו בתיבת גומא בסוף על שפת היאור. בת פרעה קראה לו משה.',
      ok: 'נכון: משה היה הילד בתיבת הגומא. זו אינה התיבה הגדולה של נח.',
      errors: ['בלבלת בין שתי תיבות: תיבת הגומא היא של משה הילד, לא של נח ובעלי החיים.', '', 'רות ליקטה בשדה. הילד בתיבת הגומא הוא משה.'] },
    { lines: ['שיבולים בשדה', 'ליקוט אחרי הקוצרים'], icon: 'wheat', right: 2, ref: 'רות ב, ב–ג',
      evidence: 'לפי המקרא, רות הלכה לשדה וליקטה אחרי הקוצרים.',
      ok: 'נכון: ליקוט השיבולים אחרי הקוצרים מתואר בסיפור רות.',
      errors: ['התיבה והיונה קשורות לנח; ליקוט השיבולים אחרי הקוצרים קשור לרות.', 'תיבת הגומא קשורה למשה; בשדה, אחרי הקוצרים, ליקטה רות.', ''] }
  ];
  var ORDER_DECK = [
    { lines: ['היונה חוזרת', 'עם עלה זית בפיה'], icon: 'leaf', right: 1, ref: 'בראשית ח, ח–יב',
      evidence: 'תחילה היונה חזרה בלי מקום מנוחה. בשליחות הבאה חזרה עם עלה זית; בהמשך לא שבה.',
      ok: 'נכון: עלה הזית בא אחרי החזרה ללא מנוחה ולפני השליחות שבה היונה לא שבה.',
      errors: ['לפני עלה הזית היונה חזרה בלי מקום מנוחה. עלה הזית אינו האירוע הראשון.', '', 'האירוע האחרון הוא שהיונה לא שבה. עלה הזית מגיע לפניו.'] },
    { lines: ['היונה חוזרת', 'בלי מקום מנוחה'], icon: 'dove', right: 0, ref: 'בראשית ח, ח–יב',
      evidence: 'היונה לא מצאה מנוחה לכף רגלה וחזרה אל נח. רק בשליחות הבאה חזרה עם עלה זית.',
      ok: 'נכון: תחילה היונה לא מצאה מקום מנוחה וחזרה לתיבה.',
      errors: ['', 'החלפת בין שתי החזרות: בלי מנוחה תחילה, עם עלה זית אחר כך.', 'החזרה בלי מנוחה היא הראשונה; בסוף היונה אינה חוזרת.'] },
    { lines: ['נח שולח שוב', 'והיונה אינה שבה'], icon: 'dove', right: 2, ref: 'בראשית ח, ח–יב',
      evidence: 'אחרי החזרה עם עלה זית נח המתין ושלח את היונה שוב. הפעם היא לא שבה אליו.',
      ok: 'נכון: לבסוף היונה לא שבה. סידרת את שלוש השליחויות לפי המקרא.',
      errors: ['לפני שהיונה אינה שבה, היא חוזרת פעמיים. זה האירוע האחרון, לא הראשון.', 'בשליחות האמצעית היונה חזרה עם עלה זית. רק אחר כך לא שבה.', ''] }
  ];
  var QUALITY_DECK = [
    { lines: ['רות מתעקשת ללכת', 'עם נעמי ולא לעזבה'], icon: 'heart', right: 0, ref: 'רות א, יד–יט',
      evidence: 'רות דבקה בנעמי והתעקשה ללכת עמה. כאן נאמנות היא הישארות לצד אדם.',
      ok: 'נכון: המעשה הזה מדגיש נאמנות — רות נשארת לצד נעמי.',
      errors: ['', 'כאן רות נשארת לצד נעמי; לא מתוארת חלוקת מזון. התכונה המודגשת היא נאמנות.', 'אפשר לרחם על אדם, אבל כאן הדגש הוא לא לעזוב את נעמי: נאמנות.'] },
    { lines: ['בת פרעה רואה ילד', 'בוכה וחומלת עליו'], icon: 'basket', right: 2, ref: 'שמות ב, ה–ו',
      evidence: 'בת פרעה פתחה את התיבה, ראתה את הילד הבוכה וחמלה עליו. חמלה היא רחמים על מי שזקוק לעזרה.',
      ok: 'נכון: הפסוק מתאר חמלה של בת פרעה כלפי הילד הבוכה.',
      errors: ['נאמנות מדגישה הישארות לצד אדם; כאן הכתוב מדגיש רחמים על ילד בוכה.', 'כאן לא מתוארת השארת מזון. בת פרעה מרחמת על הילד: חמלה.', ''] },
    { lines: ['בועז מורה להשאיר', 'שיבולים לרות'], icon: 'wheat', right: 1, ref: 'רות ב, טו–טז',
      evidence: 'בועז אמר לנעריו להשאיר שיבולים לרות. כאן נתינה היא השארת מזון לאחר.',
      ok: 'נכון: ההוראה להשאיר שיבולים היא ראיה לנתינה. הסקת תכונה מתוך מעשה.',
      errors: ['נאמנות היא הישארות לצד אדם; כאן המעשה הוא השארת מזון לרות: נתינה.', '', 'כמה תכונות יכולות להתאים, אבל המעשה המודגש כאן הוא השארת מזון: נתינה.'] }
  ];

  /** One stable SVG card; drag, buttons and keys all use act(). No animation frames. */
  function cardActivity(deck, targets, receipts, initial) {
    return function (ctx) {
      var current = 0, selected = 0, accepted = [null, null, null];
      var complete = false, draggingCard = false;
      var startX = 0, startY = 0, dragX = 201, dragY = 78;
      var markup = '<style>#storyHandle:focus-visible{outline:none}#storyHandle:focus-visible #cardFace{stroke:' + PAL.warm + ';stroke-width:5}</style>';
      targets.forEach(function (target, i) {
        markup += '<rect id="zone' + i + '" x="' + (STATIONS[i] - 55) + '" y="174" width="110" height="104" rx="15" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
          + hebText('zoneLabel' + i, STATIONS[i], 211, target, 17)
          + hebText('zoneStatus' + i, STATIONS[i], 250, 'בחר יעד', 13, PAL.dark);
      });
      markup += '<g id="storyHandle" tabindex="0" role="slider" aria-label="כרטיס הסיפור: בחיצים בחר יעד; Enter או רווח להצבה" aria-valuemin="0" aria-valuemax="2" aria-valuenow="0" style="cursor:grab">'
        + '<rect id="cardFace" x="70" y="21" width="262" height="114" rx="17" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="2.5"/>'
        + '<g id="storyIcon" transform="translate(110 78)" style="pointer-events:none"></g>'
        + hebText('storyLineA', 226, 69, '', 18) + hebText('storyLineB', 226, 100, '', 16)
        + '</g>';
      ctx.draw(markup);
      var handleNode = ctx.el('storyHandle');
      var extraNode = ctx.extra('<div class="sceneStrip" style="gap:7px;padding:10px;direction:rtl">'
        + '<b data-ref></b><div data-evidence style="font-size:14px;line-height:1.6;text-align:right"></div>'
        + '<div data-receipt style="font-size:13px;line-height:1.6;text-align:right" aria-live="polite"></div></div>'
        + '<div class="stepper" dir="ltr" style="margin-top:10px"><div class="unit">'
        + '<button type="button" id="targetLeft" aria-label="בחר יעד שמאלה">←</button>'
        + '<span data-selection dir="rtl" style="min-width:92px;font-weight:700;text-align:center"></span>'
        + '<button type="button" id="targetRight" aria-label="בחר יעד ימינה">→</button></div></div>');
      ctx.register('storyControls', extraNode);
      var targetButtons = [];
      targets.forEach(function (label, i) {
        var targetButton = ctx.button('הצב: ' + label, function () { act('commit', i); }, { id: 'place' + i, ghost: true });
        targetButton.style.minWidth = '88px';
        targetButtons.push(targetButton);
      });
      ctx.button('הצב ביעד המסומן', function () { act('commit', selected); }, { id: 'placeSelected' });
      function renderCard() {
        var cardData = deck[Math.min(current, 2)];
        handleNode.setAttribute('transform', 'translate(' + (dragX - 201) + ' ' + (dragY - 78) + ')');
        handleNode.setAttribute('aria-valuenow', selected);
        handleNode.setAttribute('aria-valuetext', targets[selected]);
        handleNode.setAttribute('aria-label', (complete ? 'ההתאמות הושלמו. ' : cardData.lines.join(', ') + '. ')
          + 'בחיצים בחר יעד; Enter או רווח להצבה. היעד: ' + targets[selected]);
        ctx.el('storyLineA').textContent = complete ? 'כל הכרטיסים במקום' : cardData.lines[0];
        ctx.el('storyLineB').textContent = complete ? 'קראת את הרמזים היטב' : cardData.lines[1];
        ctx.el('storyIcon').innerHTML = symbol(complete ? 'heart' : cardData.icon);
        extraNode.querySelector('[data-ref]').textContent = complete ? 'לפי המקרא — ההתאמות שלך' : 'לפי המקרא · ' + cardData.ref;
        extraNode.querySelector('[data-evidence]').textContent = complete ? initial : cardData.evidence;
        extraNode.querySelector('[data-selection]').textContent = targets[selected];
        extraNode.querySelector('[data-receipt]').textContent = accepted.map(function (answer, i) {
          return answer ? targets[i] + ': ' + answer : '';
        }).filter(Boolean).join(' · ');
        targets.forEach(function (target, i) {
          ctx.el('zone' + i).setAttribute('fill', accepted[i] ? PAL.goodSoft : i === selected ? PAL.warmSoft : '#fff');
          ctx.el('zone' + i).setAttribute('stroke', i === selected ? PAL.dark : accepted[i] ? PAL.good : PAL.line);
          ctx.el('zone' + i).setAttribute('stroke-width', i === selected ? '4' : '2');
          ctx.el('zoneStatus' + i).textContent = accepted[i] ? 'הוצב נכון' : i === selected ? 'מסומן להצבה' : 'בחר יעד';
          targetButtons[i].setAttribute('aria-pressed', String(i === selected));
        });
        ctx.set({ cardIndex: current, targetIndex: selected, placements: accepted.slice() });
      }
      function act(kind, value) {
        if (complete) { ctx.note('השלמת את כל הכרטיסים. אפשר להמשיך.', 'good'); return; }
        if (kind === 'preview') {
          dragX = clamp(201 + value.x - startX, 132, VW - 132);
          dragY = clamp(78 + value.y - startY, 58, 243);
          selected = clamp(Math.round((330 - value.x) / 129), 0, 2);
          renderCard();
          return;
        }
        if (kind === 'select') {
          selected = clamp(value, 0, 2);
          ctx.sfx('tick'); renderCard();
          ctx.note('היעד המסומן: ' + targets[selected] + '. להצבה לחץ Enter, רווח או כפתור הצבה.');
          return;
        }
        if (kind === 'cancel') {
          dragX = 201; dragY = 78; renderCard();
          ctx.note('הכרטיס לא הגיע ליעד. הצב אותו בגרירה, בכפתורים או בחיצים ו־Enter.');
          return;
        }
        selected = clamp(value, 0, 2);
        dragX = 201; dragY = 78;
        var cardData = deck[current];
        if (cardData.right !== selected) {
          renderCard();
          ctx.el('zone' + selected).setAttribute('fill', '#fdeee4');
          ctx.el('zone' + selected).setAttribute('stroke', BAD);
          ctx.sfx('error'); ctx.note(cardData.errors[selected]);
          return;
        }
        accepted[selected] = receipts[current];
        current += 1;
        complete = current === deck.length;
        renderCard(); ctx.sfx('correct');
        ctx.note(cardData.ok + (complete ? ' אפשר להמשיך.' : ' עכשיו קרא את הכרטיס הבא.'), 'good');
        if (complete) ctx.solved();
      }
      extraNode.querySelector('#targetLeft').addEventListener('click', function () { act('select', selected + 1); });
      extraNode.querySelector('#targetRight').addEventListener('click', function () { act('select', selected - 1); });
      handleNode.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); act('commit', selected); return; }
        var delta = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[event.key];
        if (delta) { event.preventDefault(); act('select', selected + delta); }
        else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); act('select', event.key === 'Home' ? 0 : 2); }
      });
      ctx.drag(handleNode, {
        start: function (x, y) { startX = x; startY = y; draggingCard = !complete; handleNode.focus(); },
        move: function (x, y) {
          if (!draggingCard) return;
          act('preview', { x: x, y: y });
        },
        end: function () {
          if (!draggingCard) return;
          draggingCard = false;
          if (dragY >= 170) act('commit', selected); else act('cancel');
        }
      });
      renderCard(); ctx.note(initial);
    };
  }

  var steps = [
    {
      mode: 'intro', tA: 'סיפור ודמות', sub: 'נח, משה ורות — מכירים את הסיפורים דרך רמזים ומעשים.',
      tip: 'שלום, אני אליהו. נפתח את המקרא ונחבר בין רמז, דמות וסיפור.',
      emoji: '📖', eq: 'רמז · סיפור · מעשה',
      art: '<svg viewBox="0 0 300 112" width="300" height="112" xmlns="http://www.w3.org/2000/svg"><path d="M30 25 Q85 10 150 28 Q215 10 270 25 V95 Q205 80 150 97 Q95 80 30 95 Z" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="3"/><path d="M150 28 V97" stroke="' + PAL.dark + '" stroke-width="3"/><g transform="translate(86 54)">' + symbol('ark') + '</g><g transform="translate(216 54)">' + symbol('wheat') + '</g></svg>',
      note: 'משחקים לפי הכתוב במקרא. בכל פעילות קרא רמז, בחר יעד ובדוק מה מלמד המעשה. אפשר בגרירה, בכפתורים או בחיצים ו־Enter.',
      cue: 'שלושה סיפורים, ארבע שאלות', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'למי שייך הרמז?', sub: 'הצב כל כרטיס אצל הדמות המתאימה בגרירה, בכפתורים או בחיצים ו־Enter או רווח.',
      tip: 'קרא את כל הרמז. שתי תיבות שונות מופיעות בשני סיפורים שונים.',
      aspect: [402, 296], alt: 'כרטיס רמז שאפשר להציב אצל נח מימין, משה במרכז או רות משמאל, בגרירה בכפתורים או בחיצים',
      cue: 'התאם את שלושת הרמזים לדמויות', cueDone: 'שלושת הרמזים במקום. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'storyControls', text: 'קרא את הרמז, בחר יעד בחיצים והצב ב־Enter או בכפתור.' },
      setup: cardActivity(MATCH_DECK, ['נח', 'משה', 'רות'], ['תיבה גדולה', 'תיבת גומא', 'ליקוט שיבולים'], 'קרא את הרמז ואת המקור, ואז בחר את הדמות המתאימה.')
    },
    {
      mode: 'quiz', tA: 'מי היה הילד בתיבת הגומא?', sub: 'לפי שמות ב, ג–י, התיבה הונחה בסוף על שפת היאור.',
      tip: 'אל תסתפק במילה תיבה. היכן הייתה התיבה, ומי נמצא בה?', btn: 'המשך ←',
      win: 'נכון. הילד בתיבת הגומא הוא משה; נח היה בתיבה הגדולה.', wrongSay: 'בדוק את המקום ואת הרמז על הילד.',
      opts: [
        { t: 'נח', f: 'בלבלת בין שתי תיבות: נח היה בתיבה עם משפחתו ובעלי החיים, לא הילד בתיבת הגומא.' },
        { t: 'משה', c: true, f: 'נכון: בת פרעה קראה לילד משה. תיבת הגומא מתוארת בשמות ב.' },
        { t: 'רות', f: 'רות קשורה לליקוט בשדה, לא לילד בתיבת הגומא על שפת היאור.' },
        { t: 'בועז', f: 'בועז מופיע בשדה בסיפור רות. הילד שנמצא בתיבת הגומא הוא דמות מסיפור אחר.' }
      ],
      hints: ['מצא מה מיוחד בתיבה הזאת: ילד וסוף על שפת היאור.', 'בת פרעה מצאה את הילד וקראה לו בשם. זהו הסיפור בספר שמות.']
    },
    {
      mode: 'scene', tA: 'שליחויות היונה', sub: 'סדר את כרטיסי הסיפור מימין לשמאל בגרירה, בכפתורים או בחיצים ו־Enter או רווח.',
      tip: 'הכרטיסים מעורבים. בדוק מה קרה תחילה, אחר כך ולבסוף לפי בראשית ח.',
      aspect: [402, 296], alt: 'כרטיסים של שליחויות היונה לתחנות תחילה מימין, אחר כך במרכז ולבסוף משמאל',
      cue: 'הצב כל אירוע בזמן המתאים בסיפור', cueDone: 'הרצף נכון. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'storyControls', text: 'קרא את רצף הסיפור והצב את הכרטיס ביעד המתאים.' },
      setup: cardActivity(ORDER_DECK, ['תחילה', 'אחר כך', 'לבסוף'], ['עלה זית', 'בלי מנוחה', 'לא שבה'], 'שלוש שליחויות: חזרה בלי מנוחה, חזרה עם עלה זית, ואז היונה אינה שבה.')
    },
    {
      mode: 'quiz', tA: 'מה למד נח מעלֶה הזית?', sub: 'לפי בראשית ח, יא, היונה חזרה עם עלה זית בפיה.',
      tip: 'העלה הוא סימן אחד. בדוק מה נח ידע באותו רגע, ולא מה קרה בהמשך.', btn: 'המשך ←',
      win: 'בדיוק. נח ידע שהמים פחתו; היציאה מהתיבה מתוארת בהמשך.', wrongSay: 'אל תקפוץ מהסימן אל אירוע מאוחר יותר.',
      opts: [
        { t: 'הארץ כולה כבר יבשה', f: 'הסקת יותר ממה שהסימן מלמד. בפסוק נח יודע שהמים פחתו; יובש הארץ מתואר בהמשך.' },
        { t: 'היונה לא חזרה', f: 'בלבלת בין שליחויות. עם העלה היונה דווקא חזרה; בשליחות הבאה לא שבה.' },
        { t: 'המים פחתו מעל הארץ', c: true, f: 'נכון: לפי הפסוק, נח ידע שהמים קלו, כלומר פחתו, מעל הארץ.' },
        { t: 'נח כבר יצא מהתיבה', f: 'העברת את היציאה למועד מוקדם מדי. נח עוד היה בתיבה כשהיונה חזרה עם העלה.' }
      ],
      hints: ['חשוב מה עלה מן הצומח יכול ללמד על המים.', 'הפסוק אומר שנח ידע שהמים קלו. קלו כאן פירושו פחתו.']
    },
    {
      mode: 'scene', tA: 'מה מלמד המעשה?', sub: 'התאם מעשה לתכונה המודגשת בו בגרירה, בכפתורים או בחיצים ו־Enter או רווח.',
      tip: 'מסיקים תכונה מתוך מעשה כתוב. לא צריך לנחש איך נראתה הדמות.',
      aspect: [402, 296], alt: 'כרטיס מעשה מהמקרא ושלושה יעדים מימין לשמאל: נאמנות, נתינה וחמלה',
      cue: 'התאם את שלושת המעשים לתכונות', cueDone: 'מצאת תכונה מתוך כל מעשה. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'storyControls', text: 'קרא מה הדמות עשתה ומה משמעות התכונה בפעילות.' },
      setup: cardActivity(QUALITY_DECK, ['נאמנות', 'נתינה', 'חמלה'], ['רות לצד נעמי', 'רחמים על הילד', 'שיבולים לרות'], 'בפעילות: נאמנות — להישאר לצד אדם; נתינה — להשאיר מזון לאחר; חמלה — לרחם על מי שזקוק לעזרה.')
    },
    {
      mode: 'quiz', tA: 'רות נשארת לצד נעמי', sub: 'לפי רות א, יד–יט, רות אינה עוזבת את נעמי והולכת עמה. איזו תכונה מודגשת?',
      tip: 'קרא את המעשה: להישאר לצד אדם גם כשהדרך אינה פשוטה.', btn: 'המשך ←',
      win: 'נכון. ההישארות לצד נעמי מדגישה נאמנות.', wrongSay: 'בחר לפי המעשה המתואר, לא לפי תכונה שאינה מוזכרת.',
      opts: [
        { t: 'נאמנות', c: true, f: 'נכון: רות דבקה בנעמי והתעקשה ללכת עמה, ולכן המעשה מדגיש נאמנות.' },
        { t: 'כוח גופני', f: 'ההליכה אינה מבחן כוח כאן. הכתוב מדגיש שרות אינה עוזבת את נעמי.' },
        { t: 'עושר', f: 'לא מתואר כאן רכוש. המסקנה צריכה להישען על ההישארות לצד נעמי.' },
        { t: 'רצון לעזוב את נעמי', f: 'הפכת את משמעות המעשה. רות מתעקשת ללכת עם נעמי ולא לעזוב אותה.' }
      ],
      hints: ['שאל אם רות בוחרת להיפרד או להישאר יחד.', 'היא נשארת לצד נעמי. איזו תכונה מתארת הישארות לצד אדם?']
    },
    {
      mode: 'quiz', tA: 'מחפשים ראיה לנתינה', sub: 'איזה פרט מרות ב, טו–טז תומך במסקנה שבועז נהג בנתינה?',
      tip: 'מסקנה על תכונה צריכה להישען על מעשה. חפש מה בועז הורה לעשות.', btn: 'לסיכום ←',
      win: 'מצוין. השתמשת במעשה כתוב כראיה למסקנה.', wrongSay: 'חפש פרט מהטקסט, לא ניחוש או שם של דמות.',
      opts: [
        { t: 'השם שלו הוא בועז', f: 'שם הדמות מזהה אותה, אבל אינו ראיה לתכונה. צריך למצוא מעשה.' },
        { t: 'כך אני מדמיין אותו', f: 'דמיון אינו פרט מהמקרא. מסקנה מבוססת נשענת על מעשה כתוב.' },
        { t: 'היונה הביאה עלה זית', f: 'זהו פרט מסיפור נח, לא מעשה של בועז בסיפור רות.' },
        { t: 'הורה להשאיר לרות שיבולים', c: true, f: 'נכון: ההוראה להשאיר לרות שיבולים היא מעשה שנותן לה מזון ותומך במסקנה.' }
      ],
      hints: ['ראיה טובה היא פרט שאפשר למצוא בטקסט.', 'בועז דיבר עם הנערים בשדה על שיבולים שרות תוכל ללקט.']
    },
    {
      mode: 'finish', tA: 'סיימת את סיפור ודמות', sub: 'זיהית דמויות, סידרת סיפור וביססת מסקנה על מעשה.',
      tip: 'כל הכבוד. כשתקרא סיפור, חפש רמזים ומעשים לפני שתסיק מסקנה.',
      cue: 'אפשר לתרגל עוד או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:', formula: 'קוראים רמז ומעשה — ומבססים מסקנה.'
    }
  ];

  window.NoamGame.boot({
    slug: 'sipur-vedmut', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'זיהוי דמות לפי רמז', math: '' },
      { step: 4, name: 'הבנת רצף ומשמעות', math: '' },
      { step: 6, name: 'תכונה מתוך מעשה', math: '' },
      { step: 7, name: 'ביסוס מסקנה בראיה', math: '' }
    ],
    bonus: {
      label: 'מכונת הרמזים', closeLabel: 'סגור את המכונה', hint: 'קבל רמז אקראי מהמקרא, בחר דמות ובדוק.',
      setup: function (box, ctx) {
        var names = ['נח', 'משה', 'רות', 'בועז'];
        var samples = [
          { text: 'שלח יונה מן התיבה', right: 0, ref: 'בראשית ח, ח', why: 'נח שלח את היונה; משה היה הילד בתיבת הגומא.' },
          { text: 'הילד בתיבת הגומא', right: 1, ref: 'שמות ב, ג–י', why: 'בת פרעה קראה לילד משה. זו אינה התיבה הגדולה של נח.' },
          { text: 'ליקטה אחרי הקוצרים', right: 2, ref: 'רות ב, ב–ג', why: 'רות ליקטה בשדה; בועז הורה להשאיר לה שיבולים.' },
          { text: 'הורה להשאיר שיבולים לרות', right: 3, ref: 'רות ב, טו–טז', why: 'בועז נתן את ההוראה; רות הייתה המלקטת.' }
        ];
        var sampleIndex = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת הרמזים</div><div class="bSub" data-bref></div>'
          + '<div class="bChip" data-riddle dir="rtl" style="font:700 17px Heebo,sans-serif;max-width:100%;white-space:normal;text-align:center"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit"><button type="button" data-bmove="-1" aria-label="דמות קודמת">←</button>'
          + '<span data-guess dir="rtl" style="font-weight:700;min-width:70px;text-align:center"></span>'
          + '<button type="button" data-bmove="1" aria-label="דמות הבאה">→</button></div></div>'
          + '<div class="bForms" data-bforms hidden style="font:700 14px Heebo,sans-serif;direction:rtl;white-space:normal"></div>'
          + '<div class="bOk" data-bok role="status" aria-live="polite" hidden></div>'
          + '<button type="button" class="bDice" data-bcheck style="min-width:44px">בדוק דמות</button>'
          + '<button type="button" class="bDice" data-broll style="min-width:44px">רמז חדש ↻</button>';
        function showBonus() {
          box.querySelector('[data-bref]').textContent = 'לפי המקרא · ' + samples[sampleIndex].ref;
          box.querySelector('[data-riddle]').textContent = samples[sampleIndex].text;
          box.querySelector('[data-guess]').textContent = names[guess];
          box.querySelector('[data-bforms]').hidden = true;
          box.querySelector('[data-bok]').hidden = true;
        }
        box.querySelectorAll('[data-bmove]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-bmove')), 0, 3); ctx.sfx('tick'); showBonus(); });
        });
        box.querySelector('[data-bcheck]').addEventListener('click', function () {
          var correct = guess === samples[sampleIndex].right;
          var noteNode = box.querySelector('[data-bok]');
          noteNode.hidden = false; noteNode.style.color = correct ? PAL.good : BAD;
          noteNode.textContent = correct ? 'נכון! קישרת רמז לדמות.' : 'נסה שוב: ' + samples[sampleIndex].why;
          ctx.sfx(correct ? 'correct' : 'error');
          if (correct) { box.querySelector('[data-bforms]').hidden = false; box.querySelector('[data-bforms]').textContent = samples[sampleIndex].why; }
        });
        box.querySelector('[data-broll]').addEventListener('click', function () { sampleIndex = (sampleIndex + 1 + Math.floor(Math.random() * 3)) % 4; guess = 0; ctx.sfx('click'); showBonus(); });
        sampleIndex = Math.floor(Math.random() * samples.length); showBonus();
      }
    }
  });
}());
