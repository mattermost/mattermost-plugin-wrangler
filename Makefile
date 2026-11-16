GO ?= $(shell command -v go 2> /dev/null)
NPM ?= $(shell command -v npm 2> /dev/null)
CURL ?= $(shell command -v curl 2> /dev/null)
MANIFEST_FILE ?= plugin.json
GOPATH ?= $(shell go env GOPATH)
GO_TEST_FLAGS ?= -race
GO_BUILD_FLAGS ?=
MM_UTILITIES_DIR ?= ../mattermost-utilities

export GO111MODULE=on

# You can include assets this directory into the bundle. This can be e.g. used to include profile pictures.
ASSETS_DIR ?= assets

# Verify environment, and define PLUGIN_ID, PLUGIN_VERSION, HAS_SERVER and HAS_WEBAPP as needed.
include build/setup.mk

BUNDLE_NAME ?= $(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

# Include custom makefile, if present
ifneq ($(wildcard build/custom.mk),)
	include build/custom.mk
endif

# ====================================================================================
# Used for semver bumping
PROTECTED_BRANCH := master
APP_NAME    := $(shell basename -s .git `git config --get remote.origin.url`)
# Set DRY_RUN=1 to print the computed version without tagging or pushing
DRY_RUN ?=
# Check if current branch is protected
define check_protected_branch
	@current_branch=$$(git rev-parse --abbrev-ref HEAD); \
	if ! echo "$(PROTECTED_BRANCH)" | grep -wq "$$current_branch" && ! echo "$$current_branch" | grep -q "^release"; then \
		echo "Error: Tagging is only allowed from $(PROTECTED_BRANCH) or release branches. You are on $$current_branch branch."; \
		exit 1; \
	fi
endef
# Check if there are pending pulls
define check_pending_pulls
	@git fetch origin --tags || { echo "Error: Failed to fetch branches and tags from origin"; exit 1; }; \
	current_branch=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$(git rev-parse HEAD)" != "$$(git rev-parse origin/$$current_branch)" ]; then \
		echo "Error: Your branch is not up to date with upstream. Please pull the latest changes before performing a release"; \
		exit 1; \
	fi
endef
# Compute the next version after fetching, then prompt, tag and push it.
# $(1) is the build/next-version.sh bump kind, $(2) the label used in messages.
define bump_version
	$(call check_protected_branch)
	$(call check_pending_pulls)
	@set -e; \
	version=$$(./build/next-version.sh $(1)); \
	if [ -n "$(DRY_RUN)" ]; then \
		echo "[dry run] Would tag and push $$version"; \
		exit 0; \
	fi; \
	read -p "About to bump $(APP_NAME) to version $${version#v}, approve? (y/n) " userinput; \
	if [ "$$userinput" != "y" ]; then \
		echo "Bump aborted."; \
		exit 1; \
	fi; \
	echo "Bumping $(APP_NAME) to $(2) version $${version#v}"; \
	git tag -s -a "$$version" -m "Bumping $(APP_NAME) to $(2) version $${version#v}"; \
	git push origin "$$version" || { git tag -d "$$version"; exit 1; }; \
	echo "Bumped $(APP_NAME) to $(2) version $${version#v}"
endef
# ====================================================================================

.PHONY: patch minor major patch-rc minor-rc major-rc

patch: ## to bump patch version (semver)
	$(call bump_version,patch,Patch)

minor: ## to bump minor version (semver)
	$(call bump_version,minor,Minor)

major: ## to bump major version (semver)
	$(call bump_version,major,Major)

patch-rc: ## to bump patch release candidate version (semver)
	$(call bump_version,patch-rc,Patch RC)

minor-rc: ## to bump minor release candidate version (semver)
	$(call bump_version,minor-rc,Minor RC)

major-rc: ## to bump major release candidate version (semver)
	$(call bump_version,major-rc,Major RC)

## Checks the code style, tests, builds and bundles the plugin.
all: check-style test dist

## Propagates plugin manifest information into the server/ and webapp/ folders as required.
.PHONY: apply
apply:
	./build/bin/manifest apply

## Runs eslint and golangci-lint
.PHONY: check-style
check-style: apply webapp/.npminstall
	@echo Checking for style guide compliance

ifneq ($(HAS_WEBAPP),)
	cd webapp && npm run lint
endif

ifneq ($(HAS_SERVER),)
	@echo Running golangci-lint
	$(GO) vet ./...
	golangci-lint run ./...
endif

## Builds the server, if it exists, including support for multiple architectures.
.PHONY: server
server:
ifneq ($(HAS_SERVER),)
	mkdir -p server/dist;
	cd server && env GOOS=darwin GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -ldflags '$(LDFLAGS)' -o dist/plugin-darwin-amd64;
	cd server && env GOOS=darwin GOARCH=arm64 $(GO) build $(GO_BUILD_FLAGS) -ldflags '$(LDFLAGS)' -o dist/plugin-darwin-arm64;
	cd server && env GOOS=freebsd GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -ldflags '$(LDFLAGS)' -o dist/plugin-freebsd-amd64;
	cd server && env GOOS=linux GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -ldflags '$(LDFLAGS)' -o dist/plugin-linux-amd64;
	cd server && env GOOS=windows GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -ldflags '$(LDFLAGS)' -o dist/plugin-windows-amd64.exe;
endif

## Ensures NPM dependencies are installed without having to run this all the time.
webapp/.npminstall:
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) install
	touch $@
endif

## Builds the webapp, if it exists.
.PHONY: webapp
webapp: webapp/.npminstall
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) run build;
endif

## Builds the webapp in debug mode, if it exists.
webapp-debug: webapp/.npminstall
ifneq ($(HAS_WEBAPP),)
	cd webapp && \
	$(NPM) run debug;
endif

## Generates a tar bundle of the plugin for install.
.PHONY: bundle
bundle:
	rm -rf dist/
	mkdir -p dist/$(PLUGIN_ID)
	./build/bin/manifest dist
ifneq ($(wildcard $(ASSETS_DIR)/.),)
	cp -r $(ASSETS_DIR) dist/$(PLUGIN_ID)/
endif
ifneq ($(HAS_PUBLIC),)
	cp -r public/ dist/$(PLUGIN_ID)/
endif
ifneq ($(HAS_SERVER),)
	mkdir -p dist/$(PLUGIN_ID)/server/dist;
	cp -r server/dist/* dist/$(PLUGIN_ID)/server/dist/;
endif
ifneq ($(HAS_WEBAPP),)
	mkdir -p dist/$(PLUGIN_ID)/webapp/dist;
	cp -r webapp/dist/* dist/$(PLUGIN_ID)/webapp/dist/;
endif
	cd dist && tar -cvzf $(BUNDLE_NAME) $(PLUGIN_ID)

	@echo plugin built at: dist/$(BUNDLE_NAME)

## Builds and bundles the plugin.
.PHONY: dist
dist:	apply server webapp bundle

## Installs the plugin to a (development) server.
## It uses the API if appropriate environment variables are defined,
## and otherwise falls back to trying to copy the plugin to a sibling mattermost-server directory.
.PHONY: deploy
deploy: dist
	./build/bin/deploy $(PLUGIN_ID) dist/$(BUNDLE_NAME)

.PHONY: debug-deploy
debug-deploy: debug-dist deploy

.PHONY: debug-dist
debug-dist: apply server webapp-debug bundle

## Runs any lints and unit tests defined for the server and webapp, if they exist.
.PHONY: test
test: apply webapp/.npminstall
ifneq ($(HAS_SERVER),)
	$(GO) test -v $(GO_TEST_FLAGS) -ldflags '$(LDFLAGS)' ./server/...
endif
ifneq ($(HAS_WEBAPP),)
	cd webapp && $(NPM) run fix && $(NPM) run test;
endif

## Creates a coverage report for the server code.
.PHONY: coverage
coverage: webapp/.npminstall
ifneq ($(HAS_SERVER),)
	$(GO) test $(GO_TEST_FLAGS) -coverprofile=server/coverage.txt ./server/...
	$(GO) tool cover -html=server/coverage.txt
endif

## Extract strings for translation from the source code.
.PHONY: i18n-extract
i18n-extract:
ifneq ($(HAS_WEBAPP),)
ifeq ($(HAS_MM_UTILITIES),)
	@echo "You must clone github.com/mattermost/mattermost-utilities repo in .. to use this command"
else
	cd $(MM_UTILITIES_DIR) && npm install && npm run babel && node mmjstool/build/index.js i18n extract-webapp --webapp-dir $(PWD)/webapp
endif
endif

## Clean removes all build artifacts.
.PHONY: clean
clean:
	rm -fr dist/
ifneq ($(HAS_SERVER),)
	rm -fr server/dist
endif
ifneq ($(HAS_WEBAPP),)
	rm -fr webapp/.npminstall
	rm -fr webapp/dist
	rm -fr webapp/node_modules
endif
	rm -fr build/bin/

# Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@cat Makefile | grep -v '\.PHONY' |  grep -v '\help:' | grep -B1 -E '^[a-zA-Z0-9_.-]+:.*' | sed -e "s/:.*//" | sed -e "s/^## //" |  grep -v '\-\-' | sed '1!G;h;$$!d' | awk 'NR%2{printf "\033[36m%-30s\033[0m",$$0;next;}1' | sort
