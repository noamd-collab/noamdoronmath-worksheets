# Ramzi visual permission by worksheet — 29 October 2026

Noam's rule permits Ramzi drawings, sketches, illustrations and other graphical hints only on geometry or analytic-geometry worksheets. Textual hints and original worksheet PDFs stay available. A graphic-looking question, existing source figure or student drawing request cannot grant permission to another worksheet.

`noam-visual-policy.js` is a pure, identical root/public UMD module. It exports the frozen `NoamVisualPolicy` global and CommonJS API, version `20261029-geometry-only-v1`:

- `allowsWorksheet({grade,prefix,exerciseId?})` checks the reviewed worksheet identity and, when supplied, the exact permitted exercise-prefix relation.
- `allowsExerciseId(id)` checks the existing exercise-ID grammar and allowed worksheet prefix. It does **not** establish that a question exists: callers retain exact manifest membership and source-integrity checks.
- Missing, unknown, malformed or conflicting identities deny permission. No title, prompt or figure keyword enables it.

The reviewed inventory is [ramzi-visual-policy-classification-20261029.json](ramzi-visual-policy-classification-20261029.json). It records native and manifest hashes, each source package, every catalog route, explicit named/reuse aliases and all old-PDF migrations.

| Denominator | Allowed | Blocked |
| --- | ---: | ---: |
| 412 native worksheet packages (one source package/level) | 214 | 198 |
| 30,972 native subsection entries | 15,880 | 15,092 |
| 161 middle-school catalog topics | 84 | 77 |
| 457 middle-school catalog level routes, including reuse and legacy sheets | 250 | 207 |
| 2,048 stored current/legacy manifests | 1,089 | 959 |

The 169 elementary catalog topics currently have no supported Ramzi worksheet prefix and deny by default. All 440 migration entries and every exercise ID in all 2,048 manifests agree with the classifications; no identity mismatch was found. These are **permission counts**, not claims about rendering success or mathematical correctness.

The reviewed boundary includes dedicated Cartesian/function pages G8-T05, G8-T06, G8-T11/T16, G9-T07 and graph-reading/interpolation pages. Geometric scale G8-T25 is permitted. Mixed motion G8-T10, statistical comparison G8-T66/TWOSRC, mixed bridge G9-T13, algebraic quadratic formula G9-T31 and arithmetic square roots G8-T48 are denied. Historical MP04/W35 graphics on denied worksheets do not override the new policy. Catalog group labels alone are insufficient.

Aliases are explicit: G9-T40's native source uses G9-T32; eleven grade-9 catalog topics reuse reviewed grade-7 sources; six named native packages bind to exact numeric exercise prefixes. Unrelated allowed prefixes remain incompatible.

Nine focused tests cover pure runtime export/mirroring, positive and negative subject boundaries, unknown/conflicting metadata, aliases, all native hashes and IDs, all catalog/migration routes, and the complete legacy manifest census. The frontend and diagram-service integrations are reviewed separately. No source PDF, SVG, native JSON, manifest, printed text or table is modified by this policy. Earlier browser journals remain historical evidence and are unchanged.
