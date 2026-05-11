# discord-gateway

Generic local Discord websocket gateway with channel routes and visible receipts.

It is useful when Discord is a delivery surface and you want local code to react to messages or reactions in selected channels. It does not require a database or any private backend.

## Setup

```bash
cp .env.example .env
cp config/routes.example.json config/routes.json
npm install
npm run check
npm test
```

Fill in `.env` and replace the route channel IDs in `config/routes.json`.

## Discord Bot Requirements

Enable these bot permissions when inviting the bot:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads
- Create Private Threads
- Read Message History
- Add Reactions
- Use Slash Commands

Enable Message Content intent in the Developer Portal and set `DISCORD_MESSAGE_CONTENT_INTENT=true` if you want handlers to read message text.

## Route Handlers

Routes are loaded from `ROUTES_FILE`.

- `receipt`: acknowledge the message or reaction and write a JSONL event.
- `echo`: reply with the message text. Useful for smoke testing.
- `webhook`: POST the message or reaction event to a generic HTTP endpoint, then acknowledge success or failure.
- `ignore`: write the JSONL event without replying.

Thread messages and thread reactions inherit the parent channel route.

## Run

```bash
npm run dev
```

Health:

```bash
curl http://127.0.0.1:8787/health
```

Register slash commands:

```bash
npm run register:commands
```

Run the example webhook receiver:

```bash
npm run example:webhook
```

## Event Log

Events are appended to `EVENT_LOG_PATH` as JSON Lines. Keep that path ignored; it may contain private Discord message content.
