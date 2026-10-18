window.FILM = {
  slug: 'measurement-geometry-synthesis-grade-6',
  duration: 15,
  hold: 12.0,
  viewBox: '0 0 560 450',
  top: { text: 'מה שטח הצורה?', ltr: false },
  ariaLabel: 'חישוב שטח צורת L על ידי השלמה למלבן שלם והחסרת הפינה החסרה',
  svgMarkup: `
    <path data-el="lShape" d="M150,80 L330,80 L330,170 L450,170 L450,260 L150,260 Z" fill="none" stroke="#22305a" stroke-width="2.5" stroke-linejoin="round"/>

    <rect data-el="dashRect" x="330" y="80" width="120" height="90" fill="none" stroke="#ea580c" stroke-width="2" stroke-dasharray="8 6" rx="2" style="opacity:0"/>

    <rect data-el="cutout" x="330" y="80" width="120" height="90" fill="rgba(234,88,12,.35)" stroke="#ea580c" stroke-width="2.5" rx="2" style="opacity:0"/>

    <line data-el="dimBot" x1="150" y1="278" x2="450" y2="278" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimBotL" x1="150" y1="272" x2="150" y2="284" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimBotR" x1="450" y1="272" x2="450" y2="284" class="cl-line-thin" style="opacity:0"/>
    <text data-el="lblBot" class="cl-t cl-num cl-rtl" x="300" y="312" text-anchor="middle" style="font-size:32px;opacity:0">10 ס״מ</text>

    <line data-el="dimLeft" x1="132" y1="80" x2="132" y2="260" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimLeftT" x1="126" y1="80" x2="138" y2="80" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimLeftB" x1="126" y1="260" x2="138" y2="260" class="cl-line-thin" style="opacity:0"/>
    <text data-el="lblLeft" class="cl-t cl-num cl-rtl" x="118" y="176" text-anchor="start" style="font-size:32px;opacity:0">6 ס״מ</text>

    <line data-el="dimCutW" x1="330" y1="64" x2="450" y2="64" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimCutWL" x1="330" y1="58" x2="330" y2="70" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimCutWR" x1="450" y1="58" x2="450" y2="70" class="cl-line-thin" style="opacity:0"/>
    <text data-el="lblCutW" class="cl-t cl-num cl-rtl" x="390" y="52" text-anchor="middle" style="font-size:32px;opacity:0">4 ס״מ</text>

    <line data-el="dimStep" x1="468" y1="170" x2="468" y2="260" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimStepT" x1="462" y1="170" x2="474" y2="170" class="cl-line-thin" style="opacity:0"/>
    <line data-el="dimStepB" x1="462" y1="260" x2="474" y2="260" class="cl-line-thin" style="opacity:0"/>
    <text data-el="lblStep" class="cl-t cl-num cl-rtl" x="482" y="222" text-anchor="end" style="font-size:32px;opacity:0">3 ס״מ</text>

    <g data-el="row1" style="opacity:0">
      <circle cx="44" cy="355" r="18" fill="none" stroke="#22305a" stroke-width="2"/>
      <text class="cl-t cl-num" x="44" y="362" text-anchor="middle" style="font-size:30px">1</text>
      <rect x="74" y="337" width="170" height="36" rx="6" fill="rgba(30,136,229,.12)" stroke="#22305a" stroke-width="1.5"/>
      <text data-el="chip1" class="cl-t cl-num cl-rtl" x="159" y="362" text-anchor="middle" style="font-size:30px">60 סמ״ר</text>
    </g>

    <g data-el="row2" style="opacity:0">
      <circle cx="274" cy="355" r="18" fill="none" stroke="#22305a" stroke-width="2"/>
      <text class="cl-t cl-num" x="274" y="362" text-anchor="middle" style="font-size:30px">2</text>
      <rect x="304" y="337" width="170" height="36" rx="6" fill="rgba(234,88,12,.12)" stroke="#ea580c" stroke-width="1.5"/>
      <text data-el="chip2" class="cl-t cl-num cl-rtl" x="389" y="362" text-anchor="middle" style="font-size:30px">12 סמ״ר</text>
    </g>

    <g data-el="row3" style="opacity:0">
      <circle cx="44" cy="415" r="18" fill="none" stroke="#22305a" stroke-width="2"/>
      <text class="cl-t cl-num" x="44" y="422" text-anchor="middle" style="font-size:30px">3</text>
      <rect x="74" y="397" width="170" height="36" rx="6" fill="rgba(46,157,87,.12)" stroke="#2e9d57" stroke-width="2"/>
      <text data-el="chip3" class="cl-t cl-num cl-rtl" x="159" y="422" text-anchor="middle" style="font-size:32px">48 סמ״ר</text>
    </g>
  `,
  formulaHTML: `<p class="concept-loop__formula cl-num" dir="ltr"><span data-fx="0" style="display:block">10 × 6 = 60 סמ״ר</span><span data-fx="1" style="display:block">4 × 3 = 12 סמ״ר</span><span data-fx="2" style="display:block">60 − 12 = 48 סמ״ר</span><span data-fx="3" class="cl-check" aria-hidden="true">✓</span></p>`,

  render(root, t) {
    const { ph, op, q, qa } = LoopHelpers;
    const D = 15;

    // Master fade-out for clean loop seam (last 1.5 s)
    const fade = 1 - ph(t, 13.5, D);

    // ── L-shape outline always visible; blue fill fades in at Step 3 ──
    const lEl = q(root, 'lShape');
    if (lEl) {
      const fillP = ph(t, 9.5, 10.5);
      const fillAlpha = 0.4 * fillP * fade;
      lEl.setAttribute('fill', fillAlpha > 0.001 ? 'rgba(30,136,229,' + fillAlpha.toFixed(2) + ')' : 'none');
    }

    // ── Step 1: dashed rectangle completes the L to full 10×6 ──
    const dashOp = Math.max(0, (ph(t, 1.5, 2.2) - ph(t, 8.5, 9.5)) * fade);
    op(q(root, 'dashRect'), dashOp);

    // ── Step 2: orange cutout highlight ──
    const cutOp = Math.max(0, (ph(t, 5.0, 5.7) - ph(t, 8.5, 9.5)) * fade);
    op(q(root, 'cutout'), cutOp);

    // ── Dimension labels ──
    const dimIn = ph(t, 0.3, 1.0);
    const dimOut = ph(t, 12.5, 13.5);
    const dimOp = Math.max(0, (dimIn - dimOut) * fade);
    ['dimBot','dimBotL','dimBotR','lblBot',
     'dimLeft','dimLeftT','dimLeftB','lblLeft',
     'dimCutW','dimCutWL','dimCutWR','lblCutW',
     'dimStep','dimStepT','dimStepB','lblStep'
    ].forEach(function(id) { op(q(root, id), dimOp); });

    // ── Step badges & result chips ──
    // row1 fades out around t=7.5–8.5 so it is gone before row3 appears
    const r1 = Math.max(0, (ph(t, 3.0, 3.6) - ph(t, 7.5, 8.5)) * fade);
    op(q(root, 'row1'), r1);

    // row2 fades out around t=11.0–11.8 so only row3 remains at hold
    const r2 = Math.max(0, (ph(t, 6.5, 7.1) - ph(t, 11.0, 11.8)) * fade);
    op(q(root, 'row2'), r2);

    // row3 stays until master fade-out
    const r3 = Math.max(0, (ph(t, 10.0, 10.6) - ph(t, 12.5, 13.5)) * fade);
    op(q(root, 'row3'), r3);

    // Chip 3 text turns green ONLY when revealed (Trap A: inline fill)
    var chip3El = q(root, 'chip3');
    if (chip3El) {
      chip3El.style.fill = r3 > 0.5 ? '#2e9d57' : '#22305a';
    }

    // ── Formula chunks ──
    var fxs = qa(root, '[data-fx]');
    if (fxs[0]) op(fxs[0], Math.max(0, (ph(t, 3.6, 4.2) - ph(t, 12.5, 13.5)) * fade));
    if (fxs[1]) op(fxs[1], Math.max(0, (ph(t, 7.1, 7.7) - ph(t, 12.5, 13.5)) * fade));
    if (fxs[2]) op(fxs[2], Math.max(0, (ph(t, 10.6, 11.2) - ph(t, 12.5, 13.5)) * fade));
    if (fxs[3]) op(fxs[3], Math.max(0, (ph(t, 11.5, 12.0) - ph(t, 12.5, 13.5)) * fade));
  }
};
