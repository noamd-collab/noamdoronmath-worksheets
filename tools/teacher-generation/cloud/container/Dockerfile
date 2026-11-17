# Linux/amd64 official Python manifest, verified 2026-11-14; Python 3.12.16.
FROM --platform=linux/amd64 python:3.12-slim-bookworm@sha256:0f086103b026048cc50cb5da25ec435c023c5241a83fc44daea593377abc61c4

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONNOUSERSITE=1 \
    LANG=C.UTF-8 LC_ALL=C.UTF-8 HOME=/home/worker \
    ELEMENTARY_SKILL_PATH=/opt/noam/skills/elementary \
    MIDDLE_SKILL_PATH=/opt/noam/skills/middle

# Frozen signed Debian indexes pin all native transitives, not just direct libs.
# Only expiry is waived for reproducibility; archive signature verification stays on.
RUN rm -f /etc/apt/sources.list /etc/apt/sources.list.d/*
COPY tools/teacher-generation/cloud/container/debian.sources /etc/apt/sources.list.d/noam.sources
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates=20250419~deb12u2 \
    libpango-1.0-0=1.50.12+ds-1 libpangoft2-1.0-0=1.50.12+ds-1 \
    libharfbuzz-subset0=6.0.0+dfsg-3 fontconfig=2.14.1-4 \
    fonts-dejavu-core=2.37-6 poppler-utils=22.12.0-2+deb12u3 \
    chromium=156.0.8078.79-1~deb12u1 tini=0.19.0-1+b3 \
    && rm -rf /var/lib/apt/lists/*

# Dockerfile.dockerignore is an explicit source allowlist, not the user's cwd.
COPY tools/teacher-generation/ /opt/noam/app/
RUN python -m pip --isolated install --no-cache-dir --index-url https://pypi.org/simple \
    --require-hashes --only-binary=:all: \
    -r /opt/noam/app/cloud/container/requirements-linux-amd64.lock \
    && python -m pip check \
    && python /opt/noam/app/cloud/container/skill_bundle.py --install /opt/noam/skills \
    && mkdir -p /usr/local/share/fonts/noam /work/jobs /home/worker \
    && cp /opt/noam/skills/elementary/assets/DavidLibre-*.ttf /usr/local/share/fonts/noam/ \
    && fc-cache -f \
    && groupadd --gid 10001 worker \
    && useradd --uid 10001 --gid worker --home-dir /home/worker --no-create-home worker \
    && chown -R 10001:10001 /work /home/worker

WORKDIR /work
USER 10001:10001
RUN python /opt/noam/app/cloud/container/offline_smoke.py --preflight-only
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/usr/local/bin/python", "-B", "/opt/noam/app/cloud/container/bounded_worker.py"]
