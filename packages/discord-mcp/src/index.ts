import { loadEnv } from "./env.ts";
import { DiscordClient } from "./discord/client.ts";
import { Resolver } from "./discord/resolve.ts";
import { buildServer } from "./server.ts";
import { startHttp } from "./http.ts";
import { log } from "./log.ts";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const env = loadEnv();
  const client = new DiscordClient({
    token: env.discordBotToken,
    version: VERSION
  });
  const resolver = new Resolver(client, env.discordGuildId);
  const ctx = {
    client,
    resolver,
    guildId: env.discordGuildId,
    version: VERSION
  };

  if (env.transport === "stdio") {
    const server = buildServer(ctx);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("info", "discord-mcp stdio transport connected");
  } else {
    await startHttp({
      port: env.port,
      originSharedSecret: env.originSharedSecret,
      serverFactory: () => buildServer(ctx),
      version: VERSION
    });
  }
}

main().catch((e) => {
  log("error", "fatal", { error: String(e), stack: (e as Error).stack });
  process.exit(1);
});
