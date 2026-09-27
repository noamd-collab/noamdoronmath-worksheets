/**
 * Link peek data + client controller (hover/focus only; touch devices skip).
 * Grade peeks use catalog counts when provided by the page.
 */

export type PeekBlock = [number, number, number, number, string];

export type PeekEntry = {
  title: string;
  tag: string;
  desc: string;
  blocks: PeekBlock[];
  ai?: boolean;
};

export const PKS: Record<string, Record<string, string>> = {
  h: { background: '#dfe3ec', borderRadius: '3px' },
  t: { background: '#22305a', opacity: '0.85', borderRadius: '3px' },
  l: { background: '#d5dae5', borderRadius: '3px' },
  c: { background: '#fff', border: '1.5px solid #cfd5e2', borderRadius: '6px' },
  a: { background: '#cfe6e4', borderRadius: '4px' },
  b: { background: '#dce7f3', borderRadius: '4px' },
  w: { background: '#fbe3b0', borderRadius: '4px' },
  k: { background: '#f6c9bd', borderRadius: '4px' },
  n: { background: '#22305a', borderRadius: '5px' },
  o: { background: '#d5dae5', borderRadius: '50%' },
  g: { background: '#2e9d57', borderRadius: '50%' },
  p: { border: '1.5px solid #22305a', borderRadius: '99px' },
};

/** Static peeks from design handoff (wording). */
export const PK: Record<string, PeekEntry> = {
  home: {
    title: 'בית',
    tag: 'עמוד ראשי',
    desc: 'דף עבודה אינטראקטיבי שמתחלף בכל ביקור, בחירת כיתה והמשך למידה.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [13, 2.2, 9, 1.2, 't'],
      [14.5, 3.8, 7.5, 1.2, 't'],
      [15, 5.6, 7, 0.7, 'l'],
      [16, 6.6, 6, 0.7, 'l'],
      [17.5, 8, 4.5, 1.3, 'n'],
      [13.5, 8, 3.5, 1.3, 'p'],
      [1, 2, 10.5, 7.4, 'c'],
      [2.4, 3.2, 5.2, 3.6, 'b'],
      [8.2, 3.4, 2.4, 2.4, 'w'],
      [2.4, 7.6, 7.6, 1, 'l'],
      [0.4, 10.2, 3.2, 2, 'c'],
      [4.2, 10.2, 3.2, 2, 'c'],
      [8, 10.2, 3.2, 2, 'c'],
      [11.8, 10.2, 3.2, 2, 'c'],
      [15.6, 10.2, 3.2, 2, 'n'],
      [19.4, 10.2, 3.2, 2, 'n'],
    ],
  },
  ws: {
    title: 'דפי עבודה',
    tag: 'המאגר',
    desc: 'נושאים לכל כיתה, מסודרים לפי חודשים, בשלוש רמות.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [19.4, 2, 2.8, 1, 'n'],
      [16.2, 2, 2.8, 1, 'p'],
      [13, 2, 2.8, 1, 'p'],
      [9.8, 2, 2.8, 1, 'p'],
      [11, 3.6, 11.2, 1.2, 't'],
      [12, 5.3, 10.2, 1.3, 'c'],
      [1, 8.6, 6.8, 3.6, 'c'],
      [8.2, 8.6, 6.8, 3.6, 'c'],
      [15.4, 8.6, 6.8, 3.6, 'c'],
    ],
  },
  about: {
    title: 'אודותינו',
    tag: 'מי אנחנו',
    desc: 'מי עומד מאחורי דפי העבודה ואיך הם נבנים.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [1, 2.2, 8.5, 9.6, 'c'],
      [3.2, 3.4, 4, 4, 'o'],
      [12, 2.4, 10.2, 1.2, 't'],
      [11, 4.4, 11.2, 0.7, 'l'],
      [11, 5.5, 11.2, 0.7, 'l'],
    ],
  },
  blog: {
    title: 'בלוג',
    tag: 'מאמרים',
    desc: 'מאמרים וטיפים להורים ולמורים.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [12, 2, 10.2, 1.2, 't'],
      [1, 4, 6.8, 8, 'c'],
      [8.2, 4, 6.8, 8, 'c'],
      [15.4, 4, 6.8, 8, 'c'],
    ],
  },
  tools: {
    title: 'תוספים',
    tag: 'כלים',
    desc: 'מחשבון מדעי וכלים שעוזרים בבגרות במחשבון.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [13, 2, 9.2, 1.2, 't'],
      [1, 4, 6.8, 3.8, 'c'],
      [8.2, 4, 6.8, 3.8, 'c'],
      [15.4, 4, 6.8, 3.8, 'c'],
    ],
  },
  hs: {
    title: 'מתמטיקה לתיכון',
    tag: 'אתר חיצוני',
    desc: 'חומרי לימוד לבגרות באתר נפרד. נפתח בלשונית חדשה.',
    blocks: [
      [0, 0, 23, 1.6, 'l'],
      [9, 3.2, 13.2, 1.4, 't'],
      [1, 3, 7, 7.5, 'c'],
      [17.2, 7.8, 5, 1.3, 'n'],
    ],
  },
  learn: {
    title: 'הלמידה שלי',
    tag: 'מעקב אישי',
    desc: 'סימון דפים שסיימתם ומעקב אחרי ההתקדמות, גם בלי להתחבר.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [11, 2.5, 11.2, 1.1, 't'],
      [1, 4.7, 12.8, 0.8, 'l'],
      [14.6, 4.7, 6, 0.8, 'l'],
      [21.2, 4.6, 1, 1, 'g'],
    ],
  },
  whatsapp: {
    title: 'קבוצת הוואטסאפ',
    tag: 'קהילה',
    desc: 'עדכונים על דפים חדשים ושאלות בין דפי העבודה.',
    blocks: [
      [0, 0, 23, 1.2, 'a'],
      [9, 2.4, 13.2, 1.8, 'c'],
      [1, 4.8, 11, 1.8, 'a'],
      [19, 9.3, 3, 3, 'n'],
    ],
  },
  facebook: {
    title: 'פייסבוק',
    tag: 'עמוד',
    desc: 'עדכונים על דפי עבודה חדשים ומה קורה באתר.',
    blocks: [
      [0, 0, 23, 1.4, 'b'],
      [1, 2.2, 21, 3.6, 'b'],
      [1, 7.4, 15, 4.6, 'c'],
    ],
  },
  instagram: {
    title: 'אינסטגרם',
    tag: 'פרופיל',
    desc: 'תרגילים קצרים וטיפים בפוסטים ובסטוריז.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [1, 2, 3, 3, 'o'],
      [5, 2, 3, 3, 'o'],
      [1, 5.8, 6.8, 6.2, 'k'],
    ],
  },
  elem: {
    title: 'יסודי א׳–ו׳',
    tag: 'דף כיתה',
    desc: 'לכל כיתה הדגמה, רשימת נושאים וקישור למאגר.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [12.8, 3.8, 9.4, 1.2, 't'],
      [1, 3.6, 10.5, 6.2, 'c'],
    ],
  },
  mid: {
    title: 'חטיבה ז׳–ט׳',
    tag: 'דף כיתה',
    desc: 'דפי עבודה לחטיבה ז׳–ט׳, בשלוש רמות.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [12.8, 3.8, 9.4, 1.2, 't'],
      [1, 3.6, 10.5, 6.2, 'c'],
    ],
    ai: true,
  },
  topic: {
    title: 'דף נושא',
    tag: 'הסבר + הדגמה',
    desc: 'הדגמה, הסבר קצר, דוגמה ובחירת דף ברמה המתאימה.',
    blocks: [
      [0, 0, 23, 1.2, 'h'],
      [10, 3, 12.2, 1.3, 't'],
      [1, 5, 11, 7.4, 'c'],
    ],
  },
};

const GRADE_HEB = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳'];

export function gradePeek(grade: number, topicCount?: number): PeekEntry {
  const letter = GRADE_HEB[grade] || String(grade);
  const band = grade <= 6 ? 'יסודי' : 'חטיבה';
  const countLabel =
    typeof topicCount === 'number' && topicCount > 0
      ? `${topicCount} נושאים`
      : 'נושאים מהמאגר';
  return {
    title: `כיתה ${letter}`,
    tag: `${band} · ${countLabel}`,
    desc: `דפי עבודה במתמטיקה לכיתה ${letter} — בחינם.`,
    blocks: PK.elem.blocks,
    ai: grade >= 7,
  };
}

export function resolvePeek(
  key: string,
  gradeCounts?: Record<string, number>
): PeekEntry | null {
  if (key.startsWith('g:')) {
    const g = Number(key.slice(2));
    if (!Number.isFinite(g) || g < 1 || g > 9) return null;
    return gradePeek(g, gradeCounts?.[String(g)]);
  }
  return PK[key] ?? null;
}

export function initLinkPeek(gradeCounts?: Record<string, number>): void {
  if (typeof document === 'undefined') return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  let tip: HTMLElement | null = null;
  let showTimer: number | undefined;
  let hideTimer: number | undefined;

  function ensureTip(): HTMLElement {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'nd-link-peek';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  function hide(): void {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    if (!tip) return;
    tip.removeAttribute('data-open');
    tip.hidden = true;
  }

  function place(anchor: Element): void {
    const el = ensureTip();
    const r = anchor.getBoundingClientRect();
    const w = 300;
    const h = 262;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    let top = r.bottom + 10;
    if (top + h > window.innerHeight - 12) {
      top = r.top - h - 10;
    }
    top = Math.max(12, top);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function render(key: string): void {
    const data = resolvePeek(key, gradeCounts);
    if (!data) return;
    const el = ensureTip();
    const unit = 12;
    const blocks = data.blocks
      .map((b, i) => {
        const [x, y, w, h, kind] = b;
        const st = PKS[kind] || {};
        const style = [
          `inset-inline-start:${x * unit}px`,
          `top:${y * unit}px`,
          `width:${w * unit}px`,
          `height:${h * unit}px`,
          `transition-delay:${40 + i * 18}ms`,
          ...Object.entries(st).map(([k, v]) => {
            const cssKey = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
            return `${cssKey}:${v}`;
          }),
        ].join(';');
        return `<span class="nd-link-peek__block" style="${style}"></span>`;
      })
      .join('');
    const ai = data.ai
      ? `<div class="nd-link-peek__ai"><span class="nd-link-peek__ai-ring" aria-hidden="true"></span><span class="nd-link-peek__ai-text">נועם AI זמין בכל דף</span></div>`
      : '';
    el.innerHTML = `<div class="nd-link-peek__card"><div class="nd-link-peek__shadow" aria-hidden="true">${blocks}</div><p class="nd-link-peek__title">${data.title}</p><p class="nd-link-peek__tag">${data.tag}</p><p class="nd-link-peek__desc">${data.desc}</p>${ai}</div>`;
    el.hidden = false;
  }

  function showFor(anchor: Element): void {
    const key = anchor.getAttribute('data-peek');
    if (!key) return;
    window.clearTimeout(hideTimer);
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(() => {
      render(key);
      place(anchor);
      requestAnimationFrame(() => ensureTip().setAttribute('data-open', ''));
    }, 220);
  }

  function scheduleHide(): void {
    window.clearTimeout(showTimer);
    hideTimer = window.setTimeout(hide, 120);
  }

  document.addEventListener(
    'pointerover',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]');
      if (t) showFor(t);
    },
    true
  );
  document.addEventListener(
    'pointerout',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]');
      if (t) scheduleHide();
    },
    true
  );
  document.addEventListener(
    'focusin',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]');
      if (t) showFor(t);
    },
    true
  );
  document.addEventListener(
    'focusout',
    (e) => {
      const t = (e.target as Element | null)?.closest?.('[data-peek]');
      if (t) scheduleHide();
    },
    true
  );
  window.addEventListener('scroll', hide, { passive: true });
}
