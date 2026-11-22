/** שינוי באחוזים: מכפיל, בסיס מקורי ושינויים עוקבים. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var MUTED = '#475569', BAD = '#b91c1c';

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function rounded(value) { return Math.round(value * 100) / 100; }
  function num(value) { var clean = rounded(value); return clean < 0 ? '−' + Math.abs(clean) : String(clean); }
  function signed(value) { return (value > 0 ? '+' : '') + num(value); }
  function mathSvg(id, x, y, text, size, colour) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 16) + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function hebSvg(x, y, text) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="14" font-weight="700" fill="' + MUTED + '">' + text + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function ruler(baseWidth, maxPercent, y, top) {
    var out = '<line x1="50" y1="' + y + '" x2="' + (50 + baseWidth * maxPercent / 100) + '" y2="' + y + '" stroke="' + PAL.ink + '" stroke-width="2"/>';
    for (var tick = 0; tick <= maxPercent; tick += 50) {
      var xpos = 50 + baseWidth * tick / 100;
      out += '<line x1="' + xpos + '" y1="' + (y - 5) + '" x2="' + xpos + '" y2="' + (y + 5) + '" stroke="' + PAL.ink + '"/>'
        + mathSvg('', xpos, y + 23, tick + '%', 13, tick === 100 ? PAL.dark : MUTED);
    }
    out += '<line x1="' + (50 + baseWidth) + '" y1="' + top + '" x2="' + (50 + baseWidth) + '" y2="' + y + '" stroke="' + PAL.dark + '" stroke-width="2" stroke-dasharray="5 4"/>';
    return out;
  }
  function barMarkup(id, y, width, colour, opacity) {
    return '<rect id="' + id + '" x="50" y="' + y + '" width="' + width + '" height="24" rx="5" fill="' + colour + '" opacity="' + (opacity || 1) + '"/>';
  }
  function handleMarkup(id, label, low, high, value, colour) {
    return '<g id="' + id + '" tabindex="0" role="slider" aria-label="' + label + '" aria-valuemin="' + low + '" aria-valuemax="' + high + '" aria-valuenow="' + value + '" style="cursor:grab">'
      + '<circle r="32" fill="transparent"/><circle r="9" fill="#ffffff" stroke="' + colour + '" stroke-width="4"/></g>';
  }
  function bindKeys(handle, getValue, setValue, low, high, small, big) {
    handle.addEventListener('keydown', function (event) {
      var delta = 0;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = small;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -small;
      else if (event.key === 'PageUp') delta = big;
      else if (event.key === 'PageDown') delta = -big;
      else if (event.key === 'Home') { event.preventDefault(); setValue(low); return; }
      else if (event.key === 'End') { event.preventDefault(); setValue(high); return; }
      else return;
      event.preventDefault(); setValue(getValue() + delta);
    });
  }
  function putHandle(handle, x, y, value, suffix) {
    handle.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    handle.setAttribute('aria-valuenow', value);
    handle.setAttribute('aria-valuetext', m(signed(value)) + suffix);
  }
  function stepperMarkup(key, label, deltas) {
    return '<div class="stepper" dir="ltr" style="margin-top:8px"><div class="unit" dir="ltr" style="padding:6px;gap:5px;max-width:100%;flex-wrap:wrap;justify-content:center">'
      + '<span dir="rtl" style="font:700 12px Heebo,sans-serif;flex-basis:100%;text-align:center">' + label + '</span>'
      + deltas.filter(function (delta) { return delta < 0; }).map(function (delta) { return stepButton(key, delta, label); }).join('')
      + '<bdi class="var math" dir="ltr" data-value="' + key + '" style="min-width:45px" aria-live="polite"></bdi>'
      + deltas.filter(function (delta) { return delta > 0; }).map(function (delta) { return stepButton(key, delta, label); }).join('') + '</div></div>';
  }
  function stepButton(key, delta, label) {
    return '<button type="button" data-key="' + key + '" data-delta="' + delta + '" style="min-height:44px;min-width:44px;flex-shrink:0" aria-label="' + (delta < 0 ? 'הקטן' : 'הגדל') + ' את ' + label + ' ב־' + m(String(Math.abs(delta))) + '">' + signed(delta) + '</button>';
  }
  function bindButtons(box, setter) {
    box.querySelectorAll('[data-delta]').forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () { setter(buttonNode.getAttribute('data-key'), Number(buttonNode.getAttribute('data-delta'))); });
    });
  }
  function award(ctx) { ctx.sfx('correct'); ctx.burst(14); ctx.solved(); }

  function multiplierScene(ctx) {
    var percent = 0, completed = false;
    ctx.draw(hebSvg(201, 28, 'המחיר המקורי נשאר ברקע')
      + '<rect x="50" y="94" width="200" height="40" rx="6" fill="' + PAL.line + '" opacity=".45"/>'
      + mathSvg('', 250, 73, '80', 18, PAL.dark)
      + ruler(200, 150, 160, 81)
      + barMarkup('priceBar', 102, 200, PAL.main)
      + handleMarkup('priceHandle', 'השינוי באחוזים; בגרירה, בכפתורים או בחיצים. מקשי עמוד משנים בחמש נקודות אחוז', -50, 50, 0, PAL.main));
    var handle = ctx.el('priceHandle');
    var box = ctx.extra('<div class="sceneStrip"><b>המכפיל והמחיר החדש</b><div data-price style="font-size:18px" aria-live="polite"></div></div>'
      + stepperMarkup('p', 'אחוז השינוי', [-5, -1, 1, 5]));
    ctx.register('controls', box);
    function update(acted) {
      var multiplier = 1 + percent / 100, price = rounded(80 * multiplier);
      ctx.el('priceBar').setAttribute('width', 200 * multiplier);
      putHandle(handle, 50 + 200 * multiplier, 114, percent, ' אחוז שינוי');
      box.querySelector('[data-value="p"]').textContent = signed(percent) + '%';
      box.querySelector('[data-price]').innerHTML = 'מכפיל ' + bdi('× ' + num(multiplier)) + ', מחיר חדש ' + bdi(num(price)) + ' ₪';
      ctx.caption(m('80 · (1 + (' + num(percent) + ') ÷ 100) = ' + num(price)));
      if (percent === -15) {
        ctx.note('נכון: הירידה היא ' + m('15%') + ', המכפיל ' + m('0.85') + ', ולכן ' + m('80 · 0.85 = 68') + ' ₪.', 'good');
        if (acted && !completed) { completed = true; award(ctx); }
      } else if (percent === 15) {
        ctx.note('הגודל נכון, אבל המחיר ירד ולא עלה. השינוי חייב להיות שלילי: ' + m('−15%') + ', לא ' + m('+15%') + '.');
      } else if (percent === -12) {
        ctx.note(m('12') + ' ₪ הוא סכום הירידה, לא האחוז. ביחס למחיר המקורי: ' + m('12 ÷ 80 · 100% = 15%') + '.');
      } else {
        ctx.note('חפש שינוי שמביא את המחיר החדש ל־' + m('68') + ' ₪. ירידה משתמשת במכפיל קטן מ־' + m('1') + '.');
      }
    }
    function setPercent(value) { percent = clamp(Math.round(value), -50, 50); ctx.sfx('tick'); update(true); }
    bindButtons(box, function (key, delta) { setPercent(percent + delta); });
    bindKeys(handle, function () { return percent; }, setPercent, -50, 50, 1, 5);
    ctx.drag(handle, { move: function (x) { percent = clamp(Math.round(((x - 50) / 200 - 1) * 100), -50, 50); update(false); }, end: function () { update(true); } });
    update(false);
  }

  function changeScene(ctx) {
    var newValue = 40, completed = false;
    ctx.draw(hebSvg(201, 28, 'משווים תמיד לערך המקורי')
      + '<rect x="50" y="79" width="150" height="40" rx="6" fill="' + PAL.line + '" opacity=".45"/>'
      + mathSvg('', 200, 60, '40', 18, PAL.dark)
      + ruler(150, 200, 147, 68) + barMarkup('newBar', 87, 150, PAL.main)
      + handleMarkup('newHandle', 'הערך החדש; בגרירה, בכפתורים או בחיצים', 20, 80, 40, PAL.main)
      + mathSvg('fractionTop', 110, 217, '', 18)
      + '<line x1="57" y1="228" x2="163" y2="228" stroke="' + PAL.ink + '" stroke-width="2"/>'
      + mathSvg('', 110, 251, '40', 18) + hebSvg(110, 279, 'הערך המקורי')
      + mathSvg('fractionResult', 278, 237, '', 19, PAL.dark));
    var handle = ctx.el('newHandle');
    var box = ctx.extra(stepperMarkup('n', 'ערך חדש', [-1, 1]));
    ctx.register('controls', box);
    function update(acted) {
      var percent = rounded((newValue - 40) / 40 * 100);
      ctx.el('newBar').setAttribute('width', newValue * 3.75);
      putHandle(handle, 50 + newValue * 3.75, 99, newValue, ' יחידות בערך החדש');
      box.querySelector('[data-value="n"]').textContent = num(newValue);
      ctx.el('fractionTop').textContent = newValue + ' − 40';
      ctx.el('fractionResult').textContent = '· 100% = ' + signed(percent) + '%';
      ctx.caption('הערך החדש: ' + m(num(newValue)) + ' · השינוי: ' + m(signed(percent) + '%'));
      if (newValue === 50) {
        ctx.note('נכון: התוספת ' + m('10') + ' היא רבע מהערך המקורי ' + m('40') + ', כלומר עלייה של ' + m('25%') + '.', 'good');
        if (acted && !completed) { completed = true; award(ctx); }
      } else if (newValue === 65) {
        ctx.note('הוספת ' + m('25') + ' יחידות, לא ' + m('25%') + '. צריך לחשב רבע מהערך המקורי ' + m('40') + ' ולהוסיף אותו.');
      } else if (newValue === 30) {
        ctx.note('זו ירידה של ' + m('25%') + ': השינוי ' + m('30 − 40 = −10') + ' שלילי. אנחנו מחפשים עלייה, ולכן ערך גדול מ־' + m('40') + '.');
      } else {
        ctx.note('ההפרש נמצא מעל קו השבר. מתחתיו תמיד ' + m('40') + ', הערך המקורי — לא הערך החדש. חפש עלייה של ' + m('25%') + '.');
      }
    }
    function setNew(value) { newValue = clamp(Math.round(value), 20, 80); ctx.sfx('tick'); update(true); }
    bindButtons(box, function (key, delta) { setNew(newValue + delta); });
    bindKeys(handle, function () { return newValue; }, setNew, 20, 80, 1, 5);
    ctx.drag(handle, { move: function (x) { newValue = clamp(Math.round((x - 50) / 3.75), 20, 80); update(false); }, end: function () { update(true); } });
    update(false);
  }

  function successiveScene(ctx) {
    var first = 0, second = 0, firstSeen = false, completed = false;
    ctx.draw(hebSvg(201, 25, 'המחיר המקורי') + barMarkup('originalBar', 44, 130, PAL.line) + mathSvg('', 201, 82, '100', 18)
      + hebSvg(201, 106, 'אחרי השינוי הראשון') + barMarkup('firstBar', 128, 130, PAL.main) + mathSvg('firstPrice', 201, 179, '', 18)
      + hebSvg(201, 203, 'אחרי השינוי השני') + barMarkup('secondBar', 225, 130, PAL.good) + mathSvg('secondPrice', 201, 276, '', 18)
      + ruler(130, 200, 297, 37)
      + handleMarkup('firstHandle', 'השינוי הראשון באחוזים; בגרירה, בכפתורים או בחיצים בצעדים של חמש נקודות אחוז', -50, 50, 0, PAL.main)
      + handleMarkup('secondHandle', 'השינוי השני באחוזים; בגרירה, בכפתורים או בחיצים בצעדים של חמש נקודות אחוז', -50, 50, 0, PAL.good));
    var firstHandle = ctx.el('firstHandle'), secondHandle = ctx.el('secondHandle');
    var box = ctx.extra('<div class="sceneStrip"><b data-stage="1" id="sequenceTask"></b><div data-total aria-live="polite"></div></div>'
      + stepperMarkup('p1', 'שינוי ראשון', [-5, 5]) + stepperMarkup('p2', 'שינוי שני', [-5, 5]));
    ctx.register('controls', box);
    function update(acted) {
      var multFirst = 1 + first / 100, multSecond = 1 + second / 100;
      var totalMultiplier = multFirst * multSecond, afterFirst = rounded(100 * multFirst), afterSecond = rounded(100 * totalMultiplier);
      var totalChange = rounded((totalMultiplier - 1) * 100);
      ctx.el('firstBar').setAttribute('width', 130 * multFirst);
      ctx.el('secondBar').setAttribute('width', 130 * totalMultiplier);
      ctx.el('firstPrice').textContent = num(afterFirst);
      ctx.el('secondPrice').textContent = num(afterSecond);
      putHandle(firstHandle, 50 + 130 * multFirst, 140, first, ' אחוז בשינוי הראשון');
      putHandle(secondHandle, 50 + 130 * totalMultiplier, 237, second, ' אחוז בשינוי השני');
      box.querySelector('[data-value="p1"]').textContent = signed(first) + '%';
      box.querySelector('[data-value="p2"]').textContent = signed(second) + '%';
      var relation = Math.abs(rounded(totalMultiplier) - totalMultiplier) < 0.000001 ? ' = ' : ' ≈ ';
      ctx.caption(m(num(multFirst) + ' · ' + num(multSecond) + relation + num(totalMultiplier)));
      box.querySelector('[data-total]').textContent = 'המחיר הסופי: ' + m(num(afterSecond)) + ' ₪ · השינוי הכולל: ' + m(signed(totalChange) + '%');
      if (acted && first === 10 && second === -10 && !firstSeen) { firstSeen = true; ctx.set({ part1: true }); }
      var taskNode = box.querySelector('[data-stage]');
      taskNode.dataset.stage = firstSeen ? '2' : '1';
      taskNode.textContent = firstSeen
        ? 'חלק ב׳: אחרי עלייה של ' + m('25%') + ', מצא ירידה שמחזירה בדיוק ל־' + m('100') + ' ₪.'
        : 'חלק א׳: הגדר ' + m('+10%') + ' ואחריו ' + m('−10%') + '. בדוק את המחיר הסופי.';
      if (first === 25 && second === -25) {
        ctx.note('המחיר הוא ' + m('93.75') + ' ₪, לא ' + m('100') + ' ₪. הירידה נלקחת מהמחיר החדש והגדול יותר, ' + m('125') + ' ₪; אחוזים שווים אינם מבטלים זה את זה.');
      } else if (first === 10 && second === -10) {
        ctx.note('ראית: ' + m('1.1 · 0.9 = 0.99') + ', ולכן המחיר ' + m('99') + ' ₪, לא ' + m('100') + ' ₪. עכשיו עבור לחלק ב׳.', 'good');
      } else if (firstSeen && first === 25 && second === -20) {
        ctx.note('בדיוק: ' + m('1.25 · 0.8 = 1') + '. ירידה של ' + m('20%') + ' מתוך ' + m('125') + ' ₪ מורידה ' + m('25') + ' ₪ ומחזירה ל־' + m('100') + ' ₪.', 'good');
        if (acted && !completed) { completed = true; award(ctx); }
      } else if (!firstSeen) {
        ctx.note('קודם הצג עלייה של ' + m('10%') + ' ואחריה ירידה של ' + m('10%') + '. השינוי השני מחושב מהמחיר שאחרי הראשון.');
      } else {
        ctx.note('כבר ראית ששני שינויים מוכפלים. עכשיו הגדר עלייה של ' + m('25%') + ' ומצא את הירידה שמחזירה למחיר המקורי.');
      }
    }
    function setChange(key, value) {
      var clean = clamp(Math.round(value / 5) * 5, -50, 50);
      if (key === 'p1') first = clean; else second = clean;
      ctx.sfx('tick'); update(true);
    }
    bindButtons(box, function (key, delta) { setChange(key, (key === 'p1' ? first : second) + delta); });
    bindKeys(firstHandle, function () { return first; }, function (value) { setChange('p1', value); }, -50, 50, 5, 5);
    bindKeys(secondHandle, function () { return second; }, function (value) { setChange('p2', value); }, -50, 50, 5, 5);
    ctx.drag(firstHandle, { move: function (x) { first = clamp(Math.round(((x - 50) / 130 - 1) * 20) * 5, -50, 50); update(false); }, end: function () { update(true); } });
    ctx.drag(secondHandle, { move: function (x) { second = clamp(Math.round(((x - 50) / (130 * (1 + first / 100)) - 1) * 20) * 5, -50, 50); update(false); }, end: function () { update(true); } });
    update(false);
  }

  var steps = [
    {
      mode: 'intro', tA: 'שינוי באחוזים', sub: 'מכפילים במקום לחבר, ומשווים תמיד לערך המקורי.',
      tip: 'שלום, אני אליהו. נגלה איך שינוי באחוזים הופך למכפיל, ומה קורה בשני שינויים ברצף.',
      emoji: '🏷️', eq: m('+20% = × 1.2'),
      note: 'עלייה מוסיפה לערך המקורי; ירידה מקטינה אותו. בשני שינויים ברצף מכפילים את המכפילים, ולא מחברים את האחוזים.',
      cue: 'מוכן לגלות את המכפיל?', btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene', tA: 'מכפיל השינוי',
      sub: 'המחיר ירד מ־' + m('80') + ' ₪ ל־' + m('68') + ' ₪. מצא את השינוי באחוזים בגרירה, בכפתורים או בחיצים.',
      tip: 'שנה את האחוז ותראה את המכפיל ואת המחיר החדש. ירידה דורשת סימן מינוס.',
      aspect: [402, 200], alt: 'פס מחיר מקורי ברקע ופס מחיר חדש עם ידית; סרגל אחוזים וקו מאה אחוז מסמנים את הבסיס המקורי',
      cue: 'מצא את השינוי שמביא למחיר המבוקש', cueDone: 'המכפיל והמחיר מתאימים. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'controls', text: 'שנה את אחוז השינוי ובדוק אם המחיר ירד למחיר המבוקש.' }, setup: multiplierScene
    },
    {
      mode: 'quiz', tA: 'מה המחיר החדש?', sub: 'מחיר של ' + m('250') + ' ₪ עלה ב־' + m('20%') + '. מה המחיר החדש?',
      tip: 'העלייה היא חלק מהמחיר המקורי, לא תוספת קבועה של שקלים.', btn: 'המשך ←',
      win: 'נכון. עלייה של ' + m('20%') + ' היא כפל ב־' + m('1.2') + '.', wrongSay: 'חשב את המכפיל של העלייה, או את התוספת מתוך המחיר המקורי.',
      opts: [
        { t: m('300') + ' ₪', c: true, f: 'נכון: ' + m('250 · 1.2 = 300') + ' ₪. התוספת היא ' + m('50') + ' ₪.' },
        { t: m('270') + ' ₪', f: 'הוספת ' + m('20') + ' ₪ במקום ' + m('20%') + '. האחוז מחושב מתוך ' + m('250') + ' ₪.' },
        { t: m('50') + ' ₪', f: 'חישבת רק את התוספת. המחיר החדש כולל גם את המחיר המקורי ' + m('250') + ' ₪.' },
        { t: m('200') + ' ₪', f: 'הפחתת ' + m('20%') + ' במקום להוסיף אותם. המחיר עלה ולא ירד.' }
      ],
      hints: ['עלייה נותנת מכפיל גדול מאחד.', 'הפוך את האחוז לחלק עשרוני והוסף אחד.', 'חשב ' + m('250 · 1.2') + ', או הוסף למחיר את ' + m('250 · 0.2') + '.']
    },
    {
      mode: 'scene', tA: 'אחוז השינוי', sub: 'מצא ערך חדש שהוא עלייה של ' + m('25%') + ' מתוך ' + m('40') + ', בגרירה, בכפתורים או בחיצים.',
      tip: 'חלק את ההפרש בערך המקורי. הוא תמיד הבסיס להשוואה.',
      aspect: [402, 294], alt: 'פס מקור של ארבעים ופס חדש עם ידית על סרגל; שבר אופקי מציג הפרש מעל ארבעים, כפול מאה אחוז',
      cue: 'מצא ערך חדש שמתאים לעלייה המבוקשת', cueDone: 'חישבת לפי הערך המקורי. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'controls', text: 'הגדל את הערך החדש. שים לב להפרש שמופיע מעל קו השבר.' }, setup: changeScene
    },
    {
      mode: 'quiz', tA: 'בכמה אחוזים ירד?', sub: 'מספר המשתתפים בחוג ירד מ־' + m('40') + ' ל־' + m('30') + '. בכמה אחוזים ירד?',
      tip: 'חשב את גודל הירידה ביחס למספר המשתתפים המקורי.', btn: 'המשך ←',
      win: 'נכון. ההפרש הוא רבע מהמספר המקורי.', wrongSay: 'ההפרש לבדו אינו אחוז. חלק אותו במספר המשתתפים המקורי.',
      opts: [
        { t: m('10%'), f: 'כתבת את ההפרש כאילו הוא אחוז. ' + m('10') + ' הוא מספר המשתתפים שעזבו; צריך להשוות אותו ל־' + m('40') + '.' },
        { t: m('25%'), c: true, f: 'נכון: ' + m('(40 − 30) ÷ 40 · 100% = 25%') + '. מחלקים בערך המקורי.' },
        { t: 'בערך ' + m('33%'), f: 'חילקת בערך החדש ' + m('30') + ' במקום במקורי ' + m('40') + '. הבסיס לאחוז השינוי הוא המקור.' },
        { t: m('75%'), f: 'זה החלק שנשאר בחוג, לא החלק שירד. הירידה היא ההפרש בין המקור לחדש.' }
      ],
      hints: ['התחל מההפרש בין שני המספרים.', 'השווה את ההפרש למספר המשתתפים לפני הירידה.', 'חשב ' + m('10 ÷ 40 · 100%') + '.']
    },
    {
      mode: 'scene', tA: 'שני שינויים ברצף', sub: 'הגדר את שני השינויים בגרירה, בכפתורים או בחיצים. קודם עלייה וירידה שוות, ואז חזרה למחיר המקורי.',
      tip: 'השינוי השני מחושב מהמחיר החדש. לכן מכפילים את המכפילים.',
      aspect: [402, 330], alt: 'שלושה פסי מחיר: מאה במקור, אחרי שינוי ראשון ואחרי שינוי שני; שתי ידיות וסרגל עם קו מאה אחוז',
      cue: 'השלם את שני חלקי המשימה', cueDone: 'שני החלקים הושלמו. אפשר להמשיך ←', btn: 'המשך ←',
      nudge: { target: 'controls', text: 'התחל בעלייה של ' + m('10%') + ' ואחריה ירידה של ' + m('10%') + '.' }, setup: successiveScene
    },
    {
      mode: 'quiz', tA: 'מה השינוי הכולל?', sub: 'מחיר עלה ב־' + m('10%') + ' ואחר כך ירד ב־' + m('10%') + '. מה השינוי הכולל?',
      tip: 'שינוי שני פועל על המחיר שאחרי השינוי הראשון.', btn: 'המשך ←',
      win: 'נכון. שני המכפילים נותנים ' + m('0.99') + ', כלומר ירידה של ' + m('1%') + '.', wrongSay: 'אל תחבר את האחוזים. הכפל את שני המכפילים.',
      opts: [
        { t: 'אין שינוי', f: 'חיברת את האחוזים כאילו הם פועלים על אותו בסיס. הירידה מחושבת מהמחיר החדש והגדול יותר.' },
        { t: 'ירידה של ' + m('10%'), f: 'התחשבת רק בשינוי השני ושכחת את העלייה הראשונה. צריך להכפיל את שני המכפילים.' },
        { t: 'ירידה של ' + m('1%'), c: true, f: 'נכון: ' + m('1.1 · 0.9 = 0.99') + ', כלומר נשארו ' + m('99%') + ' מהמקור — ירידה של ' + m('1%') + '.' },
        { t: 'עלייה של ' + m('1%'), f: 'הגודל נכון אבל הסימן הפוך. המכפיל ' + m('0.99') + ' קטן מאחד, ולכן זו ירידה.' }
      ],
      hints: ['לשני השינויים יש בסיסים שונים.', 'כתוב מכפיל לעלייה ומכפיל לירידה, והכפל אותם.', 'חשב ' + m('1.1 · 0.9') + ' והשווה את התוצאה ל־' + m('1') + '.']
    },
    {
      mode: 'quiz', tA: 'מוצאים את השלם', sub: m('30%') + ' מהתלמידים בשכבה הם ' + m('36') + ' תלמידים. כמה תלמידים יש בשכבה?',
      tip: 'כאן החלק ידוע. חפש שלם ששלושים אחוז ממנו נותנים את החלק הזה.', btn: 'לסיכום ←',
      win: 'נכון. חילקת את החלק באחוז כמספר עשרוני ומצאת את השלם.', wrongSay: 'לא מחשבים אחוז מהחלק. מחפשים את המספר שהחלק שייך אליו.',
      opts: [
        { t: m('10.8'), f: 'חישבת ' + m('30%') + ' מתוך ' + m('36') + '. אבל ' + m('36') + ' כבר הוא החלק, ואנו מחפשים את השלם.' },
        { t: m('66'), f: 'חיברת ' + m('36 + 30') + '. אחוז ומספר תלמידים אינם כמויות שאפשר לחבר.' },
        { t: m('108'), f: 'כפלת ' + m('36') + ' ב־' + m('3') + '. ' + m('30%') + ' אינו שליש; צריך לחלק ב־' + m('0.3') + '.' },
        { t: m('120'), c: true, f: 'נכון: ' + m('36 ÷ 0.3 = 120') + '. בדיקה: ' + m('120 · 0.3 = 36') + ' תלמידים.' }
      ],
      hints: ['השלם גדול מהחלק הנתון.', 'כתוב: שלם כפול האחוז העשרוני שווה לחלק.', 'פתור ' + m('0.3 · x = 36') + ' בעזרת חילוק ב־' + m('0.3') + '.']
    },
    {
      mode: 'finish', tA: 'סיימת את השינוי באחוזים', sub: 'המכפיל מספר את כל השינוי. הבסיס המקורי מספר איזה אחוז השתנה.',
      tip: 'כל הכבוד. עכשיו אתה יודע לחשב שינוי, לחבר שני שינויים בכפל ולמצוא שלם מחלק.',
      cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻',
      finalLead: 'שינוי באחוזים הוא מכפיל; אחוז השינוי הוא ההפרש חלקי הערך המקורי, כפול מאה אחוז. בשינויים עוקבים מכפילים את המכפילים.',
      formula: 'שינוי של ' + m('p%') + ': ' + m('× (1 + p ÷ 100)')
    }
  ];

  window.NoamGame.boot({
    slug: 'shinui-baachuzim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'מחיר בעזרת מכפיל', math: '250 · 1.2 = 300' },
      { step: 4, name: 'אחוז השינוי מהמקור', math: '10 ÷ 40 · 100% = 25%' },
      { step: 6, name: 'שינויים עוקבים', math: '1.1 · 0.9 = 0.99' },
      { step: 7, name: 'מציאת השלם', math: '36 ÷ 0.3 = 120' }
    ],
    bonus: {
      label: 'מכונת השינויים', closeLabel: 'סגור את המכונה', hint: 'קבל תרגיל חדש ובחר תשובה שלמה בכפתורים.',
      setup: function (box, ctx) {
        var question = null, guess = 0;
        function randomFrom(values) { return values[Math.floor(Math.random() * values.length)]; }
        box.innerHTML = '<div class="bTitle">מכונת השינויים</div><div class="bSub" data-bonus-sub></div>'
          + '<div class="bChip" data-bonus-chip dir="ltr"></div>' + stepperMarkup('bonus', 'תשובה', [-10, -1, 1, 10])
          + '<div class="bForms" data-bonus-forms hidden></div><div class="bOk" data-bonus-note role="status" hidden></div>'
          + '<button type="button" class="bDice" data-bonus-check style="min-height:44px;min-width:44px">בדוק</button>'
          + '<button type="button" class="bDice" data-bonus-roll style="min-height:44px;min-width:44px">תרגיל חדש ↻</button>';
        var subNode = box.querySelector('[data-bonus-sub]'), chipNode = box.querySelector('[data-bonus-chip]');
        var formsNode = box.querySelector('[data-bonus-forms]'), noteNode = box.querySelector('[data-bonus-note]');
        function showGuess() {
          box.querySelector('[data-value="bonus"]').textContent = num(guess) + (question.kind === 1 ? '%' : '');
          noteNode.hidden = true; formsNode.hidden = true;
        }
        function rollQuestion() {
          var price = 20 * (1 + Math.floor(Math.random() * 20));
          var percent = randomFrom([-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
          var kind = Math.floor(Math.random() * 3), multiplier = 1 + percent / 100;
          var newPrice = rounded(price * multiplier);
          question = { kind: kind, answer: newPrice, solution: price + ' · ' + num(multiplier) + ' = ' + num(newPrice) };
          if (kind === 0) {
            subNode.textContent = 'מחיר ' + m(String(price)) + ' ₪ השתנה ב־' + m(signed(percent) + '%') + '. מה המחיר החדש בשקלים?';
            chipNode.textContent = price + ' · (1 + (' + num(percent) + ') ÷ 100) = ?';
          } else if (kind === 1) {
            question.answer = percent;
            question.solution = '(' + num(newPrice) + ' − ' + price + ') ÷ ' + price + ' · 100% = ' + signed(percent) + '%';
            subNode.textContent = 'המחיר השתנה מ־' + m(String(price)) + ' ₪ ל־' + m(num(newPrice)) + ' ₪. מהו אחוז השינוי, עם הסימן?';
            chipNode.textContent = price + ' → ' + num(newPrice);
          } else {
            var percentFirst = randomFrom([-50, -25, 25, 50]), percentSecond = randomFrom([-40, -20, 20, 40]);
            var multiplierFirst = 1 + percentFirst / 100, multiplierSecond = 1 + percentSecond / 100;
            var result = rounded(price * multiplierFirst * multiplierSecond);
            question.answer = result;
            question.solution = price + ' · ' + num(multiplierFirst) + ' · ' + num(multiplierSecond) + ' = ' + num(result);
            subNode.textContent = 'מחיר ' + m(String(price)) + ' ₪ השתנה ב־' + m(signed(percentFirst) + '%') + ' ואז ב־' + m(signed(percentSecond) + '%') + '. מה המחיר הסופי בשקלים?';
            chipNode.textContent = num(multiplierFirst) + ' · ' + num(multiplierSecond);
          }
          guess = 0; showGuess();
        }
        bindButtons(box, function (key, delta) { guess = clamp(guess + delta, -50, 900); ctx.sfx('tick'); showGuess(); });
        box.querySelector('[data-bonus-check]').addEventListener('click', function () {
          var correct = guess === question.answer;
          noteNode.hidden = false; noteNode.style.color = correct ? PAL.good : BAD;
          noteNode.textContent = correct ? 'נכון! השתמשת בבסיס ובמכפיל המתאימים.' : question.kind === 1
            ? 'נסה שוב: חלק את ההפרש במחיר המקורי, והקפד על הסימן.' : 'נסה שוב: הכפל את המחיר במכפיל המתאים. בשני שינויים מכפילים את שני המכפילים.';
          ctx.sfx(correct ? 'correct' : 'error');
          if (correct) { formsNode.hidden = false; formsNode.innerHTML = bdi(question.solution); }
        });
        box.querySelector('[data-bonus-roll]').addEventListener('click', function () { ctx.sfx('click'); rollQuestion(); });
        rollQuestion();
      }
    }
  });
}());
