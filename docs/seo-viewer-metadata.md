# Worksheet Viewer Metadata (SEO priority 3)

## Scope

For query-bearing `/worksheet-viewer-noam.html` requests, the Astro middleware derives the initial HTML `<title>` and meta description from the checked-in public catalog only. A resource is verified only when its `g`, `pdf`, and any supplied `topic` / `lv` values identify exactly one viewer-enabled catalog level. The `t` display-title query is **not** an SEO metadata source.

Example verified resource:

`/worksheet-viewer-noam.html?g=9&topic=1&pdf=ec49833022f345f88360f3f5d4a7ab92&lv=a`

Unknown, ambiguous, or mismatched identifiers retain the useful generic worksheet title and description; no topic is guessed. The viewer's body title may still use its existing display query for the in-page interface, but `document.title` keeps catalog-verified metadata or the generic fallback.

## Deliberate non-scope

This change does not alter canonical URLs, robots/indexation policy, PDF selection, exercise selection, back navigation, print styles, AI behavior, drawing/cropping, or deployment settings.

## Verification boundary

The focused unit tests verify the resolver and rendered-shell transform. For browser verification, `.github/scripts/build-servable.sh` builds the Node **middleware** adapter and `.github/scripts/preview-query-server.mjs` sends only query-bearing `/worksheet-viewer-noam.html` and `/learning.html` requests to that compiled Astro handler before considering static client assets. All other readable static assets come directly from `dist/client`.

This harness is deliberately **not** an HTML rewriter, mock response, Wix command, deployment, or production claim. It proves the local compiled Astro query path and the local browser/PDF/print checks only; it cannot prove Wix edge/CDN routing, an account setting, or a hosted production result.

After review, a hosted query-route check is **Noam-only**: Noam must use the authorized hosted environment to request a real catalog viewer URL and confirm its initial document metadata and rendered PDF behavior. Until that check happens, this document makes **no claim that production is fixed or live**.
