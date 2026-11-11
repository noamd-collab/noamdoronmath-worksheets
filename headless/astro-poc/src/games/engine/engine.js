/**
 * Eliyahu game engine.
 *
 * Generalised from src/games/eliyahu-pythagoras.html: the same card, the same
 * mascot with his speech bubble and moods, the same quiz scoring and the same
 * finish report, driven by a declarative spec instead of one hand-written file.
 *
 * A game calls NoamGame.boot(spec) once. The engine owns the shell; the spec
 * owns the wording and the drawing of each scene.
 *
 *   spec = {
 *     slug, mascot, steps: [...], skills: [{step, name, math}], bonus
 *   }
 *
 * Step modes:
 *   intro  { tA, tM, tB, sub, tip, btn, cue, emoji, eq, art, note }
 *   quiz   { tA, sub, tip, btn, win, wrongSay, opts: [{t, c, f}], hints }
 *   scene  { tA, sub, tip, btn, cue, cueDone, aspect: [w, h], setup(ctx) }
 *   finish { tA, sub, tip, btn, formula }
 *
 * The scene context is documented in sceneContext() below.
 */
(function () {
  'use strict';

  var LRI = '\u2066';
  var PDI = '\u2069';

  /** Wrap mathematics so RTL text never reorders it. */
  function m(text) { return LRI + text + PDI; }

  var VB = {
    idle: '20 20 120 130',
    blink: '180 20 120 130',
    happy: '340 20 120 130',
    think: '500 20 120 130',
    talk: '660 20 120 130'
  };

  var SHAPES = {
    cloud: { d: 'M18,30 C18,12 38,6 48,16 C56,4 78,6 82,22 C98,22 100,44 90,52 C100,64 90,84 74,80 C68,96 44,98 38,86 C24,96 4,86 10,70 C-2,62 2,40 18,30 Z', pad: '20px 30px', min: 170 },
    circle: { d: 'M50,1 A49,49 0 1,1 49.9,1 Z', pad: '22px 34px', min: 180 },
    square: { d: 'M8,0 H92 Q100,0 100,8 V92 Q100,100 92,100 H8 Q0,100 0,92 V8 Q0,0 8,0 Z', pad: '10px 16px', min: 130 },
    trapezoid: { d: 'M16,0 H84 Q88,0 89,4 L100,94 Q100,100 94,100 H6 Q0,100 0,94 L11,4 Q12,0 16,0 Z', pad: '12px 36px', min: 170 },
    triangle: { d: 'M47,3 Q50,-1 53,3 L99,94 Q100,100 94,100 H6 Q0,100 1,94 Z', pad: '50px 64px 12px', min: 240 },
    rhombus: { d: 'M50,0 L100,50 L50,100 L0,50 Z', pad: '30px 66px', min: 240 }
  };
  var SHAPE_CYCLE = ['cloud', 'circle', 'square', 'trapezoid', 'triangle', 'rhombus'];

  var POINTS_PER_QUIZ = 80;

  function $(id) { return document.getElementById(id); }
  function ez(l) { return l < 0.5 ? 2 * l * l : 1 - Math.pow(-2 * l + 2, 2) / 2; }

  function mathNode(text) {
    var bd = document.createElement('bdi');
    bd.className = 'math';
    bd.dir = 'ltr';
    bd.textContent = text;
    return bd;
  }

  /** Render a string that may contain LRI-wrapped mathematics into an element. */
  function fillRich(el, text) {
    el.replaceChildren();
    var s = String(text == null ? '' : text);
    var i = 0;
    while (i < s.length) {
      var a = s.indexOf(LRI, i);
      if (a < 0) { el.append(s.slice(i)); break; }
      if (a > i) el.append(s.slice(i, a));
      var b = s.indexOf(PDI, a + 1);
      if (b < 0) { el.append(s.slice(a + 1)); break; }
      var math = s.slice(a + 1, b);
      var j = b + 1;
      if (s[j] === '?') { math += '?'; j += 1; }
      el.append(mathNode(math));
      i = j;
    }
  }

  function escHtml(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  function richHtml(text) {
    var s = String(text == null ? '' : text);
    var i = 0;
    var html = '';
    while (i < s.length) {
      var a = s.indexOf(LRI, i);
      if (a < 0) { html += escHtml(s.slice(i)); break; }
      if (a > i) html += escHtml(s.slice(i, a));
      var b = s.indexOf(PDI, a + 1);
      if (b < 0) { html += escHtml(s.slice(a + 1)); break; }
      var math = s.slice(a + 1, b);
      var j = b + 1;
      if (s[j] === '?') { math += '?'; j += 1; }
      html += '<bdi class="math" dir="ltr">' + escHtml(math) + '</bdi>';
      i = j;
    }
    return html;
  }

  /** Break a sentence into bubble lines without splitting isolated mathematics. */
  function toLines(s, n) {
    var w = [];
    var cur = '';
    var d = 0;
    var chars = String(s || '');
    for (var k = 0; k < chars.length; k++) {
      var ch = chars[k];
      if (ch === LRI) d++; else if (ch === PDI) d = Math.max(0, d - 1);
      if (ch === ' ' && d === 0) { if (cur) w.push(cur); cur = ''; } else cur += ch;
    }
    if (cur) w.push(cur);
    var out = [];
    for (var i = 0; i < w.length; i += n) out.push(w.slice(i, i + n).join(' '));
    return out.length ? out : [''];
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hebrew(text) { return /[\u0590-\u05FF]/.test(String(text)); }

  /**
   * The document palette, so a scene draws in the colours of its own game
   * instead of repeating hex codes. The custom properties come from the theme
   * in src/lib/eliyahuGames.ts; the fallbacks keep a spec working on its own.
   */
  function palette() {
    var cs = null;
    try { cs = getComputedStyle(document.documentElement); } catch (e) { cs = null; }
    function v(name, fallback) {
      var raw = cs ? cs.getPropertyValue(name) : '';
      raw = (raw || '').trim();
      return raw || fallback;
    }
    return {
      ink: v('--ink', '#0c2340'),
      main: v('--main', '#1d4ed8'),
      dark: v('--main-dark', '#1e3a8a'),
      soft: v('--main-soft', '#e2ecff'),
      line: v('--main-line', '#a3c0f5'),
      warm: '#f59e0b',
      warmSoft: '#fdf0d8',
      good: '#1d7a46',
      goodSoft: '#e9f9ef'
    };
  }

  var SHELL =
    '<div id="card" data-screen-label="01 intro">'
    + '<div class="head">'
    + '<div id="stepLabel" class="step-chip"></div>'
    + '<div class="head-right">'
    + '<div id="scoreChip" class="score-chip" data-score-chip dir="ltr" aria-label="ניקוד">'
    + '<span style="color:#f59e0b;font-size:15px">★</span><span id="scoreTotal">0</span></div>'
    + '<button id="soundBtn" type="button" aria-label="השתק צלילים">🔊</button>'
    + '</div></div>'
    + '<div class="track" aria-hidden="true"><div id="progressFill"></div></div>'
    + '<div id="grid">'
    + '<div class="col" id="colVisual">'
    + '<div id="panelIntro" class="panel" data-enter hidden>'
    + '<div id="heroEmoji" class="puzzle" aria-hidden="true"></div>'
    + '<div id="heroEq" class="math-line"></div>'
    + '<div id="heroArt" class="heroArt" dir="ltr" aria-hidden="true" hidden></div>'
    + '<div id="heroNote"></div>'
    + '</div>'
    + '<div id="panelScene" class="panel" hidden>'
    + '<div id="sceneFrame"><svg id="sceneSvg" preserveAspectRatio="xMidYMid meet" dir="ltr" role="img"></svg></div>'
    + '<div id="sceneExtra" hidden></div>'
    + '<div id="sceneRow"></div>'
    + '<div id="sceneCap" class="math-line" hidden></div>'
    + '<div id="sceneNote" role="status" aria-live="polite" hidden></div>'
    + '</div>'
    + '<div id="panelFinish" class="panel" data-enter hidden>'
    + '<div style="display:flex;align-items:center;gap:14px;justify-content:center">'
    + '<div id="trophy" data-trophy style="font-size:44px;line-height:1">🏆</div>'
    + '<div style="display:flex;flex-direction:column;align-items:center;gap:4px">'
    + '<div style="font-size:12.5px;font-weight:700;color:#6b6a8a">הניקוד שלך</div>'
    + '<div dir="ltr" style="font-family:\'Secular One\',sans-serif;font-size:40px;line-height:1">'
    + '<span id="scoreBig" data-score>0</span><span id="scoreMax" style="font-size:18px;color:#9a97b8"></span></div>'
    + '</div></div>'
    + '<div id="stars" dir="ltr" style="display:flex;gap:6px;justify-content:center"></div>'
    + '<div class="sumbox">'
    + '<div style="background:#e9f9ef;border:1.5px solid #9fd8b4;border-radius:12px;padding:8px 12px">'
    + '<div style="font-size:12px;font-weight:700;color:#1d7a46">💪 חזק ב־</div>'
    + '<div id="strongText" style="font-weight:800;font-size:14px;line-height:1.4"></div></div>'
    + '<div style="background:#fdeee4;border:1.5px solid #f0b48f;border-radius:12px;padding:8px 12px">'
    + '<div style="font-size:12px;font-weight:700;color:#b45309">🎯 כדאי לחזק</div>'
    + '<div id="weakText" style="font-weight:800;font-size:14px;line-height:1.4"></div></div>'
    + '</div>'
    + '<div id="skillRows" style="display:flex;flex-direction:column;gap:8px"></div>'
    + '<div id="finalLead" style="font-weight:700;color:#55537a;font-size:15px;text-align:center"></div>'
    + '<div id="finalEq" class="formula math-line"></div>'
    + '<button id="bonusToggle" type="button" hidden></button>'
    + '<div id="bonus" hidden></div>'
    + '</div>'
    + '</div>'
    + '<div class="col" id="colControls">'
    + '<div data-enter><h1 id="title"></h1><div id="sub"></div></div>'
    + '<div id="quiz" data-enter hidden>'
    + '<div id="opts"></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;align-items:stretch">'
    + '<button id="hintBtn" data-hintbtn type="button">💡 רמז</button>'
    + '<div id="hintBox" data-hintbox role="status" aria-live="polite" hidden></div>'
    + '</div></div>'
    + '<div id="fb" role="status" aria-live="polite" hidden></div>'
    + '<div id="home" aria-hidden="true"></div>'
    + '<div id="cue" data-cue></div>'
    + '<button id="next" data-primary type="button"></button>'
    + '</div>'
    + '</div>'
    + '<div id="float" dir="ltr">'
    + '<div id="tilt"><div id="drift">'
    + '<div id="bubble" dir="rtl">'
    + '<svg id="shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
    + '<path id="shapePath" style="fill:var(--main-soft);stroke:var(--main-line);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round"></path></svg>'
    + '<div style="position:absolute;right:-5px;top:calc(50% + 4px);width:9px;height:9px;border-radius:50%;background:var(--main-soft);border:2px solid var(--main-line)"></div>'
    + '<div style="position:absolute;right:-12px;top:calc(50% + 14px);width:6px;height:6px;border-radius:50%;background:var(--main-soft);border:1.5px solid var(--main-line)"></div>'
    + '<div id="bubbleName"></div>'
    + '<div id="bubbleText" aria-live="polite"></div>'
    + '</div>'
    + '<div id="rivoBox"><div id="rivoHost"></div></div>'
    + '<div id="pointer" aria-hidden="true">👉</div>'
    + '</div></div></div>'
    + '<div id="conf" aria-hidden="true"></div>'
    + '</div>';

  var app = {
    spec: null,
    steps: [],
    skills: [],
    state: {
      idx: 0, done: false, wrong: [], hint: 0, fb: null, mood: 'idle', trans: null,
      msg: '', msgId: 0, typing: false, attn: false, sound: true, target: 'home',
      below: false, above: false, res: {}, retry: false, scene: {}, sceneReady: false,
      busy: false, dragging: false
    },
    props: { idleNudgeSec: 9, bubbleShape: 'cycle', wordsPerLine: 4 },
    timers: [], anims: [], wrongN: 0, px: null, py: null, rv: null, _vb: null,
    _tok: 0, _pointEls: {},

    /* Motion stays on inside the site embed: the lesson tweens carry the
       explanation, so collapsing them would remove the content itself. */
    get rm() { return false; },

    /* ---------- small helpers ---------- */
    later: function (fn, ms) { var t = setTimeout(fn, ms); this.timers.push(t); return t; },
    wait: function (ms) { var self = this; return new Promise(function (res) { self.later(res, ms); }); },
    q: function (sel) { return $('app').querySelector(sel); },
    an: function (el, k, o) {
      if (!el || !el.animate) return null;
      try { var a = el.animate(k, o); this.anims.push(a); return a; } catch (e) { return null; }
    },
    tween: function (ms, fn) {
      var self = this;
      var tok = this._tok;
      return new Promise(function (res) {
        if (ms <= 1) { fn(1); res(); return; }
        var t0 = performance.now();
        var st = function (now) {
          if (tok !== self._tok) return;
          var l = Math.min(1, (now - t0) / ms);
          fn(l);
          if (l < 1) requestAnimationFrame(st); else res();
        };
        requestAnimationFrame(st);
      });
    },
    setState: function (patch) {
      var prev = this.state;
      var partial = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = Object.assign({}, this.state, partial);
      this.paint();
      this.afterPaint(prev);
    },
    clearCelebration: function () {
      this.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      this.anims = [];
      var L = $('conf');
      if (L) L.innerHTML = '';
      document.querySelectorAll('[data-cf]').forEach(function (n) { n.remove(); });
    },
    clearAll: function () {
      this.timers.forEach(clearTimeout);
      this.timers = [];
      cancelAnimationFrame(this.raf);
      this.raf = null;
      [this.sayT, this.talkT, this.attnT, this.nudgeT, this.homeT].forEach(clearTimeout);
      this.clearCelebration();
      this.counting = false;
      this._tok = this._tok + 1;
    },

    /* ---------- mascot ---------- */
    mountRivo: function () {
      var host = $('rivoHost');
      var tpl = $('rivo-tpl');
      if (!host || !tpl) return;
      host.appendChild(tpl.content.cloneNode(true));
      var svg = host.querySelector('svg');
      if (!svg) return;
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('aria-hidden', 'true');
      this.rv = svg;
      this.applyRivo();
    },
    rivoFace: function () {
      var s = this.state;
      if (s.dragging) return 'idle';
      if (s.mood !== 'idle') return s.mood;
      return s.trans || 'idle';
    },
    applyRivo: function () {
      var f = this.rivoFace();
      if (this.rv && this._vb !== f) { this.rv.setAttribute('viewBox', VB[f]); this._vb = f; }
    },
    blinkLoop: function () {
      var self = this;
      this.blinkT = setTimeout(function () {
        if (self.state.mood === 'idle' && !self.state.trans && !self.state.dragging) {
          self.setState({ trans: 'blink' });
          setTimeout(function () { if (self.state.trans === 'blink') self.setState({ trans: null }); }, 280);
        }
        self.blinkLoop();
      }, 4200 + Math.random() * 1600);
    },
    setGaze: function (dx, dy) {
      if (!this.rv) return;
      var rv = this.rv;
      ['rivo-idle', 'rivo-talk'].forEach(function (id) {
        var g = rv.querySelector('#' + id + ' .rv-glance');
        var p = g && g.parentNode;
        if (!p) return;
        if (dx || dy) p.setAttribute('transform', 'translate(' + dx.toFixed(2) + ' ' + dy.toFixed(2) + ')');
        else p.removeAttribute('transform');
      });
    },
    gazeAt: function (el) {
      var b = $('rivoBox');
      if (!b || !el) return;
      var r = b.getBoundingClientRect();
      var t = el.getBoundingClientRect();
      var vx = t.left + t.width / 2 - (r.left + r.width / 2);
      var vy = t.top + t.height / 2 - (r.top + r.height / 2);
      var L = Math.hypot(vx, vy) || 1;
      this.setGaze(vx / L * 4, vy / L * 3.5);
    },
    say: function (text, o) {
      o = o || {};
      var self = this;
      clearTimeout(this.sayT); clearTimeout(this.talkT); clearTimeout(this.attnT);
      var patch = { typing: true };
      if (o.mood) patch.mood = o.mood;
      if (o.attn) patch.attn = true;
      this.setState(patch);
      this.sayT = setTimeout(function () {
        if (self.drift) { try { self.drift.currentTime = 0; self.drift.play(); } catch (e) {} }
        self.setState(function (s) {
          return { typing: false, msg: text, msgId: s.msgId + 1, trans: s.mood === 'idle' ? 'talk' : s.trans };
        });
        self.talkT = setTimeout(function () { if (self.state.trans === 'talk') self.setState({ trans: null }); }, 1600);
        if (o.attn) self.attnT = setTimeout(function () { self.setState({ attn: false }); }, 1800);
      }, 380);
    },
    /** Register an element the mascot may walk to and point at. */
    registerTarget: function (key, el) { this._pointEls[key] = el; },
    targetEl: function (t) {
      if (t === 'hint') return this.q('[data-hintbtn]');
      if (t === 'next') return $('next');
      if (t === 'scene') return $('sceneSvg');
      if (t === 'bonus') return $('bonus');
      return this._pointEls[t] || null;
    },
    point: function (t, text) {
      var self = this;
      clearTimeout(this.homeT);
      this.setState({ target: t });
      this.say(text, { attn: true, mood: 'think' });
      this.later(function () { self.gazeAt(self.targetEl(t)); }, 900);
      this.homeT = setTimeout(function () {
        self.goHome();
        self.setState({ mood: 'idle' });
        self.setGaze(0, 0);
      }, 7000);
    },
    goHome: function () {
      clearTimeout(this.homeT);
      if (this.state.target !== 'home') this.setState({ target: 'home' });
    },

    /* ---------- bubble placement ---------- */
    place: function (anim) {
      if (this._placing) return;
      var card = $('card'), u = $('float'), bb = $('bubble');
      if (!card || !u || !bb) return;
      var c = card.getBoundingClientRect();
      var tg = this.state.target;
      var el = tg === 'home' ? null : this.targetEl(tg);
      if (el && !el.getBoundingClientRect().width) el = null;
      var x, y, below = false;
      if (!el) {
        var s = $('home');
        if (!s) return;
        var r0 = s.getBoundingClientRect();
        if (r0.width < 160) return;
        bb.style.maxWidth = Math.max(140, Math.min(340, r0.width - 88)) + 'px';
        var uw0 = bb.offsetWidth + 88, uh0 = Math.max(bb.offsetHeight, 78);
        var need = uh0 + 24;
        if (Math.abs(s.offsetHeight - need) > 1) s.style.height = need + 'px';
        var r = s.getBoundingClientRect();
        x = r.right - c.left - uw0;
        y = r.bottom - c.top - uh0 - 4;
      } else {
        var t = el.getBoundingClientRect();
        var pw = 30;
        var avail = t.left - c.left - 6 - 88 - pw - 4;
        if (avail >= 150) {
          bb.style.maxWidth = Math.min(250, avail) + 'px';
          var uw1 = bb.offsetWidth + 88 + pw, uh1 = Math.max(bb.offsetHeight, 78);
          x = t.left - c.left - uw1 - 2;
          y = t.top - c.top + t.height / 2 - uh1 / 2;
        } else {
          below = true;
          bb.style.maxWidth = Math.max(140, Math.min(250, c.width - 12 - 88 - pw)) + 'px';
          var uw2 = bb.offsetWidth + 88 + pw;
          x = t.left + t.width / 2 - c.left - (uw2 - pw / 2);
          y = t.bottom - c.top + 2;
        }
        var uw = bb.offsetWidth + 88 + pw, uh = Math.max(bb.offsetHeight, 78);
        x = Math.max(6, Math.min(c.width - uw - 6, x));
        y = Math.max(6, Math.min(c.height - uh - 6, y));
      }
      var fit = this.fitFloat(x, y, c);
      if (!fit.clear) {
        var wide = bb.style.maxWidth;
        bb.style.maxWidth = '168px';
        var tight = this.fitFloat(x, y, c);
        if (tight.clear) fit = tight; else bb.style.maxWidth = wide;
      }
      x = fit.x; y = fit.y;
      if (fit.above) below = false; else if (fit.below) below = true;
      if (below !== this.state.below || !!fit.above !== !!this.state.above) {
        this._placing = true;
        this.setState({ below: below, above: !!fit.above });
        this._placing = false;
      }
      var first = this.px == null;
      var dx = first ? 0 : x - this.px;
      var dy = first ? 0 : y - this.py;
      if (!first && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      u.style.transition = (!anim || first) ? 'none' : '';
      u.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (u.style.transition === 'none') { void u.offsetWidth; u.style.transition = ''; }
      if (anim && !first && Math.hypot(dx, dy) > 40) {
        var self = this;
        this.an($('tilt'), [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(' + (dx > 0 ? 9 : -9) + 'deg) translateY(-14px)', offset: 0.35 },
          { transform: 'rotate(0deg)' }
        ], { duration: 850, easing: 'ease-in-out' });
        this.later(function () {
          self.an($('rivoHost'), [
            { transform: 'scale(1)' }, { transform: 'scale(1.12,.88)' },
            { transform: 'scale(.96,1.04)' }, { transform: 'scale(1)' }
          ], { duration: 360, easing: 'ease-out' });
        }, 780);
      }
      this.px = x; this.py = y;
    },
    shown: function (el) {
      for (var n = el; n && n !== document.body; n = n.parentElement) {
        if (n.hidden) return false;
        var s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
      }
      var r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    },
    blockedRects: function () {
      var out = [];
      var self = this;
      var add = function (el) { if (el && self.shown(el)) out.push(el.getBoundingClientRect()); };
      ['hintBox', 'title', 'sub', 'next', 'cue', 'fb', 'stepLabel', 'scoreChip', 'soundBtn',
        'sceneSvg', 'sceneRow', 'sceneCap', 'sceneNote', 'sceneExtra', 'panelIntro', 'bonus'
      ].forEach(function (id) { add($(id)); });
      add($('app').querySelector('.track'));
      add($('app').querySelector('.head'));
      $('app').querySelectorAll('#opts .opt').forEach(add);
      $('app').querySelectorAll('#sceneRow button').forEach(add);
      return out;
    },
    floatHits: function (x, y, fw, fh, c, blocks) {
      var L = c.left + x - 4, T = c.top + y - 20, R = c.left + x + fw + 4, B = c.top + y + fh + 4;
      return blocks.some(function (r) {
        var ox = Math.min(R, r.right) - Math.max(L, r.left);
        var oy = Math.min(B, r.bottom) - Math.max(T, r.top);
        return ox > 2 && oy > 2;
      });
    },
    fitFloat: function (x, y, c) {
      var u = $('float');
      if (!u) return { x: x, y: y, above: false, below: false, clear: true };
      var blocks = this.blockedRects();
      var fw = u.offsetWidth || 160, fh = u.offsetHeight || 78;
      var svgNode = $('sceneSvg');
      var svg = svgNode && this.shown(svgNode) ? svgNode.getBoundingClientRect() : null;
      var clamp = function (px, py) {
        return {
          x: Math.max(6, Math.min(c.width - fw - 6, px)),
          y: Math.max(10, Math.min(c.height - fh - 6, py))
        };
      };
      var pose = function (px, py) {
        var above = !!(svg && c.top + py + fh <= svg.top - 4);
        var below = !!(svg && !above && c.top + py >= svg.bottom - 4);
        return { x: px, y: py, above: above, below: below, clear: true };
      };
      var self = this;
      var ok = function (px, py) {
        return px >= 6 && py >= 10 && px + fw <= c.width - 6 && py + fh <= c.height - 6
          && !self.floatHits(px, py, fw, fh, c, blocks);
      };
      if (ok(x, y)) return pose(x, y);
      var spots = [];
      if (svg && svg.width > 20) {
        var top = svg.top - c.top - fh - 12;
        spots.push({ x: svg.right - c.left - fw, y: top });
        spots.push({ x: svg.left - c.left + (svg.width - fw) / 2, y: top });
        spots.push({ x: svg.left - c.left, y: top });
      }
      var home = $('home');
      if (home) {
        var hr = home.getBoundingClientRect();
        if (hr.width > 80 && hr.height > 40) {
          var hx = hr.right - c.left - fw;
          var hy = hr.bottom - c.top - fh - 4;
          for (var d = 0; d <= 30; d += 6) spots.push({ x: hx, y: hy - d });
        }
      }
      for (var y2 = y - 12; y2 >= 10; y2 -= 12) spots.push({ x: x, y: y2 });
      for (var xa = x - 16; xa >= 6; xa -= 16) spots.push({ x: xa, y: y });
      for (var xb = x + 16; xb + fw <= c.width - 6; xb += 16) spots.push({ x: xb, y: y });
      for (var i = 0; i < spots.length; i++) {
        var p = clamp(spots[i].x, spots[i].y);
        if (Math.abs(p.x - spots[i].x) > 28 || Math.abs(p.y - spots[i].y) > 24) continue;
        if (ok(p.x, p.y)) return pose(p.x, p.y);
      }
      var fb = clamp(x, Math.max(10, y - 24));
      return { x: fb.x, y: fb.y, above: false, below: false, clear: false };
    },

    /* ---------- celebration and sound ---------- */
    burst: function (n, big) {
      var L = $('conf');
      if (!L) return;
      var cols = ['#4338ca', '#f59e0b', '#1d7a46', '#e11d63', '#8a7ff0', '#2dd4bf'];
      var W = L.clientWidth || 300, H = L.clientHeight || 200;
      for (var k = 0; k < n; k++) {
        var d = document.createElement('div');
        var x = big ? Math.random() * W : W * (0.4 + Math.random() * 0.4);
        var y = big ? -12 : H * 0.2;
        d.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:8px;height:8px;border-radius:2px;background:'
          + cols[k % cols.length] + ';will-change:transform,opacity';
        L.appendChild(d);
        var dy = big ? 120 + Math.random() * 500 : 180 + Math.random() * 120;
        var dx = (Math.random() * 2 - 1) * (big ? 120 : 80);
        var rot = (Math.random() * 2 - 1) * (big ? 720 : 360);
        var dur = big ? 1100 + Math.random() * 2000 : 900 + Math.random() * 500;
        var delay = big ? Math.random() * 250 : 0;
        var an = d.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 0 }
        ], { duration: dur, delay: delay, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
        (function (node) { an.onfinish = function () { node.remove(); }; }(d));
        this.anims.push(an);
      }
    },
    sfx: function (k) {
      if (!this.state.sound) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        var c = this.ac || (this.ac = new AC());
        if (c.state === 'suspended') c.resume();
        var tone = function (type, f1, f2, dur, t0, v) {
          t0 = t0 || 0; v = v || 0.12;
          var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
          o.type = type;
          o.frequency.setValueAtTime(f1, t);
          if (f2) o.frequency.linearRampToValueAtTime(f2, t + dur);
          g.gain.setValueAtTime(v, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + dur + 0.02);
        };
        if (k === 'click') tone('sine', 440, 0, 0.08, 0, 0.07);
        else if (k === 'tick') tone('sine', 700, 0, 0.04, 0, 0.03);
        else if (k === 'correct') tone('triangle', 659, 880, 0.35);
        else if (k === 'error') tone('sawtooth', 220, 196, 0.25, 0, 0.05);
        else if (k === 'win') [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone('triangle', f, 0, 0.24, i * 0.11, 0.1); });
      } catch (e) {}
    },
    floatPts: function (el, pts) {
      var L = $('conf'), c = $('card');
      if (!L || !el || !c) return;
      var r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
      var d = document.createElement('div');
      d.setAttribute('data-cf', '');
      d.textContent = '+' + pts;
      d.dir = 'ltr';
      d.style.cssText = 'position:absolute;left:' + (r.left - cr.left + r.width / 2) + 'px;top:'
        + (r.top - cr.top - 6) + 'px;transform:translate(-50%,0);font-family:"Secular One",sans-serif;'
        + 'font-size:26px;color:#1d7a46;text-shadow:0 2px 0 #fff;pointer-events:none';
      L.appendChild(d);
      var an = d.animate([
        { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-64px) scale(1)', opacity: 0 }
      ], { duration: 1200, easing: 'cubic-bezier(.2,.7,.4,1)' });
      an.onfinish = function () { d.remove(); };
      this.anims.push(an);
    },

    /* ---------- score and report ---------- */
    maxScore: function () { return this.skills.length * POINTS_PER_QUIZ; },
    report: function () {
      var res = this.state.res || {};
      var total = 0;
      Object.keys(res).forEach(function (k) { total += res[k].pts || 0; });
      var steps = this.steps;
      var rows = this.skills.map(function (k) {
        var r = res[k.step];
        var pts = r ? r.pts : 0;
        var lv = !r ? 'none' : (r.tries === 1 && r.hints === 0) ? 'strong' : r.tries <= 2 ? 'ok' : 'weak';
        var B = {
          strong: ['חזק', '#e9f9ef', '#1d7a46', '#9fd8b4'],
          ok: ['בסדר', '#fdf6e5', '#92580a', '#e3b268'],
          weak: ['כדאי לחזק', '#fdeee4', '#b45309', '#f0b48f'],
          none: ['לא נענה', '#eef0fb', '#6b6a8a', '#cfcdea']
        }[lv];
        var barC = { strong: '#1d7a46', ok: '#f59e0b', weak: '#e11d63', none: '#cfcdea' }[lv];
        var barPct = { strong: 100, ok: 65, weak: 35, none: 0 }[lv];
        var S = steps[k.step];
        var w = r ? r.wrong : [];
        var detail = r
          ? (r.tries === 1 ? 'ניסיון ראשון' : r.tries + ' ניסיונות') + ' · '
            + (r.hints === 0 ? 'בלי רמז' : r.hints === 1 ? 'רמז אחד' : r.hints + ' רמזים')
          : 'לא נענה';
        return {
          step: k.step, name: k.name, math: k.math || '', lv: lv, pts: pts,
          badge: B[0], badgeBg: B[1], badgeFg: B[2], badgeBd: B[3], barC: barC, barPct: barPct,
          detail: detail,
          hasWrong: w.length > 0,
          wrongText: w.length ? 'בחרת ' + m(S.opts[w[0]].t) + ' — ' + S.opts[w[0]].f : '',
          canRetry: !!r && lv !== 'strong'
        };
      });
      var max = this.maxScore();
      return {
        rows: rows, total: total,
        stars: total >= max * 0.9 ? 3 : total >= max * 0.6 ? 2 : total > 0 ? 1 : 0
      };
    },
    finishTip: function () {
      var last = this.steps[this.steps.length - 1];
      var weak = this.report().rows.filter(function (r) { return r.lv === 'ok' || r.lv === 'weak'; })
        .sort(function (a, b) { return a.barPct - b.barPct; });
      if (!weak.length) return last.tip;
      return 'יפה! הנקודה לחיזוק: ' + weak[0].name + '. לחץ "תרגל שוב".';
    },

    /* ---------- step flow ---------- */
    goStep: function (i) {
      this.teardownScene();
      this.clearAll();
      this._enter = true;
      this.wrongN = 0;
      this.setGaze(0, 0);
      this.px = null;
      var S = this.steps[i];
      var patch = {
        idx: i, done: false, wrong: [], hint: 0, fb: null, mood: 'idle', trans: null,
        attn: false, typing: false, msg: '', target: 'home', ord: null,
        scene: {}, sceneReady: false, busy: false, dragging: false
      };
      if (S.mode === 'quiz') patch.ord = shuffle(S.opts.map(function (_, k) { return k; }));
      if (i === 0) { patch.res = {}; patch.retry = false; }
      this.setState(patch);
      /* A quiz may carry a drawing too, so the question keeps its picture. */
      if (typeof S.setup === 'function') this.setupScene(S); else this._ctx = null;
    },
    canNext: function () {
      var S = this.steps[this.state.idx];
      if (S.mode === 'quiz') return this.state.done;
      if (S.mode === 'scene') return S.needDone === false ? true : this.state.sceneReady;
      return true;
    },
    next: function () {
      if (!this.canNext()) {
        this.an($('cue'), [
          { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }
        ], { duration: 320 });
        return;
      }
      this.sfx('click');
      var S = this.steps[this.state.idx];
      if (S.mode === 'finish') { this.goStep(0); return; }
      if (this.state.retry && S.mode === 'quiz') { this.goStep(this.steps.length - 1); return; }
      this.goStep(this.state.idx + 1);
    },
    pick: function (origI) {
      var st = this.state;
      var S = this.steps[st.idx];
      if (st.done || st.wrong.indexOf(origI) >= 0) return;
      var o = S.opts[origI];
      var btn = $('opt' + origI);
      var self = this;
      this.armNudge();
      this.goHome();
      if (o.c) {
        clearTimeout(this.nudgeT);
        var tries = this.wrongN + 1;
        var rec = { tries: tries, hints: st.hint, pts: POINTS_PER_QUIZ, wrong: st.wrong.slice() };
        var prev = st.res[st.idx];
        var res = Object.assign({}, st.res);
        res[st.idx] = prev || rec;
        this.setState({ done: true, fb: { ok: true, text: o.f }, mood: 'happy', res: res });
        this.sfx('correct');
        this.burst(18);
        this.floatPts(btn, POINTS_PER_QUIZ);
        this.an(btn, [
          { transform: 'scale(1)' }, { transform: 'scale(1.08)' },
          { transform: 'scale(.97)' }, { transform: 'scale(1)' }
        ], { duration: 400, easing: 'ease-out' });
        this.later(function () {
          self.an($('next'), [
            { transform: 'scale(.95)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }
          ], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }, 60);
        this.say(S.win, { attn: true });
      } else {
        this.wrongN++;
        this.setState(function (s) { return { wrong: s.wrong.concat(origI), fb: { ok: false, text: o.f }, mood: 'think' }; });
        this.sfx('error');
        this.an(btn, [
          { transform: 'translateX(0)' }, { transform: 'translateX(-7px)' },
          { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }
        ], { duration: 400 });
        this.say(S.wrongSay);
        var maxHints = (S.hints || []).length;
        if (this.wrongN >= 2 && this.state.hint < maxHints) {
          this.later(function () {
            if (!self.state.done && self.state.hint < maxHints) self.point('hint', 'אולי אתה רוצה רמז?');
          }, 4200);
        }
      }
    },
    hint: function () {
      var st = this.state;
      var S = this.steps[st.idx];
      var maxHints = (S.hints || []).length;
      if (st.done || !maxHints) return;
      this.sfx('click');
      this.armNudge();
      this.goHome();
      this.setGaze(0, 0);
      this.setState({ hint: Math.min(maxHints, st.hint + 1), mood: 'think' });
      this.say('הנה כיוון. את התשובה תמצא לבד.');
    },
    retry: function (i) { this.sfx('click'); this.goStep(i); this.setState({ retry: true }); },

    /* ---------- scenes ---------- */
    teardownScene: function () {
      if (this._sceneTeardown) {
        try { this._sceneTeardown(); } catch (e) {}
        this._sceneTeardown = null;
      }
      this._pointEls = {};
      var row = $('sceneRow');
      if (row) row.innerHTML = '';
      var extra = $('sceneExtra');
      if (extra) { extra.innerHTML = ''; extra.hidden = true; }
      var svg = $('sceneSvg');
      if (svg) { svg.innerHTML = ''; svg.removeAttribute('aria-label'); }
      var cap = $('sceneCap');
      if (cap) { cap.innerHTML = ''; cap.hidden = true; }
      var note = $('sceneNote');
      if (note) { note.innerHTML = ''; note.hidden = true; note.removeAttribute('data-tone'); }
    },
    sceneContext: function (S) {
      var self = this;
      var svg = $('sceneSvg');
      return {
        svg: svg,
        frame: $('sceneFrame'),
        step: S,
        /** Per-scene scratch state; set() repaints the shell. */
        get: function (k) { return self.state.scene[k]; },
        set: function (patch) {
          self.setState(function (s) { return { scene: Object.assign({}, s.scene, patch) }; });
        },
        /** Mark the step solved so "next" unlocks. */
        solved: function () {
          if (self.state.sceneReady) return;
          self.setState({ sceneReady: true });
        },
        isActive: function () { return self.steps[self.state.idx] === S; },
        /** Replace the scene drawing. */
        draw: function (html) { svg.innerHTML = html; },
        el: function (id) { return svg.querySelector('#' + id) || $(id); },
        /** A control button under the drawing. */
        button: function (label, onClick, opts) {
          opts = opts || {};
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          if (opts.ghost) b.setAttribute('data-ghost', '');
          if (opts.id) b.id = opts.id;
          b.addEventListener('click', function () { onClick(b); });
          $('sceneRow').appendChild(b);
          if (opts.target) self.registerTarget(opts.target, b);
          return b;
        },
        /** Arbitrary markup between the drawing and the buttons. */
        extra: function (html) {
          var box = $('sceneExtra');
          box.innerHTML = html;
          box.hidden = !html;
          return box;
        },
        caption: function (text) {
          var cap = $('sceneCap');
          if (!text) { cap.hidden = true; return; }
          cap.hidden = false;
          fillRich(cap, text);
          self.fitBox(cap);
        },
        note: function (text, tone) {
          var n = $('sceneNote');
          if (!text) { n.hidden = true; return; }
          n.hidden = false;
          if (tone) n.setAttribute('data-tone', tone); else n.removeAttribute('data-tone');
          n.innerHTML = richHtml(text);
        },
        say: function (t, o) { self.say(t, o); },
        point: function (t, text) { self.point(t, text); },
        register: function (key, el) { self.registerTarget(key, el); },
        sfx: function (k) { self.sfx(k); },
        burst: function (n, big) { self.burst(n, big); },
        floatPts: function (el, pts) { self.floatPts(el, pts); },
        tween: function (ms, fn) { return self.tween(ms, fn); },
        wait: function (ms) { return self.wait(ms); },
        later: function (fn, ms) { return self.later(fn, ms); },
        an: function (el, k, o) { return self.an(el, k, o); },
        busy: function (on) { self.setState({ busy: !!on }); },
        dragging: function (on) { self.setState({ dragging: !!on }); },
        onTeardown: function (fn) { self._sceneTeardown = fn; },
        m: m,
        /** Pointer drag on an SVG element, reported in viewBox units. */
        drag: function (el, handlers) {
          var active = false;
          // Chrome ignores touch-action on SVG shapes; without it on the root a
          // touch drag is cancelled as a page scroll after a few moves.
          svg.style.touchAction = 'none';
          var move = function (ev) {
            if (!active) return;
            ev.preventDefault();
            var pt = self.svgPoint(svg, ev);
            if (handlers.move) handlers.move(pt.x, pt.y);
          };
          var up = function () {
            if (!active) return;
            active = false;
            self.setState({ dragging: false });
            self.setGaze(0, 0);
            self.armNudge();
            if (handlers.end) handlers.end();
          };
          var down = function (ev) {
            ev.preventDefault();
            active = true;
            self.setState({ dragging: true });
            self.armNudge();
            self.goHome();
            var pt = self.svgPoint(svg, ev);
            if (handlers.start) handlers.start(pt.x, pt.y);
          };
          el.addEventListener('pointerdown', down);
          window.addEventListener('pointermove', move, { passive: false });
          window.addEventListener('pointerup', up);
          window.addEventListener('pointercancel', up);
          var prevTeardown = self._sceneTeardown;
          self._sceneTeardown = function () {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            svg.style.touchAction = '';
            if (prevTeardown) prevTeardown();
          };
        }
      };
    },
    svgPoint: function (svg, ev) {
      var mt = svg.getScreenCTM();
      if (!mt) return { x: 0, y: 0 };
      var inv = mt.inverse();
      var X = ev.clientX, Y = ev.clientY;
      return { x: inv.a * X + inv.c * Y + inv.e, y: inv.b * X + inv.d * Y + inv.f };
    },
    setupScene: function (S) {
      var svg = $('sceneSvg');
      var w = S.aspect ? S.aspect[0] : 402;
      var h = S.aspect ? S.aspect[1] : 330;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      if (S.alt) svg.setAttribute('aria-label', S.alt);
      $('sceneFrame').style.aspectRatio = String(w) + ' ' + String('/') + ' ' + String(h);
      var ctx = this.sceneContext(S);
      this._ctx = ctx;
      try { S.setup(ctx); } catch (e) { if (window.console) window.console.error(e); }
      this.paint();
    },

    /* ---------- painting ---------- */
    show: function (el, on) { if (el) el.hidden = !on; },
    paint: function () {
      var st = this.state;
      var S = this.steps[st.idx];
      var md = S.mode;
      var isQuiz = md === 'quiz';
      var total = this.steps.length;
      $('card').setAttribute('data-screen-label', String(st.idx + 1).padStart(2, '0') + ' ' + md);
      $('stepLabel').textContent = 'שלב ' + (st.idx + 1) + ' מתוך ' + total;
      $('scoreTotal').textContent = String(this.report().total);
      $('progressFill').style.width = ((st.idx + 1) / total * 100) + '%';
      $('soundBtn').textContent = st.sound ? '🔊' : '🔇';
      $('soundBtn').setAttribute('aria-label', st.sound ? 'השתק צלילים' : 'הפעל צלילים');
      this.show($('panelIntro'), md === 'intro');
      this.show($('panelScene'), md === 'scene' || (isQuiz && typeof S.setup === 'function'));
      this.show($('panelFinish'), md === 'finish');
      this.show($('quiz'), isQuiz);
      if (md === 'intro') this.paintIntro(S);
      var title = $('title');
      title.textContent = '';
      title.append(document.createTextNode(S.tA || ''));
      if (S.tM) title.append(mathNode(S.tM + (S.tB || '')));
      else if (S.tB) title.append(document.createTextNode(S.tB));
      fillRich($('sub'), S.sub || '');
      var ready = this.canNext();
      var cue = S.cue || '';
      if (isQuiz) cue = st.done ? 'תשובה נכונה — אפשר להמשיך ←' : 'בחר תשובה נכונה כדי להמשיך';
      else if (md === 'scene') cue = ready ? (S.cueDone || cue) : cue;
      $('cue').textContent = cue;
      $('cue').style.background = ready ? '#e9f9ef' : '#fdf6e5';
      $('cue').style.border = ready ? '1.5px solid #9fd8b4' : '1.5px dashed #e3b268';
      $('cue').style.color = ready ? '#1d7a46' : '#92580a';
      var btn = $('next');
      btn.textContent = st.retry && isQuiz ? 'חזרה לסיכום ←' : S.btn;
      btn.setAttribute('aria-disabled', String(!ready));
      btn.style.background = ready ? 'var(--main)' : '#cfcdea';
      btn.style.color = ready ? '#fff' : '#6b6a8a';
      btn.style.boxShadow = ready ? '0 6px 16px rgba(67,56,202,.3)' : 'none';
      btn.style.cursor = ready ? 'pointer' : 'not-allowed';
      var fb = $('fb');
      if (st.fb) {
        fb.hidden = false;
        var text = String(st.fb.text);
        var prefix = st.fb.ok ? (text.indexOf('נכון') === 0 || text.indexOf('בדיוק') === 0 ? '' : 'נכון! ') : 'נסה שוב: ';
        fillRich(fb, prefix + text);
        fb.style.background = st.fb.ok ? '#e9f9ef' : '#fde8ec';
        fb.style.border = st.fb.ok ? '1.5px solid #9fd8b4' : '1.5px solid #f3a8b8';
        fb.style.color = st.fb.ok ? '#1d7a46' : '#c2234b';
      } else fb.hidden = true;
      this.paintQuiz(S, st, st.done);
      if (S.paint && this._ctx) {
        try { S.paint(this._ctx); } catch (e) { if (window.console) window.console.error(e); }
      }
      if (md === 'finish') this.paintFinish(S);
      this.paintBubble();
      this.fitMath();
    },
    paintIntro: function (S) {
      $('heroEmoji').textContent = S.emoji || '🧩';
      fillRich($('heroEq'), S.eq || '');
      var art = $('heroArt');
      if (S.art) { art.hidden = false; art.innerHTML = S.art; } else { art.hidden = true; art.innerHTML = ''; }
      $('heroNote').innerHTML = richHtml(S.note || '');
    },
    paintQuiz: function (S, st, done) {
      var box = $('opts');
      if (S.mode !== 'quiz' || !S.opts) { box.innerHTML = ''; delete box.dataset.stamp; return; }
      var ord = st.ord || S.opts.map(function (_, k) { return k; });
      var stamp = String(st.idx) + ':' + ord.join('');
      var self = this;
      if (box.dataset.stamp !== stamp) {
        box.dataset.stamp = stamp;
        box.innerHTML = '';
        ord.forEach(function (origI) {
          var b = document.createElement('button');
          var label = S.opts[origI].t;
          b.type = 'button';
          b.className = 'opt' + (hebrew(label) ? ' heb' : '');
          b.id = 'opt' + origI;
          b.dir = hebrew(label) ? 'rtl' : 'ltr';
          b.addEventListener('click', function () { self.pick(origI); });
          box.append(b);
        });
      }
      ord.forEach(function (origI) {
        var o = S.opts[origI];
        var b = $('opt' + origI);
        var isW = st.wrong.indexOf(origI) >= 0;
        var isC = done && o.c;
        var locked = done && !o.c && !isW;
        fillRich(b, o.t);
        b.disabled = done || isW;
        b.setAttribute('aria-disabled', String(done || isW));
        b.style.opacity = isW ? '.85' : '1';
        if (isC) { b.style.background = '#e9f9ef'; b.style.borderColor = '#1d7a46'; b.style.color = '#1d7a46'; b.style.boxShadow = '0 2px 0 #1d7a46'; }
        else if (isW) { b.style.background = '#fde8ec'; b.style.borderColor = '#e11d63'; b.style.color = '#e11d63'; b.style.boxShadow = 'none'; }
        else if (locked) { b.style.background = '#eef0fb'; b.style.borderColor = '#cfcdea'; b.style.color = '#6b6a8a'; b.style.boxShadow = 'none'; }
        else { b.style.background = '#fff'; b.style.borderColor = 'var(--panel-line)'; b.style.color = 'var(--ink)'; b.style.boxShadow = '0 2px 0 var(--panel-line)'; }
      });
      var hb = $('hintBtn');
      var hasHints = (S.hints || []).length > 0;
      hb.hidden = !hasHints;
      hb.disabled = done;
      hb.setAttribute('aria-disabled', String(done));
      hb.style.background = done ? '#cfcdea' : 'var(--warm)';
      hb.style.color = done ? '#6b6a8a' : 'var(--ink)';
      hb.style.borderColor = done ? '#cfcdea' : 'var(--warm-dark)';
      hb.style.boxShadow = done ? 'none' : '0 3px 0 var(--warm-dark)';
      var boxH = $('hintBox');
      if (st.hint > 0 && hasHints) {
        boxH.hidden = false;
        fillRich(boxH, '💡 ' + S.hints[Math.min(st.hint, S.hints.length) - 1]);
      } else boxH.hidden = true;
    },
    paintFinish: function (S) {
      var R = this.report();
      var self = this;
      if (!this.counting) $('scoreBig').textContent = String(R.total);
      $('scoreMax').textContent = ' ' + String('/') + ' ' + this.maxScore();
      var stars = $('stars');
      if (stars.childElementCount !== 3) stars.innerHTML = '<span data-star>★</span><span data-star>★</span><span data-star>★</span>';
      [].slice.call(stars.children).forEach(function (el, k) {
        el.style.fontSize = '30px';
        el.style.color = k < R.stars ? '#f59e0b' : '#cfcdea';
      });
      var strong = R.rows.filter(function (r) { return r.lv === 'strong'; }).map(function (r) { return r.name; });
      var weak = R.rows.filter(function (r) { return r.lv !== 'strong'; }).map(function (r) { return r.name; });
      $('strongText').textContent = strong.join(' · ') || 'עוד לא. נסה שוב!';
      $('weakText').textContent = weak.join(' · ') || 'אין. הכול חזק!';
      $('finalLead').textContent = S.finalLead || 'מה שלמדת:';
      $('finalEq').innerHTML = richHtml(S.formula || '');
      var wrap = $('skillRows');
      wrap.innerHTML = R.rows.map(function (r) {
        return '<div class="skill" data-row>'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">'
          + '<div style="font-weight:800;font-size:14.5px"><span>' + escHtml(r.name) + '</span>'
          + (r.math ? ' <bdi class="math" dir="ltr" style="font-family:Secular One,sans-serif;font-weight:400;color:var(--main)">' + escHtml(r.math) + '</bdi>' : '')
          + '</div>'
          + '<div style="font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;background:' + r.badgeBg
          + ';color:' + r.badgeFg + ';border:1.5px solid ' + r.badgeBd + ';white-space:nowrap">' + r.badge + '</div></div>'
          + '<div class="bar"><i data-bar style="width:' + r.barPct + '%;background:' + r.barC + '"></i></div>'
          + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">'
          + '<div style="font-size:12.5px;color:#6b6a8a">' + r.detail + '</div>'
          + '<bdi class="math" dir="ltr" style="font-family:Secular One,sans-serif;font-size:14px">'
          + r.pts + ' ' + String('/') + ' ' + POINTS_PER_QUIZ + '</bdi></div>'
          + (r.hasWrong ? '<div style="font-size:12.5px;line-height:1.5;color:#c2234b">' + richHtml(r.wrongText) + '</div>' : '')
          + (r.canRetry ? '<button type="button" class="retry" data-retry="' + r.step + '">תרגל שוב ↻</button>' : '')
          + '</div>';
      }).join('');
      wrap.querySelectorAll('[data-retry]').forEach(function (b) {
        b.addEventListener('click', function () { self.retry(Number(b.getAttribute('data-retry'))); });
      });
      this.paintBonus(S);
    },
    paintBonus: function (S) {
      var bonus = this.spec.bonus;
      var toggle = $('bonusToggle');
      var box = $('bonus');
      if (!bonus) { toggle.hidden = true; box.hidden = true; return; }
      toggle.hidden = false;
      if (!this._bonusBuilt) {
        this._bonusBuilt = true;
        toggle.textContent = bonus.label;
        var self = this;
        toggle.addEventListener('click', function () {
          self.sfx('click');
          box.hidden = !box.hidden;
          toggle.textContent = box.hidden ? bonus.label : bonus.closeLabel || 'סגור';
          if (!box.hidden) self.later(function () { self.point('bonus', bonus.hint || 'נסה את הבונוס!'); }, 300);
        });
        try { bonus.setup(box, this.sceneContext(S)); } catch (e) { if (window.console) window.console.error(e); }
      }
    },
    fitBox: function (el) {
      if (!el || el.clientWidth < 8) return;
      el.style.fontSize = '';
      var cs = getComputedStyle(el);
      var max = parseFloat(cs.fontSize);
      var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      var avail = el.clientWidth - pad;
      if (!(max > 0) || avail < 8) return;
      var range = document.createRange();
      range.selectNodeContents(el);
      var need = Math.max(range.getBoundingClientRect().width, el.scrollWidth - pad);
      if (need > avail + 1) el.style.fontSize = Math.max(12, max * avail / need) + 'px';
    },
    fitMath: function () {
      var self = this;
      ['heroEq', 'finalEq', 'sceneCap'].forEach(function (id) { self.fitBox($(id)); });
      var root = $('app');
      if (!root) return;
      root.querySelectorAll('.opt').forEach(function (el) { self.fitBox(el); });
      root.querySelectorAll('[data-fit]').forEach(function (el) { self.fitBox(el); });
      var title = $('title');
      var tm = title && title.querySelector('.math');
      if (tm && title.clientWidth > 8) {
        tm.style.fontSize = '';
        var max = parseFloat(getComputedStyle(title).fontSize);
        if (tm.scrollWidth > title.clientWidth + 1) {
          tm.style.fontSize = Math.max(12, max * title.clientWidth / tm.scrollWidth) + 'px';
        }
      }
    },
    paintBubble: function () {
      var st = this.state;
      var name = this.props.bubbleShape === 'cycle' ? SHAPE_CYCLE[st.idx % SHAPE_CYCLE.length] : this.props.bubbleShape;
      var longMsg = toLines(st.msg, 1).length > 8;
      var SH = (longMsg && (name === 'triangle' || name === 'rhombus')) ? SHAPES.cloud : (SHAPES[name] || SHAPES.cloud);
      $('shapePath').setAttribute('d', SH.d);
      var bubble = $('bubble');
      bubble.style.padding = SH.pad;
      bubble.style.minWidth = SH.min + 'px';
      $('shape').style.filter = st.attn
        ? 'drop-shadow(0 0 6px rgba(138,127,240,.55)) drop-shadow(0 8px 14px rgba(67,56,202,.2))'
        : 'drop-shadow(0 6px 10px rgba(67,56,202,.14))';
      $('rivoBox').style.transform = st.attn ? 'scale(1.16) translateY(-3px)' : 'scale(1)';
      var ptr = $('pointer');
      var home = st.target === 'home';
      ptr.style.width = home ? '0px' : '30px';
      ptr.style.opacity = home ? '0' : '1';
      ptr.style.marginInlineStart = home ? '-8px' : '0px';
      ptr.style.transform = st.above ? 'rotate(90deg)' : (st.below ? 'rotate(-90deg)' : 'none');
      var box = $('bubbleText');
      if (st.typing) box.innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
      else {
        box.innerHTML = '';
        var wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        toLines(st.msg, this.props.wordsPerLine).forEach(function (ln) {
          var d = document.createElement('div');
          d.style.whiteSpace = 'nowrap';
          fillRich(d, ln);
          wrap.append(d);
        });
        box.append(wrap);
      }
    },
    afterPaint: function (prev) {
      if (this._enter) { this._enter = false; try { this.enterFx(); } catch (e) {} }
      try { this.applyRivo(); if (!this.state.dragging) this.place(true); } catch (e) {}
      if (prev && prev.target !== this.state.target && this.state.target !== 'home') {
        var rot = this.state.above ? 'rotate(90deg) ' : (this.state.below ? 'rotate(-90deg) ' : '');
        this.an($('pointer'), [
          { transform: rot + 'translateX(0)' }, { transform: rot + 'translateX(6px)' }, { transform: rot + 'translateX(0)' }
        ], { duration: 420, delay: 850, iterations: 4, easing: 'ease-in-out' });
      }
      if (prev && prev.idx !== this.state.idx) {
        this.an($('shape'), [
          { transform: 'scale(.6) rotate(-8deg)', opacity: 0.2 },
          { transform: 'scale(1.06) rotate(2deg)', opacity: 1, offset: 0.65 },
          { transform: 'scale(1) rotate(0)', opacity: 1 }
        ], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
      if (prev && prev.msgId !== this.state.msgId) {
        this.an($('bubbleText'), [
          { transform: 'scale(.85)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }
        ], { duration: 350, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    },
    enterFx: function () {
      var S = this.steps[this.state.idx];
      var root = $('app');
      var self = this;
      if (!root) return;
      this.say(S.mode === 'finish' ? this.finishTip() : S.tip, { attn: true });
      root.querySelectorAll('[data-enter]').forEach(function (el, k) {
        self.an(el, [
          { transform: 'translateX(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }
        ], { duration: 320, delay: k * 60, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'backwards' });
      });
      var svg = $('sceneSvg');
      if (svg && this.shown(svg)) {
        this.later(function () { self.gazeAt(svg); }, 50);
        this.later(function () { if (!self.state.dragging) self.setGaze(0, 0); }, 1900);
      }
      if (S.mode === 'scene' && S.enter) {
        this.later(function () { if (self.steps[self.state.idx] === S) { try { S.enter(self._ctx); } catch (e) {} } }, 500);
      }
      if (S.mode === 'finish') this.finishFx(root);
      this.armNudge();
    },
    finishFx: function (root) {
      var self = this;
      this.sfx('win');
      this.counting = true;
      this.setState({ mood: 'happy' });
      this.burst(50, true);
      var sc = $('scoreBig');
      var tot = this.report().total;
      if (sc) {
        var t0 = performance.now();
        var D = 1300;
        var tick = function (now) {
          var p = Math.min(1, (now - t0) / D);
          sc.textContent = String(Math.round(tot * (1 - Math.pow(1 - p, 3))));
          if (p < 1) self.raf = requestAnimationFrame(tick); else self.counting = false;
        };
        this.raf = requestAnimationFrame(tick);
      }
      root.querySelectorAll('[data-star]').forEach(function (s, k) {
        self.an(s, [
          { transform: 'scale(0) rotate(-40deg)', opacity: 0 },
          { transform: 'scale(1.3) rotate(10deg)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 }
        ], { duration: 500, delay: 1000 + k * 220, easing: 'ease-out', fill: 'backwards' });
      });
      root.querySelectorAll('[data-row]').forEach(function (r, k) {
        self.an(r, [
          { transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }
        ], { duration: 380, delay: 400 + k * 160, easing: 'ease-out', fill: 'backwards' });
      });
      root.querySelectorAll('[data-bar]').forEach(function (b, k) {
        self.an(b, [
          { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }
        ], { duration: 700, delay: 650 + k * 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      });
      this.an($('trophy'), [
        { transform: 'scale(.3) rotate(-25deg)', opacity: 0 },
        { transform: 'scale(1.2) rotate(8deg)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1) rotate(0)', opacity: 1 }
      ], { duration: 750, easing: 'ease-out' });
      var bonus = this.spec.bonus;
      if (bonus) {
        this.later(function () {
          if (self.steps[self.state.idx].mode !== 'finish') return;
          var box = $('bonus');
          if (box && box.hidden) {
            box.hidden = false;
            $('bonusToggle').textContent = bonus.closeLabel || 'סגור';
            self.point('bonus', bonus.hint || 'הנה הבונוס!');
          }
        }, 5200);
      }
    },
    armNudge: function (ms) {
      clearTimeout(this.nudgeT);
      var self = this;
      this.nudgeT = setTimeout(function () {
        var st = self.state;
        var S = self.steps[st.idx];
        if (S.mode === 'quiz' && !st.done) {
          if (st.hint < (S.hints || []).length) self.point('hint', 'אולי אתה רוצה רמז?');
          else self.say('חבר את מה שהרמזים אמרו. אתה קרוב.', { attn: true, mood: 'think' });
        } else if (S.mode === 'scene' && !st.sceneReady && !st.busy && S.nudge) {
          self.point(S.nudge.target || 'scene', S.nudge.text);
        }
      }, ms || this.props.idleNudgeSec * 1000);
    },

    /* ---------- boot ---------- */
    boot: function (spec) {
      this.spec = spec;
      this.steps = spec.steps;
      this.skills = spec.skills || [];
      var self = this;
      var root = $('app');
      root.setAttribute('data-lesson', spec.slug);
      root.insertAdjacentHTML('afterbegin', SHELL);
      $('bubbleName').textContent = spec.mascot || 'אליהו';
      this.mountRivo();
      $('soundBtn').addEventListener('click', function () {
        self.sfx('click');
        self.setState(function (x) { return { sound: !x.sound }; });
      });
      $('next').addEventListener('click', function () { self.next(); });
      $('hintBtn').addEventListener('click', function () { self.hint(); });
      this.blinkLoop();
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(function () {
          cancelAnimationFrame(self.roRaf);
          self.roRaf = requestAnimationFrame(function () { if (!self.state.dragging) self.place(false); });
        });
        ['card', 'bubble', 'home'].forEach(function (id) {
          var n = $(id);
          if (n) self.ro.observe(n);
        });
      }
      var refit = function () { self.fitMath(); self.place(false); };
      window.addEventListener('resize', refit);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
      this.goStep(0);
      var driftEl = $('drift');
      if (driftEl && driftEl.animate) {
        this.drift = driftEl.animate([
          { transform: 'translate(0,0) rotate(0deg)' },
          { transform: 'translate(6px,-9px) rotate(2deg)' },
          { transform: 'translate(-5px,-4px) rotate(-2deg)' },
          { transform: 'translate(0,0) rotate(0deg)' }
        ], { duration: 4200, iterations: 1, easing: 'ease-in-out' });
      }
      requestAnimationFrame(function () { self.place(false); });
      this.later(function () { self.place(false); }, 300);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { self.fitMath(); self.place(false); });
      }
    }
  };

  window.NoamGame = {
    m: m,
    shuffle: shuffle,
    ez: ez,
    palette: palette(),
    boot: function (spec) { window.__lesson = app; app.boot(spec); }
  };
}());
