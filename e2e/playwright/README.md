# Wrangler plugin E2E tests

Playwright suite covering Wrangler's slash commands, permission settings, and webapp UI.
Built on [`@mattermost/playwright-lib`](https://www.npmjs.com/package/@mattermost/playwright-lib), so no `mattermost` monorepo checkout is needed.

## Running

From the repo root:

```sh
make e2e-env-up    # Mattermost 12.0 + Postgres in Docker on :8065
make e2e           # build the plugin bundle, install deps, run the suite
make e2e-env-down  # stop and wipe the server
```

Or from this directory, after `make dist`:

```sh
npm ci && npx playwright install chromium
npm test              # headless
npm run test:headed   # watch the browser
npm run test:ui       # Playwright UI mode
npm run show-report   # open the last HTML report
```

On a Linux host without Chromium's system libraries, run `npx playwright install --with-deps chromium` once (it uses `sudo apt-get`).

`global_setup.ts` creates the sysadmin, seeds two teams, channels and three users, uploads the newest `dist/*.tar.gz`, resets plugin settings to defaults, and restarts the plugin. Specs create their own threads through the API and set plugin settings with `withSettings`, so the suite is safe to rerun on the same server.

Most command specs execute the slash command through the API (`runCommand`) and assert on the response and server state; `webapp_ui.spec.ts` drives the real UI.

## Writing specs

Specs follow the [Mattermost Playwright guidelines](https://github.com/mattermost/mattermost/blob/master/e2e-tests/playwright/CLAUDE.OPTIONAL.md):

- Use the library's page objects and the Wrangler ones in `support/ui.ts`; keep selectors out of spec files and prefer role, text and label locators.
- Give each test an action-oriented title, a `{tag: '@wrangler_…'}` tag, a JSDoc block with `@objective` (and `@precondition` when settings differ from the defaults), and `// #` action / `// *` verification comments.

`npm run lint:test-docs` checks the documentation format and runs as part of `make e2e`.

## Environment

| Variable | Default |
| --- | --- |
| `PW_BASE_URL` | `http://localhost:8065` |
| `PW_ADMIN_USERNAME` / `PW_ADMIN_PASSWORD` | `sysadmin` / `Sys@dmin-sample1` |
| `PW_HEADLESS` | `true` |
| `MM_IMAGE` (docker compose) | `mattermost/mattermost-enterprise-edition:12.0` |

On Apple silicon the server runs under amd64 emulation, so the first boot is slow.

