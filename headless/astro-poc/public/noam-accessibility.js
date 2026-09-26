/* Shared accessibility preferences for Noam's Wix site and worksheet pages. */
(function () {
  'use strict';
  // Astro shell only. The catalog and the worksheet viewer load this file
  // with a relative src, and keep the original launcher placement.
  var scriptSrc = '';
  try { scriptSrc = (document.currentScript && document.currentScript.getAttribute('src')) || ''; } catch (_) {}
  var astroShell = scriptSrc === '/noam-accessibility.js';
  var narrowQuery = window.matchMedia('(max-width: 800px)');

  function docked() {
    return astroShell && narrowQuery.matches;
  }

  function init() {
    if (document.getElementById('noam-accessibility')) return;
    const defaults = { text: 100, contrast: false, links: false, motion: false };
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefs = { ...defaults, stopAnim: reduceQuery.matches, stopAnimChosen: false };
    try {
      const saved = JSON.parse(localStorage.getItem('noam-accessibility-v1') || '{}');
      prefs.text = [100,110,120,130,140,150].includes(saved.text) ? saved.text : 100;
      for (const key of ['contrast','links','motion']) prefs[key] = saved[key] === true;
      if (saved.stopAnim === true || saved.stopAnim === false) {
        prefs.stopAnim = saved.stopAnim;
        prefs.stopAnimChosen = true;
      }
    } catch (_) { /* Preferences still work when storage is unavailable. */ }

    // JS loops call requestAnimationFrame by name. Hold those callbacks while
    // animations are stopped, then release them when the option is turned off.
    var nativeRaf = window.requestAnimationFrame.bind(window);
    var nativeCancel = window.cancelAnimationFrame.bind(window);
    var rafFrozen = false;
    var rafPending = new Map();
    window.requestAnimationFrame = function (cb) {
      var id = nativeRaf(function (ts) {
        if (rafFrozen) { rafPending.set(id, cb); return; }
        cb(ts);
      });
      return id;
    };
    window.cancelAnimationFrame = function (id) {
      rafPending.delete(id);
      nativeCancel(id);
    };
    function setRafFrozen(off) {
      rafFrozen = off;
      if (off) return;
      rafPending.forEach(function (cb, id) {
        rafPending.delete(id);
        nativeRaf(cb);
      });
    }
    function syncVideos(off) {
      document.querySelectorAll('video').forEach(function (video) {
        if (off) {
          if (!video.paused && !video.ended) {
            video.setAttribute('data-nd-was-playing', '1');
            video.pause();
          }
        } else if (video.getAttribute('data-nd-was-playing') === '1') {
          video.removeAttribute('data-nd-was-playing');
          var pending = video.play();
          if (pending && pending.catch) pending.catch(function () {});
        }
      });
    }

    const style = document.createElement('style');
    style.textContent = `
      html.noam-a11y-links a { text-decoration:underline!important; text-decoration-thickness:2px!important; text-underline-offset:3px!important; }
      html.noam-a11y-contrast body,
      html.noam-a11y-contrast body :is(main,section,article,header,footer,nav,aside,div,p,h1,h2,h3,h4,h5,h6,span,li,ul,ol,a,button,input,textarea,label) {
        color:#fff!important; background-color:#111!important; background-image:none!important;
        border-color:#fff!important; text-shadow:none!important;
      }
      html.noam-a11y-contrast a { color:#ffed75!important; }
      html.noam-a11y-motion *, html.noam-a11y-motion *::before, html.noam-a11y-motion *::after {
        animation:none!important; transition:none!important; scroll-behavior:auto!important;
      }
      html.nd-motion-off *, html.nd-motion-off *::before, html.nd-motion-off *::after {
        animation:none!important; animation-play-state:paused!important; transition:none!important;
      }
      @media print { #noam-accessibility { display:none!important; } }
      /* Reserve the corner. The window stays the scroller. */
      @media (max-width: 800px) {
        html.noam-a11y-pad body {
          padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
          scroll-padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
        }
      }
      @media (min-width: 801px) {
        html.noam-a11y-pad body {
          padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
          scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
        }
      }
      @media print {
        html.noam-a11y-pad body { padding-bottom: 0 !important; scroll-padding-bottom: 0 !important; }
      }
    `;
    document.head.appendChild(style);
    const host = document.createElement('div');
    host.id = 'noam-accessibility';
    // Shadow DOM keeps site-wide button rules from changing the menu.
    // The concept-loop pause control sits on the physical right. On the Astro
    // shell, park the launcher in the lowest corner that does not cover text
    // or a control, then lift it if both corners are taken.
    function launcherMetrics() {
      var narrow = docked();
      return { size: narrow ? 44 : 48, edge: narrow ? 8 : 14 };
    }
    function applyHostBox(side, edge, bottomPx, size) {
      var other = side === 'right' ? 'left' : 'right';
      host.style.cssText = 'position:fixed;' + side + ':' + edge + 'px;' + other + ':auto;bottom:calc(' + bottomPx + 'px + env(safe-area-inset-bottom, 0px));z-index:10000;width:' + size + 'px;height:' + size + 'px;';
    }
    function placeLauncher() {
      document.documentElement.classList.toggle('noam-a11y-pad', astroShell);
      if (!astroShell) {
        host.style.cssText = 'position:fixed;right:14px;bottom:calc(82px + env(safe-area-inset-bottom, 0px));z-index:10000;width:48px;height:48px;';
        return;
      }
      settleLauncher();
    }
    if (astroShell) narrowQuery.addEventListener('change', placeLauncher);
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = `
      <style>
        :host { color-scheme:light; font:16px Arial,sans-serif; }
        * { box-sizing:border-box; }
        button { font:700 16px Arial,sans-serif; cursor:pointer; color:#14213d; background:#fff; border:2px solid #14213d; border-radius:10px; min-height:44px; padding:8px 12px; }
        button:focus-visible,a:focus-visible { outline:3px solid #005fcc; outline-offset:3px; }
        button[aria-pressed="true"] { color:#fff; background:#075e57; }
        button:disabled { opacity:.45; cursor:default; }
        #launch { width:48px; height:48px; padding:8px; border-radius:50%; background:#075e57; color:white; border:2px solid white; box-shadow:0 2px 8px #14213d66; display:grid; place-items:center; }
        #launch svg { width:28px; height:28px; }
        :host-context(html.noam-a11y-pad) #launch {
          width:44px; height:44px; padding:8px;
          background:rgba(7,94,87,0.82); border-color:rgba(255,255,255,0.95);
          box-shadow:0 2px 8px rgba(20,33,61,0.28);
        }
        :host-context(html.noam-a11y-pad) #launch svg { width:22px; height:22px; }
        @media (min-width: 801px) {
          :host-context(html.noam-a11y-pad) #launch { width:48px; height:48px; background:#075e57; border-color:#fff; box-shadow:0 2px 8px #14213d66; }
          :host-context(html.noam-a11y-pad) #launch svg { width:28px; height:28px; }
        }
        dialog { direction:rtl; position:fixed; inset:auto 14px calc(140px + env(safe-area-inset-bottom)) auto; margin:0; width:min(330px,calc(100vw - 28px)); max-height:calc(100dvh - 165px); overflow:auto; background:#fff; color:#14213d; border:2px solid #14213d; border-radius:18px; padding:16px; box-shadow:0 8px 30px #14213d40; font:16px/1.5 Arial,sans-serif; }
        dialog::backdrop { background:#14213d26; }
        header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
        h2 { font-size:21px; margin:0; }
        #close { padding:0; width:44px; font-size:24px; }
        .size { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:8px 0 12px; }
        .size button { width:44px; padding:0; font-size:22px; }
        output { direction:ltr; font-weight:bold; }
        .option { display:block; width:100%; margin:8px 0; text-align:right; }
        #reset { width:100%; margin-top:8px; }
        p { margin:12px 0 0; font-size:13px; }
        @media(max-height:500px) { dialog { inset:10px 10px auto auto; max-height:calc(100dvh - 20px); } }
        @media(prefers-reduced-motion:reduce) { * { scroll-behavior:auto; } }
      </style>
      <button id="launch" type="button" aria-label="פתיחת תפריט נגישות" title="נגישות" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="14" cy="5" r="2.5" fill="currentColor" stroke="none"/>
          <path d="M13 10v10h10l4 7M13 14h8M9 15a8 8 0 1 0 11 10"/>
        </svg>
      </button>
      <dialog id="menu" aria-labelledby="title">
        <header><h2 id="title">כלי נגישות</h2><button id="close" type="button" aria-label="סגירת תפריט הנגישות">×</button></header>
        <div id="text-label">גודל טקסט באתר</div>
        <div class="size" role="group" aria-labelledby="text-label">
          <button id="increase" type="button" aria-label="הגדלת טקסט">+</button>
          <output id="size" aria-live="polite">100%</output>
          <button id="decrease" type="button" aria-label="הקטנת טקסט">−</button>
        </div>
        <button class="option" data-pref="contrast" type="button" aria-pressed="false">ניגודיות גבוהה</button>
        <button class="option" data-pref="links" type="button" aria-pressed="false">הדגשת קישורים</button>
        <button class="option" data-pref="motion" type="button" aria-pressed="false">הפחתת תנועה</button>
        <button class="option" id="stop-anim" type="button" aria-pressed="false">עצירת אנימציות</button>
        <button id="reset" type="button">איפוס הגדרות</button>
        <p>ההעדפות נשמרות בדפדפן עבור אתר זה. להגדלת דף העבודה עצמו השתמשו בסליידר הזום של הדף.</p>
      </dialog>
    `;
    placeLauncher();
    document.body.appendChild(host);
    const dialog = root.getElementById('menu');
    const launch = root.getElementById('launch');

    function obstacleRects() {
      var rects = [];
      var nodes = document.querySelectorAll('a,button,input,select,textarea,summary,[role="button"],p,h1,h2,h3,h4');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.closest('#noam-accessibility,#ndGateOverlay,.site-doodles')) continue;
        var st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
        rects.push(r);
      }
      var fixedNodes = document.body.querySelectorAll('*');
      for (var j = 0; j < fixedNodes.length; j++) {
        var fixedEl = fixedNodes[j];
        if (fixedEl.closest('#noam-accessibility,#ndGateOverlay,.site-doodles')) continue;
        var fixedStyle = getComputedStyle(fixedEl);
        if (fixedStyle.position !== 'fixed' && fixedStyle.position !== 'sticky') continue;
        if (fixedStyle.pointerEvents === 'none' || fixedStyle.display === 'none' || fixedStyle.visibility === 'hidden') continue;
        var fr = fixedEl.getBoundingClientRect();
        if (fr.width < 2 || fr.height < 2) continue;
        if (fr.width >= window.innerWidth - 4 && fr.height >= window.innerHeight - 4) continue;
        if (fr.bottom <= 0 || fr.top >= window.innerHeight || fr.right <= 0 || fr.left >= window.innerWidth) continue;
        rects.push(fr);
      }
      return rects;
    }
    function boxHits(box, rects) {
      if (box.width < 2 || box.bottom < 0 || box.top > window.innerHeight) return true;
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        var ix = Math.min(box.right, r.right + 6) - Math.max(box.left, r.left - 6);
        var iy = Math.min(box.bottom, r.bottom + 6) - Math.max(box.top, r.top - 6);
        if (ix > 0.5 && iy > 0.5) return true;
      }
      return false;
    }
    function settleLauncher() {
      if (!astroShell || !host.isConnected || dialog.open) return;
      var metrics = launcherMetrics();
      var rects = obstacleRects();
      var maxBottom = Math.max(8, Math.round(window.innerHeight * 0.75));
      var bottoms = [8, 0];
      for (var bottom = 16; bottom <= maxBottom; bottom += 8) bottoms.push(bottom);
      var sides = ['right', 'left'];
      for (var i = 0; i < bottoms.length; i++) {
        for (var s = 0; s < sides.length; s++) {
          applyHostBox(sides[s], metrics.edge, bottoms[i], metrics.size);
          if (!boxHits(host.getBoundingClientRect(), rects)) return;
        }
      }
      applyHostBox('left', metrics.edge, 8, metrics.size);
    }
    function placeDialogNearLauncher() {
      if (!astroShell) return;
      var b = host.getBoundingClientRect();
      var onLeft = (b.left + b.width / 2) < window.innerWidth / 2;
      dialog.style.left = onLeft ? '14px' : 'auto';
      dialog.style.right = onLeft ? 'auto' : '14px';
      var spaceAbove = b.top - 16;
      var spaceBelow = window.innerHeight - b.bottom - 16;
      if (spaceAbove >= 200 || spaceAbove >= spaceBelow) {
        dialog.style.top = 'auto';
        dialog.style.bottom = Math.round(window.innerHeight - b.top + 12) + 'px';
        dialog.style.maxHeight = Math.max(160, Math.floor(spaceAbove - 8)) + 'px';
      } else {
        dialog.style.bottom = 'auto';
        dialog.style.top = Math.round(b.bottom + 12) + 'px';
        dialog.style.maxHeight = Math.max(160, Math.floor(spaceBelow - 8)) + 'px';
      }
    }
    if (astroShell) {
      settleLauncher();
      window.addEventListener('resize', settleLauncher);
      var scrollTimer = 0;
      window.addEventListener('scroll', function () {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(settleLauncher, 160);
      }, { passive: true });
      window.addEventListener('load', settleLauncher, { once: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { settleLauncher(); });
      window.setTimeout(settleLauncher, 500);
    }
    launch.addEventListener('click', () => {
      placeDialogNearLauncher();
      dialog.showModal();
      launch.setAttribute('aria-expanded','true');
      root.getElementById('close').focus();
    });
    root.getElementById('close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { launch.setAttribute('aria-expanded','false'); launch.focus(); });

    // Snapshot the original computed font sizes before scaling, including nested spans.
    const original = new Map();
    const selector = 'p,h1,h2,h3,h4,h5,h6,a,button,span,label,li,input,textarea,td,th,legend,summary';
    function scaleText() {
      // Measure at the original size so new children never inherit a doubled scale.
      for (const [el, info] of original) {
        if (!el.isConnected) { original.delete(el); continue; }
        if (info.value) el.style.setProperty('font-size',info.value,info.priority);
        else el.style.removeProperty('font-size');
      }
      const elements = Array.from(document.querySelectorAll(selector)).filter(el =>
        !el.closest('#noam-accessibility,svg,math,.noam-question-pin') && el.getClientRects().length);
      for (const el of elements) {
        if (!original.has(el)) original.set(el, {
          pixels:parseFloat(getComputedStyle(el).fontSize),
          value:el.style.getPropertyValue('font-size'),
          priority:el.style.getPropertyPriority('font-size')
        });
        else original.get(el).pixels = parseFloat(getComputedStyle(el).fontSize);
      }
      for (const [el, info] of original) {
        if (!el.isConnected) { original.delete(el); continue; }
        if (prefs.text === 100) {
          if (info.value) el.style.setProperty('font-size',info.value,info.priority);
          else el.style.removeProperty('font-size');
        } else el.style.setProperty('font-size',(info.pixels*prefs.text/100)+'px','important');
      }
      if (prefs.text === 100) original.clear();
    }
    function apply(save) {
      var stopOn = prefs.stopAnim === true;
      for (const key of ['contrast','links','motion']) {
        var on = prefs[key] === true;
        if (key === 'motion') on = on || stopOn;
        document.documentElement.classList.toggle('noam-a11y-'+key, on);
        root.querySelector('[data-pref="'+key+'"]').setAttribute('aria-pressed', String(prefs[key] === true));
      }
      document.documentElement.classList.toggle('nd-motion-off', stopOn);
      root.getElementById('stop-anim').setAttribute('aria-pressed', String(stopOn));
      setRafFrozen(stopOn);
      syncVideos(stopOn);
      root.getElementById('size').textContent = prefs.text+'%';
      root.getElementById('increase').disabled = prefs.text >= 150;
      root.getElementById('decrease').disabled = prefs.text <= 100;
      scaleText();
      if (astroShell && host.isConnected && !dialog.open) settleLauncher();
      if (save) {
        try {
          var stored = { text: prefs.text, contrast: prefs.contrast, links: prefs.links, motion: prefs.motion };
          if (prefs.stopAnimChosen) stored.stopAnim = stopOn;
          localStorage.setItem('noam-accessibility-v1', JSON.stringify(stored));
        } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('nd:motion-off', { detail: { off: stopOn } }));
    }
    root.getElementById('increase').addEventListener('click', () => { prefs.text = Math.min(150,prefs.text+10); apply(true); });
    root.getElementById('decrease').addEventListener('click', () => { prefs.text = Math.max(100,prefs.text-10); apply(true); });
    root.querySelectorAll('[data-pref]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.pref; prefs[key] = !prefs[key]; apply(true);
    }));
    root.getElementById('stop-anim').addEventListener('click', () => {
      prefs.stopAnim = prefs.stopAnim !== true;
      prefs.stopAnimChosen = true;
      apply(true);
    });
    root.getElementById('reset').addEventListener('click', () => {
      prefs = { ...defaults, stopAnim: reduceQuery.matches, stopAnimChosen: false };
      apply(true);
    });
    reduceQuery.addEventListener('change', () => {
      if (prefs.stopAnimChosen) return;
      prefs.stopAnim = reduceQuery.matches;
      apply(false);
    });
    let scheduled = false;
    new MutationObserver(() => {
      if (prefs.text === 100 || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; scaleText(); });
    }).observe(document.body,{childList:true,subtree:true});
    apply(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
