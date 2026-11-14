#!/usr/bin/env bash
# Offline qualification only. Never passes host env/secrets into the image.
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
task_container="$task_root/tools/teacher-generation/cloud/container"
task_output="${1:?Pass a new output directory outside the repository}"
test ! -e "$task_output"
mkdir -p "$task_output"
task_source="${SOURCE_SHA:-$(git -C "$task_root" rev-parse HEAD)}"
[[ "$task_source" =~ ^[a-f0-9]{40}$ ]]
task_image="noam-teacher-generation:test"
task_name="noam-teacher-offline-$$"
trap 'docker rm -f "$task_name" >/dev/null 2>&1 || true' EXIT
python3 "$task_container/test_packaging.py" -v
docker buildx build --load --platform linux/amd64 --provenance=false --sbom=false \
  --label "org.opencontainers.image.revision=$task_source" \
  --metadata-file "$task_output/image-build-metadata.json" \
  --file "$task_container/Dockerfile" --tag "$task_image" "$task_root"
test "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$task_image")" = "$task_source"
docker run --rm --platform linux/amd64 --network none --entrypoint /usr/local/bin/python \
  "$task_image" -B -m unittest discover -s /opt/noam/app/tests -v
docker create --platform linux/amd64 --network none --shm-size 256m --name "$task_name" \
  --entrypoint /usr/bin/tini "$task_image" -g -- /usr/local/bin/python -B \
  /opt/noam/app/cloud/container/offline_smoke.py --out /work/qualification >/dev/null
docker start --attach "$task_name"
task_code="$(docker inspect --format '{{.State.ExitCode}}' "$task_name")"
docker cp "$task_name:/work/qualification" "$task_output/" || true
test "$task_code" = 0
test -f "$task_output/qualification/qualification.json"
