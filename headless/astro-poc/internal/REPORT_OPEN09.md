# OPEN-09 — Google Auth + progress audit (read-only)

**Date:** 2026-09-24  
**Branch:** `open09-audit` (from `headless/astro-poc-baseline` @ `aa864c54`)  
**Scope:** Audit only — **no** app code fixes, **no** Supabase/Google setting changes, **no** Production, **no** merge, **no** PR.  
**Parallel:** Another agent audits Supabase dashboard/MCP; this report does **not** call Supabase MCP `mcp_auth` and does not print secrets beyond already-public publishable config.

---

## Verdict (short)

| Area | Status |
|------|--------|
| Live Google login path (Wix → GitHub Pages learning) | **Architecturally coherent**; E2E not re-run here |
| Headless POC Google login path | **Code ready (same-origin PKCE)**; **live E2E blocked** until exact Redirect URLs allowlisted + human Google login |
| Progress tables / RLS / read-write code | **Clear and consistent** in repo schema + JS |
| Migrating existing cloud users to Headless domain | **No DB migration needed** if same Supabase project + same Google IdP; re-login required |
| Guest (localStorage) progress across domain change | **Does not auto-migrate**; explicit import after login |
| Dashboard allowlist contents | **Not verified in this agent** (API does not expose `uri_allow_list`) — needs Noam or parallel agent |

---

## 1. Google sign-in flows

### 1.1 Live site `noamdoronmath.co.il`

- Homepage embeds / links learning to **GitHub Pages**, not to paths on the Wix domain.
- Probes: `https://www.noamdoronmath.co.il/learning` → **404**; `…/learning.html` → **400**. Learning UI is **not** hosted on the custom domain today.
- Live entry (`learning/wix-entry.js`): Google CTA →  
  `https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html?signin=google`  
  Local tracking CTA → same host `/learning.html`.
- Live `noam-learning.js` hardcodes OAuth `redirectTo` to  
  `https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html`  
  (fixed GitHub Pages return).
- Client: Supabase JS, **PKCE**, `storageKey: 'noam-learning-auth-v1'`, `detectSessionInUrl`, `persistSession`, `autoRefreshToken`.
- Auth client is **not** created inside iframes (`window.self !== window.top`) — Google only in full-window portal.
- Intent `?signin=google` is consumed via `history.replaceState` **before** OAuth so Back/reload cannot loop.

**Live flow (intended):**

```text
Wix homepage CTA
  → github.io/learning.html(?signin=google)
  → signInWithOAuth(google, redirectTo=github.io/learning.html)
  → Google accounts
  → Supabase callback (ouzquol…/auth/v1/callback)
  → back to github.io/learning.html?code=…
  → PKCE exchange on same origin → session in localStorage
  → SELECT/UPSERT noam_learning_progress
```

### 1.2 Headless Astro POC (`headless/astro-poc`)

- Serves `public/learning.html` on the **preview origin** (e.g. `wglqn3-…wix-site-host.com`).
- Config: `authCallbackMode: 'same-origin'` — `redirectTo` = **current origin** `/learning.html` via `noam-learning-auth-redirect.js`.
- Explicit comment in code: GitHub Pages callback alone does **not** establish a Headless session (PKCE verifier is origin-scoped).
- Home CTAs: `/learning.html` and `/learning.html?signin=google` (same host).
- Preview learning URL (from prior URGENT-46):  
  `https://wglqn3-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html`

**POC flow (intended):**

```text
Headless /learning.html(?signin=google)
  → resolveAuthRedirectTo → https://<this-host>/learning.html
  → Google → Supabase callback → same host /learning.html?code=
  → PKCE on same origin → cloud progress
```

### 1.3 Live vs POC code delta (auth-relevant)

| File | Live / repo root | Astro POC |
|------|------------------|-----------|
| `noam-learning.js` `redirectTo` | Hardcoded github.io | Same-origin / fixed via `NoamLearningAuthRedirect` |
| `noam-learning-config.js` | url + key + `googleEnabled` only | + `authCallbackMode`, `authAllowedOrigins`, `authFixedOrigin` |
| `noam-learning-auth-redirect.js` | Absent | Present |
| `noam-learning-core.js` | Identical | Identical |
| Supabase project | `ouzquolkeuceektfihss` | **Same** |

---

## 2. Supabase Auth + Google OAuth settings

### 2.1 Confirmed without dashboard (read-only probes)

| Check | Result |
|-------|--------|
| Project | `https://ouzquolkeuceektfihss.supabase.co` |
| `/auth/v1/settings` | `external.google: true`; email also true; signup not disabled |
| GoTrue | `v2.197.0` |
| Authorize → Google | HTTP **302** to `accounts.google.com` with scopes `email profile` |
| Google `redirect_uri` (fixed) | `https://ouzquolkeuceektfihss.supabase.co/auth/v1/callback` |
| OAuth client id (public in authorize URL) | `105713563948-tnq1hhns58dbg846qr5alresoe3o45m8.apps.googleusercontent.com` |

### 2.2 What the authorize probe does **not** prove

`GET /auth/v1/authorize?redirect_to=<any>` returns 302 for github.io, live domain, POC hosts, and even localhost.  
That only starts the Google hop. **Allowlist enforcement happens on callback return.** Public Auth settings API does **not** expose `uri_allow_list` / Site URL.  
(Confirmed also in URGENT-46 evidence.)

### 2.3 What must change when the domain moves to Headless

**Supabase Dashboard → Authentication → URL Configuration** (Noam / ops — do not change during this audit):

1. Keep (during transition) exact Redirect URL(s) for current live login host:  
   `https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html`
2. Add **exact** URL(s) for every Headless origin that must support Google, e.g.:  
   `https://wglqn3-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/learning.html`  
   (and any other preview still used for OAuth QA)
3. Before DNS cutover to Headless on the custom domain, add:  
   `https://www.noamdoronmath.co.il/learning.html`  
   and apex if used: `https://noamdoronmath.co.il/learning.html`
4. **No wildcards** (`*.wix-site-host.com` forbidden by app redirect helper and by prior ops guidance).
5. Site URL policy: leave owner-controlled; do not weaken casually. Prefer keeping Site URL stable; use Additional Redirect URLs for alternate hosts.

**Google Cloud Console (OAuth client above):**

- Authorized redirect URI for this architecture is normally **only** the Supabase callback  
  `https://ouzquolkeuceektfihss.supabase.co/auth/v1/callback`  
  — app return URLs live in **Supabase** Redirect URLs, not as Google redirect URIs.
- Noam should **confirm** (read-only) that the Google client still lists that Supabase callback and that the client is the one wired in Supabase Auth → Providers → Google. Do **not** rotate client secret unless broken.

**App config after domain cutover:**

- Keep `authCallbackMode: 'same-origin'` on the canonical Headless host, **or** switch to `fixed` + `authFixedOrigin: 'https://www.noamdoronmath.co.il'` if previews must not become OAuth targets.
- Optionally populate `authAllowedOrigins` with exact origins only.
- Retire hardcoded github.io `redirectTo` from any surface that becomes the primary login host (live root still uses it today).

---

## 3. Student progress: tables, RLS, code

### 3.1 Tables (repo schema `learning/schema.sql`; live existence corroborated by parallel catalog audit)

| Table | Role |
|-------|------|
| `auth.users` | Supabase Auth users (Google → uuid) |
| `public.noam_learning_worksheets` | Whitelist of `worksheet_id` only (FK target); **not** catalog CMS |
| `public.noam_learning_progress` | Per-user status: `started` / `completed` / `review` |
| `public.noam_ai_jobs` | Exists; **not** used by learning progress JS |

Columns on progress: `user_id` (FK `auth.users` ON DELETE CASCADE), `worksheet_id` (FK worksheets), `status`, `updated_at` (trigger). PK `(user_id, worksheet_id)`.

Seed: `learning/catalog-seed.sql` → **956** worksheet IDs (matches learning catalog).

### 3.2 RLS (intended / repo)

- RLS enabled on both learning tables.
- **anon:** revoke all; verify script expects guest read/write denied.
- **authenticated:**
  - worksheets: `SELECT` only (`learning_catalog_read`, `using (true)`)
  - progress: own-row `SELECT/INSERT/UPDATE/DELETE` via `auth.uid() = user_id`
- No guest cloud rows by design.

Live RLS was not re-executed here (needs DB role). Parallel agent: publishable key gets **401** on progress (privilege denied), consistent with RLS + revoke.

### 3.3 Code that reads / writes

| Action | File | Call |
|--------|------|------|
| Load cloud rows | `noam-learning-core.js` `refresh` | `from('noam_learning_progress').select(…).eq('user_id', user)` |
| Set / clear one | `change` | `upsert` or `delete` filtered by user + worksheet |
| Merge guest → account | `importGuest` | `upsert(..., { ignoreDuplicates: true })` for **missing** keys only |
| Clear account | `clear` | `delete().eq('user_id', user)` |
| Guest store | same file | `localStorage` key `noam-learning-guest-v1` |
| Auth session | `noam-learning.js` | `createClient` / `onAuthStateChange` / `getSession` / `signOut({ scope: 'local' })` |
| UI catalog titles/PDFs | `noam-learning-catalog.js` | **Not** Supabase |

Guest data never written into guest storage from account responses (epoch guard + tests).

---

## 4. Moving existing users without losing progress

### 4.1 Cloud-backed accounts (Google → `auth.users` + `noam_learning_progress`)

**No table migration required** when Headless keeps the **same** Supabase project and Google provider:

- Progress is keyed by `user_id`, not by domain.
- Same Google account → same Auth user → same rows.

What users **will** notice:

- Session cookie/localStorage (`noam-learning-auth-v1`) is **per origin**. After domain change they appear logged out until they sign in again with Google.
- That re-login restores cloud progress via `refresh()`.

### 4.2 Guest-only progress (never logged in)

- Stored only in browser `noam-learning-guest-v1` on the **origin where they practiced** (today: github.io for live learning).
- New Headless / custom-domain origin starts with **empty** guest store.
- Recovery path already in UI: after login, **«הוספת הסימונים מהמכשיר לחשבון»** (`importGuest`) — fills **missing** account rows only; never overwrites existing cloud status. Guest copy remains on device.
- Cross-origin guest transfer is **not** automatic. Export JSON button can help manual salvage before cutover messaging.

### 4.3 What would lose progress (avoid)

| Action | Risk |
|--------|------|
| New Supabase project / new Google OAuth client with new user ids | Orphan or empty progress unless export/import planned |
| Deleting `auth.users` | CASCADE deletes progress |
| Changing `worksheet_id` scheme without mapping | FK / clean() drop unrecognized ids |
| Relying on github.io session after cutover while Site URL / redirects drop github.io too early | Login breaks for users still on old entry links |

### 4.4 Recommended cutover sequence (ops, not executed)

1. Add Redirect URLs for Headless + future `www` **before** pointing users there.  
2. Keep github.io Redirect URL until Wix CTAs no longer send users there.  
3. Prefer one Supabase project throughout.  
4. Communicate: «התחברו שוב עם Google אחרי המעבר; סימוני חשבון נשמרים. סימונים מקומיים בלבד — השתמשו בייצוא או בהוספה לחשבון.»  
5. Human E2E on target host: login → mark → reload → other device → sign-out/in.

---

## 5. Edge cases

| Case | Behavior |
|------|----------|
| **Sign-out** | `signOut({ scope: 'local' })` — clears this browser’s session only; other devices stay signed in; cloud rows untouched; UI shows guest local marks again |
| **Multi-device** | Each device needs its own login; cloud is SoT after `cloudReady`; guest marks stay device-local unless `importGuest` |
| **Not signed in** | Full catalog usable; marks in `noam-learning-guest-v1`; no Supabase progress access (RLS) |
| **Refresh / reload** | `persistSession` + `getSession` restore user; `refresh()` reloads cloud; `?code=` stripped after exchange |
| **Back / bfcache** | `pageshow` persisted resets pending Google button; `signin` intent already consumed |
| **OAuth error / cancel** | `signin` not re-fired from leftover params; guest learning continues |
| **Iframe embed** | No Supabase client; link to full-window portal for Google |
| **Offline cloud write** | Reject; UI does not claim save; no silent fallback to guest for account users |
| **Concurrent tab guest** | `storage` event on guest key re-emits UI |
| **Clear progress while logged in** | Deletes **all** that user’s cloud rows (cross-device) |

Unit coverage: root `tests/noam-learning.test.cjs` — **18/18 pass** this run. POC `learning-auth-callback.test.ts` covered same-origin redirect + guest merge (suite runner has unrelated failures elsewhere; not used as E2E proof).

---

## 6. Blockers / what Noam must do himself

### Stopped for human action (this agent will not proceed past audit)

1. **Confirm Supabase Redirect URL allowlist** (Dashboard → Auth → URL Configuration). Public API cannot list it. Parallel Supabase agent may screenshot; otherwise Noam must open the panel.  
2. **Add exact Headless learning Redirect URL(s)** when ready for Google E2E on preview (example: `https://wglqn3-…/learning.html`). **Do not** use wildcards.  
3. **Human Google E2E** on the chosen host (agent cannot complete Google account picker safely without Noam):  
   Learning → Google → return same host → mark status → reload → sign out → sign in → confirm marks.  
4. **Optional read-only Google Cloud check:** OAuth client `105713563948-…` still has Supabase `/auth/v1/callback` as authorized redirect.  
5. **Before custom-domain Headless cutover:** add `https://www.noamdoronmath.co.il/learning.html` (and apex if needed) to Supabase Redirect URLs **before** DNS; keep github.io until CTAs stop pointing there.

### Explicitly not done by this agent

- Changing Supabase or Google settings  
- Completing interactive Google login as Noam  
- Production / DNS / `wix release` / merge / PR  
- Code fixes

---

## 7. Domain-migration risks (summary)

1. **PKCE / origin mismatch** — starting OAuth on Headless but redirecting to github.io (or the reverse) breaks session establishment. POC fixed this with same-origin; live still intentionally github.io-only.  
2. **Missing Redirect URL** — authorize may still open Google; callback fails. Preview hosts change per deploy → each exact host must be listed or use a fixed canonical origin mode.  
3. **Session loss on new origin** — expected; cloud progress OK after re-login.  
4. **Guest-only users** — local marks stranded on old origin unless export / login+import.  
5. **Dual entry during transition** — Wix still pointing at github.io while Headless also offers Google → two origins, two guest stores, one cloud account if they log in.  
6. **Early removal of github.io from allowlist** — breaks remaining live CTAs.  
7. **New Auth project** — highest risk of orphaning progress; avoid.

---

## 8. Evidence index

| Item | Source |
|------|--------|
| Schema / RLS | `learning/schema.sql`, `learning/verify-rls.sql` |
| Live OAuth redirect | repo `noam-learning.js` + served github.io copy |
| POC same-origin | `public/noam-learning-config.js`, `public/noam-learning-auth-redirect.js`, `public/noam-learning.js` |
| Wix entry | `learning/wix-entry.js`; live homepage references github.io learning |
| Auth settings probe | `GET …/auth/v1/settings` (google true) |
| Authorize probe | 302 → Google for multiple `redirect_to` (not allowlist proof) |
| Table existence / no catalog in SB | store `internal/supabase-catalog-read-audit.md` (parallel) |
| Prior Headless Google blocker | store `internal/urgent-46-evidence.md`, `m35-cutover-blockers.md` |
| Progress unit tests | `tests/noam-learning.test.cjs` 18 pass |

---

## 9. Addendum 2 — reCAPTCHA v3 vs Headless preview (Perplexity hints → code proof)

**Date:** 2026-09-25  
**Scope:** Verify Perplexity research hints against `recaptchaGuard` / `noamBotGuard` / client. **No** Google Admin changes, **no** Production publish.  
**Perplexity file:** `~/Downloads/PERPLEXITY_HEADLESS_SEO_REDIRECTS_RECAPTCHA.md` §3 — **not present** in this agent VM; hints taken from coordinator message only.

### 9.1 Hint checklist (code proof)

| # | Perplexity hint | Verdict from code / live evidence |
|---|-----------------|-----------------------------------|
| 1 | Token carries **page** hostname (preview), not http-function; siteverify returns `hostname` | **Confirmed.** Client mints via `grecaptcha.execute` on the viewer origin. Studio `recaptchaGuard.js` reads `assessment.hostname` after Google siteverify and requires `hostnames.has(assessment.hostname.toLowerCase())`. Failures before score use `BOT_REJECTED`. |
| 2 | Exact compare to only `www.noamdoronmath.co.il` would fail preview **and** apex | **Nuance.** Guard uses an **exact Set** allowlist, not www-only. Live `noamBotSettings.js` includes `www`, **apex**, and `noamd-collab.github.io`. Preview fails when **absent from that list** — not because apex is missing. A www-only list *would* also break apex; that is not the current config. |
| 3 | Preview domain must be in Google Admin Domains or mint fails | **External — report only, do not change.** Mint already succeeds on wglqn3 (`grecaptcha.execute` ~710-char token in prior probe). Failure mode observed is post-siteverify **app** hostname gate (`BOT_REJECTED`), not Admin mint block. Revisit Admin only if siteverify returns hostname-related `error-codes`. |
| 4 | Front site key + Secrets Manager secret = same key, v3 | **Aligned in contract.** Client requires `provider: "recaptcha-v3"` + siteKey from `noamBotConfig`. Live config: `siteKey: 6LdPhawt…`, `mode: enforce`. Settings: same public key; secret via `NOAM_RECAPTCHA_SECRET_KEY` (value not read). Pairing of secret↔key cannot be proven without a deliberate siteverify; not probed here. |
| 5 | Token single-use / short-lived — fresh token per call, also after refresh/resume | **Client OK.** `noam-bot-client.js`: «Execute once per AI request; tokens are never cached»; network retry mints a **new** token (unit test asserts first≠second). Diagram **status** polls use `ownerKey`+`jobId` only (no reCAPTCHA). Fresh token only on guarded routes (`noamImageAnalyze` / `Solve` / `DiagramPlan`) via `postJson`. |

### 9.2 Guard implementation (Studio `my-site-2`, not this worksheets repo)

| Module | Role |
|--------|------|
| `src/backend/recaptchaGuard.js` | siteverify → require `success`, matching `action`, **exact** `hostname` in allowlist, score in range; low score → `BOT_RISK_REJECTED` (429) in enforce |
| `src/backend/noamBotGuard.js` | wires settings + Secrets Manager → `rejectNoamBotRequest` / public `noamBotConfig` |
| `src/backend/noamBotSettings.js` | public `siteKey`, `secretName`, `mode`, `minimumScore`, `allowedHostnames` |

Hostname validation regex on settings **rejects wildcards** (`*`). Preferred safe fix = **exact** host entries only — matches Perplexity recommendation and existing guard design. Do **not** disable verify.

### 9.3 Current allowlist status (git default, 2026-09-25 read)

`allowedHostnames` on default `my-site-2` tree now includes:

- `noamd-collab.github.io`
- `www.noamdoronmath.co.il`
- `noamdoronmath.co.il`
- `wglqn3-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com`
- `sxut7j-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com`

**Caveat:** Wix HTTP functions go live only after **site Publish**. Earlier live Chromium still saw `BOT_REJECTED` on wglqn3 (pre-publish). This agent did **not** re-run Google mint E2E and did **not** publish.

### 9.4 Preferred fix (unchanged recommendation)

1. Keep `mode: 'enforce'`; do not turn off verification.  
2. Add **exact** preview / future canonical hostnames to `allowedHostnames` (already present in git for wglqn3/sxut7j).  
3. Noam: **Publish** Studio site if git already has the hosts but live still `BOT_REJECTED`.  
4. Do **not** change Google Admin unless mint/siteverify proves domain rejection.  
5. After publish: one short רמז on wglqn3; expect pass hostname gate (may still hit score/`BOT_RISK_REJECTED`).

### 9.5 Client tests this addendum

`tests/noam-bot-client.test.cjs` — **4/4 pass** (incl. fresh token on network retry).

Related store notes (other agents): `internal/noam-ai-bot-rejected-wglqn3.md`, `internal/report-cursor-noam-ai-headless.md`.

---

## Production

**No.** Audit / report only (including §9). No Google Admin edits, no Studio publish from this agent.
