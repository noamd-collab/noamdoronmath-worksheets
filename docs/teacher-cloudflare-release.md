# Guarded Cloudflare teacher-worker release

This is a separate rollout and upgrade controller for the private worksheet worker.
The controller lives on `main`, separately from the immutable runtime checkout.
It does not publish the Wix website, alter its `RELEASE_SHA`, or use the
`wix-production` deployment ledger. The default Wix path in `release.sh` is
unchanged. There is no automatic trigger or purchase in this controller.

The confirmed Cloudflare account is `94be626240d3c682145e18cf9d2790e7`.
Its Workers plan was Free at the original 14 November preparation checkpoint;
that historical observation is not evidence of its current subscription. A proposed Paid
upgrade, authentication grant, secret provisioning, image push and production
cutover each need to be concretely authorized before execution. An operator
context is a record of actual authorization and observations, not a way to
manufacture permission.

## Release identity and preparation

The source must be an exact 40-character reviewed SHA in a clean checkout.
Application requires that runtime SHA to be an ancestor of the freshly confirmed
`origin/headless/astro-poc-baseline`; fetch the branch before running. The required
`--controller-sha` separately binds the clean executing controller checkout. On
application it must be an ancestor of freshly confirmed `origin/main`. Neither
checkout substitutes for the other. Both exact SHAs require human approval;
planning validates them locally without provider calls. Planning
can inspect a clean candidate before its PR is merged. The release entry point
is:

```sh
RELEASE_TARGET=teacher-cloudflare tools/release/release.sh \
  REVIEWED_SHA /absolute/checkout --controller-sha REVIEWED_CONTROLLER_SHA --plan /private/preflight-plan.json
```

The plan is strict JSON with exactly these fields:

```json
{
  "version": 1,
  "target": "teacher-cloudflare",
  "phase": "preflight",
  "sourceSha": "REVIEWED_40_CHARACTER_SHA",
  "accountId": "94be626240d3c682145e18cf9d2790e7",
  "workerName": "noam-teacher-generation",
  "imageRef": "registry.cloudflare.com/94be626240d3c682145e18cf9d2790e7/teacher@sha256:REVIEWED_64_CHARACTER_DIGEST",
  "doClass": "TeacherGenerationContainer",
  "singletonName": "primary"
}
```

Placeholders are intentionally invalid. Worker deployment accepts only a
reviewed digest-pinned image in this account's registry, never a mutable tag or
a Dockerfile deployment. The guarded `image-push` phase below publishes that
image first; no provider command is run outside the release entry point.

## Image publication without a local Docker daemon

The qualification workflow is `.github/workflows/teacher-generation-cloud.yml`.
It builds/tests a single Linux/amd64 image without Cloudflare credentials, then
exports `teacher-worker.oci.tar` with SBOM/provenance index entries disabled and
`org.opencontainers.image.revision` set to the exact source SHA. Retain the large
`teacher-cloud-image-SHA` artifact for one day. The smaller
`teacher-cloud-qualification-SHA` artifact contains `image-metadata.json`:
`sourceSha`, `archiveSha256`, `archiveBytes`, `imageDigest`.

An image-push plan uses the common identity fields above, `phase: "image-push"`,
and four additional fields: integer `buildRunId`, `archiveSha256`, integer
`archiveBytes`, and `craneSha256`. The imageRef digest must equal the OCI root
manifest. Obtain official `crane` v0.22.1, verify its vendor release checksum
and provenance, and include the extracted executable's SHA256 in the reviewed
plan. This controller does not download or install tools. Crane operates on an
OCI directory without a Docker daemon or a third-party registry.

Every application context is an owner-owned private JSON file and requires
`controllerApproved: true` and `controllerSha` matching the exact executing
controller SHA. Fresh context reads recheck these fields before mutations.
The image operator context additionally requires
`temporaryRegistryCredentialsApproved: true`. Supply `--oci-archive` and
`--crane` absolute paths to the same entry point; plan mode validates local bytes
without network. Application verifies the successful CI run's exact source and
workflow and downloads only its small evidence artifact to match the approved
archive metadata. OCI validation rejects paths/links, duplicate or unreferenced
files, foreign layer URLs, wrong source/platform, and any manifest/blob hash or
size mismatch. The archive is extracted explicitly into a new private folder,
never with unrestricted extractall.

Before any credential grant, the guard records a pending image ledger. It then
requests only a 15-minute push/pull grant from the existing approved Cloudflare
authentication via Wrangler. The password stays in memory and a mode0600 auth
file inside an exclusive temporary directory; it is never an argument, log,
CI secret or receipt. Crane pushes only the approved digest reference to
registry.cloudflare.com, then reads the remote digest and manifest back and
checks their exact hashes. The temporary directory/auth file is removed on
success or error. An uncertain image push is retained as such and never treated
as runtime readiness. A verified image ledger is required before Worker
preflight deployment; the controller refuses silently replacing an existing
image ledger.

```sh
RELEASE_TARGET=teacher-cloudflare tools/release/release.sh \
  REVIEWED_SHA /absolute/checkout --controller-sha REVIEWED_CONTROLLER_SHA --plan /private/image-plan.json \
  --oci-archive /private/teacher-worker.oci.tar --crane /private/verified/crane \
  --context /private/image-approval.json \
  --state-dir /private/teacher-cloudflare-release --apply
```

Planning validates the candidate and prints `planSha256`. It performs no
provider calls, purchases, model requests, queue claims or worker operations.
Keep the plan outside the source checkout. The supervisor package is
`tools/teacher-generation/cloud/cloudflare`; install its exact locked Wrangler
version before an approved application. Do not upgrade the website's unrelated
Wrangler dependency.

## Preflight application — no job claim

Before application, confirm the fixed Worker name is absent in the account.
Initial deployment requires a new Worker. For an existing active Worker use the drained upgrade phases below. The operator context must contain:

- `planSha256`: exact fingerprint printed by planning.
- `approved: true`, and a bounded `approvalReference` identifying the human GO.
- `accountId`: the fixed account above.
- `workersPaidConfirmed: true` and `spendingApproved: true`, based on actual
  plan verification and budget authorization.
- `checkedAt`: UTC ISO timestamp no more than five minutes old.
- `newWorkerConfirmed: true`, from the independent account inventory.

Supply the already provisioned 64-character lowercase hexadecimal operator bearer key in
`TEACHER_CLOUD_OPERATOR_KEY`, never as an argument, plan field or logged value.
Cloudflare authentication uses Wrangler's existing approved session or token.
The controller does not create a token or perform a separate secret upload.
Preflight requires `--runtime-secrets-file`: an absolute, owner-owned mode0600
JSON file outside the checkout, with exactly these five nonempty bounded values:
`TEACHER_CLOUD_OPERATOR_KEY`, `TEACHER_GENERATION_SERVICE_KEY`, `QWEN_API_KEY`,
`QWEN_BASE_URL`, and `QWEN_MODEL`. Its operator key must match the environment
key. Duplicate names, symlinks, control characters, extra keys and weak file
permissions are rejected. Do not put this file in the repository or CI artifacts.

The guard sends a validated private temporary JSON copy with the same
`wrangler deploy --secrets-file` invocation, then deletes that copy even on
failure. JSON avoids dotenv variable expansion. Activation does not resend
secrets. Wrangler disk logging is disabled and sanitization forced on; shell
overrides for its API origin, environment and container registry are removed.
Only the protected file path is an argument, never secret values. Apply with:

```sh
RELEASE_TARGET=teacher-cloudflare tools/release/release.sh \
  REVIEWED_SHA /absolute/checkout --controller-sha REVIEWED_CONTROLLER_SHA --plan /private/preflight-plan.json \
  --context /private/operator-context.json \
  --runtime-secrets-file /private/teacher-runtime.json \
  --state-dir /private/teacher-cloudflare-release --apply
```

The private state directory must be outside the checkout, owner-controlled and
mode0700; ledger/config files are mode0600. A separate nonblocking file lock
prevents two controller processes from publishing concurrently. Keep this
single operator state; this is not a distributed lock against unrelated
Cloudflare dashboard users. Coordinate a quiet deployment window.

The controller validates account/name/DO binding, substitutes only the reviewed
image digest and source SHA in a private generated config, and records
`in_progress` **before** invoking `wrangler deploy`. It derives the operator
origin from the actual deploy result for the exact Workers.dev Worker name,
never an arbitrary supplied URL. HTTP redirects are denied and responses are
bounded. Raw CLI logs and HTTP bodies are not echoed or stored. The verified image ledger
must match this exact source/image identity.

A scheduled Cron entry exists every minute, but a new supervisor remains
**disabled**: Cron cannot start a container or claim a job before activation.
The operator preflight starts only the fixed nonclaim check, verifies its exit
and expected bounded flags, records the observed immutable image, then destroys
that preflight container. The guard compares source, image, active Worker
version, Durable Object ID, and these proof flags:
`claimVerified:false`, `providerCalled:false`, `heartbeatWritten:false`.
The runtime must be stopped/disabled after preflight. Only then does the separate
ledger become `preflight_verified`.

## Activation — separate explicit plan and fresh cutover

Create a second plan with only `phase` changed to `activate`, obtain its new
fingerprint, and record the concrete activation GO. Keep all identity fields
unchanged. In addition to the common context, require:

- `activeJobs: 0` and `queueCheckedAt` from a fresh independent queue read.
- `oldWorkerStopped: true` and `oldWorkerStoppedCheckedAt` from verifying the
  old dedicated process is stopped, not merely requesting a stop.

Both observations must be at most90 seconds old. The controller does not stop
hosts or query production using a broader database key: these fields are
explicit operator attestations. It rereads that context immediately before
activation. If jobs arrive, do not cancel/requeue them or let two workers race.

Use the same entry point and private state directory. Activation does **not**
redeploy. It rechecks the exact active Worker version, same Durable Object ID,
and stored image preflight (at most15 minutes old), then posts only the exact
source/image/version to `/operator/activate`. It verifies active mode and the
approved identity. It never calls `/operator/tick`; it does not create a paid
trial or reset quota. Verify the subsequent compatible heartbeat and ordinary
owner UI separately, without creating a worksheet unless that trial is
explicitly authorized.

## Failure handling and limitations

Cloudflare Worker activation, image handling and rollout are not atomic. A CLI
success is not a container health proof. Any failure after a provider action
leaves an `uncertain` ledger, which blocks another application. Do not delete
that record, fall back to an older success, repeat activation blindly, restart
the Mac worker, or claim that the cloud worker is disabled: an activation may
have committed despite a response failure. Inspect exact Worker/DO state and
prepare a reviewed recovery action first.

This controller intentionally refuses a new rollout after state `active`; a
subsequent upgrade requires a reviewed drain/release procedure. The only supported
uncertainty recovery is the separately approved, narrow case below.
The local ledger is distinct from Cloudflare's state and the Wix ledger. It
records controller evidence, not comprehensive protection against another
operator deploying directly.

Validation is offline: `python3 -m unittest discover -s tools/release/tests`.
Provider transport and real Linux rendering still require their own concrete
staging evidence before activation; unit mocks are not a cloud deployment.

Official references: [Containers deployment](https://developers.cloudflare.com/containers/guides/deploy/),
[digest-pinned images](https://developers.cloudflare.com/containers/guides/image-management/),
[Wrangler deployment status](https://developers.cloudflare.com/workers/wrangler/commands/workers/),
[pricing](https://developers.cloudflare.com/containers/platform/pricing/).

Image transport references: [crane OCI directory push](https://github.com/google/go-containerregistry/blob/main/cmd/crane/doc/crane_push.md), [official verified installation](https://github.com/google/go-containerregistry/blob/main/cmd/crane/README.md), [temporary Cloudflare registry grants](https://developers.cloudflare.com/workers/wrangler/commands/containers/).


## Recover one original uncertain preflight without redeploying

A Cloudflare `403 / 1010` can reject Python's default User-Agent before the Worker
executes. The controller now identifies itself honestly as
`NoamTeacherRelease/1.0 (+https://www.noamdoronmath.co.il)`. It does not impersonate
a browser, disable Cloudflare checks, follow redirects or weaken certificate
validation. A successful status GET diagnoses transport only; it does not approve
another preflight or prove a working container.

`recover-preflight` is a separate explicit plan, never an automatic retry. In
addition to the unchanged base identity fields, it has exactly these fields:

```json
{
  "controllerSha": "REVIEWED_40_CHARACTER_CONTROLLER_SHA",
  "priorLedgerSha256": "RAW_FAILED_LEDGER_64_CHARACTER_SHA256",
  "workerOrigin": "https://noam-teacher-generation.ACCOUNT_SUBDOMAIN.workers.dev",
  "expectedVersionId": "EXACT_EXISTING_DEPLOYMENT_UUID",
  "expectedDoId": "EXACT_EXISTING_64_CHARACTER_DO_ID"
}
```

These placeholders are invalid. The complete plan uses `phase: "recover-preflight"`
and retains the original `sourceSha`, digest-pinned `imageRef`, account, worker,
DO class and singleton. Create it only after committing the controller so its
SHA can be bound without modifying the runtime or its qualified image. Its
fingerprint is different from the original preflight and activation plans.

Require a concrete recovery approval naming that plan and controller. The private
context retains the ordinary plan fingerprint, approval reference, account,
Workers Paid, spending and fresh observation fields. It additionally requires
`recoveryApproved: true`, `controllerApproved: true` and the exact `controllerSha`.
An earlier rollout approval alone does not authorize recovery. Do not supply an
OCI archive, crane binary or runtime-secret JSON for this phase; they are rejected.
Only the already provisioned operator bearer key is needed for its HTTP requests.

Invoke the reviewed **controller checkout's** entry point with the unchanged
runtime checkout as its second argument:

```sh
RELEASE_TARGET=teacher-cloudflare /absolute/controller/tools/release/release.sh \
  ORIGINAL_RUNTIME_SHA /absolute/immutable-runtime-checkout \
  --controller-sha REVIEWED_CONTROLLER_SHA --plan /private/recovery-plan.json \
  --context /private/recovery-approval.json --state-dir /private/teacher-cloudflare-release
```

Without `--apply`, this only validates source/controller identity and prints the
plan fingerprint. Only after the controller PR and recovery plan are explicitly
approved may the same reviewed command add `--apply`. Keep the existing private
state directory; a fresh directory cannot supply the required failed/image ledgers.

Under the same exclusive release lock, recovery requires the exact **raw bytes**
of the prior ledger to match `priorLedgerSha256`. Its target, original preflight
plan hash, runtime identity and origin must match, and its state must be
`uncertain` with phase exactly `preflight`. A previous recovery, activation,
verified result or missing ledger is rejected. The existing image ledger must
remain private, verified and bound to the same identity and remote digest.

Fresh provider reads must independently show the expected deployment at 100%
traffic and the expected DO/source/image with `mode: disabled`, `running: false`,
`approved: null`, `preflight: null`, `lastCycle: null`, `observedImage: null` and
no scheduled retry. Recovery refuses an already performed preflight or any
previous production cycle. The quiet operator window remains necessary because
this local lock cannot exclude an unrelated dashboard operator.

The controller rechecks the private approval and unchanged failed bytes, then
creates an exclusive read-only archive named
`teacher-cloudflare-preflight-failed-RAW_HASH.json` in the same state directory.
It fsyncs the archive and directory, verifies the preserved bytes, and records
`in_progress` before the sole permitted `POST /operator/preflight`. Existing
archive files are never reused or overwritten. Approval is reread immediately
before this POST. The adapter rejects redeployments, secret uploads, registry
grants, activation, tick and any second preflight attempt.

Success requires a fresh nonclaim proof, the same exact version/DO/image/source,
and disabled/stopped/unapproved state. Only then is the normal
`preflight_verified` ledger shape written, with the original archive hash retained.
The original activation plan's fingerprint and runtime identity remain unchanged;
activation still separately requires its human GO, fresh empty queue and verified
stopped Mac worker. Activation never redeploys or resends runtime secrets.

Any failure after pending is recorded leaves phase `recover-preflight`, state
`uncertain`, with the failed original preserved. This controller deliberately
cannot retry that state. Precheck failures make no POST and leave the original
ledger unchanged. Archive/directory fsync failures also make no POST; an existing
archive thereafter blocks another attempt pending an explicit review.

Offline tests include exact raw-ledger/hash and live identity mismatches,
approval revocation, archive fsync failure, one-POST transport failures, durable
uncertainty and replay rejection, separate controller/runtime Git gates, truthful
User-Agent and redirects, and recovery followed by the original activation plan.
The main PR release-guard workflow runs these tests without provider credentials.

Official diagnosis: [Cloudflare Error1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/),
[workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

## Active cloud upgrade (no Mac worker)

The existing cloud worker remains the production source until an approved drain.
There is no Mac fallback. An upgrade does not purchase a plan, edit the database,
cancel/requeue a job, reset owner quota, change idempotency keys, or invoke a model.
Run each phase from the separate reviewed main controller checkout with
`RELEASE_TARGET=teacher-cloudflare tools/release/release.sh SOURCE_SHA RUNTIME_CHECKOUT --controller-sha CONTROLLER_SHA --plan PLAN`.
Every application context binds the explicit controller approval and exact controller SHA as above.

First qualify and publish the new immutable image using `image-push`. Image receipts
now use `teacher-cloudflare-image-IDENTITY_HASH.json` in the same private state
directory. The legacy receipt is reused for its exact identity; successful and
uncertain receipts are never overwritten to make room for an upgrade.

Each upgrade plan contains the same nine common fields as the initial plan, plus
exactly `previousRuntime`, with the currently live `sourceSha`, digest-pinned
`imageRef`, `versionId`, and `doId`. The common source/image fields describe the
new version. Both source and image must change. All three plans must keep the
same new identity and previous runtime, and each phase has its own fingerprint
and explicit operator approval:

1. `upgrade-drain` requires the existing ledger to be `active`, with the exact
   previous identity. It checks the live deployment and supervisor, durably
   records `in_progress` before `/operator/deactivate`, then records
   `upgrade_draining`. Deactivate prevents new Cron starts but does not kill an
   active render or provider request. A still-running container is an expected
   drain result, not permission to deploy.
2. `upgrade-preflight` requires `upgrade_draining`, the same old Worker version,
   the same DO, disabled mode and a stopped container. A fresh independent DB
   read must also show zero active leases. It records pending state before
   deploying the new digest and runtime secrets, preserves the verified origin
   and DO ID, runs the existing nonclaim preflight, and records
   `upgrade_preflight_verified`. Old proof or a changed DO cannot qualify.
3. `upgrade-activate` rechecks the exact new Worker version, DO and nonclaim
   preflight (maximum15 minutes old), rereads fresh cutover context, then records
   pending state before activation. It calls no tick. Cron resumes the normal
   consumer after activation; the DB remains authoritative for job outcomes.

For the last two phases the context must include `activeJobs: 0` and
`queueCheckedAt` at most90 seconds old. Here `activeJobs` counts every outstanding
claim/lease, including a lease whose process is gone; do not equate a stopped
container with an expired DB lease. It also needs `jobsSnapshotSha256` and
`ownerQuotaSnapshotSha256` from the same independent read. Hash canonical,
deterministically ordered complete job records (including status, lease and
idempotency fields), and the owner's quota record separately. Do not put their
raw contents in release plans or logs. Activation requires those fingerprints
to equal the preflight fingerprints. If a user submits a new job or the data
changes, stop and review the changed state; do not manufacture an old snapshot.
The controller checks these operator attestations; it does not obtain a wider
DB key or pretend its cloud status proves database integrity.

Every upgrade phase retains the complete predecessor receipt and its SHA256.
Atomic state replacement also fsyncs the containing directory before a provider
mutation. Any failure after pending state becomes `uncertain`; do not retry that
phase, clear the ledger, restore an older success or start a local worker. The
existing recovery procedure needs a separately reviewed action. A failed
read-only precondition leaves the previous ledger intact.

For a read-only observation, pass `--observe` (never together with `--apply`),
the reviewed plan and `--state-dir`. It uses the verified origin in the ledger,
calls only deployment status and `/operator/status`, and emits bounded public
identity/mode/running fields. It does not read runtime secrets, write the release
ledger, invoke preflight, mutate provider state or consume the owner's trial.
The local private Wrangler config/lock can be created for the observation.

Offline release tests include busy drains, outstanding/freshly changed leases,
snapshot drift, stale/changed identity, lost transport replies, changed DOs,
predecessor retention and a no-mutation observation:

```sh
python3 -m unittest discover -s tools/release/tests -p 'test_teacher_cloudflare_*.py' -v
```
