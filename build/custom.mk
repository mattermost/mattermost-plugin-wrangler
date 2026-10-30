# Include custom targets and environment variables here

BUILD_DATE = $(shell date -u)
BUILD_HASH = $(shell git rev-parse HEAD)
BUILD_HASH_SHORT = $(shell git rev-parse --short HEAD)
LDFLAGS += -X "main.BuildDate=$(BUILD_DATE)"
LDFLAGS += -X "main.BuildHash=$(BUILD_HASH)"
LDFLAGS += -X "main.BuildHashShort=$(BUILD_HASH_SHORT)"

# macOS bsdtar embeds xattr headers that the Mattermost server rejects on upload.
ifeq ($(shell uname -s),Darwin)
TAR_FLAGS = --no-xattrs --no-mac-metadata
endif

E2E_DIR = e2e/playwright

# Keep the pre-existing default goal; the first rule below would otherwise become it.
.DEFAULT_GOAL := patch

$(E2E_DIR)/node_modules: $(E2E_DIR)/package.json $(E2E_DIR)/package-lock.json
	cd $(E2E_DIR) && npm ci && npx playwright install chromium
	touch $@

## Starts the disposable Mattermost server used by the E2E suite.
.PHONY: e2e-env-up
e2e-env-up:
	cd $(E2E_DIR) && docker compose up -d --wait

## Stops the E2E Mattermost server and wipes its data.
.PHONY: e2e-env-down
e2e-env-down:
	cd $(E2E_DIR) && docker compose down -v

## Builds the plugin and runs the Playwright E2E suite against PW_BASE_URL (default http://localhost:8065).
.PHONY: e2e
e2e: dist $(E2E_DIR)/node_modules
	cd $(E2E_DIR) && npm run tsc && npm test
