/**
 * רמזי (avatar A). Static SVG moods plus the Web Animations timings from
 * Avatar.dc.html. Motion follows the site switch only: no second control.
 */
import {
  isRamziMood,
  readBrowserMotionOff,
  type RamziMood,
} from './ramzi-mood';

export { consoleMood, isRamziMood, motionIsOff, type RamziMood } from './ramzi-mood';

const svgCache = new Map<string, Promise<SVGSVGElement>>();

function assetUrl(base: string, mood: RamziMood): string {
  const root = base.replace(/\/$/, '');
  return new URL(`${root}/ramzi-A-${mood}.svg`, document.baseURI).href;
}

function loadSvg(url: string): Promise<SVGSVGElement> {
  let pending = svgCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Avatar unavailable');
        return response.text();
      })
      .then((source) => {
        const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
        if (svg.localName !== 'svg' || svg.querySelector('script,foreignObject')) {
          throw new Error('Invalid avatar');
        }
        svg.querySelectorAll('metadata').forEach((node) => node.remove());
        return svg as unknown as SVGSVGElement;
      });
    svgCache.set(url, pending);
  }
  return pending;
}

/** Timings copied from Avatar.dc.html run(). Returns a cancel function. */
export function animateRamzi(root: Element, mood: RamziMood, motionOff: boolean): () => void {
  const animations: Animation[] = [];
  const timer = window.setTimeout(() => {
    if (!root.isConnected || motionOff || typeof root.animate !== 'function') return;
    const full = !motionOff;
    const q = (selector: string) => Array.from(root.querySelectorAll(selector));
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions & { origin?: string }) => {
      if (!el.isConnected) return;
      try {
        const node = el as HTMLElement;
        node.style.transformBox = 'fill-box';
        node.style.transformOrigin = options.origin || 'center';
        animations.push(node.animate(keyframes, options));
      } catch {
        /* The static SVG remains the end frame. */
      }
    };
    q('[data-eyes]').forEach((el) =>
      play(
        el,
        [
          { transform: 'scaleY(1)' },
          { transform: 'scaleY(1)', offset: 0.92 },
          { transform: 'scaleY(.1)', offset: 0.96 },
          { transform: 'scaleY(1)' },
        ],
        { duration: full ? 4200 : 7400, iterations: Infinity, delay: Math.random() * 1500 }
      )
    );
    if (full) {
      q('[data-bob]').forEach((el) =>
        play(el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-1.6px)' }], {
          duration: 1500,
          iterations: Infinity,
          direction: 'alternate',
          easing: 'ease-in-out',
        })
      );
    }
    if (full && mood === 'thinking') {
      q('[data-hat]').forEach((el) =>
        play(el, [{ transform: 'rotate(0)' }, { transform: 'rotate(-5deg)' }], {
          duration: 900,
          iterations: Infinity,
          direction: 'alternate',
          easing: 'ease-in-out',
          origin: 'center bottom',
        })
      );
    }
    if (full && mood === 'success') {
      q('[data-hat]').forEach((el) =>
        play(
          el,
          [
            { transform: 'translateY(0)' },
            { transform: 'translateY(-5px) rotate(8deg)', offset: 0.4 },
            { transform: 'translateY(0)' },
          ],
          { duration: 650, iterations: 2, origin: 'center bottom' }
        )
      );
    }
    q('[data-dot]').forEach((el, index) =>
      play(el, [{ opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }], {
        duration: full ? 1100 : 2400,
        iterations: Infinity,
        delay: index * (full ? 180 : 380),
      })
    );
    q('[data-ray]').forEach((el, index) =>
      play(
        el,
        full
          ? [{ opacity: 0.25 }, { opacity: 1 }]
          : [{ opacity: 0.65 }, { opacity: 1 }],
        { duration: full ? 700 : 1800, iterations: Infinity, direction: 'alternate', delay: index * 90 }
      )
    );
    q('[data-spark]').forEach((el, index) =>
      play(
        el,
        full
          ? [
              { transform: 'scale(0) rotate(0)', opacity: 0 },
              { transform: 'scale(1.25) rotate(45deg)', opacity: 1, offset: 0.55 },
              { transform: 'scale(1) rotate(90deg)', opacity: 1 },
            ]
          : [{ opacity: 0 }, { opacity: 1 }],
        { duration: full ? 700 : 400, delay: index * 150, fill: 'backwards' }
      )
    );
    if (full) {
      q('[data-shake="1"]').forEach((el) =>
        play(
          el,
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-2px)' },
            { transform: 'translateX(2px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 340, iterations: 2 }
        )
      );
    }
  }, 30);
  return () => {
    window.clearTimeout(timer);
    animations.forEach((animation) => animation.cancel());
  };
}

export class RamziAvatarElement extends HTMLElement {
  private cancel = () => {};
  private version = 0;
  private eventOff = false;
  private listening = false;

  static get observedAttributes() {
    return ['mood', 'size'];
  }

  connectedCallback() {
    this.setAttribute('aria-hidden', 'true');
    this.listen();
    this.applySize();
    void this.render();
  }

  disconnectedCallback() {
    this.cancel();
  }

  attributeChangedCallback() {
    if (!this.isConnected) return;
    this.applySize();
    void this.render();
  }

  private listen() {
    if (this.listening) return;
    this.listening = true;
    const refresh = () => {
      void this.render();
    };
    window.addEventListener('nd:motion-off', (event) => {
      const detail = (event as CustomEvent<{ off?: boolean }>).detail;
      this.eventOff = typeof detail?.off === 'boolean' ? detail.off : true;
      refresh();
    });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (typeof reduced.addEventListener === 'function') reduced.addEventListener('change', refresh);
    else reduced.addListener(refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', refresh);
    new MutationObserver(refresh).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-nd-motion', 'data-motion'],
    });
  }

  private mood(): RamziMood {
    return isRamziMood(this.getAttribute('mood')) ? (this.getAttribute('mood') as RamziMood) : 'idle';
  }

  private applySize() {
    const size = Number(this.getAttribute('size') || '44');
    const px = Number.isFinite(size) && size > 0 ? size : 44;
    this.style.display = 'inline-flex';
    this.style.flex = 'none';
    this.style.width = `${px}px`;
    this.style.height = `${px}px`;
    this.style.alignItems = 'center';
    this.style.justifyContent = 'center';
  }

  private async render() {
    const mood = this.mood();
    const version = ++this.version;
    const base = this.getAttribute('asset-base') || '/design-exact/assets/avatar';
    this.cancel();
    let svg: SVGSVGElement;
    try {
      svg = (await loadSvg(assetUrl(base, mood))).cloneNode(true) as SVGSVGElement;
    } catch {
      return;
    }
    if (version !== this.version || !this.isConnected) return;
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('aria-label');
    svg.removeAttribute('role');
    svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible';
    this.replaceChildren(svg);
    const off = readBrowserMotionOff(this.eventOff);
    this.cancel = animateRamzi(svg, mood, off);
  }
}

export function defineRamziAvatar() {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get('ramzi-avatar')) customElements.define('ramzi-avatar', RamziAvatarElement);
}

if (typeof window !== 'undefined') defineRamziAvatar();
