/**
 * Boots the vertex-descent iframe after it is in the document.
 * Hero shuffle and the grade player insert the frame later, so this is
 * called from those hosts as well as from TriangleAngleSumLoop.
 */
type DemoState = { playing: boolean; time: number; duration: number };
type Demo = {
  play(): void;
  pause(): void;
  seek(t: number): void;
  getState(): DemoState;
};
type FilmRoot = HTMLElement & {
  __loop?: {
    play(): void;
    pause(): void;
    seek(t: number): void;
    state(): { playing: boolean; done: boolean; static: boolean };
  };
};

function motionOff(): boolean {
  const html = document.documentElement;
  return html.classList.contains('nd-motion-off') || html.classList.contains('noam-a11y-motion');
}

function demoOf(frame: HTMLIFrameElement): Demo | undefined {
  try {
    return (frame.contentWindow as (Window & { triangleDemo?: Demo }) | null)?.triangleDemo;
  } catch {
    return undefined;
  }
}

export function bootAngleSumFilm(root: HTMLElement): void {
  if (!root.hasAttribute('data-angle-sum-loop')) return;
  const host = root as FilmRoot;
  if (host.dataset.angleSumReady === '1') return;
  host.dataset.angleSumReady = '1';

  const frame = root.querySelector<HTMLIFrameElement>('[data-angle-sum-frame]');
  if (!frame) return;

  const queued: Array<() => void> = [];
  function whenReady(fn: () => void) {
    if (demoOf(frame!)) fn();
    else queued.push(fn);
  }

  function fit() {
    let doc: Document | null = null;
    try { doc = frame!.contentDocument; } catch { return; }
    const main = doc?.querySelector('main');
    if (!main) return;
    const h = Math.ceil(main.getBoundingClientRect().height);
    if (h > 80 && Math.abs(frame!.clientHeight - h) > 2) frame!.style.height = `${h}px`;
  }

  function holdStill() {
    if (!motionOff()) return;
    demoOf(frame!)?.pause();
  }

  host.__loop = {
    play() { whenReady(() => demoOf(frame)?.play()); },
    pause() { whenReady(() => demoOf(frame)?.pause()); },
    seek(t: number) { whenReady(() => demoOf(frame)?.seek(t)); },
    state() {
      const demo = demoOf(frame);
      const s = demo?.getState();
      return {
        playing: !!s?.playing,
        done: !!s && !s.playing && s.time >= s.duration - 0.05,
        static: motionOff(),
      };
    },
  };

  let watching = false;
  function onReady() {
    if (!demoOf(frame)) return;
    const pending = queued.splice(0);
    for (const fn of pending) fn();
    fit();
    holdStill();
    if (watching || !('ResizeObserver' in window)) return;
    let doc: Document | null = null;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc?.querySelector('main')) return;
    watching = true;
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    if (doc.body) observer.observe(doc.body);
  }

  frame.addEventListener('load', onReady);
  onReady();

  root.querySelector<HTMLButtonElement>('[data-pause-card]')?.addEventListener('click', () => {
    const state = host.__loop?.state();
    if (!state || state.static) return;
    if (state.playing) host.__loop?.pause();
    else host.__loop?.play();
  });

  new MutationObserver(holdStill).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

/** Stop a hidden film. Blanking the frame keeps a cached iframe from reloading and playing. */
export function parkAngleSumFilm(root: HTMLElement): void {
  if (!root.hasAttribute('data-angle-sum-loop')) return;
  const frame = root.querySelector<HTMLIFrameElement>('[data-angle-sum-frame]');
  if (!frame) return;
  try { demoOf(frame)?.pause(); } catch { /* The frame is about to unload. */ }
  const src = frame.getAttribute('src') || '';
  if (!src || src === 'about:blank') return;
  frame.dataset.angleSumSrc = src;
  frame.setAttribute('src', 'about:blank');
}

/** Restore a parked film when its card is shown again. */
export function resumeAngleSumFilm(root: HTMLElement): void {
  if (!root.hasAttribute('data-angle-sum-loop')) return;
  const frame = root.querySelector<HTMLIFrameElement>('[data-angle-sum-frame]');
  const saved = frame?.dataset.angleSumSrc;
  if (!frame || !saved) return;
  const src = frame.getAttribute('src') || '';
  if (src === 'about:blank' || src === '') frame.setAttribute('src', saved);
}

let watching = false;
export function watchAngleSumFilms(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.querySelectorAll<HTMLElement>('[data-angle-sum-loop]').forEach(bootAngleSumFilm);
  const hosts = document.querySelectorAll<HTMLElement>('[data-hero-loop], [data-grade-loop]');
  if (!hosts.length) return;
  const bootNode = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches('[data-angle-sum-loop]')) bootAngleSumFilm(node);
    node.querySelectorAll<HTMLElement>('[data-angle-sum-loop]').forEach(bootAngleSumFilm);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(bootNode);
  });
  hosts.forEach((host) => observer.observe(host, { childList: true, subtree: true }));
}
