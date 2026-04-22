#!/bin/sh
# Wrapper so Docker CMD / docker run args are passed as proxy flags only.
# The MCP server command is always appended after the -- separator.
exec mcp-auth-proxy "$@" -- node /app/dist/index.js
