window.FILM = {
  slug: 'grade-4-summary',
  duration: 15,
  hold: 11.5,
  viewBox: '0 0 560 420',
  top: { text: '2,847 + 1,675 = ?', ltr: true },
  ariaLabel: 'חיבור 2,847 ועוד 1,675 בטבלת ערך מיקומי עם הערכה ובדיקה, שווה 4,522',
  svgMarkup: `
    <rect class="cl-line" x="60" y="30" width="440" height="290" rx="6" fill="white"/>
    <line class="cl-line-thin" x1="170" y1="30" x2="170" y2="320"/>
    <line class="cl-line-thin" x1="280" y1="30" x2="280" y2="320"/>
    <line class="cl-line-thin" x1="390" y1="30" x2="390" y2="320"/>
    <line class="cl-line" x1="60" y1="80" x2="500" y2="80"/>
    <line class="cl-line" x1="60" y1="230" x2="500" y2="230"/>

    <text class="cl-t" data-el="hTh" x="115" y="63" text-anchor="middle" style="font-size:30px;opacity:0">אלפים</text>
    <text class="cl-t" data-el="hHu" x="225" y="63" text-anchor="middle" style="font-size:30px;opacity:0">מאות</text>
    <text class="cl-t" data-el="hTe" x="335" y="63" text-anchor="middle" style="font-size:30px;opacity:0">עשרות</text>
    <text class="cl-t" data-el="hOn" x="445" y="63" text-anchor="middle" style="font-size:30px;opacity:0">יחידות</text>

    <text class="cl-t cl-num" data-el="d2" x="115" y="145" text-anchor="middle" style="font-size:40px;opacity:0">2</text>
    <text class="cl-t cl-num" data-el="d8" x="225" y="145" text-anchor="middle" style="font-size:40px;opacity:0">8</text>
    <text class="cl-t cl-num" data-el="d4" x="335" y="145" text-anchor="middle" style="font-size:40px;opacity:0">4</text>
    <text class="cl-t cl-num" data-el="d7" x="445" y="145" text-anchor="middle" style="font-size:40px;opacity:0">7</text>

    <text class="cl-t cl-num" data-el="plus" x="78" y="200" text-anchor="middle" style="font-size:36px;opacity:0">+</text>
    <text class="cl-t cl-num" data-el="d1b" x="115" y="200" text-anchor="middle" style="font-size:40px;opacity:0">1</text>
    <text class="cl-t cl-num" data-el="d6" x="225" y="200" text-anchor="middle" style="font-size:40px;opacity:0">6</text>
    <text class="cl-t cl-num" data-el="d7b" x="335" y="200" text-anchor="middle" style="font-size:40px;opacity:0">7</text>
    <text class="cl-t cl-num" data-el="d5" x="445" y="200" text-anchor="middle" style="font-size:40px;opacity:0">5</text>

    <rect class="cl-ol" data-el="hlOn" x="392" y="32" width="106" height="286" rx="4" style="opacity:0"/>
    <rect class="cl-ol" data-el="hlTe" x="282" y="32" width="106" height="286" rx="4" style="opacity:0"/>
    <rect class="cl-ol" data-el="hlHu" x="172" y="32" width="106" height="286" rx="4" style="opacity:0"/>
    <rect class="cl-ol" data-el="hlTh" x="62" y="32" width="106" height="286" rx="4" style="opacity:0"/>

    <text class="cl-t cl-num" data-el="cOn" x="335" y="108" text-anchor="middle" style="font-size:30px;opacity:0">1</text>
    <text class="cl-t cl-num" data-el="cTe" x="225" y="108" text-anchor="middle" style="font-size:30px;opacity:0">1</text>
    <text class="cl-t cl-num" data-el="cHu" x="115" y="108" text-anchor="middle" style="font-size:30px;opacity:0">1</text>

    <text class="cl-t cl-num" data-el="rOn" x="445" y="278" text-anchor="middle" style="font-size:40px;opacity:0">2</text>
    <text class="cl-t cl-num" data-el="rTe" x="335" y="278" text-anchor="middle" style="font-size:40px;opacity:0">2</text>
    <text class="cl-t cl-num" data-el="rHu" x="225" y="278" text-anchor="middle" style="font-size:40px;opacity:0">5</text>
    <text class="cl-t cl-num" data-el="rTh" x="115" y="278" text-anchor="middle" style="font-size:40px;opacity:0">4</text>

    <text class="cl-t cl-num" data-el="est" x="280" y="355" text-anchor="middle" style="font-size:32px;opacity:0">≈ 4,500</text>
    <text class="cl-t cl-num" data-el="chk" x="280" y="395" text-anchor="middle" style="font-size:30px;opacity:0">4,522 ≈ 4,500 ✓</text>
  `,
  formulaHTML: `<p class="concept-loop__formula cl-num" dir="ltr"><span data-fx="0">≈ 2,800 + 1,700</span><span data-fx="1">= 4,500</span><span data-fx="2">2,847 + 1,675</span><span data-fx="3">= 4,522</span><span data-fx="4" class="cl-check" aria-hidden="true">✓</span></p>`,
  render(root, t) {
    const { ph, op, q, qa } = LoopHelpers;
    const fade = 1 - ph(t, 13.5, 14.8);

    // Step 1: headers and digits appear
    const hdrs = ['hTh', 'hHu', 'hTe', 'hOn'];
    for (let i = 0; i < 4; i++) {
      op(q(root, hdrs[i]), ph(t, 0.3 + i * 0.15, 0.7 + i * 0.15) * fade);
    }
    const r1 = ['d2', 'd8', 'd4', 'd7'];
    for (let i = 0; i < 4; i++) {
      op(q(root, r1[i]), ph(t, 1.0 + i * 0.15, 1.4 + i * 0.15) * fade);
    }
    const r2 = ['plus', 'd1b', 'd6', 'd7b', 'd5'];
    for (let i = 0; i < 5; i++) {
      op(q(root, r2[i]), ph(t, 1.7 + i * 0.12, 2.1 + i * 0.12) * fade);
    }

    // Step 2: estimation chip
    const estVis = ph(t, 2.8, 3.3) * (1 - ph(t, 10.0, 10.5));
    op(q(root, 'est'), Math.max(0, estVis) * fade);

    // Step 3: column-by-column addition right to left
    // Ones column (t: 3.8–5.0)
    op(q(root, 'hlOn'), ph(t, 3.8, 4.1) * (1 - ph(t, 4.7, 5.0)) * fade);
    op(q(root, 'rOn'), ph(t, 4.3, 4.7) * fade);
    op(q(root, 'cOn'), ph(t, 4.5, 4.9) * fade);

    // Tens column (t: 5.2–6.4)
    op(q(root, 'hlTe'), ph(t, 5.2, 5.5) * (1 - ph(t, 6.1, 6.4)) * fade);
    op(q(root, 'rTe'), ph(t, 5.7, 6.1) * fade);
    op(q(root, 'cTe'), ph(t, 5.9, 6.3) * fade);

    // Hundreds column (t: 6.6–7.8)
    op(q(root, 'hlHu'), ph(t, 6.6, 6.9) * (1 - ph(t, 7.5, 7.8)) * fade);
    op(q(root, 'rHu'), ph(t, 7.1, 7.5) * fade);
    op(q(root, 'cHu'), ph(t, 7.3, 7.7) * fade);

    // Thousands column (t: 8.0–9.2)
    op(q(root, 'hlTh'), ph(t, 8.0, 8.3) * (1 - ph(t, 8.9, 9.2)) * fade);
    op(q(root, 'rTh'), ph(t, 8.5, 8.9) * fade);

    // Step 4: check estimate (no green on SVG element — green only on formula result)
    op(q(root, 'chk'), ph(t, 10.2, 10.7) * fade);

    // Formula chunks
    const fxs = qa(root, '[data-fx]');
    if (fxs[0]) op(fxs[0], ph(t, 2.8, 3.3) * fade);
    if (fxs[1]) op(fxs[1], ph(t, 3.0, 3.5) * fade);
    if (fxs[2]) op(fxs[2], ph(t, 3.8, 4.2) * fade);
    if (fxs[3]) {
      const f3v = ph(t, 9.2, 9.7);
      op(fxs[3], f3v * fade);
      if (f3v > 0.5) {
        fxs[3].classList.add('cl-ok');
      } else {
        fxs[3].classList.remove('cl-ok');
      }
    }
    if (fxs[4]) op(fxs[4], ph(t, 10.5, 11.0) * fade);
  }
};
