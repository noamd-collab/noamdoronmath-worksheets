# Production publication guard

The live site still uses the approved canonical SHA
`254d7b8093de9ebea9c3608effd76428ee43f810`. This infrastructure change does not
change a page, worksheet, SEO output, the site SHA pin, or the Wix release script.

## Controller and state

- The controller is checked out at the reviewed `main` workflow commit, separately
  from the exact approved site commit. The site release script cannot replace it.
- A push to `main` requests publication only when the approved site SHA changes.
  The legacy literal `release.sh` pin is recognized during migration, so merging
  this infrastructure PR skips publication. A manual retry is allowed only from
  `main`, with `publish=true`, using the existing approved pin.
- All publishing jobs share the `wix-production` concurrency group, without
  cancelling an active run. State is read after acquiring this lock.
- The actual last live site SHA is the newest successful GitHub Deployment in
  environment `wix-production`, task `wix-publish`, with `releaseGuardVersion: 1`.
  GitHub Pages deployments and the `main` workflow SHA are not site-version data.
- Both history conditions must pass: last live SHA is an ancestor of the approved
  SHA; approved SHA is an ancestor of the current canonical branch. The same SHA
  is permitted for an explicitly requested retry.
- A durable deployment is created before invoking the existing release script.
  Only its successful exit records success. Missing state, API errors, an
  interrupted run, or failure to record success block the next publication.
  The guard never searches backwards for an older success to bypass uncertainty.

This guards the controlled workflow. It does not detect an intentional content
revert in a newer descendant commit, and it cannot revoke direct Wix credentials.
PR review, required checks and Noam's exact-SHA approval remain necessary.

## Initial activation — no Wix publication

Do this only after Noam approves the specific infrastructure PR. Initialize the
record **before merging this PR**, while the last publication run still proves
the existing live site. The initializer refuses to overwrite any existing record
and requires the latest successful main publication run to pin the confirmed SHA.
Its default mode is read-only. It never invokes Wix or changes Git branches.
Coordinate a quiet publication window: no concurrent publication or rerun during
this one-time operator step. It rechecks the latest run before writing, but a
manual initializer cannot lock the legacy workflow or outside Wix credentials.

1. Independently confirm that the live site is still `254d7b8093de9ebea9c3608effd76428ee43f810`
   and that run `42015656372` is still the latest publication evidence. If a newer
   run exists, stop and establish the actual live SHA; do not reuse stale evidence.
2. From this reviewed checkout, provide `GITHUB_TOKEN` with deployment-write
   access through the existing authenticated environment, without saving it.
   Set `GITHUB_REPOSITORY=noamd-collab/noamdoronmath-worksheets`,
   `RELEASE_SHA=254d7b8093de9ebea9c3608effd76428ee43f810`,
   `CONFIRMED_LIVE_SHA` to that same SHA, and `CONFIRMED_RUN_ID=42015656372`.
3. Run `node .github/scripts/production-release.mjs initialize` to validate without
   writing. After checking its result, run the same command with `--write` to
   record the already confirmed existing publication.
4. Merge the approved PR. Verify that `release-request` outputs `publish=false`
   and the `publish` job is skipped. There must be no Wix publication.
5. Run the read-only `check` command with `SITE_DIR` pointing to a checkout with
   the full canonical history to confirm the record and ancestry.

For the separate canonical CI PR, merge the reviewed workflow only after its
`canonical-site-build` and `canonical-unit-tests` checks pass. Then add those two
names to the canonical branch's required checks, preserving the existing `seo`,
`astro-poc-slash-fractions`, strict/up-to-date requirement and all other protections.
Do not require jobs before their workflow is merged, or unrelated PRs could wait
for checks that cannot run. This setting change does not publish the website.

## Uncertain publication

If a release fails, is cancelled, or publishes successfully but cannot save its
success record, stop. Inspect the Wix result, the exact site SHA in the run and
live behavior with Noam. Do not delete the newest record, fall back to an older
success, or automatically initialize again. Only a separately approved
reconciliation may record the verified live state and unblock subsequent runs.

## Verification

Run `node --test .github/scripts/production-release.test.mjs`. The tests use real
temporary Git histories and a simulated deployment API, never production writes.
They cover rollback/divergence, exact retries, missing or uncertain state,
read/write failures, separate run identity, migration without publication, and
one-time initialization without a Wix call.
