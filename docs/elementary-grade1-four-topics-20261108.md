# Grade 1: four renewed worksheet topics

This candidate adds three levels for each of four grade 1 topics alongside the existing editions. It contains 12 PDFs, 96 activities and 416 subparts. Elementary student links open PDFs; the teacher workspace offers question selection, composed printing and editable Word export.

| Topic | B / A / excellence PDF pages |
|---|---|
| דפוסים וסדרות | 11 / 10 / 13 |
| חוקרים את לוח המאה | 12 / 12 / 13 |
| בעיות מילוליות בציור ובמספר | 11 / 9 / 12 |
| מודדים ומשווים אורך | 11 / 12 / 15 |

The topic titles follow the existing catalog. These non-geometry worksheets use text and tables, without drawings. All PDFs include their answer sections. The 1,248 locally prepared hints remain draft and are not imported or activated.

## Source and media checks

The source, answers, hints and canonical output reviews preceded site integration. The static integration independently checked 416 items, 64 tables and 869 writing lines. Each of the 12 PDFs was uploaded once to Wix media and downloaded again; all 1,249,297 bytes matched the accepted files by SHA-256. The new media IDs are recorded with source, PDF, manifest, answer-map and Word-source hashes in the edition registry.

The candidate preserves all 967 previous teacher catalog rows and all 936 referenced existing teacher sheet files. The grade 3 division edition from PR 411 and every legacy edition remain available. The registry's `published` entries describe the proposed behavior after deployment; they do not indicate that this candidate has been merged or released.

## Word writing space

Intermediate response lines now stay with their own item. The final line ends the keep-with-next chain, preserving item and question boundaries. RTL, native tables, editable mathematics, source wording, answers and the number of writing lines are unchanged. Existing geometry grouping and legacy Word output retain their behavior.

All 19 previously observed split-writing cases are closed in the rendered documents. Full-document Word output grows from 116 to 120 pages to preserve complete work units. The final student pages of topic 12 B and topic 14 excellence are sparse but contain a complete final item and all its writing lines; answers follow separately. Some existing shared activity context can remain on a preceding page.

The author personally read 60 changed full pages and 11 selection pages; 60 unchanged full pages matched an earlier independent visual review exactly. Root read five representative full pages, including both sparse final student pages, and replayed the structural and content checks. All 12 Word documents regenerated with the actual media IDs match the visually reviewed documents byte-for-byte. Visual evidence uses LibreOffice; native Microsoft Word was not tested.

## Website checks

- Production build and slash-fraction scan passed. All 2,115 required tests passed: 2,106 unit, five isolated drawing-policy and four live SSR tests, with no skips. The initial run caught the catalog hash fence; the repaired fence permits only these four additions and still hashes the complete previous catalog.
- Official Wix preview loaded the grade 1 catalog at desktop and 390px phone widths. All four new topics have three PDF links; expanding the hundred-chart card exposes its three previous PDFs without horizontal overflow.
- A real teacher selection of topic 14 excellence questions 4 and 5 produced two composed question pages plus one answer page. The downloaded editable Word rendered as four pages, all personally read. The complete final item remains on the last student page; headers, table direction and answer matching were verified.
- The local development catalog route encountered an existing CommonJS/Vite module evaluation error. The production build and official preview worked; no change to application module loading was needed.
- Native Microsoft Word and the historical broad TypeScript test check were not rerun. These limits are not reported as passing checks.

## Release boundary

No elementary Noam AI, prepared-hint activation, database migration or import is part of this change. Publication requires Noam's explicit approval of the specific pull request and must run through `tools/release/release.sh`. The pull request records the reviewed commit, preview and the completed checks before approval is requested.
