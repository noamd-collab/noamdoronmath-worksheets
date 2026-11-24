/** זכויות ואחריות — אזרחות יומיומית; המקורות מאומתים בהערת התכנון. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c';
  var CENTRES = [330, 201, 72];
  var CATEGORIES = ['זכות', 'חובה חוקית', 'אחריות חברתית'];

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function hebLine(id, x, y, text, size, colour) {
    return '<text id="' + id + '" x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl"'
      + ' font-family="Heebo, sans-serif" font-weight="700" font-size="' + size + '" fill="' + colour + '">' + text + '</text>';
  }
  function nearest(x) {
    var index = 0;
    CENTRES.forEach(function (cx, i) { if (Math.abs(cx - x) < Math.abs(CENTRES[index] - x)) index = i; });
    return index;
  }
  function emblem(kind) {
    if (kind === 'sort') return '<path d="M177 92 Q189 86 201 94 Q213 86 225 92 V111 Q213 106 201 113 Q189 106 177 111 Z" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="2"/><path d="M201 94 V113" stroke="' + PAL.dark + '" stroke-width="2"/>';
    if (kind === 'match') return '<rect x="180" y="91" width="42" height="27" rx="6" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="2"/><path d="M190 91 V85 A11 11 0 0 1 212 85 V91" fill="none" stroke="' + PAL.dark + '" stroke-width="3"/><circle cx="201" cy="103" r="3" fill="' + PAL.dark + '"/>';
    return '<path d="M179 88 H222 Q229 88 229 95 V110 Q229 117 222 117 H201 L186 125 V117 H179 Q173 117 173 110 V95 Q173 88 179 88 Z" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="2"/><path d="M185 99 H216 M185 106 H209" stroke="' + PAL.dark + '" stroke-width="2"/>';
  }

  var SORT_ROUNDS = [
    { prompt: ['לתלמיד מגיע חינוך', 'בהתאם לחוק.'], answer: 0,
      good: 'נכון: הזכות לחינוך היא הגנה שמגיעה לתלמיד, ולא פרס על התנהגות.',
      wrong: ['זו אכן זכות.', 'הכרטיס מתאר מה מגיע לתלמיד, ולא פעולה שמוטלת עליו בחוק.', 'התנהגות מתחשבת חשובה, אבל הכרטיס מתאר זכות שמגיעה לתלמיד.'] },
    { prompt: ['הורים דואגים שילדם בגיל לימוד חובה', 'ילמד באופן סדיר במוסד מוכר.'], answer: 1,
      good: 'נכון: זו חובה חוקית של ההורים לפי חוק לימוד חובה. לילד יש גם זכות לחינוך.',
      wrong: ['לילד יש זכות לחינוך, אבל הכרטיס מתאר דווקא את החובה המוטלת על ההורים.', 'זו אכן חובה חוקית.', 'זה לא רק מעשה מתחשב: הדאגה ללימוד סדיר נקבעה בחוק.'] },
    { prompt: ['חבר נשאר לבד בהפסקה.', 'אתה מזמין אותו להצטרף למשחק.'], answer: 2,
      good: 'נכון: הזמנה מתוך התחשבות היא אחריות חברתית. לא כל מעשה טוב הוא אוטומטית חובה חוקית.',
      wrong: ['הכרטיס מתאר מעשה מתחשב שלך, לא זכות לקבל הזמנה לכל משחק.', 'עצם זה שהמעשה ראוי אינו הופך אותו אוטומטית לחובה בחוק.', 'זו אכן אחריות חברתית.'] }
  ];
  var MATCH_ROUNDS = [
    { prompt: ['מידע אישי בבית ספר רשמי:', 'למי שייכת הזכות לפרטיות?'], answer: 0,
      good: 'נכון: התלמיד הוא מי שהפרטיות שלו מוגנת. ליועצת יש חובה לשמור על המידע.',
      wrong: ['הזכות אכן שייכת לתלמיד.', 'היועצת היא בעלת החובה בתרחיש; התלמיד הוא מקבל ההגנה על פרטיותו.', 'המידע הוא על התלמיד. הכרטיס שואל על הזכות שלו, ולא על התנהגות החברים.'] },
    { prompt: ['מידע הגיע ליועצת במסגרת תפקידה.', 'על מי מוטלת חובת הסודיות?'], answer: 1,
      good: 'נכון: היועצת חייבת לשמור בסוד מידע שהגיע אליה בתפקידה, ולגלותו רק לצורך ביצוע התפקיד.',
      wrong: ['התלמיד הוא בעל הזכות כאן. הכרטיס שואל על מי שקיבלה מידע במסגרת תפקידה.', 'החובה אכן מוטלת על היועצת.', 'כאן החובה המפורשת בחוק היא על מי שקיבלה מידע עקב תפקידה — היועצת.'] },
    { prompt: ['נמנעים מרכילות על חבר', 'מתוך התחשבות. מי פועל כאן?'], answer: 2,
      good: 'נכון: החברים פועלים באחריות חברתית. באותו סיפור יש גם זכות של תלמיד וחובה של יועצת.',
      wrong: ['הכרטיס עוסק בהתנהגות החברים כלפיו, לא בכך שהתלמיד אחראי לרכילות על עצמו.', 'הכרטיס מתאר את התחשבות החברים, ולא את חובת היועצת במסגרת תפקידה.', 'אלה אכן החברים.'] }
  ];
  var DECISION_ROUNDS = [
    { prompt: ['בדיון חבר מציע רעיון אחר משלך.', 'איך תשתתף בלי לפגוע בו?'], answer: 0,
      good: 'נכון: מקשיבים ומשיבים עניינית. השתתפות אינה רשות להשתיק או להשפיל אדם אחר.',
      wrong: ['זו תגובה מכבדת.', 'השתקת חבר מונעת ממנו להשתתף. זכותך להשמיע דעה אינה בלעדיות על הדיון.', 'עלבון פוגע בכבוד. אפשר לחלוק על רעיון בלי לפגוע באדם.'] },
    { prompt: ['אתה רואה שקע חשמל פגום בכיתה.', 'איזו תגובה אחראית ובטוחה?'], answer: 1,
      good: 'נכון: מתרחקים ופונים למבוגר. אחריות לבטיחות אינה תיקון חשמל בעצמך.',
      wrong: ['נגיעה בשקע פגום מסוכנת. לא מתקנים חשמל לבד; מתרחקים ופונים למבוגר.', 'זו תגובה בטוחה.', 'התעלמות משאירה סכנה לאחרים. התרחק ופנה למבוגר בלי לגעת בשקע.'] }
  ];

  /** One card, one preview target, one commit path shared by all three input routes. */
  function dockingScene(ctx, config) {
    var roundIndex = 0, selected = 0, preview = false, complete = false;
    var dragX = 201, dragY = 157, offsetX = 0, offsetY = 0, moving = false;
    var targetButtons = [];
    var html = '<rect x="8" y="8" width="386" height="340" rx="18" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
      + hebLine('promptA', 201, 35, '', 17, PAL.ink) + hebLine('promptB', 201, 61, '', 17, PAL.ink)
      + emblem(config.kind);
    CENTRES.forEach(function (cx, index) {
      html += '<rect id="zone' + index + '" x="' + (cx - 58) + '" y="218" width="116" height="118" rx="14" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>'
        + hebLine('zoneTitle' + index, cx, 235, '', 15, PAL.dark)
        + hebLine('zoneTail' + index, cx, 255, '', 14, PAL.dark);
    });
    html += '<g id="civicHandle" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="2" aria-valuenow="0"'
      + ' aria-label="כרטיס לבחירה: חצים בוחרים יעד; Enter או רווח מאשרים" style="cursor:grab">'
      + '<rect id="tokenBody" x="-54" y="-35" width="108" height="70" rx="14" fill="' + PAL.main + '" stroke="' + PAL.dark + '" stroke-width="3"/>'
      + hebLine('tokenLabel', 0, 6, 'הכרטיס', 17, '#fff') + '</g>';
    ctx.draw(html);
    var handle = ctx.el('civicHandle');
    var detail = ctx.extra('<div class="sceneStrip" style="font:700 14px Heebo,sans-serif;line-height:1.6">'
      + '<div data-current aria-live="polite"></div><div data-progress style="color:' + PAL.dark + '"></div></div>'
      + '<div class="stepper" style="margin-top:8px"><div class="unit">'
      + '<button type="button" id="civicLeft" aria-label="בחר את היעד שמשמאל">←</button>'
      + '<span style="font:700 13px Heebo,sans-serif">בחר יעד</span>'
      + '<button type="button" id="civicRight" aria-label="בחר את היעד שמימין">→</button></div></div>');
    ctx.register('civicControls', detail);

    function labelsNow() { return config.labels(roundIndex); }
    function renderScene() {
      var current = config.rounds[roundIndex];
      var labels = labelsNow();
      ctx.el('promptA').textContent = current.prompt[0];
      ctx.el('promptB').textContent = current.prompt[1];
      labels.forEach(function (lines, index) {
        ctx.el('zoneTitle' + index).textContent = lines[0];
        ctx.el('zoneTail' + index).textContent = lines[1] || '';
        ctx.el('zone' + index).setAttribute('stroke', preview && selected === index ? PAL.dark : PAL.line);
        ctx.el('zone' + index).setAttribute('stroke-width', preview && selected === index ? '4' : '2');
        ctx.el('zone' + index).setAttribute('fill', complete && selected === index ? PAL.goodSoft : PAL.soft);
        if (targetButtons[index]) targetButtons[index].textContent = lines.join(' ').trim();
      });
      handle.setAttribute('transform', 'translate(' + (moving ? dragX : preview ? CENTRES[selected] : 201) + ' ' + (moving ? dragY : preview ? 298 : 157) + ')');
      handle.setAttribute('aria-valuenow', String(selected));
      handle.setAttribute('aria-valuetext', (preview ? 'יעד נבחר: ' : 'טרם אושר. יעד: ') + labels[selected].join(' '));
      handle.setAttribute('aria-label', current.prompt.join(' ') + ' חצים בוחרים יעד; Enter או רווח מאשרים.');
      ctx.el('tokenBody').setAttribute('fill', complete ? PAL.good : PAL.main);
      ctx.el('tokenLabel').textContent = complete ? 'הצלחת' : 'הכרטיס';
      detail.querySelector('[data-current]').textContent = complete ? config.summary : current.prompt.join(' ');
      var count = complete ? config.rounds.length : roundIndex;
      detail.querySelector('[data-progress]').textContent = 'אושרו ' + m(String(count)) + ' מתוך ' + m(String(config.rounds.length));
    }
    function chooseTarget(index, commit) {
      if (complete) { ctx.note(config.summary, 'good'); return; }
      selected = clamp(index, 0, 2); preview = true; moving = false;
      renderScene();
      if (!commit) { ctx.sfx('tick'); ctx.note('בחרת יעד: ' + labelsNow()[selected].join(' ') + '. אשר בכפתור או ב־Enter או ברווח.'); return; }
      var current = config.rounds[roundIndex];
      if (selected !== current.answer) {
        ctx.sfx('error'); ctx.el('zone' + selected).setAttribute('stroke', BAD);
        ctx.note(current.wrong[selected]); return;
      }
      ctx.sfx('correct');
      if (roundIndex + 1 === config.rounds.length) {
        complete = true; renderScene(); ctx.note(current.good + ' ' + config.summary, 'good'); ctx.solved();
      } else {
        roundIndex += 1; selected = 0; preview = false; renderScene();
        ctx.note(current.good + ' עכשיו הכרטיס הבא.', 'good');
      }
    }
    [0, 1, 2].forEach(function (index) {
      var targetButton = ctx.button('', function () { chooseTarget(index, true); }, { id: 'civicTarget' + index, ghost: true });
      targetButton.style.minWidth = '44px'; targetButtons.push(targetButton);
    });
    ctx.button('אשר את היעד', function () { chooseTarget(selected, true); }, { id: 'civicCommit', target: 'civicCommit' });
    detail.querySelector('#civicLeft').addEventListener('click', function () { chooseTarget((selected + 1) % 3, false); });
    detail.querySelector('#civicRight').addEventListener('click', function () { chooseTarget((selected + 2) % 3, false); });
    handle.addEventListener('keydown', function (event) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].indexOf(event.key) < 0) return;
      event.preventDefault();
      if (event.key === 'Enter' || event.key === ' ') { chooseTarget(selected, true); return; }
      if (event.key === 'Home') { chooseTarget(0, false); return; }
      if (event.key === 'End') { chooseTarget(2, false); return; }
      chooseTarget((selected + ((event.key === 'ArrowLeft' || event.key === 'ArrowDown') ? 1 : 2)) % 3, false);
    });
    ctx.drag(handle, {
      start: function (x, y) {
        var sx = preview ? CENTRES[selected] : 201, sy = preview ? 298 : 157;
        offsetX = x - sx; offsetY = y - sy; dragX = sx; dragY = sy; handle.focus();
      },
      move: function (x, y) {
        if (complete) return;
        moving = true; preview = true;
        dragX = clamp(x - offsetX, 62, 340); dragY = clamp(y - offsetY, 140, 306);
        selected = nearest(dragX); renderScene();
      },
      end: function () {
        if (complete) return;
        moving = false;
        if (dragY >= 218) chooseTarget(selected, true);
        else { renderScene(); ctx.note('הכרטיס עוד לא הונח ביעד. בחר יעד בגרירה, בכפתורים או בחיצים, ואז אשר.'); }
      }
    });
    renderScene(); ctx.note(config.start);
  }
  function sortScene(ctx) {
    dockingScene(ctx, { kind: 'sort', rounds: SORT_ROUNDS,
      labels: function () { return [['זכות'], ['חובה', 'חוקית'], ['אחריות', 'חברתית']]; },
      start: 'בחר את הסיווג המפורש בכרטיס. תרחיש יכול לכלול גם זכות וגם חובה; כאן שואלים על המשפט המוצג.',
      summary: 'הבחנת בין זכות, חובה חוקית ואחריות חברתית.' });
  }
  function matchScene(ctx) {
    dockingScene(ctx, { kind: 'match', rounds: MATCH_ROUNDS,
      labels: function () { return [['התלמיד'], ['היועצת'], ['החברים']]; },
      start: 'באותו סיפור יש כמה תפקידים: מי מקבל את ההגנה, מי חייב לשמור מידע ומי מתחשב בחבר?',
      summary: 'זכות התלמיד וחובת היועצת מתקיימות יחד; גם החברים יכולים לפעול באחריות.' });
  }
  function decisionScene(ctx) {
    dockingScene(ctx, { kind: 'decision', rounds: DECISION_ROUNDS,
      labels: function (index) { return index === 0 ? [['מקשיב', 'ומשיב בכבוד'], ['משתיק', 'את החבר'], ['מעליב', 'את החבר']] : [['נוגע', 'בשקע'], ['מתרחק', 'ופונה למבוגר'], ['מתעלם', 'מהסכנה']]; },
      start: 'בחר תגובה ששומרת על אחרים. השתתפות וכבוד יכולים להתקיים יחד.',
      summary: 'בחרת תגובות שמכבדות השתתפות ושומרות על בטיחות.' });
  }

  var steps = [
    {
      mode: 'intro', tA: 'זכויות ואחריות', sub: 'מה מגיע לך, מה נקבע בחוק ואיך מתחשבים באחרים?',
      tip: 'שלום, אני אליהו. נלמד להבחין בין זכות, חובה חוקית ואחריות חברתית.',
      emoji: '◆', eq: 'זכות · חובה · אחריות',
      note: 'זכות היא הגנה או אפשרות שמגיעה לאדם. חובה חוקית נקבעת בדין. אחריות חברתית היא התנהגות מתחשבת. לפעמים הן מתקיימות יחד. זהו משחק לימודי, לא ייעוץ משפטי.',
      cue: 'שלושה תרחישים, ארבע שאלות ותרגול נוסף', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'לא כל מעשה טוב הוא חוק', sub: 'סווג כל כרטיס בגרירה, בכפתורים או בחיצים. בחיצים בחר יעד, ואז אשר ב־Enter או ברווח.',
      tip: 'שאל מה המשפט מתאר: זכות שמגיעה לאדם, חובה שבחוק או מעשה מתחשב?',
      aspect: [402, 356], alt: 'כרטיס אחד ושלושה יעדים: זכות מימין, חובה חוקית במרכז ואחריות חברתית משמאל; בחירה בגרירה, בכפתורים או בחיצים ואישור',
      cue: 'סווג את כל הכרטיסים', cueDone: 'המיון הושלם. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'civicControls', text: 'בחר יעד בכפתורים או בחיצים, ואשר את הבחירה.' }, setup: sortScene
    },
    {
      mode: 'quiz', tA: 'איזה סוג של פעולה זו?', sub: 'חבר מחזיר ציוד משותף למקום מתוך התחשבות. לא נאמר שיש חוק שמחייב פעולה זו.',
      tip: 'מעשה יכול להיות חשוב וראוי גם בלי להיות חובה שנקבעה בחוק.', btn: 'המשך ←',
      win: 'נכון. אחריות חברתית אינה הופכת אוטומטית לחובה חוקית.', wrongSay: 'הבחן בין התחשבות לבין חובה שנקבעה בדין.',
      opts: [
        { t: 'חובה חוקית בהכרח', f: 'חשיבות הפעולה אינה מספיקה כדי לקבוע חובה בחוק. בתרחיש נאמר שהיא נעשית מתוך התחשבות.' },
        { t: 'אחריות חברתית', c: true, f: 'החבר מתחשב במי שישתמש בציוד אחריו. זו אחריות חברתית בתרחיש, לא אוטומטית חובה חוקית.' },
        { t: 'זכות לעשות הכול בציוד', f: 'זכות אינה היתר לעשות הכול ברכוש משותף. כאן מתוארת פעולה מתחשבת, לא זכות בלתי מוגבלת.' },
        { t: 'פעולה שאין לה חשיבות', f: 'בלבלת בין היעדר חובה מפורשת בחוק לבין היעדר חשיבות. להתחשבות יש ערך גם בלי חובה כזו.' }
      ],
      hints: ['בדוק מה נאמר על הסיבה להחזרת הציוד.', 'הפעולה נעשית מתוך התחשבות במשתמש הבא, ולא מוזכר חוק שמחייב אותה.']
    },
    {
      mode: 'scene', tA: 'זכות של אחד, חובה של אחר', sub: 'התאם כל כרטיס לאדם המתאים בגרירה, בכפתורים או בחיצים. אשר ב־Enter או ברווח.',
      tip: 'בסיפור של פרטיות, התלמיד הוא בעל הזכות והיועצת היא בעלת החובה.',
      aspect: [402, 356], alt: 'כרטיסי פרטיות וסודיות בבית ספר רשמי, עם יעדים לתלמיד, ליועצת ולחברים; התאמה בגרירה, בכפתורים או בחיצים ואישור',
      cue: 'התאם את כל הכרטיסים', cueDone: 'התפקידים הותאמו. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'civicControls', text: 'קרא למי שייך המשפט, בחר יעד ואשר.' }, setup: matchScene
    },
    {
      mode: 'quiz', tA: 'האם זו רק זכות או רק חובה?', sub: 'מידע אישי על תלמיד הגיע ליועצת בבית ספר רשמי במסגרת תפקידה. היא שומרת עליו בסוד.',
      tip: 'אותו מצב יכול לכלול זכות של אדם אחד וחובה של אדם אחר.', btn: 'המשך ←',
      win: 'בדיוק. זכות וחובה יכולות להתקיים יחד.', wrongSay: 'חשוב בנפרד על התלמיד ועל מי שקיבלה מידע במסגרת תפקידה.',
      opts: [
        { t: 'רק אחריות חברתית של היועצת', f: 'זו אינה רק התחשבות: חוק זכויות התלמיד קובע חובת סודיות על מידע שהגיע במסגרת התפקיד.' },
        { t: 'רק זכות, בלי שום חובה', f: 'זכות התלמיד אינה מבטלת את חובת הסודיות המוטלת על מי שקיבלה מידע בתפקידה.' },
        { t: 'רק חובה של התלמיד', f: 'הפכת בין התפקידים. המידע הגיע ליועצת במסגרת תפקידה, והחובה המתוארת חלה עליה.' },
        { t: 'גם זכות התלמיד וגם חובה של היועצת', c: true, f: 'זכות התלמיד לפרטיות וחובת הסודיות של היועצת מתקיימות יחד. גילוי מותר רק לצורך ביצוע התפקיד.' }
      ],
      hints: ['בדוק אם באמת צריך לבחור רק מושג אחד.', 'התלמיד מקבל הגנה על המידע; היועצת חייבת לשמור מידע שהגיע בתפקידה.']
    },
    {
      mode: 'scene', tA: 'מה תעשה עכשיו?', sub: 'בחר תגובה אחראית בגרירה, בכפתורים או בחיצים. בחיצים בחר יעד, ואז אשר ב־Enter או ברווח.',
      tip: 'בדיון שמור על כבוד האחר. מול סכנה אל תנסה לתקן לבד — פנה למבוגר.',
      aspect: [402, 356], alt: 'כרטיס תרחיש ותגובות אפשריות: בדיון תגובה מכבדת, וליד שקע פגום התרחקות ופנייה למבוגר; בחירה בגרירה, בכפתורים או בחיצים ואישור',
      cue: 'בחר תגובה מתאימה בשני התרחישים', cueDone: 'שתי הבחירות אחראיות. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'civicControls', text: 'בחר את התגובה ששומרת עליך ועל האחרים, ואז אשר.' }, setup: decisionScene
    },
    {
      mode: 'quiz', tA: 'משתתף בלי להשתיק', sub: 'בדיון בכיתה אתה רוצה להביע דעה, וגם לחבר שלך מגיע להישמע. מה מתאים?',
      tip: 'השתתפות וכבוד לאחר אינם סותרים זה את זה.', btn: 'המשך ←',
      win: 'נכון. אתה יכול להשמיע דעה וגם להשאיר מקום לאחר.', wrongSay: 'בחר תגובה ששומרת גם על השתתפות שלך וגם על כבוד החבר.',
      opts: [
        { t: 'להמתין לתור ולהביע דעה בכבוד', c: true, f: 'אתה משתתף ומשאיר מקום לחבר. אפשר לחלוק על רעיון בלי להשתיק או לפגוע באדם.' },
        { t: 'לדבר כל הזמן כי זו זכותי', f: 'זכות להשתתף אינה זכות בלעדית לדבר. דיבור ללא הפסקה מונע מאחרים להשתתף.' },
        { t: 'להעליב כדי לשכנע', f: 'עלבון פוגע בכבוד ואינו טיעון ענייני. אפשר לשכנע באמצעות נימוק מכבד.' },
        { t: 'לא להביע דעה אף פעם', f: 'כבוד לאחר אינו מחייב שתוותר תמיד על השתתפותך. אפשר להמתין לתור ולהביע דעה.' }
      ],
      hints: ['חפש אפשרות שמשאירה מקום לשני המשתתפים.', 'תור דיבור ותגובה עניינית מאפשרים לך לדבר בלי להשתיק את האחר.']
    },
    {
      mode: 'quiz', tA: 'איפה מופיעה חובה חוקית?', sub: 'בחר את הדוגמה לחובה חוקית של ההורים שעליה למדנו במשחק.',
      tip: 'לא כל פעולה ראויה נקבעה כחובה בחוק. בדוק גם על מי מוטלת החובה.', btn: 'לסיכום ←',
      win: 'נכון. זיהית חובה מוגדרת וגם את מי שהיא חלה עליו.', wrongSay: 'חפש את הדוגמה שנקבעה בחוק לימוד חובה, ולא רק מעשה מתחשב.',
      opts: [
        { t: 'להזמין כל חבר לכל משחק', f: 'הזמנה יכולה להיות מעשה חברי חשוב, אבל לא למדנו חובה חוקית להזמין כל חבר לכל משחק.' },
        { t: 'להסכים לכל דעה של חבר', f: 'כבוד אינו חובה להסכים. אפשר לחלוק על דעה ולהגיב בכבוד.' },
        { t: 'לדאוג ללימוד סדיר של ילד בגיל לימוד חובה', c: true, f: 'חוק לימוד חובה מחייב הורים לדאוג שילדם בגיל לימוד חובה ילמד באופן סדיר במוסד חינוך מוכר.' },
        { t: 'לתקן לבד שקע פגום בכיתה', f: 'אחריות לבטיחות אינה חובה לתקן חשמל לבד. מתרחקים ופונים למבוגר.' }
      ],
      hints: ['שאל איזה חוק הוזכר במיון הראשון.', 'הדוגמה נוגעת לדאגת ההורים ללימוד סדיר של ילדם, לצד הזכות שלו לחינוך.']
    },
    {
      mode: 'finish', tA: 'סיימת את זכויות ואחריות', sub: 'הבחנת בין מושגים, זיהית מי בעל הזכות ובחרת תגובות מתחשבות.',
      tip: 'כל הכבוד. שאל תמיד מה מגיע לאדם, מה נקבע בחוק ואיך אפשר להתחשב.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'הכלל שלקחת איתך:',
      formula: 'זכות מוגנת · חובה בדין · אחריות מתוך התחשבות'
    }
  ];
  window.NoamGame.boot({
    slug: 'zchuyot-veachrayut', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'אחריות לעומת חובה חוקית', math: '' },
      { step: 4, name: 'זכות וחובה יחד', math: '' },
      { step: 6, name: 'השתתפות וכבוד', math: '' },
      { step: 7, name: 'זיהוי חובה מוגדרת', math: '' }
    ],
    bonus: {
      label: 'מכונת התרחישים', closeLabel: 'סגור את המכונה', hint: 'קבל תרחיש חדש, בחר סיווג ובדוק בלי לחץ זמן.',
      setup: function (box, ctx) {
        var samples = [
          { text: 'תלמיד זכאי למשמעת שאינה משפילה.', answer: 0, why: 'זו זכות התלמיד לכבוד. גם המשמעת צריכה לכבד את האדם.' },
          { text: 'הורים דואגים שילדם בגיל לימוד חובה ילמד באופן סדיר.', answer: 1, why: 'זו חובה חוקית של ההורים לפי חוק לימוד חובה.' },
          { text: 'אתה עוזר לחבר להבין הוראות מתוך התחשבות.', answer: 2, why: 'זו אחריות חברתית בתרחיש; חשיבות העזרה אינה הופכת אותה אוטומטית לחובה חוקית.' },
          { text: 'יועצת שומרת מידע שקיבלה במסגרת תפקידה בסוד.', answer: 1, why: 'זו חובת סודיות חוקית של היועצת; לצדה קיימת זכות התלמיד לפרטיות.' },
          { text: 'לתלמיד מגיע חינוך בהתאם לחוק.', answer: 0, why: 'זו זכות לחינוך, לא פרס שמקבלים רק אם מתנהגים יפה.' },
          { text: 'אתה מחזיר ציוד משותף מתוך התחשבות במשתמש הבא.', answer: 2, why: 'בתרחיש מתוארת אחריות חברתית, ולא חובה שנקבעה במפורש בחוק.' }
        ];
        var sampleIndex = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת התרחישים</div>'
          + '<div class="bSub">בחר את המושג המפורש בתרחיש. לפעמים קיימים גם מושגים נוספים.</div>'
          + '<div class="bChip" data-bonus-prompt style="font:700 15px Heebo,sans-serif;max-width:100%;text-align:center"></div>'
          + '<div class="stepper"><div class="unit">'
          + '<button type="button" data-bonus-prev aria-label="הסיווג הקודם">←</button>'
          + '<span data-bonus-guess style="font:700 14px Heebo,sans-serif"></span>'
          + '<button type="button" data-bonus-next aria-label="הסיווג הבא">→</button></div></div>'
          + '<div class="bForms" data-bonus-forms hidden></div><div class="bOk" data-bonus-ok role="status" hidden></div>'
          + '<button type="button" class="bDice" data-bonus-check style="min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll style="min-width:44px">תרחיש חדש ↻</button>';
        function updateBonus() {
          box.querySelector('[data-bonus-prompt]').textContent = samples[sampleIndex].text;
          box.querySelector('[data-bonus-guess]').textContent = CATEGORIES[guess];
          box.querySelector('[data-bonus-ok]').hidden = true;
          box.querySelector('[data-bonus-forms]').hidden = true;
        }
        function rollBonus() {
          sampleIndex = (sampleIndex + 1 + Math.floor(Math.random() * (samples.length - 1))) % samples.length;
          guess = 0; updateBonus();
        }
        box.querySelector('[data-bonus-prev]').addEventListener('click', function () { guess = (guess + 2) % 3; ctx.sfx('tick'); updateBonus(); });
        box.querySelector('[data-bonus-next]').addEventListener('click', function () { guess = (guess + 1) % 3; ctx.sfx('tick'); updateBonus(); });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var ok = guess === samples[sampleIndex].answer;
          var status = box.querySelector('[data-bonus-ok]');
          status.hidden = false; status.style.color = ok ? PAL.good : BAD;
          status.textContent = ok ? 'נכון! ' + samples[sampleIndex].why : 'נסה שוב: זכות היא מה שמגיע לאדם; חובה חוקית נקבעת בדין; אחריות חברתית מתארת התחשבות.';
          ctx.sfx(ok ? 'correct' : 'error');
          if (ok) { var explanation = box.querySelector('[data-bonus-forms]'); explanation.hidden = false; explanation.textContent = 'הסיווג המפורש: ' + CATEGORIES[guess]; }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { ctx.sfx('click'); rollBonus(); });
        rollBonus();
      }
    }
  });
}());
