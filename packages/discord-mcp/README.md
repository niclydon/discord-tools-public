# discord-mcp

Generic MCP server for Discord REST operations.

It authenticates to Discord with a bot token and exposes tools for discovery, channels, messages, reactions, threads, webhooks, members, and roles. It can run over Streamable HTTP or stdio.

## Setup

```bash
cp .env.example .env
npm install
npm run check
npm test
```

Set:

- `DISCORD_BOT_TOKEN`: bot token from the Discord Developer Portal.
- `DISCORD_GUILD_ID`: server/guild snowflake ID.
- `TRANSPORT`: `http` or `stdio`.
- `PORT`: HTTP port when `TRANSPORT=http`.
- `ORIGIN_SHARED_SECRET`: optional header guard for HTTP deployments.

## Run

```bash
npm run dev
```

For stdio:

```bash
TRANSPORT=stdio npm start
```

## Notes

This package is a management plane. It uses Discord REST APIs. It does not maintain a gateway websocket session or subscribe to live message events; use `discord-gateway` for that.
