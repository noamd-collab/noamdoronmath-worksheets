/**
 * Link peek tooltips — hover/focus only (@media hover:hover).
 * Client-built; not in SSR HTML. Design handoff §6.8.
 */
import { GRADE_INFO, PK, PKS, type PeekEntry } from './linkPeekData';
import { motionAllowed, readMotionMode } from './motionMode';

const UNIT = 12;
const CARD_W = 300;
const CARD_H = 262;

function gradeEntry(n: number): PeekEntry {
  const mid = n >= 7;
  return [
    `כיתה ${['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳'][n] || n}`,
    mid ? 'חטיבה' : 'יסודי',
    GRADE_INFO[n] || 'דפי עבודה ותרגול',
    mid ? PK.mid[3] : PK.elem[3],
    mid,
  ];
}

function resolveEntry(key: string): PeekEntry | null {
  if (key.startsWith('g:')) {
    const n = Number(key.slice(2));
    if (n >= 1 && n <= 9) return gradeEntry(n);
  }
  return PK[key] || null;
}

function buildCard(entry: PeekEntry, key: string): HTMLElement {
  const [title, tag, desc, blocks, ai] = entry;
  const card = document.createElement('div');
  card.className = 'link-peek';
  card.setAttribute('role', 'tooltip');
  card.setAttribute('aria-hidden', 'true');

  const shadow = document.createElement('div');
  shadow.className = 'link-peek__page';
  for (const [x, y, w, h, kind] of blocks) {
    const b = document.createElement('span');
    b.className = 'link-peek__block';
    b.style.cssText = `left:${x * UNIT}px;top:${y * UNIT}px;width:${w * UNIT}px;height:${h * UNIT}px;${PKS[kind] || PKS.c}`;
    shadow.appendChild(b);
  }
  card.appendChild(shadow);

  const meta = document.createElement('div');
  meta.className = 'link-peek__meta';
  meta.innerHTML = `<strong class="link-peek__title"></strong><span class="link-peek__tag"></span><p class="link-peek__desc"></p>`;
  meta.querySelector('.link-peek__title')!.textContent = title;
  meta.querySelector('.link-peek__tag')!.textContent = tag;
  meta.querySelector('.link-peek__desc')!.textContent = desc;
  card.appendChild(meta);

  if (ai || key === 'mid' || (key.startsWith('g:') && Number(key.slice(2)) >= 7)) {
    const row = document.createElement('div');
    row.className = 'link-peek__ai';
    row.innerHTML =
      '<span class="link-peek__ai-ring" aria-hidden="true"></span><span>נועם AI זמין בכל דף</span>';
    card.appendChild(row);
  }
  return card;
}

function place(card: HTMLElement, anchor: DOMRect, genieLift = 0) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchor.left + anchor.width / 2 - CARD_W / 2;
  left = Math.max(12, Math.min(vw - CARD_W - 12, left));
  let top = anchor.bottom + 10 + genieLift;
  if (top + CARD_H > vh - 12) {
    top = anchor.top - CARD_H - 10;
    // Prefer side when genie would collide above too
    if (genieLift && top < 12) {
      left = Math.min(vw - CARD_W - 12, anchor.right + 12);
      top = Math.max(12, Math.min(vh - CARD_H - 12, anchor.top));
    }
  }
  top = Math.max(12, top);
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

export function initLinkPeek(root: ParentNode = document): void {
  if (!window.matchMedia('(hover: hover)').matches) return;

  let tip: HTMLElement | null = null;
  let showT: number | undefined;
  let hideT: number | undefined;

  const hide = () => {
    clearTimeout(showT);
    clearTimeout(hideT);
    if (tip) {
      tip.remove();
      tip = null;
    }
  };

  const show = (el: HTMLElement) => {
    clearTimeout(hideT);
    clearTimeout(showT);
    showT = window.setTimeout(() => {
      const key = el.getAttribute('data-peek');
      if (!key) return;
      const entry = resolveEntry(key);
      if (!entry) return;
      hide();
      tip = buildCard(entry, key);
      document.body.appendChild(tip);
      const genieLift = el.querySelector('[data-genie]') ? 86 : 0;
      place(tip, el.getBoundingClientRect(), genieLift);
      if (motionAllowed()) {
        tip.animate(
          [
            { opacity: 0, transform: 'translateY(-4px) scale(.97)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 160, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }
        );
        tip.querySelectorAll('.link-peek__block').forEach((b, i) => {
          (b as HTMLElement).animate(
            [
              { opacity: 0, transform: 'translateY(3px)' },
              { opacity: 1, transform: 'none' },
            ],
            {
              duration: 220,
              delay: 40 + i * 18,
              easing: 'ease-out',
              fill: 'both',
            }
          );
        });
        if (readMotionMode() !== 'כבוי') {
          const ring = tip.querySelector('.link-peek__ai-ring') as HTMLElement | null;
          ring?.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: 2200,
            iterations: Infinity,
          });
        }
      } else {
        tip.style.opacity = '1';
      }
    }, 220);
  };

  root.addEventListener(
    'mouseover',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]') as HTMLElement | null;
      if (t) show(t);
    },
    true
  );
  root.addEventListener(
    'mouseout',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]');
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (t && (!related || !t.contains(related))) {
        clearTimeout(showT);
        hideT = window.setTimeout(hide, 120);
      }
    },
    true
  );
  root.addEventListener(
    'focusin',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]') as HTMLElement | null;
      if (t) show(t);
    },
    true
  );
  root.addEventListener(
    'focusout',
    () => {
      clearTimeout(showT);
      hideT = window.setTimeout(hide, 120);
    },
    true
  );
  window.addEventListener('scroll', hide, { passive: true });
}
