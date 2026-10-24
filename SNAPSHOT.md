# Snapshot Provenance

## What this repository is

`discord-tools-public` holds two generic, local-first Discord tools,
published in the open since May 2026:

- `packages/discord-mcp`: an MCP server that exposes Discord REST
  operations (discovery, channels, messages, reactions, threads and
  forum posts, webhooks, members, roles) over Streamable HTTP or
  stdio, authenticated with a single bot token.
- `packages/discord-gateway`: a generic pattern example of a Discord
  websocket gateway: channel routes, visible receipts, webhook
  forwarding, a local JSONL event log, and a health endpoint. It is
  not a snapshot of any specific production gateway.

## Edition facts

- Original publication: **May 11, 2026**, derived from the private
  `discord-mcp` server of May 10, 2026.
- This refresh: **October 24, 2026**. The MCP package was re-derived
  from the private `discord-mcp` repository at HEAD `bb07a45`
  (September 6, 2026; source last changed August 3, 2026).
- What the refresh pulled across: the forum-post tool with file
  attachments, multipart upload support in the REST client, message
  components (button action rows) and explicit color / footer /
  timestamp / reply / thread targeting on embed posts, footer and
  timestamp on webhook embeds, and the active-thread filtering fix,
  with their tests.
- Dependencies were refreshed in the same pass (lockfile
  regenerated; verified with a clean install, typecheck, the full
  test suite, and a build, mirroring CI).

## The scrub

The private server runs several bots from one process and is
deployed inside a private network. The edition removes that layer:

- The multi-identity token map and the per-tool bot-identity
  argument are removed. The edition authenticates as one bot and
  always binds the HTTP transport to `127.0.0.1`; the configurable
  listen-host option is removed with it.
- Deployment material stays private: deploy and install scripts,
  the systemd unit, and the operational narrative docs are not
  published.
- The private smoke path targets a real guild channel by its
  snowflake ID. It is not published; the edition's smoke script and
  the docs' live-smoke guide work against any throwaway server the
  reader configures.
- Operator- and product-specific names in code comments, tool
  descriptions, and test fixtures are generalized. Configuration
  templates carry placeholders only; no tokens, guild or channel
  IDs, or network addresses from the private deployment appear
  here. The audit for this refresh was pattern scans over the tree
  plus gitleaks, both clean.

## Refresh policy

Refreshed deliberately, not mirrored, in the same pattern as the
other public editions in this account: re-audit the private tree,
re-apply the scrub, update this page and the refresh date.
