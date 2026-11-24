/** קוד בצעדים — פקודות מוחלטות ברשת, סדר, תיקון וחזרה חסומה. */
(function () {
  'use strict';
  var m = window.NoamGame.m;
  var PAL = window.NoamGame.palette;
  var BAD = '#b91c1c';
  var CMD = { R: { word: 'ימינה', icon: '→', dx: 1, dy: 0 }, U: { word: 'למעלה', icon: '↑', dx: 0, dy: -1 }, L: { word: 'שמאלה', icon: '←', dx: -1, dy: 0 }, D: { word: 'למטה', icon: '↓', dx: 0, dy: 1 }, B: { word: 'זוג צעדים', icon: '→ ↑' } };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function heb(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="middle" direction="rtl" font-family="Heebo, sans-serif" font-size="' + (size || 15) + '" font-weight="700" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function mathSvg(x, y, text, size, colour, id) {
    return '<text' + (id ? ' id="' + id + '"' : '') + ' x="' + x + '" y="' + y + '" text-anchor="middle" direction="ltr" font-family="Secular One, sans-serif" font-size="' + (size || 20) + '" fill="' + (colour || PAL.ink) + '">' + text + '</text>';
  }
  function bdi(text) { return '<bdi class="math" dir="ltr">' + text + '</bdi>'; }
  function cellX(x) { return 113 + x * 44; }
  function cellY(y) { return 48 + y * 44; }
  function board(goal, wall) {
    var out = '<rect x="91" y="26" width="220" height="220" rx="8" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>';
    for (var i = 1; i < 5; i++) out += '<path d="M' + (91 + i * 44) + ' 26 V246 M91 ' + (26 + i * 44) + ' H311" stroke="' + PAL.line + '" fill="none"/>';
    if (wall) out += '<rect x="' + (cellX(wall[0]) - 19) + '" y="' + (cellY(wall[1]) - 19) + '" width="38" height="38" rx="6" fill="' + BAD + '"/><path d="M' + (cellX(wall[0]) - 9) + ' ' + (cellY(wall[1]) - 9) + ' l18 18 m0 -18 l-18 18" stroke="#fff" stroke-width="3"/>';
    out += '<circle cx="' + cellX(goal[0]) + '" cy="' + cellY(goal[1]) + '" r="17" fill="' + PAL.goodSoft + '" stroke="' + PAL.good + '" stroke-width="2"/><path d="M' + (cellX(goal[0]) - 8) + ' ' + cellY(goal[1]) + ' l6 6 l11 -13" stroke="' + PAL.good + '" fill="none" stroke-width="3"/>';
    return out + '<circle cx="113" cy="224" r="18" fill="' + PAL.soft + '" stroke="' + PAL.main + '" stroke-dasharray="3 3"/>' + heb(201, 270, 'מתחילים בעיגול • מגיעים לסימון הירוק', 14);
  }
  function robotMarkup() {
    return '<g id="robot" style="pointer-events:none"><rect x="-14" y="-14" width="28" height="28" rx="7" fill="' + PAL.main + '" stroke="#fff" stroke-width="2"/><circle cx="-5" cy="-3" r="3" fill="#fff"/><circle cx="5" cy="-3" r="3" fill="#fff"/><path d="M-6 6 H6 M0 -14 V-19" stroke="#fff" stroke-width="2"/></g>';
  }
  /** Pure, bounded interpreter. B expands to R,U exactly repeat times. No turning. */
  function interpret(program, repeat, wall) {
    var expanded = [];
    program.forEach(function (c) {
      if (c === 'B') { for (var k = 0; k < repeat; k++) { expanded.push('R'); expanded.push('U'); } }
      else expanded.push(c);
    });
    var x = 0, y = 4, trace = [{ x: x, y: y }], fault = null;
    for (var j = 0; j < expanded.length && j < 30; j++) {
      var command = CMD[expanded[j]], nx = x + command.dx, ny = y + command.dy;
      if (nx < 0 || nx > 4 || ny < 0 || ny > 4) { fault = { kind: 'edge', step: j + 1, x: nx, y: ny }; break; }
      if (wall && nx === wall[0] && ny === wall[1]) { fault = { kind: 'wall', step: j + 1, x: nx, y: ny }; break; }
      x = nx; y = ny; trace.push({ x: x, y: y });
    }
    return { x: x, y: y, trace: trace, fault: fault, expanded: expanded };
  }
  function programScene(kind) {
    return function (ctx) {
      var isLoop = kind === 'loop';
      var goal = isLoop ? [3, 1] : [2, 2], wall = isLoop ? null : [1, 3];
      var paletteKeys = isLoop ? ['B', 'R', 'U', 'L'] : ['R', 'U', 'L', 'D'];
      var program = kind === 'debug' ? ['R', 'U', 'R', 'U'] : [];
      var repeat = 1, insertAt = program.length, selected = 0, dest = 0, activeCommand = paletteKeys[0], lastRun = null;
      var doneOnce = false, runToken = 0;
      var rm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var out = board(goal, wall) + '<polyline id="trace" fill="none" stroke="' + PAL.warm + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><g id="traceDots"></g><rect id="fault" width="40" height="40" rx="6" fill="none" stroke="' + BAD + '" stroke-width="4" visibility="hidden"/>' + robotMarkup() + heb(201, 292, 'בנק הפקודות — הכיוונים קבועים על הרשת', 14);
      paletteKeys.forEach(function (key, idx) {
        out += '<g id="cmd' + key + '" tabindex="0" role="button" aria-label="הוסף ' + CMD[key].word + '; חצים בוחרים מקום, אנטר או רווח מוסיפים" transform="translate(' + (11 + idx * 98) + ' 305)" style="cursor:grab"><rect width="86" height="68" rx="12" fill="' + PAL.soft + '" stroke="' + PAL.line + '" stroke-width="2"/>' + mathSvg(43, 333 - 305, CMD[key].icon, 24) + heb(43, 356 - 305, key === 'B' ? 'חזור על זוג' : CMD[key].word, 13) + '</g>';
      });
      out += heb(201, 395, 'התוכנית נקראת משמאל לימין', 15);
      for (var slot = 0; slot < 5; slot++) {
        out += '<g id="slot' + slot + '" tabindex="0" role="button" aria-label="מקום בתוכנית; חצים בוחרים יעד, אנטר או רווח מעבירים, דיליט מוחק" transform="translate(' + (17 + slot * 75) + ' 410)" style="cursor:grab"><rect id="slotBox' + slot + '" width="68" height="68" rx="10" fill="#fff" stroke="' + PAL.line + '" stroke-width="2"/>' + mathSvg(34, 20, String(slot + 1), 12, PAL.dark) + mathSvg(34, 48, '', 23, PAL.ink, 'slotText' + slot) + '</g>';
      }
      if (isLoop) out += heb(201, 506, 'מספר החזרות של הזוג: ימינה ואז למעלה', 14) + '<g id="repeatHandle" tabindex="0" role="slider" aria-label="מספר החזרות; חצים משנים, אנטר או רווח מריצים" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" style="cursor:grab"><rect x="65" y="520" width="272" height="64" rx="12" fill="' + PAL.soft + '" stroke="' + PAL.line + '"/><path d="M100 553 H302" stroke="' + PAL.main + '" stroke-width="4"/><circle id="repeatDot" cx="100" cy="553" r="14" fill="' + PAL.main + '"/>' + mathSvg(100, 576, '1', 15) + mathSvg(201, 576, '2', 15) + mathSvg(302, 576, '3', 15) + '</g>';
      ctx.draw(out);
      var extra = ctx.extra('<div class="stepper" style="gap:8px"><div class="unit" dir="ltr"><button id="insertMinus" type="button" aria-label="מקום הוספה קודם">−</button><span dir="rtl" style="font-size:12px">מקום הוספה</span><bdi id="insertValue" class="var math" dir="ltr"></bdi><button id="insertPlus" type="button" aria-label="מקום הוספה הבא">+</button></div></div>'
        + (isLoop ? '<div class="stepper" style="margin-top:8px"><div class="unit" dir="ltr"><button id="repeatMinus" type="button" aria-label="פחות חזרה">−</button><span dir="rtl" style="font-size:12px">חזרות</span><bdi id="repeatValue" class="var math" dir="ltr">1</bdi><button id="repeatPlus" type="button" aria-label="עוד חזרה">+</button></div></div>' : '')
        + '<div class="sceneStrip" style="margin-top:10px"><b>בחירה לעריכה</b><span id="selectedValue" style="font:700 14px Heebo,sans-serif"></span><b>עקבת הביצוע — מההתחלה עד העצירה</b><div id="traceWords" style="font-size:13px;line-height:1.7" aria-live="polite">עדיין לא הורצה תוכנית.</div></div>');
      ctx.register('editor', extra);
      function publish() {
        ctx.set({ program: program.slice(), repeat: repeat, insertAt: insertAt, selected: selected, trace: lastRun ? lastRun.trace : [], fault: lastRun ? lastRun.fault : null });
      }
      function renderEditor() {
        insertAt = clamp(insertAt, 0, program.length);
        selected = clamp(selected, 0, Math.max(0, program.length - 1));
        for (var s = 0; s < 5; s++) {
          ctx.el('slotText' + s).textContent = program[s] ? CMD[program[s]].icon : '·';
          ctx.el('slotBox' + s).setAttribute('stroke', s === selected && program.length ? PAL.warm : (s === insertAt ? PAL.main : PAL.line));
          ctx.el('slotBox' + s).setAttribute('stroke-width', s === selected && program.length ? '4' : '2');
          ctx.el('slot' + s).setAttribute('aria-label', 'מקום ' + m(String(s + 1)) + ': ' + (program[s] ? CMD[program[s]].word : 'ריק') + '. חצים בוחרים יעד; אנטר או רווח מעבירים או מוסיפים; דיליט מוחק.');
        }
        extra.querySelector('#insertValue').textContent = String(insertAt + 1);
        extra.querySelector('#selectedValue').textContent = program.length ? 'פקודה ' + m(String(selected + 1)) + ': ' + CMD[program[selected]].word : 'אין פקודה בתוכנית';
        if (isLoop) {
          extra.querySelector('#repeatValue').textContent = String(repeat);
          ctx.el('repeatHandle').setAttribute('aria-valuenow', repeat);
          ctx.el('repeatDot').setAttribute('cx', 100 + (repeat - 1) * 101);
        }
        publish();
      }
      function showTrace(result) {
        ctx.el('robot').setAttribute('transform', 'translate(' + cellX(result.x) + ' ' + cellY(result.y) + ')');
        ctx.el('trace').setAttribute('points', result.trace.map(function (p) { return cellX(p.x) + ',' + cellY(p.y); }).join(' '));
        var marks = '';
        result.trace.forEach(function (p, i) { marks += '<circle cx="' + cellX(p.x) + '" cy="' + cellY(p.y) + '" r="9" fill="#fff" stroke="' + PAL.warm + '"/>' + mathSvg(cellX(p.x), cellY(p.y) + 4, String(i), 10); });
        ctx.el('traceDots').innerHTML = marks;
        var faultEl = ctx.el('fault');
        faultEl.setAttribute('visibility', result.fault ? 'visible' : 'hidden');
        if (result.fault) { faultEl.setAttribute('x', cellX(clamp(result.fault.x, 0, 4)) - 20); faultEl.setAttribute('y', cellY(clamp(result.fault.y, 0, 4)) - 20); }
        extra.querySelector('#traceWords').textContent = 'התחלה' + (result.trace.length > 1 ? ' ← ' + result.expanded.slice(0, result.trace.length - 1).map(function (c, i) { return m(String(i + 1)) + ' ' + CMD[c].word; }).join(' ← ') : '') + (result.fault ? ' ← עצירה לפני פקודה ' + m(String(result.fault.step)) : ' ← סוף');
        publish();
      }
      function invalidate() {
        runToken++;
        lastRun = null;
        ctx.el('robot').setAttribute('transform', 'translate(113 224)');
        ctx.el('trace').setAttribute('points', ''); ctx.el('traceDots').innerHTML = '';
        ctx.el('fault').setAttribute('visibility', 'hidden');
        extra.querySelector('#traceWords').textContent = 'התוכנית השתנתה. הרץ שוב מההתחלה.';
      }
      /** All edits, whether dropped, clicked or committed by keyboard, arrive here. */
      function edit(action) {
        if (action.type === 'add') {
          if (program.length >= 5) { ctx.sfx('error'); ctx.note('יש מקום לחמש פקודות בלבד. מחק פקודה מיותרת במקום להוסיף ללא גבול.'); return; }
          var at = clamp(action.at == null ? insertAt : action.at, 0, program.length);
          program.splice(at, 0, action.command); selected = at; insertAt = at + 1; activeCommand = action.command;
        } else if (action.type === 'move') {
          if (!program[action.from]) { ctx.note('המקום הזה ריק. הוסף אליו פקודה מהבנק.'); return; }
          var target = clamp(action.to, 0, program.length - 1);
          var moved = program.splice(action.from, 1)[0]; program.splice(target, 0, moved); selected = target; insertAt = program.length;
        } else if (action.type === 'remove') {
          if (!program[action.from]) { ctx.note('אין כאן פקודה למחיקה.'); return; }
          program.splice(action.from, 1); insertAt = program.length;
        } else if (action.type === 'repeat') {
          repeat = clamp(action.value, 1, 3);
        } else if (action.type === 'reset') {
          program = []; repeat = 1; insertAt = 0; selected = 0;
        }
        invalidate(); renderEditor(); ctx.sfx('tick');
        ctx.note(action.type === 'move' ? 'שינית את הסדר, לא את הכיוונים. הרץ ובדוק אם עקפת את המכשול.' : action.type === 'repeat' ? 'הזוג מבצע ימינה ואז למעלה בכל חזרה. כעת יש ' + m(String(repeat)) + ' חזרות.' : 'הפקודות נשמרו. כל חץ הוא צעד אחד בכיוון קבוע. הרץ ובדוק את העקבה.');
      }
      function run() {
        if (!program.length) { ctx.sfx('error'); ctx.note('תוכנית ריקה אינה מזיזה את הרובוט. הוסף לפחות פקודה אחת.'); return; }
        runToken++;
        var token = runToken;
        lastRun = interpret(program, repeat, wall);
        showTrace(lastRun); // Required final state exists now, even when animation frames are held.
        var result = lastRun, reached = !result.fault && result.x === goal[0] && result.y === goal[1];
        if (result.fault) {
          ctx.sfx('error');
          ctx.note(result.fault.kind === 'wall' ? 'פקודה ' + m(String(result.fault.step)) + ' נכנסת למכשול האדום. הרובוט עוצר לפניו. כאן הסדר חשוב: נסה ימינה לפני העלייה השנייה ברצף.' : 'פקודה ' + m(String(result.fault.step)) + ' יוצאת מגבול הרשת. הכיוונים אינם סיבובים; שמאלה מהקצה לא מאפשרת צעד.');
        } else if (reached && isLoop && !(program.length === 1 && program[0] === 'B' && repeat === 3)) {
          ctx.sfx('error'); ctx.note('הגעת למטרה, אבל עוד לא קיצרת את הרצף. השתמש בפקודת זוג אחת בלבד, עם שלוש חזרות.');
        } else if (reached) {
          ctx.sfx('correct');
          ctx.note(isLoop ? 'מצוין! זוג אחד, שלוש חזרות: ' + m('3 × 2 = 6') + ' צעדים. בכל חזרה ימינה ואז למעלה.' : kind === 'debug' ? 'תיקנת את השגיאה! ימינה, ימינה, למעלה, למעלה. הסדר החדש עוקף את המכשול.' : 'הגעת למטרה בארבעה צעדים בלי להיכנס למכשול. הרובוט ביצע את ההוראות לפי הסדר.', 'good');
          if (!doneOnce) { doneOnce = true; ctx.solved(); }
        } else {
          ctx.sfx('error');
          ctx.note(isLoop ? 'כל חזרה מוסיפה גם צעד ימינה וגם צעד למעלה. כדי להגיע לסימון צריך שלושה זוגות, לא שלושה צעדים בודדים.' : 'אין התנגשות, אבל הרובוט לא הגיע למטרה. ספור מההתחלה שני צעדים ימינה ושני צעדים למעלה.');
        }
        // Optional execution pulse only; the full trace, robot and feedback are already final.
        if (!rm) result.trace.forEach(function (_, i) {
          ctx.later(function () { if (ctx.isActive() && token === runToken) ctx.el('traceDots').setAttribute('data-executed', i); }, i * 120);
        });
      }
      function chooseInsert(value) { insertAt = clamp(value, 0, program.length); renderEditor(); ctx.sfx('click'); ctx.note('הפקודה הבאה תיכנס למקום ' + m(String(insertAt + 1)) + '. אנטר או רווח על כרטיס מוסיפים אותה.'); }
      paletteKeys.forEach(function (key) {
        var handle = ctx.el('cmd' + key), sx = 0, sy = 0, mx = 0, my = 0;
        var baseTransform = handle.getAttribute('transform');
        handle.addEventListener('keydown', function (e) {
          if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].indexOf(e.key) >= 0) { e.preventDefault(); activeCommand = key; chooseInsert(insertAt + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit({ type: 'add', command: key }); }
        });
        ctx.drag(handle, {
          start: function (x, y) { sx = x; sy = y; mx = 0; my = 0; activeCommand = key; },
          move: function (x, y) { mx = x - sx; my = y - sy; handle.setAttribute('transform', baseTransform + ' translate(' + mx + ' ' + my + ')'); },
          end: function () { handle.setAttribute('transform', baseTransform); if (sy + my >= 385 && Math.hypot(mx, my) > 15) edit({ type: 'add', command: key, at: clamp(Math.floor((sx + mx - 17) / 75), 0, program.length) }); else ctx.note('הכרטיס לא הונח בתוכנית. הנח אותו בשורת המקומות בגרירה, בכפתורים או בחיצים ואנטר.'); }
        });
        ctx.button('הוסף ' + (key === 'B' ? 'זוג חוזר' : CMD[key].word), function () { edit({ type: 'add', command: key }); }, { id: 'add' + key, ghost: true });
      });
      for (var slotIndex = 0; slotIndex < 5; slotIndex++) (function (idx) {
        var node = ctx.el('slot' + idx), sx = 0, sy = 0, mx = 0, my = 0, original = node.getAttribute('transform');
        node.addEventListener('focus', function () { selected = clamp(idx, 0, Math.max(0, program.length - 1)); dest = idx; renderEditor(); });
        node.addEventListener('keydown', function (e) {
          if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].indexOf(e.key) >= 0) {
            e.preventDefault(); dest = clamp(dest + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1), 0, Math.max(0, program.length - 1)); ctx.note('יעד העברה: מקום ' + m(String(dest + 1)) + '. אשר באנטר או ברווח.');
          } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (program[idx]) edit({ type: 'move', from: idx, to: dest }); else edit({ type: 'add', command: activeCommand, at: idx }); }
          else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); edit({ type: 'remove', from: idx }); }
        });
        ctx.drag(node, {
          start: function (x, y) { sx = x; sy = y; mx = 0; my = 0; },
          move: function (x, y) { mx = x - sx; my = y - sy; node.setAttribute('transform', original + ' translate(' + mx + ' ' + my + ')'); },
          end: function () { node.setAttribute('transform', original); if (my < -70) edit({ type: 'remove', from: idx }); else if (Math.abs(mx) > 20 && program[idx]) edit({ type: 'move', from: idx, to: clamp(Math.floor((sx + mx - 17) / 75), 0, program.length - 1) }); else if (!program[idx] && Math.hypot(mx, my) > 20) edit({ type: 'add', command: activeCommand, at: idx }); }
        });
      }(slotIndex));
      extra.querySelector('#insertMinus').addEventListener('click', function () { chooseInsert(insertAt - 1); });
      extra.querySelector('#insertPlus').addEventListener('click', function () { chooseInsert(insertAt + 1); });
      ctx.button('בחר פקודה קודמת', function () { selected = clamp(selected - 1, 0, Math.max(0, program.length - 1)); renderEditor(); }, { id: 'selectPrev', ghost: true });
      ctx.button('בחר פקודה הבאה', function () { selected = clamp(selected + 1, 0, Math.max(0, program.length - 1)); renderEditor(); }, { id: 'selectNext', ghost: true });
      ctx.button('העבר מוקדם יותר', function () { edit({ type: 'move', from: selected, to: selected - 1 }); }, { id: 'moveEarlier', ghost: true });
      ctx.button('העבר מאוחר יותר', function () { edit({ type: 'move', from: selected, to: selected + 1 }); }, { id: 'moveLater', ghost: true });
      ctx.button('מחק פקודה', function () { edit({ type: 'remove', from: selected }); }, { id: 'removeCmd', ghost: true });
      ctx.button('הרץ מההתחלה', run, { id: 'runCode', target: 'runCode' });
      ctx.button('נקה תוכנית', function () { edit({ type: 'reset' }); }, { id: 'clearCode', ghost: true });
      if (isLoop) {
        extra.querySelector('#repeatMinus').addEventListener('click', function () { edit({ type: 'repeat', value: repeat - 1 }); });
        extra.querySelector('#repeatPlus').addEventListener('click', function () { edit({ type: 'repeat', value: repeat + 1 }); });
        var repeatHandle = ctx.el('repeatHandle');
        repeatHandle.addEventListener('keydown', function (e) {
          if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].indexOf(e.key) >= 0) { e.preventDefault(); edit({ type: 'repeat', value: repeat + (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1) }); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); }
        });
        ctx.drag(repeatHandle, { move: function (x) { edit({ type: 'repeat', value: clamp(1 + Math.round((x - 100) / 101), 1, 3) }); } });
      }
      renderEditor(); ctx.el('robot').setAttribute('transform', 'translate(113 224)');
      ctx.note(kind === 'debug' ? 'התוכנית הפותחת נכנסת למכשול. הרץ, מצא את הפקודה שבה נעצרה, ואז העבר את הימינה השלישית מוקדם יותר.' : isLoop ? 'בנה תוכנית עם זוג חוזר אחד. בתוך כל זוג: ימינה ואז למעלה. כוון את מספר החזרות והרץ.' : 'בנה מסלול מהעיגול לסימון הירוק. הוסף פקודות, ושמור על המכשול האדום.');
    };
  }
  var steps = [
    { mode: 'intro', tA: 'קוד בצעדים', sub: 'בונים מסלול, מוצאים שגיאה ומקצרים רצף בעזרת חזרה.', tip: 'שלום, אני אליהו. הרובוט מבצע בדיוק את ההוראות שלך, לפי הסדר.', emoji: '◆', eq: 'תכנן ← הרץ ← בדוק', note: 'כל חץ הוא צעד אחד בכיוון קבוע על הרשת, לא סיבוב. התוכנית נקראת משמאל לימין. בכל הרצה הרובוט חוזר להתחלה; במכשול או בגבול הוא עוצר לפני הצעד.', cue: 'מוכן לבנות תוכנית?', btn: 'בוא נתחיל ←' },
    { mode: 'scene', tA: 'בונים רצף הוראות', sub: 'הוסף פקודות בגרירה, בכפתורים או בחיצים ואנטר או רווח. עקוף את המכשול והרץ.', tip: 'שני צעדים ימינה ושניים למעלה יביאו אותך למטרה. איזה סדר עוקף את האדום?', aspect: [402, 488], alt: 'רשת רובוט, התחלה בפינה השמאלית התחתונה, מטרה שני תאים ימינה ושניים למעלה ומכשול בדרך; בנק פקודות ותוכנית בחמישה מקומות', cue: 'בנה מסלול והרץ מההתחלה', cueDone: 'הרובוט הגיע למטרה. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'editor', text: 'הוסף פקודה בגרירה, בכפתורים או בחיצים ואנטר, ואז הרץ.' }, setup: programScene('sequence') },
    { mode: 'quiz', tA: 'לאן מוביל הרצף?', sub: 'מההתחלה: ימינה, ימינה, למעלה. היכן הרובוט יסיים ביחס להתחלה?', tip: 'קרא משמאל לימין וספור בנפרד תנועה אופקית ותנועה אנכית.', btn: 'המשך ←', win: 'בדיוק. שתי הוראות ימינה ואחת למעלה.', wrongSay: 'כל הוראה מזיזה תא אחד בלבד. ספור את סוגי ההוראות.', opts: [
      { t: 'שניים ימינה ואחד למעלה', c: true, f: 'נכון: שתי הוראות ימינה והוראת למעלה אחת. אין כאן סיבובים.' },
      { t: 'אחד ימינה ושניים למעלה', f: 'החלפת בין מספרי ההוראות: ימינה מופיע פעמיים, למעלה פעם אחת.' },
      { t: 'שלושה ימינה', f: 'ספרת את כל הפקודות באותו כיוון. הפקודה השלישית היא למעלה, לא ימינה.' },
      { t: 'אחד למעלה בלבד', f: 'התעלמת מהפקודות הראשונות. כל שלוש ההוראות מתבצעות לפי הסדר.' }
    ], hints: ['עקוב אחר כל הוראה, אחת בכל פעם.', 'יש שתי פקודות באותו כיוון אופקי, ופקודה אחת אנכית.'] },
    { mode: 'scene', tA: 'מתקנים שגיאה בסדר', sub: 'הרץ את התוכנית. העבר פקודה בגרירה, בכפתורים או בחיצים ואנטר או רווח, ואז הרץ שוב.', tip: 'אותן פקודות בסדר אחר יוצרות מסלול אחר. חפש את הצעד שנכנס למכשול.', aspect: [402, 488], alt: 'אותה רשת עם מכשול; התוכנית ימינה, למעלה, ימינה, למעלה נעצרת בפקודה השנייה. אפשר לשנות את סדר הכרטיסים', cue: 'תקן את הסדר והרץ בלי התנגשות', cueDone: 'השגיאה תוקנה. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'runCode', text: 'הרץ ובדוק את העקבה, ואז שנה סדר בגרירה, בכפתורים או בחיצים ואנטר.' }, setup: programScene('debug') },
    { mode: 'quiz', tA: 'מהי השגיאה הלוגית?', sub: 'המכשול נמצא תא אחד ימינה ותא אחד למעלה מההתחלה. התוכנית: ימינה, למעלה, ימינה, למעלה. איזה תיקון עוקף אותו?', tip: 'אין שגיאת כתיבה בפקודות; צריך לשנות את התכנון.', btn: 'המשך ←', win: 'נכון. שתי תנועות ימינה לפני העלייה עוקפות את המכשול.', wrongSay: 'חשוב איפה הרובוט נמצא לפני העלייה הראשונה.', opts: [
      { t: 'להריץ שוב בלי שינוי', f: 'אותה תוכנית מאותה התחלה יוצרת שוב אותה התנגשות. הרצה חוזרת לא מתקנת סדר.' },
      { t: 'להעביר את הימינה השלישית למקום השני', c: true, f: 'נכון: מתקבל ימינה, ימינה, למעלה, למעלה. העלייה מתחילה אחרי שעקפת את עמודת המכשול.' },
      { t: 'למחוק את שתי העליות', f: 'מנעת התנגשות אבל גם ויתרת על המטרה שמעל ההתחלה. תיקון צריך להגיע ליעד.' },
      { t: 'להוסיף למטה בהתחלה', f: 'ההתחלה בתחתית הרשת. צעד למטה יוצא מיד מהגבול ואינו עוקף את המכשול.' }
    ], hints: ['חפש שינוי בסדר, לא שינוי במהירות ההרצה.', 'צריך להגיע רחוק יותר ימינה לפני הפקודה למעלה.', 'העבר את הימינה שמופיעה אחרי העלייה אל לפני העלייה.'] },
    { mode: 'scene', tA: 'מקצרים עם חזרה', sub: 'הוסף זוג חוזר בגרירה, בכפתורים או בחיצים ואנטר או רווח. כוון חזרות והרץ.', tip: 'בכל זוג: ימינה ואז למעלה. כמה פעמים צריך לבצע את הזוג כדי להגיע לסימון?', aspect: [402, 592], alt: 'רשת ללא מכשול ומטרה שלושה תאים ימינה ושלושה למעלה. פקודת זוג חוזר וסרגל של אחת עד שלוש חזרות', cue: 'השתמש בזוג חוזר אחד והרץ', cueDone: 'זוג אחד יצר את כל המסלול. אפשר להמשיך ←', btn: 'המשך ←', nudge: { target: 'editor', text: 'הוסף זוג חוזר, כוון חזרות בגרירה, בכפתורים או בחיצים, ואז הרץ.' }, setup: programScene('loop') },
    { mode: 'quiz', tA: 'כמה צעדים בלולאה?', sub: 'חוזרים שלוש פעמים על הזוג: ימינה ואז למעלה. כמה צעדים מתבצעים בסך הכול?', tip: 'ספור כמה פקודות יש בכל חזרה, ואז כמה פעמים חוזרים.', btn: 'המשך ←', win: 'נכון. שתי פקודות בכל חזרה, שלוש חזרות.', wrongSay: 'מספר החזרות ומספר הצעדים אינם אותו דבר.', opts: [
      { t: m('3'), f: 'ספרת רק את החזרות. בכל חזרה יש שני צעדים, לא אחד.' },
      { t: m('2'), f: 'ספרת זוג אחד בלבד. הזוג מבוצע שלוש פעמים.' },
      { t: m('6'), c: true, f: 'נכון: ' + m('3 × 2 = 6') + '. שלושה צעדים ימינה ושלושה למעלה.' },
      { t: m('5'), f: 'חיברת את מספר החזרות למספר הצעדים בזוג. כדי לספור ביצועים צריך לכפול, לא לחבר.' }
    ], hints: ['כמה צעדים יש בתוך הזוג?', 'בכל אחת משלוש החזרות יש שני צעדים.', 'חשב ' + m('3 × 2') + '.'] },
    { mode: 'quiz', tA: 'מה בדיוק חוזר?', sub: 'חוזרים פעמיים על הזוג ימינה ואז למעלה; אחרי הלולאה יש עוד ימינה. איזה רצף יבוצע?', tip: 'פתח את הלולאה לזוגות שלמים, ורק אחר כך הוסף את הפקודה שאחריה.', btn: 'לסיכום ←', win: 'מעולה. רק מה שבתוך הלולאה חוזר; ההוראה שאחריה מבוצעת פעם אחת.', wrongSay: 'סמן בראש את גבולות הלולאה. האם הימינה האחרונה נמצאת בתוכה?', opts: [
      { t: 'ימינה, למעלה, ימינה', f: 'ביצעת את הזוג רק פעם אחת. הלולאה דורשת שתי חזרות.' },
      { t: 'ימינה, ימינה, למעלה, למעלה, ימינה', f: 'קיבצת פקודות דומות ושינית את הסדר בתוך הזוג. צריך לשמור ימינה ואז למעלה בכל חזרה.' },
      { t: 'ימינה, למעלה, ימינה, ימינה, למעלה, ימינה', f: 'הכנסת את הפקודה שאחרי הלולאה לתוכה. הימינה הנוספת מבוצעת רק פעם אחת בסוף.' },
      { t: 'ימינה, למעלה, ימינה, למעלה, ימינה', c: true, f: 'נכון: שני זוגות שלמים, ואחריהם ימינה אחת. בסך הכול ' + m('2 × 2 + 1 = 5') + ' צעדים.' }
    ], hints: ['הפרד בין הפקודות שבתוך הלולאה לפקודה שאחריה.', 'כתוב זוג אחד, ואז שוב אותו זוג באותו סדר.', 'אחרי שני הזוגות הוסף ימינה פעם אחת בלבד.'] },
    { mode: 'finish', tA: 'סיימת את קוד בצעדים', sub: 'רצף קובע מסלול; עקבה חושפת שגיאה; חזרה מקצרת בלי לשנות את הסדר.', tip: 'כל הכבוד. הרובוט לא מנחש: תכנן, הרץ ובדוק מה בוצע באמת.', cue: 'אפשר לתרגל או לשחק שוב', btn: 'שחק שוב ↻', finalLead: 'הכלל שלקחת איתך:', formula: 'שמור על הסדר · בדוק עקבה · חזור על זוג שלם' }
  ];
  window.NoamGame.boot({
    slug: 'kod-batzadim', mascot: 'אליהו', steps: steps,
    skills: [
      { step: 2, name: 'קריאת רצף הוראות', math: '→ → ↑' },
      { step: 4, name: 'תיקון שגיאה לוגית', math: '→ → ↑ ↑' },
      { step: 6, name: 'ספירת צעדים בחזרה', math: '3 × 2 = 6' },
      { step: 7, name: 'גבולות הלולאה', math: '2 × 2 + 1 = 5' }
    ],
    bonus: {
      label: 'מכונת החזרות', closeLabel: 'סגור את המכונה', hint: 'ספור צעדים בלולאה ובהוראות שאחריה.',
      setup: function (box, ctx) {
        var loops = 1, tail = 0, guess = 0;
        box.innerHTML = '<div class="bTitle">מכונת החזרות</div><div class="bSub">בכל חזרה: ימינה ואז למעלה. כמה צעדים בסך הכול?</div><div class="bChip" data-ex></div><div class="stepper"><div class="unit" dir="ltr"><button type="button" data-d="-1" aria-label="פחות צעד">−</button><span dir="rtl" style="font-size:12px">צעדים</span><bdi class="var math" dir="ltr" data-guess>0</bdi><button type="button" data-d="1" aria-label="עוד צעד">+</button></div></div><div class="bForms" data-forms hidden dir="ltr"></div><div class="bOk" data-note role="status" hidden></div><button type="button" class="bDice" data-check style="min-width:44px;min-height:44px">בדוק</button><button type="button" class="bDice" data-roll style="min-width:44px;min-height:44px">תרגיל חדש ↻</button>';
        function updateBonus() {
          box.querySelector('[data-ex]').innerHTML = bdi(String(loops)) + ' חזרות, ועוד ' + bdi(String(tail)) + ' ימינה בסוף';
          box.querySelector('[data-guess]').textContent = String(guess);
          box.querySelector('[data-note]').hidden = true; box.querySelector('[data-forms]').hidden = true;
        }
        function rollBonus() { loops = 1 + Math.floor(Math.random() * 4); tail = Math.floor(Math.random() * 3); guess = 0; updateBonus(); }
        box.querySelectorAll('[data-d]').forEach(function (buttonNode) { buttonNode.addEventListener('click', function () { guess = clamp(guess + Number(buttonNode.getAttribute('data-d')), 0, 12); ctx.sfx('tick'); updateBonus(); }); });
        box.querySelector('[data-check]').addEventListener('click', function () {
          var ok = guess === loops * 2 + tail, noteNode = box.querySelector('[data-note]');
          noteNode.hidden = false; noteNode.style.color = ok ? PAL.good : BAD;
          noteNode.textContent = ok ? 'נכון! כופלים את החזרות בשני צעדים, ואז מוסיפים את מה שמחוץ ללולאה.' : guess === loops + tail ? 'ספרת כל חזרה כצעד אחד. בכל חזרה יש שני צעדים.' : 'נסה שוב: שני צעדים בכל חזרה, והפקודות שאחרי הלולאה מתווספות פעם אחת.';
          ctx.sfx(ok ? 'correct' : 'error');
          if (ok) { box.querySelector('[data-forms]').hidden = false; box.querySelector('[data-forms]').textContent = loops + ' × 2 + ' + tail + ' = ' + guess; }
        });
        box.querySelector('[data-roll]').addEventListener('click', function () { ctx.sfx('click'); rollBonus(); });
        rollBonus();
      }
    }
  });
}());
