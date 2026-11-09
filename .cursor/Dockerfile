# syntax=docker/dockerfile:1.7

FROM ubuntu:24.04

ARG TARGETARCH
ARG NODE_VERSION=20.11.1
ARG GO_VERSION=1.24.13
ARG DOCKER_VERSION=28.5.2
ARG DOCKER_COMPOSE_VERSION=v2.40.3
ARG DOCKER_BUILDX_VERSION=v0.38.1
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

# Every download is verified against a pinned SHA256 (published by the
# upstream release; Docker publishes none for its static tarball, so that one
# was computed from the official download). Update the hashes with the versions.
RUN set -eux; \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "${arch}" in \
        amd64|x86_64) \
            docker_arch="x86_64"; node_arch="x64"; go_arch="amd64"; compose_arch="x86_64"; \
            docker_sha="ea90cfd12e1eeb12aa1c971741adb8bd4ed88e2a574eaac13f5029a1dbc6300d"; \
            compose_sha="dba9d98e1ba5bfe11d88c99b9bd32fc4a0624a30fafe68eea34d61a3e42fd372"; \
            buildx_sha="e25d5cd675092bb5d1d03632fdc46cdf3fede7b514dc5f023a105e00d3ce5ad4"; \
            node_sha="d8dab549b09672b03356aa2257699f3de3b58c96e74eb26a8b495fbdc9cf6fbe"; \
            go_sha="1fc94b57134d51669c72173ad5d49fd62afb0f1db9bf3f798fd98ee423f8d730"; \
            golangci_sha="e55e0eb515936c0fbd178bce504798a9bd2f0b191e5e357768b18fd5415ee541" ;; \
        arm64|aarch64) \
            docker_arch="aarch64"; node_arch="arm64"; go_arch="arm64"; compose_arch="aarch64"; \
            docker_sha="9e4f82996ab790724094475ebed33a736434bfe5d45231b676fef22ffb80044d"; \
            compose_sha="d26373b19e89160546d15407516cc59f453030d9bc5b43ba7faf16f7b4980137"; \
            buildx_sha="3b83b3731916ba433feccaaa689fe5bcdc81c641d92c8e6c2ea865dfa141c97a"; \
            node_sha="c957f29eb4e341903520caf362534f0acd1db7be79c502ae8e283994eed07fe1"; \
            go_sha="74d97be1cc3a474129590c67ebf748a96e72d9f3a2b6fef3ed3275de591d49b3"; \
            golangci_sha="582eb73880f4408d7fb89f12b502d577bd7b0b63d8c681da92bb6b9d934d4363" ;; \
        *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://download.docker.com/linux/static/stable/${docker_arch}/docker-${DOCKER_VERSION}.tgz" -o /tmp/docker.tgz; \
    echo "${docker_sha}  /tmp/docker.tgz" | sha256sum -c -; \
    tar -xzf /tmp/docker.tgz -C /tmp; \
    cp /tmp/docker/* /usr/local/bin/; \
    mkdir -p /usr/local/lib/docker/cli-plugins; \
    curl -fsSL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${compose_arch}" -o /usr/local/lib/docker/cli-plugins/docker-compose; \
    echo "${compose_sha}  /usr/local/lib/docker/cli-plugins/docker-compose" | sha256sum -c -; \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose; \
    curl -fsSL "https://github.com/docker/buildx/releases/download/${DOCKER_BUILDX_VERSION}/buildx-${DOCKER_BUILDX_VERSION}.linux-${go_arch}" -o /usr/local/lib/docker/cli-plugins/docker-buildx; \
    echo "${buildx_sha}  /usr/local/lib/docker/cli-plugins/docker-buildx" | sha256sum -c -; \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    echo "${node_sha}  /tmp/node.tar.xz" | sha256sum -c -; \
    mkdir -p /usr/local/node; \
    tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1; \
    curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" -o /tmp/go.tar.gz; \
    echo "${go_sha}  /tmp/go.tar.gz" | sha256sum -c -; \
    tar -C /usr/local -xzf /tmp/go.tar.gz; \
    golangci_version="${GOLANGCI_LINT_VERSION#v}"; \
    curl -fsSL "https://github.com/golangci/golangci-lint/releases/download/${GOLANGCI_LINT_VERSION}/golangci-lint-${golangci_version}-linux-${go_arch}.tar.gz" -o /tmp/golangci-lint.tar.gz; \
    echo "${golangci_sha}  /tmp/golangci-lint.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/golangci-lint.tar.gz -C /usr/local/bin --strip-components=1 "golangci-lint-${golangci_version}-linux-${go_arch}/golangci-lint"; \
    for bin in node npm npx; do ln -sf /usr/local/node/bin/$bin /usr/local/bin/$bin; done; \
    for bin in go gofmt; do ln -sf /usr/local/go/bin/$bin /usr/local/bin/$bin; done; \
    mkdir -p /opt/cursor-prepulled; \
    # Best effort: cloud-agent-start.sh pulls any image whose archive is missing.
    skopeo copy --retry-times 3 --override-os linux --override-arch amd64 "docker://${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG}" "docker-archive:/opt/cursor-prepulled/mattermost-enterprise-edition.tar:${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG}" \
        || { echo "WARN: could not prepull ${MATTERMOST_IMAGE}:${MATTERMOST_IMAGE_TAG}" >&2; rm -f /opt/cursor-prepulled/mattermost-enterprise-edition.tar; }; \
    skopeo copy --retry-times 3 --override-os linux --override-arch "${go_arch}" "docker://${POSTGRES_IMAGE}:${POSTGRES_IMAGE_TAG}" "docker-archive:/opt/cursor-prepulled/postgres.tar:${POSTGRES_IMAGE}:${POSTGRES_IMAGE_TAG}" \
        || { echo "WARN: could not prepull ${POSTGRES_IMAGE}:${POSTGRES_IMAGE_TAG}" >&2; rm -f /opt/cursor-prepulled/postgres.tar; }; \
    rm -rf /tmp/docker /tmp/docker.tgz /tmp/node.tar.xz /tmp/go.tar.gz /tmp/golangci-lint.tar.gz

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
