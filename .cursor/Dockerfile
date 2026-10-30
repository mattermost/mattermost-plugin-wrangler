# syntax=docker/dockerfile:1.7

FROM ubuntu:24.04

ARG TARGETARCH
ARG NODE_VERSION=20.11.1
ARG GO_VERSION=1.24.13
ARG DOCKER_VERSION=28.5.2
ARG DOCKER_COMPOSE_VERSION=v2.40.3
ARG GOLANGCI_LINT_VERSION=v2.1.6
ARG MATTERMOST_IMAGE=mattermost/mattermost-enterprise-edition
ARG MATTERMOST_IMAGE_TAG=12.0
ARG POSTGRES_IMAGE=postgres
ARG POSTGRES_IMAGE_TAG=16-alpine

ENV DEBIAN_FRONTEND=noninteractive \
    MM_IMAGE=${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG} \
    MATTERMOST_IMAGE=${MATTERMOST_IMAGE} \
    MATTERMOST_IMAGE_TAG=${MATTERMOST_IMAGE_TAG} \
    POSTGRES_IMAGE=${POSTGRES_IMAGE} \
    POSTGRES_IMAGE_TAG=${POSTGRES_IMAGE_TAG} \
    PATH=/usr/local/go/bin:/usr/local/node/bin:/home/ubuntu/go/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    acl \
    bash \
    build-essential \
    ca-certificates \
    curl \
    fonts-liberation \
    fonts-noto-color-emoji \
    fuse-overlayfs \
    git \
    iptables \
    jq \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    make \
    openssh-client \
    procps \
    skopeo \
    sudo \
    unzip \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --set iptables /usr/sbin/iptables-legacy \
    && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy \
    && mkdir -p /etc/docker \
    && printf '{\n  "storage-driver": "fuse-overlayfs"\n}\n' > /etc/docker/daemon.json

RUN set -eux; \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "${arch}" in \
        amd64|x86_64) docker_arch="x86_64"; node_arch="x64"; go_arch="amd64"; compose_arch="x86_64" ;; \
        arm64|aarch64) docker_arch="aarch64"; node_arch="arm64"; go_arch="arm64"; compose_arch="aarch64" ;; \
        *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://download.docker.com/linux/static/stable/${docker_arch}/docker-${DOCKER_VERSION}.tgz" -o /tmp/docker.tgz; \
    tar -xzf /tmp/docker.tgz -C /tmp; \
    cp /tmp/docker/* /usr/local/bin/; \
    mkdir -p /usr/local/lib/docker/cli-plugins; \
    curl -fsSL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${compose_arch}" -o /usr/local/lib/docker/cli-plugins/docker-compose; \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    mkdir -p /usr/local/node; \
    tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1; \
    curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" -o /tmp/go.tar.gz; \
    tar -C /usr/local -xzf /tmp/go.tar.gz; \
    curl -fsSL "https://raw.githubusercontent.com/golangci/golangci-lint/${GOLANGCI_LINT_VERSION}/install.sh" | sh -s -- -b /usr/local/bin "${GOLANGCI_LINT_VERSION}"; \
    for bin in node npm npx; do ln -sf /usr/local/node/bin/$bin /usr/local/bin/$bin; done; \
    for bin in go gofmt; do ln -sf /usr/local/go/bin/$bin /usr/local/bin/$bin; done; \
    mkdir -p /opt/cursor-prepulled; \
    skopeo copy --retry-times 3 --override-os linux --override-arch amd64 "docker://${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG}" "docker-archive:/opt/cursor-prepulled/mattermost-enterprise-edition.tar:${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG}"; \
    skopeo copy --retry-times 3 --override-os linux --override-arch "${go_arch}" "docker://${POSTGRES_IMAGE}:${POSTGRES_IMAGE_TAG}" "docker-archive:/opt/cursor-prepulled/postgres.tar:${POSTGRES_IMAGE}:${POSTGRES_IMAGE_TAG}"; \
    rm -rf /tmp/docker /tmp/docker.tgz /tmp/node.tar.xz /tmp/go.tar.gz

RUN groupadd -f docker \
    && if ! id -u ubuntu >/dev/null 2>&1; then useradd -m -s /bin/bash -G sudo,docker ubuntu; fi \
    && usermod -aG sudo,docker ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu \
    && chmod 0440 /etc/sudoers.d/ubuntu \
    && printf '\nexport PATH=/usr/local/go/bin:/usr/local/node/bin:/home/ubuntu/go/bin:$PATH\n' >> /home/ubuntu/.bashrc \
    && chown ubuntu:ubuntu /home/ubuntu/.bashrc

USER ubuntu
WORKDIR /workspace

# Playwright's Chromium is downloaded at boot by cloud-agent-install.sh.
