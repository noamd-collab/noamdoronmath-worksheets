# FINAL design gap audit

Date: 2 Oct 2026. Baseline: `headless/astro-poc-baseline` at `28eba36` (PR #34, רמזי console). Design of record: `design_handoff_noam_site_FINAL` (28.9.2026). Binding files: `README.md` and `CURSOR_PROMPT.md`.

This is a research note. No site source was changed.

## How the comparison was made

- Design files were served locally and driven in Chrome (Playwright), viewport height 900, widths 1440, 1024, 768, 390.
- `Noam Math Site.dc.html` was walked with its own controls: דפי עבודה (opens on כיתה ז׳), then א׳, then בית → חטיבה ז׳–ט׳ → שטח משולש.
- Grade 4 was taken from `Grade Page Players.dc.html`. The viewer was taken from `Student Worksheet Preview.dc.html`.
- The live site is `https://www.noamdoronmath.co.il` (the user said this deploy is `28eba36`). A local `wix build` was not run.
- Hero in the design was pinned with `Math.random = () => 0.62`, which selects topic index 5, `tri7` / שטח משולש. The live hero is always that same topic, via `HeroLoop`.
- The design’s blocking notice appears 1.2s after load. Page shots were taken after הבנתי. The notice shots are the modal, on purpose.
- Side-by-side PNGs: `/opt/cursor/artifacts/screenshots/design-gap/side-{1440|1024|768|390}-{home|header|footer|ws-ysodi|ws-hatzava|grade7|grade4|topic|viewer|notice}.png`.
- “meanΔ” below is the average per-channel RGB difference on the overlapping crop, animations paused. It is a locator, not a design score. A dark modal over a cream page scores ~70. A copied footer scores under 3.

## Already close

| Surface | Evidence | What to do |
|---|---|---|
| Footer copy and chrome | meanΔ 2.8 at 1440, 0.3 at 1024, 2.5 at 768, 0.4 at 390 | Leave it. Do not pull the legal disclaimer out of the page data into the visual footer. |
| Desktop header chrome | 1440 header is 90px both sides, meanΔ 2.1. Sticky cream, 2px navy rule, logo 68px, בס״ד, הלמידה שלי | The remaining desktop gap is the worksheet label, below. |
| Home type, grade tiles, doodle slots | Home markup in `index.astro` already copies the file’s inline styles | The 1440 home meanΔ of 15.4 is mostly the hero widget column, not the type. |
| Motion modes | `exactReferenceMotion.js` already maps שובב / רגוע (lerp 0.06, playback 1.8) / כבוי onto `nd-motion-off`, `noam-a11y-motion`, `prefers-reduced-motion` | Do not rebuild. |
| Worksheet card chrome | Real cards already use the file’s border, code badge, and ✦ נועם AI pill when `routing.aiHintShown` | Do not restyle the card to show the sample topics. |
| Assets | Logo, doodles, and `ramzi-A-*.svg` are already under `/design-exact/assets/` | Do not redraw. Kimi is not needed for this gap. |

## Header heights (element box, not the page)

| Width | Design header | Live header |
|---|---|---|
| 1440 | 90px, one row, one link “דפי עבודה” | 90px, one row, two links |
| 1024 | 90px, still one row | 102px |
| 768 | 102px, nav starts to wrap, logo stays 68px, no hamburger | 144px, two long labels wrap further. Hamburger CSS starts only at `max-width: 767px`, so 768 is still the desktop nav |
| 390 | 254px, full wrap, logo 68px, הלמידה שלי stays in the row | 70px, hamburger, logo 52px, הלמידה שלי moves into the menu |

## Per-page gaps

Severity is about the visual miss against the FINAL files, after the functional rules. “Do not ship” means a literal copy would break a binding rule.

### Entry notice

| Gap | Design | Live | Severity |
|---|---|---|---|
| Pattern | Blocking `role="dialog"` `aria-modal="true"`. Overlay `rgba(34,48,90,.35)`. Title Secular One 26px. Gold progress bar (`noticeBarRef` is that bar, not a site bar). Navy הבנתי, gold shadow. Auto-dismiss 20s. `localStorage` key `noam-dev-notice-seen` | Non-blocking bar. Background `#fdf1d8`, 14px Heebo, border-bottom 2px `#22305a`, underlined הבנתי with min 44px, no snail, no progress, no persistence. Click removes the node only | High, and a rules conflict |

meanΔ 75 / 93% at 1440 because the modal darkens the whole page. The prompt already approved a bar and forbids restoring the modal. The file has no bar styles to copy. Flag, do not “fix” by putting the modal back.

### Header / nav

| Gap | Design (`Noam Math Site.dc.html` lines 27–44) | Live (`SiteHeader.astro`, `exact-site.css`) | Severity |
|---|---|---|---|
| Worksheet item | One pill, “דפי עבודה”, `href="#"` placeholder, `goWs` | Two real links: “דפי עבודה ליסודי” → `/worksheets?level=ysodi`, “דפי עבודה לחטיבת הביניים” → `/worksheets?level=hatzava` | High. URLs must stay. The label split is a product question |
| ≤390 layout | Wrap, logo 68px, learn button stays visible. No hamburger | Hamburger, logo 52px, learn button hidden into the panel. Panel links get `padding: 10px 12px` | High at 390 (254px vs 70px) |
| 768 | Wrap to 102px | Wrap to 144px from the two long labels | Med |
| Pill size | `padding: 8px 12px`, 15px type, about 34px tall | Same on desktop | Conflict, see below. Do not silently grow them |

Footer is not a gap. Skip link exists on the live site and not in the design. Keep the skip link.

### Home

| Gap | Design | Live | Severity |
|---|---|---|---|
| Hero widget | `MathWidget` rotates across `TP` (9 topics). Panel color from the topic’s grade. Label `כיתה ז׳ · שטח משולש` (grade + short title). Button ↻ נושא אחר calls `shuffleHero`. “לדף הנושא” opens that topic | Fixed `HeroLoop` (triangle area). Panel always `#e3f1ec`. Label always “הדגמה מתמטית”. Link always `/triangle-area-grade-7`. The ↻ button is present and does not rotate topics | High. 1440 home meanΔ 15.4, hottest in the widget column. Do not redraw the widget. Claude owns the loops |
| יסודי / חטיבה | `goGrade3` opens the grade screen on ג׳. `goGrade7` opens it on ז׳ | `/worksheets?grade=1` and `/worksheets?grade=7` | High, destination only. The button chrome already matches |
| למציאת משימת תרגול | `goWs` (worksheets, default ז׳) | `/worksheets` | Low. Same destination family. Keep the real href |
| Rest of the home | Grade tiles, doodles, WhatsApp, levels | Already copied from the file’s inline styles | Low. Do not restyle while fixing the hero |

### Worksheets hub

Design sample is not the catalog. Both rows of grade buttons already exist. Default screen is ז׳.

| Gap | Design | Live | Severity |
|---|---|---|---|
| Count line | Hardcoded “50 נושאים לפי תכנית הלימודים” on every grade | Real counts. Grade 1 is not 50. Grade 7 is 50 | High as a visual miss, do not ship the fake 50 |
| Group chips | Month chips for every grade, including יסודי | Grade 7 groups are months (ספטמבר…). Grade 1 groups are subjects (מספרים ומנייה, חיבור וחיסור, …) | High, do not replace catalog groups |
| Cards | 14 sample topics, T-codes, AI pill on every card | Real catalog, real PDF ids, AI pill only when `routing.aiHintShown` | Do not ship. Chrome is already the file’s chrome |
| Empty search | Snail + “לא מצאנו נושא כזה” | Confirm against the live empty state before editing. Do not change `SEARCH_TERMS` | Low until checked on a real empty query |

meanΔ at 1440: יסודי 14.2, חטיבה 15.2. The lower half is different cards, which is correct.

### Grade page

The two design files disagree. The prompt says `Grade Page Players.dc.html` is the pattern (one large player, grade 4 for every grade). The main file’s grade screen is a different layout. The screen label “שני נגנים” is stale: `PLAYERS` has exactly one player, ids `L08 L18 L26 L36 L45 L56`, panel `#f8ebe0`.

| Gap | Design | Live (`GradeHubPage` + `GradeLoopPlayer`) | Severity |
|---|---|---|---|
| Which layout | Main file: 2 columns, H1 `clamp(34px,4.4vw,54px)`, tilted white card, ↻ שוב, inline sample SVG per grade, walker + pencil | Players file: H1 `clamp(32px,4.4vw,52px)`, then one full-width player with a chip row, counter, question, explain, result, prev/next. Live follows this shell: “המחשות לכיתה …”, walker, pencil, one player | High against the main file. Medium against the players file |
| Inside the player | Sample SVGs and six grade-4 chips | `ConceptLoop` / the grade’s real pool. Button “ללולאה הבאה”, pause. No L08-style chips | Do not paste the sample SVGs. Prompt: diagrams stay on Claude’s contract. Do not invent a playlist from the grade-4 sample |
| Below the player | Main file: short topic cards + WhatsApp. Players file: the player only | SEO lead, catalog CTA, FAQ, topic lists, JSON-LD | Keep. The design omits them. Do not delete |

1440 meanΔ: grade 7 (vs main file) 15.4, grade 4 (vs players file) 17.1. At 390 both jump to ~37 because the player stacks differently from the sample.

### Topic page

Compared: design topic שטח משולש vs live `/triangle-area-grade-7`.

| Gap | Design | Live (`TopicPage.astro`) | Severity |
|---|---|---|---|
| Length | Short demo: crumbs, pencil, H1 `clamp(32px,4.2vw,50px)`, widget panel, one intro, one CTA “בחירת דף ורמה”, three level pills, dashed example, “נושאים נוספים” pills | Same shell pieces exist (crumbs, pencil, panel `#e3f1ec` for grade ≥ 7 else `#f8ebe0`, level links). Then a full SEO article, FAQ, and related content the design does not draw | Med for the shell (1440 meanΔ 12.9). Do not delete the article |
| Level hrefs | `href="#"` + `goWs` | Real PDF links, `target="_blank"` | Keep the real links |
| Widget | `MathWidget` variant for that topic | `TriangleAreaExplorer` or `ConceptLoop` | Place the existing loop. Do not rewrite it |

### Worksheet viewer + console

The design clearly differs. The prompt also says leave the just-shipped console unless that difference is one Noam still wants. Recommendation: record it, do not open a viewer PR until he marks a chrome delta.

| Gap | Design (`Student Worksheet Preview.dc.html`) | Live (`/worksheet-viewer-noam.html`, PR #34) | Severity |
|---|---|---|---|
| Page | Mock HTML paper, “חיבור שברים עם מכנים שונים”, כיתה ה׳ | Real PDF. Sample compared: grade 7, מספרים מכוונים, pdf `22303ba02b3b46c3ae2529e347cbce2b` | Do not replace the PDF |
| Header | Slim bar, logo 44px, three links, badge “הדגמה · לא האתר החי”, motion toggle | The viewer’s own toolbar (zoom, PDF tools). No demo badge | Do not add the badge |
| Console | Open by default, seeded chat | Closed until the FAB “עזרה מרמזי”. Avatar, name, and status already match the רמזי restyle | Leave the logic. Note the open-vs-closed difference |
| Breakpoint | Narrow when `innerWidth < 1000` or `innerHeight < 640` | The same test is already in the viewer (`narrow=window.innerWidth<1000\|\|window.innerHeight<640`) | Low. Already aligned |

1440 viewer meanΔ 19.9 is the mock paper plus the open console, not a missing restyle.

## Rules and accessibility conflicts

Do not silently “match the file” on these.

1. **Notice.** Prompt: non-blocking bar, using the file’s styling. File: only a modal, and `noticeBarRef` is the modal’s gold timer. Restoring the modal violates the prompt. Inventing bar tokens invents design. Noam has to pick the tokens.
2. **Nav and grade pills under 44px.** Design nav is `padding: 8px 12px` at 15px, about 34px tall. Grade tabs are `padding: 8px 14px`. Level pills on the topic page are `padding: 8px 14px` at 14px. The live desktop nav copied the short pills. The mobile drawer links are closer (`10px 12px`) but still short of 44px. Flag. Do not silently enlarge.
3. **Hamburger vs the 390 wrap.** The design has no hamburger and keeps a 68px logo, so the header becomes 254px. The live hamburger is the 44px-target pattern and shrinks the logo to 52px. Copying the wrap makes the first screen mostly header.
4. **One “דפי עבודה” vs two URLs.** The design’s `href="#"` is a placeholder. The live site has two real destinations that must not change. A single label needs a destination Noam chooses, or a control that still exposes both URLs.
5. **Contrast, computed on the shared palette.**
   - `#22305a` on `#fbfaf5` = 12.26, AA.
   - `#5a6588` on cream = 5.50, AA. `#4a5478` on cream = 7.10, AA.
   - `#e6a534` on white = 2.14, fail. Fine as a fill or shadow, not as small text.
   - `#c98a1a` on cream = 2.82, fail. The design uses it for small angle labels (α, β).
   - `#e5735c` on white = 3.03, large text only. Navy on that coral = 4.23, large text only.
   - `#2a7c7a` on cream = 4.71, AA for normal text is tight. `#1e605e` on cream = 6.95, AA.
   - Notice bar, navy on `#fdf1d8` = 11.44, AA.
6. **Catalog, PDF ids, SEO, הלמידה שלי, Noam AI answers.** The sample “50 נושאים”, month chips on יסודי, fake T-codes, and the viewer’s paper worksheet are not content to import.
7. **Grade diagrams.** Pasting `Grade Page Players` sample SVGs, or the main file’s per-grade inline SVGs, rewrites loops Claude owns.
8. **Skip link and focus rings.** Not in the main design file. The players file does set `outline: 3px solid #e6a534`. Keep the live skip link and visible focus.

## Questions only Noam can answer

1. Keep the approved non-blocking bar? The FINAL file never styles a bar. If yes, which tokens (the current `#fdf1d8` / 14px / underline button, or something else)?
2. One nav item “דפי עבודה”, or the two real links? The two URLs cannot be removed.
3. At 390, keep the hamburger (logo 52px, header 70px), or force the design’s wrapping header (logo 68px, header 254px)?
4. Should יסודי א׳–ו׳ and חטיבה ז׳–ט׳ open grade hubs (`/grade-3`, `/grade-7`, as the design’s `goGrade3` / `goGrade7` do) or stay on `/worksheets?grade=1` and `?grade=7`?
5. Should the hero rotate across existing loops, with the file’s label `כיתה X · topic` and a working ↻ נושא אחר, or stay the single triangle hero?
6. Grade layout: the prompt names `Grade Page Players` (one full-width player). The main file still shows a side-by-side tilted card. Which one is the picture to match? The chip row in the players file uses sample ids. Who lists the real loops per grade?
7. Topic and grade pages have an SEO article and FAQ the design does not draw. Confirm we restyle the shell and keep the article, FAQ, and JSON-LD.
8. Viewer: confirm we do not replace the PDF, do not add “הדגמה · לא האתר החי”, and do not reopen the רמזי panel by default. After the side-by-sides, is any chrome delta still wanted?

## Implementation plan

Separate previewable PRs, in this order. Sizes are scope, not calendar time. No merge, no `wix release`, no env or DNS change.

| PR | What | Size | Who |
|---|---|---|---|
| A. Header, nav, notice | Only after questions 1–3. If he keeps two links and the hamburger, this is a spacing pass (768 wrap, 44px flag in the PR). If he wants one label, add a control that still reaches both URLs. Do not restore the modal. Footer stays | Small if IA stays. Medium if the nav item changes | Cursor, after Noam. Not Claude |
| B. Home hero | Wire label, panel color, topic link, and the two CTA destinations. Rotation only across loops that already exist | Medium | Claude (Noam) picks the loop set and panel rule. Cursor wires it. Do not redraw `HeroLoop` |
| C. Worksheets hub | Spacing, type, fish doodle, empty state. Real counts, real groups, real PDF ids. No fake “50” | Medium | Cursor |
| D. Grade shell | Place the existing player where the chosen file shows it (default: the players file, because the prompt says so). Keep FAQ and topic lists. No sample SVGs, no invented L08 playlist | Medium-large | Claude owns the loop contract and any real chip list. Cursor places the shell. Kimi only if a doodle file is actually missing (it is not) |
| E. Topic shell | Match crumbs, pencil, panel, CTA, level pills, example box, related pills. Keep the article, FAQ, JSON-LD, and real level hrefs | Medium | Cursor. Claude only if a demo must move |
| F. Viewer chrome | Do not start unless Noam answers question 8 with a specific delta. Leave the PDF and the רמזי logic | Small, optional | Cursor, only then |

Perplexity: not needed. The contrast figures above are already measured.

Kimi: not needed to redraw רמזי or the doodles. Those files are already on the site.

## What was not verified

- No local `npm ci` / `wix build` / `wix preview`. The live site was treated as `28eba36`.
- Pixel diffs are the top 900px, animations paused. They miss below-the-fold SEO and they understate the 390 header (design 254px vs live 70px) because the overlap crop is only 70px tall.
- Hover, focus, and the שובב / רגוע timings were checked in source, not by video.
- Empty worksheet search was not exercised on the live site.
