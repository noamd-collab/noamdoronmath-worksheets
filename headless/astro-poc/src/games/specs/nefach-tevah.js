/**
 * נפח ושטח פנים של תיבה — an engine game.
 *
 * The idea: volume is how many unit cubes fit inside a box, surface area is
 * how much paper wraps it on the outside. Opening the box into a net shows
 * the difference, and the same volume can need very different amounts of paper.
 */
(function () {
  'use strict';
  var m = window.NoamGame.m;

  var W = 402, H = 300;
  /* The palette of this game, from its theme in src/lib/eliyahuGames.ts. */
  var P = window.NoamGame.palette;
  var INK = P.ink, MAIN = P.main, SOFT = P.soft, LINE = P.line;
  var WARM = '#f59e0b', WARM_SOFT = '#fdf0d8', GOOD = '#1d7a46', GOOD_SOFT = '#e9f9ef';
  var PINK = '#be3c7a', PINK_SOFT = '#fbe6f0';

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  /** Surface area of an l x w x h box. */
  function surface(l, w, h) { return 2 * (l * w + l * h + w * h); }

  /**
   * An oblique ("isometric-like") picture of an l x w x h box of unit cubes.
   * ox, oy is the bottom-left corner of the front face. Only the first n cubes
   * (layer by layer, from the bottom) are drawn; the dashed outline always shows
   * the full box. Cubes are painted far-to-near so nearer ones cover farther ones.
   */
  function cubes(l, w, h, u, ox, oy, n) {
    var d = u * 0.45, out = '', i, j, k, x, y, idx;
    var fw = l * u, fh = h * u, dd = w * d;
    out += '<g fill="none" stroke="' + LINE + '" stroke-width="1.4" stroke-dasharray="4 4">'
      + '<rect x="' + ox + '" y="' + (oy - fh) + '" width="' + fw + '" height="' + fh + '"/>'
      + '<polygon points="' + ox + ',' + (oy - fh) + ' ' + (ox + fw) + ',' + (oy - fh) + ' '
      + (ox + fw + dd) + ',' + (oy - fh - dd) + ' ' + (ox + dd) + ',' + (oy - fh - dd) + '"/>'
      + '<polygon points="' + (ox + fw) + ',' + oy + ' ' + (ox + fw + dd) + ',' + (oy - dd) + ' '
      + (ox + fw + dd) + ',' + (oy - fh - dd) + ' ' + (ox + fw) + ',' + (oy - fh) + '"/></g>';
    for (j = w - 1; j >= 0; j--) {
      for (k = 0; k < h; k++) {
        for (i = 0; i < l; i++) {
          idx = k * l * w + j * l + i;
          if (idx >= n) continue;
          x = ox + i * u + j * d;
          y = oy - k * u - j * d;
          out += '<rect x="' + x + '" y="' + (y - u) + '" width="' + u + '" height="' + u + '"'
            + ' fill="' + SOFT + '" stroke="' + MAIN + '" stroke-width="1"/>'
            + '<polygon points="' + x + ',' + (y - u) + ' ' + (x + u) + ',' + (y - u) + ' '
            + (x + u + d) + ',' + (y - u - d) + ' ' + (x + d) + ',' + (y - u - d) + '"'
            + ' fill="#f4f8ff" stroke="' + MAIN + '" stroke-width="1"/>'
            + '<polygon points="' + (x + u) + ',' + y + ' ' + (x + u + d) + ',' + (y - d) + ' '
            + (x + u + d) + ',' + (y - u - d) + ' ' + (x + u) + ',' + (y - u) + '"'
            + ' fill="' + LINE + '" stroke="' + MAIN + '" stroke-width="1"/>';
        }
      }
    }
    return out;
  }

  /** Unit size and origin that centre an l x w x h box around (cx, cy). */
  function place(l, w, h, cx, cy, maxW, maxH, maxU) {
    var u = Math.min(maxU, maxW / (l + 0.45 * w), maxH / (h + 0.45 * w));
    var tw = l * u + 0.45 * w * u, th = h * u + 0.45 * w * u;
    return { u: u, ox: cx - tw / 2, oy: cy + th / 2 };
  }

  /* ---------- step 1: fill the box with cubes ---------- */
  function fillScene(ctx) {
    var L = 2, Wd = 2, Ht = 2, hit = false, running = false;
    var box = ctx.extra(
      '<div class="stepper">'
      + '<div class="unit"><button type="button" data-k="l" data-d="-1" aria-label="פחות אורך">−</button>'
      + '<b style="font-size:12.5px">אורך</b><span class="var" data-v="l">2</span>'
      + '<button type="button" data-k="l" data-d="1" aria-label="עוד אורך">+</button></div>'
      + '<div class="unit"><button type="button" data-k="w" data-d="-1" aria-label="פחות רוחב">−</button>'
      + '<b style="font-size:12.5px">רוחב</b><span class="var" data-v="w">2</span>'
      + '<button type="button" data-k="w" data-d="1" aria-label="עוד רוחב">+</button></div>'
      + '<div class="unit"><button type="button" data-k="h" data-d="-1" aria-label="פחות גובה">−</button>'
      + '<b style="font-size:12.5px">גובה</b><span class="var" data-v="h">2</span>'
      + '<button type="button" data-k="h" data-d="1" aria-label="עוד גובה">+</button></div>'
      + '</div>'
    );
    var max = { l: 6, w: 4, h: 4 };
    function val(k) { return k === 'l' ? L : (k === 'w' ? Wd : Ht); }
    function paintBox(n) {
      var p = place(L, Wd, Ht, W / 2, 150, 330, 190, 40);
      ctx.draw(cubes(L, Wd, Ht, p.u, p.ox, p.oy, n));
    }
    function controls() {
      box.querySelector('[data-v="l"]').textContent = String(L);
      box.querySelector('[data-v="w"]').textContent = String(Wd);
      box.querySelector('[data-v="h"]').textContent = String(Ht);
      box.querySelectorAll('button').forEach(function (b) {
        var k = b.getAttribute('data-k'), d = Number(b.getAttribute('data-d'));
        var v = val(k);
        b.disabled = running || (d < 0 && v <= 1) || (d > 0 && v >= max[k]);
      });
    }
    function render() {
      var vol = L * Wd * Ht, layer = L * Wd;
      running = true;
      controls();
      ctx.busy(true);
      ctx.caption(m(L + ' × ' + Wd + ' × ' + Ht + ' = ' + vol));
      ctx.note('שכבה אחת היא ' + m(L + ' × ' + Wd + ' = ' + layer) + ' קוביות, ויש ' + m(String(Ht))
        + ' שכבות. בסך הכול ' + m(String(vol)) + ' קוביות.');
      ctx.tween(260 + 140 * Ht, function (l) {
        paintBox(Math.round(vol * window.NoamGame.ez(l)));
      }).then(function () {
        paintBox(vol);
        running = false;
        ctx.busy(false);
        controls();
        if (vol === 24 && !hit) {
          hit = true;
          ctx.sfx('correct');
          ctx.burst(16);
          ctx.note('בדיוק ' + m('24') + ' קוביות: ' + m(L + ' × ' + Wd + ' × ' + Ht + ' = 24')
            + '. נסה גם תיבה אחרת עם אותו נפח.', 'good');
          ctx.say('נפח הוא כמה קוביות נכנסות בפנים. אורך כפול רוחב כפול גובה.', { mood: 'happy', attn: true });
          ctx.solved();
        }
      });
    }
    box.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-k'), d = Number(b.getAttribute('data-d'));
        if (running) return;
        var nv = Math.max(1, Math.min(max[k], val(k) + d));
        if (k === 'l') L = nv; else if (k === 'w') Wd = nv; else Ht = nv;
        ctx.sfx('click');
        render();
      });
    });
    ctx.register('stepper', box);
    render();
  }

  /* ---------- step 3: open the box into a net ---------- */
  function netScene(ctx) {
    var opened = false, running = false;
    var u = 23, x0 = 155, bw = 4 * u, bh = 3 * u, sh = 2 * u; // bottom is 4 x 3, sides are 2 high
    var yBack = 35, yBot = yBack + sh, yFront = yBot + bh, yTop = yFront + sh;

    function face(x, y, w, h, fill, stroke) {
      var g = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill
        + '" stroke="' + stroke + '" stroke-width="2"/>', a;
      for (a = u; a < w - 1; a += u) {
        g += '<line x1="' + (x + a) + '" y1="' + y + '" x2="' + (x + a) + '" y2="' + (y + h) + '" stroke="' + stroke + '" stroke-width="0.8" opacity="0.55"/>';
      }
      for (a = u; a < h - 1; a += u) {
        g += '<line x1="' + x + '" y1="' + (y + a) + '" x2="' + (x + w) + '" y2="' + (y + a) + '" stroke="' + stroke + '" stroke-width="0.8" opacity="0.55"/>';
      }
      return g;
    }
    function label(x, y, text, color) {
      return '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-size="17"'
        + ' font-family="Secular One, sans-serif" fill="' + color + '">' + text + '</text>';
    }
    var pb = place(4, 3, 2, W / 2, 150, 300, 190, 34);
    ctx.draw(
      '<g id="gNet" opacity="0">'
      + '<g id="fBack">' + face(x0, yBack, bw, sh, WARM_SOFT, WARM) + '</g>'
      + '<g id="fLeft">' + face(x0 - sh, yBot, sh, bh, PINK_SOFT, PINK) + '</g>'
      + '<g id="fRight">' + face(x0 + bw, yBot, sh, bh, PINK_SOFT, PINK) + '</g>'
      + face(x0, yBot, bw, bh, SOFT, MAIN)
      + '<g id="fFront">' + face(x0, yFront, bw, sh, WARM_SOFT, WARM)
      + '<g id="fTop">' + face(x0, yTop, bw, bh, SOFT, MAIN) + '</g></g>'
      + '</g>'
      + '<g id="gBox">' + cubes(4, 3, 2, pb.u, pb.ox, pb.oy, 24) + '</g>'
      + '<g id="gLab" opacity="0">'
      + label(x0 + bw / 2, yBot + bh / 2, '12', MAIN)
      + label(x0 + bw / 2, yTop + bh / 2, '12', MAIN)
      + label(x0 + bw / 2, yBack + sh / 2, '8', WARM)
      + label(x0 + bw / 2, yFront + sh / 2, '8', WARM)
      + label(x0 - sh / 2, yBot + bh / 2, '6', PINK)
      + label(x0 + bw + sh / 2, yBot + bh / 2, '6', PINK)
      + '</g>'
    );
    var strip = ctx.extra(
      '<div class="sceneStrip" style="grid-template-columns:repeat(3,1fr)">'
      + '<div><b style="color:' + MAIN + '">קרקעית וגג</b><span data-s="0" style="color:' + MAIN + '">?</span></div>'
      + '<div><b style="color:' + WARM + '">חזית וגב</b><span data-s="1" style="color:' + WARM + '">?</span></div>'
      + '<div><b style="color:' + PINK + '">שתי דפנות</b><span data-s="2" style="color:' + PINK + '">?</span></div>'
      + '</div>'
    );
    ctx.caption('תיבה סגורה: ' + m('4 × 3 × 2'));
    ctx.note('כל הנייר שעוטף את התיבה מבחוץ הוא שטח הפנים שלה.');

    function hinge(sy, sx, hy, hx) {
      if (hx === null) return 'translate(0,' + hy + ') scale(1,' + Math.max(sy, 0.001) + ') translate(0,' + (-hy) + ')';
      return 'translate(' + hx + ',0) scale(' + Math.max(sx, 0.001) + ',1) translate(' + (-hx) + ',0)';
    }
    function pose(p) {
      var s = window.NoamGame.ez(clamp((p - 0.15) / 0.5));
      var t = window.NoamGame.ez(clamp((p - 0.55) / 0.4));
      var fade = clamp(p / 0.2);
      ctx.el('gBox').setAttribute('opacity', String(1 - fade));
      ctx.el('gNet').setAttribute('opacity', String(fade));
      ctx.el('fBack').setAttribute('transform', hinge(s, 0, yBot, null));
      ctx.el('fFront').setAttribute('transform', hinge(s, 0, yFront, null));
      ctx.el('fTop').setAttribute('transform', hinge(t, 0, yTop, null));
      ctx.el('fLeft').setAttribute('transform', hinge(0, s, 0, x0));
      ctx.el('fRight').setAttribute('transform', hinge(0, s, 0, x0 + bw));
    }
    pose(0);
    var btn = ctx.button('פתח את התיבה לפריסה 📦', function () {
      if (running || opened) return;
      running = true;
      ctx.busy(true);
      ctx.sfx('click');
      ctx.tween(1500, function (l) { pose(l); }).then(function () {
        pose(1);
        ctx.el('gLab').setAttribute('opacity', '1');
        var s = strip.querySelectorAll('[data-s]');
        s[0].textContent = m('2 × 12 = 24');
        s[1].textContent = m('2 × 8 = 16');
        s[2].textContent = m('2 × 6 = 12');
        opened = true;
        running = false;
        ctx.busy(false);
        btn.disabled = true;
        ctx.caption(m('24 + 16 + 12 = 52'));
        ctx.note('שש פאות, שלושה זוגות זהים. יחד ' + m('52') + ' משבצות נייר, וזה שטח הפנים.', 'good');
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.say('הנפח סופר קוביות בפנים. שטח הפנים סופר נייר בחוץ.', { mood: 'happy', attn: true });
        ctx.solved();
      });
    }, { target: 'open' });
    ctx.register('open', btn);
  }

  /* ---------- step 5: same volume, different wrapping ---------- */
  function wrapScene(ctx) {
    var boxes = [
      { name: 'א׳', l: 9, w: 4, h: 1 },
      { name: 'ב׳', l: 6, w: 3, h: 2 },
      { name: 'ג׳', l: 4, w: 3, h: 3 }
    ];
    var seen = [true, false, false], cur = 0, done = false;
    boxes.forEach(function (b) {
      b.area = surface(b.l, b.w, b.h);
      b.parts = [b.l * b.w, b.l * b.h, b.w * b.h];
    });
    var base = 240, scale = 1.7, cxs = [235, 292, 349];
    function render() {
      var b = boxes[cur], p = place(b.l, b.w, b.h, 112, 135, 170, 150, 22), i, bar = '', v, hh;
      bar += '<line x1="205" y1="' + base + '" x2="378" y2="' + base + '" stroke="' + INK + '" stroke-width="2"/>';
      for (i = 0; i < 3; i++) {
        hh = boxes[i].area * scale;
        if (seen[i]) {
          bar += '<rect x="' + (cxs[i] - 21) + '" y="' + (base - hh) + '" width="42" height="' + hh + '" rx="5"'
            + ' fill="' + (i === cur ? WARM : WARM_SOFT) + '" stroke="' + WARM + '" stroke-width="2"/>'
            + '<text x="' + cxs[i] + '" y="' + (base - hh - 7) + '" text-anchor="middle" font-size="16"'
            + ' font-family="Secular One, sans-serif" fill="' + INK + '">' + boxes[i].area + '</text>';
        } else {
          bar += '<rect x="' + (cxs[i] - 21) + '" y="' + (base - 60) + '" width="42" height="60" rx="5"'
            + ' fill="none" stroke="' + LINE + '" stroke-width="2" stroke-dasharray="5 4"/>'
            + '<text x="' + cxs[i] + '" y="' + (base - 26) + '" text-anchor="middle" font-size="20"'
            + ' font-family="Secular One, sans-serif" fill="' + LINE + '">?</text>';
        }
        bar += '<text x="' + cxs[i] + '" y="260" text-anchor="middle" font-size="15"'
          + ' font-family="Secular One, sans-serif" fill="' + (i === cur ? MAIN : INK) + '">' + boxes[i].name + '</text>';
      }
      v = cubes(b.l, b.w, b.h, p.u, p.ox, p.oy, 36)
        + '<text x="112" y="' + (p.oy + 24) + '" text-anchor="middle" font-size="15" dir="ltr"'
        + ' font-family="Secular One, sans-serif" fill="' + MAIN + '">' + b.l + ' × ' + b.w + ' × ' + b.h + '</text>';
      ctx.draw(v + bar);
      ctx.caption(m(b.l + ' × ' + b.w + ' × ' + b.h + ' = 36'));
      ctx.note('תיבה ' + b.name + ': נפח ' + m('36') + ', שטח פנים ' + m('2 × (' + b.parts[0] + ' + '
        + b.parts[1] + ' + ' + b.parts[2] + ') = ' + b.area) + '.', done ? 'good' : null);
    }
    function pick(i) {
      cur = i;
      seen[i] = true;
      ctx.sfx('tick');
      if (seen[0] && seen[1] && seen[2] && !done) {
        done = true;
        render();
        ctx.sfx('correct');
        ctx.burst(16);
        ctx.note('כולן ' + m('36') + ' קוביות, אבל תיבה ג׳ צריכה רק ' + m('66')
          + ' משבצות נייר ותיבה א׳ צריכה ' + m('98') + '. תיבה קרובה לקובייה חוסכת נייר.', 'good');
        ctx.say('אותו נפח, ושטח פנים אחר. התיבה הכי קרובה לקובייה היא הכי חסכונית.', { mood: 'happy', attn: true });
        ctx.solved();
        return;
      }
      render();
    }
    var b0 = ctx.button('תיבה א׳', function () { pick(0); }, { ghost: true, target: 'wrap' });
    ctx.button('תיבה ב׳', function () { pick(1); }, { ghost: true });
    ctx.button('תיבה ג׳', function () { pick(2); }, { ghost: true });
    ctx.register('wrap', b0);
    render();
  }

  /** A static labelled box, used as the picture of a question. */
  function still(l, w, h) {
    return function (ctx) {
      var p = place(l, w, h, W / 2, 150, 300, 170, 40), d = p.u * 0.45;
      var front = p.ox + l * p.u, fy = p.oy - h * p.u;
      var lab = function (x, y, t) {
        return '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-size="17"'
          + ' font-family="Secular One, sans-serif" fill="' + MAIN + '">' + t + '</text>';
      };
      ctx.draw(cubes(l, w, h, p.u, p.ox, p.oy, l * w * h)
        + lab(p.ox + l * p.u / 2, p.oy + 18, l)
        + lab(front + w * d / 2 + 14, p.oy - w * d / 2 + 10, w)
        + lab(p.ox - 14, fy + h * p.u / 2, h)
        + (fy ? '' : ''));
    };
  }

  var steps = [
    {
      mode: 'intro',
      tA: 'קוביות בפנים, נייר בחוץ',
      sub: 'שתי שאלות על אותה תיבה: כמה נכנס בפנים, וכמה נייר צריך כדי לעטוף אותה.',
      tip: 'שלום, אני אליהו. בוא נגלה מה ההבדל בין נפח לשטח פנים.',
      emoji: '📦',
      eq: m('V = a × b × c'),
      note: 'אליהו יפתח איתך תיבה לפריסה, ותראה מאיפה מגיע כל מספר.',
      cue: 'לחץ כדי להתחיל',
      btn: 'בוא נתחיל ←'
    },
    {
      mode: 'scene',
      tA: 'ממלאים את התיבה בקוביות',
      sub: 'שנה את האורך, הרוחב והגובה, וראה איך התיבה מתמלאת בקוביות יחידה.',
      tip: 'נפח הוא כמה קוביות נכנסות בפנים. בנה לי תיבה שמחזיקה ' + m('24') + ' קוביות.',
      cue: 'בנה תיבה עם נפח 24',
      cueDone: 'יפה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'תיבה מצוירת בהטיה, מלאה בקוביות יחידה, עם שלושה כפתורי שינוי',
      nudge: { target: 'stepper', text: 'השתמש בכפתורים כדי לשנות את מידות התיבה.' },
      setup: fillScene
    },
    {
      mode: 'quiz',
      tA: 'מה הנפח של התיבה?',
      sub: 'אורך ' + m('4') + ', רוחב ' + m('3') + ' וגובה ' + m('2') + '.',
      tip: 'חשוב על שכבה אחת של קוביות, ואז על כמה שכבות יש.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'תיבה באורך 4, ברוחב 3 ובגובה 2',
      setup: still(4, 3, 2),
      win: 'נכון. אורך כפול רוחב כפול גובה.',
      wrongSay: 'חשב שכבה אחת, ואז הכפל במספר השכבות.',
      opts: [
        { t: '24', c: true, f: 'שכבה אחת היא ' + m('4 × 3 = 12') + ', ושתי שכבות הן ' + m('24') + ' קוביות.' },
        { t: '9', f: 'זה ' + m('4 + 3 + 2') + '. חיבור לא סופר קוביות, כפל כן.' },
        { t: '12', f: 'זו רק שכבה אחת. יש עוד שכבה מעליה.' },
        { t: '52', f: 'זה שטח הפנים, כלומר כמה נייר עוטף. כאן שואלים כמה קוביות בפנים.' }
      ],
      hints: [
        'שכבה אחת היא ' + m('4 × 3') + ' קוביות.',
        'יש שתי שכבות כאלה, לפי הגובה.'
      ]
    },
    {
      mode: 'scene',
      tA: 'פותחים את התיבה',
      sub: 'פתח את התיבה לפריסה שטוחה וראה כמה נייר צריך לכל פאה.',
      tip: 'עכשיו נפתח את התיבה ונראה את הנייר שעוטף אותה.',
      cue: 'לחץ על כפתור הפתיחה',
      cueDone: 'ראית את הפריסה. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'תיבה שנפתחת לפריסה שטוחה של שש פאות בשלושה צבעים',
      nudge: { target: 'open', text: 'לחץ על הכפתור כדי לפתוח את התיבה.' },
      setup: netScene
    },
    {
      mode: 'quiz',
      tA: 'מה שטח הפנים של התיבה?',
      sub: 'אותה תיבה: ' + m('4 × 3 × 2') + '. סכום שטחי שש הפאות.',
      tip: 'יש שלושה זוגות של פאות זהות. חשב כל זוג ואז חבר.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'תיבה באורך 4, ברוחב 3 ובגובה 2',
      setup: still(4, 3, 2),
      win: 'בדיוק. שלושה זוגות של פאות, וכל זוג נספר פעמיים.',
      wrongSay: 'זכור שיש שש פאות, שלושה זוגות זהים.',
      opts: [
        { t: '52', c: true, f: m('2 × 12 + 2 × 8 + 2 × 6 = 24 + 16 + 12 = 52') + '.' },
        { t: '24', f: 'זה הנפח, כלומר כמה קוביות בפנים. כאן שואלים כמה נייר.' },
        { t: '26', f: 'זה ' + m('12 + 8 + 6') + '. ספרת פאה אחת מכל זוג בלבד.' },
        { t: '40', f: 'זה ' + m('2 × 12 + 2 × 8') + '. שכחת את שתי הדפנות הצדדיות.' }
      ],
      hints: [
        'קרקעית וגג: ' + m('4 × 3 = 12') + ' כל אחד.',
        'חזית וגב: ' + m('4 × 2 = 8') + ' כל אחד. דפנות: ' + m('3 × 2 = 6') + ' כל אחת.'
      ]
    },
    {
      mode: 'scene',
      tA: 'אותו נפח, עטיפה אחרת',
      sub: 'לשלוש תיבות יש אותו נפח. עבור ביניהן והשווה כמה נייר כל אחת צריכה.',
      tip: 'שלוש תיבות, כולן עם נפח ' + m('36') + '. בוא נראה מי חוסכת נייר.',
      cue: 'בדוק את שלוש התיבות',
      cueDone: 'ראית את ההבדל. אפשר להמשיך ←',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'תיבה מצוירת משמאל ושלוש עמודות מימין שמשוות את שטח הפנים של שלוש תיבות',
      nudge: { target: 'wrap', text: 'לחץ על התיבות כדי להשוות את העמודות.' },
      setup: wrapScene
    },
    {
      mode: 'quiz',
      tA: 'כמה קוביות צריך להוסיף כדי להכפיל את הנפח?',
      sub: 'התיבה ' + m('4 × 3 × 2') + ' מחזיקה ' + m('24') + ' קוביות.',
      tip: 'כדי שהנפח יהיה כפול, חשב כמה קוביות יהיו בסך הכול, ואז כמה חסרות.',
      btn: 'המשך ←',
      aspect: [W, H],
      alt: 'תיבה באורך 4, ברוחב 3 ובגובה 2',
      setup: still(4, 3, 2),
      win: 'נכון. נפח כפול הוא ' + m('48') + ', ולכן מוסיפים עוד ' + m('24') + '.',
      wrongSay: 'כפול מ־' + m('24') + ' הוא ' + m('48') + '. כמה חסר?',
      opts: [
        { t: '24', c: true, f: 'צריך ' + m('48') + ' בסך הכול, ובפנים כבר יש ' + m('24') + '. מוסיפים עוד ' + m('24') + '.' },
        { t: '48', f: 'זה הנפח החדש בסך הכול. שואלים כמה קוביות להוסיף.' },
        { t: '12', f: 'זו שכבה אחת, ולא מספיקה כדי להכפיל.' },
        { t: '28', f: 'זה ' + m('24 + 4') + '. שורה אחת של ' + m('4') + ' קוביות לא מכפילה את הנפח.' }
      ],
      hints: [
        'הנפח הנוכחי הוא ' + m('24') + '. כפול שניים הוא ' + m('48') + '.',
        'כמה קוביות חסרות בין ' + m('24') + ' ל־' + m('48') + '?'
      ]
    },
    {
      mode: 'quiz',
      tA: 'איזו תיבה חוסכת הכי הרבה נייר?',
      sub: 'לכל התיבות נפח ' + m('30') + '. איזו צריכה את הכי מעט נייר עטיפה?',
      tip: 'חשב את שטח הפנים של כל תיבה. רמז: התיבה הקרובה ביותר לקובייה חוסכת.',
      btn: 'לסיכום ←',
      win: 'מעולה. תיבה שקרובה לקובייה צריכה הכי פחות נייר.',
      wrongSay: 'חשב שטח פנים לכל תיבה. הארוכה והדקה מבזבזת נייר.',
      opts: [
        { t: '3 × 2 × 5', c: true, f: m('2 × (6 + 15 + 10) = 62') + '. הכי מעט נייר מבין כולן.' },
        { t: '1 × 5 × 6', f: m('2 × (5 + 6 + 30) = 82') + '. שטוחה יותר, ולכן צריכה יותר נייר.' },
        { t: '1 × 3 × 10', f: m('2 × (3 + 10 + 30) = 86') + '. ארוכה ודקה, והנייר גדל.' },
        { t: '1 × 1 × 30', f: m('2 × (1 + 30 + 30) = 122') + '. מקל ארוך, הכי הרבה נייר.' }
      ],
      hints: [
        'חשב את שטח הפנים של תיבה אחת בעזרת ' + m('2 × (a × b + a × c + b × c)') + '.',
        'בדוק קודם את ' + m('3 × 2 × 5') + ': ' + m('2 × (6 + 15 + 10)') + '.'
      ]
    },
    {
      mode: 'finish',
      tA: 'סיימת את משחק התיבה',
      sub: 'נפח סופר קוביות בפנים. שטח פנים סופר נייר בחוץ. ולאותו נפח יכולים להיות הרבה שטחי פנים.',
      tip: 'כל הכבוד. עכשיו אתה יודע להבדיל בין נפח לשטח פנים.',
      cue: 'אפשר לשחק שוב',
      btn: 'שחק שוב ↻',
      finalLead: 'החוקים שגילית:',
      formula: m('V = a × b × c') + ' ו־' + m('S = 2 × (a × b + a × c + b × c)')
    }
  ];

  window.NoamGame.boot({
    slug: 'nefach-tevah',
    mascot: 'אליהו',
    steps: steps,
    skills: [
      { step: 2, name: 'נפח תיבה', math: '4 × 3 × 2' },
      { step: 4, name: 'שטח פנים', math: '2 × (12 + 8 + 6)' },
      { step: 6, name: 'הכפלת נפח', math: '24 × 2' },
      { step: 7, name: 'השוואת שטחי פנים', math: '3 × 2 × 5' }
    ],
    bonus: {
      label: 'מכונת התיבות 📦',
      closeLabel: 'סגור את המכונה',
      hint: 'לחץ על הכפתור וקבל תיבה חדשה. חשב נפח ושטח פנים, ואז בדוק.',
      setup: function (box, ctx) {
        var a = 4, b = 3, c = 2, open = false;
        box.innerHTML = '<div class="bTitle">מכונת התיבות</div>'
          + '<div class="bSub">קבל תיבה, חשב בראש את הנפח ואת שטח הפנים, ואז בדוק.</div>'
          + '<div class="bChip" data-ex dir="ltr"></div>'
          + '<div class="bForms" data-sol dir="ltr" hidden></div>'
          + '<button type="button" class="bDice" data-roll>📦 תיבה חדשה</button>'
          + '<button type="button" class="bDice" data-show>גלה את התשובה</button>';
        var chip = box.querySelector('[data-ex]');
        var sol = box.querySelector('[data-sol]');
        function draw() {
          chip.textContent = a + ' × ' + b + ' × ' + c;
          sol.innerHTML = '<div>V = ' + a + ' × ' + b + ' × ' + c + ' = ' + (a * b * c) + '</div>'
            + '<div>S = 2 × (' + (a * b) + ' + ' + (a * c) + ' + ' + (b * c) + ')</div>'
            + '<div>S = ' + surface(a, b, c) + '</div>';
          sol.hidden = !open;
        }
        box.querySelector('[data-roll]').addEventListener('click', function () {
          a = 2 + Math.floor(Math.random() * 6);
          b = 2 + Math.floor(Math.random() * 5);
          c = 1 + Math.floor(Math.random() * 5);
          open = false;
          ctx.sfx('click');
          draw();
        });
        box.querySelector('[data-show]').addEventListener('click', function () {
          open = !open;
          ctx.sfx(open ? 'correct' : 'click');
          draw();
        });
        draw();
      }
    }
  });
}());
