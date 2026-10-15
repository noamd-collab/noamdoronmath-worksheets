# SEO priority 5: homepage performance

## Scope and evidence

This change is deliberately limited to the Astro homepage’s decorative imagery and its below-the-fold game-promo image. It does **not** change the worksheet viewer, printing, navigation, Hebrew/RTL content, teacher imagery, accessibility/motion controls, or shared metadata ownership.

The saved historical audit at `/home/ubuntu/seo-audit/evidence/performance-summary.json` recorded a **single live mobile run** with a 3.8 s LCP and identified 400 × 400 doodles delivered into much smaller slots. That result is useful prioritization evidence only; it is **not a baseline for this code revision**.

Source inspection found:

- the text `h1` is explicitly marked `data-lcp` on `src/pages/index.astro`;
- `BaseLayout.astro` already preloads the Hebrew Secular One and Heebo fonts used in the hero, while `fonts.css` uses `font-display: swap`; those shared font declarations are intentionally unchanged;
- the hero’s non-content kite and snail are 120 px and 110 px CSS slots but were fetched as priority-high/full 400 px files; and
- six 112 px grade-tile doodles, three 200 px feature doodles, and the 130 px boat all referenced only 400 × 400 source files.

## Exact changes

1. Added deterministic, aspect-ratio-preserving **240 × 240 WebP responsive renditions** for the eight doodles actually used on the homepage:
   `kite`, `snail`, `paper-boat`, `curious-cat`, `geometry-fish`, `cube-plant`, `sleepy-owl`, and `telescope`.
   The transform uses Lanczos resizing, preserves the 1:1 aspect ratio and RGBA mode, and leaves every 400 × 400 original untouched.
2. Added `srcset` and explicit `sizes` to each affected homepage use. A 112–130 px slot can select 240w for normal high-density screens; the 400w original remains available for the 200 px feature tiles at 2x and for higher-density cases. The original `src` remains the fallback.
3. Changed only the two non-content, in-viewport hero doodles from `fetchpriority="high"` to `fetchpriority="low"`. They still load eagerly and remain in the same position; the change prevents decorative paint from being promoted ahead of the text hero and its already-preloaded fonts.
4. Added `loading="lazy"` and `decoding="async"` to the below-the-fold game-promo screenshot. Its source, explicit 960 × 508 geometry, alt text, card content, and links are unchanged.
5. Added focused source/binary tests that verify each new rendition is a smaller 240 × 240 WebP, every homepage use retains a 400w fallback, rendering-size hints exist, decorations are not priority-high, and the game image keeps its dimensions and alt text.

## Measured local Node-adapter lab results (not production)

The reproducible artifacts are in `/home/ubuntu/seo-fixes/pr5-benchmark/`: `summary.json` saves all raw values and calculated medians/ranges, `lighthouse-runs/` holds 12 raw Lighthouse LHRs, `browser-evidence.json` holds every observed image selection/resource-timing entry, and `screenshots/` holds actual homepage and scrolled GamePromoCard PNGs.

Method: Lighthouse 12.8.2 and `/usr/bin/chromium` on the same local machine; **three fresh-profile, alternating paired runs** for unchanged Node baseline `http://127.0.0.1:8400` and the built PR5 Node adapter `http://127.0.0.1:8405`, at mobile 390 and desktop 1280. Lighthouse used its `provided` local (unthrottled) method. These are **not Wix, production, field-CWV, or live-speed measurements**.

| Viewport | Version | Median LCP (min–max) | Median FCP (min–max) | Median Speed Index (min–max) | Median CLS |
|---|---:|---:|---:|---:|---:|
| Mobile 390 | baseline | 614.06 ms (587.72–728.93) | 614.06 ms (587.72–728.93) | 911 ms (889–1,024) | 0.13 |
| Mobile 390 | PR5 | 544.34 ms (529.23–568.68) | 544.34 ms (529.23–568.68) | 817 ms (801–859) | 0.13 |
| Desktop 1280 | baseline | 616.63 ms (607.74–678.55) | 616.63 ms (607.74–678.55) | 2,536 ms (2,532–2,594) | 0.02 |
| Desktop 1280 | PR5 | 661.16 ms (629.20–731.47) | 661.16 ms (629.20–731.47) | 2,581 ms (2,537–2,656) | 0.02 |

Total Blocking Time was 0 ms in all 12 measured runs. The local browser Performance Observer identified the Hebrew homepage `h1[data-lcp]` (`דפי עבודה שעושים חשק לפתור`) as the LCP candidate in all six responsive evidence captures; the Lighthouse element audit did not expose a node snippet for these local runs. The local result therefore shows a faster mobile median within this bounded setup, but does **not** show a desktop median improvement and must not be extrapolated to the historical 3.8 s live run or to Core Web Vitals.

Responsive evidence confirms the intended candidate selection in the PR5 build: in all captured PR5 mobile 390 DPR 1/DPR 2 and desktop 1280 DPR 1 cases, the kite and snail selected `*-240.webp` rather than baseline 400w files. For example, desktop transfer sizes were kite **13,596 B PR5 vs 23,288 B baseline** and snail **16,326 B PR5 vs 28,530 B baseline**; the desktop feature owl selected 240w at **14,646 B PR5 vs 24,226 B baseline**. The full selection, natural dimensions, transfer/encoded/decoded byte counts, and real PNGs are retained in the saved artifacts rather than inferred from markup.

The GamePromoCard PNG was rendered correctly after scrolling in every browser-evidence capture, with its 960 × 508 image complete and natural width non-zero; the additional Qwen-review evidence also captured real phone 390 and desktop 1280 scrolled-card screenshots. Its `loading="lazy"` hint is present, but in this local Chromium run its card image was already requested and complete before the scripted scroll in every capture. Native lazy loading is a browser-distance heuristic, not an initial-request guarantee; this validation therefore does **not** claim the card is always deferred.

## Design and validation limits

- No visual design, named teacher image, logo, Hebrew content (including בס״ד), links, navigation, motion controls, accessibility behavior, or print/viewer code was changed.
- The 400w originals are retained where 200 px CSS rendering needs a 2x asset; the 600 × 400 notebook sprite is intentionally untouched because its 300 × 200 displayed crop already needs that source at 2x.
- No Wix build/preview/release/environment command, deployment, account change, security change, model call, live-site audit, or field-CWV query was run. The browser evidence is a local Node-adapter and temporary read-only proxy check only; it does not establish Wix-hosted or production behavior.
- The public read-only proxy check at `https://4325-i782jkqdzx7n4gfl0b666-71f61292.sg2.manus.computer` returned 200 with zero horizontal overflow and zero page errors for `/`, `/grade-5`, `/grade-9`, `/factoring-grade-9`, `/worksheets?grade=9`, and `/blog` at phone 390 and desktop 1280. It did not alter viewer or print behavior.
