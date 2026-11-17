# Middle-school Ramzi integration staging

This change prepares source-bound questions and hints for the twelve PDF editions introduced by PR #456. Their existing PDF-only catalog state remains authoritative until the independent publication and import steps below are complete.

## Source assets

- Twelve native JSON files and 121 original SVG figures are copied to both served source trees.
- Twelve measured manifests remain disabled: `publishable=false`, `reviewRequired=true`, `nativeExportPublished=false`.
- Each staged manifest adds `nativeLevel` only after checking its existing `level`, every exercise and the native JSON. Original measured inputs and PDF bytes are unchanged.
- The public native projections exclude private solutions and answer-bearing target fields. Five changed projections have explicit reviewed derivations; all other native files retain their original hashes.
- All 133 PDF overlay pages have independent visual review records. Local sampled viewer review is separate from production or publisher verification.

## Canonical identifiers

Canonical question and item identifiers now accept bounded dot-separated segments, including the IDs produced by the pinned worksheet skill. Leading, trailing and consecutive dots, slashes, URL encoding, whitespace and identifiers longer than 128 characters remain invalid. The native identifier contract is unchanged.

Migration `20261113202314_worksheet_edition_canonical_ids.sql` is already applied to the configured Supabase project under server version `20261113202322`. Do not reapply it as a new migration or rewrite migration history. The only changed constraint is `noam_worksheet_edition_hints_canonical_item_id_check`. Recorded before/after checks preserve all other constraints, RLS, policies, grants and legacy row counts. The edition-hints table remains empty.

## Remaining activation steps

1. Review and deploy the asset and viewer changes through the normal approved release process.
2. Download the exact native JSON, SVG and final manifest URLs and verify their bytes and source bindings against the reviewed artifacts.
3. Produce final publisher evidence and activate derived manifests without rewriting historical measured inputs.
4. Revalidate all reviewed three-hint rows, import them through the separate edition-hints table, and verify live per-item lookup before marking an edition AI-ready.

No local fixture result, disabled manifest, uploaded PDF, author self-check or database migration is evidence of completed live hint integration.
