# Ramzi mobile diagram readability — 2026-10-19

The mobile chat constrained diagrams inside a 90% answer bubble; the expansion dialog was also height-capped. This change gives diagram-bearing replies the full available phone width. Diagram expansion uses the phone screen, keeps Close visible, and adds bounded 100–250% zoom, horizontal scrolling and Fit. It clones the already-rendered figure and restores the opener's focus; no new model request or transcript update occurs. The original question SVG image gains the same expansion control.

Scope: Headless worksheet viewer only. Root static viewer, provider, authentication, rate limiting, manifests, math and PDF files are unchanged.

Validation: 11 focused zoom lifecycle, clean entry, and reading-space tests pass; Wix production build passes (1,866 static assets). Browser checks used Brave phone emulation (390×844 and 390×600), not a physical device. Original figure opened in the actual Wix preview; 150% zoom measured 549px content in a 366px scroll viewport, reset and Close restored the same selected question and focus. Keyboard Shift+Tab from Close moved to the final focus stop. The generated SVG was reused in a clearly identified local presentation fixture; this is not a new model result. Qwen reviewed these phone/desktop captures with no blockers; DeepSeek PR review also found no blockers.

Final Wix preview built and checked; its URL is shared through the designated preview handoff. The final follow-up removes an unnecessary touch-action declaration and retains the browser default gestures, with no visual difference. The initial CI failure was a clean-entry guard rejecting that declaration; it was removed without weakening the test. Final CI is tracked on PR #197.

Local full-unit execution found the intentional viewer head/script changes against the protected baseline, plus an environment-dependent gate fixture failure. After independent diff review, only the two viewer hashes were updated for PR197; all other protected boundaries remain unchanged. The original clean-entry assertion remains intact. Full local run is not claimed green; focused/protected checks and final CI are reported separately.

## Additional live sample (not a release-wide certification)

- Grade 7 G7-T14 A / question 1 part ב: selected task is classifying DEF by its angles (D=38°, E=29°). The actual hint says to find the third angle to classify the triangle. Appropriate to selected part. The live diagram completed with D/E/F and the relevant ∠DFE highlighted; captured in live-sample.json. Its angle is visually obtuse, consistent with the given38°/29°.
- Grade 8 G8-T39 A / question 1 part ג: selected task asks for three corresponding angle equalities after proving congruence. First attempt failed Google's check; ordinary retry returned “Do the two triangles share an identical side?” This concerns the previous proof step and is insufficiently focused on part ג. Not marked PASS; shared with coordinating chat for investigation.
- Grade 9 G9-KITE A / question 1 part ב: selected task identifies head/side vertices and primary/secondary diagonals. Both initial and ordinary retry failed the security check in the test browser. No model-answer claim.

These observations are independent of the presentation-only fix. A blocked or off-scope answer must not be counted as success.
