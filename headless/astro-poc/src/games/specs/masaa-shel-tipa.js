/** מסע של טיפה — מחזור המים. Facts: USGS, NASA, NOAA; authoring sources in the handoff note. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c', MUTED = '#475569';
  var CENTRES = [72, 201, 330];

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function heb(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-weight="700" font-size="'
      + (size || 15) + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function drop(x, y, colour, scale) {
    return '<path transform="translate(' + x + ' ' + y + ') scale(' + (scale || 1) + ')" d="M0 -21 C-5 -12 -15 -1 -15 8 A15 15 0 0 0 15 8 C15 -1 5 -12 0 -21Z" fill="'
      + (colour || PAL.main) + '" stroke="#fff" stroke-width="2"/>';
  }
  function sun(x, y) {
    var html = '<circle cx="' + x + '" cy="' + y + '" r="22" fill="' + PAL.warm + '" stroke="#92400e" stroke-width="2"/>';
    for (var ray = 0; ray < 8; ray++) {
      var angle = ray * Math.PI / 4;
      html += '<line x1="' + (x + 28 * Math.cos(angle)) + '" y1="' + (y + 28 * Math.sin(angle))
        + '" x2="' + (x + 35 * Math.cos(angle)) + '" y2="' + (y + 35 * Math.sin(angle)) + '" stroke="#92400e" stroke-width="3"/>';
    }
    return html;
  }
  function cloud(x, y) {
    return '<path transform="translate(' + x + ' ' + y + ')" d="M-56 22 C-82 22 -82 -16 -55 -18 C-52 -48 -10 -50 0 -27 C27 -48 57 -23 53 -6 C81 -8 83 25 53 25Z" fill="#fff" stroke="' + PAL.dark + '" stroke-width="2.5"/>';
  }
  function arrow(x1, y1, x2, y2, colour) {
    return '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" fill="none" stroke="' + (colour || PAL.main)
      + '" stroke-width="4" stroke-linecap="round"/><circle cx="' + x2 + '" cy="' + y2 + '" r="5" fill="' + (colour || PAL.main) + '"/>';
  }
  function panelBase() {
    return '<rect x="12" y="12" width="378" height="208" rx="18" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>';
  }
  function evaporationArt(phase) {
    var html = panelBase() + sun(333, 65)
      + '<path d="M39 149 Q100 137 160 149 T279 149 V197 H39Z" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
      + heb(157, 185, 'מים נוזליים', 17);
    if (phase === 'gas') {
      html += '<path d="M115 145 V85 M154 145 V70 M194 145 V85" fill="none" stroke="' + PAL.dark + '" stroke-width="3" stroke-dasharray="6 6"/>'
        + '<path d="M108 92 L115 82 L122 92 M147 77 L154 67 L161 77 M187 92 L194 82 L201 92" fill="none" stroke="' + PAL.dark + '" stroke-width="3"/>'
        + heb(150, 47, 'אדי מים: גז בלתי נראה', 16) + heb(157, 117, 'החיצים מסמנים מעבר', 13, MUTED);
    } else if (phase === 'ice') {
      html += '<rect x="111" y="114" width="85" height="34" rx="4" fill="#d7eef5" stroke="' + PAL.dark + '" stroke-width="2"/>'
        + heb(150, 59, 'הקפאה יוצרת קרח', 17) + heb(152, 137, 'קרח', 15);
    } else {
      html += drop(150, 120, PAL.main, 1) + heb(159, 46, phase === 'cool' ? 'קירור אינו אידוי' : 'איך יעברו המים לאוויר?', 17)
        + (phase === 'cool' ? heb(155, 82, 'לגז צריך לקלוט אנרגיה', 15, BAD) : '');
    }
    return html;
  }
  function condensationArt(phase) {
    var html = panelBase();
    if (phase === 'cloud') {
      html += cloud(201, 107);
      [[168, 108], [190, 92], [217, 108], [236, 91], [187, 122], [220, 125]].forEach(function (point) {
        html += '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="4" fill="' + PAL.main + '"/>';
      });
      html += heb(201, 46, 'עיבוי: גז נעשה נוזל', 18) + heb(201, 166, 'טיפות זעירות יוצרות ענן', 17)
        + heb(201, 194, 'הנקודות מייצגות טיפות, לא גז', 13, MUTED);
    } else {
      html += '<rect x="70" y="72" width="262" height="94" rx="18" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-dasharray="7 5"/>'
        + heb(201, 45, 'אוויר לח מאוד', 18) + heb(201, 113, 'יש כאן אדי מים', 18) + heb(201, 144, 'הגז עצמו בלתי נראה', 16)
        + heb(201, 194, phase === 'warm' ? 'חימום אינו העיבוי המבוקש' : phase === 'run' ? 'זרימה היא תנועה על הקרקע' : 'בחר תנאי ליצירת טיפות', 15, phase ? BAD : MUTED);
    }
    return html;
  }
  function groundArt(mission, landed) {
    var html = panelBase() + cloud(107, 66)
      + '<path d="M25 155 L174 112 L275 171 L378 171 V208 H25Z" fill="' + PAL.warmSoft + '" stroke="#8b5e34" stroke-width="2"/>'
      + '<path d="M264 165 Q289 152 318 172 T377 181 V205 H276Z" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
      + '<path d="M53 177 H190 M53 193 H190" stroke="#8b5e34" stroke-width="2" stroke-dasharray="3 7"/>'
      + heb(97, 213, 'בתוך הקרקע', 13) + heb(326, 213, 'נחל', 13);
    var origin = mission === 0 ? [107, 102] : mission === 1 ? [174, 124] : [88, 141];
    var target = landed === 0 ? [97, 184] : landed === 1 ? [187, 147] : landed === 2 ? [327, 180] : origin;
    if (landed !== null) html += arrow(origin[0], origin[1], target[0], target[1], landed === [1, 2, 0][mission] ? PAL.good : BAD);
    html += drop(target[0], target[1], PAL.main, 0.7);
    return html;
  }

  /** One state path: select(value) previews; commit(value) checks and applies the scientific change.
   * Real horizontal drag of the large token chooses a condition/destination and dropping commits.
   * Native buttons commit directly; all four arrows select, Enter/Space commit. */
  function choiceControl(ctx, labels, onCommit) {
    var selection = 0, dragX = CENTRES[0];
    ctx.svg.insertAdjacentHTML('beforeend', '<g id="choiceTiles"></g>'
      + '<path d="M72 331 H330" stroke="' + PAL.line + '" stroke-width="5" stroke-linecap="round"/>'
      + '<g id="waterHandle" tabindex="0" role="slider" aria-label="סמן בחירה: חיצים בוחרים, Enter או רווח מאשרים; אפשר גם לגרור ולשחרר"'
      + ' aria-valuemin="0" aria-valuemax="2" aria-valuenow="0" style="cursor:grab">'
      + '<rect x="-34" y="-34" width="68" height="68" rx="16" fill="' + PAL.soft + '" stroke="' + PAL.dark + '" stroke-width="2"/>'
      + '<g style="pointer-events:none;cursor:default">' + drop(0, 0, PAL.main, 0.95) + '</g></g>'
      + heb(201, 374, 'סמן בחירה — לא אדי מים', 13, MUTED));
    var handle = ctx.el('waterHandle'), buttons = [];
    function renderChoice() {
      var tiles = '';
      labels.forEach(function (label, index) {
        tiles += '<rect x="' + (CENTRES[index] - 56) + '" y="236" width="112" height="53" rx="12" fill="'
          + (selection === index ? PAL.soft : '#fff') + '" stroke="' + (selection === index ? PAL.dark : PAL.line) + '" stroke-width="'
          + (selection === index ? 3 : 1.5) + '"/>' + heb(CENTRES[index], 268, label, 14);
        if (buttons[index]) {
          buttons[index].textContent = label;
          buttons[index].setAttribute('aria-pressed', String(selection === index));
        }
      });
      ctx.el('choiceTiles').innerHTML = tiles;
      handle.setAttribute('transform', 'translate(' + dragX + ' 331)');
      handle.setAttribute('aria-valuenow', selection);
      handle.setAttribute('aria-valuetext', labels[selection]);
    }
    function selectChoice(value) {
      selection = clamp(value, 0, 2); dragX = CENTRES[selection];
      ctx.set({ choice: selection }); renderChoice(); ctx.sfx('tick');
    }
    function commitChoice(value) { selectChoice(value); onCommit(selection); }
    labels.forEach(function (label, index) {
      buttons.push(ctx.button(label, function () { commitChoice(index); }, { id: 'waterChoice' + index, ghost: true }));
    });
    ctx.button('אשר בחירה', function () { commitChoice(selection); }, { id: 'waterConfirm' });
    handle.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); selectChoice(selection + 1); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); selectChoice(selection - 1); }
      else if (event.key === 'Home') { event.preventDefault(); selectChoice(0); }
      else if (event.key === 'End') { event.preventDefault(); selectChoice(2); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitChoice(selection); }
    });
    ctx.drag(handle, {
      start: function () { handle.focus(); dragX = CENTRES[selection]; },
      move: function (x) {
        dragX = clamp(x, 48, 354);
        selection = clamp(Math.round((dragX - 72) / 129), 0, 2);
        renderChoice();
      },
      end: function () { commitChoice(selection); }
    });
    renderChoice();
    return { select: selectChoice, labels: function (newLabels) { labels = newLabels; renderChoice(); } };
  }

  function evaporationScene(ctx) {
    var completed = false;
    ctx.draw('<g id="scienceArt">' + evaporationArt('') + '</g>');
    choiceControl(ctx, ['קירור', 'אנרגיית שמש', 'הקפאה'], function (index) {
      ctx.el('scienceArt').innerHTML = evaporationArt(['cool', 'gas', 'ice'][index]);
      if (index === 1) {
        ctx.note('נכון! המים קלטו אנרגיה מהשמש. חלק מהנוזל נעשה אדי מים — גז בלתי נראה. זה אידוי, גם בלי רתיחה.', 'good');
        ctx.sfx('correct'); ctx.set({ phase: 'gas' });
        if (!completed) { completed = true; ctx.solved(); }
      } else {
        ctx.sfx('error');
        ctx.note(index === 0 ? 'קירור אינו התנאי לאידוי כאן. במעבר מנוזל לגז המים קולטים אנרגיה; בחר את מקור האנרגיה.'
          : 'הקפאה משנה נוזל לקרח, לא לגז. אנחנו מחפשים מעבר לאדי מים בעקבות קליטת אנרגיה.');
      }
    });
    ctx.note('מים נוזליים בים. בחר תנאי שיכול לתת להם אנרגיה למעבר לאדי מים.');
  }
  function condensationScene(ctx) {
    var completed = false;
    ctx.draw('<g id="scienceArt">' + condensationArt('') + '</g>');
    choiceControl(ctx, ['חימום', 'זרימה לקרקע', 'קירור מתאים'], function (index) {
      ctx.el('scienceArt').innerHTML = condensationArt(['warm', 'run', 'cloud'][index]);
      if (index === 2) {
        ctx.note('בדיוק! כשהאוויר הלח מתקרר מספיק, אדי מים מתעבים לטיפות נוזליות זעירות. הענן הנראה עשוי טיפות; אדי המים עצמם בלתי נראים.', 'good');
        ctx.sfx('correct'); ctx.set({ phase: 'cloud' });
        if (!completed) { completed = true; ctx.solved(); }
      } else {
        ctx.sfx('error');
        ctx.note(index === 0 ? 'חימום אינו הקירור שגורם לעיבוי במצב הזה. עיבוי הוא מעבר מגז לטיפות נוזליות כאשר האוויר הלח מתקרר מספיק.'
          : 'זרימה לקרקע היא תנועה ממקום למקום, לא מעבר מגז לנוזל. כדי ליצור טיפות מן האדים צריך כאן קירור מתאים.');
      }
    });
    ctx.note('האוויר לח מאוד. בחר תנאי שיגרום לאדים להתעבות לטיפות. לא כל קירור מספיק.');
  }
  function journeyScene(ctx) {
    var mission = 0, passed = [false, false, false];
    var instructions = ['טיפה בענן גדלה ונופלת. לאן תגיע כמשקעים?', 'טיפה על מדרון זורמת על פני הקרקע. לאן תמשיך כנגר עילי?', 'טיפה על קרקע חדירה נכנסת לתוכה. לאן תגיע בחלחול?'];
    var success = ['משקעים יורדים מן הענן אל פני הקרקע. הגשם כאן הוא מים נוזליים, לא אדי מים.',
      'נגר עילי זורם על פני הקרקע במורד לנחל. המים נשארים נוזליים; הם לא מתאדים בדרך המסומנת.',
      'חלחול מכניס מים מפני הקרקע לתוכה. זו כניסה לקרקע, לא זרימה על פניה.'];
    ctx.draw('<g id="scienceArt">' + groundArt(0, null) + '</g>');
    var missionBox = ctx.extra('<div class="sceneStrip"><div data-mission style="font-weight:700;font-size:14px" role="status"></div></div>');
    var missionText = missionBox.querySelector('[data-mission]');
    var journeyControls = choiceControl(ctx, ['בתוך הקרקע', 'פני הקרקע', 'נחל'], function (index) {
      ctx.el('scienceArt').innerHTML = groundArt(mission, index);
      if (index === [1, 2, 0][mission]) {
        passed[mission] = true; ctx.set({ passed: passed.slice(), mission: mission }); ctx.sfx('correct');
        ctx.note(success[mission] + (mission < 2 ? ' עכשיו לחץ על המשימה הבאה.' : ' השלמת את שלושת המסלולים.'), 'good');
        if (passed.every(function (value) { return value; })) ctx.solved();
      } else {
        ctx.sfx('error');
        if (mission === 0) ctx.note(index === 0 ? 'הגשם מגיע קודם אל פני הקרקע. כניסה לתוך הקרקע היא חלחול, שלב אפשרי אחר, לא הירידה מן הענן עצמה.' : 'כאן הטיפה נמצאת מעל המדרון, לא מעל הנחל. המשקעים יורדים תחילה אל פני הקרקע שמתחת לענן.');
        else if (mission === 1) ctx.note(index === 0 ? 'בחרת כניסה לקרקע, שהיא חלחול. המשימה מתארת נגר עילי: זרימה על פני הקרקע במורד אל הנחל.' : 'הטיפה כבר על פני הקרקע. נגר עילי ממשיך על פני השטח במורד, לא נשאר במקום. בחר בנחל.');
        else ctx.note(index === 2 ? 'הגעה לנחל על פני השטח היא נגר עילי. המשימה מתארת כניסה לקרקע חדירה: חלחול.' : 'הטיפה כבר על פני הקרקע. בחלחול היא נכנסת לתוכה, לא נשארת על פניה.');
      }
    });
    var nextMission = ctx.button('המשימה הבאה', function () {
      if (!passed[mission]) { ctx.sfx('error'); ctx.note('קודם מצא את היעד שמתאים למסלול הנוכחי. כל מסלול מלמד תנועה אחרת של מים.'); return; }
      if (mission === 2) { ctx.note('שלושת המסלולים הושלמו. אפשר להמשיך.', 'good'); return; }
      mission += 1; ctx.set({ mission: mission }); journeyControls.select(0);
      ctx.el('scienceArt').innerHTML = groundArt(mission, null); missionText.textContent = instructions[mission];
      ctx.note('בחר את היעד שמתאים למסלול החדש.'); ctx.sfx('click');
    }, { id: 'waterMission', ghost: true });
    ctx.register('mission', nextMission); missionText.textContent = instructions[0];
    ctx.note('התחל בירידה מהענן. אחר כך תשווה בין זרימה על פני הקרקע לבין כניסה לתוכה.');
  }

  var steps = [
    {
      mode: 'intro', tA: 'מסע של טיפה', sub: 'מן הים לאוויר, מן הענן לקרקע — וביותר מדרך אחת.',
      tip: 'שלום, אני אליהו. בוא נלווה מים שמשנים מצב ומקום, ונגלה לאן הם יכולים להמשיך.',
      emoji: '💧', eq: 'אותם מים, מצבים ומסלולים שונים',
      art: '<svg viewBox="0 0 402 220" width="402" height="220" dir="ltr">' + panelBase() + sun(331, 63) + cloud(156, 70)
        + '<path d="M27 171 Q86 153 140 171 T245 171 V206 H27Z" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>'
        + drop(170, 128) + heb(302, 170, 'ים', 17) + '</svg>',
      note: 'לא כל טיפה עוברת מסלול זהה. המים יכולים להתאדות, להתעבות, לרדת כמשקעים, לזרום או לחלחל.',
      cue: 'כל המסע אפשרי גם בלי צליל', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'נותנים אנרגיה למים',
      sub: 'בחר תנאי בגרירה, בכפתורים או בחיצים. במקלדת אשר עם Enter או רווח.',
      tip: 'אידוי הוא מעבר מנוזל לגז. בחר תנאי שנותן למים אנרגיה מן השמש.',
      aspect: [402, 386], alt: 'ים ושמש, בחירת קירור, אנרגיית שמש או הקפאה בעזרת סמן טיפה גדול; החיצים לאחר אידוי הם סימון של גז בלתי נראה',
      cue: 'בחר תנאי לאידוי ואשר', cueDone: 'המים עברו מנוזל לגז. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'בחר בגרירה, בכפתורים או בחיצים; Enter או רווח מאשרים את התנאי.' }, setup: evaporationScene
    },
    {
      mode: 'quiz', tA: 'מה משתנה באידוי?', sub: 'מים בים קלטו אנרגיה וחלקם הפכו לאדי מים.',
      tip: 'חשוב על מצב המים לפני האידוי ואחריו, לא רק על המקום שלהם.', btn: 'המשך ←',
      win: 'נכון. אידוי הוא מעבר ממים נוזליים לאדי מים, שהם גז.', wrongSay: 'בדוק אם תיארת מעבר מצב או רק תנועה של מים.',
      opts: [
        { t: 'נוזל נעשה קרח', f: 'זה תיאור של הקפאה. באידוי נוצר גז, לא מוצק.' },
        { t: 'נוזל נעשה גז', c: true, f: 'נכון. המים קולטים אנרגיה וחלק מהנוזל נעשה אדי מים בלתי נראים.' },
        { t: 'גז נעשה נוזל', f: 'הפכת את כיוון המעבר. גז שנעשה נוזל הוא עיבוי, לא אידוי.' },
        { t: 'נוזל זורם לנחל', f: 'תיארת זרימה, שבה המים עוברים מקום ונשארים נוזליים. אידוי משנה את מצבם לגז.' }
      ],
      hints: ['התחל במצב המים שבים.', 'אדי מים הם גז בלתי נראה. איזה מעבר מתחיל בנוזל ומסתיים בגז?']
    },
    {
      mode: 'scene', tA: 'מטיפות זעירות לענן',
      sub: 'בחר תנאי לעיבוי בגרירה, בכפתורים או בחיצים. Enter או רווח מאשרים.',
      tip: 'באוויר לח מאוד יש אדי מים בלתי נראים. בחר קירור מתאים כדי ליצור מהם טיפות.',
      aspect: [402, 386], alt: 'אוויר לח מאוד עם אדי מים בלתי נראים, ובחירת תנאי עיבוי; לאחר קירור מתאים מופיע ענן עם טיפות נוזליות זעירות',
      cue: 'בחר תנאי ליצירת טיפות מן האדים', cueDone: 'נוצרו טיפות נוזליות בעיבוי. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'בחר בגרירה, בכפתורים או בחיצים; Enter או רווח מאשרים.' }, setup: condensationScene
    },
    {
      mode: 'quiz', tA: 'מה אנחנו רואים בענן?', sub: 'אדי המים עצמם הם גז בלתי נראה. ממה עשוי הענן הנראה?',
      tip: 'זכור את הטיפות הזעירות שיצרת בעיבוי. עננים יכולים להכיל גם קרח.', btn: 'המשך ←',
      win: 'בדיוק. הענן נראה בזכות טיפות זעירות או גבישי קרח.', wrongSay: 'הפרד בין אדי מים בלתי נראים לבין החלקיקים שבענן.',
      opts: [
        { t: 'רק גז לבן נראה', f: 'אדי מים הם בלתי נראים. הלובן של הענן אינו גז לבן אלא אור שמפוזר בטיפות או בגבישי קרח.' },
        { t: 'רק עשן מן הקרקע', f: 'ענן מים אינו עשן. הוא עשוי טיפות מים זעירות או גבישי קרח, גם אם חלקיקים קטנים מסייעים להיווצרותו.' },
        { t: 'טיפות זעירות או גבישי קרח', c: true, f: 'נכון. בענן הנראה יש טיפות מים זעירות או גבישי קרח; אדי מים עצמם הם גז בלתי נראה.' },
        { t: 'מים שנעלמו לגמרי', f: 'באידוי המים אינם נעלמים מן העולם. הם נעשים גז, ובעיבוי יכולים לחזור לטיפות.' }
      ],
      hints: ['חפש חלקיקים שאפשר לפזר בהם אור, לא גז לבן.', 'בעיבוי גז נעשה טיפות נוזליות. בענן קר יכולים להיות גם גבישי קרח.']
    },
    {
      mode: 'scene', tA: 'בחזרה לקרקע — ולאן עכשיו?',
      sub: 'מצא יעד לכל מסלול בגרירה, בכפתורים או בחיצים. Enter או רווח מאשרים; הכפתור עובר למשימה הבאה.',
      tip: 'מים יכולים לרדת מהענן, לזרום על הקרקע או להיכנס לתוכה. התאם יעד לכל תנועה.',
      aspect: [402, 386], alt: 'ענן מעל מדרון, נחל וחתך קרקע. סמן בחירה גדול בוחר יעד לשלוש משימות: משקעים, נגר עילי וחלחול',
      cue: 'השלם את שלושת מסלולי המים', cueDone: 'משקעים, נגר וחלחול — שלושת המסלולים הושלמו ←', btn: 'המשך ←',
      nudge: { target: 'mission', text: 'בחר יעד בגרירה, בכפתורים או בחיצים ואשר; אחרי הצלחה עבור למשימה הבאה.' }, setup: journeyScene
    },
    {
      mode: 'quiz', tA: 'מים זורמים במורד', sub: 'מי גשם זורמים על פני המדרון אל נחל. איך נקרא המסלול?',
      tip: 'בדוק אם המים על פני הקרקע, בתוכה או באוויר.', btn: 'המשך ←',
      win: 'נכון. זרימה על פני הקרקע היא נגר עילי.', wrongSay: 'שים לב: המים נשארים על פני הקרקע וזורמים לנחל.',
      opts: [
        { t: 'נגר עילי', c: true, f: 'נכון. המים זורמים על פני הקרקע במורד אל הנחל. זה נגר עילי.' },
        { t: 'חלחול', f: 'חלחול הוא כניסה לתוך הקרקע. כאן המים זורמים על פניה, לא נכנסים לתוכה.' },
        { t: 'עיבוי', f: 'עיבוי משנה גז לטיפות נוזליות. כאן המים כבר נוזליים ורק זורמים ממקום למקום.' },
        { t: 'אידוי', f: 'אידוי משנה נוזל לגז. המים המתוארים נשארים נוזליים על פני המדרון.' }
      ],
      hints: ['עקוב אחרי מקום המים: הם על פני השטח.', 'המסלול הוא זרימה עילית, כלומר מעל הקרקע, אל הנחל.']
    },
    {
      mode: 'quiz', tA: 'טיפה נכנסת לאדמה', sub: 'מים שעל פני קרקע חדירה נכנסים לתוכה. מה מתרחש?',
      tip: 'הטיפה לא הופכת לגז ולא יורדת עכשיו מענן. היא נכנסת לקרקע.', btn: 'לסיכום ←',
      win: 'מעולה. מים נכנסים לקרקע בחלחול, והמסע יכול להמשיך גם מתחת לפני השטח.', wrongSay: 'חפש כניסה לתוך הקרקע, לא זרימה על פניה או מעבר לאוויר.',
      opts: [
        { t: 'משקעים מן הענן', f: 'משקעים הם ירידת מים מן האטמוספרה אל פני הקרקע. כאן המים כבר על הקרקע ונכנסים לתוכה.' },
        { t: 'אידוי אל האוויר', f: 'אידוי הוא מעבר מנוזל לגז. כאן מתוארת כניסה של מים נוזליים לקרקע.' },
        { t: 'נגר על פני השטח', f: 'נגר עילי נשאר על פני הקרקע. כאן הטיפה נכנסת לתוכה, ולכן זה מסלול אחר.' },
        { t: 'חלחול אל הקרקע', c: true, f: 'נכון. חלחול הוא מעבר של מים מפני הקרקע לתוכה. לא כל מי הגשם זורמים לנחל.' }
      ],
      hints: ['בדוק באיזה צד של פני הקרקע נמצאים המים אחרי הפעולה.', 'כשמים נכנסים לקרקע חדירה, אומרים שהם מחלחלים.']
    },
    {
      mode: 'finish', tA: 'השלמת את מסע הטיפה', sub: 'אותם מים יכולים לשנות מצב, לשנות מקום ולבחור מסלולים שונים בטבע.',
      tip: 'כל הכבוד. עכשיו אתה מבדיל בין גז בלתי נראה, טיפות בענן ותנועת מים על הקרקע ובתוכה.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'מה לקחת מן המסע:',
      formula: 'אידוי: נוזל לגז · עיבוי: גז לנוזל'
    }
  ];

  window.NoamGame.boot({
    slug: 'masaa-shel-tipa', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'אידוי ואנרגיה', math: '' },
      { step: 4, name: 'עיבוי והרכב הענן', math: '' },
      { step: 6, name: 'נגר עילי', math: '' },
      { step: 7, name: 'חלחול לקרקע', math: '' }
    ],
    bonus: {
      label: 'מכונת מסלולי המים', closeLabel: 'סגור את המכונה', hint: 'קרא תיאור קצר ובחר את התהליך שמתאים לו.',
      setup: function (box, ctx) {
        var names = ['אידוי', 'עיבוי', 'משקעים', 'נגר עילי', 'חלחול'];
        var tasks = ['מים נוזליים קולטים אנרגיה ונעשים אדי מים בלתי נראים.', 'אדי מים באוויר לח שמתקרר מספיק נעשים טיפות נוזליות.', 'גשם יורד מן הענן אל הקרקע.', 'מים זורמים על פני מדרון אל הנחל.', 'מים מפני הקרקע נכנסים לתוך קרקע חדירה.'];
        var question = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת מסלולי המים</div><div class="bSub" data-task></div>'
          + '<div class="bChip" data-guess style="font-family:Heebo,sans-serif;font-size:19px" aria-live="polite"></div>'
          + '<div class="stepper"><div class="unit"><button type="button" data-bmove="-1" aria-label="התהליך הקודם">←</button>'
          + '<span style="font-size:13px">בחר תהליך</span><button type="button" data-bmove="1" aria-label="התהליך הבא">→</button></div></div>'
          + '<div class="bForms" data-explain hidden style="font-family:Heebo,sans-serif"></div><div class="bOk" data-result role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-roll style="min-height:44px;min-width:44px">מסלול חדש ↻</button>';
        function showBonus() {
          box.querySelector('[data-task]').textContent = tasks[question];
          box.querySelector('[data-guess]').textContent = names[guess];
          box.querySelector('[data-result]').hidden = true; box.querySelector('[data-explain]').hidden = true;
        }
        function rollBonus() { question = Math.floor(Math.random() * names.length); guess = 0; showBonus(); }
        box.querySelectorAll('[data-bmove]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { guess = (guess + Number(buttonNode.getAttribute('data-bmove')) + names.length) % names.length; showBonus(); ctx.sfx('tick'); });
        });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var correct = question === guess, resultNode = box.querySelector('[data-result]');
          resultNode.hidden = false; resultNode.style.color = correct ? PAL.good : BAD;
          resultNode.textContent = correct ? 'נכון! זיהית את התהליך.' : 'עוד לא. הבחירה שלך מתארת: ' + tasks[guess] + ' השווה אותה לתיאור המשימה.';
          ctx.sfx(correct ? 'correct' : 'error');
          if (correct) { box.querySelector('[data-explain]').hidden = false; box.querySelector('[data-explain]').textContent = names[question] + ': ' + tasks[question]; }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { rollBonus(); ctx.sfx('click'); });
        rollBonus();
      }
    }
  });
}());
