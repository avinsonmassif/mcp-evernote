#!/bin/sh
# Wrapper so Docker CMD / docker run args are passed as proxy flags only.
# The MCP server is pulled and run via npx — always uses the latest published version.
exec mcp-auth-proxy "$@" -- npx -y @avinsonmassif/mcp-evernote
