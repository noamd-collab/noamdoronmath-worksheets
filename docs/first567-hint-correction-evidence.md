# First567 reviewed hint corrections

The exact 15-row correction was committed to the database and independently read back on 2026-11-16. This candidate includes its real public correction record, hash-bound readback summary and required row proof. Site publication remains a separate reviewed release. Without the optional correction file, the existing historical catalog, learning catalog, v1 readiness, four v1 receipts and source assets remain byte-identical.

The selected scope is 15 subitems / 45 hint cells, reviewed separately from the remaining 552 subitems. The source CSV, independent semantic review, Root acceptance, original v1 baseline and the fresh pre-update database snapshot are pinned in `scripts/lib/worksheet-hint-correction.mjs`. No full-bank semantic reapproval is claimed.

## Evidence files

The reviewed correction is recorded in `headless/catalog/worksheet-ramzi-hint-correction.v2.json`. Its `readbackReceiptSha256` names the content-addressed file `headless/catalog/ramzi-evidence/<sha256>.json`. The loader checks the original v1 file hash, validates the receipt path before reading, hashes the readback bytes, and calls the same structural validator used by SSR. A correction without the v1 baseline fails.

The correction record has exactly:

- `schema: noam-first567-hint-correction/v2`, `status: applied_verified`.
- The fixed pins from `hintCorrectionScope().pins`, except the internal `baselineReadyObjectSha256`: `beforeSnapshotSha256`, `baselineReadySha256`, `baselinePayloadSha256`, `baselineDbReadbackReceiptSha256`, `correctedCsvSha256`, `semanticReviewSha256`, `rootAcceptanceSha256`.
- `correctionPayloadSha256`: the immutable private transaction proposal, containing the exact 15 before/after records. `effectivePayloadSha256`: the complete proposed 567 business rows after replacing only those 15 records. Both must match the two exact reviewed hashes in `hintCorrectionScope().payloads`; matching arbitrary hashes in the record and readback are rejected. Neither is an SQL result or a future commit hash.
- `readbackReceiptSha256`, `authorId: antigravity-flash`, `reviewerId: codex-root`, and `rowScopeSha256`, `rowCount:15`, `hintCount:45`.

The public record/readback no longer duplicate the 15 rows. They both pin `rowScopeSha256` to `c0374126e3b7b1cfb086ee84e38536dc9c0e3928b733c37dc3b1961c6b23b47f`, with exact 15/45 counts. The loader requires `ramzi-evidence/<rowScopeSha256>.json` containing the full ordered proof, serialized as UTF-8 `JSON.stringify(rows)` without a trailing newline. This file is build-only: it is not copied into the catalog or imported by SSR. Its raw bytes must hash to the fixed digest, and its parsed rows must equal the immutable scope in `worksheet-hint-correction-build.cjs`. Missing or altered proof fails the build even when the public summary is unchanged.

Each of the 15 build-only rows has exactly `editionId`, `exerciseId`, `canonicalItemId`, `sourceBindingSha256`, `beforeHintSha256` and `afterHintSha256`. The two hint arrays each contain exactly three SHA-256 hashes of the unmodified UTF-8 hint cells, in tier order. The identities, ordering and all hashes must equal the selected reviewed scope; missing, duplicate, extra or substituted rows/tiers fail.

`sourceBindingSha256` hashes `JSON.stringify` of the values in `SOURCE_BINDING_FIELDS` order: edition, exercise, PDF media ID, PDF SHA-256, canonical source SHA-256, question SHA-256, canonical item ID, source exercise SHA-256. The build validator reconstructs that array from the actual manifest and v1 unit, so a caller cannot replace source data by editing a correction record.

The readback receipt has exactly:

- `schema: noam-first567-hint-correction-db-readback/v2`, `status: verified_exact_readback`.
- The same fixed pins, correction/effective payload hashes, author/reviewer IDs and fixed row-scope digest/counts as above.
- `sourceReceiptSha256`: a real private post-update readback receipt, created after the actual transaction result and verified commit. `observedAt` is a canonical UTC ISO timestamp with milliseconds; it must be no earlier than the pre-update snapshot and no more than one minute ahead of the verifier's clock.
- `counts`: `correctedRows:15`, `correctedHints:45`, `first567Rows:567`, `unchangedRows:552`, `legacyRows:31761`, `learningRows:968`.
- `before` and `after`: exact `unchangedRowsSha256`, `legacyRowsSha256`, `learningRowsSha256`. Both sides must equal the observed pre-update snapshot digests, using that snapshot's same SQL canonicalization. Equal arbitrary hashes do not pass.

Serialize the public readback as UTF-8 `JSON.stringify(readback, null, 2) + '\n'`. The equivalent Python writer is `json.dumps(readback, ensure_ascii=False, indent=2) + '\n'`. Keep property order when parsing and reserializing. Both loader and full build verify the receipt hash; SSR rechecks the entire immutable v1 baseline structurally, all exact scope/approval pins, fixed row-scope digest, counts and preservation metadata from the build-verified snapshot. The SSR path does not make a network request or independently attest to a database transaction.

## Publication sequence and limits

1. Publish this passive compatibility code through the normal reviewed PR route. No evidence file means no correction is activated or claimed.
2. Root prepares and verifies the private 15-row compare-and-swap transaction and reverse-CAS rollback. That separate operation must preserve all metadata except the intentionally replaced review reference, the 552 other rows, old hint bank and learning rows. This module performs no database writes.
3. Root verifies the actual transaction/commit and fresh full readback. A `verified_exact_readback` string and a plausible hash alone cannot prove that SQL ran. The hash must resolve to the independently checked private evidence; the publication reviewer must verify it. Synthetic test receipts are never production evidence.
4. Only then create the real public receipt and correction record, verify them with the build validator, regenerate the catalog and refresh its existing snapshot. Publish that metadata through its reviewed PR. Do not edit or replace any v1 receipt, PDF, native export or manifest.
5. Verify the public metadata and all corrected hints through the normal client. Record the database/site transition interval honestly; successful database execution alone is not site publication.

The v2 contract replaces an unactivated v1 correction proposal before any applied evidence exists; it does not alter historical readiness v1. An unexpected old correction-v1 file is rejected, not silently ignored. The full row proof remains an independent build prerequisite. SSR trusts the build-verified compact projection and does not independently hash/read the build-only row file. The private post-commit proof must still demonstrate every before/after cell; a fixed scope digest is not evidence that SQL executed.

The optional overlay retains `ramziActivation` as the original historical certification. It supplies `ramziHintCorrection` alongside it. After validation, the 12 units use the effective complete-567 payload hash and correction readback hash. No worksheet/source/learning identity or viewer routing changes. A refreshed snapshot without the correction argument removes stale correction metadata and restores the original v1 summary.

The generator must not reuse the initial insert-only 567-row importer or overwrite historical evidence. A later different before snapshot, different target list, different hint CSV or different preserved bank requires a separately reviewed change to the fixed scope. The contract deliberately fails closed rather than broadening this correction into a general permission to edit hints.

## Verification

`tests/worksheet-hint-correction.test.cjs` exercises build and SSR rejection, explicit historical no-overlay equality, learning preservation, loader receipt hashing, complete baseline comparison, stale overlay removal, the exact 15-row synthetic positive case and the separately pinned real committed correction. Its temporary applied-shaped fixtures contain hashes only and never enter the production catalog.

The protected-design test reverses just the exact optional fourth argument in `loadCatalog.ts`, then checks the existing activation and historical hashes unchanged. It does not regenerate a whole-file fence.

## Verified correction metadata — 2026-11-16

- Actual database readback: `2026-11-16T15:43:13.045Z`; 15 corrected rows / 45 hint cells, all 567 business rows verified. The other 552 rows, 31,761 legacy rows and 968 learning rows retain their independently checked signatures.
- Public correction record SHA-256: `4958a1f3457f984f0f8e878a67bf47cba8bbfc9472ac92635ccaefa15603c4ff`.
- Public readback SHA-256: `01e60d4e1c477c53685bc95ec6e35bbd03520bdc59dce6f7e186e2f395188cf6`. Its `sourceReceiptSha256` is `0b8ebd7a0e2a1c868cd47e198240b667816e1f5b5d5aaa9195f838f85e0c35da`, the independently verified private transaction/readback proof retained by Root. No private database rows or hint text are copied here.
- The generated catalog and client snapshot now carry the validated correction overlay. Historical v1 readiness/receipts, PDF/native/manifest identities, learning catalog and worksheet routing are unchanged. Additional-edition activation is still disabled and needs its own real evidence.
- These files describe an executed database correction; they do not claim that this site candidate has been merged or published, or that all 567 hints received a new semantic review.
