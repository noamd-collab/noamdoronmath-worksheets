# Noam AI companion: backend go-live checklist

This is for Noam. It turns on the live `qwen3.8-flash` call for the site companion.
An agent must not run `wix release`, must not merge, and must not create or change secrets.

The Astro site and this Velo backend are separate. Publishing the website does not publish `my-site-2` http functions.

## 1. Copy these files into the my-site-2 backend

Open the private Wix backend for `amiramnoam.wixstudio.com/my-site-2`.
Copy each file to the name on the right. Keep the `.js` imports next to each other.

| Copy from this repo | Save in the backend as |
| --- | --- |
| `noam-ai/site-companion/wix-post-noamSiteCompanion.js` | `backend/wix-post-noamSiteCompanion.js` |
| `noam-ai/site-companion/companion.js` | `backend/companion.js` |
| `noam-ai/site-companion/retrieve.js` | `backend/retrieve.js` |
| `noam-ai/site-companion/bot-guard.js` | `backend/bot-guard.js` |
| `headless/astro-poc/src/data/catalog.v1.json` | `backend/noam-site-catalog.v1.json` |

Do not copy `noam-site-companion.js` or `noam-bot-client.js` into the backend. Those stay on the website.

## 2. Export the two functions from http-functions.js

In `backend/http-functions.js`, add this line with the other exports:

```js
export { options_noamSiteCompanion, post_noamSiteCompanion } from "./wix-post-noamSiteCompanion.js";
```

The public routes are then:

- `OPTIONS /_functions/noamSiteCompanion`
- `POST /_functions/noamSiteCompanion`

## 3. Check the Qwen secret name against the existing AI function

1. Open the existing `noamDiagramPlan` backend code.
2. Find the `getSecret("...")` call that loads the QwenCloud key.
3. The companion calls `getSecret("QWEN_API_KEY")` in `wix-post-noamSiteCompanion.js`.
4. If the existing function uses that same name, leave it.
5. If the existing function uses a different name, change only the string in the companion so it reads that existing secret.
6. Do not create a new secret, and do not paste the key into git or into the browser.

## 4. Use the same site allowlist

1. In the existing `noamDiagramPlan` or `noamBotConfig` code, copy the exact origin allowlist.
2. Compare it with `SITE_ORIGINS` in `backend/bot-guard.js`.
3. Make the two lists identical, including `https://www.noamdoronmath.co.il`.
4. Do not use `*` and do not add a pattern such as `*.wix-site-host.com`.
5. A Wix preview origin is rejected today, same as the existing AI routes. Add a preview origin only if you add that same origin to the existing allowlist too.

`options_noamSiteCompanion` returns 204 only for an allowed origin, and 403 otherwise.
The response origin header is that one site, never `*`.

## 5. Use the same reCAPTCHA check

1. In the existing AI function, find the reCAPTCHA secret name, the score threshold, and the verify call.
2. `bot-guard.js` uses `getSecret("RECAPTCHA_SECRET_KEY")`, action `noam_site_companion`, and a minimum score of `0.5`, then calls Google `siteverify`.
3. If the existing function uses another secret name or another threshold, change `RECAPTCHA_SECRET_NAME` and `RECAPTCHA_MIN_SCORE` to those values.
4. Do not create a second reCAPTCHA secret if one already exists.
5. The browser already sends the token through `noam-bot-client.js` as `botVerification: { provider: "recaptcha-v3", token }`.
6. A missing token, a low score, or a wrong action is rejected before any model call.

The server also refuses a message longer than 700 characters, and more than 12 requests per minute per site-and-IP.

## 6. Publish the backend yourself

Publish the my-site-2 Velo backend from the Wix editor when you want the live call.
Do not ask an agent to run `wix release`.
Merging the website PR is a separate decision and does not deploy this function.

## 7. Check that it is really guarded

1. From `https://www.noamdoronmath.co.il`, OPTIONS returns 204 and a real question returns a catalog link.
2. From any other origin, OPTIONS returns 403.
3. A POST without `botVerification` returns 403 and does not call Qwen.
4. A message longer than 700 characters returns 400.
5. On a worksheet page, a question about solving the exercise points to Ramzi even when this function is down.
