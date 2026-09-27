/**
 * Design v2 reveal engine — data-pop / data-draw / data-grow / data-fly / data-out.
 * Content stays visible without JS (only hidden under html.js-anim).
 * Honors prefers-reduced-motion, noam-a11y-motion, nd-motion-off.
 */

export type RevealRoot = Document | ParentNode;

function motionAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  const html = document.documentElement;
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !html.classList.contains('noam-a11y-motion') &&
    !html.classList.contains('nd-motion-off')
  );
}

function finish(el: Element): void {
  el.classList.add('is-in');
  el.classList.remove('is-out');
  (el as HTMLElement).style.opacity = '1';
  (el as HTMLElement).style.transform = 'none';
}

function prep(el: HTMLElement): void {
  const pop = el.getAttribute('data-pop');
  const grow = el.getAttribute('data-grow');
  const fly = el.getAttribute('data-fly');
  const draw = el.getAttribute('data-draw');
  const out = el.getAttribute('data-out');
  const delay = pop ?? grow ?? fly ?? draw ?? out ?? '0';
  el.style.setProperty('--nd-delay', delay);
  const dur = el.getAttribute('data-dur');
  if (dur) el.style.setProperty('--nd-dur', `${dur}ms`);
  const dx = el.getAttribute('data-dx');
  const dy = el.getAttribute('data-dy');
  if (dx) el.style.setProperty('--nd-dx', `${dx}px`);
  if (dy) el.style.setProperty('--nd-dy', `${dy}px`);
  if (draw != null && 'style' in el) {
    (el as unknown as SVGGeometryElement).style.strokeDasharray = '1';
    (el as unknown as SVGGeometryElement).style.strokeDashoffset = '1';
  }
}

const SELECTOR = '[data-pop],[data-grow],[data-fly],[data-draw],[data-out]';

export function scan(root: RevealRoot = document): void {
  if (typeof document === 'undefined') return;
  const nodes = Array.from(root.querySelectorAll(SELECTOR)) as HTMLElement[];
  if (!nodes.length) return;

  if (!motionAllowed() || typeof IntersectionObserver !== 'function') {
    nodes.forEach(finish);
    return;
  }

  nodes.forEach(prep);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        if (el.hasAttribute('data-out')) {
          el.classList.add('is-out');
        } else {
          el.classList.add('is-in');
        }
        io.unobserve(el);
      });
    },
    { threshold: 0.2 }
  );

  nodes.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85 && r.bottom > 0) {
      el.classList.add('is-in');
    } else {
      io.observe(el);
    }
  });

  // Fallback: anything still waiting after 2500ms jumps to final state.
  window.setTimeout(() => {
    nodes.forEach((el) => {
      if (!el.classList.contains('is-in') && !el.classList.contains('is-out')) {
        finish(el);
      }
    });
  }, 2500);
}

export function initReveal(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add('js-anim');
  const run = () => {
    scan(document);
    // Home hero coral underline under "חשק"
    const em = document.querySelector('.home-hero__title-em');
    if (em) {
      if (motionAllowed()) {
        window.setTimeout(() => em.classList.add('is-underline'), 700);
      } else {
        em.classList.add('is-underline');
      }
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.addEventListener('nd:motion-off', () => {
    if (!motionAllowed()) {
      document.querySelectorAll(SELECTOR).forEach((el) => finish(el));
      document.querySelector('.home-hero__title-em')?.classList.add('is-underline');
    }
  });
}
