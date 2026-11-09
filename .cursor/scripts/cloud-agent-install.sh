#!/usr/bin/env bash
# Cursor Cloud Agent install script for mattermost-plugin-wrangler.
# Hydrates Go modules, webapp deps, and the E2E suite's npm deps + Chromium.

set -Eeuo pipefail

log() { printf '[cloud-agent-install] %s\n' "$*" >&2; }

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

log "Downloading Go modules"
go mod download

log "Installing webapp dependencies"
(cd webapp && npm ci --no-audit --no-fund)

log "Installing E2E dependencies"
(cd e2e/playwright && npm ci --no-audit --no-fund && npx playwright install chromium)

log "Install complete"
