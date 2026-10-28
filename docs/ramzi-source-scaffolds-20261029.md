# Source-bound instructional scaffolds

Base: published frontend `125c3a4b9b7ef34ca46f5f63aabab0ccf4571c83`.

Ten replay cases had no useful drawing even though their current selected
source supports a bounded visual aid. The new frontend module uses complete
authored clauses and given values, never a generated hint or the native
`given` summary arrays. It does not evaluate expressions or complete answers.

| Replay case | Selected source | Aid | Intentionally left open |
| --- | --- | --- | --- |
| W15-Q1 | G8-T46/c q5b | Two proof lanes; the nested lane has the five requested stages | Student construction, angle claims, similarity and proportion |
| W15-Q3 | G8-T46/c q20d | Two explicitly generic whole/marked-region arrangements | The required condition and which arrangement meets it |
| W32-Q1 | G8-T32/b q4d | Source boxes 6/9/9, first equalization, the added box4, second equalization | Both equalized amounts and totals |
| W32-Q2 | G8-T32/b q20a | Two groups with given player counts5/5 and averages6/12 | Individual scores and combined average |
| W11-Q3 | G7-T21/a q16b | Symbolic rectangle with width n and three added strips along its length | Area expression and table answers |
| W24-Q3 | G7-T03/b q11d | Signed factors positioned about zero and connected by the given multiplication operation | Product and product sign |
| W26-Q1 | G7-T37/b q10a | Separate balance views of the two literal equations | Both solutions and equivalence decision |
| W26-Q2 | G7-T37/b q16a | Five equal unknown notebook prices, bag20 and total55 | Requested equation and notebook price |
| W28-Q3 | G7-T04/b q6c | Source fraction numerator−14, divisor□ and requested result0 | Placeholder value and existence of a solution |
| W30-Q2 | G9-T11/a q6b | Actual past trials60 with18 successes, separated from an unknown future | Probability, expectation and future result |

The restriction printed in G8-T46/c q20 is honored: q20d has no selected
figure. Its conceptual aid never uses the final q20e bow-tie figure, names,
parallelism or dimensions. The new figures are labeled as **instructional
aids, not original figures or solutions**. The averages represent given
averages, not fabricated player scores. The observed-trials drawing is a
representation of past data, not a simulated future result.

## Interface and integration

Load `noam-source-scaffold.js` after `noam-native-visual.js` and
`noam-visual-data.js`. The existing source-panels module is consulted when
present. Root/public files are exact twins.

```js
NoamSourceScaffold.resolve(data, exercise, options, svgText) // spec or null
NoamSourceScaffold.render(document, data, exercise, options, svgText) // figure or null
```

Resolve/render require the exact selected native identity through
`NoamNativeVisual.authoredContext`, no selected source figure, and an explicit
current drawing request (`drawCurrentStep === true`). They do not attach
automatically to ordinary hints. Returned kinds start with `source-scaffold-`
and presentation is `instructional-scaffold`; they must not be counted as
original-source views or generated function graphs.

Use the hook after existing native/authored visuals and before the generic
original-table fallback. This lets W11 show a relevant dimension aid while
retaining the separate original-table error-recovery action. Persist only
the normal source identity and request intent. The renderer rederives the
scene from current source on every display; it does not accept saved scenes.

Every aid is one responsive SVG with `.noam-geometry-svg` plus a caption, so
the existing enlarge mechanism can display the complete aid. All text is
inserted using `textContent`; no authored HTML/SVG or external URLs are used.
No viewer or worker changes are included in this module commit. Viewer
integration, cache-tag/import fences and release validation belong to the
parent integration branch. No worker or model request is necessary.

## Prior-clause scope

W32-Q1 is the only family reading prior items. The current part must explicitly
refer to adding the fourth box. Exactly three earlier items in that same
question must match this ordered authored chain, with the same named actor:

1. Equal redistribution of the original boxes.
2. Addition of a fourth box with a literal bounded pencil count.
3. A second equal redistribution, immediately before the current part.

Only the literal added count is imported. Neither requested prior answers
nor `given`/answer fields are consumed. Missing, changed, reordered,
ambiguous, source-figure-bearing or foreign-actor clauses fail closed.
Later items cannot donate values. W32-Q2 consumes only common stem and
selected part; its stated total player count must agree with its two given
counts. Later tournament scenarios are excluded.

## Validation

The focused suite uses the exact ten published source fixtures, source
mutations, parameter variants, wrong identities, duplicate IDs, forbidden
sibling dependencies, render revalidation, no automatic requests and no
evaluated answers. A separate independently authored suite exercises the
same source boundaries. Relevant existing native/typed/source-data suites
remain unchanged.

Independent full-corpus measurement over412 exports/30,972 parts found11
matching selected parts: these ten plus the adjacent literal `0/□=0`
exercise G7-T04/b q6b. This is bounded recognizer coverage, not a claim that
all mathematics can be visualized or that a live model hint will be correct.
W11's image-analysis failure is handled separately by the source-analysis
workstream; the scaffold itself does not repair or retry that service.
