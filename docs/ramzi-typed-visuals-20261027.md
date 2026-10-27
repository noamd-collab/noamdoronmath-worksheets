# Ramzi source-backed typed visuals

The existing diagram planner accepts straight-segment scenes around already named points. Its initial focus gate cannot describe function graphs, number lines, tables or operation structure. This release adds an opt-in typed plan to that same authenticated request, with deterministic source helpers for straightforward cases.

`NoamNativeVisual.authoredContext` binds the selected exercise, native question/item and original figure, normalizes text arrays, and clones only the selected tables. It ignores parent relation arrays, sibling parts, solution goals and model-generated source values. Seven narrowly verified legacy level aliases preserve the published exercise IDs.

`NoamAuthoredVisual` and `NoamAuthoredGeometry` render explicit source functions, intervals, number-line points, input rules and supported given shapes. Function expressions use a bounded parser and interval arithmetic; no eval or computed answer labels are used. Unknown parameters, implicit systems, unsupported explicit domains and changed constructions remain unsupported. Constant functions are supported. Curves split across poles, removable holes, square-root domain boundaries and zero-to-zero inputs. Discrete counting classes use points rather than continuous bands.

`NoamVisualPlan` accepts version2 plans with one of seven families and exact evidence spans. The model selects the visual focus; it supplies neither SVG nor coordinates, chart values, table cells or evaluated answers. `NoamVisualData` derives operation trees and source tables/charts from that evidence. Empty cells remain `?`; totals remain in the reference table and do not become extra bar categories. The browser revalidates plans against fresh selected source data on display and rehydration. Native package identity joins the request cache key.

The viewer sends an opaque source reference only after its exact native context is loaded. The companion worker independently fetches the fixed public-origin package, checks its SHA256, and validates exercise/question/item identity before routing the existing650-token focus call to v2 or the unchanged v1 path. Verified text/table-only sources skip redundant image analysis; any original source figure or unverified source retains vision. Authentication, owner binding, quotas, queue/status protocol and model budgets remain unchanged.

Release ordering: deploy the opt-in worker first, preserving its existing `verify_jwt:false` plus HMAC gate; old clients continue v1. Publish this frontend afterward. A frontend rollback remains compatible with the new worker. Do not deploy the frontend alone and interpret unsupported v2 as model coverage.

Validation includes real source fixtures outside the120-case acceptance sample, every canonical no-SVG exercise identity, exact evidence/tampering tests, both root and public viewer request paths, cache/rehydration/race tests, and server routing/source verification. Compiler coverage is an upper bound; it is not a measurement of live model selection or diagram usefulness. Live desktop/phone and native Brave acceptance are separate release checks.

Legacy PDF slots without a native package remain on the original OCR/geometry path. The shared integration is available sitewide, but v2 does not treat unverified OCR as authored evidence and does not imply every exercise has a useful supported diagram.
