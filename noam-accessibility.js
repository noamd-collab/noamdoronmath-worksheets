/* Shared accessibility preferences for Noam's Wix site and worksheet pages. */
(function () {
  'use strict';
  function init() {
    if (document.getElementById('noam-accessibility')) return;
    const defaults = { text: 100, contrast: false, links: false, motion: false };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefs = { ...defaults, motionChosen: false, stopAnim: false, stopAnimChosen: false };
    try {
      const saved = JSON.parse(localStorage.getItem('noam-accessibility-v1') || '{}');
      prefs.text = [100,110,120,130,140,150].includes(saved.text) ? saved.text : 100;
      for (const key of ['contrast','links','motion']) prefs[key] = saved[key] === true;
      prefs.motionChosen = saved.motionChosen === true || saved.motion === true;
      if (typeof saved.stopAnim === 'boolean') {
        prefs.stopAnim = saved.stopAnim;
        prefs.stopAnimChosen = true;
      }
    } catch (_) { /* Preferences still work when storage is unavailable. */ }

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
      @media print { #noam-accessibility { display:none!important; } }
    `;
    document.head.appendChild(style);
    const host = document.createElement('div');
    host.id = 'noam-accessibility';
    // Shadow DOM keeps site-wide button rules from changing the menu.
    host.style.cssText = 'position:fixed;right:14px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:10000;width:48px;height:48px;';
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
        /* Worksheet tools stay secondary to the question-level Ramzi controls. */
        :host-context(body.exact-viewer) #launch {
          width:44px; height:44px; padding:9px; border:1px solid #aab6c5;
          border-radius:12px; background:#fbfaf5; color:#1e605e; box-shadow:none;
        }
        :host-context(body.exact-viewer) #launch svg { width:24px; height:24px; }
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
        <button id="reset" type="button">איפוס הגדרות</button>
        <p>ההעדפות נשמרות בדפדפן עבור אתר זה. להגדלת דף העבודה עצמו השתמשו בסליידר הזום של הדף.</p>
      </dialog>
    `;
    document.body.appendChild(host);
    const dialog = root.getElementById('menu');
    const launch = root.getElementById('launch');
    launch.addEventListener('click', () => { dialog.showModal(); launch.setAttribute('aria-expanded','true'); root.getElementById('close').focus(); });
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
    function motionReduced() {
      return prefs.motionChosen ? prefs.motion : reducedMotion.matches;
    }
    function apply(save) {
      const reduceOn = motionReduced();
      const stopOn = prefs.stopAnim === true;
      document.documentElement.classList.toggle('nd-motion-enabled', prefs.motionChosen && !reduceOn && !stopOn);
      document.documentElement.classList.toggle('nd-motion-off', stopOn);
      for (const key of ['contrast','links','motion']) {
        const on = key === 'motion' ? reduceOn || stopOn : prefs[key];
        document.documentElement.classList.toggle('noam-a11y-'+key,on);
        root.querySelector('[data-pref="'+key+'"]').setAttribute('aria-pressed',String(key === 'motion' ? reduceOn : on));
      }
      root.getElementById('size').textContent = prefs.text+'%';
      root.getElementById('increase').disabled = prefs.text >= 150;
      root.getElementById('decrease').disabled = prefs.text <= 100;
      scaleText();
      if (save) try {
        const stored = { text:prefs.text, contrast:prefs.contrast, links:prefs.links, motion:prefs.motion, motionChosen:prefs.motionChosen };
        if (prefs.stopAnimChosen) stored.stopAnim = stopOn;
        localStorage.setItem('noam-accessibility-v1',JSON.stringify(stored));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('nd:motion-off', { detail: { off: reduceOn || stopOn } }));
    }
    root.getElementById('increase').addEventListener('click', () => { prefs.text = Math.min(150,prefs.text+10); apply(true); });
    root.getElementById('decrease').addEventListener('click', () => { prefs.text = Math.max(100,prefs.text-10); apply(true); });
    root.querySelectorAll('[data-pref]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.pref;
      if (key === 'motion') { prefs.motion = !motionReduced(); prefs.motionChosen = true; }
      else prefs[key] = !prefs[key];
      apply(true);
    }));
    root.getElementById('reset').addEventListener('click', () => { prefs = {...defaults, motionChosen:false, stopAnim:false, stopAnimChosen:false}; apply(true); });
    reducedMotion.addEventListener('change', () => apply(false));
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
