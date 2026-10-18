# Noam AI companion: go-live checklist

This is for Noam. Follow the steps in order. You copy files and paste one ready-made block. You do not change any code, and you do not create or rename a secret.

An agent must not run `wix release`, must not merge, and must not create or change secrets.

Two different publishes are involved:

- The **website** (the button visitors see) reaches the live site only after this pull request is merged **and** the website is published.
- The **AI call** is a separate backend on the Wix site `my-site-2`. You can publish that backend before the website. Until the website is merged and published, visitors still see the current site, and the new button is not there yet.

## 1. Copy the backend folder

1. Open the Wix editor for `amiramnoam.wixstudio.com/my-site-2`.
2. Open the Backend section.
3. Copy these files from `noam-ai/site-companion/DEPLOY_WIX/backend/` into that Backend section. Keep each file name exactly as it is.

| File you copy | Where it goes |
| --- | --- |
| `noam-site-companion.js` | Backend / `noam-site-companion.js` |
| `noam-site-companion-core.js` | Backend / `noam-site-companion-core.js` |
| `noam-site-companion-retrieve.js` | Backend / `noam-site-companion-retrieve.js` |
| `noam-site-companion-guard.js` | Backend / `noam-site-companion-guard.js` |
| `noam-site-catalog.js` | Backend / `noam-site-catalog.js` |

Do not copy `PASTE-AT-END-OF-http-functions.js` as its own backend file. That one is only the text in step 2.

Do not copy `noam-site-companion.js` from the website folder. The website file and the backend file have the same name and different jobs.

The page list is already inside `noam-site-catalog.js`. Do not empty it and do not edit it.

`noam-site-catalog.js` is about 406 KB. That size is expected. On the file in GitHub, click **Copy raw file**, then in the Wix backend create a file with the same name, paste, and save. Do not select-all in the browser, and do not shorten the file.

If the Wix editor is slow, freezes, or the paste comes out shorter than the original, wait until it finishes and check that the file still ends with `};`. If the ending is missing or the editor will not take the whole file, stop. Do not publish, and do not delete lines to make it fit. Tell Grok Bot.

## 2. Paste the two routes into the existing http-functions file

1. In the same Backend section, open the file that is already named `http-functions.js`.
2. Scroll to the **bottom**. Do not delete anything that is already there.
3. Open `noam-ai/site-companion/DEPLOY_WIX/backend/PASTE-AT-END-OF-http-functions.js` from this repo.
4. Select the whole file and paste it at the bottom of `http-functions.js`.
5. Save.

The pasted block already names the routes. You do not look for other names and you do not edit the paste.

## 3. Qwen secret

The files you copied already read the existing secret named **QWEN_API_KEY**.

- Do not create a secret.
- Do not rename it.
- Do not open another backend file to compare names.

## 4. Allowed sites

Already checked. No checking is needed.

The list is exactly these two addresses, and it already matches the live AI routes:

- `https://www.noamdoronmath.co.il`
- `https://noamdoronmath.co.il`

There is no `*`. A preview address is refused, same as the live AI routes.

## 5. reCAPTCHA

The files you copied already use these values. Do not change them and do not create a secret.

- Secret name: **RECAPTCHA_SECRET_KEY**
- Lowest accepted score: **0.5**
- Check name: **noam_site_companion**

The website already sends the check through the existing bot client. A missing check, a score below 0.5, or the wrong check name is refused before any AI call.

The server also refuses a message longer than 700 characters, and more than 12 requests per minute from the same visitor address. That address is the one Wix records (`request.ip`). A visitor cannot pick a different address by sending a header.

## 6. Look at the secret names, then publish

Before you publish, open Secrets Manager. The path is **Code sidebar > Developer Tools > Security > Secrets Manager**, or **Dashboard > Developer Tools > Secrets Manager**. Look only.

You should see both of these names, spelled exactly like this:

- `QWEN_API_KEY`
- `RECAPTCHA_SECRET_KEY`

Do not open a secret, do not copy its value, and do not create, rename, or change anything.

If either name is missing, or it is spelled differently, stop. Do not publish. Tell Grok Bot which name is missing.

When both names are there and you want the live AI call, publish `my-site-2` from the Wix editor.

Publishing that site also publishes **any other changes still waiting in the editor** on `my-site-2`, not only these new files. Look through the editor first so you are not publishing something else by accident.

Do not ask an agent to run `wix release`.

Merging the website pull request does not publish this backend. Publishing this backend does not put the new button on the website. The button reaches visitors only after the pull request is merged and the website is published.

## 7. Run these checks

Use the browser on the live site, `https://www.noamdoronmath.co.il`.

1. Press F12, open the Console tab, paste this line, and press Enter.

Chrome may refuse the paste and ask you to type `allow pasting` and press Enter. If it does, type that, then paste the line again.

```js
fetch("https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion", {method:"OPTIONS"}).then(r => console.log("from live site:", r.status))
```

2. What you see:

On this live site, the console prints a number only when the result is 204. If the backend is not published yet, if the call is refused, or if the server has an error, Chrome shows the same red message and does not print 404, 403, or 500.

| What you see | What it means |
| --- | --- |
| The line `from live site: 204` | The live site is allowed and the backend answered. This check passed. |
| A red message that says `blocked by CORS policy` or `Failed to fetch`, and no number | This check did not pass. That same red message is what you see when the backend is not published yet, when the call is refused, and when the server has an error. The console will not show 404. |

To tell those failures apart, use the terminal checks in items 3, 4, and 5 below. A server error also shows up in the Wix editor under **Logs** (Developer / Monitoring / Logs) for `noamSiteCompanion`.

3. Check that a foreign address is refused. On your computer, in a terminal, run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  -H "Origin: https://example.com" \
  "https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion"
```

`403` means a foreign address is refused. `404` means the backend is not published yet.

4. Check that a call with no security token is refused. Run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Origin: https://www.noamdoronmath.co.il" \
  -H "Content-Type: application/json" \
  -d '{"message":"פירוק לגורמים"}' \
  "https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion"
```

`403` means the missing security check was refused and the model was not called. `404` means the backend is not published yet.

5. Check a too-long message. On a Mac, the first time you run `python3` the Mac may ask to install the Apple developer tools. That install is a normal Mac prompt. Both of Noam's computers are MacBooks, so allow the install if it asks, then run the command again. Run:

```bash
python3 - <<'PY'
import json, urllib.request
body = json.dumps({"message": "א" * 701, "botVerification": {"provider": "recaptcha-v3", "token": "x"}}).encode()
req = urllib.request.Request(
    "https://amiramnoam.wixstudio.com/my-site-2/_functions/noamSiteCompanion",
    data=body,
    headers={"Origin": "https://www.noamdoronmath.co.il", "Content-Type": "application/json"},
    method="POST",
)
try:
    print(urllib.request.urlopen(req).status)
except Exception as error:
    print(getattr(error, "code", error))
PY
```

`400` means the long message was refused. `404` means the backend is not published yet.

6. On a worksheet page, after the **website** is merged and published, ask in Noam AI: `איך פותרים את שאלה 3?` The answer should point to Ramzi even if the backend is down. Then click **עזרה מרמזי**. Ramzi's panel should open on the page. This website check cannot pass before the merge and the website publish.

## 8. If something breaks, switch Noam AI off

1. Open Backend / `http-functions.js` on `my-site-2`.
2. Delete only the block you pasted in step 2 (the lines that mention `noamSiteCompanion`). Leave every older line in place.
3. Publish `my-site-2` again.

The button on the website, once that website is published, will stop reaching the model and will show the safe "not available" message. Ramzi is unchanged.

If a check returns 500, open the Wix editor and look at **Logs**. The useful lines mention `noamSiteCompanion`.
