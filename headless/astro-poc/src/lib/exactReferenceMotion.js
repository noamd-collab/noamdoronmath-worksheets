// Presentation animations copied from the supplied design, with a DOM adapter.
// HeroLoop, ConceptLoop and conceptLoops.ts are deliberately unchanged.
export class ExactReferenceMotion {
  rootRef = { current: document.querySelector('.exact-frame') };
  zigRef = { current: document.querySelector('[data-exact-zig]') };
  zigPath = { current: document.querySelector('[data-exact-zig-path]') };
  logoRef = { current: document.querySelector('[data-exact-logo]') };
  animations = new Map();
  listeners = [];
  keyboardImages = new WeakSet();
  tileI = 0;
  motion() {
    const h = document.documentElement;
    const mode = h.dataset.ndMotion;
    if (this.eventOff || (this.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)')).matches || h.classList.contains('nd-motion-off') || h.classList.contains('noam-a11y-motion') || mode === 'off') return 'כבוי';
    return mode === 'relaxed' || mode === 'calm' ? 'רגוע' : 'שובב';
  }
  blocked() { return this.dead || document.hidden || this.motion() === 'כבוי'; }
  elements(selector) {
    return [...(this.rootRef.current?.querySelectorAll(selector) || [])]
      .filter(el => !el.closest('[data-loop],.concept-loop,[data-hero-loop],.tri-explorer'))
      // Never mutate server-rendered markup before its framework owns it.
      // React's concurrent renderer needs its own post-commit signal as well.
      .filter(el => !el.closest('astro-island[ssr]'))
      .filter(el => {
        const owner = el.closest('[data-exact-hydration]');
        return !owner || owner.hasAttribute('data-exact-motion-ready');
      });
  }
  listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    this.listeners.push(() => target.removeEventListener(name, callback, options));
  }
  animate(el, keyframes, options) {
    // Own only animations created here. Never enumerate/cancel math-engine or
    // unrelated animations, including descendants of decorative containers.
    const animation = el.animate(keyframes, options);
    const infinite = options.iterations === Infinity;
    this.animations.set(animation, {
      infinite,
      // Reference idle durations already include the calm multiplier. Keep that
      // creation factor so calm -> full -> calm never doubles the slowdown.
      creationFactor: infinite && this.motion() === 'רגוע' ? 1.8 : 1,
      policyPaused: this.blocked(),
    });
    if (this.blocked()) animation.pause();
    animation.addEventListener('finish', () => this.animations.delete(animation), { once: true });
    animation.addEventListener('cancel', () => this.animations.delete(animation), { once: true });
    return animation;
  }
  stopTimers() {
    clearInterval(this.logoIdle); clearInterval(this.tileT); clearTimeout(this.fallback);
    this.logoIdle = this.tileT = this.fallback = null;
  }
  startTimers() {
    if (this.blocked()) return;
    if (this.logoIdle == null) this.logoIdle = setInterval(this.logoWiggle, 7000);
    if (this.tileT == null) this.tileT = setInterval(() => {
      if (this.blocked()) return;
      const tiles = this.elements('a[data-tl]').filter(a => a.dataset.tl !== 'א׳' && !a.__tbusy && (b => b.top < innerHeight - 40 && b.bottom > 60)(a.getBoundingClientRect()));
      if (tiles.length) { const a = tiles[(++this.tileI) % tiles.length]; this.tileTouch(a, a.dataset.tl); }
    }, 2600);
  }
  sync = () => {
    if (this.dead) return;
    const off = this.motion() === 'כבוי';
    const blocked = this.blocked();
    this.animations.forEach((record, animation) => {
      if (off && !record.infinite) {
        // Complete reveal effects so reduced/off cannot leave content hidden.
        try { animation.finish(); } catch (_) { animation.cancel(); }
        record.policyPaused = false;
      } else if (blocked) {
        if (animation.playState === 'running') {
          record.policyPaused = true;
          animation.pause();
        }
      } else {
        if (record.infinite) animation.updatePlaybackRate(record.creationFactor / (this.motion() === 'רגוע' ? 1.8 : 1));
        if (record.policyPaused) { record.policyPaused = false; animation.play(); }
      }
    });
    if (blocked) this.stopTimers();
    else {
      // These were intentionally not started when the page initially loaded off.
      this.scan();
      this.elements('[data-doodle]').forEach(el => {
        if ((el.__a || []).every(a => a.playState === 'finished')) this.startIdle(el, el.dataset.doodle);
      });
      this.startTimers();
    }
    this.syncZig?.();
  };
  destroy() {
    this.dead = true;
    this.stopTimers();
    cancelAnimationFrame(this.zigRaf);
    this.io?.disconnect(); this.observer?.disconnect();
    this.listeners.splice(0).forEach(remove => remove());
    this.animations.forEach((_, animation) => animation.cancel());
    this.animations.clear();
  }
  IDLE = {
    kite:      [[{transform:'translate(0,0) rotate(-5deg)'},{transform:'translate(-8px,-14px) rotate(6deg)'}], 3200],
    boat:      [[{transform:'translate(0,0) rotate(-3deg)'},{transform:'translate(18px,-6px) rotate(3deg)',offset:.25},{transform:'translate(36px,0) rotate(-3deg)',offset:.5},{transform:'translate(54px,-6px) rotate(3deg)',offset:.75},{transform:'translate(70px,0) rotate(-2deg)'}], 6000, 'center bottom'],
    owl:       [[{transform:'rotate(-4deg)'},{transform:'rotate(5deg)'}], 3800, 'center bottom'],
    snail:     [[{transform:'translateX(0) scale(1,1)',opacity:1,offset:0},{transform:'translateX(5.6px) scale(1.06,.95)',opacity:1,offset:0.059},{transform:'translateX(14.0px) scale(1,1)',opacity:1,offset:0.117},{transform:'translateX(19.6px) scale(1.06,.95)',opacity:1,offset:0.176},{transform:'translateX(28.0px) scale(1,1)',opacity:1,offset:0.234},{transform:'translateX(33.6px) scale(1.06,.95)',opacity:1,offset:0.293},{transform:'translateX(42.0px) scale(1,1)',opacity:1,offset:0.351},{transform:'translateX(47.6px) scale(1.06,.95)',opacity:1,offset:0.410},{transform:'translateX(56.0px) scale(1,1)',opacity:1,offset:0.469},{transform:'translateX(61.6px) scale(1.06,.95)',opacity:1,offset:0.527},{transform:'translateX(70.0px) scale(1,1)',opacity:1,offset:0.586},{transform:'translateX(75.6px) scale(1.06,.95)',opacity:1,offset:0.644},{transform:'translateX(84.0px) scale(1,1)',opacity:1,offset:0.703},{transform:'translateX(89.6px) scale(1.06,.95)',opacity:1,offset:0.761},{transform:'translateX(98.0px) scale(1,1)',opacity:1,offset:0.820},{transform:'translateX(98px) scale(1,1)',opacity:1,offset:.9},{transform:'translateX(98px) scale(1,1)',opacity:0,offset:.94},{transform:'translateX(0) scale(1,1)',opacity:0,offset:.96},{transform:'translateX(0) scale(1,1)',opacity:1,offset:1}], 14000, 'center bottom', 'normal'],
    fish:      [[{transform:'translate(0,0) rotate(-3deg)'},{transform:'translate(-14px,-6px) rotate(3deg)'}], 2000],
    pencil:    [[{transform:'rotate(-9deg)'},{transform:'rotate(7deg) translateY(-4px)'}], 1800, 'center 80%'],
    telescope: [[{transform:'rotate(-2deg)'},{transform:'rotate(2deg)'}], 3000, 'center bottom'],
    cat:       [[{transform:'scale(1)'},{transform:'scale(1.03,1.015) rotate(-1deg)'}], 2200, 'center bottom'],
    cube:      [[{transform:'scaleY(1)'},{transform:'scaleY(1.035)'}], 2600, 'center bottom'],
    walker:    [[{transform:'translateY(0) rotate(-2deg)'},{transform:'translateY(-8px) rotate(3deg)'}], 700, 'center bottom'],
    robot:     [[{transform:'rotate(-5deg)'},{transform:'rotate(5deg) translateY(-3px)'}], 1600, 'center 70%'],
    eye:       [[{transform:'scaleY(1)',offset:0},{transform:'scaleY(1)',offset:.9},{transform:'scaleY(.12)',offset:.94},{transform:'scaleY(1)',offset:1}], 3600, 'center 55%', 'normal']
  };
  SPECIAL = {
    kite:      [{transform:'translate(0,0)'},{transform:'translate(-40px,-120px) rotate(-20deg)',offset:.5},{transform:'translate(0,0)'}],
    boat:      [{transform:'translateX(0)'},{transform:'translateX(-160px) rotate(-8deg)',opacity:0,offset:.45},{transform:'translateX(160px)',opacity:0,offset:.55},{transform:'translateX(0)',opacity:1}],
    owl:       [{transform:'rotate(0)'},{transform:'rotate(360deg)'}],
    snail:     [{transform:'scale(1)'},{transform:'scale(.6,.4) translateY(40%)',offset:.3},{transform:'scale(.6,.4) translateY(40%)',offset:.7},{transform:'scale(1)'}],
    fish:      [{transform:'translateX(0)'},{transform:'translateX(-80px) rotate(-10deg)',offset:.4},{transform:'translateX(20px) rotate(6deg)',offset:.75},{transform:'translateX(0)'}],
    pencil:    [{transform:'rotate(0)'},{transform:'rotate(720deg)'}],
    telescope: [{transform:'scale(1)'},{transform:'scale(1.12) rotate(-4deg)',offset:.4},{transform:'scale(1)'}],
    cat:       [{transform:'translateY(0)'},{transform:'translateY(-40px) scale(1.05,.95)',offset:.35},{transform:'translateY(0) scale(1.08,.9)',offset:.7},{transform:'translateY(0)'}],
    cube:      [{transform:'scale(1)'},{transform:'scale(1.1,.85)',offset:.3},{transform:'scale(.95,1.12)',offset:.6},{transform:'scale(1)'}],
    walker:    [{transform:'translateX(0)'},{transform:'translateX(60px) rotate(8deg)',offset:.35},{transform:'translateX(-30px) rotate(-8deg)',offset:.7},{transform:'translateX(0)'}],
    robot:     [{transform:'rotate(0)'},{transform:'rotate(-360deg) scale(.8)',offset:.6},{transform:'rotate(-360deg)'}],
    eye:       [{transform:'scaleY(1)'},{transform:'scaleY(.1)',offset:.2},{transform:'scaleY(1)',offset:.4},{transform:'scaleY(.1)',offset:.6},{transform:'scaleY(1)'}]
  };


  startZig() {
    const el = this.zigRef.current, g = this.zigPath.current; if (!el || !g) return; const botG = el.querySelector('[data-bot]');
    const paths = [...g.querySelectorAll(':scope > path')], texts = [...g.querySelectorAll(':scope > text')], rad = g.querySelector('[data-rad]'), axes = g.querySelector('[data-axes]'), ths = [...g.querySelectorAll('[data-th]')], tri = g.querySelector('[data-tri]'), play = g.querySelector('[data-play]'), playS = g.querySelector('[data-play-s]'), N = 90;
    const poly = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const T = L[L.length - 1];
      return Array.from({ length: N }, (_, k) => { const d = k / (N - 1) * T; let i = 1; while (i < L.length - 1 && L[i] < d) i++; const f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }); };
    const fn = f => Array.from({ length: N }, (_, k) => f(k / (N - 1)));
    const dot = () => fn(() => [60, 75]);
    const arc = (cx, cy, r, a0, a1) => fn(t => { const a = a0 + (a1 - a0) * t; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

    const playTri = (now, off) => { const cx = off ? 66 : 60 + 46 * Math.sin(now / 1500), C = [cx, 22];
      return [poly([[18, 130], C]), poly([C, [cx, 130]]), poly([[18, 130], [108, 130]]), dot(), dot(), poly([[108, 130], C]), dot()]; };
    const tA = Math.atan2(140, -80), tB = Math.atan2(-140, 80);
    const S = [
      [poly([[6, 10], [74, 2], [22, 70], [98, 40], [38, 112], [112, 84], [80, 146]]), dot(), dot(), dot(), dot(), dot(), dot()],
      [fn(t => { const x = 8 + 104 * t, u = (x - 60) / 52; return [x, 138 - 118 * u * u]; }), dot(), dot(), dot(), dot(), dot(), dot()],
      [fn(t => { const a = -Math.PI * .75 + t * Math.PI * 2; return [60 + 50 * Math.cos(a), 75 + 50 * Math.sin(a)]; }), dot(), dot(), dot(), dot(), dot(), dot()],
      [poly([[20, 145], [100, 5]]), poly([[2, 40], [118, 40]]), poly([[2, 110], [118, 110]]), arc(80, 40, 15, Math.PI, tA), arc(40, 110, 15, 0, tB), dot(), dot()],
      [poly([[18, 130], [66, 22]]), poly([[66, 22], [66, 22]]), poly([[18, 130], [108, 130]]), arc(18, 130, 16, Math.atan2(-108, 48), 0), arc(108, 130, 16, Math.atan2(-108, -42), -Math.PI), poly([[108, 130], [66, 22]]), arc(66, 22, 14, Math.atan2(108, 42), Math.atan2(108, -48))],
      [dot(), dot(), dot(), dot(), dot(), dot(), dot()]
    ];
    const OP = [[1, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 0, 0], [1, 0, 1, 1, 1, 1, 1], [1, 1, 1, 0, 0, 1, 0]], LAST = S.length - 1;
    let y = null, v = 0, lastS = scrollY, rot = 0, st = 1, draw = 0, sp = null, t0 = performance.now();
    const ss = x => x * x * (3 - 2 * x);
    const tick = (now, staticFrame = false) => {
      this.zigRaf = null;
      if (this.dead || (!staticFrame && this.blocked())) return;
      const off = this.motion() === 'כבוי', narrow = innerWidth < 760;
      el.style.display = narrow ? 'none' : 'block';
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const ST = 1500, C = 5 * ST + 900 + 3200; if (this.zc0 == null) this.zc0 = now;
      const tt = off ? 5 * ST + 2000 : (now - this.zc0) % C;
      if (!off && tt < (this.ztt ?? 0)) { sp = 0; t0 = now; }
      this.ztt = tt;
      const prog = Math.min(1, tt / (5 * ST)), botOp = tt > 5 * ST + 900 ? Math.min(1, (tt - 5 * ST - 900) / 400) : 0;
      const hd = document.querySelector('header'), hb = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0;
      const cl = Math.max(24, (innerWidth - 1200) / 2 + 24), zs = Math.max(1.4, Math.min(2, innerWidth / 720)), bw = 96 * zs, bh = 120 * zs, bx = Math.max(6, (cl - bw) / 2);
      const xt = bx + (innerWidth - bw - 16 - bx) * prog;
      this.zx = this.zx == null || off ? xt : this.zx + (xt - this.zx) * (this.motion() === 'רגוע' ? 0.06 : 0.1);

      const top = hb + 16 + bh / 2, bot = Math.max(top, innerHeight - 16 - bh / 2);
      const base = top + (bot - top) * prog;
      el.style.opacity = '1';
      const target = base;
      const dS = scrollY - lastS; lastS = scrollY;
      if (y == null) { y = target; sp = prog; }
      if (off) { y = target; rot = 0; st = 1; draw = 1; sp = prog; }
      else {
        const k = this.motion() === 'רגוע' ? 0.06 : 0.1;
        v = v * 0.78 + (target - y) * k; y += v;
        const vel = Math.max(-40, Math.min(40, dS));
        rot += ((-vel * 0.5) - rot) * 0.15;
        st += ((1 + Math.min(0.35, Math.abs(vel) / 90)) - st) * 0.18;
        draw = Math.min(1, (now - t0) / 1100);
        sp += (prog - sp) * 0.18;
      }
      const q = Math.min(LAST - 1e-4, sp * LAST), i = Math.floor(q), f = ss(Math.min(1, Math.max(0, (q - i - 0.3) / 0.4))), j = Math.min(LAST, i + 1);
      if (j === LAST) { S[LAST] = playTri(now, off); play.setAttribute('transform', `translate(${(S[LAST][1][0][0] - 60).toFixed(1)} 0)`); }
      play.setAttribute('opacity', (i === LAST - 1 ? f : 0).toFixed(3)); playS.setAttribute('opacity', (i === LAST - 1 ? f : 0).toFixed(3));
      paths.forEach((p, n) => {
        const A = S[i][n], B = S[j][n];
        let d = ''; for (let k = 0; k < N; k++) d += (k ? 'L' : 'M') + (A[k][0] + (B[k][0] - A[k][0]) * f).toFixed(1) + ' ' + (A[k][1] + (B[k][1] - A[k][1]) * f).toFixed(1);
        p.setAttribute('d', d);
        p.setAttribute('opacity', (OP[i][n] + (OP[j][n] - OP[i][n]) * f).toFixed(3));
      });
      const aOp = (i === 3 ? 1 - f : i === 2 ? f : 0);
      texts.forEach(t => t.setAttribute('opacity', aOp.toFixed(3)));
      const rOp = i === 1 ? f : i === 2 ? 1 - f : 0;
      const ph = off ? 1 : (now / 3400) % 4, kk = Math.floor(ph), fr = ph - kk, w = [0, 0, 0, 0];
      w[kk] = fr < .85 ? 1 : 1 - (fr - .85) / .15; if (fr > .85) w[(kk + 1) % 4] = (fr - .85) / .15;
      rad.setAttribute('opacity', (rOp * w[0]).toFixed(3));
      ths.forEach((t, n) => t.setAttribute('opacity', (rOp * w[n + 1]).toFixed(3)));
      tri.setAttribute('opacity', (i === 3 ? f : i === 4 ? 1 - f : 0).toFixed(3));
      axes.setAttribute('opacity', (i === 0 ? f : i === 1 ? 1 - f : 0).toFixed(3));
      rad.setAttribute('transform', `rotate(${off ? -45 : ((now / 16) % 360).toFixed(1)} 60 75)`);
      const wob = off ? 0 : Math.sin(now / 900) * 2.5;
      el.style.transform = `rotate(${wob.toFixed(2)}deg)`;
      g.style.opacity = (1 - botOp).toFixed(3); const bs = .5 + .5 * (1 - Math.pow(1 - botOp, 3)) + (!off && botOp >= 1 ? Math.sin(now / 260) * .02 : 0);
      botG.setAttribute('opacity', botOp.toFixed(3)); botG.setAttribute('transform', `translate(60 70) scale(${bs.toFixed(3)}) translate(-60 -70)`);
      const e = 1 - Math.pow(1 - draw, 3);
      paths.forEach(p => p.style.strokeDashoffset = (1 - e).toFixed(3));
      if (!staticFrame && !this.blocked()) this.zigRaf = requestAnimationFrame(tick);
    };
    this.syncZig = () => {
      if (this.blocked()) {
        cancelAnimationFrame(this.zigRaf); this.zigRaf = null;
        if (this.zigPausedAt == null) this.zigPausedAt = performance.now();
        if (!document.hidden && this.motion() === 'כבוי') tick(performance.now(), true);
      } else if (this.zigRaf == null) {
        if (this.zigPausedAt != null) {
          const pausedFor = performance.now() - this.zigPausedAt;
          if (this.zc0 != null) this.zc0 += pausedFor;
          t0 += pausedFor; this.zigPausedAt = null;
        }
        this.zigRaf = requestAnimationFrame(tick);
      }
    };
    this.syncZig();
    this.redrawZig = () => { t0 = performance.now(); };
  }

  zFree(x, y, w, hh) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
      const px = x + 3 + (w - 6) * i / 2, py = y + 3 + (hh - 6) * j / 3;
      if (py < 0 || py > innerHeight) continue;
      const e = document.elementFromPoint(px, py); if (e && this.zHit(e)) return false;
    }
    return true;
  }
  zHit(e) {
    if (e === document.body || e === document.documentElement) return false;
    if (e.closest('svg,img,button,a,input,select,textarea,h1,h2,h3,h4,p,li,label,table,[role=tooltip],[role=dialog]')) return true;
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return true;
    const r = e.getBoundingClientRect(); if (r.width > innerWidth * 0.85) return false;
    const cs = getComputedStyle(e);
    return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none';
  }
  flyPlane(p, slow) {
    if (!p || p.__fly || this.blocked()) return; p.__fly = true;
    const segs = [[[0,0],[40,-18.6],[95,-30],[120,-5]], [[120,-5],[140,15],[120,50],[90,40]], [[90,40],[60,30],[70,-10],[120,-25]], [[120,-25],[200,-50],[320,-40],[460,-110]]];
    const bz = (a, b, c, d, t) => { const u = 1 - t; return [0, 1].map(k => u*u*u*a[k] + 3*u*u*t*b[k] + 3*u*t*t*c[k] + t*t*t*d[k]); };
    const dz = (a, b, c, d, t) => { const u = 1 - t; return [0, 1].map(k => 3*u*u*(b[k]-a[k]) + 6*u*t*(c[k]-b[k]) + 3*t*t*(d[k]-c[k])); };
    const N = 18, FL = .7, kf = [];
    segs.forEach((s, si) => { for (let i = si ? 1 : 0; i <= N; i++) { const t = i / N, [x, y] = bz(...s, t), [dx, dy] = dz(...s, t); const ang = Math.atan2(dy, dx) * 180 / Math.PI + 25; const o = ((si + t) / segs.length) * FL; kf.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`, opacity: o > FL - .04 ? Math.max(0, (FL - o) / .04) : 1, offset: +o.toFixed(4) }); } });
    kf[0].transform = 'none';
    kf.push({ transform: 'none', opacity: 0, offset: .72 }, { transform: 'none', opacity: 0, offset: .9 }, { transform: 'none', opacity: 1, offset: 1 });
    p.style.transformOrigin = 'center';
    p.__a = this.animate(p, kf, { duration: 9000 * slow, iterations: Infinity, delay: 1200, easing: 'linear' });
  }
  tileTouch(a, l) {
    if (!a || a.__tbusy || this.blocked()) return;
    const img = a.querySelector('[data-tileimg]'); let an = null;
    if (l === 'ב׳') {
      const lid = a.querySelector('[data-wink]');
      if (lid) an = this.animate(lid, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: .25 }, { transform: 'scaleY(1)', offset: .6 }, { transform: 'scaleY(0)' }], { duration: 520, easing: 'ease-in-out' });
      img && this.animate(img, [{ transform: 'none' }, { transform: 'rotate(-4deg)', offset: .4 }, { transform: 'none' }], { duration: 520, easing: 'ease-in-out' });
    }
    if (l === 'ג׳') {
      const b = a.querySelector('[data-meow]');
      if (b) an = this.animate(b, [{ opacity: 0, transform: 'scale(.4) rotate(-8deg)' }, { opacity: 1, transform: 'scale(1.08) rotate(3deg)', offset: .15 }, { opacity: 1, transform: 'scale(1) rotate(0)', offset: .25 }, { opacity: 1, transform: 'scale(1)', offset: .8 }, { opacity: 0, transform: 'scale(.9) translateY(-6px)' }], { duration: 1300, easing: 'ease-out' });
      img && this.animate(img, [{ transform: 'none' }, { transform: 'translateY(-4px) scale(1.04,.97)', offset: .15 }, { transform: 'none', offset: .35 }], { duration: 1300 });
    }
    if (l === 'ד׳' && img) {
      an = this.animate(img, [
        { transform: 'none' },
        { transform: 'translate(-6px,-40px) rotate(-10deg)', offset: .3 },
        { transform: 'translate(8px,-90px) rotate(8deg)', offset: .55 },
        { transform: 'translate(-4px,-60px) rotate(-6deg)', offset: .75 },
        { transform: 'none' }
      ], { duration: 1600, easing: 'cubic-bezier(.45,.05,.35,1)' });
    }
    if (l === 'ה׳' && img) {
      this.animate(img, [{ transform: 'none' }, { transform: 'scale(1.1) rotate(-3deg)', offset: .15 }, { transform: 'scale(1.1) rotate(-3deg)', offset: .5 }, { transform: 'none', offset: .7 }, { transform: 'none' }], { duration: 2200, easing: 'ease-in-out' });
      const lid = a.querySelector('[data-wink]');
      lid && this.animate(lid, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: .3 }, { transform: 'scaleY(1)', offset: .6 }, { transform: 'scaleY(0)' }], { duration: 520, delay: 520, easing: 'ease-in-out' });
      const bs = [...a.querySelectorAll('[data-bub]')], P = [[-6, -58], [4, -80], [-10, -44]];
      bs.forEach((b, i) => { const [dx, dy] = P[i]; const x = this.animate(b, [{ opacity: 0, transform: 'translate(0,0) scale(.3)' }, { opacity: 1, transform: `translate(${-3 + dx * .3}px,${dy * .3}px) scale(1)`, offset: .25 }, { opacity: .9, transform: `translate(${dx}px,${dy * .7}px) scale(1.1)`, offset: .7 }, { opacity: 0, transform: `translate(${dx * .6}px,${dy}px) scale(1.2)` }], { duration: 1100, delay: 1150 + i * 180, easing: 'ease-out' }); if (i === bs.length - 1) an = x; });
    }
    if (l === 'ו׳') {
      const ice = a.querySelector('[data-ice]'), pd = a.querySelector('[data-puddle]'), T = 4200;
      if (ice) an = this.animate(ice, [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: T, easing: 'ease-in-out' });
      img && this.animate(img, [{ transform: 'none' }, { transform: 'scale(1.03,.98)', offset: .06 }, { transform: 'translateX(-1px)', offset: .09 }, { transform: 'translateX(1px)', offset: .12 }, { transform: 'none', offset: .15 }, { transform: 'none' }], { duration: T });
      a.querySelectorAll('[data-drop]').forEach((d, i) => this.animate(d, [{ opacity: 0, transform: 'translateY(0) scale(.5)' }, { opacity: 1, transform: 'translateY(0) scale(1)', offset: .3 }, { opacity: 1, transform: 'translateY(14px) scale(1,1.2)', offset: .8 }, { opacity: 0, transform: 'translateY(20px) scale(1.4,.6)' }], { duration: 800, delay: 700 + i * 260, iterations: 3, easing: 'ease-in' }));
      pd && this.animate(pd, [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 0, transform: 'scaleX(0)', offset: .2 }, { opacity: 1, transform: 'scaleX(1)', offset: .75 }, { opacity: 0, transform: 'scaleX(1.1)' }], { duration: T, easing: 'ease-out' });
    }
    if (l === 'mid') {
      const T = 3200, lamp = a.querySelector('[data-lamp]'), sm = a.querySelector('[data-smoke]'), gb = a.querySelector('[data-gbody]'), arms = a.querySelector('[data-garms]');
      lamp && this.animate(lamp, [{ transform: 'none' }, { transform: 'rotate(-6deg)', offset: .04 }, { transform: 'rotate(6deg)', offset: .08 }, { transform: 'rotate(-4deg)', offset: .12 }, { transform: 'none', offset: .16 }, { transform: 'none', offset: .86 }, { transform: 'scale(1.08)', offset: .92 }, { transform: 'none' }], { duration: T });
      sm && this.animate(sm, [{ strokeDashoffset: 1, opacity: .9 }, { strokeDashoffset: 1, offset: .06 }, { strokeDashoffset: 0, opacity: .9, offset: .22 }, { strokeDashoffset: 0, opacity: 0, offset: .36 }, { strokeDashoffset: 0, opacity: 0, offset: .8 }, { strokeDashoffset: 0, opacity: .8, offset: .86 }, { strokeDashoffset: -1, opacity: 0 }], { duration: T, easing: 'ease-out' });
      if (gb) an = this.animate(gb, [
        { opacity: 0, transform: 'translateY(18px) scale(.1) rotate(-30deg)' },
        { opacity: 0, transform: 'translateY(18px) scale(.1) rotate(-30deg)', offset: .15 },
        { opacity: 1, transform: 'translateY(-4px) scale(1.12) rotate(6deg)', offset: .3 },
        { opacity: 1, transform: 'translateY(0) scale(1) rotate(0)', offset: .38 },
        { opacity: 1, transform: 'translateY(-4px) scale(1) rotate(-2deg)', offset: .55 },
        { opacity: 1, transform: 'translateY(0) scale(1) rotate(2deg)', offset: .72 },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: .8 },
        { opacity: 0, transform: 'translateY(20px) scale(.08,.3) rotate(40deg)' }
      ], { duration: T, easing: 'ease-in-out' });
      arms && this.animate(arms, [{ transform: 'none' }, { transform: 'none', offset: .38 }, { transform: 'rotate(-8deg)', offset: .46 }, { transform: 'rotate(8deg)', offset: .54 }, { transform: 'rotate(-8deg)', offset: .62 }, { transform: 'none', offset: .7 }, { transform: 'none' }], { duration: T });
      a.querySelectorAll('[data-geye]').forEach(e => this.animate(e, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1)', offset: .6 }, { transform: 'scaleY(.1)', offset: .63 }, { transform: 'scaleY(1)', offset: .66 }, { transform: 'scaleY(1)' }], { duration: T }));
      a.querySelectorAll('[data-gspark] circle').forEach((c, i) => this.animate(c, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 0, offset: .26 + i * .03 }, { opacity: 1, transform: 'scale(1.4)', offset: .34 + i * .03 }, { opacity: 0, transform: 'scale(0)', offset: .5 + i * .03 }, { opacity: 0 }], { duration: T }));
      a.querySelectorAll('[data-geye], [data-gspark] circle').forEach(e => { e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center'; });
    }
    if (an) { a.__tbusy = true; an.onfinish = () => { a.__tbusy = false; }; }
  }
  meowSound() {
    try {
      const C = this.ac || (this.ac = new (window.AudioContext || window.webkitAudioContext)()), t = C.currentTime;
      const o = C.createOscillator(), f = C.createBiquadFilter(), g = C.createGain();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 3;
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(880, t + .12); o.frequency.linearRampToValueAtTime(760, t + .3); o.frequency.exponentialRampToValueAtTime(420, t + .55);
      f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1800, t + .15); f.frequency.linearRampToValueAtTime(700, t + .55);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .05); g.gain.linearRampToValueAtTime(.12, t + .3); g.gain.exponentialRampToValueAtTime(.001, t + .6);
      o.connect(f); f.connect(g); g.connect(C.destination); o.start(t); o.stop(t + .62);
    } catch (_) {}
  }

  logoWiggle = () => {
    const lg = this.logoRef.current; if (!lg || lg.__busy || this.blocked()) return;
    lg.__busy = true;
    const a = this.animate(lg, [
      { transform: 'none' },
      { transform: 'translateY(-10px) rotate(-6deg) scale(1.06,.96)', offset: .25 },
      { transform: 'translateY(0) rotate(4deg) scale(.96,1.04)', offset: .5 },
      { transform: 'rotate(-2deg)', offset: .75 },
      { transform: 'none' }
    ], { duration: 800, easing: 'ease-in-out' });
    a.onfinish = () => { lg.__busy = false; };
  };

  scan() {
    const r = this.rootRef.current; if (!r) return;
    const off = this.blocked();
    // Run here, rather than only at init, so deferred hydrated islands receive
    // keyboard support exactly once without changing their SSR attributes.
    this.elements('[data-doodle] img').forEach(img => {
      // Decorative copies inside aria-hidden (e.g. the flying plane) must not take focus.
      if (img.closest('a,button,[aria-hidden="true"]') || this.keyboardImages.has(img)) return;
      this.keyboardImages.add(img);
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'הנפשת השרבוט');
      this.listen(img, 'keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); img.click(); }
      });
    });
    this.elements('[data-zzz]').forEach(zz => {
      if (zz.__z || off) return; zz.__z = true;
      const slow = this.motion() === 'רגוע' ? 1.8 : 1;
      this.animate(zz, [{ opacity: 0, transform: 'translate(0,6px) scale(.6)' }, { opacity: 1, transform: 'translate(3px,0) scale(1)', offset: .3 }, { opacity: 1, transform: 'translate(8px,-8px) rotate(-8deg)', offset: .7 }, { opacity: 0, transform: 'translate(12px,-16px) rotate(-12deg) scale(1.1)' }], { duration: 2400 * slow, delay: +zz.dataset.zzz * 600 * slow, iterations: Infinity, easing: 'ease-out' });
    });
    this.elements('[data-water]').forEach(w => {
      if (w.__w || off) return; w.__w = true;
      const slow = this.motion() === 'רגוע' ? 1.8 : 1;
      this.animate(w.firstElementChild, [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 2600 * slow, iterations: Infinity });
      this.animate(w.parentElement, [{ backgroundPosition: '0px 0px' }, { backgroundPosition: '0px -2px' }], { duration: 1300 * slow, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    });
    this.elements('[data-draw],[data-pop],[data-grow],[data-fly],[data-out],[data-doodle]').forEach(el => {
      if (el.__prepared) return;
      el.__prepared = true; el.__a = [];
      const d = el.dataset;
      const ease = 'cubic-bezier(.55,.1,.25,1)';
      if (d.draw !== undefined) el.__a.push(this.animate(el, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: +d.dur || 900, delay: +d.draw || 0, fill: 'both', easing: ease }));
      /* data-lcp is the homepage h1. A CSS animation moves it; hiding it
         until this module runs made the LCP text invisible. */
      if (d.pop !== undefined && d.lcp === undefined) el.__a.push(this.animate(el, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: +d.pop || 0, fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1.2)' }));
      if (d.grow !== undefined) el.__a.push(this.animate(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 600, delay: +d.grow || 0, fill: 'both', easing: 'cubic-bezier(.3,1.3,.5,1)' }));
      if (d.fly !== undefined) el.__a.push(this.animate(el, [{ opacity: 0, transform: `translate(${d.dx || 0}px,${d.dy || 0}px)` }, { opacity: 1, transform: 'none' }], { duration: 700, delay: +d.fly || 0, fill: 'both', easing: 'cubic-bezier(.3,1.25,.5,1)' }));
      if (d.out !== undefined) el.__a.push(this.animate(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-36px)' }], { duration: 600, delay: +d.out || 0, fill: 'forwards', easing: 'ease-in' }));
      if (d.doodle !== undefined) this.prepDoodle(el);
      el.__a.forEach(a => a.pause());
      const rc = el.getBoundingClientRect();
      if (off || document.hidden) el.__a.forEach(a => a.finish());
      else if (rc.top < innerHeight && rc.bottom > 0) this.play(el);
      else this.io.observe(el);
    });
    clearTimeout(this.fallback);
    if (off) return;
    this.fallback = setTimeout(() => {
      if (this.blocked()) return;
      this.elements('[data-draw],[data-pop],[data-grow],[data-doodle]').forEach(el => { const b = el.getBoundingClientRect(); if (b.top < innerHeight && b.bottom > 0) (el.__a || []).forEach(a => { if (a.playState === 'paused') a.finish(); }); });
    }, 2500);
  }
  play(el) {
    (el.__a || []).forEach(a => {
      if (this.motion() === 'כבוי') a.finish();
      else if (this.blocked()) {
        const record = this.animations.get(a); if (record) record.policyPaused = true;
      } else a.play();
    });
  }

  prepDoodle(el) {
    const img = el.querySelector('img'); if (!img) return;
    const name = el.dataset.doodle;
    const enter = this.animate(img, [
      { clipPath: 'inset(0 0 0 100%)', transform: 'rotate(-6deg) scale(.9)' },
      { clipPath: 'inset(0 0 0 0%)', transform: 'none' }
    ], { duration: 1200, delay: Math.random() * 400, fill: 'both', easing: 'cubic-bezier(.6,.05,.3,1)' });
    enter.onfinish = () => this.startIdle(el, name);
    el.__a.push(enter);
    this.listen(img, 'mouseenter', () => {
      if (this.blocked() || img.__busy) return;
      this.animate(img, [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg) scale(1.06)' }, { transform: 'rotate(6deg) scale(1.06)' }, { transform: 'rotate(0)' }], { duration: 520, easing: 'ease-in-out', composite: 'add' });
    });
    this.listen(img, 'click', () => {
      if (this.blocked() || img.__busy) return;
      const kf = this.SPECIAL[name]; if (!kf) return;
      img.__busy = true;
      const a = this.animate(img, kf, { duration: name === 'boat' ? 2000 : 1100, easing: 'cubic-bezier(.45,.05,.35,1)', composite: 'add' });
      a.onfinish = () => { img.__busy = false; };
    });
  }

  startIdle(el, name) {
    const def = this.IDLE[name]; if (!def || el.__idle || this.blocked()) return;
    const [kf, dur, origin, dir] = def;
    el.style.transformOrigin = origin || 'center';
    const slow = this.motion() === 'רגוע' ? 1.8 : 1;
    const opt = { duration: dur * slow, iterations: Infinity, direction: dir || 'alternate', easing: 'ease-in-out', delay: Math.random() * 600 };
    el.__idle = this.animate(el, kf, opt);
    if (name === 'robot') this.flyPlane(el.querySelector('[data-plane]'), slow);
    const tr = el.parentElement && el.parentElement.querySelector('[data-trail="' + name + '"]');
    if (tr) {
      const tk = kf.map(k => { const m = /translateX\(([-\d.]+)px\)/.exec(k.transform || ''); const sx = m ? Math.max(0.001, +m[1] / 98) : 0.001; return { transform: 'scaleX(' + sx.toFixed(3) + ')', opacity: k.opacity == null ? 1 : k.opacity, offset: k.offset }; });
      tr.__idle = this.animate(tr, tk, opt);
    }
  }


  init() {
    if(!this.rootRef.current || !Element.prototype.animate) return;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.io = typeof IntersectionObserver==='function' ? new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){this.play(e.target);this.io.unobserve(e.target);}}),{threshold:.2}) : {observe:el=>this.play(el),unobserve:()=>{},disconnect:()=>{}};
    this.scan(); this.startZig();
    const logo=this.logoRef.current;
    if(logo && !this.blocked()) this.animate(logo, [{transform:'translateY(-40px) rotate(-12deg) scale(.7)',opacity:0},{transform:'translateY(4px) rotate(3deg) scale(1.05)',opacity:1,offset:.6},{transform:'none',opacity:1}],{duration:900,easing:'cubic-bezier(.3,1.3,.5,1)'});
    if (logo) { this.listen(logo,'mouseenter',this.logoWiggle); this.listen(logo,'click',this.logoWiggle); }
    const tile=a=>this.tileTouch(a,a.dataset.tl);
    this.elements('a[data-tl]').forEach(a=>{
      this.listen(a,'mouseenter',()=>tile(a)); this.listen(a,'touchstart',()=>tile(a),{passive:true}); this.listen(a,'focus',()=>tile(a));
      if(a.dataset.tl==='ג׳') this.listen(a,'click',()=>{if(!this.blocked())this.meowSound();});
    });
    this.startTimers();
    // astro:hydrate does not bubble, so capture it. The React signal is emitted
    // from useEffect only after commit; both paths rescan eligible markup.
    this.listen(document,'astro:hydrate',()=>this.scan(),true);
    this.listen(document,'nd:exact-hydrated',()=>this.scan());
    this.observer = new MutationObserver(this.sync);
    this.observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-nd-motion']});
    // The existing accessibility menu dispatches this on window, not document.
    this.listen(window,'nd:motion-off',e=>{
      if (typeof e.detail?.off === 'boolean') this.eventOff = e.detail.off;
      this.sync();
    });
    // Presentation-only integration point for the three-mode menu. No access to
    // its private preference schema or persistent storage is needed here.
    this.listen(window,'nd:motion-change',e=>{
      const mode = e.detail?.mode;
      if (!['full','relaxed','calm','off'].includes(mode)) return;
      document.documentElement.dataset.ndMotion = mode;
      this.sync();
    });
    this.listen(this.reducedMotion,'change',this.sync);
    this.listen(document,'visibilitychange',this.sync);
    this.listen(window,'resize',()=>{ if (this.motion() === 'כבוי') this.syncZig?.(); });
  }
}
let activeMotion;
export function initExactReferenceMotion() {
  if (activeMotion && !activeMotion.dead && activeMotion.rootRef.current === document.querySelector('.exact-frame')) return activeMotion;
  activeMotion?.destroy();
  activeMotion = new ExactReferenceMotion();
  activeMotion.init();
  return activeMotion;
}
