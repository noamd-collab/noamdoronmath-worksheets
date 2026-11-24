/** מילים ותמונות — original beginner English lesson, offline and RTL. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var WORDS = ['apple', 'cat', 'book'];
  var NAMES = ['תפוח', 'חתול', 'ספר'];
  var CENTRES = [65, 201, 337];
  var BAD = '#b91c1c';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function en(text) { return '<bdi dir="ltr" lang="en">' + text + '</bdi>'; }
  function latin(x, y, text, size, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="ltr" lang="en" xml:lang="en" font-family="Secular One, sans-serif" font-size="' + (size || 22) + '" text-anchor="middle" fill="' + PAL.ink + '">' + text + '</text>';
  }
  function heb(x, y, text, size, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" direction="rtl" font-family="Heebo, sans-serif" font-weight="700" font-size="' + (size || 16) + '" text-anchor="middle" fill="' + PAL.ink + '">' + text + '</text>';
  }
  /** Own geometric drawings; no labels embedded in the pictures. */
  function illustration(kind, x, y, scale) {
    var shapes = '';
    if (kind === 0) {
      shapes = '<path d="M0 -23 C-22 -41 -46 -17 -39 10 C-32 39 -16 43 0 34 C16 43 32 39 39 10 C46 -17 22 -41 0 -23Z" fill="#e44561" stroke="#91263d" stroke-width="3"/>'
        + '<path d="M0 -23 Q-2 -40 7 -47" fill="none" stroke="#704128" stroke-width="5" stroke-linecap="round"/>'
        + '<path d="M7 -34 Q32 -57 32 -34 Q22 -23 7 -34Z" fill="#2a864f" stroke="#175c34" stroke-width="2"/>'
        + '<path d="M-24 -14 Q-30 -4 -25 7" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>';
    } else if (kind === 1) {
      shapes = '<path d="M21 31 Q57 32 47 4" fill="none" stroke="#bd773b" stroke-width="10" stroke-linecap="round"/>'
        + '<ellipse cx="0" cy="18" rx="27" ry="29" fill="#e4a158" stroke="#754522" stroke-width="3"/>'
        + '<path d="M-27 -12 L-29 -44 L-8 -30 M8 -30 L29 -44 L27 -12" fill="#e4a158" stroke="#754522" stroke-width="3" stroke-linejoin="round"/>'
        + '<ellipse cx="0" cy="-12" rx="30" ry="26" fill="#e4a158" stroke="#754522" stroke-width="3"/>'
        + '<circle cx="-11" cy="-16" r="3.5" fill="' + PAL.ink + '"/><circle cx="11" cy="-16" r="3.5" fill="' + PAL.ink + '"/>'
        + '<path d="M-4 -5 L4 -5 L0 0Z" fill="#91263d"/><path d="M0 0 L0 5 M-7 5 Q0 12 7 5 M-18 -3 L-37 -7 M-18 4 L-37 6 M18 -3 L37 -7 M18 4 L37 6" stroke="#754522" stroke-width="2" fill="none"/>'
        + '<path d="M-20 43 L-8 43 M8 43 L20 43" stroke="#754522" stroke-width="5" stroke-linecap="round"/>';
    } else {
      shapes = '<path d="M-44 -33 Q-19 -42 0 -29 Q19 -42 44 -33 L44 34 Q20 25 0 39 Q-20 25 -44 34Z" fill="#fff" stroke="#2867a1" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M0 -29 V39" stroke="#2867a1" stroke-width="3"/>'
        + '<path d="M-33 -19 L-10 -16 M-33 -7 L-10 -4 M-33 5 L-10 8 M-33 17 L-10 20 M10 -16 L33 -19 M10 -4 L33 -7 M10 8 L33 5 M10 20 L33 17" stroke="#7796b7" stroke-width="3" stroke-linecap="round"/>';
    }
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + (scale || 1) + ')" aria-hidden="true" style="pointer-events:none">' + shapes + '</g>';
  }
  function markEnglish(ctx) {
    var cardRoot = ctx.svg.closest('#card');
    cardRoot.querySelectorAll('bdi.math, #opts .opt').forEach(function (node) {
      if (/[a-zA-Z]/.test(node.textContent) && !/[\u0590-\u05FF]/.test(node.textContent)) {
        node.setAttribute('lang', 'en'); node.setAttribute('dir', 'ltr');
      }
    });
  }
  function quizArt(kind, sentence) {
    return function (ctx) {
      ctx.draw('<rect x="66" y="12" width="270" height="166" rx="20" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
        + illustration(kind, 201, 96, 1.25) + (sentence ? latin(201, 212, sentence, 22) : ''));
      markEnglish(ctx);
    };
  }
  function keyboardIndex(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return -1;
    return 0;
  }

  /** Match and classify share selection + commit; only the learning task changes. */
  function placementScene(ctx, classify) {
    var sequence = classify ? [2, 0, 1] : [0, 1, 2];
    var round = 0, selected = 0, accepted = false, complete = false;
    var mx = CENTRES[0], my = 284;
    var labels = classify ? ['מאכל', 'בעל חיים', 'חפץ לקריאה'] : ['תמונה שמאלית', 'תמונה אמצעית', 'תמונה ימנית'];
    var targetButtons = [];
    var html = heb(201, 25, classify ? 'לאיזו קבוצה זה שייך?' : 'איזו תמונה מתאימה למילה?', 18)
      + heb(201, 222, 'הכרטיס שלך', 15)
      + '<text id="roundCount" x="201" y="343" direction="ltr" font-family="Secular One, sans-serif" font-size="15" text-anchor="middle" fill="' + PAL.dark + '"></text>';
    CENTRES.forEach(function (cx, i) {
      html += '<rect id="zone' + i + '" x="' + (cx - 56) + '" y="45" width="112" height="148" rx="16" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>';
      html += classify ? heb(cx, 119, labels[i], i === 2 ? 15 : 17) : illustration([2, 0, 1][i], cx, 114, .94);
    });
    html += '<g id="wordHandle" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="2" aria-valuenow="0" aria-label="כרטיס מילה; חצים בוחרים יעד, אנטר או רווח בודקים" style="cursor:grab;touch-action:none">'
      + '<rect x="-59" y="-34" width="118" height="68" rx="14" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="3"/>'
      + latin(0, 9, '', 25, 'cardWord') + '</g>';
    ctx.draw(html);
    var handle = ctx.el('wordHandle');
    var statusBox = ctx.extra('<div class="sceneStrip"><b>היעד המסומן</b><div data-target aria-live="polite" style="font-weight:700"></div></div>');
    function renderPlacement() {
      handle.setAttribute('transform', 'translate(' + mx + ' ' + my + ')');
      handle.setAttribute('aria-valuenow', selected);
      handle.setAttribute('aria-valuetext', labels[selected]);
      handle.setAttribute('aria-label', 'כרטיס ' + WORDS[sequence[round]] + '; חצים בוחרים יעד, אנטר או רווח בודקים. אחרי התאמה אנטר פותח כרטיס נוסף');
      ctx.el('cardWord').textContent = WORDS[sequence[round]];
      ctx.el('roundCount').textContent = String(round + 1) + ' · 3';
      statusBox.querySelector('[data-target]').textContent = labels[selected];
      CENTRES.forEach(function (_, i) {
        ctx.el('zone' + i).setAttribute('stroke', selected === i ? PAL.main : PAL.line);
        ctx.el('zone' + i).setAttribute('stroke-width', selected === i ? 4 : 2);
        targetButtons[i].setAttribute('aria-pressed', String(selected === i));
      });
      nextCard.disabled = !accepted || round === 2;
      ctx.set({ round: round, selection: selected, matched: accepted });
    }
    function selectTarget(i) {
      selected = clamp(i, 0, 2); mx = CENTRES[selected]; my = 284;
      ctx.sfx('tick'); renderPlacement();
    }
    function expectedTarget() {
      var kind = sequence[round];
      return classify ? [0, 1, 2][kind] : [1, 2, 0][kind];
    }
    function commitTarget(i) {
      if (accepted) { ctx.note('הכרטיס הזה כבר מתאים. פתח את הכרטיס הבא בכפתור או באנטר על הכרטיס.', 'good'); return; }
      selected = i; mx = CENTRES[i]; my = 284;
      var kind = sequence[round];
      accepted = i === expectedTarget();
      renderPlacement();
      if (!accepted) {
        ctx.el('zone' + i).setAttribute('stroke', BAD);
        ctx.sfx('error');
        if (classify) {
          var why = kind === 0 ? 'תפוח הוא מאכל, לא בעל חיים ולא חפץ לקריאה.'
            : kind === 1 ? 'חתול הוא בעל חיים. לא ממיינים אותו לפי הצבע או לפי מקום התמונה.'
              : 'ספר הוא חפץ שקוראים בו. הוא לא מאכל ולא בעל חיים.';
          ctx.note('בחרת ' + labels[i] + '. ' + why);
        } else {
          ctx.note('בתמונה שבחרת יש ' + NAMES[[2, 0, 1][i]] + ', אבל המילה ' + m(WORDS[kind]) + ' פירושה ' + NAMES[kind] + '. התאם לפי המשמעות, לא לפי מקום הכרטיס.');
        }
      } else {
        ctx.el('zone' + i).setAttribute('fill', PAL.goodSoft);
        ctx.sfx('correct');
        ctx.note('נכון: ' + m(WORDS[kind]) + ' הוא ' + NAMES[kind] + (classify ? ', בקבוצה ' + labels[i] : '') + '. ' + (round < 2 ? 'פתח את הכרטיס הבא.' : 'כל הכרטיסים הותאמו!'), 'good');
        if (round === 2 && !complete) { complete = true; ctx.solved(); }
      }
      markEnglish(ctx);
    }
    function advanceCard() {
      if (!accepted || round === 2) return;
      round++; accepted = false; selected = 0; mx = CENTRES[0]; my = 284;
      CENTRES.forEach(function (_, i) { ctx.el('zone' + i).setAttribute('fill', '#fff'); });
      renderPlacement(); ctx.sfx('click');
      ctx.note('כרטיס חדש. בחר יעד לפי המשמעות ובדוק.');
    }
    labels.forEach(function (label, i) {
      var control = ctx.button(label, function () { commitTarget(i); }, { id: 'target' + i, ghost: true });
      control.style.minWidth = '44px'; targetButtons.push(control);
    });
    var nextCard = ctx.button('כרטיס הבא', advanceCard, { id: 'nextCard' });
    nextCard.style.minWidth = '44px';
    handle.addEventListener('keydown', function (event) {
      var change = keyboardIndex(event);
      if (change) { event.preventDefault(); selectTarget(selected + change); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectTarget(event.key === 'Home' ? 0 : 2); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (accepted) advanceCard(); else commitTarget(selected); }
    });
    ctx.drag(handle, {
      start: function () { handle.focus(); },
      move: function (x, y) {
        mx = clamp(x, 60, 342); my = clamp(y, 65, 310);
        selected = clamp(Math.round((mx - 65) / 136), 0, 2);
        renderPlacement();
      },
      end: function () {
        if (my <= 202) commitTarget(selected);
        else { mx = CENTRES[selected]; my = 284; renderPlacement(); ctx.note('היעד סומן. הנח בתמונה או בקבוצה, או בדוק בכפתור או באנטר.'); }
      }
    });
    renderPlacement(); ctx.note('בחר יעד בחיצים ואז אנטר או רווח; אפשר גם בכפתורים או בגרירה אל היעד.');
  }
  function matchWords(ctx) { placementScene(ctx, false); }
  function sortWords(ctx) { placementScene(ctx, true); }

  /** Context: each word card can be dragged into the one missing-word slot. */
  function sentenceScene(ctx) {
    var samples = [
      { kind: 0, before: 'I eat an', after: '.', hint: 'אני אוכל משהו. איזו מילה מתאימה לאיור?' },
      { kind: 2, before: 'I read a', after: '.', hint: 'אני קורא משהו. איזו מילה מתאימה לפעולה?' },
      { kind: 1, before: 'The', after: 'says meow.', hint: 'מי אומר מיאו? חפש את בעל החיים.' }
    ];
    var activeSample = 0, chosen = 0, acceptedSentence = false, allDone = false;
    var cardHandles = [], wordButtons = [];
    ctx.draw('<rect x="14" y="10" width="374" height="181" rx="18" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>'
      + '<g id="contextPicture"></g><rect id="blankZone" x="125" y="200" width="152" height="54" rx="12" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="3" stroke-dasharray="6 4"/>'
      + latin(201, 236, '___', 26, 'blankWord')
      + WORDS.map(function (word, i) {
        return '<g id="sentenceHandle' + i + '" tabindex="0" role="button" aria-label="מילה ' + word + '; חצים עוברים בין המילים, אנטר או רווח מכניסים למשפט" style="cursor:grab;touch-action:none" transform="translate(' + CENTRES[i] + ' 305)">'
          + '<rect x="-58" y="-34" width="116" height="68" rx="13" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-width="2"/>' + latin(0, 8, word, 24) + '</g>';
      }).join(''));
    var contextBox = ctx.extra('<div class="sceneStrip"><b>השלם את המשפט משמאל לימין</b><div data-sentence dir="ltr" lang="en" style="font-family:Secular One,sans-serif;font-size:21px"></div></div>');
    function paintSentence() {
      var sample = samples[activeSample];
      ctx.el('contextPicture').innerHTML = illustration(sample.kind, 201, 102, 1.35);
      contextBox.querySelector('[data-sentence]').textContent = sample.before + ' ' + (acceptedSentence ? WORDS[sample.kind] : '___') + ' ' + sample.after;
      ctx.el('blankWord').textContent = acceptedSentence ? WORDS[sample.kind] : '___';
      ctx.el('blankZone').setAttribute('fill', acceptedSentence ? PAL.goodSoft : PAL.warmSoft);
      ctx.el('blankZone').setAttribute('stroke', acceptedSentence ? PAL.good : PAL.warm);
      cardHandles.forEach(function (node, i) {
        node.querySelector('rect').setAttribute('stroke-width', i === chosen ? 4 : 2);
        wordButtons[i].setAttribute('aria-pressed', String(i === chosen));
      });
      anotherSentence.disabled = !acceptedSentence || activeSample === 2;
      ctx.set({ round: activeSample, selection: chosen, matched: acceptedSentence });
    }
    function commitWord(i) {
      if (acceptedSentence) { ctx.note('המשפט כבר שלם. פתח את המשפט הבא.', 'good'); return; }
      chosen = i;
      var sample = samples[activeSample];
      acceptedSentence = i === sample.kind;
      paintSentence();
      if (acceptedSentence) {
        ctx.sfx('correct');
        ctx.note('נכון! ' + (sample.kind === 0 ? 'אני אוכל תפוח.' : sample.kind === 2 ? 'אני קורא ספר.' : 'החתול אומר מיאו.') + (activeSample < 2 ? ' פתח את המשפט הבא.' : ' השלמת את כל המשפטים.'), 'good');
        if (activeSample === 2 && !allDone) { allDone = true; ctx.solved(); }
      } else {
        ctx.sfx('error'); ctx.el('blankZone').setAttribute('stroke', BAD);
        ctx.note(sample.kind === 0 ? 'המילה שבחרת היא ' + NAMES[i] + '. במשפט אוכלים משהו, ובאיור יש תפוח. לא קוראים אותו ולא מדובר בבעל חיים.'
          : sample.kind === 2 ? 'המילה שבחרת היא ' + NAMES[i] + '. הפעולה היא קריאה: צריך חפץ עם דפים, לא מאכל ולא בעל חיים.'
            : 'המילה שבחרת היא ' + NAMES[i] + '. תפוח וספר אינם אומרים מיאו; במשפט מחפשים בעל חיים.');
      }
    }
    function advanceSentence() {
      if (!acceptedSentence || activeSample === 2) return;
      activeSample++; acceptedSentence = false; chosen = 0;
      paintSentence(); ctx.sfx('click'); ctx.note(samples[activeSample].hint);
    }
    WORDS.forEach(function (word, i) {
      var node = ctx.el('sentenceHandle' + i);
      cardHandles.push(node);
      var wordButton = ctx.button(word, function () { commitWord(i); }, { id: 'word' + i, ghost: true });
      wordButton.setAttribute('dir', 'ltr'); wordButton.setAttribute('lang', 'en'); wordButton.style.minWidth = '44px'; wordButtons.push(wordButton);
      node.addEventListener('keydown', function (event) {
        var delta = keyboardIndex(event);
        if (delta) {
          event.preventDefault(); chosen = clamp(i + delta, 0, 2); paintSentence(); cardHandles[chosen].focus(); ctx.sfx('tick');
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (acceptedSentence) advanceSentence(); else commitWord(i);
        }
      });
      var dragX = CENTRES[i], dragY = 305;
      ctx.drag(node, {
        start: function () { chosen = i; node.focus(); paintSentence(); dragX = CENTRES[i]; dragY = 305; },
        move: function (x, y) {
          dragX = clamp(x, 59, 343); dragY = clamp(y, 45, 314);
          node.setAttribute('transform', 'translate(' + dragX + ' ' + dragY + ')');
        },
        end: function () {
          node.setAttribute('transform', 'translate(' + CENTRES[i] + ' 305)');
          if (dragY < 271 && dragY > 170 && Math.abs(dragX - 201) < 105) commitWord(i);
          else ctx.note('המילה חזרה לשורה. הנח אותה במשבצת, או בחר בכפתור או בחיצים ואנטר.');
        }
      });
    });
    var anotherSentence = ctx.button('משפט הבא', advanceSentence, { id: 'nextSentence' });
    anotherSentence.style.minWidth = '44px';
    paintSentence(); ctx.note(samples[0].hint);
  }

  var steps = [
    {
      mode: 'intro', tA: 'מילים ותמונות', sub: 'מזהים מילה, בוחרים תמונה ומשלימים משפט באנגלית.',
      tip: 'שלום, אני אליהו. נלמד שלוש מילים באנגלית בעזרת תמונות ומשפטים קצרים.',
      emoji: '◆', eq: 'מילה ← תמונה ← משפט',
      art: '<svg viewBox="0 0 402 120" width="402" role="img" aria-label="תפוח, חתול וספר">' + illustration(0, 66, 63, .85) + illustration(1, 201, 63, .85) + illustration(2, 336, 63, .85) + '</svg>',
      note: 'אפשר לשחק בגרירה, בכפתורים או בחיצים ואנטר. הצלילים הם רק משוב — אפשר להשתיק ולשחק עד הסוף.',
      cue: 'מוכן לגלות מילים?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מילה מחפשת תמונה', sub: 'התאם כל כרטיס בגרירה, בכפתורים או בחיצים ואנטר או רווח.',
      tip: 'התאם לפי המשמעות, לא לפי צבע או מיקום. אחרי התאמה פתח את הכרטיס הבא.',
      aspect: [402, 354], alt: 'איורי ספר, תפוח וחתול, וכרטיס מילה באנגלית. בגרירה, בכפתורים או בחיצים ואנטר בוחרים תמונה.',
      cue: 'התאם את שלושת הכרטיסים', cueDone: 'שלוש מילים מצאו תמונה. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'בחר תמונה בכפתור, או בחיצים ואנטר על הכרטיס, או בגרירה.' }, setup: matchWords, paint: markEnglish
    },
    {
      mode: 'quiz', tA: 'איזו מילה מתאימה לאיור?', sub: 'קרא את המילים ובחר לפי התמונה.',
      tip: 'חפש אוזניים, שפם וזנב. המילה צריכה לציין את בעל החיים הזה.', btn: 'המשך ←',
      aspect: [402, 190], alt: 'איור של חתול עם אוזניים, שפם וזנב', setup: quizArt(1), paint: markEnglish,
      win: 'בדיוק. זיהית חתול והתאמת אליו את המילה.', wrongSay: 'אל תבחר לפי אורך המילה. בדוק מה רואים באיור.',
      opts: [
        { t: 'cat', c: true, f: 'נכון: ' + m('cat') + ' פירושה חתול, וזה בעל החיים שבאיור.' },
        { t: 'apple', f: 'בלבלת בין מאכל לבעל חיים: ' + m('apple') + ' הוא תפוח, לא חתול.' },
        { t: 'book', f: 'בחרת חפץ לקריאה: ' + m('book') + ' הוא ספר, ולא בעל החיים שבאיור.' },
        { t: 'cap', f: 'המילה דומה בכתיב, אבל ' + m('cap') + ' היא כובע. האות האחרונה משנה את המילה.' }
      ],
      hints: ['התחל בזיהוי הדבר שבציור, ורק אז קרא את המילים.', 'זה בעל חיים שאומר מיאו.', 'המילה מתחילה באות ' + m('c') + ' ומסתיימת באות ' + m('t') + '.']
    },
    {
      mode: 'scene', tA: 'ממיינים לפי משמעות', sub: 'שייך את הכרטיס לקבוצה בגרירה, בכפתורים או בחיצים ואנטר או רווח.',
      tip: 'כאן לא מחפשים תמונה זהה. מחליטים אם המילה היא מאכל, בעל חיים או חפץ לקריאה.',
      aspect: [402, 354], alt: 'שלוש קבוצות: מאכל, בעל חיים וחפץ לקריאה, וכרטיס באנגלית. בגרירה, בכפתורים או בחיצים ואנטר משייכים לקבוצה.',
      cue: 'מיין את שלושת הכרטיסים', cueDone: 'מיינת לפי המשמעות. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'קרא את המילה ואז בחר קבוצה בכפתור, בגרירה או בחיצים ואנטר.' }, setup: sortWords, paint: markEnglish
    },
    {
      mode: 'quiz', tA: 'איזו מילה היא מאכל?', sub: 'בחר את המילה המציינת פרי שאוכלים.',
      tip: 'הקבוצה נקבעת לפי המשמעות. חפש מאכל, לא בעל חיים או חפץ.', btn: 'המשך ←',
      aspect: [402, 190], alt: 'צלחת ריקה, סימן לקבוצת המאכלים', setup: function (ctx) { ctx.draw('<ellipse cx="201" cy="95" rx="117" ry="61" fill="#fff" stroke="' + PAL.line + '" stroke-width="4"/><ellipse cx="201" cy="95" rx="84" ry="39" fill="' + PAL.warmSoft + '" stroke="' + PAL.warm + '" stroke-width="2"/>'); }, paint: markEnglish,
      win: 'נכון. זיהית את הפרי לפי משמעות המילה.', wrongSay: 'שאל מה פירוש כל מילה, ומה אפשר לאכול.',
      opts: [
        { t: 'cat', f: 'בלבלת בין בעל חיים למאכל: ' + m('cat') + ' הוא חתול, לא פרי.' },
        { t: 'apple', c: true, f: 'נכון: ' + m('apple') + ' הוא תפוח — פרי שאוכלים.' },
        { t: 'book', f: 'ספר קוראים ולא אוכלים: ' + m('book') + ' שייך לחפצים לקריאה.' },
        { t: 'cap', f: 'כובע לובשים, לא אוכלים. ' + m('cap') + ' אינו פרי.' }
      ], hints: ['תחשוב על הקבוצות שפגשת במיון.', 'הפרי מופיע גם באיור הראשון שראית.', 'חפש את המילה שמתחילה באות ' + m('a') + ' ופירושה תפוח.']
    },
    {
      mode: 'scene', tA: 'מילה בתוך משפט', sub: 'השלם את המשבצת בגרירה, בכפתורים או בחיצים ואנטר או רווח.',
      tip: 'קרא משמאל לימין. התמונה והפעולה במשפט יעזרו לך לבחור מילה מתאימה.',
      aspect: [402, 354], alt: 'איור מעל משבצת למילה חסרה, ושלוש מילים באנגלית מתחתיה. בגרירה, בכפתורים או בחיצים ואנטר משלימים משפט.',
      cue: 'השלם שלושה משפטים', cueDone: 'שלושה משפטים שלמים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'scene', text: 'בחר מילה בכפתור, בגרירה למשבצת או בחיצים ואנטר. שים לב לפעולה במשפט.' }, setup: sentenceScene, paint: markEnglish
    },
    {
      mode: 'quiz', tA: 'מה חסר במשפט?', sub: 'השלם לפי הפעולה ולפי האיור.',
      tip: 'במשפט אני קורא משהו. איזה חפץ מתאים לקריאה?', btn: 'המשך ←',
      aspect: [402, 228], alt: 'איור ספר פתוח והמשפט באנגלית: איי ריד איי, ואז מילה חסרה', setup: quizArt(2, 'I read a ___.'), paint: markEnglish,
      win: 'נכון. המילה מתאימה גם לאיור וגם לפעולה.', wrongSay: 'בדוק מה עושים במשפט, לא רק איזו מילה מוכרת לך.',
      opts: [
        { t: 'apple', f: 'תפוח אוכלים; כאן קוראים. ' + m('apple') + ' לא מתאים לפעולה ולא לאיור.' },
        { t: 'cat', f: 'חתול הוא בעל חיים, לא חפץ עם דפים. ' + m('cat') + ' לא משלים את משפט הקריאה.' },
        { t: 'book', c: true, f: 'נכון: ' + m('I read a book.') + ' פירושו אני קורא ספר. הפעולה והאיור מתאימים.' },
        { t: 'cap', f: 'בחרת כובע בגלל צורה דומה למילה אחרת. ' + m('cap') + ' אינו החפץ שקוראים בו.' }
      ], hints: ['התחל בפעולה: מה עושים עם הדבר שבציור?', 'רואים דפים וכריכה.', 'החפץ הוא ספר. חפש את המילה שמתחילה באות ' + m('b') + '.']
    },
    {
      mode: 'quiz', tA: 'מה אומר המשפט?', sub: 'בחר את המשמעות המדויקת, לא רק מילה אחת שאתה מזהה.',
      tip: 'שים לב גם לפעולה וגם לדבר שמופיע במשפט.', btn: 'לסיכום ←',
      aspect: [402, 228], alt: 'איור תפוח והמשפט באנגלית: איי איט אן אפל', setup: quizArt(0, 'I eat an apple.'), paint: markEnglish,
      win: 'מעולה. הבנת את המשפט השלם ולא רק את המילה.', wrongSay: 'התאם את הפעולה ואת שם הדבר יחד.',
      opts: [
        { t: 'אני קורא תפוח.', f: 'זיהית תפוח, אבל החלפת את הפעולה. ' + m('eat') + ' פירושה אוכל, לא קורא.' },
        { t: 'אני אוכל ספר.', f: 'זיהית את פעולת האכילה, אבל בלבלת את שם הדבר. ' + m('apple') + ' הוא תפוח, לא ספר.' },
        { t: 'אני רואה חתול.', f: 'החלפת גם את הפעולה וגם את שם הדבר. כאן אוכלים תפוח, ולא רואים חתול.' },
        { t: 'אני אוכל תפוח.', c: true, f: 'נכון: הפעולה היא אכילה, והדבר הוא תפוח. זו משמעות המשפט השלם.' }
      ], hints: ['בדוק בנפרד את הפעולה ואת הדבר.', 'הפועל מציין אכילה; האיור הוא פרי.', 'בחר משפט שיש בו גם אוכל וגם תפוח.']
    },
    {
      mode: 'finish', tA: 'סיימת מילים ותמונות', sub: 'התאמת לפי משמעות, מיינת לקבוצות והשלמת משפטים באנגלית.',
      tip: 'כל הכבוד. עכשיו קרא מילה, דמיין את הדבר ובדוק איך הוא מתאים למשפט.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'הכלל שלקחת איתך:', formula: 'מתאימים לפי משמעות והקשר'
    }
  ];

  window.NoamGame.boot({
    slug: 'milim-vetmunot', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'מילה ותמונה', math: '' },
      { step: 4, name: 'מיון לפי משמעות', math: '' },
      { step: 6, name: 'מילה בהקשר', math: '' },
      { step: 7, name: 'הבנת משפט', math: '' }
    ],
    bonus: {
      label: 'מכונת המילים', closeLabel: 'סגור את המכונה', hint: 'זהה את האיור ובחר מילה. אפשר להמשיך גם בלי צלילים.',
      setup: function (box, ctx) {
        var question = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת המילים</div><div class="bSub">בחר מילה שמתאימה לאיור. התרגול אינו משנה את הניקוד.</div>'
          + '<svg data-bonus-picture viewBox="0 0 402 170" role="img" aria-label="איור לתרגול אוצר מילים" style="display:block;width:100%;height:auto"></svg>'
          + '<div class="bChip" data-guess dir="ltr" lang="en"></div>'
          + '<div class="stepper" dir="ltr"><div class="unit"><button type="button" data-prev aria-label="מילה קודמת">←</button><span style="font-size:13px" dir="rtl">בחירת מילה</span><button type="button" data-next aria-label="מילה הבאה">→</button></div></div>'
          + '<div class="bForms" data-meaning hidden></div><div class="bOk" data-result role="status" hidden></div>'
          + '<button type="button" class="bDice" data-check style="min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-new style="min-width:44px">איור חדש ↻</button>';
        var feedbackNode = box.querySelector('[data-result]');
        function bonusSelect(delta) {
          guess = (guess + delta + 3) % 3;
          box.querySelector('[data-guess]').textContent = WORDS[guess];
          feedbackNode.hidden = true; box.querySelector('[data-meaning]').hidden = true; ctx.sfx('tick');
        }
        function newPicture() {
          var previous = question;
          question = (previous + 1 + Math.floor(Math.random() * 2)) % 3;
          guess = 0;
          box.querySelector('[data-bonus-picture]').innerHTML = illustration(question, 201, 88, 1.5);
          box.querySelector('[data-bonus-picture]').setAttribute('aria-label', 'איור של ' + NAMES[question]);
          bonusSelect(0);
        }
        box.querySelector('[data-prev]').addEventListener('click', function () { bonusSelect(-1); });
        box.querySelector('[data-next]').addEventListener('click', function () { bonusSelect(1); });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var right = guess === question;
          feedbackNode.hidden = false; feedbackNode.style.color = right ? PAL.good : BAD;
          feedbackNode.textContent = right ? 'נכון! המילה מתאימה לאיור.' : 'בחרת ' + NAMES[guess] + ', אבל באיור יש ' + NAMES[question] + '. התאם לפי המשמעות.';
          var meaningNode = box.querySelector('[data-meaning]');
          meaningNode.hidden = !right;
          if (right) meaningNode.innerHTML = en(WORDS[question]) + ' — ' + NAMES[question];
          ctx.sfx(right ? 'correct' : 'error');
        });
        box.querySelector('[data-new]').addEventListener('click', newPicture);
        box.querySelector('[data-guess]').addEventListener('keydown', function (event) {
          var delta = keyboardIndex(event);
          if (delta) { event.preventDefault(); bonusSelect(delta); }
          else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); box.querySelector('[data-check]').click(); }
        });
        box.querySelector('[data-guess]').setAttribute('tabindex', '0');
        box.querySelector('[data-guess]').setAttribute('role', 'group');
        box.querySelector('[data-guess]').setAttribute('aria-label', 'המילה שבחרת; חצים משנים, אנטר או רווח בודקים');
        newPicture();
      }
    }
  });
}());
