/**
 * Start-on-view runtime for the explainer animations (one shared copy per page).
 *
 * The markup's default CSS is the FINAL state, so without JS, or with
 * prefers-reduced-motion, the reader sees the finished explanation.
 * With JS: arm (initial frame) → play once when ~40% of it is on screen.
 * The replay button re-arms and plays again. Nothing here changes layout.
 */
const REDUCED = '(prefers-reduced-motion: reduce)';

function play(root: HTMLElement) {
  root.dataset.state = 'armed';
  // Restart CSS animations: commit the armed frame before switching to play.
  void root.getBoundingClientRect();
  requestAnimationFrame(() => {
    root.dataset.state = 'play';
  });
}

function init() {
  if (window.matchMedia?.(REDUCED).matches) return;
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-explainer]:not([data-state])'));
  if (!roots.length) return;
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              observer!.unobserve(e.target);
              play(e.target as HTMLElement);
            }
          },
          { threshold: 0.4 },
        )
      : null;
  for (const root of roots) {
    root.dataset.state = 'armed';
    root.querySelector<HTMLButtonElement>('[data-replay]')?.addEventListener('click', () => play(root));
    if (observer) observer.observe(root);
    else play(root);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
