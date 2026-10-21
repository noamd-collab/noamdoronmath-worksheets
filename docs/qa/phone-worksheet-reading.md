# Phone worksheet reading — 2026-10-15

The phone viewer previously squeezed a worksheet into approximately 264px at
390px viewport width, hiding zoom in the secondary menu. The released adapter
could also hold a detached pin during lazy PDF rendering.

## Behavior

- Phones open at a 600px paper reading size (100%); horizontal panning is intentional.
- Always-visible controls above the paper: 10% zoom steps, whole-width overview,
  and return to reading size. Whole-width fit rounds down to avoid tiny overflow.
- A single 54px rail holds 44px Ramzi/report targets vertically, 48px apart.
  Nearby questions merge at 100px spacing; every part remains in the chooser.
- Opening/closing phone help preserves the chosen zoom. Desktop zoom is unchanged.
- Question taps resolve the current pin by exercise ID, including grouped pins,
  instead of using a detached reference from before a lazy render.

## Checks

- 35 Node tests: print-anchor fixtures, phone layout/panel/rail, every installed
  manifest's reachable exercises, and first tap while decoration is pending.
- 31 focused Astro tests: shared asset parity, clean entry and protected boundaries.
- Real Brave browser at 390×844: grade 7 powers Q4, grade 8 numerical denominators
  Q7, grade 9 upper-secondary transition Q9. Correct part chooser opens; returning
  preserves zoom. Fit has no horizontal overflow; reading mode deliberately pans.
- Grade 9 lazy offscreen navigation was allowed to finish painting before tapping;
  an automation click during initial layout movement is not counted as a pass.

Original PDF text and diagrams are not reflowed, rewritten or replaced. Whole-page
mode is an overview; reading mode lets the reader pan and zoom the original paper.
