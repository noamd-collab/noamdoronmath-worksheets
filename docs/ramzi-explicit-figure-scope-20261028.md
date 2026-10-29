# Printed illustration scope

The live W15-Q3 case selected G8-T46/c q20ד (a question about containment before subtracting an inner area), but Ramzi attached the bow-tie figure whose printed introduction explicitly limits it to the final subsection ה. Its common semantic context also included the final subsection's parallel-line given.

A bounded scan of all 412 canonical native packages (8,178 questions; 30,972 subsections), followed by independent review of the four exact-SHA original PDFs, confirmed these entire-figure restrictions:

| Source question | Permitted subsection | Incorrect links removed | PDF ID |
| --- | --- | --- | --- |
| G7-T12/b q14 | א | ב, ג, ד | e6bad05438cb48f4ab5f7d894727625f |
| G8-T46/a q20 | ה | א, ב, ג, ד | 1447b1c93a0f481abbd1eccbef8a7551 |
| G8-T46/b q20 | ה | א, ב, ג, ד | 7b2d78cef1f44268ba9265392320ad26 |
| G8-T46/c q20 | ה | א, ב, ג, ד | 162e9a4cd15e41c5bb68cc6a1b600e81 |

The source item now has no figure for those 15 subsections. Each figure and its visual model are explicitly bound to the permitted item. Five figure-only given facts move from the common question to the permitted item, and unrelated per-item targets are removed from that figure's relations. The manifest omits the invalid figure URLs and sibling givens, and states the printed restriction in the selected-part prompt. Native package SHA references are updated in manifests and the catalog registry.

All original PDF/SVG bytes, question and subsection wording, exercise IDs, pins and crop geometry remain unchanged. More ambiguous figure-role language is not converted into a new inferred mapping.

The existing frontend and worker resolve the selected item's `figure_id`; neither inherits the question's figure after an explicit null item association. Thus this correction requires no worker or rendering-code change. The manifest URL version refreshes source references. Only these four PDFs receive a new OCR cache suffix; conversation keys and every other PDF's OCR key remain unchanged. Saved generated/native diagrams are revalidated against the changed selected-source identity.

Validation:

- Ten focused tests cover all four printed restrictions, exact original SVG/PDF identities, 15 removals, four retained figures, the ordinary hint semantic payload, stale-source rejection and targeted cache behavior.
- The full deterministic frontend suite passes: 1,197 passed, 2 skipped.
- The unchanged worker38 source loader was exercised offline with all 19 selected items against the corrected canonical bytes: 15 without figures, four with their permitted figures, and all 19 old package hashes rejected. No network or model requests were used.
- Independent original-PDF review confirms the printed restrictions. Deployment and a fresh live selected-part replay remain separate from these local checks; a stochastic hint's correctness is not certified by a data mapping test.
