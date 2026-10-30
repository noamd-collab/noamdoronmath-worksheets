// @ts-nocheck
import { LoopHelpers } from '../loopHelpers';

export const FILM = {
  slug: 'distributive-area-model-grade-4',
  duration: 13,
  hold: 10.5,
  viewBox: '0 0 560 420',
  top: { text: 'חוק הפילוג: כופלים כל חלק בנפרד ומחברים', ltr: false },
  ariaLabel: 'מודל שטחים המדגים את חוק הפילוג: מלבן 12 על 4 מחולק ל-10 על 4 ועוד 2 על 4, סכום השטחים 40 ועוד 8 שווה 48.',
  svgMarkup: `
    <rect data-el="fL" class="cl-fill-a" x="100" y="90" width="300" height="120" rx="3" style="opacity:0"/>
    <g data-el="rG" style="opacity:0">
      <rect x="400" y="90" width="60" height="120" class="cl-fill-c" rx="3"/>
      <line x1="430" y1="90" x2="430" y2="210" class="cl-grid"/>
      <line x1="400" y1="120" x2="460" y2="120" class="cl-grid"/>
      <line x1="400" y1="150" x2="460" y2="150" class="cl-grid"/>
      <line x1="400" y1="180" x2="460" y2="180" class="cl-grid"/>
      <rect x="400" y="90" width="60" height="120" fill="none" stroke="#22305a" stroke-width="2.5" rx="3"/>
    </g>
    <g data-el="mR" style="opacity:0">
      <rect x="100" y="90" width="360" height="120" fill="none" stroke="#22305a" stroke-width="2.5" rx="3"/>
      <line x1="130" y1="90" x2="130" y2="210" class="cl-grid"/>
      <line x1="160" y1="90" x2="160" y2="210" class="cl-grid"/>
      <line x1="190" y1="90" x2="190" y2="210" class="cl-grid"/>
      <line x1="220" y1="90" x2="220" y2="210" class="cl-grid"/>
      <line x1="250" y1="90" x2="250" y2="210" class="cl-grid"/>
      <line x1="280" y1="90" x2="280" y2="210" class="cl-grid"/>
      <line x1="310" y1="90" x2="310" y2="210" class="cl-grid"/>
      <line x1="340" y1="90" x2="340" y2="210" class="cl-grid"/>
      <line x1="370" y1="90" x2="370" y2="210" class="cl-grid"/>
      <line x1="400" y1="90" x2="400" y2="210" class="cl-grid"/>
      <line x1="430" y1="90" x2="430" y2="210" class="cl-grid"/>
      <line x1="100" y1="120" x2="460" y2="120" class="cl-grid"/>
      <line x1="100" y1="150" x2="460" y2="150" class="cl-grid"/>
      <line x1="100" y1="180" x2="460" y2="180" class="cl-grid"/>
    </g>
    <line data-el="cut" class="cl-dash-strong" x1="400" y1="84" x2="400" y2="216" stroke="#ea580c" stroke-width="2.5" style="opacity:0"/>
    <text data-el="w12" class="cl-t cl-num" x="280" y="72" text-anchor="middle" style="font-size:36px;opacity:0">12</text>
    <text data-el="h4" class="cl-t cl-num" x="480" y="158" text-anchor="start" style="font-size:36px;opacity:0">4</text>
    <text data-el="w10" class="cl-t cl-num" x="250" y="72" text-anchor="middle" style="font-size:34px;opacity:0">10</text>
    <text data-el="w2" class="cl-t cl-num" x="430" y="72" text-anchor="middle" style="font-size:34px;opacity:0">2</text>
    <text data-el="a40" class="cl-t cl-num" x="250" y="160" text-anchor="middle" style="font-size:44px;opacity:0">40</text>
    <line data-el="ldr" x1="430" y1="214" x2="430" y2="236" stroke="#22305a" stroke-width="1.5" style="opacity:0"/>
    <text data-el="a8" class="cl-t cl-num" x="430" y="268" text-anchor="middle" style="font-size:40px;opacity:0">8</text>
    <text data-el="eqA" class="cl-t cl-num" x="280" y="320" text-anchor="middle" style="font-size:32px;opacity:0">10 × 4 = 40</text>
    <text data-el="eqB" class="cl-t cl-num" x="280" y="360" text-anchor="middle" style="font-size:32px;opacity:0">2 × 4 = 8</text>
    <text data-el="eqC" class="cl-t cl-num" x="280" y="340" text-anchor="middle" style="font-size:38px;fill:#2e9d57;opacity:0">40 + 8 = 48</text>
    <text data-el="res" class="cl-t cl-num" x="280" y="405" text-anchor="middle" style="font-size:48px;fill:#2e9d57;opacity:0">48</text>
  `,
  formulaHTML: `<p class="concept-loop__formula cl-num" dir="ltr"><span data-fx="0">12 × 4</span><span data-fx="1">= (10 + 2) × 4</span><span data-fx="2">= 10×4 + 2×4</span><span data-fx="3">= 40 + 8 = 48</span><span data-fx="4" class="cl-check" aria-hidden="true">✓</span></p>`,
  render(root, t) {
    const { ph, op, q, qa, shift, r2 } = LoopHelpers;

    // Global fade for clean loop seam — everything fully hidden at t=0 and t=13
    const fade = 1 - ph(t, 11.5, 12.5);

    // --- Phase 1: Rectangle with grid + dimensions ---
    const mR = q(root, 'mR');
    if (mR) op(mR, ph(t, 0.2, 1.2) * fade);

    const dimO = ph(t, 1.0, 1.5) * (1 - ph(t, 2.5, 2.9)) * fade;
    op(q(root, 'w12'), dimO);
    op(q(root, 'h4'), dimO);

    // --- Phase 2: Cut line + fills + part widths ---
    const cutEl = q(root, 'cut');
    if (cutEl) {
      const cp = ph(t, 2.5, 3.2);
      op(cutEl, cp * fade);
    }

    const fillO = ph(t, 3.0, 3.5) * fade;
    op(q(root, 'fL'), fillO);
    op(q(root, 'rG'), fillO);

    const pwO = ph(t, 3.2, 3.7) * fade;
    op(q(root, 'w10'), pwO);
    op(q(root, 'w2'), pwO);

    // Split animation: right part slides out then back in
    const sp = ph(t, 3.5, 4.2) - ph(t, 8.5, 9.3);
    const dx = r2(sp * 30);
    shift(q(root, 'rG'), dx, 0);
    shift(q(root, 'w2'), dx, 0);
    shift(q(root, 'a8'), dx, 0);
    shift(q(root, 'ldr'), dx, 0);

    // --- Phase 3: Area labels + equations ---
    const areaO = ph(t, 4.5, 5.0) * fade;
    op(q(root, 'a40'), areaO);
    op(q(root, 'a8'), areaO);
    op(q(root, 'ldr'), areaO);

    const eqAO = ph(t, 5.2, 5.7) * (1 - ph(t, 7.5, 8.0)) * fade;
    op(q(root, 'eqA'), eqAO);

    const eqBO = ph(t, 5.8, 6.3) * (1 - ph(t, 7.5, 8.0)) * fade;
    op(q(root, 'eqB'), eqBO);

    // --- Phase 4: Merge + final sum + result ---
    const eqCO = ph(t, 9.3, 9.8) * fade;
    op(q(root, 'eqC'), eqCO);

    const resO = ph(t, 9.8, 10.3) * fade;
    op(q(root, 'res'), resO);

    // --- Formula chunks ---
    const fxs = qa(root, '[data-fx]');
    if (fxs[0]) op(fxs[0], ph(t, 1.0, 1.5) * fade);
    if (fxs[1]) op(fxs[1], ph(t, 3.2, 3.7) * fade);
    if (fxs[2]) op(fxs[2], ph(t, 5.5, 6.0) * fade);
    if (fxs[3]) op(fxs[3], ph(t, 9.3, 9.8) * fade);
    if (fxs[4]) op(fxs[4], ph(t, 10.0, 10.5) * fade);
  }
};
