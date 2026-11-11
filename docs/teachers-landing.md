# Teacher Coming Soon and private testing

The public `/teachers` page presents the teacher service as **in development and private testing**. It describes the planned paid AI service: worksheets suited to the class, its current place in the curriculum and the last lesson. It gives no price, launch date or completion-time promise. The public page has no picker, signup, lead capture, checkout or worksheet-generation action. Its testing link opens `/teachers/login`; the existing worksheet catalog remains available.

## Routes and discovery

| Request | Behavior |
| --- | --- |
| `/teachers`, including marketing-only query parameters | Public Coming Soon page using `BaseLayout`. Canonical URL is `/teachers`; production follows the site's indexing policy and preview hosts remain noindex. |
| `/teachers` with any `grade`, `topic`, `level`, `edition`, `minutes` or `pick` parameter | `307` to `/teachers/app`, preserving the full query and encoding, with no-store. The destination enforces authorization before serving the wizard. |
| `/teachers/login` | Google sign-in entry. Accessible for signing in, but noindex and privately uncached. Signing in does not by itself grant tool access. |
| `/teachers/start` | Owner-authorized original picker and source preview. Requests that fail authorization redirect to sign-in with a sanitized return destination. |
| `/teachers/app` | Owner-authorized wizard, with the same sign-in redirect contract. Private responses have `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`. |
| `/teachers/index.html` | Legacy `307` alias to `/teachers/app`, preserving the query, with noindex and no-store. It does not bypass the destination's authorization. |

The public search index and pages sitemap include only `/teachers`. Login, start and app are excluded. The site guide distinguishes the public Coming Soon page from the private tool and states the owner-only restriction before its tool instructions.

Legacy query redirects preserve partial and invalid scope values for the wizard to validate after authorization. Authentication return destinations are independently restricted to same-origin `/teachers/start` or `/teachers/app`; external URLs, fragments, credential parameters and malformed values are rejected. Noindex controls indexing; server authorization controls access.

## Google sign-in and owner authorization

The client uses the existing Supabase Google integration with PKCE and the same-origin `noam-learning-auth-v1` storage key. It requests Google identity, with no added Gmail or Drive permissions.

1. A same-origin `POST /api/teacherSession` with `action: start` creates a ten-minute HttpOnly, Secure, SameSite=Lax pending return cookie. That cookie carries only a sanitized teacher destination, never an identity or entitlement.
2. Google returns through the existing `/learning.html` callback. While the ten-minute pending cookie exists, middleware rewrites that path to the teacher login handler, including OAuth errors in fragments that the server cannot see. Learning visits without that pending state keep their existing route.
3. The client checks SDK initialization and completes PKCE before removing the one-time callback code. Failed exchanges and provider cancellations never bridge an older stored session. A valid access token is sent only in a same-origin POST body.
4. The server verifies the token against the fixed Supabase project's Auth user endpoint. It checks the returned user against the configured owner UID, requires a confirmed Google identity, and binds the validated token's subject, issuer, audience and expiry. An email string, client profile, decoded token or user-editable metadata cannot grant access.
5. Successful verification creates the HttpOnly teacher session cookie and returns an allowlisted destination. The cookie cannot outlive the validated access token. Protected requests revalidate authorization; provider failures deny access.

The owner's entitlement is permanent, while sessions still expire and require valid authentication. Owner identifiers and account details are intentionally omitted from this document. This release does not implement paid customer entitlements or billing.

Session creation and deletion require same-origin requests. Logout clears the teacher session and pending return cookie; the client also signs out its local Supabase session. A server form supplies the logout fallback.

## Protected actions and public material

Authorization protects the start page, wizard, teacher question-manifest API, teacher Word-selection API and teacher-selection/intake actions routed through the site companion. General public site-guide navigation remains separate. Existing reCAPTCHA verification remains required for protected AI requests; Google authorization does not replace it.

Published worksheets, the worksheet catalog, source previews and existing public Word assets remain public. The gate protects the private tool and its API actions; it does not retrospectively make previously published educational material private.

The wizard source is `headless/astro-poc/src/teacher-pages/wizard.html`. There must be no `public/teachers/index.html`: a public directory index would shadow the Astro landing and expose the old entry. The app imports the source as raw HTML and adds private-session controls after authorization. Existing scripts and assets retain their `/teachers/` paths.

## Private picker and sample provenance

`TeacherLanding.astro` remains the private start UI. Its catalog projection uses `loadCatalog()` plus the validated worksheet-edition publication registry; it does not maintain another topic list. The compact picker exposes canonical default editions and valid level choices. Its default grade-three division scope comes from the registry. Client enhancement builds the selected app link locally, and a working default link remains available without JavaScript.

Both the public Coming Soon page and private picker show the actual grade-three division source. The public label is **דוגמה מהמאגר הקיים**. The preview is page 1 of 8 for topic `10`, level `a`, edition `elementary-20261108-r1`, “חילוק והקשר ההפוך לכפל”. It is a fixed published worksheet preview, not an AI-generated sample.

- Source PDF: `https://static.wixstatic.com/ugd/d8e7ad_3d7563584d774bf5958dc6a37ef7e210.pdf`
- PDF SHA-256: `465f369f94f96bb086ee8a65be928f5d0397f9320ab8fbfa2da95999685002e3`
- Preview PNG SHA-256: `6b6863a0e9e19baf230f15983ef7e8317d851245126c9ebf437109f76f06b331`
- Public preview: `/teachers/landing/division-grade-3-preview.png`

## Validation boundary

The three teacher Astro routes have explicit static task-entry classifications. Topic, grade and marketing concept-animation requirements and motion thresholds remain unchanged.

Validation covers public/private SEO and discovery, legacy query handling, static-shadow prevention, Google callback routing, fail-closed server authorization, session expiry and logout, protected API actions, valid picker scopes, and phone/desktop accessibility. Worksheet selection, printing, answer assembly and Word regressions remain required. Release evidence records actual test and deployment outcomes separately; this document does not claim a production sign-in or release has succeeded.
