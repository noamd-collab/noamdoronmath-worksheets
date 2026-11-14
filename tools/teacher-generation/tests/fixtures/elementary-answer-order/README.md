# Elementary answer-order regression fixtures

These PDFs are byte-for-byte copies of the offline Linux qualification from source 61ec20aa. No model call was made for this test. They contain no teacher/student personal data.

- `weasyprint.pdf`: the good 4-page `qualification/grade3-division/sheet.pdf`.
- `chromium-broken.pdf`: the real 4-page fallback regression; answer equations on page 4 are reordered/split.
- `answers.html`: the unchanged `.answers` subtree from the trusted source HTML, without unrelated CSS/question pages. It supplies 18 expected equations.

Keeping the original PDFs also exercises the rule that correct formulas on earlier question pages cannot satisfy the answers check. Both files include their original embedded fonts.

- SHA-256 `answers.html`: `4b53e70d0924cdb80846141b7c3048832ce5b3f11372be6d3cfe671c1bb9abf2`
- SHA-256 `chromium-broken.pdf`: `b2b143c1099eacc82d0fa42536847d16971599ce24a40c881bd80e2dcb360957`
- SHA-256 `weasyprint.pdf`: `271d13aade158b9363e6102e3a5814a748969c1efe6dc9bec3b1470b0fcb2c15`
