# Discord Tools Public

This repository contains two generic, local-first Discord tools:

- `packages/discord-mcp`: an MCP server that exposes Discord REST operations as tools.
- `packages/discord-gateway`: a Discord websocket gateway that listens for messages and reactions, routes them by channel, and sends visible receipts.

The repo is intentionally not tied to any private infrastructure. It does not require a database, Cloudflare, a specific guild, or a specific agent/backend system.

## Quick Start

1. Create a Discord application and bot in the Discord Developer Portal.
2. Enable the Message Content intent for the gateway bot if you want to process message text.
3. Invite the bot to your server with permissions for channels, messages, reactions, threads, and slash commands.
4. Install dependencies:

```bash
npm install
```

5. Configure the MCP server:

```bash
cp packages/discord-mcp/.env.example packages/discord-mcp/.env
```

6. Configure the gateway:

```bash
cp packages/discord-gateway/.env.example packages/discord-gateway/.env
cp packages/discord-gateway/config/routes.example.json packages/discord-gateway/config/routes.json
```

7. Fill in your bot token, guild ID, operator user ID, and route channel IDs.
8. Run either service:

```bash
npm run dev:mcp
npm run dev:gateway
```

## Discord Bot Permissions

Start with the smallest permission set for the package you are testing.

For `discord-mcp`, grant only the permissions required by the tools you plan to use:

- View Channels
- Send Messages
- Read Message History
- Add Reactions
- Manage Channels, Manage Threads, Manage Messages, Manage Roles, Manage Webhooks, or Kick Members only when testing the matching administrative tool

For `discord-gateway`, grant:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads
- Create Private Threads
- Read Message History
- Add Reactions
- Use Slash Commands

Enable Message Content intent only when gateway handlers need to read message text.

## What You Get

The MCP server provides tool calls for common Discord REST administration and messaging tasks: discovery, channels, messages, reactions, threads (including forum posts with attachments), webhooks, members, and roles.

The gateway is a generic pattern example: a local event loop for Discord delivery surfaces:

- route messages and reactions by channel
- inherit a parent channel route inside threads
- acknowledge every operator message or reaction with a receipt
- forward events to a generic webhook backend
- keep a local JSONL event log
- expose `/health`

## Safe Live Smoke

Use a throwaway Discord server or private test channel, a dedicated test bot token, and non-sensitive test messages. Do not commit `.env`, `config/routes.json`, event logs, or webhook URLs.

See [docs/live-smoke.md](docs/live-smoke.md) for a safe MCP and gateway smoke-test workflow.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance and credential-rotation steps.

## Public-Safety Boundary

This repository uses placeholder configuration only. Do not commit `.env`, bot tokens, guild IDs, user IDs, channel IDs, webhook URLs containing secrets, generated event logs, or private route files.
