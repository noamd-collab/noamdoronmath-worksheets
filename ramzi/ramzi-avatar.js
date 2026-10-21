var RamziAvatar = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/components/ramzi/ramzi-avatar.ts
  var ramzi_avatar_exports = {};
  __export(ramzi_avatar_exports, {
    RamziAvatarElement: () => RamziAvatarElement,
    animateRamzi: () => animateRamzi,
    consoleMood: () => consoleMood,
    defineRamziAvatar: () => defineRamziAvatar,
    isRamziMood: () => isRamziMood,
    motionIsOff: () => motionIsOff
  });

  // src/components/ramzi/ramzi-mood.ts
  var RAMZI_MOODS = ["idle", "thinking", "hint", "success", "error"];
  function isRamziMood(value) {
    return !!value && RAMZI_MOODS.includes(value);
  }
  function motionIsOff(snapshot) {
    if (snapshot.hidden || snapshot.reduced || snapshot.eventOff) return true;
    if (snapshot.classList.contains("nd-motion-off") || snapshot.classList.contains("noam-a11y-motion")) {
      return true;
    }
    const storage = snapshot.storage;
    if (!storage) return false;
    try {
      const direct = storage.getItem("noam-a11y-motion");
      if (direct === "off" || direct === "0" || direct === "false") return true;
      const saved = JSON.parse(storage.getItem("noam-accessibility-v1") || "{}");
      if (saved && (saved.motion === true || saved.stopAnim === true)) return true;
    } catch {
    }
    return false;
  }
  function consoleMood(input) {
    if (input.thinking) return "thinking";
    if (input.error) return "error";
    if (input.confirmed) return "success";
    if (input.hintDelivered) return "hint";
    return "idle";
  }
  function readBrowserMotionOff(eventOff) {
    if (typeof document === "undefined") return true;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    return motionIsOff({
      hidden: document.hidden,
      reduced,
      eventOff,
      classList: document.documentElement.classList,
      storage
    });
  }

  // src/components/ramzi/ramzi-avatar.ts
  var svgCache = /* @__PURE__ */ new Map();
  function assetUrl(base, mood) {
    const root = base.replace(/\/$/, "");
    return new URL(`${root}/ramzi-A-${mood}.svg`, document.baseURI).href;
  }
  function loadSvg(url) {
    let pending = svgCache.get(url);
    if (!pending) {
      pending = fetch(url).then((response) => {
        if (!response.ok) throw new Error("Avatar unavailable");
        return response.text();
      }).then((source) => {
        const svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
        if (svg.localName !== "svg" || svg.querySelector("script,foreignObject")) {
          throw new Error("Invalid avatar");
        }
        svg.querySelectorAll("metadata").forEach((node) => node.remove());
        return svg;
      });
      svgCache.set(url, pending);
    }
    return pending;
  }
  function animateRamzi(root, mood, motionOff) {
    const animations = [];
    const timer = window.setTimeout(() => {
      if (!root.isConnected || motionOff || typeof root.animate !== "function") return;
      const full = !motionOff;
      const q = (selector) => Array.from(root.querySelectorAll(selector));
      const play = (el, keyframes, options) => {
        if (!el.isConnected) return;
        try {
          const node = el;
          node.style.transformBox = "fill-box";
          node.style.transformOrigin = options.origin || "center";
          animations.push(node.animate(keyframes, options));
        } catch {
        }
      };
      q("[data-eyes]").forEach(
        (el) => play(
          el,
          [
            { transform: "scaleY(1)" },
            { transform: "scaleY(1)", offset: 0.92 },
            { transform: "scaleY(.1)", offset: 0.96 },
            { transform: "scaleY(1)" }
          ],
          { duration: full ? 4200 : 7400, iterations: Infinity, delay: Math.random() * 1500 }
        )
      );
      if (full) {
        q("[data-bob]").forEach(
          (el) => play(el, [{ transform: "translateY(0)" }, { transform: "translateY(-1.6px)" }], {
            duration: 1500,
            iterations: Infinity,
            direction: "alternate",
            easing: "ease-in-out"
          })
        );
      }
      if (full && mood === "thinking") {
        q("[data-hat]").forEach(
          (el) => play(el, [{ transform: "rotate(0)" }, { transform: "rotate(-5deg)" }], {
            duration: 900,
            iterations: Infinity,
            direction: "alternate",
            easing: "ease-in-out",
            origin: "center bottom"
          })
        );
      }
      if (full && mood === "success") {
        q("[data-hat]").forEach(
          (el) => play(
            el,
            [
              { transform: "translateY(0)" },
              { transform: "translateY(-5px) rotate(8deg)", offset: 0.4 },
              { transform: "translateY(0)" }
            ],
            { duration: 650, iterations: 2, origin: "center bottom" }
          )
        );
      }
      q("[data-dot]").forEach(
        (el, index) => play(el, [{ opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }], {
          duration: full ? 1100 : 2400,
          iterations: Infinity,
          delay: index * (full ? 180 : 380)
        })
      );
      q("[data-ray]").forEach(
        (el, index) => play(
          el,
          full ? [{ opacity: 0.25 }, { opacity: 1 }] : [{ opacity: 0.65 }, { opacity: 1 }],
          { duration: full ? 700 : 1800, iterations: Infinity, direction: "alternate", delay: index * 90 }
        )
      );
      q("[data-spark]").forEach(
        (el, index) => play(
          el,
          full ? [
            { transform: "scale(0) rotate(0)", opacity: 0 },
            { transform: "scale(1.25) rotate(45deg)", opacity: 1, offset: 0.55 },
            { transform: "scale(1) rotate(90deg)", opacity: 1 }
          ] : [{ opacity: 0 }, { opacity: 1 }],
          { duration: full ? 700 : 400, delay: index * 150, fill: "backwards" }
        )
      );
      if (full) {
        q('[data-shake="1"]').forEach(
          (el) => play(
            el,
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-2px)" },
              { transform: "translateX(2px)" },
              { transform: "translateX(0)" }
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
  var RamziAvatarElement = class extends HTMLElement {
    constructor() {
      super(...arguments);
      __publicField(this, "cancel", () => {
      });
      __publicField(this, "version", 0);
      __publicField(this, "eventOff", false);
      __publicField(this, "listening", false);
    }
    static get observedAttributes() {
      return ["mood", "size"];
    }
    connectedCallback() {
      this.setAttribute("aria-hidden", "true");
      this.listen();
      this.applySize();
      void this.render();
    }
    disconnectedCallback() {
      this.cancel();
    }
    attributeChangedCallback(_name, oldValue, newValue) {
      if (!this.isConnected || oldValue === newValue) return;
      this.applySize();
      void this.render();
    }
    listen() {
      if (this.listening) return;
      this.listening = true;
      const refresh = () => {
        void this.render();
      };
      window.addEventListener("nd:motion-off", (event) => {
        const detail = event.detail;
        this.eventOff = typeof (detail == null ? void 0 : detail.off) === "boolean" ? detail.off : true;
        refresh();
      });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (typeof reduced.addEventListener === "function") reduced.addEventListener("change", refresh);
      else reduced.addListener(refresh);
      document.addEventListener("visibilitychange", refresh);
      window.addEventListener("storage", refresh);
      new MutationObserver(refresh).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-nd-motion", "data-motion"]
      });
    }
    mood() {
      return isRamziMood(this.getAttribute("mood")) ? this.getAttribute("mood") : "idle";
    }
    applySize() {
      const size = Number(this.getAttribute("size") || "44");
      const px = Number.isFinite(size) && size > 0 ? size : 44;
      this.style.display = "inline-flex";
      this.style.flex = "none";
      this.style.width = `${px}px`;
      this.style.height = `${px}px`;
      this.style.alignItems = "center";
      this.style.justifyContent = "center";
    }
    async render() {
      const mood = this.mood();
      const version = ++this.version;
      const base = this.getAttribute("asset-base") || "/design-exact/assets/avatar";
      this.cancel();
      let svg;
      try {
        svg = (await loadSvg(assetUrl(base, mood))).cloneNode(true);
      } catch {
        return;
      }
      if (version !== this.version || !this.isConnected) return;
      svg.setAttribute("aria-hidden", "true");
      svg.removeAttribute("aria-label");
      svg.removeAttribute("role");
      svg.style.cssText = "display:block;width:100%;height:100%;overflow:visible";
      this.replaceChildren(svg);
      const off = readBrowserMotionOff(this.eventOff);
      const size = Number(this.getAttribute("size") || "44");
      this.cancel = animateRamzi(svg, mood, off || Number.isFinite(size) && size <= 30);
    }
  };
  function defineRamziAvatar() {
    if (typeof customElements === "undefined") return;
    if (!customElements.get("ramzi-avatar")) customElements.define("ramzi-avatar", RamziAvatarElement);
  }
  if (typeof window !== "undefined") defineRamziAvatar();
  return __toCommonJS(ramzi_avatar_exports);
})();
