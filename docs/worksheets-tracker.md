# Worksheet tracker

One row per grade and topic in `headless/astro-poc/src/data/catalog.v1.json` on `headless/astro-poc-baseline`. The catalog blob is `e23b7c78` at `9eb9e25e`, at `5094bed6`, and at current baseline `49e5309a`. That file is generated from `index.html`. Level names are the catalog labels (`רמת מצוינות` is the catalog string; it was not renamed).

Columns: grade, topic, levels present, author, reviewed, live, PR.

- Author is `unknown` for every row. No per-topic author was found in merged PR text or in hub issue 2.
- Live `pilot page 200` means that `(G#-T#)` id was in the HTML of a production pilot index that returned HTTP 200 on 2026-10-21. Indexes: `approved-three-20261019` (3), `next-ten-20261019` (10), `second-ten-20261019` (10), `third-ten-20261019` (10), `fourth-ten-20261019` (10), `remaining-101-20261019` (101). 144 ids, no duplicates. This is not a check of the catalog topic page, and not a per-exercise or Ramzi check. Rows that were not on those pages stay `unknown`.
- Reviewed `yes` means the current PDF id is still the reviewed replacement from #98 (grade 9), #99 (grade 8), or #100 (grade 7).
- Reviewed `no (#104...)` means the current PDF id was written by #104, which skipped Qwen and DeepSeek review.
- #88 replaced specific grade 3 and grade 6 media ids (round 6). That PR does not say those sheets were reviewed, so those levels stay `unknown` and the PR is listed on that level only.
- #100 names three levels that failed review and were not changed: G7-T02 c, G7-T04 b, G7-T11 c. Other levels left off the replacement lists are `unknown`, not failed.
- Hub `noamd-collab/noam-agent-hub` issue 2 was read (259 comments). It names no per-topic author, so Author stays `unknown`. It does not change the #98/#99/#100 review cells. Comment 6268157191 (2026-10-19) said the same six indexes were HTTP 200; this file uses the 2026-10-21 fetch, not that comment alone.
- On 2026-10-22 the newest issue 2 comments through 6342772314 were read (297 comments on the issue). They still name no per-topic author. Comment 6337256997 records that PR #225 was merged and published. Comment 6337583809 records that PR #224 was merged and published. Comment 6337591198 tells Codex 2 not to merge PR #215. Comment 6342772314 tells Codex 2 that נועם approved merging PR #223 into `headless/astro-poc-baseline`. None of these is a per-topic worksheet check, so Live cells stay the 2026-10-21 pilot-index fetch.
- On 2026-10-24 issue 2 comments through 6385135885 were read (311 comments). They still name no per-topic author, so Author stays `unknown`. They do not name a new per-topic review or a new live check, so Reviewed and Live stay as written above. Comment 6351307884 says the main-branch switch stays unmerged until נועם approves it. Comment 6367864797 says PR #215 stays aside and must not be merged, and that Otterly (#224 and #225) must not be removed. Comments 6367885146, 6368452224, and 6368564788 are about #221 and #229, not catalog topic rows.
- On 2026-10-25 issue 2 comments through 6396629964 were read (317 comments). They still name no per-topic author, review, or live check, so those cells stay as written. Comment 6385156715 and comment 6389549053 are about #229 (the Pythagoras game and home blocks), not a catalog topic row. Comment 6390319655 is a ZCode communications fix, not a worksheet row. Comment 6396623066 is a Cursor Wix-media check, not a worksheet row. Baseline commits after `9eb9e25e` through `5094bed6` publish #229 and the teacher print pack (#221). They do not change the catalog blob.
- On 2026-10-25 at 14:13 Israel time, issue 2 comments through 6396809002 were read (320 comments). They still name no per-topic author, review, or live check, so those cells stay as written. Comment 6396657245 and comment 6396750779 are Cursor session registrations. Comment 6396809002 is about SEO PRs #43–#49 and #223, not a catalog topic row. `main` was still `14ed7bf7` and baseline was still `5094bed6`. The catalog blob was still `e23b7c78`.
- On 2026-10-25 at 17:01 Israel time, issue 2 comments through 6397517628 were read (325 comments). They still name no per-topic author, review, or live check, so those cells stay as written. Comment 6397494451 is this conversation's earlier registration. Comment 6397497689, comment 6397510362, comment 6397510811, and comment 6397517628 are a Wix media-upload check and its receipts, not catalog topic rows. Baseline `49e5309a` includes merged #223 and #232. The catalog blob is still `e23b7c78`. Issue 1 was not re-read; it still shows 2500 comments and was last updated 2026-10-19.
- On 2026-10-25 at 19:56 Israel time, issue 2 comments through 6399301419 were read (327 comments). They still name no per-topic author, review, or live check, so those cells stay as written. Comment 6399279681 is this conversation's earlier registration. Comment 6399301419 is a Cursor status note on merged SEO PRs #43–#49 and #223, not a catalog topic row. `main` is `5a9bb2fc` and baseline is still `49e5309a` (merged PRs #230–#236 do not change worksheet rows). The catalog blob is still `e23b7c78`.
- On 2026-10-27 at 13:34 Israel time, issue 2 comments through 6428594615 were read (332 comments). They still name no per-topic author, review, or live check, so those cells stay as written. Comment 6401131972 is this conversation's earlier registration. Comment 6401204794 (Google Antigravity on Pythagoras step 7 PR #238) and its receipt 6401210767, plus Grok Bot daily summaries 6403987862 and 6428594615, are not catalog topic rows. `main` is still `5a9bb2fc` and baseline is still `49e5309a`. The catalog blob is still `e23b7c78`.
- On 2026-10-27 at 15:56 Israel time, issue 2 comments through 6443761791 were read (337 comments). They still name no per-topic author, review, or live check, so those cells stay as written. Comment 6440916634 is this conversation's earlier registration, comments 6442534775 and 6443675298 are Cursor SEO status notes, and comment 6443669381 (acknowledged in receipt 6443761791) cancels Qwen/DeepSeek checks. `main` is `9647d0d4` (merged #239 does not change worksheet rows) and baseline is still `49e5309a`. The catalog blob is still `e23b7c78`.
- Topic titles match `catalog.v1.json` at `9eb9e25e`. Twenty-four titles changed spelling in `d3bb8361` (Hebrew hyphens and geresh). That spelling commit did not change review, author, live, or PR cells.
- These ids are in the table and were not in any of the six index pages on 2026-10-21, so Live stays `unknown`: G8-T65, G9-T16, G9-T21, G9-T22, G9-T23, G9-T24, G9-T25, G9-T26, G9-T27, G9-T28, G9-T29, G9-T30, G9-T41, G9-T42, G9-T43, G9-T44, G9-T45.
- Unlisted pilot pages in this repo (direct-link only; these PRs say the catalog was not changed): #185 `worksheet-pilot.v1.json`, #189 `worksheet-next-ten.v1.json`, #190 `worksheet-second-ten.v1.json`, #192 `worksheet-third-ten.v1.json`, #193 `worksheet-fourth-ten.v1.json`, #195 `worksheet-remaining-101.v1.json`. When a row's `(G#-T#)` id is the sheet `x` in one of those files, that PR is listed as unlisted. Author was not in those files. Reviewed cells were not changed. Live for an id on one of the six indexes is `pilot page 200`.
- G8-T66 «שני מקורות מידע» is grade 8 in #195 (`x` G8-T66, keys a/b/c) and is not in `catalog.v1.json`, so it has its own row. Hebrew level names are not in that file; the row uses the catalog default for keys a/b/c (`רמה א׳`, `רמה ב׳`, `רמת מצוינות`), which #104 states for those keys.
- Topics named in the staging stub as pending (G7-T28, G7-T47, G7-T48, G8-T11, G8-T26, G8-T29, G8-T37, G8-T49, G8-T35, G9-T17, G9-T32) are filled only from the catalog and the PRs above. The stub's author and pending status were not copied.

| Grade | Topic | Levels | Author | Reviewed | Live | PR |
|---|---|---|---|---|---|---|
| כיתה א׳ | מונים בלי לפספס (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | קוראים כותבים ומייצגים עד 100 (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | סדר שכנים והשוואה (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מרכיבים ומפרקים עד 10 (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיבור בתחום 10 (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיסור בתחום 10 (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | בונים 20 דרך 10 (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיבור בתחום 20 (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חיסור בתחום 20 (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | שוויון נעלם והשוואת תרגילים (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | דפוסים וסדרות (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | חוקרים את לוח המאה (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | שרשראות ופירמידות מספרים (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | בעיות מילוליות בציור ובמספר (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מודדים ומשווים אורך (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | קבוצות שוות וחיבור חוזר (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מצולעים (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | ריבוע ומלבן (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | מרכיבים ומפרקים (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | שעה שלמה (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | נתונים (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | בעיות מילוליות פשוטות (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה א׳ | הרכבה ופירוק (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חוזרים להרכבות 10 ו־20 (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | עשרות ויחידות בתחום 100 (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | סדר השוואה וישר מספרים (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מוסיפים עשרות ומפרקים מספרים (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיבור דו־ספרתי ללא המרה (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיבור דו־ספרתי עם המרה (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיסור דו־ספרתי ללא פריטה (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חיסור דו־ספרתי עם פריטה (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | אסטרטגיות חישוב אומדן ופיצוי (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | שוויון ומספר חסר (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | בעיות מילוליות וכסף (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | קוראים טבלה ודיאגרמת עמודות (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מאות עשרות ויחידות (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | ממיינים ומשווים מספרים עד 1000 (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מספרים עד 1000 (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | כפל קבוצות שוות ומערכים (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חילוק להכלה (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חילוק לחלקים שווים (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | משפחת כפל וחילוק (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | פי בקבוצות שוות (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | זוגי אי־זוגי וסדרות א׳ (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | זוגי אי־זוגי וסדרות ב׳ (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | מדידת אורך (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | בעיות מילוליות וכסף פשוט (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | שעון ומשך זמן (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | חצי ורבע (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | צורות וגופים לא אותו דבר (id 28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | סימטרייה שיקופית אינטואיטיבית (id 29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ב׳ | סיכום מספרים פעולות וייצוגים (id 30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | ערך מקום (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | שכנים וישר מספרים (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | סדרות ואיתור טעות (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | אל הרבבה (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | אומדן באמצעות מספרים קרובים (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | חיבור בטור עם המרה (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | חיסור בטור עם פריטה (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 (c) |
| כיתה ג׳ | בעיות מילוליות (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | כפל עובדות ומבנים (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | חילוק והקשר ההפוך לכפל (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | שברי יחידה וחלק משלם (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | זווית וסוגי זוויות (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | קווים וזוויות בצורות מוכרות (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מצולעים צלעות וקודקודים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | היקף מצולעים (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מיון משולשים (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מרובעים לפי תכונות (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | צורות על רשת בנייה ופירוק (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מדידות זמן ומשקל (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | קוראים דיאגרמה (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | חילוק ובדיקה בכפל (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | מדידות אורך ס״מ ומטר (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | בונים ומפרקים צורות (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ג׳ | אוספים נתונים (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ג׳ | כסף (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מספרים עד מיליון קריאה ופירוק (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סדר שכנים ועיגול בתחום המיליון (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חיבור רב־ספרתי בטור (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חיסור רב־ספרתי בטור (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | אומדן ובעיות חיבור וחיסור כולל כסף (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חוקי פעולות וכפל בעשרות שלמות (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סדר פעולות חשבון (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חוק הפילוג ומכפלות חלקיות (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | כפל רב־ספרתי (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | חילוק ארוך ושארית (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שבר ייצוגים ושמות שקולים (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שברים על ישר והשוואה (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שברים שקולים ייצוגים השוואה וישר מספרים (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | התחלקות וגורמים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מספרים ראשוניים ופריקים (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מקבילים ומאונכים בצורות (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מצולעים ואלכסונים (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מלבנים ריבועים ויחסי הכלה (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סוגי זוויות (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מיון משולשים (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | יחידות אורך והמרות (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שטח והיקף של מלבן וריבוע (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | שטח והיקף של צורות מורכבות (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | זמן ומשקל המרות ויישום (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | דיאגרמות ומסקנות (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | סימטריה שיקופית וסיבובית (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | זוויות וקווים במישור (id 27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | משולשים מיון ובנייה (id 28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | מרובעים תכונות מיון והכלה (id 29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ד׳ | דף סיכום אינטגרטיבי לכיתה ד׳ (id 31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | תובנה מספרית כפל וחילוק בעשרות ומאות (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | מספרים גדולים ערך מקום עיגול ואומדן (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | כפל רב־ספרתי ובדיקת סבירות (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חילוק מאונך ושארית (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | גורמים ראשוניים ופריקים (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | סדר פעולות תכנון ולא רק ביצוע (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חזרה על משמעות השבר וייצוגיו (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שברים על ישר והשוואה (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | הרחבה וצמצום שברים שקולים (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | מכנה משותף בחירה יעילה (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חיבור וחיסור שברים במכנים שונים (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חלק מכמות (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שברים גדולים מ־1 ומספרים מעורבים (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חיבור וחיסור מספרים מעורבים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | השלמת שברים ופעולות הפוכות (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | קריאת טבלאות וחישוב נתונים (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | קריאת גרפים והשוואת נתונים (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | משפחת המרובעים ויחסי הכלה (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | תכונות ואלכסונים במרובעים (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | בניית צורות ומיון לפי תכונות (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | המרות יחידות ומדידת משקל (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | היקף יחידות וקווים מקבילים מאונכים (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | גובה במשולש חד־זווית וישר־זווית (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | גובה במשולש קהה ובמקבילית (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח והיקף של מלבנים וריבועים (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח צורה מורכבת פירוק והרכבה (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח מקבילית והקשר למלבן (id 27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | מספרים עשרוניים ערך מקום וייצוגים (id 28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | משווים שברים ומספרים עשרוניים (id 29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | חיבור וחיסור מספרים עשרוניים ואומדן (id 30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שטח משולש בסיס וגובה (id 31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | נעלמים ומשוואות בשברים (id 32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | ממוצע וחקר נתונים (id 33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שכיחות סיכוי וזמן מתוך נתונים (id 34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ה׳ | שיקוף סיבוב והזזה (id 35) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל שבר במספר שלם (id 1) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל כחלק מכמות ושטח (id 2) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל שבר בשבר (id 3) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל מספרים מעורבים (id 4) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל שברים יישום ובקרה (id 5) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | משמעות חילוק שברים (id 6) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | אלגוריתם חילוק שברים והופכי (id 7) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל וחילוק שברים בחירת פעולה (id 8) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | כפל מספרים עשרוניים (id 9) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | חילוק מספרים עשרוניים (id 10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | חקר גופים ותכונותיהם (id 11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | תיבות ופריסות מעבר בין דו־ממד לתלת־ממד (id 12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | שטח פנים של תיבה (id 13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | נפח תיבה ומבנים (id 14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | קיבול סמ״ק ליטר ומ״ק (id 15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | מרובעים ויחסי הכלה חזרה מנומקת (id 16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | דף סינתזה מדידות גאומטריה ופתרון רב־שלבי (id 17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | שבר עשרוני ואחוז שלושה ייצוגים לאותו מספר (id 18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | אחוז כחלק מכמות (id 19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | מציאת השלם ויישומי אחוזים (id 20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | יחס משמעות ייצוג ויחסים שקולים (id 21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 (c) |
| כיתה ו׳ | קנה מידה במפות ובשרטוטים (id 22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | מספרים ופעולות סדר אומדן ובדיקת סבירות (id 23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ו׳ | אוספים ומייצגים נתונים (id 24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ו׳ | משווים קבוצות ומנסחים מסקנות זהירות (id 25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | #88 |
| כיתה ו׳ | שינוי ממדים מה קורה להיקף לשטח ולנפח (id 26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ו׳ | חוקיות ופתרון בעיות רב־שלביות (id 27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ז׳ | מספרים מכוונים — ישר המספרים וערך מוחלט (G7-T01) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | חיבור וחיסור מספרים מכוונים (G7-T02) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b yes (#100); c failed review, not changed (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | כפל מספרים מכוונים (G7-T03) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | חילוק מספרים מכוונים (G7-T04) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b failed review, not changed (#100); c yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | סדר פעולות החשבון במספרים מכוונים (G7-T05) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | חזקות עם מעריך טבעי (G7-T06) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שורש ריבועי (G7-T07) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | מערכת צירים — היכרות וקנה מידה (G7-T08) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | הרחבת מערכת הצירים חלק 1 (G7-T09) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | הרחבת מערכת הצירים חלק 2 — יישום והעמקה (G7-T10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | זוויות חלק 1 — היכרות, סימון ומדידה (G7-T11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b yes (#100); c failed review, not changed (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | זוויות חלק 2 — יחסים ופעולות (G7-T12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | זוויות — דף חזרה מסכם (G7-T13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | סכום הזוויות במשולש ובמרובע (G7-T14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | משולשים מיוחדים (G7-T15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | משולש שווה־צלעות — העמקה ורשות (G7-T16) | העמקה ורשות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | מצולעים חופפים וטרנספורמציות (G7-T17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שטח מלבן וריבוע — העמקה (G7-T18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שטח משולש — העמקה (G7-T19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | תיבה וקובייה (G7-T20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | חוקיות (G7-T21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | משתנים וביטויים אלגבריים — שפה ומידול (G7-T22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | הצבה בביטויים אלגבריים (G7-T23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | איסוף וקריאת מידע (G7-T24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ז׳ | שכיחות (G7-T25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ז׳ | שכיחות יחסית חלק 1 — היכרות (G7-T26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ז׳ | שכיחות יחסית חלק 2 — ניסויים ויציבות (G7-T27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ז׳ | הסתברות — היכרות (G7-T28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ז׳ | שוויון ביטויים חלק 1 — כינוס ופילוג (G7-T29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שוויון ביטויים חלק 2 — גורם משותף ומינוס לפני סוגריים (G7-T30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#100); c yes (#100) | pilot page 200 | #100 (b,c); #195 (unlisted) |
| כיתה ז׳ | נקודות על גרף ברביע הראשון (G7-T31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | מהו פתרון של משוואה (G7-T32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#100); b yes (#100); c unknown | pilot page 200 | #100 (a,b); #195 (unlisted) |
| כיתה ז׳ | משוואות ופתרונן חלק 1 — מבוא (G7-T33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#100); c yes (#100) | pilot page 200 | #100 (b,c); #195 (unlisted) |
| כיתה ז׳ | משוואות חד־שלביות (G7-T34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | משוואות דו־שלביות (G7-T35) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | מפשטים ואז פותרים (G7-T36) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | משוואות ופתרונן חלק 2 — סוגריים ושקילות (G7-T37) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | סוגריים וחוק הפילוג (G7-T38) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | הנעלם בשני האגפים (G7-T39) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שלושה ייצוגים לפתרון משוואה (G7-T40) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שאלות מילוליות באמצעות משוואות (G7-T41) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | פיתגורס חלק 1 — היכרות וחישוב (G7-T42) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | פיתגורס חלק 2 — שימושים (G7-T43) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | חישובי היקף — צורות מורכבות ואלגברה (G7-T44) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שטחים ב׳ חלק 1 — מקבילית וטרפז (G7-T45) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | שטחים ב׳ חלק 2 — מצולעים מורכבים (G7-T46) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#100) | pilot page 200 | #100; #195 (unlisted) |
| כיתה ז׳ | מנסרה משולשת חלק 1 — מבנה ונפח (G7-T47) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ז׳ | מנסרה משולשת חלק 2 — שטח פנים (G7-T48) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ז׳ | חזרה שנתית (G7-T49) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ז׳ | משימת הערכה 1 (G7-T50) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | אבחון קדם־ידע (G8-T01) | דף יחיד — כל הרמות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #193 (unlisted) |
| כיתה ח׳ | משוואות ליניאריות (G8-T02) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#99); b unknown; c yes (#99) | pilot page 200 | #99 (a,c); #195 (unlisted) |
| כיתה ח׳ | מכנים מספריים (G8-T03) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | יחס ופרופורציה (G8-T24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | קנה מידה (G8-T25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | אחוזים — ייצוגים (G8-T20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | בעיות אחוזים (G8-T21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | שינוי באחוזים (G8-T22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | שינויים עוקבים (G8-T23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | שורש ריבועי (G8-T48) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | פיתגורס (G8-T49) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #185 (unlisted) |
| כיתה ח׳ | פיתגורס מורכב (G8-T50) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | גליל — שטח פנים (G8-T52) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #192 (unlisted) |
| כיתה ח׳ | גליל — נפח (G8-T53) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #192 (unlisted) |
| כיתה ח׳ | חרוט (G8-T54) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #192 (unlisted) |
| כיתה ח׳ | ארגון נתונים (G8-T28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | עמודות ופיקטוגרמות (G8-T29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | דיאגרמת עוגה (G8-T30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | מושג הפונקציה (G8-T11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | סימון פונקציה (G8-T16) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | מעבר בין ייצוגים (G8-T12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | טווח הנתונים (G8-T31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | הממוצע (G8-T32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | החציון (G8-T33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | בחירת מדד (G8-T34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | אוריינות וביקורת ייצוג (G8-T35) | דף יחיד — כל הרמות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #189 (unlisted) |
| כיתה ח׳ | קצב השתנות (G8-T13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | שיפוע וישר y=mx (G8-T14) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | פונקציה קווית (G8-T15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #195 (unlisted) |
| כיתה ח׳ | חיתוך צירים (G8-T17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | משוואת ישר (G8-T18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | ישרים מקבילים לצירים (G8-T19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | תנועה (G8-T10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | אבחון אמצע שנה (G8-T26) | דף יחיד — כל הרמות | unknown | unknown | pilot page 200 | #185 (unlisted) |
| כיתה ח׳ | גישור ותיקון פערים (G8-T27) | דף יחיד — כל הרמות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | חפיפת משולשים (G8-T38) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#99); b yes (#99); c unknown | pilot page 200 | #99 (a,b); #195 (unlisted) |
| כיתה ח׳ | משפטי חפיפה (G8-T39) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#99); c yes (#99) | pilot page 200 | #99 (b,c); #195 (unlisted) |
| כיתה ח׳ | הוכחה גאומטרית (G8-T40) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | זווית חיצונית (G8-T41) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#99); b yes (#99); c unknown | pilot page 200 | #99 (a,b); #195 (unlisted) |
| כיתה ח׳ | משולש שווה־שוקיים (G8-T42) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | הוכחה — שווה־שוקיים (G8-T43) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | התיכון במשולש (G8-T44) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | דמיון משולשים (G8-T45) | רמה א׳, רמה ב׳, רמת מצוינות, מצוינות 2 | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | הוכחת דמיון (G8-T46) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | יחס שטחים (G8-T47) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | מילוליות — בחירת נעלמים (G8-T09) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #193 (unlisted) |
| כיתה ח׳ | מערכות — חיתוך גרפי (G8-T06) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | מערכות — פתרון אלגברי (G8-T07) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #193 (unlisted) |
| כיתה ח׳ | מערכות — מידול (G8-T08) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #190 (unlisted) |
| כיתה ח׳ | הסתברות — מרחב תוצאות (G8-T36) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ח׳ | הסתברות — ניסוי והוגנות (G8-T37) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | אי־שוויון (G8-T04) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a unknown; b yes (#99); c yes (#99) | pilot page 200 | #99 (b,c); #195 (unlisted) |
| כיתה ח׳ | אי־שוויון גרפי (G8-T05) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | פיתגורס במרחב (G8-T51) | רמה א׳, רמה ב׳, רמת מצוינות, מצוינות 2 | unknown | yes (#99) | pilot page 200 | #99; #192 (unlisted) |
| כיתה ח׳ | סינתזה גאומטרית (G8-T55) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#99) | pilot page 200 | #99; #192 (unlisted) |
| כיתה ח׳ | העמקה — בעיות לא שגרתיות (G8-T56) | העמקה | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | העמקה — חקר והכללה (G8-T57) | העמקה | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | חזרה מסכמת (G8-T58) | דף תלמיד | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | הערכה מסכמת (G8-T59) | דף תלמיד | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | אבחון סוף שנה (G8-T60) | דף תלמיד | unknown | yes (#99) | pilot page 200 | #99; #189 (unlisted) |
| כיתה ח׳ | אינטרפולציה ואקסטרפולציה (G8-T61) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | זוויות בין ישרים מקבילים (G8-T62) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | מעגל ועיגול — היקף ושטח (G8-T63) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | משימת הערכה 1 (G8-T64) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ח׳ | הוכחות בחפיפת משולשים (G8-T65) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ח׳ | שני מקורות מידע (G8-T66) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | חוק הפילוג המורחב (G9-T02) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #192 (unlisted) |
| כיתה ט׳ | פירוק לגורמים (G9-T03) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | צמצום שברים אלגבריים (G9-T04) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #195 (unlisted) |
| כיתה ט׳ | משולש שווה־שוקיים (G9-T15) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #195 (unlisted) |
| כיתה ט׳ | הפונקציה הריבועית (G9-T06) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #195 (unlisted) |
| כיתה ט׳ | משוואות ריבועיות ונוסחת השורשים (G9-T31) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #195 (unlisted) |
| כיתה ט׳ | המקבילית (G9-T17) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | אי־שוויונות ריבועיים ומערכות משוואות (G9-T07) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #192 (unlisted) |
| כיתה ט׳ | סטטיסטיקה (G9-T10) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | הסתברות (G9-T11) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | המלבן (G9-T18) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | קדם אנליזה — מפונקציות לגרפים ובחזרה (G9-T12) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | המעוין (G9-T19) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | a yes (#98); b unknown; c yes (#98) | pilot page 200 | #98 (a,c); #195 (unlisted) |
| כיתה ט׳ | הריבוע (G9-T20) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | גיאומטריה אנליטית (G9-T08) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #192 (unlisted) |
| כיתה ט׳ | חוקי חזקות (G9-T01) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #192 (unlisted) |
| כיתה ט׳ | שורשים (G9-T05) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #192 (unlisted) |
| כיתה ט׳ | בעיות מילוליות (G9-T09) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #195 (unlisted) |
| כיתה ט׳ | דמיון משולשים (G9-T32) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #185 (unlisted) |
| כיתה ט׳ | מעבר לחטיבה העליונה (G9-T13) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | yes (#98) | pilot page 200 | #98; #193 (unlisted) |
| כיתה ט׳ | משולש שווה־צלעות — העמקה ורשות — לכיתה ט׳ (G9-T16) | דף יחיד — כל הרמות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מצולעים חופפים וטרנספורמציות — לכיתה ט׳ (G9-T21) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פיתגורס חלק 1 — היכרות וחישוב — לכיתה ט׳ (G9-T22) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פיתגורס חלק 2 — שימושים — לכיתה ט׳ (G9-T23) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטח מלבן וריבוע — העמקה — לכיתה ט׳ (G9-T24) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטח משולש — העמקה — לכיתה ט׳ (G9-T25) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטחים ב׳ חלק 1 — מקבילית וטרפז — לכיתה ט׳ (G9-T26) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | שטחים ב׳ חלק 2 — מצולעים מורכבים — לכיתה ט׳ (G9-T27) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מנסרה משולשת חלק 1 — מבנה ונפח — לכיתה ט׳ (G9-T28) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | מנסרה משולשת חלק 2 — שטח פנים — לכיתה ט׳ (G9-T29) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | הרחבת מערכת הצירים חלק 2 — יישום והעמקה — לכיתה ט׳ (G9-T30) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | גיאומטריה חישובית — משולש (G9-T33) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | פונקציה קווית (G9-T34) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | משפט פיתגורס (G9-T35) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | קריאת גרפים (G9-T36) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | משולש ישר־זווית 30–60–90 (G9-T37) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | יחסי צלעות וזוויות (G9-T38) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | הטרפז (G9-T39) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
| כיתה ט׳ | דמיון משולשים — משפט ז.ז וחישובים (G9-T40) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | pilot page 200 | #195 (unlisted) |
| כיתה ט׳ | פירוק לגורמים 1 — הוצאת גורם משותף (G9-T41, parent 2) | גורם משותף · רמה א׳ | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פירוק לגורמים 2 — נוסחאות הכפל המקוצר וטרינום (G9-T42, parent 2) | כפל מקוצר וטרינום · רמה א׳ | unknown | unknown | unknown | unknown |
| כיתה ט׳ | פירוק לגורמים 3 — פירוק מלא, משוואות ושברים אלגבריים (G9-T43, parent 2) | פירוק מלא ומשוואות · רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | דו־איבר בריבוע (G9-T44) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | הפרש ריבועים (G9-T45) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | unknown | unknown | unknown |
| כיתה ט׳ | דלתון (G9-T46) | רמה א׳, רמה ב׳, רמת מצוינות | unknown | no (#104, Qwen/DeepSeek skipped) | pilot page 200 | #104; #195 (unlisted) |
