# Teacher tools with Google sign-in

The public `/teachers` page presents the existing worksheet-selection, printing and Word tools as available to **every verified Google account**. Its entry link opens `/teachers/login`; the existing worksheet catalog remains public. A separate Coming Soon section describes the planned paid AI generation service, without a price, launch date or completion-time promise. The page has no signup, lead capture, checkout or worksheet-generation action. The existing teacher area is not a private test area.

## Routes and discovery

| Request | Behavior |
| --- | --- |
| `/teachers`, including marketing-only query parameters | Public teacher-tools landing using `BaseLayout`. Canonical URL is `/teachers`; production follows the site's indexing policy and preview hosts remain noindex. |
| `/teachers` with any `grade`, `topic`, `level`, `edition`, `minutes` or `pick` parameter | `307` to `/teachers/app`, preserving the full query and encoding, with no-store. The destination enforces authorization before serving the wizard. |
| `/teachers/login` | Google sign-in entry. Accessible for signing in, but noindex and privately uncached. Signing in does not by itself grant tool access. |
| `/teachers/start` | Google-authenticated original picker and source preview. Requests that fail authentication redirect to sign-in with a sanitized return destination. |
| `/teachers/app` | Google-authenticated wizard, with the same sign-in redirect contract. Private responses have `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`. |
| `/teachers/index.html` | Legacy `307` alias to `/teachers/app`, preserving the query, with noindex and no-store. It does not bypass the destination's authorization. |

The public search index and pages sitemap include only `/teachers`. Login, start and app are excluded. The site guide distinguishes the public landing from the signed-in tool and explains the Google sign-in requirement before its tool instructions.

Legacy query redirects preserve partial and invalid scope values for the wizard to validate after authorization. Authentication return destinations are independently restricted to same-origin `/teachers/start` or `/teachers/app`; external URLs, fragments, credential parameters and malformed values are rejected. Noindex controls indexing; server authorization controls access.

## Google sign-in and separate owner authorization

The client uses the existing Supabase Google integration with PKCE and the same-origin `noam-learning-auth-v1` storage key. It requests Google identity, with no added Gmail or Drive permissions.

1. A same-origin `POST /api/teacherSession` with `action: start` creates a ten-minute HttpOnly, Secure, SameSite=Lax pending return cookie. That cookie carries only a sanitized teacher destination, never an identity or entitlement.
2. Google returns directly to the same-origin SSR `/teachers/login` callback. Production and each tested preview require that exact callback URL in the Supabase redirect allowlist; unknown preview origins must never be treated as working callbacks. The existing static `/learning.html` flow stays separate because Wix can serve static assets before middleware.
3. The client checks SDK initialization and completes PKCE before removing the one-time callback code. Failed exchanges and provider cancellations never bridge an older stored session. A valid access token is sent only in a same-origin POST body.
4. The server verifies the token against the fixed Supabase project's Auth user endpoint. It requires a confirmed Google identity and binds the validated token's subject, issuer, audience and expiry. An email string, client profile, decoded token or user-editable metadata cannot grant access.
5. Successful verification creates the HttpOnly teacher session cookie and returns an allowlisted destination. The cookie cannot outlive the validated access token. Protected requests revalidate authorization; provider failures deny access.

`requireGoogleTeacher` protects all existing teacher tools and selection/intake actions. `verifyGoogleTeacherToken` is used by the session bridge. `requireOwnerTeacher` additionally binds the verified identity to the fixed owner UID; it is the required gate for the separate new AI-generation feature, before any model or job cost. The former `authorizeTeacherRequest` and `verifyTeacherToken` exports retain owner-only semantics so an unconverted caller never silently gains access. Invalid owner configuration blocks the owner gate while ordinary Google access still validates the fixed Auth project.

The owner's entitlement is permanent, while all sessions still expire and require valid authentication. Owner identifiers and account details are intentionally omitted from this document. This release prepares the separate owner gate; it does not implement new worksheet generation, paid customer entitlements or billing.

Session creation and clearing require same-origin JSON POST requests. Logout clears the teacher session and pending return cookie; the client also signs out its local Supabase session. If server clearing fails, the page stays open and presents a retry message. If server clearing succeeds but SDK sign-out fails, the local persisted session is removed before returning to the public page. JSON POST avoids the Wix proxy origin mismatch affecting native form/DELETE submissions without weakening Astro origin protection.

## Protected actions and public material

Google authentication protects the start page, wizard, teacher question-manifest API, teacher Word-selection API and teacher-selection/intake actions routed through the site companion. General public site-guide navigation remains separate. When a visitor requests a protected teacher action, the guide shows Hebrew sign-in guidance and a fixed `/teachers/login` link instead of a raw authorization error. Existing reCAPTCHA verification remains required for protected AI selection requests; Google authentication does not replace it.

Published worksheets, the worksheet catalog, source previews and existing public Word assets remain public. The gate protects the private tool and its API actions; it does not retrospectively make previously published educational material private.

The wizard source is `headless/astro-poc/src/teacher-pages/wizard.html`. There must be no `public/teachers/index.html`: a public directory index would shadow the Astro landing and expose the old entry. The app imports the source as raw HTML and adds private-session controls after authorization. Existing scripts and assets retain their `/teachers/` paths.

## Signed-in picker and sample provenance

`TeacherLanding.astro` remains the signed-in start UI. Its catalog projection uses `loadCatalog()` plus the validated worksheet-edition publication registry; it does not maintain another topic list. The compact picker exposes canonical default editions and valid level choices. Its default grade-three division scope comes from the registry. Client enhancement builds the selected app link locally, and a working default link remains available without JavaScript.

Both the public teacher landing and signed-in picker show the actual grade-three division source. The public label is **דוגמה מהמאגר הקיים**. The preview is page 1 of 8 for topic `10`, level `a`, edition `elementary-20261108-r1`, “חילוק והקשר ההפוך לכפל”. It is a fixed published worksheet preview, not an AI-generated sample.

- Source PDF: `https://static.wixstatic.com/ugd/d8e7ad_3d7563584d774bf5958dc6a37ef7e210.pdf`
- PDF SHA-256: `465f369f94f96bb086ee8a65be928f5d0397f9320ab8fbfa2da95999685002e3`
- Preview PNG SHA-256: `6b6863a0e9e19baf230f15983ef7e8317d851245126c9ebf437109f76f06b331`
- Public preview: `/teachers/landing/division-grade-3-preview.png`

## Validation boundary

The three teacher Astro routes have explicit static task-entry classifications. Topic, grade and marketing concept-animation requirements and motion thresholds remain unchanged.

Validation covers public/private SEO and discovery, legacy query handling, static-shadow prevention, Google callback routing, fail-closed server authorization, session expiry and logout, protected API actions, valid picker scopes, and phone/desktop accessibility. Worksheet selection, printing, answer assembly and Word regressions remain required. Release evidence records actual test and deployment outcomes separately; this document does not claim a production sign-in or release has succeeded.
