# First567 reviewed hint corrections

This is passive compatibility code. No correction record or applied database receipt is committed. Without the optional correction file, the existing catalog, learning catalog, v1 readiness, four v1 receipts and source assets remain byte-identical.

The selected scope is 15 subitems / 45 hint cells, reviewed separately from the remaining 552 subitems. The source CSV, independent semantic review, Root acceptance, original v1 baseline and the fresh pre-update database snapshot are pinned in `scripts/lib/worksheet-hint-correction.mjs`. No full-bank semantic reapproval is claimed.

## Evidence files

A later reviewed correction may add `headless/catalog/worksheet-ramzi-hint-correction.v1.json`. Its `readbackReceiptSha256` names the content-addressed file `headless/catalog/ramzi-evidence/<sha256>.json`. The loader checks the original v1 file hash, validates the receipt path before reading, hashes the readback bytes, and calls the same structural validator used by SSR. A correction without the v1 baseline fails.

The correction record has exactly:

- `schema: noam-first567-hint-correction/v1`, `status: applied_verified`.
- The fixed pins from `hintCorrectionScope().pins`, except the internal `baselineReadyObjectSha256`: `beforeSnapshotSha256`, `baselineReadySha256`, `baselinePayloadSha256`, `baselineDbReadbackReceiptSha256`, `correctedCsvSha256`, `semanticReviewSha256`, `rootAcceptanceSha256`.
- `correctionPayloadSha256`: the immutable private transaction proposal, containing the exact 15 before/after records. `effectivePayloadSha256`: the complete proposed 567 business rows after replacing only those 15 records. Both must match the two exact reviewed hashes in `hintCorrectionScope().payloads`; matching arbitrary hashes in the record and readback are rejected. Neither is an SQL result or a future commit hash.
- `readbackReceiptSha256`, `authorId: antigravity-flash`, `reviewerId: codex-root`, and `rows`.

Each of the 15 rows has exactly `editionId`, `exerciseId`, `canonicalItemId`, `sourceBindingSha256`, `beforeHintSha256` and `afterHintSha256`. The two hint arrays each contain exactly three SHA-256 hashes of the unmodified UTF-8 hint cells, in tier order. The identities, ordering and all hashes must equal the selected reviewed scope; missing, duplicate, extra or substituted rows/tiers fail.

`sourceBindingSha256` hashes `JSON.stringify` of the values in `SOURCE_BINDING_FIELDS` order: edition, exercise, PDF media ID, PDF SHA-256, canonical source SHA-256, question SHA-256, canonical item ID, source exercise SHA-256. The build validator reconstructs that array from the actual manifest and v1 unit, so a caller cannot replace source data by editing a correction record.

The readback receipt has exactly:

- `schema: noam-first567-hint-correction-db-readback/v1`, `status: verified_exact_readback`.
- The same fixed pins, correction/effective payload hashes, author/reviewer IDs and rows as above.
- `sourceReceiptSha256`: a real private post-update readback receipt, created after the actual transaction result and verified commit. `observedAt` is a canonical UTC ISO timestamp with milliseconds; it must be no earlier than the pre-update snapshot and no more than one minute ahead of the verifier's clock.
- `counts`: `correctedRows:15`, `correctedHints:45`, `first567Rows:567`, `unchangedRows:552`, `legacyRows:31761`, `learningRows:968`.
- `before` and `after`: exact `unchangedRowsSha256`, `legacyRowsSha256`, `learningRowsSha256`. Both sides must equal the observed pre-update snapshot digests, using that snapshot's same SQL canonicalization. Equal arbitrary hashes do not pass.

Serialize the public readback as UTF-8 `JSON.stringify(readback, null, 2) + '\n'`. The equivalent Python writer is `json.dumps(readback, ensure_ascii=False, indent=2) + '\n'`. Keep property order when parsing and reserializing. Both loader and full build verify the receipt hash; SSR rechecks the entire immutable v1 baseline structurally, all exact scope/approval pins, rows, counts and preservation metadata from the build-verified snapshot. The SSR path does not make a network request or independently attest to a database transaction.

## Publication sequence and limits

1. Publish this passive compatibility code through the normal reviewed PR route. No evidence file means no correction is activated or claimed.
2. Root prepares and verifies the private 15-row compare-and-swap transaction and reverse-CAS rollback. That separate operation must preserve all metadata except the intentionally replaced review reference, the 552 other rows, old hint bank and learning rows. This module performs no database writes.
3. Root verifies the actual transaction/commit and fresh full readback. A `verified_exact_readback` string and a plausible hash alone cannot prove that SQL ran. The hash must resolve to the independently checked private evidence; the publication reviewer must verify it. Synthetic test receipts are never production evidence.
4. Only then create the real public receipt and correction record, verify them with the build validator, regenerate the catalog and refresh its existing snapshot. Publish that metadata through its reviewed PR. Do not edit or replace any v1 receipt, PDF, native export or manifest.
5. Verify the public metadata and all corrected hints through the normal client. Record the database/site transition interval honestly; successful database execution alone is not site publication.

The optional overlay retains `ramziActivation` as the original historical certification. It supplies `ramziHintCorrection` alongside it. After validation, the 12 units use the effective complete-567 payload hash and correction readback hash. No worksheet/source/learning identity or viewer routing changes. A refreshed snapshot without the correction argument removes stale correction metadata and restores the original v1 summary.

The generator must not reuse the initial insert-only 567-row importer or overwrite historical evidence. A later different before snapshot, different target list, different hint CSV or different preserved bank requires a separately reviewed change to the fixed scope. The contract deliberately fails closed rather than broadening this correction into a general permission to edit hints.

## Verification

`tests/worksheet-hint-correction.test.cjs` exercises build and SSR rejection, no-overlay byte equality, learning preservation, loader receipt hashing, complete baseline comparison, stale overlay removal and the exact 15-row synthetic positive case. Its temporary applied-shaped fixtures contain hashes only and never enter the production catalog.

The protected-design test reverses just the exact optional fourth argument in `loadCatalog.ts`, then checks the existing activation and historical hashes unchanged. It does not regenerate a whole-file fence.
