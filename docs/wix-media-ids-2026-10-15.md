# Wix media IDs — 2026-10-15

Upload of student pages to the Wix media library of noamdoronmath.co.il did **not** run.

No publish, no `wix release`, no merge. G8-T26 and G9-T32 were not touched.

## Blocker

The only injected Wix secret is `WIX_FORMS_API_KEY` (valid `IST.` key, Forms scope).

`POST https://www.wixapis.com/site-media/v1/files/generate-upload-url` with site `36dd9544-acf9-4e85-a01a-798f3c1efbb9` returned **403 `PERMISSION_DENIED`**.

Missing secret: a Wix API key for that meta site with **Manage Media Manager** (`SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER`). `WIX_CLI_API_KEY` is not injected.

Student files were not uploaded and sha256 was not checked, because the credential check failed first. Local paths `~/worksheet-work/hub-18`, `~/Downloads`, and `~/Documents/Codex` are not on this machine.

## Table

| package | level | filename | sha256 verified | Wix media ID | file URL |
| --- | --- | --- | --- | --- | --- |
| G7-T28 | r1 | — | not checked | — | — |
| G7-T28 | r2 | — | not checked | — | — |
| G7-T28 | r3 | — | not checked | — | — |
| G7-T47 | r1 | — | not checked | — | — |
| G7-T47 | r2 | — | not checked | — | — |
| G7-T47 | r3 | — | not checked | — | — |
| G7-T48 | r1 | — | not checked | — | — |
| G7-T48 | r2 | — | not checked | — | — |
| G7-T48 | r3 | — | not checked | — | — |
| G8-T11 | r1 | — | not checked | — | — |
| G8-T11 | r2 | — | not checked | — | — |
| G8-T11 | r3 | — | not checked | — | — |
| G8-T29 | r1 | — | not checked | — | — |
| G8-T29 | r2 | — | not checked | — | — |
| G8-T29 | r3 | — | not checked | — | — |
| G8-T37 | r1 | — | not checked | — | — |
| G8-T37 | r2 | — | not checked | — | — |
| G8-T37 | r3 | — | not checked | — | — |
| G8-T49 | r1 | — | not checked | — | — |
| G8-T49 | r2 | — | not checked | — | — |
| G8-T49 | r3 | — | not checked | — | — |
| G9-T17 | r1 | — | not checked | — | — |
| G9-T17 | r2 | — | not checked | — | — |
| G9-T17 | r3 | — | not checked | — | — |

Kimi Code: media IDs are **not** ready. Do not open the draft PRs yet.
