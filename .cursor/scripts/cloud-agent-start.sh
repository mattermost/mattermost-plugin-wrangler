#!/usr/bin/env bash
# Cursor Cloud Agent start script for mattermost-plugin-wrangler.
# Boots dockerd, logs in to Docker Hub if configured, loads prepulled MM/Postgres images.

set -Eeuo pipefail

log() { printf '[cloud-agent-start] %s\n' "$*" >&2; }

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Materialize cloud-only AGENTS.md from the committed cursor.md.
if [ -f .cursor/cursor.md ]; then
  cp .cursor/cursor.md AGENTS.md
  log "Materialized Cloud Agent instructions at AGENTS.md"
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI is missing; the image did not build from .cursor/Dockerfile"
  exit 1
fi

ensure_docker_socket_access() {
  [ -S /var/run/docker.sock ] || return 0
  sudo groupadd -f docker
  sudo usermod -aG docker "$(id -un)"
  sudo chgrp docker /var/run/docker.sock >/dev/null 2>&1 || true
  sudo chmod g+rw /var/run/docker.sock >/dev/null 2>&1 || true
  if command -v setfacl >/dev/null 2>&1; then
    sudo setfacl -m "u:$(id -un):rw" /var/run/docker.sock >/dev/null 2>&1 || true
  fi
}

# Some nested containers need unprivileged user namespaces.
if [ -f /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]; then
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 >/dev/null 2>&1 || \
    log "Could not relax AppArmor userns restriction"
fi

ensure_docker_socket_access

if ! docker info >/dev/null 2>&1; then
  log "Starting Docker daemon"
  if command -v service >/dev/null 2>&1; then
    sudo sh -c 'service docker start >/tmp/docker-service-start.log 2>&1' || \
      log "service docker start failed; falling back to direct dockerd"
  fi
  if ! pgrep -x dockerd >/dev/null 2>&1; then
    sudo rm -f /var/run/docker.pid
    sudo sh -c 'nohup dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &'
  fi
fi

for _ in $(seq 1 60); do
  ensure_docker_socket_access
  docker info >/dev/null 2>&1 && break
  sleep 1
done

if ! docker info >/dev/null 2>&1; then
  log "Docker did not become ready within 60 seconds"
  tail -n 80 /tmp/docker-service-start.log /tmp/dockerd.log >&2 2>/dev/null || true
  exit 1
fi

log "Docker is ready"

if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  if echo "${DOCKERHUB_TOKEN}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin >/tmp/docker-login.log 2>&1; then
    log "Docker Hub login succeeded"
  else
    log "Docker Hub login failed; see /tmp/docker-login.log"
  fi
else
  log "Docker Hub credentials not configured; anonymous pulls may hit rate limits"
fi

load_image_archive() {
  local image_ref="$1" archive="$2"

  if docker image inspect "$image_ref" >/dev/null 2>&1; then
    return 0
  fi
  if [ -f "$archive" ]; then
    log "Loading prepulled image archive $archive"
    docker load -i "$archive"
    return 0
  fi
  log "No archive for $image_ref; pulling"
  docker pull "$image_ref"
}

if [ "${CLOUD_AGENT_SKIP_IMAGE_LOAD:-}" != "1" ]; then
  load_image_archive "${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG}" /opt/cursor-prepulled/mattermost-enterprise-edition.tar
  load_image_archive "${POSTGRES_IMAGE}:${POSTGRES_IMAGE_TAG}" /opt/cursor-prepulled/postgres.tar
fi

log "Cloud agent start complete"
