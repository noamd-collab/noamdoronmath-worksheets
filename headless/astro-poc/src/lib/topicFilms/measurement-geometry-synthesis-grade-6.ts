// @ts-nocheck
import { LoopHelpers } from '../loopHelpers';

export const FILM = {
  slug: 'measurement-geometry-synthesis-grade-6',
  duration: 16,
  hold: 13.0,
  viewBox: '0 0 560 450',
  top: { text: 'מה שטח הצורה?', ltr: false },
  ariaLabel: 'חישוב שטח צורת L על ידי השלמה למלבן שלם והחסרת הפינה החסרה, עם הדגמת יחידות שטח',
  svgMarkup: `
    <!-- Grid of unit squares (generated programmatically) -->
    <g id="grid-container">
      ${Array.from({length:60}, (_, i) => {
        const c = i % 10;
        const r = Math.floor(i / 10);
        return `<rect data-cell="${c},${r}" x="${150 + 30*c}" y="${80 + 30*r}" width="30" height="30" fill="none" stroke="#22305a" stroke-opacity="0.5" stroke-width="1.2"/>`;
      }).join('')}
    </g>

    <!-- L-shape outline (always visible) -->
    <path data-el="lShape" d="M150,80 L330,80 L330,170 L450,170 L450,260 L150,260 Z" fill="none" stroke="#22305a" stroke-width="2.5" stroke-linejoin="round"/>

    <!-- Dashed completion rectangle (Step 1) -->
    <rect data-el="dashRect" x="330" y="80" width="120" height="90" fill="none" stroke="#ea580c" stroke-width="2" stroke-dasharray="8 6" rx="2" style="opacity:0"/>

    <!-- Dimension lines and labels -->
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

    <!-- Step Badges & Chips -->
    <g data-el="row1" style="opacity:0">
      <circle cx="44" cy="355" r="18" fill="none" stroke="#22305a" stroke-width="2"/>
      <text class="cl-t cl-num" x="44" y="362" text-anchor="middle" style="font-size:30px">1</text>
      <rect x="74" y="337" width="170" height="36" rx="6" fill="rgba(30,136,229,.12)" stroke="#22305a" stroke-width="1.5"/>
      <text data-el="chip1" class="cl-t cl-num cl-rtl" x="159" y="362" text-anchor="middle" style="font-size:30px">0 סמ״ר</text>
    </g>

    <g data-el="row2" style="opacity:0">
      <circle cx="274" cy="355" r="18" fill="none" stroke="#22305a" stroke-width="2"/>
      <text class="cl-t cl-num" x="274" y="362" text-anchor="middle" style="font-size:30px">2</text>
      <rect x="304" y="337" width="170" height="36" rx="6" fill="rgba(234,88,12,.12)" stroke="#ea580c" stroke-width="1.5"/>
      <text data-el="chip2" class="cl-t cl-num cl-rtl" x="389" y="362" text-anchor="middle" style="font-size:30px">0 סמ״ר</text>
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
    const D = 16;

    // Master fade-out for clean loop seam (last 1.5 s)
    const fade = 1 - ph(t, 14.5, D);

    // ── Animate Unit Squares ──
    const cells = qa(root, '[data-cell]');
    
    // Timing constants
    const step1Start = 1.5;
    const step1End = 3.9; 
    const step2Start = 5.0;
    const step2End = 6.6; 
    const step3Start = 9.5;
    const step3End = 10.2;

    if (cells.length > 0) {
      cells.forEach(cell => {
        const coords = cell.getAttribute('data-cell').split(',');
        const c = parseInt(coords[0]);
        const r = parseInt(coords[1]);
        const isCorner = (c >= 6 && r <= 2);
        
        // --- Visibility Phase (Step 1) ---
        // Stagger by column index i = c*6 + r
        const i = c * 6 + r;
        const cellStart = step1Start + (i / 60) * 2.4; 
        
        // Calculate opacity unconditionally using master fade
        let cellOp = ph(t, cellStart, cellStart + 0.25) * fade;
        op(cell, cellOp);

        // Only calculate fill if visible enough to matter
        if (cellOp > 0.01) {
            // --- Coloring Logic ---
            let fill = "none"; 

            // Step 2: Highlight Corner (Orange)
            let cornerIdx = -1;
            if (isCorner) {
                cornerIdx = (c - 6) * 3 + r; // 0..11
            }

            if (t > step2Start && t < step3Start) {
                if (isCorner) {
                    const hStart = step2Start + (cornerIdx / 12) * 1.6;
                    if (t > hStart) {
                        fill = "rgba(234,88,12,.35)"; // Orange
                    }
                }
            }

            // Step 3: Remove Corner, Fill Rest Blue
            if (t > step3Start) {
                const localP = ph(t, step3Start, step3End); // Fast transition
                
                if (isCorner) {
                    // Fade out orange
                    const opacity = 1 - localP;
                    if (opacity > 0) {
                        fill = `rgba(234,88,12,${0.35 * opacity})`;
                    } else {
                        fill = "none";
                    }
                } else {
                    // Turn Blue
                    fill = `rgba(30,136,229,${0.4 * localP})`;
                }
            }

            cell.setAttribute("fill", fill);
        } else {
             cell.setAttribute("fill", "none");
        }
      });
    }

    // ── Update Chip Texts Dynamically ──
    
    // Chip 1: Counts 0 -> 60 during Step 1 sweep
    const chip1El = q(root, 'chip1');
    if (chip1El) {
        let count1 = 0;
        if (t >= step1Start && t <= 14.5) {
            // Count based on time progress to match visual sweep
            const p = (t - step1Start) / 2.4;
            count1 = Math.min(60, Math.max(0, Math.floor(p * 60) + 1));
            if (t < step1Start) count1 = 0;
        }
        chip1El.textContent = count1 + ' סמ״ר';
    }

    // Chip 2: Counts 0 -> 12 during Step 2 highlight
    const chip2El = q(root, 'chip2');
    if (chip2El) {
        let count2 = 0;
        if (t >= step2Start && t <= 14.5) {
            const p = (t - step2Start) / 1.6;
            count2 = Math.min(12, Math.max(0, Math.floor(p * 12) + 1));
            if (t < step2Start) count2 = 0;
        }
        chip2El.textContent = count2 + ' סמ״ר';
    }

    // Chip 3: Shows 48 in Green during Step 3
    const chip3El = q(root, 'chip3');
    if (chip3El) {
        // Text is static '48 סמ״ר' in markup
        // Toggle green fill
        const r3Op = ph(t, 10.5, 11.0) * (1 - ph(t, 13.9, 14.5));
        chip3El.style.fill = (r3Op > 0.5) ? '#2e9d57' : '#22305a';
    }


    // ── Step 1: dashed rectangle completes the L to full 10×6 ──
    const dashOp = Math.max(0, (ph(t, 1.0, 1.5) - ph(t, 3.5, 4.0)) * fade);
    op(q(root, 'dashRect'), dashOp);

    // ── Dimension labels ──
    // Show early, stay until fade out
    const dimIn = ph(t, 0.5, 1.0);
    const dimOp = Math.max(0, dimIn * fade);
    ['dimBot','dimBotL','dimBotR','lblBot',
     'dimLeft','dimLeftT','dimLeftB','lblLeft',
     'dimCutW','dimCutWL','dimCutWR','lblCutW',
     'dimStep','dimStepT','dimStepB','lblStep'
    ].forEach(function(id) { op(q(root, id), dimOp); });

    // ── Step badges & result chips visibility ──
    
    // Row 1: Visible during Step 1 counting
    const r1 = Math.max(0, (ph(t, 1.5, 2.0) - ph(t, 7.5, 8.0)) * fade);
    op(q(root, 'row1'), r1);

    // Row 2: Visible during Step 2 highlighting
    const r2 = Math.max(0, (ph(t, 5.0, 5.4) - ph(t, 11.0, 11.5)) * fade);
    op(q(root, 'row2'), r2);

    // Row 3: Visible from Step 3 onwards, dedicated fade out before master fade
    const r3 = Math.max(0, (ph(t, 10.5, 11.0) - ph(t, 13.9, 14.5)) * fade);
    op(q(root, 'row3'), r3);

    // ── Formula chunks ──
    var fxs = qa(root, '[data-fx]');
    // Chunk 0: Appears after Step 1 count finishes
    if (fxs[0]) op(fxs[0], Math.max(0, (ph(t, 4.0, 4.4) * fade)));
    // Chunk 1: Appears after Step 2 count finishes
    if (fxs[1]) op(fxs[1], Math.max(0, (ph(t, 6.8, 7.2) * fade)));
    // Chunk 2: Appears after Step 3 result is shown
    if (fxs[2]) op(fxs[2], Math.max(0, (ph(t, 11.0, 11.5) * fade)));
    // Checkmark: Appears last
    if (fxs[3]) op(fxs[3], Math.max(0, (ph(t, 11.8, 12.2) * fade)));
  }
};
