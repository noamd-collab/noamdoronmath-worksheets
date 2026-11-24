/** צלילים ותווים — מיקום בחמשה, גובה ורצף; אפשר לפתור הכול בהשתקה. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var NAMES = ['דו', 'רה', 'מי', 'פה', 'סול'];
  var FREQS = [261.63, 293.66, 329.63, 349.23, 392.00];
  var PLACES = ['על קו העזר שמתחת לחמשה', 'ברווח שמתחת לקו התחתון', 'על הקו התחתון', 'ברווח הראשון מלמטה', 'על הקו השני מלמטה'];
  var BAD = '#b91c1c';

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function noteY(index) { return 208 - 12 * index; }
  function hebText(x, y, text, size, color, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y
      + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 16)
      + '" font-weight="700" fill="' + (color || PAL.ink) + '">' + text + '</text>';
  }
  function mathText(x, y, text) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="16" fill="' + PAL.ink + '">' + text + '</text>';
  }
  function staff() {
    var markup = '<rect x="14" y="54" width="374" height="184" rx="16" fill="#fff" stroke="' + PAL.line + '"/>';
    [88, 112, 136, 160, 184].forEach(function (height) {
      markup += '<line x1="30" y1="' + height + '" x2="370" y2="' + height + '" stroke="' + PAL.ink + '" stroke-width="1.5"/>';
    });
    /* Original G-clef path: the central curl wraps the G4 line at y=160. */
    markup += '<path d="M52 217 C68 235 74 214 69 193 L48 97 C42 68 60 58 61 83 C63 108 32 126 31 152 C30 179 65 190 78 174 C91 158 75 139 59 145 C45 150 49 169 61 168 C69 167 70 157 65 153" fill="none" stroke="' + PAL.dark + '" stroke-width="4.2" stroke-linecap="round"/>';
    return markup;
  }
  function noteShape(x, index, color, prefix) {
    var yPos = noteY(index);
    return '<g' + (prefix ? ' id="' + prefix + '"' : '') + '>'
      + (index === 0 ? '<line x1="' + (x - 23) + '" y1="208" x2="' + (x + 23) + '" y2="208" stroke="' + PAL.ink + '" stroke-width="2"/>' : '')
      + '<ellipse cx="' + x + '" cy="' + yPos + '" rx="14" ry="9" transform="rotate(-18 ' + x + ' ' + yPos + ')" fill="' + color + '"/>'
      + '<line x1="' + (x + 13) + '" y1="' + yPos + '" x2="' + (x + 13) + '" y2="' + (yPos - 48) + '" stroke="' + color + '" stroke-width="3"/></g>';
  }
  function handleMarkup() {
    return '<g id="pitchHandle" tabindex="0" role="slider" aria-label="גובה התו; חיצים בוחרים, Enter או רווח מקבעים" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" style="cursor:grab">'
      + '<rect x="-34" y="-34" width="68" height="68" rx="12" fill="transparent"/>'
      + '<line id="pitchLedger" x1="-23" y1="0" x2="23" y2="0" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + '<ellipse id="pitchHead" cx="0" cy="0" rx="14" ry="9" transform="rotate(-18)" fill="' + PAL.main + '"/>'
      + '<line x1="13" y1="0" x2="13" y2="-48" stroke="' + PAL.main + '" stroke-width="3"/></g>';
  }
  function pitchPad() {
    return '<div class="stepper" dir="ltr"><div class="unit">'
      + '<button type="button" id="pitchDown" aria-label="הורד את התו דרגה אחת">↓</button>'
      + '<span class="var" id="pitchName" dir="rtl" style="font-family:Heebo,sans-serif;min-width:48px" aria-live="polite"></span>'
      + '<button type="button" id="pitchUp" aria-label="העלה את התו דרגה אחת">↑</button></div></div>';
  }
  function bindPitch(ctx, getPitch, setPitch, commitPitch, low, high) {
    var handle = ctx.el('pitchHandle');
    handle.setAttribute('aria-valuemin', low);
    handle.setAttribute('aria-valuemax', high);
    ctx.el('pitchDown').addEventListener('click', function () { setPitch(getPitch() - 1); });
    ctx.el('pitchUp').addEventListener('click', function () { setPitch(getPitch() + 1); });
    handle.addEventListener('keydown', function (event) {
      var delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (delta) { event.preventDefault(); setPitch(getPitch() + delta); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setPitch(event.key === 'Home' ? low : high); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitPitch(); }
    });
    var moved = false;
    ctx.drag(handle, {
      start: function () { moved = false; },
      move: function (x, y) { moved = true; setPitch(Math.round((208 - y) / 12)); },
      end: function () { if (moved) commitPitch(); }
    });
  }
  function positionHandle(ctx, pitch, xPos) {
    var handle = ctx.el('pitchHandle');
    handle.setAttribute('transform', 'translate(' + xPos + ' ' + noteY(pitch) + ')');
    handle.setAttribute('aria-valuenow', pitch);
    handle.setAttribute('aria-valuetext', NAMES[pitch] + ', ' + PLACES[pitch]);
    ctx.el('pitchLedger').setAttribute('visibility', pitch === 0 ? 'visible' : 'hidden');
    ctx.el('pitchName').textContent = NAMES[pitch];
    ctx.set({ pitch: pitch });
  }

  /* This function is called from setup, but creates audio only on its own button's click. */
  function addPitchAudio(ctx, sequenceGetter, label) {
    var voiceGains = [];
    function stopPitch() {
      voiceGains.forEach(function (gainNode) { try { gainNode.gain.cancelScheduledValues(0); gainNode.gain.value = 0; } catch (error) {} });
      voiceGains = [];
    }
    ctx.set({ stopPitch: stopPitch });
    ctx.button(label || 'נגן תו נבחר (רשות)', function () {
      stopPitch();
      if (!window.__lesson.state.sound) { ctx.note('הצלילים מושתקים. אפשר לזהות הכול לפי המיקום ושם התו; הניקוד לא משתנה.'); return; }
      var sequence = sequenceGetter();
      if (!sequence.length) { ctx.note('בחר תו קודם. הנגינה היא רשות בלבד.'); return; }
      try {
        var AudioConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioConstructor) { ctx.note('הדפדפן אינו תומך בנגינה. המשך לפי התווים המצוירים; כל הפעולות והניקוד זמינים.'); return; }
        var lesson = window.__lesson;
        var audio = lesson.ac || (lesson.ac = new AudioConstructor());
        if (audio.state === 'suspended') audio.resume();
        sequence.forEach(function (pitchIndex, slotIndex) {
          var oscillator = audio.createOscillator();
          var gainNode = audio.createGain();
          var when = audio.currentTime + slotIndex * 0.4;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(FREQS[pitchIndex], when);
          gainNode.gain.setValueAtTime(0.001, when);
          gainNode.gain.linearRampToValueAtTime(0.11, when + 0.015);
          gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.32);
          oscillator.connect(gainNode); gainNode.connect(audio.destination);
          voiceGains.push(gainNode);
          oscillator.start(when); oscillator.stop(when + 0.34);
        });
        ctx.note('מנגן: ' + sequence.map(function (pitchIndex) { return NAMES[pitchIndex]; }).join(', ') + '. גובה התו משתנה, העוצמה נשארת דומה.');
      } catch (error) { ctx.note('הנגינה אינה זמינה כרגע. התווים ושמותיהם מספיקים כדי להמשיך.'); }
    }, { id: 'playPitch', ghost: true });
  }
  function syncPitchMute(ctx) {
    if (!window.__lesson.state.sound && ctx.get('stopPitch')) ctx.get('stopPitch')();
  }

  function heightScene(ctx) {
    var pitch = 2, complete = false;
    ctx.draw(staff() + hebText(201, 28, 'בחר את הגבוה ביותר: מי, פה או סול')
      + noteShape(139, 2, PAL.dark) + hebText(139, 261, 'תו קבוע: מי', 15)
      + hebText(290, 261, 'התו שלך', 15) + handleMarkup());
    ctx.extra(pitchPad());
    function renderPitch() {
      positionHandle(ctx, pitch, 290);
      ctx.caption('התו שלך: ' + NAMES[pitch] + ' · ' + (pitch === 2 ? 'זהה בגובה למי' : 'גבוה ממי'));
    }
    function setPitch(value) {
      pitch = clamp(value, 2, 4);
      renderPitch(); ctx.sfx('tick');
      ctx.note(pitch === 2 ? 'ראשי התווים על אותו קו: זה אותו גובה, לא צליל גבוה יותר.'
        : pitch === 3 ? 'עלית לרווח שמעל מי. פה גבוה ממי, אבל יש כאן דרגה גבוהה יותר.'
          : 'ראש התו על הקו השני מלמטה: סול. קבע את הבחירה כדי לבדוק.');
    }
    function commitPitch() {
      if (pitch !== 4) {
        ctx.sfx('error');
        ctx.note(pitch === 2 ? 'לא שינית גובה: שני ראשי התווים על אותו קו. חפש את הדרגה הגבוהה ביותר.'
          : 'פה גבוה ממי, אבל אינו הגבוה ביותר מתוך שלוש הדרגות. סול נמצא מעל פה.');
        return;
      }
      ctx.note('בדיוק! סול הוא הגבוה ביותר כאן. ראש התו גבוה יותר בחמשה, ולכן הצליל גבוה יותר — לא חזק יותר.', 'good');
      ctx.el('pitchHead').setAttribute('fill', PAL.good);
      if (!complete) { complete = true; ctx.sfx('correct'); ctx.solved(); }
    }
    bindPitch(ctx, function () { return pitch; }, setPitch, commitPitch, 2, 4);
    ctx.button('בדוק גובה', commitPitch, { id: 'commitPitch' });
    addPitchAudio(ctx, function () { return [pitch]; });
    renderPitch();
    ctx.note('השווה את ראשי התווים. העלה את התו בגרירה, בכפתורים או בחיצים; Enter או רווח בודקים.');
  }

  function namesScene(ctx) {
    var pitch = 1, targetSlot = 0, complete = false;
    var requests = [0, 2, 1];
    ctx.draw(staff() + hebText(201, 28, '', 18, PAL.dark, 'nameTask') + handleMarkup()
      + hebText(201, 262, 'דו: קו עזר · רה: רווח · מי: קו תחתון', 14));
    ctx.extra(pitchPad() + '<div class="sceneStrip" style="margin-top:8px"><b>הבקשות שכבר מיקמת</b><span id="placedNames" dir="rtl" style="font-family:Heebo,sans-serif">עדיין אין</span></div>');
    function renderPitch() {
      positionHandle(ctx, pitch, 230);
      ctx.el('nameTask').textContent = complete ? 'כל שלושת התווים במקום' : 'מקם את ' + NAMES[requests[targetSlot]];
      ctx.caption(NAMES[pitch] + ': ' + PLACES[pitch]);
      ctx.el('placedNames').textContent = targetSlot ? requests.slice(0, targetSlot).map(function (index) { return NAMES[index]; }).join(', ') : 'עדיין אין';
    }
    function setPitch(value) {
      pitch = clamp(value, 0, 2); renderPitch(); ctx.sfx('tick');
      ctx.note('בחרת ' + NAMES[pitch] + ' ' + PLACES[pitch] + '. קבע את הבחירה כדי לבדוק.');
    }
    function commitPitch() {
      if (complete) { ctx.note('כל הבקשות כבר נענו. אפשר להמשיך או לנסות את הצלילים.', 'good'); return; }
      var wanted = requests[targetSlot];
      if (pitch !== wanted) {
        ctx.sfx('error');
        ctx.note('זה ' + NAMES[pitch] + ', ' + PLACES[pitch] + '. ' + NAMES[wanted] + ' צריך להיות ' + PLACES[wanted] + '. שים לב לראש התו, לא לקצה הגבעול.');
        return;
      }
      targetSlot += 1;
      if (targetSlot === requests.length) {
        complete = true; renderPitch(); ctx.sfx('correct'); ctx.solved();
        ctx.note('התאמת דו, מי ורה: קו עזר, קו תחתון ורווח. לכל מקום בחמשה יש תו משלו במפתח סול.', 'good');
      } else {
        renderPitch(); ctx.sfx('correct');
        ctx.note('נכון: ' + NAMES[wanted] + ' ' + PLACES[wanted] + '. עכשיו מקם את ' + NAMES[requests[targetSlot]] + '.', 'good');
      }
    }
    bindPitch(ctx, function () { return pitch; }, setPitch, commitPitch, 0, 2);
    ctx.button('קבע את התו', commitPitch, { id: 'commitPitch' });
    addPitchAudio(ctx, function () { return [pitch]; });
    renderPitch(); ctx.note('דו נמצא על קו העזר מתחת לחמשה, רה ברווח מעליו ומי על הקו התחתון. מקם לפי הבקשה.');
  }

  function melodyScene(ctx) {
    var pitch = 0, chosenNotes = [], complete = false;
    var melody = [2, 1, 0];
    ctx.draw(staff() + hebText(201, 28, 'ראשון מי, שני רה, אחרון דו', 17)
      + '<g id="melodyTrace"></g>' + handleMarkup()
      + hebText(201, 263, 'תווים קוראים משמאל לימין', 15));
    ctx.extra(pitchPad() + '<div class="sceneStrip" style="margin-top:8px"><b>הרצף שבנית, לפי סדר</b><span id="melodyWords" dir="rtl" style="font-family:Heebo,sans-serif">עדיין אין</span></div>');
    function renderPitch() {
      positionHandle(ctx, pitch, 326);
      ctx.el('melodyTrace').innerHTML = chosenNotes.map(function (index, orderIndex) {
        return noteShape(118 + orderIndex * 65, index, PAL.good) + mathText(118 + orderIndex * 65, 232, String(orderIndex + 1));
      }).join('');
      ctx.el('melodyWords').textContent = chosenNotes.length ? chosenNotes.map(function (index, orderIndex) { return ['ראשון: ', 'שני: ', 'אחרון: '][orderIndex] + NAMES[index]; }).join(' · ') : 'עדיין אין';
      ctx.caption(complete ? 'מי גבוה מרה, ורה גבוה מדו' : 'התו הבא ברצף: ' + NAMES[melody[chosenNotes.length]]);
      ctx.set({ melody: chosenNotes.slice() });
    }
    function setPitch(value) {
      pitch = clamp(value, 0, 2); renderPitch(); ctx.sfx('tick');
      ctx.note('בחרת ' + NAMES[pitch] + '. קבע כדי להוסיף אותו לרצף.');
    }
    function commitPitch() {
      if (complete) { ctx.note('הרצף כבר שלם: מי, רה, דו. הוא יורד בגובה.', 'good'); return; }
      var wanted = melody[chosenNotes.length];
      if (pitch !== wanted) {
        ctx.sfx('error');
        ctx.note(chosenNotes.length === 0 ? 'התחלת ב־' + NAMES[pitch] + ', אבל הרצף צריך להתחיל במי, הגבוה מבין דו, רה ומי.'
          : pitch >= chosenNotes[chosenNotes.length - 1] ? 'בחרת תו באותו גובה או גבוה מהקודם. הרצף שלנו יורד: התו הבא הוא ' + NAMES[wanted] + '.'
            : 'ירדת, אבל דילגת על רה. ברצף הזה יורדים ממי לרה ורק אחר כך לדו.');
        return;
      }
      chosenNotes.push(pitch);
      complete = chosenNotes.length === melody.length;
      renderPitch(); ctx.sfx('correct');
      if (complete) {
        ctx.solved(); ctx.note('בנית מי, רה, דו. ראשי התווים יורדים משמאל לימין, והצלילים יורדים בגובה. הצלחת גם בלי לשמוע!', 'good');
      } else ctx.note('נוסף ' + NAMES[pitch] + '. עכשיו בחר ' + NAMES[melody[chosenNotes.length]] + ' והמשך את הירידה.', 'good');
    }
    bindPitch(ctx, function () { return pitch; }, setPitch, commitPitch, 0, 2);
    ctx.button('הוסף לרצף', commitPitch, { id: 'commitPitch' });
    addPitchAudio(ctx, function () { return chosenNotes.length ? chosenNotes.slice() : [pitch]; }, 'נגן את הרצף (רשות)');
    renderPitch(); ctx.note('בנה לפי הסדר: מי, רה, דו. בגרירה ושחרור, בכפתורים ובקיבוע, או בחיצים ו־Enter או רווח.');
  }
  function quizPicture(indices, labels) {
    return function (ctx) {
      ctx.draw(staff() + hebText(201, 28, 'מפתח סול', 17)
        + indices.map(function (index, orderIndex) {
          var xPos = indices.length === 1 ? 228 : 126 + orderIndex * 91;
          return noteShape(xPos, index, PAL.main) + (labels ? hebText(xPos, 261, labels[orderIndex], 16) : '');
        }).join(''));
    };
  }

  var steps = [
    {
      mode: 'intro', tA: 'צלילים ותווים', sub: 'מיקום בחמשה מגלה את גובה הצליל, גם בלי לשמוע.',
      tip: 'שלום, אני אליהו. נגלה איך קוראים תווים, ואז נבנה מנגינה קצרה.',
      emoji: '♫', eq: 'ראש התו למעלה — צליל גבוה יותר',
      art: '<svg viewBox="0 0 402 280" width="330" height="230">' + staff() + noteShape(132, 0, PAL.main) + noteShape(226, 1, PAL.main) + noteShape(320, 2, PAL.main)
        + hebText(132, 263, 'דו') + hebText(226, 263, 'רה') + hebText(320, 263, 'מי') + '</svg>',
      note: 'נלמד במפתח סול. גובה אינו עוצמה: צליל גבוה לא חייב להיות חזק. הנגינה היא רשות; אפשר להשתיק למעלה ולפתור הכול לפי הציור.',
      cue: 'מוכן לגלות את גובה התווים?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'גבוה יותר, לא חזק יותר', sub: 'העלה לדרגה הגבוהה ביותר בגרירה, בכפתורים או בחיצים. Enter או רווח בודקים.',
      tip: 'השווה את ראשי התווים. מתוך מי, פה וסול, בחר את הגבוה ביותר.',
      aspect: [402, 280], alt: 'חמשה במפתח סול עם מי קבוע וידית תו שאפשר להעלות ממי לפה ולסול',
      cue: 'בחר את הדרגה הגבוהה ביותר ובדוק', cueDone: 'בחרת את סול, הגבוה ביותר כאן', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'העלה את התו בגרירה, בכפתורים או בחיצים, ואז קבע את הבחירה.' }, setup: heightScene, paint: syncPitchMute
    },
    {
      mode: 'quiz', tA: 'מה אומר מיקום גבוה יותר?', sub: 'שני התווים באותו מפתח. ראש התו השני נמצא גבוה יותר.',
      tip: 'המיקום מראה גובה צליל, לא עוצמה.', btn: 'המשך ←',
      aspect: [402, 280], alt: 'מי נמוך יותר משמאל וסול גבוה יותר מימין באותה חמשה', setup: quizPicture([2, 4]),
      win: 'נכון. תו גבוה יותר בחמשה מציין צליל גבוה יותר.', wrongSay: 'הבחן בין גבוה או נמוך לבין חזק או חלש.',
      opts: [
        { t: 'הצליל חזק יותר', f: 'בלבלת גובה עם עוצמה. המיקום בחמשה אינו קובע כמה חזק מנגנים.' },
        { t: 'הצליל גבוה יותר', c: true, f: 'נכון: באותו מפתח, ראש תו גבוה יותר בחמשה מציין צליל גבוה יותר.' },
        { t: 'הצליל נמוך יותר', f: 'הפכת את הכיוון. עלייה בחמשה מציינת עלייה בגובה הצליל, לא ירידה.' },
        { t: 'הצליל גבוה כי הוא מימין', f: 'בלבלת סדר עם גובה. ימין ושמאל מראים סדר קריאה; הגובה נקבע לפי המיקום האנכי.' }
      ],
      hints: ['הסתכל על המיקום האנכי של ראשי התווים.', 'גובה ועוצמה הם שני דברים שונים.', 'הראש השני מעל הראשון: איזה כיוון של גובה זה?']
    },
    {
      mode: 'scene', tA: 'שם ומקום בחמשה', sub: 'מקם דו, מי ורה בגרירה, בכפתורים או בחיצים. קבע בכפתור, ב־Enter או ברווח.',
      tip: 'דו על קו עזר, רה ברווח מעליו ומי על הקו התחתון. ענה על כל בקשה.',
      aspect: [402, 280], alt: 'חמשה במפתח סול עם ידית תו יחידה ושלוש בקשות לשמות דו מי ורה',
      cue: 'מקם נכון את כל שלושת התווים', cueDone: 'שלושת השמות הותאמו למקום הנכון', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'קרא את הבקשה והזז את התו בגרירה, בכפתורים או בחיצים. Enter או רווח מקבעים.' }, setup: namesScene, paint: syncPitchMute
    },
    {
      mode: 'quiz', tA: 'מי על הקו התחתון?', sub: 'איזה שם מתאים לתו המצויר במפתח סול?',
      tip: 'בדוק איפה ראש התו נמצא ביחס לקו התחתון.', btn: 'המשך ←',
      aspect: [402, 280], alt: 'תו אחד שראשו על הקו התחתון בחמשה במפתח סול', setup: quizPicture([2]),
      win: 'נכון. מי נמצא על הקו התחתון במפתח סול.', wrongSay: 'הבט בראש התו, לא בקצה הגבעול.',
      opts: [
        { t: 'דו', f: 'דו האמצעי נמצא על קו עזר מתחת לחמשה. כאן ראש התו על הקו התחתון של החמשה עצמה.' },
        { t: 'רה', f: 'רה נמצא ברווח מתחת לקו התחתון. כאן ראש התו נמצא על הקו, לא ברווח.' },
        { t: 'מי', c: true, f: 'נכון: מי נמצא על הקו התחתון במפתח סול.' },
        { t: 'סול', f: 'סול נמצא על הקו השני מלמטה, סביבו מתעגל המפתח. כאן זה הקו התחתון.' }
      ],
      hints: ['קבע אם הראש נמצא על קו או ברווח.', 'דו ורה נמצאים מתחת לחמשה, והתו כאן על החמשה.', 'מעל רה עולה התו הבא אל הקו התחתון.']
    },
    {
      mode: 'scene', tA: 'בונים מנגינה יורדת', sub: 'בנה מי, רה, דו בגרירה, בכפתורים או בחיצים. Enter או רווח מוסיפים לרצף.',
      tip: 'מתחילים במי, יורדים לרה ואז לדו. קבע כל תו בנפרד.',
      aspect: [402, 280], alt: 'חמשה עם ידית לבחירת דו רה מי, ועקבה של רצף יורד שנבנה משמאל לימין',
      cue: 'הוסף לפי הסדר: מי, רה, דו', cueDone: 'בנית רצף שיורד בגובה הצליל', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'בחר מי בגרירה, בכפתורים או בחיצים. קבע אותו, ואז בחר רה ודו.' }, setup: melodyScene, paint: syncPitchMute
    },
    {
      mode: 'quiz', tA: 'לאן המנגינה הולכת?', sub: 'קרא משמאל לימין: מי, רה, דו. מה קורה לגובה הצליל?',
      tip: 'עקוב אחרי ראשי התווים, לא אחרי קצות הגבעולים.', btn: 'המשך ←',
      aspect: [402, 280], alt: 'רצף מי רה דו משמאל לימין, ראשי התווים יורדים מהקו התחתון עד קו העזר', setup: quizPicture([2, 1, 0], ['מי', 'רה', 'דו']),
      win: 'נכון. מי, רה, דו הוא רצף יורד בגובה.', wrongSay: 'התחל משמאל ועקוב אחר גובה כל ראש תו.',
      opts: [
        { t: 'הגובה יורד', c: true, f: 'נכון: מי גבוה מרה, ורה גבוה מדו. לכן הרצף יורד בגובה הצליל.' },
        { t: 'הגובה עולה', f: 'קראת את הרצף בכיוון הפוך. תווים קוראים משמאל לימין, וכאן הראש יורד בכל צעד.' },
        { t: 'הגובה נשאר זהה', f: 'התעלמת מהמיקום האנכי. ראשי התווים אינם על אותו קו או רווח.' },
        { t: 'המנגינה נעשית מהירה יותר', f: 'בלבלת שינוי גובה עם שינוי מהירות. המיקום האנכי אינו קובע מהירות.' }
      ],
      hints: ['קרא את התווים משמאל לימין.', 'מי על הקו התחתון, רה מתחתיו ודו על קו העזר.', 'כל ראש תו נמוך מהקודם. איזה כיוון זה?']
    },
    {
      mode: 'quiz', tA: 'איך מעלים גובה?', sub: 'רוצים צליל גבוה יותר ממי, בלי להגביר את העוצמה. מה מתאים?',
      tip: 'שנה את מקום ראש התו, לא את עוצמת הנגינה.', btn: 'לסיכום ←',
      win: 'בדיוק. פה נמצא מעל מי ולכן גובה הצליל עולה.', wrongSay: 'מיקום אנכי קובע גובה. ימין ושמאל אינם מעלים צליל.',
      opts: [
        { t: 'לנגן את מי חזק יותר', f: 'הגברת עוצמה אינה משנה את התו. זה עדיין מי באותו גובה, רק חזק יותר.' },
        { t: 'להזיז את מי ימינה', f: 'הזזה אופקית משנה את המקום ברצף, לא את גובה התו.' },
        { t: 'להוריד את מי לרה', f: 'רה נמוך ממי. הורדת את הגובה במקום להעלות אותו.' },
        { t: 'להעלות את מי לפה', c: true, f: 'נכון: פה ברווח שמעל הקו של מי. מעבר ממי לפה מעלה את גובה הצליל בלי לחייב שינוי בעוצמה.' }
      ],
      hints: ['הפרד בין גובה, עוצמה וסדר.', 'ראש תו מעל מי מציין צליל גבוה יותר.', 'הרווח שמעל הקו התחתון הוא המקום של פה.']
    },
    {
      mode: 'finish', tA: 'סיימת את צלילים ותווים', sub: 'קראת שמות, השווית גובה ובנית רצף יורד. הצלילים היו רשות בלבד.',
      tip: 'כל הכבוד. עכשיו אתה יודע שמיקום ראש התו מספר על גובה הצליל.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'הכלל שלקחת איתך:', formula: 'ראש התו עולה — הצליל גבוה יותר'
    }
  ];

  window.NoamGame.boot({
    slug: 'tslilim-vetavim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'גובה לעומת עוצמה', math: '' },
      { step: 4, name: 'שמות במפתח סול', math: 'C D E' },
      { step: 6, name: 'רצף עולה ויורד', math: 'E D C' },
      { step: 7, name: 'שינוי גובה הצליל', math: 'E → F' }
    ],
    bonus: {
      label: 'מכונת התווים', closeLabel: 'סגור את המכונה', hint: 'זהה תו חדש לפי מקומו בחמשה.',
      setup: function (box, ctx) {
        var sample = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת התווים</div><div class="bSub">זהה את ראש התו: קו עזר, רווח או קו תחתון.</div>'
          + '<svg data-bonus-staff viewBox="0 0 402 240" dir="ltr" role="img" aria-label="תו אקראי במפתח סול" style="width:100%;height:auto;display:block"></svg>'
          + '<div class="bChip" data-bonus-name></div><div class="stepper" dir="ltr"><div class="unit">'
          + '<button type="button" data-bonus-delta="-1" aria-label="השם הקודם">←</button>'
          + '<span class="var" data-bonus-guess dir="rtl" style="font-family:Heebo,sans-serif;min-width:44px"></span>'
          + '<button type="button" data-bonus-delta="1" aria-label="השם הבא">→</button></div></div>'
          + '<div class="bForms" data-bonus-rule hidden></div><div class="bOk" data-bonus-ok hidden role="status"></div>'
          + '<button type="button" class="bDice" data-bonus-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll style="min-height:44px;min-width:44px">תו חדש ↻</button>';
        function updateGuess() {
          box.querySelector('[data-bonus-guess]').textContent = NAMES[guess];
          box.querySelector('[data-bonus-name]').textContent = 'הבחירה: ' + NAMES[guess];
          box.querySelector('[data-bonus-ok]').hidden = true;
          box.querySelector('[data-bonus-rule]').hidden = true;
        }
        function rollNote() {
          sample = Math.floor(Math.random() * 3); guess = 0;
          box.querySelector('[data-bonus-staff]').innerHTML = staff() + noteShape(230, sample, PAL.main);
          updateGuess();
        }
        box.querySelectorAll('[data-bonus-delta]').forEach(function (buttonNode) {
          buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-bonus-delta')), 0, 2); ctx.sfx('tick'); updateGuess(); });
        });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var statusNode = box.querySelector('[data-bonus-ok]');
          statusNode.hidden = false; statusNode.style.color = guess === sample ? PAL.good : BAD;
          if (guess === sample) {
            ctx.sfx('correct'); statusNode.textContent = 'נכון! זה ' + NAMES[sample] + '.';
            box.querySelector('[data-bonus-rule]').textContent = NAMES[sample] + ' נמצא ' + PLACES[sample] + '.';
            box.querySelector('[data-bonus-rule]').hidden = false;
          } else { ctx.sfx('error'); statusNode.textContent = 'בחרת ' + NAMES[guess] + ', שנמצא ' + PLACES[guess] + '. בדוק שוב את ראש התו בציור.'; }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { ctx.sfx('click'); rollNote(); });
        rollNote();
      }
    }
  });
}());
