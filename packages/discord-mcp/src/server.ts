import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscordClient } from "./discord/client.ts";
import type { Resolver } from "./discord/resolve.ts";
import { explainDiscordError } from "./discord/errors.ts";
import { registerDiscovery } from "./tools/discovery.ts";
import { registerMessages } from "./tools/messages.ts";
import { registerReactions } from "./tools/reactions.ts";
import { registerThreads } from "./tools/threads.ts";
import { registerWebhooks } from "./tools/webhooks.ts";
import { registerChannels } from "./tools/channels.ts";
import { registerMembers } from "./tools/members.ts";
import { registerRoles } from "./tools/roles.ts";

export interface ServerContext {
  client: DiscordClient;
  resolver: Resolver;
  guildId: string;
  version: string;
}

export function buildServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: "discord-mcp", version: ctx.version });

  server.registerTool(
    "discord_health",
    {
      title: "Discord MCP health",
      description: "Returns bot user, guild name, and REST ping in ms.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true }
    },
    async () => {
      try {
        const t0 = Date.now();
        const me = await ctx.client.request<{ id: string; username: string }>(
          "GET",
          "/users/@me"
        );
        const guild = await ctx.client.request<{ name: string }>(
          "GET",
          `/guilds/${ctx.guildId}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                bot: me.username,
                bot_id: me.id,
                guild: guild.name,
                guild_id: ctx.guildId,
                ping_ms: Date.now() - t0
              })
            }
          ]
        };
      } catch (e: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: explainDiscordError(e as Parameters<typeof explainDiscordError>[0])
            }
          ]
        };
      }
    }
  );

  registerDiscovery(server, ctx);
  registerMessages(server, ctx);
  registerReactions(server, ctx);
  registerThreads(server, ctx);
  registerWebhooks(server, ctx);
  registerChannels(server, ctx);
  registerMembers(server, ctx);
  registerRoles(server, ctx);

  return server;
}
