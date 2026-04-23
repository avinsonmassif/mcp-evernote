# ── Stage 1: build mcp-auth-proxy ─────────────────────────────────────────────
FROM golang:latest AS proxy-builder

WORKDIR /src/proxy
RUN git clone --depth 1 https://github.com/sigbit/mcp-auth-proxy.git .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /out/mcp-auth-proxy .

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# mcp-evernote is pulled at runtime via npx — no build stage needed.
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=proxy-builder /out/mcp-auth-proxy /usr/local/bin/mcp-auth-proxy

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# ── State volume ───────────────────────────────────────────────────────────────
# state.json holds the live rotating JWT refresh token.
# Mount a named Docker volume here so it survives container restarts/upgrades:
#   -v evernote-state:/data/mcp-evernote
VOLUME ["/data/mcp-evernote"]

# ── Defaults ───────────────────────────────────────────────────────────────────
# EVERNOTE_SEED_NRT, EVERNOTE_SEED_NCI, and EVERNOTE_DEVICE_ID must be
# supplied at runtime (see docker-compose.yml for a full example).
ENV EVERNOTE_AUTH_MODE=evertoken \
    MCP_EVERNOTE_STATE_PATH=/data/mcp-evernote/state.json \
    EVERNOTE_DEVICE_DESCRIPTION=mcp-evernote-docker \
    EVERNOTE_APP_VERSION=11.12.2 \
    EVERNOTE_OS_PLATFORM=win32 \
    EVERNOTE_OS_RELEASE=10.0

# mcp-auth-proxy default port
EXPOSE 9090

# entrypoint.sh appends "-- npx -y @avinsonmassif/mcp-evernote" so you only
# need to pass the proxy flags (--password, --external-url, etc.) at runtime.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
