# Ramzi mobile diagram readability — 2026-10-19

The mobile chat constrained diagrams inside a 90% answer bubble; the expansion dialog was also height-capped. This change gives diagram-bearing replies the full available phone width. Diagram expansion uses the phone screen, keeps Close visible, and adds bounded 100–250% zoom, horizontal scrolling and Fit. It clones the already-rendered figure and restores the opener's focus; no new model request or transcript update occurs. The original question SVG image gains the same expansion control.

Scope: Headless worksheet viewer only. Root static viewer, provider, authentication, rate limiting, manifests, math and PDF files are unchanged.

Validation in progress: focused zoom lifecycle and reading-space tests pass (4); Wix production build passes (1,866 static assets). Actual browser screenshots and final preview are recorded after verification.

## Additional live sample (not a release-wide certification)

- Grade 7 G7-T14 A / question 1 part ב: selected task is classifying DEF by its angles (D=38°, E=29°). The actual hint says to find the third angle to classify the triangle. Appropriate to selected part. Diagram request pending at initial log.
- Grade 8 G8-T39 A / question 1 part ג: selected task asks for three corresponding angle equalities after proving congruence. First attempt failed Google's check; ordinary retry returned “Do the two triangles share an identical side?” This concerns the previous proof step and is insufficiently focused on part ג. Not marked PASS; shared with coordinating chat for investigation.
- Grade 9 G9-KITE A / question 1 part ב: selected task identifies head/side vertices and primary/secondary diagonals. Both initial and ordinary retry failed the security check in the test browser. No model-answer claim.

These observations are independent of the presentation-only fix. A blocked or off-scope answer must not be counted as success.
