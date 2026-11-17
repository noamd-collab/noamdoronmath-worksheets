# Private teacher worker image

This is packaging for the two existing B-level pilots only: grade 3 division
(`ג10`, 12 questions) and grade 7 linear equations (`g7:equations`, 20 questions,
signed or nonnegative bounds). It does not broaden topics, authorization,
quotas, model retries, or the meaning of `needs_review`.

The build context is the repository root. `Dockerfile.dockerignore` starts with
deny-all and names each permitted file explicitly (no directory-wide exception). No
home directory, `.env`, live job, browser data, Git metadata, node_modules or
private diagnostic log enters the context. Runtime secrets are injected only
when the orchestrator starts the container. Do not use build arguments for them.

## Immutable inputs

- Official `python:3.12-slim-bookworm` Linux/amd64 manifest digest
  `sha256:0f086103b026048cc50cb5da25ec435c023c5241a83fc44daea593377abc61c4`,
  queried from Docker's official registry on 2026-11-14: Python **3.12.16**.
- All 29 runtime Python packages in `requirements-linux-amd64.lock` have exact
  versions and Linux wheel SHA-256 hashes. Their versions match the reviewed
  Mac runtime, including all transitives. `python-wheels.json` records filenames.
  Docker installs with `--require-hashes --only-binary=:all:` and `pip check`.
- Signed Debian snapshot indexes at `20261114T000000Z` pin native transitives.
  `native-pins.json` records direct versions, package checksums and index hashes.
  Pango/HarfBuzz, Fontconfig, Poppler, Chromium, DejaVu fonts, CA certificates and
  Tini are installed at the recorded versions. APT signature verification stays
  enabled; only snapshot expiry checking is disabled. Refresh this dated image
  through a reviewed version bump, never by changing a floating tag silently.
- `skills/` contains reproducible archives of **exactly** the 66 elementary
  1.0.5-noam and 178 middle 7.2.0-noam files in `../../skill-lock.json`.
  `skill_bundle.py` verifies archive and individual file hashes before install;
  links, traversal, duplicate/missing/extra members and oversized members fail.
  The installed skills are unchanged at `/opt/noam/skills/{elementary,middle}`.
  David Libre (regular/medium/bold) and DejaVuSans retain their existing pins.
- `fixtures/` contains the unchanged, synthetic fixed-seed v2 lessons, raw
  parameters and canonical data previously reviewed. No new model response is
  generated. The provenance file records that these are offline examples.

The native installation list follows the official
[WeasyPrint 70 Linux instructions](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation).
Production DOCX generation needs neither Microsoft Word, LibreOffice, Swift nor
Node. Word Web/LibreOffice remain independent visual QA tools. The existing
locked Chromium fallback contains its own `--no-sandbox` option; packaging does
not add a bypass. Rendering receives only the runner's allowlisted environment
and trusted adapter HTML. The container runs as uid/gid 10001.

## Process contract

Default entrypoint is Tini → `bounded_worker.py` → the fixed Python command
`/opt/noam/app/remote_worker.py --once --work-dir /work/jobs`. It exits after an
empty claim or one completed job. Tini reaps orphan children. The wrapper gives
SIGTERM/SIGINT to the worker PID first so its graceful handler can drain; after
30 seconds it kills the owned process group, including render/browser children.
There is also a 1,200-second wall deadline plus at most 30 seconds of drain.
An externally imposed shorter kill window can still interrupt a job. Nothing
automatically retries a potentially billed request; the existing 20-minute lease
and `WORKER_INTERRUPTED` policy remain in force.

The default image is not a server and opens no port. Cloudflare orchestration
must keep one named instance, schedule/wake it, and preserve truthful heartbeat
readiness. A check-only override is `/usr/bin/tini -g -- /usr/local/bin/python
-B /opt/noam/app/remote_worker.py --check-only`; it does not claim, heartbeat,
upload or call the model. **Do not use `--once` as a readiness check.**

## Offline image qualification

From the repository root, on a machine with Docker (no provider credentials):

```sh
python3 tools/teacher-generation/cloud/container/test_packaging.py -v
bash tools/teacher-generation/cloud/container/ci_check.sh /tmp/new-teacher-image-evidence
```

The script uses the configured buildx builder, loads the single Linux/amd64 image
as `noam-teacher-generation:test`, and sets/verifies the OCI revision label from
`SOURCE_SHA` (40 lowercase hex characters; defaults to Git HEAD). Provenance/SBOM
attestations are disabled for this single-manifest export. It runs runtime unit tests in `--network none`, then
runs all three full skill pipelines without model keys or database credentials.
It checks original parameter derivation, lesson bounds, quality policy, every
renderer gate, original/final Word provenance and two delivered artifacts. It
also exercises the installed Chromium fallback on the trusted elementary HTML.
The image preflight asserts nonroot Linux/amd64, the Python patch, all direct
native versions, required Poppler/browser commands and David Libre resolution.
Missing native helpers cannot silently become successful skipped checks.

Review all resulting PDF pages and the final editable DOCX in a real Word
renderer before replacing the Mac worker. Linux rendering/font differences may
legitimately change PDF bytes: compare content, math, layout and gates, not an
assumption that macOS PDF hashes must match. A generated `qualification.json`
still says `humanVisualReview: PENDING`; automatic success is not Word Web proof.

Local Docker was unavailable when this packaging was prepared. Host packaging
tests and downloaded metadata/hashes are evidence of input integrity only;
they do not establish that the Linux image builds or renders successfully.

After successful qualification, the release workflow can export the same cached
build to OCI using the same source SHA, label, Dockerfile, context, platform and
`--provenance=false --sbom=false`, replacing `--load` with
`--output type=oci,dest=NEW_ARCHIVE_PATH`. Record the archive SHA-256 and inspect
its revision/platform before the separately guarded push. This script never
pushes, provisions or starts the production worker.

To rebuild skill archives, pass the two explicit trusted source paths to
`skill_bundle.py --elementary ... --middle ... --output NEW_DIRECTORY` and
compare with `skills/skill-archives.json`. It refuses to overwrite an existing
archive. Do not install or alter the user's skill trees to make the image pass.
