# Safe Live Smoke Guide

Use this guide to test the MCP server and gateway against Discord without exposing real community data or production credentials.

## Safety Rules

- Use a throwaway Discord server or a private test channel.
- Use a dedicated test bot token, not a shared production bot.
- Keep `.env`, `config/routes.json`, event logs, and webhook URLs out of Git.
- Use test messages that contain no personal, customer, or private operational content.
- Delete test webhooks and rotate the bot token if either value appears in a public issue, log, screenshot, or commit.

## Discord Setup

Create a Discord application and bot in the Discord Developer Portal, then invite the bot to the throwaway server with only the permissions needed for the feature under test.

For MCP REST tools:

- View Channels
- Send Messages
- Read Message History
- Add Reactions
- Manage Channels, Manage Threads, Manage Messages, Manage Roles, Manage Webhooks, or Kick Members only when testing the matching administrative tool

For the gateway:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads
- Create Private Threads
- Read Message History
- Add Reactions
- Use Slash Commands

Enable Message Content intent only if you are testing handlers that need message text.

## MCP Smoke

Configure the MCP server:

```bash
cp packages/discord-mcp/.env.example packages/discord-mcp/.env
```

Set `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in `packages/discord-mcp/.env`.

Run local validation first:

```bash
npm run check -w discord-mcp
npm test -w discord-mcp
```

Run the live smoke against a safe channel name or ID:

```bash
SMOKE_CHANNEL=bot-lab npm run smoke -w discord-mcp
```

The smoke posts and cleans up test content in the selected channel. Use a channel that exists only for testing.

## Gateway Smoke

Configure the gateway:

```bash
cp packages/discord-gateway/.env.example packages/discord-gateway/.env
cp packages/discord-gateway/config/routes.example.json packages/discord-gateway/config/routes.json
```

Set `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, and safe route channel IDs in `packages/discord-gateway/.env` and `packages/discord-gateway/config/routes.json`.

Use placeholder route names and a local webhook receiver:

```json
{
  "routes": [
    {
      "channel_id": "REPLACE_WITH_TEST_CHANNEL_ID",
      "name": "bot-lab",
      "handler": "echo"
    },
    {
      "channel_id": "REPLACE_WITH_TEST_WEBHOOK_CHANNEL_ID",
      "name": "alerts",
      "handler": "webhook",
      "webhook_url": "http://127.0.0.1:8788/discord-events"
    }
  ]
}
```

Run local validation:

```bash
npm run check -w discord-gateway
npm test -w discord-gateway
```

In one terminal, start the example receiver:

```bash
npm run example:webhook -w discord-gateway
```

In another terminal, start the gateway:

```bash
npm run dev -w discord-gateway
```

Verify health:

```bash
curl http://127.0.0.1:8787/health
```

Send a short test message in the routed Discord channel and confirm that the gateway acknowledges it. If `EVENT_LOG_PATH` is enabled, inspect it locally and do not commit it.

## Cleanup

- Stop both local processes.
- Delete test messages and test webhooks if they are no longer needed.
- Keep `.env`, `config/routes.json`, and event logs ignored.
- Rotate the test bot token if any command output or screenshot exposed it.
