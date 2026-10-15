# G8-T11 static integration review

Status: PASS for reviewed static student mapping, approved native preservation and safe teacher common context. Draft PR140 only. Delivered count remains 144 (integration delta 0).

All 60 question unions, 210 part pins, 17 cross-page questions, 37 native SVG figures and 43 student PDF pages were checked. The initial review found actual clipping of level-a question 2 and missing teacher common givens. After correction, all 40 changed question unions were independently reinspected; 20 byte-identical renders retain their initial evidence. All 60 teacher common contexts were visually checked, including 37 diagrams and 23 text/table introductions. No static mapping defects remain in this reviewed set.

The approved helper includes normalized path endpoints, physical bounds for horizontal/vertical strokes and round points, quarter-point raster clearance and draw-order-independent connected-ink closure. Seven physical regression tests pass. The existing large-frame exclusion and font-size-based seed remain limitations, so this is not a blanket approval for future PDFs.

All 150 later-part teacher common contexts are preserved through existing `stem` fields. The 210 own-part rows and IDs remain unchanged. No answer data or new runtime consumer wiring was added. After standard scoped teacher generation, restore the reviewed contexts with:

```sh
python3 scripts/apply-teacher-context-curation.py --record noam-ai/teacher-context/G8-T11.json
python3 scripts/apply-teacher-context-curation.py --record noam-ai/teacher-context/G8-T11.json --check
node headless/astro-poc/scripts/sync-github-static.mjs
```

The replay validates student hashes and exact IDs before writing; all three generated teachers replay to the accepted objects. A changed student binding is rejected.

The conservative show-only policy had three stale hash pins. Only those pins were rebound to independently confirmed claude04 exports. PDF/native JSON/SVG bytes, no-highlight/no-auxiliary restrictions and block lists are unchanged.

Independent frozen review SHA256: `17a034dbed7f06e79d11546531453b5804743a1b911cc1d8c3a385b9672c4eb0`.
Initial blocked review SHA256 (preserved): `c802a92f1bc940ef71f57888520d01f75e866869de887af4fc04eb23c05062c6`.
Helper SHA256: `1be455b6a310ec8a17af28ab4b91d77cc2506015ac639fafac4a38a354cb0512`.
Policy SHA256: `ce80c01bc26b274f5bb77410f054290ebea0665485f0be1275a513a14c01312e`.

Validation: 34 catalog/manifest guards, 21 protected-design checks, seven physical-ink regressions and the 150-context curation check pass; static source/mirror provenance agrees. The catalog fence was explicitly updated for this authorized student-media replacement. Unrelated prior suite failures are not claimed fixed.

Mathematical content approval is inherited from the existing confirmation; it was not re-solved here. G79/OCR are NOT_RUN and source TABLE_UNVERIFIED limitations remain. DeepSeek code review, Qwen phone/desktop review and Wix preview remain external pending gates. No merge, release, deployment or media re-upload occurred.
