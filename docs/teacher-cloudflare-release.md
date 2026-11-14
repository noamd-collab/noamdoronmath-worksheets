# Guarded Cloudflare teacher-worker release

This is a separate initial-rollout controller for the private worksheet worker.
It does not publish the Wix website, alter its `RELEASE_SHA`, or use the
`wix-production` deployment ledger. The default Wix path in `release.sh` is
unchanged. There is no automatic trigger or purchase in this controller.

The confirmed Cloudflare account is `94be626240d3c682145e18cf9d2790e7`.
Its Workers plan was Free when inspected on 14 November 2026. A proposed Paid
upgrade, authentication grant, secret provisioning, image push and production
cutover each need to be concretely authorized before execution. An operator
context is a record of actual authorization and observations, not a way to
manufacture permission.

## Release identity and preparation

The source must be an exact 40-character reviewed SHA in a clean checkout.
Application requires that SHA to be an ancestor of the freshly confirmed
`origin/headless/astro-poc-baseline`; fetch the branch before running. Planning
can inspect a clean candidate before its PR is merged. The release entry point
is:

```sh
RELEASE_TARGET=teacher-cloudflare tools/release/release.sh \
  REVIEWED_SHA /absolute/checkout --plan /private/preflight-plan.json
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

The operator context additionally requires
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
  REVIEWED_SHA /absolute/checkout --plan /private/image-plan.json \
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
This controller supports initial deployment, not replacement of an existing
active Worker. The operator context must contain:

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
  REVIEWED_SHA /absolute/checkout --plan /private/preflight-plan.json \
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

This initial controller intentionally refuses a new rollout after state
`active`; a subsequent upgrade requires a reviewed drain/release procedure.
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
