# Wrangler plugin: Cloud Agent runbook

This environment has Docker (dockerd is started at boot), Go, Node, and Playwright Chromium. Mattermost 12.0 and Postgres images are prepulled.

## Run the E2E suite

From the repo root:

```bash
make dist           # build the plugin bundle into dist/
make e2e-env-up     # Mattermost + Postgres on :8065 (waits until healthy)
make e2e            # typecheck and run the Playwright suite
make e2e-env-down   # stop the server and wipe its data
```

`make e2e` already depends on `make dist`. To run a single spec or test:

```bash
cd e2e/playwright
npx playwright test tests/move_thread.spec.ts
npx playwright test -g "moves a thread by post ID"
```

## Reading results

- Console output uses the `list` reporter.
- HTML report: `e2e/playwright/results/reporter`. Open with `npm run show-report` from `e2e/playwright`.
- On failure, traces, screenshots, and videos are in `e2e/playwright/results/output`. Inspect a trace with `npx playwright show-trace <trace.zip>`.
- Server logs: `cd e2e/playwright && docker compose logs mattermost`. Plugin errors are logged there.

## Notes

- The suite is safe to rerun against the same server; `global_setup.ts` reinstalls the plugin and resets settings.
- Override the server image with `MM_IMAGE=mattermost/mattermost-enterprise-edition:<tag>`.
- If the server is unhealthy, run `make e2e-env-down` and `make e2e-env-up` again.
- Go and webapp unit tests: `make test`.
