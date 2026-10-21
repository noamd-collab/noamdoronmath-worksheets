// @ts-nocheck
import { LoopHelpers } from '../loopHelpers';

export const FILM = {
  slug: 'fraction-division-meaning-grade-6',
  duration: 15,
  hold: 13,
  viewBox: '0 0 560 420',
  top: { text: 'כמה פעמים נכנס החלק?', ltr: false },
  ariaLabel: 'חילוק שברים כמדידה: כמה פעמים נכנס החלק בשלם. שלושה רבעים חלקי רבע שווה 3, ו-2 חלקי חצי שווה 4.',
  svgMarkup: `
    <rect data-el="barA" x="80" y="70" width="200" height="44" rx="5" fill="rgba(30,136,229,.12)" stroke="#22305a" stroke-width="2" style="opacity:0"/>
    <line data-el="tA1" class="cl-line-thin" x1="130" y1="70" x2="130" y2="114" style="opacity:0"/>
    <line data-el="tA2" class="cl-line-thin" x1="180" y1="70" x2="180" y2="114" style="opacity:0"/>
    <line data-el="tA3" class="cl-line-thin" x1="230" y1="70" x2="230" y2="114" style="opacity:0"/>
    <rect data-el="qA1" x="80" y="70" width="50" height="44" rx="3" fill="rgba(30,136,229,.4)" style="opacity:0"/>
    <rect data-el="qA2" x="130" y="70" width="50" height="44" rx="3" fill="rgba(30,136,229,.4)" style="opacity:0"/>
    <rect data-el="qA3" x="180" y="70" width="50" height="44" rx="3" fill="rgba(30,136,229,.4)" style="opacity:0"/>
    <text class="cl-t cl-num" data-el="cA1" x="105" y="56" text-anchor="middle" style="font-size:34px;opacity:0">1</text>
    <text class="cl-t cl-num" data-el="cA2" x="155" y="56" text-anchor="middle" style="font-size:34px;opacity:0">2</text>
    <text class="cl-t cl-num" data-el="cA3" x="205" y="56" text-anchor="middle" style="font-size:34px;opacity:0">3</text>
    <g data-el="fA34" style="opacity:0">
      <text class="cl-t cl-num" x="38" y="82" text-anchor="middle" style="font-size:30px">3</text>
      <line class="cl-line-thin" x1="24" y1="88" x2="52" y2="88"/>
      <text class="cl-t cl-num" x="38" y="108" text-anchor="middle" style="font-size:30px">4</text>
    </g>
    <g data-el="fA14" style="opacity:0">
      <text class="cl-t cl-num" x="320" y="82" text-anchor="middle" style="font-size:30px">1</text>
      <line class="cl-line-thin" x1="306" y1="88" x2="334" y2="88"/>
      <text class="cl-t cl-num" x="320" y="108" text-anchor="middle" style="font-size:30px">4</text>
    </g>
    <text class="cl-t cl-num" data-el="rA" x="420" y="102" text-anchor="middle" style="font-size:48px;opacity:0">= 3</text>

    <rect data-el="barB1" x="80" y="240" width="200" height="44" rx="5" fill="rgba(124,58,237,.12)" stroke="#22305a" stroke-width="2" style="opacity:0"/>
    <rect data-el="barB2" x="280" y="240" width="200" height="44" rx="5" fill="rgba(124,58,237,.12)" stroke="#22305a" stroke-width="2" style="opacity:0"/>
    <line data-el="tB1" class="cl-line-thin" x1="180" y1="240" x2="180" y2="284" style="opacity:0"/>
    <line data-el="tB2" class="cl-line-thin" x1="280" y1="240" x2="280" y2="284" style="opacity:0"/>
    <line data-el="tB3" class="cl-line-thin" x1="380" y1="240" x2="380" y2="284" style="opacity:0"/>
    <rect data-el="hB1" x="80" y="240" width="100" height="44" rx="3" fill="rgba(124,58,237,.35)" style="opacity:0"/>
    <rect data-el="hB2" x="180" y="240" width="100" height="44" rx="3" fill="rgba(124,58,237,.35)" style="opacity:0"/>
    <rect data-el="hB3" x="280" y="240" width="100" height="44" rx="3" fill="rgba(124,58,237,.35)" style="opacity:0"/>
    <rect data-el="hB4" x="380" y="240" width="100" height="44" rx="3" fill="rgba(124,58,237,.35)" style="opacity:0"/>
    <text class="cl-t cl-num" data-el="cB1" x="130" y="226" text-anchor="middle" style="font-size:34px;opacity:0">1</text>
    <text class="cl-t cl-num" data-el="cB2" x="230" y="226" text-anchor="middle" style="font-size:34px;opacity:0">2</text>
    <text class="cl-t cl-num" data-el="cB3" x="330" y="226" text-anchor="middle" style="font-size:34px;opacity:0">3</text>
    <text class="cl-t cl-num" data-el="cB4" x="430" y="226" text-anchor="middle" style="font-size:34px;opacity:0">4</text>
    <text class="cl-t cl-num" data-el="lB2" x="38" y="272" text-anchor="middle" style="font-size:36px;opacity:0">2</text>
    <g data-el="fB12" style="opacity:0">
      <text class="cl-t cl-num" x="520" y="252" text-anchor="middle" style="font-size:30px">1</text>
      <line class="cl-line-thin" x1="506" y1="258" x2="534" y2="258"/>
      <text class="cl-t cl-num" x="520" y="278" text-anchor="middle" style="font-size:30px">2</text>
    </g>
    <text class="cl-t cl-num" data-el="rB" x="280" y="340" text-anchor="middle" style="font-size:48px;opacity:0">= 4</text>
  `,
  formulaHTML: `<p class="concept-loop__formula cl-num" dir="ltr"><span data-fx="0"><span class="cl-frac"><span class="cl-frac__n">3</span><span class="cl-frac__d">4</span></span>&thinsp;:&thinsp;<span class="cl-frac"><span class="cl-frac__n">1</span><span class="cl-frac__d">4</span></span>&thinsp;=&thinsp;<span class="cl-ok">3</span></span><span data-fx="1">&ensp;2&thinsp;:&thinsp;<span class="cl-frac"><span class="cl-frac__n">1</span><span class="cl-frac__d">2</span></span>&thinsp;=&thinsp;<span class="cl-ok">4</span></span><span data-fx="2" class="cl-check" aria-hidden="true">✓</span></p>`,
  render(root, t) {
    const { ph, op, q, qa } = LoopHelpers;

    // Global fade for clean loop seam — everything hidden at t=0 and t=15
    const fadeIn = ph(t, 0, 0.3);
    const fadeOut = 1 - ph(t, 13.5, 14.5);
    const fade = fadeIn * fadeOut;

    // ── Example A: 3/4 : 1/4 = 3 ──────────────────────
    // Unit length = 200 (whole bar). Quarters = 50 each.
    const aVis = ph(t, 0.2, 0.8) * (1 - ph(t, 6.5, 7.5)) * fade;

    op(q(root, 'barA'), aVis);
    op(q(root, 'tA1'), aVis * 0.5);
    op(q(root, 'tA2'), aVis * 0.5);
    op(q(root, 'tA3'), aVis * 0.5);

    op(q(root, 'fA34'), ph(t, 0.3, 0.8) * aVis);
    op(q(root, 'fA14'), ph(t, 0.6, 1.1) * aVis);

    // All three quarters shaded together to represent 3/4
    const qAvis = ph(t, 1.0, 1.5) * aVis;
    op(q(root, 'qA1'), qAvis);
    op(q(root, 'qA2'), qAvis);
    op(q(root, 'qA3'), qAvis);

    // Counting numbers appear one by one
    op(q(root, 'cA1'), ph(t, 1.8, 2.2) * aVis);
    op(q(root, 'cA2'), ph(t, 2.5, 2.9) * aVis);
    op(q(root, 'cA3'), ph(t, 3.2, 3.6) * aVis);

    // Result "= 3" in green via inline style (CSS trap A fix)
    const rAEl = q(root, 'rA');
    if (rAEl) {
      const rAp = ph(t, 3.9, 4.4) * aVis;
      op(rAEl, rAp);
      rAEl.style.fill = rAp > 0.01 ? '#2e9d57' : '';
    }

    // ── Example B: 2 : 1/2 = 4 ────────────────────────
    // Same unit length = 200 per whole. Two wholes = 400 total. Halves = 100 each.
    const bIn = ph(t, 6.5, 7.5);
    const bVis = bIn * fade;

    op(q(root, 'barB1'), bVis);
    op(q(root, 'barB2'), bVis);
    op(q(root, 'tB1'), bVis * 0.5);
    op(q(root, 'tB2'), bVis * 0.5);
    op(q(root, 'tB3'), bVis * 0.5);

    op(q(root, 'lB2'), ph(t, 7.2, 7.7) * bVis);
    op(q(root, 'fB12'), ph(t, 7.5, 8.0) * bVis);

    // Halves fill one by one with counting numbers
    op(q(root, 'hB1'), ph(t, 8.2, 8.6) * bVis);
    op(q(root, 'cB1'), ph(t, 8.4, 8.8) * bVis);

    op(q(root, 'hB2'), ph(t, 8.9, 9.3) * bVis);
    op(q(root, 'cB2'), ph(t, 9.1, 9.5) * bVis);

    op(q(root, 'hB3'), ph(t, 9.6, 10.0) * bVis);
    op(q(root, 'cB3'), ph(t, 9.8, 10.2) * bVis);

    op(q(root, 'hB4'), ph(t, 10.3, 10.7) * bVis);
    op(q(root, 'cB4'), ph(t, 10.5, 10.9) * bVis);

    // Result "= 4" in green via inline style (CSS trap A fix)
    const rBEl = q(root, 'rB');
    if (rBEl) {
      const rBp = ph(t, 11.1, 11.6) * bVis;
      op(rBEl, rBp);
      rBEl.style.fill = rBp > 0.01 ? '#2e9d57' : '';
    }

    // ── Formula row ───────────────────────────────────
    const fxs = qa(root, '[data-fx]');
    if (fxs[0]) op(fxs[0], ph(t, 4.4, 4.9) * fade);
    if (fxs[1]) op(fxs[1], ph(t, 11.6, 12.1) * fade);
    if (fxs[2]) op(fxs[2], ph(t, 12.3, 12.7) * fade);
  }
};
