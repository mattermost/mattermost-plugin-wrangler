# Cursor Cloud Agent Environment

Checked-in environment for Cursor Cloud Agents working on **mattermost-plugin-wrangler**.

- `environment.json`: Dockerfile build, install/start scripts, port `8065` (Mattermost)
- `Dockerfile`: Ubuntu 24.04 with Docker-in-Docker, Go 1.24, Node 20, golangci-lint, Playwright Chromium libraries, and prepulled Mattermost EE 12.0 and Postgres 16 images
- `scripts/cloud-agent-install.sh`: `go mod download`, `npm ci` for `webapp/` and `e2e/playwright/`, Playwright Chromium
- `scripts/cloud-agent-start.sh`: starts `dockerd`, optional Docker Hub login, loads the prepulled images
- `cursor.md`: cloud-only runbook for the E2E suite

## Validation

From the repository root:

```bash
python3 -m json.tool .cursor/environment.json >/dev/null
bash -n .cursor/scripts/cloud-agent-install.sh && bash -n .cursor/scripts/cloud-agent-start.sh
docker build --check -f .cursor/Dockerfile .cursor
```

Override `MATTERMOST_IMAGE_TAG` or `POSTGRES_IMAGE_TAG` build args to change the prepulled images.

## Secrets

Configure in the [Cursor Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents):

| Secret | Required | Notes |
|--------|----------|-------|
| `DOCKERHUB_USERNAME` | Recommended | Avoids anonymous pull rate limits |
| `DOCKERHUB_TOKEN` | Recommended | Mark as redacted |

No Mattermost license is required.
