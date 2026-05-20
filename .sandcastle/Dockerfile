FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
# Drop any pre-existing group/user holding our target GID/UID first
# (e.g. Debian's `dialout` group already owns GID 20, which macOS hosts use for `staff`).
RUN if getent group $AGENT_GID >/dev/null; then \
      conflict_grp=$(getent group $AGENT_GID | cut -d: -f1); \
      if [ "$conflict_grp" != "node" ]; then groupdel "$conflict_grp"; fi; \
    fi && \
    if getent passwd $AGENT_UID >/dev/null; then \
      conflict_usr=$(getent passwd $AGENT_UID | cut -d: -f1); \
      if [ "$conflict_usr" != "node" ]; then userdel -r "$conflict_usr" 2>/dev/null || userdel "$conflict_usr"; fi; \
    fi && \
    groupmod -g $AGENT_GID node && \
    usermod -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node

# Install pnpm globally as root (matches host pnpm 10.30.0 — store layout
# stays compatible between host and container). Corepack is bypassed because
# its interactive download prompt blocks non-TTY containers.
RUN npm install -g pnpm@10.30.0

USER ${AGENT_UID}:${AGENT_GID}

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude + pnpm-managed binaries to PATH.
# PNPM_STORE_DIR points at a directory we expect to be bind-mounted from the
# host's pnpm store (see main.mts mounts config). This gives the container
# read/write access to the same content-addressed store that the host pnpm
# uses, so installs reuse already-downloaded packages — no baked node_modules,
# no per-worktree bloat. Cross-mount hard-link is not possible, so pnpm falls
# back to copying from the store into node_modules — still seconds, not minutes.
ENV PNPM_HOME="/home/agent/.local/share/pnpm"
ENV PNPM_STORE_DIR="/home/agent/.pnpm-store"
ENV PATH="/home/agent/.local/bin:$PNPM_HOME:$PATH"

# Pre-create the store-dir so the bind-mount lands on an existing path with
# correct ownership. If no mount is supplied, pnpm will simply use this empty
# directory as a local store (slower first install, still works).
RUN mkdir -p "$PNPM_STORE_DIR"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
