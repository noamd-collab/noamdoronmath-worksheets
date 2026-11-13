# Private teacher pilot worker operations

This is an operator runbook, not an instruction to execute a database migration
or start paid work automatically. The worker is a separate Python process; Wix
only authenticates the owner, enqueues requests and streams private downloads.

## Account and service credentials

The permanent owner entitlement is bound to Supabase user
`80da2957-9492-4a9d-babb-28ba70dedd12`, verified as
`amiramnoam@gmail.com` with a confirmed email and Google identity on 2026-11-13.
The account was not banned. The application verifies each request with the fixed
project's Auth service, requires Google app metadata and a matching Google
identity, then checks this user ID. A browser-supplied email/profile cannot grant
access. Permanent entitlement does not make a session permanent: the HttpOnly
cookie expires with the verified access token. Sign in again when it expires.
Ordinary teacher tools accept verified Google users; AI generation remains owner
only. All generated downloads require the owner session again.

The deployed server and worker both need `TEACHER_GENERATION_SERVICE_KEY`.
The current REST clients send it in both `apikey` and `Authorization: Bearer`, so
provision the project's **legacy `service_role` JWT**, not an anon/publishable key,
user token, Qwen key or Supabase management token. Do not substitute a new
`sb_secret_...` key without updating and testing **both** REST clients: current
[Supabase guidance](https://supabase.com/docs/guides/getting-started/api-keys#known-limitations)
requires new secret keys on `apikey`, not Bearer. A service key bypasses RLS and
must remain server-side. The owner's browser never receives it.

The operator-only worker env file contains these names, with literal values
(no shell interpolation):

```text
TEACHER_GENERATION_SERVICE_KEY
QWEN_API_KEY  (or DASHSCOPE_API_KEY)
QWEN_BASE_URL
QWEN_MODEL
ELEMENTARY_SKILL_PATH
MIDDLE_SKILL_PATH
```

Use the approved `qwen3.8-flash` author configuration. Keep the file outside the
checkout, owned by the worker operator, mode `0600`, parent directory `0700`.
Do not print, source, commit or pass its values on the command line. `--env-file`
uses a literal allowlist parser. The render subprocess does not inherit these
credentials. Database configuration belongs in the reviewed migration
`supabase/migrations/20261112185430_teacher_generation_private_pilot.sql`.

## Readiness and truthful availability

`--check-only` performs the same local pinned runtime/skills/provider-config
preflight as startup, then **GET-only** checks of the private bucket's exact
15 MiB limit/PDF+DOCX MIME allowlist and every worker-used jobs column. It reads
zero job rows. It never claims, heartbeats, uploads or calls the model. A PASS
therefore reports `claimVerified:false`; provider configuration is present and
well formed, but this check does not authenticate with or bill Qwen.

During normal operation every idle poll must pass those checks **and** execute
the claim RPC successfully before writing a heartbeat. The lease renewal thread
must pass transport checks and extend the current lease before refreshing its
heartbeat. Storage privacy is checked again before artifact uploads. A missing
claim function, denied claim permission, invalid schema, missing/public bucket
or lost lease cannot keep renewing an online status.

The website considers a heartbeat fresh for 90 seconds. If a worker dies,
connectivity fails, or a Mac sleeps, the previous status may remain visible for
that bounded interval, then becomes offline. Online means a recent successful
runtime/queue/storage readiness cycle, not a guarantee that a future provider
request will succeed. Missing server-side enqueue credentials still prevent job
creation. A failed or expired claimed job is never automatically sent to the
paid provider again; the owner must explicitly request another attempt.

## Check, start and stop on the pilot Mac

Run from a reviewed, fixed checkout. Do not edit its Python modules while the
service is running; stop it before replacing the release and re-run readiness.
The validated environment is Python 3.12 with the exact requirements and locked
elementary 1.0.5 / middle 7.2.0 skill trees. The existing virtualenv is
`tools/teacher-generation/.venv`. Set paths for this checkout and the private env
file; paths below contain no secret values:

```sh
task_repo='/Users/noamdoron/Documents/Codex/2026-11-06/files-mentioned-by-the-user-hebrew/work/site-teacher-ai-generation-20261112'
task_env="$HOME/.config/noam-math/teacher-generation.env"
task_state="$HOME/Library/Application Support/NoamTeacherGeneration"
task_python="$task_repo/tools/teacher-generation/.venv/bin/python"
DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib "$task_python" -B \
  "$task_repo/tools/teacher-generation/remote_worker.py" \
  --env-file "$task_env" --check-only
```

Before service startup, separately verify the applied migration, claim RPC
service-role grant, owner RLS and absence of unexpected queued work. Do not use
`--once` as a diagnostic: it can claim and bill an existing queued request.
Starting the normal worker authorizes it to process owner-created requests; it
does not itself create a worksheet request.

This dedicated LaunchAgent persists after the terminal/chat ends and restarts a
crashed worker. The plist stores paths only, never credentials. Generate it
after readiness succeeds:

```sh
umask 077
mkdir -p "$task_state/jobs" "$task_state/logs"
chmod 700 "$task_state" "$task_state/jobs" "$task_state/logs"
"$task_python" -B - "$task_repo" "$task_env" "$task_state" <<'PY'
import os, plistlib, shutil, sys
from pathlib import Path
repo, env, state = map(Path, sys.argv[1:])
program = repo / 'tools/teacher-generation'
assert env.is_file() and not env.is_symlink()
assert env.stat().st_uid == os.getuid() and env.stat().st_mode & 0o077 == 0
helpers = [shutil.which(name) for name in ('pdfinfo', 'pdftoppm')]
assert all(helpers), 'Install/verify PDF helpers before provisioning the service'
paths = list(dict.fromkeys([str(program / '.venv/bin')]
             + [str(Path(helper).parent) for helper in helpers]
             + ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']))
config = {
    'Label': 'il.co.noamdoronmath.teacher-generation',
    'ProgramArguments': [str(program / '.venv/bin/python'), '-B',
                         str(program / 'remote_worker.py'), '--env-file', str(env),
                         '--work-dir', str(state / 'jobs')],
    'WorkingDirectory': str(repo),
    'EnvironmentVariables': {'DYLD_FALLBACK_LIBRARY_PATH': '/opt/homebrew/lib',
                             'PATH': os.pathsep.join(paths)},
    'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 30, 'Umask': 0o077,
    'StandardOutPath': str(state / 'logs/worker.log'),
    'StandardErrorPath': str(state / 'logs/worker-error.log'),
}
target = state / 'worker.plist'
with target.open('xb') as out:
    plistlib.dump(config, out)
target.chmod(0o600)
PY
plutil -lint "$task_state/worker.plist"
launchctl bootstrap "gui/$(id -u)" "$task_state/worker.plist"
```

The exclusive plist creation intentionally refuses an overwrite. Inspect/reuse
the existing reviewed plist for a restart; do not create a second worker or
silently replace an active service. A process being present is not evidence of
readiness: confirm a fresh heartbeat and the authenticated website status.
The explicit nonsecret PATH preserves the verified PDF helpers under launchd's
otherwise minimal environment. Run `--check-only` with this same environment,
not only in an interactive shell.

```sh
# Exact dedicated service status; does not print the secret env file.
launchctl print "gui/$(id -u)/il.co.noamdoronmath.teacher-generation"
# Stop after confirming no owner job is running, unless emergency stop is needed.
launchctl bootout "gui/$(id -u)/il.co.noamdoronmath.teacher-generation"
# Start again using the existing reviewed plist.
launchctl bootstrap "gui/$(id -u)" "$task_state/worker.plist"
```

A user LaunchAgent runs while that macOS user is logged in and the machine is
awake. It is suitable for this private test, **not an always-on hosting promise**.
No sleep settings are changed by this runbook. After a forced stop during a
claimed request, allow the 20-minute lease to expire; the next worker claim marks
it `WORKER_INTERRUPTED` rather than repeating a potentially billed call.

## Acceptance through the website

Once the server secret, migration and worker are ready, sign in with the owner
Google account, open `/teachers/generate`, and confirm the UI is online. Use one
supported B/practice-or-review request: grade 3 `ג10` (12 questions) or grade 7
`g7:equations` (20 questions). The database enforces one active job and five
requests per rolling 24 hours, including failures. Reusing the same request key
does not start a second job. Do not run a separate direct model benchmark for
the same request.

Expected states are queued → running → needs_review, with only the verified PDF
and editable DOCX downloadable to the owner. `needs_review` remains a teacher
review requirement. Automated PASS is not visual Word approval, proof of exact
classroom timing, approval to publish a worksheet, or support for all grades and
topics. Check signed-out and other-Google-account denial independently. The
public worksheet catalog is never changed by this worker.

## Read-only audit snapshot (2026-11-13)

The root operator applied the migration and separately verified both RLS tables,
zero existing jobs, the private bucket, eight policies and service-only claim
execute privilege. This agent did not apply it or start a service/model request.
The local website `.env.local` was mode `0600` and had Qwen configuration, but no
teacher generation/service-role key. No service key was in this shell's
environment. Targeted `noam-ai` env-file discovery found no additional env files;
Supabase CLI was not installed, its known token files/project link were absent,
and its expected Keychain service entry was absent. No secret values were read
into tool output. Runtime/server secret provisioning remains the root operator's
responsibility; this snapshot is not a later deployment assertion.

Subsequently, the root operator provisioned the existing project service-role
JWT. This agent created the private env file and dedicated plist exclusively,
verified their modes and parsed plist, and ran `--check-only` successfully with
the minimal launch environment plus its explicit helper PATH. The real response
was `worker_preflight_pass`, `claimVerified:false`, `providerCalled:false`,
`heartbeatWritten:false`. No worker was started; startup awaits the final Word
fix/freeze and the root operator's readiness signal.
